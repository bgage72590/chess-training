const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:4901/bake.html' + (process.argv[2] ? '?only=' + process.argv[2] : ''), { timeout: 180000, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__bake, null, { timeout: 600000 });
  const r = await p.evaluate(() => window.__bake);
  if (r.error) { console.log(r.error); process.exit(1); }
  fs.writeFileSync(__dirname + '/pieces-baked.json', JSON.stringify(r));
  for (const [t, v] of Object.entries(r)) console.log(t, 'tris', v.before, '->', v.after, 'verts', v.verts, 'err', v.err.toFixed(5), 'bytes', v.pos.length + v.nrm.length + v.cav.length + v.idx.length);
  console.log('total base64 KB', Math.round(fs.statSync(__dirname + '/pieces-baked.json').size / 1024));
  await b.close();
})();
