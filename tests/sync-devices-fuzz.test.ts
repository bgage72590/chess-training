// Fuzz: three linked devices with clocks that disagree (up to a year) make random settings changes,
// go offline and sync in random order, through the real engine, parts and stores (the way
// sound-sync.test.ts plays devices). Seeded, so a failure reproduces.
//
// Properties: (1) after everyone has synced twice all devices, and the copy, agree on every setting
// and every stamp; (2) the value that stands for a setting is a change nobody made a later change
// to after seeing it (a change made after seeing another one is never lost to it, whatever the
// clocks say); (3) quiet mode never reaches the copy or another device.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryBackend } from '../src/sync/backend';
import { SyncEngine } from '../src/sync/engine';
import { __clockForTests } from '../src/sync/clock';
import { profileSyncParts } from '../src/sync';
import { newSyncCode } from '../src/sync/code';
import { getProfile, normalizeProfile, replaceProfile, updateProfile } from '../src/store/profile';
import { __setKidsStateForTests, defaultKidsState, getKids, newKid, updateKid, type KidsState } from '../src/kids/store/kidsStore';
import { kidsSyncParts } from '../src/kids/store/syncKids';
import { setQuiet } from '../src/kids/store/quiet';
import { mulberry32 } from '../src/kids/lib/rng';

vi.mock('../src/lib/toast', () => ({ toast: vi.fn() }));

const T0 = new Date('2026-09-30T12:00:00Z').getTime();
const YEAR = 365 * 24 * 3_600_000;
const THEMES = ['walnut', 'marble', 'ink', 'rose', 'tourney'] as const;
const SKEWS = [0, 0, 0, 10 * 60_000, -10 * 60_000, 3_000, -3_000, YEAR, -YEAR];
let realNow = T0;

/** The fields the fuzz changes: every change writes a value nobody wrote before, so a value names its change. */
const FIELDS = ['p.sound', 'p.volume', 'p.theme', 'k.pipVoice', 'k.rate', 'k.name'] as const;
type Field = (typeof FIELDS)[number];

class Dev {
  profile = normalizeProfile({ onboarded: true });
  kids: KidsState = defaultKidsState();
  floor = 0;
  saved: { code: string; lastSyncedAt?: number } | null = null;
  engine: SyncEngine;
  /** The changes this device has seen, per field. */
  known = new Map<Field, Set<number>>();
  constructor(backend: ReturnType<typeof memoryBackend>, public skewMs: number) {
    this.engine = new SyncEngine(backend, [...profileSyncParts(), ...kidsSyncParts()], { load: () => this.saved, save: (s) => void (this.saved = s) });
  }
  enter() {
    vi.setSystemTime(realNow + this.skewMs);
    __clockForTests.set(this.floor);
    replaceProfile(this.profile, { keepTimestamp: true });
    __setKidsStateForTests(this.kids);
  }
  leave() {
    this.profile = getProfile();
    this.kids = getKids();
    this.floor = __clockForTests.get();
  }
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
}

const valueOf = (d: Dev, f: Field): unknown => {
  const k = d.kids.kids.find((x) => x.id === 'k-mia');
  switch (f) {
    case 'p.sound': return d.profile.settings.sound;
    case 'p.volume': return d.profile.settings.volume;
    case 'p.theme': return d.profile.settings.boardTheme;
    case 'k.pipVoice': return k?.settings.pipVoice;
    case 'k.rate': return k?.settings.rate;
    case 'k.name': return k?.name;
  }
};

/** A value that names change number n. */
const valueFor = (f: Field, n: number): unknown => {
  switch (f) {
    case 'p.sound': return n % 2 === 0; // (a boolean cannot name its change: this field is only checked for agreement)
    case 'p.volume': return 0.001 * n;
    case 'p.theme': return THEMES[n % 5]; // (a few values repeat: the check below accepts any change that stands with that value)
    case 'k.pipVoice': return `v${n}`;
    case 'k.rate': return 0.7 + n * 0.0001;
    case 'k.name': return `N${n}`;
  }
};

async function run(seed: number, steps: number) {
  const rng = mulberry32(seed);
  const backend = memoryBackend();
  const devs = [0, 1, 2].map(() => new Dev(backend, SKEWS[Math.floor(rng() * SKEWS.length)]));
  for (const d of devs) d.kids = { ...defaultKidsState(), kids: [newKid({ id: 'k-mia', name: 'Mia', band: 'explorer' as never, start: 'new', now: 1 })], updatedAt: T0 };
  const code = newSyncCode();
  realNow = T0;
  for (const d of devs) {
    d.enter();
    await d.engine.link(code);
    d.leave();
  }
  const copyKnown = new Map<Field, Set<number>>();
  const supersedes = new Map<number, Set<number>>();
  const changeField = new Map<number, Field>();
  const valueOfChange = new Map<number, unknown>();
  let n = 0;
  const seen = (m: Map<Field, Set<number>>, f: Field) => m.get(f) ?? m.set(f, new Set()).get(f)!;

  for (let i = 0; i < steps; i++) {
    realNow += Math.floor(rng() * 90_000) + (rng() < 0.05 ? 3_600_000 : 0);
    const d = devs[Math.floor(rng() * devs.length)];
    const r = rng();
    if (r < 0.55) {
      const f = FIELDS[Math.floor(rng() * FIELDS.length)];
      const before = valueOf(d, f);
      const id = ++n;
      const v = valueFor(f, id);
      d.act(() => {
        if (f === 'p.sound') updateProfile((p) => void (p.settings.sound = !p.settings.sound));
        else if (f === 'p.volume') updateProfile((p) => void (p.settings.volume = v as number));
        else if (f === 'p.theme') updateProfile((p) => void (p.settings.boardTheme = THEMES[id % 5]));
        else if (f === 'k.pipVoice') updateKid('k-mia', (k) => void (k.settings.pipVoice = v as string));
        else if (f === 'k.rate') updateKid('k-mia', (k) => void (k.settings.rate = v as number));
        else updateKid('k-mia', (k) => void (k.name = v as string));
      });
      if (valueOf(d, f) !== before) {
        changeField.set(id, f);
        valueOfChange.set(id, valueOf(d, f));
        supersedes.set(id, new Set(seen(d.known, f)));
        seen(d.known, f).add(id);
      }
    } else if (r < 0.62) {
      d.act(() => setQuiet('k-mia', rng() < 0.7));
    } else {
      // a sync: this device sees what the copy has, and the copy what it has
      await d.sync();
      for (const f of FIELDS) {
        const u = new Set([...seen(d.known, f), ...seen(copyKnown, f)]);
        d.known.set(f, u);
        copyKnown.set(f, new Set(u));
      }
    }
  }
  // everyone syncs twice
  for (let round = 0; round < 2; round++)
    for (const d of devs) {
      realNow += 1000;
      await d.sync();
      for (const f of FIELDS) {
        const u = new Set([...seen(d.known, f), ...seen(copyKnown, f)]);
        d.known.set(f, u);
        copyKnown.set(f, new Set(u));
      }
    }
  // once everything has settled a sync only reads: no writes, whoever asks
  const settled = (await backend.get(code))!.version;
  for (let round = 0; round < 2; round++)
    for (const d of devs) {
      realNow += 61_000;
      await d.sync();
    }
  const churn = (await backend.get(code))!.version - settled;
  return { devs, backend, code, supersedes, changeField, valueOfChange, n, churn };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  __clockForTests.set(0);
});
afterEach(() => vi.useRealTimers());

describe('three devices with wrong clocks', () => {
  for (let seed = 1; seed <= 60; seed++) {
    it(`seed ${seed}: everything ends up agreed, and no change made after seeing another one is lost to it`, async () => {
      const { devs, backend, code, supersedes, changeField, valueOfChange, churn } = await run(seed, 40 + (seed % 5) * 20);
      const [a, b, c] = devs;
      expect(churn, 'writes to the copy after everyone had settled').toBe(0);
      for (const f of FIELDS) {
        expect(valueOf(b, f), `${f} a vs b`).toEqual(valueOf(a, f));
        expect(valueOf(c, f), `${f} a vs c`).toEqual(valueOf(a, f));
      }
      const data = (await backend.get(code))!.data as { parts: Record<string, any> };
      const copyProfile = data.parts.profile;
      expect(copyProfile.settings).toEqual(a.profile.settings);
      // stamps agree on all devices
      expect(b.profile.settingsStamps).toEqual(a.profile.settingsStamps);
      expect(c.profile.settingsStamps).toEqual(a.profile.settingsStamps);
      const ka = a.kids.kids[0];
      expect(b.kids.kids[0].stamps).toEqual(ka.stamps);
      expect(c.kids.kids[0].stamps).toEqual(ka.stamps);
      // quiet mode never travels
      expect(JSON.stringify(data)).not.toMatch(/quiet|muted/);
      // causal: the winner of each field is a change that no later change (made after seeing it) replaced
      const superseded = new Set<number>();
      for (const s of supersedes.values()) for (const x of s) superseded.add(x);
      for (const f of ['p.volume', 'p.theme', 'k.pipVoice', 'k.rate', 'k.name'] as const) {
        const all = [...changeField].filter(([, ff]) => ff === f).map(([id]) => id);
        if (!all.length) continue;
        const winners = all.filter((id) => valueOfChange.get(id) === valueOf(a, f) && !superseded.has(id));
        // (a theme repeats: several changes can share a value)
        expect(winners.length, `${f}: the standing value ${String(valueOf(a, f))} is not a change that stands`).toBeGreaterThan(0);
      }
    });
  }
});
