/* ===== مواقيت الصلاة والتنبيهات والأذان ===== */
// The times are calculated on the device (js/prayer-calc.js) for a place the user picks: their GPS position (named by
// OpenStreetMap Nominatim) or a city from Open-Meteo's geocoding search (GeoNames data, with each city's time zone).
// Alerts: a reminder some minutes before each prayer, then at its time a notification and the adhan: a recording from
// adhan/index.json (Wikimedia Commons and archive.org, scripts/build-adhan.js) or an audio file the user chose (kept in
// ADHAN_CACHE).
// A web page runs only while the browser keeps it alive, so these alerts come while the app is open or was recently
// in the background. When the app is closed, the server in push/ sends the same alerts by Web Push (syncPush below,
// the push handler in sw.js); the page explains both to the user. The alerts are on unless the user turns them off:
// on a phone, a window asks for the place and the notifications permission a moment after the app first starts.
import { METHODS, PRAYERS, prayerTimes, nextDay, methodFor, asrFor, countryOfZone } from "./prayer-calc.js?v=1.27.0";

export const ADHAN_CACHE = "hisn-adhan-v1"; // the same name is in sw.js

export function setupPrayer(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, LS, toast, setHeader, setNav, share, SITE } = ctx;
  const T = (k, p) => esc(t(k, p));
  const FIVE = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  const ICONS = { fajr: "fajr", sunrise: "dawn", dhuhr: "sun", asr: "asr", maghrib: "dusk", isha: "moon" };
  const MODES = ["off", "notify", "adhan"]; // a tap on a prayer's bell goes to the next one
  const MODE_ICON = { off: "bell-off", notify: "bell", adhan: "volume" };
  const BEFORE = [0, 5, 10, 15, 20, 30, 45];
  const DEF = {
    loc: null, method: "auto", asr: "auto", high: "angle", adj: {}, hijriAdj: 0,
    alerts: true, off: false, before: 15, short: false, voice: "madinah", fajrVoice: "malmo-fajr", customName: "", // off: the user turned the alerts off
    mode: { fajr: "adhan", sunrise: "off", dhuhr: "adhan", asr: "adhan", maghrib: "adhan", isha: "adhan" },
  };
  const stored = LS.get("prayer", {});
  const state = { ...DEF, ...stored, mode: { ...DEF.mode, ...stored.mode }, adj: { ...stored.adj } };
  const memo = new Map();
  const save = () => { LS.set("prayer", state); memo.clear(); schedule(); syncPush(); };

  // ---------- place, time zone, formats ----------
  const deviceZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
  const zone = () => state.loc?.tz || deviceZone();
  const locale = () => getLang() === "ar" ? "ar-EG" : getLang();
  const formats = new Map();
  const fmt = (opts, cal = "") => {
    const key = locale() + cal + zone() + JSON.stringify(opts);
    if (!formats.has(key)) {
      const loc = locale() + (cal ? "-u-ca-" + cal : "");
      let f; try { f = new Intl.DateTimeFormat(loc, { ...opts, timeZone: zone() }); } catch { f = new Intl.DateTimeFormat(loc, opts); }
      formats.set(key, f);
    }
    return formats.get(key);
  };
  const clock = ms => ms == null ? "—" : fmt({ hour: "numeric", minute: "2-digit" }).format(ms);
  // Without "AM/PM", for the month table where the column already says which prayer it is.
  const clockBare = ms => ms == null ? "—" : fmt({ hour: "numeric", minute: "2-digit" }).formatToParts(ms).filter(p => p.type !== "dayPeriod").map(p => p.value).join("").trim();
  const dateLabel = ms => fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(ms);
  const hijri = (ms, opts = { day: "numeric", month: "long", year: "numeric" }) => { try { return fmt(opts, "islamic-umalqura").format(ms + state.hijriAdj * 864e5); } catch { return ""; } };
  // The calendar day of a moment at the chosen place.
  let dayFmt = null;
  function dayOf(ms) {
    if (dayFmt?.zone !== zone()) { let f; try { f = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "numeric", day: "numeric", timeZone: zone() }); } catch { f = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "numeric", day: "numeric" }); } dayFmt = { zone: zone(), f }; }
    const p = {}; dayFmt.f.formatToParts(ms).forEach(x => { p[x.type] = Number(x.value); });
    return { y: p.year, m: p.month, d: p.day };
  }
  const same = (a, b) => a && b && a.y === b.y && a.m === b.m && a.d === b.d;
  const isFriday = day => new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay() === 5;
  const pname = (p, day) => p === "dhuhr" && day && isFriday(day) ? t("prayer.jumua") : t("prayer." + p);
  const placeName = () => state.loc ? [state.loc.name, state.loc.region].filter(Boolean).join(sep()) : "";
  // Time left as h:mm:ss (or h:mm), digit by digit so the zeros that pad the minutes and seconds stay.
  const left = (ms, seconds = true) => {
    const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    const text = seconds ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${h}:${String(m).padStart(2, "0")}`;
    return text.replace(/\d/g, d => num(Number(d)));
  };

  // ---------- the times ----------
  const method = () => state.method === "auto" || !METHODS[state.method] ? methodFor(state.loc?.cc) : state.method;
  const asrMode = () => state.asr === "auto" ? asrFor(state.loc?.cc) : state.asr;
  // The place to two decimals (about a kilometre, a few seconds of the times): what the alerts server is sent, so the
  // page and a notification from the server always show the same minute.
  const round2 = x => Math.round(x * 100) / 100;
  const place = () => ({ lat: round2(state.loc.lat), lng: round2(state.loc.lng) });
  function timesOn(day) {
    const k = `${day.y}-${day.m}-${day.d}`;
    if (!memo.has(k)) memo.set(k, prayerTimes(day, place(), { method: method(), asr: asrMode(), high: state.high, adj: state.adj, hijriAdj: state.hijriAdj }));
    return memo.get(k);
  }
  // The next of the five prayers after a moment.
  function upcoming(now) {
    const today = dayOf(now);
    for (const day of [today, nextDay(today)]) { const x = timesOn(day); for (const p of FIVE) if (x[p] != null && x[p] > now) return { p, at: x[p], day }; }
    return null;
  }
  // The prayer whose time it is now (none between sunrise and Dhuhr).
  function current(now) {
    const today = dayOf(now), x = timesOn(today);
    if (x.fajr != null && now < x.fajr) return null; // still last night's Isha: not shown on today's list
    const past = PRAYERS.filter(p => x[p] != null && x[p] <= now).pop();
    return past === "sunrise" ? null : past || null;
  }
  // Midnight and the last third of the night, from Maghrib to the next Fajr.
  function night(day) {
    const a = timesOn(day).maghrib, b = timesOn(nextDay(day)).fajr;
    return a == null || b == null ? null : { mid: a + (b - a) / 2, third: a + (b - a) * 2 / 3 };
  }
  const methodName = id => t("prayer.m." + id);
  function methodSub(id) {
    const m = METHODS[id];
    return m.ishaMin ? t("prayer.anglesMin", { fajr: m.fajr, n: m.ishaMin }) : t("prayer.angles", { fajr: m.fajr, isha: m.isha });
  }

  // ---------- adhan recordings ----------
  let VOICES = [];
  const voicesReady = fetch("adhan/index.json").then(r => r.ok ? r.json() : { voices: [] }).then(j => { VOICES = j.voices || []; }).catch(() => {});
  const voiceName = id => id === "custom" ? (state.customName || t("prayer.v.custom")) : id === "same" ? t("prayer.sameVoice") : t("prayer.v." + id);
  const voiceFor = p => p === "fajr" && state.fajrVoice !== "same" ? state.fajrVoice : state.voice;
  const voiceMeta = id => VOICES.find(v => v.id === id) || VOICES.find(v => v.id === DEF.voice);
  let objectUrl = null;
  async function voiceSrc(id) {
    if (id === "custom") {
      const r = await caches.open(ADHAN_CACHE).then(c => c.match("adhan/custom")).catch(() => null);
      if (r) { if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = URL.createObjectURL(await r.blob()); return objectUrl; }
      id = DEF.voice; // the file is gone: the default recording
    }
    await voicesReady; return voiceMeta(id)?.file || null;
  }
  // Keep the chosen recordings on the device, so the adhan plays without a connection.
  async function keepVoices() {
    await voicesReady;
    const files = [...new Set([state.voice, state.fajrVoice].map(id => VOICES.find(v => v.id === id)?.file).filter(Boolean))];
    try { const c = await caches.open(ADHAN_CACHE); for (const f of files) if (!(await c.match(f))) await c.add(f); } catch { /* offline: tried again later */ }
  }

  const audio = new Audio(); audio.preload = "none";
  let stopAt = null, fading = null, preview = false;
  // Phones only let a page start sound by itself on an element the user once started: play it silently inside a tap
  // (not while a recitation or a dhikr plays, which a phone could pause for it).
  let unlocked = false;
  function unlock() {
    if (unlocked || !state.alerts || !state.loc || !audio.paused) return;
    if (["audio", "qaudio"].some(id => document.getElementById(id)?.paused === false)) return;
    const v = voiceMeta(DEF.voice); if (!v) return;
    unlocked = true; audio.muted = true; audio.src = v.file;
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => { unlocked = false; }).finally(() => { audio.muted = false; });
  }
  document.addEventListener("pointerdown", unlock, { capture: true });

  function stopAdhan() {
    clearInterval(fading); fading = null; stopAt = null; preview = false;
    if (!audio.paused) audio.pause(); audio.volume = 1;
    const bar = document.getElementById("adhan-bar"); if (bar) { bar.dataset.playing = "0"; drawBar(); }
    document.querySelectorAll("[data-play].on").forEach(b => { b.classList.remove("on"); b.innerHTML = icon("play"); });
  }
  // Short adhan: the volume falls over a second and a half from the end of the four takbirs.
  audio.addEventListener("timeupdate", () => {
    if (stopAt == null || audio.currentTime < stopAt || fading) return;
    fading = setInterval(() => { audio.volume = Math.max(0, audio.volume - 0.1); if (audio.volume <= 0.01) stopAdhan(); }, 150);
  });
  audio.addEventListener("ended", stopAdhan);
  // The pause button on the lock screen stops the adhan while it plays; otherwise it pauses the recitation, as before.
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("pause", () => { if (!audio.paused) stopAdhan(); else document.getElementById("qaudio")?.pause(); });
      navigator.mediaSession.setActionHandler("stop", () => { if (!audio.paused) stopAdhan(); else document.getElementById("qaudio")?.pause(); });
    } catch { /* unsupported action */ }
  }
  async function play(id, { short = false, label = "" } = {}) {
    stopAdhan();
    const src = await voiceSrc(id); if (!src) return false;
    document.getElementById("audio")?.pause(); document.getElementById("qaudio")?.pause();
    audio.src = src; audio.volume = 1; audio.muted = false;
    stopAt = short ? (voiceMeta(id)?.short || null) : null;
    if (id === "custom" && short) stopAt = 30;
    if ("mediaSession" in navigator && label) navigator.mediaSession.metadata = new MediaMetadata({ title: label, artist: voiceName(id), album: t("app.name"), artwork: [{ src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }] });
    try { await audio.play(); return true; } catch { return false; }
  }

  // ---------- the adhan bar (shown at prayer time) ----------
  let barInfo = null;
  function drawBar() {
    const bar = document.getElementById("adhan-bar"); if (!bar || !barInfo) return;
    const playing = bar.dataset.playing === "1", { p, at, canPlay } = barInfo;
    bar.innerHTML = `${icon(ICONS[p])}<div class="ab-t"><b>${p === "sunrise" ? T("prayer.sunriseNow") : T("prayer.nowTitle", { name: barInfo.name })}</b><small>${esc(clock(at))}${state.loc ? esc(sep() + state.loc.name) : ""}</small></div>
      ${!playing && canPlay ? `<button class="btn" id="ab-play" type="button">${icon("play")} ${T("prayer.playAdhan")}</button>` : ""}
      ${p !== "sunrise" ? `<a class="btn ghost" href="#/cat/15" id="ab-dua">${T("prayer.duaAfter")}</a>` : ""}
      <button class="icon-btn" id="ab-x" type="button" aria-label="${T(playing ? "prayer.stopAdhan" : "common.close")}">${icon(playing ? "pause" : "close")}</button>`;
    const pb = bar.querySelector("#ab-play"); if (pb) pb.onclick = async () => { if (await play(voiceFor(p), { short: state.short, label: barInfo.name })) { bar.dataset.playing = "1"; drawBar(); } };
    bar.querySelector("#ab-x").onclick = () => { if (playing) { stopAdhan(); } else { bar.remove(); barInfo = null; } };
  }
  function showBar(info, playing) {
    barInfo = info;
    let bar = document.getElementById("adhan-bar");
    if (!bar) { bar = document.createElement("div"); bar.id = "adhan-bar"; bar.className = "adhan-bar"; bar.setAttribute("role", "status"); document.body.append(bar); }
    bar.dataset.playing = playing ? "1" : "0"; drawBar();
  }

  // ---------- notifications ----------
  const notifSupported = () => "Notification" in window;
  // at, kind ("before" or "now"): which alert this is, the same as in a notification from the server (sw.js).
  async function notify(title, body, { adhan = false, at, kind } = {}) {
    if (!notifSupported() || Notification.permission !== "granted") return;
    const opts = { body, icon: "icons/icon-192.png", tag: "prayer", renotify: true, silent: adhan, lang: getLang(), dir: "auto", data: { url: "#/prayer", at, kind },
      ...(adhan ? { actions: [{ action: "stop", title: t("prayer.stopAdhan") }] } : {}) };
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        // The server's notification of this alert came first: no second one, or, while the adhan plays, the same one
        // again without a sound so it gets the stop button.
        if (at && (await reg.getNotifications({ tag: "prayer" })).some(n => n.data?.at === at && n.data?.kind === kind)) { if (!adhan) return; opts.renotify = false; }
        await reg.showNotification(title, opts); return;
      }
    } catch { /* below */ }
    try { delete opts.actions; const n = new Notification(title, opts); n.onclick = () => { window.focus(); location.hash = "#/prayer"; n.close(); }; } catch { /* Android without a service worker */ }
  }

  // ---------- alerts while the app is closed (Web Push) ----------
  // The server in push/ (a Cloudflare Worker) keeps this device's push subscription with the place rounded to 0.01°,
  // the time zone, the calculation settings, the alert of each prayer and the language, works out the same times with
  // js/prayer-calc.js, and sends a short message at each alert; sw.js shows it. All of it is deleted when the alerts
  // are turned off. The key is the public half of the server's VAPID key pair (push/keys.js writes it here).
  const PUSH = { url: "https://hisn-push.hisn-push.workers.dev", key: "BGQvUdsL6dHUgFHDO32QvfoYy2tCmPIy3FU0S-FeRYxeh7vkYC_ykBKGlzLEDtZ9DNkRGmnripdu_IMNVzJ9GyA" };
  // On the local dev server, a test server can be set in the console: localStorage.pushServer = JSON.stringify({ url, key }).
  const pushServer = () => { const dev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && LS.get("pushServer", null); return dev?.url && dev.key ? dev : PUSH; };
  let pushState = LS.get("prayerPush", null) ? "on" : ""; // on | unsupported | failed | "" (not asked for)
  let pushTimer = null, pushQueue = Promise.resolve();
  function syncPush(delay = 1500) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushQueue = pushQueue.then(pushNow).catch(() => setPushState("failed")); }, delay);
  }
  function setPushState(s) {
    if (s === pushState) return; pushState = s;
    if (/^#\/prayer\/?$/.test(location.hash) && !document.getElementById("sheet")) redraw(); // the note under "Alerts are on"
  }
  const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64u = text => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const pushSettings = () => ({ lat: place().lat, lng: place().lng, tz: zone(), method: method(), asr: asrMode(), high: state.high, adj: state.adj, hijriAdj: state.hijriAdj, mode: state.mode, before: state.before, lang: getLang() });
  async function pushNow() {
    const srv = pushServer(), rec = LS.get("prayerPush", null);
    // The service worker once it is active (none on the local dev server without ?sw).
    const reg = "serviceWorker" in navigator ? await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 10000))]) : null;
    const pm = srv.url && "PushManager" in window ? reg?.pushManager : null;
    let sub = pm ? await pm.getSubscription().catch(() => null) : null;
    if (!(state.alerts && state.loc && pm && notifSupported() && Notification.permission === "granted")) {
      // Alerts off, or no way to get them while closed: the server forgets this device. An ended subscription is
      // also dropped by the server at its next message, should this request not reach it.
      if (rec || sub) {
        const url = rec?.url || srv.url;
        if (url) await fetch(url + "/unsubscribe", { method: "DELETE", body: JSON.stringify({ endpoint: sub?.endpoint || rec.endpoint }) }).catch(() => {});
        await sub?.unsubscribe().catch(() => {});
        LS.set("prayerPush", null);
      }
      await keepInfo(null);
      return setPushState(state.alerts && srv.url && notifSupported() && Notification.permission === "granted" && !pm ? "unsupported" : "");
    }
    // A subscription made with another server key cannot be used: make a new one.
    if (sub && sub.options?.applicationServerKey && b64u(sub.options.applicationServerKey) !== srv.key) { await sub.unsubscribe().catch(() => {}); sub = null; }
    if (!sub) sub = await pm.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(srv.key) });
    const settings = pushSettings(), sent = JSON.stringify({ url: srv.url, sub: sub.toJSON(), settings });
    // Sent when something changed, and once a day anyway (the server may have dropped this device).
    if (rec?.sent !== sent || !(Date.now() - rec.at < 864e5)) {
      const old = rec?.endpoint && rec.endpoint !== sub.endpoint ? rec.endpoint : undefined;
      const r = await fetch(srv.url + "/subscribe", { method: "POST", body: JSON.stringify({ sub: sub.toJSON(), settings, old }) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      LS.set("prayerPush", { url: srv.url, endpoint: sub.endpoint, sent, at: Date.now() });
    }
    await keepInfo({ url: srv.url, key: srv.key, endpoint: sub.endpoint, settings });
    setPushState("on");
  }
  // What sw.js needs to word a notification (and to subscribe again by itself): kept in the adhan cache.
  async function keepInfo(push) {
    const info = { lang: getLang(), tz: zone(), name: state.loc?.name || "", push };
    try { await (await caches.open(ADHAN_CACHE)).put("prayer/push.json", new Response(JSON.stringify(info), { headers: { "content-type": "application/json" } })); } catch { /* no cache storage */ }
  }

  // ---------- alerts: what is due and when ----------
  // How late an alert is still given (a device waking from sleep): the notice of the prayer, and the adhan's sound.
  const GRACE = { notice: 10 * 60000, sound: 3 * 60000 };
  function events(from, to) {
    const out = [];
    if (!state.loc || !state.alerts) return out;
    for (let day = dayOf(from - 864e5), i = 0; i < 4; i++, day = nextDay(day)) {
      const x = timesOn(day);
      for (const p of PRAYERS) {
        const mode = state.mode[p], at = x[p]; if (mode === "off" || at == null) continue;
        out.push({ p, day, at, kind: mode });
        if (state.before && p !== "sunrise") out.push({ p, day, at: at - state.before * 60000, kind: "before", prayerAt: at });
      }
    }
    return out.filter(e => e.at >= from && e.at <= to).sort((a, b) => a.at - b.at);
  }
  const keyOf = e => `${e.p}:${e.at}:${e.kind}`;
  let timer = null;
  function schedule() {
    clearTimeout(timer); timer = null;
    if (!state.alerts || !state.loc) return;
    const now = Date.now(), list = events(now - 15 * 60000, now + 2 * 864e5);
    const fired = new Set(LS.get("prayerFired", []));
    for (const e of list) {
      if (e.at > now || fired.has(keyOf(e))) continue;
      fired.add(keyOf(e));
      const late = now - e.at;
      if (e.kind === "before" ? now < e.prayerAt : late <= GRACE.notice) fire(e, late);
    }
    LS.set("prayerFired", [...fired].filter(k => Number(k.split(":")[1]) > now - 2 * 864e5));
    const next = list.find(e => e.at > now);
    // Check again at the next alert, and at least every minute (a sleeping device or a changed clock is noticed).
    timer = setTimeout(schedule, Math.max(1000, Math.min(next ? next.at - now + 300 : 60000, 60000)));
  }
  async function fire(e, late) {
    const name = pname(e.p, e.day), visible = document.visibilityState === "visible";
    const body = clock(e.kind === "before" ? e.prayerAt : e.at) + (state.loc ? sep() + state.loc.name : "");
    if (e.kind === "before") {
      const n = Math.max(1, Math.round((e.prayerAt - Date.now()) / 60000));
      if (visible) toast(t("prayer.soonTitle", { name, n }), { label: t("prayer.title"), fn: () => { location.hash = "#/prayer"; } });
      else notify(t("prayer.soonTitle", { name, n }), body, { at: e.prayerAt, kind: "before" });
      return;
    }
    const title = e.p === "sunrise" ? t("prayer.sunriseNow") : t("prayer.nowTitle", { name });
    let playing = false;
    if (e.kind === "adhan" && e.p !== "sunrise" && late <= GRACE.sound) { soundOf = e.at; playing = await play(voiceFor(e.p), { short: state.short, label: title }); }
    showBar({ p: e.p, at: e.at, name, canPlay: e.kind === "adhan" && e.p !== "sunrise" }, playing);
    if (!visible) notify(title, body, { adhan: playing, at: e.at, kind: "now" });
  }
  let soundOf = null; // the prayer time whose adhan was last started
  // A tap on the notification of a prayer's time (from the server while the app was closed, or from the page): the
  // adhan, if that prayer has it and it is still under GRACE.notice late (the tap asks for it, unlike a sound by itself).
  async function adhanFromTap(at) {
    const now = Date.now(), e = events(now - GRACE.notice, now).find(x => x.at === at && x.kind === "adhan" && x.p !== "sunrise");
    if (!e || soundOf === at) return;
    soundOf = at;
    const name = pname(e.p, e.day), title = t("prayer.nowTitle", { name });
    showBar({ p: e.p, at, name, canPlay: true }, await play(voiceFor(e.p), { short: state.short, label: title }));
  }

  // From the service worker: a tap on a notification, or its "stop" button.
  navigator.serviceWorker?.addEventListener("message", e => {
    if (e.data?.stopAdhan) stopAdhan();
    if (e.data?.open && location.hash !== e.data.open) location.hash = e.data.open;
    if (e.data?.adhan) adhanFromTap(e.data.adhan);
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { schedule(); tick(); syncPush(); } });

  // The notifications permission, asked inside a tap (Firefox and Safari ask only then).
  async function askNotif() {
    if (!notifSupported() || Notification.permission !== "default") return;
    try { await Notification.requestPermission(); } catch { /* old Safari: callback form */ }
    syncPush(0);
  }
  // Allowed or blocked later from the browser's site settings: the server is told at once.
  navigator.permissions?.query({ name: "notifications" }).then(s => { s.onchange = () => { syncPush(0); redraw(); }; }).catch(() => {});
  async function enableAlerts() {
    await askNotif();
    state.alerts = true; state.off = false; unlocked = false; unlock(); save(); keepVoices();
    if (!notifSupported() || Notification.permission !== "granted") toast(t("prayer.notifOnlyOpen"));
    else toast(t("prayer.alertsEnabled"));
  }
  const permNote = () => !notifSupported() ? t("prayer.notifUnsupported") : Notification.permission === "denied" ? t("prayer.notifDenied") : Notification.permission === "granted" ? t({ on: "prayer.pushOn", unsupported: "prayer.pushUnsupported", failed: "prayer.pushFailed" }[pushState] || "prayer.notifGranted") : t("prayer.notifAsk");
  // Said before alerts are turned on, where the server can be used.
  const pushNote = () => pushServer().url && "PushManager" in window ? `<p class="riwayah-note">${T("prayer.pushPrivacy")}</p>` : "";

  // ---------- choosing the place ----------
  const round = x => Math.round(x * 1000) / 1000;
  async function searchCity(q) {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=${getLang()}&format=json`, { signal: AbortSignal.timeout?.(15000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return ((await r.json()).results || []).map(c => ({ lat: round(c.latitude), lng: round(c.longitude), name: c.name, region: [c.admin1 !== c.name ? c.admin1 : "", c.country].filter(Boolean).join(sep()), cc: c.country_code || "", tz: c.timezone || "" }));
  }
  function setLoc(loc) { state.loc = loc; save(); keepVoices(); }
  function gps(done, btn) {
    if (!navigator.geolocation) { toast(t("prayer.gpsFailed")); return; }
    btn?.classList.add("busy"); toast(t("prayer.locating"));
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = round(pos.coords.latitude), lng = round(pos.coords.longitude);
      const loc = { lat, lng, name: t("prayer.myLocation"), region: "", cc: countryOfZone(deviceZone()), tz: deviceZone(), gps: true };
      // The name of the place (to two decimals, about a kilometre); without a connection the coordinates are enough.
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${lat.toFixed(2)}&lon=${lng.toFixed(2)}&accept-language=${getLang()}`, { signal: AbortSignal.timeout?.(10000) });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json(), a = j.address || {};
        loc.name = a.city || a.town || a.village || a.municipality || a.county || a.state || j.name || loc.name;
        loc.region = a.country || ""; if (a.country_code) loc.cc = a.country_code.toUpperCase();
      } catch { /* keep "my location" */ }
      btn?.classList.remove("busy"); setLoc(loc); done();
    }, () => { btn?.classList.remove("busy"); toast(t("prayer.gpsFailed")); }, { timeout: 20000, maximumAge: 30 * 60000 });
  }
  // The place: GPS or a city search. The tap that picks it also asks for the notifications permission, since the
  // alerts are on (welcome: the window that also turns them back on).
  function picker(box, done, welcome = false) {
    box.innerHTML = `<button class="btn block" id="pk-gps" type="button">${icon("pin")} ${T("prayer.useGps")}</button>
      <p class="riwayah-note">${T("prayer.gpsHint")}</p>
      <div class="searchbox small">${icon("search")}<input id="pk-q" type="search" placeholder="${T("prayer.searchCity")}" autocomplete="off" enterkeyhint="search"></div>
      <div id="pk-res"></div>`;
    const tap = () => { if (welcome) { state.alerts = true; state.off = false; } if (state.alerts) askNotif(); };
    const gb = $("#pk-gps", box); gb.onclick = () => { tap(); gps(done, gb); };
    const res = $("#pk-res", box); let seq = 0, wait = null, found = [];
    res.onclick = e => { const b = e.target.closest("[data-i]"); if (b) { tap(); setLoc(found[Number(b.dataset.i)]); done(); } };
    $("#pk-q", box).oninput = e => {
      clearTimeout(wait); const q = e.target.value.trim(); const mine = ++seq;
      if (q.length < 2) { res.innerHTML = ""; return; }
      wait = setTimeout(async () => {
        res.innerHTML = `<div class="empty"><div class="spinner"></div></div>`;
        try {
          const list = await searchCity(q); if (mine !== seq) return; found = list;
          res.innerHTML = list.length ? `<div class="list flat">${list.map((c, i) => `<button class="row" type="button" data-i="${i}"><span class="ic">${icon("pin")}</span><div class="lbl">${esc(c.name)}<span class="sub">${esc(c.region)}</span></div></button>`).join("")}</div>`
            : `<div class="empty">${T("common.noResults")}</div>`;
        } catch { if (mine === seq) res.innerHTML = `<div class="empty">${T(navigator.onLine ? "common.loadFailed" : "prayer.searchOffline")}</div>`; }
      }, 350);
    };
  }
  function pickPlace() {
    const body = ctx.sheet(t("prayer.location"), "", { tall: true });
    picker(body, () => { ctx.closeSheet(); toast(t("prayer.placeSet", { name: state.loc.name })); redraw(); });
  }

  // ---------- on a phone: the times and their alerts set up in one tap ----------
  // Sites can notify only once the person allows it, and the times need the place. So a moment after the app starts,
  // a window asks for both, until the alerts work, the user turns them off, or it was closed 3 times (3 days apart).
  const ASKED = "prayerAsked";
  const phone = () => /Android|iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
    || matchMedia("(display-mode: standalone)").matches;
  const needsSetup = () => !state.loc || !state.alerts || (notifSupported() && Notification.permission === "default");
  function welcome() {
    const note = k => `<p class="riwayah-note">${T(k)}</p>`;
    const closed = !notifSupported() ? note("prayer.notifUnsupported") : Notification.permission === "denied" ? note("prayer.notifDenied")
      : "PushManager" in window ? `<p class="pr-w-on">${icon("check")} ${T("prayer.pushOn")}</p>` : "";
    const body = ctx.sheet(t("prayer.settings"), `<div class="pr-welcome"><p>${T("prayer.welcomeLead")}</p>${closed}<div id="pr-w-pick"></div>
      <button class="btn ghost block" type="button" data-close>${T("install.later")}</button></div>`, { tall: !state.loc });
    const box = $("#pr-w-pick", body), done = () => { ctx.closeSheet(); toast(t(state.alerts && notifSupported() && Notification.permission === "granted" ?"prayer.alertsEnabled" : "prayer.placeSet", { name: state.loc.name })); redraw(); };
    if (state.loc) { box.innerHTML = `<button class="btn block" type="button" id="pr-w-go">${icon("bell")} ${T("prayer.enable")}</button>`; $("#pr-w-go", box).onclick = async () => { await enableAlerts(); ctx.closeSheet(); redraw(); }; }
    else picker(box, done, true);
  }
  function autoWelcome(delay) {
    setTimeout(function tryOpen() {
      if (state.off || !phone() || !needsSetup() || /^#\/prayer/.test(location.hash)) return;
      const asked = LS.get(ASKED, { at: 0, n: 0 });
      if (asked.n >= 3 || Date.now() - asked.at < 3 * 864e5) return;
      if (document.getElementById("sheet") || document.visibilityState !== "visible") { setTimeout(tryOpen, 8000); return; }
      LS.set(ASKED, { at: Date.now(), n: asked.n + 1 }); welcome();
    }, delay);
  }

  // ---------- the prayer times page ----------
  let shownDay = null; // another day than today, when the user moves through the days
  function render(parts, params) {
    if (parts[0] === "month") return renderMonth(params);
    setNav("home");
    if (!state.loc) return renderSetup();
    setHeader(t("prayer.title"), { back: true, actions: `<a class="icon-btn" href="#/prayer/month" aria-label="${T("prayer.month")}">${icon("list")}</a><button class="icon-btn" id="pr-share" aria-label="${T("common.share")}">${icon("share")}</button>` });
    $("#pr-share").onclick = shareDay;
    drawMain();
  }
  // Redraw the open page without moving it (after a change, or when a prayer time comes).
  function redraw() {
    const y = window.scrollY;
    if (/^#\/prayer\/?$/.test(location.hash)) { render([], new URLSearchParams()); window.scrollTo(0, y); }
    else if (/^#\/prayer\/month/.test(location.hash)) { renderMonth(new URLSearchParams(location.hash.split("?")[1] || "")); window.scrollTo(0, y); }
    else hubRefresh();
  }
  function renderSetup() {
    setHeader(t("prayer.title"), { back: true });
    view.innerHTML = `<section class="hero slim"><h2>${T("prayer.title")}</h2><p>${T("prayer.setupIntro")}</p></section><div class="card pr-setup" id="pr-pick"></div>`;
    picker($("#pr-pick"), () => redraw());
  }
  function drawMain() {
    const now = Date.now(), today = dayOf(now), day = shownDay || today, x = timesOn(day), isToday = same(day, today);
    const nx = upcoming(now), cur = isToday ? current(now) : null, nt = night(day);
    const ref = x.dhuhr ?? Date.UTC(day.y, day.m - 1, day.d, 12);
    const bell = p => { const m = state.alerts ? state.mode[p] : "off"; return `<button class="icon-btn pr-bell ${m}" type="button" data-bell="${p}" aria-label="${esc(t("prayer.alertFor", { name: pname(p, day) }) + ": " + t("prayer.mode." + m))}">${icon(MODE_ICON[m])}</button>`; };
    const otherZone = state.loc.tz && state.loc.tz !== deviceZone();
    view.innerHTML = `
      <section class="hero slim pr-hero">
        <button class="pr-place" id="pr-loc" type="button">${icon("pin")}<span dir="auto">${esc(placeName())}</span><small>${T("common.change")}</small></button>
        ${otherZone ? `<p class="pr-zone">${T("prayer.cityTime")}</p>` : ""}
        ${nx ? `<div class="pr-next"><small>${T("prayer.next")}</small><b>${esc(pname(nx.p, nx.day))}<span class="pr-at">${esc(clock(nx.at))}</span></b><span class="pr-count" data-pr-count="${nx.at}">${T("prayer.in", { time: left(nx.at - now) })}</span></div>` : ""}
      </section>
      <div class="pr-daynav">
        <button class="icon-btn" type="button" data-day="-1" aria-label="${T("prayer.prevDay")}">${icon("back", "dir")}</button>
        <div class="pr-date"><b>${esc(isToday ? t("prayer.today") + sep() + dateLabel(ref) : dateLabel(ref))}</b><span>${esc(hijri(ref))}</span></div>
        <button class="icon-btn" type="button" data-day="1" aria-label="${T("prayer.nextDay")}">${icon("back", "flip")}</button>
      </div>
      ${isToday ? "" : `<div class="center"><button class="btn ghost" type="button" data-day="0">${T("prayer.backToday")}</button></div>`}
      <div class="list pr-times">${PRAYERS.map(p => `<div class="row pr-row${cur === p ? " now" : ""}${isToday && nx && nx.p === p && same(nx.day, today) ? " next" : ""}${p === "sunrise" ? " minor" : ""}">
        <span class="pr-ic">${icon(ICONS[p])}</span><div class="lbl">${esc(pname(p, day))}${cur === p ? `<span class="sub">${T("prayer.nowTime")}</span>` : ""}</div><time>${esc(clock(x[p]))}</time>${bell(p)}</div>`).join("")}</div>
      ${nt ? `<div class="card pr-night">
        <div class="setting"><span class="ic">${icon("moon")}</span><div class="lbl">${T("prayer.midnight")}<small>${T("prayer.nightNote")}</small></div><time>${esc(clock(nt.mid))}</time></div>
        <div class="setting"><span class="ic">${icon("star")}</span><div class="lbl">${T("prayer.lastThird")}</div><time>${esc(clock(nt.third))}</time></div></div>` : ""}
      <h2 class="section-title">${T("prayer.alerts")}</h2>
      <div class="card" id="pr-alerts">${alertsHtml()}</div>
      <details class="info pr-how"><summary>${icon("bell")}<b>${T("prayer.howTitle")}</b></summary><p>${T("prayer.how")}</p><p>${T("prayer.howPhone")}</p>${pushNote()}</details>
      <h2 class="section-title">${T("prayer.calc")}</h2>
      <div class="card" id="pr-calc">
        <button class="setting row-btn" type="button" id="pr-method"><span class="ic">${icon("settings")}</span><div class="lbl">${T("prayer.method")}<small>${esc(state.method === "auto" ? t("prayer.methodAuto", { name: methodName(method()) }) : methodName(method()))}</small><small>${esc(methodSub(method()))}</small></div>${icon("back", "chev")}</button>
        <div class="setting wrap"><span class="ic">${icon("asr")}</span><div class="lbl">${T("prayer.asrTime")}<small>${T("prayer.asrHint")}</small></div><div class="segmented">${["std", "hanafi"].map(v => `<button type="button" data-asr="${v}" class="${asrMode() === v ? "on" : ""}">${T("prayer.asr." + v)}</button>`).join("")}</div></div>
        ${Math.abs(state.loc.lat) >= 45 ? `<div class="setting wrap"><span class="ic">${icon("sun")}</span><div class="lbl">${T("prayer.highLat")}<small>${T("prayer.highLatHint")}</small></div><select class="select" id="pr-high">${["angle", "seventh", "middle"].map(v => `<option value="${v}" ${state.high === v ? "selected" : ""}>${T("prayer.hl." + v)}</option>`).join("")}</select></div>` : ""}
        <details class="pr-adjust"><summary class="setting"><span class="ic">${icon("reset")}</span><div class="lbl">${T("prayer.adjust")}<small>${T("prayer.adjustHint")}</small></div>${icon("back", "chev")}</summary>
          ${PRAYERS.map(p => `<div class="setting"><div class="lbl">${esc(t("prayer." + p))}</div>${stepper("adj-" + p, state.adj[p] || 0, t("prayer.minutesShort", { n: state.adj[p] || 0 }))}</div>`).join("")}
        </details>
        <div class="setting"><span class="ic">${icon("moon")}</span><div class="lbl">${T("prayer.hijriAdjust")}<small>${esc(hijri(now))}</small></div>${stepper("hijri", state.hijriAdj, num(state.hijriAdj > 0 ? "+" + state.hijriAdj : String(state.hijriAdj)))}</div>
      </div>
      <p class="source-note">${T("prayer.source")}</p>`;
    bindMain();
  }
  const stepper = (key, value, shown) => `<div class="stepper"><button class="icon-btn" type="button" data-step="${key}" data-d="-1" aria-label="−">${icon("minus")}</button><span>${esc(value > 0 && !/^\+/.test(shown) ? "+" + shown : shown)}</span><button class="icon-btn" type="button" data-step="${key}" data-d="1" aria-label="+">${icon("plus")}</button></div>`;
  function alertsHtml() {
    if (!state.alerts) return `<div class="setting wrap"><span class="ic">${icon("bell")}</span><div class="lbl">${T("prayer.alertsOff")}<small>${T("prayer.alertsHint")}</small></div><button class="btn" type="button" id="pr-enable">${T("prayer.enable")}</button></div>${pushNote()}`;
    const custom = state.voice === "custom";
    return `<div class="setting"><span class="ic">${icon("bell")}</span><div class="lbl">${T("prayer.alertsOn")}<small>${esc(permNote())}</small></div><button class="switch on" type="button" id="pr-off" role="switch" aria-checked="true" aria-label="${T("prayer.alerts")}"></button></div>
      ${notifSupported() && Notification.permission === "default" ? `<div class="center pr-allow"><button class="btn" type="button" id="pr-allow">${icon("bell")} ${T("prayer.allowNotif")}</button></div>` : ""}
      <div class="setting"><span class="ic">${icon("bell")}</span><div class="lbl">${T("prayer.before")}</div><select class="select" id="pr-before">${BEFORE.map(n => `<option value="${n}" ${state.before === n ? "selected" : ""}>${n ? T("prayer.minutes", { n }) : T("prayer.beforeOff")}</option>`).join("")}</select></div>
      <button class="setting row-btn" type="button" id="pr-voice"><span class="ic">${icon("volume")}</span><div class="lbl">${T("prayer.voice")}<small>${esc(voiceName(state.voice))}</small></div>${icon("back", "chev")}</button>
      <button class="setting row-btn" type="button" id="pr-fvoice"><span class="ic">${icon("fajr")}</span><div class="lbl">${T("prayer.fajrVoice")}<small>${esc(voiceName(state.fajrVoice))}</small></div>${icon("back", "chev")}</button>
      <div class="setting wrap"><span class="ic">${icon("volume")}</span><div class="lbl">${T("prayer.length")}${custom ? `<small>${T("prayer.lengthCustom", { n: 30 })}</small>` : ""}</div><div class="segmented">${[[0, "prayer.full"], [1, "prayer.takbir"]].map(([v, k]) => `<button type="button" data-short="${v}" class="${Number(state.short) === v ? "on" : ""}">${T(k)}</button>`).join("")}</div></div>
      <div class="setting"><span class="ic">${icon("play")}</span><div class="lbl">${T("prayer.test")}<small>${T("prayer.testHint")}</small></div><button class="btn ghost" type="button" id="pr-test">${T("prayer.testBtn")}</button></div>
      <p class="pr-legend">${MODES.map(m => `<span>${icon(MODE_ICON[m])} ${T("prayer.mode." + m)}</span>`).join("")}</p>`;
  }
  function bindMain() {
    $("#pr-loc").onclick = pickPlace;
    view.querySelectorAll("[data-day]").forEach(b => b.onclick = () => {
      const d = Number(b.dataset.day); shownDay = d ? nextDay(shownDay || dayOf(Date.now()), d) : null;
      if (shownDay && same(shownDay, dayOf(Date.now()))) shownDay = null; drawMain();
    });
    view.querySelectorAll("[data-bell]").forEach(b => b.onclick = async () => {
      const p = b.dataset.bell;
      if (!state.alerts) { await enableAlerts(); return redraw(); }
      state.mode[p] = MODES[(MODES.indexOf(state.mode[p]) + 1) % MODES.length];
      if (p === "sunrise" && state.mode[p] === "adhan") state.mode[p] = "off"; // no adhan at sunrise
      save(); toast(`${pname(p)}: ${t("prayer.mode." + state.mode[p])}`); redraw();
    });
    const en = $("#pr-enable"); if (en) en.onclick = async () => { await enableAlerts(); redraw(); };
    const off = $("#pr-off"); if (off) off.onclick = () => { state.alerts = false; state.off = true; stopAdhan(); save(); toast(t("prayer.alertsDisabled")); redraw(); };
    const allow = $("#pr-allow"); if (allow) allow.onclick = async () => { await askNotif(); redraw(); };
    const bf = $("#pr-before"); if (bf) bf.onchange = () => { state.before = Number(bf.value); save(); };
    const vb = $("#pr-voice"); if (vb) vb.onclick = () => pickVoice(false);
    const fb = $("#pr-fvoice"); if (fb) fb.onclick = () => pickVoice(true);
    view.querySelectorAll("[data-short]").forEach(b => b.onclick = () => { state.short = b.dataset.short === "1"; save(); view.querySelectorAll("[data-short]").forEach(x => x.classList.toggle("on", x === b)); });
    const tb = $("#pr-test"); if (tb) tb.onclick = test;
    $("#pr-method").onclick = pickMethod;
    view.querySelectorAll("[data-asr]").forEach(b => b.onclick = () => { state.asr = b.dataset.asr === asrFor(state.loc.cc) ? "auto" : b.dataset.asr; save(); redraw(); });
    const hl = $("#pr-high"); if (hl) hl.onchange = () => { state.high = hl.value; save(); redraw(); };
    view.querySelectorAll("[data-step]").forEach(b => b.onclick = () => {
      const k = b.dataset.step, d = Number(b.dataset.d);
      if (k === "hijri") state.hijriAdj = Math.max(-2, Math.min(2, state.hijriAdj + d));
      else { const p = k.slice(4); state.adj[p] = Math.max(-30, Math.min(30, (state.adj[p] || 0) + d)); if (!state.adj[p]) delete state.adj[p]; }
      save(); const open = !!b.closest("details[open]"); redraw(); if (open) view.querySelector(".pr-adjust")?.setAttribute("open", "");
    });
  }
  async function test() {
    if (notifSupported() && Notification.permission === "default") { try { await Notification.requestPermission(); } catch { /* ignore */ } }
    const playing = await play(state.voice, { short: true, label: t("prayer.test") });
    showBar({ p: "dhuhr", at: Date.now(), name: t("prayer.dhuhr"), canPlay: true }, playing);
    notify(t("prayer.nowTitle", { name: t("prayer.dhuhr") }), t("prayer.testBody"), { adhan: playing });
  }
  function pickMethod() {
    const auto = methodFor(state.loc.cc);
    const row = (id, label, sub, on) => `<button class="row" type="button" data-m="${id}"><div class="lbl">${esc(label)}<span class="sub">${esc(sub)}</span></div>${on ? icon("check") : ""}</button>`;
    const body = ctx.sheet(t("prayer.method"), `<div class="list flat">${row("auto", t("prayer.methodAuto", { name: methodName(auto) }), methodSub(auto), state.method === "auto")}${Object.keys(METHODS).map(id => row(id, methodName(id), methodSub(id), state.method === id)).join("")}</div>`, { tall: true });
    body.onclick = e => { const b = e.target.closest("[data-m]"); if (!b) return; state.method = b.dataset.m; save(); ctx.closeSheet(); redraw(); };
  }
  async function pickVoice(fajr) {
    await voicesReady;
    // The recordings by place (Makkah and Madinah, the Egyptian reciters, other mosques), then "as the other prayers"
    // or the user's own file.
    const own = fajr ? "same" : "custom";
    const groups = ["hijaz", "egypt", "world"].map(g => [g, VOICES.filter(v => !v.fajr === !fajr && v.group === g).map(v => v.id)]).filter(([, ids]) => ids.length);
    const cur = fajr ? state.fajrVoice : state.voice;
    // An archive.org copy has no licence to show: its source and length only.
    const credit = v => v ? [v.by, v.license, t("prayer.minutesShort", { n: Math.round(v.seconds / 6) / 10 })].filter(Boolean).join(sep()) : "";
    const row = id => {
      const v = VOICES.find(x => x.id === id), playable = id !== "same" && (id !== "custom" || state.customName);
      return `<div class="row pr-voice"><button class="lbl" type="button" data-v="${id}">${esc(voiceName(id))}<span class="sub">${esc(id === "custom" ? t(state.customName ? "prayer.customChange" : "prayer.customPick") : id === "same" ? voiceName(state.voice) : credit(v))}</span></button>
        ${playable ? `<button class="icon-btn" type="button" data-play="${id}" aria-label="${T("common.listen")}">${icon("play")}</button>` : ""}${cur === id ? icon("check") : ""}</div>`;
    };
    const body = ctx.sheet(t(fajr ? "prayer.fajrVoice" : "prayer.voice"), `${groups.map(([g, ids]) => `<h4 class="pr-vgroup">${T("prayer.g." + g)}</h4><div class="list flat">${ids.map(row).join("")}</div>`).join("")}
      <div class="list flat pr-vown">${row(own)}</div>
      ${fajr ? `<p class="riwayah-note">${T("prayer.fajrNote")}</p>` : ""}
      <p class="riwayah-note">${T("prayer.voicesSource")} ${VOICES.map(v => `<a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(voiceName(v.id))}</a>`).join(" • ")}</p>
      <input type="file" id="pr-file" accept="audio/*" hidden>`);
    const file = $("#pr-file", body);
    file.onchange = async () => {
      const f = file.files[0]; if (!f) return;
      if (f.size > 20e6) { toast(t("prayer.fileTooBig", { n: 20 })); return; }
      try { const c = await caches.open(ADHAN_CACHE); await c.put("adhan/custom", new Response(f, { headers: { "content-type": f.type || "audio/mpeg" } })); }
      catch { toast(t("common.loadFailed")); return; }
      state.customName = f.name.replace(/\.[^.]+$/, ""); state.voice = "custom"; save(); ctx.closeSheet(); toast(t("prayer.customSaved")); redraw();
    };
    body.onclick = async e => {
      const pb = e.target.closest("[data-play]");
      if (pb) {
        if (pb.classList.contains("on")) { stopAdhan(); return; }
        const id = pb.dataset.play; const ok = await play(id, { label: voiceName(id) });
        if (ok) { preview = true; pb.classList.add("on"); pb.innerHTML = icon("pause"); }
        else toast(t(navigator.onLine ? "audio.playFailed" : "audio.needsInternet"));
        return;
      }
      const b = e.target.closest("[data-v]"); if (!b) return;
      const id = b.dataset.v;
      if (id === "custom") { file.click(); return; }
      if (fajr) state.fajrVoice = id; else state.voice = id;
      stopAdhan(); save(); keepVoices(); ctx.closeSheet(); redraw();
    };
  }
  function shareDay() {
    const day = shownDay || dayOf(Date.now()), x = timesOn(day), ref = x.dhuhr ?? Date.now();
    const text = `${t("prayer.title")}${sep()}${placeName()}\n${dateLabel(ref)} (${hijri(ref)})\n\n` + PRAYERS.map(p => `${pname(p, day)}: ${clock(x[p])}`).join("\n");
    share(t("prayer.title"), `${text}\n\n— ${t("app.name")}\n${SITE}#/prayer`);
  }

  // ---------- the month table ----------
  function renderMonth(params) {
    setNav("home"); setHeader(t("prayer.month"), { back: true });
    if (!state.loc) { location.replace("#/prayer"); return; }
    const today = dayOf(Date.now());
    let [y, m] = (params?.get("m") || "").split("-").map(Number);
    if (!(y > 1900 && m >= 1 && m <= 12)) { y = today.y; m = today.m; }
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const go = d => { const x = new Date(Date.UTC(y, m - 1 + d, 1)); return `#/prayer/month?m=${x.getUTCFullYear()}-${x.getUTCMonth() + 1}`; };
    const rows = [];
    for (let d = 1; d <= days; d++) {
      const day = { y, m, d }, x = timesOn(day), ref = x.dhuhr ?? Date.UTC(y, m - 1, d, 12);
      rows.push(`<tr class="${same(day, today) ? "today" : ""}${isFriday(day) ? " fri" : ""}"><th scope="row"><b>${esc(num(d))}</b> ${esc(fmt({ weekday: "short" }).format(ref))}<small>${esc(hijri(ref, { day: "numeric", month: "short" }))}</small></th>${PRAYERS.map(p => `<td>${esc(clockBare(x[p]))}</td>`).join("")}</tr>`);
    }
    view.innerHTML = `
      <div class="pr-daynav">
        <a class="icon-btn" href="${go(-1)}" data-replace aria-label="${T("prayer.prevMonth")}">${icon("back", "dir")}</a>
        <div class="pr-date"><b>${esc(fmt({ month: "long", year: "numeric" }).format(Date.UTC(y, m - 1, 15, 12)))}</b><span>${esc(placeName())}</span></div>
        <a class="icon-btn" href="${go(1)}" data-replace aria-label="${T("prayer.nextMonth")}">${icon("back", "flip")}</a>
      </div>
      <div class="pr-table"><table class="pr-month"><thead><tr><th scope="col">${T("prayer.day")}</th>${PRAYERS.map(p => `<th scope="col">${esc(t("prayer." + p))}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>
      <p class="source-note">${esc(t("prayer.methodIs", { name: methodName(method()) }))}${sep()}${T("prayer.asr." + asrMode())}</p>`;
    view.querySelectorAll("[data-replace]").forEach(a => a.onclick = e => { e.preventDefault(); location.replace(a.getAttribute("href")); });
    view.querySelector("tr.today")?.scrollIntoView({ block: "center" });
  }

  // ---------- the Home page: the next prayer, counting down ----------
  function hubRow() {
    if (!state.loc) return `<a class="now" id="hub-prayer" href="#/prayer">${icon("prayer")}<div><small>${T("prayer.title")}</small><b>${T("prayer.setLocation")}</b></div>${icon("back", "chev")}</a>`;
    const now = Date.now(), nx = upcoming(now);
    if (!nx) return "";
    return `<a class="now" id="hub-prayer" href="#/prayer">${icon(ICONS[nx.p])}<div><small>${T("prayer.next")}${state.loc.name ? esc(sep() + state.loc.name) : ""}</small><b>${esc(pname(nx.p, nx.day))} ${esc(clock(nx.at))}</b></div><span class="pct" data-pr-count="${nx.at}" data-short="1">${T("prayer.in", { time: left(nx.at - now, false) })}</span></a>`;
  }
  function hubRefresh() { const el = document.getElementById("hub-prayer"); if (el) el.outerHTML = hubRow(); }

  // Countdowns on the page, every second while it is on screen; when one reaches its prayer, the page moves on.
  // A recording heard in the voice list stops when the list is closed.
  function tick() {
    if (preview && !document.getElementById("sheet")) stopAdhan();
    const now = Date.now(); let passed = false;
    document.querySelectorAll("[data-pr-count]").forEach(el => {
      const at = Number(el.dataset.prCount); if (at <= now) { passed = true; return; }
      el.textContent = t("prayer.in", { time: left(at - now, !el.dataset.short) });
    });
    if (passed && !document.getElementById("sheet")) redraw();
  }
  setInterval(() => { if (document.visibilityState === "visible") tick(); }, 1000);

  return {
    render, hubRow,
    start() {
      schedule(); if (state.alerts && state.loc) keepVoices(); syncPush(3000); autoWelcome(4000);
      // Opened by a tap on the notification of a prayer's time (sw.js): ?adhan=<that time>.
      const q = new URLSearchParams(location.search), at = Number(q.get("adhan"));
      if (q.has("adhan")) { q.delete("adhan"); const rest = q.toString(); history.replaceState(history.state, "", location.pathname + (rest ? "?" + rest : "") + location.hash); }
      if (at) adhanFromTap(at);
    },
    // The notifications from the server are written in the app's language.
    langChanged: () => syncPush(),
    settingsLabel: () => state.loc ? placeName() : t("prayer.setLocation"),
    // For the about section: the recordings and their licences.
    credits: async () => { await voicesReady; return VOICES; },
    voiceName,
  };
}
