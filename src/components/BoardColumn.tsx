import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Space kept free below the board column, in px. */
const BOTTOM_GAP = 16;
/** Never shrink the board below this, even on very short screens. */
const MIN_BOARD = 240;

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
 */
export function BoardColumn({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const col = ref.current;
    const scroller = col?.closest<HTMLElement>('.main');
    const page = col?.closest('.page') ?? null;
    if (!col || !scroller) return;
    const fit = () => {
      const board = col.querySelector<HTMLElement>('.board');
      if (!board) return;
      const top = col.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const around = col.offsetHeight - board.offsetHeight; // captions, input, controls
      const beside = col.offsetWidth - board.offsetWidth; // e.g. the eval bar
      const room = scroller.clientHeight - stickyBottom(page) - BOTTOM_GAP;
      const max = Math.max(MIN_BOARD, Math.floor(room - top - around)) + beside;
      if (col.style.getPropertyValue('--board-fit') !== `${max}px`) col.style.setProperty('--board-fit', `${max}px`);
    };
    // Re-fit when the viewport, the column, or anything above it changes size.
    const ro = new ResizeObserver(fit);
    ro.observe(scroller);
    ro.observe(col);
    if (col.parentElement) ro.observe(col.parentElement);
    if (page) ro.observe(page);
    fit();
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="trainer-board">
      {children}
    </div>
  );
}
