/* ===== المتون: الشاطبية والدرة والطيبة والتحفة والجزرية، بأبوابها وأبياتها ===== */
// data/mutun.json lists the books (scripts/build-mutun.js): title, author, edition and chapters as verse ranges (the
// chapters of فرش الحروف carry their surahs). The verses of a book are in mutun/<id>.<hash>.json, fetched when it is
// first opened and kept on the device (MUTUN_CACHE in sw.js); a corrected file gets a new name and the old copy is
// deleted here. The readings page (js/qiraat.js) reads the verses through this module too.
const MUTUN_CACHE = "hisn-mutun-v1";

export function setupMutun(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, LS, copyText, SITE, stripTashkeel, setHeader, setNav } = ctx;
  // last: the chapter opened last; mode: how the verses show ("" all, "ajuz" second halves hidden, "all" whole verses hidden)
  const state = Object.assign({ last: null, mode: "" }, LS.get("mutun", {}));
  const save = () => LS.set("mutun", state);
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";
  const L = x => x[isAr() ? 0 : 1];
  const ch = (...cps) => String.fromCodePoint(...cps);
  // Search key: no vowels, one alif, one yāʾ, no tatweel.
  const FOLD = [[new RegExp("[" + ch(0x623, 0x625, 0x622) + "]", "g"), ch(0x627)], [new RegExp(ch(0x649), "g"), ch(0x64A)], [new RegExp(ch(0x640), "g"), ""]];
  const fold = s => FOLD.reduce((x, [re, to]) => x.replace(re, to), stripTashkeel(s));

  // ---------- data ----------
  let IX = null; const VERSES = new Map();
  async function loadIndex() { if (!IX) { const r = await fetch("data/mutun.json"); if (!r.ok) throw new Error("HTTP " + r.status); IX = await r.json(); prune(); } return IX; }
  const bookOf = id => IX.books.find(b => b.id === id);
  function loadVerses(b) {
    if (!VERSES.has(b.id)) VERSES.set(b.id, fetch("mutun/" + b.file).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(j => j.v).catch(e => { VERSES.delete(b.id); throw e; }));
    return VERSES.get(b.id);
  }
  // Copies of files corrected since: every file name carries a hash of its text.
  function prune() {
    if (!("caches" in window)) return;
    caches.open(MUTUN_CACHE).then(async c => {
      const keep = IX.books.map(b => "/mutun/" + b.file);
      for (const r of await c.keys()) { const p = new URL(r.url).pathname; if (!keep.some(f => p.endsWith(f))) await c.delete(r); }
    }).catch(() => {});
  }
  const loading = () => `<div class="empty"><div class="spinner"></div><div>${esc(t("common.loading"))}</div></div>`;
  const failed = (err, retry) => {
    const offline = !navigator.onLine || err instanceof TypeError;
    view.innerHTML = `<div class="empty">${icon("download")}<div>${esc(t(offline ? "offline.needOnce" : "common.loadFailed"))}</div><br><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`;
    $("#retry").onclick = retry;
  };
  const title = b => L(b.title);
  const author = b => L(b.author) + (b.diedNote ? ` (${L(b.diedNote)})` : b.died ? ` (${t("mutun.died", { year: num(b.died) })})` : "");
  const chapterOf = (b, v) => b.chapters.findIndex(c => v >= c.from && v <= c.to);
  const range = c => t("mutun.verseRange", { from: num(c.from), to: num(c.to) });

  // ---------- the library ----------
  async function renderLibrary() {
    setNav("more"); setHeader(t("mutun.title"), { back: true }); const hash = location.hash; view.innerHTML = loading();
    try { await loadIndex(); } catch (e) { if (!stale(hash)) failed(e, renderLibrary); return; }
    if (stale(hash)) return;
    const last = state.last && bookOf(state.last.id)?.chapters[state.last.ch] ? state.last : null;
    const row = b => `<a href="#/mutun/${b.id}"><div class="num">${icon("book")}</div><div class="lbl">${esc(title(b))}<span class="sub">${esc(author(b))}${sep()}${esc(t("mutun.verseCount", { n: b.count }))}</span></div>${icon("back", "chev")}</a>`;
    const group = (key, subject) => `<h2 class="section-title">${esc(t(key))}</h2><div class="list">${IX.books.filter(b => b.subject === subject).map(row).join("")}</div>`;
    view.innerHTML = `<p class="info">${icon("book")}<span>${esc(t("mutun.hint"))}</span></p>
      ${last ? `<div class="resume-row"><a class="resume main" href="#/mutun/${last.id}/${last.ch}">${icon("play")}<div><b>${esc(t("mutun.continue"))}</b><span>${esc(title(bookOf(last.id)))}${sep()}${esc(bookOf(last.id).chapters[last.ch].t)}</span></div></a></div>` : ""}
      ${group("mutun.qiraat", "qiraat")}${group("mutun.tajweed", "tajweed")}
      <p class="source-note">${esc(L(IX.source))}</p>`;
  }

  // ---------- a book: its chapters, and a search through its verses ----------
  async function renderBook(id, params) {
    setNav("more"); const hash = location.hash; setHeader(t("mutun.title"), { back: true }); view.innerHTML = loading();
    try { await loadIndex(); } catch (e) { if (!stale(hash)) failed(e, () => renderBook(id, params)); return; }
    if (stale(hash)) return;
    const b = bookOf(id); if (!b) { location.replace("#/mutun"); return; }
    // #/mutun/<book>?v=N opens the chapter that holds verse N (links from the Tajweed page).
    const want = Number(params?.get("v")); if (want) { const ci = chapterOf(b, want); if (ci >= 0) { location.replace(`#/mutun/${id}/${ci}?v=${want}`); return; } }
    setHeader(title(b), { back: true });
    // Chapters in the book's order, with a heading where فرش الحروف begins and where it ends.
    const rows = []; let farsh = null;
    b.chapters.forEach((c, i) => {
      const f = !!c.s; if (f !== farsh) { rows.push(`</div><h2 class="section-title">${esc(t(f ? "mutun.farsh" : i ? "mutun.after" : "mutun.chapters"))}</h2><div class="list">`); farsh = f; }
      rows.push(`<a href="#/mutun/${id}/${i}" class="${c.l > 1 ? "mt-sub" : ""}"><div class="num">${num(i + 1)}</div><div class="lbl">${esc(c.t)}<span class="sub">${esc(range(c))}</span></div>${icon("back", "chev")}</a>`);
    });
    view.innerHTML = `<section class="hero slim"><h2>${esc(title(b))}</h2><p>${esc(author(b))}</p><p>${esc(L(b.edition))}${sep()}${esc(t("mutun.verseCount", { n: b.count }))}</p></section>
      <div class="searchbox small mt-search">${icon("search")}<input id="mt-q" type="search" lang="ar" dir="rtl" placeholder="${esc(t("mutun.search"))}" autocomplete="off" enterkeyhint="search"></div>
      <div id="mt-hits"></div>
      <div class="mt-chapters"><div>${rows.join("")}</div></div>
      <p class="source-note">${esc(L(IX.source))}${sep()}<a href="${esc(b.url)}" target="_blank" rel="noopener">turath.io</a></p>`;
    let timer = 0;
    $("#mt-q").oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = fold($("#mt-q").value.trim()), out = $("#mt-hits"); if (!out) return;
        if (q.length < 2) { out.innerHTML = ""; return; }
        let v; try { v = await loadVerses(b); } catch { out.innerHTML = `<div class="empty">${esc(t("common.loadFailed"))}</div>`; return; }
        if (stale(hash)) return;
        const hits = []; v.forEach((x, i) => { if (fold(x[0] + " " + x[1]).includes(q)) hits.push(i + 1); });
        out.innerHTML = `<h2 class="section-title">${esc(t("count.results", { n: hits.length }))}</h2><div class="list">${hits.slice(0, 80).map(n => {
          const ci = chapterOf(b, n), [a, z] = v[n - 1];
          return `<a href="#/mutun/${id}/${ci}?v=${n}"><div class="num">${num(n)}</div><div class="lbl" lang="ar" dir="rtl">${esc(a)}<span class="sub">${esc(z)}</span></div>${icon("back", "chev")}</a>`;
        }).join("")}</div>`;
      }, 150);
    };
  }

  // ---------- a chapter: its verses, to read or to memorise ----------
  async function renderChapter(id, ci, params) {
    setNav("more"); const hash = location.hash; setHeader(t("mutun.title"), { back: true }); view.innerHTML = loading();
    let b, v;
    try { await loadIndex(); b = bookOf(id); if (b) v = await loadVerses(b); } catch (e) { if (!stale(hash)) failed(e, () => renderChapter(id, ci, params)); return; }
    if (stale(hash)) return;
    if (!b) { location.replace("#/mutun"); return; }
    const c = b.chapters[ci]; if (!c) { location.replace(`#/mutun/${id}`); return; }
    const prev = b.chapters[ci - 1], next = b.chapters[ci + 1];
    state.last = { id, ch: ci }; save();
    setHeader(title(b), { back: true, onTitle: () => { location.hash = `#/mutun/${id}`; } });
    const MODES = [["", "mutun.showAll"], ["ajuz", "mutun.hideAjuz"], ["all", "mutun.hideAll"]];
    // A verse: its number (a button that copies it), the first half (its first word stays in the test), the second half.
    const bt = n => {
      const [a, z] = v[n - 1], i = a.indexOf(" "), w0 = i < 0 ? a : a.slice(0, i), rest = i < 0 ? "" : a.slice(i);
      return `<div class="bt" data-n="${n}"><button class="n" type="button" aria-label="${esc(t("mutun.copyVerse", { n }))}">${num(n)}</button><span><span>${esc(w0)}</span><span class="h-all">${esc(rest)}</span></span><span class="h-ajuz">${esc(z)}</span></div>`;
    };
    view.innerHTML = `<h2 class="tj-title">${esc(c.t)}</h2>
      <div class="mt-bar"><span class="segmented" id="mt-mode">${MODES.map(([m, k]) => `<button type="button" data-m="${m}" class="${state.mode === m ? "on" : ""}">${esc(t(k))}</button>`).join("")}</span><span class="mt-range">${esc(range(c))}</span></div>
      <p class="source-note mt-hint" ${state.mode ? "" : "hidden"}>${esc(t("mutun.tapReveal"))}</p>
      <div class="tj-matn"><div class="tj-poem mt-poem mode-${state.mode}" id="mt-poem" lang="ar" dir="rtl">${Array.from({ length: c.to - c.from + 1 }, (_, k) => bt(c.from + k)).join("")}</div></div>
      <div class="tj-nav">
        ${prev ? `<a class="btn ghost" href="#/mutun/${id}/${ci - 1}">${icon("back", "dir")} ${esc(prev.t)}</a>` : "<span></span>"}
        ${next ? `<a class="btn ghost" href="#/mutun/${id}/${ci + 1}">${esc(next.t)} ${icon("back", "flip")}</a>` : `<a class="btn ghost" href="#/mutun/${id}">${esc(t("mutun.chapters"))}</a>`}
      </div>
      <p class="source-note">${esc(author(b))}${sep()}${esc(L(b.edition))}${sep()}<a href="${esc(b.url)}" target="_blank" rel="noopener">turath.io</a></p>
      <p class="source-note">${esc(L(IX.source))}</p>`;
    const poem = $("#mt-poem");
    $("#mt-mode").onclick = e => {
      const m = e.target.closest("[data-m]"); if (!m) return;
      state.mode = m.dataset.m; save(); poem.className = `tj-poem mt-poem mode-${state.mode}`;
      poem.querySelectorAll(".bt.shown").forEach(x => x.classList.remove("shown"));
      $("#mt-mode").querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.m === state.mode));
      $(".mt-hint").hidden = !state.mode;
    };
    poem.onclick = e => {
      const row = e.target.closest(".bt"); if (!row) return;
      const n = Number(row.dataset.n);
      if (e.target.closest(".n")) { const [a, z] = v[n - 1]; copyText(`${a} … ${z}\n${t("mutun.copyRef", { book: title(b), n })}\n${SITE}#/mutun/${id}/${ci}?v=${n}`); return; }
      if (state.mode) row.classList.toggle("shown");
    };
    const want = Number(params?.get("v"));
    if (want >= c.from && want <= c.to) {
      const el = poem.querySelector(`.bt[data-n="${want}"]`);
      requestAnimationFrame(() => { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1800); });
    }
  }

  return {
    render(parts, params) { return parts.length > 1 ? renderChapter(parts[0], Number(parts[1]), params) : parts.length ? renderBook(parts[0], params) : renderLibrary(); },
    // For the readings page: a book's entry of the index, and its verses.
    async book(id) { await loadIndex(); return bookOf(id); },
    async verses(id) { await loadIndex(); const b = bookOf(id); if (!b) throw new Error("no book " + id); return loadVerses(b); },
  };
}
