// The learner's profile: settings, XP, streaks, ratings and spaced-repetition state.
// Persisted to localStorage (per browser). All writes go through updateProfile().
import { useSyncExternalStore } from 'react';
import { dayKey, daysBetween } from '../lib/srs';
import { RD_START } from '../lib/rating';
import type { SrsCard } from '../lib/srs';

export type BoardTheme = 'slate' | 'walnut' | 'tourney' | 'ink' | 'rose';

export interface Settings {
  boardTheme: BoardTheme;
  sound: boolean;
  coordinates: boolean;
  autoQueen: boolean;
  theme: 'system' | 'light' | 'dark';
  /** Daily XP goal. */
  dailyGoal: number;
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
  onboarded: boolean;
  lastVisit: string;
  /** Last local change (ms). Used to merge with the cloud copy. */
  updatedAt: number;
}

const KEY = 'tempo.profile.v1';

export function defaultProfile(): Profile {
  return {
    v: 1,
    created: Date.now(),
    xp: 0,
    days: {},
    streak: { current: 0, best: 0, last: '' },
    settings: { boardTheme: 'slate', sound: true, coordinates: true, autoQueen: false, theme: 'system', dailyGoal: 60 },
    puzzles: { rating: 1000, rd: RD_START, history: [], attempts: 0, solved: 0, themes: {}, seen: {}, review: {}, rushBest: 0, bestStreak: 0 },
    lessons: {},
    lines: {},
    drills: {},
    games: [],
    vision: {},
    achievements: {},
    onboarded: false,
    lastVisit: dayKey(),
    updatedAt: 0,
  };
}

function load(): Profile {
  const base = defaultProfile();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<Profile>;
    return {
      ...base,
      ...p,
      settings: { ...base.settings, ...p.settings },
      puzzles: { ...base.puzzles, ...p.puzzles },
      streak: { ...base.streak, ...p.streak },
    };
  } catch {
    return base;
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

const emptyDay = (): DayLog => ({ xp: 0, puzzles: 0, lessons: 0, lines: 0, drills: 0, games: 0, vision: 0 });

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
