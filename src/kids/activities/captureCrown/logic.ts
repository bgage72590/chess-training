// Capture the Crown (spec 13.8): a whole-army game with no check rule. Capturing the king wins,
// moving into danger is allowed (and simply loses), pawns auto-queen, no castling, no en passant.
import type { AgeBand, PieceCode, Placement, Sq } from '../types';
import { fenPlacement, other } from '../../lib/fen';
import { applyMove, pseudoMoves } from '../../lib/miniRules';

export type CrownBotLevel = 'sleepy' | 'playful' | 'clever';
export type Color = 'w' | 'b';
export interface CrownItem {
  placement: Placement;
  bot: CrownBotLevel;
}
export interface CrownMove {
  from: Sq;
  to: Sq;
  capture?: PieceCode;
}
export interface CrownState {
  pos: Placement;
  turn: Color;
  quiet: number; // plies since the last capture
}
export interface CrownOutcome {
  winner: Color | null;
  reason: 'crown' | 'stuck' | 'quiet';
}

export const CROWN_QUIET_LIMIT = 100; // "no captures in 50 moves"
export const BOT_LEVELS: CrownBotLevel[] = ['sleepy', 'playful', 'clever'];
const PIECES = new Set(['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p']);
const isKing = (p: PieceCode | undefined) => p === 'K' || p === 'k';

/** A placement from the piece field of a FEN (content authoring helper). */
export const crownPlacement = (fenBoard: string): Placement => fenPlacement(fenBoard);

export const crownMoves = (st: CrownState): CrownMove[] => pseudoMoves(st.pos, st.turn);

export function playCrown(st: CrownState, m: { from: Sq; to: Sq }): CrownState & { captured?: PieceCode; promoted: boolean } {
  const pc = st.pos[m.from];
  const captured = st.pos[m.to];
  const pos = applyMove(st.pos, m.from, m.to);
  const promoted = (pc === 'P' && m.to[1] === '8') || (pc === 'p' && m.to[1] === '1');
  return { pos, turn: other(st.turn), quiet: captured ? 0 : st.quiet + 1, captured, promoted };
}

export function crownOutcome(st: CrownState & { captured?: PieceCode }, mover: Color): CrownOutcome | null {
  if (isKing(st.captured)) return { winner: mover, reason: 'crown' };
  if (!crownMoves(st).length) return { winner: null, reason: 'stuck' };
  if (st.quiet >= CROWN_QUIET_LIMIT) return { winner: null, reason: 'quiet' };
  return null;
}

/** Can the other side capture `color`'s king right now? (The danger bells.) */
export function kingInDanger(pos: Placement, color: Color): Sq | null {
  const king = color === 'w' ? 'K' : 'k';
  const hit = pseudoMoves(pos, other(color)).find((m) => m.capture === king);
  return hit ? hit.from : null;
}

export function validateCrown(item: CrownItem, _band: AgeBand): string[] {
  const errs: string[] = [];
  const p = item.placement ?? {};
  let wk = 0;
  let bk = 0;
  for (const [s, pc] of Object.entries(p)) {
    if (!/^[a-h][1-8]$/.test(s)) errs.push(`bad square ${s}`);
    if (!pc || !PIECES.has(pc)) errs.push(`bad piece ${pc} on ${s}`);
    if (pc === 'K') wk++;
    if (pc === 'k') bk++;
    if ((pc === 'P' || pc === 'p') && (s[1] === '1' || s[1] === '8')) errs.push(`pawn on the back rank ${s}`);
  }
  if (wk !== 1 || bk !== 1) errs.push('each side needs exactly one king');
  if (!BOT_LEVELS.includes(item.bot)) errs.push(`bad bot ${item.bot}`);
  if (!errs.length) {
    if (!crownMoves({ pos: p, turn: 'w', quiet: 0 }).length) errs.push('white has no move');
    if (!crownMoves({ pos: p, turn: 'b', quiet: 0 }).length) errs.push('black has no move');
    if (kingInDanger(p, 'b')) errs.push('black king capturable at the start');
  }
  return errs;
}

/** Ease helpers for content: one bot level down, and the bot's knights removed. */
export const sleepier = (b: CrownBotLevel): CrownBotLevel => BOT_LEVELS[Math.max(0, BOT_LEVELS.indexOf(b) - 1)];
export function withoutKnights(p: Placement, color: Color = 'b'): Placement {
  const n = color === 'w' ? 'N' : 'n';
  return Object.fromEntries(Object.entries(p).filter(([, pc]) => pc !== n)) as Placement;
}
