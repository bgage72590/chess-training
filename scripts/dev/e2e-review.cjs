// Dev smoke test: plays a short game at level 1, resigns, and opens the review.
const { open, clickMove, run } = require('./harness.cjs');

run(async () => {
  const out = process.argv[2];
  const { browser, page, errors, goto } = await open({
    init: () => localStorage.setItem('tempo.play', JSON.stringify({ level: 1, color: 'w', coach: false, evalBar: true })),
  });
  await goto('play');
  await page.getByRole('button', { name: /Start game/ }).click();
  const play = async (uci, n) => {
    await clickMove(page, uci);
    await page.waitForFunction((n) => document.querySelectorAll('.moves button').length >= n, n, { timeout: 30000 });
    await page.waitForTimeout(400);
  };
  // Scholar's-mate attempt; level 1 often allows it. Stop after four moves either way.
  let n = 2;
  for (const uci of ['e2e4', 'f1c4', 'd1h5', 'h5f7']) {
    try {
      await play(uci, n);
      n += 2;
    } catch {
      break;
    }
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
});
