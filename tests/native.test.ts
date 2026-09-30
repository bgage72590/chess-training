import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error a plain .mjs script, shared with the build
import { DEFAULT_KEEP, pruneVoices } from '../scripts/build-native.mjs';

// The native builds (`vite build --mode native`, the Mac and iPhone/iPad apps) differ from the web app in a few
// places that are switched by the build mode: each test loads fresh copies of the modules with that mode set.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const asNative = (native: boolean) => {
  vi.resetModules();
  vi.stubEnv('MODE', native ? 'native' : 'production');
  vi.stubEnv('PROD', true);
};

describe('the native app is the installed app', () => {
  it('registers no service worker and no install prompt, and counts as installed', async () => {
    asNative(true);
    const addEventListener = vi.fn();
    const register = vi.fn();
    vi.stubGlobal('window', { addEventListener, top: null, self: null });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit', maxTouchPoints: 5, serviceWorker: { register } });
    const m = await import('../src/pwa/install');
    addEventListener.mockClear(); // the router listens for hash changes as it loads
    m.setupInstall();
    expect(addEventListener).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    const state = JSON.parse(renderToStaticMarkup(createElement(() => JSON.stringify(m.useInstall()))).replace(/&quot;/g, '"'));
    expect(state).toMatchObject({ installed: true, how: 'native', canPrompt: false });
  });

  it('the web app still registers them', async () => {
    asNative(false);
    const addEventListener = vi.fn();
    vi.stubGlobal('window', { addEventListener, top: 1, self: 1 });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120', maxTouchPoints: 0, serviceWorker: {} });
    const m = await import('../src/pwa/install');
    addEventListener.mockClear();
    m.setupInstall();
    expect(addEventListener.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['load', 'beforeinstallprompt', 'appinstalled']));
  });

  it('reports no offline copy to save: the files are inside the app', async () => {
    vi.stubGlobal('navigator', { serviceWorker: {} });
    asNative(true);
    expect((await import('../src/pwa/offline')).offlineSupported()).toBe(false);
    asNative(false);
    expect((await import('../src/pwa/offline')).offlineSupported()).toBe(true);
  });
});

describe("Pip's voices in the native app", () => {
  it('are inside the app: the Grown-ups row says so instead of offering a download', async () => {
    asNative(true);
    const { VoicePackRow } = await import('../src/kids/screens/VoicePackRow');
    const html = renderToStaticMarkup(createElement(VoicePackRow, { voices: [{ id: 'sunny', name: 'Sunny', blurb: '' }], selected: 'sunny' }));
    expect(html).toContain('saved in the app');
    expect(html).not.toMatch(/Download/);
  });

  it('are never downloaded on their own', async () => {
    const env = (net: string[]) => ({
      caches: { open: async () => ({ keys: async () => [], match: async () => undefined, put: async () => undefined }) },
      fetch: async (url: string) => {
        net.push(url);
        return new Response(JSON.stringify({ v: 1, voice: 'x', version: 'v1', clips: { a: 1000 } }));
      },
      storage: { getItem: () => null, setItem: () => undefined },
      base: 'https://app.test/',
      estimate: async () => undefined,
      persist: () => undefined,
      connection: () => ({ type: 'wifi', saveData: false }),
      sleep: async () => undefined,
      now: () => 1,
    });
    asNative(false);
    const web: string[] = [];
    expect(await (await import('../src/kids/player/voicePack')).createVoicePacks(env(web) as never).autoDownload('sunny')).toBe(true);
    expect(web.length).toBeGreaterThan(0);
    asNative(true);
    const native: string[] = [];
    expect(await (await import('../src/kids/player/voicePack')).createVoicePacks(env(native) as never).autoDownload('sunny')).toBe(false);
    expect(native).toEqual([]);
  });
});

describe('the voices a native build carries (scripts/build-native.mjs)', () => {
  const build = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tempo-native-'));
    const voice = path.join(dir, 'voice');
    const ids = ['sunny', 'breezy', 'rocket', 'willow'];
    for (const id of ids) {
      fs.mkdirSync(path.join(voice, id), { recursive: true });
      fs.writeFileSync(path.join(voice, id, 'manifest.json'), '{"clips":{}}');
      fs.writeFileSync(path.join(voice, id, 'a.mp3'), 'x');
    }
    fs.writeFileSync(path.join(voice, 'voices.json'), JSON.stringify({ default: 'sunny', voices: ids.map((id) => ({ id, name: id })) }));
    return { dir, voice, ids };
  };

  it('keeps Sunny and Rocket, drops the rest and rewrites the list', () => {
    const { dir, voice } = build();
    expect(DEFAULT_KEEP).toEqual(['sunny', 'rocket']);
    expect(pruneVoices(dir)).toEqual(['sunny', 'rocket']);
    expect(fs.readdirSync(voice).sort()).toEqual(['rocket', 'sunny', 'voices.json']);
    const list = JSON.parse(fs.readFileSync(path.join(voice, 'voices.json'), 'utf8'));
    expect(list.voices.map((v: { id: string }) => v.id)).toEqual(['sunny', 'rocket']);
    expect(list.default).toBe('sunny');
  });

  it('moves the default to a voice that stays', () => {
    const { dir, voice } = build();
    expect(pruneVoices(dir, ['rocket'])).toEqual(['rocket']);
    expect(JSON.parse(fs.readFileSync(path.join(voice, 'voices.json'), 'utf8')).default).toBe('rocket');
  });

  it('refuses a voice that is not there, and a voice without its clip list', () => {
    const { dir, voice } = build();
    expect(() => pruneVoices(dir, ['sunny', 'nobody'])).toThrow(/nobody/);
    fs.rmSync(path.join(voice, 'sunny', 'manifest.json'));
    expect(() => pruneVoices(dir, ['sunny'])).toThrow(/manifest/);
  });
});
