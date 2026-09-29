// The Danger Alarm bottom sheet: "Uh-oh! Is your knight safe?" with Undo (primary) and Keep it.
// Used by game activities (Pack D); the threatened square pulses with `danger` art on the board.
import { useEffect } from 'react';
import { Pip } from './Pip';
import { BigButton } from './BigButton';
import { kidSound } from '../lib/kidsSound';

const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export function DangerSheet({ piece, onUndo, onKeep }: { piece: string; onUndo(): void; onKeep(): void }) {
  useEffect(() => kidSound('boop'), []);
  return (
    <div className="k-sheet" role="alertdialog" aria-modal="true" aria-label="Danger alarm">
      <div className="k-sheet-card k-danger">
        <Pip mood="wow" size={72} />
        <p className="k-sheet-title">Uh-oh! Is your {NAME[piece.toLowerCase()] ?? 'piece'} safe?</p>
        <div className="k-sheet-actions">
          <BigButton variant="go" icon="again" onClick={onUndo} autoFocus>
            Undo
          </BigButton>
          <BigButton variant="plain" icon="check" onClick={onKeep}>
            Keep it
          </BigButton>
        </div>
      </div>
    </div>
  );
}
