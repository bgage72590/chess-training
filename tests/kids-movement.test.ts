// Pack A (Movement and Vision) tests: spec 13.3-13.6 verified answers, validation and generators.
import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import type { AgeBand, Placement } from '../src/kids/activities/types';
import { LEVEL_SETS, PLAYGROUND, ACTIVITIES } from '../src/kids/packs';
import { BANDS } from '../src/kids/curriculum/tuning';
import { gobbleSolutions, attacks, placementFen } from '../src/kids/lib/miniRules';
import { fenPlacement } from '../src/kids/lib/fen';
import { mulberry32 } from '../src/kids/lib/rng';
import { isLight, lineSquares, reviewBoardVision, setupTargets, START_FEN, validateBoardVision, setupTip } from '../src/kids/activities/boardVision/logic';
import { paintTargets, paintBoard, paintPiece, reviewPaint, validatePaint, type PaintItem } from '../src/kids/activities/paint/logic';
import { reviewGobble, soloSolutions, validateGobble, type EatItem } from '../src/kids/activities/gobble/logic';
import { memoryMoveOk, memoryScore, reviewMemory, validateMemory } from '../src/kids/activities/memory/logic';
import { movementPack } from '../src/kids/content/movement';

const sorted = (a: string[]) => [...a].sort();
const pawns = (...sqs: string[]): Placement => Object.fromEntries(sqs.map((s) => [s, 'p']));

/** chess.js cross-check: add both kings off the piece's lines, then compare its legal moves. */
function chessJsTargets(item: PaintItem): string[] | null {
  const board = paintBoard(item);
  const [from, piece] = paintPiece(item)!;
  const occ = new Set(Object.keys(board));
  const reach = new Set([...attacks(piece, from, occ), ...paintTargets(item), from]);
  const free = 'abcdefgh'.split('').flatMap((f) => '12345678'.split('').map((r) => f + r)).filter((s) => !occ.has(s) && !reach.has(s));
  for (const wk of piece === 'K' ? [from] : free)
    for (const bk of free) {
      if (wk === bk || Math.abs(wk.charCodeAt(0) - bk.charCodeAt(0)) <= 1 && Math.abs(+wk[1] - +bk[1]) <= 1) continue;
      let c: Chess;
      try {
        c = new Chess(placementFen({ ...board, [wk]: 'K', [bk]: 'k' } as Placement));
      } catch {
        continue;
      }
      if (c.inCheck() || c.isAttacked(bk as never, 'w')) continue;
      return c.moves({ square: from as never, verbose: true }).map((m) => m.to);
    }
  return null;
}

describe('paint (spec 13.4 verified answers)', () => {
  const cases: [PaintItem, number, string[]?][] = [
    [{ pieces: { d4: 'R' } }, 14],
    [{ pieces: { d4: 'B' }, blockers: ['f6'], enemies: { b2: 'p' } }, 9, ['e5', 'e3', 'f2', 'g1', 'c5', 'b6', 'a7', 'c3', 'b2']],
    [{ pieces: { b1: 'N' } }, 3, ['c3', 'd2', 'a3']],
    [{ pieces: { e2: 'P' }, enemies: { d3: 'n', e3: 'p' } }, 1, ['d3']],
    [{ pieces: { d4: 'N' } }, 8],
    [{ pieces: { a1: 'N' } }, 2, ['b3', 'c2']],
    [{ pieces: { d1: 'Q' }, blockers: ['d2', 'e2', 'c2'] }, 7],
    [{ pieces: { e1: 'K' } }, 5],
    [{ pieces: { c1: 'B' }, blockers: ['b2'] }, 5],
    [{ pieces: { h1: 'R' }, blockers: ['h4'], enemies: { c1: 'b' } }, 7, ['g1', 'f1', 'e1', 'd1', 'c1', 'h2', 'h3']],
  ];
  for (const [item, n, sqs] of cases)
    it(`${JSON.stringify(item)} gives ${n}`, () => {
      const t = paintTargets(item);
      expect(t.length).toBe(n);
      if (sqs) expect(sorted(t)).toEqual(sorted(sqs));
      expect(validatePaint(item, 'explorer')).toEqual([]);
    });
  it('every paint item in the content matches chess.js', () => {
    for (const set of movementPack.levelSets.filter((s) => s.activity === 'paint'))
      for (const item of set.items as PaintItem[]) {
        const cj = chessJsTargets(item);
        expect(cj, `${set.id} ${JSON.stringify(item)}`).not.toBeNull();
        expect(sorted(paintTargets(item)), `${set.id}`).toEqual(sorted(cj!));
      }
  });
  it('validate rejects two white pieces and pieces with nowhere to go', () => {
    expect(validatePaint({ pieces: { a1: 'R', b1: 'N' } }, 'explorer')).not.toEqual([]);
    expect(validatePaint({ pieces: { a1: 'R' }, blockers: ['a2', 'b1'] }, 'explorer')).toContain('no squares to paint');
  });
});

describe('gobble (spec 13.5 verified solution counts)', () => {
  const cases: [EatItem, number][] = [
    [{ pieces: { a1: 'R' }, targets: { a5: 'p', e5: 'n', e8: 'b' } }, 1],
    [{ pieces: { a1: 'R' }, targets: pawns('a4', 'd4', 'd7', 'g7', 'g1') }, 2],
    [{ pieces: { b1: 'N' }, targets: pawns('c3', 'd5', 'f6', 'e4') }, 2],
    [{ pieces: { b1: 'N' }, targets: pawns('c3', 'e4', 'g5', 'e6') }, 1],
    [{ pieces: { a1: 'N' }, targets: pawns('b3', 'd4', 'c6') }, 1],
    [{ pieces: { d1: 'Q' }, targets: pawns('d4', 'a7', 'g4', 'g7', 'b4') }, 3],
    [{ pieces: { d1: 'Q' }, targets: { d4: 'p', g7: 'n', g2: 'b', b2: 'r' } }, 4],
    [{ pieces: { c1: 'B' }, targets: pawns('e3', 'g5', 'd8', 'a5') }, 1],
    [{ pieces: { c1: 'B' }, targets: pawns('e3', 'g5', 'd8') }, 1],
    [{ pieces: { a1: 'R' }, targets: pawns('a3', 'c3'), area: 'a1:d4' }, 1],
    [{ pieces: { c1: 'B' }, targets: pawns('b2', 'a3'), area: 'a1:d4' }, 1],
    [{ pieces: { e2: 'P' }, targets: pawns('d3', 'e4', 'd5') }, 1],
    [{ pieces: { c2: 'P' }, targets: pawns('d3', 'e4', 'd5', 'c6', 'd7') }, 1],
    [{ pieces: { f2: 'P' }, targets: { g3: 'n', f4: 'p', e5: 'b', d6: 'r' } }, 1],
    [{ pieces: { b2: 'P' }, targets: { ...pawns('c3', 'b4', 'c5', 'd6', 'c7'), b8: 'n' } }, 1],
  ];
  for (const [item, n] of cases) it(`${JSON.stringify(item)} has ${n}`, () => expect(gobbleSolutions(item).length).toBe(n));
  it('bite: the queen must eat h5, c5, then d4', () => {
    expect(gobbleSolutions({ pieces: { d1: 'Q' }, targets: pawns('c5', 'h5', 'd4'), bite: true })).toEqual([['h5', 'c5', 'd4']]);
  });
  it('every bite item really needs the bite rule and has a solution', () => {
    const set = LEVEL_SETS.get('w6-bite')!;
    expect(set.items.length).toBeGreaterThanOrEqual(6);
    for (const it of set.items as EatItem[]) {
      expect(it.bite).toBe(true);
      expect(gobbleSolutions(it).length).toBeGreaterThanOrEqual(1);
    }
  });
  it('solo: verified counts, and the counter-example fails validate', () => {
    expect(soloSolutions({ a1: 'R', a5: 'B', e5: 'N' }, 1000)).toEqual([[['a1', 'a5'], ['a5', 'e5']]]);
    expect(soloSolutions({ d1: 'K', a2: 'R', c2: 'B' }, 1000)).toEqual([[['a2', 'c2'], ['d1', 'c2']]]);
    expect(soloSolutions({ c1: 'R', c5: 'B', e3: 'N', d4: 'P', a3: 'Q' }, 1000).length).toBe(17);
    expect(validateGobble({ mode: 'solo', pieces: { b2: 'N', d3: 'B', c4: 'R', f6: 'Q' } }, 'champion')).toContain('solo: no solution');
  });
  it('validate rejects unsolvable and malformed items', () => {
    expect(validateGobble({ pieces: { a1: 'R' }, targets: pawns('b2') }, 'explorer')).toContain('no solution');
    expect(validateGobble({ pieces: { a1: 'R' }, targets: { a5: 'P' } }, 'explorer')).toContain('targets must be black');
  });
});

describe('board vision (spec 13.3)', () => {
  it('colors and lines', () => {
    expect(isLight('a1')).toBe(false);
    expect(isLight('h1')).toBe(true);
    expect(lineSquares('a1', 'file')).toHaveLength(8);
    expect(lineSquares('d4', 'rank')).toHaveLength(8);
    expect(sorted(lineSquares('c1', 'diagonal'))).toEqual(sorted(['c1', 'd2', 'e3', 'f4', 'g5', 'h6']));
  });
  it('setup targets rebuild the real start position (chess.js)', () => {
    const start = fenPlacement(new Chess().fen());
    const both = setupTargets('RNBQKBNR/PPPPPPPP');
    for (const [s, p] of Object.entries(both)) expect(start[s], s).toBe(p);
    expect(Object.keys(both)).toHaveLength(16);
    expect(setupTargets('R R')).toEqual({ a1: 'R', h1: 'R' });
    expect(setupTargets('RNBQKBNR').d1).toBe('Q');
    for (const p of 'RNBQKP') expect(setupTip(p as never, true)).not.toMatch(/\b(left|right)\b/i);
  });
  it('the army FEN is the legal start position', () => {
    expect(new Chess(START_FEN).fen()).toBe(new Chess().fen());
  });
  it('validate catches bad items', () => {
    expect(validateBoardVision({ kind: 'name-piece', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', ask: 'q' }, 'explorer')).toContain('fen lacks the asked piece');
    expect(validateBoardVision({ kind: 'setup', pieces: 'RNBX' }, 'explorer')).not.toEqual([]);
    expect(validateBoardVision({ kind: 'tap-line', through: 'c1', line: 'diagonal' }, 'sprout')).not.toEqual([]);
    expect(validateBoardVision({ kind: 'tap-line', through: 'a1', line: 'file', say: 'Tap a1!' }, 'sprout')).toContain('sprout text contains a square name');
    expect(validateBoardVision({ kind: 'find-square', squares: ['z9'], rounds: 2 }, 'explorer')).toContain('bad squares');
  });
});

describe('memory (spec 13.6)', () => {
  it('scores first-try placements', () => {
    expect(memoryScore(4, 4)).toBe(3);
    expect(memoryScore(10, 7)).toBe(2);
    expect(memoryScore(4, 2)).toBe(1);
  });
  it('spec items validate; what-moved moves follow the piece rules', () => {
    expect(validateMemory({ mode: 'rebuild', pieces: { d4: 'N', f6: 'p' }, showMs: 6000 }, 'explorer')).toEqual([]);
    expect(validateMemory({ mode: 'rebuild', pieces: { e1: 'K', d8: 'q', c3: 'N', g7: 'b' }, showMs: 6000 }, 'explorer')).toEqual([]);
    expect(memoryMoveOk({ d4: 'N', f6: 'p' }, ['d4', 'f5'])).toBe(true);
    expect(memoryMoveOk({ d4: 'N', f6: 'p' }, ['d4', 'd5'])).toBe(false);
    expect(validateMemory({ mode: 'what-moved', pieces: { a1: 'R', a3: 'P' }, move: ['a1', 'a5'], showMs: 5000 }, 'champion')).toContain('illegal move');
  });
});

describe('generators and registry', () => {
  it('review() output always validates', () => {
    const rng = mulberry32(11);
    for (const band of BANDS as AgeBand[])
      for (let i = 0; i < 20; i++) {
        expect(validateBoardVision(reviewBoardVision(rng, band), band)).toEqual([]);
        expect(validatePaint(reviewPaint(rng, band), band)).toEqual([]);
        expect(validateGobble(reviewGobble(rng, band), band)).toEqual([]);
        expect(validateMemory(reviewMemory(rng, band), band)).toEqual([]);
      }
  });
  it('every Pack A level set is registered', () => {
    const ids = ['w1-roads', 'w1-colors', 'w1-rook-paint', 'w1-rook-gobble', 'w2-bishop-paint', 'w2-bishop-gobble', 'w2-treasure-map', 'w3-queen-paint', 'w3-queen-gobble', 'w4-knight-paint', 'w4-knight-gobble', 'w5-pawn-slant', 'w5-army', 'w5-setup', 'w6-bite'];
    for (const id of ids) expect(LEVEL_SETS.get(id)?.activity, id).toBeTruthy();
  });
  it('playground items validate for their bands', () => {
    for (const e of PLAYGROUND.filter((p) => ['coord-dash', 'last-piece', 'magic-memory'].includes(p.id))) {
      const act = ACTIVITIES.get(e.activity)!;
      if (e.item === 'review') expect(act.review).toBeTruthy();
      else for (const b of e.bands ?? BANDS) expect(act.validate(e.item as never, b), e.id).toEqual([]);
    }
  });
});
