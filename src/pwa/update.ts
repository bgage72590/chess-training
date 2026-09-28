// Keeping an open app current. Opening the app loads the newest version (the service worker asks
// the network for the page first). An app left open, like an installed app brought back from the
// background, checks for a new version whenever it is shown again. When a new version takes over
// a page that is older, the page reloads at the next change of screen, never in the middle of a
// game or a puzzle, or at once from the notice.
import { toast } from '../lib/toast';
import { onNextRouteChange } from '../router';

/** Checks for a new version at most this often (ms). */
const CHECK_GAP = 60_000;
const RELOADED_KEY = 'tempo.reloadedAt';

let pending = false;

/** A newer version took over this page: reload at the next change of screen, or now from the notice. */
export function updateTookOver() {
  if (pending) return;
  pending = true;
  onNextRouteChange(() => location.reload());
  // Kids mode only reloads at the next screen: its notices are for the kids.
  if (location.hash.startsWith('#/kids')) return;
  // A game in progress is not saved, so reloading from the notice ends it.
  const game = location.hash.startsWith('#/play');
  toast(
    {
      title: 'A new version of Tempo is ready',
      body: game ? 'It opens when you leave this game.' : 'It opens when you go to another screen.',
      icon: 'refresh',
      action: { label: game ? 'Reload now (ends the game)' : 'Reload now', run: () => location.reload() },
      closable: true,
    },
    20_000,
  );
}

/** Resolves once `w` has finished activating: from then on the caches hold only its version. An
 *  activating worker always ends 'activated' or 'redundant', however long its activation takes. */
function activated(w: ServiceWorker | null): Promise<void> {
  return new Promise((done) => {
    const settled = () => !w || w.state === 'activated' || w.state === 'redundant';
    if (settled()) return done();
    const check = () => {
      if (!settled()) return;
      w!.removeEventListener('statechange', check);
      done();
    };
    w!.addEventListener('statechange', check);
  });
}

/** This page's own scripts and style sheets. */
function pageFiles(script: string): string[] {
  const loaded = [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[rel="stylesheet"][href]')].map((e) => ('src' in e ? e.src : e.href));
  return [...new Set([script, ...loaded])].filter((u) => new URL(u, location.href).origin === location.origin);
}

/**
 * Whether this page belongs to the version the service worker now serves. The worker's activation
 * removes the other versions' caches, so after it every file of a current page is cached, and an
 * older page misses at least one (its scripts and style sheets are named by their content).
 */
async function pageIsCurrent(sw: ServiceWorkerContainer, script: string): Promise<boolean> {
  await activated(sw.controller);
  try {
    return (await Promise.all(pageFiles(script).map((f) => caches.match(f)))).every(Boolean);
  } catch {
    return true;
  }
}

/** Watches `reg` for new versions; `script` is this page's main script. */
export function watchForUpdates(reg: ServiceWorkerRegistration, script = import.meta.url, sw: ServiceWorkerContainer = navigator.serviceWorker) {
  sw.addEventListener('controllerchange', () => void pageIsCurrent(sw, script).then((current) => current || updateTookOver()));
  let last = Date.now();
  const check = () => {
    if (document.visibilityState !== 'visible' || Date.now() - last < CHECK_GAP) return;
    last = Date.now();
    void reg.update().catch(() => undefined);
  };
  document.addEventListener('visibilitychange', check);
  setInterval(check, 30 * 60_000);
}

/**
 * A page left open across a release asks for files of its own version that are no longer there
 * (Kids mode loads separately): load the new version instead, at most once a minute so a real
 * outage cannot reload in a loop.
 */
export function recoverFromMissingFiles() {
  window.addEventListener('vite:preloadError', () => {
    // Offline without the offline copy, a reload would only show the browser's error page: Kids
    // mode says what happened instead.
    if (navigator.onLine === false && !navigator.serviceWorker?.controller) return;
    try {
      if (Date.now() - Number(sessionStorage.getItem(RELOADED_KEY) ?? 0) < 60_000) return;
      sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
    } catch {
      return;
    }
    location.reload();
  });
}

/** For tests. */
export function __resetUpdateForTests() {
  pending = false;
}
