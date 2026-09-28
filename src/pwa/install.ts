// Installing Tempo as an app: registers the offline service worker and captures the browser's
// install prompt so the app can offer its own "Install" button.
import { useSyncExternalStore } from 'react';
import { recoverFromMissingFiles, watchForUpdates } from './update';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Where the installable app is hosted (for pages that cannot install themselves). */
export const APP_URL = 'https://bgage72590.github.io/chess-training/';

export type InstallState = {
  /** Running as an installed app (its own window or home-screen icon). */
  installed: boolean;
  /** The browser offered an install prompt we can show from a button. */
  canPrompt: boolean;
  /** How to install when there is no prompt. */
  how: 'ios' | 'safari-mac' | 'menu' | 'unsupported' | 'elsewhere';
};

let prompt: InstallPromptEvent | null = null;
let state: InstallState = {
  installed: typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true),
  canPrompt: false,
  how: detectHow(),
};
const listeners = new Set<() => void>();
const set = (s: Partial<InstallState>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};

function detectHow(): InstallState['how'] {
  if (typeof window === 'undefined') return 'unsupported';
  // Inside another page (e.g. the claude.ai viewer) or the single-file build: install from the hosted app.
  if (window.top !== window.self || import.meta.env.MODE === 'single') return 'elsewhere';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'safari-mac';
  if (/Firefox\//.test(ua)) return 'unsupported';
  return 'menu';
}

/** Call once at start-up, before the browser may fire its install prompt. */
export function setupInstall() {
  if (import.meta.env.PROD && import.meta.env.MODE !== 'single') recoverFromMissingFiles();
  if (import.meta.env.PROD && import.meta.env.MODE !== 'single' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js').then((reg) => watchForUpdates(reg)).catch(() => undefined));
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    prompt = e as InstallPromptEvent;
    set({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    prompt = null;
    set({ installed: true, canPrompt: false });
  });
}

/** Shows the browser's install dialog. */
export async function install() {
  if (!prompt) return;
  const p = prompt;
  await p.prompt();
  const { outcome } = await p.userChoice;
  prompt = null;
  set({ canPrompt: false, installed: outcome === 'accepted' || state.installed });
}

export function useInstall(): InstallState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
