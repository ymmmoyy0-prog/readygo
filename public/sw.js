/* ReadyGo Service Worker：離線優先緩存 */
const VERSION = "readygo-v4";
const SHELL = "/";
const PRECACHE = [SHELL, "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function putCache(req, res) {
  if (res && res.ok && res.type === "basic") {
    const c = await caches.open(VERSION);
    await c.put(req, res.clone());
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外部 API（巴士 ETA）一律直連
  if (url.pathname.startsWith("/api/")) return; // 版本檢查等一律直連，不經緩存

  // 頁面導航：網絡優先，離線時回退到已緩存的 App Shell（忽略 ?preset= 等參數）
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => putCache(SHELL, res))
        .catch(async () => (await caches.match(SHELL)) || Response.error())
    );
    return;
  }

  // 帶 hash 的靜態資源：緩存優先
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => putCache(req, res)))
    );
    return;
  }

  // 其他同源資源（RSC payload 等）：先回緩存，背景更新
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => putCache(req, res))
        .catch(() => hit || Response.error());
      return hit || net;
    })
  );
});
