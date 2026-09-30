// Settings that sync field by field. Each field of a settings group (the grown-up's settings, a
// kid's name, avatar, age group and settings) has its own stamp (clock.ts): the merge keeps, per
// field, the value with the later stamp, so a change to one field is never undone by an unrelated
// change to another on a device that had not heard of it yet. A field one side does not have is
// kept (which also carries fields a newer app version added through this one), and equal stamps
// take the greater stable JSON, so the merge gives the same result whichever side is `a`.
//
// Older app versions merge settings as one object by settingsAt and rebuild kids without fields
// they do not know, so stamps also travel in a mirror part of their own (StampMirror, registered
// like the tally parts in index.ts): older versions pass it on untouched. It holds the values the
// stamps were written for, so a reader can tell which fields an older version changed since (those
// differ from the mirror's values) and stamp those with the copy's settingsAt, as the old rule did.
import { nextStamp } from './clock';

export type Stamps = Record<string, number>;
export type Values = Record<string, unknown>;

/** A group of fields with their stamps. A field without a stamp counts as stamp 0. */
export interface Fields {
  values: Values;
  stamps: Stamps;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** JSON with sorted keys, to compare values regardless of key order. */
export function stableJson(v: unknown): string {
  // (undefined has no JSON: a string of its own keeps the comparison of two values total)
  return JSON.stringify(v, (_k, val) => (isObj(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => (a < b ? -1 : 1))) : val)) ?? '~';
}

export const maxStamp = (s: Stamps | undefined): number => Object.values(s ?? {}).reduce((m, t) => Math.max(m, t), 0);

/** Stamps from stored or synced data: finite positive numbers, for the given keys only. Undefined when there are none. */
export function readStamps(x: unknown, keys?: Iterable<string>): Stamps | undefined {
  if (!isObj(x)) return undefined;
  const allowed = keys ? new Set(keys) : null;
  const out: Stamps = {};
  for (const [k, t] of Object.entries(x)) if (typeof t === 'number' && Number.isFinite(t) && t > 0 && (!allowed || allowed.has(k))) out[k] = t;
  return Object.keys(out).length ? out : undefined;
}

/** Data from before stamps existed: every field counts as changed when the whole group was (settingsAt). */
export function legacyStamps(keys: Iterable<string>, settingsAt: number | undefined): Stamps {
  const out: Stamps = {};
  if (settingsAt && settingsAt > 0) for (const k of keys) out[k] = settingsAt;
  return out;
}

/** Merges two groups: the later stamp wins per field, a field only one side has is kept. */
export function mergeFields(a: Fields, b: Fields): Fields {
  const values: Values = {};
  const stamps: Stamps = {};
  for (const k of new Set([...Object.keys(a.values), ...Object.keys(b.values)])) {
    const inA = k in a.values;
    const inB = k in b.values;
    const ta = inA ? (a.stamps[k] ?? 0) : -1;
    const tb = inB ? (b.stamps[k] ?? 0) : -1;
    const fromA = ta !== tb ? ta > tb : stableJson(a.values[k]) >= stableJson(b.values[k]);
    values[k] = (fromA ? a : b).values[k];
    const t = Math.max(ta, tb);
    if (t > 0) stamps[k] = t;
  }
  return { values, stamps };
}

/**
 * Stamps a local change: the fields whose value differs between `before` and `after` get one new
 * stamp (past the stamps they had), and the rest keep theirs. Null when nothing changed.
 * `stamps` are the group's current stamps (legacyStamps for data that has none yet).
 */
export function stampChanges(before: Values, after: Values, stamps: Stamps): { stamps: Stamps; at: number; stamp: number } | null {
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => stableJson(before[k]) !== stableJson(after[k]));
  if (!changed.length) return null;
  const stamp = nextStamp(changed.reduce((m, k) => Math.max(m, stamps[k] ?? 0), 0));
  const out: Stamps = {};
  for (const [k, t] of Object.entries(stamps)) if (k in after) out[k] = t;
  for (const k of changed) if (k in after) out[k] = stamp;
  return { stamps: out, at: maxStamp(out), stamp };
}

// ---------- The mirror ----------

/** What older app versions pass through untouched: a group's stamps, and the values they were written for. */
export interface StampMirror {
  v: 1;
  /** The highest stamp (the group's settingsAt when this was written). */
  at: number;
  stamps: Stamps;
  base: Values;
}

export const mirrorOf = (f: Fields): StampMirror => ({ v: 1, at: maxStamp(f.stamps), stamps: f.stamps, base: f.values });

export function readMirror(x: unknown): StampMirror | undefined {
  if (!isObj(x) || x.v !== 1 || !isObj(x.base)) return undefined;
  const stamps = readStamps(x.stamps) ?? {};
  return { v: 1, at: maxStamp(stamps), stamps, base: x.base };
}

/**
 * The stamps of a group read from the synced copy: from the mirror for the fields whose value is
 * still the one the mirror was written for, and settingsAt (the whole group changed then, as older
 * versions understand it) for a field an older version changed since. Without a mirror the copy
 * comes from an older version altogether: every field counts as changed at settingsAt.
 */
export function reconcile(values: Values, settingsAt: number | undefined, mirror: StampMirror | undefined): Stamps {
  if (!mirror) return legacyStamps(Object.keys(values), settingsAt);
  const out: Stamps = {};
  for (const [k, v] of Object.entries(values)) {
    const t = k in mirror.base && stableJson(mirror.base[k]) === stableJson(v) ? (mirror.stamps[k] ?? 0) : (settingsAt ?? 0);
    if (t > 0) out[k] = t;
  }
  return out;
}
