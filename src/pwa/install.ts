// Installing Tempo as an app: registers the offline service worker and captures the browser's
// install prompt so the app can offer its own "Install" button.
import { useSyncExternalStore } from 'react';
import { IS_NATIVE } from './native';
import { recoverFromMissingFiles, watchForUpdates } from './update';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DEFAULT_APP_URL = 'https://bgage72590.github.io/chess-training/';

/** The address to hand out: `raw` (VITE_APP_URL) when it is a web address, else the default. It
 *  always ends in a slash and drops any query or hash. */
export function resolveAppUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_APP_URL;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_APP_URL;
    return url.origin + (url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`);
  } catch {
    return DEFAULT_APP_URL;
  }
}

/**
 * Where the installable app is hosted: for pages that cannot install themselves, and for handing the
 * app to someone else (QR code, share link). Never use location.href for that: the sync page's
 * address holds a private sync code. Set VITE_APP_URL when building to publish somewhere else.
 */
export const APP_URL = resolveAppUrl(import.meta.env.VITE_APP_URL);

/** How this browser installs Tempo when it has no install prompt. */
export type InstallHow = 'ios' | 'safari-mac' | 'safari-old' | 'in-app' | 'menu' | 'unsupported' | 'elsewhere' | 'native';

export type InstallState = {
  /** Running as an installed app (its own window or home-screen icon). */
  installed: boolean;
  /** The browser offered an install prompt we can show from a button. */
  canPrompt: boolean;
  /** How to install when there is no prompt. */
  how: InstallHow;
  /** An iPhone, iPad or iPod, whatever browser is on it. */
  ios: boolean;
};

/** An iPhone, iPad or iPod. An iPad in its desktop-class mode says it is a Mac but has a touch screen. */
export function isIosDevice(ua: string, touchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
}

/** A page opened inside another app (a social, chat or search app's own browser): those cannot
 *  install web apps, and keep their own storage. */
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|Messenger|GSA\/|Twitter|TikTok|musical_ly|Bytedance|LinkedInApp|Pinterest|MicroMessenger/;

/** Safari's version from its user agent; Infinity when it does not say. */
const safariMajor = (ua: string) => Number(/Version\/(\d+)/.exec(ua)?.[1] ?? Infinity);

export function detectHow(ua: string, touchPoints: number, elsewhere: boolean): InstallHow {
  if (elsewhere) return 'elsewhere';
  if (IN_APP.test(ua)) return 'in-app';
  if (isIosDevice(ua, touchPoints)) return 'ios';
  // Add to Dock came with Safari 17 (macOS 14 Sonoma); the version cannot tell Sonoma from older macOS.
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return safariMajor(ua) < 17 ? 'safari-old' : 'safari-mac';
  if (/Firefox\//.test(ua)) return 'unsupported';
  return 'menu';
}

function currentHow(): InstallHow {
  if (typeof window === 'undefined') return 'unsupported';
  if (IS_NATIVE) return 'native';
  // Inside another page (e.g. the claude.ai viewer) or the single-file build: install from the hosted app.
  return detectHow(navigator.userAgent, navigator.maxTouchPoints, window.top !== window.self || import.meta.env.MODE === 'single');
}

let prompt: InstallPromptEvent | null = null;
let state: InstallState = {
  // The native app is the installed app.
  installed: IS_NATIVE || (typeof window !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)),
  canPrompt: false,
  how: currentHow(),
  ios: typeof window !== 'undefined' && isIosDevice(navigator.userAgent, navigator.maxTouchPoints),
};
const listeners = new Set<() => void>();
const set = (s: Partial<InstallState>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};

/** Call once at start-up, before the browser may fire its install prompt. */
export function setupInstall() {
  if (IS_NATIVE) return; // nothing to register or install: new versions arrive as new builds of the app
  if (import.meta.env.PROD && import.meta.env.MODE !== 'single') recoverFromMissingFiles();
  if (import.meta.env.PROD && import.meta.env.MODE !== 'single' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js').then((reg) => reg && watchForUpdates(reg)).catch(() => undefined));
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
