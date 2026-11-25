import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
