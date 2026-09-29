// Fuzz: the Kids rules helpers against chess.js on random legal positions (seeded, so failures reproduce).
import { describe, expect, it } from 'vitest';
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { pseudoMoves } from '../src/kids/lib/miniRules';
import { fenPlacement } from '../src/kids/lib/fen';
import { playableDests } from '../src/kids/lib/chessDests';
import { dangerAfterMove, hangs } from '../src/kids/lib/danger';
import { mulberry32 } from '../src/kids/lib/rng';

const FILES = 'abcdefgh';
const SQUARES = Array.from({ length: 64 }, (_, i) => (FILES[i % 8] + (Math.floor(i / 8) + 1)) as Square);

/** A random position with both kings and up to 14 other pieces, or null when chess.js rejects it. */
function randomPosition(rng: () => number): string | null {
  const c = new Chess();
  c.clear();
  const order = SQUARES.slice().sort(() => rng() - 0.5);
  let i = 0;
  const put = (type: PieceSymbol, color: 'w' | 'b') => {
    while (i < order.length) {
      const sq = order[i++];
      if (type === 'p' && (sq[1] === '1' || sq[1] === '8')) continue;
      c.put({ type, color }, sq);
      return;
    }
  };
  put('k', 'w');
  put('k', 'b');
  const kinds: PieceSymbol[] = ['p', 'p', 'n', 'b', 'r', 'q'];
  for (let n = 2 + Math.floor(rng() * 13); n > 0; n--) put(kinds[Math.floor(rng() * kinds.length)], rng() < 0.5 ? 'w' : 'b');
  try {
    return new Chess(c.fen().replace(/ [wb] /, rng() < 0.5 ? ' w ' : ' b ')).fen();
  } catch {
    return null;
  }
}

describe('rules helpers against chess.js', () => {
  it('pseudoMoves lists what chess.js allows for every piece that is neither pinned nor in a check', () => {
    const rng = mulberry32(2024);
    let checked = 0;
    for (let n = 0; n < 250; n++) {
      const fen = randomPosition(rng);
      if (!fen) continue;
      const chess = new Chess(fen);
      const color = chess.turn();
      const mine = fenPlacement(fen);
      const pseudo = pseudoMoves(mine, color).filter((m) => mine[m.from]!.toUpperCase() !== 'K');
      const legal = new Set(chess.moves({ verbose: true }).filter((m) => m.piece !== 'k').map((m) => m.from + m.to));
      const pseudoSet = new Set(pseudo.map((m) => m.from + m.to));
      // Everything chess.js allows is a pseudo move too (no castling or en passant in these positions).
      for (const m of legal) expect(pseudoSet.has(m), `${m} in ${fen}`).toBe(true);
      if (chess.inCheck()) continue;
      const pinned = new Set<string>();
      const probe = new Chess(fen);
      const king = probe.findPiece({ type: 'k', color })[0];
      for (const row of chess.board())
        for (const p of row) {
          if (!p || p.color !== color || p.type === 'k') continue;
          probe.remove(p.square);
          if (probe.isAttacked(king, color === 'w' ? 'b' : 'w')) pinned.add(p.square);
          probe.put({ type: p.type, color: p.color }, p.square);
        }
      // And a free piece has no pseudo move that chess.js refuses.
      for (const m of pseudo) if (!pinned.has(m.from)) expect(legal.has(m.from + m.to), `${m.from}${m.to} in ${fen}`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(80);
  }, 180000);

  it('playableDests is exactly chess.js legal moves, and empty in checkmate and stalemate', () => {
    const rng = mulberry32(99);
    const fens = ['R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1', 'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1'];
    for (let n = 0; n < 200; n++) {
      const fen = randomPosition(rng);
      if (fen) fens.push(fen);
    }
    for (const fen of fens) {
      const chess = new Chess(fen);
      const got = Object.entries(playableDests(fen)).flatMap(([from, tos]) => tos.map((to) => from + to));
      if (chess.isCheckmate() || chess.isStalemate()) expect(got, fen).toEqual([]);
      else expect(new Set(got), fen).toEqual(new Set(chess.moves({ verbose: true }).map((m) => m.from + m.to)));
    }
    expect(new Chess(fens[0]).isCheckmate() && new Chess(fens[1]).isStalemate()).toBe(true);
  }, 180000);

  it('playableDests respects the side the player plays', () => {
    const fen = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1';
    expect(Object.keys(playableDests(fen, 'w'))).toEqual([]);
    expect(Object.keys(playableDests(fen, 'b'))).toEqual(['e8']);
  });

  it('the danger checks never throw, never name a king, and only flag the mover\'s own pieces', () => {
    const rng = mulberry32(5);
    for (let g = 0; g < 3; g++) {
      const c = new Chess();
      for (let ply = 0; ply < 40 && !c.isGameOver(); ply++) {
        const moves = c.moves({ verbose: true });
        const m = moves[Math.floor(rng() * moves.length)];
        const fen = c.fen();
        for (const h of hangs(fen, c.turn())) {
          expect(h.piece.toUpperCase()).not.toBe('K');
          expect(h.loss).toBeGreaterThan(0);
        }
        const d = dangerAfterMove(fen, m, 3);
        if (d) {
          const after = new Chess(fen);
          after.move(m);
          expect(after.get(d.sq as Square)?.color, `${fen} ${m.san}`).toBe(m.color);
        }
        c.move(m);
      }
    }
  }, 180000);
});
