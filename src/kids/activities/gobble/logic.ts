// Gobble! rules, validation and generators (spec 13.5). Every move must capture. Pure (no React/DOM).
import type { AgeBand, ItemMeta, PieceCode, Placement, Sq } from '../types';
import { bandText } from '../types';
import { isSq } from '../../lib/fen';
import { ALL_SQUARES, applyMove, dests, gobbleSolutions, sqRange } from '../../lib/miniRules';
import { SQUARE_RE } from '../../lib/pronounce';
import { pick, shuffle } from '../../lib/rng';

export interface EatItem {
  mode?: undefined;
  pieces: Placement; // 1 white piece
  targets: Placement; // black; they never move
  rocks?: Sq[];
  area?: string;
  bite?: boolean;
}
/** Last Piece Standing: capture your OWN pieces until one is left. */
export interface SoloItem {
  mode: 'solo';
  pieces: Placement; // all white
  /** Extra verified positions; the component picks one of `pieces` + `pool` per play. */
  pool?: Placement[];
}
export type GobbleItem = EatItem | SoloItem;

export const VALUE: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
export const SOLO_MAX_CAPTURES = 2;

/** Capture squares for the lone white piece (bite: guarded targets are offered too; eating one is a mistake). */
export function eatDests(item: EatItem, pieces: Placement, targets: Placement): Record<Sq, Sq[]> {
  const [s, p] = Object.entries(pieces)[0] as [Sq, PieceCode];
  const area = item.area ? sqRange(item.area) : undefined;
  const d = dests(p, s, { blocked: new Set(item.rocks ?? []), capturable: new Set(Object.keys(targets)), mustCapture: true, area });
  return d.length ? { [s]: d } : {};
}

/** Solo: each piece with captures left may take another own piece (never a king). */
export function soloDests(pieces: Placement, left: Record<Sq, number>): Record<Sq, Sq[]> {
  const out: Record<Sq, Sq[]> = {};
  const kings = Object.keys(pieces).filter((s) => pieces[s]!.toUpperCase() === 'K');
  for (const [s, p] of Object.entries(pieces)) {
    if (!p || (left[s] ?? SOLO_MAX_CAPTURES) <= 0) continue;
    const cap = new Set(Object.keys(pieces).filter((x) => x !== s && !kings.includes(x)));
    const d = dests(p, s, { blocked: new Set(kings.filter((k) => k !== s)), capturable: cap, mustCapture: true });
    if (d.length) out[s] = d;
  }
  return out;
}

/** Applies a solo capture; the capturing piece carries its remaining count. */
export function soloMove(pieces: Placement, left: Record<Sq, number>, from: Sq, to: Sq): { pieces: Placement; left: Record<Sq, number> } {
  const nl: Record<Sq, number> = {};
  for (const s of Object.keys(pieces)) nl[s] = left[s] ?? SOLO_MAX_CAPTURES;
  const carried = nl[from] - 1;
  delete nl[from];
  nl[to] = carried;
  return { pieces: applyMove(pieces, from, to), left: nl };
}

/** Every solo solution (a list of [from, to] captures), up to `limit`. */
export function soloSolutions(pieces: Placement, limit = 200, left: Record<Sq, number> = {}): [Sq, Sq][][] {
  const sols: [Sq, Sq][][] = [];
  const rec = (pc: Placement, l: Record<Sq, number>, path: [Sq, Sq][]) => {
    if (sols.length >= limit) return;
    if (Object.keys(pc).length === 1) {
      sols.push(path);
      return;
    }
    for (const [s, tos] of Object.entries(soloDests(pc, l)))
      for (const q of tos) {
        const n = soloMove(pc, l, s, q);
        rec(n.pieces, n.left, [...path, [s, q]]);
      }
  };
  rec(pieces, left, []);
  return sols;
}

const allSquares = (p: Placement) => Object.keys(p);

export function validateGobble(item: GobbleItem & ItemMeta, band: AgeBand): string[] {
  const errs: string[] = [];
  if (item.mode === 'solo') {
    for (const pos of [item.pieces, ...(item.pool ?? [])]) {
      const e = Object.entries(pos ?? {});
      if (e.length < 2) errs.push('solo needs at least 2 pieces');
      if (e.some(([s, p]) => !isSq(s) || !p || p !== p.toUpperCase())) errs.push('solo pieces must be white, on real squares');
      if (!errs.length && !soloSolutions(pos, 1).length) errs.push('solo: no solution');
    }
  } else {
    const white = Object.entries(item.pieces ?? {});
    if (white.length !== 1 || white.some(([, p]) => !p || p !== p.toUpperCase())) errs.push('needs exactly one white piece');
    if (!Object.keys(item.targets ?? {}).length) errs.push('needs targets');
    if (Object.values(item.targets ?? {}).some((p) => !p || p !== p.toLowerCase())) errs.push('targets must be black');
    const sqs = [...allSquares(item.pieces ?? {}), ...allSquares(item.targets ?? {}), ...(item.rocks ?? [])];
    if (sqs.some((s) => !isSq(s))) errs.push('bad square');
    if (new Set(sqs).size !== sqs.length) errs.push('overlapping squares');
    if (item.area) {
      const a = sqRange(item.area);
      if (sqs.some((s) => !a.has(s))) errs.push('something outside the area');
    }
    if (!errs.length && gobbleSolutions(item, 1).length < 1) errs.push('no solution');
  }
  if (band === 'sprout' && SQUARE_RE.test(bandText(item.say, band))) errs.push('sprout text contains a square name');
  return errs;
}

/** A random solvable gobble (warm-ups): one piece and 2-4 snacks. */
export function reviewGobble(rng: () => number, band: AgeBand): EatItem {
  const sprout = band === 'sprout';
  for (let tries = 0; tries < 200; tries++) {
    const piece = pick(rng, (sprout ? ['R', 'B', 'N'] : ['R', 'B', 'Q', 'N']) as PieceCode[]);
    const sqs = shuffle(rng, sprout ? [...sqRange('a1:d4')] : ALL_SQUARES);
    const n = sprout ? 2 : 2 + Math.floor(rng() * 3);
    const targets: Placement = {};
    for (const s of sqs.slice(1, 1 + n)) targets[s] = pick(rng, ['p', 'n', 'b', 'r'] as PieceCode[]);
    const item: EatItem = { pieces: { [sqs[0]]: piece }, targets, ...(sprout ? { area: 'a1:d4' } : {}) };
    if (gobbleSolutions(item, 1).length) return item;
  }
  return { pieces: { a1: 'R' }, targets: { a3: 'p', c3: 'p' }, area: 'a1:d4' };
}
