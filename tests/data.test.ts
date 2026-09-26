import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { puzzles, THEMES } from '../src/data/puzzles';
import { units, openings, endgameDrills } from '../src/content';
import { parseUci } from '../src/chess/utils';

describe('puzzle set', () => {
  it('has unique ids', () => {
    expect(new Set(puzzles.map((p) => p.id)).size).toBe(puzzles.length);
  });
  it('every puzzle is a legal line: opponent move, then solver moves ending on the solver', () => {
    for (const p of puzzles) {
      const c = new Chess(p.fen);
      const moves = p.moves.split(' ');
      expect(moves.length % 2, p.id).toBe(0);
      for (const u of moves) c.move(parseUci(u));
      if (p.themes.includes('mate')) expect(c.isCheckmate(), p.id).toBe(true);
      for (const u of p.cont?.split(' ') ?? []) c.move(parseUci(u));
    }
  });
  it('uses known themes and sane ratings', () => {
    for (const p of puzzles) {
      expect(p.rating).toBeGreaterThanOrEqual(400);
      expect(p.rating).toBeLessThanOrEqual(2800);
      for (const t of p.themes) expect(THEMES[t], `${p.id} theme ${t}`).toBeDefined();
    }
  });
});

describe('curriculum content', () => {
  it('has globally unique ids', () => {
    const ids = [
      ...units.flatMap((u) => [u.id, ...u.lessons.map((l) => l.id)]),
      ...openings.flatMap((o) => [o.id, ...o.lines.map((l) => l.id)]),
      ...endgameDrills.map((d) => d.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('every lesson position and move is legal', () => {
    for (const u of units)
      for (const l of u.lessons)
        for (const [i, s] of l.steps.entries()) {
          const where = `${l.id} step ${i + 1}`;
          if ('fen' in s && s.fen) new Chess(s.fen);
          if (s.kind === 'move') {
            const c = new Chess(s.fen);
            expect(s.solution.length % 2, where).toBe(1);
            for (const san of s.solution) expect(() => c.move(san), `${where} ${san}`).not.toThrow();
          }
          if (s.kind === 'demo') {
            const c = new Chess(s.fen);
            for (const san of s.moves) expect(() => c.move(san), `${where} ${san}`).not.toThrow();
          }
          if (s.kind === 'quiz') expect(s.choices.filter((c) => c.correct).length, where).toBe(1);
        }
  });
  it('every opening line is legal from the start position', () => {
    for (const o of openings)
      for (const line of o.lines) {
        const c = new Chess();
        for (const san of line.moves.split(' ')) expect(() => c.move(san), `${line.id} ${san}`).not.toThrow();
      }
  });
  it('every endgame drill starts from a legal, unfinished position', () => {
    for (const d of endgameDrills) {
      const c = new Chess(d.fen);
      expect(c.isGameOver(), d.id).toBe(false);
    }
  });
});
