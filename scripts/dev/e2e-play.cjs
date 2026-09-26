// Dev smoke test: plays 1.e4 against the coach and waits for Stockfish to answer.
const { chromium } = (() => { try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); } })();
(async () => {
  const out = process.argv[2];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_')) errors.push(m.text()); });
  await page.addInitScript(() => localStorage.setItem('tempo.profile.v1', JSON.stringify({ v: 1, onboarded: true, xp: 0 })));
  if (process.env.BLOCK_WASM) await ctx.route('**/*.wasm', (r) => r.abort());
  await page.goto('' + (process.env.BASE || 'http://localhost:4173/') + '#/play');
  await page.getByRole('button', { name: /Start game/ }).click();
  const board = page.locator('.board').first();
  const box = await board.boundingBox();
  const sq = (s) => {
    const f = s.charCodeAt(0) - 97, r = Number(s[1]) - 1;
    return { x: box.x + (f + 0.5) * box.width / 8, y: box.y + (7 - r + 0.5) * box.height / 8 };
  };
  const click = async (s) => { const p = sq(s); await page.mouse.click(p.x, p.y); };
  await page.waitForTimeout(800);
  await click('e2'); await click('e4');
  const t0 = Date.now();
  await page.waitForFunction(() => document.querySelectorAll('.moves button').length >= 2, null, { timeout: 30000 });
  console.log('engine replied in', Date.now() - t0, 'ms:', await page.locator('.moves').innerText());
  // Drag-and-drop a second move: Nf3 (g1 -> f3)
  await page.waitForTimeout(600);
  const a = sq('g1'), b = sq('f3');
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 }); await page.mouse.move(b.x, b.y, { steps: 5 }); await page.mouse.up();
  await page.waitForFunction(() => document.querySelectorAll('.moves button').length >= 4, null, { timeout: 30000 });
  console.log('after drag:', (await page.locator('.moves').innerText()).replace(/\n/g, ' '));
  console.log('engine notice:', (await page.locator('.feedback-warn').allInnerTexts()).join(' | ').replace(/\n/g, ' '));
  await page.screenshot({ path: out });
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
