// The mate drill's pure-JS defender (used whenever the engine is not ready, fails or is slow).
// Spec 13.11: from the legal king moves,
//   1. prefer a move that captures an undefended piece;
//   2. drop moves after which White has a mate-in-1;
//   3. maximize the number of king moves next turn (on the null-move FEN);
//   4. tie-break by the smallest distance to the center.
import { Chess, type Move } from 'chess.js';
import { withTurn } from '../../lib/fen';

const load = (fen: string) => {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
};

/** Does the side to move have a mate in one? */
export function hasMateIn1(fen: string): boolean {
  const c = load(fen);
  if (!c) return false;
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    const mate = c.isCheckmate();
    c.undo();
    if (mate) return true;
  }
  return false;
}

/** Legal moves for the side to move if it were its turn in `fenAfter` (the null-move position). */
export function mobilityNext(fenAfter: string, color: 'w' | 'b'): number {
  const c = load(withTurn(fenAfter, color));
  return c ? c.moves().length : 0;
}

const centerDist = (sq: string) => {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]) - 1;
  return Math.abs(f - 3.5) + Math.abs(r - 3.5);
};

export interface ScoredDefense {
  move: Move;
  captures: boolean;
  allowsMate: boolean;
  mobility: number;
  center: number;
}

export function scoreDefenses(fen: string): ScoredDefense[] {
  const c = load(fen);
  if (!c) return [];
  const us = c.turn();
  return c.moves({ verbose: true }).map((move) => {
    c.move(move);
    const after = c.fen();
    c.undo();
    return { move, captures: !!move.captured, allowsMate: hasMateIn1(after), mobility: mobilityNext(after, us), center: centerDist(move.to) };
  });
}

/** The defender's move, or null when it has none. */
export function defend(fen: string): Move | null {
  const all = scoreDefenses(fen);
  if (!all.length) return null;
  // 1. A king only captures undefended pieces (a legal capture is always safe).
  const caps = all.filter((d) => d.captures);
  if (caps.length) return caps[0].move;
  // 2. Avoid a mate-in-1 when there is any alternative.
  const safe = all.filter((d) => !d.allowsMate);
  const pool = safe.length ? safe : all;
  // 3 and 4.
  pool.sort((a, b) => b.mobility - a.mobility || a.center - b.center);
  return pool[0].move;
}
