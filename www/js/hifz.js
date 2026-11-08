/* ===== تحفيظ القرآن: تكرار الآيات وترديدها، وإخفاؤها للاختبار، ومراجعة المحفوظ في مواعيده ===== */
// A stretch of verses of one surah, in a riwayah, is repeated by the app's player (player.surahs with loop, js/quran.js):
// every verse reps times, the stretch rounds times, a silent gap after each verse to say it aloud, at a chosen rate. The
// voice is a recitation with verse timings for that riwayah (TIMED in quran.js, al-Husary where he has one) or any
// recording the user picks, among them the teaching Mushaf recordings (المصحف المعلم) which have no timings and so are
// repeated as whole surahs. The verses show in the riwayah's font; they can be hidden (a tap shows a verse) or tested
// (the first word shows, a tap shows the next). What was memorised is kept in LS "hifz": each stretch in a Leitner box
// 0–4 with reviews after 1, 3, 7, 14 and 30 days, a daily goal, and a day log for the streak. Progress is kept per
// riwayah, since the verse numbers differ between them.
import { AYA_NUM } from "./qdiff.js?v=1.37.0";

const INTERVALS = [1, 3, 7, 14, 30]; // days until the next review, by box
const DAY = 86400000;
const KEEP_LOG = 400; // days of the log kept

export function setupHifz(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, LS, Q, toast, setHeader, setNav } = ctx;
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";
  const L = x => Array.isArray(x) ? x[isAr() ? 0 : 1] : x;
  const rShort = rid => t("riwayahShort." + rid);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // ---------- what was memorised ----------
  // { v, rid, goal: { unit: "ayat"|"pages", n }, items: [{ r, s, a, b, p, q, day, box, due }], log: { day: [learned, reviewed] },
  //   rec: { rid: the recording chosen for this riwayah }, set: { reps, rounds, gap, rate, mode }, last: { r, s, a, b } }
  // p, q: the printed pages of verses a and b; day: a local day number; due: the day of the next review.
  const H = Object.assign({ v: 1, rid: null, goal: { unit: "ayat", n: 5 }, items: [], log: {}, rec: {}, set: {}, last: null }, LS.get("hifz", {}));
  H.set = Object.assign({ reps: 3, rounds: 1, gap: 1, rate: 1, mode: "" }, H.set);
  const save = () => LS.set("hifz", H);
  const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / DAY);
  const logOf = d => (H.log[d] ||= [0, 0]);
  const prune = () => { const d = dayNum(); for (const k of Object.keys(H.log)) if (d - Number(k) > KEEP_LOG) delete H.log[k]; };
  // The verses of surah s (riwayah r) in the memorised stretches.
  function memorised(r, s) { const set = new Set(); H.items.forEach(it => { if (it.r === r && it.s === s) for (let a = it.a; a <= it.b; a++) set.add(a); }); return set; }
  const memorisedCount = r => { const by = new Map(); H.items.forEach(it => { if (it.r === r) { if (!by.has(it.s)) by.set(it.s, new Set()); for (let a = it.a; a <= it.b; a++) by.get(it.s).add(a); } }); let n = 0; by.forEach(x => { n += x.size; }); return { ayat: n, surahs: by.size }; };
  // A stretch learned today: joined to a stretch of the same day and surah that touches it; new verses count toward the goal.
  function learned(r, s, a, b, p, q) {
    const d = dayNum(); const had = memorised(r, s); let fresh = 0; for (let x = a; x <= b; x++) if (!had.has(x)) fresh++;
    let it = H.items.find(x => x.r === r && x.s === s && x.day === d && x.a <= b + 1 && x.b >= a - 1);
    if (it) { it.a = Math.min(it.a, a); it.b = Math.max(it.b, b); it.p = Math.min(it.p, p); it.q = Math.max(it.q, q); }
    else { it = { r, s, a, b, p, q, day: d, box: 0, due: d + INTERVALS[0] }; H.items.push(it); }
    logOf(d)[0] += fresh; prune(); save(); return it;
  }
  const due = r => H.items.filter(it => (!r || it.r === r) && it.due <= dayNum()).sort((x, y) => x.due - y.due || x.s - y.s || x.a - y.a);
  // A review: known well moves the stretch up a box (a longer wait), not known brings it back to the first.
  function reviewed(it, ok) { const d = dayNum(); it.box = ok ? Math.min(INTERVALS.length - 1, it.box + 1) : 0; it.due = d + INTERVALS[it.box]; logOf(d)[1]++; prune(); save(); }
  function forget(it) { const i = H.items.indexOf(it); if (i >= 0) H.items.splice(i, 1); save(); }
  const pagesToday = d => { const set = new Set(); H.items.forEach(it => { if (it.day === d) for (let p = it.p; p <= it.q; p++) set.add(it.r + ":" + p); }); return set.size; };
  // Days in a row with something learned or reviewed; yesterday keeps the streak until today is written.
  function streak() { const active = k => { const l = H.log[k]; return !!l && (l[0] > 0 || l[1] > 0); }; let d = dayNum(), n = 0; if (!active(d)) d--; while (active(d)) { n++; d--; } return n; }
  function todayInfo() {
    const d = dayNum(), l = H.log[d] || [0, 0];
    return { done: H.goal.unit === "pages" ? pagesToday(d) : l[0], goal: H.goal.n, unit: H.goal.unit, reviewed: l[1], due: due(null).length, streak: streak() };
  }
  const whenText = days => days <= 0 ? t("hifz.today") : days === 1 ? t("hifz.tomorrow") : t("hifz.inDays", { n: days });
  const itemHref = (it, review = false) => `#/hifz/${it.r}/${it.s}?from=${it.a}&to=${it.b}${review ? "&review=1" : ""}`;

  // ---------- helpers ----------
  const loading = () => `<div class="empty"><div class="spinner"></div><div>${esc(t("common.loading"))}</div></div>`;
  const failed = (err, retry) => {
    const offline = !navigator.onLine || err instanceof TypeError;
    view.innerHTML = `<div class="empty">${icon("download")}<div>${esc(t(offline ? "offline.needOnce" : "common.loadFailed"))}</div><br><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`;
    $("#retry").onclick = retry;
  };
  const ALL = Array.from({ length: 114 }, (_, i) => i + 1);
  // The recording for riwayah rid: the one the user picked here, else the riwayah's timed recitation (al-Husary for Hafs).
  function recOf(rid) {
    if (H.rec[rid]) return H.rec[rid];
    const c = Q.clips(rid); return c ? { name: L(c.name), server: c.server, list: ALL, timed: true } : null;
  }
  const recList = rec => Array.isArray(rec.list) ? rec.list : Q.surahList(rec);
  const pickRec = (rid, then) => Q.pickReciter(rid, x => { H.rec[rid] = { name: x.name, moshaf: x.moshaf, server: x.server, list: x.list, timed: !!x.timed, teach: !!x.teach }; save(); then?.(); }, { fromAya: true, teach: true, current: recOf(rid)?.server, remember: false });

  // ---------- the page: today, a new stretch, what is due, what is memorised ----------
  async function renderHome() {
    setNav("quran"); setHeader(t("hifz.title"), { back: true }); const hash = location.hash; view.innerHTML = loading();
    let RIW, names; try { RIW = await Q.riwayat(); names = await Q.surahNames(); } catch (e) { return failed(e, renderHome); }
    if (stale(hash)) return;
    const qs = LS.get("quran", {});
    const rid = [H.rid, qs.riwayah, "hafs"].find(id => RIW.some(r => r.id === id)); const meta = RIW.find(r => r.id === rid);
    const info = todayInfo(), dueList = due(null), count = memorisedCount(rid);
    // The stretch to offer: after the last one memorised in this riwayah, else the place being read, else the beginning.
    const last = H.last?.r === rid ? H.last : null; let s0 = last?.s || (qs.last?.r === rid ? qs.last.s : 1), a0 = last ? last.b + 1 : (qs.last?.r === rid ? qs.last.a : 1);
    if (a0 > meta.surahs[s0 - 1][1]) { s0 = Math.min(114, s0 + 1); a0 = 1; }
    const n0 = meta.surahs[s0 - 1][1], b0 = Math.min(n0, a0 + 2);
    const pct = Math.min(100, Math.round(info.done / Math.max(1, info.goal) * 100));
    const row = (it, review) => { const m = RIW.find(r => r.id === it.r); const late = dayNum() - it.due; return `<div class="row split"><a class="row-main" href="${itemHref(it, review)}"><div class="num">${review ? icon("reset") : icon("check")}</div><div class="lbl">${esc(`${names(it.s)} ${num(it.a)}–${num(it.b)}`)}<span class="sub">${esc(m ? rShort(m.id) : it.r)}${sep()}${esc(t("hifz.box", { n: it.box + 1, total: INTERVALS.length }))}${sep()}${esc(review ? (late > 0 ? t("hifz.late", { n: late }) : t("hifz.today")) : t("hifz.nextReview", { when: whenText(it.due - dayNum()) }))}</span></div></a><button class="icon-btn dl-btn" data-forget="${H.items.indexOf(it)}" aria-label="${esc(t("hifz.delete"))}">${icon("trash")}</button></div>`; };
    const mine = H.items.filter(it => it.r === rid).sort((x, y) => x.s - y.s || x.a - y.a);
    view.innerHTML = `
      <section class="hero slim hz-today">
        <h2>${esc(t("hifz.todayTitle"))}</h2>
        <p>${esc(t(info.unit === "pages" ? "hifz.progressPages" : "hifz.progressAyat", { done: info.done, goal: info.goal }))}${info.streak ? `${sep()}${esc(t("hifz.streak", { n: info.streak }))}` : ""}</p>
        <div class="progress light"><div style="width:${pct}%"></div></div>
        <p class="hz-due">${esc(info.due ? t("hifz.dueCount", { n: info.due }) : t("hifz.noDue"))}</p>
      </section>
      <p class="info">${icon("repeat")}<span>${esc(t("hifz.hint"))}</span></p>
      <h2 class="section-title">${esc(t("hifz.start"))}</h2>
      <div class="chips" role="tablist" aria-label="${esc(t("quran.riwayah"))}">${RIW.map(r => `<button class="chip ${r.id === rid ? "on" : ""}" data-r="${r.id}" role="tab" aria-selected="${r.id === rid}">${esc(rShort(r.id))}</button>`).join("")}</div>
      <div class="card hz-form">
        <div class="setting"><div class="lbl">${esc(t("hifz.surah"))}</div><select id="hz-s" class="hz-select">${meta.surahs.map((x, i) => `<option value="${i + 1}" ${i + 1 === s0 ? "selected" : ""}>${num(i + 1)}. ${esc(names(i + 1))}</option>`).join("")}</select></div>
        <div class="setting"><div class="lbl">${esc(t("hifz.from"))}</div><input id="hz-a" class="hz-num" type="number" inputmode="numeric" min="1" max="${n0}" value="${a0}"></div>
        <div class="setting"><div class="lbl">${esc(t("hifz.to"))}</div><input id="hz-b" class="hz-num" type="number" inputmode="numeric" min="1" max="${n0}" value="${b0}"></div>
        <div class="setting"><div class="lbl">${esc(t("hifz.goal"))}<small>${esc(t("hifz.riwayahNote"))}</small></div><div class="hz-goal"><span class="segmented" id="hz-goal">${[1, 3, 5, 10, 20].map(n => `<button type="button" data-n="${n}" class="${H.goal.n === n ? "on" : ""}">${num(n)}</button>`).join("")}</span><span class="segmented" id="hz-unit"><button type="button" data-u="ayat" class="${H.goal.unit === "ayat" ? "on" : ""}">${esc(t("hifz.unitAyat"))}</button><button type="button" data-u="pages" class="${H.goal.unit === "pages" ? "on" : ""}">${esc(t("hifz.unitPages"))}</button></span></div></div>
        <div class="setting hz-go"><button class="btn block" id="hz-go">${icon("repeat")} ${esc(t("hifz.go"))}</button></div>
      </div>
      <div id="hz-lists">
      ${dueList.length ? `<h2 class="section-title">${esc(t("hifz.due"))}</h2><div class="list">${dueList.map(it => row(it, true)).join("")}</div>` : ""}
      <h2 class="section-title">${esc(t("hifz.memorised"))}${sep()}${esc(rShort(rid))}</h2>
      ${mine.length ? `<p class="riwayah-note">${esc(t("count.ayat", { n: count.ayat }))}${sep()}${esc(t("count.surahs", { n: count.surahs }))}</p><div class="list">${mine.map(it => row(it, false)).join("")}</div>` : `<div class="empty">${icon("repeat")}<div>${esc(t("hifz.none"))}</div></div>`}
      </div>`;
    view.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { H.rid = b.dataset.r; save(); renderHome(); });
    const sel = $("#hz-s"), ia = $("#hz-a"), ib = $("#hz-b");
    sel.onchange = () => { const n = meta.surahs[Number(sel.value) - 1][1]; ia.max = ib.max = n; ia.value = 1; ib.value = Math.min(n, 3); };
    $("#hz-goal").onclick = e => { const b = e.target.closest("[data-n]"); if (!b) return; H.goal.n = Number(b.dataset.n); save(); renderHome(); };
    $("#hz-unit").onclick = e => { const b = e.target.closest("[data-u]"); if (!b) return; H.goal.unit = b.dataset.u; save(); renderHome(); };
    const go = () => {
      const s = Number(sel.value), n = meta.surahs[s - 1][1];
      const a = clamp(Number(ia.value) || 1, 1, n), b = clamp(Number(ib.value) || a, a, n);
      H.rid = rid; save(); location.hash = `#/hifz/${rid}/${s}?from=${a}&to=${b}`;
    };
    $("#hz-go").onclick = go;
    view.querySelectorAll(".hz-num").forEach(i => i.onkeydown = e => { if (e.key === "Enter") go(); });
    $("#hz-lists").onclick = e => {
      const f = e.target.closest("[data-forget]"); if (!f) return;
      const it = H.items[Number(f.dataset.forget)]; if (!it || !confirm(t("hifz.delete") + "?")) return;
      forget(it); toast(t("hifz.deleted")); renderHome();
    };
  }

  // ---------- a stretch: its verses, the loop's controls, and marking it memorised or reviewed ----------
  let unLoop = null, unTime = null;
  async function renderSegment(rid, s, params) {
    setNav("quran"); const hash = location.hash; setHeader(t("hifz.title"), { back: true }); view.innerHTML = loading();
    let meta, data, names;
    try { ({ meta, data } = await Q.textOf(rid)); names = await Q.surahNames(); } catch (e) { return failed(e, () => renderSegment(rid, s, params)); }
    if (stale(hash)) return;
    s = clamp(s | 0 || 1, 1, 114);
    if (meta.id !== rid) { location.replace(`#/hifz/${meta.id}/${s}`); return; }
    const ayat = data.s[s - 1], n = ayat.length;
    const from = clamp(Number(params.get("from")) || 1, 1, n), to = clamp(Number(params.get("to")) || from + 2, from, n);
    // A review: the due stretch that holds these verses.
    const reviewing = params.get("review") === "1" ? due(rid).find(it => it.s === s && it.a <= from && it.b >= to) || null : null;
    H.rid = rid; H.last = { r: rid, s, a: from, b: to }; save();
    const name = names(s); const range = t("hifz.ayaRange", { from, to });
    setHeader(`${name}${sep()}${range}`, { back: true, onTitle: () => { location.hash = "#/hifz"; } });
    const showBasmala = from === 1 && s !== 9 && !(s === 1 && meta.basmalaIsAya);
    // Each word of a verse in a span, so the test can show them one by one; the verse's number stays outside.
    const verse = a => {
      const full = ayat[a - 1][0].normalize("NFC"); const tail = AYA_NUM.exec(full); const body = tail ? full.slice(0, tail.index) : full;
      return `<div class="aya" data-a="${a}" tabindex="0"><span class="aya-text" lang="ar" dir="rtl">${body.split(" ").filter(Boolean).map((w, i) => `<span class="w${i ? "" : " on"}">${esc(w)}</span>`).join(" ")}${tail ? `<span class="an">${esc(tail[0])}</span>` : ""}</span></div>`;
    };
    const MODES = [["", "hifz.modeAll"], ["hide", "hifz.modeHide"], ["test", "hifz.modeTest"]];
    const GAPS = [0, 0.5, 1, 2], RATES = [0.75, 1, 1.25, 1.5];
    const stepper = (k, v) => `<span class="hz-step" role="group"><button type="button" data-step="${k}:-1" aria-label="${esc(t("settings.smaller"))}">${icon("minus")}</button><b id="hz-${k}">${num(v)}</b><button type="button" data-step="${k}:1" aria-label="${esc(t("settings.larger"))}">${icon("plus")}</button></span>`;
    const rec = recOf(rid);
    const prevHref = from > 1 ? `#/hifz/${rid}/${s}?from=${Math.max(1, from - (to - from + 1))}&to=${from - 1}` : s > 1 ? `#/hifz/${rid}/${s - 1}?from=${Math.max(1, meta.surahs[s - 2][1] - (to - from))}&to=${meta.surahs[s - 2][1]}` : "";
    const nextHref = to < n ? `#/hifz/${rid}/${s}?from=${to + 1}&to=${Math.min(n, to + (to - from + 1))}` : s < 114 ? `#/hifz/${rid}/${s + 1}?from=1&to=${Math.min(meta.surahs[s][1], to - from + 1)}` : "";
    const seg = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const had = memorised(rid, s); const known = seg.every(a => had.has(a));
    view.innerHTML = `
      <div class="reader-bar">
        <span class="pill">${icon("layers")} ${esc(rShort(rid))}</span><span class="pill ghost">${esc(range)}</span>
        <a class="pill ghost" href="#/quran/${rid}/${s}${from > 1 ? `?a=${from}` : ""}">${icon("book")} ${esc(t("hifz.openReader"))}</a>
        <span class="segmented hz-modes" id="hz-mode">${MODES.map(([m, k]) => `<button type="button" data-m="${m}" class="${H.set.mode === m ? "on" : ""}">${esc(t(k))}</button>`).join("")}</span>
      </div>
      <p class="source-note hz-hint" id="hz-hint"></p>
      <article class="mushaf hz-text mode-${H.set.mode}" id="hz-text" lang="ar" dir="rtl" style="--qfont:'kfgqpc-${meta.id}'">
        ${showBasmala ? `<div class="basmala">${esc(meta.basmala)}</div>` : ""}
        ${seg.map(verse).join("")}
      </article>
      <div class="hz-play">
        <button class="btn block" id="hz-play">${icon("play")} <span>${esc(t("hifz.play"))}</span></button>
        <div class="hz-status" id="hz-status"></div>
      </div>
      <div class="card hz-ctl">
        <div class="setting"><span class="ic">${icon("headphones")}</span><div class="lbl">${esc(t("hifz.reciter"))}<small id="hz-rec" dir="auto">${esc(rec ? rec.name : t("hifz.chooseReciter"))}</small></div><button class="btn ghost small" id="hz-rec-btn">${esc(t("common.change"))}</button></div>
        <div class="setting"><div class="lbl">${esc(t("hifz.reps"))}</div>${stepper("reps", H.set.reps)}</div>
        <div class="setting"><div class="lbl">${esc(t("hifz.rounds"))}</div>${stepper("rounds", H.set.rounds)}</div>
        <div class="setting"><div class="lbl">${esc(t("hifz.gap"))}<small>${esc(t("hifz.gapHint"))}</small></div><span class="segmented hz-seg" id="hz-gap">${GAPS.map(g => `<button type="button" data-v="${g}" class="${H.set.gap === g ? "on" : ""}">${g ? "×" + num(g) : esc(t("hifz.gapNone"))}</button>`).join("")}</span></div>
        <div class="setting"><div class="lbl">${esc(t("hifz.rate"))}</div><span class="segmented hz-seg" id="hz-rate">${RATES.map(r => `<button type="button" data-v="${r}" class="${H.set.rate === r ? "on" : ""}">×${num(r)}</button>`).join("")}</span></div>
        <p class="source-note hz-note" id="hz-note" hidden></p>
      </div>
      <div class="card hz-done" id="hz-done"></div>
      <nav class="tj-nav">
        ${prevHref ? `<a class="btn ghost" href="${prevHref}">${icon("back", "dir")} ${esc(t("hifz.prevSeg"))}</a>` : "<span></span>"}
        ${nextHref ? `<a class="btn ghost" href="${nextHref}">${esc(t("hifz.nextSeg"))} ${icon("back", "flip")}</a>` : "<span></span>"}
      </nav>
      <p class="source-note">${esc(t("quran.sourceNote", { source: t("kfgqpc.name"), v: meta.version }))}</p>`;
    const text = $("#hz-text"), hint = $("#hz-hint"), status = $("#hz-status"), playBtn = $("#hz-play"), note = $("#hz-note");

    // ---- showing, hiding and testing
    const showHint = () => { hint.textContent = H.set.mode === "hide" ? t("hifz.tapReveal") : H.set.mode === "test" ? t("hifz.tapWord") : ""; hint.hidden = !H.set.mode; };
    const resetReveal = () => text.querySelectorAll(".aya").forEach(el => { el.classList.remove("shown"); el.querySelectorAll(".w").forEach((w, i) => w.classList.toggle("on", i === 0)); });
    showHint();
    $("#hz-mode").onclick = e => {
      const b = e.target.closest("[data-m]"); if (!b) return;
      H.set.mode = b.dataset.m; save(); text.className = `mushaf hz-text mode-${H.set.mode}`; resetReveal(); showHint();
      $("#hz-mode").querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.m === H.set.mode));
    };
    const reveal = el => {
      if (H.set.mode === "hide") { el.classList.toggle("shown"); return; }
      if (H.set.mode !== "test") return;
      const next = el.querySelector(".w:not(.on)");
      if (next) next.classList.add("on"); else el.querySelectorAll(".w").forEach((w, i) => w.classList.toggle("on", i === 0)); // all shown: start over
    };
    text.addEventListener("click", e => { if (window.getSelection && String(window.getSelection()).length) return; const el = e.target.closest(".aya"); if (el) reveal(el); });
    text.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("aya")) { e.preventDefault(); reveal(e.target); } });

    // ---- the loop's settings
    const LIM = { reps: [1, 10], rounds: [1, 10] };
    view.querySelectorAll("[data-step]").forEach(b => b.onclick = () => {
      const [k, d] = b.dataset.step.split(":"); const [lo, hi] = LIM[k];
      H.set[k] = clamp(H.set[k] + Number(d), lo, hi); save(); $("#hz-" + k).textContent = num(H.set[k]);
    });
    for (const [id, k] of [["hz-gap", "gap"], ["hz-rate", "rate"]]) $("#" + id).onclick = e => {
      const b = e.target.closest("[data-v]"); if (!b) return; H.set[k] = Number(b.dataset.v); save();
      $("#" + id).querySelectorAll("button").forEach(x => x.classList.toggle("on", Number(x.dataset.v) === H.set[k]));
    };
    const showRec = () => { const r = recOf(rid); $("#hz-rec").textContent = r ? r.name : t("hifz.chooseReciter"); note.hidden = !(r && !r.timed && r.teach); if (!note.hidden) note.textContent = t("hifz.teachNote"); };
    showRec();
    $("#hz-rec-btn").onclick = () => pickRec(rid, showRec);

    // ---- playing: inside the tap, the timings arriving while the recitation starts silent (player.surahs, js/quran.js)
    const player = Q.player;
    const mineLoop = () => { const now = player.now(); return !!now && now.rid === rid && now.surah === s && !!player.loopState(); };
    const showLoop = st => {
      const on = mineLoop() && st; const cur = on && !st.done ? st.a : 0;
      text.querySelectorAll(".aya").forEach(el => el.classList.toggle("play", Number(el.dataset.a) === cur));
      const busy = on && !st.done && player.loopPlaying();
      playBtn.innerHTML = `${icon(busy ? "pause" : "play")} <span>${esc(t(busy ? "hifz.stop" : "hifz.play"))}</span>`;
      status.classList.toggle("gap", !!on && st.phase === "gap" && !st.done);
      status.textContent = !on ? "" : st.done ? t("hifz.done") : st.phase === "gap" ? t("hifz.gapNow") : st.timed ? `${t("player.aya", { n: st.a })}${sep()}${num(st.k)}/${num(st.reps)}${sep()}${t("hifz.round", { n: st.round, total: st.rounds })}` : t("hifz.round", { n: st.round, total: st.rounds });
      if (on && st.done) $("#hz-done").classList.add("ask");
    };
    unLoop?.(); unLoop = player.onLoop(st => { if (stale(hash) || !document.body.contains(text)) return unLoop?.(); showLoop(st); });
    unTime?.(); unTime = player.listen(() => { if (stale(hash) || !document.body.contains(text)) return unTime?.(); showLoop(player.loopState()); });
    showLoop(player.loopState());
    playBtn.onclick = () => {
      if (mineLoop() && player.loopPlaying()) { player.stopLoop(); showLoop(null); return; }
      const r = recOf(rid); if (!r) return pickRec(rid, () => playBtn.click());
      const list = recList(r); if (!list.includes(s)) { toast(t("listen.surahUnavailable")); return; }
      const starts = Q.verseTimes(rid, r.server, s).then(S => { if (!S && !stale(hash)) { note.hidden = false; note.textContent = t(r.teach ? "hifz.teachNote" : "hifz.noTiming"); } return S; }).catch(() => null);
      player.surahs({ server: r.server, list, start: s, sub: `${r.name}${sep()}${rShort(rid)}`, rid, loop: { from, to, reps: H.set.reps, rounds: H.set.rounds, gap: H.set.gap, rate: H.set.rate, starts } });
      showLoop(player.loopState());
    };

    // ---- memorised, or reviewed
    const doneBox = $("#hz-done");
    const drawDone = () => {
      if (reviewing) doneBox.innerHTML = `<div class="hz-ask">${esc(t("hifz.review"))}${sep()}${esc(t("hifz.box", { n: reviewing.box + 1, total: INTERVALS.length }))}</div><div class="hz-btns"><button class="btn" id="hz-ok">${icon("check")} ${esc(t("hifz.reviewOk"))}</button><button class="btn ghost" id="hz-again">${icon("reset")} ${esc(t("hifz.reviewAgain"))}</button></div>`;
      else {
        const it = H.items.find(x => x.r === rid && x.s === s && x.a <= from && x.b >= to);
        doneBox.innerHTML = `<div class="hz-btns"><button class="btn ${known ? "ghost" : ""}" id="hz-learned">${icon("check")} ${esc(t("hifz.learned"))}</button></div>${it ? `<div class="hz-ask">${esc(t("hifz.nextReview", { when: whenText(it.due - dayNum()) }))}${sep()}${esc(t("hifz.box", { n: it.box + 1, total: INTERVALS.length }))}</div>` : ""}`;
      }
    };
    drawDone();
    doneBox.onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.id === "hz-learned") { learned(rid, s, from, to, ayat[from - 1][1], ayat[to - 1][1]); toast(t("hifz.learnedToast")); doneBox.classList.remove("ask"); drawDone(); return; }
      if (!reviewing) return;
      reviewed(reviewing, b.id === "hz-ok"); toast(t("hifz.reviewedToast", { next: t("hifz.nextReview", { when: whenText(reviewing.due - dayNum()) }) }));
      const more = due(null); if (more.length) location.hash = itemHref(more[0], true); else location.hash = "#/hifz";
    };
  }

  return {
    render(parts, params) { return parts.length >= 2 ? renderSegment(parts[0], Number(parts[1]), params || new URLSearchParams()) : renderHome(); },
    // For the reader: the memorised verses of a surah, to mark them.
    memorised,
    // For the Home page: today's memorisation beside the reading place, once memorising has begun.
    hubCard() {
      if (!H.items.length && !H.last) return "";
      const i = todayInfo(); const pct = Math.min(100, Math.round(i.done / Math.max(1, i.goal) * 100));
      const text = `${t(i.unit === "pages" ? "hifz.progressPages" : "hifz.progressAyat", { done: i.done, goal: i.goal })}${i.due ? sep() + t("hifz.dueCount", { n: i.due }) : ""}`;
      return `<a class="now" href="${i.due ? itemHref(due(null)[0], true) : "#/hifz"}">${icon("repeat")}<div><small>${esc(t("hifz.todayTitle"))}</small><b>${esc(text)}</b><div class="progress light"><div style="width:${pct}%"></div></div></div>${i.streak ? `<span class="pct">${esc(t("hifz.streak", { n: i.streak }))}</span>` : icon("back", "chev")}</a>`;
    },
  };
}
