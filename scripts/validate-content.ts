// Validates all training content: FEN/move legality with chess.js, and chess soundness with Stockfish.
//
//   npm run validate:content                      # everything
//   npm run validate:content -- --unit tactics    # one curriculum unit (repeatable)
//   npm run validate:content -- --openings        # opening repertoire only
//   npm run validate:content -- --drills          # endgame drills only
//   npm run validate:content -- --no-engine       # legality only (fast)
//   npm run validate:content -- --depth 20        # engine depth (default 16)
//
// Exit code 1 when any ERROR is found. WARNINGS should be reviewed and fixed where possible.
import { Chess, validateFen, type Move } from 'chess.js';
import { units, openings, endgameDrills } from '../src/content/index.ts';
import type { Arrow, Mark, MoveStep, LessonStep } from '../src/content/types.ts';
import { UciEngine, scoreToCp, winPercent, type Score, type SearchOptions, type SearchResult } from './lib/uci.ts';
import { isSquare, nullMoveFen, playUci, sanToUci, uciOf } from '../src/chess/utils.ts';

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const multi = (f: string) => args.flatMap((a, i) => (a === f && args[i + 1] ? [args[i + 1]] : []));
const onlyUnits = multi('--unit');
const onlyOpenings = flag('--openings');
const onlyDrills = flag('--drills');
const anyOnly = onlyUnits.length > 0 || onlyOpenings || onlyDrills;
const useEngine = !flag('--no-engine');
const depth = Number(multi('--depth')[0] ?? 16);

let errors = 0;
let warnings = 0;
const err = (where: string, msg: string) => {
  errors++;
  console.log(`  ERROR  ${where}: ${msg}`);
};
const warn = (where: string, msg: string) => {
  warnings++;
  console.log(`  WARN   ${where}: ${msg}`);
};

/** Centipawns with any mate counted as ±10 pawns, so a slower mate is not reported as a loss. */
const openingCp = (s: Score) => (s.mate !== undefined ? (s.mate > 0 ? 1000 : -1000) : s.cp ?? 0);
const fmt = (s: Score) => (s.mate !== undefined ? `#${s.mate}` : `${((s.cp ?? 0) / 100).toFixed(2)}`);

let engine: UciEngine | null = null;
let starting: Promise<UciEngine> | null = null;
/** The one engine process, started on first use (concurrent callers share the start). */
const eng = () => (starting ??= UciEngine.create({ hashMb: 128, fresh: true }).then((e) => (engine = e)));

const cache = new Map<string, Promise<SearchResult>>();
/**
 * Engine analysis, memoised per position and options. The engine clears its hash before
 * every search, so each result is reproducible and independent of what ran before.
 */
function analyze(fen: string, o: SearchOptions): Promise<SearchResult> {
  const key = fen + JSON.stringify(o);
  let r = cache.get(key);
  if (!r) {
    r = eng().then((e) => e.analyze(fen, o));
    cache.set(key, r);
  }
  return r;
}

function checkFen(where: string, fen: string): Chess | null {
  const v = validateFen(fen);
  if (!v.ok) {
    err(where, `invalid FEN "${fen}": ${v.error}`);
    return null;
  }
  try {
    const chess = new Chess(fen);
    if (new Chess(nullMoveFen(fen), { skipValidation: true }).isCheck()) {
      err(where, `illegal position "${fen}": the side not to move is in check`);
      return null;
    }
    return chess;
  } catch (e) {
    err(where, `FEN rejected by chess.js "${fen}": ${(e as Error).message}`);
    return null;
  }
}

function checkShapes(where: string, arrows?: Arrow[], marks?: Mark[]) {
  for (const a of arrows ?? []) {
    if (!isSquare(a.from) || !isSquare(a.to)) err(where, `bad arrow ${a.from}->${a.to}`);
  }
  for (const m of marks ?? []) if (!isSquare(m.square)) err(where, `bad mark ${m.square}`);
}

function playSan(where: string, chess: Chess, san: string): Move | null {
  try {
    return chess.move(san);
  } catch {
    err(where, `illegal move "${san}" in ${chess.fen()} (legal: ${chess.moves().join(' ')})`);
    return null;
  }
}

/** Score of one specific move (from the mover's perspective). */
async function scoreOfMove(fen: string, uci: string, known: { pv: string[]; score: Score }[]): Promise<Score> {
  const hit = known.find((l) => l.pv[0] === uci);
  if (hit) return hit.score;
  const r = await analyze(fen, { depth, searchmoves: [uci] });
  return r.lines[0]?.score ?? { cp: 0 };
}

async function checkMoveStep(where: string, step: MoveStep) {
  const chess = checkFen(where, step.fen);
  if (!chess) return;
  if (!step.solution.length) return err(where, 'empty solution');
  if (step.solution.length % 2 === 0) err(where, 'solution must start and end with the learner move (odd length)');
  if (step.accept?.length && step.solution.length !== 1) err(where, '`accept` is only allowed for one-move solutions');
  if (!step.hint?.trim()) err(where, 'missing hint');
  if (!step.success?.trim()) err(where, 'missing success text');

  // accept alternatives must be legal
  for (const alt of step.accept ?? []) playSan(where + ' accept', new Chess(step.fen), alt);

  for (let i = 0; i < step.solution.length; i++) {
    const fen = chess.fen();
    const learner = i % 2 === 0;
    const san = step.solution[i];
    const mv = playSan(`${where} solution[${i}]`, chess, san);
    if (!mv) return;
    if (!useEngine) continue;
    if (mv.san !== san && mv.lan !== san) warn(where, `write "${mv.san}" instead of "${san}" (canonical SAN)`);
    const r = await analyze(fen, { depth, multipv: 3 });
    const best = r.lines[0];
    if (!best) continue;
    const played = await scoreOfMove(fen, uciOf(mv), r.lines);
    const loss = winPercent(best.score) - winPercent(played);
    const isMate = chess.isCheckmate();
    if (learner) {
      if (loss > 10 && !isMate) {
        err(where, `solution[${i}] ${san} (${fmt(played)}) is clearly worse than engine best ${best.pv[0]} (${fmt(best.score)})`);
      }
      // Ambiguity: another move nearly as good in a decisive position.
      if (winPercent(played) >= 70 || (played.mate ?? 0) > 0) {
        const accepted = [uciOf(mv), ...(i === 0 ? (step.accept ?? []).map((a) => sanToUci(fen, a) ?? '') : [])];
        for (const l of r.lines) {
          const altMove = playUci(fen, l.pv[0])?.move;
          if (accepted.includes(l.pv[0])) continue;
          // The lesson page accepts any mate, so another mate is only fine when the solution
          // mates too; a mate the solution misses is worth a warning.
          if (isMate && altMove?.san.endsWith('#')) continue;
          const close =
            (played.mate !== undefined && played.mate > 0 && l.score.mate !== undefined && l.score.mate > 0 && l.score.mate <= played.mate) ||
            winPercent(l.score) >= winPercent(played) - 4;
          if (close) {
            warn(where, `solution[${i}] ${san} (${fmt(played)}) is not unique: ${altMove?.san ?? l.pv[0]} scores ${fmt(l.score)}. Add it to accept (one-move steps), or adjust the position.`);
          }
        }
      }
    } else if (loss > 15) {
      warn(where, `reply solution[${i}] ${san} (${fmt(played)}) is a weak defence; engine prefers ${best.pv[0]} (${fmt(best.score)})`);
    }
  }
}

async function checkStep(where: string, step: LessonStep) {
  checkShapes(where, step.arrows, step.marks);
  if (!step.text?.trim()) err(where, 'missing text');
  switch (step.kind) {
    case 'read':
      if (step.fen) checkFen(where, step.fen);
      if (step.lastMove && !step.lastMove.every(isSquare)) err(where, 'bad lastMove');
      break;
    case 'quiz': {
      if (step.fen) checkFen(where, step.fen);
      const correct = step.choices.filter((c) => c.correct).length;
      if (correct !== 1) err(where, `quiz must have exactly 1 correct choice (has ${correct})`);
      if (step.choices.length < 2) err(where, 'quiz needs at least 2 choices');
      for (const c of step.choices) if (!c.why?.trim()) err(where, `choice "${c.text}" missing why`);
      break;
    }
    case 'demo': {
      const chess = checkFen(where, step.fen);
      if (!chess) break;
      for (const [i, san] of step.moves.entries()) if (!playSan(`${where} moves[${i}]`, chess, san)) break;
      if ((step.notes?.length ?? 0) > step.moves.length) err(where, 'more notes than moves');
      break;
    }
    case 'move':
      try {
        await checkMoveStep(where, step);
      } catch (e) {
        err(where, `engine failed: ${(e as Error).message}`);
      }
      break;
    default:
      err(where, `unknown step kind ${(step as { kind: string }).kind}`);
  }
}

async function main() {
  const ids = new Map<string, string>();
  const claim = (id: string, where: string) => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) err(where, `id "${id}" must be kebab-case`);
    if (ids.has(id)) err(where, `duplicate id "${id}" (also ${ids.get(id)})`);
    ids.set(id, where);
  };

  // Always check ids globally.
  for (const u of units) {
    claim(u.id, `unit ${u.id}`);
    for (const l of u.lessons) claim(l.id, `lesson ${l.id}`);
  }
  for (const o of openings) {
    claim(o.id, `opening ${o.id}`);
    for (const l of o.lines) claim(l.id, `line ${l.id}`);
  }
  for (const d of endgameDrills) claim(d.id, `drill ${d.id}`);

  if (!anyOnly || onlyUnits.length) {
    for (const u of units) {
      if (onlyUnits.length && !onlyUnits.includes(u.id)) continue;
      console.log(`\nUnit: ${u.title} (${u.lessons.length} lessons)`);
      if (!u.lessons.length) warn(`unit ${u.id}`, 'no lessons');
      for (const l of u.lessons) {
        if (!l.steps.length) err(`lesson ${l.id}`, 'no steps');
        if (!l.steps.some((s) => s.kind === 'move' || s.kind === 'quiz')) warn(`lesson ${l.id}`, 'no interactive steps');
        for (const [i, s] of l.steps.entries()) await checkStep(`${l.id} step ${i + 1} (${s.kind})`, s);
      }
    }
  }

  if (!anyOnly || onlyOpenings) {
    console.log(`\nOpenings (${openings.length})`);
    for (const o of openings) {
      for (const line of o.lines) {
        const where = `${o.id}/${line.id}`;
        const chess = new Chess();
        const sans = line.moves.trim().split(/\s+/);
        if (/\d/.test(line.moves.replace(/[a-h][1-8]/g, ''))) err(where, 'moves must not contain move numbers');
        for (const k of Object.keys(line.notes)) {
          const n = Number(k);
          if (!Number.isInteger(n) || n < 1 || n > sans.length) err(where, `note key ${k} outside 1..${sans.length}`);
        }
        const learnerParity = o.side === 'white' ? 1 : 0;
        for (const [i, san] of sans.entries()) {
          const ply = i + 1;
          const fen = chess.fen();
          const mv = playSan(`${where} ply ${ply}`, chess, san);
          if (!mv) break;
          if (mv.san !== san) warn(where, `ply ${ply}: write "${mv.san}" instead of "${san}"`);
          if (ply % 2 === learnerParity && !line.notes[ply]) warn(where, `ply ${ply} (${san}) is a learner move without a note`);
          if (!useEngine) continue;
          const r = await analyze(fen, { depth: Math.min(depth, 14), multipv: 1 });
          const best = r.lines[0];
          if (!best || best.pv[0] === uciOf(mv)) continue;
          const played = await scoreOfMove(fen, uciOf(mv), r.lines);
          const bestCp = openingCp(best.score);
          const playedCp = openingCp(played);
          if (bestCp - playedCp > 90) {
            warn(where, `ply ${ply} ${san} loses ${((bestCp - playedCp) / 100).toFixed(2)} vs engine ${best.pv[0]} (${fmt(best.score)})`);
          }
        }
      }
    }
  }

  if (!anyOnly || onlyDrills) {
    console.log(`\nEndgame drills (${endgameDrills.length})`);
    for (const d of endgameDrills) {
      const where = `drill ${d.id}`;
      const chess = checkFen(where, d.fen);
      if (!chess) continue;
      if (chess.isGameOver()) err(where, 'position is already game over');
      if (d.tips.length < 2) warn(where, 'add at least two tips');
      if (!useEngine) continue;
      const r = await analyze(d.fen, { depth: Math.max(depth, 20) });
      const s = r.lines[0]?.score ?? { cp: 0 };
      const cp = scoreToCp(s);
      if (d.goal === 'win' && cp < 400) err(where, `goal win but engine eval is ${fmt(s)}`);
      if (d.goal === 'promote' && cp < 250) err(where, `goal promote but engine eval is ${fmt(s)}`);
      if (d.goal === 'draw' && (cp < -120 || cp > 250)) err(where, `goal draw but engine eval is ${fmt(s)} for the learner`);
      console.log(`  ok     ${d.id}: ${fmt(s)} (${d.goal})`);
    }
  }

  engine?.quit();
  console.log(`\n${errors} error(s), ${warnings} warning(s)`);
  process.exit(errors ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  engine?.quit();
  process.exit(1);
});
