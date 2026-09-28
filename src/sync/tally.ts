// Counters that add up across devices. A copy keeps its totals where the app reads them, plus a
// tally: what each device added (device id -> counts) and, under BASE, what no device tally
// explains (totals from before tallies existed). Totals are the sum of the tally. A merge takes
// each entry's larger counts (a device's own counts only grow) and adds them up, so work done on
// two devices between syncs adds up and merging a copy with itself changes nothing.
// A copy without a tally (older data) only ever raises a total to its own. Older app versions
// drop or keep stale tallies inside the parts they merge, but pass unknown parts on untouched,
// so each tally is also synced in a part of its own (see index.ts) and folded back in: a device's
// counts are then never behind a total that includes them, and nothing is counted twice.

export type Counts = Record<string, number>;
export type Tally = Record<string, Counts>;

/** The tally entry for counts no device tally explains. Device ids never take this name. */
export const BASE = 'base';

/** Counters may be fractional (kids' minutes): two decimals keep sums exact across merges. */
const round = (x: number) => Math.round(x * 100) / 100;

function sum(t: Tally, skip?: string): Counts {
  const out: Counts = {};
  for (const [dev, c] of Object.entries(t)) if (dev !== skip) for (const [k, v] of Object.entries(c)) out[k] = round((out[k] ?? 0) + v);
  return out;
}

const nonZero = (c: Counts): Counts => Object.fromEntries(Object.entries(c).filter(([, v]) => v));

/** Each entry's larger counts from two tallies. */
export function maxTally(a: Tally | undefined, b: Tally | undefined): Tally | undefined {
  if (!a || !b) return a ?? b;
  const out: Tally = { ...a };
  for (const [dev, c] of Object.entries(b)) {
    const m = { ...out[dev] };
    for (const [k, v] of Object.entries(c)) m[k] = Math.max(m[k] ?? 0, v);
    out[dev] = m;
  }
  return out;
}

/** A tally from synced or stored data, keeping only finite counts. */
export function readTally(x: unknown): Tally | undefined {
  const isObj = (o: unknown): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o);
  if (!isObj(x)) return undefined;
  const out: Tally = {};
  for (const [dev, c] of Object.entries(x)) {
    const counts = isObj(c) ? Object.fromEntries(Object.entries(c).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))) : {};
    if (Object.keys(counts).length) out[dev] = counts as Counts;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Adds to this device's tally what grew from `before` to `after` (a local change, never a merge). */
export function tallyGrowth(tally: Tally | undefined, device: string, before: Counts, after: Counts): Tally | undefined {
  let mine: Counts | undefined;
  for (const [k, v] of Object.entries(after)) {
    const grew = round(v - (before[k] ?? 0));
    if (grew <= 0) continue;
    mine ??= { ...tally?.[device] };
    mine[k] = round((mine[k] ?? 0) + grew);
  }
  if (!mine) return tally;
  // The first tallied change: everything before it becomes the base.
  const base = tally ? {} : nonZero(before);
  return { ...(Object.keys(base).length ? { [BASE]: base } : {}), ...tally, [device]: mine };
}

/** Merges two copies' totals and tallies. */
export function mergeTallied(a: Counts, ta: Tally | undefined, b: Counts, tb: Tally | undefined): { counts: Counts; tally?: Tally } {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  if (!ta && !tb) return { counts: Object.fromEntries([...keys].map((k) => [k, Math.max(a[k] ?? 0, b[k] ?? 0)])) };
  const tally = { ...maxTally(ta, tb) };
  const [all, devices] = [sum(tally), sum(tally, BASE)];
  const counts: Counts = {};
  const base: Counts = {};
  for (const k of new Set([...keys, ...Object.keys(all)])) {
    counts[k] = round(Math.max(all[k] ?? 0, a[k] ?? 0, b[k] ?? 0));
    const rest = round(counts[k] - (devices[k] ?? 0));
    if (rest) base[k] = rest;
  }
  delete tally[BASE];
  return { counts, tally: Object.keys(base).length ? { [BASE]: base, ...tally } : tally };
}

/** Keeps only the counts whose key passes `keep` (e.g. days after a reset). */
export function filterTally(t: Tally | undefined, keep: (key: string) => boolean): Tally | undefined {
  if (!t) return undefined;
  const out: Tally = {};
  for (const [dev, c] of Object.entries(t)) {
    const kept = Object.fromEntries(Object.entries(c).filter(([k]) => keep(k)));
    if (Object.keys(kept).length) out[dev] = kept;
  }
  return Object.keys(out).length ? out : undefined;
}
