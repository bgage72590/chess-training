import { useState } from 'react';
import { Chess } from 'chess.js';
import type { BoardMove } from '../chess/Board';

/** Keyboard move entry in algebraic notation (e4, Nf3, exd5, O-O, e8=Q). */
export function MoveInput({ fen, enabled, onMove, id }: { fen: string; enabled: boolean; onMove: (m: BoardMove) => void; id: string }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const submit = () => {
    const text = value.trim();
    if (!text) return;
    try {
      const c = new Chess(fen);
      const m = c.move(text.replace(/0/g, 'O'));
      setValue('');
      setError(false);
      onMove({ from: m.from, to: m.to, promotion: m.promotion });
    } catch {
      setError(true);
    }
  };
  return (
    <form
      className={`move-input ${error ? 'error' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor={id} className="visually-hidden">
        Type a move
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={enabled ? 'Type a move: e4, Nf3, O-O' : 'Waiting…'}
        disabled={!enabled}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(false);
        }}
      />
      {error && <span className="move-input-msg">Not a legal move here</span>}
    </form>
  );
}
