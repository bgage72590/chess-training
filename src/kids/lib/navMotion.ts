// Which way a Kids screen change should move: forward slides in from the right, back from the left,
// an activity dives in and the map surfaces again. Pure, so it is easy to test.
import type { KidsRoute } from '../routes';

export type NavDir = 'forward' | 'back' | 'dive' | 'surface';

/** What KidsApp needs to draw a screen: its identity and how it arrives (null on the first paint). */
export interface NavStep {
  key: string;
  dir: NavDir | null;
}

/** How far into the app a screen sits: the picker first, an activity last. */
export function routeDepth(r: KidsRoute): number {
  switch (r.screen) {
    case 'picker':
      return 0;
    case 'new':
    case 'grownups':
    case 'map':
      return 1;
    case 'play':
      return 3;
    case 'playground':
      return r.entry ? 3 : 2;
    default:
      return 2;
  }
}

/** One key per screen. The same key means the same screen, so nothing moves (a sticker book tab, say). */
export function screenKey(r: KidsRoute): string {
  switch (r.screen) {
    case 'play':
      return `play/${r.node}`;
    case 'playground':
      return `playground/${r.entry ?? ''}`;
    default:
      return r.screen;
  }
}

/** `back`: the new screen is the one before the current one in the visited trail (browser back). */
export function navDirection(prev: KidsRoute, next: KidsRoute, back = false): NavDir {
  const a = routeDepth(prev);
  const b = routeDepth(next);
  if (b === 3) return 'dive';
  if (a === 3) return 'surface';
  if (b !== a) return b > a ? 'forward' : 'back';
  // Same depth (Stickers to Playground, say): the trail says whether this is a step back.
  return back ? 'back' : 'forward';
}

const TRAIL_MAX = 24;

/**
 * Follows the screens shown, so KidsApp can tell how a new one arrives without the router's help.
 * `step` gives the same answer when asked again for the screen already shown, which keeps a
 * repeated render (or Strict Mode's second one) from changing the answer.
 */
export class RouteTrail {
  private trail: string[] = [];
  private last: { key: string; route: KidsRoute; step: NavStep } | null = null;

  step(next: KidsRoute): NavStep {
    const key = screenKey(next);
    const last = this.last;
    if (last && last.key === key) return last.step;
    const back = this.trail.length > 1 && this.trail[this.trail.length - 2] === key;
    if (back) this.trail.pop();
    else this.trail.push(key);
    if (this.trail.length > TRAIL_MAX) this.trail.shift();
    const step: NavStep = { key, dir: last ? navDirection(last.route, next, back) : null };
    this.last = { key, route: next, step };
    return step;
  }
}
