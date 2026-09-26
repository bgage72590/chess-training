// Prints a few puzzles per rating band in SAN, to eyeball whether difficulty ordering is sensible.
import { Chess, type PieceSymbol } from 'chess.js';
import puzzles from '../../src/data/puzzles.json';
const bands = new Map<number, typeof puzzles>();
for (const p of puzzles) {
  const b = Math.floor(p.rating / 300) * 300;
  if (!bands.has(b)) bands.set(b, []);
  bands.get(b)!.push(p);
}
for (const [b, list] of [...bands.entries()].sort((x, y) => x[0] - y[0])) {
  console.log(`\n== ${b}-${b + 299} (${list.length})`);
  for (const p of list.sort(() => Math.random() - 0.5).slice(0, 4)) {
    const c = new Chess(p.fen);
    const san = p.moves.split(' ').map((u) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] as PieceSymbol | undefined }).san);
    console.log(`${p.rating}  ${san[0]} | ${san.slice(1).join(' ')}  [${p.themes.join(',')}]`);
  }
}
