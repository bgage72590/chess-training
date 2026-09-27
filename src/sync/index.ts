// Cross-device sync wiring: the engine instance, the parts it syncs, and when it runs.
import { useSyncExternalStore } from 'react';
import { SYNC_KEY, SYNC_URL } from './config';
import { supabaseBackend } from './backend';
import { SyncEngine, type SyncPart } from './engine';
import { mergeProfiles } from './merge';
import { getProfile, normalizeProfile, replaceProfile, subscribeProfile, type Profile } from '../store/profile';

/** Sync needs a configured backend, and is left to the host inside claude.ai (single-file build). */
export const syncAvailable = !!SYNC_URL && !!SYNC_KEY && import.meta.env.MODE !== 'single' && typeof window !== 'undefined' && window.top === window.self;

const profilePart: SyncPart<Profile> = {
  key: 'profile',
  read: getProfile,
  write: (p) => replaceProfile(p, { keepTimestamp: true }),
  merge: (a, b) => normalizeProfile(mergeProfiles(a, b)),
  normalize: (v) => normalizeProfile(v as Partial<Profile>),
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

export const sync = new SyncEngine(supabaseBackend(SYNC_URL, SYNC_KEY), [profilePart], storage, () => navigator.onLine);

/** Other modules (e.g. Kids mode) register their data here to be synced too. */
export const addSyncPart = (part: SyncPart) => sync.addPart(part);

export function startSync() {
  if (!syncAvailable) return;
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
