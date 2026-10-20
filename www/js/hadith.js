/* ===== كتب الحديث: الكتب الستة والأربعون النووية والقدسية ===== */
// Texts: fawazahmed0/hadith-api (Unlicense), loaded per section from a pinned, immutable jsDelivr release.
// Arabic book and section titles: AhmedBaset/hadith-json. Built by scripts/build-hadith-index.js.
import * as off from "./offline.js?v=1.21.0";

const HADITH_STORE = off.STORES.HADITH;

// Grader names in Arabic (shown with the Arabic interface).
const GRADER_AR = {
  "Al-Albani": "الألباني", "Shuaib Al Arnaut": "شعيب الأرناؤوط", "Zubair Ali Zai": "زبير علي زئي",
  "Muhammad Muhyi Al-Din Abdul Hamid": "محمد محيي الدين عبد الحميد", "Ahmad Muhammad Shakir": "أحمد محمد شاكر",
  "Bashar Awad Maarouf": "بشار عواد معروف", "Muhammad Fouad Abd al-Baqi": "محمد فؤاد عبد الباقي", "Abu Ghuddah": "عبد الفتاح أبو غدة",
};
// The grading labels used in the data are English transliterations; these cover about 97% of all gradings.
// Anything else (free-text notes) is shown as written.
const GRADE_AR = {
  "Sahih": "صحيح", "Hasan": "حسن", "Daif": "ضعيف", "Hasan Sahih": "حسن صحيح", "Very Daif": "ضعيف جدًا",
  "Sahih - Agreed Upon": "صحيح، متفق عليه", "Sahih - Bukhari And Muslim": "صحيح، رواه البخاري ومسلم",
  "Sahih Bukhari": "صحيح، رواه البخاري", "Sahih Muslim": "صحيح، رواه مسلم",
  "Isnaad Sahih": "إسناده صحيح", "Sahih Isnaad": "إسناده صحيح", "Isnaad Hasan": "إسناده حسن", "Hasan Isnaad": "إسناده حسن",
  "Daif Isnaad": "إسناده ضعيف", "Sanad Daif": "إسناده ضعيف", "Very Daif Isnaad": "إسناده ضعيف جدًا", "Hasan Sahih Isnaad": "إسناده حسن صحيح",
  "Sahih Lighairihi": "صحيح لغيره", "Hasan Lighairihi": "حسن لغيره",
  "Shadh": "شاذ", "Munkar": "منكر", "Mawdu": "موضوع", "Batil": "باطل", "Mursal": "مرسل", "Maqtu": "مقطوع",
  "Sahih Muquf": "صحيح موقوف", "Sahih Mauquf": "صحيح موقوف", "Sahih Maqtu": "صحيح مقطوع", "Sahih Hadith": "حديث صحيح",
  "Sahih Isnaad Maqtu": "صحيح الإسناد مقطوع", "Sahih Isnaad Mauquf": "صحيح الإسناد موقوف", "Sahih Isnaad Mursal": "صحيح الإسناد مرسل",
  "Daif Isnaad Maqtu": "ضعيف الإسناد مقطوع", "Daif Maqtu": "ضعيف مقطوع", "Daif Muquf": "ضعيف موقوف", "Hasan Maqtu": "حسن مقطوع",
  "Daif Munkar": "ضعيف منكر", "Munkar Daif": "منكر ضعيف", "Sahih Mutawatir": "صحيح متواتر", "Sahih Matn": "صحيح المتن",
  "Isnaad Sahih Agreed Upon": "إسناده صحيح، متفق عليه", "Mauquf": "موقوف", "Isnaad Malool": "إسناده معلول",
};
// Badge colour: green for sahih/hasan, red for weak, neutral for the rest (mursal, mawquf, notes).
const WEAK = /da'?if|munkar|shadh|mawdu|maudu|batil|malool/i;
const NOT_MARFU = /mursal|maqtu|mauquf|muquf/i;
const tone = grade => WEAK.test(grade) ? "danger" : NOT_MARFU.test(grade) ? "" : /^(isnaad |hasan|sahih)/i.test(grade.trim()) ? "good" : "";

export function setupHadith(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, setHeader, setNav, LS, copyText, share, SITE, player } = ctx;
  const showText = s => ctx.tashkeel() ? s : ctx.stripTashkeel(s);
  const state = Object.assign({ last: null, tr: true }, LS.get("hadith", {}));
  const save = () => LS.set("hadith", state);
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";

  // ---------- data ----------
  let IX = null;
  async function loadIndex() { if (!IX) { const r = await fetch("hadith/index.json"); if (!r.ok) throw new Error("HTTP " + r.status); IX = await r.json(); } return IX; }
  const book = id => IX.books.find(b => b.id === id);
  const bookTitle = b => isAr() ? b.ar : b.en;
  const secTitle = s => isAr() ? s[1] : s[2];
  const secUrl = (edition, n) => `${IX.source.cdn}/${edition}/sections/${n}.min.json`;
  const hadithUrl = (edition, n) => `${IX.source.cdn}/${edition}/${n}.min.json`;
  const searchUrl = b => `${IX.source.cdn}/ara-${b.id}1.min.json`;
  const memo = new Map();
  function getJSON(url) {
    if (!memo.has(url)) {
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 20000);
      memo.set(url, fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer)).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch(e => { memo.delete(url); throw e; }));
    }
    return memo.get(url);
  }
  // Hadith radios (data/radios.json → sunnah): mp3quran.net streams named after a book in the index, or by their own string.
  let RADIOS = null;
  const loadRadios = async () => RADIOS || (RADIOS = await fetch("data/radios.json").then(r => r.ok ? r.json() : null).then(j => j?.sunnah || null).catch(() => null)) || [];
  const radioName = r => book(r.id) ? bookTitle(book(r.id)) : t("hadith.radio." + r.id);
  const playRadio = r => player.radio({ id: "sunnah:" + r.id, url: r.url, name: radioName(r), sub: t("radio.mp3quran") });
  const loading = (msg = t("common.loading")) => `<div class="empty"><div class="spinner"></div><div>${esc(msg)}</div></div>`;
  const failed = (err, retry) => {
    const offline = !navigator.onLine || err instanceof TypeError || err?.name === "AbortError";
    view.innerHTML = `<div class="empty">${icon("download")}<div>${esc(t(offline ? "offline.needOnce" : "common.loadFailed"))}</div><br><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`;
    $("#retry").onclick = retry;
  };

  // ---------- gradings ----------
  const gradeLabel = g => isAr() ? gradeAr(g.grade) : g.grade.trim();
  // Zubair Ali Zai often grades by pointing to the two Sahihs, e.g. "Isnaad Sahih Sahih Bukhari (415) Sahih Muslim (552)".
  function gradeAr(raw) {
    const s = raw.trim(); if (GRADE_AR[s]) return GRADE_AR[s];
    const refs = [];
    const rest = s.replace(/Sahih (Bukhari|Muslim)(?: \(([^)]*)\))?/g, (_, who, n) => {
      const name = who === "Bukhari" ? "البخاري" : "مسلم";
      refs.push(n ? `${name} (${n.replace(/\s*After\s*/g, " بعد ").replace(/\s*Mukhtasar/g, " مختصرًا").replace(/,/g, "،").replace(/\d+/g, d => num(Number(d)))})` : name);
      return " ";
    }).trim();
    if (!refs.length) return s;
    const head = rest ? GRADE_AR[rest] : "صحيح";
    return head ? `${head}، رواه ${refs.join(" و")}` : s;
  }
  const graderLabel = name => isAr() ? (GRADER_AR[name.trim()] || name) : name;
  const gradesOf = h => (h.grades || []).filter(g => g.grade && g.grade.trim() !== "-");
  const primaryGrade = h => gradesOf(h).find(g => g.name.trim() === "Al-Albani") || gradesOf(h)[0];
  // Standard number; a part after the dot marks one narration of a numbered hadith: Muslim "8.01" and Bukhari 402.2 show as 8 (1) and 402 (2).
  const hadithNo = h => { const [i, f] = String(h.arabicnumber ?? h.hadithnumber).split("."); return Number(f) ? `${num(Number(i))} (${num(Number(f))})` : num(Number(i)); };

  // ---------- books ----------
  async function renderBooks() {
    setNav("hadith"); setHeader(t("hadith.books"), { actions: `<a class="icon-btn" href="#/offline" aria-label="${esc(t("offline.title"))}">${icon("download")}</a>` });
    const hash = location.hash; view.innerHTML = loading();
    let radios;
    try { [, radios] = await Promise.all([loadIndex(), loadRadios()]); } catch (e) { return stale(hash) || failed(e, renderBooks); }
    if (stale(hash)) return;
    const last = state.last && book(state.last.b);
    view.innerHTML = `
      ${last ? `<div class="resume-row"><a class="resume" href="#/hadith/${last.id}/${state.last.s}?h=${state.last.h}">${icon("books")}<div><b>${esc(t("quran.continue"))}</b><span>${esc(t("hadith.position", { book: bookTitle(last), section: secTitle(last.sections.find(s => s[0] === state.last.s) || ["", "", ""]), n: hadithNo({ arabicnumber: state.last.a ?? state.last.h }) }))}</span></div></a></div>` : ""}
      ${radios.length ? `<section class="hadith-radios" id="hradios"><div class="hr-head">${icon("radio")}<div><b>${esc(t("hadith.radios"))}</b><span>${esc(t("hadith.radioNote"))}</span></div></div>
        <div class="chips">${radios.map(r => `<button class="chip" data-radio="${esc(r.id)}" data-playing="radio:sunnah:${esc(r.id)}" aria-label="${esc(t("hadith.listenRadio", { book: radioName(r) }))}">${icon("play")}<span>${esc(radioName(r))}</span></button>`).join("")}</div></section>` : ""}
      <div class="list">${IX.books.map(b => `<a href="#/hadith/${b.id}"><div class="num">${icon("books")}</div><div class="lbl">${esc(bookTitle(b))}<span class="sub">${[isAr() ? b.author : b.ar, t("count.hadith", { n: b.count })].filter(Boolean).map(esc).join(sep())}${b.sahih ? `${sep()}${esc(t("hadith.sahihBook"))}` : ""}</span></div>${icon("back", "chev")}</a>`).join("")}</div>
      <p class="source-note">${esc(t("hadith.source"))}</p>`;
    $("#hradios")?.addEventListener("click", e => { const r = radios.find(x => x.id === e.target.closest("[data-radio]")?.dataset.radio); if (r) playRadio(r); });
    player.refresh();
  }

  // ---------- one book: its sections and search ----------
  const queries = {}; const searchText = new Map(); // book id -> normalized texts, built on the first search
  async function renderBook(id) {
    setNav("hadith"); const hash = location.hash;
    setHeader(t("hadith.books"), { back: true }); view.innerHTML = loading();
    let radios;
    try { [, radios] = await Promise.all([loadIndex(), loadRadios()]); } catch (e) { return stale(hash) || failed(e, () => renderBook(id)); }
    if (stale(hash)) return;
    const b = book(id); if (!b) { location.hash = "#/hadith"; return; }
    setHeader(bookTitle(b), { back: true });
    const single = b.sections.length === 1;
    if (single) { location.replace(`#/hadith/${b.id}/${b.sections[0][0]}`); return; }
    const radio = radios.find(r => r.id === b.id);
    view.innerHTML = `
      <p class="riwayah-note">${(isAr() ? b.author : b.ar) ? esc(isAr() ? b.author : b.ar) + sep() : ""}${esc(t("count.books", { n: b.sections.length }))}${sep()}${esc(t("count.hadith", { n: b.count }))}</p>
      ${radio ? `<div class="list"><button class="row" id="hradio" data-playing="radio:sunnah:${esc(radio.id)}"><div class="num">${icon("radio")}</div><div class="lbl">${esc(t("hadith.listenRadio", { book: bookTitle(b) }))}<span class="sub">${esc(t("hadith.radioNote"))}</span></div>${icon("play", "chev-play")}</button></div>` : ""}
      <div class="searchbox">${icon("search")}<input id="hq" type="search" placeholder="${esc(t("hadith.search", { book: bookTitle(b) }))}" value="${esc(queries[id] || "")}" autocomplete="off" enterkeyhint="search"></div>
      <div id="hlist"></div>`;
    const sectionsHtml = () => `<div class="list">${b.sections.map(s => `<a href="#/hadith/${b.id}/${s[0]}"><div class="num">${num(s[0])}</div><div class="lbl">${esc(secTitle(s))}<span class="sub">${esc(t("count.hadith", { n: s[5] }))}</span></div>${icon("back", "chev")}</a>`).join("")}</div>`;
    const box = $("#hlist"); const input = $("#hq"); let timer, seq = 0;
    const run = async () => {
      const q = (queries[id] = input.value).trim(); const k = normalize(q);
      if (k.length < 2 && !/^\d+$/.test(k)) { box.innerHTML = sectionsHtml(); return; }
      const mine = ++seq; box.innerHTML = loading(t("hadith.loadingSearch"));
      let data; try { data = await getJSON(searchUrl(b)); } catch { if (mine === seq) box.innerHTML = `<div class="empty">${esc(t("offline.needOnce"))}</div>`; return; }
      if (mine !== seq || stale(hash)) return;
      const terms = k.split(" ").filter(Boolean);
      if (!searchText.has(b.id)) searchText.set(b.id, data.hadiths.map(h => normalize(h.text)));
      const texts = searchText.get(b.id);
      const hits = [];
      // A number finds the hadith with that number (in Muslim, all narrations under it: 8 finds 8.01 to 8.05).
      const asNumber = /^\d+$/.test(k) ? Number(k) : null;
      for (let i = 0; i < texts.length && hits.length < 100; i++) {
        const h = data.hadiths[i]; if (!texts[i]) continue;
        if (asNumber != null ? Number(String(h.arabicnumber ?? h.hadithnumber).split(".")[0]) === asNumber : terms.every(x => texts[i].includes(x))) hits.push(h);
      }
      if (!hits.length) { box.innerHTML = `<div class="empty">${esc(t("hadith.noMatches"))}</div>`; return; }
      box.innerHTML = `<h2 class="section-title">${esc(hits.length >= 100 ? t("hadith.manyResults", { n: 100 }) : t("count.hadith", { n: hits.length }))}</h2><div class="list">${hits.map(h => { const s = secOf(b, h); return `<a href="#/hadith/${b.id}/${s[0]}?h=${h.hadithnumber}"><div class="num">${hadithNo(h)}</div><div class="lbl"><span class="hit-text hadith-snippet" lang="ar" dir="rtl">${esc(snippet(h.text, terms))}</span><span class="sub">${esc(secTitle(s))}</span></div></a>`; }).join("")}</div>`;
    };
    input.oninput = () => { clearTimeout(timer); timer = setTimeout(run, 300); };
    run();
    if (radio) { $("#hradio").onclick = () => playRadio(radio); player.refresh(); }
  }
  // The section a hadith is read in: its reference, or for hadith without one, the section it was attached to (see build-hadith-index.js).
  const secOf = (b, h) => b.sections.find(s => s[0] === h.reference?.book) || b.sections.find(s => s[6]?.includes(h.hadithnumber))
    || b.sections.find(s => h.hadithnumber >= s[3] && h.hadithnumber <= s[4]) || b.sections[0];
  // Search ignores diacritics and letter forms (the search file has no diacritics already). Eastern Arabic digits count as digits.
  const normalize = s => String(s).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x6F0).normalize("NFD").replace(/\p{M}/gu, "").replace(/ـ/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().toLowerCase();
  function snippet(text, terms) {
    const plain = String(text).replace(/\s+/g, " "); const n = normalize(plain); const at = Math.max(0, n.indexOf(terms[0]) - 60);
    return (at > 0 ? "… " : "") + plain.slice(at, at + 200) + (plain.length > at + 200 ? " …" : "");
  }

  // ---------- one section: the hadith themselves ----------
  let observer = null;
  async function renderSection(id, n, params) {
    setNav("hadith"); const hash = location.hash;
    setHeader(t("hadith.books"), { back: true }); view.innerHTML = loading();
    try { await loadIndex(); } catch (e) { return stale(hash) || failed(e, () => renderSection(id, n, params)); }
    if (stale(hash)) return;
    const b = book(id); const sec = b && b.sections.find(s => s[0] === n);
    if (!sec) { location.hash = b ? `#/hadith/${id}` : "#/hadith"; return; }
    setHeader(b.sections.length === 1 ? bookTitle(b) : secTitle(sec), { back: true, actions: `${b.langs[getLang()] ? `<button class="icon-btn ${state.tr ? "active" : ""}" id="h-tr" aria-label="${esc(t("hadith.showTr"))}">${icon("translate")}</button>` : ""}` });
    const trEd = state.tr && b.langs[getLang()];
    // The section file, plus the hadith attached to this section from their own files (sec[6]).
    const load = ed => Promise.all([getJSON(secUrl(ed, n)), ...(sec[6] || []).map(x => getJSON(hadithUrl(ed, x)).catch(() => null))]).then(rs => rs.filter(Boolean).flatMap(r => r.hadiths));
    let ara, tr = [];
    try { [ara, tr] = await Promise.all([load(`ara-${b.id}`), trEd ? load(trEd).catch(() => []) : []]); }
    catch (e) { return stale(hash) || failed(e, () => renderSection(id, n, params)); }
    if (stale(hash)) return;
    const hasText = h => String(h.text || "").trim();
    const trBy = new Map(tr.filter(hasText).map(h => [h.hadithnumber, h.text]));
    const trDir = ["ur"].includes(getLang()) ? "rtl" : "ltr";
    const list = ara.filter(hasText).sort((x, y) => x.hadithnumber - y.hadithnumber);
    const card = h => {
      const pg = primaryGrade(h); const others = gradesOf(h);
      const trText = trBy.get(h.hadithnumber);
      return `<article class="hadith" id="h-${h.hadithnumber}" data-h="${h.hadithnumber}">
        <div class="hadith-head"><span class="pill">${esc(t("hadith.number", { n: hadithNo(h) }))}</span>
          ${b.sahih ? `<span class="badge good">${esc(t("hadith.sahihShort"))}</span>` : pg ? `<span class="badge ${tone(pg.grade)}">${esc(gradeLabel(pg))}${others.length ? ` <small>(${esc(graderLabel(pg.name))})</small>` : ""}</span>` : ""}</div>
        <div class="hadith-text" lang="ar" dir="rtl">${esc(showText(String(h.text).trim()))}</div>
        ${trText ? `<div class="hadith-tr" dir="${trDir}" lang="${getLang()}">${esc(trText)}</div>` : ""}
        ${others.length > 1 ? `<details class="grades"><summary>${esc(t("hadith.gradings"))}</summary><ul>${others.map(g => `<li><b>${esc(graderLabel(g.name))}:</b> <span class="${tone(g.grade) === "danger" ? "weak" : ""}">${esc(gradeLabel(g))}</span></li>`).join("")}</ul><p class="grades-note">${esc(t("hadith.gradesNote"))}</p></details>` : ""}
        <div class="dhikr-bar"><span class="spacer"></span>
          <button class="icon-btn" data-act="copy" aria-label="${esc(t("common.copy"))}">${icon("copy")}</button>
          <button class="icon-btn" data-act="share" aria-label="${esc(t("common.share"))}">${icon("share")}</button></div>
      </article>`;
    };
    // Long sections (some have 400+ hadith) are drawn in chunks as the reader scrolls.
    const want = Number(params.get("h"));
    const wantIdx = want ? Math.max(0, list.findIndex(h => h.hadithnumber === want)) : 0;
    let shown = Math.max(40, wantIdx + 20);
    view.innerHTML = `
      ${b.sections.length > 1 ? `<p class="riwayah-note">${esc(bookTitle(b))}${sep()}${esc(t("count.hadith", { n: list.length }))}</p>` : ""}
      ${b.graded ? `<p class="grades-notice">${icon("book")}<span>${esc(t("hadith.gradesNote"))}</span></p>` : ""}
      <div id="hcards">${list.slice(0, shown).map(card).join("")}</div>
      <div id="hmore"></div>
      <nav class="reader-nav">${prevNext(b, n)}</nav>
      <p class="source-note">${esc(t("hadith.source"))}${trBy.size ? `<br>${esc(t("hadith.trSource"))}` : ""}</p>`;
    const cards = $("#hcards"); const more = $("#hmore");
    const appendMore = () => { if (shown >= list.length) { more.innerHTML = ""; return; } const next = list.slice(shown, shown + 40); shown += next.length; cards.insertAdjacentHTML("beforeend", next.map(card).join("")); watch(); if (shown >= list.length) more.innerHTML = ""; };
    if (shown < list.length) {
      more.innerHTML = `<button class="btn ghost block" id="hmore-btn">${esc(t("hadith.showMore"))}</button>`;
      $("#hmore-btn").onclick = appendMore;
      new IntersectionObserver((es, o) => { if (stale(hash)) return o.disconnect(); if (es.some(e => e.isIntersecting)) appendMore(); }, { rootMargin: "600px" }).observe(more);
    }
    const ref = h => t("hadith.ref", { book: bookTitle(b), n: hadithNo(h) });
    const plain = h => { const pg = primaryGrade(h); return `${String(h.text).trim()}\n\n(${ref(h)}${b.sahih ? "" : pg ? `${sep()}${graderLabel(pg.name)}: ${gradeLabel(pg)}` : ""})` + (trBy.get(h.hadithnumber) ? `\n\n${trBy.get(h.hadithnumber)}` : ""); };
    cards.addEventListener("click", e => {
      const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
      const h = list.find(x => x.hadithnumber === Number(e.target.closest("[data-h]").dataset.h));
      if (act === "copy") copyText(plain(h));
      if (act === "share") share(bookTitle(b), `${plain(h)}\n${SITE}#/hadith/${id}/${n}?h=${h.hadithnumber}`); // opens this hadith in the app
    });
    const trBtn = $("#h-tr"); if (trBtn) trBtn.onclick = () => { state.tr = !state.tr; save(); renderSection(id, n, params); };
    // Remember the reading position.
    observer?.disconnect();
    let saveTimer;
    observer = new IntersectionObserver(es => {
      const vis = es.filter(x => x.isIntersecting).map(x => Number(x.target.dataset.h)); if (!vis.length) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { if (stale(hash)) return; const h = list.find(x => x.hadithnumber === Math.min(...vis)); state.last = { b: b.id, s: n, h: h.hadithnumber, a: h.arabicnumber ?? h.hadithnumber }; save(); }, 700);
    }, { rootMargin: "-80px 0px -60% 0px" });
    function watch() { cards.querySelectorAll(".hadith:not([data-w])").forEach(c => { c.dataset.w = 1; observer.observe(c); }); }
    watch();
    // Go to the requested hadith now, and again once the Arabic font has loaded (it changes the height of the cards above).
    const target = want && document.getElementById("h-" + want);
    if (target) {
      const go = () => { if (!stale(hash)) target.scrollIntoView({ block: "start" }); };
      go(); document.fonts?.ready.then(go);
      target.classList.add("flash"); setTimeout(() => target.classList.remove("flash"), 1800);
    }
  }
  function prevNext(b, n) {
    const i = b.sections.findIndex(s => s[0] === n); const p = b.sections[i - 1], q = b.sections[i + 1];
    return `${p ? `<a class="btn ghost" href="#/hadith/${b.id}/${p[0]}">${icon("back", "dir")} ${esc(secTitle(p))}</a>` : "<span></span>"}${q ? `<a class="btn ghost" href="#/hadith/${b.id}/${q[0]}">${esc(secTitle(q))} ${icon("back", "flip")}</a>` : "<span></span>"}`;
  }

  // ---------- offline ----------
  // The book is saved with the translation the reader sees (when translations are shown and one exists for the interface language).
  const trOf = b => state.tr && b.langs[getLang()] ? getLang() : null;
  const editionUrls = (b, ed) => [...b.sections.map(s => secUrl(ed, s[0])), ...b.sections.flatMap(s => (s[6] || []).map(x => hadithUrl(ed, x)))];
  const bookUrls = b => [...editionUrls(b, `ara-${b.id}`), searchUrl(b), ...(trOf(b) ? editionUrls(b, b.langs[trOf(b)]) : [])];
  const bookBytes = b => b.bytes + (trOf(b) ? b.trBytes?.[trOf(b)] || 0 : 0);
  async function offlineRows(fmt, part, row) {
    await loadIndex();
    const rows = await Promise.all(IX.books.map(async b => { const urls = bookUrls(b); const saved = await off.savedSet(HADITH_STORE, urls); return row(bookTitle(b), esc(t("offline.progress", { done: saved.size, total: urls.length })) + `${sep()}${esc(t("offline.size", { size: fmt(bookBytes(b)) }))}`, "hadith:" + b.id, part(saved.size, urls.length)); }));
    return rows.join("");
  }
  const offlineTarget = id => { const b = book(id); return b ? [HADITH_STORE, bookUrls(b)] : null; };

  return {
    render(parts, params) {
      if (!parts.length) return renderBooks();
      if (parts.length === 1) return renderBook(parts[0]);
      return renderSection(parts[0], Number(parts[1]), params);
    },
    offlineRows, offlineTarget, loadIndex, store: HADITH_STORE,
  };
}
