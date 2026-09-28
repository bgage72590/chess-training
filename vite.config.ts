/// <reference types="vitest/config" />
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
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

/** The build shown in Settings (date and commit), so it is easy to tell which version is running. */
function buildLabel() {
  let sha = process.env.GITHUB_SHA?.slice(0, 7) ?? '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      /* not a git checkout */
    }
  }
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return sha ? `${date} UTC · ${sha}` : `${date} UTC`;
}

// `--mode single` inlines all JS/CSS into index.html (the Stockfish worker and wasm stay
// as separate files in dist-single/engine). Used for hosts that only accept one page.
// The normal build is the installable app: manifest, icons and an offline service worker.
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __BUILD__: JSON.stringify(buildLabel()) },
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile({ removeViteModuleLoader: true })] : [serviceWorker()])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
