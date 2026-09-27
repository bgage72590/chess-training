// Pack A, Movement and Vision: Board Explorer, Paint the Moves, Gobble! and Magic Memory with their
// level sets and Playground tiles (spec 13.3-13.6). Every answer here is checked by validate() in
// tests/kids.test.ts and by the spec's verified counts in tests/kids-movement.test.ts.
import type { AgeBand, ItemMeta, KidsPack, LevelSet, PlaygroundEntry } from '../activities/types';
import type { BoardVisionItem } from '../activities/boardVision/logic';
import type { PaintItem } from '../activities/paint/logic';
import type { GobbleItem } from '../activities/gobble/logic';
import { START_FEN } from '../activities/boardVision/logic';
import { boardVisionActivity } from '../activities/boardVision';
import { paintActivity } from '../activities/paint';
import { gobbleActivity } from '../activities/gobble';
import { memoryActivity } from '../activities/memory';

type BV = BoardVisionItem & ItemMeta;
type Gob = GobbleItem & ItemMeta;
const S: AgeBand[] = ['sprout'];
const EC: AgeBand[] = ['explorer', 'champion'];

// ---------- Board Explorer ----------

const roadSay = { all: 'Light up the road! Tap every square on it.', sprout: 'Light up the road!' };

export const W1_ROADS: LevelSet<BoardVisionItem> = {
  id: 'w1-roads',
  activity: 'board-vision',
  order: 'fixed',
  perRun: { sprout: 3, explorer: 3, champion: 3 },
  intro: [
    { say: { all: 'Roads that go up and down are called files.', sprout: 'Some roads go up and down.' }, arrows: [{ from: 'a1', to: 'a8', color: 'yellow' }] },
    { say: { all: 'Roads that go side to side are called ranks.', sprout: 'Some roads go side to side.' }, arrows: [{ from: 'a4', to: 'h4', color: 'yellow' }] },
  ],
  items: [
    { id: 'rd1', kind: 'tap-line', through: 'a1', line: 'file', say: { all: 'Light up the up-and-down road! It is a file.', sprout: 'Light up the up-and-down road!' } } as BV,
    { id: 'rd2', kind: 'tap-line', through: 'd4', line: 'rank', say: { all: 'Now the side-to-side road! It is a rank.', sprout: 'Now the side-to-side road!' } } as BV,
    { id: 'rd3', kind: 'tap-line', through: 'h8', line: 'file', say: roadSay } as BV,
    { id: 'rd4', kind: 'tap-line', through: 'c1', line: 'diagonal', bands: EC, say: 'A slanty road! It is a diagonal.' } as BV,
  ],
};

export const W1_COLORS: LevelSet<BoardVisionItem> = {
  id: 'w1-colors',
  activity: 'board-vision',
  order: 'fixed',
  perRun: { sprout: 3, explorer: 3, champion: 3 },
  items: [
    { id: 'co1', kind: 'tap-color', color: 'light', count: 1, say: 'Tap a light square!' } as BV,
    { id: 'co2', kind: 'tap-color', color: 'dark', count: 3, say: 'Tap three dark squares!' } as BV,
    { id: 'co3', kind: 'tap-color', color: 'light', count: 2, say: 'Tap two light squares!' } as BV,
  ],
};

export const W2_TREASURE_MAP: LevelSet<BoardVisionItem> = {
  id: 'w2-treasure-map',
  activity: 'board-vision',
  order: 'fixed',
  perRun: { explorer: 2, champion: 2 },
  intro: [
    { say: 'Every square has a name: its letter, then its number. This one is e4!', tones: { e4: 'focus' }, arrows: [{ from: 'e1', to: 'e4', color: 'yellow' }] },
  ],
  items: [
    { id: 'tm1', bands: EC, kind: 'find-square', squares: ['a1', 'h8', 'e4', 'd5', 'c3'], rounds: 5, fadeCoords: true, say: 'Find the treasure squares!' } as BV,
    { id: 'tm2', bands: EC, kind: 'find-square', squares: 'random', rounds: 8, say: 'Eight treasures! Find each square.' } as BV,
    { id: 'tm3', bands: EC, kind: 'find-square', squares: 'random', rounds: 6, fadeCoords: true, tier: 2, say: 'The map labels will fade away!' } as BV,
  ],
};

const armySay = (name: string) => ({ all: `Where is the ${name}? Tap it!` });

export const W5_ARMY: LevelSet<BoardVisionItem> = {
  id: 'w5-army',
  activity: 'board-vision',
  order: 'fixed',
  perRun: { sprout: 3, explorer: 5, champion: 6 },
  items: [
    { id: 'ar1', kind: 'name-piece', fen: START_FEN, ask: 'k', say: armySay('king') } as BV,
    { id: 'ar2', kind: 'name-piece', fen: START_FEN, ask: 'q', say: armySay('queen') } as BV,
    { id: 'ar3', kind: 'name-piece', fen: START_FEN, ask: 'r', say: armySay('rook') } as BV,
    { id: 'ar4', kind: 'name-piece', fen: START_FEN, ask: 'b', say: armySay('bishop') } as BV,
    { id: 'ar5', kind: 'name-piece', fen: START_FEN, ask: 'n', say: armySay('knight') } as BV,
    { id: 'ar6', kind: 'name-piece', fen: START_FEN, ask: 'p', say: armySay('pawn') } as BV,
  ],
};

export const W5_SETUP: LevelSet<BoardVisionItem> = {
  id: 'w5-setup',
  activity: 'board-vision',
  order: 'fixed',
  perRun: { sprout: 2, explorer: 2, champion: 2 },
  items: [
    { id: 'su1', bands: S, kind: 'setup', pieces: 'R R', colorHints: true, say: 'Put the rooks in the corners!' } as BV,
    { id: 'su2', bands: S, kind: 'setup', pieces: 'RNBQKBNR', colorHints: true, say: 'Set up the whole back row!' } as BV,
    { id: 'su3', bands: EC, kind: 'setup', pieces: 'RNBQKBNR', say: 'Set up the back row! Tap a piece, then its square.' } as BV,
    { id: 'su4', bands: EC, kind: 'setup', pieces: 'RNBQKBNR/PPPPPPPP', say: 'Now the whole army, pawns too!' } as BV,
  ],
};

// ---------- Paint the Moves ----------

const paintSay = (name: string) => ({ all: `Tap every square the ${name} can go!`, sprout: `Where can the ${name} go?` });

export const W1_ROOK_PAINT: LevelSet<PaintItem> = {
  id: 'w1-rook-paint',
  activity: 'paint',
  items: [
    { id: 'rp1', pieces: { d4: 'R' }, say: paintSay('rook') },
    { id: 'rp2', pieces: { h1: 'R' }, blockers: ['h4'], enemies: { c1: 'b' }, say: { all: 'Friends block the road. Enemies can be eaten!', sprout: 'Where can the rook go?' } },
    { id: 'rp3', pieces: { a1: 'R' }, enemies: { a5: 'p', e1: 'n' }, say: { all: 'The rook can eat enemies, but stops there.', sprout: 'Where can the rook go?' } },
    { id: 'rp4', pieces: { e4: 'R' }, blockers: ['e6', 'c4'], tier: 2, say: paintSay('rook') },
  ],
};

export const W2_BISHOP_PAINT: LevelSet<PaintItem> = {
  id: 'w2-bishop-paint',
  activity: 'paint',
  items: [
    { id: 'bp1', pieces: { c1: 'B' }, blockers: ['b2'], say: paintSay('bishop') },
    { id: 'bp2', pieces: { f1: 'B' }, say: paintSay('bishop') },
    { id: 'bp3', pieces: { d4: 'B' }, blockers: ['f6'], enemies: { b2: 'p' }, say: { all: 'Slanty roads! Watch out for friends in the way.', sprout: 'Where can the bishop go?' } },
    { id: 'bp4', pieces: { e4: 'B' }, tier: 2, say: paintSay('bishop') },
  ],
};

export const W3_QUEEN_PAINT: LevelSet<PaintItem> = {
  id: 'w3-queen-paint',
  activity: 'paint',
  items: [
    { id: 'qp1', pieces: { d1: 'Q' }, blockers: ['d2', 'e2', 'c2'], say: 'Her friends are in the way! Where can the queen go?' },
    { id: 'qp2', pieces: { a1: 'Q' }, enemies: { a4: 'p', d4: 'n' }, say: paintSay('queen') },
    { id: 'qp3', pieces: { h8: 'Q' }, blockers: ['g7'], enemies: { h5: 'r' }, say: paintSay('queen') },
    { id: 'qp4', pieces: { e1: 'K' }, say: 'Where can the king step?' },
    { id: 'qp5', pieces: { d4: 'Q' }, tier: 2, say: 'The queen in the middle. So many squares!' },
  ],
};

export const W4_KNIGHT_PAINT: LevelSet<PaintItem> = {
  id: 'w4-knight-paint',
  activity: 'paint',
  items: [
    { id: 'np1', pieces: { b1: 'N' }, say: paintSay('knight') },
    { id: 'np2', pieces: { g1: 'N' }, say: paintSay('knight') },
    { id: 'np3', pieces: { a1: 'N' }, say: { all: 'A knight in the corner. How many hops?', sprout: 'Where can the knight go?' } },
    { id: 'np4', pieces: { d4: 'N' }, say: { all: 'A knight in the middle has lots of hops!', sprout: 'Where can the knight go?' } },
    { id: 'np5', pieces: { e4: 'N' }, blockers: ['f6', 'd2'], tier: 2, say: 'Friends are on two squares. Hop around them!' },
  ],
};

// ---------- Gobble! ----------

const gobSay = (name: string) => ({ all: `Every move must eat a snack! Eat them all with the ${name}.`, sprout: 'Eat all the snacks!' });

export const W1_ROOK_GOBBLE: LevelSet<GobbleItem> = {
  id: 'w1-rook-gobble',
  activity: 'gobble',
  items: [
    { id: 'rg1', bands: S, pieces: { a1: 'R' }, targets: { a3: 'p', c3: 'p' }, area: 'a1:d4', say: gobSay('rook') },
    { id: 'rg2', pieces: { a1: 'R' }, targets: { a5: 'p', e5: 'n', e8: 'b' }, say: gobSay('rook') },
    { id: 'rg3', pieces: { h1: 'R' }, targets: { h6: 'p', c6: 'n', c2: 'b' }, say: gobSay('rook') },
    { id: 'rg4', pieces: { a1: 'R' }, targets: { a4: 'p', d4: 'p', d7: 'p', g7: 'p', g1: 'p' }, tier: 2, say: 'Five snacks! Find the right order.' },
  ] as Gob[],
};

export const W2_BISHOP_GOBBLE: LevelSet<GobbleItem> = {
  id: 'w2-bishop-gobble',
  activity: 'gobble',
  items: [
    { id: 'bg1', bands: S, pieces: { c1: 'B' }, targets: { b2: 'p', a3: 'p' }, area: 'a1:d4', say: gobSay('bishop') },
    { id: 'bg2', pieces: { c1: 'B' }, targets: { e3: 'p', g5: 'p', d8: 'p' }, say: gobSay('bishop') },
    { id: 'bg3', pieces: { f1: 'B' }, targets: { d3: 'p', b5: 'n', e8: 'r' }, say: gobSay('bishop') },
    { id: 'bg4', pieces: { c1: 'B' }, targets: { e3: 'p', g5: 'p', d8: 'p', a5: 'p' }, tier: 2, say: 'Four snacks! Plan the trip.' },
  ] as Gob[],
};

export const W3_QUEEN_GOBBLE: LevelSet<GobbleItem> = {
  id: 'w3-queen-gobble',
  activity: 'gobble',
  items: [
    { id: 'qg1', bands: S, pieces: { a1: 'Q' }, targets: { a3: 'p', c3: 'p' }, area: 'a1:d4', say: gobSay('queen') },
    { id: 'qg2', pieces: { d1: 'Q' }, targets: { d4: 'p', g7: 'n', g2: 'b', b2: 'r' }, say: gobSay('queen') },
    { id: 'qg3', pieces: { d1: 'Q' }, targets: { d4: 'p', a7: 'p', g4: 'p', g7: 'p', b4: 'p' }, tier: 2, say: 'Careful: some ways get stuck!' },
  ] as Gob[],
};

export const W4_KNIGHT_GOBBLE: LevelSet<GobbleItem> = {
  id: 'w4-knight-gobble',
  activity: 'gobble',
  items: [
    { id: 'ng1', bands: S, pieces: { a1: 'N' }, targets: { b3: 'p', c1: 'p' }, area: 'a1:d4', say: gobSay('knight') },
    { id: 'ng2', pieces: { a1: 'N' }, targets: { b3: 'p', d4: 'p', c6: 'p' }, say: gobSay('knight') },
    { id: 'ng3', pieces: { b1: 'N' }, targets: { c3: 'p', d5: 'p', f6: 'p', e4: 'p' }, say: gobSay('knight') },
    { id: 'ng4', pieces: { b1: 'N' }, targets: { c3: 'p', e4: 'p', g5: 'p', e6: 'p' }, tier: 2, say: 'Hop, hop, hop, hop!' },
  ] as Gob[],
};

const slantSay = { all: 'Straight to walk, slanty to eat! Eat every snack.', sprout: 'Pawns eat slanty!' };

export const W5_PAWN_SLANT: LevelSet<GobbleItem> = {
  id: 'w5-pawn-slant',
  activity: 'gobble',
  intro: [{ say: { all: 'Pawns walk straight, but they eat slanty!', champion: 'Pawns capture diagonally forward.' }, pieces: { e2: 'P', d3: 'p', e3: 'p' }, arrows: [{ from: 'e2', to: 'd3', color: 'green' }] }],
  items: [
    { id: 'ps1', pieces: { e2: 'P' }, targets: { d3: 'p', e4: 'p', d5: 'p' }, say: slantSay },
    { id: 'ps2', pieces: { f2: 'P' }, targets: { g3: 'n', f4: 'p', e5: 'b', d6: 'r' }, say: slantSay },
    { id: 'ps3', pieces: { c2: 'P' }, targets: { d3: 'p', e4: 'p', d5: 'p', c6: 'p', d7: 'p' }, say: slantSay },
    { id: 'ps4', pieces: { b2: 'P' }, targets: { c3: 'p', b4: 'p', c5: 'p', d6: 'p', c7: 'p', b8: 'n' }, tier: 2, say: { all: 'Eat all the way to the end. Surprise!', sprout: 'Eat all the way to the end!' } },
  ] as Gob[],
};

const biteSay = 'Eat them all, but guarded snacks bite back!';

export const W6_BITE: LevelSet<GobbleItem> = {
  id: 'w6-bite',
  activity: 'gobble',
  intro: [{ say: 'A snack is guarded when another snack could eat whoever takes it. Guarded snacks bite back!', pieces: { d1: 'Q', c5: 'p', d4: 'p' }, arrows: [{ from: 'c5', to: 'd4', color: 'red' }] }],
  items: [
    { id: 'bt1', pieces: { d1: 'Q' }, targets: { c5: 'p', h5: 'p', d4: 'p' }, bite: true, say: biteSay },
    { id: 'bt2', pieces: { e3: 'Q' }, targets: { d1: 'n', d3: 'p', e2: 'p' }, bite: true, say: biteSay },
    { id: 'bt3', pieces: { f3: 'N' }, targets: { e5: 'p', h2: 'b', g4: 'p' }, bite: true, say: biteSay },
    { id: 'bt4', pieces: { b2: 'B' }, targets: { d4: 'p', e5: 'n', a1: 'b' }, bite: true, say: biteSay },
    { id: 'bt5', pieces: { b6: 'R' }, targets: { a6: 'p', b7: 'p', b2: 'p', a7: 'n' }, bite: true, tier: 2, say: biteSay },
    { id: 'bt6', pieces: { b5: 'Q' }, targets: { f5: 'b', c4: 'n', b1: 'n', c5: 'p' }, bite: true, tier: 2, say: biteSay },
  ] as Gob[],
};

// ---------- Playground ----------

const PLAYGROUND: PlaygroundEntry[] = [
  { id: 'coord-dash', title: 'Coordinate Dash', icon: 'clock', activity: 'board-vision', item: { kind: 'find-square', squares: 'random', rounds: 999, timer: 30, bestKey: 'dash-30', say: 'Find as many squares as you can in 30 seconds!' }, bands: ['champion'] },
  {
    id: 'last-piece',
    title: 'Last Piece Standing',
    icon: 'crown',
    activity: 'gobble',
    item: {
      mode: 'solo',
      pieces: { c1: 'R', c5: 'B', e3: 'N', d4: 'P', a3: 'Q' },
      pool: [
        { a1: 'R', a5: 'B', e5: 'N' },
        { d1: 'K', a2: 'R', c2: 'B' },
      ],
      say: 'Capture your own pieces until only one is left!',
    },
    bands: ['champion'],
  },
  { id: 'magic-memory', title: 'Magic Memory', icon: 'eye', activity: 'memory', item: 'review', bands: EC },
];

export const movementPack: KidsPack = {
  id: 'movement',
  activities: [boardVisionActivity, paintActivity, gobbleActivity, memoryActivity],
  levelSets: [W1_ROADS, W1_COLORS, W1_ROOK_PAINT, W1_ROOK_GOBBLE, W2_BISHOP_PAINT, W2_BISHOP_GOBBLE, W2_TREASURE_MAP, W3_QUEEN_PAINT, W3_QUEEN_GOBBLE, W4_KNIGHT_PAINT, W4_KNIGHT_GOBBLE, W5_PAWN_SLANT, W5_ARMY, W5_SETUP, W6_BITE],
  playground: PLAYGROUND,
};
