> Design spec for the UI refresh, chosen by a judged design panel. Mentions of "the scratchpad" refer to one-off helper scripts and prototype files that are not part of this repository; everything needed to build is written out below.

# Tempo Chess Gym: UI refresh build spec ("Study")

Status: FINAL. This file is the single source of truth for the UI-refresh engineers.
Direction: **"Study: walnut, paper and brass"** won the judges' vote 3–0. This spec applies the grafts the judges recommended and fixes every mustFix item. Section 20 maps each mustFix item to where it is fixed.

Prototype evidence: screenshots of the unmodified proposal are in `scratchpad/specs/warm/shots/`, and `scratchpad/specs/warm/warm-reference.css` is the original override layer. **Do not ship or import that file.** Every value you need is written out in this spec. Where this spec and the reference CSS disagree, this spec wins. It changes dark tokens, the light accent, grain scope, stitch, chips, focus, the ribbon and more.

---

## 0. What we are building (one paragraph)

The app should look like a player's study. A dark leather spine runs down the left in both themes. Content sits on cream paper cards on a warm desk (light), or on a charcoal desk at night (dark). Anything you press is polished brass. Headings and lesson prose are set in a book serif (Newsreader). UI text uses a humanist sans (Source Sans 3), and notation uses IBM Plex Mono. Ivory and ebony, the materials of the new 3D pieces, carry through into the UI: side-to-move dots, the eval bar, the eval graph and the brand mark. Wood appears **only** in the boards (board team), so the board stays the hero. Craft details are limited to: a faint page grain, a leather grain with one subtle stitched seam on the desktop sidebar, brass buttons and bars, and brass "coin" medallions for rewards. Every route, layout contract, component API and behaviour stays the same.

---

## 1. Ownership and boundaries

| Area | Owner | UI-refresh team may… |
|---|---|---|
| `src/styles/tokens.css` | **UI team** | Rewrite fully (section 4). |
| `src/styles/app.css`, `src/styles/pages.css` | **UI team** | Edit rules **in place**. No appended override layer, no new "refresh.css". |
| `src/styles/fonts.css` (new) | **UI team** | Create (section 3). |
| `index.html`, `public/manifest.webmanifest`, `src/main.tsx`, `package.json` | **UI team** | Font imports, theme-color, manifest colours only. |
| `src/App.tsx`, `src/components/ui.tsx`, `src/components/GameBits.tsx`, `src/pages/Home.tsx`, `src/pages/Puzzles.tsx`, `src/pages/Lesson.tsx` | **UI team** | Only the presentational edits listed in section 16. |
| `src/styles/board.css`, `src/styles/pieces.css`, `src/chess/Board.tsx`, `src/chess/pieces.ts`, piece sprites, board themes | **Board/pieces team** | **Do not edit.** Hand-off values are in section 14. |
| `src/kids/**`, `.kids-app` styles, any kids stylesheet | **Kids team** | **Do not edit.** Hand-off is in section 15. |
| `src/components/BoardColumn.tsx` | nobody (frozen) | Do not edit. |

If you need a board-side change (for example the promotion picker skin), write it down for the board team in the PR description. Do not edit their files.

---

## 2. Hard layout contracts (MUST NOT CHANGE)

- `.app` grid: `240px minmax(0,1fr)`. Mobile at `max-width: 900px`: one column, rows `auto minmax(0,1fr) auto`. The sidebar stays **240px**.
- The breakpoint stays **900px** everywhere.
- `.trainer`: `grid-template-columns: minmax(0,1fr) minmax(300px,380px)`, gap 28px, one column at ≤900px with gap 16px.
- `.trainer-board`: `display:flex; flex-direction:column; gap:10px; width:100%; max-width:min(100%, var(--board-fit,100%), 760px); min-width:0`. **Never add padding, border, margin or transform to `.trainer-board`, `.trainer`, `.page` or `.main`.** BoardColumn measures `offsetHeight`/`offsetWidth` and `getBoundingClientRect().top` relative to `.main`, and `.main` must remain the scroll container. Only `position: relative; isolation: isolate` and a `::before` are added (section 9.1).
- `.board-with-eval`: `14px minmax(0,1fr)`, gap 8px.
- `.page`: `max-width:1200px; padding:28px 32px 64px` (≤900px: `18px 16px 40px`). This must stay in sync with `.lesson-nav` margins `0 -32px -64px` (≤900px: `0 -16px -40px`). If you change one, change the other. (Recommendation: change neither.)
- `.panel`: `position: sticky; top: 20px`, static at ≤900px.
- **Safe areas**: `app.css` defines `--safe-t/r/b/l` (the `env(safe-area-inset-*)` values, 0 where a screen has none) and every fixed edge uses them: topbar, tabbar, `.page` and `.lesson-nav` (left and right; the `.page` and `.lesson-nav` insets stay in sync like their 32px and 16px padding), the sidebar (top, left, bottom, and its column grows by the left inset), the desktop `.page` (top, right), `.panel` sticky top, and the toasts. With all four at 0 nothing moves.
- `.lesson-nav`: `position: sticky; bottom: 0`. BoardColumn's `stickyBottom()` reads it.
- **No transforms on `.page`, `.step-wrap`, `.trainer` or any ancestor of a sticky or fixed element or of `.trainer-board`.** Page and step transitions are **opacity-only** (section 12). This also fixes an existing bug: `.step-wrap` currently runs `pop` (translateY) around the lesson board.
- `.move-input` stays hidden under `(pointer: coarse)`. The toast position stays bottom-right, and above the tabbar on mobile (`bottom: calc(76px + env(safe-area-inset-bottom))`).
- All existing class names, `role`/`aria-*` attributes, routes, nav items, labels, tab order, the profile store and all behaviour.

---

## 3. Fonts (self-hosted, latin-only)

### 3.1 Packages
Add these to `dependencies` in `package.json` (all versions checked on npm):
```
"@fontsource-variable/newsreader": "^5.3.0",
"@fontsource-variable/source-sans-3": "^5.3.0",
"@fontsource/ibm-plex-mono": "^5.3.0"
```
Bricolage Grotesque, Figtree and JetBrains Mono are removed.

### 3.2 `src/styles/fonts.css` (new; latin subset only, which bounds `build:single`)
Do **not** import the fontsource package CSS. It declares every unicode subset, and `vite-plugin-singlefile` would inline all of them. Declare only the latin files:

```css
/* Self-hosted fonts, latin subset only. Files come from the fontsource packages in node_modules. */
@font-face {
  font-family: 'Newsreader Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 200 800;
  src: url('../../node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2') format('woff2-variations');
}
@font-face {
  font-family: 'Newsreader Variable';
  font-style: italic;
  font-display: swap;
  font-weight: 200 800;
  src: url('../../node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-italic.woff2') format('woff2-variations');
}
@font-face {
  font-family: 'Source Sans 3 Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 200 900;
  src: url('../../node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2') format('woff2-variations');
}
@font-face { font-family: 'IBM Plex Mono'; font-style: normal; font-display: swap; font-weight: 400;
  src: url('../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2') format('woff2'); }
@font-face { font-family: 'IBM Plex Mono'; font-style: normal; font-display: swap; font-weight: 500;
  src: url('../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2') format('woff2'); }
@font-face { font-family: 'IBM Plex Mono'; font-style: normal; font-display: swap; font-weight: 600;
  src: url('../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2') format('woff2'); }
```
Budget (measured file sizes): Newsreader opsz upright 132 KB, opsz italic 147 KB, Source Sans 3 29 KB, Plex 400/500/600 15 KB each. That is **about 353 KB in total**, or about 470 KB as base64 in `dist-single`. There is no `unicode-range` because the files are latin-only. Characters outside the subset (for example `→`, `▲`, `▼`) fall back to the system font, which is acceptable.
If Vite does not resolve the relative `node_modules` path in your setup, use `url('@fontsource-variable/newsreader/files/…')`, which Vite resolves as a bare import. Verify in `npm run build` that the woff2 files are emitted into `dist/assets/`.

### 3.3 Wiring
- `src/main.tsx`: add `import './styles/fonts.css';` as the **first** style import, before `./styles/tokens.css`.
- `index.html`: delete both `<link rel="preconnect" …fonts…>` lines and the `fonts.googleapis.com` stylesheet `<link>`. Replace `<meta name="theme-color" content="#141d27" />` with:
  ```html
  <meta name="theme-color" content="#2b2019" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#0d0a08" media="(prefers-color-scheme: dark)" />
  ```
- `public/manifest.webmanifest`: `"theme_color": "#2b2019"`, `"background_color": "#12100e"`.
- `src/pwa/sw.template.js`: no change needed. `vite.config.ts` precaches every emitted file, woff2 files included. The Google Fonts branch becomes dead code; leave it.
- `scripts/build-artifact.mjs`: no change. `links` is simply empty. Verify that `npm run build:single` succeeds.

### 3.4 Stacks (in tokens.css)
```
--font-display: 'Newsreader Variable', 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
--font-body: 'Source Sans 3 Variable', 'Source Sans Pro', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
--font-mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
```
Newsreader has tabular figures, and Source Sans 3 digits are tabular by default. Always set `font-variant-numeric: tabular-nums lining-nums` on numerals anyway.

---

## 4. `src/styles/tokens.css` (full replacement)

Keep the file structure: light on `:root`, then dark duplicated under `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) {…} }` **and** `:root[data-theme='dark'] {…}` with identical values. Keep every existing token name. `--bg-grain` is kept as an alias for any old reference.

### 4.1 Light: "paper and leather"
```css
:root {
  color-scheme: light;
  /* desk and paper */
  --bg: #efe8dc;
  --bg-deep: #e6ddce;
  --bg-grain: #e6ddce;          /* legacy alias */
  --surface: #fbf7f0;
  --surface-2: #f4eee4;
  --surface-3: #e9e0d1;
  --surface-sunk: #ebe3d6;      /* wells: inputs, tracks, move list */
  --ink: #241c14;
  --ink-2: #5a4c3d;
  --ink-3: #6a5b4b;             /* >=4.6:1 on every light surface incl. surface-3 */
  --line: #e0d5c3;
  --line-strong: #cbbba3;
  --field-border: #8f7e66;      /* form-control boundary, >=3:1 on sunk */
  /* brass */
  --accent: #8c5e1c;            /* darker than the prototype's #92631f so button labels pass at the lightest stop */
  --accent-strong: #7a5117;
  --accent-soft: #f3e3c6;
  --accent-ink: #20160a;
  --on-accent: #fffaf0;
  --brass-hi: #d9ab5f;
  --brass-lo: #7c531a;
  /* semantic */
  --good: #35703f;  --good-soft: #e0ecd8;  --on-good: #ffffff;
  --bad: #a9432f;   --bad-soft: #f6ddd3;   --on-bad: #ffffff;
  --warn: #8a5810;  --warn-soft: #f6e6c9;
  --info: #3b6588;  --info-soft: #dfe7ee;
  --mistake: #b4561c;           /* replaces hard-coded #e07b2a */
  /* piece materials (shared with the 3D set) */
  --ivory: #f4ecdd;  --ivory-shade: #d9ccb4;
  --ebony: #1e1813;  --ebony-hi: #2a211a;
  /* leather chrome: sidebar + mobile topbar, dark in BOTH themes */
  --leather: #2b2019;
  --leather-2: #36291f;
  --leather-3: #403126;         /* hover/active fills inside leather */
  --leather-ink: #f2e7d6;
  --leather-ink-2: #cdbba3;
  --leather-ink-3: #b09c83;
  --leather-line: rgb(242 231 214 / 0.1);
  --leather-line-strong: rgb(242 231 214 / 0.2);
  --leather-accent: #e2be82;    /* focus + active marks on leather */
  --leather-accent-strong: #f0d3a0;
  --stitch: rgb(226 190 130 / 0.2);
  /* depth */
  --hl-top: inset 0 1px 0 rgb(255 255 255 / 0.65);
  --shadow-1: 0 1px 1px rgb(58 38 18 / 0.05), 0 2px 6px rgb(58 38 18 / 0.06);
  --shadow-2: 0 2px 4px rgb(58 38 18 / 0.06), 0 10px 28px rgb(58 38 18 / 0.12);
  --shadow-3: 0 4px 8px rgb(58 38 18 / 0.08), 0 22px 48px -12px rgb(58 38 18 / 0.28);
  --shadow-press: inset 0 1px 2px rgb(58 38 18 / 0.18);
  --sunk: inset 0 1px 2px rgb(58 38 18 / 0.1);
  --ring-track: #e4dac9;
  /* board ambience contract (section 14) */
  --board-shadow: 0 1px 2px rgb(58 38 18 / 0.18), 0 18px 40px -16px rgb(58 38 18 / 0.42);
  --board-shadow-mini: 0 0 0 1px rgb(0 0 0 / 0.18), 0 2px 6px rgb(40 25 10 / 0.25);
  --board-glow: rgb(217 171 95 / 0.16);
  --lamp: radial-gradient(1200px 600px at 70% -10%, color-mix(in oklab, var(--accent) 7%, transparent), transparent 70%);
  /* textures */
  --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.29 0 0 0 0 0.2 0 0 0 0 0.11 0 0 0 1.6 -0.62'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.18'/%3E%3C/svg%3E");
  --leather-grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='l'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='4' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.5 -0.55'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23l)' opacity='0.35'/%3E%3C/svg%3E");
  /* shape, motion, type */
  --radius-s: 8px;
  --radius-m: 12px;
  --radius-l: 18px;
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
  --font-display: …;  --font-body: …;  --font-mono: …;   /* section 3.4 */
}
```

### 4.2 Dark: "the study at night" (fixes mustFix "dark-mode separation")
The prototype's dark theme was espresso on espresso on espresso. This version widens the steps and neutralises the desk. The page is a near-neutral **charcoal** (low chroma), the cards are warm paper-brown and clearly lighter than the page, and the leather spine is the darkest value. A saturated walnut board then separates by both **hue** (warm board vs neutral desk) and **value**, with `--board-shadow` and `--board-glow` on top.

Relative luminance steps: leather 0.0032, desk 0.0053, surface 0.013, surface-2 0.019. The prototype had 0.0043, 0.0068 and 0.0117. The surface/desk contrast is 1.14:1, up from 1.09:1.

```css
  color-scheme: dark;
  --bg: #12100e;
  --bg-deep: #0e0c0a;
  --bg-grain: #0e0c0a;
  --surface: #231d18;
  --surface-2: #2b241e;
  --surface-3: #362d25;
  --surface-sunk: #1a1613;
  --ink: #f1e8db;
  --ink-2: #c5b7a3;
  --ink-3: #a69885;             /* >=4.7:1 on every dark surface incl. surface-3 */
  --line: #3a3028;
  --line-strong: #54473a;
  --field-border: #7a6a58;
  --accent: #d7a65b;
  --accent-strong: #ebc27f;
  --accent-soft: #3d2e1c;
  --accent-ink: #20160a;
  --on-accent: #22170a;
  --brass-hi: #f1cf8e;
  --brass-lo: #a8762f;
  --good: #93c48d;  --good-soft: #1f2c1f;  --on-good: #10180f;
  --bad: #ec8f78;   --bad-soft: #3a211b;   --on-bad: #1c0d09;
  --warn: #e8b061;  --warn-soft: #36291a;
  --info: #9dbcd8;  --info-soft: #1c2631;
  --mistake: #eb9a5c;
  --leather: #0d0a08;
  --leather-2: #17120e;
  --leather-3: #211a14;
  --leather-ink: #f1e8db;
  --leather-ink-2: #c5b7a3;
  --leather-ink-3: #958671;
  --leather-line: rgb(241 232 219 / 0.08);
  --leather-line-strong: rgb(241 232 219 / 0.16);
  --leather-accent: #e2be82;
  --leather-accent-strong: #f0d3a0;
  --stitch: rgb(215 166 91 / 0.16);
  --hl-top: inset 0 1px 0 rgb(255 236 210 / 0.05);
  --shadow-1: 0 1px 1px rgb(0 0 0 / 0.35), 0 2px 8px rgb(0 0 0 / 0.25);
  --shadow-2: 0 2px 6px rgb(0 0 0 / 0.4), 0 14px 36px rgb(0 0 0 / 0.45);
  --shadow-3: 0 4px 10px rgb(0 0 0 / 0.45), 0 28px 64px -16px rgb(0 0 0 / 0.75);
  --shadow-press: inset 0 1px 3px rgb(0 0 0 / 0.45);
  --sunk: inset 0 1px 3px rgb(0 0 0 / 0.35);
  --ring-track: #2f2720;
  --board-shadow: 0 2px 4px rgb(0 0 0 / 0.5), 0 28px 60px -18px rgb(0 0 0 / 0.85);
  --board-shadow-mini: 0 0 0 1px rgb(0 0 0 / 0.4), 0 2px 8px rgb(0 0 0 / 0.45);
  --board-glow: rgb(255 214 150 / 0.075);
  --lamp: radial-gradient(1200px 600px at 70% -10%, color-mix(in oklab, var(--accent) 6%, transparent), transparent 70%);
  --dest-dot: rgb(20 14 8 / 0.38);   /* existing override kept; see 14.3 */
  --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 0.9 0 0 0 0 0.75 0 0 0 1.6 -0.62'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E");
```
(`--ivory*`, `--ebony*`, `--leather-grain`, radii, `--ease` and fonts are inherited from `:root`.)

### 4.3 Leather token re-scope (append at the end of tokens.css)
This is the Members' Room technique. Every child of the leather chrome inherits correct colours: nav, ghost Install button, badges, bars, faint text, icon buttons, **and focus rings**. It replaces all per-element patches such as `.sidebar .btn-ghost`, which must **not** be written.
```css
.sidebar,
.topbar {
  --bg: var(--leather);
  --surface: var(--leather-3);
  --surface-2: var(--leather-3);
  --surface-3: color-mix(in oklab, var(--leather-3) 85%, var(--leather-ink));
  --surface-sunk: rgb(0 0 0 / 0.35);
  --ink: var(--leather-ink);
  --ink-2: var(--leather-ink-2);
  --ink-3: var(--leather-ink-3);
  --line: var(--leather-line);
  --line-strong: var(--leather-line-strong);
  --field-border: var(--leather-line-strong);
  --accent: var(--leather-accent);
  --accent-strong: var(--leather-accent-strong);
  --accent-soft: rgb(226 190 130 / 0.14);
  --accent-ink: #20160a;
  --on-accent: #20160a;
  --brass-hi: #f1cf8e;
  --brass-lo: #a8762f;
  --hl-top: inset 0 1px 0 rgb(255 240 220 / 0.05);
  --shadow-1: 0 1px 2px rgb(0 0 0 / 0.4);
  --sunk: inset 0 1px 2px rgb(0 0 0 / 0.45);
  --ring-track: rgb(0 0 0 / 0.35);
  color: var(--ink);
}
```
Result: the global `:focus-visible { outline: 2px solid var(--accent) }` becomes `#e2be82` on leather (9.0:1 on light leather, 11.2:1 on dark). This fixes the invisible `#92631f` on `#2b2019` (3.0:1). The topbar re-scope is harmless on desktop, where `.topbar` is `display:none`.

### 4.4 Accessibility media blocks (append at the end of tokens.css)
```css
@media (prefers-contrast: more) {
  :root, .sidebar, .topbar {
    --grain: none;
    --leather-grain: none;
    --lamp: none;
    --stitch: transparent;
    --line: var(--line-strong);
    --board-glow: transparent;
  }
  :root { --ink-3: var(--ink-2); }
}
```
(The `forced-colors` block lives in app.css, section 13.4.)

---

## 5. Base typography (`app.css` › Base)

| Selector | Treatment |
|---|---|
| `body` | `font-family: var(--font-body); font-size: 16px; line-height: 1.5; font-feature-settings: 'kern','liga'; background: var(--bg);` (was 15px/1.55; see the verification in 19.2) |
| `h1,h2,h3,h4` | `font-family: var(--font-display); font-optical-sizing: auto; font-weight: 600; letter-spacing: -0.012em; line-height: 1.15; text-wrap: balance; margin: 0;` |
| `h1` | `font-size: clamp(2rem, 1.35rem + 1.7vw, 2.8rem); letter-spacing: -0.02em; line-height: 1.05;` ≤900px: `1.9rem` |
| `h2` | `1.5rem` · `.section-head h2`: `1.45rem` |
| `h3` | `1.16rem` |
| `h1 em, h2 em` | `font-style: italic; font-weight: 500; color: var(--accent-strong);` (used by the Home greeting) |
| `p` | add `text-wrap: pretty;` |
| `.lede` | `font-size: 1.06rem; color: var(--ink-2); max-width: 62ch;` ≤900px `0.98rem` |
| `.eyebrow` | `display:inline-flex; align-items:center; gap:8px; font: 700 0.72rem/1.2 var(--font-body); letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent-strong);` plus `::before { content:''; width:18px; height:1px; background: currentColor; opacity:.7 }` |
| `.num` | **re-pointed to** `font-family: var(--font-body); font-variant-numeric: tabular-nums lining-nums;`. The audit shows `.num` is only used on counters and ratings, never on notation. |
| `.mono` | `font-family: var(--font-mono); font-variant-numeric: tabular-nums;`. Notation (`.moves`, `.line-moves`, `.demo-moves`, `.move-input input`, `.note-move`, `.import-box`, `.chart-tick`, `.evalbar-label`) **stays mono**. |
| `.stat-value` | `font-family: var(--font-display); font-weight: 600; font-size: 2rem; line-height: 1.05; letter-spacing: -0.02em; font-variant-numeric: tabular-nums lining-nums;` Keep it **after** `.num` in the cascade so it wins. |
| `.stat-label` | `font-size: 0.78rem; font-weight: 650; letter-spacing: 0.01em; color: var(--ink-2);` |
| `a` | `color: var(--accent-strong); text-underline-offset: 2px;` |
| `::selection` | `background: color-mix(in oklab, var(--accent) 35%, transparent);` |
| `.main` | add `scrollbar-color: var(--line-strong) transparent;` |

Rules: Newsreader is never used below 0.95rem (except italic ornament numerals ≥0.9rem). Italic is only used for single words or lines, never paragraphs. The serif is used for headings, big numerals, `.rich` prose and note-card prose; everything else is sans.

---

## 6. Materials, elevation and texture policy

1. **Desk (page)**: `.main { background: var(--grain), var(--lamp), var(--bg); }`. `body` keeps `background: var(--bg)`. The grain is a static 220px data-URI tile: no `background-attachment: fixed`, no overlay pseudo-element, no blend modes.
2. **Paper (raised)**: `background: var(--surface); border: 1px solid var(--line); box-shadow: var(--hl-top), var(--shadow-1);`. **No grain on cards.** This is the mustFix: grain goes only on the page and the leather.
3. **Wells (sunk)**: `background: var(--surface-sunk); box-shadow: var(--sunk);`, used for inputs, select, `.import-box`, the `.segmented` track, the `.bar` track, `.moves`, `.plan-icon`, `.hub-icon`, locked `.achievement-icon`, `.choice-letter` and `.demo-move`. Pills and chips are **not** wells.
4. **Leather (chrome)**: `.sidebar` and the mobile `.topbar` only (section 7).
5. **Brass (accent material)**: used only for primary buttons, badges, progress fills, the switch on-state, the active nav rule, the active tab rule, `.demo-move.cur` and **reward coins**.

**Elevation**: level 0 is the desk. Level 1 (`--shadow-1`) is cards, the plan ledger, tiles, level cards, swatches and chips. Level 2 (`--shadow-2`) is the trainer `.panel`, the home hero and hovered lesson cards. Level 3 (`--shadow-3`) is toasts and `.chart-tip`. Pressed is `--shadow-press` plus `translateY(1px)`.

**Radii**: `--radius-s` 8px (buttons, inputs, choices, feedback, note cards, chips), `--radius-m` 12px (cards, plan ledger, lesson cards, toasts, move list), `--radius-l` 18px (hero, trainer panel). The segmented track is 10px with 7px inner buttons. Pills and badges are 999px. The brand mark is 7px.

**Borders**: the hairline is `1px var(--line)`. Interactive paper uses `var(--line-strong)`. Hover changes the border to `color-mix(in oklab, var(--accent) 45%, var(--line-strong))`. The only thick lines are 3px: tone rules on feedback, the brass rule on note cards and `.plan-item.next`, and the active nav and tab rules.

**One flourish rule (mustFix "restrain skeuomorphism")**: the card flourish is the **brass coin**, and it is reserved for rewards: lesson-done badge, unlocked achievement icon, level/achievement toast icon. **The bookmark ribbon is dropped.** The next lesson card uses a brass border and an "Up next" accent pill instead. The stitched seam appears **once**, on the desktop sidebar, and not on the mobile topbar.

---

## 7. Shell (`app.css` › App shell)

### 7.1 Sidebar
```css
.sidebar {
  position: relative;
  display: flex; flex-direction: column; gap: 18px;
  padding: 24px 14px 18px;
  background: var(--leather-grain), linear-gradient(180deg, var(--leather-2), var(--leather) 40%);
  border-right: 0;
  box-shadow: inset -1px 0 0 rgb(0 0 0 / 0.35), 1px 0 0 rgb(255 255 255 / 0.03);
  overflow-y: auto;
  scrollbar-color: rgb(241 232 219 / 0.15) transparent;
}
.sidebar::after {            /* the one stitched seam: subtle */
  content: ''; position: absolute; top: 12px; bottom: 12px; right: 6px; width: 1px;
  background: repeating-linear-gradient(180deg, var(--stitch) 0 4px, transparent 4px 8px);
  pointer-events: none;
}
```
Note: `.sidebar` is `overflow-y: auto`, so the `::after` scrolls with the content if the nav ever overflows. That is acceptable. If it looks wrong, use `position: sticky` on a wrapper; do not add markup for it.

- `.brand`: `color: var(--ink); font: italic 600 1.6rem/1 var(--font-display); letter-spacing: -0.01em; gap: 12px; padding: 0 8px;`. `.brand small`: `font: normal 700 0.64rem var(--font-body); letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-3); margin-top: 3px;`.
- `.brand-mark`: `30px`, `border-radius: 7px`, `box-shadow: inset 0 0 0 1px rgb(255 255 255 / .18), 0 1px 2px rgb(0 0 0 / .5)`. Squares 1 and 4 are `linear-gradient(145deg, var(--brass-hi), var(--brass-lo))`. Squares 2 and 3 are `linear-gradient(145deg, var(--ivory), var(--ivory-shade))`. These are explicit, so the ivory squares show on leather in both themes. The topbar mark is 24px.
- `.nav-group-label`: `color: var(--ink-3); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; padding: 14px 12px 5px;`
- `.nav-item`: `position: relative; min-height: 38px; padding: 8px 12px; border-radius: var(--radius-s); color: var(--ink-2); font-weight: 600; font-size: 0.95rem; transition: background 140ms var(--ease), color 140ms var(--ease);`. `.icon`: `color: var(--ink-3)`.
  - `:hover`: `background: rgb(255 240 220 / 0.05); color: var(--ink);`
  - `.active`: `background: linear-gradient(90deg, rgb(215 166 91 / .2), rgb(215 166 91 / .07)); box-shadow: inset 0 0 0 1px rgb(215 166 91 / .16); color: var(--ink);`. `.icon`: `color: var(--brass-hi)`.
  - `.active::before`: `content:''; position:absolute; left:-14px; top:8px; bottom:8px; width:3px; border-radius:0 3px 3px 0; background: linear-gradient(180deg, var(--brass-hi), var(--brass-lo));`
  - Focus: the global outline, which is now leather-accent through the re-scope.
- `.badge` (global): `min-width: 18px; height: 18px; padding: 0 6px; border-radius: 999px; font: 700 0.68rem/18px var(--font-body); font-variant-numeric: tabular-nums; color: var(--accent-ink); background: linear-gradient(180deg, var(--brass-hi), var(--accent)); box-shadow: inset 0 1px 0 rgb(255 255 255 / .35);`. This is a flat brass pill, not a coin.
- `.sidebar-foot`: `border-top: 1px solid var(--line); padding: 14px 10px 0; gap: 10px; color: var(--ink-2);`. `.mini-stats` numbers use `.num` (sans tabular) at 0.95rem/650. `.mini-stats .flame { color: var(--brass-hi) }`. The level ProgressBar inside picks up the re-scoped track automatically.
- The InstallButton (ghost) needs **no override**, because it inherits `--ink-2` and `--ink` from the re-scope.

### 7.2 Kids-mode entry (UI team owns the grown-up side of the link)
The user asked for a kids mode. The grown-up shell has to link to it:
- In `App.tsx` `useNav()`, append a final group: `{ label: 'Family', items: [{ route: 'kids', label: 'Kids mode', icon: 'star' }] }`. It is a normal `.nav-item`; the only extra styling is `.nav-item[data-route='kids'] .icon { color: var(--brass-hi) }`. Add a `data-route` attribute on nav items if it does not exist yet. That attribute is the only markup change.
- Home side column (mobile has no sidebar): add a `.card.kids-card` with a `link-row` whose text is "**Kids mode** · A playful chess world for young learners" and which calls `navigate('kids')`. Styling: a normal card plus `background: radial-gradient(120% 120% at 100% 0%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 60%), var(--surface);`. Nothing kid-styled leaks into the grown-up app.
- Do not add a tab to the mobile tabbar; it stays at 5 tabs.
- If the kids team also planned an entry point, this one replaces it. The kids team does not edit `App.tsx` or `Home.tsx`.

### 7.3 Mobile topbar and tabbar (≤900px)
```css
.topbar {
  background: var(--leather-grain), var(--leather);
  border-bottom: 0;
  box-shadow: 0 1px 0 rgb(0 0 0 / 0.3), 0 4px 14px rgb(0 0 0 / 0.12);
  min-height: 54px;
  /* padding unchanged: 10px 16px, top calc(10px + env(safe-area-inset-top)) */
}
.topbar .brand { font-size: 1.35rem; padding: 0; }
.topbar .icon-btn { background: rgb(255 240 220 / 0.05); border-color: var(--line); color: var(--ink-2); }
```
There is **no stitch on the topbar**.
```css
.tabbar { background: var(--surface); border-top: 1px solid var(--line); box-shadow: 0 -6px 18px rgb(58 38 18 / 0.07); }
.tab { position: relative; min-height: 56px; padding: 9px 2px 8px; font-size: 0.7rem; font-weight: 650; color: var(--ink-3); }
.tab.active { color: var(--accent-strong); }
.tab.active::before { content:''; position:absolute; top:0; left:50%; width:28px; height:3px; margin-left:-14px;
  border-radius: 0 0 3px 3px; background: linear-gradient(90deg, var(--brass-lo), var(--brass-hi), var(--brass-lo)); }
```
The tabbar gets no grain. Dark theme: `.tabbar` uses the dark `--surface`, which is fine.

---

## 8. Controls (`app.css` › Buttons & controls)

### 8.1 Buttons (API unchanged: primary / secondary / ghost / danger; s / m / l)
```css
.btn { border-radius: var(--radius-s); font-weight: 650; letter-spacing: 0.005em;
  transition: background 140ms var(--ease), border-color 140ms var(--ease), box-shadow 140ms var(--ease), transform 80ms var(--ease); }
.btn-s { padding: 5px 11px; font-size: 0.86rem; }
.btn-m { padding: 8px 15px; font-size: 0.94rem; }
.btn-l { padding: 12px 22px; font-size: 1.02rem; }
@media (pointer: coarse) { .btn-s { min-height: 36px; } .btn-m { min-height: 42px; } .btn-l { min-height: 48px; } }
.btn:active:not(:disabled) { transform: translateY(1px); }

.btn-primary {
  color: var(--on-accent);
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--accent) 90%, var(--brass-hi)) 0%,
    var(--accent) 60%,
    color-mix(in oklab, var(--accent) 80%, var(--brass-lo)) 100%);
  border-color: color-mix(in oklab, var(--accent) 60%, var(--brass-lo));
  box-shadow: inset 0 1px 0 rgb(255 250 235 / 0.4), 0 1px 2px rgb(58 38 18 / 0.25), 0 3px 8px -2px color-mix(in oklab, var(--accent) 45%, transparent);
  text-shadow: 0 1px 0 rgb(0 0 0 / 0.12);
}
.btn-primary:hover:not(:disabled) {        /* LIGHT: hover darkens (never brightens) so the label stays >=4.5:1 */
  background: linear-gradient(180deg, var(--accent) 0%, color-mix(in oklab, var(--accent) 88%, var(--brass-lo)) 100%);
}
.btn-primary:active:not(:disabled) { box-shadow: var(--shadow-press); }
.btn-primary:focus-visible { outline-color: var(--ink); }    /* brass-on-brass focus fix */
```
Dark theme hover (both dark selector blocks, or `:root[data-theme='dark'] .btn-primary:hover…` plus the media-query equivalent): brighten instead, with `background: linear-gradient(180deg, color-mix(in oklab, var(--accent) 70%, var(--brass-hi)), var(--accent) 70%, color-mix(in oklab, var(--accent) 90%, var(--brass-lo)))`. Dark labels are `#22170a` on light brass, which is 7.4:1 or better at every stop.
**Contrast limit (light)**: the label `#fffaf0` measures 4.89:1 on the lightest stop (accent mixed 90% with brass-hi), 5.41:1 on `--accent`, and higher on the darker stops. **The top stop must never mix more than 10% brass-hi** in light mode.

- `.btn-secondary`: `background: var(--surface); border-color: var(--line-strong); color: var(--ink); box-shadow: var(--hl-top), 0 1px 1px rgb(58 38 18 / .06);`. Hover: `background: var(--surface-2); border-color: color-mix(in oklab, var(--accent) 45%, var(--line-strong));`. Active: `box-shadow: var(--shadow-press)`.
- `.btn-ghost`: `background: transparent; color: var(--ink-2)`. Hover: `background: color-mix(in oklab, var(--ink) 6%, transparent); color: var(--ink)`.
- `.btn-danger`: `background: var(--bad-soft); color: var(--bad); border-color: color-mix(in oklab, var(--bad) 30%, transparent);`
- `.icon-btn`: `width:36px; height:36px; border-radius: var(--radius-s); background: var(--surface); border: 1px solid var(--line-strong); color: var(--ink-2); box-shadow: var(--hl-top), 0 1px 1px rgb(58 38 18 / .06);`. Hover: `color: var(--ink); border-color: color-mix(in oklab, var(--accent) 45%, var(--line-strong))`. Under `(pointer: coarse)` it is `40×40`.

### 8.2 Segmented
`.segmented { background: var(--surface-sunk); box-shadow: var(--sunk); border: 0; border-radius: 10px; padding: 3px; }`
`.segmented button { border-radius: 7px; font-weight: 650; color: var(--ink-2); min-height: 30px; transition: background 140ms var(--ease), color 140ms var(--ease); }` Hover (not `.on`): `color: var(--ink)`.
`.segmented button.on { background: var(--surface); color: var(--ink); box-shadow: var(--hl-top), 0 1px 2px rgb(58 38 18 / .16), 0 0 0 1px var(--line); }` Coarse pointer: buttons have `min-height: 34px`.

### 8.3 Pills, chips and badges
- `.pill`: `padding: 2px 9px; font-size: 0.76rem; font-weight: 650; border-radius: 999px; background: var(--surface-3); color: var(--ink-2); box-shadow: inset 0 0 0 1px color-mix(in oklab, currentColor 14%, transparent);`. Tone variants (`-accent/-good/-bad/-warn/-info`) keep the `*-soft` background and tone text (`.pill-accent` uses `--accent-strong`), and pick up the ring automatically.
- `.xp-chip`: `background: var(--accent-soft); color: var(--accent-strong); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--accent) 30%, transparent); font-variant-numeric: tabular-nums;`
- `.theme-chip` (puzzle themes), the **same in both themes** (mustFix): base `background: var(--surface); border: 1px solid var(--line-strong); box-shadow: var(--hl-top); font-weight: 650; padding: 5px 12px; color: var(--ink-2); transition: background 140ms var(--ease), color 140ms var(--ease), border-color 140ms var(--ease);`. Hover: `border-color: color-mix(in oklab, var(--accent) 50%, var(--line-strong)); color: var(--ink)`. **`.on`: `background: var(--accent-soft); border-color: var(--accent); color: var(--accent-strong); box-shadow: var(--hl-top);`**. `.theme-chip.on .faint { color: var(--accent-strong); opacity: .8 }`. Coarse pointer: `min-height: 34px`.
- `.theme-picker`: add `-webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent); mask-image: …same…; padding-right: 32px;` so the overflow fades out instead of hard-clipping (the 390px screenshot clips at "Bac").

### 8.4 Progress bar and ring
- `.bar`: `height: 6px; border-radius: 999px; background: var(--surface-sunk); box-shadow: var(--sunk);`
- `.bar-fill`: `background: linear-gradient(90deg, var(--brass-lo), var(--accent) 40%, var(--brass-hi)); box-shadow: inset 0 1px 0 rgb(255 255 255 / .3); transition: width 600ms var(--ease);`
- `.bar-good .bar-fill`: `background: linear-gradient(90deg, color-mix(in oklab, var(--good) 75%, black), var(--good));`
- **Ring** (`ui.tsx`): change the track `stroke="var(--surface-3)"` to `stroke="var(--ring-track, var(--surface-3))"` and the arc transition to `stroke-dasharray 600ms cubic-bezier(0.2,0.7,0.2,1)`. The API is unchanged.

### 8.5 Switch
Track `.switch input`: `background: var(--surface-sunk); border: 1px solid var(--field-border); box-shadow: var(--sunk);`. Knob `::after`: `background: linear-gradient(180deg, #fffaf1, #e7dcc9); box-shadow: 0 1px 2px rgb(0 0 0 / .3);`. Checked: `background: linear-gradient(180deg, var(--accent), var(--brass-lo)); border-color: var(--brass-lo);`. The knob keeps its existing transform transition.

### 8.6 Inputs
`select, input[type='text'], input[type='number'], .import-box, .move-input input`:
`background: var(--surface-sunk); border: 1px solid var(--field-border); box-shadow: var(--sunk); border-radius: var(--radius-s); color: var(--ink); transition: border-color 140ms var(--ease), box-shadow 140ms var(--ease);`
`:focus-visible`: `outline: none; border-color: var(--accent); box-shadow: var(--sunk), 0 0 0 3px color-mix(in oklab, var(--accent) 28%, transparent);`
Placeholder: `color: var(--ink-3)`. `.import-box` is `font-family: var(--font-mono); font-size: 0.8rem`.

---

## 9. Scaffolding and trainer (`app.css`)

### 9.1 Board ambience (board separation; no layout properties)
```css
.trainer-board { position: relative; isolation: isolate; }   /* ONLY these two are added */
.trainer-board::before {
  content: ''; position: absolute; inset: -6% -8%; z-index: -1; pointer-events: none;
  background: radial-gradient(closest-side, var(--board-glow), transparent);
}
```
`--board-shadow` is the board team's to apply on the framed `.board` (section 14). The UI never draws a ring or border around `.board`.

### 9.2 Page header (index pages only)
`.page-header { padding-bottom: 18px; border-bottom: 1px solid var(--line); position: relative; }`
`.page-header::after { content:''; position:absolute; left:0; bottom:-1px; width:56px; height:1px; background: var(--accent); }`
`.page-header-text { gap: 8px; }`. This does **not** apply to `.lesson-top` (trainer headers), to save vertical space.

### 9.3 Cards, stats and empty states
- `.card`: paper (6.2), `border-radius: var(--radius-m); padding: 20px;`. `.card-title { margin-bottom: 14px }`.
- Clickable cards (`button.card, .opening-card, .drill-card, .hub-card, .game-row, .rating-card, .onboard-option, .level-card, .moment`): `transition: border-color 160ms var(--ease), box-shadow 160ms var(--ease);`. Hover: `border-color: var(--line-strong); box-shadow: var(--hl-top), var(--shadow-2);`. No movement (dense lists stay calm). **Only `.lesson-card` lifts** (`translateY(-2px)`).
- `.empty`: `border: 1.5px dashed var(--line-strong); background: color-mix(in oklab, var(--surface) 50%, transparent); border-radius: var(--radius-m); color: var(--ink-2);`
- `.section-head`: unchanged layout; the h2 is serif at 1.45rem.

### 9.4 Board caption and side dots
- `.board-caption`: `font-size: 0.9rem; font-weight: 650; color: var(--ink-2); min-height: 26px;` (keep min-height 26px). Right-hand counters (puzzle #, 22/23) are `.num faint`.
- `.side-dot`: `width:14px; height:14px; border: 0; box-shadow: 0 0 0 1px var(--line-strong), 0 1px 2px rgb(0 0 0 / .35);`
  - `.side-dot.w`: `background: radial-gradient(circle at 35% 30%, #fffdf7, var(--ivory) 55%, #cbb993);`
  - `.side-dot.b`: `background: radial-gradient(circle at 35% 30%, #5a4a3e, var(--ebony) 55%, #0c0907);`

### 9.5 Trainer side panel
`.panel`: paper with `border-radius: var(--radius-l); padding: 22px; box-shadow: var(--hl-top), var(--shadow-2);`. Sticky is unchanged. `.panel-divider { margin: 0 -22px; }` (≤900px: the panel padding stays 16px and the divider stays `0 -16px`). `.to-move`: `font: 600 1.3rem var(--font-display)`. `.lesson-panel h2`: `1.35rem`.

### 9.6 Eval bar (UI-owned; in app.css)
```css
.evalbar { background: linear-gradient(90deg, #120e0b, var(--ebony-hi)); border-radius: 5px;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / .3), var(--shadow-1); }
.evalbar-white { background: linear-gradient(90deg, #f7f0e1, #e3d6bd); transition: height 400ms var(--ease); }
.evalbar::after { content:''; position:absolute; left:0; right:0; top:50%; height:1px; background: rgb(128 118 104 / .6); z-index: 1; } /* midline */
.evalbar-label { font-family: var(--font-mono); font-size: 9px; font-weight: 600; }
```

### 9.7 Feedback banners (`--tone` refactor; Feedback component unchanged)
```css
.feedback { --tone: var(--accent);
  background: color-mix(in oklab, var(--tone) 9%, var(--surface));
  border: 1px solid color-mix(in oklab, var(--tone) 26%, var(--line));
  border-left: 3px solid var(--tone);
  border-radius: var(--radius-s); color: var(--tone);
  padding: 12px 14px 12px 13px; box-shadow: var(--hl-top);
  position: relative; overflow: hidden; animation: fb-in 260ms var(--ease); }
.feedback-good { --tone: var(--good); } .feedback-bad { --tone: var(--bad); }
.feedback-info { --tone: var(--info); } .feedback-warn { --tone: var(--warn); }
.feedback strong { font-weight: 700; font-size: 1rem; }
.feedback .feedback-body { color: var(--ink); } .feedback .feedback-body.faint { color: var(--ink-2); }
.feedback .mono, .feedback code { font-family: var(--font-mono); color: var(--ink); }
.feedback-good::after { content:''; position:absolute; inset:0; pointer-events:none;
  background: linear-gradient(100deg, transparent 30%, rgb(255 246 220 / .35) 50%, transparent 70%);
  transform: translateX(-100%); animation: sheen 900ms 120ms var(--ease) 1 forwards; }
```
Clickable feedback (a `<button class="feedback">`, e.g. "Play d4"): on hover `background: color-mix(in oklab, var(--tone) 14%, var(--surface))`. Measured contrast: tone text on the 9% mix is at least 4.89:1 in light and at least 6.2:1 in dark.

### 9.8 Rich prose and note cards
- `.rich`: `font-family: var(--font-display); font-optical-sizing: auto; font-size: 1.08rem; line-height: 1.6; max-width: 65ch;`. `.rich strong { font-weight: 650 }`. `.rich code, .rich .mono` stay mono: `font-family: var(--font-mono); font-size: 0.82em; background: var(--surface-3); padding: 1px 4px; border-radius: 4px;`. This keeps move notation scannable (mustFix 8).
- `.note-card` (pages.css): `background: color-mix(in oklab, var(--accent) 6%, var(--surface)); border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: var(--radius-s); padding: 14px 16px; box-shadow: var(--hl-top);`. Its body (`.rich`, `> p`, `> span:not(.note-move)`) is `font: 1.04rem/1.55 var(--font-display)`. `.note-move`: `font: 600 0.92rem var(--font-mono); color: var(--accent-strong)`.

### 9.9 Move list (score sheet) and notation
- `.moves`: well; `font: 500 0.86rem var(--font-mono); grid-template-columns: 42px 1fr 1fr; border: 1px solid var(--line); border-radius: var(--radius-s);`
- `.moves .n`: `font-family: var(--font-display); font-style: italic; color: var(--ink-3); background: transparent; border-right: 1px solid var(--line); text-align: right; padding-right: 10px;`
- `.moves button`: `border-bottom: 1px solid color-mix(in oklab, var(--line) 50%, transparent);`. Hover: `background: var(--surface-3)`.
- `.moves button.cur`: `background: var(--accent-soft); color: var(--accent-strong); box-shadow: inset 0 -2px 0 var(--accent); font-weight: 600;`
- `.line-moves` (pages.css): mono 400; `.lm` future `--ink-3`, `.lm.played` `--ink`, `.lm.cur { color: var(--accent-strong); font-weight: 600; background: var(--accent-soft); border-radius: 4px; padding: 0 4px; margin: 0 -4px; }`
- Glyphs: `.glyph-best` good, `.glyph-inaccuracy` warn, **`.glyph-mistake { color: var(--mistake) }`**, `.glyph-blunder` bad.
- `.move-input input`: the inputs recipe (8.6), `height: 34px`. The `.error` shake is unchanged (see reduced motion).

---

## 10. Toasts (`app.css`)
`.toast`: `background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-m); box-shadow: var(--hl-top), var(--shadow-3); padding: 12px 14px; animation: toast-in 280ms var(--ease);`
`.toast-icon` (accent tone) is a **brass coin**: `width:36px; height:36px; background: radial-gradient(circle at 35% 30%, var(--brass-hi), var(--accent) 60%, var(--brass-lo)); color: var(--accent-ink); box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / .25), 0 1px 2px rgb(0 0 0 / .25);`. `.toast-good .toast-icon`: `background: var(--good-soft); color: var(--good); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--good) 40%, transparent);`
`.toast-title`: `font: 600 1.05rem var(--font-display)`. `.toast-body`: `0.87rem var(--ink-2)`. Position is unchanged. Toasts also render in Kids mode (they are outside `.app`); see section 15.

---

## 11. Pages (`pages.css`)

### 11.1 Today (Home)
- **Hero** `.today-hero`: paper, `border-radius: var(--radius-l); padding: 30px 32px; background: radial-gradient(520px 260px at 100% 0%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 70%), var(--surface); box-shadow: var(--hl-top), var(--shadow-2);`. No grain. ≤700px: `padding: 24px 20px`.
- Hero ornament `.today-hero::after`: `right:-10px; top:-10px; width:260px; height:260px; background: repeating-conic-gradient(var(--accent) 0 25%, transparent 0 50%) 0 0 / 40px 40px; opacity:.09; transform:none; -webkit-mask-image: radial-gradient(circle at 100% 0%, #000 0%, transparent 70%); mask-image: (same);`
- `.today-hero h1`: `clamp(2.2rem, 1.4rem + 2.2vw, 3.2rem)`. Markup: `Good <em>afternoon</em>.` (section 16). The `<em>` is brass italic (section 5).
- `.today-stats`: on desktop `padding-left: 28px; border-left: 1px solid var(--line); align-self: stretch; align-items: center;`. When the hero wraps (≤700px): `border-left: 0; border-top: 1px solid var(--line); padding: 18px 0 0; width: 100%`. Ring: size 112 and stroke 8. The ring centre value uses `.stat-value` at 1.6rem (via class, section 16) and "/ 60 XP" uses `.stat-label` at 0.72rem.
- `.flame-icon`: `color: var(--accent)`.
- **Plan ledger** (graft): one card with hairline rows instead of five floating cards.
  ```css
  .plan { gap: 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-m);
          box-shadow: var(--hl-top), var(--shadow-1); overflow: hidden; }
  .plan-item { border: 0; border-top: 1px solid var(--line); border-radius: 0; background: transparent;
               padding: 14px 18px; position: relative; transition: background 160ms var(--ease); box-shadow: none; }
  .plan-item:first-child { border-top: 0; }
  .plan-item:hover { background: color-mix(in oklab, var(--accent) 4%, transparent); }
  .plan-item.next { background: linear-gradient(90deg, color-mix(in oklab, var(--accent) 8%, transparent), transparent 65%); }
  .plan-item.next::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background: var(--accent); }
  .plan-item.next .plan-step { border-color: var(--accent); color: var(--accent-strong); }
  ```
  `.plan-item.next`'s action button stays `secondary`. The hero already shows the brass primary for the same step, and two brass CTAs for one action is noise.
- `.plan-step`: `28px`, `font: italic 600 0.95rem var(--font-display); border: 1px solid var(--line-strong); background: var(--surface-2); box-shadow: var(--hl-top);`. Done: `background: var(--good); border-color: var(--good); color: var(--on-good);` (replaces `#fff`), and `.plan-item.done .plan-text strong` gets `text-decoration: line-through; text-decoration-color: var(--line-strong)`.
- `.plan-icon`: well, `40px`, radius 10px, `color: var(--accent-strong)`. `.plan-text strong`: `1.02rem`.
- `.review-callout, .due-banner`: `background: color-mix(in oklab, var(--warn) 10%, var(--surface)); border: 1px solid color-mix(in oklab, var(--warn) 45%, var(--line)); border-left: 3px solid var(--warn);`
- `.rating-card`: the value is `.stat-value` (serif). `.link-row` hover: the chevron moves `translateX(2px)` (160ms). The chevron is not an ancestor of anything sticky.
- `.kids-card`: section 7.2.
- Onboarding `.onboard`: paper card at level 2. `.onboard-option` gets the clickable-card hover; selected uses `.level-card.on` (section 11.5).

### 11.2 Learn
- `.unit-index`: `font: italic 500 2.8rem/1 var(--font-display); color: var(--accent);`
- `.lesson-card`: paper, `padding: 18px; border-radius: var(--radius-m); transition: border-color 160ms var(--ease), transform 160ms var(--ease), box-shadow 160ms var(--ease);`. Hover: `transform: translateY(-2px); box-shadow: var(--hl-top), var(--shadow-2); border-color: var(--line-strong);`
- `.lesson-card.next`: `border-color: color-mix(in oklab, var(--accent) 60%, var(--line)); box-shadow: var(--hl-top), var(--shadow-1), 0 0 0 1px color-mix(in oklab, var(--accent) 40%, transparent);`. **No ribbon.** `.lesson-state.accent` renders as an accent pill: `background: var(--accent-soft); color: var(--accent-strong); padding: 1px 8px; border-radius: 999px; font-weight: 650;`
- `.lesson-card.done h3`: `color: var(--ink-2)`. `.lesson-num`: `.num` `0.74rem` `--ink-3`.

### 11.3 Lesson
- `.lesson-top`: no header rule. The back `.icon-btn` is the standard 36px.
- `.lesson-title`: `font-size: clamp(1.4rem, 1.05rem + 1vw, 1.85rem)`.
- `.lesson-progress .bar`: standard.
- **`.step-wrap { animation: fade-in 200ms var(--ease); }`**. This replaces `pop` (translateY) because `.step-wrap` wraps the board column (section 2).
- `.lesson-nav`: `background: color-mix(in oklab, var(--bg) 86%, transparent); backdrop-filter: blur(10px) saturate(1.1); -webkit-backdrop-filter: (same); border-top: 1px solid var(--line);`. **Margins, padding, sticky and z-index are unchanged.**
- `.step-solo`: paper card, `padding: 26px 28px`. The `.rich` inside is serif prose (9.8).
- `.choice`: `background: var(--surface); border: 1px solid var(--line-strong); border-radius: var(--radius-s); box-shadow: var(--hl-top), 0 1px 1px rgb(58 38 18 / .05); min-height: 48px;`. Hover: `border-color: var(--accent); background: color-mix(in oklab, var(--accent) 5%, var(--surface));`. `.choice-letter`: a well tile, `font: italic 600 0.98rem var(--font-display)`. `.choice.right .choice-letter`: `background: var(--good); color: var(--on-good)`. `.choice.wrong .choice-letter`: `background: var(--bad); color: var(--on-bad)` (replaces `#fff`).
- `.demo-move`: well, `border-radius: 6px`. `.demo-move.cur`: `background: linear-gradient(180deg, var(--brass-hi), var(--accent)); color: var(--accent-ink);`
- `.lesson-done` card: paper at level 2. `.lesson-done-badge` is a **brass coin**: `background: radial-gradient(circle at 35% 30%, var(--brass-hi), var(--accent) 60%, var(--brass-lo)); color: var(--accent-ink); box-shadow: inset 0 0 0 3px rgb(255 255 255 / .2), var(--shadow-2);` (was green with `#fff`). It keeps its `pop` animation: the badge is not an ancestor of the board.

### 11.4 Puzzles
- `.rating-box`: the `.stat-value` is serif at 2.1rem. The rating value element gets `key={rating}` (section 16), so `num-roll` plays on change.
- `.delta`: `font-family: var(--font-body); font-variant-numeric: tabular-nums; font-weight: 700;`. Existing pop animation.
  `.delta.up::before { content: '▲'; content: '▲' / ''; font-size: .62em; margin-right: 3px; vertical-align: 0.1em; }`
  `.delta.down::before { content: '▼'; content: '▼' / ''; … }`. The change is then not signalled by colour alone, and screen readers read "+12".
- `.session-line`: numbers use `.num`.
- `.theme-picker` and `.theme-chip`: 8.3.
- `.rush-intro`: `background: repeating-conic-gradient(color-mix(in oklab, var(--accent) 10%, transparent) 0 25%, transparent 0 50%) 100% 0 / 36px 36px no-repeat, var(--surface);` (no grain).
- `.strike`: 24px; empty `border: 1.5px solid var(--line-strong)`; `.strike.on { background: var(--bad); color: var(--on-bad); }`.
- `.stat-value.danger`: `color: var(--bad)` (unchanged behaviour).

### 11.5 Openings, Endgames, Drill, Play
- Thumbnails: `.opening-card-board .board, .drill-board .board { box-shadow: var(--board-shadow-mini); }` (replaces `rgb(0 0 0 / .1)`). This is a UI-owned context rule in pages.css; coordinate in 14.2.
- `.drill-done`: `background: var(--good); color: var(--on-good);`
- `.due-banner`: warn recipe (11.1).
- `.level-card.on, .swatch.on`: `border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), var(--shadow-1); background: color-mix(in oklab, var(--accent) 8%, var(--surface));`
- `.level-n`: `font: italic 600 1.5rem var(--font-display); color: var(--accent-strong);`. `.level-elo`: `.num` `0.78rem` `--ink-3`.
- `.coach-tips .pill`: the standard pill.

### 11.6 Review and Games
- `.acc`, `.move-verdict`: `background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-s);`. `.acc.me`: `background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent);`. `.acc .stat-value`: serif 1.6rem.
- `.moment`: clickable-card hover. `.game-row`: clickable-card hover; `.game-row-acc .stat-value` 1.3rem.
- **Eval graph** (`GameBits.tsx`, section 16): background `var(--ebony)`, area `var(--ivory)`, mistake dots `var(--mistake)`, blunder `var(--bad)`.

### 11.7 Vision
`.coord-prompt`: `font: italic 600 3rem var(--font-display); font-variant-numeric: lining-nums;`. `.name-option`: `font: 600 1.4rem var(--font-display)`, paper and clickable-card hover, `.on`/hover `background: var(--accent-soft)`.

### 11.8 Progress
- **Tiles strip** (graft):
  ```css
  .tiles { gap: 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-m);
           box-shadow: var(--hl-top), var(--shadow-1); overflow: hidden; }
  .tile  { background: transparent; border: 0; border-radius: 0; padding: 16px 18px;
           box-shadow: 1px 0 0 var(--line), 0 1px 0 var(--line); }   /* outer edges are clipped by overflow */
  .tile .stat-value { font-size: 1.9rem; }
  ```
  The grid template stays the same. An incomplete last row shows plain surface, not stray lines.
- `.chart-tip`: `background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-s); box-shadow: var(--shadow-3);`. Values use `.num`.
- `.chart-tick`: mono 11px `--ink-3` (unchanged). Heatmap: unchanged (token-driven). `.theme-bar-track`: `height: 6px; background: var(--surface-sunk); box-shadow: var(--sunk); border-radius: 999px`. `.theme-bar-fill`: the brass gradient from 8.4.
- `.achievement` (locked): `border: 1px dashed color-mix(in oklab, var(--line-strong) 70%, transparent)`, and the icon is a well. `.achievement.on`: paper (`var(--surface)`, `--hl-top`, `--shadow-1`), and `.achievement.on .achievement-icon` is the **brass coin**: `background: radial-gradient(circle at 35% 30%, var(--brass-hi), var(--accent) 60%, var(--brass-lo)); color: var(--accent-ink); box-shadow: inset 0 0 0 2px rgb(255 255 255 / .2), 0 1px 2px rgb(0 0 0 / .25);`

### 11.9 Settings
- `.settings-section` cards: paper. `h2 { font-size: 1.3rem; padding-bottom: 12px; border-bottom: 1px solid var(--line); }`
- `.swatch`: `padding: 8px; border-radius: var(--radius-s); border: 1px solid var(--line); background: var(--surface); box-shadow: var(--hl-top); font-weight: 650; font-size: 0.8rem; color: var(--ink-2);`. `.swatch.on`: 11.5 recipe plus `color: var(--accent-strong)`.
- **`.swatch-squares`: `56px × 56px`** (was 44), `border-radius: 4px; overflow: hidden; box-shadow: 0 0 0 1px rgb(0 0 0 / .18), 0 4px 10px -6px rgb(0 0 0 / .5);`. This is large enough for the board team's wood and marble textures. Those come from their theme classes (`--sq-light`, `--sq-dark` or background-image); the UI does not define them.
- `.settings-preview`: `max-width: 300px`. The board inside uses the board team's frame and `--board-shadow`.
- `.import-box`: inputs recipe (8.6), mono.

### 11.10 Train hub
`.hub-card`: clickable card. `.hub-icon`: well, radius 10px, `color: var(--accent-strong)`.

### 11.11 Misc
`.spinner`: `border-color: var(--line-strong); border-top-color: var(--accent);`

---

## 12. Motion

One easing is used everywhere: `--ease: cubic-bezier(0.2, 0.7, 0.2, 1)`. Durations are 80ms (press), 140–160ms (hover/state), 180–280ms (enter) and 600ms (data fills). Nothing loops.

Keyframes (app.css). Replace `pop` usage as noted:
```css
@keyframes page-in { from { opacity: 0; } }
@keyframes fade-in { from { opacity: 0; } }
@keyframes fb-in   { from { opacity: 0; transform: translateY(4px) scale(0.99); } }
@keyframes toast-in{ from { opacity: 0; transform: translateY(10px); } }
@keyframes sheen   { to { transform: translateX(100%); } }
@keyframes num-roll{ from { opacity: 0; transform: translateY(30%); } }
/* keep: pop (for leaf elements only), shake, spin */
```
| Where | Animation |
|---|---|
| `.page` (keyed by route) | `animation: page-in 180ms var(--ease);` **opacity only** |
| `.step-wrap` | `fade-in 200ms`, **opacity only** (was `pop`) |
| `.feedback` | `fb-in 260ms`. This is fine because a banner is a leaf and never an ancestor of the board or of sticky elements. |
| `.feedback-good::after` | one sheen sweep (900ms, 120ms delay, once) |
| `.toast` | `toast-in 280ms` (fixed leaf) |
| rating `.stat-value` (keyed) | `num-roll 260ms var(--ease)` |
| buttons | press `translateY(1px)` for 80ms, `--shadow-press` |
| `.lesson-card:hover` | `translateY(-2px)` + shadow-2, 160ms |
| bars and ring | 600ms width / dasharray |
| nav, segmented, chips, switch | colour and background, 140ms |

Reduced motion: keep the existing global rule and **add**:
```css
@media (prefers-reduced-motion: reduce) {
  .feedback-good::after { display: none; }                       /* no sheen at all */
  .move-input.error input { animation-name: fade-in; }           /* no shake */
  .choice.wrong { animation: none; }
  .page, .step-wrap, .rating-box .stat-value { animation: none; }
  .btn:active:not(:disabled), .lesson-card:hover { transform: none; }
}
```
The board team owns all piece and square motion. The UI adds none around the board.

---

## 13. Accessibility

### 13.1 Measured contrast (WCAG 2.x; computed for these exact values)
Light, text: ink/surface 15.7; ink-2/surface 7.8; ink-3 on bg 5.4, on surface 5.7+, on surface-3 5.0, on sunk ≥4.76; accent-strong on surface 6.5, on accent-soft 5.5, on bg 5.7. Primary label `#fffaf0` on the lightest brass stop 4.89 and on `--accent` 5.41. good/bad/warn/info on their soft backgrounds 4.85 / 4.59 / 4.90 / 4.94, and on the feedback 9% mix ≥4.89. White on good 5.9, white on bad 6.0. `--mistake` on surface 4.59.
Light leather: leather-ink 13.0; leather-ink-2 8.5; leather-ink-3 6.0 on leather and 4.7 on leather-3. Focus `#e2be82` on leather 9.0.
Dark, text: ink/surface 13.7; ink-2 8.5; ink-3 on surface 5.9 and on surface-3 4.78; accent-strong on surface 10.0 and on accent-soft 7.8. Primary label `#22170a` on brass ≥7.4. good/bad/warn/info on soft 7.3 / 6.2 / 7.3 / 7.8. on-good 9.1, on-bad 7.9. mistake 7.4.
Dark leather: leather-ink 16.3; leather-ink-2 10.0; leather-ink-3 5.6 on leather and 4.85 on leather-3. Focus 11.2.
Non-text: `--field-border` is 3.09:1 (light) and 3.45:1 (dark) on the sunk fill. Focus outlines are ≥3:1 everywhere.
**Rule**: small brass text (<18px) uses `--accent-strong`, never `--accent`.

### 13.2 Focus
- Global: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }`. Inside leather this resolves to `#e2be82` via the re-scope.
- `.btn-primary:focus-visible { outline-color: var(--ink); }` in the page. Inside leather, `--ink` is leather-ink (ivory).
- Inputs: accent border plus a 3px accent ring at 28% (8.6).
- Clickable cards, chips, swatches, move-list buttons and `.feedback` buttons all use the global outline. Never write `outline: none` without a replacement.

### 13.3 Targets
Coarse pointer: `.btn-s` ≥36px, `.btn-m` ≥42px, `.btn-l` ≥48px; `.icon-btn` 40px; `.theme-chip` ≥34px; segmented buttons ≥34px; tabs 56px. Desktop nav items are ≥38px.

### 13.4 Forced colours (app.css, end of file)
```css
@media (forced-colors: active) {
  .btn-primary { border: 1px solid ButtonText; }
  .nav-item.active::before, .tab.active::before, .plan-item.next::before { background: Highlight; }
  .sidebar::after, .page-header::after { display: none; }
  .bar-fill { background: Highlight; }
  .side-dot { forced-color-adjust: none; }
}
```

### 13.5 Status is never colour-only
Feedback keeps its icon and title. Choices keep the check or cross icon and the letter tile. The delta has ▲/▼. Strikes keep their icon. The current move has weight, background and a brass underline. The active nav item has a rule, a tint and `aria-current`. A done plan step has a check and a strikethrough.

---

## 14. Board/pieces team hand-off (board.css is theirs; these are contracts and suggestions)

### 14.1 Contracts (tokens defined in tokens.css; the board team consumes them)
| Token | Use |
|---|---|
| `--board-shadow` | Outer shadow of the framed `.board` in full-size contexts (replaces the current `0 0 0 1px rgb(0 0 0 / .12), var(--shadow-2)`). It is the deepest shadow in the system. |
| `--board-shadow-mini` | The UI already applies it to thumbnails in pages.css. Frame and bevel may be disabled at mini sizes. |
| `--ivory`, `--ivory-shade`, `--ebony`, `--ebony-hi` | UI materials that match the 3D set. Tell the UI team if the sprites' final ivory/ebony differ by more than a few ΔE, and we will retune. |
| `--font-body` | Use it for `.coord` if coordinates use a font (Source Sans 3, weight 700). |

### 14.2 Shared-surface agreements
- The UI never draws a ring, border or padding around `.board`. The board's frame and bevel are the only frame.
- The UI's `.trainer-board::before` glow sits behind the board at `z-index:-1` inside `isolation:isolate`. The board team must not rely on `.trainer-board` having `overflow: hidden`.
- `--dest-dot`: the board team owns it. tokens.css keeps only the existing dark `:root` override (value updated to `rgb(20 14 8 / .38)`). Per-theme values the board team sets on `.board-{theme}` classes win automatically.
- The `.promo` scrim and `.promo-choice` are in board.css, so the UI does **not** edit them. Suggested skin to match: scrim `rgb(20 12 6 / .5)`; choice `background: var(--surface); box-shadow: var(--hl-top), var(--shadow-2), 0 0 0 1px var(--line-strong);`; hover `background: var(--accent-soft)`.

### 14.3 Suggestions only (board team decides; verify on their actual wood and marble textures)
- Last-move and selection highlights should stay distinguishable from UI brass and legible on both light and dark wood squares. A warm yellow family is suggested (for example `rgb(247 206 96 / .5)` last move and `.72` for selection). Do not use the exact UI brass `#d7a65b`, so a UI accent is never mistaken for a board state.
- Tone squares (good/bad/hint) can use `--good`, `--bad` and `--info` at about 50% alpha, so a correct move lights the board and the feedback banner in the same green.
- Arrows: keep saturated green/red/blue/yellow for legibility on wood.

---

## 15. Kids team hand-off (src/kids is theirs)

What leaks globally into `#/kids`, because KidsApp renders outside `.app` but inside the same document:
- the `body` font (Source Sans 3), size **16px**, line-height 1.5, `color: var(--ink)` and `background: var(--bg)` (paper or charcoal);
- `h1–h4` in the **Newsreader serif**, weight 600, with negative tracking;
- `p { text-wrap: pretty }`, `button { font: inherit }`, the global `:focus-visible` brass outline, `::selection`;
- `.num` is now the sans (tabular), and `.btn`, `.pill`, `.card` and so on keep the grown-up skins if the kids team reuses those classes;
- **Toasts** render in kids mode with the grown-up paper and brass skin.

What does **not** leak: grain, lamp, leather, the stitch and all shell styling. These are scoped to `.main`, `.sidebar` and `.topbar`.

The KidsApp root **must** set its own look on `.kids-app`: `font-family`, `font-size`, `line-height`, `color`, `background`, a heading font rule `.kids-app :is(h1,h2,h3,h4) { font-family: …; letter-spacing: normal; }`, and its own token values (it may redefine `--surface`, `--ink`, `--accent` and so on locally, like the leather re-scope). If the kids team wants kid-specific toasts, it can restyle `.kids-app ~ .toasts .toast` or pass a class. The UI team will not change toast markup.
The UI team does **not** add any `.kids-*` rules except `.kids-card` (the grown-up Home entry, section 7.2).

---

## 16. TSX edits (presentational only; exact list)

1. **`src/main.tsx`**: `import './styles/fonts.css';` before `./styles/tokens.css`.
2. **`src/components/ui.tsx` › `Ring`**: track `stroke="var(--ring-track, var(--surface-3))"`; arc transition `stroke-dasharray 600ms cubic-bezier(0.2,0.7,0.2,1)`. No API change.
3. **`src/pages/Home.tsx`**:
   - Greeting with italic last word: change `<h1>{greeting()}.</h1>` to
     ```tsx
     const g = greeting(); const i = g.lastIndexOf(' ');
     <h1>{g.slice(0, i + 1)}<em>{g.slice(i + 1)}</em>.</h1>
     ```
     This gives "Good *afternoon*." and "Late-night *session*.".
   - Hero Ring: `size={112} stroke={8}`. The centre value `<div className="stat-value num" style={{ fontSize: '1.5rem' }}>` becomes `className="stat-value num ring-value"` with `.ring-value { font-size: 1.6rem }` in pages.css. The "/ goal XP" line becomes `className="stat-label"` (drop the inline style).
   - Plan: add `next` to the `className` of the plan item whose object `=== nextUp` (for example `` className={`plan-item${x.done ? ' done' : ''}${x === nextUp ? ' next' : ''}`} ``). Keep the existing button variant.
   - Kids entry card in the home side column (section 7.2).
4. **`src/App.tsx`**: the "Family › Kids mode" nav group (section 7.2) and `data-route={it.route}` on nav items. Nothing else changes (the brand markup stays).
5. **`src/pages/Puzzles.tsx` › `RatingBox`**: put `key={rating}` on the rating `.stat-value` element so `num-roll` replays.
6. **`src/components/GameBits.tsx` › eval graph**: `<rect … fill="var(--ebony)" />`, `<path d={area} fill="var(--ivory)" />`, and dot fill `c === 'blunder' ? 'var(--bad)' : 'var(--mistake)'`.
7. **`src/pages/Lesson.tsx`**: no change. (`.step-wrap` animation changes in CSS.)

No other TSX changes. Do not add props, change component APIs, or touch logic, stores or routes.

---

## 17. Hard-coded colour inventory (all tokenized)

| Location | Old | New |
|---|---|---|
| app.css `.side-dot.w` | `#f4f4f1` | ivory radial (9.4) |
| app.css `.side-dot.b` | `#22262b` | ebony radial (9.4) |
| app.css `.glyph-mistake` | `#e07b2a` | `var(--mistake)` |
| app.css `.evalbar` | `#2a2e33` | `linear-gradient(90deg, #120e0b, var(--ebony-hi))` |
| app.css `.evalbar-white` | `#f1f1ec` | `linear-gradient(90deg, #f7f0e1, #e3d6bd)` |
| app.css `.brand-mark` inset | `rgb(0 0 0 / .08)` | 7.1 recipe |
| pages.css `.plan-item.done .plan-step` | `#fff` | `var(--on-good)` |
| pages.css `.choice.right .choice-letter` | `#fff` | `var(--on-good)` |
| pages.css `.choice.wrong .choice-letter` | `#fff` | `var(--on-bad)` |
| pages.css `.lesson-done-badge` | `#fff` on good | brass coin, `var(--accent-ink)` |
| pages.css `.strike.on` | `#fff` | `var(--on-bad)` |
| pages.css `.drill-done` | `#fff` | `var(--on-good)` |
| pages.css `.opening-card-board .board`, `.drill-board .board` | `rgb(0 0 0 / .1)` | `var(--board-shadow-mini)` |
| GameBits.tsx eval graph | `#2a2e33`, `#f1f1ec`, `#e07b2a` | `var(--ebony)`, `var(--ivory)`, `var(--mistake)` |
| index.html / manifest | `#141d27` | section 3.3 |

Allowed remaining literals: shadow `rgb()` alphas inside token definitions, the grain SVGs, the ivory/ebony highlight stops inside gradients (`#fffdf7`, `#cbb993`, `#5a4a3e`, `#0c0907`, `#f7f0e1`, `#e3d6bd`, `#120e0b`), the switch knob gradient, and translucent white or black sheens. After the build, run `grep -nE '#[0-9a-fA-F]{3,8}\b' src/styles/app.css src/styles/pages.css`. Every hit must be one of these.

---

## 18. What stays the same (checklist for reviewers)

- Routes, hash routing, nav items and labels (plus the one new Kids item), tab set and order, and all behaviour: plan logic, stores, sounds, engine, toast content.
- Every layout contract in section 2.
- Component APIs (`Button`, `Pill`, `Ring`, `ProgressBar`, `Feedback`, `Countdown`, `PageHeader`, …).
- `Board.tsx` DOM and classes (`.board`, `.squares`, `.sq`, `.piece`, `.dest`, `.coord`, `.shapes`, `.promo`), and the `board-{theme}` and `pieces-{set}` classes.
- `BoardColumn.tsx`.
- Toast position, `.move-input` hidden on coarse pointers, `.panel` sticky top 20px.

---

## 19. Implementation order and verification

### 19.1 Order (the app should look coherent after each step)
1. Fonts: packages, `fonts.css`, main.tsx, index.html, manifest (section 3). Run `npm run build` and confirm the woff2 files land in `dist/assets` and are listed in `dist/sw.js`.
2. `tokens.css`: full replacement, re-scope and prefers-contrast (section 4).
3. `app.css` in place: base (5), shell (7), controls (8), scaffolding and trainer (9), toasts (10), keyframes, reduced-motion and forced-colors (12, 13.4).
4. `pages.css` in place: section 11, with the hard-coded colours from section 17.
5. TSX edits (section 16).
6. Hand-off notes to the board team (14) and the kids team (15) in the PR description.

### 19.2 Verification (required before merge)
- `npm run typecheck && npm test && npm run build && npm run build:single`. Report the `dist-single/artifact.html` size and confirm the fonts are inlined (it should grow by roughly 470 KB, not several MB).
- **BoardColumn fit with the 16px body** (mustFix): at **1440×900, 1024×768 and 390×844**, in **both themes**, open: a lesson move step and a demo step (sticky `.lesson-nav`), an opening learn and drill, an endgame drill, Play in-game with the eval bar, Review, puzzles solving and solved, and Vision. For each, check that the whole board column is visible with **no page scroll** on desktop, that the board is not below `MIN_BOARD`, and that the lesson-nav spans edge to edge. Compare the board size to the baseline; a few px smaller is expected, and a scrollbar is a failure.
- Dense layouts at **900–1100px** and **390px**: the trainer panel, plan rows, move list, settings and puzzle theme chips must not wrap awkwardly. Counters in `.num` must not jitter as they change (tabular).
- **Dark mode with wood**: once the board team's textured wood and marble themes land, screenshot the opening trainer and puzzles in dark. The board frame must read clearly against `#12100e`. If it does not, raise `--board-glow` alpha (up to `.11`) before touching surfaces.
- **Keyboard focus**: Tab through the sidebar (light and dark), the mobile topbar settings button, a brass primary (hero CTA, Continue), chips, segmented controls, swatches and inputs. The ring must be visible on each.
- Forced colours (Windows High Contrast emulation in DevTools), `prefers-contrast: more` (no grain or stitch; stronger lines), and `prefers-reduced-motion` (no sheen, shake or page fade).
- Screenshots of home, learn, lesson, puzzles (solving and solved), opening, play, review, progress and settings at 1440 and 390, in light and dark. Fonts now render in headless runs because they are self-hosted.
- `#/kids` still renders (the placeholder or the kids team's build), and toasts still appear there.

---

## 20. Judges' mustFix → where it is fixed

| mustFix | Fixed in |
|---|---|
| Dark-mode separation (brown on brown); wood board vs page | 4.2 (neutral charcoal desk, wider value steps, darker leather), 9.1 glow, 14.1 `--board-shadow`, 19.2 wood check |
| Focus on leather; focus on brass buttons | 4.3 re-scope (`#e2be82` on leather), 8.1 `.btn-primary:focus-visible` ink outline, 13.2 |
| Leather via token re-scope, not per-element patches | 4.3; `.sidebar .btn-ghost` is explicitly not written (7.1) |
| Restrain skeuomorphism: stitch, grain, one flourish | 6 (grain on page and leather only; coins only; ribbon dropped), 7.1 (1px stitch at 0.16–0.2 alpha, sidebar only), 7.3 (no topbar stitch) |
| `.theme-chip.on` consistent across themes | 8.3 |
| Fold reference CSS in place; tokenize hard-coded colours | 1, 17 (inventory plus a grep check) |
| 16px body and `.num` re-point: verify fit and density | 5, 19.2 |
| Brass button label contrast at the lightest stop | 4.1 (`--accent` #8c5e1c), 8.1 (≤10% brass-hi, darkening hover in light), 13.1 |
| prefers-contrast and forced-colors | 4.4, 13.4 |
| `--mistake` token | 4.1/4.2, 9.9, 16.6 |
| Font budget / build:single / SW precache | 3.2 (latin-only, about 353 KB), 3.3, 19.2 |
| Kids-mode leakage | 15 (explicit list plus required `.kids-app` root styles) |
| Opacity-only page transition; no transforms on sticky or board ancestors; layout contracts | 2, 12 (also fixes `.step-wrap` `pop`) |
| Board ownership (board.css, highlights, `--dest-dot`, promo) | 1, 14 |
| Serif prose ≤65ch with notation in mono | 9.8 |
| Board-highlight suggestions distinguishable from UI brass | 14.3 |
| Toast and enter animations off board ancestors | 12 (fb-in and toast-in only on leaf and fixed elements) |

Grafts applied: chrome re-scope, prefers-contrast and forced-colors, ink focus on brass, plan ledger with `.next`, theme-picker fade, `--mistake`, `--board-shadow` plus board glow, eval-bar midline and mono labels, reduced-motion specifics, ▲/▼ delta, coarse-pointer heights, 56px swatches, `--ring-track`, the brass page-header segment, the greeting `<em>`, the tiles strip, ivory/ebony eval-graph fills, `num-roll` on the rating, and `text-wrap: pretty`.
Grafts deliberately not taken: the primary button on `.plan-item.next` (it would duplicate the hero's brass CTA); the segmented progress bars and outline numerals (fragile, and they hurt legibility); the sidebar width change (a layout contract).
