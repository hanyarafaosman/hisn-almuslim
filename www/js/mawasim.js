/* ===== بشريات مواسم الخير (#/mawasim): إعلان أقرب مواسم الطاعة، والأيام الفاضلة القريبة ===== */
// Nothing here is tied to a year: the season to announce is worked out each time from the Hijri calendar of
// js/hijri.js (Umm al-Qura, moved by the user's day adjustment). Now it is Ramadan that is announced, with the days
// left to it; in the month, its day and the days left to the Eid; after it the six days of Shawwal, then the ten days
// of Dhul-Hijjah with ʿArafah and the Eid, the days of Tashriq, ʿAshura, and Ramadan again. Beside the season
// announced come the virtuous days at hand (the white days, Monday and Thursday, Friday, Shaʿban) and the seasons
// after it, each with a page of its own (#/mawasim/<id>).
// The texts are in data/mawasim.json (scripts/build-mawasim.js), copied word for word from «لطائف المعارف» by Ibn
// Rajab and «رياض الصالحين» by al-Nawawi; each hadith also carries its place in the hadith reader, where its
// translations are. The Arabic texts are never translated here: readers of other languages get the short note of each
// season (an interface string), the meaning of the verses in their chosen translation (QuranEnc), the official
// English of the adhkar of Hisn al-Muslim, and for Ramadan the Arabic passages folded under «the text from its source».

const DAY = 864e5;
const RING = 2 * Math.PI * 52;
// The seasons by their place in the Hijri year: m = month, d–to = its days (no month = every month), wd = weekdays.
// lead = it is announced on Home when it is the nearest; span = a stretch of days any of which will do (no day is
// counted in it); cycle = days between two comings (for the ring).
const SEASONS = [
  { id: "ramadan", m: 9, d: 1, to: 30, lead: true, icon: "moon" },
  { id: "fitr", m: 10, d: 1, lead: true, icon: "star" },
  { id: "sixShawwal", m: 10, d: 2, to: 30, lead: true, span: true, icon: "moon" },
  { id: "tenDhulHijjah", m: 12, d: 1, to: 10, lead: true, icon: "kaaba" },
  { id: "arafah", m: 12, d: 9, lead: true, icon: "kaaba" },
  { id: "adha", m: 12, d: 10, lead: true, icon: "star" },
  { id: "tashriq", m: 12, d: 11, to: 13, lead: true, icon: "food" },
  { id: "ashura", m: 1, d: 10, lead: true, icon: "moon" }, // the 9th is fasted with it: its note says so
  { id: "shaban", m: 8, d: 1, to: 30, span: true, icon: "moon" },
  { id: "white", d: 13, to: 15, icon: "moon", cycle: 30 },
  { id: "monThu", wd: [1, 4], icon: "moon", cycle: 7 },
  { id: "friday", wd: [5], icon: "kaaba", cycle: 7 },
];
const NEAR_DAYS = 10; // a virtuous day is "at hand" when it comes within these days

export function setupMawasim(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, share, copy, SITE, setHeader, setNav, version, hijri: HJ, Q, adhkar, catTitle, catById } = ctx;
  const T = (k, p) => esc(t(k, p));
  const isAr = () => getLang() === "ar";
  const stale = hash => location.hash !== hash;
  const weekday = ms => new Date(ms).getUTCDay(); // days are UTC-noon stamps (js/hijri.js)

  // ---------- names and notes: the calendar's own strings ----------
  const title = s => s.id === "ramadan" ? t("ramadan.title") : s.id === "shaban" ? HJ.monthName(HJ.hijriOf(HJ.today()).y, 8)
    : s.id === "monThu" ? t("hijri.monThu") : s.id === "friday" ? t("prayer.jumua") : t("hijri.ev." + s.id);
  const notes = s => s.id === "shaban" ? [t("mawasim.shabanNote")] : s.id === "monThu" ? [t("hijri.monThuNote")] : s.id === "friday" ? [t("hijri.fridayNote")]
    : s.id === "ashura" ? [t("hijri.ev.ashuraNote"), t("hijri.ev.tasuaNote")] : [t("hijri.ev." + s.id + "Note")];

  // ---------- when a season comes ----------
  // Days on which a voluntary fast has no place: Ramadan itself, the two Eids and the days of Tashriq.
  const fastable = ms => { const h = HJ.hijriOf(ms); return !(h.m === 9 || (h.m === 10 && h.d === 1) || (h.m === 12 && h.d >= 10 && h.d <= 13)); };
  // The coming of a season that is running now or is next: its first and last day, the days left to it, and when it
  // is running, which of its days today is.
  function occurrence(s, now = HJ.today()) {
    const make = (start, end, y) => ({ s, y, start, end, len: Math.round((end - start) / DAY) + 1, days: Math.round((start - now) / DAY), in: now >= start, day: now >= start ? Math.round((now - start) / DAY) + 1 : 0 });
    const h = HJ.hijriOf(now);
    if (s.wd) {
      for (let i = 0; i < 28; i++) { const ms = now + i * DAY; if (s.wd.includes(weekday(ms)) && (s.id !== "monThu" || fastable(ms))) return make(ms, ms, h.y); }
      return null;
    }
    const months = []; // the season's month last year, this year and next; or, for a monthly one, this month and those after it
    if (s.m) months.push([h.y - 1, s.m], [h.y, s.m], [h.y + 1, s.m]);
    else for (let i = 0, y = h.y, m = h.m; i < 4; i++, [y, m] = HJ.nextMonth(y, m)) months.push([y, m]);
    for (const [y, m] of months) {
      if (s.id === "white" && m === 9) continue; // the white days of Ramadan are fasted anyway
      const first = s.id === "white" && m === 12 ? 14 : s.d; // the 13th of Dhul-Hijjah is a day of Tashriq
      const start = HJ.dayOf(y, m, first), end = HJ.dayOf(y, m, Math.min(s.to || s.d, HJ.lengthOf(y, m)));
      if (end >= now) return make(start, end, y);
    }
    return null;
  }
  // The season to announce: the one running now (the latest to begin, when several are), else the next to begin.
  function featured(now = HJ.today()) {
    const list = SEASONS.filter(s => s.lead).map(s => occurrence(s, now)).filter(Boolean);
    return list.filter(o => o.in).sort((a, b) => b.start - a.start)[0] || list.sort((a, b) => a.start - b.start)[0];
  }
  // The other seasons and days running now or coming within a few days, nearest first.
  const near = (f, now = HJ.today()) => SEASONS.filter(s => s !== f.s).map(s => occurrence(s, now)).filter(o => o && (o.in || o.days <= NEAR_DAYS)).sort((a, b) => a.start - b.start);
  // The seasons of the year after the one announced, in the order they come.
  const coming = (f, now = HJ.today()) => SEASONS.filter(s => s.m && s !== f.s).map(s => occurrence(s, now)).filter(Boolean).sort((a, b) => a.start - b.start);

  // ---------- words ----------
  const when = o => !o.in ? HJ.inDays(o.days) : o.s.span ? t("mawasim.now") : o.len > 1 ? t("mawasim.dayOf", { n: o.day, total: o.len }) : t("prayer.today");
  const line = o => o.s.id === "ramadan" ? (o.in ? t("ramadan.dayN", { n: o.day }) : t("ramadan.hubLeft", { n: o.days })) : `${title(o.s)}${sep()}${when(o)}`;
  const dateOf = ms => `${HJ.hijriText(ms, { weekday: "long", day: "numeric", month: "long" })}${sep()}${HJ.gregText(ms, { day: "numeric", month: "long", year: "numeric" })}`;
  const firstDay = o => t("ramadan.firstDay", { date: HJ.gregText(o.start) });

  // ---------- Home: the announcement ----------
  function hubLine() {
    const f = featured(), n = near(f)[0];
    return `<a class="now mw-hub" href="#/mawasim">${icon(f.s.icon)}<div><small>${T("mawasim.title")}</small><b>${esc(line(f))}</b>${n ? `<span>${esc(line(n))}</span>` : ""}</div>${icon("back", "chev")}</a>`;
  }

  // ---------- the hero ----------
  const ring = (part, inner) => `<div class="rm-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"/><circle class="p" cx="60" cy="60" r="52" stroke-dasharray="${RING.toFixed(1)}" stroke-dashoffset="${(RING * (1 - Math.max(0, Math.min(1, part)))).toFixed(1)}"/></svg><div class="rm-count">${inner}</div></div>`;
  const count = (big, unit) => `<b>${esc(num(big))}</b><span>${esc(unit)}</span>`;
  const calcNote = () => `<a class="rm-note" href="#/hijri">${T("ramadan.calcNote")}</a>`;
  function ramadanHero(o) {
    const now = HJ.today(), h = HJ.hijriOf(now);
    if (o.in) return `<section class="hero rm-hero">
        <div class="rm-top">${ring(o.day / o.len, count(o.day, t("ramadan.title")))}
          <div class="rm-info"><small>${T("ramadan.mubarak")}</small><h2>${T("ramadan.dayN", { n: o.day })}</h2><p>${esc(HJ.gregText(now))}</p></div></div>
        <div class="hj-chips">${o.day >= 21 ? `<span class="hj-chip">${icon("star")} ${T("hijri.ev.lastTen")}</span>` : ""}<span class="hj-chip">${icon("moon")} ${T("hijri.ev.fitr")}${sep()}${esc(HJ.inDays(o.len - o.day + 1))}</span></div>
        ${calcNote()}</section>`;
    const prev = HJ.dayOf(o.y - 1, 10, 1); // the way already walked since the last Ramadan ended
    const chips = [h.m === 8 && h.d === 29 ? "ramadan.sighting" : "", o.days === 1 ? "ramadan.tomorrow" : ""].filter(Boolean);
    // The months on the way, when Ramadan is near enough for them to fit on a line.
    const path = []; for (let y = h.y, m = h.m; path.length < 12; [y, m] = HJ.nextMonth(y, m)) { path.push([y, m]); if (m === 9) break; }
    const way = path.length > 1 && path.length <= 5 ? `<div class="rm-path">${path.map(([y, m], i) => `<div>${i ? icon("back", "flip") : ""}<span class="${i === 0 ? "cur" : ""}${m === 9 ? " goal" : ""}">${m === 9 ? icon("moon") : ""}${esc(HJ.monthName(y, m))}</span></div>`).join("")}</div>` : "";
    return `<section class="hero rm-hero">
        <div class="rm-top">${ring((now - prev) / (o.start - prev), count(o.days, t("ramadan.days", { n: o.days })))}
          <div class="rm-info"><small>${T("ramadan.left")}</small><h2>${esc(HJ.hijriText(o.start, { month: "long", year: "numeric" }))}</h2><p>${esc(firstDay(o))}</p></div></div>
        ${chips.length ? `<div class="hj-chips">${chips.map(k => `<span class="hj-chip">${icon("moon")} ${T(k)}</span>`).join("")}</div>` : ""}
        ${way}${calcNote()}</section>`;
  }
  function heroHtml(o) {
    if (o.s.id === "ramadan") return ramadanHero(o);
    const s = o.s, foot = s.wd ? "" : calcNote();
    // Running: which of its days today is (or, for a single day, that it is today). Coming: the days left to it.
    if (o.in) return `<section class="hero rm-hero">
        <div class="rm-top">${o.len > 1 && !s.span ? ring(o.day / o.len, count(o.day, `/ ${num(o.len)}`)) : ring(1, icon(s.icon))}
          <div class="rm-info"><small>${T(o.len > 1 ? "mawasim.now" : "prayer.today")}</small><h2>${esc(title(s))}</h2><p>${esc(HJ.hijriText(HJ.today()))}</p></div></div>
        ${foot}</section>`;
    return `<section class="hero rm-hero">
        <div class="rm-top">${ring(1 - o.days / (s.cycle || 354), count(o.days, t("ramadan.days", { n: o.days })))}
          <div class="rm-info"><small>${esc(HJ.hijriText(o.start, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</small><h2>${esc(title(s))}</h2><p>${esc(HJ.gregText(o.start, { day: "numeric", month: "long", year: "numeric" }))}</p></div></div>
        ${foot}</section>`;
  }

  // ---------- the texts ----------
  let DATA = null, names = n => String(n);
  async function load() {
    DATA ||= await fetch(`data/mawasim.json?v=${version}`).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
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
  const head = (ic, text, extra = "") => `<div class="rm-h">${icon(ic)}<b>${esc(text)}</b>${extra}</div>`;
  const hadithCard = (v, heading = "", noteKey = "", cls = "rm-hadith") => `<article class="rm-card">${heading ? head("star", heading) : ""}
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
  const versesHtml = list => list?.length ? `<div class="g-evs rm-verses">${list.map(verseHtml).join("")}</div><p class="source-note g-trsrc" hidden></p>` : "";
  // A dhikr of Hisn al-Muslim, with its recording and a way to its chapter.
  function dhikrHtml(id, label) {
    const d = adhkar.item(id); if (!d) return "";
    return `<div class="g-ev g-d rm-dhikr" data-d="${id}"><div class="g-d-top"><p class="g-dhikr" lang="ar" dir="rtl">${adhkar.format(d.item.text)}</p>${d.item.audio ? `<button class="icon-btn g-play" data-audio="${esc(d.item.audio)}" aria-label="${T("common.listen")}">${icon("play")}</button>` : ""}</div>
        <div class="g-d-tr" hidden></div>
        <a class="g-ref" href="#/cat/${d.cat.id}?item=${id}">${icon("book")}<span>${esc(label || catTitle(d.cat))}</span>${icon("back", "flip")}</a></div>`;
  }
  const chapterLinks = (list, ic) => (list || []).map(id => catById.get(id)).filter(Boolean).map(c => `<a href="#/cat/${c.id}"><div class="num">${icon(ic)}</div><div class="lbl">${esc(catTitle(c))}</div>${icon("back", "chev")}</a>`).join("");
  const calendarLink = () => `<a href="#/hijri"><div class="num">${icon("calendar")}</div><div class="lbl">${T("hijri.title")}</div>${icon("back", "chev")}</a>`;

  // Ramadan: asking to reach it, the supplication on sighting the crescent, its virtue, and what is said in it.
  function ramadanHtml() {
    const q = DATA.quotes, own = DATA.seasons.ramadan, hilal = adhkar.item(own.d[0]);
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
      ${hilal ? `<h2 class="section-title">${esc(catTitle(hilal.cat))}</h2>${dhikrHtml(own.d[0], t("about.hisnTitle"))}` : ""}
      <h2 class="section-title">${T("ramadan.fadlTitle")}</h2>
      <article class="rm-card">${head("bell", t("ramadan.bushraTitle"))}
        ${note("ramadan.bushraNote")}
        ${passage(q.bushra, lataif(q.bushra))}
        ${reader(q.bushra.h)}
      </article>
      ${versesHtml(own.q)}
      ${DATA.virtues.map(v => hadithCard(v, t("ramadan.v." + v.id))).join("")}
      <h2 class="section-title">${T("ramadan.inTitle")}</h2>
      ${hadithCard(DATA.qadrDua, t("ramadan.qadrDua"), "ramadan.qadrNote", "rm-dua")}
      <div class="list rm-links">${chapterLinks(own.c, "food")}${calendarLink()}</div>`;
  }
  // Any other season: its note, the verses about it, the adhkar said in it and its hadith.
  function seasonHtml(s) {
    const own = DATA.seasons[s.id] || {};
    const links = `${chapterLinks(own.c, "book")}${s.id === "friday" ? `<a href="#/quran/hafs/18"><div class="num">${icon("quran")}</div><div class="lbl">${esc(names(18))}</div>${icon("back", "chev")}</a>` : ""}${s.wd ? "" : calendarLink()}`;
    return `
      <article class="rm-card">${head(s.icon, title(s))}${notes(s).map(x => `<p class="rm-p">${esc(x)}</p>`).join("")}</article>
      ${versesHtml(own.q)}
      ${(own.d || []).map(id => dhikrHtml(id)).join("")}
      ${(own.h || []).map(v => hadithCard(v)).join("")}
      ${links ? `<div class="list rm-links">${links}</div>` : ""}`;
  }
  const bodyHtml = s => s.id === "ramadan" ? ramadanHtml() : seasonHtml(s);
  // The seasons and days as rows, each leading to its page.
  const rows = list => `<div class="list hj-up">${list.map(o => `<a href="#/mawasim/${o.s.id}"><div class="num">${icon(o.s.icon)}</div><div class="lbl">${esc(title(o.s))}<span class="sub">${esc(dateOf(o.start))}</span></div><span class="hj-left">${esc(when(o))}</span></a>`).join("")}</div>`;

  // After the texts are in the page: the recordings and the official English of the adhkar, the verses' meanings,
  // and the copy and share buttons of the supplication.
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
    if (!root.querySelector("#rm-copy")) return;
    const dua = DATA.quotes.dua.t, cite = t("ramadan.lataif", { n: pages(DATA.quotes.dua.p) });
    $("#rm-copy").onclick = () => copy(`${dua}\n\n— ${cite}`);
    $("#rm-share").onclick = () => share(t("ramadan.duaTitle"), `${dua}\n\n— ${cite}\n${t("app.name")}\n${SITE}#/mawasim/ramadan`);
  }

  // #/mawasim: the season announced, the virtuous days at hand, its texts, then the seasons after it.
  // #/mawasim/<id>: one season.
  async function render(parts = []) {
    const one = parts[0] ? SEASONS.find(s => s.id === parts[0]) : null;
    if (parts[0] && !one) { location.replace("#/mawasim"); return; }
    setNav("more"); const hash = location.hash, f = featured(), o = one ? occurrence(one) : f;
    setHeader(one ? title(one) : t("mawasim.title"), { back: true, actions: `<button class="icon-btn" id="rm-send" aria-label="${T("common.share")}">${icon("share")}</button>` });
    const at = near(f);
    view.innerHTML = `${heroHtml(o)}
      ${!one && at.length ? `<h2 class="section-title">${T("mawasim.near")}</h2>${rows(at)}` : ""}
      <div id="rm-body"><div class="empty"><div class="spinner"></div><div>${T("common.loading")}</div></div></div>
      ${one ? `<div class="list rm-links"><a href="#/mawasim"><div class="num">${icon("moon")}</div><div class="lbl">${T("mawasim.title")}</div>${icon("back", "chev")}</a></div>` : `<h2 class="section-title">${T("hijri.upcoming")}</h2>${rows(coming(f))}`}
      <p class="source-note">${T("ramadan.source")}</p>`;
    // The announcement is shared in the reader's language; for Ramadan the supplication goes with it for readers of Arabic.
    $("#rm-send").onclick = () => share(t("mawasim.title"), `${line(o)}\n${o.s.id === "ramadan" && !o.in ? firstDay(o) : dateOf(o.in ? HJ.today() : o.start)}${o.s.id === "ramadan" && isAr() && DATA ? "\n\n" + DATA.quotes.dua.t : ""}\n\n— ${t("app.name")}\n${SITE}#/mawasim${one ? "/" + one.id : ""}`);
    const box = $("#rm-body");
    try { await load(); } catch (e) {
      if (stale(hash)) return;
      box.innerHTML = `<div class="empty">${icon("download")}<div>${T(!navigator.onLine || e instanceof TypeError ? "offline.needOnce" : "common.loadFailed")}</div><br><button class="btn" id="retry">${T("common.retry")}</button></div>`;
      $("#retry").onclick = () => render(parts); return;
    }
    if (stale(hash)) return;
    box.innerHTML = bodyHtml(o.s); wire(box, hash);
  }

  return { render, hubLine };
}
