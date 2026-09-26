// Prints the most recently mined raw puzzles in SAN, to check the generator's output.
import fs from 'node:fs';
import { pvToSan } from '../../src/chess/utils.ts';
const raw = new URL('../puzzles/out/raw.jsonl', import.meta.url);
const lines = fs.readFileSync(raw, 'utf8').trim().split('\n');
for (const l of lines.slice(-8)) {
  const r = JSON.parse(l);
  const sans = pvToSan(r.fen, r.moves, r.moves.length);
  console.log(r.fen, '|', sans.join(' '), '|', r.themes.join(','), '| mate', r.mate, 'stable', r.stableDepth, 'second', r.secondWin);
}
