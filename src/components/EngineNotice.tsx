import { useEffect } from 'react';
import { engine, useEngineStatus } from '../engine/engine';
import { Feedback } from './ui';

/** Starts the engine and shows its loading / failure state. Renders nothing once ready. */
export function EngineNotice() {
  const status = useEngineStatus();
  useEffect(() => {
    engine.init().catch(() => undefined);
  }, []);
  if (status === 'ready') {
    if (engine.kind !== 'backup') return null;
    return (
      <Feedback
        tone="warn"
        icon="bolt"
        title="Using the backup engine"
        body="Stockfish could not be loaded here, so a lighter built-in engine is running. It plays at club level and its evaluations are approximate."
      />
    );
  }
  if (status === 'failed')
    return (
      <Feedback
        tone="bad"
        icon="x"
        title="The engine could not start"
        body="This browser blocked background workers. Lessons, puzzles, openings and vision drills still work; engine play needs a browser that allows Web Workers."
      />
    );
  return <Feedback tone="info" icon={<span className="spinner" aria-hidden="true" />} title="Loading Stockfish…" />;
}
