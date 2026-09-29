// Content QA for the Kids curriculum: star items solved by a separate solver, every authored item
// reachable in a run, intro pictures that agree with their words, and the "how many ways" claims
// in find-move captions checked against chess.js.
import { describe, expect, it } from 'vitest';
import type { AgeBand, IntroStep, LevelSet, Placement } from '../src/kids/activities/types';
import { bandText } from '../src/kids/activities/types';
import { ACTIVITIES, CHECKPOINTS, LEVEL_SETS } from '../src/kids/packs';
import { NODES } from '../src/kids/curriculum/worlds';
import { SKILLS, type SkillId } from '../src/kids/curriculum/skills';
import { BAND_TUNING, BANDS, resolveItem } from '../src/kids/curriculum/tuning';
import { RunPicker, visibleItems, runLength } from '../src/kids/player/run';
import { fenPlacement, isSq } from '../src/kids/lib/fen';
import { mulberry32 } from '../src/kids/lib/rng';
import { canMirror, mirrorStar, reviewStars, type StarItem } from '../src/kids/activities/stars/logic';
import { mirrorPaint, paintTargets, validatePaint, type PaintItem } from '../src/kids/activities/paint/logic';
import { flipSq } from '../src/kids/lib/mirror';
import { validateQuiz } from '../src/kids/activities/quiz/logic';
import { escapeWay, legalMoves, solutions, uciOf, type FindMoveItem } from '../src/kids/activities/findMove/logic';
import { isLight } from '../src/kids/activities/quiz/logic';
import { movedScore, memoryScore } from '../src/kids/activities/memory/logic';
import { W2_BISHOP_COLOR, W7_CASTLE } from '../src/kids/content/rules';
import { applyIntroMove } from '../src/kids/player/Intro';
import { plural } from '../src/kids/lib/plural';

// ---------- an independent Star Collector solver ----------
// Written from the rules in the spec, not from miniRules: integer coordinates, breadth-first search.

type Pc = { t: string; f: number; r: number };
const N_JUMPS = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const key = (f: number, r: number) => f * 8 + r;
const toXY = (s: string) => [s.charCodeAt(0) - 97, Number(s[1]) - 1] as const;
const inside = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

function indepPar(item: StarItem): number {
  const rocks = new Set((item.rocks ?? []).map((s) => key(...toXY(s))));
  const statues = Object.entries(item.statues ?? {}).map(([s, p]) => ({ t: p!.toUpperCase(), black: true, f: toXY(s)[0], r: toXY(s)[1] }));
  const wall = new Set([...rocks, ...statues.map((s) => key(s.f, s.r))]);
  const area = item.area
    ? (() => {
        const [a, b] = item.area!.split(':').map(toXY);
        return (f: number, r: number) => f >= Math.min(a[0], b[0]) && f <= Math.max(a[0], b[0]) && r >= Math.min(a[1], b[1]) && r <= Math.max(a[1], b[1]);
      })()
    : () => true;
  const stars = item.stars.map((s) => key(...toXY(s)));
  const full = (1 << stars.length) - 1;
  const maskAt = (f: number, r: number) => {
    const i = stars.indexOf(key(f, r));
    return i < 0 ? 0 : 1 << i;
  };

  // Squares a statue attacks, given every occupied square (sliders stop on the first one, included).
  const lava = (pcs: Pc[]) => {
    const occ = new Set([...wall, ...pcs.map((p) => key(p.f, p.r))]);
    const out = new Set<number>();
    for (const s of statues) {
      if (s.t === 'N' || s.t === 'K') {
        for (const [df, dr] of s.t === 'N' ? N_JUMPS : [...ORTH, ...DIAG]) if (inside(s.f + df, s.r + dr)) out.add(key(s.f + df, s.r + dr));
      } else if (s.t === 'P') {
        for (const df of [-1, 1]) if (inside(s.f + df, s.r - 1)) out.add(key(s.f + df, s.r - 1));
      } else {
        for (const [df, dr] of s.t === 'R' ? ORTH : s.t === 'B' ? DIAG : [...ORTH, ...DIAG]) {
          let f = s.f + df;
          let r = s.r + dr;
          while (inside(f, r)) {
            out.add(key(f, r));
            if (occ.has(key(f, r))) break;
            f += df;
            r += dr;
          }
        }
      }
    }
    return out;
  };

  // Where piece `i` may move: never onto a rock, a statue or a friend; never outside the area.
  const moves = (pcs: Pc[], i: number): [number, number][] => {
    const p = pcs[i];
    const friends = new Set(pcs.filter((_, j) => j !== i).map((q) => key(q.f, q.r)));
    const free = (f: number, r: number) => inside(f, r) && area(f, r) && !wall.has(key(f, r)) && !friends.has(key(f, r));
    const out: [number, number][] = [];
    if (p.t === 'N' || p.t === 'K') {
      for (const [df, dr] of p.t === 'N' ? N_JUMPS : [...ORTH, ...DIAG]) if (free(p.f + df, p.r + dr)) out.push([p.f + df, p.r + dr]);
    } else if (p.t === 'P') {
      if (free(p.f, p.r + 1)) {
        out.push([p.f, p.r + 1]);
        if (p.r === 1 && free(p.f, p.r + 2)) out.push([p.f, p.r + 2]);
      }
    } else {
      for (const [df, dr] of p.t === 'R' ? ORTH : p.t === 'B' ? DIAG : [...ORTH, ...DIAG]) {
        let f = p.f + df;
        let r = p.r + dr;
        while (free(f, r)) {
          out.push([f, r]);
          f += df;
          r += dr;
        }
      }
    }
    return out;
  };

  const start: Pc[] = Object.entries(item.pieces).map(([s, p]) => ({ t: p!.toUpperCase(), f: toXY(s)[0], r: toXY(s)[1] }));
  let m0 = 0;
  for (const p of start) m0 |= maskAt(p.f, p.r);
  const id = (pcs: Pc[], m: number) => pcs.map((p) => `${p.t}${p.f}${p.r}`).sort().join('.') + '|' + m;
  let frontier: { pcs: Pc[]; m: number }[] = [{ pcs: start, m: m0 }];
  const seen = new Set([id(start, m0)]);
  if (m0 === full) return 0;
  for (let depth = 1; depth <= 30 && frontier.length; depth++) {
    const next: typeof frontier = [];
    for (const { pcs, m } of frontier) {
      for (let i = 0; i < pcs.length; i++) {
        for (const [f, r] of moves(pcs, i)) {
          const moved = pcs.map((p, j) => (j === i ? { t: p.t === 'P' && r === 7 ? 'Q' : p.t, f, r } : p));
          if (lava(moved).has(key(f, r))) continue; // landing in lava bounces the piece back
          const nm = m | maskAt(f, r);
          if (nm === full) return depth;
          const k = id(moved, nm);
          if (!seen.has(k)) {
            seen.add(k);
            next.push({ pcs: moved, m: nm });
          }
        }
      }
    }
    frontier = next;
  }
  return -1;
}

const allSets = (): LevelSet[] => [...LEVEL_SETS.values(), ...CHECKPOINTS.values()];

describe('star items: par against an independent solver', () => {
  for (const set of allSets().filter((s) => s.activity === 'stars')) {
    it(`${set.id}: every item's par is the shortest route, for every band`, () => {
      for (const band of BANDS) {
        for (const r of visibleItems(set, band)) {
          const item = resolveItem(r.item as never, band) as unknown as StarItem;
          expect(indepPar(item), `${set.id}/${r.id} (${band})`).toBe(item.par);
        }
      }
    });
  }
  it('a reflected item has the same par, and the first rook lessons and personal-best items are never reflected', () => {
    let mirrored = 0;
    for (const set of allSets().filter((x) => x.activity === 'stars')) {
      for (const band of BANDS) {
        for (const r of visibleItems(set, band)) {
          const item = resolveItem(r.item as never, band) as unknown as StarItem;
          if (!canMirror(item)) continue;
          const m = mirrorStar(item);
          mirrored++;
          expect(indepPar(m), `${set.id}/${r.id} (${band}) reflected`).toBe(item.par);
          expect(mirrorStar(m)).toEqual(item);
        }
      }
    }
    expect(mirrored).toBeGreaterThan(50);
    for (const it of LEVEL_SETS.get('w1-hello')!.items) expect(canMirror(it as unknown as StarItem), (it as { id?: string }).id).toBe(false);
    for (const it of LEVEL_SETS.get('w4-boss')!.items as unknown as (StarItem & { id: string })[]) expect(canMirror(it), it.id).toBe(it.id !== 'b4');
  });
  it('the Endless generator agrees too', () => {
    const rng = mulberry32(11);
    for (const band of BANDS) for (let i = 0; i < 25; i++) {
      const item = reviewStars(rng, band);
      expect(indepPar(item), JSON.stringify(item)).toBe(item.par);
    }
  });
  it('the independent solver knows the lava, rock and promotion rules', () => {
    expect(indepPar({ pieces: { e1: 'K' }, statues: { e5: 'n' }, stars: ['e8'], par: 7 })).toBe(7);
    expect(indepPar({ pieces: { b7: 'P' }, stars: ['b8', 'h2'], par: 2 })).toBe(2);
    expect(indepPar({ pieces: { a1: 'N' }, stars: ['b2'], par: 4 })).toBe(4);
    expect(indepPar({ pieces: { a1: 'R' }, rocks: ['a4', 'd1'], stars: ['a8'], par: 3 })).toBe(3);
  });
});

describe('paint items reflected', () => {
  it('the squares to paint are the reflected squares', () => {
    for (const n of NODES.filter((x) => x.activity === 'paint')) {
      for (const it of LEVEL_SETS.get(n.id)!.items as unknown as PaintItem[]) {
        const want = paintTargets(it).map(flipSq).sort();
        expect(paintTargets(mirrorPaint(it)).sort(), n.id).toEqual(want);
      }
    }
  });
});

describe('paint item shape', () => {
  it('rejects a pawn on the first or last rank (blockers are drawn as pawns)', () => {
    expect(validatePaint({ pieces: { d4: 'R' }, blockers: ['d1'] }, 'explorer')).toContain('a pawn on the first or last rank');
    expect(validatePaint({ pieces: { d4: 'R' }, enemies: { a8: 'p' } }, 'explorer')).toContain('a pawn on the first or last rank');
    expect(validatePaint({ pieces: { d4: 'R' }, enemies: { a8: 'n' }, blockers: ['d5'] }, 'explorer')).toEqual([]);
  });
});

describe('boss runs keep their length, and the champion Knight Trek boss keeps its sticker item', () => {
  it('extra items did not lengthen the bosses', () => {
    const len = (id: string, b: AgeBand) => runLength(LEVEL_SETS.get(id)!, b, BAND_TUNING[b].itemsPerRun);
    expect([len('w1-boss', 'explorer'), len('w1-boss', 'champion')]).toEqual([3, 3]);
    expect([len('w2-boss', 'explorer'), len('w2-boss', 'champion')]).toEqual([2, 2]);
    expect([len('w3-boss', 'explorer'), len('w3-boss', 'champion')]).toEqual([3, 3]);
    expect([len('w4-boss', 'explorer'), len('w4-boss', 'champion')]).toEqual([2, 3]);
    expect([len('w3-king-lava', 'explorer'), len('w4-knight-jump', 'champion'), len('w5-promo', 'explorer')]).toEqual([3, 3, 3]);
  });
  it('a champion always meets the corner-to-corner item of the Knight Trek boss', () => {
    const ids = visibleItems(LEVEL_SETS.get('w4-boss')!, 'champion').map((r) => r.id);
    expect(ids).toEqual(['b2', 'b3', 'b4']);
  });
});

describe('quiz munch items', () => {
  it('reject a king among the munchers (a kid cannot pick a king on the board)', () => {
    // Kf... next to the pawn could capture it, but the board does not let a kid tap the king.
    const item = { kind: 'munch', fen: '4k3/8/8/4p3/4K3/8/8/8 w - - 0 1', target: 'e5', answer: ['e4'] } as never;
    expect(validateQuiz(item, 'explorer').join()).toMatch(/king/);
  });
});

// ---------- run shape ----------

describe('every node can be played by every band it lists', () => {
  for (const n of NODES) {
    it(`${n.id} has items for ${n.bands.join(', ')}`, () => {
      const set = LEVEL_SETS.get(n.id)!;
      expect(set, 'level set').toBeTruthy();
      expect(set.activity).toBe(n.activity);
      const act = ACTIVITIES.get(set.activity)!;
      for (const band of n.bands) {
        expect(visibleItems(set, band).length, band).toBeGreaterThan(0);
        expect(runLength(set, band, BAND_TUNING[band].itemsPerRun, !!act.game), band).toBeGreaterThan(0);
      }
    });
  }
  it('a fixed-order set never hides an authored item: some band reaches every item it can see', () => {
    for (const set of allSets()) {
      if (set.order !== 'fixed' || ACTIVITIES.get(set.activity)?.game) continue;
      const reached = new Set<string>();
      const seenBy = new Set<string>();
      for (const band of BANDS) {
        const vis = visibleItems(set, band);
        vis.forEach((r) => seenBy.add(r.id));
        vis.slice(0, runLength(set, band, BAND_TUNING[band].itemsPerRun)).forEach((r) => reached.add(r.id));
      }
      expect([...seenBy].filter((id) => !reached.has(id)), set.id).toEqual([]);
    }
  });
  it('a run of any node completes with distinct items, whatever the kid scores', () => {
    for (const n of NODES) {
      const set = LEVEL_SETS.get(n.id)!;
      if (ACTIVITIES.get(set.activity)?.game) continue;
      for (const band of n.bands) {
        for (const score of [1, 2, 3]) {
          const p = new RunPicker(set, band, { itemsPerRun: BAND_TUNING[band].itemsPerRun, startTier: BAND_TUNING[band].startTier, rng: mulberry32(5) });
          const ids: string[] = [];
          for (let r = p.next(); r; r = p.next()) {
            ids.push(r.id);
            p.report(score);
          }
          expect(ids.length, `${n.id} ${band}`).toBe(p.total);
          expect(new Set(ids).size, `${n.id} ${band}`).toBe(ids.length);
        }
      }
    }
  });
  it('w5-army asks a Sprout about every kind of piece over a few runs', () => {
    const set = LEVEL_SETS.get('w5-army')!;
    const asked = new Set<string>();
    let last: string[] = [];
    for (let run = 0; run < 4; run++) {
      const p = new RunPicker(set, 'sprout', { itemsPerRun: 3, startTier: 1, rng: mulberry32(run + 1), lastItems: last });
      last = [];
      for (let r = p.next(); r; r = p.next()) {
        asked.add(String((r.item as { ask?: string }).ask));
        last.push(r.id);
      }
    }
    expect([...asked].sort()).toEqual(['b', 'k', 'n', 'p', 'q', 'r']);
  });
  it('w1-hello: Sprouts and Explorers start with the one-star rook moves; Champions start a step further on', () => {
    const set = LEVEL_SETS.get('w1-hello')!;
    const first = (b: AgeBand) => visibleItems(set, b)[0].id;
    expect([first('sprout'), first('explorer'), first('champion')]).toEqual(['h1', 'h1', 'h3']);
    // every band still gets its whole run
    for (const b of BANDS) expect(runLength(set, b, BAND_TUNING[b].itemsPerRun)).toBe(set.perRun![b]);
  });
});

// ---------- intros ----------

const introSets = () => allSets().filter((s) => s.intro?.length) as (LevelSet & { intro: IntroStep[] })[];

describe('intros', () => {
  it('every square in an intro is a real square, and every move starts on a piece', () => {
    for (const set of introSets()) {
      let pos: Placement = {};
      for (const [i, step] of set.intro.entries()) {
        const where = `${set.id} step ${i + 1}`;
        if (step.fen) pos = fenPlacement(step.fen);
        else if (step.pieces) pos = { ...step.pieces };
        const squares = [...Object.keys(step.pieces ?? {}), ...Object.keys(step.art ?? {}), ...Object.keys(step.tones ?? {}), ...(step.arrows ?? []).flatMap((a) => [a.from, a.to]), ...(step.move ?? [])];
        for (const s of squares) expect(isSq(s), `${where}: ${s}`).toBe(true);
        if (step.move) {
          expect(pos[step.move[0]], `${where}: nothing on ${step.move[0]}`).toBeTruthy();
          if (step.art?.[step.move[1]] === 'star') expect(step.art[step.move[1]]).toBe('star');
          const p = { ...pos };
          p[step.move[1]] = p[step.move[0]];
          delete p[step.move[0]];
          pos = p;
        }
        for (const a of step.arrows ?? []) expect(a.from, `${where}: zero-length arrow`).not.toBe(a.to);
        if (step.pick) {
          expect(step.pick.options).toContain(step.pick.answer);
          expect(new Set(step.pick.options).size).toBe(step.pick.options.length);
        }
      }
    }
  });
  it('"this is the piece" demos keep their piece in view: no line arrow starts on the piece itself', () => {
    for (const set of introSets()) {
      let pos: Placement = {};
      for (const [i, step] of set.intro.entries()) {
        if (step.fen) pos = fenPlacement(step.fen);
        else if (step.pieces) pos = { ...step.pieces };
        if (Object.keys(pos).length > 3) continue;
        for (const a of step.arrows ?? []) {
          if (pos[a.to] || a.color === 'red') continue; // attack arrows run from piece to piece
          expect(pos[a.from], `${set.id} step ${i + 1}: arrow from ${a.from} hides the piece`).toBeUndefined();
        }
      }
    }
  });
  it('a castling demo brings the rook along, on both sides', () => {
    const castle = W7_CASTLE.intro![0];
    const start = fenPlacement(castle.fen!);
    expect(castle.move).toEqual(['e1', 'g1']);
    expect(applyIntroMove(start, 'e1', 'g1')).toMatchObject({ g1: 'K', f1: 'R', a1: 'R' });
    expect(applyIntroMove(start, 'e1', 'g1').h1).toBeUndefined();
    const queenside = applyIntroMove(start, 'e1', 'c1');
    expect(queenside).toMatchObject({ c1: 'K', d1: 'R', h1: 'R' });
    expect(queenside.a1).toBeUndefined();
    // an ordinary king step moves only the king
    expect(applyIntroMove(start, 'e1', 'e2')).toMatchObject({ e2: 'K', a1: 'R', h1: 'R' });
  });
  it('every intro takes under 30 seconds to watch, whatever the band, and Piece Parade intros have at most 3 speaking steps', () => {
    const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
    for (const n of NODES) {
      const set = LEVEL_SETS.get(n.id)!;
      if (!set.intro?.length) continue;
      const steps = set.intro.filter((s) => !s.pick);
      if (set.intro.some((s) => s.pick)) expect(steps.length, `${n.id} speaking steps`).toBeLessThanOrEqual(3);
      for (const band of n.bands) {
        // the same timing the player uses: speech time, the move, then the pause
        const rate = BAND_TUNING[band].speechRate;
        const ms = steps.reduce((sum, st) => sum + Math.max(1100, (words(bandText(st.say, band)) * 1000) / (2.4 * rate)) + (st.move ? 900 : 0) + (st.ms ?? 1800), 0);
        expect(ms, `${n.id} ${band}`).toBeLessThan(30000);
      }
    }
  });
  it('the bishop-color intro shows a bishop on the color the words name', () => {
    const [say1, say2] = W2_BISHOP_COLOR.intro!;
    expect(bandText(say1.say, 'sprout')).toMatch(/light squares/);
    const bishop = Object.keys(say1.pieces!)[0];
    expect(isLight(bishop)).toBe(true);
    for (const a of say1.arrows!) {
      expect(isLight(a.to), `arrow to ${a.to}`).toBe(true);
      expect(isLight(a.from), `arrow from ${a.from}`).toBe(true);
    }
    expect(isLight(say2.move![1])).toBe(true);
    expect(say2.pieces).toEqual(say1.pieces);
  });
});

// ---------- find-move captions that count ways ----------

describe('find-move captions that count solutions', () => {
  const fm = (setId: string, id: string) => {
    const set = LEVEL_SETS.get(setId)!;
    return set.items.find((it) => (it as { id?: string }).id === id) as unknown as FindMoveItem;
  };
  it('"two ways" (w7-check c4) has exactly two hops, "only one" (c6, p3) exactly one', () => {
    expect(solutions(fm('w7-check', 'c4').fen, fm('w7-check', 'c4').goal).map(uciOf).sort()).toEqual(['e4d6', 'e4f6']);
    expect(solutions(fm('w7-check', 'c6').fen, fm('w7-check', 'c6').goal).map(uciOf)).toEqual(['b1g6']);
    expect(solutions(fm('w6-protect', 'p3').fen, fm('w6-protect', 'p3').goal).map(uciOf)).toEqual(['f1e3']);
  });
  it('escape items offer exactly the ways they list', () => {
    for (const set of [LEVEL_SETS.get('w7-escape')!, CHECKPOINTS.get('cp7')!]) {
      for (const it of set.items as unknown as (FindMoveItem & { goal: { kind: string; ways: string[] | 'any' } })[]) {
        if (it.goal.kind !== 'escape' || it.goal.ways === 'any') continue;
        const found = new Set(legalMoves(it.fen).map((m) => escapeWay(it.fen, m)));
        expect([...found].sort(), `${set.id}/${(it as { id?: string }).id}`).toEqual([...it.goal.ways].sort());
      }
    }
  });
});

// ---------- skills ----------

describe('skills in the grown-up report', () => {
  it('every skill comes from a non-bonus node some band can play (bonus nodes never reach the report)', () => {
    for (const id of Object.keys(SKILLS)) {
      const nodes = NODES.filter((n) => !n.bonus && n.skills.includes(id as SkillId));
      expect(nodes.length, id).toBeGreaterThan(0);
    }
  });
  it('every skill a node lists is a known skill', () => {
    for (const n of NODES) for (const s of n.skills) expect(SKILLS[s], `${n.id}: ${s}`).toBeTruthy();
  });
});

// ---------- Magic Memory scoring ----------

describe('screen-reader counts', () => {
  it('say one star, two stars', () => {
    expect([plural(0, 'star'), plural(1, 'star'), plural(2, 'star')]).toEqual(['0 stars', '1 star', '2 stars']);
    expect(plural(1, 'light square')).toBe('1 light square');
  });
});

describe('memory scores', () => {
  it('"what moved" scores by tries, however few pieces stand on the board', () => {
    expect([movedScore(0), movedScore(1), movedScore(2), movedScore(5)]).toEqual([3, 2, 1, 1]);
  });
  it('rebuild scores by the share placed first try', () => {
    expect([memoryScore(4, 4), memoryScore(4, 3), memoryScore(4, 2), memoryScore(2, 1)]).toEqual([3, 2, 1, 1]);
  });
});

// ---------- words ----------

describe('what Pip says while a kid plays', () => {
  it('captions and intros never tell a Sprout a square name', () => {
    for (const n of NODES.filter((x) => x.bands.includes('sprout'))) {
      const set = LEVEL_SETS.get(n.id)!;
      for (const r of visibleItems(set, 'sprout')) {
        const text = bandText((resolveItem(r.item as never, 'sprout') as { say?: never }).say, 'sprout');
        expect(text, `${set.id}/${r.id}`).not.toMatch(/\b[a-h][1-8]\b/);
      }
      for (const step of set.intro ?? []) expect(bandText(step.say, 'sprout'), `${set.id} intro`).not.toMatch(/\b[a-h][1-8]\b/);
    }
  });
});
