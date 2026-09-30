// Read-aloud for Kids mode: wraps window.speechSynthesis (feature-detected). Picks the most natural
// English voice on the device (voices.ts), unlocks on the first gesture (iOS: lib/audio.ts listens for it), queues
// lines, and reports the spoken word for karaoke highlighting (with a timed fallback when the engine sends no
// boundary events). A line the device refused or cut off is never reported as said.
import { useSyncExternalStore } from 'react';
import { BAND_TUNING } from '../curriculum/tuning';
import { getKid, updateKid, type KidProfile } from '../store/kidsStore';
import { rankVoices } from './voices';
import { isQuiet } from '../store/quiet';
import { clipKey, spokenText } from '../lib/clipKey';
import { addUnlock, silentWav, type UnlockHandle } from '../../lib/audio';

interface SpeakOpts {
  /** Device-voice speed (the band's pace unless a grown-up set one). */
  rate?: number;
  pitch?: number;
  /** Speed for recorded clips: only a grown-up's explicit choice. Clips are recorded at a
   *  kid-friendly pace, and speeding or slowing them in the browser makes them sound robotic. */
  clipRate?: number;
  /** Called once every line has been said to the end (never for lines cut off, refused by the device or not spoken). */
  onEnd?: () => void;
  /** Goes on through the next screen change: a line said on the way out of a screen. */
  keep?: boolean;
}

interface SpeechState {
  speaking: boolean;
  /** Index of the word being spoken, across all queued lines (-1 = none). */
  word: number;
  /** Token of the current speak() call (the bubble highlights only its own text). */
  token: number;
}

const synth = (): SpeechSynthesis | null => {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  } catch {
    return null;
  }
};

let state: SpeechState = { speaking: false, word: -1, token: 0 };
const listeners = new Set<() => void>();
const set = (patch: Partial<SpeechState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let unlocked = false;
let muted = false;
let voiceURI: string | undefined;
let voice: SpeechSynthesisVoice | null = null;
let pending: { lines: string[]; opts: SpeakOpts; token: number } | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];
let tokenSeq = 0;
let keepLine = false;
/** The gesture unlock (lib/audio.ts), while Kids mode is open. */
let unlockTask: UnlockHandle | null = null;
/** The silent utterance was heard to start or end: the engine takes speech now. */
let ttsPrimed = false;
/** Safari drops a speak() that follows a cancel() of speech in flight, so the next utterance waits this long. */
const CANCEL_SETTLE_MS = 80;
let settleUntil = 0;

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

/** Stops the engine's speech; a cancel that had speech in flight makes the next utterance wait a moment. */
function cancelSynth() {
  const s = synth();
  if (!s) return;
  try {
    const busy = s.speaking || s.pending;
    s.cancel();
    if (busy) settleUntil = Date.now() + CANCEL_SETTLE_MS;
  } catch {
    /* ignore */
  }
}
const settleLeft = () => Math.max(0, settleUntil - Date.now());

/** Online voices that failed here (e.g. offline): skipped from then on. */
const failed = new Set<string>();
const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

function pickVoice() {
  const s = synth();
  if (!s) return;
  const all = s.getVoices();
  const chosen = all.find((v) => v.voiceURI === voiceURI && !failed.has(v.voiceURI));
  voice = chosen ?? rankVoices(all, online(), failed)[0] ?? null;
}

if (typeof window !== 'undefined') {
  const s = synth();
  if (s) {
    try {
      s.addEventListener?.('voiceschanged', pickVoice);
      window.addEventListener('online', pickVoice);
      window.addEventListener('offline', pickVoice);
      pickVoice();
    } catch {
      /* ignore */
    }
  }
}

const words = (t: string) => t.split(/\s+/).filter(Boolean);

// ---------- Pip's recorded voices ----------
// Every fixed line is recorded in several natural voices (scripts/voice; the list is
// public/voice/voices.json, each voice's clips in public/voice/<id>/). A kid picks one in the
// grown-ups area. Lines without a clip (built at run time, e.g. with a kid's name), or the
// "device voice" choice, use the best voice of the device instead.
export interface PipVoice {
  id: string;
  name: string;
  blurb: string;
}
interface VoiceList {
  default: string;
  voices: PipVoice[];
}
interface VoiceManifest {
  v: 1;
  voice: string;
  /** How the clips were recorded; part of each clip's URL so a new recording is never mixed with cached old clips. */
  version?: string;
  clips: Record<string, number>; // clip key -> duration (ms)
}
/** The "voice" that means the device's own speech engine. */
export const DEVICE_VOICE = 'device';
/** Pip's recorded clips come with the full app only. The single-file copy (a claude.ai Artifact)
 *  has just its own page, so there Pip reads with the device's voice and nothing is fetched. */
export const RECORDED = import.meta.env.MODE !== 'single';

let voiceList: VoiceList | null = null;
let listLoad: Promise<void> | null = null;
let pipVoice = ''; // '' = the default voice
const manifests = new Map<string, VoiceManifest | null>();
const manifestLoads = new Map<string, Promise<void>>();
let audioEl: HTMLAudioElement | null = null;
/** A recorded clip is loading or playing on audioEl (the unlock's silent clip is not one, and a screen change must not pause it). */
let clipLive = false;
let silence: string | null = null;
const silenceSrc = () => (silence ??= silentWav());
const voiceUrl = (file: string) => new URL(`voice/${file}`, document.baseURI).href;
const canFetch = () => RECORDED && typeof document !== 'undefined' && typeof fetch !== 'undefined' && typeof Audio !== 'undefined';

function loadList(): Promise<void> {
  if (listLoad) return listLoad;
  if (!canFetch()) return (listLoad = Promise.resolve());
  // Anything but the list (e.g. a page a server sends for every address) means no recorded voices,
  // and is not asked for again.
  listLoad = fetch(voiceUrl('voices.json'))
    .then((r) => (r.ok && /json/i.test(r.headers.get('content-type') ?? '') ? r.json() : null))
    .then((l: VoiceList | null) => {
      if (l?.voices?.length) voiceList = l;
    })
    .catch((e) => {
      if (!(e instanceof SyntaxError)) listLoad = null; // offline: try again next time
    });
  return listLoad;
}

/** The recorded voice in use: the kid's pick, else the default; null for the device voice. */
function activeId(): string | null {
  if (pipVoice === DEVICE_VOICE || !voiceList) return null;
  return voiceList.voices.some((v) => v.id === pipVoice) ? pipVoice : voiceList.default;
}

function loadManifest(id: string): Promise<void> {
  let p = manifestLoads.get(id);
  if (!p) {
    p = fetch(voiceUrl(`${id}/manifest.json`))
      .then((r) => (r.ok ? r.json() : null))
      .then((m: VoiceManifest | null) => void manifests.set(id, m?.v === 1 && m.clips ? m : null))
      .catch(() => void manifestLoads.delete(id)); // offline: try again next time
    manifestLoads.set(id, p);
  }
  return p;
}

/** Loads the voice list and the active voice's clip list. */
function whenLoaded(): Promise<void> {
  if (!canFetch()) return Promise.resolve();
  return loadList().then(() => {
    const id = activeId();
    return id ? loadManifest(id) : undefined;
  });
}

/** Loads the voice list and the active voice's clip list (waits at most `ms`). */
function ready(ms: number): Promise<void> {
  if (!canFetch()) return Promise.resolve();
  return Promise.race([whenLoaded(), new Promise<void>((r) => setTimeout(r, ms))]);
}

const activeManifest = (): { id: string; m: VoiceManifest } | null => {
  const id = activeId();
  const m = id ? manifests.get(id) : null;
  return id && m ? { id, m } : null;
};
const clipUrl = (id: string, m: VoiceManifest, key: string) => voiceUrl(`${id}/${key}.mp3${m.version ? `?v=${encodeURIComponent(m.version)}` : ''}`);

/** Fetches every clip of the active voice once in the background (the service worker keeps them for offline play). */
const prefetched = new Set<string>();
function prefetchClips() {
  const a = activeManifest();
  if (!a || prefetched.has(a.id) || typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) return;
  // About 30 MB a voice: not on metered or cellular connections (clips still load as they are used).
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; type?: string } }).connection;
  if (conn?.saveData || conn?.type === 'cellular') return;
  prefetched.add(a.id);
  const keys = Object.keys(a.m.clips);
  let i = 0;
  const step = () => {
    if (i >= keys.length) return;
    if (!navigator.onLine || activeId() !== a.id) return void prefetched.delete(a.id); // interrupted: resume later
    fetch(clipUrl(a.id, a.m, keys[i++]))
      .then((r) => r.arrayBuffer())
      .catch(() => undefined)
      .finally(() => setTimeout(step, 60));
  };
  setTimeout(step, 4000);
}

if (typeof window !== 'undefined' && RECORDED) {
  const warm = () => void ready(10_000).then(prefetchClips);
  warm();
  window.addEventListener('online', warm); // a list that failed to load, or a prefetch cut off, picks up again
}

let runGen = 0;

function flushPending() {
  if (!pending) return;
  const p = pending;
  pending = null;
  if (p.token === state.token) run(p.lines, p.opts, p.token);
}

function markUnlocked() {
  unlocked = true;
  unlockTask?.setDone(true);
  flushPending();
}

/** The device refused: the next gesture has to unlock again (and speak what was waiting). */
function lock() {
  unlocked = false;
  ttsPrimed = false;
  unlockTask?.setDone(false);
}

/** A silent utterance inside the gesture: the first sound iOS lets the engine make. Repeated on later gestures until it is heard to start. */
function primeTts() {
  const s = synth();
  if (!s || ttsPrimed) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    u.onstart = u.onend = () => void (ttsPrimed = true);
    s.speak(u);
  } catch {
    /* ignore */
  }
}

/**
 * Runs inside a gesture: primes the device voice and plays a silent clip on the <audio> element that plays
 * Pip's clips (an element that has played once inside a gesture may play later without one). Unlocked
 * only when that play() resolves, so a gesture the device does not count is tried again on the next.
 */
function attemptUnlock(): boolean | Promise<boolean> {
  if (unlocked) return true;
  primeTts();
  if (!canFetch()) {
    markUnlocked(); // no recorded clips here: the engine is all there is
    return true;
  }
  try {
    audioEl ??= new Audio();
    const src = silenceSrc();
    clipLive = false;
    if (audioEl.src !== src) audioEl.src = src;
    return Promise.resolve(audioEl.play()).then(
      () => {
        markUnlocked();
        return true;
      },
      () => false,
    );
  } catch {
    return false;
  }
}

interface LinePlan {
  spoken: string;
  capWords: number;
  base: number;
}

/** Highlights caption words evenly over `ms` (used when the engine reports no word positions). */
function timedWords(p: LinePlan, ms: number, live: () => boolean) {
  const per = ms / Math.max(1, p.capWords);
  for (let i = 1; i < p.capWords; i++) timers.push(setTimeout(() => live() && set({ word: p.base + i }), i * per));
}

/** A clip still loading after this long counts as failed (the line goes to the device voice). */
const CLIP_LOAD_MS = 8000;
/** Slack on top of a clip's length before a clip that neither ended nor failed counts as cut off. */
const CLIP_SLACK_MS = 2000;
/** A paused clip that has not ended by then was interrupted (some engines pause a moment before 'ended'). */
const PAUSE_GRACE_MS = 250;

function playClip(p: LinePlan, src: string, ms: number, rate: number | undefined, live: () => boolean, done: () => void, fallback: () => void, refused: () => void) {
  const el = (audioEl ??= new Audio());
  let settled = false;
  let dog: ReturnType<typeof setTimeout> | undefined;
  let pauseDog: ReturnType<typeof setTimeout> | undefined;
  const guard = (fn: () => void, wait: number) => {
    clearTimeout(dog);
    dog = setTimeout(fn, wait);
    timers.push(dog);
  };
  const finish = () => {
    settled = true;
    clearTimeout(dog);
    clearTimeout(pauseDog);
    el.onended = el.onerror = el.onpause = null;
  };
  const fail = () => {
    if (settled || !live()) return;
    finish();
    fallback();
  };
  // A call, Siri, the lock screen or another app took the audio: no 'ended' and no error ever comes. The
  // child is gone, so stop, and the line does not count as said.
  const cutOff = () => {
    if (settled || !live()) return;
    finish();
    speech.cancel();
  };
  el.onended = () => {
    if (settled || !live()) return;
    finish();
    clipLive = false;
    done();
  };
  el.onerror = fail;
  el.onpause = () => {
    if (settled || el.ended) return;
    clearTimeout(pauseDog);
    pauseDog = setTimeout(() => el.paused && !el.ended && cutOff(), PAUSE_GRACE_MS);
  };
  el.src = src;
  el.playbackRate = rate ? Math.min(1.2, Math.max(0.7, rate)) : 1;
  clipLive = true;
  guard(fail, CLIP_LOAD_MS);
  Promise.resolve(el.play())
    .then(() => {
      if (!live() || settled) return el.pause();
      const len = Number.isFinite(el.duration) && el.duration > 0 ? Math.max(ms, el.duration * 1000) : ms;
      guard(cutOff, len / el.playbackRate + CLIP_SLACK_MS);
      set({ speaking: true, word: p.base });
      timedWords(p, Math.max(300, ms - 160) / el.playbackRate, live);
    })
    .catch((e: unknown) => {
      // Autoplay refused: not a broken clip. The line waits for the next gesture instead of going to the device voice.
      if ((e as { name?: string } | null)?.name === 'NotAllowedError') {
        if (settled || !live()) return;
        finish();
        clipLive = false;
        return refused();
      }
      fail();
    });
}

/** How long an utterance may take to start before it counts as dropped (Safari drops some that follow a cancel). */
const TTS_START_MS = 1500;

interface Tts {
  /** An utterance of the line was heard to start. */
  started(): boolean;
  /** Takes the line back before it began; false once it has begun or is over. */
  abort(): boolean;
}

/** Says a line with the device voice. `done(spoken)` says whether the line was heard; a refusal calls `refused()` instead. */
function speakTts(p: LinePlan, opts: SpeakOpts, live: () => boolean, done: (spoken: boolean) => void, refused: () => void): Tts {
  const s = synth();
  const rate = opts.rate ?? 1;
  const spokenWords = Math.max(1, words(p.spoken).length);
  let started = false;
  let over = false; // ended, given up, refused or taken back
  let retried = false;
  let queued = false; // an utterance is with the engine
  let gen = 0; // the try whose events count
  let dog: ReturnType<typeof setTimeout> | undefined;
  const end = (spoken: boolean) => {
    if (over) return;
    over = true;
    clearTimeout(dog);
    done(spoken);
  };
  const tts: Tts = {
    started: () => started,
    abort() {
      if (started || over) return false;
      over = true;
      clearTimeout(dog);
      if (queued) cancelSynth();
      return true;
    },
  };
  if (!s) {
    end(false); // no speech engine: nothing was said
    return tts;
  }
  const attempt = () => {
    const my = ++gen;
    const current = () => !over && my === gen && live();
    const go = () => {
      if (!current()) return;
      if (!voice) pickVoice(); // the list may have arrived without an event
      const u = new SpeechSynthesisUtterance(p.spoken);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'en-US';
      u.rate = rate;
      u.pitch = opts.pitch ?? 1;
      let gotBoundary = false;
      u.onstart = () => {
        if (!current()) return;
        started = true;
        clearTimeout(dog);
        set({ speaking: true, word: p.base });
        // Graceful fallback: no word events within 700 ms -> timed highlighting.
        timers.push(
          setTimeout(() => {
            if (gotBoundary || !live()) return;
            const perWord = 1000 / (2.4 * rate);
            for (let i = 1; i < p.capWords; i++) timers.push(setTimeout(() => live() && set({ word: p.base + i }), i * perWord - 700 > 0 ? i * perWord - 700 : 0));
          }, 700),
        );
      };
      u.onboundary = (e) => {
        if (!current() || e.name === 'sentence') return;
        gotBoundary = true;
        const before = words(p.spoken.slice(0, e.charIndex)).length;
        set({ word: p.base + Math.min(p.capWords - 1, Math.round((before * p.capWords) / spokenWords)) });
      };
      u.onerror = (e) => problem(my, e.error);
      u.onend = () => {
        if (!current()) return;
        queued = false;
        end(started);
      };
      dog = setTimeout(() => problem(my, 'no-start'), TTS_START_MS);
      timers.push(dog);
      queued = true;
      try {
        s.speak(u);
      } catch {
        queued = false;
        end(false); // a speech error never breaks a screen
      }
    };
    const wait = settleLeft();
    if (wait > 0) timers.push(setTimeout(go, wait));
    else go();
  };
  const problem = (my: number, error: string) => {
    if (over || my !== gen || !live()) return;
    queued = false;
    clearTimeout(dog);
    if (error === 'not-allowed') {
      over = true;
      return refused();
    }
    // The engine cut the line short (a call, Siri, another app's audio): the child is not listening.
    if (error === 'interrupted' || error === 'canceled') {
      over = true;
      return speech.cancel();
    }
    if (error === 'no-start') {
      gen++; // whatever the stuck utterance still reports is not ours any more
      cancelSynth();
    }
    // An online voice that cannot be reached: switch to the best on-device voice and say it again.
    if (voice && !voice.localService && !failed.has(voice.voiceURI)) {
      failed.add(voice.voiceURI);
      pickVoice();
      return attempt();
    }
    // A dropped start gets one more try (Safari right after a cancel, or a voice that is slow to load the first time).
    if (error === 'no-start' && !retried) {
      retried = true;
      return attempt();
    }
    end(false);
  };
  attempt();
  return tts;
}

/**
 * Quiet between recorded clips, on top of the 0.16 s each clip keeps at its two ends: a person
 * pauses a moment between sentences and a little longer between lines, and clips played back to
 * back sound rushed. Chosen by ear from scripts/voice/audition.py (0.8 s between lines, sentences a
 * little closer). A grown-up's slower pace lengthens them too.
 */
export const SENTENCE_GAP_MS = 450;
export const LINE_GAP_MS = 800;

/** Says the lines one after another: recorded clips where there are some, the device voice otherwise. */
function run(lines: string[], opts: SpeakOpts, token: number) {
  const gen = ++runGen;
  const live = () => token === state.token && gen === runGen;
  const pause = (ms: number, fn: () => void) => timers.push(setTimeout(() => live() && fn(), ms / Math.min(1.2, Math.max(0.7, opts.clipRate ?? 1))));
  let offset = 0;
  const plan: LinePlan[] = lines.map((caption) => {
    const p = { spoken: spokenText(caption), capWords: words(caption).length, base: offset };
    offset += p.capWords;
    return p;
  });
  // A line is played from its recording; failing that, sentence by sentence when every sentence
  // has one (lines put together at run time); failing that, by the device voice.
  const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean);
  const clipsFor = (p: LinePlan, m: VoiceManifest): { p: LinePlan; key: string; ms: number }[] | null => {
    const whole = clipKey(p.spoken);
    if (m.clips[whole] !== undefined) return [{ p, key: whole, ms: m.clips[whole] }];
    const parts = sentences(p.spoken);
    if (parts.length < 2 || parts.some((x) => m.clips[clipKey(x)] === undefined)) return null;
    // Share the caption's words among the sentences for the highlight.
    const total = parts.reduce((n, x) => n + words(x).length, 0);
    let base = p.base;
    return parts.map((x, j) => {
      const capWords = j === parts.length - 1 ? p.base + p.capWords - base : Math.round((words(x).length / total) * p.capWords);
      const sub = { spoken: x, capWords: Math.max(1, capWords), base };
      base += capWords;
      return { p: sub, key: clipKey(x), ms: m.clips[clipKey(x)] };
    });
  };
  // Every line was heard to start (a clip playing, an utterance begun); only then is it all said.
  let heard = true;
  const said = (spoken: boolean, then: () => void) => {
    if (!spoken) heard = false;
    then();
  };
  /** The device wants a gesture first (autoplay blocked, speech not allowed): the lines not said yet wait for the next unlock. */
  const refuse = (i: number) => {
    if (!live()) return;
    clearTimers();
    runGen++;
    pending = { lines: lines.slice(i), opts, token };
    lock();
    set({ speaking: false, word: -1 });
  };
  let at = -1; // the line the chain is on
  const next = (i: number) => {
    if (!live()) return;
    clearTimers();
    at = i;
    if (i >= plan.length) {
      set({ speaking: false, word: -1 });
      if (heard) opts.onEnd?.();
      return;
    }
    const p = plan[i];
    const a = activeManifest();
    const clips = a ? clipsFor(p, a.m) : null;
    if (!a || !clips) {
      const line = speakTts(p, opts, live, (spoken) => said(spoken, () => next(i + 1)), () => refuse(i));
      // The clip list was late: a line that has not begun by the time it arrives is said by the recording after all.
      if (!a && late) void late.then(() => switchToClip(i, line));
      return;
    }
    const play = (j: number) => {
      if (j >= clips.length) return i + 1 < plan.length ? pause(LINE_GAP_MS, () => next(i + 1)) : next(i + 1);
      const c = clips[j];
      playClip(
        c.p,
        clipUrl(a.id, a.m, c.key),
        c.ms,
        opts.clipRate,
        live,
        () => (j + 1 < clips.length ? pause(SENTENCE_GAP_MS, () => play(j + 1)) : play(j + 1)),
        () => speakTts(j === 0 ? p : c.p, opts, live, (spoken) => said(spoken, () => (j === 0 ? next(i + 1) : play(j + 1))), () => refuse(i)),
        () => refuse(i),
      );
    };
    play(0);
  };
  const switchToClip = (i: number, line: Tts) => {
    const a = activeManifest();
    if (live() && at === i && a && clipsFor(plan[i], a.m) && line.abort()) next(i);
  };
  // The clip list loads with Kids mode; give it a moment on the very first line.
  let late: Promise<void> | null = null;
  if ((activeId() !== null && !activeManifest()) || (RECORDED && !voiceList && pipVoice !== DEVICE_VOICE)) {
    late = whenLoaded();
    void ready(800).then(() => next(0));
  } else next(0);
}

export const speech = {
  supported: () => !!synth() || typeof Audio !== 'undefined',
  /** Whether one of Pip's recorded voices is in use (not the device voice). */
  recorded: () => !!activeManifest(),
  /** Pip's recorded voices (empty until the list has loaded). */
  pipVoices: (): PipVoice[] => voiceList?.voices ?? [],
  /** The voice used when a kid has not picked one. */
  defaultPipVoice: () => voiceList?.default ?? (RECORDED ? '' : DEVICE_VOICE),
  /** Loads the list of Pip's voices. */
  loadPipVoices: () => loadList(),
  /** Picks Pip's voice: a recorded voice id, DEVICE_VOICE, or '' for the default. Resolves once its clip list has loaded (at most 6 s), so a preview can wait for it. */
  setPipVoice(id: string | undefined): Promise<void> {
    if ((id ?? '') === pipVoice) return ready(6000);
    pipVoice = id ?? '';
    void ready(10_000).then(prefetchClips);
    return ready(6000);
  },
  /** Tries the unlock now; call it inside a gesture. enter() does it on every gesture by itself. */
  unlock() {
    void attemptUnlock();
  },
  /** Kids mode opens: the first gesture of any kind (a tap, a key press, VoiceOver's activation) unlocks Pip's voice. Returns the stop function. */
  enter(): () => void {
    const task = addUnlock(attemptUnlock);
    unlockTask = task;
    if (unlocked) task.setDone(true);
    return () => {
      task.remove();
      if (unlockTask === task) unlockTask = null;
    };
  },
  /** Cancels any speech and queues the lines. Returns a token identifying this call. */
  speak(lines: string[], opts: SpeakOpts = {}): number {
    const token = ++tokenSeq;
    speech.cancel(false);
    keepLine = !!opts.keep;
    set({ token, word: -1, speaking: false });
    const clean = lines.map((l) => l.trim()).filter(Boolean);
    if (!clean.length || muted || !speech.supported()) return token;
    if (!unlocked) {
      pending = { lines: clean, opts, token };
      return token;
    }
    run(clean, opts, token);
    return token;
  },
  cancel(bump = true) {
    keepLine = false;
    clearTimers();
    pending = null;
    runGen++;
    if (audioEl) {
      audioEl.onended = audioEl.onerror = audioEl.onpause = null;
      // Only a recorded clip is paused: the first tap often changes the screen, and pausing the silent clip that
      // unlocks the element in the middle of its play() would abort it and leave the voice locked.
      if (clipLive) {
        clipLive = false;
        try {
          audioEl.pause();
        } catch {
          /* ignore */
        }
      }
    }
    cancelSynth();
    if (bump) set({ speaking: false, word: -1, token: ++tokenSeq });
  },
  /** A screen change: stops the old screen's speech, except a line it said on the way out (`keep`). */
  leaveScreen() {
    if (keepLine) keepLine = false;
    else speech.cancel();
  },
  /** Muted while the parent gate is open (the gate is never spoken). */
  setMuted(on: boolean) {
    muted = on;
    if (on) speech.cancel();
  },
  setVoice(uri: string | undefined) {
    voiceURI = uri;
    pickVoice();
  },
  /** English voices for the grown-ups' picker, most natural first (novelty voices left out). */
  voices(): SpeechSynthesisVoice[] {
    try {
      return rankVoices(synth()?.getVoices() ?? []);
    } catch {
      return [];
    }
  },
  /** The voice in use (the automatic choice, or the grown-ups' pick). */
  current(): SpeechSynthesisVoice | null {
    if (!voice) pickVoice();
    return voice;
  },
  get state() {
    return state;
  },
};

// The child left (the app went to the background, the page was hidden or closed): stop rather than go on
// talking to nobody. A clip the OS pauses sends no 'ended', so nothing else would ever end the line.
if (typeof window !== 'undefined') {
  try {
    const leave = () => speech.cancel();
    if (typeof document !== 'undefined') {
      document.addEventListener?.('visibilitychange', () => {
        if (document.visibilityState === 'hidden') leave();
      });
    }
    window.addEventListener?.('pagehide', leave);
  } catch {
    /* ignore */
  }
}

export function useSpeech(): SpeechState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** A stable id for a line (voice 'first': auto-speak a line only the first time). */
export function lineId(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Remembers that a kid heard a 'first' line (pass it as onEnd, so a line cut off is said again next time). */
export function heardFirst(kidId: string, id: string) {
  updateKid(kidId, (d) => void (d.firsts.includes(id) || d.firsts.push(id)));
}

/**
 * Speaks lines the way this kid hears them: the kid's rate (or the band's), the band's pitch, and the
 * voice mode ('off' never auto-speaks; 'first' auto-speaks a line until it has been heard once). `force`
 * is a speaker-button tap, which always speaks. Returns the speech token when something was spoken.
 */
export function sayAs(kid: KidProfile | null | undefined, lines: string[], opts: { force?: boolean; keep?: boolean } = {}): number | undefined {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  if (!clean.length) return undefined;
  const band = kid?.band ?? 'explorer';
  const t = BAND_TUNING[band];
  const rate = kid?.settings.rate ?? t.speechRate;
  const voice = kid?.settings.voice ?? 'auto';
  let onEnd: (() => void) | undefined;
  if (!opts.force && kid) {
    if (voice === 'off' || isQuiet(kid.id)) return undefined;
    if (voice === 'first') {
      const id = lineId(clean.join(' '));
      if (getKid(kid.id)?.firsts.includes(id)) return undefined;
      onEnd = () => heardFirst(kid.id, id);
    }
  }
  return speech.speak(clean, { rate, pitch: t.pitch, clipRate: kid?.settings.rate ?? undefined, onEnd, keep: opts.keep });
}
