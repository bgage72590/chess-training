import type { ActivityDef } from '../types';
import { Gobble } from './Gobble';
import { reviewGobble, validateGobble, type GobbleItem } from './logic';

export const gobbleActivity: ActivityDef<GobbleItem> = {
  id: 'gobble',
  title: 'Gobble!',
  icon: 'candy',
  Component: Gobble,
  validate: validateGobble,
  review: reviewGobble,
};
