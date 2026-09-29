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

/** What a Kids history entry keeps (so it survives a reload): the route it was opened from, how many
 *  Kids entries deep it is, and how deep the nearest picker below it is. */
interface EntryState {
  kidsFrom?: string;
  kidsDepth?: number;
  kidsPicker?: number;
}

function entry(): EntryState {
  try {
    return (history.state as EntryState | null) ?? {};
  } catch {
    return {};
  }
}

/** The route this history entry was opened from. */
const cameFrom = () => entry().kidsFrom;

const isPicker = (route: string) => route === 'kids' || route === 'kids/players';

const to = (r: string, replace = false) => {
  // Asking for the screen already showing (a double tap, a pill for the current screen) changes nothing.
  if (!replace && currentRoute() === routeOf(r)) return;
  // A new entry remembers where it came from; a replaced one keeps what the old entry knew.
  const prev = entry();
  const here = currentRoute();
  const from = replace ? prev.kidsFrom : here;
  const depth = (prev.kidsDepth ?? 0) + (replace ? 0 : 1);
  const below = prev.kidsPicker != null && prev.kidsPicker < depth ? prev.kidsPicker : undefined;
  const picker = isPicker(routeOf(r)) ? depth : !replace && isPicker(here) ? prev.kidsDepth ?? 0 : below;
  navigate(routeOf(r), { replace });
  try {
    history.replaceState({ ...(history.state as object | null), ...(from && { kidsFrom: from }), kidsDepth: depth, ...(picker != null && { kidsPicker: picker }) }, '');
  } catch {
    /* sandboxed frame: no history to annotate */
  }
};

/** True when this history entry was opened from the screen `r` (for example the picker from the map). */
export const cameFromScreen = (r: string) => cameFrom() === routeOf(r);

let leftAt = 0;
/**
 * A screen's own back or close button. When the entry before this one is `r` (or one of `also`, or any
 * Kids screen with `anyFrom`), it steps back in the history, so the browser's Back never lands on a
 * screen the kid just closed (an activity that would start over, say). Otherwise this entry is replaced
 * by `r`. A second tap while the first is still on its way does nothing, so it cannot step back twice.
 */
function up(r: string, also: string[] = [], anyFrom = false) {
  const now = Date.now();
  if (now - leftAt < 350) return;
  leftAt = now;
  const from = cameFrom();
  if (from && (anyFrom || [r, ...also].some((x) => from === routeOf(x)))) {
    try {
      history.back();
      return;
    } catch {
      /* fall through */
    }
  }
  to(r, true);
}

const WORLD_ROUTES = Array.from({ length: 8 }, (_, i) => `world/w${i + 1}`);

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
  grownups: (kidId?: string, replace = false) => to(kidId ? `grownups/${kidId}` : 'grownups', replace),
  graduate: () => to('graduate'),
  certificate: (kidId: string) => to(`certificate/${kidId}`),
  /** Back or close to the map, the playground list, the picker or Grown-ups (see `up`). */
  upToMap: () => up('map'),
  upToPlayground: () => up('playground'),
  upToPicker: () => up('', ['players']),
  upToGrownups: (kidId: string) => up(`grownups/${kidId}`, ['grownups']),
  /** A back arrow with no one parent (Grown-ups): the screen that opened this one, else `r`. */
  back: (r: string) => up(r, [], true),
  /** The player's close: back to the calm screen it was opened from (the map or a World screen), else the map. */
  close: () => up('map', WORLD_ROUTES),
  /** "Bye for now": back to the picker this visit started from (so Back never lands on a screen that
   *  needs the kid who just left), else the picker in this entry's place. */
  backToPicker: () => {
    const s = entry();
    const steps = s.kidsPicker != null && s.kidsDepth != null ? s.kidsDepth - s.kidsPicker : 0;
    if (steps > 0) {
      try {
        history.go(-steps);
        return;
      } catch {
        /* fall through */
      }
    }
    to('', true);
  },
};
