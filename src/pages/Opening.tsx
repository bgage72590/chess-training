import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { openings, type Opening, type OpeningLine } from '../content';
import { navigate } from '../router';
import { getProfile, logActivity, updateProfile, useProfile } from '../store/profile';
import { review, MASTERED_BOX, DAY } from '../lib/srs';
import { Board, playMoveSound, type BoardMove, type SquareTone } from '../chess/Board';
import { uciOf } from '../chess/utils';
import { Button, Pill, RichText } from '../components/ui';
import { Icon } from '../components/Icon';
import { sound } from '../chess/sound';
import type { Arrow } from '../content/types';

type Mode = 'learn' | 'drill';

interface Ply {
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  note?: string;
}

function expand(line: OpeningLine): Ply[] {
  const c = new Chess();
  return line.moves.split(' ').map((san, i) => {
    const fenBefore = c.fen();
    const m = c.move(san);
    return { san: m.san, uci: uciOf(m), fenBefore, fenAfter: c.fen(), note: line.notes[i + 1] };
  });
}

function lineStatus(id: string): { label: string; tone: 'neutral' | 'good' | 'warn' | 'info' } {
  const c = getProfile().lines[id];
  if (!c) return { label: 'New', tone: 'neutral' };
  if (c.box >= MASTERED_BOX) return { label: 'Mastered', tone: 'good' };
  if (c.due <= Date.now()) return { label: 'Due', tone: 'warn' };
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
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const done = ply >= plies.length;
  const fen = ply === 0 ? new Chess().fen() : plies[ply - 1].fenAfter;
  const turn = fen.split(' ')[1];
  const learnersMove = !done && turn === learnerTurn;

  // Auto-play the opponent's moves.
  useEffect(() => {
    if (done || learnersMove) return;
    const t = window.setTimeout(() => {
      playMoveSound(plies[ply].san);
      setPly((n) => n + 1);
      setTones({});
    }, ply === 0 ? 500 : 650);
    timers.current.push(t);
    return () => window.clearTimeout(t);
  }, [ply, done, learnersMove, plies]);

  useEffect(() => {
    if (done) {
      sound('complete');
      onFinish(mistakes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const onMove = (m: BoardMove) => {
    if (!learnersMove) return;
    const want = plies[ply];
    const c = new Chess(fen);
    let mv;
    try {
      mv = c.move({ from: m.from, to: m.to, promotion: m.promotion });
    } catch {
      return;
    }
    if (uciOf(mv) === want.uci) {
      playMoveSound(mv.san);
      setTones({ [mv.to]: 'good' });
      setReveal(false);
      setFlash(null);
      setPly(ply + 1);
    } else {
      sound('bad');
      setMistakes((n) => n + 1);
      setTones({ [m.to]: 'bad' });
      setReveal(true);
      setFlash(mv.san);
      timers.current.push(window.setTimeout(() => setTones({}), 700));
    }
  };

  const showArrow = learnersMove && (mode === 'learn' || reveal);
  const arrows: Arrow[] = showArrow ? [{ from: plies[ply].uci.slice(0, 2), to: plies[ply].uci.slice(2, 4), color: mode === 'learn' ? 'green' : 'blue' }] : [];
  const lastPly = ply > 0 ? plies[ply - 1] : null;
  const pendingNote = learnersMove && mode === 'learn' ? plies[ply].note : undefined;
  const shownNote = pendingNote ?? lastPly?.note;
  const shownNoteSan = pendingNote ? plies[ply].san : lastPly?.san;

  return (
    <div className="trainer">
      <div className="trainer-board">
        <div className="board-caption">
          <span className="player-tag">
            <span className={`side-dot ${learnerTurn}`} /> You play {opening.side === 'white' ? 'White' : 'Black'}
          </span>
          <span className="faint num">
            {Math.min(ply, plies.length)}/{plies.length}
          </span>
        </div>
        <Board
          fen={fen}
          orientation={opening.side}
          interactive={learnersMove}
          playerColor={learnerTurn}
          onMove={onMove}
          lastMove={lastPly ? [lastPly.uci.slice(0, 2), lastPly.uci.slice(2, 4)] : null}
          arrows={arrows}
          tones={tones}
        />
      </div>
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
              {i % 2 === 0 && <span className="faint">{i / 2 + 1}.</span>}
              {i < ply || (mode === 'learn' && i === ply) ? p.san : '···'}
            </span>
          ))}
        </div>
        {done ? (
          <div className={`feedback ${mistakes === 0 ? 'feedback-good' : 'feedback-warn'}`}>
            <Icon name={mistakes === 0 ? 'check' : 'refresh'} />
            <div>
              <strong>{mistakes === 0 ? 'Line complete, no mistakes' : `Line complete, ${mistakes} slip${mistakes > 1 ? 's' : ''}`}</strong>
              <span className="feedback-body">{mode === 'learn' ? 'It will come back for a memory drill tomorrow.' : mistakes === 0 ? 'The review interval grows.' : 'It will come back soon for another pass.'}</span>
            </div>
          </div>
        ) : learnersMove ? (
          <div className="feedback feedback-info">
            <Icon name={reveal || mode === 'learn' ? 'right' : 'bulb'} />
            <div>
              <strong>{mode === 'learn' ? `Play ${plies[ply].san}` : reveal ? `The move is ${plies[ply].san}` : 'Your move'}</strong>
              {flash && <span className="feedback-body">{flash} is not in your repertoire here.</span>}
            </div>
          </div>
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
  const [session, setSession] = useState<{ mode: Mode; queue: string[]; i: number; key: number; finished: boolean } | null>(() => {
    if (query === 'review' && opening) {
      const due = opening.lines.filter((l) => p.lines[l.id] && p.lines[l.id].due <= Date.now()).map((l) => l.id);
      return due.length ? { mode: 'drill', queue: due, i: 0, key: 0, finished: false } : null;
    }
    return null;
  });

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
              <Button onClick={() => setSession({ mode: 'drill', queue: [line.id], i: 0, key: session.key + 1, finished: false })} icon="repeat">
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

  const newLines = opening.lines.filter((l) => !p.lines[l.id]);
  const dueList = opening.lines.filter((l) => p.lines[l.id] && p.lines[l.id].due <= Date.now());
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
              <Button variant="primary" icon="learn" onClick={() => setSession({ mode: 'learn', queue: newLines.map((l) => l.id), i: 0, key: 0, finished: false })}>
                Learn {newLines.length} new line{newLines.length > 1 ? 's' : ''}
              </Button>
            )}
            {dueList.length > 0 && (
              <Button variant={newLines.length ? 'secondary' : 'primary'} icon="repeat" onClick={() => setSession({ mode: 'drill', queue: dueList.map((l) => l.id), i: 0, key: 0, finished: false })}>
                Review {dueList.length} due
              </Button>
            )}
            <Button variant="ghost" icon="target" onClick={() => setSession({ mode: 'drill', queue: opening.lines.map((l) => l.id), i: 0, key: 0, finished: false })}>
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
                    {sans.slice(0, 12).map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}.${s}` : s)).join(' ')}
                    {sans.length > 12 ? ' …' : ''}
                  </div>
                </div>
                <div className="btn-row">
                  <Button size="s" icon="learn" onClick={() => setSession({ mode: 'learn', queue: [l.id], i: 0, key: 0, finished: false })}>
                    Learn
                  </Button>
                  <Button size="s" variant="ghost" icon="repeat" onClick={() => setSession({ mode: 'drill', queue: [l.id], i: 0, key: 0, finished: false })}>
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
