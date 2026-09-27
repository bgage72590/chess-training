// Pack E (Puzzles and Tactics): every hand puzzle is checked with chess.js, the database picker
// follows spec 13.13, and Puzzle of the Day is deterministic per date and band.
import { describe, expect, it } from 'vitest';
import { Chess, type Square } from 'chess.js';
import type { AgeBand, ItemMeta } from '../src/kids/activities/types';
import { LEVEL_SETS, PACKS, PLAYGROUND } from '../src/kids/packs';
import { FORKS, W8_FORKS, W8_MATE_HUNT, W8_PINS, W8_THREATS, tacticsPack } from '../src/kids/content/tactics';
import { checkFork, dbAccepts, forkTargets, pzMoves, validatePuzzleLine, validatePuzzles, type PuzzleItem } from '../src/kids/activities/puzzles/logic';
import { eligible, pick } from '../src/kids/activities/puzzles/kidPuzzles';
import { dailyPool, dailyPuzzle, SPROUT_DAILY } from '../src/kids/activities/puzzles/daily';
import { solutions, validateFindMove, meetsGoal, legalMoves, type FindMoveItem } from '../src/kids/activities/findMove/logic';
import { hangs } from '../src/kids/lib/danger';
import { puzzles } from '../src/data/puzzles';
import { mulberry32 } from '../src/kids/lib/rng';
import { visibleTo } from '../src/kids/curriculum/tuning';

const BANDS: AgeBand[] = ['sprout', 'explorer', 'champion'];
type PI = PuzzleItem & ItemMeta;
const lineOf = (it: PI) => (it.source === 'hand' ? it.items[0] : null)!;
const san = (fen: string, uci: string) => new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4) }).san;

describe('pack registration', () => {
  it('registers the puzzles activity, four level sets and three playground tiles', () => {
    expect(PACKS).toContain(tacticsPack);
    for (const id of ['w8-mate-hunt', 'w8-forks', 'w8-pins', 'w8-threats']) expect(LEVEL_SETS.has(id), id).toBe(true);
    for (const id of ['puzzle-day', 'puzzle-trio', 'puzzle-streak']) expect(PLAYGROUND.some((p) => p.id === id), id).toBe(true);
  });
  it('every playground item validates for its bands', () => {
    for (const e of tacticsPack.playground!) for (const b of e.bands ?? BANDS) expect(validatePuzzles(e.item as PI, b), e.id).toEqual([]);
  });
  it('every node set has items for each band it serves', () => {
    const count = (set: { items: ItemMeta[] }, b: AgeBand) => set.items.filter((i) => visibleTo(i, b)).length;
    for (const b of BANDS) expect(count(W8_MATE_HUNT, b), b).toBeGreaterThanOrEqual(3);
    for (const b of ['explorer', 'champion'] as AgeBand[]) {
      expect(count(W8_FORKS, b)).toBe(20);
      expect(count(W8_THREATS, b)).toBe(8);
    }
    expect(count(W8_PINS, 'champion')).toBe(6);
  });
});

describe('w8-mate-hunt (Sprout hand mates)', () => {
  const hand = W8_MATE_HUNT.items.filter((i) => i.source === 'hand') as PI[];
  it('has the 3 spec mates, each a real mate in one with a queen', () => {
    expect(hand.map((i) => lineOf(i).fen.split(' ')[0])).toEqual(['k7/2Q5/2K5/8/8/8/8/8', 'k7/8/1K6/8/8/8/8/7Q', '7k/8/6K1/8/8/8/8/Q7']);
    const want = [['Qb7#'], ['Qb7#', 'Qh8#'], ['Qa8#', 'Qg7#']];
    hand.forEach((it, i) => {
      const fm = lineOf(it);
      expect(validateFindMove(fm, 'sprout')).toEqual([]);
      const sols = solutions(fm.fen, fm.goal);
      expect(sols.map((m) => m.san).sort()).toEqual(want[i]);
      for (const m of sols) expect(m.piece).toBe('q');
    });
  });
});

describe('w8-forks: 20 hand-authored forks', () => {
  it('there are exactly 20, all different', () => {
    expect(FORKS.length).toBe(20);
    expect(new Set(FORKS.map((f) => lineOf(f).fen)).size).toBe(20);
    expect(new Set(FORKS.map((f) => f.id)).size).toBe(20);
  });
  for (const f of FORKS) {
    it(`${f.id} is a real fork`, () => {
      const fm = lineOf(f);
      expect(fm.goal.kind).toBe('line');
      const uci = (fm.goal as { uci: string[] }).uci;
      expect(uci.length).toBe(3);
      // Legal position and a legal line.
      expect(validateFindMove(fm, 'explorer')).toEqual([]);
      // The spec validator: not a big capture, not mate, 2+ king-or-valuable targets, gain of 2+.
      const r = checkFork(fm.fen, uci);
      expect(r.errs).toEqual([]);
      expect(r.gain).toBeGreaterThanOrEqual(2);
      // The final kid move captures one of the forked pieces.
      const c = new Chess(fm.fen);
      const m1 = c.move({ from: uci[0].slice(0, 2), to: uci[0].slice(2, 4) });
      const targets = forkTargets(c, m1.to as Square);
      c.move({ from: uci[1].slice(0, 2), to: uci[1].slice(2, 4) });
      const m3 = c.move({ from: uci[2].slice(0, 2), to: uci[2].slice(2, 4) });
      expect(m3.captured).toBeTruthy();
      expect(targets).toContain(m3.to);
      expect(m3.from).toBe(m1.to);
    });
  }
  it('the spec seeds keep their spec lines', () => {
    const seeds: [string, string[]][] = [
      ['r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', ['b5c7', 'e8d7', 'c7a8']],
      ['q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', ['b5c7', 'e8d7', 'c7a8']],
      ['4k3/8/8/1q6/4N3/8/8/4K3 w - - 0 1', ['e4d6', 'e8e7', 'd6b5']],
      ['4k3/8/8/1r6/4N3/8/8/4K3 w - - 0 1', ['e4d6', 'e8e7', 'd6b5']],
      ['r5k1/8/8/8/8/8/8/4K2Q w - - 0 1', ['h1d5', 'g8h8', 'd5a8']],
      ['r3k3/8/8/8/8/8/8/2Q1K3 w - - 0 1', ['c1c6', 'e8e7', 'c6a8']],
      ['3k4/8/8/8/6b1/8/8/4K2Q w - - 0 1', ['h1h4', 'd8c8', 'h4g4']],
    ];
    for (const [fen, uci] of seeds) expect(FORKS.some((f) => lineOf(f).fen === fen && JSON.stringify((lineOf(f).goal as { uci: string[] }).uci) === JSON.stringify(uci)), fen).toBe(true);
  });
  it('the fork validator rejects non-forks', () => {
    // A quiet knight move that attacks only one piece.
    expect(checkFork('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', ['b5d4', 'e8d7', 'd4c6']).errs.length).toBeGreaterThan(0);
    // A queen "fork" that just hangs the queen.
    expect(checkFork('1k6/8/8/8/8/8/7r/2Q1K3 w - - 0 1', ['c1b2', 'h2b2', 'e1f1']).errs.some((e) => e.includes('gain'))).toBe(true);
    // A pawn fork the black pieces refute (spec: pawn forks must be checked).
    expect(checkFork('4k3/8/8/2n1r3/8/8/3P4/3K4 w - - 0 1', ['d2d4', 'e5d5', 'd1c2']).errs.length).toBeGreaterThan(0);
  });
  it('validate() catches a broken fork item', () => {
    const bad: PI = { source: 'hand', tactic: 'fork', items: [{ fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', goal: { kind: 'line', uci: ['b5d4', 'e8d7', 'd4c6'] } }] };
    expect(validatePuzzles(bad, 'explorer').length).toBeGreaterThan(0);
  });
});

describe('w8-threats (no-hang)', () => {
  const items = W8_THREATS.items as (FindMoveItem & ItemMeta)[];
  for (const t of items) {
    it(`${t.id}: a piece hangs, some moves save it and some do not`, () => {
      expect(validateFindMove(t, 'explorer')).toEqual([]);
      expect(t.goal.kind).toBe('no-hang');
      // A valuable white piece is under attack; the five Pack E ones really hang (spec: t4-t8).
      const c = new Chess(t.fen);
      const attacked = c.board().flat().some((x) => x && x.color === 'w' && 'nbrq'.includes(x.type) && c.isAttacked(x.square, 'b'));
      expect(attacked).toBe(true);
      if (!['t1', 't2', 't3'].includes(t.id!)) expect(hangs(t.fen, 'w').some((h) => h.loss >= 3)).toBe(true);
      const legal = legalMoves(t.fen);
      const pass = legal.filter((m) => meetsGoal(t.fen, m, t.goal));
      expect(pass.length).toBeGreaterThanOrEqual(1);
      expect(legal.length - pass.length).toBeGreaterThanOrEqual(1);
    });
  }
  const ok = (fen: string) => new Set(solutions(fen, { kind: 'no-hang' }).map((m) => m.san));
  it('matches the spec examples', () => {
    const a = ok('4k3/8/8/8/3n4/8/2R5/4K3 w - - 0 1');
    for (const s of ['Kd2', 'Kd1']) expect(a.has(s), s).toBe(true);
    for (const s of ['Rc6', 'Kf2', 'Kf1']) expect(a.has(s), s).toBe(false);
    const b = ok('4k3/8/8/8/8/4b3/8/2N1K2R w - - 0 1');
    for (const s of ['Kd1', 'Ke2', 'Rh8+', 'Nb3']) expect(b.has(s), s).toBe(true);
    for (const s of ['Kf1', 'Rh4', 'Rg1', 'Rf1']) expect(b.has(s), s).toBe(false);
    const c = ok('4k3/8/8/6b1/8/8/3N4/4K3 w - - 0 1');
    for (const s of ['Ke2', 'Kd1', 'Nf3']) expect(c.has(s), s).toBe(true);
    for (const s of ['Kf2', 'Kf1']) expect(c.has(s), s).toBe(false);
  });
  it('the authored ones behave as intended', () => {
    expect(ok('4k3/8/8/8/8/2n5/R7/4K3 w - - 0 1').has('Ra4')).toBe(false);
    expect(ok('4k3/8/8/8/8/2n5/R7/4K3 w - - 0 1').has('Rb2')).toBe(true);
    expect(ok('4k3/8/8/3p4/4B3/8/8/4K3 w - - 0 1').has('Bxd5')).toBe(true);
    expect(ok('4k3/8/8/8/2n5/8/3Q4/4K3 w - - 0 1').has('Qe3')).toBe(false);
    expect(ok('4k3/8/8/2b5/8/8/5R2/K7 w - - 0 1').has('Rf8+')).toBe(false);
    expect(ok('4k3/8/8/2b5/8/8/5R2/K7 w - - 0 1').has('Rb2')).toBe(true);
  });
});

describe('database puzzles', () => {
  const count = (theme: string, max: number) => puzzles.filter((p) => p.themes.includes(theme) && p.rating <= max).length;
  it('pool counts match spec 13.13', () => {
    expect([count('mateIn1', 700), count('mateIn1', 800), count('mateIn1', 1000)]).toEqual([54, 128, 151]);
    expect([count('hangingPiece', 700), count('hangingPiece', 800), count('hangingPiece', 1000)]).toEqual([51, 217, 271]);
    expect(count('pin', 1100)).toBe(47);
    expect(count('fork', 1100)).toBe(4);
    expect(Math.min(...puzzles.map((p) => p.rating))).toBe(540);
  });
  it('every puzzle a level set or tile can pick has a legal line', () => {
    const sets: [string[], number, AgeBand][] = [
      [['mateIn1'], 800, 'explorer'],
      [['mateIn1'], 1000, 'champion'],
      [['pin'], 1100, 'champion'],
      [[], 3000, 'explorer'],
      [[], 3000, 'champion'],
    ];
    for (const [t, max, band] of sets) for (const p of eligible(t, max, band)) expect(validatePuzzleLine(p)).toEqual([]);
  });
  it('the level sets pick from pools big enough for a run', () => {
    expect(eligible(['mateIn1'], 800, 'explorer').length).toBeGreaterThanOrEqual(15);
    expect(eligible(['mateIn1'], 1000, 'champion').length).toBeGreaterThanOrEqual(18);
    expect(eligible(['pin'], 1100, 'champion').length).toBe(47);
  });
  it('pick() filters by theme, cap, band and length', () => {
    for (const band of ['explorer', 'champion'] as AgeBand[])
      for (let s = 0; s < 20; s++) {
        const got = pick({ themes: ['mateIn1', 'hangingPiece'], maxRating: 900, band, rating: 700 + s * 20, count: 5, rng: mulberry32(s) });
        expect(got.length).toBe(5);
        for (const p of got) {
          expect(p.rating).toBeLessThanOrEqual(900);
          expect(p.themes.some((t) => t === 'mateIn1' || t === 'hangingPiece')).toBe(true);
          if (band === 'explorer') expect(pzMoves(p).length).toBe(2);
        }
      }
    for (const p of eligible([], 3000, 'explorer')) expect(p.themes.includes('long') || p.themes.includes('veryLong')).toBe(false);
    expect(eligible([], 3000, 'champion').some((p) => p.themes.includes('long'))).toBe(true);
  });
  it('pick() stays in the rating window and widens it when needed', () => {
    const got = pick({ themes: ['mateIn1'], maxRating: 1000, band: 'champion', rating: 700, count: 3, rng: mulberry32(3) });
    for (const p of got) expect(p.rating >= 550 && p.rating <= 800).toBe(true);
    // Only 4 forks at 1100 or below: the window widens until it finds them all.
    expect(pick({ themes: ['fork'], maxRating: 1100, band: 'champion', rating: 600, count: 4, rng: mulberry32(1) }).length).toBe(4);
  });
  it('pick() is seeded and puts unseen puzzles first', () => {
    const o = { themes: ['pin'], maxRating: 1100, band: 'champion' as AgeBand, rating: 900, count: 6 };
    expect(pick({ ...o, rng: mulberry32(9) }).map((p) => p.id)).toEqual(pick({ ...o, rng: mulberry32(9) }).map((p) => p.id));
    const first = pick({ ...o, rng: mulberry32(9) });
    const seen = new Set(first.map((p) => p.id));
    const again = pick({ ...o, rng: mulberry32(9), seen: (id) => seen.has(id) });
    for (const p of again) expect(seen.has(p.id)).toBe(false);
  });
  it('dbAccepts takes the solution, any mate in mate puzzles, and rejects others', () => {
    const p = eligible(['mateIn1'], 800, 'explorer')[0];
    const [opp, sol] = pzMoves(p);
    const c = new Chess(p.fen);
    c.move({ from: opp.slice(0, 2), to: opp.slice(2, 4) });
    const fen = c.fen();
    const moves = c.moves({ verbose: true });
    const good = moves.find((m) => m.from + m.to + (m.promotion ?? '') === sol)!;
    expect(dbAccepts(p, fen, good, 1)).toBe(true);
    for (const m of moves) {
      const d = new Chess(fen);
      d.move(m);
      expect(dbAccepts(p, fen, m, 1)).toBe(d.isCheckmate());
    }
    const pin = eligible(['pin'], 1100, 'champion').find((x) => !x.themes.includes('mate'))!;
    const e = new Chess(pin.fen);
    const u = pzMoves(pin);
    e.move({ from: u[0].slice(0, 2), to: u[0].slice(2, 4) });
    const wrong = e.moves({ verbose: true }).find((m) => m.from + m.to !== u[1].slice(0, 4))!;
    expect(dbAccepts(pin, e.fen(), wrong, 1)).toBe(false);
  });
});

describe('Puzzle of the Day', () => {
  it('Sprouts get a hand list of 30 mate and capture items that all validate', () => {
    expect(SPROUT_DAILY.length).toBe(30);
    expect(new Set(SPROUT_DAILY.map((i) => i.fen)).size).toBe(30);
    for (const t of SPROUT_DAILY) {
      expect(['mate', 'capture']).toContain(t.goal.kind);
      expect(validateFindMove(t, 'sprout'), t.id).toEqual([]);
      if (t.goal.kind === 'mate') expect(solutions(t.fen, t.goal).every((m) => san(t.fen, m.from + m.to).endsWith('#'))).toBe(true);
    }
  });
  it('is deterministic per date and band', () => {
    for (const band of BANDS) {
      const a = dailyPuzzle(band, '2026-09-27');
      const b = dailyPuzzle(band, '2026-09-27');
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
    const days = Array.from({ length: 20 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    const ids = new Set(days.map((d) => {
      const x = dailyPuzzle('champion', d);
      return x.kind === 'db' ? x.puzzle.id : '';
    }));
    expect(ids.size).toBeGreaterThan(10);
  });
  it('uses the band pools of spec 13.13', () => {
    for (const p of dailyPool('explorer')) {
      expect(p.rating).toBeLessThanOrEqual(800);
      expect(pzMoves(p).length).toBe(2);
      expect(p.themes.some((t) => t === 'mateIn1' || t === 'hangingPiece')).toBe(true);
    }
    for (const p of dailyPool('champion')) {
      expect(p.rating).toBeLessThanOrEqual(1200);
      expect(p.themes.includes('long') || p.themes.includes('veryLong')).toBe(false);
    }
    expect(dailyPuzzle('sprout', '2026-01-01').kind).toBe('hand');
    expect(dailyPuzzle('explorer', '2026-01-01').kind).toBe('db');
  });
});
