import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { scrollToTop } from '../router';

/** setTimeout that is cleared when the component unmounts (or when `clear` is called). */
export function useTimeouts() {
  const ids = useRef(new Set<number>());
  const clear = useCallback(() => {
    ids.current.forEach(clearTimeout);
    ids.current.clear();
  }, []);
  useEffect(() => clear, [clear]);
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      ids.current.delete(id);
      fn();
    }, ms);
    ids.current.add(id);
  }, []);
  return { later, clear };
}

/** Listens to window keydown for the component's lifetime; the handler sees the latest render. */
export function useKeydown(handler: (e: KeyboardEvent) => void) {
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => latest.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Scrolls the page to the top when `view` changes: a new step or line inside one route would keep the old scroll. */
export function useScrollTopOn(view: unknown) {
  useLayoutEffect(() => scrollToTop(), [view]);
}

/**
 * Scrolls the page to show `ref` when `when` turns true (on phones a result under the board can
 * land below the fold), but never so far that the board's top slides under the header.
 */
export function useReveal(ref: RefObject<HTMLElement | null>, when: boolean) {
  useEffect(() => {
    const el = ref.current;
    const main = el?.closest<HTMLElement>('.main');
    if (!when || !el || !main) return;
    const view = main.getBoundingClientRect();
    const below = el.getBoundingClientRect().bottom - view.bottom + (parseFloat(getComputedStyle(main).scrollPaddingBottom) || 0);
    const board = main.querySelector('.board');
    const by = Math.min(below, board ? board.getBoundingClientRect().top - view.top : below);
    if (by > 0) main.scrollBy({ top: by, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [ref, when]);
}
