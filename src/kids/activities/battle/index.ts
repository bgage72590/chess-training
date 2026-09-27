import type { ActivityDef } from '../types';
import { Battle } from './Battle';
import { validateBattle, type BattleItem } from './logic';

export type { BattleItem } from './logic';

export const battleActivity: ActivityDef<BattleItem> = {
  id: 'battle',
  title: 'Pawn Wars',
  icon: 'swords',
  Component: Battle,
  validate: validateBattle,
  game: true,
};
