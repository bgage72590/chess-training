// A world on the map: a band in the world color with an illustrated header, a title, a crown
// slot, and the node path (a dotted trail between the stones).
import type { ReactNode } from 'react';
import type { WorldDef, WorldScene } from '../curriculum/worlds';
import { KidsIcon } from './KidsIcon';

function Scene({ scene, accent }: { scene: WorldScene; accent: string }) {
  const ink = '#1f2a44';
  const s = { stroke: ink, strokeWidth: 3, strokeLinejoin: 'round' as const };
  switch (scene) {
    case 'towers':
      return (
        <>
          <path d="M20 70V34h8v6h6v-6h8v6h6v-6h8v36z" fill="#fffaf0" {...s} />
          <path d="M250 70V42h7v5h6v-5h7v5h6v-5h7v28z" fill="#fffaf0" {...s} />
          <path d="M60 70h180" stroke={accent} strokeWidth="6" strokeLinecap="round" strokeDasharray="14 12" />
        </>
      );
    case 'woods':
      return (
        <>
          {[26, 56, 244, 272].map((x, i) => (
            <g key={x}>
              <path d={`M${x} 70v-10`} {...s} />
              <path d={`M${x - 14} 62 ${x} ${i % 2 ? 30 : 24}l14 38z`} fill={i % 2 ? '#7cc47f' : '#9ad48f'} {...s} />
            </g>
          ))}
        </>
      );
    case 'garden':
      return (
        <>
          {[30, 60, 240, 270].map((x, i) => (
            <g key={x}>
              <path d={`M${x} 70V52`} stroke="#3f8f4f" strokeWidth="3" />
              <circle cx={x} cy={46} r="9" fill={['#ff9f7f', '#f4a3c1', '#ffc83d', '#c9b3ff'][i]} {...s} />
              <circle cx={x} cy={46} r="3" fill="#fffaf0" />
            </g>
          ))}
        </>
      );
    case 'hills':
      return (
        <>
          <path d="M0 70c30-34 60-34 90 0z" fill="#d8c29a" {...s} />
          <path d="M210 70c30-40 60-40 90 0z" fill="#d8c29a" {...s} />
        </>
      );
    case 'parade':
      return (
        <>
          {[30, 270].map((x) => (
            <g key={x}>
              <path d={`M${x - 16} 70l16-34 16 34z`} fill={x < 100 ? '#ff9f7f' : '#7ab0e0'} {...s} />
              <path d={`M${x} 36V24l10 4-10 4`} fill="#ffc83d" {...s} />
            </g>
          ))}
        </>
      );
    case 'cove':
      return (
        <>
          <path d="M0 62c20-8 40 8 60 0s40 8 60 0M180 62c20-8 40 8 60 0s40 8 60 0" fill="none" stroke="#4a86bd" strokeWidth="4" strokeLinecap="round" />
          <path d="M252 58h30l-6 10h-18z" fill="#c98d4f" {...s} />
          <path d="M266 58V34l14 14h-14" fill="#fffaf0" {...s} />
        </>
      );
    case 'mountain':
      return (
        <>
          <path d="M0 70 36 24l36 46z" fill="#c9cdee" {...s} />
          <path d="M26 37l10-13 10 13-5 4-5-4-5 4z" fill="#fff" />
          <path d="M228 70l36-46 36 46z" fill="#c9cdee" {...s} />
        </>
      );
    case 'tower':
      return (
        <>
          <path d="M18 70V30h24v40z" fill="#fffaf0" {...s} />
          <path d="M14 30l16-16 16 16z" fill="#ffc83d" {...s} />
          <path d="M258 70V30h24v40z" fill="#fffaf0" {...s} />
          <path d="M254 30l16-16 16 16z" fill="#ffc83d" {...s} />
        </>
      );
  }
}

export function WorldBand({
  world,
  crown,
  locked,
  children,
  onOpen,
  footer,
  starsText,
  opening,
}: {
  world: WorldDef;
  crown: 'gold' | 'silver' | null;
  locked: boolean;
  children: ReactNode;
  onOpen?: () => void;
  footer?: ReactNode;
  starsText?: string;
  /** Just opened: the path wakes up and the header sparkles (see motion-nav.css). */
  opening?: boolean;
}) {
  return (
    <section className={`k-world${locked ? ' locked' : ''}${opening ? ' opening' : ''}`} style={{ ['--wbg' as string]: world.bg, ['--acc' as string]: world.accent }} aria-label={`Rank ${world.rank}: ${world.title}`} id={`k-world-${world.id}`}>
      <header className="k-world-head">
        <svg className="k-world-scene" viewBox="0 0 300 72" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
          <Scene scene={world.scene} accent={world.accent} />
        </svg>
        <button type="button" className="k-world-title" onClick={onOpen} aria-label={`Open ${world.title}`}>
          <span className="k-rank">Rank {world.rank}</span>
          <span className="k-world-name">{world.title}</span>
          {starsText && <span className="k-world-stars">{starsText}</span>}
        </button>
        <span className={`k-crown-slot ${crown ?? 'none'}`} aria-label={crown ? `${crown} crown` : 'No crown yet'}>
          <KidsIcon name="crown" size={30} fill={!!crown} />
        </span>
        {opening && (
          <span className="k-node-burst k-world-burst" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <i key={i} style={{ ['--i' as string]: i }} />
            ))}
          </span>
        )}
      </header>
      <div className="k-world-path">
        {!locked && (
          <span className="k-world-sky" aria-hidden="true">
            <i />
            <i />
          </span>
        )}
        {children}
      </div>
      {footer}
    </section>
  );
}
