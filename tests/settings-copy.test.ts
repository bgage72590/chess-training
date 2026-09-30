import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../src/pages/Settings';

const h = vi.hoisted(() => ({ ios: false }));
vi.mock('../src/pwa/install', async (original) => ({
  ...(await original<typeof import('../src/pwa/install')>()),
  useInstall: () => ({ installed: false, canPrompt: false, how: h.ios ? 'ios' : 'menu', ios: h.ios }),
}));
vi.mock('../src/components/QrCode', () => ({ QrCode: () => null }));

describe('Settings', () => {
  beforeEach(() => {
    h.ios = false;
  });
  const page = () => renderToStaticMarkup(createElement(SettingsPage));

  it('tells iPhone and iPad users to check the silent switch when there is no sound', () => {
    h.ios = true;
    expect(page()).toContain('No sound on iPhone or iPad? Check the silent switch on the side (or Control Center).');
  });
  it('leaves that tip out on other devices', () => {
    expect(page()).not.toContain('silent switch');
  });
  it('keeps the press-M hint in its own element, inside the label, so touch screens can hide it', () => {
    expect(page()).toContain('Sound effects <span class="faint key-hint">(press M anywhere to mute)</span>');
  });
  it('has a Share Tempo card', () => {
    expect(page()).toContain('Share Tempo');
  });
  it('links the sources and the licence text the engine ships with', () => {
    const html = page();
    for (const href of [
      'https://github.com/official-stockfish/Stockfish',
      'https://github.com/nmrugg/stockfish.js',
      'https://github.com/bgage72590/chess-training',
      './engine/COPYING-stockfish.txt',
    ]) expect(html).toContain(`href="${href}"`);
  });
  it('says nothing about a licence for Tempo itself', () => {
    const credits = page().split('<h2>Credits</h2>')[1];
    expect(credits).not.toMatch(/Tempo is (released|licen[cs]ed)|MIT|Apache/);
  });
});
