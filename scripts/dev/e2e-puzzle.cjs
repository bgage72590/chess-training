// Dev smoke test: solves the rated puzzle shown, checks the rating moves.
const { chromium } = (() => { try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); } })();
const puzzles = require('../../src/data/puzzles.json');
(async () => {
  const out = process.argv[2];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('tempo.profile.v1', JSON.stringify({ v: 1, onboarded: true, xp: 0 })));
  await page.goto('http://localhost:4173/#/puzzles');
  await page.waitForSelector('text=/Puzzle #/');
  const label = await page.locator('text=/Puzzle #\\d+/').innerText();
  const id = 'p' + label.match(/#(\d+)/)[1].padStart(4, '0');
  const pz = puzzles.find((p) => p.id === id);
  const moves = pz.moves.split(' ');
  const solverWhite = pz.fen.split(' ')[1] === 'b';
  const box = await page.locator('.board').first().boundingBox();
  const sq = (s) => {
    let f = s.charCodeAt(0) - 97, r = Number(s[1]) - 1;
    const x = solverWhite ? f : 7 - f, y = solverWhite ? 7 - r : r;
    return { x: box.x + (x + 0.5) * box.width / 8, y: box.y + (y + 0.5) * box.height / 8 };
  };
  await page.waitForTimeout(1200); // setup move
  for (let i = 1; i < moves.length; i += 2) {
    const u = moves[i];
    const a = sq(u.slice(0, 2)), b = sq(u.slice(2, 4));
    await page.mouse.click(a.x, a.y); await page.mouse.click(b.x, b.y);
    if (u[4]) { await page.waitForTimeout(200); const btn = page.locator(`.promo-choice[aria-label*="${{ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[u[4]]}"]`); if (await btn.count()) await btn.click(); }
    await page.waitForTimeout(900);
  }
  await page.waitForSelector('.feedback-good', { timeout: 5000 });
  console.log(id, 'rating', pz.rating, '->', await page.locator('.feedback-good').innerText().then((t) => t.replace(/\n/g, ' | ')));
  console.log('rating box:', (await page.locator('.rating-box').innerText()).replace(/\n/g, ' '));
  await page.screenshot({ path: out });
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
