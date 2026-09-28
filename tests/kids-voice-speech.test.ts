import { afterEach, describe, expect, it, vi } from 'vitest';

// speech.ts keeps module state and looks for browser globals when it loads: each test stubs what it
// needs and loads fresh copies of speech.ts and the kids store.
class FakeUtterance {
  onstart?: () => void;
  onend?: () => void;
  onerror?: (e: { error: string }) => void;
  constructor(public text: string) {}
}

function fakeSynth() {
  const spoken: FakeUtterance[] = [];
  return { spoken, speak: (u: FakeUtterance) => void spoken.push(u), cancel: () => undefined, getVoices: () => [], addEventListener: () => undefined };
}

async function load(globals: Record<string, unknown>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(globals)) vi.stubGlobal(k, v);
  const store = await import('../src/kids/store/kidsStore');
  const speech = await import('../src/kids/player/speech');
  return { ...store, ...speech };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const Audio = class {
  src = '';
  play = () => Promise.resolve();
  pause = () => undefined;
};

describe("Pip's read-aloud", () => {
  async function withKid() {
    const synth = fakeSynth();
    const m = await load({ window: { speechSynthesis: synth, addEventListener: () => undefined }, SpeechSynthesisUtterance: FakeUtterance });
    const kid = m.newKid({ name: 'Maya', band: 'explorer', start: 'moves' });
    kid.settings.voice = 'first';
    m.__setKidsStateForTests({ ...m.defaultKidsState(), kids: [kid], activeKid: kid.id });
    m.speech.unlock();
    return { m, synth, kid };
  }

  it("counts a 'first' line as heard only once it was said to the end", async () => {
    const { m, synth, kid } = await withKid();
    const heard = () => m.getKid(kid.id)!.firsts.includes(m.lineId("Rooks can't jump!"));
    expect(m.sayAs(kid, ["Rooks can't jump!"])).toBeDefined();
    await tick();
    const cut = synth.spoken.at(-1)!;
    expect(cut.text).toBe("Rooks can't jump!");
    m.speech.leaveScreen(); // the kid moves on mid-line
    cut.onend?.();
    expect(heard()).toBe(false);

    expect(m.sayAs(kid, ["Rooks can't jump!"])).toBeDefined(); // so the next visit says it again
    await tick();
    const whole = synth.spoken.at(-1)!;
    whole.onstart?.();
    whole.onend?.();
    expect(heard()).toBe(true);
    expect(m.sayAs(kid, ["Rooks can't jump!"])).toBeUndefined();
  });

  it('stops the old screen on a screen change, except a line said on the way out', async () => {
    const { m, synth, kid } = await withKid();
    m.sayAs(kid, ["We'll come back to this one later!"], { keep: true });
    await tick();
    synth.spoken.at(-1)!.onstart?.();
    expect(m.speech.state.speaking).toBe(true);
    m.speech.leaveScreen(); // Skip for now -> the map: Pip finishes the line there
    expect(m.speech.state.speaking).toBe(true);
    m.speech.leaveScreen(); // the next screen change stops it
    expect(m.speech.state.speaking).toBe(false);
  });

  it('fetches the voice list again for the next line after it failed to load', async () => {
    let online = false;
    const urls: string[] = [];
    const fetch = async (url: string) => {
      urls.push(url.replace('https://app.test/voice/', ''));
      if (!online) throw new TypeError('Failed to fetch');
      const body = url.endsWith('voices.json') ? { default: 'sunny', voices: [{ id: 'sunny', name: 'Sunny', blurb: 'Bright and cheerful' }] } : { v: 1, voice: 'x', version: '1', clips: {} };
      return Response.json(body);
    };
    const m = await load({ document: { baseURI: 'https://app.test/' }, fetch, Audio });
    await m.speech.loadPipVoices();
    expect(m.speech.pipVoices()).toEqual([]);

    online = true;
    m.speech.unlock();
    m.speech.speak(['Your turn!']);
    await vi.waitFor(() => expect(urls).toEqual(['voices.json', 'voices.json', 'sunny/manifest.json']));
    expect(m.speech.pipVoices().map((v) => v.id)).toEqual(['sunny']);
  });

  it('keeps the device voice without asking again when the server answers with something else', async () => {
    const urls: string[] = [];
    const fetch = async (url: string) => {
      urls.push(url.replace('https://app.test/voice/', ''));
      return new Response('<!doctype html><title>Tempo</title>', { headers: { 'content-type': 'text/html' } });
    };
    const synth = fakeSynth();
    const m = await load({ window: { speechSynthesis: synth, addEventListener: () => undefined }, SpeechSynthesisUtterance: FakeUtterance, document: { baseURI: 'https://app.test/' }, fetch, Audio });
    await m.speech.loadPipVoices();
    expect(m.speech.pipVoices()).toEqual([]);
    m.speech.unlock();
    m.speech.speak(['Your turn!']);
    await vi.waitFor(() => expect(synth.spoken.at(-1)?.text).toBe('Your turn!'));
    m.speech.speak(['Well done!']);
    await vi.waitFor(() => expect(synth.spoken.at(-1)?.text).toBe('Well done!'));
    expect(urls).toEqual(['voices.json']);
  });

  it('reads with the device voice in the single-file copy, fetching nothing', async () => {
    vi.stubEnv('MODE', 'single');
    const fetch = vi.fn(async () => Response.json({}));
    const synth = fakeSynth();
    const m = await load({ window: { speechSynthesis: synth, addEventListener: () => undefined }, SpeechSynthesisUtterance: FakeUtterance, document: { baseURI: 'https://app.test/' }, fetch, Audio });
    expect(m.RECORDED).toBe(false);
    expect(m.speech.defaultPipVoice()).toBe(m.DEVICE_VOICE);
    await m.speech.loadPipVoices();
    expect(m.speech.pipVoices()).toEqual([]);
    m.speech.unlock();
    m.speech.speak(['Your turn!']);
    expect(synth.spoken.at(-1)?.text).toBe('Your turn!'); // at once: no wait for a voice list
    expect(fetch).not.toHaveBeenCalled();
  });
  it('leaves a pause between recorded sentences and lines, but not after the last one', async () => {
    vi.useFakeTimers();
    try {
      const { clipKey, spokenText } = await import('../src/kids/lib/clipKey');
      const key = (t: string) => clipKey(spokenText(t));
      const played: string[] = [];
      let ended: (() => void) | undefined;
      class Clip {
        src = '';
        playbackRate = 1;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        play = () => {
          if (this.src.includes('.mp3')) {
            played.push(this.src.split('/').pop()!.split('?')[0]);
            ended = () => this.onended?.();
          } // (unlock() plays a silent data clip first)
          return Promise.resolve();
        };
        pause = () => undefined;
      }
      const clips = { [key('Hello there.')]: 900, [key('Tap the star!')]: 1200, [key('Well done!')]: 800 };
      const fetch = async (url: string) => (url.endsWith('voices.json') ? Response.json({ default: 'sunny', voices: [{ id: 'sunny', name: 'Sunny', blurb: '' }] }) : Response.json({ v: 1, voice: 'x', version: '1', clips }));
      const m = await load({ window: { addEventListener: () => undefined }, document: { baseURI: 'https://app.test/' }, fetch, Audio: Clip });
      await m.speech.loadPipVoices();
      m.speech.unlock();
      const onEnd = vi.fn();
      // The first line is two sentences, each recorded on its own; the second line is one clip.
      m.speech.speak(['Hello there. Tap the star!', 'Well done!'], { onEnd });
      await vi.advanceTimersByTimeAsync(900);
      expect(played).toEqual([`${key('Hello there.')}.mp3`]);
      ended!();
      await vi.advanceTimersByTimeAsync(m.SENTENCE_GAP_MS - 1);
      expect(played).toHaveLength(1); // still in the pause between the sentences
      await vi.advanceTimersByTimeAsync(1);
      expect(played).toHaveLength(2);
      ended!();
      await vi.advanceTimersByTimeAsync(m.LINE_GAP_MS - 1);
      expect(played).toHaveLength(2); // the longer pause between the lines
      await vi.advanceTimersByTimeAsync(1);
      expect(played.at(-1)).toBe(`${key('Well done!')}.mp3`);
      ended!();
      expect(onEnd).toHaveBeenCalledTimes(1); // no pause after the last line
    } finally {
      vi.useRealTimers();
    }
  });
});
