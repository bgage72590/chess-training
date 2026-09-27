// "Who's playing?": the family star jar, one tile per kid, and "+ New player". Grown-ups and Exit
// sit small in the corners, behind the parent gate.
import { useEffect, useState } from 'react';
import { navigate } from '../../router';
import { MAX_KIDS, setActiveKid, useKids, type KidProfile } from '../store/kidsStore';
import { currentWorld, totalStars } from '../store/progress';
import { REGISTRY } from '../packs';
import { WORLD_BY_ID } from '../curriculum/worlds';
import { AvatarTile } from '../ui/AvatarTile';
import { PawnBuddy } from '../ui/PawnBuddy';
import { Pip } from '../ui/Pip';
import { StarJar } from '../ui/StarJar';
import { KidsIcon } from '../ui/KidsIcon';
import { BigButton } from '../ui/BigButton';
import { SpeechBubble } from '../ui/SpeechBubble';
import { Confetti } from '../ui/Confetti';
import { requireGate } from '../ui/ParentGate';
import { sayAs, speech } from '../player/speech';
import { extendSession, markBreak, noteInput, onBreak, sessionOver } from '../player/useSession';
import { go } from '../routes';
import { isKidsLocked } from '../lock';
import { toast } from '../../lib/toast';

export const rankOf = (kid: KidProfile) => WORLD_BY_ID.get(currentWorld(kid, REGISTRY))!.rank;

export function pickKid(kid: KidProfile) {
  setActiveKid(kid.id);
  noteInput();
  // A resting kid (or one whose limit ran out) gets Break time, never a fresh session.
  if (sessionOver(kid)) {
    markBreak(kid.id);
    go.map();
    return;
  }
  if (!kid.placed && kid.start !== 'new') go.placement();
  else if (!Object.keys(kid.nodes).length) go.play('w1-hello');
  else go.map();
}

export function ProfilePicker() {
  const s = useKids();
  const [splash, setSplash] = useState(s.kids.length === 1);
  const [party, setParty] = useState(0);
  useEffect(() => {
    // A Family Party when the jar crossed a new hundred since the last visit.
    const key = 'tempo.kids.party.seen';
    try {
      const seen = Number(sessionStorage.getItem(key) ?? '0');
      if (s.family.parties > seen) {
        setParty(Date.now());
        sessionStorage.setItem(key, String(s.family.parties));
      }
    } catch {
      /* ignore */
    }
  }, [s.family.parties]);

  const addKid = () => (s.kids.length ? requireGate('Add a new player.', () => go.newKid()) : go.newKid());

  if (!s.kids.length) {
    return (
      <div className="k-screen k-picker k-welcome">
        <div className="k-welcome-card k-card">
          <Pip mood="cheer" size={160} />
          <SpeechBubble text="Hi! I'm Pip. Let's make your chess buddy!" tail="top" onSpeak={() => sayAs(null, ["Hi! I'm Pip. Let's make your chess buddy!"], { force: true })} />
          <BigButton variant="primary" icon="plus" onClick={() => go.newKid()} whoosh>
            New player
          </BigButton>
        </div>
        <PickerCorners />
      </div>
    );
  }

  if (splash && s.kids.length === 1 && onBreak(s.kids[0])) {
    const k = s.kids[0];
    return (
      <div className="k-screen k-picker k-splash k-splash-rest">
        <div className="k-splash-card">
          <Pip mood="sleepy" size={150} />
          <h1 className="k-title k-splash-hi">Hi {k.name || 'friend'}!</h1>
          <SpeechBubble text="Pip is resting. Come back after a little break!" tail="top" onSpeak={() => sayAs(k, ['Pip is resting.', 'Come back after a little break!'], { force: true })} />
          <button
            type="button"
            className="k-linkbtn"
            onClick={() =>
              requireGate('Give 10 more minutes of play.', () => {
                extendSession(k.id, 10);
                pickKid(k);
              })
            }
          >
            Grown-up: 10 more minutes
          </button>
        </div>
        <button type="button" className="k-linkbtn k-splash-other" onClick={() => setSplash(false)}>
          Someone else is playing
        </button>
        <PickerCorners />
      </div>
    );
  }

  if (splash && s.kids.length === 1) {
    const k = s.kids[0];
    return (
      <div className="k-screen k-picker k-splash" onClick={() => pickKid(k)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && pickKid(k)} aria-label={`Hi ${k.name || 'friend'}! Tap to play.`}>
        <div className="k-splash-card">
          <PawnBuddy color={k.avatar.color} face={k.avatar.face} hat={k.graduated ? 'crown' : k.avatar.hat} size={160} className="k-bob" />
          <h1 className="k-title k-splash-hi">Hi {k.name || 'friend'}!</h1>
          <p className="k-splash-tap">
            <KidsIcon name="play" size={28} /> Tap to play
          </p>
        </div>
        <button
          type="button"
          className="k-linkbtn k-splash-other"
          onClick={(e) => {
            e.stopPropagation();
            setSplash(false);
          }}
        >
          Someone else is playing
        </button>
        <PickerCorners />
      </div>
    );
  }

  return (
    <div className="k-screen k-picker">
      <Confetti run={party} />
      <header className="k-picker-head">
        <StarJar stars={s.family.stars} />
        <h1 className="k-title">Who&rsquo;s playing?</h1>
      </header>
      <div className="k-avatar-grid">
        {s.kids.map((k) => (
          <AvatarTile key={k.id} kid={k} rank={rankOf(k)} stars={totalStars(k)} resting={onBreak(k)} onPick={() => pickKid(k)} />
        ))}
        {s.kids.length < MAX_KIDS && (
          <button type="button" className="k-avatar-tile k-avatar-new" onClick={addKid}>
            <span className="k-avatar-plus">
              <KidsIcon name="plus" size={48} />
            </span>
            <span className="k-avatar-name">New player</span>
          </button>
        )}
      </div>
      <PickerCorners />
    </div>
  );
}

function PickerCorners() {
  return (
    <div className="k-corners" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="k-corner" onClick={() => requireGate('Open the grown-ups area.', () => go.grownups(), { keep: true })}>
        <KidsIcon name="lock" size={20} /> Grown-ups
      </button>
      <button
        type="button"
        className="k-corner"
        onClick={() =>
          requireGate('Leave Kids mode.', () => {
            if (isKidsLocked()) {
              toast({ title: 'Kids mode is locked on this device. Turn it off in Grown-ups.' }, 3500);
              return;
            }
            speech.cancel();
            navigate('home');
          })
        }
      >
        <KidsIcon name="door" size={20} /> Exit
      </button>
    </div>
  );
}
