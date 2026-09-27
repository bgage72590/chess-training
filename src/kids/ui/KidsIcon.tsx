// Kids icon set: chunky 24x24 rounded stroke glyphs (stroke 3). Decorative unless labelled.
import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  again: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4.5H15" />
    </>
  ),
  home: (
    <>
      <path d="M4 11.5 12 4.5l8 7" />
      <path d="M6.5 10v9.5h11V10" />
    </>
  ),
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  bulb: (
    <>
      <path d="M9.5 18h5M10.5 21h3" />
      <path d="M12 3a6 6 0 0 0-3.8 10.6c.8.7 1.3 1.6 1.3 2.4h5c0-.8.5-1.7 1.3-2.4A6 6 0 0 0 12 3z" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  door: (
    <>
      <path d="M6.5 21V4.5h10V21M3.5 21h17" />
      <path d="M13.5 12.5h.01" strokeWidth="3.5" />
    </>
  ),
  map: (
    <>
      <path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 18.5v-13A2.5 2.5 0 0 1 7 3h12.5v15H7a2.5 2.5 0 0 0 0 5h12.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 5.5H5a3 3 0 0 0 3 4.5M16 5.5h3a3 3 0 0 1-3 4.5M12 13v4M8.5 20.5h7M10 17h4" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8.5" width="17" height="4.5" rx="1.5" />
      <path d="M5.5 13v7.5h13V13M12 8.5v12" />
      <path d="M12 8.5c-1.5-4-5.5-4.5-5.5-2S10 8.5 12 8.5c2 0 5.5.5 5.5-2s-4-2-5.5 2z" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  crown: <path d="M3.5 8.5 7.5 12 12 5.5l4.5 6.5 4-3.5-1.8 10.5H5.3z" />,
  castle: (
    <>
      <path d="M4.5 20.5V8.5h3v3h3v-3h3v3h3v-3h3v12z" />
      <path d="M10 20.5v-3.5a2 2 0 0 1 4 0v3.5" />
    </>
  ),
  flag: (
    <>
      <path d="M5.5 21V3.5" />
      <path d="M5.5 4h12l-2.5 4 2.5 4h-12" />
    </>
  ),
  rock: <path d="M4 17.5 6 10l5-4 6 2 3 6.5-2 3.5H6z" />,
  flame: <path d="M12 3c.8 4 6 5.5 6 11a6 6 0 0 1-12 0c0-3 1.8-4.8 3-6 .2 2 1 3 2.2 3.2C11 8.6 10.5 6 12 3z" />,
  candy: (
    <>
      <circle cx="12" cy="12" r="4.8" />
      <path d="M7.4 11 3.5 8.5v7L7.4 13M16.6 11l3.9-2.5v7L16.6 13" />
    </>
  ),
  road: <path d="M8.5 3 5 21M15.5 3 19 21M12 4.5v2.5M12 10.5v3M12 17v3" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  puzzle: <path d="M4.5 8.5h3.8a2.2 2.2 0 1 1 4.4 0h3.8v3.8a2.2 2.2 0 1 1 0 4.4v3.8h-12v-3.8a2.2 2.2 0 1 0 0-4.4z" />,
  swords: <path d="M4 4l8.5 8.5M20 4l-8.5 8.5M9.5 15 5 19.5M14.5 15l4.5 4.5M7 14l3 3M17 14l-3 3" />,
  shield: <path d="M12 3.5 19.5 6v6c0 4.8-3.5 7.6-7.5 8.5-4-.9-7.5-3.7-7.5-8.5V6z" />,
  leaf: (
    <>
      <path d="M5 19C5 10.5 10 5 20 4c-.5 10-5.5 15-15 15z" />
      <path d="M5 19l8-8" />
    </>
  ),
  plane: (
    <>
      <path d="M3 11 21 3.5 13.5 21 11 13z" />
      <path d="M11 13 21 3.5" />
    </>
  ),
  cloud: <path d="M7 18.5h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.5-1A4.5 4.5 0 0 0 7 18.5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  heart: <path d="M12 20s-8-4.8-8-10.8A4.3 4.3 0 0 1 12 6.8a4.3 4.3 0 0 1 8 2.4C20 15.2 12 20 12 20z" />,
  check: <path d="M5 12.5 10 17.5 19 7" />,
  dots: (
    <>
      <circle cx="6" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  // Extras beyond the 32 core glyphs.
  back: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  next: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  trash: <path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14" />,
  print: (
    <>
      <path d="M7 9V3.5h10V9" />
      <rect x="3.5" y="9" width="17" height="7.5" rx="2" />
      <path d="M7 14h10v6.5H7z" />
    </>
  ),
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />,
  upload: <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 20h14" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  chart: <path d="M4 20.5h16M7 17v-5M12 17V7M17 17v-8" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </>
  ),
};

export type KidsIconName =
  | 'play' | 'again' | 'home' | 'x' | 'bulb' | 'speaker' | 'lock' | 'door' | 'map' | 'book' | 'trophy' | 'gift'
  | 'star' | 'crown' | 'castle' | 'flag' | 'rock' | 'flame' | 'candy' | 'road' | 'eye' | 'puzzle' | 'swords'
  | 'shield' | 'leaf' | 'plane' | 'cloud' | 'clock' | 'heart' | 'check' | 'dots' | 'plus'
  | 'back' | 'next' | 'moon' | 'sun' | 'trash' | 'print' | 'download' | 'upload' | 'gear' | 'chart' | 'user' | 'mute';

export function KidsIcon({ name, size = 24, label, fill, className }: { name: KidsIconName; size?: number; label?: string; fill?: boolean; className?: string }) {
  return (
    <svg
      className={`k-icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {P[name]}
    </svg>
  );
}
