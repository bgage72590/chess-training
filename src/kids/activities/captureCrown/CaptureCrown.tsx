// Capture the Crown: the whole army, no check rule. Capture the enemy king to win. Danger bells
// (Sprout and Explorer) ring when the kid leaves their own king where it can be captured.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityProps, ArtKey, ItemResult, Sq } from '../types';
import type { BuddyId } from '../../curriculum/buddies';
import { placementFen } from '../../lib/fen';
import { dotsFor } from '../../lib/dots';
import { KidsBoard } from '../../player/KidsBoard';
import { BigButton } from '../../ui/BigButton';
import { Pip } from '../../ui/Pip';
import { friendSeats, GameBar, ResultCard } from '../battle/GameBar';
import { thinkMs } from '../battle/Battle';
import { crownMoves, crownOutcome, kingInDanger, playCrown, type CrownBotLevel, type CrownItem, type CrownOutcome, type CrownState } from './logic';
import { crownBotMove, CROWN_VALUE } from './crownBot';
import './crown.css';

const BUDDY: Record<CrownBotLevel, BuddyId> = { sleepy: 'shelly', playful: 'hop', clever: 'fern' };
const RULE = { all: 'Capture the king to win! Keep your own king safe.', sprout: 'Catch the king!' };

const kingSq = (pos: CrownState['pos'], color: 'w' | 'b') => Object.entries(pos).find(([, p]) => p === (color === 'w' ? 'K' : 'k'))?.[0] ?? null;

export function CaptureCrown({ item, player, onDone, kid }: ActivityProps<CrownItem>) {
  const friendOpp = player.opponent?.kind === 'friend' ? player.opponent : null;
  const seats = useMemo(() => (friendOpp ? friendSeats(kid, friendOpp.kidId) : null), [friendOpp, kid]);
  const bells = player.band !== 'champion';
  const start = (): CrownState => ({ pos: { ...item.placement }, turn: 'w', quiet: 0 });
  const [st, setSt] = useState<CrownState>(start);
  const [last, setLast] = useState<[Sq, Sq] | null>(null);
  const [thinking, setThinking] = useState(false);
  const [danger, setDanger] = useState<{ prev: CrownState; prevLast: [Sq, Sq] | null; attacker: Sq } | null>(null);
  const [wobble, setWobble] = useState<Sq | null>(null);
  const [result, setResult] = useState<{ outcome: ItemResult['outcome']; text: string } | null>(null);
  const [flip, setFlip] = useState(false);
  const [round, setRound] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const humanTurn = !!friendOpp || st.turn === 'w';
  const live = humanTurn && !thinking && !result && !danger;

  const finish = (o: CrownOutcome) => {
    const outcome: ItemResult['outcome'] = o.winner === null ? 'draw' : o.winner === 'w' ? 'win' : 'loss';
    const text = seats
      ? o.winner === null
        ? "It's a tie!"
        : `${seats[o.winner].name} wins!`
      : outcome === 'win'
        ? 'You got the crown!'
        : outcome === 'draw'
          ? "It's a tie!"
          : 'Good game!';
    setResult({ outcome, text });
    // With a friend, Pip says the color (names stay on screen), so every line has a recording.
    const said = seats && o.winner ? (o.winner === 'w' ? 'White wins!' : 'Black wins!') : text;
    if (outcome === 'win' || (seats && o.winner)) {
      player.sound('crown');
      player.celebrate('big');
    } else player.sound(outcome === 'draw' ? 'chime' : 'boop');
    if (!seats && outcome === 'win') player.award('st-crown-captured');
    player.say(
      o.reason === 'crown'
        ? outcome === 'win' || seats
          ? [said, { all: 'The king was captured!', sprout: '' }]
          : { all: 'I captured your king! Good game. Keep your king safe next time!', sprout: 'I got your king! Good game!' }
        : o.reason === 'stuck'
          ? "Nobody can move. It's a tie!"
          : "Lots of moves and no captures. It's a tie!",
      outcome === 'loss' && !seats ? 'think' : 'cheer',
    );
    const score = (outcome === 'win' ? 3 : outcome === 'draw' ? 2 : 1) as 1 | 2 | 3;
    later(() => onDone({ score, mistakes: 0, hintLevel: player.hintLevel, outcome }), 2400);
  };

  const play = (from: CrownState, m: { from: Sq; to: Sq }, human: boolean) => {
    const mover = from.turn;
    const next = playCrown(from, m);
    setSt(next);
    setLast([m.from, m.to]);
    player.sound(next.captured ? 'capture' : 'move');
    if (next.promoted) player.celebrate('promotion');
    const o = crownOutcome(next, mover);
    if (o) return finish(o);
    if (human && bells) {
      const attacker = kingInDanger(next.pos, mover);
      if (attacker) {
        setDanger({ prev: from, prevLast: last, attacker });
        setWobble(null);
        requestAnimationFrame(() => setWobble(kingSq(next.pos, mover)));
        player.sound('check');
        player.say({ all: 'Ding ding! Your king can be captured!', sprout: 'Ding ding! Your king is in danger!' }, 'wow');
      }
    }
  };

  // The bot's turn (Black).
  useEffect(() => {
    if (friendOpp || result || danger || st.turn === 'w') return;
    setThinking(true);
    const from = st;
    later(() => {
      const m = crownBotMove(from, item.bot, () => player.rng());
      setThinking(false);
      if (m) play(from, m, false);
    }, thinkMs(() => player.rng()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, result, danger, round]);

  // Hints: capture the king if you can, else the best simple capture, else keep the king safe.
  useEffect(() => {
    if (!humanTurn || result || seats) return;
    const moves = crownMoves(st);
    const safe = moves.filter((m) => !kingInDanger(playCrown(st, m).pos, st.turn));
    const pool = safe.length ? safe : moves;
    const best = pool.reduce<(typeof moves)[number] | null>((a, b) => (!a || (b.capture ? CROWN_VALUE[b.capture.toUpperCase()] : 0) > (a.capture ? CROWN_VALUE[a.capture.toUpperCase()] : 0) ? b : a), null);
    const tones = best ? { [best.from]: 'hint' as const } : undefined;
    const arrows = best ? [{ from: best.from, to: best.to, color: 'green' as const }] : undefined;
    player.setHints([{ say: item.rule ?? RULE }, { say: 'Try this piece!', tones }, { say: 'Follow the arrow!', tones, arrows }, { say: 'I would go here!', tones, arrows }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, result]);

  const startOver = () => {
    clearTimers();
    setThinking(false);
    setResult(null);
    setDanger(null);
    setLast(null);
    setSt(start());
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
    for (const m of crownMoves(st)) (out[m.from] ??= []).push(m.to);
    return out;
  }, [live, st]);

  const undo = () => {
    if (!danger) return;
    setSt(danger.prev);
    setLast(danger.prevLast);
    setDanger(null);
    player.say({ all: 'Good thinking! Find a safer move.', sprout: 'Try again!' }, 'idle');
  };

  const art: Partial<Record<Sq, ArtKey>> = {};
  const myKing = danger ? kingSq(st.pos, danger.prev.turn) : null;
  if (myKing) art[myKing] = 'danger';
  const side = danger ? danger.prev.turn : st.turn;
  const orientation = seats && flip && side === 'b' ? 'black' : 'white';

  return (
    <div className="k-game k-crown">
      <GameBar friend={seats} turn={st.turn} buddy={BUDDY[item.bot]} thinking={thinking} over={!!result} kidColor="w" />
      <div className="k-game-board">
        <KidsBoard
          fen={placementFen(st.pos, st.turn)}
          orientation={orientation}
          interactive={live}
          freeMoves={{ dests, onMove: (from, to) => live && play(st, { from, to }, true) }}
          lastMove={last}
          art={art}
          arrows={danger ? [{ from: danger.attacker, to: myKing ?? danger.attacker, color: 'red' }] : undefined}
          wobble={wobble}
          hint={live && !seats ? player.hint : null}
          showDests={(from) => player.band !== 'champion' || dotsFor(kid, st.pos[from])}
          label={seats ? `Capture the Crown. ${seats[st.turn].name}'s turn.` : 'Capture the Crown board'}
        />
        {result && <ResultCard outcome={result.outcome ?? 'draw'} text={result.text} />}
      </div>
      {danger && (
        <div className="k-sheet" role="alertdialog" aria-label="Danger bells">
          <div className="k-sheet-card k-danger">
            <Pip mood="wow" size={72} />
            <p className="k-sheet-title">Ding ding! Your king can be captured!</p>
            <div className="k-sheet-actions">
              <BigButton variant="go" icon="again" onClick={undo} autoFocus>
                Undo
              </BigButton>
              <BigButton variant="plain" icon="next" onClick={() => setDanger(null)}>
                Move anyway
              </BigButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
