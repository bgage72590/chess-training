// Builds src/data/puzzles.json from the generator's raw output:
// dedupes, re-tags themes with the current tagger, assigns a difficulty rating from solution
// features, and balances the set across ratings.
//
//   npx tsx scripts/puzzles/build.ts [--max 3000]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playUci, pvToSan } from '../../src/chess/utils.ts';
import type { Puzzle } from '../../src/data/puzzles.ts';
import { tagPuzzle } from './tagger.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(here, 'out', 'raw.jsonl');
const OUT = path.join(here, '../../src/data/puzzles.json');
const args = process.argv.slice(2);
const MAX = Number(args[args.indexOf('--max') + 1] || 3000);

interface Raw {
  fen: string;
  moves: string[];
  themes: string[];
  mate: number | null;
  gamePly: number;
  stableDepth: number;
  secondWin: number;
  legal: number;
  pieces: number;
  firstCheck: boolean;
  firstCapture: boolean;
  cont?: string[];
}

/**
 * Difficulty heuristic. Longer lines, quiet first moves, sacrifices, moves the engine only
 * finds at higher depth, and busy positions all make a puzzle harder for humans.
 */
export function rate(r: Raw): number {
  const solverMoves = Math.ceil((r.moves.length - 1) / 2);
  let x = 520;
  if (r.mate) x += [0, 180, 620, 950, 1180, 1300][Math.min(r.mate, 5)];
  else x += [0, 380, 720, 980, 1180][Math.min(solverMoves, 4)];
  const t = new Set(r.themes);
  if (t.has('quietMove')) x += 260;
  if (t.has('sacrifice')) x += 170;
  if (t.has('underPromotion')) x += 200;
  if (t.has('hangingPiece')) x -= 150;
  if (r.firstCheck) x -= 70;
  if (r.firstCapture && !t.has('sacrifice')) x -= 50;
  x += 34 * Math.max(0, Math.min(12, r.stableDepth - 2));
  x += 3 * Math.max(-15, Math.min(25, r.legal - 28));
  x += 6 * Math.max(-12, Math.min(10, r.pieces - 18));
  // An alternative that is almost as good makes the key move harder to single out.
  x += Math.max(0, r.secondWin - 45) * 2;
  return Math.round(Math.max(400, Math.min(2700, x)) / 5) * 5;
}

function main() {
  const lines = fs.readFileSync(RAW, 'utf8').split('\n').filter((l) => l.trim());
  const seen = new Set<string>();
  const all: (Puzzle & { raw: Raw })[] = [];
  for (const line of lines) {
    const r = JSON.parse(line) as Raw;
    if (pvToSan(r.fen, r.moves, r.moves.length).length < r.moves.length) continue; // illegal line
    const key = r.fen.split(' ').slice(0, 4).join(' ') + r.moves[0];
    if (seen.has(key)) continue;
    seen.add(key);
    const puzzleFen = playUci(r.fen, r.moves[0])!.fen;
    r.themes = tagPuzzle({ fen: puzzleFen, solution: r.moves.slice(1), gamePly: r.gamePly });
    all.push({ id: '', fen: r.fen, moves: r.moves.join(' '), rating: rate(r), themes: r.themes, raw: r });
  }
  // Balance: cap each 100-point band so easy puzzles do not swamp the set.
  const bands = new Map<number, typeof all>();
  for (const p of all) {
    const b = Math.floor(p.rating / 100);
    if (!bands.has(b)) bands.set(b, []);
    bands.get(b)!.push(p);
  }
  // When everything fits, keep everything: the picker already serves puzzles near the learner's rating.
  const bandCap = all.length <= MAX ? Infinity : Math.max(60, Math.ceil(MAX / Math.max(1, bands.size)) * 1.6);
  const picked: typeof all = [];
  for (const [, list] of [...bands.entries()].sort((a, b) => a[0] - b[0])) {
    // Prefer thematic variety inside a band.
    list.sort((a, b) => b.themes.length - a.themes.length);
    picked.push(...list.slice(0, bandCap));
  }
  picked.sort((a, b) => a.rating - b.rating);
  const out: Puzzle[] = picked.slice(0, MAX).map((p, i) => ({
    id: 'p' + String(i + 1).padStart(4, '0'),
    fen: p.fen,
    moves: p.moves,
    rating: p.rating,
    themes: p.themes,
    ...(p.raw.cont?.length ? { cont: p.raw.cont.join(' ') } : {}),
  }));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));

  const hist = new Map<number, number>();
  for (const p of out) hist.set(Math.floor(p.rating / 200) * 200, (hist.get(Math.floor(p.rating / 200) * 200) ?? 0) + 1);
  const themes = new Map<string, number>();
  for (const p of out) for (const t of p.themes) themes.set(t, (themes.get(t) ?? 0) + 1);
  console.log(`raw ${lines.length}, unique ${all.length}, written ${out.length} -> ${path.relative(process.cwd(), OUT)}`);
  console.log('ratings:', [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join('  '));
  console.log('themes:', [...themes.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));
}

main();
