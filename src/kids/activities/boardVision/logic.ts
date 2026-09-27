// Board Explorer rules, validation and the warm-up generator (spec 13.3). Pure (no React/DOM).
import type { AgeBand, ItemMeta, PieceCode, Placement, Sq } from '../types';
import { bandText } from '../types';
import { fenPlacement, isSq } from '../../lib/fen';
import { ALL_SQUARES } from '../../lib/miniRules';
import { SQUARE_RE } from '../../lib/pronounce';
import { pick, shuffle } from '../../lib/rng';

export type LineKind = 'file' | 'rank' | 'diagonal';
export type AskPiece = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export type BoardVisionItem =
  | { kind: 'tap-color'; color: 'light' | 'dark'; count: 1 | 2 | 3 }
  | { kind: 'tap-line'; through: Sq; line: LineKind }
  | { kind: 'name-piece'; fen: string; ask: AskPiece; color?: 'w' | 'b' }
  | { kind: 'find-square'; squares: Sq[] | 'random'; rounds: number; fadeCoords?: boolean; timer?: number; bestKey?: string }
  | { kind: 'setup'; pieces: string; rank?: 1; colorHints?: boolean };

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const PIECE_NAME: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };

const FILES = 'abcdefgh';
const fr = (s: Sq): [number, number] => [FILES.indexOf(s[0]), Number(s[1]) - 1];

/** a1 is dark; squares alternate. */
export const isLight = (s: Sq) => {
  const [f, r] = fr(s);
  return (f + r) % 2 === 1;
};

/** Every square on a line through `through`. For diagonals, the longer of the two. */
export function lineSquares(through: Sq, line: LineKind): Sq[] {
  const [f, r] = fr(through);
  if (line === 'file') return ALL_SQUARES.filter((s) => s[0] === through[0]);
  if (line === 'rank') return ALL_SQUARES.filter((s) => s[1] === through[1]);
  const a = ALL_SQUARES.filter((s) => {
    const [x, y] = fr(s);
    return x - y === f - r;
  });
  const b = ALL_SQUARES.filter((s) => {
    const [x, y] = fr(s);
    return x + y === f + r;
  });
  return a.length >= b.length ? a : b;
}

/** The squares and pieces a setup item asks for. Tokens: an 8-letter rank pattern (rank 1, then
 *  rank 2 after a '/'), or a single letter meaning that piece's start squares (e.g. 'R' = a1 and h1). */
export function setupTargets(pieces: string): Placement {
  const out: Placement = {};
  const back = 'RNBQKBNR';
  pieces.split('/').forEach((part, i) => {
    for (const tok of part.trim().split(/\s+/).filter(Boolean)) {
      if (tok.length === 8) {
        for (let f = 0; f < 8; f++) out[FILES[f] + (i + 1)] = tok[f] as PieceCode;
      } else if (tok === 'P') {
        for (let f = 0; f < 8; f++) out[FILES[f] + 2] = 'P';
      } else {
        for (let f = 0; f < 8; f++) if (back[f] === tok) out[FILES[f] + 1] = tok as PieceCode;
      }
    }
  });
  return out;
}

/** Setup hints never say left or right: they point at neighbours and colors. */
export function setupTip(p: PieceCode, colorHints: boolean): string {
  switch (p.toUpperCase()) {
    case 'R':
      return 'Rooks go in the corners!';
    case 'N':
      return 'Knights stand next to the rooks.';
    case 'B':
      return 'Bishops stand next to the knights.';
    case 'Q':
      return colorHints ? 'Queen on her own color!' : 'The queen goes on her own color.';
    case 'K':
      return 'The king stands next to the queen.';
    default:
      return 'Pawns stand in a row in front.';
  }
}

export function validateBoardVision(item: BoardVisionItem & ItemMeta, band: AgeBand): string[] {
  const errs: string[] = [];
  switch (item.kind) {
    case 'tap-color':
      if (!['light', 'dark'].includes(item.color)) errs.push('bad color');
      if (![1, 2, 3].includes(item.count)) errs.push('count must be 1-3');
      break;
    case 'tap-line':
      if (!isSq(item.through)) errs.push('bad square');
      else if (lineSquares(item.through, item.line).length < 3) errs.push('line too short');
      if (band === 'sprout' && item.line === 'diagonal') errs.push('sprouts get files and ranks only');
      break;
    case 'name-piece': {
      const p = fenPlacement(item.fen ?? '');
      const has = Object.values(p).some((pc) => pc!.toLowerCase() === item.ask && (!item.color || (item.color === 'w') === (pc === pc!.toUpperCase())));
      if (!has) errs.push('fen lacks the asked piece');
      break;
    }
    case 'find-square':
      if (item.squares !== 'random' && (!Array.isArray(item.squares) || !item.squares.length || item.squares.some((s) => !isSq(s)))) errs.push('bad squares');
      if (!(item.rounds >= 1)) errs.push('rounds must be at least 1');
      if (band === 'sprout') errs.push('find-square is for Explorers and Champions');
      break;
    case 'setup':
      if (!/^[RNBQKP /]+$/.test(item.pieces ?? '') || !Object.keys(setupTargets(item.pieces)).length) errs.push('setup string must use only RNBQKP');
      break;
    default:
      errs.push('unknown kind');
  }
  if (band === 'sprout' && SQUARE_RE.test(bandText(item.say, band))) errs.push('sprout text contains a square name');
  return errs;
}

/** Warm-up items: a road, a color hunt, or (E and C) a short treasure hunt. */
export function reviewBoardVision(rng: () => number, band: AgeBand): BoardVisionItem {
  const r = rng();
  if (r < 0.4) {
    const lines: LineKind[] = band === 'sprout' ? ['file', 'rank'] : ['file', 'rank', 'diagonal'];
    return { kind: 'tap-line', through: pick(rng, ALL_SQUARES), line: pick(rng, lines) };
  }
  if (r < 0.7 || band === 'sprout') return { kind: 'tap-color', color: rng() < 0.5 ? 'light' : 'dark', count: pick(rng, [1, 2, 3] as const) };
  return { kind: 'find-square', squares: shuffle(rng, ALL_SQUARES).slice(0, 4), rounds: 4 };
}
