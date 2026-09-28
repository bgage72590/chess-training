// Pack E: Puzzles and Tactics (spec 13.13). Every hand puzzle here is checked with chess.js in
// tests/kids-tactics.test.ts: legal, solvable, and really the tactic it claims.
import type { AgeBand, ItemMeta, KidsPack, LevelSet, PlaygroundEntry, Tier } from '../activities/types';
import type { FindMoveItem } from '../activities/findMove/logic';
import type { PuzzleItem } from '../activities/puzzles/logic';
import { puzzlesActivity } from '../activities/puzzles';

type PI = PuzzleItem & ItemMeta;
type FM = FindMoveItem & ItemMeta;
const S: AgeBand[] = ['sprout'];
const E: AgeBand[] = ['explorer'];
const C: AgeBand[] = ['champion'];

/** `count` database items (one puzzle each, so the hint ladder and score are per puzzle). */
const dbItems = (prefix: string, themes: string[], maxRating: number, count: number, bands: AgeBand[]): PI[] =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i + 1}`, bands, source: 'db' as const, themes, maxRating, count: 1 }));

// ---------- w8-mate-hunt ----------

const mateHand = (id: string, fen: string): PI => ({
  id,
  bands: S,
  source: 'hand',
  tactic: 'mate',
  say: 'Find checkmate!',
  items: [{ fen, goal: { kind: 'mate' } }],
});

export const W8_MATE_HUNT: LevelSet<PuzzleItem> = {
  id: 'w8-mate-hunt',
  activity: 'puzzles',
  perRun: { sprout: 3, explorer: 5, champion: 6 },
  intro: [
    { say: { all: 'Mate Hunt! Look at every check. One of them is checkmate!', champion: 'Mate in one: check every check.' }, fen: 'k7/2Q5/2K5/8/8/8/8/8 w - - 0 1' },
    { say: 'Watch me!', fen: 'k7/2Q5/2K5/8/8/8/8/8 w - - 0 1', move: ['c7', 'b7'], ms: 1400 },
    { say: 'Your turn!', ms: 600 },
  ],
  items: [
    mateHand('s1', 'k7/2Q5/2K5/8/8/8/8/8 w - - 0 1'),
    mateHand('s2', 'k7/8/1K6/8/8/8/8/6Q1 w - - 0 1'),
    mateHand('s3', '7k/8/6K1/8/8/8/8/1Q6 w - - 0 1'),
    ...dbItems('e', ['mateIn1'], 800, 5, E),
    ...dbItems('c', ['mateIn1'], 1000, 6, C),
  ],
};

// ---------- w8-forks: 20 hand-authored forks ----------

const forkSay = { all: 'Find the fork! Attack two things at once.', champion: 'Find the fork.' };

const fork = (id: string, fen: string, uci: [string, string, string], tier: Tier, say: FM['say'] = forkSay): PI => ({
  id,
  tier,
  source: 'hand',
  tactic: 'fork',
  say,
  items: [{ fen, goal: { kind: 'line', uci } }],
});

export const FORKS: PI[] = [
  // Knight forks (the "family fork").
  fork('f1', 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', ['b5c7', 'e8d7', 'c7a8'], 1, { all: 'Hop to attack the king AND the rook!', champion: 'Knight fork: king and rook.' }),
  fork('f2', 'q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', ['b5c7', 'e8d7', 'c7a8'], 1, { all: 'Hop to attack the king AND the queen!', champion: 'Knight fork: king and queen.' }),
  fork('f3', '4k3/8/8/1q6/4N3/8/8/4K3 w - - 0 1', ['e4d6', 'e8e7', 'd6b5'], 1),
  fork('f4', '4k3/8/8/1r6/4N3/8/8/4K3 w - - 0 1', ['e4d6', 'e8e7', 'd6b5'], 1),
  fork('f5', '3q3k/8/8/4N3/8/8/8/4K3 w - - 0 1', ['e5f7', 'h8h7', 'f7d8'], 1),
  fork('f6', '4q1k1/8/8/8/6N1/8/8/6K1 w - - 0 1', ['g4f6', 'g8f7', 'f6e8'], 2),
  fork('f7', '3r4/6k1/8/8/5N2/8/8/4K3 w - - 0 1', ['f4e6', 'g7g8', 'e6d8'], 2),
  fork('f8', '7k/4q3/8/8/5N2/8/8/6K1 w - - 0 1', ['f4g6', 'h8h7', 'g6e7'], 2),
  // Queen forks.
  fork('f9', 'r5k1/8/8/8/8/8/8/4K2Q w - - 0 1', ['h1d5', 'g8h8', 'd5a8'], 2),
  fork('f10', 'r3k3/8/8/8/8/8/8/2Q1K3 w - - 0 1', ['c1c6', 'e8e7', 'c6a8'], 2),
  fork('f11', '3k4/8/8/8/6b1/8/8/4K2Q w - - 0 1', ['h1h4', 'd8c8', 'h4g4'], 2),
  fork('f12', '7r/k7/8/8/8/8/8/3QK3 w - - 0 1', ['d1d4', 'a7a8', 'd4h8'], 3),
  fork('f13', '1k6/8/8/8/8/8/7r/2Q1K3 w - - 0 1', ['c1f4', 'b8c8', 'f4h2'], 3),
  fork('f14', '8/8/8/k6n/8/8/8/4K2Q w - - 0 1', ['h1d5', 'a5a6', 'd5h5'], 2),
  // Rook forks.
  fork('f15', '8/8/8/n6k/8/8/8/1R2K3 w - - 0 1', ['b1b5', 'h5g6', 'b5a5'], 2),
  fork('f16', '8/8/8/8/k6n/8/8/3RK3 w - - 0 1', ['d1d4', 'a4a5', 'd4h4'], 2),
  fork('f17', '8/8/8/8/k5b1/8/8/3RK3 w - - 0 1', ['d1d4', 'a4a5', 'd4g4'], 3),
  // Bishop forks.
  fork('f18', 'r5k1/8/8/8/8/5B2/8/4K3 w - - 0 1', ['f3d5', 'g8h8', 'd5a8'], 2),
  fork('f19', '6k1/8/8/8/8/8/r7/4KB2 w - - 0 1', ['f1c4', 'g8h8', 'c4a2'], 3),
  // A pawn fork (checked: the pawn is guarded, so the king cannot take it).
  fork('f20', '8/2r1k3/8/3P4/8/8/8/3RK3 w - - 0 1', ['d5d6', 'e7d8', 'd6c7'], 3, { all: 'Even a pawn can fork! Attack the king and the rook.', champion: 'Pawn fork.' }),
];

export const W8_FORKS: LevelSet<PuzzleItem> = {
  id: 'w8-forks',
  activity: 'puzzles',
  intro: [
    { say: { all: 'A fork attacks two pieces at once. The knight is the best at forks!', champion: 'A fork attacks two targets at once.' }, fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1' },
    {
      say: 'Watch me! Check, and the rook is attacked too.',
      fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1',
      move: ['b5', 'c7'],
      arrows: [
        { from: 'c7', to: 'e8', color: 'red' },
        { from: 'c7', to: 'a8', color: 'red' },
      ],
      ms: 1600,
    },
    { say: 'Your turn!', ms: 600 },
  ],
  items: FORKS,
};

// ---------- w8-pins ----------

export const W8_PINS: LevelSet<PuzzleItem> = {
  id: 'w8-pins',
  activity: 'puzzles',
  perRun: { champion: 6 },
  items: dbItems('p', ['pin'], 1100, 6, C),
};

// ---------- w8-threats (framework find-move, goal no-hang) ----------

const threat = (id: string, fen: string, say: string, tier: Tier = 1): FM => ({ id, fen, goal: { kind: 'no-hang' }, say, tier });

export const W8_THREATS: LevelSet<FindMoveItem> = {
  id: 'w8-threats',
  activity: 'find-move',
  items: [
    threat('t1', '4k3/8/8/8/3n4/8/2R5/4K3 w - - 0 1', 'What does the knight want? Keep your rook safe!'),
    threat('t2', '4k3/8/8/8/8/4b3/8/2N1K2R w - - 0 1', 'What does the bishop want? Keep your knight safe!', 2),
    threat('t3', '4k3/8/8/6b1/8/8/3N4/4K3 w - - 0 1', 'What does the bishop want? Keep your knight safe!'),
    threat('t4', '4k3/8/8/8/8/2n5/R7/4K3 w - - 0 1', 'What does the knight want? Keep your rook safe!'),
    threat('t5', '4k3/8/8/3p4/4B3/8/8/4K3 w - - 0 1', 'What does the pawn want? Keep your bishop safe!'),
    threat('t6', '4k3/8/8/8/2n5/8/3Q4/4K3 w - - 0 1', 'What does the knight want? Keep your queen safe!', 2),
    threat('t7', '4k3/8/8/8/1r3N2/8/8/4K3 w - - 0 1', 'What does the rook want? Keep your knight safe!'),
    threat('t8', '4k3/8/8/2b5/8/8/5R2/K7 w - - 0 1', 'What does the bishop want? Keep your rook safe! Careful with checks.', 3),
  ],
};

// ---------- Playground ----------

const PLAYGROUND: PlaygroundEntry[] = [
  { id: 'puzzle-day', title: 'Puzzle of the Day', icon: 'puzzle', activity: 'puzzles', item: { source: 'daily' } satisfies PuzzleItem },
  { id: 'puzzle-trio', title: 'Puzzle Trio', icon: 'puzzle', activity: 'puzzles', bands: ['explorer', 'champion'], item: { source: 'db', themes: [], maxRating: 3000, count: 3 } satisfies PuzzleItem },
  { id: 'puzzle-streak', title: 'Puzzle Streak', icon: 'flame', activity: 'puzzles', bands: C, item: { source: 'streak' } satisfies PuzzleItem },
];

export const tacticsPack: KidsPack = {
  id: 'tactics',
  activities: [puzzlesActivity],
  levelSets: [W8_MATE_HUNT, W8_FORKS, W8_PINS, W8_THREATS],
  playground: PLAYGROUND,
};
