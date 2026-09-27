// The framework pack: the Star Collector and Find the Move activities and their level sets
// (spec 13.1 and 13.2). Every par and solution here is checked by validate() in tests/kids.test.ts.
import type { AgeBand, ItemMeta, KidsPack, LevelSet, PlaygroundEntry } from '../activities/types';
import type { StarItem } from '../activities/stars/logic';
import type { FindMoveItem } from '../activities/findMove/logic';
import { starsActivity } from '../activities/stars';
import { findMoveActivity } from '../activities/findMove';

type Star = StarItem & ItemMeta;
type FM = FindMoveItem & ItemMeta;
const S: AgeBand[] = ['sprout'];
const EC: AgeBand[] = ['explorer', 'champion'];
const C: AgeBand[] = ['champion'];

const sproutArea = (area: string) => ({ tune: { sprout: { area } } });

// ---------- Star Collector ----------

export const W1_HELLO: LevelSet<StarItem> = {
  id: 'w1-hello',
  activity: 'stars',
  order: 'fixed',
  perRun: { sprout: 4, explorer: 5, champion: 4 },
  intro: [
    {
      say: { all: "I'm Pip! This is the rook. It zooms in straight lines, like a train!", champion: 'This is the rook. It moves in straight lines.' },
      pieces: { a1: 'R' },
      arrows: [
        { from: 'a1', to: 'a8' },
        { from: 'a1', to: 'h1' },
      ],
    },
    { say: 'Watch me!', pieces: { a1: 'R' }, art: { a4: 'star' }, move: ['a1', 'a4'], ms: 1200 },
    { say: 'Your turn!', ms: 600 },
    { say: 'Which one is the rook?', pick: { answer: 'R', options: ['N', 'R', 'B'] } },
  ],
  items: [
    { id: 'h1', pieces: { a1: 'R' }, stars: ['a3'], par: 1, say: { all: 'Move the rook to the star!', sprout: 'Rook to the star!' }, ...sproutArea('a1:d4') },
    { id: 'h2', pieces: { a1: 'R' }, stars: ['c1'], par: 1, say: { all: 'Now zoom sideways!', sprout: 'Zoom to the star!' }, ...sproutArea('a1:d4') },
    { id: 'h3', pieces: { b2: 'R' }, stars: ['b4', 'd4'], par: 2, say: 'Get both stars!', ...sproutArea('a1:d4') },
    { id: 'h4', pieces: { a1: 'R' }, stars: ['a4', 'd4', 'd1'], par: 3, say: 'Three stars! Go!', ...sproutArea('a1:d4') },
    { id: 'h5', pieces: { a1: 'R' }, stars: ['a8'], par: 1, tier: 2, say: 'Zoom all the way!' },
    { id: 'h6', pieces: { a1: 'R' }, stars: ['a8', 'h8'], par: 2, tier: 2, say: 'Up and across!' },
  ],
};

const rookSay = { all: 'Collect every star with the rook!', sprout: 'Get the stars!' };

export const W1_ROOK_STARS: LevelSet<StarItem> = {
  id: 'w1-rook-stars',
  activity: 'stars',
  items: [
    { id: 'r1', bands: S, pieces: { b2: 'R' }, rocks: ['b3', 'c2'], stars: ['d4'], area: 'a1:e5', par: 3, say: 'Go around the rocks!' },
    { id: 'r2', bands: S, pieces: { c1: 'R' }, rocks: ['c3', 'b1', 'd1'], stars: ['a4', 'e4'], area: 'a1:e5', par: 4, tier: 2, say: rookSay },
    { id: 'r3', pieces: { d4: 'R' }, stars: ['d8', 'h8', 'h1', 'a1'], par: 4, say: { all: 'Visit all four corners... almost!', sprout: 'Get the stars!' } },
    { id: 'r4', pieces: { a1: 'R' }, rocks: ['a4', 'd1'], stars: ['a8'], par: 3, say: "Rooks can't jump!" },
    { id: 'r5', pieces: { e4: 'R' }, rocks: ['e6'], stars: ['e7', 'b7', 'b2'], par: 4, tier: 2, say: rookSay },
    { id: 'r6', pieces: { h1: 'R' }, rocks: ['h5', 'e1', 'e3'], stars: ['a8'], par: 3, tier: 2, say: 'Find a way around!' },
    { id: 'r7', pieces: { a1: 'R' }, rocks: ['e1', 'c6'], stars: ['h1', 'h8', 'c8', 'c3'], par: 6, tier: 3, bands: EC, say: 'A long trip. Plan your road!' },
  ],
};

export const W1_BOSS: LevelSet<StarItem> = {
  id: 'w1-boss',
  activity: 'stars',
  items: [
    { id: 'b1', bands: S, pieces: { a1: 'R' }, rocks: ['b2', 'c3', 'd1'], stars: ['a4', 'd4', 'e2'], area: 'a1:e5', par: 4, say: 'The Rook Maze! Get every star!' },
    { id: 'b2', pieces: { a1: 'R' }, rocks: ['a5', 'b3', 'c3', 'd6', 'f2'], stars: ['a4', 'd4', 'd8', 'h8'], par: 5, tier: 2, say: 'The Rook Maze! Get every star!' },
    { id: 'b3', pieces: { a1: 'R' }, rocks: ['a3', 'c1', 'c4', 'f5', 'g2'], stars: ['b3', 'h3', 'h8', 'a8'], par: 5, tier: 2, say: 'Twisty roads. You can do it!' },
    { id: 'b4', pieces: { e1: 'R' }, rocks: ['e3', 'b1', 'h4', 'b6'], stars: ['a2', 'h2', 'h8', 'a8', 'e5'], par: 7, tier: 3, bands: EC, say: 'Five stars in the maze!' },
  ],
};

const bishopSay = { all: 'Slide the bishop to every star!', sprout: 'Slide to the stars!' };

export const W2_BISHOP_STARS: LevelSet<StarItem> = {
  id: 'w2-bishop-stars',
  activity: 'stars',
  intro: [
    { say: { all: 'This is the bishop. She slides on slanty lines!', champion: 'The bishop moves diagonally.' }, pieces: { c1: 'B' }, arrows: [{ from: 'c1', to: 'h6' }, { from: 'c1', to: 'a3' }] },
    { say: 'Watch me!', pieces: { c1: 'B' }, art: { f4: 'star' }, move: ['c1', 'f4'], ms: 1200 },
    { say: 'Your turn!', ms: 600 },
    { say: 'Which one is the bishop?', pick: { answer: 'B', options: ['R', 'B', 'N'] } },
  ],
  items: [
    { id: 's1', bands: S, pieces: { c1: 'B' }, stars: ['a3'], area: 'a1:d4', par: 1, say: 'Slide to the star!' },
    { id: 's2', bands: S, pieces: { c1: 'B' }, stars: ['b2', 'd2'], area: 'a1:d4', par: 3, say: 'Get both stars!' },
    { id: 's3', pieces: { c1: 'B' }, stars: ['f4'], par: 1, say: bishopSay },
    { id: 's4', pieces: { c1: 'B' }, stars: ['e3', 'g5', 'd8'], par: 3, say: bishopSay },
    { id: 's5', pieces: { f1: 'B' }, stars: ['h3', 'c8', 'a6'], par: 3, tier: 2, say: bishopSay },
    { id: 's6', pieces: { c1: 'B' }, rocks: ['e3'], stars: ['f4', 'h6', 'd2'], par: 5, tier: 2, say: 'A rock is in the way!' },
    { id: 's7', pieces: { f1: 'B' }, rocks: ['d3'], stars: ['h1', 'a6'], par: 4, tier: 3, say: 'Think before you slide!' },
  ],
};

export const W2_BOSS: LevelSet<StarItem> = {
  id: 'w2-boss',
  activity: 'stars',
  items: [
    { id: 'b1', bands: S, pieces: { a1: 'R', c1: 'B' }, stars: ['a4', 'b2', 'd2'], area: 'a1:d4', par: 4, say: 'Two friends! Tap the one you want to move.' },
    { id: 'b2', pieces: { a1: 'R', f1: 'B' }, stars: ['a8', 'h3', 'c4'], par: 4, say: 'Rook and bishop work together!' },
    { id: 'b3', pieces: { a1: 'R', c1: 'B' }, rocks: ['a5', 'd2'], stars: ['a4', 'g5', 'h8', 'e3'], par: 6, tier: 2, say: 'Which friend should go first?' },
  ],
};

const queenSay = { all: 'Zoom the queen to every star!', sprout: 'Zoom to the stars!' };

export const W3_QUEEN_STARS: LevelSet<StarItem> = {
  id: 'w3-queen-stars',
  activity: 'stars',
  intro: [
    { say: { all: 'This is the queen. She goes straight AND slanty!', champion: 'The queen moves like a rook and a bishop.' }, pieces: { d1: 'Q' }, arrows: [{ from: 'd1', to: 'd8' }, { from: 'd1', to: 'h5' }, { from: 'd1', to: 'a4' }] },
    { say: 'Watch me!', pieces: { d1: 'Q' }, art: { h5: 'star' }, move: ['d1', 'h5'], ms: 1200 },
    { say: 'Your turn!', ms: 600 },
    { say: 'Which one is the queen?', pick: { answer: 'Q', options: ['K', 'Q', 'B'] } },
  ],
  items: [
    { id: 'q1', bands: S, pieces: { a1: 'Q' }, stars: ['d4', 'a4'], area: 'a1:d4', par: 2, say: queenSay },
    { id: 'q2', pieces: { d1: 'Q' }, stars: ['d7', 'a4', 'h4'], par: 3, say: queenSay },
    { id: 'q3', pieces: { d1: 'Q' }, rocks: ['d4', 'e2', 'c2'], stars: ['d8', 'h5', 'a8'], par: 5, tier: 2, say: 'Rocks all around!' },
    { id: 'q4', pieces: { d1: 'Q' }, rocks: ['d4'], stars: ['d8', 'a5', 'h5', 'h1', 'a1'], par: 5, tier: 2, say: 'Five stars for the queen!' },
    { id: 'q5', pieces: { h1: 'Q' }, rocks: ['g2', 'h4', 'e1'], stars: ['a8', 'b1'], par: 5, tier: 3, say: 'Find the secret road!' },
  ],
};

const kingSay = { all: 'Walk the king to every star!', sprout: 'Little steps to the stars!' };

export const W3_KING_STARS: LevelSet<StarItem> = {
  id: 'w3-king-stars',
  activity: 'stars',
  intro: [
    { say: { all: 'This is the king. He takes tiny steps, one square at a time.', champion: 'The king moves one square in any direction.' }, pieces: { e1: 'K' }, art: { d1: 'dot', d2: 'dot', e2: 'dot', f2: 'dot', f1: 'dot' } },
    { say: 'Watch me!', pieces: { e1: 'K' }, art: { e2: 'star' }, move: ['e1', 'e2'], ms: 1200 },
    { say: 'Your turn!', ms: 600 },
    { say: 'Which one is the king?', pick: { answer: 'K', options: ['Q', 'K', 'R'] } },
  ],
  items: [
    { id: 'k1', bands: S, pieces: { b1: 'K' }, stars: ['b2', 'c3'], area: 'a1:d4', par: 2, say: kingSay },
    { id: 'k2', pieces: { e1: 'K' }, stars: ['e2', 'e3', 'f4'], par: 3, say: kingSay },
    { id: 'k3', pieces: { e1: 'K' }, stars: ['e2', 'f3', 'g2'], par: 3, say: kingSay },
    { id: 'k4', pieces: { a1: 'K' }, rocks: ['b2', 'b1', 'a3', 'c3'], stars: ['a4'], par: 3, tier: 2, say: 'Squeeze past the rocks!' },
    { id: 'k5', pieces: { e1: 'K' }, stars: ['e8'], par: 7, tier: 2, say: 'The king walks slowly!' },
  ],
};

const lavaSay = { all: "Get the star, but don't step in the lava!", sprout: 'No lava steps!' };

export const W3_KING_LAVA: LevelSet<StarItem> = {
  id: 'w3-king-lava',
  activity: 'stars',
  intro: [
    { say: { all: 'This knight statue is sleeping. The glowing squares are lava!', champion: 'Squares the statue attacks are lava.' }, pieces: { e1: 'K' }, fen: '8/8/8/4n3/8/8/8/4K3 w - - 0 1', art: { d3: 'lava', f3: 'lava', c4: 'lava', g4: 'lava', c6: 'lava', g6: 'lava', d7: 'lava', f7: 'lava' } },
    { say: 'The king never steps where he can be taken.', ms: 1200 },
  ],
  items: [
    { id: 'l1', bands: S, pieces: { a1: 'K' }, statues: { c3: 'n' }, stars: ['a3'], area: 'a1:d4', par: 2, say: lavaSay },
    { id: 'l2', pieces: { e1: 'K' }, statues: { e5: 'n' }, stars: ['e8'], par: 7, say: lavaSay },
    { id: 'l3', pieces: { e1: 'K' }, statues: { d5: 'b' }, stars: ['e8'], par: 7, tier: 2, say: lavaSay },
    { id: 'l4', pieces: { a1: 'K' }, statues: { c3: 'n', e6: 'b' }, stars: ['h8'], par: 8, tier: 3, bands: EC, say: 'Two statues. Careful!' },
  ],
};

export const W3_BOSS: LevelSet<StarItem> = {
  id: 'w3-boss',
  activity: 'stars',
  items: [
    { id: 'b1', bands: S, pieces: { a1: 'Q' }, statues: { c3: 'n' }, stars: ['d4', 'b4'], area: 'a1:d4', par: 3, say: lavaSay },
    { id: 'b2', pieces: { d1: 'Q' }, statues: { f6: 'n' }, stars: ['d8', 'h4'], par: 3, say: lavaSay },
    { id: 'b3', pieces: { e1: 'K' }, statues: { c4: 'b', f5: 'n' }, stars: ['e8'], par: 7, tier: 2, say: 'Walk the king through the garden!' },
    { id: 'b4', pieces: { d1: 'Q' }, rocks: ['d3'], statues: { f5: 'r' }, stars: ['d8', 'h1', 'a4'], par: 5, tier: 2, say: 'Rocks and lava!' },
  ],
};

const knightSay = { all: 'Hop to every star! Two steps and a turn.', sprout: 'Hop to the stars!' };

export const W4_KNIGHT_HOPS: LevelSet<StarItem> = {
  id: 'w4-knight-hops',
  activity: 'stars',
  intro: [
    { say: { all: "This is the knight. Like me! I hop funny: two steps and a turn!", champion: 'The knight jumps in an L shape.' }, pieces: { d4: 'N' }, art: { c6: 'dot', e6: 'dot', f5: 'dot', f3: 'dot', e2: 'dot', c2: 'dot', b3: 'dot', b5: 'dot' } },
    { say: 'Watch me!', pieces: { b1: 'N' }, art: { c3: 'star' }, move: ['b1', 'c3'], ms: 1200 },
    { say: 'Your turn!', ms: 600 },
    { say: 'Which one is the knight?', pick: { answer: 'N', options: ['B', 'R', 'N'] } },
  ],
  items: [
    { id: 'n1', bands: S, pieces: { b1: 'N' }, stars: ['c3'], area: 'a1:d4', par: 1, say: knightSay },
    { id: 'n2', bands: S, pieces: { b1: 'N' }, stars: ['a3', 'd2'], area: 'a1:d4', par: 3, say: knightSay },
    { id: 'n3', pieces: { b1: 'N' }, stars: ['c3', 'e4', 'f6'], par: 3, say: knightSay },
    { id: 'n4', pieces: { g1: 'N' }, stars: ['g3'], par: 2, say: "The knight can't go straight!" },
    { id: 'n5', pieces: { b1: 'N' }, stars: ['c3', 'e4', 'g5'], par: 3, tier: 2, say: knightSay },
    { id: 'n6', pieces: { a1: 'N' }, stars: ['b1'], par: 3, tier: 2, say: 'Right next door takes 3 hops!' },
    { id: 'n7', pieces: { a1: 'N' }, stars: ['b2'], par: 4, tier: 3, say: 'A tricky one!' },
  ],
};

export const W4_KNIGHT_JUMP: LevelSet<StarItem> = {
  id: 'w4-knight-jump',
  activity: 'stars',
  items: [
    { id: 'j1', pieces: { b1: 'N' }, rocks: ['a1', 'a2', 'b2', 'c2', 'c1'], stars: ['c3', 'e2'], par: 2, say: 'Knights jump over!' },
    { id: 'j2', pieces: { g1: 'N' }, rocks: ['f1', 'h1', 'f2', 'g2', 'h2'], stars: ['f3', 'h3'], par: 3, say: 'Jump over the rocks!' },
    { id: 'j3', pieces: { d4: 'N' }, rocks: ['c4', 'e4', 'd3', 'd5', 'c3', 'e3', 'c5', 'e5'], stars: ['e6', 'b3', 'f2'], par: 6, tier: 2, say: 'Hop out of the rock ring!' },
  ],
};

export const W4_BOSS: LevelSet<StarItem> = {
  id: 'w4-boss',
  activity: 'stars',
  items: [
    { id: 'b1', bands: S, pieces: { b1: 'N' }, stars: ['c3', 'd5'], area: 'a1:d6', par: 2, say: 'Knight Trek! Hop hop!' },
    { id: 'b2', pieces: { b1: 'N' }, stars: ['c3', 'e4', 'g5', 'h7'], par: 4, say: 'Knight Trek! Hop to every star!' },
    { id: 'b3', pieces: { b1: 'N' }, rocks: ['c3', 'd2'], stars: ['e4', 'g5', 'f7'], par: 6, tier: 2, say: 'The easy hops are blocked!' },
    { id: 'b4', pieces: { a1: 'N' }, stars: ['h8'], par: 6, tier: 3, bands: C, say: 'Corner to corner! How few hops can you do it in?', awardOnDone: 'st-knight-trek', bestKey: 'trek-a1h8' },
  ],
};

export const W5_PAWN_STEPS: LevelSet<StarItem> = {
  id: 'w5-pawn-steps',
  activity: 'stars',
  intro: [
    { say: { all: 'This is a pawn. Pawns march straight ahead, one step at a time.', champion: 'Pawns move straight forward.' }, pieces: { e2: 'P' }, arrows: [{ from: 'e2', to: 'e4' }] },
    { say: 'On its first move, a pawn may take two steps!', pieces: { e2: 'P' }, art: { e4: 'star' }, move: ['e2', 'e4'], ms: 1200 },
    { say: 'Your turn!', ms: 600 },
    { say: 'Which one is the pawn?', pick: { answer: 'P', options: ['P', 'K', 'B'] } },
  ],
  items: [
    { id: 'p1', pieces: { e2: 'P' }, stars: ['e4'], par: 1, say: 'On its first move a pawn may take two steps!' },
    { id: 'p2', pieces: { e2: 'P' }, stars: ['e3', 'e5'], par: 3, say: 'March to both stars!' },
    { id: 'p3', pieces: { d2: 'P' }, stars: ['d4', 'd6'], par: 3, say: 'March, march!' },
    { id: 'p4', pieces: { a2: 'P', h2: 'P' }, stars: ['a4', 'h4'], par: 2, tier: 2, say: 'Two pawns, two stars!' },
  ],
};

export const W5_PROMO: LevelSet<StarItem> = {
  id: 'w5-promo',
  activity: 'stars',
  items: [
    { id: 'm1', pieces: { b7: 'P' }, stars: ['b8', 'h2'], par: 2, say: 'Reach the end and become a queen!' },
    { id: 'm2', pieces: { e6: 'P' }, stars: ['e8', 'a4'], par: 3, say: 'March, then fly as a queen!' },
    { id: 'm3', pieces: { g5: 'P' }, stars: ['g8', 'a2'], par: 4, tier: 2, say: 'Crown the pawn!' },
  ],
};

export const W6_LAVA: LevelSet<StarItem> = {
  id: 'w6-lava',
  activity: 'stars',
  items: [
    { id: 'v1', pieces: { a1: 'R' }, statues: { c5: 'b' }, stars: ['h8'], par: 2, say: lavaSay },
    { id: 'v2', pieces: { d1: 'Q' }, statues: { f6: 'n' }, stars: ['d8', 'h4'], par: 3, say: lavaSay },
    { id: 'v3', pieces: { b1: 'N' }, statues: { d8: 'r' }, stars: ['e5'], par: 3, say: 'The rook statue guards a whole road!' },
    { id: 'v4', pieces: { c1: 'B' }, statues: { f6: 'p', b6: 'n' }, stars: ['h6', 'a3'], par: 3, tier: 2, say: lavaSay },
    { id: 'v5', pieces: { h1: 'R' }, statues: { d4: 'q' }, stars: ['a8'], par: 3, tier: 2, say: 'A queen statue makes lots of lava!' },
    { id: 'v6', pieces: { e1: 'K' }, statues: { e5: 'n' }, stars: ['e8'], par: 7, tier: 2, say: 'Walk the king safely!' },
  ],
};

// ---------- Find the Move ----------

const fm = (id: string, fen: string, goal: FindMoveItem['goal'], extra: Partial<FM> = {}): FM => ({ id, fen, goal, ...extra });

const F1 = fm('f1', '4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1', { kind: 'capture', square: 'd5' }, { say: { all: 'Gobble the black queen!', champion: 'Capture the queen on d5.' } });
const F2 = fm('f2', '4k3/8/8/8/8/2n5/8/2R1K3 w - - 0 1', { kind: 'capture', square: 'c3' }, { say: { all: 'Gobble the knight!', champion: 'Capture the knight on c3.' } });
const F3 = fm('f3', '4k3/8/8/8/3n4/4P3/8/4K3 w - - 0 1', { kind: 'capture', square: 'd4' }, { say: { all: 'Pawns eat slanty! Gobble the knight!', champion: 'Pawns capture diagonally. Take the knight.' } });
const F4 = fm('f4', '4k3/8/8/8/3b4/8/2N5/4K3 w - - 0 1', { kind: 'capture', square: 'd4' }, { tier: 2, say: { all: 'Hop and gobble the bishop!', champion: 'Capture the bishop on d4.' } });
const F5 = fm('f5', '4k3/8/8/1r6/8/8/4B3/4K3 w - - 0 1', { kind: 'capture', square: 'b5' }, { tier: 2, say: { all: 'Slide and gobble the rook!', champion: 'Capture the rook on b5.' } });
const F6 = fm('f6', '4k3/8/8/8/6r1/8/8/3QK3 w - - 0 1', { kind: 'capture', square: 'g4' }, { tier: 2, say: { all: 'Find the queen move that gobbles the rook!', champion: 'Capture the rook on g4.' } });
const F7 = fm('f7', '4k3/8/p7/1n6/8/1R3b2/8/4K3 w - - 0 1', { kind: 'safe-capture' }, { tier: 3, bands: EC, say: { all: 'Two snacks. Which one is safe to eat?', champion: 'Two captures. Only one is safe.' } });

export const W6_FREE_LUNCH: LevelSet<FindMoveItem> = { id: 'w6-free-lunch', activity: 'find-move', items: [F1, F2, F3, F4, F5, F6, F7] };

export const W6_BOSS: LevelSet<FindMoveItem> = {
  id: 'w6-boss',
  activity: 'find-move',
  items: [
    { ...F5, bands: EC, tier: 1 },
    { ...F6, bands: EC, tier: 1 },
    { ...F7, bands: EC, tier: 2 },
    fm('s1', '4k3/8/8/8/1b6/2N5/8/R3K3 w - - 0 1', { kind: 'protect', square: 'c3' }, { bands: EC, tier: 2, say: { all: 'Your knight is in danger! Give it a guard.', champion: 'Defend the knight on c3.' } }),
    fm('s2', '4k3/8/2n5/8/3R4/8/8/4K1N1 w - - 0 1', { kind: 'protect', square: 'd4' }, { bands: EC, tier: 2, say: { all: 'Guard your rook!', champion: 'Defend the rook on d4.' } }),
    fm('s3', '4k3/8/8/8/3n4/4P3/8/4K3 w - - 0 1', { kind: 'capture', square: 'd4' }, { bands: S, say: 'Pawns eat slanty! Gobble!' }),
    fm('s4', '4k3/8/8/8/8/2n5/8/2R1K3 w - - 0 1', { kind: 'capture', square: 'c3' }, { bands: S, say: 'Gobble the knight!' }),
    fm('s5', '4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1', { kind: 'capture', square: 'd5' }, { bands: S, say: 'Gobble the queen!' }),
  ],
};

const checkSay = { all: 'Give check! Attack the king.', sprout: 'Attack the king!' };

export const W7_CHECK: LevelSet<FindMoveItem> = {
  id: 'w7-check',
  activity: 'find-move',
  intro: [
    { say: { all: "Check means the king is standing in lava! Let's attack the king.", champion: 'Check: the king is attacked.' }, fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', arrows: [{ from: 'a1', to: 'a8' }] },
    { say: 'Watch me!', fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', move: ['a1', 'a8'], ms: 1400 },
    { say: 'Your turn!', ms: 600 },
  ],
  items: [
    fm('c1', '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', { kind: 'check' }, { say: checkSay }),
    fm('c2', '4k3/8/8/8/8/8/8/4K2R w - - 0 1', { kind: 'check' }, { say: checkSay }),
    fm('c3', '4k3/8/5P2/8/8/8/8/4K3 w - - 0 1', { kind: 'check' }, { say: { all: 'Can a little pawn give check?', sprout: 'Pawn attack!' } }),
    fm('c4', '4k3/8/8/8/4N3/8/8/4K3 w - - 0 1', { kind: 'check' }, { tier: 2, say: { all: 'Hop to check! There are two ways.', sprout: 'Hop to attack!' } }),
    fm('c5', '4k3/8/8/8/8/8/8/3QK3 w - - 0 1', { kind: 'check' }, { tier: 2, say: { all: 'The queen has lots of checks. Find one!', sprout: 'Queen attack!' } }),
    fm('c6', '4k3/8/8/8/8/8/8/1B2K3 w - - 0 1', { kind: 'check' }, { tier: 3, bands: EC, say: 'Only one bishop move gives check!' }),
  ],
};

const mateSay = { all: 'Find checkmate!', champion: 'Mate in one.' };

const M1 = fm('m1', 'k7/2Q5/2K5/8/8/8/8/8 w - - 0 1', { kind: 'mate' }, { say: { all: "The Queen's kiss! Find checkmate.", champion: 'Mate in one: the queen’s kiss.' } });
const M2 = fm('m2', 'k7/8/1K6/8/8/8/8/7Q w - - 0 1', { kind: 'mate' }, { say: mateSay });
const M4 = fm('m4', '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', { kind: 'mate' }, { tier: 2, say: { all: 'The king is stuck behind his pawns. Checkmate!', champion: 'Back-rank mate in one.' } });

export const W7_MATE1: LevelSet<FindMoveItem> = {
  id: 'w7-mate1',
  activity: 'find-move',
  perRun: { sprout: 4 },
  items: [
    M1,
    M2,
    fm('m3', '7k/8/6K1/8/8/8/8/Q7 w - - 0 1', { kind: 'mate' }, { tier: 2, say: mateSay }),
    M4,
    fm('m5', 'k7/7R/1K6/8/8/8/8/8 w - - 0 1', { kind: 'mate' }, { tier: 2, bands: EC, say: mateSay }),
    fm('m6', '1k6/7R/8/8/8/8/8/6RK w - - 0 1', { kind: 'mate' }, { tier: 2, bands: EC, say: { all: 'Two rooks make a ladder. Checkmate!', champion: 'Ladder mate in one.' } }),
    fm('m7', '4k3/R7/8/4K3/8/8/8/1R6 w - - 0 1', { kind: 'mate' }, { tier: 3, bands: EC, say: mateSay }),
    fm('m8', 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4', { kind: 'mate' }, { tier: 3, bands: EC, say: { all: 'A famous trap! Find checkmate.', champion: "Scholar's mate in one." } }),
    fm('m9', 'k7/2P5/1K6/8/8/8/8/8 w - - 0 1', { kind: 'mate' }, { tier: 3, bands: EC, say: 'The pawn can checkmate!' }),
    fm('m10', '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', { kind: 'mate' }, { tier: 3, bands: C, say: 'Smothered mate! The king is trapped by his own pieces.' }),
  ],
};

// ---------- Placement checkpoints (framework activities only) ----------

const cpStars = (id: string, items: Omit<Star, 'say'>[]): LevelSet<StarItem> => ({
  id,
  activity: 'stars',
  order: 'fixed',
  items: items.map((it, i) => ({ ...it, id: `${id}-${i + 1}`, say: { all: 'Collect every star!', sprout: 'Get the stars!' } })),
});

export const CHECKPOINTS: LevelSet[] = [
  cpStars('cp1', [
    { pieces: { d4: 'R' }, stars: ['d8', 'h8', 'h1', 'a1'], par: 4 },
    { pieces: { a1: 'R' }, rocks: ['a4', 'd1'], stars: ['a8'], par: 3 },
    { pieces: { e4: 'R' }, rocks: ['e6'], stars: ['e7', 'b7', 'b2'], par: 4 },
  ]),
  cpStars('cp2', [
    { pieces: { c1: 'B' }, stars: ['e3', 'g5', 'd8'], par: 3 },
    { pieces: { f1: 'B' }, stars: ['h3', 'c8', 'a6'], par: 3 },
    { pieces: { c1: 'B' }, rocks: ['e3'], stars: ['f4', 'h6', 'd2'], par: 5 },
  ]),
  cpStars('cp3', [
    { pieces: { d1: 'Q' }, rocks: ['d4', 'e2', 'c2'], stars: ['d8', 'h5', 'a8'], par: 5 },
    { pieces: { e1: 'K' }, stars: ['e2', 'f3', 'g2'], par: 3 },
    { pieces: { e1: 'K' }, statues: { e5: 'n' }, stars: ['e8'], par: 7 },
  ]),
  cpStars('cp4', [
    { pieces: { b1: 'N' }, stars: ['c3', 'e4', 'f6'], par: 3 },
    { pieces: { g1: 'N' }, stars: ['g3'], par: 2 },
    { pieces: { b1: 'N' }, rocks: ['a1', 'a2', 'b2', 'c2', 'c1'], stars: ['c3', 'e2'], par: 2 },
  ]),
  cpStars('cp5', [
    { pieces: { e2: 'P' }, stars: ['e4'], par: 1 },
    { pieces: { b7: 'P' }, stars: ['b8', 'h2'], par: 2 },
    { pieces: { d2: 'P' }, stars: ['d4', 'd6'], par: 3 },
  ]),
  { id: 'cp6', activity: 'find-move', order: 'fixed', items: [{ ...F1, id: 'cp6-1' }, { ...F7, id: 'cp6-2', bands: undefined, tier: undefined }, { ...F3, id: 'cp6-3' }] },
  {
    id: 'cp7',
    activity: 'find-move',
    order: 'fixed',
    items: [
      { ...W7_CHECK.items[0], id: 'cp7-1' },
      fm('cp7-2', '4k3/8/8/8/4r3/8/2B5/R2QK3 w - - 0 1', { kind: 'escape', ways: 'any' }, { say: { all: 'Your king is in check! Get him out of danger.', champion: 'Get out of check.' } }),
      { ...M2, id: 'cp7-3' },
    ],
  },
  {
    id: 'cp8',
    activity: 'find-move',
    order: 'fixed',
    items: [
      { ...M4, id: 'cp8-1', tier: undefined },
      fm('cp8-2', 'q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', { kind: 'line', uci: ['b5c7', 'e8d7', 'c7a8'] }, { say: { all: 'Hop to attack the king AND the queen!', champion: 'Find the knight fork.' } }),
      { ...M1, id: 'cp8-3' },
    ],
  },
];

// ---------- The pack ----------

const PLAYGROUND: PlaygroundEntry[] = [{ id: 'star-hunt', title: 'Star Hunt Endless', icon: 'star', activity: 'stars', item: 'review' }];

export const corePack: KidsPack = {
  id: 'core',
  activities: [starsActivity, findMoveActivity],
  levelSets: [W1_HELLO, W1_ROOK_STARS, W1_BOSS, W2_BISHOP_STARS, W2_BOSS, W3_QUEEN_STARS, W3_KING_STARS, W3_KING_LAVA, W3_BOSS, W4_KNIGHT_HOPS, W4_KNIGHT_JUMP, W4_BOSS, W5_PAWN_STEPS, W5_PROMO, W6_FREE_LUNCH, W6_LAVA, W6_BOSS, W7_CHECK, W7_MATE1],
  playground: PLAYGROUND,
};
