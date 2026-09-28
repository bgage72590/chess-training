// Graduation: the pawn reaches rank 8 and promotes. The kid picks Queen or King; a crown drops.
// The printable certificate is offered to grown-ups (behind the gate).
import { useEffect, useState } from 'react';
import type { KidProfile } from '../store/kidsStore';
import { updateKid } from '../store/kidsStore';
import { REGISTRY } from '../packs';
import { canGraduate, grantTrophiesAndHats } from '../store/progress';
import { PawnBuddy } from '../ui/PawnBuddy';
import { Pip } from '../ui/Pip';
import { BigButton } from '../ui/BigButton';
import { Confetti } from '../ui/Confetti';
import { requireGate } from '../ui/ParentGate';
import { sayAs } from '../player/speech';
import { kidSound } from '../lib/kidsSound';
import { go } from '../routes';

export function Graduation({ kid }: { kid: KidProfile }) {
  const ready = canGraduate(kid, REGISTRY) || !!kid.graduated;
  const [form, setForm] = useState<'queen' | 'king' | null>(kid.graduated?.form ?? null);
  const [confetti, setConfetti] = useState(0);
  useEffect(() => {
    if (ready && !kid.graduated) sayAs(kid, ['You made it to the top of Crown Tower!', 'Your pawn can promote. Queen or King?']);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!ready)
    return (
      <div className="k-screen k-center">
        <div className="k-card k-place-card">
          <Pip mood="think" size={120} />
          <p className="k-body">Climb all the way up Crown Tower first!</p>
          <BigButton variant="primary" icon="map" onClick={() => go.map()}>
            Map
          </BigButton>
        </div>
      </div>
    );
  const choose = (f: 'queen' | 'king') => {
    setForm(f);
    updateKid(kid.id, (d) => {
      d.graduated = { t: Date.now(), form: f };
      d.avatar.hat = 'crown';
      grantTrophiesAndHats(d, REGISTRY);
    });
    kidSound('crown');
    kidSound('fanfare');
    setConfetti(Date.now());
    // The name is on screen; Pip's line is recorded.
    sayAs(kid, [f === 'queen' ? 'All hail the chess queen!' : 'All hail the chess king!']);
  };
  return (
    <div className={`k-screen k-graduate${form ? ' gold' : ''}`}>
      <Confetti run={confetti} />
      <div className="k-grad-stage">
        <div className="k-grad-avatar">
          <PawnBuddy color={kid.avatar.color} face={form ? 'grin' : kid.avatar.face} hat={form ? 'crown' : null} size={200} className={form ? 'k-grow' : 'k-bob'} />
          {form && <span className={`k-grad-piece pc-w${form === 'queen' ? 'Q' : 'K'}`} aria-hidden="true" />}
        </div>
        <h1 className="k-title">{form ? `${kid.name}, the chess ${form}!` : 'Your pawn reached the end!'}</h1>
        {!form ? (
          <div className="k-grad-pick">
            <BigButton variant="magic" icon="crown" onClick={() => choose('queen')}>
              Queen
            </BigButton>
            <BigButton variant="primary" icon="crown" onClick={() => choose('king')}>
              King
            </BigButton>
          </div>
        ) : (
          <div className="k-grad-pick">
            <BigButton variant="go" icon="map" onClick={() => go.map()}>
              Map
            </BigButton>
            <button type="button" className="k-linkbtn" onClick={() => requireGate('Print the certificate.', () => go.certificate(kid.id), { keep: true })}>
              Grown-up: print the certificate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Certificate({ kid }: { kid: KidProfile | undefined }) {
  if (!kid) return null;
  const date = new Date(kid.graduated?.t ?? Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div className="k-screen k-cert-screen">
      <div className="k-cert-actions">
        <BigButton variant="plain" size="small" icon="back" onClick={() => go.grownups(kid.id)}>
          Back
        </BigButton>
        <BigButton variant="primary" size="small" icon="print" onClick={() => window.print()}>
          Print
        </BigButton>
      </div>
      <article className="k-cert">
        <p className="k-cert-kicker">Pip&rsquo;s Chess Quest</p>
        <h1>Certificate of Promotion</h1>
        <PawnBuddy color={kid.avatar.color} face={kid.avatar.face} hat="crown" size={120} />
        <p className="k-cert-name">{kid.name}</p>
        <p>Can move all the pieces, give checkmate, and play a full game.</p>
        <p className="k-cert-date">{date}</p>
        <Pip size={72} />
      </article>
    </div>
  );
}
