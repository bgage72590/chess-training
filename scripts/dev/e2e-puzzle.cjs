// Dev smoke test: solves the rated puzzle shown, checks the rating moves.
const { open, clickMove, run } = require('./harness.cjs');
const puzzles = require('../../src/data/puzzles.json');

run(async () => {
  const out = process.argv[2];
  const { browser, page, errors, goto } = await open();
  await goto('puzzles');
  await page.waitForSelector('text=/Puzzle #/');
  const label = await page.locator('text=/Puzzle #\\d+/').innerText();
  const id = 'p' + label.match(/#(\d+)/)[1].padStart(4, '0');
  const pz = puzzles.find((p) => p.id === id);
  const moves = pz.moves.split(' ');
  await page.waitForTimeout(1200); // setup move
  for (let i = 1; i < moves.length; i += 2) {
    await clickMove(page, moves[i]);
    await page.waitForTimeout(900);
  }
  await page.waitForSelector('.feedback-good', { timeout: 5000 });
  console.log(id, 'rating', pz.rating, '->', await page.locator('.feedback-good').innerText().then((t) => t.replace(/\n/g, ' | ')));
  console.log('rating box:', (await page.locator('.rating-box').innerText()).replace(/\n/g, ' '));
  await page.screenshot({ path: out });
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
});
