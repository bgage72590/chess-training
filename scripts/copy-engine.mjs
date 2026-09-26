// Copies the Stockfish WASM build (lite, single-threaded: no cross-origin isolation needed)
// into public/engine so Vite serves and bundles it next to the app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules/stockfish/bin');
const dest = path.join(root, 'public/engine');
fs.mkdirSync(dest, { recursive: true });
for (const [from, to] of [
  ['stockfish-19-lite-single.js', 'stockfish.js'],
  ['stockfish-19-lite-single.wasm', 'stockfish.wasm'],
]) {
  fs.copyFileSync(path.join(src, from), path.join(dest, to));
}
fs.copyFileSync(path.join(root, 'node_modules/stockfish/Copying.txt'), path.join(dest, 'COPYING-stockfish.txt'));
console.log('Stockfish copied to public/engine');
