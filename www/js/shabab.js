/* ===== رسائل إلى الشباب (#/shabab): عقيدة الفرقة الناجية وأصول الاعتقاد، والتحذير من التكفير والغلو والفُرقة ===== */
// #/shabab lists the messages and the scholars' treatises; #/shabab/<id> is one message: a short note, then its
// evidence. The texts are in data/shabab.json (scripts/build-shabab.js), each copied word for word from its source:
// the verses from the Mushaf's text, the hadith from the hadith books the app reads (each opens in the hadith reader,
// where its chain, gradings and translations are), and the scholars' words from the books of the library (each opens
// at its place in the book). The treatises themselves are read whole in the library (#/kutub, the shelf «رسائل إلى
// الشباب»). Nothing Arabic is translated here: readers of other languages get each message's name and note (interface
// strings), the meaning of the verses in their chosen translation (QuranEnc), the hadith's translations in the hadith
// reader, and the scholars' words folded under «the text from its source».

export function setupShabab(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, share, SITE, setHeader, setNav, version, Q } = ctx;
  const T = (k, p) => esc(t(k, p));
  const isAr = () => getLang() === "ar";
  const stale = hash => location.hash !== hash;

  let DATA = null, names = n => String(n);
  async function load() {
    DATA ||= await fetch(`data/shabab.json?v=${version}`).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
    names = await Q.surahNames().catch(() => names);
  }
  const loading = () => `<div class="empty"><div class="spinner"></div><div>${T("common.loading")}</div></div>`;
  function failed(e, retry) {
    view.innerHTML = `<div class="empty">${icon("download")}<div>${T(!navigator.onLine || e instanceof TypeError ? "offline.needOnce" : "common.loadFailed")}</div><br><button class="btn" id="retry">${T("common.retry")}</button></div>`;
    $("#retry").onclick = retry;
  }

  // ---------- the pieces of a message ----------
  const head = (ic, text, extra = "") => `<div class="rm-h">${icon(ic)}<b>${esc(text)}</b>${extra}</div>`;
  const bookName = id => { const b = DATA.books[id]; return b ? b[isAr() ? 0 : 1] : id; };
  const bookBy = id => { const b = DATA.books[id]; return b ? b[isAr() ? 2 : 3] : ""; };
  // A verse with its place in the Mushaf; its meaning is filled in for readers of other languages (wire).
  function verseHtml(ref) {
    const v = DATA.verses[ref]; if (!v) return "";
    const label = `${names(v.s)}${sep()}${num(v.from === v.to ? String(v.from) : `${v.from}–${v.to}`)}`;
    return `<div class="g-ev g-q"><p class="g-aya" lang="ar" dir="rtl">﴿${v.text.map((a, i) => `${esc(a)} <span class="g-n">${esc(num(v.from + i))}</span>`).join(" ")}﴾</p>
      ${v.text.map((a, i) => `<p class="g-tr" data-s="${v.s}" data-a="${v.from + i}" hidden></p>`).join("")}
      <a class="g-ref" href="#/quran/hafs/${v.s}${v.from > 1 ? "?a=" + v.from : ""}">${icon("quran")}<span>${esc(label)}</span>${icon("back", "flip")}</a></div>`;
  }
  // A hadith: who narrated it, the part quoted, and where it opens in the hadith reader. A hadith of the Sunan
  // carries al-Albani's grading.
  function hadithHtml(h) {
    const [book, n, sec] = h.ref, nm = DATA.hbooks[book] || [book, book];
    const grade = h.g ? `<span class="badge good">${T("shabab." + h.g)}</span>` : "";
    return `<article class="rm-card sh-hadith"><p class="rm-by" lang="ar" dir="rtl">${esc(h.by)}:</p>
      <p class="rm-hadith" lang="ar" dir="rtl">«${esc(h.t)}»</p>${grade}
      <a class="g-ref" href="#/hadith/${book}/${sec}?h=${n}">${icon("books")}<span>${esc(nm[isAr() ? 0 : 1])}</span>${icon("back", "flip")}</a></article>`;
  }
  // The scholars' words, with the book and the place they open at: shown to readers of Arabic, folded for the others.
  const quote = x => `<blockquote class="rm-q" lang="ar" dir="rtl">${esc(x.t).replace(/﴿([^﴾]+)﴾/g, '<span class="q">﴿$1﴾</span>').replace(/\n/g, "<br>")}</blockquote>`;
  const cite = x => `<a class="g-ref" href="#/kutub/${x.k}/${x.s}?p=${x.p}">${icon("kutub")}<span dir="auto">${esc(bookName(x.k))}${bookBy(x.k) ? `<small class="sh-by">${esc(bookBy(x.k))}</small>` : ""}</span>${icon("back", "flip")}</a>`;
  const passageHtml = x => `<article class="rm-card sh-quote">${isAr() ? quote(x) : `<details class="fadl rm-src"><summary>${icon("book")}<span>${T("ramadan.arabicSource")}</span></summary><div class="fadl-body">${quote(x)}</div></details>`}${cite(x)}</article>`;
  const bookRow = id => DATA.books[id] ? `<a href="#/kutub/${id}"><div class="num">${icon("kutub")}</div><div class="lbl">${esc(bookName(id))}${isAr() ? "" : ` <span class="ar-name" lang="ar" dir="rtl">${esc(DATA.books[id][0])}</span>`}<span class="sub">${esc(bookBy(id))}</span></div>${icon("back", "chev")}</a>` : "";
  const themeRow = (th, i) => `<a href="#/shabab/${th.id}"><div class="num">${icon(th.icon)}</div><div class="lbl">${T("shabab.t." + th.id)}<span class="sub">${esc(t("shabab.count", { n: num(i + 1), total: num(DATA.themes.length) }))}</span></div>${icon("back", "chev")}</a>`;

  // The verses' meanings, for readers of other languages (as the seasons' pages do).
  function wire(root, hash) {
    let src = null;
    root.querySelectorAll(".g-tr").forEach(el => Q.ayaMeaning(Number(el.dataset.s), Number(el.dataset.a)).then(m => {
      if (!m?.text || stale(hash) || !el.isConnected) return;
      el.textContent = m.text.replace(/\s*\[\d+\]/g, ""); el.dir = m.meta?.direction === "rtl" ? "rtl" : "ltr"; el.lang = m.meta?.language_iso_code || ""; el.hidden = false;
      if (!src && m.meta) { src = root.querySelector(".g-trsrc"); if (src) { src.textContent = t("quran.trSource", { title: m.meta.title, v: m.meta.version }); src.hidden = false; } }
    }).catch(() => {}));
  }

  // ---------- #/shabab: the word to the youth, the messages, the treatises ----------
  async function renderHome() {
    setNav("more"); const hash = location.hash;
    setHeader(t("shabab.title"), { back: true, actions: `<button class="icon-btn" id="sh-send" aria-label="${T("common.share")}">${icon("share")}</button>` });
    $("#sh-send").onclick = () => share(t("shabab.title"), `${t("shabab.title")}\n${t("shabab.intro")}\n\n— ${t("app.name")}\n${SITE}#/shabab`);
    view.innerHTML = loading();
    try { await load(); } catch (e) { return stale(hash) || failed(e, renderHome); }
    if (stale(hash)) return;
    const lead = DATA.lead;
    view.innerHTML = `
      <section class="hero slim sh-hero"><h2>${T("shabab.title")}</h2><p>${T("shabab.intro")}</p></section>
      ${isAr() ? "" : `<div class="info">${icon("translate")}<div>${T("shabab.arabicNote")}</div></div>`}
      <article class="rm-card sh-lead">${head("heart", t("shabab.leadTitle"))}
        ${isAr() ? "" : `<p class="rm-p">${T("shabab.leadNote")}</p>`}
        ${isAr() ? `<div class="sh-clamp">${quote(lead)}</div><button class="btn ghost sh-more" type="button">${T("hadith.showMore")}</button>` : `<details class="fadl rm-src"><summary>${icon("book")}<span>${T("ramadan.arabicSource")}</span></summary><div class="fadl-body">${quote(lead)}</div></details>`}
        ${cite(lead)}</article>
      <h2 class="section-title">${T("shabab.messages")}</h2>
      <div class="list">${DATA.themes.map(themeRow).join("")}</div>
      <h2 class="section-title">${T("shabab.shelf")}</h2>
      <p class="rm-lead">${T("shabab.shelfNote")}</p>
      ${DATA.shelf.map(([g, list]) => `<h3 class="sh-group">${T("shabab.g." + g)}</h3><div class="list">${list.map(bookRow).join("")}</div>`).join("")}
      <div class="list rm-links"><a href="#/kutub"><div class="num">${icon("kutub")}</div><div class="lbl">${T("kutub.title")}<span class="sub">${T("kutub.aqida")}</span></div>${icon("back", "chev")}</a></div>
      <p class="source-note">${T("shabab.source")}</p>`;
    // The word to the youth opens with its first lines; the rest is a tap away.
    const more = view.querySelector(".sh-more"); if (more) more.onclick = () => { view.querySelector(".sh-clamp").classList.remove("sh-clamp"); more.remove(); };
  }

  // ---------- #/shabab/<id>: one message ----------
  async function renderTheme(id) {
    setNav("more"); const hash = location.hash;
    setHeader(t("shabab.title"), { back: true });
    view.innerHTML = loading();
    try { await load(); } catch (e) { return stale(hash) || failed(e, () => renderTheme(id)); }
    if (stale(hash)) return;
    const at = DATA.themes.findIndex(x => x.id === id), th = DATA.themes[at];
    if (!th) { location.replace("#/shabab"); return; }
    const title = t("shabab.t." + id), prev = DATA.themes[at - 1], next = DATA.themes[at + 1];
    setHeader(title, { back: true, actions: `<a class="icon-btn" href="#/shabab" aria-label="${T("shabab.messages")}">${icon("list")}</a><button class="icon-btn" id="sh-send" aria-label="${T("common.share")}">${icon("share")}</button>` });
    $("#sh-send").onclick = () => share(title, `${title}\n${t("shabab.n." + id)}\n\n— ${t("shabab.title")}${sep()}${t("app.name")}\n${SITE}#/shabab/${id}`);
    const navBtn = (x, side) => x ? `<a class="btn ghost" href="#/shabab/${x.id}" data-replace>${side === "prev" ? `${icon("back", "dir")} ` : ""}<span>${T("shabab.t." + x.id)}</span>${side === "next" ? ` ${icon("back", "flip")}` : ""}</a>` : "<span></span>";
    view.innerHTML = `
      <article class="rm-card sh-note">${head(th.icon, title)}<p class="rm-p">${T("shabab.n." + id)}</p></article>
      ${th.q.length ? `<h2 class="section-title">${T("shabab.quran")}</h2><div class="g-evs rm-verses">${th.q.map(verseHtml).join("")}</div><p class="source-note g-trsrc" hidden></p>` : ""}
      ${th.h.length ? `<h2 class="section-title">${T("shabab.sunnah")}</h2>${th.h.map(hadithHtml).join("")}` : ""}
      ${th.x.length ? `<h2 class="section-title">${T("shabab.ulama")}</h2>${th.x.map(passageHtml).join("")}` : ""}
      <h2 class="section-title">${T("shabab.read")}</h2>
      <div class="list">${th.r.map(bookRow).join("")}</div>
      <nav class="reader-nav">${navBtn(prev, "prev")}${navBtn(next, "next")}</nav>
      <p class="source-note">${T("shabab.source")}</p>`;
    view.querySelectorAll("[data-replace]").forEach(a => a.onclick = e => { e.preventDefault(); location.replace(a.getAttribute("href")); });
    wire(view, hash);
  }

  return { render: parts => parts[0] ? renderTheme(parts[0]) : renderHome() };
}
