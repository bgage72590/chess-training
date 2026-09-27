// 1-3 stars: outlined when empty, sun with an ink outline when earned; a golden star sparkles.

export function StarShape({ filled, size = 28, golden, className, style }: { filled: boolean; size?: number; golden?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={`k-star ${filled ? 'on' : 'off'} ${golden ? 'golden' : ''} ${className ?? ''}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={style}>
      <path
        d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17l-5.6 3 1.1-6.2-4.6-4.4 6.3-.9z"
        fill={filled ? 'var(--k-sun)' : 'none'}
        stroke={filled ? '#1f2a44' : 'currentColor'}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {filled && <path d="M9.5 8.8 11 6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />}
      {golden && <path d="M20 2.5v3M18.5 4h3" stroke="#d99a00" strokeWidth="1.6" strokeLinecap="round" />}
    </svg>
  );
}

export function StarRow({ stars, size = 28, golden, max = 3, label }: { stars: number; size?: 20 | 28 | 48 | number; golden?: boolean; max?: number; label?: string }) {
  return (
    <span className="k-starrow" role="img" aria-label={label ?? `${stars} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <StarShape key={i} filled={i < stars} size={size} golden={golden && i === max - 1} />
      ))}
    </span>
  );
}
