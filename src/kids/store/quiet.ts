// Quiet mode: the speaker button on the map. No sounds and no automatic reading aloud for one kid,
// on the device where the button was tapped. It is a choice of the moment, not of the family, so it
// lives in KidsState.device (never synced, never exported) and does not stamp the kid's settings:
// a child's tap must not undo what a grown-up chose on another device, or silence that device.
//
// It ends by itself when the next play session starts (useSession.ts: after 30 minutes away, on a
// new day, or after a break): the entry is the start of the session it was switched on in, and it
// counts only while the kid's current session is that one. A child who comes back later is spoken to
// again, and a grown-up who wonders why Pip is quiet only has to wait for the next sitting or tap
// the speaker button.
import { currentSession } from '../player/useSession';
import { getKid, getKids, setDeviceQuiet, updateKid } from './kidsStore';

/** Is quiet mode on for this kid on this device right now? */
export function isQuiet(kidId: string | null | undefined, now = Date.now()): boolean {
  const start = kidId ? getKids().device.quiet?.[kidId] : undefined;
  const session = getKid(kidId)?.session;
  return start !== undefined && !!session && currentSession(session, now).start === start;
}

/** Switches quiet mode for a kid on this device. */
export function setQuiet(kidId: string, on: boolean, now = Date.now()) {
  if (!on) return setDeviceQuiet(kidId, undefined);
  const kid = getKid(kidId);
  if (!kid) return;
  // The session it belongs to must exist to be told apart from the next one.
  const session = currentSession(kid.session, now);
  if (session !== kid.session) updateKid(kidId, (d) => void (d.session = session));
  setDeviceQuiet(kidId, session.start);
}
