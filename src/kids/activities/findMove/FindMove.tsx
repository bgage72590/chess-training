// Find the Move: a real chess position and a goal (check, mate, capture, protect, escape, ...).
// Any move that meets the goal counts. Wrong moves hop back with a gentle, goal-specific line.
// Exported for embedding by other packs (quiz `move` items, hand puzzles).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import type { ActivityProps, HintStep, Sq, SquareTone } from '../types';
import { standardScore } from '../types';
import { KidsBoard, useBounce } from '../../player/KidsBoard';
import { VALUE } from '../../lib/danger';
import { escapeWay, lineAccepts, load, meetsGoal, play, ruleLine, solutions, uciOf, wrongLine, type EscapeWay, type FindMoveItem } from './logic';
import './findMove.css';

const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const WAY_LABEL: Record<EscapeWay, { label: string; icon: 'road' | 'shield' | 'candy' }> = {
  run: { label: 'Run', icon: 'road' },
  block: { label: 'Block', icon: 'shield' },
  capture: { label: 'Capture', icon: 'candy' },
};

export function FindMove({ item, player, onDone }: ActivityProps<FindMoveItem>) {
  const goal = item.goal;
  const [fen, setFen] = useState(item.replay ? item.replay.fen : item.fen);
  const [lastMove, setLastMove] = useState<[Sq, Sq] | null>(item.lastMove ?? null);
  const [replaying, setReplaying] = useState(!!item.replay);
  const [ply, setPly] = useState(0);
  const [found, setFound] = useState<EscapeWay[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [tones, setTones] = useState<Partial<Record<Sq, SquareTone>>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [demo, setDemo] = useState<{ fen: string; last: [Sq, Sq] } | null>(null);
  const { shown, bounce, bouncing } = useBounce();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Replay first (e.g. "Black's pawn just jumped two steps!").
  useEffect(() => {
    if (!item.replay) return;
    const u = item.replay.uci;
    later(() => {
      setFen(item.fen);
      setLastMove([u.slice(0, 2), u.slice(2, 4)]);
      player.sound('move');
      later(() => setReplaying(false), 400);
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ways: EscapeWay[] | 'any' = goal.kind === 'escape' ? goal.ways : 'any';

  // One solution move for the hints (and Watch Pip).
  const solution = useMemo((): Move | null => {
    if (replaying) return null;
    if (goal.kind === 'line') {
      const u = goal.uci[ply];
      if (!u) return null;
      return play(fen, { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })?.move ?? null;
    }
    const sols = solutions(fen, goal);
    if (goal.kind === 'escape' && ways !== 'any') return sols.find((m) => !found.includes(escapeWay(fen, m))) ?? sols[0] ?? null;
    return sols[0] ?? null;
  }, [fen, goal, ply, found, ways, replaying]);

  useEffect(() => {
    const rule = item.rule ?? ruleLine(goal);
    const s = solution;
    const steps: HintStep[] = item.hints?.length
      ? item.hints
      : [
          { say: rule },
          s ? { say: `Try the ${NAME[s.piece]}!`, tones: { [s.from]: 'hint' } } : {},
          s ? { say: 'Follow the arrow!', tones: { [s.from]: 'hint' }, arrows: [{ from: s.from, to: s.to, color: 'green' }] } : {},
          s ? { say: 'Watch me!', demo: [uciOf(s)] } : {},
        ];
    player.setHints(steps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solution]);

  // Watch Pip: play the solution, then reset so the kid repeats it.
  const demoAt = useRef('');
  useEffect(() => {
    if (player.hintLevel !== 4 || !solution || demoAt.current === fen) return;
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
  }, [player.hintLevel, solution]);

  const succeed = (m: Move, after: string, extraMistakes = mistakes) => {
    setFen(after);
    setLastMove([m.from, m.to]);
    setTones({ [m.to]: 'good' });
    setDone(true);
    const c = load(after);
    const mate = !!c?.isCheckmate();
    if (mate) {
      player.sound('fanfare');
      player.celebrate('checkmate');
      player.award('st-first-mate');
    } else {
      player.sound(c?.inCheck() ? 'check' : m.captured ? 'capture' : 'move');
      player.celebrate('small');
    }
    if (c?.inCheck()) player.award('st-first-check');
    if (m.captured) player.award('st-first-capture');
    if (m.flags.includes('k') || m.flags.includes('q')) player.award('st-castle');
    if (m.flags.includes('e')) player.award('st-en-passant');
    if (m.promotion) {
      player.award('st-promotion');
      if (m.promotion === 'n' && c?.inCheck()) player.award('st-surprise-knight');
    }
    const hl = player.hintLevel;
    later(() => onDone({ score: standardScore(extraMistakes, hl), mistakes: extraMistakes, hintLevel: hl }), 1300);
  };

  const wrong = (m: Move, line: string, after: string) => {
    setMistakes((x) => x + 1);
    bounce(fen, after, [m.from, m.to]);
    player.mistake(line);
  };

  const onMove = (m: Move) => {
    if (busy || bouncing || done || demo || replaying) return;
    const r = play(fen, m);
    if (!r) return;
    const after = r.fen;
    const ac = load(after)!;

    if (goal.kind === 'line') {
      if (!lineAccepts(fen, m, goal, ply)) return wrong(m, wrongLine(goal), after);
      if (ply >= goal.uci.length - 1 || ac.isCheckmate()) return succeed(m, after);
      // Scripted reply, then the kid's next step.
      setFen(after);
      setLastMove([m.from, m.to]);
      player.sound(ac.inCheck() ? 'check' : m.captured ? 'capture' : 'move');
      player.say(ac.inCheck() ? 'Check! Now what can you grab?' : 'Good! Keep going!', 'cheer');
      setBusy(true);
      const reply = goal.uci[ply + 1];
      later(() => {
        const rr = play(after, { from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
        if (rr) {
          setFen(rr.fen);
          setLastMove([rr.move.from, rr.move.to]);
          player.sound('move');
        }
        setPly(ply + 2);
        setBusy(false);
      }, 800);
      return;
    }

    if (goal.kind === 'escape' && ways !== 'any') {
      const way = escapeWay(fen, m);
      if (!ways.includes(way)) return wrong(m, `That's a way, but not one we need. Try to ${ways.filter((w) => !found.includes(w)).join(' or ')}!`, after);
      if (found.includes(way)) {
        setBusy(true);
        setFen(after);
        setLastMove([m.from, m.to]);
        player.say('You found that way! Try another one.');
        later(() => {
          setFen(item.fen);
          setLastMove(null);
          setBusy(false);
        }, 1100);
        return;
      }
      const got = [...found, way];
      setFound(got);
      if (got.length >= ways.length) return succeed(m, after);
      setBusy(true);
      setFen(after);
      setLastMove([m.from, m.to]);
      setTones({ [m.to]: 'good' });
      player.sound('pop');
      player.celebrate('small');
      player.say(`Yes, ${WAY_LABEL[way].label.toLowerCase()}! Now find another way.`, 'cheer');
      later(() => {
        setFen(item.fen);
        setLastMove(null);
        setTones({});
        setBusy(false);
      }, 1300);
      return;
    }

    if (meetsGoal(fen, m, goal)) return succeed(m, after);

    // Goal-specific help for wrong moves.
    if (goal.kind === 'mate') {
      if (ac.isStalemate()) return wrong(m, "Oops, the king has no moves but isn't in check. That's a tie!", after);
      if (ac.inCheck()) {
        const esc = ac.moves({ verbose: true }).find((x) => x.piece === 'k');
        wrong(m, 'Check! But the king can escape!', after);
        if (esc) {
          setTones({ [esc.to]: 'hint' });
          later(() => setTones({}), 2200);
        }
        return;
      }
    }
    if (goal.kind === 'safe-capture' && m.captured) {
      // Show the recapture first, then rewind.
      const caps = ac.moves({ verbose: true }).filter((x) => x.to === m.to);
      if (caps.length) {
        const cheapest = caps.reduce((a, b) => (VALUE[b.piece] < VALUE[a.piece] ? b : a));
        const guard = new Chess(after).get(cheapest.from as Square);
        setMistakes((x) => x + 1);
        setBusy(true);
        setFen(after);
        setLastMove([m.from, m.to]);
        player.sound('capture');
        later(() => {
          const rr = play(after, cheapest);
          if (rr) {
            setFen(rr.fen);
            setLastMove([cheapest.from, cheapest.to]);
            player.sound('chomp');
          }
        }, 650);
        later(() => {
          setFen(fen);
          setLastMove(null);
          setBusy(false);
          player.mistake(`The ${NAME[guard?.type ?? 'p']} was guarding it!`);
        }, 1700);
        return;
      }
    }
    wrong(m, wrongLine(goal), after);
  };

  // Escape badges in the tray.
  useEffect(() => {
    if (goal.kind !== 'escape' || ways === 'any') return;
    player.setTray(
      ways.map((w) => ({
        id: w,
        label: WAY_LABEL[w].label,
        icon: found.includes(w) ? 'check' : WAY_LABEL[w].icon,
        variant: found.includes(w) ? 'go' : 'plain',
        onPress: () => player.say(w === 'run' ? 'Run: move the king to a safe square.' : w === 'block' ? 'Block: put a piece in the way.' : 'Capture: take the piece that gives check.'),
      })),
    );
    return () => player.setTray(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found]);

  const turn = (fen.split(' ')[1] ?? 'w') as 'w' | 'b';
  const boardFen = shown?.fen ?? demo?.fen ?? fen;
  return (
    <div className="k-findmove">
      <KidsBoard
        fen={boardFen}
        orientation={item.fen.split(' ')[1] === 'b' ? 'black' : 'white'}
        interactive={!busy && !bouncing && !done && !demo && !replaying}
        playerColor={turn}
        onMove={onMove}
        lastMove={shown?.lastMove ?? demo?.last ?? lastMove}
        wobble={shown?.wobble ?? null}
        tones={tones}
        hint={demo ? null : player.hint}
        showDests={kidDots(player) || mistakes > 0}
        label="Chess board: find the move"
      />
    </div>
  );
}

function kidDots(player: ActivityProps<unknown>['player']): boolean {
  const s = player.kid.settings.showDests;
  return s === 'always' || s === 'until-mastered';
}

