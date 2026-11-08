/* ===== تعلّم القراءة من الصفر: الحروف وصورها، والحركات والسكون والشدة والمد وعلامات الوقف ===== */
// data/qaida.json (scripts/build-qaida.js) holds the lessons: four of the letters (each letter with its name, where it
// is pronounced, the surah it opens if any, and a word of the Mushaf for each of its written shapes) and ten of the signs
// (sections of explanation with examples). Every example is drawn with its page's Tajweed font (js/glyphs.js) and can be
// heard in Shaykh al-Husary's recitation of its verse (js/clip.js). A lesson ends with the exercise «read, then listen»
// over its words, and the learner marks it done; progress is kept in LS "qaida".
import { makeClipPlayer } from "./clip.js?v=1.38.0";
import { makeGlyphs } from "./glyphs.js?v=1.38.0";

export function setupQaida(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, LS, Q, toast, setHeader, setNav } = ctx;
  // done: { lessonId: day marked }; last: the lesson opened last.
  const state = Object.assign({ done: {}, last: null }, LS.get("qaida", {}));
  const save = () => LS.set("qaida", state);
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";
  const L = x => x[isAr() ? 0 : 1]; // texts are [Arabic, English]; other languages read the English

  let DATA = null;
  async function load() { if (!DATA) { const r = await fetch("data/qaida.json"); if (!r.ok) throw new Error("HTTP " + r.status); DATA = await r.json(); } return DATA; }
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
  const enNote = () => isAr() || getLang() === "en" ? "" : `<p class="info">${icon("translate")}<span>${esc(t("tajweed.inEnglish"))}</span></p>`;

  // Examples in the Mushaf's own glyphs, and their «listen» buttons (shared with the Tajweed page).
  let names = n => String(n);
  const G = makeGlyphs({ Q, esc, icon, t, num, names: () => names, L });
  const clip = makeClipPlayer({ Q, t, icon, esc, toast });

  const isDone = id => !!state.done[id];
  const doneCount = () => DATA.lessons.filter(l => isDone(l.id)).length;
  const lessonIndex = id => DATA.lessons.findIndex(l => l.id === id);
  // Every example of a lesson, in reading order: the words of the letters' shapes, then the sections' examples.
  const examplesOf = l => [...(l.letters || []).flatMap(x => x.forms.map(f => f.ex)), ...(l.s || []).flatMap(s => s.ex || [])];
  const seriesLinks = () => `<div class="list">
      <a href="#/videos?g=tajweed"><div class="num">${icon("video")}</div><div class="lbl">${esc(t("radio.videosLink", { group: t("media.tajweed") }))}</div>${icon("back", "chev")}</a>
      <a href="#/radio/tajweed"><div class="num">${icon("headphones")}</div><div class="lbl">${esc(t("qaida.audioLink", { group: t("media.tajweed") }))}</div>${icon("back", "chev")}</a></div>`;

  // ---------- the lessons, with the learner's progress ----------
  async function renderIndex() {
    setNav("quran"); setHeader(t("qaida.title"), { back: true }); const hash = location.hash; clip.stop();
    view.innerHTML = loading();
    try { await load(); names = await Q.surahNames(); } catch (e) { if (!stale(hash)) failed(e, renderIndex); return; }
    if (stale(hash)) return;
    const done = doneCount(), total = DATA.lessons.length;
    const next = DATA.lessons.find(l => !isDone(l.id));
    const resume = !next ? `<p class="info">${icon("check")}<span>${esc(t("qaida.allDone"))} <a href="#/tajweed">${esc(t("tajweed.title"))}</a></span></p>`
      : `<div class="resume-row"><a class="resume main" href="#/qaida/${next.id}">${icon("play")}<div><b>${esc(t(done ? "qaida.continue" : "qaida.start"))}</b><span>${esc(t("qaida.lessonN", { n: num(lessonIndex(next.id) + 1) }))}${sep()}${esc(L(next.t))}</span></div></a></div>`;
    view.innerHTML = `${enNote()}
      <div class="tj-text">${DATA.intro.map(p => `<p>${para(L(p))}</p>`).join("")}</div>
      <div class="progress-row qd-progress"><div class="progress"><div style="width:${total ? Math.round(done / total * 100) : 0}%"></div></div><span>${esc(t("qaida.progress", { done: num(done), total: num(total) }))}</span></div>
      ${resume}
      <h2 class="section-title">${esc(t("qaida.lessons"))}</h2>
      <div class="list">${DATA.lessons.map((l, i) => `<a href="#/qaida/${l.id}" class="${isDone(l.id) ? "qd-done" : ""}"><div class="num">${isDone(l.id) ? icon("check") : num(i + 1)}</div><div class="lbl">${esc(L(l.t))}<span class="sub">${esc(L(l.sub))}</span></div>${icon("back", "chev")}</a>`).join("")}</div>
      <h2 class="section-title">${esc(t("qaida.nextTajweed"))}</h2>
      <div class="resume-row"><a class="resume" href="#/tajweed">${icon("palette")}<div><b>${esc(t("tajweed.title"))}</b><span>${esc(t("tajweed.hint"))}</span></div></a></div>
      <h2 class="section-title">${esc(t("tajweed.seriesLink"))}</h2>
      ${seriesLinks()}
      <p class="source-note">${esc(L(DATA.source))}</p>`;
  }

  // ---------- one lesson: the explanation, the examples, the exercise, and marking it done ----------
  async function renderLesson(id) {
    setNav("quran"); const hash = location.hash; setHeader(t("qaida.title"), { back: true }); view.innerHTML = loading(); clip.stop();
    try { await load(); names = await Q.surahNames(); } catch (e) { if (!stale(hash)) failed(e, () => renderLesson(id)); return; }
    if (stale(hash)) return;
    const i = lessonIndex(id);
    if (i < 0) { location.replace("#/qaida"); return; }
    const l = DATA.lessons[i], prev = DATA.lessons[i - 1], next = DATA.lessons[i + 1];
    state.last = id; save();
    const letterCard = x => `<section class="tj-sec qd-letter">
        <div class="qd-head"><span class="qd-big" lang="ar" dir="rtl">${esc(x.l)}</span><div><h3><span>${esc(L(x.n))}${isAr() ? "" : ` <bdi lang="ar" dir="rtl">${esc(x.n[0])}</bdi>`}</span></h3><p class="qd-sound">${esc(L(x.sound))}</p></div></div>
        ${x.muq ? `<div class="qd-muq"><span>${esc(t("qaida.listenName"))}</span>${G.exHtml(x.muq, { note: false })}</div>` : ""}
        <h4>${esc(t("qaida.forms"))}</h4>
        <div class="tj-exs qd-forms">${x.forms.map(f => `<div class="qd-form"><div class="qd-form-l">${esc(L(DATA.forms[f.f]))}</div>${G.exHtml(f.ex, { note: false })}</div>`).join("")}</div>
      </section>`;
    const section = s => `<section class="tj-sec">
        <h3><span>${esc(L(s.h))}</span></h3>
        ${(s.p || []).map(p => `<p>${para(L(p))}</p>`).join("")}
        ${s.list ? `<ul>${s.list.map(x => `<li>${para(L(x))}</li>`).join("")}</ul>` : ""}
        ${s.ex ? `<div class="tj-exs">${s.ex.map(x => G.exHtml(x)).join("")}</div>` : ""}
      </section>`;
    const doneBtn = () => `${icon(isDone(id) ? "reset" : "check")} ${esc(t(isDone(id) ? "qaida.markUndone" : "qaida.markDone"))}`;
    view.innerHTML = `${enNote()}
      <h2 class="tj-title">${esc(t("qaida.lessonN", { n: num(i + 1) }))}${sep()}${esc(L(l.t))}</h2>
      ${(l.intro || []).length ? `<div class="tj-text">${l.intro.map(p => `<p>${para(L(p))}</p>`).join("")}</div>` : ""}
      ${(l.letters || []).map(letterCard).join("")}
      ${(l.s || []).map(section).join("")}
      <section class="tj-sec qd-drill" id="qd-drill">
        <h3><span>${esc(t("qaida.drill"))}</span></h3>
        <p>${esc(t("qaida.drillHint"))}</p>
        <div class="qd-stage" id="qd-stage"><div class="more-row"><button class="btn" id="qd-start">${icon("play")} ${esc(t("qaida.drillStart"))}</button></div></div>
      </section>
      <div class="qd-done-row"><button class="btn ${isDone(id) ? "ghost" : ""}" id="qd-done">${doneBtn()}</button></div>
      <div class="tj-nav">
        ${prev ? `<a class="btn ghost" href="#/qaida/${prev.id}">${icon("back", "dir")} ${esc(L(prev.t))}</a>` : `<a class="btn ghost" href="#/qaida">${esc(t("qaida.lessons"))}</a>`}
        ${next ? `<a class="btn ghost" href="#/qaida/${next.id}">${esc(L(next.t))} ${icon("back", "flip")}</a>` : `<a class="btn ghost" href="#/tajweed">${esc(t("tajweed.title"))} ${icon("back", "flip")}</a>`}
      </div>
      <p class="source-note">${esc(L(DATA.source))}</p>
      <p class="source-note">${esc(t("tajweed.audioNote"))}</p>`;
    G.drawExamples(view); clip.wire(view);

    // The exercise: the lesson's words one by one, big, each with its «listen» button.
    const items = examplesOf(l); let at = -1;
    const stage = $("#qd-stage");
    const show = () => {
      clip.stop();
      if (at >= items.length) {
        stage.innerHTML = `<p class="info">${icon("check")}<span>${esc(t("qaida.drillDone"))}</span></p>
          <div class="more-row"><button class="btn ghost" id="qd-again">${icon("reset")} ${esc(t("qaida.drillAgain"))}</button>${isDone(id) ? "" : `<button class="btn" id="qd-done2">${icon("check")} ${esc(t("qaida.markDone"))}</button>`}</div>`;
        $("#qd-again").onclick = () => { at = 0; show(); };
        const d2 = $("#qd-done2"); if (d2) d2.onclick = () => { setDone(true); show(); };
        return;
      }
      stage.innerHTML = `${G.exHtml(items[at], { cls: "big" })}
        <div class="qd-stage-nav">
          <button class="btn ghost small" id="qd-prev" ${at ? "" : "disabled"}>${icon("back", "dir")} ${esc(t("qaida.drillPrev"))}</button>
          <span class="qd-count">${esc(t("qaida.drillOf", { n: num(at + 1), total: num(items.length) }))}</span>
          <button class="btn small" id="qd-next">${esc(t("qaida.drillNext"))} ${icon("back", "flip")}</button>
        </div>`;
      G.drawExamples(stage); clip.wire(stage);
      $("#qd-prev").onclick = () => { if (at > 0) { at--; show(); } };
      $("#qd-next").onclick = () => { at++; show(); };
    };
    $("#qd-start").onclick = () => { at = 0; show(); stage.scrollIntoView({ block: "nearest" }); };
    const setDone = on => {
      if (on) state.done[id] = Math.floor(Date.now() / 864e5); else delete state.done[id]; save();
      const b = $("#qd-done"); b.innerHTML = doneBtn(); b.classList.toggle("ghost", on);
      if (on) toast(t("qaida.done"));
    };
    $("#qd-done").onclick = () => setDone(!isDone(id));
  }

  return { render(parts) { return parts[0] ? renderLesson(parts[0]) : renderIndex(); } };
}
