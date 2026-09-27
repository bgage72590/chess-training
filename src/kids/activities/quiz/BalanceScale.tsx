// "Good trade?" balance scale: what you win in one pan, what you give back in the other.
// The heavier pan sinks. Reduced motion skips the tilt animation (quiz.css).
export function BalanceScale({ gain, loss }: { gain: number; loss: number }) {
  const tilt = gain === loss ? 0 : gain > loss ? -8 : 8; // left pan (win) sinks when it is heavier
  return (
    <div className="k-quiz-scale" role="img" aria-label={`You win ${gain} candies and give ${loss}.`}>
      <svg viewBox="0 0 220 120" aria-hidden="true">
        <path d="M110 30v76M80 110h60" stroke="var(--k-ink)" strokeWidth="6" strokeLinecap="round" />
        <g className="k-quiz-beam" style={{ transform: `rotate(${tilt}deg)` }}>
          <path d="M30 30h160" stroke="var(--k-ink)" strokeWidth="6" strokeLinecap="round" />
          <Pan x={30} n={gain} color="var(--k-grass)" />
          <Pan x={190} n={loss} color="var(--k-coral)" />
        </g>
        <circle cx="110" cy="30" r="8" fill="var(--k-sun)" stroke="var(--k-ink)" strokeWidth="4" />
      </svg>
      <div className="k-quiz-scale-labels">
        <span>You win {gain}</span>
        <span>You give {loss}</span>
      </div>
    </div>
  );
}

function Pan({ x, n, color }: { x: number; n: number; color: string }) {
  return (
    <g>
      <path d={`M${x} 30l-18 34M${x} 30l18 34`} stroke="var(--k-ink)" strokeWidth="3" />
      <path d={`M${x - 26} 64h52a26 14 0 0 1-52 0z`} fill={color} stroke="var(--k-ink)" strokeWidth="4" />
      <text x={x} y="58" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--k-ink)" fontFamily="var(--k-font-num)">
        {n}
      </text>
    </g>
  );
}
