// The engine's `prepare` hook (it loads the Kids part before every sync): a sync waits for it, but not
// for one that never finishes (a chunk on a stalled connection), and not for one that fails.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryBackend } from '../src/sync/backend';
import { PREPARE_WAIT_MS, SyncEngine, type SyncPart } from '../src/sync/engine';

afterEach(() => vi.useRealTimers());

function engine(prepare: () => Promise<void>) {
  const backend = memoryBackend();
  let value = { n: 1 };
  const part: SyncPart<{ n: number }> = { key: 'p', read: () => value, write: (v) => void (value = v), merge: (a, b) => (a.n >= b.n ? a : b) };
  let saved: { code: string; lastSyncedAt?: number } | null = null;
  return { backend, e: new SyncEngine(backend, [part as SyncPart], { load: () => saved, save: (s) => void (saved = s) }, () => true, prepare) };
}

describe('the prepare hook of a sync', () => {
  it('finishes before the sync reads anything', async () => {
    const order: string[] = [];
    const { e, backend } = engine(async () => void order.push('prepared'));
    const get = backend.get;
    backend.get = async (c) => (order.push('get'), get(c));
    await e.link('CODE');
    expect(order.slice(0, 2)).toEqual(['prepared', 'get']);
    expect(e.snapshot.caughtUp).toBe(true);
  });

  it('does not stop a sync when it fails', async () => {
    const { e, backend } = engine(() => Promise.reject(new Error('offline')));
    await e.link('CODE');
    expect(e.snapshot.status).toBe('synced');
    expect((await backend.get('CODE'))?.version).toBe(1);
  });

  it('does not hold a sync up for longer than PREPARE_WAIT_MS when it never finishes', async () => {
    vi.useFakeTimers();
    const { e, backend } = engine(() => new Promise<void>(() => undefined));
    const linking = e.link('CODE');
    await vi.advanceTimersByTimeAsync(PREPARE_WAIT_MS - 100);
    expect(await backend.get('CODE')).toBeNull(); // still waiting
    expect(e.snapshot.status).toBe('syncing');
    await vi.advanceTimersByTimeAsync(200);
    await linking;
    expect(e.snapshot.status).toBe('synced');
    expect((await backend.get('CODE'))?.version).toBe(1);
  });
});
