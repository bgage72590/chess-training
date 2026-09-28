// The results card's one-line recap (Pip says it too). Pure, so the choice of line is tested.
import type { AgeBand, ItemResult } from '../activities/types';
import type { RunOutcome } from '../store/progress';

/** A non-game boss below the pass mark: say what opens the next rank, from the first attempt. */
export function belowPassRecap(score: number, need: number, rank: number, band: AgeBand): string {
  const got = score === 1 ? 'one star' : score === 2 ? 'two stars' : 'three stars';
  const want = need === 1 ? 'one star' : need === 2 ? 'two stars' : 'three stars';
  if (band === 'champion') return `${score} of ${need} stars. Get ${need} to open Rank ${rank}.`;
  return `You got ${got}! Get ${want} to open Rank ${rank}. Try again?`;
}

export function recapFor(o: Pick<RunOutcome, 'score' | 'bossPassedNow'>, title: string, band: AgeBand, game: boolean, results: ItemResult[]): string {
  // The Golden Rules mission scores its checklist, not a win or a draw.
  const rules = results[0]?.stats?.rules;
  if (game && rules !== undefined) return band === 'champion' ? `${rules} of 5 Golden Rules.` : `You got ${rules} of 5 Golden Rules!`;
  if (game) return o.score === 3 ? 'You won! Brilliant playing!' : o.score === 2 ? "A draw! That's a good fight." : 'Good game! Every game makes you stronger.';
  if (o.bossPassedNow) return band === 'champion' ? `${title} complete.` : `You beat ${title}! Amazing!`;
  // Three stars can round up from a slip or a hint; "perfect" needs a clean run.
  const clean = results.every((r) => r.mistakes === 0 && r.hintLevel === 0);
  if (o.score === 3 && clean) return band === 'champion' ? 'Clean and efficient.' : 'Perfect! You found the best way!';
  if (o.score >= 2) return 'Great job! You kept thinking.';
  return 'You did it! Practice makes it easier.';
}
