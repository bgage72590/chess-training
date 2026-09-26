import { describe, expect, it } from 'vitest';
import { glicko, RD_FLOOR } from '../src/lib/rating';
import { review, INTERVALS, DAY } from '../src/lib/srs';
import { classify, moveAccuracy, summarize } from '../src/lib/analysis';
import { diffPieces, parsePlacement } from '../src/chess/pieces';
import { winPercent } from '../src/engine/engine';
import { START_FEN } from '../src/chess/utils';

describe('glicko puzzle rating', () => {
  it('rises after a win and falls after a loss', () => {
    expect(glicko(1200, 200, 1200, 1).r).toBeGreaterThan(1200);
    expect(glicko(1200, 200, 1200, 0).r).toBeLessThan(1200);
  });
  it('rewards beating a harder puzzle more than an easier one', () => {
    const hard = glicko(1200, 150, 1600, 1).r - 1200;
    const easy = glicko(1200, 150, 800, 1).r - 1200;
    expect(hard).toBeGreaterThan(easy);
  });
  it('shrinks the deviation but never below the floor', () => {
    let s = { r: 1200, rd: 250 };
    for (let i = 0; i < 200; i++) s = glicko(s.r, s.rd, 1200, (i % 2) as 0 | 1);
    expect(s.rd).toBe(RD_FLOOR);
  });
});

describe('spaced repetition', () => {
  it('moves a card up one box per correct review', () => {
    const now = 1_000_000;
    const a = review(undefined, true, now);
    expect(a.box).toBe(1);
    const b = review(a, true, now);
    expect(b.box).toBe(2);
    expect(b.due).toBeGreaterThan(now + (INTERVALS[2] - 1) * DAY);
  });
  it('sends a missed card back to box 1, due again within minutes', () => {
    const now = 1_000_000;
    const c = review({ box: 4, due: now }, false, now);
    expect(c.box).toBe(1);
    expect(c.due - now).toBeLessThanOrEqual(15 * 60 * 1000);
  });
});

describe('game analysis', () => {
  it('classifies moves by lost win chance', () => {
    expect(classify(0, true)).toBe('best');
    expect(classify(3, false)).toBe('good');
    expect(classify(8, false)).toBe('inaccuracy');
    expect(classify(15, false)).toBe('mistake');
    expect(classify(40, false)).toBe('blunder');
  });
  it('gives 100% accuracy for no loss and less for large losses', () => {
    expect(Math.round(moveAccuracy(0))).toBe(100);
    expect(moveAccuracy(30)).toBeLessThan(40);
  });
  it('summarises a game from White-POV evals', () => {
    // White plays the best move, Black then drops a queen's worth of evaluation.
    const evals = [{ cp: 20 }, { cp: 30 }, { cp: 900 }];
    const { classes, accuracy } = summarize(evals, ['e2e4', 'e7e5'], ['e2e4', 'g8f6']);
    expect(classes).toEqual(['best', 'blunder']);
    expect(accuracy.w).toBeGreaterThan(accuracy.b);
  });
  it('maps mate scores to certain wins and losses', () => {
    expect(winPercent({ mate: 3 })).toBe(100);
    expect(winPercent({ mate: -2 })).toBe(0);
    expect(Math.round(winPercent({ cp: 0 }))).toBe(50);
  });
});

describe('board piece identity', () => {
  it('keeps the moving piece identity so it can animate', () => {
    const before = diffPieces([], parsePlacement(START_FEN));
    const knight = before.find((p) => p.square === 'g1')!;
    const after = diffPieces(before, parsePlacement('rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1'), ['g1', 'f3']);
    expect(after.find((p) => p.square === 'f3')!.id).toBe(knight.id);
    expect(after).toHaveLength(32);
  });
  it('tracks both pieces when castling', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const before = diffPieces([], parsePlacement(fen));
    const rook = before.find((p) => p.square === 'h1')!;
    const after = diffPieces(before, parsePlacement('r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1'), ['e1', 'g1']);
    expect(after.find((p) => p.square === 'f1')!.id).toBe(rook.id);
  });
});
