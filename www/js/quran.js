/* ===== المصحف بالروايات + ترجمة المعاني + الاستماع + الإذاعات ===== */
// Quran text and fonts: King Fahd Glorious Quran Printing Complex (KFGQPC), shown verbatim.
// Translations of meanings: QuranEnc.com API (shown unchanged, with title and version).
// Recitations and reciter radios: mp3quran.net API. Live stations: data/radios.json (verified list).

import * as off from "./offline.js?v=1.3.1";

const API = "https://www.mp3quran.net/api/v3";
const QE = "https://quranenc.com/api/v1";
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

// mp3quran.net localises reciter and riwayah names in these languages; everything else uses English.
const MP3Q_LANG = { ar: "ar", en: "eng", fr: "fr", ru: "ru", de: "de", es: "es", tr: "tr", zh: "cn", ur: "ur", bn: "bn", bs: "bs", fa: "fa", id: "id", pt: "pt", ha: "ha", sw: "sw" };
const KUFI_AYAT = 6236; // QuranEnc numbering follows the Kufan count (Hafs, Shuʿbah)

export function setupQuran(ctx) {
  const { view, $, esc, icon, toast, t, num, sep, getLang, collator, regionName, languageName, setHeader, setNav, LS, copyText, share, adhkarAudio } = ctx;
  const state = Object.assign({ riwayah: "hafs", last: null, bookmark: null, reciters: {}, tab: "surahs" }, LS.get("quran", {}));
  const save = () => LS.set("quran", state);
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
  function sheet(title, bodyHtml) {
    closeSheet();
    const wrap = document.createElement("div"); wrap.className = "sheet-backdrop"; wrap.id = "sheet";
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="${esc(t("common.close"))}">${icon("close")}</button></div><div class="sheet-body">${bodyHtml}</div></div>`;
    wrap.addEventListener("click", e => { if (e.target === wrap || e.target.closest("[data-close]")) closeSheet(); });
    document.body.appendChild(wrap); document.body.classList.add("no-scroll");
    return $(".sheet-body", wrap);
  }
  function closeSheet() { const s = document.getElementById("sheet"); if (s) s.remove(); document.body.classList.remove("no-scroll"); }
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
  window.addEventListener("hashchange", closeSheet);

  // ---------- remote JSON (memory cache, last copy kept in storage for offline listing) ----------
  const remote = new Map();
  function getJSON(url, { keep = true } = {}) {
    if (remote.has(url)) return remote.get(url);
    const p = fetch(url).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(j => { if (keep) LS.set("api:" + url, j); return j; })
      .catch(err => { remote.delete(url); const old = LS.get("api:" + url, null); if (old) return old; throw err; });
    remote.set(url, p); return p;
  }
  const mp3Lang = () => MP3Q_LANG[getLang()] || "eng";
  const getRiwayatList = () => getJSON(`${API}/riwayat?language=${mp3Lang()}`).then(j => j.riwayat);
  const getReciters = rewaya => getJSON(`${API}/reciters?language=${mp3Lang()}&rewaya=${rewaya}`).then(j => j.reciters);
  const getReciterRadios = () => getJSON(`${API}/radios?language=${mp3Lang()}`).then(j => j.radios);
  let liveRadios = null;
  const getLiveRadios = async () => liveRadios || (liveRadios = await fetch("data/radios.json").then(r => r.json()).then(j => j.live));

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
    const btn = $("#pl-toggle", el), t1 = $(".pl-title", el), t2 = $(".pl-sub", el), prev = $("#pl-prev", el), next = $("#pl-next", el);
    let q = null;
    const pad = n => String(n).padStart(3, "0");
    const url = () => q.type === "radio" ? q.url : `${q.server}${pad(q.list[q.idx])}.mp3`;
    const title = () => q.type === "radio" ? q.name : t("quran.surah", { name: surahName(q.list[q.idx]) });
    function render() {
      el.hidden = !q; document.body.classList.toggle("has-player", !!q); if (!q) return;
      t1.textContent = title(); t2.textContent = q.sub || "";
      const surahs = q.type === "surahs"; prev.hidden = next.hidden = !surahs;
      if (surahs) { prev.disabled = q.idx <= 0; next.disabled = q.idx >= q.list.length - 1; }
      btn.innerHTML = icon(a.paused ? "play" : "pause"); btn.setAttribute("aria-label", t(a.paused ? "common.play" : "common.pause"));
      document.querySelectorAll("[data-playing]").forEach(x => x.classList.toggle("on", x.dataset.playing === key()));
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: title(), artist: q.sub || "", album: t("app.name"), artwork: [{ src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }] });
      }
    }
    const failMsg = () => t(q.type === "radio" ? "radio.playFailed" : "listen.playFailed");
    function start() {
      document.getElementById("audio")?.pause();
      el.classList.add("loading"); a.src = url();
      a.play().catch(() => { el.classList.remove("loading"); toast(failMsg()); render(); });
      render();
    }
    function step(d) { if (q?.type !== "surahs") return; const i = q.idx + d; if (i < 0 || i >= q.list.length) return; q.idx = i; start(); }
    const key = () => !q ? "" : q.type === "radio" ? "radio:" + q.id : `surah:${q.server}:${q.list[q.idx]}`;
    a.addEventListener("playing", () => { el.classList.remove("loading"); render(); });
    a.addEventListener("waiting", () => el.classList.add("loading"));
    a.addEventListener("pause", render);
    a.addEventListener("ended", () => { if (q?.type === "surahs" && q.idx < q.list.length - 1) step(1); else render(); });
    a.addEventListener("error", () => { if (!q || !a.getAttribute("src")) return; el.classList.remove("loading"); toast(q.type === "radio" ? t("radio.playFailed") : t("listen.loadFailed")); render(); });
    btn.onclick = () => { if (!q) return; if (a.paused) { if (q.type === "radio") start(); else a.play().catch(() => {}); } else a.pause(); };
    prev.onclick = () => step(-1); next.onclick = () => step(1);
    $("#pl-close", el).onclick = () => { a.pause(); a.removeAttribute("src"); a.load(); q = null; render(); };
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => btn.click());
      navigator.mediaSession.setActionHandler("pause", () => a.pause());
      try { navigator.mediaSession.setActionHandler("previoustrack", () => step(-1)); navigator.mediaSession.setActionHandler("nexttrack", () => step(1)); } catch { /* unsupported */ }
    }
    return {
      surahs({ server, list, start: s, sub }) { const idx = list.indexOf(s); if (idx < 0) { toast(t("listen.surahUnavailable")); return; } q = { type: "surahs", server, list, idx, sub }; start(); },
      radio({ id, url: u, name, sub }) { if (q?.type === "radio" && q.id === id && !a.paused) { a.pause(); return; } q = { type: "radio", id, url: u, name, sub }; start(); },
      pause() { a.pause(); },
      key, refresh: render,
    };
  })();

  // ---------- reciter picker (for the reader) ----------
  async function pickReciter(meta, then) {
    const body = sheet(t("quran.pickReciterTitle", { name: rShort(meta) }), loading(t("quran.fetchingReciters")));
    try {
      const lists = await Promise.all(meta.audio.map(id => getReciters(id).catch(() => [])));
      const items = [];
      lists.flat().forEach(r => r.moshaf.filter(m => meta.audio.includes(m.rewaya_id)).forEach(m => items.push({ name: r.name, moshaf: m.name, server: m.server, list: m.surah_list, total: m.surah_total })));
      const c = collator(); const seen = new Set();
      const uniq = items.filter(x => !seen.has(x.server) && seen.add(x.server)).sort((x, y) => c.compare(x.name, y.name));
      if (!uniq.length) { body.innerHTML = `<div class="empty">${esc(t("quran.noReciters"))}</div>`; return; }
      body.innerHTML = `<div class="searchbox small">${icon("search")}<input type="search" placeholder="${esc(t("quran.searchReciter"))}" id="rc-q"></div><div class="list flat" id="rc-list"></div>`;
      const draw = f => { const q = lower(f); $("#rc-list", body).innerHTML = uniq.filter(x => !q || lower(x.name).includes(q)).map(x => `<button class="row" data-i="${uniq.indexOf(x)}"><div class="lbl" dir="auto">${esc(x.name)}<span class="sub" dir="auto">${esc(x.moshaf)}${sep()}${esc(t("count.surahs", { n: x.total }))}</span></div>${state.reciters[meta.id]?.server === x.server ? icon("check") : ""}</button>`).join("") || `<div class="empty">${esc(t("common.noResults"))}</div>`; };
      draw(""); $("#rc-q", body).oninput = e => draw(e.target.value.trim());
      $("#rc-list", body).onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; const x = uniq[Number(b.dataset.i)]; state.reciters[meta.id] = x; save(); closeSheet(); then?.(x); };
    } catch (err) { body.innerHTML = `<div class="empty">${esc(t("quran.recitersFailed"))}<br><small>${esc(err.message)}</small></div>`; }
  }
  const surahList = x => String(x.list || "").split(",").map(Number).filter(Boolean);

  // ---------- Mushaf home ----------
  let homeQuery = "";
  async function renderHome() {
    setNav("quran"); setHeader(t("quran.title"), { actions: `<button class="icon-btn" id="q-tr-pick" aria-label="${esc(t("quran.chooseTranslation"))}">${icon("translate")}</button><a class="icon-btn" href="#/offline" aria-label="${esc(t("offline.title"))}">${icon("download")}</a>` });
    const hash = location.hash; view.innerHTML = loading();
    try { await loadIndex(); } catch (e) { return failed(e, renderHome); }
    if (stale(hash)) return;
    $("#q-tr-pick").onclick = () => pickTranslation(renderHome);
    const meta = riw(state.riwayah);
    const cont = state.last && INDEX.riwayat.some(r => r.id === state.last.r) ? state.last : null;
    const bm = state.bookmark && INDEX.riwayat.some(r => r.id === state.bookmark.r) ? state.bookmark : null;
    const pos = (p, label, ic) => `<a class="resume" href="#/quran/${p.r}/${p.s}?a=${p.a}">${icon(ic)}<div><b>${esc(label)}</b><span>${esc(t("quran.position", { surah: surahName(p.s, riw(p.r)), aya: p.a, riwayah: rShort(riw(p.r)) }))}</span></div></a>`;
    view.innerHTML = `
      <div class="chips" role="tablist" aria-label="${esc(t("quran.riwayah"))}">${INDEX.riwayat.map(r => `<button class="chip ${r.id === meta.id ? "on" : ""}" data-r="${r.id}" role="tab" aria-selected="${r.id === meta.id}">${esc(rShort(r))}</button>`).join("")}</div>
      <p class="riwayah-note">${esc(t("quran.riwayahOf", { name: rName(meta) }))}${sep()}${esc(t("count.ayat", { n: meta.ayat }))} <span id="cached"></span></p>
      ${cont || bm ? `<div class="resume-row">${cont ? pos(cont, t("quran.continue"), "book") : ""}${bm ? pos(bm, t("quran.bookmark"), "bookmark") : ""}</div>` : ""}
      <div class="searchbox">${icon("search")}<input id="qq" type="search" placeholder="${esc(t("quran.searchPlaceholder"))}" value="${esc(homeQuery)}" autocomplete="off" enterkeyhint="search"></div>
      <div class="tabs-row"><div class="segmented" id="qtabs"><button data-t="surahs" class="${state.tab === "surahs" ? "on" : ""}">${esc(t("quran.surahs"))}</button><button data-t="juz" class="${state.tab === "juz" ? "on" : ""}">${esc(t("quran.juzs"))}</button></div></div>
      <div id="qlist"></div>`;
    const showSaved = () => { const x = document.getElementById("cached"); if (x) x.innerHTML = `${sep()}${icon("check")} ${esc(t("quran.savedOffline"))}`; };
    isCached(meta).then(c => {
      if (c) return showSaved();
      const x = document.getElementById("cached"); if (!x || !off.isSupported()) return;
      x.innerHTML = ` <button class="link inline" id="save-riw">${icon("download")} ${esc(t("offline.save"))}</button>`;
      $("#save-riw").onclick = async () => { $("#save-riw").textContent = t("offline.saving"); try { await saveRiwayah(meta); showSaved(); toast(t("offline.done")); } catch { toast(t("offline.needOnce")); } };
    });
    view.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { state.riwayah = b.dataset.r; save(); renderHome(); });
    view.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { state.tab = b.dataset.t; save(); view.querySelectorAll("[data-t]").forEach(x => x.classList.toggle("on", x === b)); drawList(); });
    const input = $("#qq"); let timer;
    input.oninput = () => { homeQuery = input.value; clearTimeout(timer); timer = setTimeout(drawList, 200); };
    drawList();

    async function drawList() {
      const box = $("#qlist"); if (!box) return;
      const q = homeQuery.trim(); $("#qtabs").parentElement.hidden = !!q;
      const surahRow = i => { const [, count, page] = meta.surahs[i]; return `<a href="#/quran/${meta.id}/${i + 1}"><div class="num">${num(i + 1)}</div><div class="lbl">${esc(surahName(i + 1, meta))}${isAr() ? "" : ` <span class="ar-name" lang="ar" dir="rtl">${esc(meta.surahs[i][0])}</span>`}<span class="sub">${esc(t("quran.surahMeta", { ayat: t("count.ayat", { n: count }), page }))}</span></div>${icon("back", "chev")}</a>`; };
      if (!q) {
        box.innerHTML = state.tab === "juz"
          ? `<div class="list">${meta.juz.map(([s, a], j) => `<a href="#/quran/${meta.id}/${s}?a=${a}"><div class="num">${num(j + 1)}</div><div class="lbl">${esc(t("quran.juz", { n: j + 1 }))}<span class="sub">${esc(t("quran.juzStart", { surah: surahName(s, meta), aya: a }))}</span></div>${icon("back", "chev")}</a>`).join("")}</div>`
          : `<div class="list">${meta.surahs.map((_, i) => surahRow(i)).join("")}</div>`;
        return;
      }
      const k = quranKey(q); const n = Number(q.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
      const latin = lower(q).normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
      const names = meta.surahs.map((s, i) => i).filter(i => (n >= 1 && n <= 114 && i + 1 === n) || (k && quranKey(meta.surahs[i][0]).includes(k))
        || (latin.length > 1 && lower(meta.surahs[i][3] || "").normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "").includes(latin)));
      let html = names.length ? `<h2 class="section-title">${esc(t("quran.surahs"))}</h2><div class="list">${names.map(i => surahRow(i)).join("")}</div>` : "";
      if (k.length < 3) { box.innerHTML = html || `<div class="empty">${esc(t("quran.typeLonger"))}</div>`; return; }
      box.innerHTML = html + loading(t("quran.searching"));
      let res; try { res = await loadRiwayah(meta.id); } catch (e) { box.innerHTML = html + `<div class="empty">${esc(t("quran.searchLoadFailed"))}</div>`; return; }
      if (homeQuery.trim() !== q || !document.body.contains(box)) return;
      if (!searchIdx.has(meta.id)) searchIdx.set(meta.id, res.data.s.map((ayat, si) => ayat.map((x, ai) => quranKey(res.data.e ? res.data.e[si][ai] : x[0]))));
      const idx = searchIdx.get(meta.id); const hits = [];
      for (let si = 0; si < idx.length && hits.length < 200; si++) for (let ai = 0; ai < idx[si].length; ai++) if (idx[si][ai].includes(k)) hits.push([si, ai]);
      html += `<h2 class="section-title">${esc(hits.length ? (hits.length >= 200 ? t("quran.moreThan", { n: 200 }) : t("count.ayat", { n: hits.length })) : t("quran.noMatches"))}</h2>`;
      if (hits.length) html += `<div class="list hits" style="--qfont:'kfgqpc-${meta.id}'">${hits.slice(0, 60).map(([si, ai]) => `<a href="#/quran/${meta.id}/${si + 1}?a=${ai + 1}"><div class="lbl"><span class="hit-text" lang="ar" dir="rtl">${esc(res.data.s[si][ai][0])}</span><span class="sub">${esc(t("quran.surah", { name: surahName(si + 1, meta) }))}${sep()}${esc(t("quran.ayaRef", { aya: ai + 1, page: res.data.s[si][ai][1] }))}</span></div></a>`).join("")}</div>`;
      if (hits.length > 60) html += `<p class="stat center">${esc(t("quran.showingFirst", { n: 60 }))}</p>`;
      box.innerHTML = html;
    }
  }

  // ---------- reader ----------
  let observer = null;
  async function renderReader(rid, s, params) {
    setNav("quran"); const hash = location.hash;
    s = Math.min(114, Math.max(1, s | 0 || 1));
    setHeader(t("quran.title"), { back: true }); view.innerHTML = loading(t("quran.loadingMushaf"));
    let meta, data;
    try { ({ meta, data } = await loadRiwayah(rid)); } catch (e) { return failed(e, () => renderReader(rid, s, params)); }
    if (stale(hash)) return;
    if (meta.id !== rid) { location.replace(`#/quran/${meta.id}/${s}`); return; }
    if (state.riwayah !== meta.id) { state.riwayah = meta.id; save(); }
    const ayat = data.s[s - 1]; const arName = meta.surahs[s - 1][0]; const name = surahName(s, meta);
    setHeader(t("quran.surah", { name }), { back: true, actions: `<button class="icon-btn" id="q-play" aria-label="${esc(t("quran.listenSurah"))}">${icon("headphones")}</button><button class="icon-btn" id="q-tr" aria-label="${esc(t("quran.chooseTranslation"))}">${icon("translate")}</button><button class="icon-btn" id="q-riw" aria-label="${esc(t("quran.changeRiwayah"))}">${icon("layers")}</button>` });
    const showBasmala = s !== 9 && !(s === 1 && meta.basmalaIsAya);
    const rec = state.reciters[meta.id];
    let lastJuz = s > 1 ? data.s[s - 2].at(-1)[2] : ayat[0][2];
    const bm = state.bookmark;
    const parts = [];
    ayat.forEach(([text, page, juz], i) => {
      if (juz !== lastJuz) { parts.push(`<div class="juz-mark"><span>${esc(t("quran.juz", { n: juz }))}</span></div>`); lastJuz = juz; }
      const marked = bm && bm.r === meta.id && bm.s === s && bm.a === i + 1;
      parts.push(`<div class="aya ${marked ? "bm" : ""}" id="a-${i + 1}" data-a="${i + 1}" data-p="${page}" tabindex="0"><span class="aya-text" lang="ar" dir="rtl">${esc(text)}</span></div>`);
    });
    view.innerHTML = `
      <div class="reader-bar">
        <span class="pill">${esc(t("quran.riwayahOf", { name: rShort(meta) }))}</span><span class="pill ghost">${esc(t("count.ayat", { n: ayat.length }))}</span><span class="pill ghost">${esc(t("quran.page", { n: ayat[0][1] }))}</span>
        <button class="link" id="q-rec">${icon("headphones")} <span dir="auto">${esc(rec ? rec.name : t("quran.chooseReciter"))}</span></button>
      </div>
      <div id="tr-note"></div>
      <article class="mushaf" lang="ar" dir="rtl" style="--qfont:'kfgqpc-${meta.id}'">
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

    const playWith = x => { player.surahs({ server: x.server, list: surahList(x), start: s, sub: `${x.name}${sep()}${rShort(meta)}` }); const b = $("#q-rec"); if (b) b.innerHTML = `${icon("headphones")} <span dir="auto">${esc(x.name)}</span>`; };
    $("#q-play").onclick = () => { const r = state.reciters[meta.id]; r ? playWith(r) : pickReciter(meta, playWith); };
    $("#q-rec").onclick = () => pickReciter(meta, playWith);
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
        if (act.dataset.act === "bm") {
          const on = !(state.bookmark && state.bookmark.r === meta.id && state.bookmark.s === s && state.bookmark.a === n);
          state.bookmark = on ? { r: meta.id, s, a: n } : null; save();
          mushaf.querySelectorAll(".aya.bm").forEach(x => x.classList.remove("bm")); if (on) document.getElementById("a-" + n).classList.add("bm");
          toast(t(on ? "quran.bmSaved" : "quran.bmRemoved")); closeTools(); return;
        }
        if (act.dataset.act === "copy") { copyText(`${plain(n)}\n${ref(n)}`); closeTools(); return; }
        if (act.dataset.act === "share") { share(t("quran.surah", { name }), `${plain(n)}\n${ref(n)}`); closeTools(); return; }
      }
      const aya = e.target.closest(".aya"); if (!aya) return;
      if (window.getSelection && String(window.getSelection()).length) return;
      const open = aya.nextElementSibling?.classList.contains("aya-tools");
      closeTools(); if (open) return;
      aya.classList.add("sel");
      const n = Number(aya.dataset.a); const isBm = state.bookmark && state.bookmark.r === meta.id && state.bookmark.s === s && state.bookmark.a === n;
      aya.insertAdjacentHTML("afterend", `<div class="aya-tools" dir="${document.documentElement.dir}" data-a="${n}"><span class="aya-ref">${esc(t("quran.ayaRef", { aya: n, page: Number(aya.dataset.p) }))}</span><span class="spacer"></span>
        <button class="icon-btn ${isBm ? "active" : ""}" data-act="bm" aria-label="${esc(t(isBm ? "quran.bmRemove" : "quran.bmAdd"))}">${icon("bookmark")}</button>
        <button class="icon-btn" data-act="copy" aria-label="${esc(t("common.copy"))}">${icon("copy")}</button>
        <button class="icon-btn" data-act="share" aria-label="${esc(t("common.share"))}">${icon("share")}</button></div>`);
    });
    mushaf.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("aya")) { e.preventDefault(); e.target.click(); } });
    function closeTools() { mushaf.querySelectorAll(".aya-tools").forEach(x => x.remove()); mushaf.querySelectorAll(".aya.sel").forEach(x => x.classList.remove("sel")); }

    // remember reading position
    observer?.disconnect();
    let saveTimer;
    observer = new IntersectionObserver(entries => {
      const vis = entries.filter(x => x.isIntersecting).map(x => Number(x.target.dataset.a));
      if (!vis.length) return; clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { if (stale(hash)) return; state.last = { r: meta.id, s, a: Math.min(...vis) }; save(); }, 600);
    }, { rootMargin: "-80px 0px -60% 0px" });
    mushaf.querySelectorAll(".aya").forEach(x => observer.observe(x));

    const want = Number(params.get("a"));
    if (want > 1 && want <= ayat.length) {
      const el = document.getElementById("a-" + want);
      requestAnimationFrame(() => { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1800); });
    }
  }

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
    const urls = list.map(n => surahUrl(m.server, n)); const jobId = "rec:" + m.server;
    view.innerHTML = `<div class="hero slim"><h2 dir="auto">${esc(rec.name)}</h2><p dir="auto">${esc(m.name)}${sep()}${esc(t("count.surahs", { n: list.length }))}</p>
        <div class="hero-actions"><button class="btn light" id="play-all">${icon("play")} ${esc(t("listen.playFromStart"))}</button>${off.isSupported() ? ` <button class="btn light" id="dl-all">${icon("download")} ${esc(t("offline.downloadAll"))}</button>` : ""}</div>
        <div class="dl-status" id="dl-status"></div></div>
      <div class="list" id="slist">${list.map(n => `<div class="row split" data-n="${n}" data-playing="surah:${esc(m.server)}:${n}"><button class="row-main" data-play="${n}"><div class="num">${num(n)}</div><div class="lbl">${esc(t("quran.surah", { name: surahName(n) }))}<span class="sub saved-flag" hidden>${icon("check")} ${esc(t("offline.surahSaved"))}</span></div>${icon("play", "chev-play")}</button>${off.isSupported() ? `<button class="icon-btn dl-btn" data-dl="${n}" aria-label="${esc(t("offline.download"))}">${icon("download")}</button>` : ""}</div>`).join("")}</div>`;
    $("#play-all").onclick = () => player.surahs({ server: m.server, list, start: list[0], sub });
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
      const b = e.target.closest("[data-play]"); if (b) player.surahs({ server: m.server, list, start: Number(b.dataset.play), sub });
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
    try { await loadIndex(); } catch (e) { return failed(e, renderOffline); }
    sizes ||= await fetch("data/audio-sizes.json").then(r => r.json()).catch(() => null);
    const lang = getLang(); const fmt = b => off.fmtSize(b, lang);
    const audio = adhkarAudio();
    const trKey = await currentTr(); const tm = await trMeta(trKey);
    const trUrls = trKey ? Array.from({ length: 114 }, (_, i) => trUrl(trKey, i + 1)) : [];
    const recs = LS.get("offline:recs", {});
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
    view.innerHTML = `
      <p class="riwayah-note">${esc(t("offline.intro"))}</p>
      <div class="card"><div class="about">${esc(t("offline.storage", { used: fmt(storage.usage), quota: fmt(storage.quota) }))}<br><small>${esc(t(storage.persisted ? "offline.persisted" : "offline.notPersisted"))}</small></div><div id="job"></div></div>
      <h2 class="section-title">${esc(t("offline.mushaf"))}</h2>
      <div class="card">${INDEX.riwayat.map((r, i) => row(rName(r), esc(t(riwSaved[i] ? "offline.saved" : "offline.notSaved")), "riw:" + r.id, riwSaved[i] ? "full" : false)).join("")}
        ${riwSaved.some(x => !x) ? `<div class="setting"><div class="lbl"></div>${btn("save:riw:all", "offline.saveAll", "download", "")}</div>` : ""}</div>
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
      const [store, urls] = targets[kind] || [];
      if (!store) return;
      if (act === "del") { await off.remove(store, urls); toast(t("offline.deleted")); return renderOffline(); }
      reportJob(await off.download({ id: "off:" + kind, urls, store, concurrency: kind === "tr" ? 4 : 3 }));
    });
  }

  // ---------- radios ----------
  let radioQuery = "";
  async function renderRadio() {
    setNav("listen"); setHeader(t("radio.title")); const hash = location.hash;
    view.innerHTML = listenTabs("radio") + loading(t("radio.fetching"));
    const canHls = !!document.createElement("audio").canPlayType("application/vnd.apple.mpegurl");
    const [live, reciters] = await Promise.all([getLiveRadios().catch(() => []), getReciterRadios().catch(() => null)]);
    if (stale(hash)) return;
    const stationName = r => { const k = "station." + r.id; const v = t(k); return v === k ? r.name : v; };
    const country = r => r.cc ? regionName(r.cc) : t("radio.variety");
    const liveOk = live.filter(r => !r.hls || canHls);
    const c = collator(); const rows = (reciters || []).filter(r => r.url).sort((x, y) => c.compare(x.name, y.name));
    view.innerHTML = listenTabs("radio") + `<div id="radios">
      <h2 class="section-title">${esc(t("radio.live"))}</h2>
      <div class="list" id="live">${liveOk.map(r => `<button class="row" data-id="live:${r.id}" data-playing="radio:live:${r.id}"><div class="num">${icon("radio")}</div><div class="lbl">${esc(stationName(r))}<span class="sub">${esc(t("radio.liveSub", { country: country(r) }))}</span></div>${icon("play", "chev-play")}</button>`).join("")}</div>
      <h2 class="section-title">${esc(t("radio.reciters"))}</h2>
      ${reciters ? `<div class="searchbox">${icon("search")}<input id="radq" type="search" placeholder="${esc(t("radio.search"))}" value="${esc(radioQuery)}" autocomplete="off"></div><div class="list" id="rlist"></div>` : `<div class="empty">${esc(t("radio.listFailed"))}</div>`}
      <p class="source-note">${esc(t("radio.sourceNote"))}</p></div>`;
    const byId = new Map(); liveOk.forEach(r => byId.set("live:" + r.id, { id: "live:" + r.id, url: r.url, name: stationName(r), sub: t("radio.liveSub", { country: country(r) }) }));
    rows.forEach(r => byId.set("rad:" + r.id, { id: "rad:" + r.id, url: r.url, name: r.name, sub: t("radio.mp3quran") }));
    const draw = () => { const q = lower(radioQuery.trim()); const box = $("#rlist"); if (!box) return; box.innerHTML = rows.filter(r => !q || lower(r.name).includes(q)).map(r => `<button class="row" data-id="rad:${r.id}" data-playing="radio:rad:${r.id}"><div class="num">${icon("radio")}</div><div class="lbl" dir="auto">${esc(r.name)}</div>${icon("play", "chev-play")}</button>`).join("") || `<div class="empty">${esc(t("common.noResults"))}</div>`; player.refresh(); };
    draw(); const qi = $("#radq"); if (qi) qi.oninput = () => { radioQuery = qi.value; draw(); };
    $("#radios").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b && byId.has(b.dataset.id)) player.radio(byId.get(b.dataset.id)); });
    player.refresh();
  }

  return {
    quran(parts, params) { return parts.length ? renderReader(parts[0], Number(parts[1]), params) : renderHome(); },
    listen: renderListen, radio: renderRadio, offline: renderOffline, player, sheet, closeSheet,
    pickTranslation, translationLabel: async () => trLabel(await trMeta(await currentTr())),
  };
}
