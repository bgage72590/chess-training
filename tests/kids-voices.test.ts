import { describe, expect, it } from 'vitest';
import { rankVoices, voiceNote } from '../src/kids/player/voices';

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
