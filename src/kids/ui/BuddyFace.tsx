// The seven animal buddies, drawn with simple flat shapes (no faces on chess pieces, ever). The
// eyes blink on their own beat (CSS, removed under reduced motion).
import { useMemo } from 'react';
import type { BuddyId } from '../curriculum/buddies';

const INK = '#1f2a44';
export type BuddyMood = 'thinking' | 'happy' | 'surprised';

function Eyes({ y = 50, dx = 11, big = false, mood }: { y?: number; dx?: number; big?: boolean; mood: BuddyMood }) {
  const r = big ? 7 : 4;
  const look = mood === 'thinking' ? -2 : 0;
  return (
    <>
      {big && (
        <>
          <circle cx={50 - dx} cy={y} r={r + 5} fill="#fff" stroke={INK} strokeWidth="3" />
          <circle cx={50 + dx} cy={y} r={r + 5} fill="#fff" stroke={INK} strokeWidth="3" />
        </>
      )}
      <circle className="k-buddy-eye" cx={50 - dx} cy={y + look} r={mood === 'surprised' ? r * 1.2 : r} fill={INK} />
      <circle className="k-buddy-eye" cx={50 + dx} cy={y + look} r={mood === 'surprised' ? r * 1.2 : r} fill={INK} />
      <circle cx={50 - dx + 1.5} cy={y + look - 1.5} r={big ? 2.2 : 1.3} fill="#fff" />
      <circle cx={50 + dx + 1.5} cy={y + look - 1.5} r={big ? 2.2 : 1.3} fill="#fff" />
    </>
  );
}

function Mouth({ y = 64, mood }: { y?: number; mood: BuddyMood }) {
  if (mood === 'surprised') return <ellipse cx="50" cy={y + 2} rx="4" ry="5" fill={INK} />;
  if (mood === 'thinking') return <path d={`M45 ${y + 2}h10`} stroke={INK} strokeWidth="3" strokeLinecap="round" />;
  return <path d={`M42 ${y}c4 5 12 5 16 0`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />;
}

export function BuddyFace({ id, mood = 'happy', size = 64, zzz = 0 }: { id: BuddyId; mood?: BuddyMood; size?: number; zzz?: number }) {
  const s = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const };
  let art;
  switch (id) {
    case 'shelly':
      art = (
        <>
          <circle cx="62" cy="54" r="30" fill="#f4a3c1" {...s} />
          <path d="M62 54m-6 0a6 6 0 1 1 12 0a12 12 0 1 1-24 0a18 18 0 1 1 36 0" fill="none" stroke="#c96b93" strokeWidth="4" strokeLinecap="round" />
          <circle cx="34" cy="62" r="22" fill="#cfe8a9" {...s} />
          <path d="M26 42 20 22M40 42l4-20" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <circle cx="20" cy="20" r="4" fill={INK} />
          <circle cx="44" cy="20" r="4" fill={INK} />
          <g transform="translate(-16 12)">
            <Eyes mood={mood} y={50} dx={7} />
            <Mouth mood={mood} y={60} />
          </g>
        </>
      );
      break;
    case 'hop':
      art = (
        <>
          <ellipse cx="36" cy="24" rx="9" ry="22" fill="#f2f2f2" {...s} />
          <ellipse cx="64" cy="24" rx="9" ry="22" fill="#f2f2f2" {...s} />
          <ellipse cx="36" cy="26" rx="4" ry="14" fill="#ffb9c9" />
          <ellipse cx="64" cy="26" rx="4" ry="14" fill="#ffb9c9" />
          <circle cx="50" cy="60" r="30" fill="#f2f2f2" {...s} />
          <Eyes mood={mood} y={56} />
          <ellipse cx="50" cy="65" rx="4" ry="3" fill="#ff8fab" />
          <Mouth mood={mood} y={70} />
          <circle cx="32" cy="68" r="4" fill="#ffb9c9" opacity="0.7" />
          <circle cx="68" cy="68" r="4" fill="#ffb9c9" opacity="0.7" />
        </>
      );
      break;
    case 'tuck':
      art = (
        <>
          <path d="M14 84c0-22 16-36 36-36s36 14 36 36z" fill="#4f8f52" {...s} />
          <path d="M30 70l10-10 10 10 10-10 10 10" fill="none" stroke="#3b6e3e" strokeWidth="3" />
          <circle cx="50" cy="44" r="26" fill="#7cc47f" {...s} />
          <Eyes mood={mood} y={42} />
          <Mouth mood={mood} y={54} />
        </>
      );
      break;
    case 'fern':
      art = (
        <>
          <path d="M22 16l12 26M78 16 66 42" stroke={INK} strokeWidth="3" />
          <path d="M20 12l20 22-16 8zM80 12 60 34l16 8z" fill="#ff9a4d" {...s} />
          <path d="M18 40c0-12 14-18 32-18s32 6 32 18c0 22-14 40-32 44-18-4-32-22-32-44z" fill="#ff9a4d" {...s} />
          <path d="M26 58c8 0 14 6 24 24 10-18 16-24 24-24-4 14-12 24-24 26-12-2-20-12-24-26z" fill="#fff" />
          <Eyes mood={mood} y={50} />
          <circle cx="50" cy="70" r="4.5" fill={INK} />
          <Mouth mood={mood} y={75} />
        </>
      );
      break;
    case 'olive':
      art = (
        <>
          <path d="M22 20l12 14M78 20 66 34" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d="M18 44c0-18 14-28 32-28s32 10 32 28v20c0 16-14 28-32 28S18 80 18 64z" fill="#b48a5a" {...s} />
          <path d="M34 76c6 6 26 6 32 0" fill="none" stroke="#8a6640" strokeWidth="3" strokeLinecap="round" />
          <Eyes mood={mood} y={46} dx={14} big />
          <path d="M45 58h10l-5 8z" fill="#ffc83d" {...s} />
        </>
      );
      break;
    case 'bruno':
      art = (
        <>
          <circle cx="24" cy="30" r="12" fill="#8b5a2b" {...s} />
          <circle cx="76" cy="30" r="12" fill="#8b5a2b" {...s} />
          <circle cx="24" cy="30" r="5" fill="#c9905a" />
          <circle cx="76" cy="30" r="5" fill="#c9905a" />
          <circle cx="50" cy="56" r="32" fill="#8b5a2b" {...s} />
          <ellipse cx="50" cy="68" rx="15" ry="12" fill="#d8a878" />
          <Eyes mood={mood} y={50} dx={13} />
          <ellipse cx="50" cy="63" rx="5" ry="3.5" fill={INK} />
          <Mouth mood={mood} y={71} />
        </>
      );
      break;
    case 'ember':
      art = (
        <>
          <path d="M30 30 22 8l16 16M70 30l8-22-16 16" fill="#ffc83d" {...s} />
          <path d="M18 50c0-18 14-28 32-28s32 10 32 28v6c0 18-14 30-32 30S18 74 18 56z" fill="#e2554a" {...s} />
          <path d="M30 70c6-6 34-6 40 0v6c-6 6-34 6-40 0z" fill="#ff9f7f" />
          <Eyes mood={mood} y={48} />
          <circle cx="44" cy="66" r="2" fill={INK} />
          <circle cx="56" cy="66" r="2" fill={INK} />
          <Mouth mood={mood} y={74} />
        </>
      );
      break;
  }
  const blink = useMemo(() => ({ ['--blink' as string]: `${(4 + Math.random() * 3).toFixed(1)}s`, ['--blink-d' as string]: `-${(Math.random() * 4).toFixed(1)}s` }), []);
  return (
    <span className="k-buddyface" style={{ width: size, height: size, ...blink }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        {art}
      </svg>
      {zzz > 0 && (
        <span className="k-zzz" aria-label={zzz === 1 ? 'a bit sleepy' : 'very sleepy'}>
          {'Z'.repeat(zzz)}
        </span>
      )}
    </span>
  );
}
