// Kids sound bank: warm, soft and synthesized with WebAudio (no audio files). Marimba and bell tones for
// pops, stars and chimes, a wooden "tok" for moves, a soft whoosh, a fanfare with harmonics and a gentle
// tail. Every sound is level-matched (TRIM_DB: peaks between about -30 and -16 dBFS) and all of them pass
// through one small limiter, so nothing is ever loud for a child. lib/kidsSound.ts owns the audio context
// and the mute switch; this file only draws sounds into a context it is handed.

export type KidSound = 'move' | 'capture' | 'check' | 'pop' | 'star' | 'chomp' | 'boop' | 'whoosh' | 'sparkle' | 'fanfare' | 'chime' | 'crown' | 'tick';

/** Overall level, the kids' equivalent of a master volume (the trainer's volume setting never applies here). */
export const MASTER = 0.7;

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]; // C5 D5 E5 G5 A5 C6 D6 E6

// One master gain and a gentle limiter per audio context.
const outs = new WeakMap<BaseAudioContext, GainNode>();
function out(a: BaseAudioContext): GainNode {
  let g = outs.get(a);
  if (!g) {
    g = a.createGain();
    g.gain.value = MASTER;
    const lim = a.createDynamicsCompressor();
    lim.threshold.value = -12;
    lim.knee.value = 8;
    lim.ratio.value = 10;
    lim.attack.value = 0.003;
    lim.release.value = 0.2;
    g.connect(lim).connect(a.destination);
    outs.set(a, g);
  }
  return g;
}

// A shared noise buffer per context, from a fixed seed so every render sounds the same.
const noises = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(a: BaseAudioContext): AudioBuffer {
  let b = noises.get(a);
  if (!b) {
    b = a.createBuffer(1, Math.floor(a.sampleRate * 0.5), a.sampleRate);
    const d = b.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < d.length; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      d[i] = (s / 0x80000000 - 1) * 0.9;
    }
    noises.set(a, b);
  }
  return b;
}

// The level trim of the sound being drawn: every voice of one sound feeds it, then the master.
let bus: AudioNode | null = null;

/** A gain with a soft attack and an exponential fall to silence: never starts or ends on a click. */
function env(a: BaseAudioContext, t: number, peak: number, attack: number, decay: number, dest: AudioNode = bus ?? out(a)): GainNode {
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(dest);
  return g;
}

/** One sine (or other) partial through its own envelope. */
function tone(a: BaseAudioContext, t: number, freq: number, peak: number, decay: number, attack = 0.004, type: OscillatorType = 'sine', to?: AudioNode) {
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(env(a, t, peak, attack, decay, to));
  osc.start(t);
  osc.stop(t + attack + decay + 0.03);
}

/** A burst of filtered noise: the breath, click or rustle inside a sound. */
function hiss(a: BaseAudioContext, t: number, type: BiquadFilterType, freq: number, q: number, peak: number, decay: number, attack = 0.002, sweepTo?: number) {
  const src = a.createBufferSource();
  src.buffer = noise(a);
  const f = a.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
  src.connect(f).connect(env(a, t, peak, attack, decay));
  src.start(t, 0, attack + decay + 0.03);
}

/** A soft mallet note: a round body plus a bright fourth partial that dies almost at once. */
function marimba(a: BaseAudioContext, t: number, f: number, peak: number, ring = 0.32) {
  tone(a, t, f, peak, ring, 0.004);
  tone(a, t, f * 4, peak * 0.22, ring * 0.16, 0.003);
}

/** A music-box bell: consonant partials, a slow fall on the fundamental and a quick one on the top. */
function bell(a: BaseAudioContext, t: number, f: number, peak: number, ring = 0.7) {
  tone(a, t, f, peak, ring, 0.006);
  tone(a, t, f * 2.005, peak * 0.3, ring * 0.55, 0.005);
  tone(a, t, f * 4.1, peak * 0.09, ring * 0.22, 0.004);
}

/** A wooden "tok": a short pitch-dropping body, a second wood mode and a hint of click. */
function tok(a: BaseAudioContext, t: number, f: number, peak: number) {
  const body = a.createOscillator();
  body.frequency.setValueAtTime(f * 1.45, t);
  body.frequency.exponentialRampToValueAtTime(f, t + 0.045);
  body.connect(env(a, t, peak, 0.002, 0.1));
  body.start(t);
  body.stop(t + 0.14);
  tone(a, t, f * 2.6, peak * 0.3, 0.04, 0.001);
  hiss(a, t, 'bandpass', 1900, 1.3, peak * 0.9, 0.028, 0.001);
}

/** A warm horn-ish note: three harmonics through a low-pass, a slightly detuned twin for width. */
function horn(a: BaseAudioContext, t: number, f: number, peak: number, ring: number) {
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200;
  lp.connect(env(a, t, peak, 0.016, ring));
  const stop = t + 0.016 + ring + 0.03;
  for (const [mul, amp, cents] of [[1, 1, 0], [1, 0.6, 6], [2, 0.32, 0], [3, 0.14, 0]] as const) {
    const osc = a.createOscillator();
    osc.frequency.value = f * mul;
    osc.detune.value = cents;
    const g = a.createGain();
    g.gain.value = amp;
    osc.connect(g).connect(lp);
    osc.start(t);
    osc.stop(stop);
  }
}

const SOUNDS: Record<KidSound, (a: BaseAudioContext, t: number, step: number) => void> = {
  move(a, t) {
    tok(a, t, 250, 0.3);
  },
  capture(a, t) {
    tok(a, t, 200, 0.36);
    tok(a, t + 0.06, 165, 0.24);
    hiss(a, t + 0.03, 'highpass', 2600, 0.5, 0.05, 0.14, 0.01);
  },
  check(a, t) {
    tok(a, t, 260, 0.28);
    marimba(a, t + 0.08, 783.99, 0.2, 0.3);
    marimba(a, t + 0.17, 1174.66, 0.16, 0.34);
  },
  pop(a, t, step) {
    const f = PENTA[Math.min(Math.max(step, 0), PENTA.length - 1)];
    marimba(a, t, f, 0.3, 0.34);
    marimba(a, t + 0.055, f * 1.5, 0.2, 0.36);
  },
  star(a, t) {
    bell(a, t, 1046.5, 0.16, 0.6);
    bell(a, t + 0.075, 1568, 0.14, 0.9);
  },
  chomp(a, t) {
    for (const [dt, gain] of [[0, 1], [0.09, 0.65]] as const) {
      const body = a.createOscillator();
      body.frequency.setValueAtTime(170, t + dt);
      body.frequency.exponentialRampToValueAtTime(95, t + dt + 0.08);
      body.connect(env(a, t + dt, 0.3 * gain, 0.005, 0.1));
      body.start(t + dt);
      body.stop(t + dt + 0.14);
      hiss(a, t + dt, 'lowpass', 700, 0.7, 0.14 * gain, 0.06, 0.004);
    }
  },
  boop(a, t) {
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(env(a, t, 0.2, 0.012, 0.22));
    const osc = a.createOscillator();
    osc.frequency.setValueAtTime(330, t);
    osc.frequency.exponentialRampToValueAtTime(247, t + 0.2);
    osc.connect(lp);
    osc.start(t);
    osc.stop(t + 0.28);
  },
  whoosh(a, t) {
    hiss(a, t, 'bandpass', 450, 0.7, 0.16, 0.2, 0.07, 2200);
  },
  sparkle(a, t) {
    [1568, 2093, 2637, 3136].forEach((f, i) => bell(a, t + i * 0.055, f, 0.06, 0.32));
  },
  fanfare(a, t) {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => horn(a, t + i * 0.11, f, 0.16, 0.2));
    // The last note opens into a held chord with a bell on top and a long, soft tail. The voices start a
    // few ms apart, like a gentle strum, so their partials never pile up into one peak.
    const c = t + 0.33;
    [[261.63, 0.1], [659.25, 0.09], [783.99, 0.09], [1046.5, 0.1]].forEach(([f, g], i) => horn(a, c + i * 0.007, f, g, 1.5));
    bell(a, c + 0.03, 2093, 0.06, 1.3);
  },
  chime(a, t) {
    [783.99, 1046.5, 1318.51].forEach((f, i) => bell(a, t + i * 0.09, f, 0.15, 0.7));
  },
  crown(a, t) {
    [1046.5, 1318.51, 1568].forEach((f, i) => bell(a, t + i * 0.07, f, 0.15, 1.6));
    marimba(a, t, 261.63, 0.16, 0.9);
  },
  tick(a, t) {
    tone(a, t, 1500, 0.06, 0.035, 0.002);
  },
};

/** Level trim per sound in dB, chosen so the peaks land between -30 and -16 dBFS (the soft ones lowest, the fanfare loudest). */
export const TRIM_DB: Record<KidSound, number> = { move: -0.6, capture: -6, check: -6.7, pop: -8.1, star: -7.8, chomp: -7, boop: -1.3, whoosh: 0, sparkle: -5.3, fanfare: -15.3, chime: -9.3, crown: -9.4, tick: 4.4 };

/** Draws one kid sound into `a`. `step` climbs the pentatonic ladder for star pops. */
export function playKidSound(a: BaseAudioContext, name: KidSound, step = 0) {
  const draw = SOUNDS[name];
  if (!draw) return;
  const trim = a.createGain();
  trim.gain.value = 10 ** (TRIM_DB[name] / 20);
  trim.connect(out(a));
  bus = trim;
  try {
    draw(a, a.currentTime + 0.01, step);
  } finally {
    bus = null;
  }
}
