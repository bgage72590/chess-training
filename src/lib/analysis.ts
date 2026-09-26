import { winPercent, type Score } from '../engine/engine';
import type { MoveClass } from '../store/profile';

/** Win% for `side` from a White-POV score. */
export function winFor(s: Score, side: 'w' | 'b'): number {
  const w = winPercent(s);
  return side === 'w' ? w : 100 - w;
}

/** Lichess-style move accuracy from the drop in win percentage. */
export function moveAccuracy(winLoss: number): number {
  const a = 103.1668 * Math.exp(-0.04354 * Math.max(0, winLoss)) - 3.1669;
  return Math.max(0, Math.min(100, a));
}

export function classify(winLoss: number, isBest: boolean): MoveClass {
  if (isBest) return 'best';
  if (winLoss < 6) return 'good';
  if (winLoss < 12) return 'inaccuracy';
  if (winLoss < 20) return 'mistake';
  return 'blunder';
}

/**
 * Given White-POV evals for every position (length = moves + 1), the played UCI moves and
 * the engine best move in each position, returns per-move classes and per-side accuracy.
 */
export function summarize(evals: Score[], played: string[], best: string[], startTurn: 'w' | 'b' = 'w') {
  const classes: MoveClass[] = [];
  const acc: Record<'w' | 'b', number[]> = { w: [], b: [] };
  for (let i = 0; i < played.length; i++) {
    const side: 'w' | 'b' = (i % 2 === 0) === (startTurn === 'w') ? 'w' : 'b';
    const loss = Math.max(0, winFor(evals[i], side) - winFor(evals[i + 1], side));
    classes.push(classify(loss, played[i] === best[i]));
    acc[side].push(moveAccuracy(played[i] === best[i] ? 0 : loss));
  }
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  return { classes, accuracy: { w: avg(acc.w), b: avg(acc.b) } };
}
