import { describe, expect, it } from 'vitest';
import swSource from '../src/pwa/sw.template.js?raw';
import { VOICE_LISTS_CACHE, voiceCacheName } from '../src/kids/player/voicePack';

// Runs the service worker template against a fake Cache Storage that behaves like the real one where
// it matters here: entries are keyed by URL, keys() lists them, delete() drops a whole cache.
type Store = Map<string, Response>;

function fakeCaches(opts: { failPut?: (cache: string, url: string) => boolean } = {}) {
  const stores = new Map<string, Store>();
  const handle = (name: string) => {
    const s = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, s);
    const key = (k: string | Request) => (typeof k === 'string' ? k : k.url);
    return {
      addAll: async (reqs: Request[]) => void reqs.forEach((r) => s.set(r.url, new Response(`cached ${r.url}`))),
      match: async (k: string | Request) => s.get(key(k))?.clone(),
      put: async (k: string | Request, res: Response) => {
        if (opts.failPut?.(name, key(k))) throw new Error('QuotaExceededError');
        s.set(key(k), res);
      },
      keys: async () => [...s.keys()].map((u) => new Request(u)),
    };
  };
  const caches = {
    open: async (name: string) => handle(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async () => undefined,
  };
  return { caches, stores };
}

const SCOPE = 'https://app.test/';
const url = (path: string) => SCOPE + path;
const clip = (id: string, key: string, v = '1') => url(`voice/${id}/${key}.mp3?v=${v}`);
const manifestUrl = (id: string) => url(`voice/${id}/manifest.json`);
const manifest = (version: string) => JSON.stringify({ v: 1, voice: 'x', version, clips: { a: 1000 } });

interface Pieces {
  voiceOf: (u: string) => string;
  voiceCacheName: (id: string) => string;
  voiceCacheFor: (u: string) => string;
  keepsCache: (n: string) => boolean;
  VOICE_LISTS: string;
}

function worker(net: (url: string) => Promise<Response>, o: { files?: string[]; failPut?: (cache: string, url: string) => boolean } = {}) {
  const { caches, stores } = fakeCaches({ failPut: o.failPut });
  const on: Record<string, (e: unknown) => void> = {};
  const self = {
    registration: { scope: SCOPE },
    location: { origin: 'https://app.test' },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
    addEventListener: (type: string, fn: (e: unknown) => void) => void (on[type] = fn),
  };
  const pieces = new Function(
    'self',
    'caches',
    'fetch',
    `${swSource.replace('__VERSION__', 'v1').replace('__FILES__', JSON.stringify(o.files ?? []))}
     return { voiceOf, voiceCacheName, voiceCacheFor, keepsCache, VOICE_LISTS };`,
  )(self, caches, (r: Request | string) => net(typeof r === 'string' ? r : r.url)) as Pieces;
  const get = async (u: string, range?: string): Promise<Response> => {
    let answer: Promise<Response> | undefined;
    on.fetch({ request: new Request(u, { headers: range ? { range } : {} }), respondWith: (p: Promise<Response>) => (answer = p), waitUntil: () => undefined });
    if (!answer) throw new Error('not answered');
    return answer;
  };
  const run = async (type: 'install' | 'activate') => {
    let done: Promise<unknown> = Promise.resolve();
    on[type]({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  };
  const message = async (data: unknown) => {
    const replies: unknown[] = [];
    let done: Promise<unknown> = Promise.resolve();
    on.message({ data, ports: [{ postMessage: (m: unknown) => replies.push(m) }], waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    return replies;
  };
  const put = async (cache: string, u: string, body = 'x') => (await caches.open(cache)).put(u, new Response(body));
  const has = (cache: string, u: string) => stores.get(cache)?.has(u) ?? false;
  const names = () => [...stores.keys()].sort();
  return { get, run, message, put, has, names, stores, pieces };
}

const audio = () => new Response(new Uint8Array(100), { headers: { 'Content-Type': 'audio/mpeg' } });
// The worker does not wait for the puts that keep a clip: let them finish.
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('cache names', () => {
  it('sends clips to their voice, lists to the shared cache, and agrees with the page', () => {
    const { pieces: p } = worker(async () => audio());
    expect(p.voiceOf(clip('sunny', 'k1'))).toBe('sunny');
    expect(p.voiceOf(manifestUrl('honey'))).toBe('honey');
    expect(p.voiceOf(url('voice/voices.json'))).toBe('');
    expect(p.voiceCacheFor(clip('sunny', 'k1'))).toBe('tempo-voice-sunny');
    expect(p.voiceCacheFor(manifestUrl('sunny'))).toBe('tempo-voice-lists');
    expect(p.voiceCacheFor(url('voice/voices.json'))).toBe('tempo-voice-lists');
    expect(p.voiceCacheFor(url('voice/stray.mp3'))).toBe('tempo-voice-lists');
    // the page's downloader (voicePack.ts) counts clips in the same caches the worker fills
    expect(p.voiceCacheName('rocket')).toBe(voiceCacheName('rocket'));
    expect(p.VOICE_LISTS).toBe(VOICE_LISTS_CACHE);
  });

  it('keeps the current app, fonts and every voice cache, and nothing else', () => {
    const { pieces: p } = worker(async () => audio());
    expect(['tempo-v1', 'tempo-fonts', 'tempo-voice-sunny', 'tempo-voice-lists'].every(p.keepsCache)).toBe(true);
    expect(['tempo-oldversion', 'tempo-voice'].some(p.keepsCache)).toBe(false);
  });
});

describe('one cache per voice: a new recording clears only that voice', () => {
  it("caches each voice's clips apart", async () => {
    const w = worker(async () => audio());
    await w.get(clip('sunny', 'a'));
    await w.get(clip('breezy', 'a'));
    await settle();
    expect(w.has('tempo-voice-sunny', clip('sunny', 'a'))).toBe(true);
    expect(w.has('tempo-voice-breezy', clip('breezy', 'a'))).toBe(true);
    expect(w.has('tempo-voice-sunny', clip('breezy', 'a'))).toBe(false);
  });

  it('drops the clips of the voice whose manifest version changed, and no other voice', async () => {
    let sunny = 'v1';
    const w = worker(async (u) => (u.endsWith('sunny/manifest.json') ? new Response(manifest(sunny)) : u.endsWith('breezy/manifest.json') ? new Response(manifest('b1')) : audio()));
    await w.get(manifestUrl('sunny'));
    await w.get(manifestUrl('breezy'));
    for (const k of ['a', 'b', 'c']) {
      await w.get(clip('sunny', k));
      await w.get(clip('breezy', k));
    }
    await settle();
    expect(w.stores.get('tempo-voice-sunny')?.size).toBe(3);
    expect(w.stores.get('tempo-voice-breezy')?.size).toBe(3);

    await w.get(manifestUrl('sunny')); // the same version again: nothing is cleared
    expect(w.stores.get('tempo-voice-sunny')?.size).toBe(3);

    sunny = 'v2';
    const answered = await w.get(manifestUrl('sunny'));
    expect(JSON.parse(await answered.text()).version).toBe('v2'); // the page gets the new manifest
    expect(w.stores.has('tempo-voice-sunny')).toBe(false);
    expect(w.stores.get('tempo-voice-breezy')?.size).toBe(3);
    const lists = w.stores.get('tempo-voice-lists')!;
    expect(JSON.parse(await lists.get(manifestUrl('sunny'))!.text()).version).toBe('v2');
    expect(JSON.parse(await lists.get(manifestUrl('breezy'))!.text()).version).toBe('b1');
  });

  it('answers the manifest only after the old clips are gone, so a download that starts from it is safe', async () => {
    let version = 'v1';
    const w = worker(async (u) => (u.endsWith('manifest.json') ? new Response(manifest(version)) : audio()));
    await w.get(manifestUrl('sunny'));
    await w.get(clip('sunny', 'a'));
    await settle();
    version = 'v2';
    await w.get(manifestUrl('sunny'));
    await w.get(clip('sunny', 'new')); // the download's first clip, right after the manifest
    await settle();
    expect([...w.stores.get('tempo-voice-sunny')!.keys()]).toEqual([clip('sunny', 'new')]);
  });

  it('serves the lists from the cache when offline, and a first manifest clears nothing', async () => {
    let online = true;
    const w = worker(async (u) => {
      if (!online) throw new TypeError('Failed to fetch');
      return u.endsWith('manifest.json') ? new Response(manifest('v1')) : audio();
    });
    await w.get(clip('sunny', 'a'));
    await settle();
    await w.get(manifestUrl('sunny')); // no earlier manifest: the clip cached before it stays
    expect(w.has('tempo-voice-sunny', clip('sunny', 'a'))).toBe(true);
    online = false;
    expect(JSON.parse(await (await w.get(manifestUrl('sunny'))).text()).version).toBe('v1');
    expect((await w.get(manifestUrl('honey'))).type).toBe('error');
  });
});

describe('the worker activates without losing voices', () => {
  it('deletes old app caches but keeps fonts, the current cache and all voice caches', async () => {
    const w = worker(async () => audio());
    for (const c of ['tempo-old1', 'tempo-fonts', 'tempo-v1', 'tempo-voice-sunny', 'tempo-voice-lists', 'other-site']) await w.put(c, url('x'));
    await w.run('activate');
    expect(w.names()).toEqual(['other-site', 'tempo-fonts', 'tempo-v1', 'tempo-voice-lists', 'tempo-voice-sunny']);
  });

  it("moves the old single 'tempo-voice' cache into per-voice caches and deletes it", async () => {
    const w = worker(async () => audio());
    await w.put('tempo-voice', clip('sunny', 'a'), 'sunny-a');
    await w.put('tempo-voice', clip('sunny', 'b'), 'sunny-b');
    await w.put('tempo-voice', clip('honey', 'a'), 'honey-a');
    await w.put('tempo-voice', url('voice/voices.json'), '{}');
    await w.put('tempo-voice', manifestUrl('sunny'), manifest('v1'));
    await w.put('tempo-voice-sunny', clip('sunny', 'b'), 'already-there');
    await w.run('activate');
    expect(w.names()).toEqual(['tempo-voice-honey', 'tempo-voice-lists', 'tempo-voice-sunny']);
    const sunny = w.stores.get('tempo-voice-sunny')!;
    expect([...sunny.keys()].sort()).toEqual([clip('sunny', 'a'), clip('sunny', 'b')]);
    expect(await sunny.get(clip('sunny', 'a'))!.text()).toBe('sunny-a');
    expect(await sunny.get(clip('sunny', 'b'))!.text()).toBe('already-there'); // a newer copy is not overwritten
    expect([...w.stores.get('tempo-voice-honey')!.keys()]).toEqual([clip('honey', 'a')]);
    expect([...w.stores.get('tempo-voice-lists')!.keys()].sort()).toEqual([manifestUrl('sunny'), url('voice/voices.json')].sort());
  });

  it('keeps the old cache when copying fails, and finishes the move at the next activation', async () => {
    let fail = true;
    const w = worker(async () => audio(), { failPut: (cache) => fail && cache === 'tempo-voice-honey' });
    await w.put('tempo-voice', clip('sunny', 'a'));
    await w.put('tempo-voice', clip('honey', 'a'));
    await w.run('activate');
    expect(w.names()).toContain('tempo-voice'); // nothing is lost
    fail = false;
    await w.run('activate');
    expect(w.names()).toEqual(['tempo-voice-honey', 'tempo-voice-sunny']);
  });

  it('does nothing when there is no old cache', async () => {
    const w = worker(async () => audio());
    await w.put('tempo-voice-sunny', clip('sunny', 'a'));
    await w.run('activate');
    expect(w.names()).toEqual(['tempo-voice-sunny']);
  });
});

describe('the worker reports whether the app is saved for offline use', () => {
  it('counts the files of the current version that are missing from its cache', async () => {
    const files = ['./', './assets/a.js', './assets/b.css'];
    const w = worker(async () => audio(), { files });
    expect(await w.message({ type: 'status' })).toEqual([{ type: 'status', version: 'v1', files: 3, missing: 3 }]);
    await w.run('install');
    expect(await w.message({ type: 'status' })).toEqual([{ type: 'status', version: 'v1', files: 3, missing: 0 }]);
    w.stores.get('tempo-v1')!.delete(url('assets/b.css'));
    expect((await w.message({ type: 'status' }))[0]).toMatchObject({ files: 3, missing: 1 });
    expect(await w.message({ type: 'other' })).toEqual([]);
  });
});
