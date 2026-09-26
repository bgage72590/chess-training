import type { Profile } from '../store/profile';
import { openings, units } from '../content';
import { puzzleById } from '../data/puzzles';

export function dueLines(p: Profile, now = Date.now()) {
  const out: { openingId: string; lineId: string }[] = [];
  for (const o of openings) for (const l of o.lines) {
    const card = p.lines[l.id];
    if (card && card.due <= now) out.push({ openingId: o.id, lineId: l.id });
  }
  return out;
}

export function dueReviewPuzzles(p: Profile, now = Date.now()) {
  return Object.entries(p.puzzles.review)
    .filter(([id, c]) => c.due <= now && puzzleById.has(id))
    .map(([id]) => id);
}

/** The next lesson to take, in curriculum order. */
export function nextLesson(p: Profile) {
  for (const u of units) for (const l of u.lessons) if (!p.lessons[l.id]?.done) return { unit: u, lesson: l };
  return null;
}

export function lessonCounts(p: Profile) {
  const total = units.reduce((s, u) => s + u.lessons.length, 0);
  const done = units.reduce((s, u) => s + u.lessons.filter((l) => p.lessons[l.id]?.done).length, 0);
  return { total, done };
}
