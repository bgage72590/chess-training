import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { reveal } from '../lib/hooks';

/** Space kept free below the board column, in px. */
const BOTTOM_GAP = 16;
/** Never shrink the board below this, even on very short screens. */
const MIN_BOARD = 240;
/** In the one-column layout the board keeps at least this share of the width (unless the screen is very short). */
const MIN_SHARE = 0.9;

/** Height of bars pinned to the bottom of the page (e.g. the lesson navigation). */
function stickyBottom(page: Element | null): number {
  let h = 0;
  for (const el of page?.children ?? []) {
    const cs = getComputedStyle(el);
    if (cs.position === 'sticky' && cs.bottom !== 'auto') h = Math.max(h, (el as HTMLElement).offsetHeight);
  }
  return h;
}

/**
 * The board column of a trainer page. It measures the scroll viewport and whatever sits
 * above and below the board (captions, move input, controls, a sticky bottom bar) and caps
 * its own width so the whole column fits on screen. Pages need no per-page height offsets.
 *
 * In the one-column layout (phones, tablets) the panel sits under the board. There the CSS sets
 * `--panel-peek`, the room kept for the start of the panel (the task, the side to move), and new
 * feedback that appears in the panel is scrolled into view with its buttons.
 */
export function BoardColumn({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const col = ref.current;
    const scroller = col?.closest<HTMLElement>('.main');
    const page = col?.closest('.page') ?? null;
    const trainer = col?.parentElement;
    if (!col || !scroller || !trainer) return;
    const fit = () => {
      const board = col.querySelector<HTMLElement>('.board');
      if (!board) return;
      const top = col.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const around = col.offsetHeight - board.offsetHeight; // captions, input, controls
      const beside = col.offsetWidth - board.offsetWidth; // e.g. the eval bar
      const peek = parseFloat(getComputedStyle(trainer).getPropertyValue('--panel-peek')) || 0;
      const room = scroller.clientHeight - stickyBottom(page) - Math.max(BOTTOM_GAP, peek);
      // One column: a board much narrower than the screen only looks unfinished.
      const share = peek ? Math.min((trainer.clientWidth - beside) * MIN_SHARE, scroller.clientHeight * 0.75) : 0;
      const max = Math.max(MIN_BOARD, share, Math.floor(room - top - around)) + beside;
      // Set on the trainer, so the panel below can line up with the board column.
      if (trainer.style.getPropertyValue('--board-fit') !== `${max}px`) trainer.style.setProperty('--board-fit', `${max}px`);
    };
    // Re-fit when the viewport, the column, or anything above it changes size.
    const ro = new ResizeObserver(fit);
    ro.observe(scroller);
    ro.observe(col);
    ro.observe(trainer);
    if (page) ro.observe(page);
    fit();
    // A result or coach warning added to the panel later is brought on screen (a no-op when visible).
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (col.contains(r.target)) continue;
        for (const n of r.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;
          const fb = n.matches('.feedback') ? n : n.querySelector<HTMLElement>('.feedback');
          if (fb) return reveal(fb);
        }
      }
    });
    mo.observe(trainer, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  return (
    <div ref={ref} className="trainer-board">
      {children}
    </div>
  );
}
