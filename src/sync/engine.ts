// Keeps this device's progress and the synced copy in step. A sync pulls the copy, merges
// it with local data part by part, applies any change locally, and pushes the merged
// result with a version check; if another device wrote in between, it pulls and merges
// again. Merges only ever add progress (or apply a reset), and settings merge field by field
// (fields.ts), so syncing from several devices is safe. A copy that disappears after syncing was
// deleted on another device: this device then stops syncing rather than upload it again.
import type { SyncBackend } from './backend';

/** One piece of synced data (the grown-up profile, the kids' profiles...). */
export interface SyncPart<T = unknown> {
  key: string;
  read(): T;
  write(value: T): void;
  /** `joining`: this device's first sync with the copy. Resets made there before it joined do not
   *  apply to its own progress then. */
  merge(local: T, remote: T, joining: boolean): T;
  /** Brings data from older app versions up to date before merging. `parts`: the whole synced
   *  copy, for data a part keeps in a part of its own. */
  normalize?(value: unknown, parts: Record<string, unknown>): T;
}

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'offline' | 'error';

export const COPY_DELETED = 'The synced copy was deleted on another device, so this device stopped syncing. Its progress is still here.';

export interface SyncSnapshot {
  status: SyncStatus;
  code: string | null;
  lastSyncedAt: number | null;
  error: string | null;
  /** A sync has finished on this device since the app started (or since it was linked): what it
   *  shows is at least as new as the copy was then. */
  caughtUp: boolean;
}

interface Stored {
  code: string;
  lastSyncedAt?: number;
}

interface Payload {
  v: 1;
  at: number;
  parts: Record<string, unknown>;
}

/** Stable JSON (sorted keys) to compare data regardless of key order. */
function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => (a < b ? -1 : 1))) : val,
  );
}

/** The longest a sync waits for its `prepare` hook. */
export const PREPARE_WAIT_MS = 8000;

export class SyncEngine {
  private snap: SyncSnapshot = { status: 'off', code: null, lastSyncedAt: null, error: null, caughtUp: false };
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private applying = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private deleting = false;

  constructor(
    private backend: SyncBackend,
    private parts: SyncPart[],
    private storage: { load(): Stored | null; save(s: Stored | null): void },
    private online: () => boolean = () => true,
    /** Runs before every sync (it must be quick once done): parts that load on demand (Kids) are in the
     *  first sync of a device that is linked, whoever starts it. */
    private prepare?: () => Promise<void>,
  ) {
    const stored = storage.load();
    if (stored) this.snap = { status: 'synced', code: stored.code, lastSyncedAt: stored.lastSyncedAt ?? null, error: null, caughtUp: false };
  }

  get snapshot() {
    return this.snap;
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private set(patch: Partial<SyncSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    if (this.snap.code) this.storage.save({ code: this.snap.code, lastSyncedAt: this.snap.lastSyncedAt ?? undefined });
    this.listeners.forEach((l) => l());
  }

  /** True while the engine itself is writing merged data (ignore those change events). */
  get isApplying() {
    return this.applying;
  }

  addPart(part: SyncPart) {
    if (!this.parts.some((p) => p.key === part.key)) this.parts.push(part);
  }

  /**
   * Starts syncing this device with a code: a new one (the first sync creates the copy) or, with
   * `mustExist`, another device's. Then it resolves to false, linking nothing, when no copy has
   * that code (a typo), and throws when the sync service cannot be reached to check.
   */
  async link(code: string, { mustExist = false } = {}): Promise<boolean> {
    if (mustExist && !(await this.backend.get(code))) return false;
    this.set({ code, status: 'syncing', error: null, lastSyncedAt: null, caughtUp: false });
    await this.running; // a sync for the previous code stops early
    await this.syncNow();
    return true;
  }

  /** Stops syncing on this device; local progress stays. `error` says why, if it was not asked for. */
  unlink(error: string | null = null) {
    if (this.timer) clearTimeout(this.timer);
    this.storage.save(null);
    this.snap = { status: 'off', code: null, lastSyncedAt: null, error, caughtUp: false };
    this.listeners.forEach((l) => l());
  }

  /** Deletes the synced copy for everyone, then unlinks. Throws, staying linked, if that fails. */
  async deleteCopy() {
    const code = this.snap.code;
    if (!code) return;
    this.deleting = true; // no new syncs meanwhile (one could re-create the copy)
    try {
      await this.running;
      await this.backend.remove(code);
    } finally {
      this.deleting = false;
    }
    this.unlink();
  }

  /** Schedules a sync soon (coalesces bursts of changes). */
  schedule(ms = 3000) {
    if (!this.snap.code) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.syncNow(), ms);
  }

  syncNow(): Promise<void> {
    if (!this.snap.code || this.deleting) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        void this.syncNow();
      }
    });
    return this.running;
  }

  /** Waits for `prepare`, but not for one that hangs (a chunk on a stalled connection): the parts already registered sync, and the late one joins the next sync. */
  private async prepared() {
    if (!this.prepare) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<void>((resolve) => void (timer = setTimeout(resolve, PREPARE_WAIT_MS)));
    await Promise.race([this.prepare().catch(() => undefined), late]);
    clearTimeout(timer);
  }

  private async run() {
    const code = this.snap.code!;
    if (!this.online()) return this.set({ status: 'offline' });
    this.set({ status: 'syncing', error: null });
    try {
      await this.prepared();
      for (let attempt = 0; attempt < 5; attempt++) {
        const remote = await this.backend.get(code);
        if (this.snap.code !== code) return; // unlinked meanwhile
        // Synced before but gone now: deleted on another device. Only a device's first sync with a
        // code creates the copy.
        const joining = !this.snap.lastSyncedAt;
        if (!remote && !joining) return this.unlink(COPY_DELETED);
        const remoteParts = (remote?.data as Payload | undefined)?.parts ?? {};
        const merged: Record<string, unknown> = {};
        let differsFromRemote = !remote;
        for (const part of this.parts) {
          const local = part.read();
          const theirs = part.key in remoteParts ? (part.normalize ? part.normalize(remoteParts[part.key], remoteParts) : remoteParts[part.key]) : undefined;
          const value = theirs === undefined ? local : part.merge(local, theirs, joining);
          if (stable(value) !== stable(local)) {
            this.applying = true;
            try {
              part.write(value);
            } finally {
              this.applying = false;
            }
          }
          if (theirs === undefined || stable(value) !== stable(theirs)) differsFromRemote = true;
          merged[part.key] = value;
        }
        // Keep parts this device does not know about (e.g. from a newer app version).
        for (const [k, v] of Object.entries(remoteParts)) if (!(k in merged)) merged[k] = v;
        if (!differsFromRemote) break;
        const res = await this.backend.put(code, { v: 1, at: Date.now(), parts: merged } satisfies Payload, remote?.version ?? 0);
        if (res.ok) break;
        if (attempt === 4) throw new Error('the synced copy kept changing; try again');
      }
      this.set({ status: 'synced', lastSyncedAt: Date.now(), caughtUp: true });
    } catch (e) {
      this.set({ status: this.online() ? 'error' : 'offline', error: (e as Error).message });
    }
  }
}
