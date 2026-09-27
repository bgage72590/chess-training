import type { ActivityDef } from '../types';
import { CaptureCrown } from './CaptureCrown';
import { validateCrown, type CrownItem } from './logic';

export type { CrownItem } from './logic';

export const captureCrownActivity: ActivityDef<CrownItem> = {
  id: 'capture-crown',
  title: 'Capture the Crown',
  icon: 'crown',
  Component: CaptureCrown,
  validate: validateCrown,
  game: true,
};
