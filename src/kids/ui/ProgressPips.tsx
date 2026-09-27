// One pip per item: current = sun, done = grass with a check, skipped = cream with a dash.
export type PipState = 'todo' | 'current' | 'done' | 'skipped';

export function ProgressPips({ states }: { states: PipState[] }) {
  const done = states.filter((s) => s === 'done' || s === 'skipped').length;
  return (
    <div className="k-pips" role="progressbar" aria-valuemin={0} aria-valuemax={states.length} aria-valuenow={done} aria-label="Progress">
      {states.map((s, i) => (
        <span key={i} className={`k-pip-dot ${s}`}>
          {s === 'done' && (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 12.5 10 16.5 18 8" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}
