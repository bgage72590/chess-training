// Play a Buddy: a real game against one of the seven animal buddies (or a friend, pass-and-play).
// Missions, takebacks, the Danger Alarm, threat lights, 3 hints, the Oops shield and a
// "See how it ended" replay. Spec 13.12.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import type { ActivityProps, Arrow, ArtKey, Sq, TrayButton } from '../types';
import { KidsBoard } from '../../player/KidsBoard';
import { useKidCtx } from '../../player/context';
import { BuddyFace, type BuddyMood } from '../../ui/BuddyFace';
import { PawnBuddy } from '../../ui/PawnBuddy';
import { DangerSheet } from '../../ui/DangerSheet';
import { BigButton } from '../../ui/BigButton';
import { KidsIcon } from '../../ui/KidsIcon';
import { BAND_LADDER, BUDDIES, easeMarks } from '../../curriculum/buddies';
import { dangerAfterMove, hangs } from '../../lib/danger';
import { dotsFor } from '../../lib/dots';
import { fenPlacement } from '../../lib/fen';
import { mulberry32 } from '../../lib/rng';
import { getKid, updateKid } from '../../store/kidsStore';
import { engine } from '../../../engine/engine';
import { buddyMove, ENGINE_BUDDIES, hintMove, oopsShield, wakeEngine } from './kidBot';
import { chessResult, developOver, developTicks, firstQueen, GOLDEN_RULES, missionResult, noHangSuccess, type Outcome, type RuleId, type Tick } from './missions';
import { FRIEND_HANDICAPS, START_FEN, type PlayBotItem } from './logic';
import './playBot.css';

const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const HINTS_PER_GAME = 3;

interface Ply {
  before: string;
  move: Move;
  /** The kid kept a move the Danger Alarm flagged. */
  kept?: boolean;
}

const INTRO: Record<PlayBotItem['mission'], string> = {
  win: 'Checkmate the king to win!',
  promote: 'Race a pawn to the end to make a queen!',
  'no-hang': 'Keep every piece safe!',
  develop: 'Follow the Golden Rules!',
};

/** The node being played (for the ease marks and helpers), read from the route. */
function nodeFromRoute(): string | null {
  if (typeof location === 'undefined') return null;
  return /#\/kids\/play\/([\w-]+)/.exec(location.hash)?.[1] ?? null;
}

export function PlayBot({ item, player, onDone, kid }: ActivityProps<PlayBotItem>) {
  const { reducedMotion } = useKidCtx();
  const friend = player.opponent?.kind === 'friend' ? player.opponent : null;
  const band = player.band;
  const tuning = player.tuning;
  const settings = kid.settings;
  const bot = item.bot;
  const buddy = BUDDIES[bot];
  const kidColor: 'w' | 'b' = friend ? 'w' : item.kidColor ?? 'w';
  const mission = friend ? 'win' : item.mission;

  const nodeId = player.mode === 'node' ? nodeFromRoute() : null;
  const np = nodeId ? kid.nodes[nodeId] : undefined;
  const helpersOn = (np?.losses ?? 0) >= 2 || (np?.ease ?? 0) > 0;
  const alarmOn = !friend && (tuning.dangerAlarm === 'locked-on' || settings.dangerAlarm || helpersOn);
  const lightsOn = !friend && (settings.threatLights || helpersOn);
  const shieldOn = !friend && band === 'champion' && settings.oopsShield;
  const takebackCap = settings.takebacks === 'always' || friend ? Infinity : settings.takebacks === 'three' ? 3 : settings.takebacks === 'one' ? 1 : 0;

  const [startFen, setStartFen] = useState<string | null>(friend ? null : item.fen ?? START_FEN);
  const [plies, setPlies] = useState<Ply[]>([]);
  const [thinking, setThinking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [alarm, setAlarm] = useState<{ before: string; move: Move; after: string; sq: Sq; piece: string } | null>(null);
  const [hintArrow, setHintArrow] = useState<Arrow | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintBusy, setHintBusy] = useState(false);
  const [takebacks, setTakebacks] = useState(0);
  const [ended, setEnded] = useState<{ result: Outcome; how: string } | null>(null);
  const [missionDone, setMissionDone] = useState<'open' | 'playing' | null>(null);
  const [replay, setReplay] = useState(false);
  const [mood, setMood] = useState<BuddyMood>('happy');
  const said = useRef({ blunder: false, nap: false });
  const recorded = useRef(false);
  const token = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rng = useMemo(() => mulberry32(Math.floor(player.rng() * 2 ** 31)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      token.current++;
      if (ENGINE_BUDDIES.includes(bot) || engine.status === 'ready') engine.cancelAll();
    },
    [bot],
  );

  const fen = plies.length ? plies[plies.length - 1].move.after : startFen ?? START_FEN;
  const turn = (fen.split(' ')[1] ?? 'w') as 'w' | 'b';
  const kidTurn = friend ? true : turn === kidColor;
  const kidPlies = plies.filter((p) => p.move.color === kidColor);
  const ticks = mission === 'develop' ? developTicks(kidPlies.map((p) => p.move), kidColor) : null;

  // ---------- start ----------
  useEffect(() => {
    if (!startFen) {
      player.say(band === 'champion' ? 'Pass and play. Choose a handicap if you like.' : 'Play with a friend! Pick how to start.');
      return;
    }
    // Separate sentences, so each is said from its recording.
    const who = friend ? ['White goes first!'] : [`${buddy.name} wants to play!`, INTRO[mission]];
    player.say(item.say ?? who, 'talk');
    player.setHints([
      { say: 'Is any of your pieces in danger?' },
      { say: 'Can you capture something for free?' },
      { say: 'Look for a check!' },
      { say: 'Tap Hint for an arrow!' },
    ]);
    if (!friend && ENGINE_BUDDIES.includes(bot)) void wakeEngine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startFen]);

  // ---------- the end ----------
  const finish = (result: Outcome, how: string, playsFen: string) => {
    setEnded({ result, how });
    setHintArrow(null);
    if (!friend && !recorded.current) {
      recorded.current = true;
      const key = result === 'win' ? 'w' : result === 'draw' ? 'd' : 'l';
      updateKid(kid.id, (d) => {
        const b = (d.bots[bot] ??= { w: 0, d: 0, l: 0 });
        b[key] += 1;
      });
      if (result === 'win' && player.mode === 'playground') {
        if (!buddy.optional) player.award(`tr-beat-${bot}`);
        const k = getKid(kid.id);
        if (k && BAND_LADDER[band].every((b) => (k.bots[b]?.w ?? 0) > 0)) player.award('tr-beat-all');
      }
    }
    const c = new Chess(playsFen);
    if (result === 'win') {
      setMood('surprised');
      player.sound('fanfare');
      if (c.isCheckmate()) {
        player.celebrate('checkmate');
        player.award('st-first-mate');
      } else player.celebrate('big');
      player.say(friend ? 'White wins! Great game!' : how === 'queen' ? 'You made the first queen! You win!' : `Checkmate! You beat ${buddy.name}!`, 'cheer');
    } else if (result === 'draw') {
      player.say(c.isStalemate() ? "Stalemate! Nobody can move, so it's a tie." : "It's a tie! Good fight.", 'talk');
    } else {
      setMood('happy');
      player.say(friend ? 'Black wins! Great game!' : how === 'queen' ? `${buddy.name} made a queen first. Try again!` : `${buddy.name} won this time. Good game!`, 'talk');
    }
  };

  const done = () => {
    const r = missionResult(mission, {
      result: ended?.result ?? null,
      ticks: ticks ?? undefined,
      noHang: noHangSuccess({ ended: !!ended, kidMoves: kidPlies.length, keptFlagged: kidPlies.filter((p) => p.kept).length, result: ended?.result ?? null }),
    });
    onDone({
      score: r.score,
      outcome: r.outcome,
      mistakes: kidPlies.filter((p) => p.kept).length,
      hintLevel: Math.min(4, hintsUsed) as 0 | 1 | 2 | 3 | 4,
      stats: { kidMoves: kidPlies.length, hints: hintsUsed, takebacks },
    });
  };

  /** After any move: game over, the promote race, the develop checklist. */
  const afterMove = (next: Ply[], afterFen: string) => {
    const c = new Chess(afterFen);
    const res = chessResult(c, kidColor);
    if (res) return finish(res, c.isCheckmate() ? 'mate' : 'draw', afterFen), true;
    if (mission === 'promote') {
      const q = firstQueen(next.map((p) => p.move), kidColor);
      if (q) return finish(q === 'kid' ? 'win' : 'loss', 'queen', afterFen), true;
    }
    if (mission === 'develop' && missionDone == null) {
      const kidMs = next.filter((p) => p.move.color === kidColor).map((p) => p.move);
      const t = developTicks(kidMs, kidColor);
      if (developOver(t, kidMs.length)) {
        const rules = Object.values(t).filter((x) => x === 'yes').length;
        setMissionDone('open');
        player.sound(rules >= 3 ? 'fanfare' : 'chime');
        if (rules >= 5) player.celebrate('big');
        player.say(band === 'champion' ? `${rules} of 5 Golden Rules.` : `You got ${rules} of 5 Golden Rules!`, rules >= 3 ? 'cheer' : 'talk');
      }
    }
    return false;
  };

  // ---------- kid moves ----------
  const commit = (move: Move, before: string, kept = false) => {
    const next = [...plies, { before, move, kept }];
    setPlies(next);
    setHintArrow(null);
    const c = new Chess(move.after);
    player.sound(c.inCheck() ? 'check' : move.captured ? 'capture' : 'move');
    if (!friend) {
      if (move.captured) {
        player.award('st-first-capture');
        setMood('surprised');
        later(() => setMood('happy'), 900);
      }
      if (c.inCheck()) player.award('st-first-check');
      if (move.flags.includes('k') || move.flags.includes('q')) player.award('st-castle');
      if (move.flags.includes('e')) player.award('st-en-passant');
      if (move.promotion) {
        player.award('st-promotion');
        player.celebrate('promotion');
        if (move.promotion === 'n' && c.inCheck()) player.award('st-surprise-knight');
      }
    }
    afterMove(next, move.after);
  };

  const onMove = async (m: Move) => {
    if (ended || alarm || thinking || checking || replay) return;
    if (friend || (!alarmOn && mission !== 'no-hang')) return commit(m, fen);
    const before = fen;
    let flag = dangerAfterMove(before, m, tuning.dangerThreshold);
    if (shieldOn && engine.status === 'ready') {
      setChecking(true);
      const my = token.current;
      const verdict = await oopsShield(before, m.after).catch(() => null);
      if (my !== token.current) return;
      setChecking(false);
      if (verdict === false) flag = null;
      else if (verdict === true && !flag) {
        const worst = hangs(m.after, kidColor)[0];
        flag = { sq: worst?.sq ?? m.to, piece: worst?.piece ?? m.piece.toUpperCase(), loss: worst?.loss ?? 0, attacker: m.to };
      }
    }
    if (!flag) return commit(m, before);
    if (!alarmOn) return commit(m, before, true); // no-hang mission bookkeeping only
    setAlarm({ before, move: m, after: m.after, sq: flag.sq, piece: flag.piece });
  };

  // ---------- buddy moves ----------
  useEffect(() => {
    if (!startFen || friend || ended || alarm || kidTurn || replay) return;
    if (missionDone === 'open') return;
    const my = ++token.current;
    setThinking(true);
    setMood('thinking');
    const t0 = Date.now();
    const wait = 600 + rng() * 600;
    const pos = fen;
    // Let the board paint the kid's move before a (possibly heavy) search.
    later(async () => {
      const { move, fellBack } = await buddyMove(bot, pos, rng);
      if (my !== token.current) return;
      later(() => {
        if (my !== token.current) return;
        setThinking(false);
        setMood('happy');
        if (fellBack && !said.current.nap) {
          said.current.nap = true;
          player.say(`${buddy.name} is napping, Olive will play instead.`, 'talk');
        }
        if (!move) return;
        const next = [...plies, { before: pos, move }];
        setPlies(next);
        const c = new Chess(move.after);
        player.sound(c.inCheck() ? 'check' : move.captured ? 'chomp' : 'move');
        if (afterMove(next, move.after)) return;
        // Pip owns buddy blunders (Sprout and Explorer, once per game).
        if (band !== 'champion' && !said.current.blunder) {
          const h = hangs(move.after, move.color)[0];
          if (h && h.loss >= 3) {
            said.current.blunder = true;
            player.say(`Oops, ${buddy.name} left a ${NAME[h.piece.toLowerCase()]} alone! Can you find it?`, 'wow');
          }
        }
      }, Math.max(0, wait - (Date.now() - t0)));
    }, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, ended, alarm, kidTurn, startFen, missionDone]);

  // ---------- helpers ----------
  const canUndo = !ended && !alarm && !thinking && !checking && kidTurn && takebacks < takebackCap && plies.some((p) => friend || p.move.color === kidColor);
  const undo = () => {
    if (!canUndo) return;
    token.current++;
    let next = plies.slice(0, -1);
    if (!friend) {
      // Take back the buddy's reply and the kid's move.
      while (next.length && next[next.length - 1].move.color !== kidColor) next = next.slice(0, -1);
      next = next.slice(0, -1);
    }
    setPlies(next);
    setTakebacks((n) => n + 1);
    setHintArrow(null);
    player.sound('whoosh');
    player.say(band === 'champion' ? 'Move taken back.' : 'Take-back! Try another move.');
  };

  const hintsLeft = HINTS_PER_GAME - hintsUsed;
  const hint = async () => {
    if (friend || ended || !kidTurn || thinking || hintBusy || hintsLeft <= 0 || alarm) return;
    setHintBusy(true);
    const pos = fen;
    const m = await hintMove(pos).catch(() => null);
    setHintBusy(false);
    if (!m || pos !== fenRef.current) return;
    setHintsUsed((n) => n + 1);
    setHintArrow({ from: m.from, to: m.to, color: 'green' });
    player.sound('sparkle');
    // The green arrow shows the move; Pip names the piece.
    player.say(band === 'champion' ? `Try your ${NAME[m.piece]}.` : `Try moving your ${NAME[m.piece]}!`, 'think');
  };
  const fenRef = useRef(fen);
  fenRef.current = fen;

  useEffect(() => {
    if (!startFen || ended || missionDone === 'open') return player.setTray(null);
    const buttons: TrayButton[] = [];
    if (takebackCap > 0)
      buttons.push({
        id: 'undo',
        label: takebackCap === Infinity ? 'Take back' : `Take back (${Math.max(0, takebackCap - takebacks)})`,
        icon: 'back',
        variant: 'plain',
        disabled: !canUndo,
        onPress: undo,
      });
    if (!friend)
      buttons.push({ id: 'hint', label: `Hint (${hintsLeft})`, icon: 'bulb', variant: 'magic', disabled: hintsLeft <= 0 || !kidTurn || thinking || hintBusy, onPress: () => void hint() });
    player.setTray(buttons.length ? buttons : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startFen, ended, missionDone, canUndo, takebacks, hintsLeft, kidTurn, thinking, hintBusy, fen]);
  useEffect(() => () => player.setTray(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Threat lights on the kid's turn.
  const art = useMemo(() => {
    const out: Partial<Record<Sq, ArtKey>> = {};
    if (alarm) out[alarm.sq] = 'danger';
    else if (lightsOn && kidTurn && !ended) for (const h of hangs(fen, kidColor)) out[h.sq] = 'danger';
    return out;
  }, [alarm, lightsOn, kidTurn, ended, fen, kidColor]);

  // Candy: material captured by each side.
  const candy = useMemo(() => {
    const p = fenPlacement(fen);
    const start = fenPlacement(startFen ?? START_FEN);
    const sum = (pl: typeof p, c: 'w' | 'b') => Object.values(pl).reduce((s, x) => s + (x && (x === x.toUpperCase()) === (c === 'w') ? VAL[x.toLowerCase()] : 0), 0);
    const other = kidColor === 'w' ? 'b' : 'w';
    return { kid: Math.max(0, sum(start, other) - sum(p, other)), bot: Math.max(0, sum(start, kidColor) - sum(p, kidColor)) };
  }, [fen, startFen, kidColor]);

  // ---------- render ----------
  if (!startFen)
    return (
      <div className="k-playbot k-playbot-pick">
        <p className="k-body">Who is stronger? They play White and can give a piece away.</p>
        <div className="k-playbot-pick-list">
          {FRIEND_HANDICAPS.map((h) => (
            <BigButton key={h.id} variant={h.id === 'none' ? 'go' : 'plain'} icon={h.id === 'none' ? 'play' : 'gift'} onClick={() => setStartFen(h.fen)}>
              {h.label}
            </BigButton>
          ))}
        </div>
      </div>
    );

  const last = plies[plies.length - 1];
  const boardFen = alarm ? alarm.after : fen;
  const friendName = friend ? (friend.kidId ? getKid(friend.kidId)?.name : null) ?? 'Friend' : null;
  const lastMove: [Sq, Sq] | null = alarm ? [alarm.move.from, alarm.move.to] : last ? [last.move.from, last.move.to] : null;
  const arrows: Arrow[] = [];
  if (hintArrow && !alarm) arrows.push(hintArrow);
  if (replay && last) arrows.push({ from: last.move.from, to: last.move.to, color: 'red' });
  const zzz = easeMarks(np?.ease ?? 0);

  return (
    <div className={`k-playbot${reducedMotion ? ' still' : ''}${ticks ? ' has-rules' : ''}`}>
      <div className="k-playbot-card top">
        {friend ? <KidsIcon name="user" size={40} /> : <BuddyFace id={bot} mood={thinking ? 'thinking' : mood} size={44} zzz={zzz} />}
        <span className="k-playbot-name">
          {friend ? `${friendName} (Black)` : buddy.name}
          {!friend && zzz > 0 && <span className="k-playbot-zzz" aria-label="sleepy">{'Z'.repeat(zzz)}</span>}
        </span>
        {thinking && (
          <span className="k-playbot-think" aria-label="thinking">
            <i />
            <i />
            <i />
          </span>
        )}
        <span className="k-playbot-candy" aria-label={`captured ${friend ? candy.kid : candy.bot}`}>
          <KidsIcon name="candy" size={20} /> {friend ? candy.kid : candy.bot}
        </span>
      </div>

      <div className="k-playbot-board">
        <KidsBoard
          fen={boardFen}
          orientation={kidColor === 'w' ? 'white' : 'black'}
          interactive={!ended && !alarm && !thinking && !checking && kidTurn && missionDone !== 'open'}
          playerColor={friend ? undefined : kidColor}
          onMove={(m) => void onMove(m)}
          lastMove={lastMove}
          art={art}
          arrows={arrows}
          showDests={(from) => dotsFor(kid, fenPlacement(boardFen)[from]?.toUpperCase())}
          label={friend ? 'Chess board: play with a friend' : `Chess board: play ${buddy.name}`}
        />
        {ticks && (
          <ul className="k-playbot-rules" aria-label="Golden Rules">
            {GOLDEN_RULES.map((r) => (
              <li key={r.id} className={`t-${(ticks as Record<RuleId, Tick>)[r.id]}`} title={r.label} aria-label={`${r.label}: ${ticks[r.id] === 'yes' ? 'done' : ticks[r.id] === 'no' ? 'missed' : 'not yet'}`}>
                <span className="k-playbot-tick" aria-hidden="true">
                  {ticks[r.id] === 'yes' ? '✓' : ticks[r.id] === 'no' ? '✗' : ''}
                </span>
                {r.short}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="k-playbot-card bottom">
        <PawnBuddy color={kid.avatar.color} face={kid.avatar.face} hat={kid.avatar.hat} size={36} />
        <span className="k-playbot-name">{friend ? `${kid.name} (White)` : kid.name}</span>
        {missionLabel(mission, band) && <span className="k-playbot-mission">{missionLabel(mission, band)}</span>}
        <span className="k-playbot-candy" aria-label={`captured ${friend ? candy.bot : candy.kid}`}>
          <KidsIcon name="candy" size={20} /> {friend ? candy.bot : candy.kid}
        </span>
      </div>

      {alarm && (
        <DangerSheet
          piece={alarm.piece}
          onUndo={() => {
            setAlarm(null);
            player.say(band === 'champion' ? 'Good check. Find a safer move.' : 'Good thinking! Find a safer move.', 'cheer');
          }}
          onKeep={() => {
            const a = alarm;
            setAlarm(null);
            commit(a.move, a.before, true);
          }}
        />
      )}

      {missionDone === 'open' && !ended && (
        <div className="k-sheet" role="dialog" aria-label="Mission done">
          <div className="k-sheet-card">
            <p className="k-sheet-title">Golden Rules: {Object.values(ticks ?? {}).filter((t) => t === 'yes').length} of 5!</p>
            <div className="k-sheet-actions">
              <BigButton variant="go" icon="play" onClick={() => setMissionDone('playing')} autoFocus>
                Keep playing
              </BigButton>
              <BigButton variant="primary" icon="next" onClick={done}>
                Finish
              </BigButton>
            </div>
          </div>
        </div>
      )}

      {ended && (
        <div className="k-sheet" role="dialog" aria-label="Game over">
          <div className="k-sheet-card">
            <p className="k-sheet-title">{endTitle(ended, friend ? null : buddy.name)}</p>
            <div className="k-sheet-actions">
              {ended.result === 'loss' && !friend && ended.how === 'mate' && !replay && (
                <BigButton
                  variant="info"
                  icon="eye"
                  onClick={() => {
                    setReplay(true);
                    player.say(band === 'champion' ? `${buddy.name}'s mating move. Remember the pattern.` : `${buddy.name} found this checkmate. Let's remember that trick!`, 'think');
                  }}
                >
                  See how it ended
                </BigButton>
              )}
              <BigButton variant="go" icon="next" onClick={done} autoFocus>
                Done
              </BigButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function missionLabel(m: PlayBotItem['mission'], band: string): string {
  if (m === 'promote') return 'Make a queen!';
  if (m === 'no-hang') return 'Keep pieces safe';
  if (m === 'develop') return band === 'champion' ? 'Develop' : 'Golden Rules';
  return '';
}

function endTitle(e: { result: Outcome; how: string }, buddy: string | null): string {
  if (!buddy) return e.result === 'win' ? 'White wins!' : e.result === 'loss' ? 'Black wins!' : "It's a tie!";
  if (e.result === 'draw') return "It's a tie!";
  if (e.result === 'win') return e.how === 'queen' ? 'First queen! You win!' : `You beat ${buddy}!`;
  return e.how === 'queen' ? `${buddy} made a queen first.` : `${buddy} won this one.`;
}
