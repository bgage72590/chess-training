import { useState } from 'react';
import { openings, type Opening } from '../content';
import { navigate } from '../router';
import { useProfile, type Profile } from '../store/profile';
import { MASTERED_BOX } from '../lib/srs';
import { Board } from '../chess/Board';
import { Button, PageHeader, Pill, ProgressBar, Segmented } from '../components/ui';
import { Chess } from 'chess.js';
import { dueLines } from '../lib/due';

export function openingStats(o: Opening, p: Profile) {
  const now = Date.now();
  let learned = 0;
  let due = 0;
  let mastered = 0;
  for (const l of o.lines) {
    const c = p.lines[l.id];
    if (!c) continue;
    learned++;
    if (c.due <= now) due++;
    if (c.box >= MASTERED_BOX) mastered++;
  }
  return { learned, due, mastered, total: o.lines.length };
}

function previewFen(o: Opening): string {
  // Position after the shared start of all lines (at most 8 plies) for the card diagram.
  const lines = o.lines.map((l) => l.moves.split(' '));
  const shared: string[] = [];
  for (let i = 0; i < 8; i++) {
    const m = lines[0]?.[i];
    if (!m || !lines.every((l) => l[i] === m)) break;
    shared.push(m);
  }
  const c = new Chess();
  for (const m of shared) c.move(m);
  return c.fen();
}

export function OpeningsPage() {
  const p = useProfile();
  const [side, setSide] = useState<'white' | 'black'>('white');
  const due = dueLines(p);
  const list = openings.filter((o) => o.side === side);
  return (
    <>
      <PageHeader
        eyebrow="Repertoire"
        title="Openings you understand"
        actions={<Segmented label="Side" value={side} onChange={setSide} options={[{ value: 'white', label: 'As White' }, { value: 'black', label: 'As Black' }]} />}
      >
        Learn each line with the reason behind every move, then drill it from memory. Lines return for review just before you would forget them.
      </PageHeader>
      {due.length > 0 && (
        <div className="due-banner card">
          <div>
            <strong>{due.length} line{due.length > 1 ? 's' : ''} due for review</strong>
            <p className="muted">A two-minute review now keeps them in long-term memory.</p>
          </div>
          <Button variant="primary" iconRight="right" onClick={() => navigate(`opening/${due[0].openingId}?review`)}>
            Review now
          </Button>
        </div>
      )}
      {list.length === 0 ? (
        <div className="empty">Opening chapters are being written.</div>
      ) : (
        <div className="grid grid-2">
          {list.map((o) => {
            const s = openingStats(o, p);
            return (
              <button key={o.id} className="opening-card card" onClick={() => navigate(`opening/${o.id}`)}>
                <div className="opening-card-board">
                  <Board fen={previewFen(o)} orientation={o.side} coordinates={false} />
                </div>
                <div className="opening-card-body">
                  <div className="btn-row">
                    <Pill>{o.eco}</Pill>
                    <Pill tone={o.level === 'Beginner' ? 'good' : o.level === 'Intermediate' ? 'info' : 'accent'}>{o.level}</Pill>
                    {s.due > 0 && <Pill tone="warn">{s.due} due</Pill>}
                  </div>
                  <h3>{o.name}</h3>
                  <p className="muted clamp-3">{o.summary}</p>
                  <div className="opening-card-foot">
                    <span className="faint num">
                      {s.learned}/{s.total} lines
                    </span>
                    <ProgressBar value={s.learned + s.mastered} max={s.total * 2} tone={s.mastered === s.total ? 'good' : 'accent'} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
