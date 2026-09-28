import { afterEach, describe, expect, it, vi } from 'vitest';
import { joiningCopy, mergeProfiles, sinceReset } from '../src/sync/merge';
import { formatSyncCode, newSyncCode, normalizeSyncCode } from '../src/sync/code';
import { memoryBackend } from '../src/sync/backend';
import { COPY_DELETED, SyncEngine, type SyncPart } from '../src/sync/engine';
import { mergeTallied, tallyGrowth } from '../src/sync/tally';
import { deviceId } from '../src/sync/device';
import { counters, defaultProfile, getProfile, logActivity, normalizeProfile, replaceProfile, updateProfile, type Profile } from '../src/store/profile';
import { dayKey } from '../src/lib/srs';
import { toast } from '../src/lib/toast';

vi.mock('../src/lib/toast', () => ({ toast: vi.fn() }));

const day = (key: string, xp: number) => ({ xp, puzzles: 0, lessons: 0, lines: 0, drills: 0, games: 0, vision: 0, [key]: 0 });

function profile(patch: (p: Profile) => void, at = 1000): Profile {
  const p = defaultProfile();
  p.created = 1;
  p.updatedAt = at;
  patch(p);
  return p;
}

describe('profile merge', () => {
  it('is idempotent', () => {
    const p = profile((d) => {
      d.days['2026-09-01'] = day('x', 40);
      d.xp = 40;
      d.streak = { current: 1, best: 1, last: '2026-09-01' };
      d.lessons['a'] = { done: true, t: 5, score: 0.5 };
    });
    expect(mergeProfiles(p, p)).toEqual(p);
  });

  it('keeps progress made on either device', () => {
    const phone = profile((d) => {
      d.days['2026-09-01'] = day('x', 30);
      d.lessons['rooks'] = { done: true, t: 10, score: 1 };
      d.games = [{ id: 'g1', t: 10, startFen: '', moves: [], playerColor: 'w', level: 1, result: '1-0', reason: 'Checkmate' }];
    }, 2000);
    const laptop = profile((d) => {
      d.days['2026-09-02'] = day('x', 50);
      d.lessons['knights'] = { done: true, t: 20, score: 0.5 };
      d.lessons['rooks'] = { done: false, t: 5, score: 0.2 };
      d.games = [{ id: 'g2', t: 20, startFen: '', moves: [], playerColor: 'b', level: 2, result: '0-1', reason: 'Resignation' }];
    }, 3000);
    const m = mergeProfiles(phone, laptop);
    expect(Object.keys(m.lessons).sort()).toEqual(['knights', 'rooks']);
    expect(m.lessons.rooks).toEqual({ done: true, t: 10, score: 1 });
    expect(m.xp).toBe(80);
    expect(m.games.map((g) => g.id)).toEqual(['g2', 'g1']);
    expect(m.streak).toMatchObject({ current: 2, best: 2, last: '2026-09-02' });
    expect(mergeProfiles(laptop, phone).lessons).toEqual(m.lessons);
  });

  it('follows the latest attempt for puzzle review cards and rating', () => {
    const a = profile((d) => {
      d.puzzles.seen['p1'] = { ok: false, t: 100 };
      d.puzzles.review['p1'] = { box: 1, due: 200 };
      d.puzzles.history = [{ t: 100, r: 990 }];
      d.puzzles.rating = 990;
    });
    const b = profile((d) => {
      d.puzzles.seen['p1'] = { ok: true, t: 300 }; // solved later: card removed
      d.puzzles.history = [{ t: 300, r: 1010 }];
      d.puzzles.rating = 1010;
    });
    const m = mergeProfiles(a, b);
    expect(m.puzzles.review.p1).toBeUndefined();
    expect(m.puzzles.rating).toBe(1010);
    expect(m.puzzles.history).toEqual([{ t: 100, r: 990 }, { t: 300, r: 1010 }]);
  });

  it('takes settings from the device that changed them last, not the one that trained last', () => {
    const a = profile((d) => {
      d.settings.boardTheme = 'marble' as Profile['settings']['boardTheme'];
      d.settingsAt = 500;
    }, 600);
    const b = profile((d) => {
      d.settingsAt = 100;
    }, 9000);
    expect(mergeProfiles(a, b).settings.boardTheme).toBe('marble');
    expect(mergeProfiles(b, a).settings.boardTheme).toBe('marble');
  });

  it('never lowers totals or bests', () => {
    const a = profile((d) => {
      d.puzzles.rushBest = 20;
      d.vision['coords-find-white'] = 30;
      d.achievements['first-lesson'] = 50;
    });
    const b = profile((d) => {
      d.puzzles.rushBest = 12;
      d.vision['coords-find-white'] = 34;
      d.achievements['first-lesson'] = 40;
    });
    const m = mergeProfiles(a, b);
    expect(m.puzzles.rushBest).toBe(20);
    expect(m.vision['coords-find-white']).toBe(34);
    expect(m.achievements['first-lesson']).toBe(40);
  });
});

describe('sync codes', () => {
  it('generates 20-character codes and reads them back however they are typed', () => {
    const code = newSyncCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{20}$/);
    expect(normalizeSyncCode(formatSyncCode(code).toLowerCase())).toBe(code);
    expect(normalizeSyncCode('o1lI-0000-0000-0000-0000')).toBe('01110000000000000000');
    expect(normalizeSyncCode('too-short')).toBeNull();
  });
});

describe('sync engine', () => {
  /** A device: its own copy of a simple part (a set of solved lessons). */
  function device(backend: ReturnType<typeof memoryBackend>, initial: string[]) {
    let data = [...initial];
    let saved: { code: string } | null = null;
    const part: SyncPart<string[]> = {
      key: 'lessons',
      read: () => data,
      write: (v) => (data = v),
      merge: (a, b) => [...new Set([...a, ...b])].sort(),
    };
    const engine = new SyncEngine(backend, [part], { load: () => saved, save: (s) => (saved = s) });
    return { engine, get data() { return data; }, add: (x: string) => (data = [...data, x].sort()) };
  }

  it('merges two devices through the synced copy', async () => {
    const backend = memoryBackend();
    const phone = device(backend, ['rooks']);
    const laptop = device(backend, ['knights']);
    const code = newSyncCode();
    await phone.engine.link(code);
    await laptop.engine.link(code);
    expect(laptop.data).toEqual(['knights', 'rooks']);
    await phone.engine.syncNow();
    expect(phone.data).toEqual(['knights', 'rooks']);
    expect(phone.engine.snapshot.status).toBe('synced');
  });

  it('retries after a concurrent write instead of overwriting it', async () => {
    const backend = memoryBackend();
    const a = device(backend, ['a']);
    const b = device(backend, ['b']);
    const code = newSyncCode();
    await a.engine.link(code);
    await b.engine.link(code);
    // Device A writes between device B's read and write.
    const realGet = backend.get;
    let once = true;
    backend.get = async (c) => {
      const slot = await realGet(c);
      if (once) {
        once = false;
        a.add('a2');
        await a.engine.syncNow();
      }
      return slot;
    };
    b.add('b2');
    await b.engine.syncNow();
    backend.get = realGet;
    const stored = (await backend.get(code))!.data as { parts: { lessons: string[] } };
    expect(stored.parts.lessons).toEqual(['a', 'a2', 'b', 'b2']);
  });

  it('stops syncing when unlinked, keeping local data', async () => {
    const backend = memoryBackend();
    const d = device(backend, ['x']);
    await d.engine.link(newSyncCode());
    d.engine.unlink();
    expect(d.engine.snapshot).toMatchObject({ status: 'off', code: null });
    expect(d.data).toEqual(['x']);
  });
});

describe('profile normalization for sync', () => {
  it('fills settingsAt-less old profiles and keeps logActivity totals consistent', () => {
    const p = normalizeProfile({ xp: 0 });
    logActivity(p, 12, 'puzzles');
    const m = mergeProfiles(p, normalizeProfile({ xp: 0 }));
    expect(m.xp).toBe(12);
  });
});

describe('kids sync merge', async () => {
  const { mergeSyncedKids } = await import('../src/kids/store/syncKids');
  const { newKid } = await import('../src/kids/store/kidsStore');
  const kid = (id: string, name: string) => newKid({ id, name, band: 'explorer' as never, start: 'new', now: 1 });

  it('keeps each device\'s kids and progress, and deleted kids stay deleted', () => {
    const mia = kid('k-mia', 'Mia');
    const leo = kid('k-leo', 'Leo');
    const phoneMia = structuredClone(mia);
    phoneMia.stickers['s-first'] = 10;
    phoneMia.nodes['w1-a'] = { stars: 3, plays: 2, last: 10, box: 2, due: '2026-09-28', masteredDays: ['2026-09-27'], lastItems: [], losses: 0, ease: 0 };
    const tabletMia = structuredClone(mia);
    tabletMia.name = 'Mimi';
    tabletMia.nodes['w1-a'] = { stars: 1, plays: 5, last: 20, box: 1, due: '2026-09-27', masteredDays: [], lastItems: ['x'], losses: 0, ease: 0 };
    tabletMia.nodes['w1-b'] = { stars: 2, plays: 1, last: 20, box: 1, due: '2026-09-27', masteredDays: [], lastItems: [], losses: 0, ease: 0 };
    const phone = { kids: [phoneMia, leo], family: { stars: 5, parties: 0 }, updatedAt: 100 };
    const tablet = { kids: [tabletMia], family: { stars: 8, parties: 1 }, updatedAt: 200, removed: { 'k-leo': 150 } };
    const m = mergeSyncedKids(phone, tablet);
    expect(m.kids.map((k) => k.id)).toEqual(['k-mia']);
    const mm = m.kids[0];
    expect(mm.name).toBe('Mimi');
    expect(mm.stickers['s-first']).toBe(10);
    expect(mm.nodes['w1-a']).toMatchObject({ stars: 3, plays: 5, last: 20, masteredDays: ['2026-09-27'] });
    expect(Object.keys(mm.nodes).sort()).toEqual(['w1-a', 'w1-b']);
    expect(m.family).toEqual({ stars: 8, parties: 1 });
    expect(JSON.stringify(mergeSyncedKids(m, m))).toBe(JSON.stringify(m));
  });
});

describe('new look migration', () => {
  it('moves old profiles to the walnut board and 3D pieces once', () => {
    const old = normalizeProfile({ xp: 5, settings: { ...defaultProfile().settings, boardTheme: 'slate', pieceSet: 'cburnett' } });
    expect(old.settings).toMatchObject({ boardTheme: 'walnut', pieceSet: 'staunton3d' });
    const chosen = normalizeProfile({ ...old, settings: { ...old.settings, pieceSet: 'cburnett' } });
    expect(chosen.settings.pieceSet).toBe('cburnett');
  });
});

/** A change made on `device`, recorded the way updateProfile records it. */
function act(p: Profile, device: string, fn: (d: Profile) => void, at = p.updatedAt + 1): Profile {
  const next = structuredClone(p);
  fn(next);
  next.updatedAt = at;
  next.tally = tallyGrowth(next.tally, device, counters(p), counters(next));
  return next;
}

const solve = (n: number) => (d: Profile) => {
  for (let i = 0; i < n; i++) {
    logActivity(d, 10, 'puzzles');
    d.puzzles.attempts++;
    d.puzzles.solved++;
  }
};

describe('counters that add up across devices', () => {
  it('adds up progress made the same day on two devices between syncs', () => {
    const today = dayKey();
    // The last synced copy: once from this version (tallied), once from before tallies existed.
    const tallied = act(profile(() => {}), 'laptop', (d) => logActivity(d, 20, 'puzzles'));
    const legacy = profile((d) => logActivity(d, 20, 'puzzles'));
    for (const base of [tallied, legacy]) {
      const phone = act(base, 'phone', solve(10), 2000);
      const laptop = act(base, 'laptop', solve(6), 3000);
      const m = mergeProfiles(phone, laptop);
      expect(m.xp).toBe(180);
      expect(m.days[today]).toMatchObject({ xp: 180, puzzles: 17 });
      expect(m.puzzles).toMatchObject({ attempts: 16, solved: 16 });
      expect(mergeProfiles(laptop, phone)).toEqual(m);
      expect(mergeProfiles(m, m)).toEqual(m);
      // Syncing a device again adds nothing twice.
      expect(mergeProfiles(m, phone)).toEqual(m);
      expect(mergeProfiles(laptop, m)).toEqual(m);
      // Both keep going: only the new work is added.
      const more = mergeProfiles(act(m, 'phone', solve(1), 4000), act(m, 'laptop', solve(2), 5000));
      expect(more.xp).toBe(210);
      expect(more.puzzles.solved).toBe(19);
    }
  });

  it('merges tallies per device with max and sums them, exactly for fractional minutes', () => {
    expect(mergeTallied({ m: 5.1 }, undefined, { m: 5.1 }, undefined).counts).toEqual({ m: 5.1 });
    const t1 = tallyGrowth(undefined, 'tab', { m: 5.1 }, { m: 5.35 });
    const t2 = tallyGrowth(undefined, 'phone', { m: 5.1 }, { m: 5.2 });
    const m = mergeTallied({ m: 5.35 }, t1, { m: 5.2 }, t2);
    expect(m.counts).toEqual({ m: 5.45 });
    expect(m.tally).toEqual({ base: { m: 5.1 }, tab: { m: 0.25 }, phone: { m: 0.1 } });
    expect(mergeTallied(m.counts, m.tally, m.counts, m.tally)).toEqual(m);
  });

  it('a copy an older app version wrote without the tally cannot make counts grow by themselves', () => {
    // The phone added 5 stars; an older version on the tablet merged that and dropped the tally.
    let phone = { counts: { stars: 105 }, tally: tallyGrowth(undefined, 'phone', { stars: 100 }, { stars: 105 }) };
    for (let i = 0; i < 3; i++) {
      phone = mergeTallied(phone.counts, phone.tally, { stars: 105 }, undefined) as typeof phone;
      expect(phone.counts.stars).toBe(105);
    }
    // What the older version added itself is kept (as the larger total).
    expect(mergeTallied(phone.counts, phone.tally, { stars: 107 }, undefined).counts.stars).toBe(107);
  });

  it('updateProfile records what this device adds, and nothing for a settings change', () => {
    replaceProfile(defaultProfile());
    updateProfile((d) => logActivity(d, 12, 'puzzles'));
    updateProfile((d) => void (d.settings.sound = false));
    expect(getProfile().tally).toEqual({ [deviceId()]: { [`${dayKey()}.xp`]: 12, [`${dayKey()}.puzzles`]: 1 } });
    expect(normalizeProfile(JSON.parse(JSON.stringify(getProfile())))).toEqual(getProfile());
  });
});

describe('resets reach linked devices', () => {
  const R = new Date('2026-09-20T12:00:00').getTime();
  const DAY = 86_400_000;
  const phoneBefore = profile((d) => {
    d.days['2026-09-19'] = day('x', 40);
    d.xp = 40;
    d.streak = { current: 3, best: 5, last: '2026-09-19' };
    d.lessons['rooks'] = { done: true, t: R - 9000, score: 1 };
    d.puzzles.seen['p1'] = { ok: false, t: R - 5000 };
    d.puzzles.review['p1'] = { box: 1, due: R };
    d.puzzles.history = [{ t: R - 5000, r: 1250 }];
    d.puzzles.rating = 1250;
    d.puzzles.attempts = 4;
    d.puzzles.solved = 3;
    d.puzzles.rushBest = 14;
    d.vision['coords'] = 20;
    d.achievements['first-lesson'] = R - 9000;
    d.levelSeen = 3;
    d.onboarded = true;
    d.tally = { phone: { '2026-09-19.xp': 40 } };
  }, R - 1000);
  const laptopReset = sinceReset({ ...phoneBefore, settings: { ...phoneBefore.settings, sound: false }, settingsAt: R - 100 }, R);

  it('the reset copy keeps settings and nothing else', () => {
    expect(laptopReset).toMatchObject({ xp: 0, days: {}, lessons: {}, achievements: {}, vision: {}, levelSeen: 1, onboarded: false, resetAt: R, settingsAt: R - 100 });
    expect(laptopReset.puzzles).toMatchObject({ rating: 1000, attempts: 0, solved: 0, history: [], seen: {}, review: {}, rushBest: 0 });
    expect(laptopReset.settings.sound).toBe(false);
    expect(laptopReset.tally).toBeUndefined();
  });

  it('a copy that missed the reset does not bring old progress back', () => {
    const m = mergeProfiles(phoneBefore, laptopReset);
    expect(m).toMatchObject({ xp: 0, days: {}, lessons: {}, streak: { current: 0, best: 0 }, resetAt: R });
    expect(m.puzzles).toMatchObject({ rating: 1000, attempts: 0, seen: {}, history: [] });
    expect(m.settings.sound).toBe(false);
    expect(mergeProfiles(laptopReset, phoneBefore)).toEqual(m);
    expect(mergeProfiles(m, m)).toEqual(m);
    expect(mergeProfiles(m, phoneBefore)).toEqual(m);
  });

  it('keeps what the other copy did after the reset', () => {
    const phoneAfter = act(
      phoneBefore,
      'phone',
      (d) => {
        d.lessons['knights'] = { done: true, t: R + DAY, score: 1 };
        d.days['2026-09-21'] = day('x', 30);
        d.xp += 30;
        d.puzzles.seen['p2'] = { ok: true, t: R + DAY };
        d.puzzles.history.push({ t: R + DAY, r: 1270 });
        d.puzzles.rating = 1270;
      },
      R + DAY,
    );
    const m = mergeProfiles(laptopReset, phoneAfter);
    expect(Object.keys(m.lessons)).toEqual(['knights']);
    expect(Object.keys(m.days)).toEqual(['2026-09-21']);
    expect(m.xp).toBe(30);
    expect(m.puzzles).toMatchObject({ rating: 1270, history: [{ t: R + DAY, r: 1270 }], attempts: 1, solved: 1 });
    expect(mergeProfiles(phoneAfter, laptopReset)).toEqual(m);
    // The phone, now past the reset, adds to it without counting anything twice.
    const later = act(m, 'phone', (d) => logActivity(d, 5, 'puzzles'), R + 2 * DAY);
    expect(mergeProfiles(later, m).xp).toBe(35);
  });

  it('joining a copy: a reset made on either side before they were linked erases nothing on the other', () => {
    const tablet = act(laptopReset, 'tablet', (d) => void (d.lessons['knights'] = { done: true, t: R + DAY, score: 1 }), R + DAY);
    const copy = profile((d) => void (d.lessons['bishops'] = { done: true, t: R - DAY, score: 1 }), R - DAY);
    const m = mergeProfiles(joiningCopy(tablet, copy), copy);
    expect(Object.keys(m.lessons).sort()).toEqual(['bishops', 'knights']);
    expect(m.resetAt).toBeUndefined();
    // And the other way round: the copy was reset before this device joined.
    const joined = mergeProfiles(joiningCopy(phoneBefore, laptopReset), laptopReset);
    expect(Object.keys(joined.lessons)).toEqual(['rooks']);
    expect(joined.resetAt).toBe(R);
  });
});

describe('sync engine: deleting, joining and failures', () => {
  type Backend = ReturnType<typeof memoryBackend>;
  function device(backend: Backend, initial: string[]) {
    let data = [...initial];
    let saved: { code: string } | null = null;
    const part: SyncPart<string[]> = { key: 'lessons', read: () => data, write: (v) => (data = v), merge: (a, b) => [...new Set([...a, ...b])].sort() };
    const engine = new SyncEngine(backend, [part], { load: () => saved, save: (s) => (saved = s) });
    return {
      engine,
      get data() {
        return data;
      },
      get saved() {
        return saved;
      },
    };
  }

  it('a copy deleted on one device makes the others stop syncing instead of uploading it again', async () => {
    const backend = memoryBackend();
    const phone = device(backend, ['a']);
    const laptop = device(backend, ['b']);
    const code = newSyncCode();
    await phone.engine.link(code);
    await laptop.engine.link(code, { mustExist: true });
    await phone.engine.deleteCopy();
    expect(backend.slots.size).toBe(0);
    expect(phone.engine.snapshot).toMatchObject({ code: null, error: null });
    await laptop.engine.syncNow();
    expect(backend.slots.size).toBe(0);
    expect(laptop.engine.snapshot).toMatchObject({ status: 'off', code: null, error: COPY_DELETED });
    expect(laptop.saved).toBeNull();
    expect(laptop.data).toEqual(['a', 'b']);
    // Turning sync on again with a new code still creates a copy.
    await laptop.engine.link(newSyncCode());
    expect(backend.slots.size).toBe(1);
    expect(laptop.engine.snapshot).toMatchObject({ status: 'synced', error: null });
  });

  it('joining needs an existing copy: a mistyped code links nothing', async () => {
    const backend = memoryBackend();
    const phone = device(backend, ['a']);
    const code = newSyncCode();
    await phone.engine.link(code);
    const typo = code.slice(0, 19) + (code[19] === 'Z' ? 'Y' : 'Z');
    const tablet = device(backend, ['t']);
    expect(await tablet.engine.link(typo, { mustExist: true })).toBe(false);
    expect(backend.slots.has(typo)).toBe(false);
    expect(tablet.engine.snapshot.code).toBeNull();
    expect(await tablet.engine.link(code, { mustExist: true })).toBe(true);
    expect(tablet.data).toEqual(['a', 't']);
  });

  it('a failed delete throws and stays linked; no sync re-creates the copy meanwhile', async () => {
    const backend = memoryBackend();
    const d = device(backend, ['a']);
    const code = newSyncCode();
    await d.engine.link(code);
    const remove = backend.remove;
    backend.remove = async () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(d.engine.deleteCopy()).rejects.toThrow('Failed to fetch');
    expect(d.engine.snapshot.code).toBe(code);
    backend.remove = async (c) => {
      void d.engine.syncNow(); // asked for while deleting: skipped
      await remove(c);
    };
    await d.engine.deleteCopy();
    await d.engine.syncNow();
    expect(backend.slots.size).toBe(0);
    expect(d.engine.snapshot).toMatchObject({ code: null, error: null });
  });

  it('linking while the service is unreachable keeps the code and shows the first sync did not happen', async () => {
    const backend = memoryBackend();
    backend.get = async () => {
      throw new TypeError('Failed to fetch');
    };
    const d = device(backend, ['a']);
    expect(await d.engine.link(newSyncCode())).toBe(true);
    expect(d.engine.snapshot).toMatchObject({ status: 'error', lastSyncedAt: null });
    await expect(device(backend, []).engine.link(newSyncCode(), { mustExist: true })).rejects.toThrow();
  });
});

describe('sync card messages', async () => {
  const { sync } = await import('../src/sync');
  const { deleteSyncedCopy, linkDevice } = await import('../src/sync/SyncCard');
  const mem = memoryBackend();
  let down = false;
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    if (down) throw new TypeError('Failed to fetch');
    const fn = url.split('/rpc/')[1];
    const b = JSON.parse(init.body);
    const out = fn === 'sync_get' ? await mem.get(b.code) : fn === 'sync_put' ? await mem.put(b.code, b.data, b.base_version) : (await mem.remove(b.code), null);
    return new Response(out === null ? '' : JSON.stringify(out));
  });
  const last = () => vi.mocked(toast).mock.lastCall?.[0];
  afterEach(() => {
    down = false;
    sync.unlink();
  });

  it('says sync is on only when the first sync went through', async () => {
    expect(await linkDevice(newSyncCode(), false)).toBe(true);
    expect(last()).toMatchObject({ title: 'Sync is on', tone: 'good' });
    sync.unlink();
    down = true;
    expect(await linkDevice(newSyncCode(), false)).toBe(true);
    expect(last()).toMatchObject({ title: 'Sync code saved', tone: 'bad' });
    expect(sync.snapshot.code).not.toBeNull();
  });

  it('refuses a code with no synced copy, or when the service cannot be reached', async () => {
    const code = newSyncCode();
    expect(await linkDevice(code, true)).toBe(false);
    expect(last()).toMatchObject({ title: 'No synced copy found for this code', tone: 'bad' });
    down = true;
    expect(await linkDevice(code, true)).toBe(false);
    expect(last()).toMatchObject({ title: 'Could not reach the sync service', tone: 'bad' });
    expect(sync.snapshot.code).toBeNull();
    expect(mem.slots.has(code)).toBe(false);
  });

  it('a device joining after a reset keeps its progress; a later reset reaches it', async () => {
    const lessons = () => Object.keys(getProfile().lessons);
    const remoteLessons = () => Object.keys((mem.slots.get(code)!.data as { parts: { profile: Profile } }).parts.profile.lessons);
    replaceProfile(profile((d) => void (d.lessons['rooks'] = { done: true, t: Date.now() - 60_000, score: 1 })));
    const code = newSyncCode();
    const laptop = sinceReset(profile((d) => void (d.lessons['knights'] = { done: true, t: Date.now() - 90_000, score: 1 })), Date.now() - 30_000);
    await mem.put(code, { v: 1, at: 1, parts: { profile: laptop } }, 0);
    expect(await linkDevice(code, true)).toBe(true);
    expect(lessons()).toEqual(['rooks']);
    expect(remoteLessons()).toEqual(['rooks']);
    // The laptop resets again: this time the phone was linked, so its lesson goes too.
    const slot = mem.slots.get(code)!;
    await mem.put(code, { v: 1, at: 2, parts: { profile: sinceReset(laptop, Date.now()) } }, slot.version);
    await sync.syncNow();
    expect(lessons()).toEqual([]);
  });

  it('counts stay right when an older app version drops the tally inside the profile', async () => {
    const today = dayKey();
    const put = async (profile: Profile, mirror = profile.tally) => {
      const slot = mem.slots.get(code);
      await mem.put(code, { v: 1, at: 1, parts: { profile, 'profile-tally': mirror ?? {} } }, slot?.version ?? 0);
    };
    const code = newSyncCode();
    const b20 = act(profile(() => {}), 'tablet', (d) => logActivity(d, 20, 'puzzles'));
    await put(b20);
    replaceProfile(defaultProfile());
    await linkDevice(code, true);
    const b30 = act(b20, 'tablet', (d) => logActivity(d, 10, 'puzzles'));
    // An older version merged the tablet's +10 into the profile and dropped its tally there.
    await put({ ...b30, tally: undefined }, b30.tally);
    await sync.syncNow();
    expect(getProfile().days[today].xp).toBe(30);
    await put(b30); // the tablet syncs again with its tally
    await sync.syncNow();
    expect(getProfile().days[today].xp).toBe(30);
    expect(getProfile().xp).toBe(30);
  });

  it('reports whether deleting the synced copy worked', async () => {
    const code = newSyncCode();
    await linkDevice(code, false);
    down = true;
    await deleteSyncedCopy();
    expect(last()).toMatchObject({ title: 'Could not delete the synced copy', tone: 'bad' });
    expect(sync.snapshot.code).toBe(code);
    down = false;
    await deleteSyncedCopy();
    expect(last()).toMatchObject({ title: 'Synced copy deleted', tone: 'good' });
    expect(mem.slots.has(code)).toBe(false);
    expect(sync.snapshot.code).toBeNull();
  });
});

describe('kids sync: settings, resets and counters', async () => {
  const { joiningCopy, kidSinceReset, mergeKid, mergeSyncedKids, withTallies } = await import('../src/kids/store/syncKids');
  const { __setKidsStateForTests, defaultKidsState, getKids, kidCounters, newKid, normalizeKids, setActiveKid, updateKid, updateKids } = await import('../src/kids/store/kidsStore');
  const kid = () => newKid({ id: 'k-mia', name: 'Mia', band: 'explorer' as never, start: 'new', now: 1 });
  const node = (last: number) => ({ stars: 2 as const, plays: 1, last, box: 1 as const, due: '2026-09-20', masteredDays: [], lastItems: [], losses: 0, ease: 0 });
  const jar = { stars: 0, parties: 0 };

  it("a grown-up's settings change survives a kid playing on another device afterwards", () => {
    const phone = kid();
    phone.settings.sessionMin = 10;
    phone.settingsAt = 2000;
    const laptop = kid();
    laptop.nodes['w1-a'] = node(3000);
    const m = mergeSyncedKids({ kids: [laptop], family: jar, updatedAt: 3000 }, { kids: [phone], family: jar, updatedAt: 2000 });
    expect(m.kids[0].settings.sessionMin).toBe(10);
    expect(m.kids[0].settingsAt).toBe(2000);
    expect(Object.keys(m.kids[0].nodes)).toEqual(['w1-a']);
    expect(mergeKid(laptop, phone).settings.sessionMin).toBe(10);
    expect(mergeKid(phone, laptop).settings.sessionMin).toBe(10);
  });

  it('stamps settingsAt on grown-up changes only; picking the active kid is not a synced change', () => {
    const s = defaultKidsState();
    s.kids.push(kid());
    s.updatedAt = 500;
    __setKidsStateForTests(s);
    setActiveKid('k-mia');
    expect(getKids()).toMatchObject({ activeKid: 'k-mia', updatedAt: 500 });
    updateKid('k-mia', (d) => void (d.nodes['w1-a'] = node(10)));
    expect(getKids().kids[0].settingsAt).toBeUndefined();
    updateKid('k-mia', (d) => void (d.settings.sessionMin = 10));
    expect(getKids().kids[0].settingsAt).toBe(getKids().updatedAt);
  });

  it('a kid reset clears progress, test-outs and the puzzle rating, and reaches other devices', () => {
    const R = new Date('2026-09-20T12:00:00').getTime();
    const old = kid();
    old.nodes['w1-a'] = node(R - 1000);
    old.stickers['first-star'] = R - 1000;
    old.trophies['tr-1'] = R - 1000;
    old.wardrobe = ['crown' as never];
    old.avatar.hat = 'crown' as never;
    old.puzzle = { rating: 680, attempts: 4, seen: ['p1'], streak: 2, bestStreak: 3 };
    old.days['2026-09-19'] = { minutes: 12, stars: 5, planted: true };
    old.garden = 3;
    old.firsts = ['intro'];
    old.testedOut = 2;
    old.placed = true;
    old.graduated = { t: R - 1000, form: 'queen' };
    old.bests['x'] = 9;
    old.session = { start: R - 100, last: R - 50, min: 5, extra: 0 };
    old.tally = { tab: { '2026-09-19.minutes': 12 } };
    const reset = kidSinceReset(old, R);
    expect(reset).toMatchObject({ nodes: {}, stickers: {}, trophies: {}, wardrobe: [], days: {}, garden: 0, firsts: [], bests: {}, bots: {}, resetAt: R, placed: true });
    expect(reset.avatar.hat).toBeNull();
    expect(reset.puzzle).toEqual({ rating: 600, attempts: 0, seen: [], streak: 0, bestStreak: 0 });
    expect(reset.testedOut).toBeUndefined();
    expect(reset.graduated).toBeUndefined();
    expect(reset.tally).toBeUndefined();
    expect(reset.session).toEqual(old.session);
    // The copy that missed the reset: its old progress stays gone, its later progress stays.
    const later = structuredClone(old);
    later.nodes['w1-b'] = node(R + 5000);
    for (const m of [mergeKid(reset, later), mergeKid(later, reset)]) {
      expect(Object.keys(m.nodes)).toEqual(['w1-b']);
      expect(m).toMatchObject({ stickers: {}, days: {}, resetAt: R });
      expect(m.testedOut).toBeUndefined();
      expect(m.puzzle.rating).toBe(600);
    }
    const m = mergeKid(reset, later);
    expect(mergeKid(m, m)).toEqual(m);
    // A device that joins the copy only now keeps its old progress.
    const local = { kids: [old], family: jar, updatedAt: 1 };
    const joined = mergeSyncedKids(joiningCopy(local, { kids: [reset], family: jar, updatedAt: 2 }), { kids: [reset], family: jar, updatedAt: 2 });
    expect(Object.keys(joined.kids[0].nodes)).toEqual(['w1-a']);
  });

  it('adds up minutes, stars and family jar stars earned on two devices at once', () => {
    const base = kid();
    base.days['2026-09-28'] = { minutes: 5, stars: 2 };
    const grow = (dev: string, min: number, stars: number) => {
      const k = structuredClone(base);
      k.days['2026-09-28'] = { minutes: Math.round((5 + min) * 100) / 100, stars: 2 + stars };
      k.tally = tallyGrowth(k.tally, dev, kidCounters(base), kidCounters(k));
      return k;
    };
    const tablet = { kids: [grow('tab', 3.25, 4)], family: { stars: 104, parties: 1, tally: { base: { stars: 100 }, tab: { stars: 4 } } }, updatedAt: 200 };
    const phone = { kids: [grow('phone', 7.5, 1)], family: { stars: 101, parties: 1, tally: { base: { stars: 100 }, phone: { stars: 1 } } }, updatedAt: 300 };
    const m = mergeSyncedKids(tablet, phone);
    expect(m.kids[0].days['2026-09-28']).toEqual({ minutes: 15.75, stars: 7 });
    expect(m.family).toMatchObject({ stars: 105, parties: 1 });
    expect(mergeSyncedKids(phone, tablet)).toEqual(m);
    expect(mergeSyncedKids(m, m)).toEqual(m);
    expect(mergeSyncedKids(m, phone)).toEqual(m);
    // The synced copy keeps the new fields through normalization.
    const round = normalizeKids(JSON.parse(JSON.stringify({ v: 1, ...m })));
    expect(round.family).toEqual(m.family);
    expect(round.kids[0].tally).toEqual(m.kids[0].tally);
  });

  it('folds back the tallies an older app version dropped from the kids part', () => {
    const k = kid();
    k.days['2026-09-28'] = { minutes: 0, stars: 3 };
    k.tally = { tab: { '2026-09-28.stars': 3 } };
    const stripped = { kids: [{ ...k, tally: undefined }], family: { stars: 3, parties: 0 }, updatedAt: 1 };
    const m = withTallies(stripped, { family: { tab: { stars: 3 } }, kids: { 'k-mia': k.tally } });
    expect(m.kids[0].tally).toEqual(k.tally);
    expect(m.family.tally).toEqual({ tab: { stars: 3 } });
    expect(withTallies(stripped, 'junk')).toEqual(stripped);
  });

  it('a Starting world set on one device takes back the test-outs another device still has', async () => {
    const { applyPlacement, startAtRank } = await import('../src/kids/store/progress');
    const { nodesOf } = await import('../src/kids/curriculum/worlds');
    const ids = (w: string) => nodesOf(w as never).filter((n) => n.bands.includes('explorer' as never)).map((n) => n.id);
    const today = '2026-09-20';
    const base = kid();
    applyPlacement(base, [1, 2, 3], today);
    expect(base.puzzle.rating).toBe(720);
    const phone = structuredClone(base);
    startAtRank(phone, 2, today, 5000);
    expect(phone.startAt).toEqual({ t: 5000, rank: 2 });
    expect(phone.puzzle.rating).toBe(640);
    expect(phone.testedOut).toBe(1);
    // The laptop missed it and played a World 3 node (a test-out pass there) and a World 1 node.
    const laptop = structuredClone(base);
    const [w1, w3] = [ids('w1')[0], ids('w3')[0]];
    laptop.nodes[w1] = { ...laptop.nodes[w1], stars: 3, plays: 1, last: 6000 };
    laptop.nodes[w3] = { ...laptop.nodes[w3], stars: 2, plays: 1, last: 6000 };
    for (const m of [mergeKid(phone, laptop), mergeKid(laptop, phone)]) {
      expect(m.startAt).toEqual({ t: 5000, rank: 2 });
      expect(m.testedOut).toBe(1);
      expect(m.puzzle.rating).toBe(640);
      expect(ids('w1').every((id) => m.nodes[id]?.passed)).toBe(true);
      expect(m.nodes[w1].stars).toBe(3);
      expect(m.nodes[w3]).toMatchObject({ stars: 2, plays: 1 });
      expect(m.nodes[w3].passed).toBeUndefined();
      expect([...ids('w2'), ...ids('w3')].filter((id) => m.nodes[id]?.passed)).toEqual([]);
      expect(Object.keys(m.nodes).filter((id) => ids('w2').includes(id))).toEqual([]);
      expect(mergeKid(m, m)).toEqual(m);
    }
    // A later Starting world wins again, and survives a round trip through normalization.
    const later = structuredClone(mergeKid(laptop, phone));
    startAtRank(later, 4, today, 7000);
    const round = normalizeKids(JSON.parse(JSON.stringify({ v: 1, kids: [mergeKid(phone, later)] }))).kids[0];
    expect(round.startAt).toEqual({ t: 7000, rank: 4 });
    expect(ids('w3').every((id) => round.nodes[id]?.passed)).toBe(true);
    // The puzzle rating only follows the start before the first puzzle.
    const solved = structuredClone(base);
    solved.puzzle.attempts = 3;
    startAtRank(solved, 1, today, 8000);
    expect(solved.puzzle.rating).toBe(720);
    expect(mergeKid(solved, phone).puzzle.rating).toBe(720);
  });

  it('deleting all kids data empties the star jar on every device', () => {
    const cleared = { kids: [], family: { stars: 0, parties: 0, resetAt: 1000 }, removed: { 'k-mia': 1000 }, updatedAt: 1000 };
    const stale = { kids: [kid()], family: { stars: 150, parties: 1, tally: { base: { stars: 100 }, tab: { stars: 50 } } }, updatedAt: 900 };
    for (const m of [mergeSyncedKids(cleared, stale), mergeSyncedKids(stale, cleared)]) {
      expect(m.kids).toEqual([]);
      expect(m.family).toEqual({ stars: 0, parties: 0, resetAt: 1000 });
    }
    // Stars earned after the delete-all still add up; the stale copy adds nothing.
    const earned = { ...cleared, family: { stars: 3, parties: 0, tally: { phone: { stars: 3 } }, resetAt: 1000 }, updatedAt: 1100 };
    const m = mergeSyncedKids(stale, earned);
    expect(m.family).toEqual(earned.family);
    expect(mergeSyncedKids(m, m)).toEqual(m);
    // The jar's tally synced on its own comes back only from the same jar.
    expect(withTallies(cleared, { family: { tab: { stars: 50 } } }).family.tally).toBeUndefined();
    expect(withTallies(cleared, { family: { tab: { stars: 50 } }, familyResetAt: 1000 }).family.tally).toEqual({ tab: { stars: 50 } });
    expect(withTallies(stale, { family: { tab: { stars: 60 } } }).family.tally).toEqual({ base: { stars: 100 }, tab: { stars: 60 } });
    // A device that joins the copy only now keeps its jar.
    const local = { kids: [], family: { stars: 20, parties: 0, tally: { laptop: { stars: 20 } } }, updatedAt: 50 };
    expect(mergeSyncedKids(joiningCopy(local, earned), earned).family).toMatchObject({ stars: 23, resetAt: 1000 });
    // normalizeKids keeps the delete-all time.
    expect(normalizeKids(JSON.parse(JSON.stringify({ v: 1, ...cleared }))).family).toEqual(cleared.family);
  });

  it("updateKids records this device's minutes, stars and jar stars", () => {
    const s = defaultKidsState();
    s.kids.push(kid());
    __setKidsStateForTests(s);
    const today = dayKey();
    updateKids((d) => {
      d.kids[0].days[today] = { minutes: 2.5, stars: 3 };
      d.family.stars += 3;
    });
    expect(getKids().kids[0].tally).toEqual({ [deviceId()]: { [`${today}.minutes`]: 2.5, [`${today}.stars`]: 3 } });
    expect(getKids().family.tally).toEqual({ [deviceId()]: { stars: 3 } });
  });
});

describe('random histories on three devices', () => {
  /** Stable JSON (sorted keys), the way the sync engine compares copies. */
  const stable = (v: unknown) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
  const merge = (a: Profile, b: Profile) => normalizeProfile(mergeProfiles(a, b));
  afterEach(() => void vi.useRealTimers());

  for (let seed = 1; seed <= 40; seed++) {
    it(`never loses or double counts progress, and resets stick (seed ${seed})`, () => {
      vi.useFakeTimers();
      let n = seed;
      const rand = () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      let clock = new Date('2026-09-01T08:00:00').getTime();
      const devices = ['phone', 'laptop', 'tablet'];
      let copy = profile(() => {}, clock);
      const local: Record<string, Profile> = Object.fromEntries(devices.map((d) => [d, copy]));
      let earned = 0;
      for (let step = 0; step < 60; step++) {
        vi.setSystemTime((clock += Math.floor(rand() * 8 * 3_600_000)));
        const d = devices[Math.floor(rand() * 3)];
        const op = rand();
        if (op < 0.5) {
          const xp = 1 + Math.floor(rand() * 20);
          local[d] = act(local[d], d, (p) => {
            logActivity(p, xp, 'puzzles');
            p.lessons[`l${Math.floor(rand() * 10)}`] = { done: true, t: clock, score: 1 };
          }, clock);
          earned += xp;
        } else if (op < 0.55 && seed % 2 === 0) {
          local[d] = { ...sinceReset(local[d], clock), updatedAt: clock };
          earned = NaN; // the total after a reset depends on who synced when
        } else {
          const m = merge(local[d], copy);
          expect(stable(merge(copy, local[d]))).toBe(stable(m));
          expect(stable(merge(m, m))).toBe(stable(m));
          local[d] = copy = m;
        }
      }
      for (let round = 0; round < 2; round++) for (const d of devices) local[d] = copy = merge(local[d], copy);
      for (const d of devices) expect(stable(local[d])).toBe(stable(copy));
      if (!Number.isNaN(earned)) expect(copy.xp).toBe(earned);
      expect(copy.xp).toBe(Object.values(copy.days).reduce((s, x) => s + x.xp, 0));
      expect(Object.values(copy.lessons).every((l) => l.t >= (copy.resetAt ?? 0))).toBe(true);
    });
  }
});
