// Checks the app's prayer times (www/js/prayer-calc.js) for cities on every continent, each with its usual method,
// in summer, winter and Ramadan:
// - Fajr, sunrise, Dhuhr, Maghrib and Isha against the aladhan.com API (same method, same added minutes);
// - Asr against the NOAA solar equations below, because aladhan's Asr drifts by 2–4 minutes at high latitudes.
// Times are compared in UTC (aladhan's time-zone data can be an hour off, e.g. for Morocco). One minute is rounding.
// Intended difference: the Umm al-Qura method puts Isha 120 minutes after Maghrib in Ramadan (aladhan keeps 90).
// Usage: node scripts/check-prayer.js
const path = require("path"), { pathToFileURL } = require("url");

const ALADHAN = { mwl: 3, egypt: 5, makkah: 4, karachi: 1, isna: 2, gulf: 8, kuwait: 9, qatar: 10, dubai: 16, jordan: 23, turkey: 13, tunisia: 18, algeria: 19, morocco: 21, singapore: 11, jakim: 17, kemenag: 20, france: 12, russia: 14 };
// aladhan already adds these minutes for its method, so they are not sent again as `tune`.
const ALADHAN_ADDS = { morocco: { dhuhr: 5, maghrib: 5 } };
const CITIES = [
  ["Makkah", 21.4225, 39.8262, "SA"], ["Madinah", 24.4672, 39.6111, "SA"], ["Cairo", 30.0444, 31.2357, "EG"], ["Alexandria", 31.2001, 29.9187, "EG"],
  ["Karachi", 24.8607, 67.0011, "PK"], ["Jakarta", -6.2088, 106.8456, "ID"], ["Istanbul", 41.0082, 28.9784, "TR"], ["Dubai", 25.2048, 55.2708, "AE"],
  ["Kuwait", 29.3759, 47.9774, "KW"], ["Doha", 25.2854, 51.531, "QA"], ["Muscat", 23.588, 58.3829, "OM"], ["Amman", 31.9539, 35.9106, "JO"],
  ["Rabat", 34.0209, -6.8416, "MA"], ["Algiers", 36.7538, 3.0588, "DZ"], ["Tunis", 36.8065, 10.1815, "TN"], ["Kuala Lumpur", 3.139, 101.6869, "MY"],
  ["Singapore", 1.3521, 103.8198, "SG"], ["Paris", 48.8566, 2.3522, "FR"], ["Moscow", 55.7558, 37.6173, "RU"], ["New York", 40.7128, -74.006, "US"],
  ["London", 51.5074, -0.1278, "GB"], ["Oslo", 59.9139, 10.7522, "NO"], ["Sydney", -33.8688, 151.2093, "AU"], ["Auckland", -36.8485, 174.7633, "NZ"],
  ["Honolulu", 21.3069, -157.8583, "US"], ["Dhaka", 23.8103, 90.4125, "BD"], ["Lagos", 6.5244, 3.3792, "NG"],
];
const DATES = [[2026, 10, 20], [2026, 6, 21], [2026, 12, 21], [2027, 2, 20]]; // 2027-02-20 is in Ramadan 1448
const NAMES = { fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Dhuhr", maghrib: "Maghrib", isha: "Isha" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- NOAA solar calculator equations (Meeus): declination and equation of time ----------
const R = Math.PI / 180, s = x => Math.sin(x * R), c = x => Math.cos(x * R), t = x => Math.tan(x * R);
function solar(jd) {
  const JC = (jd - 2451545) / 36525;
  const L0 = (280.46646 + JC * (36000.76983 + JC * 0.0003032)) % 360, M = 357.52911 + JC * (35999.05029 - 0.0001537 * JC);
  const e = 0.016708634 - JC * (0.000042037 + 0.0000001267 * JC);
  const C = s(M) * (1.914602 - JC * (0.004817 + 0.000014 * JC)) + s(2 * M) * (0.019993 - 0.000101 * JC) + s(3 * M) * 0.000289;
  const app = L0 + C - 0.00569 - 0.00478 * s(125.04 - 1934.136 * JC);
  const obl = 23 + (26 + (21.448 - JC * (46.815 + JC * (0.00059 - JC * 0.001813))) / 60) / 60 + 0.00256 * c(125.04 - 1934.136 * JC);
  const y = t(obl / 2) ** 2;
  return { decl: Math.asin(s(obl) * s(app)) / R, eqt: 4 * (y * s(2 * L0) - 2 * e * s(M) + 4 * e * y * s(M) * c(2 * L0) - 0.5 * y * y * s(4 * L0) - 1.25 * e * e * s(2 * M)) / R };
}
// Asr in minutes after 0h UT of the date: the shadow equals `factor` lengths plus the noon shadow.
function asrNoaa(y, m, d, lat, lng, factor) {
  const jd = Date.UTC(y, m - 1, d) / 86400000 + 2440587.5; let T = 900 - 4 * lng;
  for (let i = 0; i < 6; i++) {
    const noon = 720 - 4 * lng - solar(jd + T / 1440).eqt, dn = solar(jd + noon / 1440).decl, { decl } = solar(jd + T / 1440);
    const alt = Math.atan(1 / (factor + t(Math.abs(lat - dn)))) / R;
    T = noon + 4 * Math.acos((s(alt) - s(lat) * s(decl)) / (c(lat) * c(decl))) / R;
  }
  return T;
}

(async () => {
  const P = await import(pathToFileURL(path.join(__dirname, "..", "www", "js", "prayer-calc.js")));
  let bad = 0, n = 0, worst = 0;
  const utc = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
  const toMin = s => { const [h, mm] = s.split(":").map(Number); return h * 60 + mm; };
  const gap = (a, b) => { const x = Math.abs(a - b) % 1440; return Math.min(x, 1440 - x); };
  for (const [name, lat, lng, cc] of CITIES) {
    const method = P.methodFor(cc), asr = P.asrFor(cc), adj = { ...P.METHODS[method].adj };
    for (const [k, v] of Object.entries(ALADHAN_ADDS[method] || {})) adj[k] -= v;
    for (const [y, m, d] of DATES) {
      // aladhan's tune order: Imsak, Fajr, Sunrise, Dhuhr, Asr, Maghrib, Sunset, Isha, Midnight
      const tune = [0, 0, adj.sunrise || 0, adj.dhuhr || 0, adj.asr || 0, adj.maghrib || 0, 0, 0, 0].join(",");
      const url = `https://api.aladhan.com/v1/timings/${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}?latitude=${lat}&longitude=${lng}&method=${ALADHAN[method]}&school=${asr === "hanafi" ? 1 : 0}&latitudeAdjustmentMethod=3&timezonestring=UTC&tune=${tune}`;
      let j;
      for (let tries = 0; ; tries++) {
        try { const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status); j = await r.json(); break; }
        catch (e) { if (tries > 3) { console.log(`✗ ${name} ${y}-${m}-${d}: aladhan ${e.message}`); bad++; break; } await sleep(1500); }
      }
      if (!j) continue;
      const mine = P.prayerTimes({ y, m, d }, { lat, lng }, { method, asr, high: "angle" });
      const diffs = [];
      for (const [k, label] of Object.entries(NAMES)) {
        const theirs = j.data.timings[label].slice(0, 5), ours = mine[k] == null ? "--:--" : utc.format(mine[k]);
        const dm = gap(toMin(ours), toMin(theirs)); n++;
        const ramadan = method === "makkah" && k === "isha" && P.inRamadan(y, m, d) && dm === 30;
        if (!ramadan) worst = Math.max(worst, dm);
        if (dm > 1 && !ramadan) diffs.push(`${k} ${ours} vs aladhan ${theirs}`);
      }
      const ref = asrNoaa(y, m, d, lat, lng, asr === "hanafi" ? 2 : 1) + (P.METHODS[method].adj?.asr || 0);
      const da = gap(toMin(utc.format(mine.asr)), Math.round(ref)); n++; worst = Math.max(worst, da);
      if (da > 1) diffs.push(`asr ${utc.format(mine.asr)} vs NOAA ${String(Math.floor(ref / 60) % 24).padStart(2, "0")}:${String(Math.round(ref % 60)).padStart(2, "0")}`);
      if (diffs.length) { bad++; console.log(`✗ ${name} ${y}-${m}-${d} (${method}, asr ${asr}): ${diffs.join("; ")}`); }
      await sleep(250);
    }
  }
  console.log(bad ? `${bad} day(s) differ by more than a minute` : `✓ ${n} times in ${CITIES.length} cities agree to the minute (largest difference ${worst} min)`);
  process.exit(bad ? 1 : 0);
})();
