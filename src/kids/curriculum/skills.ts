// Skills practiced by nodes, with the "can do" statements shown in the grown-up report.

export type SkillId =
  | 'move-rook'
  | 'move-bishop'
  | 'move-queen'
  | 'move-king'
  | 'move-knight'
  | 'move-pawn'
  | 'board-colors'
  | 'board-lines'
  | 'square-names'
  | 'setup'
  | 'capture'
  | 'safety'
  | 'values'
  | 'protect'
  | 'check'
  | 'escape'
  | 'mate1'
  | 'stalemate'
  | 'castle'
  | 'en-passant'
  | 'promotion'
  | 'mate-ladder'
  | 'mate-box'
  | 'mate-rook'
  | 'forks'
  | 'pins'
  | 'threats'
  | 'play'
  | 'develop';

export const SKILLS: Record<SkillId, string> = {
  'move-rook': 'Moves the rook correctly',
  'move-bishop': 'Moves the bishop correctly',
  'move-queen': 'Moves the queen correctly',
  'move-king': 'Moves the king correctly',
  'move-knight': 'Moves the knight correctly',
  'move-pawn': 'Moves pawns correctly',
  'board-colors': 'Knows light and dark squares',
  'board-lines': 'Sees files and ranks',
  'square-names': 'Knows square names',
  setup: 'Sets up the board',
  capture: 'Captures pieces',
  safety: 'Keeps pieces safe',
  values: 'Knows what pieces are worth',
  protect: 'Protects a piece in danger',
  check: 'Spots checks',
  escape: 'Gets out of check',
  mate1: 'Checkmates in one',
  stalemate: 'Knows checkmate from stalemate',
  castle: 'Castles',
  'en-passant': 'Knows en passant',
  promotion: 'Promotes a pawn',
  'mate-ladder': 'Checkmates with two rooks',
  'mate-box': 'Checkmates with K+Q',
  'mate-rook': 'Checkmates with K+R',
  forks: 'Finds forks',
  pins: 'Finds pins',
  threats: 'Spots what the opponent wants',
  play: 'Plays a whole game',
  develop: 'Develops pieces in the opening',
};
