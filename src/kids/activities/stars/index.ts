import type { ActivityDef } from '../types';
import { StarCollector } from './StarCollector';
import { reviewStars, validateStars, type StarItem } from './logic';

export const starsActivity: ActivityDef<StarItem> = {
  id: 'stars',
  title: 'Star Collector',
  icon: 'star',
  Component: StarCollector,
  validate: validateStars,
  review: reviewStars,
};
