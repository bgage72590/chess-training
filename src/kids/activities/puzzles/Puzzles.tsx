// Puzzle Path (spec 13.13): hand puzzles (the framework FindMove, one after another), database
// puzzles (Tuck moves first, then the kid solves; 2 tries, then Watch Pip), the Champion Puzzle
// Streak and Puzzle of the Day.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Move } from 'chess.js';
import type { ActivityProps, HintStep, ItemMeta, ItemResult, PlayerApi, Sq, SquareTone } from '../types';
import { standardScore } from '../types';
import { FindMove } from '../findMove';
import { load, play, uciOf, type FindMoveItem } from '../findMove/logic';
import { KidsBoard, useBounce } from '../../player/KidsBoard';
import { dotsFor } from '../../lib/dots';
import { fenPlacement } from '../../lib/fen';
import { getKid, updateKid } from '../../store/kidsStore';
import type { Puzzle } from '../../../data/puzzles';
import { dbAccepts, isMatePuzzle, pzMoves, type PuzzleItem } from './logic';
import { pick } from './kidPuzzles';
import { dailyPuzzle, dayKey } from './daily';
import './puzzles.css';

const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const parse = (u: string) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function Puzzles(props: ActivityProps<PuzzleItem>) {
  const { item } = props;
  switch (item.source) {
    case 'hand':
      return <HandRun {...props} items={item.items} fork={item.tactic === 'fork'} />;
    case 'db':
      return <DbRun {...props} themes={item.themes} maxRating={item.maxRating} count={item.count} />;
    case 'streak':
      return <DbRun {...props} themes={[]} maxRating={3000} count={Infinity} streak />;
    case 'daily':
      return <DailyRun {...props} />;
  }
}

type RunProps = Omit<ActivityProps<PuzzleItem>, 'item'> & { item: ActivityProps<PuzzleItem>['item'] };

/** Combines several puzzle results into one item result. */
function combine(rs: ItemResult[]): ItemResult {
  if (rs.length === 1) return rs[0];
  const score = Math.max(1, Math.min(3, Math.round(mean(rs.map((r) => r.score))))) as 1 | 2 | 3;
  return { score, mistakes: rs.reduce((a, r) => a + r.mistakes, 0), hintLevel: Math.max(...rs.map((r) => r.hintLevel)) as ItemResult['hintLevel'] };
}

// ---------- hand: the framework FindMove, item by item ----------

function HandRun({ items, fork, player, onDone, band, kid, itemKey, item, onSolved }: RunProps & { items: (FindMoveItem & ItemMeta)[]; fork: boolean; onSolved?(): void }) {
  const [i, setI] = useState(0);
  const results = useRef<ItemResult[]>([]);
  const inner = items[i];
  useEffect(() => {
    if (items.length > 1) player.progress(i, items.length);
    if (inner?.say && (i > 0 || !item.say)) player.say(inner.say);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  const done = (r: ItemResult) => {
    results.current.push(r);
    if (fork && r.hintLevel < 4) {
      const n = (getKid(kid.id)?.bests['forks-solved'] ?? 0) + 1;
      player.best('forks-solved', n, 'higher');
      if (n >= 10) player.award('tr-forks');
    }
    if (i + 1 < items.length) setI(i + 1);
    else {
      onSolved?.();
      onDone(combine(results.current));
    }
  };
  if (!inner) return null;
  return <FindMove key={`${itemKey}-${i}`} item={inner} itemKey={`${itemKey}-${i}`} band={band} kid={kid} player={player} onDone={done} />;
}

// ---------- db: database puzzles ----------

interface DbProps extends RunProps {
  themes: string[];
  maxRating: number;
  count: number;
  streak?: boolean;
  fixed?: Puzzle[];
  onSolved?(): void;
}

function DbRun({ themes, maxRating, count, streak, fixed, player, onDone, band, kid, itemKey, onSolved }: DbProps) {
  const choose = (n: number) =>
    fixed ??
    pick({
      themes,
      maxRating,
      band,
      rating: getKid(kid.id)?.puzzle.rating ?? player.puzzle.rating,
      count: n,
      rng: () => player.rng(),
      seen: (id) => player.puzzle.isSeen(id),
    });
  const [list, setList] = useState<Puzzle[]>(() => choose(streak ? 1 : count));
  const [i, setI] = useState(0);
  const results = useRef<ItemResult[]>([]);
  const run = useRef(0);
  const total = streak ? Infinity : list.length;

  useEffect(() => {
    if (streak) player.progress(run.current, Math.max(run.current, getKid(kid.id)?.puzzle.bestStreak ?? 0));
    else if (total > 1) player.progress(i, total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(() => {
    if (!list.length) onDone({ score: 1, mistakes: 0, hintLevel: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endStreak = () => {
    const n = run.current;
    updateKid(kid.id, (d) => void (d.puzzle.bestStreak = Math.max(d.puzzle.bestStreak, n)));
    const best = player.best('puzzle-streak', n, 'higher');
    player.say(n > 0 ? `Great run: ${n}!${best ? ' A new best!' : ''}` : 'Good try! Play again?', 'cheer');
    onDone({ score: n >= 5 ? 3 : n >= 2 ? 2 : 1, mistakes: 0, hintLevel: 0, stats: { streak: n } });
  };

  const next = (r: ItemResult & { solved: boolean }) => {
    results.current.push(r);
    if (streak) {
      if (!r.solved) return endStreak();
      run.current += 1;
      const more = choose(1);
      if (!more.length) return endStreak();
      setList((l) => [...l, ...more]);
      setI((x) => x + 1);
      return;
    }
    if (i + 1 < list.length) setI(i + 1);
    else {
      onSolved?.();
      onDone(combine(results.current));
    }
  };

  const p = list[i];
  if (!p) return null;
  return <PuzzleBoard key={`${itemKey}-${p.id}-${i}`} puzzle={p} player={player} kid={kid} tries={streak ? 1 : 2} onFinish={next} />;
}

function ruleFor(p: Puzzle): string {
  if (isMatePuzzle(p)) return "Find checkmate! Look at every check first.";
  if (p.themes.includes('fork')) return 'Find a move that attacks two things at once!';
  if (p.themes.includes('pin')) return "Pin it! A pinned piece can't move without losing something bigger.";
  if (p.themes.includes('hangingPiece')) return 'Something is not guarded. Grab it!';
  if (p.themes.includes('skewer')) return 'Attack the big piece. The one behind it falls!';
  return 'Look for checks, captures and attacks!';
}

function PuzzleBoard({ puzzle, player, kid, tries, onFinish }: { puzzle: Puzzle; player: PlayerApi; kid: RunProps['kid']; tries: number; onFinish(r: ItemResult & { solved: boolean }): void }) {
  const moves = useMemo(() => pzMoves(puzzle), [puzzle]);
  const solver: 'w' | 'b' = puzzle.fen.split(' ')[1] === 'w' ? 'b' : 'w';
  const [fen, setFen] = useState(puzzle.fen);
  const [ply, setPly] = useState(0); // index into moves of the next move to play
  const [lastMove, setLastMove] = useState<[Sq, Sq] | null>(null);
  const [tones, setTones] = useState<Partial<Record<Sq, SquareTone>>>({});
  const [busy, setBusy] = useState(true);
  const [done, setDone] = useState(false);
  const [demo, setDemo] = useState<{ fen: string; last: [Sq, Sq] } | null>(null);
  const misses = useRef(0);
  const reported = useRef(false);
  const { shown, bounce, bouncing } = useBounce();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const report = (ok: boolean) => {
    if (reported.current) return;
    reported.current = true;
    player.puzzle.report(puzzle.id, puzzle.rating, ok);
  };

  // Tuck's move animates in first.
  useEffect(() => {
    later(() => {
      const r = play(puzzle.fen, parse(moves[0]));
      if (r) {
        setFen(r.fen);
        setLastMove([r.move.from, r.move.to]);
        player.sound(r.move.captured ? 'capture' : 'move');
      }
      setPly(1);
      setBusy(false);
      player.say({ all: 'Tuck moved! Your turn.', champion: 'Your move.' });
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const solution = useMemo((): Move | null => (ply % 2 === 1 && moves[ply] ? play(fen, parse(moves[ply]))?.move ?? null : null), [fen, ply, moves]);

  useEffect(() => {
    const s = solution;
    const steps: HintStep[] = [
      { say: ruleFor(puzzle) },
      s ? { say: `Try the ${NAME[s.piece]}!`, tones: { [s.from]: 'hint' } } : {},
      s ? { say: 'Follow the arrow!', tones: { [s.from]: 'hint' }, arrows: [{ from: s.from, to: s.to, color: 'green' }] } : {},
      s ? { say: 'Watch me!', demo: [uciOf(s)] } : {},
    ];
    player.setHints(steps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solution]);

  // Hint level 4: Pip plays the move, then the kid repeats it.
  const demoAt = useRef('');
  useEffect(() => {
    if (player.hintLevel !== 4 || !solution || demoAt.current === fen || busy) return;
    demoAt.current = fen;
    const r = play(fen, solution);
    if (!r) return;
    setDemo({ fen: r.fen, last: [solution.from, solution.to] });
    player.sound(solution.captured ? 'capture' : 'move');
    later(() => {
      setDemo(null);
      player.say('Your turn! Do it like Pip.');
    }, 1800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.hintLevel, solution, busy]);

  const finish = (solved: boolean) => {
    const hl = player.hintLevel;
    const score = solved ? standardScore(misses.current, hl) : 1;
    later(() => onFinish({ solved, score, mistakes: misses.current, hintLevel: hl }), solved ? 1300 : 900);
  };

  // After the last try: Pip plays the rest of the line.
  const watchPip = (from: string, at: number) => {
    setBusy(true);
    player.say({ all: "Watch Pip! Here's the trick.", champion: 'Here is the solution.' });
    let f = from;
    moves.slice(at).forEach((u, k) => {
      later(() => {
        const r = play(f, parse(u));
        if (!r) return;
        f = r.fen;
        setFen(r.fen);
        setLastMove([r.move.from, r.move.to]);
        player.sound(r.move.captured ? 'capture' : 'move');
      }, 900 * (k + 1));
    });
    later(() => {
      setDone(true);
      finish(false);
    }, 900 * (moves.length - at) + 600);
  };

  const onMove = (m: Move) => {
    if (busy || bouncing || done || demo) return;
    const r = play(fen, m);
    if (!r) return;
    if (!dbAccepts(puzzle, fen, m, ply)) {
      report(false);
      misses.current += 1;
      bounce(fen, r.fen, [m.from, m.to]);
      if (misses.current >= tries) {
        player.mistake(tries > 1 ? 'Not quite. Watch Pip!' : undefined);
        later(() => watchPip(fen, ply), 800);
      } else player.mistake('Not that one. Try again!');
      return;
    }
    const after = load(r.fen)!;
    setFen(r.fen);
    setLastMove([m.from, m.to]);
    if (after.isCheckmate() || ply >= moves.length - 1) {
      report(true);
      setDone(true);
      setTones({ [m.to]: 'good' });
      if (after.isCheckmate()) {
        player.sound('fanfare');
        player.celebrate('checkmate');
        player.award('st-first-mate');
      } else {
        player.sound(m.captured ? 'capture' : 'move');
        player.celebrate('small');
      }
      finish(true);
      return;
    }
    // Scripted reply, then the next solver move.
    player.sound(after.inCheck() ? 'check' : m.captured ? 'capture' : 'move');
    player.say('Good! Keep going!', 'cheer');
    setBusy(true);
    later(() => {
      const rr = play(r.fen, parse(moves[ply + 1]));
      if (rr) {
        setFen(rr.fen);
        setLastMove([rr.move.from, rr.move.to]);
        player.sound(rr.move.captured ? 'capture' : 'move');
      }
      setPly(ply + 2);
      setBusy(false);
    }, 700);
  };

  const boardFen = shown?.fen ?? demo?.fen ?? fen;
  return (
    <div className="k-puzzles">
      <KidsBoard
        fen={boardFen}
        orientation={solver === 'w' ? 'white' : 'black'}
        interactive={!busy && !bouncing && !done && !demo}
        playerColor={solver}
        onMove={onMove}
        lastMove={shown?.lastMove ?? demo?.last ?? lastMove}
        wobble={shown?.wobble ?? null}
        tones={tones}
        hint={demo ? null : player.hint}
        showDests={(from) => misses.current > 0 || dotsFor(kid, fenPlacement(boardFen)[from]?.toUpperCase())}
        label="Chess board: solve the puzzle"
      />
    </div>
  );
}

// ---------- Puzzle of the Day ----------

function DailyRun(props: RunProps) {
  const { band, kid, player } = props;
  const day = useMemo(() => dayKey(), []);
  const daily = useMemo(() => dailyPuzzle(band, day), [band, day]);
  useEffect(() => {
    const again = getKid(kid.id)?.puzzle.dailyDone === day;
    player.say(again ? "You solved today's puzzle! Try it again for fun." : { all: 'Puzzle of the Day! Everyone gets the same one today.', champion: 'Puzzle of the Day.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mark = () => updateKid(kid.id, (d) => void (d.puzzle.dailyDone = day));
  if (daily.kind === 'hand') return <HandRun {...props} items={[daily.item]} fork={false} onSolved={mark} />;
  return <DbRun {...props} themes={[]} maxRating={3000} count={1} fixed={[daily.puzzle]} onSolved={mark} />;
}
