import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

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
