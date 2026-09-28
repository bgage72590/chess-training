import { describe, expect, it } from 'vitest';
import { thinkTimeMs } from '../src/lib/thinkTime';

const MIDDLEGAME = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N2N2/PP2BPPP/R2QKB1R w KQ - 0 9';

describe('coach thinking time', () => {
  it('stays between about half a second and under three seconds', () => {
    for (const rnd of [0, 0.5, 1]) {
      const ms = thinkTimeMs({ fen: MIDDLEGAME, moveNumber: 12, rnd });
      expect(ms).toBeGreaterThanOrEqual(550);
      expect(ms).toBeLessThanOrEqual(2600);
    }
  });

  it('is quicker in the opening, on recaptures and with one legal move', () => {
    const think = thinkTimeMs({ fen: MIDDLEGAME, moveNumber: 12, rnd: 0.5 });
    expect(thinkTimeMs({ fen: MIDDLEGAME, moveNumber: 2, rnd: 0.5 })).toBeLessThan(think);
    expect(thinkTimeMs({ fen: MIDDLEGAME, moveNumber: 12, afterCapture: true, rnd: 0.5 })).toBeLessThan(think);
    expect(thinkTimeMs({ fen: '7k/8/8/8/8/8/5q2/7K w - - 0 1', moveNumber: 30, rnd: 0.5 })).toBeLessThan(800);
  });
});

describe('the computer reply speed', () => {
  it('Relaxed never answers within a second, and none takes longer than four and a half', async () => {
    const { paceMs, PACES } = await import('../src/lib/replyPace');
    for (const base of [300, 450, 700, 1500, 2600, 9000]) {
      const ms = paceMs(base, 'relaxed');
      expect(ms).toBeGreaterThanOrEqual(1000);
      expect(ms).toBeLessThanOrEqual(4500);
    }
    // The quickest coach reply used to be about half a second: recaptures, the opening.
    expect(thinkTimeMs({ fen: MIDDLEGAME, moveNumber: 2, afterCapture: true, rnd: 0, speed: 'relaxed' })).toBeGreaterThanOrEqual(1000);
    expect(PACES.relaxed.glide).toBeGreaterThan(PACES.standard.glide);
    expect(PACES.quick.glide).toBeLessThan(PACES.standard.glide);
  });

  it('Standard keeps the old times and Quick shortens them', async () => {
    const { paceMs } = await import('../src/lib/replyPace');
    expect(paceMs(700, 'standard')).toBe(700);
    expect(thinkTimeMs({ fen: MIDDLEGAME, moveNumber: 12, rnd: 0.5, speed: 'standard' })).toBe(thinkTimeMs({ fen: MIDDLEGAME, moveNumber: 12, rnd: 0.5 }));
    expect(paceMs(700, 'quick')).toBeLessThan(700);
    for (const rnd of [0, 0.5, 1]) {
      const relaxed = thinkTimeMs({ fen: MIDDLEGAME, moveNumber: 12, rnd, speed: 'relaxed' });
      expect(relaxed).toBeGreaterThan(thinkTimeMs({ fen: MIDDLEGAME, moveNumber: 12, rnd, speed: 'standard' }));
    }
  });

  it('is Relaxed for everyone by default, including profiles saved before the setting existed', async () => {
    const { defaultProfile, normalizeProfile } = await import('../src/store/profile');
    expect(defaultProfile().settings.replySpeed).toBe('relaxed');
    const old = { settings: { boardTheme: 'walnut', sound: true } } as never;
    expect(normalizeProfile(old).settings.replySpeed).toBe('relaxed');
    expect(normalizeProfile({ settings: { replySpeed: 'quick' } } as never).settings.replySpeed).toBe('quick');
    expect(normalizeProfile({ settings: { replySpeed: 'warp' } } as never).settings.replySpeed).toBe('relaxed');
  });
});
