import { endgameDrills, type EndgameDrill } from '../content';
import { navigate } from '../router';
import { useProfile } from '../store/profile';
import { Board } from '../chess/Board';
import { PageHeader, Pill } from '../components/ui';
import { Icon } from '../components/Icon';

const CATEGORY_ORDER: EndgameDrill['category'][] = ['Basic mates', 'Pawn endgames', 'Rook endgames', 'Minor pieces', 'Queen endgames'];
export const GOAL_LABEL = { win: 'Checkmate', promote: 'Promote', draw: 'Hold the draw' } as const;

export function EndgamesPage() {
  const p = useProfile();
  const done = endgameDrills.filter((d) => p.drills[d.id]?.done).length;
  return (
    <>
      <PageHeader eyebrow="Technique" title="Endgame drills">
        Play the key endgames against full-strength Stockfish until the technique is automatic. {done} of {endgameDrills.length} mastered.
      </PageHeader>
      {endgameDrills.length === 0 && <div className="empty">Endgame drills are being written.</div>}
      {CATEGORY_ORDER.map((cat) => {
        const list = endgameDrills.filter((d) => d.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className="section">
            <div className="section-head">
              <h2>{cat}</h2>
              <span className="faint num">
                {list.filter((d) => p.drills[d.id]?.done).length}/{list.length}
              </span>
            </div>
            <div className="grid grid-4">
              {list.map((d) => {
                const prog = p.drills[d.id];
                const learner = d.fen.split(' ')[1] === 'w' ? 'white' : 'black';
                return (
                  <button key={d.id} className={`drill-card card ${prog?.done ? 'done' : ''}`} onClick={() => navigate(`drill/${d.id}`)}>
                    <div className="drill-board">
                      <Board fen={d.fen} orientation={learner} coordinates={false} />
                      {prog?.done && (
                        <span className="drill-done" aria-label="Completed">
                          <Icon name="check" size={16} />
                        </span>
                      )}
                    </div>
                    <div className="drill-card-body">
                      <h3>{d.title}</h3>
                      <div className="btn-row">
                        <Pill tone={d.goal === 'draw' ? 'info' : 'accent'}>{GOAL_LABEL[d.goal]}</Pill>
                        <Pill>{d.level}</Pill>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
