import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board, type BoardMove, type SquareTone } from '../chess/Board';
import { FILES, playUci, randomItem, shuffle, colorName } from '../chess/utils';
import { puzzles } from '../data/puzzles';
import { getProfile, logActivity, updateProfile, useProfile } from '../store/profile';
import { navigate } from '../router';
import { Button, PageHeader, Pill, Segmented } from '../components/ui';
import { Icon } from '../components/Icon';
import { sound } from '../chess/sound';
import type { Arrow, Mark } from '../content/types';

const ALL_SQUARES = Array.from({ length: 64 }, (_, i) => FILES[i % 8] + (Math.floor(i / 8) + 1));
const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

function saveBest(key: string, score: number) {
  const prev = getProfile().vision[key] ?? 0;
  updateProfile((d) => {
    d.vision[key] = Math.max(prev, score);
    logActivity(d, 5 + Math.min(20, Math.floor(score / 2)), 'vision');
  });
  return score > prev;
}

/* ---------- Coordinates ---------- */
function CoordsDrill({ mode }: { mode: 'find' | 'name' }) {
  const p = useProfile();
  const [side, setSide] = useState<'white' | 'black'>('white');
  const [phase, setPhase] = useState<'ready' | 'run' | 'done'>('ready');
  const [target, setTarget] = useState('e4');
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [left, setLeft] = useState(30);
  const [tones, setTones] = useState<Record<string, SquareTone>>({});
  const [options, setOptions] = useState<string[]>([]);
  const [newBest, setNewBest] = useState(false);
  const scoreRef = useRef(0);
  const key = `coords-${mode}-${side}`;

  const nextTarget = (prev?: string) => {
    let t = randomItem(ALL_SQUARES);
    while (t === prev) t = randomItem(ALL_SQUARES);
    setTarget(t);
    if (mode === 'name') {
      const near = ALL_SQUARES.filter((s) => s !== t && (s[0] === t[0] || s[1] === t[1] || Math.abs(s.charCodeAt(0) - t.charCodeAt(0)) <= 1));
      setOptions(shuffle([t, ...shuffle(near).slice(0, 3)]));
    }
  };

  const start = () => {
    scoreRef.current = 0;
    setScore(0);
    setMisses(0);
    setLeft(30);
    setTones({});
    setPhase('run');
    nextTarget();
  };

  useEffect(() => {
    if (phase !== 'run') return;
    const t = window.setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          window.clearInterval(t);
          setPhase('done');
          setNewBest(saveBest(key, scoreRef.current));
          sound('complete');
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const answer = (sq: string) => {
    if (phase !== 'run') return;
    if (sq === target) {
      scoreRef.current++;
      setScore(scoreRef.current);
      setTones({ [sq]: 'good' });
      sound('tick');
    } else {
      setMisses((m) => m + 1);
      setTones({ [sq]: 'bad', [target]: 'hint' });
      sound('bad');
    }
    window.setTimeout(() => setTones({}), 250);
    nextTarget(target);
  };

  const best = p.vision[key] ?? 0;
  return (
    <div className="trainer">
      <div className="trainer-board">
        <div className="coord-prompt" aria-live="polite">
          {phase === 'run' ? (mode === 'find' ? <span className="mono">{target}</span> : <span className="faint">Name the marked square</span>) : <span className="faint">{mode === 'find' ? 'Click the named square' : 'Name the marked square'}</span>}
        </div>
        <Board
          fen={EMPTY_FEN}
          orientation={side}
          coordinates={false}
          onSquareClick={mode === 'find' ? answer : undefined}
          tones={mode === 'name' && phase === 'run' ? { ...tones, [target]: 'focus' } : tones}
          drawable={false}
        />
      </div>
      <aside className="panel">
        <div className="panel-section">
          <h2>{mode === 'find' ? 'Find the square' : 'Name the square'}</h2>
          <p className="muted">Strong players see squares as names without thinking. Thirty seconds, as many as you can. Train both sides of the board.</p>
        </div>
        {phase === 'run' && (
          <div className="rush-head">
            <div>
              <div className="stat-label">Time</div>
              <div className={`stat-value num ${left <= 5 ? 'danger' : ''}`}>{left}s</div>
            </div>
            <div>
              <div className="stat-label">Score</div>
              <div className="stat-value num">{score}</div>
            </div>
            <div>
              <div className="stat-label">Misses</div>
              <div className="stat-value num">{misses}</div>
            </div>
          </div>
        )}
        {phase === 'run' && mode === 'name' && (
          <div className="name-options">
            {options.map((o) => (
              <button key={o} className="name-option mono" onClick={() => answer(o)}>
                {o}
              </button>
            ))}
          </div>
        )}
        {phase === 'done' && (
          <div className={`feedback ${newBest ? 'feedback-good' : 'feedback-info'}`}>
            <Icon name={newBest ? 'trophy' : 'check'} />
            <div>
              <strong>
                {score} correct{newBest ? ' · new best' : ''}
              </strong>
              <span className="feedback-body">{misses ? `${misses} miss${misses > 1 ? 'es' : ''}. ` : 'No misses. '}Best as {side}: {Math.max(best, score)}</span>
            </div>
          </div>
        )}
        {phase !== 'run' && (
          <>
            <Segmented label="Board side" value={side} onChange={setSide} options={[{ value: 'white', label: 'White side' }, { value: 'black', label: 'Black side' }]} />
            <Button variant="primary" size="l" icon="clock" onClick={start}>
              {phase === 'done' ? 'Again' : 'Start 30 seconds'}
            </Button>
            <div className="faint">
              Best as {side}: <span className="num">{best}</span>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/* ---------- Knight routes ---------- */
const KN: [number, number][] = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const knightMoves = (sq: string) => {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]) - 1;
  return KN.map(([df, dr]) => [f + df, r + dr]).filter(([x, y]) => x >= 0 && x < 8 && y >= 0 && y < 8).map(([x, y]) => FILES[x] + (y + 1));
};
function knightDistance(a: string, b: string): number {
  const seen = new Map<string, number>([[a, 0]]);
  const q = [a];
  while (q.length) {
    const s = q.shift()!;
    if (s === b) return seen.get(s)!;
    for (const n of knightMoves(s)) if (!seen.has(n)) {
      seen.set(n, seen.get(s)! + 1);
      q.push(n);
    }
  }
  return 99;
}
const fenWithKnight = (sq: string) => {
  const rows: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      if (FILES[f] + r === sq) {
        if (empty) row += empty;
        empty = 0;
        row += 'N';
      } else empty++;
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join('/') + ' w - - 0 1';
};

function KnightDrill() {
  const p = useProfile();
  const ROUNDS = 8;
  const [round, setRound] = useState(0);
  const [pos, setPos] = useState('b1');
  const [target, setTarget] = useState('c7');
  const [used, setUsed] = useState(0);
  const [perfect, setPerfect] = useState(0);
  const [t0, setT0] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'run' | 'done'>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [trail, setTrail] = useState<string[]>([]);

  const newRound = () => {
    let a = randomItem(ALL_SQUARES);
    let b = randomItem(ALL_SQUARES);
    while (knightDistance(a, b) < 2 || knightDistance(a, b) > 5) {
      a = randomItem(ALL_SQUARES);
      b = randomItem(ALL_SQUARES);
    }
    setPos(a);
    setTarget(b);
    setUsed(0);
    setTrail([a]);
  };
  const start = () => {
    setRound(0);
    setPerfect(0);
    setPhase('run');
    setT0(Date.now());
    newRound();
  };
  const optimal = useMemo(() => knightDistance(trail[0] ?? pos, target), [trail, pos, target]);
  const click = (sq: string) => {
    if (phase !== 'run') return;
    if (!knightMoves(pos).includes(sq)) {
      sound('bad');
      return;
    }
    sound('move');
    const u = used + 1;
    setPos(sq);
    setUsed(u);
    setTrail((t) => [...t, sq]);
    if (sq === target) {
      const isPerfect = u === optimal;
      const nextPerfect = perfect + (isPerfect ? 1 : 0);
      setPerfect(nextPerfect);
      if (round + 1 >= ROUNDS) {
        const secs = Math.round((Date.now() - t0) / 1000);
        setElapsed(secs);
        setPhase('done');
        sound('complete');
        saveBest('knight', nextPerfect * 10 + Math.max(0, 120 - secs));
      } else {
        sound('good');
        setRound(round + 1);
        window.setTimeout(newRound, 300);
      }
    }
  };
  const arrows: Arrow[] = trail.slice(1).map((s, i) => ({ from: trail[i], to: s, color: 'blue' }));
  const marks: Mark[] = [{ square: target, color: 'green' }];
  return (
    <div className="trainer">
      <div className="trainer-board">
        <div className="board-caption">
          <span>{phase === 'run' ? `Round ${round + 1} of ${ROUNDS}` : 'Knight routes'}</span>
          {phase === 'run' && (
            <span className="faint">
              Moves: <span className="num">{used}</span> · Best possible: <span className="num">{optimal}</span>
            </span>
          )}
        </div>
        <Board fen={fenWithKnight(pos)} onSquareClick={click} marks={phase === 'run' ? marks : []} arrows={phase === 'run' ? arrows : []} drawable={false} />
      </div>
      <aside className="panel">
        <div className="panel-section">
          <h2>Knight routes</h2>
          <p className="muted">Take the knight to the ringed square in as few moves as possible. Knights are the piece club players most often lose track of; this makes their geometry automatic.</p>
        </div>
        {phase === 'done' && (
          <div className="feedback feedback-good">
            <Icon name="trophy" />
            <div>
              <strong>
                {perfect}/{ROUNDS} shortest routes
              </strong>
              <span className="feedback-body">in {elapsed} seconds</span>
            </div>
          </div>
        )}
        {phase !== 'run' && (
          <Button variant="primary" size="l" icon="play" onClick={start}>
            {phase === 'done' ? 'Again' : `Start ${ROUNDS} rounds`}
          </Button>
        )}
        <div className="faint">
          Best score: <span className="num">{p.vision.knight ?? 0}</span>
        </div>
      </aside>
    </div>
  );
}

/* ---------- Find every check ---------- */
function pickScanPosition(): string {
  for (let tries = 0; tries < 200; tries++) {
    const z = randomItem(puzzles);
    if (!z) break;
    const r = playUci(z.fen, z.moves.split(' ')[0]);
    if (!r) continue;
    const c = new Chess(r.fen);
    const checks = c.moves().filter((m) => m.includes('+') || m.includes('#'));
    if (checks.length >= 2 && checks.length <= 6 && !c.inCheck()) return r.fen;
  }
  return 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5';
}

function ChecksDrill() {
  const [fen, setFen] = useState(pickScanPosition);
  const [found, setFound] = useState<string[]>([]);
  const [tones, setTones] = useState<Record<string, SquareTone>>({});
  const [gaveUp, setGaveUp] = useState(false);
  const [solved, setSolved] = useState(0);
  const all = useMemo(() => {
    const c = new Chess(fen);
    return c.moves({ verbose: true }).filter((m) => m.san.includes('+') || m.san.includes('#'));
  }, [fen]);
  const done = gaveUp || found.length === all.length;
  const onMove = (m: BoardMove) => {
    if (done) return;
    const hit = all.find((x) => x.from === m.from && x.to === m.to && (!x.promotion || x.promotion === (m.promotion ?? 'q')));
    if (hit && !found.includes(hit.san)) {
      sound('good');
      const next = [...found, hit.san];
      setFound(next);
      setTones({ [hit.to]: 'good' });
      if (next.length === all.length) {
        setSolved((s) => s + 1);
        updateProfile((d) => logActivity(d, 6, 'vision'));
        sound('complete');
      }
    } else if (hit) {
      setTones({ [hit.to]: 'hint' });
    } else {
      sound('bad');
      setTones({ [m.to]: 'bad' });
    }
    window.setTimeout(() => setTones({}), 400);
  };
  const turn = fen.split(' ')[1] as 'w' | 'b';
  const arrows: Arrow[] = done ? all.filter((m) => !found.includes(m.san)).map((m) => ({ from: m.from, to: m.to, color: 'red' })) : [];
  const foundArrows: Arrow[] = all.filter((m) => found.includes(m.san)).map((m) => ({ from: m.from, to: m.to, color: 'green' }));
  return (
    <div className="trainer">
      <div className="trainer-board">
        <div className="board-caption">
          <span className="player-tag">
            <span className={`side-dot ${turn}`} /> {colorName(turn)} to move
          </span>
          <span className="faint num">
            {found.length}/{all.length} checks
          </span>
        </div>
        <Board fen={fen} orientation={turn === 'w' ? 'white' : 'black'} interactive={!done} playerColor={turn} onMove={onMove} tones={tones} arrows={[...foundArrows, ...arrows]} />
      </div>
      <aside className="panel">
        <div className="panel-section">
          <h2>Find every check</h2>
          <p className="muted">
            Play each checking move on the board. Checks are the first thing to scan for on every move, for you and for your opponent. This position has <strong>{all.length}</strong>.
          </p>
        </div>
        <div className="found-list mono">
          {found.map((s) => (
            <Pill key={s} tone="good">
              {s}
            </Pill>
          ))}
          {done &&
            all
              .filter((m) => !found.includes(m.san))
              .map((m) => (
                <Pill key={m.san} tone="bad">
                  {m.san}
                </Pill>
              ))}
        </div>
        {done && (
          <div className={`feedback ${gaveUp ? 'feedback-warn' : 'feedback-good'}`}>
            <Icon name={gaveUp ? 'eye' : 'check'} />
            <div>
              <strong>{gaveUp ? 'Missed checks in red' : 'All checks found'}</strong>
              <span className="feedback-body">Positions cleared this session: {solved}</span>
            </div>
          </div>
        )}
        <div className="btn-row">
          {done ? (
            <Button variant="primary" iconRight="right" onClick={() => { setFen(pickScanPosition()); setFound([]); setGaveUp(false); }}>
              Next position
            </Button>
          ) : (
            <Button variant="ghost" icon="eye" onClick={() => setGaveUp(true)}>
              Show the rest
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}

const MODES = [
  { id: 'coords', title: 'Find the square', text: 'A square name appears; click it. Thirty seconds.', icon: 'target' },
  { id: 'name', title: 'Name the square', text: 'A square is marked; pick its name.', icon: 'eye' },
  { id: 'knight', title: 'Knight routes', text: 'Shortest knight paths, eight rounds.', icon: 'play' },
  { id: 'checks', title: 'Find every check', text: 'Scan a real position for all checking moves.', icon: 'bolt' },
];

export function VisionPage({ mode }: { mode?: string }) {
  const m = MODES.find((x) => x.id === mode);
  if (!m) {
    return (
      <>
        <PageHeader eyebrow="Board vision" title="See the board faster">
          Short daily drills that build the automatic board sense tactics depend on. Do one as a warm-up before puzzles.
        </PageHeader>
        <div className="grid grid-2">
          {MODES.map((x) => (
            <button key={x.id} className="hub-card card" onClick={() => navigate(`vision/${x.id}`)}>
              <span className="hub-icon">
                <Icon name={x.icon} size={24} />
              </span>
              <span className="hub-text">
                <h3>{x.title}</h3>
                <span className="muted">{x.text}</span>
              </span>
              <Icon name="right" />
            </button>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <div className="lesson-top">
        <button className="icon-btn" aria-label="All vision drills" onClick={() => navigate('vision')}>
          <Icon name="left" />
        </button>
        <div className="lesson-top-text">
          <div className="eyebrow">Board vision</div>
          <h1 className="lesson-title">{m.title}</h1>
        </div>
      </div>
      {m.id === 'coords' && <CoordsDrill mode="find" />}
      {m.id === 'name' && <CoordsDrill mode="name" />}
      {m.id === 'knight' && <KnightDrill />}
      {m.id === 'checks' && <ChecksDrill />}
    </>
  );
}
