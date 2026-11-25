// Which kind of pointer is in use: 'touch' (finger or pen) or 'mouse' (mouse or trackpad), kept on
// <html data-input>. A touchscreen laptop has both, and media queries only report what it has, not
// what the person just used: CSS keys hover effects on this so a tapped card does not stay lifted.

export type InputMode = 'touch' | 'mouse';

export const modeOf = (pointerType: string): InputMode => (pointerType === 'mouse' ? 'mouse' : 'touch');

export function trackInputMode(root: HTMLElement = document.documentElement) {
  const set = (m: InputMode) => {
    if (root.dataset.input !== m) root.dataset.input = m;
  };
  set(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');
  addEventListener('pointerdown', (e) => set(modeOf((e as PointerEvent).pointerType)), { capture: true, passive: true });
  // Moving the trackpad after a tap brings hover back before the next click.
  addEventListener('pointermove', (e) => (e as PointerEvent).pointerType === 'mouse' && set('mouse'), { capture: true, passive: true });
}
