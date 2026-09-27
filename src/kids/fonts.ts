// Kids fonts, self-hosted from npm and loaded only by the Kids chunk: Fredoka (variable, display,
// buttons, numbers) and Andika 400/700 (SIL's literacy font: body, captions and bubbles).
// Only the latin subsets (woff2) are used, so the single-file build stays small.
import fredokaLatin from '@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2?url';
import andika400 from '@fontsource/andika/files/andika-latin-400-normal.woff2?url';
import andika700 from '@fontsource/andika/files/andika-latin-700-normal.woff2?url';

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';

const css = `
@font-face { font-family: 'Fredoka Variable'; font-style: normal; font-display: swap; font-weight: 300 700; src: url(${fredokaLatin}) format('woff2-variations'), url(${fredokaLatin}) format('woff2'); unicode-range: ${LATIN}; }
@font-face { font-family: 'Andika'; font-style: normal; font-display: swap; font-weight: 400; src: url(${andika400}) format('woff2'); unicode-range: ${LATIN}; }
@font-face { font-family: 'Andika'; font-style: normal; font-display: swap; font-weight: 700; src: url(${andika700}) format('woff2'); unicode-range: ${LATIN}; }
`;

if (typeof document !== 'undefined' && !document.getElementById('kids-fonts')) {
  const style = document.createElement('style');
  style.id = 'kids-fonts';
  style.textContent = css;
  document.head.appendChild(style);
}
