// The sound scenarios of the two-device audit, run against memoryBackend, the real SyncEngine, the
// real sync parts (profileSyncParts) and the real store: no browser. Devices take turns owning the
// module-level profile and the clock of sync/clock.ts, so the real updateProfile stamping runs. Each
// device has its own wall clock (skew).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryBackend } from '../src/sync/backend';
import { SyncEngine, type SyncPart } from '../src/sync/engine';
import { __clockForTests } from '../src/sync/clock';
import { profileSyncParts } from '../src/sync';
import { mergeProfiles, joiningCopy as joiningProfile } from '../src/sync/merge';
import { newSyncCode } from '../src/sync/code';
import { getProfile, normalizeProfile, replaceProfile, stampsOfSettings, updateProfile } from '../src/store/profile';

vi.mock('../src/lib/toast', () => ({ toast: vi.fn() }));

type Profile = ReturnType<typeof getProfile>;

const T0 = new Date('2026-09-30T12:00:00Z').getTime();
let realNow = T0; // "true" time, advanced by tests
const at = (s: number) => (realNow = T0 + s * 1000);
const HOUR = 3_600_000;

class Dev {
  profile: Profile = normalizeProfile({ onboarded: true });
  floor = 0;
  saved: { code: string; lastSyncedAt?: number } | null = null;
  engine: SyncEngine;
  constructor(backend: ReturnType<typeof memoryBackend>, public skewMs = 0, parts?: SyncPart[]) {
    this.engine = new SyncEngine(backend, parts ?? profileSyncParts(), { load: () => this.saved, save: (s) => void (this.saved = s) });
  }
  private enter() {
    vi.setSystemTime(realNow + this.skewMs);
    __clockForTests.set(this.floor);
    replaceProfile(this.profile, { keepTimestamp: true });
  }
  private leave() {
    this.profile = getProfile();
    this.floor = __clockForTests.get();
  }
  /** Runs `fn` as this device, at real time `realNow` on this device's clock. */
  act<T>(fn: () => T): T {
    this.enter();
    try {
      return fn();
    } finally {
      this.leave();
    }
  }
  async sync() {
    this.enter();
    try {
      await this.engine.syncNow();
    } finally {
      this.leave();
    }
  }
  async link(code: string, opts?: { mustExist?: boolean }) {
    this.enter();
    try {
      return await this.engine.link(code, opts);
    } finally {
      this.leave();
    }
  }
  get s() {
    return this.profile.settings;
  }
}

async function linked(skewB = 0) {
  const backend = memoryBackend();
  const A = new Dev(backend);
  const B = new Dev(backend, skewB);
  const code = newSyncCode();
  at(0);
  await A.link(code);
  await B.link(code);
  return { backend, A, B, code };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  __clockForTests.set(0);
  at(0);
});
afterEach(() => vi.useRealTimers());

describe('grown-up sound settings', () => {
  it('sound and volume set on A reach B (happy path)', async () => {
    const { A, B } = await linked();
    at(10);
    A.act(() => updateProfile((d) => void ((d.settings.volume = 0.4), (d.settings.sound = false))));
    await A.sync();
    at(20);
    await B.sync();
    expect(B.s).toMatchObject({ sound: false, volume: 0.4 });
  });

  // scenario a: one stamp for all settings let an unrelated change undo a sound change
  it("A's sound change survives an unrelated theme change on a stale B", async () => {
    const { A, B } = await linked();
    at(10);
    A.act(() => updateProfile((d) => void (d.settings.sound = false)));
    await A.sync(); // B has not pulled yet
    at(20);
    B.act(() => updateProfile((d) => void (d.settings.theme = 'dark')));
    await B.sync();
    at(30);
    await A.sync();
    expect(A.s).toMatchObject({ sound: false, theme: 'dark' });
    expect(B.s).toMatchObject({ sound: false, theme: 'dark' });
  });

  // scenario f (grown-up): offline edit of a different field
  it('an offline volume edit and an online theme edit both survive', async () => {
    const { A, B } = await linked();
    at(10);
    A.act(() => updateProfile((d) => void (d.settings.volume = 0.2))); // A offline: no sync
    at(20);
    B.act(() => updateProfile((d) => void (d.settings.theme = 'dark')));
    await B.sync();
    at(30);
    await A.sync();
    await B.sync();
    expect(A.s).toMatchObject({ volume: 0.2, theme: 'dark' });
    expect(B.s).toMatchObject({ volume: 0.2, theme: 'dark' });
  });

  it('the same setting changed on both devices: the later change wins on both', async () => {
    const { A, B } = await linked();
    at(10);
    A.act(() => updateProfile((d) => void (d.settings.volume = 0.2)));
    at(20);
    B.act(() => updateProfile((d) => void (d.settings.volume = 0.6)));
    await A.sync();
    await B.sync();
    await A.sync();
    expect(A.s.volume).toBe(0.6);
    expect(B.s.volume).toBe(0.6);
  });

  // scenario d2: a new device whose user touched one setting before linking
  it("a new device that changed only the theme does not overwrite the family's sound settings when it links", async () => {
    const backend = memoryBackend();
    const A = new Dev(backend);
    const B = new Dev(backend);
    at(0);
    A.act(() => updateProfile((d) => void ((d.settings.volume = 0.3), (d.settings.sound = false))));
    const code = newSyncCode();
    at(5);
    await A.link(code);
    at(60);
    B.act(() => updateProfile((d) => void (d.settings.theme = 'dark'))); // one tap on the new device
    at(90);
    await B.link(code, { mustExist: true });
    at(100);
    await A.sync();
    expect(B.s).toMatchObject({ sound: false, volume: 0.3, theme: 'dark' });
    expect(A.s).toMatchObject({ sound: false, volume: 0.3, theme: 'dark' });
  });

  it('an untouched new device adopts the family settings', async () => {
    const backend = memoryBackend();
    const A = new Dev(backend);
    const C = new Dev(backend);
    at(0);
    A.act(() => updateProfile((d) => void ((d.settings.volume = 0.3), (d.settings.sound = false))));
    const code = newSyncCode();
    at(5);
    await A.link(code);
    at(10);
    await C.link(code, { mustExist: true });
    expect(C.s).toMatchObject({ sound: false, volume: 0.3 });
  });

  it("a device from before stamps existed keeps its own choices when it links, but not the defaults it never chose", () => {
    const local = normalizeProfile({ onboarded: true, settings: { ...normalizeProfile({}).settings, boardTheme: 'marble' }, settingsAt: 500 });
    const remote = normalizeProfile({ onboarded: true, settings: { ...normalizeProfile({}).settings, sound: false, volume: 0.3 }, settingsAt: 100 });
    const m = mergeProfiles(joiningProfile(local, remote), remote);
    // Its default sound and volume (stamped 500 by the old rule) would have beaten the copy's older ones.
    expect(m.settings).toMatchObject({ boardTheme: 'marble', sound: false, volume: 0.3 });
  });

  // scenario g: clock skew
  it("B's clock 10 minutes ahead: A's newer change wins", async () => {
    const { A, B } = await linked(10 * 60 * 1000);
    at(10);
    B.act(() => updateProfile((d) => void (d.settings.volume = 0.1))); // older in real time, stamped +10 min
    await B.sync();
    at(20);
    await A.sync();
    at(40);
    A.act(() => updateProfile((d) => void (d.settings.volume = 0.9))); // newer in real time
    await A.sync();
    at(50);
    await B.sync();
    await A.sync();
    expect(A.s.volume).toBe(0.9);
    expect(B.s.volume).toBe(0.9);
  });

  it("B's clock 10 minutes behind: B's newer change wins", async () => {
    const { A, B } = await linked(-10 * 60 * 1000);
    at(10);
    A.act(() => updateProfile((d) => void (d.settings.volume = 0.9)));
    await A.sync();
    at(20);
    await B.sync();
    at(40);
    B.act(() => updateProfile((d) => void (d.settings.volume = 0.1))); // newer in real time, stamped -10 min
    await B.sync();
    at(50);
    await A.sync();
    expect(A.s.volume).toBe(0.1);
    expect(B.s.volume).toBe(0.1);
  });

  it("a change on a healthy device is not reverted for as long as another device's clock was ahead", async () => {
    const { A, B } = await linked(10 * 60 * 1000);
    at(10);
    B.act(() => updateProfile((d) => void (d.settings.volume = 0.1)));
    await B.sync();
    at(20);
    await A.sync();
    at(60);
    A.act(() => updateProfile((d) => void (d.settings.volume = 0.7))); // 40 s later: still older than B's +10 min stamp
    await A.sync();
    at(70);
    await B.sync();
    expect(A.s.volume).toBe(0.7);
    expect(B.s.volume).toBe(0.7);
    // ... and the next one after that
    at(90);
    A.act(() => updateProfile((d) => void (d.settings.volume = 0.5)));
    await A.sync();
    await B.sync();
    expect(B.s.volume).toBe(0.5);
  });

  it("a device whose clock is a year ahead pulls other devices' clocks at most 5 minutes ahead, and other settings are not stamped in the future", async () => {
    const { A, B } = await linked(365 * 24 * HOUR);
    at(10);
    B.act(() => updateProfile((d) => void (d.settings.volume = 0.1)));
    await B.sync();
    at(20);
    await A.sync();
    at(30);
    A.act(() => updateProfile((d) => void (d.settings.theme = 'dark'))); // an unrelated setting
    const stamps = stampsOfSettings(A.profile);
    expect(stamps.theme).toBeLessThanOrEqual(T0 + 30_000 + 5 * 60_000 + 1);
    expect(stamps.volume).toBeGreaterThan(T0 + 300 * 24 * HOUR); // the setting that came from that device keeps its stamp
    // Changing that very setting still beats it, wherever its stamp came from.
    A.act(() => updateProfile((d) => void (d.settings.volume = 0.9)));
    await A.sync();
    await B.sync();
    expect(B.s.volume).toBe(0.9);
  });
});

describe('data from the removed Kids mode', () => {
  it("stays in the synced copy: a device without Kids mode keeps parts it does not know", async () => {
    const backend = memoryBackend();
    const code = newSyncCode();
    const kids = { kids: [{ id: 'k-mia', name: 'Mia' }], updatedAt: T0 };
    await backend.put(code, { v: 1, at: T0, parts: { kids, 'kids-stamps': { 'k-mia': {} } } }, 0);
    const A = new Dev(backend);
    await A.link(code);
    at(10);
    A.act(() => updateProfile((d) => void (d.settings.volume = 0.3)));
    await A.sync();
    const parts = ((await backend.get(code))!.data as { parts: Record<string, unknown> }).parts;
    expect(parts.kids).toEqual(kids);
    expect(parts['kids-stamps']).toEqual({ 'k-mia': {} });
  });
});
