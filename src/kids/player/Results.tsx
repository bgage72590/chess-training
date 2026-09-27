// The results card: a drumroll, stars filling one by one, Pip cheering, a sticker peel-in on first
// completion and a one-line recap. Boss passes drop a crown and open the next rank. Nothing
// auto-advances: the kid always chooses Next, Again or Map.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AgeBand } from '../activities/types';
import { Pip } from '../ui/Pip';
import { StarShape } from '../ui/StarRow';
import { BigButton } from '../ui/BigButton';
import { Confetti } from '../ui/Confetti';
import { StickerArt } from '../ui/StickerSlot';
import { KidsIcon } from '../ui/KidsIcon';
import { stickerDef, TROPHY_BY_ID } from '../curriculum/stickers';
import { HAT_BY_ID, type HatId } from '../curriculum/wardrobe';
import { kidSound } from '../lib/kidsSound';

export interface ResultsProps {
  band: AgeBand;
  title: string;
  stars: number; // this run's score (1-3); 0 = no stars shown (warm-up)
  golden?: boolean;
  recap: string;
  stickers: string[];
  trophies: string[];
  hats: HatId[];
  bossPassed?: boolean;
  openedRank?: { rank: number; title: string } | null;
  crown?: 'gold' | 'silver' | null;
  extra?: ReactNode;
  onNext?: () => void;
  nextLabel?: string;
  onAgain?: () => void;
  onMap: () => void;
  mapLabel?: string;
  onSpeak?: (text: string) => void;
}

export function Results(p: ResultsProps) {
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<'drum' | 'stars' | 'done'>(p.stars ? 'drum' : 'done');
  const [confetti, setConfetti] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    if (p.stars) {
      t.push(setTimeout(() => setPhase('stars'), 600));
      for (let i = 0; i < p.stars; i++)
        t.push(
          setTimeout(() => {
            setShown(i + 1);
            kidSound('pop', i * 2);
          }, 600 + 250 * (i + 1)),
        );
      t.push(setTimeout(() => setPhase('done'), 600 + 250 * (p.stars + 1)));
    }
    const end = p.stars ? 600 + 250 * (p.stars + 1) : 100;
    t.push(
      setTimeout(() => {
        if (p.bossPassed) {
          kidSound('crown');
          setConfetti(Date.now());
        } else kidSound('fanfare');
        if (p.stickers.length) setTimeout(() => kidSound('chime'), 400);
        p.onSpeak?.(p.recap);
      }, end),
    );
    nextRef.current?.focus();
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stickers = p.stickers.map((id) => stickerDef(id)).filter((d): d is NonNullable<typeof d> => !!d);
  return (
    <div className="k-overlay k-results-wrap" role="dialog" aria-label="Results">
      <Confetti run={confetti} />
      <div className={`k-card k-results${p.bossPassed ? ' boss' : ''}`}>
        {p.bossPassed && (
          <div className="k-crown-drop" aria-hidden="true">
            <KidsIcon name="crown" size={64} fill />
          </div>
        )}
        <div className="k-results-pip">
          <Pip mood={phase === 'done' ? 'cheer' : 'think'} size={96} />
        </div>
        <h2 className="k-results-title">{p.title}</h2>
        {p.stars > 0 && (
          <div className="k-results-stars" role="img" aria-label={`${p.stars} stars`}>
            {[0, 1, 2].map((i) => (
              <StarShape key={i} filled={i < shown} size={p.band === 'sprout' ? 64 : 56} golden={p.golden && i === 2 && shown === 3} className={i < shown ? 'k-star-in' : ''} />
            ))}
          </div>
        )}
        <p className="k-results-recap">{p.recap}</p>
        {p.openedRank && (
          <p className="k-results-open">
            <KidsIcon name="lock" size={24} /> Rank {p.openedRank.rank} is open: {p.openedRank.title}!
          </p>
        )}
        {(stickers.length > 0 || p.trophies.length > 0 || p.hats.length > 0) && (
          <div className="k-results-gifts">
            {stickers.map((s) => (
              <div key={s.id} className="k-peel">
                <StickerArt def={s} size={72} />
                <span>New sticker!</span>
              </div>
            ))}
            {p.trophies.map((id) => (
              <div key={id} className="k-peel">
                <span className="k-trophy-mini" style={{ ['--sc' as string]: TROPHY_BY_ID.get(id)?.color }}>
                  <KidsIcon name={TROPHY_BY_ID.get(id)?.icon ?? 'trophy'} size={34} />
                </span>
                <span>{TROPHY_BY_ID.get(id)?.title}</span>
              </div>
            ))}
            {p.hats.map((h) => (
              <div key={h} className="k-peel">
                <span className="k-trophy-mini" style={{ ['--sc' as string]: '#c9b3ff' }}>
                  <KidsIcon name="gift" size={34} />
                </span>
                <span>New: {HAT_BY_ID.get(h)?.label}!</span>
              </div>
            ))}
          </div>
        )}
        {p.extra}
        <div className="k-results-actions">
          {p.onNext && (
            <BigButton ref={nextRef} variant="primary" icon="next" onClick={p.onNext} whoosh>
              {p.nextLabel ?? 'Next'}
            </BigButton>
          )}
          {p.onAgain && (
            <BigButton variant="plain" icon="again" onClick={p.onAgain}>
              Again
            </BigButton>
          )}
          <BigButton variant="plain" icon="map" onClick={p.onMap}>
            {p.mapLabel ?? 'Map'}
          </BigButton>
        </div>
      </div>
    </div>
  );
}
