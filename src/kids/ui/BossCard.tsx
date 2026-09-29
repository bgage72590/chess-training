// The boss card: what it takes to open the next rank, shown before the boss is played.
import type { AgeBand } from '../activities/types';
import type { NodeDef, WorldDef } from '../curriculum/worlds';
import { bossPassMark } from '../store/progress';
import { BigButton } from './BigButton';
import { KidsIcon } from './KidsIcon';
import { StarShape, StarRow, starsText } from './StarRow';
import type { NodeProgress } from '../store/kidsStore';

export function BossRequirement({ node, band, next }: { node: NodeDef; band: AgeBand; next?: WorldDef }) {
  const opens = next ? `Rank ${next.rank}` : 'the crown';
  // On the map's narrow column the words shrink to a couple of icons, so the pill stays off the next stone (kids.css).
  if (node.game)
    return (
      <span className="k-boss-req" role="img" aria-label={`Win to open ${opens}`}>
        <KidsIcon name="trophy" size={22} />
        <span className="k-boss-long">Win to open {opens}!</span>
        <span className="k-boss-short">Win!</span>
      </span>
    );
  const n = bossPassMark(band);
  return (
    <span className="k-boss-req" role="img" aria-label={`${starsText(n)} opens ${opens}`}>
      {Array.from({ length: n }, (_, i) => (
        <StarShape key={i} filled={false} size={22} />
      ))}
      <KidsIcon name="lock" size={20} />
      <span className="k-boss-long">opens {opens}</span>
    </span>
  );
}

export function BossCard({ node, np, band, next, passed, onPlay, disabled }: { node: NodeDef; np?: NodeProgress; band: AgeBand; next?: WorldDef; passed: boolean; onPlay(): void; disabled?: boolean }) {
  const skipped = !passed && !!np?.skipped;
  return (
    <div className={`k-card k-bosscard${passed ? ' passed' : ''}`}>
      <span className="k-bosscard-icon" aria-hidden="true">
        <KidsIcon name={node.final ? 'crown' : 'castle'} size={44} />
      </span>
      <div className="k-bosscard-main">
        <span className="k-bosscard-kicker">Boss</span>
        <h3 className="k-bosscard-title">{node.title}</h3>
        {passed ? (
          <span className="k-boss-req done">
            <KidsIcon name="check" size={22} /> Passed!
          </span>
        ) : skipped ? (
          // Skipping opened the next rank already, so the pass mark is not asked for again.
          <span className="k-boss-req done">
            <KidsIcon name="leaf" size={22} /> Come back later
          </span>
        ) : (
          <BossRequirement node={node} band={band} next={next} />
        )}
        {!!np?.stars && !skipped && <StarRow stars={np.stars} size={20} golden={np.golden} />}
      </div>
      <BigButton variant="boss" icon="play" onClick={onPlay} disabled={disabled}>
        {np?.plays ? 'Again' : 'Play'}
      </BigButton>
    </div>
  );
}
