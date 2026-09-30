// The Kids part of sync joins whenever a device is linked, not when the Kids screens happen to load: a device
// linked in the main app uploads and pulls its kids in its first sync, and a linked device that starts up
// syncs them from its first sync of that page on. Runs the real sync module (sync/index.ts) with a page
// around it (window, storage, fetch) and the in-memory backend behind fetch.
import { describe, expect, it, vi } from 'vitest';
import { memoryBackend } from '../src/sync/backend';
import { newSyncCode } from '../src/sync/code';

vi.mock('../src/lib/toast', () => ({ toast: vi.fn() }));

const files = new Map<string, string>();
const win: Record<string, unknown> = { addEventListener: () => undefined };
win.top = win;
win.self = win;
vi.stubGlobal('window', win);
vi.stubGlobal('document', { addEventListener: () => undefined, visibilityState: 'visible' });
vi.stubGlobal('navigator', { onLine: true });
const intervals: number[] = [];
vi.stubGlobal('setInterval', (_fn: unknown, ms: number) => void intervals.push(ms));
vi.stubGlobal('localStorage', { getItem: (k: string) => files.get(k) ?? null, setItem: (k: string, v: string) => void files.set(k, v), removeItem: (k: string) => void files.delete(k) });
const mem = memoryBackend();
let calls = 0;
vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
  calls++;
  const fn = url.split('/rpc/')[1];
  const b = JSON.parse(init.body);
  const out = fn === 'sync_get' ? await mem.get(b.code) : fn === 'sync_put' ? await mem.put(b.code, b.data, b.base_version) : (await mem.remove(b.code), null);
  return new Response(out === null ? '' : JSON.stringify(out));
});

const kid = { id: 'k-mia', name: 'Mia', band: 'explorer', start: 'games', created: 1000, avatar: {}, settings: { pipVoice: 'rocket' }, placed: true };
files.set('tempo.kids.v1', JSON.stringify({ v: 1, activeKid: null, kids: [kid], family: { stars: 0, parties: 0 }, device: {}, updatedAt: 1000 }));
files.set('tempo.profile.v1', JSON.stringify({ v: 1, onboarded: true }));

const { sync, loadKidsPart, syncAvailable } = await import('../src/sync');

const parts = (code: string) => Object.keys((mem.slots.get(code)!.data as { parts: object }).parts);

describe('the kids part of sync', () => {
  it('runs in a page that can sync', () => {
    expect(syncAvailable).toBe(true);
  });

  it('is in the first sync of a device that links in the main app, without Kids mode ever being opened', async () => {
    const code = newSyncCode();
    expect(await sync.link(code)).toBe(true);
    expect(parts(code)).toEqual(expect.arrayContaining(['profile', 'profile-tally', 'profile-stamps', 'kids', 'kids-tally', 'kids-stamps']));
    const remote = (mem.slots.get(code)!.data as { parts: { kids: { kids: { id: string; settings: { pipVoice: string } }[] } } }).parts.kids;
    expect(remote.kids.map((k) => [k.id, k.settings.pipVoice])).toEqual([['k-mia', 'rocket']]);
    expect(sync.snapshot.caughtUp).toBe(true);
    sync.unlink();
    expect(sync.snapshot.caughtUp).toBe(false);
  });

  it('is loaded once', async () => {
    await loadKidsPart();
    await loadKidsPart();
    const code = newSyncCode();
    await sync.link(code);
    expect(parts(code).filter((p) => p === 'kids')).toHaveLength(1);
    sync.unlink();
  });

  it('is registered by startSync on a device that is already linked, before its first sync of the page', async () => {
    // a device linked earlier (an older version): the copy has the profile only
    const code = newSyncCode();
    await mem.put(code, { v: 1, at: 1, parts: { profile: { v: 1, onboarded: true, updatedAt: 5 } } }, 0);
    files.set('tempo.sync.v1', JSON.stringify({ code, lastSyncedAt: 1 }));
    vi.resetModules();
    const fresh = await import('../src/sync');
    fresh.startSync();
    await vi.waitFor(() => expect(parts(code)).toContain('kids'));
    expect(parts(code)).toContain('kids-stamps');
    fresh.sync.unlink();
  });

  it('startSync asks the copy for news every minute while the page is showing', async () => {
    vi.resetModules();
    intervals.length = 0;
    const fresh = await import('../src/sync');
    fresh.startSync();
    expect(intervals).toEqual([60_000]);
    expect(fresh.POLL_MS).toBe(60_000);
  });

  it('startSync leaves a device that is not linked alone: nothing is fetched, nothing registered', async () => {
    files.delete('tempo.sync.v1');
    vi.resetModules();
    const before = calls;
    const fresh = await import('../src/sync');
    fresh.startSync();
    await new Promise((r) => setTimeout(r, 30));
    expect(fresh.sync.snapshot.code).toBeNull();
    expect(calls).toBe(before);
  });
});
