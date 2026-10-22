/* Service worker: offline-first app shell for حصن ونور */
const VERSION = "hisn-v1.24.0";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/fonts.css", "./css/app.css", "./js/app.js", "./js/quran.js", "./js/i18n.js", "./js/offline.js", "./js/mirror.js", "./js/hadith.js", "./js/tafsir.js", "./js/asma.js", "./js/kutub.js", "./js/prayer.js", "./js/prayer-calc.js", "./js/videos.js", "./js/install.js", "./adhan/index.json", "./hadith/index.json", "./tafsir/index.json", "./asma/book.json", "./kutub/index.json", "./data/audio-sizes.json", "./data/hisn.json", "./data/hisn.en.json", "./data/extras.json", "./data/radios.json", "./data/lessons.json", "./data/videos.json", "./quran/index.json",
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
// Page fonts of the printed Madinah Mushaf (KFGQPC QCF, one per page), from the Quran.com and Quran Foundation CDNs.
const MUSHAF_FONTS = "hisn-mushaf-fonts-v1";
// Hadith books (fawazahmed0/hadith-api at a pinned commit, so the files never change). Every section the
// reader opens is kept, and whole books can be saved from the Offline content page.
const HADITH_CACHE = "hisn-hadith-v1";
// Tafsir books from spa5k/tafsir_api (pinned to a release commit, so the files never change): every surah or verse
// the reader opens is kept, and whole books can be saved from the Offline content page. QuranEnc books use TR_CACHE.
const TAFSIR_CACHE = "hisn-tafsir-v1";
// Books of the library: kutub/<id>.<hash>.json (contents) and kutub/<id>/<n>.<hash>.json (text, about 250 KB each).
// Every file read is kept across app updates. A corrected file gets a new name, and js/kutub.js deletes copies the
// index no longer lists.
const KUTUB_CACHE = "hisn-kutub-v1";
// Adhan recordings (adhan/<id>.<hash>.aac, kept across updates), the adhan file the user chose (adhan/custom), and what
// js/prayer.js leaves for the prayer notifications below (PRAYER_INFO).
const ADHAN_CACHE = "hisn-adhan-v1";
const PRAYER_INFO = "prayer/push.json";
// Backup copies of outside files (MIRROR in js/mirror.js). On GitHub Pages they share the app's origin.
const MIRROR = new URL("https://hanyarafaosman.github.io/hisn-almuslim-assets/");
const KEEP = [VERSION, FONT_CACHE, OFFLINE_AUDIO, QURAN_CACHE, TR_CACHE, MUSHAF_FONTS, HADITH_CACHE, TAFSIR_CACHE, KUTUB_CACHE, ADHAN_CACHE];

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
    if (/\/adhan\/[a-z0-9-]+\.[0-9a-f]{10}\.aac$/.test(url.pathname)) { e.respondWith(savedAudio(req, ADHAN_CACHE, true)); return; }
    const quranFile = (/\/quran\/(fonts\/[a-z]+\.woff2|[a-z]+\.json)$/.test(url.pathname) && !url.pathname.endsWith("/index.json"))
      || /\/mushaf\/[a-z]+\.json$/.test(url.pathname);
    const uiFont = /\/fonts\/[a-z0-9-]+\.woff2$/.test(url.pathname);
    const book = /\/kutub\/[a-z0-9-]+(\/\d+)?\.[0-9a-f]{10}\.json$/.test(url.pathname);
    e.respondWith(cacheFirst(req, quranFile ? QURAN_CACHE : uiFont ? FONT_CACHE : book ? KUTUB_CACHE : VERSION));
    return;
  }
  // Page fonts of the prints: QCF v1/v2 from the Quran.com CDN, the colour Tajweed print (QCF v4) from the Quran Foundation CDN.
  if ((url.hostname === "static.qurancdn.com" || url.hostname === "verses.quran.foundation") && url.pathname.startsWith("/fonts/quran/")) { e.respondWith(cacheFirst(req, MUSHAF_FONTS)); return; }
  if (url.hostname === "cdn.jsdelivr.net" && url.pathname.startsWith("/gh/fawazahmed0/hadith-api@")) { e.respondWith(cacheFirst(req, HADITH_CACHE)); return; }
  // Tafsir files from jsDelivr, or from GitHub when jsDelivr refuses one (see js/mirror.js).
  if ((url.hostname === "cdn.jsdelivr.net" && url.pathname.startsWith("/gh/spa5k/tafsir_api@"))
    || (url.hostname === "raw.githubusercontent.com" && url.pathname.startsWith("/spa5k/tafsir_api/"))) { e.respondWith(cacheFirst(req, TAFSIR_CACHE)); return; }
  if (url.hostname === "quranenc.com" && url.pathname.startsWith("/api/v1/translation")) { e.respondWith(staleWhileRevalidate(req, TR_CACHE)); return; }
  // Recorded audio the user saved: answer from the device, with byte ranges so seeking works.
  // Everything else (and live radio streams) goes straight to the network.
  if (url.pathname.endsWith(".mp3") && (url.hostname.endsWith("hisnmuslim.com") || url.hostname.endsWith("mp3quran.net"))) { e.respondWith(savedAudio(req, OFFLINE_AUDIO)); return; }
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

// Audio from a cache, with byte ranges so seeking works (Safari asks for ranges). keep: a file not saved yet is
// fetched whole and saved (the adhan recordings); otherwise it goes to the network as asked.
async function savedAudio(req, cacheName, keep = false) {
  const cache = await caches.open(cacheName);
  let hit = await cache.match(req.url);
  if (!hit && keep) { try { const res = await fetch(req.url); if (res.ok) { await cache.put(req.url, res.clone()); hit = res; } } catch { /* below */ } }
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

// A tap on a prayer notification opens the app on the prayer times (or brings it forward); its "stop" button stops the adhan.
// A tap on the notification of a prayer's time also asks the app for that prayer's adhan (adhanFromTap in js/prayer.js).
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const { url: open = "#/prayer", at, kind } = e.notification.data || {};
  const adhan = kind === "now" && Number.isFinite(at) ? at : undefined;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const win = list.find(c => c.url.startsWith(self.registration.scope));
    if (e.action === "stop") { if (win) win.postMessage({ stopAdhan: true }); return; }
    if (win) { win.postMessage({ open, adhan }); return win.focus(); }
    return self.clients.openWindow(self.registration.scope + (adhan ? "?adhan=" + adhan : "") + open);
  }));
});

// ---------- prayer alerts while the app is closed (Web Push from the server in push/) ----------
// A message says only which prayer, its time and the kind of alert: { p, at, kind: "before"|"notify"|"adhan", l }.
// The words are the app's own strings in the user's language; the place's name and time zone are what js/prayer.js
// left in PRAYER_INFO. A notification cannot play the adhan recording: a tap opens the app, which plays it there.
self.addEventListener("push", e => {
  let d = null; try { d = e.data?.json(); } catch { /* not ours: shown below as the app's name */ }
  e.waitUntil(prayerPush(d));
});
const prayerInfo = () => caches.open(ADHAN_CACHE).then(c => c.match(PRAYER_INFO)).then(r => r ? r.json() : {}).catch(() => ({}));
async function prayerPush(d) {
  const info = await prayerInfo(), lang = info.lang || d?.l || "ar", t = await strings(lang);
  const ours = d && /^(fajr|sunrise|dhuhr|jumua|asr|maghrib|isha)$/.test(d.p) && Number.isFinite(d.at);
  const icon = "icons/icon-192.png";
  if (!ours) return self.registration.showNotification(t("app.name"), { icon, tag: "prayer", data: { url: "#/prayer" } });
  const kind = d.kind === "before" ? "before" : "now";
  // Safari ends a subscription whose messages show nothing; Chrome and Firefox allow it now and then.
  const sub = await self.registration.pushManager.getSubscription().catch(() => null);
  const mustShow = /\.push\.apple\.com$/.test(sub ? new URL(sub.endpoint).hostname : "");
  // The app is on screen: it shows the alert itself (a toast, or the adhan bar with the adhan).
  const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  if (!mustShow && wins.some(c => c.visibilityState === "visible" && c.url.startsWith(self.registration.scope))) return;
  // The app, open in the background, has shown this alert already.
  const shown = (await self.registration.getNotifications({ tag: "prayer" })).some(n => n.data?.at === d.at && n.data?.kind === kind);
  if (shown && !mustShow) return;
  const locale = lang === "ar" ? "ar-EG" : lang;
  let clock; try { clock = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", ...(info.tz ? { timeZone: info.tz } : {}) }).format(d.at); }
  catch { clock = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(d.at); }
  const name = t("prayer." + d.p);
  const title = kind === "before" ? t("prayer.soonTitle", { name, n: Math.max(1, Math.round((d.at - Date.now()) / 60000)) })
    : d.p === "sunrise" ? t("prayer.sunriseNow") : t("prayer.nowTitle", { name });
  const sep = ["ar", "fa", "ur", "ps"].includes(lang) ? "، " : ", ";
  const body = clock + (info.name ? sep + info.name : "") + (d.kind === "adhan" && d.p !== "sunrise" ? "\n" + t("prayer.tapAdhan") : "");
  return self.registration.showNotification(title, { body, icon, tag: "prayer", renotify: !shown, lang, dir: "auto", ...(kind === "now" ? { timestamp: d.at } : {}), data: { url: "#/prayer", at: d.at, kind } });
}
// The strings of a language (i18n/<code>.json, from the app's cache or the network), with English for missing keys;
// a small copy of t() in js/i18n.js: {name} placeholders, plural objects, the language's digits (Arabic-Indic for Arabic).
async function strings(lang) {
  const load = async code => {
    const url = new URL(`i18n/${code}.json`, self.registration.scope).href;
    try { const r = (await caches.match(url, { ignoreSearch: true })) || await fetch(url); return r.ok ? await r.json() : {}; } catch { return {}; }
  };
  const [own, en] = await Promise.all([load(lang), lang === "en" ? {} : load("en")]);
  let plural, nf;
  try { plural = new Intl.PluralRules(lang); nf = new Intl.NumberFormat(lang === "ar" ? "ar-EG" : lang, { useGrouping: false }); }
  catch { plural = new Intl.PluralRules("en"); nf = new Intl.NumberFormat("en", { useGrouping: false }); }
  return (key, p = {}) => {
    let v = own[key] ?? en[key] ?? key;
    if (v && typeof v === "object") v = v[plural.select(Number(p.n) || 0)] ?? v.other ?? Object.values(v)[0];
    return String(v).replace(/\{(\w+)\}/g, (m, k) => k in p ? (typeof p[k] === "number" ? nf.format(p[k]) : String(p[k])) : m);
  };
}
// The browser replaced the push subscription (it expired, or the keys changed): tell the server, which drops the old one.
self.addEventListener("pushsubscriptionchange", e => {
  e.waitUntil((async () => {
    const { push } = await prayerInfo(); if (!push?.url || !push.key) return;
    const key = Uint8Array.from(atob(push.key.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const sub = e.newSubscription || await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await fetch(push.url + "/subscribe", { method: "POST", body: JSON.stringify({ sub: sub.toJSON(), settings: push.settings, old: e.oldSubscription?.endpoint || push.endpoint }) });
  })().catch(() => {}));
});
