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

afterEach(() => void vi.unstubAllGlobals());

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
      return new Response(JSON.stringify(body));
    };
    const Audio = class {
      src = '';
      play = () => Promise.resolve();
      pause = () => undefined;
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
});
