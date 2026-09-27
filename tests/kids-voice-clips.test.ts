import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { clipKey, spokenText } from '../src/kids/lib/clipKey';

const DIR = path.resolve(__dirname, '../public/voice');
const manifestPath = path.join(DIR, 'manifest.json');

describe("Pip's recorded voice", () => {
  it('names clips by the spoken text (after pronunciation)', () => {
    expect(spokenText('Capture the rook on b5.')).toBe('Capture the rook on b five.');
    expect(clipKey('Tap the rook!')).toBe(clipKey(spokenText('Tap  the rook!')));
    expect(clipKey('Tap the rook!')).not.toBe(clipKey('Tap the rook.'));
    expect(clipKey('x')).toMatch(/^[0-9a-z]{14}$/);
  });

  it.runIf(fs.existsSync(manifestPath))('has a file for every clip, and records the fixed lines', () => {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { v: number; voice: string; clips: Record<string, number> };
    expect(m.v).toBe(1);
    for (const [key, ms] of Object.entries(m.clips)) {
      expect(fs.existsSync(path.join(DIR, `${key}.mp3`)), key).toBe(true);
      expect(ms).toBeGreaterThan(200);
    }
    for (const line of ["Hi! I'm Pip. Let's play chess together!", 'Capture the rook on b5.']) expect(m.clips[clipKey(spokenText(line))], line).toBeDefined();
  });
});
