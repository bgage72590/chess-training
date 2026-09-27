import type { ActivityDef } from '../types';
import { Memory } from './Memory';
import { reviewMemory, validateMemory, type MemoryItem } from './logic';

export const memoryActivity: ActivityDef<MemoryItem> = {
  id: 'memory',
  title: 'Magic Memory',
  icon: 'eye',
  Component: Memory,
  validate: validateMemory,
  review: reviewMemory,
};
