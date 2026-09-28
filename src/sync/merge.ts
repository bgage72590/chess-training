// Merging two copies of a learner's profile (e.g. this device and the synced copy).
// The merge keeps progress made on either side: lessons, opening cards, drills, puzzles, games
// and achievements are combined item by item, and the counters (XP, day logs, puzzle counts)
// add up what each device did (tally.ts). Settings follow the copy that changed them last. A
// reset wins over progress made before it, on any copy.
// It is pure, idempotent (merge(x, x) equals x) and symmetric apart from ties on timestamps.
import { dayKey, daysBetween } from '../lib/srs';
import { counters, defaultProfile, emptyDay, levelFromXp, type DayLog, type GameRecord, type Profile, type PuzzleProgress } from '../store/profile';
import { filterTally, mergeTallied, type Counts } from './tally';

type Rec<T> = Record<string, T>;

/** Combines two records key by key; `pick` resolves keys present on both sides. */
function mergeRecord<T>(a: Rec<T> = {}, b: Rec<T> = {}, pick: (x: T, y: T) => T): Rec<T> {
  const out: Rec<T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? pick(out[k], v) : v;
  return out;
}

/** The day of a 'YYYY-MM-DD.field' counter key ('' for the all-time counters). */
const dayOf = (key: string) => (key.includes('.') ? key.slice(0, key.indexOf('.')) : '');

/** Day logs rebuilt from merged counters. */
function daysFrom(counts: Counts): Rec<DayLog> {
  const days: Rec<DayLog> = {};
  for (const [k, v] of Object.entries(counts)) {
    const day = dayOf(k);
    if (day) ((days[day] ??= emptyDay()) as unknown as Rec<number>)[k.slice(day.length + 1)] = v;
  }
  return days;
}

/** Streak facts rebuilt from the days with activity (YYYY-MM-DD keys). */
function streakFromDays(days: Rec<DayLog>): { current: number; best: number; last: string } {
  const keys = Object.keys(days).sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < keys.length; i++) {
    run = i > 0 && daysBetween(keys[i - 1], keys[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { current: run, best, last: keys[keys.length - 1] ?? '' };
}

/** Everything but the counts (merged with the other counters). `preferB` breaks a tie between
 *  ratings that no rated attempt dates (e.g. picked at onboarding). */
function mergePuzzles(a: PuzzleProgress, b: PuzzleProgress, preferB: boolean): Omit<PuzzleProgress, 'attempts' | 'solved'> {
  // Rating history: union of entries, oldest first, the newest 500 kept.
  const seenEntries = new Set<string>();
  const history = [...a.history, ...b.history]
    .sort((x, y) => x.t - y.t || x.r - y.r)
    .filter((h) => {
      const key = `${h.t}:${h.r}`;
      if (seenEntries.has(key)) return false;
      seenEntries.add(key);
      return true;
    })
    .slice(-500);
  const lastT = (p: PuzzleProgress) => p.history[p.history.length - 1]?.t ?? 0;
  const rated = lastT(a) > lastT(b) ? a : lastT(b) > lastT(a) || preferB ? b : a;

  const seen = mergeRecord(a.seen, b.seen, (x, y) => (y.t > x.t ? y : x));
  // A puzzle's review card follows whichever side attempted it last (it may have been
  // removed there after a clean solve).
  const review: PuzzleProgress['review'] = {};
  for (const id of new Set([...Object.keys(a.review), ...Object.keys(b.review)])) {
    const ta = a.seen[id]?.t ?? 0;
    const tb = b.seen[id]?.t ?? 0;
    const card = tb > ta ? b.review[id] : ta > tb ? a.review[id] : (a.review[id] ?? b.review[id]);
    if (card) review[id] = card;
  }
  return {
    rating: rated.rating,
    rd: rated.rd,
    history,
    themes: mergeRecord(a.themes, b.themes, (x, y) => ({ ok: Math.max(x.ok, y.ok), fail: Math.max(x.fail, y.fail) })),
    seen,
    review,
    rushBest: Math.max(a.rushBest, b.rushBest),
    bestStreak: Math.max(a.bestStreak, b.bestStreak),
  };
}

function mergeGames(a: GameRecord[], b: GameRecord[]): GameRecord[] {
  const byId = new Map<string, GameRecord>();
  for (const g of [...a, ...b]) {
    const prev = byId.get(g.id);
    // Keep the copy that has a review, if either does.
    if (!prev || (!prev.review && g.review)) byId.set(g.id, g);
  }
  return [...byId.values()].sort((x, y) => y.t - x.t).slice(0, 30);
}

/** What a copy that missed a reset at `at` keeps: progress stamped after it, and the days after
 *  its day. What carries no time (theme counts, vision scores, bests) starts again; settings stay.
 *  With `at` = now it is the reset itself. */
export function sinceReset(p: Profile, at: number): Profile {
  const day = dayKey(at);
  const since = <T>(r: Rec<T>, t: (x: T) => number | undefined): Rec<T> => Object.fromEntries(Object.entries(r).filter(([, x]) => (t(x) ?? 0) >= at));
  const base = defaultProfile();
  const days = Object.fromEntries(Object.entries(p.days).filter(([k]) => k > day));
  const xp = Object.values(days).reduce((s, d) => s + d.xp, 0);
  const history = p.puzzles.history.filter((h) => h.t >= at);
  const seen = since(p.puzzles.seen, (s) => s.t);
  const out: Profile = {
    ...base,
    created: p.created,
    xp,
    days,
    settings: p.settings,
    puzzles: {
      ...base.puzzles,
      rating: history.length ? history[history.length - 1].r : base.puzzles.rating,
      rd: history.length ? p.puzzles.rd : base.puzzles.rd,
      history,
      attempts: Object.keys(seen).length,
      solved: Object.values(seen).filter((s) => s.ok).length,
      seen,
      review: Object.fromEntries(Object.entries(p.puzzles.review).filter(([id]) => id in seen)),
    },
    lessons: since(p.lessons, (l) => l.t),
    lines: since(p.lines, (l) => l.t),
    drills: since(p.drills, (d) => d.t),
    games: p.games.filter((g) => g.t >= at),
    achievements: since(p.achievements, (t) => t),
    levelSeen: levelFromXp(xp).level,
    lastVisit: p.lastVisit,
    updatedAt: p.updatedAt,
    look: p.look,
    resetAt: at,
  };
  if (p.settingsAt) out.settingsAt = p.settingsAt;
  const tally = filterTally(p.tally, (k) => dayOf(k) > day);
  if (tally) out.tally = tally;
  return out;
}

/** A device joining a copy keeps its progress and the copy keeps its own: a reset made on either
 *  side before they were linked applies to neither. */
export const joiningCopy = (local: Profile, remote: Profile): Profile => ({ ...local, resetAt: remote.resetAt });

export function mergeProfiles(a: Profile, b: Profile): Profile {
  const resetAt = Math.max(a.resetAt ?? 0, b.resetAt ?? 0);
  if ((a.resetAt ?? 0) < resetAt) a = sinceReset(a, resetAt);
  if ((b.resetAt ?? 0) < resetAt) b = sinceReset(b, resetAt);
  const newer = b.updatedAt > a.updatedAt ? b : a;
  const settingsFrom = (b.settingsAt ?? 0) > (a.settingsAt ?? 0) ? b : a;
  const { counts, tally } = mergeTallied(counters(a), a.tally, counters(b), b.tally);
  const days = daysFrom(counts);
  const sumXp = Object.values(days).reduce((s, d) => s + d.xp, 0);
  // Every activity logs its day, so the streak can be rebuilt from the merged days.
  const rebuilt = streakFromDays(days);
  const latest = a.streak.last >= b.streak.last ? a.streak : b.streak;
  const streak = { ...(rebuilt.last ? rebuilt : latest), best: Math.max(a.streak.best, b.streak.best, rebuilt.best) };

  return {
    ...newer,
    v: 1,
    created: Math.min(a.created, b.created),
    // XP is logged with its day; a copy's own total only matters for data older than that.
    xp: Math.max(sumXp, a.xp, b.xp),
    days,
    streak,
    settings: settingsFrom.settings,
    settingsAt: Math.max(a.settingsAt ?? 0, b.settingsAt ?? 0) || undefined,
    puzzles: { ...mergePuzzles(a.puzzles, b.puzzles, newer === b), attempts: counts.attempts, solved: counts.solved },
    lessons: mergeRecord(a.lessons, b.lessons, (x, y) => ({ done: x.done || y.done, t: Math.max(x.t, y.t), score: Math.max(x.score, y.score) })),
    lines: mergeRecord(a.lines, b.lines, (x, y) => (y.t > x.t ? y : x)),
    drills: mergeRecord(a.drills, b.drills, (x, y) => ({
      done: x.done || y.done,
      attempts: Math.max(x.attempts, y.attempts),
      best: x.best === undefined ? y.best : y.best === undefined ? x.best : Math.min(x.best, y.best),
      t: Math.max(x.t ?? 0, y.t ?? 0) || undefined,
    })),
    games: mergeGames(a.games, b.games),
    vision: mergeRecord(a.vision, b.vision, Math.max),
    achievements: mergeRecord(a.achievements, b.achievements, Math.min),
    levelSeen: Math.max(a.levelSeen, b.levelSeen),
    onboarded: a.onboarded || b.onboarded,
    lastVisit: a.lastVisit > b.lastVisit ? a.lastVisit : b.lastVisit,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    tally,
    resetAt: resetAt || undefined,
  };
}
