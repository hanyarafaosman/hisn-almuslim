/* ===== رمضان: العدّ إلى دخوله، والدعاء ببلوغه، وفضله (#/ramadan) ===== */
// The countdown is computed with the Hijri calendar of js/hijri.js (Umm al-Qura, moved by the user's day adjustment).
// The texts are in data/ramadan.json (scripts/build-ramadan.js), copied word for word from «لطائف المعارف» by Ibn Rajab
// and «رياض الصالحين» by al-Nawawi; each hadith also carries its place in the hadith reader, where its translations are.
// The Arabic texts are never translated here: readers of other languages get a short heading or note for each (an
// interface string), the meaning of the verses in their chosen translation (QuranEnc), the official English of the
// dhikr of Hisn al-Muslim, and the Arabic text folded under «the Arabic text from its source».

const DAY = 864e5;
const RING = 2 * Math.PI * 52;

export function setupRamadan(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, share, copy, SITE, setHeader, setNav, version, hijri: HJ, Q, adhkar, catTitle, catById } = ctx;
  const T = (k, p) => esc(t(k, p));
  const isAr = () => getLang() === "ar";
  const stale = hash => location.hash !== hash;

  // ---------- where the year stands ----------
  // In Ramadan: the day of the month and the days left to the Eid. Before it: the days left to its first day, how much
  // of the way from the last Ramadan has passed, and the months still on the way.
  function status() {
    const now = HJ.today(), h = HJ.hijriOf(now);
    if (h.m === 9) { const len = HJ.lengthOf(h.y, 9); return { in: true, now, h, day: h.d, len, toEid: len - h.d + 1 }; }
    const y = h.m < 9 ? h.y : h.y + 1, start = HJ.dayOf(y, 9, 1), prev = HJ.dayOf(y - 1, 10, 1);
    const path = []; for (let yy = h.y, mm = h.m; path.length < 12; [yy, mm] = HJ.nextMonth(yy, mm)) { path.push([yy, mm]); if (mm === 9) break; }
    return { in: false, now, h, y, start, days: Math.round((start - now) / DAY), done: (now - prev) / (start - prev), path };
  }
  const countText = s => s.in ? t("ramadan.dayN", { n: s.day }) : t("ramadan.hubLeft", { n: s.days });
  const firstDay = s => t("ramadan.firstDay", { date: HJ.gregText(s.start) });

  // ---------- Home: the count, a way to the page ----------
  const hubLine = () => `<a class="hub-date rm-hub" href="#/ramadan">${icon("moon")}<span>${esc(countText(status()))}</span>${icon("back", "chev")}</a>`;

  // ---------- the hero ----------
  const ring = (part, big, unit) => `<div class="rm-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"/><circle class="p" cx="60" cy="60" r="52" stroke-dasharray="${RING.toFixed(1)}" stroke-dashoffset="${(RING * (1 - Math.max(0, Math.min(1, part)))).toFixed(1)}"/></svg><div class="rm-count"><b>${esc(num(big))}</b><span>${esc(unit)}</span></div></div>`;
  function heroHtml(s) {
    const note = `<a class="rm-note" href="#/hijri">${T("ramadan.calcNote")}</a>`;
    if (s.in) return `<section class="hero rm-hero">
        <div class="rm-top">${ring(s.day / s.len, s.day, t("ramadan.title"))}
          <div class="rm-info"><small>${T("ramadan.mubarak")}</small><h2>${T("ramadan.dayN", { n: s.day })}</h2><p>${esc(HJ.gregText(s.now))}</p></div></div>
        <div class="hj-chips">${s.day >= 21 ? `<span class="hj-chip">${icon("star")} ${T("hijri.ev.lastTen")}</span>` : ""}<span class="hj-chip">${icon("moon")} ${T("hijri.ev.fitr")}${sep()}${esc(HJ.inDays(s.toEid))}</span></div>
        ${note}</section>`;
    const chips = [s.h.m === 8 && s.h.d === 29 ? "ramadan.sighting" : "", s.days === 1 ? "ramadan.tomorrow" : ""].filter(Boolean);
    // The months on the way, when Ramadan is near enough for them to fit on a line.
    const path = s.path.length > 1 && s.path.length <= 5 ? `<div class="rm-path">${s.path.map(([y, m], i) => `<div>${i ? icon("back", "flip") : ""}<span class="${i === 0 ? "cur" : ""}${m === 9 ? " goal" : ""}">${m === 9 ? icon("moon") : ""}${esc(HJ.monthName(y, m))}</span></div>`).join("")}</div>` : "";
    return `<section class="hero rm-hero">
        <div class="rm-top">${ring(s.done, s.days, t("ramadan.days", { n: s.days }))}
          <div class="rm-info"><small>${T("ramadan.left")}</small><h2>${esc(HJ.hijriText(s.start, { month: "long", year: "numeric" }))}</h2><p>${esc(firstDay(s))}</p></div></div>
        ${chips.length ? `<div class="hj-chips">${chips.map(k => `<span class="hj-chip">${icon("moon")} ${T(k)}</span>`).join("")}</div>` : ""}
        ${path}${note}</section>`;
  }

  // ---------- the texts ----------
  let DATA = null, names = n => String(n);
  async function load() {
    DATA ||= await fetch(`data/ramadan.json?v=${version}`).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
    names = await Q.surahNames().catch(() => names);
  }
  const pages = p => num(p.join("–"));
  const lataif = q => `<p class="fadl-cite">— ${T("ramadan.lataif", { n: pages(q.p) })}</p>`;
  const ar = (cls, s) => `<p class="${cls}" lang="ar" dir="rtl">${esc(s)}</p>`;
  // A passage of the source: open for readers of Arabic, folded under the translated note for the others.
  const passage = (q, cite) => isAr() ? `<blockquote class="rm-q" lang="ar" dir="rtl">${esc(q.t)}</blockquote>${cite}`
    : `<details class="fadl rm-src"><summary>${icon("book")}<span>${T("ramadan.arabicSource")}</span></summary><div class="fadl-body"><blockquote lang="ar" dir="rtl">${esc(q.t)}</blockquote>${cite}</div></details>`;
  const note = key => isAr() ? "" : `<p class="rm-p">${T(key)}</p>`;
  // Where the hadith opens in the hadith reader (with its translations).
  const reader = h => { if (!h) return ""; const [book, n, sec] = h, nm = DATA.hbooks[book] || [book, book]; return `<a class="g-ref" href="#/hadith/${book}/${sec}?h=${n}">${icon("books")}<span>${esc(nm[isAr() ? 0 : 1])}</span>${icon("back", "flip")}</a>`; };
  const head = (ic, title, extra = "") => `<div class="rm-h">${icon(ic)}<b>${esc(title)}</b>${extra}</div>`;
  const hadithCard = (v, title, noteKey = "", cls = "rm-hadith") => `<article class="rm-card">${head("star", title)}
      ${noteKey ? note(noteKey) : ""}
      ${ar(cls, v.q ? `«${v.t}»` : v.t)}
      ${ar("rm-by", `${v.by} — ${v.src}`)}
      <p class="fadl-cite">— ${T("ramadan.riyad", { n: v.n })}</p>${reader(v.h)}</article>`;
  function verseHtml(ref) {
    const v = DATA.verses[ref]; if (!v) return "";
    const label = `${names(v.s)}${sep()}${num(v.from === v.to ? String(v.from) : `${v.from}–${v.to}`)}`;
    return `<div class="g-ev g-q"><p class="g-aya" lang="ar" dir="rtl">﴿${v.text.map((a, i) => `${esc(a)} <span class="g-n">${esc(num(v.from + i))}</span>`).join(" ")}﴾</p>
      ${v.text.map((a, i) => `<p class="g-tr" data-s="${v.s}" data-a="${v.from + i}" hidden></p>`).join("")}
      <a class="g-ref" href="#/quran/hafs/${v.s}${v.from > 1 ? "?a=" + v.from : ""}">${icon("quran")}<span>${esc(label)}</span>${icon("back", "flip")}</a></div>`;
  }
  function hilalHtml() {
    const d = adhkar.item(DATA.hilal); if (!d) return "";
    return `<h2 class="section-title">${esc(catTitle(d.cat))}</h2>
      <div class="g-ev g-d rm-hilal" data-d="${DATA.hilal}"><div class="g-d-top"><p class="g-dhikr" lang="ar" dir="rtl">${adhkar.format(d.item.text)}</p>${d.item.audio ? `<button class="icon-btn g-play" data-audio="${esc(d.item.audio)}" aria-label="${T("common.listen")}">${icon("play")}</button>` : ""}</div>
        <div class="g-d-tr" hidden></div>
        <a class="g-ref" href="#/cat/${d.cat.id}?item=${DATA.hilal}">${icon("book")}<span>${T("about.hisnTitle")}</span>${icon("back", "flip")}</a></div>`;
  }
  function bodyHtml() {
    const q = DATA.quotes;
    return `
      <h2 class="section-title">${T("ramadan.duaTitle")}</h2>
      <p class="rm-lead">${T("ramadan.duaIntro")}</p>
      <article class="rm-card">${head("heart", t("ramadan.salafTitle"))}
        ${isAr() ? `<blockquote class="rm-q" lang="ar" dir="rtl">${esc(q.salaf.t)}</blockquote>` : note("ramadan.salafNote")}
        ${ar("rm-dua", q.dua.t)}
        ${note("ramadan.salafMeaning")}
        <div class="rm-bar">${lataif(q.dua)}<span class="spacer"></span>
          <button class="icon-btn" id="rm-copy" type="button" aria-label="${T("common.copy")}">${icon("copy")}</button>
          <button class="icon-btn" id="rm-share" type="button" aria-label="${T("common.share")}">${icon("share")}</button></div>
        ${isAr() ? "" : passage(q.salaf, "")}
      </article>
      <article class="rm-card">${head("book", t("ramadan.weakTitle"), `<span class="badge danger">${T("ramadan.weak")}</span>`)}
        ${isAr() ? "" : ar("rm-dua sm", `«${q.weakDua.t}»`) + note("ramadan.weakNote")}
        ${passage(q.weak, lataif(q.weak))}
      </article>
      <article class="rm-card">${head("star", t("ramadan.nimaTitle"))}
        ${note("ramadan.nimaNote")}
        ${passage(q.nima, lataif(q.nima))}
      </article>
      ${hilalHtml()}
      <h2 class="section-title">${T("ramadan.fadlTitle")}</h2>
      <article class="rm-card">${head("bell", t("ramadan.bushraTitle"))}
        ${note("ramadan.bushraNote")}
        ${passage(q.bushra, lataif(q.bushra))}
        ${reader(q.bushra.h)}
      </article>
      <div class="g-evs rm-verses">${Object.keys(DATA.verses).map(verseHtml).join("")}</div>
      <p class="source-note g-trsrc" hidden></p>
      ${DATA.virtues.map(v => hadithCard(v, t("ramadan.v." + v.id))).join("")}
      <h2 class="section-title">${T("ramadan.inTitle")}</h2>
      ${hadithCard(DATA.qadrDua, t("ramadan.qadrDua"), "ramadan.qadrNote", "rm-dua")}
      <div class="list rm-links">
        ${DATA.chapters.map(id => catById.get(id)).filter(Boolean).map(c => `<a href="#/cat/${c.id}"><div class="num">${icon("food")}</div><div class="lbl">${esc(catTitle(c))}</div>${icon("back", "chev")}</a>`).join("")}
        <a href="#/hijri"><div class="num">${icon("calendar")}</div><div class="lbl">${T("hijri.title")}</div>${icon("back", "chev")}</a>
      </div>
      <p class="source-note">${T("ramadan.source")}</p>`;
  }
  // After the texts are in the page: the recording and the official English of the dhikr, and the verses' meanings.
  function wire(root, hash) {
    root.querySelectorAll(".g-play").forEach(b => { b.onclick = () => adhkar.toggle(b.dataset.audio, b); });
    if (adhkar.showTr() && root.querySelector(".g-d")) adhkar.en().then(en => {
      if (stale(hash)) return;
      root.querySelectorAll(".g-d").forEach(el => {
        const x = en.items[el.dataset.d], box = el.querySelector(".g-d-tr"); if (!x?.t || !box) return;
        box.innerHTML = `${x.n ? `<p class="g-d-n" lang="ar-Latn" dir="ltr">${esc(x.n)}</p>` : ""}<p lang="en" dir="ltr">${esc(x.t)}</p>`; box.hidden = false;
      });
    }).catch(() => {});
    let src = null;
    root.querySelectorAll(".g-tr").forEach(el => Q.ayaMeaning(Number(el.dataset.s), Number(el.dataset.a)).then(m => {
      if (!m?.text || stale(hash) || !el.isConnected) return;
      el.textContent = m.text.replace(/\s*\[\d+\]/g, ""); el.dir = m.meta?.direction === "rtl" ? "rtl" : "ltr"; el.lang = m.meta?.language_iso_code || ""; el.hidden = false;
      if (!src && m.meta) { src = root.querySelector(".g-trsrc"); if (src) { src.textContent = t("quran.trSource", { title: m.meta.title, v: m.meta.version }); src.hidden = false; } }
    }).catch(() => {}));
    const dua = DATA.quotes.dua.t, cite = t("ramadan.lataif", { n: pages(DATA.quotes.dua.p) });
    $("#rm-copy").onclick = () => copy(`${dua}\n\n— ${cite}`);
    $("#rm-share").onclick = () => share(t("ramadan.duaTitle"), `${dua}\n\n— ${cite}\n${t("app.name")}\n${SITE}#/ramadan`);
  }

  async function render() {
    setNav("more"); const hash = location.hash, s = status();
    setHeader(t("ramadan.title"), { back: true, actions: `<button class="icon-btn" id="rm-send" aria-label="${T("common.share")}">${icon("share")}</button>` });
    view.innerHTML = `${heroHtml(s)}<div id="rm-body"><div class="empty"><div class="spinner"></div><div>${T("common.loading")}</div></div></div>`;
    // The count is shared in the reader's language; the supplication goes with it for readers of Arabic.
    $("#rm-send").onclick = () => share(t("ramadan.title"), `${countText(s)}${s.in ? "" : "\n" + firstDay(s)}${isAr() && DATA ? "\n\n" + DATA.quotes.dua.t : ""}\n\n— ${t("app.name")}\n${SITE}#/ramadan`);
    const box = $("#rm-body");
    try { await load(); } catch (e) {
      if (stale(hash)) return;
      box.innerHTML = `<div class="empty">${icon("download")}<div>${T(!navigator.onLine || e instanceof TypeError ? "offline.needOnce" : "common.loadFailed")}</div><br><button class="btn" id="retry">${T("common.retry")}</button></div>`;
      $("#retry").onclick = render; return;
    }
    if (stale(hash)) return;
    box.innerHTML = bodyHtml(); wire(box, hash);
  }

  return { render, hubLine, status };
}
