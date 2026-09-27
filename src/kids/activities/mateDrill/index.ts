import type { ActivityDef } from '../types';
import { MateDrill } from './MateDrill';
import { validateMateDrill, type MateDrillItem } from './logic';

export type { MateDrillItem } from './logic';

export const mateDrillActivity: ActivityDef<MateDrillItem> = {
  id: 'mate-drill',
  title: 'Checkmate Drills',
  icon: 'crown',
  Component: MateDrill,
  validate: validateMateDrill,
};
