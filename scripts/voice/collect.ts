// Lists every line Kids mode can say aloud, for scripts/voice/render.py.
// Scans src/kids for sentence-like string literals (lines built at run time with ${...}
// are not recorded; they use the device voice). Output: [{ key, text }] as JSON on stdout.
//   npx tsx scripts/voice/collect.ts > /tmp/lines.json
import fs from 'node:fs';
import path from 'node:path';
import { clipKey, spokenText } from '../../src/kids/lib/clipKey';

const ROOT = path.resolve(import.meta.dirname, '../../src/kids');
const LITERAL = /(?<![\w$])(['"])((?:\\.|(?!\1).)*?)\1|`((?:\\.|[^`$\\]|\$(?!\{))*)`/gs;

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts') ? [p] : [];
  });
}

/** Sentence-like: starts upper-case, has letters, no code characters, and a space or end punctuation. */
function isLine(s: string): boolean {
  if (!/[A-Za-z]/.test(s) || !/^[A-Z0-9"'¡¿]/.test(s) || s.length > 400) return false;
  if (/[{}<>=/#;_\\|]|\.\w+\(|^M[\d.]/.test(s)) return false;
  return s.includes(' ') || /[!?.]$/.test(s);
}

const lines = new Map<string, string>();
for (const f of files(ROOT)) {
  const src = fs.readFileSync(f, 'utf8').replace(/^\s*import .*$/gm, '');
  for (const m of src.matchAll(LITERAL)) {
    const raw = (m[2] ?? m[3] ?? '').replace(/\\(['"`])/g, '$1').trim();
    if (!isLine(raw)) continue;
    const text = spokenText(raw);
    lines.set(clipKey(text), text);
  }
}
process.stdout.write(JSON.stringify([...lines].map(([key, text]) => ({ key, text })), null, 0));
