// Optional cloud copy of the profile, used only when the app runs inside a claude.ai
// Artifact viewer that grants the `db` and `user` capabilities. The profile is stored in
// the viewer's private subtree (data/users/<id>/...). Everywhere else this is a no-op and
// progress stays in localStorage.
import { useSyncExternalStore } from 'react';
import { defaultProfile, getProfile, replaceProfile, subscribeProfile, type GameRecord, type Profile } from './profile';

interface DocSnap {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
}
interface Db {
  doc(path: string): DocRef;
}
interface UserCap {
  id(): Promise<string | null>;
}
interface Runtime {
  use(name: string): Promise<unknown>;
}

export type SyncState = 'off' | 'connecting' | 'synced' | 'saving' | 'error';

let syncState: SyncState = 'off';
const listeners = new Set<() => void>();
const setState = (s: SyncState) => {
  syncState = s;
  listeners.forEach((l) => l());
};

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => syncState,
    () => syncState,
  );
}

const WRITE_DELAY = 2500;

export async function startCloudSync() {
  const rt = (window as unknown as { claude?: Runtime }).claude;
  if (!rt || typeof rt.use !== 'function') return;
  setState('connecting');
  let db: Db | null = null;
  let user: UserCap | null = null;
  try {
    [db, user] = (await Promise.all([rt.use('db'), rt.use('user')])) as [Db | null, UserCap | null];
  } catch {
    /* treated as unavailable */
  }
  const uid = user ? await user.id() : null;
  if (!db || !uid) {
    setState('off');
    return;
  }
  const base = `data/users/${uid}`;
  const profileRef = db.doc(`${base}/profile`);
  const gamesRef = db.doc(`${base}/games`);

  let lastGamesJson = '';
  let writing = false;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const write = async () => {
    if (stopped) return;
    if (writing) {
      pending = true;
      return;
    }
    writing = true;
    setState('saving');
    const p = getProfile();
    try {
      const { games, ...rest } = p;
      await profileRef.set({ v: 1, updatedAt: p.updatedAt, json: JSON.stringify(rest) });
      const gamesJson = JSON.stringify(games);
      if (gamesJson !== lastGamesJson) {
        await gamesRef.set({ v: 1, updatedAt: p.updatedAt, json: gamesJson });
        lastGamesJson = gamesJson;
      }
      setState('synced');
    } catch (e) {
      const code = (e as { code?: string }).code;
      // A viewer who may not write (or a revoked grant) keeps a local-only profile.
      if (code === 'invalid_argument' || code === 'revoked' || code === 'not_granted') {
        stopped = true;
        setState('off');
      } else setState('error');
    } finally {
      writing = false;
      if (pending && !stopped) {
        pending = false;
        schedule();
      }
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void write(), WRITE_DELAY);
  };

  try {
    const [ps, gs] = await Promise.all([profileRef.get(), gamesRef.get()]);
    const remoteBody = ps.exists ? ps.data() : undefined;
    const remoteAt = Number(remoteBody?.updatedAt ?? 0);
    const local = getProfile();
    if (remoteBody && remoteAt > (local.updatedAt ?? 0)) {
      const rest = JSON.parse(String(remoteBody.json)) as Omit<Profile, 'games'>;
      const gamesBody = gs.exists ? gs.data() : undefined;
      const games = gamesBody ? (JSON.parse(String(gamesBody.json)) as GameRecord[]) : [];
      lastGamesJson = JSON.stringify(games);
      const base0 = defaultProfile();
      replaceProfile({ ...base0, ...rest, games, settings: { ...base0.settings, ...rest.settings }, puzzles: { ...base0.puzzles, ...rest.puzzles } }, { keepTimestamp: true });
      setState('synced');
    } else if (local.updatedAt > remoteAt) {
      await write();
    } else {
      setState('synced');
    }
  } catch {
    setState('error');
  }
  subscribeProfile(() => {
    if (!stopped) schedule();
  });
}
