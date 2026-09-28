// The results card, revealed in stages: the title, a drumroll, each star flying from Pip into its
// slot (pop and sound as it lands), Pip cheering, a sticker or badge stamped on, the recap, then the
// buttons rise in. Boss passes drop a crown onto Pip's head. Nothing auto-advances: the kid always
// chooses Next, Again or Map.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AgeBand } from '../activities/types';
import { Pip } from '../ui/Pip';
import { StarBurst, StarShape } from '../ui/StarRow';
import { BigButton } from '../ui/BigButton';
import { Confetti } from '../ui/Confetti';
import { StickerArt } from '../ui/StickerSlot';
import { KidsIcon } from '../ui/KidsIcon';
import { stickerDef, TROPHY_BY_ID } from '../curriculum/stickers';
import { HAT_BY_ID, type HatId } from '../curriculum/wardrobe';
import { kidSound } from '../lib/kidsSound';
import { centerOf, flyStar } from '../ui/rewardFx';

// Reveal timing (ms): the drumroll, the gap between stars, a star's flight, the crown's fall.
const DRUM = 650;
const GAP = 300;
const FLY = 500;
const CROWN = 440;

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
  /** A boss below the pass mark: the stars that open the next rank. */
  need?: { stars: number; rank: number } | null;
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
  const [landed, setLanded] = useState(false); // the boss crown has landed on Pip
  const nextRef = useRef<HTMLButtonElement>(null);
  const pipRef = useRef<HTMLDivElement>(null);
  const slots = useRef<(HTMLSpanElement | null)[]>([]);
  const stampAt = p.bossPassed ? 900 : 300; // stickers stamp on after the crown

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    const flights: (() => void)[] = [];
    const at = (ms: number, f: () => void) => t.push(setTimeout(f, ms));
    let end = 100;
    if (p.stars) {
      at(DRUM, () => setPhase('stars'));
      for (let i = 0; i < p.stars; i++)
        at(DRUM + GAP * i, () => {
          const land = () => {
            setShown(i + 1);
            kidSound('pop', i * 2);
          };
          const pip = pipRef.current;
          const slot = slots.current[i];
          if (pip && slot) flights.push(flyStar(centerOf(pip), slot, { size: p.band === 'sprout' ? 64 : 56, ms: FLY, onLand: land }));
          else land();
        });
      end = DRUM + GAP * (p.stars - 1) + FLY + 120;
      at(end, () => setPhase('done'));
    }
    at(end, () => {
      if (p.bossPassed)
        at(CROWN, () => {
          kidSound('crown');
          setLanded(true);
          setConfetti(Date.now());
        });
      else kidSound('fanfare');
      if (p.stickers.length) at(stampAt + 320, () => kidSound('chime'));
      p.onSpeak?.(p.recap);
    });
    nextRef.current?.focus();
    return () => {
      t.forEach(clearTimeout);
      flights.forEach((cancel) => cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stickers = p.stickers.map((id) => stickerDef(id)).filter((d): d is NonNullable<typeof d> => !!d);
  const done = phase === 'done';
  const starSize = p.band === 'sprout' ? 64 : 56;
  return (
    <div className="k-overlay k-results-wrap" role="dialog" aria-label="Results">
      <Confetti run={confetti} />
      <div className={`k-card k-results${p.bossPassed ? ' boss' : ''}${done ? ' done' : ''}${landed ? ' thump' : ''}${p.stars ? '' : ' quick'}`}>
        <div className="k-results-pip" ref={pipRef}>
          {p.bossPassed && done && <span className="k-rays" aria-hidden="true" />}
          <Pip mood={done ? (p.bossPassed && !landed ? 'wow' : 'cheer') : 'think'} size={96} hat={p.bossPassed && done ? 'crown' : null} hatDrop />
          {landed && (
            <span className="k-crown-ring" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} style={{ ['--i' as string]: i }} />
              ))}
            </span>
          )}
        </div>
        <h2 className="k-results-title">{p.title}</h2>
        {p.stars > 0 && (
          <div className="k-results-stars" role="img" aria-label={`${p.stars} stars`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className="k-star-slot" ref={(el) => void (slots.current[i] = el)}>
                <StarShape filled={i < shown} size={starSize} golden={p.golden && i === 2 && shown === 3} className={i < shown ? 'k-star-in' : ''} />
                {i < shown && <StarBurst golden={p.golden && i === 2} />}
              </span>
            ))}
          </div>
        )}
        {/* The recap lands after the stars fill, so the reveal reads in order. */}
        <p className={`k-results-recap${done ? ' in' : ' wait'}`} aria-live="polite">
          {p.recap}
        </p>
        {p.need && (
          <p className={`k-results-need${done ? ' in' : ' wait'}`} aria-label={`Get ${p.need.stars} stars to open Rank ${p.need.rank}`}>
            {Array.from({ length: p.need.stars }, (_, i) => (
              <StarShape key={i} filled={i < p.stars} size={26} />
            ))}
            <KidsIcon name="lock" size={22} /> opens Rank {p.need.rank}
          </p>
        )}
        {p.openedRank && (
          <p className={`k-results-open${done ? ' in' : ' wait'}`}>
            <KidsIcon name="unlock" size={24} /> Rank {p.openedRank.rank} is open: {p.openedRank.title}!
          </p>
        )}
        {(stickers.length > 0 || p.trophies.length > 0 || p.hats.length > 0) && (
          <div className={`k-results-gifts${done ? ' in' : ' wait'}`} style={{ ['--stamp-d' as string]: `${stampAt}ms` }}>
            {stickers.map((s, i) => (
              <div key={s.id} className="k-peel" style={{ ['--i' as string]: i }}>
                <span className="k-stamp">
                  <StickerArt def={s} size={72} />
                </span>
                <span>New sticker!</span>
              </div>
            ))}
            {p.trophies.map((id, i) => (
              <div key={id} className="k-peel" style={{ ['--i' as string]: stickers.length + i }}>
                <span className="k-stamp">
                  <span className="k-trophy-mini" style={{ ['--sc' as string]: TROPHY_BY_ID.get(id)?.color }}>
                    <KidsIcon name={TROPHY_BY_ID.get(id)?.icon ?? 'trophy'} size={34} />
                  </span>
                </span>
                <span>{TROPHY_BY_ID.get(id)?.title}</span>
              </div>
            ))}
            {p.hats.map((h, i) => (
              <div key={h} className="k-peel" style={{ ['--i' as string]: stickers.length + p.trophies.length + i }}>
                <span className="k-stamp">
                  <span className="k-trophy-mini" style={{ ['--sc' as string]: '#c9b3ff' }}>
                    <KidsIcon name="gift" size={34} />
                  </span>
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
