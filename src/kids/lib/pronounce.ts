// Turns captions into what the speech engine should say: square names, SAN moves and symbols.
// Applied only to the spoken string, never to the caption (spec 10.1).
import type { AgeBand } from '../activities/types';

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const PIECE: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' };
const PROMO: Record<string, string> = { Q: 'a queen', R: 'a rook', B: 'a bishop', N: 'a knight' };

export const SQUARE_RE = /\b([a-h])([1-8])\b/;

const sayFile = (f: string) => (f === 'a' ? 'ay' : f);
const saySquare = (f: string, r: string) => `${sayFile(f)} ${NUM[Number(r)]}`;

/** Pronunciation map. 'e4' -> 'e four', 'Qb7#' -> 'queen b seven, checkmate', 'O-O' -> 'castles king side'. */
export function pronounce(text: string, _band?: AgeBand): string {
  let s = text;
  s = s.replace(/\bO-O-O\b/g, 'castles queen side').replace(/\bO-O\b/g, 'castles king side');
  // SAN moves: optional piece, optional disambiguation, optional capture, square, promotion, check/mate.
  s = s.replace(/\b([KQRBN])?([a-h])?([1-8])?(x)?([a-h])([1-8])(=([QRBN]))?([+#])?(?=\W|$)/g, (_m, pc, df, dr, x, f, r, _p, promo, sign) => {
    const parts: string[] = [];
    if (pc) parts.push(PIECE[pc]);
    if (df) parts.push(sayFile(df));
    if (dr) parts.push(NUM[Number(dr)]);
    if (x) parts.push('takes');
    parts.push(saySquare(f, r));
    let out = parts.join(' ');
    if (promo) out += ` becomes ${PROMO[promo]}`;
    if (sign === '+') out += ', check';
    if (sign === '#') out += ', checkmate';
    return out;
  });
  return s;
}
