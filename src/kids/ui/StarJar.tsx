// The Family Star Jar: every kid's stars pour into one shared jar. Every 100 is a Family Party.
// When the count has risen since the jar was last seen, stars drop in one by one: the level rises,
// the jar bumps and the number counts up with a pop. Reduced motion just shows the new count.
import { useEffect, useRef, useState } from 'react';
import { motionReduced } from './rewardFx';

const SEEN_KEY = 'tempo.kids.jarSeen';
let seen: number | null = null;
const readSeen = (): number | null => {
  if (seen == null) {
    try {
      const v = localStorage.getItem(SEEN_KEY);
      seen = v == null ? null : Number(v);
    } catch {
      /* private mode: the jar just shows the count */
    }
  }
  return seen;
};
const writeSeen = (n: number) => {
  seen = n;
  try {
    localStorage.setItem(SEEN_KEY, String(n));
  } catch {
    /* ignore */
  }
};

/** The counts a jar steps through on its way from `from` to `to`: at most 8 drops. */
export function jarSteps(from: number, to: number): number[] {
  const n = Math.max(0, Math.min(8, to - from));
  return Array.from({ length: n }, (_, i) => Math.round(from + ((to - from) * (i + 1)) / n));
}

export function StarJar({ stars }: { stars: number }) {
  const [level, setLevel] = useState(() => {
    const s = readSeen();
    return s != null && s < stars && !motionReduced() ? s : stars;
  });
  const [drops, setDrops] = useState<number[]>([]);
  const [hit, setHit] = useState(0);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const from = level;
    writeSeen(stars);
    if (from >= stars || motionReduced()) return setLevel(stars);
    const steps = jarSteps(from, stars);
    const timers: ReturnType<typeof setTimeout>[] = [];
    setDrops(steps.map((_, i) => i));
    steps.forEach((n, i) =>
      timers.push(
        setTimeout(() => {
          setLevel(n);
          setHit((h) => h + 1);
          svg.current?.animate?.([{ transform: 'none' }, { transform: 'scale(1.05, 0.95)', offset: 0.35 }, { transform: 'scale(0.98, 1.03)', offset: 0.7 }, { transform: 'none' }], { duration: 320, easing: 'ease-out' });
        }, 350 + i * 190 + 420),
      ),
    );
    timers.push(setTimeout(() => setDrops([]), 350 + steps.length * 190 + 700));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stars]);
  const fill = (level % 100) / 100;
  return (
    <div className="k-jar" role="img" aria-label={`Family star jar: ${stars} stars. ${100 - (stars % 100)} more for a party!`}>
      <span className="k-jar-body">
        <svg ref={svg} viewBox="0 0 80 96" width="72" height="86" aria-hidden="true">
          <defs>
            <clipPath id="k-jar-clip">
              <path d="M14 30h52v50a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10z" />
            </clipPath>
          </defs>
          <rect x="20" y="8" width="40" height="12" rx="4" fill="#c98d4f" stroke="#1f2a44" strokeWidth="3" />
          <path d="M14 30c0-6 4-10 10-10h32c6 0 10 4 10 10v50a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10z" fill="#ffffffb0" stroke="#1f2a44" strokeWidth="3" />
          <g clipPath="url(#k-jar-clip)">
            {/* The fill is drawn at full height and slid up or down, so the level animates on the compositor. */}
            <g className="k-jar-fill" style={{ transform: `translateY(${58 * (1 - fill)}px)`, opacity: fill > 0 ? 1 : 0 }}>
              <rect x="14" y="32" width="52" height="58" fill="#ffc83d" />
              <ellipse cx="40" cy="32" rx="26" ry="2.6" fill="#ffe08a" />
            </g>
            {/* Gems on the bottom show once the level passes them. */}
            {[
              [26, 84],
              [40, 80],
              [54, 85],
              [33, 74],
              [48, 70],
            ].map(([x, y], i) => (
              <path key={i} className="k-jar-gem" style={{ opacity: fill > 0.05 && y > 90 - 58 * fill ? 1 : 0 }} d={`M${x} ${y - 5}l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z`} fill="#fff6c9" />
            ))}
          </g>
          <path d="M22 34v36" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
        </svg>
        {drops.map((i) => (
          <i key={i} className="k-jar-drop" style={{ ['--i' as string]: i, ['--x' as string]: ((i * 37) % 5 - 2) * 6 }} />
        ))}
      </span>
      <span key={hit} className={`k-jar-count${hit ? ' hit' : ''}`}>
        {level}
      </span>
    </div>
  );
}
