/* ===== What to send and when: the same times and alerts as www/js/prayer.js ===== */
// The times come from the app's own www/js/prayer-calc.js (imported, not copied), for the place, method and
// corrections the app sent, so a notification shows the same minute as the app.
import { METHODS, PRAYERS, prayerTimes, nextDay } from "../../www/js/prayer-calc.js";

const MODES = ["off", "notify", "adhan"];
const HIGH = ["angle", "seventh", "middle", "none"];
const round2 = x => Math.round(x * 100) / 100;

// Checks and normalises the settings the app sends (www/js/prayer.js, pushSettings); throws on anything unexpected.
export function cleanSettings(s) {
  const bad = what => { throw new Error("bad " + what); };
  if (!s || typeof s !== "object") bad("settings");
  const lat = Number(s.lat), lng = Number(s.lng);
  if (!(Math.abs(lat) <= 90) || !(Math.abs(lng) <= 180)) bad("place");
  const tz = String(s.tz || "");
  if (tz.length > 64 || !zoneOk(tz)) bad("time zone");
  if (!Object.hasOwn(METHODS, s.method)) bad("method");
  if (!["std", "hanafi"].includes(s.asr)) bad("asr");
  if (!HIGH.includes(s.high)) bad("high");
  const adj = {};
  for (const [p, v] of Object.entries(s.adj || {})) { if (!PRAYERS.includes(p) || !Number.isInteger(v) || Math.abs(v) > 30) bad("adj"); if (v) adj[p] = v; }
  if (!Number.isInteger(s.hijriAdj) || Math.abs(s.hijriAdj) > 2) bad("hijriAdj");
  const mode = {};
  for (const p of PRAYERS) { const m = s.mode?.[p] ?? "off"; if (!MODES.includes(m)) bad("mode"); mode[p] = p === "sunrise" && m === "adhan" ? "notify" : m; }
  if (!Number.isInteger(s.before) || s.before < 0 || s.before > 120) bad("before");
  const lang = String(s.lang || "ar");
  if (!/^[a-z]{2,3}$/.test(lang)) bad("lang");
  return { lat: round2(lat), lng: round2(lng), tz, method: s.method, asr: s.asr, high: s.high, adj, hijriAdj: s.hijriAdj, mode, before: s.before, lang };
}

// Calendar days at the place (Intl formatters are slow to make: one per time zone, kept for the life of the Worker).
const dayFormats = new Map();
function dayFormat(tz) {
  if (!dayFormats.has(tz)) dayFormats.set(tz, new Intl.DateTimeFormat("en-US", { year: "numeric", month: "numeric", day: "numeric", weekday: "short", timeZone: tz }));
  return dayFormats.get(tz);
}
function zoneOk(tz) { try { dayFormat(tz); return true; } catch { dayFormats.delete(tz); return false; } }
export function dayOf(ms, tz) {
  const p = {}; dayFormat(tz).formatToParts(ms).forEach(x => { p[x.type] = x.value; });
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}
const isFriday = day => new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay() === 5;

// Every alert of the days around a moment, in order. rank orders alerts of the same minute (a reminder that falls on
// another prayer's time), so the next one after a sent alert is always well defined.
function alertsAround(s, ms) {
  const out = [], cfg = { method: s.method, asr: s.asr, high: s.high, adj: s.adj, hijriAdj: s.hijriAdj };
  for (let day = dayOf(ms - 864e5, s.tz), i = 0; i < 4; i++, day = nextDay(day)) {
    const x = prayerTimes(day, { lat: s.lat, lng: s.lng }, cfg);
    PRAYERS.forEach((p, i) => {
      const at = x[p]; if (s.mode[p] === "off" || at == null) return;
      const name = p === "dhuhr" && isFriday(day) ? "jumua" : p;
      if (s.before && p !== "sunrise") out.push({ at: at - s.before * 60000, rank: i * 2, p: name, kind: "before", prayerAt: at });
      out.push({ at, rank: i * 2 + 1, p: name, kind: s.mode[p], prayerAt: at });
    });
  }
  return out.sort((a, b) => a.at - b.at || a.rank - b.rank);
}
// The first alert after a cursor { at, rank } (rank 99: after everything at that moment), or null when every alert is off.
export function nextAlert(s, cursor) {
  return alertsAround(s, cursor.at).find(e => e.at > cursor.at || (e.at === cursor.at && e.rank > cursor.rank)) || null;
}
