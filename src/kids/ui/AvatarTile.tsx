// A kid on the profile picker: Pawn Buddy, name, rank, stars and garden flowers. No comparisons.
import type { KidProfile } from '../store/kidsStore';
import { PawnBuddy } from './PawnBuddy';
import { KidsIcon } from './KidsIcon';

export function AvatarTile({ kid, rank, stars, onPick, resting = false }: { kid: KidProfile; rank: number; stars: number; onPick(): void; resting?: boolean }) {
  return (
    <button type="button" className={`k-avatar-tile${resting ? ' resting' : ''}`} onClick={onPick} aria-label={`${kid.name || 'Player'}: Rank ${rank}${resting ? ', resting' : ''}`}>
      {resting && (
        <span className="k-avatar-zz" aria-hidden="true">
          z<small>z</small>
        </span>
      )}
      <PawnBuddy color={kid.avatar.color} face={kid.avatar.face} hat={kid.graduated ? 'crown' : kid.avatar.hat} size={96} />
      <span className="k-avatar-name">{kid.name || 'Player'}</span>
      <span className="k-avatar-meta">
        <span className="k-rank-badge">Rank {rank}</span>
      </span>
      <span className="k-avatar-meta">
        <span>
          <KidsIcon name="star" size={18} fill /> {stars}
        </span>
        <span>
          <KidsIcon name="leaf" size={18} /> {kid.garden}
        </span>
      </span>
    </button>
  );
}
