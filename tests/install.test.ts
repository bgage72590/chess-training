import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectHow, isIosDevice, resolveAppUrl, APP_URL } from '../src/pwa/install';
import { guideKind, hasFinishedFirst, InstallGuide, readGuideDismissed, shouldShowGuide, writeGuideDismissed } from '../src/components/InstallGuide';
import { storageSplitText } from '../src/components/StorageSplitNote';
import { InstallCard } from '../src/components/InstallCard';
import { copyAppLink, SHARE, ShareCard, shareApp } from '../src/components/ShareCard';
import { toast } from '../src/lib/toast';
import { kidsFinishedFirst } from '../src/kids/lib/installReady';
import { newKid } from '../src/kids/store/kidsStore';
import { SyncCard } from '../src/sync/SyncCard';
import { SyncJoinPage } from '../src/sync/SyncJoinPage';

const h = vi.hoisted(() => ({
  install: { installed: false, canPrompt: false, how: 'ios', ios: true } as { installed: boolean; canPrompt: boolean; how: string; ios: boolean },
  sync: { code: null as string | null, status: 'idle', lastSyncedAt: null, error: null },
  syncAvailable: true,
}));
vi.mock('../src/sync', () => ({
  get syncAvailable() {
    return h.syncAvailable;
  },
  embedded: false,
  sync: {},
  useSync: () => h.sync,
}));
vi.mock('../src/pwa/install', async (original) => ({ ...(await original<typeof import('../src/pwa/install')>()), useInstall: () => h.install }));
vi.mock('../src/components/QrCode', () => ({ QrCode: ({ text }: { text: string }) => createElement('i', { 'data-qr': text }) }));
vi.mock('../src/lib/toast', () => ({ toast: vi.fn() }));

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  // iPadOS asks for desktop sites by default: the same string as Safari on a Mac.
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macSafari16: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.87',
  firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1',
  firefoxIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  epiphany: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.38.108;FBBV/565;FBDV/iPhone14,2]',
  messenger: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/450.0.0.38.108]',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.9.90 (iPhone14,2; iOS 17_5; en_US)',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.9.90 Android',
  line: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0',
  snapchat: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.3.0.35 (like Safari/604.1)',
  google: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/312.0.6 Mobile/15E148 Safari/604.1',
  twitter: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/9.45',
};

describe('detectHow', () => {
  it('sends iPhone and iPad Safari to the Home Screen steps', () => {
    expect(detectHow(UA.iphone, 5, false)).toBe('ios');
    expect(detectHow(UA.ipad, 5, false)).toBe('ios');
  });

  it('sees an iPad that asks for desktop sites (a Mac user agent with a touch screen)', () => {
    expect(detectHow(UA.macSafari, 5, false)).toBe('ios');
    expect(detectHow(UA.macSafari, 0, false)).toBe('safari-mac');
    // A Mac with a trackpad reports no touch points; one point is not a touch screen either.
    expect(detectHow(UA.macSafari, 1, false)).toBe('safari-mac');
  });

  it('keeps Chrome, Edge and Firefox on iPhone on the Home Screen steps', () => {
    expect(detectHow(UA.chromeIos, 5, false)).toBe('ios');
    expect(detectHow(UA.firefoxIos, 5, false)).toBe('ios');
  });

  it('sends Mac Safari 17 or later to Add to Dock, and older Safari to an update', () => {
    expect(detectHow(UA.macSafari, 0, false)).toBe('safari-mac');
    expect(detectHow(UA.macSafari16, 0, false)).toBe('safari-old');
    // No version in the string: assume a current Safari.
    expect(detectHow(UA.macSafari.replace('Version/17.5 ', ''), 0, false)).toBe('safari-mac');
  });

  it('recognises browsers built into other apps, which cannot install', () => {
    for (const ua of [UA.facebook, UA.messenger, UA.instagram, UA.instagramAndroid, UA.line, UA.snapchat, UA.google, UA.twitter]) expect(detectHow(ua, 5, false)).toBe('in-app');
  });

  it('leaves Chrome and Edge to their own install button', () => {
    expect(detectHow(UA.chromeMac, 0, false)).toBe('menu');
    expect(detectHow(UA.chromeWin, 0, false)).toBe('menu');
    expect(detectHow(UA.edge, 0, false)).toBe('menu');
    expect(detectHow(UA.androidChrome, 5, false)).toBe('menu');
  });

  it('says Firefox cannot install, and does not mistake other Safari-like browsers for Mac Safari', () => {
    expect(detectHow(UA.firefox, 0, false)).toBe('unsupported');
    expect(detectHow(UA.epiphany, 0, false)).toBe('menu');
  });

  it('installs from the hosted app when embedded or single-file, whatever the browser', () => {
    for (const ua of [UA.iphone, UA.macSafari, UA.chromeMac, UA.facebook, UA.firefox]) expect(detectHow(ua, 5, true)).toBe('elsewhere');
  });
});

describe('isIosDevice', () => {
  it('is true for iPhone, iPad and iPod in any browser, and for an iPad in desktop mode', () => {
    expect(isIosDevice(UA.iphone, 5)).toBe(true);
    expect(isIosDevice(UA.ipad, 5)).toBe(true);
    expect(isIosDevice(UA.chromeIos, 5)).toBe(true);
    expect(isIosDevice(UA.facebook, 5)).toBe(true);
    expect(isIosDevice(UA.macSafari, 5)).toBe(true);
  });
  it('is false for a Mac and for other systems', () => {
    expect(isIosDevice(UA.macSafari, 0)).toBe(false);
    expect(isIosDevice(UA.androidChrome, 5)).toBe(false);
    expect(isIosDevice(UA.chromeWin, 0)).toBe(false);
  });
});

describe('the address handed to other people', () => {
  it('defaults to the published address', () => {
    expect(resolveAppUrl(undefined)).toBe('https://bgage72590.github.io/chess-training/');
    expect(resolveAppUrl('')).toBe('https://bgage72590.github.io/chess-training/');
    expect(resolveAppUrl('   ')).toBe('https://bgage72590.github.io/chess-training/');
  });
  it('takes a web address, with a closing slash and without a query or hash', () => {
    expect(resolveAppUrl('https://tempo.example.com')).toBe('https://tempo.example.com/');
    expect(resolveAppUrl(' https://tempo.example.com/app ')).toBe('https://tempo.example.com/app/');
    expect(resolveAppUrl('https://tempo.example.com/app/?x=1#/sync/AAAA')).toBe('https://tempo.example.com/app/');
  });
  it('ignores what is not a web address', () => {
    expect(resolveAppUrl('tempo.example.com')).toBe('https://bgage72590.github.io/chess-training/');
    expect(resolveAppUrl('javascript:alert(1)')).toBe('https://bgage72590.github.io/chess-training/');
    expect(resolveAppUrl('file:///tmp/x')).toBe('https://bgage72590.github.io/chess-training/');
  });
  it('comes from VITE_APP_URL when the build sets it', async () => {
    vi.stubEnv('VITE_APP_URL', 'https://tempo.example.com/');
    vi.resetModules();
    const fresh = await vi.importActual<typeof import('../src/pwa/install')>('../src/pwa/install');
    expect(fresh.APP_URL).toBe('https://tempo.example.com/');
    vi.unstubAllEnvs();
  });
});

describe('when the install banner shows', () => {
  const s = (how: string, over: Partial<typeof h.install> = {}) => ({ installed: false, how, ios: true, ...over }) as Parameters<typeof guideKind>[0];

  it('fits iPhone, iPad and Mac Safari, and in-app browsers on an iPhone or iPad', () => {
    expect(guideKind(s('ios'))).toBe('ios');
    expect(guideKind(s('safari-mac', { ios: false }))).toBe('mac');
    expect(guideKind(s('in-app'))).toBe('in-app');
  });
  it('stays away from Chrome and Edge (real Install button), other browsers and embedded copies', () => {
    for (const how of ['menu', 'unsupported', 'safari-old', 'elsewhere']) expect(guideKind(s(how))).toBeNull();
    expect(guideKind(s('in-app', { ios: false }))).toBeNull();
  });
  it('stays away once the app is installed', () => {
    expect(guideKind(s('ios', { installed: true }))).toBeNull();
    expect(guideKind(s('safari-mac', { installed: true }))).toBeNull();
  });
  it('waits for the first finished lesson or puzzle and stays hidden once dismissed', () => {
    expect(shouldShowGuide('ios', true, false)).toBe(true);
    expect(shouldShowGuide('ios', false, false)).toBe(false);
    expect(shouldShowGuide('ios', true, true)).toBe(false);
    expect(shouldShowGuide(null, true, false)).toBe(false);
  });
  it('counts a solved puzzle or a finished lesson as the first', () => {
    const base = { puzzles: { solved: 0 }, lessons: {} } as Parameters<typeof hasFinishedFirst>[0];
    expect(hasFinishedFirst(base)).toBe(false);
    expect(hasFinishedFirst({ ...base, puzzles: { solved: 1 } } as typeof base)).toBe(true);
    expect(hasFinishedFirst({ ...base, lessons: { a: { done: false, t: 0, score: 0 } } })).toBe(false);
    expect(hasFinishedFirst({ ...base, lessons: { a: { done: false, t: 0, score: 0 }, b: { done: true, t: 1, score: 1 } } })).toBe(true);
  });
});

describe('remembering that the banner was hidden', () => {
  afterEach(() => vi.unstubAllGlobals());
  const store = () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) });
    return data;
  };

  it('keeps the dismissal in localStorage', () => {
    const data = store();
    expect(readGuideDismissed()).toBe(false);
    writeGuideDismissed();
    expect([...data.values()]).toEqual(['1']);
    expect(readGuideDismissed()).toBe(true);
  });
  it('works without storage: it shows again rather than failing', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(() => writeGuideDismissed()).not.toThrow();
    expect(readGuideDismissed()).toBe(false);
  });
});

describe('the install banner', () => {
  const show = (state: Partial<typeof h.install>, props: { ready?: boolean; variant?: 'app' | 'kids' } = {}) => {
    h.install = { installed: false, canPrompt: false, how: 'ios', ios: true, ...state };
    return renderToStaticMarkup(createElement(InstallGuide, { ready: true, ...props }));
  };
  beforeEach(() => {
    h.sync = { ...h.sync, code: null };
    h.syncAvailable = true;
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('walks through Share, Add to Home Screen and Add, then the new icon, on an iPhone', () => {
    const html = show({});
    expect(html).toContain('Add Tempo to your Home Screen');
    expect(html).toContain('Share');
    expect(html).toContain('Add to Home Screen');
    expect(html).toMatch(/Tap <strong>Add<\/strong>/);
    expect(html).toContain('open Tempo from the new icon');
    expect(html).toContain('Hide this');
  });
  it('says the installed app has its own data, and how to bring progress across', () => {
    const html = show({});
    expect(html).toContain('keeps its own data, separate from this Safari tab');
    expect(html).toContain('turn on sync');
    expect(html).toContain('I have a sync code');
    expect(html).toContain('opens in Safari, not in the installed app');
  });
  it('tells someone who already syncs to type their code in the installed app', () => {
    h.sync = { ...h.sync, code: 'ABCDEFGHJKMNPQRSTVWX' };
    const html = show({});
    expect(html).toContain('Sync is on');
    expect(html).not.toContain('turn on sync');
  });
  it('shows the Dock steps on Mac Safari', () => {
    const html = show({ how: 'safari-mac', ios: false });
    expect(html).toContain('Add Tempo to your Dock');
    expect(html).toContain('Add to Dock');
    expect(html).toContain('macOS 14 Sonoma');
    expect(html).toContain('Dock app');
  });
  it('says to open the page in Safari inside another app', () => {
    const html = show({ how: 'in-app' });
    expect(html).toContain('Open this page in Safari first');
    expect(html).toContain('Open in Safari');
  });
  it('shows nothing before the first finished lesson or puzzle, once installed, in Chrome or once hidden', () => {
    expect(show({}, { ready: false })).toBe('');
    expect(show({ installed: true })).toBe('');
    expect(show({ how: 'menu', canPrompt: true, ios: false })).toBe('');
    expect(show({ how: 'in-app', ios: false })).toBe('');
    vi.stubGlobal('localStorage', { getItem: () => '1', setItem: () => undefined });
    expect(show({})).toBe('');
  });
  it('has a Kids grown-ups look, with no link out to the sync settings', () => {
    const html = show({}, { variant: 'kids' });
    expect(html).toContain('k-gu-card');
    expect(html).toContain("Tempo&#x27;s Settings");
    expect(html).not.toContain('Sync settings');
    expect(show({})).toContain('Sync settings');
  });
});

describe('the storage split note', () => {
  const facts = { mode: 'install', how: 'ios', installed: false, linked: false, sync: true } as const;

  it('applies on iPhone, iPad and Mac Safari only', () => {
    expect(storageSplitText(facts)).toContain('Home Screen app keeps its own data');
    expect(storageSplitText({ ...facts, how: 'safari-mac' })).toContain('Dock app keeps its own data');
    for (const how of ['menu', 'unsupported', 'elsewhere', 'in-app', 'safari-old'] as const) expect(storageSplitText({ ...facts, how })).toBeNull();
  });
  it('says to sync or export before installing, then choose "I have a sync code"', () => {
    const text = storageSplitText(facts)!;
    expect(text).toContain('turn on sync');
    expect(text).toContain('export your progress');
    expect(text).toContain('“I have a sync code”');
    expect(text).toContain('A sync link opens in Safari, not in the installed app');
  });
  it('does not repeat the advice to turn on sync when it is on', () => {
    const text = storageSplitText({ ...facts, linked: true })!;
    expect(text).toContain('Sync is on');
    expect(text).not.toContain('turn on sync');
  });
  it('points to export and import when sync is not available', () => {
    expect(storageSplitText({ ...facts, sync: false })).toContain('export your progress');
    expect(storageSplitText({ ...facts, sync: false })).not.toContain('sync code');
  });
  it('sends Kids grown-ups to the right places', () => {
    expect(storageSplitText({ ...facts, kids: true })).toContain("Tempo's Settings");
    expect(storageSplitText({ ...facts, kids: true })).toContain('Export kids data');
  });
  it('explains on the sync link page that the link opens in Safari, not the installed app', () => {
    const text = storageSplitText({ ...facts, mode: 'join' })!;
    expect(text).toContain('this link opens in Safari, not in the app');
    expect(text).toContain('Install Tempo first');
    expect(text).toContain('Home Screen');
    expect(storageSplitText({ ...facts, mode: 'join', how: 'safari-mac' })).toContain('Dock');
  });
  it('explains next to a sync code that the QR code and link open in Safari', () => {
    expect(storageSplitText({ ...facts, mode: 'synced', linked: true })).toContain('The link and QR code open in Safari, not in the installed app');
  });
  it('helps inside the installed app to bring progress across', () => {
    const installed = { ...facts, mode: 'installed', installed: true } as const;
    expect(storageSplitText(installed)).toContain('This installed app keeps its own data');
    expect(storageSplitText(installed)).toContain('“I have a sync code”');
    expect(storageSplitText({ ...installed, sync: false })).toContain('Import');
  });
  it('shows the before-install notes only before installing, and the installed one only after', () => {
    for (const mode of ['install', 'join', 'synced'] as const) expect(storageSplitText({ ...facts, mode, installed: true })).toBeNull();
    expect(storageSplitText({ ...facts, mode: 'installed', installed: false })).toBeNull();
  });
});

describe('the install card', () => {
  const card = (state: Partial<typeof h.install>) => {
    h.install = { installed: false, canPrompt: false, how: 'ios', ios: true, ...state };
    return renderToStaticMarkup(createElement(InstallCard));
  };
  beforeEach(() => {
    h.sync = { ...h.sync, code: null };
    h.syncAvailable = true;
  });

  it('shows the picture steps and the storage split on iPhone and Mac Safari', () => {
    const phone = card({});
    expect(phone).toContain('Add to Home Screen');
    expect(phone).toContain('keeps its own data');
    const mac = card({ how: 'safari-mac', ios: false });
    expect(mac).toContain('Add to Dock');
    expect(mac).toContain('keeps its own data');
  });
  it('says to open the page in Safari first in another app on an iPhone, and in Chrome elsewhere', () => {
    expect(card({ how: 'in-app' })).toContain('Open this page in Safari first');
    expect(card({ how: 'in-app', ios: false })).toContain('Open this page in Chrome first');
  });
  it('keeps the real Install button for Chrome and Edge', () => {
    const html = card({ how: 'menu', canPrompt: true, ios: false });
    expect(html).toContain('Install Tempo');
    expect(html).not.toContain('Add to Home Screen');
  });
  it('says an old Safari cannot add to the Dock', () => {
    expect(card({ how: 'safari-old', ios: false })).toContain('macOS 14 Sonoma');
  });
  it('gives no steps once installed', () => {
    expect(card({ installed: true })).toContain('You are using the installed app');
    expect(card({ installed: true })).not.toContain('Add to Home Screen');
  });
});

describe('the Share Tempo card', () => {
  const syncPage = 'https://bgage72590.github.io/chess-training/#/sync/ABCD-EFGH-JKMN-PQRS-TVWX';
  beforeEach(() => {
    vi.stubGlobal('location', { href: syncPage, origin: 'https://bgage72590.github.io', pathname: '/chess-training/', hash: '#/sync/ABCD-EFGH-JKMN-PQRS-TVWX' });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('makes its QR code and shows its address from APP_URL, never from the page being viewed', () => {
    const html = renderToStaticMarkup(createElement(ShareCard));
    expect(html).toContain(`data-qr="${APP_URL}"`);
    expect(html).not.toContain('sync');
    expect(html).not.toContain('ABCD');
    expect(html).toContain('Share Tempo');
    expect(html).toContain('Copy link');
  });
  it('has a Kids grown-ups look', () => {
    const html = renderToStaticMarkup(createElement(ShareCard, { variant: 'kids' }));
    expect(html).toContain('k-gu-card');
    expect(html).toContain(`data-qr="${APP_URL}"`);
  });
  it('offers Share only where the device has a share sheet', () => {
    vi.stubGlobal('navigator', {});
    expect(renderToStaticMarkup(createElement(ShareCard))).not.toContain('>Share<');
    vi.stubGlobal('navigator', { share: () => Promise.resolve() });
    expect(renderToStaticMarkup(createElement(ShareCard))).toContain('>Share<');
  });
  it('shares the app address with a title and text', async () => {
    const share = vi.fn(() => Promise.resolve());
    await shareApp({ share });
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ title: SHARE.title, text: SHARE.text, url: APP_URL });
    expect(JSON.stringify(share.mock.calls)).not.toContain('ABCD');
  });
  it('is quiet when the person closes the share sheet', async () => {
    await expect(shareApp({ share: () => Promise.reject(new DOMException('closed', 'AbortError')) })).resolves.toBeUndefined();
    await expect(shareApp({ share: () => Promise.reject(new Error('nope')) })).resolves.toBeUndefined();
  });
  it('copies the app address, and says so when the clipboard is blocked', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyAppLink();
    expect(writeText).toHaveBeenCalledWith(APP_URL);
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Link copied' }));
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('blocked')) } });
    await copyAppLink();
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Copy blocked' }));
  });
});

describe('the sync pages', () => {
  beforeEach(() => void vi.stubGlobal('location', { origin: 'https://app.test', pathname: '/', hash: '' }));
  afterEach(() => vi.unstubAllGlobals());
  const setup = (state: Partial<typeof h.install>, code: string | null = null) => {
    h.install = { installed: false, canPrompt: false, how: 'ios', ios: true, ...state };
    h.sync = { ...h.sync, code };
    h.syncAvailable = true;
  };

  it('warns on the sync link page that the link opens in Safari, not in the installed app', () => {
    setup({});
    const html = renderToStaticMarkup(createElement(SyncJoinPage, { code: 'ABCD-EFGH-JKMN-PQRS-TVWX' }));
    expect(html).toContain('Link this device?');
    expect(html).toContain('this link opens in Safari, not in the app');
    expect(html).toContain('Install Tempo first');
  });
  it('says nothing about the installed app on the link page in Chrome', () => {
    setup({ how: 'menu', ios: false });
    expect(renderToStaticMarkup(createElement(SyncJoinPage, { code: 'ABCD-EFGH-JKMN-PQRS-TVWX' }))).not.toContain('installed app');
  });
  it('says next to the QR code that it opens in Safari, not in the installed app', () => {
    setup({}, 'ABCDEFGHJKMNPQRSTVWX');
    const html = renderToStaticMarkup(createElement(SyncCard));
    expect(html).toContain('data-qr=');
    expect(html).toContain('The link and QR code open in Safari, not in the installed app');
  });
  it('helps a person who just installed to bring their progress across', () => {
    setup({ installed: true });
    const html = renderToStaticMarkup(createElement(SyncCard));
    expect(html).toContain('This installed app keeps its own data, separate from Safari');
    expect(html).toContain('I have a sync code');
  });
  it('adds no notes in Chrome', () => {
    setup({ how: 'menu', ios: false }, 'ABCDEFGHJKMNPQRSTVWX');
    expect(renderToStaticMarkup(createElement(SyncCard))).not.toContain('installed app');
  });
});

describe('when the Kids grown-ups banner may show', () => {
  const kid = () => newKid({ name: 'Sam', band: 'explorer', start: 'new' });
  const node = (stars: 0 | 1 | 2 | 3, extra: object = {}) => ({ stars, plays: 1, last: 1, box: 1 as const, due: '2026-10-01', masteredDays: [], lastItems: [], losses: 0, ease: 0, ...extra });

  it('waits for a first star or a solved puzzle', () => {
    expect(kidsFinishedFirst([])).toBe(false);
    expect(kidsFinishedFirst([kid()])).toBe(false);
    const played = kid();
    played.nodes['w1-rook-paint'] = node(0);
    expect(kidsFinishedFirst([played])).toBe(false);
    const starred = kid();
    starred.nodes['w1-rook-paint'] = node(1);
    expect(kidsFinishedFirst([kid(), starred])).toBe(true);
    const solver = kid();
    solver.puzzle.bestStreak = 1;
    expect(kidsFinishedFirst([solver])).toBe(true);
  });
  it('does not count stars a placement test or a skip handed out', () => {
    const tested = kid();
    tested.nodes['w1-rook-paint'] = node(3, { tested: true });
    const skipped = kid();
    skipped.nodes['w1-rook-paint'] = node(3, { skipped: true });
    expect(kidsFinishedFirst([tested, skipped])).toBe(false);
  });
});
