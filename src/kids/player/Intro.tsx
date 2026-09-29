// "Watch Pip": a short scripted demo before a node's first item, and the Piece Parade picture quiz.
import { useEffect, useRef, useState } from 'react';
import type { AgeBand, IntroStep, PieceCode, Placement } from '../activities/types';
import { bandText } from '../activities/types';
import { placementFen, fenPlacement } from '../lib/fen';
import { applyMove } from '../lib/miniRules';
import { KidsBoard } from './KidsBoard';
import { BigButton } from '../ui/BigButton';
import { kidSound } from '../lib/kidsSound';

const wordsOf = (t: string) => t.split(/\s+/).filter(Boolean).length;

export function Intro({ steps, band, rate, onSay, onDone }: { steps: IntroStep[]; band: AgeBand; rate: number; onSay(text: string): void; onDone(): void }) {
  const [i, setI] = useState(0);
  const [pos, setPos] = useState<Placement>(() => placementOf(steps[0]) ?? {});
  const [last, setLast] = useState<[string, string] | null>(null);
  const [moved, setMoved] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stepStart = useRef(0);
  const movedRef = useRef(false);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const step = steps[i];
    if (!step) {
      finish();
      return;
    }
    const text = bandText(step.say, band);
    onSay(text);
    const p = placementOf(step);
    if (p) setPos(p);
    setLast(null);
    setMoved(false);
    movedRef.current = false;
    stepStart.current = Date.now();
    const speakMs = Math.max(1100, (wordsOf(text) * 1000) / (2.4 * rate));
    const t: ReturnType<typeof setTimeout>[] = [];
    let at = speakMs;
    if (step.move) {
      t.push(setTimeout(() => doMove(step), at));
      at += 900;
    }
    at += step.ms ?? 1800;
    t.push(setTimeout(() => setI((x) => x + 1), at));
    timers.current.push(...t);
    stepTimers.current = t;
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  function doMove(st: IntroStep) {
    if (!st.move || movedRef.current) return;
    const [a, b] = st.move;
    movedRef.current = true;
    setPos((cur) => applyIntroMove(cur, a, b));
    setLast([a, b]);
    setMoved(true);
    kidSound('move');
    if (st.art?.[b] === 'star') setTimeout(() => kidSound('pop'), 180);
  }

  // Eager little fingers: a tap on the board speeds Pip up. It plays the step's move right away,
  // or goes on to the next step (after the last one, straight to "Your turn!").
  const tapAhead = () => {
    const st = steps[i];
    if (!st || done.current || Date.now() - stepStart.current < 500) return;
    stepTimers.current.forEach(clearTimeout);
    if (st.move && !movedRef.current) {
      doMove(st);
      const t = setTimeout(() => setI((x) => x + 1), 1100);
      stepTimers.current = [t];
      timers.current.push(t);
    } else setI((x) => x + 1);
  };

  const step = steps[Math.min(i, steps.length - 1)];
  const art = { ...(step?.art ?? {}) };
  if (moved && step?.move) delete art[step.move[1]];
  return (
    <div className="k-intro" onPointerUp={tapAhead}>
      <KidsBoard fen={placementFen(pos)} interactive={false} art={art} arrows={step?.arrows} tones={step?.tones} lastMove={last} label="Pip shows how it works" />
      <div className="k-intro-skip">
        <BigButton variant="plain" size="small" icon="next" onClick={finish} onPointerUp={(e: React.PointerEvent) => e.stopPropagation()}>
          Skip
        </BigButton>
      </div>
    </div>
  );
}

/** A demo move. Castling brings the rook along, so the picture matches "the rook hops over him". */
export function applyIntroMove(p: Placement, a: string, b: string): Placement {
  const next = applyMove(p, a, b);
  const step = b.charCodeAt(0) - a.charCodeAt(0);
  if (p[a]?.toUpperCase() === 'K' && Math.abs(step) === 2) {
    const from = (step > 0 ? 'h' : 'a') + a[1];
    const to = (step > 0 ? 'f' : 'd') + a[1];
    if (next[from]?.toUpperCase() === 'R') {
      next[to] = next[from];
      delete next[from];
    }
  }
  return next;
}

function placementOf(step: IntroStep | undefined): Placement | null {
  if (!step) return null;
  if (step.fen) return fenPlacement(step.fen);
  if (step.pieces) return step.pieces;
  return null;
}

const NAME: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };

/** Piece Parade: "Which one is the bishop?" with three real piece pictures. Unscored. */
export function PiecePick({ pick, band, onSay, onDone }: { pick: { answer: PieceCode; options: PieceCode[] }; band: AgeBand; onSay(text: string, mood?: 'cheer' | 'oops'): void; onDone(): void }) {
  const [wrong, setWrong] = useState<PieceCode | null>(null);
  const [right, setRight] = useState(false);
  // Leaving during the 1.5 s pause must not start the next item behind the kid's back.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    onSay(`Which one is the ${NAME[pick.answer.toUpperCase()]}?`);
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={`k-parade ${band}`}>
      <div className="k-parade-row">
        {pick.options.map((p) => (
          <button
            key={p}
            type="button"
            className={`k-parade-btn${wrong === p ? ' k-wobble-self' : ''}${right && p === pick.answer ? ' right' : ''}`}
            aria-label={NAME[p.toUpperCase()]}
            onClick={() => {
              if (right) return;
              if (p === pick.answer) {
                setRight(true);
                kidSound('pop', 3);
                onSay(`Yes! That's the ${NAME[p.toUpperCase()]}!`, 'cheer');
                timers.current.push(setTimeout(onDone, 1500));
              } else {
                setWrong(p);
                kidSound('boop');
                onSay(`That's the ${NAME[p.toUpperCase()]}! Find the ${NAME[pick.answer.toUpperCase()]}.`, 'oops');
                timers.current.push(setTimeout(() => setWrong(null), 400));
              }
            }}
          >
            <span className={`k-parade-piece pc-w${p.toUpperCase()}`} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
