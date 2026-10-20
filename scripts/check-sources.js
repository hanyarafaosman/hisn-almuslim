// Checks every outside service the app relies on, so a broken source is noticed before users report it.
// Run daily by .github/workflows/sources.yml (a failed run emails the repository owner). Usage: npm run check:sources
//   errors   (exit 1): adhkar audio (hisnmuslim.com), Mushaf page fonts (static.qurancdn.com, verses.quran.foundation),
//                      recitations API (mp3quran.net), translations API (quranenc.com), hadith books (jsDelivr),
//                      tafsir books (quranenc.com, jsDelivr),
//                      backup copy of the audio and page fonts (hisn-almuslim-assets, see www/js/mirror.js)
//   warnings (exit 0): live radio stations, hadith and subject radio stations, audio lesson series (IslamHouse.com),
//                      video series (YouTube), live channels (win.holol.com), changed audio sizes,
//                      city search and place names for prayer times (open-meteo.com, nominatim.openstreetmap.org)
const fs = require("fs"), path = require("path");
const { probe } = require("./check-radios.js");
const { loadMirror } = require("./build-mirror.js");
const WWW = path.join(__dirname, "..", "www");
const readJson = f => JSON.parse(fs.readFileSync(path.join(WWW, f), "utf8"));
const ORIGIN = "https://hanyarafaosman.github.io"; // the app fetches cross-origin, so CORS must allow it
const GH = process.env.GITHUB_ACTIONS === "true";
const errors = [], warnings = [], passed = [];
// On GitHub the title shows only in the annotation, so the message repeats the source name for the job log.
const error = (group, msg) => { errors.push(`${group}: ${msg}`); console.log(GH ? `::error title=${group}::${group}: ${msg}` : `✗ ${group}: ${msg}`); };
const warn = (group, msg) => { warnings.push(`${group}: ${msg}`); console.log(GH ? `::warning title=${group}::${group}: ${msg}` : `⚠ ${group}: ${msg}`); };
const pass = (group, msg) => { passed.push(`${group}: ${msg}`); console.log(`✓ ${group}: ${msg}`); };

// One request with a timeout, retried so a single network hiccup does not raise an alarm.
async function request(url, { method = "GET", tries = 3, headers = {} } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(url, { method, signal: ctl.signal, headers: { Origin: ORIGIN, "User-Agent": "HisnAlMuslim-source-check", ...headers } });
      if (res.ok || res.status === 404) return res;
      last = new Error("HTTP " + res.status);
    } catch (e) { last = e.name === "AbortError" ? new Error("timeout") : e; }
    finally { clearTimeout(timer); }
    await new Promise(r => setTimeout(r, 2000 * (i + 1)));
  }
  throw last;
}
const corsOk = res => ["*", ORIGIN].includes(res.headers.get("access-control-allow-origin"));
async function getJSON(url) { const r = await request(url); if (!r.ok) throw new Error("HTTP " + r.status); if (!corsOk(r)) throw new Error("no CORS header"); return r.json(); }

// HEAD many files with a few parallel workers; returns total bytes, each file size and the files that failed.
async function headAll(urls, accept, headers = {}) {
  const q = [...urls], bad = [], size = new Map(); let bytes = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (q.length) {
      const u = q.shift();
      try {
        const r = await request(u, { method: "HEAD", headers });
        const why = !r.ok ? "HTTP " + r.status : !corsOk(r) ? "no CORS header" : !accept.test(r.headers.get("content-type") || "") ? "type " + r.headers.get("content-type") : "";
        if (why) bad.push(`${u} (${why})`); else { size.set(u, Number(r.headers.get("content-length")) || 0); bytes += size.get(u); }
      } catch (e) { bad.push(`${u} (${e.message})`); }
    }
  }));
  return { bytes, bad, size };
}
const mb = n => (n / 1048576).toFixed(1) + " MB";
// Files that have a backup copy, with their size at the source when it answered.
const backed = [], sourceSize = new Map();
const listBad = bad => bad.slice(0, 5).join(", ") + (bad.length > 5 ? ` … and ${bad.length - 5} more` : "");

async function adhkarAudio() {
  const G = "Adhkar audio (hisnmuslim.com)";
  const db = readJson("data/hisn.json"), sizes = readJson("data/audio-sizes.json");
  const chapters = db.categories.map(c => c.audio).filter(Boolean), items = db.categories.flatMap(c => c.items.map(i => i.audio)).filter(Boolean);
  const urls = [...new Set([...chapters, ...items])];
  const { bytes, bad, size } = await headAll(urls, /audio|mpeg|octet-stream/i);
  backed.push(...urls); size.forEach((n, u) => sourceSize.set(u, n));
  if (bad.length) error(G, `${bad.length} of ${urls.length} files unavailable: ${listBad(bad)}`);
  else pass(G, `${urls.length} files, ${mb(bytes)}`);
  // Same sum as scripts/measure-audio.js (a file used both as chapter and item counts twice).
  const now = [...chapters, ...items].reduce((a, u) => a + (size.get(u) || 0), 0), recorded = sizes.items.bytes + sizes.chapters.bytes;
  if (!bad.length && now !== recorded) warn(G, `total size is now ${mb(now)}, recorded ${mb(recorded)}: run npm run measure:audio`);
}

async function mushafPageFonts() {
  const G = "Mushaf page fonts (static.qurancdn.com)";
  const { fonts } = readJson("mushaf/madinah.json");
  for (const [v, f] of Object.entries(fonts)) {
    const urls = Array.from({ length: 604 }, (_, i) => f.url.replace("{n}", i + 1));
    const { bytes, bad, size } = await headAll(urls, /font|woff|octet-stream/i);
    backed.push(...urls); size.forEach((n, u) => sourceSize.set(u, n));
    if (bad.length) error(G, `${v}: ${bad.length} of 604 pages unavailable: ${listBad(bad)}`);
    // The glyph codes in mushaf/madinah.json only fit these exact fonts: a size change means the source replaced them.
    else if (bytes !== f.bytes) error(G, `${v}: fonts changed at the source (${bytes} bytes, built with ${f.bytes}); check the pages and rebuild with npm run mushaf:pages`);
    else pass(G, `${v}: 604 pages, ${mb(bytes)}, unchanged`);
  }
}

// The colour-coded Tajweed print (QCF v4): every page font must load, at the size mushaf/tajweed.json was built with.
async function tajweedPageFonts() {
  const G = "Tajweed page fonts (verses.quran.foundation)";
  const f = readJson("mushaf/tajweed.json").fonts.v4;
  const urls = Array.from({ length: 604 }, (_, i) => f.url.replace("{n}", i + 1));
  // The CDN (BunnyCDN, Vary: Accept-Encoding) can keep two copies of a page, an older one for compressed requests and
  // the current one for "identity", and which one an edge holds differs by location. The build measured "identity".
  // A few bytes of difference on some pages is that older copy; fonts replaced at the source change far more.
  const { bytes, bad } = await headAll(urls, /font|woff|octet-stream/i, { "accept-encoding": "identity" });
  const drift = Math.abs(bytes - f.bytes) / f.bytes;
  if (bad.length) error(G, `${bad.length} of 604 pages unavailable: ${listBad(bad)}`);
  else if (drift > 0.01) error(G, `fonts changed at the source (${bytes} bytes, built with ${f.bytes}); check the pages and rebuild with npm run mushaf:colors`);
  else if (bytes !== f.bytes) warn(G, `${bytes} bytes, built with ${f.bytes}: the CDN serves an older copy of a few pages from this location (difference under 1%)`);
  else pass(G, `604 pages, ${mb(bytes)}, unchanged`);
}

// Every file must be in the backup, with the size its source has today and the size listed in manifest.json.
async function backup() {
  const G = "Backup copy (hisn-almuslim-assets)";
  try {
    const { MIRROR, mirrorOf } = await loadMirror();
    const rel = u => mirrorOf(u).slice(MIRROR.length + 1);
    const { files } = await getJSON(`${MIRROR}/manifest.json`);
    const stale = backed.filter(u => !files[rel(u)] || (sourceSize.has(u) && files[rel(u)].bytes !== sourceSize.get(u)));
    if (stale.length) error(G, `${stale.length} files missing or older than their source: ${listBad(stale)}; run npm run mirror and push hisn-almuslim-assets`);
    const { bytes, bad, size } = await headAll(backed.map(mirrorOf), /audio|mpeg|font|woff|octet-stream/i);
    const wrong = [...size].filter(([u, n]) => n !== files[u.slice(MIRROR.length + 1)]?.bytes).map(([u]) => u);
    if (bad.length) error(G, `${bad.length} of ${backed.length} files unavailable: ${listBad(bad)}`);
    if (wrong.length) error(G, `${wrong.length} files differ from manifest.json: ${listBad(wrong)}`);
    if (!stale.length && !bad.length && !wrong.length) pass(G, `${backed.length} files, ${mb(bytes)}, same as the sources`);
  } catch (e) { error(G, e.message); }
}

async function recitations() {
  const G = "Recitations (mp3quran.net)";
  const API = "https://www.mp3quran.net/api/v3";
  const rewayat = [...new Set(readJson("quran/index.json").riwayat.flatMap(r => r.audio || []))];
  try {
    const { riwayat } = await getJSON(`${API}/riwayat?language=ar`);
    if (!Array.isArray(riwayat) || !riwayat.length) throw new Error("riwayat list is empty");
    let reciters = 0;
    for (const id of rewayat) {
      const list = (await getJSON(`${API}/reciters?language=ar&rewaya=${id}`)).reciters || [];
      const moshafs = list.flatMap(r => (r.moshaf || []).filter(m => m.rewaya_id === id).map(m => ({ r, m })));
      const usable = moshafs.filter(({ r, m }) => r.name && m.server && /^\d+(,\d+)*$/.test(String(m.surah_list)));
      if (!usable.length) { error(G, `rewaya ${id}: no reciters with a server and surah list`); continue; }
      reciters += usable.length;
      // One surah file per rewaya: must play and allow saving for offline use (CORS).
      const { m } = usable[0]; const first = String(m.surah_list).split(",")[0].padStart(3, "0");
      const res = await request(`${m.server}${first}.mp3`, { method: "HEAD" });
      if (!res.ok || !corsOk(res)) error(G, `rewaya ${id}: sample file ${m.server}${first}.mp3 gave HTTP ${res.status}${corsOk(res) ? "" : ", no CORS header"}`);
    }
    const { radios } = await getJSON(`${API}/radios?language=ar`);
    if (!Array.isArray(radios) || !radios.filter(r => r.url).length) error(G, "reciter radios list is empty");
    if (!errors.some(e => e.startsWith(G))) pass(G, `${rewayat.length} rewayat, ${reciters} recitations, ${radios.length} reciter radios`);
  } catch (e) { error(G, e.message); }
}

async function translations() {
  const G = "Translations of meanings (quranenc.com)";
  const QE = "https://quranenc.com/api/v1";
  try {
    const list = (await getJSON(`${QE}/translations/list?localization=en`)).translations || [];
    if (list.length < 20) throw new Error(`only ${list.length} translations listed`);
    if (!list.every(x => x.key && x.language_iso_code && x.title)) throw new Error("list entries lack key, language_iso_code or title");
    if (!list.some(x => x.key === "english_rwwad")) throw new Error("default English translation english_rwwad is gone");
    const sura = (await getJSON(`${QE}/translation/sura/english_rwwad/1`)).result || [];
    if (sura.length !== 7 || !sura.every(r => r.aya && r.translation)) throw new Error("Al-Fatihah did not come back as 7 translated verses");
    pass(G, `${list.length} translations, sample surah ok`);
  } catch (e) { error(G, e.message); }
}

async function hadithBooks() {
  const G = "Hadith books (cdn.jsdelivr.net)";
  const { source, books } = readJson("hadith/index.json");
  try {
    // Pinned to a commit, so the files never change: every book's first section and its whole-book file must answer.
    // The whole-book file (the app's book search, 0.03–5.5 MB) is downloaded as the app does: jsDelivr can leave a HEAD
    // request for a large file it has not cached yet without an answer, while a GET of the same file answers at once.
    for (const b of books) {
      const get = file => getJSON(`${source.cdn}/${file}`).catch(e => { throw new Error(`${b.id}: ${file}: ${e.message}`); });
      const sec = await get(`ara-${b.id}/sections/${b.sections[0][0]}.min.json`);
      if (!Array.isArray(sec.hadiths) || !sec.hadiths.some(h => h.text)) throw new Error(`${b.id}: first section has no hadith text`);
      const whole = await get(`ara-${b.id}1.min.json`);
      if (!Array.isArray(whole.hadiths) || !whole.hadiths.some(h => h.text)) throw new Error(`${b.id}: whole-book file has no hadith text`);
    }
    pass(G, `${books.length} books answer`);
  } catch (e) { error(G, e.message); }
}

async function tafsirBooks() {
  const G = "Tafsir books (quranenc.com, cdn.jsdelivr.net, raw.githubusercontent.com)";
  const { sources, books } = readJson("tafsir/index.json");
  try {
    const { mirrorOf } = await loadMirror();
    const refused = [];
    // Al-Fatihah from every book (whole surah), plus one verse file from each pinned spa5k book: the sheet reads those.
    // jsDelivr refuses some spa5k files (the repository is over its 50 MB limit) and the app then reads GitHub,
    // so only the GitHub copy failing is an error.
    for (const b of books) {
      if (b.src === "qe") {
        const rows = (await getJSON(`${sources.qe.api}/translation/sura/${b.key}/1`)).result || [];
        if (rows.length !== 7 || !rows.every(r => String(r.translation || "").trim())) throw new Error(`${b.id}: Al-Fatihah did not come back as 7 explained verses`);
        continue;
      }
      for (const [file, ok] of [["1.json", j => Array.isArray(j) && j.some(r => String(r.text || "").trim())], ["2/255.json", j => String(j.text || "").trim()]]) {
        const url = `${sources.spa5k.cdn}/${b.key}/${file}`;
        if (!ok(await getJSON(mirrorOf(url)).catch(e => { throw new Error(`${b.id}: GitHub copy of ${file}: ${e.message}`); }))) throw new Error(`${b.id}: ${file} has no text`);
        const cdn = await request(url, { tries: 1 }).catch(e => ({ ok: false, status: e.message }));
        if (!cdn.ok) refused.push(`${b.id}/${file} (${cdn.status})`);
      }
    }
    if (refused.length) warn(G, `jsDelivr refused ${refused.length} file(s), the app reads them from GitHub: ${refused.join(", ")}`);
    pass(G, `${books.length} books answer`);
  } catch (e) { error(G, e.message); }
}

// Prayer times: finding a city, and naming a GPS position. Warnings only: without them the times still work by GPS.
async function placeSearch() {
  let G = "City search (open-meteo.com)";
  try { const c = (await getJSON("https://geocoding-api.open-meteo.com/v1/search?name=Cairo&count=1&language=ar&format=json")).results?.[0]; if (c?.timezone && c.country_code) pass(G, `${c.name}, ${c.timezone}`); else warn(G, "no city or time zone in the answer"); }
  catch (e) { warn(G, e.message); }
  G = "Place names (nominatim.openstreetmap.org)";
  try { const j = await getJSON("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=30.04&lon=31.24&accept-language=ar"); if (j.address?.country_code) pass(G, j.address.city || j.name || "ok"); else warn(G, "no address in the answer"); }
  catch (e) { warn(G, e.message); }
}

async function radioList(G, list) {
  const bad = [];
  for (const r of list) { let res = await probe(r); if (!res.ok) res = await probe(r); if (!res.ok) bad.push(`${r.name} (${res.info})`); }
  if (bad.length) warn(G, `${bad.length} of ${list.length} stations not responding: ${bad.join(", ")}`);
  else pass(G, `${list.length} stations responding`);
}
const { live, sunnah = [], topics = [] } = readJson("data/radios.json");

// A few workers over a list; fn returns an error text, or "" when the item is fine.
async function each(items, fn, n = 6) {
  const q = [...items], bad = [];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) { const x = q.shift(); const why = await fn(x).catch(e => e.message); if (why) bad.push(why); } }));
  return bad;
}
// Audio series on the radio page (IslamHouse.com): every lesson file. The audio element plays them without CORS.
async function audioSeries() {
  const G = "Audio series"; const { series } = readJson("data/lessons.json");
  const files = series.flatMap(s => s.tracks.map(([u], i) => ({ u, name: `${s.id} ${i + 1}` })));
  const bad = await each(files, async f => { const r = await request(f.u, { method: "HEAD" }); return !r.ok ? `${f.name} (HTTP ${r.status})` : !/audio|mpeg|octet-stream/.test(r.headers.get("content-type") || "") ? `${f.name} (type ${r.headers.get("content-type")})` : ""; });
  if (bad.length) warn(G, `${bad.length} of ${files.length} lessons not answering: ${listBad(bad)}`);
  else pass(G, `${files.length} lessons in ${series.length} series answer`);
}
// Video series: the first and last episode of every playlist still play inside other sites (YouTube oEmbed answers 200).
async function videoSeries() {
  const G = "Video series"; const { series, live } = readJson("data/videos.json"); const channels = live.filter(c => c.url);
  const eps = series.flatMap(s => s.parts.flatMap(p => [...new Set([p.eps[0], p.eps[p.eps.length - 1]])].map(e => ({ id: e[0], name: `${s.id} ${e[0]}` }))));
  const bad = await each(eps, async e => { const r = await request(`https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + e.id)}&format=json`, { tries: 2 }); return r.ok ? "" : `${e.name} (HTTP ${r.status})`; });
  if (bad.length) warn(G, `${bad.length} of ${eps.length} sampled episodes cannot be played in the app (run npm run series): ${listBad(bad)}`);
  else pass(G, `${eps.length} sampled episodes of ${series.length} series play`);
  const G2 = "Live channels";
  const off = await each(channels, async c => { const r = await request(c.url); const text = r.ok ? (await r.text()).slice(0, 20) : ""; return !r.ok ? `${c.en} (HTTP ${r.status})` : !corsOk(r) ? `${c.en} (no CORS header, hls.js needs it)` : !text.startsWith("#EXTM3U") ? `${c.en} (not a playlist)` : ""; });
  if (off.length) warn(G2, `${off.length} of ${channels.length} not answering: ${off.join(", ")}`);
  else pass(G2, `${channels.length} channels answering`);
}

(async () => {
  await Promise.all([Promise.all([adhkarAudio(), mushafPageFonts()]).then(backup), tajweedPageFonts(), recitations(), translations(), hadithBooks(), tafsirBooks(), radioList("Live radios", live), radioList("Hadith radios", sunnah), radioList("Subject radios", topics), audioSeries(), videoSeries(), placeSearch()]);
  const summary = ["## Outside sources", "", ...errors.map(e => `- ❌ ${e}`), ...warnings.map(w => `- ⚠️ ${w}`), ...passed.map(p => `- ✅ ${p}`), ""].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(errors.length ? `\n${errors.length} source(s) need attention` : `\n✓ all sources ok${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
  process.exit(errors.length ? 1 : 0);
})();
