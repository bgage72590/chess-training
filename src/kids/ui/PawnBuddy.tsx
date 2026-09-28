// The kid's Pawn Buddy avatar: a pawn silhouette with a color, a face and an optional hat. The eyes
// blink now and then (CSS, removed under reduced motion); a crown can drop on with a bounce.
import { useMemo } from 'react';
import { AVATAR_COLORS, type AvatarColor, type FaceId, type HatId } from '../curriculum/wardrobe';

const INK = '#1f2a44';

function Face({ face, blink }: { face: FaceId; blink: boolean }) {
  const eye = (cx: number) => <circle className={blink ? 'k-buddy-eye' : undefined} cx={cx} cy="31" r="3.2" fill={INK} />;
  const happyEye = (cx: number) => <path d={`M${cx - 4} 32c2-4 6-4 8 0`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />;
  const closedEye = (cx: number) => <path d={`M${cx - 4} 30c2 4 6 4 8 0`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />;
  const smile = <path d="M43 39c4 4 10 4 14 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />;
  const cheeks = (
    <>
      <circle cx="38" cy="38" r="3.5" fill="#ff9f7f" opacity="0.5" />
      <circle cx="62" cy="38" r="3.5" fill="#ff9f7f" opacity="0.5" />
    </>
  );
  switch (face) {
    case 'smile':
      return (
        <>
          {eye(43)}
          {eye(57)}
          {smile}
          {cheeks}
        </>
      );
    case 'grin':
      return (
        <>
          {happyEye(43)}
          {happyEye(57)}
          <path d="M42 37h16c0 6-4 9-8 9s-8-3-8-9z" fill="#c2477f" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          {cheeks}
        </>
      );
    case 'wow':
      return (
        <>
          <circle cx="43" cy="30" r="4.5" fill="#fff" stroke={INK} strokeWidth="2.5" />
          <circle cx="57" cy="30" r="4.5" fill="#fff" stroke={INK} strokeWidth="2.5" />
          <circle cx="43" cy="30" r="2" fill={INK} />
          <circle cx="57" cy="30" r="2" fill={INK} />
          <ellipse cx="50" cy="41" rx="3.5" ry="4" fill={INK} />
        </>
      );
    case 'wink':
      return (
        <>
          {eye(43)}
          {happyEye(57)}
          {smile}
          {cheeks}
        </>
      );
    case 'calm':
      return (
        <>
          {closedEye(43)}
          {closedEye(57)}
          <path d="M45 39c3 2 7 2 10 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          {cheeks}
        </>
      );
    case 'cool':
      return (
        <>
          <path d="M35 27h30v3c0 4-3 6-7 6s-6-2-7-5h-2c-1 3-3 5-7 5s-7-2-7-6z" fill={INK} />
          <path d="M39 29h4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          {smile}
        </>
      );
  }
}

function Hat({ hat }: { hat: HatId }) {
  switch (hat) {
    case 'red-scarf':
      return (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d="M30 52c12 7 28 7 40 0l2 8c-14 7-30 7-44 0z" fill="#e2554a" />
          <path d="M60 58l6 16-8 2-4-15z" fill="#e2554a" />
        </g>
      );
    case 'blue-cap':
      return (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d="M31 22c0-12 9-18 19-18s19 6 19 18z" fill="#4a86bd" />
          <path d="M60 22h20c0 4-4 6-10 6H60z" fill="#4a86bd" />
          <circle cx="50" cy="5" r="3" fill="#ffc83d" />
        </g>
      );
    case 'pirate-hat':
      return (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d="M22 20c8 2 14-12 28-12s20 14 28 12c-2 6-12 8-28 8s-26-2-28-8z" fill="#2f3a55" />
          <circle cx="50" cy="16" r="3.5" fill="#fff" stroke="none" />
        </g>
      );
    case 'flower-band':
      return (
        <g stroke={INK} strokeWidth="2.5">
          <path d="M31 21c12-6 26-6 38 0" fill="none" stroke="#5fa55a" strokeWidth="4" />
          {[36, 50, 64].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={i === 1 ? 14 : 18} r="5" fill={['#ff9f7f', '#ffc83d', '#c9b3ff'][i]} />
              <circle cx={x} cy={i === 1 ? 14 : 18} r="1.8" fill="#fff" stroke="none" />
            </g>
          ))}
        </g>
      );
    case 'crown':
      return <path d="M32 18 34 2l9 8 7-10 7 10 9-8 2 16c-12 4-24 4-36 0z" fill="#ffc83d" stroke={INK} strokeWidth="3" strokeLinejoin="round" />;
  }
}

export function PawnBuddy({ color, face, hat, hatDrop, size = 96, className }: { color: AvatarColor; face: FaceId; hat?: HatId | null; hatDrop?: boolean; size?: number; className?: string }) {
  const c = AVATAR_COLORS[color] ?? AVATAR_COLORS.sun;
  // Each big buddy blinks on its own beat (every 4-7 s); the small ones in grids stay still.
  const blink = useMemo(() => ({ ['--blink' as string]: `${(4 + Math.random() * 3).toFixed(1)}s`, ['--blink-d' as string]: `-${(Math.random() * 4).toFixed(1)}s` }), []);
  return (
    <svg className={`k-buddy ${className ?? ''}`} viewBox="0 -4 100 120" width={size} height={size * 1.2} aria-hidden="true" style={blink}>
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M24 100c3-16 10-30 13-42h26c3 12 10 26 13 42z" fill={c.fill} />
        <path d="M58 58h5c3 12 10 26 13 42H66c-2-16-5-30-8-42z" fill={c.shade} stroke="none" opacity="0.55" />
        <rect x="16" y="96" width="68" height="16" rx="8" fill={c.fill} />
        <path d="M60 99h20c2 2 2 8 0 10H60z" fill={c.shade} stroke="none" opacity="0.55" />
        <ellipse cx="50" cy="57" rx="20" ry="6.5" fill={c.fill} />
        <circle cx="50" cy="32" r="21" fill={c.fill} />
        <path d="M62 16c9 7 10 22 1 30 5-9 5-21-1-30z" fill={c.shade} stroke="none" opacity="0.55" />
      </g>
      <circle cx="42" cy="22" r="4" fill="#fff" opacity="0.55" />
      <Face face={face} blink={size >= 80} />
      {hat && (
        <g className={hatDrop ? 'k-hat-drop' : undefined}>
          <Hat hat={hat} />
        </g>
      )}
    </svg>
  );
}
