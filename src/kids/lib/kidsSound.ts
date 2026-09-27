// Kids sound kit: soft synthesized WebAudio sounds (no files, no harsh square waves).
// Kids code never uses src/chess/sound.ts, so the kid's mute silences every sound, moves included.

export type KidSound = 'move' | 'capture' | 'check' | 'pop' | 'chomp' | 'boop' | 'whoosh' | 'sparkle' | 'fanfare' | 'chime' | 'crown' | 'tick';

let ctx: AudioContext | null = null;
let enabled = true;
const MASTER = 0.7; // about 30% quieter than the grown-up kit

export function setKidSoundEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

let noiseBuf: AudioBuffer | null = null;
function noise(a: AudioContext, seconds = 0.3): AudioBuffer {
  if (noiseBuf?.sampleRate === a.sampleRate) return noiseBuf;
  const len = Math.floor(a.sampleRate * seconds);
  noiseBuf = a.createBuffer(1, len, a.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function env(a: AudioContext, t: number, gain: number, attack: number, decay: number): GainNode {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * MASTER), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(a.destination);
  return g;
}

function tone(a: AudioContext, t: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine', glideTo?: number) {
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  osc.connect(env(a, t, gain, 0.012, dur));
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function knock(a: AudioContext, t: number, freq: number, gain: number, decay = 0.07) {
  const src = a.createBufferSource();
  src.buffer = noise(a);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq * 3;
  bp.Q.value = 1.2;
  src.connect(bp).connect(env(a, t, gain, 0.004, decay));
  src.start(t, 0, decay + 0.02);
  tone(a, t, freq, decay, gain * 0.5, 'sine', freq * 0.6);
}

function bell(a: AudioContext, t: number, freq: number, dur: number, gain: number) {
  tone(a, t, freq, dur, gain);
  tone(a, t, freq * 2.76, dur * 0.6, gain * 0.35);
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]; // C5 D5 E5 G5 A5 C6

/** Plays a kid sound. `step` climbs the pentatonic ladder for star pops. */
export function kidSound(name: KidSound, step = 0) {
  if (!enabled) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  switch (name) {
    case 'move':
      knock(a, t, 220, 0.35);
      break;
    case 'capture':
      knock(a, t, 180, 0.4);
      knock(a, t + 0.055, 150, 0.3);
      break;
    case 'check':
      knock(a, t, 240, 0.35);
      tone(a, t, 880, 0.12, 0.02, 'triangle');
      break;
    case 'pop': {
      const f = PENTA[Math.min(step, PENTA.length - 1)];
      tone(a, t, f, 0.1, 0.07, 'triangle');
      tone(a, t + 0.06, f * 1.5, 0.14, 0.06, 'triangle');
      break;
    }
    case 'chomp': {
      const src = a.createBufferSource();
      src.buffer = noise(a);
      const lp = a.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 800;
      src.connect(lp).connect(env(a, t, 0.25, 0.005, 0.09));
      src.start(t, 0, 0.1);
      tone(a, t, 120, 0.12, 0.12, 'triangle');
      break;
    }
    case 'boop':
      tone(a, t, 300, 0.18, 0.04, 'sine', 220);
      break;
    case 'whoosh': {
      const src = a.createBufferSource();
      src.buffer = noise(a);
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(400, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
      src.connect(bp).connect(env(a, t, 0.08, 0.05, 0.2));
      src.start(t, 0, 0.27);
      break;
    }
    case 'sparkle':
      for (let i = 0; i < 3; i++) tone(a, t + i * 0.06, 1500 + Math.random() * 1500, 0.12, 0.025);
      break;
    case 'fanfare': {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        const osc = a.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const lp = a.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2000;
        osc.connect(lp).connect(env(a, t + i * 0.1, 0.07, 0.01, i === 3 ? 0.5 : 0.16));
        osc.start(t + i * 0.1);
        osc.stop(t + i * 0.1 + 0.7);
      });
      break;
    }
    case 'chime':
      for (let i = 0; i < 3; i++) bell(a, t + i * 0.09, PENTA[Math.floor(Math.random() * PENTA.length)], 0.5, 0.04);
      break;
    case 'crown':
      bell(a, t, 1046.5, 1.2, 0.05);
      bell(a, t, 1318.5, 1.2, 0.04);
      break;
    case 'tick':
      tone(a, t, 1200, 0.04, 0.02, 'sine');
      break;
  }
}

let unlocked = false;

/** Resumes the audio context from a user gesture (iOS). Once, and never while muted. */
export function unlockKidSound() {
  if (unlocked || !enabled) return;
  unlocked = true;
  const a = audio();
  if (!a) return;
  try {
    const b = a.createBuffer(1, 1, 22050);
    const s = a.createBufferSource();
    s.buffer = b;
    s.connect(a.destination);
    s.start(0);
  } catch {
    /* ignore */
  }
}

export const kidsSound = { play: kidSound, unlock: unlockKidSound, setEnabled: setKidSoundEnabled };
