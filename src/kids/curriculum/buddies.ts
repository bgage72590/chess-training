// Buddy metadata only (names, colors, ladders, ease labels). Move logic lives in Pack D.
import type { AgeBand } from '../activities/types';

export type BuddyId = 'shelly' | 'hop' | 'tuck' | 'fern' | 'olive' | 'bruno' | 'ember';

export interface BuddyDef {
  id: BuddyId;
  name: string;
  animal: string;
  color: string;
  /** Optional Champion buddies never gate a trophy. */
  optional?: boolean;
  /** Short personality line for the buddy card. */
  line: string;
}

export const BUDDIES: Record<BuddyId, BuddyDef> = {
  shelly: { id: 'shelly', name: 'Shelly', animal: 'Snail', color: '#f4a3c1', line: 'Slow and cheerful.' },
  hop: { id: 'hop', name: 'Hop', animal: 'Bunny', color: '#f2f2f2', line: 'Loves to grab things!' },
  tuck: { id: 'tuck', name: 'Tuck', animal: 'Turtle', color: '#7cc47f', line: 'Careful, most of the time.' },
  fern: { id: 'fern', name: 'Fern', animal: 'Fox', color: '#ff9a4d', line: 'Clever and quick.' },
  olive: { id: 'olive', name: 'Olive', animal: 'Owl', color: '#b48a5a', line: 'Wise and watchful.' },
  bruno: { id: 'bruno', name: 'Bruno', animal: 'Bear', color: '#8b5a2b', optional: true, line: 'Big and strong.' },
  ember: { id: 'ember', name: 'Ember', animal: 'Dragon', color: '#e2554a', optional: true, line: 'Fiery and fierce!' },
};

/** Band ladders for trophies and the "next buddy" suggestion (optional buddies excluded). */
export const BAND_LADDER: Record<AgeBand, BuddyId[]> = {
  sprout: ['shelly', 'hop', 'tuck'],
  explorer: ['shelly', 'hop', 'tuck', 'fern', 'olive'],
  champion: ['shelly', 'hop', 'tuck', 'fern', 'olive'],
};

/** Buddies a band may meet at all (Champions add the optional Bruno and Ember). */
export const BAND_BUDDIES: Record<AgeBand, BuddyId[]> = {
  sprout: BAND_LADDER.sprout,
  explorer: BAND_LADDER.explorer,
  champion: [...BAND_LADDER.champion, 'bruno', 'ember'],
};

/** "Zzz" marks shown on the buddy card for the ease step (0-2 marks). */
export const easeMarks = (ease: number) => Math.min(2, Math.max(0, ease));
