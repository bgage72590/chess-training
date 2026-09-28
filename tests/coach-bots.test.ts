// The coach's bot levels (Play.tsx): Improver and Club are Olive with root noise for human slips.
import { describe, expect, it, vi } from 'vitest';
import { Chess, type Move } from 'chess.js';

vi.mock('../src/engine/engine', () => ({ engine: { status: 'failed' } }));

import { LEVELS } from '../src/pages/Play';
import { oliveMove } from '../src/kids/activities/playBot/kidBot';
import { mulberry32 } from '../src/kids/lib/rng';

/** Flank thrusts (a/h pawn to the 4th or 5th, g/b double steps, f3 or f6), rim knights and king walks. */
function ugly(m: Move): boolean {
  const rank = Number(m.to[1]);
  const file = m.from[0];
  if (m.piece === 'p') {
    if ('ah'.includes(file) && (rank === 4 || rank === 5)) return true;
    if ('gb'.includes(file) && Math.abs(rank - Number(m.from[1])) === 2) return true;
    if (file === 'f' && (rank === 3 || rank === 6)) return true;
  }
  if (m.piece === 'n' && 'ah'.includes(m.to[0])) return true;
  return m.piece === 'k' && !m.san.startsWith('O-O');
}

describe('coach bots', () => {
  for (const n of [4, 5]) {
    it(`level ${n} opens like a club player, not at random`, { timeout: 60000 }, () => {
      const bot = LEVELS[n - 1].bot;
      if (bot?.kind !== 'olive') throw new Error(`level ${n} is not Olive`);
      const bad: string[] = [];
      for (const start of [[], ['e4'], ['d4']]) {
        for (let seed = 1; seed <= 6; seed++) {
          const c = new Chess();
          for (const san of start) c.move(san);
          const m = oliveMove(c, mulberry32(seed), bot);
          if (ugly(m)) bad.push([...start, m.san].join(' '));
        }
      }
      expect(bad).toEqual([]);
    });
  }
});
