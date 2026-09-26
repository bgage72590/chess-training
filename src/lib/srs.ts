// Leitner-style spaced repetition.
export const DAY = 24 * 60 * 60 * 1000;
/** Days until the next review for each box. Box 0 = due again today. */
export const INTERVALS = [0, 1, 3, 7, 16, 35, 80];
export const MASTERED_BOX = 5;

export interface SrsCard {
  box: number;
  due: number;
}

export function review(card: SrsCard | undefined, correct: boolean, now = Date.now()): SrsCard {
  const box = correct ? Math.min((card?.box ?? 0) + 1, INTERVALS.length - 1) : 1;
  // A miss comes back within the same session window (10 minutes) and again tomorrow.
  const due = correct ? now + INTERVALS[box] * DAY - DAY / 8 : now + 10 * 60 * 1000;
  return { box, due };
}

export function isDue(card: SrsCard | undefined, now = Date.now()): boolean {
  return !!card && card.due <= now;
}

export function dayKey(t = Date.now()): string {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function daysBetween(a: string, b: string): number {
  const pa = new Date(a + 'T12:00:00').getTime();
  const pb = new Date(b + 'T12:00:00').getTime();
  return Math.round((pb - pa) / DAY);
}
