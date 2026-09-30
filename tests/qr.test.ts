import { afterEach, describe, expect, it, vi } from 'vitest';
import { qrShape } from '../src/components/QrCode';

describe('qrShape', () => {
  afterEach(() => vi.doUnmock('qrcode-generator'));

  it('draws a square code with one path square per dark module', async () => {
    const shape = await qrShape('https://bgage72590.github.io/chess-training/');
    expect(shape).not.toBeNull();
    expect(shape!.n).toBeGreaterThanOrEqual(21);
    const dark = shape!.d.split('M').length - 1;
    expect(dark).toBeGreaterThan(shape!.n * 2);
    expect(dark).toBeLessThan(shape!.n * shape!.n);
  });
  it('gives the same code for the same text and a different one for other text', async () => {
    const a = await qrShape('https://a.example/');
    expect(await qrShape('https://a.example/')).toEqual(a);
    expect(await qrShape('https://b.example/')).not.toEqual(a);
  });
  it('is null, not a rejection, for text a QR code cannot hold', async () => {
    await expect(qrShape('x'.repeat(20000))).resolves.toBeNull();
  });
  it('is null, not a rejection, when the generator cannot be loaded (offline, not cached yet)', async () => {
    vi.resetModules();
    vi.doMock('qrcode-generator', () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    const { qrShape: fresh } = await import('../src/components/QrCode');
    await expect(fresh('https://a.example/')).resolves.toBeNull();
  });
});
