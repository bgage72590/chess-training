import { afterEach, describe, expect, it, vi } from 'vitest';
import { clipKey, spokenText } from '../src/kids/lib/clipKey';

// Pip's voice on Apple devices, with fakes for what iOS and Safari are said to do: a clip and a speech engine
// that refuse until a gesture that counts, a clip the OS pauses, an engine that drops a speak() after a
// cancel(), a clip list that arrives late. The window is a real EventTarget, so gestures are real events.

const LINE = 'Well done!';
const OTHER = 'Your turn!';
const PREVIEW = "Hi! I'm Pip. Let's play chess together!";
const key = (t: string) => clipKey(spokenText(t));
/** What iOS is said to count as a gesture that unlocks audio (pointerdown and touchstart do not reliably). */
const COUNTED = ['touchend', 'click', 'keydown'];

class FakeUtterance {
  onstart?: () => void;
  onend?: () => void;
  onerror?: (e: { error: string }) => void;
  onboundary?: unknown;
  rate = 1;
  pitch = 1;
  lang = '';
  volume = 1;
  voice: { name: string; voiceURI: string; lang: string; localService: boolean } | null = null;
  constructor(public text: string) {}
}

interface AudioEl {
  src: string;
  playbackRate: number;
  paused: boolean;
  ended: boolean;
  duration: number;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  onpause: (() => void) | null;
  play: () => Promise<void>;
  pause: () => void;
}

interface Options {
  clips?: string[];
  /** Milliseconds a URL that ends with the key takes to answer. */
  delay?: Record<string, number>;
  engine?: boolean;
  /** play() answers a moment later, and a pause() or a new src before that aborts it, as a real element does. */
  asyncPlay?: boolean;
  voices?: FakeUtterance['voice'][];
  /** Length of every clip in the manifest (default 900). */
  ms?: number;
}

function world(o: Options = {}) {
  const win = new EventTarget() as EventTarget & Record<string, unknown>;
  const doc = Object.assign(new EventTarget(), { baseURI: 'https://app.test/', visibilityState: 'visible' });
  const w = {
    win,
    doc,
    current: null as string | null,
    elementUnlocked: false,
    plays: [] as string[],
    pauses: 0,
    el: null as AudioEl | null,
    voices: (o.voices ?? []) as NonNullable<FakeUtterance['voice']>[],
    spoken: [] as FakeUtterance[],
    cancels: 0,
    synth: { speaking: false, pending: false } as { speaking: boolean; pending: boolean },
    gesture(type: string) {
      w.current = type;
      try {
        win.dispatchEvent(new Event(type));
      } finally {
        w.current = null;
      }
    },
    mp3: () => w.plays.filter((p) => p.includes('.mp3')),
    fetched: [] as string[],
  };
  class FakeAudioEl {
    private source = '';
    private inFlight: { reject: (e: Error) => void } | null = null;
    get src() {
      return this.source;
    }
    set src(v: string) {
      this.source = v;
      this.abort();
    }
    private abort() {
      this.inFlight?.reject(Object.assign(new Error('The play() request was interrupted'), { name: 'AbortError' }));
      this.inFlight = null;
    }
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
      w.plays.push(this.src.startsWith('data:') ? 'silence' : this.src);
      if (!w.elementUnlocked && !(w.current && COUNTED.includes(w.current))) return Promise.reject(Object.assign(new Error('The request is not allowed'), { name: 'NotAllowedError' }));
      w.elementUnlocked = true;
      this.paused = false;
      if (!o.asyncPlay) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const mine = { reject };
        this.inFlight = mine;
        setTimeout(() => {
          if (this.inFlight !== mine) return;
          this.inFlight = null;
          resolve();
        }, 5);
      });
    }
    pause() {
      w.pauses++;
      this.paused = true;
      this.abort();
    }
  }
  const clips = Object.fromEntries((o.clips ?? [LINE, PREVIEW]).map((t) => [key(t), o.ms ?? 900]));
  const fetchStub = async (url: string) => {
    w.fetched.push(url);
    const done = async (body: unknown) => {
      const wait = Object.entries(o.delay ?? {}).find(([k]) => url.endsWith(k))?.[1] ?? 0;
      if (wait) await new Promise((r) => setTimeout(r, wait));
      return Response.json(body);
    };
    if (url.endsWith('voices.json')) return done({ default: 'sunny', voices: [{ id: 'sunny', name: 'Sunny', blurb: '' }, { id: 'bella', name: 'Bella', blurb: '' }] });
    return done({ v: 1, voice: 'x', version: '1', clips });
  };
  const synth =
    o.engine === false
      ? undefined
      : {
          get speaking() {
            return w.synth.speaking;
          },
          get pending() {
            return w.synth.pending;
          },
          speak: (u: FakeUtterance) => void w.spoken.push(u),
          cancel: () => void w.cancels++,
          getVoices: () => w.voices,
          addEventListener: () => undefined,
        };
  if (synth) win.speechSynthesis = synth;
  return Object.assign(w, { Audio: FakeAudioEl, fetch: fetchStub });
}
type World = ReturnType<typeof world>;

async function load(w: World) {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal('window', w.win);
  vi.stubGlobal('document', w.doc);
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('Audio', w.Audio);
  vi.stubGlobal('fetch', w.fetch);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  const store = await import('../src/kids/store/kidsStore');
  const speech = await import('../src/kids/player/speech');
  return { ...store, ...speech };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const adv = (ms: number) => vi.advanceTimersByTimeAsync(ms);

/** Recorded voices, an unlocked element, and one line said: the clip is playing. */
async function playing(w: World, onEnd = vi.fn()) {
  const m = await load(w);
  await m.speech.loadPipVoices();
  m.speech.enter();
  w.gesture('touchend');
  await adv(0);
  m.speech.speak([LINE], { onEnd });
  await adv(50);
  return { m, onEnd };
}

describe('the gesture unlock for Pip', () => {
  it('tries again on later gestures, and says the waiting line once', async () => {
    const w = world();
    const m = await load(w);
    await m.speech.loadPipVoices();
    m.speech.enter();
    const onEnd = vi.fn();
    m.speech.speak([LINE], { onEnd });
    await adv(2000);
    expect(w.plays).toEqual([]); // nothing plays before a gesture
    expect(w.spoken).toEqual([]);

    w.gesture('pointerup'); // a gesture iOS does not count: the silent clip is refused
    await adv(50);
    expect(w.plays).toEqual(['silence']);
    expect(w.mp3()).toEqual([]);
    w.gesture('touchend'); // one that counts
    await adv(50);
    expect(w.plays).toEqual(['silence', 'silence', expect.stringContaining(`${key(LINE)}.mp3`)]);

    w.gesture('click');
    w.gesture('touchend');
    await adv(50);
    expect(w.mp3()).toHaveLength(1); // the line ran once, and nothing tries the unlock again
    expect(w.plays.filter((p) => p === 'silence')).toHaveLength(2);
    expect(w.spoken.filter((u) => u.text === ' ')).toHaveLength(2); // the silent utterance, until the unlock worked

    await adv(900);
    w.el!.ended = true;
    w.el!.onended?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('is not undone by the screen change that the first tap causes', async () => {
    const w = world({ asyncPlay: true });
    const m = await load(w);
    await m.speech.loadPipVoices();
    m.speech.enter();
    const onEnd = vi.fn();
    w.gesture('click'); // the silent clip is asked to play and answers in a moment
    m.speech.leaveScreen(); // the click navigates: the old screen's cleanup cancels the speech
    m.speech.speak([LINE], { onEnd }); // and the new screen's first line is asked for
    expect(w.pauses).toBe(0); // the silent clip is not paused in the middle of its play()
    await adv(50);
    expect(w.mp3()).toHaveLength(1);
    w.el!.onended?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('is unlocked by a key press or a bare click, which send no pointer events', async () => {
    for (const type of ['keydown', 'click']) {
      const w = world();
      const m = await load(w);
      await m.speech.loadPipVoices();
      const stop = m.speech.enter();
      m.speech.speak([LINE]);
      w.gesture(type);
      await adv(50);
      expect(w.mp3(), type).toHaveLength(1);
      stop();
      vi.unstubAllGlobals();
    }
  });

  it('stops listening for gestures once Kids mode closes', async () => {
    const w = world();
    const m = await load(w);
    const stop = m.speech.enter();
    stop();
    w.gesture('click');
    await adv(50);
    expect(w.plays).toEqual([]);
  });

  it('unlocks at once when there are no recorded clips to play (the device voice is all there is)', async () => {
    vi.stubEnv('MODE', 'single');
    const w = world();
    const m = await load(w);
    m.speech.enter();
    m.speech.speak([LINE]);
    expect(w.spoken).toEqual([]);
    w.gesture('click');
    expect(w.spoken.map((u) => u.text)).toEqual([' ', LINE]);
    expect(w.plays).toEqual([]);
  });
});

describe('a line the device refused', () => {
  async function withKid(m: Awaited<ReturnType<typeof load>>) {
    const kid = m.newKid({ name: 'Maya', band: 'explorer', start: 'moves' });
    kid.settings.voice = 'first';
    m.__setKidsStateForTests({ ...m.defaultKidsState(), kids: [kid], activeKid: kid.id });
    return kid;
  }

  it("is not marked heard when the speech engine says 'not-allowed', and is said after the next unlock", async () => {
    vi.stubEnv('MODE', 'single');
    const w = world();
    const m = await load(w);
    const kid = await withKid(m);
    const heard = () => m.getKid(kid.id)!.firsts.includes(m.lineId(LINE));
    m.speech.enter();
    w.gesture('click');
    m.sayAs(kid, [LINE]);
    await adv(0);
    const first = w.spoken.at(-1)!;
    expect(first.text).toBe(LINE);
    first.onerror?.({ error: 'not-allowed' });
    first.onend?.();
    expect(heard()).toBe(false);
    expect(m.speech.state.speaking).toBe(false);

    w.gesture('click'); // the next gesture unlocks again and speaks what waited
    await adv(0);
    const second = w.spoken.at(-1)!;
    expect(second).not.toBe(first);
    expect(second.text).toBe(LINE);
    expect(heard()).toBe(false); // not yet: it has not been said
    second.onstart?.();
    second.onend?.();
    expect(heard()).toBe(true);
  });

  it('does not switch a not-allowed online voice to the on-device one, it waits for the gesture', async () => {
    vi.stubEnv('MODE', 'single');
    const google = { name: 'Google US English', voiceURI: 'g', lang: 'en-US', localService: false };
    const samantha = { name: 'Samantha', voiceURI: 's', lang: 'en-US', localService: true };
    const w = world({ voices: [samantha, google] });
    const m = await load(w);
    m.speech.enter();
    w.gesture('click');
    m.speech.speak([LINE]);
    expect(w.spoken.at(-1)!.voice?.name).toBe('Google US English');
    w.spoken.at(-1)!.onerror?.({ error: 'not-allowed' });
    expect(w.spoken.filter((u) => u.text === LINE)).toHaveLength(1);
    expect(m.speech.state.speaking).toBe(false);
  });

  it('still moves an unreachable online voice to the on-device voice', async () => {
    vi.stubEnv('MODE', 'single');
    const google = { name: 'Google US English', voiceURI: 'g', lang: 'en-US', localService: false };
    const samantha = { name: 'Samantha', voiceURI: 's', lang: 'en-US', localService: true };
    const w = world({ voices: [samantha, google] });
    const m = await load(w);
    m.speech.enter();
    w.gesture('click');
    const onEnd = vi.fn();
    m.speech.speak([LINE], { onEnd });
    w.spoken.at(-1)!.onerror?.({ error: 'network' });
    const again = w.spoken.at(-1)!;
    expect(again.voice?.name).toBe('Samantha');
    again.onstart?.();
    again.onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('is not marked heard when autoplay blocks a recorded clip, and plays after a later gesture', async () => {
    const w = world();
    const { m, onEnd } = await playing(w);
    expect(w.mp3()).toHaveLength(1);
    w.el!.onended?.();
    expect(onEnd).toHaveBeenCalledTimes(1);

    onEnd.mockClear();
    w.elementUnlocked = false; // the device took the permission back
    m.speech.speak([LINE], { onEnd });
    await adv(50);
    expect(w.mp3()).toHaveLength(2); // asked, and refused
    expect(w.spoken.filter((u) => u.text === LINE)).toEqual([]); // not handed to the device voice either
    expect(onEnd).not.toHaveBeenCalled();
    expect(m.speech.state.speaking).toBe(false);

    w.gesture('click');
    await adv(50);
    expect(w.mp3()).toHaveLength(3);
    w.el!.onended?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('keeps the lines that were not said when a later line is refused', async () => {
    const w = world({ clips: [LINE, OTHER] });
    const m = await load(w);
    await m.speech.loadPipVoices();
    m.speech.enter();
    w.gesture('touchend');
    await adv(0);
    const onEnd = vi.fn();
    m.speech.speak([LINE, OTHER], { onEnd });
    await adv(50);
    w.el!.onended?.();
    w.elementUnlocked = false;
    await adv(2000); // the pause between the lines, then the second clip is refused
    expect(w.mp3()).toHaveLength(2);
    expect(onEnd).not.toHaveBeenCalled();
    w.gesture('click');
    await adv(50);
    expect(w.mp3().at(-1)).toContain(key(OTHER)); // only the line that was not said
    expect(w.mp3()).toHaveLength(3);
  });

  it('is not heard when the device has no speech engine at all', async () => {
    const w = world({ engine: false });
    const m = await load(w);
    await m.speech.loadPipVoices();
    m.speech.enter();
    w.gesture('touchend');
    await adv(0);
    const onEnd = vi.fn();
    m.speech.speak(['A line with no recording.'], { onEnd });
    await adv(1000);
    expect(onEnd).not.toHaveBeenCalled();
    expect(m.speech.state.speaking).toBe(false);
  });

  it('is not heard when the engine fails for another reason, but the next line still comes', async () => {
    vi.stubEnv('MODE', 'single');
    const w = world();
    const m = await load(w);
    m.speech.enter();
    w.gesture('click');
    const onEnd = vi.fn();
    m.speech.speak([LINE, OTHER], { onEnd });
    w.spoken.at(-1)!.onerror?.({ error: 'synthesis-failed' });
    expect(w.spoken.at(-1)!.text).toBe(OTHER);
    w.spoken.at(-1)!.onstart?.();
    w.spoken.at(-1)!.onend?.();
    expect(onEnd).not.toHaveBeenCalled(); // one line never began
  });
});

describe('a clip that is cut off', () => {
  it('a paused clip that did not end resets speaking, and never calls onEnd', async () => {
    const w = world();
    const { m, onEnd } = await playing(w);
    expect(m.speech.state.speaking).toBe(true);
    w.el!.paused = true;
    w.el!.onpause?.(); // the OS paused it: no 'ended', no error
    await adv(300);
    expect(m.speech.state.speaking).toBe(false);
    expect(m.speech.state.word).toBe(-1);
    await adv(20_000);
    expect(onEnd).not.toHaveBeenCalled();
    expect(w.mp3()).toHaveLength(1);
  });

  it("does not take the pause just before 'ended' for an interruption", async () => {
    const w = world();
    const { m, onEnd } = await playing(w);
    const token = m.speech.state.token;
    w.el!.paused = true;
    w.el!.ended = true;
    w.el!.onpause?.(); // engines fire 'pause' and then 'ended' at the natural end
    w.el!.onended?.();
    await adv(1000);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(m.speech.state.token).toBe(token);
  });

  it("does not stop a clip that was paused and is playing again within a moment", async () => {
    const w = world();
    const { m, onEnd } = await playing(w);
    w.el!.paused = true;
    w.el!.onpause?.();
    await adv(100);
    w.el!.paused = false; // resumed by the system
    await adv(1000);
    expect(m.speech.state.speaking).toBe(true);
    w.el!.onended?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('a page that is hidden or closed stops the line', async () => {
    for (const leave of [() => 'visibilitychange', () => 'pagehide']) {
      const w = world();
      const { m, onEnd } = await playing(w);
      const pauses = w.pauses;
      if (leave() === 'visibilitychange') {
        w.doc.visibilityState = 'hidden';
        w.doc.dispatchEvent(new Event('visibilitychange'));
      } else w.win.dispatchEvent(new Event('pagehide'));
      expect(m.speech.state.speaking).toBe(false);
      expect(w.pauses).toBeGreaterThan(pauses);
      await adv(5000);
      expect(onEnd).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    }
  });

  it('a page that becomes visible again does not stop anything', async () => {
    const w = world();
    const { m } = await playing(w);
    w.doc.visibilityState = 'visible';
    w.doc.dispatchEvent(new Event('visibilitychange'));
    expect(m.speech.state.speaking).toBe(true);
  });

  it('a clip that neither ends nor fails is dropped after its length plus 2 s', async () => {
    const w = world();
    const { m, onEnd } = await playing(w);
    await adv(900 + 2000 - 100);
    expect(m.speech.state.speaking).toBe(true);
    await adv(200);
    expect(m.speech.state.speaking).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('a slowed clip gets its longer playing time before the watchdog drops it', async () => {
    const w = world({ ms: 8000 });
    const m = await load(w);
    await m.speech.loadPipVoices();
    m.speech.enter();
    w.gesture('touchend');
    await adv(0);
    const onEnd = vi.fn();
    m.speech.speak([LINE], { clipRate: 0.7, onEnd });
    await adv(50);
    expect(w.el!.playbackRate).toBe(0.7);
    await adv(8000 + 2000 + 100); // past length + 2 s, but the clip plays for 8000 / 0.7 = 11.4 s
    expect(m.speech.state.speaking).toBe(true);
    await adv(1600); // 11.4 s + 2 s not reached yet either
    expect(m.speech.state.speaking).toBe(true);
    await adv(2000);
    expect(m.speech.state.speaking).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('a clip that never loads goes to the device voice', async () => {
    const w = world();
    const m = await load(w);
    await m.speech.loadPipVoices();
    m.speech.enter();
    w.gesture('touchend');
    await adv(0);
    w.el!.play = () => new Promise<void>(() => undefined); // the request hangs
    m.speech.speak([LINE]);
    await adv(9000);
    expect(w.spoken.at(-1)!.text).toBe(LINE);
  });

  it('an engine that interrupts the utterance stops the line', async () => {
    vi.stubEnv('MODE', 'single');
    const w = world();
    const m = await load(w);
    m.speech.enter();
    w.gesture('click');
    const onEnd = vi.fn();
    m.speech.speak([LINE, OTHER], { onEnd });
    const u = w.spoken.at(-1)!;
    u.onstart?.();
    expect(m.speech.state.speaking).toBe(true);
    u.onerror?.({ error: 'interrupted' });
    expect(m.speech.state.speaking).toBe(false);
    await adv(3000);
    expect(w.spoken.map((s) => s.text)).not.toContain(OTHER);
    expect(onEnd).not.toHaveBeenCalled();
  });
});

describe('a voice whose clip list is still loading', () => {
  it('the preview waits for it, and plays the clip instead of the device voice', async () => {
    const w = world({ delay: { 'bella/manifest.json': 2000 } });
    const m = await load(w);
    await adv(3000); // the default voice loaded on its own
    m.speech.enter();
    w.gesture('touchend');
    await adv(50);
    let ready = false;
    void m.speech.setPipVoice('bella').then(() => {
      ready = true;
      m.speech.speak([PREVIEW]);
    });
    await adv(1000);
    expect(ready).toBe(false);
    expect(w.mp3()).toEqual([]);
    await adv(1100);
    expect(ready).toBe(true);
    await adv(50);
    expect(w.mp3()).toHaveLength(1);
    expect(w.mp3()[0]).toContain('bella/');
    expect(w.spoken.filter((u) => u.text === PREVIEW)).toEqual([]);
  });

  it('stops waiting after about 6 s', async () => {
    const w = world({ delay: { 'bella/manifest.json': 600_000 } });
    const m = await load(w);
    await adv(3000);
    let ready = false;
    void m.speech.setPipVoice('bella').then(() => void (ready = true));
    await adv(5900);
    expect(ready).toBe(false);
    await adv(200);
    expect(ready).toBe(true);
  });

  it('is ready at once for the voice already in use', async () => {
    const w = world();
    const m = await load(w);
    await adv(100);
    m.speech.setPipVoice('bella');
    await adv(100);
    let ready = false;
    void m.speech.setPipVoice('bella').then(() => void (ready = true));
    await adv(0);
    expect(ready).toBe(true);
  });

  it('a line that has not begun when the list arrives is said by the recording', async () => {
    const w = world({ delay: { 'sunny/manifest.json': 1200 } });
    const m = await load(w);
    m.speech.enter();
    w.gesture('touchend');
    await adv(50);
    const onEnd = vi.fn();
    m.speech.speak([LINE], { onEnd });
    await adv(900); // past the 800 ms it waits for the list: the device voice is asked
    const u = w.spoken.at(-1)!;
    expect(u.text).toBe(LINE);
    expect(w.mp3()).toEqual([]);
    const cancels = w.cancels;
    await adv(400); // the list arrives; the utterance has not started
    expect(w.cancels).toBe(cancels + 1); // the device voice is taken back
    expect(w.mp3()).toHaveLength(1);
    u.onstart?.(); // late events of the utterance that was taken back count for nothing
    u.onend?.();
    expect(onEnd).not.toHaveBeenCalled();
    w.el!.onended?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('a line that already began with the device voice is left alone', async () => {
    const w = world({ delay: { 'sunny/manifest.json': 1200 } });
    const m = await load(w);
    m.speech.enter();
    w.gesture('touchend');
    await adv(50);
    const onEnd = vi.fn();
    m.speech.speak([LINE], { onEnd });
    await adv(900);
    const u = w.spoken.at(-1)!;
    u.onstart?.();
    const cancels = w.cancels;
    await adv(400);
    expect(w.mp3()).toEqual([]);
    expect(w.cancels).toBe(cancels);
    u.onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

describe('the device voice after a cancel', () => {
  async function device() {
    vi.stubEnv('MODE', 'single');
    const w = world();
    const m = await load(w);
    m.speech.enter();
    w.gesture('click');
    return { w, m };
  }

  it('speaks at once when nothing was in flight', async () => {
    const { w, m } = await device();
    m.speech.speak([LINE]);
    m.speech.speak([OTHER]);
    expect(w.spoken.map((u) => u.text)).toEqual([' ', LINE, OTHER]);
  });

  it('waits a moment after cancelling speech in flight, and one timer serves the last request', async () => {
    const { w, m } = await device();
    m.speech.speak([LINE]);
    w.spoken.at(-1)!.onstart?.();
    w.synth.speaking = true; // the engine is still talking when the next line asks
    m.speech.speak([OTHER]);
    expect(w.cancels).toBeGreaterThan(0);
    expect(w.spoken.at(-1)!.text).toBe(LINE); // Safari drops a speak() this soon after a cancel()
    await adv(79);
    expect(w.spoken.at(-1)!.text).toBe(LINE);
    await adv(1);
    expect(w.spoken.at(-1)!.text).toBe(OTHER);

    m.speech.speak(['First of two.']);
    m.speech.speak(['Second of two.']); // the next cancel drops the first one's timer
    await adv(500);
    const said = w.spoken.map((u) => u.text);
    expect(said).not.toContain('First of two.');
    expect(said.at(-1)).toBe('Second of two.');
    expect(said.filter((t) => t === 'Second of two.')).toHaveLength(1);
  });

  it('waits after a cancel with queued speech too, and never for a screen with nothing said', async () => {
    const { w, m } = await device();
    m.speech.speak([LINE]);
    w.synth.pending = true;
    m.speech.speak([OTHER]);
    expect(w.spoken.at(-1)!.text).toBe(LINE);
    await adv(100);
    expect(w.spoken.at(-1)!.text).toBe(OTHER);
    w.synth.pending = false;
    w.synth.speaking = false;
    await adv(1000);
    m.speech.speak([LINE]);
    expect(w.spoken.at(-1)!.text).toBe(LINE);
  });

  it('counts an utterance that never starts as dropped: it is cancelled, tried once more, then given up', async () => {
    const { w, m } = await device();
    const onEnd = vi.fn();
    m.speech.speak([LINE, OTHER], { onEnd });
    const first = w.spoken.at(-1)!;
    await adv(1499);
    expect(w.spoken.filter((u) => u.text === LINE)).toHaveLength(1);
    await adv(1);
    expect(w.cancels).toBeGreaterThan(1); // the stuck one is dropped
    const retry = w.spoken.at(-1)!;
    expect(retry.text).toBe(LINE);
    expect(retry).not.toBe(first);
    first.onstart?.(); // a late event of the dropped utterance counts for nothing
    expect(m.speech.state.speaking).toBe(false);
    await adv(1500);
    expect(w.spoken.at(-1)!.text).toBe(OTHER); // given up: on to the next line
    w.spoken.at(-1)!.onstart?.();
    w.spoken.at(-1)!.onend?.();
    expect(onEnd).not.toHaveBeenCalled(); // the first line was never heard
  });

  it('leaves an utterance alone that starts within the wait', async () => {
    const { w, m } = await device();
    m.speech.speak([LINE]);
    const cancels = w.cancels;
    await adv(1000);
    w.spoken.at(-1)!.onstart?.();
    await adv(10_000);
    expect(w.cancels).toBe(cancels);
    expect(w.spoken.filter((u) => u.text === LINE)).toHaveLength(1);
  });

  it('runs the fallback when an online voice never starts', async () => {
    vi.stubEnv('MODE', 'single');
    const google = { name: 'Google US English', voiceURI: 'g', lang: 'en-US', localService: false };
    const samantha = { name: 'Samantha', voiceURI: 's', lang: 'en-US', localService: true };
    const w = world({ voices: [google, samantha] });
    const m = await load(w);
    m.speech.enter();
    w.gesture('click');
    m.speech.speak([LINE]);
    expect(w.spoken.at(-1)!.voice?.name).toBe('Google US English');
    await adv(1500);
    expect(w.spoken.at(-1)!.voice?.name).toBe('Samantha');
  });

  it('picks the voice when it speaks if none was picked yet (a list that arrived without an event)', async () => {
    vi.stubEnv('MODE', 'single');
    const w = world({ voices: [] });
    const m = await load(w);
    m.speech.enter();
    w.gesture('click');
    w.voices.push({ name: 'Samantha', voiceURI: 's', lang: 'en-US', localService: true }); // no 'voiceschanged'
    m.speech.speak([LINE]);
    expect(w.spoken.at(-1)!.voice?.name).toBe('Samantha');
    expect(w.spoken.at(-1)!.lang).toBe('en-US');
  });
});
