// Read-aloud for Kids mode: wraps window.speechSynthesis (feature-detected). Picks the most natural
// English voice on the device (voices.ts), unlocks on the first tap (iOS), queues lines, and reports the spoken word for
// karaoke highlighting (with a timed fallback when the engine sends no boundary events).
import { useSyncExternalStore } from 'react';
import { BAND_TUNING } from '../curriculum/tuning';
import { getKid, updateKid, type KidProfile } from '../store/kidsStore';
import { rankVoices } from './voices';
import { clipKey, spokenText } from '../lib/clipKey';

interface SpeakOpts {
  rate?: number;
  pitch?: number;
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

// ---------- Pip's recorded voice ----------
// Every fixed line has a clip recorded with a natural neural voice (scripts/voice). Lines without
// a clip (built at run time, e.g. with a kid's name) use the best device voice instead.
interface VoiceManifest {
  v: 1;
  voice: string;
  clips: Record<string, number>; // clip key -> duration (ms)
}
let manifest: VoiceManifest | null = null;
let manifestLoad: Promise<void> | null = null;
let audioEl: HTMLAudioElement | null = null;
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
const voiceUrl = (file: string) => new URL(`voice/${file}`, document.baseURI).href;

function loadManifest(): Promise<void> {
  if (manifestLoad) return manifestLoad;
  if (typeof document === 'undefined' || typeof fetch === 'undefined' || typeof Audio === 'undefined') return (manifestLoad = Promise.resolve());
  manifestLoad = fetch(voiceUrl('manifest.json'))
    .then((r) => (r.ok ? r.json() : null))
    .then((m: VoiceManifest | null) => {
      if (m?.v === 1 && m.clips) manifest = m;
    })
    .catch(() => undefined);
  return manifestLoad;
}

/** The recorded voice is used unless the grown-ups picked a device voice. */
const recordedOn = () => !voiceURI && !!manifest;

/** Fetches every clip once in the background (the service worker keeps them for offline play). */
let prefetched = false;
function prefetchClips() {
  if (prefetched || !manifest || typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) return;
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
  prefetched = true;
  const keys = Object.keys(manifest.clips);
  let i = 0;
  const step = () => {
    if (i >= keys.length || !navigator.onLine) return;
    fetch(voiceUrl(`${keys[i++]}.mp3`))
      .then((r) => r.arrayBuffer())
      .catch(() => undefined)
      .finally(() => setTimeout(step, 60));
  };
  setTimeout(step, 4000);
}

if (typeof window !== 'undefined') void loadManifest().then(prefetchClips);

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

function playClip(p: LinePlan, key: string, ms: number, rate: number, live: () => boolean, done: () => void, fallback: () => void) {
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
  el.src = voiceUrl(`${key}.mp3`);
  el.playbackRate = Math.min(1.2, Math.max(0.7, rate));
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

/** Says the lines one after another: recorded clips where there are some, the device voice otherwise. */
function run(lines: string[], opts: SpeakOpts, token: number) {
  const gen = ++runGen;
  const live = () => token === state.token && gen === runGen;
  const rate = opts.rate ?? 1;
  let offset = 0;
  const plan: LinePlan[] = lines.map((caption) => {
    const p = { spoken: spokenText(caption), capWords: words(caption).length, base: offset };
    offset += p.capWords;
    return p;
  });
  const next = (i: number) => {
    if (!live()) return;
    clearTimers();
    if (i >= plan.length) return set({ speaking: false, word: -1 });
    const p = plan[i];
    const key = recordedOn() ? clipKey(p.spoken) : '';
    const ms = key ? manifest!.clips[key] : undefined;
    if (key && ms !== undefined) playClip(p, key, ms, rate, live, () => next(i + 1), () => speakTts(p, opts, live, () => next(i + 1)));
    else speakTts(p, opts, live, () => next(i + 1));
  };
  // The clip list loads with Kids mode; give it a moment on the very first line.
  if (!manifest && manifestLoad) void Promise.race([manifestLoad, new Promise((r) => setTimeout(r, 800))]).then(() => next(0));
  else next(0);
}

export const speech = {
  supported: () => !!synth() || typeof Audio !== 'undefined',
  /** Whether Pip's recorded voice is in use (not a device voice). */
  recorded: () => recordedOn(),
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

/**
 * Speaks lines the way this kid hears them: the kid's rate (or the band's), the band's pitch, and the
 * voice mode ('off' never auto-speaks; 'first' auto-speaks a line only the first time). `force` is a
 * speaker-button tap, which always speaks. Returns the speech token when something was spoken.
 */
export function sayAs(kid: KidProfile | null | undefined, lines: string[], opts: { force?: boolean } = {}): number | undefined {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  if (!clean.length) return undefined;
  const band = kid?.band ?? 'explorer';
  const t = BAND_TUNING[band];
  const rate = kid?.settings.rate ?? t.speechRate;
  const voice = kid?.settings.voice ?? 'auto';
  if (!opts.force && kid) {
    if (voice === 'off' || getKid(kid.id)?.settings.muted) return undefined;
    if (voice === 'first') {
      const id = lineId(clean.join(' '));
      if (getKid(kid.id)?.firsts.includes(id)) return undefined;
      updateKid(kid.id, (d) => void d.firsts.push(id));
    }
  }
  return speech.speak(clean, { rate, pitch: t.pitch });
}
