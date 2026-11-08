/* ===== القراءات العشر: القراء ورواتهم، وقواعد الأصول بأدلتها من المتون، ومقارنة الروايات ===== */
// data/qiraat.json (scripts/build-qiraat.js) holds the readers, the chapters of the uṣūl with their examples, and the
// chapters of الشاطبية, الدرة and طيبة النشر that are their evidence (read through js/mutun.js). The comparison of the
// riwayat is made here from the King Fahd Complex texts the Quran reader already has (js/qdiff.js): Hafs's words are
// aligned with another riwayah's, and the words that read differently are marked. A verse can be heard in every
// riwayah that has a recitation with verse timings (Q.clips, js/clip.js).
import { makeClipPlayer } from "./clip.js?v=1.38.0";
import { compare, words, AYA_NUM } from "./qdiff.js?v=1.38.0";

export function setupQiraat(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, LS, Q, toast, sheet, closeSheet, setHeader, setNav, mutun } = ctx;
  // riw: the riwayat shown in the comparison (null: all); vowels: whether vowel differences are marked
  const prefs = Object.assign({ riw: null, vowels: true }, LS.get("qiraat", {}));
  const save = () => LS.set("qiraat", prefs);
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";
  const L = x => x[isAr() ? 0 : 1];
  const clip = makeClipPlayer({ Q, t, icon, esc, toast });
  const BOOKS = ["shatibiyya", "durrah", "tayyiba"];

  let DATA = null, RIW = null, names = n => String(n);
  async function load() {
    if (!DATA) { const r = await fetch("data/qiraat.json"); if (!r.ok) throw new Error("HTTP " + r.status); DATA = await r.json(); }
    names = await Q.surahNames(); RIW ||= await Q.riwayat(); return DATA;
  }
  const loading = () => `<div class="empty"><div class="spinner"></div><div>${esc(t("common.loading"))}</div></div>`;
  const failed = (err, retry) => {
    const offline = !navigator.onLine || err instanceof TypeError;
    view.innerHTML = `<div class="empty">${icon("download")}<div>${esc(t(offline ? "offline.needOnce" : "common.loadFailed"))}</div><br><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`;
    $("#retry").onclick = retry;
  };
  const enNote = () => isAr() || getLang() === "en" ? "" : `<p class="info">${icon("translate")}<span>${esc(t("tajweed.inEnglish"))}</span></p>`;
  const AR = /[ء-ي]/;
  const para = s => esc(s).replace(/﴿([^﴾]{1,200})﴾/g, '<bdi class="q" lang="ar" dir="rtl">﴿$1﴾</bdi>')
    .replace(/«([^»]{1,200})»/g, (m, x) => AR.test(x) && !isAr() ? `<bdi lang="ar" dir="rtl">«${x}»</bdi>` : m);
  const rShort = rid => t("riwayahShort." + rid);
  const others = () => RIW.map(r => r.id).filter(id => id !== "hafs");

  // ---------- the texts of the riwayat and their comparison (once per surah and riwayah) ----------
  const texts = new Map();
  const textOf = rid => { if (!texts.has(rid)) texts.set(rid, Q.textOf(rid).catch(e => { texts.delete(rid); throw e; })); return texts.get(rid); };
  const cmpMemo = new Map();
  async function cmp(rid, s) {
    const k = rid + ":" + s;
    if (!cmpMemo.has(k)) { const [h, r] = await Promise.all([textOf("hafs"), textOf(rid)]); cmpMemo.set(k, compare(h.data.s[s - 1], r.data.s[s - 1])); }
    return cmpMemo.get(k);
  }
  const tail = text => (AYA_NUM.exec(text) || [""])[0]; // the verse's number as the Mushaf writes it
  const cls = c => c === 2 ? "qd2" : c === 1 ? "qd1" : c === 3 ? "qd3" : "";
  // Hafs's verse a of surah s; mark: positions of words to highlight (the words of an example).
  function hafsHtml(h, s, a, mark) {
    const verse = h.data.s[s - 1][a - 1];
    return words([verse]).map((w, i) => `<span class="${mark && mark.includes(i + 1) ? "qd2" : ""}">${esc(w.w)}</span>`).join(" ") + esc(tail(verse[0]));
  }
  // The words of riwayah r that stand against Hafs's verse a, in its own spelling, with that riwayah's verse numbers.
  function spanHtml(res, r, s, a) {
    const [j0, j1] = res.span[a - 1], R = res.R;
    if (j1 < j0) return `<span class="qr-none">${esc(t(a === 1 && !r.meta.basmalaIsAya ? "qiraat.basmalaNotAya" : "qiraat.noVerse"))}</span>`;
    const out = [];
    if (j0 > 0 && R[j0 - 1].a === R[j0].a) out.push("…");
    for (let j = j0; j <= j1; j++) {
      const last = j === R.length - 1 || R[j + 1].a !== R[j].a; // the last word of its verse carries the verse's number
      out.push(`<span class="${cls(res.cls[j])}">${esc(R[j].w)}</span>` + (last ? esc(tail(r.data.s[s - 1][R[j].a - 1][0])) : ""));
    }
    if (j1 < R.length - 1 && R[j1 + 1].a === R[j1].a) out.push("…");
    return out.join(" ");
  }
  // One line of the comparison: the riwayah, its words in its font, and a «listen» button when it has a timed recitation.
  const row = (rid, label, html, k, playable = true) => `<div class="qr-row" style="--qfont:'kfgqpc-${rid}'"><div class="qr-name">${esc(label)}</div><div class="qr-text${prefs.vowels ? "" : " novow"}" lang="ar" dir="rtl">${html}</div>${playable && k && Q.clips(rid) ? clip.button(k, { r: rid, cls: "qr-play", iconOnly: true }) : ""}</div>`;
  const failRow = (rid, msg) => `<div class="qr-row"><div class="qr-name">${esc(rShort(rid))}</div><div class="qr-text sub">${esc(msg)}</div></div>`;
  // Riwayah rid's line for Hafs's verse a (its own verse numbers in the label; the clip plays its own first verse).
  async function riwRow(rid, s, a) {
    const r = await textOf(rid), res = await cmp(rid, s), [j0, j1] = res.span[a - 1];
    const label = j1 < j0 ? rShort(rid) : `${rShort(rid)} ${num(res.R[j0].a)}${res.R[j1].a !== res.R[j0].a ? "–" + num(res.R[j1].a) : ""}`;
    return row(rid, label, spanHtml(res, r, s, a), j1 < j0 ? "" : `${s}:${res.R[j0].a}`);
  }
  const legend = () => `<div class="qr-legend"><span><i class="qd2"></i>${esc(t("qiraat.legendLetters"))}</span><span><i class="qd1"></i>${esc(t("qiraat.legendVowels"))}</span><span><i class="qd3"></i>${esc(t("qiraat.legendOnly"))}</span></div>`;

  // Verses from..to of a matn, as on the Tajweed page, with a way to the whole chapter.
  async function poemHtml(book, from, to, open = false, heading = "") {
    const MT = mutun(); let b, v;
    try { b = await MT.book(book); v = await MT.verses(book); } catch { return `<p class="source-note">${esc(t("common.loadFailed"))}</p>`; }
    const ci = b.chapters.findIndex(c => from >= c.from && from <= c.to);
    return `<details class="tj-matn"${open ? " open" : ""}><summary>${icon("book")}<span>${esc(t("tajweed.fromBook", { book: L(b.title) }))}${heading || ci >= 0 ? `<span class="sub">${esc(heading || b.chapters[ci].t)}</span>` : ""}</span></summary>
      <div class="tj-poem" lang="ar" dir="rtl">${v.slice(from - 1, to).map((x, i) => `<div class="bt"><span class="n">${num(from + i)}</span><span>${esc(x[0])}</span><span>${esc(x[1])}</span></div>`).join("")}</div>
      <p class="source-note">${esc(L(b.author))}${ci >= 0 ? `${sep()}<a href="#/mutun/${book}/${ci}?v=${from}">${esc(t("mutun.fullChapter"))}</a>` : ""}</p></details>`;
  }

  // ---------- the index: the readers, the comparison, the chapters of the uṣūl ----------
  async function renderIndex() {
    setNav("quran"); setHeader(t("qiraat.title"), { back: true }); const hash = location.hash; view.innerHTML = loading(); clip.stop();
    try { await load(); } catch (e) { if (!stale(hash)) failed(e, renderIndex); return; }
    if (stale(hash)) return;
    const reader = r => `<a class="rd" href="#/qiraat/reader/${r.id}"><div class="rd-name">${esc(L(r.n))}</div><div class="rd-sub">${esc(L(r.city))}${sep()}${esc(t("qiraat.died", { year: num(r.died) }))}</div>
      <div class="rd-nar">${r.nar.map(x => `<span class="${x.riwayah ? "has" : ""}">${x.riwayah ? icon("check") : ""}${esc(L(x.n))}</span>`).join("")}</div></a>`;
    view.innerHTML = `${enNote()}
      <div class="tj-text">${DATA.intro.map(p => `<p>${para(L(p))}</p>`).join("")}</div>
      <h2 class="section-title">${esc(t("qiraat.readers"))}</h2>
      <div class="rd-grid">${DATA.readers.map(reader).join("")}</div>
      <p class="source-note">${icon("check")} ${esc(t("qiraat.hasText"))}</p>
      <h2 class="section-title">${esc(t("qiraat.compare"))}</h2>
      <div class="card qr-pick"><p>${esc(t("qiraat.compareHint"))}</p>
        <select id="qr-s" aria-label="${esc(t("qiraat.chooseSurah"))}"><option value="">${esc(t("qiraat.chooseSurah"))}</option>${Array.from({ length: 114 }, (_, i) => `<option value="${i + 1}">${num(i + 1)}${sep()}${esc(names(i + 1))}</option>`).join("")}</select></div>
      <h2 class="section-title">${esc(t("qiraat.usul"))}</h2>
      <div class="list">${DATA.usul.map((u, i) => `<a href="#/qiraat/usul/${u.id}"><div class="num">${num(i + 1)}</div><div class="lbl">${esc(L(u.t))}</div>${icon("back", "chev")}</a>`).join("")}</div>
      <h2 class="section-title">${esc(t("tajweed.seriesLink"))}</h2>
      <div class="list"><a href="#/videos?g=tajweed"><div class="num">${icon("video")}</div><div class="lbl">${esc(t("radio.videosLink", { group: t("media.tajweed") }))}</div>${icon("back", "chev")}</a><a href="#/radio/tajweed"><div class="num">${icon("headphones")}</div><div class="lbl">${esc(t("qaida.audioLink", { group: t("media.tajweed") }))}</div>${icon("back", "chev")}</a></div>
      <p class="source-note">${esc(L(DATA.sourceNote))}</p>`;
    $("#qr-s").onchange = e => { if (e.target.value) location.hash = `#/qiraat/surah/${e.target.value}`; };
  }

  // ---------- a reader: his narrators, and the verses of the matns that introduce him ----------
  async function renderReader(id) {
    setNav("quran"); const hash = location.hash; setHeader(t("qiraat.title"), { back: true }); view.innerHTML = loading(); clip.stop();
    try { await load(); } catch (e) { if (!stale(hash)) failed(e, () => renderReader(id)); return; }
    if (stale(hash)) return;
    const r = DATA.readers.find(x => x.id === id); if (!r) { location.replace("#/qiraat"); return; }
    setHeader(L(r.n), { back: true });
    const nar = x => `<div class="card qr-nar"><b>${esc(L(x.n))}</b><div class="sub">${esc(L(x.full))}${sep()}${esc(t("qiraat.died", { year: num(x.died) }))}</div>
      ${x.riwayah ? `<div class="qr-nar-actions"><a class="btn small" href="#/quran/${x.riwayah}/1">${icon("quran")} ${esc(t("qiraat.readMushaf"))}</a>${Q.clips(x.riwayah) ? `<span class="pill ghost">${icon("headphones")} ${esc(t("qiraat.hasAudio"))}</span>` : ""}</div>` : `<div class="sub">${esc(t("qiraat.noText"))}</div>`}</div>`;
    const poems = await Promise.all(Object.entries(r.ref).map(([book, [from, to]]) => poemHtml(book, from, to, true)));
    if (stale(hash)) return;
    view.innerHTML = `${enNote()}
      <section class="hero slim"><h2>${esc(L(r.n))}</h2><p>${esc(L(r.full))}</p><p>${esc(L(r.city))}${sep()}${esc(t("qiraat.died", { year: num(r.died) }))}${r.kufi ? sep() + esc(t("qiraat.kufi")) : ""}</p></section>
      <h2 class="section-title">${esc(t("qiraat.narrators"))}</h2>${r.nar.map(nar).join("")}
      <h2 class="section-title">${esc(t("qiraat.evidence"))}</h2>${poems.join("")}
      <p class="source-note">${esc(L(DATA.sourceNote))}</p>`;
  }

  // ---------- a chapter of the uṣūl: the rule, its examples in the riwayat, and the matns' chapters ----------
  async function exampleHtml(x) {
    const [s, a] = x.k.split(":").map(Number);
    let h; try { h = await textOf("hafs"); } catch { return ""; }
    const rows = [row("hafs", rShort("hafs"), hafsHtml(h, s, a, x.w), `${s}:${a}`)];
    for (const rid of x.riwayat) { try { rows.push(await riwRow(rid, s, a)); } catch { rows.push(failRow(rid, t("qiraat.notSaved"))); } }
    return `<div class="qr"><div class="qr-head"><span class="qr-ref">${esc(t("quran.surah", { name: names(s) }))}${sep()}${esc(t("player.aya", { n: a }))}</span>${x.textual === false ? `<span class="pill ghost">${esc(t("qiraat.heard"))}</span>` : ""}</div>
      <p class="qr-note">${esc(L(x.n))}</p>${rows.join("")}</div>`;
  }
  async function renderUsul(id) {
    setNav("quran"); const hash = location.hash; setHeader(t("qiraat.title"), { back: true }); view.innerHTML = loading(); clip.stop();
    try { await load(); } catch (e) { if (!stale(hash)) failed(e, () => renderUsul(id)); return; }
    if (stale(hash)) return;
    const i = DATA.usul.findIndex(u => u.id === id); if (i < 0) { location.replace("#/qiraat"); return; }
    const u = DATA.usul[i], prev = DATA.usul[i - 1], next = DATA.usul[i + 1];
    setHeader(L(u.t), { back: true });
    const [exs, poems] = await Promise.all([
      Promise.all(u.ex.map(exampleHtml)),
      Promise.all(BOOKS.flatMap(book => (u.ch[book] || []).map(async ci => { const b = await mutun().book(book).catch(() => null); const c = b?.chapters[ci]; return c ? poemHtml(book, c.from, c.to, false, c.t) : ""; }))),
    ]);
    if (stale(hash)) return;
    view.innerHTML = `${enNote()}
      <h2 class="tj-title">${esc(L(u.t))}</h2>
      <div class="tj-text">${u.p.map(p => `<p>${para(L(p))}</p>`).join("")}</div>
      ${exs.some(Boolean) ? `<h2 class="section-title">${esc(t("qiraat.examples"))}</h2>${legend()}${exs.join("")}` : ""}
      <h2 class="section-title">${esc(t("qiraat.evidence"))}</h2>${poems.join("") || `<p class="source-note">${esc(t("qiraat.noChapter"))}</p>`}
      <div class="tj-nav">
        ${prev ? `<a class="btn ghost" href="#/qiraat/usul/${prev.id}">${icon("back", "dir")} ${esc(L(prev.t))}</a>` : "<span></span>"}
        ${next ? `<a class="btn ghost" href="#/qiraat/usul/${next.id}">${esc(L(next.t))} ${icon("back", "flip")}</a>` : `<a class="btn ghost" href="#/qiraat">${esc(t("qiraat.title"))}</a>`}
      </div>
      <p class="source-note">${esc(L(DATA.sourceNote))}</p>`;
    clip.wire(view);
  }

  // ---------- a surah in the riwayat, verse by verse ----------
  async function renderSurah(s, params) {
    s = Math.min(114, Math.max(1, s | 0 || 1));
    setNav("quran"); const hash = location.hash; setHeader(t("qiraat.compare"), { back: true }); view.innerHTML = loading(); clip.stop();
    let h; try { await load(); h = await textOf("hafs"); } catch (e) { if (!stale(hash)) failed(e, () => renderSurah(s, params)); return; }
    if (stale(hash)) return;
    setHeader(t("quran.surah", { name: names(s) }), { back: true, onTitle: () => { location.hash = "#/qiraat"; } });
    const all = others(), shown = (prefs.riw || all).filter(id => all.includes(id));
    const ayat = h.data.s[s - 1];
    view.innerHTML = `${enNote()}
      <div class="chips qr-chips" id="qr-chips">${all.map(id => `<button type="button" class="chip ${shown.includes(id) ? "on" : ""}" data-r="${id}">${esc(rShort(id))}</button>`).join("")}</div>
      ${legend()}<label class="qr-vow"><input type="checkbox" id="qr-vow" ${prefs.vowels ? "checked" : ""}> ${esc(t("qiraat.showVowels"))}</label>
      <div id="qr-farsh"></div><div id="qr-fail"></div><div id="qr-list"></div><div id="qr-more" class="empty" hidden><div class="spinner"></div></div>
      <nav class="reader-nav">
        ${s > 1 ? `<a class="btn ghost" href="#/qiraat/surah/${s - 1}">${icon("back", "dir")} ${esc(names(s - 1))}</a>` : "<span></span>"}
        ${s < 114 ? `<a class="btn ghost" href="#/qiraat/surah/${s + 1}">${esc(names(s + 1))} ${icon("back", "flip")}</a>` : "<span></span>"}
      </nav>
      <p class="source-note">${esc(L(DATA.sourceNote))}</p>`;
    $("#qr-chips").onclick = e => {
      const b = e.target.closest("[data-r]"); if (!b) return;
      const set = new Set(shown); set.has(b.dataset.r) ? set.delete(b.dataset.r) : set.add(b.dataset.r);
      prefs.riw = all.filter(id => set.has(id)); save(); renderSurah(s, params);
    };
    $("#qr-vow").onchange = e => { prefs.vowels = e.target.checked; save(); view.querySelectorAll(".qr-text").forEach(x => x.classList.toggle("novow", !prefs.vowels)); };
    farshDetails(s).then(html => { if (!stale(hash)) $("#qr-farsh").innerHTML = html; });
    // The other riwayat: those that cannot be loaded (not saved, no connection) are said once at the top.
    const ready = [];
    for (const rid of shown) { try { ready.push([rid, await textOf(rid), await cmp(rid, s)]); } catch { $("#qr-fail").insertAdjacentHTML("beforeend", `<p class="info">${icon("download")}<span>${esc(t("qiraat.notSavedOf", { name: rShort(rid) }))}</span></p>`); } }
    if (stale(hash)) return;
    const block = a => `<div class="qr qr-aya" id="qa-${a}">${row("hafs", `${rShort("hafs")} ${num(a)}`, hafsHtml(h, s, a), `${s}:${a}`)}
      ${ready.map(([rid, r, res]) => { const [j0, j1] = res.span[a - 1]; const label = j1 < j0 ? rShort(rid) : `${rShort(rid)} ${num(res.R[j0].a)}${res.R[j1].a !== res.R[j0].a ? "–" + num(res.R[j1].a) : ""}`; return row(rid, label, spanHtml(res, r, s, a), j1 < j0 ? "" : `${s}:${res.R[j0].a}`); }).join("")}</div>`;
    const list = $("#qr-list"), more = $("#qr-more"); let drawn = 0;
    const draw = upTo => { const end = Math.min(ayat.length, upTo); if (end <= drawn) return; const frag = []; for (let a = drawn + 1; a <= end; a++) frag.push(block(a)); list.insertAdjacentHTML("beforeend", frag.join("")); drawn = end; clip.wire(list); more.hidden = drawn >= ayat.length; };
    const want = Number(params?.get("a")) || 0;
    draw(Math.max(20, want + 5)); more.hidden = drawn >= ayat.length;
    new IntersectionObserver(es => { if (es.some(x => x.isIntersecting) && !stale(hash)) draw(drawn + 20); }, { rootMargin: "600px" }).observe(more);
    if (want > 1) { const el = document.getElementById("qa-" + want); if (el) requestAnimationFrame(() => { el.scrollIntoView({ block: "start" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1800); }); }
  }
  // The chapters of فرش الحروف about surah s in the three matns, folded; the verses load when opened.
  async function farshDetails(s) {
    const MT = mutun(), items = [];
    for (const book of BOOKS) { const b = await MT.book(book).catch(() => null); const ci = b ? b.chapters.findIndex(c => c.s && c.s.includes(s)) : -1; if (ci >= 0) items.push([book, b.chapters[ci]]); }
    if (!items.length) return "";
    const html = `<details class="tj-matn qr-farsh"><summary>${icon("book")}<span>${esc(t("qiraat.farshOf", { name: names(s) }))}</span></summary><div class="qr-farsh-body"><div class="empty"><div class="spinner"></div></div></div></details>`;
    queueMicrotask(() => {
      const d = $(".qr-farsh"); if (!d) return;
      d.addEventListener("toggle", async () => { if (!d.open || d.dataset.done) return; d.dataset.done = "1"; const parts = await Promise.all(items.map(([book, c]) => poemHtml(book, c.from, c.to, true, c.t))); d.querySelector(".qr-farsh-body").innerHTML = parts.join(""); }, { once: false });
    });
    return html;
  }

  return {
    render(parts, params) {
      if (parts[0] === "reader") return renderReader(parts[1]);
      if (parts[0] === "usul") return renderUsul(parts[1]);
      if (parts[0] === "surah") return renderSurah(Number(parts[1]), params);
      return renderIndex();
    },
    // From the verse tools of the Quran reader: verse a of surah s, as the user's riwayah numbers it, in every riwayah.
    async openAyah({ s, a, rid }) {
      const body = sheet(t("qiraat.verseIn"), loading(), { tall: true });
      try {
        await load(); const h = await textOf("hafs"); let ha = a;
        if (rid !== "hafs") { // the Hafs verse that the user's verse stands against
          const res = await cmp(rid, s); const j0 = res.R.findIndex(w => w.a === a);
          const hi = res.span.findIndex(([x, y]) => j0 >= x && j0 <= y); if (hi >= 0) ha = hi + 1;
        }
        const results = await Promise.allSettled(others().map(id => riwRow(id, s, ha)));
        body.innerHTML = `${legend()}<div class="qr">${row("hafs", `${rShort("hafs")} ${num(ha)}`, hafsHtml(h, s, ha), `${s}:${ha}`)}${results.map((x, i) => x.status === "fulfilled" ? x.value : failRow(others()[i], t("qiraat.notSaved"))).join("")}</div>
          <div class="more-row"><a class="btn" href="#/qiraat/surah/${s}?a=${ha}" id="qr-open">${icon("layers")} ${esc(t("qiraat.openCompare"))}</a></div>`;
        clip.wire(body); $("#qr-open").onclick = () => closeSheet();
      } catch { body.innerHTML = `<div class="empty">${esc(t("common.loadFailed"))}</div>`; }
    },
  };
}
