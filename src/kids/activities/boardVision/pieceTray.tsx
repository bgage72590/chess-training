// Piece-tray buttons for "tap a piece, then its square" activities (setup, Magic Memory rebuild).
import type { PieceCode, Placement, TrayButton } from '../types';
import { PIECE_NAME } from './logic';

const ORDER = 'KQRBNPkqrbnp';

/** One tray button per piece still to place, with a count badge. */
export function pieceTrayButtons(todo: Placement, selected: PieceCode | null, onPick: (p: PieceCode) => void): TrayButton[] {
  const counts = new Map<PieceCode, number>();
  for (const p of Object.values(todo)) if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b))
    .map(([p, n]) => ({
      id: `pc-${p}`,
      label: { all: n > 1 ? `x${n}` : '', sprout: '' },
      art: (
        <span className="k-bv-tray-pc" aria-label={`${p === p.toUpperCase() ? 'white' : 'black'} ${PIECE_NAME[p.toUpperCase()]}${n > 1 ? `, ${n} left` : ''}`}>
          <span className={`k-bv-tray-img pc-${p === p.toUpperCase() ? 'w' : 'b'}${p.toUpperCase()}`} aria-hidden="true" />
        </span>
      ),
      variant: selected === p ? 'primary' : 'plain',
      onPress: () => onPick(p),
    }));
}
