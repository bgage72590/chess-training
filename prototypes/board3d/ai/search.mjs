// A small alpha-beta search on chess.js: material plus piece-square tables (the well-known
// "simplified evaluation" tables), two plies deep with a capture-only extension so it sees recaptures.
import { Chess } from 'chess.js';

const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// Rows from rank 8 down to rank 1, from White's side.
const PST = {
  p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  kEnd: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50],
};

// The search walks chess.js's own internal moves (`_moves`, `_makeMove`, `_undoMove`, the 0x88
// `_board`): its public move() works out the move's notation every time, which is several times slower.
const sq = (i) => 'abcdefgh'[i & 7] + (8 - (i >> 4));

/** Score for White, in centipawns. */
function evaluate(g) {
  const b = g._board;
  let s = 0, heavy = 0;
  for (let i = 0; i < 120; i++) {
    if (i & 0x88) { i += 7; continue; }
    const c = b[i];
    if (c && c.type !== 'p' && c.type !== 'k') heavy += VAL[c.type];
  }
  const endgame = heavy <= 2600;
  for (let i = 0; i < 120; i++) {
    if (i & 0x88) { i += 7; continue; }
    const c = b[i];
    if (!c) continue;
    const row = i >> 4, f = i & 7; // row 0 is rank 8
    const t = c.type === 'k' && endgame ? PST.kEnd : PST[c.type];
    const v = VAL[c.type] + t[c.color === 'w' ? row * 8 + f : (7 - row) * 8 + f];
    s += c.color === 'w' ? v : -v;
  }
  return s;
}

const MATE = 100000;
const gain = (m) => (m.captured ? VAL[m.captured] * 10 - VAL[m.piece] : 0) + (m.promotion ? 8000 : 0);
const order = (moves) => moves.sort((a, b) => gain(b) - gain(a));

class OutOfTime extends Error {}

function quiesce(g, alpha, beta, depth, ctx) {
  if (++ctx.nodes % 128 === 0 && performance.now() > ctx.deadline) throw new OutOfTime();
  const stand = (g._turn === 'w' ? 1 : -1) * evaluate(g);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (depth === 0) return stand;
  for (const m of order(g._moves({ legal: true }).filter((m) => m.captured || m.promotion))) {
    g._makeMove(m);
    const v = -quiesce(g, -beta, -alpha, depth - 1, ctx);
    g._undoMove();
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function negamax(g, depth, alpha, beta, ply, ctx) {
  if (++ctx.nodes % 128 === 0 && performance.now() > ctx.deadline) throw new OutOfTime();
  const moves = g._moves({ legal: true });
  if (!moves.length) return g._isKingAttacked(g._turn) ? -MATE + ply : 0;
  if (depth === 0) return quiesce(g, alpha, beta, 4, ctx);
  let best = -Infinity;
  for (const m of order(moves)) {
    g._makeMove(m);
    const v = -negamax(g, depth - 1, -beta, -alpha, ply + 1, ctx);
    g._undoMove();
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * The move to play in `fen`, as { from, to, promotion }. Searches one ply deeper at a time
 * (captures are always followed to the end) until `ms` runs out and keeps the deepest finished
 * answer; the first ply always finishes. `jitter` centipawns of randomness pick among near-equal
 * moves, so games differ.
 */
export function chooseMove(fen, { ms = 700, maxDepth = 4, jitter = 12, rand = Math.random } = {}) {
  const g = new Chess(fen);
  const start = performance.now();
  const ctx = { nodes: 0, deadline: start + ms * 8 };
  let root = order(g._moves({ legal: true })).map((m) => ({ m, v: 0 }));
  if (!root.length) return { move: null, depth: 0, nodes: 0 };
  const noise = root.map(() => rand() * jitter);
  root.forEach((r, i) => (r.noise = noise[i]));
  let done = 0;
  for (let depth = 1; depth <= maxDepth && root.length > 1; depth++) {
    const hist = g._history.length;
    try {
      let alpha = -Infinity;
      const next = [];
      for (const r of root) {
        g._makeMove(r.m);
        // Moves that cannot come within `jitter` of the best so far are cut short.
        const v = -negamax(g, depth - 1, -Infinity, -(alpha - jitter), 1, ctx);
        g._undoMove();
        next.push({ ...r, v: v + r.noise });
        alpha = Math.max(alpha, v);
      }
      root = next.sort((a, b) => b.v - a.v);
      done = depth;
      if (Math.abs(root[0].v) > MATE / 2) break;
      ctx.deadline = start + ms;
      if (performance.now() > start + ms / 3) break; // the next ply would take several times longer
    } catch (e) {
      if (!(e instanceof OutOfTime)) throw e;
      while (g._history.length > hist) g._undoMove();
      break;
    }
  }
  const m = root[0].m;
  return { move: { from: sq(m.from), to: sq(m.to), promotion: m.promotion }, depth: done, nodes: ctx.nodes };
}
