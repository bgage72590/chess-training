import type { KidProfile } from '../store/kidsStore';
import { totalStars } from '../store/progress';

/** The first star or solved puzzle on this device: from then on there is progress worth keeping, so
 *  the grown-ups' install banner (components/InstallGuide.tsx) may appear. */
export const kidsFinishedFirst = (kids: readonly KidProfile[]): boolean => kids.some((k) => totalStars(k) > 0 || k.puzzle.bestStreak > 0);
