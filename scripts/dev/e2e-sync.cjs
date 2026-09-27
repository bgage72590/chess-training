// Dev end-to-end test for cross-device sync, with two browser profiles as two devices.
// Build with the local mock backend, serve it, then run:
//   node scripts/dev/mock-sync-server.cjs 4300 &
//   VITE_SYNC_URL=http://localhost:4300 VITE_SYNC_KEY=dev npm run build && npx vite preview --port 4173 &
//   node scripts/dev/e2e-sync.cjs
const { launch, open, run } = require('./harness.cjs');

/** An init script (as source text) that gives a device its own starting progress, once. */
const seed = (lessons, xp, day) => `(() => {
  if (localStorage.getItem('e2e-seeded')) return;
  localStorage.setItem('e2e-seeded', '1');
  const lessons = ${JSON.stringify(lessons)};
  const done = Object.fromEntries(lessons.map((id) => [id, { done: true, t: Date.now(), score: 1 }]));
  const day = { xp: ${xp}, puzzles: 0, lessons: lessons.length, lines: 0, drills: 0, games: 0, vision: 0 };
  localStorage.setItem('tempo.profile.v1', JSON.stringify({ v: 1, onboarded: true, xp: ${xp}, lessons: done, days: ${xp} ? { '${day}': day } : {}, settings: { sound: false }, updatedAt: Date.now() }));
})()`;
const lessonsOf = (page) => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('tempo.profile.v1')).lessons).sort());
const xpOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tempo.profile.v1')).xp);

run(async () => {
  const browser = await launch();
  // Two devices = two isolated browser contexts with different progress.
  const phone = await open({ browser, width: 390, height: 844, init: seed(['found-pieces'], 40, '2026-09-20') });
  const laptop = await open({ browser, init: seed(['found-pieces', 'mate-back-rank'], 70, '2026-09-21') });

  await phone.goto('settings');
  await phone.page.getByRole('button', { name: 'Turn on sync' }).click();
  await phone.page.waitForSelector('text=/Last synced/', { timeout: 10000 });
  const code = (await phone.page.locator('.sync-code').first().innerText()).trim();
  console.log('phone code:', code, '| QR drawn:', await phone.page.locator('svg.sync-qr path').count());

  await laptop.goto(`sync/${code}`);
  await laptop.page.getByRole('button', { name: 'Link this device' }).click();
  await laptop.page.waitForFunction(() => location.hash.startsWith('#/home'), null, { timeout: 10000 });
  await laptop.page.waitForTimeout(500);
  console.log('laptop after linking:', await lessonsOf(laptop.page), 'xp', await xpOf(laptop.page));

  // The phone picks up the laptop's lesson on its next sync (returning to the app).
  await phone.page.reload();
  await phone.page.waitForTimeout(1500);
  console.log('phone after sync:', await lessonsOf(phone.page), 'xp', await xpOf(phone.page));

  // Joining with a typed code (lower case, no dashes) from a third device.
  const tablet = await open({ browser, init: seed([], 0, '2026-09-22') });
  await tablet.goto('settings');
  await tablet.page.getByRole('button', { name: 'I have a sync code' }).click();
  await tablet.page.fill('#sync-code', code.replace(/-/g, '').toLowerCase());
  await tablet.page.getByRole('button', { name: 'Link this device' }).click();
  await tablet.page.waitForSelector('text=/Last synced/', { timeout: 10000 });
  await tablet.page.waitForTimeout(500); // local saves are debounced
  console.log('tablet after typing the code:', await lessonsOf(tablet.page), 'xp', await xpOf(tablet.page));
  await tablet.page.screenshot({ path: process.argv[2] || '/tmp/sync.png', fullPage: false });

  const errors = [...phone.errors, ...laptop.errors, ...tablet.errors];
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
});
