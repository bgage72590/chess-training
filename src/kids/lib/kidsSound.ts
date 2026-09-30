// Kids sound kit: soft synthesized WebAudio sounds (no files, no harsh square waves). The sounds live in
// player/kidSounds.ts and the matching taps in player/haptics.ts; this file keeps the switch and Kids mode's
// claim on the audio (the context itself is lib/audio.ts). Kids code never uses src/chess/sound.ts, so the
// kid's mute silences every sound, moves included.
import { playKidSound, type KidSound } from '../player/kidSounds';
import { haptic } from '../player/haptics';
import { armAudioUnlock, setAudioSession, setAudioWanted, unlockAudio, withRunningContext } from '../../lib/audio';

export type { KidSound };

let enabled = true;

export function setKidSoundEnabled(on: boolean) {
  enabled = on;
}

/** Plays a kid sound and its haptic tap, unless sound is off or muted. `step` climbs the ladder for star pops. */
export function kidSound(name: KidSound, step = 0) {
  if (!enabled) return;
  haptic(name);
  withRunningContext((a) => {
    try {
      playKidSound(a, name, step);
    } catch {
      /* a browser without some WebAudio node stays quiet */
    }
  });
}

/** Wakes the audio context from a user gesture (iOS), never while muted. lib/audio.ts does it on every gesture by itself once Kids mode is open; this is for a caller that has a gesture in hand. */
export function unlockKidSound() {
  if (enabled) void unlockAudio();
}

/**
 * Kids mode opens: Pip's voice is the point, so the page asks for a 'playback' audio session (sound with the
 * ringer switch on silent), and any tap, key press or VoiceOver activation wakes the audio while the kid's
 * sound is on. Returns what puts the grown-up app's audio back when Kids mode closes.
 */
export function enterKidSound(): () => void {
  const undo = [setAudioSession('playback'), setAudioWanted(() => enabled)];
  armAudioUnlock();
  return () => undo.forEach((f) => f());
}

export const kidsSound = { play: kidSound, unlock: unlockKidSound, setEnabled: setKidSoundEnabled, enter: enterKidSound };
