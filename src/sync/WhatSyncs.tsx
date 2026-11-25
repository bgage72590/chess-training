import './what-syncs.css';

/**
 * What a sync code shares and what stays on each device, in a short list (the sync card and the join
 * page). `joining`: the join page also says which settings win when the two copies meet.
 */
export function WhatSyncs({ joining = false }: { joining?: boolean }) {
  return (
    <div className="what-syncs">
      <h3 className="stat-label">What syncs</h3>
      <ul className="muted">
        <li>Progress: lessons, puzzles, openings, games, XP and streaks.</li>
        <li>Settings: sound effects and volume, board and pieces, and the rest.</li>
      </ul>
      <h3 className="stat-label">Stays on each device</h3>
      <ul className="muted">
        <li>Whether Tempo is installed and saved for offline use here.</li>
      </ul>
      {joining && <p className="muted">Settings the synced copy already has are kept; settings only this device has are added.</p>}
    </div>
  );
}
