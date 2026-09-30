// The one owner of the page's audio: the shared AudioContext, the audio session, and getting sound
// started and kept going on Apple devices (iPhone, iPad, Mac Safari, the home-screen app, a WKWebView).
// There, sound only starts inside a real gesture, the ringer switch mutes Web Audio unless the page
// asks for a 'playback' audio session, and a call, Siri or a lock screen leaves the context
// 'interrupted' until something resumes it. src/chess/sound.ts and src/kids/lib/kidsSound.ts draw
// their sounds on getContext() and go through withRunningContext(); Pip's recorded voice (an <audio>
// element in kids/player/speech.ts) joins the same gesture unlock with addUnlock().

type SessionType = 'auto' | 'playback';

interface AudioSessionLike {
  type: string;
}

let session: SessionType = 'auto';

function applySession() {
  try {
    const api = (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;
    if (api && api.type !== session) api.type = session;
  } catch {
    /* no audio session here (Chromium, Firefox, Safari before 16.4, no navigator): nothing to set */
  }
}

/**
 * Sets the audio session type until the returned function puts the old one back. Kids mode asks for
 * 'playback' (Pip's voice is the point, so it plays with the ringer switch on silent); the grown-up app
 * keeps 'auto', so its move sounds never stop the person's music. Applied at once and again just before
 * the first context is made, because Safari reads it when audio starts.
 */
export function setAudioSession(type: SessionType): () => void {
  const before = session;
  session = type;
  applySession();
  return () => {
    if (session === type) {
      session = before;
      applySession();
    }
  };
}

let wanted: () => boolean = () => true;

/**
 * Whether the context should be woken by a gesture at all (Kids mode: not while the kid's sound is off
 * or muted, so quiet mode never takes the audio session). Until the returned function puts the old one back.
 */
export function setAudioWanted(fn: () => boolean): () => void {
  const before = wanted;
  wanted = fn;
  return () => {
    if (wanted === fn) wanted = before;
  };
}

// ---------- the context ----------

let ctx: AudioContext | null = null;

// Not typed 'interrupted' in every lib.dom: anything but 'running' needs a resume.
const notRunning = (a: AudioContext) => (a.state as string) !== 'running';

/** The shared context, made on first use (a closed one is replaced). It may not be running: see withRunningContext(). */
export function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (ctx && (ctx.state as string) === 'closed') {
      ctx = null;
      contextTask.done = false;
    }
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      applySession();
      const made = new AC();
      ctx = made;
      made.addEventListener?.('statechange', () => made === ctx && onState(made));
      onState(made); // made inside a gesture it may already run; otherwise the next gesture has to start it
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Asks a context that is not running to run; resolves whether it now does. Never rejects. */
function resume(a: AudioContext): Promise<boolean> {
  if (!notRunning(a)) return Promise.resolve(true);
  try {
    return Promise.resolve(a.resume()).then(
      () => !notRunning(a),
      () => false,
    );
  } catch {
    return Promise.resolve(false);
  }
}

/** A sound that has waited longer than this for the context to resume is skipped: its moment has passed. */
export const LATE_MS = 300;

/**
 * Runs `draw` on the shared context, which is drawn on only while it is running. A context that is not
 * (suspended, or 'interrupted' by a call or the lock screen) is asked to resume and the next gesture is
 * armed to do it again; a sound asked for meanwhile plays when the resume comes in time and is skipped
 * when not. Scheduling against a stopped clock would queue every sound and play them in one burst.
 */
export function withRunningContext(draw: (a: AudioContext) => void): void {
  const a = getContext();
  if (!a) return;
  if (!notRunning(a)) return draw(a);
  contextTask.done = false;
  armAudioUnlock();
  const asked = Date.now();
  void resume(a).then((ok) => {
    if (!ok || Date.now() - asked > LATE_MS) return;
    try {
      draw(a);
    } catch {
      /* a browser without some WebAudio node stays quiet */
    }
  });
}

function onState(a: AudioContext) {
  if (!notRunning(a)) {
    contextTask.done = true;
    settle();
  } else if ((a.state as string) !== 'closed') {
    contextTask.done = false;
    armAudioUnlock();
  }
}

// ---------- the gesture unlock ----------

// Only these count as a gesture on iOS (pointerdown and touchstart do not reliably), and keydown and click
// also come from a keyboard, VoiceOver and Switch Control, which send no pointer events at all.
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;

export type UnlockAttempt = () => boolean | Promise<boolean>;

interface Task {
  attempt: UnlockAttempt;
  wanted: () => boolean;
  done: boolean;
}

/** Playing a silent sample is what unlocks Web Audio on older iOS, and it is harmless elsewhere. */
function primeContext(): boolean | Promise<boolean> {
  const a = getContext();
  if (!a) return true; // no Web Audio here: nothing to unlock
  const running = resume(a);
  try {
    const s = a.createBufferSource();
    s.buffer = a.createBuffer(1, 1, 22050);
    s.connect(a.destination);
    s.start(0);
  } catch {
    /* the resume alone may do */
  }
  return running;
}

const contextTask: Task = { attempt: primeContext, wanted: () => wanted(), done: false };
const tasks = new Set<Task>([contextTask]);
let listening = false;

function run(t: Task): Promise<boolean> {
  let result: Promise<boolean>;
  try {
    result = Promise.resolve(t.attempt());
  } catch {
    result = Promise.resolve(false);
  }
  return result
    .catch(() => false)
    .then((ok) => {
      // A failed try never un-does an earlier success: two gestures in a row can overlap.
      if (ok) {
        t.done = true;
        settle();
      }
      return ok;
    });
}

function onGesture() {
  for (const t of [...tasks]) if (!t.done && t.wanted()) void run(t);
}

/** Stops listening once everything is unlocked (and only then). */
function settle() {
  if (!listening || [...tasks].some((t) => !t.done)) return;
  listening = false;
  for (const g of GESTURES) window.removeEventListener(g, onGesture, true);
}

let watching = false;

/** Back from the background (or the back/forward cache): a context that was cut off needs its next gesture. */
function recheck() {
  if (ctx && notRunning(ctx)) {
    contextTask.done = false;
    void resume(ctx); // allowed without a gesture on some systems, and harmless where it is not
  }
  armAudioUnlock();
}

/**
 * Listens for the next gesture to unlock what is not unlocked yet: creating and resuming the shared context,
 * and whatever was added with addUnlock(). Safe to call again and again (an app root, Kids mode, a context
 * that stopped); it does nothing once everything is unlocked, and starts again when something is not.
 */
export function armAudioUnlock() {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  try {
    if (!watching) {
      watching = true;
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') recheck();
        });
      }
      window.addEventListener('pageshow', recheck);
    }
    if (listening || [...tasks].every((t) => t.done)) return;
    listening = true;
    for (const g of GESTURES) window.addEventListener(g, onGesture, { capture: true, passive: true });
  } catch {
    /* an environment without events: sounds still try on their own */
  }
}

/** Tries every unlock that is still needed right now. Call it inside a gesture. */
export function unlockAudio(): Promise<boolean[]> {
  return Promise.all([...tasks].filter((t) => !t.done && t.wanted()).map(run));
}

export interface UnlockHandle {
  /** The owner learned that it is unlocked (or, after a refusal, that it is not any more). */
  setDone(done: boolean): void;
  remove(): void;
}

/**
 * Adds something that needs a gesture (Pip's voice: a silent clip on the <audio> element). `attempt` runs
 * inside every gesture until it returns true, or a promise that resolves true. The listeners stay until this
 * and everything else is unlocked.
 */
export function addUnlock(attempt: UnlockAttempt): UnlockHandle {
  const t: Task = { attempt, wanted: () => true, done: false };
  tasks.add(t);
  armAudioUnlock();
  return {
    setDone(done) {
      t.done = done;
      if (done) settle();
      else armAudioUnlock();
    },
    remove() {
      tasks.delete(t);
      settle();
    },
  };
}

// ---------- a silent clip ----------

/**
 * A valid PCM WAV of silence (mono, 8 kHz, 16 bit) as a data URI, `ms` long. The unlock plays it on an
 * <audio> element; a zero-length one can fail to decode in Safari, which is one more thing that differs
 * from the clips everyone else uses.
 */
export function silentWav(ms = 80): string {
  const rate = 8000;
  const data = Math.max(1, Math.round((rate * ms) / 1000)) * 2;
  const bytes = new Uint8Array(44 + data); // the samples stay 0
  const v = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + data, true);
  text(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, data, true);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(bin)}`;
}
