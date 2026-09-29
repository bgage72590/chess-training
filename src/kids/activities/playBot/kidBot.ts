// The buddies' move logic (spec 13.12). Buddies 1-5 are pure JS, so early games never load WASM;
// Bruno and Ember ask the engine and fall back to Olive when it is unavailable.
import { Chess, type Move, type PieceSymbol } from 'chess.js';
import type { BuddyId } from '../../curriculum/buddies';
import { VALUE } from '../../lib/danger';
import { withTurn } from '../../lib/fen';
import { engine } from '../../../engine/engine';

export type Uci = string;
export const uciOf = (m: Pick<Move, 'from' | 'to' | 'promotion'>): Uci => m.from + m.to + (m.promotion ?? '');

const MAT: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const MATE = 1000;
const CENTER = new Set(['d4', 'e4', 'd5', 'e5']);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function load(fen: string): Chess | null {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

/** Material from `color`'s point of view. */
export function material(chess: Chess, color: 'w' | 'b'): number {
  let s = 0;
  for (const row of chess.board()) for (const p of row) if (p) s += p.color === color ? MAT[p.type] : -MAT[p.type];
  return s;
}

/** Moves that give checkmate at once. */
export function matingMoves(chess: Chess): Move[] {
  const out: Move[] = [];
  for (const m of chess.moves({ verbose: true })) {
    if (!m.san.includes('+') && !m.san.includes('#')) continue;
    chess.move(m);
    if (chess.isCheckmate()) out.push(m);
    chess.undo();
  }
  return out;
}

const pickOf = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];

// ---------- 1. Shelly: random, but never a mate-in-1 when she has another move ----------
export function shellyMove(chess: Chess, rng: () => number): Move {
  const all = chess.moves({ verbose: true });
  const mates = new Set(matingMoves(chess).map(uciOf));
  const calm = all.filter((m) => !mates.has(uciOf(m)));
  return pickOf(rng, calm.length ? calm : all);
}

// ---------- 2. Hop: grabs the biggest thing, never looks at recaptures ----------
export function hopMove(chess: Chess, rng: () => number): Move {
  const all = chess.moves({ verbose: true });
  const mates = matingMoves(chess);
  if (mates.length && rng() < 0.5) return pickOf(rng, mates);
  const caps = all.filter((m) => m.captured);
  if (caps.length) {
    const top = Math.max(...caps.map((m) => VALUE[m.captured!]));
    return pickOf(rng, caps.filter((m) => VALUE[m.captured!] === top));
  }
  return pickOf(rng, all);
}

// ---------- 2-ply minimax shared by Tuck and Fern ----------
interface Scored {
  move: Move;
  score: number;
}

/** Material a move wins for its mover (captures and promotions). */
const gain = (m: Move) => (m.captured ? MAT[m.captured] : 0) + (m.promotion ? MAT[m.promotion] - 1 : 0);

/**
 * Scores every root move by its worst reply (2 plies of material, kept incremental so buddies
 * answer fast). `fern` adds her center and mobility terms.
 */
function twoPly(chess: Chess, fern = false): Scored[] {
  const me = chess.turn();
  const base = material(chess, me);
  const out: Scored[] = [];
  for (const m of chess.moves({ verbose: true })) {
    chess.move(m);
    const replies = chess.moves({ verbose: true });
    let score: number;
    if (!replies.length) score = chess.inCheck() ? MATE : 0;
    else {
      const center = fern ? fernCenter(chess, me) : 0;
      score = Infinity;
      for (const r of replies) {
        // chess.js SAN already carries '#' for a mating reply.
        let v = r.san.includes('#') ? -MATE : base + gain(m) - gain(r);
        if (fern && v > -MATE) v += center - (CENTER.has(r.to) && (r.captured === 'p' || r.captured === 'n') ? 0.2 : 0);
        if (v < score) score = v;
      }
      if (fern && score > -MATE) score += fernMobility(chess, me, replies.length);
    }
    chess.undo();
    out.push({ move: m, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ---------- 3. Tuck: 2-ply material; 30% of moves are random ----------
export function tuckMove(chess: Chess, rng: () => number): Move {
  if (rng() < 0.3) return pickOf(rng, chess.moves({ verbose: true }));
  const scored = twoPly(chess);
  const best = scored[0].score;
  return pickOf(rng, scored.filter((s) => s.score === best)).move;
}

// ---------- 4. Fern: 2-ply with mobility and center; top 3 at 60/30/10 ----------
/** 0.2 per own pawn or knight on d4/e4/d5/e5. */
export function fernCenter(c: Chess, me: 'w' | 'b'): number {
  let s = 0;
  for (const sq of CENTER) {
    const p = c.get(sq as Parameters<Chess['get']>[0]);
    if (p && p.color === me && (p.type === 'p' || p.type === 'n')) s += 0.2;
  }
  return s;
}
/** 0.1 x (own mobility - opponent mobility), measured after Fern's move. */
function fernMobility(c: Chess, me: 'w' | 'b', replies: number): number {
  let own = 0;
  try {
    own = new Chess(withTurn(c.fen(), me)).moves().length;
  } catch {
    own = replies;
  }
  return 0.1 * (own - replies);
}
export function fernMove(chess: Chess, rng: () => number): Move {
  const scored = twoPly(chess, true);
  const top = scored.slice(0, 3);
  const w = [0.6, 0.3, 0.1].slice(0, top.length);
  const sum = w.reduce((a, b) => a + b, 0);
  let r = rng() * sum;
  for (let i = 0; i < top.length; i++) {
    r -= w[i];
    if (r <= 0) return top[i].move;
  }
  return top[0].move;
}

// ---------- 5. Olive: alpha-beta, iterative deepening to 3 plies, capture quiescence ----------
const PST_MINOR: Record<string, number> = {};
for (const f of 'abcdefgh')
  for (let r = 1; r <= 8; r++) {
    const df = Math.min(Math.abs(f.charCodeAt(0) - 100.5), 4); // distance from the d/e files
    const dr = Math.min(Math.abs(r - 4.5), 4);
    const d = Math.max(df, dr);
    PST_MINOR[f + r] = d <= 1 ? 0.3 : d <= 2 ? 0.2 : d <= 3 ? 0.1 : 0;
  }

/** Material, centralised minor pieces, pawn advance, and 0.2 per pawn on d4/e4/d5/e5 (the opening fights for the centre). */
export function oliveEval(c: Chess, me: 'w' | 'b'): number {
  let s = 0;
  const board = c.board();
  for (const row of board)
    for (const p of row) {
      if (!p) continue;
      let v = MAT[p.type];
      if (p.type === 'n' || p.type === 'b') v += PST_MINOR[p.square];
      else if (p.type === 'p') v += 0.05 * (p.color === 'w' ? Number(p.square[1]) - 2 : 7 - Number(p.square[1])) + (CENTER.has(p.square) ? 0.2 : 0);
      s += p.color === me ? v : -v;
    }
  return s;
}

class Timeout extends Error {}

function ordered(moves: Move[]): Move[] {
  const key = (m: Move) => (m.captured ? 10 * MAT[m.captured] - MAT[m.piece] + 100 : 0) + (m.promotion ? 80 : 0);
  return moves.sort((a, b) => key(b) - key(a));
}

function quiesce(c: Chess, alpha: number, beta: number, qdepth: number, deadline: number): number {
  const stand = oliveEval(c, c.turn());
  if (qdepth === 0 || stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  for (const m of ordered(c.moves({ verbose: true }).filter((x) => x.captured || x.promotion))) {
    c.move(m);
    const v = -quiesce(c, -beta, -alpha, qdepth - 1, deadline);
    c.undo();
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function negamax(c: Chess, depth: number, alpha: number, beta: number, ply: number, deadline: number): number {
  if (now() > deadline) throw new Timeout();
  const moves = c.moves({ verbose: true });
  if (!moves.length) return c.inCheck() ? -MATE + ply : 0;
  if (depth === 0) return quiesce(c, alpha, beta, 2, deadline);
  let best = -Infinity;
  for (const m of ordered(moves)) {
    c.move(m);
    const v = -negamax(c, depth - 1, -beta, -alpha, ply + 1, deadline);
    c.undo();
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Olive's search. `noise` is a uniform root bonus in ±noise per move (0 for hints). For the first
 * eight moves it is at most 0.1, under the centre-pawn bonus, so her openings are not random (1.h4, 1...g5).
 * Returns the deepest completed iteration's best move within `budgetMs`.
 */
export function oliveMove(chess: Chess, rng: () => number, opts: { noise?: number; budgetMs?: number; maxDepth?: number } = {}): Move {
  const noise = Math.min(opts.noise ?? 0.3, chess.moveNumber() <= 8 ? 0.1 : Infinity);
  const deadline = now() + (opts.budgetMs ?? 400);
  const mates = matingMoves(chess);
  if (mates.length) return mates[0];
  const root = ordered(chess.moves({ verbose: true }));
  const bonus = new Map(root.map((m) => [uciOf(m), noise ? (rng() * 2 - 1) * noise : 0]));
  let best: Move = root[0];
  // Depth 1 always completes (it is cheap), so there is always an answer.
  for (let depth = 1; depth <= (opts.maxDepth ?? 3); depth++) {
    const c = new Chess(chess.fen());
    try {
      let bestV = -Infinity;
      let bestM: Move = root[0];
      for (const m of root) {
        c.move(m);
        const v = -negamax(c, depth - 1, -Infinity, Infinity, 1, depth === 1 ? Infinity : deadline) + bonus.get(uciOf(m))!;
        c.undo();
        if (v > bestV) {
          bestV = v;
          bestM = m;
        }
      }
      best = bestM;
      // Search the previous best first next time.
      root.sort((a, b) => (a === bestM ? -1 : b === bestM ? 1 : 0));
    } catch (e) {
      if (e instanceof Timeout) break;
      throw e;
    }
  }
  return best;
}

// ---------- The persona switch ----------
export const ENGINE_BUDDIES: BuddyId[] = ['bruno', 'ember'];

/** A pure-JS buddy's move (Bruno and Ember play as Olive here). Null when there is no legal move. */
export function jsMove(bot: BuddyId, fen: string, rng: () => number): Move | null {
  const chess = load(fen);
  if (!chess || chess.isGameOver() || !chess.moves().length) return null;
  switch (bot) {
    case 'shelly':
      return shellyMove(chess, rng);
    case 'hop':
      return hopMove(chess, rng);
    case 'tuck':
      return tuckMove(chess, rng);
    case 'fern':
      return fernMove(chess, rng);
    default:
      return oliveMove(chess, rng);
  }
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

function moveFromUci(fen: string, uci: string | null | undefined): Move | null {
  if (!uci) return null;
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return null;
  }
}

/** Starts the engine for Bruno and Ember (never for buddies 1-5). Resolves true when it is ready. */
export async function wakeEngine(): Promise<boolean> {
  if (engine.status === 'ready') return true;
  if (engine.status === 'failed') return false;
  try {
    await withTimeout(engine.init(), 15000);
  } catch {
    return false;
  }
  return engine.status === ('ready' as typeof engine.status);
}

/**
 * Any buddy's move. `fellBack` is true when Bruno or Ember could not use the engine and Olive
 * played instead ("Bruno is napping").
 */
export async function buddyMove(bot: BuddyId, fen: string, rng: () => number): Promise<{ move: Move | null; fellBack: boolean }> {
  if (!ENGINE_BUDDIES.includes(bot)) return { move: jsMove(bot, fen, rng), fellBack: false };
  // A move that comes before the engine has finished loading waits for it: Bruno is only napping if it really cannot start.
  if (engine.status === 'idle' || engine.status === 'loading') await wakeEngine();
  if (engine.status === 'ready') {
    try {
      const r = await withTimeout(engine.search(fen, bot === 'bruno' ? { skill: 0, depth: 3, multipv: 3 } : { skill: 3, depth: 6 }), 5000);
      if (r) {
        let uci = r.best;
        if (bot === 'bruno' && r.lines.length > 1) {
          const cp = (l: (typeof r.lines)[number]) => (l.score.mate != null ? (l.score.mate > 0 ? 10000 - l.score.mate : -10000 - l.score.mate) : l.score.cp ?? 0);
          const top = cp(r.lines[0]);
          const near = r.lines.filter((l) => l.pv[0] && top - cp(l) <= 150);
          if (near.length) uci = pickOf(rng, near).pv[0];
        }
        const m = moveFromUci(fen, uci);
        if (m) return { move: m, fellBack: false };
      }
    } catch {
      /* fall back */
    }
  }
  return { move: jsMove('olive', fen, rng), fellBack: true };
}

/** The hint move: the engine at depth 10 when it is already running, else Olive's search without noise. */
export async function hintMove(fen: string): Promise<Move | null> {
  if (engine.status === 'ready') {
    try {
      const r = await withTimeout(engine.search(fen, { depth: 10 }), 2500);
      const m = moveFromUci(fen, r?.best);
      if (m) return m;
    } catch {
      /* fall back */
    }
  }
  const chess = load(fen);
  if (!chess || !chess.moves().length) return null;
  return oliveMove(chess, () => 0.5, { noise: 0, budgetMs: 600 });
}

/**
 * The Oops shield (Champion option): the engine's view of a move, or null when the engine can't
 * answer within 1.5 s (the caller then uses the static rule).
 */
export async function oopsShield(fenBefore: string, fenAfter: string): Promise<boolean | null> {
  if (engine.status !== 'ready') return null;
  const deadline = new Promise<null>((r) => setTimeout(() => r(null), 1500));
  const both = Promise.all([engine.search(fenBefore, { depth: 8 }), engine.search(fenAfter, { depth: 8 })]);
  const r = await Promise.race([both, deadline]);
  if (!r || !r[0] || !r[1]) return null;
  const cp = (s: { cp?: number; mate?: number } | undefined) => (s?.mate != null ? (s.mate > 0 ? 3000 : -3000) : s?.cp ?? 0);
  // Before: the kid is to move (their view). After: the opponent is to move, so negate.
  const before = cp(r[0].lines[0]?.score);
  const after = -cp(r[1].lines[0]?.score);
  return before - after >= 250;
}
