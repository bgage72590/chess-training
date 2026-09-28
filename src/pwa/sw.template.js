// Tempo service worker: keeps the whole app (including Stockfish) available offline.
// Generated at build time from src/pwa/sw.template.js (vite.config.ts fills in the version and file list).
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `tempo-${VERSION}`;
const FONTS = 'tempo-fonts';
const VOICE = 'tempo-voice';
const scoped = (path) => new URL(path, self.registration.scope).href;

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
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tempo-') && k !== CACHE && k !== FONTS && k !== VOICE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
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
  // goes stale. The voice and clip lists are fetched fresh when online; a new recording clears the
  // old clips.
  if (req.method === 'GET' && url.pathname.includes('/voice/')) {
    if (url.pathname.endsWith('.json')) {
      const fresh = revalidate(req);
      event.respondWith(fresh.then((res) => res.clone()).catch(() => caches.open(VOICE).then((c) => c.match(req)).then((hit) => hit ?? Response.error())));
      event.waitUntil(
        fresh
          .then(async (res) => {
            if (!res.ok) return;
            const next = await res.clone().json();
            const cache = await caches.open(VOICE);
            const prev = await cache.match(req).then((hit) => (hit ? hit.json() : null));
            if (prev && prev.version && prev.version !== next.version) await caches.delete(VOICE);
            await (await caches.open(VOICE)).put(req, res);
          })
          .catch(() => undefined),
      );
    } else {
      // <audio> asks for byte ranges, and a partial (206) response cannot be cached: fetch and keep
      // the whole clip (by URL, whatever the request headers), and answer ranges from it.
      event.respondWith(
        caches.open(VOICE).then((cache) =>
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
  // (the engine's start-up check) are answered from the cached GET response.
  if (req.method === 'GET' || req.method === 'HEAD') {
    event.respondWith(caches.match(req, { ignoreMethod: true, ignoreSearch: true }).then((hit) => hit ?? fetch(req)));
  }
});
