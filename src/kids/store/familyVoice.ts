// What the family has chosen for Pip's voice and sounds, for whoever has no choice of their own yet:
// a new player copies it (NewKid.tsx), and the screens before a player is picked (the picker and the
// New player wizard) speak with it. "The family" is the kid whose settings changed most recently.
import { DEVICE_VOICE } from '../player/speech';
import { defaultSettings, type KidProfile, type KidSettings, type KidsState } from './kidsStore';

/** The kid whose settings were changed most recently. */
export const latestChanged = (kids: readonly KidProfile[]): KidProfile | undefined =>
  kids.reduce<KidProfile | undefined>((best, k) => (!best || (k.settingsAt ?? 0) > (best.settingsAt ?? 0) ? k : best), undefined);

/**
 * What a new player takes from the family: Pip's voice, speech speed and Sounds from the kid changed
 * most recently. The read-aloud mode too, when a grown-up chose it there: one left at the age group's
 * own default is not a family choice (a 12-year-old's "speaker button only" must not silence a
 * 5-year-old).
 */
export function inheritedSettings(kids: readonly KidProfile[]): Partial<KidSettings> {
  const k = latestChanged(kids);
  if (!k) return {};
  const out: Partial<KidSettings> = { pipVoice: k.settings.pipVoice, rate: k.settings.rate, sound: k.settings.sound };
  if (k.settings.voice !== defaultSettings(k.band).voice) out.voice = k.settings.voice;
  return out;
}

/**
 * The recorded voice Pip speaks with now: the active kid's, or the family's while nobody is picked.
 * A device that opted for a recorded voice (Grown-ups) uses the default one where the choice is the
 * device's own voice. `undefined`: the default recorded voice, as for a kid who never picked one.
 */
export function pipVoiceFor(s: Pick<KidsState, 'kids' | 'activeKid' | 'device'>): string | undefined {
  const id = (s.kids.find((k) => k.id === s.activeKid) ?? latestChanged(s.kids))?.settings.pipVoice;
  return id === DEVICE_VOICE && s.device.useRecorded ? '' : id;
}
