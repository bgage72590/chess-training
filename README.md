# Tempo: a chess gym

Tempo is an interactive chess training system that takes an adult learner from the rules to strong club play. It runs entirely in the browser: no account, no server, progress saved locally.

It trains the four things that separate strong players from casual ones:

| Skill | How Tempo trains it |
|---|---|
| **Pattern recognition** | Rated tactics puzzles that adapt to you (Glicko rating), theme practice, Puzzle Rush, and spaced review of every puzzle you miss. |
| **Calculation & safety** | A "how to think" unit (checks-captures-threats, blunder check, candidate moves), a find-every-check scanner, and coached games that warn you before a mistake. |
| **Opening understanding** | Repertoire chapters for White and Black. Learn each line with the reason behind every move, then drill it from memory on a spaced-repetition schedule. |
| **Endgame technique** | Lessons on the essential theory, then drills against full-strength Stockfish: mate with K+Q, K+R, B+N; win or hold Lucena, Philidor, opposition and more. |

## What's inside

**By the numbers:** 44 lessons (394 steps, including 147 find-the-move exercises and 59 quizzes), 12 opening chapters with 46 annotated lines, 24 endgame drills, and an engine-verified puzzle set, all validated with Stockfish.

- **Today**: a daily plan (warm-up, 10 puzzles, next lesson, opening review, a game or drill), XP goal ring, streak and level.
- **Learn**: seven units in coaching order: Foundations, Checkmate Patterns, Tactical Motifs, Opening Principles, How to Think, Endgame Technique, Strategy & Planning. Lessons mix explanation, guided demos, quizzes and "find the move" exercises.
- **Puzzles**: engine-verified puzzles with a unique solution, tagged by theme (fork, pin, skewer, discovered attack, mate in N, sacrifice…). Rated mode, theme filters, Rush (3 minutes, 3 strikes) and a Review queue.
- **Openings**: Italian, Ruy Lopez, Alapin vs the Sicilian, French and Caro-Kann Advance, Queen's Gambit and London for White; 1…e5, Caro-Kann, Najdorf, QGD and King's Indian for Black.
- **Endgames**: drills played out against Stockfish with win / promote / hold-the-draw goals, hints and take-backs.
- **Play the Coach**: ten levels from ~400 to full Stockfish. Coach mode warns about mistakes before the engine replies, shows threats and suggests moves.
- **Game Reviews**: every game analysed move by move: accuracy, inaccuracies/mistakes/blunders, an evaluation graph, and "retry this move" on your own errors.
- **Board Vision**: coordinate sprints, knight routes and a find-every-check drill.
- **Progress**: rating chart, training heatmap, per-theme strengths, achievements. Export/import progress from Settings.

## Install it as an app

Tempo is an installable web app: once installed it has its own icon, opens in its own window
and works offline, full-strength Stockfish included. Open
**https://bgage72590.github.io/chess-training/** and:

| Device | How |
|---|---|
| Chrome or Edge (Windows, Mac, Linux, ChromeOS) | Click **Install Tempo** in Settings, or the install icon at the right of the address bar. Tempo appears in the Start menu / Applications folder / dock. |
| Safari on Mac | **File → Add to Dock**. This needs Safari 17 on **macOS 14 Sonoma or later**; on an older Mac use Chrome or Edge. |
| iPhone | In Safari, **Share** (on newer iOS it may sit under the **…** menu) → **Add to Home Screen** → **Add**, then open Tempo from the new icon. |
| iPad | The same steps as iPhone. |
| Chrome or Edge on iPhone / iPad | From iOS 16.4 they can add to the Home Screen too (their Share menu → **Add to Home Screen**). |
| A page opened inside another app (Instagram, Facebook, Messenger, Snapchat, Line, Google, X) | Open the page in Safari first (**Open in Safari** in that app's menu): those built-in browsers cannot install web apps. Tempo says so when it detects one. |
| Android | Chrome menu → **Install app** / **Add to Home screen** |

On iPhone, iPad and Mac Safari Tempo shows these steps itself: a banner on the Today page and in
Kids mode's grown-ups area after the first finished lesson or puzzle (**Hide this** keeps it away),
and always under **Settings → Install the app**. Chrome and Edge keep their own **Install** button.

Right-click (or long-press) the icon for shortcuts to Puzzles, Play and Learn. The app updates
itself the next time it is opened online.

### Moving your progress

On iPhone, iPad and Mac Safari, **the Safari tab and the installed Home Screen (or Dock) app keep
separate data**, so the installed app starts empty. Before you install, turn on sync (**Settings →
Sync across devices → Turn on sync**) or export your progress (Settings → Your data; Kids mode has a
separate **Export kids data** in its Grown-ups area). Then open the installed app and
choose **I have a sync code** (Settings → Sync across devices) and type the code. A sync link or QR
code opens in Safari, not in the installed app, so linking by link would link the browser copy
only. Chrome and Edge share their data between the browser and the installed app.

### Handing Tempo to someone else

**Settings → Share Tempo** (and the grown-ups area in Kids mode) shows a QR code for the app's
address, a **Copy link** button and the device's share sheet. It always shares the app's own
address, never the page you are on: the address of a sync page holds your private sync code.

### Choosing the address

The address behind the QR code, the Copy link button and the install pages is `APP_URL`
(`src/pwa/install.ts`). It defaults to the GitHub Pages address above; build with
`VITE_APP_URL=https://your.address/ npm run build` to publish somewhere else (for the GitHub Pages
deploy, put `env: VITE_APP_URL: https://your.address/` on the build step in
`.github/workflows/pages.yml`). **Choose the
permanent address before you share Tempo widely.** An installed copy is identified by its address
(the manifest `id` is the address), so moving the site orphans every installed copy, and a GitHub
Pages address that changes returns a 404 page to them. A custom domain (a `CNAME` for GitHub Pages)
is the durable choice, and it does not carry your username. If the address ever has to change, leave a
redirect page at the old one.

## Sync across devices

No account needed. In **Settings → Sync across devices**, tap **Turn on sync** to get a private
sync code (with a QR code and a link). On your other phones, tablets and computers, scan the QR
code, open the link, or type the code under **I have a sync code** (for an installed iPhone, iPad
or Mac Safari app, always type it: see [Moving your progress](#moving-your-progress)). Progress from every linked
device is combined, never overwritten: lessons, puzzles, openings, games, streaks and XP made on
any of them add up, and settings follow the device where they were changed last. Syncing happens
in the background a few seconds after you train, when you come back to the app, and when a
device comes back online.

The code works like a password: anyone who has it can see and change that progress. **Stop
syncing on this device** keeps the device's progress but unlinks it; **Delete synced copy**
removes the stored copy for all devices. Export / Import in Settings still works for a manual
backup.

Synced copies live in a Supabase database (`docs/sync.sql`) that only exposes three functions;
each copy is stored under a hash of its code, which is 100 random bits and cannot be guessed or
listed.

## Kids mode

**Kids mode** (in the sidebar, or Settings) is a separate, playful course for ages 4-12: Pip the
pony guides each child through eight worlds, from how each piece moves to checkmates, tactics and
full games against seven buddy bots, with stickers, a playground of mini-games, and a placement
check so older or experienced kids skip what they know. Each child gets a profile; the grown-ups
area (behind a simple parent check or a PIN) has progress reports, session limits, read-aloud and
sound settings, and can lock the device to Kids mode.

Pip speaks in one of eight recorded voices (Sunny, Breezy, Sparkle, Honey, Pepper, Willow, Bella
and Rocket), chosen per child in the grown-ups area, where tapping a voice plays a sample. Every
fixed line, and every version of lines with a few known values (pieces, squares, numbers, buddy
and world names), is recorded, so Pip sounds the same on every device; a line made up on the spot
is said sentence by sentence from recordings where possible, and otherwise by the device's most
natural voice. The voices are listed in `scripts/voice/voices.json`. To record after changing the
Kids copy (Google Cloud Text-to-Speech, key in `GOOGLE_TTS_API_KEY` or added to requests by the
environment; Kokoro also works, locally), see `scripts/voice/render.py`:

```
npx tsx scripts/voice/collect.ts > /tmp/lines.json
python3 scripts/voice/render.py /tmp/lines.json --id sunny            # once per voice
python3 scripts/voice/try_voices.py /tmp/try --engine google Leda Puck   # audition voices
```
## Getting started

```bash
npm install        # also copies the Stockfish WASM build into public/engine
npm run dev        # http://localhost:5173
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run build` | Production build into `dist/` (static; host anywhere) |
| `npm run build:single` | Single-page build into `dist-single/` (JS/CSS inlined; engine as sibling files) |
| `npm test` | Unit tests plus integrity checks over every puzzle, lesson, opening line and drill |
| `npm run typecheck` | TypeScript project check |
| `npm run validate:content` | Checks all content with chess.js **and Stockfish**: legal positions, unique solutions, sound opening moves, drill evaluations |
| `npm run puzzles:generate -- --workers 3 --minutes 60` | Mines new puzzles from Stockfish self-play (add `--hard` for deeper ones) |
| `npm run puzzles:build` | Rates, balances and writes `src/data/puzzles.json` |

### Deploying

`.github/workflows/pages.yml` publishes `dist/` to GitHub Pages on every push to the default branch. Enable it once under **Settings → Pages → Source: GitHub Actions**. The engine is single-threaded WASM, so no special cross-origin headers are needed.

The normal build is the installable app: `public/manifest.webmanifest`, the icons in `public/icons/` (regenerate with `node scripts/icons/render-icons.cjs`), and `sw.js`, a service worker written at build time from `src/pwa/sw.template.js` that precaches every built file for offline use.

## How the content is made trustworthy

- **Lessons, openings and drills** live in typed TypeScript files under `src/content/`. `npm run validate:content` replays every move with chess.js and asks Stockfish whether each exercise has one clearly best answer, whether opponent replies are the best defence, whether any opening move is a mistake, and whether each endgame drill is actually won or drawn as claimed.
- **Puzzles** are mined from thousands of Stockfish self-play games between deliberately fallible players. A position becomes a puzzle only if, at every step, a deeper search finds exactly one decisive move and the line ends in mate or clearly won material. Themes are tagged automatically; difficulty is estimated from line length, quiet moves, sacrifices and the depth at which the engine finds the key move, then calibrated by your results.

## Project layout

```
src/
  chess/        Board component (drag/click, animation, arrows, promotion), sounds, helpers
  engine/       Stockfish worker client + pure-JS backup engine for browsers that block WASM
  content/      Curriculum units, opening repertoire, endgame drills (typed data)
  data/         Generated puzzle set
  pages/        One file per screen
  store/        Profile: XP, streaks, ratings, spaced repetition (localStorage)
  lib/          Rating (Glicko), spaced repetition, game analysis, achievements, hooks
  pwa/          Install prompt, service worker registration and template
  sync/         Cross-device sync: sync codes, profile merge, sync engine, Supabase client
public/         Stockfish (copied at install), app icons, web app manifest
scripts/        Content validator, puzzle generator/builder, engine copy, single-page build
tests/          Vitest suites
```

## Credits and licences

- Engine: [Stockfish](https://stockfishchess.org) 19 via [stockfish.js](https://github.com/nmrugg/stockfish.js), GPLv3. The engine files are copied from the `stockfish` npm package at install time; its licence ships alongside as `engine/COPYING-stockfish.txt`. Sources: [official-stockfish/Stockfish](https://github.com/official-stockfish/Stockfish), [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js) and this app, [bgage72590/chess-training](https://github.com/bgage72590/chess-training). Settings → Credits links all of them.
- Rules and move generation: [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause).
- Pieces: "cburnett" set by Colin M.L. Burnett (GPLv2+ / GFDL / BSD), as distributed with lichess chessground. The app icon uses its knight. The 3D Staunton set and the walnut and marble boards are rendered for this app by `scripts/pieces` and `scripts/boards`.
- Fonts (self-hosted via Fontsource, OFL): Newsreader, Source Sans 3 and IBM Plex Mono; Fredoka and Andika in Kids mode.
- Pip's voice: recorded with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0), voice `af_heart`, via [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (MIT), or with Google Cloud Text-to-Speech.
