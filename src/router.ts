// Minimal hash router. Routes look like "learn", "lesson/mate-back-rank", "puzzles/rush".
// Falls back to in-memory navigation when the host frame blocks history access.
import { useSyncExternalStore } from 'react';

const parse = (hash: string) => hash.replace(/^#\/?/, '') || 'home';

let route = typeof location !== 'undefined' ? parse(location.hash) : 'home';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  const sync = () => {
    const next = parse(location.hash);
    if (next !== route) {
      route = next;
      emit();
      scrollToTop();
    }
  };
  window.addEventListener('hashchange', sync);
  window.addEventListener('popstate', sync);
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  route = to || 'home';
  try {
    const url = '#/' + route;
    if (opts.replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
  } catch {
    /* sandboxed frame: keep in-memory route */
  }
  emit();
  scrollToTop();
}

/** Scrolls the page to the top; also for a new view inside the same route (a lesson step, a game). */
export function scrollToTop() {
  try {
    window.scrollTo({ top: 0 });
    document.querySelector('.main')?.scrollTo({ top: 0 });
  } catch {
    /* ignore */
  }
}

export function useRoute(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => route,
    () => route,
  );
}

/** Splits "lesson/abc" into ["lesson", "abc"]. */
export function routeParts(r: string): [string, string | undefined] {
  const i = r.indexOf('/');
  return i < 0 ? [r, undefined] : [r.slice(0, i), decodeURIComponent(r.slice(i + 1))];
}
