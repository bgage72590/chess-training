/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The size the app shows before a voice is downloaded ("Download 44 MB") is the manifest's `bytes`,
// written by scripts/voice/render.py (and scripts/voice/sizes.py for older manifests).
const ROOT = path.resolve(import.meta.dirname, '../public/voice');
const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'voices.json'), 'utf8')) as { voices: { id: string }[] };

describe("each voice's manifest says how big the voice is", () => {
  for (const { id } of list.voices) {
    it(`${id}: bytes is the total size of its clips`, () => {
      const m = JSON.parse(fs.readFileSync(path.join(ROOT, id, 'manifest.json'), 'utf8')) as { bytes?: number; clips: Record<string, number> };
      const total = Object.keys(m.clips).reduce((n, k) => n + fs.statSync(path.join(ROOT, id, `${k}.mp3`)).size, 0);
      expect(m.bytes).toBe(total);
      expect(Number.isInteger(m.bytes)).toBe(true);
      expect(m.bytes).toBeGreaterThan(0);
    });
  }
});
