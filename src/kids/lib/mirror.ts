// Reflecting a position left to right (a <-> h). Piece rules are symmetric, so a mirrored puzzle has
// the same answer as the original: a replay looks fresh without new content.
import type { Placement, Sq } from '../activities/types';

export const flipSq = (s: Sq): Sq => String.fromCharCode(104 - (s.charCodeAt(0) - 97)) + s[1];

export const flipSqs = (list: Sq[]): Sq[] => list.map(flipSq);

export const flipPlacement = (p: Placement): Placement => Object.fromEntries(Object.entries(p).map(([s, pc]) => [flipSq(s), pc]));

/** 'a1:d4' becomes 'h1:e4'. */
export const flipArea = (area: string): string => area.split(':').map(flipSq).join(':');
