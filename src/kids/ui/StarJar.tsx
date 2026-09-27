// The Family Star Jar: every kid's stars pour into one shared jar. Every 100 is a Family Party.
export function StarJar({ stars }: { stars: number }) {
  const fill = (stars % 100) / 100;
  const h = 58 * fill;
  return (
    <div className="k-jar" role="img" aria-label={`Family star jar: ${stars} stars. ${100 - (stars % 100)} more for a party!`}>
      <svg viewBox="0 0 80 96" width="72" height="86" aria-hidden="true">
        <defs>
          <clipPath id="k-jar-clip">
            <path d="M14 30h52v50a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10z" />
          </clipPath>
        </defs>
        <rect x="20" y="8" width="40" height="12" rx="4" fill="#c98d4f" stroke="#1f2a44" strokeWidth="3" />
        <path d="M14 30c0-6 4-10 10-10h32c6 0 10 4 10 10v50a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10z" fill="#ffffffb0" stroke="#1f2a44" strokeWidth="3" />
        <g clipPath="url(#k-jar-clip)">
          <rect x="14" y={90 - h} width="52" height={h} fill="#ffc83d" />
          {fill > 0.05 &&
            [
              [26, 84],
              [40, 80],
              [54, 85],
              [33, 74],
              [48, 70],
            ]
              .filter(([, y]) => y > 90 - h)
              .map(([x, y], i) => <path key={i} d={`M${x} ${y - 5}l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z`} fill="#fff6c9" />)}
        </g>
        <path d="M22 34v36" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      </svg>
      <span className="k-jar-count">{stars}</span>
    </div>
  );
}
