# Dev helpers

Smoke tests that drive the built app in Chromium with Playwright. Build first and serve it:

```bash
npm run build && npx vite preview --port 4173 --strictPort &
node scripts/dev/e2e-play.cjs /tmp/play.png      # plays two moves vs Stockfish (BLOCK_WASM=1 tests the backup engine)
node scripts/dev/e2e-puzzle.cjs /tmp/puzzle.png  # solves the rated puzzle shown
node scripts/dev/e2e-review.cjs /tmp/review.png  # plays, resigns, opens the game review
node scripts/dev/shots.cjs /tmp/shots home learn puzzles@390@dark   # route[@width][@dark]
npx tsx scripts/dev/dump-lessons.ts > /tmp/lessons.json
node scripts/dev/e2e-lessons.cjs /tmp/lessons.json [unitId]   # plays through every lesson
npx tsx scripts/dev/show-puzzles.ts              # prints the latest generated puzzles in SAN
```

They share `harness.cjs` (browser launch, seeded profile, square clicks by `data-square`). They need the
`playwright` package (or `PLAYWRIGHT_PATH` pointing at an install) and a Chromium build. `BASE` overrides
the app URL (default `http://localhost:4173/`).
