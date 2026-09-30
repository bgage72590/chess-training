import { afterEach, describe, expect, it, vi } from 'vitest';

// speech.ts decides which voice, if any, to save on its own (voicePack.ts does the deciding about the
// connection and the downloading; it is replaced here by a spy). It must never pick before a kid is
// picked, and never a voice other than the kid's.
async function load() {
  vi.resetModules();
  const autoDownload = vi.fn(async () => true);
  vi.doMock('../src/kids/player/voicePack', () => ({ voicePacks: { autoDownload } }));
  const fetch = async (url: string) =>
    url.endsWith('voices.json')
      ? Response.json({
          default: 'sunny',
          voices: ['sunny', 'rocket'].map((id) => ({ id, name: id, blurb: '' })),
        })
      : Response.json({ v: 1, voice: 'x', version: '1', clips: {} });
  vi.stubGlobal('window', { addEventListener: () => undefined });
  vi.stubGlobal('document', { baseURI: 'https://app.test/' });
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('Audio', class {});
  const store = await import('../src/kids/store/kidsStore');
  const speech = await import('../src/kids/player/speech');
  await speech.speech.loadPipVoices();
  return { ...store, ...speech, autoDownload };
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

afterEach(() => {
  vi.doUnmock('../src/kids/player/voicePack');
  vi.unstubAllGlobals();
});

describe("saving the kid's voice on its own", () => {
  it('waits for a kid: the default voice is not started before anyone is picked', async () => {
    const m = await load();
    await settle();
    expect(m.speech.pipVoices().map((v) => v.id)).toEqual(['sunny', 'rocket']);
    expect(m.autoDownload).not.toHaveBeenCalled();
  });

  it("saves the picked kid's own voice, not the default", async () => {
    const m = await load();
    const kid = m.newKid({ name: 'Maya', band: 'explorer', start: 'moves' });
    kid.settings.pipVoice = 'rocket';
    m.replaceKids({ ...m.defaultKidsState(), kids: [kid], activeKid: null });
    await settle();
    expect(m.autoDownload).not.toHaveBeenCalled(); // the family is there, nobody is picked yet

    m.setActiveKid(kid.id);
    await settle();
    expect(m.autoDownload).toHaveBeenCalledWith('rocket');
    expect(m.autoDownload).not.toHaveBeenCalledWith('sunny');
  });

  it('uses the default voice for a kid who has not chosen one', async () => {
    const m = await load();
    const kid = m.newKid({ name: 'Maya', band: 'explorer', start: 'moves' });
    m.replaceKids({ ...m.defaultKidsState(), kids: [kid], activeKid: kid.id });
    await settle();
    expect(m.autoDownload).toHaveBeenCalledWith('sunny');
  });

  it("follows a change of the kid's voice, and does nothing for the device voice", async () => {
    const m = await load();
    const kid = m.newKid({ name: 'Maya', band: 'explorer', start: 'moves' });
    kid.settings.pipVoice = m.DEVICE_VOICE;
    m.replaceKids({ ...m.defaultKidsState(), kids: [kid], activeKid: kid.id });
    await settle();
    expect(m.autoDownload).not.toHaveBeenCalled();

    vi.useFakeTimers();
    try {
      m.updateKid(kid.id, (d) => void (d.settings.pipVoice = 'rocket'));
      await vi.advanceTimersByTimeAsync(m.AUTO_SAVE_SETTLE_MS - 1);
      expect(m.autoDownload).not.toHaveBeenCalled(); // a voice must stay a while first
      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(10);
      expect(m.autoDownload).toHaveBeenCalledWith('rocket');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not save the voices a grown-up only auditions', async () => {
    const m = await load();
    const kid = m.newKid({ name: 'Maya', band: 'explorer', start: 'moves' });
    kid.settings.pipVoice = 'sunny';
    m.replaceKids({ ...m.defaultKidsState(), kids: [kid], activeKid: kid.id });
    await settle();
    m.autoDownload.mockClear();

    vi.useFakeTimers();
    try {
      for (const id of ['rocket', 'sunny', 'rocket', 'sunny']) {
        m.updateKid(kid.id, (d) => void (d.settings.pipVoice = id));
        await vi.advanceTimersByTimeAsync(5000); // a tap every few seconds
      }
      m.updateKid(kid.id, (d) => void (d.settings.pipVoice = 'rocket'));
      await vi.advanceTimersByTimeAsync(m.AUTO_SAVE_SETTLE_MS + 10);
      expect(m.autoDownload).toHaveBeenCalledTimes(1);
      expect(m.autoDownload).toHaveBeenCalledWith('rocket'); // the one that stayed
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts at once for a kid who is picked, whatever voice they had', async () => {
    const m = await load();
    const a = m.newKid({ name: 'Ann', band: 'explorer', start: 'moves' });
    const b = m.newKid({ name: 'Bo', band: 'explorer', start: 'moves' });
    b.settings.pipVoice = 'rocket';
    m.replaceKids({ ...m.defaultKidsState(), kids: [a, b], activeKid: a.id });
    await settle();
    m.autoDownload.mockClear();
    m.setActiveKid(b.id);
    await settle();
    expect(m.autoDownload).toHaveBeenCalledWith('rocket');
  });

  it('is not started again by every unrelated change of the kids data', async () => {
    const m = await load();
    const kid = m.newKid({ name: 'Maya', band: 'explorer', start: 'moves' });
    m.replaceKids({ ...m.defaultKidsState(), kids: [kid], activeKid: kid.id });
    await settle();
    const calls = m.autoDownload.mock.calls.length;
    m.updateKid(kid.id, (d) => void (d.garden += 1));
    m.updateKid(kid.id, (d) => void (d.garden += 1));
    await settle();
    expect(m.autoDownload.mock.calls.length).toBe(calls);
  });
});
