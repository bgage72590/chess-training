// Tempo service worker: keeps the whole app (including Stockfish) available offline.
// Generated at build time from src/pwa/sw.template.js (vite.config.ts fills in the version and file list).
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `tempo-${VERSION}`;
const FONTS = 'tempo-fonts';
// Pip's voices: one cache per voice ('tempo-voice-<id>', its clips by exact URL) so a new recording
// of one voice clears only that voice, and one small cache for the voice lists (voices.json and each
// voice's manifest.json). Before this there was a single 'tempo-voice' cache for all of them.
const VOICE_LISTS = 'tempo-voice-lists';
const LEGACY_VOICE = 'tempo-voice';
const scoped = (path) => new URL(path, self.registration.scope).href;

/** The voice a /voice/<id>/... address belongs to ('' for voices.json and anything outside a voice). */
const voiceOf = (url) => (/\/voice\/([^/]+)\//.exec(new URL(url).pathname) || [])[1] || '';
const voiceCacheName = (id) => `tempo-voice-${id}`;
/** The cache a voice file is kept in: lists (json) together, clips with their voice. */
const voiceCacheFor = (url) => (new URL(url).pathname.endsWith('.json') || !voiceOf(url) ? VOICE_LISTS : voiceCacheName(voiceOf(url)));
/** The caches this worker owns: the current app, fonts and every voice (voices outlive app versions). */
const keepsCache = (name) => name === CACHE || name === FONTS || name.startsWith('tempo-voice-');

/** The part of a whole (200) response that a `Range: bytes=a-b` request asks for, as a 206 (Safari needs one for media). */
async function ranged(req, res) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (!m || (!m[1] && !m[2]) || res.status !== 200) return res;
  const body = await res.arrayBuffer();
  const size = body.byteLength;
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

/** Fetches `req` checking with the server first: GitHub Pages lets the browser's HTTP cache keep
 *  files for 10 minutes, and an unchanged file costs a short "not modified" answer. */
const revalidate = (req) => {
  let fresh = req;
  try {
    fresh = new Request(req, { cache: 'no-cache' });
  } catch {
    /* keep the request as it is */
  }
  return fetch(fresh);
};

/** Moves what the single 'tempo-voice' cache held into the per-voice caches, then deletes it, so
 *  nobody loses clips they already downloaded. Entries already in their new place are kept as they
 *  are. If anything fails the old cache stays and the next activation tries again. */
async function migrateVoiceCache() {
  if (!(await caches.keys()).includes(LEGACY_VOICE)) return;
  const old = await caches.open(LEGACY_VOICE);
  const targets = new Map();
  for (const req of await old.keys()) {
    const name = voiceCacheFor(req.url);
    if (!targets.has(name)) targets.set(name, await caches.open(name));
    const target = targets.get(name);
    if (await target.match(req.url, { ignoreVary: true })) continue;
    const res = await old.match(req, { ignoreVary: true });
    if (res) await target.put(req.url, res);
  }
  await caches.delete(LEGACY_VOICE);
}

/** Keeps a fetched voice list; a manifest with a new recording version first clears that voice's clips. */
async function rememberVoiceList(url, res) {
  if (!res.ok) return;
  const lists = await caches.open(VOICE_LISTS);
  const id = new URL(url).pathname.endsWith('/manifest.json') ? voiceOf(url) : '';
  if (id) {
    const next = await res.clone().json();
    const prev = await lists.match(url, { ignoreVary: true }).then((hit) => (hit ? hit.json() : null));
    if (prev && prev.version && prev.version !== next.version) await caches.delete(voiceCacheName(id));
  }
  await lists.put(url, res);
}

/** How much of the app is saved for offline use: what the install put in the current cache. */
async function appStatus() {
  const cache = await caches.open(CACHE);
  const have = await Promise.all(FILES.map((f) => cache.match(scoped(f))));
  return { version: VERSION, files: FILES.length, missing: have.filter((hit) => !hit).length };
}

self.addEventListener('install', (event) => {
  // Checked with the server: a copy of the page or an unhashed file the HTTP cache still holds
  // from the last version would pair the new files with old ones offline.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(scoped(f), { cache: 'no-cache' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    migrateVoiceCache()
      .catch(() => undefined) // the old cache stays; the filter below leaves it alone
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tempo-') && !keepsCache(k) && k !== LEGACY_VOICE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page asks whether the app is fully saved (Settings, Offline).
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'status') return;
  const reply = event.ports && event.ports[0] ? event.ports[0] : event.source;
  event.waitUntil(appStatus().then((status) => reply && reply.postMessage({ type: 'status', ...status })));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Google Fonts: cache on first use so the app looks the same offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ??
            fetch(req).then((res) => {
              cache.put(req, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Pip's voices: clips are named by their text and the recording version, so a cached clip never
  // goes stale. The voice and clip lists are fetched fresh when online; a new recording of a voice
  // clears that voice's clips (not the other voices').
  if (req.method === 'GET' && url.pathname.includes('/voice/')) {
    if (url.pathname.endsWith('.json')) {
      // Answered once the list is kept (and the old clips of a re-recorded voice are gone), so a
      // download that starts from this manifest is never cleared underneath itself.
      event.respondWith(
        revalidate(req).then(
          async (res) => {
            await rememberVoiceList(req.url, res.clone()).catch(() => undefined);
            return res;
          },
          () => caches.open(VOICE_LISTS).then((c) => c.match(req.url, { ignoreVary: true })).then((hit) => hit ?? Response.error()),
        ),
      );
    } else {
      // <audio> asks for byte ranges, and a partial (206) response cannot be cached: fetch and keep
      // the whole clip (by URL, whatever the request headers), and answer ranges from it.
      event.respondWith(
        caches.open(voiceCacheFor(req.url)).then((cache) =>
          cache
            .match(req.url, { ignoreVary: true })
            .then(
              (hit) =>
                hit ??
                fetch(req.url).then((res) => {
                  if (res.status === 200) void cache.put(req.url, res.clone());
                  return res;
                }),
            )
            .then((res) => ranged(req, res)),
        ),
      );
    }
    return;
  }

  // Pages: network first (past the HTTP cache) so a new version appears as soon as it is out;
  // the cached app works offline.
  if (req.mode === 'navigate') {
    event.respondWith(revalidate(req).catch(() => caches.match(scoped('./'))));
    return;
  }

  // Files: from the cache (built files have content hashes), else the network. HEAD requests
  // (the engine's start-up check) are answered from the cached GET response. Whatever Vary a host
  // sends is ignored: `Vary: Origin` (vite preview, some CDNs) would otherwise never match the
  // scripts a page asks for, and the app would not start offline.
  if (req.method === 'GET' || req.method === 'HEAD') {
    event.respondWith(caches.match(req, { ignoreMethod: true, ignoreSearch: true, ignoreVary: true }).then((hit) => hit ?? fetch(req)));
  }
});
