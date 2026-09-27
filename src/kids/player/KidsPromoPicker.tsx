// A big promotion picker over the board: Queen (first, highlighted), Rook, Bishop, Knight.
import { useEffect, useRef } from 'react';
import { speech } from './speech';

const CHOICES = [
  { p: 'q', name: 'Queen' },
  { p: 'r', name: 'Rook' },
  { p: 'b', name: 'Bishop' },
  { p: 'n', name: 'Knight' },
] as const;

export function KidsPromoPicker({ color, onPick, onCancel, speak }: { color: 'w' | 'b'; onPick(p: 'q' | 'r' | 'b' | 'n'): void; onCancel(): void; speak: boolean }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div className="k-promo" role="dialog" aria-label="Pick a piece for your pawn">
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
              onFocus={() => speak && speech.speak([c.name])}
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
