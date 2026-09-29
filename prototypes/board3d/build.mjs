// Builds the 3D board prototype into one self-contained page for claude.ai:
//   node prototypes/board3d/build.mjs  ->  prototypes/board3d/dist/tempo-3d-board.html
// three.js, chess.js, the baked pieces and the textures are all inlined (claude.ai pages can only load
// scripts from a few CDNs), and the page has no document skeleton because claude.ai adds one.
import { build } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { wrap } from './vite.config.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
await build({
  configFile: false,
  root: here,
  logLevel: 'warn',
  build: {
    outDir: here + 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    target: 'es2020',
    lib: { entry: here + 'main.js', formats: ['es'], fileName: () => 'board.js' },
  },
});
const js = readFileSync(here + 'dist/board.js', 'utf8');
if (/<\/script|<!--/i.test(js)) throw new Error('The bundle contains text that would end its <script> early');
const page = readFileSync(here + 'page.html', 'utf8').trimEnd() + '\n<script type="module">\n' + js + '\n</script>\n';
writeFileSync(here + 'dist/tempo-3d-board.html', page);
// The same page with a skeleton, to open locally (npx vite preview --outDir prototypes/board3d/dist, or any static server).
writeFileSync(here + 'dist/index.html', wrap(page, ''));
console.log(`dist/tempo-3d-board.html: ${Math.round(page.length / 1024)} KB`);
