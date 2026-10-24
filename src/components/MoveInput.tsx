import { useMemo, useState } from 'react';
import { Chess, type Color, type Move } from 'chess.js';
import { turnOf } from '../chess/utils';

/**
 * Keyboard move entry in algebraic notation (e4, Nf3, exd5, O-O, e8=Q). Like the board's
 * playerColor, `color` is the side the user plays: SAN does not say whose move it is, so
 * input is only open on that side's turn. While closed it shows `idleText`; when the position
 * is over (mate, stalemate) it says so instead of 'Waiting…', since nothing more will happen.
 */
export function MoveInput({ fen, color, enabled, onMove, id, idleText }: { fen: string; color: Color; enabled: boolean; onMove: (m: Move) => void; id: string; idleText?: string }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const open = enabled && turnOf(fen) === color;
  const ended = useMemo(() => {
    try {
      const c = new Chess(fen);
      return c.isCheckmate() ? 'Checkmate' : c.isGameOver() ? 'Game over' : null;
    } catch {
      return null;
    }
  }, [fen]);
  const submit = () => {
    const text = value.trim();
    if (!text || !open) return;
    try {
      const m = new Chess(fen).move(text.replace(/0/g, 'O'));
      setValue('');
      setError(false);
      onMove(m);
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
        placeholder={open ? 'Type a move: e4, Nf3, O-O' : (idleText ?? ended ?? 'Waiting…')}
        disabled={!open}
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
