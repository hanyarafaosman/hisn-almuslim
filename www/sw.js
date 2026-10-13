/* Service worker: offline-first app shell for حصن المسلم */
const VERSION = "hisn-v1.4.0";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/app.css", "./js/app.js", "./js/quran.js", "./js/i18n.js", "./js/offline.js", "./data/audio-sizes.json", "./data/hisn.json", "./data/hisn.en.json", "./data/extras.json", "./data/radios.json", "./quran/index.json",
  "./i18n/ar.json", "./i18n/en.json",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./icons/favicon.svg"
];
const FONT_CACHE = "hisn-fonts-v1";
// Recorded audio (adhkar clips, surah recitations) saved by the user from the Offline content page.
const OFFLINE_AUDIO = "hisn-offline-audio-v1";
// Mushaf text + fonts (~1.5 MB per riwayah). Kept across app updates; bump only when quran/ data changes.
const QURAN_CACHE = "hisn-quran-v1";
// Translations of meanings from QuranEnc.com, kept for offline reading of surahs already opened.
const TR_CACHE = "hisn-tr-v1";
const KEEP = [VERSION, FONT_CACHE, OFFLINE_AUDIO, QURAN_CACHE, TR_CACHE];

self.addEventListener("install", e => {
  // cache: "reload" bypasses the browser HTTP cache (GitHub Pages sends max-age=600), so a new version never stores stale files.
  // Activate immediately: open pages then reload once into the new version (see controllerchange in app.js),
  // instead of waiting until every tab or the installed app is fully closed.
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    const quranFile = /\/quran\/(fonts\/[a-z]+\.woff2|[a-z]+\.json)$/.test(url.pathname) && !url.pathname.endsWith("/index.json");
    e.respondWith(cacheFirst(req, quranFile ? QURAN_CACHE : VERSION));
    return;
  }
  if (url.hostname === "quranenc.com" && url.pathname.startsWith("/api/v1/translation")) { e.respondWith(staleWhileRevalidate(req, TR_CACHE)); return; }
  if (url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com")) { e.respondWith(staleWhileRevalidate(req, FONT_CACHE)); return; }
  // Recorded audio the user saved: answer from the device, with byte ranges so seeking works.
  // Everything else (and live radio streams) goes straight to the network.
  if (url.pathname.endsWith(".mp3") && (url.hostname.endsWith("hisnmuslim.com") || url.hostname.endsWith("mp3quran.net"))) { e.respondWith(savedAudio(req)); return; }
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
    if (req.mode === "navigate") return (await caches.open(VERSION)).match("./index.html");
    throw err;
  }
}
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()).catch(() => {}); return res; }).catch(() => hit);
  return hit || net;
}

async function savedAudio(req) {
  const hit = await (await caches.open(OFFLINE_AUDIO)).match(req.url);
  if (!hit) return fetch(req);
  const range = req.headers.get("range");
  if (!range) return hit;
  const blob = await hit.blob(); const size = blob.size;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = 0, end = size - 1;
  if (m && m[1] !== "") { start = Number(m[1]); if (m[2] !== "") end = Math.min(Number(m[2]), size - 1); }
  else if (m && m[2] !== "") { start = Math.max(size - Number(m[2]), 0); }
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  return new Response(blob.slice(start, end + 1), {
    status: 206, statusText: "Partial Content",
    headers: { "Content-Type": hit.headers.get("Content-Type") || "audio/mpeg", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" },
  });
}
