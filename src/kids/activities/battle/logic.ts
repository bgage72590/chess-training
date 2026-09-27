// Pawn Wars and Mini Battles (spec 13.7): kingless armies under the mini rules (no check).
// Pure rules shared by the component, miniBot and the tests.
import type { AgeBand, PieceCode, Placement, Sq } from '../types';
import { isSq, other } from '../../lib/fen';
import { applyMove, pseudoMoves, sqRange } from '../../lib/miniRules';

export type WinKind = 'promote' | 'capture-all' | 'stop-pawns';
export type Color = 'w' | 'b';
export interface BattleItem {
  white: Placement;
  black: Placement;
  win: WinKind;
  area?: string;
  enPassant?: boolean;
  bot: { depth: 1 | 2 | 3 | 4; r: number }; // r = randomness in pawn units
  kidColor?: Color;
}
export interface BattleMove {
  from: Sq;
  to: Sq;
  capture?: PieceCode;
}
export interface BattleState {
  pos: Placement;
  turn: Color;
  ep?: Sq; // en passant target square (only used when the item allows it)
  quiet: number; // plies since the last capture or pawn move
}
export interface BattleOutcome {
  winner: Color | null;
  reason: 'promote' | 'capture-all' | 'stop-pawns' | 'stuck' | 'quiet';
}
/** Precomputed rules for one item (the area set is reused by the search). */
export interface BattleRules {
  win: WinKind;
  area?: Set<Sq>;
  enPassant: boolean;
  kidColor: Color;
}

export const QUIET_LIMIT = 100;
const PIECES = new Set(['Q', 'R', 'B', 'N', 'P', 'q', 'r', 'b', 'n', 'p']);
const colorOf = (p: PieceCode): Color => (p === p.toUpperCase() ? 'w' : 'b');
const isPawn = (p: PieceCode | undefined) => p === 'P' || p === 'p';

export function battleRules(item: BattleItem, opts: { enPassant?: boolean } = {}): BattleRules {
  return { win: item.win, area: item.area ? sqRange(item.area) : undefined, enPassant: !!item.enPassant && opts.enPassant !== false, kidColor: item.kidColor ?? 'w' };
}

export function initialState(item: BattleItem): BattleState {
  return { pos: { ...item.white, ...item.black }, turn: 'w', quiet: 0 };
}

export function battleMoves(rules: BattleRules, st: BattleState): BattleMove[] {
  return pseudoMoves(st.pos, st.turn, { epSquare: rules.enPassant ? st.ep : undefined, area: rules.area });
}

/** Plays a move: en passant removes the passed pawn, a pawn on the last rank becomes a queen. */
export function playBattle(st: BattleState, m: { from: Sq; to: Sq }): BattleState & { captured?: PieceCode; promoted: boolean } {
  const pc = st.pos[m.from];
  const pos = applyMove(st.pos, m.from, m.to);
  let captured = st.pos[m.to];
  if (isPawn(pc) && m.to === st.ep && !st.pos[m.to] && m.from[0] !== m.to[0]) {
    const passed = m.to[0] + m.from[1];
    captured = pos[passed];
    delete pos[passed];
  }
  const double = isPawn(pc) && Math.abs(Number(m.to[1]) - Number(m.from[1])) === 2;
  const ep = double ? m.from[0] + (Number(m.from[1]) + Number(m.to[1])) / 2 : undefined;
  const promoted = isPawn(pc) && (m.to[1] === '8' || m.to[1] === '1');
  return { pos, turn: other(st.turn), ep, quiet: captured || isPawn(pc) ? 0 : st.quiet + 1, captured, promoted };
}

/** The game result after `mover` played into `st` (null while the game goes on). */
export function battleOutcome(rules: BattleRules, st: BattleState, mover: Color, promoted: boolean): BattleOutcome | null {
  if (promoted) return { winner: mover, reason: 'promote' };
  const opp = other(mover);
  let oppPieces = 0;
  let oppPawns = 0;
  for (const p of Object.values(st.pos)) {
    if (!p || colorOf(p) !== opp) continue;
    oppPieces++;
    if (isPawn(p)) oppPawns++;
  }
  if (!oppPieces) return { winner: mover, reason: 'capture-all' };
  if (rules.win === 'stop-pawns' && mover === rules.kidColor && !oppPawns) return { winner: mover, reason: 'stop-pawns' };
  if (!battleMoves(rules, st).length) return { winner: null, reason: 'stuck' };
  if (st.quiet >= QUIET_LIMIT) return { winner: null, reason: 'quiet' };
  return null;
}

export function validateBattle(item: BattleItem, _band: AgeBand): string[] {
  const errs: string[] = [];
  const all: [Sq, PieceCode | undefined, Color][] = [
    ...Object.entries(item.white ?? {}).map(([s, p]) => [s, p, 'w'] as [Sq, PieceCode | undefined, Color]),
    ...Object.entries(item.black ?? {}).map(([s, p]) => [s, p, 'b'] as [Sq, PieceCode | undefined, Color]),
  ];
  const seen = new Set<Sq>();
  for (const [s, p, c] of all) {
    if (!isSq(s)) errs.push(`bad square ${s}`);
    if (!p || !PIECES.has(p)) errs.push(`bad piece ${p} on ${s}`);
    else if (colorOf(p) !== c) errs.push(`wrong color ${p} on ${s}`);
    if (seen.has(s)) errs.push(`two pieces on ${s}`);
    seen.add(s);
    if (isPawn(p) && (s[1] === '1' || s[1] === '8')) errs.push(`pawn on the back rank ${s}`);
  }
  if (!Object.keys(item.white ?? {}).length || !Object.keys(item.black ?? {}).length) errs.push('both sides need pieces');
  if (!['promote', 'capture-all', 'stop-pawns'].includes(item.win)) errs.push(`bad win ${item.win}`);
  if (!item.bot || ![1, 2, 3, 4].includes(item.bot.depth)) errs.push('bot depth must be 1-4');
  if (!item.bot || !(item.bot.r >= 0)) errs.push('bot r must be >= 0');
  if (item.area) {
    const area = sqRange(item.area);
    for (const [s] of all) if (!area.has(s)) errs.push(`${s} is outside the area`);
  }
  if (!errs.length) {
    const rules = battleRules(item);
    const st = initialState(item);
    if (!battleMoves(rules, st).length) errs.push('white has no move');
    if (!battleMoves(rules, { ...st, turn: 'b' }).length) errs.push('black has no move');
  }
  return errs;
}

export const RULE_LINE: Record<WinKind, { all: string; sprout: string }> = {
  promote: { all: 'Get a pawn to the other side first to win!', sprout: 'Race a pawn to the other side!' },
  'capture-all': { all: 'Capture every enemy piece. Stop the pawns from reaching your side!', sprout: 'Eat all the pawns!' },
  'stop-pawns': { all: 'Capture all the pawns before one reaches your side!', sprout: 'Catch all the pawns!' },
};
