import type { ActivityDef } from '../types';
import { Paint } from './Paint';
import { reviewPaint, validatePaint, type PaintItem } from './logic';

export const paintActivity: ActivityDef<PaintItem> = {
  id: 'paint',
  title: 'Paint the Moves',
  icon: 'dots',
  Component: Paint,
  validate: validatePaint,
  review: reviewPaint,
};
