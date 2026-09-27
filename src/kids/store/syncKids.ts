// Syncs the kids (and the family star jar) across linked devices. Registered when Kids mode loads;
// until then the synced copy keeps the kids part untouched. Like the grown-up merge, it keeps
// progress made on either device: nodes, stickers, days and games combine item by item, and names,
// avatars and settings follow the device that changed last. Deleted kids stay deleted.
import { addSyncPart, sync, syncAvailable } from '../../sync';
import { applySyncedKids, getKids, normalizeKids, subscribeKids, SEEN_MAX, FIRSTS_MAX, type DayRecord, type KidProfile, type KidsState, type NodeProgress } from './kidsStore';

export type SyncedKids = Pick<KidsState, 'kids' | 'family' | 'removed' | 'updatedAt'>;

type Rec<T> = Record<string, T>;

function mergeRecord<T>(a: Rec<T> = {}, b: Rec<T> = {}, pick: (x: T, y: T) => T): Rec<T> {
  const out: Rec<T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? pick(out[k], v) : v;
  return out;
}

const union = <T>(a: T[] = [], b: T[] = []) => [...new Set([...a, ...b])];
/** true if either side is true, else the later side's value (keeps merge(x, x) equal to x). */
const either = (x: boolean | undefined, y: boolean | undefined, later: boolean | undefined) => (x || y ? true : later);

function mergeNode(x: NodeProgress, y: NodeProgress): NodeProgress {
  const later = y.last > x.last ? y : x;
  const out: NodeProgress = {
    ...later,
    stars: Math.max(x.stars, y.stars) as NodeProgress['stars'],
    plays: Math.max(x.plays, y.plays),
    last: Math.max(x.last, y.last),
    masteredDays: union(x.masteredDays, y.masteredDays).sort().slice(-2),
    golden: either(x.golden, y.golden, later.golden),
    tested: either(x.tested, y.tested, later.tested),
    passed: either(x.passed, y.passed, later.passed),
  };
  if (x.won || y.won) out.won = union(x.won, y.won);
  return out;
}

const mergeDay = (x: DayRecord, y: DayRecord): DayRecord => {
  const out: DayRecord = { ...x, minutes: Math.max(x.minutes, y.minutes), stars: Math.max(x.stars, y.stars), planted: either(x.planted, y.planted, x.planted) };
  if (x.stickers || y.stickers) out.stickers = union(x.stickers, y.stickers);
  return out;
};

/** Merges one kid's two copies; `b` is from the side that changed last. */
export function mergeKid(a: KidProfile, b: KidProfile): KidProfile {
  const pz = b.puzzle.attempts > a.puzzle.attempts ? b.puzzle : a.puzzle;
  const out: KidProfile = {
    ...b,
    created: Math.min(a.created, b.created),
    nodes: mergeRecord(a.nodes, b.nodes, mergeNode),
    stickers: mergeRecord(a.stickers, b.stickers, Math.min),
    trophies: mergeRecord(a.trophies, b.trophies, Math.min),
    wardrobe: union(a.wardrobe, b.wardrobe),
    puzzle: {
      ...pz,
      seen: union(a.puzzle.seen, b.puzzle.seen).slice(-SEEN_MAX),
      bestStreak: Math.max(a.puzzle.bestStreak, b.puzzle.bestStreak),
    },
    bots: mergeRecord(a.bots, b.bots, (x, y) => (x && y ? { w: Math.max(x.w, y.w), d: Math.max(x.d, y.d), l: Math.max(x.l, y.l) } : (x ?? y))),
    bests: mergeRecord(a.bests, b.bests, (_x, y) => y),
    days: mergeRecord(a.days, b.days, mergeDay),
    garden: Math.max(a.garden, b.garden),
    firsts: union(a.firsts, b.firsts).slice(-FIRSTS_MAX),
    placed: either(a.placed, b.placed, b.placed),
  };
  const dailyDone = [a.puzzle.dailyDone, b.puzzle.dailyDone].filter(Boolean).sort().pop();
  if (dailyDone) out.puzzle.dailyDone = dailyDone;
  if (a.testedOut !== undefined || b.testedOut !== undefined) out.testedOut = Math.max(a.testedOut ?? 0, b.testedOut ?? 0);
  const grad = [a.graduated, b.graduated].filter((g) => !!g).sort((x, y) => x!.t - y!.t)[0];
  if (grad) out.graduated = grad;
  // The play-time limit follows the most recent session, so switching devices does not reset it.
  const session = [a.session, b.session].filter((s) => !!s).sort((x, y) => y!.last - x!.last)[0];
  if (session) out.session = session;
  return out;
}

export function mergeSyncedKids(local: SyncedKids, remote: SyncedKids): SyncedKids {
  const remoteNewer = remote.updatedAt > local.updatedAt;
  const [older, newer] = remoteNewer ? [local, remote] : [remote, local];
  const removed = mergeRecord(local.removed, remote.removed, Math.max);
  const byId = new Map<string, KidProfile>();
  for (const k of older.kids) byId.set(k.id, k);
  const kids: KidProfile[] = [];
  for (const k of newer.kids) {
    const o = byId.get(k.id);
    kids.push(o ? mergeKid(o, k) : k);
    byId.delete(k.id);
  }
  kids.push(...byId.values());
  const out: SyncedKids = {
    kids: kids.filter((k) => !(k.id in removed)),
    family: { stars: Math.max(local.family.stars, remote.family.stars), parties: Math.max(local.family.parties, remote.family.parties) },
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
  if (Object.keys(removed).length) out.removed = removed;
  return out;
}

const pick = (s: KidsState): SyncedKids => {
  const out: SyncedKids = { kids: s.kids, family: s.family, updatedAt: s.updatedAt };
  if (s.removed) out.removed = s.removed;
  return out;
};

let registered = false;

/** Adds the kids to cross-device sync (once) and pulls what other devices have. */
export function registerKidsSync() {
  if (registered || !syncAvailable) return;
  registered = true;
  addSyncPart({
    key: 'kids',
    read: () => pick(getKids()),
    write: (v) => applySyncedKids(v as SyncedKids),
    merge: (a, b) => mergeSyncedKids(a as SyncedKids, b as SyncedKids),
    normalize: (v) => pick(normalizeKids({ ...(v as object), v: 1 })),
  });
  subscribeKids(() => {
    if (!sync.isApplying) sync.schedule();
  });
  void sync.syncNow();
}
