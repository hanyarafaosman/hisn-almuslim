/* ===== أسماء الله الحسنى الثابتة في الكتاب والسنة، وشرحها ===== */
// «شرح أسماء الله الحسنى في ضوء الكتاب والسنة» by Saʿid ibn ʿAli ibn Wahf al-Qahtani, the author of Hisn al-Muslim:
// 99 names, each with its proof from the Quran or Sunnah, approved by Shaykh Ibn Baz and explained from the scholars.
// asma/book.json is the book word for word (scripts/build-asma.js), split into its chapters and name entries.

export function setupAsma(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, setHeader, setNav, copyText, share, SITE } = ctx;
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";
  const shown = s => ctx.tashkeel() ? s : ctx.stripTashkeel(s);
  const ch = (...cps) => String.fromCodePoint(...cps);
  const REF = new RegExp(ch(0x27E6) + "(\\d+)" + ch(0x27E7), "g"); // ⟦n⟧: footnote n of the same entry

  let BOOK = null;
  async function load() { if (!BOOK) { const r = await fetch("asma/book.json"); if (!r.ok) throw new Error("HTTP " + r.status); BOOK = await r.json(); } return BOOK; }
  const nameOf = n => BOOK.names[n - 1];
  const groupOfName = n => BOOK.groups[nameOf(n).g];
  const bookTitle = () => isAr() ? BOOK.source.title : t("asma.bookName");
  const loading = () => `<div class="empty"><div class="spinner"></div><div>${esc(t("common.loading"))}</div></div>`;
  const failed = (err, retry) => {
    const offline = !navigator.onLine || err instanceof TypeError;
    view.innerHTML = `<div class="empty">${icon("download")}<div>${esc(t(offline ? "offline.needOnce" : "common.loadFailed"))}</div><br><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`;
    $("#retry").onclick = retry;
  };

  // Paragraphs of the book: Quran verses marked, footnote references as small numbers that jump to the note.
  const para = p => esc(shown(p)).replace(/﴿([^﴾]{1,2000})﴾/g, '<span class="q">﴿$1﴾</span>').replace(REF, (m, n) => `<button class="fn-ref" type="button" data-fn="${n}" aria-label="${esc(t("asma.note", { n: Number(n) }))}">${num(Number(n))}</button>`);
  const bodyHtml = body => body.map(x => x.h != null ? `<h3 class="asma-h">${esc(shown(x.h))}</h3>` : `<p>${para(x.p)}</p>`).join("");
  const notesHtml = notes => notes.length ? `<section class="asma-notes"><h3>${esc(t("asma.notes"))}</h3><ol>${notes.map((x, i) => `<li id="fn-${i + 1}" value="${i + 1}"><span class="fn-num">${num(i + 1)}</span> <span>${esc(shown(x)).replace(/\n/g, "<br>")}</span></li>`).join("")}</ol></section>` : "";
  const pagesLabel = ([a, b]) => a === b ? t("asma.page", { n: a }) : t("asma.pages", { from: a, to: b });
  const plainBody = (body, notes) => body.map(x => x.h ?? x.p).join("\n").replace(REF, (m, n) => `(${num(Number(n))})`) + (notes.length ? "\n\n" + notes.map((x, i) => `(${num(i + 1)}) ${x}`).join("\n") : "");
  function bindNotes(root) {
    root.addEventListener("click", e => {
      const r = e.target.closest("[data-fn]"); if (!r) return;
      const li = document.getElementById("fn-" + r.dataset.fn); if (!li) return;
      li.scrollIntoView({ behavior: "smooth", block: "center" }); li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 1800);
    });
  }
  // Search ignores diacritics, the article and letter forms: "رحيم" finds الرَّحِيمُ.
  const key = s => String(s).normalize("NFD").replace(/\p{M}/gu, "").replace(/ـ/g, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/^ال/, "").replace(/\s+/g, " ").trim();

  // ---------- the names ----------
  let query = "";
  async function renderIndex() {
    setNav("more"); setHeader(t("asma.title"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    try { await load(); } catch (e) { return stale(hash) || failed(e, renderIndex); }
    if (stale(hash)) return;
    view.innerHTML = `
      <section class="hero slim asma-hero"><h2 lang="ar" dir="rtl">${esc(BOOK.source.title)}</h2><p>${esc(t("asma.author"))}</p></section>
      <p class="riwayah-note">${esc(t("asma.intro"))}</p>
      ${isAr() ? "" : `<div class="info">${icon("translate")}<div>${esc(t("asma.arabicOnly"))}</div></div>`}
      <details class="card asma-method"><summary>${icon("book")} ${esc(t("asma.method"))}</summary><div class="about" lang="ar" dir="rtl">${esc(shown(BOOK.namesNote)).replace(/\n/g, "<br>")}</div></details>
      <div class="searchbox">${icon("search")}<input id="aq" type="search" placeholder="${esc(t("asma.search"))}" value="${esc(query)}" autocomplete="off"></div>
      <div class="asma-grid" id="agrid"></div>
      <h2 class="section-title">${esc(t("asma.chapters"))}</h2>
      <div class="list">${BOOK.chapters.map((c, i) => c.body.length ? `<a href="#/asma/c/${i}"><div class="num">${num(i + 1)}</div><div class="lbl" lang="ar" dir="rtl">${esc(c.title)}<span class="sub">${esc(pagesLabel(c.pages))}</span></div>${icon("back", "chev")}</a>` : "").join("")}</div>
      <p class="source-note">${esc(t("asma.source", { book: bookTitle() }))}</p>`;
    const draw = () => {
      const q = key(query);
      $("#agrid").innerHTML = BOOK.names.filter(x => !q || key(x.plain).includes(q) || String(x.n) === query.trim() || num(x.n) === query.trim())
        .map(x => `<a class="asma-tile" href="#/asma/${x.n}"><span class="n">${num(x.n)}</span><span class="nm" lang="ar" dir="rtl">${esc(shown(x.name))}</span></a>`).join("") || `<div class="empty">${esc(t("common.noResults"))}</div>`;
    };
    draw(); $("#aq").oninput = e => { query = e.target.value; draw(); };
  }

  // ---------- one name (with the names explained together with it) ----------
  async function renderName(n) {
    setNav("more"); setHeader(t("asma.title"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    try { await load(); } catch (e) { return stale(hash) || failed(e, () => renderName(n)); }
    if (stale(hash)) return;
    if (!(n >= 1 && n <= BOOK.names.length)) { location.replace("#/asma"); return; }
    const x = nameOf(n); const g = groupOfName(n); const gi = x.g;
    const prev = BOOK.groups[gi - 1], next = BOOK.groups[gi + 1];
    const label = grp => grp.names.map(m => nameOf(m).plain).join(sep());
    setHeader(x.plain, { back: true, actions: `<button class="icon-btn" id="a-copy" aria-label="${esc(t("common.copy"))}">${icon("copy")}</button><button class="icon-btn" id="a-share" aria-label="${esc(t("common.share"))}">${icon("share")}</button>` });
    view.innerHTML = `
      <section class="asma-head">
        <div class="asma-names">${g.names.map(m => `<a class="asma-name ${m === n ? "on" : ""}" href="#/asma/${m}" ${m === n ? 'aria-current="true"' : ""}><span class="n">${num(m)}</span><span class="nm" lang="ar" dir="rtl">${esc(shown(nameOf(m).name))}</span></a>`).join("")}${g.head ? g.head.map(k => `<button class="fn-ref" type="button" data-fn="${k}" aria-label="${esc(t("asma.note", { n: k }))}">${num(k)}</button>`).join("") : ""}</div>
        ${g.names.length > 1 ? `<p class="asma-together">${esc(t("asma.together"))}</p>` : ""}
      </section>
      <article class="asma-text" lang="ar" dir="rtl">${bodyHtml(g.body)}</article>
      ${notesHtml(g.notes)}
      <p class="source-note">${esc(bookTitle())}${sep()}${esc(pagesLabel(g.pages))}</p>
      <nav class="reader-nav">
        ${prev ? `<a class="btn ghost" href="#/asma/${prev.names[0]}" data-replace>${icon("back", "dir")} <span lang="ar">${esc(label(prev))}</span></a>` : "<span></span>"}
        ${next ? `<a class="btn ghost" href="#/asma/${next.names[0]}" data-replace>${`<span lang="ar">${esc(label(next))}</span>`} ${icon("back", "flip")}</a>` : "<span></span>"}
      </nav>`;
    view.querySelectorAll("[data-replace]").forEach(a => a.onclick = e => { e.preventDefault(); location.replace(a.getAttribute("href")); });
    bindNotes(view);
    const names = g.names.map(m => nameOf(m).plain).join(sep());
    const plain = () => `${names}\n\n${plainBody(g.body, g.notes)}\n\n— ${BOOK.source.title}، ${BOOK.source.author}، ${pagesLabel(g.pages)}`;
    $("#a-copy").onclick = () => copyText(plain());
    $("#a-share").onclick = () => share(t("asma.title"), `${plain()}\n${SITE}#/asma/${n}`);
  }

  // ---------- a chapter of the book ----------
  async function renderChapter(i) {
    setNav("more"); setHeader(t("asma.title"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    try { await load(); } catch (e) { return stale(hash) || failed(e, () => renderChapter(i)); }
    if (stale(hash)) return;
    const list = BOOK.chapters.map((c, k) => [c, k]).filter(([c]) => c.body.length);
    const at = list.findIndex(([, k]) => k === i); if (at < 0) { location.replace("#/asma"); return; }
    const c = BOOK.chapters[i]; const prev = list[at - 1], next = list[at + 1];
    setHeader(c.title.replace(/:.*$/, ""), { back: true });
    view.innerHTML = `
      <h2 class="asma-chapter" lang="ar" dir="rtl">${esc(c.title)}</h2>
      <article class="asma-text" lang="ar" dir="rtl">${bodyHtml(c.body)}</article>
      ${notesHtml(c.notes)}
      <p class="source-note">${esc(bookTitle())}${sep()}${esc(pagesLabel(c.pages))}</p>
      <nav class="reader-nav">
        ${prev ? `<a class="btn ghost" href="#/asma/c/${prev[1]}" data-replace>${icon("back", "dir")} ${esc(prev[0].title.replace(/:.*$/, ""))}</a>` : "<span></span>"}
        ${next ? `<a class="btn ghost" href="#/asma/c/${next[1]}" data-replace>${esc(next[0].title.replace(/:.*$/, ""))} ${icon("back", "flip")}</a>` : "<span></span>"}
      </nav>`;
    view.querySelectorAll("[data-replace]").forEach(a => a.onclick = e => { e.preventDefault(); location.replace(a.getAttribute("href")); });
    bindNotes(view);
  }

  // Names matching a query, for the Home search.
  async function search(q) {
    const k = key(q); if (k.length < 2) return [];
    await load();
    return BOOK.names.filter(x => key(x.plain).includes(k)).map(x => ({ n: x.n, name: x.plain, href: `#/asma/${x.n}` }));
  }

  return {
    render(parts) {
      if (!parts.length) return renderIndex();
      if (parts[0] === "c") return renderChapter(Number(parts[1]));
      return renderName(Number(parts[0]));
    },
    search,
  };
}
