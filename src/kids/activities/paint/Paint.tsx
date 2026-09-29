// Paint the Moves: tap every square the piece could move to. Correct taps drop a paint splat and a
// rising note; wrong taps wobble the piece and count as a mistake. Sprouts first watch the piece glide.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityProps, ArtKey, HintStep, Sq } from '../types';
import { standardScore } from '../types';
import { KidsBoard } from '../../player/KidsBoard';
import { useKidCtx } from '../../player/context';
import { placementFen } from '../../lib/fen';
import { applyMove } from '../../lib/miniRules';
import { kidSound } from '../../lib/kidsSound';
import { plural } from '../../lib/plural';
import { mirrorPaint, paintBoard, paintPiece, paintTargets, type PaintItem } from './logic';
import { useBadFlash } from '../boardVision/useBadFlash';
import { PIECE_NAME } from '../boardVision/logic';
import '../boardVision/boardVision.css';

export function Paint({ item: authored, player, onDone, band }: ActivityProps<PaintItem>) {
  const { reducedMotion } = useKidCtx();
  // Half the runs see the board reflected left to right, so a replay is not the same picture.
  const [mirrored] = useState(() => !authored.noMirror && player.rng() < 0.5);
  const item = useMemo(() => (mirrored ? mirrorPaint(authored) : authored), [mirrored, authored]);
  const [from, piece] = paintPiece(item) ?? ['a1', 'R'];
  const name = PIECE_NAME[piece.toUpperCase()];
  const targets = useMemo(() => paintTargets(item), [item]);
  const base = useMemo(() => paintBoard(item), [item]);
  const [painted, setPainted] = useState<Sq[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [wobble, setWobble] = useState<Sq | null>(null);
  const [demoAt, setDemoAt] = useState<Sq | null>(null);
  const [demoing, setDemoing] = useState(band === 'sprout' && !reducedMotion);
  const [done, setDone] = useState(false);
  const [badTone, flashBad] = useBadFlash();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Sprouts watch the piece glide to each square first. A tap on the board, or the hint bulb, ends the show early.
  const stopDemo = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setDemoAt(null);
    setDemoing(false);
  };
  const endDemo = () => {
    stopDemo();
    player.say(`Your turn! Tap every square the ${name} can go.`, 'idle');
  };
  useEffect(() => {
    if (!demoing) return;
    targets.forEach((t, i) => later(() => setDemoAt(t), 500 * (i + 1)));
    later(endDemo, 500 * (targets.length + 1) + 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A hint asked for during the show is shown at once, not hidden behind it.
  useEffect(() => {
    if (demoing && player.hintLevel > 0) stopDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.hintLevel]);

  const left = targets.filter((t) => !painted.includes(t));
  useEffect(() => {
    player.progress(painted.length, targets.length);
    const next = left[0];
    const steps: HintStep[] = [
      { say: RULE[piece.toUpperCase()] ?? 'Tap where it can go.' },
      next ? { say: 'Look here!', tones: { [next]: 'hint' } } : {},
      next ? { say: 'Follow the arrow!', arrows: [{ from, to: next, color: 'green' }] } : {},
      { say: 'Here they all are!', art: Object.fromEntries(left.map((s) => [s, 'dot' as ArtKey])) },
    ];
    player.setHints(steps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [painted.length]);

  const onTap = (sq: Sq) => {
    if (demoing) return endDemo();
    if (done || sq === from || painted.includes(sq)) return;
    if (targets.includes(sq)) {
      const got = [...painted, sq];
      setPainted(got);
      kidSound('pop', got.length);
      if (got.length === targets.length) {
        setDone(true);
        player.celebrate('small');
        if (got.length <= 3 && targets.length <= 3) player.say(`Only ${targets.length}! You found them all!`, 'cheer');
        const hl = player.hintLevel;
        later(() => onDone({ score: standardScore(mistakes, hl), mistakes, hintLevel: hl, golden: mistakes === 0 && hl === 0 }), 1000);
      }
      return;
    }
    setMistakes((m) => m + 1);
    flashBad(sq);
    setWobble(null);
    requestAnimationFrame(() => setWobble(from));
    player.mistake(`The ${name} can't go there.`);
  };

  const art: Partial<Record<Sq, ArtKey>> = {};
  painted.forEach((s, i) => (art[s] = `splat:${(i % 6) as 0 | 1 | 2 | 3 | 4 | 5}`));
  const shown = demoAt ? applyMove(base, from, demoAt) : base;

  return (
    <div className="k-bv" data-mirrored={mirrored ? 1 : undefined}>
      <KidsBoard
        fen={placementFen(shown)}
        interactive={false}
        onSquareClick={onTap}
        art={art}
        wobble={wobble}
        tones={badTone}
        lastMove={demoAt ? [from, demoAt] : null}
        hint={demoing ? null : player.hint}
        label={`Paint board: ${plural(left.length, 'square')} left for the ${name}`}
      />
      <span className="k-bv-count" aria-live="polite">
        {painted.length}/{targets.length}
      </span>
    </div>
  );
}

const RULE: Record<string, string> = {
  R: 'Rooks go in straight lines, until something is in the way.',
  B: 'Bishops slide on slanty lines.',
  Q: 'The queen goes straight or slanty.',
  K: 'The king takes one step, any way.',
  N: 'Knights hop: two steps and a turn!',
  P: 'Pawns walk straight, but eat slanty!',
};
