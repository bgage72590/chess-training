// Puzzle of the Day (spec 13.13): the same puzzle for every kid in a band on a given day.
import type { AgeBand, ItemMeta } from '../types';
import type { FindMoveItem } from '../findMove/logic';
import { puzzles as ALL, type Puzzle } from '../../../data/puzzles';
import { dayKey } from '../../../lib/srs';
import { hashSeed, mulberry32 } from '../../lib/rng';
import { eligible } from './kidPuzzles';
import { W6_FREE_LUNCH, W7_MATE1 } from '../../content/core';
import { visibleTo } from '../../curriculum/tuning';

type FM = FindMoveItem & ItemMeta;
const cap = (id: string, fen: string, square: string, say: string): FM => ({ id: `daily-${id}`, fen, goal: { kind: 'capture', square }, say });
const mate = (id: string, fen: string, say = 'Find checkmate!'): FM => ({ id: `daily-${id}`, fen, goal: { kind: 'mate' }, say });

/** The Sprout daily list: 30 mate and capture items (w7-mate1 and w6 Sprout items, plus 20 more). */
export const SPROUT_DAILY: FM[] = [
  ...W7_MATE1.items.filter((i) => visibleTo(i, 'sprout')),
  ...W6_FREE_LUNCH.items.filter((i) => visibleTo(i, 'sprout') && i.goal.kind === 'capture'),
  cap('c1', '4k3/8/8/8/8/8/1r6/1R2K3 w - - 0 1', 'b2', 'Gobble the black rook!'),
  cap('c2', '4k3/8/8/2n5/8/8/8/2Q1K3 w - - 0 1', 'c5', 'Zoom the queen and gobble the knight!'),
  cap('c3', '4k3/8/8/8/8/5q2/8/4K1N1 w - - 0 1', 'f3', 'Hop and gobble the queen!'),
  cap('c4', '4k3/8/8/8/3r4/8/8/3QK3 w - - 0 1', 'd4', 'Gobble the rook with your queen!'),
  cap('c5', '4k3/8/8/8/8/2b5/3P4/4K3 w - - 0 1', 'c3', 'Pawns eat slanty! Gobble the bishop!'),
  cap('c6', '4k3/8/8/4n3/8/8/8/4R1K1 w - - 0 1', 'e5', 'Zoom up and gobble the knight!'),
  cap('c7', '4k3/8/1q6/8/8/8/8/1R2K3 w - - 0 1', 'b6', 'Gobble the black queen!'),
  cap('c8', '4k3/8/8/8/5b2/8/8/2B1K3 w - - 0 1', 'f4', 'Slide and gobble the bishop!'),
  cap('c9', '4k3/8/8/8/2r5/3P4/8/4K3 w - - 0 1', 'c4', 'Can the pawn gobble the rook?'),
  cap('c10', '4k3/8/3n4/8/4N3/8/8/4K3 w - - 0 1', 'd6', 'Knight eats knight!'),
  cap('c11', '4k3/8/8/8/8/8/3q4/4K3 w - - 0 1', 'd2', 'The king can gobble too!'),
  cap('c12', 'r3k3/8/8/8/8/8/8/Q3K3 w - - 0 1', 'a8', 'Zoom all the way and gobble!'),
  mate('m1', '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1', 'The king is stuck behind his pawns. Checkmate!'),
  mate('m2', '7k/6pp/8/8/8/8/8/R5K1 w - - 0 1', 'The king is stuck behind his pawns. Checkmate!'),
  mate('m3', 'k7/8/1K6/8/8/8/8/2R5 w - - 0 1'),
  mate('m4', '7k/8/6K1/8/8/8/8/1R6 w - - 0 1'),
  mate('m5', 'k7/8/K7/8/8/8/8/1Q6 w - - 0 1', "The queen's kiss! Find checkmate."),
  mate('m6', '4k3/8/4K3/8/8/8/8/R7 w - - 0 1'),
  mate('m7', '3k4/8/3K4/8/8/8/8/7Q w - - 0 1'),
  mate('m8', 'k7/8/2K5/8/8/8/8/1Q6 w - - 0 1', "The queen's kiss! Find checkmate."),
];

export type Daily = { kind: 'hand'; item: FindMoveItem & ItemMeta } | { kind: 'db'; puzzle: Puzzle };

/** The database pool for a band's daily puzzle (sorted by id, so the choice is stable). */
export function dailyPool(band: AgeBand, pool: Puzzle[] = ALL): Puzzle[] {
  const list = band === 'explorer' ? eligible(['mateIn1', 'hangingPiece'], 800, 'explorer', pool) : eligible([], 1200, 'champion', pool).filter((p) => !p.themes.some((t) => t === 'long' || t === 'veryLong'));
  return list.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Today's puzzle for a band: seeded by hashSeed(day, band), so siblings in a band share it. */
export function dailyPuzzle(band: AgeBand, day: string = dayKey(), hand: FM[] = SPROUT_DAILY): Daily {
  const rng = mulberry32(hashSeed(day, band));
  if (band === 'sprout') return { kind: 'hand', item: hand[Math.floor(rng() * hand.length)] };
  const pool = dailyPool(band);
  return { kind: 'db', puzzle: pool[Math.floor(rng() * pool.length)] };
}

export { dayKey };
