// Kids mode: "Pip's Chess Quest", a separate full-screen app at #/kids/... (lazy-loaded chunk).
// Parses kids routes, keeps a kid active, sets band / bedtime / motion attributes, cancels speech
// on every route change, and hosts the parent gate.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import './fonts';
import './kids.css';
import { useToasts } from '../lib/toast';
import { useKids } from './store/kidsStore';
import { BAND_TUNING } from './curriculum/tuning';
import { KidContext } from './player/context';
import { speech } from './player/speech';
import { useSessionTracker } from './player/useSession';
import { kidsSound } from './lib/kidsSound';
import { resolvePieceSet } from './lib/pieceProbe';
import { isKidsLocked } from './lock';
import { parseKidsRoute, go } from './routes';
import { GateHost, gatePassed, requireGate } from './ui/ParentGate';
import { KidsIcon } from './ui/KidsIcon';
import { Pip } from './ui/Pip';
import { BigButton } from './ui/BigButton';
import { ProfilePicker } from './screens/ProfilePicker';
import { NewKid } from './screens/NewKid';
import { Placement } from './screens/Placement';
import { MapScreen } from './screens/MapScreen';
import { WorldScreen } from './screens/WorldScreen';
import { NodePlay, Warmup } from './screens/Play';
import { Playground } from './screens/Playground';
import { StickerBook } from './screens/StickerBook';
import { Grownups } from './screens/Grownups';
import { Certificate, Graduation } from './screens/Graduation';

/** A locked device lands on the active kid's map once per launch; after that #/kids is the picker. */
let lockedLandingUsed = false;

function useMedia(q: string): boolean {
  return useSyncExternalStore(
    (l) => {
      const m = window.matchMedia?.(q);
      m?.addEventListener?.('change', l);
      return () => m?.removeEventListener?.('change', l);
    },
    () => !!window.matchMedia?.(q).matches,
    () => false,
  );
}

export function KidsApp({ route }: { route: string }) {
  const s = useKids();
  const kid = s.kids.find((k) => k.id === s.activeKid);
  const r = useMemo(() => parseKidsRoute(route), [route]);
  const band = kid?.band ?? 'explorer';
  const darkPref = useMedia('(prefers-color-scheme: dark)');
  const motionPref = useMedia('(prefers-reduced-motion: reduce)');
  const night = kid ? kid.settings.bedtime === 'on' || (kid.settings.bedtime === 'system' && darkPref) : darkPref;
  const reduced = motionPref || kid?.settings.reducedMotion === 'on';

  useSessionTracker(kid?.id ?? null);

  // Speech stops on every route change.
  useEffect(() => {
    speech.cancel();
    if (r.screen !== 'picker') lockedLandingUsed = true;
  }, [route, r.screen]);
  useEffect(() => () => speech.cancel(), []);
  useEffect(() => kidsSound.setEnabled(kid ? kid.settings.sound : true), [kid]);
  useEffect(() => speech.setVoice(s.device.voiceURI), [s.device.voiceURI]);
  useEffect(() => {
    const prev = document.title;
    document.title = "Pip's Chess Quest";
    return () => {
      document.title = prev;
    };
  }, []);

  // With no active kid, only the picker, the new-player wizard and the grown-up pages are open.
  const needsKid = !['picker', 'new', 'grownups', 'certificate'].includes(r.screen);
  useEffect(() => {
    if (needsKid && !kid) go.picker(true);
  }, [needsKid, kid]);

  const ctx = useMemo(() => ({ kid: kid ?? null, band, tuning: BAND_TUNING[band], reducedMotion: reduced }), [kid, band, reduced]);
  const tuning = BAND_TUNING[band];
  const pieceSet = useMemo(() => resolvePieceSet(kid?.settings.pieceSet ?? 'auto'), [kid?.settings.pieceSet]);

  let screen: React.ReactNode = null;
  if (needsKid && !kid) screen = null;
  else
    switch (r.screen) {
      case 'picker':
        if (isKidsLocked() && kid && !lockedLandingUsed && !r.explicit) screen = <MapScreen kid={kid} />;
        else screen = <ProfilePicker />;
        break;
      case 'new':
        screen = <NewKid />;
        break;
      case 'placement':
        screen = <Placement key={r.world ?? 'all'} kid={kid!} single={r.world} />;
        break;
      case 'map':
        screen = <MapScreen kid={kid!} />;
        break;
      case 'world':
        screen = <WorldScreen kid={kid!} worldId={r.world} />;
        break;
      case 'play':
        screen = <NodePlay key={r.node} kid={kid!} nodeId={r.node} />;
        break;
      case 'warmup':
        screen = <Warmup kid={kid!} />;
        break;
      case 'playground':
        screen = <Playground key={r.entry ?? ''} kid={kid!} entryId={r.entry} />;
        break;
      case 'stickers':
        screen = <StickerBook kid={kid!} tab={r.tab} />;
        break;
      case 'grownups':
        screen = (
          <Gated reason="Open the grown-ups area.">
            <Grownups kidId={r.kid} />
          </Gated>
        );
        break;
      case 'graduate':
        screen = <Graduation kid={kid!} />;
        break;
      case 'certificate':
        screen = (
          <Gated reason="Print the certificate.">
            <Certificate kid={s.kids.find((k) => k.id === r.kid)} />
          </Gated>
        );
        break;
    }

  return (
    <KidContext.Provider value={ctx}>
      <div
        className={`kids-app pieces-${pieceSet}`}
        data-band={band}
        data-night={night ? '1' : '0'}
        data-motion={reduced ? 'reduced' : 'full'}
        data-screen={r.screen}
        style={{ ['--k-btn-h' as string]: `${tuning.buttonPx}px` }}
        onPointerDownCapture={() => {
          speech.unlock();
          kidsSound.unlock();
        }}
      >
        <div className="k-sky-deco" aria-hidden="true">
          <span className="k-cloud c1" />
          <span className="k-cloud c2" />
          <span className="k-cloud c3" />
        </div>
        {screen}
        <GateHost />
        <KidsToasts />
      </div>
    </KidContext.Provider>
  );
}

/** Renders children only with a fresh gate pass; otherwise asks for one. */
function Gated({ reason, children }: { reason: string; children: React.ReactNode }) {
  const [, force] = useState(0);
  const ok = gatePassed();
  useEffect(() => {
    if (!ok) requireGate(reason, () => force((x) => x + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok]);
  if (ok) return <>{children}</>;
  return (
    <div className="k-screen k-center">
      <div className="k-card k-place-card">
        <Pip mood="think" size={110} />
        <p className="k-body">This part is for grown-ups.</p>
        <BigButton variant="primary" icon="home" onClick={() => go.picker()}>
          Back
        </BigButton>
      </div>
    </div>
  );
}

/** Kids toasts: a cream pill at the top center (the app-level toast list is hidden in Kids mode). */
function KidsToasts() {
  const toasts = useToasts();
  return (
    <div className="k-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`k-toast tone-${t.tone}`}>
          <KidsIcon name={t.tone === 'bad' ? 'x' : 'star'} size={22} fill={t.tone !== 'bad'} />
          <span>{t.title}</span>
        </div>
      ))}
    </div>
  );
}
