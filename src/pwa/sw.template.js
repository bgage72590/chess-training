// Tempo service worker: keeps the whole app (including Stockfish) available offline.
// Generated at build time from src/pwa/sw.template.js (vite.config.ts fills in the version and file list).
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `tempo-${VERSION}`;
const FONTS = 'tempo-fonts';
const scoped = (path) => new URL(path, self.registration.scope).href;
/** The caches this worker owns: the current app and fonts. Anything else named tempo-* (older app
 *  versions, and the voice caches Kids mode used to keep) is deleted on activation. */
const keepsCache = (name) => name === CACHE || name === FONTS;

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
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tempo-') && !keepsCache(k)).map((k) => caches.delete(k))))
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
