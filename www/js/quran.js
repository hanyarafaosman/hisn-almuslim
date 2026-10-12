/* ===== المصحف بالروايات + الاستماع + الإذاعات ===== */
// Quran text and fonts: King Fahd Glorious Quran Printing Complex (KFGQPC), shown verbatim.
// Recitations and reciter radios: mp3quran.net API. Live stations: data/radios.json (verified list).

const API = "https://www.mp3quran.net/api/v3";
const AYA_NUM = /[\s ]*[٠-٩]+[\s ]*$/;
const MARKS = /[ؐ-ًؚ-ٟۖ-ۭـ࣓-ࣿ]/g;

// Search key: ignores diacritics, Uthmani spelling of alef (dagger alef, alef after waw) and spaces.
export const quranKey = s => s.normalize("NFC").replace(AYA_NUM, "")
  .replace(/وٰ/g, "ا").replace(/ىٰ/g, "ى").replace(/ٰ/g, "ا").replace(/ۧ/g, "ي").replace(MARKS, "")
  .replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
  .replace(/[^ء-ي]/g, "").replace(/ا/g, "");


// Arabic counted noun: 1 سورة، 2 سورتان، 3-10 سور، 11+ سورة
const plural = (n, one, two, few) => n === 2 ? two : n >= 3 && n <= 10 ? few : one;

export function setupQuran(ctx) {
  const { view, $, esc, icon, toast, ar, setHeader, setNav, LS, copyText, share } = ctx;
  const state = Object.assign({ riwayah: "hafs", last: null, bookmark: null, reciters: {}, tab: "surahs" }, LS.get("quran", {}));
  const save = () => LS.set("quran", state);
  const stale = hash => location.hash !== hash; // user navigated away while we were loading

  // ---------- data ----------
  let INDEX = null; const dataCache = new Map(); const fontsReady = new Map(); const searchIdx = new Map();
  async function loadIndex() {
    if (!INDEX) { const r = await fetch("quran/index.json"); if (!r.ok) throw new Error("HTTP " + r.status); INDEX = await r.json(); }
    return INDEX;
  }
  const riw = id => INDEX.riwayat.find(r => r.id === id) || INDEX.riwayat[0];
  const surahName = n => INDEX ? INDEX.riwayat[0].surahs[n - 1][0] : `سورة ${ar(n)}`;
  function loadFont(meta) {
    if (!fontsReady.has(meta.id)) {
      const ff = new FontFace(`kfgqpc-${meta.id}`, `url(${meta.font}) format("woff2")`, { display: "block" });
      fontsReady.set(meta.id, ff.load().then(f => { document.fonts.add(f); }).catch(() => { fontsReady.delete(meta.id); toast("تعذّر تحميل خط المصحف، يُعرض بخط بديل"); }));
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

  const loading = (msg = "جارٍ التحميل…") => `<div class="empty"><div class="spinner"></div><div>${msg}</div></div>`;
  const failed = (err, retry) => { view.innerHTML = `<div class="empty">تعذّر التحميل.<br><small>${esc(err.message || err)}</small><br><br><button class="btn" id="retry">إعادة المحاولة</button></div>`; $("#retry").onclick = retry; };

  // ---------- bottom sheet ----------
  function sheet(title, bodyHtml) {
    closeSheet();
    const wrap = document.createElement("div"); wrap.className = "sheet-backdrop"; wrap.id = "sheet";
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="إغلاق">${icon("close")}</button></div><div class="sheet-body">${bodyHtml}</div></div>`;
    wrap.addEventListener("click", e => { if (e.target === wrap || e.target.closest("[data-close]")) closeSheet(); });
    document.body.appendChild(wrap); document.body.classList.add("no-scroll");
    return $(".sheet-body", wrap);
  }
  function closeSheet() { const s = document.getElementById("sheet"); if (s) s.remove(); document.body.classList.remove("no-scroll"); }
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
  window.addEventListener("hashchange", closeSheet);

  // ---------- mp3quran API (cached in memory, last copy kept for offline listing) ----------
  const apiCache = new Map();
  async function api(path) {
    if (apiCache.has(path)) return apiCache.get(path);
    const p = fetch(API + path).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(j => { LS.set("api:" + path, j); return j; })
      .catch(err => { apiCache.delete(path); const old = LS.get("api:" + path, null); if (old) return old; throw err; });
    apiCache.set(path, p); return p;
  }
  const getRiwayatList = () => api("/riwayat?language=ar").then(j => j.riwayat);
  const getReciters = rewaya => api(`/reciters?language=ar&rewaya=${rewaya}`).then(j => j.reciters);
  const getReciterRadios = () => api("/radios?language=ar").then(j => j.radios);
  let liveRadios = null;
  const getLiveRadios = async () => liveRadios || (liveRadios = await fetch("data/radios.json").then(r => r.json()).then(j => j.live));

  // ---------- persistent audio player ----------
  const player = (() => {
    const el = document.getElementById("player"), a = document.getElementById("qaudio");
    const btn = $("#pl-toggle", el), t1 = $(".pl-title", el), t2 = $(".pl-sub", el), prev = $("#pl-prev", el), next = $("#pl-next", el);
    let q = null;
    const pad = n => String(n).padStart(3, "0");
    const url = () => q.type === "radio" ? q.url : `${q.server}${pad(q.list[q.idx])}.mp3`;
    const title = () => q.type === "radio" ? q.name : `سورة ${surahName(q.list[q.idx])}`;
    function render() {
      el.hidden = !q; document.body.classList.toggle("has-player", !!q); if (!q) return;
      t1.textContent = title(); t2.textContent = q.sub || "";
      const surahs = q.type === "surahs"; prev.hidden = next.hidden = !surahs;
      if (surahs) { prev.disabled = q.idx <= 0; next.disabled = q.idx >= q.list.length - 1; }
      btn.innerHTML = icon(a.paused ? "play" : "pause"); btn.setAttribute("aria-label", a.paused ? "تشغيل" : "إيقاف مؤقت");
      document.querySelectorAll("[data-playing]").forEach(x => x.classList.toggle("on", x.dataset.playing === key()));
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: title(), artist: q.sub || "", album: "حصن المسلم", artwork: [{ src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }] });
      }
    }
    function start() {
      document.getElementById("audio")?.pause();
      el.classList.add("loading"); a.src = url();
      a.play().catch(() => { el.classList.remove("loading"); toast(q.type === "radio" ? "تعذّر تشغيل الإذاعة، قد تكون متوقفة حاليًا" : "تعذّر تشغيل التلاوة"); render(); });
      render();
    }
    function step(d) { if (q?.type !== "surahs") return; const i = q.idx + d; if (i < 0 || i >= q.list.length) return; q.idx = i; start(); }
    const key = () => !q ? "" : q.type === "radio" ? "radio:" + q.id : `surah:${q.server}:${q.list[q.idx]}`;
    a.addEventListener("playing", () => { el.classList.remove("loading"); render(); });
    a.addEventListener("waiting", () => el.classList.add("loading"));
    a.addEventListener("pause", render);
    a.addEventListener("ended", () => { if (q?.type === "surahs" && q.idx < q.list.length - 1) step(1); else render(); });
    a.addEventListener("error", () => { if (!q || !a.getAttribute("src")) return; el.classList.remove("loading"); toast(q.type === "radio" ? "تعذّر تشغيل الإذاعة، قد تكون متوقفة حاليًا" : "تعذّر تحميل التلاوة"); render(); });
    btn.onclick = () => { if (!q) return; if (a.paused) { if (q.type === "radio") start(); else a.play().catch(() => {}); } else a.pause(); };
    prev.onclick = () => step(-1); next.onclick = () => step(1);
    $("#pl-close", el).onclick = () => { a.pause(); a.removeAttribute("src"); a.load(); q = null; render(); };
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => btn.click());
      navigator.mediaSession.setActionHandler("pause", () => a.pause());
      try { navigator.mediaSession.setActionHandler("previoustrack", () => step(-1)); navigator.mediaSession.setActionHandler("nexttrack", () => step(1)); } catch { /* unsupported */ }
    }
    return {
      surahs({ server, list, start: s, sub }) { const idx = list.indexOf(s); if (idx < 0) { toast("هذه السورة غير متوفرة بصوت هذا القارئ"); return; } q = { type: "surahs", server, list, idx, sub }; start(); },
      radio({ id, url: u, name, sub }) { if (q?.type === "radio" && q.id === id && !a.paused) { a.pause(); return; } q = { type: "radio", id, url: u, name, sub }; start(); },
      pause() { a.pause(); },
      key, refresh: render,
    };
  })();

  // ---------- reciter picker (for the reader) ----------
  async function pickReciter(meta, then) {
    const body = sheet(`اختيار القارئ، رواية ${meta.short}`, loading("جارٍ جلب القرّاء…"));
    try {
      const lists = await Promise.all(meta.audio.map(id => getReciters(id).catch(() => [])));
      const items = [];
      lists.flat().forEach(r => r.moshaf.filter(m => meta.audio.includes(m.rewaya_id)).forEach(m => items.push({ name: r.name, moshaf: m.name, server: m.server, list: m.surah_list, total: m.surah_total })));
      const seen = new Set(); const uniq = items.filter(x => !seen.has(x.server) && seen.add(x.server)).sort((x, y) => x.name.localeCompare(y.name, "ar"));
      if (!uniq.length) { body.innerHTML = `<div class="empty">لا يتوفر قرّاء لهذه الرواية حاليًا، أو لا يوجد اتصال بالإنترنت.</div>`; return; }
      body.innerHTML = `<div class="searchbox small">${icon("search")}<input type="search" placeholder="ابحث عن قارئ…" id="rc-q"></div><div class="list flat" id="rc-list"></div>`;
      const draw = f => { $("#rc-list", body).innerHTML = uniq.filter(x => !f || x.name.includes(f)).map((x, i) => `<button class="row" data-i="${uniq.indexOf(x)}"><div class="lbl">${esc(x.name)}<span class="sub">${esc(x.moshaf)}، ${ar(x.total)} ${plural(x.total, "سورة", "سورتان", "سور")}</span></div>${state.reciters[meta.id]?.server === x.server ? icon("check") : ""}</button>`).join("") || `<div class="empty">لا نتائج</div>`; };
      draw(""); $("#rc-q", body).oninput = e => draw(e.target.value.trim());
      $("#rc-list", body).onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; const x = uniq[Number(b.dataset.i)]; state.reciters[meta.id] = x; save(); closeSheet(); then?.(x); };
    } catch (err) { body.innerHTML = `<div class="empty">تعذّر جلب القرّاء.<br><small>${esc(err.message)}</small></div>`; }
  }
  const surahList = x => String(x.list || "").split(",").map(Number).filter(Boolean);

  // ---------- Mushaf home ----------
  let homeQuery = "";
  async function renderHome() {
    setNav("quran"); setHeader("المصحف", { actions: `<a class="icon-btn" href="#/listen" aria-label="الاستماع">${icon("headphones")}</a>` });
    const hash = location.hash; view.innerHTML = loading();
    try { await loadIndex(); } catch (e) { return failed(e, renderHome); }
    if (stale(hash)) return;
    const meta = riw(state.riwayah);
    const cont = state.last && INDEX.riwayat.some(r => r.id === state.last.r) ? state.last : null;
    const bm = state.bookmark && INDEX.riwayat.some(r => r.id === state.bookmark.r) ? state.bookmark : null;
    const pos = (p, label, ic) => `<a class="resume" href="#/quran/${p.r}/${p.s}?a=${p.a}">${icon(ic)}<div><b>${label}</b><span>سورة ${esc(riw(p.r).surahs[p.s - 1][0])}، آية ${ar(p.a)}، رواية ${esc(riw(p.r).short)}</span></div></a>`;
    view.innerHTML = `
      <div class="chips" role="tablist" aria-label="الرواية">${INDEX.riwayat.map(r => `<button class="chip ${r.id === meta.id ? "on" : ""}" data-r="${r.id}" role="tab" aria-selected="${r.id === meta.id}">${esc(r.short)}</button>`).join("")}</div>
      <p class="riwayah-note">رواية <b>${esc(meta.name)}</b>، ${ar(meta.ayat)} ${plural(meta.ayat, "آية", "آيتان", "آيات")} <span id="cached"></span></p>
      ${cont || bm ? `<div class="resume-row">${cont ? pos(cont, "متابعة القراءة", "book") : ""}${bm ? pos(bm, "العلامة", "bookmark") : ""}</div>` : ""}
      <div class="searchbox">${icon("search")}<input id="qq" type="search" placeholder="ابحث عن سورة أو كلمة في الآيات…" value="${esc(homeQuery)}" autocomplete="off" enterkeyhint="search"></div>
      <div class="tabs-row"><div class="segmented" id="qtabs"><button data-t="surahs" class="${state.tab === "surahs" ? "on" : ""}">السور</button><button data-t="juz" class="${state.tab === "juz" ? "on" : ""}">الأجزاء</button></div></div>
      <div id="qlist"></div>`;
    isCached(meta).then(c => { const x = document.getElementById("cached"); if (x && c) x.innerHTML = `، ${icon("check")} محفوظة للقراءة دون اتصال`; });
    view.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { state.riwayah = b.dataset.r; save(); renderHome(); });
    view.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { state.tab = b.dataset.t; save(); view.querySelectorAll("[data-t]").forEach(x => x.classList.toggle("on", x === b)); drawList(); });
    const input = $("#qq"); let timer;
    input.oninput = () => { homeQuery = input.value; clearTimeout(timer); timer = setTimeout(drawList, 200); };
    drawList();

    async function drawList() {
      const box = $("#qlist"); if (!box) return;
      const q = homeQuery.trim(); $("#qtabs").parentElement.hidden = !!q;
      const surahRow = (i, extra = "") => { const [name, count, page] = meta.surahs[i]; return `<a href="#/quran/${meta.id}/${i + 1}"><div class="num">${ar(i + 1)}</div><div class="lbl">${esc(name)}<span class="sub">${ar(count)} ${plural(count, "آية", "آيتان", "آيات")}، صفحة ${ar(page)}${extra}</span></div>${icon("back", "chev")}</a>`; };
      if (!q) {
        box.innerHTML = state.tab === "juz"
          ? `<div class="list">${meta.juz.map(([s, a], j) => `<a href="#/quran/${meta.id}/${s}?a=${a}"><div class="num">${ar(j + 1)}</div><div class="lbl">الجزء ${ar(j + 1)}<span class="sub">يبدأ من سورة ${esc(meta.surahs[s - 1][0])}، آية ${ar(a)}</span></div>${icon("back", "chev")}</a>`).join("")}</div>`
          : `<div class="list">${meta.surahs.map((_, i) => surahRow(i)).join("")}</div>`;
        return;
      }
      const k = quranKey(q); const num = Number(q.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
      const names = meta.surahs.map((s, i) => i).filter(i => (num >= 1 && num <= 114 && i + 1 === num) || (k && quranKey(meta.surahs[i][0]).includes(k)));
      let html = names.length ? `<h2 class="section-title">السور</h2><div class="list">${names.map(i => surahRow(i)).join("")}</div>` : "";
      if (k.length < 3) { box.innerHTML = html || `<div class="empty">اكتب كلمة أطول للبحث في الآيات</div>`; return; }
      box.innerHTML = html + loading("جارٍ البحث في الآيات…");
      let res; try { res = await loadRiwayah(meta.id); } catch (e) { box.innerHTML = html + `<div class="empty">تعذّر تحميل نص الرواية للبحث.</div>`; return; }
      if (homeQuery.trim() !== q || !document.body.contains(box)) return;
      if (!searchIdx.has(meta.id)) searchIdx.set(meta.id, res.data.s.map((ayat, si) => ayat.map((x, ai) => quranKey(res.data.e ? res.data.e[si][ai] : x[0]))));
      const idx = searchIdx.get(meta.id); const hits = [];
      for (let si = 0; si < idx.length && hits.length < 200; si++) for (let ai = 0; ai < idx[si].length; ai++) if (idx[si][ai].includes(k)) hits.push([si, ai]);
      html += `<h2 class="section-title">${hits.length ? (hits.length >= 200 ? "أكثر من ٢٠٠ آية" : `${ar(hits.length)} ${plural(hits.length, "آية", "آيتان", "آيات")}`) : "لا توجد آيات مطابقة"}</h2>`;
      if (hits.length) html += `<div class="list hits" style="--qfont:'kfgqpc-${meta.id}'">${hits.slice(0, 60).map(([si, ai]) => `<a href="#/quran/${meta.id}/${si + 1}?a=${ai + 1}"><div class="lbl"><span class="hit-text">${esc(res.data.s[si][ai][0])}</span><span class="sub">سورة ${esc(meta.surahs[si][0])}، آية ${ar(ai + 1)}</span></div></a>`).join("")}</div>`;
      if (hits.length > 60) html += `<p class="stat center">تُعرض أول ${ar(60)} نتيجة، حدّد البحث أكثر.</p>`;
      box.innerHTML = html;
    }
  }

  // ---------- reader ----------
  let observer = null;
  async function renderReader(rid, s, params) {
    setNav("quran"); const hash = location.hash;
    s = Math.min(114, Math.max(1, s | 0 || 1));
    setHeader("المصحف", { back: true }); view.innerHTML = loading("جارٍ تحميل المصحف…");
    let meta, data;
    try { ({ meta, data } = await loadRiwayah(rid)); } catch (e) { return failed(e, () => renderReader(rid, s, params)); }
    if (stale(hash)) return;
    if (meta.id !== rid) { location.replace(`#/quran/${meta.id}/${s}`); return; }
    if (state.riwayah !== meta.id) { state.riwayah = meta.id; save(); }
    const ayat = data.s[s - 1]; const [name] = meta.surahs[s - 1];
    setHeader(`سورة ${name}`, { back: true, actions: `<button class="icon-btn" id="q-play" aria-label="استماع للسورة">${icon("headphones")}</button><button class="icon-btn" id="q-riw" aria-label="تغيير الرواية">${icon("layers")}</button>` });
    const showBasmala = s !== 9 && !(s === 1 && meta.basmalaIsAya);
    const rec = state.reciters[meta.id];
    let lastJuz = s > 1 ? data.s[s - 2].at(-1)[2] : ayat[0][2];
    const bm = state.bookmark;
    const parts = [];
    ayat.forEach(([text, page, juz], i) => {
      if (juz !== lastJuz) { parts.push(`<div class="juz-mark"><span>الجزء ${ar(juz)}</span></div>`); lastJuz = juz; }
      const marked = bm && bm.r === meta.id && bm.s === s && bm.a === i + 1;
      parts.push(`<div class="aya ${marked ? "bm" : ""}" id="a-${i + 1}" data-a="${i + 1}" data-p="${page}" tabindex="0"><span class="aya-text">${esc(text)}</span></div>`);
    });
    view.innerHTML = `
      <div class="reader-bar">
        <span class="pill">رواية ${esc(meta.short)}</span><span class="pill ghost">${ar(ayat.length)} ${plural(ayat.length, "آية", "آيتان", "آيات")}</span><span class="pill ghost">صفحة ${ar(ayat[0][1])}</span>
        <button class="link" id="q-rec">${icon("headphones")} ${rec ? esc(rec.name) : "اختر القارئ"}</button>
      </div>
      <article class="mushaf" style="--qfont:'kfgqpc-${meta.id}'">
        <header class="surah-head"><span>سورة ${esc(name)}</span></header>
        ${showBasmala ? `<div class="basmala">${esc(meta.basmala)}</div>` : ""}
        ${parts.join("")}
      </article>
      <nav class="reader-nav">
        ${s > 1 ? `<a class="btn ghost" href="#/quran/${meta.id}/${s - 1}">${icon("back")} ${esc(meta.surahs[s - 2][0])}</a>` : "<span></span>"}
        ${s < 114 ? `<a class="btn ghost" href="#/quran/${meta.id}/${s + 1}">${esc(meta.surahs[s][0])} ${icon("back", "flip")}</a>` : "<span></span>"}
      </nav>
      <p class="source-note">النص والخط: ${esc(INDEX.source)}، الإصدار ${ar(meta.version)}</p>`;

    const play = () => { const r = state.reciters[meta.id]; const go = x => { player.surahs({ server: x.server, list: surahList(x), start: s, sub: `${x.name}، رواية ${meta.short}` }); const b = $("#q-rec"); if (b) b.innerHTML = `${icon("headphones")} ${esc(x.name)}`; }; r ? go(r) : pickReciter(meta, go); };
    $("#q-play").onclick = play;
    $("#q-rec").onclick = () => pickReciter(meta, x => { $("#q-rec").innerHTML = `${icon("headphones")} ${esc(x.name)}`; player.surahs({ server: x.server, list: surahList(x), start: s, sub: `${x.name}، رواية ${meta.short}` }); });
    $("#q-riw").onclick = () => {
      const body = sheet("اختر الرواية", `<div class="list flat">${INDEX.riwayat.map(r => `<button class="row" data-r="${r.id}"><div class="lbl">${esc(r.name)}<span class="sub">${ar(r.ayat)} ${plural(r.ayat, "آية", "آيتان", "آيات")}</span></div>${r.id === meta.id ? icon("check") : ""}</button>`).join("")}</div>`);
      body.onclick = e => { const b = e.target.closest("[data-r]"); if (!b) return; closeSheet(); const other = riw(b.dataset.r); location.hash = `#/quran/${other.id}/${s}`; };
    };

    // aya actions
    const mushaf = $(".mushaf");
    const ref = n => `[سورة ${name}: ${ar(n)}] رواية ${meta.name}`;
    const plain = n => `${ayat[n - 1][0].replace(AYA_NUM, "")} ﴿${ar(n)}﴾`;
    mushaf.addEventListener("click", e => {
      const act = e.target.closest("[data-act]");
      if (act) {
        const n = Number(act.closest(".aya-tools").dataset.a);
        if (act.dataset.act === "bm") {
          const on = !(state.bookmark && state.bookmark.r === meta.id && state.bookmark.s === s && state.bookmark.a === n);
          state.bookmark = on ? { r: meta.id, s, a: n } : null; save();
          mushaf.querySelectorAll(".aya.bm").forEach(x => x.classList.remove("bm")); if (on) document.getElementById("a-" + n).classList.add("bm");
          toast(on ? "حُفظت العلامة" : "أُزيلت العلامة"); closeTools(); return;
        }
        if (act.dataset.act === "copy") { copyText(`${plain(n)}\n${ref(n)}`); closeTools(); return; }
        if (act.dataset.act === "share") { share(`سورة ${name}`, `${plain(n)}\n${ref(n)}`); closeTools(); return; }
      }
      const aya = e.target.closest(".aya"); if (!aya) return;
      if (window.getSelection && String(window.getSelection()).length) return;
      const open = aya.nextElementSibling?.classList.contains("aya-tools");
      closeTools(); if (open) return;
      aya.classList.add("sel");
      const n = Number(aya.dataset.a); const isBm = state.bookmark && state.bookmark.r === meta.id && state.bookmark.s === s && state.bookmark.a === n;
      aya.insertAdjacentHTML("afterend", `<div class="aya-tools" data-a="${n}"><span class="aya-ref">آية ${ar(n)}، صفحة ${ar(aya.dataset.p)}</span><span class="spacer"></span>
        <button class="icon-btn ${isBm ? "active" : ""}" data-act="bm" aria-label="${isBm ? "إزالة العلامة" : "حفظ علامة"}">${icon("bookmark")}</button>
        <button class="icon-btn" data-act="copy" aria-label="نسخ">${icon("copy")}</button>
        <button class="icon-btn" data-act="share" aria-label="مشاركة">${icon("share")}</button></div>`);
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
  const listenTabs = on => `<div class="tabs-row"><div class="segmented"><a href="#/listen" class="${on === "rec" ? "on" : ""}">${icon("headphones")} التلاوات</a><a href="#/radio" class="${on === "radio" ? "on" : ""}">${icon("radio")} الإذاعات</a></div></div>`;
  async function renderListen(parts) {
    setNav("listen"); const hash = location.hash;
    loadIndex().catch(() => {});
    if (parts[0] === "r") return renderRewaya(Number(parts[1]), hash);
    if (parts[0] === "m") return renderMoshaf(Number(parts[1]), Number(parts[2]), hash);
    setHeader("الاستماع"); view.innerHTML = listenTabs("rec") + loading();
    let list; try { list = await getRiwayatList(); } catch (e) { return failed(e, () => renderListen(parts)); }
    if (stale(hash)) return;
    await loadIndex().catch(() => {});
    const withText = new Set((INDEX?.riwayat || []).flatMap(r => r.audio));
    view.innerHTML = listenTabs("rec") + `<p class="riwayah-note">اختر الرواية ثم القارئ. التلاوات تُبث من موقع mp3quran وتحتاج اتصالًا بالإنترنت.</p>
      <div class="list">${list.map((r, i) => `<a href="#/listen/r/${r.id}"><div class="num">${ar(i + 1)}</div><div class="lbl">${esc(r.name.trim())}${withText.has(r.id) ? `<span class="sub">${icon("book")} متوفرة بالنص في المصحف</span>` : ""}</div>${icon("back", "chev")}</a>`).join("")}</div>`;
  }
  async function renderRewaya(id, hash) {
    setHeader("القرّاء", { back: true }); view.innerHTML = loading("جارٍ جلب القرّاء…");
    let rl, reciters; try { [rl, reciters] = await Promise.all([getRiwayatList(), getReciters(id)]); } catch (e) { return failed(e, () => renderRewaya(id, hash)); }
    if (stale(hash)) return;
    const rname = rl.find(r => r.id === id)?.name.trim() || "";
    setHeader(rname || "القرّاء", { back: true });
    const rows = []; reciters.forEach(r => r.moshaf.filter(m => m.rewaya_id === id).forEach(m => rows.push({ r, m })));
    rows.sort((x, y) => x.r.name.localeCompare(y.r.name, "ar"));
    view.innerHTML = `<div class="searchbox">${icon("search")}<input id="rq" type="search" placeholder="ابحث عن قارئ…" autocomplete="off"></div><p class="riwayah-note">${ar(rows.length)} ${plural(rows.length, "تلاوة", "تلاوتان", "تلاوات")}</p><div class="list" id="rlist"></div>`;
    const draw = f => { $("#rlist").innerHTML = rows.filter(x => !f || x.r.name.includes(f)).map(({ r, m }) => `<a href="#/listen/m/${id}/${m.id}"><div class="num">${esc(r.letter || r.name[0])}</div><div class="lbl">${esc(r.name)}<span class="sub">${esc(m.name)}، ${ar(m.surah_total)} ${plural(m.surah_total, "سورة", "سورتان", "سور")}</span></div>${icon("back", "chev")}</a>`).join("") || `<div class="empty">لا نتائج</div>`; };
    draw(""); $("#rq").oninput = e => draw(e.target.value.trim());
  }
  async function renderMoshaf(rewaya, moshafId, hash) {
    setHeader("التلاوة", { back: true }); view.innerHTML = loading();
    let reciters; try { reciters = await getReciters(rewaya); await loadIndex(); } catch (e) { return failed(e, () => renderMoshaf(rewaya, moshafId, hash)); }
    if (stale(hash)) return;
    let rec, m; for (const r of reciters) { const x = r.moshaf.find(y => y.id === moshafId); if (x) { rec = r; m = x; break; } }
    if (!m) { view.innerHTML = `<div class="empty">لم تُعثر على هذه التلاوة.</div>`; return; }
    setHeader(rec.name, { back: true });
    const list = surahList({ list: m.surah_list }); const sub = `${rec.name}، ${m.name}`;
    view.innerHTML = `<div class="hero slim"><h2>${esc(rec.name)}</h2><p>${esc(m.name)}، ${ar(list.length)} ${plural(list.length, "سورة", "سورتان", "سور")}</p><div class="hero-actions"><button class="btn light" id="play-all">${icon("play")} تشغيل من البداية</button></div></div>
      <div class="list" id="slist">${list.map(n => `<button class="row" data-n="${n}" data-playing="surah:${esc(m.server)}:${n}"><div class="num">${ar(n)}</div><div class="lbl">سورة ${esc(surahName(n))}</div>${icon("play", "chev-play")}</button>`).join("")}</div>`;
    $("#play-all").onclick = () => player.surahs({ server: m.server, list, start: list[0], sub });
    $("#slist").onclick = e => { const b = e.target.closest("[data-n]"); if (b) player.surahs({ server: m.server, list, start: Number(b.dataset.n), sub }); };
    player.refresh();
  }

  // ---------- radios ----------
  let radioQuery = "";
  async function renderRadio() {
    setNav("listen"); setHeader("الإذاعات"); const hash = location.hash;
    view.innerHTML = listenTabs("radio") + loading("جارٍ جلب الإذاعات…");
    const canHls = !!document.createElement("audio").canPlayType("application/vnd.apple.mpegurl");
    const [live, reciters] = await Promise.all([getLiveRadios().catch(() => []), getReciterRadios().catch(() => null)]);
    if (stale(hash)) return;
    const liveOk = live.filter(r => !r.hls || canHls);
    const rows = (reciters || []).filter(r => r.url).sort((x, y) => x.name.localeCompare(y.name, "ar"));
    view.innerHTML = listenTabs("radio") + `<div id="radios">
      <h2 class="section-title">إذاعات القرآن الكريم المباشرة</h2>
      <div class="list" id="live">${liveOk.map(r => `<button class="row" data-id="live:${r.id}" data-playing="radio:live:${r.id}"><div class="num">${icon("radio")}</div><div class="lbl">${esc(r.name)}<span class="sub">${esc(r.country)}، بث مباشر</span></div>${icon("play", "chev-play")}</button>`).join("")}</div>
      <h2 class="section-title">إذاعات القرّاء والتفسير (على مدار الساعة)</h2>
      ${reciters ? `<div class="searchbox">${icon("search")}<input id="radq" type="search" placeholder="ابحث عن قارئ أو إذاعة…" value="${esc(radioQuery)}" autocomplete="off"></div><div class="list" id="rlist"></div>` : `<div class="empty">تعذّر جلب قائمة إذاعات القرّاء. تحقق من الاتصال بالإنترنت.</div>`}
      <p class="source-note">إذاعات القرّاء من موقع mp3quran.net. قد تتوقف أي إذاعة مؤقتًا من مصدرها.</p></div>`;
    const byId = new Map(); liveOk.forEach(r => byId.set("live:" + r.id, { id: "live:" + r.id, url: r.url, name: r.name, sub: `${r.country}، بث مباشر` }));
    rows.forEach(r => byId.set("rad:" + r.id, { id: "rad:" + r.id, url: r.url, name: r.name, sub: "إذاعة mp3quran" }));
    const draw = () => { const f = radioQuery.trim(); const box = $("#rlist"); if (!box) return; box.innerHTML = rows.filter(r => !f || r.name.includes(f)).map(r => `<button class="row" data-id="rad:${r.id}" data-playing="radio:rad:${r.id}"><div class="num">${icon("radio")}</div><div class="lbl">${esc(r.name)}</div>${icon("play", "chev-play")}</button>`).join("") || `<div class="empty">لا نتائج</div>`; player.refresh(); };
    draw(); const qi = $("#radq"); if (qi) qi.oninput = () => { radioQuery = qi.value; draw(); };
    $("#radios").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b && byId.has(b.dataset.id)) player.radio(byId.get(b.dataset.id)); });
    player.refresh();
  }

  return {
    quran(parts, params) { return parts.length ? renderReader(parts[0], Number(parts[1]), params) : renderHome(); },
    listen: renderListen, radio: renderRadio, player,
  };
}
