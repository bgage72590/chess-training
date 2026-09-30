import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { persistAfterProgress, rememberedPersistence, requestPersistence, storageStatus } from '../src/lib/storage';
import { askWorker, offlineState, workerBlocked } from '../src/pwa/offline';

// navigator.storage and localStorage are stubbed: none of this needs a browser.
function fakeLocalStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

function stubStorage(s: Partial<StorageManager> | undefined) {
  vi.stubGlobal('navigator', { storage: s });
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeLocalStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('asking the browser to keep the data', () => {
  it('asks once, remembers the answer, and does not ask again when it already holds', async () => {
    const persist = vi.fn(async () => true);
    const persisted = vi.fn(async () => false);
    stubStorage({ persist, persisted });
    expect(await requestPersistence()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(rememberedPersistence()).toMatchObject({ granted: true });

    persisted.mockResolvedValue(true);
    expect(await requestPersistence()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1); // already protected: not asked
  });

  it('does not nag after a refusal, but tries again the next day', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T10:00:00Z'), toFake: ['Date'] });
    const persist = vi.fn(async () => false);
    stubStorage({ persist, persisted: async () => false });
    expect(await requestPersistence()).toBe(false);
    expect(await requestPersistence()).toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(rememberedPersistence()).toMatchObject({ granted: false });

    vi.setSystemTime(new Date('2026-01-02T11:00:00Z'));
    persist.mockResolvedValue(true);
    expect(await requestPersistence()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it('shares one question between callers at the same moment', async () => {
    const persist = vi.fn(async () => true);
    stubStorage({ persist, persisted: async () => false });
    await Promise.all([requestPersistence(), requestPersistence(), requestPersistence()]);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('never throws: no storage manager, no persist, or a browser that rejects', async () => {
    stubStorage(undefined);
    expect(await requestPersistence()).toBe(false);
    stubStorage({});
    expect(await requestPersistence()).toBe(false);
    stubStorage({
      persist: async () => {
        throw new Error('blocked');
      },
      persisted: async () => false,
    });
    expect(await requestPersistence()).toBe(false);
    stubStorage({ persist: async () => true, persisted: async () => false });
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('no storage');
      },
      setItem: () => {
        throw new Error('no storage');
      },
    });
    expect(await requestPersistence()).toBe(true); // an unreadable note changes nothing
  });
});

describe('the storage status', () => {
  it('reports protection and use', async () => {
    stubStorage({ persisted: async () => true, estimate: async () => ({ usage: 47e6, quota: 2e9 }) });
    expect(await storageStatus()).toEqual({ supported: true, persisted: true, usage: 47e6, quota: 2e9 });
  });

  it('says what it cannot tell', async () => {
    stubStorage(undefined);
    expect(await storageStatus()).toEqual({ supported: false, persisted: null, usage: null, quota: null });
    stubStorage({
      persisted: async () => {
        throw new Error('x');
      },
    });
    expect(await storageStatus()).toEqual({ supported: true, persisted: null, usage: null, quota: null });
  });
});

describe('asking after the first real progress', () => {
  it('waits until there is progress, asks once, then stops watching', async () => {
    const persist = vi.fn(async () => true);
    stubStorage({ persist, persisted: async () => false });
    let progress = false;
    const listeners = new Set<() => void>();
    const subscribe = (l: () => void) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    };
    persistAfterProgress(subscribe, () => progress);
    listeners.forEach((l) => l());
    expect(persist).not.toHaveBeenCalled(); // a settings change is not progress
    progress = true;
    listeners.forEach((l) => l());
    await Promise.resolve();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });

  it('asks straight away when the progress is already there, and can be stopped before it happens', async () => {
    const persist = vi.fn(async () => true);
    stubStorage({ persist, persisted: async () => false });
    persistAfterProgress(() => () => undefined, () => true);
    await Promise.resolve();
    expect(persist).toHaveBeenCalledTimes(1);

    const listeners = new Set<() => void>();
    const stop = persistAfterProgress(
      (l) => (listeners.add(l), () => void listeners.delete(l)),
      () => false,
    );
    stop();
    expect(listeners.size).toBe(0);
  });
});

describe('is the app saved for offline use', () => {
  it('is ready only with a worker in control that holds every file', () => {
    expect(offlineState(true, { version: 'a', files: 39, missing: 0 })).toBe('ready');
    expect(offlineState(true, { version: 'a', files: 39, missing: 2 })).toBe('reload');
    expect(offlineState(false, { version: 'a', files: 39, missing: 0 })).toBe('reload'); // first visit: reload once
    expect(offlineState(true, null)).toBe('reload');
    expect(workerBlocked(false, false)).toBe(true); // nothing registered: reloading will not help
    expect(workerBlocked(false, true)).toBe(false); // registered, taking control on the next load
    expect(workerBlocked(true, false)).toBe(false);
    expect(offlineState(true, { version: 'a', files: 0, missing: 0 })).toBe('reload');
  });

  it('asks the worker over a message channel, and gives up on silence', async () => {
    const answers = { type: 'status', version: 'v9', files: 5, missing: 1 };
    const controller = { postMessage: (_m: unknown, ports: MessagePort[]) => ports[0].postMessage(answers) } as unknown as ServiceWorker;
    expect(await askWorker({ controller })).toEqual({ version: 'v9', files: 5, missing: 1 });
    expect(await askWorker({ controller: null })).toBeNull();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const silent = { postMessage: () => undefined } as unknown as ServiceWorker;
    const waiting = askWorker({ controller: silent }, 4000);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await waiting).toBeNull();
    vi.useRealTimers();
    const broken = {
      postMessage: () => {
        throw new Error('gone');
      },
    } as unknown as ServiceWorker;
    expect(await askWorker({ controller: broken })).toBeNull();
    const nonsense = { postMessage: (_m: unknown, ports: MessagePort[]) => ports[0].postMessage({ hello: 1 }) } as unknown as ServiceWorker;
    expect(await askWorker({ controller: nonsense })).toBeNull();
  });
});
