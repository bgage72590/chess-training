// The activity player: runs a node (or a warm-up, placement checkpoint or playground set) item by
// item. It owns the intro ("Watch Pip"), the Piece Parade, Pip's voice, the hint ladder, scoring,
// "Easier one?" / "Skip this one" / "Super Star?", the ease ladder offers, session breaks and results.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ActivityDef, AgeBand, BandText, HintStep, ItemMeta, ItemResult, LevelSet, PlayerApi, PlayMode, TrayButton } from '../activities/types';
import { bandText } from '../activities/types';
import { resolveItem } from '../curriculum/tuning';
import { NODE_BY_ID, WORLDS } from '../curriculum/worlds';
import { stickerDef, TROPHY_BY_ID } from '../curriculum/stickers';
import { ACTIVITIES, REGISTRY } from '../packs';
import { awardTo, getKid, updateKid, updateKids, type KidProfile } from '../store/kidsStore';
import { isQuiet } from '../store/quiet';
import { acceptEase, acceptFastTrack, fastTrackOffer, addFamilyStars, bossOffers, bossPassed, bossPassMark, nextNode, nodeScore, recordRun, recordWarmup, skipNode, activeNodes, type RunOutcome } from '../store/progress';
import { hashSeed, mulberry32 } from '../lib/rng';
import { plural } from '../lib/plural';
import { kidSound, type KidSound } from '../lib/kidsSound';
import { toast } from '../../lib/toast';
import { engine } from '../../engine/engine';
import { RunPicker, type RunItem } from './run';
import { heardFirst, lineId, sayAs, speech } from './speech';
import { markBreak, onBreak, sessionOver } from './useSession';
import { useKidCtx } from './context';
import { Intro, PiecePick } from './Intro';
import { Results } from './Results';
import { belowPassRecap, playgroundRecap, recapFor } from './recap';
import { TopBar, ChipStars } from '../ui/TopBar';
import { hintTarget, pipReact } from '../ui/pipEvents';
import { Coach } from '../ui/Coach';
import { Tray } from '../ui/Tray';
import { BigButton } from '../ui/BigButton';
import { KidsIcon } from '../ui/KidsIcon';
import { Confetti } from '../ui/Confetti';
import type { PipState } from '../ui/ProgressPips';
import type { PipMood } from '../ui/Pip';
import { go } from '../routes';

export interface PlanItem {
  setId: string;
  nodeId?: string;
  run: RunItem;
}

export interface ActivityPlayerProps {
  mode: PlayMode;
  kid: KidProfile;
  /** node / playground / placement: the level set to run. */
  set?: LevelSet;
  nodeId?: string;
  /** warm-up: one item from each due node. */
  plan?: PlanItem[];
  title: string;
  opponent?: PlayerApi['opponent'];
  /** placement: called with the item results when the checkpoint is decided. */
  onPlacementDone?(results: ItemResult[]): void;
  /** Where X / Map go (defaults to the map). */
  onExit?(): void;
  /** warm-up: continue after the results. */
  onContinue?(): void;
  /** node: play again (the parent remounts the player). */
  onAgain?(): void;
  /** Placement: a small path of dots per world is drawn by the parent. */
  header?: ReactNode;
}

type Current = { run: RunItem; act: ActivityDef<unknown>; item: ItemMeta & Record<string, unknown>; key: string; superStar: boolean; nodeId?: string };

const LOWER: Record<AgeBand, AgeBand | null> = { sprout: null, explorer: 'sprout', champion: 'explorer' };
const DEFAULT_SAY: Record<string, BandText> = {
  stars: { all: 'Collect every star!', sprout: 'Get the stars!' },
  'find-move': { all: 'Find the move!' },
};
const FALLBACK_HINT: BandText[] = ['', 'Try this piece!', 'Follow the arrow!', 'Watch me!'];

// A player gives its history guard entry back with history.back(), whose popstate comes a moment
// later. These pops are counted here, before any player hears them, so a player that mounts in
// between never takes one for the kid pressing Back. A pop long after is a real one.
let ownPops = 0;
let ownPopAt = 0;
let popIsOwn = false;
if (typeof window !== 'undefined')
  window.addEventListener('popstate', () => {
    popIsOwn = ownPops > 0 && Date.now() - ownPopAt < 2000;
    ownPops = popIsOwn ? ownPops - 1 : 0;
  });

export function ActivityPlayer(props: ActivityPlayerProps) {
  const { mode, kid } = props;
  const { band, tuning } = useKidCtx();
  const node = props.nodeId ? NODE_BY_ID.get(props.nodeId) : undefined;
  const np = props.nodeId ? kid.nodes[props.nodeId] : undefined;
  const set = props.set;
  const act = set ? ACTIVITIES.get(set.activity) : undefined;
  const isGame = !!act?.game;

  // ---------- run setup ----------
  const rngRef = useRef(mulberry32(hashSeed(kid.id, props.nodeId ?? set?.id ?? mode, np?.plays ?? 0, Date.now() % 997)));
  const picker = useMemo(
    () =>
      set && mode !== 'warmup'
        ? new RunPicker(set, band, {
            itemsPerRun: tuning.itemsPerRun,
            // Explorer: tier 1, or tier 2 once placement really tested out a world (spec 3.3).
            startTier: band === 'explorer' && (kid.testedOut ?? 0) > 0 ? 2 : tuning.startTier,
            rng: rngRef.current,
            lastItems: np?.lastItems,
            game: isGame,
            won: np?.won,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const total = mode === 'warmup' ? props.plan?.length ?? 0 : picker?.total ?? 0;
  const introSteps = useMemo(() => (mode === 'node' && set?.intro && (np?.plays ?? 0) === 0 ? set.intro : []), [mode, set, np?.plays]);
  const watchSteps = introSteps.filter((s) => !s.pick);
  const pickStep = introSteps.find((s) => s.pick);

  const [phase, setPhase] = useState<'intro' | 'item' | 'parade' | 'results' | 'break' | 'empty'>(watchSteps.length ? 'intro' : 'item');
  const phaseRef = useRef(phase);
  useEffect(() => void (phaseRef.current = phase), [phase]);
  const [current, setCurrent] = useState<Current | null>(null);
  const [pips, setPips] = useState<PipState[]>(() => Array.from({ length: total }, (_, i) => (i === 0 ? 'current' : 'todo')));
  const results = useRef<ItemResult[]>([]);
  const itemIds = useRef<string[]>([]);
  const braveTry = useRef(false);
  /** Moment stickers and trophies the activities awarded during this run (shown on the results card). */
  const awarded = useRef<string[]>([]);
  const perfectStreak = useRef(0);
  const warmIdx = useRef(0);
  const paradeDone = useRef(!pickStep);
  const [outcome, setOutcome] = useState<(RunOutcome & { playgroundScore?: number }) | null>(null);
  const [offer, setOffer] = useState<'easier' | 'super' | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  /** Placement: this world's checkpoint is decided (the parent shows its card). */
  const [decided, setDecided] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const pendingAfterBreak = useRef<(() => void) | null>(null);

  // ---------- coach / voice ----------
  const [coach, setCoach] = useState<{ text: string; lines?: string[]; token?: number }>({ text: '' });
  const [mood, setMood] = useState<PipMood>('idle');
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // "That one is tricky!" waits a moment after the third slip; it must not outlive the item.
  const offerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearOfferTimer = () => {
    if (offerTimer.current) clearTimeout(offerTimer.current);
    offerTimer.current = null;
  };
  useEffect(
    () => () => {
      clearOfferTimer();
      if (moodTimer.current) clearTimeout(moodTimer.current);
    },
    [],
  );
  /** The item already scored, so a repeated tap or a late timer cannot score it twice. */
  const scoredKey = useRef('');
  const setMoodFor = (m: PipMood, ms = 1400) => {
    setMood(m);
    if (m === 'cheer' || m === 'oops' || m === 'wow') pipReact(m);
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood('idle'), ms);
  };
  const rate = kid.settings.rate ?? tuning.speechRate;

  const say = useCallback(
    (text: BandText | BandText[], m?: PipMood, force = false) => {
      const lines = (Array.isArray(text) ? text : [text]).map((t) => bandText(t, band)).filter(Boolean);
      const caption = lines.join(' ');
      if (!caption) return;
      const voice = kid.settings.voice;
      const id = lineId(caption);
      const k = getKid(kid.id);
      // Quiet mode (the map's speaker button) stops automatic reading; a tap on the speaker still reads.
      const speakIt = force || (!isQuiet(kid.id) && (voice === 'auto' || (voice === 'first' && !k?.firsts.includes(id))));
      let token: number | undefined;
      if (speakIt) {
        const onEnd = voice === 'first' && !force ? () => heardFirst(kid.id, id) : undefined;
        token = speech.speak(lines, { rate, pitch: tuning.pitch, clipRate: kid.settings.rate ?? undefined, onEnd });
      } else speech.cancel();
      setCoach({ text: caption, lines, token });
      if (m) setMoodFor(m, m === 'cheer' ? 1200 : 1800);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [band, kid.id, kid.settings.voice, rate, tuning.pitch],
  );
  // Pip's demo and the piece parade are read aloud every time, except in Quiet mode or with "Speaker button only".
  const sayDemo = (t: string, m?: PipMood) => say(t, m, kid.settings.voice !== 'off' && !isQuiet(kid.id));

  // ---------- per-item state ----------
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [hintSteps, setHintSteps] = useState<HintStep[]>([]);
  const [pulse, setPulse] = useState(false);
  /** The activity has nothing to hint yet (see PlayerApi.pauseHints). */
  const [hintsPaused, setHintsPaused] = useState(false);
  const [tray, setTray] = useState<TrayButton[] | null>(null);
  const [chip, setChip] = useState<{ done: number; total?: number } | null>(null);
  const [par, setPar] = useState<{ used: number; par: number } | null>(null);
  const itemMistakes = useRef(0);
  /** A game's ease ladder length (the played item's), for the loss offers at the results. */
  const easeSteps = useRef(0);
  const easierOffered = useRef(false);
  const pops = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemLive = phase === 'item' && !!current && !offer;

  const hintShift = kid.settings.hints === 'generous' ? -1 : kid.settings.hints === 'few' ? 1 : 0;
  const hintAfter = Math.max(1, tuning.hintAfterWrong + hintShift);

  const hintStep = (level: number): HintStep | null => {
    if (!level) return null;
    const s = hintSteps[level - 1] ?? {};
    const fallbackSay = level === 1 ? current?.item.rule : FALLBACK_HINT[level - 1];
    return { ...s, say: s.say ?? fallbackSay };
  };

  const advanceHint = useCallback(() => {
    setPulse(false);
    if (hintLevel >= 4 || hintsPaused) return;
    const next = (hintLevel + 1) as 1 | 2 | 3 | 4;
    setHintLevel(next);
    const line = hintSteps[next - 1]?.say ?? (next === 1 ? current?.item.rule : FALLBACK_HINT[next - 1]);
    kidSound('sparkle');
    if (line) say(line, next === 4 ? 'talk' : 'think');
    if (next < 4) pipReact('point', hintTarget(hintSteps[next - 1]));
  }, [hintLevel, hintSteps, hintsPaused, current, say]);

  // Idle: step up the ladder (Sprout/Explorer) or pulse the bulb (Champion).
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (!itemLive || hintLevel >= 4 || hintsPaused) return;
    const sec = tuning.hintOfferOnly ? tuning.bulbPulseSec : tuning.hintAfterIdleSec;
    if (!sec) return;
    idleTimer.current = setTimeout(() => (tuning.hintOfferOnly ? setPulse(true) : advanceHint()), sec * 1000);
  }, [itemLive, hintLevel, hintsPaused, tuning, advanceHint]);
  useEffect(() => {
    resetIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);

  // ---------- items ----------
  const pipSet = (i: number, s: PipState) => setPips((p) => p.map((x, j) => (j === i ? s : j === i + 1 && s !== 'current' && x === 'todo' ? 'current' : x)));

  const beginItem = useCallback(
    (run: RunItem, opts: { superStar?: boolean; lowerBand?: AgeBand; setId?: string; nodeId?: string } = {}) => {
      const a = ACTIVITIES.get(opts.setId ? REGISTRY.LEVEL_SETS.get(opts.setId)?.activity ?? '' : set?.activity ?? '');
      if (!a) return;
      const ease = isGame ? np?.ease ?? 0 : 0;
      easeSteps.current = run.item.ease?.length ?? 0;
      let item = resolveItem(run.item, band, { super: opts.superStar, ease: Math.min(ease, easeSteps.current) });
      if (opts.lowerBand) item = { ...item, ...(run.item.tune?.[opts.lowerBand] ?? {}) };
      clearOfferTimer();
      itemMistakes.current = 0;
      easierOffered.current = false;
      pops.current = 0;
      setHintLevel(0);
      setHintSteps([]);
      setPulse(false);
      setHintsPaused(false);
      setTray(null);
      setChip(null);
      setPar(null);
      setCurrent({ run, act: a, item, key: `${run.id}-${Date.now()}`, superStar: !!opts.superStar, nodeId: opts.nodeId });
      setPhase('item');
      say(item.say ?? DEFAULT_SAY[a.id] ?? 'Your turn!', 'idle');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [band, set, isGame, np?.ease, say],
  );

  const nextItem = useCallback(() => {
    if (sessionOver(getKid(kid.id)) && mode !== 'placement') {
      pendingAfterBreak.current = () => nextItem();
      setPhase('break');
      markBreak(kid.id);
      return;
    }
    if (mode === 'warmup') {
      const p = props.plan?.[warmIdx.current++];
      if (!p) return finishRun();
      return beginItem(p.run, { setId: p.setId, nodeId: p.nodeId });
    }
    const r = picker?.next();
    if (!r) return finishRun();
    beginItem(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beginItem, picker, mode]);

  // Start (after the intro).
  const started = useRef(false);
  useEffect(() => {
    if (phase === 'item' && !started.current) {
      started.current = true;
      if (!total) setPhase('empty');
      else nextItem();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const onDone = useCallback(
    (r: ItemResult) => {
      if (!current || scoredKey.current === current.key) return;
      scoredKey.current = current.key;
      clearOfferTimer();
      const i = results.current.length;
      const res: ItemResult = { ...r, golden: r.golden || (current.superStar && r.score === 3) };
      results.current.push(res);
      itemIds.current.push(current.run.id);
      if (itemMistakes.current >= 3) braveTry.current = true;
      pipSet(i, 'done');
      picker?.report(res.score);
      perfectStreak.current = res.score === 3 && res.mistakes === 0 ? perfectStreak.current + 1 : 0;
      setOffer(null);
      setTray(null);
      if (current.superStar && res.score === 3) {
        kidSound('sparkle');
        say({ all: 'A golden star! Super!', champion: 'Golden star.' }, 'cheer');
      }
      if (mode === 'warmup' && current.nodeId) {
        const nid = current.nodeId;
        updateKid(kid.id, (d) => recordWarmup(d, nid, res.score, current.run.id));
      }
      if (mode === 'placement') {
        const pass = results.current.filter((x) => x.score >= 2 && x.hintLevel <= 1).length;
        const miss = results.current.length - pass;
        if (pass >= 2 || miss >= 2 || results.current.length >= total) {
          // The world is decided: Placement's card takes over, and Back is no longer this player's.
          setDecided(true);
          props.onPlacementDone?.(results.current);
          return;
        }
      }
      // Piece Parade after the first item.
      if (!paradeDone.current && pickStep) {
        paradeDone.current = true;
        setPhase('parade');
        return;
      }
      // Super Star offer after 3 perfect items in a row.
      if (mode === 'node' && perfectStreak.current >= 3 && picker && picker.count < picker.total && picker.superItem()) {
        perfectStreak.current = 0;
        setOffer('super');
        say({ all: 'Wow, three perfect in a row! Want to try a Super Star?', champion: 'Three perfect. Try a harder one?' }, 'wow');
        return;
      }
      nextItem();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, picker, mode, nextItem, say, total, pickStep],
  );

  const skipItem = () => {
    if (!current) return;
    const i = results.current.length;
    onDone({ score: 1, mistakes: itemMistakes.current, hintLevel });
    pipSet(i, 'skipped');
  };

  const easier = () => {
    if (!current) return;
    setOffer(null);
    const e = picker?.easier(current.run);
    if (e) return beginItem(e);
    const lower = LOWER[band];
    if (lower && current.run.item.tune?.[lower]) return beginItem(current.run, { lowerBand: lower });
  };
  const canEasier = !!current && (!!picker?.hasEasier(current.run) || (LOWER[band] && !!current.run.item.tune?.[LOWER[band]!]));

  // ---------- finishing ----------
  function finishRun() {
    // Pip's old instruction goes; the results recap replaces it once the stars have filled.
    setCoach({ text: '' });
    speech.cancel();
    if (mode === 'node' && props.nodeId) {
      let out: RunOutcome | null = null;
      updateKids((s) => {
        const d = s.kids.find((x) => x.id === kid.id)!;
        out = recordRun(d, { nodeId: props.nodeId!, results: results.current, itemIds: itemIds.current, game: isGame, easeSteps: easeSteps.current, braveTry: braveTry.current }, REGISTRY);
        addFamilyStars(s, out.gained);
      });
      // The boss confetti waits for the crown to land (Results fires it).
      setOutcome(out as RunOutcome | null);
    } else if (mode === 'playground') {
      const score = nodeScore(results.current.map((r) => r.score));
      if (props.opponent?.kind === 'friend') {
        awardTo(kid.id, 'st-friend-game');
        if (props.opponent.kidId) awardTo(props.opponent.kidId, 'st-friend-game');
      }
      setOutcome({ score, golden: false, starsBefore: 0, starsAfter: score, gained: 0, firstCompletion: false, bossPassedNow: false, worldOpened: null, stickers: [], trophies: [], hats: [], crown: null, crownNew: false, easeAuto: false, gardenFlower: false, playgroundScore: score });
    } else if (mode === 'warmup') {
      setOutcome({ score: nodeScore(results.current.map((r) => r.score)), golden: false, starsBefore: 0, starsAfter: 0, gained: 0, firstCompletion: false, bossPassedNow: false, worldOpened: null, stickers: [], trophies: [], hats: [], crown: null, crownNew: false, easeAuto: false, gardenFlower: false });
    }
    if (sessionOver(getKid(kid.id)) && mode !== 'placement') {
      pendingAfterBreak.current = () => setPhase('results');
      setPhase('break');
      markBreak(kid.id);
    } else setPhase('results');
  }

  // Break time itself is drawn by KidsApp (so a re-pick or a reload shows it too). When a grown-up
  // gives more minutes, the break ends and the run carries on where it stopped.
  useEffect(() => {
    if (phase !== 'break' || onBreak(getKid(kid.id))) return;
    const f = pendingAfterBreak.current;
    pendingAfterBreak.current = null;
    if (f) f();
    else setPhase('item');
  }, [phase, kid]);

  // ---------- the API activities see ----------
  const player: PlayerApi = {
    band,
    tuning,
    kid,
    mode,
    say: (t, m) => say(t, m),
    mistake: (text) => {
      itemMistakes.current += 1;
      kidSound('boop');
      setMoodFor('oops', 1600);
      const n = itemMistakes.current;
      let hintLine: BandText | BandText[] | undefined;
      if (!tuning.hintOfferOnly && n >= hintAfter && hintLevel < 4) {
        const next = (hintLevel + 1) as 1 | 2 | 3 | 4;
        setHintLevel(next);
        hintLine = hintSteps[next - 1]?.say ?? (next === 1 ? current?.item.rule : FALLBACK_HINT[next - 1]);
        kidSound('sparkle');
        if (next < 4) pipReact('point', hintTarget(hintSteps[next - 1]));
      }
      if (tuning.hintOfferOnly && n >= 3) setPulse(true);
      const oops = text ?? "Hmm, let's try another way!";
      const lines = (t: BandText | BandText[] | undefined) => (t === undefined ? [] : Array.isArray(t) ? t : [t]);
      // Sprouts hear and see one short line at a time: the new hint replaces the "oops" line.
      say(band === 'sprout' && hintLine ? hintLine : [...lines(oops), ...lines(hintLine)], 'oops');
      if (n >= 3 && !easierOffered.current && mode !== 'placement' && !isGame) {
        easierOffered.current = true;
        clearOfferTimer();
        offerTimer.current = setTimeout(() => setOffer('easier'), 900);
      }
      resetIdle();
    },
    setHints: (steps) => setHintSteps(steps),
    pauseHints: (paused) => {
      setHintsPaused(paused);
      if (paused) setPulse(false);
    },
    get hint() {
      return hintStep(hintLevel);
    },
    get hintLevel() {
      return hintLevel;
    },
    progress: (done, tot) => setChip({ done, total: tot }),
    par: (used, p) => setPar(band === 'sprout' ? null : { used, par: p }),
    celebrate: (kind) => {
      if (kind === 'big') setConfetti(Date.now());
      if (kind === 'promotion') {
        kidSound('sparkle');
        setMoodFor('wow', 1600);
      } else setMoodFor('cheer', kind === 'small' ? 1100 : 1800);
    },
    sound: (name: KidSound) => {
      if (name === 'pop') kidSound('pop', pops.current++);
      else kidSound(name);
    },
    award: (id) => {
      // Placement ("Show Pip what you know") grants nothing, so everything can still be earned.
      if (mode === 'placement') return;
      // A chime now; the sticker itself is stamped onto the results card with the run's other
      // rewards (a toast mid-item would cover Pip, the board or the buttons).
      if (awardTo(kid.id, id)) {
        kidSound('chime');
        awarded.current.push(id);
      }
    },
    setTray: (b) => setTray(b),
    rng: () => rngRef.current(),
    best: (key, value, better) => {
      const cur = getKid(kid.id)?.bests[key];
      const improved = cur == null || (better === 'higher' ? value > cur : value < cur);
      if (improved) updateKid(kid.id, (d) => void (d.bests[key] = value));
      return improved;
    },
    puzzle: {
      rating: kid.puzzle.rating,
      isSeen: (id) => !!getKid(kid.id)?.puzzle.seen.includes(id),
      report: (id, rating, ok) =>
        updateKid(kid.id, (d) => {
          const k = d.puzzle.attempts < 20 ? 40 : 24;
          const expect = 1 / (1 + Math.pow(10, (rating - d.puzzle.rating) / 400));
          d.puzzle.rating = Math.max(500, Math.round(d.puzzle.rating + k * ((ok ? 1 : 0) - expect)));
          d.puzzle.attempts += 1;
          d.puzzle.seen = [...d.puzzle.seen.filter((x) => x !== id), id].slice(-300);
          d.puzzle.streak = ok ? d.puzzle.streak + 1 : 0;
          d.puzzle.bestStreak = Math.max(d.puzzle.bestStreak, d.puzzle.streak);
        }),
    },
    engineReady: () => engine.status === 'ready',
    opponent: props.opponent,
  };

  // ---------- leaving ----------
  const exit = () => {
    speech.cancel();
    if (props.onExit) props.onExit();
    else go.close();
  };
  // Leaving before the results (X, Back, a break): what the run earned is announced on the next screen.
  useEffect(
    () => () => {
      if (phaseRef.current === 'results') return;
      for (const id of awarded.current) {
        const def = stickerDef(id);
        toast({ title: def ? `New sticker: ${def.title}!` : `New trophy: ${TROPHY_BY_ID.get(id)?.title ?? id}!`, icon: 'star', tone: 'accent' }, 2500);
      }
      awarded.current = [];
    },
    [],
  );
  const guardLeave = itemLive && !decided && results.current.length < total;
  const onX = () => (guardLeave ? setConfirmLeave(true) : exit());
  // The browser or Android back gesture asks too. A history entry with the same URL takes the first
  // back press (the router sees no change) and opens the sheet; a second back leaves. The entry is
  // dropped again when the guard ends. A pop that lands on another guard entry is not a back press.
  const guardBack = guardLeave && !confirmLeave;
  useEffect(() => {
    if (!guardBack) return;
    const arm = () => {
      try {
        history.pushState({ kidsGuard: 1 }, '');
        return true;
      } catch {
        return false;
      }
    };
    // After a reload the page opens on the guard entry it left: that one is reused, not stacked on.
    if (!history.state?.kidsGuard && !arm()) return;
    const onPop = () => {
      // A player that just went gave its entry back (the next placement world or node mounting in the
      // same instant): not a Back press. Put this player's entry back on top if that pop took it.
      if (popIsOwn) {
        if (!history.state?.kidsGuard) arm();
        return;
      }
      if (!history.state?.kidsGuard) setConfirmLeave(true);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (history.state?.kidsGuard) {
        ownPops += 1;
        ownPopAt = Date.now();
        history.back();
      }
    };
  }, [guardBack]);

  // ---------- results ----------
  const renderResults = () => {
    if (!outcome) return null;
    const awardedStickers = awarded.current.filter((id) => !!stickerDef(id));
    const awardedTrophies = awarded.current.filter((id) => TROPHY_BY_ID.has(id));
    const k = getKid(kid.id) ?? kid;
    if (mode === 'warmup')
      return (
        <Results
          band={band}
          title="Warm-up done!"
          stars={0}
          recap={band === 'champion' ? 'Warm-up complete. On to new things.' : 'Your brain is all warmed up!'}
          stickers={awardedStickers}
          trophies={awardedTrophies}
          hats={[]}
          onNext={props.onContinue}
          nextLabel="Let's play!"
          onMap={exit}
          onSpeak={(t) => say(t)}
        />
      );
    if (mode === 'playground') {
      // A game with a friend has no stars: its score is White's, not this kid's.
      const friend = props.opponent?.kind === 'friend';
      return (
        <Results
          band={band}
          title={props.title}
          stars={friend ? 0 : outcome.score}
          recap={playgroundRecap(set?.activity ?? '', band, friend, isGame, results.current, outcome.score)}
          stickers={awardedStickers}
          trophies={awardedTrophies}
          hats={[]}
          onAgain={props.onAgain}
          onMap={() => go.upToPlayground()}
          mapLabel="Playground"
          onSpeak={(t) => say(t)}
        />
      );
    }
    const offers = node ? bossOffers(k, node, easeSteps.current) : { practice: false, skip: false, easeOffer: false };
    const nextN = nextNode(k, REGISTRY);
    const opened = outcome.worldOpened ? WORLDS.find((w) => w.id === outcome.worldOpened) : null;
    const lowest = node && offers.practice ? activeNodes(node.world, k.band, REGISTRY).filter((n) => !n.boss && !n.bonus).sort((a, b) => (k.nodes[a.id]?.stars ?? 0) - (k.nodes[b.id]?.stars ?? 0))[0] : undefined;
    const below = !!node?.boss && !isGame && !bossPassed(k, node) && !k.nodes[node.id]?.skipped;
    const nextWorld = node ? WORLDS[WORLDS.findIndex((w) => w.id === node.world) + 1] : undefined;
    const recap = below && nextWorld ? belowPassRecap(outcome.score, bossPassMark(band), nextWorld.rank, band) : recapFor(outcome, node?.title ?? '', band, isGame, results.current);
    const fast = node ? fastTrackOffer(k, node.id, REGISTRY) : null;
    const crown = outcome.crownNew ? outcome.crown : null;
    // After the recap, Pip names a new crown, and says so when a game plays sleepier from now on.
    const alsoSay = [...(crown ? [crown === 'gold' ? 'You earned a gold crown!' : 'You earned a silver crown!'] : []), ...(outcome.easeAuto ? ["I'll play sleepier. Let's go!"] : [])];
    return (
      <Results
        band={band}
        title={node?.title ?? props.title}
        stars={outcome.score}
        golden={outcome.golden}
        recap={recap}
        stickers={[...new Set([...outcome.stickers.filter((s) => !s.startsWith('st-garden')), ...awardedStickers])]}
        trophies={[...new Set([...outcome.trophies, ...awardedTrophies])]}
        hats={outcome.hats}
        bossPassed={outcome.bossPassedNow}
        openedRank={opened ? { rank: opened.rank, title: opened.title } : null}
        crown={crown}
        crownFor={WORLDS.find((w) => w.id === node?.world)?.title}
        garden={outcome.gardenFlower ? k.garden : null}
        need={below && nextWorld ? { stars: bossPassMark(band), rank: nextWorld.rank } : null}
        onSpeak={(t) => say([t, ...alsoSay])}
        extra={
          (offers.practice || offers.skip || offers.easeOffer || fast || outcome.easeAuto) && (
            <div className="k-results-offers">
              {outcome.easeAuto && (
                // The third loss eases the boss on its own; the card says so (nothing is secretly weakened).
                <p className="k-results-note">
                  <KidsIcon name="cloud" size={22} fill /> Pip will play sleepier next time.
                </p>
              )}
              {fast && (
                <>
                  <p className="k-results-fast">Wow, no mistakes! Want to try the boss now?</p>
                  <BigButton
                    variant="boss"
                    icon="castle"
                    onClick={() => {
                      updateKid(kid.id, (d) => acceptFastTrack(d, fast.id));
                      go.play(fast.id, true);
                    }}
                  >
                    Try the boss!
                  </BigButton>
                </>
              )}
              {offers.easeOffer && (
                <BigButton variant="magic" icon="cloud" onClick={() => (updateKid(kid.id, (d) => acceptEase(d, node!.id)), props.onAgain?.())}>
                  Play sleepier?
                </BigButton>
              )}
              {lowest && (
                <BigButton variant="info" icon="again" onClick={() => go.play(lowest.id, true)}>
                  Practice first
                </BigButton>
              )}
              {offers.skip && (
                <BigButton
                  variant="plain"
                  icon="leaf"
                  onClick={() => {
                    updateKid(kid.id, (d) => skipNode(d, node!.id));
                    sayAs(kid, ["We'll come back to this one later!"], { keep: true });
                    go.upToMap();
                  }}
                >
                  Skip for now
                </BigButton>
              )}
            </div>
          )
        }
        onNext={
          nextN && nextN.id !== node?.id
            ? () => (nextN.world !== node?.world || outcome.worldOpened ? go.upToMap() : go.play(nextN.id, true))
            : undefined
        }
        onAgain={props.onAgain}
        onMap={exit}
      />
    );
  };

  // ---------- render ----------
  const Comp = current?.act.Component;
  // Portrait: while a sheet is open the board moves up and shrinks to stay clear of it, so the hinted
  // piece on the bottom rank stays visible. (Landscape puts the sheet in the tray column.)
  const [sheetH, setSheetH] = useState(0);
  const sheetOpen = offer != null || confirmLeave;
  const sheetRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return setSheetH(0);
    const measure = () => setSheetH(Math.ceil(el.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(el);
  }, []);
  const chipNode =
    chip || par ? (
      <>
        {chip && <ChipStars done={chip.done} total={chip.total} />}
        {par && (
          <span className="k-chip-feet" aria-label={`${par.used} of ${plural(par.par, 'move')}`}>
            {Array.from({ length: Math.min(par.par, 10) }, (_, i) => (
              <svg key={i} className={`k-foot${i < par.used ? ' on' : ''}`} viewBox="0 0 12 18" aria-hidden="true">
                <ellipse cx="6" cy="11.5" rx="4.2" ry="5.8" />
                <circle cx="2.6" cy="3.6" r="1.5" />
                <circle cx="5.8" cy="2.4" r="1.6" />
                <circle cx="9.1" cy="3.4" r="1.4" />
              </svg>
            ))}
          </span>
        )}
      </>
    ) : null;

  // Under the results card and Break time (both modal) nothing behind is in reach of the keyboard or a screen reader.
  const under = phase === 'results' || phase === 'break';
  return (
    <div
      className={`k-player${kid.settings.leftHanded ? ' left-handed' : ''} mode-${mode}${sheetOpen ? ' sheet-open' : ''}`}
      style={sheetOpen && sheetH ? { ['--sheet-h' as string]: `${sheetH}px` } : undefined}
      onPointerDown={() => itemLive && resetIdle()}
    >
      <TopBar
        inert={under}
        onExit={onX}
        pips={pips}
        chip={chipNode}
        hint={phase === 'item' && current ? { onPress: advanceHint, pulse, disabled: hintLevel >= 4 || hintsPaused } : undefined}
        onSpeaker={coach.text ? () => say(coach.lines ?? coach.text, undefined, true) : undefined}
      />
      {props.header}
      <div className="k-player-body" inert={under || undefined}>
        <aside className="k-player-coach">
          <Coach text={coach.text} mood={mood} token={coach.token} size={band === 'sprout' ? 80 : 72} />
        </aside>
        <main className="k-player-main" data-item={current?.run.id} data-set={current?.run.setId} data-phase={phase}>
          {phase === 'intro' && <Intro steps={watchSteps} band={band} rate={rate} onSay={(t) => sayDemo(t, 'talk')} onDone={() => setPhase('item')} />}
          {phase === 'parade' && pickStep?.pick && (
            <PiecePick
              pick={pickStep.pick}
              band={band}
              onSay={sayDemo}
              onDone={() => {
                setPhase('item');
                nextItem();
              }}
            />
          )}
          {phase === 'empty' && (
            <div className="k-empty">
              <p>More games are coming!</p>
            </div>
          )}
          {(phase === 'item' || phase === 'results' || phase === 'break') && current && Comp && (
            <Comp key={current.key} item={current.item} itemKey={current.key} band={band} kid={getKid(kid.id) ?? kid} player={player} onDone={onDone} />
          )}
        </main>
        <aside className="k-player-tray">
          <Tray buttons={phase === 'item' ? tray : null} band={band} />
        </aside>
      </div>

      <Confetti run={confetti} />

      {offer === 'easier' && (
        <div className="k-sheet" ref={sheetRef} role="dialog" aria-label="Want an easier one?">
          <div className="k-sheet-card">
            <p className="k-sheet-title">That one is tricky! What would you like?</p>
            <div className="k-sheet-actions">
              {canEasier && (
                <BigButton variant="go" icon="leaf" onClick={easier}>
                  Easier one
                </BigButton>
              )}
              <BigButton variant="primary" icon="again" onClick={() => setOffer(null)}>
                Keep trying
              </BigButton>
              <BigButton variant="plain" icon="next" onClick={skipItem}>
                Skip this one
              </BigButton>
            </div>
          </div>
        </div>
      )}
      {offer === 'super' && (
        <div className="k-sheet" ref={sheetRef} role="dialog" aria-label="Super Star?">
          <div className="k-sheet-card">
            <p className="k-sheet-title">Super Star? Win a golden star!</p>
            <div className="k-sheet-actions">
              <BigButton
                variant="magic"
                icon="star"
                onClick={() => {
                  setOffer(null);
                  const s = picker?.superItem();
                  const taken = s ? picker!.take(s) : null;
                  if (taken) beginItem(taken, { superStar: true });
                  else nextItem();
                }}
              >
                Yes, Super Star!
              </BigButton>
              <BigButton
                variant="plain"
                icon="next"
                onClick={() => {
                  setOffer(null);
                  nextItem();
                }}
              >
                No thanks
              </BigButton>
            </div>
          </div>
        </div>
      )}
      {confirmLeave && (
        <div className="k-sheet" ref={sheetRef} role="dialog" aria-label="Leave?">
          <div className="k-sheet-card">
            <p className="k-sheet-title">{mode === 'placement' ? 'Stop showing Pip? You can try again later.' : mode === 'node' && results.current.length ? 'Leave this game? You can play it again later.' : 'Leave now?'}</p>
            <div className="k-sheet-actions">
              <BigButton variant="go" icon="play" onClick={() => setConfirmLeave(false)} autoFocus>
                Stay
              </BigButton>
              <BigButton variant="plain" icon="map" onClick={exit}>
                Leave
              </BigButton>
            </div>
          </div>
        </div>
      )}
      {phase === 'results' && renderResults()}
    </div>
  );
}
