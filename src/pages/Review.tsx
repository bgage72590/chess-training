import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import { engine, whitePov, winPercent, type Score } from '../engine/engine';
import { logActivity, updateProfile, useProfile, type GameRecord } from '../store/profile';
import { summarize, winFor } from '../lib/analysis';
import { Board, playMoveSound, type BoardMove } from '../chess/Board';
import { parseUci, pvToSan, uciOf } from '../chess/utils';
import { navigate } from '../router';
import { Button, Pill, ProgressBar } from '../components/ui';
import { Icon } from '../components/Icon';
import { CLASS_GLYPH, CLASS_LABEL, EvalBar, EvalGraph, MoveList } from '../components/GameBits';
import { EngineNotice } from '../components/EngineNotice';
import { LEVELS } from './Play';
import { sound } from '../chess/sound';
import type { Arrow } from '../content/types';

function replay(game: GameRecord): Move[] {
  const c = new Chess(game.startFen);
  const out: Move[] = [];
  for (const u of game.moves) {
    try {
      out.push(c.move(parseUci(u)));
    } catch {
      break;
    }
  }
  return out;
}

function useAnalysis(game: GameRecord | undefined, moves: Move[]) {
  const [progress, setProgress] = useState(0);
  const running = useRef(false);
  useEffect(() => {
    if (!game || game.review || running.current) return;
    running.current = true;
    let alive = true;
    (async () => {
      const fens = [game.startFen, ...moves.map((m) => m.after)];
      const evals: Score[] = [];
      const best: string[] = [];
      for (let i = 0; i < fens.length; i++) {
        const c = new Chess(fens[i]);
        if (c.isCheckmate()) {
          // The side to move is mated: express it from White's point of view.
          evals.push(c.turn() === 'w' ? { mate: -1 } : { mate: 1 });
          best.push('');
        } else if (c.isDraw()) {
          evals.push({ cp: 0 });
          best.push('');
        } else {
          const r = await engine.search(fens[i], { depth: 12 });
          if (!alive) return;
          const s = r.lines[0]?.score ?? { cp: 0 };
          evals.push(whitePov(s, c.turn()));
          best.push(r.bestmove);
        }
        setProgress((i + 1) / fens.length);
      }
      const { classes, accuracy } = summarize(evals, game.moves, best, game.startFen.split(' ')[1] as 'w' | 'b');
      updateProfile((d) => {
        const g = d.games.find((x) => x.id === game.id);
        if (g) g.review = { evals, best, classes, accuracy };
        logActivity(d, 10, 'games', 0);
      });
      running.current = false;
    })();
    return () => {
      alive = false;
      engine.cancelAll();
      running.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, !!game?.review]);
  return progress;
}

export function ReviewPage({ id }: { id: string }) {
  const p = useProfile();
  const game = p.games.find((g) => g.id === id);
  const moves = useMemo(() => (game ? replay(game) : []), [game?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const progress = useAnalysis(game, moves);
  const [ply, setPly] = useState(0);
  const [retry, setRetry] = useState<{ ply: number; state: 'try' | 'good' | 'bad'; msg?: string } | null>(null);
  const [retryFen, setRetryFen] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (retry) return;
      if (e.key === 'ArrowRight') setPly((x) => Math.min(moves.length, x + 1));
      if (e.key === 'ArrowLeft') setPly((x) => Math.max(0, x - 1));
      if (e.key === 'Home') setPly(0);
      if (e.key === 'End') setPly(moves.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moves.length, retry]);

  if (!game) return <div className="empty">Game not found. <Button onClick={() => navigate('games')}>All games</Button></div>;

  const rv = game.review;
  const fen = ply === 0 ? game.startFen : moves[ply - 1].after;
  const me = game.playerColor;
  const orientation = me === 'w' ? 'white' : 'black';
  const lvl = LEVELS[game.level - 1];

  const moveIdx = ply - 1; // index of the move that led here
  const cls = rv && moveIdx >= 0 ? rv.classes[moveIdx] : undefined;
  const bestHere = rv && moveIdx >= 0 ? rv.best[moveIdx] : undefined;
  const arrows: Arrow[] = [];
  if (rv && moveIdx >= 0 && bestHere && cls && cls !== 'best' && cls !== 'good') {
    const b = parseUci(bestHere);
    arrows.push({ from: b.from, to: b.to, color: 'green' });
  }
  const last = moveIdx >= 0 ? moves[moveIdx] : null;

  const keyMoments = rv ? rv.classes.map((c, i) => ({ c, i })).filter(({ c, i }) => (c === 'mistake' || c === 'blunder') && moves[i]?.color === me) : [];
  const counts = (side: 'w' | 'b') => {
    const out = { inaccuracy: 0, mistake: 0, blunder: 0 };
    rv?.classes.forEach((c, i) => {
      if (moves[i]?.color === side && (c === 'inaccuracy' || c === 'mistake' || c === 'blunder')) out[c]++;
    });
    return out;
  };

  const startRetry = (i: number) => {
    setPly(i);
    setRetry({ ply: i, state: 'try' });
    setRetryFen(i === 0 ? game.startFen : moves[i - 1].after);
  };

  const onRetryMove = async (m: BoardMove) => {
    if (!retry || !rv || retry.state !== 'try') return;
    const base = retry.ply === 0 ? game.startFen : moves[retry.ply - 1].after;
    const c = new Chess(base);
    let mv: Move;
    try {
      mv = c.move({ from: m.from, to: m.to, promotion: m.promotion });
    } catch {
      return;
    }
    setRetryFen(c.fen());
    playMoveSound(mv.san);
    const bestUci = rv.best[retry.ply];
    if (uciOf(mv) === bestUci) {
      sound('good');
      setRetry({ ...retry, state: 'good', msg: `${mv.san} is the engine's choice.` });
      updateProfile((d) => logActivity(d, 8, 'puzzles', 0));
      return;
    }
    const r = await engine.search(c.fen(), { depth: 12 });
    const s = whitePov(r.lines[0]?.score ?? { cp: 0 }, c.turn());
    const before = winFor(rv.evals[retry.ply], me);
    const after = winFor(s, me);
    if (before - after < 6) {
      sound('good');
      setRetry({ ...retry, state: 'good', msg: `${mv.san} works too: it keeps the evaluation.` });
      updateProfile((d) => logActivity(d, 8, 'puzzles', 0));
    } else {
      sound('bad');
      setRetry({ ...retry, state: 'bad', msg: `${mv.san} still costs you. Try again or reveal the best move.` });
    }
  };

  const nextMoment = keyMoments.find(({ i }) => i > (retry?.ply ?? ply) - 1);

  return (
    <>
      <div className="lesson-top">
        <button className="icon-btn" aria-label="All games" onClick={() => navigate('games')}>
          <Icon name="left" />
        </button>
        <div className="lesson-top-text">
          <div className="eyebrow">
            Game review · vs {lvl?.name ?? 'Coach'} · {new Date(game.t).toLocaleDateString()}
          </div>
          <h1 className="lesson-title">
            {game.result === '1/2-1/2' ? 'Draw' : (game.result === '1-0') === (me === 'w') ? 'Win' : 'Loss'} by {game.reason.toLowerCase()}
          </h1>
        </div>
      </div>
      {!rv && (
        <div className="card">
          <EngineNotice />
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <strong>Analysing every move with Stockfish…</strong>
            <span className="num faint">{Math.round(progress * 100)}%</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <ProgressBar value={progress} />
          </div>
        </div>
      )}
      <div className="trainer" style={{ '--board-offset': '330px' } as React.CSSProperties}>
        <div className="trainer-board">
          <div className="board-with-eval">
            <EvalBar score={rv ? rv.evals[retry ? retry.ply : ply] : undefined} orientation={orientation} />
            {retry ? (
              <Board fen={retryFen ?? fen} orientation={orientation} interactive={retry.state === 'try'} playerColor={me} onMove={onRetryMove} />
            ) : (
              <Board fen={fen} orientation={orientation} lastMove={last ? [last.from, last.to] : null} arrows={arrows} />
            )}
          </div>
          {rv && <EvalGraph evals={rv.evals} current={ply} onSelect={(i) => { setRetry(null); setPly(i); }} classes={rv.classes} />}
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button className="icon-btn" aria-label="Start" onClick={() => { setRetry(null); setPly(0); }}>
              <Icon name="first" />
            </button>
            <button className="icon-btn" aria-label="Previous move" onClick={() => { setRetry(null); setPly(Math.max(0, ply - 1)); }}>
              <Icon name="prev" />
            </button>
            <button className="icon-btn" aria-label="Next move" onClick={() => { setRetry(null); setPly(Math.min(moves.length, ply + 1)); }}>
              <Icon name="next" />
            </button>
            <button className="icon-btn" aria-label="End" onClick={() => { setRetry(null); setPly(moves.length); }}>
              <Icon name="last" />
            </button>
          </div>
        </div>
        <aside className="panel">
          {rv && (
            <div className="acc-row">
              {(['w', 'b'] as const).map((side) => {
                const c = counts(side);
                return (
                  <div key={side} className={`acc ${side === me ? 'me' : ''}`}>
                    <div className="stat-label">
                      <span className={`side-dot ${side}`} /> {side === me ? 'You' : lvl?.name ?? 'Coach'}
                    </div>
                    <div className="stat-value num">{rv.accuracy[side]}%</div>
                    <div className="acc-counts num">
                      <span className="glyph-inaccuracy">{c.inaccuracy} ?!</span>
                      <span className="glyph-mistake">{c.mistake} ?</span>
                      <span className="glyph-blunder">{c.blunder} ??</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {retry ? (
            <div className="panel-section">
              <div className="eyebrow">Retry the moment</div>
              <p>Find a better move than the one you played.</p>
              {retry.msg && (
                <div className={`feedback ${retry.state === 'good' ? 'feedback-good' : 'feedback-bad'}`}>
                  <Icon name={retry.state === 'good' ? 'check' : 'x'} />
                  <div>
                    <span className="feedback-body">{retry.msg}</span>
                  </div>
                </div>
              )}
              <div className="btn-row">
                {retry.state === 'bad' && (
                  <Button onClick={() => { setRetry({ ply: retry.ply, state: 'try' }); setRetryFen(retry.ply === 0 ? game.startFen : moves[retry.ply - 1].after); }} icon="refresh">
                    Try again
                  </Button>
                )}
                {retry.state !== 'good' && (
                  <Button variant="ghost" icon="eye" onClick={() => { setRetry(null); setPly(retry.ply + 1); }}>
                    Reveal
                  </Button>
                )}
                {nextMoment && retry.state === 'good' ? (
                  <Button variant="primary" iconRight="right" onClick={() => startRetry(nextMoment.i)}>
                    Next mistake
                  </Button>
                ) : (
                  retry.state === 'good' && (
                    <Button variant="primary" onClick={() => { setRetry(null); setPly(retry.ply + 1); }}>
                      Back to review
                    </Button>
                  )
                )}
              </div>
            </div>
          ) : (
            rv &&
            moveIdx >= 0 &&
            cls && (
              <div className={`move-verdict verdict-${cls}`}>
                <div className="verdict-head">
                  <span className="mono">
                    {moves[moveIdx].san}
                    {CLASS_GLYPH[cls]}
                  </span>
                  <Pill tone={cls === 'blunder' || cls === 'mistake' ? 'bad' : cls === 'inaccuracy' ? 'warn' : 'good'}>{CLASS_LABEL[cls]}</Pill>
                </div>
                {bestHere && cls !== 'best' && cls !== 'good' && (
                  <p className="muted">
                    Better was <strong className="mono">{pvToSan(moveIdx === 0 ? game.startFen : moves[moveIdx - 1].after, [bestHere])[0]}</strong>. Win chance{' '}
                    {Math.round(winFor(rv.evals[moveIdx], moves[moveIdx].color))}% → {Math.round(winFor(rv.evals[moveIdx + 1], moves[moveIdx].color))}%.
                  </p>
                )}
                {moves[moveIdx].color === me && (cls === 'mistake' || cls === 'blunder') && (
                  <Button size="s" icon="target" onClick={() => startRetry(moveIdx)}>
                    Retry this move
                  </Button>
                )}
              </div>
            )
          )}
          <MoveList sans={moves.map((m) => m.san)} current={ply} onSelect={(i) => { setRetry(null); setPly(i); }} classes={rv?.classes} />
          {rv && keyMoments.length > 0 && !retry && (
            <div className="panel-section">
              <h3>Your key moments</h3>
              <div className="moments">
                {keyMoments.map(({ c, i }) => (
                  <button key={i} className="moment" onClick={() => startRetry(i)}>
                    <span className={`glyph glyph-${c}`}>{CLASS_GLYPH[c]}</span>
                    <span className="mono">
                      {Math.floor(i / 2) + 1}
                      {i % 2 === 0 ? '.' : '...'}
                      {moves[i].san}
                    </span>
                    <span className="faint">{Math.round(winFor(rv.evals[i], me) - winFor(rv.evals[i + 1], me))}% lost</span>
                    <Icon name="right" size={16} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {rv && keyMoments.length === 0 && (
            <div className="feedback feedback-good">
              <Icon name="star" />
              <div>
                <strong>No mistakes or blunders</strong>
                <span className="feedback-body">Try the next level up.</span>
              </div>
            </div>
          )}
          <div className="faint" style={{ fontSize: '0.8rem' }}>
            Final evaluation: {rv ? `${Math.round(winPercent(rv.evals[rv.evals.length - 1]))}% for White` : '—'}
          </div>
        </aside>
      </div>
    </>
  );
}
