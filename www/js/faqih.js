/* ===== الباحث الفقهي: what the books say about a question, word for word, with the place of each quotation ===== */
// The question is looked up in the word index of the books of www/kutub (fihris/, scripts/build-fihris.mjs) on the
// device: the reading pages that hold its words, best first, each shown at its paragraph with the words marked and a
// link to that place in the reader. Only the index files of the question's words and the parts of the pages shown are
// downloaded, and they are kept for offline use. It is a search of the books, never a fatwa.
// When a question server is set (FAQIH.url, faqih/README.md: a model restates the passages it finds and every quotation
// is checked against them) the question goes there instead.
import { queryWords, filesOf, fileOf, forms, decodeFile, rank, mix, matcher, plain, fold } from "./fihris-words.js?v=1.35.1";

const FAQIH = { url: "" }; // the question server, once deployed (faqih/README.md); scripts/check-sources.js reads it
const FIHRIS_CACHE = "hisn-fihris-v1";
const SCHOLARS = [["IslamQA", "https://islamqa.info/ar"], ["إسلام ويب", "https://www.islamweb.net/ar/fatwa/"]];
const EXAMPLES = ["ما حكم الوضوء بالنبيذ؟", "هل تجب الزكاة في حلي المرأة؟", "ما حكم الجمع بين الصلاتين في المطر؟", "هل يصح صوم من أكل ناسيًا؟"];
const PAGE = 10; // results shown at a time

export function setupFaqih(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, LS, setHeader, setNav } = ctx;
  // On localhost a server started with wrangler dev: localStorage.faqihServer = JSON.stringify({ url: "http://localhost:8787" })
  const server = () => { const dev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && LS.get("faqihServer", null); return dev?.url ? dev : FAQIH; };
  const state = Object.assign({ q: "", last: null }, LS.get("faqih", {})); // the last question and its answer, shown again when the page reopens
  const save = () => LS.set("faqih", state);
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";
  const getJSON = async url => { const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
  let IX = null;
  const loadIndex = async () => IX || (IX = await getJSON("kutub/index.json"));
  const loading = msg => `<div class="empty"><div class="spinner"></div><div>${esc(msg)}</div></div>`;
  const pageNo = (v, p) => (v ? t("kutub.vol", { n: num(Number(v) || v) }) + sep() : "") + t("kutub.page", { n: num(p) });
  // Printed pages of the passage, as the reader shows them: «ج ٢، ص ١٠–١٢».
  const pagesOf = it => {
    if (it.pg0 == null) return "";
    if ((it.v0 || "") !== (it.v1 || "")) return `${pageNo(it.v0, it.pg0)} – ${pageNo(it.v1, it.pg1)}`;
    return (it.v0 ? t("kutub.vol", { n: num(Number(it.v0) || it.v0) }) + sep() : "") + (it.pg0 === it.pg1 ? t("kutub.page", { n: num(it.pg0) }) : t("kutub.pages", { from: num(it.pg0), to: num(it.pg1) }));
  };
  const bookName = id => { const b = IX?.books.find(x => x.id === id); return b ? (isAr() ? b.ar : b.en) + "، " + (isAr() ? b.by : b.byEn) : id; };
  const scholars = () => `<p class="fq-scholars">${esc(t("faqih.askScholar"))} ${SCHOLARS.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(n)}</a>`).join(sep())}</p>`;

  function render(parts, params) {
    setNav("more"); setHeader(t("faqih.title"), { back: true });
    const q = params.get("q") || state.q || "";
    view.innerHTML = `
      <p class="riwayah-note">${esc(t("faqih.intro"))}</p>
      <div class="info">${icon("fiqh")}<div>${esc(t("faqih.disclaimer"))}${isAr() ? "" : " " + esc(t("faqih.arabicOnly"))}</div></div>
      <form id="fq-form" class="fq-form">
        <div class="searchbox">${icon("search")}<input id="fq-q" type="search" lang="ar" dir="rtl" maxlength="300" autocomplete="off" enterkeyhint="search" placeholder="${esc(t("faqih.placeholder"))}" value="${esc(q)}"></div>
        <button class="btn block" type="submit">${icon("fiqh")} ${esc(t("faqih.ask"))}</button>
      </form>
      <div class="chips fq-examples">${EXAMPLES.map(x => `<button type="button" class="chip fq-ex" lang="ar" dir="rtl">${esc(x)}</button>`).join("")}</div>
      <div id="fq-out"></div>`;
    $("#fq-form").onsubmit = e => { e.preventDefault(); ask($("#fq-q").value); };
    view.querySelectorAll(".fq-ex").forEach(b => { b.onclick = () => { $("#fq-q").value = b.textContent; ask(b.textContent); }; });
    if (params.get("q") && state.last?.q !== q) ask(q);
    else if (state.last?.local) ask(state.last.q);
    else if (state.last?.res) loadIndex().then(() => { if (!stale(location.hash)) show(state.last); }).catch(() => show(state.last));
  }

  async function ask(raw) {
    const q = String(raw || "").replace(/\s+/g, " ").trim(); if (q.length < 3) return;
    const srv = server();
    const hash = location.hash; state.q = q; save();
    const out = $("#fq-out"), btn = $("#fq-form .btn");
    out.innerHTML = loading(t("faqih.searching")); btn.classList.add("busy"); $("#fq-q").blur();
    try {
      if (!srv.url) { await searchBooks(q, hash); return; }
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 45000);
      // No headers: a plain request (text/plain) needs no preflight, like www/js/prayer.js.
      const r = await fetch(srv.url + "/ask", { method: "POST", body: JSON.stringify({ q }), signal: ctrl.signal }).finally(() => clearTimeout(timer));
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(j.error || "HTTP " + r.status), { status: r.status });
      await loadIndex().catch(() => {});
      state.last = { q, res: j, at: Date.now() }; save();
      if (!stale(hash)) show(state.last);
    } catch (e) {
      if (stale(hash)) return;
      const offline = !navigator.onLine || e instanceof TypeError;
      const msg = e.status === 429 ? t("faqih.tooMany") : e.status === 503 ? t("faqih.busy") : e.status === 400 ? t("faqih.arabicOnly") : t(offline ? "offline.needOnce" : "common.loadFailed");
      out.innerHTML = `<div class="empty">${esc(msg)}</div>`;
    } finally { btn.classList.remove("busy"); }
  }

  // ---------- the books' own words, searched on the device ----------
  let FX = null, DOCS = null; const FILES = new Map(), PARTS = new Map();
  const memo = (map, key, load) => { if (!map.has(key)) map.set(key, load().catch(e => { map.delete(key); throw e; })); return map.get(key); };
  async function loadFihris() {
    if (!FX) { FX = await getJSON("fihris/index.json"); FX.firsts = FX.words.map(w => w[0]); prune(); }
    if (!DOCS) DOCS = await memo(FILES, "docs", () => getJSON("fihris/" + FX.docs));
    return FX;
  }
  const wordFile = n => memo(FILES, n, async () => { const r = await fetch(`fihris/w/${n}.${FX.words[n][1]}.bin`); if (!r.ok) throw new Error("HTTP " + r.status); return decodeFile(await r.arrayBuffer()); });
  const partOf = (b, c) => { while (PARTS.size > 12) PARTS.delete(PARTS.keys().next().value); const url = `kutub/${b.id}/${c}.${b.chunks[c]}.json`; return memo(PARTS, url, () => getJSON(url)); };
  // Copies of index files from an earlier build.
  function prune() {
    if (!("caches" in window)) return;
    const keep = new Set(["fihris/" + FX.docs, ...FX.words.map(([w, h], n) => `fihris/w/${n}.${h}.bin`)]);
    caches.open(FIHRIS_CACHE).then(async c => {
      for (const r of await c.keys()) { const p = new URL(r.url).pathname; if (![...keep].some(f => p.endsWith("/" + f))) await c.delete(r); }
    }).catch(() => {});
  }

  async function searchBooks(q, hash) {
    await Promise.all([loadFihris(), loadIndex()]);
    const qw = queryWords(q, FX.common);
    const files = new Map(await Promise.all([...new Set(qw.flatMap(w => [...filesOf(w, FX.firsts)]))].map(async n => [n, await wordFile(n)])));
    const postings = w => [...forms(w)].map(f => files.get(fileOf(f, FX.firsts))?.get(f)).filter(Boolean);
    const len = DOCS.d.map(d => d[3]);
    const found = mix(rank(qw, postings, { n: FX.n, avgdl: FX.avgdl, len }), d => DOCS.d[d][0]).slice(0, 100);
    state.last = { q, local: true, at: Date.now() }; save();
    if (stale(hash)) return;
    const out = $("#fq-out"); if (!out) return;
    const asked = `<h2 class="section-title fq-q" lang="ar" dir="rtl">${esc(q)}</h2>`;
    if (!found.length) { out.innerHTML = asked + `<div class="empty"><div>${esc(t("faqih.notFound"))}</div>${scholars()}</div>`; return; }
    out.innerHTML = asked + `<h2 class="section-title">${esc(t("faqih.quotes"))}</h2><div class="list" id="fq-list"></div>`
      + `<button class="btn ghost block" id="fq-more" hidden>${esc(t("hadith.showMore"))}</button>`
      + `<p class="riwayah-note">${esc(t("faqih.wordsNote"))}</p>` + scholars();
    const find = matcher(qw);
    let shown = 0;
    const more = () => {
      const rows = found.slice(shown, shown + PAGE).map(x => resultRow(x.doc, find, hash)); shown += rows.length;
      $("#fq-list").append(...rows);
      $("#fq-more").hidden = shown >= found.length;
    };
    $("#fq-more").onclick = more;
    more();
  }

  // A result: the book, the headings and the pages at once, then the paragraph that holds most of the question's words,
  // with them marked, once the part of the book holding it has come.
  function resultRow(doc, find, hash) {
    const [bi, s, c, , heads, pg0, pg1, v0, v1] = DOCS.d[doc], id = DOCS.books[bi], b = IX.books.find(x => x.id === id);
    const where = [bookName(id), heads, pagesOf({ pg0, pg1, v0, v1 })].filter(Boolean).join(sep());
    const a = document.createElement("a"); a.href = `#/kutub/${id}/${s}`;
    a.innerHTML = `<div class="lbl"><span class="sub" lang="ar" dir="rtl">${esc(where)}</span><span class="kt-snip" lang="ar" dir="rtl"><span class="spinner sm"></span></span></div>${icon("back", "chev")}`;
    const snip = a.querySelector(".kt-snip");
    if (!b) { snip.remove(); return a; }
    partOf(b, c).then(part => {
      if (stale(hash)) return;
      const best = bestParagraph(part[s]?.body || [], find);
      if (!best) { snip.remove(); return; }
      a.href = `#/kutub/${id}/${s}?${best.x.h != null ? `a=${best.x.a}` : `p=${best.i}`}`;
      snip.innerHTML = snippet(best.text, best.hits);
    }).catch(() => snip.remove());
    return a;
  }
  function bestParagraph(body, find) {
    let best = null;
    body.forEach((x, i) => {
      const raw = x.p ?? x.h; if (raw == null) return;
      const text = plain(raw), hits = find(fold(text)); if (!hits.length) return;
      const score = new Set(hits.map(h => h[2])).size * 1000 + hits.length;
      if (!best || score > best.score) best = { x, i, text, hits, score };
    });
    return best;
  }
  // About two lines around the place where most of the question's words come together.
  function snippet(text, hits) {
    const SPAN = 220;
    let from = 0, top = -1;
    for (const [s0] of hits) { const n = new Set(hits.filter(([x]) => x >= s0 && x < s0 + SPAN).map(h => h[2])).size; if (n > top) { top = n; from = s0; } }
    from = Math.max(0, from - 50); const back = text.lastIndexOf(" ", from); if (back > from - 30 && from) from = back + 1;
    let to = Math.min(text.length, from + SPAN + 50); const fwd = text.indexOf(" ", to); if (fwd > 0 && fwd < to + 30) to = fwd;
    let html = "", pos = from;
    for (const [s0, e0] of hits) { if (s0 < pos || e0 > to) continue; html += esc(text.slice(pos, s0)) + `<mark>${esc(text.slice(s0, e0))}</mark>`; pos = e0; }
    return (from ? "…" : "") + html + esc(text.slice(pos, to)) + (to < text.length ? "…" : "");
  }

  // ---------- the answer of the question server ----------
  function show({ q, res }) {
    const out = $("#fq-out"); if (!out) return;
    const asked = `<h2 class="section-title fq-q" lang="ar" dir="rtl">${esc(q)}</h2>`;
    if (res.status !== "answer" || !res.items?.length) {
      out.innerHTML = asked + `<div class="empty"><div>${esc(t(res.status === "refer_to_scholar" ? "faqih.referScholar" : "faqih.notFound"))}</div>${scholars()}</div>`;
      return;
    }
    const rows = res.items.map(it => {
      const where = [bookName(it.b), pagesOf(it)].filter(Boolean).join(sep());
      return `<a href="#/kutub/${it.b}/${it.s}?p=${it.p0}" title="${esc(t("kutub.start"))}"><div class="lbl"><span class="sub" lang="ar" dir="rtl">${esc(where)}</span><span class="kt-snip" lang="ar" dir="rtl">«${esc(it.quote)}»</span>${it.note ? `<span class="sub" lang="ar" dir="rtl">${esc(it.note)}</span>` : ""}</div>${icon("back", "chev")}</a>`;
    });
    out.innerHTML = asked
      + (res.summary ? `<article class="dhikr virtue"><div class="dhikr-text" lang="ar" dir="rtl">${esc(res.summary)}</div></article>` : "")
      + `<h2 class="section-title">${esc(t("faqih.quotes"))}</h2><div class="list">${rows.join("")}</div>`
      + `<p class="riwayah-note">${esc(t("kutub.source"))}</p>` + scholars();
  }

  return { render };
}
