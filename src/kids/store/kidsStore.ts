// Kids data: every kid profile, the family star jar and device settings. Kids and the star jar are
// synced across linked devices (syncKids.ts); the active kid and device settings stay on the device.
// Key 'tempo.kids.v1' (separate from the grown-up profile). Every storage access is guarded, with
// an in-memory fallback for private mode or sandboxed frames. Spec section 11.4.
import { useSyncExternalStore } from 'react';
import { dayKey } from '../../lib/srs';
import type { PieceSet } from '../../store/profile';
import type { AgeBand } from '../activities/types';
import { BAND_TUNING, BANDS } from '../curriculum/tuning';
import { AVATAR_COLORS, FACES, HATS, type AvatarColor, type FaceId, type HatId } from '../curriculum/wardrobe';
import type { BuddyId } from '../curriculum/buddies';

export const KIDS_KEY = 'tempo.kids.v1';
export const MAX_KIDS = 8;
export const SEEN_MAX = 300;
export const DAYS_MAX = 60;
export const FIRSTS_MAX = 400;

export interface KidsState {
  v: 1;
  activeKid: string | null;
  kids: KidProfile[];
  family: { stars: number; parties: number };
  device: { pinSalt?: string; pinHash?: string; voiceURI?: string };
  updatedAt: number;
  /** Deleted kids (id -> when), so syncing another device does not bring them back. */
  removed?: Record<string, number>;
}

export interface KidProfile {
  id: string;
  name: string; // nickname allowed; max 12 chars
  avatar: { color: AvatarColor; face: FaceId; hat: HatId | null };
  band: AgeBand;
  start: 'new' | 'moves' | 'games';
  created: number;
  nodes: Record<string, NodeProgress>;
  stickers: Record<string, number>; // id -> first time (ms)
  trophies: Record<string, number>;
  wardrobe: HatId[]; // unlocked hats (colors/faces are always free)
  puzzle: { rating: number; attempts: number; seen: string[]; streak: number; bestStreak: number; dailyDone?: string };
  bots: Partial<Record<BuddyId, { w: number; d: number; l: number }>>;
  bests: Record<string, number>;
  days: Record<string, DayRecord>; // pruned to the last 60 day keys on save
  garden: number; // total play days (flowers)
  firsts: string[]; // voice 'first' lines already auto-spoken (ids), max 400
  settings: KidSettings;
  scene?: { id: string; x: number; y: number }[];
  graduated?: { t: number; form: 'queen' | 'king' };
  /** Whether placement has been offered and finished (or skipped). */
  placed?: boolean;
  /** How many worlds placement (or a skip-ahead challenge) tested out. Explorer startTier 2 needs > 0. */
  testedOut?: number;
  /** The play session (spec 10.5): persisted so a re-pick or a reload never resets the limit. */
  session?: KidSession;
}

export interface KidSession {
  /** When this session started (ms). */
  start: number;
  /** Last saved active tick (ms); 30 min away starts a fresh session. */
  last: number;
  /** Active minutes played in this session. */
  min: number;
  /** Extra minutes a grown-up granted through the gate. */
  extra: number;
  /** When Break time was shown (ms). The kid rests until the cooldown ends or a grown-up extends. */
  breakAt?: number;
}

export interface DayRecord {
  minutes: number;
  stars: number;
  /** A flower was planted for this day. */
  planted?: boolean;
  /** Stickers earned this day (for the break screen). */
  stickers?: string[];
}

export interface NodeProgress {
  stars: 0 | 1 | 2 | 3;
  golden?: boolean;
  plays: number;
  last: number;
  box: 1 | 2 | 3 | 4 | 5;
  due: string; // dayKey
  tested?: boolean;
  skipped?: boolean;
  masteredDays: string[]; // max 2 distinct day keys with >=2 stars
  lastItems: string[]; // last 6 item ids played (warm-up variety)
  won?: string[]; // game sets: item ids won
  losses: number; // consecutive game losses (reset on win)
  ease: number; // current ease step for game nodes
  attemptsBelowPass?: number; // non-game boss attempts below the pass mark
  hintMax?: 0 | 1 | 2 | 3 | 4; // highest hint level at the last play
  /** The last play had no mistakes at all (fast track). */
  clean?: boolean;
  /** Passed by a test-out (placement or a skip-ahead challenge). Kept forever: a replay never relocks. */
  passed?: boolean;
  /** Boss opened early by the fast track ("Want to try the boss now?"). */
  fastTrack?: boolean;
  /** A missed warm-up: shows a small practice leaf on the map. */
  leaf?: boolean;
}

export interface KidSettings {
  voice: 'auto' | 'first' | 'off';
  rate: number | null;
  sound: boolean;
  /** Quiet mode from the map's speaker button: no sounds and no automatic reading aloud. */
  muted: boolean;
  /** Pip's voice: a recorded voice id from public/voice/voices.json, 'device', or '' for the default. */
  pipVoice: string;
  bedtime: 'off' | 'on' | 'system';
  reducedMotion: 'system' | 'on';
  sessionMin: 0 | 10 | 15 | 20 | 30 | 45;
  takebacks: 'always' | 'three' | 'one' | 'off';
  dangerAlarm: boolean;
  oopsShield: boolean;
  threatLights: boolean;
  coordinates: boolean;
  hints: 'generous' | 'normal' | 'few';
  showDests: 'always' | 'until-mastered' | 'on-mistake';
  pieceSet: PieceSet | 'auto';
  tapOnly: boolean;
  leftHanded: boolean;
  unlockAll: boolean;
}

// ---------- Defaults and normalization ----------

export function defaultSettings(band: AgeBand): KidSettings {
  const t = BAND_TUNING[band];
  return {
    voice: t.voice,
    rate: null,
    sound: true,
    muted: false,
    pipVoice: '',
    bedtime: 'system',
    reducedMotion: 'system',
    sessionMin: t.sessionMinDefault,
    takebacks: t.takebacks,
    dangerAlarm: true,
    oopsShield: false,
    threatLights: t.threatLights,
    coordinates: t.coordinates,
    hints: 'normal',
    showDests: t.showDests,
    pieceSet: 'auto',
    tapOnly: t.tapOnly,
    leftHanded: false,
    unlockAll: false,
  };
}

export function defaultKidsState(): KidsState {
  return { v: 1, activeKid: null, kids: [], family: { stars: 0, parties: 0 }, device: {}, updatedAt: 0 };
}

export function emptyNode(today = dayKey()): NodeProgress {
  return { stars: 0, plays: 0, last: 0, box: 1, due: today, masteredDays: [], lastItems: [], losses: 0, ease: 0 };
}

let idCounter = 0;
export function newKidId(): string {
  idCounter++;
  return `k${Date.now().toString(36)}${idCounter.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function newKid(o: { name: string; band: AgeBand; start: KidProfile['start']; avatar?: Partial<KidProfile['avatar']>; id?: string; now?: number }): KidProfile {
  return {
    id: o.id ?? newKidId(),
    name: cleanName(o.name),
    avatar: { color: o.avatar?.color ?? 'sun', face: o.avatar?.face ?? 'smile', hat: o.avatar?.hat ?? null },
    band: o.band,
    start: o.start,
    created: o.now ?? Date.now(),
    nodes: {},
    stickers: {},
    trophies: {},
    wardrobe: [],
    puzzle: { rating: 600, attempts: 0, seen: [], streak: 0, bestStreak: 0 },
    bots: {},
    bests: {},
    days: {},
    garden: 0,
    firsts: [],
    settings: defaultSettings(o.band),
    placed: o.start === 'new',
  };
}

export const cleanName = (s: unknown) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12) : '');

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown, d: number, min = -Infinity, max = Infinity) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : d);
const oneOf = <T extends string | number>(x: unknown, opts: readonly T[], d: T): T => (opts.includes(x as T) ? (x as T) : d);
const strArr = (x: unknown, max: number) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string').slice(-max) : []);
const numMap = (x: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (isObj(x)) for (const [k, v] of Object.entries(x)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return out;
};

function normalizeNode(x: unknown): NodeProgress | null {
  if (!isObj(x)) return null;
  const n = emptyNode(typeof x.due === 'string' ? x.due : dayKey());
  const out: NodeProgress = {
    ...n,
    stars: oneOf(x.stars, [0, 1, 2, 3] as const, 0),
    plays: num(x.plays, 0, 0),
    last: num(x.last, 0, 0),
    box: oneOf(x.box, [1, 2, 3, 4, 5] as const, 1),
    masteredDays: strArr(x.masteredDays, 2),
    lastItems: strArr(x.lastItems, 6),
    losses: num(x.losses, 0, 0),
    ease: num(x.ease, 0, 0, 10),
  };
  if (x.golden === true) out.golden = true;
  if (x.tested === true) out.tested = true;
  if (x.passed === true || x.tested === true) out.passed = true;
  if (x.skipped === true) out.skipped = true;
  if (x.leaf === true) out.leaf = true;
  if (x.clean === true) out.clean = true;
  if (x.fastTrack === true) out.fastTrack = true;
  if (Array.isArray(x.won)) out.won = strArr(x.won, 50);
  if (typeof x.attemptsBelowPass === 'number') out.attemptsBelowPass = num(x.attemptsBelowPass, 0, 0);
  if (typeof x.hintMax === 'number') out.hintMax = oneOf(x.hintMax, [0, 1, 2, 3, 4] as const, 0);
  return out;
}

function normalizeKid(x: unknown): KidProfile | null {
  if (!isObj(x) || typeof x.id !== 'string' || !x.id) return null;
  const band = oneOf(x.band, BANDS, 'explorer');
  const base = newKid({ id: x.id, name: typeof x.name === 'string' ? x.name : '', band, start: oneOf(x.start, ['new', 'moves', 'games'] as const, 'new'), now: num(x.created, Date.now()) });
  const av = isObj(x.avatar) ? x.avatar : {};
  const hatIds = HATS.map((h) => h.id);
  const nodes: Record<string, NodeProgress> = {};
  if (isObj(x.nodes)) for (const [k, v] of Object.entries(x.nodes)) {
    const n = normalizeNode(v);
    if (n) nodes[k] = n;
  }
  const days: Record<string, DayRecord> = {};
  if (isObj(x.days)) {
    const keys = Object.keys(x.days).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-DAYS_MAX);
    for (const k of keys) {
      const d = (x.days as Record<string, unknown>)[k];
      if (!isObj(d)) continue;
      days[k] = { minutes: num(d.minutes, 0, 0), stars: num(d.stars, 0, 0) };
      if (d.planted === true) days[k].planted = true;
      if (Array.isArray(d.stickers)) days[k].stickers = strArr(d.stickers, 40);
    }
  }
  const pz = isObj(x.puzzle) ? x.puzzle : {};
  const bots: KidProfile['bots'] = {};
  if (isObj(x.bots)) for (const [k, v] of Object.entries(x.bots)) if (isObj(v)) bots[k as BuddyId] = { w: num(v.w, 0, 0), d: num(v.d, 0, 0), l: num(v.l, 0, 0) };
  const s = isObj(x.settings) ? x.settings : {};
  const ds = base.settings;
  const settings: KidSettings = {
    voice: oneOf(s.voice, ['auto', 'first', 'off'] as const, ds.voice),
    rate: typeof s.rate === 'number' ? num(s.rate, 1, 0.7, 1.2) : null,
    sound: typeof s.sound === 'boolean' ? s.sound : ds.sound,
    muted: s.muted === true,
    pipVoice: typeof s.pipVoice === 'string' && /^[a-z0-9-]{0,24}$/.test(s.pipVoice) ? s.pipVoice : '',
    bedtime: oneOf(s.bedtime, ['off', 'on', 'system'] as const, ds.bedtime),
    reducedMotion: oneOf(s.reducedMotion, ['system', 'on'] as const, ds.reducedMotion),
    sessionMin: oneOf(s.sessionMin, [0, 10, 15, 20, 30, 45] as const, ds.sessionMin),
    takebacks: oneOf(s.takebacks, ['always', 'three', 'one', 'off'] as const, ds.takebacks),
    dangerAlarm: typeof s.dangerAlarm === 'boolean' ? s.dangerAlarm : ds.dangerAlarm,
    oopsShield: typeof s.oopsShield === 'boolean' ? s.oopsShield : ds.oopsShield,
    threatLights: typeof s.threatLights === 'boolean' ? s.threatLights : ds.threatLights,
    coordinates: typeof s.coordinates === 'boolean' ? s.coordinates : ds.coordinates,
    hints: oneOf(s.hints, ['generous', 'normal', 'few'] as const, ds.hints),
    showDests: oneOf(s.showDests, ['always', 'until-mastered', 'on-mistake'] as const, ds.showDests),
    pieceSet: oneOf(s.pieceSet, ['auto', 'cburnett', 'staunton3d'] as const, ds.pieceSet),
    tapOnly: typeof s.tapOnly === 'boolean' ? s.tapOnly : ds.tapOnly,
    leftHanded: typeof s.leftHanded === 'boolean' ? s.leftHanded : ds.leftHanded,
    unlockAll: typeof s.unlockAll === 'boolean' ? s.unlockAll : ds.unlockAll,
  };
  const kid: KidProfile = {
    ...base,
    avatar: {
      color: oneOf(av.color, Object.keys(AVATAR_COLORS) as AvatarColor[], 'sun'),
      face: oneOf(av.face, FACES.map((f) => f.id), 'smile'),
      hat: av.hat == null ? null : oneOf(av.hat, hatIds, null as unknown as HatId) ?? null,
    },
    nodes,
    stickers: numMap(x.stickers),
    trophies: numMap(x.trophies),
    wardrobe: strArr(x.wardrobe, 50).filter((h): h is HatId => hatIds.includes(h as HatId)),
    puzzle: {
      rating: num(pz.rating, 600, 500, 3000),
      attempts: num(pz.attempts, 0, 0),
      seen: strArr(pz.seen, SEEN_MAX),
      streak: num(pz.streak, 0, 0),
      bestStreak: num(pz.bestStreak, 0, 0),
      ...(typeof pz.dailyDone === 'string' ? { dailyDone: pz.dailyDone } : {}),
    },
    bots,
    bests: numMap(x.bests),
    days,
    garden: num(x.garden, 0, 0),
    firsts: strArr(x.firsts, FIRSTS_MAX),
    settings,
    placed: typeof x.placed === 'boolean' ? x.placed : true,
  };
  if (Array.isArray(x.scene)) kid.scene = x.scene.filter(isObj).filter((e) => typeof e.id === 'string').map((e) => ({ id: e.id as string, x: num(e.x, 0), y: num(e.y, 0) }));
  if (typeof x.testedOut === 'number') kid.testedOut = num(x.testedOut, 0, 0, 8);
  if (isObj(x.session)) {
    const se = x.session;
    kid.session = { start: num(se.start, 0, 0), last: num(se.last, 0, 0), min: num(se.min, 0, 0, 1440), extra: num(se.extra, 0, 0, 1440) };
    if (typeof se.breakAt === 'number' && Number.isFinite(se.breakAt)) kid.session.breakAt = se.breakAt;
  }
  if (isObj(x.graduated)) kid.graduated = { t: num(x.graduated.t, Date.now()), form: oneOf(x.graduated.form, ['queen', 'king'] as const, 'queen') };
  return kid;
}

/** Validates and repairs stored or imported kids data. Anything unusable becomes the empty default. */
export function normalizeKids(raw: unknown): KidsState {
  const base = defaultKidsState();
  if (!isObj(raw) || raw.v !== 1) return base;
  const seen = new Set<string>();
  const kids = (Array.isArray(raw.kids) ? raw.kids : [])
    .map(normalizeKid)
    .filter((k): k is KidProfile => !!k && !seen.has(k.id) && !!seen.add(k.id))
    .slice(0, MAX_KIDS);
  const fam = isObj(raw.family) ? raw.family : {};
  const dev = isObj(raw.device) ? raw.device : {};
  const device: KidsState['device'] = {};
  if (typeof dev.pinSalt === 'string' && typeof dev.pinHash === 'string') {
    device.pinSalt = dev.pinSalt;
    device.pinHash = dev.pinHash;
  }
  if (typeof dev.voiceURI === 'string') device.voiceURI = dev.voiceURI;
  const activeKid = typeof raw.activeKid === 'string' && kids.some((k) => k.id === raw.activeKid) ? raw.activeKid : null;
  const out: KidsState = { v: 1, activeKid, kids, family: { stars: num(fam.stars, 0, 0), parties: num(fam.parties, 0, 0) }, device, updatedAt: num(raw.updatedAt, 0, 0) };
  const removed = numMap(raw.removed);
  if (Object.keys(removed).length) out.removed = removed;
  return out;
}

/** Caps the lists that grow (seen ring, days, firsts) before saving. */
export function pruneForSave(s: KidsState): KidsState {
  for (const k of s.kids) {
    if (k.puzzle.seen.length > SEEN_MAX) k.puzzle.seen = k.puzzle.seen.slice(-SEEN_MAX);
    const keys = Object.keys(k.days).sort();
    if (keys.length > DAYS_MAX) for (const d of keys.slice(0, keys.length - DAYS_MAX)) delete k.days[d];
    if (k.firsts.length > FIRSTS_MAX) k.firsts = k.firsts.slice(-FIRSTS_MAX);
  }
  return s;
}

// ---------- Storage (guarded, with an in-memory fallback) ----------

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function storage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export const KIDS_BACKUP_KEY = 'tempo.kids.v1.bak';
let recovered = false;

/** Unreadable data (bad JSON, a newer version, kids that all fail to load) is copied aside before the
 *  first write replaces it, so one bad write never wipes every child's progress for good. */
function keepBackup(st: StorageLike | null, raw: string) {
  recovered = true;
  try {
    st?.setItem(KIDS_BACKUP_KEY, raw);
  } catch {
    /* ignore */
  }
}

/** Reads kids data from a storage (null storage or a throwing one gives the default). */
export function readKids(st: StorageLike | null = storage()): KidsState {
  let raw: string | null | undefined;
  try {
    raw = st?.getItem(KIDS_KEY);
  } catch {
    return defaultKidsState();
  }
  if (!raw) return defaultKidsState();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    keepBackup(st, raw);
    return defaultKidsState();
  }
  const out = normalizeKids(parsed);
  const hadKids = isObj(parsed) && Array.isArray(parsed.kids) && parsed.kids.length > 0;
  if (!isObj(parsed) || parsed.v !== 1 || (hadKids && !out.kids.length)) keepBackup(st, raw);
  return out;
}

/** Saved data could not be read and a copy was kept under KIDS_BACKUP_KEY. */
export const kidsRecovered = () => recovered;

/** Writes kids data; returns false when storage is unavailable (the in-memory copy stays). */
export function writeKids(s: KidsState, st: StorageLike | null = storage()): boolean {
  try {
    if (!st) return false;
    st.setItem(KIDS_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

let state: KidsState = readKids();
let saveFailed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// Another tab saved: take its data, so two open tabs do not overwrite each other's progress.
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e) => {
      if (e.key !== KIDS_KEY || e.newValue == null) return;
      state = readKids();
      emit();
    });
  } catch {
    /* ignore */
  }
}

function commit(next: KidsState) {
  next.updatedAt = Date.now();
  state = pruneForSave(next);
  saveFailed = !writeKids(state);
  emit();
}

export function getKids(): KidsState {
  return state;
}

export function getKid(id: string | null | undefined): KidProfile | undefined {
  return id ? state.kids.find((k) => k.id === id) : undefined;
}

export function getActiveKid(): KidProfile | undefined {
  return getKid(state.activeKid);
}

/** Takes merged data from sync: kids, star jar and deletions; this device's own parts stay. */
export function applySyncedKids(synced: Pick<KidsState, 'kids' | 'family' | 'removed' | 'updatedAt'>) {
  const next: KidsState = { ...structuredClone(state), ...structuredClone(synced) };
  if (!next.removed) delete next.removed;
  if (next.activeKid && !next.kids.some((k) => k.id === next.activeKid)) next.activeKid = null;
  state = pruneForSave(next);
  saveFailed = !writeKids(state);
  emit();
}

export const subscribeKids = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** Replaces the whole state (import, delete-all). */
export function replaceKids(next: KidsState) {
  commit(structuredClone(next));
}

export function updateKids(fn: (draft: KidsState) => void) {
  const next = structuredClone(state);
  fn(next);
  commit(next);
}

export function updateKid(id: string, fn: (draft: KidProfile, all: KidsState) => void) {
  updateKids((d) => {
    const k = d.kids.find((x) => x.id === id);
    if (k) fn(k, d);
  });
}

/** Grants a sticker or trophy once. Returns true when it is new. */
export function awardTo(kidId: string, id: string): boolean {
  const k = getKid(kidId);
  if (!k) return false;
  const isTrophy = id.startsWith('tr-');
  if ((isTrophy ? k.trophies : k.stickers)[id]) return false;
  updateKid(kidId, (d) => {
    const now = Date.now();
    if (isTrophy) d.trophies[id] = now;
    else {
      d.stickers[id] = now;
      const day = (d.days[dayKey(now)] ??= { minutes: 0, stars: 0 });
      day.stickers = [...(day.stickers ?? []), id];
    }
  });
  return true;
}

export function setActiveKid(id: string | null) {
  if (state.activeKid === id) return;
  updateKids((d) => {
    d.activeKid = id;
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useKids(): KidsState {
  return useSyncExternalStore(subscribe, getKids, getKids);
}

export function useActiveKid(): KidProfile | undefined {
  const s = useKids();
  return s.kids.find((k) => k.id === s.activeKid);
}

export function useSaveFailed(): boolean {
  useKids();
  return saveFailed;
}

/** Test hook: reset the in-memory state. */
export function __setKidsStateForTests(s: KidsState) {
  state = s;
}
