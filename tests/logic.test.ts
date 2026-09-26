import { describe, expect, it } from 'vitest';
import { glicko, RD_FLOOR } from '../src/lib/rating';
import { review, INTERVALS, DAY } from '../src/lib/srs';
import { classify, moveAccuracy, summarize } from '../src/lib/analysis';
import { diffPieces, parsePlacement } from '../src/chess/pieces';
import { goCommand, parseInfo, scoreToCp, winPercent } from '../src/engine/score';
import { acceptsMove, drawReason, moveNumberLabel, nullMoveFen, START_FEN, takeBackTo } from '../src/chess/utils';
import { normalizeProfile, playerWon } from '../src/store/profile';
import { Chess } from 'chess.js';

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

describe('chess helpers', () => {
  it('takes back to before the given side\'s last move', () => {
    const c = new Chess();
    const moves = ['e4', 'e5', 'Nf3', 'Nc6'].map((m) => c.move(m));
    expect(takeBackTo(moves, 'w')).toBe(2); // undo Nf3 and the reply
    expect(takeBackTo(moves.slice(0, 3), 'w')).toBe(2); // undo Nf3 only
    expect(takeBackTo(moves.slice(0, 1), 'b')).toBe(0);
  });
  it('accepts the expected move or any mate', () => {
    const mateIn1 = new Chess('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
    const mate = mateIn1.move('Ra8');
    const quiet = new Chess('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1').move('Kf1');
    expect(acceptsMove(mate, ['h2h3'])).toBe(true);
    expect(acceptsMove(quiet, ['g1f1'])).toBe(true);
    expect(acceptsMove(quiet, ['a1a8'])).toBe(false);
  });
  it('flips the side to move for threat checks', () => {
    expect(nullMoveFen('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2')).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2');
  });
  it('names draws', () => {
    expect(drawReason(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toBe('Stalemate');
    expect(drawReason(new Chess('8/8/8/4k3/8/8/2K5/8 w - - 0 1'))).toBe('Insufficient material');
  });
  it('labels move numbers', () => {
    expect(moveNumberLabel(0)).toBe('1.');
    expect(moveNumberLabel(3)).toBe('2...');
    expect(moveNumberLabel(0, 12, 'b')).toBe('12...');
  });
});

describe('engine score helpers', () => {
  it('parses info lines and skips bound scores', () => {
    const l = parseInfo('info depth 12 seldepth 18 multipv 2 score cp -35 nodes 1000 pv e7e5 g1f3');
    expect(l).toEqual({ multipv: 2, depth: 12, score: { cp: -35 }, pv: ['e7e5', 'g1f3'] });
    expect(parseInfo('info depth 12 score mate 3 pv a1a8')?.score).toEqual({ mate: 3 });
    expect(parseInfo('info depth 12 score cp 20 lowerbound pv e2e4')).toBeNull();
  });
  it('orders mates beyond any centipawn score', () => {
    expect(scoreToCp({ mate: 1 })).toBeGreaterThan(scoreToCp({ mate: 3 }));
    expect(scoreToCp({ mate: 3 })).toBeGreaterThan(scoreToCp({ cp: 5000 }));
    expect(scoreToCp({ mate: -2 })).toBeLessThan(scoreToCp({ cp: -5000 }));
  });
  it('builds go commands with a fallback depth', () => {
    expect(goCommand({ depth: 12 })).toBe('go depth 12');
    expect(goCommand({}, 14)).toBe('go depth 14');
    expect(goCommand({ movetime: 500, searchmoves: ['e2e4'] })).toBe('go movetime 500 searchmoves e2e4');
  });
});

describe('profile', () => {
  it('fills fields missing from older saves without announcing old levels', () => {
    const p = normalizeProfile({ xp: 5000, settings: { sound: false } as never });
    expect(p.settings.boardTheme).toBe('slate');
    expect(p.settings.sound).toBe(false);
    expect(p.puzzles.rushBest).toBe(0);
    expect(p.streak.best).toBe(0);
    expect(p.levelSeen).toBeGreaterThan(1);
  });
  it('knows who won', () => {
    expect(playerWon({ result: '0-1', playerColor: 'b' })).toBe(true);
    expect(playerWon({ result: '1-0', playerColor: 'b' })).toBe(false);
    expect(playerWon({ result: '1/2-1/2', playerColor: 'w' })).toBe(false);
  });
});
