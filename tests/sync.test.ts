import { describe, expect, it } from 'vitest';
import { mergeProfiles } from '../src/sync/merge';
import { formatSyncCode, newSyncCode, normalizeSyncCode } from '../src/sync/code';
import { memoryBackend } from '../src/sync/backend';
import { SyncEngine, type SyncPart } from '../src/sync/engine';
import { defaultProfile, logActivity, normalizeProfile, type Profile } from '../src/store/profile';

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
