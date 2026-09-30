// Cross-device sync wiring: the engine instance, the parts it syncs, and when it runs.
import { useSyncExternalStore } from 'react';
import { toast } from '../lib/toast';
import { SYNC_KEY, SYNC_URL } from './config';
import { supabaseBackend } from './backend';
import { SyncEngine, type SyncPart } from './engine';
import { mirrorOf, readMirror, reconcile, type Values } from './fields';
import { joiningCopy, mergeProfiles } from './merge';
import { maxTally, readTally } from './tally';
import { getProfile, normalizeProfile, replaceProfile, stampsOfSettings, subscribeProfile, type Profile } from '../store/profile';

/**
 * The single-file copy (a claude.ai Artifact) or a copy shown inside another page. There, sync
 * and downloads are left to the full app, and progress moves with Export and Import.
 */
export const embedded = import.meta.env.MODE === 'single' || (typeof window !== 'undefined' && window.top !== window.self);

/** Sync needs a configured backend, and is left to the host inside claude.ai (single-file build). */
export const syncAvailable = !!SYNC_URL && !!SYNC_KEY && !embedded && typeof window !== 'undefined';

/**
 * A part that mirrors data kept inside another part: the tallies (tally.ts) and the settings
 * stamps (fields.ts). Older app versions drop or outdate those while merging, but pass parts they
 * do not know on untouched; the other part's normalize folds this one back in. It is read after
 * that part is merged, so it is up to date.
 */
export const mirrorPart = <T>(key: string, read: () => T): SyncPart<T> => ({ key, read, write: () => undefined, merge: (local) => local });
export const tallyPart = mirrorPart;

const PROFILE_TALLY = 'profile-tally';
const PROFILE_STAMPS = 'profile-stamps';
const profilePart: SyncPart<Profile> = {
  key: 'profile',
  read: getProfile,
  write: (p) => replaceProfile(p, { keepTimestamp: true }),
  merge: (a, b, joining) => normalizeProfile(mergeProfiles(joining ? joiningCopy(a, b) : a, b)),
  normalize: (v, parts) => {
    const p = normalizeProfile(v as Partial<Profile>);
    // The copy's own stamps are the mirror's: an older version that merged the copy since left the
    // stamps in the profile as they were, next to settings it chose by settingsAt.
    const stamps = reconcile(p.settings as unknown as Values, p.settingsAt, readMirror(parts[PROFILE_STAMPS]));
    const out: Profile = { ...p, tally: maxTally(p.tally, readTally(parts[PROFILE_TALLY])) };
    if (Object.keys(stamps).length) out.settingsStamps = stamps;
    else delete out.settingsStamps;
    return out;
  },
};

/** The parts that sync the grown-up profile: the profile itself and the mirrors of its tallies and settings stamps. */
export const profileSyncParts = (): SyncPart[] => [
  profilePart as SyncPart,
  tallyPart(PROFILE_TALLY, () => getProfile().tally ?? {}),
  mirrorPart(PROFILE_STAMPS, () => mirrorOf({ values: getProfile().settings as unknown as Values, stamps: stampsOfSettings(getProfile()) })),
];

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

/**
 * The Kids part joins sync whenever a device is linked, not when the Kids screens happen to load:
 * a device linked in the main app then uploads and pulls the kids in its first sync. The kids
 * modules (store, merge, progress) are a lazy chunk without the screens.
 */
let kidsPart: Promise<void> | null = null;
export function loadKidsPart(): Promise<void> {
  if (!syncAvailable) return Promise.resolve();
  return (kidsPart ??= import('../kids/store/syncKids').then(
    (m) => m.registerKidsSync(),
    () => void (kidsPart = null), // a chunk that could not load (offline): try again next time
  ));
}

export const sync = new SyncEngine(supabaseBackend(SYNC_URL, SYNC_KEY), profileSyncParts(), storage, () => navigator.onLine, loadKidsPart);

/** Other modules (e.g. Kids mode) register their data here to be synced too. */
export const addSyncPart = (part: SyncPart) => sync.addPart(part);

/** How often a linked page that is showing asks the copy for news (the RPC returns the whole payload). */
export const POLL_MS = 60 * 1000;

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
  }, POLL_MS);
  // A linked device syncs the kids too, from the first sync of this page on.
  void (sync.snapshot.code ? loadKidsPart() : Promise.resolve()).then(() => sync.syncNow());
}

export function useSync() {
  return useSyncExternalStore(sync.subscribe, () => sync.snapshot, () => sync.snapshot);
}
