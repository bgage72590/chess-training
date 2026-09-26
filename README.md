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

`.github/workflows/pages.yml` publishes `dist/` to GitHub Pages on every push to `main`. Enable it once under **Settings → Pages → Source: GitHub Actions**. The engine is single-threaded WASM, so no special cross-origin headers are needed.

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
  lib/          Rating (Glicko), spaced repetition, game analysis, achievements
scripts/        Content validator, puzzle generator/builder, engine copy, single-page build
tests/          Vitest suites
```

## Credits and licences

- Engine: [Stockfish](https://stockfishchess.org) 19 via [stockfish.js](https://github.com/nmrugg/stockfish.js), GPLv3. The engine files are copied from the `stockfish` npm package at install time; its licence ships alongside as `engine/COPYING-stockfish.txt`.
- Rules and move generation: [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause).
- Pieces: "cburnett" set by Colin M.L. Burnett (GPLv2+ / GFDL / BSD), as distributed with lichess chessground.
- Fonts: Bricolage Grotesque, Figtree, JetBrains Mono (Google Fonts, OFL).
