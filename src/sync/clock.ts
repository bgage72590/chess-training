// The clock behind the stamps on settings (Profile.settingsStamps, KidProfile.stamps). A synced
// setting is a value plus the stamp of the change that made it, and the later stamp wins when two
// devices are merged, so stamps must not go by what each device's own clock says alone: one that is
// ten minutes off would win (or lose) every change until real time caught up.
//
// A stamp is a hybrid logical clock: the device's Date.now(), but never behind a stamp this device
// has written or read (stored data, the synced copy) and always one past the value it replaces. An
// edit made after pulling another device's change therefore outranks it, whatever the two clocks
// say, and a device whose clock runs slow still wins over what it has seen.
//
// What a device reads raises the floor of its own clock by at most MAX_AHEAD_MS beyond its own
// now: a stamp further ahead counts as now + 5 minutes there, so one device with a wrong date
// cannot drag every other device's clock (and with it their next stamps) into the future. Only the
// floor is bounded. Merging compares the stamps as stored (fields.ts): ordering must stay a pure
// function of the two stamps, or merge stops being symmetric and idempotent, and an edit made after
// reading a far-future stamp only outranks it by going one past that stamp itself (see nextStamp).

/** How far ahead of its own clock a device lets what it reads move its stamps. */
export const MAX_AHEAD_MS = 5 * 60_000;

let floor = 0;

/** Notes a stamp read from stored or synced data. */
export function observeStamp(stamp: unknown, now = Date.now()) {
  if (typeof stamp === 'number' && Number.isFinite(stamp) && stamp > floor) floor = Math.max(floor, Math.min(stamp, now + MAX_AHEAD_MS));
}

/** Notes every stamp of a stamp map, and the older single stamp (settingsAt) beside it. */
export function observeStamps(stamps: Record<string, number> | undefined, settingsAt?: number, now = Date.now()) {
  observeStamp(settingsAt, now);
  if (stamps) for (const t of Object.values(stamps)) observeStamp(t, now);
}

/**
 * A new stamp: now, or one past everything this device has seen or written, or one past `after`,
 * the stamp of the value being replaced (which can be further ahead than the floor allows: a change
 * to a setting must beat the value it changes, whatever clock that value was stamped with).
 */
export function nextStamp(after = 0, now = Date.now()): number {
  const t = Math.max(now, floor + 1, after + 1);
  floor = Math.max(floor, Math.min(t, now + MAX_AHEAD_MS));
  return t;
}

/** Tests: the highest stamp this clock has seen or written, and setting it (a test plays several devices with one clock each). */
export const __clockForTests = {
  get: () => floor,
  set: (n: number) => void (floor = n),
};
