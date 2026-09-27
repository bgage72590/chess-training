// Generates the textured board images in src/assets/boards/ (e.g. walnut.webp, marble.webp).
// The materials are procedural (value noise + FBM, seeded) and drawn on a canvas in headless
// Chromium via Playwright, then exported as WebP.
//
//   node scripts/boards/generate.mjs [theme ...] [--size 1024] [--quality 0.8] [--png outDir]
//
// --png also writes lossless PNG previews to outDir for inspection.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outDir = path.join(root, 'src/assets/boards');
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try {
    return require('playwright');
  } catch {
    return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
  }
})();

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  if (i < 0) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const size = Number(opt('--size', '1024'));
const quality = Number(opt('--quality', '0.9'));
const pngDir = opt('--png', '');

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><title>boards</title>');
  await page.addScriptTag({ path: path.join(here, 'textures.browser.js') });
  const themes = args.length ? args : await page.evaluate(() => window.BOARD_THEMES);
  fs.mkdirSync(outDir, { recursive: true });
  if (pngDir) fs.mkdirSync(pngDir, { recursive: true });
  for (const theme of themes) {
    const t0 = Date.now();
    const { webp, png } = await page.evaluate(
      ([id, s, q, withPng]) => {
        const c = window.renderBoard(id, s);
        return { webp: c.toDataURL('image/webp', q), png: withPng ? c.toDataURL('image/png') : '' };
      },
      [theme, size, quality, !!pngDir],
    );
    if (!webp.startsWith('data:image/webp')) throw new Error('This Chromium cannot encode WebP');
    const buf = Buffer.from(webp.split(',')[1], 'base64');
    fs.writeFileSync(path.join(outDir, `${theme}.webp`), buf);
    if (pngDir) fs.writeFileSync(path.join(pngDir, `${theme}.png`), Buffer.from(png.split(',')[1], 'base64'));
    console.log(`${theme}.webp  ${size}px  ${(buf.length / 1024).toFixed(0)} KB  (${Date.now() - t0} ms)`);
  }
} finally {
  await browser.close();
}
