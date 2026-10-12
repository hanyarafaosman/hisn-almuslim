/* ===== حصن المسلم — application logic (vanilla ES module, no dependencies) ===== */
import { setupQuran } from "./quran.js?v=1.1.1";

// ---------- storage ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode etc. */ } },
};
const DEFAULTS = { theme: "auto", scale: 1, vibrate: true, tashkeel: true, autoNext: true, wakeLock: false };
const settings = Object.assign({}, DEFAULTS, LS.get("settings", {}));
const saveSettings = () => LS.set("settings", settings);

const favorites = new Set(LS.get("favorites", []));
const saveFav = () => LS.set("favorites", [...favorites]);

const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
let progress = LS.get("progress", null);
if (!progress || progress.date !== todayKey()) progress = { date: todayKey(), counts: {} };
const saveProgress = () => LS.set("progress", progress);

const tasbih = Object.assign({ count: 0, target: 33, total: 0, phrase: 0 }, LS.get("tasbih", {}));
const saveTasbih = () => LS.set("tasbih", tasbih);

// ---------- DOM helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const view = $("#view"), titleEl = $("#title"), actionsEl = $("#actions"), backBtn = $("#btn-back"), toastEl = $("#toast"), audio = $("#audio");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (n, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const vibrate = (ms = 12) => { if (settings.vibrate && navigator.vibrate) navigator.vibrate(ms); };
const toArabicNum = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);

let toastTimer;
function toast(msg, action) {
  toastEl.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : "");
  if (action) $("button", toastEl).onclick = () => { action.fn(); toastEl.hidden = true; };
  toastEl.hidden = false; clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, action ? 8000 : 2200);
}

// ---------- text helpers ----------
const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const stripTashkeel = s => s.replace(TASHKEEL, "");
const normalizeSearch = s => stripTashkeel(s).replace(/[إأآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().toLowerCase();

function formatText(t) {
  if (!settings.tashkeel) t = stripTashkeel(t);
  t = esc(t);
  t = t.replace(/\(\(/g, "«").replace(/\)\)/g, "»");
  t = t.replace(/﴿([^﴾]+)﴾/g, (_, q) => `<span class="q">﴿${q.replace(/\s*\*\s*/g, " ۝ ")}﴾</span>`);
  t = t.replace(/\[([^\]]+)\]/g, '<span class="n">$1</span>');
  t = t.replace(/\((?:[^()]{1,40})\)/g, m => /مر|مرا|ثلاث|أربع|عشر|مائة|سبع/.test(m) ? `<span class="r">${m}</span>` : m);
  return t;
}
const plainText = t => t.replace(/\(\(/g, "«").replace(/\)\)/g, "»");

// ---------- data ----------
let DB = null; const catById = new Map(); const sectionOfCat = new Map();
async function loadData() {
  const res = await fetch("data/hisn.json"); DB = await res.json();
  DB.categories.forEach(c => catById.set(c.id, c));
  DB.sections.forEach(s => s.cats.forEach(id => sectionOfCat.set(id, s)));
}

const itemKey = (cat, item, period) => `${cat.id}:${item.id}` + (cat.id === 27 ? `:${period || currentPeriod()}` : "");
let periodOverride = null;
const currentPeriod = () => periodOverride || ((h => h >= 4 && h < 15)(new Date().getHours()) ? "morning" : "evening");
const getCount = key => progress.counts[key] || 0;
function catProgress(cat, period) {
  const total = cat.items.reduce((a, i) => a + i.repeat, 0);
  const done = cat.items.reduce((a, i) => a + Math.min(i.repeat, getCount(itemKey(cat, i, period))), 0);
  return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
}

// ---------- theme ----------
function applyTheme() {
  const t = settings.theme;
  if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
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
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && location.hash.startsWith("#/cat/")) updateWakeLock(true); });

// ---------- audio ----------
let playingBtn = null;
function togglePlay(url, btn) {
  if (playingBtn === btn && !audio.paused) { audio.pause(); return; }
  if (!navigator.onLine && !audio.src.includes(url)) { toast("تشغيل الصوت يحتاج اتصالًا بالإنترنت"); }
  if (playingBtn) setPlaying(playingBtn, false);
  document.getElementById("qaudio")?.pause();
  playingBtn = btn; audio.src = url; audio.play().then(() => setPlaying(btn, true)).catch(() => { toast("تعذّر تشغيل الصوت"); setPlaying(btn, false); playingBtn = null; });
}
function setPlaying(btn, on) { btn.classList.toggle("playing", on); btn.innerHTML = icon(on ? "pause" : "play"); btn.setAttribute("aria-label", on ? "إيقاف" : "استماع"); }
audio.addEventListener("pause", () => { if (playingBtn) setPlaying(playingBtn, false); });
audio.addEventListener("ended", () => { if (playingBtn) setPlaying(playingBtn, false); playingBtn = null; });
audio.addEventListener("error", () => { if (playingBtn) { setPlaying(playingBtn, false); playingBtn = null; toast("تعذّر تحميل الصوت"); } });
const stopAudio = () => { if (!audio.paused) audio.pause(); playingBtn = null; };

// ---------- share / copy ----------
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast("تم النسخ"); }
  catch { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("تم النسخ"); } catch { toast("تعذّر النسخ"); } ta.remove(); }
}
async function shareText(title, t) {
  if (navigator.share) { try { await navigator.share({ title, text: `${t}\n\n— ${title} | حصن المسلم` }); } catch { /* cancelled */ } }
  else copyText(`${t}\n\n— ${title} | حصن المسلم`);
}

// ---------- Mushaf / listening / radios ----------
const Q = setupQuran({
  view, $, esc, icon, toast, ar: toArabicNum, LS, copyText,
  setHeader: (...a) => setHeader(...a), setNav: n => setNav(n),
  share: async (title, text) => { if (navigator.share) { try { await navigator.share({ title, text }); } catch { /* cancelled */ } } else copyText(text); },
});

// ---------- router ----------
function setHeader(title, { back = false, actions = "" } = {}) {
  titleEl.textContent = title; backBtn.hidden = !back; actionsEl.innerHTML = actions;
  document.title = title === "حصن المسلم" ? title : `${title} — حصن المسلم`;
}
backBtn.addEventListener("click", () => { if (history.length > 1) history.back(); else location.hash = "#/"; });
function setNav(name) { document.querySelectorAll(".bottom-nav a").forEach(a => a.classList.toggle("on", a.dataset.nav === name)); }

const scrollPos = {};
function route() {
  const h = location.hash || "#/"; const [path, qs] = h.slice(1).split("?"); const parts = path.split("/").filter(Boolean); const params = new URLSearchParams(qs || "");
  stopAudio(); updateWakeLock(parts[0] === "cat" || (parts[0] === "quran" && parts.length > 1)); view.scrollTop = 0; window.scrollTo(0, 0);
  if (!parts.length) return renderHome(params.get("q") || "");
  switch (parts[0]) {
    case "section": return renderSection(parts[1]);
    case "cat": return renderCategory(Number(parts[1]));
    case "fav": return renderFavorites();
    case "tasbih": return renderTasbih();
    case "settings": return renderSettings();
    case "quran": return Q.quran(parts.slice(1), params);
    case "listen": return Q.listen(parts.slice(1), params);
    case "radio": return Q.radio();
    case "search": return renderHome(params.get("q") || "");
    default: location.hash = "#/";
  }
}
window.addEventListener("hashchange", route);

// ---------- views ----------
function renderHome(q = "") {
  setNav("home"); setHeader("حصن المسلم", { actions: `<a class="icon-btn" href="#/fav" aria-label="المفضلة">${icon("star")}</a><button class="icon-btn" id="a-search" aria-label="بحث">${icon("search")}</button>` });
  const period = currentPeriod(); const h = new Date().getHours();
  const greet = h < 12 ? "صباح الخير" : h < 18 ? "مساء الخير" : "ليلة مباركة";
  const p27 = catProgress(catById.get(27), period), p28 = catProgress(catById.get(28)), p1 = catProgress(catById.get(1));
  const quick = (id, label, ic, p) => `<a href="#/cat/${id}">${icon(ic)}<span>${label}</span><span class="pct">${p.pct ? toArabicNum(p.pct) + "٪" : ""}</span></a>`;
  view.innerHTML = `
    <section class="hero">
      <h2>${greet}</h2>
      <p>«فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ»</p>
      <div class="quick">
        ${quick(27, period === "morning" ? "أذكار الصباح" : "أذكار المساء", period === "morning" ? "sun" : "moon", p27)}
        ${quick(28, "أذكار النوم", "bed", p28)}
        ${quick(1, "أذكار الاستيقاظ", "sun", p1)}
        ${quick(25, "أذكار بعد الصلاة", "prayer", catProgress(catById.get(25)))}
      </div>
    </section>
    <div class="searchbox">${icon("search")}<input id="q" type="search" placeholder="ابحث في الأذكار…" value="${esc(q)}" autocomplete="off" enterkeyhint="search"></div>
    <div id="results"></div>`;
  const input = $("#q"), results = $("#results");
  const renderSections = () => {
    results.innerHTML = `<h2 class="section-title">الأبواب</h2><div class="grid">` + DB.sections.map(s =>
      `<a class="tile" href="#/section/${s.id}"><div class="ic">${icon(s.icon)}</div><div class="t">${esc(s.title)}</div><div class="c">${toArabicNum(s.cats.length)} باب</div></a>`).join("") + `</div>`;
  };
  const doSearch = () => {
    const nq = normalizeSearch(input.value); if (nq.length < 2) return renderSections();
    const hits = []; const terms = nq.split(" ");
    DB.categories.forEach(c => {
      const ct = normalizeSearch(c.title); if (terms.every(t => ct.includes(t))) hits.push({ c });
      c.items.forEach(i => { const it = normalizeSearch(i.text); if (terms.every(t => it.includes(t))) hits.push({ c, i }); });
    });
    if (!hits.length) { results.innerHTML = `<div class="empty">${icon("search")}<div>لا توجد نتائج لـ «${esc(input.value)}»</div></div>`; return; }
    results.innerHTML = `<h2 class="section-title">${toArabicNum(hits.length)} نتيجة</h2><div class="list">` + hits.slice(0, 60).map(({ c, i }) =>
      `<a href="#/cat/${c.id}${i ? "?item=" + i.id : ""}"><div class="num">${icon("book")}</div><div class="lbl">${esc(c.title)}${i ? `<span class="sub">${esc(stripTashkeel(plainText(i.text))).slice(0, 90)}…</span>` : ""}</div>${icon("back", "chev")}</a>`).join("") + `</div>`;
  };
  input.addEventListener("input", doSearch); doSearch();
  $("#a-search").onclick = () => { input.focus(); input.scrollIntoView({ behavior: "smooth", block: "start" }); };
}

function renderSection(id) {
  const s = DB.sections.find(x => x.id === id); if (!s) { location.hash = "#/"; return; }
  setNav("home"); setHeader(s.title, { back: true });
  view.innerHTML = `<div class="list">` + s.cats.map((cid, n) => { const c = catById.get(cid); const p = catProgress(c);
    return `<a href="#/cat/${c.id}"><div class="num">${toArabicNum(n + 1)}</div><div class="lbl">${esc(c.title)}<span class="sub">${toArabicNum(c.items.length)} ${c.items.length === 1 ? "ذكر" : c.items.length <= 10 ? "أذكار" : "ذكرًا"}${p.pct === 100 ? "، ✓ مكتمل" : ""}</span></div>${icon("back", "chev")}</a>`; }).join("") + `</div>`;
}

function dhikrCard(cat, item, { showWhere = false } = {}) {
  const key = itemKey(cat, item); const n = getCount(key); const done = n >= item.repeat; const fav = favorites.has(`${cat.id}:${item.id}`);
  return `<article class="dhikr ${done ? "done" : ""}" data-key="${key}" data-cat="${cat.id}" data-item="${item.id}" id="item-${item.id}">
    ${showWhere ? `<div class="where" style="padding-top:12px">${icon("book")} ${esc(cat.title)}</div>` : ""}
    <div class="dhikr-text" role="button" tabindex="0" aria-label="اضغط للعدّ">${formatText(item.text)}</div>
    <div class="dhikr-bar">
      <button class="count-btn" type="button" aria-label="عدّ"><span class="big">${done ? icon("check") : toArabicNum(item.repeat - n)}</span>${item.repeat > 1 ? `<span class="of">/ ${toArabicNum(item.repeat)}</span>` : ""}</button>
      <span class="spacer"></span>
      <button class="icon-btn ${fav ? "active" : ""}" data-act="fav" type="button" aria-label="${fav ? "إزالة من المفضلة" : "إضافة للمفضلة"}">${icon(fav ? "star-f" : "star")}</button>
      <button class="icon-btn" data-act="copy" type="button" aria-label="نسخ">${icon("copy")}</button>
      <button class="icon-btn" data-act="share" type="button" aria-label="مشاركة">${icon("share")}</button>
      ${item.audio ? `<button class="icon-btn" data-act="play" type="button" aria-label="استماع">${icon("play")}</button>` : ""}
    </div>
  </article>`;
}

function bindCards(root, onCount) {
  root.addEventListener("click", e => {
    const card = e.target.closest(".dhikr"); if (!card) return;
    const cat = catById.get(Number(card.dataset.cat)); const item = cat.items.find(i => i.id === Number(card.dataset.item));
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "fav") {
      const k = `${cat.id}:${item.id}`; const btn = e.target.closest("[data-act]");
      if (favorites.has(k)) { favorites.delete(k); toast("أُزيل من المفضلة"); } else { favorites.add(k); toast("أُضيف إلى المفضلة"); }
      saveFav(); btn.classList.toggle("active", favorites.has(k)); btn.innerHTML = icon(favorites.has(k) ? "star-f" : "star"); return;
    }
    if (act === "copy") return copyText(plainText(item.text));
    if (act === "share") return shareText(cat.title, plainText(item.text));
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
  $(".count-btn .big", card).innerHTML = done ? icon("check") : toArabicNum(item.repeat - n);
  if (done && settings.autoNext) { const next = card.nextElementSibling; if (next && next.classList.contains("dhikr")) setTimeout(() => next.scrollIntoView({ behavior: "smooth", block: "center" }), 250); }
  onCount && onCount(done);
}

function renderCategory(id) {
  const cat = catById.get(id); if (!cat) { location.hash = "#/"; return; }
  setNav("home");
  const is27 = cat.id === 27;
  setHeader(cat.title, { back: true, actions: `${cat.audio ? `<button class="icon-btn" id="a-audio" aria-label="استماع للباب كاملًا">${icon("play")}</button>` : ""}<button class="icon-btn" id="a-reset" aria-label="إعادة العدّ">${icon("reset")}</button>` });
  const draw = () => {
    const p = catProgress(cat);
    view.innerHTML = `
      ${is27 ? `<div style="text-align:center"><div class="segmented" role="tablist">
        <button role="tab" data-p="morning" class="${currentPeriod() === "morning" ? "on" : ""}">${icon("sun")} الصباح</button>
        <button role="tab" data-p="evening" class="${currentPeriod() === "evening" ? "on" : ""}">${icon("moon")} المساء</button></div></div>` : ""}
      <div class="progress-row"><div class="progress"><div style="width:${p.pct}%"></div></div><span id="pct">${toArabicNum(p.pct)}٪</span></div>
      <div id="cards">${cat.items.map(i => dhikrCard(cat, i)).join("")}</div>
      <div id="finish" class="finish" ${p.pct === 100 ? "" : "hidden"}>${icon("check")}تقبّل الله منك، أتممت ${esc(cat.title)}</div>`;
    const cards = $("#cards");
    bindCards(cards, () => { const p2 = catProgress(cat); $(".progress > div").style.width = p2.pct + "%"; $("#pct").textContent = toArabicNum(p2.pct) + "٪"; $("#finish").hidden = p2.pct !== 100; if (p2.pct === 100) vibrate([40, 60, 40]); });
    if (is27) view.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { periodOverride = b.dataset.p; draw(); });
  };
  draw();
  const want = new URLSearchParams((location.hash.split("?")[1]) || "").get("item");
  if (want) { const el = document.getElementById("item-" + want); if (el) setTimeout(() => { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.style.outline = "2px solid var(--accent)"; setTimeout(() => el.style.outline = "", 1800); }, 60); }
  $("#a-reset").onclick = () => { cat.items.forEach(i => { delete progress.counts[itemKey(cat, i)]; }); saveProgress(); draw(); toast("أُعيد العدّ"); };
  const ab = $("#a-audio"); if (ab) ab.onclick = () => togglePlay(cat.audio, ab);
}

function renderFavorites() {
  setNav("home"); setHeader("المفضلة", { back: true });
  const keys = [...favorites].map(k => k.split(":").map(Number)).map(([c, i]) => ({ cat: catById.get(c), item: catById.get(c)?.items.find(x => x.id === i) })).filter(x => x.cat && x.item);
  if (!keys.length) { view.innerHTML = `<div class="empty">${icon("star")}<div>لم تُضف شيئًا بعد.<br>اضغط ☆ على أي ذكر لحفظه هنا.</div></div>`; return; }
  view.innerHTML = `<div id="cards">${keys.map(({ cat, item }) => dhikrCard(cat, item, { showWhere: true })).join("")}</div>`;
  bindCards($("#cards"));
}

const PHRASES = ["سُبْحَانَ اللَّهِ", "الْحَمْدُ لِلَّهِ", "اللَّهُ أَكْبَرُ", "لَا إِلَهَ إِلَّا اللَّهُ", "أَسْتَغْفِرُ اللَّهَ", "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ"];
function renderTasbih() {
  setNav("tasbih"); setHeader("السبحة", { actions: `<button class="icon-btn" id="a-reset" aria-label="تصفير">${icon("reset")}</button>` });
  const draw = () => {
    view.innerHTML = `<section class="tasbih">
      <div class="phrases">${PHRASES.map((p, i) => `<button class="chip ${tasbih.phrase === i ? "on" : ""}" data-ph="${i}">${p}</button>`).join("")}</div>
      <button class="big-btn" id="tap" type="button" aria-label="سبّح"><div><div class="num">${toArabicNum(tasbih.count)}</div><div class="lbl">${tasbih.target ? `الهدف ${toArabicNum(tasbih.target)}` : "بلا حدّ"}</div></div></button>
      <div class="targets">${[33, 100, 1000, 0].map(t => `<button class="chip ${tasbih.target === t ? "on" : ""}" data-t="${t}">${t ? toArabicNum(t) : "∞"}</button>`).join("")}</div>
      <p class="stat">المجموع الكلي: ${toArabicNum(tasbih.total)}</p>
    </section>`;
    $("#tap").onclick = () => {
      tasbih.count++; tasbih.total++;
      if (tasbih.target && tasbih.count >= tasbih.target) { vibrate([40, 60, 40]); toast(`أتممت ${toArabicNum(tasbih.target)}`); tasbih.count = 0; } else vibrate(10);
      saveTasbih(); $(".num").textContent = toArabicNum(tasbih.count); $(".stat").textContent = `المجموع الكلي: ${toArabicNum(tasbih.total)}`;
    };
    view.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { tasbih.target = Number(b.dataset.t); tasbih.count = 0; saveTasbih(); draw(); });
    view.querySelectorAll("[data-ph]").forEach(b => b.onclick = () => { tasbih.phrase = Number(b.dataset.ph); saveTasbih(); draw(); });
  };
  draw();
  $("#a-reset").onclick = () => { tasbih.count = 0; saveTasbih(); $(".num").textContent = "٠"; toast("تم التصفير"); };
}
document.addEventListener("keydown", e => { if (e.code === "Space" && location.hash === "#/tasbih" && !e.target.closest("button,input")) { e.preventDefault(); $("#tap")?.click(); } });

let installPrompt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; if (location.hash === "#/settings") renderSettings(); });
function renderSettings() {
  setNav("settings"); setHeader("الإعدادات");
  const sw = (key, label, small, ic) => `<div class="setting"><span class="ic">${icon(ic)}</span><div class="lbl">${label}<small>${small}</small></div><button class="switch ${settings[key] ? "on" : ""}" data-sw="${key}" role="switch" aria-checked="${!!settings[key]}" aria-label="${label}"></button></div>`;
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  view.innerHTML = `
    ${!standalone ? `<div class="card"><div class="setting"><span class="ic">${icon("install")}</span><div class="lbl">تثبيت التطبيق<small>${installPrompt ? "ثبّته على جهازك ليعمل دون اتصال" : "من قائمة المتصفح: «إضافة إلى الشاشة الرئيسية» أو «تثبيت»"}</small></div>${installPrompt ? `<button class="btn" id="install">تثبيت</button>` : ""}</div></div>` : ""}
    <h2 class="section-title">المظهر</h2>
    <div class="card">
      <div class="setting"><span class="ic">${icon("moon")}</span><div class="lbl">السمة</div><div class="segmented">${[["auto", "تلقائي"], ["light", "فاتح"], ["dark", "داكن"]].map(([v, l]) => `<button data-theme="${v}" class="${settings.theme === v ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <div class="setting"><span class="ic">${icon("book")}</span><div class="lbl">حجم الخط</div><button class="icon-btn" data-scale="-1" aria-label="تصغير">${icon("minus")}</button><input class="range" id="scale" type="range" min="0.8" max="1.8" step="0.05" value="${settings.scale}" aria-label="حجم الخط"><button class="icon-btn" data-scale="1" aria-label="تكبير">${icon("plus")}</button></div>
      <div class="preview">«سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ»</div>
    </div>
    <h2 class="section-title">القراءة والعدّ</h2>
    <div class="card">
      ${sw("tashkeel", "إظهار التشكيل", "إخفاؤه يسهّل القراءة السريعة", "book")}
      ${sw("vibrate", "الاهتزاز عند العدّ", "اهتزاز خفيف عند كل ضغطة (إن دعمه الجهاز)", "settings")}
      ${sw("autoNext", "الانتقال التلقائي", "التمرير إلى الذكر التالي بعد إتمام العدّ", "back")}
      ${sw("wakeLock", "إبقاء الشاشة مضاءة", "أثناء قراءة الأذكار", "sun")}
    </div>
    <h2 class="section-title">البيانات</h2>
    <div class="card">
      <div class="setting"><div class="lbl">إعادة عدّ اليوم<small>يُصفَّر العدّ تلقائيًا كل يوم جديد</small></div><button class="btn ghost" id="reset-progress">إعادة</button></div>
      <div class="setting"><div class="lbl">مسح المفضلة<small>${toArabicNum(favorites.size)} عنصر</small></div><button class="btn danger" id="clear-fav">مسح</button></div>
    </div>
    <h2 class="section-title">عن التطبيق</h2>
    <div class="card"><div class="about">
      <b>حصن المسلم من أذكار الكتاب والسنة</b><br>تأليف الشيخ سعيد بن علي بن وهف القحطاني رحمه الله.<br>
      النصوص مأخوذة من الموقع الرسمي للكتاب <a href="${esc(DB.sourceUrl)}" target="_blank" rel="noopener" style="color:var(--primary)">hisnmuslim.com</a>، وتضم ${toArabicNum(DB.categories.length)} بابًا و${toArabicNum(DB.categories.reduce((a, c) => a + c.items.length, 0))} ذكرًا.<br>
      يعمل التطبيق دون اتصال بالإنترنت بعد أول فتح، ولا يجمع أي بيانات.
    </div><div class="about">
      <b>المصحف الشريف</b><br>نص المصحف وخطوطه بثماني روايات من <b>مجمع الملك فهد لطباعة المصحف الشريف</b>، تُعرض كما هي دون أي تعديل: حفص وشعبة عن عاصم، وورش وقالون عن نافع، والدوري والسوسي عن أبي عمرو، والبزي وقنبل عن ابن كثير.<br>
      تُحفظ كل رواية على الجهاز بعد أول فتح لها لتُقرأ دون اتصال.
    </div><div class="about">
      <b>الاستماع والإذاعات</b><br>التلاوات وإذاعات القرّاء من موقع <a href="https://mp3quran.net" target="_blank" rel="noopener" style="color:var(--primary)">mp3quran.net</a>، والإذاعات المباشرة من مصادرها الرسمية. تحتاج اتصالًا بالإنترنت.
      <br><small>الإصدار 1.1.0</small>
    </div></div>`;
  view.querySelectorAll("[data-sw]").forEach(b => b.onclick = () => { settings[b.dataset.sw] = !settings[b.dataset.sw]; saveSettings(); b.classList.toggle("on"); b.setAttribute("aria-checked", settings[b.dataset.sw]); if (b.dataset.sw === "vibrate") vibrate(20); });
  view.querySelectorAll("[data-theme]").forEach(b => b.onclick = () => { settings.theme = b.dataset.theme; saveSettings(); applyTheme(); view.querySelectorAll("[data-theme]").forEach(x => x.classList.toggle("on", x === b)); });
  const range = $("#scale"); const setScale = v => { settings.scale = Math.min(1.8, Math.max(0.8, Math.round(v * 20) / 20)); range.value = settings.scale; saveSettings(); applyTheme(); };
  range.oninput = () => setScale(Number(range.value));
  view.querySelectorAll("[data-scale]").forEach(b => b.onclick = () => setScale(settings.scale + 0.1 * Number(b.dataset.scale)));
  $("#reset-progress").onclick = () => { progress = { date: todayKey(), counts: {} }; saveProgress(); toast("أُعيد عدّ اليوم"); };
  $("#clear-fav").onclick = () => { if (!favorites.size) return toast("المفضلة فارغة"); if (confirm("مسح كل المفضلة؟")) { favorites.clear(); saveFav(); renderSettings(); toast("تم المسح"); } };
  const ib = $("#install"); if (ib) ib.onclick = async () => { installPrompt.prompt(); const { outcome } = await installPrompt.userChoice; if (outcome === "accepted") { installPrompt = null; renderSettings(); } };
}

// ---------- service worker ----------
function registerSW() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  // On the local dev server, skip the cache so edits show up immediately (add ?sw to test offline mode locally).
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !location.search.includes("sw")) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    return;
  }
  navigator.serviceWorker.register("sw.js").then(reg => {
    reg.addEventListener("updatefound", () => { const nw = reg.installing; nw?.addEventListener("statechange", () => {
      if (nw.state === "installed" && navigator.serviceWorker.controller) toast("يتوفر تحديث جديد", { label: "تحديث", fn: () => nw.postMessage("SKIP_WAITING") });
    }); });
  }).catch(() => {});
  let refreshing = false; navigator.serviceWorker.addEventListener("controllerchange", () => { if (!refreshing) { refreshing = true; location.reload(); } });
}

// ---------- boot ----------
applyTheme();
loadData().then(() => { route(); registerSW(); }).catch(err => {
  view.innerHTML = `<div class="empty">تعذّر تحميل البيانات.<br><small>${esc(err.message)}</small><br><br><button class="btn" onclick="location.reload()">إعادة المحاولة</button></div>`;
});
