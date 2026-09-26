// Line icons (24px grid, 1.75 stroke). Drawn for this app; no icon font.
const PATHS: Record<string, string> = {
  home: 'M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z',
  learn: 'M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5zM12 6v13.5',
  puzzle: 'M13 3 5 14h6l-1 7 8-11h-6z',
  openings: 'M6 3v6m0 0c0 4 4 4 6 6m-6-6v12m6-6c2 2 6 2 6 6M18 3v3a4 4 0 0 1-4 4',
  endgames: 'M12 3v3m-1.5-1.5h3M8.5 9h7l-1 4h-5zM9.5 13l-1.5 5h8l-1.5-5M6.5 21h11',
  play: 'M9 20h8m-9-3h10l-1.2-4.5c1.4-.9 2.2-2.4 2.2-4 0-3.3-3-5.5-6.5-5.5L9 3 8.5 5 6 8l1.5 2 2.5-1 .5 2L8 17',
  vision: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  progress: 'M4 20V10m5.3 10V4m5.4 16v-7M20 20v-4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.5a7.5 7.5 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2 1.2l.4 2.5h5l.4-2.5a7.5 7.5 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  flame: 'M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.8 3.3-5.6 3.8-9.5 2.3 1.4 3.2 3.5 3.2 5 .9-.6 1.6-1.7 1.7-3 2.4 2 4.3 4.6 4.3 7.5 0 3.4-2.6 6-6.5 6z',
  bolt: 'M13 3 5 14h6l-1 7 8-11h-6z',
  check: 'M5 12.5 10 17 19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  flip: 'M7 4v14m0 0-3-3m3 3 3-3M17 20V6m0 0-3 3m3-3 3 3',
  bulb: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4m-4 3h8l-1-3H9z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v4.5l3 2',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  skip: 'M6 5l8 7-8 7M18 5v14',
  first: 'M18 5l-8 7 8 7M6 5v14',
  last: 'M6 5l8 7-8 7M18 5v14',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3m13-3v2a4 4 0 0 1-4 4H4',
  swords: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6m-3 3 4 4m-1 1 2-2M9.5 17.5l-3 3m-2-2 3-3M3 19l2 2M10.5 6.5 14 3h3v3l-3.5 3.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-13v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className = '', title }: { name: IconName | string; size?: number; className?: string; title?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
