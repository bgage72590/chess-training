// Syncs the kids (and the family star jar) across linked devices. Registered (sync/index.ts,
// loadKidsPart) whenever a device is linked, whether or not Kids mode was opened; until then the
// synced copy keeps the kids part untouched. Like the grown-up merge, it keeps progress made on
// either device: nodes, stickers, days and games combine item by item, minutes and stars add up what
// each device did (sync/tally.ts), and a kid's name, avatar, age group and every setting follow the
// device where they were changed last, field by field (sync/fields.ts: a grown-up's voice pick is
// not undone by a change to another setting on a device that had not heard of it yet). Deleted kids
// stay deleted, a reset wins over progress made before it, and so does a grown-up's "Starting rank".
// The same kid made on two devices before they were linked is merged, or offered for merging
// (twins). Quiet mode, the PIN and the device voice are not here: they stay on the device.
import { dayKey } from '../../lib/srs';
import { addSyncPart, mirrorPart, sync, syncAvailable, tallyPart } from '../../sync';
import type { SyncPart } from '../../sync/engine';
import { mergeFields, mirrorOf, readMirror, reconcile, stableJson, type StampMirror } from '../../sync/fields';
import { filterTally, maxTally, mergeTallied, readTally, type Tally } from '../../sync/tally';
import { placementRating, totalStars, unplaceFrom } from './progress';
import { applySyncedKids, choiceFields, defaultSettings, getKids, kidCounters, normalizeKids, stampsOfKid, subscribeKids, updateKids, withChoiceFields, KIDS_KEEP_MAX, SEEN_MAX, FIRSTS_MAX, type DayRecord, type KidProfile, type KidsState, type NodeProgress } from './kidsStore';

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

/** `y` is from the side that changed last, so on a tie it wins: a skip, an easier buddy or a fast-track
 *  offer taken on that side does not touch `last`, and must not be undone by the older copy. */
function mergeNode(x: NodeProgress, y: NodeProgress): NodeProgress {
  const later = y.last >= x.last ? y : x;
  const out: NodeProgress = {
    ...later,
    stars: Math.max(x.stars, y.stars) as NodeProgress['stars'],
    plays: Math.max(x.plays, y.plays),
    last: Math.max(x.last, y.last),
    masteredDays: union(x.masteredDays, y.masteredDays).sort().slice(-2),
    golden: either(x.golden, y.golden, later.golden),
    passed: either(x.passed, y.passed, later.passed),
  };
  // A test-out (the paper plane) only stands until the node is really played on some device: that play
  // replaced it there, so the stars it earned are the node's own and are never paid into the jar again.
  // (Both copies still showing it keep it, so merging a copy with itself changes nothing.)
  const tested = (x.tested && y.tested) || (!x.plays && !y.plays && either(x.tested, y.tested, later.tested));
  if (tested) out.tested = true;
  else delete out.tested;
  if (x.won || y.won) out.won = union(x.won, y.won);
  return out;
}

/** Personal bests where a smaller number is better (the activities' `best(key, value, 'lower')`). */
const LOWER_BESTS = /^(ladder-moves|solo-resets|trek-)/;

/** Keeps the better value of each personal best, whichever device set it. */
function mergeBests(a: Rec<number> = {}, b: Rec<number> = {}): Rec<number> {
  const out: Rec<number> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? (LOWER_BESTS.test(k) ? Math.min(out[k], v) : Math.max(out[k], v)) : v;
  return out;
}

const mergeDay = (x: DayRecord, y: DayRecord): DayRecord => {
  const out: DayRecord = { ...x, minutes: Math.max(x.minutes, y.minutes), stars: Math.max(x.stars, y.stars), planted: either(x.planted, y.planted, x.planted) };
  if (x.stickers || y.stickers) out.stickers = union(x.stickers, y.stickers);
  return out;
};

/** What a kid's copy that missed a reset at `at` keeps: progress stamped after it (nodes, stickers,
 *  trophies, graduation) and the days after its day. The rest starts again, test-outs included;
 *  name, avatar, age group, settings, placement and the play session stay. With `at` = now it is
 *  the reset itself. */
export function kidSinceReset(k: KidProfile, at: number): KidProfile {
  const day = dayKey(at);
  const since = <T>(r: Rec<T>, t: (x: T) => number): Rec<T> => Object.fromEntries(Object.entries(r).filter(([, x]) => t(x) >= at));
  const days = Object.fromEntries(Object.entries(k.days).filter(([d]) => d > day));
  const out: KidProfile = {
    ...k,
    avatar: { ...k.avatar, hat: null },
    nodes: since(k.nodes, (n) => n.last),
    stickers: since(k.stickers, (t) => t),
    trophies: since(k.trophies, (t) => t),
    wardrobe: [],
    puzzle: { rating: 600, attempts: 0, seen: [], streak: 0, bestStreak: 0 },
    bots: {},
    bests: {},
    days,
    garden: Object.values(days).filter((d) => d.planted).length,
    firsts: [],
    resetAt: at,
  };
  if (k.graduated && k.graduated.t < at) delete out.graduated;
  delete out.testedOut;
  delete out.startAt; // the Starting rank went with the test-outs it made
  const tally = filterTally(k.tally, (key) => key.slice(0, 10) > day);
  if (tally) out.tally = tally;
  else delete out.tally;
  return out;
}

/** What a kid's copy that missed a grown-up's "Starting rank" `s` keeps: as on the device where
 *  it was set, the test-out passes from that world on go (played nodes keep their stars), and
 *  before the first puzzle the rating follows the new start. */
export function kidSinceStart(k: KidProfile, s: NonNullable<KidProfile['startAt']>): KidProfile {
  const out: KidProfile = { ...k, nodes: Object.fromEntries(Object.entries(k.nodes).map(([id, n]) => [id, { ...n }])), startAt: s };
  unplaceFrom(out, s.rank);
  if (out.testedOut !== undefined) out.testedOut = Math.min(out.testedOut, s.rank - 1);
  if (out.puzzle.attempts === 0) out.puzzle = { ...out.puzzle, rating: placementRating(s.rank - 1) };
  return out;
}

/** Merges one kid's two copies; `b` is from the side that changed last. */
export function mergeKid(a: KidProfile, b: KidProfile): KidProfile {
  const resetAt = Math.max(a.resetAt ?? 0, b.resetAt ?? 0);
  if ((a.resetAt ?? 0) < resetAt) a = kidSinceReset(a, resetAt);
  if ((b.resetAt ?? 0) < resetAt) b = kidSinceReset(b, resetAt);
  const startAt = (a.startAt?.t ?? 0) > (b.startAt?.t ?? 0) ? a.startAt : b.startAt;
  if (startAt && (a.startAt?.t ?? 0) < startAt.t) a = kidSinceStart(a, startAt);
  if (startAt && (b.startAt?.t ?? 0) < startAt.t) b = kidSinceStart(b, startAt);
  // Name, avatar, age group and each setting: the later stamp wins, field by field.
  const choices = mergeFields({ values: choiceFields(a), stamps: stampsOfKid(a) }, { values: choiceFields(b), stamps: stampsOfKid(b) });
  const chosen = withChoiceFields(b, choices.values);
  const pz = b.puzzle.attempts > a.puzzle.attempts ? b.puzzle : a.puzzle;
  const { counts, tally } = mergeTallied(kidCounters(a), a.tally, kidCounters(b), b.tally);
  const days = mergeRecord(a.days, b.days, mergeDay);
  for (const [d, rec] of Object.entries(days)) days[d] = { ...rec, minutes: counts[`${d}.minutes`] ?? rec.minutes, stars: counts[`${d}.stars`] ?? rec.stars };
  const out: KidProfile = {
    ...b,
    name: chosen.name,
    avatar: chosen.avatar,
    band: chosen.band,
    settings: chosen.settings,
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
    bests: mergeBests(a.bests, b.bests),
    days,
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
  const stamped = Object.keys(choices.stamps);
  if (stamped.length) {
    out.stamps = choices.stamps;
    out.settingsAt = Math.max(...Object.values(choices.stamps));
  } else {
    delete out.stamps;
    delete out.settingsAt;
  }
  if (resetAt) out.resetAt = resetAt;
  if (tally) out.tally = tally;
  else delete out.tally;
  return out;
}

/** A device joining a copy keeps its kids' progress and the copy keeps its own: a reset (or a
 *  delete-all, for the star jar) made on either side before they were linked applies to neither. */
export function joiningCopy(local: SyncedKids, remote: SyncedKids): SyncedKids {
  const theirs = new Map(remote.kids.map((k) => [k.id, k]));
  return {
    ...local,
    family: { ...local.family, resetAt: remote.family.resetAt },
    kids: local.kids.map((k) => (theirs.has(k.id) ? { ...k, resetAt: theirs.get(k.id)!.resetAt } : k)),
  };
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
  // Stars in the family jar add up across devices; every full hundred is a party. A jar that
  // missed a delete-all starts again.
  const resetAt = Math.max(local.family.resetAt ?? 0, remote.family.resetAt ?? 0);
  const [lf, rf] = [local.family, remote.family].map((f) => ((f.resetAt ?? 0) < resetAt ? { stars: 0, parties: 0 } : f));
  const jar = mergeTallied({ stars: lf.stars }, lf.tally, { stars: rf.stars }, rf.tally);
  const known = Math.max(lf.parties, rf.parties);
  const family: SyncedKids['family'] = { stars: jar.counts.stars, parties: Math.max(known, Math.floor(jar.counts.stars / 100)) };
  if (jar.tally) family.tally = jar.tally;
  if (resetAt) family.resetAt = resetAt;
  // A hundred reached only by adding the devices' stars up: neither device gave the party sticker (see
  // addFamilyStars), so every kid gets it here.
  const partyAt = Math.max(local.updatedAt, remote.updatedAt);
  const withParty = (k: KidProfile): KidProfile => {
    if (family.parties <= known) return k;
    const stickers = { ...k.stickers };
    for (let n = known + 1; n <= family.parties; n++) stickers[`st-family-${n}`] ??= partyAt;
    return { ...k, stickers };
  };
  const out: SyncedKids = {
    kids: kids.filter((k) => !(k.id in removed)).map(withParty),
    family,
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

const KIDS_TALLY = 'kids-tally';
const KIDS_STAMPS = 'kids-stamps';

/** The tallies of the kids and the star jar, synced again on their own (see tallyPart). The jar's
 *  tally goes with its delete-all time: one from before a delete-all is not folded back in. */
function tallies(s: SyncedKids): { family?: Tally; familyResetAt?: number; kids: Record<string, Tally> } {
  return { family: s.family.tally, familyResetAt: s.family.resetAt, kids: Object.fromEntries(s.kids.filter((k) => k.tally).map((k) => [k.id, k.tally!])) };
}

/** Folds the tallies synced on their own back into the synced kids. */
export function withTallies(s: SyncedKids, mirror: unknown): SyncedKids {
  const m = (mirror ?? {}) as { family?: unknown; familyResetAt?: unknown; kids?: Record<string, unknown> };
  const sameJar = (typeof m.familyResetAt === 'number' ? m.familyResetAt : undefined) === s.family.resetAt;
  const family = maxTally(s.family.tally, sameJar ? readTally(m.family) : undefined);
  return {
    ...s,
    family: family ? { ...s.family, tally: family } : s.family,
    kids: s.kids.map((k) => {
      const tally = maxTally(k.tally, readTally(m.kids?.[k.id]));
      return tally ? { ...k, tally } : k;
    }),
  };
}

/** The stamps of every kid's choices with the values they were written for, synced in a part of its
 *  own (see mirrorPart): older app versions rebuild kids without the fields they do not know, so
 *  they would drop `stamps` from the kids themselves but pass this part on untouched. */
function stampMirrors(s: Pick<KidsState, 'kids'>): Record<string, StampMirror> {
  return Object.fromEntries(s.kids.map((k) => [k.id, mirrorOf({ values: choiceFields(k), stamps: stampsOfKid(k) })]));
}

/** Gives each synced kid the stamps of the mirror (see reconcile): the copy's own `stamps` are not
 *  trusted, an older version may have merged the kids since. */
export function withStamps(s: SyncedKids, mirror: unknown): SyncedKids {
  const m = (mirror ?? {}) as Record<string, unknown>;
  return {
    ...s,
    kids: s.kids.map((k) => {
      const stamps = reconcile(choiceFields(k), k.settingsAt, readMirror(m[k.id]));
      const out: KidProfile = { ...k };
      if (Object.keys(stamps).length) out.stamps = stamps;
      else delete out.stamps;
      return out;
    }),
  };
}

// ---------- The same player made twice ----------
// A kid made on two devices before they were linked has two ids, so the merge keeps both. Two kids
// with the same name (in any letter case) and age group are probably one.

const empty = (o: object) => Object.keys(o).length === 0;

/** Has this kid played, earned or been given anything? */
export function hasProgress(k: KidProfile): boolean {
  return !empty(k.nodes) || !empty(k.stickers) || !empty(k.trophies) || !empty(k.bots) || !empty(k.bests) || !empty(k.days) || k.wardrobe.length > 0 || k.firsts.length > 0 || k.puzzle.attempts > 0 || k.garden > 0 || !!k.graduated || !!k.testedOut || !!k.startAt || !!k.tally || !!k.scene?.length;
}

/** A kid with nothing of their own: no progress, and the settings a new player starts with. */
export const isIdle = (k: KidProfile) => !hasProgress(k) && stableJson(k.settings) === stableJson(defaultSettings(k.band));

const twinKey = (k: KidProfile) => `${k.name.trim().toLowerCase()}\n${k.band}`;

/** Groups of kids that look like one player (same name and age group, different ids). */
export function twinGroups(kids: readonly KidProfile[]): KidProfile[][] {
  const groups = new Map<string, KidProfile[]>();
  for (const k of kids) if (k.name.trim()) groups.set(twinKey(k), [...(groups.get(twinKey(k)) ?? []), k]);
  return [...groups.values()].filter((g) => g.length > 1);
}

/** A player made this recently is not dropped as a twin yet: a grown-up may have made it on purpose a moment ago. */
export const TWIN_GRACE_MS = 10 * 60_000;

/**
 * After a merge: a twin with nothing of its own is dropped (its id goes to `removed`, so every
 * device drops it), in favour of the twin that has something, or of the oldest when none has. One
 * that has played or was set up is left alone: Grown-ups offers to merge those (mergeTwins). A twin
 * made in the last few minutes (TWIN_GRACE_MS) waits: by the next sync it has been played, or was a
 * mistake, and a child never has a player deleted from under them at the start of play.
 */
export function dropIdleTwins(s: SyncedKids, now = Date.now()): SyncedKids {
  const drop = new Set<string>();
  for (const g of twinGroups(s.kids)) {
    const idle = g.filter(isIdle).sort((x, y) => x.created - y.created || (x.id < y.id ? -1 : 1));
    for (const k of idle.slice(idle.length === g.length ? 1 : 0)) if (now - k.created >= TWIN_GRACE_MS) drop.add(k.id);
  }
  if (!drop.size) return s;
  const removed = { ...s.removed };
  for (const id of drop) removed[id] = Math.max(1, s.updatedAt);
  return { ...s, kids: s.kids.filter((k) => !drop.has(k.id)), removed };
}

/** Merges two kids that are the same player into the one with more stars (the older on a tie): their
 *  progress is combined, the kept kid's own name, look and settings stand, and the other id is
 *  deleted on every device. */
export function mergeTwins(idA: string, idB: string) {
  updateKids((s) => {
    const a = s.kids.find((k) => k.id === idA);
    const b = s.kids.find((k) => k.id === idB);
    if (!a || !b || a.id === b.id) return;
    const [keep, drop] = totalStars(a) > totalStars(b) || (totalStars(a) === totalStars(b) && (a.created < b.created || (a.created === b.created && a.id < b.id))) ? [a, b] : [b, a];
    const merged: KidProfile = { ...withChoiceFields(mergeKid(drop, keep), choiceFields(keep)), id: keep.id };
    if (keep.stamps) merged.stamps = keep.stamps;
    else delete merged.stamps;
    if (keep.settingsAt) merged.settingsAt = keep.settingsAt;
    else delete merged.settingsAt;
    s.kids = s.kids.filter((k) => k.id !== drop.id).map((k) => (k.id === keep.id ? merged : k));
    s.removed = { ...s.removed, [drop.id]: Date.now() };
    if (s.activeKid === drop.id) s.activeKid = keep.id;
  });
}

let registered = false;

/** The parts that sync the kids: the kids themselves and the mirrors of their tallies and settings stamps. */
export const kidsSyncParts = (): SyncPart[] => [
  {
    key: 'kids',
    read: () => pick(getKids()),
    write: (v) => applySyncedKids(v as SyncedKids),
    merge: (a, b, joining) => dropIdleTwins(mergeSyncedKids(joining ? joiningCopy(a as SyncedKids, b as SyncedKids) : (a as SyncedKids), b as SyncedKids)),
    normalize: (v, parts) => withStamps(withTallies(pick(normalizeKids({ ...(v as object), v: 1 }, KIDS_KEEP_MAX)), parts[KIDS_TALLY]), parts[KIDS_STAMPS]),
  },
  tallyPart(KIDS_TALLY, () => tallies(getKids())),
  mirrorPart(KIDS_STAMPS, () => stampMirrors(getKids())),
];

/** Adds the kids to cross-device sync (once) and pulls what other devices have. */
export function registerKidsSync() {
  if (registered || !syncAvailable) return;
  registered = true;
  for (const part of kidsSyncParts()) addSyncPart(part);
  subscribeKids(() => {
    if (!sync.isApplying) sync.schedule();
  });
  void sync.syncNow(); // no-op until a device is linked
}
