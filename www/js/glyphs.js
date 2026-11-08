/* ===== أمثلة بخط المصحف: كلمات مرسومة برموز صفحتها في مصحف التجويد الملوّن ===== */
// An example (data/tajweed.json, data/qaida.json; scripts/lib/glyphs.js) is { k: "s:a", p: printed page, g: the glyph
// codes of its words, t: their plain text, n?: [Arabic, English] note }. The glyphs are drawn with the Tajweed font of
// their page (Q.tajweedFont), loaded only for the pages shown, so the letters and colours are exactly the Mushaf's;
// until the font arrives (or offline) the plain text shows. A COLR font picks its palette per family: the night palette
// when the app is dark, as on the Mushaf pages. The families loaded are shared by every page that draws examples.
const families = new Set();
const isDark = () => { const th = document.documentElement.dataset.theme; return th === "dark" || (th !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); };
function palettes() {
  let st = document.getElementById("tj-ex-palette"); if (!st) { st = document.createElement("style"); st.id = "tj-ex-palette"; document.head.appendChild(st); }
  const base = isDark() ? 1 : 0;
  st.textContent = [...families].map(n => `@font-palette-values --tjx-${n} { font-family: 'qcf-tajweed-${n}'; base-palette: ${base}; } .tj-g[data-p="${n}"] { font-family: 'qcf-tajweed-${n}'; font-palette: --tjx-${n}; }`).join("\n");
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => families.size && palettes());
new MutationObserver(() => families.size && palettes()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// names: () => a function of the surah number giving its name (set once Q.surahNames() has loaded);
// L: picks the language of an [Arabic, English] text.
export function makeGlyphs({ Q, esc, icon, t, num, names = () => String, L = x => x[0] }) {
  // Draws the examples inside root once the font of their page is ready.
  function drawExamples(root) {
    const byPage = new Map();
    root.querySelectorAll(".tj-ex[data-p]").forEach(a => { const p = a.dataset.p; if (!byPage.has(p)) byPage.set(p, []); byPage.get(p).push(a); });
    for (const [p, els] of byPage) Q.tajweedFont(Number(p)).then(() => {
      families.add(p); palettes(); els.forEach(a => a.classList.add("ready"));
    }).catch(() => {});
  }
  const ref = x => { const [s, a] = x.k.split(":").map(Number); return `${names()(s)} ${num(a)}`; };
  // An example opens its verse in the Mushaf and plays it (js/clip.js wires the button); inside a row that is itself a
  // link (the colour key) it is a plain span. note: show its note; cls: more classes on the box; label: the button's text.
  const exHtml = (x, { note = true, link = true, cls = "", label = "" } = {}) => {
    const body = `<span class="tj-w" aria-hidden="true"><span class="tj-g" data-p="${x.p}" lang="ar" dir="rtl">${x.g.map(w => `<span>${esc(w)}</span>`).join("")}</span><span class="tj-t" lang="ar" dir="rtl">${esc(x.t)}</span></span>
      ${note && x.n ? `<span class="tj-note">${esc(L(x.n))}</span>` : ""}<span class="tj-ref">${esc(ref(x))}</span>`;
    if (!link) return `<span class="tj-ex${cls ? " " + cls : ""}" data-p="${x.p}">${body}</span>`;
    const listen = label || t("common.listen");
    return `<div class="tj-ex${cls ? " " + cls : ""}" data-p="${x.p}"><a class="tj-ex-a" href="#/mushaf/tajweed/${x.p}?v=${x.k}" aria-label="${esc(`${x.t} (${ref(x)})`)}">${body}</a>
      <button class="tj-play" type="button" data-k="${x.k}"${label ? ` data-label="${esc(label)}"` : ""} aria-label="${esc(listen)}">${icon("play")}<span>${esc(listen)}</span></button></div>`;
  };
  return { drawExamples, exHtml, ref };
}
