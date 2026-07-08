// VFarmers Service Worker v2
// Caching strategy:
//   Static assets (JS/CSS/fonts/images) → Cache-first, immutable
//   Navigation (HTML page loads)        → Network-first, stale-while-revalidate fallback
//   Supabase / live API requests        → Network-only (never cached)
//   Everything else                     → Network with cache fallback (offline support)

const CACHE_VERSION = "vfarmers-v2";
const SHELL_CACHE   = `${CACHE_VERSION}-shell`;
const STATIC_CACHE  = `${CACHE_VERSION}-static`;

// Hosts whose responses must never be served from cache (live financial data)
const BYPASS_CACHE_HOSTS = [
  "supabase.co",
  "supabase.in",
];

// App-shell URLs to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function isBypassHost(url) {
  return BYPASS_CACHE_HOSTS.some((h) => url.hostname.includes(h));
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_app/") ||
    url.pathname.startsWith("/avatars/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(js|mjs|css|woff2?|ttf|otf|eot|png|svg|ico|webp|jpg|jpeg|gif)$/i.test(url.pathname)
  );
}

function isNavigation(request) {
  return request.mode === "navigate";
}

// ── Install: pre-cache the app shell ───────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: clean up old cache versions ─────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("vfarmers-") && k !== SHELL_CACHE && k !== STATIC_CACHE)
            .map((k) => {
              console.log("[SW] Deleting old cache:", k);
              return caches.delete(k);
            }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch: routing strategy ────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  // Only intercept GET requests — mutations must always hit the network
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // 1. Live/financial API — always bypass cache
  if (isBypassHost(url)) return;

  // 2. Static assets (JS bundles, CSS, fonts, images)
  //    Cache-first: these have content-hashed filenames so stale = impossible
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok && response.status < 400) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch {
          return new Response("Asset unavailable offline", { status: 503 });
        }
      }),
    );
    return;
  }

  // 3. Navigation requests (page loads)
  //    Network-first with stale-while-revalidate: user always gets fresh HTML
  //    when online; cached shell served instantly when offline
  if (isNavigation(event.request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            // Update the cache in the background — next offline visit gets this
            cache.put(event.request, response.clone());
          }
          return response;
        } catch {
          // Offline: serve the cached version of this exact URL, or fall back
          // to the root shell (SPA routing handles the rest client-side)
          const cached =
            (await cache.match(event.request)) ||
            (await cache.match("/"));
          return cached || new Response("You are offline", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }
      })(),
    );
    return;
  }

  // 4. Everything else — network with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          caches.open(SHELL_CACHE).then((cache) =>
            cache.put(event.request, response.clone()),
          );
        }
        return response;
      })
      .catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (
          (await cache.match(event.request)) ||
          new Response("Offline", { status: 503 })
        );
      }),
  );
});

// ── Message: force update ──────────────────────────────────────────────────
// Clients can post { type: 'SKIP_WAITING' } to force the new SW to activate
// immediately (used after a deploy to prompt users to refresh)
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
