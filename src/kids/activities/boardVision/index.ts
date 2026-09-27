import type { ActivityDef } from '../types';
import { BoardVision } from './BoardVision';
import { reviewBoardVision, validateBoardVision, type BoardVisionItem } from './logic';

export const boardVisionActivity: ActivityDef<BoardVisionItem> = {
  id: 'board-vision',
  title: 'Board Explorer',
  icon: 'map',
  Component: BoardVision,
  validate: validateBoardVision,
  review: reviewBoardVision,
};
