// Dev smoke test: plays a short game at level 1, resigns, and opens the review.
const { chromium } = (() => { try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); } })();
(async () => {
  const out = process.argv[2];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('tempo.profile.v1')) localStorage.setItem('tempo.profile.v1', JSON.stringify({ v: 1, onboarded: true, xp: 0 }));
    localStorage.setItem('tempo.play', JSON.stringify({ level: 1, color: 'w', coach: false, evalBar: true }));
  });
  await page.goto((process.env.BASE || 'http://localhost:4173/') + '#/play');
  await page.getByRole('button', { name: /Start game/ }).click();
  const box = await page.locator('.board').first().boundingBox();
  const sq = (s) => ({ x: box.x + (s.charCodeAt(0) - 97 + 0.5) * box.width / 8, y: box.y + (8 - Number(s[1]) + 0.5) * box.height / 8 });
  const play = async (a, b, n) => {
    await page.mouse.click(sq(a).x, sq(a).y); await page.mouse.click(sq(b).x, sq(b).y);
    await page.waitForFunction((n) => document.querySelectorAll('.moves button').length >= n, n, { timeout: 30000 });
    await page.waitForTimeout(400);
  };
  // Scholar's-mate attempt; level 1 often allows it. Stop after four moves either way.
  const seq = [['e2', 'e4'], ['f1', 'c4'], ['d1', 'h5'], ['h5', 'f7']];
  let n = 2;
  for (const [a, b] of seq) {
    try { await play(a, b, n); n += 2; } catch { break; }
    if (await page.locator('text=/You won|You lost|Draw/').count()) break;
  }
  if (!(await page.locator('text=/You won|You lost|Draw/').count())) await page.getByRole('button', { name: 'Resign' }).click();
  console.log('result:', (await page.locator('.feedback').first().innerText()).replace(/\n/g, ' '));
  await page.getByRole('button', { name: /Review this game/ }).click();
  await page.waitForSelector('.acc-row', { timeout: 60000 });
  console.log('review:', (await page.locator('.acc-row').innerText()).replace(/\n/g, ' '));
  await page.screenshot({ path: out });
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
