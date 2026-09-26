import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const FILES = 'abcdefgh';
export const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export interface UciMove {
  from: string;
  to: string;
  promotion?: PieceSymbol;
}

export const uciOf = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion ?? '');

export function parseUci(uci: string): UciMove {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] as PieceSymbol) || undefined };
}

/** Plays a UCI move on a copy of fen. Returns null if illegal. */
export function playUci(fen: string, uci: string): { fen: string; move: Move } | null {
  try {
    const c = new Chess(fen);
    const move = c.move(parseUci(uci));
    return { fen: c.fen(), move };
  } catch {
    return null;
  }
}

export function sanToUci(fen: string, san: string): string | null {
  try {
    const c = new Chess(fen);
    return uciOf(c.move(san));
  } catch {
    return null;
  }
}

export function uciToSan(fen: string, uci: string): string {
  return playUci(fen, uci)?.move.san ?? uci;
}

/** Converts a UCI principal variation into SAN strings. */
export function pvToSan(fen: string, pv: string[], max = 8): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of pv.slice(0, max)) {
    try {
      out.push(c.move(parseUci(u)).san);
    } catch {
      break;
    }
  }
  return out;
}

export const turnOf = (fen: string): Color => (fen.split(' ')[1] === 'b' ? 'b' : 'w');
export const colorName = (c: Color) => (c === 'w' ? 'White' : 'Black');
export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const fullMoveOf = (fen: string) => Number(fen.split(' ')[5] ?? 1);

export function materialBalance(fen: string): number {
  let s = 0;
  for (const ch of fen.split(' ')[0]) {
    const t = ch.toLowerCase() as PieceSymbol;
    if (!(t in VALUE)) continue;
    s += ch === t ? -VALUE[t] : VALUE[t];
  }
  return s;
}

export function isSquare(s: string): s is Square {
  return /^[a-h][1-8]$/.test(s);
}

/** Move number prefix for SAN lists, e.g. "12." or "12..." */
export function moveNumberLabel(ply: number, startFullMove = 1, startTurn: Color = 'w'): string {
  const offset = startTurn === 'b' ? 1 : 0;
  const n = startFullMove + Math.floor((ply + offset) / 2);
  return (ply + offset) % 2 === 0 ? `${n}.` : `${n}...`;
}

export function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
