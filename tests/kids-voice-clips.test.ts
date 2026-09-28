import { describe, expect, it } from 'vitest';
import { clipKey, spokenText } from '../src/kids/lib/clipKey';

// Vite globs (no Node APIs, nothing loaded): the voice list, each voice's clip list, and the clip files.
type Manifest = { v: number; voice: string; version?: string; clips: Record<string, number> };
const LIST = Object.values(import.meta.glob('../public/voice/voices.json', { eager: true, import: 'default' }))[0] as
  | { default: string; voices: { id: string; name: string; blurb: string; engine: string; voice: string }[] }
  | undefined;
const MANIFESTS = import.meta.glob('../public/voice/*/manifest.json', { eager: true, import: 'default' }) as Record<string, Manifest>;
const FILES = new Set(Object.keys(import.meta.glob('../public/voice/*/*.mp3')).map((f) => f.replace('../public/voice/', '').replace('.mp3', '')));

describe("Pip's recorded voices", () => {
  it('names clips by the spoken text (after pronunciation)', () => {
    expect(spokenText('Capture the rook on b5.')).toBe('Capture the rook on b five.');
    expect(clipKey('Tap the rook!')).toBe(clipKey(spokenText('Tap  the rook!')));
    expect(clipKey('Tap the rook!')).not.toBe(clipKey('Tap the rook.'));
    expect(clipKey('x')).toMatch(/^[0-9a-z]{14}$/);
  });

  it.runIf(!!LIST?.voices.length)('lists voices with friendly names, and a default that exists', () => {
    const ids = LIST!.voices.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(LIST!.default);
    for (const v of LIST!.voices) {
      expect(v.id).toMatch(/^[a-z0-9-]{1,24}$/);
      expect(v.name.length).toBeGreaterThan(1);
      expect(v.blurb.length).toBeGreaterThan(3);
    }
  });

  it.runIf(!!LIST?.voices.length)('has every clip file of every voice, and every voice records the same lines', () => {
    const sets = LIST!.voices.map((v) => {
      const m = MANIFESTS[`../public/voice/${v.id}/manifest.json`];
      expect(m, v.id).toBeDefined();
      expect(m.v).toBe(1);
      expect(m.version).toBeTruthy();
      for (const [key, ms] of Object.entries(m.clips)) {
        expect(FILES.has(`${v.id}/${key}`), `${v.id}/${key}`).toBe(true);
        expect(ms).toBeGreaterThan(200);
      }
      for (const line of ["Hi! I'm Pip. Let's play chess together!", 'Capture the rook on b5.']) expect(m.clips[clipKey(spokenText(line))], `${v.id}: ${line}`).toBeDefined();
      return Object.keys(m.clips).sort().join();
    });
    expect(new Set(sets).size).toBe(1);
  });
});
