// Mini rules for free-rule activities (no kings, no check): piece movement on a board with
// rocks, sleeping statues (lava), play areas and simple captures. Pure; unit-tested.
// Uppercase pieces are the kid's (White, moving up the board); lowercase are Black.
import type { PieceCode, Placement, Sq } from '../activities/types';
import { placementFen } from './fen';

export { placementFen };

const FILES = 'abcdefgh';
const sqOf = (f: number, r: number): Sq => FILES[f] + (r + 1);
const fr = (s: Sq): [number, number] => [FILES.indexOf(s[0]), Number(s[1]) - 1];
const onBoard = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

const ROOK_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_JUMPS = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];
const SLIDES: Record<string, number[][]> = { R: ROOK_DIRS, B: BISHOP_DIRS, Q: QUEEN_DIRS };

export const isWhite = (p: PieceCode) => p === p.toUpperCase();

/** Every square of an inclusive rectangle, e.g. 'a1:d4' (16 squares). */
export function sqRange(area: string): Set<Sq> {
  const [a, b] = area.split(':');
  const [f1, r1] = fr(a);
  const [f2, r2] = fr(b ?? a);
  const out = new Set<Sq>();
  for (let f = Math.min(f1, f2); f <= Math.max(f1, f2); f++) for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) out.add(sqOf(f, r));
  return out;
}

export const ALL_SQUARES: Sq[] = Array.from({ length: 64 }, (_, i) => sqOf(i % 8, Math.floor(i / 8)));

/** Squares a piece attacks. Sliders stop at the first occupied square (included). Lowercase 'p' attacks downward. */
export function attacks(piece: PieceCode, from: Sq, occupied: Set<Sq>): Sq[] {
  const t = piece.toUpperCase();
  const [f, r] = fr(from);
  const out: Sq[] = [];
  if (t === 'N' || t === 'K') {
    for (const [a, b] of t === 'N' ? KNIGHT_JUMPS : QUEEN_DIRS) if (onBoard(f + a, r + b)) out.push(sqOf(f + a, r + b));
    return out;
  }
  if (t === 'P') {
    const d = isWhite(piece) ? 1 : -1;
    for (const a of [-1, 1]) if (onBoard(f + a, r + d)) out.push(sqOf(f + a, r + d));
    return out;
  }
  for (const [a, b] of SLIDES[t]) {
    let x = f + a;
    let y = r + b;
    while (onBoard(x, y)) {
      const q = sqOf(x, y);
      out.push(q);
      if (occupied.has(q)) break;
      x += a;
      y += b;
    }
  }
  return out;
}

/** Every square attacked by the statues (sleeping black pieces). */
export function lavaSquares(statues: Placement, occupied: Set<Sq>): Set<Sq> {
  const out = new Set<Sq>();
  for (const [s, p] of Object.entries(statues)) if (p) for (const q of attacks(p, s, occupied)) out.add(q);
  return out;
}

export interface DestOptions {
  blocked: Set<Sq>;
  capturable?: Set<Sq>;
  area?: Set<Sq>;
  mustCapture?: boolean;
  epSquare?: Sq;
}

/**
 * Target squares for a piece. R/B/Q slide until blocked (not included) or capturable (included,
 * then stop); squares outside the area count as blocked. N and K step (N ignores pieces in
 * between). Pawns: 1 forward if empty, 2 from the start rank if both are empty, diagonally
 * forward only onto a capturable square (or the en passant square).
 */
export function dests(piece: PieceCode, from: Sq, o: DestOptions): Sq[] {
  const t = piece.toUpperCase();
  const [f, r] = fr(from);
  const cap = o.capturable ?? new Set<Sq>();
  const ok = (q: Sq) => !o.area || o.area.has(q);
  const out: Sq[] = [];
  if (t === 'P') {
    const d = isWhite(piece) ? 1 : -1;
    const startRank = isWhite(piece) ? 1 : 6;
    if (onBoard(f, r + d) && !o.mustCapture) {
      const one = sqOf(f, r + d);
      if (!o.blocked.has(one) && !cap.has(one) && ok(one)) {
        out.push(one);
        if (r === startRank && onBoard(f, r + 2 * d)) {
          const two = sqOf(f, r + 2 * d);
          if (!o.blocked.has(two) && !cap.has(two) && ok(two)) out.push(two);
        }
      }
    }
    for (const a of [-1, 1]) {
      if (!onBoard(f + a, r + d)) continue;
      const q = sqOf(f + a, r + d);
      if ((cap.has(q) || q === o.epSquare) && ok(q) && !o.blocked.has(q)) out.push(q);
    }
    return out;
  }
  if (t === 'N' || t === 'K') {
    for (const [a, b] of t === 'N' ? KNIGHT_JUMPS : QUEEN_DIRS) {
      if (!onBoard(f + a, r + b)) continue;
      const q = sqOf(f + a, r + b);
      if (!ok(q) || o.blocked.has(q)) continue;
      if (cap.has(q) || !o.mustCapture) out.push(q);
    }
    return out;
  }
  for (const [a, b] of SLIDES[t]) {
    let x = f + a;
    let y = r + b;
    while (onBoard(x, y)) {
      const q = sqOf(x, y);
      if (!ok(q) || o.blocked.has(q)) break;
      if (cap.has(q)) {
        out.push(q);
        break;
      }
      if (!o.mustCapture) out.push(q);
      x += a;
      y += b;
    }
  }
  return out;
}

/** Moves a piece (capturing whatever stands on `to`). A pawn reaching its last rank becomes a queen. */
export function applyMove(p: Placement, from: Sq, to: Sq): Placement {
  const next: Placement = { ...p };
  const pc = next[from];
  if (!pc) return next;
  delete next[from];
  let piece = pc;
  if (pc === 'P' && to[1] === '8') piece = 'Q';
  if (pc === 'p' && to[1] === '1') piece = 'q';
  next[to] = piece;
  return next;
}

// ---------- Star Collector search ----------

export interface StarPuzzle {
  pieces: Placement;
  stars: Sq[];
  rocks?: Sq[];
  statues?: Placement;
  area?: string;
}

const placementKey = (p: Placement) =>
  Object.entries(p)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([s, pc]) => s + pc)
    .join(',');

/** Lava for a star position: statue attacks with rocks, statues and the kid's pieces as blockers. */
export function starLava(item: Pick<StarPuzzle, 'rocks' | 'statues'>, pieces: Placement): Set<Sq> {
  const statues = item.statues ?? {};
  const occ = new Set<Sq>([...(item.rocks ?? []), ...Object.keys(statues), ...Object.keys(pieces)]);
  return lavaSquares(statues, occ);
}

/** Where each of the kid's pieces may go in a star position (lava squares included: landing there bounces). */
export function starDests(item: StarPuzzle, pieces: Placement): Record<Sq, Sq[]> {
  const area = item.area ? sqRange(item.area) : undefined;
  const fixed = [...(item.rocks ?? []), ...Object.keys(item.statues ?? {})];
  const out: Record<Sq, Sq[]> = {};
  for (const [s, p] of Object.entries(pieces)) {
    if (!p) continue;
    const blocked = new Set<Sq>([...fixed, ...Object.keys(pieces).filter((x) => x !== s)]);
    const d = dests(p, s, { blocked, area });
    if (d.length) out[s] = d;
  }
  return out;
}

/**
 * Shortest route that collects every remaining star (BFS over placement + collected mask; lava
 * recomputed per state; landing on lava is not allowed). Returns null if unsolvable.
 */
export function starSolve(item: StarPuzzle, pieces: Placement = item.pieces, remaining: Sq[] = item.stars): { par: number; path: [Sq, Sq][] } | null {
  const stars = remaining;
  if (stars.length > 10) return null;
  const idx = new Map(stars.map((s, i) => [s, i] as const));
  const full = (1 << stars.length) - 1;
  let m0 = 0;
  for (const s of Object.keys(pieces)) if (idx.has(s)) m0 |= 1 << idx.get(s)!;
  type Node = { pc: Placement; m: number; parent: Node | null; move: [Sq, Sq] | null };
  const start: Node = { pc: pieces, m: m0, parent: null, move: null };
  if (m0 === full) return { par: 0, path: [] };
  const seen = new Set<string>([placementKey(pieces) + '|' + m0]);
  let frontier: Node[] = [start];
  let depth = 0;
  while (frontier.length && depth < 40) {
    depth++;
    const next: Node[] = [];
    for (const n of frontier) {
      const ds = starDests(item, n.pc);
      for (const [s, tos] of Object.entries(ds)) {
        for (const q of tos) {
          const np = applyMove(n.pc, s, q);
          if (starLava(item, np).has(q)) continue;
          const nm = idx.has(q) ? n.m | (1 << idx.get(q)!) : n.m;
          const k = placementKey(np) + '|' + nm;
          if (seen.has(k)) continue;
          seen.add(k);
          const child: Node = { pc: np, m: nm, parent: n, move: [s, q] };
          if (nm === full) {
            const path: [Sq, Sq][] = [];
            for (let c: Node | null = child; c && c.move; c = c.parent) path.unshift(c.move);
            return { par: depth, path };
          }
          next.push(child);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** Minimum number of moves to collect every star; -1 if unsolvable. */
export function starPar(item: StarPuzzle): number {
  return starSolve(item)?.par ?? -1;
}

// ---------- Gobble search ----------

export interface GobblePuzzle {
  pieces: Placement;
  targets: Placement;
  rocks?: Sq[];
  area?: string;
  bite?: boolean;
}

/** Is `target` guarded by another remaining target (the bite rule)? */
export function guarded(targets: Placement, target: Sq): boolean {
  const rest: Placement = { ...targets };
  delete rest[target];
  const occ = new Set<Sq>([...Object.keys(rest), target]);
  return lavaSquares(rest, occ).has(target);
}

/** Every way to eat all targets (each move must capture). DFS, up to `limit` solutions. */
export function gobbleSolutions(item: GobblePuzzle, limit = 50): Sq[][] {
  const sols: Sq[][] = [];
  const area = item.area ? sqRange(item.area) : undefined;
  const rec = (pc: Placement, targets: Placement, path: Sq[]) => {
    if (sols.length >= limit) return;
    if (!Object.keys(targets).length) {
      sols.push(path);
      return;
    }
    const [s, p] = Object.entries(pc)[0] as [Sq, PieceCode];
    const cap = new Set(Object.keys(targets));
    for (const q of dests(p, s, { blocked: new Set(item.rocks ?? []), capturable: cap, mustCapture: true, area })) {
      if (item.bite && guarded(targets, q)) continue;
      const nt: Placement = { ...targets };
      delete nt[q];
      rec(applyMove(pc, s, q), nt, [...path, q]);
    }
  };
  rec(item.pieces, item.targets, []);
  return sols;
}

// ---------- Pseudo-legal moves (mini-games) ----------

/** Every pseudo-legal move for `color` (no kings, no check). */
export function pseudoMoves(p: Placement, color: 'w' | 'b', o: { epSquare?: Sq; pawnsOnly?: boolean; area?: Set<Sq> } = {}): { from: Sq; to: Sq; capture?: PieceCode }[] {
  const own = new Set<Sq>();
  const enemy = new Set<Sq>();
  for (const [s, pc] of Object.entries(p)) if (pc) (isWhite(pc) === (color === 'w') ? own : enemy).add(s);
  const out: { from: Sq; to: Sq; capture?: PieceCode }[] = [];
  for (const s of own) {
    const pc = p[s]!;
    if (o.pawnsOnly && pc.toUpperCase() !== 'P') continue;
    for (const to of dests(pc, s, { blocked: own, capturable: enemy, epSquare: pc.toUpperCase() === 'P' ? o.epSquare : undefined, area: o.area })) {
      out.push(p[to] ? { from: s, to, capture: p[to] } : { from: s, to });
    }
  }
  return out;
}
