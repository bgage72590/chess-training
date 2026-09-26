// Dev smoke test: plays 1.e4 against the coach and waits for the engine to answer, then drags Nf3.
// BLOCK_WASM=1 blocks the Stockfish binary to exercise the backup engine.
const { open, clickMove, dragMove, run } = require('./harness.cjs');

run(async () => {
  const out = process.argv[2];
  const { browser, ctx, page, errors, goto } = await open();
  if (process.env.BLOCK_WASM) await ctx.route('**/*.wasm', (r) => r.abort());
  await goto('play');
  await page.getByRole('button', { name: /Start game/ }).click();
  await page.waitForTimeout(800);
  await clickMove(page, 'e2e4');
  const t0 = Date.now();
  await page.waitForFunction(() => document.querySelectorAll('.moves button').length >= 2, null, { timeout: 30000 });
  console.log('engine replied in', Date.now() - t0, 'ms:', await page.locator('.moves').innerText());
  await page.waitForTimeout(600);
  await dragMove(page, 'g1f3');
  await page.waitForFunction(() => document.querySelectorAll('.moves button').length >= 4, null, { timeout: 30000 });
  console.log('after drag:', (await page.locator('.moves').innerText()).replace(/\n/g, ' '));
  console.log('engine notice:', (await page.locator('.feedback-warn').allInnerTexts()).join(' | ').replace(/\n/g, ' '));
  await page.screenshot({ path: out });
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
});
