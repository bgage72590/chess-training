// Piece identity tracking: keeps React keys stable across positions so moves animate.
import type { Color, PieceSymbol } from 'chess.js';
import { FILES } from './utils';

export interface PieceState {
  id: number;
  type: PieceSymbol;
  color: Color;
  square: string;
}

let pieceId = 1;

export function parsePlacement(fen: string): Omit<PieceState, 'id'>[] {
  const out: Omit<PieceState, 'id'>[] = [];
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        const color: Color = ch === ch.toUpperCase() ? 'w' : 'b';
        out.push({ type: ch.toLowerCase() as PieceSymbol, color, square: FILES[f] + (8 - i) });
        f++;
      }
    }
  });
  return out;
}

const dist = (a: string, b: string) => Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) + Math.abs(Number(a[1]) - Number(b[1]));

/** Keeps piece identities stable across positions so moves animate. */
export function diffPieces(prev: PieceState[], next: Omit<PieceState, 'id'>[], hint?: [string, string] | null): PieceState[] {
  const used = new Set<number>();
  const result: (PieceState | null)[] = next.map(() => null);
  next.forEach((n, i) => {
    const p = prev.find((p) => !used.has(p.id) && p.square === n.square && p.type === n.type && p.color === n.color);
    if (p) {
      used.add(p.id);
      result[i] = { ...n, id: p.id };
    }
  });
  if (hint) {
    const i = next.findIndex((n, k) => !result[k] && n.square === hint[1]);
    const p = prev.find((p) => !used.has(p.id) && p.square === hint[0]);
    if (i >= 0 && p && (p.color === next[i].color)) {
      used.add(p.id);
      result[i] = { ...next[i], id: p.id };
    }
  }
  next.forEach((n, i) => {
    if (result[i]) return;
    const cands = prev.filter((p) => !used.has(p.id) && p.color === n.color && p.type === n.type).sort((a, b) => dist(a.square, n.square) - dist(b.square, n.square));
    const p = cands[0];
    if (p && dist(p.square, n.square) <= 8) {
      used.add(p.id);
      result[i] = { ...n, id: p.id };
    } else {
      result[i] = { ...n, id: pieceId++ };
    }
  });
  return result as PieceState[];
}

