// A world up close: the banner, crown progress, Pip's world intro, and a card per node.
import { useEffect, useState } from 'react';
import type { KidProfile } from '../store/kidsStore';
import { isQuiet } from '../store/quiet';
import { REGISTRY } from '../packs';
import { WORLDS, WORLD_BY_ID, nodesOf, type WorldId } from '../curriculum/worlds';
import { bossPassed, crownOf, mastered, nextNode, nodeUnlocked, totalStars, visibleTo, worldPassed, worldUnlocked } from '../store/progress';
import { BossCard } from '../ui/BossCard';
import { BigButton } from '../ui/BigButton';
import { KidsIcon } from '../ui/KidsIcon';
import { NodeIcon } from '../ui/NodeBubble';
import { StarRow } from '../ui/StarRow';
import { Coach } from '../ui/Coach';
import { MapBar } from './MapScreen';
import { heardFirst, lineId, speech } from '../player/speech';
import { useKidCtx } from '../player/context';
import { go } from '../routes';

export function WorldScreen({ kid, worldId }: { kid: KidProfile; worldId: WorldId }) {
  const world = WORLD_BY_ID.get(worldId)!;
  const { tuning } = useKidCtx();
  const nodes = nodesOf(worldId).filter((n) => visibleTo(n, kid.band));
  const unlocked = worldUnlocked(kid, worldId, REGISTRY);
  const crown = crownOf(kid, worldId, REGISTRY);
  const nextW = WORLDS[world.rank];
  const current = nextNode(kid, REGISTRY);
  const [token, setToken] = useState<number | undefined>();
  const say = (onEnd?: () => void) => setToken(speech.speak([world.intro], { rate: kid.settings.rate ?? tuning.speechRate, pitch: tuning.pitch, clipRate: kid.settings.rate ?? undefined, onEnd }));

  // Pip's world intro is spoken on the first visit (until it has been heard to the end).
  useEffect(() => {
    const id = lineId(`world-${worldId}`);
    if (kid.settings.voice !== 'off' && !isQuiet(kid.id) && !kid.firsts.includes(id)) say(() => heardFirst(kid.id, id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId]);

  const counted = nodes.filter((n) => !n.bonus && REGISTRY.isRegistered(n.id));
  const masteredCount = counted.filter((n) => mastered(kid.nodes[n.id])).length;

  return (
    <div className="k-screen k-worldscreen" style={{ ['--wbg' as string]: world.bg, ['--acc' as string]: world.accent }}>
      <MapBar kid={kid} stars={totalStars(kid)} back={() => go.upToMap()} playgroundOpen={kid.start === 'games' || worldPassed(kid, 'w5', REGISTRY)} />
      <div className="k-world-banner">
        <div>
          <span className="k-rank">Rank {world.rank}</span>
          <h1 className="k-title">{world.title}</h1>
          <div className="k-crown-progress">
            <span className={`k-crown-slot ${crown ?? 'none'}`}>
              <KidsIcon name="crown" size={30} fill={!!crown} />
            </span>
            <span>
              {crown === 'gold' ? 'Gold crown!' : crown === 'silver' ? `Silver crown! ${masteredCount}/${counted.length} mastered for gold` : `${masteredCount}/${counted.length} mastered`}
            </span>
          </div>
        </div>
        <Coach text={world.intro} token={token} onSpeak={() => say()} size={80} />
      </div>
      {!unlocked && (
        <div className="k-card k-world-locked">
          <KidsIcon name="lock" size={32} />
          <p>Finish the rank before this one to open {world.title}.</p>
          <BigButton variant="info" icon="flag" onClick={() => go.placement(world.rank)}>
            Challenge to skip ahead
          </BigButton>
        </div>
      )}
      <div className="k-node-cards">
        {nodes.map((n) => {
          const np = kid.nodes[n.id];
          const registered = REGISTRY.isRegistered(n.id);
          const open = registered && nodeUnlocked(kid, n.id, REGISTRY);
          if (n.boss && registered)
            return <BossCard key={n.id} node={n} np={np} band={kid.band} next={nextW} passed={bossPassed(kid, n)} onPlay={() => go.play(n.id)} disabled={!open} />;
          return (
            <div key={n.id} className={`k-card k-nodecard${!registered ? ' soon' : !open ? ' locked' : ''}${current?.id === n.id ? ' current' : ''}`}>
              <span className="k-nodecard-icon" style={{ background: `color-mix(in srgb, ${world.accent} 22%, var(--k-card))` }}>
                {registered ? open ? <NodeIcon node={n} size={44} /> : <KidsIcon name="lock" size={30} /> : <KidsIcon name="cloud" size={34} fill />}
              </span>
              <div className="k-nodecard-main">
                <h3 className="k-nodecard-title">
                  {n.title}
                  {n.bonus && <span className="k-bonus">Bonus</span>}
                </h3>
                {registered ? <StarRow stars={np?.skipped ? 0 : np?.stars ?? 0} size={20} golden={np?.golden} /> : <span className="k-small">Coming soon</span>}
                {np?.tested && !np.plays && (
                  <span className="k-small">
                    <KidsIcon name="plane" size={16} /> Tested out
                  </span>
                )}
                {registered && (
                  <BigButton variant={np?.plays ? 'plain' : 'go'} size="small" icon={np?.plays ? 'again' : 'play'} disabled={!open} onClick={() => go.play(n.id)}>
                    {np?.plays ? 'Again' : 'Play'}
                  </BigButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
