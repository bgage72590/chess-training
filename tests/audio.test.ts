import { afterEach, describe, expect, it, vi } from 'vitest';

// lib/audio.ts keeps module state and looks for browser globals: each test builds a fake window (a real
// EventTarget, so gestures are real dispatched events), a fake AudioContext and a fake navigator, and loads
// a fresh copy of the module.

const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];

type Resume = 'run' | 'hang' | 'until-running' | 'stay' | 'reject';

interface Env {
  win: EventTarget & Record<string, unknown>;
  doc: EventTarget & { visibilityState: string };
  contexts: FakeContext[];
  /** Everything observable in the order it happened: 'session:playback', 'ctx:new'... */
  order: string[];
  cfg: { resume: Resume; initial: string };
  /** The gesture listeners currently registered on the window (type + capture). */
  listening: () => string[];
  gesture: (type: string) => void;
}

class FakeContext extends EventTarget {
  state: string;
  resumes = 0;
  sources = 0;
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  constructor(
    private env: Env,
    initial: string,
  ) {
    super();
    this.state = initial;
  }
  setState(s: string) {
    this.state = s;
    this.dispatchEvent(new Event('statechange'));
  }
  resume() {
    this.resumes++;
    const how = this.env.cfg.resume;
    if (how === 'hang') return new Promise<void>(() => undefined);
    // A real resume() settles when the interruption ends and the state changes to running.
    if (how === 'until-running') return new Promise<void>((done) => this.addEventListener('statechange', () => this.state === 'running' && done(), { once: false }));
    if (how === 'reject') return Promise.reject(new Error('not allowed'));
    if (how === 'run') this.setState('running');
    return Promise.resolve();
  }
  createBuffer() {
    return {};
  }
  createBufferSource() {
    this.sources++;
    return { connect: () => undefined, start: () => undefined, buffer: null };
  }
}

function setup(over: { audioSession?: object | null; resume?: Resume; initial?: string } = {}): Env {
  const win = new EventTarget() as Env['win'];
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const order: string[] = [];
  const active = new Set<string>();
  const add = win.addEventListener.bind(win);
  const remove = win.removeEventListener.bind(win);
  win.addEventListener = ((type: string, fn: never, o?: boolean | { capture?: boolean }) => {
    active.add(`${type}|${typeof o === 'object' ? !!o.capture : !!o}|${String((fn as { name?: string }).name)}`);
    return add(type, fn, o);
  }) as never;
  win.removeEventListener = ((type: string, fn: never, o?: boolean | { capture?: boolean }) => {
    active.delete(`${type}|${typeof o === 'object' ? !!o.capture : !!o}|${String((fn as { name?: string }).name)}`);
    return remove(type, fn, o);
  }) as never;
  const env: Env = {
    win,
    doc,
    contexts: [],
    order,
    cfg: { resume: over.resume ?? 'run', initial: over.initial ?? 'suspended' },
    listening: () => [...active].map((k) => k.split('|')[0]).filter((t) => GESTURES.includes(t)),
    gesture: (type) => void win.dispatchEvent(new Event(type)),
  };
  win.AudioContext = class extends FakeContext {
    constructor() {
      super(env, env.cfg.initial);
      order.push('ctx:new');
      env.contexts.push(this);
    }
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  const nav: Record<string, unknown> = {};
  if (over.audioSession !== null) {
    let type = 'auto';
    nav.audioSession =
      over.audioSession ??
      Object.defineProperty({}, 'type', {
        get: () => type,
        set: (v: string) => {
          type = v;
          order.push(`session:${v}`);
        },
      });
  }
  vi.stubGlobal('navigator', nav);
  return env;
}

async function load() {
  vi.resetModules();
  return import('../src/lib/audio');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('../src/kids/player/kidSounds');
  vi.doUnmock('../src/store/profile');
  vi.useRealTimers();
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('the audio session', () => {
  it("is 'playback' before the first context exists", async () => {
    const env = setup();
    const audio = await load();
    audio.setAudioSession('playback');
    audio.getContext();
    expect(env.order).toEqual(['session:playback', 'ctx:new']);
  });

  it("is set again just before the first context when it was set before Safari could use it", async () => {
    const env = setup();
    const audio = await load();
    audio.setAudioSession('playback');
    (navigator as unknown as { audioSession: { type: string } }).audioSession.type = 'auto'; // reset behind its back
    env.order.length = 0;
    audio.getContext();
    expect(env.order).toEqual(['session:playback', 'ctx:new']);
  });

  it("leaves the default session alone in the grown-up app, and puts it back when Kids mode closes", async () => {
    const env = setup();
    const audio = await load();
    audio.getContext();
    expect(env.order).toEqual(['ctx:new']); // 'auto' is already the default: nothing written
    const leave = audio.setAudioSession('playback');
    expect((navigator as unknown as { audioSession: { type: string } }).audioSession.type).toBe('playback');
    leave();
    expect((navigator as unknown as { audioSession: { type: string } }).audioSession.type).toBe('auto');
  });

  it('never throws when there is no audio session, or setting it throws', async () => {
    setup({ audioSession: null });
    let audio = await load();
    expect(() => audio.setAudioSession('playback')).not.toThrow();
    expect(audio.getContext()).not.toBeNull();

    setup({
      audioSession: Object.defineProperty({}, 'type', {
        get: () => 'auto',
        set: () => {
          throw new Error('nope');
        },
      }),
    });
    audio = await load();
    expect(() => audio.setAudioSession('playback')).not.toThrow();
    expect(audio.getContext()).not.toBeNull();

    vi.stubGlobal('navigator', undefined);
    audio = await load();
    expect(() => audio.setAudioSession('playback')).not.toThrow();
  });

  it('is quiet without a window or without Web Audio', async () => {
    vi.stubGlobal('window', undefined);
    let audio = await load();
    expect(audio.getContext()).toBeNull();
    expect(() => audio.armAudioUnlock()).not.toThrow();
    const draw = vi.fn();
    audio.withRunningContext(draw);
    expect(draw).not.toHaveBeenCalled();
    const env = setup();
    delete env.win.AudioContext;
    audio = await load();
    expect(audio.getContext()).toBeNull();
  });
});

describe('the gesture unlock', () => {
  it('tries again on every gesture, and stops listening only once the context runs', async () => {
    const env = setup({ resume: 'stay' }); // resume() answers, but the context stays suspended
    const audio = await load();
    audio.armAudioUnlock();
    expect(env.listening().sort()).toEqual([...GESTURES].sort());
    env.gesture('pointerup');
    await flush();
    expect(env.contexts).toHaveLength(1); // made inside the gesture
    expect(env.contexts[0].resumes).toBe(1);
    expect(env.listening()).toHaveLength(4); // resume() resolved but the context is not running: not unlocked
    env.gesture('click');
    await flush();
    expect(env.contexts[0].resumes).toBe(2);
    env.cfg.resume = 'run';
    env.gesture('touchend');
    await flush();
    expect(env.contexts[0].state).toBe('running');
    expect(env.listening()).toEqual([]); // unlocked: no listeners left
    env.gesture('click');
    expect(env.contexts[0].resumes).toBe(3);
    expect(env.contexts).toHaveLength(1);
  });

  it('hears a keyboard or VoiceOver activation: keydown and a bare click', async () => {
    const env = setup();
    const audio = await load();
    audio.armAudioUnlock();
    env.gesture('keydown');
    await flush();
    expect(env.contexts[0].state).toBe('running');
    expect(env.contexts[0].sources).toBe(1); // the silent sample that unlocks older iOS
  });

  it('runs an added unlock on each gesture until it works, and waits for it before it lets go', async () => {
    const env = setup();
    const audio = await load();
    let tries = 0;
    const attempt = vi.fn(async () => ++tries >= 3);
    const handle = audio.addUnlock(attempt);
    env.gesture('pointerup');
    env.gesture('touchend');
    await flush();
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(env.contexts[0].state).toBe('running'); // the context part is done
    expect(env.listening()).toHaveLength(4); // but the added unlock is not
    env.gesture('click');
    await flush();
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(env.listening()).toEqual([]);
    env.gesture('click');
    expect(attempt).toHaveBeenCalledTimes(3);
    handle.setDone(false); // refused later: the next gesture is wanted again
    expect(env.listening()).toHaveLength(4);
    handle.remove();
    expect(env.listening()).toEqual([]);
  });

  it('does not wake the context while the caller does not want sound, and does when it does', async () => {
    const env = setup();
    const audio = await load();
    let on = false;
    const restore = audio.setAudioWanted(() => on);
    audio.armAudioUnlock();
    env.gesture('click');
    await flush();
    expect(env.contexts).toHaveLength(0);
    expect(env.listening()).toHaveLength(4); // still waiting: sound may be switched on
    on = true;
    env.gesture('click');
    await flush();
    expect(env.contexts).toHaveLength(1);
    restore();
  });

  it('gives the wish back when Kids mode closes', async () => {
    const env = setup();
    const audio = await load();
    const restore = audio.setAudioWanted(() => false);
    restore();
    audio.armAudioUnlock();
    env.gesture('click');
    await flush();
    expect(env.contexts).toHaveLength(1);
  });

  it('counts a context made inside a gesture that already runs as unlocked', async () => {
    const env = setup({ initial: 'running' });
    const audio = await load();
    audio.armAudioUnlock();
    audio.getContext();
    expect(env.listening()).toEqual([]);
  });
});

describe('a context that stops', () => {
  it("resumes an 'interrupted' context on the next sound, and plays it when the resume is quick", async () => {
    const env = setup({ initial: 'running' });
    const audio = await load();
    const draw = vi.fn();
    audio.withRunningContext(draw);
    expect(draw).toHaveBeenCalledTimes(1); // running: drawn at once
    env.contexts[0].setState('interrupted'); // a call, Siri, the lock screen
    expect(env.listening()).toHaveLength(4); // the next gesture is armed
    audio.withRunningContext(draw);
    expect(draw).toHaveBeenCalledTimes(1); // nothing scheduled while it is not running
    expect(env.contexts[0].resumes).toBe(1);
    await flush();
    expect(draw).toHaveBeenCalledTimes(2); // the resume came at once: the sound plays
  });

  it('skips a sound that waited too long for the resume, and schedules nothing while stopped, so nothing bursts', async () => {
    vi.useFakeTimers();
    const env = setup({ initial: 'running', resume: 'hang' });
    const audio = await load();
    const draw = vi.fn();
    audio.getContext();
    env.contexts[0].setState('interrupted');
    for (let i = 0; i < 5; i++) audio.withRunningContext(draw);
    await vi.advanceTimersByTimeAsync(5000);
    expect(draw).not.toHaveBeenCalled();
    expect(env.contexts[0].resumes).toBe(5);
    // A gesture brings it back; later sounds draw at once and the skipped ones never come.
    env.cfg.resume = 'run';
    env.gesture('touchend');
    await vi.advanceTimersByTimeAsync(0);
    expect(env.contexts[0].state).toBe('running');
    expect(draw).not.toHaveBeenCalled();
    audio.withRunningContext(draw);
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('drops a sound whose resume took longer than a moment', async () => {
    vi.useFakeTimers();
    const env = setup({ initial: 'suspended', resume: 'until-running' });
    const audio = await load();
    const draw = vi.fn();
    audio.withRunningContext(draw);
    await vi.advanceTimersByTimeAsync(audio.LATE_MS + 50);
    env.contexts[0].setState('running'); // the interruption ended long after the sound was wanted
    await vi.advanceTimersByTimeAsync(0);
    expect(draw).not.toHaveBeenCalled();
  });

  it('plays a sound whose resume came within a moment', async () => {
    vi.useFakeTimers();
    const env = setup({ initial: 'suspended', resume: 'until-running' });
    const audio = await load();
    const draw = vi.fn();
    audio.withRunningContext(draw);
    await vi.advanceTimersByTimeAsync(audio.LATE_MS - 100);
    expect(draw).not.toHaveBeenCalled();
    env.contexts[0].setState('running');
    await vi.advanceTimersByTimeAsync(0);
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it("makes a new context when the old one is closed, on the next sound", async () => {
    const env = setup({ initial: 'running' });
    const audio = await load();
    const first = audio.getContext()!;
    (first as unknown as FakeContext).state = 'closed';
    const draw = vi.fn();
    audio.withRunningContext(draw);
    expect(env.contexts).toHaveLength(2);
    expect(audio.getContext()).toBe(env.contexts[1]);
    expect(draw).toHaveBeenCalledWith(env.contexts[1]);
  });

  it('asks the next gesture to resume an interrupted context, and lets go when it runs again', async () => {
    const env = setup({ initial: 'running' });
    const audio = await load();
    audio.armAudioUnlock();
    env.gesture('click');
    await flush();
    expect(env.listening()).toEqual([]);
    env.cfg.resume = 'hang';
    env.contexts[0].setState('interrupted');
    expect(env.listening()).toHaveLength(4);
    env.cfg.resume = 'run';
    env.gesture('click');
    await flush();
    expect(env.contexts[0].state).toBe('running');
    expect(env.listening()).toEqual([]);
  });

  it('re-arms when the page comes back (visible, pageshow) and the context did not', async () => {
    const env = setup({ initial: 'running', resume: 'hang' });
    const audio = await load();
    audio.armAudioUnlock();
    env.gesture('click');
    await flush();
    expect(env.listening()).toEqual([]);
    env.contexts[0].state = 'interrupted'; // no statechange event was delivered while the app was away
    env.doc.visibilityState = 'hidden';
    env.doc.dispatchEvent(new Event('visibilitychange'));
    expect(env.listening()).toEqual([]);
    env.doc.visibilityState = 'visible';
    env.doc.dispatchEvent(new Event('visibilitychange'));
    expect(env.contexts[0].resumes).toBe(1); // asked on return, without waiting for a gesture
    expect(env.listening()).toHaveLength(4);
    env.cfg.resume = 'run';
    env.gesture('click');
    await flush();
    expect(env.listening()).toEqual([]);
    env.cfg.resume = 'hang';
    env.contexts[0].state = 'suspended';
    env.win.dispatchEvent(new Event('pageshow'));
    expect(env.listening()).toHaveLength(4);
  });
});

describe('sounds on the shared context', () => {
  it('the grown-up sounds and the Kids sounds use one context and draw only while it runs', async () => {
    const env = setup({ initial: 'suspended', resume: 'hang' });
    const played: string[] = [];
    vi.doMock('../src/kids/player/kidSounds', () => ({ playKidSound: (_a: unknown, name: string) => void played.push(name) }));
    vi.doMock('../src/store/profile', () => ({ getSettings: () => ({ sound: true, volume: 0.8 }) }));
    vi.resetModules();
    const kids = await import('../src/kids/lib/kidsSound');
    const chess = await import('../src/chess/sound');
    const audio = await import('../src/lib/audio');
    kids.kidSound('pop');
    chess.sound('move'); // stopped: nothing is drawn, so nothing queues
    expect(played).toEqual([]);
    expect(env.contexts).toHaveLength(1);
    env.contexts[0].state = 'running';
    kids.kidSound('star');
    expect(played).toEqual(['star']);
    expect(audio.getContext()).toBe(env.contexts[0]);
    kids.setKidSoundEnabled(false);
    kids.kidSound('chime');
    expect(played).toEqual(['star']);
  });

  it("Kids mode asks for a 'playback' session, keeps the context asleep while muted, and gives both back", async () => {
    const env = setup();
    vi.doMock('../src/kids/player/kidSounds', () => ({ playKidSound: () => undefined }));
    vi.resetModules();
    const { kidsSound } = await import('../src/kids/lib/kidsSound');
    const nav = navigator as unknown as { audioSession: { type: string } };
    kidsSound.setEnabled(false); // a muted kid
    const leave = kidsSound.enter();
    expect(nav.audioSession.type).toBe('playback');
    env.gesture('click');
    await flush();
    expect(env.contexts).toHaveLength(0); // quiet mode never takes the audio session
    kidsSound.setEnabled(true);
    env.gesture('keydown');
    await flush();
    expect(env.contexts).toHaveLength(1);
    expect(env.order.indexOf('session:playback')).toBeLessThan(env.order.indexOf('ctx:new'));
    leave();
    expect(nav.audioSession.type).toBe('auto');
  });

  it("the grown-up move sound draws on a running context, not on a stopped one", async () => {
    const env = setup({ initial: 'running' });
    vi.doMock('../src/store/profile', () => ({ getSettings: () => ({ sound: true, volume: 0.8 }) }));
    vi.resetModules();
    const chess = await import('../src/chess/sound');
    const fake = (await import('../src/lib/audio')).getContext() as unknown as Record<string, unknown>;
    const made: string[] = [];
    const param = () => ({ value: 0, setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined });
    const node = (kind: string, extra: object = {}) => ({ connect: (to: unknown) => to, start: () => undefined, stop: () => undefined, ...extra, kind, [Symbol.for('made')]: made.push(kind) });
    Object.assign(fake, {
      createGain: () => node('gain', { gain: param() }),
      createBufferSource: () => node('source'),
      createBiquadFilter: () => node('filter', { frequency: param(), Q: param() }),
      createOscillator: () => node('osc', { frequency: param() }),
      createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
    });
    chess.sound('move');
    expect(made.length).toBeGreaterThan(0);
    made.length = 0;
    env.contexts[0].state = 'interrupted';
    chess.sound('move');
    expect(made).toEqual([]);
  });
});

describe('the silent clip', () => {
  it('is a valid PCM WAV 50 to 100 ms long, not a zero-length one', async () => {
    const { silentWav } = await load();
    const uri = silentWav();
    expect(uri.startsWith('data:audio/wav;base64,')).toBe(true);
    const bytes = Uint8Array.from(atob(uri.split(',')[1]), (c) => c.charCodeAt(0));
    const v = new DataView(bytes.buffer);
    const tag = (at: number) => String.fromCharCode(...bytes.slice(at, at + 4));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(12)).toBe('fmt ');
    expect(v.getUint32(4, true)).toBe(bytes.length - 8);
    expect(v.getUint16(20, true)).toBe(1); // PCM
    const channels = v.getUint16(22, true);
    const rate = v.getUint32(24, true);
    const bits = v.getUint16(34, true);
    expect(v.getUint32(28, true)).toBe((rate * channels * bits) / 8);
    expect(tag(36)).toBe('data');
    const data = v.getUint32(40, true);
    expect(data).toBe(bytes.length - 44);
    const ms = (data / ((channels * bits) / 8) / rate) * 1000;
    expect(ms).toBeGreaterThanOrEqual(50);
    expect(ms).toBeLessThanOrEqual(100);
    expect([...bytes.slice(44)].every((b) => b === 0)).toBe(true);
  });
});
