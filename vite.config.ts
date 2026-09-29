/// <reference types="vitest/config" />
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
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
      // Pip's voice clips (voice/) are cached as they are used, not with the install.
      const files = listFiles(outDir).filter((f) => f !== 'sw.js' && !f.startsWith('voice/'));
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

/** What the app is built from. A commit that touches none of it (Pip's clips, docs, tests)
 *  builds the same app, so installed copies are not updated for it. */
const APP_INPUTS = ['--', 'src', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'scripts/copy-engine.mjs', ':(exclude)public/voice'];

const git = (args: string[]) => {
  try {
    return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, TZ: 'UTC' } }).toString().trim();
  } catch {
    return '';
  }
};

/**
 * The version shown in Settings: the date and commit of the last change to the app itself (the
 * deploy checks out the history for this), so it is easy to tell which version is running and
 * the same app always builds the same files.
 */
function buildLabel(mode: string) {
  const last = git(['log', '-1', '--abbrev=7', '--format=%cd · %h', '--date=format-local:%Y-%m-%d %H:%M UTC', ...APP_INPUTS]) || 'development';
  const changed = git(['status', '--porcelain', ...APP_INPUTS]) ? ' + local changes' : '';
  return `${last}${changed}${mode === 'single' ? ' · claude.ai copy' : ''}`;
}

// `--mode single` inlines all JS/CSS into index.html (the Stockfish worker and wasm stay
// as separate files in dist-single/engine). Used for hosts that only accept one page.
// The normal build is the installable app: manifest, icons and an offline service worker.
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __BUILD__: JSON.stringify(buildLabel(mode)) },
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile({ removeViteModuleLoader: true })] : [serviceWorker()])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // Some tests search thousands of positions: a busy machine makes them slower, never wrong.
    testTimeout: 120_000,
  },
}));
