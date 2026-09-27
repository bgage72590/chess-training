// Paint the Moves rules, validation and the warm-up generator (spec 13.4). Pure (no React/DOM).
import type { AgeBand, ItemMeta, PieceCode, Placement, Sq } from '../types';
import { bandText } from '../types';
import { isSq } from '../../lib/fen';
import { ALL_SQUARES, dests } from '../../lib/miniRules';
import { SQUARE_RE } from '../../lib/pronounce';
import { pick } from '../../lib/rng';

export interface PaintItem {
  pieces: Placement; // exactly 1 white piece
  blockers?: Sq[]; // white friends (drawn as white pawns)
  enemies?: Placement; // black pieces: capturing them counts
}

/** The one white piece of an item. */
export function paintPiece(item: PaintItem): [Sq, PieceCode] | null {
  const e = Object.entries(item.pieces ?? {}).filter(([, p]) => p && p === p.toUpperCase());
  return e.length === 1 ? (e[0] as [Sq, PieceCode]) : null;
}

/** Every square the piece may move to (captures of enemies included; blockers stop it). */
export function paintTargets(item: PaintItem): Sq[] {
  const pp = paintPiece(item);
  if (!pp) return [];
  return dests(pp[1], pp[0], { blocked: new Set(item.blockers ?? []), capturable: new Set(Object.keys(item.enemies ?? {})) });
}

/** What the board shows: the piece, blockers as white pawns, enemies. */
export function paintBoard(item: PaintItem): Placement {
  const out: Placement = { ...(item.enemies ?? {}) };
  for (const b of item.blockers ?? []) out[b] = 'P';
  return { ...out, ...item.pieces };
}

export function validatePaint(item: PaintItem & ItemMeta, band: AgeBand): string[] {
  const errs: string[] = [];
  const all = Object.entries(item.pieces ?? {});
  if (all.length !== 1 || !paintPiece(item)) errs.push('needs exactly one white piece');
  const sqs = [...all.map(([s]) => s), ...(item.blockers ?? []), ...Object.keys(item.enemies ?? {})];
  if (sqs.some((s) => !isSq(s))) errs.push('bad square');
  if (new Set(sqs).size !== sqs.length) errs.push('overlapping squares');
  if (Object.values(item.enemies ?? {}).some((p) => !p || p !== p.toLowerCase())) errs.push('enemies must be black');
  if (!errs.length && paintTargets(item).length < 1) errs.push('no squares to paint');
  if (band === 'sprout' && SQUARE_RE.test(bandText(item.say, band))) errs.push('sprout text contains a square name');
  return errs;
}

export function reviewPaint(rng: () => number, band: AgeBand): PaintItem {
  const piece = pick(rng, (band === 'sprout' ? ['R', 'B', 'N'] : ['R', 'B', 'Q', 'N', 'K']) as PieceCode[]);
  return { pieces: { [pick(rng, ALL_SQUARES)]: piece } };
}
