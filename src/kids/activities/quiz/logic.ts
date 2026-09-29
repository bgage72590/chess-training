// What's Happening? Quiz: item types, answer checks and validation. Pure (chess.js and miniRules).
// Every stored answer is recomputed here, so content can never drift from the rules (spec 13.9).
import { Chess, type Square } from 'chess.js';
import type { AgeBand, ItemMeta, PieceCode, Placement, Sq } from '../types';
import { bandText } from '../types';
import { dests } from '../../lib/miniRules';
import { pieceLoss, VALUE } from '../../lib/danger';
import { SQUARE_RE } from '../../lib/pronounce';
import { validateFindMove, type FindMoveItem } from '../findMove/logic';

export type Status = 'check' | 'checkmate' | 'stalemate' | 'nothing';
export type CastleReason = 'king-moved' | 'rook-moved' | 'in-the-way' | 'in-check' | 'path-attacked';

export type QuizItem =
  | { kind: 'status2'; fen: string; answer: 'check' | 'nothing'; attacker?: Sq }
  | { kind: 'status4'; fen: string; answer: Status }
  | { kind: 'count'; pieces: Placement; answer: number }
  | { kind: 'value'; a: PieceCode; b: PieceCode }
  | { kind: 'trade'; fen: string; move: [Sq, Sq]; answer: boolean }
  | { kind: 'can-castle'; fen: string; side: 'k' | 'q'; answer: boolean; reason?: CastleReason }
  | { kind: 'bishop-reach'; pieces: Placement; star: Sq; answer: boolean }
  | { kind: 'munch'; fen: string; target: Sq; answer: Sq[] }
  | { kind: 'move'; move: FindMoveItem };

export const PIECE_NAME: Record<string, string> = { P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' };
export const CANDY: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9 };

function load(fen: string): Chess | null {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

/** Check, checkmate, stalemate or nothing for the side to move. */
export function statusOf(fen: string): Status | null {
  const c = load(fen);
  if (!c) return null;
  if (c.isCheckmate()) return 'checkmate';
  if (c.isStalemate()) return 'stalemate';
  return c.inCheck() ? 'check' : 'nothing';
}

/** The squares of the pieces giving check to the side to move. */
export function checkers(fen: string): Sq[] {
  const c = load(fen);
  if (!c) return [];
  const us = c.turn();
  const king = c.findPiece({ type: 'k', color: us })[0];
  return king ? c.attackers(king, us === 'w' ? 'b' : 'w') : [];
}

export function kingSquare(fen: string, color?: 'w' | 'b'): Sq | null {
  const c = load(fen);
  if (!c) return null;
  return c.findPiece({ type: 'k', color: color ?? c.turn() })[0] ?? null;
}

/** How many squares the (only) piece can move to on an otherwise empty board. */
export function countSquares(pieces: Placement): number {
  const entries = Object.entries(pieces);
  if (entries.length !== 1) return -1;
  const [from, piece] = entries[0];
  return dests(piece!, from, { blocked: new Set() }).length;
}

/** Which is worth more: 'a', 'b' or 'same'. */
export function valueAnswer(a: PieceCode, b: PieceCode): 'a' | 'b' | 'same' {
  const va = CANDY[a.toUpperCase()];
  const vb = CANDY[b.toUpperCase()];
  return va === vb ? 'same' : va > vb ? 'a' : 'b';
}

/** A trade: what we win, what we then lose (cheapest recapture, one re-recapture), and the net. */
export function tradeOutcome(fen: string, move: [Sq, Sq]): { gain: number; loss: number; net: number; recapture: { from: Sq; to: Sq } | null } | null {
  const c = load(fen);
  if (!c) return null;
  let m;
  try {
    m = c.move({ from: move[0], to: move[1], promotion: 'q' });
  } catch {
    return null;
  }
  const gain = m.captured ? VALUE[m.captured] : 0;
  const caps = c.moves({ verbose: true }).filter((x) => x.to === move[1]);
  const cheapest = caps.length ? caps.reduce((a, b) => (VALUE[b.piece] < VALUE[a.piece] ? b : a)) : null;
  const loss = pieceLoss(c, move[1]);
  return { gain, loss, net: gain - loss, recapture: cheapest ? { from: cheapest.from, to: cheapest.to } : null };
}

export const tradeAnswer = (fen: string, move: [Sq, Sq]) => {
  const t = tradeOutcome(fen, move);
  return t ? t.net >= 0 : null;
};

const CASTLE_PATH: Record<'w' | 'b', Record<'k' | 'q', { between: Sq[]; walk: Sq[]; rook: Sq; king: Sq }>> = {
  w: { k: { between: ['f1', 'g1'], walk: ['f1', 'g1'], rook: 'h1', king: 'e1' }, q: { between: ['b1', 'c1', 'd1'], walk: ['d1', 'c1'], rook: 'a1', king: 'e1' } },
  b: { k: { between: ['f8', 'g8'], walk: ['f8', 'g8'], rook: 'h8', king: 'e8' }, q: { between: ['b8', 'c8', 'd8'], walk: ['d8', 'c8'], rook: 'a8', king: 'e8' } },
};

/** Is castling on `side` legal right now? */
export function canCastle(fen: string, side: 'k' | 'q'): boolean {
  const c = load(fen);
  return !!c && c.moves({ verbose: true }).some((m) => m.flags.includes(side));
}

/** Why castling is not allowed (the first rule that fails), or null if it is. */
export function castleReasons(fen: string, side: 'k' | 'q'): CastleReason[] {
  const c = load(fen);
  if (!c || canCastle(fen, side)) return [];
  const us = c.turn();
  const them = us === 'w' ? 'b' : 'w';
  const p = CASTLE_PATH[us][side];
  const rights = c.getCastlingRights(us)[side === 'k' ? 'k' : 'q'];
  if (!rights) return ['king-moved', 'rook-moved'];
  if (p.between.some((s) => c.get(s as Square))) return ['in-the-way'];
  if (c.inCheck()) return ['in-check'];
  if (p.walk.some((s) => c.isAttacked(s as Square, them))) return ['path-attacked'];
  return [];
}

/** Light or dark square. */
export const isLight = (sq: Sq) => ((sq.charCodeAt(0) - 97 + Number(sq[1])) & 1) === 0;

/** The squares of the side to move's pieces that can legally capture on `target`. */
export function munchers(fen: string, target: Sq): Sq[] {
  const c = load(fen);
  if (!c) return [];
  return [...new Set(c.moves({ verbose: true }).filter((m) => m.to === target && m.captured).map((m) => m.from))].sort();
}

const sameSet = (a: Sq[], b: Sq[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

export function validateQuiz(item: QuizItem & ItemMeta, band: AgeBand): string[] {
  const errs: string[] = [];
  if (band === 'sprout' && SQUARE_RE.test(bandText(item.say, band))) errs.push('sprout text contains a square name');
  switch (item.kind) {
    case 'status2':
    case 'status4': {
      const s = statusOf(item.fen);
      if (!s) return ['FEN does not load'];
      if (s !== item.answer) errs.push(`status is ${s}, not ${item.answer}`);
      if (item.kind === 'status2') {
        if (item.answer === 'check') {
          const ch = checkers(item.fen);
          if (!item.attacker) errs.push('check needs an attacker');
          else if (ch.length !== 1 || ch[0] !== item.attacker) errs.push(`attacker is ${ch.join(',')}`);
        } else if (item.attacker) errs.push('no attacker when nothing is happening');
      }
      break;
    }
    case 'count': {
      const n = countSquares(item.pieces);
      if (n < 0) errs.push('count needs exactly one piece');
      else if (n !== item.answer) errs.push(`count is ${n}, not ${item.answer}`);
      break;
    }
    case 'value':
      if (!CANDY[item.a.toUpperCase()] || !CANDY[item.b.toUpperCase()]) errs.push('value: kings have no candy value');
      break;
    case 'trade': {
      const a = tradeAnswer(item.fen, item.move);
      if (a === null) errs.push('trade move is illegal');
      else if (a !== item.answer) errs.push(`trade answer should be ${a}`);
      const c = load(item.fen);
      if (c && !c.get(item.move[1] as Square)) errs.push('trade move is not a capture');
      break;
    }
    case 'can-castle': {
      if (!load(item.fen)) return ['FEN does not load'];
      const ok = canCastle(item.fen, item.side);
      if (ok !== item.answer) errs.push(`castling ${item.side} is ${ok ? 'legal' : 'illegal'}`);
      if (!item.answer && item.reason && !castleReasons(item.fen, item.side).includes(item.reason)) errs.push(`reason is ${castleReasons(item.fen, item.side).join('/')}, not ${item.reason}`);
      if (item.answer && item.reason) errs.push('a legal castle has no reason');
      break;
    }
    case 'bishop-reach': {
      const e = Object.entries(item.pieces);
      if (e.length !== 1 || e[0][1]!.toUpperCase() !== 'B') errs.push('bishop-reach needs exactly one bishop');
      else {
        if (e[0][0] === item.star) errs.push('the star is under the bishop');
        if ((isLight(e[0][0]) === isLight(item.star)) !== item.answer) errs.push('bishop-reach answer does not match the square colors');
      }
      break;
    }
    case 'munch': {
      const c = load(item.fen);
      if (!c) return ['FEN does not load'];
      if (c.isGameOver()) errs.push('position is game over');
      const got = munchers(item.fen, item.target);
      if (!got.length) errs.push('nobody can munch');
      if (!sameSet(got, item.answer)) errs.push(`munchers are ${got.join(',')}`);
      // the board lets a kid tap any piece but the king, so a king muncher could never be picked
      if (item.answer.some((s) => c.get(s as Square)?.type === 'k')) errs.push('a king cannot be one of the munchers');
      break;
    }
    case 'move':
      errs.push(...validateFindMove({ ...item.move, say: item.say }, band));
      break;
    default:
      errs.push('unknown quiz kind');
  }
  return errs;
}

/** Answer options for a count question: the answer plus three near neighbours, ascending. */
export function countOptions(answer: number, rng: () => number): number[] {
  const pool = [-3, -2, -1, 1, 2, 3].map((d) => answer + d).filter((n) => n >= 1 && n <= 27);
  const picked = new Set<number>([answer]);
  while (picked.size < 4 && pool.length) picked.add(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return [...picked].sort((a, b) => a - b);
}
