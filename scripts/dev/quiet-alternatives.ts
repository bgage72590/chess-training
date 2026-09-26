// Lists exercises in non-decisive positions where another move scores within 35 cp of the
// solution: candidates for `accept` or for sharper step wording.
import { units } from '../../src/content/index.ts';
import { UciEngine } from '../lib/uci.ts';
import { pvToSan, sanToUci } from '../../src/chess/utils.ts';
const e = await UciEngine.create({ hashMb: 64, fresh: true });
for (const u of units)
  for (const l of u.lessons)
    for (const [i, s] of l.steps.entries()) {
      if (s.kind !== 'move') continue;
      const uci = sanToUci(s.fen, s.solution[0])!;
      const r = await e.analyze(s.fen, { depth: 16, multipv: 4 });
      const best = r.lines.find((x) => x.pv[0] === uci) ?? r.lines[0];
      if (best.score.mate !== undefined || Math.abs(best.score.cp ?? 0) >= 250) continue;
      const alts = r.lines.filter((x) => x.pv[0] !== uci && x.score.mate === undefined && (best.score.cp ?? 0) - (x.score.cp ?? 0) <= 35);
      if (!alts.length) continue;
      const san = (u2: string) => pvToSan(s.fen, [u2])[0];
      console.log(`${l.id} step ${i + 1}: solution ${san(uci)} (${best.score.cp}) len ${s.solution.length}; close: ${alts.map((a) => `${san(a.pv[0])} (${a.score.cp})`).join(', ')}${s.accept ? ` accept=${s.accept.join(',')}` : ''}`);
    }
e.quit();
