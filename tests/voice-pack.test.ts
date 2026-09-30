import { describe, expect, it } from 'vitest';
import { autoDownloadWanted, createVoicePacks, formatSize, isIos, isUnmetered, megabytes, mustAskFirst, packView, voiceCacheName, type ConnectionInfo, type PackEnv, type PackManifest, type PackRun, type PackStatus } from '../src/kids/player/voicePack';

// The downloader runs against a fake Cache Storage, a fake network and fake storage: no timers, no
// wall-clock, no browser.
const BASE = 'https://app.test/';
const clipUrl = (id: string, key: string, version = 'v1') => `${BASE}voice/${id}/${key}.mp3?v=${encodeURIComponent(version)}`;
const keysOf = (n: number) => Array.from({ length: n }, (_, i) => `k${String(i).padStart(3, '0')}`);
const manifestOf = (n: number, version = 'v1', bytes: number | null = n * 1000): PackManifest => ({ v: 1, voice: 'x', version, ...(bytes === null ? {} : { bytes }), clips: Object.fromEntries(keysOf(n).map((k) => [k, 1000])) });

interface Net {
  version: string;
  clips: number;
  /** Fails a clip's fetch: return an HTTP status or 'net' for a dropped connection. */
  fail?: (url: string, attempt: number) => number | 'net' | undefined;
  /** Holds every clip fetch until released (to pause in the middle). */
  gate?: Promise<void>;
  /** Whether the service worker keeps what the page fetches (a page with no worker in control does not). */
  worker: boolean;
  offline: boolean;
}

function setup(o: Partial<Net> & { estimate?: { usage?: number; quota?: number }; connection?: ConnectionInfo; putFails?: () => boolean; cacheForgets?: boolean; nobytes?: boolean } = {}) {
  const net: Net = { version: 'v1', clips: 10, worker: true, offline: false, ...o };
  const stores = new Map<string, Map<string, Response>>();
  const storage = new Map<string, string>();
  const attempts = new Map<string, number>();
  const asked: string[] = [];
  const sleeps: number[] = [];
  let inflight = 0;
  let maxInflight = 0;
  let persists = 0;
  const cacheOf = (name: string) => {
    const s = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, s);
    return {
      keys: async () => [...s.keys()].map((url) => ({ url })),
      match: async (url: string) => s.get(url)?.clone(),
      put: async (url: string, res: Response) => {
        if (o.putFails?.()) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
        if (!o.cacheForgets) s.set(url, res);
      },
    };
  };
  const fetchFn: PackEnv['fetch'] = async (url, init) => {
    asked.push(url);
    if (net.offline) throw new TypeError('Failed to fetch');
    if (url.endsWith('/manifest.json')) return new Response(JSON.stringify(manifestOf(net.clips, net.version, o.nobytes ? null : net.clips * 1000)));
    inflight++;
    maxInflight = Math.max(maxInflight, inflight);
    try {
      if (net.gate) await net.gate;
      if (init?.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      const n = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, n);
      const f = net.fail?.(url, n);
      if (f === 'net') throw new TypeError('Failed to fetch');
      if (f) return new Response('', { status: f });
      const res = new Response(new Uint8Array(20), { headers: { 'Content-Type': 'audio/mpeg' } });
      if (net.worker) await cacheOf(voiceCacheName(url.split('/voice/')[1].split('/')[0])).put(url, res.clone());
      return res;
    } finally {
      inflight--;
    }
  };
  const env: PackEnv = {
    caches: { open: async (name) => cacheOf(name) },
    fetch: fetchFn,
    storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v) },
    base: BASE,
    estimate: async () => o.estimate,
    persist: () => void persists++,
    connection: () => o.connection,
    sleep: async (ms) => void sleeps.push(ms),
    now: () => 1_000,
  };
  const packs = createVoicePacks(env);
  const cached = (id = 'x') => stores.get(voiceCacheName(id))?.size ?? 0;
  const preload = (keys: string[], id = 'x', version = 'v1') => keys.forEach((k) => void cacheOf(voiceCacheName(id)).put(clipUrl(id, k, version), new Response('c')));
  return { packs, net, stores, storage, asked, sleeps, cached, preload, maxInflight: () => maxInflight, persists: () => persists, clipAsks: () => asked.filter((u) => u.includes('.mp3')) };
}

describe('downloading a voice', () => {
  it('fetches every clip a few at a time, reports each one, and writes the record when all are cached', async () => {
    const t = setup({ clips: 24 });
    const seen: number[] = [];
    t.packs.subscribe(() => seen.push(t.packs.run('x').done));
    const run = await t.packs.start('x');
    expect(run).toMatchObject({ phase: 'idle', done: 24, total: 24, bytesTotal: 24000, bytesDone: 24000 });
    expect(t.cached()).toBe(24);
    expect(t.maxInflight()).toBeGreaterThan(1);
    expect(t.maxInflight()).toBeLessThanOrEqual(6);
    expect(seen.filter((d, i) => d !== seen[i - 1]).length).toBeGreaterThanOrEqual(24); // one report per clip
    expect(seen).toEqual([...seen].sort((a, b) => a - b)); // and never backwards
    expect(t.packs.record('x')).toEqual({ version: 'v1', clips: 24, bytes: 24000, at: 1000 });
    expect(t.packs.statusOf('x')).toMatchObject({ kind: 'saved', cached: 24, total: 24, remaining: 0 });
    expect(t.persists()).toBe(1); // asks the browser to keep the data when the download starts
  });

  it('skips clips that are already cached, so resuming and re-running cost only what is missing', async () => {
    const t = setup({ clips: 10 });
    t.preload(keysOf(10).slice(0, 4));
    const run = await t.packs.start('x');
    expect(t.clipAsks()).toHaveLength(6);
    expect(run.done).toBe(10);
    expect(t.packs.record('x')?.clips).toBe(10);
    const again = t.clipAsks().length;
    await t.packs.start('x');
    expect(t.clipAsks()).toHaveLength(again); // nothing left to fetch
  });

  it('keeps clips itself when no worker is in control, so the count stays true', async () => {
    const t = setup({ clips: 6, worker: false });
    await t.packs.start('x');
    expect(t.cached()).toBe(6);
    expect(t.packs.record('x')).toBeDefined();
  });

  it('retries a clip with a growing wait, but not one that is simply missing', async () => {
    const flaky = clipUrl('x', 'k002');
    const t = setup({ clips: 5, fail: (u, n) => (u === flaky && n < 3 ? 503 : u === clipUrl('x', 'k004') ? 404 : undefined) });
    const run = await t.packs.start('x');
    expect(t.sleeps.filter((ms) => ms > 0).slice(0, 2)).toEqual([500, 1000]);
    expect(t.cached()).toBe(4); // the missing one stays missing
    expect(run).toMatchObject({ phase: 'failed', reason: 'network', done: 4 });
    expect(t.packs.record('x')).toBeUndefined(); // no record until every clip is cached
    expect(t.clipAsks().filter((u) => u === clipUrl('x', 'k004'))).toHaveLength(2); // once per pass, never re-tried in one
  });

  it('stops on a dead connection, keeps what it has, and carries on when it is back', async () => {
    const t = setup({ clips: 40 });
    t.net.offline = false;
    t.net.fail = (u) => (u > clipUrl('x', 'k010') ? 'net' : undefined);
    const run = await t.packs.start('x');
    expect(run).toMatchObject({ phase: 'failed', reason: 'network' });
    expect(t.clipAsks().length).toBeLessThan(40 + 3 * 4 * 2); // bounded: not every clip is tried four times
    expect(t.packs.record('x')).toBeUndefined();
    const before = t.cached();
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(40);

    t.net.fail = undefined;
    const asked = t.clipAsks().length;
    const done = await t.packs.start('x');
    expect(done.phase).toBe('idle');
    expect(t.clipAsks().length - asked).toBe(40 - before); // resumed: only the missing ones
    expect(t.packs.record('x')?.clips).toBe(40);
  });

  it('pauses in the middle and resumes from what is cached', async () => {
    let release = () => undefined as void;
    const t = setup({ clips: 30 });
    t.net.gate = new Promise<void>((r) => (release = r));
    const first = t.packs.start('x');
    await new Promise((r) => setTimeout(r, 0));
    expect(t.packs.run('x').phase).toBe('running');
    t.packs.pause('x');
    release();
    const paused = await first;
    expect(paused.phase).toBe('paused');
    expect(t.packs.record('x')).toBeUndefined();
    const have = t.cached();
    expect(have).toBeLessThan(30);

    t.net.gate = undefined;
    const before = t.clipAsks().length;
    const done = await t.packs.start('x');
    expect(done.phase).toBe('idle');
    expect(t.clipAsks().length - before).toBe(30 - have);
    expect(t.packs.record('x')?.clips).toBe(30);
  });

  it('cancel forgets the run but keeps the clips fetched so far', async () => {
    let release = () => undefined as void;
    const t = setup({ clips: 12 });
    t.net.gate = new Promise<void>((r) => (release = r));
    const first = t.packs.start('x');
    await new Promise((r) => setTimeout(r, 0));
    t.packs.cancel('x');
    release();
    expect((await first).phase).toBe('idle');
    expect(t.packs.run('x')).toMatchObject({ phase: 'idle', done: 0, total: 0 });
    expect(t.packs.running()).toBeUndefined();
    expect(t.packs.record('x')).toBeUndefined();
    const have = t.cached();
    expect(have).toBeLessThan(12); // stopped, keeping what it fetched
    t.net.gate = undefined;
    expect((await t.packs.start('x')).phase).toBe('idle'); // and a fresh start carries on from it
  });

  it('never writes the record while a clip is missing from the cache, even if every fetch worked', async () => {
    const t = setup({ clips: 4, worker: false, cacheForgets: true });
    const run = await t.packs.start('x');
    expect(run.phase).toBe('failed');
    expect(t.packs.record('x')).toBeUndefined();
  });

  it('downloads one voice at a time', async () => {
    let release = () => undefined as void;
    const t = setup({ clips: 12 });
    t.net.gate = new Promise<void>((r) => (release = r));
    const first = t.packs.start('x');
    await new Promise((r) => setTimeout(r, 0));
    const other = await t.packs.start('y');
    expect(other).toMatchObject({ phase: 'failed', reason: 'busy' });
    expect(t.clipAsks().every((u) => u.includes('/voice/x/'))).toBe(true);
    expect(t.packs.running()).toBe('x');
    release();
    await first;
    expect(t.packs.running()).toBeUndefined();
  });

  it('fails cleanly when the clip list is out of reach', async () => {
    const t = setup({ clips: 4, offline: true });
    expect(await t.packs.start('x')).toMatchObject({ phase: 'failed', reason: 'manifest' });
    expect(t.clipAsks()).toHaveLength(0);
  });
});

describe('room on the device', () => {
  it('refuses before fetching anything when the pack does not fit', async () => {
    const t = setup({ clips: 10, estimate: { usage: 990_000, quota: 1_000_000 } }); // 10 KB free for a 10 KB pack: no headroom
    const run = await t.packs.start('x');
    expect(run).toMatchObject({ phase: 'failed', reason: 'space' });
    expect(t.clipAsks()).toHaveLength(0);
  });

  it('starts when there is room, and only counts what is still missing', async () => {
    const t = setup({ clips: 10, estimate: { usage: 0, quota: 20_000 } });
    t.preload(keysOf(10).slice(0, 9));
    expect((await t.packs.start('x')).phase).toBe('idle'); // 1 KB missing fits in 20 KB
  });

  it('stops for good when the browser says storage is full mid-download', async () => {
    let puts = 0;
    const t = setup({ clips: 20, worker: false, putFails: () => ++puts > 5 });
    const run = await t.packs.start('x');
    expect(run).toMatchObject({ phase: 'failed', reason: 'space' });
    expect(t.clipAsks().length).toBeLessThan(20); // it did not go on trying
    expect(t.packs.record('x')).toBeUndefined();
  });

  it('goes ahead when the browser cannot say how much room there is', async () => {
    const t = setup({ clips: 4 });
    expect((await t.packs.start('x')).phase).toBe('idle');
  });
});

describe('what a voice has on the device is counted, not remembered', () => {
  it('says saved, then counts again after the browser clears some or all of it', async () => {
    const t = setup({ clips: 10 });
    await t.packs.start('x');
    expect(await t.packs.status('x')).toMatchObject({ kind: 'saved', cached: 10 });

    const cache = t.stores.get('tempo-voice-x')!;
    for (const k of keysOf(10).slice(0, 4)) cache.delete(clipUrl('x', k)); // evicted in part
    const part = await t.packs.status('x');
    expect(part).toMatchObject({ kind: 'none', cached: 6, total: 10, cleared: true });
    expect(part.remaining).toBe(4000);
    expect(t.packs.record('x')).toBeDefined(); // the record is a note of what was saved, not proof

    cache.clear();
    expect(await t.packs.status('x')).toMatchObject({ kind: 'none', cached: 0, cleared: true, remaining: 10000 });

    const again = await t.packs.start('x'); // Download after eviction fetches it all again
    expect(again.phase).toBe('idle');
    expect(await t.packs.status('x')).toMatchObject({ kind: 'saved' });
  });

  it("calls a pack saved when the cache holds every clip, whoever put them there (older versions' prefetch)", async () => {
    const t = setup({ clips: 8 });
    t.preload(keysOf(8));
    expect(t.packs.record('x')).toBeUndefined();
    expect(await t.packs.status('x')).toMatchObject({ kind: 'saved', cached: 8 });
    expect(t.packs.record('x')).toMatchObject({ version: 'v1', clips: 8 });
  });

  it('offers an update when a new recording is out for a voice that was saved', async () => {
    const t = setup({ clips: 6 });
    await t.packs.start('x');
    t.net.version = 'v2'; // re-recorded; the service worker clears the old clips when it sees the manifest
    t.stores.delete('tempo-voice-x');
    const s = await t.packs.status('x');
    expect(s).toMatchObject({ kind: 'update', cached: 0, total: 6 });
    await t.packs.start('x');
    expect(t.packs.record('x')?.version).toBe('v2');
    expect(await t.packs.status('x')).toMatchObject({ kind: 'saved' });
    expect(t.clipAsks().filter((u) => u.includes('v=v2'))).toHaveLength(6);
  });

  it('a voice never saved is simply streamed, and an unreachable list is unknown', async () => {
    const t = setup({ clips: 6 });
    expect(await t.packs.status('x')).toMatchObject({ kind: 'none', cached: 0, cleared: false });
    t.net.offline = true;
    expect(await t.packs.status('x')).toMatchObject({ kind: 'unknown' });
  });

  it('sizes the pack from the manifest, or from the durations when it has no size', async () => {
    const t = setup({ clips: 5 });
    expect((await t.packs.status('x')).bytes).toBe(5000);
    const u = setup({ clips: 5, nobytes: true });
    expect((await u.packs.status('x')).bytes).toBe(5 * 1000 * 8); // 64 kbit/s: 8 bytes per millisecond
  });
});

describe('saving a voice on its own', () => {
  const wifi: ConnectionInfo = { type: 'wifi' };

  it('needs a connection known to be unmetered, with data saving off', () => {
    expect(isUnmetered({ type: 'wifi' })).toBe(true);
    expect(isUnmetered({ type: 'ethernet' })).toBe(true);
    expect(isUnmetered({ type: 'wifi', saveData: true })).toBe(false);
    expect(isUnmetered({ type: 'cellular' })).toBe(false);
    expect(isUnmetered({ type: 'unknown' })).toBe(false);
    expect(isUnmetered({})).toBe(false); // e.g. Chrome desktop: no type
    expect(isUnmetered(undefined)).toBe(false); // Safari: no connection information at all
  });

  it('asks first unless the connection is known unmetered, and always on iPhone and iPad', () => {
    expect(mustAskFirst({ type: 'wifi' }, false)).toBe(false);
    expect(mustAskFirst({ type: 'wifi' }, true)).toBe(true);
    expect(mustAskFirst(undefined, false)).toBe(true);
    expect(mustAskFirst({ type: 'cellular' }, false)).toBe(true);
    expect(mustAskFirst({ type: 'wifi', saveData: true }, false)).toBe(true);
  });

  it('recognises iPhone, iPad (also as a Mac) and not a Mac', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIos('Mozilla/5.0 (X11; Linux x86_64) Chrome/120', 0)).toBe(false);
  });

  it('wants a voice that is not saved at this recording, has not had its one automatic try, on an unmetered connection', () => {
    const base = { connection: wifi, complete: false, version: 'v1' };
    expect(autoDownloadWanted(base)).toBe(true);
    expect(autoDownloadWanted({ ...base, complete: true })).toBe(false);
    expect(autoDownloadWanted({ ...base, savedVersion: 'v1' })).toBe(false); // saved once (then cleared): the person decides
    expect(autoDownloadWanted({ ...base, savedVersion: 'v0' })).toBe(true); // a new recording is another version
    expect(autoDownloadWanted({ ...base, autoVersion: 'v1' })).toBe(false);
    expect(autoDownloadWanted({ ...base, connection: undefined })).toBe(false);
    expect(autoDownloadWanted({ ...base, connection: { type: 'cellular' } })).toBe(false);
  });

  it('downloads only that voice, only on Wi-Fi, and touches nothing otherwise', async () => {
    for (const connection of [undefined, { type: 'cellular' }, { type: 'wifi', saveData: true }, {}] as (ConnectionInfo | undefined)[]) {
      const t = setup({ clips: 6, connection });
      expect(await t.packs.autoDownload('x')).toBe(false);
      expect(t.asked).toHaveLength(0); // not even the clip list
    }
    const t = setup({ clips: 6, connection: wifi });
    expect(await t.packs.autoDownload('x')).toBe(true);
    expect(t.cached('x')).toBe(6);
    expect(t.clipAsks().every((u) => u.includes('/voice/x/'))).toBe(true);
    expect(t.persists()).toBe(1);
  });

  it('does not repeat: not once saved (even after the browser clears it), not after a pause, but again for a new recording', async () => {
    const t = setup({ clips: 6, connection: wifi });
    await t.packs.autoDownload('x');
    t.stores.delete('tempo-voice-x'); // evicted
    const asked = t.clipAsks().length;
    expect(await t.packs.autoDownload('x')).toBe(false);
    expect(t.clipAsks()).toHaveLength(asked);

    t.net.version = 'v2';
    expect(await t.packs.autoDownload('x')).toBe(true);
    expect(t.packs.record('x')?.version).toBe('v2');

    // A pause is a no: the person's choice is kept for that recording.
    let release = () => undefined as void;
    const p = setup({ clips: 20, connection: wifi });
    p.net.gate = new Promise<void>((r) => (release = r));
    const auto = p.packs.autoDownload('x');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    p.packs.pause('x');
    release();
    await auto;
    expect(p.packs.run('x').phase).toBe('paused');
    const asks = p.clipAsks().length;
    p.net.gate = undefined;
    expect(await p.packs.autoDownload('x')).toBe(false);
    expect(p.clipAsks()).toHaveLength(asks);
  });

  it('picks up again on the next launch after a dropped connection (until it is saved or declined)', async () => {
    const t = setup({ clips: 20, connection: wifi, fail: () => 'net' });
    expect(await t.packs.autoDownload('x')).toBe(true);
    expect(t.packs.run('x').phase).toBe('failed');
    t.net.fail = undefined;
    expect(await t.packs.autoDownload('x')).toBe(true);
    expect(t.packs.record('x')?.clips).toBe(20);
  });

  it('does not start while another voice downloads', async () => {
    let release = () => undefined as void;
    const t = setup({ clips: 10, connection: wifi });
    t.net.gate = new Promise<void>((r) => (release = r));
    const first = t.packs.start('y');
    await new Promise((r) => setTimeout(r, 0));
    expect(await t.packs.autoDownload('x')).toBe(false);
    release();
    await first;
  });
});

describe('what a voice row shows', () => {
  const idle: PackRun = { phase: 'idle', done: 0, total: 0, bytesDone: 0, bytesTotal: 0 };
  const status = (o: Partial<PackStatus>): PackStatus => ({ kind: 'none', cached: 0, total: 2156, bytes: 43_859_520, remaining: 43_859_520, cleared: false, ...o });

  it('formats sizes the way a storage screen does', () => {
    expect(formatSize(43_859_520)).toBe('44 MB');
    expect(formatSize(39_450_624)).toBe('39 MB');
    expect(megabytes(16_230_000)).toBe('16');
    expect(formatSize(4_400_000)).toBe('4.4 MB');
    expect(formatSize(0)).toBe('0.0 MB');
  });

  it('streams as used until saved, with the size still to fetch', () => {
    expect(packView(idle, undefined)).toEqual({ kind: 'checking' });
    expect(packView(idle, status({}))).toEqual({ kind: 'streams', size: 43_859_520, cleared: false, offline: false });
    expect(packView(idle, status({ kind: 'unknown' }))).toMatchObject({ kind: 'streams', offline: true });
    expect(packView(idle, status({ cached: 500, remaining: 30e6, cleared: true }))).toEqual({ kind: 'streams', size: 30e6, cleared: true, offline: false });
  });

  it('shows progress while downloading, paused and failed, and that wins over what is counted', () => {
    const running: PackRun = { phase: 'running', done: 800, total: 2156, bytesDone: 16_230_000, bytesTotal: 43_859_520 };
    expect(packView(running, status({}))).toEqual({ kind: 'downloading', pct: 37, done: 16_230_000, total: 43_859_520, reason: undefined });
    expect(packView({ ...running, phase: 'paused' }, status({}))).toMatchObject({ kind: 'paused', pct: 37 });
    expect(packView({ ...running, phase: 'failed', reason: 'space' }, undefined)).toMatchObject({ kind: 'failed', reason: 'space' });
    expect(packView({ ...running, bytesDone: running.bytesTotal }, undefined)).toMatchObject({ pct: 100 });
    expect(packView({ ...running, bytesTotal: 0, bytesDone: 0 }, undefined)).toMatchObject({ pct: 0 });
  });

  it('shows saved and update', () => {
    expect(packView(idle, status({ kind: 'saved', cached: 2156, remaining: 0 }))).toEqual({ kind: 'saved', size: 43_859_520 });
    expect(packView(idle, status({ kind: 'update' }))).toEqual({ kind: 'update', size: 43_859_520 });
  });
});
