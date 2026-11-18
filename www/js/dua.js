/* ===== الدعاء من الكتاب والسنة ===== */
// «الدعاء من الكتاب والسنة» by Saʿid ibn ʿAli ibn Wahf al-Qahtani, the companion of his Hisn al-Muslim: 149 supplications
// from the Quran and the Sunnah, each with its source, after the virtue of duʿaʾ, its etiquette and the causes of an
// answer, and the times, states and places in which duʿaʾ is answered.
// data/dua.json is the book word for word (scripts/build-dua.js), split into its chapters and numbered supplications.

export function setupDua(ctx) {
  const { view, $, esc, icon, t, th, num, sep, getLang, setHeader, setNav, copyText, shareText, toast, SITE, normalize, fav } = ctx;
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";
  const shown = s => ctx.tashkeel() ? s : ctx.stripTashkeel(s);
  const ch = (...cps) => String.fromCodePoint(...cps);
  const OPEN = ch(0x27E6), CLOSE = ch(0x27E7); // ⟦n⟧: footnote n of the same chapter or supplication
  const REF = new RegExp(OPEN + "(\\d+)" + CLOSE, "g");
  // A supplication with one footnote ends with its mark: the source is folded under the card, so the mark is not drawn.
  const ONLY_REF = new RegExp("\\s*" + OPEN + "1" + CLOSE + "(?=[.،]*$)");
  const favKey = n => "dua:" + n;

  let BOOK = null, KEYS = null;
  async function load() { if (!BOOK) { const r = await fetch("data/dua.json"); if (!r.ok) throw new Error("HTTP " + r.status); BOOK = await r.json(); } return BOOK; }
  const keys = () => KEYS ||= BOOK.items.map(it => normalize(it.t.replace(REF, "")));
  const loading = () => `<div class="empty"><div class="spinner"></div><div>${esc(t("common.loading"))}</div></div>`;
  const failed = (err, retry) => {
    const offline = !navigator.onLine || err instanceof TypeError;
    view.innerHTML = `<div class="empty">${icon("download")}<div>${esc(t(offline ? "offline.needOnce" : "common.loadFailed"))}</div><br><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`;
    $("#retry").onclick = retry;
  };

  // The book's text: Quran verses marked (a star between verses drawn as the verse sign, as in the adhkar), footnote
  // references as small numbers, the book's own line breaks kept.
  const refBtn = n => `<button class="fn-ref" type="button" data-fn="${n}" aria-label="${esc(t("asma.note", { n: Number(n) }))}">${num(Number(n))}</button>`;
  const para = p => esc(shown(p)).replace(/﴿([^﴾]{1,3000})﴾/g, (m, q) => `<span class="q">﴿${q.replace(/\s*\*\s*/g, " ۝ ")}﴾</span>`)
    .replace(new RegExp(" +(?=" + OPEN + ")", "g"), "").replace(REF, (m, n) => refBtn(n)).replace(/\n/g, "<br>");
  const duaText = it => it.notes.length === 1 ? it.t.replace(ONLY_REF, "") : it.t;
  const pagesLabel = ([a, b]) => a === b ? t("asma.page", { n: a }) : t("asma.pages", { from: a, to: b });
  const flash = el => { if (!el) return; el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1800); };

  // ---------- one supplication: its text, its source folded under it, and save / copy / share ----------
  function card(it) {
    const on = fav.has(favKey(it.n)), many = it.notes.length > 1;
    return `<article class="dhikr dua" id="dua-${it.n}" data-n="${it.n}">
      <div class="dhikr-text" lang="ar" dir="rtl">${para(duaText(it))}</div>
      <details class="fadl"><summary>${icon("book")}<span>${esc(t("fadl.source"))}</span></summary><div class="fadl-body" lang="ar" dir="rtl">
        ${it.notes.map((x, i) => `<p class="dua-note" data-note="${i + 1}">${many ? `<b>${num(i + 1)}</b> ` : ""}${para(x)}</p>`).join("")}</div></details>
      <div class="dhikr-bar">
        <span class="dua-no">${num(it.n)}</span>
        <span class="spacer"></span>
        <button class="icon-btn ${on ? "active" : ""}" data-act="fav" type="button" aria-label="${esc(t(on ? "fav.remove" : "fav.add"))}">${icon(on ? "star-f" : "star")}</button>
        <button class="icon-btn" data-act="copy" type="button" aria-label="${esc(t("common.copy"))}">${icon("copy")}</button>
        <button class="icon-btn" data-act="share" type="button" aria-label="${esc(t("common.share"))}">${icon("share")}</button>
      </div>
    </article>`;
  }
  // Copies carry the source with the supplication, as the book gives it.
  const plain = it => {
    const many = it.notes.length > 1;
    return duaText(it).replace(REF, (m, n) => `(${num(Number(n))})`) + "\n\n" + it.notes.map((x, i) => (many ? `(${num(i + 1)}) ` : "") + x).join("\n");
  };
  function bind(root) {
    root.addEventListener("click", e => {
      const el = e.target.closest(".dua"); if (!el || !BOOK) return;
      const it = BOOK.items[Number(el.dataset.n) - 1];
      const ref = e.target.closest("[data-fn]");
      if (ref) { const d = el.querySelector("details"); d.open = true; return flash(d.querySelector(`[data-note="${ref.dataset.fn}"]`)); }
      const btn = e.target.closest("[data-act]"); if (!btn) return;
      if (btn.dataset.act === "fav") {
        const on = fav.toggle(favKey(it.n)); toast(t(on ? "fav.added" : "fav.removed"));
        btn.classList.toggle("active", on); btn.innerHTML = icon(on ? "star-f" : "star"); btn.setAttribute("aria-label", t(on ? "fav.remove" : "fav.add")); return;
      }
      if (btn.dataset.act === "copy") return copyText(`${plain(it)}\n\n— ${BOOK.source.title}، ${BOOK.source.author}، ${pagesLabel([it.pg, it.pg])}`);
      if (btn.dataset.act === "share") return shareText(isAr() ? BOOK.source.title : t("dua.title"), plain(it), `${SITE}#/dua?n=${it.n}`);
    });
  }

  // ---------- the book: its chapters, then the supplications ----------
  let query = "";
  const numberOf = s => { const n = Number(s.trim().replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))); return Number.isInteger(n) && n >= 1 && n <= BOOK.items.length ? n : 0; };
  async function renderIndex(params) {
    setNav("adhkar"); setHeader(t("dua.title"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    try { await load(); } catch (e) { return stale(hash) || failed(e, () => renderIndex(params)); }
    if (stale(hash)) return;
    // ?n=57 opens the book at that supplication.
    const want = numberOf(params?.get("n") || ""); if (want) query = "";
    view.innerHTML = `
      <section class="hero slim asma-hero"><h2 lang="ar" dir="rtl">${esc(BOOK.source.title)}</h2><p>${esc(t("asma.author"))}</p></section>
      <p class="riwayah-note">${esc(t("dua.intro"))}</p>
      ${isAr() ? "" : `<div class="info">${icon("translate")}<div>${esc(t("dua.arabicOnly"))}</div></div>`}
      <h2 class="section-title">${esc(t("asma.chapters"))}</h2>
      <div class="list">${BOOK.chapters.map((c, i) => `<a href="#/dua/c/${i}"><div class="num">${num(i + 1)}</div><div class="lbl dua-ch" lang="ar" dir="rtl">${esc(shown(c.title))}</div>${icon("back", "chev")}</a>`).join("")}</div>
      <h2 class="section-title">${esc(t("dua.short"))}</h2>
      <div class="searchbox">${icon("search")}<input id="dq" type="search" placeholder="${esc(t("dua.search"))}" value="${esc(query)}" autocomplete="off" enterkeyhint="search"></div>
      <p class="dua-line" id="dua-open" lang="ar" dir="rtl">${esc(shown(BOOK.duas.open))}</p>
      <div id="dua-cards">${BOOK.items.map(card).join("")}</div>
      <div class="empty" id="dua-none" hidden>${icon("search")}<div>${esc(t("common.noResults"))}</div></div>
      <p class="dua-line" id="dua-close" lang="ar" dir="rtl">${esc(shown(BOOK.duas.close))}</p>
      <p class="source-note">${th("about.duaText", {}, { link: `<a href="${esc(BOOK.source.url)}" target="_blank" rel="noopener">turath.io</a>` }, esc)}</p>`;
    const cards = [...view.querySelectorAll("#dua-cards > .dua")];
    // Search ignores diacritics and letter forms; a number alone finds the supplication with that number.
    const draw = () => {
      const q = normalize(query), n = numberOf(query), terms = q.split(" "); let left = 0;
      cards.forEach((el, i) => { const ok = !q || (n ? BOOK.items[i].n === n : terms.every(x => keys()[i].includes(x))); el.hidden = !ok; if (ok) left++; });
      $("#dua-none").hidden = left > 0; $("#dua-open").hidden = $("#dua-close").hidden = !!q;
    };
    draw(); $("#dq").oninput = e => { query = e.target.value; draw(); };
    bind($("#dua-cards"));
    if (want) { const el = document.getElementById("dua-" + want); if (el) setTimeout(() => { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.style.outline = "2px solid var(--accent)"; setTimeout(() => el.style.outline = "", 1800); }, 60); }
  }

  // ---------- a chapter before the supplications ----------
  async function renderChapter(i) {
    setNav("adhkar"); setHeader(t("dua.title"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    try { await load(); } catch (e) { return stale(hash) || failed(e, () => renderChapter(i)); }
    if (stale(hash)) return;
    const c = BOOK.chapters[i]; if (!c) { location.replace("#/dua"); return; }
    const name = k => ctx.stripTashkeel(BOOK.chapters[k].title);
    // The page facing the introduction (a verse, then the Names of Allah, which the author explains in the book the
    // app shows under #/asma) is drawn above it; its footnotes come first, so the chapter's own are numbered after them.
    // The print sets the Names a few to a line with "..." between them: here they run on, with the same mark between lines.
    const pre = i === 0 ? BOOK.front : null, shift = pre ? pre.notes.length : 0;
    const body = c.body.map(x => shift ? x.p.replace(REF, (m, n) => OPEN + (Number(n) + shift) + CLOSE) : x.p);
    const notes = [...(pre ? pre.notes : []), ...c.notes];
    setHeader(name(i), { back: true });
    view.innerHTML = `
      ${pre ? `<article class="asma-text dua-front" lang="ar" dir="rtl">${pre.body.map(x => `<p>${para(x.p.replace(/\n/g, " ... ").replace(/ \.\.\. /g, ch(0xA0) + "... "))}</p>`).join("")}<a class="fadl-see" href="#/asma">${icon("asma")}<span>${esc(t("asma.title"))}</span></a></article>` : ""}
      <h2 class="asma-chapter" lang="ar" dir="rtl">${esc(shown(c.title))}${(c.head || []).map(k => refBtn(k + shift)).join("")}</h2>
      <article class="asma-text" lang="ar" dir="rtl">${body.map(p => `<p>${para(p)}</p>`).join("")}</article>
      ${notes.length ? `<section class="asma-notes" lang="ar" dir="rtl"><h3>${esc(t("asma.notes"))}</h3><ol>${notes.map((x, k) => `<li id="fn-${k + 1}" value="${k + 1}"><span class="fn-num">${num(k + 1)}</span> <span>${para(x)}</span></li>`).join("")}</ol></section>` : ""}
      <p class="source-note">${esc(isAr() ? BOOK.source.title : t("dua.title"))}${sep()}${esc(pagesLabel(pre ? [pre.body[0].pg, c.pages[1]] : c.pages))}</p>
      <nav class="reader-nav">
        ${i > 0 ? `<a class="btn ghost" href="#/dua/c/${i - 1}" data-replace>${icon("back", "dir")} <span lang="ar">${esc(name(i - 1))}</span></a>` : "<span></span>"}
        ${i + 1 < BOOK.chapters.length ? `<a class="btn ghost" href="#/dua/c/${i + 1}" data-replace><span lang="ar">${esc(name(i + 1))}</span> ${icon("back", "flip")}</a>`
          : `<a class="btn ghost" href="#/dua" data-replace><span>${esc(t("dua.short"))}</span> ${icon("back", "flip")}</a>`}
      </nav>`;
    view.querySelectorAll("[data-replace]").forEach(a => a.onclick = e => { e.preventDefault(); location.replace(a.getAttribute("href")); });
    view.querySelectorAll(".asma-chapter, .asma-text").forEach(el => el.addEventListener("click", e => { const r = e.target.closest("[data-fn]"); if (r) flash(document.getElementById("fn-" + r.dataset.fn)); }));
  }

  return {
    render(parts, params) {
      if (parts[0] === "c") return renderChapter(Number(parts[1]));
      return renderIndex(params);
    },
    // Supplications matching a query, for the Home and Adhkar search.
    async search(q) {
      const k = normalize(q); if (k.length < 2) return [];
      await load(); const terms = k.split(" ");
      return BOOK.items.filter((it, i) => terms.every(x => keys()[i].includes(x)))
        .map(it => ({ n: it.n, text: ctx.stripTashkeel(duaText(it).replace(REF, "")).replace(/\s+/g, " ").slice(0, 90), href: `#/dua?n=${it.n}` }));
    },
    // The saved supplications, for the Favorites page: their cards, and the handler of the cards' buttons.
    async cards(ns) { await load(); return ns.map(n => BOOK.items[n - 1]).filter(Boolean).map(card).join(""); },
    bind,
  };
}
