/* Service worker: offline-first app shell for حصن المسلم */
const VERSION = "hisn-v1.9.1";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/fonts.css", "./css/app.css", "./js/app.js", "./js/quran.js", "./js/i18n.js", "./js/offline.js", "./js/mirror.js", "./js/hadith.js", "./js/tafsir.js", "./js/asma.js", "./hadith/index.json", "./tafsir/index.json", "./asma/book.json", "./data/audio-sizes.json", "./data/hisn.json", "./data/hisn.en.json", "./data/extras.json", "./data/radios.json", "./quran/index.json",
  "./i18n/ar.json", "./i18n/en.json",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./icons/favicon.svg"
];
// Interface fonts shipped with the app (scripts/fetch-fonts.js). The version is in each file name,
// so they are kept across app updates and fetched only when missing.
const FONT_CACHE = "hisn-fonts-v2";
const FONTS = [
  "./fonts/amiri-v30-italic-400-arabic.woff2", "./fonts/amiri-v30-italic-400-latin-ext.woff2", "./fonts/amiri-v30-italic-400-latin.woff2",
  "./fonts/amiri-v30-400-arabic.woff2", "./fonts/amiri-v30-400-latin-ext.woff2", "./fonts/amiri-v30-400-latin.woff2",
  "./fonts/amiri-v30-700-arabic.woff2", "./fonts/amiri-v30-700-latin-ext.woff2", "./fonts/amiri-v30-700-latin.woff2",
  "./fonts/noto-naskh-arabic-v44-400-700-arabic.woff2", "./fonts/noto-naskh-arabic-v44-400-700-math.woff2", "./fonts/noto-naskh-arabic-v44-400-700-symbols.woff2",
  "./fonts/noto-naskh-arabic-v44-400-700-latin-ext.woff2", "./fonts/noto-naskh-arabic-v44-400-700-latin.woff2"
];
// Recorded audio (adhkar clips, surah recitations) saved by the user from the Offline content page.
const OFFLINE_AUDIO = "hisn-offline-audio-v1";
// Mushaf text + fonts (~1.5 MB per riwayah). Kept across app updates; bump only when quran/ data changes.
const QURAN_CACHE = "hisn-quran-v1";
// Translations of meanings from QuranEnc.com, kept for offline reading of surahs already opened.
const TR_CACHE = "hisn-tr-v1";
// Page fonts of the printed Madinah Mushaf (KFGQPC QCF, one per page), from the Quran.com CDN.
const MUSHAF_FONTS = "hisn-mushaf-fonts-v1";
// Hadith books (fawazahmed0/hadith-api at a pinned commit, so the files never change). Every section the
// reader opens is kept, and whole books can be saved from the Offline content page.
const HADITH_CACHE = "hisn-hadith-v1";
// Tafsir books from spa5k/tafsir_api (pinned to a release commit, so the files never change): every surah or verse
// the reader opens is kept, and whole books can be saved from the Offline content page. QuranEnc books use TR_CACHE.
const TAFSIR_CACHE = "hisn-tafsir-v1";
// Backup copies of outside files (MIRROR in js/mirror.js). On GitHub Pages they share the app's origin.
const MIRROR = new URL("https://hanyarafaosman.github.io/hisn-almuslim-assets/");
const KEEP = [VERSION, FONT_CACHE, OFFLINE_AUDIO, QURAN_CACHE, TR_CACHE, MUSHAF_FONTS, HADITH_CACHE, TAFSIR_CACHE];

self.addEventListener("install", e => {
  // cache: "reload" bypasses the browser HTTP cache (GitHub Pages sends max-age=600), so a new version never stores stale files.
  // Activate immediately: open pages then reload once into the new version (see controllerchange in app.js),
  // instead of waiting until every tab or the installed app is fully closed.
  e.waitUntil(Promise.all([
    caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))),
    caches.open(FONT_CACHE).then(async c => c.addAll((await Promise.all(FONTS.map(async u => (await c.match(u)) ? null : u))).filter(Boolean))),
  ]).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === MIRROR.origin && url.pathname.startsWith(MIRROR.pathname)) {
    // Page fonts join the saved Mushaf fonts; backup audio goes straight to the network like its source.
    if (url.pathname.startsWith(MIRROR.pathname + "qurancdn/fonts/")) e.respondWith(cacheFirst(req, MUSHAF_FONTS));
    return;
  }
  if (url.origin === location.origin) {
    const quranFile = (/\/quran\/(fonts\/[a-z]+\.woff2|[a-z]+\.json)$/.test(url.pathname) && !url.pathname.endsWith("/index.json"))
      || /\/mushaf\/[a-z]+\.json$/.test(url.pathname);
    const uiFont = /\/fonts\/[a-z0-9-]+\.woff2$/.test(url.pathname);
    e.respondWith(cacheFirst(req, quranFile ? QURAN_CACHE : uiFont ? FONT_CACHE : VERSION));
    return;
  }
  if (url.hostname === "static.qurancdn.com" && url.pathname.startsWith("/fonts/quran/")) { e.respondWith(cacheFirst(req, MUSHAF_FONTS)); return; }
  if (url.hostname === "cdn.jsdelivr.net" && url.pathname.startsWith("/gh/fawazahmed0/hadith-api@")) { e.respondWith(cacheFirst(req, HADITH_CACHE)); return; }
  // Tafsir files from jsDelivr, or from GitHub when jsDelivr refuses one (see js/mirror.js).
  if ((url.hostname === "cdn.jsdelivr.net" && url.pathname.startsWith("/gh/spa5k/tafsir_api@"))
    || (url.hostname === "raw.githubusercontent.com" && url.pathname.startsWith("/spa5k/tafsir_api/"))) { e.respondWith(cacheFirst(req, TAFSIR_CACHE)); return; }
  if (url.hostname === "quranenc.com" && url.pathname.startsWith("/api/v1/translation")) { e.respondWith(staleWhileRevalidate(req, TR_CACHE)); return; }
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
    if (req.mode === "navigate") return offlinePage(req);
    throw err;
  }
}
// Website pages of chapters and surahs (scripts/build-site.js) not saved yet: open the same content in the app.
const PAGE_ROUTES = [[/^adhkar\/(morning|evening)\/$/, "#/cat/27?p=$1"], [/^adhkar\/(\d+)\/$/, "#/cat/$1"], [/^adhkar\/$/, "#/adhkar"], [/^surah\/(\d+)\/$/, "#/quran/hafs/$1"], [/^surah\/$/, "#/quran"]];
async function offlinePage(req) {
  const scope = self.registration.scope; const p = req.url.slice(scope.length).split(/[?#]/)[0];
  const hit = req.url.startsWith(scope) && PAGE_ROUTES.find(([re]) => re.test(p));
  return hit ? Response.redirect(scope + p.replace(hit[0], hit[1]), 302) : (await caches.open(VERSION)).match("./index.html");
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
