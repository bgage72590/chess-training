// Kids mode QA: names, export and import, the parent gate's wrong-answer lock, clock changes in the
// session limit, sync merge ties and personal bests, and another tab picking a different kid.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMPORT_MAX_BYTES, MAX_KIDS, __setKidsStateForTests, cleanName, clipName, defaultKidsState, exportKids, getKid, importedKids, newKid, normalizeKids, parseKidsImport, readKids, type KidProfile, type KidsState } from '../src/kids/store/kidsStore';
import { BREAK_MS, __setUnsavedForTests, breakLeft, currentSession, endExpiredBreak, markBreak, onBreak, pauseSession, sessionOver, setSessionLimit } from '../src/kids/player/useSession';
import { __setGatePassForTests, gatePassLeft, gatePassed, keepGatePass, lockLeft, newQuestion, noteMiss, resetMisses } from '../src/kids/ui/ParentGate';
import { mergeKid, mergeSyncedKids } from '../src/kids/store/syncKids';

const kidOf = (id: string, name: string, band: 'sprout' | 'explorer' | 'champion' = 'explorer'): KidProfile => newKid({ id, name, band, start: 'new', now: 1 });
const stateOf = (...kids: KidProfile[]): KidsState => ({ ...defaultKidsState(), kids, activeKid: kids[0]?.id ?? null, updatedAt: 1 });

describe('names', () => {
  it('cuts at 12 characters as a person sees them, never through an emoji', () => {
    const accented = 'e' + String.fromCharCode(0x301); // e plus a combining accent
    expect(clipName('abcdefghijklmnop')).toBe('abcdefghijkl');
    const rockets = '🚀'.repeat(20);
    expect(Array.from(clipName(rockets)).length).toBe(12);
    expect(clipName(rockets)).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/); // no lone half of a pair
    const family = '👨‍👩‍👧‍👦';
    expect(clipName(family.repeat(3))).toBe(family.repeat(3)); // one character each, so all three stay
    expect(clipName(accented.repeat(13))).toBe(accented.repeat(12)); // an accent stays with its letter
  });

  it('drops control, direction and zero-width characters and tidies spaces', () => {
    expect(cleanName('  Mia \n  Rose ')).toBe('Mia Rose');
    expect(cleanName(String.fromCharCode(0x202e) + 'Sam')).toBe('Sam');
    expect(cleanName(String.fromCharCode(0x200b, 0x200b))).toBe('');
    expect(cleanName('<b>x</b>')).toBe('bx/b');
    expect(cleanName(42)).toBe('');
  });

  it('names stored or imported are cleaned the same way', () => {
    const raw = { v: 1, kids: [{ id: 'k1', name: '🚀'.repeat(20) }, { id: 'k2', name: String.fromCharCode(0x202e) + 'Leo' }] };
    const s = normalizeKids(raw);
    expect(Array.from(s.kids[0].name).length).toBe(12);
    expect(s.kids[1].name).toBe('Leo');
  });
});

describe('export and import', () => {
  it('the export never carries the PIN or the device voice', () => {
    const s = stateOf(kidOf('k1', 'Mia'));
    s.device = { pinSalt: 'salt', pinHash: 'hash', voiceURI: 'v' };
    const text = exportKids(s);
    expect(text).not.toContain('pinHash');
    expect(text).not.toContain('salt');
    expect(JSON.parse(text).kids[0].name).toBe('Mia');
  });

  it('says why a file cannot be used', () => {
    expect(parseKidsImport('{nope')).toEqual({ ok: false, reason: 'json' });
    expect(parseKidsImport('[1,2]')).toEqual({ ok: false, reason: 'notKids' });
    expect(parseKidsImport(JSON.stringify({ hello: 'world' }))).toEqual({ ok: false, reason: 'notKids' });
    expect(parseKidsImport(JSON.stringify({ v: 2, kids: [{ id: 'k1' }] }))).toEqual({ ok: false, reason: 'newer' });
    expect(parseKidsImport(JSON.stringify({ v: 1, kids: [] }))).toEqual({ ok: false, reason: 'empty' });
    expect(parseKidsImport(JSON.stringify({ v: 1, kids: [{ nope: true }] }))).toEqual({ ok: false, reason: 'empty' });
    expect(parseKidsImport('x'.repeat(IMPORT_MAX_BYTES + 1))).toEqual({ ok: false, reason: 'big' });
  });

  it('repairs what it can and counts the kids that did not fit', () => {
    const kids = Array.from({ length: MAX_KIDS + 2 }, (_, i) => ({ id: `k${i}`, name: `Kid${i}`, band: 'nonsense' }));
    const r = parseKidsImport(JSON.stringify({ v: 1, kids: [...kids, { broken: 1 }] }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.kids.length).toBe(MAX_KIDS);
      expect(r.state.kids[0].band).toBe('explorer');
      expect(r.skipped).toBe(3);
    }
  });

  it('saved data keeps more than the limit for new kids (two linked devices can add up to more), import does not', () => {
    const kids = Array.from({ length: 12 }, (_, i) => kidOf(`k${i}`, `Kid${i}`));
    const st = { getItem: () => JSON.stringify(stateOf(...kids)), setItem: () => {}, removeItem: () => {} };
    expect(readKids(st).kids.length).toBe(12);
    expect(normalizeKids(JSON.parse(JSON.stringify(stateOf(...kids)))).kids.length).toBe(MAX_KIDS);
  });

  it('replaces the kids here, keeps the PIN and the kid playing, and marks the kids that went as deleted', () => {
    const cur = stateOf(kidOf('k-sam', 'Sam'), kidOf('k-kim', 'Kim'));
    cur.device = { pinSalt: 's', pinHash: 'h' };
    cur.removed = { 'k-old': 5 };
    const file = stateOf(kidOf('k-sam', 'Samuel'), kidOf('k-ann', 'Ann'));
    const out = importedKids(cur, file, 1000);
    expect(out.kids.map((k) => k.name)).toEqual(['Samuel', 'Ann']);
    expect(out.device).toEqual({ pinSalt: 's', pinHash: 'h' });
    expect(out.activeKid).toBe('k-sam');
    expect(out.removed).toEqual({ 'k-old': 5, 'k-kim': 1000 });
    expect(out.updatedAt).toBe(1000);
  });

  it('a kid in the file that was deleted before comes back under a new id; no kid playing when theirs is gone', () => {
    const cur = stateOf(kidOf('k-sam', 'Sam'));
    cur.removed = { 'k-ann': 5 };
    const out = importedKids(cur, stateOf(kidOf('k-ann', 'Ann')), 1000);
    expect(out.kids[0].name).toBe('Ann');
    expect(out.kids[0].id).not.toBe('k-ann');
    expect(out.kids[0].id in (out.removed ?? {})).toBe(false);
    expect(out.activeKid).toBe(null);
  });
});

describe('the parent gate', () => {
  afterEach(() => resetMisses());

  it('the fifth wrong answer in a row locks the keypad for 30 seconds, and a clock set back cannot stretch it', () => {
    const T = 1_000_000;
    for (let i = 0; i < 4; i++) noteMiss(T);
    expect(lockLeft(T)).toBe(0);
    noteMiss(T);
    expect(lockLeft(T)).toBe(30_000);
    expect(lockLeft(T + 10_000)).toBe(20_000);
    expect(lockLeft(T + 30_000)).toBe(0);
    expect(lockLeft(T - 86_400_000)).toBe(30_000);
    // The count starts again after a lock.
    for (let i = 0; i < 4; i++) noteMiss(T + 60_000);
    expect(lockLeft(T + 60_000)).toBe(0);
  });

  it('taps in the grown-ups area keep a fresh pass fresh, and never revive one that ran out', () => {
    const T = 10_000_000;
    __setGatePassForTests(T + 20_000); // 20 seconds left
    keepGatePass(T);
    expect(gatePassLeft(T)).toBe(5 * 60_000);
    __setGatePassForTests(T - 1); // ran out
    keepGatePass(T);
    expect(gatePassLeft(T)).toBe(0);
    __setGatePassForTests(0);
    expect(gatePassed()).toBe(false);
  });

  it('the harder question for a forgotten PIN has two-digit numbers and is written in words', () => {
    for (let i = 0; i < 200; i++) {
      const q = newQuestion(Math.random, true);
      expect(q.text).toMatch(/^What is (twenty|thirty|forty)(-\w+)? times (twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\?$/);
      expect(q.answer).toBeGreaterThanOrEqual(23 * 12);
      expect(q.answer).toBeLessThanOrEqual(999);
    }
    expect(newQuestion(() => 0, true)).toEqual({ text: 'What is twenty-three times twelve?', answer: 276 });
    expect(newQuestion(() => 0.999, true).text).toBe('What is forty-nine times nineteen?');
    expect(newQuestion(() => 0).answer).toBe(11 * 3);
  });
});

describe('session limit and the clock', () => {
  const T0 = new Date('2026-09-20T15:00:00').getTime();
  beforeEach(() => {
    const k = kidOf('k1', 'Mia', 'sprout');
    k.settings.sessionMin = 10;
    __setKidsStateForTests(stateOf(k));
    __setUnsavedForTests(null, 0);
  });

  it('a clock set back by days does not keep a child resting until it catches up', () => {
    const s = { start: T0, last: T0, min: 10, extra: 0, breakAt: T0 };
    expect(currentSession(s, T0 + 60_000).breakAt).toBe(T0);
    expect(currentSession(s, T0 - 5 * 60_000).breakAt).toBe(T0); // a few minutes back: still resting
    expect(currentSession(s, T0 - 86_400_000).breakAt).toBeUndefined();
    expect(currentSession(s, T0 + BREAK_MS).breakAt).toBeUndefined();
  });

  it('raising the limit ends a break the new limit does not call for; a limit that is still reached keeps it', () => {
    __setUnsavedForTests('k1', 10 * 60_000);
    markBreak('k1', T0);
    expect(onBreak(getKid('k1'), T0 + 1000)).toBe(true);
    setSessionLimit('k1', 10, T0 + 2000);
    expect(onBreak(getKid('k1'), T0 + 3000)).toBe(true);
    setSessionLimit('k1', 20, T0 + 4000);
    const k = getKid('k1')!;
    expect(k.settings.sessionMin).toBe(20);
    expect(onBreak(k, T0 + 5000)).toBe(false);
    expect(sessionOver(k, T0 + 5000)).toBe(false);
    expect(k.session?.min).toBe(10);
  });

  it('turning the limit off ends the break for good, so turning it on later does not bring it back', () => {
    __setUnsavedForTests('k1', 10 * 60_000);
    markBreak('k1', T0);
    setSessionLimit('k1', 0, T0 + 1000);
    setSessionLimit('k1', 10, T0 + 2000);
    expect(getKid('k1')!.session?.breakAt).toBeUndefined();
    expect(onBreak(getKid('k1'), T0 + 3000)).toBe(false);
  });

  it('a break whose cooldown is over is dropped from the saved session, so the screen can let go', () => {
    __setUnsavedForTests('k1', 10 * 60_000);
    markBreak('k1', T0);
    expect(endExpiredBreak('k1', T0 + BREAK_MS - 1000)).toBe(false);
    expect(getKid('k1')!.session?.breakAt).toBe(T0);
    expect(endExpiredBreak('k1', T0 + BREAK_MS + 1000)).toBe(true);
    const k = getKid('k1')!;
    expect(k.session?.breakAt).toBeUndefined();
    expect(onBreak(k, T0 + BREAK_MS + 2000)).toBe(false);
    expect(endExpiredBreak('k1', T0 + BREAK_MS + 3000)).toBe(false);
    expect(endExpiredBreak('nobody', T0)).toBe(false);
  });

  it('breakLeft says how long a resting kid still rests', () => {
    expect(breakLeft(getKid('k1'), T0)).toBe(0);
    __setUnsavedForTests('k1', 10 * 60_000);
    markBreak('k1', T0);
    expect(breakLeft(getKid('k1'), T0 + 60_000)).toBe(BREAK_MS - 60_000);
    expect(breakLeft(getKid('k1'), T0 + BREAK_MS)).toBe(0);
    expect(breakLeft(getKid('k1'), T0 - 86_400_000)).toBe(0); // a clock set far back: the break is over
    expect(breakLeft(undefined)).toBe(0);
  });

  it('pauseSession can be stacked and released', () => {
    const a = pauseSession();
    const b = pauseSession();
    a();
    b();
    b(); // a second release does nothing
  });
});

describe('kids sync merge details', () => {
  const node = (over = {}) => ({ stars: 1 as const, plays: 1, last: 50, box: 1 as const, due: '2026-09-20', masteredDays: [], lastItems: [], losses: 0, ease: 0, ...over });

  it('a skip or an easier buddy taken on the newer side survives an older copy with the same last play', () => {
    const older = kidOf('k1', 'Mia');
    older.nodes['w1-boss'] = node();
    const newer = structuredClone(older);
    newer.nodes['w1-boss'].skipped = true;
    newer.nodes['w1-boss'].ease = 2;
    const m = mergeKid(older, newer);
    expect(m.nodes['w1-boss'].skipped).toBe(true);
    expect(m.nodes['w1-boss'].ease).toBe(2);
    expect(JSON.stringify(mergeKid(m, m))).toBe(JSON.stringify(m));
  });

  it('a later play still wins over an earlier one', () => {
    const a = kidOf('k1', 'Mia');
    a.nodes['w1-x'] = node({ last: 90, ease: 1 });
    const b = kidOf('k1', 'Mia');
    b.nodes['w1-x'] = node({ last: 10, ease: 0 });
    expect(mergeKid(a, b).nodes['w1-x'].ease).toBe(1);
    expect(mergeKid(b, a).nodes['w1-x'].ease).toBe(1);
  });

  it('a reset also forgets the Starting world, so a copy that missed it does not bring the start back', async () => {
    const { kidSinceReset } = await import('../src/kids/store/syncKids');
    const { startAtRank } = await import('../src/kids/store/progress');
    const a = kidOf('k1', 'Mia');
    startAtRank(a, 4, '2026-09-20', 5000);
    expect(a.startAt).toEqual({ t: 5000, rank: 4 });
    const reset = kidSinceReset(a, 9000);
    expect(reset.startAt).toBeUndefined();
    expect(reset.testedOut).toBeUndefined();
    const missed = structuredClone(a);
    const m = mergeKid(reset, missed);
    expect(m.startAt).toBeUndefined();
    expect(Object.keys(m.nodes)).toEqual([]);
    expect(m.puzzle.rating).toBe(600);
  });

  it('a hundred stars reached only by adding two devices up gives every kid the party sticker, once', () => {
    const mia = kidOf('k-mia', 'Mia');
    const leo = kidOf('k-leo', 'Leo');
    const phone = { kids: [mia], family: { stars: 60, parties: 0, tally: { phone: { stars: 60 } } }, updatedAt: 100 };
    const tablet = { kids: [leo], family: { stars: 60, parties: 0, tally: { tablet: { stars: 60 } } }, updatedAt: 200 };
    const m = mergeSyncedKids(phone, tablet);
    expect(m.family.stars).toBe(120);
    expect(m.family.parties).toBe(1);
    expect(m.kids.map((k) => k.stickers['st-family-1'])).toEqual([200, 200]);
    expect(mia.stickers['st-family-1']).toBeUndefined(); // the inputs are left alone
    expect(JSON.stringify(mergeSyncedKids(m, m))).toBe(JSON.stringify(m));
    // A party one device already had is not given again.
    const had = mergeSyncedKids({ ...phone, family: { ...phone.family, parties: 1 } }, tablet);
    expect(had.kids.every((k) => k.stickers['st-family-1'] === undefined)).toBe(true);
  });

  it('a test-out does not come back from a copy that missed the real play, so the jar is not paid twice', async () => {
    const { applyPlacement, earnedStars, recordRun, totalStars } = await import('../src/kids/store/progress');
    const reg = { isRegistered: () => true };
    const a = kidOf('k1', 'Mia');
    applyPlacement(a, [1], '2026-09-20');
    expect(a.nodes['w1-rook-stars']).toMatchObject({ stars: 1, tested: true, plays: 0 });
    const b = structuredClone(a);
    // Device B plays the tested-out node for real: all 3 stars are earned once.
    const first = recordRun(b, { nodeId: 'w1-rook-stars', results: [{ score: 3, mistakes: 0, hintLevel: 0 }], itemIds: ['r1'] }, reg, '2026-09-21', 1000);
    expect(first.gained).toBe(3);
    for (const m of [mergeKid(a, b), mergeKid(b, a)]) {
      expect(m.nodes['w1-rook-stars'].tested).toBeUndefined();
      expect(earnedStars(m.nodes['w1-rook-stars'])).toBe(3);
      expect(totalStars(m)).toBe(totalStars(b));
      // Playing it again after the merge pays nothing more into the jar.
      const again = recordRun(m, { nodeId: 'w1-rook-stars', results: [{ score: 3, mistakes: 0, hintLevel: 0 }], itemIds: ['r2'] }, reg, '2026-09-22', 2000);
      expect(again.gained).toBe(0);
      expect(again.firstCompletion).toBe(false);
    }
    // Two copies that only tested out keep the paper plane.
    expect(mergeKid(a, structuredClone(a)).nodes['w1-rook-stars'].tested).toBe(true);
  });

  it('personal bests keep the better value from either device (fewer moves is better for ladders and treks)', () => {
    const a = kidOf('k1', 'Mia');
    a.bests = { 'forks-solved': 8, 'ladder-moves': 12, 'trek-a1h8': 7, 'memory-cards': 5 };
    const b = kidOf('k1', 'Mia');
    b.bests = { 'forks-solved': 5, 'ladder-moves': 9, 'trek-a1h8': 9, 'memory-cards': 6, 'puzzle-streak': 3 };
    const m = mergeKid(a, b);
    expect(m.bests).toEqual({ 'forks-solved': 8, 'ladder-moves': 9, 'trek-a1h8': 7, 'memory-cards': 6, 'puzzle-streak': 3 });
    expect(mergeKid(b, a).bests).toEqual(m.bests);
  });
});

describe('another tab picks a different kid', () => {
  const store = new Map<string, string>();
  const handlers: Record<string, (e: unknown) => void> = {};
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    store.clear();
  });

  it('keeps this tab on its own kid and still takes the other tab\'s progress', async () => {
    vi.resetModules();
    const kids = [kidOf('k-sam', 'Sam'), kidOf('k-kim', 'Kim')];
    const KEY = 'tempo.kids.v1';
    store.set(KEY, JSON.stringify({ ...stateOf(...kids), activeKid: 'k-sam' }));
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    vi.stubGlobal('window', { addEventListener: (t: string, fn: (e: unknown) => void) => void (handlers[t] = fn), removeEventListener: () => {} });
    const mod = await import('../src/kids/store/kidsStore');
    expect(mod.getKids().activeKid).toBe('k-sam');
    // The other tab picked Kim and Kim earned a star there.
    const theirs = structuredClone(mod.getKids());
    theirs.activeKid = 'k-kim';
    theirs.kids[1].garden = 4;
    store.set(KEY, JSON.stringify(theirs));
    handlers.storage({ key: KEY, newValue: store.get(KEY) });
    expect(mod.getKids().activeKid).toBe('k-sam');
    expect(mod.getKids().kids[1].garden).toBe(4);
    // If this tab's kid was deleted over there, there is no kid playing here.
    const gone = structuredClone(theirs);
    gone.kids = gone.kids.filter((k) => k.id !== 'k-sam');
    store.set(KEY, JSON.stringify(gone));
    handlers.storage({ key: KEY, newValue: store.get(KEY) });
    expect(mod.getKids().kids.map((k) => k.id)).toEqual(['k-kim']);
    expect(mod.getKids().activeKid).toBe(null);
  });
});
