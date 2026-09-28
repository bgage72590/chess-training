// Cross-device sync wiring: the engine instance, the parts it syncs, and when it runs.
import { useSyncExternalStore } from 'react';
import { toast } from '../lib/toast';
import { SYNC_KEY, SYNC_URL } from './config';
import { supabaseBackend } from './backend';
import { SyncEngine, type SyncPart } from './engine';
import { joiningCopy, mergeProfiles } from './merge';
import { maxTally, readTally } from './tally';
import { getProfile, normalizeProfile, replaceProfile, subscribeProfile, type Profile } from '../store/profile';

/**
 * The single-file copy (a claude.ai Artifact) or a copy shown inside another page. There, sync
 * and downloads are left to the full app, and progress moves with Export and Import.
 */
export const embedded = import.meta.env.MODE === 'single' || (typeof window !== 'undefined' && window.top !== window.self);

/** Sync needs a configured backend, and is left to the host inside claude.ai (single-file build). */
export const syncAvailable = !!SYNC_URL && !!SYNC_KEY && !embedded && typeof window !== 'undefined';

/**
 * A part that mirrors the tallies (tally.ts) kept inside another part. Older app versions drop or
 * outdate those while merging, but pass parts they do not know on untouched; the other part's
 * normalize folds this one back in. It is read after that part is merged, so it is up to date.
 */
export const tallyPart = <T>(key: string, read: () => T): SyncPart<T> => ({ key, read, write: () => undefined, merge: (local) => local });

const PROFILE_TALLY = 'profile-tally';
const profilePart: SyncPart<Profile> = {
  key: 'profile',
  read: getProfile,
  write: (p) => replaceProfile(p, { keepTimestamp: true }),
  merge: (a, b, joining) => normalizeProfile(mergeProfiles(joining ? joiningCopy(a, b) : a, b)),
  normalize: (v, parts) => {
    const p = normalizeProfile(v as Partial<Profile>);
    return { ...p, tally: maxTally(p.tally, readTally(parts[PROFILE_TALLY])) };
  },
};

const STORE_KEY = 'tempo.sync.v1';
const storage = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    } catch {
      return null;
    }
  },
  save(s: unknown) {
    try {
      if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s));
      else localStorage.removeItem(STORE_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

export const sync = new SyncEngine(supabaseBackend(SYNC_URL, SYNC_KEY), [profilePart, tallyPart(PROFILE_TALLY, () => getProfile().tally ?? {})], storage, () => navigator.onLine);

/** Other modules (e.g. Kids mode) register their data here to be synced too. */
export const addSyncPart = (part: SyncPart) => sync.addPart(part);

export function startSync() {
  if (!syncAvailable) return;
  // Sync stops by itself only when the copy was deleted on another device: say so.
  sync.subscribe(() => {
    const { code, error } = sync.snapshot;
    if (!code && error) toast({ title: 'Sync stopped on this device', body: error, icon: 'x', tone: 'bad' }, 9000);
  });
  subscribeProfile(() => {
    if (!sync.isApplying) sync.schedule();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sync.syncNow();
  });
  window.addEventListener('online', () => void sync.syncNow());
  setInterval(() => {
    if (document.visibilityState === 'visible') void sync.syncNow();
  }, 5 * 60 * 1000);
  void sync.syncNow();
}

export function useSync() {
  return useSyncExternalStore(sync.subscribe, () => sync.snapshot, () => sync.snapshot);
}
