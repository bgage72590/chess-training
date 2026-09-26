/// <reference lib="webworker" />
// Backup engine for browsers that block WebAssembly. Speaks the UCI subset the app uses
// (uci, isready, setoption, ucinewgame, position fen, go depth/movetime, stop).
// Alpha-beta with quiescence and piece-square tables on top of chess.js: roughly club strength.
import { Chess, type Move, type PieceSymbol } from 'chess.js';

const post = (s: string) => (self as DedicatedWorkerGlobalScope).postMessage(s);

const VAL: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// Piece-square tables from White's point of view, a8..h1 order.
const PST: Record<PieceSymbol, number[]> = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

const MATE = 100000;
let pos = new Chess();
let multipv = 1;
let skill = 20;
let stopAt = 0;
let stopped = false;
let nodes = 0;

function evaluate(c: Chess): number {
  // Score from the side to move's point of view.
  const board = c.board();
  let s = 0;
  let nonPawn = 0;
  for (const row of board) for (const p of row) if (p && p.type !== 'p' && p.type !== 'k') nonPawn += VAL[p.type];
  const endgame = nonPawn <= 1300;
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p) continue;
      const idx = p.color === 'w' ? r * 8 + f : (7 - r) * 8 + f;
      const table = p.type === 'k' && endgame ? KING_END : PST[p.type];
      const v = VAL[p.type] + table[idx];
      s += p.color === 'w' ? v : -v;
    }
  return c.turn() === 'w' ? s : -s;
}

function order(moves: Move[]): Move[] {
  const score = (m: Move) => (m.captured ? 10 * VAL[m.captured] - VAL[m.piece] + 10000 : 0) + (m.promotion ? 8000 : 0) + (m.san.includes('+') ? 500 : 0);
  return moves.sort((a, b) => score(b) - score(a));
}

function timeUp() {
  return stopped || (stopAt && (nodes & 255) === 0 && Date.now() > stopAt);
}

function quiesce(c: Chess, alpha: number, beta: number, depth: number): number {
  nodes++;
  const stand = evaluate(c);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (depth <= 0) return alpha;
  const caps = order(c.moves({ verbose: true }).filter((m) => m.captured || m.promotion));
  for (const m of caps) {
    c.move(m);
    const v = -quiesce(c, -beta, -alpha, depth - 1);
    c.undo();
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function search(c: Chess, depth: number, alpha: number, beta: number, ply: number, pv: string[]): number {
  nodes++;
  if (timeUp()) throw new Error('stop');
  const moves = c.moves({ verbose: true });
  if (!moves.length) return c.inCheck() ? -MATE + ply : 0;
  if (c.isDraw() && ply > 0) return 0;
  if (depth <= 0) return quiesce(c, alpha, beta, 4);
  let best = -Infinity;
  for (const m of order(moves)) {
    const childPv: string[] = [];
    c.move(m);
    const v = -search(c, depth - 1, -beta, -alpha, ply + 1, childPv);
    c.undo();
    if (v > best) {
      best = v;
      if (v > alpha) {
        alpha = v;
        pv.length = 0;
        pv.push(m.lan, ...childPv);
      }
    }
    if (alpha >= beta) break;
  }
  return best;
}

function scoreStr(v: number): string {
  if (Math.abs(v) > MATE - 1000) {
    const plies = MATE - Math.abs(v);
    const moves = Math.ceil(plies / 2);
    return `mate ${v > 0 ? moves : -moves}`;
  }
  return `cp ${Math.round(v)}`;
}

function go(opts: { depth?: number; movetime?: number }) {
  stopped = false;
  nodes = 0;
  const maxDepth = Math.min(opts.depth ?? 64, skill < 5 ? 2 : skill < 10 ? 3 : 64);
  stopAt = Date.now() + Math.min(opts.movetime ?? 1000, 1500);
  const c = new Chess(pos.fen());
  const root = order(c.moves({ verbose: true }));
  if (!root.length) {
    post('bestmove (none)');
    return;
  }
  let bestLines: { move: string; score: number; pv: string[] }[] = root.map((m) => ({ move: m.lan, score: 0, pv: [m.lan] }));
  for (let d = 1; d <= maxDepth; d++) {
    try {
      const lines: { move: string; score: number; pv: string[] }[] = [];
      let alpha = -Infinity;
      for (const m of root) {
        const pv: string[] = [];
        c.move(m);
        // Full window for the first multipv lines, narrow afterwards.
        const v = -search(c, d - 1, -Infinity, lines.length < multipv ? Infinity : -alpha, 1, pv);
        c.undo();
        lines.push({ move: m.lan, score: v, pv: [m.lan, ...pv] });
        if (v > alpha) alpha = v;
      }
      lines.sort((a, b) => b.score - a.score);
      bestLines = lines;
      // Search the best moves first next iteration.
      root.sort((a, b) => lines.findIndex((l) => l.move === a.lan) - lines.findIndex((l) => l.move === b.lan));
      lines.slice(0, multipv).forEach((l, i) => post(`info depth ${d} multipv ${i + 1} score ${scoreStr(l.score)} nodes ${nodes} pv ${l.pv.join(' ')}`));
      if (Math.abs(lines[0].score) > MATE - 1000) break;
    } catch {
      break;
    }
    if (Date.now() > stopAt) break;
  }
  let pick = bestLines[0];
  if (skill < 20 && bestLines.length > 1) {
    // Weaker settings sometimes choose a lesser move.
    const margin = (20 - skill) * 25;
    const pool = bestLines.filter((l) => l.score >= bestLines[0].score - margin);
    if (Math.random() < (20 - skill) / 25) pick = pool[Math.floor(Math.random() * pool.length)];
  }
  post(`bestmove ${pick.move}`);
}

self.onmessage = (e: MessageEvent) => {
  const cmd = String(e.data).trim();
  if (cmd === 'uci') {
    post('id name Tempo Backup Engine');
    post('uciok');
  } else if (cmd === 'isready') post('readyok');
  else if (cmd === 'ucinewgame') pos = new Chess();
  else if (cmd === 'stop') stopped = true;
  else if (cmd.startsWith('setoption')) {
    const m = cmd.match(/name (.+?) value (.+)/);
    if (!m) return;
    if (m[1] === 'MultiPV') multipv = Math.max(1, Number(m[2]));
    if (m[1] === 'Skill Level') skill = Number(m[2]);
    if (m[1] === 'UCI_Elo') skill = Math.max(0, Math.min(20, Math.round((Number(m[2]) - 1000) / 80)));
  } else if (cmd.startsWith('position fen ')) {
    const rest = cmd.slice(13);
    const [fen, moves] = rest.split(' moves ');
    try {
      pos = new Chess(fen);
      for (const u of moves?.split(' ') ?? []) pos.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] as PieceSymbol | undefined });
    } catch {
      post('info string CRITICAL ERROR: bad position');
    }
  } else if (cmd.startsWith('go')) {
    const depth = cmd.match(/depth (\d+)/);
    const movetime = cmd.match(/movetime (\d+)/);
    go({ depth: depth ? Number(depth[1]) : undefined, movetime: movetime ? Number(movetime[1]) : undefined });
  }
};
