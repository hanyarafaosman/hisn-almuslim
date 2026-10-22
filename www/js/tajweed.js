/* ===== أحكام التجويد ===== */
// The rules of recitation for Hafs from ʿAsim by way of al-Shatibiyyah, explained with examples from the colour-coded
// Tajweed Mushaf itself. data/tajweed.json (scripts/build-tajweed.js) gives each example as the glyphs of its words on
// their printed page: they are drawn with that page's Tajweed font, loaded only for the examples shown, so the colours
// are exactly those of the Mushaf. The colour key comes from the same fonts (palette 0 by day, 1 at night).

export function setupTajweed(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, LS, setHeader, setNav, Q, sheet } = ctx;
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";
  const L = x => x[isAr() ? 0 : 1]; // texts are [Arabic, English]; other languages read the English

  let DATA = null;
  async function load() { if (!DATA) { const r = await fetch("data/tajweed.json"); if (!r.ok) throw new Error("HTTP " + r.status); DATA = await r.json(); } return DATA; }
  const loading = () => `<div class="empty"><div class="spinner"></div><div>${esc(t("common.loading"))}</div></div>`;
  const failed = (err, retry) => {
    const offline = !navigator.onLine || err instanceof TypeError;
    view.innerHTML = `<div class="empty">${icon("download")}<div>${esc(t(offline ? "offline.needOnce" : "common.loadFailed"))}</div><br><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`;
    $("#retry").onclick = retry;
  };

  // Words of the Quran in the text are between ﴿ ﴾; in English, Arabic in «» keeps its own direction.
  const AR = /[ء-ي]/;
  const para = s => esc(s).replace(/﴿([^﴾]{1,200})﴾/g, '<bdi class="q" lang="ar" dir="rtl">﴿$1﴾</bdi>')
    .replace(/«([^»]{1,200})»/g, (m, x) => AR.test(x) && !isAr() ? `<bdi lang="ar" dir="rtl">«${x}»</bdi>` : m);
  const colorOf = c => DATA.colors.find(x => x.c === c);
  const swatch = c => { const x = colorOf(c); return x ? `<i class="tj-sw" style="--l:${x.light};--d:${x.dark}" title="${esc(L(x.t))}"></i>` : ""; };

  // ---------- examples: glyphs of the Tajweed print, in the font of their page ----------
  const isDark = () => { const th = document.documentElement.dataset.theme; return th === "dark" || (th !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); };
  const families = new Set();
  // A COLR font picks its palette per family: the night palette when the app is dark, as on the Mushaf pages.
  function palettes() {
    let st = document.getElementById("tj-ex-palette"); if (!st) { st = document.createElement("style"); st.id = "tj-ex-palette"; document.head.appendChild(st); }
    const base = isDark() ? 1 : 0;
    st.textContent = [...families].map(n => `@font-palette-values --tjx-${n} { font-family: 'qcf-tajweed-${n}'; base-palette: ${base}; } .tj-g[data-p="${n}"] { font-family: 'qcf-tajweed-${n}'; font-palette: --tjx-${n}; }`).join("\n");
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => families.size && palettes());
  new MutationObserver(() => families.size && palettes()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  // Draws the examples inside root once the font of their page is ready; until then (or offline) the plain text shows.
  function drawExamples(root) {
    const byPage = new Map();
    root.querySelectorAll(".tj-ex[data-p]").forEach(a => { const p = a.dataset.p; if (!byPage.has(p)) byPage.set(p, []); byPage.get(p).push(a); });
    for (const [p, els] of byPage) Q.tajweedFont(Number(p)).then(() => {
      families.add(p); palettes(); els.forEach(a => a.classList.add("ready"));
    }).catch(() => {});
  }
  let names = n => String(n);
  const ref = x => { const [s, a] = x.k.split(":").map(Number); return `${names(s)} ${num(a)}`; };
  // An example opens its verse in the Mushaf; inside a row that is itself a link (the key) it is a plain span.
  const exHtml = (x, note = true, link = true) => `<${link ? "a" : "span"} class="tj-ex" data-p="${x.p}"${link ? ` href="#/mushaf/tajweed/${x.p}?v=${x.k}" aria-label="${esc(`${x.t} (${ref(x)})`)}"` : ""}>
      <span class="tj-w" aria-hidden="true"><span class="tj-g" data-p="${x.p}" lang="ar" dir="rtl">${x.g.map(w => `<span>${esc(w)}</span>`).join("")}</span><span class="tj-t" lang="ar" dir="rtl">${esc(x.t)}</span></span>
      ${note && x.n ? `<span class="tj-note">${esc(L(x.n))}</span>` : ""}<span class="tj-ref">${esc(ref(x))}</span></${link ? "a" : "span"}>`;

  const poem = m => {
    const b = DATA.books[m.b];
    return `<details class="tj-matn"><summary>${icon("book")}<span>${esc(t("tajweed.fromBook", { book: L(b.title) }))}</span></summary>
      <div class="tj-poem" lang="ar" dir="rtl">${m.v.map(([a, c], i) => `<div class="bt"><span class="n">${num(m.from + i)}</span><span>${esc(a)}</span><span>${esc(c)}</span></div>`).join("")}</div>
      <p class="source-note">${esc(L(b.author))}${b.url ? `${sep()}<a href="${esc(b.url)}" target="_blank" rel="noopener">turath.io</a>` : ""}</p></details>`;
  };
  const enNote = () => isAr() || getLang() === "en" ? "" : `<p class="info">${icon("translate")}<span>${esc(t("tajweed.inEnglish"))}</span></p>`;
  const keyRows = () => DATA.colors.map(x => `<a class="tj-key" href="#/tajweed/${x.rule}">${swatch(x.c)}<div class="lbl">${esc(L(x.t))}<span class="sub">${esc(L(x.sub))}</span></div>${exHtml(x.ex, false, false)}</a>`).join("");
  const lastTajweedPage = () => { const q = LS.get("quran", {}); return q.lastPage?.ed === "tajweed" ? q.lastPage.p : 1; };

  // ---------- the rules: the colour key and the chapters ----------
  async function renderIndex() {
    setNav("quran"); setHeader(t("tajweed.title"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    try { await load(); names = await Q.surahNames(); } catch (e) { if (!stale(hash)) failed(e, renderIndex); return; }
    if (stale(hash)) return;
    view.innerHTML = `${enNote()}
      <div class="tj-text">${DATA.intro.map(p => `<p>${para(L(p))}</p>`).join("")}</div>
      ${DATA.introMatn.map(poem).join("")}
      <h2 class="section-title">${esc(t("tajweed.key"))}</h2>
      <div class="list tj-keys">${keyRows()}</div>
      <p class="source-note">${esc(L(DATA.keyNote))}</p>
      <div class="more-row"><a class="btn" href="#/mushaf/tajweed/${lastTajweedPage()}">${icon("quran")} ${esc(t("tajweed.openMushaf"))}</a></div>
      <h2 class="section-title">${esc(t("tajweed.chapters"))}</h2>
      <div class="list">${DATA.chapters.map((c, i) => {
        const cs = [...new Set(c.s.flatMap(s => [...(s.c || "")]))];
        return `<a href="#/tajweed/${c.id}"><div class="num">${num(i + 1)}</div><div class="lbl">${esc(L(c.t))}${cs.length ? `<span class="sub tj-sws">${cs.map(swatch).join("")}</span>` : ""}</div>${icon("back", "chev")}</a>`;
      }).join("")}</div>
      <p class="source-note">${esc(L(DATA.source))}</p>`;
    drawExamples(view);
  }

  async function renderChapter(id) {
    setNav("quran"); const hash = location.hash;
    setHeader(t("tajweed.title"), { back: true }); view.innerHTML = loading();
    try { await load(); names = await Q.surahNames(); } catch (e) { if (!stale(hash)) failed(e, () => renderChapter(id)); return; }
    if (stale(hash)) return;
    const i = DATA.chapters.findIndex(c => c.id === id);
    if (i < 0) { location.replace("#/tajweed"); return; }
    const c = DATA.chapters[i], prev = DATA.chapters[i - 1], next = DATA.chapters[i + 1];
    view.innerHTML = `${enNote()}
      <h2 class="tj-title">${esc(L(c.t))}</h2>
      ${(c.intro || []).length ? `<div class="tj-text">${c.intro.map(p => `<p>${para(L(p))}</p>`).join("")}</div>` : ""}
      ${c.s.map(s => `<section class="tj-sec">
        <h3>${[...(s.c || "")].map(swatch).join("")}<span>${esc(L(s.h))}</span></h3>
        ${(s.p || []).map(p => `<p>${para(L(p))}</p>`).join("")}
        ${s.list ? `<ul>${s.list.map(x => `<li>${para(L(x))}</li>`).join("")}</ul>` : ""}
        ${s.ex ? `<div class="tj-exs">${s.ex.map(x => exHtml(x)).join("")}</div>` : ""}
      </section>`).join("")}
      ${c.matn.map(poem).join("")}
      <div class="tj-nav">
        ${prev ? `<a class="btn ghost" href="#/tajweed/${prev.id}">${icon("back", "dir")} ${esc(L(prev.t))}</a>` : "<span></span>"}
        ${next ? `<a class="btn ghost" href="#/tajweed/${next.id}">${esc(L(next.t))} ${icon("back", "flip")}</a>` : `<a class="btn ghost" href="#/tajweed">${esc(t("tajweed.title"))}</a>`}
      </div>
      <p class="source-note">${esc(L(DATA.source))}</p>`;
    drawExamples(view);
  }

  return {
    render(parts) { return parts[0] ? renderChapter(parts[0]) : renderIndex(); },
    // The colour key over the Tajweed Mushaf's pages, with a way to the rules.
    async keySheet() {
      try { await load(); names = await Q.surahNames(); } catch { location.hash = "#/tajweed"; return; }
      const body = sheet(t("tajweed.key"), `${enNote()}<div class="list flat tj-keys">${keyRows()}</div>
        <p class="source-note">${esc(L(DATA.keyNote))}</p>
        <div class="more-row"><a class="btn" href="#/tajweed">${icon("book")} ${esc(t("tajweed.rules"))}</a></div>`);
      drawExamples(body);
    },
  };
}
