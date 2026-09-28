// How fast the computer answers on the grown-up side: how long it waits after your move, and how
// slowly its pieces glide. One setting (Settings > Computer reply speed, also on the Play screen)
// for games, puzzles, openings, endgames and lessons, so a reply is easy to see.
import { getProfile, type ReplySpeed } from '../store/profile';

export type { ReplySpeed };

interface Pace {
  /** Multiplies every wait before a reply. */
  mult: number;
  /** No reply comes sooner than this (ms), and none takes longer than `cap`. */
  floor: number;
  cap: number;
  /** How long the computer's pieces glide to their square (ms); see board.css. */
  glide: number;
}

export const PACES: Record<ReplySpeed, Pace> = {
  relaxed: { mult: 1.8, floor: 1000, cap: 4500, glide: 620 },
  standard: { mult: 1, floor: 0, cap: Infinity, glide: 340 },
  quick: { mult: 0.55, floor: 0, cap: Infinity, glide: 220 },
};

export const REPLY_SPEED_LABELS: Record<ReplySpeed, string> = { relaxed: 'Relaxed', standard: 'Standard', quick: 'Quick' };

/** The speed the user chose (Relaxed until they change it). */
export const replySpeed = (): ReplySpeed => getProfile().settings.replySpeed ?? 'relaxed';

/** A wait before the computer's reply, at the chosen speed (`base` is the Standard wait). */
export function paceMs(base: number, speed: ReplySpeed = replySpeed()): number {
  const p = PACES[speed];
  return Math.round(Math.min(p.cap, Math.max(p.floor, base * p.mult)));
}
