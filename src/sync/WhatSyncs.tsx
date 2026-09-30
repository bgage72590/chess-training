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
        <li>Players in Kids mode, with their progress.</li>
        <li>In the grown-up app: sound effects and volume, and your other settings.</li>
        <li>For each player: Pip&rsquo;s voice, reading mode, speech speed and Sounds.</li>
      </ul>
      <h3 className="stat-label">Stays on each device</h3>
      <ul className="muted">
        <li>The device voice, the parent PIN and the Kids lock, quiet mode, and downloaded voices.</li>
      </ul>
      {joining && <p className="muted">Settings the synced copy already has are kept; settings only this device has are added.</p>}
    </div>
  );
}
