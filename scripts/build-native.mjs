// Finishes the native build (vite build --mode native): a native build has no service worker, so the
// generated sw.js is not part of it.
//   node scripts/build-native.mjs [--dir dist-native]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function dirSize(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? dirSize(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
}

const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(root, process.argv.includes('--dir') ? arg('--dir') : 'dist-native');
fs.rmSync(path.join(dir, 'sw.js'), { force: true });
console.log(`dist-native: ${(dirSize(dir) / 1024 / 1024).toFixed(0)} MB in all`);
