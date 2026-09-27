// Gobble!: every move must be a capture; eat every snack. Bite mode: a snack guarded by another
// snack bites back (tapping it is a mistake). Solo mode, "Last Piece Standing": capture your own
// pieces (at most 2 captures each, never a king) until one is left. Stuck means Reset, never fail.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ActivityProps, Arrow, HintStep, PieceCode, Placement, Sq, SquareTone, TrayButton } from '../types';
import { KidsBoard } from '../../player/KidsBoard';
import { placementFen } from '../../lib/fen';
import { applyMove, attacks, gobbleSolutions, guarded } from '../../lib/miniRules';
import { eatDests, soloDests, soloMove, soloSolutions, SOLO_MAX_CAPTURES, VALUE, type EatItem, type GobbleItem, type SoloItem } from './logic';
import { PIECE_NAME } from '../boardVision/logic';
import '../boardVision/boardVision.css';

export function Gobble(props: ActivityProps<GobbleItem>) {
  return props.item.mode === 'solo' ? <Solo {...(props as ActivityProps<SoloItem>)} /> : <Eat {...(props as ActivityProps<EatItem>)} />;
}

function useTimers() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
}

function gobbleScore(resets: number, mistakes: number): 1 | 2 | 3 {
  if (resets === 0 && mistakes === 0) return 3;
  if (resets <= 2) return 2;
  return 1;
}

const Poof = () => <span className="k-gb-poof" aria-hidden="true" />;
const Eyes = () => (
  <span className="k-gb-eyes" aria-hidden="true">
    <svg viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="17" fill="#fffaf0" stroke="#1f2a44" strokeWidth="3" />
      <circle cx="14" cy="19" r="4.5" fill="#1f2a44" />
      <circle cx="26" cy="19" r="4.5" fill="#1f2a44" />
    </svg>
  </span>
);

function CandyJar({ eaten, sprout }: { eaten: PieceCode[]; sprout: boolean }) {
  const total = eaten.reduce((n, p) => n + VALUE[p.toUpperCase()], 0);
  return (
    <span className="k-gb-jar">
      {eaten.map((p, i) => (
        <span key={i} className="k-gb-candy">
          <span className={`k-gb-candy-pc pc-b${p.toUpperCase()}`} aria-hidden="true" />
          <span className="k-gb-candy-v">{sprout ? '•'.repeat(VALUE[p.toUpperCase()]) : VALUE[p.toUpperCase()]}</span>
        </span>
      ))}
      {!sprout && eaten.length > 0 && <span className="k-gb-total">= {total}</span>}
    </span>
  );
}

function Eat({ item, player, onDone, band }: ActivityProps<EatItem>) {
  const later = useTimers();
  const [pieces, setPieces] = useState<Placement>(item.pieces);
  const [targets, setTargets] = useState<Placement>(item.targets);
  const [eaten, setEaten] = useState<PieceCode[]>([]);
  const [resets, setResets] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [lastMove, setLastMove] = useState<[Sq, Sq] | null>(null);
  const [poof, setPoof] = useState<{ sq: Sq; t: number } | null>(null);
  const [bitten, setBitten] = useState<{ target: Sq; guards: Sq[] } | null>(null);
  const [done, setDone] = useState(false);
  const sprout = band === 'sprout';
  const total = Object.keys(item.targets).length;
  const left = Object.keys(targets).length;
  const dests = useMemo(() => eatDests(item, pieces, targets), [item, pieces, targets]);
  const stuck = !done && left > 0 && !Object.keys(dests).length;
  const safeStuck = useMemo(() => {
    // Bite: every reachable snack is guarded counts as stuck too.
    if (!item.bite || done || !left) return false;
    const all = Object.values(dests).flat();
    return all.length > 0 && all.every((q) => guarded(targets, q));
  }, [item.bite, dests, targets, done, left]);

  const reset = () => {
    setPieces(item.pieces);
    setTargets(item.targets);
    setEaten([]);
    setLastMove(null);
    setResets((r) => r + 1);
    player.say('Fresh snacks! Try a new way.', 'idle');
  };

  useEffect(() => {
    if (stuck || safeStuck) player.say({ all: 'Oh no, no snacks left to reach! Press Reset.', champion: 'Stuck. Reset and try another order.' }, 'oops');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stuck, safeStuck]);

  useEffect(() => {
    const buttons: TrayButton[] = [{ id: 'jar', label: '', art: <CandyJar eaten={eaten} sprout={sprout} />, variant: 'plain', onPress: () => {} }];
    if (stuck || safeStuck) buttons.push({ id: 'reset', label: 'Reset', icon: 'again', variant: 'go', onPress: reset });
    player.setTray(buttons);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eaten, stuck, safeStuck]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => player.setTray(null), []);

  // Hints follow a real solution from the current position (or from the start after a dead end).
  const sol = useMemo(() => gobbleSolutions({ ...item, pieces, targets }, 1)[0] ?? null, [item, pieces, targets]);
  useEffect(() => {
    player.progress(total - left, total);
    const from = Object.keys(pieces)[0];
    const path = sol ?? [];
    const arrows: Arrow[] = path.map((q, i) => ({ from: i ? path[i - 1] : from, to: q, color: 'green' }));
    const steps: HintStep[] = [
      { say: item.rule ?? (item.bite ? 'Every move eats a snack. Guarded snacks bite back!' : 'Every move must eat a snack!') },
      path[0] ? { say: 'Eat this one next!', tones: { [path[0]]: 'hint' } } : { say: 'Press Reset and start again.' },
      path[0] ? { say: 'Follow the arrow!', arrows: arrows.slice(0, 1) } : {},
      path.length ? { say: 'Here is the whole trip!', arrows } : {},
    ];
    player.setHints(steps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sol, left]);

  const onMove = (from: Sq, to: Sq) => {
    if (done || !targets[to]) return;
    if (item.bite && guarded(targets, to)) {
      const rest: Placement = { ...targets };
      delete rest[to];
      const occ = new Set(Object.keys(targets));
      const guards = Object.entries(rest)
        .filter(([s, p]) => attacks(p!, s, occ).includes(to))
        .map(([s]) => s);
      setBitten({ target: to, guards });
      setMistakes((m) => m + 1);
      const g = targets[guards[0]];
      player.mistake(`The ${PIECE_NAME[(g ?? 'p').toUpperCase()]} is guarding it!`);
      later(() => setBitten(null), 1500);
      return;
    }
    const snack = targets[to]!;
    const nt: Placement = { ...targets };
    delete nt[to];
    const np = applyMove(pieces, from, to);
    const promoted = pieces[from] === 'P' && np[to] === 'Q';
    setPieces(np);
    setTargets(nt);
    setEaten((e) => [...e, snack]);
    setLastMove([from, to]);
    setPoof({ sq: to, t: Date.now() });
    player.sound('chomp');
    player.award('st-first-capture');
    if (promoted) {
      player.sound('sparkle');
      player.celebrate('promotion');
      player.award('st-promotion');
      player.say({ all: 'Your pawn became a queen!', champion: 'Promoted!' }, 'wow');
    }
    if (!Object.keys(nt).length) {
      setDone(true);
      player.celebrate('small');
      const hl = player.hintLevel;
      const score = Math.min(gobbleScore(resets, mistakes), hl >= 3 ? 1 : 3) as 1 | 2 | 3;
      later(() => onDone({ score, mistakes, hintLevel: hl, golden: score === 3 && hl === 0, stats: { resets } }), 1100);
    }
  };

  const tones: Partial<Record<Sq, SquareTone>> = {};
  const overlay: Partial<Record<Sq, ReactNode>> = {};
  if (bitten) {
    tones[bitten.target] = 'bad';
    for (const g of bitten.guards) {
      tones[g] = 'focus';
      overlay[g] = <Eyes />;
    }
  }
  if (poof) overlay[poof.sq] = <Poof key={poof.t} />;

  return (
    <div className="k-bv">
      <KidsBoard
        fen={placementFen({ ...targets, ...pieces })}
        interactive={!done}
        freeMoves={{ dests, onMove }}
        onMiss={() => player.sound('boop')}
        lastMove={lastMove}
        area={item.area}
        art={Object.fromEntries((item.rocks ?? []).map((r) => [r, 'rock']))}
        overlay={overlay}
        tones={tones}
        hint={player.hint}
        showDests={true}
        label={`Gobble board: ${left} snacks left`}
      />
    </div>
  );
}

function Solo({ item, player, onDone }: ActivityProps<SoloItem>) {
  const later = useTimers();
  const start = useMemo(() => {
    const pool = [item.pieces, ...(item.pool ?? [])];
    return pool[Math.floor(player.rng() * pool.length) % pool.length];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pieces, setPieces] = useState<Placement>(start);
  const [left, setLeft] = useState<Record<Sq, number>>({});
  const [resets, setResets] = useState(0);
  const [lastMove, setLastMove] = useState<[Sq, Sq] | null>(null);
  const [poof, setPoof] = useState<{ sq: Sq; t: number } | null>(null);
  const [done, setDone] = useState(false);
  const count = Object.keys(pieces).length;
  const total = Object.keys(start).length;
  const dests = useMemo(() => soloDests(pieces, left), [pieces, left]);
  const stuck = !done && count > 1 && !Object.keys(dests).length;

  const reset = () => {
    setPieces(start);
    setLeft({});
    setLastMove(null);
    setResets((r) => r + 1);
    player.say('All back! Try another order.', 'idle');
  };

  useEffect(() => {
    if (stuck) player.say('Stuck! Press Reset and try again.', 'oops');
    player.setTray(stuck ? [{ id: 'reset', label: 'Reset', icon: 'again', variant: 'go', onPress: reset }] : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stuck]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => player.setTray(null), []);

  const sol = useMemo(() => soloSolutions(pieces, 1, left)[0] ?? null, [pieces, left]);
  useEffect(() => {
    player.progress(total - count, total - 1);
    const s = sol?.[0];
    player.setHints([
      { say: 'Every move captures one of your own pieces. Each piece gets 2 captures. Kings are never captured.' },
      s ? { say: 'Try this piece!', tones: { [s[0]]: 'hint' } } : { say: 'Press Reset and start again.' },
      s ? { say: 'Follow the arrow!', arrows: [{ from: s[0], to: s[1], color: 'green' }] } : {},
      sol?.length ? { say: 'Here is the whole plan!', arrows: sol.map(([a, b]) => ({ from: a, to: b, color: 'green' as const })) } : {},
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sol, count]);

  const onMove = (from: Sq, to: Sq) => {
    if (done) return;
    const n = soloMove(pieces, left, from, to);
    setPieces(n.pieces);
    setLeft(n.left);
    setLastMove([from, to]);
    setPoof({ sq: to, t: Date.now() });
    player.sound('chomp');
    if (Object.keys(n.pieces).length === 1) {
      setDone(true);
      player.celebrate('big');
      const hl = player.hintLevel;
      const score = Math.min(gobbleScore(resets, 0), hl >= 3 ? 1 : 3) as 1 | 2 | 3;
      player.best('solo-resets', resets, 'lower');
      later(() => onDone({ score, mistakes: 0, hintLevel: hl, golden: score === 3 && hl === 0, stats: { resets } }), 1200);
    }
  };

  const overlay: Partial<Record<Sq, ReactNode>> = {};
  for (const s of Object.keys(pieces)) {
    const k = pieces[s]!.toUpperCase() === 'K';
    overlay[s] = <span className={`k-gb-badge${k ? ' king' : ''}`}>{k ? '♥' : left[s] ?? SOLO_MAX_CAPTURES}</span>;
  }
  if (poof) overlay[poof.sq] = (
    <>
      {overlay[poof.sq]}
      <Poof key={poof.t} />
    </>
  );

  return (
    <div className="k-bv">
      <KidsBoard
        fen={placementFen(pieces)}
        interactive={!done}
        freeMoves={{ dests, onMove }}
        onMiss={() => player.sound('boop')}
        lastMove={lastMove}
        overlay={overlay}
        hint={player.hint}
        showDests={true}
        label={`Last Piece Standing: ${count} pieces left`}
      />
    </div>
  );
}
