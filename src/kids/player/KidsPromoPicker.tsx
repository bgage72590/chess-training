// A big promotion picker over the board: Queen (first, highlighted), Rook, Bishop, Knight.
import { useEffect, useRef } from 'react';
import { speech } from './speech';

const CHOICES = [
  { p: 'q', name: 'Queen', say: 'Queen!' },
  { p: 'r', name: 'Rook', say: 'Rook!' },
  { p: 'b', name: 'Bishop', say: 'Bishop!' },
  { p: 'n', name: 'Knight', say: 'Knight!' },
] as const;

export function KidsPromoPicker({ color, onPick, onCancel, speak }: { color: 'w' | 'b'; onPick(p: 'q' | 'r' | 'b' | 'n'): void; onCancel(): void; speak: boolean }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  // Escape is the same as "Not yet", whichever element has the focus.
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      cancel.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="k-promo" role="dialog" aria-modal="true" aria-label="Pick a piece for your pawn">
      <div className="k-promo-card">
        <p className="k-promo-title">Your pawn becomes...</p>
        <div className="k-promo-grid">
          {CHOICES.map((c, i) => (
            <button
              key={c.p}
              ref={i === 0 ? first : undefined}
              type="button"
              className={`k-promo-btn${i === 0 ? ' best' : ''}`}
              onClick={() => onPick(c.p)}
              onFocus={() => speak && speech.speak([c.say])}
            >
              <span className={`k-promo-piece pc-${color}${c.p.toUpperCase()}`} aria-hidden="true" />
              <span>{c.name}</span>
            </button>
          ))}
        </div>
        <button type="button" className="k-linkbtn" onClick={onCancel}>
          Not yet
        </button>
      </div>
    </div>
  );
}
