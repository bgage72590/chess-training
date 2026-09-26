// Heuristic theme tagger for generated puzzles.
// Input: the puzzle start position (solver to move) and the solution line in UCI.
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import { FILES, materialBalance, other, parseUci } from '../../src/chess/utils.ts';

// Piece values for tactic tests; the king counts highest so a check-through reads as a pin or skewer.
const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

type Cell = { type: PieceSymbol; color: Color } | null;
const sq = (f: number, r: number) => (FILES[f] + (r + 1)) as Square;
const fr = (s: string) => [FILES.indexOf(s[0]), Number(s[1]) - 1] as const;

function grid(chess: Chess): Cell[][] {
  // grid[file][rank]
  const g: Cell[][] = Array.from({ length: 8 }, () => Array<Cell>(8).fill(null));
  for (const row of chess.board()) for (const c of row) if (c) {
    const [f, r] = fr(c.square);
    g[f][r] = { type: c.type, color: c.color };
  }
  return g;
}

const DIRS: Record<string, [number, number][]> = {
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
};
const KNIGHT: [number, number][] = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KING: [number, number][] = DIRS.q;
const inb = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

/** Squares attacked by the piece on `from`. */
export function attacksFrom(g: Cell[][], from: string): string[] {
  const [f, r] = fr(from);
  const p = g[f][r];
  if (!p) return [];
  const out: string[] = [];
  if (p.type === 'p') {
    const d = p.color === 'w' ? 1 : -1;
    for (const df of [-1, 1]) if (inb(f + df, r + d)) out.push(sq(f + df, r + d));
  } else if (p.type === 'n' || p.type === 'k') {
    for (const [df, dr] of p.type === 'n' ? KNIGHT : KING) if (inb(f + df, r + dr)) out.push(sq(f + df, r + dr));
  } else {
    for (const [df, dr] of DIRS[p.type]) {
      let x = f + df;
      let y = r + dr;
      while (inb(x, y)) {
        out.push(sq(x, y));
        if (g[x][y]) break;
        x += df;
        y += dr;
      }
    }
  }
  return out;
}

/** For a slider on `from` attacking `target`, the first piece behind target on the same ray. */
function behind(g: Cell[][], from: string, target: string): string | null {
  const [f, r] = fr(from);
  const [tf, tr] = fr(target);
  const df = Math.sign(tf - f);
  const dr = Math.sign(tr - r);
  let x = tf + df;
  let y = tr + dr;
  while (inb(x, y)) {
    if (g[x][y]) return sq(x, y);
    x += df;
    y += dr;
  }
  return null;
}

function isSlider(t: PieceSymbol) {
  return t === 'b' || t === 'r' || t === 'q';
}

/** Material of `color` minus the opponent's, in pawns. */
export function materialDiff(chess: Chess, color: Color): number {
  const white = materialBalance(chess.fen());
  return color === 'w' ? white : -white;
}

/** Length theme from the number of solver moves. */
export function lengthTheme(solverMoves: number): string {
  return solverMoves === 1 ? 'oneMove' : solverMoves === 2 ? 'short' : solverMoves === 3 ? 'long' : 'veryLong';
}

/** Pieces of `color` pinned to their king or queen by an enemy slider: [pinnedSquare, pinnerSquare, target]. */
function pins(g: Cell[][], color: Color): { pinned: string; pinner: string; to: 'k' | 'q' }[] {
  const out: { pinned: string; pinner: string; to: 'k' | 'q' }[] = [];
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
    const p = g[f][r];
    if (!p || p.color === color || !isSlider(p.type)) continue;
    for (const [df, dr] of DIRS[p.type]) {
      let x = f + df;
      let y = r + dr;
      let first: string | null = null;
      while (inb(x, y)) {
        const c = g[x][y];
        if (c) {
          if (!first) {
            if (c.color !== color) break;
            first = sq(x, y);
          } else {
            if (c.color === color && (c.type === 'k' || c.type === 'q')) {
              const pinned = g[fr(first)[0]][fr(first)[1]]!;
              if (VALUE[pinned.type] < VALUE[c.type]) out.push({ pinned: first, pinner: sq(f, r), to: c.type });
            }
            break;
          }
        }
        x += df;
        y += dr;
      }
    }
  }
  return out;
}

export interface TagInput {
  /** Position where the solver is to move. */
  fen: string;
  /** Solver move, reply, solver move, ... (UCI). */
  solution: string[];
  /** Ply number in the source game (for opening/middlegame/endgame). */
  gamePly: number;
}

export function tagPuzzle({ fen, solution, gamePly }: TagInput): string[] {
  const themes = new Set<string>();
  const chess = new Chess(fen);
  const solver = chess.turn();
  const opp = other(solver);
  const startMat = materialDiff(chess, solver);
  const solverMoves = Math.ceil(solution.length / 2);
  const startPins = pins(grid(chess), opp);

  // Phase
  const nonPawn = chess.board().flat().filter((c) => c && c.type !== 'p' && c.type !== 'k').reduce((s, c) => s + VALUE[c!.type], 0);
  if (nonPawn <= 14) themes.add('endgame');
  else if (gamePly <= 20) themes.add('opening');
  else themes.add('middlegame');

  themes.add(lengthTheme(solverMoves));

  let minMat = startMat;
  const captured: string[] = []; // squares the solver captured on, in order
  for (let i = 0; i < solution.length; i++) {
    const uci = solution[i];
    const isSolver = i % 2 === 0;
    const before = grid(chess);
    const mover = before[fr(uci.slice(0, 2))[0]][fr(uci.slice(0, 2))[1]]!;
    const targetBefore = before[fr(uci.slice(2, 4))[0]][fr(uci.slice(2, 4))[1]];
    const defendersOfTarget = targetBefore ? chess.attackers(uci.slice(2, 4) as Square, opp).length : 0;
    const m = chess.move(parseUci(uci));
    const after = grid(chess);
    const mat = materialDiff(chess, solver);
    minMat = Math.min(minMat, mat);
    if (!isSolver) {
      // Attraction: the king is forced to capture a sacrificed piece and then gets checked.
      if (m.piece === 'k' && m.captured && i + 1 < solution.length) {
        const next = new Chess(chess.fen());
        const nm = next.move(parseUci(solution[i + 1]));
        if (nm.san.includes('+') || nm.san.includes('#')) themes.add('attraction');
      }
      continue;
    }

    if (m.promotion) themes.add(m.promotion === 'q' ? 'promotion' : 'underPromotion');
    if (m.flags.includes('e')) themes.add('enPassant');
    if (m.flags.includes('k') || m.flags.includes('q')) themes.add('castling');
    if (m.captured) captured.push(m.to);

    // Hanging piece: one-move capture of an undefended piece, not a check.
    if (solverMoves === 1 && m.captured && VALUE[m.captured] >= 3 && defendersOfTarget === 0 && !chess.isCheck()) themes.add('hangingPiece');

    // Double check / discovered attack
    const kingSq = chess.findPiece({ type: 'k', color: opp })[0];
    const checkers = kingSq ? chess.attackers(kingSq, solver) : [];
    if (checkers.length >= 2) themes.add('doubleCheck');
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
      const p = after[f][r];
      const s = sq(f, r);
      if (!p || p.color !== solver || s === m.to || !isSlider(p.type)) continue;
      const newTargets = attacksFrom(after, s).filter((t) => {
        const c = after[fr(t)[0]][fr(t)[1]];
        return c && c.color === opp && (c.type === 'k' || VALUE[c.type] >= 3) && !attacksFrom(before, s).includes(t);
      });
      for (const t of newTargets) {
        const c = after[fr(t)[0]][fr(t)[1]]!;
        themes.add(c.type === 'k' ? 'discoveredCheck' : 'discoveredAttack');
      }
    }

    // Fork: the moved piece hits 2+ valuable targets, and the solver later captures one of them.
    const hits = attacksFrom(after, m.to).filter((t) => {
      const c = after[fr(t)[0]][fr(t)[1]];
      if (!c || c.color !== opp) return false;
      if (c.type === 'k') return true;
      const defended = chess.attackers(t as Square, opp).length > 0;
      return VALUE[c.type] >= 3 && (VALUE[c.type] > VALUE[m.promotion ?? m.piece] || !defended);
    });
    if (hits.length >= 2) {
      const later = solution.slice(i + 2).filter((_, j) => j % 2 === 0);
      if (later.some((u) => hits.includes(u.slice(2, 4)))) themes.add('fork');
    }

    // Skewer: slider attacks a K/Q/R with a less valuable piece behind; it moves; we take behind.
    if (isSlider(m.promotion ?? m.piece) && i + 2 < solution.length) {
      for (const t of attacksFrom(after, m.to)) {
        const front = after[fr(t)[0]][fr(t)[1]];
        if (!front || front.color !== opp || !['k', 'q', 'r'].includes(front.type)) continue;
        const b = behind(after, m.to, t);
        if (!b) continue;
        const back = after[fr(b)[0]][fr(b)[1]]!;
        if (back.color !== opp || VALUE[back.type] >= VALUE[front.type]) continue;
        const reply = solution[i + 1];
        const next = solution[i + 2];
        if (reply.slice(0, 2) === t && next.slice(0, 2) === m.to && next.slice(2, 4) === b) themes.add('skewer');
      }
    }

    // Pin: the solver captures a piece that was pinned at the start, or creates a pin and later wins that piece.
    if (m.captured && startPins.some((p) => p.pinned === m.to)) themes.add('pin');
    if (isSlider(m.promotion ?? m.piece)) {
      const created = pins(after, opp).filter((p) => p.pinner === m.to);
      const later = solution.slice(i + 2).filter((_, j) => j % 2 === 0);
      if (created.some((p) => later.some((u) => u.slice(2, 4) === p.pinned))) themes.add('pin');
    }

    // Removing the defender: capture a piece that defended X, then capture X.
    if (m.captured && targetBefore && i + 2 < solution.length) {
      const defended = attacksFrom(before, m.to).filter((t) => {
        const c = before[fr(t)[0]][fr(t)[1]];
        return c && c.color === opp && VALUE[c.type] >= 3 && c.type !== 'k';
      });
      const next = solution[i + 2];
      if (defended.includes(next.slice(2, 4))) themes.add('removeDefender');
    }
  }

  if (chess.isCheckmate()) {
    themes.add('mate');
    themes.add(solverMoves <= 4 ? `mateIn${solverMoves}` : 'mateIn5');
    const kSq = chess.findPiece({ type: 'k', color: opp })[0];
    const g = grid(chess);
    const [kf, kr] = fr(kSq);
    const lastTo = solution[solution.length - 1].slice(2, 4);
    const mater = g[fr(lastTo)[0]][fr(lastTo)[1]]!;
    const neighbours = KING.map(([df, dr]) => [kf + df, kr + dr]).filter(([x, y]) => inb(x, y));
    const backRank = opp === 'w' ? 0 : 7;
    if (kr === backRank && (mater.type === 'r' || mater.type === 'q') && fr(lastTo)[1] === backRank) {
      const forward = opp === 'w' ? 1 : -1;
      const blocked = [-1, 0, 1].filter((d) => inb(kf + d, kr + forward)).every((d) => g[kf + d][kr + forward]?.color === opp);
      if (blocked) themes.add('backRankMate');
    }
    if (mater.type === 'n' && neighbours.every(([x, y]) => g[x][y]?.color === opp)) themes.add('smotheredMate');
  }

  if (minMat <= startMat - 2) themes.add('sacrifice');

  const first = new Chess(fen).move(parseUci(solution[0]));
  if (!first.captured && !first.san.includes('+') && !first.san.includes('#') && !first.promotion) themes.add('quietMove');

  return [...themes];
}
