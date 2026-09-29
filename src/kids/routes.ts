// Kids routes (all under #/kids/...). Browser back works; the player guards leaving mid-item.
import { currentRoute, navigate } from '../router';
import type { WorldId } from './curriculum/worlds';

export type KidsRoute =
  | { screen: 'picker'; explicit?: boolean }
  | { screen: 'new' }
  | { screen: 'placement'; world?: number }
  | { screen: 'map' }
  | { screen: 'world'; world: WorldId }
  | { screen: 'play'; node: string }
  | { screen: 'warmup' }
  | { screen: 'playground'; entry?: string }
  | { screen: 'stickers'; tab: 'stickers' | 'trophies' | 'wardrobe' | 'scene' }
  | { screen: 'grownups'; kid?: string }
  | { screen: 'graduate' }
  | { screen: 'certificate'; kid: string };

/** A hand-typed address can hold a stray "%": keep the text as it is instead of throwing. */
const safeDecode = (p: string) => {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
};

export function parseKidsRoute(route: string): KidsRoute {
  const parts = route.split('/').slice(1).map(safeDecode);
  const [a, b] = parts;
  switch (a) {
    case undefined:
    case '':
      return { screen: 'picker' };
    case 'players':
      return { screen: 'picker', explicit: true };
    case 'new':
      return { screen: 'new' };
    case 'placement':
      return { screen: 'placement', world: b && /^w?[1-8]$/.test(b) ? Number(b.replace(/^w/, '')) : undefined };
    case 'map':
      return { screen: 'map' };
    case 'world':
      return /^w[1-8]$/.test(b ?? '') ? { screen: 'world', world: b as WorldId } : { screen: 'map' };
    case 'play':
      return b ? { screen: 'play', node: b } : { screen: 'map' };
    case 'warmup':
      return { screen: 'warmup' };
    case 'playground':
      return { screen: 'playground', entry: b };
    case 'stickers':
      return { screen: 'stickers', tab: b === 'trophies' || b === 'wardrobe' || b === 'scene' ? b : 'stickers' };
    case 'grownups':
      return { screen: 'grownups', kid: b };
    case 'graduate':
      return { screen: 'graduate' };
    case 'certificate':
      return b ? { screen: 'certificate', kid: b } : { screen: 'picker' };
    default:
      return { screen: 'picker' };
  }
}

const routeOf = (r: string) => (r ? `kids/${r}` : 'kids');

/** The route this history entry was opened from (kept in the entry, so it survives a reload). */
function cameFrom(): string | undefined {
  try {
    return (history.state as { kidsFrom?: string } | null)?.kidsFrom;
  } catch {
    return undefined;
  }
}

const to = (r: string, replace = false) => {
  // Asking for the screen already showing (a double tap, a pill for the current screen) changes nothing.
  if (!replace && currentRoute() === routeOf(r)) return;
  // A new entry remembers where it came from; a replaced one keeps what the old entry knew.
  const from = replace ? cameFrom() : currentRoute();
  navigate(routeOf(r), { replace });
  if (!from) return;
  try {
    history.replaceState({ ...(history.state as object | null), kidsFrom: from }, '');
  } catch {
    /* sandboxed frame: no history to annotate */
  }
};

let leftAt = 0;
/**
 * A screen's own back or close button. When the entry before this one is `r`, it steps back in the
 * history, so the browser's Back never lands on a screen the kid just closed (an activity that would
 * start over, say). Otherwise this entry is replaced by `r`. A second tap while the first is still on
 * its way does nothing, so it cannot step back twice.
 */
function up(r: string) {
  const now = Date.now();
  if (now - leftAt < 350) return;
  leftAt = now;
  if (cameFrom() === routeOf(r)) {
    try {
      history.back();
      return;
    } catch {
      /* fall through */
    }
  }
  to(r, true);
}

export const go = {
  picker: (replace = false) => to('', replace),
  /** The picker even on a locked device (which otherwise lands on the active kid's map). */
  players: () => to('players'),
  newKid: () => to('new'),
  placement: (world?: number, replace = false) => to(world ? `placement/w${world}` : 'placement', replace),
  map: (replace = false) => to('map', replace),
  world: (id: WorldId) => to(`world/${id}`),
  play: (nodeId: string, replace = false) => to(`play/${nodeId}`, replace),
  warmup: () => to('warmup'),
  playground: (id?: string) => to(id ? `playground/${id}` : 'playground'),
  stickers: (tab?: 'trophies' | 'wardrobe' | 'scene', replace = false) => to(tab ? `stickers/${tab}` : 'stickers', replace),
  grownups: (kidId?: string) => to(kidId ? `grownups/${kidId}` : 'grownups'),
  graduate: () => to('graduate'),
  certificate: (kidId: string) => to(`certificate/${kidId}`),
  /** Back or close to the map, the playground list or the picker (see `up`). */
  upToMap: () => up('map'),
  upToPlayground: () => up('playground'),
};
