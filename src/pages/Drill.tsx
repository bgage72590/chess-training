import { useEffect, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import { endgameDrills, type EndgameDrill } from '../content';
import { navigate } from '../router';
import { engine, scoreToCp, useEngineStatus } from '../engine/engine';
import { Board, playMoveSound } from '../chess/Board';
import { colorName, drawReason, parseUci, playUci, takeBackTo, turnOf } from '../chess/utils';
import { getProfile, logActivity, updateProfile } from '../store/profile';
import { BoardColumn } from '../components/BoardColumn';
import { Button, Feedback, Pill, RichText } from '../components/ui';
import { Icon } from '../components/Icon';
import { sound } from '../chess/sound';
import { GOAL_LABEL } from './Endgames';
import type { Arrow } from '../content/types';
import { EngineNotice } from '../components/EngineNotice';
import { MoveInput } from '../components/MoveInput';
import { thinkTimeMs, waitUntil } from '../lib/thinkTime';
import { SoundToggle } from '../components/SoundToggle';

type Status = 'playing' | 'thinking' | 'success' | 'failed';

function DrillPlayer({ drill }: { drill: EndgameDrill }) {
  const learner = turnOf(drill.fen);
  const [moves, setMoves] = useState<Move[]>([]);
  const [status, setStatus] = useState<Status>('playing');
  const [message, setMessage] = useState<{ title: string; body: string } | null>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [hints, setHints] = useState(0);
  const engineStatus = useEngineStatus();
  /** Bumped by restart, take-back and leaving, so a reply still being "thought" about is dropped. */
  const runRef = useRef(0);
  // Leaving cancels any search; cancelled searches resolve null and their callers stop.
  useEffect(
    () => () => {
      engine.cancelAll();
      runRef.current++;
    },
    [],
  );

  const fen = moves.length ? moves[moves.length - 1].after : drill.fen;
  const learnerMoves = moves.filter((m) => m.color === learner).length;
  const last = moves[moves.length - 1];

  const succeed = (title: string, body: string) => {
    setStatus('success');
    setMessage({ title, body });
    sound('complete');
    const prev = getProfile().drills[drill.id];
    updateProfile((d) => {
      d.drills[drill.id] = { done: true, attempts: (prev?.attempts ?? 0) + 1, best: Math.min(prev?.best ?? 999, learnerMoves + 1), t: Date.now() };
      logActivity(d, prev?.done ? 10 : 30, 'drills');
    });
  };

  const fail = (title: string, body: string) => {
    setStatus('failed');
    setMessage({ title, body });
    sound('bad');
    updateProfile((d) => {
      const prev = d.drills[drill.id];
      d.drills[drill.id] = { done: prev?.done ?? false, attempts: (prev?.attempts ?? 0) + 1, best: prev?.best, t: Date.now() };
      logActivity(d, 2);
    });
  };

  const onMove = async (mv: Move) => {
    if (status !== 'playing') return;
    playMoveSound(mv.san);
    setArrows([]);
    const afterLearner = mv.after;
    setMoves((ms) => [...ms, mv]);
    const used = learnerMoves + 1;

    const c = new Chess(afterLearner);
    if (c.isCheckmate()) return succeed('Checkmate', `Delivered in ${used} move${used > 1 ? 's' : ''}.`);
    if (c.isDraw()) {
      const why = drawReason(c);
      if (drill.goal === 'draw') return succeed('Draw secured', `${why}. That is a half point saved.`);
      return fail(why, c.isStalemate() ? 'The defending king had no legal move but was not in check. Always leave it a square.' : 'The position ended in a draw. Take the move back and find a more precise plan.');
    }

    setStatus('thinking');
    const run = runRef.current;
    const startedAt = performance.now();
    let res;
    try {
      res = await engine.search(afterLearner, { depth: 18, movetime: 900 });
    } catch {
      setStatus('playing');
      return;
    }
    if (!res || run !== runRef.current) return;
    // The score is from the engine's side (to move); flip it to the learner.
    const evalLearner = -scoreToCp(res.lines[0]?.score ?? { cp: 0 });

    if (drill.goal === 'promote' && mv.promotion) {
      if (evalLearner >= 300) return succeed('Promoted', `The pawn queened and the position is winning (${used} moves).`);
      return fail('Promotion, but not winning', 'The new queen can be won or the defence holds. Look for the safer route.');
    }
    if (drill.goal !== 'draw' && evalLearner < 80) {
      return fail('The win slipped away', 'The engine now holds the position. Take the move back and compare it with the tips.');
    }
    if (drill.goal === 'draw' && evalLearner < -350) {
      return fail('This is now lost', 'The engine found a winning plan. Take the move back and look for the defensive setup from the tips.');
    }
    if (drill.goal !== 'draw' && used >= drill.maxMoves) {
      return fail('Out of moves', `The target was ${drill.maxMoves} moves. Aim for a more direct technique.`);
    }

    const reply = res.best && playUci(afterLearner, res.best);
    if (reply) await waitUntil(startedAt, thinkTimeMs({ fen: afterLearner, moveNumber: used, afterCapture: !!mv.captured }));
    if (run !== runRef.current) return; // restarted, taken back or left meanwhile
    if (!reply) {
      setStatus('playing');
      return;
    }
    playMoveSound(reply.move.san);
    setMoves((ms) => [...ms, reply.move]);
    const c2 = new Chess(reply.fen);
    if (c2.isCheckmate()) return fail('You were mated', 'Take the move back and check the opponent’s forcing moves first.');
    if (c2.isDraw()) {
      if (drill.goal === 'draw') return succeed('Draw secured', 'The engine could not make progress.');
      return fail('Drawn', 'The position ended in a draw by rule.');
    }
    if (drill.goal === 'draw' && used >= drill.maxMoves) return succeed('Held', `You survived ${drill.maxMoves} moves with the draw intact.`);
    setStatus('playing');
  };

  const takeBack = () => {
    engine.cancelAll();
    runRef.current++;
    // Back to the position before the learner's last move.
    setMoves(moves.slice(0, takeBackTo(moves, learner)));
    setStatus('playing');
    setMessage(null);
    setArrows([]);
  };

  const restart = () => {
    engine.cancelAll();
    runRef.current++;
    setMoves([]);
    setStatus('playing');
    setMessage(null);
    setArrows([]);
    setHints(0);
  };

  const hint = async () => {
    if (status !== 'playing') return;
    setStatus('thinking');
    const r = await engine.search(fen, { depth: 18, movetime: 1200 });
    if (!r) return;
    setStatus('playing');
    if (r.best) {
      const u = parseUci(r.best);
      setArrows([{ from: u.from, to: u.to, color: 'blue' }]);
      setHints((h) => h + 1);
    }
  };

  return (
    <div className="trainer">
      <BoardColumn>
        <div className="board-caption">
          <span className="player-tag">
            <span className={`side-dot ${learner}`} /> You play {colorName(learner)}
          </span>
          <span className="faint">
            {status === 'thinking' ? 'Engine thinking…' : `Move ${learnerMoves}${drill.goal === 'draw' ? ` of ${drill.maxMoves}` : ` / ${drill.maxMoves}`}`}
          </span>
          <SoundToggle compact />
        </div>
        <Board fen={fen} orientation={learner === 'w' ? 'white' : 'black'} interactive={status === 'playing' && engineStatus !== 'failed'} playerColor={learner} onMove={onMove} lastMove={last ? [last.from, last.to] : null} arrows={arrows} />
        <MoveInput id="drill-move" fen={fen} color={learner} enabled={status === 'playing' && engineStatus !== 'failed'} onMove={onMove} />
      </BoardColumn>
      <aside className="panel">
        <div className="panel-section">
          <div className="btn-row">
            <Pill tone={drill.goal === 'draw' ? 'info' : 'accent'}>{GOAL_LABEL[drill.goal]}</Pill>
            <Pill>{drill.category}</Pill>
          </div>
          <h2>{drill.title}</h2>
          <RichText text={drill.brief} />
        </div>
        <EngineNotice />
        {message && <Feedback tone={status === 'success' ? 'good' : 'bad'} icon={status === 'success' ? 'trophy' : 'x'} title={message.title} body={message.body} reveal />}
        <div className="btn-row">
          {status === 'success' ? (
            <>
              <Button variant="primary" icon="refresh" onClick={restart}>
                Play it again
              </Button>
              <Button onClick={() => navigate('endgames')}>More drills</Button>
            </>
          ) : (
            <>
              <Button icon="undo" onClick={takeBack} disabled={moves.length === 0 || status === 'thinking'}>
                Take back
              </Button>
              <Button variant="ghost" icon="bulb" onClick={hint} disabled={status !== 'playing' || engineStatus !== 'ready'}>
                Hint{hints ? ` (${hints})` : ''}
              </Button>
              <Button variant="ghost" icon="refresh" onClick={restart} disabled={moves.length === 0}>
                Restart
              </Button>
            </>
          )}
        </div>
        <div className="panel-divider" />
        <div className="panel-section">
          <h3>Technique</h3>
          <ul className="tips">
            {drill.tips.map((t, i) => (
              <li key={i}>
                <RichText text={t} />
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export function DrillPage({ id }: { id: string }) {
  const drill = endgameDrills.find((d) => d.id === id);
  if (!drill) return <div className="empty">Drill not found.</div>;
  const i = endgameDrills.indexOf(drill);
  const next = endgameDrills[i + 1];
  return (
    <>
      <div className="lesson-top">
        <button className="icon-btn" aria-label="All drills" onClick={() => navigate('endgames')}>
          <Icon name="left" />
        </button>
        <div className="lesson-top-text">
          <div className="eyebrow">Endgame drill · {drill.level}</div>
          <h1 className="lesson-title">{drill.title}</h1>
        </div>
        {next && (
          <Button variant="ghost" iconRight="right" onClick={() => navigate(`drill/${next.id}`)}>
            Next drill
          </Button>
        )}
      </div>
      <DrillPlayer key={drill.id} drill={drill} />
    </>
  );
}
