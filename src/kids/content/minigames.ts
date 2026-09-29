// Pack B: Pawn Wars, Mini Battles and Capture the Crown (spec 13.7 and 13.8). Game sets are
// 'fixed' with one item per run; each item's `ease` ladder ends with a random bot plus a handicap.
import type { AgeBand, ItemMeta, KidsPack, LevelSet, Placement, PlaygroundEntry } from '../activities/types';
import type { BattleItem } from '../activities/battle/logic';
import type { CrownItem } from '../activities/captureCrown/logic';
import { battleActivity } from '../activities/battle';
import { captureCrownActivity } from '../activities/captureCrown';
import { crownPlacement, withoutKnights } from '../activities/captureCrown/logic';

type Battle = BattleItem & ItemMeta;
type Crown = CrownItem & ItemMeta;
const S: AgeBand[] = ['sprout'];
const E: AgeBand[] = ['explorer'];
const C: AgeBand[] = ['champion'];
const EC: AgeBand[] = ['explorer', 'champion'];

const row = (rank: number, piece: 'P' | 'p', files = 'abcdefgh'): Placement => Object.fromEntries([...files].map((f) => [f + rank, piece]));
const W3: Placement = row(2, 'P', 'abc');
const B3: Placement = row(7, 'p', 'abc');
const W8: Placement = row(2, 'P');
const B8: Placement = row(7, 'p');
const B6: Placement = row(7, 'p', 'bcdefg'); // a7 and h7 removed (handicap)

const MINI: Omit<BattleItem, 'bot'> = { white: W3, black: B3, area: 'a1:c8', win: 'promote' };
const WAR: Omit<BattleItem, 'bot'> = { white: W8, black: B8, win: 'promote' };

const WAR_SAY = { all: 'Pawn War! Get a pawn to the other side first!', sprout: 'Race a pawn to the other side!' };

export const W5_PAWN_WAR_MINI: LevelSet<BattleItem> = {
  id: 'w5-pawn-war-mini',
  activity: 'battle',
  order: 'fixed',
  perRun: { sprout: 1, explorer: 1, champion: 1 },
  intro: [
    { say: { all: 'Pawn War! Three pawns each. The first pawn to reach the other side wins!', sprout: 'Pawn War! Get a pawn to the other side!' }, pieces: { ...W3, ...B3 }, arrows: [{ from: 'b2', to: 'b8', color: 'green' }] },
    { say: { all: 'Pawns eat slanty. Watch out for my pawns!', sprout: 'Pawns eat slanty!' }, pieces: { b4: 'P', c5: 'p' }, arrows: [{ from: 'b4', to: 'c5', color: 'red' }], move: ['b4', 'c5'] },
    { say: 'Your turn!', ms: 600 },
  ],
  items: [
    { id: 'm-s', bands: S, ...MINI, bot: { depth: 1, r: 1.0 }, say: WAR_SAY, ease: [{ bot: { depth: 1, r: 3 } }, { black: { a7: 'p', b7: 'p' }, bot: { depth: 1, r: 3 } }] },
    { id: 'm-e', bands: E, ...MINI, bot: { depth: 1, r: 0.3 }, say: WAR_SAY, ease: [{ bot: { depth: 1, r: 1 } }, { bot: { depth: 1, r: 3 } }] },
    { id: 'm-c', bands: C, ...MINI, bot: { depth: 2, r: 2.5 }, say: WAR_SAY, ease: [{ bot: { depth: 1, r: 0.5 } }, { bot: { depth: 1, r: 3 } }] },
  ] as Battle[],
};

export const W5_BOSS: LevelSet<BattleItem> = {
  id: 'w5-boss',
  activity: 'battle',
  order: 'fixed',
  perRun: { sprout: 1, explorer: 1, champion: 1 },
  items: [
    { id: 'b-s', bands: S, ...MINI, bot: { depth: 1, r: 1.0 }, say: WAR_SAY, ease: [{ bot: { depth: 1, r: 3 } }, { black: { a7: 'p', b7: 'p' } }] },
    { id: 'b-e', bands: E, ...WAR, bot: { depth: 2, r: 0.3 }, say: WAR_SAY, ease: [{ bot: { depth: 1, r: 0.5 } }, { bot: { depth: 1, r: 3 } }, { black: B6, bot: { depth: 1, r: 3 } }] },
    {
      id: 'b-c',
      bands: C,
      ...WAR,
      enPassant: true,
      bot: { depth: 3, r: 0.1 },
      say: { all: 'The big Pawn War: eight pawns each!' },
      ease: [{ bot: { depth: 2, r: 0.3 } }, { bot: { depth: 1, r: 0.5 } }, { bot: { depth: 1, r: 3 } }, { black: B6, bot: { depth: 1, r: 3 } }],
    },
  ] as Battle[],
};

export const W6_BATTLES: LevelSet<BattleItem> = {
  id: 'w6-battles',
  activity: 'battle',
  order: 'fixed',
  perRun: { sprout: 1, explorer: 1, champion: 1 },
  items: [
    {
      id: 'knight-3',
      white: { g1: 'N' },
      black: B3,
      win: 'stop-pawns',
      // With best play the pawns win this one and a depth-2 bot never slips, so it could not be beaten (and the node
      // shows its next item only once this one is won): a gentler bot, one step harder for Champions.
      bot: { depth: 1, r: 1.0 },
      say: { all: 'Knight against three pawns! Catch every pawn before one reaches your side.', sprout: 'Hop and catch the pawns!' },
      tune: { champion: { bot: { depth: 2, r: 2.0 } } },
      ease: [{ bot: { depth: 1, r: 1 } }, { bot: { depth: 1, r: 3 } }, { black: { a7: 'p', b7: 'p' }, bot: { depth: 1, r: 3 } }],
    },
    {
      id: 'queen-8',
      white: { d1: 'Q' },
      black: B8,
      win: 'capture-all',
      bot: { depth: 2, r: 0.2 },
      say: { all: 'Queen against eight pawns! Eat them all. Do not let one reach your side!', sprout: 'Queen! Eat all the pawns!' },
      tune: { sprout: { bot: { depth: 1, r: 1.0 } } },
      ease: [{ bot: { depth: 1, r: 0.5 } }, { bot: { depth: 1, r: 3 } }, { black: B6, bot: { depth: 1, r: 3 } }],
    },
    {
      id: 'rook-3',
      bands: C,
      white: { a1: 'R' },
      black: { f7: 'p', g7: 'p', h7: 'p' },
      win: 'stop-pawns',
      bot: { depth: 3, r: 0.1 },
      say: 'Rook against three pawns. Stop them all!',
      ease: [{ bot: { depth: 2, r: 0.3 } }, { bot: { depth: 1, r: 3 } }],
    },
  ] as Battle[],
};

const KP = crownPlacement('4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3');
const KNP = crownPlacement('1n2k1n1/pppppppp/8/8/8/8/PPPPPPPP/1N2K1N1');
const KBP = crownPlacement('2b1k1b1/pppppppp/8/8/8/8/PPPPPPPP/2B1K1B1');
const FULL = crownPlacement('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
const CROWN_SAY = { all: 'Capture the Crown! Catch my king to win. Keep your king safe!', sprout: 'Catch the king!' };

export const W6_CROWN_GAME: LevelSet<CrownItem> = {
  id: 'w6-crown-game',
  activity: 'capture-crown',
  order: 'fixed',
  perRun: { sprout: 1, explorer: 1, champion: 1 },
  intro: [
    { say: { all: 'Capture the Crown! Whoever captures the other king wins.', sprout: 'Catch the king to win!' }, pieces: KP },
    { say: { all: 'If your king is in danger, the bells will ring. Ding ding!', champion: 'Leave your king where it can be taken, and you lose.' }, pieces: { e1: 'K', e4: 'q' }, arrows: [{ from: 'e4', to: 'e1', color: 'red' }], art: { e1: 'danger' } },
    { say: 'Your turn!', ms: 600 },
  ],
  items: [
    { id: 'kp', placement: KP, bot: 'sleepy', say: CROWN_SAY, ease: [{ placement: withoutKnights(KP) }] },
    { id: 'knp', placement: KNP, bot: 'sleepy', say: CROWN_SAY, ease: [{ bot: 'sleepy' }, { placement: withoutKnights(KNP) }] },
    { id: 'kbp', placement: KBP, bot: 'playful', say: CROWN_SAY, ease: [{ bot: 'sleepy' }, { placement: withoutKnights(KBP) }] },
    {
      id: 'full',
      bands: EC,
      placement: FULL,
      bot: 'playful',
      say: CROWN_SAY,
      tune: { champion: { bot: 'clever' } },
      ease: [{ bot: 'sleepy' }, { placement: withoutKnights(FULL), bot: 'sleepy' }],
    },
  ] as Crown[],
};

const war3 = { ...MINI, bot: { depth: 1, r: 0.5 }, say: WAR_SAY, tune: { sprout: { bot: { depth: 1, r: 1.0 } }, champion: { bot: { depth: 2, r: 0.2 } } } };
const war8 = { ...WAR, bot: { depth: 2, r: 0.3 }, say: WAR_SAY, tune: { sprout: { bot: { depth: 1, r: 1.0 } }, champion: { bot: { depth: 3, r: 0.1 } } } };
const knight = W6_BATTLES.items[0];
const queen = W6_BATTLES.items[1];
const crown = { placement: FULL, bot: 'playful', say: CROWN_SAY, tune: { sprout: { bot: 'sleepy' }, champion: { bot: 'clever' } } };

const pair = (id: string, title: string, icon: PlaygroundEntry['icon'], activity: string, item: unknown): PlaygroundEntry[] => [
  { id, title, icon, activity, item },
  { id: `${id}-friend`, title: `${title} with a friend`, icon: 'heart', activity, item, friend: true },
];

export const MINIGAMES_PLAYGROUND: PlaygroundEntry[] = [
  ...pair('pawn-war-3', 'Pawn War 3v3', 'swords', 'battle', war3),
  ...pair('pawn-war-8', 'Pawn War 8v8', 'swords', 'battle', war8),
  ...pair('knight-pawns', 'Knight vs Pawns', 'swords', 'battle', knight),
  ...pair('queen-pawns', 'Queen vs 8 Pawns', 'swords', 'battle', queen),
  ...pair('crown', 'Capture the Crown', 'crown', 'capture-crown', crown),
];

export const minigamesPack: KidsPack = {
  id: 'minigames',
  activities: [battleActivity, captureCrownActivity],
  levelSets: [W5_PAWN_WAR_MINI, W5_BOSS, W6_BATTLES, W6_CROWN_GAME],
  playground: MINIGAMES_PLAYGROUND,
};
