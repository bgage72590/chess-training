// Tiny synthesized sound kit (no audio files): wooden "tock" for moves, softer chimes for results.
import { getSettings } from '../store/profile';

type SoundName = 'move' | 'capture' | 'check' | 'castle' | 'mate' | 'good' | 'bad' | 'complete' | 'tick';

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function knock(a: AudioContext, t: number, freq: number, gain: number, decay = 0.07) {
  // Filtered noise burst + short sine body: reads as a piece set down on a wooden board.
  const len = Math.floor(a.sampleRate * 0.05);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const noise = a.createBufferSource();
  noise.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq * 3;
  bp.Q.value = 1.2;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  noise.connect(bp).connect(g).connect(a.destination);
  noise.start(t);

  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + decay);
  const og = a.createGain();
  og.gain.setValueAtTime(gain * 0.5, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.connect(og).connect(a.destination);
  osc.start(t);
  osc.stop(t + decay + 0.02);
}

function tone(a: AudioContext, t: number, freq: number, dur: number, gain = 0.08, type: OscillatorType = 'sine') {
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function sound(name: SoundName) {
  if (!getSettings().sound) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.005;
  switch (name) {
    case 'move':
      knock(a, t, 220, 0.5);
      break;
    case 'capture':
      knock(a, t, 180, 0.6);
      knock(a, t + 0.055, 150, 0.45);
      break;
    case 'castle':
      knock(a, t, 220, 0.45);
      knock(a, t + 0.09, 200, 0.4);
      break;
    case 'check':
      knock(a, t, 260, 0.55);
      tone(a, t, 880, 0.12, 0.03, 'triangle');
      break;
    case 'mate':
      knock(a, t, 200, 0.6);
      tone(a, t + 0.05, 523, 0.25, 0.05);
      tone(a, t + 0.14, 784, 0.35, 0.05);
      break;
    case 'good':
      tone(a, t, 660, 0.14, 0.06);
      tone(a, t + 0.08, 990, 0.22, 0.06);
      break;
    case 'bad':
      tone(a, t, 196, 0.22, 0.07, 'triangle');
      break;
    case 'complete':
      tone(a, t, 523, 0.18, 0.06);
      tone(a, t + 0.1, 659, 0.18, 0.06);
      tone(a, t + 0.2, 784, 0.4, 0.06);
      break;
    case 'tick':
      tone(a, t, 1200, 0.04, 0.03, 'square');
      break;
  }
}
