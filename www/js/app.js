/* ===== حصن ونور — application logic (vanilla ES module, no dependencies) ===== */
import { setupQuran } from "./quran.js?v=1.32.0";
import { setupHadith } from "./hadith.js?v=1.32.0";
import { setupTafsir } from "./tafsir.js?v=1.32.0";
import { setupAsma } from "./asma.js?v=1.32.0";
import { setupKutub } from "./kutub.js?v=1.32.0";
import { setupFaqih } from "./faqih.js?v=1.32.0";
import { setupPrayer } from "./prayer.js?v=1.32.0";
import { setupVideos } from "./videos.js?v=1.32.0";
import { setupInstall } from "./install.js?v=1.32.0";
import { setupTajweed } from "./tajweed.js?v=1.32.0";
import { setupHijri } from "./hijri.js?v=1.32.0";
import { setupQibla } from "./qibla.js?v=1.32.0";
import { LANGS, setLang, getLang, detect, browserLang, t, th, num, sep, collator, regionName, languageName } from "./i18n.js?v=1.32.0";
import { mirrorOf } from "./mirror.js?v=1.32.0";

const VERSION = "1.32.0";
const COPYRIGHT_YEARS = (y => y > 2026 ? `2026–${y}` : "2026")(new Date().getFullYear());
// Public address of the website: shared links point here (scripts/build-site.js reads it too).
const SITE = "https://hanyarafaosman.github.io/hisn-almuslim/";
// Ready-made pages of the website (built by scripts/build-site.js) say which language their text is in and
// which route they show, and carry a search-friendly <title> that is kept while that route is shown.
const { pageLang: PAGE_LANG, pageRoute: PAGE_ROUTE } = document.documentElement.dataset;
const PAGE_TITLE = document.title;
const ownRoute = () => (location.hash || "#/").replace(/[?&](item|a)=\d+$/, "") === PAGE_ROUTE; // #item-N / #a-N links included

// ---------- storage ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode etc. */ } },
};
const RETURNING = ["settings", "progress", "favorites", "quran", "tasbih"].some(k => { try { return localStorage.getItem(k) !== null; } catch { return false; } });
const DEFAULTS = { theme: "auto", scale: 1, vibrate: true, tashkeel: true, autoNext: true, wakeLock: false, countMode: "up" };
const settings = Object.assign({}, DEFAULTS, LS.get("settings", {}));
const saveSettings = () => LS.set("settings", settings);

const favorites = new Set(LS.get("favorites", []));
const saveFav = () => LS.set("favorites", [...favorites]);

const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
let progress = LS.get("progress", null);
if (!progress || progress.date !== todayKey()) progress = { date: todayKey(), counts: {} };
const saveProgress = () => LS.set("progress", progress);

const tasbih = Object.assign({ count: 0, target: 33, phrase: 0 }, LS.get("tasbih", {}));
delete tasbih.total; // older versions kept an overall total of every tap; it is no longer shown or saved
const saveTasbih = () => LS.set("tasbih", tasbih);

// ---------- DOM helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const view = $("#view"), titleEl = $("#title"), actionsEl = $("#actions"), backBtn = $("#btn-back"), toastEl = $("#toast"), audio = $("#audio");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (n, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
// Browsers only allow vibration after a real user tap on the page.
const vibrate = (ms = 12) => { if (settings.vibrate && navigator.vibrate && (navigator.userActivation?.hasBeenActive ?? true)) navigator.vibrate(ms); };
const T = (k, p) => esc(t(k, p)); // escaped translation for HTML templates

let toastTimer;
function toast(msg, action) {
  toastEl.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : "");
  if (action) $("button", toastEl).onclick = () => { action.fn(); toastEl.hidden = true; };
  toastEl.hidden = false; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, action ? 8000 : 2200);
}

// ---------- text helpers ----------
const ch = (...cps) => String.fromCodePoint(...cps);
const range = (a, b) => ch(a) + "-" + ch(b);
const TASHKEEL = new RegExp("[" + range(0x610, 0x61A) + range(0x64B, 0x65F) + ch(0x670) + range(0x6D6, 0x6ED) + ch(0x640) + "]", "g");
const stripTashkeel = s => s.replace(TASHKEEL, "");
// Works for every script: drops diacritics (Arabic tashkeel and Latin accents), unifies Arabic letter forms.
const normalizeSearch = s => String(s).normalize("NFD").replace(/\p{M}/gu, "").replace(TASHKEEL, "")
  .replace(/[ٱإأآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
  .toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

function formatText(text) {
  if (!settings.tashkeel) text = stripTashkeel(text);
  text = esc(text);
  text = text.replace(/\(\(/g, "«").replace(/\)\)/g, "»");
  text = text.replace(/﴿([^﴾]+)﴾/g, (_, q) => `<span class="q">﴿${q.replace(/\s*\*\s*/g, " ۝ ")}﴾</span>`);
  text = text.replace(/\[([^\]]+)\]/g, '<span class="n">$1</span>');
  text = text.replace(/\((?:[^()]{1,40})\)/g, m => /مر|مرا|ثلاث|أربع|عشر|مائة|سبع/.test(m) ? `<span class="r">${m}</span>` : m);
  return text;
}
const plainText = s => s.replace(/\(\(/g, "«").replace(/\)\)/g, "»");

// ---------- data ----------
let DB = null; const catById = new Map(); const sectionOfCat = new Map();
// Adhkar that are not in Hisn al-Muslim, shown in a separate section with their grading.
let EXTRAS = [];
async function loadData() {
  const [res, extras] = await Promise.all([fetch("data/hisn.json"), fetch("data/extras.json").then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] }))]);
  DB = await res.json(); EXTRAS = extras.items || [];
  DB.categories.forEach(c => catById.set(c.id, c));
  DB.sections.forEach(s => s.cats.forEach(id => sectionOfCat.set(id, s)));
}
// Official English translation of the adhkar (hisnmuslim.com). Loaded only when needed.
let EN = null;
async function loadEN() { if (!EN) { const r = await fetch(`data/hisn.en.json?v=${VERSION}`); if (!r.ok) throw new Error("HTTP " + r.status); EN = await r.json(); } return EN; }
const showAdhkarTr = () => settings.adhkarTr ?? getLang() !== "ar";
const catTitle = c => getLang() === "ar" ? c.title : t("ch." + c.id);
const sectionTitle = s => t("section." + s.id);

const itemKey = (cat, item, period) => `${cat.id}:${item.id}` + (cat.id === 27 ? `:${period || currentPeriod()}` : "");
let periodOverride = null;
const currentPeriod = () => periodOverride || ((h => h >= 4 && h < 15)(new Date().getHours()) ? "morning" : "evening");
const getCount = key => progress.counts[key] || 0;
// Morning/evening chapter: some adhkar are said only in the morning or only in the evening (item.when).
const itemsFor = (cat, period) => cat.items.filter(i => !i.when || i.when === (period || currentPeriod()));
function catProgress(cat, period) {
  const items = itemsFor(cat, period);
  const total = items.reduce((a, i) => a + i.repeat, 0);
  const done = items.reduce((a, i) => a + Math.min(i.repeat, getCount(itemKey(cat, i, period))), 0);
  return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
}

// ---------- theme ----------
const isDark = () => settings.theme === "dark" || (settings.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
function applyTheme() {
  const th = settings.theme;
  if (th === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", th);
  document.documentElement.style.setProperty("--scale", settings.scale);
}

// ---------- wake lock ----------
let wakeLock = null;
async function updateWakeLock(wanted) {
  try {
    if (wanted && settings.wakeLock && "wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); }
    else if (!wanted && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && /^#\/(cat|quran\/)/.test(location.hash)) updateWakeLock(true); });

// ---------- audio (short Hisn al-Muslim clips) ----------
let playingBtn = null;
function togglePlay(url, btn) {
  if (playingBtn === btn && !audio.paused) { audio.pause(); return; }
  if (!navigator.onLine && !audio.src.includes(url)) toast(t("audio.needsInternet"));
  if (playingBtn) setPlaying(playingBtn, false);
  document.getElementById("qaudio")?.pause();
  playingBtn = btn; start(btn, url);
}
function start(btn, url, at = 0) {
  audio.src = url; audio.currentTime = at; const src = audio.src;
  audio.play().then(() => { if (audio.src === src) setPlaying(btn, true); })
    .catch(() => { if (audio.src !== src || playingBtn !== btn) return; /* moved to the backup copy or another clip */ toast(t("audio.playFailed")); setPlaying(btn, false); playingBtn = null; });
}
function setPlaying(btn, on) { btn.classList.toggle("playing", on); btn.innerHTML = icon(on ? "pause" : "play"); btn.setAttribute("aria-label", t(on ? "common.stop" : "common.listen")); }
audio.addEventListener("pause", () => { if (playingBtn) setPlaying(playingBtn, false); });
audio.addEventListener("ended", () => { if (playingBtn) setPlaying(playingBtn, false); playingBtn = null; });
// The source failed (before or during playback): continue from its backup copy, once, at the same moment.
audio.addEventListener("error", () => {
  if (!playingBtn) return;
  const alt = mirrorOf(audio.src);
  if (alt) { start(playingBtn, alt, audio.currentTime || 0); return; }
  setPlaying(playingBtn, false); playingBtn = null; toast(t("audio.loadFailed"));
});
const stopAudio = () => { if (!audio.paused) audio.pause(); playingBtn = null; };

// ---------- share / copy ----------
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast(t("common.copied")); }
  catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast(t("common.copied")); } catch { toast(t("common.copyFailed")); } ta.remove(); }
}
async function share(title, text) {
  if (navigator.share) { try { await navigator.share({ title, text }); } catch { /* cancelled */ } }
  else copyText(text);
}
// The link goes inside the text (not navigator.share's url field, which some apps share instead of the text),
// so chat apps show the page preview and the dhikr text is always kept.
const shareText = (title, text, url) => share(title, `${text}\n\n— ${title} | ${t("app.name")}` + (url ? `\n${url}` : ""));
// Website page of a chapter (the morning and evening adhkar have one page each), optionally at one dhikr.
const catUrl = (cat, item) => `${SITE}adhkar/${cat.id === 27 ? currentPeriod() : cat.id}/${item ? "#item-" + item.id : ""}`;

// ---------- Mushaf / listening / radios ----------
const Q = setupQuran({
  view, $, esc, icon, toast, t, num, sep, getLang, collator, regionName, languageName, LS, copyText, share, SITE,
  adhkarAudio: () => ({ items: DB.categories.flatMap(c => c.items.map(i => i.audio)).filter(Boolean), chapters: DB.categories.map(c => c.audio).filter(Boolean) }),
  setHeader: (...a) => setHeader(...a), setNav: n => setNav(n), hadith: () => H, tafsir: () => TF, tajweed: () => TJ,
  // Night/day reading from the Quran pages: switches the app theme (as in Settings) and says whether it is now dark.
  toggleTheme() { settings.theme = isDark() ? "light" : "dark"; saveSettings(); applyTheme(); return settings.theme === "dark"; },
});
// ---------- hadith books ----------
const H = setupHadith({
  view, $, esc, icon, t, num, sep, getLang, LS, copyText, share, SITE, stripTashkeel, tashkeel: () => settings.tashkeel, player: Q.player,
  setHeader: (...a) => setHeader(...a), setNav: n => setNav(n),
});
// ---------- tafsir: every verse, and the tafsir books ----------
const TF = setupTafsir({
  view, $, esc, icon, t, num, sep, getLang, LS, copyText, share, SITE, stripTashkeel, tashkeel: () => settings.tashkeel, Q,
  setHeader: (...a) => setHeader(...a), setNav: n => setNav(n),
});
// ---------- the rules of Tajweed, with examples and the colour key of the Tajweed Mushaf ----------
const TJ = setupTajweed({
  view, $, esc, icon, t, num, sep, getLang, LS, Q, toast, sheet: (...a) => Q.sheet(...a),
  setHeader: (...a) => setHeader(...a), setNav: n => setNav(n),
});
// ---------- the Beautiful Names of Allah ----------
const AS = setupAsma({
  view, $, esc, icon, t, num, sep, getLang, copyText, share, SITE, stripTashkeel, tashkeel: () => settings.tashkeel,
  setHeader: (...a) => setHeader(...a), setNav: n => setNav(n),
});
// ---------- creed and fiqh: the books of ʿaqida and the primer of each of the four schools ----------
const KT = setupKutub({
  view, $, esc, icon, t, num, sep, getLang, LS, copyText, share, SITE, stripTashkeel, tashkeel: () => settings.tashkeel, Q,
  setHeader: (...a) => setHeader(...a), setNav: n => setNav(n),
});
// ---------- fiqh research: what the books of the library say about a question, with verified quotations ----------
const FQ = setupFaqih({ view, $, esc, icon, toast, t, num, sep, getLang, LS, setHeader: (...a) => setHeader(...a), setNav: n => setNav(n) });
// ---------- prayer times, reminders and the adhan ----------
const PR = setupPrayer({
  view, $, esc, icon, toast, t, num, sep, getLang, LS, share, SITE, sheet: (...a) => Q.sheet(...a), closeSheet: () => Q.closeSheet(),
  setHeader: (...a) => setHeader(...a), setNav: n => setNav(n),
});

// ---------- Islamic channels: scholars' lessons on video in series, and the live channels of the Two Holy Mosques ----------
const V = setupVideos({
  view, $, esc, icon, t, num, sep, getLang, LS, toast, Q,
  setHeader: (...a) => setHeader(...a), setNav: n => setNav(n),
});

// ---------- installing the app: the install window opens by itself on every device that can install ----------
const IN = setupInstall({ $, esc, icon, t, th, LS, toast, copyText, SITE, sheet: (...a) => Q.sheet(...a), closeSheet: () => Q.closeSheet() });

// ---------- language ----------
function applyStatic() {
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
}
let searchIndex = null;
async function changeLang(code) {
  settings.lang = code; saveSettings();
  // A ?lang= in the address would override the new choice on the next visit, so drop it.
  if (new URLSearchParams(location.search).has("lang")) history.replaceState(null, "", location.pathname + location.hash);
  await setLang(code, VERSION);
  if (showAdhkarTr() || code !== "ar") await loadEN().catch(() => {});
  searchIndex = null; applyStatic(); route(); PR.langChanged();
}
function pickLanguage() {
  const body = Q.sheet(t("lang.choose"), `<div class="list flat">${LANGS.map(l => `<button class="row" data-l="${l.code}" lang="${l.code}"><div class="lbl" dir="auto">${esc(l.name)}${l.code !== getLang() ? `<span class="sub">${esc(languageName(l.code))}</span>` : ""}</div>${l.code === getLang() ? icon("check") : ""}</button>`).join("")}</div>`);
  body.onclick = e => { const b = e.target.closest("[data-l]"); if (!b) return; Q.closeSheet(); if (b.dataset.l !== getLang()) changeLang(b.dataset.l); };
}

// ---------- the Hijri calendar: today's date, the month grid, the converter and the seasons of worship ----------
const HJ = setupHijri({ view, $, esc, icon, t, num, sep, getLang, share, SITE, setHeader: (...a) => setHeader(...a), setNav: n => setNav(n), prayer: PR });
// ---------- the Qibla: its direction from the place of the prayer times, a compass, and the sun's help ----------
const QB = setupQibla({ view, $, esc, icon, t, num, sep, getLang, toast, share, SITE, vibrate, setHeader: (...a) => setHeader(...a), setNav: n => setNav(n), prayer: PR });

// ---------- router ----------
function setHeader(title, { back = false, actions = "", onTitle = null } = {}) {
  titleEl.textContent = title; backBtn.hidden = !back; actionsEl.innerHTML = actions;
  // A title that opens something (the Quran index on a reading page) acts as a button.
  titleEl.onclick = onTitle; titleEl.classList.toggle("tappable", !!onTitle);
  if (onTitle) { titleEl.setAttribute("role", "button"); titleEl.tabIndex = 0; } else { titleEl.removeAttribute("role"); titleEl.removeAttribute("tabindex"); }
  document.title = PAGE_ROUTE && ownRoute() && getLang() === PAGE_LANG ? PAGE_TITLE
    : title === t("app.name") ? title : `${title} — ${t("app.name")}`;
}
titleEl.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && titleEl.onclick) { e.preventDefault(); titleEl.onclick(); } });
backBtn.addEventListener("click", () => { if (history.length > 1) history.back(); else location.hash = "#/"; });
// Bottom bar: Home, Quran, Adhkar, Hadith, More. Pages reached from "More" highlight that tab.
const NAV_OF = { listen: "more", tasbih: "more", settings: "more", offline: "more", videos: "more", hijri: "more", qibla: "more" };
function setNav(name) { name = NAV_OF[name] || name; document.querySelectorAll(".bottom-nav a").forEach(a => a.classList.toggle("on", a.dataset.nav === name)); }

function route() {
  const h = location.hash || "#/"; const [path, qs] = h.slice(1).split("?"); const parts = path.split("/").filter(Boolean); const params = new URLSearchParams(qs || "");
  // The printed Mushaf fills the screen: the app bars step aside there (see .mm-on in app.css).
  document.body.classList.toggle("mm-on", parts[0] === "mushaf");
  stopAudio(); updateWakeLock(parts[0] === "cat" || parts[0] === "mushaf" || (parts[0] === "quran" && parts.length > 1) || (parts[0] === "tafsir" && parts.length > 2) || (parts[0] === "kutub" && parts.length > 2)); view.scrollTop = 0; window.scrollTo(0, 0);
  if (!parts.length) return renderHub(params.get("q") || "");
  switch (parts[0]) {
    case "section": return renderSection(parts[1]);
    case "cat": return renderCategory(Number(parts[1]), params);
    case "fav": return renderFavorites();
    case "extras": return renderExtras();
    case "tasbih": return renderTasbih();
    case "settings": return renderSettings();
    case "quran": return Q.quran(parts.slice(1), params);
    case "listen": return Q.listen(parts.slice(1), params);
    case "radio": return Q.radio(parts.slice(1));
    case "videos": return V.render(parts.slice(1), params);
    case "offline": return Q.offline();
    case "mushaf": return Q.mushaf(parts[1], Number(parts[2]), params);
    case "search": return renderHub(params.get("q") || "");
    case "adhkar": return renderHome(params.get("q") || "");
    case "hadith": return H.render(parts.slice(1), params);
    case "tafsir": return TF.render(parts.slice(1), params);
    case "tajweed": return TJ.render(parts.slice(1));
    case "asma": return AS.render(parts.slice(1));
    case "kutub": return KT.render(parts.slice(1), params);
    case "faqih": return FQ.render(parts.slice(1), params);
    case "prayer": return PR.render(parts.slice(1), params);
    case "hijri": return HJ.render(parts.slice(1), params);
    case "qibla": return QB.render();
    case "more": return renderMore();
    // Unknown address (for example a link to a newer version's page): show Home but keep the address,
    // so the page opens once the app updates instead of the link being lost.
    default: return renderHub();
  }
}
window.addEventListener("hashchange", route);

// ---------- views ----------
function buildSearchIndex() {
  const en = EN || { titles: {}, items: {} };
  return DB.categories.map(c => ({
    c, title: normalizeSearch([c.title, catTitle(c), en.titles[c.id] || ""].join(" ")),
    items: c.items.map(i => ({ i, text: normalizeSearch(i.text + " " + (i.evening || "") + " " + (en.items[i.id]?.t || "") + " " + (en.items[i.id]?.n || "")) })),
  }));
}
// Adhkar search shared by the Home and Adhkar pages. Returns null when the query is too short.
function adhkarSearch(query, limit = 60) {
  const nq = normalizeSearch(query); if (nq.length < 2) return null;
  searchIndex ||= buildSearchIndex();
  const hits = []; const terms = nq.split(" ");
  searchIndex.forEach(({ c, title, items }) => {
    if (terms.every(x => title.includes(x))) hits.push({ c });
    items.forEach(({ i, text }) => { if (terms.every(x => text.includes(x))) hits.push({ c, i }); });
  });
  const html = `<h2 class="section-title">${T("count.results", { n: hits.length })}</h2><div class="list">` + hits.slice(0, limit).map(({ c, i }) =>
    `<a href="#/cat/${c.id}${i ? "?item=" + i.id : ""}"><div class="num">${icon("book")}</div><div class="lbl">${esc(catTitle(c))}${i ? `<span class="sub" lang="ar" dir="rtl">${esc(stripTashkeel(plainText(i.text))).slice(0, 90)}…</span>` : ""}</div>${icon("back", "chev")}</a>`).join("") + `</div>`;
  return { count: hits.length, html };
}

// ---------- Home: a hub for every part of the app ----------
const HUB_TILES = [
  { href: "#/prayer", icon: "prayer", label: () => t("prayer.title") },
  { href: "#/qibla", icon: "kaaba", label: () => t("qibla.title") },
  { href: "#/hijri", icon: "calendar", label: () => t("hijri.title") },
  { href: "#/adhkar", icon: "sun", label: () => t("nav.adhkar") },
  { href: "#/quran", icon: "quran", label: () => t("nav.quran") },
  { href: "#/hadith", icon: "books", label: () => t("hadith.books") },
  { href: "#/tafsir", icon: "tafsir", label: () => t("tafsir.books") },
  { href: "#/tajweed", icon: "palette", label: () => t("tajweed.title") },
  { href: "#/asma", icon: "asma", label: () => t("asma.title") },
  { href: "#/kutub", icon: "kutub", label: () => t("kutub.title") },
  { href: "#/faqih", icon: "fiqh", label: () => t("faqih.title") },
  { href: "#/listen", icon: "headphones", label: () => t("listen.recitations") },
  { href: "#/radio", icon: "radio", label: () => t("listen.radios") },
  { href: "#/videos", icon: "video", label: () => t("videos.title") },
  { href: "#/tasbih", icon: "beads", label: () => t("nav.tasbih") },
];
function renderHub(q = "") {
  setNav("home");
  setHeader(t("app.name"), { actions: `<button class="icon-btn" id="a-lang" aria-label="${T("common.language")}">${icon("globe")}</button><button class="icon-btn" id="a-search" aria-label="${T("common.search")}">${icon("search")}</button>` });
  $("#a-lang").onclick = pickLanguage;
  const h = new Date().getHours();
  const greet = t(h < 12 ? "home.greetMorning" : h < 18 ? "home.greetEvening" : "home.greetNight");
  // What fits now: morning adhkar until mid-afternoon, evening adhkar until night, then the adhkar before sleeping.
  const now = h >= 4 && h < 15 ? { id: 27, period: "morning", label: t("home.morning"), ic: "sun" }
    : h >= 15 && h < 21 ? { id: 27, period: "evening", label: t("home.evening"), ic: "moon" }
    : { id: 28, label: t("home.sleep"), ic: "bed" };
  const p = catProgress(catById.get(now.id), now.period);
  const qs = LS.get("quran", {}); const reading = qs.last || qs.lastPage;
  view.innerHTML = `
    <section class="hero">
      <h2>${esc(greet)}</h2>
      <p class="verse" lang="ar" dir="rtl">«فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ»</p>
      <p class="verse-ref">${T("home.verseRef")}</p>
      ${HJ.hubLine()}
      ${PR.hubRow()}
      <a class="now" href="#/cat/${now.id}">${icon(now.ic)}<div><small>${T("hub.now")}</small><b>${esc(now.label)}</b><div class="progress light"><div style="width:${p.pct}%"></div></div></div><span class="pct">${T("common.percent", { n: p.pct })}</span></a>
      ${reading ? `<a class="now" id="hub-quran" href="#/quran">${icon("quran")}<div><small>${T("quran.continue")}</small><b id="hub-last">…</b></div>${icon("back", "chev")}</a>` : ""}
    </section>
    ${IN.card()}
    <div class="searchbox">${icon("search")}<input id="q" type="search" placeholder="${T("hub.searchPlaceholder")}" value="${esc(q)}" autocomplete="off" enterkeyhint="search"></div>
    <div id="results"></div>
    <footer class="foot"><a href="#/settings">${T("common.copyright", { years: COPYRIGHT_YEARS, name: t("app.name") })}</a></footer>`;
  IN.bind(view);
  if (reading) Q.resume().then(r => { const a = document.getElementById("hub-quran"); if (!a || !r) return; a.href = r.href; $("#hub-last").textContent = r.text; }).catch(() => {});
  const input = $("#q"), results = $("#results");
  const tiles = () => {
    results.innerHTML = `<h2 class="section-title">${T("hub.sections")}</h2><div class="hub-grid">${HUB_TILES.map(x =>
      `<a class="hub-tile ${x.soon ? "soon" : ""}" href="${x.href}"><div class="ic">${icon(x.icon)}</div><div class="t">${esc(x.label())}</div>${x.soon ? `<div class="c">${T("hub.soon")}</div>` : ""}</a>`).join("")}</div>`;
  };
  let seq = 0;
  const doSearch = async () => {
    const query = input.value.trim(); const r = adhkarSearch(query, 20); if (!r) return tiles();
    const mine = ++seq;
    const [surahs, names, books, series] = await Promise.all([Q.searchSurahs(query).catch(() => []), AS.search(query).catch(() => []), KT.search(query).catch(() => []), V.search(query).catch(() => [])]); if (mine !== seq) return;
    results.innerHTML =
      (surahs.length ? `<h2 class="section-title">${T("quran.surahs")}</h2><div class="list">${surahs.slice(0, 8).map(x => `<a href="${x.href}"><div class="num">${num(x.n)}</div><div class="lbl">${esc(x.name)}</div>${icon("back", "chev")}</a>`).join("")}</div>` : "")
      + (names.length ? `<h2 class="section-title">${T("asma.title")}</h2><div class="list">${names.slice(0, 6).map(x => `<a href="${x.href}"><div class="num">${num(x.n)}</div><div class="lbl" lang="ar" dir="rtl">${esc(x.name)}</div>${icon("back", "chev")}</a>`).join("")}</div>` : "")
      + (books.length ? `<h2 class="section-title">${T("kutub.title")}</h2><div class="list">${books.slice(0, 6).map(x => `<a href="${x.href}"><div class="num">${icon(x.icon)}</div><div class="lbl">${esc(x.name)}<span class="sub">${esc(x.sub)}</span></div>${icon("back", "chev")}</a>`).join("")}</div>` : "")
      + (series.length ? `<h2 class="section-title">${T("videos.title")}</h2><div class="list">${series.slice(0, 6).map(x => `<a href="${x.href}"><div class="num">${icon("video")}</div><div class="lbl">${esc(x.name)}<span class="sub">${esc(x.sub)}</span></div>${icon("back", "chev")}</a>`).join("")}</div>` : "")
      + `<div class="list" style="margin-top:12px"><a href="#/quran?q=${encodeURIComponent(query)}"><div class="num">${icon("quran")}</div><div class="lbl">${T("hub.searchQuran", { q: query })}</div>${icon("back", "chev")}</a></div>`
      + (r.count ? r.html : "");
  };
  input.addEventListener("input", doSearch); doSearch();
  $("#a-search").onclick = () => { input.focus(); input.scrollIntoView({ behavior: "smooth", block: "start" }); };
}

function renderMore() {
  setNav("more"); setHeader(t("nav.more"));
  const rows = [
    ["#/prayer", "prayer", t("prayer.title")], ["#/qibla", "kaaba", t("qibla.title")], ["#/hijri", "calendar", t("hijri.title")], ["#/tafsir", "tafsir", t("tafsir.books")], ["#/tajweed", "palette", t("tajweed.title")], ["#/asma", "asma", t("asma.title")], ["#/kutub", "kutub", t("kutub.title")], ["#/faqih", "fiqh", t("faqih.title")],
    ["#/listen", "headphones", t("listen.recitations")], ["#/radio", "radio", t("listen.radios")], ["#/videos", "video", t("videos.title")], ["#/tasbih", "beads", t("nav.tasbih")],
    ["#/fav", "star", t("common.favorites")], ["#/extras", "book", t("extra.section")], ["#/offline", "download", t("offline.title")], ["#/settings", "settings", t("nav.settings")],
  ];
  view.innerHTML = `<div class="list">${rows.map(([href, ic, label]) => `<a href="${href}"><div class="num">${icon(ic)}</div><div class="lbl">${esc(label)}</div>${icon("back", "chev")}</a>`).join("")}</div>`;
}

function renderHome(q = "") {
  setNav("adhkar");
  setHeader(t("nav.adhkar"), { actions: `<button class="icon-btn" id="a-lang" aria-label="${T("common.language")}">${icon("globe")}</button><a class="icon-btn" href="#/fav" aria-label="${T("common.favorites")}">${icon("star")}</a><button class="icon-btn" id="a-search" aria-label="${T("common.search")}">${icon("search")}</button>` });
  $("#a-lang").onclick = pickLanguage;
  const period = currentPeriod(); const h = new Date().getHours();
  const greet = t(h < 12 ? "home.greetMorning" : h < 18 ? "home.greetEvening" : "home.greetNight");
  const p27 = catProgress(catById.get(27), period), p28 = catProgress(catById.get(28)), p1 = catProgress(catById.get(1));
  const quick = (id, label, ic, p) => `<a href="#/cat/${id}">${icon(ic)}<span>${esc(label)}</span><span class="pct">${p.pct ? T("common.percent", { n: p.pct }) : ""}</span></a>`;
  view.innerHTML = `
    <section class="hero">
      <h2>${esc(greet)}</h2>
      <p class="verse" lang="ar" dir="rtl">«فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ»</p>
      <p class="verse-ref">${T("home.verseRef")}</p>
      <div class="quick">
        ${quick(27, t(period === "morning" ? "home.morning" : "home.evening"), period === "morning" ? "sun" : "moon", p27)}
        ${quick(28, t("home.sleep"), "bed", p28)}
        ${quick(1, t("home.waking"), "sun", p1)}
        ${quick(25, t("home.afterPrayer"), "prayer", catProgress(catById.get(25)))}
      </div>
    </section>
    <div class="searchbox">${icon("search")}<input id="q" type="search" placeholder="${T("home.searchPlaceholder")}" value="${esc(q)}" autocomplete="off" enterkeyhint="search"></div>
    <div id="results"></div>`;
  const input = $("#q"), results = $("#results");
  const renderSections = () => {
    results.innerHTML = `<h2 class="section-title">${T("home.sections")}</h2><div class="grid">` + DB.sections.map(s =>
      `<a class="tile" href="#/section/${s.id}"><div class="ic">${icon(s.icon)}</div><div class="t">${esc(sectionTitle(s))}</div><div class="c">${T("count.chapters", { n: s.cats.length })}</div></a>`).join("") + `</div>`
      + (EXTRAS.length ? `<a class="extra-link" href="#/extras">${icon("book")}<div><b>${T("extra.section")}</b><span>${T("extra.sectionHint")}</span></div>${icon("back", "chev")}</a>` : "");
  };
  const doSearch = () => {
    const r = adhkarSearch(input.value); if (!r) return renderSections();
    results.innerHTML = r.count ? r.html : `<div class="empty">${icon("search")}<div>${T("search.noResultsFor", { q: input.value })}</div></div>`;
  };
  input.addEventListener("input", doSearch); doSearch();
  $("#a-search").onclick = () => { input.focus(); input.scrollIntoView({ behavior: "smooth", block: "start" }); };
}

function renderSection(id) {
  const s = DB.sections.find(x => x.id === id); if (!s) { location.hash = "#/"; return; }
  setNav("adhkar"); setHeader(sectionTitle(s), { back: true });
  view.innerHTML = `<div class="list">` + s.cats.map((cid, n) => { const c = catById.get(cid); const p = catProgress(c);
    return `<a href="#/cat/${c.id}"><div class="num">${num(n + 1)}</div><div class="lbl">${esc(catTitle(c))}<span class="sub">${T("count.adhkar", { n: c.items.length })}${p.pct === 100 ? `${sep()}✓ ${T("section.completed")}` : ""}</span></div>${icon("back", "chev")}</a>`; }).join("") + `</div>`;
}

// Morning/evening chapter: in the evening, show the evening wording the book gives in its notes (item.evening).
const isEveningText = (cat, item) => cat.id === 27 && !!item.evening && currentPeriod() === "evening";
const textFor = (cat, item) => isEveningText(cat, item) ? item.evening : item.text;

// Adhkar counter: "up" (the default) shows how many times were said (0, 1 … 6), "down" shows how many are left (7, 6 … 1). A check mark when done.
const countShown = (n, repeat) => n >= repeat ? icon("check") : num(settings.countMode === "up" ? n : repeat - n);
const countBtn = (n, repeat, attrs = "") => `<button class="count-btn" type="button"${attrs} aria-label="${T("dhikr.count")}"><span class="big">${countShown(n, repeat)}</span>${repeat > 1 ? `<span class="of">/ ${num(repeat)}</span>` : ""}</button>`;

function dhikrCard(cat, item, { showWhere = false } = {}) {
  const key = itemKey(cat, item); const n = getCount(key); const done = n >= item.repeat; const fav = favorites.has(`${cat.id}:${item.id}`);
  const tr = showAdhkarTr() && EN?.items[item.id];
  const evening = isEveningText(cat, item);
  return `<article class="dhikr ${done ? "done" : ""}" data-key="${key}" data-cat="${cat.id}" data-item="${item.id}" id="item-${item.id}">
    ${showWhere ? `<div class="where" style="padding-top:12px">${icon("book")} ${esc(catTitle(cat))}</div>` : ""}
    <div class="dhikr-text" lang="ar" dir="rtl" role="button" tabindex="0" aria-label="${T("dhikr.tapToCount")}">${formatText(textFor(cat, item))}</div>
    ${tr ? `<div class="dhikr-tr" lang="en" dir="ltr">${evening ? `<p class="trnote" dir="auto">${T("dhikr.trMorning")}</p>` : ""}${tr.n ? `<p class="translit">${esc(tr.n)}</p>` : ""}${tr.t ? `<p>${esc(tr.t)}</p>` : ""}</div>` : ""}
    <div class="dhikr-bar">
      ${countBtn(n, item.repeat)}
      <span class="spacer"></span>
      <button class="icon-btn ${fav ? "active" : ""}" data-act="fav" type="button" aria-label="${T(fav ? "fav.remove" : "fav.add")}">${icon(fav ? "star-f" : "star")}</button>
      <button class="icon-btn" data-act="copy" type="button" aria-label="${T("common.copy")}">${icon("copy")}</button>
      <button class="icon-btn" data-act="share" type="button" aria-label="${T("common.share")}">${icon("share")}</button>
      ${item.audio && !evening ? `<button class="icon-btn" data-act="play" type="button" aria-label="${T("common.listen")}">${icon("play")}</button>` : ""}
    </div>
  </article>`;
}
// Copy/share: Arabic text, plus the official English translation when it is shown.
// In the evening the English translation (of the morning wording) is left out.
function dhikrPlain(cat, item) {
  const tr = showAdhkarTr() && EN?.items[item.id];
  return plainText(textFor(cat, item)) + (tr?.t && !isEveningText(cat, item) ? `\n\n${tr.t}` : "");
}

function bindCards(root, onCount) {
  root.addEventListener("click", e => {
    const card = e.target.closest(".dhikr"); if (!card) return;
    const cat = catById.get(Number(card.dataset.cat)); const item = cat.items.find(i => i.id === Number(card.dataset.item));
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "fav") {
      const k = `${cat.id}:${item.id}`; const btn = e.target.closest("[data-act]");
      if (favorites.has(k)) { favorites.delete(k); toast(t("fav.removed")); } else { favorites.add(k); toast(t("fav.added")); }
      saveFav(); btn.classList.toggle("active", favorites.has(k)); btn.innerHTML = icon(favorites.has(k) ? "star-f" : "star"); return;
    }
    if (act === "copy") return copyText(dhikrPlain(cat, item));
    if (act === "share") return shareText(catTitle(cat), dhikrPlain(cat, item), catUrl(cat, item));
    if (act === "play") return togglePlay(item.audio, e.target.closest("[data-act]"));
    if (e.target.closest(".dhikr-text") || e.target.closest(".count-btn")) {
      if (window.getSelection && String(window.getSelection()).length) return; // user is selecting text
      count(card, cat, item, onCount);
    }
  });
  root.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("dhikr-text")) { e.preventDefault(); e.target.click(); }
  });
}
function count(card, cat, item, onCount) {
  const key = card.dataset.key; let n = getCount(key);
  if (n >= item.repeat) return; n++; progress.counts[key] = n; saveProgress(); vibrate(n >= item.repeat ? 40 : 12);
  const done = n >= item.repeat; card.classList.toggle("done", done);
  $(".count-btn .big", card).innerHTML = countShown(n, item.repeat);
  if (done && settings.autoNext) { const next = card.nextElementSibling; if (next && next.classList.contains("dhikr")) setTimeout(() => next.scrollIntoView({ behavior: "smooth", block: "center" }), 250); }
  onCount && onCount(done);
}

function renderCategory(id, params) {
  const cat = catById.get(id); if (!cat) { location.hash = "#/"; return; }
  // ?p=morning / ?p=evening: the website's separate morning and evening pages open on their own period.
  const p = params?.get("p"); if (cat.id === 27 && (p === "morning" || p === "evening")) periodOverride = p;
  setNav("adhkar");
  const is27 = cat.id === 27;
  setHeader(catTitle(cat), { back: true, actions: `${cat.audio ? `<button class="icon-btn" id="a-audio" aria-label="${T("cat.listenAll")}">${icon("play")}</button>` : ""}<button class="icon-btn" id="a-reset" aria-label="${T("cat.resetCount")}">${icon("reset")}</button>` });
  const draw = () => {
    const p = catProgress(cat);
    view.innerHTML = `
      ${is27 ? `<div style="text-align:center"><div class="segmented" role="tablist">
        <button role="tab" data-p="morning" class="${currentPeriod() === "morning" ? "on" : ""}">${icon("sun")} ${T("cat.morning")}</button>
        <button role="tab" data-p="evening" class="${currentPeriod() === "evening" ? "on" : ""}">${icon("moon")} ${T("cat.evening")}</button></div></div>` : ""}
      <div class="progress-row"><div class="progress"><div style="width:${p.pct}%"></div></div><span id="pct">${T("common.percent", { n: p.pct })}</span></div>
      <div id="cards">${itemsFor(cat).map(i => dhikrCard(cat, i)).join("")}</div>
      <div id="finish" class="finish" ${p.pct === 100 ? "" : "hidden"}>${icon("check")}${T("cat.finished", { title: catTitle(cat) })}</div>
      ${is27 && EXTRAS.some(x => (x.periods || []).includes(currentPeriod())) ? `<a class="info" href="#/extras">${icon("book")}<div>${T("extra.seeAlso")}</div></a>` : ""}`;
    const cards = $("#cards");
    bindCards(cards, () => { const p2 = catProgress(cat); $(".progress > div").style.width = p2.pct + "%"; $("#pct").textContent = t("common.percent", { n: p2.pct }); $("#finish").hidden = p2.pct !== 100; if (p2.pct === 100) vibrate([40, 60, 40]); });
    if (is27) view.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { periodOverride = b.dataset.p; draw(); });
  };
  draw();
  const want = new URLSearchParams((location.hash.split("?")[1]) || "").get("item");
  if (want) { const el = document.getElementById("item-" + want); if (el) setTimeout(() => { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.style.outline = "2px solid var(--accent)"; setTimeout(() => el.style.outline = "", 1800); }, 60); }
  $("#a-reset").onclick = () => { itemsFor(cat).forEach(i => { delete progress.counts[itemKey(cat, i)]; }); saveProgress(); draw(); toast(t("cat.countReset")); };
  const ab = $("#a-audio"); if (ab) ab.onclick = () => togglePlay(cat.audio, ab);
}

function renderExtras() {
  setNav("adhkar"); setHeader(t("extra.section"), { back: true });
  const period = currentPeriod();
  const key = x => `x:${x.id}` + ((x.periods || []).length ? ":" + period : "");
  view.innerHTML = `<p class="riwayah-note">${T("extra.sectionHint")}</p><div id="extras">${EXTRAS.map(x => {
    const n = getCount(key(x)); const done = n >= x.repeat;
    return `<article class="dhikr extra ${done ? "done" : ""}" data-x="${esc(x.id)}">
      <div class="badges"><span class="badge warn">${T("extra.notInBook")}</span>${x.grade === "weak" ? `<span class="badge danger">${T("extra.weak")}</span>` : ""}${(x.periods || []).length === 2 ? `<span class="badge">${T("extra.morningEvening")}</span>` : ""}</div>
      <h3 class="extra-title">${T("extra." + x.id + ".title")}</h3>
      <div class="dhikr-text" lang="ar" dir="rtl" role="button" tabindex="0" aria-label="${T("dhikr.tapToCount")}">${formatText(x.text)}</div>
      <div class="ruling"><b>${T("extra.ruling")}</b>
        <blockquote lang="ar" dir="rtl">«${esc(x.ruling.quote)}» <cite>— ${esc(x.ruling.by)}، ${esc(x.ruling.source)}</cite></blockquote>
        ${getLang() !== "ar" ? `<p>${T("extra." + x.id + ".summary")}</p>` : ""}
        <a href="${esc(x.ruling.url)}" target="_blank" rel="noopener">${T("extra.readFatwa")}</a></div>
      <div class="dhikr-bar">
        ${countBtn(n, x.repeat, ' data-act="count"')}
        <span class="spacer"></span>
        <button class="icon-btn" data-act="copy" type="button" aria-label="${T("common.copy")}">${icon("copy")}</button>
        <button class="icon-btn" data-act="share" type="button" aria-label="${T("common.share")}">${icon("share")}</button>
      </div></article>`; }).join("")}</div>`;
  $("#extras").addEventListener("click", e => {
    if (e.target.closest("a, blockquote")) return;
    const card = e.target.closest("[data-x]"); if (!card) return;
    const x = EXTRAS.find(y => y.id === card.dataset.x); const act = e.target.closest("[data-act]")?.dataset.act;
    // Copies always say where the text comes from and its grading.
    const plain = `${x.text}

(${t("extra.notInBook")}${sep()}${t("extra.weak")}: ${x.ruling.by})`;
    if (act === "copy") return copyText(plain);
    if (act === "share") return shareText(t("extra." + x.id + ".title"), plain, `${SITE}#/extras`);
    if (act === "count" || e.target.closest(".dhikr-text")) {
      if (window.getSelection && String(window.getSelection()).length) return;
      let n = getCount(key(x)); if (n >= x.repeat) return;
      progress.counts[key(x)] = ++n; saveProgress(); vibrate(n >= x.repeat ? 40 : 12);
      card.classList.toggle("done", n >= x.repeat);
      $(".count-btn .big", card).innerHTML = countShown(n, x.repeat);
    }
  });
}

function renderFavorites() {
  setNav("adhkar"); setHeader(t("common.favorites"), { back: true });
  const keys = [...favorites].map(k => k.split(":").map(Number)).map(([c, i]) => ({ cat: catById.get(c), item: catById.get(c)?.items.find(x => x.id === i) })).filter(x => x.cat && x.item);
  if (!keys.length) { view.innerHTML = `<div class="empty">${icon("star")}<div>${T("fav.empty")}<br>${T("fav.emptyHint")}</div></div>`; return; }
  view.innerHTML = `<div id="cards">${keys.map(({ cat, item }) => dhikrCard(cat, item, { showWhere: true })).join("")}</div>`;
  bindCards($("#cards"));
}

const PHRASES = ["سُبْحَانَ اللَّهِ", "الْحَمْدُ لِلَّهِ", "اللَّهُ أَكْبَرُ", "لَا إِلَهَ إِلَّا اللَّهُ", "أَسْتَغْفِرُ اللَّهَ", "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ"];
// The virtue of each phrase, from Hisn al-Muslim's own chapters (as [chapter, item]): 130 = the virtue of tasbih,
// tahmid, tahlil and takbir; 129 = seeking forgiveness and repentance; 107 = the virtue of prayers upon the Prophet ﷺ.
const PHRASE_VIRTUES = [
  [[130, 258], [130, 257], [130, 261]],
  [[130, 264], [130, 257], [130, 261]],
  [[130, 257], [130, 261]],
  [[130, 264], [130, 261], [130, 257], [130, 255]],
  [[129, 248], [129, 249], [129, 253], [129, 250]],
  [[130, 254], [130, 256], [130, 259]],
  [[130, 260]],
  [[107, 219], [107, 220], [107, 221], [107, 222], [107, 223]],
];
function virtueCard(cat, item) {
  const tr = showAdhkarTr() && EN?.items[item.id];
  return `<article class="dhikr virtue" data-cat="${cat.id}" data-item="${item.id}">
    <div class="dhikr-text" lang="ar" dir="rtl">${formatText(item.text)}</div>
    ${tr ? `<div class="dhikr-tr" lang="en" dir="ltr">${tr.n ? `<p class="translit">${esc(tr.n)}</p>` : ""}${tr.t ? `<p>${esc(tr.t)}</p>` : ""}</div>` : ""}
    <div class="dhikr-bar">
      <a class="from" href="#/cat/${cat.id}?item=${item.id}">${icon("book")}<span>${esc(catTitle(cat))}</span></a>
      <span class="spacer"></span>
      <button class="icon-btn" data-act="copy" type="button" aria-label="${T("common.copy")}">${icon("copy")}</button>
      <button class="icon-btn" data-act="share" type="button" aria-label="${T("common.share")}">${icon("share")}</button>
      ${item.audio ? `<button class="icon-btn" data-act="play" type="button" aria-label="${T("common.listen")}">${icon("play")}</button>` : ""}
    </div>
  </article>`;
}
function renderTasbih() {
  setNav("tasbih"); setHeader(t("nav.tasbih"), { back: true, actions: `<button class="icon-btn" id="a-reset" aria-label="${T("tasbih.reset")}">${icon("reset")}</button>` });
  view.innerHTML = `<section class="tasbih">
      <div class="phrases" dir="rtl">${PHRASES.map((p, i) => `<button class="chip ${tasbih.phrase === i ? "on" : ""}" data-ph="${i}" lang="ar" aria-pressed="${tasbih.phrase === i}">${p}</button>`).join("")}</div>
      <button class="big-btn" id="tap" type="button" aria-label="${T("tasbih.tap")}"><div><div class="num">${num(tasbih.count)}</div><div class="lbl"></div></div></button>
      <div class="targets">${[33, 100, 1000, 0].map(x => `<button class="chip" data-t="${x}">${x ? num(x) : "∞"}</button>`).join("")}</div>
    </section>
    <section class="virtues" aria-labelledby="virtues-h"><h2 class="section-title" id="virtues-h">${T("tasbih.virtue")}</h2><div id="virtues"></div></section>`;
  const box = $(".tasbih .phrases"), numEl = $(".tasbih .num");
  const showCount = () => { numEl.textContent = num(tasbih.count); };
  const showTarget = () => {
    $(".tasbih .lbl").textContent = tasbih.target ? t("tasbih.target", { n: tasbih.target }) : t("tasbih.noLimit");
    view.querySelectorAll("[data-t]").forEach(b => b.classList.toggle("on", Number(b.dataset.t) === tasbih.target));
  };
  const showVirtues = () => {
    const list = (PHRASE_VIRTUES[tasbih.phrase] || []).map(([c, i]) => ({ cat: catById.get(c), item: catById.get(c)?.items.find(x => x.id === i) })).filter(x => x.item);
    if (playingBtn && $("#virtues").contains(playingBtn)) stopAudio();
    $(".virtues").hidden = !list.length;
    $("#virtues").innerHTML = list.map(({ cat, item }) => virtueCard(cat, item)).join("");
  };
  // Scroll the phrase strip only as far as needed to show the chosen chip whole (centred when the page opens).
  const reveal = (chip, center) => {
    const b = box.getBoundingClientRect(), c = chip.getBoundingClientRect();
    const dx = center ? (c.left + c.right - b.left - b.right) / 2 : c.left < b.left ? c.left - b.left - 8 : c.right > b.right ? c.right - b.right + 8 : 0;
    if (dx) box.scrollBy({ left: dx, behavior: center ? "auto" : "smooth" });
  };
  showTarget(); showVirtues();
  const center = () => { const c = box.querySelector(".chip.on"); if (c) reveal(c, true); return box.scrollLeft; };
  const at = center();
  // The chips get wider once the Arabic font has loaded: centre again, unless the strip was scrolled meanwhile.
  document.fonts?.ready.then(() => { if (box.isConnected && box.scrollLeft === at) center(); });
  $("#tap").onclick = () => {
    tasbih.count++;
    if (tasbih.target && tasbih.count >= tasbih.target) { vibrate([40, 60, 40]); toast(t("tasbih.completed", { n: tasbih.target })); tasbih.count = 0; } else vibrate(10);
    saveTasbih(); showCount();
  };
  view.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { tasbih.target = Number(b.dataset.t); tasbih.count = 0; saveTasbih(); showTarget(); showCount(); });
  // Choosing another dhikr starts its count from zero. Only the parts that change are updated,
  // so the phrase strip keeps its scroll position.
  box.querySelectorAll("[data-ph]").forEach(b => b.onclick = () => {
    const ph = Number(b.dataset.ph); if (ph === tasbih.phrase) return;
    tasbih.phrase = ph; tasbih.count = 0; saveTasbih();
    box.querySelectorAll("[data-ph]").forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
    showCount(); showVirtues(); reveal(b, false);
  });
  $("#virtues").addEventListener("click", e => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const card = btn.closest(".dhikr"); const cat = catById.get(Number(card.dataset.cat)); const item = cat.items.find(i => i.id === Number(card.dataset.item));
    if (btn.dataset.act === "copy") return copyText(dhikrPlain(cat, item));
    if (btn.dataset.act === "share") return shareText(catTitle(cat), dhikrPlain(cat, item), catUrl(cat, item));
    if (btn.dataset.act === "play") return togglePlay(item.audio, btn);
  });
  $("#a-reset").onclick = () => { tasbih.count = 0; saveTasbih(); showCount(); toast(t("tasbih.wasReset")); };
}
document.addEventListener("keydown", e => { if (e.code === "Space" && location.hash === "#/tasbih" && !e.target.closest("button,input,select")) { e.preventDefault(); $("#tap")?.click(); } });

function renderSettings() {
  setNav("settings"); setHeader(t("nav.settings"), { back: true });
  const sw = (key, label, small, ic, on = settings[key]) => `<div class="setting"><span class="ic">${icon(ic)}</span><div class="lbl">${T(label)}<small>${T(small)}</small></div><button class="switch ${on ? "on" : ""}" data-sw="${key}" role="switch" aria-checked="${!!on}" aria-label="${T(label)}"></button></div>`;
  const link = (href, text) => `<a href="${href}" target="_blank" rel="noopener" style="color:var(--primary)">${esc(text)}</a>`;
  const curLang = LANGS.find(l => l.code === getLang());
  view.innerHTML = `
    ${IN.card()}
    <div class="card">
      <div class="setting"><span class="ic">${icon("globe")}</span><div class="lbl">${T("common.language")}<small>${T("settings.languageHint")}</small></div><button class="btn ghost" id="lang-btn">${esc(curLang?.name || getLang())}</button></div>
    </div>
    <div class="card">
      <a class="setting" href="#/prayer"><span class="ic">${icon("prayer")}</span><div class="lbl">${T("prayer.settings")}<small>${esc(PR.settingsLabel())}</small></div>${icon("back", "chev")}</a>
      <a class="setting" href="#/offline"><span class="ic">${icon("download")}</span><div class="lbl">${T("offline.manage")}<small>${T("offline.manageHint")}</small></div>${icon("back", "chev")}</a>
    </div>
    <h2 class="section-title">${T("settings.appearance")}</h2>
    <div class="card">
      <div class="setting"><span class="ic">${icon("moon")}</span><div class="lbl">${T("settings.theme")}</div><div class="segmented">${[["auto", "settings.themeAuto"], ["light", "settings.themeLight"], ["dark", "settings.themeDark"]].map(([v, l]) => `<button data-theme="${v}" class="${settings.theme === v ? "on" : ""}">${T(l)}</button>`).join("")}</div></div>
      <div class="setting"><span class="ic">${icon("book")}</span><div class="lbl">${T("settings.fontSize")}</div><button class="icon-btn" data-scale="-1" aria-label="${T("settings.smaller")}">${icon("minus")}</button><input class="range" id="scale" type="range" min="0.8" max="1.8" step="0.05" value="${settings.scale}" aria-label="${T("settings.fontSize")}"><button class="icon-btn" data-scale="1" aria-label="${T("settings.larger")}">${icon("plus")}</button></div>
      <div class="preview" lang="ar" dir="rtl">«سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ»</div>
    </div>
    <h2 class="section-title">${T("settings.translations")}</h2>
    <div class="card">
      ${sw("adhkarTr", "settings.adhkarTr", "settings.adhkarTrHint", "translate", showAdhkarTr())}
      <div class="setting"><span class="ic">${icon("quran")}</span><div class="lbl">${T("settings.quranTr")}<small id="qtr-label">${T("common.loading")}</small></div><button class="btn ghost" id="qtr-btn">${T("common.change")}</button></div>
    </div>
    <h2 class="section-title">${T("settings.reading")}</h2>
    <div class="card">
      <div class="setting"><span class="ic">${icon("beads")}</span><div class="lbl">${T("settings.countMode")}<small>${T("settings.countModeHint")}</small></div><div class="segmented">${[["up", "settings.countUp"], ["down", "settings.countDown"]].map(([v, l]) => `<button data-count="${v}" class="${settings.countMode === v ? "on" : ""}">${T(l)}</button>`).join("")}</div></div>
      ${sw("tashkeel", "settings.tashkeel", "settings.tashkeelHint", "book")}
      ${sw("vibrate", "settings.vibrate", "settings.vibrateHint", "settings")}
      ${sw("autoNext", "settings.autoNext", "settings.autoNextHint", "back")}
      ${sw("wakeLock", "settings.wakeLock", "settings.wakeLockHint", "sun")}
    </div>
    <h2 class="section-title">${T("settings.data")}</h2>
    <div class="card">
      <div class="setting"><div class="lbl">${T("settings.resetToday")}<small>${T("settings.resetTodayHint")}</small></div><button class="btn ghost" id="reset-progress">${T("settings.reset")}</button></div>
      <div class="setting"><div class="lbl">${T("settings.clearFav")}<small>${T("count.items", { n: favorites.size })}</small></div><button class="btn danger" id="clear-fav">${T("settings.clear")}</button></div>
    </div>
    <h2 class="section-title">${T("about.title")}</h2>
    <div class="card">
      ${!["ar", "en"].includes(getLang()) ? `<div class="about note">${T("about.machineNote")}</div>` : ""}
      <div class="about">
        <b>${T("about.hisnTitle")}</b><br>${T("about.hisnAuthor")}<br>
        ${th("about.hisnSource", { chapters: t("count.chapters", { n: DB.categories.length }), adhkar: t("count.adhkar", { n: DB.categories.reduce((a, c) => a + c.items.length, 0) }) }, { link: link(DB.sourceUrl, "hisnmuslim.com") }, esc)}<br>
        ${T("about.offline")}
      </div><div class="about">
        <b>${T("about.mushafTitle")}</b><br>${T("about.mushafText", { source: t("kfgqpc.name") })}<br>${T("about.mushafOffline")}
      </div><div class="about">
        <b>${T("about.trTitle")}</b><br>${th("about.trText", {}, { link: link("https://quranenc.com", "QuranEnc.com") }, esc)}
      </div><div class="about">
        <b>${T("about.tafsirTitle")}</b><br>${th("about.tafsirText", {}, { qe: link("https://quranenc.com", "QuranEnc.com"), qul: link("https://qul.tarteel.ai", "QUL") }, esc)}
      </div><div class="about">
        <b>${T("about.tajweedTitle")}</b><br>${th("about.tajweedText", {}, { link: link("https://app.turath.io", "turath.io") }, esc)}
      </div><div class="about">
        <b>${T("about.asmaTitle")}</b><br>${th("about.asmaText", {}, { link: link("https://app.turath.io/book/96493", "turath.io") }, esc)}
      </div><div class="about">
        <b>${T("about.kutubTitle")}</b><br>${th("about.kutubText", {}, { link: link("https://app.turath.io", "turath.io") }, esc)}
      </div><div class="about">
        <b>${T("about.prayerTitle")}</b><br>${th("about.prayerText", {}, { geo: link("https://open-meteo.com", "Open-Meteo"), osm: link("https://www.openstreetmap.org/copyright", "OpenStreetMap"), cf: link("https://www.cloudflare.com/privacypolicy/", "Cloudflare") }, esc)}
        <br>${T("about.adhanText")}<br><span id="adhan-credits"></span>
      </div><div class="about">
        <b>${T("about.hijriTitle")}</b><br>${T("about.hijriText")}
      </div><div class="about">
        <b>${T("about.qiblaTitle")}</b><br>${T("about.qiblaText")}
      </div><div class="about">
        <b>${T("about.audioTitle")}</b><br>${th("about.audioText", {}, { link: link("https://mp3quran.net", "mp3quran.net") }, esc)}
        <br><small>${T("about.version", { v: VERSION })}</small>
        <br>${link(`${SITE}privacy.html`, t("about.privacy"))}
      </div><div class="about rights">
        <b>${T("about.rightsTitle")}</b><br>${T("about.copyright", { years: COPYRIGHT_YEARS, name: t("app.name") })}<br>${T("about.rightsText")}
      </div>
    </div>`;
  view.querySelectorAll("[data-sw]").forEach(b => b.onclick = () => {
    const k = b.dataset.sw; settings[k] = !(k === "adhkarTr" ? showAdhkarTr() : settings[k]); saveSettings();
    b.classList.toggle("on", settings[k]); b.setAttribute("aria-checked", settings[k]);
    if (k === "vibrate") vibrate(20);
    if (k === "adhkarTr" && settings[k]) loadEN().catch(() => toast(t("common.loadFailed")));
  });
  view.querySelectorAll("[data-count]").forEach(b => b.onclick = () => { settings.countMode = b.dataset.count; saveSettings(); view.querySelectorAll("[data-count]").forEach(x => x.classList.toggle("on", x === b)); });
  view.querySelectorAll("[data-theme]").forEach(b => b.onclick = () => { settings.theme = b.dataset.theme; saveSettings(); applyTheme(); view.querySelectorAll("[data-theme]").forEach(x => x.classList.toggle("on", x === b)); });
  const range = $("#scale"); const setScale = v => { settings.scale = Math.min(1.8, Math.max(0.8, Math.round(v * 20) / 20)); range.value = settings.scale; saveSettings(); applyTheme(); };
  range.oninput = () => setScale(Number(range.value));
  view.querySelectorAll("[data-scale]").forEach(b => b.onclick = () => setScale(settings.scale + 0.1 * Number(b.dataset.scale)));
  $("#lang-btn").onclick = pickLanguage;
  Q.translationLabel().then(l => { const x = $("#qtr-label"); if (x) x.textContent = l; });
  PR.credits().then(vs => { const x = $("#adhan-credits"); if (x) x.innerHTML = vs.map(v => `${esc(PR.voiceName(v.id))}: ${v.license ? `${esc(v.by)}${sep()}${link(v.licenseUrl, v.license)}${sep()}${link(v.url, "Wikimedia Commons")}` : link(v.url, v.by)}`).join("<br>"); });
  $("#qtr-btn").onclick = () => Q.pickTranslation(renderSettings);
  $("#reset-progress").onclick = () => { progress = { date: todayKey(), counts: {} }; saveProgress(); toast(t("settings.todayReset")); };
  $("#clear-fav").onclick = () => { if (!favorites.size) return toast(t("settings.favEmpty")); if (confirm(t("settings.confirmClearFav"))) { favorites.clear(); saveFav(); renderSettings(); toast(t("settings.cleared")); } };
  IN.bind(view);
}

// ---------- service worker ----------
function registerSW() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  // On the local dev server, skip the cache so edits show up immediately (add ?sw to test offline mode locally).
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !location.search.includes("sw")) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    return;
  }
  // Updates apply by themselves: the new worker activates right away and the page reloads once.
  // Only reload when an older version was in control, so a first visit never reloads.
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || refreshing) return;
    refreshing = true; toast(t("common.updateAvailable")); setTimeout(() => location.reload(), 300);
  });
  navigator.serviceWorker.register("sw.js").then(reg => {
    // An installed app on a phone can stay open for days: look for a new version whenever it comes back to the screen.
    const check = () => reg.update().catch(() => {});
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    setInterval(check, 60 * 60 * 1000);
    // A version from before 1.2.1 may be installed and waiting: activate it now.
    if (reg.waiting && hadController) reg.waiting.postMessage("SKIP_WAITING");
  }).catch(() => {});
}

// Someone arriving on a website page sees it in the page's language. If their device uses another language
// the app has, offer it once (in that language) instead of switching by itself.
async function offerDeviceLang() {
  const code = browserLang();
  if (!PAGE_LANG || settings.lang || RETURNING || getLang() !== PAGE_LANG || !code || code === PAGE_LANG || LS.get("langOffered", false)) return;
  LS.set("langOffered", true);
  const hint = await fetch(`i18n/${code}.json?v=${VERSION}`).then(r => r.json()).then(d => d["settings.languageHint"]).catch(() => null);
  const name = LANGS.find(l => l.code === code).name;
  toast(hint || name, { label: name, fn: () => changeLang(code) });
}

// ---------- boot ----------
applyTheme();
const startLang = detect(settings.lang, RETURNING, PAGE_LANG);
if (new URLSearchParams(location.search).get("lang") === startLang) { settings.lang = startLang; saveSettings(); }
Promise.all([setLang(startLang, VERSION).catch(() => setLang("ar", VERSION)), loadData()])
  .then(async () => { if (showAdhkarTr() || getLang() !== "ar") await loadEN().catch(() => {}); applyStatic(); route(); registerSW(); offerDeviceLang(); PR.start(); IN.start(); })
  .catch(err => { view.innerHTML = `<div class="empty">Could not load the data · تعذّر تحميل البيانات<br><small>${esc(err.message)}</small><br><br><button class="btn" onclick="location.reload()">↻</button></div>`; });
