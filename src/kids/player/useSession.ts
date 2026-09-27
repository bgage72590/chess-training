// Session length (spec 10.5): active minutes count only while the page is visible and the kid touched
// or typed in the last 2 minutes. Minutes accumulate into kid.days[today].minutes and into the kid's
// persisted session (kid.session), so re-picking the kid or reloading the page never resets the limit.
// When the limit is reached, Break time shows at the next item or results boundary (never mid-item)
// and the kid rests: picking them again shows Break time until the cooldown ends or a grown-up passes
// the gate (+10 minutes).
import { useEffect, useSyncExternalStore } from 'react';
import { dayKey } from '../../lib/srs';
import { getKid, updateKid, type KidProfile, type KidSession } from '../store/kidsStore';

const IDLE_MS = 120_000;
const TICK_MS = 5_000;
/** How long Break time lasts before the kid may play again without a grown-up. */
export const BREAK_MS = 30 * 60_000;
/** Time away (no active play) after which a fresh session starts. */
export const SESSION_GAP_MS = 30 * 60_000;

/** In-memory part: which kid is being tracked, the last input and the not-yet-saved active time. */
const live = { kidId: null as string | null, lastInput: Date.now(), unsaved: 0, freshBreak: null as string | null };
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

const fresh = (now: number): KidSession => ({ start: now, last: now, min: 0, extra: 0 });

/** The kid's current session: the stored one, or a fresh one when the break or the time away is over. */
export function currentSession(s: KidSession | undefined, now = Date.now()): KidSession {
  if (!s) return fresh(now);
  if (s.breakAt != null) return now - s.breakAt < BREAK_MS ? s : fresh(now);
  if (now - s.last > SESSION_GAP_MS || dayKey(s.last) !== dayKey(now)) return fresh(now);
  return s;
}

/** Is this kid resting (Break time was shown and neither the cooldown nor a grown-up has ended it)? */
export function onBreak(kid: KidProfile | undefined | null, now = Date.now()): boolean {
  if (!kid || !kid.settings.sessionMin) return false;
  return currentSession(kid.session, now).breakAt != null;
}

/** Active minutes used this session, including time not saved yet. */
export function sessionMinutes(kid: KidProfile | undefined | null, now = Date.now()): number {
  if (!kid) return 0;
  const unsaved = live.kidId === kid.id ? live.unsaved / 60_000 : 0;
  return currentSession(kid.session, now).min + unsaved;
}

/** Has this kid's session limit been reached? (0 = no limit) */
export function sessionOver(kid: KidProfile | undefined | null, now = Date.now()): boolean {
  if (!kid || !kid.settings.sessionMin) return false;
  const s = currentSession(kid.session, now);
  if (s.breakAt != null) return true;
  return sessionMinutes(kid, now) >= kid.settings.sessionMin + s.extra;
}

/** Saves the unsaved active time into today's minutes and the session. */
function flush(kidId: string, now = Date.now()) {
  const mins = live.kidId === kidId ? live.unsaved / 60_000 : 0;
  if (live.kidId === kidId) live.unsaved = 0;
  if (mins <= 0) return;
  updateKid(kidId, (d) => {
    const day = (d.days[dayKey(now)] ??= { minutes: 0, stars: 0 });
    day.minutes = Math.round((day.minutes + mins) * 100) / 100;
    const s = { ...currentSession(d.session, now) };
    s.min = Math.round((s.min + mins) * 100) / 100;
    s.last = now;
    d.session = s;
  });
}

/** Break time is showing: the kid rests from now (saved, so a re-pick or a reload shows it again). */
export function markBreak(kidId: string, now = Date.now()) {
  flush(kidId, now);
  const k = getKid(kidId);
  if (!k || currentSession(k.session, now).breakAt != null) return;
  live.freshBreak = kidId;
  updateKid(kidId, (d) => {
    d.session = { ...currentSession(d.session, now), last: now, breakAt: now };
  });
  emit();
}

/** The break was just reached in play (not a resting kid picked again): Pip says "Great playing!". */
export const breakIsFresh = (kidId: string) => live.freshBreak === kidId;
export function clearFreshBreak() {
  live.freshBreak = null;
}

/** A grown-up passed the gate: the kid gets `min` more minutes from now and the break ends. */
export function extendSession(kidId: string, min = 10, now = Date.now()) {
  flush(kidId, now);
  const k = getKid(kidId);
  if (!k) return;
  updateKid(kidId, (d) => {
    const cur = currentSession(d.session, now);
    const s: KidSession = { start: cur.start, last: now, min: cur.min, extra: Math.max(cur.extra, cur.min - d.settings.sessionMin) + min };
    d.session = s;
  });
  emit();
}

export function noteInput() {
  live.lastInput = Date.now();
}

/** Mount once in KidsApp: tracks active time for the active kid. */
export function useSessionTracker(kidId: string | null) {
  useEffect(() => {
    if (!kidId) return;
    live.kidId = kidId;
    live.unsaved = 0;
    live.lastInput = Date.now();
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
      if (visible && now - live.lastInput < IDLE_MS) {
        live.unsaved += dt;
        emit();
        if (live.unsaved >= 30_000) flush(kidId, now);
      }
    }, TICK_MS);
    const onHide = () => document.visibilityState === 'hidden' && flush(kidId);
    const onLeave = () => flush(kidId);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onLeave);
    return () => {
      clearInterval(id);
      window.removeEventListener('pointerdown', onInput, true);
      window.removeEventListener('pointermove', onInput, true);
      window.removeEventListener('keydown', onInput, true);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onLeave);
      flush(kidId);
      if (live.kidId === kidId) live.kidId = null;
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

/** Test hook: pretend `ms` of unsaved active time for a kid. */
export function __setUnsavedForTests(kidId: string | null, ms: number) {
  live.kidId = kidId;
  live.unsaved = ms;
}
