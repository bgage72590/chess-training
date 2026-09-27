// Merging two copies of a learner's profile (e.g. this device and the synced copy).
// The merge keeps progress made on either side: per-day logs, lessons, opening cards,
// drills, puzzles, games and achievements are combined item by item, and totals are
// recomputed from the merged parts. Settings follow the copy that changed last.
// It is pure, idempotent (merge(x, x) equals x) and symmetric apart from settings ties.
import { daysBetween } from '../lib/srs';
import type { DayLog, GameRecord, Profile, PuzzleProgress } from '../store/profile';

type Rec<T> = Record<string, T>;

/** Combines two records key by key; `pick` resolves keys present on both sides. */
function mergeRecord<T>(a: Rec<T> = {}, b: Rec<T> = {}, pick: (x: T, y: T) => T): Rec<T> {
  const out: Rec<T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? pick(out[k], v) : v;
  return out;
}

const maxDay = (x: DayLog, y: DayLog): DayLog => {
  const out = { ...x };
  for (const k of Object.keys(y) as (keyof DayLog)[]) out[k] = Math.max(x[k] ?? 0, y[k] ?? 0);
  return out;
};

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

function mergePuzzles(a: PuzzleProgress, b: PuzzleProgress): PuzzleProgress {
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
  const rated = lastT(a) >= lastT(b) ? a : b;

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
    attempts: Math.max(a.attempts, b.attempts),
    solved: Math.max(a.solved, b.solved),
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

export function mergeProfiles(a: Profile, b: Profile): Profile {
  const newer = b.updatedAt > a.updatedAt ? b : a;
  const settingsFrom = (b.settingsAt ?? 0) > (a.settingsAt ?? 0) ? b : a;
  const days = mergeRecord(a.days, b.days, maxDay);
  const sumXp = Object.values(days).reduce((s, d) => s + d.xp, 0);
  // Every activity logs its day, so the streak can be rebuilt from the merged days.
  const rebuilt = streakFromDays(days);
  const latest = a.streak.last >= b.streak.last ? a.streak : b.streak;
  const streak = { ...(rebuilt.last ? rebuilt : latest), best: Math.max(a.streak.best, b.streak.best, rebuilt.best) };

  return {
    ...newer,
    v: 1,
    created: Math.min(a.created, b.created),
    xp: Math.max(a.xp, b.xp, sumXp),
    days,
    streak,
    settings: settingsFrom.settings,
    settingsAt: Math.max(a.settingsAt ?? 0, b.settingsAt ?? 0) || undefined,
    puzzles: mergePuzzles(a.puzzles, b.puzzles),
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
  };
}
