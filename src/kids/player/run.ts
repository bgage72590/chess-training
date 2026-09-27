// Item selection for a run: fixed order, tiered shuffle with adaptive tiers, game sets, warm-ups.
// Pure (spec 11.3 "Run rules" and 3.3).
import type { AgeBand, ItemMeta, LevelSet, Tier } from '../activities/types';
import { visibleTo } from '../curriculum/tuning';
import { pick } from '../lib/rng';

export interface RunItem {
  setId: string;
  id: string;
  index: number;
  item: ItemMeta & Record<string, unknown>;
  tier: Tier;
}

export const itemIdOf = (set: LevelSet, index: number) => set.items[index].id ?? `${set.id}#${index}`;

export function visibleItems(set: LevelSet, band: AgeBand): RunItem[] {
  return set.items
    .map((item, index) => ({ setId: set.id, id: itemIdOf(set, index), index, item: item as ItemMeta & Record<string, unknown>, tier: ((item as ItemMeta).tier ?? 1) as Tier }))
    .filter((r) => visibleTo(r.item, band));
}

export function runLength(set: LevelSet, band: AgeBand, itemsPerRun: number, game = false): number {
  const n = game ? 1 : set.perRun?.[band] ?? itemsPerRun;
  return Math.max(0, Math.min(n, visibleItems(set, band).length));
}

/** Chooses items one at a time so tiers can adapt to how the kid is doing. */
export class RunPicker {
  readonly total: number;
  private used = new Set<string>();
  /** Items swapped out by "Easier one" (used, but not counted as played). */
  private swapped = new Set<string>();
  private tier: Tier;
  private threeStreak = 0;
  private readonly pool: RunItem[];

  constructor(
    private readonly set: LevelSet,
    band: AgeBand,
    private readonly opts: { itemsPerRun: number; startTier: Tier; rng: () => number; lastItems?: string[]; game?: boolean; won?: string[] },
  ) {
    this.pool = visibleItems(set, band);
    this.total = runLength(set, band, opts.itemsPerRun, opts.game);
    this.tier = opts.startTier;
  }

  get count() {
    return this.used.size - this.swapped.size;
  }

  get currentTier() {
    return this.tier;
  }

  private free() {
    return this.pool.filter((r) => !this.used.has(r.id));
  }

  /** The next item, or null when the run is complete. */
  next(): RunItem | null {
    if (this.count >= this.total) return null;
    const free = this.free();
    if (!free.length) return null;
    let chosen: RunItem;
    if (this.opts.game) {
      chosen = free.find((r) => !this.opts.won?.includes(r.id)) ?? free[free.length - 1];
    } else if ((this.set.order ?? 'tiered-shuffle') === 'fixed') {
      chosen = free[0];
    } else {
      chosen = this.pickNear(free, this.tier);
    }
    this.used.add(chosen.id);
    return chosen;
  }

  private pickNear(free: RunItem[], tier: Tier): RunItem {
    const tiers = [...new Set(free.map((r) => r.tier))].sort((a, b) => Math.abs(a - tier) - Math.abs(b - tier) || a - b);
    const inTier = free.filter((r) => r.tier === tiers[0]);
    const fresh = inTier.filter((r) => !this.opts.lastItems?.includes(r.id));
    return pick(this.opts.rng, fresh.length ? fresh : inTier);
  }

  /** Adapts the tier: down after a 1, up after two 3s in a row. */
  report(score: number) {
    if (score <= 1) {
      this.tier = Math.max(1, this.tier - 1) as Tier;
      this.threeStreak = 0;
    } else if (score >= 3) {
      this.threeStreak++;
      if (this.threeStreak >= 2) {
        this.tier = Math.min(3, this.tier + 1) as Tier;
        this.threeStreak = 0;
      }
    } else this.threeStreak = 0;
  }

  /** "Easier one": an unused item one tier lower than `current` (null if none). */
  easier(current: RunItem): RunItem | null {
    if (current.tier <= 1) return null;
    const cands = this.free().filter((r) => r.tier < current.tier);
    if (!cands.length) return null;
    const c = this.pickNear(cands, (current.tier - 1) as Tier);
    this.used.add(c.id);
    this.swapped.add(current.id);
    return c;
  }

  /** "Super Star": an unused item with a superTune, or a tier-3 item (null if none). */
  superItem(): RunItem | null {
    const cands = this.free().filter((r) => r.item.superTune || r.tier === 3);
    return cands.length ? pick(this.opts.rng, cands) : null;
  }

  /** Plays a specific item next (Super Star). */
  take(r: RunItem): RunItem | null {
    if (this.count >= this.total) return null;
    this.used.add(r.id);
    return r;
  }
}

/** A warm-up item: one from the node's set whose id is not in lastItems (seeded). */
export function pickWarmupItem(set: LevelSet, band: AgeBand, lastItems: string[], rng: () => number): RunItem | null {
  const vis = visibleItems(set, band);
  if (!vis.length) return null;
  const fresh = vis.filter((r) => !lastItems.includes(r.id));
  return pick(rng, fresh.length ? fresh : vis);
}
