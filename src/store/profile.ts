// The learner's profile: settings, XP, streaks, ratings and spaced-repetition state.
// Persisted to localStorage (per browser). All writes go through updateProfile().
import { useSyncExternalStore } from 'react';
import { dayKey, daysBetween } from '../lib/srs';
import { RD_START } from '../lib/rating';
import type { SrsCard } from '../lib/srs';
import { deviceId } from '../sync/device';
import { readTally, tallyGrowth, type Counts, type Tally } from '../sync/tally';

export type BoardTheme = 'slate' | 'walnut' | 'marble' | 'tourney' | 'ink' | 'rose';
/** Piece artwork: the classic flat set, or rendered 3D Staunton pieces. */
export type PieceSet = 'cburnett' | 'staunton3d';

/** How quickly the computer answers your moves (see lib/replyPace.ts). */
export type ReplySpeed = 'relaxed' | 'standard' | 'quick';
const REPLY_SPEEDS: readonly ReplySpeed[] = ['relaxed', 'standard', 'quick'];

export interface Settings {
  boardTheme: BoardTheme;
  pieceSet: PieceSet;
  sound: boolean;
  /** Sound effects volume, 0 to 1. */
  volume: number;
  coordinates: boolean;
  autoQueen: boolean;
  theme: 'system' | 'light' | 'dark';
  /** Daily XP goal. */
  dailyGoal: number;
  /** How long the computer waits before it answers, and how slowly its pieces move. */
  replySpeed: ReplySpeed;
}

export interface DayLog {
  xp: number;
  puzzles: number;
  lessons: number;
  lines: number;
  drills: number;
  games: number;
  vision: number;
}

export interface PuzzleProgress {
  rating: number;
  rd: number;
  history: { t: number; r: number }[];
  attempts: number;
  solved: number;
  themes: Record<string, { ok: number; fail: number }>;
  seen: Record<string, { ok: boolean; t: number }>;
  review: Record<string, SrsCard>;
  rushBest: number;
  bestStreak: number;
}

export interface LessonProgress {
  done: boolean;
  t: number;
  /** Share of interactive steps solved on the first try (0..1). */
  score: number;
}

export interface LineProgress extends SrsCard {
  reps: number;
  lapses: number;
  t: number;
}

export interface DrillProgress {
  done: boolean;
  attempts: number;
  best?: number;
  t?: number;
}

export type MoveClass = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'book';

export interface GameRecord {
  id: string;
  t: number;
  startFen: string;
  moves: string[];
  playerColor: 'w' | 'b';
  level: number;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  reason: string;
  /** Filled in by game review. */
  review?: {
    evals: { cp?: number; mate?: number }[];
    best: string[];
    classes: MoveClass[];
    accuracy: { w: number; b: number };
  };
}

/** Whether the learner won this game. */
export const playerWon = (g: Pick<GameRecord, 'result' | 'playerColor'>) => g.result === (g.playerColor === 'w' ? '1-0' : '0-1');

export interface Profile {
  v: 1;
  created: number;
  xp: number;
  days: Record<string, DayLog>;
  streak: { current: number; best: number; last: string };
  settings: Settings;
  puzzles: PuzzleProgress;
  lessons: Record<string, LessonProgress>;
  lines: Record<string, LineProgress>;
  drills: Record<string, DrillProgress>;
  games: GameRecord[];
  vision: Record<string, number>;
  achievements: Record<string, number>;
  /** Highest level already announced with a toast. */
  levelSeen: number;
  onboarded: boolean;
  lastVisit: string;
  /** Last local change (ms). Used to merge with the cloud copy. */
  updatedAt: number;
  /** Last change to settings (ms), so syncing keeps the most recent choices. */
  settingsAt?: number;
  /** Look version: 1 = the walnut board and 3D pieces became the defaults. */
  look?: number;
  /** What each device added to the counters (see counters()), so progress made on two devices
   *  between syncs adds up when they merge. */
  tally?: Tally;
  /** Last progress reset (ms). Syncing drops older progress from copies that missed it. */
  resetAt?: number;
}

const KEY = 'tempo.profile.v1';

export function defaultProfile(): Profile {
  return {
    v: 1,
    created: Date.now(),
    xp: 0,
    days: {},
    streak: { current: 0, best: 0, last: '' },
    settings: { boardTheme: 'walnut', pieceSet: 'staunton3d', sound: true, volume: 0.8, coordinates: true, autoQueen: false, theme: 'system', dailyGoal: 60, replySpeed: 'relaxed' },
    puzzles: { rating: 1000, rd: RD_START, history: [], attempts: 0, solved: 0, themes: {}, seen: {}, review: {}, rushBest: 0, bestStreak: 0 },
    lessons: {},
    lines: {},
    drills: {},
    games: [],
    vision: {},
    achievements: {},
    levelSeen: 1,
    onboarded: false,
    lastVisit: dayKey(),
    updatedAt: 0,
    look: 1,
  };
}

/** Fills in fields missing from a stored, imported or synced profile (older versions). */
export function normalizeProfile(p: Partial<Profile>): Profile {
  const base = defaultProfile();
  const settings = { ...base.settings, ...p.settings };
  if (!REPLY_SPEEDS.includes(settings.replySpeed)) settings.replySpeed = base.settings.replySpeed;
  // Profiles from before the new look had no way to pick pieces: move them to the new defaults.
  if ((p.look ?? 0) < 1) {
    if (settings.pieceSet === 'cburnett') settings.pieceSet = 'staunton3d';
    if (settings.boardTheme === 'slate') settings.boardTheme = 'walnut';
  }
  return {
    ...base,
    ...p,
    look: Math.max(p.look ?? 0, 1),
    settings,
    puzzles: { ...base.puzzles, ...p.puzzles },
    streak: { ...base.streak, ...p.streak },
    tally: readTally(p.tally),
    // Profiles from before level tracking: do not announce levels reached long ago.
    levelSeen: p.levelSeen ?? levelFromXp(p.xp ?? 0).level,
  };
}

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeProfile(JSON.parse(raw) as Partial<Profile>) : defaultProfile();
  } catch {
    return defaultProfile();
  }
}

let state: Profile = load();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: keep the in-memory profile */
    }
  }, 150);
}

export function getProfile(): Profile {
  return state;
}

export function getSettings(): Settings {
  return state.settings;
}

export function updateProfile(fn: (draft: Profile) => void) {
  const next = structuredClone(state);
  fn(next);
  next.updatedAt = Date.now();
  if (JSON.stringify(next.settings) !== JSON.stringify(state.settings)) next.settingsAt = next.updatedAt;
  const tally = tallyGrowth(next.tally, deviceId(), counters(state), counters(next));
  if (tally) next.tally = tally;
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function replaceProfile(p: Profile, opts: { keepTimestamp?: boolean } = {}) {
  state = opts.keepTimestamp ? p : { ...p, updatedAt: Date.now() };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Listen for any profile change (used by cloud sync). */
export const subscribeProfile = subscribe;

export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, getProfile, getProfile);
}

export function useSettings(): Settings {
  return useProfile().settings;
}

export const emptyDay = (): DayLog => ({ xp: 0, puzzles: 0, lessons: 0, lines: 0, drills: 0, games: 0, vision: 0 });

/** The counters that add up across devices: puzzle attempts and solves, and every day log field
 *  (keyed 'YYYY-MM-DD.field'). Total XP is the sum of the days' XP. */
export function counters(p: Profile): Counts {
  const c: Counts = { attempts: p.puzzles.attempts, solved: p.puzzles.solved };
  for (const [day, log] of Object.entries(p.days)) for (const [f, v] of Object.entries(log)) if (typeof v === 'number') c[`${day}.${f}`] = v;
  return c;
}

/** Records training activity: adds XP, bumps the day's counters and maintains the streak. */
export function logActivity(d: Profile, xp: number, kind?: keyof Omit<DayLog, 'xp'>, count = 1) {
  const today = dayKey();
  const day = (d.days[today] ??= emptyDay());
  day.xp += xp;
  if (kind) day[kind] += count;
  d.xp += xp;
  if (d.streak.last !== today) {
    const gap = d.streak.last ? daysBetween(d.streak.last, today) : 99;
    d.streak.current = gap === 1 ? d.streak.current + 1 : 1;
    d.streak.best = Math.max(d.streak.best, d.streak.current);
    d.streak.last = today;
  }
}

/** Current streak, taking into account days missed since the last activity. */
export function liveStreak(p: Profile): number {
  if (!p.streak.last) return 0;
  const gap = daysBetween(p.streak.last, dayKey());
  return gap <= 1 ? p.streak.current : 0;
}

export function todayLog(p: Profile): DayLog {
  return p.days[dayKey()] ?? emptyDay();
}

// XP levels: the XP needed to reach level n grows gently so early levels come quickly.
export function levelFromXp(xp: number): { level: number; into: number; need: number; title: string } {
  let level = 1;
  let floor = 0;
  let step = 100;
  while (xp >= floor + step) {
    floor += step;
    level++;
    step = Math.round(100 + (level - 1) * 40);
  }
  return { level, into: xp - floor, need: step, title: levelTitle(level) };
}

function levelTitle(level: number): string {
  if (level < 4) return 'Novice';
  if (level < 8) return 'Apprentice';
  if (level < 13) return 'Club Player';
  if (level < 19) return 'Tournament Player';
  if (level < 26) return 'Expert';
  if (level < 34) return 'Candidate Master';
  return 'Master';
}
