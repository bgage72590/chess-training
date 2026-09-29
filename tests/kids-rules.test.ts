// Pack C (Rules and Mates) tests: every quiz answer recomputed with chess.js, munch sets, castling,
// en passant, the mate-drill JS defender and the drill start positions (spec 15).
import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { LEVEL_SETS } from '../src/kids/packs';
import { BANDS, resolveItem, visibleTo } from '../src/kids/curriculum/tuning';
import { canCastle, castleReasons, checkers, countOptions, countSquares, isLight, munchers, statusOf, tradeOutcome, validateQuiz, valueAnswer, type QuizItem } from '../src/kids/activities/quiz/logic';
import { defend, hasMateIn1, mobilityNext, scoreDefenses } from '../src/kids/activities/mateDrill/defense';
import { drillScore, greedyWhiteMove, judgeKidMove, ladderRungs, queenBox, validateMateDrill, type MateDrillItem } from '../src/kids/activities/mateDrill/logic';
import { solutions, validateFindMove, type FindMoveItem } from '../src/kids/activities/findMove/logic';
import { mulberry32 } from '../src/kids/lib/rng';
import { placementFen } from '../src/kids/lib/fen';
import { rulesPack } from '../src/kids/content/rules';

const set = <T,>(id: string) => LEVEL_SETS.get(id)!.items as unknown as (T & { id: string })[];
const quiz = (id: string) => set<QuizItem>(id);

describe('Pack C registration', () => {
  it('registers every level set of the pack', () => {
    const ids = ['w2-bishop-color', 'w4-knight-count', 'w6-candy', 'w6-protect', 'w6-trade', 'w7-spot-check', 'w7-escape', 'w7-mate-or-not', 'w7-stalemate', 'w7-castle', 'w7-en-passant', 'w8-ladder', 'w8-box', 'w8-rook-mate'];
    expect(rulesPack.levelSets.map((s) => s.id).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(LEVEL_SETS.has(id), id).toBe(true);
  });
});

/** Every FEN the pack shows (quiz boards, embedded and plain find-move items, drills). */
function packFens(): { where: string; fen: string }[] {
  const out: { where: string; fen: string }[] = [];
  for (const s of rulesPack.levelSets)
    for (const it of s.items as Record<string, unknown>[]) {
      const where = `${s.id} ${it.id}`;
      if (typeof it.fen === 'string') out.push({ where, fen: it.fen });
      const mv = it.move as { fen?: string } | undefined;
      if (mv && typeof mv === 'object' && !Array.isArray(mv) && mv.fen) out.push({ where, fen: mv.fen });
    }
  return out;
}

describe('Pack C positions', () => {
  it('are legal: the side that is not to move is never in check', () => {
    const fens = packFens();
    expect(fens.length).toBeGreaterThan(40);
    for (const { where, fen } of fens) {
      const c = new Chess(fen);
      const them = c.turn() === 'w' ? 'b' : 'w';
      const k = c.findPiece({ type: 'k', color: them })[0];
      expect(k, where).toBeTruthy();
      expect(c.isAttacked(k, c.turn()), where).toBe(false);
    }
  });
});

describe('quiz answers recomputed with chess.js', () => {
  it('status2: check or nothing, and the attacker', () => {
    for (const it of quiz('w7-spot-check')) {
      if (it.kind !== 'status2') throw new Error('status2 expected');
      const c = new Chess(it.fen);
      expect(c.inCheck() ? 'check' : 'nothing', it.id).toBe(it.answer);
      expect(c.isCheckmate() || c.isStalemate(), it.id).toBe(false);
      if (it.answer === 'check') expect(checkers(it.fen)).toEqual([it.attacker]);
    }
    const byId = Object.fromEntries(quiz('w7-spot-check').map((x) => [x.id, x]));
    expect(byId.sc1).toMatchObject({ answer: 'check', attacker: 'e1' });
    expect(byId.sc2).toMatchObject({ answer: 'nothing' });
    expect(byId.sc6).toMatchObject({ answer: 'check', attacker: 'f7' });
  });

  it('status4: checkmate, stalemate, check, nothing', () => {
    for (const id of ['w7-mate-or-not', 'w7-stalemate'])
      for (const it of quiz(id)) {
        if (it.kind !== 'status4') continue;
        const c = new Chess(it.fen);
        const s = c.isCheckmate() ? 'checkmate' : c.isStalemate() ? 'stalemate' : c.inCheck() ? 'check' : 'nothing';
        expect(s, `${id} ${it.id}`).toBe(it.answer);
        expect(statusOf(it.fen)).toBe(s);
      }
    const answers = quiz('w7-mate-or-not').map((x) => (x as { answer: string }).answer);
    expect(answers).toEqual(['checkmate', 'stalemate', 'check', 'nothing', 'checkmate', 'checkmate', 'stalemate', 'stalemate']);
  });

  it('count: knight hops and the rook surprise', () => {
    expect(countSquares({ d4: 'N' })).toBe(8);
    expect(countSquares({ a1: 'N' })).toBe(2);
    expect(countSquares({ b1: 'N' })).toBe(3);
    expect(countSquares({ g2: 'N' })).toBe(4);
    expect(countSquares({ d4: 'R' })).toBe(14);
    for (const it of quiz('w4-knight-count')) {
      if (it.kind !== 'count') throw new Error('count expected');
      const [sq, pc] = Object.entries(it.pieces)[0];
      // Two kings in far corners make it a legal chess.js position without touching the piece's squares.
      const reach = new Set([sq, ...['a2', 'b1', 'b2', 'a7', 'b8', 'b7', 'g1', 'h2', 'g2', 'g8', 'h7', 'g7']]);
      const [wk, bk] = ['a1', 'h8', 'a8', 'h1'].filter((k) => k !== sq && !reach.has(k) && !(it.answer && countSquares({ [k]: pc! }) < 0));
      const c = new Chess(placementFen({ [sq]: pc!, [wk]: 'K', [bk]: 'k' }));
      const legal = c.moves({ square: sq as 'd4', verbose: true }).length;
      expect(legal, it.id).toBe(it.answer);
    }
  });

  it('count options always contain the answer', () => {
    const rng = mulberry32(7);
    for (const n of [2, 3, 4, 8, 14]) {
      const o = countOptions(n, rng);
      expect(o).toContain(n);
      expect(o.length).toBe(4);
      expect(o.every((x) => x >= 1)).toBe(true);
    }
  });

  it('value: candy comparisons', () => {
    expect(valueAnswer('P', 'N')).toBe('b');
    expect(valueAnswer('N', 'B')).toBe('same');
    expect(valueAnswer('R', 'B')).toBe('a');
    expect(valueAnswer('Q', 'R')).toBe('a');
    expect(valueAnswer('P', 'Q')).toBe('b');
    expect(valueAnswer('B', 'R')).toBe('b');
  });

  it('trade: plays the capture and the best recapture', () => {
    const want: Record<string, boolean> = { t1: false, t2: true, t3: true, t4: false, t5: true, t6: false };
    for (const it of quiz('w6-trade')) {
      if (it.kind !== 'trade') throw new Error('trade expected');
      const c = new Chess(it.fen);
      const m = c.move({ from: it.move[0], to: it.move[1] });
      expect(m.captured, it.id).toBeTruthy();
      expect(it.answer, it.id).toBe(want[it.id]);
      expect(tradeOutcome(it.fen, it.move)!.net >= 0).toBe(it.answer);
    }
    expect(tradeOutcome('4k3/4r3/8/4n3/8/8/8/4RK2 w - - 0 1', ['e1', 'e5'])).toMatchObject({ gain: 3, loss: 5, net: -2 });
    expect(tradeOutcome('4k3/8/3p4/4q3/8/8/8/4RK2 w - - 0 1', ['e1', 'e5'])).toMatchObject({ gain: 9, loss: 5, net: 4 });
  });

  it('can-castle: legal castling in chess.js exactly when the answer is yes, with the right reason', () => {
    for (const it of quiz('w7-castle')) {
      if (it.kind !== 'can-castle') continue;
      const legal = new Chess(it.fen).moves({ verbose: true }).some((m) => m.flags.includes(it.side));
      expect(legal, it.id).toBe(it.answer);
      expect(canCastle(it.fen, it.side)).toBe(legal);
      if (it.reason) expect(castleReasons(it.fen, it.side)).toContain(it.reason);
    }
    expect(castleReasons('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1', 'k')).toContain('king-moved');
    expect(castleReasons('4k3/8/8/8/8/8/8/R3KB1R w KQ - 0 1', 'k')).toEqual(['in-the-way']);
    expect(castleReasons('4k3/8/8/8/2b5/8/8/R3K2R w KQ - 0 1', 'k')).toEqual(['path-attacked']);
    expect(castleReasons('4k3/8/8/8/2b5/8/8/R3K2R w KQ - 0 1', 'q')).toEqual([]);
    expect(castleReasons('4k3/4r3/8/8/8/8/8/R3K2R w KQ - 0 1', 'k')).toEqual(['in-check']);
  });

  it('can-castle move items: the castle move exists and Sprouts only see them', () => {
    const items = quiz('w7-castle');
    const sprout = items.filter((x) => visibleTo(x, 'sprout'));
    expect(sprout.every((x) => x.kind === 'move')).toBe(true);
    expect(sprout.length).toBe(2);
    for (const it of sprout) {
      if (it.kind !== 'move') continue;
      expect(solutions(it.move.fen, it.move.goal).map((m) => m.san)).toEqual([it.move.goal.kind === 'flag' && it.move.goal.flag === 'k' ? 'O-O' : 'O-O-O']);
    }
  });

  it('bishop-reach: square colors', () => {
    expect(isLight('a1')).toBe(false);
    expect(isLight('h1')).toBe(true);
    const want: Record<string, boolean> = { b1: false, b2: true, b3: false, b4: true, b5: true, b6: false, b7: false, b8: true };
    for (const it of quiz('w2-bishop-color')) {
      if (it.kind !== 'bishop-reach') throw new Error('bishop-reach expected');
      const from = Object.keys(it.pieces)[0];
      // chess.js square colors agree.
      expect(new Chess().squareColor(from as 'c1') === new Chess().squareColor(it.star as 'c1')).toBe(it.answer);
      expect(it.answer, it.id).toBe(want[it.id]);
    }
  });

  it('munch: the answer is the set of legal capturers', () => {
    const it = quiz('w6-candy').find((x) => x.kind === 'munch')!;
    if (it.kind !== 'munch') throw new Error('munch expected');
    const caps = new Chess(it.fen).moves({ verbose: true }).filter((m) => m.to === it.target && m.captured);
    expect(caps.map((m) => m.san).sort()).toEqual(['Bxe5', 'Nxe5', 'Rxe5+']);
    expect(munchers(it.fen, it.target)).toEqual(['d3', 'e1', 'g3']);
    expect([...it.answer].sort()).toEqual(['d3', 'e1', 'g3']);
    // A pinned piece is not a muncher.
    expect(munchers('4k3/4r3/8/3p4/8/8/4B3/4K3 w - - 0 1', 'd5')).toEqual([]);
  });

  it('validate rejects wrong answers', () => {
    expect(validateQuiz({ kind: 'status2', fen: '4k3/8/8/8/8/8/8/3R2K1 b - - 0 1', answer: 'check', attacker: 'd1' }, 'explorer').length).toBeGreaterThan(0);
    expect(validateQuiz({ kind: 'status4', fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', answer: 'checkmate' }, 'explorer').length).toBeGreaterThan(0);
    expect(validateQuiz({ kind: 'count', pieces: { a1: 'N' }, answer: 3 }, 'explorer').length).toBeGreaterThan(0);
    expect(validateQuiz({ kind: 'trade', fen: '4k3/4r3/8/4n3/8/8/8/4RK2 w - - 0 1', move: ['e1', 'e5'], answer: true }, 'explorer').length).toBeGreaterThan(0);
    expect(validateQuiz({ kind: 'can-castle', fen: '4k3/8/8/8/2b5/8/8/R3K2R w KQ - 0 1', side: 'k', answer: false, reason: 'in-the-way' }, 'explorer').length).toBeGreaterThan(0);
    expect(validateQuiz({ kind: 'bishop-reach', pieces: { c1: 'B' }, star: 'c2', answer: true }, 'explorer').length).toBeGreaterThan(0);
    expect(validateQuiz({ kind: 'munch', fen: '4k3/8/8/4p3/8/3N2B1/8/4RK2 w - - 0 1', target: 'e5', answer: ['d3'] }, 'explorer').length).toBeGreaterThan(0);
    expect(validateQuiz({ kind: 'status2', fen: '4k3/8/8/8/8/8/8/Q5K1 b - - 0 1', answer: 'nothing', say: 'Look at a1!' }, 'sprout')).toContain('sprout text contains a square name');
  });
});

describe('Pack C find-move content', () => {
  it('protect items have a solution and the d1 item has only Ne3', () => {
    const items = set<FindMoveItem>('w6-protect');
    expect(items.length).toBeGreaterThanOrEqual(6);
    const p3 = items.find((x) => x.id === 'p3')!;
    expect(solutions(p3.fen, p3.goal).map((m) => m.san)).toEqual(['Ne3']);
    for (const it of items) expect(validateFindMove(it, 'explorer'), it.id).toEqual([]);
  });

  it('escape items list the legal ways', () => {
    const e1 = set<FindMoveItem>('w7-escape').find((x) => x.id === 'e1')!;
    expect(solutions(e1.fen, { kind: 'escape', ways: 'any' }).map((m) => m.san).sort()).toEqual(['Kd1', 'Kf1', 'Kf2', 'Ne4', 'Rxe8+'].sort());
    // Sprouts: any one escape.
    for (const it of set<FindMoveItem>('w7-escape')) expect(resolveItem(it, 'sprout', {}).goal).toEqual({ kind: 'escape', ways: 'any' });
  });

  it('en passant: each replay produces the item FEN and dxe6 / exd6 is legal', () => {
    const items = set<FindMoveItem>('w7-en-passant').filter((x) => x.replay);
    expect(items.length).toBe(2);
    for (const it of items) {
      const c = new Chess(it.replay!.fen);
      c.move({ from: it.replay!.uci.slice(0, 2), to: it.replay!.uci.slice(2, 4) });
      expect(c.fen().split(' ').slice(0, 4).join(' ')).toBe(it.fen.split(' ').slice(0, 4).join(' '));
      expect(solutions(it.fen, it.goal).map((m) => m.san)).toEqual([it.id === 'ep1' ? 'dxe6' : 'exd6']);
    }
  });

  it('the stalemate move item: Qh8 mates, Qc7 and friends are stalemate traps', () => {
    const it = quiz('w7-stalemate').find((x) => x.id === 'st4')!;
    if (it.kind !== 'move') throw new Error('move expected');
    expect(solutions(it.move.fen, it.move.goal).map((m) => m.san)).toEqual(['Qh8#']);
    // The teaching trap: a queen move that takes every square but gives no check.
    const traps = new Chess(it.move.fen).moves().filter((san) => {
      const c = new Chess(it.move.fen);
      c.move(san);
      return c.isStalemate();
    });
    expect(traps).toContain('Qc7');
    expect(traps.length).toBeGreaterThan(3);
  });
});

describe('mate drill', () => {
  const drills = ['w8-ladder', 'w8-box', 'w8-rook-mate'].flatMap((id) => set<MateDrillItem>(id));

  it('drill FENs are legal, not check, not stalemate, and have the right material', () => {
    expect(drills.length).toBe(9);
    for (const it of drills) {
      const c = new Chess(it.fen);
      expect(c.inCheck(), it.id).toBe(false);
      expect(c.isGameOver(), it.id).toBe(false);
      expect(c.turn()).toBe('w');
      for (const band of BANDS) if (visibleTo(it, band)) expect(validateMateDrill(it, band), `${it.id} ${band}`).toEqual([]);
    }
    expect(validateMateDrill({ fen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1', method: 'ladder', maxMoves: 12 }, 'explorer').length).toBeGreaterThan(0);
    expect(validateMateDrill({ fen: '4k3/8/8/8/8/8/8/R3K2R w - - 0 1', method: 'ladder', maxMoves: 12 }, 'explorer')).toEqual([]);
    expect(validateMateDrill({ fen: '4k3/8/8/8/8/8/8/4R1K1 w - - 0 1', method: 'rook', maxMoves: 30 }, 'explorer').length).toBeGreaterThan(0);
  });

  it('the spec items are present', () => {
    expect(set<MateDrillItem>('w8-ladder')[0]).toMatchObject({ fen: '8/8/3k4/8/8/8/8/R3K2R w - - 0 1', maxMoves: 12 });
    expect(set<MateDrillItem>('w8-box')[0]).toMatchObject({ fen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1', maxMoves: 15 });
    expect(set<MateDrillItem>('w8-rook-mate')[0]).toMatchObject({ fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', maxMoves: 30 });
  });

  it('the defender never allows a mate-in-1 when it has an alternative', () => {
    const fens = [
      '1k6/8/8/8/8/8/R7/1R4K1 b - - 0 1', // Kc8 or Ka8? ... b-file checks: only safe squares count
      '8/8/8/8/8/2k5/R7/1R4K1 b - - 0 1',
      '3k4/8/3K4/8/8/8/8/7Q b - - 0 1',
      '8/8/8/8/8/8/1k6/R3K3 b - - 0 1',
      '6k1/8/6K1/8/8/8/8/R7 b - - 0 1',
      '2k5/8/2K5/8/8/8/8/7R b - - 0 1',
    ];
    for (const fen of fens) {
      const all = scoreDefenses(fen);
      const m = defend(fen)!;
      expect(m, fen).toBeTruthy();
      const c = new Chess(fen);
      c.move(m);
      if (all.some((d) => !d.allowsMate && !d.captures)) expect(hasMateIn1(c.fen()), `${fen}: ${m.san}`).toBe(false);
    }
  });

  it('the defender captures an undefended piece', () => {
    const m = defend('8/8/8/8/8/8/1kR5/4K3 b - - 0 1')!;
    expect(m.san).toBe('Kxc2');
  });

  it('the defender prefers higher mobility, then the center', () => {
    const fen = '8/8/8/8/8/8/2k5/R3K3 b - - 0 1';
    const all = scoreDefenses(fen).filter((d) => !d.allowsMate && !d.captures);
    expect(all.length).toBeGreaterThan(1);
    const best = Math.max(...all.map((d) => d.mobility));
    const m = defend(fen)!;
    const chosen = all.find((d) => d.move.san === m.san)!;
    expect(chosen.mobility).toBe(best);
    const tied = all.filter((d) => d.mobility === best);
    expect(chosen.center).toBe(Math.min(...tied.map((d) => d.center)));
    // King in the middle has more room than on the edge.
    expect(mobilityNext('8/8/8/4k3/8/8/8/4K3 w - - 0 1', 'b')).toBeGreaterThan(mobilityNext('7k/8/8/8/8/8/8/4K3 w - - 0 1', 'b'));
  });

  it('judges kid moves: stalemate, blunder, mate', () => {
    expect(judgeKidMove('k7/8/1K6/8/8/8/8/7Q w - - 0 1', { from: 'h1', to: 'c6' })?.verdict).toBe('ok');
    expect(judgeKidMove('k7/8/1K6/8/8/8/8/7Q w - - 0 1', { from: 'h1', to: 'h8' })?.verdict).toBe('mate');
    expect(judgeKidMove('k7/8/1K6/8/8/8/8/7Q w - - 0 1', { from: 'h1', to: 'c1' })?.verdict).toBe('ok');
    expect(judgeKidMove('k7/8/1K6/8/8/8/8/7Q w - - 0 1', { from: 'h1', to: 'c6' })?.verdict).toBe('ok');
    const stale = new Chess('k7/8/1K6/8/8/8/8/7Q w - - 0 1').moves({ verbose: true }).find((m) => m.san === 'Qh2')!;
    expect(judgeKidMove('k7/8/1K6/8/8/8/8/7Q w - - 0 1', stale)?.verdict).toBe('stalemate');
    expect(judgeKidMove('8/8/8/4k3/8/8/8/3RK3 w - - 0 1', { from: 'd1', to: 'd4' })).toMatchObject({ verdict: 'blunder', lost: 'd4' });
  });

  it('scores: within max = 3, within 1.5x = 2, else 1', () => {
    expect(drillScore(12, 12)).toBe(3);
    expect(drillScore(18, 12)).toBe(2);
    expect(drillScore(19, 12)).toBe(1);
  });

  it('helpers: the queen box shrinks and the ladder rungs follow the rooks', () => {
    expect(queenBox('8/8/8/4k3/8/8/8/4K2Q w - - 0 1').length).toBe(7 * 7);
    expect(queenBox('8/8/8/4k3/8/8/6Q1/4K3 b - - 0 1').length).toBe(6 * 6);
    expect(ladderRungs('8/8/3k4/8/8/8/8/R3K2R w - - 0 1').length).toBe(5);
  });

  it('the JS defender plus Pip (greedy) finish every drill with a mate, never a stalemate', () => {
    for (const it of drills) {
      let fen = it.fen;
      let mated = false;
      const seen = new Set<string>();
      for (let i = 0; i < 80; i++) {
        const w = greedyWhiteMove(fen, seen);
        expect(w, `${it.id} white has a move`).toBeTruthy();
        const c = new Chess(fen);
        c.move(w!);
        seen.add(c.fen().split(' ').slice(0, 2).join(' '));
        expect(c.isStalemate(), it.id).toBe(false);
        expect(c.moves({ verbose: true }).some((m) => m.captured), `${it.id} hangs a piece`).toBe(false);
        if (c.isCheckmate()) {
          mated = true;
          break;
        }
        const b = defend(c.fen())!;
        c.move(b);
        expect(c.moves({ verbose: true }).length).toBeGreaterThan(0);
        fen = c.fen();
      }
      expect(mated, `${it.id} mated within 80 moves`).toBe(true);
    }
  }, 600_000); // generous: fixed work, only slower on a busy machine
});
