// Read-aloud for Kids mode: wraps window.speechSynthesis (feature-detected). Prefers on-device
// English voices, unlocks on the first tap (iOS), queues lines, and reports the spoken word for
// karaoke highlighting (with a timed fallback when the engine sends no boundary events).
import { useSyncExternalStore } from 'react';
import { pronounce } from '../lib/pronounce';
import { BAND_TUNING } from '../curriculum/tuning';
import { getKid, updateKid, type KidProfile } from '../store/kidsStore';

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

function pickVoice() {
  const s = synth();
  if (!s) return;
  const all = s.getVoices();
  const en = all.filter((v) => /^en\b|^en[-_]/i.test(v.lang));
  voice =
    all.find((v) => v.voiceURI === voiceURI) ??
    en.find((v) => v.localService && /^en[-_]US/i.test(v.lang)) ??
    en.find((v) => v.localService && /^en[-_]GB/i.test(v.lang)) ??
    en.find((v) => v.localService) ??
    en[0] ??
    null;
}

if (typeof window !== 'undefined') {
  const s = synth();
  if (s) {
    try {
      s.addEventListener?.('voiceschanged', pickVoice);
      pickVoice();
    } catch {
      /* ignore */
    }
  }
}

const words = (t: string) => t.split(/\s+/).filter(Boolean);

function run(lines: string[], opts: SpeakOpts, token: number) {
  const s = synth();
  if (!s) return;
  const rate = opts.rate ?? 1;
  let offset = 0;
  lines.forEach((caption, li) => {
    const spoken = pronounce(caption);
    const capWords = words(caption).length;
    const spokenWords = Math.max(1, words(spoken).length);
    const base = offset;
    offset += capWords;
    const u = new SpeechSynthesisUtterance(spoken);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-US';
    u.rate = rate;
    u.pitch = opts.pitch ?? 1;
    let gotBoundary = false;
    u.onstart = () => {
      if (token !== state.token) return;
      set({ speaking: true, word: base });
      // Graceful fallback: no word events within 700 ms -> timed highlighting.
      timers.push(
        setTimeout(() => {
          if (gotBoundary || token !== state.token) return;
          const perWord = 1000 / (2.4 * rate);
          for (let i = 1; i < capWords; i++) timers.push(setTimeout(() => token === state.token && set({ word: base + i }), i * perWord - 700 > 0 ? i * perWord - 700 : 0));
        }, 700),
      );
    };
    u.onboundary = (e) => {
      if (token !== state.token || e.name === 'sentence') return;
      gotBoundary = true;
      const before = words(spoken.slice(0, e.charIndex)).length;
      set({ word: base + Math.min(capWords - 1, Math.round((before * capWords) / spokenWords)) });
    };
    u.onend = u.onerror = () => {
      if (token !== state.token) return;
      if (li === lines.length - 1) {
        clearTimers();
        set({ speaking: false, word: -1 });
      }
    };
    try {
      s.speak(u);
    } catch {
      /* a speech error never breaks a screen */
    }
  });
}

export const speech = {
  supported: () => !!synth(),
  /** Call from the first pointerdown (iOS): speaks an empty utterance at volume 0. */
  unlock() {
    if (unlocked) return;
    unlocked = true;
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
    if (!clean.length || muted || !synth()) return token;
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
  voices(): SpeechSynthesisVoice[] {
    try {
      return (synth()?.getVoices() ?? []).filter((v) => /^en/i.test(v.lang));
    } catch {
      return [];
    }
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
    if (voice === 'off') return undefined;
    if (voice === 'first') {
      const id = lineId(clean.join(' '));
      if (getKid(kid.id)?.firsts.includes(id)) return undefined;
      updateKid(kid.id, (d) => void d.firsts.push(id));
    }
  }
  return speech.speak(clean, { rate, pitch: t.pitch });
}
