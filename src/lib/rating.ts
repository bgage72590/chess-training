// Glicko-1 rating update used for the puzzle rating.
const Q = Math.log(10) / 400;
const g = (rd: number) => 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI));

export const RD_FLOOR = 65;
export const RD_START = 250;

export function expectedScore(r: number, rd: number, opp: number, oppRd = 80): number {
  void rd;
  return 1 / (1 + Math.pow(10, (-g(oppRd) * (r - opp)) / 400));
}

/** Returns the new rating and deviation after one game (score 1 = win, 0 = loss). */
export function glicko(r: number, rd: number, opp: number, score: 0 | 1, oppRd = 80): { r: number; rd: number } {
  const gj = g(oppRd);
  const e = expectedScore(r, rd, opp, oppRd);
  const d2 = 1 / (Q * Q * gj * gj * e * (1 - e));
  const denom = 1 / (rd * rd) + 1 / d2;
  const nr = r + (Q / denom) * gj * (score - e);
  const nrd = Math.max(RD_FLOOR, Math.sqrt(1 / denom));
  return { r: Math.round(Math.max(100, Math.min(3200, nr))), rd: nrd };
}

/** Rating deviation grows back slowly while the player is away. */
export function inflateRd(rd: number, daysAway: number): number {
  return Math.min(RD_START, Math.sqrt(rd * rd + 15 * 15 * Math.max(0, daysAway)));
}
