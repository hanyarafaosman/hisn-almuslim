/* ===== التقويم الهجري ===== */
// The Hijri calendar of Umm al-Qura, as the browser's Intl gives it (the same calendar the prayer-times page shows),
// moved by the day adjustment the user sets when their country saw the new moon a day before or after it. Nothing is
// loaded: the month grid, the converter between the two calendars and the seasons of worship are all computed here.
// A Hijri date is turned into a Gregorian one by estimating with the mean lunar month, then correcting against Intl.

const DAY = 864e5;
// Days of worship fixed to the Hijri calendar: m = month, d = first day, to = last day (the 13th–15th of every month
// are the white days, added separately). "soft" ones (the six days of Shawwal) are not marked on the grid.
const EVENTS = [
  { m: 1, d: 1, k: "newYear" }, { m: 1, d: 9, k: "tasua" }, { m: 1, d: 10, k: "ashura", major: true },
  { m: 9, d: 1, k: "ramadan", major: true }, { m: 9, d: 21, to: 30, k: "lastTen" },
  { m: 10, d: 1, k: "fitr", major: true }, { m: 10, d: 2, to: 30, k: "sixShawwal", soft: true },
  { m: 12, d: 1, to: 10, k: "tenDhulHijjah" }, { m: 12, d: 8, k: "tarwiya" }, { m: 12, d: 9, k: "arafah", major: true },
  { m: 12, d: 10, k: "adha", major: true }, { m: 12, d: 11, to: 13, k: "tashriq" },
];
const SACRED = new Set([1, 7, 11, 12]);
const NO_FAST = new Set(["fitr", "adha", "tashriq"]); // days on which fasting is forbidden

export function setupHijri(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, share, SITE, setHeader, setNav, prayer } = ctx;
  const T = (k, p) => esc(t(k, p));
  const locale = () => getLang() === "ar" ? "ar-EG" : getLang();
  const adj = () => prayer.hijriAdj();

  // ---------- days ----------
  // A day is its noon in UTC, so every day is exactly DAY apart and Intl (told to use UTC) names it without surprises.
  const noon = (y, m, d) => Date.UTC(y, m - 1, d, 12);
  const today = () => { const x = new Date(); return noon(x.getFullYear(), x.getMonth() + 1, x.getDate()); };
  const weekday = ms => new Date(ms).getUTCDay(); // 0 Sunday … 6 Saturday
  const gregOf = ms => { const x = new Date(ms); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }; };
  let hFmt = null;
  const hijriRaw = ms => { // the Umm al-Qura date of a day, without the adjustment
    hFmt ??= new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
    const p = {}; hFmt.formatToParts(ms).forEach(x => { if (x.type !== "literal") p[x.type] = x.value; });
    return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
  };
  const hijriOf = ms => hijriRaw(ms + adj() * DAY);
  const cache = new Map();
  // The day on which a Hijri month begins (Umm al-Qura, no adjustment): a guess from the mean month, then corrected.
  function firstRaw(y, m) {
    const key = y * 12 + m; if (cache.has(key)) return cache.get(key);
    let ms = Date.UTC(622, 6, 19, 12) + Math.round((y - 1) * 354.36707 + (m - 1) * 29.530589) * DAY; // 1 Muharram 1 AH (Gregorian 19 July 622)
    for (let i = 0; i < 12; i++) {
      const h = hijriRaw(ms); const diff = (h.y - y) * 354.367 + (h.m - m) * 29.53 + (h.d - 1);
      if (!diff) break; ms -= Math.round(diff) * DAY || Math.sign(diff) * DAY;
    }
    cache.set(key, ms); return ms;
  }
  const nextMonth = (y, m) => m === 12 ? [y + 1, 1] : [y, m + 1];
  const prevMonth = (y, m) => m === 1 ? [y - 1, 12] : [y, m - 1];
  const lengthOf = (y, m) => Math.round((firstRaw(...nextMonth(y, m)) - firstRaw(y, m)) / DAY);
  // The day whose (adjusted) Hijri date is y/m/d, or null when the month is 29 days long and d is 30.
  const dayOf = (y, m, d) => d > lengthOf(y, m) ? null : firstRaw(y, m) + (d - 1) * DAY - adj() * DAY;

  // ---------- words ----------
  const formats = new Map();
  const fmt = (opts, cal = "") => {
    const key = locale() + cal + JSON.stringify(opts);
    if (!formats.has(key)) {
      let f; try { f = new Intl.DateTimeFormat(locale() + (cal ? "-u-ca-" + cal : ""), { ...opts, timeZone: "UTC" }); } catch { f = new Intl.DateTimeFormat(cal ? "en-u-ca-" + cal : "en", { ...opts, timeZone: "UTC" }); }
      formats.set(key, f);
    }
    return formats.get(key);
  };
  const UQ = "islamic-umalqura";
  // The adjusted Hijri date of a day in words: Intl is given the Umm al-Qura day that carries that date.
  const hijriText = (ms, opts = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) => fmt(opts, UQ).format(ms + adj() * DAY);
  const gregText = (ms, opts = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) => fmt(opts).format(ms);
  const monthTitle = (y, m) => fmt({ month: "long", year: "numeric" }, UQ).format(firstRaw(y, m));
  const monthName = (y, m) => fmt({ month: "long" }, UQ).format(firstRaw(y, m));
  const yearText = y => fmt({ year: "numeric" }, UQ).format(firstRaw(y, 1));
  // The Gregorian months a Hijri month spans, e.g. "October – November 2026".
  function gregSpan(y, m) {
    const a = dayOf(y, m, 1), b = dayOf(y, m, lengthOf(y, m)); const ga = gregOf(a), gb = gregOf(b);
    if (ga.m === gb.m) return fmt({ month: "long", year: "numeric" }).format(a);
    if (ga.y === gb.y) return `${fmt({ month: "long" }).format(a)} – ${fmt({ month: "long", year: "numeric" }).format(b)}`;
    return `${fmt({ month: "long", year: "numeric" }).format(a)} – ${fmt({ month: "long", year: "numeric" }).format(b)}`;
  }
  // The first day of the week where the user is (Saturday in Arabic, Monday or Sunday elsewhere), 0 = Sunday.
  function weekStart() {
    try { const l = new Intl.Locale(locale()); const w = l.getWeekInfo ? l.getWeekInfo() : l.weekInfo; if (w?.firstDay) return w.firstDay % 7; } catch { /* no weekInfo */ }
    return getLang() === "ar" ? 6 : 1;
  }
  const weekdayNames = () => { const f = fmt({ weekday: "short" }); const sun = Date.UTC(2023, 0, 1, 12); return [0, 1, 2, 3, 4, 5, 6].map(i => f.format(sun + i * DAY)); };
  const inDays = n => n === 0 ? t("prayer.today") : n === 1 ? t("hijri.tomorrow") : t("hijri.inDays", { n });

  // ---------- the seasons of worship ----------
  const eventsOn = h => EVENTS.filter(e => e.m === h.m && h.d >= e.d && h.d <= (e.to || e.d)).concat(h.d >= 13 && h.d <= 15 ? [{ k: "white", m: h.m, d: 13, to: 15 }] : []);
  const marked = h => eventsOn(h).filter(e => !e.soft);
  // The next occurrences of each season from a day on, for the list of what is coming.
  function upcoming(from, limit = 12) {
    const h = hijriOf(from); const out = []; let white = false; // the white days come every month: only the next ones are listed
    for (let y = h.y, m = h.m, i = 0; i < 14; i++) {
      for (const e of EVENTS.concat(white ? [] : [{ m, d: 13, to: 15, k: "white" }])) {
        if (e.m !== m || e.soft) continue;
        const start = dayOf(y, m, e.d); if (!start || start < from) continue;
        out.push({ e, y, m, start, days: Math.round((start - from) / DAY) }); if (e.k === "white") white = true;
      }
      [y, m] = nextMonth(y, m);
    }
    return out.sort((a, b) => a.start - b.start).slice(0, limit);
  }
  const evTitle = e => t("hijri.ev." + e.k);
  const evNote = e => t("hijri.ev." + e.k + "Note");
  function dayNotes(ms) {
    const h = hijriOf(ms), wd = weekday(ms), rows = [];
    for (const e of eventsOn(h)) rows.push({ ic: NO_FAST.has(e.k) ? "food" : e.k === "white" || e.k === "sixShawwal" || e.k === "tasua" || e.k === "ashura" || e.k === "arafah" ? "moon" : "star", title: evTitle(e), note: evNote(e) });
    if (wd === 5) rows.push({ ic: "kaaba", title: t("prayer.jumua"), note: t("hijri.fridayNote") });
    if ((wd === 1 || wd === 4) && !eventsOn(h).some(e => NO_FAST.has(e.k))) rows.push({ ic: "moon", title: t("hijri.monThu"), note: t("hijri.monThuNote") });
    if (SACRED.has(h.m)) rows.push({ ic: "book", title: t("hijri.sacredMonth"), note: t("hijri.sacredNote") });
    return rows;
  }

  // ---------- the page ----------
  let shown = null; // the month on the grid { y, m }
  let picked = null; // the day whose details are open
  const stale = hash => location.hash !== hash;
  function render(parts, params) {
    setNav("more"); const hash = location.hash;
    setHeader(t("hijri.title"), { back: true, actions: `<button class="icon-btn" id="hj-share" aria-label="${T("common.share")}">${icon("share")}</button>` });
    const now = today(), h = hijriOf(now);
    const y = Number(params.get("y")), m = Number(params.get("m"));
    shown = y >= 1000 && y <= 1700 && m >= 1 && m <= 12 ? { y, m } : { y: h.y, m: h.m };
    picked = null;
    view.innerHTML = `
      <section class="hero hj-hero">
        <small>${T("hijri.todayIs")}${adj() ? ` <span class="hj-badge">${T("hijri.adjusted")}</span>` : ""}</small>
        <h2 lang="${esc(locale())}">${esc(hijriText(now))}</h2>
        <p>${esc(gregText(now))}</p>
        ${todayLine(now)}
      </section>
      <div class="hj-nav">
        <button class="icon-btn" type="button" data-hj="-1" aria-label="${T("prayer.prevMonth")}">${icon("back", "dir")}</button>
        <button class="hj-title" type="button" id="hj-today" aria-label="${T("prayer.backToday")}"><b id="hj-month"></b><span id="hj-span"></span></button>
        <button class="icon-btn" type="button" data-hj="1" aria-label="${T("prayer.nextMonth")}">${icon("back", "flip")}</button>
      </div>
      <div class="hj-grid" id="hj-grid" role="grid"></div>
      <div id="hj-day"></div>
      <p class="source-note">${T("hijri.source")}</p>
      <h2 class="section-title">${T("hijri.convert")}</h2>
      <div class="card hj-conv" id="hj-conv">${convHtml(now)}</div>
      <h2 class="section-title">${T("hijri.upcoming")}</h2>
      <div class="list hj-up">${upcoming(now).map(u => `<a href="#/hijri?y=${u.y}&m=${u.m}" data-up="${u.start}"><div class="num">${icon(u.e.major ? "star" : "moon")}</div><div class="lbl">${esc(evTitle(u.e))}<span class="sub">${esc(hijriText(u.start, { weekday: "long", day: "numeric", month: "long" }))}${sep()}${esc(gregText(u.start, { day: "numeric", month: "long", year: "numeric" }))}</span></div><span class="hj-left">${esc(inDays(u.days))}</span></a>`).join("")}</div>
      <h2 class="section-title">${T("prayer.hijriAdjust")}</h2>
      <div class="card">
        <div class="setting"><span class="ic">${icon("moon")}</span><div class="lbl">${T("prayer.hijriAdjust")}<small>${T("hijri.adjustHint")}</small></div>
          <div class="stepper"><button class="icon-btn" type="button" data-adj="-1" aria-label="−">${icon("minus")}</button><span>${esc(num(adj() > 0 ? "+" + adj() : String(adj())))}</span><button class="icon-btn" type="button" data-adj="1" aria-label="+">${icon("plus")}</button></div></div>
      </div>`;
    $("#hj-share").onclick = () => share(t("hijri.title"), `${hijriText(now)}\n${gregText(now)}\n\n— ${t("app.name")}\n${SITE}#/hijri`);
    view.querySelectorAll("[data-hj]").forEach(b => b.onclick = () => {
      const [yy, mm] = Number(b.dataset.hj) > 0 ? nextMonth(shown.y, shown.m) : prevMonth(shown.y, shown.m);
      if (yy < 1000 || yy > 1700) return; shown = { y: yy, m: mm }; picked = null; drawGrid();
    });
    $("#hj-today").onclick = () => { const hh = hijriOf(today()); shown = { y: hh.y, m: hh.m }; picked = today(); drawGrid(); };
    view.querySelectorAll("[data-adj]").forEach(b => b.onclick = () => { prayer.setHijriAdj(adj() + Number(b.dataset.adj)); if (!stale(hash)) render(parts, params); });
    view.querySelectorAll("[data-up]").forEach(a => a.onclick = e => { e.preventDefault(); const ms = Number(a.dataset.up); const hh = hijriOf(ms); shown = { y: hh.y, m: hh.m }; picked = ms; drawGrid(); $("#hj-grid").scrollIntoView({ behavior: "smooth", block: "start" }); });
    bindConv();
    drawGrid();
  }
  // Under today's date: the seasons of today, or the next one coming.
  function todayLine(now) {
    const ev = marked(hijriOf(now));
    if (ev.length) return `<div class="hj-chips">${ev.map(e => `<span class="hj-chip">${icon("star")} ${esc(evTitle(e))}</span>`).join("")}</div>`;
    const nx = upcoming(now, 1)[0]; if (!nx) return "";
    return `<div class="hj-chips"><span class="hj-chip">${icon("moon")} ${esc(evTitle(nx.e))}${sep()}${esc(inDays(nx.days))}</span></div>`;
  }
  function drawGrid() {
    const { y, m } = shown; const first = dayOf(y, m, 1), len = lengthOf(y, m), now = today(), start = weekStart(), names = weekdayNames();
    $("#hj-month").textContent = monthTitle(y, m); $("#hj-span").textContent = gregSpan(y, m);
    const lead = (weekday(first) - start + 7) % 7; const cells = [];
    for (let i = 0; i < 7; i++) cells.push(`<div class="hj-wd${(start + i) % 7 === 5 ? " fri" : ""}" role="columnheader">${esc(names[(start + i) % 7])}</div>`);
    for (let i = 0; i < lead; i++) cells.push(`<div class="hj-cell out" aria-hidden="true"></div>`);
    let gm = -1;
    for (let d = 1; d <= len; d++) {
      const ms = first + (d - 1) * DAY, g = gregOf(ms), ev = marked({ y, m, d }), fri = weekday(ms) === 5;
      // The Gregorian day; its month is written once, where it changes.
      const gTxt = g.m !== gm ? fmt({ day: "numeric", month: "short" }).format(ms) : num(g.d); gm = g.m;
      cells.push(`<button type="button" role="gridcell" class="hj-cell${ms === now ? " today" : ""}${fri ? " fri" : ""}${ev.length ? " ev" : ""}${ev.some(e => e.major) ? " major" : ""}${ms === picked ? " on" : ""}" data-ms="${ms}" aria-label="${esc(hijriText(ms) + sep() + gregText(ms, { day: "numeric", month: "long", year: "numeric" }))}"><b>${esc(num(d))}</b><small>${esc(gTxt)}</small>${ev.length ? `<i></i>` : ""}</button>`);
    }
    const trail = (7 - (lead + len) % 7) % 7; for (let i = 0; i < trail; i++) cells.push(`<div class="hj-cell out" aria-hidden="true"></div>`);
    $("#hj-grid").innerHTML = cells.join("");
    view.querySelectorAll(".hj-cell[data-ms]").forEach(b => b.onclick = () => { picked = Number(b.dataset.ms); view.querySelectorAll(".hj-cell.on").forEach(x => x.classList.remove("on")); b.classList.add("on"); drawDay(); });
    drawDay();
  }
  function drawDay() {
    const box = $("#hj-day"); if (!box) return;
    if (picked == null) { box.innerHTML = ""; return; }
    const ms = picked, notes = dayNotes(ms), diff = Math.round((ms - today()) / DAY);
    box.innerHTML = `<div class="card hj-dayc">
      <div class="setting"><span class="ic">${icon("calendar")}</span><div class="lbl">${esc(hijriText(ms))}<small>${esc(gregText(ms))}</small></div>${diff === 0 ? `<span class="hj-tag">${T("prayer.today")}</span>` : diff > 0 ? `<span class="hj-tag">${esc(inDays(diff))}</span>` : ""}</div>
      ${notes.map(n => `<div class="setting"><span class="ic">${icon(n.ic)}</span><div class="lbl">${esc(n.title)}<small>${esc(n.note)}</small></div></div>`).join("")}
    </div>`;
  }

  // ---------- the converter ----------
  let conv = "g2h"; // which way
  const pad = n => String(n).padStart(2, "0");
  const iso = ms => { const g = gregOf(ms); return `${g.y}-${pad(g.m)}-${pad(g.d)}`; };
  function convHtml(now) {
    const h = hijriOf(now);
    return `<div class="setting wrap"><span class="ic">${icon("reset")}</span><div class="lbl">${T("hijri.convert")}</div><div class="segmented">
        <button type="button" data-conv="g2h" class="${conv === "g2h" ? "on" : ""}">${T("hijri.g2h")}</button><button type="button" data-conv="h2g" class="${conv === "h2g" ? "on" : ""}">${T("hijri.h2g")}</button></div></div>
      <div class="setting hj-in" data-for="g2h" ${conv !== "g2h" ? "hidden" : ""}><div class="lbl">${T("hijri.gregDate")}</div><input class="select hj-date" type="date" id="hj-g" value="${iso(now)}" min="1900-01-01" max="2200-12-31"></div>
      <div class="setting hj-in hj-hsel" data-for="h2g" ${conv !== "h2g" ? "hidden" : ""}><div class="lbl">${T("hijri.hijriDate")}</div>
        <select class="select" id="hj-d" aria-label="${T("hijri.day")}">${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}" ${i + 1 === h.d ? "selected" : ""}>${esc(num(i + 1))}</option>`).join("")}</select>
        <select class="select" id="hj-m" aria-label="${T("hijri.month")}">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === h.m ? "selected" : ""}>${esc(monthName(h.y, i + 1))}</option>`).join("")}</select>
        <input class="select hj-year" type="number" id="hj-y" inputmode="numeric" min="1300" max="1600" value="${h.y}" aria-label="${T("hijri.year")}"></div>
      <div class="setting hj-out"><span class="ic">${icon("calendar")}</span><div class="lbl" id="hj-res"></div><a class="btn ghost small" id="hj-go" href="#/hijri">${T("hijri.showInCalendar")}</a></div>`;
  }
  function bindConv() {
    const box = $("#hj-conv");
    box.querySelectorAll("[data-conv]").forEach(b => b.onclick = () => {
      conv = b.dataset.conv; box.querySelectorAll("[data-conv]").forEach(x => x.classList.toggle("on", x === b));
      box.querySelectorAll(".hj-in").forEach(x => { x.hidden = x.dataset.for !== conv; }); convert();
    });
    ["hj-g", "hj-d", "hj-m", "hj-y"].forEach(id => { const el = $("#" + id); el.oninput = convert; el.onchange = convert; });
    $("#hj-go").onclick = e => { e.preventDefault(); const ms = Number($("#hj-go").dataset.ms); if (!ms) return; const hh = hijriOf(ms); shown = { y: hh.y, m: hh.m }; picked = ms; drawGrid(); $("#hj-grid").scrollIntoView({ behavior: "smooth", block: "start" }); };
    convert();
  }
  function convert() {
    const res = $("#hj-res"), go = $("#hj-go"); let ms = null, text = "";
    if (conv === "g2h") {
      const [y, m, d] = String($("#hj-g").value || "").split("-").map(Number);
      if (y && m && d) { ms = noon(y, m, d); text = `<b>${esc(hijriText(ms))}</b><small>${esc(gregText(ms))}</small>`; }
    } else {
      const d = Number($("#hj-d").value), m = Number($("#hj-m").value), y = Number($("#hj-y").value);
      if (y >= 1000 && y <= 1700 && m && d) {
        ms = dayOf(y, m, d);
        text = ms ? `<b>${esc(gregText(ms))}</b><small>${esc(hijriText(ms))}</small>` : `<small>${T("hijri.noDay30", { month: monthName(y, m) })}</small>`;
      }
    }
    res.innerHTML = text || `<small>${T("hijri.pickDate")}</small>`;
    go.hidden = !ms; go.dataset.ms = ms || "";
  }

  // ---------- Home: today's date, a way to the calendar ----------
  const hubLine = () => { const now = today(); return `<a class="hub-date" href="#/hijri">${icon("calendar")}<span>${esc(hijriText(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</span><small>${esc(gregText(now, { day: "numeric", month: "long", year: "numeric" }))}</small></a>`; };

  return { render, hubLine, hijriText, todayDate: () => hijriText(today(), { day: "numeric", month: "long", year: "numeric" }) };
}
