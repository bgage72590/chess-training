// Lists exercises in non-decisive positions where another move scores within 35 cp of the
// solution: candidates for `accept` or for sharper step wording.
import { Chess } from 'chess.js';
import { units } from '../../src/content/index.ts';
import { UciEngine } from '../lib/uci.ts';
const e = await UciEngine.create({ hashMb: 64 });
for (const u of units)
  for (const l of u.lessons)
    for (const [i, s] of l.steps.entries()) {
      if (s.kind !== 'move') continue;
      const c = new Chess(s.fen);
      const want = c.move(s.solution[0]);
      const uci = want.from + want.to + (want.promotion ?? '');
      e.newGame();
      const r = await e.analyze(s.fen, { depth: 16, multipv: 4 });
      const best = r.lines.find((x) => x.pv[0] === uci) ?? r.lines[0];
      if (best.score.mate !== undefined || Math.abs(best.score.cp ?? 0) >= 250) continue;
      const alts = r.lines.filter((x) => x.pv[0] !== uci && x.score.mate === undefined && (best.score.cp ?? 0) - (x.score.cp ?? 0) <= 35);
      if (!alts.length) continue;
      const san = (u2: string) => new Chess(s.fen).move({ from: u2.slice(0, 2), to: u2.slice(2, 4), promotion: u2[4] }).san;
      console.log(`${l.id} step ${i + 1}: solution ${want.san} (${best.score.cp}) len ${s.solution.length}; close: ${alts.map((a) => `${san(a.pv[0])} (${a.score.cp})`).join(', ')}${s.accept ? ` accept=${s.accept.join(',')}` : ''}`);
    }
e.quit();
