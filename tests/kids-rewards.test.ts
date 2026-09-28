// Kids mode rewards and Pip's reactions: the reaction emitter, the flight path and count-up maths,
// the confetti physics (capped, fades out, deterministic) and the star jar's drop steps.
import { describe, expect, it, vi } from 'vitest';
import { REACT_DEDUPE_MS, hintTarget, lookVector, onPipReact, pipReact, type PipReactEvent } from '../src/kids/ui/pipEvents';
import { arcBow, arcPoints, countAt, easeOutCubic, lowEndDevice, motionReduced } from '../src/kids/ui/rewardFx';
import { CONFETTI_LOW, CONFETTI_MAX, confettiBits } from '../src/kids/ui/Confetti';
import { jarSteps } from '../src/kids/ui/StarJar';
import { mulberry32 } from '../src/kids/lib/rng';

describe('pipReact', () => {
  it('reaches listeners, stops after unsubscribe, and drops a repeat inside the dedupe window', () => {
    const got: PipReactEvent[] = [];
    const off = onPipReact((e) => got.push(e));
    expect(pipReact('cheer', undefined, 10_000)).toBe(true);
    expect(pipReact('cheer', undefined, 10_000 + REACT_DEDUPE_MS - 1)).toBe(false);
    expect(pipReact('oops', undefined, 10_000 + REACT_DEDUPE_MS - 1)).toBe(true); // another kind is fine
    expect(pipReact('cheer', undefined, 10_000 + 2 * REACT_DEDUPE_MS)).toBe(true);
    expect(got.map((e) => e.kind)).toEqual(['cheer', 'oops', 'cheer']);
    off();
    pipReact('wow', undefined, 20_000);
    expect(got).toHaveLength(3);
  });

  it('a look at another square is not a repeat', () => {
    const fn = vi.fn();
    const off = onPipReact(fn);
    pipReact('point', 'e4', 30_000);
    pipReact('point', 'e5', 30_010);
    pipReact('point', 'e5', 30_020);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1][0]).toMatchObject({ kind: 'point', square: 'e5' });
    off();
  });
});

describe('hintTarget', () => {
  it('prefers where the arrow ends, then the highlighted piece, else nothing', () => {
    expect(hintTarget({ arrows: [{ from: 'a1', to: 'a4' }], tones: { a1: 'hint' } })).toBe('a4');
    expect(hintTarget({ tones: { c3: 'good', a1: 'hint' } })).toBe('a1');
    expect(hintTarget({ tones: { c3: 'good' } })).toBeUndefined();
    expect(hintTarget({})).toBeUndefined();
    expect(hintTarget(null)).toBeUndefined();
  });
});

describe('lookVector', () => {
  it('faces right and leans toward a target below, mirrors for one well to his left', () => {
    const down = lookVector(100, 200);
    expect(down.flip).toBe(false);
    expect(down.lean).toBeGreaterThan(0);
    expect(down.ly).toBeGreaterThan(down.lx);
    const left = lookVector(-200, 0);
    expect(left.flip).toBe(true);
    expect(left.lx).toBeGreaterThan(0); // in the mirrored frame he still looks "forward"
    expect(lookVector(50, -400).lean).toBeLessThan(0);
  });

  it('keeps the lean and the pupil shift small', () => {
    for (const [dx, dy] of [[1, 1000], [1000, -1000], [-1000, 1000], [0, 0]]) {
      const v = lookVector(dx, dy);
      expect(Math.abs(v.lean)).toBeLessThanOrEqual(14);
      expect(Math.hypot(v.lx, v.ly)).toBeLessThanOrEqual(2.61);
    }
  });
});

describe('flight and count-up maths', () => {
  const a = { x: 100, y: 500 };
  const b = { x: 300, y: 40 };

  it('an arc starts at the start, ends at the end and bows away from the straight line', () => {
    const pts = arcPoints(a, b, 16, arcBow(a, b, 390));
    expect(pts).toHaveLength(17);
    expect(pts[0]).toEqual(a);
    expect(pts[16].x).toBeCloseTo(b.x);
    expect(pts[16].y).toBeCloseTo(b.y);
    const mid = pts[8];
    const straight = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    expect(Math.hypot(mid.x - straight.x, mid.y - straight.y)).toBeGreaterThan(30);
  });

  it('bows upward for a level or downward flight, sideways toward the middle for a climb', () => {
    expect(arcBow({ x: 50, y: 300 }, { x: 250, y: 320 }, 390).y).toBeLessThan(0);
    expect(arcBow({ x: 50, y: 100 }, { x: 250, y: 120 }, 390).y).toBeLessThan(0);
    // A climb on the left half of the screen bows right, on the right half bows left.
    expect(arcBow({ x: 60, y: 700 }, { x: 80, y: 40 }, 390).x).toBeGreaterThan(0);
    expect(arcBow({ x: 330, y: 700 }, { x: 310, y: 40 }, 390).x).toBeLessThan(0);
  });

  it('eases in and out along the path (slower at the ends)', () => {
    const pts = arcPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 10, { x: 0, y: 0 });
    const step = (i: number) => pts[i + 1].x - pts[i].x;
    expect(step(0)).toBeLessThan(step(5));
    expect(step(9)).toBeLessThan(step(5));
  });

  it('counts up from the start to the target, eased, and clamps', () => {
    expect(countAt(0, 23, 0)).toBe(0);
    expect(countAt(0, 23, 1)).toBe(23);
    expect(countAt(0, 23, 5)).toBe(23);
    expect(countAt(0, 23, -1)).toBe(0);
    const mid = countAt(10, 20, 0.3);
    expect(mid).toBeGreaterThan(10);
    expect(mid).toBeLessThan(20);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5); // fast at first
  });

  it('outside a browser it reports reduced motion', () => {
    expect(motionReduced()).toBe(true);
  });

  it('few cores or little memory count as a low-end device', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 8, deviceMemory: 8 });
    expect(lowEndDevice()).toBe(false);
    vi.stubGlobal('navigator', { hardwareConcurrency: 4 });
    expect(lowEndDevice()).toBe(true);
    vi.stubGlobal('navigator', { hardwareConcurrency: 8, deviceMemory: 2 });
    expect(lowEndDevice()).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('confettiBits', () => {
  const W = 390;
  const H = 844;

  it('makes exactly the count asked for, with the caps in place', () => {
    expect(confettiBits(CONFETTI_MAX, W, H, mulberry32(1))).toHaveLength(CONFETTI_MAX);
    expect(CONFETTI_LOW).toBeLessThan(CONFETTI_MAX);
    expect(CONFETTI_MAX).toBeLessThanOrEqual(80);
    expect(CONFETTI_LOW).toBeLessThanOrEqual(32);
  });

  it('is deterministic for a seed and varied in shape and color', () => {
    const a = confettiBits(CONFETTI_MAX, W, H, mulberry32(7));
    const b = confettiBits(CONFETTI_MAX, W, H, mulberry32(7));
    expect(a).toEqual(b);
    expect(new Set(a.map((x) => x.shape)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(a.map((x) => x.color)).size).toBeGreaterThanOrEqual(6);
  });

  it('every bit fades in, falls off the bottom or times out, and fades out', () => {
    for (const bit of confettiBits(CONFETTI_MAX, W, H, mulberry32(3))) {
      expect(bit.frames[0].opacity).toBe(0);
      expect(bit.frames[bit.frames.length - 1].opacity).toBe(0);
      expect(bit.ms).toBeLessThanOrEqual(4100);
      expect(bit.ms).toBeGreaterThan(500);
      expect(bit.delay).toBeLessThanOrEqual(900);
      const y = (f: { transform: string }) => Number(/translate\([-\d.]+px, ([-\d.]+)px\)/.exec(f.transform)![1]);
      const last = y(bit.frames[bit.frames.length - 1]);
      // Either it left the bottom of the screen or it timed out still on its way down.
      expect(last > H * 0.5 || bit.ms >= 4000).toBe(true);
    }
  });

  it('cannon bits shoot up before they fall, and fall slowly (terminal speed)', () => {
    const bits = confettiBits(30, W, H, mulberry32(11));
    const cannon = bits.filter((_, i) => i % 3 !== 2);
    for (const bit of cannon) {
      const ys = bit.frames.map((f) => Number(/translate\([-\d.]+px, ([-\d.]+)px\)/.exec(f.transform)![1]));
      expect(Math.min(...ys)).toBeLessThan(ys[0] - 100); // rose
      const late = ys.length - 1;
      expect(ys[late] - ys[late - 3]).toBeLessThan(0.1 * 3 * 460); // at most ~460 px/s once falling
    }
  });

  it('a big screen gets bigger bits than a phone', () => {
    const size = (w: number, h: number) => confettiBits(CONFETTI_MAX, w, h, mulberry32(5)).reduce((n, b) => n + b.w, 0);
    expect(size(1280, 800)).toBeGreaterThan(size(390, 844));
  });
});

describe('jarSteps', () => {
  it('steps up to the new count, at most eight drops, ending on it', () => {
    expect(jarSteps(30, 33)).toEqual([31, 32, 33]);
    expect(jarSteps(30, 30)).toEqual([]);
    expect(jarSteps(40, 30)).toEqual([]);
    const big = jarSteps(0, 50);
    expect(big).toHaveLength(8);
    expect(big[7]).toBe(50);
    expect([...big].sort((x, y) => x - y)).toEqual(big);
  });
});
