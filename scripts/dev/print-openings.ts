// Prints every opening line with move numbers, for human review of the repertoire.
import { openings } from '../../src/content/index.ts';
import { moveNumberLabel } from '../../src/chess/utils.ts';
const side = process.argv[2];
for (const o of openings.filter((x) => !side || x.side === side)) {
  console.log(`\n## ${o.name} (${o.eco}, ${o.side})`);
  for (const l of o.lines) {
    const m = l.moves.split(' ');
    console.log(`- ${l.name}: ${m.map((s, i) => (i % 2 === 0 ? moveNumberLabel(i) + s : s)).join(' ')}`);
  }
}
