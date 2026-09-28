// Kids mode motion: which way a screen change moves, and the "newly opened" marker behind the
// map's unlock animation.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteTrail, navDirection, routeDepth, screenKey } from '../src/kids/lib/navMotion';
import { MAX_FRESH, markOpened, newlyOpened, openIds, resetOpened } from '../src/kids/lib/unlockSeen';
import { parseKidsRoute } from '../src/kids/routes';
import { PACKS, createRegistry } from '../src/kids/packs';
import { newKid } from '../src/kids/store/kidsStore';
import { recordRun } from '../src/kids/store/progress';

const R = (route: string) => parseKidsRoute(`kids/${route}`);

describe('screen direction', () => {
  it('goes deeper into the app forward and back out backward', () => {
    expect(navDirection(R(''), R('map'))).toBe('forward');
    expect(navDirection(R('map'), R('world/w1'))).toBe('forward');
    expect(navDirection(R('map'), R('stickers'))).toBe('forward');
    expect(navDirection(R('world/w1'), R('map'))).toBe('back');
    expect(navDirection(R('map'), R('players'))).toBe('back');
    expect(navDirection(R('new'), R('placement'))).toBe('forward');
  });

  it('dives into an activity and surfaces from it', () => {
    expect(navDirection(R('map'), R('play/w1-hello'))).toBe('dive');
    expect(navDirection(R('world/w1'), R('play/w1-hello'))).toBe('dive');
    expect(navDirection(R('warmup'), R('play/w1-hello'))).toBe('dive');
    expect(navDirection(R('playground'), R('playground/free'))).toBe('dive');
    expect(navDirection(R('play/w1-hello'), R('play/w1-rook-stars'))).toBe('dive');
    expect(navDirection(R('play/w1-hello'), R('map'))).toBe('surface');
    expect(navDirection(R('playground/free'), R('playground'))).toBe('surface');
  });

  it('uses the trail for screens on the same level', () => {
    expect(navDirection(R('stickers'), R('playground'))).toBe('forward');
    expect(navDirection(R('stickers'), R('playground'), true)).toBe('back');
  });

  it('ranks every screen', () => {
    expect(routeDepth(R(''))).toBe(0);
    expect(routeDepth(R('map'))).toBe(1);
    expect(routeDepth(R('grownups'))).toBe(1);
    expect(routeDepth(R('stickers/trophies'))).toBe(2);
    expect(routeDepth(R('play/w1-hello'))).toBe(3);
  });

  it('keys one screen alike whatever its tab or kid, and an activity by what it plays', () => {
    expect(screenKey(R('stickers'))).toBe(screenKey(R('stickers/wardrobe')));
    expect(screenKey(R('grownups'))).toBe(screenKey(R('grownups/k1')));
    expect(screenKey(R('play/w1-hello'))).not.toBe(screenKey(R('play/w1-rook-stars')));
    expect(screenKey(R('playground'))).not.toBe(screenKey(R('playground/free')));
  });
});

describe('route trail', () => {
  it('has no direction for the first screen', () => {
    const t = new RouteTrail();
    expect(t.step(R('map'))).toEqual({ key: 'map', dir: null });
  });

  it('gives the same answer for the screen already shown (repeat renders, Strict Mode)', () => {
    const t = new RouteTrail();
    t.step(R('map'));
    const a = t.step(R('world/w1'));
    expect(a.dir).toBe('forward');
    expect(t.step(R('world/w1'))).toBe(a);
    expect(t.step(R('world/w1'))).toBe(a);
  });

  it('does not move for a tab change inside a screen', () => {
    const t = new RouteTrail();
    t.step(R('map'));
    const a = t.step(R('stickers'));
    expect(t.step(R('stickers/trophies'))).toBe(a);
  });

  it('follows a walk through the app and back', () => {
    const t = new RouteTrail();
    const dirs = ['players', 'map', 'world/w1', 'play/w1-hello', 'world/w1', 'map', 'players'].map((r) => t.step(R(r)).dir);
    expect(dirs).toEqual([null, 'forward', 'forward', 'dive', 'surface', 'back', 'back']);
  });

  it('tells a step back from a step forward on the same level', () => {
    const t = new RouteTrail();
    t.step(R('map'));
    t.step(R('stickers'));
    expect(t.step(R('playground')).dir).toBe('forward');
    // Browser back from the playground to the sticker book.
    expect(t.step(R('stickers')).dir).toBe('back');
    // Forward again is a new step.
    expect(t.step(R('playground')).dir).toBe('forward');
  });

  it('keeps a short trail', () => {
    const t = new RouteTrail();
    for (let i = 0; i < 100; i++) t.step(R(i % 2 ? 'stickers' : 'playground'));
    expect(t.step(R('map')).dir).toBe('back');
  });
});

describe('newly opened marker', () => {
  const REG = createRegistry(PACKS);
  const kid = () => newKid({ name: 'Mia', band: 'explorer', start: 'new', id: 'k1', now: 0 });
  const store = new Map<string, string>();

  beforeEach(() => {
    resetOpened();
    store.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('records a baseline on the first look and finds nothing', () => {
    expect(newlyOpened('k1', ['w1', 'w1-hello'])).toEqual([]);
    markOpened('k1', ['w1', 'w1-hello']);
    expect(newlyOpened('k1', ['w1', 'w1-hello'])).toEqual([]);
  });

  it('finds what opened since, once', () => {
    markOpened('k1', ['w1', 'w1-hello']);
    expect(newlyOpened('k1', ['w1', 'w1-hello', 'w1-rook-stars'])).toEqual(['w1-rook-stars']);
    markOpened('k1', ['w1', 'w1-hello', 'w1-rook-stars']);
    expect(newlyOpened('k1', ['w1', 'w1-hello', 'w1-rook-stars'])).toEqual([]);
  });

  it('keeps each kid apart', () => {
    markOpened('k1', ['w1']);
    expect(newlyOpened('k2', ['w1', 'w1-hello'])).toEqual([]);
  });

  it('does not celebrate a big batch (a test-out, everything unlocked)', () => {
    markOpened('k1', ['w1']);
    const many = ['w1', ...Array.from({ length: MAX_FRESH + 1 }, (_, i) => `n${i}`)];
    expect(newlyOpened('k1', many)).toEqual([]);
    expect(newlyOpened('k1', many.slice(0, MAX_FRESH + 1))).toHaveLength(MAX_FRESH);
  });

  it('survives a reload of the page through sessionStorage', () => {
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    markOpened('k1', ['w1', 'w1-hello']);
    resetOpened();
    expect(newlyOpened('k1', ['w1', 'w1-hello', 'w1-rook-stars'])).toEqual(['w1-rook-stars']);
  });

  it('works when storage is blocked', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    markOpened('k1', ['w1']);
    expect(newlyOpened('k1', ['w1', 'w1-hello'])).toEqual(['w1-hello']);
  });

  it('spots the node a played one opens', () => {
    const k = kid();
    const day = '2026-09-20';
    const before = openIds(k, REG);
    expect(before).toContain('w1');
    expect(before).toContain('w1-hello');
    expect(before).not.toContain('w1-rook-stars');
    markOpened(k.id, before);
    recordRun(k, { nodeId: 'w1-hello', results: [{ score: 2, mistakes: 0, hintLevel: 0 }], itemIds: ['w1-hello#0'] }, REG, day);
    expect(newlyOpened(k.id, openIds(k, REG))).toEqual(['w1-rook-stars']);
  });
});
