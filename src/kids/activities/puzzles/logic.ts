// Puzzle Path: item types, the fork validator and validation. Pure (chess.js only). Spec 13.13.
import { Chess, type Move, type Square } from 'chess.js';
import type { AgeBand, ItemMeta } from '../types';
import { VALUE } from '../../lib/danger';
import { load, play, uciOf, validateFindMove, type FindMoveItem } from '../findMove/logic';
import { puzzleById, type Puzzle } from '../../../data/puzzles';

export type Tactic = 'fork' | 'mate';

export type PuzzleItem =
  | { source: 'hand'; items: (FindMoveItem & ItemMeta)[]; tactic?: Tactic }
  | { source: 'db'; themes: string[]; maxRating: number; count: number }
  | { source: 'streak' } // Champion Puzzle Streak (Playground)
  | { source: 'daily' }; // Puzzle of the Day (Playground)

export const MATE_THEMES = ['mate', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5'];
export const isMatePuzzle = (p: Puzzle) => p.themes.some((t) => MATE_THEMES.includes(t));

/** The UCI moves of a database puzzle (the opponent's move first). */
export const pzMoves = (p: Puzzle) => p.moves.split(' ').filter(Boolean);

const parse = (u: string) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });

/** Does a kid move solve ply `ply` of a db puzzle? Mate themes (and the final step) accept any mate. */
export function dbAccepts(p: Puzzle, fenBefore: string, move: Move, ply: number): boolean {
  const want = pzMoves(p)[ply];
  if (!want) return false;
  if (uciOf(move) === want) return true;
  const r = play(fenBefore, move);
  return !!r && load(r.fen)!.isCheckmate() && (isMatePuzzle(p) || ply >= pzMoves(p).length - 1);
}

/** Checks a database puzzle's line is legal from its FEN. */
export function validatePuzzleLine(p: Puzzle): string[] {
  let fen = p.fen;
  for (const u of pzMoves(p)) {
    const r = play(fen, parse(u));
    if (!r) return [`${p.id}: illegal move ${u}`];
    fen = r.fen;
  }
  return pzMoves(p).length % 2 === 0 ? [] : [`${p.id}: line must end on a solver move`];
}

// ---------- the fork validator (spec 13.13) ----------

const material = (c: Chess) => {
  let s = 0;
  for (const row of c.board()) for (const x of row) if (x && x.type !== 'k') s += (x.color === 'w' ? 1 : -1) * VALUE[x.type];
  return s;
};

/** Material alpha-beta (white's view). Mate scores +/-1000; mate is only seen above the leaves. */
export function alphaBeta(c: Chess, depth: number, alpha = -Infinity, beta = Infinity): number {
  if (depth === 0) return material(c);
  const moves = c.moves({ verbose: true });
  if (!moves.length) return c.inCheck() ? (c.turn() === 'w' ? -1000 : 1000) : 0;
  if (depth === 1) {
    // The last ply only changes material by what it captures or promotes: no need to play it.
    const gain = Math.max(0, ...moves.map((m) => (m.captured ? VALUE[m.captured] : 0) + (m.promotion ? VALUE[m.promotion] - 1 : 0)));
    return material(c) + (c.turn() === 'w' ? gain : -gain);
  }
  // Biggest captures by the cheapest pieces first: much better pruning.
  const order = (m: Move) => (m.captured ? 10 * VALUE[m.captured] - VALUE[m.piece] / 10 : -100);
  moves.sort((a, b) => order(b) - order(a));
  const white = c.turn() === 'w';
  let best = white ? -Infinity : Infinity;
  for (const m of moves) {
    c.move(m);
    const v = alphaBeta(c, depth - 1, alpha, beta);
    c.undo();
    if (white) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (alpha >= beta) break;
  }
  return best;
}

/** The squares of king-or-value-3+ enemy pieces that the piece on `sq` attacks. */
export function forkTargets(c: Chess, sq: Square): Square[] {
  const me = c.get(sq);
  if (!me) return [];
  const out: Square[] = [];
  for (const row of c.board())
    for (const x of row) if (x && x.color !== me.color && (x.type === 'k' || VALUE[x.type] >= 3) && c.attackers(x.square, me.color).includes(sq)) out.push(x.square);
  return out;
}

const forkCache = new Map<string, { errs: string[]; gain: number }>();

/** Spec 13.13 "validate for forks": returns errors ([] = a real fork) and the material gain. */
export function checkFork(fen: string, uci: string[]): { errs: string[]; gain: number } {
  const key = fen + '|' + uci.join(' ');
  let r = forkCache.get(key);
  if (!r) forkCache.set(key, (r = checkForkUncached(fen, uci)));
  return r;
}

function checkForkUncached(fen: string, uci: string[]): { errs: string[]; gain: number } {
  const errs: string[] = [];
  const c = load(fen);
  if (!c || !uci.length) return { errs: ['bad fork item'], gain: 0 };
  const before = material(c);
  let m: Move;
  try {
    m = c.move(parse(uci[0]));
  } catch {
    return { errs: [`illegal fork move ${uci[0]}`], gain: 0 };
  }
  if (m.captured && VALUE[m.captured] >= 3) errs.push('fork move is a big capture');
  if (c.isCheckmate()) errs.push('fork move is mate');
  const targets = forkTargets(c, m.to);
  if (targets.length < 2) errs.push(`fork attacks ${targets.length} targets`);
  const gain = alphaBeta(c, 4) - before;
  if (gain < 2) errs.push(`fork gain ${gain} < 2`);
  if (uci[1]) {
    try {
      c.move(parse(uci[1]));
    } catch {
      errs.push(`illegal reply ${uci[1]}`);
    }
  }
  return { errs, gain };
}

// ---------- validation ----------

export function validatePuzzles(item: PuzzleItem & ItemMeta, band: AgeBand): string[] {
  switch (item.source) {
    case 'hand': {
      if (!item.items?.length) return ['hand: no items'];
      const errs = item.items.flatMap((it, i) => validateFindMove(it, band).map((e) => `hand[${i}]: ${e}`));
      if (item.tactic === 'fork')
        item.items.forEach((it, i) => {
          if (it.goal.kind !== 'line') errs.push(`hand[${i}]: a fork must be a line`);
          else errs.push(...checkFork(it.fen, it.goal.uci).errs.map((e) => `hand[${i}]: ${e}`));
        });
      if (item.tactic === 'mate')
        item.items.forEach((it, i) => {
          if (it.goal.kind !== 'mate') errs.push(`hand[${i}]: a mate item needs the mate goal`);
        });
      return errs;
    }
    case 'db':
      if (!Array.isArray(item.themes)) return ['db: themes must be a list ([] = every theme)'];
      if (!(item.count >= 1)) return ['db: count must be 1 or more'];
      return [];
    case 'streak':
    case 'daily':
      return [];
    default:
      return ['unknown puzzle source'];
  }
}

export { puzzleById };
