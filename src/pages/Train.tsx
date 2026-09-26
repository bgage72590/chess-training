import { navigate } from '../router';
import { useProfile } from '../store/profile';
import { dueLines } from '../lib/due';
import { endgameDrills } from '../content';
import { PageHeader, Pill } from '../components/ui';
import { Icon } from '../components/Icon';

/** Hub for the training modes that do not fit in the mobile tab bar. */
export function TrainPage() {
  const p = useProfile();
  const due = dueLines(p).length;
  const drills = endgameDrills.filter((d) => p.drills[d.id]?.done).length;
  const items = [
    { route: 'openings', icon: 'openings', title: 'Openings', text: 'Learn repertoire lines with explanations, then drill them from memory.', badge: due ? `${due} due` : null },
    { route: 'endgames', icon: 'endgames', title: 'Endgames', text: 'Play essential endgames against Stockfish until the technique is automatic.', badge: `${drills}/${endgameDrills.length}` },
    { route: 'vision', icon: 'vision', title: 'Board Vision', text: 'Coordinates, knight routes and check-spotting sprints.', badge: null },
    { route: 'games', icon: 'swords', title: 'Game Reviews', text: 'Every game you play against the coach, analysed move by move.', badge: p.games.length ? String(p.games.length) : null },
    { route: 'progress', icon: 'progress', title: 'Progress', text: 'Ratings, strengths, weaknesses and achievements.', badge: null },
  ];
  return (
    <>
      <PageHeader eyebrow="Train" title="Training modes" />
      <div className="grid grid-2">
        {items.map((it) => (
          <button key={it.route} className="hub-card card" onClick={() => navigate(it.route)}>
            <span className="hub-icon">
              <Icon name={it.icon} size={24} />
            </span>
            <span className="hub-text">
              <span className="btn-row">
                <h3>{it.title}</h3>
                {it.badge && <Pill tone="accent">{it.badge}</Pill>}
              </span>
              <span className="muted">{it.text}</span>
            </span>
            <Icon name="right" />
          </button>
        ))}
      </div>
    </>
  );
}
