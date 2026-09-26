import { Chess } from 'chess.js';
import fs from 'node:fs';
const lines = fs.readFileSync('/home/user/chess-training/scripts/puzzles/out/raw.jsonl', 'utf8').trim().split('\n');
for (const l of lines.slice(-8)) {
  const r = JSON.parse(l);
  const c = new Chess(r.fen);
  const sans = r.moves.map((u: string) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san);
  console.log(r.fen, '|', sans.join(' '), '|', r.themes.join(','), '| mate', r.mate, 'stable', r.stableDepth, 'second', r.secondWin);
}
