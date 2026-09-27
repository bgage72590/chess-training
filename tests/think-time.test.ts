import { describe, expect, it } from 'vitest';
import { thinkTimeMs } from '../src/lib/thinkTime';

const MIDDLEGAME = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N2N2/PP2BPPP/R2QKB1R w KQ - 0 9';

describe('coach thinking time', () => {
  it('stays between about half a second and under three seconds', () => {
    for (const rnd of [0, 0.5, 1]) {
      const ms = thinkTimeMs({ fen: MIDDLEGAME, moveNumber: 12, rnd });
      expect(ms).toBeGreaterThanOrEqual(550);
      expect(ms).toBeLessThanOrEqual(2600);
    }
  });

  it('is quicker in the opening, on recaptures and with one legal move', () => {
    const think = thinkTimeMs({ fen: MIDDLEGAME, moveNumber: 12, rnd: 0.5 });
    expect(thinkTimeMs({ fen: MIDDLEGAME, moveNumber: 2, rnd: 0.5 })).toBeLessThan(think);
    expect(thinkTimeMs({ fen: MIDDLEGAME, moveNumber: 12, afterCapture: true, rnd: 0.5 })).toBeLessThan(think);
    expect(thinkTimeMs({ fen: '7k/8/8/8/8/8/5q2/7K w - - 0 1', moveNumber: 30, rnd: 0.5 })).toBeLessThan(800);
  });
});
