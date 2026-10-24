import { playerWon, useProfile } from '../store/profile';
import { colorName } from '../chess/utils';
import { navigate } from '../router';
import { Button, PageHeader, Pill } from '../components/ui';
import { Icon } from '../components/Icon';
import { gameDate } from '../components/GameBits';
import { LEVELS } from './Play';

export function GamesPage() {
  const p = useProfile();
  return (
    <>
      <PageHeader eyebrow="Play" title="Game reviews" actions={<Button variant="primary" icon="play" onClick={() => navigate('play')}>New game</Button>}>
        Every game against the coach is saved here. Reviewing your mistakes is the fastest way to stop repeating them.
      </PageHeader>
      {p.games.length === 0 ? (
        <div className="empty">
          <h3>No games yet</h3>
          <p style={{ marginTop: 6 }}>Play a game against the coach, then come back to see every mistake explained.</p>
        </div>
      ) : (
        <div className="game-list">
          {p.games.map((g) => {
            const outcome = g.result === '1/2-1/2' ? 'Draw' : playerWon(g) ? 'Win' : 'Loss';
            const lvl = LEVELS[g.level - 1];
            return (
              <button key={g.id} className="game-row card" onClick={() => navigate(`review/${g.id}`)}>
                <Pill tone={outcome === 'Win' ? 'good' : outcome === 'Loss' ? 'bad' : 'info'}>{outcome}</Pill>
                <div className="game-row-main">
                  <strong>
                    vs {lvl?.name} <span className="faint num">~{lvl?.elo}</span>
                  </strong>
                  {/* Separate parts, so a line breaks between them and never after a separator. */}
                  <span className="game-row-meta faint">
                    <span>{colorName(g.playerColor)}</span>
                    <span>{Math.ceil(g.moves.length / 2)} moves</span>
                    <span>{g.reason}</span>
                    <span>{gameDate(g.t)}</span>
                  </span>
                </div>
                <div className="game-row-acc">
                  {g.review ? (
                    <>
                      <span className="stat-value num">{g.review.accuracy[g.playerColor]}%</span>
                      <span className="stat-label">accuracy</span>
                    </>
                  ) : (
                    <span className="game-row-open">
                      <Pill tone="accent">Review</Pill>
                      <Icon name="right" size={16} />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
