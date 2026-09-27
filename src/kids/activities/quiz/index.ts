import type { ActivityDef } from '../types';
import { Quiz } from './Quiz';
import { validateQuiz, type QuizItem } from './logic';

export type { QuizItem } from './logic';

export const quizActivity: ActivityDef<QuizItem> = {
  id: 'quiz',
  title: "What's Happening?",
  icon: 'eye',
  Component: Quiz,
  validate: validateQuiz,
};
