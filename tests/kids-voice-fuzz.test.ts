import { afterEach, describe, expect, it, vi } from 'vitest';
import { clipKey, spokenText } from '../src/kids/lib/clipKey';

// Random sequences of what a phone does to Pip's voice (lines asked for, a screen change, taps, a clip that
// ends or is paused by the OS, an engine that starts, ends, refuses or fails, the page hidden), against the
// properties that must hold whatever the order. The generator is seeded, so a failure names its seed.

const LINES = ['Well done!', 'Your turn!', 'Try this piece!', 'No recording of this one.'];
const RECORDED = LINES.slice(0, 3);
const key = (t: string) => clipKey(spokenText(t));
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];
/** What iOS is said to count as a gesture that unlocks audio. */
const COUNTED = ['touchend', 'click', 'keydown'];

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

class FakeUtterance {
  onstart?: () => void;
  onend?: () => void;
  onerror?: (e: { error: string }) => void;
  onboundary?: unknown;
  rate = 1;
  pitch = 1;
  lang = '';
  volume = 1;
  voice = null;
  constructor(public text: string) {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Pip speaking under random interruptions', () => {
  for (let seed = 1; seed <= 40; seed++) {
    it(`keeps its promises (seed ${seed})`, async () => {
      const rand = rng(seed);
      const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
      const win = new EventTarget() as EventTarget & Record<string, unknown>;
      const doc = Object.assign(new EventTarget(), { baseURI: 'https://app.test/', visibilityState: 'visible' });
      const w = { current: null as string | null, unlocked: false, mp3: 0, device: 0, spoken: [] as FakeUtterance[], el: null as FakeEl | null, engineBusy: false };
      class FakeEl {
        src = '';
        playbackRate = 1;
        paused = true;
        ended = false;
        duration = Number.NaN;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        onpause: (() => void) | null = null;
        constructor() {
          w.el = this;
        }
        play() {
          if (!w.unlocked && !(w.current && COUNTED.includes(w.current))) return Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
          w.unlocked = true;
          this.paused = false;
          this.ended = false;
          if (!this.src.startsWith('data:')) w.mp3++;
          return Promise.resolve();
        }
        pause() {
          this.paused = true;
        }
      }
      win.speechSynthesis = {
        get speaking() {
          return w.engineBusy;
        },
        get pending() {
          return false;
        },
        speak: (u: FakeUtterance) => {
          if (u.text !== ' ') w.device++;
          w.spoken.push(u);
        },
        cancel: () => undefined,
        getVoices: () => [],
        addEventListener: () => undefined,
      };
      const clips = Object.fromEntries(RECORDED.map((t) => [key(t), 900]));
      vi.useFakeTimers();
      vi.resetModules();
      vi.stubGlobal('window', win);
      vi.stubGlobal('document', doc);
      vi.stubGlobal('navigator', { onLine: true });
      vi.stubGlobal('Audio', FakeEl);
      vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
      vi.stubGlobal('fetch', async (url: string) => Response.json(url.endsWith('voices.json') ? { default: 'sunny', voices: [{ id: 'sunny', name: 'Sunny', blurb: '' }] } : { v: 1, voice: 'x', version: '1', clips }));
      const { speech } = await import('../src/kids/player/speech');
      await speech.loadPipVoices();
      const stop = speech.enter();

      // Each speak() call: how often its onEnd ran, and whether it was still the current call when it did.
      const calls: { ends: number; current: boolean; endedStale: number }[] = [];
      let quiet = { mp3: 0, device: 0, on: false }; // between a cancel and the next speak nothing new may start
      const activeCall = () => calls.at(-1);

      for (let step = 0; step < 90; step++) {
        // Mostly the happy path (so lines really do end), with the odd interruption.
        const op = pick(['speak', 'gesture', 'gesture', 'gesture', 'gesture', 'time', 'time', 'time', 'time', 'endClip', 'endClip', 'endClip', 'endClip', 'utter', 'utter', 'utter', 'utter', 'cancel', 'leave', 'pauseClip', 'hide', 'pagehide', 'show', 'busy']);
        if (op === 'speak') {
          const call = { ends: 0, current: true, endedStale: 0 };
          calls.forEach((c) => (c.current = false));
          calls.push(call);
          const n = pick([1, 1, 1, 2, 3]);
          speech.speak(Array.from({ length: n }, () => pick(LINES)), {
            onEnd: () => {
              call.ends++;
              if (!call.current) call.endedStale++;
            },
          });
          quiet.on = false;
        } else if (op === 'cancel' || op === 'leave' || op === 'hide' || op === 'pagehide') {
          if (op === 'cancel') speech.cancel();
          else if (op === 'leave') speech.leaveScreen();
          else if (op === 'hide') {
            doc.visibilityState = 'hidden';
            doc.dispatchEvent(new Event('visibilitychange'));
          } else win.dispatchEvent(new Event('pagehide'));
          // hide, pagehide and cancel stop the current call for good; leaveScreen too unless it was said with keep.
          activeCall() && (activeCall()!.current = false);
          quiet = { mp3: w.mp3, device: w.device, on: true };
        } else if (op === 'show') {
          doc.visibilityState = 'visible';
          doc.dispatchEvent(new Event('visibilitychange'));
        } else if (op === 'gesture') {
          const type = pick(GESTURES);
          w.current = type;
          try {
            win.dispatchEvent(new Event(type));
          } finally {
            w.current = null;
          }
        } else if (op === 'time') await vi.advanceTimersByTimeAsync(pick([0, 30, 100, 900, 2500, 9000]));
        else if (op === 'endClip') {
          const el = w.el;
          if (el && !el.paused && !el.src.startsWith('data:')) {
            el.ended = true;
            el.onpause?.();
            el.onended?.();
          }
        } else if (op === 'pauseClip') {
          const el = w.el;
          if (el && !el.paused && !el.src.startsWith('data:')) {
            el.paused = true;
            el.onpause?.();
          }
        } else if (op === 'utter') {
          const u = pick(w.spoken.slice(-3));
          if (u) {
            const what = pick(['start', 'start', 'start', 'end', 'end', 'end', 'end', 'not-allowed', 'interrupted', 'synthesis-failed']);
            if (what === 'start') u.onstart?.();
            else if (what === 'end') u.onend?.();
            else u.onerror?.({ error: what });
          }
        } else w.engineBusy = !w.engineBusy;
        await vi.advanceTimersByTimeAsync(0);

        // A call that ended does so once, and never after it stopped being the current call.
        calls.forEach((c, i) => {
          expect(c.ends, `call ${i} after step ${step} ${op}`).toBeLessThanOrEqual(1);
        });
        calls.forEach((c, i) => expect(c.endedStale, `call ${i} ended after it was replaced or cancelled (step ${step} ${op})`).toBe(0));
        // Nothing new is said between a cancel and the next line asked for.
        if (quiet.on) {
          expect(w.mp3, `a clip started after a cancel (step ${step} ${op})`).toBe(quiet.mp3);
          expect(w.device, `an utterance started after a cancel (step ${step} ${op})`).toBe(quiet.device);
        }
      }

      // Run everything out: nothing stale ends late either.
      await vi.advanceTimersByTimeAsync(30_000);
      calls.forEach((c, i) => expect(c.endedStale, `call ${i} ended late`).toBe(0));
      speech.cancel();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(speech.state.speaking).toBe(false);
      expect(speech.state.word).toBe(-1);
      stop();
    });
  }
});
