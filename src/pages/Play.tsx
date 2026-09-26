import { useEffect, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import { engine, scoreToCp, useEngineStatus, whitePov, type PvLine, type Score, type SearchOptions } from '../engine/engine';
import { Board, playMoveSound } from '../chess/Board';
import { colorName, drawReason, nullMoveFen, other, parseUci, playUci, pvToSan, START_FEN, takeBackTo, turnOf, uciOf } from '../chess/utils';
import { logActivity, playerWon, updateProfile, type GameRecord } from '../store/profile';
import { winFor } from '../lib/analysis';
import { navigate } from '../router';
import { BoardColumn } from '../components/BoardColumn';
import { Button, Feedback, PageHeader, Pill, Segmented } from '../components/ui';
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

function pickEngineMove(lines: PvLine[], best: string, randomness = 0): string {
  if (!randomness || lines.length < 2) return best;
  if (Math.random() > randomness) return best;
  const top = scoreToCp(lines[0].score);
  // Weaker levels pick among plausible moves, occasionally a clear error.
  const pool = lines.filter((l) => scoreToCp(l.score) > top - 400 * randomness - 150);
  return pool[Math.floor(Math.random() * pool.length)]?.pv[0] ?? best;
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
  /** The coach's best move, remembered with the position it was computed for. */
  const [best, setBest] = useState<{ fen: string; uci: string | null } | null>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [note, setNote] = useState<CoachNote | null>(null);
  /** The coach flagged the player's last move and is waiting: take back or play on. */
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ result: GameRecord['result']; reason: string; id: string } | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const engineStatus = useEngineStatus();
  const level = LEVELS[prefs.level - 1];

  // Leaving the page cancels any search; its continuation sees null and stops.
  useEffect(() => () => engine.cancelAll(), []);

  const fenAt = (ms: Move[]) => (ms.length ? ms[ms.length - 1].after : START_FEN);
  const fen = fenAt(moves);
  const turn = turnOf(fen);
  const canMove = phase === 'playing' && !thinking && !pending && turn === color;
  const hintMove = best?.fen === fen ? best.uci : null;

  const update = (p: Partial<Prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    savePrefs(next);
  };

  const finish = (ms: Move[], res: GameRecord['result'], reason: string, playerColor: 'w' | 'b') => {
    const id = 'g' + Date.now().toString(36);
    const won = playerWon({ result: res, playerColor });
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
    if (c.isCheckmate()) finish(ms, c.turn() === 'w' ? '0-1' : '1-0', 'Checkmate', playerColor);
    else finish(ms, '1/2-1/2', drawReason(c), playerColor);
    return true;
  };

  // Every search below resolves null when cancelled (take-back, rematch, resign, leaving),
  // so a stale continuation simply stops.

  /** Analyse the position for the player: eval bar + hint move. */
  const analyseForPlayer = async (f: string) => {
    const r = await engine.search(f, { depth: 11 });
    if (!r) return;
    if (r.whiteScore) setEvalW(r.whiteScore);
    setBest({ fen: f, uci: r.best });
  };

  const engineMove = async (ms: Move[], playerColor: 'w' | 'b') => {
    const f = fenAt(ms);
    setThinking(true);
    const o = level.opts;
    const r = await engine.search(f, { skill: o.skill, elo: o.elo, depth: o.depth, movetime: o.movetime, multipv: o.multipv });
    if (!r) return;
    const played = r.best ? playUci(f, pickEngineMove(r.lines, r.best, o.randomness)) : null;
    setThinking(false);
    if (!played) return;
    const next = [...ms, played.move];
    setMoves(next);
    playMoveSound(played.move.san);
    if (checkEnd(next, playerColor)) return;
    void analyseForPlayer(played.fen);
  };

  const start = () => {
    const c: 'w' | 'b' = prefs.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : prefs.color;
    engine.cancelAll();
    engine.newGame();
    setThinking(false);
    setColor(c);
    setOrientation(c === 'w' ? 'white' : 'black');
    setMoves([]);
    setEvalW({ cp: 20 });
    setBest(null);
    setArrows([]);
    setNote(null);
    setPending(false);
    setResult(null);
    setPhase('playing');
    if (c === 'b') void engineMove([], c);
    else void analyseForPlayer(START_FEN);
  };

  const onMove = async (mv: Move) => {
    if (!canMove) return;
    const next = [...moves, mv];
    setMoves(next);
    setArrows([]);
    setNote(null);
    playMoveSound(mv.san);
    if (checkEnd(next, color)) return;

    if (prefs.coach && evalW) {
      setThinking(true);
      const r = await engine.search(mv.after, { depth: 11 });
      if (!r) return;
      setThinking(false);
      if (r.whiteScore) {
        const before = winFor(evalW, color);
        const drop = before - winFor(r.whiteScore, color);
        setEvalW(r.whiteScore);
        if (drop >= 14 && before > 12) {
          const line = pvToSan(mv.after, r.lines[0]?.pv ?? [], 4);
          if (r.best) {
            const refute = parseUci(r.best);
            setArrows([{ from: refute.from, to: refute.to, color: 'red' }]);
          }
          setNote({
            kind: 'warn',
            title: drop >= 25 ? `${mv.san} looks like a blunder` : `${mv.san} is a mistake`,
            body: line.length ? `After ${line.join(' ')} your position gets much worse. Take it back and look again?` : 'Your position gets much worse. Take it back and look again?',
          });
          setPending(true);
          return;
        }
      }
    }
    void engineMove(next, color);
  };

  const continueAfterWarning = () => {
    setPending(false);
    setNote(null);
    setArrows([]);
    void engineMove(moves, color);
  };

  /** Undo the player's last move and anything played after it. */
  const takeBack = () => {
    engine.cancelAll();
    setThinking(false);
    const next = moves.slice(0, takeBackTo(moves, color));
    setMoves(next);
    setPending(false);
    setNote(null);
    setArrows([]);
    const f = fenAt(next);
    if (turnOf(f) !== color) void engineMove(next, color);
    else void analyseForPlayer(f);
  };

  const hint = () => {
    if (!hintMove) return;
    const u = parseUci(hintMove);
    setArrows([{ from: u.from, to: u.to, color: 'green' }]);
    setNote({ kind: 'hint', title: 'Coach suggestion', body: `Consider ${pvToSan(fen, [hintMove])[0] ?? hintMove}. Ask yourself what it attacks or improves before playing it.` });
  };

  const threat = async () => {
    if (new Chess(fen).inCheck()) {
      setNote({ kind: 'threat', title: 'You are in check', body: 'Deal with the check first: move the king, block, or capture the checking piece.' });
      return;
    }
    // The board waits while the coach looks, so the answer always matches the position.
    setThinking(true);
    const flipped = nullMoveFen(fen);
    const r = await engine.search(flipped, { depth: 10 });
    if (!r) return;
    setThinking(false);
    if (!r.best) return;
    const u = parseUci(r.best);
    const san = pvToSan(flipped, [r.best])[0];
    // Compare the opponent's score after a free move with their score now. When the board
    // already shows a mate, any mating idea counts as serious, so measure it from level.
    const oppNow = evalW && evalW.mate === undefined ? scoreToCp(whitePov(evalW, other(color))) : 0;
    const gain = scoreToCp(r.lines[0]?.score ?? { cp: 0 }) - oppNow;
    setArrows([{ from: u.from, to: u.to, color: 'red' }]);
    setNote(
      gain >= 150
        ? { kind: 'threat', title: `Threat: ${san}`, body: `If it were ${colorName(other(color))}'s move, ${san} would be strong. Make sure your move deals with it.` }
        : { kind: 'info', title: 'No serious threat', body: `The opponent's most active idea is ${san}, but it is not dangerous right now. Use the move to improve your worst piece.` },
    );
  };

  const resign = () => {
    engine.cancelAll();
    setThinking(false);
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
  const won = !!result && playerWon({ result: result.result, playerColor: color });
  const boardEl = (
    <Board
      fen={fen}
      orientation={orientation}
      interactive={canMove}
      playerColor={color}
      onMove={onMove}
      lastMove={last ? [last.from, last.to] : null}
      arrows={arrows}
    />
  );
  return (
    <div className="trainer">
      <BoardColumn>
        <div className="board-caption">
          <span className="player-tag">
            <span className={`side-dot ${other(color)}`} />
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
          <MoveInput id="play-move" fen={fen} color={color} enabled={canMove} onMove={onMove} />
          <button className="icon-btn" aria-label="Flip board" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>
            <Icon name="flip" size={18} />
          </button>
        </div>
      </BoardColumn>
      <aside className="panel">
        {phase === 'over' && result ? (
          <Feedback
            tone={won ? 'good' : result.result === '1/2-1/2' ? 'info' : 'bad'}
            icon={won ? 'trophy' : 'flag'}
            title={won ? 'You won' : result.result === '1/2-1/2' ? 'Draw' : 'You lost'}
            body={`${result.reason} · ${result.result}`}
          />
        ) : (
          <div className="to-move">
            <span className={`side-dot ${turn}`} />
            {turn === color ? 'Your move' : `${level.name} to move`}
          </div>
        )}
        {note && (
          <Feedback
            tone={note.kind === 'warn' ? 'warn' : note.kind === 'threat' ? 'bad' : 'info'}
            icon={note.kind === 'warn' ? 'flag' : note.kind === 'threat' ? 'target' : 'bulb'}
            title={note.title}
            body={note.body}
          />
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
            <Button icon="bulb" onClick={hint} disabled={!hintMove || !canMove}>
              Hint
            </Button>
            <Button icon="target" onClick={threat} disabled={!canMove}>
              Threat?
            </Button>
            {prefs.coach && (
              <Button variant="ghost" icon="undo" onClick={takeBack} disabled={moves.length === 0 || pending}>
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
