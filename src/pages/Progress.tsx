import { useMemo, useState } from 'react';
import { useProfile, levelFromXp, type Profile } from '../store/profile';
import { THEMES } from '../data/puzzles';
import { ACHIEVEMENTS } from '../lib/achievements';
import { lessonCounts } from '../lib/due';
import { endgameDrills, openings } from '../content';
import { dayKey, DAY, MASTERED_BOX } from '../lib/srs';
import { PageHeader, ProgressBar } from '../components/ui';
import { Icon } from '../components/Icon';
import { navigate } from '../router';

const W = 640;
const H = 200;
const padL = 44;
const padR = 12;
const padT = 12;
const padB = 24;

/** Puzzle rating over attempts, with a hover crosshair and tooltip. */
function RatingChart({ history }: { history: { t: number; r: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Scales and paths depend only on the history; hovering re-renders just the crosshair.
  const chart = useMemo(() => {
    if (history.length < 2) return null;
    const vals = history.map((h) => h.r);
    const lo = Math.floor((Math.min(...vals) - 20) / 50) * 50;
    const hi = Math.ceil((Math.max(...vals) + 20) / 50) * 50;
    const x = (i: number) => padL + (i / (history.length - 1)) * (W - padL - padR);
    const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const step = (hi - lo) / 50 > 6 ? 100 : 50;
    const ticks: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    const d = history.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h.r).toFixed(1)}`).join(' ');
    const area = `${d} L${x(history.length - 1)},${H - padB} L${x(0)},${H - padB} Z`;
    return { vals, x, y, ticks, d, area };
  }, [history]);
  if (!chart) return <div className="empty">Solve a few rated puzzles to see your rating curve.</div>;
  const { vals, x, y, ticks, d, area } = chart;
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - padL) / (W - padL - padR)) * (history.length - 1));
    setHover(Math.max(0, Math.min(history.length - 1, i)));
  };
  const hv = hover !== null ? history[hover] : null;
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`Puzzle rating from ${vals[0]} to ${vals[vals.length - 1]} over ${vals.length} rated puzzles`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="chart-tick">
              {t}
            </text>
          </g>
        ))}
        <text x={padL} y={H - 6} className="chart-tick">
          {new Date(history[0].t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </text>
        <text x={W - padR} y={H - 6} textAnchor="end" className="chart-tick">
          Latest
        </text>
        <path d={area} fill="var(--accent-soft)" opacity="0.7" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(history.length - 1)} cy={y(vals[vals.length - 1])} r="4.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        {hv && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(hv.r)} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hv && hover !== null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong className="num">{hv.r}</strong>
          <span className="faint">
            Puzzle {hover + 1} · {new Date(hv.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}
    </div>
  );
}

/** Training activity over the last 18 weeks, one cell per day, shaded by XP. */
function Heatmap({ p }: { p: Profile }) {
  const [tip, setTip] = useState<{ key: string; xp: number; x: number; y: number } | null>(null);
  const weeks = 18;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const end = today.getTime();
  const startDow = (today.getDay() + 6) % 7; // Monday = 0
  const start = end - (weeks * 7 - 7 + startDow) * DAY;
  const cells: { key: string; xp: number; col: number; row: number }[] = [];
  for (let t = start, i = 0; t <= end; t += DAY, i++) {
    const key = dayKey(t);
    cells.push({ key, xp: p.days[key]?.xp ?? 0, col: Math.floor(i / 7), row: i % 7 });
  }
  const goal = p.settings.dailyGoal;
  const level = (xp: number) => (xp <= 0 ? 0 : xp < goal * 0.34 ? 1 : xp < goal * 0.67 ? 2 : xp < goal ? 3 : 4);
  const S = 14;
  const G = 3;
  const w = weeks * (S + G);
  const h = 7 * (S + G);
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w + 24} ${h}`} className="heatmap" role="img" aria-label="Daily training activity for the last 18 weeks" onPointerLeave={() => setTip(null)}>
        {['M', 'W', 'F'].map((l, i) => (
          <text key={l} x={0} y={(i * 2) * (S + G) + S - 3} className="chart-tick">
            {l}
          </text>
        ))}
        {cells.map((c) => (
          <rect
            key={c.key}
            x={24 + c.col * (S + G)}
            y={c.row * (S + G)}
            width={S}
            height={S}
            rx={3}
            className={`heat heat-${level(c.xp)}`}
            onPointerEnter={() => setTip({ key: c.key, xp: c.xp, x: ((24 + c.col * (S + G) + S / 2) / (w + 24)) * 100, y: c.row })}
          />
        ))}
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: `${tip.x}%` }}>
          <strong className="num">{tip.xp} XP</strong>
          <span className="faint">{new Date(tip.key + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      )}
      <div className="heat-legend faint">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`heat-swatch heat-${l}`} />
        ))}
        Goal met
      </div>
    </div>
  );
}

function ThemeBars({ p }: { p: Profile }) {
  const rows = useMemo(
    () =>
      Object.entries(p.puzzles.themes)
        .filter(([t, s]) => THEMES[t] && s.ok + s.fail >= 3 && !['oneMove', 'short', 'long', 'veryLong'].includes(t))
        .map(([t, s]) => ({ t, rate: s.ok / (s.ok + s.fail), n: s.ok + s.fail }))
        .sort((a, b) => b.rate - a.rate),
    [p.puzzles.themes],
  );
  if (!rows.length) return <div className="empty">Theme strengths appear after about three puzzles per theme.</div>;
  return (
    <div className="theme-bars">
      {rows.map((r) => (
        <button key={r.t} className="theme-bar" onClick={() => navigate(`puzzles/theme-${r.t}`)} title={`${r.n} attempts: practise ${THEMES[r.t].name}`}>
          <span className="theme-bar-name">{THEMES[r.t].name}</span>
          <span className="theme-bar-track">
            <span className="theme-bar-fill" style={{ width: `${Math.max(3, r.rate * 100)}%` }} />
          </span>
          <span className="theme-bar-val num">{Math.round(r.rate * 100)}%</span>
        </button>
      ))}
    </div>
  );
}

export function ProgressPage() {
  const p = useProfile();
  const lvl = levelFromXp(p.xp);
  const { done: lessonsDone, total: lessonsTotal } = lessonCounts(p);
  const lines = Object.values(p.lines);
  const mastered = lines.filter((l) => l.box >= MASTERED_BOX).length;
  const totalLines = openings.reduce((s, o) => s + o.lines.length, 0);
  const drills = endgameDrills.filter((d) => p.drills[d.id]?.done).length;
  const reviewed = p.games.filter((g) => g.review);
  const avgAcc = reviewed.length ? Math.round(reviewed.reduce((s, g) => s + (g.review!.accuracy[g.playerColor] ?? 0), 0) / reviewed.length) : null;
  const peak = p.puzzles.history.reduce((m, h) => Math.max(m, h.r), p.puzzles.rating);
  const unlocked = ACHIEVEMENTS.filter((a) => p.achievements[a.id]).length;

  const tiles = [
    { label: 'Puzzle rating', value: p.puzzles.rating, sub: `peak ${peak}` },
    { label: 'Puzzles solved', value: p.puzzles.solved, sub: `${p.puzzles.attempts ? Math.round((p.puzzles.solved / p.puzzles.attempts) * 100) : 0}% clean` },
    { label: 'Lessons', value: `${lessonsDone}/${lessonsTotal}`, sub: 'completed' },
    { label: 'Opening lines', value: `${lines.length}/${totalLines}`, sub: `${mastered} mastered` },
    { label: 'Endgame drills', value: `${drills}/${endgameDrills.length}`, sub: 'completed' },
    { label: 'Game accuracy', value: avgAcc !== null ? `${avgAcc}%` : '—', sub: `${reviewed.length} reviewed game${reviewed.length === 1 ? '' : 's'}` },
  ];

  return (
    <>
      <PageHeader eyebrow="You" title="Progress">
        Level {lvl.level} {lvl.title} · {p.xp.toLocaleString()} XP total · {unlocked}/{ACHIEVEMENTS.length} achievements
      </PageHeader>
      <div className="tiles">
        {tiles.map((t) => (
          <div key={t.label} className="tile">
            <span className="stat-label">{t.label}</span>
            <span className="stat-value num">{t.value}</span>
            <span className="faint" style={{ fontSize: '0.8rem' }}>
              {t.sub}
            </span>
          </div>
        ))}
      </div>
      <div className="progress-grid">
        <section className="card">
          <div className="card-title">
            <h3>Puzzle rating</h3>
            <span className="faint num">{p.puzzles.history.length} rated</span>
          </div>
          <RatingChart history={p.puzzles.history} />
        </section>
        <section className="card">
          <div className="card-title">
            <h3>Training days</h3>
            <span className="faint">
              Streak {p.streak.current} · best {p.streak.best}
            </span>
          </div>
          <Heatmap p={p} />
          <div style={{ marginTop: 14 }}>
            <div className="card-title" style={{ marginBottom: 6 }}>
              <span className="stat-label">Level {lvl.level} → {lvl.level + 1}</span>
              <span className="num faint">
                {lvl.into}/{lvl.need} XP
              </span>
            </div>
            <ProgressBar value={lvl.into} max={lvl.need} />
          </div>
        </section>
      </div>
      <section className="card">
        <div className="card-title">
          <h3>Tactical strengths</h3>
          <span className="faint">Share of puzzles solved cleanly, per theme. Tap one to drill it.</span>
        </div>
        <ThemeBars p={p} />
      </section>
      <section className="section">
        <div className="section-head">
          <h2>Achievements</h2>
          <span className="faint num">
            {unlocked}/{ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="achievements">
          {ACHIEVEMENTS.map((a) => {
            const t = p.achievements[a.id];
            return (
              <div key={a.id} className={`achievement ${t ? 'on' : ''}`}>
                <span className="achievement-icon">
                  <Icon name={t ? a.icon : 'lock'} size={20} />
                </span>
                <span>
                  <strong>{a.title}</strong>
                  <span className="muted">{a.text}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
