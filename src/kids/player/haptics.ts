// Tiny haptic taps for Kids mode, in step with the sounds. Android only: navigator.vibrate is missing on
// iOS Safari and on desktops, so every call feature-detects and never throws. kidSound() calls this only
// while the kid's sound is on and not muted, so quiet mode is also still.
import type { KidSound } from './kidSounds';

const WIN = [12, 40, 12, 40, 24];
const STAR = [10, 30, 10];

/** Vibration per sound, in milliseconds. Sounds that are not listed (whoosh, tick, sparkle) stay still. */
export const HAPTIC_PATTERNS: Partial<Record<KidSound, number | number[]>> = {
  move: 8,
  capture: 15,
  chomp: 15,
  check: 12,
  pop: STAR,
  star: STAR,
  chime: STAR,
  boop: 20,
  fanfare: WIN,
  crown: WIN,
};

/** Buzzes the pattern for a sound name. Returns whether a vibration was requested. */
export function haptic(name: KidSound): boolean {
  const pattern = HAPTIC_PATTERNS[name];
  if (pattern === undefined) return false;
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
