import { useEffect, useMemo, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import { openings, type Opening, type OpeningLine } from '../content';
import { navigate } from '../router';
import { getProfile, logActivity, updateProfile, useProfile } from '../store/profile';
import { review, isDue, MASTERED_BOX, DAY } from '../lib/srs';
import { paceMs } from '../lib/replyPace';
import { useScrollTopOn, useTimeouts } from '../lib/hooks';
import { Board, playMoveSound, type SquareTone } from '../chess/Board';
import { colorName, moveNumberLabel, START_FEN, turnOf, uciOf } from '../chess/utils';
import { BoardColumn } from '../components/BoardColumn';
import { Button, Feedback, Pill, RichText } from '../components/ui';
import { Icon } from '../components/Icon';
import { sound } from '../chess/sound';
import { MoveInput } from '../components/MoveInput';
import type { Arrow } from '../content/types';
import { SoundToggle } from '../components/SoundToggle';

type Mode = 'learn' | 'drill';

interface Ply {
  move: Move;
  uci: string;
  note?: string;
}

function expand(line: OpeningLine): Ply[] {
  const c = new Chess();
  return line.moves.split(' ').map((san, i) => {
    const move = c.move(san);
    return { move, uci: uciOf(move), note: line.notes[i + 1] };
  });
}

function lineStatus(id: string): { label: string; tone: 'neutral' | 'good' | 'warn' | 'info' } {
  const c = getProfile().lines[id];
  if (!c) return { label: 'New', tone: 'neutral' };
  if (c.box >= MASTERED_BOX) return { label: 'Mastered', tone: 'good' };
  if (isDue(c)) return { label: 'Due', tone: 'warn' };
  const days = Math.max(1, Math.round((c.due - Date.now()) / DAY));
  return { label: `Review in ${days}d`, tone: 'info' };
}

function Trainer({ opening, line, mode, onFinish }: { opening: Opening; line: OpeningLine; mode: Mode; onFinish: (mistakes: number) => void }) {
  const plies = useMemo(() => expand(line), [line]);
  const learnerTurn = opening.side === 'white' ? 'w' : 'b';
  const [ply, setPly] = useState(0); // number of plies played
  const [mistakes, setMistakes] = useState(0);
  const [tones, setTones] = useState<Record<string, SquareTone>>({});
  const [reveal, setReveal] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const { later } = useTimeouts();
  const done = ply >= plies.length;
  const fen = ply === 0 ? START_FEN : plies[ply - 1].move.after;
  const learnersMove = !done && turnOf(fen) === learnerTurn;

  // Auto-play the opponent's moves.
  useEffect(() => {
    if (done || learnersMove) return;
    const t = window.setTimeout(() => {
      playMoveSound(plies[ply].move.san);
      setPly((n) => n + 1);
      setTones({});
    }, paceMs(ply === 0 ? 700 : 850 + Math.random() * 350));
    return () => window.clearTimeout(t);
  }, [ply, done, learnersMove, plies]);

  useEffect(() => {
    if (done) {
      sound('complete');
      onFinish(mistakes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const onMove = (mv: Move) => {
    if (!learnersMove) return;
    if (uciOf(mv) === plies[ply].uci) {
      playMoveSound(mv.san);
      setTones({ [mv.to]: 'good' });
      setReveal(false);
      setFlash(null);
      setPly(ply + 1);
    } else {
      sound('bad');
      setMistakes((n) => n + 1);
      setTones({ [mv.to]: 'bad' });
      setReveal(true);
      setFlash(mv.san);
      later(() => setTones({}), 700);
    }
  };

  const showArrow = learnersMove && (mode === 'learn' || reveal);
  const arrows: Arrow[] = showArrow ? [{ from: plies[ply].move.from, to: plies[ply].move.to, color: mode === 'learn' ? 'green' : 'blue' }] : [];
  const lastMove = ply > 0 ? plies[ply - 1].move : null;
  const pendingNote = learnersMove && mode === 'learn' ? plies[ply].note : undefined;
  const shownNote = pendingNote ?? (ply > 0 ? plies[ply - 1].note : undefined);
  const shownNoteSan = pendingNote ? plies[ply].move.san : lastMove?.san;

  return (
    <div className="trainer">
      <BoardColumn>
        <div className="board-caption">
          <span className="player-tag">
            <span className={`side-dot ${learnerTurn}`} /> You play {colorName(learnerTurn)}
          </span>
          <span className="faint num">
            {Math.min(ply, plies.length)}/{plies.length}
          </span>
          <SoundToggle compact />
        </div>
        <Board
          fen={fen}
          orientation={opening.side}
          interactive={learnersMove}
          playerColor={learnerTurn}
          onMove={onMove}
          lastMove={lastMove ? [lastMove.from, lastMove.to] : null}
          arrows={arrows}
          tones={tones}
        />
        <MoveInput id="opening-move" fen={fen} color={learnerTurn} enabled={learnersMove} onMove={onMove} />
      </BoardColumn>
      <aside className="panel">
        <div className="panel-section">
          <div className="eyebrow">{mode === 'learn' ? 'Learn' : 'Drill from memory'}</div>
          <h2>{line.name}</h2>
          <p className="faint" style={{ fontSize: '0.86rem' }}>
            {opening.name}
          </p>
        </div>
        <div className="line-moves mono">
          {plies.map((p, i) => (
            <span key={i} className={`lm ${i < ply ? 'played' : ''} ${i === ply ? 'cur' : ''}`}>
              {i % 2 === 0 && <span className="faint">{moveNumberLabel(i)}</span>}
              {i < ply || (mode === 'learn' && i === ply) ? p.move.san : '···'}
            </span>
          ))}
        </div>
        {done ? (
          <Feedback
            tone={mistakes === 0 ? 'good' : 'warn'}
            icon={mistakes === 0 ? 'check' : 'refresh'}
            title={mistakes === 0 ? 'Line complete, no mistakes' : `Line complete, ${mistakes} slip${mistakes > 1 ? 's' : ''}`}
            body={mode === 'learn' ? 'It will come back for a memory drill tomorrow.' : mistakes === 0 ? 'The review interval grows.' : 'It will come back soon for another pass.'}
          />
        ) : learnersMove ? (
          <Feedback
            tone="info"
            icon={reveal || mode === 'learn' ? 'right' : 'bulb'}
            title={mode === 'learn' ? `Play ${plies[ply].move.san}` : reveal ? `The move is ${plies[ply].move.san}` : 'Your move'}
            body={flash && `${flash} is not in your repertoire here.`}
          />
        ) : (
          <div className="faint">Opponent is moving…</div>
        )}
        {shownNote && (mode === 'learn' || ply > 0) && (
          <div className="note-card">
            <span className="note-move mono">{shownNoteSan}</span>
            <RichText text={shownNote} />
          </div>
        )}
        {learnersMove && mode === 'drill' && !reveal && (
          <Button variant="ghost" icon="eye" onClick={() => { setReveal(true); setMistakes((n) => n + 1); }}>
            I forgot
          </Button>
        )}
      </aside>
    </div>
  );
}

export function OpeningPage({ id }: { id: string }) {
  const [openingId, query] = id.split('?');
  const opening = openings.find((o) => o.id === openingId);
  const p = useProfile();
  const dueIds = (o: Opening) => o.lines.filter((l) => isDue(p.lines[l.id])).map((l) => l.id);
  const [session, setSession] = useState<{ mode: Mode; queue: string[]; i: number; key: number; finished: boolean } | null>(() => {
    const due = query === 'review' && opening ? dueIds(opening) : [];
    return due.length ? { mode: 'drill', queue: due, i: 0, key: 0, finished: false } : null;
  });
  /** Starts a learn or drill session over the given lines. */
  const start = (mode: Mode, queue: string[]) => setSession((s) => ({ mode, queue, i: 0, key: (s?.key ?? 0) + 1, finished: false }));
  useScrollTopOn(session?.key);

  if (!opening) return <div className="empty">Opening not found.</div>;

  const record = (lineId: string, mode: Mode, mistakes: number) => {
    updateProfile((d) => {
      const prev = d.lines[lineId];
      const card = mode === 'learn' ? { box: Math.max(prev?.box ?? 0, 1), due: Date.now() + DAY - DAY / 8 } : review(prev, mistakes === 0);
      d.lines[lineId] = { ...card, reps: (prev?.reps ?? 0) + 1, lapses: (prev?.lapses ?? 0) + (mode === 'drill' && mistakes > 0 ? 1 : 0), t: Date.now() };
      logActivity(d, mode === 'learn' ? 15 : mistakes === 0 ? 8 : 4, 'lines');
    });
  };

  if (session) {
    const lineId = session.queue[session.i];
    const line = opening.lines.find((l) => l.id === lineId)!;
    const hasNext = session.i + 1 < session.queue.length;
    return (
      <>
        <div className="lesson-top">
          <button className="icon-btn" aria-label="Back to opening" onClick={() => setSession(null)}>
            <Icon name="left" />
          </button>
          <div className="lesson-top-text">
            <div className="eyebrow">{opening.name}</div>
            <h1 className="lesson-title">{session.mode === 'learn' ? 'Learn the line' : 'Memory drill'}</h1>
          </div>
          <div className="lesson-progress">
            <span className="num faint">
              Line {session.i + 1}/{session.queue.length}
            </span>
          </div>
        </div>
        <Trainer
          key={session.key}
          opening={opening}
          line={line}
          mode={session.mode}
          onFinish={(m) => {
            record(line.id, session.mode, m);
            setSession((s) => (s ? { ...s, finished: true } : s));
          }}
        />
        {session.finished && (
          <div className="lesson-nav">
            <Button variant="ghost" onClick={() => setSession({ ...session, key: session.key + 1, finished: false })} icon="refresh">
              Again
            </Button>
            {session.mode === 'learn' && (
              <Button onClick={() => start('drill', [line.id])} icon="repeat">
                Drill it now
              </Button>
            )}
            {hasNext ? (
              <Button variant="primary" size="l" iconRight="right" onClick={() => setSession({ ...session, i: session.i + 1, key: session.key + 1, finished: false })}>
                Next line
              </Button>
            ) : (
              <Button variant="primary" size="l" onClick={() => setSession(null)}>
                Done
              </Button>
            )}
          </div>
        )}
      </>
    );
  }

  const newLines = opening.lines.filter((l) => !p.lines[l.id]).map((l) => l.id);
  const dueList = dueIds(opening);
  return (
    <>
      <div className="lesson-top">
        <button className="icon-btn" aria-label="All openings" onClick={() => navigate('openings')}>
          <Icon name="left" />
        </button>
        <div className="lesson-top-text">
          <div className="eyebrow">
            {opening.eco} · Repertoire for {opening.side === 'white' ? 'White' : 'Black'}
          </div>
          <h1 className="lesson-title">{opening.name}</h1>
        </div>
      </div>
      <div className="opening-overview">
        <div className="card opening-about">
          <RichText text={opening.summary} />
          <h3 style={{ marginTop: 6 }}>Plans to remember</h3>
          <ul className="ideas">
            {opening.ideas.map((idea, i) => (
              <li key={i}>
                <RichText text={idea} />
              </li>
            ))}
          </ul>
          <div className="btn-row">
            {newLines.length > 0 && (
              <Button variant="primary" icon="learn" onClick={() => start('learn', newLines)}>
                Learn {newLines.length} new line{newLines.length > 1 ? 's' : ''}
              </Button>
            )}
            {dueList.length > 0 && (
              <Button variant={newLines.length ? 'secondary' : 'primary'} icon="repeat" onClick={() => start('drill', dueList)}>
                Review {dueList.length} due
              </Button>
            )}
            <Button variant="ghost" icon="target" onClick={() => start('drill', opening.lines.map((l) => l.id))}>
              Drill every line
            </Button>
          </div>
        </div>
        <div className="line-list">
          {opening.lines.map((l) => {
            const st = lineStatus(l.id);
            const sans = l.moves.split(' ');
            return (
              <div key={l.id} className="line-row card">
                <div className="line-row-text">
                  <div className="btn-row">
                    <h3>{l.name}</h3>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </div>
                  <div className="mono faint line-preview">
                    {sans.slice(0, 12).map((s, i) => (i % 2 === 0 ? moveNumberLabel(i) + s : s)).join(' ')}
                    {sans.length > 12 ? ' …' : ''}
                  </div>
                </div>
                <div className="btn-row">
                  <Button size="s" icon="learn" onClick={() => start('learn', [l.id])}>
                    Learn
                  </Button>
                  <Button size="s" variant="ghost" icon="repeat" onClick={() => start('drill', [l.id])}>
                    Drill
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
