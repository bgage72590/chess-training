// The player's top bar: leave (X), progress pips (+ a counter chip), hint bulb and speaker.
import type { ReactNode } from 'react';
import { KidsIcon } from './KidsIcon';
import { ProgressPips, type PipState } from './ProgressPips';

export function TopBar({
  onExit,
  pips,
  chip,
  hint,
  onSpeaker,
}: {
  onExit(): void;
  pips: PipState[];
  chip?: ReactNode;
  hint?: { onPress(): void; pulse?: boolean; disabled?: boolean };
  onSpeaker?: () => void;
}) {
  return (
    <header className="k-topbar">
      <button type="button" className="k-round k-round-plain" aria-label="Leave" onClick={onExit}>
        <KidsIcon name="x" size={28} />
      </button>
      <div className="k-topbar-mid">
        <ProgressPips states={pips} />
        {chip && <div className="k-chip">{chip}</div>}
      </div>
      <div className="k-topbar-right">
        {hint && (
          <button type="button" className={`k-round k-round-magic${hint.pulse ? ' pulse' : ''}`} aria-label="Hint" onClick={hint.onPress} disabled={hint.disabled}>
            <KidsIcon name="bulb" size={28} />
          </button>
        )}
        {onSpeaker && (
          <button type="button" className="k-round k-round-plain" aria-label="Say it again" onClick={onSpeaker}>
            <KidsIcon name="speaker" size={28} />
          </button>
        )}
      </div>
    </header>
  );
}
