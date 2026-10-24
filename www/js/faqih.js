/* ===== الباحث الفقهي: what the books say about a question, word for word, with the place of each quotation ===== */
// The question goes to the server in faqih/ (a Cloudflare Worker): it finds the passages of the books of www/kutub
// nearest to the question in its index, has a model restate what they say, and sends back only the quotations that
// are really in those passages, each with its book, pages and place in the reader (faqih/README.md). It is a search
// of the books, never a fatwa: it does not choose between the scholars' views and does not answer personal cases.
const FAQIH = { url: "" }; // the question server, once deployed (faqih/README.md); scripts/check-sources.js reads it
const SCHOLARS = [["IslamQA", "https://islamqa.info/ar"], ["إسلام ويب", "https://www.islamweb.net/ar/fatwa/"]];
const EXAMPLES = ["ما حكم الوضوء بالنبيذ؟", "هل تجب الزكاة في حلي المرأة؟", "ما حكم الجمع بين الصلاتين في المطر؟", "هل يصح صوم من أكل ناسيًا؟"];

export function setupFaqih(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, LS, setHeader, setNav, toast } = ctx;
  // On localhost a server started with wrangler dev: localStorage.faqihServer = JSON.stringify({ url: "http://localhost:8787" })
  const server = () => { const dev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && LS.get("faqihServer", null); return dev?.url ? dev : FAQIH; };
  const state = Object.assign({ q: "", last: null }, LS.get("faqih", {})); // the last question and its answer, shown again when the page reopens
  const save = () => LS.set("faqih", state);
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";
  let IX = null;
  const loadIndex = async () => { if (!IX) { const r = await fetch("kutub/index.json"); if (!r.ok) throw new Error("HTTP " + r.status); IX = await r.json(); } return IX; };
  const loading = msg => `<div class="empty"><div class="spinner"></div><div>${esc(msg)}</div></div>`;
  const pageNo = (v, p) => (v ? t("kutub.vol", { n: num(Number(v) || v) }) + sep() : "") + t("kutub.page", { n: num(p) });
  // Printed pages of the passage, as the reader shows them: «ج ٢، ص ١٠–١٢».
  const pagesOf = it => {
    if (it.pg0 == null) return "";
    if ((it.v0 || "") !== (it.v1 || "")) return `${pageNo(it.v0, it.pg0)} – ${pageNo(it.v1, it.pg1)}`;
    return (it.v0 ? t("kutub.vol", { n: num(Number(it.v0) || it.v0) }) + sep() : "") + (it.pg0 === it.pg1 ? t("kutub.page", { n: num(it.pg0) }) : t("kutub.pages", { from: num(it.pg0), to: num(it.pg1) }));
  };
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
    else if (state.last) loadIndex().then(() => { if (!stale(location.hash)) show(state.last); }).catch(() => show(state.last));
  }

  async function ask(raw) {
    const q = String(raw || "").replace(/\s+/g, " ").trim(); if (q.length < 3) return;
    const srv = server(); if (!srv.url) { toast(t("faqih.notReady")); return; }
    const hash = location.hash; state.q = q; save();
    const out = $("#fq-out"), btn = $("#fq-form .btn");
    out.innerHTML = loading(t("faqih.searching")); btn.classList.add("busy"); $("#fq-q").blur();
    try {
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
      const msg = e.status === 429 ? t("faqih.tooMany") : e.status === 503 ? t("faqih.busy") : e.status === 400 ? t("faqih.arabicOnly") : t("common.loadFailed");
      out.innerHTML = `<div class="empty">${esc(msg)}</div>`;
    } finally { btn.classList.remove("busy"); }
  }

  function show({ q, res }) {
    const out = $("#fq-out"); if (!out) return;
    const asked = `<h2 class="section-title fq-q" lang="ar" dir="rtl">${esc(q)}</h2>`;
    if (res.status !== "answer" || !res.items?.length) {
      out.innerHTML = asked + `<div class="empty"><div>${esc(t(res.status === "refer_to_scholar" ? "faqih.referScholar" : "faqih.notFound"))}</div>${scholars()}</div>`;
      return;
    }
    const rows = res.items.map(it => {
      const b = IX?.books.find(x => x.id === it.b);
      const title = b ? (isAr() ? b.ar : b.en) + "، " + (isAr() ? b.by : b.byEn) : it.b;
      const where = [title, pagesOf(it)].filter(Boolean).join(sep());
      return `<a href="#/kutub/${it.b}/${it.s}?p=${it.p0}" title="${esc(t("kutub.start"))}"><div class="lbl"><span class="sub" lang="ar" dir="rtl">${esc(where)}</span><span class="kt-snip" lang="ar" dir="rtl">«${esc(it.quote)}»</span>${it.note ? `<span class="sub" lang="ar" dir="rtl">${esc(it.note)}</span>` : ""}</div>${icon("back", "chev")}</a>`;
    });
    out.innerHTML = asked
      + (res.summary ? `<article class="dhikr virtue"><div class="dhikr-text" lang="ar" dir="rtl">${esc(res.summary)}</div></article>` : "")
      + `<h2 class="section-title">${esc(t("faqih.quotes"))}</h2><div class="list">${rows.join("")}</div>`
      + `<p class="riwayah-note">${esc(t("kutub.source"))}</p>` + scholars();
  }

  return { render };
}
