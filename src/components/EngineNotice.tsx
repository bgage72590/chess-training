import { useEffect } from 'react';
import { engine, useEngineStatus } from '../engine/engine';
import { Icon } from './Icon';

/** Starts the engine and shows its loading / failure state. Renders nothing once ready. */
export function EngineNotice() {
  const status = useEngineStatus();
  useEffect(() => {
    engine.init().catch(() => undefined);
  }, []);
  if (status === 'ready') {
    if (engine.kind !== 'backup') return null;
    return (
      <div className="feedback feedback-warn">
        <Icon name="bolt" />
        <div>
          <strong>Using the backup engine</strong>
          <span className="feedback-body">This browser blocked Stockfish, so a lighter built-in engine is running. It plays at club level and its evaluations are approximate.</span>
        </div>
      </div>
    );
  }
  if (status === 'failed')
    return (
      <div className="feedback feedback-bad">
        <Icon name="x" />
        <div>
          <strong>The engine could not start</strong>
          <span className="feedback-body">This browser blocked background workers. Lessons, puzzles, openings and vision drills still work; engine play needs a browser that allows Web Workers.</span>
        </div>
      </div>
    );
  return (
    <div className="feedback feedback-info">
      <span className="spinner" aria-hidden="true" />
      <div>
        <strong>Loading Stockfish…</strong>
      </div>
    </div>
  );
}
