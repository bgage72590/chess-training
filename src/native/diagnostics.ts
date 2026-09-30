// What works inside the native app (the Mac app and the iPhone and iPad app), measured where it runs.
// A WKWebView on a custom scheme (capacitor:// or tauri://) differs from Safari in ways nothing here can
// check without a Mac: secure-context features, the engine's wasm file type, cross-origin fetches. The
// smoke build (VITE_NATIVE_SMOKE) opens #/diag at start-up and posts this to the CI job's listener
// (VITE_NATIVE_REPORT_URL), so a GitHub Actions run on a macOS runner can say what a real app does.
import { engine } from '../engine/engine';
import { SYNC_KEY, SYNC_URL } from '../sync/config';

const settled = async (f: () => unknown | Promise<unknown>): Promise<unknown> => {
  try {
    return await f();
  } catch (e) {
    return `error: ${(e as Error)?.message ?? String(e)}`;
  }
};

const url = (path: string) => new URL(path, document.baseURI).href;

/** The device's safe-area insets in px, measured with a probe element. */
function safeArea() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(probe);
  const c = getComputedStyle(probe);
  const out = { top: c.paddingTop, right: c.paddingRight, bottom: c.paddingBottom, left: c.paddingLeft };
  probe.remove();
  return out;
}

async function speechVoices() {
  const synth = window.speechSynthesis;
  if (!synth) return 'no speechSynthesis';
  const names = () => synth.getVoices().filter((v) => /^en[-_]/i.test(v.lang)).map((v) => v.name);
  if (!names().length) await new Promise((r) => (synth.addEventListener?.('voiceschanged', () => r(null), { once: true }), setTimeout(r, 2000)));
  const all = names();
  return { english: all.length, sample: all.slice(0, 5) };
}

export async function collectDiagnostics(): Promise<Record<string, unknown>> {
  const nav = navigator as Navigator & { audioSession?: { type: string }; standalone?: boolean };
  const out: Record<string, unknown> = {
    build: __BUILD__,
    href: location.href,
    origin: location.origin,
    ua: navigator.userAgent,
    secureContext: window.isSecureContext,
    cryptoSubtle: !!globalThis.crypto?.subtle,
    caches: typeof caches,
    serviceWorker: 'serviceWorker' in navigator,
    share: typeof navigator.share,
    clipboard: typeof navigator.clipboard?.writeText,
    audioSession: nav.audioSession?.type ?? null,
    mp3: new Audio().canPlayType('audio/mpeg'),
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio, standalone: nav.standalone === true || matchMedia('(display-mode: standalone)').matches },
    safeArea: safeArea(),
  };
  out.storage = await settled(async () => {
    localStorage.setItem('tempo.diag', '1');
    const ok = localStorage.getItem('tempo.diag') === '1';
    localStorage.removeItem('tempo.diag');
    return { localStorage: ok, estimate: await navigator.storage?.estimate?.(), persisted: await navigator.storage?.persisted?.() };
  });
  out.wasmFile = await settled(async () => {
    const res = await fetch(url('engine/stockfish.wasm'));
    return { status: res.status, type: res.headers.get('content-type'), bytes: (await res.arrayBuffer()).byteLength };
  });
  out.voices = await settled(async () => {
    const list = (await (await fetch(url('voice/voices.json'))).json()) as { default: string; voices: { id: string }[] };
    const id = list.voices[0].id;
    const m = (await (await fetch(url(`voice/${id}/manifest.json`))).json()) as { version?: string; clips: Record<string, number> };
    const key = Object.keys(m.clips)[0];
    const res = await fetch(url(`voice/${id}/${key}.mp3${m.version ? `?v=${encodeURIComponent(m.version)}` : ''}`), { headers: { Range: 'bytes=0-1023' } });
    return { ids: list.voices.map((v) => v.id), default: list.default, clips: Object.keys(m.clips).length, rangeStatus: res.status, type: res.headers.get('content-type'), bytes: (await res.arrayBuffer()).byteLength };
  });
  out.speech = await settled(speechVoices);
  out.engine = await settled(async () => {
    const t0 = performance.now();
    await engine.init();
    const r = await engine.search('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', { depth: 8 });
    return { kind: engine.kind, best: r?.best ?? null, ms: Math.round(performance.now() - t0) };
  });
  // A read-only call with a code that cannot exist (the copy is not found and nothing is written):
  // proves the sync service can be reached from this origin (CORS included).
  out.sync = await settled(async () => {
    const res = await fetch(`${SYNC_URL.replace(/\/$/, '')}/rest/v1/rpc/sync_get`, {
      method: 'POST',
      headers: { apikey: SYNC_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: `DIAGNOSTIC-${Math.random().toString(36).slice(2)}` }),
    });
    return { status: res.status, body: (await res.text()).slice(0, 60) };
  });
  return out;
}

/** Sends the report to the CI job's listener, when the build names one. */
export async function postReport(report: Record<string, unknown>): Promise<string> {
  const target = import.meta.env.VITE_NATIVE_REPORT_URL as string | undefined;
  if (!target) return 'no report address';
  try {
    const res = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(report) });
    return `posted (${res.status})`;
  } catch (e) {
    return `not posted: ${(e as Error).message}`;
  }
}
