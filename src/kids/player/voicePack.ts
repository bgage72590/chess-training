// Pip's voice packs: saving a whole recorded voice on the device so it plays without the internet.
// The page drives the download (iOS has no background fetch and stops idle workers): it lists the
// clips its voice's cache does not have yet and fetches them a few at a time through the service
// worker (src/pwa/sw.template.js), which keeps each clip in the voice's own cache. What a voice has
// on the device is always counted from that cache, never trusted from a flag: browsers can clear it.
import { useEffect, useSyncExternalStore } from 'react';
import { requestPersistence } from '../../lib/storage';

/** Cache names shared with the service worker (a test keeps the two in step). */
export const VOICE_LISTS_CACHE = 'tempo-voice-lists';
export const voiceCacheName = (id: string) => `tempo-voice-${id}`;

export interface PackManifest {
  v: 1;
  voice: string;
  /** How the clips were recorded; part of each clip's address, so a new recording never mixes with old clips. */
  version?: string;
  /** Size of all the clips (written by scripts/voice/render.py); estimated from the durations when missing. */
  bytes?: number;
  clips: Record<string, number>; // clip key -> duration (ms)
}

/** What a finished download leaves: written only once every clip of `version` was in the cache. */
export interface PackRecord {
  version: string;
  clips: number;
  bytes: number;
  at: number;
}

export interface PackStatus {
  /** 'unknown': the clip list could not be loaded (offline and never seen). 'update': a new recording is out. */
  kind: 'unknown' | 'none' | 'saved' | 'update';
  cached: number;
  total: number;
  /** Size of the whole pack. */
  bytes: number;
  /** Size of what is still to fetch. */
  remaining: number;
  /** It was saved once and the browser has since cleared part of it. */
  cleared: boolean;
}

export interface PackRun {
  phase: 'idle' | 'running' | 'paused' | 'failed';
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
  /** Why it stopped: no connection, no room, no clip list, or another voice is downloading. */
  reason?: 'network' | 'space' | 'manifest' | 'busy';
}

export interface ConnectionInfo {
  type?: string;
  saveData?: boolean;
}

/** Only a connection that says it is Wi-Fi or ethernet, with data saving off, is known to be unmetered (Safari says nothing). */
export const isUnmetered = (c: ConnectionInfo | undefined) => !!c && !c.saveData && (c.type === 'wifi' || c.type === 'ethernet');

/** Whether to ask before downloading: unless the connection is known unmetered, and always on iPhone and iPad. */
export const mustAskFirst = (c: ConnectionInfo | undefined, ios: boolean) => ios || !isUnmetered(c);

export function isIos(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent, touchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints) {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
}

/** Saves a voice on its own only when it has never been saved at this version, is not complete, and the connection is known unmetered. */
export function autoDownloadWanted(o: { connection: ConnectionInfo | undefined; complete: boolean; version: string; savedVersion?: string; autoVersion?: string }) {
  return !o.complete && o.savedVersion !== o.version && o.autoVersion !== o.version && isUnmetered(o.connection);
}

/** Megabytes (decimal, as storage screens show them) without the unit: '44', or '4.4' for small sizes. */
export const megabytes = (bytes: number) => (bytes / 1e6 < 10 ? (bytes / 1e6).toFixed(1) : String(Math.round(bytes / 1e6)));
export const formatSize = (bytes: number) => `${megabytes(bytes)} MB`;

/** What a voice's row shows: the download in progress, else what the device has of it. */
export type PackView =
  | { kind: 'checking' }
  /** Not on the device: streams as used. `size` is what a download would fetch; `cleared`: the browser removed part of a saved voice. */
  | { kind: 'streams'; size: number; cleared: boolean; offline: boolean }
  | { kind: 'downloading' | 'paused' | 'failed'; pct: number; done: number; total: number; reason?: PackRun['reason'] }
  | { kind: 'saved'; size: number }
  | { kind: 'update'; size: number };

export function packView(run: PackRun, status: PackStatus | undefined): PackView {
  if (run.phase !== 'idle') {
    const pct = run.bytesTotal > 0 ? Math.min(100, Math.floor((run.bytesDone / run.bytesTotal) * 100)) : 0;
    return { kind: run.phase === 'running' ? 'downloading' : run.phase, pct, done: run.bytesDone, total: run.bytesTotal, reason: run.reason };
  }
  if (!status) return { kind: 'checking' };
  if (status.kind === 'saved') return { kind: 'saved', size: status.bytes };
  if (status.kind === 'update') return { kind: 'update', size: status.remaining };
  return { kind: 'streams', size: status.remaining, cleared: status.cleared, offline: status.kind === 'unknown' };
}

export interface PackCache {
  keys(): Promise<readonly { url: string }[]>;
  match(url: string): Promise<Response | undefined>;
  put(url: string, res: Response): Promise<void>;
}

export interface PackEnv {
  caches: { open(name: string): Promise<PackCache> } | null;
  fetch(url: string, init?: { signal?: AbortSignal; cache?: RequestCache }): Promise<Response>;
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** The page's address: clips are found relative to it. */
  base: string;
  estimate(): Promise<{ usage?: number; quota?: number } | undefined>;
  /** Called when a download starts: asks the browser to keep the data. */
  persist(): void;
  connection(): ConnectionInfo | undefined;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
  now(): number;
}

const STORE_KEY = 'tempo.voicepacks.v1';
/** Clips fetched at once. */
const PARALLEL = 5;
/** Tries per clip, with a wait that doubles between them. */
const ATTEMPTS = 4;
/** Clips in a row that fail all their tries before the download stops (a dead connection). */
const MAX_FAILS = 3;
const backoff = (attempt: number) => Math.min(4000, 500 * 2 ** attempt);
/** Room needed beyond the pack itself. */
const HEADROOM = 1.1;

interface Stored {
  saved: Record<string, PackRecord>;
  /** Voice -> the recording version an automatic download has already dealt with. */
  auto: Record<string, string>;
}

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

const isQuota = (e: unknown) => (e as { name?: string } | null)?.name === 'QuotaExceededError';
const isAbort = (e: unknown) => (e as { name?: string } | null)?.name === 'AbortError';
/** A missing file will not come back by asking again; a busy server or a dropped connection might. */
const retryable = (e: unknown) => !(e instanceof HttpError) || e.status >= 500 || e.status === 429 || e.status === 408;

const validManifest = (m: unknown): m is PackManifest => !!m && typeof m === 'object' && (m as PackManifest).v === 1 && typeof (m as PackManifest).clips === 'object' && !!(m as PackManifest).clips;

export function createVoicePacks(env: PackEnv) {
  const listeners = new Set<() => void>();
  let tick = 0;
  const emit = () => {
    tick++;
    listeners.forEach((l) => l());
  };
  const runs = new Map<string, PackRun>();
  const statuses = new Map<string, PackStatus>();
  const controllers = new Map<string, AbortController>();
  const cancelled = new Set<string>();
  const idle: PackRun = { phase: 'idle', done: 0, total: 0, bytesDone: 0, bytesTotal: 0 };

  const read = (): Stored => {
    try {
      const raw = JSON.parse(env.storage?.getItem(STORE_KEY) ?? 'null') as Partial<Stored> | null;
      return { saved: raw?.saved && typeof raw.saved === 'object' ? raw.saved : {}, auto: raw?.auto && typeof raw.auto === 'object' ? raw.auto : {} };
    } catch {
      return { saved: {}, auto: {} };
    }
  };
  const write = (fn: (s: Stored) => void) => {
    const s = read();
    fn(s);
    try {
      env.storage?.setItem(STORE_KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable: the cache count still tells the truth */
    }
  };

  const url = (path: string) => new URL(path, env.base).href;
  const clipUrl = (id: string, m: PackManifest, key: string) => url(`voice/${id}/${key}.mp3${m.version ? `?v=${encodeURIComponent(m.version)}` : ''}`);

  async function loadManifest(id: string): Promise<PackManifest | null> {
    try {
      const res = await env.fetch(url(`voice/${id}/manifest.json`), { cache: 'no-cache' });
      if (!res.ok) return null;
      const m: unknown = await res.json();
      return validManifest(m) ? m : null;
    } catch {
      return null;
    }
  }

  /** Bytes of each clip: the pack's size shared out by duration (the clips are constant-bitrate). */
  function sizer(m: PackManifest) {
    const keys = Object.keys(m.clips);
    const totalMs = keys.reduce((n, k) => n + m.clips[k], 0);
    const bytes = m.bytes ?? totalMs * 8; // 64 kbit/s is 8 bytes per millisecond
    return { bytes, of: (k: string) => (totalMs > 0 ? (bytes * m.clips[k]) / totalMs : bytes / Math.max(1, keys.length)) };
  }

  async function cachedUrls(id: string): Promise<{ cache: PackCache; have: Set<string> } | null> {
    if (!env.caches) return null;
    const cache = await env.caches.open(voiceCacheName(id));
    return { cache, have: new Set((await cache.keys()).map((r) => r.url)) };
  }

  /** What this device has of a voice, counted from the cache now (`loaded`: the clip list, when the caller has it). */
  async function status(id: string, loaded?: PackManifest): Promise<PackStatus> {
    const none: PackStatus = { kind: 'unknown', cached: 0, total: 0, bytes: 0, remaining: 0, cleared: false };
    const m = loaded ?? (await loadManifest(id));
    const store = await cachedUrls(id).catch(() => null);
    if (!m || !store || !Object.keys(m.clips).length) return none;
    const version = m.version ?? '';
    const size = sizer(m);
    const keys = Object.keys(m.clips);
    const missing = keys.filter((k) => !store.have.has(clipUrl(id, m, k)));
    const rec = read().saved[id];
    const out: PackStatus = { kind: 'none', cached: keys.length - missing.length, total: keys.length, bytes: size.bytes, remaining: missing.reduce((n, k) => n + size.of(k), 0), cleared: false };
    if (!missing.length) {
      // Complete, whoever fetched it (this download, or clips heard and prefetched by older versions).
      if (rec?.version !== version) write((s) => void (s.saved[id] = { version, clips: keys.length, bytes: size.bytes, at: env.now() }));
      out.kind = 'saved';
    } else if (rec && rec.version !== version) {
      out.kind = 'update';
    } else {
      out.cleared = !!rec && out.cached < rec.clips;
    }
    statuses.set(id, out);
    emit();
    return out;
  }

  const setRun = (id: string, patch: Partial<PackRun>) => {
    runs.set(id, { ...(runs.get(id) ?? idle), ...patch });
    emit();
  };
  const running = () => [...runs].find(([, r]) => r.phase === 'running')?.[0];

  /** Downloads what a voice is missing. Resolves when it has finished, stopped or been paused. */
  async function download(id: string, opts: { auto?: boolean } = {}): Promise<PackRun> {
    const busy = running();
    if (busy) return busy === id ? (runs.get(id) ?? idle) : { ...idle, phase: 'failed', reason: 'busy' };
    if (!env.caches) return { ...idle, phase: 'failed', reason: 'manifest' };
    const ctl = new AbortController();
    controllers.set(id, ctl);
    setRun(id, { ...idle, phase: 'running', reason: undefined });
    env.persist();
    let version = '';
    const stop = (phase: 'paused' | 'failed' | 'idle', reason?: PackRun['reason']) => {
      if (cancelled.delete(id)) {
        runs.delete(id);
        emit();
        return idle;
      }
      setRun(id, { phase, reason });
      // An automatic download is not repeated for a recording the person paused it on, or that had no room.
      if (opts.auto && version && (phase === 'paused' || reason === 'space')) write((s) => void (s.auto[id] = version));
      return runs.get(id) ?? idle;
    };
    try {
      const m = await loadManifest(id);
      if (!m) return stop('failed', 'manifest');
      version = m.version ?? '';
      const size = sizer(m);
      const keys = Object.keys(m.clips);
      const store = await cachedUrls(id);
      if (!store) return stop('failed', 'manifest');
      const { cache } = store;
      let todo = keys.filter((k) => !store.have.has(clipUrl(id, m, k)));
      const done0 = keys.length - todo.length;
      let bytesDone = keys.filter((k) => store.have.has(clipUrl(id, m, k))).reduce((n, k) => n + size.of(k), 0);
      const room = await env.estimate().catch(() => undefined);
      if (room?.quota != null && room.usage != null && room.quota - room.usage < todo.reduce((n, k) => n + size.of(k), 0) * HEADROOM) return stop('failed', 'space');
      let done = done0;
      setRun(id, { total: keys.length, done, bytesTotal: size.bytes, bytesDone });

      const fetchClip = async (key: string) => {
        const address = clipUrl(id, m, key);
        for (let attempt = 0; ; attempt++) {
          try {
            const res = await env.fetch(address, { signal: ctl.signal });
            if (res.status !== 200) throw new HttpError(res.status);
            const body = await res.arrayBuffer();
            // The worker keeps each clip it fetches; make sure (no worker in control yet, or its put still running).
            if (!(await cache.match(address))) await cache.put(address, new Response(body, { headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'audio/mpeg' } }));
            return;
          } catch (e) {
            if (ctl.signal.aborted || isQuota(e) || !retryable(e) || attempt >= ATTEMPTS - 1) throw e;
            await env.sleep(backoff(attempt), ctl.signal);
          }
        }
      };

      /** One pass over `list`; says why it ended early, if it did. */
      const pass = async (list: string[]): Promise<'network' | 'space' | null> => {
        let next = 0;
        let fails = 0;
        let ended: 'network' | 'space' | null = null;
        const worker = async () => {
          while (!ctl.signal.aborted && !ended) {
            const key = list[next++];
            if (key === undefined) return;
            try {
              await fetchClip(key);
              fails = 0;
              done++;
              bytesDone += size.of(key);
              setRun(id, { done, bytesDone });
            } catch (e) {
              if (ctl.signal.aborted || isAbort(e)) return;
              if (isQuota(e)) ended = 'space';
              else if (++fails >= MAX_FAILS) ended = 'network';
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(PARALLEL, list.length) }, worker));
        return ended;
      };

      // A second pass picks up clips that were fetched but did not end up in the cache.
      for (let n = 0; n < 2 && todo.length; n++) {
        const ended = await pass(todo);
        if (ctl.signal.aborted) return stop('paused');
        if (ended) return stop('failed', ended);
        const now = await cachedUrls(id);
        todo = keys.filter((k) => !now?.have.has(clipUrl(id, m, k)));
        // Bytes and clips done follow what the cache holds.
        done = keys.length - todo.length;
        bytesDone = keys.filter((k) => now?.have.has(clipUrl(id, m, k))).reduce((sum, k) => sum + size.of(k), 0);
        setRun(id, { done, bytesDone });
      }
      if (todo.length) return stop('failed', 'network');
      write((s) => {
        s.saved[id] = { version, clips: keys.length, bytes: size.bytes, at: env.now() };
        if (opts.auto) s.auto[id] = version;
      });
      stop('idle');
      await status(id);
      return runs.get(id) ?? idle;
    } catch {
      return ctl.signal.aborted ? stop('paused') : stop('failed', 'network');
    } finally {
      controllers.delete(id);
    }
  }

  return {
    subscribe(l: () => void) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    snapshot: () => tick,
    /** Whether the browser can keep files for later (the Cache API). */
    supported: () => !!env.caches,
    run: (id: string): PackRun => runs.get(id) ?? idle,
    statusOf: (id: string): PackStatus | undefined => statuses.get(id),
    /** The voice that is downloading now, if any (one at a time). */
    running,
    status,
    /** Starts, or after a pause resumes, a download: clips already on the device are skipped. */
    start: (id: string) => download(id),
    /** Stops downloading; what is saved stays, and Resume carries on from it. */
    pause(id: string) {
      controllers.get(id)?.abort();
    },
    /** Stops downloading and forgets the run (the clips fetched so far stay cached). */
    cancel(id: string) {
      const ctl = controllers.get(id);
      if (!ctl) return void (runs.delete(id), emit());
      cancelled.add(id);
      ctl.abort();
    },
    /** Voices that finished downloading on this device. */
    savedIds: () => Object.keys(read().saved),
    record: (id: string): PackRecord | undefined => read().saved[id],
    /**
     * Saves `id` on its own, for the voice of the kid in use: only on a connection known to be
     * unmetered with data saving off, and only until the recording at hand has been saved once.
     * Returns whether a download ran.
     */
    async autoDownload(id: string, connection = env.connection()): Promise<boolean> {
      if (!env.caches || running() || !isUnmetered(connection)) return false;
      const m = await loadManifest(id);
      if (!m || !Object.keys(m.clips).length) return false;
      const version = m.version ?? '';
      const st = read();
      const s = await status(id, m);
      if (!autoDownloadWanted({ connection, complete: s.kind === 'saved', version, savedVersion: st.saved[id]?.version, autoVersion: st.auto[id] })) return false;
      await download(id, { auto: true });
      return true;
    },
  };
}

export type VoicePacks = ReturnType<typeof createVoicePacks>;

/** The clip list of every voice on offer, for names next to sizes. */
export async function loadVoiceNames(f: PackEnv['fetch'] = (u, i) => fetch(u, i), base = document.baseURI): Promise<Record<string, string>> {
  try {
    const res = await f(new URL('voice/voices.json', base).href);
    const list = (await res.json()) as { voices?: { id: string; name: string }[] };
    return Object.fromEntries((list.voices ?? []).map((v) => [v.id, v.name]));
  } catch {
    return {};
  }
}

const browserEnv: PackEnv = {
  get caches() {
    try {
      return typeof caches === 'undefined' ? null : caches;
    } catch {
      return null;
    }
  },
  fetch: (u, init) => fetch(u, init),
  get storage() {
    try {
      return localStorage;
    } catch {
      return null;
    }
  },
  get base() {
    return document.baseURI;
  },
  estimate: async () => (typeof navigator !== 'undefined' ? navigator.storage?.estimate?.() : undefined),
  persist: () => void requestPersistence(),
  connection: () => (typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { connection?: ConnectionInfo }).connection),
  sleep: (ms, signal) =>
    new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
    }),
  now: () => Date.now(),
};

export const voicePacks = createVoicePacks(browserEnv);

/** A voice's pack as the grown-ups' screen shows it: what is on the device (counted again when the panel opens) and the download in progress. */
export function useVoicePack(id: string) {
  useSyncExternalStore(voicePacks.subscribe, voicePacks.snapshot, voicePacks.snapshot);
  useEffect(() => {
    if (voicePacks.run(id).phase !== 'running') void voicePacks.status(id);
  }, [id]);
  return { run: voicePacks.run(id), status: voicePacks.statusOf(id), supported: voicePacks.supported(), busyWith: voicePacks.running() };
}
