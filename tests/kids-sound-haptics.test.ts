import { afterEach, describe, expect, it, vi } from 'vitest';
import { HAPTIC_PATTERNS, haptic } from '../src/kids/player/haptics';
import { MASTER, TRIM_DB, playKidSound, type KidSound } from '../src/kids/player/kidSounds';
import { capturedIn, cellOf, cellOfSq } from '../src/kids/activities/useBoardFx';

const NAMES = Object.keys(TRIM_DB) as KidSound[];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('kid haptics', () => {
  it('has the small patterns the spec lists', () => {
    expect(HAPTIC_PATTERNS.move).toBe(8);
    expect(HAPTIC_PATTERNS.capture).toBe(15);
    expect(HAPTIC_PATTERNS.boop).toBe(20);
    expect(HAPTIC_PATTERNS.pop).toEqual([10, 30, 10]);
    expect(HAPTIC_PATTERNS.star).toEqual([10, 30, 10]);
    expect(Array.isArray(HAPTIC_PATTERNS.fanfare)).toBe(true);
    // Everything stays well under a second in total.
    for (const p of Object.values(HAPTIC_PATTERNS)) expect([p].flat().reduce((a, b) => a + b, 0)).toBeLessThan(200);
  });

  it('vibrates through navigator.vibrate', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    expect(haptic('move')).toBe(true);
    expect(haptic('pop')).toBe(true);
    expect(vibrate.mock.calls).toEqual([[8], [[10, 30, 10]]]);
  });

  it('stays still for sounds without a pattern', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    for (const n of ['whoosh', 'tick', 'sparkle'] as const) expect(haptic(n)).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('never throws: no navigator, no vibrate (iOS Safari), a throwing vibrate', () => {
    vi.stubGlobal('navigator', undefined);
    expect(haptic('capture')).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(haptic('capture')).toBe(false);
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('blocked');
      },
    });
    expect(haptic('capture')).toBe(false);
    vi.stubGlobal('navigator', { vibrate: () => false });
    expect(haptic('capture')).toBe(false);
  });

  it('follows the kid sound switch: nothing while muted or off, a tap when on', async () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    const { kidSound, setKidSoundEnabled } = await import('../src/kids/lib/kidsSound');
    setKidSoundEnabled(false); // KidsApp sets this to sound && !muted
    kidSound('capture');
    kidSound('boop');
    expect(vibrate).not.toHaveBeenCalled();
    setKidSoundEnabled(true);
    kidSound('capture');
    kidSound('boop');
    expect(vibrate.mock.calls).toEqual([[15], [20]]);
  });
});

// A recording stand-in for an AudioContext that enforces what the real one throws on.
function fakeContext() {
  const nodes: FakeNode[] = [];
  const edges: [FakeNode, FakeNode][] = [];
  interface FakeNode {
    kind: string;
    [k: string]: unknown;
  }
  const param = (value = 0) => {
    const p = {
      value,
      events: [] as [string, number, number][],
      setValueAtTime(v: number, t: number) {
        expect(Number.isFinite(v) && Number.isFinite(t) && t >= 0).toBe(true);
        p.events.push(['set', v, t]);
        return p;
      },
      linearRampToValueAtTime(v: number, t: number) {
        expect(Number.isFinite(v) && v >= 0).toBe(true);
        p.events.push(['lin', v, t]);
        return p;
      },
      exponentialRampToValueAtTime(v: number, t: number) {
        expect(v).toBeGreaterThan(0); // the real one throws a RangeError on 0 or less
        p.events.push(['exp', v, t]);
        return p;
      },
    };
    return p;
  };
  const make = (kind: string, extra: object = {}) => {
    const n: FakeNode = {
      kind,
      connect(to: FakeNode) {
        edges.push([n, to]);
        return to;
      },
      ...extra,
    };
    nodes.push(n);
    return n;
  };
  const destination = make('destination');
  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    destination,
    createGain: () => make('gain', { gain: param(1) }),
    createDynamicsCompressor: () => make('compressor', { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createBiquadFilter: () => make('filter', { type: 'lowpass', frequency: param(350), Q: param(1) }),
    createOscillator: () => make('osc', { type: 'sine', frequency: param(440), detune: param(), start: vi.fn(), stop: vi.fn() }),
    createBufferSource: () => make('source', { buffer: null, start: vi.fn() }),
    createBuffer: (_c: number, len: number) => ({ length: len, getChannelData: () => new Float32Array(len) }),
  };
  /** Every node except the destination must be able to reach it, or the sound would be lost. */
  const reachesDestination = (n: FakeNode): boolean => n === destination || edges.some(([a, b]) => a === n && reachesDestination(b));
  return { ctx: ctx as unknown as BaseAudioContext, nodes, edges, destination, reachesDestination, raw: ctx };
}

describe('kid sound bank', () => {
  it('draws every sound name into a working graph', () => {
    for (const name of NAMES) {
      const f = fakeContext();
      playKidSound(f.ctx, name);
      const oscs = f.nodes.filter((n) => n.kind === 'osc' || n.kind === 'source');
      expect(oscs.length, name).toBeGreaterThan(0);
      for (const n of f.nodes) expect(f.reachesDestination(n), `${name}: ${n.kind} reaches the destination`).toBe(true);
      // Everything that starts also stops, after it starts and never before now.
      for (const o of f.nodes.filter((n) => n.kind === 'osc')) {
        const start = (o.start as ReturnType<typeof vi.fn>).mock.calls[0][0] as number;
        const stop = (o.stop as ReturnType<typeof vi.fn>).mock.calls[0][0] as number;
        expect(start, name).toBeGreaterThanOrEqual(0);
        expect(stop, name).toBeGreaterThan(start);
      }
    }
  });

  it('routes through one gentle limiter and one master gain per context, at the kids level', () => {
    const f = fakeContext();
    playKidSound(f.ctx, 'move');
    playKidSound(f.ctx, 'capture');
    playKidSound(f.ctx, 'fanfare');
    expect(f.nodes.filter((n) => n.kind === 'compressor')).toHaveLength(1);
    const masters = f.nodes.filter((n) => n.kind === 'gain' && f.edges.some(([a, b]) => a === n && b.kind === 'compressor'));
    expect(masters).toHaveLength(1);
    expect((masters[0].gain as { value: number }).value).toBe(MASTER);
    expect(MASTER).toBeLessThanOrEqual(0.7);
  });

  it('keeps every trim at or below a modest boost, so no sound is loud', () => {
    for (const name of NAMES) expect(TRIM_DB[name], name).toBeLessThanOrEqual(5);
  });

  it('climbs the ladder for star pops and stops at the top', () => {
    const first = (step: number) => {
      const f = fakeContext();
      playKidSound(f.ctx, 'pop', step);
      return (f.nodes.find((n) => n.kind === 'osc')!.frequency as { value: number }).value;
    };
    const ladder = [0, 1, 2, 3, 4, 5, 6, 7].map(first);
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]).toBeGreaterThan(ladder[i - 1]);
    expect(first(20)).toBe(ladder[7]);
    expect(first(-3)).toBe(ladder[0]);
  });

  it('draws the same noise every time', () => {
    const f1 = fakeContext();
    const f2 = fakeContext();
    // The buffers come from a fixed seed: two contexts get identical samples.
    const grab = (f: ReturnType<typeof fakeContext>) => {
      const bufs: Float32Array[] = [];
      f.raw.createBuffer = ((_c: number, len: number) => {
        const d = new Float32Array(len);
        bufs.push(d);
        return { length: len, getChannelData: () => d };
      }) as never;
      playKidSound(f.ctx, 'whoosh');
      return bufs[0];
    };
    const n1 = grab(f1);
    const n2 = grab(f2);
    expect([...n1.slice(0, 50)]).toEqual([...n2.slice(0, 50)]);
    expect(Math.max(...n1.slice(0, 2000))).toBeLessThan(1);
  });
});

describe('board fx helpers', () => {
  it('reads a piece cell from its transform, and none while it is dragged', () => {
    expect(cellOf('translate(300%, 700%)')).toEqual([3, 7]);
    expect(cellOf('translate(0%, 0%)')).toEqual([0, 0]);
    expect(cellOf('translate(247.5px, 330px) scale(1.12)')).toBeNull();
  });

  it('maps squares to cells for both orientations', () => {
    expect(cellOfSq('a1', 'white')).toEqual([0, 7]);
    expect(cellOfSq('h8', 'white')).toEqual([7, 0]);
    expect(cellOfSq('a1', 'black')).toEqual([7, 0]);
    expect(cellOfSq('e4', 'black')).toEqual([3, 3]);
  });

  const seen = (color: string, cell: [number, number]) => ({ color, cell, cls: `pc-${color}P` });
  it('finds a capture: a piece gone from the cell another colour arrived on', () => {
    expect(capturedIn([seen('b', [3, 3])], [seen('w', [3, 3])])).toHaveLength(1);
  });

  it('does not call a same-colour arrival, a plain move or a reshuffle a capture', () => {
    expect(capturedIn([seen('b', [3, 3])], [seen('b', [3, 3])])).toHaveLength(0);
    expect(capturedIn([], [seen('w', [3, 3])])).toHaveLength(0);
    expect(capturedIn([seen('b', [1, 1])], [seen('w', [3, 3])])).toHaveLength(0);
    const many = Array.from({ length: 5 }, (_, i) => seen('b', [i, 0]));
    expect(capturedIn(many, many.map((m) => ({ ...m, color: 'w' })))).toHaveLength(0);
  });

  it('finds a promotion capture (the new queen counts as an arrival)', () => {
    expect(capturedIn([seen('w', [4, 1]), seen('b', [3, 0])], [{ color: 'w', cell: [3, 0], cls: 'pc-wQ' }])).toHaveLength(1);
  });

  it('finds en passant: the passed pawn vanishes beside the square the capturing pawn left', () => {
    // White d5xe6 en passant: the black pawn on e5 (cell [4, 3]) goes, the white pawn steps [3, 3] -> [4, 2].
    const passed = seen('b', [4, 3]);
    const mover = { ...seen('w', [4, 2]), from: [3, 3] as [number, number] };
    expect(capturedIn([passed], [mover])).toHaveLength(1);
    // Black exd3 the other way round works too.
    expect(capturedIn([seen('w', [3, 4])], [{ ...seen('b', [3, 5]), from: [4, 4] as [number, number] }])).toHaveLength(1);
  });

  it('does not call a pawn that merely stands beside another a capture', () => {
    const passed = seen('b', [4, 3]);
    const at = (cell: [number, number], from?: [number, number]) => ({ ...seen('w', cell), from });
    expect(capturedIn([passed], [at([4, 2])])).toHaveLength(0); // no origin known
    expect(capturedIn([passed], [at([4, 2], [4, 3])])).toHaveLength(0); // came from the passed pawn's own square
    expect(capturedIn([passed], [at([4, 2], [3, 4])])).toHaveLength(0); // came from another rank
    expect(capturedIn([passed], [at([5, 2], [4, 3])])).toHaveLength(0); // landed on another file
    expect(capturedIn([passed], [{ ...at([4, 2], [3, 3]), cls: 'pc-wN' }])).toHaveLength(0); // not a pawn
    expect(capturedIn([{ ...passed, cls: 'pc-bN' }], [at([4, 2], [3, 3])])).toHaveLength(0); // a knight is not passed
    expect(capturedIn([passed], [{ ...at([4, 2], [3, 3]), color: 'b' }])).toHaveLength(0); // own colour
  });
});
