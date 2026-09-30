// Kids mode: "Pip's Chess Quest", a separate full-screen app at #/kids/... (lazy-loaded chunk).
// Parses kids routes, keeps a kid active, sets band / bedtime / motion attributes, cancels speech
// on every route change, and hosts the parent gate.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import './fonts';
import './kids.css';
import './motion-nav.css';
import { useToasts } from '../lib/toast';
import { persistAfterProgress } from '../lib/storage';
import { getKids, setActiveKid, subscribeKids, useKids } from './store/kidsStore';
import { registerKidsSync } from './store/syncKids';
import { pipVoiceFor } from './store/familyVoice';
import { isQuiet } from './store/quiet';
import { sync } from '../sync';
import { BAND_TUNING } from './curriculum/tuning';
import { KidContext } from './player/context';
import { speech } from './player/speech';
import { breakIsFresh, clearFreshBreak, markBreak, onBreak, sessionOver, useSessionTracker } from './player/useSession';
import { kidsSound } from './lib/kidsSound';
import { resolvePieceSet } from './lib/pieceProbe';
import { RouteTrail } from './lib/navMotion';
import { isKidsLocked } from './lock';
import { parseKidsRoute, go } from './routes';
import { cancelGate, clearGatePass, GateHost, gatePassed, requireGate } from './ui/ParentGate';
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
import { BreakTime } from './screens/BreakTime';

registerKidsSync();
// The first finished lesson or game is when the browser is asked to keep the data.
persistAfterProgress(subscribeKids, () => getKids().kids.some((k) => Object.values(k.nodes).some((n) => n.plays > 0)));

/** Screens that belong to grown-ups: a gate pass lives only while one of these is open. */
const GROWNUP_SCREENS = ['grownups', 'certificate'];
/** Calm screens between plays, where a reached session limit turns into Break time right away.
 *  Not the warm-up: its route also holds the items, and the player ends those at an item boundary. */
const BOUNDARY_SCREENS = ['map', 'world', 'stickers', 'graduate'];

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
  const [trail] = useState(() => new RouteTrail());
  // The loading cover (App.tsx) is still on screen while this first renders: fade out of its cream.
  const [veil] = useState(() => !!document.querySelector('.kids-loading'));

  useSessionTracker(kid?.id ?? null);

  // Speech stops on every route change (and on leaving Kids mode). A cleanup, so it runs before the
  // new screen's effects and stops only the old screen's lines, never the new screen's first one.
  useEffect(() => () => speech.leaveScreen(), [route]);
  // A parent gate asked for on one screen closes with it (the new screen's own request comes after).
  useEffect(() => () => cancelGate(), [route]);
  useEffect(() => {
    if (r.screen !== 'picker') lockedLandingUsed = true;
  }, [r.screen]);
  // Leaving the grown-ups area ends the gate pass, so a handed-back device asks again.
  useEffect(() => {
    if (!GROWNUP_SCREENS.includes(r.screen)) clearGatePass();
  }, [r.screen]);
  // A reached session limit (after a reload, say) becomes Break time on the calm screens.
  useEffect(() => {
    if (kid && BOUNDARY_SCREENS.includes(r.screen) && sessionOver(kid)) markBreak(kid.id);
  }, [kid, r.screen]);
  useEffect(() => kidsSound.setEnabled(kid ? kid.settings.sound && !isQuiet(kid.id) : true), [kid, s.device.quiet]);
  useEffect(() => speech.setVoice(s.device.voiceURI), [s.device.voiceURI]);
  // The active kid's voice, or the family's while nobody is picked (the picker, the New player wizard).
  const pipVoice = pipVoiceFor(s);
  useEffect(() => void speech.setPipVoice(pipVoice), [pipVoice]);
  // Opening Kids mode looks for news from the other devices (a voice or a player set there) right away.
  useEffect(() => void sync.syncNow(), []);
  // Sound is Pip's voice: while Kids mode is open the audio session is 'playback', and the first gesture of any
  // kind (a tap, a key press, VoiceOver or Switch Control) unlocks the sounds and the voice (lib/audio.ts).
  useEffect(() => {
    const stops = [kidsSound.enter(), speech.enter()];
    return () => stops.forEach((stop) => stop());
  }, []);
  useEffect(() => {
    const prev = document.title;
    document.title = "Pip's Chess Quest";
    return () => {
      document.title = prev;
    };
  }, []);

  // With no active kid, only the picker, the new-player wizard and the grown-up pages are open.
  const needsKid = !['picker', 'new', ...GROWNUP_SCREENS].includes(r.screen);
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

  // How the screen arrives (see motion-nav.css). The same answer on every render of one screen, and
  // none for the first one shown, so the app never animates in on its first paint.
  const nav = screen ? trail.step(r) : null;
  // A new screen starts at the top (the app is the scroller). Pinned bars inside the sliding screen
  // then sit where they belong for the whole move.
  const appEl = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (appEl.current) appEl.current.scrollTop = 0;
  }, [nav?.key]);

  return (
    <KidContext.Provider value={ctx}>
      <div
        ref={appEl}
        className={`kids-app pieces-${pieceSet}`}
        data-band={band}
        data-night={night ? '1' : '0'}
        data-motion={reduced ? 'reduced' : 'full'}
        data-screen={r.screen}
        data-veil={veil ? '1' : undefined}
        style={{ ['--k-btn-h' as string]: `${tuning.buttonPx}px` }}
      >
        <div className="k-sky-deco" aria-hidden="true">
          <span className="k-cloud c1" />
          <span className="k-cloud c2" />
          <span className="k-cloud c3" />
        </div>
        {nav && (
          <div key={nav.key} className="k-route" data-nav={nav.dir ?? undefined}>
            {screen}
          </div>
        )}
        {kid && needsKid && onBreak(kid) && (
          <BreakTime
            kid={kid}
            resting={!breakIsFresh(kid.id)}
            onBye={() => {
              clearFreshBreak();
              setActiveKid(null);
              go.backToPicker();
            }}
            onContinue={clearFreshBreak}
          />
        )}
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
    if (!ok) requireGate(reason, () => force((x) => x + 1), { keep: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok]);
  if (ok) return <>{children}</>;
  return (
    <div className="k-screen k-center">
      <div className="k-card k-place-card">
        <Pip mood="think" size={110} />
        <p className="k-body">This part is for grown-ups.</p>
        <BigButton variant="primary" icon="home" onClick={() => go.upToPicker()}>
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
