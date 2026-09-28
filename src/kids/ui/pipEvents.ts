// Pip's reactions: a tiny emitter so any screen can make the coach Pip react without prop drilling.
// Visual only; nothing here speaks. The Pip that is rendered with `listen` (the coach) plays them.
import type { HintStep } from '../activities/types';

export type PipReaction = 'cheer' | 'oops' | 'wow' | 'point';
export interface PipReactEvent {
  kind: PipReaction;
  /** point: the board square to look toward, like "e4". Without one Pip looks at the board. */
  square?: string;
  at: number;
}
type Listener = (e: PipReactEvent) => void;

/** The same reaction twice inside this window is one reaction (a line and a mistake can both ask). */
export const REACT_DEDUPE_MS = 250;

const subs = new Set<Listener>();
let last: PipReactEvent | null = null;

/** Asks the listening Pip to react. Returns false when it was dropped as a repeat. */
export function pipReact(kind: PipReaction, square?: string, now = Date.now()): boolean {
  if (last && last.kind === kind && last.square === square && now - last.at < REACT_DEDUPE_MS) return false;
  last = { kind, square, at: now };
  subs.forEach((f) => f(last!));
  return true;
}

export function onPipReact(fn: Listener): () => void {
  subs.add(fn);
  return () => void subs.delete(fn);
}

/** The square a hint step is about: where its arrow ends, else the piece it highlights. */
export function hintTarget(step: Pick<HintStep, 'arrows' | 'tones'> | null | undefined): string | undefined {
  const arrow = step?.arrows?.[0];
  if (arrow) return arrow.to;
  return Object.entries(step?.tones ?? {}).find(([, tone]) => tone === 'hint')?.[0];
}

/**
 * How Pip turns toward something `dx`, `dy` px away (from his center): a mirror when it is well to
 * his left (he faces right), a small head lean in degrees, and a pupil shift in svg units.
 */
export function lookVector(dx: number, dy: number) {
  const flip = dx < -40;
  const ax = flip ? -dx : dx;
  const deg = (Math.atan2(dy, Math.max(ax, 1)) * 180) / Math.PI;
  const len = Math.hypot(ax, dy) || 1;
  return { flip, lean: Math.max(-10, Math.min(14, deg * 0.25)), lx: (2.6 * ax) / len, ly: (2.6 * dy) / len };
}
