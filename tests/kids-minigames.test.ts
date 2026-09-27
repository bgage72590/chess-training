// Pack B: Pawn Wars, Mini Battles and Capture the Crown (spec 15, kids-minigames).
import { describe, expect, it } from 'vitest';
import type { AgeBand, LevelSet, Placement } from '../src/kids/activities/types';
import { battleMoves, battleOutcome, battleRules, initialState, playBattle, validateBattle, type BattleItem, type BattleState } from '../src/kids/activities/battle/logic';
import { evaluate, miniBotMove } from '../src/kids/activities/battle/miniBot';
import { crownMoves, crownOutcome, kingInDanger, playCrown, validateCrown, type CrownItem, type CrownState } from '../src/kids/activities/captureCrown/logic';
import { crownBotMove } from '../src/kids/activities/captureCrown/crownBot';
import { minigamesPack, MINIGAMES_PLAYGROUND, W5_BOSS, W6_BATTLES } from '../src/kids/content/minigames';
import { ACTIVITIES, LEVEL_SETS, PLAYGROUND } from '../src/kids/packs';
import { resolveItem } from '../src/kids/curriculum/tuning';
import { NODE_BY_ID } from '../src/kids/curriculum/worlds';
import { mulberry32 } from '../src/kids/lib/rng';
import { fenPlacement } from '../src/kids/lib/fen';

const BANDS: AgeBand[] = ['sprout', 'explorer', 'champion'];
const WAR: BattleItem = { white: { a2: 'P', b2: 'P', c2: 'P' }, black: { a7: 'p', b7: 'p', c7: 'p' }, area: 'a1:c8', win: 'promote', bot: { depth: 2, r: 0 } };

/** Plays a whole game bot against bot; returns the outcome and the number of plies. */
function selfPlay(item: BattleItem, seed: number, maxPlies = 300) {
  const rules = battleRules(item);
  const rng = mulberry32(seed);
  let st: BattleState = initialState(item);
  for (let ply = 0; ply < maxPlies; ply++) {
    const legal = battleMoves(rules, st);
    const m = miniBotMove(rules, st, item.bot, rng)!;
    expect(legal.some((x) => x.from === m.from && x.to === m.to)).toBe(true);
    const mover = st.turn;
    const next = playBattle(st, m);
    const o = battleOutcome(rules, next, mover, next.promoted);
    if (o) return { o, ply };
    st = next;
  }
  return { o: null, ply: maxPlies };
}

describe('registration', () => {
  it('registers the Pack B level sets and activities', () => {
    for (const id of ['w5-pawn-war-mini', 'w5-boss', 'w6-battles', 'w6-crown-game']) {
      const set = LEVEL_SETS.get(id)!;
      expect(set, id).toBeTruthy();
      expect(NODE_BY_ID.get(id)?.activity).toBe(set.activity);
      expect(ACTIVITIES.get(set.activity)?.game).toBe(true);
    }
  });
  it('every playground entry validates and has a friend twin', () => {
    for (const e of MINIGAMES_PLAYGROUND) {
      expect(PLAYGROUND).toContain(e);
      const act = ACTIVITIES.get(e.activity)!;
      for (const band of BANDS) expect(act.validate(resolveItem(e.item as never, band, {}), band), `${e.id} ${band}`).toEqual([]);
    }
    const ids = new Set(MINIGAMES_PLAYGROUND.map((e) => e.id));
    for (const id of ['pawn-war-3', 'pawn-war-8', 'knight-pawns', 'queen-pawns', 'crown']) {
      expect(ids.has(id)).toBe(true);
      expect(MINIGAMES_PLAYGROUND.find((e) => e.id === `${id}-friend`)?.friend).toBe(true);
    }
  });
  it('every ease step validates, and every game boss item ends with a random bot', () => {
    for (const set of minigamesPack.levelSets as LevelSet<Record<string, unknown>>[]) {
      const act = ACTIVITIES.get(set.activity)!;
      for (const item of set.items) {
        for (const band of BANDS) {
          if (item.bands && !item.bands.includes(band)) continue;
          for (let ease = 0; ease <= (item.ease?.length ?? 0); ease++) expect(act.validate(resolveItem(item, band, { ease }), band), `${set.id} ${item.id} ${band} ${ease}`).toEqual([]);
        }
      }
    }
    for (const item of W5_BOSS.items) {
      const last = resolveItem(item, 'explorer', { ease: item.ease!.length }) as BattleItem;
      expect(last.bot.r).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('battle rules', () => {
  it('validate catches bad items', () => {
    expect(validateBattle({ ...WAR, bot: { depth: 5 as 1, r: 0 } }, 'explorer')).toContain('bot depth must be 1-4');
    expect(validateBattle({ ...WAR, white: { d2: 'P' } }, 'explorer')).toContain('d2 is outside the area');
    expect(validateBattle({ ...WAR, white: { a2: 'P' }, black: { a3: 'p' } }, 'explorer').join()).toMatch(/no move/);
    expect(validateBattle(WAR, 'sprout')).toEqual([]);
  });
  it('a pawn reaching the last rank wins (promote)', () => {
    const item: BattleItem = { ...WAR, white: { a7: 'P' }, black: { c7: 'p' } };
    const rules = battleRules(item);
    const next = playBattle(initialState(item), { from: 'a7', to: 'a8' });
    expect(next.promoted).toBe(true);
    expect(next.pos.a8).toBe('Q');
    expect(battleOutcome(rules, next, 'w', next.promoted)).toEqual({ winner: 'w', reason: 'promote' });
  });
  it('the side to move with no legal move means a tie', () => {
    const item: BattleItem = { ...WAR, white: { a4: 'P', c2: 'P' }, black: { a5: 'p' } };
    const rules = battleRules(item);
    const next = playBattle(initialState(item), { from: 'c2', to: 'c3' });
    expect(battleOutcome(rules, next, 'w', false)).toEqual({ winner: null, reason: 'stuck' });
  });
  it('Queen vs 8 pawns loses when a pawn promotes', () => {
    const q = W6_BATTLES.items[1];
    const rules = battleRules(q);
    const st: BattleState = { pos: { h8: 'Q', b2: 'p', g7: 'p' }, turn: 'b', quiet: 0 };
    const next = playBattle(st, { from: 'b2', to: 'b1' });
    expect(battleOutcome(rules, next, 'b', next.promoted)?.winner).toBe('b');
    // ...and capturing every pawn wins.
    const last = playBattle({ pos: { a1: 'Q', a7: 'p' }, turn: 'w', quiet: 0 }, { from: 'a1', to: 'a7' });
    expect(battleOutcome(rules, last, 'w', false)).toEqual({ winner: 'w', reason: 'capture-all' });
  });
  it('stop-pawns is won when the last pawn is caught', () => {
    const k = W6_BATTLES.items[0];
    const rules = battleRules(k);
    const next = playBattle({ pos: { e5: 'N', f7: 'p' }, turn: 'w', quiet: 0 }, { from: 'e5', to: 'f7' });
    expect(battleOutcome(rules, next, 'w', false)).toEqual({ winner: 'w', reason: 'capture-all' });
    const pawnsGone = playBattle({ pos: { e5: 'N', f7: 'p', a1: 'n' }, turn: 'w', quiet: 0 }, { from: 'e5', to: 'f7' });
    expect(battleOutcome(rules, pawnsGone, 'w', false)?.reason).toBe('stop-pawns');
  });
  it('en passant only when the item allows it', () => {
    const item: BattleItem = { white: { e5: 'P', a2: 'P' }, black: { d7: 'p', h7: 'p' }, win: 'promote', enPassant: true, bot: { depth: 1, r: 0 } };
    const st = playBattle({ ...initialState(item), turn: 'b' }, { from: 'd7', to: 'd5' });
    expect(st.ep).toBe('d6');
    const on = battleMoves(battleRules(item), st);
    expect(on.some((m) => m.from === 'e5' && m.to === 'd6')).toBe(true);
    const taken = playBattle(st, { from: 'e5', to: 'd6' });
    expect(taken.pos.d5).toBeUndefined();
    expect(taken.captured).toBe('p');
    expect(battleMoves(battleRules({ ...item, enPassant: false }), st).some((m) => m.to === 'd6')).toBe(false);
    expect(battleMoves(battleRules(item, { enPassant: false }), st).some((m) => m.to === 'd6')).toBe(false);
  });
});

describe('miniBot', () => {
  it('always returns a legal pseudo move, and games end', () => {
    for (const item of [WAR, W6_BATTLES.items[0], W6_BATTLES.items[1], { ...W5_BOSS.items[1], bot: { depth: 2 as const, r: 0.3 } }])
      for (let seed = 1; seed <= 4; seed++) expect(selfPlay(item, seed).o).not.toBeNull();
  });
  it('takes a winning promotion and stops an unstoppable one at depth 2', () => {
    const item: BattleItem = { ...WAR, area: undefined, bot: { depth: 1, r: 3 } };
    const rules = battleRules(item);
    const win = miniBotMove(rules, { pos: { a2: 'p', h2: 'P', c7: 'p' }, turn: 'b', quiet: 0 }, item.bot, mulberry32(1));
    expect(win).toMatchObject({ from: 'a2', to: 'a1' });
    // White threatens b7-b8: at depth 2 the knight must take the pawn.
    const stop = miniBotMove(rules, { pos: { b7: 'P', d6: 'n', h7: 'p' }, turn: 'b', quiet: 0 }, { depth: 2, r: 0 }, mulberry32(2));
    expect(stop).toMatchObject({ from: 'd6', to: 'b7' });
  });
  it('the eval likes material and advanced pawns', () => {
    expect(evaluate({ a2: 'P' }, 'w')).toBeGreaterThan(0);
    expect(evaluate({ a6: 'P', h7: 'p' }, 'w')).toBeGreaterThan(evaluate({ a3: 'P', h7: 'p' }, 'w'));
    expect(evaluate({ d1: 'Q', a7: 'p' }, 'b')).toBeLessThan(0);
  });
  it('replies fast at the deepest content depth', () => {
    const item = W5_BOSS.items[2] as BattleItem;
    const rules = battleRules(item);
    const t = performance.now();
    miniBotMove(rules, initialState(item), item.bot, mulberry32(3));
    expect(performance.now() - t).toBeLessThan(700);
  });
  it('a kid playing sensible moves beats the Sprout bot', () => {
    // The kid side is played by a depth-2 search; the Sprout bot plays depth 1 with r = 1.
    const item = W5_BOSS.items[0] as BattleItem;
    const rules = battleRules(item);
    let wins = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const rng = mulberry32(seed);
      let st = initialState(item);
      for (let ply = 0; ply < 200; ply++) {
        const bot = st.turn === 'w' ? { depth: 2, r: 0 } : item.bot;
        const m = miniBotMove(rules, st, bot, rng)!;
        const mover = st.turn;
        const next = playBattle(st, m);
        const o = battleOutcome(rules, next, mover, next.promoted);
        if (o) {
          if (o.winner === 'w') wins++;
          break;
        }
        st = next;
      }
    }
    expect(wins).toBeGreaterThanOrEqual(6);
  });
});

describe('capture the crown', () => {
  const full = fenPlacement('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  it('validates starting armies', () => {
    expect(validateCrown({ placement: full, bot: 'playful' }, 'explorer')).toEqual([]);
    expect(validateCrown({ placement: { e1: 'K' }, bot: 'sleepy' }, 'explorer')).toContain('each side needs exactly one king');
    expect(validateCrown({ placement: full, bot: 'grumpy' as never }, 'explorer')).toContain('bad bot grumpy');
  });
  it('capturing the king wins', () => {
    const st: CrownState = { pos: { e1: 'K', e8: 'k', e2: 'Q' }, turn: 'w', quiet: 0 };
    const next = playCrown(st, { from: 'e2', to: 'e8' });
    expect(crownOutcome(next, 'w')).toEqual({ winner: 'w', reason: 'crown' });
  });
  it('sleepy always captures the king when it can', () => {
    const pos: Placement = { ...full, e1: undefined, e4: 'K' } as Placement;
    delete pos.e1;
    const st: CrownState = { pos: { ...pos, d5: 'p' }, turn: 'b', quiet: 0 };
    for (let seed = 1; seed <= 25; seed++) expect(crownBotMove(st, 'sleepy', mulberry32(seed))).toMatchObject({ to: 'e4', capture: 'K' });
    expect(crownBotMove(st, 'playful', mulberry32(1))?.capture).toBe('K');
    expect(crownBotMove(st, 'clever', mulberry32(1))?.capture).toBe('K');
  });
  it('danger bells fire for an en-prise king only', () => {
    expect(kingInDanger({ e1: 'K', e8: 'k', e4: 'q' }, 'w')).toBe('e4');
    expect(kingInDanger({ e1: 'K', e8: 'k', e4: 'q', e2: 'P' }, 'w')).toBeNull();
    expect(kingInDanger({ e1: 'K', e8: 'k', d2: 'n' }, 'w')).toBeNull();
    expect(kingInDanger({ e1: 'K', e8: 'k', d3: 'n' }, 'w')).toBe('d3');
    expect(kingInDanger(full, 'w')).toBeNull();
  });
  it('playful takes a free queen and clever avoids a poisoned one', () => {
    const st: CrownState = { pos: { e1: 'K', e8: 'k', d5: 'Q', e6: 'p', a7: 'p' }, turn: 'b', quiet: 0 };
    expect(crownBotMove(st, 'playful', mulberry32(1))).toMatchObject({ from: 'e6', to: 'd5' });
    expect(crownBotMove(st, 'clever', mulberry32(1))).toMatchObject({ from: 'e6', to: 'd5' });
    // Knight takes a pawn guarded by a pawn: clever declines (2-ply material), a free pawn is fine.
    const poisoned: CrownState = { pos: { a1: 'K', h8: 'k', d4: 'P', e3: 'P', f5: 'n', h2: 'P' }, turn: 'b', quiet: 0 };
    expect(crownBotMove(poisoned, 'clever', mulberry32(4))?.to).not.toBe('d4');
  });
  it('bot games end and every bot move is legal', () => {
    for (const bot of ['sleepy', 'playful', 'clever'] as const) {
      const rng = mulberry32(7);
      let st: CrownState = { pos: full, turn: 'w', quiet: 0 };
      let over = false;
      for (let ply = 0; ply < 600 && !over; ply++) {
        const m = crownBotMove(st, st.turn === 'w' ? 'sleepy' : bot, rng)!;
        expect(crownMoves(st).some((x) => x.from === m.from && x.to === m.to)).toBe(true);
        const mover = st.turn;
        const next = playCrown(st, m);
        over = !!crownOutcome(next, mover);
        st = next;
      }
      expect(over).toBe(true);
    }
  });
  it('the easiest crown step drops the knights', () => {
    const set = LEVEL_SETS.get('w6-crown-game') as LevelSet<CrownItem>;
    const knp = set.items[1];
    const last = resolveItem(knp, 'sprout', { ease: knp.ease!.length }) as CrownItem;
    expect(Object.values(last.placement)).not.toContain('n');
    expect(Object.values(last.placement)).toContain('N');
  });
});
