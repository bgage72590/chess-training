import { describe, expect, it } from 'vitest';
import { clipKey, spokenText } from '../src/kids/lib/clipKey';

// Vite globs (no Node APIs): the clip list, and which clip files exist.
const MANIFEST = Object.values(import.meta.glob('../public/voice/manifest.json', { eager: true, import: 'default' }))[0] as
  | { v: number; voice: string; clips: Record<string, number> }
  | undefined;
const FILES = new Set(Object.keys(import.meta.glob('../public/voice/*.mp3', { query: '?url', eager: true })).map((f) => f.split('/').pop()!.replace('.mp3', '')));

describe("Pip's recorded voice", () => {
  it('names clips by the spoken text (after pronunciation)', () => {
    expect(spokenText('Capture the rook on b5.')).toBe('Capture the rook on b five.');
    expect(clipKey('Tap the rook!')).toBe(clipKey(spokenText('Tap  the rook!')));
    expect(clipKey('Tap the rook!')).not.toBe(clipKey('Tap the rook.'));
    expect(clipKey('x')).toMatch(/^[0-9a-z]{14}$/);
  });

  it.runIf(!!MANIFEST)('has a file for every clip, and records the fixed lines', () => {
    const m = MANIFEST!;
    expect(m.v).toBe(1);
    for (const [key, ms] of Object.entries(m.clips)) {
      expect(FILES.has(key), key).toBe(true);
      expect(ms).toBeGreaterThan(200);
    }
    for (const line of ["Hi! I'm Pip. Let's play chess together!", 'Capture the rook on b5.']) expect(m.clips[clipKey(spokenText(line))], line).toBeDefined();
  });
});
