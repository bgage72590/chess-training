import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import swSource from '../src/pwa/sw.template.js?raw';
import { toast } from '../src/lib/toast';

vi.mock('../src/lib/toast', () => ({ toast: vi.fn() }));

/** Runs the service worker template with a fake Cache Storage and network; `files` is its file list. */
function worker(net: (req: Request | { url: string; mode: string }, init?: RequestInit) => Promise<Response>, files: string[]) {
  const stores = new Map<string, Map<string, Response>>();
  const added: Request[] = [];
  const caches = {
    open: async (name: string) => {
      const s = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, s);
      return {
        addAll: async (reqs: Request[]) => {
          added.push(...reqs);
          for (const r of reqs) s.set(r.url, new Response(`cached ${r.url}`));
        },
        match: async (k: string | Request) => s.get(typeof k === 'string' ? k : k.url)?.clone(),
        put: async (k: string | Request, res: Response) => void s.set(typeof k === 'string' ? k : k.url, res),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (k: string | Request) => {
      for (const s of stores.values()) {
        const hit = s.get(typeof k === 'string' ? k : k.url);
        if (hit) return hit.clone();
      }
    },
  };
  const on: Record<string, (e: unknown) => void> = {};
  const self = {
    registration: { scope: 'https://app.test/' },
    location: { origin: 'https://app.test' },
    skipWaiting: () => Promise.resolve(),
    addEventListener: (type: string, fn: (e: unknown) => void) => void (on[type] = fn),
  };
  new Function('self', 'caches', 'fetch', swSource.replace('__VERSION__', 'v2').replace('__FILES__', JSON.stringify(files)))(self, caches, net);
  const install = async () => {
    let done: Promise<unknown> = Promise.resolve();
    on.install({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  };
  const navigate = (url: string): Promise<Response> => {
    let answer: Promise<Response> | undefined;
    on.fetch({ request: { url, mode: 'navigate', method: 'GET' }, respondWith: (p: Promise<Response>) => (answer = p), waitUntil: () => undefined });
    return answer ?? Promise.reject(new Error('not answered'));
  };
  return { install, navigate, added };
}

describe('the service worker gets new versions past the HTTP cache', () => {
  it('installs every file fresh from the network, not from the HTTP cache', async () => {
    const sw = worker(async () => new Response('net'), ['./', './assets/index-abc.js', './engine/stockfish.js']);
    await sw.install();
    expect(sw.added.map((r) => r.url)).toEqual(['https://app.test/', 'https://app.test/assets/index-abc.js', 'https://app.test/engine/stockfish.js']);
    expect(sw.added.every((r) => r.cache === 'reload')).toBe(true);
  });

  it('asks the network for the page with revalidation, and serves the cached page offline', async () => {
    let online = true;
    const asked: (RequestInit | undefined)[] = [];
    const sw = worker(async (_req, init) => {
      asked.push(init);
      if (!online) throw new TypeError('Failed to fetch');
      return new Response('fresh page');
    }, ['./']);
    await sw.install();
    expect(await (await sw.navigate('https://app.test/#/play')).text()).toBe('fresh page');
    expect(asked).toEqual([{ cache: 'no-cache' }]);
    online = false;
    expect(await (await sw.navigate('https://app.test/#/play')).text()).toBe('cached https://app.test/');
  });
});

describe('an open app picks up a new version', () => {
  const SCRIPT = 'https://app.test/assets/index-old.js';
  let win: EventTarget & { location: { hash: string; reload: () => void } };
  let doc: EventTarget & { visibilityState: string };
  let cached: Set<string>;
  let store: Map<string, string>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.mocked(toast).mockClear();
    win = Object.assign(new EventTarget(), { location: { hash: '#/play', reload: vi.fn() } });
    doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    cached = new Set();
    store = new Map();
    vi.stubGlobal('window', win);
    vi.stubGlobal('location', win.location);
    vi.stubGlobal('document', doc);
    vi.stubGlobal('caches', { match: async (u: string) => (cached.has(u) ? new Response('') : undefined) });
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const { __resetUpdateForTests } = await import('../src/pwa/update');
    __resetUpdateForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const container = (controlled: boolean) => Object.assign(new EventTarget(), { controller: controlled ? {} : null }) as unknown as ServiceWorkerContainer;
  const reg = () => ({ update: vi.fn(() => Promise.resolve()) }) as unknown as ServiceWorkerRegistration & { update: ReturnType<typeof vi.fn> };
  const settle = () => vi.advanceTimersByTimeAsync(0);

  it('the first worker taking over a new visitor is not an update', async () => {
    const { watchForUpdates } = await import('../src/pwa/update');
    const sw = container(false);
    watchForUpdates(reg(), SCRIPT, sw);
    sw.dispatchEvent(new Event('controllerchange'));
    await settle();
    expect(toast).not.toHaveBeenCalled();
    // A later release reaches that same page.
    sw.dispatchEvent(new Event('controllerchange'));
    await settle();
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('an older page offers to reload and reloads at the next change of screen, once', async () => {
    const { watchForUpdates } = await import('../src/pwa/update');
    const sw = container(true);
    watchForUpdates(reg(), SCRIPT, sw);
    sw.dispatchEvent(new Event('controllerchange'));
    sw.dispatchEvent(new Event('controllerchange'));
    await settle();
    expect(toast).toHaveBeenCalledTimes(1);
    const notice = vi.mocked(toast).mock.calls[0][0];
    expect(notice.action?.label).toBe('Reload now');
    expect(win.location.reload).not.toHaveBeenCalled();
    win.dispatchEvent(new Event('hashchange'));
    expect(win.location.reload).toHaveBeenCalledTimes(1);
    win.dispatchEvent(new Event('hashchange'));
    expect(win.location.reload).toHaveBeenCalledTimes(1);
    notice.action?.run();
    expect(win.location.reload).toHaveBeenCalledTimes(2);
  });

  it('a page opened after the release is already current: no notice, no reload', async () => {
    const { watchForUpdates } = await import('../src/pwa/update');
    cached.add(SCRIPT);
    const sw = container(true);
    watchForUpdates(reg(), SCRIPT, sw);
    sw.dispatchEvent(new Event('controllerchange'));
    await settle();
    win.dispatchEvent(new Event('hashchange'));
    expect(toast).not.toHaveBeenCalled();
    expect(win.location.reload).not.toHaveBeenCalled();
  });

  it('Kids mode reloads at the next screen without a notice', async () => {
    const { watchForUpdates } = await import('../src/pwa/update');
    win.location.hash = '#/kids/map';
    const sw = container(true);
    watchForUpdates(reg(), SCRIPT, sw);
    sw.dispatchEvent(new Event('controllerchange'));
    await settle();
    expect(toast).not.toHaveBeenCalled();
    win.dispatchEvent(new Event('hashchange'));
    expect(win.location.reload).toHaveBeenCalledTimes(1);
  });

  it('checks for a new version when the app is shown again, at most once a minute', async () => {
    const { watchForUpdates } = await import('../src/pwa/update');
    const r = reg();
    watchForUpdates(r, SCRIPT, container(true));
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(r.update).not.toHaveBeenCalled(); // just loaded
    await vi.advanceTimersByTimeAsync(61_000);
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(r.update).not.toHaveBeenCalled();
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(r.update).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(r.update).toHaveBeenCalledTimes(2);
  });

  it('a missing file of an older version loads the new version, at most once a minute', async () => {
    const { recoverFromMissingFiles } = await import('../src/pwa/update');
    recoverFromMissingFiles();
    win.dispatchEvent(new Event('vite:preloadError'));
    win.dispatchEvent(new Event('vite:preloadError'));
    expect(win.location.reload).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(61_000);
    win.dispatchEvent(new Event('vite:preloadError'));
    expect(win.location.reload).toHaveBeenCalledTimes(2);
  });
});
