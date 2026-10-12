/* Service worker: offline-first app shell for حصن المسلم */
const VERSION = "hisn-v1.0.0";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/app.css", "./js/app.js", "./data/hisn.json",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./icons/favicon.svg"
];
const FONT_CACHE = "hisn-fonts-v1";
const AUDIO_CACHE = "hisn-audio-v1";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONT_CACHE && k !== AUDIO_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) { e.respondWith(cacheFirst(req, VERSION)); return; }
  if (url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com")) { e.respondWith(staleWhileRevalidate(req, FONT_CACHE)); return; }
  if (url.pathname.endsWith(".mp3")) { e.respondWith(cacheFirst(req, AUDIO_CACHE, true)); return; }
});

async function cacheFirst(req, cacheName, opportunistic = false) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque") && (opportunistic || res.ok)) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    if (req.mode === "navigate") return cache.match("./index.html");
    throw err;
  }
}
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()).catch(() => {}); return res; }).catch(() => hit);
  return hit || net;
}
