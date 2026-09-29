// A node on the map: a round stone (boss = castle, final = tower) with its piece or icon and stars.
import type { NodeDef } from '../curriculum/worlds';
import type { NodeProgress } from '../store/kidsStore';
import { KidsIcon } from './KidsIcon';
import { StarRow, starsText } from './StarRow';

export type NodeState = 'locked' | 'open' | 'soon';

export function NodeIcon({ node, size = 40 }: { node: NodeDef; size?: number }) {
  if (node.piece) return <span className={`k-node-piece pc-w${node.piece.toUpperCase()}`} style={{ width: size, height: size }} aria-hidden="true" />;
  const icon = node.activity === 'board-vision' ? 'eye' : node.activity === 'quiz' ? 'puzzle' : node.activity === 'play-bot' || node.activity === 'battle' ? 'swords' : node.activity === 'puzzles' ? 'puzzle' : 'star';
  return <KidsIcon name={icon} size={Math.round(size * 0.8)} />;
}

export function NodeBubble({
  node,
  np,
  state,
  current,
  accent,
  onPress,
  fresh,
  children,
}: {
  node: NodeDef;
  np?: NodeProgress;
  state: NodeState;
  current?: boolean;
  accent: string;
  onPress?: () => void;
  /** Just opened: sparkles burst from the stone (the map pops the whole node, see motion-nav.css). */
  fresh?: boolean;
  children?: React.ReactNode;
}) {
  const shape = node.final ? 'tower' : node.boss ? 'castle' : node.bonus ? 'flower' : 'round';
  const label = `${node.title}${state === 'locked' ? ', locked' : state === 'soon' ? ', coming soon' : np?.skipped ? ', come back later' : np?.tested && !np.plays ? ', tested out' : np?.stars ? `, ${starsText(np.stars)}` : ''}`;
  return (
    <div className={`k-node ${shape} ${state}${current ? ' current' : ''}${np?.skipped ? ' skipped' : ''}${fresh ? ' fresh' : ''}`} style={{ ['--acc' as string]: accent }}>
      <button type="button" className="k-node-btn" onClick={onPress} disabled={state !== 'open'} aria-label={label}>
        {shape === 'castle' || shape === 'tower' ? (
          <svg className="k-node-shape" viewBox="0 0 100 100" aria-hidden="true">
            {shape === 'castle' ? (
              <path d="M10 92V34h14v12h12V34h28v12h12V34h14v58z" />
            ) : (
              <path d="M24 94V30h10v10h10V30h12v10h10V30h10v64zM34 30l16-24 16 24z" />
            )}
          </svg>
        ) : null}
        <span className="k-node-face">{state === 'locked' ? <KidsIcon name="lock" size={30} /> : <NodeIcon node={node} size={node.boss ? 46 : 40} />}</span>
        {np?.tested && !np.plays && (
          <span className="k-node-badge plane" title="Tested out">
            <KidsIcon name="plane" size={18} />
          </span>
        )}
        {np?.skipped && (
          <span className="k-node-badge leaf" title="Come back later">
            <KidsIcon name="leaf" size={18} />
          </span>
        )}
        {np?.leaf && !np.skipped && (
          <span className="k-node-badge leaf" title="Practice leaf">
            <KidsIcon name="leaf" size={18} />
          </span>
        )}
        {np?.golden && <span className="k-node-golden" aria-hidden="true" />}
        {state === 'soon' && (
          <span className="k-node-cloud" aria-hidden="true">
            <KidsIcon name="cloud" size={44} fill />
          </span>
        )}
        {fresh && (
          <span className="k-node-burst" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <i key={i} style={{ ['--i' as string]: i }} />
            ))}
          </span>
        )}
      </button>
      {state !== 'soon' && <StarRow stars={np?.skipped ? 0 : np?.stars ?? 0} size={20} golden={np?.golden} />}
      {state === 'soon' && <span className="k-node-soon">Coming soon</span>}
      {children}
    </div>
  );
}
