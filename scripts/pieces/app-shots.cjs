#!/usr/bin/env node
// In-app review screenshots of the staunton3d piece set: the puzzle board on three board themes,
// light and dark, desktop and mobile, plus a selected piece, a drag in progress, the promotion
// picker and the settings preview. Build and serve the app first (see scripts/dev/README.md).
//   BASE=http://localhost:4181/ node scripts/pieces/app-shots.cjs OUT_DIR lessons.json
// lessons.json comes from `npx tsx scripts/dev/dump-lessons.ts` (used to reach a promotion).
const fs = require('node:fs');
const path = require('node:path');
const { launch, open, squareCenter, run } = require('../dev/harness.cjs');

const out = process.argv[2] || '/tmp/pieces-shots';
const lessonsFile = process.argv[3];
fs.mkdirSync(out, { recursive: true });

const profile = (boardTheme, pieceSet = 'staunton3d') =>
  `localStorage.setItem('tempo.profile.v1', ${JSON.stringify(JSON.stringify({ v: 1, onboarded: true, xp: 0, settings: { sound: false, boardTheme, pieceSet } }))});`;

/** Clicks the player's pieces until one is selected with legal destinations; returns its square. */
async function selectSomePiece(page) {
  const squares = await page.$$eval('.board .sq[data-square]', (els) =>
    els.map((e) => ({ sq: e.dataset.square, top: e.getBoundingClientRect().top })).sort((a, b) => b.top - a.top),
  );
  for (const { sq } of squares) {
    const p = await squareCenter(page, sq);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(60);
    if ((await page.locator('.board .sq.selected').count()) && (await page.locator('.board .dest').count())) return sq;
  }
  return null;
}

async function reachPromotion(page, goto, lessons) {
  const lesson = lessons.flatMap((u) => u.lessons).find((l) => l.steps.some((s) => s.solution && s.solution[0] === 'e8=Q#'));
  await goto('lesson/' + lesson.id);
  await page.waitForSelector('.lesson-nav');
  for (const s of lesson.steps) {
    if (s.solution && s.solution[0] === 'e8=Q#') break;
    if (s.kind === 'demo') for (let k = 0; k < s.moves.length; k++) await page.keyboard.press('ArrowRight');
    else if (s.kind === 'quiz') await page.locator('.choice').nth(s.choices.findIndex((c) => c.correct)).click();
    else if (s.kind === 'move') {
      for (let k = 0; k < s.solution.length; k += 2) {
        await page.waitForSelector('#lesson-move:not([disabled])', { timeout: 4000 });
        await page.locator('#lesson-move').fill(s.solution[k]);
        await page.locator('#lesson-move').press('Enter');
        if (k + 2 < s.solution.length) await page.waitForTimeout(700);
      }
      await page.waitForSelector('.lesson-panel .feedback-good', { timeout: 4000 });
    }
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll('.lesson-nav button')].pop();
      return b && !b.disabled;
    });
    await page.locator('.lesson-nav .btn-primary, .lesson-nav .btn-secondary').last().click();
  }
  await page.waitForTimeout(400);
  for (const sq of ['e7', 'e8']) {
    const p = await squareCenter(page, sq);
    await page.mouse.click(p.x, p.y);
  }
  await page.waitForSelector('.promo-choice');
  await page.waitForTimeout(300);
}

run(async () => {
  const browser = await launch();
  const shots = [];
  const shot = async (page, name) => {
    const file = path.join(out, `${name}.png`);
    await page.screenshot({ path: file });
    shots.push(file);
  };
  const views = [
    ['desktop', 1440, 900],
    ['mobile', 390, 844],
  ];
  for (const theme of ['slate', 'walnut', 'tourney'])
    for (const scheme of ['light', 'dark'])
      for (const [view, width, height] of views) {
        const { page, goto, close, errors } = await open({ browser, width, height, colorScheme: scheme, init: profile(theme) });
        await goto('puzzles');
        await page.waitForSelector('.board .piece');
        await page.waitForTimeout(900);
        await shot(page, `puzzles-${theme}-${scheme}-${view}`);
        if (theme === 'slate' || theme === 'walnut') {
          const sq = await selectSomePiece(page);
          await shot(page, `selected-${theme}-${scheme}-${view}`);
          if (sq) {
            const a = await squareCenter(page, sq);
            await page.mouse.move(a.x, a.y);
            await page.mouse.down();
            await page.mouse.move(a.x + 40, a.y - 70, { steps: 6 });
            await page.waitForTimeout(150);
            await shot(page, `drag-${theme}-${scheme}-${view}`);
            await page.mouse.up();
          }
        }
        if (errors.length) console.log('page errors', theme, scheme, view, errors.slice(0, 3));
        await close();
      }
  if (lessonsFile) {
    const lessons = JSON.parse(fs.readFileSync(lessonsFile, 'utf8'));
    for (const [view, width, height] of views)
      for (const [theme, scheme] of [
        ['tourney', 'light'],
        ['slate', 'dark'],
      ]) {
        const { page, goto, close } = await open({ browser, width, height, colorScheme: scheme, init: profile(theme) });
        await reachPromotion(page, goto, lessons);
        await shot(page, `promotion-${theme}-${scheme}-${view}`);
        await close();
      }
  }
  for (const scheme of ['light', 'dark']) {
    const { page, goto, close } = await open({ browser, width: 1440, height: 900, colorScheme: scheme, init: profile('walnut') });
    await goto('settings');
    await page.waitForSelector('.board .piece');
    await page.waitForTimeout(500);
    await shot(page, `settings-walnut-${scheme}-desktop`);
    await close();
  }
  await browser.close();
  console.log(shots.join('\n'));
});
