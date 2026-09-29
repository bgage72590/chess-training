// Pack D: the buddies' move logic, missions and play-bot content (spec 13.12 and 15).
import { describe, expect, it, vi } from 'vitest';
import { Chess, type Move } from 'chess.js';

// The engine is "failed": Bruno and Ember must fall back to Olive, and hints must still work.
vi.mock('../src/engine/engine', () => ({
  engine: { status: 'failed', init: () => Promise.reject(new Error('no engine')), search: () => Promise.resolve(null), cancelAll: () => undefined },
}));

import { buddyMove, hintMove, hopMove, jsMove, matingMoves, material, oliveMove, shellyMove } from '../src/kids/activities/playBot/kidBot';
import { chessResult, developOver, developScore, developTicks, firstQueen, missionResult, noHangSuccess } from '../src/kids/activities/playBot/missions';
import { KNIGHT_HOME, QUEEN_HOME, QUEEN_ROOK_HOME, START_FEN, validatePlayBot, FRIEND_HANDICAPS } from '../src/kids/activities/playBot/logic';
import { buddiesPack } from '../src/kids/content/games';
import { LEVEL_SETS } from '../src/kids/packs';
import { BUDDIES, type BuddyId } from '../src/kids/curriculum/buddies';
import { mulberry32 } from '../src/kids/lib/rng';
import { VALUE } from '../src/kids/lib/danger';

const ALL: BuddyId[] = ['shelly', 'hop', 'tuck', 'fern', 'olive', 'bruno', 'ember'];

/**
 * Olive (and Bruno and Ember, who play as her here) searches until a deadline on the clock. This clock
 * moves only when she reads it, `ms` a reading (she reads it once per position searched), so her search
 * is a fixed amount of work: results and run times no longer depend on how busy the machine is.
 * Returns a restore function, and a count of the readings so far.
 */
function workClock(ms: number) {
  let t = 0;
  let readings = 0;
  const spy = vi.spyOn(performance, 'now').mockImplementation(() => (readings++, (t += ms)));
  return { restore: () => spy.mockRestore(), readings: () => readings };
}
/** Generous: these tests check what the buddies play, and a busy machine only makes them slower. */
const SLOW = 600_000;

/** 20 fixed positions: hand-picked ones plus seeded random walks from the start. */
const FIXTURES: string[] = (() => {
  const hand = [
    START_FEN,
    QUEEN_HOME,
    KNIGHT_HOME,
    QUEEN_ROOK_HOME,
    '4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 b - - 0 1',
    '1n2k1n1/pppppppp/8/8/8/8/PPPPPPPP/1N2K1N1 b - - 0 1',
    'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3',
    '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', // Ra8#
    '8/8/8/4k3/8/8/4P3/4K3 b - - 0 1',
    'r3k2r/ppp2ppp/2n1bn2/2bpp3/4P3/2NP1N2/PPP1BPPP/R1BQK2R w KQkq - 0 7',
    '7k/8/8/8/8/8/1q6/K7 w - - 0 1',
  ];
  const rng = mulberry32(7);
  const out = [...hand];
  while (out.length < 20) {
    const c = new Chess();
    const n = 8 + Math.floor(rng() * 30);
    for (let i = 0; i < n && !c.isGameOver(); i++) {
      const ms = c.moves();
      c.move(ms[Math.floor(rng() * ms.length)]);
    }
    if (!c.isGameOver()) out.push(c.fen());
  }
  return out;
})();

describe('kidBot: every buddy plays legal moves', () => {
  it('has 20 legal, playable fixtures', () => {
    expect(FIXTURES).toHaveLength(20);
    for (const f of FIXTURES) expect(new Chess(f).isGameOver()).toBe(false);
  });
  for (const b of ALL)
    it(`${b} returns a legal move on every fixture (engine failed)`, async () => {
      const rng = mulberry32(11);
      const clock = workClock(8);
      try {
        for (const f of FIXTURES) {
          const { move, fellBack } = await buddyMove(b, f, rng);
          expect(move, `${b} @ ${f}`).not.toBeNull();
          const legal = new Chess(f).moves({ verbose: true }).map((m) => m.lan);
          expect(legal).toContain(move!.lan);
          expect(fellBack).toBe(b === 'bruno' || b === 'ember');
        }
      } finally {
        clock.restore();
      }
    }, SLOW);
  it('returns null when the game is over', () => {
    expect(jsMove('olive', '7k/6Q1/6K1/8/8/8/8/8 b - - 0 1', mulberry32(1))).toBeNull();
  });
});

describe('kidBot personas', () => {
  it('shelly never mates in 1 when she has another move', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
    const rng = mulberry32(3);
    for (let i = 0; i < 200; i++) {
      const m = shellyMove(new Chess(fen), rng);
      expect(m.san).not.toContain('#');
    }
  });
  it('hop always captures the biggest piece (when not mating)', () => {
    // White can take a pawn (exd5), a knight (Bxf6... no: Nxf6?) or the queen (Rxd8? Qxd8).
    const fens = [
      'r1bqkb1r/pppp1ppp/2n2n2/3pp3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 1', // Nxd5 / exd5 / Nxe5: all worth <= 3
      '3qk3/8/8/3R4/8/2p5/8/4K3 w - - 0 1', // Rxd8+ (queen) vs nothing else
      '4k3/8/2n5/3P4/1q6/8/2N5/4K3 w - - 0 1', // Nxb4 (queen) or dxc6 (knight)
    ];
    const rng = mulberry32(5);
    for (const fen of fens) {
      const c = new Chess(fen);
      const caps = c.moves({ verbose: true }).filter((m) => m.captured);
      const top = Math.max(...caps.map((m) => VALUE[m.captured!]));
      const mates = new Set(matingMoves(c).map((m) => m.lan));
      for (let i = 0; i < 40; i++) {
        const m = hopMove(new Chess(fen), rng);
        if (mates.has(m.lan)) continue;
        expect(m.captured, fen).toBeDefined();
        expect(VALUE[m.captured!]).toBe(top);
      }
    }
  });
  it('hop takes a mate-in-1 about half the time', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
    const rng = mulberry32(9);
    let n = 0;
    for (let i = 0; i < 200; i++) if (hopMove(new Chess(fen), rng).san.includes('#')) n++;
    expect(n).toBeGreaterThan(60);
    expect(n).toBeLessThan(140);
  });
  it('olive always mates in 1 and answers within its budget', { timeout: SLOW }, () => {
    const mates = ['6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'k7/2Q5/2K5/8/8/8/8/8 w - - 0 1', 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'];
    for (const f of mates) expect(oliveMove(new Chess(f), mulberry32(1)).san).toContain('#');
    // Measured in work: with a clock that ticks 4 ms a reading, her 400 ms budget is 100 positions.
    // Depth 1 always finishes; after that she stops at the first reading past the budget.
    const clock = workClock(4);
    try {
      for (const f of FIXTURES.slice(0, 10)) {
        let at = clock.readings();
        oliveMove(new Chess(f), mulberry32(2), { maxDepth: 1 });
        const depth1 = clock.readings() - at;
        at = clock.readings();
        oliveMove(new Chess(f), mulberry32(2));
        expect(clock.readings() - at, f).toBeLessThanOrEqual(Math.max(depth1, 100) + 2);
      }
    } finally {
      clock.restore();
    }
  });
  it('olive grabs a free queen', () => {
    const m = oliveMove(new Chess('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1'), mulberry32(4), { noise: 0 });
    expect(m.lan).toBe('d2d5');
  });
  it('hints work with the engine down (Olive, no noise)', async () => {
    const m = await hintMove('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
    expect(m?.san).toBe('Ra8#');
  });
});

/** A short match: each side plays both colours; adjudicated by mate, else by material after `plies`. */
function match(a: BuddyId, b: BuddyId, games: number, plies: number, seed: number): number {
  const rng = mulberry32(seed);
  let score = 0;
  for (let g = 0; g < games; g++) {
    const aWhite = g % 2 === 0;
    const c = new Chess();
    for (let i = 0; i < plies && !c.isGameOver(); i++) {
      const who = (c.turn() === 'w') === aWhite ? a : b;
      c.move(jsMove(who, c.fen(), rng) as Move);
    }
    const aColor = aWhite ? 'w' : 'b';
    let r: number;
    if (c.isCheckmate()) r = c.turn() === aColor ? 0 : 1;
    else {
      const m = material(c, aColor);
      r = m > 1 ? 1 : m < -1 ? 0 : 0.5;
    }
    score += r;
  }
  return score / games;
}

describe('kidBot strength ordering', () => {
  it('hop beats shelly', { timeout: SLOW }, () => expect(match('hop', 'shelly', 6, 60, 1)).toBeGreaterThan(0.5));
  it('tuck beats hop', { timeout: SLOW }, () => expect(match('tuck', 'hop', 10, 60, 2)).toBeGreaterThan(0.5));
  it('fern beats shelly and hop', { timeout: SLOW }, () => {
    expect(match('fern', 'shelly', 4, 60, 3)).toBeGreaterThan(0.5);
    expect(match('fern', 'hop', 4, 60, 4)).toBeGreaterThan(0.5);
  });
  it('olive beats tuck', { timeout: SLOW }, () => {
    const clock = workClock(8);
    try {
      expect(match('olive', 'tuck', 4, 40, 5)).toBeGreaterThan(0.5);
    } finally {
      clock.restore();
    }
  });
});

describe('missions', () => {
  const play = (sans: string[], fen = START_FEN) => {
    const c = new Chess(fen);
    return sans.map((s) => c.move(s));
  };
  const white = (ms: Move[]) => ms.filter((m) => m.color === 'w');

  it('develop: a model opening ticks all five Golden Rules', () => {
    const ms = play(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'Nc3', 'Nf6', 'O-O', 'O-O', 'd3', 'd6', 'Bg5', 'h6']);
    const t = developTicks(white(ms), 'w');
    expect(t).toEqual({ center: 'yes', knights: 'yes', bishops: 'yes', castle: 'yes', queen: 'yes' });
    expect(developScore(t)).toBe(3);
    expect(developOver(t, 7)).toBe(true);
  });
  it('develop: an early queen crosses out the queen rule', () => {
    const ms = play(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6']);
    const t = developTicks(white(ms), 'w');
    expect(t.queen).toBe('no');
    expect(t.center).toBe('yes');
    expect(t.knights).toBe('wait');
    expect(developOver(t, 3)).toBe(false);
  });
  it('develop: rules still open after 10 moves become crosses; scores 3-4 = 2, else 1', () => {
    const ms = play(['a4', 'a5', 'h4', 'h5', 'Nc3', 'Nc6', 'Nf3', 'Nf6', 'Rb1', 'Rb8', 'Rh2', 'Rh7', 'Ra1', 'Ra8', 'Rh1', 'Rh8', 'Rb1', 'Rb8', 'Ra1', 'Ra8']);
    const t = developTicks(white(ms), 'w');
    expect(t).toEqual({ center: 'no', knights: 'yes', bishops: 'no', castle: 'no', queen: 'yes' });
    expect(developOver(t, 10)).toBe(true);
    expect(developScore(t)).toBe(1);
    expect(developScore({ center: 'yes', knights: 'yes', bishops: 'yes', castle: 'no', queen: 'no' })).toBe(2);
    expect(developScore({ center: 'yes', knights: 'yes', bishops: 'yes', castle: 'yes', queen: 'no' })).toBe(2);
  });
  it('develop: works for Black (e5/d5 centre)', () => {
    const ms = play(['e4', 'd5', 'Nc3', 'Nf6', 'Nf3', 'Nc6']);
    const t = developTicks(ms.filter((m) => m.color === 'b'), 'b');
    expect(t.center).toBe('yes');
    expect(t.knights).toBe('yes');
  });
  it('develop missions score by ticks with no outcome', () => {
    expect(missionResult('develop', { result: null, ticks: { center: 'yes', knights: 'yes', bishops: 'yes', castle: 'yes', queen: 'yes' } })).toEqual({ score: 3 });
  });
  it('no-hang: success needs 12+ kid moves and no kept alarm (or a win)', () => {
    expect(noHangSuccess({ ended: true, kidMoves: 12, keptFlagged: 0, result: 'loss' })).toBe(true);
    expect(noHangSuccess({ ended: true, kidMoves: 11, keptFlagged: 0, result: 'loss' })).toBe(false);
    expect(noHangSuccess({ ended: true, kidMoves: 30, keptFlagged: 1, result: 'win' })).toBe(false);
    expect(noHangSuccess({ ended: true, kidMoves: 5, keptFlagged: 0, result: 'win' })).toBe(true);
    expect(noHangSuccess({ ended: false, kidMoves: 20, keptFlagged: 0, result: null })).toBe(false);
    expect(missionResult('no-hang', { result: 'loss', noHang: true })).toEqual({ score: 3, outcome: 'win' });
    expect(missionResult('no-hang', { result: 'draw', noHang: false })).toEqual({ score: 2, outcome: 'draw' });
  });
  it('promote: the first queen decides', () => {
    const ms = play(['a8=Q'], '4k3/P7/8/8/8/8/p7/4K3 w - - 0 1');
    expect(firstQueen(ms, 'w')).toBe('kid');
    expect(firstQueen(ms, 'b')).toBe('bot');
    expect(firstQueen(play(['a8=N'], '4k3/P7/8/8/8/8/8/4K3 w - - 0 1'), 'w')).toBeNull();
  });
  it('chess results from the kid side', () => {
    const mated = new Chess('R5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1');
    expect(chessResult(mated, 'w')).toBe('win');
    expect(chessResult(mated, 'b')).toBe('loss');
    expect(chessResult(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), 'w')).toBe('draw');
    expect(chessResult(new Chess(), 'w')).toBeNull();
    expect(missionResult('win', { result: 'win' })).toEqual({ score: 3, outcome: 'win' });
  });
});

describe('play-bot content', () => {
  it('registers the five Pack D level sets', () => {
    for (const id of ['w7-armies', 'w7-boss', 'w8-golden-rules', 'w8-buddy-ladder', 'w8-crown']) expect(LEVEL_SETS.get(id)?.activity).toBe('play-bot');
  });
  it('sprouts never meet fern, olive, bruno or ember', () => {
    expect(validatePlayBot({ bot: 'fern', mission: 'win' }, 'sprout')).not.toEqual([]);
    expect(validatePlayBot({ bot: 'ember', mission: 'win' }, 'explorer')).not.toEqual([]);
    expect(validatePlayBot({ bot: 'ember', mission: 'win' }, 'champion')).toEqual([]);
    expect(validatePlayBot({ bot: 'hop', mission: 'win', fen: 'not a fen' }, 'sprout')).toContain('fen does not load');
  });
  it('every game boss ease ladder ends with Shelly plus a handicap', () => {
    for (const set of buddiesPack.levelSets.filter((s) => ['w7-boss', 'w8-buddy-ladder', 'w8-crown'].includes(s.id)))
      for (const item of set.items) {
        const last = item.ease?.[item.ease.length - 1] as { bot?: string; fen?: string } | undefined;
        expect(last?.bot, `${set.id}/${item.id}`).toBe('shelly');
        expect([QUEEN_HOME, QUEEN_ROOK_HOME]).toContain(last?.fen);
      }
  });
  it('playground: one entry per buddy plus a friend game', () => {
    const pg = buddiesPack.playground ?? [];
    for (const b of Object.keys(BUDDIES)) expect(pg.some((e) => e.id === `buddy-${b}`)).toBe(true);
    expect(pg.find((e) => e.id === 'friend-chess')?.friend).toBe(true);
    for (const h of FRIEND_HANDICAPS) expect(() => new Chess(h.fen)).not.toThrow();
  });
});
