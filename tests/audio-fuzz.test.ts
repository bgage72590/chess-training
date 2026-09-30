import { afterEach, describe, expect, it, vi } from 'vitest';

// Random sequences of what a phone does to the page's audio (taps, keys, calls, the lock screen, the page going
// away and coming back, contexts that close), against the properties that must hold after every step. The
// generator is seeded, so a failure names the seed and replays exactly.

const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];
const STATES = ['running', 'suspended', 'interrupted', 'closed'];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class FakeContext extends EventTarget {
  resumeAnswers: () => 'run' | 'hang' | 'until-running' | 'reject' = () => 'run';
  sampleRate = 44100;
  currentTime = 0;
  destination = {};
  constructor(public state: string) {
    super();
  }
  setState(s: string) {
    this.state = s;
    this.dispatchEvent(new Event('statechange'));
  }
  resume() {
    const how = this.resumeAnswers();
    if (how === 'hang') return new Promise<void>(() => undefined);
    if (how === 'reject') return Promise.reject(new Error('no'));
    if (how === 'until-running') return new Promise<void>((done) => this.addEventListener('statechange', () => this.state === 'running' && done()));
    if (this.state !== 'closed') this.setState('running');
    return Promise.resolve();
  }
  createBuffer() {
    return {};
  }
  createBufferSource() {
    return { connect: () => undefined, start: () => undefined, buffer: null };
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('audio under random interruptions', () => {
  for (let seed = 1; seed <= 40; seed++) {
    it(`keeps its promises (seed ${seed})`, async () => {
      const rand = rng(seed);
      const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
      vi.useFakeTimers();
      const win = new EventTarget() as EventTarget & Record<string, unknown>;
      const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
      const listening = new Map<string, number>();
      const add = win.addEventListener.bind(win);
      const remove = win.removeEventListener.bind(win);
      win.addEventListener = ((t: string, fn: never, o?: boolean | { capture?: boolean }) => {
        if (GESTURES.includes(t)) listening.set(t, (listening.get(t) ?? 0) + 1);
        return add(t, fn, o);
      }) as never;
      win.removeEventListener = ((t: string, fn: never, o?: boolean | { capture?: boolean }) => {
        // EventTarget ignores removing what is not there, and so must this count.
        if (GESTURES.includes(t)) listening.set(t, Math.max(0, (listening.get(t) ?? 0) - 1));
        return remove(t, fn, o);
      }) as never;
      const contexts: FakeContext[] = [];
      let answers: FakeContext['resumeAnswers'] = () => 'run';
      win.AudioContext = class extends FakeContext {
        constructor() {
          super(pick(['running', 'suspended']));
          this.resumeAnswers = () => answers();
          contexts.push(this);
        }
      };
      vi.stubGlobal('window', win);
      vi.stubGlobal('document', doc);
      vi.stubGlobal('navigator', {});
      vi.resetModules();
      const audio = await import('../src/lib/audio');
      let wantSound = true;
      let kids: (() => void)[] | null = null;
      audio.armAudioUnlock();

      let drawsWhileStopped = 0;
      const draw = (a: AudioContext) => {
        if ((a.state as string) !== 'running') drawsWhileStopped++;
      };
      const last = () => contexts.at(-1);

      for (let step = 0; step < 60; step++) {
        const op = pick(['gesture', 'gesture', 'sound', 'sound', 'state', 'state', 'hide', 'show', 'pageshow', 'answers', 'kids', 'time']);
        if (op === 'gesture') win.dispatchEvent(new Event(pick(GESTURES)));
        else if (op === 'sound') audio.withRunningContext(draw);
        else if (op === 'state') last()?.setState(pick(STATES));
        else if (op === 'hide') {
          doc.visibilityState = 'hidden';
          doc.dispatchEvent(new Event('visibilitychange'));
        } else if (op === 'show') {
          doc.visibilityState = 'visible';
          doc.dispatchEvent(new Event('visibilitychange'));
        } else if (op === 'pageshow') win.dispatchEvent(new Event('pageshow'));
        else if (op === 'answers') {
          const how = pick(['run', 'hang', 'until-running', 'reject'] as const);
          answers = () => how;
        } else if (op === 'kids') {
          if (kids) {
            kids.forEach((f) => f());
            kids = null;
          } else {
            wantSound = rand() < 0.7;
            kids = [audio.setAudioSession('playback'), audio.setAudioWanted(() => wantSound)];
            audio.armAudioUnlock();
          }
        } else await vi.advanceTimersByTimeAsync(pick([0, 50, 400, 2000]));
        await vi.advanceTimersByTimeAsync(0);

        // Nothing is ever scheduled on a context that is not running.
        expect(drawsWhileStopped, `step ${step} ${op}`).toBe(0);
        // A context that stopped (and can still be woken) always has a gesture listener waiting for it.
        const c = last();
        if (c && c.state !== 'running' && c.state !== 'closed' && (kids === null || wantSound)) {
          const armed = GESTURES.every((g) => (listening.get(g) ?? 0) > 0);
          expect(armed, `step ${step} ${op}: ${c.state} context and no listeners`).toBe(true);
        }
        // A context that runs needs nothing more from a gesture: nobody is still listening.
        if (c && c.state === 'running') {
          const still = GESTURES.filter((g) => (listening.get(g) ?? 0) > 0);
          expect(still, `step ${step} ${op}: running context and listeners left`).toEqual([]);
        }
      }

      // The first gesture that can be heard brings a stopped context back, whatever came before.
      answers = () => 'run';
      if (kids) kids.forEach((f) => f());
      audio.getContext();
      const c = last();
      if (c && c.state === 'closed') audio.getContext();
      win.dispatchEvent(new Event('click'));
      await vi.advanceTimersByTimeAsync(0);
      expect(last()!.state).toBe('running');
      // Only one context is alive at a time: a new one is made only when the last was closed.
      contexts.slice(0, -1).forEach((old) => expect(old.state, `old context of seed ${seed}`).toBe('closed'));
    });
  }
});
