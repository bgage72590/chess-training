// "Lock Kids mode on this device": when on, the app opens #/kids (App.tsx imports this statically,
// so it must stay tiny). Guarded storage access; defaults to unlocked.
const KEY = 'tempo.kids.lock.v1';

export function isKidsLocked(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setKidsLocked(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the lock cannot persist */
  }
}
