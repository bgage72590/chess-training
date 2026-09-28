// "Newly opened since the map was last drawn", for the map's unlock animation. Kept in memory and
// sessionStorage (one tab), never in the kids store, so a fresh launch starts from what is open now.
import { WORLDS, nodesOf } from '../curriculum/worlds';
import type { KidProfile } from '../store/kidsStore';
import { nodeUnlocked, visibleTo, worldUnlocked, type Registry } from '../store/progress';

const KEY = 'tempo.kids.opened';
/** More than this at once (a test-out, a grown-up opening everything) is not celebrated node by node. */
export const MAX_FRESH = 4;

const mem = new Map<string, Set<string>>();

/** Ids of every world and node the kid can play now. */
export function openIds(kid: KidProfile, reg: Registry): string[] {
  const ids: string[] = [];
  for (const w of WORLDS) {
    if (!worldUnlocked(kid, w.id, reg)) continue;
    ids.push(w.id);
    for (const n of nodesOf(w.id)) if (visibleTo(n, kid.band) && reg.isRegistered(n.id) && nodeUnlocked(kid, n.id, reg)) ids.push(n.id);
  }
  return ids;
}

function read(kidId: string): Set<string> | undefined {
  const hit = mem.get(kidId);
  if (hit) return hit;
  try {
    const raw = sessionStorage.getItem(`${KEY}.${kidId}`);
    if (raw) {
      const set = new Set<string>(JSON.parse(raw) as string[]);
      mem.set(kidId, set);
      return set;
    }
  } catch {
    /* storage blocked or bad data: memory only */
  }
  return undefined;
}

/** Ids in `open` not seen open before. The first look at a kid only records a baseline, so it finds none. */
export function newlyOpened(kidId: string, open: string[]): string[] {
  const seen = read(kidId);
  if (!seen) return [];
  const fresh = open.filter((id) => !seen.has(id));
  return fresh.length > MAX_FRESH ? [] : fresh;
}

/** Records what is open now as seen. */
export function markOpened(kidId: string, open: string[]) {
  const set = new Set(read(kidId) ?? []);
  for (const id of open) set.add(id);
  mem.set(kidId, set);
  try {
    sessionStorage.setItem(`${KEY}.${kidId}`, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

/** Test helper: forgets everything seen. */
export function resetOpened() {
  mem.clear();
}
