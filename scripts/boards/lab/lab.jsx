// Board lab: every board theme with highlights, check, arrows and move targets, for design
// review. Serve the repo with the Vite dev server (npx vite) and open
// /scripts/boards/lab/index.html (?theme=dark for the dark app palette, ?cols=1 for one
// column, ?only=walnut,marble to pick themes). Not part of the app build.
import { createRoot } from 'react-dom/client';
import '../../../src/styles/tokens.css';
import '../../../src/styles/board.css';
import '../../../src/styles/pieces.css';
import '../../../src/styles/app.css';
import { Board } from '../../../src/chess/Board';
import { BOARD_THEMES } from '../../../src/chess/themes';

const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const cols = Number(params.get('cols') || 4);
const only = params.get('only');
const pieceSet = params.get('pieces') || undefined;

// Black to move, in check from the bishop on b5.
const CHECK = 'rnbqkbnr/ppp1pppp/8/1B1p4/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2';
const OPEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5';

function Row({ theme }) {
  return (
    <>
      <figure className="lab-cell">
        <Board
          pieceSet={pieceSet}
          fen={CHECK}
          lastMove={['f1', 'b5']}
          boardTheme={theme.id}
          arrows={[
            { from: 'c7', to: 'c6', color: 'green' },
            { from: 'b5', to: 'e8', color: 'red' },
          ]}
        />
        <figcaption>{theme.name}: check, last move, arrows</figcaption>
      </figure>
      {/* shots.cjs clicks data-select on these: f3's targets are dark squares (one capture), c3's light. */}
      <figure className="lab-cell lab-select" data-select="f3">
        <Board fen={OPEN} interactive lastMove={['b1', 'c3']} boardTheme={theme.id} pieceSet={pieceSet} />
        <figcaption>{theme.name}: selected, targets on dark squares</figcaption>
      </figure>
      <figure className="lab-cell lab-select" data-select="c3">
        <Board fen={OPEN} interactive lastMove={['e7', 'e5']} boardTheme={theme.id} pieceSet={pieceSet} />
        <figcaption>{theme.name}: selected, targets on light squares</figcaption>
      </figure>
      <figure className="lab-cell">
        <Board
          pieceSet={pieceSet}
          fen={OPEN}
          orientation="black"
          boardTheme={theme.id}
          tones={{ e4: 'good', d5: 'bad', g5: 'hint', b5: 'focus' }}
          marks={[{ square: 'f7', color: 'yellow' }]}
          arrows={[
            { from: 'f3', to: 'g5', color: 'blue' },
            { from: 'c4', to: 'f7', color: 'yellow' },
          ]}
        />
        <figcaption>{theme.name}: flipped, tones, marks</figcaption>
      </figure>
    </>
  );
}

function Lab() {
  const themes = BOARD_THEMES.filter((t) => !only || only.split(',').includes(t.id));
  return (
    <main style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 28, padding: 24 }}>
      {themes.map((t) => (
        <Row key={t.id} theme={t} />
      ))}
      <style>{'body{margin:0;background:var(--bg);color:var(--ink)} .lab-cell{margin:0;display:flex;flex-direction:column;gap:10px;font:600 13px system-ui}'}</style>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Lab />);
