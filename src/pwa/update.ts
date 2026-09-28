// Keeping an open app current. Opening the app loads the newest version (the service worker asks
// the network for the page first). An app left open, like an installed app brought back from the
// background, checks for a new version whenever it is shown again. When a new version takes over
// a page that is older, the page reloads at the next change of screen, never in the middle of a
// game or a puzzle, or at once from the notice.
import { toast } from '../lib/toast';

/** Checks for a new version at most this often (ms). */
const CHECK_GAP = 60_000;
const RELOADED_KEY = 'tempo.reloadedAt';

let pending = false;

/** A newer version took over this page: reload at the next change of screen, or now from the notice. */
export function updateTookOver() {
  if (pending) return;
  pending = true;
  window.addEventListener('hashchange', () => location.reload(), { once: true });
  // Kids mode only reloads at the next screen: its notices are for the kids.
  if (!location.hash.startsWith('#/kids')) {
    toast({ title: 'A new version of Tempo is ready', body: 'It opens when you go to another screen.', icon: 'refresh', action: { label: 'Reload now', run: () => location.reload() } }, 15000);
  }
}

/** Whether this page's own code belongs to the version the service worker now serves. */
async function pageIsCurrent(script: string): Promise<boolean> {
  try {
    return !!(await caches.match(script));
  } catch {
    return false;
  }
}

/**
 * Watches `reg` for new versions. `script` is this page's main script: after a new worker takes
 * over, the caches hold only the new version's files, so a page whose script is among them (it was
 * opened after the release) is already current and does not reload.
 */
export function watchForUpdates(reg: ServiceWorkerRegistration, script = import.meta.url, sw: ServiceWorkerContainer = navigator.serviceWorker) {
  // The first worker taking over a page is not an update.
  let controlled = !!sw.controller;
  sw.addEventListener('controllerchange', () => {
    const wasControlled = controlled;
    controlled = true;
    if (wasControlled) void pageIsCurrent(script).then((current) => current || updateTookOver());
  });
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
