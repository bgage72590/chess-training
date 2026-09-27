// Star Collector: move your piece(s) by their own rules to collect every star. Rocks block,
// sleeping statues make lava (landing there bounces back), pawns promote into queens.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ActivityProps, ArtKey, HintStep, Placement, Sq } from '../types';
import { standardScore } from '../types';
import { applyMove, attacks, starDests, starLava, starSolve } from '../../lib/miniRules';
import { placementFen } from '../../lib/fen';
import { KidsBoard, useBounce } from '../../player/KidsBoard';
import { bossOf, type WorldId } from '../../curriculum/worlds';
import { ruleFor, starScore, PIECE_NAME, type StarItem } from './logic';
import './stars.css';

const PIECE_WORLD: Record<string, WorldId> = { R: 'w1', B: 'w2', Q: 'w3', K: 'w3', N: 'w4', P: 'w5' };

export function StarCollector({ item, player, onDone, kid }: ActivityProps<StarItem>) {
  const [pieces, setPieces] = useState<Placement>(item.pieces);
  const [collected, setCollected] = useState<Sq[]>([]);
  const [moves, setMoves] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [lavaSeen, setLavaSeen] = useState(false);
  const [woke, setWoke] = useState<Sq | null>(null);
  const [pops, setPops] = useState<Record<Sq, number>>({});
  const [misses, setMisses] = useState(0);
  const [dotsUntil, setDotsUntil] = useState(0);
  const [wobble, setWobble] = useState<Sq | null>(null);
  const [lastMove, setLastMove] = useState<[Sq, Sq] | null>(null);
  const [demo, setDemo] = useState<{ pieces: Placement; trail: Sq[]; last: [Sq, Sq] | null } | null>(null);
  const [done, setDone] = useState(false);
  const { shown, bounce, bouncing } = useBounce();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const remaining = useMemo(() => item.stars.filter((s) => !collected.includes(s)), [item.stars, collected]);
  const statues = useMemo(() => item.statues ?? {}, [item.statues]);
  const lava = useMemo(() => starLava(item, pieces), [item, pieces]);
  const lavaVisible = player.tuning.lavaVisible === 'always' || lavaSeen;

  // Dots: always (Sprout), until the piece's world boss is 3-starred, or only after a mistake.
  const setting = kid.settings.showDests;
  const pieceType = Object.values(item.pieces)[0]?.toUpperCase() ?? 'R';
  const bossId = bossOf(PIECE_WORLD[pieceType] ?? 'w1')?.id;
  const bossMastered = !!bossId && (kid.nodes[bossId]?.stars ?? 0) >= 3;
  const [now, setNow] = useState(0);
  const showDots = setting === 'always' || (setting === 'until-mastered' && !bossMastered) || mistakes > 0 || now < dotsUntil;

  // Hints from the shortest route from the current position.
  const route = useMemo(() => starSolve(item, pieces, remaining), [item, pieces, remaining]);
  useEffect(() => {
    const path = route?.path ?? [];
    const first = path[0];
    const steps: HintStep[] = [
      { say: item.rule ?? ruleFor(item) },
      first ? { say: `Try the ${PIECE_NAME[pieces[first[0]]!.toUpperCase()]}!`, tones: { [first[0]]: 'hint' } } : {},
      first ? { say: 'Follow the arrow!', tones: { [first[0]]: 'hint' }, arrows: [{ from: first[0], to: first[1], color: 'green' }] } : {},
      { say: 'Watch me!', demo: path.map(([a, b]) => a + b) },
    ];
    player.setHints(steps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  useEffect(() => {
    player.progress(collected.length, item.stars.length);
    player.par?.(moves, item.par);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collected.length, moves]);

  // Level 4: Pip plays the whole route, then the board resets and the kid repeats it.
  const demoFor = useRef(-1);
  useEffect(() => {
    if (player.hintLevel !== 4 || demoFor.current === moves || !route?.path.length) return;
    demoFor.current = moves;
    let p = pieces;
    const trail: Sq[] = [];
    setDemo({ pieces: p, trail: [], last: null });
    route.path.forEach(([a, b], i) => {
      later(() => {
        trail.push(a);
        p = applyMove(p, a, b);
        setDemo({ pieces: p, trail: [...trail], last: [a, b] });
        player.sound('move');
      }, 700 * (i + 1));
    });
    later(() => {
      setDemo(null);
      player.say('Your turn! Do it like Pip.', 'idle');
    }, 700 * (route.path.length + 1) + 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.hintLevel]);

  const finish = useCallback(
    (m: number) => {
      setDone(true);
      player.celebrate('small');
      if (item.awardOnDone) player.award(item.awardOnDone);
      if (item.bestKey) player.best(item.bestKey, m, 'lower');
      const hl = player.hintLevel;
      const score = Math.min(starScore(m, item.par, player.tuning.parSlack), standardScore(mistakes, hl)) as 1 | 2 | 3;
      later(() => onDone({ score, mistakes, hintLevel: hl, golden: m === item.par && mistakes === 0 && hl === 0, stats: { moves: m, par: item.par } }), 1100);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mistakes, item, onDone, player],
  );

  const onMove = (from: Sq, to: Sq) => {
    if (bouncing || demo || done) return;
    const next = applyMove(pieces, from, to);
    if (Object.keys(statues).length && starLava(item, next).has(to)) {
      // Lava: the statue wakes up, the piece bounces back. A mistake, gently.
      const waker = Object.entries(statues).find(([s, p]) => attacks(p!, s, new Set([...(item.rocks ?? []), ...Object.keys(statues), ...Object.keys(next)])).includes(to))?.[0] ?? null;
      setWoke(waker);
      setLavaSeen(true);
      setMistakes((x) => x + 1);
      player.sound('chomp');
      bounce(placementFen({ ...statues, ...pieces }), placementFen({ ...statues, ...next }), [from, to]);
      player.mistake({ all: 'Ouch, lava! The statue woke up. Try another square!', sprout: 'Ouch, lava! Try again!' });
      later(() => setWoke(null), 1400);
      return;
    }
    const moved = pieces[from]!;
    const promoted = moved === 'P' && next[to] === 'Q';
    setPieces(next);
    setLastMove([from, to]);
    const m = moves + 1;
    setMoves(m);
    if (remaining.includes(to)) {
      const got = [...collected, to];
      setCollected(got);
      player.sound('pop');
      setPops((p) => ({ ...p, [to]: Date.now() }));
      if (got.length === item.stars.length) {
        if (promoted) player.award('st-promotion');
        finish(m);
        return;
      }
    } else player.sound('move');
    if (promoted) {
      player.sound('sparkle');
      player.celebrate('promotion');
      player.award('st-promotion');
      player.say({ all: 'Your pawn became a queen! Keep going!', champion: 'Promoted to a queen.' }, 'wow');
    }
  };

  const onMiss = (_sq: Sq, from: Sq) => {
    if (bouncing || demo || done) return;
    setWobble(null);
    requestAnimationFrame(() => setWobble(from));
    player.sound('boop');
    const n = misses + 1;
    setMisses(n);
    if (n >= 2) {
      const until = Date.now() + 2000;
      setDotsUntil(until);
      setNow(Date.now());
      later(() => setNow(Date.now()), 2050);
    }
  };

  // Art: stars, rocks, lava, collected-star pops, statue badges, the demo trail.
  const shownPieces = demo?.pieces ?? pieces;
  const art: Partial<Record<Sq, ArtKey[]>> = {};
  const add = (sq: Sq, a: ArtKey) => (art[sq] = [...(art[sq] ?? []), a]);
  if (lavaVisible) for (const sq of lava) if (!statues[sq] && !item.rocks?.includes(sq)) add(sq, 'lava');
  for (const r of item.rocks ?? []) add(r, 'rock');
  for (const s of remaining) if (!demo || !Object.keys(shownPieces).includes(s)) add(s, 'star');
  for (const t of demo?.trail ?? []) add(t, `ghost:${pieces[t] ?? 'R'}` as ArtKey);
  const overlay: Partial<Record<Sq, ReactNode>> = {};
  for (const [sq, t] of Object.entries(pops)) overlay[sq] = <span key={t} className="k-star-pop" aria-hidden="true" />;
  for (const s of Object.keys(statues)) overlay[s] = <StatueBadge awake={woke === s} />;

  const fen = shown?.fen ?? placementFen({ ...statues, ...shownPieces });
  const dests = useMemo(() => starDests(item, pieces), [item, pieces]);

  return (
    <div className="k-stars">
      <KidsBoard
        fen={fen}
        interactive={!bouncing && !demo && !done}
        freeMoves={{ dests, onMove }}
        onMiss={onMiss}
        lastMove={shown?.lastMove ?? demo?.last ?? lastMove}
        wobble={shown?.wobble ?? wobble}
        area={item.area}
        art={art}
        overlay={overlay}
        hint={demo ? null : player.hint}
        showDests={showDots}
        label={`Star board: ${remaining.length} stars left`}
      />
    </div>
  );
}

function StatueBadge({ awake }: { awake: boolean }) {
  return (
    <span className={`k-art-statue${awake ? ' awake' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="17" fill="#fffaf0" stroke="#1f2a44" strokeWidth="3" />
        {awake ? (
          <g>
            <circle cx="14" cy="19" r="4.5" fill="#1f2a44" />
            <circle cx="26" cy="19" r="4.5" fill="#1f2a44" />
            <circle cx="15.5" cy="17.5" r="1.5" fill="#fff" />
            <circle cx="27.5" cy="17.5" r="1.5" fill="#fff" />
          </g>
        ) : (
          <path d="M10 19c3 4 6 4 8 0M22 19c3 4 6 4 8 0" fill="none" stroke="#1f2a44" strokeWidth="3" strokeLinecap="round" />
        )}
      </svg>
    </span>
  );
}
