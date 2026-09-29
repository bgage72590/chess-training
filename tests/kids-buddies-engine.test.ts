// Bruno and Ember when the engine is still loading at the buddy's first move: they wait for it instead of napping.
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ status: 'idle' as 'idle' | 'loading' | 'ready' | 'failed', initCalls: 0, failInit: false }));

vi.mock('../src/engine/engine', () => ({
  engine: {
    get status() {
      return state.status;
    },
    init: () => {
      state.initCalls++;
      state.status = 'loading';
      return new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          if (state.failInit) {
            state.status = 'failed';
            reject(new Error('no engine'));
          } else {
            state.status = 'ready';
            resolve();
          }
        }, 20),
      );
    },
    search: () => Promise.resolve({ best: 'e2e4', lines: [{ multipv: 1, pv: ['e2e4'], score: { cp: 30 } }] }),
    cancelAll: () => undefined,
  },
}));

import { buddyMove } from '../src/kids/activities/playBot/kidBot';
import { START_FEN } from '../src/kids/activities/playBot/logic';
import { mulberry32 } from '../src/kids/lib/rng';

describe('buddyMove while the engine loads', () => {
  it('waits for the engine and plays its move (no nap)', async () => {
    state.status = 'idle';
    for (const b of ['ember', 'bruno'] as const) {
      state.status = 'loading';
      const r = await buddyMove(b, START_FEN, mulberry32(3));
      expect(r.fellBack, b).toBe(false);
      expect(r.move?.lan, b).toBe('e2e4');
    }
  });

  it('starts an idle engine, and naps only when it truly cannot start', async () => {
    state.status = 'idle';
    state.initCalls = 0;
    const ok = await buddyMove('ember', START_FEN, mulberry32(3));
    expect(state.initCalls).toBe(1);
    expect(ok.fellBack).toBe(false);
    state.status = 'idle';
    state.failInit = true;
    const bad = await buddyMove('ember', START_FEN, mulberry32(3));
    expect(bad.fellBack).toBe(true);
    expect(bad.move).not.toBeNull();
  });

  it('never touches the engine for the first five buddies', async () => {
    state.status = 'idle';
    state.initCalls = 0;
    for (const b of ['shelly', 'hop', 'tuck', 'fern', 'olive'] as const) {
      const r = await buddyMove(b, START_FEN, mulberry32(5));
      expect(r.fellBack).toBe(false);
      expect(r.move).not.toBeNull();
    }
    expect(state.initCalls).toBe(0);
  });
});
