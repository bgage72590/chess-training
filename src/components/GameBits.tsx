import { useEffect, useRef } from 'react';
import { formatScore, winPercent, type Score } from '../engine/engine';
import type { MoveClass } from '../store/profile';

/**
 * The eval bar's short label: the label's end of the bar already says who is ahead, so it shows
 * the size of the advantage without a sign, in at most three characters (lichess convention):
 * tenths below 10 ("0.3", "4.5"), whole pawns from 10 ("12"), and "M3" for a mate.
 */
function evalBarLabel(score: Score | undefined): string {
  if (!score) return '0.0';
  if (score.mate !== undefined) return score.mate === 0 ? '#' : `M${Math.abs(score.mate)}`;
  const v = Math.abs((score.cp ?? 0) / 100);
  return Math.round(v * 10) >= 100 ? String(Math.min(99, Math.round(v))) : v.toFixed(1);
}

/** A game's date for headers and lists: "Oct 23", with the year only when it is not this year. */
export function gameDate(t: number): string {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** Vertical evaluation bar. `score` is from White's point of view. */
export function EvalBar({ score, orientation = 'white' }: { score?: Score; orientation?: 'white' | 'black' }) {
  const white = winPercent(score);
  const label = formatScore(score);
  const short = evalBarLabel(score);
  const whiteAhead = white >= 50;
  return (
    <div
      className={`evalbar ${orientation === 'black' ? 'flipped' : ''}`}
      role="img"
      aria-label={`Evaluation ${label}`}
    >
      <div className="evalbar-white" style={{ height: `${white}%` }} />
      <div
        className={`evalbar-label${!short.includes('.') && short.length > 2 ? ' tight' : ''}`}
        style={{
          // The end follows the leader's segment, which flips with the board; the ink only depends
          // on who leads, so it always contrasts with the segment it sits on.
          [(orientation === 'white') === whiteAhead ? 'bottom' : 'top']: 4,
          color: whiteAhead ? 'var(--ebony)' : 'var(--ivory)',
        }}
      >
        {short.includes('.') ? (
          <>
            {short.split('.')[0]}
            <span className="evalbar-dot">.</span>
            {short.split('.')[1]}
          </>
        ) : (
          short
        )}
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
}: {
  sans: string[];
  current?: number;
  onSelect?: (ply: number) => void;
  classes?: MoveClass[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = ref.current;
    const el = list?.querySelector('.cur');
    if (!list || !el) return;
    // Scroll the list only: scrollIntoView would also scroll the page, sliding the board away on phones.
    const l = list.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < l.top) list.scrollTop -= l.top - r.top;
    else if (r.bottom > l.bottom) list.scrollTop += r.bottom - l.bottom;
  }, [current, sans.length]);
  const cells: React.ReactNode[] = [];
  for (let row = 0; row * 2 < sans.length; row++) {
    cells.push(
      <div key={`n${row}`} className="n">
        {row + 1}.
      </div>,
    );
    for (let col = 0; col < 2; col++) {
      const i = row * 2 + col;
      if (i >= sans.length) {
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
  // Outside the sunken box: an empty box reads as a text field on touch screens.
  if (!cells.length) return <p className="moves-empty faint">Your moves will appear here.</p>;
  return (
    <div className="moves" ref={ref}>
      {cells}
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
      <rect x="0" y="0" width={W} height={H} fill="var(--ebony)" />
      <path d={area} fill="var(--ivory)" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="rgb(128 118 104)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      {classes?.map((c, i) =>
        c === 'blunder' || c === 'mistake' ? (
          // A zero-length round-capped stroke: unlike a circle it stays round when the graph stretches.
          <line key={i} x1={x(i + 1)} x2={x(i + 1)} y1={y(evals[i + 1])} y2={y(evals[i + 1])} stroke={c === 'blunder' ? 'var(--bad)' : 'var(--mistake)'} strokeWidth="8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ) : null,
      )}
      <line x1={x(current)} x2={x(current)} y1="0" y2={H} stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
