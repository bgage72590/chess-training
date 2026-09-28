// Read-aloud for Kids mode: wraps window.speechSynthesis (feature-detected). Picks the most natural
// English voice on the device (voices.ts), unlocks on the first tap (iOS), queues lines, and reports the spoken word for
// karaoke highlighting (with a timed fallback when the engine sends no boundary events).
import { useSyncExternalStore } from 'react';
import { BAND_TUNING } from '../curriculum/tuning';
import { getKid, updateKid, type KidProfile } from '../store/kidsStore';
import { rankVoices } from './voices';
import { clipKey, spokenText } from '../lib/clipKey';

interface SpeakOpts {
  /** Device-voice speed (the band's pace unless a grown-up set one). */
  rate?: number;
  pitch?: number;
  /** Speed for recorded clips: only a grown-up's explicit choice. Clips are recorded at a
   *  kid-friendly pace, and speeding or slowing them in the browser makes them sound robotic. */
  clipRate?: number;
  /** Called once every line has been said to the end (never for lines cut off or not spoken). */
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

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

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
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
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

/** Loads the voice list and the active voice's clip list (waits at most `ms`). */
function ready(ms: number): Promise<void> {
  if (!canFetch()) return Promise.resolve();
  const load = loadList().then(() => {
    const id = activeId();
    return id ? loadManifest(id) : undefined;
  });
  return Promise.race([load, new Promise<void>((r) => setTimeout(r, ms))]);
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

function playClip(p: LinePlan, src: string, ms: number, rate: number | undefined, live: () => boolean, done: () => void, fallback: () => void) {
  const el = (audioEl ??= new Audio());
  let settled = false;
  const fail = () => {
    if (settled || !live()) return;
    settled = true;
    fallback();
  };
  el.onended = () => {
    if (settled || !live()) return;
    settled = true;
    done();
  };
  el.onerror = fail;
  el.src = src;
  el.playbackRate = rate ? Math.min(1.2, Math.max(0.7, rate)) : 1;
  el.play()
    .then(() => {
      if (!live()) return el.pause();
      set({ speaking: true, word: p.base });
      timedWords(p, Math.max(300, ms - 160) / el.playbackRate, live);
    })
    .catch(fail);
}

function speakTts(p: LinePlan, opts: SpeakOpts, live: () => boolean, done: () => void) {
  const s = synth();
  if (!s) return done();
  const rate = opts.rate ?? 1;
  const spokenWords = Math.max(1, words(p.spoken).length);
  const u = new SpeechSynthesisUtterance(p.spoken);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? 'en-US';
  u.rate = rate;
  u.pitch = opts.pitch ?? 1;
  let gotBoundary = false;
  u.onstart = () => {
    if (!live()) return;
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
    if (!live() || e.name === 'sentence') return;
    gotBoundary = true;
    const before = words(p.spoken.slice(0, e.charIndex)).length;
    set({ word: p.base + Math.min(p.capWords - 1, Math.round((before * p.capWords) / spokenWords)) });
  };
  u.onerror = (e) => {
    if (!live()) return;
    // An online voice that cannot be reached: switch to the best on-device voice and say it again.
    if (voice && !voice.localService && e.error !== 'interrupted' && e.error !== 'canceled' && !failed.has(voice.voiceURI)) {
      failed.add(voice.voiceURI);
      pickVoice();
      return speakTts(p, opts, live, done);
    }
    done();
  };
  u.onend = () => live() && done();
  try {
    s.speak(u);
  } catch {
    done(); // a speech error never breaks a screen
  }
}

/**
 * Quiet between recorded clips, on top of the 0.16 s each clip keeps at its two ends: a person
 * pauses a moment between sentences and a little longer between lines, and clips played back to
 * back sound rushed. A grown-up's slower pace lengthens them too.
 */
export const SENTENCE_GAP_MS = 300;
export const LINE_GAP_MS = 500;

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
  const next = (i: number) => {
    if (!live()) return;
    clearTimers();
    if (i >= plan.length) {
      set({ speaking: false, word: -1 });
      return opts.onEnd?.();
    }
    const p = plan[i];
    const a = activeManifest();
    const clips = a ? clipsFor(p, a.m) : null;
    if (!a || !clips) return speakTts(p, opts, live, () => next(i + 1));
    const play = (j: number) => {
      if (j >= clips.length) return i + 1 < plan.length ? pause(LINE_GAP_MS, () => next(i + 1)) : next(i + 1);
      const c = clips[j];
      playClip(c.p, clipUrl(a.id, a.m, c.key), c.ms, opts.clipRate, live, () => (j + 1 < clips.length ? pause(SENTENCE_GAP_MS, () => play(j + 1)) : play(j + 1)), () => speakTts(j === 0 ? p : c.p, opts, live, () => (j === 0 ? next(i + 1) : play(j + 1))));
    };
    play(0);
  };
  // The clip list loads with Kids mode; give it a moment on the very first line.
  if (activeId() !== null && !activeManifest()) void ready(800).then(() => next(0));
  else if (RECORDED && !voiceList && pipVoice !== DEVICE_VOICE) void ready(800).then(() => next(0));
  else next(0);
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
  /** Picks Pip's voice: a recorded voice id, DEVICE_VOICE, or '' for the default. */
  setPipVoice(id: string | undefined) {
    if ((id ?? '') === pipVoice) return;
    pipVoice = id ?? '';
    void ready(10_000).then(prefetchClips);
  },
  /** Call from the first pointerdown (iOS): unlocks audio playback and speech inside the tap. */
  unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      audioEl ??= new Audio();
      audioEl.src = SILENCE;
      void audioEl.play().catch(() => undefined);
    } catch {
      /* ignore */
    }
    const s = synth();
    if (s) {
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        s.speak(u);
      } catch {
        /* ignore */
      }
    }
    if (pending) {
      const p = pending;
      pending = null;
      if (p.token === state.token) run(p.lines, p.opts, p.token);
    }
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
      audioEl.onended = audioEl.onerror = null;
      try {
        audioEl.pause();
      } catch {
        /* ignore */
      }
    }
    try {
      synth()?.cancel();
    } catch {
      /* ignore */
    }
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
    if (voice === 'off' || getKid(kid.id)?.settings.muted) return undefined;
    if (voice === 'first') {
      const id = lineId(clean.join(' '));
      if (getKid(kid.id)?.firsts.includes(id)) return undefined;
      onEnd = () => heardFirst(kid.id, id);
    }
  }
  return speech.speak(clean, { rate, pitch: t.pitch, clipRate: kid?.settings.rate ?? undefined, onEnd, keep: opts.keep });
}
