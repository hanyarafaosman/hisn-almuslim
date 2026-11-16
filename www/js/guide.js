/* ===== ركن الأطفال (#/kids) ويوميات مسلم للمسلم الجديد (#/muslim) ===== */
// data/guide.json (scripts/build-guide.js) holds the structure of both pages and their evidence: verses (Arabic text),
// hadith (book, number and section, opened in the hadith reader), adhkar (numbers in data/hisn.json) and the reviewed
// books of IslamHouse.com per language. The words are in guide/<lang>.json, one file per interface language (Arabic is
// the original, English the reference; a missing text falls back to English).
//   Kids: units of questions and answers (the answer shows on a tap), then a quiz that earns stars (LS "guide".stars).
//   A Muslim's day: the new Muslim's first steps (short lessons marked done), and «My day», a checklist of the day in
//   three levels with the last seven days, the days kept in a row and a private note (all in LS "guide", on the device).

const pad = n => String(n).padStart(2, "0");
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const KEEP_DAYS = 120;

export function setupGuide(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, languageName, LS, Q, toast, setHeader, setNav, version, adhkar } = ctx;
  // stars: { unit: best first-try score }; done: { step: day marked }; last: the step opened last; lv: the day's level;
  // log: { "YYYY-MM-DD": { d: [item ids done], n: note } }.
  const state = Object.assign({ v: 1, stars: {}, done: {}, last: null, lv: 1, log: {} }, LS.get("guide", {}));
  const save = () => LS.set("guide", state);
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";
  const loading = () => `<div class="empty"><div class="spinner"></div><div>${esc(t("common.loading"))}</div></div>`;
  const failed = (err, retry) => {
    const offline = !navigator.onLine || err instanceof TypeError;
    view.innerHTML = `<div class="empty">${icon("download")}<div>${esc(t(offline ? "offline.needOnce" : "common.loadFailed"))}</div><br><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`;
    $("#retry").onclick = retry;
  };

  // ---------- data: the structure, and the words of the interface language over the English ones ----------
  let DATA = null, PACK = null, packLang = null, names = n => String(n);
  const json = url => fetch(url).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  async function load() {
    DATA ||= await json(`data/guide.json?v=${version}`);
    const lang = getLang();
    if (packLang !== lang) {
      const en = await json(`guide/en.json?v=${version}`);
      // A language whose file is missing or cannot be fetched now reads the English.
      const own = lang === "en" ? {} : await json(`guide/${lang}.json?v=${version}`).catch(() => ({}));
      PACK = { ...en, ...own }; packLang = lang; PACK.$own = lang === "en" || Object.keys(own).length > 0;
      // The Arabic phrases the lessons quote (as the English writes them in «»): Persian, Urdu and Pashto also
      // quote their own words in «», which must keep their own font and language.
      QUOTED = new Set(Object.values(en).flatMap(v => [...String(v).matchAll(/«([^»]*[ء-ي][^»]*)»/g)].map(m => m[1])));
    }
    names = await Q.surahNames().catch(() => names);
  }
  const tx = (k, p = {}) => String(PACK[k] ?? k).replace(/\{(\w+)\}/g, (m, x) => x in p ? (typeof p[x] === "number" ? num(p[x]) : String(p[x])) : m);
  const label = key => key.startsWith("@") ? tx(key.slice(1)) : t(key);

  // ---------- text ----------
  // Arabic words quoted in «» keep their own direction and font inside another language's sentence.
  let QUOTED = new Set();
  const unesc = s => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const rich = s => esc(s).replace(/«([^»]{1,300})»/g, (m, x) => !isAr() && QUOTED.has(unesc(x)) ? `<bdi class="g-ar" lang="ar" dir="rtl">«${x}»</bdi>` : m);
  const paras = s => s.split("\n").map(p => `<p>${rich(p)}</p>`).join("");
  const list = (s, ol) => `<${ol ? "ol" : "ul"} class="g-list">${s.split("\n").map(x => `<li>${rich(x)}</li>`).join("")}</${ol ? "ol" : "ul"}>`;
  const note = () => isAr() || getLang() === "en" ? "" : `<p class="info">${icon("translate")}<span>${esc(PACK.$own ? tx("ui.translated") : t("tajweed.inEnglish"))}</span></p>`;
  const sourceNote = () => `<p class="source-note">${esc(tx("ui.sourceNote"))}</p>`;
  const linksHtml = l => l?.length ? `<div class="g-links">${l.map(([href, key]) => `<a class="chip" href="${href}">${esc(label(key))} ${icon("back", "flip")}</a>`).join("")}</div>` : "";

  // ---------- evidence: verses, hadith and adhkar, each from its source ----------
  function evidenceHtml(ev) {
    if (!ev?.length) return "";
    return `<div class="g-evs"><div class="g-ev-h">${esc(tx("ui.evidence"))}</div>${ev.map(([kind, x]) => {
      if (kind === "q") {
        const v = DATA.verses[x]; if (!v) return "";
        const ref = v.from === v.to ? tx("ui.openVerse", { surah: names(v.s), n: v.from }) : tx("ui.openVerses", { surah: names(v.s), from: v.from, to: v.to });
        return `<div class="g-ev g-q"><p class="g-aya" lang="ar" dir="rtl">﴿${v.text.map((a, i) => `${esc(a)} <span class="g-n">${esc(num(v.from + i))}</span>`).join(" ")}﴾</p>
          ${v.text.map((a, i) => `<p class="g-tr" data-s="${v.s}" data-a="${v.from + i}" hidden></p>`).join("")}
          <a class="g-ref" href="#/quran/hafs/${v.s}${v.from > 1 ? "?a=" + v.from : ""}">${icon("quran")}<span>${esc(ref)}</span>${icon("back", "flip")}</a></div>`;
      }
      if (kind === "h") {
        const [book, n, sec] = DATA.hadith[x]; const nm = DATA.hbooks[book] || [book, book];
        return `<a class="g-ev g-h" href="#/hadith/${book}/${sec}?h=${n}">${icon("books")}<span>${esc(tx("ui.hadithIn", { book: nm[isAr() ? 0 : 1], n }))}</span>${icon("back", "flip")}</a>`;
      }
      if (kind === "d") {
        const d = adhkar.item(x); if (!d) return "";
        return `<div class="g-ev g-d" data-d="${x}"><div class="g-d-top"><p class="g-dhikr" lang="ar" dir="rtl">${adhkar.format(d.item.text)}</p>${d.item.audio ? `<button class="icon-btn g-play" data-audio="${esc(d.item.audio)}" aria-label="${esc(t("common.listen"))}">${icon("play")}</button>` : ""}</div>
          <div class="g-d-tr" hidden></div>
          <a class="g-ref" href="#/cat/${d.cat.id}?item=${x}">${icon("book")}<span>${esc(tx("ui.dhikr"))}${d.item.repeat > 1 ? sep() + esc(tx("ui.times", { n: d.item.repeat })) : ""}</span>${icon("back", "flip")}</a></div>`;
      }
      return "";
    }).join("")}</div>`;
  }
  // After the HTML is in the page: the «listen» buttons of the adhkar, their official English translation for readers
  // of other languages, and the meaning of each verse in the reader's chosen translation (QuranEnc), when online.
  function wire(root, hash) {
    root.querySelectorAll(".g-play").forEach(b => { b.onclick = () => adhkar.toggle(b.dataset.audio, b); });
    if (adhkar.showTr() && root.querySelector(".g-d")) adhkar.en().then(en => {
      if (stale(hash)) return;
      root.querySelectorAll(".g-d").forEach(el => {
        const x = en.items[el.dataset.d], box = el.querySelector(".g-d-tr"); if (!x?.t || !box) return;
        box.innerHTML = `${x.n ? `<p class="g-d-n" lang="ar-Latn" dir="ltr">${esc(x.n)}</p>` : ""}<p lang="en" dir="ltr">${esc(x.t)}</p>${getLang() === "en" ? "" : `<small>${esc(tx("ui.englishOnly"))}</small>`}`;
        box.hidden = false;
      });
    }).catch(() => {});
    const trs = [...root.querySelectorAll(".g-tr")]; let src = null;
    trs.forEach(el => Q.ayaMeaning(Number(el.dataset.s), Number(el.dataset.a)).then(m => {
      if (!m?.text || stale(hash) || !el.isConnected) return;
      el.textContent = m.text.replace(/\s*\[\d+\]/g, ""); el.dir = m.meta?.direction === "rtl" ? "rtl" : "ltr"; el.lang = m.meta?.language_iso_code || ""; el.hidden = false;
      if (!src && m.meta) { src = root.querySelector(".g-trsrc"); if (src) { src.textContent = t("quran.trSource", { title: m.meta.title, v: m.meta.version }); src.hidden = false; } }
    }).catch(() => {}));
  }
  const trSource = () => `<p class="source-note g-trsrc" hidden></p>`;

  // ---------- the reviewed books in the reader's language (IslamHouse.com) ----------
  // "20.02 MB" as the site gives it → one decimal, in the language's digits.
  const size = s => { const m = /^([\d.]+)\s*([A-Za-z]+)$/.exec(s || ""); return m ? sep() + esc(`${num(Math.round(parseFloat(m[1]) * 10) / 10)} ${m[2]}`) : ""; };
  function booksHtml(part) {
    const all = DATA.books?.[part] || {}, lang = getLang();
    const from = all[lang] ? lang : lang === "ms" && all.id ? "id" : all.en ? "en" : null; if (!from) return "";
    return `<h2 class="section-title">${esc(tx("ui.books"))}${from === lang ? "" : ` (${esc(languageName(from))})`}</h2>
      <div class="list">${all[from].map(b => `<a href="${esc(b.url)}" target="_blank" rel="noopener"><div class="num">${icon("book")}</div><div class="lbl" dir="auto">${esc(b.t)}<span class="sub">${esc(tx("ui.pdf"))}${size(b.size)}</span></div>${icon("download", "chev")}</a>`).join("")}</div>
      <p class="source-note">${esc(tx("ui.booksNote"))}</p>`;
  }

  // =====================================================================================================
  // ركن الأطفال
  // =====================================================================================================
  const unitIndex = id => DATA.kids.findIndex(u => u.id === id);
  const starsOf = u => Math.min(u.quiz, state.stars[u.id] || 0);
  const starRow = (n, total) => `<span class="g-stars" aria-label="${esc(tx("ui.stars", { n, total }))}">${Array.from({ length: total }, (_, i) => icon(i < n ? "star-f" : "star")).join("")}</span>`;

  async function renderKids() {
    setNav("more"); setHeader(t("kids.title"), { back: true }); const hash = location.hash; view.innerHTML = loading();
    try { await load(); } catch (e) { if (!stale(hash)) failed(e, renderKids); return; }
    if (stale(hash)) return;
    const got = DATA.kids.reduce((n, u) => n + starsOf(u), 0), total = DATA.kids.reduce((n, u) => n + u.quiz, 0);
    view.innerHTML = `
      <section class="hero g-hero kids"><h2>${esc(t("kids.title"))}</h2><p>${esc(tx("ui.kidsIntro"))}</p>
        <div class="g-total">${icon("star-f")}<b>${esc(tx("ui.stars", { n: got, total }))}</b></div></section>
      ${note()}
      <h2 class="section-title">${esc(tx("ui.units"))}</h2>
      <div class="g-units">${DATA.kids.map((u, i) => `<a class="g-unit c${i % 6}" href="#/kids/${u.id}"><div class="ic">${icon(u.icon)}</div>
        <div class="g-unit-t"><small>${esc(tx("ui.unitN", { n: i + 1 }))}</small><b>${esc(tx(`k.${u.id}.t`))}</b><span>${esc(tx(`k.${u.id}.s`))}</span></div>${starRow(starsOf(u), u.quiz)}</a>`).join("")}</div>
      <details class="g-details"><summary>${icon("people")}<span>${esc(tx("ui.parents"))}</span></summary><div class="g-text">${paras(tx("ui.parentsText"))}</div></details>
      ${booksHtml("kids")}
      ${sourceNote()}`;
  }

  async function renderUnit(id) {
    setNav("more"); setHeader(t("kids.title"), { back: true }); const hash = location.hash; view.innerHTML = loading();
    try { await load(); } catch (e) { if (!stale(hash)) failed(e, () => renderUnit(id)); return; }
    if (stale(hash)) return;
    const i = unitIndex(id); if (i < 0) { location.replace("#/kids"); return; }
    const u = DATA.kids[i], prev = DATA.kids[i - 1], next = DATA.kids[i + 1], k = `k.${u.id}`;
    const card = (c, n) => `<section class="g-card" data-c="${c.id}">
        <button class="g-q-row" aria-expanded="false"><span class="g-num">${esc(num(n + 1))}</span><h3>${rich(tx(`${k}.${c.id}.q`))}</h3>${icon("plus", "g-plus")}${icon("minus", "g-minus")}</button>
        <div class="g-answer" hidden>${paras(tx(`${k}.${c.id}.a`))}${c.l ? list(tx(`${k}.${c.id}.l`), c.ol) : ""}${evidenceHtml(c.ev)}${linksHtml(c.links)}</div>
      </section>`;
    view.innerHTML = `${note()}
      <div class="g-unit-head c${i % 6}"><div class="ic">${icon(u.icon)}</div><div><small>${esc(tx("ui.unitN", { n: i + 1 }))}${sep()}${esc(tx("ui.cardsCount", { n: u.cards.length }))}</small><h2>${esc(tx(`${k}.t`))}</h2><p>${esc(tx(`${k}.s`))}</p></div></div>
      <div class="more-row"><button class="btn ghost small" id="g-all">${esc(tx("ui.showAll"))}</button></div>
      ${u.cards.map(card).join("")}
      <section class="g-sec g-quiz" id="g-quiz"><h3>${icon("star-f")}<span>${esc(tx("ui.quiz"))}</span>${starRow(starsOf(u), u.quiz)}</h3>
        <div id="g-stage"><p>${esc(tx("ui.quizHint"))}</p><div class="more-row"><button class="btn" id="g-start">${icon("play")} ${esc(tx("ui.quizStart"))}</button></div></div></section>
      <div class="tj-nav g-nav">
        ${prev ? `<a class="btn ghost" href="#/kids/${prev.id}">${icon("back", "dir")} ${esc(tx(`k.${prev.id}.t`))}</a>` : `<a class="btn ghost" href="#/kids">${esc(tx("ui.allUnits"))}</a>`}
        ${next ? `<a class="btn ghost" href="#/kids/${next.id}">${esc(tx(`k.${next.id}.t`))} ${icon("back", "flip")}</a>` : `<a class="btn ghost" href="#/kids">${esc(tx("ui.allUnits"))}</a>`}
      </div>
      ${trSource()}${sourceNote()}`;
    wire(view, hash);
    // A question opens its answer on a tap, so the child answers first; one button opens or closes them all.
    const open = (sec, on) => { sec.querySelector(".g-answer").hidden = !on; sec.classList.toggle("open", on); sec.querySelector(".g-q-row").setAttribute("aria-expanded", on); };
    view.querySelectorAll(".g-card").forEach(sec => { sec.querySelector(".g-q-row").onclick = () => open(sec, !sec.classList.contains("open")); });
    let all = false;
    $("#g-all").onclick = e => { all = !all; view.querySelectorAll(".g-card").forEach(sec => open(sec, all)); e.currentTarget.textContent = tx(all ? "ui.hideAll" : "ui.showAll"); };

    // The quiz: one question at a time, its three answers in a new order each time; a star for each first-try answer.
    const stage = $("#g-stage"); let at = 0, score = 0, first = true;
    const shuffle = a => { for (let j = a.length - 1; j > 0; j--) { const r = Math.floor(Math.random() * (j + 1)); [a[j], a[r]] = [a[r], a[j]]; } return a; };
    const ask = () => {
      if (at >= u.quiz) {
        if (score > (state.stars[u.id] || 0)) { state.stars[u.id] = score; save(); }
        stage.innerHTML = `<div class="g-result">${starRow(score, u.quiz)}<b>${esc(tx("ui.quizDone"))}</b><span>${esc(tx("ui.quizScore", { n: score, total: u.quiz }))}</span></div>
          <div class="more-row g-row"><button class="btn ghost" id="g-again">${icon("reset")} ${esc(tx("ui.again"))}</button>${next ? `<a class="btn" href="#/kids/${next.id}">${esc(tx("ui.nextUnit"))} ${icon("back", "flip")}</a>` : `<a class="btn" href="#/kids">${esc(tx("ui.allUnits"))}</a>`}</div>`;
        $("#g-again").onclick = () => { at = 0; score = 0; ask(); };
        const head = $("#g-quiz h3 .g-stars"); if (head) head.outerHTML = starRow(starsOf(u), u.quiz);
        return;
      }
      first = true; const z = `${k}.z${at + 1}`;
      stage.innerHTML = `<div class="g-count">${esc(tx("ui.quizOf", { n: at + 1, total: u.quiz }))}</div><p class="g-zq">${rich(tx(`${z}.q`))}</p>
        <div class="g-opts">${shuffle([0, 1, 2]).map(o => `<button class="g-opt" data-o="${o}">${rich(tx(`${z}.${o}`))}</button>`).join("")}</div>
        <div class="g-fb" id="g-fb" aria-live="polite"></div>`;
      stage.querySelectorAll(".g-opt").forEach(b => { b.onclick = () => {
        const fb = $("#g-fb");
        if (b.dataset.o === "0") {
          if (first) score++;
          b.classList.add("right"); stage.querySelectorAll(".g-opt").forEach(x => { x.disabled = true; });
          fb.innerHTML = `<span class="ok">${icon("check")} ${esc(tx("ui.right"))}</span><button class="btn small" id="g-next">${esc(tx("ui.next"))} ${icon("back", "flip")}</button>`;
          $("#g-next").onclick = () => { at++; ask(); }; $("#g-next").focus();
        } else { first = false; b.classList.add("wrong"); b.disabled = true; fb.innerHTML = `<span class="no">${esc(tx("ui.wrong"))}</span>`; }
      }; });
    };
    $("#g-start").onclick = () => { at = 0; score = 0; ask(); $("#g-quiz").scrollIntoView({ block: "nearest" }); };
  }

  // =====================================================================================================
  // يوميات مسلم
  // =====================================================================================================
  const stepIndex = id => DATA.steps.findIndex(s => s.id === id);
  const isDone = id => !!state.done[id];
  const itemsOf = lv => DATA.day.flatMap(p => p.items.filter(i => i.lv <= lv).map(i => `${p.id}.${i.id}`));
  const entry = key => state.log[key] || { d: [], n: "" };
  const doneOf = (key, lv = state.lv) => { const d = new Set(entry(key).d); return itemsOf(lv).filter(x => d.has(x)).length; };
  // A day is kept when its essentials (level 1) were all done; the run of kept days ends today or yesterday.
  const kept = key => { const need = itemsOf(1); return need.length > 0 && doneOf(key, 1) === need.length; };
  const back = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  function streak() { let n = 0; for (let i = kept(dayKey()) ? 0 : 1; kept(dayKey(back(i))); i++) n++; return n; }
  function prune() { const min = dayKey(back(KEEP_DAYS)); for (const k of Object.keys(state.log)) if (k < min || (!state.log[k].d.length && !state.log[k].n)) delete state.log[k]; }

  async function renderMuslim() {
    setNav("more"); setHeader(t("muslim.title"), { back: true }); const hash = location.hash; view.innerHTML = loading();
    try { await load(); } catch (e) { if (!stale(hash)) failed(e, renderMuslim); return; }
    if (stale(hash)) return;
    const done = DATA.steps.filter(s => isDone(s.id)).length, total = DATA.steps.length, next = DATA.steps.find(s => !isDone(s.id));
    const dn = doneOf(dayKey()), dt = itemsOf(state.lv).length, run = streak();
    view.innerHTML = `
      <section class="hero g-hero"><small class="g-badge">${esc(tx("ui.forNew"))}</small><h2>${esc(t("muslim.title"))}</h2><p>${esc(tx("ui.muslimIntro"))}</p>
        <a class="now" href="#/muslim/day">${icon("journal")}<div><small>${esc(tx("ui.myDay"))}</small><b>${esc(tx("ui.dayProgress", { n: dn, total: dt }))}</b><div class="progress light"><div style="width:${dt ? Math.round(dn / dt * 100) : 0}%"></div></div></div>${run ? `<span class="pct">${esc(tx("ui.streak", { n: run }))}</span>` : icon("back", "chev")}</a></section>
      ${note()}
      <h2 class="section-title">${esc(tx("ui.steps"))}</h2>
      <div class="progress-row qd-progress"><div class="progress"><div style="width:${Math.round(done / total * 100)}%"></div></div><span>${esc(tx("ui.stepsDone", { n: done, total }))}</span></div>
      ${next ? `<div class="resume-row"><a class="resume main" href="#/muslim/step/${next.id}">${icon("play")}<div><b>${esc(tx(done ? "ui.continue" : "ui.start"))}</b><span>${esc(tx("ui.stepN", { n: stepIndex(next.id) + 1 }))}${sep()}${esc(tx(`m.${next.id}.t`))}</span></div></a></div>`
        : `<p class="info">${icon("check")}<span>${esc(tx("ui.allDone"))}</span></p>`}
      <div class="list g-steps">${DATA.steps.map((s, i) => `<a href="#/muslim/step/${s.id}" class="${isDone(s.id) ? "qd-done" : ""}"><div class="num">${isDone(s.id) ? icon("check") : esc(num(i + 1))}</div><div class="lbl">${esc(tx(`m.${s.id}.t`))}<span class="sub">${esc(tx(`m.${s.id}.s`))}</span></div>${icon("back", "chev")}</a>`).join("")}</div>
      ${booksHtml("muslim")}
      <h2 class="section-title">${esc(tx("ui.seeAlso"))}</h2>
      <div class="list"><a href="#/kids"><div class="num">${icon("kids")}</div><div class="lbl">${esc(t("kids.title"))}<span class="sub">${esc(tx("ui.kidsIntro"))}</span></div>${icon("back", "chev")}</a></div>
      ${sourceNote()}`;
  }

  async function renderStep(id) {
    setNav("more"); setHeader(t("muslim.title"), { back: true }); const hash = location.hash; view.innerHTML = loading();
    try { await load(); } catch (e) { if (!stale(hash)) failed(e, () => renderStep(id)); return; }
    if (stale(hash)) return;
    const i = stepIndex(id); if (i < 0) { location.replace("#/muslim"); return; }
    const s = DATA.steps[i], prev = DATA.steps[i - 1], next = DATA.steps[i + 1], k = `m.${s.id}`;
    state.last = id; save();
    const sec = x => `<section class="g-sec"><h3><span>${rich(tx(`${k}.${x.id}.h`))}</span></h3>
        ${x.p ? paras(tx(`${k}.${x.id}.p`)) : ""}${x.l ? list(tx(`${k}.${x.id}.l`), x.ol) : ""}${evidenceHtml(x.ev)}${linksHtml(x.links)}</section>`;
    const doneBtn = () => `${icon(isDone(id) ? "reset" : "check")} ${esc(tx(isDone(id) ? "ui.markUndone" : "ui.markDone"))}`;
    view.innerHTML = `${note()}
      <h2 class="tj-title g-title">${esc(tx("ui.stepN", { n: i + 1 }))}${sep()}${esc(tx(`${k}.t`))}</h2>
      <p class="g-sub">${esc(tx(`${k}.s`))}</p>
      ${s.secs.map(sec).join("")}
      <section class="g-sec g-todo"><h3>${icon("check")}<span>${esc(tx("ui.todo"))}</span></h3>${paras(tx(`${k}.todo`))}${linksHtml(s.links)}</section>
      <div class="qd-done-row"><button class="btn ${isDone(id) ? "ghost" : ""}" id="g-done">${doneBtn()}</button></div>
      <div class="tj-nav g-nav">
        ${prev ? `<a class="btn ghost" href="#/muslim/step/${prev.id}">${icon("back", "dir")} ${esc(tx(`m.${prev.id}.t`))}</a>` : `<a class="btn ghost" href="#/muslim">${esc(tx("ui.steps"))}</a>`}
        ${next ? `<a class="btn ghost" href="#/muslim/step/${next.id}">${esc(tx(`m.${next.id}.t`))} ${icon("back", "flip")}</a>` : `<a class="btn ghost" href="#/muslim/day">${esc(tx("ui.myDay"))} ${icon("back", "flip")}</a>`}
      </div>
      ${trSource()}${sourceNote()}`;
    wire(view, hash);
    $("#g-done").onclick = () => {
      const on = !isDone(id);
      if (on) state.done[id] = dayKey(); else delete state.done[id]; save();
      const b = $("#g-done"); b.innerHTML = doneBtn(); b.classList.toggle("ghost", on);
      if (on) toast(tx("ui.stepDone"));
    };
  }

  async function renderDay() {
    setNav("more"); const hash = location.hash; setHeader(t("muslim.title"), { back: true }); view.innerHTML = loading();
    try { await load(); } catch (e) { if (!stale(hash)) failed(e, renderDay); return; }
    if (stale(hash)) return;
    prune();
    const key = dayKey(), locale = isAr() ? "ar-EG" : getLang();
    const fmt = (d, o) => { try { return new Intl.DateTimeFormat(locale, o).format(d); } catch { return new Intl.DateTimeFormat("en", o).format(d); } };
    const draw = () => {
      const e = entry(key), set = new Set(e.d), lv = state.lv, need = itemsOf(lv), dn = need.filter(x => set.has(x)).length, run = streak();
      if (state.today?.k !== key || state.today.n !== dn || state.today.total !== need.length) { state.today = { k: key, n: dn, total: need.length }; save(); } // for the Home card
      const task = (p, i) => { const id = `${p.id}.${i.id}`, on = set.has(id);
        return `<div class="row g-task${on ? " done" : ""}"><button class="g-check" role="checkbox" aria-checked="${on}" data-i="${id}" aria-label="${esc(tx(`d.${id}.t`))}">${on ? icon("check") : ""}</button>
          <div class="lbl" data-i="${id}">${rich(tx(`d.${id}.t`))}${i.x ? `<span class="sub">${esc(tx(`d.${id}.x`))}</span>` : ""}</div>${i.href ? `<a class="icon-btn" href="${i.href}" aria-label="${esc(tx("ui.open"))}">${icon("back", "chev")}</a>` : ""}</div>`; };
      const week = Array.from({ length: 7 }, (_, n) => back(6 - n)).map(d => { const k2 = dayKey(d), pct = need.length ? Math.round(doneOf(k2) / need.length * 100) : 0;
        return `<div class="g-wd${k2 === key ? " on" : ""}${kept(k2) ? " kept" : ""}" title="${esc(fmt(d, { dateStyle: "medium" }))}"><div class="g-ring" style="--p:${pct}">${kept(k2) ? icon("check") : `<span>${esc(num(d.getDate()))}</span>`}</div><small>${esc(fmt(d, { weekday: "narrow" }))}</small></div>`; }).join("");
      view.innerHTML = `${note()}
        <div class="g-day-head"><div><small>${esc(tx("ui.today"))}</small><h2>${esc(fmt(new Date(), { weekday: "long", day: "numeric", month: "long" }))}</h2></div>${run ? `<span class="badge">${esc(tx("ui.streak", { n: run }))}</span>` : ""}</div>
        <p class="g-sub">${esc(tx("ui.dayHint"))}</p>
        <div class="g-level"><span>${esc(tx("ui.level"))}</span><div class="segmented" role="group">${[1, 2, 3].map(n => `<button data-lv="${n}" class="${n === lv ? "on" : ""}" aria-pressed="${n === lv}">${esc(tx("ui.level" + n))}</button>`).join("")}</div></div>
        <div class="progress-row qd-progress"><div class="progress"><div style="width:${need.length ? Math.round(dn / need.length * 100) : 0}%"></div></div><span>${esc(tx("ui.dayProgress", { n: dn, total: need.length }))}</span></div>
        ${dn === need.length && need.length ? `<p class="info">${icon("check")}<span>${esc(tx("ui.dayComplete"))}</span></p>` : ""}
        ${DATA.day.map(p => { const items = p.items.filter(i => i.lv <= lv); return items.length ? `<h2 class="section-title g-period">${icon(p.icon)}<span>${esc(tx(`d.${p.id}.t`))}</span></h2><div class="list g-tasks">${items.map(i => task(p, i)).join("")}</div>` : ""; }).join("")}
        ${lv < 3 ? `<p class="source-note">${esc(tx("ui.levelNote"))}</p>` : ""}
        <h2 class="section-title">${esc(tx("ui.week"))}</h2>
        <div class="g-week">${week}</div>
        <h2 class="section-title">${esc(tx("ui.note"))}</h2>
        <textarea class="g-note" id="g-note" rows="3" maxlength="600" dir="auto" placeholder="${esc(tx("ui.notePlaceholder"))}">${esc(e.n || "")}</textarea>
        <p class="source-note">${esc(tx("ui.noteSaved"))}</p>
        <div class="tj-nav g-nav"><a class="btn ghost" href="#/muslim">${icon("back", "dir")} ${esc(tx("ui.steps"))}</a><a class="btn ghost" href="#/prayer">${esc(t("prayer.title"))} ${icon("back", "flip")}</a></div>`;
      view.querySelectorAll(".g-task [data-i]").forEach(el => { el.onclick = () => {
        const id = el.dataset.i, e2 = entry(key), at = e2.d.indexOf(id), y = view.scrollTop, wy = window.scrollY;
        if (at < 0) e2.d.push(id); else e2.d.splice(at, 1);
        state.log[key] = e2; save(); draw(); view.scrollTop = y; window.scrollTo(0, wy);
      }; });
      view.querySelectorAll("[data-lv]").forEach(b => { b.onclick = () => { state.lv = Number(b.dataset.lv); save(); draw(); }; });
      const ta = $("#g-note"); let timer;
      ta.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { const e2 = entry(key); e2.n = ta.value.slice(0, 600); state.log[key] = e2; save(); }, 400); };
      ta.onblur = () => { clearTimeout(timer); const e2 = entry(key); if ((e2.n || "") !== ta.value) { e2.n = ta.value.slice(0, 600); state.log[key] = e2; save(); } };
    };
    draw();
  }

  return {
    kids(parts) { return parts[0] ? renderUnit(parts[0]) : renderKids(); },
    muslim(parts) {
      if (parts[0] === "day") return renderDay();
      if (parts[0] === "step" && parts[1]) return renderStep(parts[1]);
      return renderMuslim();
    },
    // Home: today's routine, once the reader has used «My day» (what the day page last counted: done and wanted).
    hubCard() {
      const d = state.today; if (!d?.total) return "";
      const pct = d.k === dayKey() ? Math.round(d.n / d.total * 100) : 0;
      return `<a class="now" href="#/muslim/day">${icon("journal")}<div><small>${esc(t("muslim.title"))}</small><b>${esc(t("common.percent", { n: pct }))}</b><div class="progress light"><div style="width:${pct}%"></div></div></div>${icon("back", "chev")}</a>`;
    },
  };
}
