// Dev helper: screenshots app routes.
// Usage: node scripts/dev/shots.cjs <outDir> [route[@width][@dark] ...]   (width defaults to 1400)
const { open, run } = require('./harness.cjs');

run(async () => {
  const [out, ...routes] = process.argv.slice(2);
  const errors = [];
  for (const spec of routes.length ? routes : ['home']) {
    const [route, w, theme] = spec.split('@');
    const width = Number(w || 1400);
    const s = await open({ width, height: width < 600 ? 860 : 900, colorScheme: theme === 'dark' ? 'dark' : 'light' });
    await s.goto(route);
    await s.page.waitForTimeout(Number(process.env.WAIT || 1500));
    const file = `${out}/${route.replace(/[/?]/g, '_') || 'home'}-${width}${theme ? '-' + theme : ''}.png`;
    await s.page.screenshot({ path: file, fullPage: process.env.FULL === '1' });
    console.log('saved', file);
    errors.push(...s.errors.map((e) => `${route}: ${e}`));
    await s.browser.close();
  }
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
});
