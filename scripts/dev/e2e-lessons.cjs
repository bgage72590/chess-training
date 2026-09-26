// Plays through every lesson in the browser: continues read steps, steps through demos,
// picks the correct quiz answer, and types each exercise solution into the move box.
// Usage: npx tsx scripts/dev/dump-lessons.ts > /tmp/lessons.json && node scripts/dev/e2e-lessons.cjs /tmp/lessons.json [unitId]
const { chromium } = (() => { try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); } })();
const fs = require('fs');
(async () => {
  const units = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const only = process.argv[3];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('tempo.profile.v1', JSON.stringify({ v: 1, onboarded: true, xp: 0, settings: { sound: false } })));
  const base = process.env.BASE || 'http://localhost:4173/';
  let ok = 0, bad = 0;
  for (const u of units) {
    if (only && u.id !== only) continue;
    for (const l of u.lessons) {
      await page.goto(base + '#/lesson/' + l.id);
      await page.waitForSelector('.lesson-nav');
      let failed = null;
      for (const [i, s] of l.steps.entries()) {
        try {
          if (s.kind === 'demo') {
            for (let k = 0; k < s.moves.length; k++) await page.keyboard.press('ArrowRight');
          } else if (s.kind === 'quiz') {
            const idx = s.choices.findIndex((c) => c.correct);
            await page.locator('.choice').nth(idx).click();
          } else if (s.kind === 'move') {
            for (let k = 0; k < s.solution.length; k += 2) {
              await page.waitForSelector('#lesson-move:not([disabled])', { timeout: 4000 });
              await page.locator('#lesson-move').fill(s.solution[k]);
              await page.locator('#lesson-move').press('Enter');
              if (k + 2 < s.solution.length) await page.waitForTimeout(700);
            }
            await page.waitForSelector('.lesson-panel .feedback-good', { timeout: 4000 });
          }
          const btn = page.locator('.lesson-nav .btn-primary, .lesson-nav .btn-secondary').last();
          await page.waitForFunction(() => { const b = [...document.querySelectorAll('.lesson-nav button')].pop(); return b && !b.disabled; }, null, { timeout: 4000 });
          await btn.click();
        } catch (e) {
          failed = `step ${i + 1} (${s.kind}): ${e.message.split('\n')[0]}`;
          break;
        }
      }
      if (!failed) {
        try { await page.waitForSelector('.lesson-done', { timeout: 4000 }); } catch { failed = 'did not reach the completion screen'; }
      }
      if (failed) { bad++; console.log(`FAIL ${l.id}: ${failed}`); await page.screenshot({ path: `/tmp/lesson-fail-${l.id}.png` }); }
      else ok++;
    }
  }
  console.log(`${ok} lessons completed, ${bad} failed`);
  if (errors.length) console.log('PAGE ERRORS', [...new Set(errors)].slice(0, 10));
  await browser.close();
})();
