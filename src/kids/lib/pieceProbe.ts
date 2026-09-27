// Detects whether a piece set's artwork is actually available (the pieces team may land the
// 3D Staunton set later). Mounts two hidden boards and compares the white king's image.
import type { PieceSet } from '../../store/profile';

const cache = new Map<string, boolean>();

function imageOf(set: string): string {
  const board = document.createElement('div');
  board.className = `board pieces-${set}`;
  board.style.cssText = 'position:absolute;left:-9999px;top:0;width:80px;height:80px;visibility:hidden;pointer-events:none';
  const piece = document.createElement('div');
  piece.className = 'piece pc-wK';
  board.appendChild(piece);
  document.body.appendChild(board);
  const img = getComputedStyle(piece).backgroundImage;
  board.remove();
  return img;
}

/** Whether `set` draws its own pieces (memoized). cburnett is the always-available base set. */
export function hasPieceSet(set: PieceSet): boolean {
  if (set === 'cburnett') return true;
  if (cache.has(set)) return cache.get(set)!;
  let ok = false;
  try {
    const img = imageOf(set);
    ok = !!img && img !== 'none' && img !== imageOf('cburnett');
  } catch {
    ok = false;
  }
  cache.set(set, ok);
  return ok;
}

/** The piece set to use for a kid setting ('auto' = staunton3d if available, else cburnett). */
export function resolvePieceSet(setting: PieceSet | 'auto'): PieceSet {
  if (setting === 'auto') return hasPieceSet('staunton3d') ? 'staunton3d' : 'cburnett';
  return setting === 'staunton3d' && !hasPieceSet('staunton3d') ? 'cburnett' : setting;
}
