// Checkmate drills: item data, validation, scoring, the kid-move checks, the helper overlays
// (ladder rungs, the queen's box) and a simple JS "Pip's move" for hints. Pure (chess.js only).
import { Chess, type Move, type Square } from 'chess.js';
import type { AgeBand, ItemMeta, Sq } from '../types';
import { bandText } from '../types';
import { SQUARE_RE } from '../../lib/pronounce';
import { fenPlacement } from '../../lib/fen';

export type DrillMethod = 'ladder' | 'box' | 'rook';
export interface MateDrillItem {
  fen: string;
  method: DrillMethod;
  maxMoves: number;
}

const MATERIAL: Record<DrillMethod, string> = { ladder: 'KRR', box: 'KQ', rook: 'KR' };

const load = (fen: string) => {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
};

/** White's pieces as a sorted letter string ('KRR'), and Black's ('K'). */
export function material(fen: string): { w: string; b: string } {
  const p = Object.values(fenPlacement(fen));
  const sort = (s: string[]) => s.sort((a, b) => 'KQRBNP'.indexOf(a) - 'KQRBNP'.indexOf(b)).join('');
  return { w: sort(p.filter((x) => x === x!.toUpperCase()) as string[]), b: sort(p.filter((x) => x !== x!.toUpperCase()).map((x) => x!.toUpperCase())) };
}

export function validateMateDrill(item: MateDrillItem & ItemMeta, band: AgeBand): string[] {
  const errs: string[] = [];
  const c = load(item.fen);
  if (!c) return ['FEN does not load'];
  if (c.turn() !== 'w') errs.push('white must be to move');
  if (c.inCheck()) errs.push('the start position is check');
  if (c.isGameOver()) errs.push('the start position is game over');
  // It must not be stalemate for Black either (a null move would be).
  const nb = load(item.fen.replace(' w ', ' b '));
  if (!nb || nb.inCheck() || nb.isStalemate() || nb.isCheckmate()) errs.push('black would have no fair start');
  const m = material(item.fen);
  if (m.w !== MATERIAL[item.method] || m.b !== 'K') errs.push(`material ${m.w} v ${m.b} does not fit ${item.method}`);
  if (!(item.maxMoves > 0)) errs.push('maxMoves must be positive');
  if (band === 'sprout' && SQUARE_RE.test(bandText(item.say, band))) errs.push('sprout text contains a square name');
  return errs;
}

/** mate within maxMoves = 3, within 1.5x = 2, otherwise 1. */
export function drillScore(moves: number, maxMoves: number): 1 | 2 | 3 {
  if (moves <= maxMoves) return 3;
  if (moves <= Math.ceil(maxMoves * 1.5)) return 2;
  return 1;
}

export type KidMoveVerdict = 'mate' | 'stalemate' | 'blunder' | 'ok';

/** How a kid move turns out: mate, a stalemate (retry), leaving a piece to the king (retry), or fine. */
export function judgeKidMove(fenBefore: string, m: { from: string; to: string; promotion?: string }): { verdict: KidMoveVerdict; fen: string; lost?: Sq } | null {
  const c = load(fenBefore);
  if (!c) return null;
  try {
    c.move(m);
  } catch {
    return null;
  }
  const fen = c.fen();
  if (c.isCheckmate()) return { verdict: 'mate', fen };
  if (c.isStalemate()) return { verdict: 'stalemate', fen };
  const grab = c.moves({ verbose: true }).find((x) => x.captured);
  if (grab) return { verdict: 'blunder', fen, lost: grab.to };
  return { verdict: 'ok', fen };
}

const fr = (sq: Sq): [number, number] => [sq.charCodeAt(0) - 97, Number(sq[1]) - 1];
const sq = (f: number, r: number) => String.fromCharCode(97 + f) + (r + 1);

/** The black king's box: the rectangle bounded by the queen's file and rank. */
export function queenBox(fen: string): Sq[] {
  const p = fenPlacement(fen);
  const q = Object.keys(p).find((s) => p[s] === 'Q');
  const k = Object.keys(p).find((s) => p[s] === 'k');
  if (!q || !k) return [];
  const [qf, qr] = fr(q);
  const [kf, kr] = fr(k);
  if (qf === kf || qr === kr) return [];
  const files = kf > qf ? [qf + 1, 7] : [0, qf - 1];
  const ranks = kr > qr ? [qr + 1, 7] : [0, qr - 1];
  const out: Sq[] = [];
  for (let f = files[0]; f <= files[1]; f++) for (let r = ranks[0]; r <= ranks[1]; r++) out.push(sq(f, r));
  return out;
}

/** The ladder rungs: every empty square on each white rook's rank. */
export function ladderRungs(fen: string): Sq[] {
  const p = fenPlacement(fen);
  const out: Sq[] = [];
  for (const [s, pc] of Object.entries(p)) {
    if (pc !== 'R') continue;
    const r = Number(s[1]) - 1;
    for (let f = 0; f < 8; f++) if (!p[sq(f, r)]) out.push(sq(f, r));
  }
  return [...new Set(out)];
}

/** Squares the black king could reach through unattacked squares (its "room"). */
export function kingRoom(fen: string): number {
  const c = load(fen);
  if (!c) return 64;
  const k = c.findPiece({ type: 'k', color: 'b' })[0];
  if (!k) return 64;
  const seen = new Set<Sq>([k]);
  const queue: Sq[] = [k];
  const board = c.board();
  const occupiedWhite = new Set<Sq>(board.flat().filter((x) => x && x.color === 'w').map((x) => x!.square));
  while (queue.length) {
    const [f, r] = fr(queue.shift()!);
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        const nf = f + a;
        const nr = r + b;
        if ((a || b) && nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
          const s = sq(nf, nr);
          if (seen.has(s) || occupiedWhite.has(s) || c.isAttacked(s as Square, 'w')) continue;
          seen.add(s);
          queue.push(s);
        }
      }
  }
  return seen.size;
}

/** How good a position (White to move) is for the attacker: lower is better. The king's room,
 *  how far it is from an edge, and how close the white king stands. */
export function squeezeScore(fen: string): number {
  const c = load(fen);
  if (!c) return 1e6;
  const bk = c.findPiece({ type: 'k', color: 'b' })[0];
  const wk = c.findPiece({ type: 'k', color: 'w' })[0];
  if (!bk || !wk) return 1e6;
  const [a, b] = [fr(wk), fr(bk)];
  const kingDist = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  const edge = Math.min(b[0], 7 - b[0], b[1], 7 - b[1]);
  return kingRoom(fen) * 10 + edge * 12 + kingDist * 4;
}

/** Pip's quick JS move for hints and "Watch Pip" when the engine is not ready: mate if possible;
 *  never stalemate or leave a piece to the king; otherwise squeeze (room, edge, king distance),
 *  steering away from positions in `seen` so it does not shuffle back and forth. Not a perfect
 *  mater (the engine is), but always a safe, sensible move. */
export function greedyWhiteMove(fen: string, seen?: Set<string>): Move | null {
  const c = load(fen);
  if (!c) return null;
  let best: { m: Move; score: number } | null = null;
  for (const m of c.moves({ verbose: true })) {
    const j = judgeKidMove(fen, m);
    if (!j) continue;
    if (j.verdict === 'mate') return m;
    if (j.verdict !== 'ok') continue;
    const key = j.fen.split(' ').slice(0, 2).join(' ');
    const score = squeezeScore(j.fen) + (seen?.has(key) ? 60 : 0);
    if (!best || score < best.score) best = { m, score };
  }
  return best?.m ?? null;
}
