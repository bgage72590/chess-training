// Move dots (spec 10.2 showDests): 'always'; 'until-mastered' shows them until the moving piece's
// world boss has 3 stars; 'on-mistake' only after a mistake (the activity adds that part).
import { bossOf, type WorldId } from '../curriculum/worlds';
import type { KidProfile } from '../store/kidsStore';

/** The world that teaches each piece (the king is met in Queen Castle). */
export const PIECE_WORLD: Record<string, WorldId> = { R: 'w1', B: 'w2', Q: 'w3', K: 'w3', N: 'w4', P: 'w5' };

/** The piece's world boss has 3 stars. */
export function pieceMastered(kid: KidProfile, piece: string): boolean {
  const bossId = bossOf(PIECE_WORLD[piece.toUpperCase()] ?? 'w1')?.id;
  return !!bossId && (kid.nodes[bossId]?.stars ?? 0) >= 3;
}

/** Whether dots show for this piece before any mistake. */
export function dotsFor(kid: KidProfile, piece: string | undefined): boolean {
  const s = kid.settings.showDests;
  if (s === 'always') return true;
  if (s === 'until-mastered') return !pieceMastered(kid, piece ?? 'R');
  return false;
}
