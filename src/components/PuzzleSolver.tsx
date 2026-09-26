import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board, playMoveSound, type BoardMove, type SquareTone } from '../chess/Board';
import { parseUci, playUci, uciOf, turnOf, colorName } from '../chess/utils';
import type { Puzzle } from '../data/puzzles';
import type { Arrow } from '../content/types';
import { sound } from '../chess/sound';
import { Icon } from './Icon';
import { MoveInput } from './MoveInput';

export type PuzzleStatus = 'intro' | 'solving' | 'solved' | 'failed' | 'viewing';

export interface PuzzleOutcome {
  /** Solved without a wrong move and without hints. */
  clean: boolean;
  hinted: boolean;
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
  const solverColor = turnOf(puzzle.fen) === 'w' ? 'b' : 'w';
  const [fen, setFen] = useState(puzzle.fen);
  const [idx, setIdx] = useState(0); // index into moves of the next expected move
  const [status, setStatus] = useState<PuzzleStatus>('intro');
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [tones, setTones] = useState<Record<string, SquareTone>>({});
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [hintLevel, setHintLevel] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const reported = useRef(false);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const report = (o: PuzzleOutcome) => {
    if (reported.current) return;
    reported.current = true;
    onFirstResult?.(o);
  };

  // Play the opponent's setup move.
  useEffect(() => {
    later(() => {
      const r = playUci(puzzle.fen, moves[0]);
      if (!r) return;
      setFen(r.fen);
      setLastMove([r.move.from, r.move.to]);
      setIdx(1);
      setStatus('solving');
      playMoveSound(r.move.san);
    }, 650);
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.id]);

  const solutionSan = useMemo(() => {
    const c = new Chess(puzzle.fen);
    return moves.map((u) => {
      try {
        return c.move(parseUci(u)).san;
      } catch {
        return u;
      }
    });
  }, [puzzle, moves]);

  const contSan = useMemo(() => {
    if (!puzzle.cont) return [];
    const c = new Chess(puzzle.fen);
    try {
      for (const u of moves) c.move(parseUci(u));
      return puzzle.cont.split(' ').map((u) => c.move(parseUci(u)).san);
    } catch {
      return [];
    }
  }, [puzzle, moves]);

  const finish = (clean: boolean) => {
    setStatus('solved');
    sound('good');
    report({ clean, hinted: hintLevel > 0 });
    onComplete?.(clean);
  };

  const onMove = (m: BoardMove) => {
    if (status !== 'solving') return;
    const expected = moves[idx];
    const uci = uciOf(m);
    const r = playUci(fen, uci);
    if (!r) return;
    const correct = uci === expected || (expected && uci.slice(0, 4) === expected.slice(0, 4) && !expected[4] && !m.promotion) || new Chess(r.fen).isCheckmate();
    setArrows([]);
    setTones({});
    if (correct) {
      setFen(r.fen);
      setLastMove([r.move.from, r.move.to]);
      playMoveSound(r.move.san);
      setHintLevel(0);
      const nextIdx = idx + 1;
      if (nextIdx >= moves.length || new Chess(r.fen).isCheckmate()) {
        setTones({ [r.move.to]: 'good' });
        setIdx(moves.length);
        finish(mistakes === 0 && hintLevel === 0 && !reported.current);
        return;
      }
      setTones({ [r.move.to]: 'good' });
      setIdx(nextIdx);
      later(() => {
        const rr = playUci(r.fen, moves[nextIdx]);
        if (!rr) return;
        setFen(rr.fen);
        setLastMove([rr.move.from, rr.move.to]);
        setTones({});
        playMoveSound(rr.move.san);
        setIdx(nextIdx + 1);
      }, MOVE_DELAY);
    } else {
      // Show the wrong move, then take it back.
      const before = fen;
      const beforeLast = lastMove;
      setFen(r.fen);
      setLastMove([r.move.from, r.move.to]);
      setTones({ [r.move.to]: 'bad' });
      sound('bad');
      setMistakes((n) => n + 1);
      report({ clean: false, hinted: hintLevel > 0 });
      if (strict) {
        setStatus('failed');
        later(() => {
          setFen(before);
          setLastMove(beforeLast);
          setTones({});
          const ex = parseUci(expected);
          setArrows([{ from: ex.from, to: ex.to, color: 'green' }]);
        }, 650);
        onComplete?.(false);
        return;
      }
      setStatus('failed');
      later(() => {
        setFen(before);
        setLastMove(beforeLast);
        setTones({});
        setStatus('solving');
      }, 700);
    }
  };

  const hint = () => {
    if (status !== 'solving') return;
    const ex = parseUci(moves[idx]);
    report({ clean: false, hinted: true });
    if (hintLevel === 0) {
      setTones({ [ex.from]: 'hint' });
      setHintLevel(1);
    } else {
      setArrows([{ from: ex.from, to: ex.to, color: 'blue' }]);
      setHintLevel(2);
    }
  };

  const showSolution = () => {
    report({ clean: false, hinted: true });
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
    timers.current.forEach(clearTimeout);
    const r = playUci(puzzle.fen, moves[0]);
    if (!r) return;
    setFen(r.fen);
    setLastMove([r.move.from, r.move.to]);
    setIdx(1);
    setTones({});
    setArrows([]);
    setHintLevel(0);
    setStatus('solving');
  };

  const mateMatch = puzzle.themes.find((t) => /^mateIn\d/.test(t));
  const goal = mateMatch ? `Find mate in ${mateMatch.slice(6)}` : 'Find the best move';

  const api: SolverApi = { status, solverColor, hint, hintLevel, showSolution, retry, solutionSan, contSan, mistakes, goal };

  return (
    <div className="trainer" style={{ '--board-offset': '250px' } as React.CSSProperties}>
      <div className="trainer-board">
        <div className="board-caption">
          <span className="player-tag">
            <span className={`side-dot ${solverColor}`} />
            {status === 'intro' ? 'Watch the last move' : `${colorName(solverColor)} to play`}
          </span>
          <span className="faint">
            Puzzle <span className="num">{puzzle.id.replace(/^p0*/, '#')}</span>
          </span>
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
        <MoveInput id="puzzle-move" fen={fen} enabled={status === 'solving'} onMove={onMove} />
      </div>
      {children?.(api)}
    </div>
  );
}

export function PuzzleFeedback({ api }: { api: SolverApi }) {
  if (api.status === 'solved')
    return (
      <div className="feedback feedback-good">
        <Icon name="check" />
        <div>
          <strong>{api.mistakes ? 'Solved, after a retry' : 'Solved'}</strong>
          <span className="feedback-body mono">{api.solutionSan.slice(1).join('  ')}</span>
          {api.contSan.length > 0 && <span className="feedback-body faint">Then {api.contSan.join(' ')}</span>}
        </div>
      </div>
    );
  if (api.status === 'failed')
    return (
      <div className="feedback feedback-bad">
        <Icon name="x" />
        <div>
          <strong>Not the move</strong>
          <span className="feedback-body">Look again at checks, captures and threats.</span>
        </div>
      </div>
    );
  if (api.status === 'viewing')
    return (
      <div className="feedback feedback-info">
        <Icon name="eye" />
        <div>
          <strong>Solution</strong>
          <span className="feedback-body mono">{api.solutionSan.slice(1).join('  ')}</span>
          {api.contSan.length > 0 && <span className="feedback-body faint">Then {api.contSan.join(' ')}</span>}
        </div>
      </div>
    );
  return null;
}
