import { useEffect, type ReactNode } from 'react';
import { navigate, routeParts, useRoute } from './router';
import { Icon } from './components/Icon';
import { getProfile, levelFromXp, liveStreak, updateProfile, useProfile } from './store/profile';
import { useToasts, toast } from './lib/toast';
import { ACHIEVEMENTS } from './lib/achievements';
import { dueLines, dueReviewPuzzles } from './lib/due';
import { ProgressBar } from './components/ui';
import { InstallButton } from './components/InstallCard';
import { HomePage } from './pages/Home';
import { LearnPage } from './pages/Learn';
import { LessonPage } from './pages/Lesson';
import { PuzzlesPage } from './pages/Puzzles';
import { OpeningsPage } from './pages/Openings';
import { OpeningPage } from './pages/Opening';
import { EndgamesPage } from './pages/Endgames';
import { DrillPage } from './pages/Drill';
import { PlayPage } from './pages/Play';
import { GamesPage } from './pages/Games';
import { ReviewPage } from './pages/Review';
import { VisionPage } from './pages/Vision';
import { ProgressPage } from './pages/Progress';
import { SettingsPage } from './pages/Settings';
import { TrainPage } from './pages/Train';

interface NavItem {
  route: string;
  label: string;
  icon: string;
  match?: string[];
  badge?: number;
}

function useNav(): { groups: { label?: string; items: NavItem[] }[]; tabs: NavItem[] } {
  const p = useProfile();
  const puzzleDue = dueReviewPuzzles(p).length;
  const linesDue = dueLines(p).length;
  const groups = [
    {
      items: [
        { route: 'home', label: 'Today', icon: 'home' },
        { route: 'learn', label: 'Learn', icon: 'learn', match: ['lesson'] },
      ],
    },
    {
      label: 'Train',
      items: [
        { route: 'puzzles', label: 'Puzzles', icon: 'puzzle', badge: puzzleDue },
        { route: 'openings', label: 'Openings', icon: 'openings', match: ['opening'], badge: linesDue },
        { route: 'endgames', label: 'Endgames', icon: 'endgames', match: ['drill'] },
        { route: 'vision', label: 'Board Vision', icon: 'vision' },
      ],
    },
    {
      label: 'Play',
      items: [
        { route: 'play', label: 'Play the Coach', icon: 'play' },
        { route: 'games', label: 'Game Reviews', icon: 'swords', match: ['review'] },
      ],
    },
    {
      label: 'You',
      items: [
        { route: 'progress', label: 'Progress', icon: 'progress' },
        { route: 'settings', label: 'Settings', icon: 'settings' },
      ],
    },
  ];
  const tabs: NavItem[] = [
    { route: 'home', label: 'Today', icon: 'home', match: ['progress', 'settings'] },
    { route: 'learn', label: 'Learn', icon: 'learn', match: ['lesson'] },
    { route: 'puzzles', label: 'Puzzles', icon: 'puzzle', badge: puzzleDue },
    { route: 'train', label: 'Train', icon: 'target', match: ['openings', 'opening', 'endgames', 'drill', 'vision'], badge: linesDue },
    { route: 'play', label: 'Play', icon: 'play', match: ['games', 'review'] },
  ];
  return { groups, tabs };
}

const isActive = (item: NavItem, section: string) => item.route === section || !!item.match?.includes(section);

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <span className="toast-icon">
            <Icon name={t.icon ?? 'star'} size={18} />
          </span>
          <div>
            <div className="toast-title">{t.title}</div>
            {t.body && <div className="toast-body">{t.body}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function useThemeAttribute() {
  const theme = useProfile().settings.theme;
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      if (root.dataset.tempoTheme) {
        delete root.dataset.theme;
        delete root.dataset.tempoTheme;
      }
    } else {
      root.dataset.theme = theme;
      root.dataset.tempoTheme = '1';
    }
  }, [theme]);
}

function useAchievementWatcher() {
  const p = useProfile();
  useEffect(() => {
    const fresh = ACHIEVEMENTS.filter((a) => !p.achievements[a.id] && a.test(p));
    if (!fresh.length) return;
    updateProfile((d) => {
      for (const a of fresh) d.achievements[a.id] = Date.now();
    });
    for (const a of fresh) toast({ title: `Achievement: ${a.title}`, body: a.text, icon: a.icon, tone: 'accent' }, 5000);
  }, [p]);
}

function useLevelWatcher() {
  const p = useProfile();
  const { level, title } = levelFromXp(p.xp);
  useEffect(() => {
    // Read the live profile so a re-run in the same render cannot announce the level twice.
    if (level <= getProfile().levelSeen) return;
    updateProfile((d) => {
      d.levelSeen = level;
    });
    toast({ title: `Level ${level} reached`, body: `You are now a ${title}.`, icon: 'star', tone: 'accent' }, 5000);
  }, [level, p.levelSeen, title]);
}

function MiniStats({ streak, rating, children }: { streak: number; rating: number; children?: ReactNode }) {
  return (
    <div className="mini-stats">
      <span className="flame" title="Day streak">
        <Icon name="flame" size={16} /> {streak}
      </span>
      <span title="Puzzle rating">
        <Icon name="target" size={16} /> <span className="num">{rating}</span>
      </span>
      {children}
    </div>
  );
}

function Page({ route }: { route: string }): ReactNode {
  const [section, arg] = routeParts(route);
  switch (section) {
    case 'home':
      return <HomePage />;
    case 'learn':
      return <LearnPage />;
    case 'lesson':
      return <LessonPage id={arg ?? ''} />;
    case 'puzzles':
      return <PuzzlesPage mode={arg} />;
    case 'openings':
      return <OpeningsPage />;
    case 'opening':
      return <OpeningPage id={arg ?? ''} />;
    case 'endgames':
      return <EndgamesPage />;
    case 'drill':
      return <DrillPage id={arg ?? ''} />;
    case 'play':
      return <PlayPage />;
    case 'games':
      return <GamesPage />;
    case 'review':
      return <ReviewPage id={arg ?? ''} />;
    case 'vision':
      return <VisionPage mode={arg} />;
    case 'progress':
      return <ProgressPage />;
    case 'settings':
      return <SettingsPage />;
    case 'train':
      return <TrainPage />;
    default:
      return <HomePage />;
  }
}

export function App() {
  const route = useRoute();
  const [section] = routeParts(route);
  const { groups, tabs } = useNav();
  const p = useProfile();
  const lvl = levelFromXp(p.xp);
  const streak = liveStreak(p);
  useThemeAttribute();
  useAchievementWatcher();
  useLevelWatcher();

  return (
    <div className="app">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('home')}>
          <BrandMark />
          <span>
            Tempo
            <small>Chess Gym</small>
          </span>
        </button>
        <nav className="nav" aria-label="Main">
          {groups.map((g, i) => (
            <div key={i} className="nav">
              {g.label && <div className="nav-group-label">{g.label}</div>}
              {g.items.map((it: NavItem) => (
                <button key={it.route} className={`nav-item ${isActive(it, section) ? 'active' : ''}`} onClick={() => navigate(it.route)} aria-current={isActive(it, section) ? 'page' : undefined}>
                  <Icon name={it.icon} />
                  {it.label}
                  {!!it.badge && <span className="badge">{it.badge}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <InstallButton />
          <MiniStats streak={streak} rating={p.puzzles.rating} />
          <div>
            <div className="faint" style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 5 }}>
              Level {lvl.level} · {lvl.title}
            </div>
            <ProgressBar value={lvl.into} max={lvl.need} label="Progress to the next level" />
          </div>
        </div>
      </aside>

      <header className="topbar">
        <button className="brand" onClick={() => navigate('home')}>
          <BrandMark />
          Tempo
        </button>
        <MiniStats streak={streak} rating={p.puzzles.rating}>
          <InstallButton compact />
          <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Settings" onClick={() => navigate('settings')}>
            <Icon name="settings" size={18} />
          </button>
        </MiniStats>
      </header>

      <main className="main">
        <div className="page" key={route}>
          <Page route={route} />
        </div>
      </main>

      <nav className="tabbar" aria-label="Main">
        {tabs.map((t) => (
          <button key={t.route} className={`tab ${isActive(t, section) ? 'active' : ''}`} onClick={() => navigate(t.route)}>
            <Icon name={t.icon} size={22} />
            {t.label}
          </button>
        ))}
      </nav>
      <Toasts />
    </div>
  );
}
