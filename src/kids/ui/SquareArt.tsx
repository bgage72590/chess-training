// Square art drawn inside board squares (inline SVG, 100x100, fills the square). Spec 7.4.
import type { ArtKey } from '../activities/types';

const INK = '#1f2a44';
const SPLATS = ['#ff9f7f', '#ffc83d', '#9ad48f', '#7ab0e0', '#c9b3ff', '#f4a3c1'];

const STAR = 'M50 12 61 36l26 3.5-19 18 5 26L50 71 27 83.5l5-26-19-18L39 36z';
const FLAME = 'M50 8c4 18 26 24 26 50a26 26 0 0 1-52 0c0-14 8-22 14-28 1 9 5 14 10 15C45 32 43 20 50 8z';

function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg className={`k-art ${className ?? ''}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {children}
    </svg>
  );
}

export function SquareArt({ art }: { art: ArtKey }) {
  if (art.startsWith('candy:')) {
    const n = Number(art.slice(6));
    return (
      <Svg className="k-art-candy">
        <circle cx="80" cy="20" r="17" fill="#ff9f7f" stroke={INK} strokeWidth="4" />
        <text x="80" y="27" textAnchor="middle" fontSize="20" fontWeight="700" fill={INK} fontFamily="var(--k-font-num)">
          {n}
        </text>
      </Svg>
    );
  }
  if (art.startsWith('splat:')) {
    const c = SPLATS[Number(art.slice(6)) % SPLATS.length];
    return (
      <Svg className="k-art-splat">
        <path d="M50 22c8 0 9 10 16 8s12 6 8 12 6 10 0 16-2 14-10 12-10 8-16 2-14 2-14-8-10-8-6-14-4-14 2-18 8-6 8-18z" fill={c} stroke={INK} strokeWidth="3" opacity="0.9" />
      </Svg>
    );
  }
  if (art.startsWith('ghost:')) {
    const p = art.slice(6);
    const cls = `pc-${p === p.toUpperCase() ? 'w' : 'b'}${p.toUpperCase()}`;
    return <span className={`k-ghost ${cls}`} aria-hidden="true" />;
  }
  switch (art) {
    case 'star':
      return (
        <Svg className="k-art-star">
          <path d={STAR} transform="translate(50 50) scale(0.78) translate(-50 -48)" fill="#ffc83d" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
          <path d="M38 36 43 28" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.85" />
        </Svg>
      );
    case 'rock':
      return (
        <Svg className="k-art-rock">
          <ellipse cx="50" cy="84" rx="36" ry="7" fill={INK} opacity="0.15" />
          <path d="M16 78c-3-14 4-30 16-38 8-14 26-18 38-10 12 4 20 18 18 32 4 8 0 16-6 18H22c-4 0-6-1-6-2z" fill="#a7b0bd" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <path d="M22 78c4 2 50 2 60-2 2 4-2 6-6 6H26c-2 0-4-2-4-4z" fill="#6b7686" />
          <path d="M36 38c6-8 16-10 24-6" fill="none" stroke="#d6dbe2" strokeWidth="6" strokeLinecap="round" />
        </Svg>
      );
    case 'lava':
      return (
        <span className="k-art-lava" aria-hidden="true">
          <svg viewBox="0 0 100 100">
            <path d={FLAME} transform="translate(66 64) scale(0.3)" fill="#ff5a36" stroke={INK} strokeWidth="10" strokeLinejoin="round" />
          </svg>
        </span>
      );
    case 'statue-eyes':
      return (
        <span className="k-art-statue" aria-hidden="true">
          <svg viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="17" fill="#fffaf0" stroke={INK} strokeWidth="3" />
            <path className="closed" d="M10 19c3 4 6 4 8 0M22 19c3 4 6 4 8 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
            <g className="open">
              <circle cx="14" cy="19" r="4.5" fill={INK} />
              <circle cx="26" cy="19" r="4.5" fill={INK} />
              <circle cx="15.5" cy="17.5" r="1.5" fill="#fff" />
              <circle cx="27.5" cy="17.5" r="1.5" fill="#fff" />
            </g>
          </svg>
        </span>
      );
    case 'cloud':
      return <span className="k-art-cloud" aria-hidden="true" />;
    case 'footprints':
      return (
        <Svg className="k-art-feet">
          <ellipse cx="38" cy="58" rx="8" ry="13" fill="#8b5a2b" opacity="0.8" />
          <ellipse cx="62" cy="42" rx="8" ry="13" fill="#8b5a2b" opacity="0.8" />
        </Svg>
      );
    case 'check':
      return (
        <Svg className="k-art-check">
          <circle cx="80" cy="20" r="16" fill="#3f9e55" stroke={INK} strokeWidth="3" />
          <path d="M72 20l6 6 11-12" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'target':
      return (
        <Svg className="k-art-target">
          <path d="M28 28l44 44M72 28 28 72" stroke="#c43b1a" strokeWidth="12" strokeLinecap="round" />
        </Svg>
      );
    case 'danger':
      return (
        <Svg className="k-art-danger">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#e0734f" strokeWidth="7" />
          <path d={FLAME} transform="translate(68 4) scale(0.3)" fill="#ff5a36" stroke={INK} strokeWidth="10" strokeLinejoin="round" />
        </Svg>
      );
    case 'dot':
      return <span className="k-art-dot" aria-hidden="true" />;
    default:
      return null;
  }
}
