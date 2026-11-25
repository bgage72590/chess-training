import { afterEach, describe, expect, it, vi } from 'vitest';
import { modeOf, trackInputMode } from '../src/lib/inputMode';

describe('input mode (touchscreen laptops)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup(coarse: boolean) {
    const handlers: Record<string, (e: { pointerType: string }) => void> = {};
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)' && coarse }));
    vi.stubGlobal('addEventListener', (type: string, fn: (e: { pointerType: string }) => void) => (handlers[type] = fn));
    const root = { dataset: {} as Record<string, string> };
    trackInputMode(root as unknown as HTMLElement);
    return { root, handlers };
  }

  it('starts from the primary pointer', () => {
    expect(setup(false).root.dataset.input).toBe('mouse');
    expect(setup(true).root.dataset.input).toBe('touch');
  });

  it('follows the last pointer used: a tap turns hover off, the trackpad turns it back on', () => {
    const { root, handlers } = setup(false);
    handlers.pointerdown({ pointerType: 'touch' });
    expect(root.dataset.input).toBe('touch');
    handlers.pointermove({ pointerType: 'touch' });
    expect(root.dataset.input).toBe('touch');
    handlers.pointermove({ pointerType: 'mouse' });
    expect(root.dataset.input).toBe('mouse');
    handlers.pointerdown({ pointerType: 'pen' });
    expect(root.dataset.input).toBe('touch');
  });

  it('treats a pen like a finger and a trackpad like a mouse', () => {
    expect(modeOf('pen')).toBe('touch');
    expect(modeOf('touch')).toBe('touch');
    expect(modeOf('mouse')).toBe('mouse');
  });
});
