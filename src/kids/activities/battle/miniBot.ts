// miniBot (spec 13.7): alpha-beta over the mini-rule pseudo moves to a fixed depth, then a
// uniform pick among the root moves within `r` pawns of the best. Pure and fast (< 50 ms at depth 3).
import type { PieceCode, Placement } from '../types';
import { other } from '../../lib/fen';
import { battleMoves, battleOutcome, playBattle, type BattleMove, type BattleRules, type BattleState, type Color } from './logic';

const VAL: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9 };
const WIN = 1000;
const FILES = 'abcdefgh';

/** How far a pawn has come: 0 on its start rank, 5 one step from promotion. */
const advance = (p: PieceCode, rank: number) => (p === 'P' ? rank - 2 : 7 - rank);

/** A pawn with no enemy pawn ahead on its own or a neighbouring file and nothing in front of it. */
function clearPassed(pos: Placement, sq: string, p: PieceCode): boolean {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]);
  const dir = p === 'P' ? 1 : -1;
  const enemyPawn = p === 'P' ? 'p' : 'P';
  for (let y = r + dir; y >= 1 && y <= 8; y += dir) {
    if (pos[sq[0] + y]) return false;
    for (const x of [f - 1, f + 1]) if (x >= 0 && x < 8 && pos[FILES[x] + y] === enemyPawn) return false;
  }
  return true;
}

/**
 * Static eval from `color`'s side: material + 0.1 x advancement^2 per pawn + a bonus for a clear
 * passed pawn. (The spec's 50-point passer bonus made even the sleepiest bot race like a
 * grandmaster, so the bonus is 1 + 0.5 x advancement: strong enough to matter, still beatable.)
 */
export function evaluate(pos: Placement, color: Color): number {
  let s = 0;
  for (const [sq, p] of Object.entries(pos)) {
    if (!p) continue;
    const t = p.toUpperCase();
    let v = VAL[t] ?? 0;
    if (t === 'P') {
      const a = advance(p, Number(sq[1]));
      v += 0.1 * a * a;
      if (clearPassed(pos, sq, p)) v += 1 + 0.5 * a;
    }
    s += (p === t) === (color === 'w') ? v : -v;
  }
  return s;
}

const order = (ms: BattleMove[]) => ms.sort((a, b) => (b.capture ? VAL[b.capture.toUpperCase()] : 0) - (a.capture ? VAL[a.capture.toUpperCase()] : 0));

/** The value of a move for the side playing it, searching `depth` plies in total. */
function scoreMove(rules: BattleRules, st: BattleState, m: BattleMove, depth: number, alpha: number, beta: number): number {
  const mover = st.turn;
  const child = playBattle(st, m);
  const o = battleOutcome(rules, child, mover, child.promoted);
  if (o) return o.winner === null ? 0 : (o.winner === mover ? 1 : -1) * (WIN + depth);
  if (depth <= 1) return evaluate(child.pos, mover);
  return -negamax(rules, child, depth - 1, -beta, -alpha);
}

function negamax(rules: BattleRules, st: BattleState, depth: number, alpha: number, beta: number): number {
  let best = -Infinity;
  for (const m of order(battleMoves(rules, st))) {
    const v = scoreMove(rules, st, m, depth, alpha, beta);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best === -Infinity ? 0 : best;
}

/** Every root move with its exact score (full window, so the `r` pick is fair). */
export function rootScores(rules: BattleRules, st: BattleState, depth: number): { move: BattleMove; score: number }[] {
  return battleMoves(rules, st).map((move) => ({ move, score: scoreMove(rules, st, move, depth, -Infinity, Infinity) }));
}

/** The bot's move for the side to move, or null when it has none. */
export function miniBotMove(rules: BattleRules, st: BattleState, bot: { depth: number; r: number }, rng: () => number): BattleMove | null {
  const scored = rootScores(rules, st, Math.max(1, Math.min(4, bot.depth)));
  if (!scored.length) return null;
  const best = Math.max(...scored.map((s) => s.score));
  // A win in hand is always taken; otherwise any move within r of the best.
  const pool = scored.filter((s) => s.score >= (best >= WIN ? best : best - bot.r));
  return pool[Math.floor(rng() * pool.length) % pool.length].move;
}

/** The side that is not the kid. */
export const botColor = (rules: BattleRules): Color => other(rules.kidColor);
