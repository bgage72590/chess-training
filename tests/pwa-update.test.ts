import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import swSource from '../src/pwa/sw.template.js?raw';
import { toast } from '../src/lib/toast';

vi.mock('../src/lib/toast', () => ({ toast: vi.fn() }));

/** Runs the service worker template with a fake Cache Storage and network; `files` is its file list. */
function worker(net: (req: Request | string) => Promise<Response>, files: string[]) {
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
    const request = Object.defineProperty(new Request(url), 'mode', { value: 'navigate' });
    on.fetch({ request, respondWith: (p: Promise<Response>) => (answer = p), waitUntil: () => undefined });
    return answer ?? Promise.reject(new Error('not answered'));
  };
  return { install, navigate, added };
}

describe('the service worker gets new versions past the HTTP cache', () => {
  it('installs every file checked with the server, not straight from the HTTP cache', async () => {
    const sw = worker(async () => new Response('net'), ['./', './assets/index-abc.js', './engine/stockfish.js']);
    await sw.install();
    expect(sw.added.map((r) => r.url)).toEqual(['https://app.test/', 'https://app.test/assets/index-abc.js', 'https://app.test/engine/stockfish.js']);
    expect(sw.added.every((r) => r.cache === 'no-cache')).toBe(true);
  });

  it('asks the network for the page with revalidation, and serves the cached page offline', async () => {
    let online = true;
    const asked: string[] = [];
    const sw = worker(async (req) => {
      asked.push((req as Request).cache);
      if (!online) throw new TypeError('Failed to fetch');
      return new Response('fresh page');
    }, ['./']);
    await sw.install();
    expect(await (await sw.navigate('https://app.test/#/play')).text()).toBe('fresh page');
    expect(asked).toEqual(['no-cache']);
    online = false;
    expect(await (await sw.navigate('https://app.test/#/play')).text()).toBe('cached https://app.test/');
  });
});

describe('an open app picks up a new version', () => {
  const OLD = 'https://app.test/assets/index-old.js';
  const NEW = 'https://app.test/assets/index-new.js';
  let win: EventTarget & { location: { hash: string; href: string; origin: string; reload: () => void } };
  let doc: EventTarget & { visibilityState: string; querySelectorAll: () => unknown[] };
  let caches: Map<string, Set<string>>;
  let store: Map<string, string>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.mocked(toast).mockClear();
    win = Object.assign(new EventTarget(), { location: { hash: '#/play', href: 'https://app.test/#/play', origin: 'https://app.test', reload: vi.fn() } });
    doc = Object.assign(new EventTarget(), { visibilityState: 'visible', querySelectorAll: () => [] });
    caches = new Map();
    store = new Map();
    vi.stubGlobal('window', win);
    vi.stubGlobal('location', win.location);
    vi.stubGlobal('document', doc);
    vi.stubGlobal('caches', { match: async (u: string) => ([...caches.values()].some((c) => c.has(u)) ? new Response('') : undefined) });
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const { __resetUpdateForTests } = await import('../src/pwa/update');
    __resetUpdateForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** A service worker container; `release()` plays a new worker taking over the way browsers do it. */
  function browser(controlled: boolean) {
    const sw = Object.assign(new EventTarget(), { controller: (controlled ? { state: 'activated' } : null) as unknown });
    /** `to` names the new version's cache; `files` are its files (by default the script `to`). */
    const release = async (from: string | null, to: string, files = [to]) => {
      // The page gets its new controller while the worker is still activating, before its activate
      // step removes the other versions' caches.
      const worker = Object.assign(new EventTarget(), { state: 'activating' });
      caches.set(to, new Set(files));
      sw.controller = worker;
      sw.dispatchEvent(new Event('controllerchange'));
      await vi.advanceTimersByTimeAsync(0);
      if (from) caches.delete(from);
      worker.state = 'activated';
      worker.dispatchEvent(new Event('statechange'));
      await vi.advanceTimersByTimeAsync(0);
    };
    return { sw: sw as unknown as ServiceWorkerContainer, release };
  }
  const reg = () => ({ update: vi.fn(() => Promise.resolve()) }) as unknown as ServiceWorkerRegistration & { update: ReturnType<typeof vi.fn> };

  it('an older page offers to reload once the new version is active, and reloads at the next screen', async () => {
    const { watchForUpdates } = await import('../src/pwa/update');
    const { navigate } = await import('../src/router');
    caches.set(OLD, new Set([OLD]));
    const { sw, release } = browser(true);
    watchForUpdates(reg(), OLD, sw);
    await release(OLD, NEW);
    expect(toast).toHaveBeenCalledTimes(1);
    const notice = vi.mocked(toast).mock.calls[0];
    // On the Play screen the button says it ends the game (games in progress are not saved).
    expect(notice[0]).toMatchObject({ title: 'A new version of Tempo is ready', body: 'It opens when you leave this game.', closable: true, action: { label: 'Reload now (ends the game)' } });
    expect(win.location.reload).not.toHaveBeenCalled(); // not in the middle of a game
    navigate('puzzles'); // the app's own navigation (pushState), no hashchange
    expect(win.location.reload).toHaveBeenCalledTimes(1);
    navigate('learn');
    expect(win.location.reload).toHaveBeenCalledTimes(1);
    notice[0].action?.run();
    expect(win.location.reload).toHaveBeenCalledTimes(2);
    // A second release before the reload does not stack notices.
    await release(NEW, 'https://app.test/assets/index-newer.js');
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("a page whose style sheet changed is older too; other sites' files do not count", async () => {
    const { watchForUpdates } = await import('../src/pwa/update');
    const { navigate } = await import('../src/router');
    const [css1, css2] = ['https://app.test/assets/index-1.css', 'https://app.test/assets/index-2.css'];
    const fonts = { href: 'https://fonts.googleapis.com/css2?family=Newsreader' }; // never cached by the app
    doc.querySelectorAll = () => [{ src: NEW }, { href: css1 }, fonts];
    win.location.hash = '#/puzzles';
    // Only the styles changed: the page has the same script as the new version, but not its style sheet.
    caches.set('v1', new Set([NEW, css1]));
    const first = browser(true);
    watchForUpdates(reg(), NEW, first.sw);
    await first.release('v1', 'v2', [NEW, css2]);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast).mock.calls[0][0]).toMatchObject({ body: 'It opens when you go to another screen.', action: { label: 'Reload now' } });
    navigate('learn');
    expect(win.location.reload).toHaveBeenCalledTimes(1);
  });

  it('a release that changes nothing on this page (and the fonts from another site) raises no notice', async () => {
    const { watchForUpdates } = await import('../src/pwa/update');
    const css = 'https://app.test/assets/index-1.css';
    doc.querySelectorAll = () => [{ src: NEW }, { href: css }, { href: 'https://fonts.googleapis.com/css2?family=Newsreader' }];
    caches.set('v1', new Set([NEW, css]));
    const { sw, release } = browser(true);
    watchForUpdates(reg(), NEW, sw);
    await release('v1', 'v2', [NEW, css, 'https://app.test/engine/stockfish.js']);
    expect(toast).not.toHaveBeenCalled();
  });

  it('a page opened after the release is already current: no notice, no reload', async () => {
    const { watchForUpdates } = await import('../src/pwa/update');
    const { navigate } = await import('../src/router');
    caches.set(OLD, new Set([OLD]));
    const { sw, release } = browser(true);
    watchForUpdates(reg(), NEW, sw); // this page runs the new version's script
    await release(OLD, NEW);
    navigate('puzzles');
    expect(toast).not.toHaveBeenCalled();
    expect(win.location.reload).not.toHaveBeenCalled();
  });

  it('the first worker taking over a new visitor is not an update', async () => {
    const { watchForUpdates } = await import('../src/pwa/update');
    const { navigate } = await import('../src/router');
    const { sw, release } = browser(false);
    watchForUpdates(reg(), NEW, sw);
    await release(null, NEW);
    navigate('puzzles');
    expect(toast).not.toHaveBeenCalled();
    expect(win.location.reload).not.toHaveBeenCalled();
  });

  it('Kids mode reloads at the next screen without a notice', async () => {
    const { watchForUpdates } = await import('../src/pwa/update');
    const { navigate } = await import('../src/router');
    win.location.hash = '#/kids/map';
    caches.set(OLD, new Set([OLD]));
    const { sw, release } = browser(true);
    watchForUpdates(reg(), OLD, sw);
    await release(OLD, NEW);
    expect(toast).not.toHaveBeenCalled();
    navigate('kids/world/w1');
    expect(win.location.reload).toHaveBeenCalledTimes(1);
  });

  it('checks for a new version when the app is shown again, at most once a minute', async () => {
    const { watchForUpdates } = await import('../src/pwa/update');
    const r = reg();
    watchForUpdates(r, OLD, browser(true).sw);
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
    // Offline without the offline copy, a reload would only show the browser's error page.
    await vi.advanceTimersByTimeAsync(61_000);
    vi.stubGlobal('navigator', { onLine: false });
    win.dispatchEvent(new Event('vite:preloadError'));
    expect(win.location.reload).toHaveBeenCalledTimes(2);
  });
});
