import { useEffect, useMemo, useRef, useState } from 'react';
import type { Move } from 'chess.js';
import { Board, playMoveSound, type SquareTone } from '../chess/Board';
import { acceptsMove, colorName, other, parseUci, playUci, pvToSan, turnOf } from '../chess/utils';
import type { Puzzle } from '../data/puzzles';
import type { Arrow } from '../content/types';
import { sound } from '../chess/sound';
import { useTimeouts } from '../lib/hooks';
import { BoardColumn } from './BoardColumn';
import { MoveInput } from './MoveInput';
import { Feedback } from './ui';
import { SoundToggle } from './SoundToggle';

export type PuzzleStatus = 'intro' | 'solving' | 'solved' | 'failed' | 'viewing';

export interface PuzzleOutcome {
  /** Solved without a wrong move and without hints. */
  clean: boolean;
}

interface Props {
  puzzle: Puzzle;
  /** Called once: on the first wrong move / hint, or on a clean solve. */
  onFirstResult?: (o: PuzzleOutcome) => void;
  /** Called when the line is completed (solved, possibly after mistakes). */
  onComplete?: (clean: boolean) => void;
  /** Rush mode: a wrong move ends the puzzle immediately. */
  strict?: boolean;
  children?: (api: SolverApi) => React.ReactNode;
}

export interface SolverApi {
  status: PuzzleStatus;
  solverColor: 'w' | 'b';
  hint: () => void;
  hintLevel: number;
  showSolution: () => void;
  retry: () => void;
  solutionSan: string[];
  /** Engine follow-up after the solution, in SAN. */
  contSan: string[];
  mistakes: number;
  goal: string;
}

const MOVE_DELAY = 420;

export function PuzzleSolver({ puzzle, onFirstResult, onComplete, strict, children }: Props) {
  const moves = useMemo(() => puzzle.moves.split(' '), [puzzle]);
  const solverColor = other(turnOf(puzzle.fen));
  const [fen, setFen] = useState(puzzle.fen);
  const [idx, setIdx] = useState(0); // index into moves of the next expected move
  const [status, setStatus] = useState<PuzzleStatus>('intro');
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [tones, setTones] = useState<Record<string, SquareTone>>({});
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [hintLevel, setHintLevel] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const reported = useRef(false);
  const { later, clear } = useTimeouts();
  // False while the opponent's reply is pending, even though the status is still 'solving'.
  const myTurn = status === 'solving' && turnOf(fen) === solverColor;

  const report = (o: PuzzleOutcome) => {
    if (reported.current) return;
    reported.current = true;
    onFirstResult?.(o);
  };

  // Play the opponent's setup move (again, on retry).
  const playSetupMove = () => {
    const r = playUci(puzzle.fen, moves[0]);
    if (!r) return;
    setFen(r.fen);
    setLastMove([r.move.from, r.move.to]);
    setIdx(1);
    setStatus('solving');
    playMoveSound(r.move.san);
  };
  useEffect(() => {
    later(playSetupMove, 650);
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.id]);

  // SAN of the whole line; illegal moves (never expected) fall back to UCI.
  const solutionSan = useMemo(() => {
    const san = pvToSan(puzzle.fen, moves, moves.length);
    return moves.map((u, i) => san[i] ?? u);
  }, [puzzle, moves]);

  const contSan = useMemo(() => {
    const cont = puzzle.cont?.split(' ') ?? [];
    const all = pvToSan(puzzle.fen, [...moves, ...cont], moves.length + cont.length);
    return all.length === moves.length + cont.length ? all.slice(moves.length) : [];
  }, [puzzle, moves]);

  const finish = (clean: boolean) => {
    setStatus('solved');
    sound('good');
    report({ clean });
    onComplete?.(clean);
  };

  const onMove = (m: Move) => {
    if (!myTurn) return;
    const expected = moves[idx];
    const mate = m.san.endsWith('#');
    setArrows([]);
    if (acceptsMove(m, [expected])) {
      setFen(m.after);
      setLastMove([m.from, m.to]);
      setTones({ [m.to]: 'good' });
      playMoveSound(m.san);
      setHintLevel(0);
      const nextIdx = idx + 1;
      if (nextIdx >= moves.length || mate) {
        setIdx(moves.length);
        finish(mistakes === 0 && hintLevel === 0 && !reported.current);
        return;
      }
      setIdx(nextIdx);
      later(() => {
        const rr = playUci(m.after, moves[nextIdx]);
        if (!rr) return;
        setFen(rr.fen);
        setLastMove([rr.move.from, rr.move.to]);
        setTones({});
        playMoveSound(rr.move.san);
        setIdx(nextIdx + 1);
      }, MOVE_DELAY);
    } else {
      // Show the wrong move, then take it back. In strict mode (Rush) the puzzle ends here.
      const before = fen;
      const beforeLast = lastMove;
      setFen(m.after);
      setLastMove([m.from, m.to]);
      setTones({ [m.to]: 'bad' });
      sound('bad');
      setMistakes((n) => n + 1);
      setStatus('failed');
      report({ clean: false });
      later(
        () => {
          setFen(before);
          setLastMove(beforeLast);
          setTones({});
          if (!strict) return setStatus('solving');
          const ex = parseUci(expected);
          setArrows([{ from: ex.from, to: ex.to, color: 'green' }]);
        },
        strict ? 650 : 700,
      );
      if (strict) onComplete?.(false);
    }
  };

  const hint = () => {
    if (!myTurn) return;
    const ex = parseUci(moves[idx]);
    report({ clean: false });
    if (hintLevel === 0) {
      setTones({ [ex.from]: 'hint' });
      setHintLevel(1);
    } else {
      setArrows([{ from: ex.from, to: ex.to, color: 'blue' }]);
      setHintLevel(2);
    }
  };

  const showSolution = () => {
    // Only from a settled position: not while a wrong move is on the board being taken back.
    if (status !== 'solving') return;
    clear(); // a pending opponent reply is replayed by the solution itself
    report({ clean: false });
    setStatus('viewing');
    setArrows([]);
    setTones({});
    let f = fen;
    let i = idx;
    const step = () => {
      if (i >= moves.length) {
        onComplete?.(false);
        return;
      }
      const r = playUci(f, moves[i]);
      if (!r) return;
      f = r.fen;
      setFen(r.fen);
      setLastMove([r.move.from, r.move.to]);
      playMoveSound(r.move.san);
      i++;
      setIdx(i);
      later(step, 700);
    };
    later(step, 200);
  };

  const retry = () => {
    clear();
    playSetupMove();
    setTones({});
    setArrows([]);
    setHintLevel(0);
  };

  const mateMatch = puzzle.themes.find((t) => /^mateIn\d/.test(t));
  const goal = mateMatch ? `Find mate in ${mateMatch.slice(6)}` : 'Find the best move';

  const api: SolverApi = { status, solverColor, hint, hintLevel, showSolution, retry, solutionSan, contSan, mistakes, goal };

  return (
    <div className="trainer">
      <BoardColumn>
        <div className="board-caption">
          <span className="player-tag">
            <span className={`side-dot ${solverColor}`} />
            {status === 'intro' ? 'Watch the last move' : `${colorName(solverColor)} to play`}
          </span>
          <span className="faint">
            Puzzle <span className="num">{puzzle.id.replace(/^p0*/, '#')}</span>
          </span>
          <SoundToggle compact />
        </div>
        <Board
          fen={fen}
          orientation={solverColor === 'w' ? 'white' : 'black'}
          interactive={status === 'solving'}
          playerColor={solverColor}
          onMove={onMove}
          lastMove={lastMove}
          tones={tones}
          arrows={arrows}
        />
        <MoveInput id="puzzle-move" fen={fen} color={solverColor} enabled={status === 'solving'} onMove={onMove} />
      </BoardColumn>
      {children?.(api)}
    </div>
  );
}

export function PuzzleFeedback({ api }: { api: SolverApi }) {
  if (api.status === 'failed') return <Feedback tone="bad" icon="x" title="Not the move" body="Look again at checks, captures and threats." />;
  if (api.status !== 'solved' && api.status !== 'viewing') return null;
  const solved = api.status === 'solved';
  return (
    <Feedback tone={solved ? 'good' : 'info'} icon={solved ? 'check' : 'eye'} title={solved ? (api.mistakes ? 'Solved, after a retry' : 'Solved') : 'Solution'}>
      <span className="feedback-body mono">{api.solutionSan.slice(1).join('  ')}</span>
      {api.contSan.length > 0 && <span className="feedback-body faint">Then {api.contSan.join(' ')}</span>}
    </Feedback>
  );
}
