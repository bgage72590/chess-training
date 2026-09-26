/// <reference types="vitest/config" />
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Every file under `dir`, as paths relative to it. */
function listFiles(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

/**
 * Writes sw.js next to the built app: the service worker from src/pwa/sw.template.js with the
 * list of every built file (so the installed app, Stockfish included, works offline) and a
 * version derived from their contents (so any change ships a new worker).
 */
function serviceWorker(): Plugin {
  let outDir = '';
  let root = '';
  return {
    name: 'tempo-service-worker',
    apply: 'build',
    configResolved(c) {
      root = c.root;
      outDir = path.resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const files = listFiles(outDir).filter((f) => f !== 'sw.js');
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(fs.readFileSync(path.join(outDir, f)));
      const sw = fs
        .readFileSync(path.join(root, 'src/pwa/sw.template.js'), 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__FILES__', JSON.stringify(['./', ...files.map((f) => `./${f}`)]));
      fs.writeFileSync(path.join(outDir, 'sw.js'), sw);
    },
  };
}

// `--mode single` inlines all JS/CSS into index.html (the Stockfish worker and wasm stay
// as separate files in dist-single/engine). Used for hosts that only accept one page.
// The normal build is the installable app: manifest, icons and an offline service worker.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile({ removeViteModuleLoader: true })] : [serviceWorker()])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
