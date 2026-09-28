// Confetti for bosses, worlds, graduation and family parties: paper bits (ribbons, dots, diamonds,
// hearts, stars, tiny crowns and pawns) shot from the bottom corners, slowing at the top, then
// falling with drag, sway and flutter. Each bit is one Web Animation computed up front. The count
// is capped (fewer on low-end phones). With reduced motion the CSS shows a still burst instead.
import { useEffect, useRef, useState } from 'react';
import { useKidCtx } from '../player/context';
import { lowEndDevice, motionReduced } from './rewardFx';

export const CONFETTI_MAX = 72;
export const CONFETTI_LOW = 28;
const DT = 0.1; // seconds per keyframe

type BitShape = 'star' | 'crown' | 'pawn' | 'dot' | 'ribbon' | 'diamond' | 'heart' | 'spark';
export interface Bit {
  shape: BitShape;
  color: string;
  w: number;
  h: number;
  delay: number;
  ms: number;
  frames: { transform: string; opacity: number }[];
}

const COLORS = ['#ffc83d', '#ff9f7f', '#9ad48f', '#7ab0e0', '#c9b3ff', '#f4a3c1', '#ff6b6b', '#4ecdc4', '#ffe066', '#fffaf0', '#5fa55a', '#e2554a'];
// Ribbons and dots are common; crowns and pawns are the rare treat.
const SHAPES: BitShape[] = ['ribbon', 'ribbon', 'ribbon', 'dot', 'dot', 'star', 'diamond', 'heart', 'spark', 'crown', 'pawn', 'star'];
const DIMS: Record<BitShape, [number, number]> = { star: [1, 1], crown: [1, 0.75], pawn: [0.7, 1], dot: [0.7, 0.7], ribbon: [0.45, 1.15], diamond: [0.8, 1], heart: [1, 0.9], spark: [1, 1] };
const FLAT: BitShape[] = ['ribbon', 'diamond', 'heart', 'dot'];

/**
 * The flight of `count` bits over a `w` x `h` screen. Two thirds are shot up from the bottom corners
 * and drag sideways; the rest drift in from the top. Falling is gravity capped at a paper-like
 * terminal speed, with a sway that grows once a bit is on its way down and a slow flutter.
 */
export function confettiBits(count: number, w: number, h: number, rand: () => number = Math.random): Bit[] {
  const g = h * 1.6;
  const grow = Math.min(1.6, Math.max(1, Math.min(w, h) / 450)); // bigger bits on a big screen
  return Array.from({ length: count }, (_, i) => {
    const shape = SHAPES[Math.floor(rand() * SHAPES.length)];
    const size = (9 + rand() * 9 + (FLAT.includes(shape) ? 0 : 5)) * grow;
    const cannon = i % 3 !== 2;
    const left = i % 2 === 0;
    const ang = ((14 + rand() * 36) * Math.PI) / 180;
    const speed = h * (0.95 + rand() * 0.7);
    let x = cannon ? (left ? -8 : w + 8) : rand() * w;
    let y = cannon ? h * (0.92 + rand() * 0.06) : -20 - rand() * 40;
    let vx = cannon ? Math.sin(ang) * speed * (left ? 1 : -1) : (rand() - 0.5) * 60;
    let vy = cannon ? -Math.cos(ang) * speed : 40 + rand() * 60;
    const term = (cannon ? 190 : 250) + rand() * 130;
    const amp = 10 + rand() * 22;
    const om = 3 + rand() * 3;
    const ph = rand() * 6.28;
    const spin = (rand() < 0.5 ? -1 : 1) * (90 + rand() * 360);
    const fom = 5 + rand() * 4;
    const flat = FLAT.includes(shape);
    const frames: Bit['frames'] = [];
    let fall = 0;
    for (let t = 0; t <= 4.001; t += DT) {
      if (vy > 0) fall += DT;
      const sway = Math.sin(ph + t * om) * amp * Math.min(1, fall / 0.5);
      const sy = flat ? 0.25 + 0.75 * Math.abs(Math.cos(ph + t * fom)) : 1;
      const out = y > h + 30 && vy > 0;
      frames.push({ transform: `translate(${(x + sway).toFixed(1)}px, ${y.toFixed(1)}px) rotate(${Math.round(spin * t)}deg) scale(1, ${sy.toFixed(2)})`, opacity: t === 0 ? 0 : 1 });
      if (out) break;
      x += vx * DT;
      y += vy * DT;
      vx *= Math.exp(-2.4 * DT);
      vy += g * DT;
      if (vy > term) vy += (term - vy) * Math.min(1, 9 * DT);
    }
    // Fade out over the last few frames.
    for (let k = 1; k <= 3 && k < frames.length; k++) frames[frames.length - k].opacity = k === 1 ? 0 : k === 2 ? 0.5 : 1;
    const [dw, dh] = DIMS[shape];
    return { shape, color: COLORS[Math.floor(rand() * COLORS.length)], w: size * dw, h: size * dh, delay: Math.round((cannon ? rand() * 0.18 : rand() * 0.9) * 1000), ms: Math.round((frames.length - 1) * DT * 1000), frames };
  });
}

export function Confetti({ run }: { run: number }) {
  const { reducedMotion } = useKidCtx();
  const [live, setLive] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (run) setLive(true);
  }, [run]);
  useEffect(() => {
    const el = box.current;
    if (!live || !el) return;
    const anims: Animation[] = [];
    let ms = 1500; // reduced motion: the still burst shows this long
    if (!reducedMotion && !motionReduced() && 'animate' in el) {
      for (const b of confettiBits(lowEndDevice() ? CONFETTI_LOW : CONFETTI_MAX, el.clientWidth, el.clientHeight)) {
        const bit = document.createElement('i');
        bit.className = `k-bit ${b.shape}`;
        bit.style.cssText = `width:${b.w.toFixed(1)}px;height:${b.h.toFixed(1)}px;margin:${(-b.h / 2).toFixed(1)}px 0 0 ${(-b.w / 2).toFixed(1)}px;background-color:${b.color}`;
        el.appendChild(bit);
        anims.push(bit.animate(b.frames, { duration: b.ms, delay: b.delay, easing: 'linear', fill: 'both' }));
      }
      ms = Math.max(0, ...anims.map((a) => Number(a.effect?.getComputedTiming().endTime ?? 0))) + 100;
    }
    const t = setTimeout(() => setLive(false), ms);
    return () => {
      clearTimeout(t);
      anims.forEach((a) => a.cancel());
      el.querySelectorAll('.k-bit').forEach((n) => n.remove());
    };
  }, [live, run, reducedMotion]);
  if (!live) return null;
  return (
    <div className="k-confetti" ref={box} aria-hidden="true">
      <span className="k-burst" />
    </div>
  );
}
