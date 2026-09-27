import type { ActivityDef } from '../types';
import { FindMove } from './FindMove';
import { validateFindMove, type FindMoveItem } from './logic';

export { FindMove };
export type { FindMoveItem, Goal } from './logic';

export const findMoveActivity: ActivityDef<FindMoveItem> = {
  id: 'find-move',
  title: 'Find the Move',
  icon: 'eye',
  Component: FindMove,
  validate: validateFindMove,
};
