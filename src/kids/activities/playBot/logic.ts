// Play-a-buddy items and validation (spec 13.12).
import { Chess } from 'chess.js';
import type { AgeBand } from '../types';
import { BAND_BUDDIES, BUDDIES, type BuddyId } from '../../curriculum/buddies';
import type { Mission } from './missions';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/** Handicaps (the buddy's pieces stay at home). */
export const KNIGHT_HOME = 'r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const QUEEN_HOME = 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const QUEEN_ROOK_HOME = 'rnb1kbn1/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQq - 0 1';

/** Friend games: an optional handicap for the White player (the stronger friend). */
export const FRIEND_HANDICAPS: { id: string; label: string; fen: string }[] = [
  { id: 'none', label: 'Fair game', fen: START_FEN },
  { id: 'queen', label: 'White gives the queen', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1' },
  { id: 'rook', label: 'White gives a rook', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1 w Qkq - 0 1' },
  { id: 'knight', label: 'White gives a knight', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKB1R w KQkq - 0 1' },
];

export interface PlayBotItem {
  bot: BuddyId;
  fen?: string;
  kidColor?: 'w' | 'b';
  mission: Mission;
}

const MISSIONS: Mission[] = ['win', 'promote', 'no-hang', 'develop'];

export function validatePlayBot(item: PlayBotItem, band: AgeBand): string[] {
  const errs: string[] = [];
  if (!BUDDIES[item.bot]) errs.push(`unknown buddy ${item.bot}`);
  else if (!BAND_BUDDIES[band].includes(item.bot)) errs.push(`${item.bot} is not on the ${band} ladder`);
  if (!MISSIONS.includes(item.mission)) errs.push(`unknown mission ${item.mission}`);
  let c: Chess | null = null;
  try {
    c = new Chess(item.fen ?? START_FEN);
  } catch {
    errs.push('fen does not load');
  }
  if (c) {
    if (c.isGameOver()) errs.push('game already over');
    if (item.mission === 'develop' && (item.fen ?? START_FEN) !== START_FEN && item.fen !== QUEEN_HOME && item.fen !== KNIGHT_HOME) errs.push('develop needs a full army');
  }
  if (item.kidColor && item.kidColor !== 'w' && item.kidColor !== 'b') errs.push('bad kidColor');
  return errs;
}
