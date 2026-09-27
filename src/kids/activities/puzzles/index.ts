import type { ActivityDef } from '../types';
import { Puzzles } from './Puzzles';
import { validatePuzzles, type PuzzleItem } from './logic';

export type { PuzzleItem } from './logic';

export const puzzlesActivity: ActivityDef<PuzzleItem> = {
  id: 'puzzles',
  title: 'Puzzle Path',
  icon: 'puzzle',
  Component: Puzzles,
  validate: validatePuzzles,
};
