/* ===== العقيدة والفقه: متون عقيدة أهل السنة والجماعة، والمتن المعتمد في كل مذهب من المذاهب الأربعة ===== */
// kutub/index.json lists the books; each book is kutub/<id>.<hash>.json (scripts/build-kutub.js): the printed
// edition word for word from turath.io, split at the book's own headings, footnotes numbered on each reading page.
// A book is one file, kept on the device after it is first opened (cache below, see sw.js).

const KUTUB_CACHE = "hisn-kutub-v1";

export function setupKutub(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, LS, setHeader, setNav, copyText, share, SITE, Q } = ctx;
  const state = Object.assign({ last: null, at: {} }, LS.get("kutub", {})); // last book, and the page read last in each book
  const save = () => LS.set("kutub", state);
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";
  const shown = s => ctx.tashkeel() ? s : ctx.stripTashkeel(s);
  const ch = (...cps) => String.fromCodePoint(...cps);
  const REF = new RegExp(ch(0x27E6) + "(\\d+)" + ch(0x27E7), "g"); // ⟦n⟧: footnote n of the same reading page

  // ---------- data ----------
  let IX = null; const BOOKS = new Map();
  async function loadIndex() {
    if (!IX) { const r = await fetch("kutub/index.json"); if (!r.ok) throw new Error("HTTP " + r.status); IX = await r.json(); prune(); }
    return IX;
  }
  function loadBook(b) {
    if (!BOOKS.has(b.id)) BOOKS.set(b.id, fetch("kutub/" + b.file).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch(e => { BOOKS.delete(b.id); throw e; }));
    return BOOKS.get(b.id);
  }
  // Copies of books that were corrected since: every file name carries a hash of its text.
  function prune() {
    if (!("caches" in window)) return;
    caches.open(KUTUB_CACHE).then(async c => {
      const keep = new Set(IX.books.map(b => b.file));
      for (const r of await c.keys()) if (!keep.has(new URL(r.url).pathname.split("/").pop())) await c.delete(r);
    }).catch(() => {});
  }
  const bookOf = id => IX.books.find(b => b.id === id);
  const title = b => isAr() ? b.ar : b.en;
  const by = b => `${isAr() ? b.by : b.byEn} (${t("kutub.died", { year: num(b.died) })})`;
  const pagesLabel = ([a, b]) => a == null ? "" : a === b ? t("kutub.page", { n: num(a) }) : t("kutub.pages", { from: num(a), to: num(b) });
  const readable = book => book.sections.map((s, i) => [s, i]).filter(([s]) => s.body);
  // The heading a reading page sits under (for example «كتاب الطهارة» above «باب الآنية»).
  const parentOf = (book, i) => { const l = book.sections[i].l; for (let k = i - 1; k >= 0; k--) if (book.sections[k].l < l) return book.sections[k]; return null; };

  const loading = () => `<div class="empty"><div class="spinner"></div><div>${esc(t("common.loading"))}</div></div>`;
  const failed = (err, retry) => {
    const offline = !navigator.onLine || err instanceof TypeError;
    view.innerHTML = `<div class="empty">${icon("download")}<div>${esc(t(offline ? "offline.needOnce" : "common.loadFailed"))}</div><br><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`;
    $("#retry").onclick = retry;
  };

  // ---------- the text ----------
  const refBtn = n => `<button class="fn-ref" type="button" data-fn="${n}" aria-label="${esc(t("kutub.note", { n: num(Number(n)) }))}">${num(Number(n))}</button>`;
  const para = s => esc(shown(s)).replace(/﴿([^﴾]{1,3000})﴾/g, '<span class="q">﴿$1﴾</span>').replace(REF, (m, n) => refBtn(n));
  const bodyHtml = body => body.map((x, i) =>
    x.sep ? `<p class="kt-sep" aria-hidden="true">* * *</p>`
    : x.h != null ? `<h3 class="kt-h l${Math.min(x.l, 3)}" id="k-${x.a}">${para(x.h)}</h3>`
    : `<p id="kp-${i}"${x.a ? ` data-a="${x.a}"` : ""}>${para(x.p)}</p>`).join("");
  const notesHtml = notes => notes?.length ? `<section class="asma-notes"><h3>${esc(t("kutub.notes"))}</h3><ol>${notes.map((x, i) => `<li id="fn-${i + 1}" value="${i + 1}"><span class="fn-num">${num(i + 1)}</span> <span>${para(x).replace(/\n/g, "<br>")}</span></li>`).join("")}</ol></section>` : "";
  const plainText = s => s.replace(REF, (m, n) => `(${num(Number(n))})`);
  const flash = el => { if (!el) return; el.scrollIntoView({ block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1800); };

  // Search ignores diacritics and letter forms. Folding keeps one character for one, so a match found in the
  // folded text is at the same place in the text without diacritics.
  const fold = s => ctx.stripTashkeel(String(s).replace(REF, "")).replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
  const terms = q => fold(q).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  function snippet(text, want) {
    const plain = ctx.stripTashkeel(text.replace(REF, "")), f = fold(text);
    const k = f.indexOf(want[0]); const from = Math.max(0, k - 40), to = Math.min(plain.length, k + 120);
    const marks = [];
    for (const w of want) for (let x = f.indexOf(w, from); x >= 0 && x < to; x = f.indexOf(w, x + w.length)) marks.push([x, Math.min(to, x + w.length)]);
    marks.sort((a, b) => a[0] - b[0]);
    let html = "", pos = from;
    for (const [a, b] of marks) { if (a < pos) continue; html += esc(plain.slice(pos, a)) + `<mark>${esc(plain.slice(a, b))}</mark>`; pos = b; }
    return (from ? "…" : "") + html + esc(plain.slice(pos, to)) + (to < plain.length ? "…" : "");
  }

  // ---------- the library ----------
  function bookRow(b) {
    const madhhab = b.madhhab ? t("kutub." + b.madhhab) + sep() : "";
    return `<a href="#/kutub/${b.id}"><div class="num">${icon(b.group === "fiqh" ? "fiqh" : "kutub")}</div><div class="lbl">${esc(title(b))}${isAr() ? "" : ` <span class="ar-name" lang="ar" dir="rtl">${esc(b.ar)}</span>`}<span class="sub">${esc(madhhab + by(b))}</span></div>${icon("back", "chev")}</a>`;
  }
  async function renderLibrary() {
    setNav("more"); setHeader(t("kutub.title"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    try { await loadIndex(); } catch (e) { return stale(hash) || failed(e, renderLibrary); }
    if (stale(hash)) return;
    const last = state.last && bookOf(state.last), at = last && state.at[last.id];
    const group = g => IX.books.filter(b => b.group === g).map(bookRow).join("");
    view.innerHTML = `
      ${last && at ? `<div class="resume-row"><a class="resume" href="#/kutub/${last.id}/${at.s}">${icon("kutub")}<div><b>${esc(t("kutub.continue"))}</b><span>${esc(title(last))}${at.t ? `${esc(sep())}<span lang="ar" dir="rtl">${esc(at.t)}</span>` : ""}</span></div></a></div>` : ""}
      <p class="riwayah-note">${esc(t("kutub.intro"))}</p>
      ${isAr() ? "" : `<div class="info">${icon("translate")}<div>${esc(t("kutub.arabicOnly"))}</div></div>`}
      <h2 class="section-title">${esc(t("kutub.aqida"))}</h2>
      <p class="kt-intro">${esc(t("kutub.aqidaIntro"))}</p>
      <div class="list">${group("aqida")}</div>
      <h2 class="section-title">${esc(t("kutub.fiqh"))}</h2>
      <p class="kt-intro">${esc(t("kutub.fiqhIntro"))}</p>
      <div class="list">${group("fiqh")}</div>
      <p class="source-note">${esc(t("kutub.offline"))}</p>`;
  }

  // ---------- one book: about it, its contents, search ----------
  const queries = {};
  async function renderBook(id) {
    setNav("more"); setHeader(t("kutub.title"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    let b, book;
    try { await loadIndex(); b = bookOf(id); if (!b) { location.replace("#/kutub"); return; } book = await loadBook(b); }
    catch (e) { return stale(hash) || failed(e, () => renderBook(id)); }
    if (stale(hash)) return;
    setHeader(title(b), { back: true });
    const at = state.at[id]; const first = readable(book)[0][1];
    const link = e => `#/kutub/${id}/${e.s}${e.a ? `?a=${e.a}` : e.fn ? `?fn=${e.fn}` : ""}`;
    // A heading whose page has no text of its own is a group title; the rows under it are indented by level.
    const top = Math.min(...book.toc.map(e => e.l));
    const toc = book.toc.map(e => book.sections[e.s].body || e.a || e.fn
      ? `<a class="kt-row" style="--lv:${e.l - top}" href="${link(e)}"><div class="lbl" lang="ar" dir="rtl">${esc(shown(e.t))}</div>${icon("back", "chev")}</a>`
      : `<div class="kt-group" style="--lv:${e.l - top}" lang="ar" dir="rtl">${esc(shown(e.t))}</div>`).join("");
    view.innerHTML = `
      <section class="hero slim kt-hero"><h2 lang="ar" dir="rtl">${esc(b.ar)}</h2>${isAr() ? "" : `<p>${esc(b.en)}</p>`}<p>${esc((b.madhhab ? t("kutub." + b.madhhab) + sep() : "") + by(b))}</p></section>
      <p class="riwayah-note">${esc(isAr() ? b.about : b.aboutEn)}</p>
      <div class="kt-actions"><a class="btn" href="#/kutub/${id}/${at ? at.s : first}">${icon("book")} ${esc(t(at ? "kutub.continue" : "kutub.start"))}</a></div>
      <div class="searchbox">${icon("search")}<input id="kq" type="search" placeholder="${esc(t("kutub.search"))}" value="${esc(queries[id] || "")}" autocomplete="off" enterkeyhint="search"></div>
      <div id="kres"></div>
      <div id="ktoc"><h2 class="section-title">${esc(t("kutub.contents"))}</h2><div class="list kt-toc">${toc}</div></div>
      <details class="card asma-method kt-edition"><summary>${icon("book")} ${esc(t("kutub.edition"))}</summary><div class="about" lang="ar" dir="rtl">${esc(b.edition).replace(/\n/g, "<br>")}</div></details>
      <p class="source-note"><a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(t("kutub.source"))}</a></p>`;

    // Search the whole book: every word of the query, in paragraphs, headings and footnotes.
    let timer = 0;
    const draw = () => {
      const q = (queries[id] = $("#kq").value).trim(); const want = terms(q);
      $("#ktoc").hidden = want.length > 0 && q.length >= 2;
      if (q.length < 2 || !want.length) { $("#kres").innerHTML = ""; return; }
      const hits = [];
      book.sections.forEach((s, si) => {
        const rows = (s.body || []).map((x, i) => [x.p ?? x.h, x.h != null ? `a=${x.a}` : `p=${i}`]).concat((s.notes || []).map((x, i) => [x, `fn=${i + 1}`]));
        for (const [text, at] of rows) {
          if (text == null || hits.length >= 100) continue;
          const f = fold(text); if (!want.every(w => f.includes(w))) continue;
          hits.push(`<a href="#/kutub/${id}/${si}?${at}"><div class="lbl"><span class="sub" lang="ar" dir="rtl">${esc(s.t)}</span><span class="kt-snip" lang="ar" dir="rtl">${snippet(text, want)}</span></div>${icon("back", "chev")}</a>`);
        }
      });
      $("#kres").innerHTML = `<h2 class="section-title">${esc(t("count.results", { n: hits.length }))}</h2>` + (hits.length ? `<div class="list">${hits.join("")}</div>` : `<div class="empty">${esc(t("common.noResults"))}</div>`);
    };
    $("#kq").oninput = () => { clearTimeout(timer); timer = setTimeout(draw, 200); };
    if (queries[id]) draw();
  }

  // ---------- a reading page ----------
  async function renderPage(id, i, params) {
    setNav("more"); setHeader(t("kutub.title"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    let b, book;
    try { await loadIndex(); b = bookOf(id); if (!b) { location.replace("#/kutub"); return; } book = await loadBook(b); }
    catch (e) { return stale(hash) || failed(e, () => renderPage(id, i, params)); }
    if (stale(hash)) return;
    const s = book.sections[i];
    if (!s?.body) { location.replace(`#/kutub/${id}`); return; }
    const list = readable(book); const at = list.findIndex(([, k]) => k === i);
    const prev = list[at - 1], next = list[at + 1];
    const parent = parentOf(book, i);
    const single = list.length === 1;
    // «مدخل» is turath.io's name for the text of a «كتاب» before its first «باب»: the header names the «كتاب».
    const name = s.t === "مدخل" && parent ? parent.t : s.t;
    state.last = id; state.at[id] = { s: i, t: single ? "" : name }; save();
    setHeader(single ? title(b) : name, { back: true, actions: `<a class="icon-btn" href="#/kutub/${id}" aria-label="${esc(t("kutub.contents"))}">${icon("list")}</a><button class="icon-btn" id="k-copy" aria-label="${esc(t("common.copy"))}">${icon("copy")}</button><button class="icon-btn" id="k-share" aria-label="${esc(t("common.share"))}">${icon("share")}</button>` });
    const navBtn = (x, side) => x ? `<a class="btn ghost" href="#/kutub/${id}/${x[1]}" data-replace>${side === "prev" ? `${icon("back", "dir")} ` : ""}<span lang="ar" dir="rtl">${esc(x[0].t)}</span>${side === "next" ? ` ${icon("back", "flip")}` : ""}</a>` : "<span></span>";
    view.innerHTML = `<div id="kt-page">
      <a class="kt-crumb" href="#/kutub/${id}" lang="ar" dir="rtl">${esc(b.ar)}${parent && !single ? ` ‹ ${esc(shown(parent.t))}` : ""}</a>
      ${s.il || single ? "" : `<h2 class="asma-chapter kt-title" lang="ar" dir="rtl">${para(s.th || s.t)}</h2>`}
      <article class="asma-text kt-text" lang="ar" dir="rtl">${bodyHtml(s.body)}</article>
      ${notesHtml(s.notes)}
      <p class="source-note">${esc(b.ar)}${s.pg && s.pg[0] != null ? esc(sep() + pagesLabel(s.pg)) : ""}</p>
      ${single ? "" : `<nav class="reader-nav">${navBtn(prev, "prev")}${navBtn(next, "next")}</nav>`}</div>`;
    view.querySelectorAll("[data-replace]").forEach(a => a.onclick = e => { e.preventDefault(); location.replace(a.getAttribute("href")); });
    // A footnote number shows its note at once; the notes are also listed under the text.
    $("#kt-page").addEventListener("click", e => {
      const r = e.target.closest("[data-fn]"); if (!r) return;
      const n = Number(r.dataset.fn); const note = s.notes?.[n - 1]; if (note == null) return;
      Q.sheet(t("kutub.note", { n: num(n) }), `<div class="asma-text kt-note" lang="ar" dir="rtl">${para(note).replace(/\n/g, "<br>")}</div>`);
    });
    const plain = () => [s.il || single ? "" : plainText(s.th || s.t), ...s.body.map(x => x.sep ? "* * *" : plainText(x.p ?? x.h))].filter(Boolean).join("\n")
      + (s.notes?.length ? "\n\n" + s.notes.map((x, k) => `(${num(k + 1)}) ${plainText(x)}`).join("\n") : "")
      + `\n\n— ${b.ar}، ${b.by}${s.pg && s.pg[0] != null ? "، " + pagesLabel(s.pg) : ""}`;
    $("#k-copy").onclick = () => copyText(plain());
    $("#k-share").onclick = () => share(b.ar, `${single ? b.ar : `${name}\n— ${b.ar}`}\n${SITE}#/kutub/${id}/${i}`);
    // Opened at a heading, a search result or a footnote.
    const where = params.get("a") ? view.querySelector(`#k-${CSS.escape(params.get("a"))}, [data-a="${CSS.escape(params.get("a"))}"]`)
      : params.get("p") ? document.getElementById("kp-" + params.get("p"))
      : params.get("fn") ? document.getElementById("fn-" + params.get("fn")) : null;
    if (where) setTimeout(() => flash(where), 50);
  }

  // Books whose title or author matches, for the Home search.
  async function search(q) {
    const want = terms(q); if (want.join("").length < 2) return [];
    await loadIndex();
    const k = b => fold([b.ar, b.en, b.by, b.byEn, b.madhhab ? t("kutub." + b.madhhab) : ""].join(" ")).toLowerCase();
    return IX.books.filter(b => want.every(w => k(b).includes(w.toLowerCase()))).map(b => ({ href: `#/kutub/${b.id}`, name: title(b), sub: by(b), icon: b.group === "fiqh" ? "fiqh" : "kutub" }));
  }

  return {
    render(parts, params) {
      if (!parts.length) return renderLibrary();
      if (parts.length === 1) return renderBook(parts[0]);
      return renderPage(parts[0], Number(parts[1]), params);
    },
    search,
  };
}
