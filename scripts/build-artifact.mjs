// Turns the single-file build (dist-single/index.html) into a body-only page for hosts that
// wrap content in their own document skeleton (e.g. a claude.ai Artifact).
// The Stockfish worker + wasm stay as sibling files in dist-single/engine/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'dist-single');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);
const title = pick(/<title>[\s\S]*?<\/title>/g);
const meta = pick(/<meta name="description"[^>]*>/g);
const links = pick(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script[^>]*>[\s\S]*?<\/script>/g);

// Count real closing tags: bundled code can contain "<script" inside string literals.
const closed = (html.match(/<\/script>/g) ?? []).length;
if (scripts.length !== closed) throw new Error(`script extraction mismatch: ${scripts.length} vs ${closed}`);
if (!title.length || !styles.length || !scripts.length) throw new Error('unexpected build output');

const out = [...title, ...meta, ...links, ...styles, '<div id="root"></div>', ...scripts].join('\n') + '\n';
fs.writeFileSync(path.join(dir, 'artifact.html'), out);
console.log(`dist-single/artifact.html: ${(out.length / 1024).toFixed(0)} KB`);
