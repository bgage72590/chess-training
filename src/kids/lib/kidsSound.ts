// Kids sound kit: soft synthesized WebAudio sounds (no files, no harsh square waves). The sounds live in
// player/kidSounds.ts and the matching taps in player/haptics.ts; this file keeps the audio context and
// the switch. Kids code never uses src/chess/sound.ts, so the kid's mute silences every sound, moves included.
import { playKidSound, type KidSound } from '../player/kidSounds';
import { haptic } from '../player/haptics';

export type { KidSound };

let ctx: AudioContext | null = null;
let enabled = true;

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

/** Plays a kid sound and its haptic tap, unless sound is off or muted. `step` climbs the ladder for star pops. */
export function kidSound(name: KidSound, step = 0) {
  if (!enabled) return;
  haptic(name);
  const a = audio();
  if (!a) return;
  try {
    playKidSound(a, name, step);
  } catch {
    /* a browser without some WebAudio node stays quiet */
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
