// Board Explorer: tap-the-board games that teach colors, lines, square names, the pieces and the setup.
// The board is non-interactive (taps come through onSquareClick); setup uses a piece tray.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityProps, ArtKey, PieceCode, Placement, Sq, SquareTone } from '../types';
import { standardScore } from '../types';
import { KidsBoard } from '../../player/KidsBoard';
import { fenPlacement, placementFen } from '../../lib/fen';
import { ALL_SQUARES } from '../../lib/miniRules';
import { kidSound } from '../../lib/kidsSound';
import { isLight, lineSquares, PIECE_NAME, setupTargets, setupTip, type BoardVisionItem } from './logic';
import { pieceTrayButtons } from './pieceTray';
import './boardVision.css';

type P<K extends BoardVisionItem['kind']> = ActivityProps<Extract<BoardVisionItem, { kind: K }>>;

export function BoardVision(props: ActivityProps<BoardVisionItem>) {
  const { item } = props;
  switch (item.kind) {
    case 'tap-color':
      return <TapColor {...(props as P<'tap-color'>)} />;
    case 'tap-line':
      return <TapLine {...(props as P<'tap-line'>)} />;
    case 'name-piece':
      return <NamePiece {...(props as P<'name-piece'>)} />;
    case 'find-square':
      return item.timer ? <Dash {...(props as P<'find-square'>)} /> : <FindSquare {...(props as P<'find-square'>)} />;
    case 'setup':
      return <Setup {...(props as P<'setup'>)} />;
    default:
      return null;
  }
}

function useTimers() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
}

const splat = (i: number) => `splat:${(i % 6) as 0 | 1 | 2 | 3 | 4 | 5}` as ArtKey;
const EMPTY = placementFen({});

/** Shared finish: celebrate, then report the standard score. */
function useFinish(player: ActivityProps<unknown>['player'], onDone: ActivityProps<unknown>['onDone']) {
  const later = useTimers();
  const [done, setDone] = useState(false);
  const finish = (mistakes: number, extra: { score?: 1 | 2 | 3; stats?: Record<string, number> } = {}) => {
    if (done) return;
    setDone(true);
    player.celebrate('small');
    const hl = player.hintLevel;
    later(() => onDone({ score: extra.score ?? standardScore(mistakes, hl), mistakes, hintLevel: hl, golden: mistakes === 0 && hl === 0, stats: extra.stats }), 1000);
  };
  return { done, finish, later };
}

// ---------- tap-color ----------

function TapColor({ item, player, onDone }: P<'tap-color'>) {
  const { done, finish } = useFinish(player, onDone);
  const [taps, setTaps] = useState<Sq[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const light = item.color === 'light';
  const want = (s: Sq) => isLight(s) === light;

  useEffect(() => {
    player.setTray([{ id: 'color', label: light ? 'Light' : 'Dark', icon: light ? 'sun' : 'moon', variant: 'info', onPress: () => player.say(light ? 'Light squares are pale, like the sun!' : 'Dark squares are deep, like the night!') }]);
    return () => player.setTray(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    player.progress(taps.length, item.count);
    const some = ALL_SQUARES.filter((s) => want(s) && !taps.includes(s));
    player.setHints([
      { say: light ? 'Light squares are the pale ones.' : 'Dark squares are the deep green ones.' },
      { say: 'Like this one!', tones: { [some[27 % some.length]]: 'hint' } },
      { say: 'Any of these!', tones: Object.fromEntries(some.slice(0, 6).map((s) => [s, 'hint' as SquareTone])) },
      { say: 'All of these!', art: Object.fromEntries(some.map((s) => [s, 'dot' as ArtKey])) },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taps.length]);

  const onTap = (sq: Sq) => {
    if (done || taps.includes(sq)) return;
    if (!want(sq)) {
      setMistakes((m) => m + 1);
      player.mistake(light ? 'That one is dark. Find a light one!' : 'That one is light. Find a dark one!');
      return;
    }
    const t = [...taps, sq];
    setTaps(t);
    kidSound('pop', t.length);
    if (t.length >= item.count) finish(mistakes);
  };

  return (
    <div className="k-bv">
      <KidsBoard fen={EMPTY} interactive={false} onSquareClick={onTap} art={Object.fromEntries(taps.map((s, i) => [s, splat(i)]))} hint={player.hint} label={`Tap ${item.count} ${item.color} squares`} />
    </div>
  );
}

// ---------- tap-line ----------

function TapLine({ item, player, onDone }: P<'tap-line'>) {
  const { done, finish } = useFinish(player, onDone);
  const line = useMemo(() => lineSquares(item.through, item.line), [item.through, item.line]);
  const [lit, setLit] = useState<Sq[]>([item.through]);
  const [mistakes, setMistakes] = useState(0);
  const left = line.filter((s) => !lit.includes(s));

  useEffect(() => {
    player.progress(lit.length, line.length);
    const next = left[0];
    player.setHints([
      { say: item.line === 'file' ? 'The road goes straight up and down.' : item.line === 'rank' ? 'The road goes straight across.' : 'The road goes on a slanty line.' },
      next ? { say: 'This one is on the road!', tones: { [next]: 'hint' } } : {},
      { say: 'Follow the arrow!', arrows: [{ from: line[0], to: line[line.length - 1], color: 'yellow' }] },
      { say: 'Tap every dot!', art: Object.fromEntries(left.map((s) => [s, 'dot' as ArtKey])) },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lit.length]);

  const onTap = (sq: Sq) => {
    if (done || lit.includes(sq)) return;
    if (!line.includes(sq)) {
      setMistakes((m) => m + 1);
      player.mistake('That square is not on the road.');
      return;
    }
    const l = [...lit, sq];
    setLit(l);
    kidSound('pop', l.length);
    if (l.length === line.length) finish(mistakes);
  };

  return (
    <div className="k-bv">
      <KidsBoard
        fen={EMPTY}
        interactive={false}
        onSquareClick={onTap}
        art={Object.fromEntries(lit.map((s) => [s, 'star' as ArtKey]))}
        tones={{ [item.through]: 'focus' }}
        hint={player.hint}
        label={`Light up the road: ${left.length} squares left`}
      />
    </div>
  );
}

// ---------- name-piece ----------

function NamePiece({ item, player, onDone }: P<'name-piece'>) {
  const { done, finish } = useFinish(player, onDone);
  const board = useMemo(() => fenPlacement(item.fen), [item.fen]);
  const [mistakes, setMistakes] = useState(0);
  const [found, setFound] = useState<Sq | null>(null);
  const name = PIECE_NAME[item.ask.toUpperCase()];
  const matches = (p: PieceCode | undefined) => !!p && p.toLowerCase() === item.ask && (!item.color || (item.color === 'w') === (p === p.toUpperCase()));
  const hits = Object.keys(board).filter((s) => matches(board[s]));

  useEffect(() => {
    const code = `${item.color ?? 'w'}${item.ask.toUpperCase()}`;
    player.setTray([
      {
        id: 'ask',
        label: name,
        art: <span className={`k-bv-tray-img pc-${code}`} aria-hidden="true" />,
        variant: 'info',
        onPress: () => player.say(`Where is the ${name}? Tap it!`),
      },
    ]);
    player.setHints([
      { say: HINT[item.ask] },
      { say: 'Look over here!', tones: { [hits[0]]: 'hint' } },
      { say: 'Follow the arrow!', tones: { [hits[0]]: 'hint' }, arrows: [{ from: hits[0][0] + (Number(hits[0][1]) > 4 ? '5' : '4'), to: hits[0], color: 'green' }] },
      { say: `This is the ${name}!`, tones: Object.fromEntries(hits.map((s) => [s, 'good' as SquareTone])) },
    ]);
    return () => player.setTray(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTap = (sq: Sq) => {
    if (done) return;
    const p = board[sq];
    if (matches(p)) {
      setFound(sq);
      kidSound('pop', 3);
      player.say(`Yes! That's the ${name}!`, 'cheer');
      finish(mistakes);
      return;
    }
    setMistakes((m) => m + 1);
    player.mistake(p ? `That's the ${PIECE_NAME[p.toUpperCase()]}! Find the ${name}.` : `Find the ${name}!`);
  };

  return (
    <div className="k-bv">
      <KidsBoard fen={item.fen} interactive={false} onSquareClick={onTap} tones={found ? { [found]: 'good' } : {}} hint={player.hint} label={`Find the ${name}`} />
    </div>
  );
}

const HINT: Record<string, string> = {
  k: 'The king has a little cross on top.',
  q: 'The queen wears a pointy crown.',
  r: 'The rook looks like a castle tower.',
  b: 'The bishop has a pointy hat with a slit.',
  n: 'The knight looks like a horse!',
  p: 'Pawns are the small ones in the front row.',
};

// ---------- find-square (treasure map) ----------

function targetsFor(item: Extract<BoardVisionItem, { kind: 'find-square' }>, rng: () => number): Sq[] {
  const out: Sq[] = [];
  for (let i = 0; i < Math.min(item.rounds, 60); i++) {
    if (item.squares === 'random') {
      let s: Sq;
      do s = ALL_SQUARES[Math.floor(rng() * 64) % 64];
      while (s === out[i - 1]);
      out.push(s);
    } else out.push(item.squares[i % item.squares.length]);
  }
  return out;
}

const fileRank = (sq: Sq) => Object.fromEntries(ALL_SQUARES.filter((s) => s[0] === sq[0] || s[1] === sq[1]).map((s) => [s, 'hint' as SquareTone]));

function FindSquare({ item, player, onDone }: P<'find-square'>) {
  const { done, finish, later } = useFinish(player, onDone);
  const targets = useMemo(() => targetsFor(item, player.rng), [item, player]);
  const [round, setRound] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [flash, setFlash] = useState<Sq | null>(null);
  const [found, setFound] = useState<Sq[]>([]);
  const target = targets[round];
  const coords = !item.fadeCoords || round < Math.ceil(targets.length / 2);

  useEffect(() => {
    if (!target) return;
    player.say(`Find ${target}!`, 'idle');
    player.progress(round, targets.length);
    player.setHints([
      { say: `First the letter ${target[0]}, then the number ${target[1]}.` },
      { say: `Here is the ${target[0]} road.`, tones: Object.fromEntries(ALL_SQUARES.filter((s) => s[0] === target[0]).map((s) => [s, 'hint' as SquareTone])) },
      { say: 'Where the two roads cross!', tones: fileRank(target) },
      { say: `Here it is, ${target}!`, tones: { [target]: 'hint' }, art: { [target]: 'target' } },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const onTap = (sq: Sq) => {
    if (done || !target) return;
    if (sq !== target) {
      setMistakes((m) => m + 1);
      setFlash(target);
      later(() => setFlash(null), 1500);
      player.mistake([`That's ${sq}.`, `Find ${target}!`]);
      return;
    }
    kidSound('pop', round + 1);
    setFound((f) => [...f, sq]);
    if (round + 1 >= targets.length) finish(mistakes);
    else setRound(round + 1);
  };

  return (
    <div className="k-bv">
      <KidsBoard
        fen={EMPTY}
        interactive={false}
        onSquareClick={onTap}
        coordinates={coords}
        tones={flash ? fileRank(flash) : {}}
        art={Object.fromEntries(found.map((s, i) => [s, splat(i)]))}
        hint={flash ? null : player.hint}
        label={target ? `Treasure map: find ${target}` : 'Treasure map'}
      />
    </div>
  );
}

// ---------- Coordinate Dash ----------

function Dash({ item, player, onDone }: P<'find-square'>) {
  const { done, finish } = useFinish(player, onDone);
  const secs = item.timer ?? 30;
  const [left, setLeft] = useState(secs);
  const [score, setScore] = useState(0);
  const [target, setTarget] = useState<Sq>(() => ALL_SQUARES[Math.floor(player.rng() * 64) % 64]);
  const [miss, setMiss] = useState<Sq | null>(null);
  const scoreRef = useRef(0);

  useEffect(() => {
    player.setHints([{ say: 'Letter first, then number. Go fast!' }]);
    const iv = setInterval(() => {
      setLeft((l) => {
        const n = l - 1;
        if (n <= 5 && n > 0) player.sound('tick');
        return Math.max(0, n);
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (left > 0 || done) return;
    const n = scoreRef.current;
    const best = player.best(item.bestKey ?? `dash-${secs}`, n, 'higher');
    player.say(best ? `${n} squares! A new best!` : `${n} squares! Great dashing!`, 'cheer');
    finish(0, { score: n >= 15 ? 3 : n >= 8 ? 2 : 1, stats: { found: n } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);
  useEffect(() => {
    if (!done) player.say(`Find ${target}!`, 'idle');
    player.progress(score, score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const onTap = (sq: Sq) => {
    if (done || left <= 0) return;
    if (sq !== target) {
      setMiss(sq);
      player.sound('boop');
      return;
    }
    setMiss(null);
    kidSound('pop', scoreRef.current % 8);
    scoreRef.current += 1;
    setScore(scoreRef.current);
    let next: Sq;
    do next = ALL_SQUARES[Math.floor(player.rng() * 64) % 64];
    while (next === target);
    setTarget(next);
  };

  return (
    <div className="k-bv">
      <KidsBoard fen={EMPTY} interactive={false} onSquareClick={onTap} coordinates={true} tones={miss ? { [miss]: 'bad' } : {}} label={`Coordinate Dash: find ${target}`} />
      <span className={`k-bv-timer${left <= 5 ? ' low' : ''}`} role="timer" aria-live="off">
        {left}s · {score}
      </span>
    </div>
  );
}

// ---------- setup ----------

function Setup({ item, player, onDone }: P<'setup'>) {
  const { done, finish } = useFinish(player, onDone);
  const targets = useMemo(() => setupTargets(item.pieces), [item.pieces]);
  const [placed, setPlaced] = useState<Placement>({});
  const [sel, setSel] = useState<PieceCode | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [wobble, setWobble] = useState<Sq | null>(null);
  const todo = useMemo(() => {
    const t: Placement = {};
    for (const [s, p] of Object.entries(targets)) if (!placed[s]) t[s] = p;
    return t;
  }, [targets, placed]);
  const total = Object.keys(targets).length;
  const hints = !!item.colorHints;

  const choose = (p: PieceCode) => {
    setSel(p);
    player.say(setupTip(p, hints), 'idle');
  };

  useEffect(() => {
    player.setTray(done ? null : pieceTrayButtons(todo, sel, choose));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todo, sel, done]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => player.setTray(null), []);
  useEffect(() => {
    player.progress(Object.keys(placed).length, total);
    const p = sel ?? (Object.values(todo)[0] as PieceCode | undefined);
    const spots = Object.keys(todo).filter((s) => todo[s] === p);
    player.setHints([
      { say: p ? setupTip(p, hints) : 'Tap a piece, then its square.' },
      spots[0] ? { say: 'This square!', tones: { [spots[0]]: 'hint' } } : {},
      { say: 'The outlines show where they go.', art: Object.fromEntries(Object.entries(todo).map(([s, pc]) => [s, `ghost:${pc}` as ArtKey])) },
      { say: 'Put each piece on its outline!', art: Object.fromEntries(Object.entries(todo).map(([s, pc]) => [s, `ghost:${pc}` as ArtKey])), tones: Object.fromEntries(spots.map((s) => [s, 'hint' as SquareTone])) },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todo, sel]);

  const onTap = (sq: Sq) => {
    if (done || placed[sq]) return;
    if (!sel) {
      player.say('Tap a piece in the tray first!', 'idle');
      return;
    }
    if (todo[sq] === sel) {
      const np = { ...placed, [sq]: sel };
      setPlaced(np);
      kidSound('pop', Object.keys(np).length);
      const more = Object.entries(todo).some(([s, p]) => s !== sq && p === sel);
      if (!more) setSel(null);
      if (Object.keys(np).length === total) finish(mistakes);
      return;
    }
    // A wrong square: the piece bounces back to the tray.
    setMistakes((m) => m + 1);
    setWobble(null);
    requestAnimationFrame(() => setWobble(sq));
    player.mistake(['Not there.', setupTip(sel, hints)]);
  };

  const art: Partial<Record<Sq, ArtKey>> = {};
  if (hints) for (const [s, p] of Object.entries(todo)) art[s] = `ghost:${p}` as ArtKey;

  return (
    <div className="k-bv">
      <KidsBoard fen={placementFen(placed)} interactive={false} onSquareClick={onTap} art={art} wobble={wobble} hint={player.hint} label={`Set up the board: ${total - Object.keys(placed).length} pieces left`} />
    </div>
  );
}
