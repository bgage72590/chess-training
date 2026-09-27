// How long a computer opponent "thinks" before moving, so its moves feel human instead of
// appearing the instant the user lets go of a piece: quick in the opening and on obvious
// replies (recaptures, the only legal move), longer when the position is rich.
import { Chess } from 'chess.js';

export interface ThinkInput {
  fen: string;
  /** How many moves the opponent has made this game (the opening goes faster). */
  moveNumber: number;
  /** The user's last move captured something (a recapture is quick). */
  afterCapture?: boolean;
  /** A 0..1 random number (injectable for tests). */
  rnd?: number;
}

export function thinkTimeMs({ fen, moveNumber, afterCapture = false, rnd = Math.random() }: ThinkInput): number {
  let legal = 20;
  let check = false;
  try {
    const c = new Chess(fen);
    legal = c.moves().length;
    check = c.inCheck();
  } catch {
    /* use the defaults */
  }
  if (legal <= 1) return 450 + rnd * 250;
  let ms = 900 + Math.min(legal, 40) * 22; // more choices, more thought
  if (moveNumber < 6) ms *= 0.55; // book-like opening moves
  if (afterCapture) ms *= 0.6; // recaptures are obvious
  if (check) ms *= 0.75; // few sensible replies
  ms *= 0.7 + rnd * 0.6; // natural variation
  return Math.round(Math.min(2600, Math.max(550, ms)));
}

/** Resolves when at least `ms` have passed since `startedAt` (performance.now()). */
export function waitUntil(startedAt: number, ms: number): Promise<void> {
  const left = ms - (performance.now() - startedAt);
  return left > 0 ? new Promise((r) => setTimeout(r, left)) : Promise.resolve();
}
