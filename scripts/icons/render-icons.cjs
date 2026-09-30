// Renders the app icon set into public/icons with Chromium (Playwright):
//   icon.svg (favicon), icon-192.png, icon-512.png (rounded tile), maskable-512.png and
//   apple-touch-icon.png (full-bleed squares that the OS masks itself), and for the native apps
//   native/icons/app-1024.png (the same full-bleed square at 1024 px, opaque: App Store Connect wants no
//   transparency; `npx tauri icon` and the iOS icon set are made from it, see native/README.md).
// Usage: node scripts/icons/render-icons.cjs
const fs = require('fs');
const path = require('path');
const { launch } = require('../dev/harness.cjs');

const out = path.join(__dirname, '../../public/icons');
const nativeOut = path.join(__dirname, '../../native/icons');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(nativeOut, { recursive: true });

// The cburnett white knight (Colin M.L. Burnett; GPLv2+ / GFDL / BSD) as drawn on the board, 45x45 units.
const KNIGHT = `<g fill="none" fill-rule="evenodd" stroke="#141d27" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#fff"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#fff"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="#141d27"/></g>`;

/** The brand mark (brass/navy 2x2 checker) with the knight centred on it. */
function icon({ rounded, knightScale }) {
  // The knight's drawing spans roughly x 8..38 and y 10..39 of its 45-unit box.
  const tx = 256 - 23 * knightScale + 6;
  const ty = 256 - 24.5 * knightScale;
  const tile = rounded ? '<clipPath id="r"><rect width="512" height="512" rx="112"/></clipPath>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>${tile}<filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.35"/></filter></defs>
<g${rounded ? ' clip-path="url(#r)"' : ''}><rect width="512" height="512" fill="#141d27"/><rect width="256" height="256" fill="#c8923a"/><rect x="256" y="256" width="256" height="256" fill="#c8923a"/></g>
<g filter="url(#s)"><g transform="translate(${tx} ${ty}) scale(${knightScale})">${KNIGHT}</g></g>
</svg>`;
}

(async () => {
  const any = icon({ rounded: true, knightScale: 8.4 });
  // Maskable icons are cropped to a circle as small as 80% of the width: keep the knight inside it.
  const maskable = icon({ rounded: false, knightScale: 7.2 });
  fs.writeFileSync(path.join(out, 'icon.svg'), any);
  const browser = await launch();
  const page = await browser.newPage();
  const png = async (svg, size, file, dir = out) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    await page.screenshot({ path: path.join(dir, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  await png(any, 192, 'icon-192.png');
  await png(any, 512, 'icon-512.png');
  await png(maskable, 512, 'maskable-512.png');
  await png(maskable, 180, 'apple-touch-icon.png');
  await png(maskable, 1024, 'app-1024.png', nativeOut);
  await browser.close();
  console.log('icons written to', path.relative(process.cwd(), out));
})();
