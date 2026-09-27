// Magic Memory rules, validation and the generator (spec 13.6). Pure (no React/DOM).
import type { AgeBand, ItemMeta, PieceCode, Placement, Sq } from '../types';
import { isSq } from '../../lib/fen';
import { ALL_SQUARES, dests } from '../../lib/miniRules';
import { pick, shuffle } from '../../lib/rng';

export type MemoryItem =
  | { mode: 'rebuild'; pieces: Placement; showMs: number }
  | { mode: 'what-moved'; pieces: Placement; move: [Sq, Sq]; showMs: number };

/** Legal-by-its-own-rules move for the what-moved mode (captures only of the other color). */
export function memoryMoveOk(pieces: Placement, move: [Sq, Sq]): boolean {
  const [from, to] = move;
  const p = pieces[from];
  if (!p) return false;
  const white = p === p.toUpperCase();
  const own = new Set(Object.keys(pieces).filter((s) => s !== from && (pieces[s] === pieces[s]!.toUpperCase()) === white));
  const enemy = new Set(Object.keys(pieces).filter((s) => (pieces[s] === pieces[s]!.toUpperCase()) !== white));
  return dests(p, from, { blocked: own, capturable: enemy }).includes(to);
}

/** Pawns never stand on the first or last rank. */
const pawnOk = (s: Sq, p: PieceCode) => p.toUpperCase() !== 'P' || (s[1] !== '1' && s[1] !== '8');

export function validateMemory(item: MemoryItem & ItemMeta, _band: AgeBand): string[] {
  const errs: string[] = [];
  const e = Object.entries(item.pieces ?? {});
  if (e.length < 1 || e.length > 8) errs.push('needs 1-8 pieces');
  if (e.some(([s, p]) => !isSq(s) || !p || !pawnOk(s, p))) errs.push('bad square or pawn on an end rank');
  if (!(item.showMs >= 2000)) errs.push('showMs must be at least 2000');
  if (item.mode === 'what-moved' && !memoryMoveOk(item.pieces ?? {}, item.move)) errs.push('illegal move');
  if (item.mode !== 'rebuild' && item.mode !== 'what-moved') errs.push('unknown mode');
  return errs;
}

const WHITE: PieceCode[] = ['K', 'Q', 'R', 'B', 'N', 'P'];
const BLACK: PieceCode[] = ['k', 'q', 'r', 'b', 'n', 'p'];

/** Explorers: 2-4 pieces for 6 s. Champions: 6-8 pieces for 5 s. About one in three is "what moved?". */
export function reviewMemory(rng: () => number, band: AgeBand): MemoryItem {
  const champ = band === 'champion';
  const showMs = champ ? 5000 : 6000;
  for (let tries = 0; tries < 100; tries++) {
    const n = champ ? 6 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 3);
    const pieces: Placement = {};
    for (const s of shuffle(rng, ALL_SQUARES).slice(0, n)) {
      let p = pick(rng, rng() < 0.6 ? WHITE : BLACK);
      if (!pawnOk(s, p)) p = p === 'P' ? 'N' : 'n';
      pieces[s] = p;
    }
    if (rng() < 0.35) {
      const moves: [Sq, Sq][] = [];
      for (const s of Object.keys(pieces)) for (const t of ALL_SQUARES) if (memoryMoveOk(pieces, [s, t]) && !(pieces[s]!.toUpperCase() === 'P' && /[18]/.test(t[1]))) moves.push([s, t]);
      if (moves.length) {
        const item: MemoryItem = { mode: 'what-moved', pieces, move: pick(rng, moves), showMs };
        if (!validateMemory(item, band).length) return item;
      }
    }
    const item: MemoryItem = { mode: 'rebuild', pieces, showMs };
    if (!validateMemory(item, band).length) return item;
  }
  return { mode: 'rebuild', pieces: { d4: 'N', f6: 'p' }, showMs: 6000 };
}

/** Share of pieces placed right on the first try: 100% = 3, 70% or more = 2, else 1. */
export function memoryScore(total: number, firstTry: number): 1 | 2 | 3 {
  const pct = total ? firstTry / total : 1;
  return pct >= 1 ? 3 : pct >= 0.7 ? 2 : 1;
}
