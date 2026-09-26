import { useEffect, useMemo, useRef, useState } from 'react';
import { PuzzleFeedback, PuzzleSolver, type SolverApi } from '../components/PuzzleSolver';
import { puzzles, puzzleById, THEMES, PRACTICE_THEMES, type Puzzle } from '../data/puzzles';
import { getProfile, logActivity, updateProfile, useProfile, type Profile } from '../store/profile';
import { glicko } from '../lib/rating';
import { review, MASTERED_BOX } from '../lib/srs';
import { dueReviewPuzzles } from '../lib/due';
import { navigate } from '../router';
import { Button, PageHeader, Pill, Segmented } from '../components/ui';
import { Icon } from '../components/Icon';
import { sound } from '../chess/sound';

function pickPuzzle(p: Profile, theme: string | undefined, exclude: Set<string>, target?: number): Puzzle | null {
  const t = target ?? p.puzzles.rating + 25;
  const pool = puzzles.filter((z) => (!theme || z.themes.includes(theme)) && !exclude.has(z.id));
  if (!pool.length) return null;
  const unseen = pool.filter((z) => !p.puzzles.seen[z.id]);
  const use = unseen.length >= 5 ? unseen : pool;
  const sorted = use.slice().sort((a, b) => Math.abs(a.rating - t) - Math.abs(b.rating - t));
  const top = sorted.slice(0, Math.min(sorted.length, 20));
  return top[Math.floor(Math.random() * top.length)];
}

function recordPuzzle(pz: Puzzle, clean: boolean, opts: { rated: boolean; review?: boolean }) {
  let delta = 0;
  updateProfile((d) => {
    const P = d.puzzles;
    P.attempts++;
    if (clean) P.solved++;
    if (opts.rated) {
      const next = glicko(P.rating, P.rd, pz.rating, clean ? 1 : 0);
      delta = next.r - P.rating;
      P.rating = next.r;
      P.rd = next.rd;
      P.history.push({ t: Date.now(), r: next.r });
      if (P.history.length > 500) P.history.splice(0, P.history.length - 500);
    }
    P.seen[pz.id] = { ok: clean, t: Date.now() };
    for (const th of pz.themes) {
      const s = (P.themes[th] ??= { ok: 0, fail: 0 });
      if (clean) s.ok++;
      else s.fail++;
    }
    if (!clean) P.review[pz.id] = review(P.review[pz.id], false);
    else if (opts.review) {
      const c = review(P.review[pz.id], true);
      if (c.box >= MASTERED_BOX - 2) delete P.review[pz.id];
      else P.review[pz.id] = c;
    }
    logActivity(d, clean ? 12 : 3, 'puzzles');
  });
  return delta;
}

function ThemeList({ themes }: { themes: string[] }) {
  return (
    <div className="btn-row">
      {themes
        .filter((t) => THEMES[t])
        .map((t) => (
          <Pill key={t} tone="info">
            {THEMES[t].name}
          </Pill>
        ))}
    </div>
  );
}

function RatingBox({ rating, delta }: { rating: number; delta: number | null }) {
  return (
    <div className="rating-box">
      <div>
        <div className="stat-label">Puzzle rating</div>
        <div className="stat-value num">{rating}</div>
      </div>
      {delta !== null && delta !== 0 && <span className={`delta ${delta > 0 ? 'up' : 'down'} num`}>{delta > 0 ? `+${delta}` : delta}</span>}
    </div>
  );
}

function RatedSession({ theme }: { theme?: string }) {
  const profile = useProfile();
  const exclude = useRef(new Set<string>());
  const [puzzle, setPuzzle] = useState<Puzzle | null>(() => pickPuzzle(getProfile(), theme, exclude.current));
  const [delta, setDelta] = useState<number | null>(null);
  const [session, setSession] = useState({ ok: 0, n: 0, streak: 0 });
  const [key, setKey] = useState(0);

  const next = () => {
    if (puzzle) exclude.current.add(puzzle.id);
    setPuzzle(pickPuzzle(getProfile(), theme, exclude.current));
    setDelta(null);
    setKey((k) => k + 1);
  };

  if (!puzzle) return <div className="empty">No puzzles match this filter yet.</div>;

  return (
    <PuzzleSolver
      key={key}
      puzzle={puzzle}
      onFirstResult={(o) => {
        const d = recordPuzzle(puzzle, o.clean, { rated: true });
        setDelta(d);
        setSession((s) => ({ ok: s.ok + (o.clean ? 1 : 0), n: s.n + 1, streak: o.clean ? s.streak + 1 : 0 }));
        if (o.clean) {
          updateProfile((dd) => {
            dd.puzzles.bestStreak = Math.max(dd.puzzles.bestStreak, session.streak + 1);
          });
        }
      }}
    >
      {(api) => (
        <aside className="panel">
          <RatingBox rating={profile.puzzles.rating} delta={delta} />
          <div className="panel-divider" />
          <PanelBody api={api} puzzle={puzzle} onNext={next} />
          <div className="panel-divider" />
          <div className="session-line">
            <span>
              This session: <strong className="num">{session.ok}</strong>/<span className="num">{session.n}</span>
            </span>
            {session.streak >= 2 && (
              <Pill tone="warn" icon="flame">
                {session.streak} in a row
              </Pill>
            )}
          </div>
        </aside>
      )}
    </PuzzleSolver>
  );
}

function PanelBody({ api, puzzle, onNext, nextLabel = 'Next puzzle' }: { api: SolverApi; puzzle: Puzzle; onNext: () => void; nextLabel?: string }) {
  const finished = api.status === 'solved' || api.status === 'viewing';
  // Keyboard: Enter/→ for next when finished, H for hint.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (finished && (e.key === 'Enter' || e.key === 'ArrowRight')) onNext();
      if (!finished && e.key.toLowerCase() === 'h') api.hint();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished, onNext, api]);

  return (
    <div className="panel-section">
      <div className="to-move">
        <span className={`side-dot ${api.solverColor}`} />
        {api.status === 'intro' ? 'Get ready…' : api.goal}
      </div>
      <PuzzleFeedback api={api} />
      {api.status === 'solving' && api.mistakes > 0 && (
        <div className="feedback feedback-warn">
          <Icon name="refresh" />
          <div>
            <strong>Try again</strong>
            <span className="feedback-body">This one no longer counts for rating, so take your time.</span>
          </div>
        </div>
      )}
      {finished && <ThemeList themes={puzzle.themes} />}
      {finished && (
        <p className="faint" style={{ fontSize: '0.82rem' }}>
          Puzzle rating <span className="num">{puzzle.rating}</span>
        </p>
      )}
      <div className="btn-row">
        {!finished && (
          <>
            <Button icon="bulb" onClick={api.hint} disabled={api.status !== 'solving'}>
              {api.hintLevel === 0 ? 'Hint' : 'Show move'}
            </Button>
            <Button variant="ghost" icon="eye" onClick={api.showSolution} disabled={api.status === 'intro'}>
              Solution
            </Button>
          </>
        )}
        {finished && (
          <>
            <Button variant="primary" iconRight="right" onClick={onNext}>
              {nextLabel}
            </Button>
            <Button variant="ghost" icon="refresh" onClick={api.retry}>
              Replay
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ReviewSession() {
  const profile = useProfile();
  const [queue, setQueue] = useState(() => dueReviewPuzzles(getProfile()));
  const [key, setKey] = useState(0);
  const id = queue[0];
  const puzzle = id ? puzzleById.get(id) : undefined;
  if (!puzzle)
    return (
      <div className="empty">
        <h3>Nothing to review right now</h3>
        <p style={{ marginTop: 6 }}>Puzzles you miss come back here after 10 minutes, then again on a growing schedule until you solve them cleanly.</p>
        <div className="btn-row" style={{ justifyContent: 'center', marginTop: 14 }}>
          <Button variant="primary" onClick={() => navigate('puzzles')}>
            Solve rated puzzles
          </Button>
        </div>
      </div>
    );
  return (
    <PuzzleSolver key={key} puzzle={puzzle} onFirstResult={(o) => recordPuzzle(puzzle, o.clean, { rated: false, review: true })}>
      {(api) => (
        <aside className="panel">
          <div>
            <div className="stat-label">Review queue</div>
            <div className="stat-value num">{queue.length}</div>
          </div>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            You missed these before. Solve each one cleanly to push it further out. Rating is not affected.
          </p>
          <div className="panel-divider" />
          <PanelBody
            api={api}
            puzzle={puzzle}
            nextLabel={queue.length > 1 ? 'Next review' : 'Finish'}
            onNext={() => {
              setQueue((q) => q.slice(1));
              setKey((k) => k + 1);
            }}
          />
          <div className="faint" style={{ fontSize: '0.8rem' }}>
            Total in review: {Object.keys(profile.puzzles.review).length}
          </div>
        </aside>
      )}
    </PuzzleSolver>
  );
}

const RUSH_SECONDS = 180;

function RushSession() {
  const profile = useProfile();
  const [phase, setPhase] = useState<'ready' | 'running' | 'over'>('ready');
  const [score, setScore] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [left, setLeft] = useState(RUSH_SECONDS);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [key, setKey] = useState(0);
  const used = useRef(new Set<string>());
  const scoreRef = useRef(0);
  const strikesRef = useRef(0);
  const endedRef = useRef(false);
  const prevBest = useRef(0);

  const nextPuzzle = (solved: number) => {
    const target = 500 + solved * 55;
    const p = pickPuzzle(getProfile(), undefined, used.current, target);
    if (p) used.current.add(p.id);
    setPuzzle(p);
    setKey((k) => k + 1);
  };

  const start = () => {
    used.current = new Set();
    scoreRef.current = 0;
    strikesRef.current = 0;
    endedRef.current = false;
    prevBest.current = getProfile().puzzles.rushBest;
    setScore(0);
    setStrikes(0);
    setLeft(RUSH_SECONDS);
    setPhase('running');
    nextPuzzle(0);
  };

  const end = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    setPhase('over');
    const s = scoreRef.current;
    const tried = s + strikesRef.current;
    sound('complete');
    updateProfile((d) => {
      d.puzzles.rushBest = Math.max(d.puzzles.rushBest, s);
      logActivity(d, 5 + s * 3, 'puzzles', tried);
    });
  };

  // The clock only counts down; running out is handled by the effect below.
  useEffect(() => {
    if (phase !== 'running') return;
    const t = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'running') return;
    if (left === 0) end();
    else if (left <= 10) sound('tick');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase]);

  if (phase !== 'running' || !puzzle) {
    return (
      <div className="rush-intro card">
        <div className="rush-intro-text">
          <div className="eyebrow">Puzzle Rush</div>
          <h2>{phase === 'over' ? `You solved ${score}` : 'Three minutes. Three strikes.'}</h2>
          <p className="muted">
            {phase === 'over'
              ? score > prevBest.current
                ? 'A new personal best. Speed comes from patterns you recognise instantly.'
                : `Your best is ${profile.puzzles.rushBest}. Speed comes from patterns you recognise instantly.`
              : 'Puzzles start easy and get harder with every solve. A wrong move costs a strike. Pattern speed is what wins games in time trouble.'}
          </p>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <Button variant="primary" size="l" icon="clock" onClick={start}>
              {phase === 'over' ? 'Run it again' : 'Start the clock'}
            </Button>
            <span className="muted">
              Best: <strong className="num">{profile.puzzles.rushBest}</strong>
            </span>
          </div>
        </div>
      </div>
    );
  }

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <PuzzleSolver
      key={key}
      puzzle={puzzle}
      strict
      onComplete={(clean) => {
        if (clean) {
          scoreRef.current += 1;
          setScore(scoreRef.current);
          window.setTimeout(() => nextPuzzle(scoreRef.current), 350);
        } else {
          strikesRef.current += 1;
          setStrikes(strikesRef.current);
          if (strikesRef.current >= 3) window.setTimeout(end, 900);
          else window.setTimeout(() => nextPuzzle(scoreRef.current), 1100);
        }
      }}
    >
      {(api) => (
        <aside className="panel">
          <div className="rush-head">
            <div>
              <div className="stat-label">Time</div>
              <div className={`stat-value num ${left <= 10 ? 'danger' : ''}`}>
                {mm}:{ss}
              </div>
            </div>
            <div>
              <div className="stat-label">Solved</div>
              <div className="stat-value num">{score}</div>
            </div>
            <div className="strikes" aria-label={`${strikes} of 3 strikes`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={i < strikes ? 'strike on' : 'strike'}>
                  <Icon name="x" size={14} />
                </span>
              ))}
            </div>
          </div>
          <div className="panel-divider" />
          <div className="to-move">
            <span className={`side-dot ${api.solverColor}`} />
            {api.status === 'intro' ? 'Get ready…' : api.goal}
          </div>
          <PuzzleFeedback api={api} />
          <Button variant="ghost" icon="flag" onClick={end}>
            End run
          </Button>
        </aside>
      )}
    </PuzzleSolver>
  );
}

function ThemePicker({ value, onChange }: { value?: string; onChange: (t?: string) => void }) {
  const p = useProfile();
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const z of puzzles) for (const t of z.themes) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  }, []);
  return (
    <div className="theme-picker">
      <button className={`theme-chip ${!value ? 'on' : ''}`} onClick={() => onChange(undefined)}>
        Mixed
      </button>
      {PRACTICE_THEMES.filter((t) => (counts.get(t) ?? 0) >= 3).map((t) => {
        const s = p.puzzles.themes[t];
        const n = s ? s.ok + s.fail : 0;
        const pct = n ? Math.round((s!.ok / n) * 100) : null;
        return (
          <button key={t} className={`theme-chip ${value === t ? 'on' : ''}`} onClick={() => onChange(t)} title={THEMES[t]?.text}>
            {THEMES[t]?.name ?? t}
            {pct !== null && <span className="num faint">{pct}%</span>}
          </button>
        );
      })}
    </div>
  );
}

export function PuzzlesPage({ mode }: { mode?: string }) {
  const p = useProfile();
  const due = dueReviewPuzzles(p).length;
  const tab = mode === 'rush' ? 'rush' : mode === 'review' ? 'review' : 'rated';
  const theme = mode?.startsWith('theme-') ? mode.slice(6) : undefined;
  return (
    <>
      <PageHeader
        eyebrow="Tactics"
        title={tab === 'rush' ? 'Puzzle Rush' : tab === 'review' ? 'Review mistakes' : theme ? THEMES[theme]?.name ?? 'Puzzles' : 'Rated puzzles'}
        actions={
          <Segmented
            label="Puzzle mode"
            value={tab}
            onChange={(v) => navigate(v === 'rated' ? 'puzzles' : `puzzles/${v}`, { replace: true })}
            options={[
              { value: 'rated', label: 'Rated' },
              { value: 'rush', label: 'Rush' },
              { value: 'review', label: due ? `Review · ${due}` : 'Review' },
            ]}
          />
        }
      >
      </PageHeader>
      {tab === 'rated' && <ThemePicker value={theme} onChange={(t) => navigate(t ? `puzzles/theme-${t}` : 'puzzles', { replace: true })} />}
      {tab === 'rated' && <RatedSession key={theme ?? 'mixed'} theme={theme} />}
      {tab === 'rush' && <RushSession />}
      {tab === 'review' && <ReviewSession />}
    </>
  );
}
