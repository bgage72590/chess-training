// Portrait games show their sheets (the danger alarm, the game-over card) fixed to the bottom of the
// screen, where they would cover the kid's own back rank. While one is open this reads how far it
// reaches up into the play area and hands that height to CSS (--k-room), which lifts the board clear.
import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/** Class and style for the game's root element; `open` is whether a sheet is showing. */
export function useSheetRoom(root: RefObject<HTMLElement | null>, open: boolean): { className: string; style: CSSProperties | undefined } {
  const [room, setRoom] = useState(0);
  useLayoutEffect(() => {
    const el = root.current;
    const sheet = open ? el?.querySelector<HTMLElement>('.k-sheet') : null;
    const main = el?.parentElement;
    if (!sheet || !main) {
      setRoom(0);
      return;
    }
    // The sheet slides in with a transform, so its top is worked out from its height, not its box.
    const measure = () => setRoom(Math.max(0, Math.ceil(main.getBoundingClientRect().bottom - (window.innerHeight - sheet.offsetHeight))));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(sheet);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [root, open]);
  return open && room ? { className: ' has-sheet', style: { ['--k-room' as string]: `${room}px` } } : { className: '', style: undefined };
}
