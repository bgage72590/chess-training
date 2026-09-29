// The map: an island of 8 ranks (Rank 1 at the bottom). The Pawn Buddy stands on the current
// node; a big sticky PLAY runs the warm-up (if due) and then the next node.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { updateKid, type KidProfile } from '../store/kidsStore';
import { speech } from '../player/speech';
import { REGISTRY } from '../packs';
import { WORLDS, nodesOf, type NodeDef, type WorldDef } from '../curriculum/worlds';
import { activeNodes, bossPassed, earnedStars, canGraduate, crownOf, currentWorld, frontierNode, nextNode, nodeUnlocked, totalStars, visibleTo, warmupPlan, worldPassed, worldUnlocked } from '../store/progress';
import { NodeBubble } from '../ui/NodeBubble';
import { WorldBand } from '../ui/WorldBand';
import { PawnBuddy } from '../ui/PawnBuddy';
import { PlayButton, BigButton } from '../ui/BigButton';
import { KidsIcon } from '../ui/KidsIcon';
import { BossRequirement } from '../ui/BossCard';
import { Pip } from '../ui/Pip';
import { StarRow, starsText } from '../ui/StarRow';
import { useIsLandscape } from '../ui/useLayout';
import { go } from '../routes';
import { markOpened, newlyOpened, openIds } from '../lib/unlockSeen';

/** Kids who already did (or skipped) today's warm-up in this session. */
export const warmupDone = new Set<string>();

const ZIG = [50, 74, 50, 26];

/** The path draws itself, then the new stone pops (ms after the map appears). */
const DRAW_AT = 350;
const DRAW_MS = 650;
const POP_AT = DRAW_AT + DRAW_MS - 100;

export function MapScreen({ kid }: { kid: KidProfile }) {
  const landscape = useIsLandscape();
  const next = nextNode(kid, REGISTRY);
  const frontier = frontierNode(kid, REGISTRY);
  const scroller = useRef<HTMLDivElement>(null);
  const stars = totalStars(kid);
  const playgroundOpen = kid.start === 'games' || worldPassed(kid, 'w5', REGISTRY);
  const graduate = canGraduate(kid, REGISTRY) && !kid.graduated;
  const [hopKey] = useState(() => Date.now());
  // What opened since the map was last drawn gets a one-time unlock animation. Worked out once per
  // visit; the played ones are not new to the kid, so only worlds and unplayed nodes count.
  const [fresh] = useState(() => new Set(newlyOpened(kid.id, openIds(kid, REGISTRY)).filter((id) => !kid.nodes[id]?.plays && !kid.nodes[id]?.tested)));
  useEffect(() => markOpened(kid.id, openIds(kid, REGISTRY)), []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = scroller.current?.querySelector('.k-node.current') ?? scroller.current?.querySelector(`#k-world-${currentWorld(kid, REGISTRY)}`);
    // Instant: the map's own smooth scrolling would whoosh down from Rank 8 on every visit.
    el?.scrollIntoView({ block: 'center', behavior: 'instant' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = () => {
    if (graduate) return go.graduate();
    if (!warmupDone.has(kid.id) && warmupPlan(kid, REGISTRY).length) return go.warmup();
    if (next) go.play(next.id);
  };

  return (
    <div className={`k-screen k-map${landscape ? ' landscape' : ''}`}>
      <MapBar kid={kid} stars={stars} playgroundOpen={playgroundOpen} />
      <div className="k-map-wrap">
        <div className="k-map-scroll" ref={scroller}>
          {graduate && (
            <div className="k-card k-grad-banner">
              <KidsIcon name="crown" size={40} fill />
              <span>You reached the top! Time to promote!</span>
              <BigButton variant="primary" icon="crown" onClick={() => go.graduate()}>
                Promote!
              </BigButton>
            </div>
          )}
          {[...WORLDS].reverse().map((w) => (
            <WorldOnMap key={w.id} kid={kid} world={w} current={frontier?.id} hopKey={hopKey} fresh={fresh} />
          ))}
          <div className="k-map-shore" aria-hidden="true" />
        </div>
        {landscape && <MapSide kid={kid} next={next} />}
      </div>
      <div className="k-map-play">
        <PlayButton onClick={play} label={graduate ? 'Promote!' : 'Play!'} disabled={!next && !graduate} />
      </div>
    </div>
  );
}

export function MapBar({ kid, stars, playgroundOpen, back }: { kid: KidProfile; stars: number; playgroundOpen?: boolean; back?: () => void }) {
  return (
    <header className="k-mapbar">
      {back ? (
        <button type="button" className="k-round k-round-plain" aria-label="Back to the map" onClick={back}>
          <KidsIcon name="back" size={28} />
        </button>
      ) : (
        <button type="button" className="k-avatar-chip" onClick={() => go.players()} aria-label="Switch player">
          <PawnBuddy color={kid.avatar.color} face={kid.avatar.face} hat={kid.graduated ? 'crown' : kid.avatar.hat} size={40} />
          <span className="k-avatar-chip-name">{kid.name}</span>
        </button>
      )}
      <span className="k-stars-total" role="img" aria-label={starsText(stars)}>
        <KidsIcon name="star" size={26} fill /> {stars}
      </span>
      <span className="k-mapbar-gap" />
      <button
        type="button"
        className={`k-round k-round-plain k-mute${kid.settings.muted ? ' on' : ''}`}
        aria-label="Sound"
        aria-pressed={!kid.settings.muted}
        title={kid.settings.muted ? 'Sound is off' : 'Sound is on'}
        onClick={() => {
          const muted = !kid.settings.muted;
          if (muted) speech.cancel();
          updateKid(kid.id, (d) => void (d.settings.muted = muted));
        }}
      >
        <KidsIcon name={kid.settings.muted ? 'mute' : 'speaker'} size={28} />
      </button>
      <button type="button" className="k-pillbtn sea" aria-label="Sticker book" onClick={() => go.stickers()}>
        <KidsIcon name="book" size={26} />
        <span className="k-pill-label">Stickers</span>
      </button>
      <button type="button" className={`k-pillbtn ${playgroundOpen ? 'grass' : 'plain locked'}`} aria-label={playgroundOpen ? 'Playground' : 'Playground (opens after Rank 5)'} onClick={() => go.playground()}>
        <KidsIcon name={playgroundOpen ? 'gift' : 'lock'} size={26} />
        <span className="k-pill-label">Playground</span>
      </button>
    </header>
  );
}

function WorldOnMap({ kid, world, current, hopKey, fresh }: { kid: KidProfile; world: WorldDef; current?: string; hopKey: number; fresh: Set<string> }) {
  const unlocked = worldUnlocked(kid, world.id, REGISTRY);
  const nodes = nodesOf(world.id).filter((n) => visibleTo(n, kid.band));
  const nextWorld = WORLDS[world.rank];
  // Totals count only nodes that can be played now ("Coming soon" nodes wait for their pack).
  const playable = activeNodes(world.id, kid.band, REGISTRY).filter((n) => !n.bonus);
  const got = playable.reduce((a, n) => a + earnedStars(kid.nodes[n.id]), 0);
  const rows = nodes.length;
  const pts = nodes.map((_, i) => ({ x: ZIG[i % 4], y: (rows - 1 - i) * 116 + 50 }));
  return (
    <WorldBand
      world={world}
      crown={crownOf(kid, world.id, REGISTRY)}
      locked={!unlocked}
      opening={fresh.has(world.id)}
      onOpen={() => go.world(world.id)}
      starsText={unlocked && playable.length ? `${got} / ${playable.length * 3}` : undefined}
      footer={
        !unlocked && (
          <div className="k-world-lock">
            <KidsIcon name="cloud" size={36} fill />
            <BigButton variant="info" size="small" icon="flag" onClick={() => go.placement(world.rank)}>
              Challenge to skip ahead
            </BigButton>
          </div>
        )
      }
    >
      <div className="k-path" style={{ height: rows * 116 }}>
        <svg className="k-trail" viewBox={`0 0 100 ${rows * 116}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
        {nodes.map((n, i) =>
          fresh.has(n.id) && i > 0 ? (
            <span key={`draw-${n.id}`} className="k-trail-draw" style={{ top: pts[i].y, height: pts[i - 1].y - pts[i].y, ['--dt' as string]: `${DRAW_AT}ms`, ['--dd' as string]: `${DRAW_MS}ms` }} aria-hidden="true">
              <svg viewBox={`0 0 100 ${pts[i - 1].y - pts[i].y}`} preserveAspectRatio="none">
                <polyline points={`${pts[i - 1].x},${pts[i - 1].y - pts[i].y} ${pts[i].x},0`} fill="none" vectorEffect="non-scaling-stroke" />
              </svg>
            </span>
          ) : null,
        )}
        {nodes.map((n, i) => (
          <MapNode
            key={n.id}
            kid={kid}
            node={n}
            world={world}
            next={nextWorld}
            x={pts[i].x}
            y={pts[i].y - 50}
            current={current === n.id}
            hopKey={hopKey}
            worldUnlocked={unlocked}
            fresh={fresh.has(n.id) ? (i > 0 ? POP_AT : DRAW_AT) : undefined}
          />
        ))}
      </div>
    </WorldBand>
  );
}

function MapNode({ kid, node, world, next, x, y, current, hopKey, worldUnlocked: wu, fresh }: { kid: KidProfile; node: NodeDef; world: WorldDef; next?: WorldDef; x: number; y: number; current: boolean; hopKey: number; worldUnlocked: boolean; fresh?: number }) {
  const registered = REGISTRY.isRegistered(node.id);
  const open = registered && wu && nodeUnlocked(kid, node.id, REGISTRY);
  const state = !registered ? 'soon' : open ? 'open' : 'locked';
  const np = kid.nodes[node.id];
  const isFresh = state === 'open' && fresh != null;
  return (
    <div className={`k-path-node${isFresh ? ' fresh' : ''}`} style={{ left: `${x}%`, top: y, ...(isFresh && { ['--ud' as string]: `${fresh}ms` }) }}>
      <NodeBubble node={node} np={np} state={state} current={current} accent={world.accent} fresh={isFresh} onPress={() => go.play(node.id)}>
        {current && (
          <span className="k-node-buddy" key={hopKey}>
            <PawnBuddy color={kid.avatar.color} face={kid.avatar.face} hat={kid.avatar.hat} size={46} className="k-bob" />
          </span>
        )}
      </NodeBubble>
      <span className="k-node-title">{node.title}</span>
      {node.boss && registered && wu && !bossPassed(kid, node) && !np?.skipped && <BossRequirement node={node} band={kid.band} next={next} />}
    </div>
  );
}

function MapSide({ kid, next }: { kid: KidProfile; next: NodeDef | null }) {
  const w = WORLDS.find((x) => x.id === currentWorld(kid, REGISTRY))!;
  const flowers = kid.garden % 5 || (kid.garden ? 5 : 0);
  return (
    <aside className="k-map-side">
      <div className="k-card k-garden">
        <h3 className="k-card-title">Pip&rsquo;s Garden</h3>
        <div className="k-pots" role="img" aria-label={`${kid.garden} ${kid.garden === 1 ? 'flower' : 'flowers'} planted`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`k-pot${i < flowers ? ' bloom' : ''}`}>
              <Flower on={i < flowers} i={i} />
            </span>
          ))}
        </div>
        <p className="k-small">
          {kid.garden} {kid.garden === 1 ? 'flower' : 'flowers'} so far
        </p>
      </div>
      {next && (
        <div className="k-card k-nextup">
          <h3 className="k-card-title">Next up</h3>
          <p className="k-nextup-title">{next.title}</p>
          <StarRow stars={kid.nodes[next.id]?.stars ?? 0} size={20} />
          <BigButton variant="go" size="small" icon="play" onClick={() => go.play(next.id)}>
            Play
          </BigButton>
        </div>
      )}
      <div className="k-card k-tip">
        <Pip size={64} />
        <p>{w.intro}</p>
      </div>
    </aside>
  );
}

export function Flower({ on, i }: { on: boolean; i: number }) {
  const petal = ['#ff9f7f', '#ffc83d', '#c9b3ff', '#f4a3c1', '#7ab0e0'][i % 5];
  return (
    <svg viewBox="0 0 40 56" width="34" height="48" aria-hidden="true">
      <path d="M8 40h24l-3 14H11z" fill="#c98d4f" stroke="#1f2a44" strokeWidth="2.5" strokeLinejoin="round" />
      {on ? (
        <>
          <path d="M20 40V22" stroke="#3f8f4f" strokeWidth="3" strokeLinecap="round" />
          <path d="M20 32c-6 0-8-4-7-7 5 0 7 3 7 7z" fill="#9ad48f" />
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="20" cy="11" rx="4.5" ry="6.5" fill={petal} stroke="#1f2a44" strokeWidth="1.5" transform={`rotate(${a} 20 17)`} />
          ))}
          <circle cx="20" cy="17" r="4" fill="#ffc83d" stroke="#1f2a44" strokeWidth="1.5" />
        </>
      ) : (
        <path d="M20 40v-4" stroke="#8b5a2b" strokeWidth="3" strokeLinecap="round" />
      )}
    </svg>
  );
}
