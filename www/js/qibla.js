/* ===== اتجاه القبلة ===== */
// The direction of the Kaaba from the place the prayer-times page knows (js/prayer.js: GPS, a city, or typed
// coordinates), computed on the device along the great circle: nothing is loaded. A compass drawn from the phone's
// orientation sensor shows where the phone points and where the Kaaba is, and says when the two meet. Where there is
// no compass (a desktop, a browser without the sensor), the drawing keeps north up and the sun gives the direction:
// the times today when the sun stands in the direction of the Qibla or shadows point to it, and the two days a year
// when the sun is right over the Kaaba. No correction is made for magnetic declination: it is a few degrees in most
// countries, within what a phone compass can tell anyway, and the page says so.
import { sunPosition } from "./prayer-calc.js?v=1.35.1";

export const KAABA = { lat: 21.422487, lng: 39.826206 };
const D = Math.PI / 180;
const sin = x => Math.sin(x * D), cos = x => Math.cos(x * D), tan = x => Math.tan(x * D);
const fix = (a, b) => ((a % b) + b) % b;
// The smallest turn from heading a to heading b: -180 … 180, positive clockwise.
const turn = (a, b) => fix(b - a + 180, 360) - 180;

// The initial bearing of the great circle from a place to the Kaaba (degrees clockwise from north) and its length (km).
export function qiblaOf(lat, lng) {
  const dl = KAABA.lng - lng;
  const bearing = fix(Math.atan2(sin(dl), cos(lat) * tan(KAABA.lat) - sin(lat) * cos(dl)) / D, 360);
  const a = sin((KAABA.lat - lat) / 2) ** 2 + cos(lat) * cos(KAABA.lat) * sin(dl / 2) ** 2;
  return { bearing, km: 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a))) };
}

export function setupQibla(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, toast, setHeader, setNav, share, SITE, vibrate, prayer } = ctx;
  const T = (k, p) => esc(t(k, p));
  const locale = () => getLang() === "ar" ? "ar-EG" : getLang();
  const deg = x => t("qibla.deg", { n: num(Math.round(fix(x, 360))) });
  const DIRS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  const dirName = b => t("qibla.dir." + DIRS[Math.round(fix(b, 360) / 45) % 8]);
  const placeName = loc => [loc.name, loc.region].filter(Boolean).join(sep());

  // ---------- the time at the place ----------
  const zoneOk = z => { try { new Intl.DateTimeFormat("en-US", { timeZone: z }); return true; } catch { return false; } };
  const zoneOf = loc => loc?.tz && zoneOk(loc.tz) ? loc.tz : (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const partsFmt = new Map();
  function parts(ms, tz) {
    if (!partsFmt.has(tz)) partsFmt.set(tz, new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }));
    const p = {}; partsFmt.get(tz).formatToParts(ms).forEach(x => { if (x.type !== "literal") p[x.type] = Number(x.value); });
    return p;
  }
  const offsetMs = (ms, tz) => { const p = parts(ms, tz); return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000; };
  // Midnight at the place, the start of the calendar day a moment falls in.
  function dayStart(ms, tz) {
    const o = offsetMs(ms, tz), p = parts(ms, tz);
    let s = Date.UTC(p.year, p.month - 1, p.day) - o;
    s -= offsetMs(s, tz) - o; // a DST change between midnight and now
    return s;
  }
  const clock = (ms, tz) => new Intl.DateTimeFormat(locale(), { hour: "numeric", minute: "2-digit", timeZone: tz }).format(ms);
  const dateText = (ms, tz) => new Intl.DateTimeFormat(locale(), { day: "numeric", month: "long", timeZone: tz }).format(ms);

  // ---------- the sun ----------
  // The moments today when the sun's azimuth crosses a bearing while the sun is up, to the minute.
  function sunCrossings(loc, bearing, tz) {
    const start = dayStart(Date.now(), tz), out = [];
    let prev = null;
    for (let i = 0; i <= 24 * 60; i += 2) {
      const ms = start + i * 60000, s = sunPosition(ms, loc.lat, loc.lng), d = turn(bearing, s.azimuth);
      if (prev && s.altitude > 0 && prev.altitude > 0 && Math.sign(d) !== Math.sign(prev.d) && Math.abs(d - prev.d) < 90) {
        out.push(ms - 2 * 60000 * (d / (d - prev.d))); // linear between the two minutes
      }
      prev = { d, altitude: s.altitude };
    }
    return out;
  }
  // The sun stands over the Kaaba twice a year, at 12:18 and 12:27 Makkah time (09:18 and 09:27 UTC): on 28 May and
  // 16 July, a day earlier in leap years. The next two such moments at which the sun is up at the place.
  function overKaaba(loc) {
    const y = new Date().getUTCFullYear(), out = [];
    for (const yy of [y, y + 1]) {
      const leap = (yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0;
      for (const [m, d, h, mi] of [[4, leap ? 27 : 28, 9, 18], [6, leap ? 15 : 16, 9, 27]]) out.push(Date.UTC(yy, m, d, h, mi));
    }
    return out.filter(ms => ms > Date.now()).slice(0, 2).map(ms => ({ ms, up: sunPosition(ms, loc.lat, loc.lng).altitude > 0 }));
  }

  // ---------- the compass ----------
  let listening = null; // { type, fn } while the sensor is being read
  let heading = null; // where the phone points, degrees clockwise from north, smoothed
  let rot = 0; // the dial's rotation, continuous (no jump from 359° to 0°)
  let gotEvent = false, aligned = false, waitTimer = 0, asked = false; // asked: the user tapped the button and was allowed
  const hasSensor = () => "DeviceOrientationEvent" in window;
  const needsAsk = () => hasSensor() && typeof DeviceOrientationEvent.requestPermission === "function"; // iOS 13+: only from a tap
  const screenAngle = () => (screen.orientation?.angle ?? window.orientation ?? 0) || 0;
  function onOrient(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === "number" && Number.isFinite(e.webkitCompassHeading)) h = e.webkitCompassHeading; // iOS
    else if (e.alpha != null && (e.absolute || e.type === "deviceorientationabsolute")) h = 360 - e.alpha; // Android
    if (h == null) return;
    h = fix(h + screenAngle(), 360);
    if (!gotEvent) { gotEvent = true; clearTimeout(waitTimer); heading = h; $("#qb-start")?.remove(); $("#qb-nocompass")?.remove(); }
    else heading = fix(heading + turn(heading, h) * 0.3, 360); // a low-pass filter against the sensor's jitter
    draw();
  }
  function listen() {
    if (listening || !hasSensor()) return;
    const type = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
    listening = { type, fn: onOrient }; window.addEventListener(type, onOrient);
    // No reading in a few seconds: there is no compass, unless the page is still waiting for the user's permission.
    waitTimer = setTimeout(() => { if (!gotEvent && (asked || !needsAsk())) noCompass(); }, 3000);
  }
  function stop() {
    if (listening) window.removeEventListener(listening.type, listening.fn);
    listening = null; heading = null; gotEvent = false; aligned = false; clearTimeout(waitTimer);
  }
  async function start() {
    if (needsAsk()) {
      let r = "denied"; try { r = await DeviceOrientationEvent.requestPermission(); } catch { /* not from a tap */ }
      if (r !== "granted") { toast(t("qibla.compassDenied")); return; }
    }
    asked = true; stop(); listen();
  }
  function noCompass() {
    const box = $("#qb-state"); if (!box || $("#qb-nocompass")) return;
    $("#qb-start")?.remove();
    box.insertAdjacentHTML("afterend", `<p class="qb-note" id="qb-nocompass">${T("qibla.noCompass")}</p>`);
  }
  // The dial turns so its north points north; the Kaaba mark turns with it. The pointer at the top is the phone.
  function draw() {
    const dial = $("#qb-dial"), state = $("#qb-state"), box = $("#qb-compass"); if (!dial || heading == null) return;
    rot -= turn(fix(-rot, 360), heading); // the dial shows heading -rot now; the shortest way round to the new one
    dial.style.transform = `rotate(${rot}deg)`;
    const d = turn(heading, current.bearing), on = Math.abs(d) <= 3;
    box.classList.toggle("on", on);
    state.innerHTML = on ? `<b>${T("qibla.aligned")}</b>` : `<b>${T(d > 0 ? "qibla.turnRight" : "qibla.turnLeft", { n: num(Math.round(Math.abs(d))) })}</b><small>${T("qibla.heading")}${sep()}${esc(deg(heading))}</small>`;
    if (on && !aligned) vibrate(40);
    aligned = on;
  }
  // Nothing is read while another page is open or the app is in the background.
  const onPage = () => /^#\/qibla\/?(\?|$)/.test(location.hash);
  window.addEventListener("hashchange", () => { if (!onPage()) stop(); });
  document.addEventListener("visibilitychange", () => { if (!onPage()) return; if (document.visibilityState === "hidden") stop(); else listen(); });

  // ---------- the page ----------
  let current = null; // { bearing, km } of the place shown
  function dialSvg(bearing) {
    const ticks = []; for (let a = 0; a < 360; a += 5) { const big = a % 90 === 0, mid = a % 30 === 0; ticks.push(`<line x1="150" y1="${big ? 22 : mid ? 26 : 30}" x2="150" y2="36" transform="rotate(${a} 150 150)" class="${big ? "big" : mid ? "mid" : ""}"/>`); }
    // The letters stay upright on the dial (turned back around their own spot).
    const letters = [["N", 0], ["E", 90], ["S", 180], ["W", 270]].map(([k, a]) => `<text x="150" y="58" transform="rotate(${a} 150 150) rotate(${-a} 150 58)" class="${k === "N" ? "north" : ""}">${T("qibla." + k)}</text>`);
    return `<svg viewBox="0 0 300 300" aria-hidden="true">
      <g class="qb-dial" id="qb-dial">
        <circle cx="150" cy="150" r="136" class="qb-ring"/>
        <g class="qb-ticks">${ticks.join("")}</g>
        <g class="qb-letters">${letters.join("")}</g>
        <g transform="rotate(${bearing} 150 150)" class="qb-kaaba">
          <line x1="150" y1="150" x2="150" y2="78"/>
          <circle cx="150" cy="106" r="20"/>
          <use href="#i-kaaba" x="137" y="93" width="26" height="26"/>
        </g>
        <circle cx="150" cy="150" r="5" class="qb-center"/>
      </g>
      <path d="M150 4l9 16h-18z" class="qb-pointer"/>
    </svg>`;
  }
  function render() {
    setNav("more"); stop();
    const loc = prayer.loc();
    setHeader(t("qibla.title"), { back: true, actions: loc ? `<button class="icon-btn" id="qb-share" aria-label="${T("common.share")}">${icon("share")}</button>` : "" });
    if (!loc) {
      current = null;
      view.innerHTML = `<section class="hero qb-hero"><div class="qb-ic">${icon("kaaba")}</div><h2>${T("qibla.title")}</h2><p>${T("qibla.setLocation")}</p>
        <div class="quick"><button class="btn block" id="qb-loc" type="button">${icon("pin")} ${T("prayer.location")}</button></div></section>
        <p class="source-note">${T("qibla.source")}</p>`;
      $("#qb-loc").onclick = () => prayer.pickPlace(render);
      return;
    }
    current = qiblaOf(loc.lat, loc.lng);
    const tz = zoneOf(loc), { bearing, km } = current;
    const facing = sunCrossings(loc, bearing, tz), shadow = sunCrossings(loc, bearing + 180, tz), over = overKaaba(loc).filter(x => x.up);
    const sunRows = [
      ...facing.map(ms => ({ ic: "sun", title: t("qibla.sunFacing"), note: clock(ms, tz) })),
      ...shadow.map(ms => ({ ic: "dusk", title: t("qibla.sunShadow"), note: clock(ms, tz) })),
    ];
    view.innerHTML = `
      <section class="hero qb-hero">
        <button class="pr-place" id="qb-loc" type="button">${icon("pin")}<span dir="auto">${esc(placeName(loc))}</span><small>${T("common.change")}</small></button>
        <div class="qb-deg">${esc(deg(bearing))}</div>
        <div class="qb-dir">${esc(dirName(bearing))}${sep()}${T("qibla.fromNorth")}</div>
        <small class="qb-km">${T("qibla.distance", { km: num(Math.round(km)) })}</small>
      </section>
      <div class="card qb-card">
        <div class="qb-compass" id="qb-compass">${dialSvg(bearing)}</div>
        <div class="qb-state" id="qb-state"><b>${T("qibla.turnTo")}</b></div>
        ${hasSensor() ? (needsAsk() ? `<button class="btn block" id="qb-start" type="button">${icon("compass")} ${T("qibla.startCompass")}</button>` : "") : `<p class="qb-note" id="qb-nocompass">${T("qibla.noCompass")}</p>`}
        <p class="qb-note">${T("qibla.calibrate")}</p>
      </div>
      <h2 class="section-title">${T("qibla.bySun")}</h2>
      <div class="card">
        <div class="setting"><div class="lbl"><small>${T("qibla.sunHint")}</small></div></div>
        ${sunRows.length ? sunRows.map(r => `<div class="setting"><span class="ic">${icon(r.ic)}</span><div class="lbl">${esc(r.title)}</div><span class="qb-time">${esc(r.note)}</span></div>`).join("") : `<div class="setting"><span class="ic">${icon("sun")}</span><div class="lbl"><small>${T("qibla.sunNone")}</small></div></div>`}
        ${over.length ? `<div class="setting"><span class="ic">${icon("kaaba")}</span><div class="lbl">${T("qibla.overKaaba")}<small>${T("qibla.overKaabaNote", { dates: over.map(x => `${dateText(x.ms, tz)} ${t("qibla.makkahTime", { time: clock(x.ms, "Asia/Riyadh") })} (${t("qibla.yourTime", { time: clock(x.ms, tz) })})`).join(sep()) })}</small></div></div>` : ""}
      </div>
      <p class="source-note">${T("qibla.source")}</p>`;
    $("#qb-loc").onclick = () => prayer.pickPlace(render);
    $("#qb-share").onclick = () => share(t("qibla.title"), `${t("qibla.shareText", { place: placeName(loc), deg: deg(bearing), dir: dirName(bearing) })}\n${t("qibla.distance", { km: num(Math.round(km)) })}\n\n— ${t("app.name")}\n${SITE}#/qibla`);
    // Readings are tried at once; where the browser wants the user's permission first (iOS), the button asks for it,
    // and goes away with the first reading (some browsers have the permission call yet need no asking).
    const startBtn = $("#qb-start"); if (startBtn) startBtn.onclick = start;
    if (hasSensor()) listen();
  }

  return { render, qiblaOf };
}
