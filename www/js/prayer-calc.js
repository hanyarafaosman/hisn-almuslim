/* ===== Prayer times by calculation (no network, no dependencies; also imported by scripts/check-prayer.js) ===== */
// The sun's declination and the equation of time come from the low-precision solar formulas of the U.S. Naval
// Observatory (good to about a minute of arc until 2050), recomputed at each time so every prayer is exact to the
// minute. The conventions of each authority (twilight angles, Isha a fixed time after Maghrib, the safety minutes
// some of them add) are those of the authorities themselves, as listed by aladhan.com and adhan-js.

// fajr/isha: depression of the sun below the horizon, in degrees. ishaMin: Isha this many minutes after Maghrib
// (ramadanIshaMin during Ramadan). maghribMin: Maghrib this many minutes after sunset. adj: minutes the authority adds.
export const METHODS = {
  mwl: { fajr: 18, isha: 17 },
  egypt: { fajr: 19.5, isha: 17.5 },
  makkah: { fajr: 18.5, ishaMin: 90, ramadanIshaMin: 120 },
  karachi: { fajr: 18, isha: 18 },
  isna: { fajr: 15, isha: 15 },
  gulf: { fajr: 19.5, ishaMin: 90 },
  kuwait: { fajr: 18, isha: 17.5 },
  qatar: { fajr: 18, ishaMin: 90 },
  dubai: { fajr: 18.2, isha: 18.2, adj: { sunrise: -3, dhuhr: 3, asr: 3, maghrib: 3 } },
  jordan: { fajr: 18, isha: 18, maghribMin: 5 },
  turkey: { fajr: 18, isha: 17, adj: { sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7 } }, // Diyanet's temkin minutes
  tunisia: { fajr: 18, isha: 18 },
  algeria: { fajr: 18, isha: 17 },
  morocco: { fajr: 19, isha: 17, adj: { dhuhr: 5, maghrib: 5 } },
  singapore: { fajr: 20, isha: 18 },
  jakim: { fajr: 20, isha: 18 },
  kemenag: { fajr: 20, isha: 18 },
  france: { fajr: 12, isha: 12 },
  russia: { fajr: 16, isha: 15 },
};
export const PRAYERS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

// The method and the time of Asr used in each country (ISO 3166 code); anywhere else: Muslim World League, Asr at one shadow length.
const COUNTRY_METHOD = {
  SA: "makkah", YE: "makkah", AE: "dubai", KW: "kuwait", QA: "qatar", BH: "gulf", OM: "gulf",
  EG: "egypt", SD: "egypt", SS: "egypt", LY: "egypt", SY: "egypt", LB: "egypt", IQ: "egypt",
  JO: "jordan", PS: "jordan", TR: "turkey", TN: "tunisia", DZ: "algeria", MA: "morocco",
  PK: "karachi", IN: "karachi", BD: "karachi", AF: "karachi",
  SG: "singapore", BN: "singapore", MY: "jakim", ID: "kemenag", FR: "france", RU: "russia", US: "isna", CA: "isna",
};
const HANAFI_ASR = new Set(["PK", "IN", "BD", "AF"]);
export const methodFor = cc => COUNTRY_METHOD[String(cc || "").toUpperCase()] || "mwl";
export const asrFor = cc => HANAFI_ASR.has(String(cc || "").toUpperCase()) ? "hanafi" : "std";

// The country of the device's time zone, for a place found by GPS when its name could not be looked up.
const ZONE_COUNTRY = {
  "Africa/Cairo": "EG", "Asia/Riyadh": "SA", "Asia/Aden": "YE", "Asia/Dubai": "AE", "Asia/Kuwait": "KW", "Asia/Qatar": "QA",
  "Asia/Bahrain": "BH", "Asia/Muscat": "OM", "Asia/Amman": "JO", "Asia/Gaza": "PS", "Asia/Hebron": "PS", "Asia/Damascus": "SY",
  "Asia/Beirut": "LB", "Asia/Baghdad": "IQ", "Africa/Khartoum": "SD", "Africa/Juba": "SS", "Africa/Tripoli": "LY", "Africa/Tunis": "TN",
  "Africa/Algiers": "DZ", "Africa/Casablanca": "MA", "Africa/El_Aaiun": "MA", "Europe/Istanbul": "TR", "Asia/Karachi": "PK",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Dhaka": "BD", "Asia/Kabul": "AF", "Asia/Kuala_Lumpur": "MY", "Asia/Kuching": "MY",
  "Asia/Singapore": "SG", "Asia/Brunei": "BN", "Asia/Jakarta": "ID", "Asia/Makassar": "ID", "Asia/Jayapura": "ID", "Asia/Pontianak": "ID",
  "Europe/Paris": "FR", "Europe/Moscow": "RU", "Europe/Kazan": "RU",
};
export const countryOfZone = tz => ZONE_COUNTRY[tz] || "";

// ---------- the sun ----------
const D = Math.PI / 180;
const sin = x => Math.sin(x * D), cos = x => Math.cos(x * D), tan = x => Math.tan(x * D);
const asin = x => Math.asin(x) / D, acos = x => Math.acos(x) / D, atan2 = (y, x) => Math.atan2(y, x) / D;
const acot = x => Math.atan(1 / x) / D;
const fix = (a, b) => ((a % b) + b) % b;

// Julian day at 0h UT of a calendar date.
function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
// Declination (degrees) and equation of time (hours) at a Julian day.
function sun(jd) {
  const n = jd - 2451545;
  const g = fix(357.529 + 0.98560028 * n, 360), q = fix(280.459 + 0.98564736 * n, 360);
  const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360), e = 23.439 - 0.00000036 * n;
  const ra = fix(atan2(cos(e) * sin(L), cos(L)) / 15, 24);
  return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - ra - 24 * Math.round((q / 15 - ra) / 24) };
}

// Where the sun is at a moment (ms since the epoch) seen from a place: azimuth in degrees clockwise from north and
// altitude above the horizon (negative at night). For the Qibla page (js/qibla.js).
export function sunPosition(ms, lat, lng) {
  const jd = ms / 864e5 + 2440587.5, { decl, eqt } = sun(jd);
  const ut = fix(ms / 36e5, 24); // hours UT
  const H = fix(15 * (ut + lng / 15 + eqt - 12) + 180, 360) - 180; // hour angle, degrees west of the meridian
  const altitude = asin(sin(lat) * sin(decl) + cos(lat) * cos(decl) * cos(H));
  const azimuth = fix(atan2(sin(H), cos(H) * sin(lat) - tan(decl) * cos(lat)) + 180, 360);
  return { azimuth, altitude };
}

// Is this date (y, m, d) in Ramadan, by the Umm al-Qura calendar moved by hijriAdj days?
export function inRamadan(y, m, d, hijriAdj = 0) {
  try { return new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d + hijriAdj, 12))) === "9"; }
  catch { return false; }
}

// Times of one day at a place, as milliseconds since 1970 (rounded to the minute), or null where the sun never
// reaches the angle (near the poles). date: { y, m, d } (the place's own calendar day); place: { lat, lng }.
// cfg: { method, asr: "std"|"hanafi", high: "angle"|"seventh"|"middle"|"none", adj: { fajr: minutes, … }, hijriAdj }
export function prayerTimes(date, place, cfg = {}) {
  const { y, m, d } = date, lat = place.lat, lngH = place.lng / 15;
  const p = METHODS[cfg.method] || METHODS.mwl;
  const jd = julian(y, m, d);
  const at = h => sun(jd + h / 24);
  const noon = h => 12 - at(h).eqt - lngH; // hours after 0h UT of the date
  // The time when the sun is `angle` degrees below the horizon (negative: above it), before or after noon.
  const angleTime = (angle, h, before) => {
    const { decl } = at(h); const c = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
    if (!(c >= -1 && c <= 1)) return NaN;
    const T = acos(c) / 15; return noon(h) + (before ? -T : T);
  };
  const asrTime = (factor, h) => { const { decl } = at(h); return angleTime(-acot(factor + tan(Math.abs(lat - decl))), h, false); };
  const factor = cfg.asr === "hanafi" ? 2 : 1;

  // First guesses (local solar time), then three rounds with the sun's position at each time found.
  const FIRST = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
  let t = {};
  for (let i = 0; i < 3; i++) {
    const g = k => Number.isFinite(t[k]) ? t[k] : FIRST[k] - lngH;
    t = {
      fajr: angleTime(p.fajr, g("fajr"), true),
      sunrise: angleTime(0.833, g("sunrise"), true),
      dhuhr: noon(g("dhuhr")),
      asr: asrTime(factor, g("asr")),
      sunset: angleTime(0.833, g("sunset"), false),
      isha: p.ishaMin ? NaN : angleTime(p.isha, g("isha"), false),
    };
  }
  t.maghrib = t.sunset + (p.maghribMin || 0) / 60;
  if (p.ishaMin) t.isha = t.maghrib + ((p.ramadanIshaMin && inRamadan(y, m, d, cfg.hijriAdj || 0)) ? p.ramadanIshaMin : p.ishaMin) / 60;

  // High latitudes: Fajr no earlier, and Isha no later, than a part of the night (sunset to sunrise) allows.
  const high = cfg.high || "angle";
  if (high !== "none" && Number.isFinite(t.sunrise) && Number.isFinite(t.sunset)) {
    const night = 24 - (t.sunset - t.sunrise);
    const part = angle => (high === "seventh" ? 1 / 7 : high === "middle" ? 1 / 2 : angle / 60) * night;
    if (!(t.sunrise - t.fajr <= part(p.fajr))) t.fajr = t.sunrise - part(p.fajr);
    if (!p.ishaMin && !(t.isha - t.sunset <= part(p.isha))) t.isha = t.sunset + part(p.isha);
  }

  const base = Date.UTC(y, m - 1, d), out = {};
  for (const k of PRAYERS) {
    const h = t[k]; if (!Number.isFinite(h)) { out[k] = null; continue; }
    const min = h * 60 + (p.adj?.[k] || 0) + (Number(cfg.adj?.[k]) || 0);
    out[k] = base + Math.round(min) * 60000;
  }
  return out;
}

// The calendar day n days after { y, m, d }.
export const nextDay = ({ y, m, d }, n = 1) => { const x = new Date(Date.UTC(y, m - 1, d + n)); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }; };
