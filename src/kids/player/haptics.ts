// Tiny haptic taps for Kids mode, in step with the sounds. On the web only Android has them: navigator.vibrate
// is missing on iOS Safari and on desktops, so every call feature-detects and never throws. A native wrapper
// (Capacitor) that provides its Haptics plugin gets the same taps as Taptic Engine impacts instead.
// kidSound() calls this only while the kid's sound is on and not muted, so quiet mode is also still.
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

type Impact = 'LIGHT' | 'MEDIUM' | 'HEAVY';

/** The native feel of each tap: an impact strength, or the success notification for the wins. */
export const NATIVE_HAPTICS: Partial<Record<KidSound, Impact | 'SUCCESS'>> = {
  move: 'LIGHT',
  capture: 'MEDIUM',
  chomp: 'MEDIUM',
  check: 'MEDIUM',
  pop: 'LIGHT',
  star: 'LIGHT',
  chime: 'LIGHT',
  boop: 'MEDIUM',
  fanfare: 'SUCCESS',
  crown: 'SUCCESS',
};

interface NativeHaptics {
  impact?: (o: { style: Impact }) => unknown;
  notification?: (o: { type: 'SUCCESS' }) => unknown;
}

/** Capacitor's Haptics plugin, when the app runs inside a native wrapper that has it. */
function nativeHaptics(): NativeHaptics | null {
  try {
    if (typeof window === 'undefined') return null;
    return (window as unknown as { Capacitor?: { Plugins?: { Haptics?: NativeHaptics } } }).Capacitor?.Plugins?.Haptics ?? null;
  } catch {
    return null;
  }
}

function nativeTap(kind: Impact | 'SUCCESS'): boolean {
  const h = nativeHaptics();
  const call = kind === 'SUCCESS' ? h?.notification?.bind(h, { type: 'SUCCESS' as const }) : h?.impact?.bind(h, { style: kind });
  if (!call) return false;
  try {
    void Promise.resolve(call()).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/** Buzzes the pattern for a sound name. Returns whether a vibration was requested. */
export function haptic(name: KidSound): boolean {
  const pattern = HAPTIC_PATTERNS[name];
  if (pattern === undefined) return false;
  const kind = NATIVE_HAPTICS[name];
  if (kind && nativeTap(kind)) return true;
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
