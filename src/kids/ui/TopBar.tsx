// The player's top bar: leave (X), progress pips (+ a counter chip), hint bulb and speaker.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KidsIcon } from './KidsIcon';
import { ProgressPips, type PipState } from './ProgressPips';
import { pipReact } from './pipEvents';
import { centerOf, flyStar, lastTap } from './rewardFx';

/**
 * The star counter in the chip ("2/3", or a bare count with no total, as in Coordinate Dash). When the
 * count rises, stars fly to it from the square the kid just tapped (else the middle of the board), Pip
 * cheers, and the number counts up with a pop as each lands.
 */
export function ChipStars({ done, total }: { done: number; total?: number }) {
  const [shown, setShown] = useState(done);
  const [hit, setHit] = useState(0);
  const prev = useRef(done);
  const icon = useRef<HTMLSpanElement>(null);
  const flights = useRef<(() => void)[]>([]);
  useEffect(() => {
    const before = prev.current;
    prev.current = done;
    const to = icon.current;
    if (done <= before || !to) return setShown(done); // a new item starts the count again
    const main = document.querySelector('.k-player-main');
    const from = lastTap() ?? (main ? centerOf(main) : centerOf(to));
    const n = Math.min(done - before, 3);
    pipReact('cheer');
    for (let k = 0; k < n; k++)
      flights.current.push(
        flyStar(from, to, {
          size: 30,
          ms: 700,
          delay: k * 130,
          onLand: () => {
            setShown(k === n - 1 ? done : before + k + 1);
            setHit((h) => h + 1);
          },
        }),
      );
  }, [done]);
  useEffect(() => () => flights.current.forEach((cancel) => cancel()), []);
  return (
    <span className="k-chip-stars">
      <span ref={icon} key={`i${hit}`} className={`k-chip-ico${hit ? ' hit' : ''}`}>
        <KidsIcon name="star" size={20} fill />
      </span>
      <span key={`n${hit}`} className={`k-chip-num${hit ? ' hit' : ''}`}>
        {total == null ? shown : `${shown}/${total}`}
      </span>
    </span>
  );
}

export function TopBar({
  onExit,
  pips,
  chip,
  hint,
  onSpeaker,
  inert,
}: {
  /** Out of reach while a modal card (results, Break time) is up. */
  inert?: boolean;
  onExit(): void;
  pips: PipState[];
  chip?: ReactNode;
  hint?: { onPress(): void; pulse?: boolean; disabled?: boolean };
  onSpeaker?: () => void;
}) {
  return (
    <header className="k-topbar" inert={inert || undefined}>
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
