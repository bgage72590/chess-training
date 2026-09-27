#!/usr/bin/env node
// Renders the "staunton3d" piece set: serves the repo root, opens render-3d.html in headless
// Chromium (WebGL via SwiftShader) and writes src/assets/pieces/staunton3d/{wK..bP}.webp.
//
//   node scripts/pieces/render-3d.cjs                 # render all 12 sprites
//   node scripts/pieces/render-3d.cjs --only wN,bN    # a subset
//   node scripts/pieces/render-3d.cjs --debug DIR     # also write full-size PNGs to DIR
//   node scripts/pieces/render-3d.cjs --sheet FILE    # also write a contact sheet PNG
//   node scripts/pieces/render-3d.cjs --no-write      # preview only
//
// Needs the `playwright` package (or PLAYWRIGHT_PATH pointing at an install) and three.js in node_modules.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { chromium } = (() => {
  try {
    return require('playwright');
  } catch {
    return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
  }
})();

const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'src/assets/pieces/staunton3d');
const NAMES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = opt('--only');
const debugDir = opt('--debug');
const sheet = opt('--sheet');
const write = !args.includes('--no-write');
const size = Number(opt('--size') || 1024);
const out = Number(opt('--out') || 256);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const fromDataUrl = (u) => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');

/** A contact sheet: every sprite at 256px and at 44px on light and dark squares of three themes. */
async function contactSheet(browser, files, target) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const img = (n) => `data:image/webp;base64,${fs.readFileSync(files[n]).toString('base64')}`;
  const themes = [
    ['slate', '#dfe5ea', '#7f98ab'],
    ['walnut', '#f0d9b5', '#b58863'],
    ['tourney', '#eeeed2', '#769656'],
  ];
  const big = NAMES.map((n, i) => `<div style="width:256px;height:256px;background:${i % 2 ? '#7f98ab' : '#dfe5ea'} url(${img(n)}) center/100% no-repeat"></div>`).join('');
  const small = themes
    .map(([, l, d]) =>
      `<div style="display:flex">${NAMES.map((n, i) => `<div style="width:44px;height:44px;background:${i % 2 ? d : l} url(${img(n)}) center/100% no-repeat"></div>`).join('')}` +
      `${NAMES.map((n, i) => `<div style="width:44px;height:44px;background:${i % 2 ? l : d} url(${img(n)}) center/100% no-repeat"></div>`).join('')}</div>`,
    )
    .join('');
  // 44px sprites magnified 3x with visible pixels, on light/dark slate squares.
  const zoom = NAMES.map((n, i) => `<canvas data-src="${img(n)}" data-bg="${i % 2 ? '#dfe5ea' : '#7f98ab'}" width="44" height="44" style="width:132px;height:132px;image-rendering:pixelated"></canvas>`).join('');
  await page.setContent(`<body style="margin:0;background:#222;padding:8px">
    <div style="display:grid;grid-template-columns:repeat(6,256px);gap:0">${big}</div>
    <div style="margin-top:8px">${small}</div>
    <div style="margin-top:8px;display:grid;grid-template-columns:repeat(12,132px)">${zoom}</div></body>`);
  await page.evaluate(() =>
    Promise.all(
      [...document.querySelectorAll('canvas[data-src]')].map(
        (c) =>
          new Promise((res) => {
            const im = new Image();
            im.onload = () => {
              const ctx = c.getContext('2d');
              ctx.fillStyle = c.dataset.bg;
              ctx.fillRect(0, 0, 44, 44);
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(im, 0, 0, 44, 44);
              res();
            };
            im.src = c.dataset.src;
          }),
      ),
    ),
  );
  await page.waitForTimeout(200);
  await page.screenshot({ path: target, fullPage: true });
  await page.close();
}

(async () => {
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}] ${m.text()}`);
    });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    const q = new URLSearchParams({ size: String(size), out: String(out), debug: debugDir ? '1' : '0' });
    if (only) q.set('only', only);
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${port}/scripts/pieces/render-3d.html?${q}`, { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__result !== undefined, null, { timeout: 300000, polling: 500 });
    const result = await page.evaluate(() => window.__result);
    if (result.error) throw new Error(result.error);
    console.log(`rendered ${Object.keys(result.sprites).length} sprites in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    const files = {};
    const dir = write ? OUT_DIR : fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'pieces-'));
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, url] of Object.entries(result.sprites)) {
      const buf = fromDataUrl(url);
      const file = path.join(dir, `${name}.webp`);
      fs.writeFileSync(file, buf);
      files[name] = file;
      const m = result.metrics[name];
      console.log(`${name}.webp ${(buf.length / 1024).toFixed(1)} KB  height ${m.height} width ${m.width} top ${m.top} bottom ${m.bottom}`);
    }
    if (debugDir) {
      fs.mkdirSync(debugDir, { recursive: true });
      for (const [name, url] of Object.entries(result.full)) fs.writeFileSync(path.join(debugDir, `${name}.png`), fromDataUrl(url));
      fs.writeFileSync(path.join(debugDir, 'knight-silhouette.png'), fromDataUrl(result.silhouette));
    }
    if (sheet) {
      for (const n of NAMES) if (!files[n]) files[n] = path.join(OUT_DIR, `${n}.webp`);
      await contactSheet(browser, files, sheet);
      console.log(`contact sheet: ${sheet}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
