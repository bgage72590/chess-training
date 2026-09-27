// The Playground: free play that earns trophies and personal bests but never changes map progress.
import { useMemo, useState } from 'react';
import type { LevelSet, PlaygroundEntry } from '../activities/types';
import { bandText } from '../activities/types';
import type { KidProfile } from '../store/kidsStore';
import { useKids } from '../store/kidsStore';
import { ACTIVITIES, PLAYGROUND } from '../packs';
import { totalStars, worldPassed } from '../store/progress';
import { REGISTRY } from '../packs';
import { hashSeed, mulberry32 } from '../lib/rng';
import { BAND_TUNING } from '../curriculum/tuning';
import { ActivityPlayer } from '../player/ActivityPlayer';
import { MapBar } from './MapScreen';
import { KidsIcon } from '../ui/KidsIcon';
import { Pip } from '../ui/Pip';
import { PawnBuddy } from '../ui/PawnBuddy';
import { BigButton } from '../ui/BigButton';
import { go } from '../routes';

const unlocked = (kid: KidProfile, e: PlaygroundEntry) =>
  (!e.bands || e.bands.includes(kid.band)) &&
  (!e.unlock?.node || (kid.nodes[e.unlock.node]?.stars ?? 0) > 0) &&
  (!e.unlock?.stars || totalStars(kid) >= e.unlock.stars) &&
  ACTIVITIES.has(e.activity);

export function Playground({ kid, entryId }: { kid: KidProfile; entryId?: string }) {
  const open = kid.start === 'games' || worldPassed(kid, 'w5', REGISTRY);
  const entries = PLAYGROUND.filter((e) => unlocked(kid, e));
  const entry = entryId ? entries.find((e) => e.id === entryId) : undefined;
  if (entry && open) return <PlaygroundGame kid={kid} entry={entry} />;
  return (
    <div className="k-screen k-playground">
      <MapBar kid={kid} stars={totalStars(kid)} back={() => go.map()} playgroundOpen={open} />
      <div className="k-page-head">
        <h1 className="k-title">Playground</h1>
      </div>
      {!open ? (
        <div className="k-card k-empty-card">
          <Pip mood="think" size={110} />
          <p className="k-body">The Playground opens after Rank 5: Pawn Parade. Keep going!</p>
          <BigButton variant="primary" icon="map" onClick={() => go.map()}>
            Map
          </BigButton>
        </div>
      ) : entries.length ? (
        <div className="k-tiles">
          {entries.map((e) => (
            <button key={e.id} type="button" className="k-tile" onClick={() => go.playground(e.id)}>
              <span className="k-tile-icon">
                <KidsIcon name={e.icon} size={44} />
              </span>
              <span className="k-tile-title">{bandText(e.title, kid.band)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="k-card k-empty-card">
          <Pip mood="cheer" size={110} />
          <p className="k-body">More games are coming!</p>
        </div>
      )}
    </div>
  );
}

function PlaygroundGame({ kid, entry }: { kid: KidProfile; entry: PlaygroundEntry }) {
  const [round, setRound] = useState(0);
  const [friend, setFriend] = useState<{ kidId: string | null } | null>(entry.friend ? null : { kidId: null });
  const kids = useKids().kids.filter((k) => k.id !== kid.id);
  const act = ACTIVITIES.get(entry.activity)!;
  // "review" entries are endless: fresh generated items each round.
  const set = useMemo<LevelSet>(() => {
    const rng = mulberry32(hashSeed(kid.id, entry.id, round, Date.now()));
    const n = BAND_TUNING[kid.band].itemsPerRun;
    const items = entry.item === 'review' && act.review ? Array.from({ length: n }, (_, i) => ({ ...(act.review!(rng, kid.band) as object), id: `${entry.id}-${round}-${i}` })) : [entry.item as object];
    return { id: `pg-${entry.id}`, activity: entry.activity, order: 'fixed', items };
  }, [kid.id, kid.band, entry, act, round]);

  if (entry.friend && !friend)
    return (
      <div className="k-screen k-center">
        <div className="k-card k-place-card">
          <h1 className="k-title">Who is playing with you?</h1>
          <div className="k-avatar-grid small">
            {kids.map((k) => (
              <button key={k.id} type="button" className="k-avatar-tile" onClick={() => setFriend({ kidId: k.id })}>
                <PawnBuddy color={k.avatar.color} face={k.avatar.face} hat={k.avatar.hat} size={64} />
                <span className="k-avatar-name">{k.name}</span>
              </button>
            ))}
            <button type="button" className="k-avatar-tile" onClick={() => setFriend({ kidId: null })}>
              <KidsIcon name="user" size={48} />
              <span className="k-avatar-name">Guest</span>
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <ActivityPlayer
      key={`${entry.id}-${round}`}
      mode="playground"
      kid={kid}
      set={set}
      title={bandText(entry.title, kid.band)}
      opponent={entry.friend ? { kind: 'friend', kidId: friend?.kidId ?? null } : { kind: 'bot' }}
      onAgain={() => setRound((r) => r + 1)}
      onExit={() => go.playground()}
    />
  );
}
