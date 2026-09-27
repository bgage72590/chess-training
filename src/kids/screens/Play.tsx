// Route wrappers around the ActivityPlayer: a node, and Pip's Warm-up.
import { useEffect, useMemo, useState } from 'react';
import type { KidProfile } from '../store/kidsStore';
import { LEVEL_SETS, REGISTRY } from '../packs';
import { NODE_BY_ID } from '../curriculum/worlds';
import { nextNode, nodeUnlocked, warmupPlan } from '../store/progress';
import { hashSeed, mulberry32 } from '../lib/rng';
import { dayKey } from '../../lib/srs';
import { ActivityPlayer, type PlanItem } from '../player/ActivityPlayer';
import { pickWarmupItem } from '../player/run';
import { Pip } from '../ui/Pip';
import { BigButton } from '../ui/BigButton';
import { SpeechBubble } from '../ui/SpeechBubble';
import { speech } from '../player/speech';
import { warmupDone } from './MapScreen';
import { go } from '../routes';

export function NodePlay({ kid, nodeId }: { kid: KidProfile; nodeId: string }) {
  const [round, setRound] = useState(0);
  const node = NODE_BY_ID.get(nodeId);
  const set = LEVEL_SETS.get(nodeId);
  const open = !!node && !!set && nodeUnlocked(kid, nodeId, REGISTRY);
  if (!node || !set || !open)
    return (
      <div className="k-screen k-center">
        <div className="k-card k-place-card">
          <Pip mood="think" size={120} />
          <SpeechBubble text={!set ? 'This one is coming soon!' : "This path isn't open yet. Let's play the one before it!"} tail="top" />
          <BigButton variant="primary" icon="map" onClick={() => go.map()} autoFocus>
            Map
          </BigButton>
        </div>
      </div>
    );
  return <ActivityPlayer key={`${nodeId}-${round}`} mode="node" kid={kid} nodeId={nodeId} set={set} title={node.title} onAgain={() => setRound((r) => r + 1)} />;
}

export function Warmup({ kid }: { kid: KidProfile }) {
  const [started, setStarted] = useState(false);
  const plan = useMemo<PlanItem[]>(() => {
    const rng = mulberry32(hashSeed(kid.id, dayKey(), 'warmup'));
    return warmupPlan(kid, REGISTRY).flatMap((n) => {
      const set = LEVEL_SETS.get(n.id);
      const run = set && pickWarmupItem(set, kid.band, kid.nodes[n.id]?.lastItems ?? [], rng);
      return run ? [{ setId: n.id, nodeId: n.id, run }] : [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kid.id]);
  const continueToNode = () => {
    warmupDone.add(kid.id);
    speech.cancel();
    const n = nextNode(kid, REGISTRY);
    if (n) go.play(n.id, true);
    else go.map(true);
  };
  useEffect(() => {
    if (!plan.length) continueToNode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!plan.length) return null;
  if (!started)
    return (
      <div className="k-screen k-center">
        <div className="k-card k-place-card">
          <Pip mood="cheer" size={130} />
          <h1 className="k-title">Pip&rsquo;s Warm-up!</h1>
          <SpeechBubble text={plan.length === 1 ? "One quick one from before. Let's go!" : `${plan.length} quick ones from before. Let's go!`} tail="top" />
          <BigButton variant="go" icon="play" onClick={() => setStarted(true)} autoFocus whoosh>
            Warm up
          </BigButton>
          <button type="button" className="k-linkbtn" onClick={continueToNode}>
            Skip warm-up
          </button>
        </div>
      </div>
    );
  return <ActivityPlayer mode="warmup" kid={kid} plan={plan} title="Warm-up" onContinue={continueToNode} onExit={() => (warmupDone.add(kid.id), go.map())} />;
}
