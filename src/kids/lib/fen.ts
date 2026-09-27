// FEN helpers for free-rule activities (kingless placements) and chess.js positions.
import type { PieceCode, Placement, Sq } from '../activities/types';

const FILES = 'abcdefgh';

/** {a1:'R'} -> '8/8/8/8/8/8/8/R7 w - - 0 1' */
export function placementFen(p: Placement, turn: 'w' | 'b' = 'w'): string {
  const rows: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const pc = p[FILES[f] + r];
      if (pc) {
        if (empty) row += empty;
        empty = 0;
        row += pc;
      } else empty++;
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join('/')} ${turn} - - 0 1`;
}

/** The piece placement of a FEN as a square map. */
export function fenPlacement(fen: string): Placement {
  const out: Placement = {};
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        out[FILES[f] + (8 - i)] = ch as PieceCode;
        f++;
      }
    }
  });
  return out;
}

/** The same position with `c` to move (also clears the en passant square). */
export function withTurn(fen: string, c: 'w' | 'b'): string {
  const parts = fen.split(' ');
  const defaults = ['', 'w', '-', '-', '0', '1'];
  while (parts.length < 6) parts.push(defaults[parts.length]);
  parts[1] = c;
  parts[3] = '-';
  return parts.join(' ');
}

export const isSq = (s: unknown): s is Sq => typeof s === 'string' && /^[a-h][1-8]$/.test(s);

export const other = (c: 'w' | 'b'): 'w' | 'b' => (c === 'w' ? 'b' : 'w');
