/* ===== التفسير: تفسير كل آية، ومكتبة كتب التفسير ===== */
// Books and how each groups the verses: tafsir/index.json (scripts/build-tafsir-index.js).
// Texts load from their sources and are shown as published: QuranEnc.com (al-Muyassar, al-Mukhtasar) and
// spa5k/tafsir_api pinned to a release commit on jsDelivr (the classical books, from the Quranic Universal Library);
// a file jsDelivr refuses is read from GitHub at the same commit (js/mirror.js).
// Verse numbers follow the Kufan count, so tafsir is offered in the Hafs and Shuʿbah readings.
import * as off from "./offline.js?v=1.35.1";
import { fetchWithMirror, mirrorOf } from "./mirror.js?v=1.35.1";

const TAFSIR_STORE = off.STORES.TAFSIR;

export function setupTafsir(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, setHeader, setNav, LS, copyText, share, SITE, Q } = ctx;
  const state = Object.assign({ book: "muyassar", last: null }, LS.get("tafsir", {}));
  const save = () => LS.set("tafsir", state);
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";

  // ---------- data ----------
  let IX = null;
  async function loadIndex() { if (!IX) { const r = await fetch("tafsir/index.json"); if (!r.ok) throw new Error("HTTP " + r.status); IX = await r.json(); } return IX; }
  const bookOf = id => IX.books.find(b => b.id === id);
  const current = () => bookOf(state.book) || IX.books[0];
  const title = b => isAr() ? b.ar : b.en;
  const author = b => isAr() ? b.by : b.byEn;
  const surahUrl = (b, s) => b.src === "qe" ? `${IX.sources.qe.api}/translation/sura/${b.key}/${s}` : `${IX.sources.spa5k.cdn}/${b.key}/${s}.json`;
  const ayahUrl = (b, s, a) => `${IX.sources.spa5k.cdn}/${b.key}/${s}/${a}.json`;

  // A few recent files in memory (one surah of a long book can be several megabytes).
  const memo = new Map();
  function getJSON(url) {
    if (memo.has(url)) { const p = memo.get(url); memo.delete(url); memo.set(url, p); return p; }
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 30000);
    const p = fetchWithMirror(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer)).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch(e => { memo.delete(url); throw e; });
    memo.set(url, p); while (memo.size > 8) memo.delete(memo.keys().next().value);
    return p;
  }
  // The file as saved on this device (under its own address or its GitHub copy's), or null (no network request).
  async function savedJSON(url) {
    try { for (const u of [url, mirrorOf(url)].filter(Boolean)) { const r = await caches.match(u); if (r) return await r.json(); } } catch { /* storage unavailable */ }
    return null;
  }

  // Rows of one surah: verse number -> text.
  async function surahTexts(b, s, { network = true } = {}) {
    const url = surahUrl(b, s);
    const j = memo.has(url) || network ? await getJSON(url) : await savedJSON(url);
    if (!j) return null;
    const rows = b.src === "qe" ? (j.result || []).map(r => [Number(r.aya), r.translation]) : (Array.isArray(j) ? j : j.ayahs || []).map(r => [Number(r.ayah), r.text]);
    return new Map(rows.filter(([, x]) => String(x || "").trim()));
  }
  // The source's entry for one verse, from the surah file when it is at hand, otherwise from the verse's own file.
  async function entryText(b, s, a) {
    const rows = b.src === "qe" ? await surahTexts(b, s) : await surahTexts(b, s, { network: false });
    if (rows) return rows.get(a) ?? null;
    return (await getJSON(ayahUrl(b, s, a))).text ?? null;
  }

  // Verses a book explains together: [from, to]; null when the book has no entry for the verse.
  function groupOf(b, s, a) {
    const g = (b.groups?.[s] || []).find(([x, y]) => a >= x && a <= y);
    if (g) return g;
    return b.missing?.[s]?.includes(a) ? null : [a, a];
  }
  // Text of the entry that starts at verse a, with passages the source put under a neighbouring surah moved
  // back to their place (index "moves": [surah, verse, cut, "head"|"tail", to surah, to verse]).
  async function groupText(b, s, a, own) {
    let text = own ?? await entryText(b, s, a); if (text == null) return null;
    let before = "", after = "";
    for (const [ms, ma, at, side, ts, ta] of b.moves || []) {
      if (ms === s && ma === a) text = side === "tail" ? text.slice(0, at) : text.slice(at);
      if (ts === s && ta === a) {
        const src = await entryText(b, ms, ma); if (src == null) continue;
        if (side === "tail") before += src.slice(at).trim() + "\n\n"; else after += "\n\n" + src.slice(0, at).trim();
      }
    }
    return (before + text.trim() + after).trim();
  }

  // ---------- showing the text ----------
  // Line breaks of a printed page ("lines": "join"): keep a break only after the end of a sentence.
  const joinLines = (s, b) => b.lines === "join" ? s.replace(/([^.!؟:»\n])\n(?!\n)/g, "$1 ") : s;
  const shown = s => ctx.tashkeel() ? s : ctx.stripTashkeel(s);
  function formatTafsir(text, b) {
    return joinLines(shown(text), b).split(/\n+/).map(x => x.trim()).filter(Boolean).map(p => `<p>${esc(p)
      .replace(/\[\[([\s\S]*?)\]\]/g, '<span class="tf-ed">[$1]</span>') // the editor's notes
      .replace(/﴿([^﴾]{1,1500})﴾/g, '<span class="q">﴿$1﴾</span>')
      .replace(/\{([^{}\n]{1,600})\}/g, (m, x) => /^[\d٠-٩\sـ–-]+$/.test(x) ? `<span class="tf-n">${x}</span>` : `<span class="q">{${x}}</span>`)}</p>`).join("");
  }
  const plainOf = (text, b) => joinLines(text, b).replace(/\[\[/g, "[").replace(/\]\]/g, "]").trim();
  const rangeLabel = (g, a) => !g ? t("tafsir.ofAya", { aya: a }) : g[0] === g[1] ? t("tafsir.ofAya", { aya: g[0] }) : t("tafsir.ofAyat", { from: g[0], to: g[1] });
  const sourceNote = b => b.src === "qe" ? t("tafsir.sourceQe", { book: title(b) }) : t("tafsir.sourceQul", { book: title(b) });
  const loading = (msg = t("tafsir.loading")) => `<div class="empty"><div class="spinner"></div><div>${esc(msg)}</div></div>`;
  const failedHtml = err => `<div class="empty">${icon("download")}<div>${esc(t(!navigator.onLine || err instanceof TypeError || err?.name === "AbortError" ? "offline.needOnce" : "tafsir.failed"))}</div></div>`;
  const ayatHtml = (data, s, from, to) => { const xs = []; for (let a = from; a <= to; a++) { const x = data.s[s - 1][a - 1]; if (x) xs.push(esc(x[0])); } return xs.join(" "); };
  const bookChips = id => `<div class="chips tf-books" role="tablist" aria-label="${esc(t("tafsir.chooseBook"))}">${IX.books.map(x => `<button class="chip ${x.id === id ? "on" : ""}" data-b="${x.id}" role="tab" aria-selected="${x.id === id}">${esc(isAr() ? x.short : x.shortEn)}</button>`).join("")}</div>`;

  // ---------- the tafsir of one verse, in a sheet over the reader ----------
  async function openAyah({ s, a, rid = "hafs" }) {
    const body = Q.sheet(t("tafsir.title"), loading());
    let text;
    try { [, text] = await Promise.all([loadIndex(), Q.textOf(rid)]); } catch (e) { body.innerHTML = failedHtml(e); return; }
    const { meta, data } = text; const count = data.s[s - 1].length;
    let at = a, seq = 0;
    const draw = async () => {
      const mine = ++seq; const b = current(); const g = groupOf(b, s, at);
      const [from, to] = g || [at, at];
      body.innerHTML = `${bookChips(b.id)}
        <div class="tf-sheet-head"><b>${esc(t("quran.surah", { name: Q.surahName(s, meta) }))}</b><span>${esc(rangeLabel(g, at))}</span></div>
        <div class="tf-ayat" lang="ar" dir="rtl" style="--qfont:'kfgqpc-${meta.id}'">${ayatHtml(data, s, from, to)}</div>
        <div class="tf-body" id="tf-text" lang="ar" dir="rtl">${loading()}</div>
        <div class="tf-nav">
          <button class="btn ghost small" data-go="prev" ${from <= 1 ? "disabled" : ""}>${icon("back", "dir")} ${esc(t("tafsir.prevAya"))}</button>
          <button class="icon-btn" data-act="copy" aria-label="${esc(t("common.copy"))}">${icon("copy")}</button>
          <a class="icon-btn" href="#/tafsir/${b.id}/${s}?a=${from}" aria-label="${esc(t("tafsir.readSurah"))}">${icon("tafsir")}</a>
          <button class="btn ghost small" data-go="next" ${to >= count ? "disabled" : ""}>${esc(t("tafsir.nextAya"))} ${icon("back", "flip")}</button>
        </div>
        <p class="source-note">${esc(sourceNote(b))}</p>`;
      body.scrollTop = 0; body.querySelector(".tf-books .on")?.scrollIntoView({ block: "nearest", inline: "nearest" });
      const box = $("#tf-text", body);
      let tf = null;
      try { tf = g ? await groupText(b, s, from) : null; } catch (e) { if (mine === seq) box.innerHTML = failedHtml(e); return; }
      if (mine !== seq || !document.body.contains(box)) return;
      box.innerHTML = tf ? formatTafsir(tf, b) : `<div class="info">${icon("book")}<div>${esc(t("tafsir.missing"))}</div></div>`;
      body.querySelector("[data-act=copy]").onclick = () => tf && copyText(`${plainOf(tf, b)}\n\n(${t("tafsir.copyRef", { book: title(b), surah: t("quran.surah", { name: Q.surahName(s, meta) }), ayat: from === to ? num(from) : `${num(from)}–${num(to)}` })})`);
    };
    body.addEventListener("click", e => {
      const chip = e.target.closest("[data-b]");
      if (chip) { state.book = chip.dataset.b; save(); draw(); return; }
      const go = e.target.closest("[data-go]"); if (!go || go.disabled) return;
      const g = groupOf(current(), s, at) || [at, at];
      at = go.dataset.go === "prev" ? Math.max(1, g[0] - 1) : Math.min(count, g[1] + 1);
      draw();
    });
    draw();
  }

  // ---------- library ----------
  async function renderLibrary() {
    setNav("quran"); setHeader(t("tafsir.books"), { back: true, actions: `<a class="icon-btn" href="#/offline" aria-label="${esc(t("offline.title"))}">${icon("download")}</a>` });
    const hash = location.hash; view.innerHTML = loading(t("common.loading"));
    try { await loadIndex(); } catch (e) { if (!stale(hash)) view.innerHTML = failedHtml(e); return; }
    if (stale(hash)) return;
    const last = state.last && bookOf(state.last.b);
    if (last) Q.textOf("hafs").then(({ meta }) => { const x = document.getElementById("tf-last"); if (x) x.textContent = t("tafsir.position", { book: title(last), surah: t("quran.surah", { name: Q.surahName(state.last.s, meta) }), aya: state.last.a }); }).catch(() => {});
    view.innerHTML = `
      ${last ? `<div class="resume-row"><a class="resume" href="#/tafsir/${last.id}/${state.last.s}?a=${state.last.a}">${icon("tafsir")}<div><b>${esc(t("quran.continue"))}</b><span id="tf-last">${esc(title(last))}</span></div></a></div>` : ""}
      <p class="riwayah-note">${esc(t("tafsir.intro"))}</p>
      ${isAr() ? "" : `<div class="info">${icon("translate")}<div>${esc(t("tafsir.arabicOnly"))}</div></div>`}
      <div class="list">${IX.books.map(b => `<a href="#/tafsir/${b.id}"><div class="num">${icon("tafsir")}</div><div class="lbl">${esc(title(b))}${isAr() ? "" : ` <span class="ar-name" lang="ar" dir="rtl">${esc(b.ar)}</span>`}<span class="sub">${esc(author(b))}${sep()}${esc(t("tafsir.len." + b.len))}${b.id === current().id ? `${sep()}${esc(t("tafsir.forVerses"))}` : ""}</span></div>${icon("back", "chev")}</a>`).join("")}</div>
      <p class="source-note">${esc(t("tafsir.sources"))}</p>`;
  }

  // ---------- one book: its surahs ----------
  let surahQuery = "";
  async function renderBook(id) {
    setNav("quran"); const hash = location.hash;
    setHeader(t("tafsir.books"), { back: true }); view.innerHTML = loading(t("common.loading"));
    let meta; try { await loadIndex(); ({ meta } = await Q.textOf("hafs")); } catch (e) { if (!stale(hash)) view.innerHTML = failedHtml(e); return; }
    if (stale(hash)) return;
    const b = bookOf(id); if (!b) { location.replace("#/tafsir"); return; }
    setHeader(title(b), { back: true });
    const isDefault = b.id === current().id;
    view.innerHTML = `
      <p class="riwayah-note">${esc(author(b))}${sep()}${esc(t("tafsir.len." + b.len))}</p>
      <div class="setting tf-default"><div class="lbl">${esc(t("tafsir.useForVerses"))}<small>${esc(t("tafsir.useForVersesHint"))}</small></div><button class="switch ${isDefault ? "on" : ""}" id="tf-def" role="switch" aria-checked="${isDefault}" aria-label="${esc(t("tafsir.useForVerses"))}"></button></div>
      <div class="searchbox">${icon("search")}<input id="tq" type="search" placeholder="${esc(t("tafsir.searchSurah"))}" value="${esc(surahQuery)}" autocomplete="off"></div>
      <div class="list" id="tlist"></div>
      <p class="source-note">${esc(sourceNote(b))}</p>`;
    $("#tf-def").onclick = e => { if (b.id === current().id) return; state.book = b.id; save(); e.currentTarget.classList.add("on"); e.currentTarget.setAttribute("aria-checked", "true"); };
    const key = s => String(s).normalize("NFD").replace(/\p{M}/gu, "").replace(/[ٱأإآ]/g, "ا").toLowerCase();
    const draw = () => {
      const q = key(surahQuery.trim()); const n = Number(surahQuery.trim().replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
      $("#tlist").innerHTML = meta.surahs.map((x, i) => i).filter(i => !q || (n && i + 1 === n) || key(meta.surahs[i][0]).includes(q) || key(meta.surahs[i][3] || "").includes(q))
        .map(i => `<a href="#/tafsir/${b.id}/${i + 1}"><div class="num">${num(i + 1)}</div><div class="lbl">${esc(t("quran.surah", { name: Q.surahName(i + 1, meta) }))}<span class="sub">${esc(t("count.ayat", { n: meta.surahs[i][1] }))}</span></div>${icon("back", "chev")}</a>`).join("") || `<div class="empty">${esc(t("common.noResults"))}</div>`;
    };
    draw(); $("#tq").oninput = e => { surahQuery = e.target.value; draw(); };
  }

  // ---------- reading the tafsir of a surah ----------
  let observer = null;
  async function renderSurah(id, s, params) {
    setNav("quran"); const hash = location.hash;
    s = Math.min(114, Math.max(1, s | 0 || 1));
    setHeader(t("tafsir.books"), { back: true }); view.innerHTML = loading();
    let text; try { [, text] = await Promise.all([loadIndex(), Q.textOf("hafs")]); } catch (e) { if (!stale(hash)) view.innerHTML = failedHtml(e) + `<div class="center"><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`; $("#retry")?.addEventListener("click", () => renderSurah(id, s, params)); return; }
    if (stale(hash)) return;
    const b = bookOf(id); if (!b) { location.replace("#/tafsir"); return; }
    const { meta, data } = text; const name = Q.surahName(s, meta); const count = data.s[s - 1].length;
    setHeader(t("quran.surah", { name }), { back: true, actions: `<a class="icon-btn" href="#/quran/hafs/${s}" aria-label="${esc(t("tafsir.openInMushaf"))}">${icon("quran")}</a><button class="icon-btn" id="tf-book" aria-label="${esc(t("tafsir.chooseBook"))}">${icon("layers")}</button>` });
    $("#tf-book").onclick = () => {
      const sb = Q.sheet(t("tafsir.chooseBook"), `<div class="list flat">${IX.books.map(x => `<button class="row" data-b="${x.id}"><div class="lbl">${esc(title(x))}<span class="sub">${esc(author(x))}${sep()}${esc(t("tafsir.len." + x.len))}</span></div>${x.id === b.id ? icon("check") : ""}</button>`).join("")}</div>`);
      sb.onclick = e => { const x = e.target.closest("[data-b]"); if (!x) return; Q.closeSheet(); location.replace(`#/tafsir/${x.dataset.b}/${s}`); };
    };
    let rows;
    try { rows = await surahTexts(b, s); } catch (e) { if (!stale(hash)) { view.innerHTML = failedHtml(e) + `<div class="center"><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`; $("#retry").onclick = () => renderSurah(id, s, params); } return; }
    if (stale(hash)) return;
    // The surah as the book divides it.
    const groups = []; for (let a = 1; a <= count;) { const g = groupOf(b, s, a); groups.push(g || [a, a, true]); a = (g ? g[1] : a) + 1; }
    const block = g => `<article class="tf-block" id="t-${g[0]}" data-a="${g[0]}">
        <div class="tf-ayat" lang="ar" dir="rtl" style="--qfont:'kfgqpc-hafs'">${ayatHtml(data, s, g[0], g[1])}</div>
        <div class="tf-label">${esc(g[2] ? rangeLabel(null, g[0]) : rangeLabel(g))}</div>
        <div class="tf-body" lang="ar" dir="rtl">${loading()}</div>
        <div class="dhikr-bar"><span class="spacer"></span><button class="icon-btn" data-act="copy" aria-label="${esc(t("common.copy"))}">${icon("copy")}</button><button class="icon-btn" data-act="share" aria-label="${esc(t("common.share"))}">${icon("share")}</button></div>
      </article>`;
    const want = Number(params.get("a")); const wantIdx = want ? Math.max(0, groups.findIndex(g => want >= g[0] && want <= g[1])) : 0;
    let shown = Math.max(12, wantIdx + 6);
    view.innerHTML = `
      <div class="reader-bar"><span class="pill">${esc(title(b))}</span><span class="pill ghost">${esc(t("count.ayat", { n: count }))}</span></div>
      <article class="mushaf tf-surah" lang="ar" dir="rtl" style="--qfont:'kfgqpc-hafs'"><header class="surah-head"><span>سورة ${esc(meta.surahs[s - 1][0])}</span></header></article>
      <div id="tblocks"></div><div id="tmore"></div>
      <nav class="reader-nav">
        ${s > 1 ? `<a class="btn ghost" href="#/tafsir/${b.id}/${s - 1}">${icon("back", "dir")} ${esc(Q.surahName(s - 1, meta))}</a>` : "<span></span>"}
        ${s < 114 ? `<a class="btn ghost" href="#/tafsir/${b.id}/${s + 1}">${esc(Q.surahName(s + 1, meta))} ${icon("back", "flip")}</a>` : "<span></span>"}
      </nav>
      <p class="source-note">${esc(sourceNote(b))}${b.src === "spa5k" ? `<br>${esc(t("tafsir.notesHint"))}` : ""}</p>`;
    const blocks = $("#tblocks"); const more = $("#tmore"); const texts = new Map();
    const fill = async el => {
      const a = Number(el.dataset.a); const g = groups.find(x => x[0] === a); const box = $(".tf-body", el);
      if (g[2]) { box.innerHTML = `<div class="info">${icon("book")}<div>${esc(t("tafsir.missing"))}</div></div>`; return; }
      try { const tf = await groupText(b, s, a, rows.get(a) ?? null); texts.set(a, tf); box.innerHTML = tf ? formatTafsir(tf, b) : `<div class="info">${icon("book")}<div>${esc(t("tafsir.missing"))}</div></div>`; }
      catch (e) { box.innerHTML = failedHtml(e); }
    };
    const append = n => { const next = groups.slice(blocks.children.length, blocks.children.length + n); blocks.insertAdjacentHTML("beforeend", next.map(block).join("")); next.forEach(g => { const el = document.getElementById("t-" + g[0]); fill(el); observer.observe(el); }); if (blocks.children.length >= groups.length) more.innerHTML = ""; };
    // Remember the reading position.
    observer?.disconnect(); let saveTimer;
    observer = new IntersectionObserver(es => {
      const vis = es.filter(x => x.isIntersecting).map(x => Number(x.target.dataset.a)); if (!vis.length) return;
      clearTimeout(saveTimer); saveTimer = setTimeout(() => { if (stale(hash)) return; state.last = { b: b.id, s, a: Math.min(...vis) }; save(); }, 700);
    }, { rootMargin: "-80px 0px -60% 0px" });
    append(shown);
    if (blocks.children.length < groups.length) {
      more.innerHTML = `<button class="btn ghost block" id="tmore-btn">${esc(t("hadith.showMore"))}</button>`;
      $("#tmore-btn").onclick = () => append(12);
      new IntersectionObserver((es, o) => { if (stale(hash)) return o.disconnect(); if (es.some(e => e.isIntersecting)) append(12); }, { rootMargin: "800px" }).observe(more);
    }
    blocks.addEventListener("click", e => {
      const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
      const el = e.target.closest(".tf-block"); const a = Number(el.dataset.a); const g = groups.find(x => x[0] === a); const tf = texts.get(a); if (!tf) return;
      const ref = t("tafsir.copyRef", { book: title(b), surah: t("quran.surah", { name }), ayat: g[0] === g[1] ? num(g[0]) : `${num(g[0])}–${num(g[1])}` });
      const plain = `${plainOf(tf, b)}\n\n(${ref})`;
      if (act === "copy") copyText(plain);
      if (act === "share") share(title(b), `${plain}\n${SITE}#/tafsir/${b.id}/${s}?a=${a}`);
    });
    if (want > 1) {
      const target = document.getElementById("t-" + groups[wantIdx][0]);
      const go = () => { if (!stale(hash)) target?.scrollIntoView({ block: "start" }); };
      requestAnimationFrame(go); document.fonts?.ready.then(go);
      target?.classList.add("flash"); setTimeout(() => target?.classList.remove("flash"), 1800);
    }
  }

  // ---------- offline ----------
  const storeOf = b => b.src === "qe" ? off.STORES.TR : TAFSIR_STORE;
  const bookUrls = b => Array.from({ length: 114 }, (_, i) => surahUrl(b, i + 1));
  async function offlineRows(fmt, part, row) {
    await loadIndex();
    const rows = await Promise.all(IX.books.map(async b => { const urls = bookUrls(b); const saved = await off.savedSet(storeOf(b), urls); return row(title(b), esc(t("offline.progress", { done: saved.size, total: 114 })) + `${sep()}${esc(t("offline.size", { size: fmt(b.bytes) }))}`, "tafsir:" + b.id, part(saved.size, 114)); }));
    return rows.join("");
  }
  const offlineTarget = id => { const b = IX && bookOf(id); return b ? [storeOf(b), bookUrls(b)] : null; };

  return {
    render(parts, params) {
      if (!parts.length) return renderLibrary();
      if (parts.length === 1) return renderBook(parts[0]);
      return renderSurah(parts[0], Number(parts[1]), params);
    },
    openAyah, offlineRows, offlineTarget, loadIndex, store: TAFSIR_STORE,
  };
}
