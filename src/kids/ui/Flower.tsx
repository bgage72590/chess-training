// A flower pot from Pip's Garden: blooming (one of five petal colours) or still a sprout.
export function Flower({ on, i, size = 34 }: { on: boolean; i: number; size?: number }) {
  const petal = ['#ff9f7f', '#ffc83d', '#c9b3ff', '#f4a3c1', '#7ab0e0'][i % 5];
  return (
    <svg viewBox="0 0 40 56" width={size} height={Math.round((size * 56) / 40)} aria-hidden="true">
      <path d="M8 40h24l-3 14H11z" fill="#c98d4f" stroke="#1f2a44" strokeWidth="2.5" strokeLinejoin="round" />
      {on ? (
        <>
          <path d="M20 40V22" stroke="#3f8f4f" strokeWidth="3" strokeLinecap="round" />
          <path d="M20 32c-6 0-8-4-7-7 5 0 7 3 7 7z" fill="#9ad48f" />
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="20" cy="11" rx="4.5" ry="6.5" fill={petal} stroke="#1f2a44" strokeWidth="1.5" transform={`rotate(${a} 20 17)`} />
          ))}
          <circle cx="20" cy="17" r="4" fill="#ffc83d" stroke="#1f2a44" strokeWidth="1.5" />
        </>
      ) : (
        <path d="M20 40v-4" stroke="#8b5a2b" strokeWidth="3" strokeLinecap="round" />
      )}
    </svg>
  );
}
