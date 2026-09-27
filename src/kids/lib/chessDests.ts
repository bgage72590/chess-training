// Legal targets per square for chess.js activities. Only checkmate and stalemate end play:
// teaching positions like K+N v K are "insufficient material" draws, yet the kid must still move.
import { Chess } from 'chess.js';
import type { Sq } from '../activities/types';

export function playableDests(fen: string, playerColor?: 'w' | 'b'): Record<Sq, Sq[]> {
  const out: Record<Sq, Sq[]> = {};
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return out;
  }
  if (chess.isCheckmate() || chess.isStalemate() || (playerColor && chess.turn() !== playerColor)) return out;
  for (const m of chess.moves({ verbose: true })) {
    const list = (out[m.from] ??= []);
    if (!list.includes(m.to)) list.push(m.to);
  }
  return out;
}
