// Kids mode journey: how the back and close buttons walk the browser history, odd addresses, the
// results reveal's pace, and the star bookkeeping behind the family jar.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newKid, type KidProfile } from '../src/kids/store/kidsStore';
import {
  acceptFastTrack,
  addFamilyStars,
  applyPlacement,
  bossOffers,
  currentWorld,
  frontierNode,
  nextNode,
  nodeUnlocked,
  recordRun,
  skipNode,
  totalStars,
  worldUnlocked,
  type Registry,
} from '../src/kids/store/progress';
import { NODES, NODE_BY_ID } from '../src/kids/curriculum/worlds';
import { mulberry32 } from '../src/kids/lib/rng';
import { parseKidsRoute } from '../src/kids/routes';
import { routeParts } from '../src/router';
import { revealTiming } from '../src/kids/player/Results';
import { starsText } from '../src/kids/ui/StarRow';
import type { AgeBand, ItemResult } from '../src/kids/activities/types';

const REG: Registry = { isRegistered: () => true };
const TODAY = '2026-09-20';
const r = (score: 1 | 2 | 3): ItemResult => ({ score, mistakes: 0, hintLevel: 0 });
const kidOf = (band: AgeBand = 'explorer'): KidProfile => newKid({ name: 'Mia', band, start: 'new', id: 'k1', now: 0 });

describe('kids addresses', () => {
  it('a stray percent sign in a typed address is kept as text, never thrown', () => {
    expect(parseKidsRoute('kids/world/%')).toEqual({ screen: 'map' });
    expect(parseKidsRoute('kids/play/%E0%A4%A')).toEqual({ screen: 'play', node: '%E0%A4%A' });
    expect(routeParts('kids/world/%')).toEqual(['kids', 'world/%']);
    expect(routeParts('lesson/a%20b')).toEqual(['lesson', 'a b']);
  });

  it('only worlds 1 to 8 name a single placement world', () => {
    expect(parseKidsRoute('kids/placement/w3')).toEqual({ screen: 'placement', world: 3 });
    expect(parseKidsRoute('kids/placement/5')).toEqual({ screen: 'placement', world: 5 });
    for (const bad of ['w99', 'wabc', 'w0', 'x']) expect(parseKidsRoute(`kids/placement/${bad}`)).toEqual({ screen: 'placement', world: undefined });
    expect(parseKidsRoute('kids/placement')).toEqual({ screen: 'placement', world: undefined });
  });
});

/** A browser history in memory: pushState, replaceState and back (which fires popstate, as a browser does). */
async function browser(start = '#/kids/map') {
  vi.resetModules();
  const entries: { url: string; state: unknown }[] = [{ url: start, state: null }];
  let at = 0;
  const pop = new Set<() => void>();
  vi.stubGlobal('window', { addEventListener: (t: string, f: () => void) => t === 'popstate' && pop.add(f), scrollTo: () => {} });
  vi.stubGlobal('location', {
    get hash() {
      return entries[at].url;
    },
  });
  vi.stubGlobal('history', {
    get state() {
      return entries[at].state;
    },
    pushState(state: unknown, _t: string, url?: string) {
      entries.splice(at + 1);
      entries.push({ url: url ?? entries[at].url, state });
      at++;
    },
    replaceState(state: unknown, _t: string, url?: string) {
      entries[at] = { url: url ?? entries[at].url, state };
    },
    back() {
      if (at > 0) {
        at--;
        pop.forEach((f) => f());
      }
    },
  });
  const router = await import('../src/router');
  const { go } = await import('../src/kids/routes');
  return { go, route: router.currentRoute, entries, index: () => at };
}

describe('back and close buttons', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('close steps back when the entry before is the map, so Back never reopens the activity', async () => {
    const b = await browser();
    b.go.play('w1-hello');
    expect(b.route()).toBe('kids/play/w1-hello');
    b.go.upToMap();
    expect(b.route()).toBe('kids/map');
    expect(b.entries).toHaveLength(2);
    expect(b.index()).toBe(0);
  });

  it('otherwise the entry is replaced by the map, and Back returns to the screen before', async () => {
    const b = await browser();
    b.go.world('w1');
    b.go.play('w1-roads');
    b.go.upToMap();
    expect(b.route()).toBe('kids/map');
    expect(b.entries.map((e) => e.url)).toEqual(['#/kids/map', '#/kids/world/w1', '#/kids/map']);
    history.back();
    expect(b.route()).toBe('kids/world/w1');
  });

  it('a second tap while the first close is on its way does not step back twice', async () => {
    const b = await browser('#/kids');
    b.go.map();
    b.go.play('w1-hello');
    b.go.upToMap();
    b.go.upToMap();
    expect(b.route()).toBe('kids/map');
    expect(b.index()).toBe(1);
  });

  it('asking for the screen already showing adds no entry (a double tap on Play)', async () => {
    const b = await browser();
    b.go.play('w1-hello');
    b.go.play('w1-hello');
    expect(b.entries).toHaveLength(2);
  });

  it('a replaced entry keeps where it came from: results Next, then close, still steps back to the map', async () => {
    const b = await browser();
    b.go.play('w1-hello');
    b.go.play('w1-rook-stars', true);
    expect(b.entries).toHaveLength(2);
    b.go.upToMap();
    expect(b.route()).toBe('kids/map');
    expect(b.index()).toBe(0);
  });

  it('sticker book tabs replace one another, so the back arrow returns straight to the map', async () => {
    const b = await browser();
    b.go.stickers();
    b.go.stickers('trophies', true);
    b.go.stickers('wardrobe', true);
    expect(b.entries).toHaveLength(2);
    b.go.upToMap();
    expect(b.route()).toBe('kids/map');
    expect(b.index()).toBe(0);
  });

  it('in a frame that blocks history the route still changes in memory', async () => {
    const b = await browser();
    vi.stubGlobal('history', {
      get state() {
        throw new Error('blocked');
      },
      pushState() {
        throw new Error('blocked');
      },
      replaceState() {
        throw new Error('blocked');
      },
      back() {
        throw new Error('blocked');
      },
    });
    b.go.play('w1-hello');
    expect(b.route()).toBe('kids/play/w1-hello');
    b.go.upToMap();
    expect(b.route()).toBe('kids/map');
  });
});

describe('results reveal pace', () => {
  it('reduced motion brings the beats close together and nothing flies', () => {
    const full = revealTiming(false);
    const still = revealTiming(true);
    expect(still.fly).toBe(0);
    expect(still.drum).toBeLessThan(full.drum);
    expect(still.drum + still.gap * 2 + still.fly).toBeLessThan(full.drum + full.gap * 2 + full.fly);
  });

  it('reads star counts in the singular for one', () => {
    expect(starsText(0)).toBe('0 stars');
    expect(starsText(1)).toBe('1 star');
    expect(starsText(3)).toBe('3 stars');
  });
});

describe('stars for the family jar', () => {
  it('the first real play of a tested-out node earns every star, so the jar matches the total', () => {
    const k = kidOf();
    applyPlacement(k, [1], TODAY);
    expect(totalStars(k)).toBe(0);
    const out = recordRun(k, { nodeId: 'w1-hello', results: [r(3)], itemIds: ['a'] }, REG, TODAY);
    expect(out.gained).toBe(3);
    expect(totalStars(k)).toBe(3);
    expect(k.days[TODAY].stars).toBe(3);
    const s = { family: { stars: 0, parties: 0 }, kids: [k] };
    addFamilyStars(s as never, out.gained);
    expect(s.family.stars).toBe(totalStars(k));
  });

  it('a tested-out node replayed for one star still counts that star', () => {
    const k = kidOf();
    applyPlacement(k, [1], TODAY);
    const out = recordRun(k, { nodeId: 'w1-hello', results: [r(1)], itemIds: ['a'] }, REG, TODAY);
    expect(out.gained).toBe(1);
    expect(totalStars(k)).toBe(1);
  });

  it('passing a skipped boss adds only the stars it had not paid into the jar yet', () => {
    const k = kidOf();
    let jar = 0;
    const play = (score: 1 | 2 | 3) => {
      jar += recordRun(k, { nodeId: 'w1-boss', results: [r(score)], itemIds: ['b'] }, REG, TODAY).gained;
    };
    play(1);
    play(1);
    play(1);
    expect(bossOffers(k, NODE_BY_ID.get('w1-boss')!).skip).toBe(true);
    skipNode(k, 'w1-boss');
    play(3);
    expect(k.nodes['w1-boss'].skipped).toBeUndefined();
    expect(jar).toBe(3);
    expect(totalStars(k)).toBe(3);
  });

  it('random play (test-outs, fast tracks, skips) keeps the jar equal to the total and the map sane', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const rng = mulberry32(seed);
      const band = (['sprout', 'explorer', 'champion'] as const)[Math.floor(rng() * 3)];
      const k = kidOf(band);
      let jar = 0;
      for (let step = 0; step < 50; step++) {
        if (step === 0 && rng() < 0.3)
          applyPlacement(
            k,
            Array.from({ length: 1 + Math.floor(rng() * 3) }, (_, i) => i + 1),
            TODAY,
          );
        const open = NODES.filter((n) => n.bands.includes(band) && nodeUnlocked(k, n.id, REG));
        if (!open.length) break;
        const node = open[Math.floor(rng() * open.length)];
        const roll = rng();
        if (node.boss && roll > 0.93) {
          skipNode(k, node.id);
          continue;
        }
        if (node.boss && roll > 0.9) acceptFastTrack(k, node.id);
        const score = (1 + Math.floor(rng() * 3)) as 1 | 2 | 3;
        const game = !!node.game;
        const results: ItemResult[] = [game ? { ...r(score), outcome: score === 3 ? 'win' : score === 2 ? 'draw' : 'loss' } : { ...r(score), mistakes: score === 3 ? 0 : 2 }];
        const out = recordRun(k, { nodeId: node.id, results, itemIds: ['a'], game }, REG, TODAY);
        jar += out.gained;
        const next = nextNode(k, REG);
        if (next) expect(nodeUnlocked(k, next.id, REG)).toBe(true);
        const front = frontierNode(k, REG);
        if (front) expect(nodeUnlocked(k, front.id, REG)).toBe(true);
        expect(worldUnlocked(k, currentWorld(k, REG), REG)).toBe(true);
        if (out.worldOpened) expect(worldUnlocked(k, out.worldOpened, REG)).toBe(true);
      }
      // A node that is skipped right now has paid stars the total does not show yet.
      if (!Object.values(k.nodes).some((n) => n.skipped)) expect(totalStars(k)).toBe(jar);
    }
  });
});
