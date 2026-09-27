// Pawn Wars and Mini Battles: the kid's little army against miniBot (or a friend, pass-and-play).
// No kings and no check: race a pawn home, capture everything, or stop the pawns.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityProps, ItemResult, Sq } from '../types';
import type { BuddyId } from '../../curriculum/buddies';
import { placementFen } from '../../lib/fen';
import { dotsFor } from '../../lib/dots';
import { KidsBoard } from '../../player/KidsBoard';
import { battleMoves, battleOutcome, battleRules, initialState, playBattle, RULE_LINE, type BattleItem, type BattleMove, type BattleOutcome, type BattleState, type Color } from './logic';
import { miniBotMove, rootScores } from './miniBot';
import { friendSeats, GameBar, ResultCard } from './GameBar';

/** The buddy who plays a battle bot: Shelly for the random ease step, then by search depth. */
export function battleBuddy(bot: BattleItem['bot']): BuddyId {
  if (bot.r >= 3) return 'shelly';
  return bot.depth <= 1 ? 'hop' : bot.depth === 2 ? 'tuck' : 'fern';
}

export const thinkMs = (rng: () => number) => 500 + Math.floor(rng() * 400);

export function Battle({ item, player, onDone, kid }: ActivityProps<BattleItem>) {
  const friendOpp = player.opponent?.kind === 'friend' ? player.opponent : null;
  const seats = useMemo(() => (friendOpp ? friendSeats(kid, friendOpp.kidId) : null), [friendOpp, kid]);
  // En passant only for kids who finished the en passant node (spec 13.7).
  const rules = useMemo(() => battleRules(item, { enPassant: (kid.nodes['w7-en-passant']?.stars ?? 0) > 0 }), [item, kid.nodes]);
  const kidColor = rules.kidColor;
  const [st, setSt] = useState<BattleState>(() => initialState(item));
  const [last, setLast] = useState<[Sq, Sq] | null>(null);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState<{ o: BattleOutcome; outcome: ItemResult['outcome']; text: string } | null>(null);
  const [flip, setFlip] = useState(false);
  const [round, setRound] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const humanTurn = !!friendOpp || st.turn === kidColor;
  const live = humanTurn && !thinking && !result;

  const finish = (o: BattleOutcome) => {
    const outcome: ItemResult['outcome'] = o.winner === null ? 'draw' : o.winner === kidColor ? 'win' : 'loss';
    let text: string;
    if (seats) text = o.winner === null ? "Stuck! It's a tie" : `${seats[o.winner].name} wins!`;
    else text = outcome === 'win' ? 'You won!' : outcome === 'draw' ? (o.reason === 'stuck' ? "Stuck! It's a tie" : "It's a tie!") : 'Good game!';
    setResult({ o, outcome, text });
    if (outcome === 'win' || seats) {
      player.sound('fanfare');
      player.celebrate('big');
    } else player.sound(outcome === 'draw' ? 'chime' : 'boop');
    if (!seats && outcome === 'win' && item.win === 'promote') player.award('st-pawn-war-win');
    const line =
      o.reason === 'promote'
        ? o.winner === kidColor || seats
          ? { all: `${text} The pawn reached the other side and became a queen!`, sprout: `${text} Your pawn is a queen!` }
          : { all: 'Oh! My pawn got to the other side first. Good game! Want a rematch?', sprout: 'My pawn got there first! Good game!' }
        : o.reason === 'stuck'
          ? { all: "Nobody can move. Stuck! It's a tie.", sprout: "Stuck! It's a tie." }
          : outcome === 'win'
            ? { all: `${text} You caught them all!`, sprout: `${text}` }
            : { all: `${text} Every game makes you stronger.`, sprout: text };
    player.say(line, outcome === 'loss' && !seats ? 'think' : 'cheer');
    const score = (outcome === 'win' ? 3 : outcome === 'draw' ? 2 : 1) as 1 | 2 | 3;
    later(() => onDone({ score, mistakes: 0, hintLevel: player.hintLevel, outcome }), 2400);
  };

  const play = (from: BattleState, m: { from: Sq; to: Sq }) => {
    const mover = from.turn;
    const next = playBattle(from, m);
    setSt(next);
    setLast([m.from, m.to]);
    player.sound(next.captured ? 'capture' : 'move');
    if (next.promoted) player.celebrate('promotion');
    const o = battleOutcome(rules, next, mover, next.promoted);
    if (o) finish(o);
  };

  // The bot's turn: think for a moment, then move.
  useEffect(() => {
    if (friendOpp || result || st.turn === kidColor) return;
    setThinking(true);
    const from = st;
    later(() => {
      const m = miniBotMove(rules, from, item.bot, () => player.rng());
      setThinking(false);
      if (m) play(from, m);
    }, thinkMs(() => player.rng()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, result, round]);

  // Hints: the move a careful player would make now.
  useEffect(() => {
    if (!humanTurn || result || seats) return;
    const scored = rootScores(rules, st, 2);
    const best = scored.reduce<{ move: BattleMove; score: number } | null>((a, b) => (!a || b.score > a.score ? b : a), null)?.move;
    const tones = best ? { [best.from]: 'hint' as const } : undefined;
    const arrows = best ? [{ from: best.from, to: best.to, color: 'green' as const }] : undefined;
    player.setHints([{ say: item.rule ?? RULE_LINE[item.win] }, { say: 'Try this piece!', tones }, { say: 'Follow the arrow!', tones, arrows }, { say: 'I would go here!', tones, arrows }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, result]);

  const startOver = () => {
    clearTimers();
    setThinking(false);
    setResult(null);
    setLast(null);
    setSt(initialState(item));
    setRound((r) => r + 1);
    player.say({ all: 'New game! Your move.', sprout: 'New game!' }, 'idle');
  };
  const startRef = useRef(startOver);
  startRef.current = startOver;

  useEffect(() => {
    player.setTray([
      { id: 'restart', label: 'Start over', icon: 'again', variant: 'plain', onPress: () => startRef.current() },
      ...(seats ? [{ id: 'flip', label: flip ? 'Flip: on' : 'Flip: off', icon: 'again' as const, variant: flip ? ('info' as const) : ('plain' as const), onPress: () => setFlip((f) => !f) }] : []),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flip]);

  const dests = useMemo(() => {
    const out: Record<Sq, Sq[]> = {};
    if (!live) return out;
    for (const m of battleMoves(rules, st)) (out[m.from] ??= []).push(m.to);
    return out;
  }, [live, rules, st]);

  const orientation = seats && flip ? (st.turn === 'w' ? 'white' : 'black') : kidColor === 'b' ? 'black' : 'white';
  const onMove = (from: Sq, to: Sq) => {
    if (!live) return;
    play(st, { from, to });
  };

  return (
    <div className="k-game k-battle">
      <GameBar friend={seats} turn={st.turn as Color} buddy={battleBuddy(item.bot)} thinking={thinking} over={!!result} kidColor={kidColor} />
      <div className="k-game-board">
        <KidsBoard
          fen={placementFen(st.pos, st.turn)}
          orientation={orientation}
          interactive={live}
          freeMoves={{ dests, onMove }}
          lastMove={last}
          area={item.area}
          hint={live && !seats ? player.hint : null}
          showDests={(from) => player.band !== 'champion' || dotsFor(kid, st.pos[from])}
          label={seats ? `Pawn war board. ${seats[st.turn].name}'s turn.` : 'Battle board'}
        />
        {result && <ResultCard outcome={result.outcome ?? 'draw'} text={result.text} />}
      </div>
    </div>
  );
}
