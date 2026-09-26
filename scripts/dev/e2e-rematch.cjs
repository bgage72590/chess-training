// Dev smoke test (regression): resign while the engine is thinking, then rematch as White. The board must accept moves.
const { open, clickMove, run } = require('./harness.cjs');
run(async () => {
  const { browser, page, errors, goto } = await open({
    init: () => localStorage.setItem('tempo.play', JSON.stringify({ level: 10, color: 'w', coach: false, evalBar: false })),
  });
  await goto('play');
  await page.getByRole('button', { name: /Start game/ }).click();
  await page.waitForTimeout(1500);
  await clickMove(page, 'e2e4');
  await page.waitForFunction(() => document.querySelectorAll('.moves button').length >= 2, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  await clickMove(page, 'd2d4');
  await page.waitForSelector('text=Thinking…', { timeout: 3000 });
  await page.getByRole('button', { name: 'Resign' }).click({ timeout: 500 });
  const movesAtResign = await page.locator('.moves button').count();
  console.log('resigned mid-think with', movesAtResign, 'moves:', (await page.locator('.feedback').first().innerText()).replace(/\n/g, ' '));
  await page.getByRole('button', { name: 'Rematch' }).click();
  await page.waitForTimeout(1500);
  const thinking = await page.locator('text=Thinking…').count();
  await clickMove(page, 'c2c4');
  await page.waitForFunction(() => document.querySelectorAll('.moves button').length >= 1, null, { timeout: 5000 });
  console.log('after rematch: thinking shown =', thinking, '| moves:', (await page.locator('.moves').innerText()).replace(/\n/g, ' '));
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
});
