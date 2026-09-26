// Prints the text of specific lesson steps: npx tsx scripts/dev/show-steps.ts '[["lesson-id", stepNumber], ...]'
import { units } from '../../src/content/index.ts';
const want = JSON.parse(process.argv[2]) as [string, number][];
for (const [id, n] of want) {
  const l = units.flatMap((u) => u.lessons).find((x) => x.id === id);
  const s = l?.steps[n - 1];
  if (!s) continue;
  console.log(`\n# ${id} step ${n} [${s.kind}] ${s.title ?? ''}\n${s.text}${s.kind === 'move' ? `\nsolution: ${s.solution.join(' ')} | hint: ${s.hint}` : ''}`);
}
