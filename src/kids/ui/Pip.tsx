// Pip, the knight-pony guide: a round head and neck in profile, facing right. Inline SVG; the moods
// are CSS animations (all removed or reduced under reduced motion). The coach's Pip also `listen`s
// for pipReact() events: a hop, a sympathetic head tilt, or a look toward a hinted square.
import { useEffect, useMemo, useRef, useState } from 'react';
import { lookVector, onPipReact, type PipReactEvent } from './pipEvents';
import { centerOf, flyStar, motionReduced } from './rewardFx';

export type PipMood = 'idle' | 'talk' | 'cheer' | 'think' | 'oops' | 'sleepy' | 'wow';

const INK = '#1f2a44';
const REACT_MS = { cheer: 760, oops: 1100, wow: 900, point: 1500 };

/** The one-shot body motion for an event (the CSS breathing and blinking carry on underneath). */
function reactFrames(e: PipReactEvent, look: ReturnType<typeof lookVector>): Keyframe[] {
  switch (e.kind) {
    case 'cheer':
      return [
        { transform: 'none' },
        { transform: 'translateY(5px) scale(1.06, 0.92)', offset: 0.16 },
        { transform: 'translateY(-22px) scale(0.95, 1.06) rotate(-5deg)', offset: 0.48 },
        { transform: 'translateY(0) scale(1.07, 0.92) rotate(2deg)', offset: 0.74 },
        { transform: 'translateY(-5px) scale(1)', offset: 0.88 },
        { transform: 'none' },
      ];
    case 'wow':
      return [{ transform: 'none' }, { transform: 'translateY(-7px) scale(1.07) rotate(-5deg)', offset: 0.3 }, { transform: 'translateY(-4px) scale(1.05) rotate(-4deg)', offset: 0.7 }, { transform: 'none' }];
    case 'oops':
      // Head tilts back like "hmm?", holds, and eases home. Never a slump.
      return [{ transform: 'none' }, { transform: 'rotate(-10deg)', offset: 0.22 }, { transform: 'rotate(-9deg) translateX(-1px)', offset: 0.55 }, { transform: 'rotate(-10deg)', offset: 0.72 }, { transform: 'none' }];
    case 'point': {
      const f = look.flip ? 'scale(-1, 1) ' : '';
      return [
        { transform: `${f}none` },
        { transform: `${f}rotate(${look.lean}deg)`, offset: 0.16 },
        { transform: `${f}rotate(${look.lean + 3}deg)`, offset: 0.4 },
        { transform: `${f}rotate(${look.lean - 2}deg)`, offset: 0.56 },
        { transform: `${f}rotate(${look.lean}deg)`, offset: 0.85 },
        { transform: `${f}none` },
      ];
    }
  }
}

export function Pip({
  mood = 'idle',
  size = 80,
  hat,
  hatDrop,
  className,
  listen,
  talkWord,
}: {
  mood?: PipMood;
  size?: 64 | 72 | 80 | 96 | 120 | 160 | number;
  hat?: 'crown' | 'party' | null;
  /** The hat drops on with a bounce. */
  hatDrop?: boolean;
  className?: string;
  /** Play pipReact() events (only the coach's Pip does). */
  listen?: boolean;
  /** Talking in step with speech: the caption word being spoken (-1 between words). Mouth opens on each new word. */
  talkWord?: number;
}) {
  // Blink every 4-6 s and glance around every 8-13 s (random per mount), so two Pips never move in sync.
  const blink = useMemo(() => `${(4 + Math.random() * 2).toFixed(2)}s`, []);
  const glance = useMemo(() => ({ ['--glance' as string]: `${(8 + Math.random() * 5).toFixed(1)}s`, ['--glance-d' as string]: `-${(Math.random() * 8).toFixed(1)}s` }), []);
  const root = useRef<HTMLSpanElement>(null);
  const body = useRef<SVGGElement>(null);
  const [fx, setFx] = useState<{ kind: 'cheer' | 'oops' | 'wow'; n: number } | null>(null);
  useEffect(() => {
    if (!listen) return;
    let off = 0;
    let wait: ReturnType<typeof setTimeout> | undefined;
    let tail: ReturnType<typeof setTimeout> | undefined;
    const play = (e: PipReactEvent) => {
      const el = body.current;
      const host = root.current;
      if (!el || !host) return;
      const still = motionReduced();
      const r = host.getBoundingClientRect();
      let look = lookVector(1, 0);
      if (e.kind === 'point') {
        // Toward the hinted square, or the middle of the board when the hint names none.
        const target = (e.square && document.querySelector(`.kids-board [data-square="${e.square}"]`)) || document.querySelector('.kids-board');
        if (target) {
          const c = centerOf(target);
          look = lookVector(c.x - (r.left + r.width / 2), c.y - (r.top + r.height / 2));
          host.style.setProperty('--lx', look.lx.toFixed(2));
          host.style.setProperty('--ly', look.ly.toFixed(2));
          host.dataset.look = '1';
          if (e.square && !still) flyStar({ x: r.left + r.width * 0.85, y: r.top + r.height * 0.42 }, c, { size: 24, ms: 650, spark: true });
        }
      } else setFx({ kind: e.kind, n: e.at });
      if (!still) el.animate(reactFrames(e, look), { duration: REACT_MS[e.kind], easing: 'ease-in-out' });
      off = performance.now() + REACT_MS[e.kind];
      clearTimeout(tail);
      tail = setTimeout(() => {
        setFx(null);
        host.style.removeProperty('--lx');
        host.style.removeProperty('--ly');
        delete host.dataset.look;
      }, REACT_MS[e.kind]);
    };
    const un = onPipReact((e) => {
      clearTimeout(wait);
      // A look toward a hint waits for a hop or a tilt that is still playing.
      const left = off - performance.now();
      if (e.kind === 'point' && left > 0) wait = setTimeout(() => play(e), left + 50);
      else play(e);
    });
    return () => {
      un();
      clearTimeout(wait);
      clearTimeout(tail);
    };
  }, [listen]);
  // Pip's face follows what the app says (mood); an event only sets it when the app left him idle.
  const m: PipMood = mood === 'idle' && fx ? fx.kind : mood;
  const synced = m === 'talk' && talkWord !== undefined;
  return (
    <span ref={root} className={`k-pip mood-${m}${listen ? ' listen' : ''}${synced ? ' sync' : ''}${synced && talkWord < 0 ? ' talk-gap' : ''} ${className ?? ''}`} style={{ width: size, height: size, ...glance }} aria-hidden="true">
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <g className="k-pip-body" ref={body}>
          {/* mane, behind the head */}
          <path
            d="M47 26c-11-2-19 6-16 15-9 3-11 13-5 19-8 5-7 16 0 20-6 6-3 16 4 18-3 7 0 14 5 18h10l2-54c1-14 4-24 8-31z"
            fill="#ffc83d"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M38 44c-4 3-5 8-2 12M33 66c-3 3-3 8 0 11M34 88c-2 3-1 7 2 9" fill="none" stroke="#e0a100" strokeWidth="3" strokeLinecap="round" />
          {/* ear */}
          <path d="M52 31 49 9l16 17z" fill="#fff3d6" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M53 25 52 15l7 8z" fill="#ffb9a3" />
          {/* head and neck */}
          <path
            d="M36 116c-1-20 1-38 5-54 4-22 11-38 27-41 14-3 26 12 34 25 6 9 9 16 7 23-2 8-10 12-20 12-7 0-13-1-19-2 1 11 5 25 12 37z"
            fill="#fff3d6"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* shade on the neck */}
          <path d="M49 86c0 10 2 20 6 29h-8c-2-9-2-19 2-29z" fill="#f3dfb5" />
          {/* forelock */}
          <path d="M55 27c1-10 10-15 18-10-6 0-11 4-13 11z" fill="#ffc83d" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          {/* snout patch */}
          <path d="M92 52c7 1 14 7 15 14 0 7-6 11-14 11-5 0-9-3-10-8" fill="#ffe7bd" />
          {/* cheek */}
          <circle cx="76" cy="62" r="7.5" fill="#ff9f7f" opacity="0.45" />
          {/* nostril */}
          <ellipse cx="101" cy="61" rx="2.2" ry="2.8" fill={INK} />
          {/* eye */}
          <g className="k-pip-eye" style={{ animationDuration: blink }}>
            <ellipse className="k-pip-pupil" cx="73" cy="43" rx="7" ry="8" fill={INK} />
            <circle className="k-pip-shine" cx="75.5" cy="39.5" r="2.6" fill="#fff" />
          </g>
          <path className="k-pip-lid" d="M65 42c2-6 13-7 16 0" fill="#fff3d6" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          {/* mouth: closed smile and open (talk) */}
          <path key={`c${talkWord}`} className="k-pip-mouth" d="M86 72c4 4 10 4 14-1" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path key={`o${talkWord}`} className="k-pip-mouth-open" d="M86 71c3 7 12 7 15 0z" fill="#c2477f" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          {hat === 'crown' && <path className={hatDrop ? 'k-hat-drop' : undefined} d="M46 20l4-14 8 8 7-11 5 12 8-5-3 14c-9 3-20 3-29-4z" fill="#ffc83d" stroke={INK} strokeWidth="3" strokeLinejoin="round" />}
          {hat === 'party' && <path className={hatDrop ? 'k-hat-drop' : undefined} d="M50 22 62 -2l9 20c-6 5-15 7-21 4z" fill="#c9b3ff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />}
        </g>
        {/* think bubble and sleepy z's */}
        <g className="k-pip-think">
          <circle cx="96" cy="18" r="4" />
          <circle cx="106" cy="18" r="4" />
          <circle cx="116" cy="18" r="4" />
        </g>
        <g className="k-pip-z" fill={INK} fontFamily="var(--k-font-display)" fontWeight="700">
          <text x="92" y="30" fontSize="16">
            z
          </text>
          <text x="104" y="16" fontSize="12">
            z
          </text>
        </g>
      </svg>
      {m === 'cheer' && (
        <span className="k-pip-sparkles" key={fx?.n ?? 0}>
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} style={{ ['--i' as string]: i }} />
          ))}
        </span>
      )}
    </span>
  );
}
