/* ===== المصحف بالروايات + ترجمة المعاني + الاستماع + الإذاعات ===== */
// Quran text and fonts: King Fahd Glorious Quran Printing Complex (KFGQPC), shown verbatim.
// Translations of meanings: QuranEnc.com API (shown unchanged, with title and version).
// Recitations and reciter radios: mp3quran.net API. Live and one-subject stations: data/radios.json (verified list).
// Audio lesson series on the radio page: data/lessons.json (IslamHouse.com, scripts/build-series.js).

import * as off from "./offline.js?v=1.34.0";
import { mirrorOf } from "./mirror.js?v=1.34.0";

const API = "https://www.mp3quran.net/api/v3";
const QE = "https://quranenc.com/api/v1";
// Shaykh al-Husary's murattal recitation (Hafs), read 118 of mp3quran's ayat_timing: the voice of the Tajweed examples.
const HUSARY = "https://cdn.mp3quran.net/audio/mahmoud-husary/r1/";
const ch = (...cps) => String.fromCodePoint(...cps);
const range = (a, b) => ch(a) + "-" + ch(b);
const AYA_NUM = new RegExp("[\\s" + ch(0xA0) + "]*[" + range(0x660, 0x669) + "]+[\\s" + ch(0xA0) + "]*$");
const MARKS = new RegExp("[" + range(0x610, 0x61A) + range(0x64B, 0x65F) + range(0x6D6, 0x6ED) + ch(0x640) + range(0x8D3, 0x8FF) + "]", "g");
const DAGGER = ch(0x670);

// Search key: ignores diacritics, Uthmani spelling of alef (dagger alef, alef after waw) and spaces.
export const quranKey = s => s.normalize("NFC").replace(AYA_NUM, "")
  .split(ch(0x648) + DAGGER).join("ا").split(ch(0x649) + DAGGER).join("ى").split(DAGGER).join("ا").split(ch(0x6E7)).join("ي")
  .replace(MARKS, "")
  .replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
  .replace(/[^ء-ي]/g, "").replace(/ا/g, "");

// The same key built letter by letter, with where each key letter is in the text and which word holds it,
// so a match can be shown on the words of the verse. Words without letters (verse numbers, ۞) are not counted.
const WAW = ch(0x648), MAQSURA = ch(0x649), SMALL_YEH = ch(0x6E7);
const MARK = new RegExp("^" + MARKS.source + "$");
const FOLD = { "ٱ": "", "أ": "", "إ": "", "آ": "", "ا": "", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي" };
export function keyChars(text) {
  const s = text.normalize("NFC"); let key = ""; const at = [], word = []; let w = 0, inWord = false;
  for (let i = 0; i < s.length; i++) {
    let c = s[i]; const n = s[i + 1];
    if (c === " ") { if (inWord) { w++; inWord = false; } continue; }
    if (c === WAW && n === DAGGER) { i++; continue; }
    if (c === MAQSURA && n === DAGGER) { i++; c = "ي"; }
    else if (c === DAGGER) continue;
    else if (c === SMALL_YEH) c = "ي";
    else if (MARK.test(c)) continue;
    else if (c in FOLD) c = FOLD[c];
    if (!c || c < "ء" || c > "ي") continue;
    key += c; at.push(i); word.push(w); inWord = true;
  }
  return { key, at, word, words: w + (inWord ? 1 : 0) };
}
const hasLetters = tok => keyChars(tok).key.length > 0;
const matchedWords = (text, k) => {
  const { key, word, words } = keyChars(text); const hit = new Set();
  for (let i = key.indexOf(k); i >= 0; i = key.indexOf(k, i + 1)) for (let j = i; j < i + k.length; j++) hit.add(word[j]);
  return { hit, words };
};

// mp3quran.net localises reciter and riwayah names in these languages; everything else uses English.
const MP3Q_LANG = { ar: "ar", en: "eng", fr: "fr", ru: "ru", de: "de", es: "es", tr: "tr", zh: "cn", ur: "ur", bn: "bn", bs: "bs", fa: "fa", id: "id", pt: "pt", ha: "ha", sw: "sw" };
const KUFI_AYAT = 6236; // QuranEnc numbering follows the Kufan count (Hafs, Shuʿbah)

export function setupQuran(ctx) {
  const { view, $, esc, icon, toast, t, num, sep, getLang, collator, regionName, languageName, setHeader, setNav, LS, copyText, share, SITE, adhkarAudio } = ctx;
  const state = Object.assign({ riwayah: "hafs", last: null, reciters: {}, tab: "surahs", mz: 1, qz: 1 }, LS.get("quran", {}));
  const save = () => LS.set("quran", state);
  // The size of the Quran text, chosen by the reader and kept: the printed page (state.mz: 1 fits the screen, up to 3
  // times that) and the verses of the reader (state.qz, 0.7 to 2.5). Set from the bars, with Ctrl + wheel or Ctrl +, −
  // and 0 on a computer, and by pinching with two fingers on a touch screen (the printed page blocks the browser's zoom).
  const ZOOM = { mz: [1, 3], qz: [0.7, 2.5] };
  const clampZoom = (k, v) => { const [lo, hi] = ZOOM[k]; return Math.min(hi, Math.max(lo, Math.round((+v || 1) * 20) / 20)); };
  state.mz = clampZoom("mz", state.mz); state.qz = clampZoom("qz", state.qz);
  const pct = z => new Intl.NumberFormat(getLang(), { style: "percent", maximumFractionDigits: 0 }).format(z);
  function zoomGestures(el, k, apply, onPinch = () => {}) {
    const set = v => { const z = clampZoom(k, v); if (z !== state[k]) { state[k] = z; apply(z); } return z; };
    el.addEventListener("wheel", e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); set(state[k] + (e.deltaY < 0 ? 0.1 : -0.1)); save(); }, { passive: false });
    let d0 = 0, z0 = 1;
    const dist = e => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    el.addEventListener("touchstart", e => { if (e.touches.length === 2) { d0 = dist(e); z0 = state[k]; onPinch(); } }, { passive: true });
    el.addEventListener("touchmove", e => { if (e.touches.length !== 2 || !d0) return; e.preventDefault(); set(z0 * dist(e) / d0); }, { passive: false });
    el.addEventListener("touchend", () => { if (d0) { d0 = 0; save(); } });
    return set;
  }
  let zoomKeys = null; // the open page or reader: { k, apply }
  document.addEventListener("keydown", e => {
    if (!zoomKeys || !(e.ctrlKey || e.metaKey) || e.altKey || !/^[-+=0]$/.test(e.key) || e.target?.closest?.("input, textarea, select")) return;
    e.preventDefault(); const { k, apply } = zoomKeys;
    const z = e.key === "0" ? 1 : clampZoom(k, state[k] + (e.key === "-" ? -0.1 : 0.1));
    if (z !== state[k]) { state[k] = z; save(); apply(z); }
  });
  window.addEventListener("hashchange", () => { zoomKeys = null; });
  // Bookmarks: any number of verses, newest first. Versions before 1.10 kept a single one (state.bookmark).
  if (!Array.isArray(state.marks)) {
    const b = state.bookmark; state.marks = b ? [{ r: b.r, s: b.s, a: b.a, t: Date.now() }] : []; delete state.bookmark; save();
  }
  // The printed pages open in the colour-coded Tajweed print (since 1.25.0; the 1421 print where its fonts are unknown).
  // Readers on the former default move to it once; a print chosen after that is kept.
  const DEFAULT_ED = "tajweed";
  if (!state.edDefault) {
    if (state.mushafEd === "1421") state.mushafEd = DEFAULT_ED;
    if (state.lastPage?.ed === "1421") state.lastPage.ed = DEFAULT_ED;
    state.edDefault = DEFAULT_ED; save();
  }
  const stale = hash => location.hash !== hash; // user navigated away while we were loading
  const isAr = () => getLang() === "ar";
  const lower = s => String(s).toLocaleLowerCase();

  // ---------- data ----------
  let INDEX = null; const dataCache = new Map(); const fontsReady = new Map(); const searchIdx = new Map();
  async function loadIndex() {
    if (!INDEX) { const r = await fetch("quran/index.json"); if (!r.ok) throw new Error("HTTP " + r.status); INDEX = await r.json(); }
    return INDEX;
  }
  const riw = id => INDEX.riwayat.find(r => r.id === id) || INDEX.riwayat[0];
  const rName = meta => t("riwayah." + meta.id);
  const rShort = meta => t("riwayahShort." + meta.id);
  const surahName = (n, meta) => {
    const s = (meta || INDEX?.riwayat[0])?.surahs[n - 1];
    return !s ? String(n) : isAr() ? s[0] : (s[3] || s[0]);
  };
  function loadFont(meta) {
    if (!fontsReady.has(meta.id)) {
      const ff = new FontFace(`kfgqpc-${meta.id}`, `url(${meta.font}) format("woff2")`, { display: "block" });
      fontsReady.set(meta.id, ff.load().then(f => { document.fonts.add(f); }).catch(() => { fontsReady.delete(meta.id); toast(t("quran.fontFailed")); }));
    }
    return fontsReady.get(meta.id);
  }
  async function loadRiwayah(id) {
    await loadIndex(); const meta = riw(id);
    const font = loadFont(meta);
    let data = dataCache.get(meta.id);
    if (!data) { const r = await fetch(meta.data); if (!r.ok) throw new Error("HTTP " + r.status); data = await r.json(); dataCache.set(meta.id, data); }
    await font; return { meta, data };
  }
  async function isCached(meta) { try { return !!(await caches.match(meta.data)); } catch { return false; } }

  const loading = (msg = t("common.loading")) => `<div class="empty"><div class="spinner"></div><div>${esc(msg)}</div></div>`;
  const failed = (err, retry) => {
    const offline = !navigator.onLine || err instanceof TypeError; // fetch() rejects with TypeError when there is no connection
    view.innerHTML = offline
      ? `<div class="empty">${icon("download")}<div>${esc(t("offline.needOnce"))}</div><br><button class="btn" id="retry">${esc(t("common.retry"))}</button> <a class="btn ghost" href="#/offline">${esc(t("offline.title"))}</a></div>`
      : `<div class="empty">${esc(t("common.loadFailed"))}<br><small>${esc(err.message || err)}</small><br><br><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`;
    $("#retry").onclick = retry;
  };

  // ---------- bottom sheet ----------
  function sheet(title, bodyHtml, { tall = false } = {}) {
    closeSheet();
    const wrap = document.createElement("div"); wrap.className = "sheet-backdrop"; wrap.id = "sheet";
    wrap.innerHTML = `<div class="sheet${tall ? " tall" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="${esc(t("common.close"))}">${icon("close")}</button></div><div class="sheet-body">${bodyHtml}</div></div>`;
    wrap.addEventListener("click", e => { if (e.target === wrap || e.target.closest("[data-close]")) closeSheet(); });
    document.body.appendChild(wrap); document.body.classList.add("no-scroll");
    return $(".sheet-body", wrap);
  }
  function closeSheet() { const s = document.getElementById("sheet"); if (s) s.remove(); document.body.classList.remove("no-scroll"); }
  // The tools bar of a verse selected on a printed page.
  function closeAyabar() { document.getElementById("ayabar")?.remove(); document.querySelectorAll(".mpage span.sel").forEach(x => x.classList.remove("sel")); }
  document.addEventListener("keydown", e => { if (e.key === "Escape") { if (document.getElementById("sheet")) closeSheet(); else closeAyabar(); } });
  window.addEventListener("hashchange", () => { closeSheet(); closeAyabar(); });

  // ---------- remote JSON (memory cache, last copy kept in storage for offline listing) ----------
  const remote = new Map();
  function getJSON(url, { keep = true } = {}) {
    if (remote.has(url)) return remote.get(url);
    // A slow outside service must never freeze a page: give up after 12 s and use the last saved copy, if any.
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 12000);
    const p = fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer)).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(j => { if (keep) LS.set("api:" + url, j); return j; })
      .catch(err => { remote.delete(url); const old = LS.get("api:" + url, null); if (old) return old; throw err; });
    remote.set(url, p); return p;
  }
  const mp3Lang = () => MP3Q_LANG[getLang()] || "eng";
  const getRiwayatList = () => getJSON(`${API}/riwayat?language=${mp3Lang()}`).then(j => j.riwayat);
  const getReciters = rewaya => getJSON(`${API}/reciters?language=${mp3Lang()}&rewaya=${rewaya}`).then(j => j.reciters);
  const getReciterRadios = () => getJSON(`${API}/radios?language=${mp3Lang()}`).then(j => j.radios);
  const once = (url, fix) => { let p = null; return () => p ||= fetch(url).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(fix).catch(e => { p = null; throw e; }); };
  const getRadios = once("data/radios.json", j => ({ live: j.live || [], sunnah: j.sunnah || [], topics: j.topics || [], hide: j.hide || [] }));
  const getLessons = once("data/lessons.json", j => j);

  // ---------- translations of meanings (QuranEnc) ----------
  const getTrList = () => getJSON(`${QE}/translations/list?localization=${isAr() ? "ar" : "en"}`).then(j => j.translations || []);
  const trCache = new Map();
  const trUrl = (key, s) => `${QE}/translation/sura/${key}/${s}`;
  // Older versions copied every translated surah into localStorage, which can fill it up: clean that once.
  try { Object.keys(localStorage).filter(k => k.startsWith("api:" + QE + "/translation/sura/")).forEach(k => localStorage.removeItem(k)); } catch { /* storage unavailable */ }
  function getTrSura(key, s) {
    const k = key + ":" + s;
    if (!trCache.has(k)) trCache.set(k, getJSON(trUrl(key, s), { keep: false }).then(j => j.result || []).catch(e => { trCache.delete(k); throw e; }));
    return trCache.get(k);
  }
  function defaultTr(list) {
    const lang = getLang(); if (lang === "ar") return "";
    const mine = list.find(x => x.language_iso_code === lang);
    return mine ? mine.key : (list.find(x => x.key === "english_rwwad") || list.find(x => x.language_iso_code === "en"))?.key || "";
  }
  async function currentTr() {
    if (state.trChosen) return state.tr || ""; // the user picked one (or none) explicitly
    try { return defaultTr(await getTrList()); } catch { return ""; }
  }
  async function trMeta(key) { if (!key) return null; try { return (await getTrList()).find(x => x.key === key) || null; } catch { return null; } }
  const trLabel = x => x ? `${languageName(x.language_iso_code)}: ${x.title}` : t("quran.noTranslation");

  async function pickTranslation(then) {
    const body = sheet(t("quran.chooseTranslation"), loading());
    let list; try { list = await getTrList(); } catch { body.innerHTML = `<div class="empty">${esc(t("quran.trListFailed"))}</div>`; return; }
    const cur = await currentTr(); const c = collator();
    const rows = list.map(x => ({ x, lang: languageName(x.language_iso_code) })).sort((a, b) => (a.x.language_iso_code === getLang() ? -1 : 0) - (b.x.language_iso_code === getLang() ? -1 : 0) || c.compare(a.lang, b.lang) || c.compare(a.x.title, b.x.title));
    body.innerHTML = `<div class="searchbox small">${icon("search")}<input type="search" id="tr-q" placeholder="${esc(t("quran.trSearch"))}" autocomplete="off"></div><div class="list flat" id="tr-list"></div>`;
    const draw = f => {
      const q = lower(f.trim());
      const none = `<button class="row" data-k=""><div class="lbl">${esc(t("quran.noTranslation"))}</div>${cur === "" ? icon("check") : ""}</button>`;
      $("#tr-list", body).innerHTML = (q ? "" : none) + rows.filter(r => !q || lower(r.lang + " " + r.x.title + " " + r.x.language_iso_code).includes(q))
        .map(r => `<button class="row" data-k="${esc(r.x.key)}"><div class="lbl" dir="auto">${esc(r.lang)}<span class="sub" dir="auto">${esc(r.x.title)}</span></div>${cur === r.x.key ? icon("check") : ""}</button>`).join("") || `<div class="empty">${esc(t("common.noResults"))}</div>`;
    };
    draw(""); $("#tr-q", body).oninput = e => draw(e.target.value);
    $("#tr-list", body).onclick = e => { const b = e.target.closest("[data-k]"); if (!b) return; state.tr = b.dataset.k; state.trChosen = true; save(); closeSheet(); then?.(); };
  }

  // ---------- persistent audio player ----------
  const player = (() => {
    const el = document.getElementById("player"), a = document.getElementById("qaudio");
    const btn = $("#pl-toggle", el), t1 = $(".pl-name", el), ta = $(".pl-aya", el), t2 = $(".pl-sub", el), prev = $("#pl-prev", el), next = $("#pl-next", el);
    let q = null, jumping = false, aya = 0; const listeners = new Set(); // aya: the verse being recited, when known
    // What is playing and where: { server, surah, rid, time, paused, jumping } for a surah, null otherwise.
    // jumping: started at a verse and still silent, before the jump to it (its time means nothing yet).
    const now = () => q?.type === "surahs" ? { server: q.server, surah: q.list[q.idx], rid: q.rid || "", time: a.currentTime, paused: a.paused, jumping } : null;
    const tell = () => { const n = now(); listeners.forEach(f => f(n)); };
    const pad = n => String(n).padStart(3, "0");
    // q.type: "surahs" (a reciter's surahs in order), "tracks" (the lessons of an audio series in order) or "radio" (a live stream).
    const url = () => q.type === "radio" ? q.url : q.type === "tracks" ? q.list[q.idx][0] : `${q.server}${pad(q.list[q.idx])}.mp3`;
    const title = () => q.type === "surahs" ? t("quran.surah", { name: surahName(q.list[q.idx]) }) : q.name;
    function render() {
      el.hidden = !q; document.body.classList.toggle("has-player", !!q); if (!q) return;
      // With the verse number beside it, the surah's name goes without "Surah" so both fit on a phone.
      t1.textContent = aya ? surahName(q.list[q.idx]) : title(); t2.textContent = q.sub || "";
      const lesson = q.type === "tracks" ? t("lessons.n", { n: q.idx + 1 }) : "";
      ta.hidden = !aya && !lesson; ta.textContent = aya ? t("player.aya", { n: aya }) : lesson;
      const steps = q.type !== "radio"; prev.hidden = next.hidden = !steps;
      if (steps) {
        prev.disabled = q.idx <= 0; next.disabled = q.idx >= q.list.length - 1;
        prev.setAttribute("aria-label", t(lesson ? "player.prevLesson" : "player.prev")); next.setAttribute("aria-label", t(lesson ? "player.nextLesson" : "player.next"));
      }
      btn.innerHTML = icon(a.paused ? "play" : "pause"); btn.setAttribute("aria-label", t(a.paused ? "common.play" : "common.pause"));
      document.querySelectorAll("[data-playing]").forEach(x => x.classList.toggle("on", x.dataset.playing === key()));
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: lesson ? `${title()} (${lesson})` : title(), artist: q.sub || "", album: t("app.name"), artwork: [{ src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }] });
      }
    }
    const failMsg = () => t(q.type === "radio" ? "radio.playFailed" : q.type === "tracks" ? "lessons.playFailed" : "listen.playFailed");
    let tok = 0;
    function start() {
      document.getElementById("audio")?.pause();
      const mine = ++tok; const at = q.at; q.at = null;
      el.classList.add("loading"); a.muted = false; jumping = !!at; aya = 0;
      if (at) {
        // Start at a verse. Playback begins right away (inside the tap, as phones require) but silent;
        // once the verse's time is known and the file can seek, it jumps there and the sound comes on.
        a.muted = true;
        const ready = new Promise(r => a.addEventListener("loadedmetadata", r, { once: true }));
        const waitMax = new Promise(r => setTimeout(() => r(null), 8000));
        Promise.race([Promise.all([at, ready]).then(([sec]) => sec), waitMax]).catch(() => null).then(sec => {
          if (mine !== tok) return;
          if (a.readyState > 0) a.currentTime = Number.isFinite(sec) && sec > 0 ? sec : 0; // no verse time: from the beginning
          a.muted = false; jumping = false; tell();
        });
      }
      a.src = url();
      a.play().catch(() => { el.classList.remove("loading"); a.muted = false; jumping = false; toast(failMsg()); render(); tell(); });
      if (q.type === "tracks") q.save?.(q.idx, typeof at === "number" ? at : 0);
      render(); tell();
    }
    function step(d) { if (!q || q.type === "radio") return; const i = q.idx + d; if (i < 0 || i >= q.list.length) return; q.idx = i; start(); }
    const key = () => !q ? "" : q.type === "radio" ? "radio:" + q.id : q.type === "tracks" ? `track:${q.id}:${q.idx}` : `surah:${q.server}:${q.list[q.idx]}`;
    a.addEventListener("playing", () => { el.classList.remove("loading"); render(); });
    a.addEventListener("waiting", () => el.classList.add("loading"));
    a.addEventListener("pause", () => { render(); tell(); });
    a.addEventListener("ended", () => { if (q && q.type !== "radio" && q.idx < q.list.length - 1) step(1); else render(); });
    a.addEventListener("error", () => { if (!q || !a.getAttribute("src")) return; el.classList.remove("loading"); toast(t(q.type === "radio" ? "radio.playFailed" : q.type === "tracks" ? "lessons.loadFailed" : "listen.loadFailed")); render(); });
    a.addEventListener("timeupdate", tell); a.addEventListener("seeked", tell);
    // An audio series remembers the lesson and the minute reached (every few seconds while it plays).
    let savedAt = 0;
    a.addEventListener("timeupdate", () => { if (q?.type === "tracks" && !jumping && Date.now() - savedAt > 5000) { savedAt = Date.now(); q.save?.(q.idx, a.currentTime); } });
    btn.onclick = () => { if (!q) return; if (a.paused) { if (q.type === "radio") start(); else a.play().catch(() => {}); } else a.pause(); };
    prev.onclick = () => step(-1); next.onclick = () => step(1);
    $("#pl-close", el).onclick = () => { a.pause(); a.removeAttribute("src"); a.load(); q = null; jumping = false; aya = 0; render(); tell(); };
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => btn.click());
      navigator.mediaSession.setActionHandler("pause", () => a.pause());
      try { navigator.mediaSession.setActionHandler("previoustrack", () => step(-1)); navigator.mediaSession.setActionHandler("nexttrack", () => step(1)); } catch { /* unsupported */ }
    }
    return {
      // at: seconds (or a promise of seconds, or null) where the first surah starts; the next surahs start at the beginning.
      // rid: the riwayah of the Quran text this recitation follows, when there is one (for following the verse).
      surahs({ server, list, start: s, sub, rid = "", at = null }) { const idx = list.indexOf(s); if (idx < 0) { toast(t("listen.surahUnavailable")); return; } q = { type: "surahs", server, list, idx, sub, rid, at }; start(); },
      radio({ id, url: u, name, sub }) { if (q?.type === "radio" && q.id === id && !a.paused) { a.pause(); return; } q = { type: "radio", id, url: u, name, sub }; start(); },
      // list: [[mp3 url, description], …]; at: the second lesson `start` begins at; save(idx, seconds) is told the place reached.
      tracks({ id, list, start: i = 0, at = null, name, sub, save }) {
        if (q?.type === "tracks" && q.id === id && q.idx === i && a.getAttribute("src")) { if (a.paused) a.play().catch(() => {}); else a.pause(); return; }
        q = { type: "tracks", id, list, idx: i, name, sub, save, at: at > 0 ? at : null }; start();
      },
      pause() { a.pause(); },
      // The current track and time, and a function called with it on every change (about four times a second while playing).
      now, listen(f) { listeners.add(f); return () => listeners.delete(f); },
      showAya(n) { if (q?.type !== "surahs" || n === aya) return; aya = n; render(); },
      key, refresh: render,
    };
  })();

  // ---------- verse timings (mp3quran.net ayat_timing): where each verse starts in a surah recording ----------
  // Some recordings have them. They are made for the files the player plays: the read's folder_url is the moshaf's server.
  let timingReads = null, timedKnown = null; // timedKnown: the same map once loaded, to decide inside a tap
  const timedServers = () => (timingReads ||= getJSON(`${API}/ayat_timing/reads`).then(rs => (timedKnown = new Map(rs.map(r => [r.folder_url, r.id])))).catch(e => { timingReads = null; throw e; }));
  // Where every verse of surah s starts in the recording, in seconds: [0, verse 1, verse 2, …], or null when it has no timings.
  // Only the start times are kept (in storage), so verses can be found again without a connection.
  async function surahStarts(server, s) {
    const read = (await timedServers()).get(server); if (!read) return null;
    const k = `timing:${read}:${s}`; let starts = LS.get(k, null);
    if (!starts) {
      const rows = await getJSON(`${API}/ayat_timing?surah=${s}&read=${read}`, { keep: false });
      starts = [0]; rows.forEach(x => { if (x.ayah >= 1) starts[x.ayah] = x.start_time; });
      if ([...starts].some(v => typeof v !== "number")) return null; // a verse is missing
      LS.set(k, starts);
    }
    return starts.map(ms => ms / 1000);
  }
  // A timing fits the text only when it counts the verses as this riwayah does.
  const fits = (starts, meta, s) => !!starts && starts.length - 1 === meta.surahs[s - 1][1];
  // Seconds from the start of the surah's recording to verse a, or null when this recording has no timings that fit.
  async function ayahStart(meta, server, s, a) {
    const starts = await surahStarts(server, s);
    return fits(starts, meta, s) && typeof starts[a] === "number" ? starts[a] : null;
  }

  // ---------- reciter picker (for the reader) ----------
  async function pickReciter(meta, then, { fromAya = false } = {}) {
    const body = sheet(t("quran.pickReciterTitle", { name: rShort(meta) }), loading(t("quran.fetchingReciters")));
    try {
      const [lists, timed] = await Promise.all([Promise.all(meta.audio.map(id => getReciters(id).catch(() => []))), timedServers().catch(() => new Map())]);
      const items = [];
      lists.flat().forEach(r => r.moshaf.filter(m => meta.audio.includes(m.rewaya_id)).forEach(m => items.push({ name: r.name, moshaf: m.name, server: m.server, list: m.surah_list, total: m.surah_total })));
      const c = collator(); const seen = new Set();
      // Chosen to start at a verse: reciters whose recordings have verse timings come first.
      const uniq = items.filter(x => !seen.has(x.server) && seen.add(x.server)).sort((x, y) => (fromAya ? timed.has(y.server) - timed.has(x.server) : 0) || c.compare(x.name, y.name));
      if (!uniq.length) { body.innerHTML = `<div class="empty">${esc(t("quran.noReciters"))}</div>`; return; }
      body.innerHTML = `${fromAya ? `<p class="riwayah-note">${icon("play")} ${esc(t("listen.pickTimed"))}</p>` : ""}<div class="searchbox small">${icon("search")}<input type="search" placeholder="${esc(t("quran.searchReciter"))}" id="rc-q"></div><div class="list flat" id="rc-list"></div>`;
      const draw = f => { const q = lower(f); $("#rc-list", body).innerHTML = uniq.filter(x => !q || lower(x.name).includes(q)).map(x => `<button class="row" data-i="${uniq.indexOf(x)}"><div class="lbl" dir="auto">${esc(x.name)}<span class="sub" dir="auto">${esc(x.moshaf)}${sep()}${esc(t("count.surahs", { n: x.total }))}${timed.has(x.server) ? `<span class="timed">${icon("play")} ${esc(t("listen.timed"))}</span>` : ""}</span></div>${state.reciters[meta.id]?.server === x.server ? icon("check") : ""}</button>`).join("") || `<div class="empty">${esc(t("common.noResults"))}</div>`; };
      draw(""); $("#rc-q", body).oninput = e => draw(e.target.value.trim());
      $("#rc-list", body).onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; const x = uniq[Number(b.dataset.i)]; state.reciters[meta.id] = x; save(); closeSheet(); then?.(x); };
    } catch (err) { body.innerHTML = `<div class="empty">${esc(t("quran.recitersFailed"))}<br><small>${esc(err.message)}</small></div>`; }
  }
  const surahList = x => String(x.list || "").split(",").map(Number).filter(Boolean);
  // Plays the surah of verse a with the chosen reciter, starting at that verse when the recording has verse timings
  // (otherwise from the beginning of the surah, with a note saying so).
  function playFrom(meta, s, a, then) {
    const go = (x, fromStart = false) => {
      const at = a > 1 && !fromStart ? ayahStart(meta, x.server, s, a).then(sec => { if (sec === null) toast(t("listen.noTiming")); return sec; }, () => { toast(t("listen.timingFailed")); return null; }) : null;
      following = true;
      player.surahs({ server: x.server, list: surahList(x), start: s, sub: `${x.name}${sep()}${rShort(meta)}`, rid: meta.id, at });
      then?.(x);
    };
    const r = state.reciters[meta.id];
    if (!r) return pickReciter(meta, go, { fromAya: a > 1 });
    // The chosen recording cannot start at a verse: offer a reciter who can, or the surah from its beginning.
    if (a > 1 && timedKnown && !timedKnown.has(r.server)) {
      const body = sheet(t("listen.fromAya"), `<p class="about" dir="auto">${esc(t("listen.noTimingFor", { name: r.name }))}</p>
        <button class="btn block" id="pt-pick">${icon("headphones")} ${esc(t("listen.pickTimedBtn"))}</button>
        <button class="btn ghost block" id="pt-start">${icon("play")} ${esc(t("listen.fromStart"))}</button>`);
      $("#pt-pick", body).onclick = () => pickReciter(meta, go, { fromAya: true });
      $("#pt-start", body).onclick = () => { closeSheet(); go(r, true); };
      return;
    }
    go(r);
  }

  // ---------- following the recited verse ----------
  // While a surah plays from a recording with verse timings, the printed page or the reader on screen highlights the verse
  // being recited, and the player shows its number. Following also turns the page, or scrolls the reader, with the
  // recitation. It stops when the page is turned or the reader scrolled by hand, and comes back with the player's
  // button or by opening the place being recited.
  const startsMem = new Map(); // "<server>|<surah>" → verse start times, null (none), or a promise while they load
  function startsNow(server, s) {
    const k = server + "|" + s;
    if (!startsMem.has(k)) startsMem.set(k, surahStarts(server, s).catch(() => { setTimeout(() => startsMem.delete(k), 60000); return null; }) // no connection: again in a minute
      .then(v => { startsMem.set(k, v); onTime(player.now()); return v; }));
    const v = startsMem.get(k); return v instanceof Promise ? undefined : v;
  }
  // The verse being recited: { rid, s, a } (a is 0 before the first verse: isti'adha, basmala). null: none to follow;
  // undefined: not known yet (timings loading, or the player still silent before jumping to a verse).
  function recited(now) {
    const meta = now && INDEX?.riwayat.find(r => r.id === now.rid); if (!meta) return null;
    if (now.jumping) return undefined;
    const starts = startsNow(now.server, now.surah); if (starts === undefined) return undefined;
    if (!fits(starts, meta, now.surah)) return null;
    let a = 0; while (a < starts.length - 1 && starts[a + 1] <= now.time + 0.1) a++;
    return { rid: meta.id, s: now.surah, a };
  }
  // The place on screen registers itself as follower: { hash, scrolls, can(v), show(v, check) }. can: it follows this
  // riwayah; show: highlights v and, while following, turns or scrolls to it (check: also when v has not moved).
  let following = false, follower = null, autoHref = "";
  const plFollow = document.getElementById("pl-follow");
  function onTime(now) {
    const v = recited(now);
    if (follower && stale(follower.hash)) follower = null;
    follower?.show(v);
    if (v === undefined) return;
    player.showAya(v?.a || 0);
    const on = !!v && following && !!follower?.can(v);
    plFollow.hidden = !v; plFollow.classList.toggle("active", on); plFollow.setAttribute("aria-pressed", on);
  }
  player.listen(onTime);
  // Following stopped by the reader (turned the page, scrolled): say how to come back.
  function stopFollowing() { const v = recited(player.now()); following = false; if (v) toast(t("player.followOff")); onTime(player.now()); }
  plFollow.onclick = async () => {
    const v = recited(player.now()); if (!v) return;
    if (following && follower?.can(v)) return stopFollowing();
    following = true;
    if (follower?.can(v)) { follower.show(v, true); return onTime(player.now()); }
    // Open the verse in the kind of place being read: the printed page or verse by verse.
    const onPages = location.hash.startsWith("#/mushaf/"), inReader = location.hash.startsWith("#/quran/") && !!follower;
    const A = v.rid === "hafs" && !inReader ? await loadAyat().catch(() => null) : null;
    const pages = A && (onPages || homeMode(A) === "pages");
    autoHref = pages ? pageHref(state.mushafEd || DEFAULT_ED, A.pageOf(v.s, Math.max(1, v.a))) : `#/quran/${v.rid}/${v.s}`;
    if (onPages && pages) location.replace(autoHref); else location.hash = autoHref;
  };
  // Scrolling the reader by hand stops following (a printed page keeps following until it is turned by hand).
  function byHand(e) { if (following && follower?.scrolls && !e.target?.closest?.("#sheet, #player, #ayabar")) stopFollowing(); }
  let touchY = null;
  window.addEventListener("touchstart", e => { touchY = e.touches[0]?.clientY ?? null; }, { passive: true });
  window.addEventListener("touchmove", e => { if (touchY !== null && Math.abs(e.touches[0].clientY - touchY) > 12) { touchY = null; byHand(e); } }, { passive: true });
  window.addEventListener("wheel", byHand, { passive: true });
  window.addEventListener("keydown", e => { if (/^(Arrow(Up|Down)|Page(Up|Down)|Home|End| )$/.test(e.key) && !e.target?.closest?.("input, textarea, select, button, a, .aya")) byHand(e); });
  // Scrolls the elements into the part of the screen between the top bar and the player when they are not all there:
  // in the reader to near the top (the verses to come stay in sight), on a printed page just enough.
  function keepInView(els, { near = false, instant = false } = {}) {
    if (!els.length) return;
    const rs = els.map(x => x.getBoundingClientRect()); const top = Math.min(...rs.map(r => r.top)), bottom = Math.max(...rs.map(r => r.bottom));
    const head = document.querySelector(".topbar")?.getBoundingClientRect().bottom || 0;
    const foot = Math.min(innerHeight, ...[document.getElementById("player"), document.querySelector(".bottom-nav")].map(x => x?.getBoundingClientRect()).filter(r => r && r.height && r.top > innerHeight / 2).map(r => r.top));
    if (top >= head && bottom <= foot) return;
    const room = foot - head, gap = 12;
    const dy = near ? top - head - (bottom - top > room * 0.75 ? gap : room * 0.2)
      : top < head || bottom - top > room - 2 * gap ? top - head - gap : bottom - foot + gap;
    window.scrollBy({ top: dy, behavior: instant ? "auto" : "smooth" });
  }

  // ---------- the printed Madinah pages of Hafs: page of every verse, quarters of a hizb (mushaf/ayat.json) ----------
  let AYAT = null;
  function loadAyat() {
    AYAT ||= fetch("mushaf/ayat.json").then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(j => {
      const page = new Map(); j.pages.forEach((runs, i) => runs.forEach(([s, a]) => { if (!page.has(s * 1000 + a)) page.set(s * 1000 + a, i + 1); }));
      return { pages: j.pages, rub: j.rub, pageOf: (s, a) => page.get(s * 1000 + a) || 1 };
    }).catch(e => { AYAT = null; throw e; });
    return AYAT;
  }
  const before = (s1, a1, s2, a2) => s1 < s2 || (s1 === s2 && a1 < a2);
  const quarterOf = (A, s, a) => { let q = 0; while (q < 239 && !before(s, a, ...A.rub[q + 1])) q++; return q; };
  const hizbLabel = q => t(["quran.hizb", "quran.hizbQ1", "quran.hizbQ2", "quran.hizbQ3"][q % 4], { n: Math.floor(q / 4) + 1 });
  const qmark = q => `<span class="qmark" style="--q:${q % 4 || 4}" aria-hidden="true"></span>`;
  const juzOfMeta = (meta, s, a) => { let j = 1; meta.juz.forEach(([js, ja], i) => { if (!before(s, a, js, ja)) j = i + 1; }); return j; };
  // First words of a verse, for the list of quarters.
  const firstWords = (text, n = 5) => { const w = text.replace(AYA_NUM, "").split(" ").filter(hasLetters); return w.slice(0, n).join(" ") + (w.length > n ? " …" : ""); };

  // ---------- bookmarks ----------
  const markIndex = (r, s, a) => state.marks.findIndex(m => m.r === r && m.s === s && m.a === a);
  const isMarked = (r, s, a) => markIndex(r, s, a) >= 0;
  function toggleMark(r, s, a) {
    const i = markIndex(r, s, a);
    if (i >= 0) state.marks.splice(i, 1); else state.marks.unshift({ r, s, a, t: Date.now() });
    save(); toast(t(i < 0 ? "quran.bmSaved" : "quran.bmRemoved")); return i < 0;
  }

  // Where a place opens. mode "pages": the printed page (Hafs only, with the verse marked when flash is set);
  // mode "text": the reader, verse by verse.
  function placeHref(mode, rid, s, a, { A, flash = true } = {}) {
    if (mode === "pages" && rid === "hafs" && A) return pageHref(state.mushafEd || DEFAULT_ED, A.pageOf(s, a), flash ? `${s}:${a}` : "");
    return `#/quran/${rid}/${s}` + (a > 1 ? `?a=${a}` : "");
  }
  // Surahs chosen on the Quran page open on the printed page (Hafs) or verse by verse, as the reader chose;
  // Arabic readers start with the printed page, others with the verses and their translation.
  const homeMode = A => A && (state.view || (isAr() ? "pages" : "text")) === "pages" ? "pages" : "text";
  // The latest reading place: a printed page or a verse in a reader, whichever was opened last.
  const surahOfPage = p => { let s = 1; riw("hafs").surahs.forEach((x, i) => { if (x[2] <= p) s = i + 1; }); return s; };
  function resumeInfo() {
    const v = state.last && INDEX.riwayat.some(r => r.id === state.last.r) ? state.last : null; const p = state.lastPage;
    if (p && (!v || (p.t || 0) >= (v.t || 0))) return { kind: "page", href: pageHref(p.ed, p.p), icon: "quran", text: `${t("quran.surah", { name: surahName(surahOfPage(p.p), riw("hafs")) })}${sep()}${t("quran.page", { n: p.p })}` };
    if (v) return { kind: "aya", href: `#/quran/${v.r}/${v.s}?a=${v.a}`, icon: "book", text: t("quran.position", { surah: surahName(v.s, riw(v.r)), aya: v.a, riwayah: rShort(riw(v.r)) }) };
    return null;
  }

  // ---------- index and search, shared by the Quran page, the readers and the printed pages ----------
  const toAscii = s => String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  const latinKey = s => lower(s).normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
  // Surahs a query names: by number, Arabic name (any spelling) or transliterated name.
  function surahMatches(meta, q) {
    const k = quranKey(q), n = Number(toAscii(q).trim()), latin = latinKey(q);
    return meta.surahs.map((s, i) => i).filter(i => (n >= 1 && n <= 114 && i + 1 === n) || (k.length > 1 && quranKey(meta.surahs[i][0]).includes(k))
      || (latin.length > 1 && latinKey(meta.surahs[i][3] || "").includes(latin)));
  }
  async function verseIndex(meta) {
    const { data } = await loadRiwayah(meta.id);
    if (!searchIdx.has(meta.id)) searchIdx.set(meta.id, data.s.map((ayat, si) => ayat.map((x, ai) => quranKey(data.e ? data.e[si][ai] : x[0]))));
    return { data, idx: searchIdx.get(meta.id) };
  }
  // The words of a verse that hold the match. Hafs is searched in its plain spelling, whose words line up
  // with the Uthmani words in most verses; otherwise the Uthmani text itself is matched.
  function markHit(text, plain, k) {
    // The verse number is joined to the last word by a no-break space: keep it outside the marks.
    const full = text.normalize("NFC"); const tail = AYA_NUM.exec(full); const s = tail ? full.slice(0, tail.index) : full;
    let { hit, words } = matchedWords(s, k);
    if (!hit.size && plain) { const p = matchedWords(plain, k); if (p.words === words) hit = p.hit; }
    let html = "", w = -1, prev = false;
    s.split(" ").forEach((tok, i) => {
      const on = hasLetters(tok) && hit.has(++w);
      if (i) html += on && prev ? " " : prev ? "</mark> " : " ";
      if (on && !prev) html += "<mark>";
      html += esc(tok); prev = on;
    });
    return (prev ? html + "</mark>" : html) + (tail ? esc(tail[0]) : "");
  }
  const chev = () => icon("back", "chev");
  const surahRow = (meta, i, href, on) => { const [, count, page] = meta.surahs[i]; return `<a href="${href}" class="${on ? "on" : ""}"><div class="num">${num(i + 1)}</div><div class="lbl">${esc(surahName(i + 1, meta))}${isAr() ? "" : ` <span class="ar-name" lang="ar" dir="rtl">${esc(meta.surahs[i][0])}</span>`}<span class="sub">${esc(t("quran.surahMeta", { ayat: t("count.ayat", { n: count }), page }))}</span></div>${chev()}</a>`; };

  // Places a query names directly: "2:255", "البقرة 255", a page or a juz number; then the surahs it names.
  function refRows(q, o) {
    const { meta, mode, A } = o; const a = toAscii(q).trim(); const rows = []; const seen = new Set();
    const aya = (s, v) => { if (s < 1 || s > 114 || v < 1 || v > meta.surahs[s - 1][1] || seen.has(s + ":" + v)) return; seen.add(s + ":" + v);
      rows.push(`<a href="${placeHref(mode, meta.id, s, v, { A })}"><div class="num">${icon("book")}</div><div class="lbl">${esc(t("quran.gotoAya", { surah: surahName(s, meta), aya: v }))}${A && meta.id === "hafs" ? `<span class="sub">${esc(t("quran.page", { n: A.pageOf(s, v) }))}</span>` : ""}</div>${chev()}</a>`); };
    let m = /^(\d{1,3})\s*[:：.\/\-]\s*(\d{1,3})$/.exec(a);
    if (m) aya(+m[1], +m[2]);
    m = /^(.*[^\d\s])\s*(\d{1,3})$/.exec(a);
    if (m) surahMatches(meta, m[1].trim()).slice(0, 3).forEach(i => aya(i + 1, +m[2]));
    if (/^\d{1,3}$/.test(a)) {
      const n = +a;
      if (meta.id === "hafs" && n <= 604 && n >= 1) rows.push(`<a href="${pageHref(state.mushafEd || DEFAULT_ED, n)}"><div class="num">${icon("quran")}</div><div class="lbl">${esc(t("quran.gotoPage", { n }))}<span class="sub">${esc(t("quran.surah", { name: surahName(surahOfPage(n), meta) }))}</span></div>${chev()}</a>`);
      if (n >= 1 && n <= meta.juz.length) { const [s, v] = meta.juz[n - 1]; rows.push(`<a href="${placeHref(mode, meta.id, s, v, { A, flash: false })}"><div class="num">${icon("layers")}</div><div class="lbl">${esc(t("quran.juz", { n }))}<span class="sub">${esc(t("quran.juzStart", { surah: surahName(s, meta), aya: v }))}</span></div>${chev()}</a>`); }
    }
    const names = surahMatches(meta, m ? m[1].trim() : q);
    return (rows.length ? `<div class="list">${rows.join("")}</div>` : "")
      + (names.length ? `<h2 class="section-title">${esc(t("quran.surahs"))}</h2><div class="list">${names.map(i => surahRow(meta, i, placeHref(mode, meta.id, i + 1, 1, { A, flash: false }))).join("")}</div>` : "");
  }

  // Search results: the places the query names, then every verse that contains it, 40 at a time.
  async function drawSearch(box, q, o) {
    const mine = (box._seq = (box._seq || 0) + 1); const live = () => box._seq === mine && document.body.contains(box);
    const { meta, mode, A } = o; const k = quranKey(q);
    let html = refRows(q, o);
    // A number names a place (page, juz, verse), never words of the text.
    if (/\d/.test(toAscii(q))) { box.innerHTML = html || `<div class="empty">${esc(t("common.noResults"))}</div>`; return; }
    if (k.length < 3) { box.innerHTML = html || `<div class="empty">${esc(t("quran.typeLonger"))}</div>`; return; }
    box.innerHTML = html + loading(t("quran.searching"));
    let res; try { res = await verseIndex(meta); } catch { if (live()) box.innerHTML = html + `<div class="empty">${esc(t("quran.searchLoadFailed"))}</div>`; return; }
    if (!live()) return;
    const hits = []; res.idx.forEach((ayat, si) => ayat.forEach((x, ai) => { if (x.includes(k)) hits.push([si, ai]); }));
    html += `<h2 class="section-title">${esc(hits.length ? t("count.ayat", { n: hits.length }) : t("quran.noMatches"))}</h2>`;
    box.innerHTML = html + (hits.length ? `<div class="list hits" style="--qfont:'kfgqpc-${meta.id}'"></div><div class="more-row"></div>` : "");
    if (!hits.length) return;
    const list = $(".hits", box), more = $(".more-row", box); let shown = 0;
    const row = ([si, ai]) => { const x = res.data.s[si][ai]; return `<a href="${placeHref(mode, meta.id, si + 1, ai + 1, { A })}"><div class="lbl"><span class="hit-text" lang="ar" dir="rtl">${markHit(x[0], res.data.e?.[si][ai], k)}</span><span class="sub">${esc(t("quran.surah", { name: surahName(si + 1, meta) }))}${sep()}${esc(t("quran.ayaRef", { aya: ai + 1, page: x[1] }))}</span></div></a>`; };
    const next = () => {
      list.insertAdjacentHTML("beforeend", hits.slice(shown, shown + 40).map(row).join("")); shown = Math.min(hits.length, shown + 40);
      more.innerHTML = shown < hits.length ? `<button class="btn ghost" data-more>${esc(t("quran.showMore", { n: hits.length - shown }))}</button>` : "";
    };
    more.onclick = e => { if (e.target.closest("[data-more]")) next(); };
    next();
  }

  // Index lists. cur says where the reader is now: { surahs: Set, juz, q } (q: quarter of a hizb, Hafs).
  const TABS = { surahs: "quran.surahs", juz: "quran.juzs", hizb: "quran.hizbs", marks: "quran.marks" };
  async function indexRows(tab, o) {
    const { meta, mode, A, cur = {} } = o; const hafsPages = meta.id === "hafs" && A;
    const pageNote = (s, a) => hafsPages ? `${sep()}${t("quran.page", { n: A.pageOf(s, a) })}` : "";
    if (tab === "juz") return `<div class="list">${meta.juz.map(([s, a], j) => `<a href="${placeHref(mode, meta.id, s, a, { A, flash: false })}" class="${cur.juz === j + 1 ? "on" : ""}"><div class="num">${num(j + 1)}</div><div class="lbl">${esc(t("quran.juz", { n: j + 1 }))}<span class="sub">${esc(t("quran.juzStart", { surah: surahName(s, meta), aya: a }) + pageNote(s, a))}</span></div>${chev()}</a>`).join("")}</div>`;
    if (tab === "hizb") {
      const { data } = await loadRiwayah("hafs");
      return `<div class="list" style="--qfont:'kfgqpc-hafs'">${A.rub.map(([s, a], q) => (q % 8 ? "" : `<div class="idx-head">${esc(t("quran.juz", { n: q / 8 + 1 }))}</div>`)
        + `<a href="${placeHref(mode, "hafs", s, a, { A })}" class="${cur.q === q ? "on" : ""}"><div class="num">${qmark(q)}</div><div class="lbl">${esc(hizbLabel(q))}<span class="snip" lang="ar" dir="rtl">${esc(firstWords(data.s[s - 1][a - 1][0]))}</span><span class="sub">${esc(t("quran.surah", { name: surahName(s, meta) }) + sep() + t("quran.ayaRef", { aya: a, page: A.pageOf(s, a) }))}</span></div>${chev()}</a>`).join("")}</div>`;
    }
    if (tab === "marks") {
      if (!state.marks.length) return `<div class="empty">${icon("bookmark")}<div>${esc(t("quran.noMarks"))}</div></div>`;
      const ok = state.marks.filter(m => INDEX.riwayat.some(r => r.id === m.r));
      return `<div class="list">${ok.map(m => { const mm = riw(m.r); return `<div class="row split"><a class="row-main" href="${placeHref(mode, m.r, m.s, m.a, { A })}"><div class="num">${icon("bookmark-f")}</div><div class="lbl">${esc(t("quran.position", { surah: surahName(m.s, mm), aya: m.a, riwayah: rShort(mm) }))}${m.r === "hafs" && A ? `<span class="sub">${esc(t("quran.page", { n: A.pageOf(m.s, m.a) }))}</span>` : ""}</div></a><button class="icon-btn mark-play" data-play-mark="${esc(m.r)}:${m.s}:${m.a}" aria-label="${esc(t("quran.playMark"))}" title="${esc(t("quran.playMark"))}">${icon("play")}</button><button class="icon-btn dl-btn" data-unmark="${esc(m.r)}:${m.s}:${m.a}" aria-label="${esc(t("quran.bmRemove"))}">${icon("trash")}</button></div>`; }).join("")}</div>`;
    }
    return `<div class="list">${meta.surahs.map((_, i) => surahRow(meta, i, placeHref(mode, meta.id, i + 1, 1, { A, flash: false }), cur.surahs?.has(i + 1))).join("")}</div>`;
  }

  // Index and search in one place: with an empty box it lists surahs, juz, quarters and bookmarks;
  // typing shows the places named (surah, page, verse number) and every verse that contains the words.
  // o: { meta, mode, A, cur, query, onQuery, inSheet }
  function finder(root, o) {
    const tabs = Object.keys(TABS).filter(x => x !== "hizb" || (o.meta.id === "hafs" && o.A));
    let tab = tabs.includes(state.tab) ? state.tab : "surahs";
    root.innerHTML = `<div class="f-top"><div class="searchbox${o.inSheet ? " small" : ""}">${icon("search")}<input type="search" class="f-q" placeholder="${esc(t("quran.searchPlaceholder"))}" value="${esc(o.query || "")}" autocomplete="off" enterkeyhint="search" aria-label="${esc(t("quran.searchTitle"))}"></div>
      <p class="f-hint">${esc(t("quran.searchHint"))}</p>
      <div class="tabs-row f-tabs"><div class="segmented" role="tablist">${tabs.map(x => `<button data-tab="${x}" role="tab" class="${x === tab ? "on" : ""}" aria-selected="${x === tab}">${esc(t(TABS[x]))}</button>`).join("")}</div></div></div>
      <div class="f-list"></div>`;
    const input = $(".f-q", root), list = $(".f-list", root), tabsRow = $(".f-tabs", root), hint = $(".f-hint", root);
    const draw = async () => {
      const q = input.value.trim(); tabsRow.hidden = hint.hidden = !!q;
      if (q) return drawSearch(list, q, o);
      const mine = (list._seq = (list._seq || 0) + 1);
      if (tab === "hizb") list.innerHTML = loading();
      const html = await indexRows(tab, o).catch(() => `<div class="empty">${esc(t("common.loadFailed"))}</div>`);
      if (list._seq !== mine) return;
      list.innerHTML = html;
      if (o.inSheet) list.querySelector(".on")?.scrollIntoView({ block: "center" });
    };
    let timer;
    input.oninput = () => { o.onQuery?.(input.value); clearTimeout(timer); timer = setTimeout(draw, 200); };
    tabsRow.onclick = e => {
      const b = e.target.closest("[data-tab]"); if (!b) return;
      tab = state.tab = b.dataset.tab; save(); tabsRow.querySelectorAll("[data-tab]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); }); draw();
    };
    list.addEventListener("click", e => {
      const u = e.target.closest("[data-unmark]");
      if (u) { const [r, s, a] = u.dataset.unmark.split(":"); toggleMark(r, Number(s), Number(a)); draw(); return; }
      // Listen from a bookmark: open its place and start the recitation at that verse.
      const p = e.target.closest("[data-play-mark]");
      if (p) {
        const [r, s, a] = p.dataset.playMark.split(":"); const m = riw(r); const href = placeHref(o.mode, m.id, Number(s), Number(a), { A: o.A });
        // Go there once playback has started (after the reciter is chosen, if none was yet).
        playFrom(m, Number(s), Number(a), () => { if (href !== location.hash) location.hash = href; else closeSheet(); });
        return;
      }
      // A link to the place already shown changes nothing in the address: just close the sheet.
      const link = e.target.closest("a[href]"); if (link && o.inSheet && link.getAttribute("href") === location.hash) closeSheet();
    });
    draw();
    return input;
  }
  let sheetQuery = "";
  function openFinder(o, { search = false } = {}) {
    const body = sheet(t(search ? "quran.searchTitle" : "quran.index"), "", { tall: true });
    const input = finder(body, { ...o, inSheet: true, query: search ? sheetQuery : "", onQuery: q => { sheetQuery = q; } });
    if (search) setTimeout(() => input.focus(), 60);
  }

  // ---------- Mushaf home ----------
  let homeQuery = "";
  async function renderHome() {
    setNav("quran"); setHeader(t("quran.title"), { actions: `<button class="icon-btn" id="q-tr-pick" aria-label="${esc(t("quran.chooseTranslation"))}">${icon("translate")}</button><a class="icon-btn" href="#/offline" aria-label="${esc(t("offline.title"))}">${icon("download")}</a>` });
    const hash = location.hash; view.innerHTML = loading();
    try { await loadIndex(); } catch (e) { return failed(e, renderHome); }
    const meta = riw(state.riwayah);
    const A = meta.id === "hafs" ? await loadAyat().catch(() => null) : null;
    if (stale(hash)) return;
    $("#q-tr-pick").onclick = () => pickTranslation(renderHome);
    const mode = homeMode(A);
    const res = resumeInfo(); const lp = state.lastPage || { ed: state.mushafEd || DEFAULT_ED, p: 1 };
    view.innerHTML = `
      <div class="chips" role="tablist" aria-label="${esc(t("quran.riwayah"))}">${INDEX.riwayat.map(r => `<button class="chip ${r.id === meta.id ? "on" : ""}" data-r="${r.id}" role="tab" aria-selected="${r.id === meta.id}">${esc(rShort(r))}</button>`).join("")}</div>
      <p class="riwayah-note">${esc(t("quran.riwayahOf", { name: rName(meta) }))}${sep()}${esc(t("count.ayat", { n: meta.ayat }))} <span id="cached"></span></p>
      <div class="resume-row">
        ${res ? `<a class="resume main" href="${res.href}">${icon(res.icon)}<div><b>${esc(t("quran.continue"))}</b><span>${esc(res.text)}</span></div></a>` : ""}
        ${res?.kind !== "page" ? `<a class="resume" href="${pageHref(lp.ed, lp.p)}">${icon("quran")}<div><b>${esc(t("mushaf.pages"))}</b><span>${esc(t("mushaf.ed" + lp.ed))}${sep()}${esc(t("quran.page", { n: lp.p }))}</span></div></a>` : ""}
        <a class="resume" href="#/tafsir">${icon("tafsir")}<div><b>${esc(t("tafsir.books"))}</b><span>${esc(t("tafsir.homeHint"))}</span></div></a>
        <a class="resume" href="#/tajweed">${icon("palette")}<div><b>${esc(t("tajweed.title"))}</b><span>${esc(t("tajweed.hint"))}</span></div></a>
      </div>
      ${A ? `<div class="open-in"><span>${esc(t("quran.openIn"))}</span><div class="segmented" id="q-view"><button data-v="pages" class="${mode === "pages" ? "on" : ""}">${icon("quran")} ${esc(t("mushaf.pages"))}</button><button data-v="text" class="${mode === "text" ? "on" : ""}">${icon("list", "flip")} ${esc(t("quran.viewText"))}</button></div></div>` : ""}
      <div id="finder"></div>`;
    const showSaved = () => { const x = document.getElementById("cached"); if (x) x.innerHTML = `${sep()}${icon("check")} ${esc(t("quran.savedOffline"))}`; };
    isCached(meta).then(c => {
      if (c) return showSaved();
      const x = document.getElementById("cached"); if (!x || !off.isSupported()) return;
      x.innerHTML = ` <button class="link inline" id="save-riw">${icon("download")} ${esc(t("offline.save"))}</button>`;
      $("#save-riw").onclick = async () => { $("#save-riw").textContent = t("offline.saving"); try { await saveRiwayah(meta); showSaved(); toast(t("offline.done")); } catch { toast(t("offline.needOnce")); } };
    });
    view.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { state.riwayah = b.dataset.r; save(); renderHome(); });
    view.querySelectorAll("#q-view [data-v]").forEach(b => b.onclick = () => { state.view = b.dataset.v; save(); renderHome(); });
    finder($("#finder"), { meta, mode, A, query: homeQuery, onQuery: q => { homeQuery = q; } });
  }

  // ---------- reader ----------
  let observer = null;
  async function renderReader(rid, s, params) {
    setNav("quran"); const hash = location.hash;
    const byFollow = autoHref === hash; autoHref = ""; // opened by following the recitation
    s = Math.min(114, Math.max(1, s | 0 || 1));
    setHeader(t("quran.title"), { back: true }); view.innerHTML = loading(t("quran.loadingMushaf"));
    let meta, data;
    try { ({ meta, data } = await loadRiwayah(rid)); } catch (e) { return failed(e, () => renderReader(rid, s, params)); }
    if (stale(hash)) return;
    if (meta.id !== rid) { location.replace(`#/quran/${meta.id}/${s}`); return; }
    timedServers().catch(() => {}); // known before a verse's "listen" is tapped
    if (state.riwayah !== meta.id) { state.riwayah = meta.id; save(); }
    const ayat = data.s[s - 1]; const arName = meta.surahs[s - 1][0]; const name = surahName(s, meta);
    // The aya at the top of the screen (the saved reading place), for the index and the printed page.
    const curAya = () => (state.last && state.last.r === meta.id && state.last.s === s) ? state.last.a : 1;
    const openIdx = async (search = false) => {
      const A = meta.id === "hafs" ? await loadAyat().catch(() => null) : null; const a = curAya();
      openFinder({ meta, mode: "text", A, cur: { surahs: new Set([s]), juz: juzOfMeta(meta, s, a), q: A ? quarterOf(A, s, a) : -1 } }, { search });
    };
    setHeader(t("quran.surah", { name }), { back: true, onTitle: () => openIdx(), actions: `<button class="icon-btn" id="q-idx" aria-label="${esc(t("quran.index"))}">${icon("list", "flip")}</button><button class="icon-btn" id="q-search" aria-label="${esc(t("quran.searchTitle"))}">${icon("search")}</button><button class="icon-btn" id="q-play" aria-label="${esc(t("quran.listenSurah"))}">${icon("headphones")}</button><button class="icon-btn" id="q-tr" aria-label="${esc(t("quran.chooseTranslation"))}">${icon("translate")}</button>` });
    const showBasmala = s !== 9 && !(s === 1 && meta.basmalaIsAya);
    const rec = state.reciters[meta.id];
    let lastJuz = s > 1 ? data.s[s - 2].at(-1)[2] : ayat[0][2];
    const parts = [];
    ayat.forEach(([text, page, juz], i) => {
      if (juz !== lastJuz) { parts.push(`<div class="juz-mark"><span>${esc(t("quran.juz", { n: juz }))}</span></div>`); lastJuz = juz; }
      parts.push(`<div class="aya ${isMarked(meta.id, s, i + 1) ? "bm" : ""}" id="a-${i + 1}" data-a="${i + 1}" data-p="${page}" tabindex="0"><span class="aya-text" lang="ar" dir="rtl">${esc(text)}</span></div>`);
    });
    view.innerHTML = `
      <div class="reader-bar">
        <button class="pill" id="q-riw" aria-label="${esc(t("quran.changeRiwayah"))}">${icon("layers")} ${esc(t("quran.riwayahOf", { name: rShort(meta) }))}</button><span class="pill ghost">${esc(t("count.ayat", { n: ayat.length }))}</span>${meta.id === "hafs"
          ? `<button class="pill ghost" id="q-page" aria-label="${esc(t("mushaf.openPage"))}">${icon("quran")} ${esc(t("quran.page", { n: ayat[0][1] }))}</button>` : `<span class="pill ghost">${esc(t("quran.page", { n: ayat[0][1] }))}</span>`}
        <button class="pill ghost" id="q-theme" aria-label="${esc(t(isDark() ? "mushaf.toDayAria" : "mushaf.toNightAria"))}">${icon(isDark() ? "sun" : "moon")} ${esc(t(isDark() ? "mushaf.toDay" : "mushaf.toNight"))}</button>
        <span class="pill ghost zoom" role="group" aria-label="${esc(t("settings.fontSize"))}"><button data-qz="-1" aria-label="${esc(t("settings.smaller"))}">${icon("minus")}</button><b id="q-zoom">${esc(pct(state.qz))}</b><button data-qz="1" aria-label="${esc(t("settings.larger"))}">${icon("plus")}</button></span>
        <button class="link" id="q-rec">${icon("headphones")} <span dir="auto">${esc(rec ? rec.name : t("quran.chooseReciter"))}</span></button>
      </div>
      <div id="tr-note"></div>
      <article class="mushaf" lang="ar" dir="rtl" style="--qfont:'kfgqpc-${meta.id}'; --qz:${state.qz}">
        <header class="surah-head"><span>سورة ${esc(arName)}</span></header>
        ${showBasmala ? `<div class="basmala">${esc(meta.basmala)}</div>` : ""}
        ${parts.join("")}
      </article>
      <nav class="reader-nav">
        ${s > 1 ? `<a class="btn ghost" href="#/quran/${meta.id}/${s - 1}">${icon("back", "dir")} ${esc(surahName(s - 1, meta))}</a>` : "<span></span>"}
        ${s < 114 ? `<a class="btn ghost" href="#/quran/${meta.id}/${s + 1}">${esc(surahName(s + 1, meta))} ${icon("back", "flip")}</a>` : "<span></span>"}
      </nav>
      <p class="source-note">${esc(t("quran.sourceNote", { source: t("kfgqpc.name"), v: meta.version }))}</p>
      <p class="source-note" id="tr-source"></p>`;

    const showRec = x => { const b = $("#q-rec"); if (b) b.innerHTML = `${icon("headphones")} <span dir="auto">${esc(x.name)}</span>`; };
    const playWith = x => { following = true; player.surahs({ server: x.server, list: surahList(x), start: s, sub: `${x.name}${sep()}${rShort(meta)}`, rid: meta.id }); showRec(x); };
    const qp = $("#q-page"); if (qp) qp.onclick = () => { const a = curAya(); location.hash = pageHref(state.mushafEd || DEFAULT_ED, ayat[a - 1][1], `${s}:${a}`); };
    $("#q-idx").onclick = () => openIdx(); $("#q-search").onclick = () => openIdx(true);
    $("#q-play").onclick = () => { const r = state.reciters[meta.id]; r ? playWith(r) : pickReciter(meta, playWith); };
    $("#q-rec").onclick = () => pickReciter(meta, playWith);
    // Night or day reading, from here as from Settings.
    $("#q-theme").onclick = () => { const d = ctx.toggleTheme(); const b = $("#q-theme"); b.innerHTML = `${icon(d ? "sun" : "moon")} ${esc(t(d ? "mushaf.toDay" : "mushaf.toNight"))}`; b.setAttribute("aria-label", t(d ? "mushaf.toDayAria" : "mushaf.toNightAria")); };
    // The size of the verses: the pill, Ctrl + wheel or keys, a pinch.
    const art = $(".mushaf"); const applyQz = z => { art.style.setProperty("--qz", z); const b = $("#q-zoom"); if (b) b.textContent = pct(z); };
    const setQz = zoomGestures(art, "qz", applyQz); zoomKeys = { k: "qz", apply: applyQz };
    view.querySelectorAll("[data-qz]").forEach(b => b.onclick = () => { setQz(state.qz + 0.1 * Number(b.dataset.qz)); save(); });
    $("#q-tr").onclick = () => pickTranslation(() => renderReader(meta.id, s, params));
    $("#q-riw").onclick = () => {
      const body = sheet(t("quran.chooseRiwayah"), `<div class="list flat">${INDEX.riwayat.map(r => `<button class="row" data-r="${r.id}"><div class="lbl">${esc(rName(r))}<span class="sub">${esc(t("count.ayat", { n: r.ayat }))}</span></div>${r.id === meta.id ? icon("check") : ""}</button>`).join("")}</div>`);
      body.onclick = e => { const b = e.target.closest("[data-r]"); if (!b) return; closeSheet(); location.hash = `#/quran/${riw(b.dataset.r).id}/${s}`; };
    };

    // translation of meanings
    const trText = {}; // aya → translation (for copy/share)
    (async () => {
      const key = await currentTr(); if (!key || stale(hash)) return;
      const note = $("#tr-note");
      if (meta.ayat !== KUFI_AYAT) {
        note.innerHTML = `<div class="info">${icon("translate")}<div>${esc(t("quran.trOnlyKufi"))} <a href="#/quran/hafs/${s}">${esc(t("quran.trSwitchHafs"))}</a></div></div>`;
        return;
      }
      note.innerHTML = loading(t("quran.trLoading"));
      try {
        const [rows, m] = await Promise.all([getTrSura(key, s), trMeta(key)]);
        if (stale(hash)) return; note.innerHTML = "";
        const dir = m?.direction === "rtl" ? "rtl" : "ltr", lang = m?.language_iso_code || "";
        rows.forEach(r => {
          const el = document.getElementById("a-" + Number(r.aya)); if (!el) return;
          trText[Number(r.aya)] = r.translation;
          el.insertAdjacentHTML("beforeend", `<div class="aya-tr" dir="${dir}" lang="${esc(lang)}">${esc(r.translation)}${r.footnotes ? `<details class="fn"><summary>${esc(t("quran.footnotes"))}</summary><div dir="${dir}">${esc(r.footnotes)}</div></details>` : ""}</div>`);
        });
        if (m) $("#tr-source").textContent = t("quran.trSource", { title: m.title, v: m.version });
      } catch { if (!stale(hash)) note.innerHTML = `<div class="info">${icon("translate")}<div>${esc(t("quran.trFailed"))}</div></div>`; }
    })();

    // aya actions
    const mushaf = $(".mushaf");
    const ref = n => t("quran.copyRef", { surah: name, aya: n, riwayah: rName(meta) });
    const plain = n => `${ayat[n - 1][0].replace(AYA_NUM, "")} ﴿${num(n)}﴾` + (trText[n] ? `\n${trText[n]}` : "");
    mushaf.addEventListener("click", e => {
      if (e.target.closest("details")) return;
      const act = e.target.closest("[data-act]");
      if (act) {
        const n = Number(act.closest(".aya-tools").dataset.a);
        if (act.dataset.act === "bm") { document.getElementById("a-" + n).classList.toggle("bm", toggleMark(meta.id, s, n)); closeTools(); return; }
        if (act.dataset.act === "play") { closeTools(); playFrom(meta, s, n, showRec); return; }
        if (act.dataset.act === "copy") { copyText(`${plain(n)}\n${ref(n)}`); closeTools(); return; }
        if (act.dataset.act === "tafsir") { closeTools(); ctx.tafsir().openAyah({ s, a: n, rid: meta.id }); return; }
        // The website has a page for every surah in Hafs; other riwayat link into the app.
        if (act.dataset.act === "share") { share(t("quran.surah", { name }), `${plain(n)}\n${ref(n)}\n${meta.id === "hafs" ? `${SITE}surah/${s}/#a-${n}` : `${SITE}#/quran/${meta.id}/${s}?a=${n}`}`); closeTools(); return; }
      }
      const aya = e.target.closest(".aya"); if (!aya) return;
      if (window.getSelection && String(window.getSelection()).length) return;
      const open = aya.nextElementSibling?.classList.contains("aya-tools");
      closeTools(); if (open) return;
      aya.classList.add("sel");
      const n = Number(aya.dataset.a); const isBm = isMarked(meta.id, s, n);
      aya.insertAdjacentHTML("afterend", `<div class="aya-tools" dir="${document.documentElement.dir}" data-a="${n}"><span class="aya-ref">${esc(t("quran.ayaRef", { aya: n, page: Number(aya.dataset.p) }))}</span><span class="spacer"></span>
        <button class="icon-btn ${isBm ? "active" : ""}" data-act="bm" aria-label="${esc(t(isBm ? "quran.bmRemove" : "quran.bmAdd"))}">${icon(isBm ? "bookmark-f" : "bookmark")}</button>
        ${meta.ayat === KUFI_AYAT ? `<button class="icon-btn" data-act="tafsir" aria-label="${esc(t("tafsir.title"))}">${icon("tafsir")}</button>` : ""}
        <button class="icon-btn" data-act="play" aria-label="${esc(t("listen.fromAya"))}">${icon("headphones")}</button>
        <button class="icon-btn" data-act="copy" aria-label="${esc(t("common.copy"))}">${icon("copy")}</button>
        <button class="icon-btn" data-act="share" aria-label="${esc(t("common.share"))}">${icon("share")}</button></div>`);
    });
    mushaf.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("aya")) { e.preventDefault(); e.target.click(); } });
    function closeTools() { mushaf.querySelectorAll(".aya-tools").forEach(x => x.remove()); mushaf.querySelectorAll(".aya.sel").forEach(x => x.classList.remove("sel")); }

    // The verse being recited is highlighted (the basmala before the first verse); while following, it is kept in sight
    // and the next surah opens when the recitation reaches it. Opening the surah being recited follows it, unless
    // another of its verses was asked for; scrolling by hand stops following.
    const asked = Number(params.get("a")) || 0;
    let lit = null, decide = !byFollow, first = true;
    follower = {
      hash, scrolls: true, can: v => v.rid === meta.id,
      show(v, check = false) {
        if (decide && v !== undefined) { decide = false; if (v?.rid === meta.id && v.s === s && (asked <= 1 || asked === v.a)) following = true; else if (following) stopFollowing(); }
        const here = v?.rid === meta.id && v.s === s;
        const el = !here ? null : v.a ? document.getElementById("a-" + v.a) : mushaf.querySelector(".basmala");
        const moved = el !== lit;
        if (moved) { lit?.classList.remove("play"); el?.classList.add("play"); lit = el; }
        if (!following || v?.rid !== meta.id || document.getElementById("sheet")) return;
        if (v.s !== s) { // the recitation went on to another surah: open it, unless a verse's tools are open
          if (!mushaf.querySelector(".aya-tools")) { autoHref = `#/quran/${meta.id}/${v.s}`; location.replace(autoHref); }
          return;
        }
        if ((moved || check) && el) { keepInView([el], { near: true, instant: first }); first = false; }
      },
    };
    onTime(player.now());

    // remember reading position
    observer?.disconnect();
    let saveTimer;
    observer = new IntersectionObserver(entries => {
      const vis = entries.filter(x => x.isIntersecting).map(x => Number(x.target.dataset.a));
      if (!vis.length) return; clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { if (stale(hash)) return; state.last = { r: meta.id, s, a: Math.min(...vis), t: Date.now() }; save(); }, 600);
    }, { rootMargin: "-80px 0px -60% 0px" });
    mushaf.querySelectorAll(".aya").forEach(x => observer.observe(x));

    const want = Number(params.get("a"));
    if (want > 1 && want <= ayat.length) {
      const el = document.getElementById("a-" + want);
      requestAnimationFrame(() => { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1800); });
    }
  }

  // ---------- printed pages: the Madinah Mushaf, page-exact (Hafs) ----------
  // Each word is a King Fahd Complex glyph drawn by the font of its page, so lines break exactly as in print.
  // The colour-coded Tajweed print (KFGQPC / Dar Al-Maarifah, QCF V4) draws the same glyph codes as the 1421 print.
  const EDITIONS = { 1405: { v: "v1", key: "w1" }, 1421: { v: "v2", key: "w2" }, tajweed: { v: "v4", key: "w2" } };
  let PAGES = null, pageFirst = null, FONTS = {}, JALALA = null, tajweedFonts = null;
  const fetchJSON = async u => { const r = await fetch(u); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
  async function loadPages() {
    if (!PAGES) {
      // tajweed.json (fonts of the Tajweed print) and jalala.json (where the name of Allah is written) are optional.
      const [p, tj, jl] = await Promise.all([fetchJSON("mushaf/madinah.json"), fetchJSON("mushaf/tajweed.json").catch(() => null), fetchJSON("mushaf/jalala.json").catch(() => null)]);
      PAGES = p; FONTS = { ...p.fonts, ...(tj?.fonts || {}) }; JALALA = jl;
      pageFirst = Array(605).fill(null); // first verse that starts on each page
      Object.entries(PAGES.verseStart).forEach(([k, p]) => { const [s, a] = k.split(":").map(Number); const cur = pageFirst[p]; if (!cur || s < cur[0] || (s === cur[0] && a < cur[1])) pageFirst[p] = [s, a]; });
      for (let p = 1; p <= 604; p++) if (!pageFirst[p]) pageFirst[p] = pageFirst[p - 1]; // page that only continues a long verse
    }
    return PAGES;
  }
  // Prints whose fonts are known (the Tajweed one needs tajweed.json).
  const editions = () => Object.keys(EDITIONS).filter(e => FONTS[EDITIONS[e].v]);
  const pageFontUrl = (ed, n) => FONTS[EDITIONS[ed].v].url.replace("{n}", n);
  const pageFontUrls = ed => Array.from({ length: 604 }, (_, i) => pageFontUrl(ed, i + 1));
  const pageFonts = new Map(), pageFontReady = new Set(); // family → its loading; the families drawn already
  function loadPageFont(ed, n) {
    const fam = `qcf-${ed}-${n}`;
    if (!pageFonts.has(fam)) {
      // The backup copy is the second source: the browser falls back to it only if the first fails to load.
      const src = [pageFontUrl(ed, n), mirrorOf(pageFontUrl(ed, n))].filter(Boolean).map(u => `url(${u}) format("woff2")`).join(", ");
      const ff = new FontFace(fam, src, { display: "block" });
      pageFonts.set(fam, ff.load().then(f => { document.fonts.add(f); pageFontReady.add(fam); return fam; }).catch(e => { pageFonts.delete(fam); throw e; }));
    }
    return pageFonts.get(fam);
  }
  // The pages about to be read are fetched ahead of the reader (the service worker keeps every page font, so a page
  // read once opens at once ever after): the next five and the previous two, two at a time so that they never slow
  // the open page down. Not while the whole print is being saved: that job fetches them in the same order (keepPages).
  let warmSeq = 0;
  function warmPages(ed, n) {
    const seq = ++warmSeq;
    if (off.currentJob()?.id === keepJobId(ed)) return;
    const q = [n + 1, n + 2, n - 1, n + 3, n + 4, n + 5, n - 2].filter(p => p >= 1 && p <= 604);
    const next = () => { if (seq !== warmSeq || !q.length) return; loadPageFont(ed, q.shift()).catch(() => {}).finally(next); };
    next(); next();
  }

  // ---------- the whole print on the device ----------
  // A print whose 604 page fonts are all saved opens without the internet. The reader is offered that on the page
  // (once; again a week after "later") and from the print sheet. A print they chose to keep goes on being saved in
  // the background whenever its pages are open and the device is online, from the page being read onwards, until
  // every page is there; the Offline content page shows the same saving and can delete it.
  const keepJobId = ed => "off:pages" + ed;
  const pagesSaved = {}; // print → how many of its page fonts are on the device (counted when first needed)
  async function countSaved(ed) { pagesSaved[ed] = off.isSupported() ? (await off.savedSet(off.STORES.PAGES, pageFontUrls(ed))).size : 0; return pagesSaved[ed]; }
  const keepTried = {}; // print → when the background saving last ran (a device offline is tried again after 10 minutes)
  async function keepPages(ed, n, byUser = false) {
    if (!off.isSupported()) return;
    if (!byUser && (!state.keepPages?.[ed] || !navigator.onLine || off.currentJob() || Date.now() - (keepTried[ed] || 0) < 600000)) return;
    if (pagesSaved[ed] === undefined) await countSaved(ed);
    if (pagesSaved[ed] >= 604) return;
    keepTried[ed] = Date.now();
    const urls = pageFontUrls(ed); // from the page being read to the end, then from the first page
    const r = await off.download({ id: keepJobId(ed), urls: [...urls.slice(n - 1), ...urls.slice(0, n - 1)], store: off.STORES.PAGES, concurrency: 4 });
    if (r.busy) { if (byUser) toast(t("offline.busy")); return; }
    await countSaved(ed);
    if (pagesSaved[ed] >= 604) toast(t("mushaf.keepDone"));
    else if (byUser || r.noSpace) reportJob(r);
  }
  function pageInfo(n, A) {
    const [s, a] = pageFirst[n];
    const surahs = new Set([s]); PAGES.pages[n - 1].forEach(x => { if (x.h) surahs.add(x.h); });
    return { first: [s, a], surahs, juz: juzOfMeta(riw("hafs"), s, a), q: A ? quarterOf(A, s, a) : -1 };
  }
  const pageHref = (ed, n, v = "") => `#/mushaf/${ed}/${n}` + (v ? `?v=${v}` : "");
  // Turning a page: the page being left stays on screen until the next one's font is there (after a moment a thin bar
  // shows the wait), so a turn never shows an empty page; a font that has not come within 4 s turns the page anyway,
  // and the page says it needs the internet. Turns that follow each other quickly (swipes, arrow keys) add up: each
  // counts from the page being turned to (turnBy).
  let turnSeq = 0, turnTo = null; // the turn under way: { ed, n }
  async function goPage(ed, n) {
    if (!(n >= 1 && n <= 604)) return;
    const seq = ++turnSeq, from = location.hash; turnTo = { ed, n };
    if (!pageFontReady.has(`qcf-${ed}-${n}`)) {
      const mm = document.getElementById("mm"); const timer = setTimeout(() => mm?.classList.add("turning"), 120);
      await Promise.race([loadPageFont(ed, n).catch(() => {}), new Promise(r => setTimeout(r, 4000))]);
      clearTimeout(timer);
      if (seq !== turnSeq || location.hash !== from) return; // a later turn, or the reader left
      mm?.classList.remove("turning");
    }
    turnTo = null; location.replace(pageHref(ed, n));
  }
  const turnBy = (ed, n, d) => goPage(ed, (turnTo?.ed === ed ? turnTo.n : n) + d);
  window.addEventListener("hashchange", () => { turnTo = null; });

  // The Tajweed fonts (COLRv1) colour the letters themselves, so CSS colour has no effect on them. They carry three
  // palettes (0 light, 1 dark, 2 sepia); entry 0 of each is the colour of the letters, which the name of Allah overrides.
  const isDark = () => { const th = document.documentElement.dataset.theme; return th === "dark" || (th !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); };
  let palFam = null;
  function tajweedPalette(fam = palFam) {
    if (!fam) return; palFam = fam;
    let st = document.getElementById("tj-palette"); if (!st) { st = document.createElement("style"); st.id = "tj-palette"; document.head.appendChild(st); }
    const base = isDark() ? 1 : 0, red = getComputedStyle(document.documentElement).getPropertyValue("--jalala").trim() || "#c62828";
    st.textContent = `@font-palette-values --tj { font-family: '${fam}'; base-palette: ${base}; }
@font-palette-values --tj-jl { font-family: '${fam}'; base-palette: ${base}; override-colors: 0 ${red}; }
.mpage .mline { font-palette: --tj; } .mpage .mline span.jl { font-palette: --tj-jl; }`;
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => tajweedPalette());

  // The bars of the printed pages: the app top bar and the tools below the page (body.mm-ui, see renderPages).
  let mmVisit = false, uiTimer = null;
  function setUi(on) { clearTimeout(uiTimer); document.body.classList.toggle("mm-ui", on); }
  function holdUi() { clearTimeout(uiTimer); } // while a bar is being used (a slider dragged)
  function keepUi() { clearTimeout(uiTimer); uiTimer = setTimeout(() => setUi(false), 3500); } // the bars leave by themselves after the last use
  window.addEventListener("hashchange", () => { if (!location.hash.startsWith("#/mushaf/")) { mmVisit = false; setUi(false); } });

  let pageClick = null;
  async function renderPages(ed, n, params = new URLSearchParams()) {
    setNav("quran"); const hash = location.hash;
    const byFollow = autoHref === hash; autoHref = ""; // turned to by following the recitation
    n = Math.min(604, Math.max(1, n | 0 || 1));
    setHeader(t("mushaf.pages"), { back: true });
    if (!PAGES || !INDEX) view.innerHTML = loading(); // once loaded, the page being left stays until the next one is drawn
    // The verse map (ayat.json) is optional: without it the page still shows, only verses cannot be selected.
    let A = null;
    try { [, , A] = await Promise.all([loadIndex(), loadPages(), loadAyat().catch(() => null)]); loadFont(riw("hafs")); } catch (e) { return failed(e, () => renderPages(ed, n, params)); }
    if (stale(hash)) return;
    // An unknown print (or the Tajweed one when its fonts list could not load) opens the last print used.
    if (!editions().includes(String(ed))) { const e2 = [state.mushafEd, DEFAULT_ED].find(x => editions().includes(String(x))) || "1421"; location.replace(pageHref(e2, n, params.get("v") || "")); return; }
    state.mushafEd = ed; state.lastPage = { ed, p: n, t: Date.now() }; save();
    timedServers().catch(() => {}); // known before a verse's "listen" is tapped
    const info = pageInfo(n, A); const key = EDITIONS[ed].key; const hafs = riw("hafs");
    const runs = A ? A.pages[n - 1] : []; // verses on this page in reading order: [surah, aya, glyphs]
    const marksHere = () => state.marks.filter(m => m.r === "hafs" && PAGES.verseStart[m.s + ":" + m.a] === n);
    const bmBtn = () => { const on = marksHere().length > 0; return `<button class="icon-btn${on ? " active" : ""}" id="m-bm" aria-label="${esc(t(on ? "mushaf.bmPageRemove" : "mushaf.bmPage"))}">${icon(on ? "bookmark-f" : "bookmark")}</button>`; };
    const finderOpts = { meta: hafs, mode: "pages", A, cur: info };
    setHeader([...info.surahs].sort((x, y) => x - y).map(s => surahName(s, hafs)).join(sep()), { back: true, onTitle: () => openFinder(finderOpts),
      actions: `<button class="icon-btn" id="m-idx" aria-label="${esc(t("quran.index"))}">${icon("list", "flip")}</button><button class="icon-btn" id="m-search" aria-label="${esc(t("quran.searchTitle"))}">${icon("search")}</button><span id="m-bm-wrap">${bmBtn()}</span>` });
    // Every glyph carries the index of its verse in runs, so a tap selects the whole verse.
    let vi = 0, left = runs[0]?.[2] ?? Infinity, gi = 0;
    // The name of Allah in colour, when chosen: jalala.json lists its glyphs on each page.
    const jl = state.jalala && JALALA ? new Set(JALALA.pages[n - 1]) : null;
    const glyph = g => {
      const v = vi; if (--left === 0) { vi++; left = runs[vi]?.[2] ?? Infinity; }
      const cls = jl?.has(gi++) ? ` class="jl"` : "";
      return A ? `<span data-v="${v}"${cls}>${g}</span>` : `<span${cls}>${g}</span>`;
    };
    const lines = PAGES.pages[n - 1].map(x =>
      x.h ? `<div class="mline mhead"><span>سورة ${esc(hafs.surahs[x.h - 1][0])}</span></div>`
      : x.b ? `<div class="mline mbasm" data-s="${runs[vi]?.[0] || ""}">${esc(hafs.basmala)}</div>` // the surah of the verse that follows
      : `<div class="mline${n <= 2 ? " center" : ""}">${x[key].split(" ").map(glyph).join("")}</div>`).join("");
    // Full-screen page: the surah and the juz in the top margin and the page number below, as in print. One tap shows or
    // hides the bars (the app's top bar and the tools below); a long press on a verse opens that verse's tools.
    const surahTitle = [...info.surahs].sort((x, y) => x - y).map(s => surahName(s, hafs)).join(sep());
    const where = () => [t("mushaf.pageOf", { n, total: 604 }), t("quran.juz", { n: info.juz }), info.q >= 0 ? hizbLabel(info.q) : ""].filter(Boolean).join(sep());
    const recName = () => state.reciters.hafs?.name || t("quran.chooseReciter");
    const themeBtn = () => { const d = isDark(); return `${icon(d ? "sun" : "moon")}<span>${esc(t(d ? "mushaf.toDay" : "mushaf.toNight"))}</span>`; };
    const themeAria = () => t(isDark() ? "mushaf.toDayAria" : "mushaf.toNightAria");
    view.innerHTML = `
      <div class="mm" id="mm">
        <div class="mm-margin" aria-hidden="true"><span>${esc(t("quran.surah", { name: surahTitle }))}</span><span>${esc(t("quran.juz", { n: info.juz }))}</span></div>
        <div class="mpage-wrap"><div class="mpage${n <= 2 ? " opening" : ""}${A ? " tappable" : ""}" id="mpage" lang="ar" dir="rtl" style="--qfont:'kfgqpc-hafs'">${lines}<div class="mpage-msg" id="mpage-msg">${loading("")}</div></div></div>
        <div class="mm-margin foot"><span>${esc(num(n))}</span><span id="m-save" hidden></span></div>
      </div>
      <div class="mbar" id="mbar">
        <div class="mm-keep" id="m-keep" hidden><div>${icon("download")}<span>${esc(t("mushaf.keepAsk", { size: off.fmtSize(FONTS[EDITIONS[ed].v].bytes, getLang()) }))}</span></div><div class="mm-keep-btns"><button class="btn small" id="m-keep-save">${esc(t("mushaf.keepSave"))}</button><button class="btn ghost small" id="m-keep-later">${esc(t("install.later"))}</button></div></div>
        <div class="mslider">
          <button class="icon-btn" id="m-prev" aria-label="${esc(t("mushaf.prev"))}"${n <= 1 ? " disabled" : ""}>${icon("back", "dir")}</button>
          <input type="range" id="m-range" min="1" max="604" step="1" value="${n}" aria-label="${esc(t("mushaf.slider"))}">
          <button class="icon-btn" id="m-next" aria-label="${esc(t("mushaf.next"))}"${n >= 604 ? " disabled" : ""}>${icon("back", "flip")}</button>
        </div>
        <output class="mm-where" id="m-range-out" for="m-range">${esc(where())}</output>
        <div class="mtools${ed === "tajweed" ? " six" : ""}">
          <button data-tool="listen" id="m-listen">${icon("play")}<span>${esc(t("common.listen"))}</span></button>
          <button data-tool="reciter" aria-label="${esc(t("quran.chooseReciter"))}">${icon("headphones")}<span id="m-rec" dir="auto">${esc(recName())}</span></button>
          <button data-tool="theme" id="m-theme" aria-label="${esc(themeAria())}">${themeBtn()}</button>
          ${ed === "tajweed" ? `<button data-tool="colours" aria-label="${esc(t("tajweed.keyAria"))}">${icon("palette")}<span>${esc(t("tajweed.colours"))}</span></button>` : ""}
          <button data-tool="zoom" aria-label="${esc(t("settings.fontSize"))}">${icon("zoom")}<span>${esc(t("mushaf.zoom"))}</span></button>
          <button data-tool="print" aria-label="${esc(t("mushaf.chooseEdition"))}">${icon("layers")}<span>${esc(t("mushaf.print"))}</span></button>
        </div>
      </div>`;
    $("#m-prev").onclick = () => turnBy(ed, n, -1); $("#m-next").onclick = () => turnBy(ed, n, 1);
    const page = $("#mpage"), mm = $("#mm"); mm.style.setProperty("--mz", state.mz);
    // At 100% the page is as large as the screen allows without scrolling: its width is measured from the page's own
    // height-to-width ratio (fixed by its lines) and the room the box leaves after the margins above and below it.
    // Measured again when the window or the player changes.
    const fitPage = () => {
      mm.style.setProperty("--lh", 1);
      const cs = getComputedStyle(mm); const box = parseFloat(cs.minHeight) || innerHeight;
      const others = [...mm.children].filter(x => x !== page.parentElement).reduce((h, x) => h + x.offsetHeight, 0);
      const room = box - others - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.rowGap) * (mm.children.length - 1);
      // The ratio drifts by a few pixels with the width (borders, rounded line heights): measure again at the new size.
      let w = 0;
      for (let i = 0; i < 3; i++) {
        const r = page.offsetHeight / page.offsetWidth; if (!(r > 0) || !(room > 0)) return;
        w = Math.max(240, Math.min(mm.clientWidth, Math.floor(room / r))); mm.style.setProperty("--mfit", w + "px");
        if (page.offsetHeight / state.mz <= room + 0.5) break;
      }
      // On a tall screen (a phone held upright) the page is as wide as the screen and shorter than it: its lines spread
      // out so that it covers the screen, up to 1.7 times their printed spacing (the 2px border does not scale).
      const h = page.offsetHeight / state.mz, spare = room - h;
      if (w >= mm.clientWidth && spare > 2) mm.style.setProperty("--lh", Math.min(1.7, 1 + spare / (h - 2)).toFixed(3));
    };
    fitPage();
    const onResize = () => { if (stale(hash) || !document.body.contains(mm)) return removeEventListener("resize", onResize); fitPage(); };
    addEventListener("resize", onResize);
    const paintMarks = () => { const on = new Set(marksHere().map(m => m.s + ":" + m.a)); runs.forEach(([s, a], i) => page.querySelectorAll(`span[data-v="${i}"]`).forEach(x => x.classList.toggle("bm", on.has(s + ":" + a)))); };
    const refreshBm = () => { $("#m-bm-wrap").innerHTML = bmBtn(); $("#m-bm").onclick = toggleBm; paintMarks(); };
    // The page bookmark is a bookmark on its first verse; removing it removes every bookmark on the page.
    function toggleBm() {
      const here = marksHere();
      if (here.length) { here.forEach(m => state.marks.splice(state.marks.indexOf(m), 1)); save(); toast(t("quran.bmRemoved")); }
      else toggleMark("hafs", ...info.first);
      refreshBm();
    }
    $("#m-bm").onclick = toggleBm;
    $("#m-idx").onclick = () => openFinder(finderOpts);
    $("#m-search").onclick = () => openFinder(finderOpts, { search: true });
    paintMarks();

    // The verse being recited is highlighted (the basmala before the first verse); while following, the page turns with it.
    // Opening the page being recited follows it; turning to another page by hand stops following.
    const verseEls = v => { if (!v) return []; const i = v.a ? runs.findIndex(([s, a]) => s === v.s && a === v.a) : -1; return i >= 0 ? [...page.querySelectorAll(`span[data-v="${i}"]`)] : v.a ? [] : [...page.querySelectorAll(`.mbasm[data-s="${v.s}"]`)]; };
    const onPage = v => runs.some(([s, a]) => s === v.s && a === Math.max(1, v.a));
    let lit = [], decide = !byFollow;
    follower = A && {
      hash, scrolls: false, can: v => v.rid === "hafs",
      show(v, check = false) {
        if (decide && v !== undefined) { decide = false; if (v?.rid === "hafs" && onPage(v)) following = true; else if (following) stopFollowing(); }
        const els = v?.rid === "hafs" ? verseEls(v) : [];
        const moved = els.length !== lit.length || els.some((x, i) => x !== lit[i]);
        if (moved) { lit.forEach(x => x.classList.remove("play")); els.forEach(x => x.classList.add("play")); lit = els; }
        if (!following || v?.rid !== "hafs" || document.getElementById("sheet")) return;
        if (!onPage(v)) { // the recitation went on to another page: turn to it, unless a verse's tools are open
          const p = A.pageOf(v.s, Math.max(1, v.a));
          if (p !== n && !document.getElementById("ayabar")) { autoHref = pageHref(ed, p); location.replace(autoHref); }
          return;
        }
        if ((moved || check) && page.classList.contains("ready")) keepInView(els);
      },
    };
    onTime(player.now());
    try {
      const fam = await loadPageFont(ed, n); if (stale(hash)) return;
      page.style.setProperty("--qcf", `'${fam}'`); if (ed === "tajweed") tajweedPalette(fam); page.classList.add("ready"); $("#mpage-msg").remove();
      // The two prints draw glyphs at different sizes: scale the page so its widest line fills the width, as in print.
      if (n > 2) {
        const ls = [...page.querySelectorAll(".mline:not(.mhead):not(.mbasm)")];
        const widest = Math.max(...ls.map(l => [...l.children].reduce((w, sp) => w + sp.getBoundingClientRect().width, 0)));
        if (widest > 0) page.style.setProperty("--fit", Math.min(1.35, Math.max(0.8, 0.97 * ls[0].clientWidth / widest)).toFixed(3));
      }
      if (follower?.hash === hash) follower.show(recited(player.now()), true); // now that the page has its size
      // Opened from a search result, a bookmark or a quarter: show which verse it was.
      const want = /^(\d+):(\d+)$/.exec(params.get("v") || "");
      const wi = want ? runs.findIndex(([s, a]) => s === +want[1] && a === +want[2]) : -1;
      if (wi >= 0) {
        const els = [...page.querySelectorAll(`span[data-v="${wi}"]`)];
        els.forEach(x => x.classList.add("flash")); els[0]?.scrollIntoView({ block: "center" });
        setTimeout(() => els.forEach(x => x.classList.remove("flash")), 2200);
      }
      if (A && !state.hintMm) { state.hintMm = true; save(); setTimeout(() => { if (!stale(hash)) toast(t("mushaf.hint")); }, 900); }
    } catch { if (!stale(hash)) $("#mpage-msg").innerHTML = `<div class="empty">${icon("download")}<div>${esc(t("mushaf.fontNeedsNet"))}</div></div>`; }
    warmPages(ed, n);

    // The whole print on the device: the offer at the top of the tools bar (until "later" is tapped; the bars are
    // shown when the Mushaf is opened and on every tap on the page) and, while the print is being saved, the count
    // beside the page number below the page.
    const keepBox = $("#m-keep"), keepOut = $("#m-save");
    const showKeep = () => {
      if (stale(hash) || !document.body.contains(keepBox)) return;
      const j = off.currentJob(); const run = j?.id === keepJobId(ed);
      keepOut.hidden = !run; if (run) keepOut.textContent = t("mushaf.keepSaving", { done: j.done, total: j.total });
      keepBox.hidden = run || !off.isSupported() || !navigator.onLine || !!state.keepPages?.[ed] || !(pagesSaved[ed] < 604) || Date.now() - (state.keepAsked?.[ed] || 0) < 7 * 86400000;
    };
    const onKeep = e => { if (stale(hash) || !document.body.contains(keepBox)) return removeEventListener("offline-progress", onKeep); if (e.detail) showKeep(); else countSaved(ed).then(showKeep); };
    addEventListener("offline-progress", onKeep);
    (pagesSaved[ed] === undefined ? countSaved(ed) : Promise.resolve()).then(showKeep);
    keepBox.onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.id === "m-keep-later") { (state.keepAsked ||= {})[ed] = Date.now(); save(); showKeep(); return; }
      (state.keepPages ||= {})[ed] = true; save(); keepPages(ed, n, true); showKeep();
    };
    keepPages(ed, n); // goes on saving a print the reader chose to keep

    // Arabic book: the next page is on the left, so swiping toward the right turns forward. A page enlarged past the
    // screen is panned by that gesture instead; it is turned from the bar or with the arrow keys.
    let x0 = null; const wrap = page.parentElement;
    page.addEventListener("touchstart", e => { x0 = e.touches.length === 1 && wrap.scrollWidth <= wrap.clientWidth + 1 ? e.touches[0].clientX : null; }, { passive: true });
    page.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) { setUi(false); turnBy(ed, n, dx > 0 ? 1 : -1); } });

    // Page slider: shows the page and its surah while dragging, opens the page on release.
    const range = $("#m-range"), out = $("#m-range-out");
    range.oninput = () => { const p = Number(range.value); out.textContent = `${t("mushaf.pageOf", { n: p, total: 604 })}${sep()}${surahName(pageFirst[p][0], hafs)}`; };
    range.onchange = () => { const p = Number(range.value); if (p !== n) goPage(ed, p); };

    // The tools below the page: listen from this page (or pause), the reciter, night or day reading, the print.
    const listenBtn = $("#m-listen");
    const showListen = now => { const on = !!now && !now.paused; listenBtn.innerHTML = `${icon(on ? "pause" : "play")}<span>${esc(t(on ? "common.pause" : "common.listen"))}</span>`; };
    const unlisten = player.listen(now => { if (stale(hash) || !document.body.contains(listenBtn)) return unlisten(); showListen(now); fitPage(); }); // the player takes room from the page
    showListen(player.now());
    $("#mbar .mtools").onclick = e => {
      const tool = e.target.closest("[data-tool]")?.dataset.tool; if (!tool) return;
      keepUi();
      if (tool === "print") return openPrint();
      if (tool === "zoom") return openZoom();
      if (tool === "colours") return ctx.tajweed().keySheet();
      if (tool === "theme") { ctx.toggleTheme(); if (ed === "tajweed") tajweedPalette(); const b = $("#m-theme"); b.innerHTML = themeBtn(); b.setAttribute("aria-label", themeAria()); return; }
      const now = player.now(), v = recited(now);
      if (tool === "reciter") return pickReciter(hafs, x => {
        $("#m-rec").textContent = x.name;
        if (now && !now.paused && v?.rid === "hafs") playFrom(hafs, v.s, Math.max(1, v.a)); // go on with the new voice from the same verse
      }, { fromAya: true });
      if (tool === "listen") {
        if (now && !now.paused) return player.pause();
        if (now && v?.rid === "hafs" && onPage(v)) return document.getElementById("pl-toggle").click(); // resume this page
        playFrom(hafs, ...info.first);
      }
    };

    // The size of the page: a slider (1 = the page fits the screen), Ctrl + wheel or keys, a pinch with two fingers.
    const applyMz = z => mm.style.setProperty("--mz", z);
    let sel = -1, pressT = null, pressAt = null, pressedAt = 0, held = false;
    const setMz = zoomGestures(mm, "mz", applyMz, () => { x0 = null; clearTimeout(pressT); pressAt = null; }); // a pinch is neither a swipe nor a long press
    zoomKeys = { k: "mz", apply: applyMz };
    const openZoom = () => {
      const body = sheet(t("settings.fontSize"), `<div class="zoom-row"><button class="icon-btn" data-z="-1" aria-label="${esc(t("settings.smaller"))}">${icon("minus")}</button><input type="range" id="z-range" min="${ZOOM.mz[0]}" max="${ZOOM.mz[1]}" step="0.05" value="${state.mz}" aria-label="${esc(t("settings.fontSize"))}"><button class="icon-btn" data-z="1" aria-label="${esc(t("settings.larger"))}">${icon("plus")}</button><output id="z-out" for="z-range">${esc(pct(state.mz))}</output></div>
        <div class="zoom-foot"><button class="btn ghost small" id="z-reset">${icon("reset")} ${esc(t("mushaf.zoomReset"))}</button></div>
        <p class="zoom-hint">${esc(t("mushaf.zoomHint"))}</p>`);
      const range = $("#z-range", body), out = $("#z-out", body);
      const set = v => { setMz(v); range.value = state.mz; out.textContent = pct(state.mz); save(); };
      range.oninput = () => set(Number(range.value));
      body.onclick = e => { const b = e.target.closest("[data-z]"); if (b) set(state.mz + 0.1 * Number(b.dataset.z)); else if (e.target.closest("#z-reset")) set(1); };
    };

    // Print and colours: the three prints, and the name of Allah in colour.
    const openPrint = () => {
      const size = e2 => t("offline.size", { size: off.fmtSize(FONTS[EDITIONS[e2].v].bytes, getLang()) });
      // This print on the device: how much of it is saved, and the saving, or stopping it.
      const keepRow = () => {
        if (!off.isSupported()) return "";
        const j = off.currentJob(); const run = j?.id === keepJobId(ed); const done = pagesSaved[ed] ?? 0;
        const sub = run ? t("mushaf.keepSaving", { done: j.done, total: j.total }) : done >= 604 ? t("mushaf.keepDone") : `${t("offline.progress", { done, total: 604 })}${sep()}${size(ed)}`;
        const act = run ? `<button class="btn ghost small" id="m-keep-cancel">${esc(t("offline.cancel"))}</button>` : done >= 604 ? icon("check") : `<button class="btn small" id="m-keep-go">${esc(t("offline.save"))}</button>`;
        return `<div class="list flat"><div class="row"><div class="num">${icon("download")}</div><div class="lbl">${esc(t("mushaf.keepTitle"))}<span class="sub">${esc(sub)}</span></div>${act}</div></div>`;
      };
      const body = sheet(t("mushaf.display"), `<div class="list flat">${editions().map(e2 => `<button class="row" data-ed="${e2}"><div class="lbl">${esc(t("mushaf.ed" + e2))}${e2 === "tajweed" ? `<span class="sub">${esc(t("mushaf.tajweedNote"))}</span>` : ""}<span class="sub">${esc(size(e2))}</span></div>${e2 === ed ? icon("check") : ""}</button>`).join("")}
        ${editions().includes("tajweed") ? `<a class="row" href="#/tajweed"><div class="num">${icon("palette")}</div><div class="lbl">${esc(t("tajweed.title"))}<span class="sub">${esc(t("tajweed.hint"))}</span></div>${icon("back", "chev")}</a>` : ""}</div>
        ${JALALA ? `<div class="list flat"><div class="row"><div class="lbl">${esc(t("mushaf.jalala"))}<span class="sub">${esc(t("mushaf.jalalaNote", { n: JALALA.count }))}</span></div><button class="switch ${state.jalala ? "on" : ""}" id="m-jl" role="switch" aria-checked="${!!state.jalala}" aria-label="${esc(t("mushaf.jalala"))}"></button></div></div>` : ""}
        ${keepRow()}
        <p class="source-note">${esc(t("mushaf.source"))}</p>`);
      body.onclick = e => {
        if (e.target.closest("#m-jl")) { state.jalala = !state.jalala; save(); closeSheet(); renderPages(ed, n, params); return; }
        if (e.target.closest("#m-keep-go")) { (state.keepPages ||= {})[ed] = true; save(); closeSheet(); keepPages(ed, n, true); showKeep(); return; }
        if (e.target.closest("#m-keep-cancel")) { delete state.keepPages?.[ed]; save(); off.cancel(); closeSheet(); return; }
        const b = e.target.closest("[data-ed]"); if (!b) return; closeSheet(); goPage(b.dataset.ed, n);
      };
    };

    // The bars: shown when the Mushaf is opened from elsewhere, shown or hidden by a tap on the page, hidden when a page
    // is turned by swiping, and gone by themselves a few seconds after they were last used, so the page has the whole
    // screen. A long press (or a right click) on a verse opens its tools (tafsir, bookmark, copy, share, listen, verse by verse).
    if (!mmVisit) { mmVisit = true; setUi(true); keepUi(); }
    for (const bar of [$("#mbar"), document.querySelector(".topbar")]) { bar.onpointerdown = holdUi; bar.onpointerup = keepUi; bar.onkeyup = keepUi; }
    if (pageClick) document.removeEventListener("click", pageClick); // the page may be drawn again at the same address
    const onDoc = pageClick = e => {
      if (stale(hash)) { if (pageClick === onDoc) pageClick = null; return document.removeEventListener("click", onDoc); }
      if (e.target.closest("#ayabar, #sheet, #mbar, .topbar, #player")) return;
      if (Date.now() - pressedAt < 400) return; // the click that ends a long press
      if (document.getElementById("ayabar")) { closeAyabar(); sel = -1; return; }
      if (e.target.closest("#mm")) setUi(!document.body.classList.contains("mm-ui"));
    };
    document.addEventListener("click", onDoc);
    if (!A) return;
    const verseAt = e => e.target.closest?.("#mpage span[data-v]");
    const openVerse = sp => {
      pressedAt = Date.now(); held = true; clearTimeout(pressT); pressAt = null;
      const v = Number(sp.dataset.v); if (v === sel && document.getElementById("ayabar")) return;
      closeAyabar(); setUi(false); sel = v; select(v); navigator.vibrate?.(12);
    };
    page.addEventListener("pointerdown", e => { const sp = verseAt(e); if (!sp || e.button > 0) return; pressAt = [e.clientX, e.clientY]; clearTimeout(pressT); pressT = setTimeout(() => openVerse(sp), 450); });
    page.addEventListener("pointermove", e => { if (pressAt && Math.hypot(e.clientX - pressAt[0], e.clientY - pressAt[1]) > 10) { clearTimeout(pressT); pressAt = null; } });
    for (const ev of ["pointerup", "pointercancel"]) page.addEventListener(ev, () => { clearTimeout(pressT); pressAt = null; if (held) { held = false; pressedAt = Date.now(); } });
    page.addEventListener("contextmenu", e => { const sp = verseAt(e); if (!sp) return; e.preventDefault(); openVerse(sp); });
    function select(v) {
      const [s, a] = runs[v]; const marked = isMarked("hafs", s, a);
      page.querySelectorAll(`span[data-v="${v}"]`).forEach(x => x.classList.add("sel"));
      const btn = (act, ic, label, cls = "") => `<button class="icon-btn ${cls}" data-act="${act}" aria-label="${esc(label)}" title="${esc(label)}">${icon(ic)}</button>`;
      document.body.insertAdjacentHTML("beforeend", `<div class="ayabar" id="ayabar" role="toolbar" aria-label="${esc(t("quran.position", { surah: surahName(s, hafs), aya: a, riwayah: rShort(hafs) }))}">
        <b class="ref">${esc(surahName(s, hafs))} <span>${esc(num(a))}</span></b>
        ${btn("tafsir", "tafsir", t("tafsir.title"))}${btn("bm", marked ? "bookmark-f" : "bookmark", t(marked ? "quran.bmRemove" : "quran.bmAdd"), marked ? "active" : "")}${btn("copy", "copy", t("common.copy"))}${btn("share", "share", t("common.share"))}${btn("play", "headphones", t("listen.fromAya"))}${btn("text", "translate", t("quran.openText"))}</div>`);
      $("#ayabar").onclick = async e => {
        const b = e.target.closest("[data-act]"); if (!b) return; const act = b.dataset.act;
        if (act === "tafsir") { closeAyabar(); sel = -1; ctx.tafsir().openAyah({ s, a, rid: "hafs" }); return; }
        if (act === "bm") { toggleMark("hafs", s, a); refreshBm(); closeAyabar(); sel = -1; return; }
        if (act === "play") { playFrom(hafs, s, a); closeAyabar(); sel = -1; return; }
        if (act === "text") { location.hash = `#/quran/hafs/${s}` + (a > 1 ? `?a=${a}` : ""); return; }
        let text; try { text = (await loadRiwayah("hafs")).data.s[s - 1][a - 1][0]; } catch { toast(t("common.loadFailed")); return; }
        const body = `${text.replace(AYA_NUM, "")} ﴿${num(a)}﴾\n${t("quran.copyRef", { surah: surahName(s, hafs), aya: a, riwayah: rName(hafs) })}`;
        if (act === "copy") copyText(body);
        if (act === "share") share(t("quran.surah", { name: surahName(s, hafs) }), `${body}\n${SITE}surah/${s}/#a-${a}`);
        closeAyabar(); sel = -1;
      };
    }
  }
  document.addEventListener("keydown", e => {
    const m = /^#\/mushaf\/(\w+)\/(\d+)/.exec(location.hash); if (!m || e.target?.closest?.("input, textarea, select") || document.getElementById("sheet")) return;
    if (e.key === "ArrowLeft") turnBy(m[1], Number(m[2]), 1);
    if (e.key === "ArrowRight") turnBy(m[1], Number(m[2]), -1);
  });

  // ---------- listening: riwayat → reciters → surahs ----------
  const listenTabs = on => `<div class="tabs-row"><div class="segmented"><a href="#/listen" class="${on === "rec" ? "on" : ""}">${icon("headphones")} ${esc(t("listen.recitations"))}</a><a href="#/radio" class="${on === "radio" ? "on" : ""}">${icon("radio")} ${esc(t("listen.radios"))}</a></div></div>`;
  async function renderListen(parts) {
    setNav("listen"); const hash = location.hash;
    loadIndex().catch(() => {});
    if (parts[0] === "r") return renderRewaya(Number(parts[1]), hash);
    if (parts[0] === "m") return renderMoshaf(Number(parts[1]), Number(parts[2]), hash);
    setHeader(t("listen.title"), { actions: `<a class="icon-btn" href="#/offline" aria-label="${esc(t("offline.title"))}">${icon("download")}</a>` }); view.innerHTML = listenTabs("rec") + loading();
    let list; try { list = await getRiwayatList(); } catch (e) { return failed(e, () => renderListen(parts)); }
    if (stale(hash)) return;
    await loadIndex().catch(() => {});
    const withText = new Set((INDEX?.riwayat || []).flatMap(r => r.audio));
    view.innerHTML = listenTabs("rec") + `<p class="riwayah-note">${esc(t("listen.intro"))}</p>
      <div class="list">${list.map((r, i) => `<a href="#/listen/r/${r.id}"><div class="num">${num(i + 1)}</div><div class="lbl" dir="auto">${esc(r.name.trim())}${withText.has(r.id) ? `<span class="sub">${icon("book")} ${esc(t("listen.hasText"))}</span>` : ""}</div>${icon("back", "chev")}</a>`).join("")}</div>`;
  }
  async function renderRewaya(id, hash) {
    setHeader(t("listen.reciters"), { back: true }); view.innerHTML = loading(t("quran.fetchingReciters"));
    let rl, reciters; try { [rl, reciters] = await Promise.all([getRiwayatList(), getReciters(id)]); } catch (e) { return failed(e, () => renderRewaya(id, hash)); }
    if (stale(hash)) return;
    setHeader(rl.find(r => r.id === id)?.name.trim() || t("listen.reciters"), { back: true });
    const rows = []; reciters.forEach(r => r.moshaf.filter(m => m.rewaya_id === id).forEach(m => rows.push({ r, m })));
    const c = collator(); rows.sort((x, y) => c.compare(x.r.name, y.r.name));
    view.innerHTML = `<div class="searchbox">${icon("search")}<input id="rq" type="search" placeholder="${esc(t("quran.searchReciter"))}" autocomplete="off"></div><p class="riwayah-note">${esc(t("count.recitations", { n: rows.length }))}</p><div class="list" id="rlist"></div>`;
    const draw = f => { const q = lower(f); $("#rlist").innerHTML = rows.filter(x => !q || lower(x.r.name).includes(q)).map(({ r, m }) => `<a href="#/listen/m/${id}/${m.id}"><div class="num">${esc(r.letter || r.name[0])}</div><div class="lbl" dir="auto">${esc(r.name)}<span class="sub" dir="auto">${esc(m.name)}${sep()}${esc(t("count.surahs", { n: m.surah_total }))}</span></div>${icon("back", "chev")}</a>`).join("") || `<div class="empty">${esc(t("common.noResults"))}</div>`; };
    draw(""); $("#rq").oninput = e => draw(e.target.value.trim());
  }
  async function renderMoshaf(rewaya, moshafId, hash) {
    setHeader(t("listen.recitation"), { back: true }); view.innerHTML = loading();
    let reciters; try { reciters = await getReciters(rewaya); await loadIndex(); } catch (e) { return failed(e, () => renderMoshaf(rewaya, moshafId, hash)); }
    if (stale(hash)) return;
    let rec, m; for (const r of reciters) { const x = r.moshaf.find(y => y.id === moshafId); if (x) { rec = r; m = x; break; } }
    if (!m) { view.innerHTML = `<div class="empty">${esc(t("listen.notFound"))}</div>`; return; }
    setHeader(rec.name, { back: true });
    const list = surahList({ list: m.surah_list }); const sub = `${rec.name}${sep()}${m.name}`;
    const rid = INDEX.riwayat.find(r => r.audio.includes(rewaya))?.id || ""; // the Quran text it can be followed on
    const urls = list.map(n => surahUrl(m.server, n)); const jobId = "rec:" + m.server;
    view.innerHTML = `<div class="hero slim"><h2 dir="auto">${esc(rec.name)}</h2><p dir="auto">${esc(m.name)}${sep()}${esc(t("count.surahs", { n: list.length }))}</p>
        <div class="hero-actions"><button class="btn light" id="play-all">${icon("play")} ${esc(t("listen.playFromStart"))}</button>${off.isSupported() ? ` <button class="btn light" id="dl-all">${icon("download")} ${esc(t("offline.downloadAll"))}</button>` : ""}</div>
        <div class="dl-status" id="dl-status"></div></div>
      <div class="list" id="slist">${list.map(n => `<div class="row split" data-n="${n}" data-playing="surah:${esc(m.server)}:${n}"><button class="row-main" data-play="${n}"><div class="num">${num(n)}</div><div class="lbl">${esc(t("quran.surah", { name: surahName(n) }))}<span class="sub saved-flag" hidden>${icon("check")} ${esc(t("offline.surahSaved"))}</span></div>${icon("play", "chev-play")}</button>${off.isSupported() ? `<button class="icon-btn dl-btn" data-dl="${n}" aria-label="${esc(t("offline.download"))}">${icon("download")}</button>` : ""}</div>`).join("")}</div>`;
    $("#play-all").onclick = () => player.surahs({ server: m.server, list, start: list[0], sub, rid });
    const meta = { name: rec.name, moshaf: m.name, rewaya, moshafId: m.id, server: m.server, list: m.surah_list };
    const remember = () => { const recs = LS.get("offline:recs", {}); recs[m.server] = meta; LS.set("offline:recs", recs); };
    const refreshSaved = async () => {
      const saved = await off.savedSet(off.STORES.AUDIO, urls); if (stale(hash)) return;
      view.querySelectorAll("#slist [data-n]").forEach(row => {
        const on = saved.has(surahUrl(m.server, Number(row.dataset.n)));
        row.querySelector(".saved-flag").hidden = !on;
        const b = row.querySelector(".dl-btn"); if (b) { b.innerHTML = icon(on ? "trash" : "download"); b.setAttribute("aria-label", t(on ? "offline.delete" : "offline.download")); b.dataset.saved = on ? "1" : ""; }
      });
      if (!off.currentJob() || off.currentJob().id !== jobId) $("#dl-status").textContent = saved.size ? t("offline.reciterSaved", { done: saved.size, total: list.length, size: off.fmtSize(await off.savedBytes(off.STORES.AUDIO, urls.filter(u => saved.has(u))), getLang()) }) : "";
    };
    const showJob = j => { const st = $("#dl-status"); if (!st || !j || j.id !== jobId) return; st.innerHTML = `${esc(t("offline.progressSize", { done: j.done, total: j.total, size: off.fmtSize(j.bytes, getLang()) }))} <button class="link inline light" id="dl-cancel">${esc(t("offline.cancel"))}</button>`; $("#dl-cancel").onclick = () => off.cancel(); };
    const onProgress = e => { if (stale(hash)) return window.removeEventListener("offline-progress", onProgress); if (e.detail) showJob(e.detail); else refreshSaved(); };
    window.addEventListener("offline-progress", onProgress);
    showJob(off.currentJob()); refreshSaved();
    const run = async (todo, confirmSize) => {
      if (off.currentJob()) return toast(t("offline.busy"));
      if (confirmSize) {
        $("#dl-status").textContent = t("offline.measuring");
        const size = await off.remoteSize(todo); if (stale(hash)) return;
        if (!confirm(t("offline.confirmSize", { size: off.fmtSize(size, getLang()) }))) return refreshSaved();
      }
      remember();
      reportJob(await off.download({ id: jobId, urls: todo, store: off.STORES.AUDIO, concurrency: 2 }));
    };
    const dlAll = $("#dl-all");
    if (dlAll) dlAll.onclick = async () => { const saved = await off.savedSet(off.STORES.AUDIO, urls); run(urls.filter(u => !saved.has(u)), true); };
    $("#slist").onclick = async e => {
      const dl = e.target.closest("[data-dl]");
      if (dl) {
        const u = surahUrl(m.server, Number(dl.dataset.dl));
        if (dl.dataset.saved) { if (confirm(t("offline.confirmDelete"))) { await off.remove(off.STORES.AUDIO, [u]); toast(t("offline.deleted")); refreshSaved(); } }
        else run([u], false);
        return;
      }
      const b = e.target.closest("[data-play]"); if (b) player.surahs({ server: m.server, list, start: Number(b.dataset.play), sub, rid });
    };
    player.refresh();
  }
  const surahUrl = (server, n) => `${server}${String(n).padStart(3, "0")}.mp3`;
  function reportJob(r) {
    if (r.busy) return toast(t("offline.busy"));
    if (r.noSpace) return toast(t("offline.noSpace"));
    if (r.cancelled) return toast(t("offline.cancelled"));
    toast(r.failed ? t("offline.failed", { n: r.failed }) : t("offline.done"));
  }
  async function saveRiwayah(meta) { const c = await caches.open(off.STORES.QURAN); await c.addAll([meta.data, meta.font]); }

  // ---------- offline content manager ----------
  let sizes = null;
  async function renderOffline() {
    setNav("settings"); setHeader(t("offline.title"), { back: true }); const hash = location.hash;
    if (!off.isSupported()) { view.innerHTML = `<div class="empty">${esc(t("offline.needOnce"))}</div>`; return; }
    view.innerHTML = loading();
    try { await Promise.all([loadIndex(), loadPages()]); } catch (e) { return failed(e, renderOffline); }
    const pagesSaved = Object.fromEntries(await Promise.all(editions().map(async e2 => [e2, await off.savedSet(off.STORES.PAGES, pageFontUrls(e2))])));
    sizes ||= await fetch("data/audio-sizes.json").then(r => r.json()).catch(() => null);
    const lang = getLang(); const fmt = b => off.fmtSize(b, lang);
    const audio = adhkarAudio();
    // Don't hold the page for the QuranEnc list: wait at most 3 s, then show what is already known.
    const within = (p, ms, fallback) => Promise.race([p, new Promise(r => setTimeout(() => r(fallback), ms))]);
    const trKey = await within(currentTr(), 3000, state.trChosen ? state.tr || "" : ""); const tm = await within(trMeta(trKey), 3000, null);
    const trUrls = trKey ? Array.from({ length: 114 }, (_, i) => trUrl(trKey, i + 1)) : [];
    const recs = LS.get("offline:recs", {});
    const hadithRows = (row, part) => ctx.hadith().offlineRows(fmt, part, row).catch(() => `<div class="about">${esc(t("common.loadFailed"))}</div>`);
    const tafsirRows = (row, part) => ctx.tafsir().offlineRows(fmt, part, row).catch(() => `<div class="about">${esc(t("common.loadFailed"))}</div>`);
    const [storage, riwSaved, trSaved, itemsSaved, chSaved, recRows] = await Promise.all([
      off.storageInfo(),
      Promise.all(INDEX.riwayat.map(async r => (await off.savedSet(off.STORES.QURAN, [r.data, r.font])).size === 2)),
      off.savedSet(off.STORES.TR, trUrls),
      off.savedSet(off.STORES.AUDIO, audio.items),
      off.savedSet(off.STORES.AUDIO, audio.chapters),
      Promise.all(Object.values(recs).map(async x => { const us = surahList(x).map(n => surahUrl(x.server, n)); const s = await off.savedSet(off.STORES.AUDIO, us); return { x, us, saved: [...s], bytes: await off.savedBytes(off.STORES.AUDIO, [...s]) }; })),
    ]);
    if (stale(hash)) return;
    const btn = (act, label, ic, cls = "ghost") => `<button class="btn ${cls} small" data-act="${act}">${icon(ic)} ${esc(t(label))}</button>`;
    const row = (title, subText, act, saved, extra = "") => `<div class="setting"><div class="lbl">${esc(title)}<small>${subText}</small></div>${extra}${saved ? btn("del:" + act, "offline.delete", "trash", "danger") : ""}${saved !== "full" ? btn("save:" + act, "offline.save", "download", "") : ""}</div>`;
    const part = (done, total) => done === 0 ? false : done === total ? "full" : "part";
    const [hadithHtml, tafsirHtml] = await Promise.all([hadithRows(row, part), tafsirRows(row, part)]); if (stale(hash)) return;
    view.innerHTML = `
      <p class="riwayah-note">${esc(t("offline.intro"))}</p>
      <div class="card"><div class="about">${esc(t("offline.storage", { used: fmt(storage.usage), quota: fmt(storage.quota) }))}<br><small>${esc(t(storage.persisted ? "offline.persisted" : "offline.notPersisted"))}</small></div><div id="job"></div></div>
      <h2 class="section-title">${esc(t("offline.mushaf"))}</h2>
      <div class="card">${INDEX.riwayat.map((r, i) => row(rName(r), esc(t(riwSaved[i] ? "offline.saved" : "offline.notSaved")), "riw:" + r.id, riwSaved[i] ? "full" : false)).join("")}
        ${riwSaved.some(x => !x) ? `<div class="setting"><div class="lbl"></div>${btn("save:riw:all", "offline.saveAll", "download", "")}</div>` : ""}</div>
      <h2 class="section-title">${esc(t("offline.mushafPages"))}</h2>
      <div class="card">${editions().map(e2 => row(t("mushaf.ed" + e2), esc(t("offline.progress", { done: pagesSaved[e2].size, total: 604 })) + `${sep()}${esc(t("offline.size", { size: fmt(FONTS[EDITIONS[e2].v].bytes) }))}`, "pages:" + e2, part(pagesSaved[e2].size, 604))).join("")}</div>
      <h2 class="section-title">${esc(t("offline.hadith"))}</h2>
      <div class="card">${hadithHtml}</div>
      <h2 class="section-title">${esc(t("offline.tafsir"))}</h2>
      <div class="card">${tafsirHtml}</div>
      <h2 class="section-title">${esc(t("offline.translation"))}</h2>
      <div class="card">${trKey
        ? row(tm ? trLabel(tm) : trKey, esc(t("offline.progress", { done: trSaved.size, total: 114 })), "tr", part(trSaved.size, 114))
        : `<div class="setting"><div class="lbl">${esc(t("offline.noTranslation"))}</div><button class="btn ghost small" id="pick-tr">${icon("translate")} ${esc(t("quran.chooseTranslation"))}</button></div>`}</div>
      <h2 class="section-title">${esc(t("offline.adhkarAudio"))}</h2>
      <div class="card">
        ${row(t("offline.itemsAudio"), esc(t("offline.progress", { done: itemsSaved.size, total: audio.items.length })) + (sizes ? `${sep()}${esc(t("offline.size", { size: fmt(sizes.items.bytes) }))}` : ""), "items", part(itemsSaved.size, audio.items.length))}
        ${row(t("offline.chaptersAudio"), esc(t("offline.progress", { done: chSaved.size, total: audio.chapters.length })) + (sizes ? `${sep()}${esc(t("offline.size", { size: fmt(sizes.chapters.bytes) }))}` : ""), "chapters", part(chSaved.size, audio.chapters.length))}
      </div>
      <h2 class="section-title">${esc(t("offline.recitations"))}</h2>
      <div class="card">${recRows.filter(r => r.saved.length).map(({ x, us, saved, bytes }) => `<div class="setting"><div class="lbl" dir="auto">${esc(x.name)}<small dir="auto">${esc(x.moshaf)}${sep()}${esc(t("offline.reciterSaved", { done: saved.length, total: us.length, size: fmt(bytes) }))}</small></div><a class="btn ghost small" href="#/listen/m/${x.rewaya}/${x.moshafId}">${esc(t("offline.open"))}</a>${btn("del:rec:" + x.server, "offline.delete", "trash", "danger")}</div>`).join("") || `<div class="about">${esc(t("offline.noRecitations"))}</div>`}</div>`;

    const showJob = j => { const box = $("#job"); if (!box) return; box.innerHTML = j ? `<div class="setting"><div class="lbl">${esc(t("offline.saving"))}<small>${esc(t("offline.progressSize", { done: j.done, total: j.total, size: fmt(j.bytes) }))}</small><div class="progress"><div style="width:${Math.round(j.done / Math.max(j.total, 1) * 100)}%"></div></div></div><button class="btn ghost small" id="job-cancel">${esc(t("offline.cancel"))}</button></div>` : ""; const c = $("#job-cancel"); if (c) c.onclick = () => off.cancel(); };
    const onProgress = e => { if (stale(hash)) return window.removeEventListener("offline-progress", onProgress); if (e.detail) showJob(e.detail); else renderOffline(); };
    window.addEventListener("offline-progress", onProgress);
    showJob(off.currentJob());
    $("#pick-tr")?.addEventListener("click", () => pickTranslation(renderOffline));

    const targets = {
      tr: [off.STORES.TR, trUrls], items: [off.STORES.AUDIO, audio.items], chapters: [off.STORES.AUDIO, audio.chapters],
      pages: id => [off.STORES.PAGES, pageFontUrls(id)],
      hadith: id => ctx.hadith().offlineTarget(id) || [],
      tafsir: id => ctx.tafsir().offlineTarget(id) || [],
    };
    view.querySelectorAll("[data-act]").forEach(b => b.onclick = async () => {
      // data-act is "<save|del>:<kind>[:<id>]"; the id may itself contain ":" (reciter server URLs).
      const [act, kind, ...rest] = b.dataset.act.split(":"); const id = rest.join(":");
      if (act === "del" && !confirm(t("offline.confirmDelete"))) return;
      if (kind === "riw") {
        const list = id === "all" ? INDEX.riwayat : [riw(id)];
        if (act === "del") { await off.remove(off.STORES.QURAN, list.flatMap(r => [r.data, r.font])); list.forEach(r => dataCache.delete(r.id)); toast(t("offline.deleted")); return renderOffline(); }
        b.disabled = true; b.textContent = t("offline.saving");
        try { for (const r of list) await saveRiwayah(r); toast(t("offline.done")); } catch { toast(t("offline.needOnce")); }
        return renderOffline();
      }
      if (kind === "rec") {
        const x = recs[id]; if (!x) return;
        await off.remove(off.STORES.AUDIO, surahList(x).map(n => surahUrl(x.server, n)));
        delete recs[id]; LS.set("offline:recs", recs); toast(t("offline.deleted")); return renderOffline();
      }
      const tg = targets[kind]; const [store, urls] = typeof tg === "function" ? tg(id) : (tg || []);
      if (!store) return;
      // A print saved here is kept like one saved from its pages (keepPages); one deleted is no longer kept.
      if (kind === "pages") { if (act === "del") delete state.keepPages?.[id]; else (state.keepPages ||= {})[id] = true; save(); delete pagesSaved[id]; }
      if (act === "del") { await off.remove(store, urls); toast(t("offline.deleted")); return renderOffline(); }
      reportJob(await off.download({ id: "off:" + kind + id, urls, store, concurrency: kind === "audio" ? 3 : 4 }));
    });
  }

  // ---------- radios: six groups (the Quran, the Sunnah, the Seerah, creed, fiqh, other) ----------
  // data/radios.json: live Quran stations, hadith book stations (sunnah) and one-subject mp3quran stations (topics, with a group).
  // data/lessons.json: recorded audio series that play one lesson after another, for subjects no station broadcasts all day.
  // Every other mp3quran station (the reciters) is listed in the Quran group.
  const RADIO_GROUPS = ["quran", "sunnah", "seerah", "aqeedah", "fiqh", "misc"];
  let radioQuery = "";
  const lessonState = () => LS.get("lessons", {}); // { seriesId: [lesson index, seconds] }
  const saveLesson = (id, i, sec) => { const s = lessonState(); s[id] = [i, Math.floor(sec)]; LS.set("lessons", s); };
  const stationTitle = r => isAr() ? r.name : r.en || r.name;
  const seriesTitle = s => isAr() ? s.ar : s.en;
  const lessonsBy = s => isAr() ? s.by : s.byEn;
  // The path of a qurango.net stream («…/radio/<path>»): the same station in the API and in radios.json.
  const radioPath = u => (/\/radio\/([^/?#]+)/.exec(u) || [])[1] || u;

  async function renderRadio(parts = []) {
    if (parts[0] === "lessons") return renderLessons(parts[1]);
    setNav("listen"); setHeader(t("radio.title")); const hash = location.hash;
    let group = RADIO_GROUPS.includes(parts[0]) ? parts[0] : RADIO_GROUPS.includes(state.radioGroup) ? state.radioGroup : "quran";
    view.innerHTML = listenTabs("radio") + loading(t("radio.fetching"));
    const canHls = !!document.createElement("audio").canPlayType("application/vnd.apple.mpegurl");
    const [R, L, reciters] = await Promise.all([getRadios().catch(() => ({ live: [], sunnah: [], topics: [], hide: [] })), getLessons().catch(() => null), getReciterRadios().catch(() => null)]);
    if (stale(hash)) return;
    const stationName = r => { const k = "station." + r.id; const v = t(k); return v === k ? r.name : v; };
    const country = r => r.cc ? regionName(r.cc) : t("radio.variety");
    const liveOk = R.live.filter(r => !r.hls || canHls);
    // Stations already listed under their subject, or as a live station, are not repeated among the reciters
    // (nor the ones radios.json hides because they are off the air).
    const claimed = new Set([...R.live, ...R.sunnah, ...R.topics].map(r => radioPath(r.url)).concat(R.hide));
    const c = collator(); const rows = (reciters || []).filter(r => r.url && !claimed.has(radioPath(r.url))).sort((x, y) => c.compare(x.name, y.name));
    const byId = new Map();
    liveOk.forEach(r => byId.set("live:" + r.id, { id: "live:" + r.id, url: r.url, name: stationName(r), sub: t("radio.liveSub", { country: country(r) }) }));
    [...R.sunnah.map(r => ({ ...r, group: "sunnah" })), ...R.topics].forEach(r => byId.set("top:" + r.id, { id: "top:" + r.id, url: r.url, name: stationTitle(r), sub: t("radio.mp3quran"), group: r.group }));
    // The API's backup.qurango.net host answers HTTP 500 now and then; qurango.net serves the same streams.
    rows.forEach(r => byId.set("rad:" + r.id, { id: "rad:" + r.id, url: r.url.replace("://backup.qurango.net/", "://qurango.net/"), name: r.name, sub: t("radio.mp3quran") }));

    const row = (id, ic, name, sub, attrs = "") => `<button class="row" data-id="${esc(id)}" data-playing="radio:${esc(id)}"${attrs}><div class="num">${icon(ic)}</div><div class="lbl">${esc(name)}${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</div>${icon("play", "chev-play")}</button>`;
    const stations = g => [...byId.values()].filter(x => x.group === g).map(x => row(x.id, "radio", x.name, x.sub)).join("");
    const lessonRows = g => {
      const list = (L?.series || []).filter(s => s.group === g); if (!list.length) return "";
      const at = lessonState();
      return `<h2 class="section-title">${esc(t("radio.lessons"))}</h2><p class="radio-note">${esc(t("radio.lessonsNote"))}</p>
        <div class="list">${list.map(s => { const p = at[s.id];
          return `<a href="#/radio/lessons/${esc(s.id)}"><div class="num">${icon("headphones")}</div><div class="lbl">${esc(seriesTitle(s))}${isAr() ? "" : ` <span class="ar-name" lang="ar" dir="rtl">${esc(s.ar)}</span>`}<span class="sub">${esc(lessonsBy(s) + sep() + t("count.lessons", { n: s.tracks.length }))}${p ? esc(sep() + t("lessons.reached", { n: p[0] + 1 })) : ""}</span></div>${icon("back", "chev")}</a>`; }).join("")}</div>`;
    };
    const videosLink = g => `<div class="list" style="margin-top:12px"><a href="#/videos?g=${g}"><div class="num">${icon("video")}</div><div class="lbl">${esc(t("radio.videosLink", { group: t("media." + g) }))}</div>${icon("back", "chev")}</a></div>`;
    const section = (title, html) => html ? `<h2 class="section-title">${esc(title)}</h2><div class="list">${html}</div>` : "";
    function groupHtml(g) {
      if (g === "quran") return section(t("radio.live"), liveOk.map(r => row("live:" + r.id, "radio", stationName(r), t("radio.liveSub", { country: country(r) }))).join(""))
        + section(t("radio.topicsQuran"), stations("quran"))
        + `<h2 class="section-title">${esc(t("radio.reciterStations"))}</h2>`
        + (reciters ? `<div class="searchbox">${icon("search")}<input id="radq" type="search" placeholder="${esc(t("radio.search"))}" value="${esc(radioQuery)}" autocomplete="off"></div><div class="list" id="rlist"></div>` : `<div class="empty">${esc(t("radio.listFailed"))}</div>`);
      return (g === "aqeedah" ? `<p class="radio-note card">${icon("book")}<span>${esc(t("radio.noAqeedahLive"))}</span></p>` : "")
        + section(t("radio.allDay"), stations(g)) + lessonRows(g);
    }
    view.innerHTML = listenTabs("radio") + `<div class="chips radio-groups" id="rgroups" role="tablist">${RADIO_GROUPS.map(g => `<button class="chip" role="tab" data-g="${g}">${esc(t("media." + g))}</button>`).join("")}</div>
      <div id="radios"></div>`;
    const box = $("#radios");
    const draw = () => { const q = lower(radioQuery.trim()); const list = $("#rlist"); if (!list) return; list.innerHTML = rows.filter(r => !q || lower(r.name).includes(q)).map(r => row("rad:" + r.id, "radio", r.name, "", ' dir="auto"')).join("") || `<div class="empty">${esc(t("common.noResults"))}</div>`; player.refresh(); };
    const show = g => {
      group = g; state.radioGroup = g; save();
      $("#rgroups").querySelectorAll("[data-g]").forEach(b => { const on = b.dataset.g === g; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
      box.innerHTML = groupHtml(g) + videosLink(g) + `<p class="source-note">${esc(t(L && g !== "quran" ? "radio.sourceNoteLessons" : "radio.sourceNote"))}</p>`;
      draw(); const qi = $("#radq"); if (qi) qi.oninput = () => { radioQuery = qi.value; draw(); };
      player.refresh();
    };
    $("#rgroups").onclick = e => { const b = e.target.closest("[data-g]"); if (!b || b.dataset.g === group) return; history.replaceState(null, "", "#/radio/" + b.dataset.g); show(b.dataset.g); b.scrollIntoView({ inline: "nearest", block: "nearest" }); };
    box.addEventListener("click", e => { const b = e.target.closest("button[data-id]"); if (b && byId.has(b.dataset.id)) player.radio(byId.get(b.dataset.id)); });
    show(group);
    $("#rgroups .chip.on")?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }

  // An audio series: its lessons, played one after another; the lesson and minute reached are kept.
  async function renderLessons(id) {
    setNav("listen"); const hash = location.hash;
    setHeader(t("radio.lessons"), { back: true }); view.innerHTML = loading();
    let L; try { L = await getLessons(); } catch { if (!stale(hash)) view.innerHTML = `<div class="empty">${esc(t("common.dataFailed"))}</div>`; return; }
    if (stale(hash)) return;
    const s = L.series.find(x => x.id === id); if (!s) { location.hash = "#/radio/aqeedah"; return; }
    setHeader(seriesTitle(s), { back: true });
    const p = lessonState()[s.id];
    const play = (i, at = 0) => player.tracks({ id: "les:" + s.id, list: s.tracks, start: i, at, name: seriesTitle(s), sub: lessonsBy(s), save: (k, sec) => { saveLesson(s.id, k, sec); } });
    view.innerHTML = `<section class="lesson-head">
        <div class="lh-title">${esc(seriesTitle(s))}${isAr() ? "" : `<span class="ar-name" lang="ar" dir="rtl">${esc(s.ar)}</span>`}</div>
        <div class="lh-sub">${esc(lessonsBy(s) + sep() + t("count.lessons", { n: s.tracks.length }))}</div>
        <div class="lh-actions">${p ? `<button class="btn" id="les-go">${icon("play")} ${esc(t("lessons.continue", { n: p[0] + 1 }))}</button>` : ""}<button class="btn ${p ? "ghost" : ""}" id="les-start">${icon("play")} ${esc(t("lessons.start"))}</button></div>
      </section>
      <div class="list" id="les-list">${s.tracks.map(([, d], i) => `<button class="row" data-i="${i}" data-playing="track:les:${esc(s.id)}:${i}"><div class="num">${num(i + 1)}</div><div class="lbl">${esc(t("lessons.n", { n: i + 1 }))}${d ? `<span class="sub" lang="ar" dir="rtl">${esc(d)}</span>` : ""}</div>${icon("play", "chev-play")}</button>`).join("")}</div>
      <p class="source-note">${esc(t("lessons.source", { source: isAr() ? s.source : s.sourceEn }))} <a href="https://islamhouse.com/ar/audios/${s.ih}/" target="_blank" rel="noopener">IslamHouse.com</a></p>`;
    if (p) $("#les-go").onclick = () => play(p[0], p[1]);
    $("#les-start").onclick = () => play(0);
    $("#les-list").onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; const i = Number(b.dataset.i); const at = lessonState()[s.id]; play(i, at && at[0] === i ? at[1] : 0); };
    player.refresh();
  }

  return {
    quran(parts, params) {
      if (!parts.length && params?.get("q")) homeQuery = params.get("q"); // search started from the Home page
      return parts.length ? renderReader(parts[0], Number(parts[1]), params) : renderHome();
    },
    // Surah names matching a query (Arabic, transliterated, or a number), for the Home search.
    async searchSurahs(q) {
      await loadIndex(); const meta = riw(state.riwayah); const A = meta.id === "hafs" ? await loadAyat().catch(() => null) : null; const mode = homeMode(A);
      return surahMatches(meta, q).map(i => ({ n: i + 1, name: surahName(i + 1, meta), href: placeHref(mode, meta.id, i + 1, 1, { A, flash: false }) }));
    },
    // The latest reading place (a printed page or a verse), for the Home page.
    async resume() { await loadIndex(); const r = resumeInfo(); return r && { href: r.href, text: r.text }; },
    listen: renderListen, radio: parts => renderRadio(parts), offline: renderOffline, mushaf: (ed, n, params) => renderPages(ed, n, params), player, sheet, closeSheet,
    pickTranslation, translationLabel: async () => trLabel(await trMeta(await currentTr())),
    // Quran text of a riwayah (with its font) and surah names, for the tafsir pages.
    textOf: id => loadRiwayah(id), surahName,
    // For the Tajweed rules page: the Tajweed print's font of page n (with its backup copy), and the surah names.
    // Only mushaf/tajweed.json is needed for that, not the pages (madinah.json, about 900 KB).
    async tajweedFont(n) {
      if (!FONTS.v4) { tajweedFonts ||= fetchJSON("mushaf/tajweed.json").then(tj => { FONTS = { ...FONTS, ...tj.fonts }; }).finally(() => { tajweedFonts = null; }); await tajweedFonts; }
      return loadPageFont("tajweed", n);
    },
    async surahNames() { await loadIndex(); return n => surahName(n); },
    // For the Tajweed rules page: the recitation of Shaykh Mahmoud Khalil al-Husary (Hafs, murattal) on mp3quran.net,
    // whose verse timings the player already uses. file(s): the surah's recording; times(s, a): where verse a starts
    // and ends in it, in seconds (end null for the last verse), or null when the timings are missing or do not fit.
    husary: {
      file: s => surahUrl(HUSARY, s),
      async times(s, a) {
        await loadIndex(); const starts = await surahStarts(HUSARY, s); if (!starts) return null;
        // In Al-Fatihah the timings number the basmala 0 and the verses after it 1–6, one less than the Mushaf.
        const shift = s === 1 && starts.length - 1 === riw("hafs").surahs[0][1] - 1 ? 1 : 0;
        if (!shift && !fits(starts, riw("hafs"), s)) return null;
        const i = a - shift; if (typeof starts[i] !== "number") return null;
        return { start: starts[i], end: typeof starts[i + 1] === "number" ? starts[i + 1] : null };
      },
    },
  };
}
