import raw from './puzzles.json';

export interface Puzzle {
  id: string;
  /** Position before the opponent's last move. */
  fen: string;
  /** UCI moves: the opponent's move, then solver / reply / solver ... */
  moves: string;
  rating: number;
  themes: string[];
  /** Engine continuation after the solution (UCI). */
  cont?: string;
}

export const puzzles: Puzzle[] = raw as Puzzle[];
export const puzzleById = new Map(puzzles.map((p) => [p.id, p]));

/** Themes shown to learners, with plain-language names and explanations. */
export const THEMES: Record<string, { name: string; text: string }> = {
  mate: { name: 'Checkmate', text: 'Finish the game.' },
  mateIn1: { name: 'Mate in 1', text: 'One move ends it.' },
  mateIn2: { name: 'Mate in 2', text: 'A forcing two-move finish.' },
  mateIn3: { name: 'Mate in 3', text: 'Three-move mating combinations.' },
  mateIn4: { name: 'Mate in 4', text: 'Long forced mates.' },
  mateIn5: { name: 'Mate in 5', text: 'The longest forced mates in the set.' },
  backRankMate: { name: 'Back-rank mate', text: 'The king is trapped by its own pawns.' },
  smotheredMate: { name: 'Smothered mate', text: 'A knight mates a boxed-in king.' },
  fork: { name: 'Fork', text: 'One piece attacks two targets.' },
  pin: { name: 'Pin', text: 'A piece cannot move without exposing something bigger.' },
  skewer: { name: 'Skewer', text: 'Attack the big piece, win the one behind it.' },
  discoveredAttack: { name: 'Discovered attack', text: 'Move one piece to unleash another.' },
  discoveredCheck: { name: 'Discovered check', text: 'Unmask a check and gain a free move.' },
  doubleCheck: { name: 'Double check', text: 'Two checks at once: only the king can move.' },
  removeDefender: { name: 'Remove the defender', text: 'Capture the guard, then the target.' },
  attraction: { name: 'Attraction', text: 'Lure the king onto a fatal square.' },
  sacrifice: { name: 'Sacrifice', text: 'Give material to get more back.' },
  hangingPiece: { name: 'Hanging piece', text: 'Punish an undefended piece.' },
  promotion: { name: 'Promotion', text: 'Queen a pawn.' },
  underPromotion: { name: 'Underpromotion', text: 'Promote to a knight, rook or bishop.' },
  quietMove: { name: 'Quiet move', text: 'The winning move is not a check or capture.' },
  enPassant: { name: 'En passant', text: 'The special pawn capture.' },
  opening: { name: 'Opening', text: 'Tactics in the first moves.' },
  middlegame: { name: 'Middlegame', text: 'Tactics with many pieces on the board.' },
  endgame: { name: 'Endgame', text: 'Tactics with few pieces left.' },
  oneMove: { name: 'One move', text: 'Find a single winning move.' },
  short: { name: 'Two moves', text: 'A two-move combination.' },
  long: { name: 'Three moves', text: 'A three-move combination.' },
  veryLong: { name: 'Four+ moves', text: 'Deep calculation.' },
};

/** Themes offered as practice filters (in display order). */
export const PRACTICE_THEMES = [
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'backRankMate',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'doubleCheck',
  'removeDefender',
  'attraction',
  'sacrifice',
  'hangingPiece',
  'promotion',
  'quietMove',
  'opening',
  'middlegame',
  'endgame',
  'long',
];
