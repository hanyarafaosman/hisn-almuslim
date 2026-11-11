/* ===== العربية لغير الناطقين بها: كلمات القرآن الأكثر ورودًا، والفاتحة وقصار السور كلمة كلمة ===== */
// data/arabic.json (scripts/build-arabic.js) lists the 500 words that come most often in the Quran, in lessons of 20;
// arabic/core.<hash>.json holds the Arabic of the example verses and of al-Fatiha and surahs 78–114, and
// arabic/<lang>.<hash>.json the meanings in one of Quran.com's eight word-by-word languages (others read English).
// Every word can be heard in its recitation (audio.qurancdn.com/wbw). Practice asks a word's meaning, which word was
// heard, or which word has a meaning; what the learner knows comes back for review after 1, 2, 4… days (LS "arabic").
import { makeClipPlayer } from "./clip.js?v=1.39.0";

const ARABIC_CACHE = "hisn-arabic-v1";
const AUDIO = "https://audio.qurancdn.com/wbw/";
const GAPS = [1, 2, 4, 8, 16, 32]; // days until a word comes back, by its box (0: not known yet)
const RTL = new Set(["ur", "fa"]);

export function setupArabic(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, languageName, LS, Q, toast, setHeader, setNav } = ctx;
  // ml: the language of the meanings ("" = the interface language when it has them); cards: { form: [box, due day] };
  // done: { lesson: day its practice was finished }; last: the lesson opened last.
  const state = Object.assign({ v: 1, ml: "", cards: {}, done: {}, last: 0 }, LS.get("arabic", {}));
  const save = () => LS.set("arabic", state);
  const stale = hash => location.hash !== hash;
  const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
  const pct = x => t("common.percent", { n: Math.round(x * 10) / 10 });
  const loading = () => `<div class="empty"><div class="spinner"></div><div>${esc(t("common.loading"))}</div></div>`;
  const failed = (err, retry) => {
    const offline = !navigator.onLine || err instanceof TypeError;
    view.innerHTML = `<div class="empty">${icon("download")}<div>${esc(t(offline ? "offline.needOnce" : "common.loadFailed"))}</div><br><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`;
    $("#retry").onclick = retry;
  };

  // ---------- data ----------
  let IX = null; const files = {};
  async function loadIndex() { if (!IX) { const r = await fetch("data/arabic.json"); if (!r.ok) throw new Error("HTTP " + r.status); IX = await r.json(); prune(); } return IX; }
  function file(name) {
    files[name] ||= fetch("arabic/" + IX.files[name]).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch(e => { delete files[name]; throw e; });
    return files[name];
  }
  // Copies of files a newer build replaced (their names change with their content).
  function prune() {
    if (!("caches" in window)) return;
    caches.open(ARABIC_CACHE).then(async c => {
      const keep = Object.values(IX.files).map(f => "/arabic/" + f);
      for (const r of await c.keys()) { const p = new URL(r.url).pathname; if (!keep.some(f => p.endsWith(f))) await c.delete(r); }
    }).catch(() => {});
  }
  const ml = () => IX.langs.includes(state.ml) ? state.ml : IX.langs.includes(getLang()) ? getLang() : "en";
  let names = n => String(n);
  async function load(core = false) {
    await loadIndex();
    const [M, C, nm] = await Promise.all([file(ml()), core ? file("core") : null, Q.surahNames()]);
    names = nm; return { M, C };
  }
  const lessons = () => Math.ceil(IX.words.length / IX.lesson);
  const lessonOf = i => Math.floor(i / IX.lesson) + 1;
  const range = n => { const from = (n - 1) * IX.lesson; return Array.from({ length: Math.min(IX.lesson, IX.words.length - from) }, (_, i) => from + i); };

  // ---------- what the learner knows ----------
  const box = i => state.cards[IX.words[i][0]]?.[0] ?? -1; // -1: never practised
  const knownList = () => IX.words.map((w, i) => i).filter(i => box(i) >= 1);
  const dueList = () => IX.words.map((w, i) => i).filter(i => { const c = state.cards[IX.words[i][0]]; return c && c[1] <= today(); })
    .sort((a, b) => state.cards[IX.words[a][0]][1] - state.cards[IX.words[b][0]][1] || a - b);
  const knownShare = () => knownList().reduce((s, i) => s + IX.words[i][2], 0) / IX.total * 100;
  // A first answer moves a word up a box (when it is due, or new) or back to the first box.
  function grade(i, ok) {
    const k = IX.words[i][0], c = state.cards[k];
    if (ok && c && c[1] > today()) return;
    const b = ok ? Math.min((c ? c[0] : 0) + 1, GAPS.length - 1) : 0;
    state.cards[k] = [b, today() + GAPS[b]]; save();
  }

  // ---------- meanings ----------
  // A word's meanings are strings in the learner's language, or [[English ones]] when that language has none for it.
  const isEn = m => Array.isArray(m);
  const listOf = ms => isEn(ms[0]) ? ms[0] : ms;
  const langAttr = en => { const l = en ? "en" : ml(); return `lang="${l}" dir="${RTL.has(l) ? "rtl" : "ltr"}"`; };
  const enMark = en => en && ml() !== "en" ? ` <small class="ar-en">${esc(t("arabic.enMark"))}</small>` : "";
  const meaningsHtml = (ms, max = 3) => `<span class="ar-mean" ${langAttr(isEn(ms[0]))}>${listOf(ms).slice(0, max).map(esc).join(" / ")}</span>${enMark(isEn(ms[0]))}`;
  const glossHtml = g => `<span class="ar-g${isEn(g) && ml() !== "en" ? " en" : ""}" ${langAttr(isEn(g))}>${esc(isEn(g) ? g[0] : g)}</span>`;
  const langNote = () => getLang() === "ar" || IX.langs.includes(getLang()) || state.ml ? ""
    : `<p class="info">${icon("translate")}<span>${esc(t("arabic.inEnglish"))}</span></p>`;
  function pickLang(then) {
    const body = Q.sheet(t("arabic.meaningsLang"), `<div class="list flat">${IX.langs.map(l => `<button class="row" data-l="${l}"><div class="lbl">${esc(languageName(l))}</div>${l === ml() ? icon("check") : ""}</button>`).join("")}</div>`);
    body.onclick = e => { const b = e.target.closest("[data-l]"); if (!b) return; state.ml = b.dataset.l; save(); Q.closeSheet(); then(); };
  }

  // ---------- the recitation of a word ----------
  const au = new Audio(); au.preload = "none";
  const next = new Audio(); next.preload = "auto"; // the next word of a «listen to all», fetched ahead
  const url = loc => AUDIO + loc.split(":").map(x => x.padStart(3, "0")).join("_") + ".mp3";
  let btn = null, seq = null;
  const mark = on => { if (btn) btn.classList.toggle("on", on); };
  au.addEventListener("ended", () => { mark(false); btn = null; if (seq) seq.step(); });
  au.addEventListener("pause", () => { if (au.ended) return; mark(false); btn = null; });
  au.addEventListener("error", () => { if (!au.getAttribute("src")) return; mark(false); btn = null; if (seq) seq.end(); toast(t("listen.loadFailed")); });
  const clip = makeClipPlayer({ Q, t, icon, esc, toast });
  function stopWord() { if (seq) seq.end(); if (!au.paused) au.pause(); }
  for (const id of ["audio", "qaudio"]) document.getElementById(id)?.addEventListener("play", stopWord);
  function say(loc, b = null) {
    document.getElementById("audio")?.pause(); document.getElementById("qaudio")?.pause(); clip.stop();
    mark(false); btn = b; mark(true);
    au.src = url(loc);
    au.play().catch(e => { if (e.name !== "AbortError") { mark(false); toast(t("listen.playFailed")); } });
  }
  // The words (buttons matching sel, with data-loc) inside root one after another; the «listen to all» button b stops it.
  function sayAll(root, b, sel = "[data-loc]") {
    if (seq) { stopWord(); return; }
    const list = [...root.querySelectorAll(sel)]; let i = -1; const hash = location.hash;
    const label = b.innerHTML; b.innerHTML = `${icon("pause")} ${esc(t("common.stop"))}`;
    seq = {
      step() {
        i++;
        if (i >= list.length || stale(hash) || !list[i].isConnected) { seq.end(); return; }
        list[i].scrollIntoView({ block: "nearest" });
        say(list[i].dataset.loc, list[i]);
        if (list[i + 1]) next.src = url(list[i + 1].dataset.loc);
      },
      end() { seq = null; if (b.isConnected) b.innerHTML = label; },
    };
    seq.step();
  }
  // Taps on words and their speaker buttons (the page's own buttons are wired where they are drawn).
  view.addEventListener("click", e => {
    if (!location.hash.startsWith("#/arabic")) return;
    const b = e.target.closest("[data-loc]"); if (!b || !view.contains(b)) return;
    if (seq) seq.end();
    if (btn === b && !au.paused) { au.pause(); return; }
    say(b.dataset.loc, b);
  });

  // ---------- the start page: lessons, review, the surahs word by word ----------
  async function renderIndex() {
    setNav("more"); setHeader(t("arabic.full"), { back: true }); const hash = location.hash; view.innerHTML = loading();
    try { await load(); } catch (e) { if (!stale(hash)) failed(e, renderIndex); return; }
    if (stale(hash)) return;
    const n = lessons(), done = Object.keys(state.done).filter(k => k <= n).length;
    const nextLesson = Array.from({ length: n }, (_, i) => i + 1).find(l => !state.done[l]) || n;
    const due = dueList().length, known = knownList().length;
    const firstWords = l => range(l).slice(0, 4).map(i => IX.words[i][0]).join("، ");
    view.innerHTML = `${langNote()}
      <div class="tj-text"><p>${esc(t("arabic.intro", { total: IX.total, n: IX.words.length, pct: pct(IX.cov.at(-1)) }))}</p></div>
      <div class="ar-ml"><span>${esc(t("arabic.meaningsIn"))}</span><button class="chip" id="ar-ml">${icon("translate")} ${esc(languageName(ml()))}</button></div>
      <div class="progress-row qd-progress"><div class="progress"><div style="width:${Math.round(done / n * 100)}%"></div></div><span>${esc(t("qaida.progress", { done: num(done), total: num(n) }))}</span></div>
      ${known ? `<p class="stat ar-known">${icon("check")} ${esc(t("arabic.known", { n: known, pct: pct(knownShare()) }))}</p>` : ""}
      <div class="resume-row">
        <a class="resume main" href="#/arabic/l/${nextLesson}">${icon("play")}<div><b>${esc(t(done ? "qaida.continue" : "qaida.start"))}</b><span>${esc(t("qaida.lessonN", { n: num(nextLesson) }))}${sep()}<bdi lang="ar" dir="rtl">${esc(firstWords(nextLesson))}</bdi></span></div></a>
        ${known || due ? `<a class="resume" href="#/arabic/review">${icon("repeat")}<div><b>${esc(t("arabic.review"))}</b><span>${esc(due ? t("arabic.reviewDue", { n: due }) : t("arabic.noneDue"))}</span></div></a>` : ""}
      </div>
      <h2 class="section-title">${esc(t("arabic.firstLetters"))}</h2>
      <div class="resume-row"><a class="resume" href="#/qaida">${icon("school")}<div><b>${esc(t("qaida.title"))}</b><span>${esc(t("arabic.lettersHint"))}</span></div></a></div>
      <h2 class="section-title">${esc(t("arabic.lessons"))}</h2>
      <div class="list">${Array.from({ length: n }, (_, k) => k + 1).map(l => `<a href="#/arabic/l/${l}" class="${state.done[l] ? "qd-done" : ""}"><div class="num">${state.done[l] ? icon("check") : num(l)}</div><div class="lbl">${esc(t("qaida.lessonN", { n: num(l) }))} <span class="ar-cov">${esc(pct(IX.cov[l - 1]))}</span><span class="sub"><bdi lang="ar" dir="rtl" class="ar-sub">${esc(firstWords(l))}…</bdi></span></div>${icon("back", "chev")}</a>`).join("")}</div>
      <h2 class="section-title">${esc(t("arabic.surahs"))}</h2>
      <p class="riwayah-note">${esc(t("arabic.surahsHint"))}</p>
      <div class="ar-surahs">${IX.surahs.map(s => `<a class="chip" href="#/arabic/surah/${s}"><span class="ar-sn">${num(s)}</span> ${esc(names(s))}</a>`).join("")}</div>
      <p class="source-note">${esc(t("arabic.source", { total: IX.total }))}</p>`;
    $("#ar-ml").onclick = () => pickLang(renderIndex);
  }

  // ---------- a lesson: its words, each with its meanings, recitation and an example ----------
  const verseHtml = (C, M, key, hit = 0) => {
    const [s, a] = key.split(":");
    return `<div class="ar-verse" dir="rtl">${C.v[key].map(([ar, tr], j) => `<button type="button" class="ar-cell${j + 1 === hit ? " hit" : ""}" data-loc="${s}:${a}:${j + 1}"><span class="ar-w" lang="ar">${esc(ar)}</span><span class="ar-t" dir="ltr">${esc(tr)}</span>${glossHtml(M.v[key][j])}</button>`).join("")}</div>`;
  };
  const wordCard = (C, M, i) => {
    const [form, tr, n, loc, ex] = IX.words[i];
    const [s, a, p] = ex.split(":").map(Number);
    return `<section class="ar-word" id="w-${i}">
        <div class="ar-word-head">
          <button type="button" class="ar-say" data-loc="${loc}" aria-label="${esc(t("arabic.listenWord"))}">${icon("volume")}</button>
          <div class="ar-word-main"><span class="ar-form" lang="ar" dir="rtl">${esc(form)}</span><span class="ar-tr" dir="ltr">${esc(tr)}</span></div>
          <span class="ar-count">${esc(t("arabic.times", { n }))}</span>
        </div>
        <div class="ar-means">${meaningsHtml(M.w[i])}</div>
        <details class="ar-ex"><summary>${esc(t("arabic.example"))}: ${esc(names(s))} ${num(a)}</summary>
          ${verseHtml(C, M, `${s}:${a}`, p)}
          <div class="ar-ex-tools">${clip.button(`${s}:${a}`, { label: t("arabic.listenVerse") })}<a class="link" href="#/quran/hafs/${s}?a=${a}">${icon("quran")} ${esc(t("arabic.openVerse"))}</a></div>
        </details>
      </section>`;
  };
  const lessonNav = (n, here) => `<div class="tj-nav">
      ${n > 1 ? `<a class="btn ghost" href="#/arabic/l/${n - 1}">${icon("back", "dir")} ${esc(t("qaida.lessonN", { n: num(n - 1) }))}</a>` : `<a class="btn ghost" href="#/arabic">${esc(t("arabic.lessons"))}</a>`}
      ${n < lessons() ? `<a class="btn ghost" href="#/arabic/l/${n + 1}">${esc(t(here ? "qaida.lessonN" : "arabic.nextLesson", { n: num(n + 1) }))} ${icon("back", "flip")}</a>` : `<a class="btn ghost" href="#/arabic/review">${esc(t("arabic.review"))} ${icon("back", "flip")}</a>`}
    </div>`;
  async function renderLesson(n) {
    setNav("more"); setHeader(t("arabic.full"), { back: true }); const hash = location.hash; view.innerHTML = loading();
    let D; try { D = await load(true); } catch (e) { if (!stale(hash)) failed(e, () => renderLesson(n)); return; }
    if (stale(hash)) return;
    if (!(n >= 1 && n <= lessons())) { location.replace("#/arabic"); return; }
    const list = range(n); state.last = n; save();
    view.innerHTML = `${langNote()}
      <h2 class="tj-title">${esc(t("qaida.lessonN", { n: num(n) }))}${sep()}${esc(t("arabic.lessonWords", { from: num(list[0] + 1), to: num(list.at(-1) + 1) }))}</h2>
      <p class="info">${icon("book")}<span>${esc(t("arabic.lessonCov", { pct: pct(IX.cov[n - 1]) }))}</span></p>
      <div class="more-row ar-actions"><button class="btn ghost" id="ar-all">${icon("play")} ${esc(t("arabic.listenAll"))}</button><a class="btn" href="#/arabic/practice/${n}">${icon("check")} ${esc(t("arabic.practice"))}</a></div>
      <div class="ar-words" id="ar-words">${list.map(i => wordCard(D.C, D.M, i)).join("")}</div>
      <div class="qd-done-row"><a class="btn" href="#/arabic/practice/${n}">${icon("check")} ${esc(t("arabic.practice"))}</a></div>
      ${lessonNav(n, true)}
      <p class="source-note">${esc(t("arabic.source", { total: IX.total }))}</p>`;
    clip.wire(view);
    // «listen to all» reads the words of the lesson, not the words of their examples
    $("#ar-all").onclick = e => sayAll($("#ar-words"), e.currentTarget, ".ar-say");
  }

  // ---------- practice and review ----------
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const lower = s => String(s).toLocaleLowerCase();
  // Three other words whose meanings share nothing with the word's, from the pool (then from all words).
  function options(M, i, pool) {
    const mine = new Set(listOf(M.w[i]).map(lower)), out = [i], seen = new Set(mine);
    for (const list of [shuffle(pool.filter(j => j !== i)), shuffle(IX.words.map((w, j) => j).filter(j => j !== i && !pool.includes(j)))]) {
      for (const j of list) {
        if (out.length === 4) break;
        const ms = listOf(M.w[j]).map(lower);
        if (ms.some(m => seen.has(m))) continue;
        out.push(j); ms.forEach(m => seen.add(m));
      }
    }
    return shuffle(out);
  }
  async function renderQuiz({ lesson = 0, review = false, any = false }) {
    setNav("more"); setHeader(t(review ? "arabic.review" : "arabic.practice"), { back: true }); const hash = location.hash; view.innerHTML = loading();
    let D; try { D = await load(); } catch (e) { if (!stale(hash)) failed(e, () => renderQuiz({ lesson, review, any })); return; }
    if (stale(hash)) return;
    const M = D.M;
    if (lesson && !(lesson >= 1 && lesson <= lessons())) { location.replace("#/arabic"); return; }
    let items, pool;
    if (lesson) { items = range(lesson); pool = items; }
    else {
      const known = IX.words.map((w, i) => i).filter(i => state.cards[IX.words[i][0]]);
      items = any ? shuffle(known.slice()).slice(0, 20) : dueList().slice(0, 20); pool = known;
      if (!items.length) {
        const nextLesson = Array.from({ length: lessons() }, (_, i) => i + 1).find(l => !state.done[l]);
        view.innerHTML = `<div class="empty">${icon("check")}<div>${esc(t(known.length ? "arabic.noneDue" : "arabic.noneYet"))}</div><br>
          <div class="more-row">${known.length ? `<a class="btn ghost" href="#/arabic/review?any=1">${esc(t("arabic.practiceAny"))}</a>` : ""}${nextLesson ? `<a class="btn" href="#/arabic/l/${nextLesson}">${esc(t("qaida.lessonN", { n: num(nextLesson) }))}</a>` : ""}</div></div>`;
        return;
      }
    }
    // Each word once, with the three kinds of question in turn; a word answered wrongly comes again at the end.
    const kinds = ["mean", "hear", "word"];
    const queue = shuffle(items.slice()).map((i, k) => ({ i, kind: kinds[k % 3] }));
    const first = new Map(); let at = 0, timer = 0;
    view.innerHTML = `${langNote()}<div class="ar-quiz">
        <div class="progress-row"><div class="progress"><div id="ar-bar" style="width:0%"></div></div><span id="ar-of"></span></div>
        <div id="ar-q"></div></div>`;
    const stage = $("#ar-q");
    const arWord = j => `<span class="ar-form" lang="ar" dir="rtl">${esc(IX.words[j][0])}</span>`;
    function show() {
      clearTimeout(timer);
      if (stale(hash)) return;
      if (at >= queue.length) return finish();
      const { i, kind } = queue[at], opts = options(M, i, pool);
      $("#ar-bar").style.width = Math.round(at / queue.length * 100) + "%";
      $("#ar-of").textContent = t("qaida.drillOf", { n: num(at + 1), total: num(queue.length) });
      const loc = IX.words[i][3];
      const prompt = kind === "mean" ? `<div class="ar-prompt">${arWord(i)}<button type="button" class="ar-say big" data-loc="${loc}" aria-label="${esc(t("arabic.listenWord"))}">${icon("volume")}</button></div>`
        : kind === "hear" ? `<div class="ar-prompt"><button type="button" class="ar-say huge" data-loc="${loc}" aria-label="${esc(t("arabic.playAgain"))}">${icon("volume")}</button></div>`
        : `<div class="ar-prompt">${meaningsHtml(M.w[i], 2)}</div>`;
      stage.innerHTML = `<p class="ar-ask">${esc(t(kind === "mean" ? "arabic.qMeaning" : kind === "hear" ? "arabic.qHeard" : "arabic.qArabic"))}</p>
        ${prompt}
        <div class="ar-opts${kind === "mean" ? "" : " ar"}">${opts.map(j => `<button type="button" class="ar-opt" data-j="${j}">${kind === "mean" ? meaningsHtml(M.w[j], 2) : arWord(j)}</button>`).join("")}</div>
        <div class="ar-feedback" id="ar-fb"></div>`;
      if (kind === "hear") say(loc, $(".ar-say", stage));
      stage.querySelector(".ar-opts").onclick = e => {
        const b = e.target.closest(".ar-opt"); if (!b || stage.dataset.answered === String(at)) return;
        stage.dataset.answered = String(at);
        const ok = Number(b.dataset.j) === i;
        stage.querySelectorAll(".ar-opt").forEach(x => { x.disabled = true; if (Number(x.dataset.j) === i) x.classList.add("right"); });
        if (!ok) b.classList.add("wrong");
        if (!first.has(i)) { first.set(i, ok); grade(i, ok); if (!ok) queue.push({ i, kind: kinds[(kinds.indexOf(kind) + 1) % 3] }); }
        if (kind !== "hear" || !ok) say(loc);
        const fb = $("#ar-fb");
        fb.innerHTML = ok ? `<p class="ar-ok">${icon("check")} ${esc(t("arabic.right"))}</p>`
          : `<p class="ar-no">${esc(t("arabic.wrong"))}: ${arWord(i)} <span class="ar-tr" dir="ltr">${esc(IX.words[i][1])}</span> = ${meaningsHtml(M.w[i], 2)}</p>`;
        fb.insertAdjacentHTML("beforeend", `<div class="more-row"><button class="btn" id="ar-next">${esc(t("qaida.drillNext"))} ${icon("back", "flip")}</button></div>`);
        $("#ar-next").onclick = () => { at++; show(); };
        if (ok) timer = setTimeout(() => { if (!stale(hash) && stage.dataset.answered === String(at)) { at++; show(); } }, 1400);
      };
    }
    function finish() {
      const right = [...first.values()].filter(Boolean).length, total = first.size;
      if (lesson) { state.done[lesson] = today(); save(); }
      const nextL = lesson && lesson < lessons() ? lesson + 1 : 0, due = dueList().length;
      $("#ar-bar").style.width = "100%"; $("#ar-of").textContent = "";
      stage.innerHTML = `<div class="ar-done">
          <div class="ar-score">${esc(t("arabic.score", { right, total }))}</div>
          <p class="stat">${esc(t("arabic.known", { n: knownList().length, pct: pct(knownShare()) }))}</p>
          <p class="stat">${esc(t("arabic.comesBack"))}</p>
          <div class="more-row">
            <button class="btn ghost" id="ar-again">${icon("reset")} ${esc(t("arabic.again"))}</button>
            ${lesson ? `<a class="btn ghost" href="#/arabic/l/${lesson}">${esc(t("qaida.lessonN", { n: num(lesson) }))}</a>` : ""}
            ${nextL ? `<a class="btn" href="#/arabic/l/${nextL}">${esc(t("arabic.nextLesson"))} ${icon("back", "flip")}</a>` : due && !lesson ? "" : `<a class="btn" href="#/arabic">${esc(t("arabic.lessons"))}</a>`}
          </div></div>`;
      $("#ar-again").onclick = () => renderQuiz({ lesson, review, any: any || (review && !dueList().length) });
    }
    show();
  }

  // ---------- al-Fatiha and the last part, word by word ----------
  async function renderSurah(s) {
    setNav("more"); setHeader(t("arabic.full"), { back: true }); const hash = location.hash; view.innerHTML = loading();
    let D; try { D = await load(true); } catch (e) { if (!stale(hash)) failed(e, () => renderSurah(s)); return; }
    if (stale(hash)) return;
    const k = IX.surahs.indexOf(s); if (k < 0) { location.replace("#/arabic"); return; }
    setHeader(names(s), { back: true });
    const verses = D.C.s[s], gl = D.M.s[s], prev = IX.surahs[k - 1], nextS = IX.surahs[k + 1];
    view.innerHTML = `${langNote()}
      <p class="riwayah-note">${esc(t("arabic.surahsHint"))}</p>
      <div class="more-row ar-actions"><button class="btn ghost" id="ar-all">${icon("play")} ${esc(t("arabic.listenAll"))}</button><a class="btn ghost" href="#/quran/hafs/${s}">${icon("quran")} ${esc(t("arabic.openVerse"))}</a></div>
      <div class="ar-surah" id="ar-surah">${verses.map((ws, v) => `<section class="ar-aya" id="a-${v + 1}">
          <div class="ar-verse" dir="rtl">${ws.map(([ar, tr], j) => `<button type="button" class="ar-cell" data-loc="${s}:${v + 1}:${j + 1}"><span class="ar-w" lang="ar">${esc(ar)}</span><span class="ar-t" dir="ltr">${esc(tr)}</span>${glossHtml(gl[v][j])}</button>`).join("")}<span class="ar-num">﴿${num(v + 1)}﴾</span></div>
          <div class="ar-aya-tr" data-a="${v + 1}" hidden></div>
        </section>`).join("")}</div>
      <p class="source-note" id="ar-trsrc"></p>
      <div class="tj-nav">
        ${prev ? `<a class="btn ghost" href="#/arabic/surah/${prev}">${icon("back", "dir")} ${esc(names(prev))}</a>` : `<a class="btn ghost" href="#/arabic">${esc(t("arabic.full"))}</a>`}
        ${nextS ? `<a class="btn ghost" href="#/arabic/surah/${nextS}">${esc(names(nextS))} ${icon("back", "flip")}</a>` : `<span></span>`}
      </div>
      <p class="source-note">${esc(t("arabic.source", { total: IX.total }))}</p>`;
    $("#ar-all").onclick = e => sayAll($("#ar-surah"), e.currentTarget);
    // The meaning of each whole verse in the learner's language (the translation the Quran reader shows).
    try {
      const m = await Q.meanings(s); if (!m || stale(hash)) return;
      view.querySelectorAll(".ar-aya-tr").forEach(el => { const x = m.ayat[el.dataset.a]; if (!x) return; el.textContent = x; el.dir = m.dir; el.lang = m.lang; el.hidden = false; });
      $("#ar-trsrc").textContent = m.source;
    } catch { /* the words alone */ }
  }

  return {
    render(parts, params) {
      stopWord(); clip.stop();
      const [p, x] = parts;
      if (p === "l" && x) return renderLesson(Number(x));
      if (p === "practice" && x) return renderQuiz({ lesson: Number(x) });
      if (p === "review") return renderQuiz({ review: true, any: params?.get("any") === "1" });
      if (p === "surah" && x) return renderSurah(Number(x));
      return renderIndex();
    },
  };
}
