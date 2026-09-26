// Content schema for Tempo's curriculum, opening repertoire and endgame drills.
// Every FEN and move in content files is checked by `npm run validate:content`
// (legality via chess.js, soundness via Stockfish).

export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type Orientation = 'white' | 'black';
export type MarkColor = 'green' | 'red' | 'blue' | 'yellow';

/** Arrow drawn on the board, squares in algebraic notation ("e2"). */
export interface Arrow {
  from: string;
  to: string;
  color?: MarkColor;
}

/** Highlighted square (drawn as a ring). */
export interface Mark {
  square: string;
  color?: MarkColor;
}

interface StepBase {
  /** Short heading shown above the text. */
  title?: string;
  /**
   * Explanation. Supports **bold** and `code` inline markup, blank lines between paragraphs,
   * and lines starting with "- " as bullet lists.
   */
  text: string;
  /** Board orientation. Defaults to the side to move for interactive steps, white otherwise. */
  orientation?: Orientation;
  arrows?: Arrow[];
  marks?: Mark[];
}

/** Explanation with an optional static diagram. */
export interface ReadStep extends StepBase {
  kind: 'read';
  fen?: string;
  /** Highlight a move that was just played, e.g. ["e2", "e4"]. */
  lastMove?: [string, string];
}

/**
 * Interactive "find the move" step. The learner plays the side to move in `fen`.
 * `solution` is a SAN line that starts and ends with the learner's move and alternates
 * learner move / opponent reply (the app plays the replies automatically).
 * Any move that delivers checkmate is always accepted.
 */
export interface MoveStep extends StepBase {
  kind: 'move';
  fen: string;
  solution: string[];
  /** Extra SAN moves accepted in place of solution[0]. Only allowed when solution has length 1. */
  accept?: string[];
  /** Nudge shown after a wrong try or on request. */
  hint: string;
  /** Shown after the learner completes the line. */
  success: string;
}

/** Multiple choice question, optionally about a diagram. Exactly one choice is correct. */
export interface QuizStep extends StepBase {
  kind: 'quiz';
  fen?: string;
  choices: { text: string; correct?: boolean; why: string }[];
}

/**
 * Guided replay: the learner steps through `moves` (SAN) from `fen`,
 * reading `notes[i]` after move i is played. notes may be shorter than moves.
 */
export interface DemoStep extends StepBase {
  kind: 'demo';
  fen: string;
  moves: string[];
  notes?: string[];
}

export type LessonStep = ReadStep | MoveStep | QuizStep | DemoStep;

export interface Lesson {
  /** Globally unique, kebab-case. */
  id: string;
  title: string;
  /** One sentence shown on the lesson card. */
  summary: string;
  /** Estimated minutes to complete. */
  minutes: number;
  steps: LessonStep[];
}

export interface Unit {
  id: string;
  title: string;
  /** One line describing what the unit gives the learner. */
  tagline: string;
  level: Level;
  lessons: Lesson[];
}

/** One line of an opening, played from the initial position. */
export interface OpeningLine {
  /** Globally unique, kebab-case. */
  id: string;
  /** e.g. "Main line: 4.c3 Nf6 5.d4" */
  name: string;
  /** SAN moves separated by spaces, no move numbers: "e4 e5 Nf3 Nc6 Bc4". */
  moves: string;
  /**
   * Explanations keyed by ply number (1 = White's first move, 2 = Black's first move, ...).
   * Explain every move the learner has to play, and the key opponent moves.
   */
  notes: Record<number, string>;
}

export interface Opening {
  id: string;
  name: string;
  eco: string;
  /** Which side the learner plays in this repertoire chapter. */
  side: 'white' | 'black';
  level: Level;
  /** Two or three sentences: what the opening is and why you'd play it. */
  summary: string;
  /** 3 to 5 key strategic ideas / plans for the learner's side. */
  ideas: string[];
  lines: OpeningLine[];
}

export type EndgameGoal = 'win' | 'draw' | 'promote';

/**
 * Play a position out against the engine. The learner plays the side to move in `fen`.
 * - win: deliver checkmate within `maxMoves` of the learner's moves.
 * - promote: promote a pawn and keep a winning position (engine eval) within `maxMoves`.
 * - draw: reach a draw by rule, or survive `maxMoves` moves without the engine eval going lost.
 */
export interface EndgameDrill {
  id: string;
  title: string;
  category: 'Basic mates' | 'Pawn endgames' | 'Rook endgames' | 'Minor pieces' | 'Queen endgames';
  level: Level;
  fen: string;
  goal: EndgameGoal;
  maxMoves: number;
  /** What the learner must do, in one or two sentences. */
  brief: string;
  /** The technique, as 2 to 5 concrete tips. */
  tips: string[];
}
