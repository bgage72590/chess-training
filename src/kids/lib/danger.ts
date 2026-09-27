// Static exchange check for the Danger Alarm, threat lights and the find-move `no-hang` goal.
// Values: P=1, N=3, B=3, R=5, Q=9. The king is never "hanging". See the spec, section 12.2.
import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { PieceCode, Sq } from '../activities/types';
import { other, withTurn } from './fen';

export const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

const code = (type: PieceSymbol, color: 'w' | 'b'): PieceCode => (color === 'w' ? type.toUpperCase() : type) as PieceCode;

/**
 * What we lose on `sq` if the opponent (to move in `chess`) captures there with the cheapest
 * legal capturer and we may recapture once.
 */
export function pieceLoss(chess: Chess, sq: Sq): number {
  const ours = chess.get(sq as Square);
  if (!ours || ours.type === 'k') return 0;
  const caps = chess.moves({ verbose: true }).filter((m) => m.to === sq);
  if (!caps.length) return 0;
  const cheapest = caps.reduce((a, b) => (VALUE[b.piece] < VALUE[a.piece] ? b : a));
  chess.move(cheapest);
  const defended = chess.moves({ verbose: true }).some((m) => m.to === sq);
  chess.undo();
  return defended ? Math.max(0, VALUE[ours.type] - VALUE[cheapest.piece]) : VALUE[ours.type];
}

/** `color`'s pieces that the opponent could win, highest loss first. */
export function hangs(fen: string, color: 'w' | 'b'): { sq: Sq; piece: PieceCode; loss: number }[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
    if (chess.turn() === color) chess = new Chess(withTurn(fen, other(color)));
  } catch {
    return [];
  }
  const out: { sq: Sq; piece: PieceCode; loss: number }[] = [];
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== color || p.type === 'k') continue;
      const loss = pieceLoss(chess, p.square);
      if (loss > 0) out.push({ sq: p.square, piece: code(p.type, p.color), loss });
    }
  }
  return out.sort((a, b) => b.loss - a.loss);
}

/**
 * The single worst piece the mover leaves hanging with this move, if the net loss reaches
 * `threshold`. Mates never alarm; captures and queen promotions count as gains.
 */
export function dangerAfterMove(fenBefore: string, move: Move, threshold: number): { sq: Sq; piece: PieceCode; loss: number; attacker: Sq } | null {
  let after: Chess;
  try {
    after = new Chess(fenBefore);
    after.move({ from: move.from, to: move.to, promotion: move.promotion });
  } catch {
    return null;
  }
  if (after.isCheckmate()) return null;
  const gain = (move.captured ? VALUE[move.captured] : 0) + (move.promotion === 'q' ? 8 : 0);
  const worst = hangs(after.fen(), move.color)[0];
  if (!worst || worst.loss - gain < threshold) return null;
  const caps = after.moves({ verbose: true }).filter((m) => m.to === worst.sq);
  const cheapest = caps.reduce((a, b) => (VALUE[b.piece] < VALUE[a.piece] ? b : a), caps[0]);
  return { ...worst, attacker: cheapest?.from ?? worst.sq };
}
