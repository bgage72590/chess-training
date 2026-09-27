// Kids routes (all under #/kids/...). Browser back works; the player guards leaving mid-item.
import { navigate } from '../router';
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

export function parseKidsRoute(route: string): KidsRoute {
  const parts = route.split('/').slice(1).map((p) => decodeURIComponent(p));
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
      return { screen: 'placement', world: b ? Number(b.replace(/^w/, '')) : undefined };
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

const to = (r: string, replace = false) => navigate(r ? `kids/${r}` : 'kids', { replace });

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
  stickers: (tab?: 'trophies' | 'wardrobe' | 'scene') => to(tab ? `stickers/${tab}` : 'stickers'),
  grownups: (kidId?: string) => to(kidId ? `grownups/${kidId}` : 'grownups'),
  graduate: () => to('graduate'),
  certificate: (kidId: string) => to(`certificate/${kidId}`),
};
