// Finishes the native build (vite build --mode native): dist-native holds every voice, and the app carries
// only the ones it can afford (a voice is about 45 MB and mp3 does not compress). The voice list is rewritten
// to match, so the Grown-ups picker offers what is inside the app and a voice chosen on another device that
// the app does not carry falls back to the default voice (speech.ts). The other voices stay in the web app.
//   node scripts/build-native.mjs [--keep sunny,rocket] [--dir dist-native]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_KEEP = ['sunny', 'rocket'];

/** Removes every voice folder not in `keep` and rewrites voices.json to the voices that stay. Returns the ids kept. */
export function pruneVoices(dir, keep = DEFAULT_KEEP) {
  const voiceDir = path.join(dir, 'voice');
  const listPath = path.join(voiceDir, 'voices.json');
  const list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
  const kept = list.voices.filter((v) => keep.includes(v.id));
  const missing = keep.filter((id) => !kept.some((v) => v.id === id));
  if (missing.length) throw new Error(`voices to keep are not in voices.json: ${missing.join(', ')}`);
  for (const e of fs.readdirSync(voiceDir, { withFileTypes: true })) {
    if (e.isDirectory() && !kept.some((v) => v.id === e.name)) fs.rmSync(path.join(voiceDir, e.name), { recursive: true, force: true });
  }
  for (const v of kept) {
    const manifest = path.join(voiceDir, v.id, 'manifest.json');
    if (!fs.existsSync(manifest)) throw new Error(`voice ${v.id} has no manifest.json`);
  }
  const next = { ...list, default: kept.some((v) => v.id === list.default) ? list.default : kept[0].id, voices: kept };
  fs.writeFileSync(listPath, JSON.stringify(next, null, 2) + '\n');
  return kept.map((v) => v.id);
}

function dirSize(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? dirSize(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dir = path.resolve(root, process.argv.includes('--dir') ? arg('--dir') : 'dist-native');
  const keep = process.argv.includes('--keep') ? arg('--keep').split(',') : DEFAULT_KEEP;
  const kept = pruneVoices(dir, keep);
  // A native build has no service worker: the file is not part of it.
  fs.rmSync(path.join(dir, 'sw.js'), { force: true });
  console.log(`dist-native: voices ${kept.join(', ')}; ${(dirSize(dir) / 1024 / 1024).toFixed(0)} MB in all`);
}
