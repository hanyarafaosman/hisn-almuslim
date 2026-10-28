/* ===== العقيدة والفقه: متون عقيدة أهل السنة والجماعة، والمذاهب الأربعة، وكتب الأئمة ===== */
// kutub/index.json lists the books (scripts/build-kutub.js): the printed edition word for word from turath.io, split at
// the book's own headings, footnotes numbered on each reading page. A book is kutub/<id>.<hash>.json (its contents and
// reading pages) and the text of its reading pages is in part files kutub/<id>/<n>.<hash>.json of about 250 KB, so a
// reader downloads only the part being read. Every part read is kept on the device (cache below, see sw.js).

const KUTUB_CACHE = "hisn-kutub-v1";
const SEARCH_ALL = 3e6; // books up to this many bytes are searched word by word; bigger ones by their headings

export function setupKutub(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, LS, setHeader, setNav, copyText, share, SITE, Q } = ctx;
  const state = Object.assign({ last: null, at: {}, author: "" }, LS.get("kutub", {})); // last book, the page read last in each book, the author chosen in the library
  const save = () => LS.set("kutub", state);
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";
  const shown = s => ctx.tashkeel() ? s : ctx.stripTashkeel(s);
  const ch = (...cps) => String.fromCodePoint(...cps);
  const REF = new RegExp(ch(0x27E6) + "(\\d+)" + ch(0x27E7), "g"); // ⟦n⟧: footnote n of the same reading page

  // ---------- data ----------
  let IX = null; const HEADS = new Map(), PARTS = new Map();
  const getJSON = (memo, key, url) => {
    if (!memo.has(key)) memo.set(key, fetch(url).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch(e => { memo.delete(key); throw e; }));
    return memo.get(key);
  };
  async function loadIndex() {
    if (!IX) { const r = await fetch("kutub/index.json"); if (!r.ok) throw new Error("HTTP " + r.status); IX = await r.json(); prune(); }
    return IX;
  }
  const loadBook = b => getJSON(HEADS, b.id, "kutub/" + b.file);
  const partUrl = (b, k) => `kutub/${b.id}/${k}.${b.chunks[k]}.json`;
  const loadPart = (b, k) => { while (PARTS.size > 12) PARTS.delete(PARTS.keys().next().value); return getJSON(PARTS, partUrl(b, k), partUrl(b, k)); };
  const textOf = async (b, head, i) => (await loadPart(b, head.sections[i].c))[i];
  // Copies of books and parts that were corrected since: every file name carries a hash of its text.
  function prune() {
    if (!("caches" in window)) return;
    caches.open(KUTUB_CACHE).then(async c => {
      const keep = new Set(IX.books.flatMap(b => ["kutub/" + b.file, ...b.chunks.map((h, k) => partUrl(b, k))]));
      for (const r of await c.keys()) { const p = new URL(r.url).pathname; if (![...keep].some(f => p.endsWith("/" + f))) await c.delete(r); }
    }).catch(() => {});
  }
  const bookOf = id => IX.books.find(b => b.id === id);
  const title = b => isAr() ? b.ar : b.en;
  const by = b => (isAr() ? b.by : b.byEn) + (b.died ? ` (${t("kutub.died", { year: num(b.died) })})` : ""); // an institution has no death year
  const school = b => b.madhhab ? t("kutub." + b.madhhab) + sep() : "";
  const authorName = key => IX.authors[key] ? (isAr() ? IX.authors[key].ar : IX.authors[key].en) : key;
  const pageNo = (v, p) => (v ? t("kutub.vol", { n: num(Number(v) || v) }) + sep() : "") + t("kutub.page", { n: num(p) });
  // Printed pages of a reading page: «ص ١٠–١٢», or with the volume in a book of several: «ج ٢، ص ١٠–١٢».
  const pagesLabel = s => {
    if (!s.pg) return "";
    const [a, b] = s.pg, [va, vb] = s.v || [];
    if (va !== vb) return `${pageNo(va, a)} – ${pageNo(vb, b)}`;
    return (va ? t("kutub.vol", { n: num(Number(va) || va) }) + sep() : "") + (a === b ? t("kutub.page", { n: num(a) }) : t("kutub.pages", { from: num(a), to: num(b) }));
  };
  // A long reading page cut into parts: «الإيمان (٢/١٥)».
  const pageTitle = s => s.pt ? `${s.t} (${num(s.pt[0])}/${num(s.pt[1])})` : s.t;
  const readable = head => head.sections.map((s, i) => [s, i]).filter(([s]) => s.c != null);
  // The heading a reading page sits under (for example «كتاب الطهارة» above «باب الآنية»).
  const parentOf = (head, i) => { const l = head.sections[i].l; for (let k = i - 1; k >= 0; k--) if (head.sections[k].l < l) return head.sections[k]; return null; };

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
  // A joined «عبدالله» is searched as «عبد» + «الله», so it finds the name written either way.
  const terms = q => fold(q).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/(^|\s)عبد(?=ال)/g, "$1عبد ").split(/\s+/).filter(Boolean);
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

  // ---------- the library: shelves, authors, search ----------
  const bookKey = b => fold([b.ar, b.en, b.by, b.byEn, b.madhhab ? t("kutub." + b.madhhab) : "", authorName(b.author)].join(" ")).toLowerCase();
  function bookRow(b) {
    return `<a href="#/kutub/${b.id}"><div class="num">${icon(b.group === "fiqh" || b.group === "usul" ? "fiqh" : "kutub")}</div><div class="lbl">${esc(title(b))}${isAr() ? "" : ` <span class="ar-name" lang="ar" dir="rtl">${esc(b.ar)}</span>`}<span class="sub">${esc(school(b) + by(b))}</span></div>${icon("back", "chev")}</a>`;
  }
  let libQuery = "";
  async function renderLibrary() {
    setNav("more"); setHeader(t("kutub.title"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    try { await loadIndex(); } catch (e) { return stale(hash) || failed(e, renderLibrary); }
    if (stale(hash)) return;
    const last = state.last && bookOf(state.last), at = last && state.at[last.id];
    // Authors with more than one book can be chosen to see only their books.
    const counts = {}; IX.books.forEach(b => { counts[b.author] = (counts[b.author] || 0) + 1; });
    const authors = Object.keys(IX.authors).filter(a => counts[a] > 1);
    if (state.author && !authors.includes(state.author)) state.author = "";
    view.innerHTML = `
      ${last && at ? `<div class="resume-row"><a class="resume" href="#/kutub/${last.id}/${at.s}">${icon("kutub")}<div><b>${esc(t("kutub.continue"))}</b><span>${esc(title(last))}${at.t ? `${esc(sep())}<span lang="ar" dir="rtl">${esc(at.t)}</span>` : ""}</span></div></a></div>` : ""}
      <p class="riwayah-note">${esc(t("kutub.intro"))}</p>
      ${isAr() ? "" : `<div class="info">${icon("translate")}<div>${esc(t("kutub.arabicOnly"))}</div></div>`}
      <div class="searchbox kt-find">${icon("search")}<input id="kf" type="search" placeholder="${esc(t("kutub.findBook"))}" value="${esc(libQuery)}" autocomplete="off"></div>
      <div class="chips kt-authors" role="group" aria-label="${esc(t("kutub.authors"))}">${["", ...authors].map(a => `<button class="chip ${a === state.author ? "on" : ""}" data-author="${a}" aria-pressed="${a === state.author}">${esc(a ? authorName(a) : t("kutub.all"))}</button>`).join("")}</div>
      <div id="kshelves"></div>
      <p class="source-note">${esc(t("kutub.offline"))}</p>`;
    const draw = () => {
      const want = terms(libQuery);
      const books = IX.books.filter(b => (!state.author || b.author === state.author) && want.every(w => bookKey(b).includes(w)));
      $("#kshelves").innerHTML = IX.groups.map(g => {
        const list = books.filter(b => b.group === g); if (!list.length) return "";
        const intro = !state.author && !want.length && (g === "aqida" || g === "fiqh") ? `<p class="kt-intro">${esc(t(`kutub.${g}Intro`))}</p>` : "";
        return `<h2 class="section-title">${esc(t("kutub." + g))}</h2>${intro}<div class="list">${list.map(bookRow).join("")}</div>`;
      }).join("") || `<div class="empty">${esc(t("common.noResults"))}</div>`;
    };
    draw();
    $("#kf").oninput = e => { libQuery = e.target.value; draw(); };
    view.querySelector(".kt-authors").onclick = e => {
      const c = e.target.closest("[data-author]"); if (!c) return;
      state.author = c.dataset.author; save();
      view.querySelectorAll(".kt-authors .chip").forEach(x => { const on = x === c; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
      draw();
    };
  }

  // ---------- one book: about it, its contents, search ----------
  const queries = {};
  // The contents. A long one (al-Mughni has thousands of headings) opens one level at a time.
  function tocHtml(b, head) {
    const top = Math.min(...head.toc.map(e => e.l));
    const link = e => `#/kutub/${b.id}/${e.s}${e.a ? `?a=${e.a}` : e.fn ? `?fn=${e.fn}` : ""}`;
    const label = e => esc(shown(e.pt || (!e.a && !e.fn && head.sections[e.s]?.pt) ? pageTitle({ ...head.sections[e.s], t: e.t }) : e.t));
    const opens = e => head.sections[e.s]?.c != null || e.a || e.fn;
    const row = e => opens(e)
      ? `<a class="kt-row" style="--lv:${e.l - top}" href="${link(e)}"><div class="lbl" lang="ar" dir="rtl">${label(e)}</div>${icon("back", "chev")}</a>`
      : `<div class="kt-group" style="--lv:${e.l - top}" lang="ar" dir="rtl">${label(e)}</div>`;
    if (head.toc.length <= 400) return { html: `<div class="list kt-toc">${head.toc.map(row).join("")}</div>`, bind: () => {} };
    // Entries [i, j) shown as their top level, each with its sub-entries folded under it.
    const level = (i, j) => {
      let html = ""; const l = Math.min(...head.toc.slice(i, j).map(e => e.l));
      for (let k = i; k < j;) {
        let end = k + 1; while (end < j && head.toc[end].l > l) end++;
        const e = head.toc[k];
        html += end > k + 1
          ? `<details class="kt-fold" data-from="${k + 1}" data-to="${end}"><summary style="--lv:${e.l - top}"><span lang="ar" dir="rtl">${label(e)}</span>${opens(e) ? `<a class="icon-btn" href="${link(e)}" aria-label="${esc(t("kutub.start"))}">${icon("back", "chev")}</a>` : ""}</summary><div class="kt-sub"></div></details>`
          : row(e);
        k = end;
      }
      return html;
    };
    return {
      html: `<div class="list kt-toc">${level(0, head.toc.length)}</div>`,
      bind: root => root.addEventListener("toggle", e => {
        const d = e.target; if (!d.matches?.(".kt-fold") || !d.open) return;
        const sub = d.querySelector(":scope > .kt-sub"); if (!sub.childElementCount) sub.innerHTML = level(Number(d.dataset.from), Number(d.dataset.to));
      }, true),
    };
  }
  async function renderBook(id) {
    setNav("more"); setHeader(t("kutub.title"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    let b, head;
    try { await loadIndex(); b = bookOf(id); if (!b) { location.replace("#/kutub"); return; } head = await loadBook(b); }
    catch (e) { return stale(hash) || failed(e, () => renderBook(id)); }
    if (stale(hash)) return;
    setHeader(title(b), { back: true });
    const at = state.at[id]; const first = readable(head)[0][1];
    const whole = b.bytes <= SEARCH_ALL;
    const toc = tocHtml(b, head);
    view.innerHTML = `
      <section class="hero slim kt-hero"><h2 lang="ar" dir="rtl">${esc(b.ar)}</h2>${isAr() ? "" : `<p>${esc(b.en)}</p>`}<p>${esc(school(b) + by(b))}</p></section>
      <p class="riwayah-note">${esc(isAr() ? b.about : b.aboutEn)}</p>
      <div class="kt-actions"><a class="btn" href="#/kutub/${id}/${at ? at.s : first}">${icon("book")} ${esc(t(at ? "kutub.continue" : "kutub.start"))}</a></div>
      <div class="searchbox">${icon("search")}<input id="kq" type="search" placeholder="${esc(t(whole ? "kutub.search" : "kutub.searchTitles"))}" value="${esc(queries[id] || "")}" autocomplete="off" enterkeyhint="search"></div>
      <div id="kres"></div>
      <div id="ktoc"><h2 class="section-title">${esc(t("kutub.contents"))}</h2>${toc.html}</div>
      <details class="card asma-method kt-edition"><summary>${icon("book")} ${esc(t("kutub.edition"))}</summary><div class="about" lang="ar" dir="rtl">${esc(b.edition).replace(/\n/g, "<br>")}</div></details>
      <p class="source-note"><a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(t("kutub.source"))}</a></p>`;
    toc.bind($("#ktoc"));

    // Search: a book up to SEARCH_ALL bytes word by word (paragraphs, headings and footnotes), a bigger one by its headings.
    let timer = 0, seq = 0;
    const draw = async () => {
      const q = (queries[id] = $("#kq").value).trim(); const want = terms(q); const mine = ++seq;
      $("#ktoc").hidden = want.length > 0 && q.length >= 2;
      if (q.length < 2 || !want.length) { $("#kres").innerHTML = ""; return; }
      const hits = [];
      if (whole) {
        $("#kres").innerHTML = loading();
        let parts; try { parts = await Promise.all(b.chunks.map((h, k) => loadPart(b, k))); } catch (e) { if (mine === seq) $("#kres").innerHTML = `<div class="empty">${esc(t("common.loadFailed"))}</div>`; return; }
        if (mine !== seq) return;
        const text = Object.assign({}, ...parts);
        head.sections.forEach((s, si) => {
          const x = text[si]; if (!x) return;
          const rows = (x.body || []).map((e, i) => [e.p ?? e.h, e.h != null ? `a=${e.a}` : `p=${i}`]).concat((x.notes || []).map((n, i) => [n, `fn=${i + 1}`]));
          for (const [txt, where] of rows) {
            if (txt == null || hits.length >= 100) continue;
            const f = fold(txt).toLowerCase(); if (!want.every(w => f.includes(w))) continue;
            hits.push(`<a href="#/kutub/${id}/${si}?${where}"><div class="lbl"><span class="sub" lang="ar" dir="rtl">${esc(pageTitle(s))}</span><span class="kt-snip" lang="ar" dir="rtl">${snippet(txt, want)}</span></div>${icon("back", "chev")}</a>`);
          }
        });
      } else {
        for (const e of head.toc) {
          if (hits.length >= 100) break;
          if (!want.every(w => fold(e.t).toLowerCase().includes(w))) continue;
          const parent = parentOf(head, e.s);
          hits.push(`<a href="#/kutub/${id}/${e.s}${e.a ? `?a=${e.a}` : ""}"><div class="lbl">${parent ? `<span class="sub" lang="ar" dir="rtl">${esc(shown(parent.t))}</span>` : ""}<span class="kt-snip" lang="ar" dir="rtl">${snippet(e.t, want)}</span></div>${icon("back", "chev")}</a>`);
        }
      }
      $("#kres").innerHTML = `<h2 class="section-title">${esc(t("count.results", { n: hits.length }))}</h2>` + (hits.length ? `<div class="list">${hits.join("")}</div>` : `<div class="empty">${esc(t("common.noResults"))}</div>`);
    };
    $("#kq").oninput = () => { clearTimeout(timer); timer = setTimeout(draw, 250); };
    if (queries[id]) draw();
  }

  // ---------- a reading page ----------
  async function renderPage(id, i, params) {
    setNav("more"); setHeader(t("kutub.title"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    let b, head, text;
    try {
      await loadIndex(); b = bookOf(id); if (!b) { location.replace("#/kutub"); return; }
      head = await loadBook(b);
      if (head.sections[i]?.c == null) { location.replace(`#/kutub/${id}`); return; }
      text = await textOf(b, head, i);
    } catch (e) { return stale(hash) || failed(e, () => renderPage(id, i, params)); }
    if (stale(hash)) return;
    const s = head.sections[i], body = text.body || [], notes = text.notes;
    const list = readable(head); const at = list.findIndex(([, k]) => k === i);
    const prev = list[at - 1], next = list[at + 1];
    const parent = parentOf(head, i);
    const single = list.length === 1;
    // «مدخل» is turath.io's name for the text of a «كتاب» before its first «باب»: the header names the «كتاب».
    const name = pageTitle(s.t === "مدخل" && parent ? { ...s, t: parent.t } : s);
    state.last = id; state.at[id] = { s: i, t: single ? "" : name }; save();
    setHeader(single ? title(b) : name, { back: true, actions: `<a class="icon-btn" href="#/kutub/${id}" aria-label="${esc(t("kutub.contents"))}">${icon("list")}</a><button class="icon-btn" id="k-copy" aria-label="${esc(t("common.copy"))}">${icon("copy")}</button><button class="icon-btn" id="k-share" aria-label="${esc(t("common.share"))}">${icon("share")}</button>` });
    const navBtn = (x, side) => x ? `<a class="btn ghost" href="#/kutub/${id}/${x[1]}" data-replace>${side === "prev" ? `${icon("back", "dir")} ` : ""}<span lang="ar" dir="rtl">${esc(pageTitle(x[0]))}</span>${side === "next" ? ` ${icon("back", "flip")}` : ""}</a>` : "<span></span>";
    const heading = s.il || single ? "" : `<h2 class="asma-chapter kt-title" lang="ar" dir="rtl">${para(s.pt && s.pt[0] > 1 ? pageTitle(s) : s.th || s.t)}</h2>`;
    view.innerHTML = `<div id="kt-page">
      <a class="kt-crumb" href="#/kutub/${id}" lang="ar" dir="rtl">${esc(b.ar)}${parent && !single ? ` ‹ ${esc(shown(parent.t))}` : ""}</a>
      ${heading}
      ${body.length ? `<article class="asma-text kt-text" lang="ar" dir="rtl">${bodyHtml(body)}</article>` : ""}
      ${notesHtml(notes)}
      <p class="source-note">${esc(b.ar)}${s.pg ? esc(sep() + pagesLabel(s)) : ""}</p>
      ${single ? "" : `<nav class="reader-nav">${navBtn(prev, "prev")}${navBtn(next, "next")}</nav>`}</div>`;
    view.querySelectorAll("[data-replace]").forEach(a => a.onclick = e => { e.preventDefault(); location.replace(a.getAttribute("href")); });
    // A footnote number shows its note at once; the notes are also listed under the text.
    $("#kt-page").addEventListener("click", e => {
      const r = e.target.closest("[data-fn]"); if (!r) return;
      const n = Number(r.dataset.fn); const note = notes?.[n - 1]; if (note == null) return;
      Q.sheet(t("kutub.note", { n: num(n) }), `<div class="asma-text kt-note" lang="ar" dir="rtl">${para(note).replace(/\n/g, "<br>")}</div>`);
    });
    const plain = () => [s.il || single ? "" : plainText(s.th || s.t), ...body.map(x => x.sep ? "* * *" : plainText(x.p ?? x.h))].filter(Boolean).join("\n")
      + (notes?.length ? "\n\n" + notes.map((x, k) => `(${num(k + 1)}) ${plainText(x)}`).join("\n") : "")
      + `\n\n— ${b.ar}، ${b.by}${s.pg ? "، " + pagesLabel(s) : ""}`;
    $("#k-copy").onclick = () => copyText(plain());
    $("#k-share").onclick = () => share(b.ar, `${single ? b.ar : `${name}\n— ${b.ar}`}\n${SITE}#/kutub/${id}/${i}`);
    // Opened at a heading, a search result or a footnote.
    const where = params.get("a") ? view.querySelector(`#k-${CSS.escape(params.get("a"))}, [data-a="${CSS.escape(params.get("a"))}"]`)
      : params.get("p") ? document.getElementById("kp-" + params.get("p"))
      : params.get("fn") ? document.getElementById("fn-" + params.get("fn")) : null;
    if (where) setTimeout(() => flash(where), 50);
    // The next reading page's part is fetched ahead, so turning the page works without waiting (and offline later).
    if (next && head.sections[next[1]].c !== s.c) loadPart(b, head.sections[next[1]].c).catch(() => {});
  }

  // Books whose title or author matches, for the Home search.
  async function search(q) {
    const want = terms(q); if (want.join("").length < 2) return [];
    await loadIndex();
    return IX.books.filter(b => want.every(w => bookKey(b).includes(w))).map(b => ({ href: `#/kutub/${b.id}`, name: title(b), sub: by(b), icon: b.group === "fiqh" || b.group === "usul" ? "fiqh" : "kutub" }));
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
