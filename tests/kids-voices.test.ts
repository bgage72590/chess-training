import { describe, expect, it } from 'vitest';
import { rankVoices, voiceNote, voiceScore } from '../src/kids/player/voices';

const v = (name: string, lang = 'en-US', localService = true) => ({ name, lang, voiceURI: name, localService });

describe('read-aloud voice choice', () => {
  // macOS lists its joke voices first, alphabetically.
  const mac = [v('Albert'), v('Bad News'), v('Bahh'), v('Bells'), v('Boing'), v('Bubbles'), v('Cellos'), v('Fred'), v('Junior'), v('Grandma (English (US))'), v('Samantha'), v('Daniel', 'en-GB'), v('Whisper'), v('Zarvox'), v('Amélie', 'fr-CA')];

  it('never picks a novelty or robotic voice when a real one exists', () => {
    const ranked = rankVoices(mac);
    expect(ranked[0].name).toBe('Samantha');
    expect(ranked.map((x) => x.name)).not.toContain('Albert');
    expect(ranked.map((x) => x.name)).not.toContain('Whisper');
    expect(ranked.map((x) => x.name)).not.toContain('Amélie');
  });

  it('prefers premium, enhanced and neural voices', () => {
    expect(rankVoices([...mac, v('Zoe (Premium)'), v('Ava (Enhanced)')])[0].name).toBe('Zoe (Premium)');
    const edge = [v('Microsoft David - English (United States)'), v('Microsoft Zira - English (United States)'), v('Microsoft Ana Online (Natural) - English (United States)', 'en-US', false), v('Microsoft Ava Online (Natural) - English (United States)', 'en-US', false)];
    expect(rankVoices(edge)[0].name).toMatch(/^Microsoft Ava Online/);
    expect(rankVoices([v('Google US English', 'en-US', false), v('Fred')])[0].name).toBe('Google US English');
  });

  it('finds Premium and Enhanced voices by their voiceURI when the name does not say so', () => {
    const apple = (name: string, tier: string, lang = 'en-US') => ({ name, lang, voiceURI: `com.apple.voice.${tier}.${lang}.${name}`, localService: true });
    // iOS and macOS list a downloaded voice as plain "Zoe", and only the voiceURI carries the tier.
    expect(voiceScore(apple('Zoe', 'premium'))).toBe(voiceScore(v('Zoe (Premium)')));
    expect(voiceScore(apple('Nicky', 'enhanced'))).toBe(voiceScore(v('Nicky (Enhanced)')));
    expect(voiceScore(apple('Nicky', 'compact'))).toBeLessThan(voiceScore(apple('Nicky', 'enhanced')));
    const compact = apple('Samantha', 'compact');
    expect(rankVoices([compact, apple('Evan', 'enhanced'), apple('Zoe', 'premium')]).map((x) => x.name)).toEqual(['Zoe', 'Evan', 'Samantha']);
    // The name is still enough, and a voice with neither is ordinary.
    expect(voiceScore(v('Zoe (Premium)'))).toBe(voiceScore(apple('Zoe', 'premium')));
    expect(voiceScore({ name: 'Moira', lang: 'en-IE', voiceURI: 'premiumish-voice', localService: true })).toBeLessThan(80);
    // A premium tier in the URI does not rescue a joke voice.
    expect(voiceScore(apple('Zarvox', 'premium'))).toBe(-Infinity);
  });

  it('uses on-device voices when offline', () => {
    const list = [v('Google US English', 'en-US', false), v('Samantha')];
    expect(rankVoices(list, false)[0].name).toBe('Samantha');
    expect(rankVoices(list, true, new Set(['Google US English']))[0].name).toBe('Samantha');
  });

  it('labels voice quality for grown-ups', () => {
    expect(voiceNote(v('Zoe (Premium)'))).toBe('natural');
    expect(voiceNote(v('Fred'))).toBe('robotic');
    expect(voiceNote(v('Google US English', 'en-US', false))).toBe('natural, online');
  });
});
