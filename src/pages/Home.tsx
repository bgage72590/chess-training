import { navigate } from '../router';
import { levelFromXp, liveStreak, todayLog, updateProfile, useProfile, type Profile } from '../store/profile';
import { dueLines, dueReviewPuzzles, lessonCounts, nextLesson } from '../lib/due';
import { openings, endgameDrills, units } from '../content';
import { THEMES } from '../data/puzzles';
import { Button, Pill, ProgressBar, Ring, Sparkline } from '../components/ui';
import { Icon } from '../components/Icon';
import { dayKey } from '../lib/srs';

interface PlanItem {
  id: string;
  icon: string;
  title: string;
  detail: string;
  done: boolean;
  progress?: [number, number];
  route: string;
  cta: string;
}

function buildPlan(p: Profile): PlanItem[] {
  const today = todayLog(p);
  const items: PlanItem[] = [];
  items.push({
    id: 'vision',
    icon: 'vision',
    title: 'Warm up your board vision',
    detail: 'One 30-second coordinate sprint.',
    done: today.vision > 0,
    route: 'vision/coords',
    cta: 'Warm up',
  });
  const puzzleTarget = 10;
  items.push({
    id: 'puzzles',
    icon: 'puzzle',
    title: `Solve ${puzzleTarget} rated puzzles`,
    detail: 'Tactics decide most games below master level.',
    done: today.puzzles >= puzzleTarget,
    progress: [Math.min(today.puzzles, puzzleTarget), puzzleTarget],
    route: 'puzzles',
    cta: 'Solve',
  });
  const up = nextLesson(p);
  if (up) {
    items.push({
      id: 'lesson',
      icon: 'learn',
      title: up.lesson.title,
      detail: `${up.unit.title} · ${up.lesson.minutes} min lesson`,
      done: today.lessons > 0,
      route: `lesson/${up.lesson.id}`,
      cta: 'Start lesson',
    });
  }
  const due = dueLines(p);
  if (due.length) {
    items.push({
      id: 'lines',
      icon: 'repeat',
      title: `Review ${due.length} opening line${due.length > 1 ? 's' : ''}`,
      detail: 'Spaced review, due today.',
      done: false,
      route: `opening/${due[0].openingId}?review`,
      cta: 'Review',
    });
  } else {
    const fresh = openings.find((o) => o.lines.some((l) => !p.lines[l.id]));
    if (fresh) {
      items.push({
        id: 'lines',
        icon: 'openings',
        title: `Learn a line: ${fresh.name}`,
        detail: 'Build your repertoire one line at a time.',
        done: today.lines > 0,
        route: `opening/${fresh.id}`,
        cta: 'Learn',
      });
    }
  }
  const drill = endgameDrills.find((d) => !p.drills[d.id]?.done);
  const dayNum = Number(dayKey().slice(-2));
  if (drill && dayNum % 2 === 0) {
    items.push({ id: 'drill', icon: 'endgames', title: drill.title, detail: 'Endgame technique vs Stockfish.', done: today.drills > 0, route: `drill/${drill.id}`, cta: 'Play drill' });
  } else {
    items.push({ id: 'game', icon: 'play', title: 'Play and review a game', detail: 'Use what you trained in a real game.', done: today.games > 0, route: 'play', cta: 'Play' });
  }
  return items;
}

function weakThemes(p: Profile) {
  return Object.entries(p.puzzles.themes)
    .filter(([t, s]) => THEMES[t] && s.ok + s.fail >= 4 && !['middlegame', 'opening', 'endgame', 'oneMove', 'short', 'long', 'veryLong', 'mate'].includes(t))
    .map(([t, s]) => ({ t, rate: s.ok / (s.ok + s.fail), n: s.ok + s.fail }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 3);
}

function Onboarding() {
  const choose = (rating: number, route: string) => {
    updateProfile((d) => {
      d.onboarded = true;
      d.puzzles.rating = rating;
    });
    navigate(route);
  };
  return (
    <section className="onboard card">
      <div className="onboard-text">
        <div className="eyebrow">Welcome to Tempo</div>
        <h1>Where are you starting from?</h1>
        <p className="lede">Tempo trains the four things that make a strong player: pattern recognition, calculation, opening understanding and endgame technique. Pick your starting point; puzzle difficulty adapts from there.</p>
      </div>
      <div className="onboard-options">
        <button className="onboard-option" onClick={() => choose(600, units[0]?.lessons[0] ? `lesson/${units[0].lessons[0].id}` : 'learn')}>
          <strong>I'm new to chess</strong>
          <span className="muted">Start with how the pieces move and the basic rules.</span>
        </button>
        <button className="onboard-option" onClick={() => choose(900, 'learn')}>
          <strong>I know the rules</strong>
          <span className="muted">Skip to checkmate patterns and tactics.</span>
        </button>
        <button className="onboard-option" onClick={() => choose(1300, 'puzzles')}>
          <strong>I play regularly</strong>
          <span className="muted">Jump into rated puzzles, openings and coached games.</span>
        </button>
      </div>
    </section>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late-night session' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function HomePage() {
  const p = useProfile();
  const up = nextLesson(p);
  const today = todayLog(p);
  const goal = p.settings.dailyGoal;
  const streak = liveStreak(p);
  const lvl = levelFromXp(p.xp);
  const plan = buildPlan(p);
  const planDone = plan.filter((x) => x.done).length;
  const review = dueReviewPuzzles(p).length;
  const { done: lessonsDone, total: lessonsTotal } = lessonCounts(p);
  const weak = weakThemes(p);
  const history = p.puzzles.history.slice(-60).map((h) => h.r);
  const nextUp = plan.find((x) => !x.done);

  if (!p.onboarded) return <Onboarding />;

  return (
    <>
      <section className="today-hero">
        <div className="today-hero-text">
          <div className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1>{greeting()}.</h1>
          <p className="lede">
            {planDone === plan.length
              ? 'Today’s plan is complete. Extra puzzles or a game will only make it stronger.'
              : planDone === 0
                ? 'Your plan for today takes about 25 minutes. Start with the warm-up.'
                : `${planDone} of ${plan.length} done. Keep the momentum.`}
          </p>
          {nextUp && (
            <div className="btn-row">
              <Button variant="primary" size="l" iconRight="right" onClick={() => navigate(nextUp.route)}>
                {nextUp.title}
              </Button>
            </div>
          )}
        </div>
        <div className="today-stats">
          <Ring value={today.xp} max={goal} size={112} stroke={10} tone={today.xp >= goal ? 'good' : 'accent'}>
            <div>
              <div className="stat-value num" style={{ fontSize: '1.5rem' }}>
                {today.xp}
              </div>
              <div className="faint" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                / {goal} XP
              </div>
            </div>
          </Ring>
          <div className="today-mini">
            <div className="stat">
              <span className="stat-value num">
                <Icon name="flame" size={22} className="flame-icon" /> {streak}
              </span>
              <span className="stat-label">day streak · best {p.streak.best}</span>
            </div>
            <div className="stat">
              <span className="stat-value num">{lvl.level}</span>
              <span className="stat-label">level · {lvl.title}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="home-grid">
        <section className="section">
          <div className="section-head">
            <h2>Today’s training plan</h2>
            <span className="faint num">
              {planDone}/{plan.length}
            </span>
          </div>
          <ol className="plan">
            {plan.map((item, i) => (
              <li key={item.id} className={`plan-item ${item.done ? 'done' : ''}`}>
                <span className="plan-step num" aria-hidden="true">
                  {item.done ? <Icon name="check" size={16} /> : i + 1}
                </span>
                <span className="plan-icon">
                  <Icon name={item.icon} />
                </span>
                <div className="plan-text">
                  <strong>{item.title}</strong>
                  <span className="muted">{item.detail}</span>
                  {item.progress && !item.done && (
                    <div className="plan-progress">
                      <ProgressBar value={item.progress[0]} max={item.progress[1]} />
                      <span className="num faint">
                        {item.progress[0]}/{item.progress[1]}
                      </span>
                    </div>
                  )}
                </div>
                <Button variant={item.done ? 'ghost' : 'secondary'} size="s" onClick={() => navigate(item.route)}>
                  {item.done ? 'Again' : item.cta}
                </Button>
              </li>
            ))}
          </ol>
          {review > 0 && (
            <button className="review-callout card" onClick={() => navigate('puzzles/review')}>
              <Icon name="refresh" />
              <span>
                <strong>{review} missed puzzle{review > 1 ? 's' : ''} ready for review.</strong> <span className="muted">Solving your misses is the fastest way to fix a pattern.</span>
              </span>
              <Icon name="right" />
            </button>
          )}
        </section>

        <aside className="home-side">
          <button className="card rating-card" onClick={() => navigate('progress')}>
            <div className="card-title">
              <span className="stat-label">Puzzle rating</span>
              <Pill tone="accent">{p.puzzles.solved} solved</Pill>
            </div>
            <div className="stat-value num">{p.puzzles.rating}</div>
            {history.length > 1 ? <Sparkline values={history} height={56} /> : <p className="faint" style={{ fontSize: '0.85rem' }}>Solve puzzles to draw your rating curve.</p>}
          </button>
          <div className="card">
            <div className="card-title">
              <span className="stat-label">Curriculum</span>
              <span className="num faint">
                {lessonsDone}/{lessonsTotal}
              </span>
            </div>
            <ProgressBar value={lessonsDone} max={Math.max(1, lessonsTotal)} />
            {up && (
              <button className="link-row" onClick={() => navigate(`lesson/${up.lesson.id}`)}>
                <span>
                  <span className="faint" style={{ fontSize: '0.8rem' }}>
                    Up next · {up.unit.title}
                  </span>
                  <strong>{up.lesson.title}</strong>
                </span>
                <Icon name="right" />
              </button>
            )}
          </div>
          <div className="card">
            <div className="card-title">
              <span className="stat-label">Focus areas</span>
            </div>
            {weak.length ? (
              <div className="focus-list">
                {weak.map((w) => (
                  <button key={w.t} className="link-row" onClick={() => navigate(`puzzles/theme-${w.t}`)}>
                    <span>
                      <strong>{THEMES[w.t].name}</strong>
                      <span className="faint" style={{ fontSize: '0.8rem' }}>
                        {' '}
                        {Math.round(w.rate * 100)}% of {w.n}
                      </span>
                    </span>
                    <Icon name="right" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="faint" style={{ fontSize: '0.88rem' }}>
                After a few puzzles per theme, your weakest patterns appear here with a one-click drill.
              </p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
