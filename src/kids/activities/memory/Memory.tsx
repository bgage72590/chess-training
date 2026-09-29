// Magic Memory: look at a position, then a magic cloak sweeps it away. Rebuild it with the piece
// tray, or (what-moved) spot the one piece that moved. Scored on first-try placements.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityProps, ArtKey, PieceCode, Placement, Sq, SquareTone, TrayButton } from '../types';
import { KidsBoard } from '../../player/KidsBoard';
import { placementFen } from '../../lib/fen';
import { applyMove } from '../../lib/miniRules';
import { kidSound } from '../../lib/kidsSound';
import { pieceTrayButtons } from '../boardVision/pieceTray';
import { PIECE_NAME } from '../boardVision/logic';
import { useBadFlash } from '../boardVision/useBadFlash';
import { memoryScore, movedScore, type MemoryItem } from './logic';
import '../boardVision/boardVision.css';

type Phase = 'look' | 'cloak' | 'play';

/** The tray while the pieces are covered: the same buttons, blank, so the board does not jump when they appear. */
const covered = (pieces: Placement): TrayButton[] => pieceTrayButtons(pieces, null, () => {}).map((b) => ({ id: b.id, label: '', icon: 'eye', variant: 'plain', disabled: true, onPress: () => {} }));

export function Memory({ item, player, onDone }: ActivityProps<MemoryItem>) {
  const [phase, setPhase] = useState<Phase>('look');
  const [secsLeft, setSecsLeft] = useState(Math.ceil(item.showMs / 1000));
  const [placed, setPlaced] = useState<Placement>({});
  const [sel, setSel] = useState<PieceCode | null>(null);
  const [misses, setMisses] = useState(0);
  const [wobble, setWobble] = useState<Sq | null>(null);
  const [tones, setTones] = useState<Partial<Record<Sq, SquareTone>>>({});
  const [done, setDone] = useState(false);
  const [badTone, flashBad] = useBadFlash();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const total = Object.keys(item.pieces).length;
  const after = useMemo(() => (item.mode === 'what-moved' ? applyMove(item.pieces, item.move[0], item.move[1]) : item.pieces), [item]);

  // Look, then the cloak sweeps, then play.
  useEffect(() => {
    player.say(item.mode === 'rebuild' ? 'Look closely! Remember every piece.' : 'Look closely! One piece is going to move.', 'think');
    const iv = setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    later(() => {
      clearInterval(iv);
      setPhase('cloak');
      player.sound('whoosh');
    }, item.showMs);
    later(() => {
      setPhase('play');
      player.say(item.mode === 'rebuild' ? 'Now build it again! Tap a piece, then its square.' : 'Which piece moved? Tap it!', 'idle');
    }, item.showMs + 700);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todo = useMemo(() => {
    const t: Placement = {};
    for (const [s, p] of Object.entries(item.pieces)) if (!placed[s]) t[s] = p;
    return t;
  }, [item.pieces, placed]);

  useEffect(() => {
    if (item.mode !== 'rebuild') return;
    player.setTray(phase === 'play' && !done ? pieceTrayButtons(todo, sel, setSel) : covered(item.pieces));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, todo, sel, done]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => player.setTray(null), []);

  useEffect(() => {
    if (item.mode === 'rebuild') {
      player.progress(Object.keys(placed).length, total);
      const first = Object.entries(todo)[0];
      player.setHints([
        { say: 'Try to picture the board. Which pieces did you see?' },
        first ? { say: `The ${PIECE_NAME[first[1]!.toUpperCase()]} was here!`, art: { [first[0]]: `ghost:${first[1]}` as ArtKey } } : {},
        { say: 'Here are some of them.', art: Object.fromEntries(Object.entries(todo).slice(0, Math.ceil(Object.keys(todo).length / 2)).map(([s, p]) => [s, `ghost:${p}` as ArtKey])) },
        { say: 'Here they all were!', art: Object.fromEntries(Object.entries(todo).map(([s, p]) => [s, `ghost:${p}` as ArtKey])) },
      ]);
    } else {
      const [from, to] = item.move;
      player.setHints([
        { say: 'Look for a piece on a new square.' },
        { say: 'Look around here!', tones: { [to]: 'hint' } },
        { say: 'It came from here!', art: { [from]: `ghost:${item.pieces[from]}` as ArtKey } },
        { say: 'It jumped like this!', arrows: [{ from, to, color: 'green' }] },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todo]);

  const finish = (base: 1 | 2 | 3, m: number) => {
    setDone(true);
    player.celebrate('small');
    const hl = player.hintLevel;
    const score = Math.min(base, hl >= 3 ? 1 : hl === 2 ? 2 : 3) as 1 | 2 | 3;
    player.best(`memory-${item.mode}`, score, 'higher');
    later(() => onDone({ score, mistakes: m, hintLevel: hl, golden: score === 3 && hl === 0 }), 1000);
  };

  const onTap = (sq: Sq) => {
    if (phase !== 'play' || done) return;
    if (item.mode === 'what-moved') {
      if (sq === item.move[1]) {
        setTones({ [sq]: 'good' });
        kidSound('pop', 3);
        player.say(`Yes! The ${PIECE_NAME[after[sq]!.toUpperCase()]} moved!`, 'cheer');
        finish(movedScore(misses), misses);
      } else if (after[sq]) {
        setMisses((m) => m + 1);
        flashBad(sq);
        player.mistake('That one stayed still. Look again!');
      } else player.say('Tap a piece!', 'idle'); // an empty square is not an answer
      return;
    }
    if (placed[sq]) return;
    if (!sel) {
      player.say('Tap a piece in the tray first!', 'idle');
      return;
    }
    if (todo[sq] === sel) {
      const np = { ...placed, [sq]: sel };
      setPlaced(np);
      kidSound('pop', Object.keys(np).length);
      if (!Object.entries(todo).some(([s, p]) => s !== sq && p === sel)) setSel(null);
      if (Object.keys(np).length === total) finish(memoryScore(total, Math.max(0, total - misses)), misses);
      return;
    }
    setMisses((m) => m + 1);
    setWobble(null);
    requestAnimationFrame(() => setWobble(sq));
    player.mistake('Hmm, not there. Try another square!');
  };

  const fen = phase === 'look' ? placementFen(item.pieces) : phase === 'cloak' ? placementFen({}) : placementFen(item.mode === 'rebuild' ? placed : after);

  return (
    <div className="k-bv">
      <KidsBoard fen={fen} interactive={false} onSquareClick={onTap} wobble={wobble} tones={{ ...tones, ...badTone }} hint={phase === 'play' ? player.hint : null} label={phase === 'play' ? 'Magic Memory board' : 'Remember this board'} />
      {phase === 'look' && (
        <span className="k-bv-timer" role="timer">
          {secsLeft}s
        </span>
      )}
      {phase === 'cloak' && <span className="k-mm-cloak" aria-hidden="true" />}
    </div>
  );
}
