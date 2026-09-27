// Find the Move: goal checking, solutions, escape classification and validation. Pure (chess.js only).
import { Chess, type Move, type Square } from 'chess.js';
import type { AgeBand, HintStep, ItemMeta, Sq } from '../types';
import { bandText } from '../types';
import { dangerAfterMove, pieceLoss, VALUE } from '../../lib/danger';
import { SQUARE_RE } from '../../lib/pronounce';

export type Goal =
  | { kind: 'check' }
  | { kind: 'mate' } // any mating move
  | { kind: 'capture'; square?: Sq } // any capture (on square if given)
  | { kind: 'safe-capture'; square?: Sq } // capture with gain - dangerLoss(capturer) > 0
  | { kind: 'protect'; square: Sq } // piece on square stays and is defended afterwards
  | { kind: 'escape'; ways: ('run' | 'block' | 'capture')[] | 'any' }
  | { kind: 'flag'; flag: 'k' | 'q' | 'e' | 'p' } // O-O, O-O-O, en passant, promotion
  | { kind: 'line'; uci: string[] } // kid moves must match; replies auto-play; a final mate step accepts any mate
  | { kind: 'no-hang' }; // dangerAfterMove(before, move, 3) === null

export interface FindMoveItem {
  fen: string;
  goal: Goal;
  lastMove?: [Sq, Sq];
  hints?: HintStep[];
  replay?: { fen: string; uci: string }; // shown first: position `replay.fen`, then `uci` animates; the result must equal `fen`
}

export type EscapeWay = 'run' | 'block' | 'capture';

export const uciOf = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion ?? '');

export function load(fen: string): Chess | null {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

export function legalMoves(fen: string): Move[] {
  return load(fen)?.moves({ verbose: true }) ?? [];
}

/** Plays a move on a copy; null if illegal. */
export function play(fen: string, m: { from: string; to: string; promotion?: string }): { fen: string; move: Move } | null {
  const c = load(fen);
  if (!c) return null;
  try {
    const move = c.move({ from: m.from, to: m.to, promotion: m.promotion });
    return { fen: c.fen(), move };
  } catch {
    return null;
  }
}

/** Run, block or capture: how a move gets out of check. */
export function escapeWay(fenBefore: string, move: Move): EscapeWay {
  const c = load(fenBefore)!;
  const king = c.findPiece({ type: 'k', color: c.turn() })[0];
  const checkers: Sq[] = king ? c.attackers(king, c.turn() === 'w' ? 'b' : 'w') : [];
  if (move.captured && checkers.includes(move.to)) return 'capture';
  if (move.piece === 'k') return 'run';
  return 'block';
}

/** Does this move meet a single-move goal? (`line` is checked move by move by the component.) */
export function meetsGoal(fenBefore: string, move: Move, goal: Goal): boolean {
  const after = load(fenBefore);
  if (!after) return false;
  try {
    after.move({ from: move.from, to: move.to, promotion: move.promotion });
  } catch {
    return false;
  }
  const us = move.color;
  switch (goal.kind) {
    case 'check':
      return after.inCheck();
    case 'mate':
      return after.isCheckmate();
    case 'capture':
      return !!move.captured && (!goal.square || move.to === goal.square);
    case 'safe-capture': {
      if (!move.captured || (goal.square && move.to !== goal.square)) return false;
      if (after.isCheckmate()) return true;
      return VALUE[move.captured] - pieceLoss(after, move.to) > 0;
    }
    case 'protect': {
      if (move.from === goal.square) return false;
      const p = after.get(goal.square as Square);
      return !!p && p.color === us && after.isAttacked(goal.square as Square, us);
    }
    case 'escape': {
      if (goal.ways === 'any') return true;
      return goal.ways.includes(escapeWay(fenBefore, move));
    }
    case 'flag':
      return move.flags.includes(goal.flag);
    case 'no-hang':
      return dangerAfterMove(fenBefore, move, 3) === null;
    case 'line': {
      const want = goal.uci[0];
      return uciOf(move) === want || (goal.uci.length === 1 && after.isCheckmate());
    }
  }
}

/** Every legal move that meets the goal (for `line`: the first kid move). */
export function solutions(fen: string, goal: Goal): Move[] {
  return legalMoves(fen).filter((m) => meetsGoal(fen, m, goal));
}

/** For a line goal at kid step k (0-based kid move index): the expected uci and any-mate acceptance. */
export function lineStep(goal: Extract<Goal, { kind: 'line' }>, ply: number): { uci: string; last: boolean } {
  return { uci: goal.uci[ply], last: ply >= goal.uci.length - 1 };
}

/** Does a kid move match the line at ply? The final step accepts any mate. */
export function lineAccepts(fenBefore: string, move: Move, goal: Extract<Goal, { kind: 'line' }>, ply: number): boolean {
  const { uci, last } = lineStep(goal, ply);
  if (uciOf(move) === uci || uciOf(move) === uci.slice(0, 4)) return true;
  if (!last) return false;
  const r = play(fenBefore, move);
  return !!r && load(r.fen)!.isCheckmate();
}

const sameFen = (a: string, b: string) => a.split(' ').slice(0, 4).join(' ') === b.split(' ').slice(0, 4).join(' ');

export function validateFindMove(item: FindMoveItem & ItemMeta, band: AgeBand): string[] {
  const errs: string[] = [];
  const c = load(item.fen);
  if (!c) return ['FEN does not load'];
  // Insufficient-material draws are fine for teaching (K+N v K checks); mate and stalemate are not.
  if (c.isCheckmate() || c.isStalemate()) errs.push('position is game over');
  const goal = item.goal;
  const legal = c.moves({ verbose: true });
  if (!goal || !goal.kind) return ['missing goal'];
  if (goal.kind === 'line') {
    let fen = item.fen;
    for (const u of goal.uci) {
      const r = play(fen, { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      if (!r) {
        errs.push(`illegal line move ${u}`);
        break;
      }
      fen = r.fen;
    }
    if (goal.uci.length % 2 === 0) errs.push('a line must end on a kid move');
  } else {
    const sols = legal.filter((m) => meetsGoal(item.fen, m, goal));
    if (!sols.length) errs.push('no solution');
    if (goal.kind !== 'escape' && sols.length === legal.length) errs.push('every move is a solution');
    if (goal.kind === 'protect') {
      const us = c.turn();
      const them = us === 'w' ? 'b' : 'w';
      if (c.inCheck()) errs.push('protect: side to move is in check');
      if (!(c.isAttacked(goal.square as Square, them) && !c.isAttacked(goal.square as Square, us))) errs.push('protect: target must be attacked and undefended');
    }
    if (goal.kind === 'escape') {
      if (!c.inCheck()) errs.push('escape: not in check');
      else if (goal.ways !== 'any') for (const w of goal.ways) if (!legal.some((m) => escapeWay(item.fen, m) === w)) errs.push(`escape: no ${w} move`);
    }
  }
  if (item.replay) {
    const r = play(item.replay.fen, { from: item.replay.uci.slice(0, 2), to: item.replay.uci.slice(2, 4), promotion: item.replay.uci[4] });
    if (!r || !sameFen(r.fen, item.fen)) errs.push('replay does not produce the item FEN');
  }
  if (band === 'sprout' && SQUARE_RE.test(bandText(item.say, band))) errs.push('sprout text contains a square name');
  return errs;
}

/** The wrong-move line for a goal. */
export function wrongLine(goal: Goal): string {
  switch (goal.kind) {
    case 'check':
      return "That's not check yet. Which piece can attack the king?";
    case 'mate':
      return 'Not checkmate yet. Can the king still escape?';
    case 'capture':
      return 'Look for a piece you can gobble!';
    case 'safe-capture':
      return 'Hmm, is that snack guarded?';
    case 'protect':
      return 'Your friend still needs a guard!';
    case 'escape':
      return 'The king is still in danger!';
    case 'flag':
      return goal.flag === 'k' || goal.flag === 'q' ? "Let's find the castle move!" : goal.flag === 'e' ? 'Try the sneaky pawn trick!' : 'March a pawn to the end!';
    case 'line':
      return "Hmm, there's a stronger move. Look for a check that hits two pieces!";
    case 'no-hang':
      return 'Uh-oh, is your piece safe there?';
  }
}

/** The rule line (hint level 1) for a goal. */
export function ruleLine(goal: Goal): string {
  switch (goal.kind) {
    case 'check':
      return 'Check means you attack the king.';
    case 'mate':
      return "Checkmate: attack the king so he can't escape.";
    case 'capture':
      return 'Capture by moving onto a black piece.';
    case 'safe-capture':
      return 'Find a snack that nobody guards.';
    case 'protect':
      return 'Move a friend so it guards the piece in danger.';
    case 'escape':
      return 'Out of check: run, block or capture!';
    case 'flag':
      return goal.flag === 'k' || goal.flag === 'q' ? 'To castle, move the king two steps toward a rook.' : goal.flag === 'e' ? 'A pawn that jumped two steps can be taken in passing.' : 'A pawn on the last row becomes a queen!';
    case 'line':
      return 'Look for a move that attacks two things at once.';
    case 'no-hang':
      return 'Keep every piece safe!';
  }
}
