import { describe, expect, it } from 'vitest';
import swSource from '../src/pwa/sw.template.js?raw';

// Runs the service worker template against a fake Cache Storage (which, like the real one, refuses
// partial responses) and a fake network.
function worker(net: (url: string) => Promise<Response>) {
  const stores = new Map<string, Map<string, Response>>();
  const key = (k: string | Request) => (typeof k === 'string' ? k : k.url);
  const caches = {
    open: async (name: string) => {
      const s = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, s);
      return {
        match: async (k: string | Request) => s.get(key(k))?.clone(),
        put: async (k: string | Request, res: Response) => {
          if (res.status === 206) throw new TypeError('Partial response (status code 206) is unsupported');
          s.set(key(k), res);
        },
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async () => undefined,
  };
  let onFetch: (e: unknown) => void = () => undefined;
  const self = {
    registration: { scope: 'https://app.test/' },
    location: { origin: 'https://app.test' },
    addEventListener: (type: string, fn: (e: unknown) => void) => void (type === 'fetch' && (onFetch = fn)),
  };
  new Function('self', 'caches', 'fetch', swSource.replace('__VERSION__', 'test').replace('__FILES__', '[]'))(self, caches, net);
  const get = (url: string, range?: string): Promise<Response> => {
    let answer: Promise<Response> | undefined;
    onFetch({ request: new Request(url, { headers: range ? { range } : {} }), respondWith: (p: Promise<Response>) => (answer = p), waitUntil: () => undefined });
    return answer ?? Promise.reject(new Error('not answered'));
  };
  return { get, stores };
}

const CLIP = 'https://app.test/voice/sunny/0auxl0y1bne7j8.mp3?v=1';
const bytes = new Uint8Array(1000).map((_, i) => i % 256);

describe("the service worker and Pip's clips", () => {
  it('keeps a clip the audio element asked for by range, and plays it offline', async () => {
    let online = true;
    const asked: string[] = [];
    const { get, stores } = worker(async (url) => {
      asked.push(url);
      if (!online) throw new TypeError('Failed to fetch');
      return new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg', Vary: 'Origin' } });
    });

    const first = await get(CLIP, 'bytes=0-');
    expect(first.status).toBe(206);
    expect(first.headers.get('Content-Range')).toBe('bytes 0-999/1000');
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(bytes);
    await Promise.resolve();
    expect(stores.get('tempo-voice-sunny')?.get(CLIP)?.status).toBe(200); // the whole clip is kept, in its voice's cache

    online = false;
    const part = await get(CLIP, 'bytes=500-');
    expect(part.status).toBe(206);
    expect(part.headers.get('Content-Range')).toBe('bytes 500-999/1000');
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(bytes.slice(500));
    expect((await get(CLIP, 'bytes=0-1')).headers.get('Content-Length')).toBe('2');
    expect((await get(CLIP, 'bytes=-10')).headers.get('Content-Range')).toBe('bytes 990-999/1000');
    const whole = await get(CLIP);
    expect(whole.status).toBe(200);
    expect((await whole.arrayBuffer()).byteLength).toBe(1000);
    expect(asked).toEqual([CLIP]); // fetched once, without the range
    await expect(get('https://app.test/voice/sunny/other.mp3?v=1', 'bytes=0-')).rejects.toThrow();
  });
});
