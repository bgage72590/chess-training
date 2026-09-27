// Session length: active minutes count only while the page is visible and the kid touched or typed
// in the last 2 minutes. Minutes accumulate into kid.days[today].minutes. When the kid's limit is
// reached, the player shows Break time at the next item or results boundary (never mid-item).
import { useEffect, useSyncExternalStore } from 'react';
import { dayKey } from '../../lib/srs';
import { updateKid, type KidProfile } from '../store/kidsStore';

const IDLE_MS = 120_000;
const TICK_MS = 5_000;

let session = { kidId: null as string | null, activeMs: 0, extraMin: 0, lastInput: Date.now(), unsaved: 0 };
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

/** Starts a fresh session for a kid (when picked on the profile picker). */
export function startSession(kidId: string | null) {
  session = { kidId, activeMs: 0, extraMin: 0, lastInput: Date.now(), unsaved: 0 };
  emit();
}

export function noteInput() {
  session.lastInput = Date.now();
}

export function sessionMinutes(): number {
  return session.activeMs / 60_000;
}

export function extendSession(min = 10) {
  session.extraMin += min;
  emit();
}

/** Has this kid's session limit been reached? (0 = no limit) */
export function sessionOver(kid: KidProfile | undefined | null): boolean {
  if (!kid || !kid.settings.sessionMin) return false;
  return sessionMinutes() >= kid.settings.sessionMin + session.extraMin;
}

function flush(kidId: string) {
  const mins = session.unsaved / 60_000;
  if (mins <= 0) return;
  session.unsaved = 0;
  updateKid(kidId, (d) => {
    const day = (d.days[dayKey()] ??= { minutes: 0, stars: 0 });
    day.minutes = Math.round((day.minutes + mins) * 100) / 100;
  });
}

/** Mount once in KidsApp: tracks active time for the active kid. */
export function useSessionTracker(kidId: string | null) {
  useEffect(() => {
    if (!kidId) return;
    if (session.kidId !== kidId) startSession(kidId);
    let last = Date.now();
    const onInput = () => noteInput();
    window.addEventListener('pointerdown', onInput, true);
    window.addEventListener('pointermove', onInput, true);
    window.addEventListener('keydown', onInput, true);
    const id = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(now - last, TICK_MS * 3);
      last = now;
      const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
      if (visible && now - session.lastInput < IDLE_MS) {
        session.activeMs += dt;
        session.unsaved += dt;
        emit();
        if (session.unsaved >= 30_000) flush(kidId);
      }
    }, TICK_MS);
    return () => {
      clearInterval(id);
      window.removeEventListener('pointerdown', onInput, true);
      window.removeEventListener('pointermove', onInput, true);
      window.removeEventListener('keydown', onInput, true);
      flush(kidId);
    };
  }, [kidId]);
}

/** Re-renders when session time changes. */
export function useSessionVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
    () => version,
  );
}
