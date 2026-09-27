// Pip, the knight-pony guide: a round head and neck in profile, facing right. Inline SVG; the moods
// are CSS animations (all removed or reduced under reduced motion).
import { useMemo } from 'react';

export type PipMood = 'idle' | 'talk' | 'cheer' | 'think' | 'oops' | 'sleepy' | 'wow';

const INK = '#1f2a44';

export function Pip({ mood = 'idle', size = 80, hat, className }: { mood?: PipMood; size?: 64 | 72 | 80 | 96 | 120 | 160 | number; hat?: 'crown' | 'party' | null; className?: string }) {
  // Blink every 4-6 s (random per mount), so two Pips never blink in sync.
  const blink = useMemo(() => `${(4 + Math.random() * 2).toFixed(2)}s`, []);
  return (
    <span className={`k-pip mood-${mood} ${className ?? ''}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <g className="k-pip-body">
          {/* mane, behind the head */}
          <path
            d="M47 26c-11-2-19 6-16 15-9 3-11 13-5 19-8 5-7 16 0 20-6 6-3 16 4 18-3 7 0 14 5 18h10l2-54c1-14 4-24 8-31z"
            fill="#ffc83d"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M38 44c-4 3-5 8-2 12M33 66c-3 3-3 8 0 11M34 88c-2 3-1 7 2 9" fill="none" stroke="#e0a100" strokeWidth="3" strokeLinecap="round" />
          {/* ear */}
          <path d="M52 31 49 9l16 17z" fill="#fff3d6" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M53 25 52 15l7 8z" fill="#ffb9a3" />
          {/* head and neck */}
          <path
            d="M36 116c-1-20 1-38 5-54 4-22 11-38 27-41 14-3 26 12 34 25 6 9 9 16 7 23-2 8-10 12-20 12-7 0-13-1-19-2 1 11 5 25 12 37z"
            fill="#fff3d6"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* shade on the neck */}
          <path d="M49 86c0 10 2 20 6 29h-8c-2-9-2-19 2-29z" fill="#f3dfb5" />
          {/* forelock */}
          <path d="M55 27c1-10 10-15 18-10-6 0-11 4-13 11z" fill="#ffc83d" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          {/* snout patch */}
          <path d="M92 52c7 1 14 7 15 14 0 7-6 11-14 11-5 0-9-3-10-8" fill="#ffe7bd" />
          {/* cheek */}
          <circle cx="76" cy="62" r="7.5" fill="#ff9f7f" opacity="0.45" />
          {/* nostril */}
          <ellipse cx="101" cy="61" rx="2.2" ry="2.8" fill={INK} />
          {/* eye */}
          <g className="k-pip-eye" style={{ animationDuration: blink }}>
            <ellipse className="k-pip-pupil" cx="73" cy="43" rx="7" ry="8" fill={INK} />
            <circle className="k-pip-shine" cx="75.5" cy="39.5" r="2.6" fill="#fff" />
          </g>
          <path className="k-pip-lid" d="M65 42c2-6 13-7 16 0" fill="#fff3d6" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          {/* mouth: closed smile and open (talk) */}
          <path className="k-pip-mouth" d="M86 72c4 4 10 4 14-1" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path className="k-pip-mouth-open" d="M86 71c3 7 12 7 15 0z" fill="#c2477f" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          {/* oops sweat drop */}
          <path className="k-pip-sweat" d="M58 30c-3 5-4 8-1 10s6-1 4-5z" fill="#9fd3ff" stroke={INK} strokeWidth="2" />
          {hat === 'crown' && <path d="M46 20l4-14 8 8 7-11 5 12 8-5-3 14c-9 3-20 3-29-4z" fill="#ffc83d" stroke={INK} strokeWidth="3" strokeLinejoin="round" />}
          {hat === 'party' && <path d="M50 22 62 -2l9 20c-6 5-15 7-21 4z" fill="#c9b3ff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />}
        </g>
        {/* think bubble and sleepy z's */}
        <g className="k-pip-think">
          <circle cx="96" cy="18" r="4" />
          <circle cx="106" cy="18" r="4" />
          <circle cx="116" cy="18" r="4" />
        </g>
        <g className="k-pip-z" fill={INK} fontFamily="var(--k-font-display)" fontWeight="700">
          <text x="92" y="30" fontSize="16">
            z
          </text>
          <text x="104" y="16" fontSize="12">
            z
          </text>
        </g>
      </svg>
      {mood === 'cheer' && (
        <span className="k-pip-sparkles">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} style={{ ['--i' as string]: i }} />
          ))}
        </span>
      )}
    </span>
  );
}
