import { useState } from 'react';
import { defaultProfile, normalizeProfile, replaceProfile, updateProfile, useProfile, type BoardTheme, type Profile } from '../store/profile';
import { Board } from '../chess/Board';
import { Button, PageHeader, Segmented } from '../components/ui';
import { toast } from '../lib/toast';
import { useSyncState } from '../store/cloud';

const THEMES: { id: BoardTheme; name: string }[] = [
  { id: 'slate', name: 'Slate' },
  { id: 'walnut', name: 'Walnut' },
  { id: 'tourney', name: 'Tournament' },
  { id: 'ink', name: 'Ink' },
  { id: 'rose', name: 'Rosewood' },
];

const SAMPLE = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

export function SettingsPage() {
  const p = useProfile();
  const s = p.settings;
  const [confirmReset, setConfirmReset] = useState(false);
  const sync = useSyncState();
  const [importText, setImportText] = useState('');
  const set = (patch: Partial<typeof s>) => updateProfile((d) => Object.assign(d.settings, patch));

  const exportData = async () => {
    const text = JSON.stringify(p);
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Progress copied', body: 'Paste it into Import on another device or browser.', icon: 'check', tone: 'good' });
    } catch {
      setImportText(text);
      toast({ title: 'Copy blocked', body: 'Your progress is in the box below: select it and copy by hand.', icon: 'x', tone: 'bad' });
    }
  };

  const importData = () => {
    try {
      const data = JSON.parse(importText) as Profile;
      if (data.v !== 1 || typeof data.xp !== 'number') throw new Error('bad');
      replaceProfile(normalizeProfile(data));
      setImportText('');
      toast({ title: 'Progress imported', icon: 'check', tone: 'good' });
    } catch {
      toast({ title: 'That is not a Tempo export', body: 'Paste the full text you copied with Export.', icon: 'x', tone: 'bad' });
    }
  };

  return (
    <>
      <PageHeader eyebrow="You" title="Settings" />
      <div className="settings">
        <section className="card settings-section">
          <h2>Board</h2>
          <div className="theme-swatches" role="radiogroup" aria-label="Board theme">
            {THEMES.map((t) => (
              <button key={t.id} role="radio" aria-checked={s.boardTheme === t.id} className={`swatch board-${t.id} ${s.boardTheme === t.id ? 'on' : ''}`} onClick={() => set({ boardTheme: t.id })}>
                <span className="swatch-squares">
                  <span style={{ background: 'var(--sq-light)' }} />
                  <span style={{ background: 'var(--sq-dark)' }} />
                  <span style={{ background: 'var(--sq-dark)' }} />
                  <span style={{ background: 'var(--sq-light)' }} />
                </span>
                {t.name}
              </button>
            ))}
          </div>
          <div className="settings-preview">
            <Board fen={SAMPLE} lastMove={['d1', 'h5']} arrows={[{ from: 'h5', to: 'f7', color: 'red' }]} />
          </div>
          <label className="switch">
            <input id="set-coords" type="checkbox" checked={s.coordinates} onChange={(e) => set({ coordinates: e.target.checked })} />
            Show coordinates on the board
          </label>
          <label className="switch">
            <input id="set-queen" type="checkbox" checked={s.autoQueen} onChange={(e) => set({ autoQueen: e.target.checked })} />
            Always promote to a queen
          </label>
        </section>
        <section className="card settings-section">
          <h2>App</h2>
          <div className="play-option">
            <span className="stat-label">Appearance</span>
            <Segmented
              label="Appearance"
              value={s.theme}
              onChange={(v) => set({ theme: v })}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
          <label className="switch">
            <input id="set-sound" type="checkbox" checked={s.sound} onChange={(e) => set({ sound: e.target.checked })} />
            Move sounds
          </label>
          <div className="play-option">
            <span className="stat-label">Daily goal</span>
            <Segmented
              label="Daily XP goal"
              value={String(s.dailyGoal)}
              onChange={(v) => set({ dailyGoal: Number(v) })}
              options={[
                { value: '30', label: 'Light · 30 XP' },
                { value: '60', label: 'Steady · 60 XP' },
                { value: '120', label: 'Serious · 120 XP' },
                { value: '200', label: 'Intense · 200 XP' },
              ]}
            />
          </div>
        </section>
        <section className="card settings-section">
          <h2>Your data</h2>
          <p className="muted">
            {sync === 'synced' || sync === 'saving'
              ? 'Progress is saved to your claude.ai account and kept in this browser.'
              : sync === 'connecting'
                ? 'Connecting to your account storage…'
                : sync === 'error'
                  ? 'Your account storage could not be reached, so progress is kept in this browser for now.'
                  : 'Progress is stored in this browser only. Export it to move to another device.'}
          </p>
          <div className="btn-row">
            <Button icon="download" onClick={exportData}>
              Export progress
            </Button>
          </div>
          <label htmlFor="import-box" className="stat-label">
            Import progress
          </label>
          <textarea id="import-box" className="import-box mono" rows={3} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste an export here" />
          <div className="btn-row">
            <Button onClick={importData} disabled={!importText.trim()}>
              Import
            </Button>
            {!confirmReset ? (
              <Button variant="danger" onClick={() => setConfirmReset(true)}>
                Reset all progress
              </Button>
            ) : (
              <>
                <Button
                  variant="danger"
                  onClick={() => {
                    replaceProfile({ ...defaultProfile(), settings: s });
                    setConfirmReset(false);
                    toast({ title: 'Progress reset', icon: 'refresh' });
                  }}
                >
                  Yes, erase everything
                </Button>
                <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </section>
        <section className="card settings-section">
          <h2>Credits</h2>
          <p className="muted">
            Engine: Stockfish 19 (GPLv3) via stockfish.js. Pieces: “cburnett” by Colin M.L. Burnett. Rules: chess.js. Puzzles are generated from Stockfish self-play and verified for a unique solution.
          </p>
        </section>
      </div>
    </>
  );
}
