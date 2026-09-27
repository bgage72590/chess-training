// Screenshots of the board lab (scripts/boards/lab) for design review: every theme, light and
// dark app palette, with a selected piece showing its targets and one board mid-drag.
//
//   npx vite --port 4183 &   then   node scripts/boards/shots.cjs <outDir> [width] [cols] [themes] [pieceSet]
const path = require('node:path');
const fs = require('node:fs');
const { open, run } = require('../dev/harness.cjs');

const LAB = process.env.LAB || 'http://localhost:4183/scripts/boards/lab/index.html';
const [outDir = '/tmp/boards', width = '1440', cols = '4', only = '', pieces = ''] = process.argv.slice(2);

run(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const scheme of ['light', 'dark']) {
    const { page, errors, close } = await open({ width: Number(width), height: 900, colorScheme: scheme });
    await page.goto(`${LAB}?theme=${scheme}&cols=${cols}${only ? `&only=${only}` : ''}${pieces ? `&pieces=${pieces}` : ''}`);
    await page.waitForSelector('.board .piece');
    // Select the knight named by data-select on every "selected" board (f3: dark-square targets
    // and a capture; c3: light-square targets), and check that it really is selected.
    const cells = page.locator('.lab-select');
    for (let i = 0; i < (await cells.count()); i++) {
      const cell = cells.nth(i);
      const from = await cell.getAttribute('data-select');
      await cell.scrollIntoViewIfNeeded();
      await page.waitForTimeout(50);
      const b = await cell.locator(`[data-square="${from}"]`).boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await cell.locator(`.sq.selected[data-square="${from}"]`).waitFor({ timeout: 2000 });
      const n = await cell.locator('.dest').count();
      if (!n) throw new Error(`no targets shown for ${from} on board ${i}`);
    }
    await page.mouse.move(0, 0);
    const boards = page.locator('.lab-select[data-select="f3"] .board');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000); // let the check pulse finish
    const tag = `${width}${only ? '-' + only.replace(/,/g, '-') : ''}${pieces ? '-' + pieces : ''}`;
    const file = path.join(outDir, `lab-${scheme}-${tag}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
    // Mid-drag on the first "selected" board: bishop c4 held over f7 (a capture).
    const first = boards.first();
    await first.scrollIntoViewIfNeeded();
    const box = await first.boundingBox();
    const a = await first.locator('[data-square="c4"]').boundingBox();
    const t = await first.locator('[data-square="f7"]').boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2 + 4, { steps: 8 });
    await page.waitForTimeout(100);
    const drag = path.join(outDir, `drag-${scheme}-${tag}.png`);
    await page.screenshot({ path: drag, clip: { x: box.x - 20, y: box.y - 20, width: box.width + 40, height: box.height + 40 } });
    await page.mouse.up();
    console.log(drag);
    if (errors.length) console.log('ERRORS', errors);
    await close();
  }
});
