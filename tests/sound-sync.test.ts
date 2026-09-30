// The sound and voice scenarios of the two-device audit (scratchpad sync-audit/two-device.cjs), run
// against memoryBackend, the real SyncEngine, the real sync parts (profileSyncParts, kidsSyncParts)
// and the real stores: no browser. Two or three "devices" take turns owning the module-level profile
// and kids stores (replaceProfile / __setKidsStateForTests) and the clock of sync/clock.ts, so the real
// updateProfile / updateKid stamping runs. Each device has its own wall clock (skew).
//
// Every test states what a family wants: what a person sets about sound and Pip's voice on one linked
// device reaches the others, does not silently undo other changes, and a child's tap changes nothing
// a grown-up chose. The last group plays an app version from before per-field stamps.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryBackend } from '../src/sync/backend';
import { SyncEngine, type SyncPart } from '../src/sync/engine';
import { __clockForTests } from '../src/sync/clock';
import { profileSyncParts } from '../src/sync';
import { mergeProfiles, joiningCopy as joiningProfile } from '../src/sync/merge';
import { newSyncCode } from '../src/sync/code';
import { getProfile, normalizeProfile, replaceProfile, stampsOfSettings, updateProfile } from '../src/store/profile';
import {
  __setKidsStateForTests,
  defaultKidsState,
  exportKids,
  getKids,
  newKid,
  normalizeKids,
  readKids,
  updateKid,
  updateKids,
  type KidsState,
} from '../src/kids/store/kidsStore';
import { dropIdleTwins, kidsSyncParts, mergeSyncedKids, mergeTwins, twinGroups } from '../src/kids/store/syncKids';
import { inheritedSettings, pipVoiceFor } from '../src/kids/store/familyVoice';
import { isQuiet, setQuiet } from '../src/kids/store/quiet';

vi.mock('../src/lib/toast', () => ({ toast: vi.fn() }));

type Profile = ReturnType<typeof getProfile>;

const T0 = new Date('2026-09-30T12:00:00Z').getTime();
let realNow = T0; // "true" time, advanced by tests
const at = (s: number) => (realNow = T0 + s * 1000);
const HOUR = 3_600_000;

class Dev {
  profile: Profile = normalizeProfile({ onboarded: true });
  kids: KidsState = defaultKidsState();
  floor = 0;
  saved: { code: string; lastSyncedAt?: number } | null = null;
  engine: SyncEngine;
  constructor(backend: ReturnType<typeof memoryBackend>, public skewMs = 0, parts?: SyncPart[]) {
    this.engine = new SyncEngine(backend, parts ?? [...profileSyncParts(), ...kidsSyncParts()], { load: () => this.saved, save: (s) => void (this.saved = s) });
  }
  private enter() {
    vi.setSystemTime(realNow + this.skewMs);
    __clockForTests.set(this.floor);
    replaceProfile(this.profile, { keepTimestamp: true });
    __setKidsStateForTests(this.kids);
  }
  private leave() {
    this.profile = getProfile();
    this.kids = getKids();
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
  kid(name = 'Mia') {
    return this.kids.kids.find((k) => k.name === name)!;
  }
}

const mia = (id = 'k-mia', name = 'Mia') => newKid({ id, name, band: 'explorer' as never, start: 'new', now: 1 });
const withKid = (d: Dev, id?: string) => void (d.kids = { ...defaultKidsState(), kids: [mia(id)], updatedAt: T0 });
async function linked(skewB = 0, kid = true) {
  const backend = memoryBackend();
  const A = new Dev(backend);
  const B = new Dev(backend, skewB);
  if (kid) {
    withKid(A);
    withKid(B);
  }
  const code = newSyncCode();
  at(0);
  await A.link(code);
  await B.link(code);
  return { backend, A, B, code };
}
const stored = async (backend: ReturnType<typeof memoryBackend>, code: string) => (await backend.get(code))!.data as { parts: Record<string, any> };

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
    const { A, B } = await linked(10 * 60 * 1000, false);
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
    const { A, B } = await linked(-10 * 60 * 1000, false);
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
    const { A, B } = await linked(10 * 60 * 1000, false);
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
    const { A, B } = await linked(365 * 24 * HOUR, false);
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

describe('kids sound and voice settings', () => {
  it("Pip's voice, read-aloud mode, speed and sounds travel to B (happy path)", async () => {
    const { A, B } = await linked();
    at(10);
    A.act(() => updateKid('k-mia', (k) => void Object.assign(k.settings, { pipVoice: 'rocket', voice: 'first', rate: 1.1, sound: false })));
    await A.sync();
    at(20);
    await B.sync();
    expect(B.kid().settings).toMatchObject({ pipVoice: 'rocket', voice: 'first', rate: 1.1, sound: false });
  });

  // scenario b2: the child's speaker button used to stamp the settings
  it("a child's speaker tap on a stale device does not undo the grown-up's voice pick on another", async () => {
    const { A, B } = await linked();
    at(10);
    A.act(() => updateKid('k-mia', (k) => void (k.settings.pipVoice = 'honey')));
    await A.sync();
    at(20);
    const before = { ...B.kid() };
    B.act(() => setQuiet('k-mia', true)); // the map's speaker button
    expect(B.kid().settingsAt).toBe(before.settingsAt);
    expect(B.kid().stamps).toEqual(before.stamps);
    await B.sync();
    at(30);
    await A.sync();
    expect(A.kid().settings.pipVoice).toBe('honey');
    expect(B.kid().settings.pipVoice).toBe('honey');
  });

  // scenario b: quiet mode is a per-device, per-moment choice
  it('quiet mode (the map speaker) stays on the device where it was tapped', async () => {
    const { backend, code, A, B } = await linked();
    at(10);
    A.act(() => setQuiet('k-mia', true));
    expect(A.act(() => isQuiet('k-mia'))).toBe(true);
    await A.sync();
    at(20);
    await B.sync();
    expect(B.act(() => isQuiet('k-mia'))).toBe(false);
    expect(A.act(() => isQuiet('k-mia'))).toBe(true);
    expect(JSON.stringify(await stored(backend, code))).not.toMatch(/quiet|muted/);
    expect(B.kid().settings).not.toHaveProperty('muted');
    expect(A.kids.device.quiet).toEqual({ 'k-mia': A.kid().session!.start });
    expect(B.kids.device.quiet).toBeUndefined();
  });

  it('quiet mode survives a sync on the device, and ends by itself when the next play session starts', async () => {
    const { A } = await linked();
    at(10);
    A.act(() => setQuiet('k-mia', true));
    await A.sync();
    expect(A.act(() => isQuiet('k-mia'))).toBe(true);
    at(10 + 20 * 60); // 20 minutes on: the same session
    expect(A.act(() => isQuiet('k-mia'))).toBe(true);
    at(10 + 45 * 60); // 45 minutes without play: a new session starts
    expect(A.act(() => isQuiet('k-mia'))).toBe(false);
    A.act(() => setQuiet('k-mia', true)); // the button still works
    expect(A.act(() => isQuiet('k-mia'))).toBe(true);
    A.act(() => setQuiet('k-mia', false));
    expect(A.act(() => isQuiet('k-mia'))).toBe(false);
    expect(A.kids.device.quiet).toBeUndefined();
  });

  it('quiet mode is per kid', async () => {
    const { A } = await linked();
    A.act(() => updateKids((d) => void d.kids.push(mia('k-leo', 'Leo'))));
    A.act(() => setQuiet('k-mia', true));
    expect(A.act(() => isQuiet('k-mia'))).toBe(true);
    expect(A.act(() => isQuiet('k-leo'))).toBe(false);
  });

  it('quiet mode is not exported and not touched by a sync, and a synced muted flag from an older version is ignored', async () => {
    const { backend, code, A, B } = await linked();
    at(10);
    A.act(() => setQuiet('k-mia', true));
    expect(exportKids(A.kids)).not.toMatch(/quiet/);
    // An older version's device that had quiet mode on synced it as a setting.
    const slot = (await backend.get(code))!;
    const data = structuredClone(slot.data) as { parts: { kids: { kids: { settings: Record<string, unknown> }[] } } };
    data.parts.kids.kids[0].settings.muted = true;
    await backend.put(code, data, slot.version);
    at(20);
    await B.sync();
    expect(B.kid().settings).not.toHaveProperty('muted');
    expect(B.act(() => isQuiet('k-mia'))).toBe(false);
    await A.sync();
    expect(A.act(() => isQuiet('k-mia'))).toBe(true); // synced kids never replace this device's own quiet mode
  });

  it('quiet mode saved the old way (settings.muted) is kept on this device when it is loaded, and only there', () => {
    const kid = (muted: boolean, session: boolean) => ({ id: muted ? 'k-a' : 'k-b', name: 'Mia', band: 'explorer', settings: { muted }, ...(session ? { session: { start: 5000, last: 6000, min: 1, extra: 0 } } : {}) });
    const raw = JSON.stringify({ v: 1, kids: [kid(true, true), kid(false, true)], family: {}, device: {}, updatedAt: 1 });
    const read = readKids({ getItem: () => raw, setItem: () => undefined, removeItem: () => undefined });
    expect(read.device.quiet).toEqual({ 'k-a': 5000 });
    expect(read.kids[0].settings).not.toHaveProperty('muted');
    // Synced or imported data does not bring it in.
    expect(normalizeKids(JSON.parse(raw)).device.quiet).toBeUndefined();
  });

  // scenario f (kid)
  it("A's offline speech speed and B's voice pick both survive", async () => {
    const { A, B } = await linked();
    at(10);
    A.act(() => updateKid('k-mia', (k) => void (k.settings.rate = 1.15))); // offline
    at(20);
    B.act(() => updateKid('k-mia', (k) => void (k.settings.pipVoice = 'honey')));
    await B.sync();
    at(30);
    await A.sync();
    await B.sync();
    expect(A.kid().settings).toMatchObject({ rate: 1.15, pipVoice: 'honey' });
    expect(B.kid().settings).toMatchObject({ rate: 1.15, pipVoice: 'honey' });
  });

  it("the same setting on both devices: the later pick wins; a rename and a voice pick are separate changes", async () => {
    const { A, B } = await linked();
    at(10);
    A.act(() => updateKid('k-mia', (k) => void ((k.settings.pipVoice = 'willow'), (k.name = 'Mimi'))));
    at(20);
    B.act(() => updateKid('k-mia', (k) => void (k.settings.pipVoice = 'honey')));
    await A.sync();
    await B.sync();
    await A.sync();
    for (const d of [A, B]) {
      expect(d.kids.kids[0].name).toBe('Mimi');
      expect(d.kids.kids[0].settings.pipVoice).toBe('honey');
    }
  });

  // scenario g (kid)
  it("a kid's settings: B's clock 10 minutes ahead does not let its older pick beat A's newer one", async () => {
    const { A, B } = await linked(10 * 60 * 1000);
    at(10);
    B.act(() => updateKid('k-mia', (k) => void (k.settings.pipVoice = 'willow')));
    await B.sync();
    at(20);
    await A.sync();
    at(40);
    A.act(() => updateKid('k-mia', (k) => void (k.settings.pipVoice = 'honey')));
    await A.sync();
    at(50);
    await B.sync();
    await A.sync();
    expect(A.kid().settings.pipVoice).toBe('honey');
    expect(B.kid().settings.pipVoice).toBe('honey');
  });

  // scenario e: the device voice never travels, but the choice of it does
  it("device.voiceURI stays on the device; the choice 'device' travels", async () => {
    const { backend, code, A, B } = await linked();
    A.act(() => updateKids((d) => void (d.device.voiceURI = 'com.apple.voice.premium.en-US.Ava')));
    at(10);
    A.act(() => updateKid('k-mia', (k) => void (k.settings.pipVoice = 'device')));
    await A.sync();
    const text = JSON.stringify((await backend.get(code))!.data);
    expect(text).not.toContain('Ava');
    expect(text).not.toContain('voiceURI');
    at(20);
    await B.sync();
    expect(B.kid().settings.pipVoice).toBe('device');
    expect(B.kids.device.voiceURI).toBeUndefined();
    expect(exportKids(A.kids)).not.toContain('Ava'); // export drops it too
    expect(A.kids.device.voiceURI).toBe('com.apple.voice.premium.en-US.Ava'); // a sync leaves it alone
  });

  it("a device that opts for a recorded voice speaks with one where the choice is the device's own voice, without changing the choice", async () => {
    const { A, B } = await linked();
    at(10);
    A.act(() => updateKid('k-mia', (k) => void (k.settings.pipVoice = 'device')));
    await A.sync();
    await B.sync();
    const stateB = () => B.act(() => getKids());
    expect(pipVoiceFor({ ...stateB(), activeKid: 'k-mia' })).toBe('device');
    B.act(() => updateKids((d) => void (d.device.useRecorded = true)));
    expect(pipVoiceFor({ ...stateB(), activeKid: 'k-mia' })).toBe('');
    expect(B.kid().settings.pipVoice).toBe('device');
    await B.sync();
    at(20);
    await A.sync();
    expect(A.kid().settings.pipVoice).toBe('device');
    expect(A.kids.device.useRecorded).toBeUndefined();
  });

  // firsts
  it("the 'first' lines already heard on either device are known on both", async () => {
    const { A, B } = await linked();
    at(10);
    A.act(() => updateKid('k-mia', (k) => void k.firsts.push('x1', 'x2')));
    B.act(() => updateKid('k-mia', (k) => void k.firsts.push('y1')));
    at(20);
    await A.sync();
    await B.sync();
    await A.sync();
    expect(A.kid().firsts.sort()).toEqual(['x1', 'x2', 'y1']);
    expect(B.kid().firsts.sort()).toEqual(['x1', 'x2', 'y1']);
  });

  it('hearing a first line does not count as a settings change', () => {
    const d = new Dev(memoryBackend());
    withKid(d);
    d.act(() => updateKid('k-mia', (k) => void k.firsts.push('x1')));
    expect(d.kid().settingsAt).toBeUndefined();
    expect(d.kid().stamps).toBeUndefined();
  });

  // forward compatibility of the settings object (a newer app adds a field; an older device syncs)
  it('a settings field this app version does not know survives a sync through it', async () => {
    const { backend, code, B } = await linked();
    const slot = (await backend.get(code))!;
    const data = structuredClone(slot.data) as { parts: { kids: { kids: { settings: Record<string, unknown> }[] } } };
    data.parts.kids.kids[0].settings.pipVolume = 0.5; // written by a newer app
    await backend.put(code, data, slot.version);
    at(10);
    B.act(() => updateKid('k-mia', (k) => void (k.settings.rate = 1.1)));
    await B.sync();
    const after = await stored(backend, code);
    expect(after.parts.kids.kids[0].settings.pipVolume).toBe(0.5);
    expect(after.parts.kids.kids[0].settings.rate).toBe(1.1);
  });

  it("a voice id up to 40 characters is kept as it is (a newer voice list), a longer or non-text one is reset", () => {
    const read = (pipVoice: unknown) => normalizeKids({ v: 1, kids: [{ id: 'k1', name: 'Mia', settings: { pipVoice } }], family: {}, device: {} }).kids[0].settings.pipVoice;
    expect(read('Sunny_Voice')).toBe('Sunny_Voice');
    expect(read('newer-voice-2')).toBe('newer-voice-2');
    expect(read('x'.repeat(40))).toBe('x'.repeat(40));
    expect(read('x'.repeat(41))).toBe('');
    expect(read(7)).toBe('');
  });
});

describe('a new player and the family voice', () => {
  it('copies Pip voice, speed and Sounds from the kid changed most recently, and the read-aloud mode only when it was chosen', async () => {
    const { A } = await linked();
    A.act(() => updateKids((d) => void d.kids.push(mia('k-leo', 'Leo'))));
    at(10);
    A.act(() => updateKid('k-mia', (k) => void Object.assign(k.settings, { pipVoice: 'rocket', rate: 1.1, sound: false })));
    expect(inheritedSettings(A.kids.kids)).toEqual({ pipVoice: 'rocket', rate: 1.1, sound: false });
    at(20);
    A.act(() => updateKid('k-leo', (k) => void Object.assign(k.settings, { pipVoice: 'honey', voice: 'off' })));
    expect(inheritedSettings(A.kids.kids)).toEqual({ pipVoice: 'honey', rate: null, sound: true, voice: 'off' });
    expect(newKid({ name: 'Zed', band: 'sprout' as never, start: 'new', settings: inheritedSettings(A.kids.kids) }).settings).toMatchObject({ pipVoice: 'honey', voice: 'off' });
    expect(inheritedSettings([])).toEqual({});
  });

  it("speaks with the family's voice while nobody is picked, and with the active kid's when one is", async () => {
    const { A } = await linked();
    A.act(() => updateKid('k-mia', (k) => void (k.settings.pipVoice = 'rocket')));
    expect(pipVoiceFor({ ...A.kids, activeKid: null })).toBe('rocket');
    expect(pipVoiceFor({ ...A.kids, activeKid: 'k-mia' })).toBe('rocket');
    expect(pipVoiceFor({ ...defaultKidsState() })).toBeUndefined();
  });
});

// scenario c: the order problem, the same kid made on both devices before they were linked
describe('the same player made on two devices', () => {
  const kidWith = (id: string, patch: (k: ReturnType<typeof mia>) => void = () => undefined, name = 'Mia') => {
    const k = mia(id, name);
    patch(k);
    return k;
  };
  const node = (stars: 1 | 2 | 3) => ({ stars, plays: 1, last: 5000, box: 1 as const, due: '2026-09-20', masteredDays: [], lastItems: [], losses: 0, ease: 0 });
  async function twins(a: ReturnType<typeof mia>, b: ReturnType<typeof mia>) {
    const backend = memoryBackend();
    const A = new Dev(backend);
    const B = new Dev(backend);
    A.kids = { ...defaultKidsState(), kids: [a], updatedAt: T0 };
    B.kids = { ...defaultKidsState(), kids: [b], updatedAt: T0 };
    const code = newSyncCode();
    at(5);
    await A.link(code);
    at(10);
    await B.link(code, { mustExist: true });
    at(20);
    await A.sync();
    await B.sync();
    return { backend, code, A, B };
  }

  it('two players with nothing of their own end as one, on both devices', async () => {
    const { A, B } = await twins(kidWith('k-a'), kidWith('k-b'));
    expect(A.kids.kids.map((k) => k.id)).toEqual(['k-a']);
    expect(B.kids.kids.map((k) => k.id)).toEqual(['k-a']);
    expect(Object.keys(A.kids.removed ?? {})).toEqual(['k-b']);
  });

  it('the one that has played is the one that stays, whichever device it was made on', async () => {
    const played = kidWith('k-a', (k) => void (k.nodes['w1-hello'] = node(2)));
    const { A, B } = await twins(played, kidWith('k-b'));
    expect(A.kids.kids.map((k) => k.id)).toEqual(['k-a']);
    expect(B.kids.kids.map((k) => k.id)).toEqual(['k-a']);
    const swapped = await twins(kidWith('k-a'), kidWith('k-b', (k) => void (k.nodes['w1-hello'] = node(2))));
    expect(swapped.A.kids.kids.map((k) => k.id)).toEqual(['k-b']);
    expect(swapped.B.kids.kids.map((k) => k.id)).toEqual(['k-b']);
    expect(swapped.B.kids.kids[0].nodes['w1-hello']).toBeDefined();
  });

  it('two that have played are left alone and offered for merging; merging keeps the progress of both and deletes one everywhere', async () => {
    const a = kidWith('k-a', (k) => void ((k.nodes['w1-hello'] = node(3)), (k.settings.pipVoice = 'rocket')));
    const b = kidWith('k-b', (k) => void ((k.nodes['w1-other'] = node(1)), (k.settings.pipVoice = 'honey')));
    const { A, B } = await twins(a, b);
    expect(A.kids.kids.map((k) => k.id).sort()).toEqual(['k-a', 'k-b']);
    expect(twinGroups(A.kids.kids)).toHaveLength(1);
    at(30);
    A.act(() => mergeTwins('k-a', 'k-b'));
    expect(A.kids.kids).toHaveLength(1);
    const merged = A.kids.kids[0];
    expect(merged.id).toBe('k-a'); // more stars
    expect(Object.keys(merged.nodes).sort()).toEqual(['w1-hello', 'w1-other']);
    expect(merged.settings.pipVoice).toBe('rocket');
    expect(A.kids.removed).toHaveProperty('k-b');
    await A.sync();
    at(40);
    await B.sync();
    expect(B.kids.kids.map((k) => k.id)).toEqual(['k-a']);
    expect(Object.keys(B.kids.kids[0].nodes).sort()).toEqual(['w1-hello', 'w1-other']);
  });

  it('different names or age groups are not twins, and names compare without case', () => {
    const one = mia('k-1', 'Mia');
    const two = mia('k-2', 'MIA ');
    const three = newKid({ id: 'k-3', name: 'Mia', band: 'sprout' as never, start: 'new' });
    const four = mia('k-4', 'Leo');
    expect(twinGroups([one, two, three, four]).map((g) => g.map((k) => k.id))).toEqual([['k-1', 'k-2']]);
    const s = { kids: [one, two, three, four], family: { stars: 0, parties: 0 }, updatedAt: 9 };
    expect(dropIdleTwins(s).kids.map((k) => k.id)).toEqual(['k-1', 'k-3', 'k-4']);
    expect(dropIdleTwins(dropIdleTwins(s))).toEqual(dropIdleTwins(s)); // idempotent
  });

  it('a twin made a moment ago waits: it may have been made on purpose', () => {
    const one = mia('k-1', 'Mia');
    const two = { ...mia('k-2', 'Mia'), created: T0 - 60_000 };
    const s = { kids: [one, two], family: { stars: 0, parties: 0 }, updatedAt: 9 };
    expect(dropIdleTwins(s, T0).kids.map((k) => k.id)).toEqual(['k-1', 'k-2']);
    expect(dropIdleTwins(s, T0 + 10 * 60_000).kids.map((k) => k.id)).toEqual(['k-1']);
  });

  it("a twin that was set up (its own voice) is not dropped in silence", () => {
    const one = mia('k-1', 'Mia');
    const two = mia('k-2', 'Mia');
    two.settings.pipVoice = 'rocket';
    expect(dropIdleTwins({ kids: [one, two], family: { stars: 0, parties: 0 }, updatedAt: 9 }).kids.map((k) => k.id)).toEqual(['k-2']); // the idle one goes
    one.settings.pipVoice = 'honey';
    expect(dropIdleTwins({ kids: [one, two], family: { stars: 0, parties: 0 }, updatedAt: 9 }).kids.map((k) => k.id)).toEqual(['k-1', 'k-2']);
  });
});

// An app version from before per-field stamps: whole-object settings by settingsAt, kids rebuilt without the fields it
// does not know (so `stamps` is dropped), parts it does not know passed on untouched.
describe('an older app version syncing the same copy', () => {
  const oldParts = (): SyncPart[] => {
    const [profile, ...rest] = profileSyncParts();
    const [kids, ...kidRest] = kidsSyncParts();
    const oldProfile: SyncPart = {
      ...profile,
      merge: (a: unknown, b: unknown, joining: boolean) => {
        const [x, y] = [a as Profile, b as Profile];
        const newer = y.updatedAt > x.updatedAt ? y : x;
        const from = (y.settingsAt ?? 0) > (x.settingsAt ?? 0) ? y : x;
        const m = mergeProfiles(joining ? joiningProfile(x, y) : x, y);
        return normalizeProfile({ ...m, settings: from.settings, settingsAt: Math.max(x.settingsAt ?? 0, y.settingsAt ?? 0) || undefined, settingsStamps: newer.settingsStamps });
      },
      // No reading of the stamps mirror: it stays in the copy as it is.
      normalize: (v: unknown) => normalizeProfile(v as Partial<Profile>),
    };
    const oldKids: SyncPart = {
      ...kids,
      merge: (a: any, b: any) => {
        const m = mergeSyncedKids(a, b);
        return { ...m, kids: m.kids.map((k) => {
          const [x, y] = [a.kids.find((o: any) => o.id === k.id), b.kids.find((o: any) => o.id === k.id)];
          const from = x && y ? ((x.settingsAt ?? 0) > (y.settingsAt ?? 0) ? x : y) : (x ?? y);
          const { stamps: _drop, ...rest } = k;
          return { ...rest, name: from.name, avatar: from.avatar, band: from.band, settings: from.settings, settingsAt: Math.max(x?.settingsAt ?? 0, y?.settingsAt ?? 0) || undefined };
        }) };
      },
      normalize: (v: unknown) => {
        const s = normalizeKids({ ...(v as object), v: 1 }, 24);
        return { kids: s.kids.map(({ stamps: _drop, ...k }) => k), family: s.family, updatedAt: s.updatedAt, ...(s.removed ? { removed: s.removed } : {}) } as never;
      },
    };
    // The older version has the tally mirrors but no stamps mirrors.
    return [oldProfile, rest[0], oldKids, kidRest[0]];
  };

  it('passes the stamps mirrors on untouched', async () => {
    const backend = memoryBackend();
    const N = new Dev(backend);
    const O = new Dev(backend, 0, oldParts());
    withKid(N);
    withKid(O);
    const code = newSyncCode();
    at(0);
    await N.link(code);
    at(10);
    N.act(() => updateProfile((d) => void (d.settings.sound = false)));
    N.act(() => updateKid('k-mia', (k) => void (k.settings.pipVoice = 'rocket')));
    await N.sync();
    const mirrors = (await stored(backend, code)).parts;
    at(20);
    await O.link(code, { mustExist: true });
    await O.sync();
    const after = (await stored(backend, code)).parts;
    expect(after['profile-stamps']).toEqual(mirrors['profile-stamps']);
    expect(after['kids-stamps']).toEqual(mirrors['kids-stamps']);
    expect(O.s.sound).toBe(false);
    expect(O.kid().settings.pipVoice).toBe('rocket');
  });

  async function pair() {
    const backend = memoryBackend();
    const N = new Dev(backend);
    const O = new Dev(backend, 0, oldParts());
    withKid(N);
    withKid(O);
    const code = newSyncCode();
    at(0);
    await N.link(code);
    await O.link(code, { mustExist: true });
    at(10);
    N.act(() => updateProfile((d) => void (d.settings.sound = false)));
    await N.sync();
    await O.sync(); // O has pulled sound off
    return { backend, code, N, O };
  }

  it("an offline edit made after the older device's write is not lost to that device's stale copy of the settings it did not touch", async () => {
    const { N, O } = await pair();
    at(50);
    O.act(() => updateProfile((d) => void (d.settings.theme = 'dark'))); // whole-object write by settingsAt
    O.act(() => updateKid('k-mia', (k) => void (k.settings.pipVoice = 'honey')));
    await O.sync();
    at(60);
    N.act(() => updateProfile((d) => void (d.settings.volume = 0.2))); // N was offline until now
    N.act(() => updateKid('k-mia', (k) => void (k.settings.rate = 1.15)));
    await N.sync();
    at(70);
    await O.sync();
    for (const d of [N, O]) {
      expect(d.s).toMatchObject({ sound: false, volume: 0.2, theme: 'dark' });
      expect(d.kid().settings).toMatchObject({ rate: 1.15, pipVoice: 'honey' });
    }
  });

  it("an edit that is older than the older device's write follows the older rule (the later whole object wins), and both devices agree", async () => {
    const { N, O } = await pair();
    at(40);
    N.act(() => updateProfile((d) => void (d.settings.volume = 0.2))); // offline
    at(50);
    O.act(() => updateProfile((d) => void (d.settings.theme = 'dark')));
    await O.sync();
    at(60);
    await N.sync();
    await O.sync();
    await N.sync();
    expect(N.s.theme).toBe('dark');
    expect(N.s).toMatchObject({ sound: false, volume: O.s.volume, theme: O.s.theme });
  });

  it('a copy an older device wrote (no mirror) counts every setting as changed at settingsAt, as before', async () => {
    const backend = memoryBackend();
    const N = new Dev(backend);
    const O = new Dev(backend, 0, oldParts());
    const code = newSyncCode();
    at(0);
    O.profile = normalizeProfile({ onboarded: true, settings: { ...normalizeProfile({}).settings, sound: false }, settingsAt: T0 + 5000, updatedAt: T0 + 5000 });
    await O.link(code);
    at(10);
    await N.link(code, { mustExist: true });
    expect(N.s.sound).toBe(false);
    expect(stampsOfSettings(N.profile).sound).toBe(T0 + 5000);
  });
});

describe('the first sync of a linked device', () => {
  it('a device that links in the main app uploads its kids in its first sync, and another gets them', async () => {
    const backend = memoryBackend();
    const A = new Dev(backend);
    const B = new Dev(backend);
    withKid(A);
    A.kids.kids[0].settings.pipVoice = 'rocket';
    const code = newSyncCode();
    at(0);
    await A.link(code);
    expect(Object.keys((await stored(backend, code)).parts)).toEqual(expect.arrayContaining(['profile', 'kids', 'kids-stamps', 'profile-stamps']));
    at(10);
    await B.link(code, { mustExist: true });
    expect(B.kid().settings.pipVoice).toBe('rocket');
  });
});
