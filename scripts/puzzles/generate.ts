// Mines tactical puzzles from Stockfish self-play games.
//
//   npx tsx scripts/puzzles/generate.ts --workers 3 --minutes 60
//
// Each game is played by two "players" with a random search depth and a random
// softmax temperature over the engine's top moves, so they make human-like mistakes.
// When a move throws away the evaluation, the position after it becomes a puzzle
// candidate. A candidate is kept only if, at every solver move, a deeper search finds
// exactly one decisive move, and the line ends in mate or in a clear material gain.
// Results are appended to scripts/puzzles/out/raw.jsonl (run build.ts afterwards).
import { Chess, type PieceSymbol } from 'chess.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UciEngine, winPercent, type Score } from '../lib/uci.ts';
import { materialDiff, tagPuzzle } from './tagger.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k: string, d: number) => {
  const i = args.indexOf(k);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const WORKERS = opt('--workers', 3);
const MINUTES = opt('--minutes', 60);
const DEPTH = opt('--depth', 16);
// Hard mode: stronger players make subtler mistakes; keep only multi-move or deep puzzles.
const HARD = args.includes('--hard');
const PLAYER_MIN = opt('--player-min', HARD ? 5 : 1);
const PLAYER_MAX = opt('--player-max', HARD ? 10 : 6);
const OUT = path.join(here, 'out', 'raw.jsonl');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const rndInt = (a: number, b: number) => Math.floor(rnd(a, b + 1));
const cp = (s: Score) => (s.mate !== undefined ? (s.mate > 0 ? 3000 - s.mate : -3000 - s.mate) : s.cp ?? 0);
const toMove = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as PieceSymbol | undefined });

interface Ply {
  fen: string;
  move: string;
  best: Score;
  played: Score;
}

async function playGame(e: UciEngine): Promise<Ply[]> {
  e.newGame();
  const chess = new Chess();
  const plies: Ply[] = [];
  const style = {
    w: { depth: rndInt(PLAYER_MIN, PLAYER_MAX), temp: rnd(30, 220) },
    b: { depth: rndInt(PLAYER_MIN, PLAYER_MAX), temp: rnd(30, 220) },
  };
  const openingPlies = rndInt(4, 12);
  let lopsided = 0;
  while (!chess.isGameOver() && plies.length < 180) {
    const fen = chess.fen();
    const st = style[chess.turn()];
    const r = await e.analyze(fen, { depth: st.depth, multipv: 6 });
    const lines = r.lines.filter((l) => l.pv.length);
    if (!lines.length) break;
    const best = lines[0];
    let pick = best;
    if (plies.length < openingPlies) {
      const ok = lines.filter((l) => cp(l.score) >= cp(best.score) - 40);
      pick = ok[rndInt(0, ok.length - 1)];
    } else {
      const w = lines.map((l) => Math.exp((cp(l.score) - cp(best.score)) / st.temp));
      let x = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < lines.length; i++) {
        x -= w[i];
        if (x <= 0) {
          pick = lines[i];
          break;
        }
      }
    }
    plies.push({ fen, move: pick.pv[0], best: best.score, played: pick.score });
    chess.move(toMove(pick.pv[0]));
    lopsided = Math.abs(cp(best.score)) > 800 ? lopsided + 1 : 0;
    if (lopsided >= 6) break;
  }
  return plies;
}

interface Built {
  solution: string[];
  mate: number | null;
  stableDepth: number;
  secondWin: number;
  /** Engine continuation after the last solver move (shown as the explanation). */
  cont: string[];
}

function decisive(s: Score) {
  return (s.mate !== undefined && s.mate > 0) || (s.cp ?? 0) >= 280;
}

const reasons: Record<string, number> = {};
const reject = (r: string) => {
  reasons[r] = (reasons[r] ?? 0) + 1;
  return null;
};

async function buildLine(e: UciEngine, fen: string): Promise<Built | null> {
  const chess = new Chess(fen);
  const solver = chess.turn();
  const startMat = materialDiff(chess, solver);
  const solution: string[] = [];
  let mate: number | null = null;
  let stableDepth = 0;
  let secondWin = 0;
  for (let step = 0; step < 5; step++) {
    const r = await e.analyze(chess.fen(), { depth: DEPTH, multipv: 2 });
    const [best, second] = r.lines;
    if (!best?.pv.length) return reject('no-pv');
    if (step === 0) {
      if (!decisive(best.score)) return reject('not-decisive');
      mate = best.score.mate !== undefined && best.score.mate > 0 ? best.score.mate : null;
      // Depth from which the engine's choice never changed again.
      stableDepth = DEPTH;
      for (let d = DEPTH; d >= 1; d--) {
        if (r.depthMoves[d] === undefined) continue;
        if (r.depthMoves[d] !== best.pv[0]) break;
        stableDepth = d;
      }
      secondWin = second ? winPercent(second.score) : 0;
    }
    const mateLine = mate !== null;
    const lastMateMove = mateLine && best.score.mate === 1;
    if (second && !lastMateMove) {
      const unique = mateLine
        ? !(second.score.mate !== undefined && second.score.mate > 0)
        : winPercent(second.score) <= Math.min(64, winPercent(best.score) - 18);
      if (!unique) {
        if (step === 0) return reject('not-unique-first');
        // Several ways to finish, but the position is crushing: end on the previous solver move.
        if (winPercent(best.score) >= 85 && solution.length >= 2) {
          const reply = solution.pop()!;
          return { solution, mate: null, stableDepth, secondWin, cont: [reply, ...best.pv.slice(0, 4)] };
        }
        return reject('not-unique-later');
      }
    }
    if (mateLine && best.score.mate === undefined) return reject('lost-mate'); // lost the mate thread
    solution.push(best.pv[0]);
    chess.move(toMove(best.pv[0]));
    if (chess.isCheckmate()) return { solution, mate, stableDepth, secondWin, cont: [] };
    if (chess.isGameOver()) return reject('game-over');
    if (mateLine && step >= 4) return reject('mate-too-long');
    // Opponent's best reply.
    const rr = await e.analyze(chess.fen(), { depth: Math.max(10, DEPTH - 4) });
    const reply = rr.bestmove;
    if (!reply || reply === '(none)') return reject('no-reply');
    const probe = new Chess(chess.fen());
    probe.move(toMove(reply));
    if (!mateLine && materialDiff(probe, solver) - startMat >= 2) {
      // Material is banked after the best defence: the puzzle ends on the solver's move.
      // Guard against "wins material but the position is no longer winning".
      const check = await e.analyze(probe.fen(), { depth: Math.max(10, DEPTH - 4) });
      const s = check.lines[0]?.score;
      if (!s || !decisive(s)) return reject('banked-not-decisive');
      return { solution, mate, stableDepth, secondWin, cont: [reply, ...(check.lines[0]?.pv.slice(0, 3) ?? [])] };
    }
    if (!mateLine && step >= 3) return reject('too-long');
    solution.push(reply);
    chess.move(toMove(reply));
  }
  return reject('exhausted');
}

async function worker(id: number, deadline: number, seen: Set<string>, stats: { games: number; cands: number; puzzles: number }) {
  const e = await UciEngine.create({ hashMb: 32 });
  while (Date.now() < deadline) {
    const plies = await playGame(e);
    stats.games++;
    for (let i = 6; i < plies.length && Date.now() < deadline; i++) {
      const p = plies[i];
      // Cheap filter from the players' own searches: skip when the mover was already lost.
      if (cp(p.best) < -200) continue;
      const chess = new Chess(p.fen);
      chess.move(toMove(p.move));
      if (chess.isGameOver()) continue;
      const puzzleFen = chess.fen();
      const key = puzzleFen.split(' ').slice(0, 4).join(' ');
      if (seen.has(key)) continue;
      seen.add(key);
      // Screen: a quick multi-PV search must already show one decisive, unique move.
      const sc = await e.analyze(puzzleFen, { depth: 10, multipv: 2 });
      const [b1, b2] = sc.lines;
      if (!b1 || !decisive(b1.score)) continue;
      if (b2 && !(b1.score.mate === 1)) {
        const mateNow = b1.score.mate !== undefined && b1.score.mate > 0;
        const ok = mateNow ? !(b2.score.mate !== undefined && b2.score.mate > 0) : winPercent(b2.score) <= Math.min(70, winPercent(b1.score) - 12);
        if (!ok) continue;
      }
      stats.cands++;
      const built = await buildLine(e, puzzleFen);
      if (!built) continue;
      if (HARD && built.solution.length === 1 && built.stableDepth < 7 && !built.mate) continue;
      // Trivial recapture on the square the blunder just landed on.
      if (built.solution.length === 1 && built.solution[0].slice(2, 4) === p.move.slice(2, 4) && !built.mate) continue;
      // Confirm the solver was not already winning before the blunder.
      const before = await e.analyze(p.fen, { depth: Math.max(10, DEPTH - 4) });
      const bs = before.lines[0]?.score;
      if (!bs || cp(bs) < -170) continue;
      const themes = tagPuzzle({ fen: puzzleFen, solution: built.solution, gamePly: i + 1 });
      const start = new Chess(puzzleFen);
      const first = start.move(toMove(built.solution[0]));
      const rec = {
        fen: p.fen,
        moves: [p.move, ...built.solution],
        themes,
        mate: built.mate,
        gamePly: i + 1,
        stableDepth: built.stableDepth,
        secondWin: Math.round(built.secondWin),
        legal: new Chess(puzzleFen).moves().length,
        pieces: puzzleFen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length,
        firstCheck: first.san.includes('+') || first.san.includes('#'),
        firstCapture: !!first.captured,
        cont: built.cont,
      };
      fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
      stats.puzzles++;
    }
  }
  e.quit();
  void id;
}

async function main() {
  const deadline = Date.now() + MINUTES * 60_000;
  const seen = new Set<string>();
  if (fs.existsSync(OUT)) {
    for (const line of fs.readFileSync(OUT, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      const c = new Chess(r.fen);
      c.move(toMove(r.moves[0]));
      seen.add(c.fen().split(' ').slice(0, 4).join(' '));
    }
  }
  const stats = { games: 0, cands: 0, puzzles: 0 };
  const t0 = Date.now();
  const timer = setInterval(() => {
    const min = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`[${min}m] games ${stats.games}  candidates ${stats.cands}  puzzles ${stats.puzzles}  rejects ${JSON.stringify(reasons)}`);
  }, 30_000);
  await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i, deadline, seen, stats)));
  clearInterval(timer);
  console.log(`done: games ${stats.games}, candidates ${stats.cands}, puzzles ${stats.puzzles}`);
}

main();
