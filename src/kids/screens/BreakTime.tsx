// Break time: shown at an item or results boundary when the session limit is reached, and again
// whenever a resting kid is picked or the app is reopened (the break is saved on the kid). "Bye for
// now!" goes back to the picker; only a grown-up (through the gate) can give 10 more minutes.
import { useEffect, useRef } from 'react';
import { dayKey } from '../../lib/srs';
import type { KidProfile } from '../store/kidsStore';
import { stickerDef } from '../curriculum/stickers';
import { Pip } from '../ui/Pip';
import { BigButton } from '../ui/BigButton';
import { StickerArt } from '../ui/StickerSlot';
import { KidsIcon } from '../ui/KidsIcon';
import { SpeechBubble } from '../ui/SpeechBubble';
import { requireGate } from '../ui/ParentGate';
import { extendSession } from '../player/useSession';
import { sayAs, speech } from '../player/speech';

export function BreakTime({ kid, onBye, onContinue, resting = false }: { kid: KidProfile; onBye(): void; onContinue(): void; resting?: boolean }) {
  const today = kid.days[dayKey()] ?? { minutes: 0, stars: 0 };
  const stickers = (today.stickers ?? []).map((id) => stickerDef(id)).filter((d): d is NonNullable<typeof d> => !!d && !d.id.startsWith('st-garden'));
  const title = resting ? 'Rest time!' : 'Great playing!';
  const lines = resting ? ['Pip is still resting.', 'Come back after a little break!'] : ['Your brain grew today.', 'Time for a little break.'];
  const spoken = [title, ...lines];
  const kidRef = useRef(kid);
  kidRef.current = kid;
  useEffect(() => {
    sayAs(kidRef.current, spoken);
    return () => speech.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resting]);
  return (
    <div className="k-overlay k-break-wrap" role="dialog" aria-label="Break time">
      <div className="k-card k-break">
        <Pip mood="sleepy" size={140} />
        <h2 className="k-title">{title}</h2>
        <SpeechBubble text={lines.join(' ')} tail="top" onSpeak={() => sayAs(kid, spoken, { force: true })} />
        <div className="k-break-today">
          <span className="k-break-stat">
            <KidsIcon name="star" size={28} fill /> {today.stars} {today.stars === 1 ? 'star' : 'stars'} today
          </span>
          {stickers.length > 0 && (
            <div className="k-break-stickers">
              {stickers.slice(0, 6).map((s) => (
                <StickerArt key={s.id} def={s} size={56} />
              ))}
            </div>
          )}
        </div>
        <BigButton
          variant="go"
          icon="home"
          onClick={() => {
            speech.cancel();
            onBye();
          }}
          autoFocus
        >
          Bye for now!
        </BigButton>
        <button
          type="button"
          className="k-linkbtn"
          onClick={() =>
            requireGate('Give 10 more minutes of play.', () => {
              extendSession(kid.id, 10);
              onContinue();
            })
          }
        >
          Grown-up: 10 more minutes
        </button>
      </div>
    </div>
  );
}
