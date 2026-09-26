// Dev helper: screenshots app routes with the globally installed Playwright.
// Usage: node scripts/dev/shots.cjs <outDir> [route[@w] ...]   (w = viewport width, default 1400)
const { chromium } = (() => { try { return require('playwright'); } catch { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); } })();
(async () => {
  const [out, ...routes] = process.argv.slice(2);
  const browser = await chromium.launch();
  const errors = [];
  for (const spec of routes.length ? routes : ['home']) {
    const [route, w, theme] = spec.split('@');
    const width = Number(w || 1400);
    const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 860 : 900 }, colorScheme: theme === 'dark' ? 'dark' : 'light', deviceScaleFactor: 1, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${route}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${route}: console: ${m.text()}`); });
    await page.addInitScript(() => {
      if (!localStorage.getItem('tempo.profile.v1') && !location.hash.includes('fresh')) {
        localStorage.setItem('tempo.profile.v1', JSON.stringify({ v: 1, onboarded: true, xp: 0 }));
      }
    });
    await page.goto(`http://localhost:4173/#/${route}`);
    await page.waitForTimeout(Number(process.env.WAIT || 1500));
    const file = `${out}/${route.replace(/[/?]/g, '_') || 'home'}-${width}${theme ? '-' + theme : ''}.png`;
    await page.screenshot({ path: file, fullPage: process.env.FULL === '1' });
    console.log('saved', file);
    await ctx.close();
  }
  await browser.close();
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
})();
