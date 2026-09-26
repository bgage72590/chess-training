// Prints a few puzzles per rating band in SAN, to eyeball whether difficulty ordering is sensible.
import puzzles from '../../src/data/puzzles.json';
import { pvToSan } from '../../src/chess/utils.ts';
const bands = new Map<number, typeof puzzles>();
for (const p of puzzles) {
  const b = Math.floor(p.rating / 300) * 300;
  if (!bands.has(b)) bands.set(b, []);
  bands.get(b)!.push(p);
}
for (const [b, list] of [...bands.entries()].sort((x, y) => x[0] - y[0])) {
  console.log(`\n== ${b}-${b + 299} (${list.length})`);
  for (const p of list.sort(() => Math.random() - 0.5).slice(0, 4)) {
    const moves = p.moves.split(' ');
    const san = pvToSan(p.fen, moves, moves.length);
    console.log(`${p.rating}  ${san[0]} | ${san.slice(1).join(' ')}  [${p.themes.join(',')}]`);
  }
}
