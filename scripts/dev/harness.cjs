// Shared setup for the browser dev scripts: Playwright, a page with an onboarded profile,
// error collection and board helpers.
const { chromium } = (() => {
  try {
    return require('playwright');
  } catch {
    return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
  }
})();

const BASE = process.env.BASE || 'http://localhost:4173/';

const launch = () => chromium.launch();

/**
 * Opens a page in a fresh browser context (in `browser` if given, else a new Chromium).
 * Unless the route contains "fresh", the profile starts onboarded with sound off. `init`
 * runs before every page script. `close()` closes what open() created.
 */
async function open({ width = 1400, height = 900, colorScheme = 'light', init, browser: shared } = {}) {
  const browser = shared ?? (await launch());
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('ERR_')) errors.push(`console: ${m.text()}`);
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem('tempo.profile.v1') && !location.hash.includes('fresh')) {
      localStorage.setItem('tempo.profile.v1', JSON.stringify({ v: 1, onboarded: true, xp: 0, settings: { sound: false } }));
    }
  });
  if (init) await page.addInitScript(init);
  const goto = (route) => page.goto(BASE + '#/' + route);
  const close = () => (shared ? ctx.close() : browser.close());
  return { browser, ctx, page, errors, goto, close };
}

/** Centre of a board square in page coordinates, whatever the board orientation. */
async function squareCenter(page, sq) {
  const b = await page.locator(`.board [data-square="${sq}"]`).first().boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Plays a move by clicking its two squares (and picking the promotion piece if asked). */
async function clickMove(page, uci) {
  for (const sq of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const p = await squareCenter(page, sq);
    await page.mouse.click(p.x, p.y);
  }
  if (uci[4]) {
    const name = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[uci[4]];
    const btn = page.locator(`.promo-choice[aria-label*="${name}"]`);
    if (await btn.count()) await btn.click();
  }
}

/** Plays a move by dragging the piece. */
async function dragMove(page, uci) {
  const a = await squareCenter(page, uci.slice(0, 2));
  const b = await squareCenter(page, uci.slice(2, 4));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
}

/** Runs a script body, reporting failures with a non-zero exit code. */
function run(fn) {
  fn().catch((e) => {
    console.error('FAILED', e.message);
    process.exit(1);
  });
}

module.exports = { BASE, launch, open, squareCenter, clickMove, dragMove, run };
