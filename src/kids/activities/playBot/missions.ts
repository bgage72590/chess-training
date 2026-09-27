// Play-bot missions (spec 13.12): win, promote, no-hang and develop (the Golden Rules).
// Pure functions over the game's move list so they are easy to test.
import type { Move } from 'chess.js';

export type Mission = 'win' | 'promote' | 'no-hang' | 'develop';
export type Outcome = 'win' | 'draw' | 'loss';

// ---------- develop: the five Golden Rules ----------
export type RuleId = 'center' | 'knights' | 'bishops' | 'castle' | 'queen';
export type Tick = 'yes' | 'no' | 'wait';

export const GOLDEN_RULES: { id: RuleId; label: string; short: string }[] = [
  { id: 'center', label: 'A pawn in the middle', short: 'Center pawn' },
  { id: 'knights', label: 'Both knights out', short: 'Knights' },
  { id: 'bishops', label: 'Both bishops out', short: 'Bishops' },
  { id: 'castle', label: 'Castle your king', short: 'Castle' },
  { id: 'queen', label: 'Queen waits (5 moves)', short: 'Queen waits' },
];
export const DEVELOP_MOVES = 10;

type KidMove = Pick<Move, 'from' | 'to' | 'piece' | 'flags'>;

/** The live checklist after the kid's moves so far (only the first 10 count). */
export function developTicks(kidMoves: KidMove[], color: 'w' | 'b'): Record<RuleId, Tick> {
  const ms = kidMoves.slice(0, DEVELOP_MOVES);
  const back = color === 'w' ? '1' : '8';
  const center = color === 'w' ? ['e4', 'd4'] : ['e5', 'd5'];
  const from = new Set<string>(ms.map((m) => m.from));
  const moved = (sqs: string[]) => sqs.every((f) => from.has(f + back));
  const done = ms.length >= DEVELOP_MOVES;
  const res = (ok: boolean): Tick => (ok ? 'yes' : done ? 'no' : 'wait');
  const earlyQueen = ms.slice(0, 5).some((m) => m.piece === 'q');
  return {
    center: res(ms.some((m) => m.piece === 'p' && center.includes(m.to))),
    knights: res(moved(['b', 'g'])),
    bishops: res(moved(['c', 'f'])),
    castle: res(ms.some((m) => m.flags.includes('k') || m.flags.includes('q'))),
    queen: earlyQueen ? 'no' : ms.length >= 5 ? 'yes' : 'wait',
  };
}

/** Is the develop mission over (10 kid moves, or every rule already ticked)? */
export function developOver(ticks: Record<RuleId, Tick>, kidMoves: number): boolean {
  return kidMoves >= DEVELOP_MOVES || Object.values(ticks).every((t) => t === 'yes');
}

/** 5 ticks = 3 stars, 3-4 = 2, else 1. */
export function developScore(ticks: Record<RuleId, Tick>): 1 | 2 | 3 {
  const n = Object.values(ticks).filter((t) => t === 'yes').length;
  return n >= 5 ? 3 : n >= 3 ? 2 : 1;
}

// ---------- promote: the first queen made wins ----------
/** Who made the first queen, if anyone: 'kid', 'bot' or null. */
export function firstQueen(moves: Pick<Move, 'color' | 'promotion'>[], kidColor: 'w' | 'b'): 'kid' | 'bot' | null {
  const m = moves.find((x) => x.promotion === 'q');
  if (!m) return null;
  return m.color === kidColor ? 'kid' : 'bot';
}

// ---------- no-hang ----------
export const NO_HANG_MOVES = 12;
/** Success when the kid won, or the game ended after 12+ kid moves without keeping a flagged move. */
export function noHangSuccess(o: { ended: boolean; kidMoves: number; keptFlagged: number; result: Outcome | null }): boolean {
  if (o.keptFlagged > 0) return false;
  if (o.result === 'win') return true;
  return o.ended && o.kidMoves >= NO_HANG_MOVES;
}

// ---------- the chess result ----------
/** The game result for the kid from a finished chess.js game, or null while it runs. */
export function chessResult(c: { isCheckmate(): boolean; isDraw(): boolean; isStalemate(): boolean; turn(): 'w' | 'b' }, kidColor: 'w' | 'b'): Outcome | null {
  if (c.isCheckmate()) return c.turn() === kidColor ? 'loss' : 'win';
  if (c.isStalemate() || c.isDraw()) return 'draw';
  return null;
}

/** The item result for a mission: outcome for win / promote / no-hang; develop scores by ticks. */
export function missionResult(mission: Mission, o: { result: Outcome | null; ticks?: Record<RuleId, Tick>; noHang?: boolean }): { score: 1 | 2 | 3; outcome?: Outcome } {
  if (mission === 'develop') return { score: developScore(o.ticks!) };
  if (mission === 'no-hang') {
    const outcome: Outcome = o.noHang ? 'win' : o.result === 'draw' ? 'draw' : 'loss';
    return { score: outcome === 'win' ? 3 : outcome === 'draw' ? 2 : 1, outcome };
  }
  const outcome = o.result ?? 'loss';
  return { score: outcome === 'win' ? 3 : outcome === 'draw' ? 2 : 1, outcome };
}
