// Board feel for Kids: a squash when a piece lands, a poof when one is captured, a lifted piece, staggered
// move dots and a gulp for a king in check. The shared Board (also used by the trainer) stays untouched:
// this watches its DOM, toggles classes and adds short-lived nodes, and motion-board.css does the drawing
// with transform and opacity only. Nothing here runs under reduced motion and nothing loops.
import { useEffect, useLayoutEffect, type RefObject } from 'react';
import type { Sq } from './types';

export type Cell = [number, number];
const FILES = 'abcdefgh';
const POS = /translate\((-?[\d.]+)%,\s*(-?[\d.]+)%\)/;
const PIECE = /\bpc-([wb])[KQRBNP]\b/;

/** The cell (column, row from the top left) a piece sits in, read from its inline transform. A piece being dragged (pixels) has none. */
export function cellOf(transform: string): Cell | null {
  const m = POS.exec(transform);
  return m ? [Math.round(+m[1] / 100), Math.round(+m[2] / 100)] : null;
}

export function cellOfSq(sq: Sq, orientation: 'white' | 'black'): Cell {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]) - 1;
  return orientation === 'black' ? [7 - f, r] : [f, 7 - r];
}

export interface Seen {
  color: string;
  cell: Cell;
  /** The piece's class (pc-bP), to draw it once more as it leaves. */
  cls: string;
  /** Where a piece that moved came from (tells en passant from a plain step). */
  from?: Cell;
}

const isPawn = (s: Seen) => s.cls.endsWith('P');

/** En passant: a pawn steps diagonally past an enemy pawn, which vanishes from the square it passed. */
function passedBy(g: Seen, a: Seen): boolean {
  return isPawn(g) && isPawn(a) && !!a.from && a.from[1] === g.cell[1] && a.cell[0] === g.cell[0] && Math.abs(a.cell[1] - g.cell[1]) === 1 && Math.abs(a.from[0] - a.cell[0]) === 1;
}

/** Captures in one board update: pieces that vanished from a cell another colour just arrived on (or, for a pawn, passed en passant). A big reshuffle (a new puzzle) counts as none. */
export function capturedIn(gone: Seen[], arrived: Seen[]): Seen[] {
  if (gone.length > 3 || arrived.length > 3) return [];
  return gone.filter((g) => arrived.some((a) => a.color !== g.color && ((a.cell[0] === g.cell[0] && a.cell[1] === g.cell[1]) || passedBy(g, a))));
}

const seen = (el: HTMLElement, cell: Cell, from?: Cell): Seen => {
  const m = PIECE.exec(el.className);
  return { color: m?.[1] ?? '', cell, cls: m?.[0] ?? '', from };
};
const isPiece = (n: Node): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('piece') && !n.classList.contains('ghost');

/** The piece standing on a square (the same match the wobble uses). */
function pieceAt(board: HTMLElement, sq: Sq, orientation: 'white' | 'black'): HTMLElement | null {
  const [c, r] = cellOfSq(sq, orientation);
  const want = `translate(${c * 100}%,${r * 100}%)`;
  return [...board.querySelectorAll<HTMLElement>('.piece')].find((p) => p.style.transform.replace(/\s/g, '') === want) ?? null;
}

/** Scaling (squash, gulp) is done about the foot of the piece's own cell: the piece's transform already holds its position. */
function anchor(el: HTMLElement, [c, r]: Cell) {
  el.style.transformOrigin = `${c * 100 + 50}% ${r * 100 + 92}%`;
}

/** The origin only belongs to the running squash or gulp: a drag scales the piece about its own centre. */
function unanchor(el: HTMLElement) {
  if (!el.classList.contains('k-land') && !el.classList.contains('k-incheck')) el.style.transformOrigin = '';
}

/** The dots ripple outward from the piece: 26 ms per square of distance. */
function stagger(d: HTMLElement, from: Cell, orientation: 'white' | 'black') {
  const sq = d.closest<HTMLElement>('[data-square]')?.dataset.square;
  if (!sq) return;
  const [c, r] = cellOfSq(sq, orientation);
  d.style.setProperty('--k-d', `${Math.min(7, Math.max(Math.abs(c - from[0]), Math.abs(r - from[1]))) * 26}ms`);
}
const isDot = (n: Node): n is HTMLElement => n instanceof HTMLElement && (n.classList.contains('dest') || n.classList.contains('k-art-dot'));

export function useBoardFx(root: RefObject<HTMLElement | null>, o: { reduced: boolean; orientation: 'white' | 'black'; fen: string; from: Sq | null; lift: Sq | null }) {
  const { reduced, orientation, fen, from, lift } = o;

  // Landing squash and capture poof, from what Board does to its own pieces.
  useEffect(() => {
    const board = root.current?.querySelector<HTMLElement>('.board');
    if (!board || reduced) return;
    const at = new WeakMap<Element, string>();
    board.querySelectorAll<HTMLElement>('.piece').forEach((p) => {
      const c = cellOf(p.style.transform);
      if (c) at.set(p, c.join());
    });
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    };
    const landing = new WeakMap<HTMLElement, number>();
    const land = (el: HTMLElement, cell: Cell) => {
      anchor(el, cell);
      if (el.classList.contains('k-land')) {
        el.classList.remove('k-land');
        void el.offsetWidth; // restart the squash when a piece moves again before it ended
      }
      el.classList.add('k-land');
      window.clearTimeout(landing.get(el));
      landing.set(
        el,
        later(() => {
          el.classList.remove('k-land');
          unanchor(el);
        }, 900),
      );
    };
    const poof = ({ cell, cls }: Seen) => {
      const pos = `translate(${cell[0] * 100}%, ${cell[1] * 100}%)`;
      const ghost = document.createElement('div');
      ghost.className = 'k-poof';
      ghost.style.transform = pos;
      const body = document.createElement('div');
      body.className = cls;
      ghost.append(body);
      const nodes = [ghost];
      // Gobble draws its own puff on the square.
      if (!board.querySelector('.k-gb-poof')) {
        const puff = document.createElement('div');
        puff.className = 'k-puff';
        puff.style.transform = pos;
        puff.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
        nodes.push(puff);
      }
      board.append(...nodes);
      later(() => nodes.forEach((n) => n.remove()), 900);
    };

    const mo = new MutationObserver((records) => {
      const moved = new Map<HTMLElement, { cell: Cell; from?: Cell }>();
      const added = new Map<HTMLElement, Cell>();
      const gone: Seen[] = [];
      for (const r of records) {
        if (r.type === 'attributes') {
          const el = r.target as HTMLElement;
          const c = isPiece(el) ? cellOf(el.style.transform) : null;
          if (!c || at.get(el) === c.join()) continue;
          const prev = at.get(el);
          at.set(el, c.join());
          moved.set(el, { cell: c, from: prev ? (prev.split(',').map(Number) as Cell) : undefined });
          continue;
        }
        r.addedNodes.forEach((n) => {
          // Board draws its dots a render after the press that picked the piece, so they are timed here.
          const sel = isDot(n) ? board.querySelector<HTMLElement>('.sq.selected')?.dataset.square : null;
          if (isDot(n) && sel) stagger(n, cellOfSq(sel, orientation), orientation);
          const c = isPiece(n) ? cellOf(n.style.transform) : null;
          if (isPiece(n) && c) {
            at.set(n, c.join());
            added.set(n, c);
          }
        });
        r.removedNodes.forEach((n) => {
          const c = isPiece(n) ? cellOf(n.style.transform) : null;
          if (isPiece(n) && c) gone.push(seen(n, c));
        });
      }
      const arrived = [...[...moved].map(([el, m]) => seen(el, m.cell, m.from)), ...[...added].map(([el, c]) => seen(el, c))];
      capturedIn(gone, arrived).forEach(poof);
      if (moved.size <= 3) moved.forEach((m, el) => land(el, m.cell));
    });
    mo.observe(board, { childList: true, attributes: true, attributeFilter: ['style'], subtree: true });
    return () => {
      mo.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
      board.querySelectorAll('.k-poof, .k-puff').forEach((n) => n.remove());
      board.querySelectorAll<HTMLElement>('.k-land').forEach((n) => {
        n.classList.remove('k-land');
        unanchor(n);
      });
    };
  }, [root, reduced, orientation]);

  // The picked-up piece, the dots' pop-in order and the king in check, all read after every render of the board.
  useLayoutEffect(() => {
    const board = root.current?.querySelector<HTMLElement>('.board');
    if (!board || reduced) return;
    board.querySelectorAll<HTMLElement>('.k-lifted, .k-incheck').forEach((n) => {
      n.classList.remove('k-lifted', 'k-incheck');
      unanchor(n);
    });
    if (lift) pieceAt(board, lift, orientation)?.classList.add('k-lifted');
    if (from) board.querySelectorAll<HTMLElement>('.dest, .k-art-dot').forEach((d) => stagger(d, cellOfSq(from, orientation), orientation));
    const chk = board.querySelector<HTMLElement>('.sq.check')?.dataset.square;
    const king = chk ? pieceAt(board, chk, orientation) : null;
    if (chk && king) {
      anchor(king, cellOfSq(chk, orientation));
      king.classList.add('k-incheck');
    }
  }, [root, reduced, orientation, fen, from, lift]);
}
