// Pack D: Buddies. The play-bot level sets (spec 13.12) and the buddy Playground.
// Every item (and every ease step) is checked by validate() in tests/kids.test.ts.
import type { AgeBand, ItemMeta, KidsPack, LevelSet, PlaygroundEntry } from '../activities/types';
import { playBotActivity } from '../activities/playBot';
import { KNIGHT_HOME, QUEEN_HOME, QUEEN_ROOK_HOME, type PlayBotItem } from '../activities/playBot/logic';
import { BUDDIES, type BuddyId } from '../curriculum/buddies';

type Game = PlayBotItem & ItemMeta;
const S: AgeBand[] = ['sprout'];
const E: AgeBand[] = ['explorer'];
const C: AgeBand[] = ['champion'];
const SE: AgeBand[] = ['sprout', 'explorer'];

export const W7_ARMIES: LevelSet<PlayBotItem> = {
  id: 'w7-armies',
  activity: 'play-bot',
  order: 'fixed',
  intro: [
    { say: { all: 'Time for little armies! Shelly the snail wants to play.', champion: 'Mini armies against Shelly.' }, fen: '4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1' },
    { say: { all: 'Race a pawn to the other side to make a queen!', champion: 'First queen wins.' }, fen: '4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1', arrows: [{ from: 'e2', to: 'e8' }] },
  ],
  items: [
    { id: 'pawns', bot: 'shelly', mission: 'promote', fen: '4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1', say: { all: 'Kings and pawns! Make a queen first!', champion: 'Kings and pawns. Checkmate to win.' }, tune: { champion: { mission: 'win' } } },
    { id: 'knights', bot: 'shelly', mission: 'promote', fen: '1n2k1n1/pppppppp/8/8/8/8/PPPPPPPP/1N2K1N1 w - - 0 1', say: { all: 'Knights join in! Make a queen first!', champion: 'Knights join. Checkmate to win.' }, tune: { champion: { mission: 'win' } } },
    { id: 'bishops', bot: 'shelly', mission: 'promote', fen: '2b1k1b1/pppppppp/8/8/8/8/PPPPPPPP/2B1K1B1 w - - 0 1', say: { all: 'Bishops join in! Make a queen first!', champion: 'Bishops join. Checkmate to win.' }, tune: { champion: { mission: 'win' } } },
  ] satisfies Game[],
};

export const W7_BOSS: LevelSet<PlayBotItem> = {
  id: 'w7-boss',
  activity: 'play-bot',
  order: 'fixed',
  items: [
    {
      id: 'hop',
      bands: SE,
      bot: 'hop',
      mission: 'win',
      fen: QUEEN_HOME,
      say: { all: 'Your first real game! Hop left the queen at home. Checkmate to win!' },
      ease: [
        { bot: 'shelly', fen: QUEEN_HOME },
        { bot: 'shelly', fen: QUEEN_ROOK_HOME },
      ],
    },
    {
      id: 'tuck',
      bands: C,
      bot: 'tuck',
      mission: 'win',
      say: 'A full game against Tuck. Checkmate to win.',
      ease: [
        { bot: 'tuck', fen: QUEEN_HOME },
        { bot: 'hop', fen: QUEEN_HOME },
        { bot: 'shelly', fen: QUEEN_HOME },
      ],
    },
  ] satisfies Game[],
};

export const W8_GOLDEN_RULES: LevelSet<PlayBotItem> = {
  id: 'w8-golden-rules',
  activity: 'play-bot',
  order: 'fixed',
  intro: [
    { say: { all: 'The Golden Rules: put a pawn in the middle, then bring out your knights and bishops.', champion: 'Golden Rules: center pawn, knights and bishops out.' }, fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', arrows: [{ from: 'g1', to: 'f3' }, { from: 'f1', to: 'c4' }] },
    { say: { all: 'Then castle your king to safety, and keep your queen home for a while!', champion: 'Castle early and keep the queen home for 5 moves.' }, fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', arrows: [{ from: 'e1', to: 'g1' }] },
  ],
  items: [
    { id: 'tuck', bands: E, bot: 'tuck', mission: 'develop', say: 'Follow the Golden Rules in your first 10 moves!' },
    { id: 'fern', bands: C, bot: 'fern', mission: 'develop', say: 'Develop well in your first 10 moves.' },
  ] satisfies Game[],
};

export const W8_BUDDY_LADDER: LevelSet<PlayBotItem> = {
  id: 'w8-buddy-ladder',
  activity: 'play-bot',
  order: 'fixed',
  items: [
    { id: 'hop', bands: S, bot: 'hop', mission: 'win', say: 'Hop has the whole army now. Can you win?', ease: [{ bot: 'shelly', fen: QUEEN_HOME }] },
    { id: 'tuck', bands: E, bot: 'tuck', mission: 'win', say: 'Climb the ladder: beat Tuck!', ease: [{ bot: 'hop' }, { bot: 'shelly', fen: QUEEN_HOME }] },
    { id: 'fern', bands: C, bot: 'fern', mission: 'win', say: 'Next rung: beat Fern.', ease: [{ bot: 'tuck' }, { bot: 'shelly', fen: QUEEN_HOME }] },
  ] satisfies Game[],
};

export const W8_CROWN: LevelSet<PlayBotItem> = {
  id: 'w8-crown',
  activity: 'play-bot',
  order: 'fixed',
  items: [
    {
      id: 'hop',
      bands: S,
      bot: 'hop',
      mission: 'win',
      say: 'The Crown! Beat Hop to become a queen or king!',
      ease: [
        { bot: 'hop', fen: QUEEN_HOME },
        { bot: 'shelly', fen: QUEEN_HOME },
        { bot: 'shelly', fen: QUEEN_ROOK_HOME },
      ],
    },
    {
      id: 'fern',
      bands: E,
      bot: 'fern',
      mission: 'win',
      say: 'The Crown! Beat Fern the fox to earn it!',
      ease: [{ bot: 'fern', fen: KNIGHT_HOME }, { bot: 'tuck' }, { bot: 'hop', fen: QUEEN_HOME }, { bot: 'shelly', fen: QUEEN_HOME }],
    },
    {
      id: 'olive',
      bands: C,
      bot: 'olive',
      mission: 'win',
      say: 'The Crown. Beat Olive to graduate.',
      ease: [{ bot: 'olive', fen: KNIGHT_HOME }, { bot: 'fern' }, { bot: 'tuck', fen: QUEEN_HOME }, { bot: 'shelly', fen: QUEEN_HOME }],
    },
  ] satisfies Game[],
};

// ---------- Playground ----------
/** Where each buddy opens in the Playground (the Playground itself opens after Rank 5). */
const BUDDY_UNLOCK: Record<BuddyId, { bands: AgeBand[]; node?: string }> = {
  shelly: { bands: ['sprout', 'explorer', 'champion'] },
  hop: { bands: ['sprout', 'explorer', 'champion'], node: 'w7-armies' },
  tuck: { bands: ['sprout', 'explorer', 'champion'], node: 'w7-boss' },
  fern: { bands: ['explorer', 'champion'], node: 'w8-golden-rules' },
  olive: { bands: ['explorer', 'champion'], node: 'w8-buddy-ladder' },
  bruno: { bands: ['champion'], node: 'w8-buddy-ladder' },
  ember: { bands: ['champion'], node: 'w8-crown' },
};

const PLAYGROUND: PlaygroundEntry[] = [
  ...(Object.keys(BUDDY_UNLOCK) as BuddyId[]).map(
    (b): PlaygroundEntry => ({
      id: `buddy-${b}`,
      title: `Play ${BUDDIES[b].name}`,
      icon: 'swords',
      activity: 'play-bot',
      item: { bot: b, mission: 'win' } satisfies PlayBotItem,
      bands: BUDDY_UNLOCK[b].bands,
      unlock: BUDDY_UNLOCK[b].node ? { node: BUDDY_UNLOCK[b].node } : undefined,
    }),
  ),
  { id: 'friend-chess', title: 'Play a friend', icon: 'heart', activity: 'play-bot', item: { bot: 'shelly', mission: 'win' } satisfies PlayBotItem, friend: true },
];

export const buddiesPack: KidsPack = {
  id: 'buddies',
  activities: [playBotActivity],
  levelSets: [W7_ARMIES, W7_BOSS, W8_GOLDEN_RULES, W8_BUDDY_LADDER, W8_CROWN],
  playground: PLAYGROUND,
};
