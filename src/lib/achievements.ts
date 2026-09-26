import type { Profile } from '../store/profile';
import { liveStreak, playerWon } from '../store/profile';
import { MASTERED_BOX } from './srs';
import { units } from '../content';

export interface Achievement {
  id: string;
  title: string;
  text: string;
  icon: string;
  test: (p: Profile) => boolean;
}

const lessonsDone = (p: Profile) => Object.values(p.lessons).filter((l) => l.done).length;
const drillsDone = (p: Profile) => Object.values(p.drills).filter((d) => d.done).length;
const wins = (p: Profile, minLevel = 1) =>
  p.games.filter((g) => g.level >= minLevel && playerWon(g)).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-lesson', title: 'First Lesson', text: 'Complete a lesson.', icon: 'learn', test: (p) => lessonsDone(p) >= 1 },
  { id: 'ten-lessons', title: 'Student of the Game', text: 'Complete 10 lessons.', icon: 'learn', test: (p) => lessonsDone(p) >= 10 },
  {
    id: 'unit-complete',
    title: 'Unit Cleared',
    text: 'Finish every lesson in a unit.',
    icon: 'trophy',
    test: (p) => units.some((u) => u.lessons.length > 0 && u.lessons.every((l) => p.lessons[l.id]?.done)),
  },
  { id: 'first-puzzle', title: 'First Tactic', text: 'Solve a puzzle.', icon: 'puzzle', test: (p) => p.puzzles.solved >= 1 },
  { id: 'hundred-puzzles', title: 'Pattern Bank', text: 'Solve 100 puzzles.', icon: 'puzzle', test: (p) => p.puzzles.solved >= 100 },
  { id: 'puzzle-1200', title: 'Sharp Eye', text: 'Reach a 1200 puzzle rating.', icon: 'target', test: (p) => p.puzzles.rating >= 1200 },
  { id: 'puzzle-1500', title: 'Tactician', text: 'Reach a 1500 puzzle rating.', icon: 'target', test: (p) => p.puzzles.rating >= 1500 },
  { id: 'puzzle-1800', title: 'Combination Artist', text: 'Reach an 1800 puzzle rating.', icon: 'target', test: (p) => p.puzzles.rating >= 1800 },
  { id: 'puzzle-2100', title: 'Calculator', text: 'Reach a 2100 puzzle rating.', icon: 'target', test: (p) => p.puzzles.rating >= 2100 },
  { id: 'rush-15', title: 'Rush Hour', text: 'Score 15 in Puzzle Rush.', icon: 'clock', test: (p) => p.puzzles.rushBest >= 15 },
  { id: 'rush-30', title: 'Speed Demon', text: 'Score 30 in Puzzle Rush.', icon: 'clock', test: (p) => p.puzzles.rushBest >= 30 },
  { id: 'streak-3', title: 'Habit Forming', text: 'Train three days in a row.', icon: 'flame', test: (p) => liveStreak(p) >= 3 || p.streak.best >= 3 },
  { id: 'streak-7', title: 'Full Week', text: 'Train seven days in a row.', icon: 'flame', test: (p) => p.streak.best >= 7 },
  { id: 'streak-30', title: 'Iron Discipline', text: 'Train thirty days in a row.', icon: 'flame', test: (p) => p.streak.best >= 30 },
  { id: 'lines-10', title: 'Repertoire Builder', text: 'Learn 10 opening lines.', icon: 'openings', test: (p) => Object.keys(p.lines).length >= 10 },
  { id: 'line-mastered', title: 'Memorised', text: 'Master an opening line through spaced review.', icon: 'openings', test: (p) => Object.values(p.lines).some((l) => l.box >= MASTERED_BOX) },
  { id: 'drills-5', title: 'Technician', text: 'Complete five endgame drills.', icon: 'endgames', test: (p) => drillsDone(p) >= 5 },
  { id: 'first-win', title: 'First Victory', text: 'Beat the coach at any level.', icon: 'play', test: (p) => wins(p) >= 1 },
  { id: 'giant-slayer', title: 'Giant Slayer', text: 'Beat the coach at level 6 or higher.', icon: 'swords', test: (p) => wins(p, 6) >= 1 },
  { id: 'accurate', title: 'Clean Game', text: 'Play a reviewed game with 90% accuracy.', icon: 'star', test: (p) => p.games.some((g) => (g.review?.accuracy[g.playerColor] ?? 0) >= 90) },
  { id: 'vision-25', title: 'Board Sight', text: 'Name 25 squares in one coordinate sprint.', icon: 'vision', test: (p) => Object.entries(p.vision).some(([k, v]) => k.startsWith('coords') && v >= 25) },
];
