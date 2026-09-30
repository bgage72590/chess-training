import { describe, expect, it } from 'vitest';
import { createVoicePacks, type PackEnv, type PackManifest } from '../src/kids/player/voicePack';

// Seeded random runs of the downloader against flaky fakes: whatever fails, pauses or is evicted,
// a finished download means every clip is in the cache, no run fetches a clip the cache holds, and
// the download never has more than five requests open.
const BASE = 'https://app.test/';
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

function scenario(seed: number) {
  const rand = rng(seed);
  const n = 1 + Math.floor(rand() * 40);
  const keys = Array.from({ length: n }, (_, i) => `k${i}`);
  const manifest: PackManifest = { v: 1, voice: 'x', version: 'v1', bytes: n * 500, clips: Object.fromEntries(keys.map((k) => [k, 1000])) };
  const cache = new Map<string, Response>();
  const storage = new Map<string, string>();
  const asked: string[] = [];
  let open = 0;
  let maxOpen = 0;
  let failRate = rand() * 0.5;
  let pauseAfter = rand() < 0.5 ? Math.floor(rand() * n) : Infinity;
  let fetched = 0;
  let packs: ReturnType<typeof createVoicePacks>;
  const put = async (url: string, res: Response) => void cache.set(url, res);
  const env: PackEnv = {
    caches: { open: async () => ({ keys: async () => [...cache.keys()].map((url) => ({ url })), match: async (u) => cache.get(u)?.clone(), put }) },
    fetch: async (url, init) => {
      if (url.endsWith('manifest.json')) return new Response(JSON.stringify(manifest));
      asked.push(url);
      open++;
      maxOpen = Math.max(maxOpen, open);
      try {
        await Promise.resolve();
        if (init?.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
        if (++fetched > pauseAfter) {
          pauseAfter = Infinity;
          packs.pause('x');
        }
        const r = rand();
        if (r < failRate) {
          if (r < failRate / 3) return new Response('', { status: 503 });
          throw new TypeError('Failed to fetch');
        }
        const res = new Response(new Uint8Array(5), { headers: { 'Content-Type': 'audio/mpeg' } });
        // the worker keeps the clip most of the time; the page's own put covers the rest
        if (rand() < 0.8) await put(url, res.clone());
        return res;
      } finally {
        open--;
      }
    },
    storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v) },
    base: BASE,
    estimate: async () => undefined,
    persist: () => undefined,
    connection: () => undefined,
    sleep: async () => undefined,
    now: () => 1,
  };
  packs = createVoicePacks(env);
  return { packs, cache, storage, asked, keys, maxOpen: () => maxOpen, setFailRate: (r: number) => void (failRate = r), rand, n };
}

describe('the downloader under random failures, pauses and evictions', () => {
  it('keeps its promises on 300 seeded runs', async () => {
    for (let seed = 1; seed <= 300; seed++) {
      const s = scenario(seed);
      let done = false;
      for (let round = 0; round < 12 && !done; round++) {
        if (round === 6) s.setFailRate(0); // the connection comes good
        const before = new Set(s.cache.keys());
        const askedBefore = s.asked.length;
        const run = await s.packs.start('x');
        const asks = s.asked.slice(askedBefore).filter((u) => u.includes('.mp3'));
        // a run never asks for a clip the cache already held when it began (retries of others aside)
        expect(asks.filter((u) => before.has(u)), `seed ${seed}`).toEqual([]);
        if (run.phase === 'idle') {
          expect(s.cache.size, `seed ${seed}: finished with clips missing`).toBe(s.n);
          expect(s.packs.record('x')?.clips, `seed ${seed}`).toBe(s.n);
          done = true;
        } else {
          // stopped early: no record may claim a full pack that the cache does not hold
          const rec = s.packs.record('x');
          if (rec) expect(s.cache.size, `seed ${seed}: record without a full cache`).toBe(s.n);
          // the browser clears a few clips between runs
          for (const k of [...s.cache.keys()]) if (s.rand() < 0.15) s.cache.delete(k);
        }
      }
      expect(done, `seed ${seed}: never finished`).toBe(true);
      expect(s.maxOpen(), `seed ${seed}`).toBeLessThanOrEqual(5);
      const st = await s.packs.status('x');
      expect(st.kind).toBe('saved');
    }
  });
});
