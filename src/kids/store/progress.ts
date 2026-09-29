// Pure progression logic: runs, unlocking, bosses, stars, mastery, crowns, Leitner warm-ups,
// placement, grants (stickers, trophies, wardrobe, family jar) and graduation. Spec sections 3, 5, 6.
// Every function takes a Registry so tests can use fake pack lists (missing packs, section 5.2).
import { dayKey, daysBetween, DAY } from '../../lib/srs';
import type { AgeBand, ItemResult } from '../activities/types';
import { BAND_TUNING } from '../curriculum/tuning';
import { NODES, NODE_BY_ID, WORLDS, bossOf, nodesOf, type NodeDef, type WorldId } from '../curriculum/worlds';
import { trophiesFor, type TrophySummary } from '../curriculum/stickers';
import { hatsForStars, type HatId } from '../curriculum/wardrobe';
import { emptyNode, type KidProfile, type KidsState, type NodeProgress } from './kidsStore';
import type { SkillId } from '../curriculum/skills';

export interface Registry {
  isRegistered(nodeId: string): boolean;
}

export const LEITNER_DAYS = [1, 2, 4, 7, 14];

export const addDays = (day: string, n: number) => dayKey(new Date(day + 'T12:00:00').getTime() + n * DAY);

// ---------- Node and world state ----------

export const visibleTo = (n: NodeDef, band: AgeBand) => n.bands.includes(band);

/** Registered nodes of a world that this band sees. */
export function activeNodes(world: WorldId, band: AgeBand, reg: Registry): NodeDef[] {
  return nodesOf(world).filter((n) => visibleTo(n, band) && reg.isRegistered(n.id));
}

export const nodeOf = (kid: KidProfile, id: string): NodeProgress | undefined => kid.nodes[id];

/** Played to at least 1 star, tested out, or skipped: the next node may open. */
export function nodeDone(np: NodeProgress | undefined): boolean {
  return !!np && (np.stars >= 1 || !!np.tested || !!np.passed || !!np.skipped);
}

export const bossPassMark = (band: AgeBand) => BAND_TUNING[band].bossPass;

/** A boss is passed on a win (game) or at the band's pass mark (others), or when tested out. */
export function bossPassed(kid: KidProfile, node: NodeDef): boolean {
  const np = kid.nodes[node.id];
  if (!np) return false;
  // A pass is kept once earned: a test-out (placement or a skip-ahead challenge) never relocks.
  if (np.tested || np.passed) return true;
  if (node.game) return (np.won?.length ?? 0) > 0;
  return np.stars >= bossPassMark(kid.band);
}

/** A world is passed when its boss is passed or skipped (or, without a registered boss, when every
 *  registered visible non-bonus node has a star). A world with no registered nodes passes automatically. */
export function worldPassed(kid: KidProfile, world: WorldId, reg: Registry): boolean {
  const active = activeNodes(world, kid.band, reg).filter((n) => !n.bonus);
  if (!active.length) return true;
  const boss = bossOf(world);
  if (boss && visibleTo(boss, kid.band) && reg.isRegistered(boss.id)) return bossPassed(kid, boss) || !!kid.nodes[boss.id]?.skipped;
  return active.every((n) => (kid.nodes[n.id]?.stars ?? 0) >= 1 || kid.nodes[n.id]?.tested || kid.nodes[n.id]?.passed);
}

export function worldUnlocked(kid: KidProfile, world: WorldId, reg: Registry): boolean {
  const i = WORLDS.findIndex((w) => w.id === world);
  if (i <= 0 || kid.settings.unlockAll) return true;
  return worldPassed(kid, WORLDS[i - 1].id, reg);
}

export function nodeUnlocked(kid: KidProfile, nodeId: string, reg: Registry): boolean {
  const node = NODE_BY_ID.get(nodeId);
  if (!node || !visibleTo(node, kid.band) || !reg.isRegistered(nodeId)) return false;
  if (!worldUnlocked(kid, node.world, reg)) return false;
  if (node.bonus || kid.settings.unlockAll) return true;
  if (node.boss && kid.nodes[nodeId]?.fastTrack) return true;
  const chain = activeNodes(node.world, kid.band, reg).filter((n) => !n.bonus);
  const i = chain.findIndex((n) => n.id === nodeId);
  return i <= 0 || nodeDone(kid.nodes[chain[i - 1].id]);
}

/** The next node to play: the first unlocked, unplayed node; else the lowest-starred unlocked one. */
export function nextNode(kid: KidProfile, reg: Registry): NodeDef | null {
  let lowest: NodeDef | null = null;
  let lowestStars = 4;
  for (const w of WORLDS) {
    if (!worldUnlocked(kid, w.id, reg)) break;
    for (const n of activeNodes(w.id, kid.band, reg)) {
      if (n.bonus || !nodeUnlocked(kid, n.id, reg)) continue;
      const np = kid.nodes[n.id];
      if (!np || (np.plays === 0 && !np.tested && !np.skipped)) return n;
      const s = np.skipped ? 0 : np.stars;
      // Ties go to the later node, so a kid who has played everything replays near the frontier.
      if (s <= lowestStars) {
        lowest = n;
        lowestStars = s;
      }
    }
  }
  return lowest;
}

/** Where the Pawn Buddy stands: the next unplayed node, else the furthest node played or tested. */
export function frontierNode(kid: KidProfile, reg: Registry): NodeDef | null {
  const n = nextNode(kid, reg);
  if (n && !kid.nodes[n.id]?.plays && !kid.nodes[n.id]?.tested) return n;
  let last: NodeDef | null = n;
  for (const w of WORLDS) {
    if (!worldUnlocked(kid, w.id, reg)) break;
    for (const x of activeNodes(w.id, kid.band, reg)) if (!x.bonus && (kid.nodes[x.id]?.plays || kid.nodes[x.id]?.tested)) last = x;
  }
  return last;
}

/** The world the kid is in: the world of the next node, else the highest unlocked world. */
export function currentWorld(kid: KidProfile, reg: Registry): WorldId {
  const n = nextNode(kid, reg);
  if (n && (kid.nodes[n.id]?.plays ?? 0) === 0) return n.world;
  let last: WorldId = 'w1';
  for (const w of WORLDS) if (worldUnlocked(kid, w.id, reg)) last = w.id;
  return last;
}

export const mastered = (np: NodeProgress | undefined) => !!np && (np.stars === 3 || np.masteredDays.length >= 2);

export function crownOf(kid: KidProfile, world: WorldId, reg: Registry): 'gold' | 'silver' | null {
  const boss = bossOf(world);
  const active = activeNodes(world, kid.band, reg).filter((n) => !n.bonus);
  if (active.length && active.every((n) => mastered(kid.nodes[n.id]) && !kid.nodes[n.id]?.skipped && !kid.nodes[n.id]?.tested)) return 'gold';
  if (boss && reg.isRegistered(boss.id) && visibleTo(boss, kid.band) && bossPassed(kid, boss) && !kid.nodes[boss.id]?.skipped) return 'silver';
  return null;
}

/** Stars the kid earned by playing. Test-out stars (paper planes) and skipped nodes count for nothing:
 *  placement gives no rewards (spec 3.2), so they never fill totals, hats or the family jar. */
export const earnedStars = (np: NodeProgress | undefined): number => (!np || np.skipped || np.tested ? 0 : np.stars);

export function totalStars(kid: KidProfile): number {
  let s = 0;
  for (const np of Object.values(kid.nodes)) s += earnedStars(np);
  return s;
}

/** Graduation: w8-crown passed with a real win, plus a star on every registered visible non-bonus Rank 8 node. */
export function canGraduate(kid: KidProfile, reg: Registry): boolean {
  const crown = NODE_BY_ID.get('w8-crown')!;
  if (!reg.isRegistered(crown.id)) return false;
  const np = kid.nodes[crown.id];
  if (!np || np.skipped || !((np.won?.length ?? 0) > 0)) return false;
  return activeNodes('w8', kid.band, reg)
    .filter((n) => !n.bonus)
    .every((n) => (kid.nodes[n.id]?.stars ?? 0) >= 1 && !kid.nodes[n.id]?.skipped);
}

// ---------- Scoring and boss rules ----------

/** A node's score: max(1, round(mean(item scores))). */
export function nodeScore(scores: number[]): 1 | 2 | 3 {
  if (!scores.length) return 1;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.min(3, Math.max(1, Math.round(mean))) as 1 | 2 | 3;
}

export const outcomeScore = (o: 'win' | 'draw' | 'loss'): 1 | 2 | 3 => (o === 'win' ? 3 : o === 'draw' ? 2 : 1);

export interface BossOffers {
  /** Non-game boss below the pass mark after the 2nd attempt: "Practice first". */
  practice: boolean;
  /** "Skip for now" (non-game after 3 attempts; game bosses after 4 losses, never the final boss). */
  skip: boolean;
  /** Any game after 2 losses in a row, while an easier step is left: "Want me to play sleepier?" */
  easeOffer: boolean;
}

/**
 * The results card's offers. The ease ladder is for every game (spec 3.3): a game that is not a boss
 * never needs "Skip for now", since a loss earns the star that opens the next node. `easeSteps` is the
 * played item's ease ladder length (unknown: assume there is a step left).
 */
export function bossOffers(kid: KidProfile, node: NodeDef, easeSteps = Infinity): BossOffers {
  const np = kid.nodes[node.id];
  const none = { practice: false, skip: false, easeOffer: false };
  if (!np || np.skipped || (node.boss && bossPassed(kid, node))) return none;
  if (node.game) {
    const l = np.losses;
    return { practice: false, easeOffer: l === 2 && np.ease < easeSteps, skip: !!node.boss && l >= 4 && !node.final };
  }
  if (!node.boss) return none;
  const a = np.attemptsBelowPass ?? 0;
  return { practice: a >= 2, skip: a >= 3, easeOffer: false };
}

/** What a game boss's loss count triggers: 2 = offer an easier buddy, 3 = ease automatically, 4+ = skip too. */
export function gameLossStep(losses: number, final = false): 'none' | 'offer' | 'auto-ease' | 'skip' {
  if (losses >= 4) return final ? 'auto-ease' : 'skip';
  if (losses === 3) return 'auto-ease';
  if (losses === 2) return 'offer';
  return 'none';
}

// ---------- Recording runs ----------

export interface RunSummary {
  nodeId: string;
  results: ItemResult[];
  itemIds: string[];
  /** The activity is a game (outcome scoring, ease ladder). */
  game?: boolean;
  /** A game: how many ease steps the played item has (unknown: as many as it takes). */
  easeSteps?: number;
  /** At least one item needed 3 or more mistakes (brave try sticker). */
  braveTry?: boolean;
}

export interface RunOutcome {
  score: 1 | 2 | 3;
  golden: boolean;
  starsBefore: number;
  starsAfter: number;
  /** New stars added to the node (and the family jar). */
  gained: number;
  firstCompletion: boolean;
  /** Boss passed by this run (first time). */
  bossPassedNow: boolean;
  /** The world this run opened (the next world), if any. */
  worldOpened: WorldId | null;
  stickers: string[];
  trophies: string[];
  hats: HatId[];
  crown: 'gold' | 'silver' | null;
  crownNew: boolean;
  easeAuto: boolean;
  gardenFlower: boolean;
}

function plantFlower(kid: KidProfile, today: string, stickers: string[]): boolean {
  const day = (kid.days[today] ??= { minutes: 0, stars: 0 });
  if (day.planted) return false;
  day.planted = true;
  kid.garden += 1;
  if (kid.garden % 5 === 0) grantSticker(kid, `st-garden-${kid.garden / 5}`, today, stickers);
  return true;
}

function grantSticker(kid: KidProfile, id: string, today: string, out: string[], now = Date.now()) {
  if (kid.stickers[id]) return;
  kid.stickers[id] = now;
  const day = (kid.days[today] ??= { minutes: 0, stars: 0 });
  day.stickers = [...(day.stickers ?? []), id];
  out.push(id);
}

/** Trophies and wardrobe items the kid has newly earned. Mutates the kid. */
export function grantTrophiesAndHats(kid: KidProfile, reg: Registry, now = Date.now()): { trophies: string[]; hats: HatId[] } {
  const summary: TrophySummary = {
    band: kid.band,
    totalStars: totalStars(kid),
    goldCrowns: WORLDS.filter((w) => crownOf(kid, w.id, reg) === 'gold').length,
    stickers: kid.stickers,
    bots: kid.bots,
    bests: kid.bests,
    graduated: !!kid.graduated,
  };
  const trophies: string[] = [];
  for (const t of trophiesFor(kid.band)) {
    if (!kid.trophies[t.id] && t.test?.(summary)) {
      kid.trophies[t.id] = now;
      trophies.push(t.id);
    }
  }
  const hats: HatId[] = [];
  for (const h of hatsForStars(summary.totalStars)) {
    if (!kid.wardrobe.includes(h)) {
      kid.wardrobe.push(h);
      hats.push(h);
    }
  }
  if (kid.graduated && !kid.wardrobe.includes('crown')) {
    kid.wardrobe.push('crown');
    hats.push('crown');
  }
  return { trophies, hats };
}

/** Leitner box after a completion: 3 stars up one box, 2 keeps it (min 2), 1 back to box 1. */
export function nextBox(box: number, score: number): 1 | 2 | 3 | 4 | 5 {
  const b = score >= 3 ? box + 1 : score === 2 ? Math.max(box, 2) : 1;
  return Math.min(5, Math.max(1, b)) as 1 | 2 | 3 | 4 | 5;
}

/**
 * Records a finished node run on a kid (mutates it): stars (never down), golden, mastery days,
 * Leitner box, last items, game losses and ease, boss attempts, stickers, trophies and hats.
 */
export function recordRun(kid: KidProfile, run: RunSummary, reg: Registry, today = dayKey(), now = Date.now()): RunOutcome {
  const node = NODE_BY_ID.get(run.nodeId);
  const np = (kid.nodes[run.nodeId] ??= emptyNode(today));
  const wasPassed = node?.boss ? bossPassed(kid, node) : false;
  const nextWorld = node ? WORLDS[WORLDS.findIndex((w) => w.id === node.world) + 1] : undefined;
  const nextWasOpen = nextWorld ? worldUnlocked(kid, nextWorld.id, reg) : true;
  const crownBefore = node ? crownOf(kid, node.world, reg) : null;
  const firstCompletion = np.plays === 0 || !!np.tested;

  const outcome = run.game ? run.results[0]?.outcome : undefined;
  const score: 1 | 2 | 3 = outcome ? outcomeScore(outcome) : nodeScore(run.results.map((r) => r.score));
  const golden = !outcome && score === 3 && run.results.length > 0 && run.results.every((r) => r.golden);
  // A test-out star (paper plane) was never earned by playing, so the first real play earns the lot.
  // A skipped node keeps the stars it already paid into the jar, so a later pass adds only the rest.
  const starsBefore = np.tested ? 0 : np.stars;

  np.plays += 1;
  np.last = now;
  np.hintMax = run.results.reduce<number>((m, r) => Math.max(m, r.hintLevel), 0) as NodeProgress['hintMax'];
  np.lastItems = [...np.lastItems, ...run.itemIds].slice(-6);
  if (score > np.stars) np.stars = score;
  if (golden) np.golden = true;
  if (np.tested) delete np.tested; // a real completion replaces the paper-plane badge (the pass stays via `passed`)
  if (!outcome && run.results.length && run.results.every((r) => r.mistakes === 0 && r.hintLevel === 0)) np.clean = true;
  else delete np.clean;
  if (score >= 2 && !np.masteredDays.includes(today)) np.masteredDays = [...np.masteredDays, today].slice(-2);
  np.box = nextBox(np.box, score);
  np.due = addDays(today, LEITNER_DAYS[np.box - 1]);
  delete np.leaf;

  let easeAuto = false;
  if (outcome) {
    if (outcome === 'win') {
      np.won = [...new Set([...(np.won ?? []), ...run.itemIds])];
      np.losses = 0;
    } else if (outcome === 'loss') {
      np.losses += 1;
      // From the third loss in a row, every game (a boss or not) plays one step sleepier, while the
      // item has a step left (spec 5.3). Pip says so on the results card.
      if (np.losses >= 3 && np.ease < (run.easeSteps ?? Infinity)) {
        np.ease += 1;
        easeAuto = true;
      }
    }
  } else if (node?.boss) {
    if (score < bossPassMark(kid.band)) np.attemptsBelowPass = (np.attemptsBelowPass ?? 0) + 1;
    else delete np.attemptsBelowPass;
  }
  const starsAfter = np.stars;
  const gained = Math.max(0, starsAfter - starsBefore);
  if (np.skipped && node && bossPassed(kid, node)) delete np.skipped;

  const day = (kid.days[today] ??= { minutes: 0, stars: 0 });
  day.stars += gained;

  const stickers: string[] = [];
  if (firstCompletion || !kid.stickers[`s-${run.nodeId}`]) grantSticker(kid, `s-${run.nodeId}`, today, stickers, now);
  if (run.braveTry) grantSticker(kid, 'st-brave-try', today, stickers, now);
  const gardenFlower = plantFlower(kid, today, stickers);
  const { trophies, hats } = grantTrophiesAndHats(kid, reg, now);

  const bossPassedNow = !!node?.boss && !wasPassed && bossPassed(kid, node);
  // Passing a boss reached by the fast track marks the nodes skipped on the way as tested.
  if (bossPassedNow && node && np.fastTrack) {
    for (const n of activeNodes(node.world, kid.band, reg)) {
      const x = (kid.nodes[n.id] ??= emptyNode(today));
      if (!n.bonus && !n.boss && x.plays === 0 && x.stars === 0) {
        x.stars = 1;
        x.tested = true;
      }
    }
  }
  const worldOpened = nextWorld && !nextWasOpen && worldUnlocked(kid, nextWorld.id, reg) ? nextWorld.id : null;
  const crown = node ? crownOf(kid, node.world, reg) : null;
  return {
    score,
    golden,
    starsBefore,
    starsAfter,
    gained,
    firstCompletion,
    bossPassedNow,
    worldOpened,
    stickers,
    trophies,
    hats,
    crown,
    crownNew: crown !== crownBefore && !!crown,
    easeAuto,
    gardenFlower,
  };
}

/** Adds gained stars to the family jar; every 100 is a Family Party (sticker for every kid). Returns the party number. */
export function addFamilyStars(state: KidsState, gained: number, now = Date.now()): number | null {
  if (gained <= 0) return null;
  const before = Math.floor(state.family.stars / 100);
  state.family.stars += gained;
  const after = Math.floor(state.family.stars / 100);
  if (after <= before) return null;
  state.family.parties = after;
  for (const k of state.kids) k.stickers[`st-family-${after}`] ??= now;
  return after;
}

/**
 * Fast track: after the first two non-bonus nodes of a world are 3-starred with no mistakes,
 * Pip offers "Want to try the boss now?". Returns the boss to offer, or null.
 */
export function fastTrackOffer(kid: KidProfile, nodeId: string, reg: Registry): NodeDef | null {
  const node = NODE_BY_ID.get(nodeId);
  if (!node || node.boss || node.bonus) return null;
  const chain = activeNodes(node.world, kid.band, reg).filter((n) => !n.bonus);
  const boss = chain.find((n) => n.boss);
  if (!boss || chain.indexOf(node) !== 1 || chain.length < 4) return null;
  const firstTwo = chain.slice(0, 2).map((n) => kid.nodes[n.id]);
  if (!firstTwo.every((np) => np && np.stars === 3 && np.clean)) return null;
  if (nodeUnlocked(kid, boss.id, reg) || bossPassed(kid, boss)) return null;
  return boss;
}

export function acceptFastTrack(kid: KidProfile, bossId: string, today = dayKey()) {
  const np = (kid.nodes[bossId] ??= emptyNode(today));
  np.fastTrack = true;
}

/** "Skip for now": unlocks the next world like a pass, but gives no stars, crowns or graduation. */
export function skipNode(kid: KidProfile, nodeId: string, today = dayKey()) {
  const np = (kid.nodes[nodeId] ??= emptyNode(today));
  np.skipped = true;
}

/** "Want me to play sleepier?" accepted: one ease step now. */
export function acceptEase(kid: KidProfile, nodeId: string, today = dayKey()) {
  const np = (kid.nodes[nodeId] ??= emptyNode(today));
  np.ease += 1;
}

// ---------- Warm-ups (light spaced repetition) ----------

export function isFirstPlayDay(kid: KidProfile, today = dayKey()): boolean {
  const played = Object.entries(kid.days)
    .filter(([, d]) => d.planted)
    .map(([k]) => k)
    .sort();
  return !played.length || played[0] === today;
}

/** Completed, registered, visible nodes whose box is due, most overdue first. */
export function dueNodes(kid: KidProfile, reg: Registry, today = dayKey()): NodeDef[] {
  return NODES.filter((n) => visibleTo(n, kid.band) && reg.isRegistered(n.id))
    .filter((n) => {
      const np = kid.nodes[n.id];
      return !!np && np.plays > 0 && np.due <= today;
    })
    .sort((a, b) => (kid.nodes[a.id]!.due < kid.nodes[b.id]!.due ? -1 : kid.nodes[a.id]!.due > kid.nodes[b.id]!.due ? 1 : 0));
}

/** The warm-up nodes for today: none on the first play day or with fewer than 2 completed nodes. */
export function warmupPlan(kid: KidProfile, reg: Registry, today = dayKey()): NodeDef[] {
  if (isFirstPlayDay(kid, today)) return [];
  const completed = Object.values(kid.nodes).filter((np) => np.plays > 0).length;
  if (completed < 2) return [];
  return dueNodes(kid, reg, today).slice(0, BAND_TUNING[kid.band].warmupItems);
}

/** A warm-up item result: a pass moves the box up; a miss sends it to box 1 with a practice leaf. */
export function recordWarmup(kid: KidProfile, nodeId: string, score: number, itemId: string, today = dayKey()) {
  const np = kid.nodes[nodeId];
  if (!np) return;
  if (score >= 2) {
    np.box = Math.min(5, np.box + 1) as NodeProgress['box'];
    delete np.leaf;
  } else {
    np.box = 1;
    np.leaf = true;
  }
  np.due = addDays(today, LEITNER_DAYS[np.box - 1]);
  np.lastItems = [...np.lastItems, itemId].slice(-6);
}

// ---------- Placement ----------

/** An item passes placement at score 2 or more with hint level 1 or less. A world passes at 2 of 3. */
export const placementItemPass = (r: ItemResult) => r.score >= 2 && r.hintLevel <= 1;

export function placementWorldPassed(results: ItemResult[]): boolean {
  return results.filter(placementItemPass).length >= 2;
}

/** Whether a world's placement is already decided (2 passes or 2 misses) before all 3 items. */
export function placementDecided(results: ItemResult[]): boolean {
  const pass = results.filter(placementItemPass).length;
  return pass >= 2 || results.length - pass >= 2;
}

export interface PlacementState {
  entry: 1 | 3;
  world: number; // 1..8, the checkpoint being played
  tested: number[];
  restarted: boolean;
  done: boolean;
  /** Where the kid starts (1..8, or 9 when everything up to the cap is tested... capped at 8). */
  startWorld: number;
}

export function placementStart(start: 'moves' | 'games'): PlacementState {
  const entry = start === 'games' ? 3 : 1;
  return { entry, world: entry, tested: [], restarted: false, done: false, startWorld: entry };
}

/** Advances placement after a world's checkpoint. */
export function placementStep(s: PlacementState, passed: boolean, cap: number): PlacementState {
  const n: PlacementState = { ...s, tested: [...s.tested] };
  if (passed) {
    n.tested.push(s.world);
    if (s.world === 3 && s.entry === 3 && !s.restarted) n.tested.push(1, 2);
    if (s.world >= Math.min(cap, 8)) {
      n.done = true;
      n.startWorld = Math.min(8, s.world + 1);
    } else n.world = s.world + 1;
  } else if (s.entry === 3 && s.world === 3 && !s.restarted) {
    n.restarted = true;
    n.world = 1;
    n.tested = [];
  } else {
    n.done = true;
    n.startWorld = s.world;
  }
  n.tested = [...new Set(n.tested)].sort((a, b) => a - b);
  return n;
}

/**
 * Marks tested-out worlds: every visible node keeps a permanent pass (`passed`), and unplayed nodes
 * also get 1 star and the paper-plane badge (`tested`). No stickers. A node the kid already played
 * below the pass mark (a stuck boss) keeps its stars but is passed, so the next world really opens.
 * The puzzle rating only ever goes up here (a single-world challenge never lowers it).
 */
export function applyPlacement(kid: KidProfile, testedWorlds: number[], today = dayKey(), opts: { challenge?: boolean } = {}) {
  for (const wi of testedWorlds) {
    const w = WORLDS[wi - 1];
    if (!w) continue;
    for (const n of nodesOf(w.id)) {
      if (!visibleTo(n, kid.band)) continue;
      const np = (kid.nodes[n.id] ??= emptyNode(today));
      np.passed = true;
      if (np.plays === 0 && np.stars === 0) {
        np.stars = 1;
        np.tested = true;
      }
      if (np.skipped) delete np.skipped;
    }
  }
  if (testedWorlds.length) kid.puzzle.rating = Math.max(kid.puzzle.rating, placementRating(testedWorlds.length));
  if (!opts.challenge) kid.testedOut = testedWorlds.length;
  else kid.testedOut = Math.max(kid.testedOut ?? 0, testedWorlds.length);
  kid.placed = true;
}

/** The puzzle rating a kid who tested out of `worlds` worlds starts from. */
export const placementRating = (worlds: number) => (worlds > 0 ? Math.min(850, 600 + 40 * worlds) : 600);

/** Takes back the test-out passes from world `rank` on; played nodes keep their stars. */
export function unplaceFrom(kid: KidProfile, rank: number) {
  for (const w of WORLDS.slice(rank - 1))
    for (const n of nodesOf(w.id)) {
      const np = kid.nodes[n.id];
      if (!np) continue;
      if (np.plays === 0) delete kid.nodes[n.id];
      else delete np.passed;
    }
}

/**
 * Grown-ups "Starting rank": the worlds below `rank` are tested out. From `rank` on, placement
 * passes are taken back so a lower start locks the later worlds again; played nodes keep their stars.
 * Before the first puzzle the puzzle rating follows the new start, down as well as up.
 */
export function startAtRank(kid: KidProfile, rank: number, today = dayKey(), now = Date.now()) {
  unplaceFrom(kid, rank);
  if (kid.puzzle.attempts === 0) kid.puzzle.rating = 600;
  applyPlacement(kid, Array.from({ length: rank - 1 }, (_, i) => i + 1), today);
  kid.startAt = { t: now, rank };
}

// ---------- Grown-up report ----------

export function canDo(kid: KidProfile, reg: Registry): { skill: SkillId; level: 'full' | 'half' | 'none' }[] {
  const map = new Map<SkillId, number[]>();
  for (const n of NODES) {
    if (!visibleTo(n, kid.band) || !reg.isRegistered(n.id) || n.bonus) continue;
    for (const s of n.skills) {
      const arr = map.get(s) ?? [];
      arr.push(kid.nodes[n.id]?.skipped ? 0 : kid.nodes[n.id]?.stars ?? 0);
      map.set(s, arr);
    }
  }
  return [...map.entries()].map(([skill, stars]) => ({ skill, level: stars.every((s) => s >= 2) ? 'full' : stars.some((s) => s >= 1) ? 'half' : 'none' }));
}

export function neededHelp(kid: KidProfile): NodeDef[] {
  return NODES.filter((n) => (kid.nodes[n.id]?.hintMax ?? 0) >= 3);
}

export function minutesLast7(kid: KidProfile, today = dayKey()): { day: string; minutes: number }[] {
  const out: { day: string; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    out.push({ day: d, minutes: Math.round(kid.days[d]?.minutes ?? 0) });
  }
  return out;
}

export const daysSince = (a: string, b: string) => daysBetween(a, b);
