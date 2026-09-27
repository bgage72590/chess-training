// "Show Pip what you know!": world checkpoints (3 items each). 2 of 3 tests a world out; 2 misses
// stops. Never called a test; no score display, just a 3-dot path per world.
import { useMemo, useState } from 'react';
import type { ItemResult } from '../activities/types';
import { CHECKPOINTS, REGISTRY } from '../packs';
import { WORLDS } from '../curriculum/worlds';
import { BAND_TUNING } from '../curriculum/tuning';
import { applyPlacement, worldPassed, placementItemPass, placementStart, placementStep, placementWorldPassed, type PlacementState } from '../store/progress';
import { updateKid, type KidProfile } from '../store/kidsStore';
import { ActivityPlayer } from '../player/ActivityPlayer';
import { Pip } from '../ui/Pip';
import { PawnBuddy } from '../ui/PawnBuddy';
import { BigButton } from '../ui/BigButton';
import { SpeechBubble } from '../ui/SpeechBubble';
import { speech } from '../player/speech';
import { go } from '../routes';

export function Placement({ kid, single }: { kid: KidProfile; single?: number }) {
  const cap = BAND_TUNING[kid.band].placementCap;
  const [state, setState] = useState<PlacementState>(() => (single ? { entry: 1, world: single, tested: [], restarted: false, done: false, startWorld: single } : placementStart(kid.start === 'games' ? 'games' : 'moves')));
  const [dots, setDots] = useState<('pass' | 'miss')[]>([]);
  const [between, setBetween] = useState<{ passed: boolean; next: PlacementState } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [intro, setIntro] = useState(!single);
  const [singlePassed, setSinglePassed] = useState(false);
  const world = WORLDS[state.world - 1];
  const set = CHECKPOINTS.get(`cp${state.world}`);

  const onWorldDone = (results: ItemResult[]) => {
    const passed = placementWorldPassed(results);
    setDots(results.map((r) => (placementItemPass(r) ? 'pass' : 'miss')));
    if (single) {
      const tested = passed ? Array.from({ length: single - 1 }, (_, i) => i + 1).filter((w) => !worldPassed(kid, WORLDS[w - 1].id, REGISTRY)) : [];
      if (passed) updateKid(kid.id, (d) => applyPlacement(d, tested));
      setSinglePassed(passed);
      setState({ ...state, done: true, startWorld: single, tested });
      return;
    }
    const next = placementStep(state, passed, cap);
    setBetween({ passed, next });
  };

  const continueOn = () => {
    if (!between) return;
    const next = between.next;
    setBetween(null);
    setDots([]);
    setAttempt((a) => a + 1);
    if (next.done) updateKid(kid.id, (d) => applyPlacement(d, next.tested));
    setState(next);
  };

  const skipAll = () => {
    speech.cancel();
    updateKid(kid.id, (d) => void (d.placed = true));
    go.play('w1-hello', true);
  };

  const dotsRow = useMemo(
    () => (
      <div className="k-place-path" aria-label={`Rank ${state.world}`}>
        <span className="k-place-rank">Rank {state.world}</span>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`k-place-dot ${dots[i] ?? (i === dots.length ? 'now' : '')}`} />
        ))}
      </div>
    ),
    [dots, state.world],
  );

  if (intro)
    return (
      <div className="k-screen k-placement k-center">
        <div className="k-card k-place-card">
          <Pip mood="cheer" size={140} />
          <h1 className="k-title">Show Pip what you know!</h1>
          <SpeechBubble text="Let's play a few quick games so I know where your adventure starts." tail="top" onSpeak={() => speech.speak(["Let's play a few quick games so I know where your adventure starts."])} />
          <BigButton variant="go" icon="play" onClick={() => setIntro(false)} whoosh autoFocus>
            Let&rsquo;s go!
          </BigButton>
          <button type="button" className="k-linkbtn" onClick={skipAll}>
            Grown-up: start at the beginning
          </button>
        </div>
      </div>
    );

  if (state.done) {
    const sw = WORLDS[Math.min(8, state.startWorld) - 1];
    const text = single ? (singlePassed ? `Rank ${sw.rank}: ${sw.title} is open!` : 'Good try! Keep playing to get there.') : `You start at Rank ${sw.rank}: ${sw.title}!`;
    return (
      <div className="k-screen k-placement k-center">
        <div className="k-card k-place-card">
          <PawnBuddy color={kid.avatar.color} face={kid.avatar.face} hat={kid.avatar.hat} size={120} className="k-hop-up" />
          <h1 className="k-title">{text}</h1>
          <BigButton
            variant="primary"
            icon="map"
            onClick={() => {
              speech.cancel();
              go.map(true);
            }}
            autoFocus
            whoosh
          >
            To the map!
          </BigButton>
        </div>
      </div>
    );
  }

  if (!set || !world) return null;
  return (
    <div className="k-screen k-placement">
      <ActivityPlayer
        key={`${state.world}-${attempt}`}
        mode="placement"
        kid={kid}
        set={set}
        title={`Rank ${world.rank}: ${world.title}`}
        header={dotsRow}
        onPlacementDone={onWorldDone}
        onExit={() => go.map()}
      />
      {between && (
        <div className="k-overlay">
          <div className="k-card k-place-card">
            <Pip mood={between.passed ? 'cheer' : 'idle'} size={110} />
            {dotsRow}
            <h2 className="k-title">{between.passed ? `You know ${world.title}!` : between.next.done ? 'Great trying!' : 'Let’s warm up first!'}</h2>
            <BigButton variant="primary" icon="next" onClick={continueOn} autoFocus whoosh>
              Next
            </BigButton>
          </div>
        </div>
      )}
    </div>
  );
}
