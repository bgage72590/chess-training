// Kids mode framework tests (spec section 15).
import { describe, expect, it } from 'vitest';
import cloudSource from '../src/store/cloud.ts?raw';
import { Chess } from 'chess.js';
import { ACTIVITIES, CHECKPOINTS, LEVEL_SETS, PACKS, createRegistry } from '../src/kids/packs';
import type { ActivityDef, AgeBand, ItemResult, KidsPack, LevelSet } from '../src/kids/activities/types';
import { NODES, NODE_BY_ID, WORLDS, nodesOf } from '../src/kids/curriculum/worlds';
import { BAND_TUNING, BANDS, promotionFor, resolveItem, visibleTo } from '../src/kids/curriculum/tuning';
import { isKnownSticker, stickerDef } from '../src/kids/curriculum/stickers';
import { applyMove, attacks, dests, gobbleSolutions, lavaSquares, placementFen, pseudoMoves, sqRange, starPar } from '../src/kids/lib/miniRules';
import { dangerAfterMove, hangs } from '../src/kids/lib/danger';
import { pronounce } from '../src/kids/lib/pronounce';
import { withTurn } from '../src/kids/lib/fen';
import { playableDests } from '../src/kids/lib/chessDests';
import { mulberry32 } from '../src/kids/lib/rng';
import { KIDS_KEY, SEEN_MAX, defaultKidsState, newKid, normalizeKids, pruneForSave, readKids, writeKids, type KidProfile } from '../src/kids/store/kidsStore';
import {
  LEITNER_DAYS,
  acceptFastTrack,
  fastTrackOffer,
  addDays,
  addFamilyStars,
  applyPlacement,
  bossOffers,
  bossPassed,
  canGraduate,
  crownOf,
  gameLossStep,
  mastered,
  nextNode,
  nodeScore,
  nodeUnlocked,
  placementStart,
  placementStep,
  placementWorldPassed,
  recordRun,
  recordWarmup,
  skipNode,
  startAtRank,
  warmupPlan,
  worldPassed,
  worldUnlocked,
  type Registry,
} from '../src/kids/store/progress';
import { RunPicker, pickWarmupItem } from '../src/kids/player/run';
import { playgroundRecap, recapFor } from '../src/kids/player/recap';
import { escapeWay, ruleLine, solutions, validateFindMove, type Goal } from '../src/kids/activities/findMove/logic';
import { reviewStars, validateStars } from '../src/kids/activities/stars/logic';

// Source text of every Kids file (Vite raw imports: no Node APIs needed).
const KIDS_SOURCES = import.meta.glob('../src/kids/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
// Progress rules are checked against the framework's own pack (the activity packs add more nodes).
const CORE_REG = createRegistry(PACKS.filter((p) => p.id === 'core'));
const REG: Registry = { isRegistered: (id) => CORE_REG.isRegistered(id) };
const TODAY = '2026-09-20';

const r = (score: 1 | 2 | 3, extra: Partial<ItemResult> = {}): ItemResult => ({ score, mistakes: 0, hintLevel: 0, ...extra });
const kidOf = (band: AgeBand = 'explorer') => newKid({ name: 'Mia', band, start: 'new', id: 'k1', now: 0 });

/** Plays a node to `stars` stars. */
function starNode(kid: KidProfile, id: string, stars: 1 | 2 | 3, reg: Registry = REG, day = TODAY) {
  recordRun(kid, { nodeId: id, results: [r(stars)], itemIds: [`${id}#0`] }, reg, day);
}

describe('registry', () => {
  it('node ids are unique', () => {
    expect(new Set(NODES.map((n) => n.id)).size).toBe(NODES.length);
  });
  it('every registered level set uses a known activity and is a node or checkpoint', () => {
    const ids = new Set(NODES.map((n) => n.id));
    for (const s of LEVEL_SETS.values()) {
      expect(ACTIVITIES.has(s.activity), s.id).toBe(true);
      expect(ids.has(s.id) || /^cp[1-8]$/.test(s.id), s.id).toBe(true);
    }
  });
  it('no level set is registered twice across packs', () => {
    const all = PACKS.flatMap((p) => p.levelSets.map((s) => s.id));
    expect(new Set(all).size).toBe(all.length);
  });
  it('node stickers exist for every node', () => {
    for (const n of NODES) expect(isKnownSticker(`s-${n.id}`), n.id).toBe(true);
    for (const id of ['st-first-mate', 'st-promotion', 'st-knight-trek', 'st-brave-try', 'st-garden-3', 'st-family-2']) expect(stickerDef(id), id).toBeTruthy();
  });
  it('awarded moment stickers referenced by content exist', () => {
    for (const s of LEVEL_SETS.values()) for (const it of s.items as { awardOnDone?: string }[]) if (it.awardOnDone) expect(isKnownSticker(it.awardOnDone)).toBe(true);
  });
});

function validateSet(set: LevelSet, act: ActivityDef<unknown>) {
  set.items.forEach((item, i) => {
    for (const band of BANDS) {
      if (!visibleTo(item, band)) continue;
      const steps = (item.ease?.length ?? 0) + 1;
      for (let ease = 0; ease < steps; ease++) {
        const errs = act.validate(resolveItem(item, band, { ease }), band);
        expect(errs, `${set.id}[${item.id ?? i}] ${band} ease ${ease}`).toEqual([]);
      }
    }
  });
}

describe('content validation', () => {
  for (const set of LEVEL_SETS.values()) {
    it(`${set.id} validates for every band`, () => validateSet(set, ACTIVITIES.get(set.activity)!));
  }
  for (const set of CHECKPOINTS.values()) {
    it(`${set.id} validates`, () => validateSet(set, ACTIVITIES.get(set.activity)!));
  }
  it('star pars match the spec tables', () => {
    expect(starPar({ pieces: { a1: 'R' }, stars: ['a4', 'd4', 'd1'], area: 'a1:d4' })).toBe(3);
    expect(starPar({ pieces: { a1: 'R' }, rocks: ['e1', 'c6'], stars: ['h1', 'h8', 'c8', 'c3'] })).toBe(6);
    expect(starPar({ pieces: { e1: 'K' }, statues: { e5: 'n' }, stars: ['e8'] })).toBe(7);
    expect(starPar({ pieces: { a1: 'N' }, stars: ['b2'] })).toBe(4);
    expect(starPar({ pieces: { g5: 'P' }, stars: ['g8', 'a2'] })).toBe(4);
    expect(starPar({ pieces: { d1: 'Q' }, stars: ['d8', 'h4'] })).toBe(2);
    expect(starPar({ pieces: { d1: 'Q' }, statues: { f6: 'n' }, stars: ['d8', 'h4'] })).toBe(3);
  });
  it('unsolvable star items fail validate', () => {
    expect(validateStars({ pieces: { f1: 'B' }, rocks: ['d3', 'g2'], stars: ['h1', 'a6'], par: 4 }, 'explorer')).not.toEqual([]);
    expect(validateStars({ pieces: { a1: 'Q' }, statues: { c3: 'n' }, stars: ['d4', 'a4'], par: 2 }, 'explorer')).toContain('star on lava');
  });
  it('review() output always validates', () => {
    const rng = mulberry32(7);
    for (const band of BANDS) for (let i = 0; i < 15; i++) expect(validateStars(reviewStars(rng, band), band)).toEqual([]);
  });
  it('find-move rejects bad items', () => {
    expect(validateFindMove({ fen: 'k7/8/1K6/8/8/8/8/1Q6 w - - 0 1', goal: { kind: 'mate' } }, 'explorer')).toContain('no solution');
    expect(validateFindMove({ fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', goal: { kind: 'escape', ways: 'any' } }, 'explorer')).toContain('escape: not in check');
    // Black is already in check with White to move: Qxa8 would take the king.
    expect(validateFindMove({ fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1', goal: { kind: 'mate' } }, 'explorer')).toEqual(['illegal position: the side not to move is in check']);
  });
  it('every Kids position with both kings is legal, and every intro move is legal', () => {
    const fens: { where: string; fen: string; move?: string[] }[] = [];
    const walk = (v: unknown, where: string): void => {
      if (typeof v === 'string') {
        if (/^[1-8pnbrqk]+(\/[1-8pnbrqk]+){7} [wb] /i.test(v)) fens.push({ where, fen: v });
      } else if (Array.isArray(v)) v.forEach((x) => walk(x, where));
      else if (v && typeof v === 'object') Object.values(v).forEach((x) => walk(x, where));
    };
    for (const s of [...LEVEL_SETS.values(), ...CHECKPOINTS.values()]) {
      s.intro?.forEach((step, i) => step.fen && fens.push({ where: `${s.id} intro ${i}`, fen: step.fen, move: step.move }));
      s.items.forEach((it, i) => walk(it, `${s.id} ${it.id ?? i}`));
    }
    for (const p of PACKS) walk(p.playground, `${p.id} playground`);
    expect(fens.length).toBeGreaterThan(150);
    for (const { where, fen, move } of fens) {
      const board = fen.split(' ')[0];
      // A free-rule picture (a lone statue next to a king) is not a chess position.
      if (!board.includes('k') || !board.includes('K')) continue;
      const c = new Chess(fen);
      const theirKing = c.findPiece({ type: 'k', color: c.turn() === 'w' ? 'b' : 'w' })[0];
      expect(c.isAttacked(theirKing, c.turn()), `${where}: ${fen}`).toBe(false);
      if (move) expect(() => c.move({ from: move[0], to: move[1], promotion: 'q' }), `${where}: ${move.join('-')}`).not.toThrow();
    }
  });
  it('find-move solution sets are complete', () => {
    const sans = (fen: string, goal: Goal) => solutions(fen, goal).map((m) => m.san).sort();
    expect(sans('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', { kind: 'check' })).toEqual(['Ra8+']);
    expect(sans('4k3/8/8/8/4N3/8/8/4K3 w - - 0 1', { kind: 'check' })).toEqual(['Nd6+', 'Nf6+']);
    expect(sans('4k3/8/8/8/8/8/8/3QK3 w - - 0 1', { kind: 'check' })).toEqual(['Qa4+', 'Qd7+', 'Qd8+', 'Qe2+', 'Qh5+']);
    expect(sans('k7/8/1K6/8/8/8/8/6Q1 w - - 0 1', { kind: 'mate' })).toEqual(['Qg8#']);
    expect(sans('7k/8/6K1/8/8/8/8/1Q6 w - - 0 1', { kind: 'mate' })).toEqual(['Qb8#']);
    expect(sans('4k3/8/p7/1n6/8/1R3b2/8/4K3 w - - 0 1', { kind: 'safe-capture' })).toEqual(['Rxf3']);
    expect(sans('4k3/8/8/8/1b6/2N5/8/R3K3 w - - 0 1', { kind: 'protect', square: 'c3' })).toEqual(['Kd2', 'Ra3', 'Rc1']);
    expect(sans('4k3/8/8/8/4r3/8/2B5/R2QK3 w - - 0 1', { kind: 'escape', ways: 'any' })).toEqual(['Bxe4', 'Kd2', 'Kf1', 'Kf2', 'Qe2']);
    const fen = 'R3r1k1/8/8/8/8/8/3N4/4K3 w - - 0 1';
    const ways = Object.fromEntries(new Chess(fen).moves({ verbose: true }).map((m) => [m.san, escapeWay(fen, m)]));
    expect(ways).toEqual({ 'Rxe8+': 'capture', Ne4: 'block', Kf2: 'run', Kf1: 'run', Kd1: 'run' });
    expect(sans('4k3/8/8/8/8/8/3q4/4K3 w - - 0 1', { kind: 'escape', ways: ['capture'] })).toEqual(['Kxd2']);
  });
  it("the capture rule names the other side's pieces", () => {
    expect(ruleLine({ kind: 'capture', square: 'd5' }, '4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1')).toBe('Capture by moving onto a black piece.');
    expect(ruleLine({ kind: 'capture', square: 'd4' }, '3rk3/8/8/8/3Q4/8/8/4K3 b - - 0 1')).toBe('Capture by moving onto a white piece.');
  });
});

describe('promotion', () => {
  it('Explorers get a queen by themselves until Pawn Parade teaches promotion; Champions always pick; Sprouts never', () => {
    const k = kidOf('explorer');
    expect(promotionFor(BAND_TUNING.explorer, k)).toBe('auto');
    starNode(k, 'w5-promo', 1);
    expect(promotionFor(BAND_TUNING.explorer, k)).toBe('picker');
    expect(promotionFor(BAND_TUNING.champion, kidOf('champion'))).toBe('picker');
    const s = kidOf('sprout');
    starNode(s, 'w5-promo', 3);
    expect(promotionFor(BAND_TUNING.sprout, s)).toBe('auto');
    // A test-out counts as taught (the kid showed they know it).
    const t = kidOf('explorer');
    applyPlacement(t, [1, 2, 3, 4, 5]);
    expect(promotionFor(BAND_TUNING.explorer, t)).toBe('picker');
  });
});

describe('curriculum shape', () => {
  it('every world has at least 3 Sprout-visible non-bonus nodes including the boss', () => {
    for (const w of WORLDS) {
      const s = nodesOf(w.id).filter((n) => n.bands.includes('sprout') && !n.bonus);
      expect(s.length, w.id).toBeGreaterThanOrEqual(3);
      expect(s.some((n) => n.boss), w.id).toBe(true);
    }
  });
  it('w1-hello comes first, uses stars, and its first Sprout item has par 1', () => {
    expect(nodesOf('w1')[0].id).toBe('w1-hello');
    const set = LEVEL_SETS.get('w1-hello')!;
    expect(set.activity).toBe('stars');
    const first = set.items.find((it) => visibleTo(it, 'sprout')) as { par: number };
    expect(first.par).toBe(1);
  });
  it('board-vision nodes are never first in a world', () => {
    for (const w of WORLDS) expect(nodesOf(w.id)[0].activity).not.toBe('board-vision');
  });
  it('tuning table has the spec values', () => {
    expect(BAND_TUNING.sprout.buttonPx).toBe(72);
    expect(BAND_TUNING.explorer.itemsPerRun).toBe(5);
    expect(BAND_TUNING.champion.warmupItems).toBe(3);
    expect(BAND_TUNING.sprout.placementCap).toBe(5);
  });
  it('resolveItem merges tune, superTune and ease in order', () => {
    const item = { a: 1, b: 1, c: 1, tune: { sprout: { a: 2 } }, superTune: { b: 3 }, ease: [{ c: 4 }, { c: 5 }] };
    expect(resolveItem(item, 'sprout', { super: true, ease: 2 })).toMatchObject({ a: 2, b: 3, c: 5 });
    expect(resolveItem(item, 'explorer')).toMatchObject({ a: 1, b: 1, c: 1 });
  });
});

describe('progress', () => {
  it('stars never decrease and the node score is max(1, round(mean))', () => {
    const k = kidOf();
    starNode(k, 'w1-hello', 3);
    starNode(k, 'w1-hello', 1);
    expect(k.nodes['w1-hello'].stars).toBe(3);
    expect(nodeScore([3, 2, 2])).toBe(2);
    expect(nodeScore([1, 1, 2])).toBe(1);
    expect(nodeScore([3, 3, 2])).toBe(3);
    expect(nodeScore([])).toBe(1);
  });
  it('mastery: 3 stars, or 2 stars on two different days', () => {
    const k = kidOf();
    starNode(k, 'w1-hello', 2, REG, '2026-09-01');
    expect(mastered(k.nodes['w1-hello'])).toBe(false);
    starNode(k, 'w1-hello', 2, REG, '2026-09-01');
    expect(mastered(k.nodes['w1-hello'])).toBe(false);
    starNode(k, 'w1-hello', 2, REG, '2026-09-02');
    expect(mastered(k.nodes['w1-hello'])).toBe(true);
  });
  it('silver and gold crowns', () => {
    const k = kidOf('sprout');
    for (const id of ['w1-hello', 'w1-rook-stars']) starNode(k, id, 2);
    expect(crownOf(k, 'w1', REG)).toBe(null);
    starNode(k, 'w1-boss', 1);
    expect(crownOf(k, 'w1', REG)).toBe('silver');
    for (const id of ['w1-hello', 'w1-rook-stars', 'w1-boss']) starNode(k, id, 3);
    expect(crownOf(k, 'w1', REG)).toBe('gold');
  });
  it('Leitner boxes and due days [1, 2, 4, 7, 14]', () => {
    const k = kidOf();
    starNode(k, 'w1-hello', 3, REG, TODAY);
    expect(k.nodes['w1-hello'].box).toBe(2);
    expect(k.nodes['w1-hello'].due).toBe(addDays(TODAY, LEITNER_DAYS[1]));
    starNode(k, 'w1-hello', 3, REG, TODAY);
    expect(k.nodes['w1-hello'].box).toBe(3);
    starNode(k, 'w1-hello', 2, REG, TODAY);
    expect(k.nodes['w1-hello'].box).toBe(3);
    starNode(k, 'w1-hello', 1, REG, TODAY);
    expect(k.nodes['w1-hello'].box).toBe(1);
    expect(k.nodes['w1-hello'].due).toBe(addDays(TODAY, 1));
    recordWarmup(k, 'w1-hello', 3, 'h1', TODAY);
    expect(k.nodes['w1-hello'].box).toBe(2);
    recordWarmup(k, 'w1-hello', 1, 'h2', TODAY);
    expect(k.nodes['w1-hello'].box).toBe(1);
    expect(k.nodes['w1-hello'].leaf).toBe(true);
  });
  it('warm-up: none on the first play day; S1/E2/C3 items later', () => {
    for (const [band, n] of [['sprout', 1], ['explorer', 2], ['champion', 3]] as const) {
      const k = kidOf(band);
      for (const id of ['w1-hello', 'w1-rook-stars', 'w1-boss', 'w2-bishop-stars']) starNode(k, id, 1, REG, '2026-09-01');
      expect(warmupPlan(k, REG, '2026-09-01')).toEqual([]);
      expect(warmupPlan(k, REG, '2026-09-05').length).toBe(n);
    }
  });
  it('no warm-up with fewer than 2 completed nodes', () => {
    const k = kidOf();
    starNode(k, 'w1-hello', 1, REG, '2026-09-01');
    expect(warmupPlan(k, REG, '2026-09-09')).toEqual([]);
  });
  it('the warm-up item avoids lastItems', () => {
    const set = LEVEL_SETS.get('w1-rook-stars')!;
    const rng = mulberry32(3);
    for (let i = 0; i < 20; i++) {
      const it = pickWarmupItem(set, 'explorer', ['r3', 'r4', 'r5', 'r6'], rng)!;
      expect(['r7', 'r8', 'r9']).toContain(it.id);
    }
  });
  it('run picker: fixed order, per-run counts, tier adaptation', () => {
    const hello = new RunPicker(LEVEL_SETS.get('w1-hello')!, 'sprout', { itemsPerRun: 3, startTier: 1, rng: mulberry32(1) });
    expect(hello.total).toBe(4);
    expect([hello.next()!.id, hello.next()!.id, hello.next()!.id, hello.next()!.id]).toEqual(['h1', 'h2', 'h3', 'h4']);
    expect(hello.next()).toBe(null);
    const p = new RunPicker(LEVEL_SETS.get('w1-rook-stars')!, 'explorer', { itemsPerRun: 5, startTier: 1, rng: mulberry32(2) });
    expect(p.next()!.tier).toBe(1);
    p.report(3);
    p.report(3);
    expect(p.currentTier).toBe(2);
    p.report(1);
    expect(p.currentTier).toBe(1);
  });
  it('run picker: "Easier one" is offered only while a lower-tier item is left', () => {
    const set = LEVEL_SETS.get('w7-en-passant')!;
    const p = new RunPicker(set, 'explorer', { itemsPerRun: 5, startTier: 1, rng: mulberry32(3) });
    const run = [p.next()!, p.next()!, p.next()!];
    expect(run.map((x) => x.tier)).toEqual([1, 1, 2]);
    expect(p.hasEasier(run[2])).toBe(false);
    expect(p.easier(run[2])).toBe(null);
    const q = new RunPicker(set, 'explorer', { itemsPerRun: 5, startTier: 2, rng: mulberry32(3) });
    const first = q.next()!;
    expect(first.tier).toBe(2);
    expect(q.hasEasier(first)).toBe(true);
    expect(q.easier(first)!.tier).toBe(1);
  });
});

describe('results recap', () => {
  const o = (score: 1 | 2 | 3) => ({ score, bossPassedNow: false });
  it('"Perfect" needs a clean run, not a 3 rounded up from a slip or a hint', () => {
    expect(recapFor(o(3), 'Count the hops', 'explorer', false, [r(3), r(3)])).toBe('Perfect! You found the best way!');
    expect(recapFor(o(3), 'Count the hops', 'explorer', false, [r(2, { mistakes: 1 }), r(3), r(3), r(3), r(3)])).toBe('Great job! You kept thinking.');
    expect(recapFor(o(3), 'Count the hops', 'explorer', false, [r(3, { hintLevel: 1 })])).toBe('Great job! You kept thinking.');
  });
  it('the Golden Rules mission recaps its checklist; real games their result', () => {
    expect(recapFor(o(2), 'Golden Rules', 'explorer', true, [r(2, { stats: { rules: 3 } })])).toBe('You got 3 of 5 Golden Rules!');
    expect(recapFor(o(3), 'Golden Rules', 'champion', true, [r(3, { stats: { rules: 5 } })])).toBe('5 of 5 Golden Rules.');
    expect(recapFor(o(2), 'Snack Race', 'explorer', true, [r(2, { outcome: 'draw' })])).toBe("A draw! That's a good fight.");
  });
  it('each kind of Playground game has its own recap; a game with a friend cheers both players', () => {
    expect(playgroundRecap('stars', 'explorer', false, false, [r(3)], 3)).toBe('Great hunting!');
    expect(playgroundRecap('puzzles', 'sprout', false, false, [r(2)], 2)).toBe('Puzzle power! Great thinking!');
    expect(playgroundRecap('board-vision', 'champion', false, false, [r(1)], 1)).toBe('Quick eyes! Try to beat your best.');
    expect(playgroundRecap('memory', 'explorer', false, false, [r(3)], 3)).toBe('What a memory! Pip is amazed!');
    expect(playgroundRecap('gobble', 'champion', false, false, [r(3)], 3)).toBe('Last piece standing! Well solved.');
    expect(playgroundRecap('play-bot', 'explorer', false, true, [r(3, { outcome: 'win' })], 3)).toBe('You won! Brilliant playing!');
    expect(playgroundRecap('battle', 'explorer', false, true, [r(1, { outcome: 'loss' })], 1)).toBe('Good game! Every game makes you stronger.');
    expect(playgroundRecap('capture-crown', 'explorer', true, true, [r(1, { outcome: 'loss' })], 1)).toBe('What a game! High five, you two!');
    expect(playgroundRecap('something-new', 'explorer', false, false, [r(2)], 2)).toBe('Great playing!');
  });
});

/** Fake pack lists for the missing-pack rules (5.2). */
function fakeRegistry(nodeIds: string[]): Registry {
  const act: ActivityDef = { id: 'fake', title: 'Fake', icon: 'star', Component: () => null, validate: () => [] };
  const pack: KidsPack = { id: 'core', activities: [act], levelSets: nodeIds.map((id) => ({ id, activity: 'fake', items: [{}] })) };
  return createRegistry([pack]);
}

describe('unlocking with missing packs', () => {
  it('(a) framework only: w1-w6 playable; w7 opens after w6 registered nodes are starred', () => {
    const k = kidOf('explorer');
    for (const w of ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'] as const) {
      expect(worldUnlocked(k, w, REG), w).toBe(true);
      for (const n of nodesOf(w).filter((x) => REG.isRegistered(x.id) && x.bands.includes('explorer') && !x.bonus)) {
        expect(nodeUnlocked(k, n.id, REG), n.id).toBe(true);
        starNode(k, n.id, 3);
      }
    }
    expect(worldUnlocked(k, 'w7', REG)).toBe(true);
    expect(nodeUnlocked(k, 'w7-check', REG)).toBe(true);
  });
  it('(b) a world whose boss is unregistered passes when its registered nodes have a star', () => {
    const k = kidOf();
    const reg = fakeRegistry(['w5-pawn-steps', 'w5-promo']);
    expect(worldPassed(k, 'w5', reg)).toBe(false);
    starNode(k, 'w5-pawn-steps', 1, reg);
    expect(worldPassed(k, 'w5', reg)).toBe(false);
    starNode(k, 'w5-promo', 1, reg);
    expect(worldPassed(k, 'w5', reg)).toBe(true);
  });
  it('(c) a world with no registered nodes passes automatically', () => {
    const k = kidOf();
    expect(worldPassed(k, 'w8', fakeRegistry([]))).toBe(true);
  });
  it('(d) graduation is unavailable without w8-crown', () => {
    const k = kidOf();
    expect(canGraduate(k, REG)).toBe(false);
    const reg = fakeRegistry(['w8-crown', 'w8-mate-hunt']);
    starNode(k, 'w8-mate-hunt', 2, reg);
    recordRun(k, { nodeId: 'w8-crown', results: [r(3, { outcome: 'win' })], itemIds: ['c1'], game: true }, reg, TODAY);
    expect(canGraduate(k, reg)).toBe(true);
  });
  it('nodes open in order; unregistered nodes are skipped by the chain', () => {
    const k = kidOf('explorer');
    expect(nodeUnlocked(k, 'w1-hello', REG)).toBe(true);
    expect(nodeUnlocked(k, 'w1-rook-stars', REG)).toBe(false);
    starNode(k, 'w1-hello', 1);
    expect(nodeUnlocked(k, 'w1-rook-stars', REG)).toBe(true);
    starNode(k, 'w1-rook-stars', 1);
    expect(nodeUnlocked(k, 'w1-boss', REG)).toBe(true);
    expect(nextNode(k, REG)!.id).toBe('w1-boss');
  });
});

describe('boss rules', () => {
  it('Sprouts pass a non-game boss at 1 star; Explorers and Champions need 2', () => {
    const s = kidOf('sprout');
    starNode(s, 'w1-boss', 1);
    expect(bossPassed(s, NODE_BY_ID.get('w1-boss')!)).toBe(true);
    for (const band of ['explorer', 'champion'] as const) {
      const k = kidOf(band);
      starNode(k, 'w1-boss', 1);
      expect(bossPassed(k, NODE_BY_ID.get('w1-boss')!)).toBe(false);
      starNode(k, 'w1-boss', 2);
      expect(bossPassed(k, NODE_BY_ID.get('w1-boss')!)).toBe(true);
    }
  });
  it('non-game boss: practice after 2 attempts, skip after 3', () => {
    const k = kidOf('explorer');
    const boss = NODE_BY_ID.get('w1-boss')!;
    starNode(k, 'w1-boss', 1);
    expect(bossOffers(k, boss)).toMatchObject({ practice: false, skip: false });
    starNode(k, 'w1-boss', 1);
    expect(bossOffers(k, boss)).toMatchObject({ practice: true, skip: false });
    starNode(k, 'w1-boss', 1);
    expect(bossOffers(k, boss)).toMatchObject({ practice: true, skip: true });
  });
  it('game bosses: losses 2, 3 and 4 give offer, auto-ease and skip', () => {
    expect(gameLossStep(1)).toBe('none');
    expect(gameLossStep(2)).toBe('offer');
    expect(gameLossStep(3)).toBe('auto-ease');
    expect(gameLossStep(4)).toBe('skip');
    const reg = fakeRegistry(['w5-boss']);
    const k = kidOf('explorer');
    const boss = NODE_BY_ID.get('w5-boss')!;
    const lose = () => recordRun(k, { nodeId: 'w5-boss', results: [r(1, { outcome: 'loss' })], itemIds: ['e1'], game: true }, reg, TODAY);
    lose();
    lose();
    expect(bossOffers(k, boss).easeOffer).toBe(true);
    expect(lose().easeAuto).toBe(true);
    expect(k.nodes['w5-boss'].ease).toBe(1);
    lose();
    expect(bossOffers(k, boss).skip).toBe(true);
    expect(k.nodes['w5-boss'].stars).toBe(1);
  });
  it('every game gets the ease ladder, a buddy game as well as a boss, while the item has a step left', () => {
    const reg = fakeRegistry(['w6-battles', 'w5-boss']);
    const k = kidOf('explorer');
    const node = NODE_BY_ID.get('w6-battles')!;
    expect(node.boss).toBeFalsy();
    const lose = (id: string, easeSteps?: number) => recordRun(k, { nodeId: id, results: [r(1, { outcome: 'loss' })], itemIds: ['knight-3'], game: true, easeSteps }, reg, TODAY);
    expect(lose('w6-battles', 2).easeAuto).toBe(false);
    expect(lose('w6-battles', 2).easeAuto).toBe(false);
    // Loss 2 offers a sleepier buddy; a game that is not a boss never needs "Skip for now".
    expect(bossOffers(k, node, 2)).toEqual({ practice: false, skip: false, easeOffer: true });
    expect(lose('w6-battles', 2).easeAuto).toBe(true);
    expect(k.nodes['w6-battles'].ease).toBe(1);
    expect(lose('w6-battles', 2).easeAuto).toBe(true);
    expect(k.nodes['w6-battles'].ease).toBe(2);
    // The ladder is used up: no more easing, and nothing to say about it.
    expect(lose('w6-battles', 2).easeAuto).toBe(false);
    expect(k.nodes['w6-battles'].ease).toBe(2);
    expect(bossOffers(k, node, 2).skip).toBe(false);
    // A win resets the losses; the ease step stays for the grown-up report.
    recordRun(k, { nodeId: 'w6-battles', results: [r(3, { outcome: 'win' })], itemIds: ['knight-3'], game: true, easeSteps: 2 }, reg, TODAY);
    expect(k.nodes['w6-battles'].losses).toBe(0);
    expect(bossOffers(k, node, 2).easeOffer).toBe(false);
    // With no step left, "Play sleepier?" is not offered either.
    const k2 = kidOf('explorer');
    for (let i = 0; i < 2; i++) recordRun(k2, { nodeId: 'w5-boss', results: [r(1, { outcome: 'loss' })], itemIds: ['b-e'], game: true, easeSteps: 0 }, reg, TODAY);
    expect(bossOffers(k2, NODE_BY_ID.get('w5-boss')!, 0).easeOffer).toBe(false);
  });
  it('w8-crown never offers skip', () => {
    expect(gameLossStep(6, true)).not.toBe('skip');
    const reg = fakeRegistry(['w8-crown']);
    const k = kidOf('explorer');
    for (let i = 0; i < 6; i++) recordRun(k, { nodeId: 'w8-crown', results: [r(1, { outcome: 'loss' })], itemIds: ['c'], game: true }, reg, TODAY);
    expect(bossOffers(k, NODE_BY_ID.get('w8-crown')!).skip).toBe(false);
  });
  it('skip unlocks the next world but blocks crowns and graduation', () => {
    const k = kidOf('explorer');
    starNode(k, 'w1-hello', 3);
    starNode(k, 'w1-rook-stars', 3);
    expect(worldUnlocked(k, 'w2', REG)).toBe(false);
    skipNode(k, 'w1-boss');
    expect(worldUnlocked(k, 'w2', REG)).toBe(true);
    expect(crownOf(k, 'w1', REG)).toBe(null);
    const reg = fakeRegistry(['w8-crown']);
    skipNode(k, 'w8-crown');
    expect(canGraduate(k, reg)).toBe(false);
  });
});

describe('fast track', () => {
  it('offers the boss after two clean 3-star nodes, and passing it tests the skipped nodes', () => {
    const k = kidOf('explorer');
    applyPlacement(k, [1, 2], TODAY);
    const clean = (id: string) => recordRun(k, { nodeId: id, results: [r(3), r(3)], itemIds: ['a', 'b'] }, REG, TODAY);
    clean('w3-queen-stars');
    expect(fastTrackOffer(k, 'w3-queen-stars', REG)).toBe(null);
    clean('w3-king-stars');
    expect(fastTrackOffer(k, 'w3-king-stars', REG)?.id).toBe('w3-boss');
    expect(nodeUnlocked(k, 'w3-boss', REG)).toBe(false);
    acceptFastTrack(k, 'w3-boss');
    expect(nodeUnlocked(k, 'w3-boss', REG)).toBe(true);
    recordRun(k, { nodeId: 'w3-boss', results: [r(3)], itemIds: ['b2'] }, REG, TODAY);
    expect(k.nodes['w3-king-lava']).toMatchObject({ stars: 1, tested: true });
    expect(worldPassed(k, 'w3', REG)).toBe(true);
  });
  it('no offer after a mistake', () => {
    const k = kidOf('explorer');
    applyPlacement(k, [1, 2], TODAY);
    recordRun(k, { nodeId: 'w3-queen-stars', results: [r(3), r(3, { mistakes: 1 })], itemIds: ['a', 'b'] }, REG, TODAY);
    recordRun(k, { nodeId: 'w3-king-stars', results: [r(3)], itemIds: ['a'] }, REG, TODAY);
    expect(fastTrackOffer(k, 'w3-king-stars', REG)).toBe(null);
  });
});

describe('placement', () => {
  it('checkpoints exist for w1-w8 and use only stars or find-move', () => {
    for (let i = 1; i <= 8; i++) {
      const cp = CHECKPOINTS.get(`cp${i}`)!;
      expect(cp, `cp${i}`).toBeTruthy();
      expect(['stars', 'find-move']).toContain(cp.activity);
      expect(cp.items.length).toBe(3);
    }
  });
  it('2 of 3 passes; a world passed marks every visible node tested with 1 star and no stickers', () => {
    expect(placementWorldPassed([r(3), r(2), r(1)])).toBe(true);
    expect(placementWorldPassed([r(3), r(2, { hintLevel: 2 }), r(1)])).toBe(false);
    const k = kidOf('explorer');
    applyPlacement(k, [1, 2], TODAY);
    expect(k.nodes['w1-hello']).toMatchObject({ stars: 1, tested: true });
    expect(k.nodes['w2-treasure-map']).toMatchObject({ stars: 1, tested: true });
    expect(Object.keys(k.stickers)).toEqual([]);
    expect(worldUnlocked(k, 'w3', REG)).toBe(true);
  });
  it('a lower starting world in Grown-ups takes back the placement passes, not played nodes', () => {
    const k = kidOf('explorer');
    startAtRank(k, 4, TODAY);
    expect(worldUnlocked(k, 'w4', REG)).toBe(true);
    recordRun(k, { nodeId: 'w3-queen-stars', results: [r(3)], itemIds: ['a'] }, REG, TODAY);
    startAtRank(k, 1, TODAY);
    expect(k.testedOut).toBe(0);
    expect(worldUnlocked(k, 'w2', REG)).toBe(false);
    expect(k.nodes['w1-hello']).toBeUndefined();
    expect(k.nodes['w3-queen-stars']).toMatchObject({ stars: 3, plays: 1 });
    expect(k.nodes['w3-queen-stars'].passed).toBeUndefined();
    startAtRank(k, 2, TODAY);
    expect(worldUnlocked(k, 'w2', REG)).toBe(true);
    expect(worldUnlocked(k, 'w3', REG)).toBe(false);
  });
  it('a "real games" Champion who passes cp3-cp5 starts at w6', () => {
    let s = placementStart('games');
    expect(s.world).toBe(3);
    s = placementStep(s, true, 8);
    expect(s.tested).toEqual([1, 2, 3]);
    s = placementStep(s, true, 8);
    s = placementStep(s, true, 8);
    s = placementStep(s, false, 8);
    expect(s.done).toBe(true);
    expect(s.startWorld).toBe(6);
    expect(s.tested).toEqual([1, 2, 3, 4, 5]);
  });
  it('failing w3 from "real games" restarts at w1', () => {
    let s = placementStart('games');
    s = placementStep(s, false, 8);
    expect(s).toMatchObject({ world: 1, restarted: true, done: false });
    s = placementStep(s, true, 8);
    s = placementStep(s, false, 8);
    expect(s).toMatchObject({ done: true, startWorld: 2, tested: [1] });
  });
  it('the Sprout cap stops at w5', () => {
    let s = placementStart('moves');
    for (let i = 0; i < 5; i++) s = placementStep(s, true, BAND_TUNING.sprout.placementCap);
    expect(s.done).toBe(true);
    expect(s.startWorld).toBe(6);
    expect(s.tested).toEqual([1, 2, 3, 4, 5]);
  });
  it('puzzle rating is 600 + 40 per world, capped at 850', () => {
    const k = kidOf('champion');
    applyPlacement(k, [1, 2, 3], TODAY);
    expect(k.puzzle.rating).toBe(720);
    applyPlacement(k, [1, 2, 3, 4, 5, 6, 7], TODAY);
    expect(k.puzzle.rating).toBe(850);
  });
  it('a real completion replaces tested and grants the sticker', () => {
    const k = kidOf();
    applyPlacement(k, [1], TODAY);
    starNode(k, 'w1-hello', 2);
    expect(k.nodes['w1-hello'].tested).toBeUndefined();
    expect(k.stickers['s-w1-hello']).toBeTruthy();
  });
});

describe('rewards', () => {
  it('family jar: every 100 stars is a party with a sticker for every kid', () => {
    const s = defaultKidsState();
    s.kids = [kidOf(), { ...kidOf(), id: 'k2' }];
    s.family.stars = 98;
    expect(addFamilyStars(s, 1)).toBe(null);
    expect(addFamilyStars(s, 3)).toBe(1);
    expect(s.kids.every((k) => k.stickers['st-family-1'])).toBe(true);
  });
  it('hats unlock by stars; brave try sticker; garden flowers once per day', () => {
    const k = kidOf();
    for (const id of ['w1-hello', 'w1-rook-stars', 'w1-boss', 'w2-bishop-stars']) starNode(k, id, 3);
    expect(k.wardrobe).toContain('red-scarf');
    expect(k.garden).toBe(1);
    recordRun(k, { nodeId: 'w2-boss', results: [r(1, { mistakes: 4 })], itemIds: ['b1'], braveTry: true }, REG, '2026-09-21');
    expect(k.stickers['st-brave-try']).toBeTruthy();
    expect(k.garden).toBe(2);
  });
});

describe('miniRules', () => {
  const blocked = new Set<string>();
  it('dests for every piece', () => {
    expect(dests('R', 'd4', { blocked }).length).toBe(14);
    expect(dests('N', 'a1', { blocked }).sort()).toEqual(['b3', 'c2']);
    expect(dests('B', 'd4', { blocked }).length).toBe(13);
    expect(dests('Q', 'd4', { blocked }).length).toBe(27);
    expect(dests('K', 'e1', { blocked }).length).toBe(5);
    expect(dests('P', 'e2', { blocked }).sort()).toEqual(['e3', 'e4']);
    expect(dests('P', 'e3', { blocked })).toEqual(['e4']);
    expect(dests('P', 'e2', { blocked: new Set(['e3']) })).toEqual([]);
    expect(dests('P', 'e2', { blocked, capturable: new Set(['d3', 'e3']) })).toEqual(['d3']);
    expect(dests('R', 'a1', { blocked, capturable: new Set(['a5', 'e1']), mustCapture: true }).sort()).toEqual(['a5', 'e1']);
    expect(dests('p', 'e7', { blocked }).sort()).toEqual(['e5', 'e6']);
    expect(dests('R', 'a1', { blocked, area: sqRange('a1:d4') }).length).toBe(6);
  });
  it('attacks and lava', () => {
    expect(attacks('p', 'e5', new Set()).sort()).toEqual(['d4', 'f4']);
    expect(attacks('R', 'a1', new Set(['a3'])).includes('a4')).toBe(false);
    expect([...lavaSquares({ c3: 'n' }, new Set())].sort()).toEqual(['a2', 'a4', 'b1', 'b5', 'd1', 'd5', 'e2', 'e4']);
  });
  it('placementFen and applyMove', () => {
    expect(placementFen({ a1: 'R' })).toBe('8/8/8/8/8/8/8/R7 w - - 0 1');
    expect(applyMove({ b7: 'P' }, 'b7', 'b8')).toEqual({ b8: 'Q' });
    expect(pseudoMoves({ e2: 'P', d3: 'n' }, 'w').map((m) => m.to).sort()).toEqual(['d3', 'e3', 'e4']);
  });
  it('gobble solution counts', () => {
    expect(gobbleSolutions({ pieces: { a1: 'R' }, targets: { a5: 'p', e5: 'n', e8: 'b' } }).length).toBe(1);
    expect(gobbleSolutions({ pieces: { a1: 'R' }, targets: { a4: 'p', d4: 'p', d7: 'p', g7: 'p', g1: 'p' } }).length).toBe(2);
    expect(gobbleSolutions({ pieces: { b1: 'N' }, targets: { c3: 'p', d5: 'p', f6: 'p', e4: 'p' } }).length).toBe(2);
    expect(gobbleSolutions({ pieces: { d1: 'Q' }, targets: { d4: 'p', a7: 'p', g4: 'p', g7: 'p', b4: 'p' } }).length).toBe(3);
    expect(gobbleSolutions({ pieces: { d1: 'Q' }, targets: { c5: 'p', h5: 'p', d4: 'p' }, bite: true })).toEqual([['h5', 'c5', 'd4']]);
  });
});

describe('playable dests', () => {
  it('insufficient-material teaching positions stay playable; mate and stalemate do not', () => {
    expect(playableDests('4k3/8/8/8/4N3/8/8/4K3 w - - 0 1', 'w')['e4']?.sort()).toEqual(['c3', 'c5', 'd2', 'd6', 'f2', 'f6', 'g3', 'g5']);
    expect(playableDests('4k3/8/8/8/8/8/8/1B2K3 w - - 0 1', 'w')['b1']?.length).toBeGreaterThan(0);
    expect(playableDests('4k3/8/8/8/4N3/8/8/4K3 w - - 0 1', 'b')).toEqual({});
    expect(playableDests('k7/1Q6/1K6/8/8/8/8/8 b - - 0 1')).toEqual({});
    expect(playableDests('k7/2Q5/1K6/8/8/8/8/8 b - - 0 1')).toEqual({});
  });
});

describe('danger', () => {
  it('Kf1 leaves the rook hanging; Kd2 defends it', () => {
    const fen = '4k3/8/8/8/3n4/8/2R5/4K3 w - - 0 1';
    const c = new Chess(fen);
    const kf1 = c.moves({ verbose: true }).find((m) => m.san === 'Kf1')!;
    const kd2 = c.moves({ verbose: true }).find((m) => m.san === 'Kd2')!;
    expect(dangerAfterMove(fen, kf1, 3)).toMatchObject({ sq: 'c2', loss: 5 });
    expect(dangerAfterMove(fen, kd2, 3)).toBe(null);
  });
  it('an equal knight trade gives no alarm', () => {
    const fen = '4k3/8/2n5/8/3n4/5N2/8/4K3 w - - 0 1';
    const c = new Chess(fen);
    const m = c.moves({ verbose: true }).find((x) => x.san === 'Nxd4')!;
    expect(dangerAfterMove(fen, m, 3)).toBe(null);
  });
  it('a mating move gives no alarm, and a fork fixture flags the loss', () => {
    const fen = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
    const m = new Chess(fen).moves({ verbose: true }).find((x) => x.san === 'Ra8#')!;
    expect(dangerAfterMove(fen, m, 3)).toBe(null);
    // Black's knight forks king and rook: the rook hangs.
    expect(hangs('4k3/8/8/8/8/8/2n5/R3K3 w - - 0 1', 'w')[0]).toMatchObject({ sq: 'a1', loss: 5 });
  });
  it('escape fixture: at most one alarm per move', () => {
    const fen = withTurn('4k3/8/8/8/4r3/8/2B5/R2QK3 w - - 0 1', 'w');
    for (const m of new Chess(fen).moves({ verbose: true })) {
      const a = dangerAfterMove(fen, m, 3);
      expect(a === null || typeof a.sq === 'string').toBe(true);
    }
  });
});

describe('store', () => {
  it('normalizeKids handles garbage, missing fields, v mismatch and too many kids', () => {
    expect(normalizeKids(null)).toEqual(defaultKidsState());
    expect(normalizeKids('x')).toEqual(defaultKidsState());
    expect(normalizeKids({ v: 2, kids: [{ id: 'a' }] }).kids).toEqual([]);
    const s = normalizeKids({ v: 1, kids: [{ id: 'a', name: 'A very long name here', band: 'zzz', nodes: { 'w1-hello': { stars: 9 } } }], activeKid: 'nope' });
    expect(s.kids[0].name.length).toBeLessThanOrEqual(12);
    expect(s.kids[0].band).toBe('explorer');
    expect(s.kids[0].nodes['w1-hello'].stars).toBe(0);
    expect(s.activeKid).toBe(null);
    const many = normalizeKids({ v: 1, kids: Array.from({ length: 12 }, (_, i) => ({ id: `k${i}` })) });
    expect(many.kids.length).toBe(8);
  });
  it('the seen ring is capped at 300 and days pruned to 60', () => {
    const s = defaultKidsState();
    const k = kidOf();
    k.puzzle.seen = Array.from({ length: 400 }, (_, i) => `p${i}`);
    for (let i = 0; i < 80; i++) k.days[addDays('2026-01-01', i)] = { minutes: 1, stars: 0 };
    s.kids = [k];
    pruneForSave(s);
    expect(k.puzzle.seen.length).toBe(SEEN_MAX);
    expect(k.puzzle.seen[0]).toBe('p100');
    expect(Object.keys(k.days).length).toBe(60);
  });
  it('localStorage throwing falls back to memory', () => {
    const bad = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => undefined,
    };
    expect(readKids(bad)).toEqual(defaultKidsState());
    expect(writeKids(defaultKidsState(), bad)).toBe(false);
    const mem = new Map<string, string>();
    const ok = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const st = defaultKidsState();
    st.kids = [kidOf()];
    expect(writeKids(st, ok)).toBe(true);
    expect(readKids(ok).kids[0].name).toBe('Mia');
  });
});

describe('privacy and isolation', () => {
  it('cloud sync never touches kids data', () => {
    expect(cloudSource.includes('kids')).toBe(false);
    expect(cloudSource.includes('tempo.kids')).toBe(false);
  });
  it('kids key is separate from the profile key', () => {
    expect(KIDS_KEY).toBe('tempo.kids.v1');
    expect(KIDS_KEY).not.toBe('tempo.profile.v1');
  });
  it('no kids file imports chess/sound', () => {
    expect(Object.keys(KIDS_SOURCES).length).toBeGreaterThan(30);
    for (const [f, src] of Object.entries(KIDS_SOURCES)) expect(/from ['"][./]*chess\/sound['"]/.test(src), f).toBe(false);
  });
  it('no kids file searches the engine with elo', () => {
    for (const [f, src] of Object.entries(KIDS_SOURCES)) expect(/engine\.search\([^)]*elo/.test(src), f).toBe(false);
  });
});

describe('pronounce', () => {
  it('reads squares and moves aloud', () => {
    expect(pronounce('e4')).toBe('e four');
    expect(pronounce('a1')).toBe('ay one');
    expect(pronounce('Qb7#')).toBe('queen b seven, checkmate');
    expect(pronounce('O-O')).toBe('castles king side');
    expect(pronounce('O-O-O')).toBe('castles queen side');
    expect(pronounce('exd5')).toBe('e takes d five');
    expect(pronounce('e8=Q')).toBe('e eight becomes a queen');
    expect(pronounce('Get the stars!')).toBe('Get the stars!');
  });
});
