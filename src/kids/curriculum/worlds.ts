// The whole Kids course: 8 worlds (the ranks of the board) and every node, including nodes
// whose level sets come from packs. Packs never edit this file. Spec section 4.
import type { AgeBand, PieceCode } from '../activities/types';
import type { SkillId } from './skills';

export type WorldId = 'w1' | 'w2' | 'w3' | 'w4' | 'w5' | 'w6' | 'w7' | 'w8';
export type Owner = 'F' | 'A' | 'B' | 'C' | 'D' | 'E';
export type WorldScene = 'towers' | 'woods' | 'garden' | 'hills' | 'parade' | 'cove' | 'mountain' | 'tower';

export interface WorldDef {
  id: WorldId;
  rank: number;
  title: string;
  bg: string;
  accent: string;
  scene: WorldScene;
  /** Pip's one-line world intro (spoken on the first visit). */
  intro: string;
  /** Grown-up coaching tip for kids currently in this world. */
  tip: string;
  /** The main piece of the world (map and sticker art). */
  piece: PieceCode;
}

export interface NodeDef {
  id: string;
  world: WorldId;
  title: string;
  activity: string;
  owner: Owner;
  bands: AgeBand[];
  bonus?: boolean;
  boss?: boolean;
  /** The final boss (w8-crown): cannot be skipped. */
  final?: boolean;
  /** Game activities pass on a win (battle, capture-crown, play-bot). */
  game?: boolean;
  skills: SkillId[];
  /** Piece shown on the node bubble. */
  piece?: PieceCode;
  /** One-line fact spoken when the kid taps the earned sticker. */
  fact: string;
}

export const WORLDS: WorldDef[] = [
  { id: 'w1', rank: 1, title: 'Rook Road', bg: '#dbeefe', accent: '#3f86c6', scene: 'towers', piece: 'R', intro: 'Welcome to Rook Road! Rooks zoom in straight lines.', tip: 'Ask your kid to show you how the rook moves on a real board: straight lines, any distance.' },
  { id: 'w2', rank: 2, title: 'Bishop Woods', bg: '#dcefd0', accent: '#3f8f4f', scene: 'woods', piece: 'B', intro: 'Bishop Woods! Bishops slide on slanty paths.', tip: 'Point out that a bishop always stays on the same color square.' },
  { id: 'w3', rank: 3, title: 'Royal Garden', bg: '#fbe0ef', accent: '#c2477f', scene: 'garden', piece: 'Q', intro: 'The Royal Garden! Meet the queen and the king.', tip: 'Play "the floor is lava": the king may never step where he can be taken.' },
  { id: 'w4', rank: 4, title: 'Knight Hills', bg: '#efe3cc', accent: '#a86b2d', scene: 'hills', piece: 'N', intro: "Knight Hills! That's me. Two steps and a turn!", tip: 'Hop a knight around a real board together and count the jumps.' },
  { id: 'w5', rank: 5, title: 'Pawn Parade', bg: '#fff1c2', accent: '#c18a00', scene: 'parade', piece: 'P', intro: 'Pawn Parade! Little pawns march forward.', tip: 'Play Pawn Wars together on a real board!' },
  { id: 'w6', rank: 6, title: 'Capture Cove', bg: '#d4f1ef', accent: '#1f8a84', scene: 'cove', piece: 'N', intro: 'Capture Cove! Time to gobble snacks, safely.', tip: 'Before each move, ask: "Is my piece safe there?"' },
  { id: 'w7', rank: 7, title: 'Check Mountain', bg: '#e6e9fb', accent: '#5a63c9', scene: 'mountain', piece: 'K', intro: 'Check Mountain! The king is in trouble when he stands in lava.', tip: 'Say "check" out loud together whenever a king is attacked.' },
  { id: 'w8', rank: 8, title: 'Crown Tower', bg: '#fde7b8', accent: '#b07a12', scene: 'tower', piece: 'Q', intro: 'Crown Tower! At the top, your pawn becomes royal.', tip: 'Play full games together, and let your kid take back one move each game.' },
];

const SEC: AgeBand[] = ['sprout', 'explorer', 'champion'];
const SE: AgeBand[] = ['sprout', 'explorer'];
const EC: AgeBand[] = ['explorer', 'champion'];
const C: AgeBand[] = ['champion'];

type N = Omit<NodeDef, 'world' | 'bands'> & { bands?: AgeBand[] };
const w = (world: WorldId, nodes: N[]): NodeDef[] => nodes.map((n) => ({ ...n, world, bands: n.bands ?? SEC }));

export const NODES: NodeDef[] = [
  ...w('w1', [
    { id: 'w1-hello', title: 'Hello, Rook!', activity: 'stars', owner: 'F', skills: ['move-rook'], piece: 'R', fact: 'Rooks move in straight lines, like a train on tracks!' },
    { id: 'w1-rook-stars', title: 'Rook Road', activity: 'stars', owner: 'F', skills: ['move-rook'], piece: 'R', fact: "A rook can zoom all the way across the board, but it can't jump!" },
    { id: 'w1-rook-paint', title: 'Where can Rook go?', activity: 'paint', owner: 'A', skills: ['move-rook'], piece: 'R', fact: 'A rook in the middle of an empty board can reach 14 squares!' },
    { id: 'w1-roads', title: 'Light up the road', activity: 'board-vision', owner: 'A', skills: ['board-lines'], fact: 'Up-and-down lines are files. Side-to-side lines are ranks.' },
    { id: 'w1-rook-gobble', title: "Rook's Lunch", activity: 'gobble', owner: 'A', skills: ['move-rook', 'capture'], piece: 'R', fact: 'Rooks capture the same way they move.' },
    { id: 'w1-colors', title: 'Light and dark', activity: 'board-vision', owner: 'A', bands: SE, bonus: true, skills: ['board-colors'], fact: 'The board has 32 light squares and 32 dark squares.' },
    { id: 'w1-boss', title: 'Rook Maze', activity: 'stars', owner: 'F', boss: true, skills: ['move-rook'], piece: 'R', fact: 'You beat the Rook Maze! Rooks love open roads.' },
  ]),
  ...w('w2', [
    { id: 'w2-bishop-stars', title: 'Bishop Slide', activity: 'stars', owner: 'F', skills: ['move-bishop'], piece: 'B', fact: 'Bishops slide on slanty lines called diagonals.' },
    { id: 'w2-bishop-paint', title: 'Where can Bishop go?', activity: 'paint', owner: 'A', skills: ['move-bishop'], piece: 'B', fact: 'A bishop can never change the color of its square.' },
    { id: 'w2-bishop-color', title: 'Bishop stays on her color', activity: 'quiz', owner: 'C', skills: ['move-bishop'], piece: 'B', fact: 'Each player has one light-square bishop and one dark-square bishop.' },
    { id: 'w2-bishop-gobble', title: "Bishop's Lunch", activity: 'gobble', owner: 'A', skills: ['move-bishop', 'capture'], piece: 'B', fact: 'Bishops are worth about 3 pawns.' },
    { id: 'w2-treasure-map', title: 'Treasure map', activity: 'board-vision', owner: 'A', bands: EC, skills: ['square-names'], fact: 'Every square has a name, like e4: the file letter, then the rank number.' },
    { id: 'w2-boss', title: 'Two Friends', activity: 'stars', owner: 'F', boss: true, skills: ['move-rook', 'move-bishop'], piece: 'B', fact: 'Rook and bishop make a great team!' },
  ]),
  ...w('w3', [
    { id: 'w3-queen-stars', title: 'Queen Zoom', activity: 'stars', owner: 'F', skills: ['move-queen'], piece: 'Q', fact: 'The queen moves like a rook and a bishop together!' },
    { id: 'w3-queen-paint', title: 'Where can Queen go?', activity: 'paint', owner: 'A', bands: EC, skills: ['move-queen'], piece: 'Q', fact: 'The queen is the strongest piece on the board.' },
    { id: 'w3-queen-gobble', title: "Queen's Feast", activity: 'gobble', owner: 'A', skills: ['move-queen', 'capture'], piece: 'Q', fact: 'A queen is worth about 9 pawns.' },
    { id: 'w3-king-stars', title: "King's Tiny Steps", activity: 'stars', owner: 'F', skills: ['move-king'], piece: 'K', fact: 'The king takes one small step in any direction.' },
    { id: 'w3-king-lava', title: 'The Floor is Lava!', activity: 'stars', owner: 'F', skills: ['move-king', 'safety'], piece: 'K', fact: 'The king never steps where he can be taken.' },
    { id: 'w3-boss', title: 'Royal Garden', activity: 'stars', owner: 'F', boss: true, skills: ['move-queen', 'move-king', 'safety'], piece: 'Q', fact: 'You crossed the Royal Garden without touching the lava!' },
  ]),
  ...w('w4', [
    { id: 'w4-knight-hops', title: "Pip's Hops", activity: 'stars', owner: 'F', skills: ['move-knight'], piece: 'N', fact: 'Knights hop: two steps and a turn!' },
    { id: 'w4-knight-paint', title: 'Where can Knight go?', activity: 'paint', owner: 'A', skills: ['move-knight'], piece: 'N', fact: 'A knight in the corner has only 2 squares to hop to.' },
    { id: 'w4-knight-count', title: 'Count the hops', activity: 'quiz', owner: 'C', bands: EC, skills: ['move-knight'], piece: 'N', fact: 'A knight in the middle can hop to 8 squares!' },
    { id: 'w4-knight-jump', title: 'Jump the rocks', activity: 'stars', owner: 'F', skills: ['move-knight'], piece: 'N', fact: 'The knight is the only piece that can jump over others.' },
    { id: 'w4-knight-gobble', title: "Knight's Lunch", activity: 'gobble', owner: 'A', skills: ['move-knight', 'capture'], piece: 'N', fact: 'Every knight hop lands on the other color.' },
    { id: 'w4-boss', title: 'Knight Trek', activity: 'stars', owner: 'F', boss: true, skills: ['move-knight'], piece: 'N', fact: 'A knight can visit every square of the board!' },
  ]),
  ...w('w5', [
    { id: 'w5-pawn-steps', title: 'Pawn Steps', activity: 'stars', owner: 'F', skills: ['move-pawn'], piece: 'P', fact: 'On its very first move, a pawn may take two steps.' },
    { id: 'w5-pawn-slant', title: 'Straight to walk, slanty to eat', activity: 'gobble', owner: 'A', skills: ['move-pawn', 'capture'], piece: 'P', fact: 'Pawns walk straight but eat slanty!' },
    { id: 'w5-promo', title: 'Pawn becomes a Queen!', activity: 'stars', owner: 'F', skills: ['move-pawn', 'promotion'], piece: 'P', fact: 'A pawn that reaches the far side becomes a queen!' },
    { id: 'w5-pawn-war-mini', title: 'Little Pawn War', activity: 'battle', owner: 'B', game: true, skills: ['move-pawn', 'play'], piece: 'P', fact: 'Pawns work best as a team.' },
    { id: 'w5-army', title: 'Meet the whole army', activity: 'board-vision', owner: 'A', skills: ['setup'], fact: 'Each army has 16 pieces: 8 pawns and 8 big pieces.' },
    { id: 'w5-setup', title: 'Set up the board', activity: 'board-vision', owner: 'A', skills: ['setup'], fact: 'The queen starts on her own color!' },
    { id: 'w5-boss', title: 'Pawn War', activity: 'battle', owner: 'B', boss: true, game: true, skills: ['move-pawn', 'play'], piece: 'P', fact: 'You won the Pawn War!' },
  ]),
  ...w('w6', [
    { id: 'w6-candy', title: 'Candy values', activity: 'quiz', owner: 'C', skills: ['values'], fact: 'Pawn 1, knight 3, bishop 3, rook 5, queen 9!' },
    { id: 'w6-free-lunch', title: 'Free lunch!', activity: 'find-move', owner: 'F', skills: ['capture'], piece: 'R', fact: 'A piece nobody guards is a free lunch!' },
    { id: 'w6-lava', title: 'Lava everywhere', activity: 'stars', owner: 'F', skills: ['safety'], piece: 'Q', fact: 'Every piece makes lava where it could capture.' },
    { id: 'w6-bite', title: 'Snacks bite back', activity: 'gobble', owner: 'A', bands: EC, skills: ['capture', 'safety', 'protect'], fact: 'A guarded snack can bite back!' },
    { id: 'w6-protect', title: 'Guard your friend', activity: 'find-move', owner: 'C', bands: EC, skills: ['protect'], fact: 'Friends guard friends.' },
    { id: 'w6-trade', title: 'Good trade?', activity: 'quiz', owner: 'C', bands: EC, skills: ['values'], fact: 'Trading a knight for a rook is a good deal!' },
    { id: 'w6-battles', title: 'Mini battles', activity: 'battle', owner: 'B', game: true, skills: ['capture', 'play'], fact: 'A queen can stop eight pawns!' },
    { id: 'w6-crown-game', title: 'Capture the Crown', activity: 'capture-crown', owner: 'B', game: true, skills: ['play', 'safety'], piece: 'K', fact: 'Keep your king safe from danger!' },
    { id: 'w6-boss', title: 'Snack Attack', activity: 'find-move', owner: 'F', boss: true, skills: ['capture', 'safety', 'protect'], piece: 'N', fact: 'You are a snack expert!' },
  ]),
  ...w('w7', [
    { id: 'w7-check', title: 'Check!', activity: 'find-move', owner: 'F', skills: ['check'], piece: 'R', fact: 'Check means the king is standing in lava!' },
    { id: 'w7-spot-check', title: 'Is the king in trouble?', activity: 'quiz', owner: 'C', skills: ['check'], piece: 'K', fact: 'Always look: is my king in check?' },
    { id: 'w7-escape', title: 'Run, Block, Capture', activity: 'find-move', owner: 'C', skills: ['escape'], piece: 'K', fact: 'There are three ways out of check: run, block or capture.' },
    { id: 'w7-mate1', title: 'Checkmate!', activity: 'find-move', owner: 'F', skills: ['mate1'], piece: 'Q', fact: "Checkmate: the king is in check and can't escape!" },
    { id: 'w7-mate-or-not', title: 'Detective Pip', activity: 'quiz', owner: 'C', bands: EC, skills: ['check', 'mate1', 'stalemate'], fact: 'Stalemate is a tie: no moves, but no check.' },
    { id: 'w7-stalemate', title: 'Mate, not stalemate', activity: 'quiz', owner: 'C', bands: EC, skills: ['stalemate'], fact: 'Leave the king a square, or give check!' },
    { id: 'w7-castle', title: 'Castle time', activity: 'quiz', owner: 'C', skills: ['castle'], piece: 'K', fact: 'Castling tucks the king safely into the corner.' },
    { id: 'w7-en-passant', title: 'Sneaky pawn trick', activity: 'find-move', owner: 'C', bands: EC, skills: ['en-passant'], piece: 'P', fact: 'En passant means "in passing" in French.' },
    { id: 'w7-armies', title: 'Mini armies', activity: 'play-bot', owner: 'D', game: true, skills: ['play'], fact: 'Little armies, big battles!' },
    { id: 'w7-boss', title: 'First real game', activity: 'play-bot', owner: 'D', boss: true, game: true, skills: ['play', 'mate1'], fact: 'You played a real game of chess!' },
  ]),
  ...w('w8', [
    { id: 'w8-golden-rules', title: 'Golden Rules', activity: 'play-bot', owner: 'D', bands: EC, game: true, skills: ['develop'], fact: 'Center pawns, knights out, bishops out, castle!' },
    { id: 'w8-mate-hunt', title: 'Mate Hunt', activity: 'puzzles', owner: 'E', skills: ['mate1'], piece: 'Q', fact: 'Look for checks first: one might be mate!' },
    { id: 'w8-ladder', title: 'Rook Ladder', activity: 'mate-drill', owner: 'C', skills: ['mate-ladder'], piece: 'R', fact: 'Two rooks climb the ladder to checkmate.' },
    { id: 'w8-box', title: 'Queen Box', activity: 'mate-drill', owner: 'C', bands: EC, skills: ['mate-box'], piece: 'Q', fact: 'Make the box smaller and smaller!' },
    { id: 'w8-rook-mate', title: 'Rook alone', activity: 'mate-drill', owner: 'C', bands: C, skills: ['mate-rook'], piece: 'R', fact: 'King and rook can checkmate a lone king.' },
    { id: 'w8-forks', title: 'Family forks', activity: 'puzzles', owner: 'E', bands: EC, skills: ['forks'], piece: 'N', fact: 'A fork attacks two pieces at once!' },
    { id: 'w8-pins', title: 'Pins', activity: 'puzzles', owner: 'E', bands: C, skills: ['pins'], piece: 'B', fact: 'A pinned piece is stuck in place.' },
    { id: 'w8-threats', title: 'What does Tuck want?', activity: 'find-move', owner: 'E', bands: EC, skills: ['threats', 'safety'], fact: 'Always ask: what does my opponent want?' },
    { id: 'w8-buddy-ladder', title: 'Buddy Ladder', activity: 'play-bot', owner: 'D', game: true, skills: ['play'], fact: 'Every buddy you play makes you stronger.' },
    { id: 'w8-crown', title: 'The Crown', activity: 'play-bot', owner: 'D', boss: true, final: true, game: true, skills: ['play', 'mate1'], piece: 'K', fact: 'You earned your crown!' },
  ]),
];

export const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));
export const WORLD_BY_ID = new Map(WORLDS.map((wd) => [wd.id, wd]));

export const nodesOf = (world: WorldId) => NODES.filter((n) => n.world === world);
export const bossOf = (world: WorldId) => NODES.find((n) => n.world === world && n.boss);
export const worldIndex = (world: WorldId) => WORLDS.findIndex((x) => x.id === world);

export const GAME_ACTIVITIES = new Set(['battle', 'capture-crown', 'play-bot']);
