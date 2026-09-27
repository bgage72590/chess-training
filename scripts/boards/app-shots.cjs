// Screenshots of the board themes in the real app (puzzles with a selected piece, settings,
// an opening lesson with arrows), then contact sheets per theme for review.
//
//   npm run build && npx vite preview --port 4182 &
//   BASE=http://localhost:4182/ node scripts/boards/app-shots.cjs <outDir> [theme ...]
const path = require('node:path');
const fs = require('node:fs');
const { launch, open, run } = require('../dev/harness.cjs');

const [outDir = '/tmp/boards', ...only] = process.argv.slice(2);
const THEMES = only.length ? only : ['slate', 'walnut', 'marble', 'tourney', 'ink', 'rose'];
const VIEWS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

/** Clicks pieces until one shows move targets. */
async function selectSomething(page) {
  const pieces = page.locator('.board .piece');
  const n = await pieces.count();
  for (let i = n - 1; i >= 0; i--) {
    const b = await pieces.nth(i).boundingBox();
    if (!b) continue;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    if (await page.locator('.board .dest').count()) return true;
  }
  return false;
}

run(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launch();
  const sheets = {};
  for (const theme of THEMES) {
    sheets[theme] = [];
    for (const scheme of ['light', 'dark']) {
      for (const view of VIEWS) {
        const init = (t) => localStorage.setItem('tempo.profile.v1', JSON.stringify({ v: 1, onboarded: true, xp: 0, settings: { sound: false, boardTheme: t, pieceSet: 'cburnett' } }));
        const s = await open({ browser, ...view, colorScheme: scheme });
        await s.page.addInitScript(init, theme);
        const shot = async (name) => {
          const file = path.join(outDir, `${theme}-${name}-${scheme}-${view.width}.png`);
          await s.page.screenshot({ path: file });
          sheets[theme].push(file);
        };
        await s.goto('puzzles');
        await s.page.waitForSelector('.board .piece');
        await s.page.waitForTimeout(1200);
        await selectSomething(s.page);
        await shot('puzzles');
        await s.goto('settings');
        await s.page.waitForSelector('.settings-preview .board');
        await s.page.waitForTimeout(500);
        if (view.width < 600) await s.page.locator('.theme-swatches').scrollIntoViewIfNeeded();
        await shot('settings');
        await s.goto('opening/w-italian');
        const learn = s.page.locator('.main').getByRole('button', { name: /^learn/i }).first();
        if (await learn.count()) {
          await learn.click();
          await s.page.waitForTimeout(900);
          await shot('opening');
        }
        if (s.errors.length) console.log(theme, scheme, view.width, 'ERRORS', s.errors);
        await s.close();
      }
    }
  }
  // Contact sheets: one per theme, all of its shots scaled into a grid.
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1000 } });
  const page = await ctx.newPage();
  for (const [theme, files] of Object.entries(sheets)) {
    const imgs = files
      .map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${path.basename(f)}</figcaption></figure>`)
      .join('');
    await page.setContent(
      `<style>body{margin:0;padding:12px;background:#888;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}figure{margin:0}img{height:420px;display:block}</style>${imgs}`,
    );
    const file = path.join(outDir, `sheet-${theme}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await browser.close();
});
