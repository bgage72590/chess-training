// Break time: shown at an item or results boundary when the session limit is reached.
import { useEffect } from 'react';
import { dayKey } from '../../lib/srs';
import type { KidProfile } from '../store/kidsStore';
import { stickerDef } from '../curriculum/stickers';
import { Pip } from '../ui/Pip';
import { BigButton } from '../ui/BigButton';
import { StickerArt } from '../ui/StickerSlot';
import { KidsIcon } from '../ui/KidsIcon';
import { requireGate } from '../ui/ParentGate';
import { extendSession, startSession } from '../player/useSession';
import { speech } from '../player/speech';
import { go } from '../routes';
import { setActiveKid } from '../store/kidsStore';

export function BreakTime({ kid, onContinue }: { kid: KidProfile; onContinue(): void }) {
  const today = kid.days[dayKey()] ?? { minutes: 0, stars: 0 };
  const stickers = (today.stickers ?? []).map((id) => stickerDef(id)).filter((d): d is NonNullable<typeof d> => !!d && !d.id.startsWith('st-garden'));
  useEffect(() => {
    if (kid.settings.voice !== 'off') speech.speak(['Great playing! Your brain grew today.', 'Time for a little break.']);
  }, [kid.settings.voice]);
  return (
    <div className="k-overlay k-break-wrap" role="dialog" aria-label="Break time">
      <div className="k-card k-break">
        <Pip mood="sleepy" size={140} />
        <h2 className="k-title">Great playing!</h2>
        <p className="k-body">Your brain grew today. Time for a little break.</p>
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
            startSession(null);
            setActiveKid(null);
            go.picker();
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
              extendSession(10);
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
