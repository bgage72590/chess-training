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
    const speakMs = Math.max(1100, (wordsOf(text) * 1000) / (2.4 * rate));
    const t: ReturnType<typeof setTimeout>[] = [];
    let at = speakMs;
    if (step.move) {
      const [a, b] = step.move;
      t.push(
        setTimeout(() => {
          setPos((cur) => applyMove(cur, a, b));
          setLast([a, b]);
          setMoved(true);
          kidSound('move');
          if (step.art?.[b] === 'star') setTimeout(() => kidSound('pop'), 180);
        }, at),
      );
      at += 900;
    }
    at += step.ms ?? 1800;
    t.push(setTimeout(() => setI((x) => x + 1), at));
    timers.current.push(...t);
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const step = steps[Math.min(i, steps.length - 1)];
  const art = { ...(step?.art ?? {}) };
  if (moved && step?.move) delete art[step.move[1]];
  return (
    <div className="k-intro">
      <KidsBoard fen={placementFen(pos)} interactive={false} art={art} arrows={step?.arrows} tones={step?.tones} lastMove={last} label="Pip shows how it works" />
      <div className="k-intro-skip">
        <BigButton variant="plain" size="small" icon="next" onClick={finish}>
          Skip
        </BigButton>
      </div>
    </div>
  );
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
  useEffect(() => {
    onSay(`Which one is the ${NAME[pick.answer.toUpperCase()]}?`);
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
                setTimeout(onDone, 1500);
              } else {
                setWrong(p);
                kidSound('boop');
                onSay(`That's the ${NAME[p.toUpperCase()]}! Find the ${NAME[pick.answer.toUpperCase()]}.`, 'oops');
                setTimeout(() => setWrong(null), 400);
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
