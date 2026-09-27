// Kids mode: session limits that survive a re-pick and a reload, kept passes, the skip-ahead
// challenge for a stuck boss, star totals and storage recovery (review round 2).
import { beforeEach, describe, expect, it } from 'vitest';
import { PACKS, createRegistry } from '../src/kids/packs';
import type { AgeBand, ItemResult } from '../src/kids/activities/types';
import { KIDS_BACKUP_KEY, KIDS_KEY, __setKidsStateForTests, defaultKidsState, getKid, newKid, normalizeKids, readKids, type KidProfile } from '../src/kids/store/kidsStore';
import { applyPlacement, bossPassed, crownOf, nodeUnlocked, recordRun, totalStars, worldPassed, worldUnlocked, type Registry } from '../src/kids/store/progress';
import { BREAK_MS, SESSION_GAP_MS, __setUnsavedForTests, currentSession, extendSession, markBreak, onBreak, sessionOver } from '../src/kids/player/useSession';
import { dotsFor } from '../src/kids/lib/dots';
import { NODE_BY_ID } from '../src/kids/curriculum/worlds';

const REG: Registry = { isRegistered: (id) => createRegistry(PACKS).isRegistered(id) };
const TODAY = '2026-09-20';
const r = (score: 1 | 2 | 3, extra: Partial<ItemResult> = {}): ItemResult => ({ score, mistakes: 0, hintLevel: 0, ...extra });
const kidOf = (band: AgeBand = 'explorer', id = 'k1') => newKid({ name: 'Mia', band, start: 'new', id, now: 0 });
const play = (kid: KidProfile, id: string, stars: 1 | 2 | 3) => recordRun(kid, { nodeId: id, results: [r(stars)], itemIds: [`${id}#0`] }, REG, TODAY);

describe('session limit (spec 10.5)', () => {
  const T0 = new Date('2026-09-20T15:00:00').getTime();
  beforeEach(() => {
    const s = defaultKidsState();
    const k = kidOf('sprout');
    k.settings.sessionMin = 10;
    s.kids.push(k);
    s.activeKid = k.id;
    __setKidsStateForTests(s);
    __setUnsavedForTests(null, 0);
  });

  it('the limit counts unsaved time and becomes a saved break', () => {
    __setUnsavedForTests('k1', 9 * 60_000);
    expect(sessionOver(getKid('k1'), T0)).toBe(false);
    __setUnsavedForTests('k1', 10 * 60_000);
    expect(sessionOver(getKid('k1'), T0)).toBe(true);
    markBreak('k1', T0);
    const k = getKid('k1')!;
    expect(k.session?.breakAt).toBe(T0);
    expect(k.session?.min).toBe(10);
    expect(k.days[Object.keys(k.days)[0]].minutes).toBe(10);
  });

  it('re-picking the kid or reloading (fresh memory, stored data) does not reset the break', () => {
    __setUnsavedForTests('k1', 10 * 60_000);
    markBreak('k1', T0);
    // "Bye for now" then picking the kid again: in-memory time is gone, the break is not.
    __setUnsavedForTests(null, 0);
    expect(onBreak(getKid('k1'), T0 + 60_000)).toBe(true);
    expect(sessionOver(getKid('k1'), T0 + 60_000)).toBe(true);
    // A reload: the kid comes back from storage.
    const reloaded = normalizeKids(JSON.parse(JSON.stringify({ v: 1, kids: [getKid('k1')] }))).kids[0];
    expect(sessionOver(reloaded, T0 + 5 * 60_000)).toBe(true);
  });

  it('the break ends after the cooldown, and a grown-up extension gives 10 more minutes', () => {
    __setUnsavedForTests('k1', 10 * 60_000);
    markBreak('k1', T0);
    expect(sessionOver(getKid('k1'), T0 + BREAK_MS + 1000)).toBe(false);
    extendSession('k1', 10, T0 + 60_000);
    const k = getKid('k1')!;
    expect(onBreak(k, T0 + 61_000)).toBe(false);
    expect(sessionOver(k, T0 + 61_000)).toBe(false);
    __setUnsavedForTests('k1', 9 * 60_000);
    expect(sessionOver(getKid('k1'), T0 + 61_000)).toBe(false);
    __setUnsavedForTests('k1', 10 * 60_000);
    expect(sessionOver(getKid('k1'), T0 + 61_000)).toBe(true);
  });

  it('time away starts a fresh session; no limit means never over', () => {
    const s = { start: T0, last: T0, min: 8, extra: 0 };
    expect(currentSession(s, T0 + 60_000).min).toBe(8);
    expect(currentSession(s, T0 + SESSION_GAP_MS + 1000).min).toBe(0);
    const k = getKid('k1')!;
    expect(sessionOver({ ...k, settings: { ...k.settings, sessionMin: 0 }, session: { ...s, breakAt: T0 } }, T0)).toBe(false);
  });
});

describe('passes are kept (spec 5.1)', () => {
  it('a Champion tested out of w1-w5 who replays w3-boss at 1 star keeps w4 open', () => {
    const k = kidOf('champion');
    applyPlacement(k, [1, 2, 3, 4, 5], TODAY);
    play(k, 'w3-boss', 1);
    expect(k.nodes['w3-boss'].tested).toBeUndefined();
    expect(bossPassed(k, NODE_BY_ID.get('w3-boss')!)).toBe(true);
    expect(worldPassed(k, 'w3', REG)).toBe(true);
    for (const w of ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'] as const) expect(worldUnlocked(k, w, REG), w).toBe(true);
    expect(crownOf(k, 'w3', REG)).toBe('silver');
  });

  it('the skip-ahead challenge opens the next world for a kid stuck on a boss', () => {
    const k = kidOf('explorer');
    for (const n of ['w1-hello', 'w1-rook-stars', 'w1-boss']) play(k, n, 3);
    for (let i = 0; i < 3; i++) play(k, 'w2-boss', 1);
    expect(worldUnlocked(k, 'w3', REG)).toBe(false);
    const before = k.puzzle.rating;
    applyPlacement(k, [2], TODAY, { challenge: true });
    expect(worldUnlocked(k, 'w3', REG)).toBe(true);
    expect(k.nodes['w2-boss'].stars).toBe(1); // played stars are kept as they were
    expect(k.puzzle.rating).toBeGreaterThanOrEqual(before);
    expect(nodeUnlocked(k, 'w3-queen-stars', REG)).toBe(true);
  });

  it('a single challenge never lowers the puzzle rating; only a tested-out placement starts Explorers at tier 2', () => {
    const k = kidOf('champion');
    k.puzzle.rating = 800;
    applyPlacement(k, [3], TODAY, { challenge: true });
    expect(k.puzzle.rating).toBe(800);
    const e = kidOf('explorer');
    applyPlacement(e, [], TODAY);
    expect(e.testedOut).toBe(0);
    applyPlacement(e, [1, 2], TODAY);
    expect(e.testedOut).toBe(2);
  });
});

describe('stars and dots', () => {
  it('test-out stars are not earned stars (no hats, no jar)', () => {
    const k = kidOf('champion');
    applyPlacement(k, [1, 2, 3, 4, 5], TODAY);
    expect(totalStars(k)).toBe(0);
    play(k, 'w1-hello', 3);
    expect(totalStars(k)).toBe(3);
  });

  it('until-mastered dots stop once the piece world boss has 3 stars', () => {
    const k = kidOf('explorer');
    k.settings.showDests = 'until-mastered';
    expect(dotsFor(k, 'R')).toBe(true);
    k.nodes['w1-boss'] = { ...(k.nodes['w1-boss'] ?? { plays: 1, last: 0, box: 1, due: TODAY, masteredDays: [], lastItems: [], losses: 0, ease: 0 }), stars: 3 };
    expect(dotsFor(k, 'R')).toBe(false);
    expect(dotsFor(k, 'B')).toBe(true);
    k.settings.showDests = 'on-mistake';
    expect(dotsFor(k, 'B')).toBe(false);
  });
});

describe('storage recovery', () => {
  const mem = (init: Record<string, string>) => {
    const m = new Map(Object.entries(init));
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
  };
  it('unreadable data is copied aside before anything overwrites it', () => {
    const bad = mem({ [KIDS_KEY]: '{not json' });
    expect(readKids(bad).kids).toEqual([]);
    expect(bad.m.get(KIDS_BACKUP_KEY)).toBe('{not json');
    const future = JSON.stringify({ v: 2, kids: [{ id: 'x' }] });
    const fut = mem({ [KIDS_KEY]: future });
    readKids(fut);
    expect(fut.m.get(KIDS_BACKUP_KEY)).toBe(future);
    const good = mem({ [KIDS_KEY]: JSON.stringify({ v: 1, kids: [kidOf()] }) });
    expect(readKids(good).kids.length).toBe(1);
    expect(good.m.has(KIDS_BACKUP_KEY)).toBe(false);
  });
});
