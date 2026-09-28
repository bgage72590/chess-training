// Reward motion helpers: a star that flies along an arc with a sparkle trail, an eased count-up, and
// the motion checks the reward code shares. Short-lived Web Animations only, no frame loops.
import { useEffect, useState } from 'react';
import '../motion-rewards.css';

export interface Pt {
  x: number;
  y: number;
}

/** True when the kid or the device asked for less motion; the app mirrors both onto data-motion. */
export function motionReduced(): boolean {
  if (typeof document === 'undefined') return true;
  const host = document.querySelector('.kids-app');
  if (host) return host.getAttribute('data-motion') === 'reduced';
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Few cores or little memory: reward effects use fewer particles. */
export function lowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const n = navigator as Navigator & { deviceMemory?: number };
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 2;
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const smooth = (t: number) => t * t * (3 - 2 * t);

/** The whole number a count-up shows `t` (0..1) of the way from `from` to `to`. */
export function countAt(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * easeOutCubic(t));
}

/** How far a flight bows away from the straight line: sideways for a climb, upward otherwise. */
export function arcBow(a: Pt, b: Pt, viewW: number): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(120, Math.max(36, len * 0.3));
  // Perpendicular to the flight, on the side that points up (or toward the middle of the screen).
  let nx = -dy / len;
  let ny = dx / len;
  if (Math.abs(dy) > Math.abs(dx) * 1.5) {
    if ((nx > 0) !== ((a.x + b.x) / 2 < viewW / 2)) {
      nx = -nx;
      ny = -ny;
    }
  } else if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: nx * bow, y: ny * bow };
}

/** `n + 1` points along a quadratic arc from `a` to `b` bulging by `bow`, eased so it eases in and out. */
export function arcPoints(a: Pt, b: Pt, n: number, bow: Pt): Pt[] {
  const c = { x: (a.x + b.x) / 2 + bow.x * 2, y: (a.y + b.y) / 2 + bow.y * 2 };
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = smooth(i / n);
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  });
}

export const centerOf = (el: Element): Pt => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

// Where the kid last touched, so an award can start from the square that earned it.
let tap: (Pt & { t: number }) | null = null;
if (typeof window !== 'undefined') {
  const note = (e: Event) => {
    const p = e as PointerEvent;
    tap = { x: p.clientX, y: p.clientY, t: performance.now() };
  };
  window.addEventListener('pointerdown', note, { capture: true, passive: true });
  window.addEventListener('pointerup', note, { capture: true, passive: true });
}
export function lastTap(maxAgeMs = 2500): Pt | null {
  return tap && performance.now() - tap.t < maxAgeMs ? tap : null;
}

const STAR =
  '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17l-5.6 3 1.1-6.2-4.6-4.4 6.3-.9z" fill="#ffc83d" stroke="#1f2a44" stroke-width="2" stroke-linejoin="round"/><path d="M9.5 8.8 11 6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/></svg>';
const SPARK = '<svg viewBox="0 0 10 10" width="100%" height="100%"><path d="M5 0l1.3 3.7L10 5 6.3 6.3 5 10 3.7 6.3 0 5l3.7-1.3z" fill="currentColor"/></svg>';
const TRAIL = ['#ffb700', '#ffd35c', '#ff9f7f', '#ffc83d'];

export interface FlyOpts {
  /** Star size in px at its biggest (default 28). */
  size?: number;
  ms?: number;
  delay?: number;
  /** A small four-point sparkle instead of a star (Pip's "look here" ping). */
  spark?: boolean;
  onLand?: () => void;
}

/**
 * Flies a star from `from` to `to` (a point or an element) along an arc, with a few sparkles
 * streaming behind it, then calls `onLand`. With reduced motion (or no Web Animations) it just
 * lands at once. Returns a cancel function. Every piece ignores taps and removes itself.
 */
export function flyStar(from: Pt, to: Pt | Element, o: FlyOpts = {}): () => void {
  const end = 'getBoundingClientRect' in to ? centerOf(to) : to;
  if (motionReduced() || typeof Element === 'undefined' || !('animate' in Element.prototype)) {
    o.onLand?.();
    return () => {};
  }
  const host = document.querySelector('.kids-app') ?? document.body;
  const size = o.size ?? 28;
  const ms = o.ms ?? 650;
  const delay = o.delay ?? 0;
  const pts = arcPoints(from, end, 16, arcBow(from, end, window.innerWidth));
  const dir = end.x >= from.x ? 1 : -1;
  const live: { el: HTMLElement; a: Animation }[] = [];

  const piece = (html: string, px: number, color: string, k: number) => {
    const el = document.createElement('span');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:fixed;left:0;top:0;width:${px}px;height:${px}px;margin:${-px / 2}px 0 0 ${-px / 2}px;pointer-events:none;z-index:90;color:${color};will-change:transform,opacity;opacity:0`;
    el.innerHTML = html;
    host.appendChild(el);
    const frames = pts.map((p, i) => {
      const t = i / (pts.length - 1);
      const lift = t < 0.2 ? 0.35 + 0.9 * (t / 0.2) : 1.25 - 0.45 * ((t - 0.2) / 0.8);
      const s = lift * (k ? 0.5 - k * 0.06 : 1);
      const opacity = k ? (t < 0.08 ? 0 : 0.85 * (1 - t * t)) : t < 0.05 ? 0 : 1;
      return { transform: `translate(${p.x}px, ${p.y}px) scale(${s.toFixed(3)}) rotate(${Math.round(dir * t * 280)}deg)`, opacity };
    });
    const a = el.animate(frames, { duration: ms, delay: delay + k * 55, easing: 'linear', fill: 'both' });
    live.push({ el, a });
    return a;
  };

  const lead = piece(o.spark ? SPARK : STAR, size, o.spark ? '#ffc83d' : '', 0);
  if (!o.spark) for (let k = 1; k <= 4; k++) piece(SPARK, Math.round(size * 0.55), TRAIL[k - 1], k);
  const clear = () => live.forEach(({ el, a }) => (a.cancel(), el.remove()));
  lead.onfinish = () => {
    o.onLand?.();
    // The trail is a few frames behind: let it finish before the pieces go.
    setTimeout(clear, 260);
  };
  lead.oncancel = clear;
  return clear;
}

/** A whole number that counts up to `target` (eased); shows it at once with reduced motion. */
export function useCountUp(target: number, ms = 700, from = 0): number {
  const [v, setV] = useState(() => (motionReduced() ? target : from));
  useEffect(() => {
    if (motionReduced()) return setV(target);
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = (now - t0) / ms;
      setV(countAt(from, target, t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return v;
}
