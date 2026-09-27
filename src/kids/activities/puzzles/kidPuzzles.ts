// Picks database puzzles for a kid (spec 13.13 "kidPuzzles.pick"). Pure and seeded.
import type { AgeBand } from '../types';
import { puzzles as ALL, type Puzzle } from '../../../data/puzzles';
import { shuffle } from '../../lib/rng';

export interface PickOptions {
  themes: string[]; // any of these; [] = every theme
  maxRating: number;
  band: AgeBand;
  rating: number; // the kid's puzzle rating
  count: number;
  rng: () => number;
  seen?: (id: string) => boolean;
  pool?: Puzzle[]; // tests
}

const LONG = ['long', 'veryLong'];

/** Every puzzle a band may get for these themes and cap (before the rating window). */
export function eligible(themes: string[], maxRating: number, band: AgeBand, pool: Puzzle[] = ALL): Puzzle[] {
  return pool.filter(
    (p) =>
      p.rating <= maxRating &&
      (!themes.length || p.themes.some((t) => themes.includes(t))) &&
      (band !== 'explorer' || p.moves.split(' ').length === 2) &&
      (band === 'champion' || !p.themes.some((t) => LONG.includes(t))) &&
      (band !== 'sprout' || p.moves.split(' ').length === 2),
  );
}

/** Picks `count` puzzles near the kid's rating: window [r-150, r+100], widened by 100 a side until
 *  there are 3 x count candidates. Unseen puzzles first; seeded choice. */
export function pick(o: PickOptions): Puzzle[] {
  const base = eligible(o.themes, o.maxRating, o.band, o.pool);
  if (!base.length) return [];
  const minR = Math.min(...base.map((p) => p.rating));
  const maxR = Math.max(...base.map((p) => p.rating));
  let lo = o.rating - 150;
  let hi = o.rating + 100;
  let cands = base.filter((p) => p.rating >= lo && p.rating <= hi);
  while (cands.length < 3 * o.count && (lo > minR || hi < maxR)) {
    lo -= 100;
    hi += 100;
    cands = base.filter((p) => p.rating >= lo && p.rating <= hi);
  }
  const seen = o.seen ?? (() => false);
  const fresh = shuffle(o.rng, cands.filter((p) => !seen(p.id)));
  const old = shuffle(o.rng, cands.filter((p) => seen(p.id)));
  return [...fresh, ...old].slice(0, o.count);
}

export const kidPuzzles = { pick, eligible };
