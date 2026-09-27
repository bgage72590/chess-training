// Star Collector rules, scoring, validation and the endless generator. Pure (no React/DOM).
import type { AgeBand, ItemMeta, Placement, Sq } from '../types';
import { isSq } from '../../lib/fen';
import { starLava, starSolve, sqRange, type StarPuzzle } from '../../lib/miniRules';
import { pick, shuffle } from '../../lib/rng';
import { SQUARE_RE } from '../../lib/pronounce';
import { bandText } from '../types';

export interface StarItem extends StarPuzzle {
  pieces: Placement; // white pieces only (1-3)
  stars: Sq[]; // 1-10
  rocks?: Sq[];
  statues?: Placement; // sleeping black pieces; their attacked squares are lava
  area?: string;
  par: number; // must equal starPar() for every band after resolveItem
  /** Personal best key (e.g. 'trek-a1h8': fewest moves). */
  bestKey?: string;
  /** Moment sticker granted when the item is completed (e.g. st-knight-trek). */
  awardOnDone?: string;
}

export const PIECE_NAME: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };

/** The rule line (hint level 1) for the pieces in an item. */
export function ruleFor(item: StarItem): string {
  const types = [...new Set(Object.values(item.pieces).map((p) => p!.toUpperCase()))];
  const line: Record<string, string> = {
    R: 'Rooks go in straight lines.',
    B: 'Bishops slide on slanty lines.',
    Q: 'The queen goes straight or slanty.',
    K: 'The king takes one step, any way.',
    N: 'Knights hop: two steps and a turn!',
    P: 'Pawns walk straight ahead. Two steps on the first move!',
  };
  let s = types.map((t) => line[t]).join(' ');
  if (item.statues && Object.keys(item.statues).length) s += " Don't step in the lava!";
  return s;
}

/** Stars scoring by par, then capped by the standard mistake/hint score. */
export function starScore(moves: number, par: number, slack: number): 1 | 2 | 3 {
  if (moves <= par + slack) return 3;
  if (moves <= par + 2 + slack) return 2;
  return 1;
}

/** validate: squares valid; no overlaps; nothing on lava; everything inside the area; par exact; at most 10 stars. */
export function validateStars(item: StarItem & ItemMeta, band: AgeBand): string[] {
  const errs: string[] = [];
  const pieces = Object.entries(item.pieces ?? {});
  if (pieces.length < 1 || pieces.length > 3) errs.push('needs 1-3 pieces');
  if (pieces.some(([, p]) => !p || p !== p.toUpperCase())) errs.push('pieces must be white');
  if (!Array.isArray(item.stars) || item.stars.length < 1 || item.stars.length > 10) errs.push('needs 1-10 stars');
  const all = [...pieces.map(([s]) => s), ...(item.stars ?? []), ...(item.rocks ?? []), ...Object.keys(item.statues ?? {})];
  if (all.some((s) => !isSq(s))) errs.push('bad square');
  if (new Set(all).size !== all.length) errs.push('overlapping squares');
  if (Object.values(item.statues ?? {}).some((p) => !p || p !== p.toLowerCase())) errs.push('statues must be black');
  if (item.area) {
    const a = sqRange(item.area);
    if (all.some((s) => !a.has(s))) errs.push('something outside the area');
  }
  const lava = starLava(item, item.pieces ?? {});
  if ((item.stars ?? []).some((s) => lava.has(s))) errs.push('star on lava');
  if (pieces.some(([s]) => lava.has(s))) errs.push('piece starts on lava');
  if (!errs.length) {
    const sol = starSolve(item);
    if (!sol) errs.push('unsolvable');
    else if (sol.par !== item.par) errs.push(`par ${item.par} should be ${sol.par}`);
    else if (sol.par < 1) errs.push('par must be at least 1');
  }
  if (band === 'sprout' && SQUARE_RE.test(bandText(item.say, band))) errs.push('sprout text contains a square name');
  return errs;
}

/** A random, solvable star item (Star Hunt Endless and warm-up fallbacks). */
export function reviewStars(rng: () => number, band: AgeBand): StarItem {
  const sprout = band === 'sprout';
  const area = sprout ? 'a1:e5' : undefined;
  const squares = [...(area ? sqRange(area) : sqRange('a1:h8'))];
  for (let tries = 0; tries < 50; tries++) {
    const piece = pick(rng, ['R', 'B', 'Q', 'K', 'N'] as const);
    const sh = shuffle(rng, squares);
    const start = sh[0];
    const nRocks = Math.floor(rng() * 5);
    const rocks = sh.slice(1, 1 + nRocks);
    const nStars = sprout ? 2 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 3);
    const stars = sh.slice(1 + nRocks, 1 + nRocks + nStars);
    const item: StarItem = { pieces: { [start]: piece }, stars, ...(rocks.length ? { rocks } : {}), ...(area ? { area } : {}), par: 0 };
    const sol = starSolve(item);
    if (!sol || sol.par < 1 || sol.par > (sprout ? 5 : 8)) continue;
    item.par = sol.par;
    if (!validateStars(item, band).length) return item;
  }
  return sprout ? { pieces: { a1: 'R' }, stars: ['a4', 'd4'], area: 'a1:d4', par: 2 } : { pieces: { d4: 'R' }, stars: ['d8', 'h8', 'h1', 'a1'], par: 4 };
}
