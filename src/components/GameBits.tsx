import { useEffect, useRef } from 'react';
import { formatScore, winPercent, type Score } from '../engine/engine';
import type { MoveClass } from '../store/profile';

/** Vertical evaluation bar. `score` is from White's point of view. */
export function EvalBar({ score, orientation = 'white' }: { score?: Score; orientation?: 'white' | 'black' }) {
  const white = winPercent(score);
  const label = formatScore(score);
  const whiteAhead = white >= 50;
  return (
    <div className={`evalbar ${orientation === 'black' ? 'flipped' : ''}`} aria-label={`Evaluation ${label}`}>
      <div className="evalbar-white" style={{ height: `${white}%` }} />
      <div
        className="evalbar-label"
        style={
          (orientation === 'white') === whiteAhead
            ? { bottom: 4, color: '#2a2e33' }
            : { top: 4, color: '#f1f1ec' }
        }
      >
        {label.replace('+', '')}
      </div>
    </div>
  );
}

export const CLASS_GLYPH: Record<MoveClass, string> = {
  best: '★',
  good: '',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  book: '',
};

export const CLASS_LABEL: Record<MoveClass, string> = {
  best: 'Best move',
  good: 'Good move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  book: 'Book',
};

/** Two-column move list. `current` is the ply index shown (0 = start). */
export function MoveList({
  sans,
  current,
  onSelect,
  classes,
  startTurn = 'w',
  startMove = 1,
}: {
  sans: string[];
  current?: number;
  onSelect?: (ply: number) => void;
  classes?: MoveClass[];
  startTurn?: 'w' | 'b';
  startMove?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector('.cur');
    el?.scrollIntoView({ block: 'nearest' });
  }, [current, sans.length]);
  const cells: React.ReactNode[] = [];
  const offset = startTurn === 'b' ? 1 : 0;
  const total = sans.length + offset;
  for (let row = 0; row * 2 < total; row++) {
    cells.push(
      <div key={`n${row}`} className="n">
        {startMove + row}.
      </div>,
    );
    for (let col = 0; col < 2; col++) {
      const i = row * 2 + col - offset;
      if (i < 0 || i >= sans.length) {
        cells.push(<span key={`e${row}${col}`} />);
        continue;
      }
      const cls = classes?.[i];
      cells.push(
        <button key={i} className={current === i + 1 ? 'cur' : ''} onClick={() => onSelect?.(i + 1)}>
          {sans[i]}
          {cls && CLASS_GLYPH[cls] && <span className={`glyph glyph-${cls}`}>{CLASS_GLYPH[cls]}</span>}
        </button>,
      );
    }
  }
  return (
    <div className="moves" ref={ref}>
      {cells.length ? cells : <span className="faint" style={{ padding: 8, gridColumn: '1 / -1' }}>No moves yet</span>}
    </div>
  );
}

/** Eval graph across a game. evals are White-POV scores per position. */
export function EvalGraph({ evals, current, onSelect, classes }: { evals: Score[]; current: number; onSelect: (i: number) => void; classes?: MoveClass[] }) {
  const W = 600;
  const H = 120;
  if (evals.length < 2) return null;
  const x = (i: number) => (i / (evals.length - 1)) * W;
  const y = (s: Score) => H - (winPercent(s) / 100) * H;
  const line = evals.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const handle = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (evals.length - 1));
    onSelect(Math.max(0, Math.min(evals.length - 1, i)));
  };
  return (
    <svg className="evalgraph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onPointerDown={handle} role="img" aria-label="Evaluation over the game">
      <rect x="0" y="0" width={W} height={H} fill="#2a2e33" />
      <path d={area} fill="#f1f1ec" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#8a8f96" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      {classes?.map((c, i) =>
        c === 'blunder' || c === 'mistake' ? (
          <circle key={i} cx={x(i + 1)} cy={y(evals[i + 1])} r="4" fill={c === 'blunder' ? 'var(--bad)' : '#e07b2a'} vectorEffect="non-scaling-stroke" />
        ) : null,
      )}
      <line x1={x(current)} x2={x(current)} y1="0" y2={H} stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
