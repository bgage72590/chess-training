// Screenshots of the board lab (scripts/boards/lab) for design review: every theme, light and
// dark app palette, with a selected piece showing its targets and one board mid-drag.
//
//   npx vite --port 4183 &   then   node scripts/boards/shots.cjs <outDir> [width] [cols]
const path = require('node:path');
const fs = require('node:fs');
const { open, run } = require('../dev/harness.cjs');

const LAB = process.env.LAB || 'http://localhost:4183/scripts/boards/lab/index.html';
const [outDir = '/tmp/boards', width = '1440', cols = '3', only = ''] = process.argv.slice(2);

run(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const scheme of ['light', 'dark']) {
    const { page, errors, close } = await open({ width: Number(width), height: 900, colorScheme: scheme });
    await page.goto(`${LAB}?theme=${scheme}&cols=${cols}${only ? `&only=${only}` : ''}`);
    await page.waitForSelector('.board .piece');
    // Select a knight on every "selected" board: its targets include a capture.
    const boards = page.locator('.lab-select .board');
    for (let i = 0; i < (await boards.count()); i++) {
      await boards.nth(i).scrollIntoViewIfNeeded();
      const b = await boards.nth(i).locator('[data-square="f3"]').boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000); // let the check pulse finish
    const file = path.join(outDir, `lab-${scheme}-${width}${only ? '-' + only.replace(/,/g, '-') : ''}.png`);
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
    const drag = path.join(outDir, `drag-${scheme}-${width}.png`);
    await page.screenshot({ path: drag, clip: { x: box.x - 20, y: box.y - 20, width: box.width + 40, height: box.height + 40 } });
    await page.mouse.up();
    console.log(drag);
    if (errors.length) console.log('ERRORS', errors);
    await close();
  }
});
