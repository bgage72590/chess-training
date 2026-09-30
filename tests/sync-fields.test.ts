// Settings that sync field by field: the clock behind the stamps (sync/clock.ts), the merge of stamped
// fields (sync/fields.ts) and how the grown-up profile and a kid use them. The properties run on
// seeded random histories, in the style of kids-fuzz.test.ts, so a failure reproduces: the merge is
// symmetric, idempotent and associative on data with and without stamps (older versions) and with
// stamps far in the future (a wrong clock), and per field the later stamp wins.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_AHEAD_MS, __clockForTests, nextStamp, observeStamp, observeStamps } from '../src/sync/clock';
import { legacyStamps, mergeFields, mirrorOf, readMirror, readStamps, reconcile, stableJson, stampChanges, type Fields } from '../src/sync/fields';
import { joiningCopy, mergeProfiles } from '../src/sync/merge';
import { defaultProfile, getProfile, normalizeProfile, replaceProfile, stampsOfSettings, updateProfile, type Profile } from '../src/store/profile';
import { __setKidsStateForTests, choiceFields, defaultKidsState, getKids, newKid, normalizeKids, stampsOfKid, updateKid, withChoiceFields, type KidProfile } from '../src/kids/store/kidsStore';
import { mergeKid } from '../src/kids/store/syncKids';
import { mulberry32 } from '../src/kids/lib/rng';

const T0 = new Date('2026-09-30T12:00:00Z').getTime();
const YEAR = 365 * 24 * 3_600_000;
const pickOf = <T,>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  __clockForTests.set(0);
});
afterEach(() => vi.useRealTimers());

describe('the clock behind the stamps', () => {
  it('never gives the same stamp twice, or a lower one when the wall clock goes back', () => {
    const a = nextStamp();
    const b = nextStamp();
    expect(a).toBe(T0);
    expect(b).toBe(T0 + 1);
    vi.setSystemTime(T0 - HOURS(3));
    expect(nextStamp()).toBe(T0 + 2);
  });

  it('is never behind a stamp it has read (an edit after a pull outranks what was pulled)', () => {
    observeStamp(T0 + 60_000);
    expect(nextStamp()).toBe(T0 + 60_001);
    observeStamps({ x: T0 + 120_000, y: 5 }, T0 + 90_000);
    expect(nextStamp()).toBe(T0 + 120_001);
  });

  it('lets what it reads move it at most 5 minutes past its own clock', () => {
    observeStamp(T0 + YEAR);
    expect(nextStamp()).toBe(T0 + MAX_AHEAD_MS + 1);
    observeStamps({ a: T0 + 10 * YEAR }, T0 + 2 * YEAR);
    expect(__clockForTests.get()).toBeLessThanOrEqual(T0 + MAX_AHEAD_MS + 1);
    observeStamp(NaN);
    observeStamp('x');
    observeStamp(Infinity);
    expect(nextStamp()).toBeLessThanOrEqual(T0 + MAX_AHEAD_MS + 2);
  });

  it('goes one past the stamp it replaces, wherever that stamp came from, without dragging the rest along', () => {
    const t = nextStamp(T0 + YEAR);
    expect(t).toBe(T0 + YEAR + 1);
    expect(__clockForTests.get()).toBeLessThanOrEqual(T0 + MAX_AHEAD_MS);
    expect(nextStamp()).toBeLessThanOrEqual(T0 + MAX_AHEAD_MS + 1); // another setting is not stamped in the future
  });
});

const HOURS = (n: number) => n * 3_600_000;

describe('stampChanges', () => {
  it('stamps the fields that changed with one new stamp, and leaves the others', () => {
    const r = stampChanges({ a: 1, b: 2, c: 3 }, { a: 1, b: 5, c: 9 }, { a: 100, b: 200 })!;
    expect(r.stamps).toEqual({ a: 100, b: r.stamp, c: r.stamp });
    expect(r.stamp).toBeGreaterThan(200);
    expect(r.at).toBe(r.stamp);
  });

  it('is null when nothing changed, and compares objects by value', () => {
    expect(stampChanges({ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 } }, {})).toBeNull();
    expect(stampChanges({ a: [1, 2] }, { a: [2, 1] }, {})).not.toBeNull();
  });

  it('goes past the highest stamp of what it changed, even one far in the future', () => {
    const r = stampChanges({ a: 1 }, { a: 2 }, { a: T0 + YEAR })!;
    expect(r.stamp).toBe(T0 + YEAR + 1);
  });
});

describe('the mirror', () => {
  it('reads back what mirrorOf wrote, through JSON', () => {
    const f: Fields = { values: { a: 1, b: { x: [1, 2] } }, stamps: { a: 5 } };
    const m = readMirror(JSON.parse(JSON.stringify(mirrorOf(f))))!;
    expect(m).toEqual({ v: 1, at: 5, stamps: { a: 5 }, base: f.values });
    expect(readMirror({ v: 2 })).toBeUndefined();
    expect(readMirror('x')).toBeUndefined();
  });

  it('reads only finite positive stamps, for the keys asked for', () => {
    expect(readStamps({ a: 5, b: -1, c: NaN, d: 'x', e: 0, f: Infinity }, ['a', 'b', 'c', 'd', 'e', 'f'])).toEqual({ a: 5 });
    expect(readStamps({ a: 5, b: 6 }, ['a'])).toEqual({ a: 5 });
    expect(readStamps({ a: 0 })).toBeUndefined();
    expect(readStamps([5])).toBeUndefined();
  });

  it('stamps a copy with no mirror as changed at settingsAt (an older version wrote it)', () => {
    expect(reconcile({ a: 1, b: 2 }, 50, undefined)).toEqual({ a: 50, b: 50 });
    expect(reconcile({ a: 1 }, undefined, undefined)).toEqual({});
  });

  it("takes the mirror's stamp for a field still holding the value it was written for, and settingsAt for one an older version changed since", () => {
    const m = mirrorOf({ values: { a: 1, b: 2, c: { x: 1 } }, stamps: { a: 10, c: 20 } });
    // b was never changed (no stamp); a is untouched; c is the same object; d is new
    expect(reconcile({ a: 1, b: 2, c: { x: 1 }, d: 4 }, 99, m)).toEqual({ a: 10, c: 20, d: 99 });
    expect(reconcile({ a: 7, b: 2, c: { x: 1 } }, 99, m)).toEqual({ a: 99, c: 20 });
  });

  it('counts legacy data as stamped at settingsAt for every field', () => {
    expect(legacyStamps(['a', 'b'], 7)).toEqual({ a: 7, b: 7 });
    expect(legacyStamps(['a', 'b'], undefined)).toEqual({});
    expect(legacyStamps(['a'], 0)).toEqual({});
  });
});

// ---------- properties ----------

const KEYS = ['a', 'b', 'c', 'settings.x', 'settings.y', 'settings.z'] as const;
const VALUES: unknown[] = [1, 2, 'x', 'y', true, null, { k: 1 }, { k: 2 }, [1], [2, 3]];
const STAMPS = [undefined, 0, 1, 2, 3, 5, 8, 13, T0 - 1000, T0, T0 + 500, T0 + MAX_AHEAD_MS + 1, T0 + YEAR, T0 - YEAR];

function randFields(rng: () => number): Fields {
  const values: Record<string, unknown> = {};
  const stamps: Record<string, number> = {};
  for (const k of KEYS) {
    if (rng() < 0.3) continue;
    values[k] = pickOf(rng, VALUES);
    const t = pickOf(rng, STAMPS);
    if (t) stamps[k] = t;
  }
  return { values, stamps };
}

const canon = (f: Fields) => stableJson({ values: f.values, stamps: Object.fromEntries(Object.entries(f.stamps).filter(([, t]) => t > 0)) });

describe('merging stamped fields (seeded random histories)', () => {
  it('is symmetric, idempotent and associative', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const rng = mulberry32(seed);
      const [a, b, c] = [randFields(rng), randFields(rng), randFields(rng)];
      const ab = mergeFields(a, b);
      expect(canon(ab), `seed ${seed}`).toBe(canon(mergeFields(b, a)));
      expect(canon(mergeFields(a, a)), `seed ${seed}`).toBe(canon(a));
      expect(canon(mergeFields(ab, ab)), `seed ${seed}`).toBe(canon(ab));
      expect(canon(mergeFields(ab, c)), `seed ${seed}`).toBe(canon(mergeFields(a, mergeFields(b, c))));
      // and the merged stamps are the highest of the two
    }
  });

  it('per field: the later stamp wins, a field only one side has is kept, ties take the greater JSON', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const rng = mulberry32(seed * 7);
      const [a, b] = [randFields(rng), randFields(rng)];
      const m = mergeFields(a, b);
      for (const k of KEYS) {
        const inA = k in a.values;
        const inB = k in b.values;
        if (!inA && !inB) {
          expect(k in m.values).toBe(false);
          continue;
        }
        const ta = a.stamps[k] ?? 0;
        const tb = b.stamps[k] ?? 0;
        let want: unknown;
        if (!inB) want = a.values[k];
        else if (!inA) want = b.values[k];
        else if (ta !== tb) want = ta > tb ? a.values[k] : b.values[k];
        else want = stableJson(a.values[k]) >= stableJson(b.values[k]) ? a.values[k] : b.values[k];
        expect(stableJson(m.values[k]), `seed ${seed} ${k}`).toBe(stableJson(want));
        expect(m.stamps[k] ?? 0, `seed ${seed} ${k}`).toBe(Math.max(inA ? ta : 0, inB ? tb : 0));
      }
    }
  });

  it('does not depend on the time it runs at (a far-future stamp is compared as it is)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = mulberry32(seed * 13);
      const [a, b] = [randFields(rng), randFields(rng)];
      vi.setSystemTime(T0);
      const early = canon(mergeFields(a, b));
      vi.setSystemTime(T0 + 2 * YEAR);
      expect(canon(mergeFields(a, b)), `seed ${seed}`).toBe(early);
      expect(canon(mergeFields(mergeFields(a, b), b)), `seed ${seed}`).toBe(early);
    }
  });
});

const SETTINGS_CHOICES: Record<string, unknown[]> = {
  sound: [true, false],
  volume: [0.1, 0.4, 0.8, 1],
  theme: ['system', 'light', 'dark'],
  boardTheme: ['walnut', 'marble', 'ink'],
  dailyGoal: [30, 60, 120],
  futureSetting: ['on', 'off', undefined], // a field only a newer version has
};

function randProfile(rng: () => number): Profile {
  const p = normalizeProfile({ onboarded: true });
  const settings: Record<string, unknown> = { ...p.settings };
  for (const [k, vs] of Object.entries(SETTINGS_CHOICES)) {
    const v = pickOf(rng, vs);
    if (v !== undefined && (rng() < 0.6 || k in settings)) settings[k] = v;
  }
  p.settings = settings as unknown as Profile['settings'];
  const mode = pickOf(rng, ['fresh', 'legacy', 'stamped', 'future', 'behind'] as const);
  if (mode === 'legacy') p.settingsAt = pickOf(rng, [1, 100, T0 - 5000, T0, T0 + YEAR]);
  if (mode === 'stamped' || mode === 'future' || mode === 'behind') {
    const stamps: Record<string, number> = {};
    for (const k of Object.keys(settings)) if (rng() < 0.6) stamps[k] = mode === 'future' ? pickOf(rng, [T0 + YEAR, T0 + 2 * YEAR, T0 + 1000]) : mode === 'behind' ? pickOf(rng, [1, 5, T0 - YEAR]) : pickOf(rng, [T0 - 2000, T0 - 1000, T0, T0 + 1000]);
    p.settingsStamps = stamps;
    p.settingsAt = Math.max(0, ...Object.values(stamps)) || undefined;
  }
  return p;
}

/** What a profile says about its settings, with the stamps counted the way a merge counts them. */
const settingsView = (p: Profile) => stableJson({ settings: p.settings, stamps: Object.fromEntries(Object.entries(stampsOfSettings(p)).filter(([, t]) => t > 0)), at: p.settingsAt ?? 0 });

describe('merging the grown-up settings (seeded random histories, with and without stamps)', () => {
  it('is symmetric, idempotent and associative, whatever the clock said when the stamps were written', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed * 31);
      const [a, b, c] = [randProfile(rng), randProfile(rng), randProfile(rng)];
      const ab = mergeProfiles(a, b);
      expect(settingsView(ab), `seed ${seed}`).toBe(settingsView(mergeProfiles(b, a)));
      expect(settingsView(mergeProfiles(a, a)), `seed ${seed}`).toBe(settingsView(a));
      expect(settingsView(mergeProfiles(ab, ab)), `seed ${seed}`).toBe(settingsView(ab));
      expect(settingsView(mergeProfiles(ab, c)), `seed ${seed}`).toBe(settingsView(mergeProfiles(a, mergeProfiles(b, c))));
      // settingsAt is always the highest stamp, so an older version compares the right number
      const m = mergeProfiles(ab, c);
      expect(m.settingsAt ?? 0).toBe(Math.max(0, ...Object.values(stampsOfSettings(m))));
    }
  });

  it('keeps every field of both sides and takes the later change of each', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = mulberry32(seed * 17);
      const [a, b] = [randProfile(rng), randProfile(rng)];
      const m = mergeProfiles(a, b);
      const [sa, sb] = [stampsOfSettings(a), stampsOfSettings(b)];
      for (const k of new Set([...Object.keys(a.settings), ...Object.keys(b.settings)])) {
        const va = (a.settings as unknown as Record<string, unknown>)[k];
        const vb = (b.settings as unknown as Record<string, unknown>)[k];
        const got = (m.settings as unknown as Record<string, unknown>)[k];
        if (stableJson(va) === stableJson(vb)) expect(stableJson(got)).toBe(stableJson(va));
        else if (!(k in b.settings)) expect(stableJson(got)).toBe(stableJson(va));
        else if (!(k in a.settings)) expect(stableJson(got)).toBe(stableJson(vb));
        else if ((sa[k] ?? 0) !== (sb[k] ?? 0)) expect(stableJson(got), `seed ${seed} ${k}`).toBe(stableJson((sa[k] ?? 0) > (sb[k] ?? 0) ? va : vb));
      }
    }
  });

  it('a device joining never lets a setting it never changed beat the copy', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = mulberry32(seed * 23);
      const copy = randProfile(rng);
      const fresh = normalizeProfile({ onboarded: true });
      // the new device touched only one setting
      const k = pickOf(rng, ['theme', 'dailyGoal'] as const);
      const touched: Profile = { ...fresh, settings: { ...fresh.settings, [k]: k === 'theme' ? 'dark' : 120 }, settingsStamps: { [k]: T0 + 1 }, settingsAt: T0 + 1 };
      const m = mergeProfiles(joiningCopy(touched, copy), copy);
      for (const key of Object.keys(copy.settings)) {
        if (key === k) continue;
        // (with equal stamps at 0 the values are equal or the copy's own default: never the newcomer's untouched default over a stamped one)
        if ((stampsOfSettings(copy)[key] ?? 0) > 0) expect(stableJson((m.settings as unknown as Record<string, unknown>)[key]), `seed ${seed} ${key}`).toBe(stableJson((copy.settings as unknown as Record<string, unknown>)[key]));
      }
    }
  });
});

const KID_SETTING_CHOICES: Record<string, unknown[]> = {
  pipVoice: ['', 'honey', 'rocket', 'device'],
  voice: ['auto', 'first', 'off'],
  rate: [null, 0.8, 1.1],
  sound: [true, false],
  hints: ['generous', 'normal', 'few'],
  pipVolume: [0.2, 0.9], // a newer version's setting
};

function randKid(rng: () => number): KidProfile {
  const k = newKid({ id: 'k-mia', name: pickOf(rng, ['Mia', 'Mimi']), band: pickOf(rng, ['explorer', 'sprout'] as const) as never, start: 'new', now: 1 });
  const settings = { ...k.settings } as unknown as Record<string, unknown>;
  for (const [key, vs] of Object.entries(KID_SETTING_CHOICES)) if (rng() < 0.7) settings[key] = pickOf(rng, vs);
  k.settings = settings as unknown as KidProfile['settings'];
  if (rng() < 0.4) k.avatar = { ...k.avatar, color: pickOf(rng, ['sea', 'grass', 'sun'] as const) as never };
  const mode = pickOf(rng, ['fresh', 'legacy', 'stamped', 'future'] as const);
  if (mode === 'legacy') k.settingsAt = pickOf(rng, [1, T0 - 5000, T0, T0 + YEAR]);
  if (mode === 'stamped' || mode === 'future') {
    const stamps: Record<string, number> = {};
    for (const f of Object.keys(choiceFields(k))) if (rng() < 0.5) stamps[f] = pickOf(rng, mode === 'future' ? [T0 + YEAR, T0 + 1000] : [T0 - 2000, T0, T0 + 1000, 3]);
    k.stamps = stamps;
    k.settingsAt = Math.max(0, ...Object.values(stamps)) || undefined;
  }
  return k;
}
const kidView = (k: KidProfile) => stableJson({ choices: choiceFields(k), stamps: Object.fromEntries(Object.entries(stampsOfKid(k)).filter(([, t]) => t > 0)), at: k.settingsAt ?? 0 });

describe("merging a kid's name, avatar, age group and settings (seeded random histories)", () => {
  it('is symmetric, idempotent and associative, with and without stamps, and keeps fields a newer version added', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed * 41);
      const [a, b, c] = [randKid(rng), randKid(rng), randKid(rng)];
      const ab = mergeKid(a, b);
      expect(kidView(ab), `seed ${seed}`).toBe(kidView(mergeKid(b, a)));
      expect(kidView(mergeKid(a, a)), `seed ${seed}`).toBe(kidView(a));
      expect(kidView(mergeKid(ab, ab)), `seed ${seed}`).toBe(kidView(ab));
      expect(kidView(mergeKid(ab, c)), `seed ${seed}`).toBe(kidView(mergeKid(a, mergeKid(b, c))));
      const m = mergeKid(ab, c);
      expect(m.settingsAt ?? 0).toBe(Math.max(0, ...Object.values(stampsOfKid(m))));
      for (const key of Object.keys(a.settings)) expect(key in m.settings, `seed ${seed} ${key}`).toBe(true);
    }
  });

  it('withChoiceFields is choiceFields the other way round', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const k = randKid(mulberry32(seed));
      expect(stableJson(choiceFields(withChoiceFields(k, choiceFields(k))))).toBe(stableJson(choiceFields(k)));
    }
  });
});

// ---------- the stores ----------

describe('updateProfile stamps each setting on its own', () => {
  beforeEach(() => replaceProfile(defaultProfile(), { keepTimestamp: true }));

  it('stamps the settings that changed, with one stamp; settingsAt is the highest', () => {
    updateProfile((d) => void (d.settings.volume = 0.3));
    const first = getProfile();
    expect(first.settingsStamps).toEqual({ volume: first.settingsAt });
    vi.setSystemTime(T0 + 5000);
    updateProfile((d) => void ((d.settings.sound = false), (d.settings.theme = 'dark')));
    const p = getProfile();
    expect(p.settingsStamps!.volume).toBe(first.settingsAt);
    expect(p.settingsStamps!.sound).toBe(p.settingsStamps!.theme);
    expect(p.settingsAt).toBe(p.settingsStamps!.sound);
    expect(p.settingsAt).toBeGreaterThan(first.settingsAt!);
  });

  it('stamps nothing when no setting changed (progress, or the same value)', () => {
    updateProfile((d) => void (d.xp = 10));
    expect(getProfile().settingsStamps).toBeUndefined();
    expect(getProfile().settingsAt).toBeUndefined();
    updateProfile((d) => void (d.settings.sound = true));
    expect(getProfile().settingsStamps).toBeUndefined();
  });

  it('a profile from before stamps gives every setting its old settingsAt when the first one changes', () => {
    replaceProfile(normalizeProfile({ onboarded: true, settingsAt: T0 - 60_000 }), { keepTimestamp: true });
    updateProfile((d) => void (d.settings.volume = 0.2));
    const s = getProfile().settingsStamps!;
    expect(s.sound).toBe(T0 - 60_000);
    expect(s.volume).toBeGreaterThan(T0 - 60_000);
    expect(Object.keys(s).sort()).toEqual(Object.keys(getProfile().settings).sort());
  });

  it('settings it does not know stay, and stamps for settings that are gone do not', () => {
    const n = normalizeProfile({ onboarded: true, settings: { ...defaultProfile().settings, futureSetting: 'x' } as never, settingsStamps: { futureSetting: 5, gone: 9, sound: 7 } });
    expect((n.settings as unknown as Record<string, unknown>).futureSetting).toBe('x');
    expect(n.settingsStamps).toEqual({ futureSetting: 5, sound: 7 });
  });

  it('a change to a setting stamped far in the future goes past that stamp, but the profile is not marked changed that far ahead', () => {
    replaceProfile(normalizeProfile({ onboarded: true, settingsStamps: { sound: T0 + YEAR }, settingsAt: T0 + YEAR }), { keepTimestamp: true });
    updateProfile((d) => void (d.settings.sound = false));
    expect(getProfile().settingsStamps!.sound).toBe(T0 + YEAR + 1);
    expect(getProfile().updatedAt).toBeLessThanOrEqual(T0 + MAX_AHEAD_MS);
  });

  it('reading stored stamps raises the clock, so the next change is stamped past them', () => {
    __clockForTests.set(0);
    replaceProfile(normalizeProfile({ onboarded: true, settingsStamps: { sound: T0 + 90_000 }, settingsAt: T0 + 90_000 }), { keepTimestamp: true });
    updateProfile((d) => void (d.settings.volume = 0.5));
    expect(getProfile().settingsStamps!.volume).toBe(T0 + 90_001);
  });
});

describe('a kid changes stamp each choice on its own', () => {
  const kid = () => newKid({ id: 'k-mia', name: 'Mia', band: 'explorer' as never, start: 'new', now: 1 });
  beforeEach(() => __setKidsStateForTests({ ...defaultKidsState(), kids: [kid()] }));

  it("a grown-up's choices are stamped one at a time, play is not, and settingsAt is the highest stamp", () => {
    updateKid('k-mia', (k) => void (k.nodes['w1-a'] = { stars: 1, plays: 1, last: 5, box: 1, due: '2026-09-30', masteredDays: [], lastItems: [], losses: 0, ease: 0 }));
    expect(getKids().kids[0].stamps).toBeUndefined();
    updateKid('k-mia', (k) => void (k.settings.pipVoice = 'rocket'));
    const first = getKids().kids[0];
    expect(first.stamps).toEqual({ 'settings.pipVoice': first.settingsAt });
    vi.setSystemTime(T0 + 3000);
    updateKid('k-mia', (k) => void ((k.name = 'Mimi'), (k.settings.rate = 1.1)));
    const k = getKids().kids[0];
    expect(k.stamps!['settings.pipVoice']).toBe(first.settingsAt);
    expect(k.stamps!.name).toBe(k.stamps!['settings.rate']);
    expect(k.settingsAt).toBe(k.stamps!.name);
    expect(getKids().updatedAt).toBe(k.settingsAt);
  });

  it('settings a newer version added survive being read, and quiet mode saved as a setting is dropped from them', () => {
    const s = normalizeKids({ v: 1, kids: [{ id: 'k1', name: 'Mia', settings: { pipVolume: 0.5, muted: true, 'bad key': 1, deep: { a: [1, 2] } } }], family: {}, device: {} });
    expect(s.kids[0].settings).toMatchObject({ pipVolume: 0.5, deep: { a: [1, 2] } });
    expect(s.kids[0].settings).not.toHaveProperty('muted');
    expect(s.kids[0].settings).not.toHaveProperty('bad key');
  });
});
