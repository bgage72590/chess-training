// Tempo service worker: keeps the whole app (including Stockfish) available offline.
// Generated at build time from src/pwa/sw.template.js (vite.config.ts fills in the version and file list).
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `tempo-${VERSION}`;
const FONTS = 'tempo-fonts';
const VOICE = 'tempo-voice';
const scoped = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map(scoped)))
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

  // Pip's voice: clips are named by their text and the recording version, so a cached clip never
  // goes stale. The clip list is fetched fresh when online; a new recording clears the old clips.
  if (req.method === 'GET' && url.pathname.includes('/voice/')) {
    if (url.pathname.endsWith('/manifest.json')) {
      const fresh = fetch(req);
      event.respondWith(fresh.then((res) => res.clone()).catch(() => caches.open(VOICE).then((c) => c.match(req)).then((hit) => hit ?? Response.error())));
      event.waitUntil(
        fresh
          .then(async (res) => {
            if (!res.ok) return;
            const next = await res.clone().json();
            const cache = await caches.open(VOICE);
            const prev = await cache.match(req).then((hit) => (hit ? hit.json() : null));
            if (prev && prev.version !== next.version) await caches.delete(VOICE);
            await (await caches.open(VOICE)).put(req, res);
          })
          .catch(() => undefined),
      );
    } else {
      event.respondWith(
        caches.open(VOICE).then((cache) =>
          cache.match(req).then(
            (hit) =>
              hit ??
              fetch(req).then((res) => {
                if (res.ok) void cache.put(req, res.clone());
                return res;
              }),
          ),
        ),
      );
    }
    return;
  }

  // Pages: network first so a new version appears when online; the cached app works offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(scoped('./'))));
    return;
  }

  // Files: from the cache (built files have content hashes), else the network. HEAD requests
  // (the engine's start-up check) are answered from the cached GET response.
  if (req.method === 'GET' || req.method === 'HEAD') {
    event.respondWith(caches.match(req, { ignoreMethod: true, ignoreSearch: true }).then((hit) => hit ?? fetch(req)));
  }
});
