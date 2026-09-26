import { useEffect, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import { engine, useEngineStatus, winPercent, whitePov, type PvLine, type Score, type SearchOptions } from '../engine/engine';
import { Board, playMoveSound, type BoardMove } from '../chess/Board';
import { colorName, parseUci, START_FEN, pvToSan, uciOf } from '../chess/utils';
import { logActivity, updateProfile, type GameRecord } from '../store/profile';
import { navigate } from '../router';
import { Button, PageHeader, Pill, Segmented } from '../components/ui';
import { Icon } from '../components/Icon';
import { EvalBar, MoveList } from '../components/GameBits';
import { EngineNotice } from '../components/EngineNotice';
import { sound } from '../chess/sound';
import { MoveInput } from '../components/MoveInput';
import type { Arrow } from '../content/types';

export interface Level {
  n: number;
  name: string;
  elo: number;
  blurb: string;
  opts: SearchOptions & { randomness?: number };
}

export const LEVELS: Level[] = [
  { n: 1, name: 'First Steps', elo: 400, blurb: 'Leaves pieces hanging. Practise spotting free material.', opts: { skill: 0, depth: 1, multipv: 6, randomness: 0.7 } },
  { n: 2, name: 'Casual', elo: 700, blurb: 'Knows the rules, misses simple tactics.', opts: { skill: 2, depth: 2, multipv: 5, randomness: 0.4 } },
  { n: 3, name: 'Improver', elo: 1000, blurb: 'Develops pieces, still blunders under pressure.', opts: { skill: 5, depth: 4, multipv: 4, randomness: 0.2 } },
  { n: 4, name: 'Club', elo: 1350, blurb: 'A solid club player who punishes loose pieces.', opts: { elo: 1350, movetime: 400 } },
  { n: 5, name: 'Strong Club', elo: 1550, blurb: 'Plays sound openings and sees two-move tactics.', opts: { elo: 1550, movetime: 500 } },
  { n: 6, name: 'Tournament', elo: 1750, blurb: 'Rarely blunders. You must outplay it.', opts: { elo: 1750, movetime: 600 } },
  { n: 7, name: 'Expert', elo: 2000, blurb: 'Accurate and patient in every phase.', opts: { elo: 2000, movetime: 700 } },
  { n: 8, name: 'Master', elo: 2300, blurb: 'Master-level calculation.', opts: { elo: 2300, movetime: 800 } },
  { n: 9, name: 'Grandmaster', elo: 2600, blurb: 'Brutal. Good for seeing what best play looks like.', opts: { elo: 2600, movetime: 1000 } },
  { n: 10, name: 'Stockfish', elo: 3200, blurb: 'Full strength. Draws are victories.', opts: { movetime: 1200 } },
];

interface Prefs {
  level: number;
  color: 'w' | 'b' | 'random';
  coach: boolean;
  evalBar: boolean;
}

const PREFS_KEY = 'tempo.play';
function loadPrefs(): Prefs {
  try {
    return { level: 3, color: 'w', coach: true, evalBar: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { level: 3, color: 'w', coach: true, evalBar: false };
  }
}
function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function pickEngineMove(lines: PvLine[], bestmove: string, randomness = 0): string {
  if (!randomness || lines.length < 2) return bestmove;
  if (Math.random() > randomness) return bestmove;
  const cp = (s: Score) => (s.mate !== undefined ? (s.mate > 0 ? 5000 : -5000) : s.cp ?? 0);
  const best = cp(lines[0].score);
  // Weaker levels pick among plausible moves, occasionally a clear error.
  const pool = lines.filter((l) => cp(l.score) > best - 400 * randomness - 150);
  return pool[Math.floor(Math.random() * pool.length)]?.pv[0] ?? bestmove;
}

type Phase = 'setup' | 'playing' | 'over';

interface CoachNote {
  kind: 'warn' | 'threat' | 'hint' | 'info';
  title: string;
  body?: string;
}

export function PlayPage() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [phase, setPhase] = useState<Phase>('setup');
  const [color, setColor] = useState<'w' | 'b'>('w');
  const [moves, setMoves] = useState<Move[]>([]);
  const [thinking, setThinking] = useState(false);
  const [evalW, setEvalW] = useState<Score | undefined>(undefined);
  const [best, setBest] = useState<string | null>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [note, setNote] = useState<CoachNote | null>(null);
  const [pending, setPending] = useState<{ before: number } | null>(null);
  const [result, setResult] = useState<{ result: GameRecord['result']; reason: string; id: string } | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const gen = useRef(0);
  const engineStatus = useEngineStatus();
  const level = LEVELS[prefs.level - 1];

  useEffect(() => {
    engine.init().catch(() => undefined);
    return () => engine.cancelAll();
  }, []);

  const fenAt = (ms: Move[]) => (ms.length ? ms[ms.length - 1].after : START_FEN);
  const fen = fenAt(moves);
  const turn = fen.split(' ')[1] as 'w' | 'b';

  const update = (p: Partial<Prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    savePrefs(next);
  };

  const finish = (ms: Move[], res: GameRecord['result'], reason: string, playerColor: 'w' | 'b') => {
    const id = 'g' + Date.now().toString(36);
    const won = (res === '1-0' && playerColor === 'w') || (res === '0-1' && playerColor === 'b');
    updateProfile((d) => {
      d.games.unshift({ id, t: Date.now(), startFen: START_FEN, moves: ms.map(uciOf), playerColor, level: prefs.level, result: res, reason });
      if (d.games.length > 30) d.games.length = 30;
      if (ms.length >= 10) logActivity(d, won ? 35 : 20, 'games');
    });
    setResult({ result: res, reason, id });
    setPhase('over');
    sound(won ? 'complete' : 'bad');
  };

  const checkEnd = (ms: Move[], playerColor: 'w' | 'b'): boolean => {
    const c = new Chess(fenAt(ms));
    if (!c.isGameOver()) return false;
    if (c.isCheckmate()) {
      const winner = c.turn() === 'w' ? '0-1' : '1-0';
      finish(ms, winner, 'Checkmate', playerColor);
    } else {
      const why = c.isStalemate() ? 'Stalemate' : c.isInsufficientMaterial() ? 'Insufficient material' : c.isThreefoldRepetition() ? 'Threefold repetition' : 'Fifty-move rule';
      finish(ms, '1/2-1/2', why, playerColor);
    }
    return true;
  };

  /** Analyse the position for the player: eval bar + hint move. */
  const analyseForPlayer = async (f: string, g: number) => {
    const r = await engine.search(f, { depth: 11 });
    if (g !== gen.current) return;
    const s = r.lines[0]?.score;
    if (s) setEvalW(whitePov(s, f.split(' ')[1] as 'w' | 'b'));
    setBest(r.bestmove && r.bestmove !== '(none)' ? r.bestmove : null);
  };

  const engineMove = async (ms: Move[], playerColor: 'w' | 'b', g: number) => {
    const f = fenAt(ms);
    setThinking(true);
    const o = level.opts;
    const r = await engine.search(f, { skill: o.skill, elo: o.elo, depth: o.depth, movetime: o.movetime, multipv: o.multipv });
    if (g !== gen.current) return;
    const uci = pickEngineMove(r.lines, r.bestmove, o.randomness);
    const c = new Chess(f);
    let mv: Move;
    try {
      mv = c.move(parseUci(uci));
    } catch {
      setThinking(false);
      return;
    }
    const next = [...ms, mv];
    setMoves(next);
    playMoveSound(mv.san);
    setThinking(false);
    if (checkEnd(next, playerColor)) return;
    void analyseForPlayer(c.fen(), g);
  };

  const start = () => {
    const c: 'w' | 'b' = prefs.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : prefs.color;
    gen.current++;
    engine.cancelAll();
    engine.newGame();
    setColor(c);
    setOrientation(c === 'w' ? 'white' : 'black');
    setMoves([]);
    setEvalW({ cp: 20 });
    setBest(null);
    setArrows([]);
    setNote(null);
    setPending(null);
    setResult(null);
    setPhase('playing');
    if (c === 'b') void engineMove([], c, gen.current);
    else void analyseForPlayer(START_FEN, gen.current);
  };

  const onMove = async (m: BoardMove) => {
    if (phase !== 'playing' || thinking || pending || turn !== color) return;
    const c = new Chess(fen);
    let mv: Move;
    try {
      mv = c.move({ from: m.from, to: m.to, promotion: m.promotion });
    } catch {
      return;
    }
    const g = gen.current;
    const next = [...moves, mv];
    setMoves(next);
    setArrows([]);
    setNote(null);
    playMoveSound(mv.san);
    if (checkEnd(next, color)) return;

    if (prefs.coach && evalW) {
      setThinking(true);
      const r = await engine.search(c.fen(), { depth: 11 });
      if (g !== gen.current) return;
      setThinking(false);
      const sAfter = r.lines[0]?.score;
      if (sAfter) {
        const afterW = whitePov(sAfter, c.turn());
        const pov = (s: Score) => (color === 'w' ? winPercent(s) : 100 - winPercent(s));
        const drop = pov(evalW) - pov(afterW);
        setEvalW(afterW);
        if (drop >= 14 && pov(evalW) > 12) {
          const refute = r.bestmove && r.bestmove !== '(none)' ? parseUci(r.bestmove) : null;
          const line = pvToSan(c.fen(), r.lines[0]?.pv ?? [], 4);
          if (refute) setArrows([{ from: refute.from, to: refute.to, color: 'red' }]);
          setNote({
            kind: 'warn',
            title: drop >= 25 ? `${mv.san} looks like a blunder` : `${mv.san} is a mistake`,
            body: line.length ? `After ${line.join(' ')} your position gets much worse. Take it back and look again?` : 'Your position gets much worse. Take it back and look again?',
          });
          setPending({ before: moves.length });
          return;
        }
      }
    }
    void engineMove(next, color, g);
  };

  const continueAfterWarning = () => {
    setPending(null);
    setNote(null);
    setArrows([]);
    void engineMove(moves, color, gen.current);
  };

  const takeBack = () => {
    gen.current++;
    engine.cancelAll();
    setThinking(false);
    let n = moves.length;
    if (pending) n = pending.before;
    else {
      // Undo the engine reply and the player's move.
      while (n > 0 && moves[n - 1].color !== color) n--;
      if (n > 0) n--;
    }
    const next = moves.slice(0, n);
    setMoves(next);
    setPending(null);
    setNote(null);
    setArrows([]);
    const f = fenAt(next);
    if (f.split(' ')[1] !== color) void engineMove(next, color, gen.current);
    else void analyseForPlayer(f, gen.current);
  };

  const hint = () => {
    if (!best) return;
    const u = parseUci(best);
    setArrows([{ from: u.from, to: u.to, color: 'green' }]);
    setNote({ kind: 'hint', title: 'Coach suggestion', body: `Consider ${pvToSan(fen, [best])[0] ?? best}. Ask yourself what it attacks or improves before playing it.` });
  };

  const threat = async () => {
    const c = new Chess(fen);
    if (c.inCheck()) {
      setNote({ kind: 'threat', title: 'You are in check', body: 'Deal with the check first: move the king, block, or capture the checking piece.' });
      return;
    }
    const parts = fen.split(' ');
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    parts[3] = '-';
    const flipped = parts.join(' ');
    const g = gen.current;
    const r = await engine.search(flipped, { depth: 10 });
    if (g !== gen.current || !r.bestmove || r.bestmove === '(none)') return;
    const s = r.lines[0]?.score;
    const u = parseUci(r.bestmove);
    const san = pvToSan(flipped, [r.bestmove])[0];
    // Compare the opponent's score with a free move against their score now.
    const oppNow = evalW?.cp !== undefined ? (color === 'w' ? -evalW.cp : evalW.cp) : 0;
    const gain = s?.mate !== undefined ? (s.mate > 0 ? 10000 : -10000) : (s?.cp ?? 0) - oppNow;
    const serious = gain >= 150;
    setArrows([{ from: u.from, to: u.to, color: 'red' }]);
    setNote(
      serious
        ? { kind: 'threat', title: `Threat: ${san}`, body: `If it were ${colorName(color === 'w' ? 'b' : 'w')}'s move, ${san} would be strong. Make sure your move deals with it.` }
        : { kind: 'info', title: 'No serious threat', body: `The opponent's most active idea is ${san}, but it is not dangerous right now. Use the move to improve your worst piece.` },
    );
  };

  const resign = () => {
    gen.current++;
    engine.cancelAll();
    finish(moves, color === 'w' ? '0-1' : '1-0', 'Resignation', color);
  };

  if (phase === 'setup') {
    return (
      <>
        <PageHeader eyebrow="Play" title="Play the coach">
          Real games teach what drills cannot. Pick an opponent slightly stronger than you, keep coach mode on, and review every game afterwards.
        </PageHeader>
        <EngineNotice />
        <div className="play-setup">
          <div className="level-grid" role="radiogroup" aria-label="Opponent level">
            {LEVELS.map((l) => (
              <button key={l.n} role="radio" aria-checked={prefs.level === l.n} className={`level-card ${prefs.level === l.n ? 'on' : ''}`} onClick={() => update({ level: l.n })}>
                <span className="level-n num">{l.n}</span>
                <span className="level-name">{l.name}</span>
                <span className="level-elo num">~{l.elo}</span>
                <span className="level-blurb">{l.blurb}</span>
              </button>
            ))}
          </div>
          <div className="card play-options">
            <div className="play-option">
              <span className="stat-label">Your pieces</span>
              <Segmented
                label="Your color"
                value={prefs.color}
                onChange={(v) => update({ color: v })}
                options={[
                  { value: 'w', label: 'White' },
                  { value: 'random', label: 'Random' },
                  { value: 'b', label: 'Black' },
                ]}
              />
            </div>
            <label className="switch">
              <input type="checkbox" checked={prefs.coach} onChange={(e) => update({ coach: e.target.checked })} id="coach-mode" />
              Coach mode: warn me before a mistake, allow take-backs
            </label>
            <label className="switch">
              <input type="checkbox" checked={prefs.evalBar} onChange={(e) => update({ evalBar: e.target.checked })} id="eval-bar" />
              Show evaluation bar
            </label>
            <Button variant="primary" size="l" icon="play" onClick={start} disabled={engineStatus === 'failed'}>
              Start game vs {level.name}
            </Button>
          </div>
        </div>
      </>
    );
  }

  const sans = moves.map((m) => m.san);
  const last = moves[moves.length - 1];
  const playerWon = result && ((result.result === '1-0' && color === 'w') || (result.result === '0-1' && color === 'b'));
  const boardEl = (
    <Board
      fen={fen}
      orientation={orientation}
      interactive={phase === 'playing' && !thinking && !pending && turn === color}
      playerColor={color}
      onMove={onMove}
      lastMove={last ? [last.from, last.to] : null}
      arrows={arrows}
    />
  );
  return (
    <div className="trainer" style={{ '--board-offset': '150px' } as React.CSSProperties}>
      <div className="trainer-board">
        <div className="board-caption">
          <span className="player-tag">
            <span className={`side-dot ${color === 'w' ? 'b' : 'w'}`} />
            {level.name} <span className="faint num">~{level.elo}</span>
          </span>
          {thinking && <span className="faint">Thinking…</span>}
        </div>
        {prefs.evalBar ? (
          <div className="board-with-eval">
            <EvalBar score={evalW} orientation={orientation} />
            {boardEl}
          </div>
        ) : (
          boardEl
        )}
        <div className="board-caption">
          <span className="player-tag">
            <span className={`side-dot ${color}`} /> You
          </span>
          <span style={{ flex: 1 }} />
          <MoveInput id="play-move" fen={fen} enabled={phase === 'playing' && !thinking && !pending && turn === color} onMove={onMove} />
          <button className="icon-btn" aria-label="Flip board" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>
            <Icon name="flip" size={18} />
          </button>
        </div>
      </div>
      <aside className="panel">
        {phase === 'over' && result ? (
          <div className={`feedback ${playerWon ? 'feedback-good' : result.result === '1/2-1/2' ? 'feedback-info' : 'feedback-bad'}`}>
            <Icon name={playerWon ? 'trophy' : 'flag'} />
            <div>
              <strong>{playerWon ? 'You won' : result.result === '1/2-1/2' ? 'Draw' : 'You lost'}</strong>
              <span className="feedback-body">
                {result.reason} · {result.result}
              </span>
            </div>
          </div>
        ) : (
          <div className="to-move">
            <span className={`side-dot ${turn}`} />
            {turn === color ? 'Your move' : `${level.name} to move`}
          </div>
        )}
        {note && (
          <div className={`feedback ${note.kind === 'warn' ? 'feedback-warn' : note.kind === 'threat' ? 'feedback-bad' : 'feedback-info'}`}>
            <Icon name={note.kind === 'warn' ? 'flag' : note.kind === 'threat' ? 'target' : 'bulb'} />
            <div>
              <strong>{note.title}</strong>
              {note.body && <span className="feedback-body">{note.body}</span>}
            </div>
          </div>
        )}
        {pending && (
          <div className="btn-row">
            <Button variant="primary" icon="undo" onClick={takeBack}>
              Take it back
            </Button>
            <Button variant="ghost" onClick={continueAfterWarning}>
              Play on
            </Button>
          </div>
        )}
        <MoveList sans={sans} current={sans.length} />
        {phase === 'playing' ? (
          <div className="btn-row">
            <Button icon="bulb" onClick={hint} disabled={!best || thinking || !!pending || turn !== color}>
              Hint
            </Button>
            <Button icon="target" onClick={threat} disabled={thinking || !!pending || turn !== color}>
              Threat?
            </Button>
            {prefs.coach && (
              <Button variant="ghost" icon="undo" onClick={takeBack} disabled={moves.length === 0 || !!pending}>
                Take back
              </Button>
            )}
            <Button variant="ghost" icon="flag" onClick={resign} disabled={moves.length < 2}>
              Resign
            </Button>
          </div>
        ) : (
          <div className="btn-row">
            {result && (
              <Button variant="primary" icon="progress" onClick={() => navigate(`review/${result.id}`)}>
                Review this game
              </Button>
            )}
            <Button icon="refresh" onClick={start}>
              Rematch
            </Button>
            <Button variant="ghost" onClick={() => setPhase('setup')}>
              Change opponent
            </Button>
          </div>
        )}
        <div className="panel-divider" />
        <div className="coach-tips faint">
          <Pill tone="neutral">Before every move</Pill>
          <p>Checks, captures, threats: for both sides. Then ask what your move leaves undefended.</p>
        </div>
      </aside>
    </div>
  );
}
