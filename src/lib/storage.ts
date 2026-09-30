// Asking the browser to keep Tempo's data. Without it a browser may clear a site's storage when the
// device runs low on space, and Safari does after about a week without a visit to a site opened in
// a tab (an app added to the Home Screen is kept longer). Progress and downloaded voices live there.

export interface StorageStatus {
  /** The browser has a storage manager at all. */
  supported: boolean;
  /** null: the browser cannot say. */
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

const KEY = 'tempo.persist.v1';
/** A refusal is asked again after this long: Chrome decides from how much the site is used. */
const ASK_AGAIN_MS = 24 * 3600_000;

const manager = (): StorageManager | undefined => {
  try {
    return typeof navigator === 'undefined' ? undefined : navigator.storage;
  } catch {
    return undefined;
  }
};

interface Answer {
  granted: boolean;
  at: number;
}

/** The last answer the browser gave (kept so a refusal is not asked again on every action). */
export function rememberedPersistence(): Answer | null {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Answer> | null;
    return a && typeof a.granted === 'boolean' && typeof a.at === 'number' ? { granted: a.granted, at: a.at } : null;
  } catch {
    return null;
  }
}

function remember(granted: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ granted, at: Date.now() }));
  } catch {
    /* storage unavailable: the browser is asked again next time */
  }
}

let asking: Promise<boolean> | null = null;

/**
 * Asks the browser to keep this site's data (navigator.storage.persist), once it matters: after a
 * first finished lesson, puzzle or game, and when a voice download starts. Never throws; answers
 * whether the data is now protected.
 */
export function requestPersistence(): Promise<boolean> {
  return (asking ??= (async () => {
    const s = manager();
    if (!s?.persist) return false;
    try {
      if (await s.persisted?.()) {
        remember(true);
        return true;
      }
      const last = rememberedPersistence();
      if (last && !last.granted && Date.now() - last.at < ASK_AGAIN_MS) return false;
      const granted = await s.persist();
      remember(granted);
      return granted;
    } catch {
      return false;
    }
  })().finally(() => void (asking = null)));
}

/** Whether the data is protected, and how much room the site uses. */
export async function storageStatus(): Promise<StorageStatus> {
  const s = manager();
  if (!s) return { supported: false, persisted: null, usage: null, quota: null };
  const persisted = await Promise.resolve(s.persisted?.()).then((p) => p ?? null, () => null);
  const est = await Promise.resolve(s.estimate?.()).then((e) => e ?? null, () => null);
  return { supported: true, persisted, usage: est?.usage ?? null, quota: est?.quota ?? null };
}

/**
 * Calls requestPersistence once `made()` first says the person has made progress worth keeping.
 * `subscribe` reports changes (a store's subscribe function); returns a function that stops watching.
 */
export function persistAfterProgress(subscribe: (listener: () => void) => () => void, made: () => boolean): () => void {
  if (made()) {
    void requestPersistence();
    return () => undefined;
  }
  let off: () => void = () => undefined;
  off = subscribe(() => {
    if (!made()) return;
    off();
    void requestPersistence();
  });
  return off;
}
