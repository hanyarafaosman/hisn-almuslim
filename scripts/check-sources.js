// Checks every outside service the app relies on, so a broken source is noticed before users report it.
// Run daily by .github/workflows/sources.yml (a failed run emails the repository owner). Usage: npm run check:sources
//   errors   (exit 1): adhkar audio (hisnmuslim.com), Mushaf page fonts (static.qurancdn.com),
//                      recitations API (mp3quran.net), translations API (quranenc.com), hadith books (jsDelivr)
//   warnings (exit 0): live radio stations, changed audio sizes
const fs = require("fs"), path = require("path");
const { probe } = require("./check-radios.js");
const WWW = path.join(__dirname, "..", "www");
const readJson = f => JSON.parse(fs.readFileSync(path.join(WWW, f), "utf8"));
const ORIGIN = "https://hanyarafaosman.github.io"; // the app fetches cross-origin, so CORS must allow it
const GH = process.env.GITHUB_ACTIONS === "true";
const errors = [], warnings = [], passed = [];
const error = (group, msg) => { errors.push(`${group}: ${msg}`); console.log(GH ? `::error title=${group}::${msg}` : `✗ ${group}: ${msg}`); };
const warn = (group, msg) => { warnings.push(`${group}: ${msg}`); console.log(GH ? `::warning title=${group}::${msg}` : `⚠ ${group}: ${msg}`); };
const pass = (group, msg) => { passed.push(`${group}: ${msg}`); console.log(`✓ ${group}: ${msg}`); };

// One request with a timeout, retried so a single network hiccup does not raise an alarm.
async function request(url, { method = "GET", tries = 3 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(url, { method, signal: ctl.signal, headers: { Origin: ORIGIN, "User-Agent": "HisnAlMuslim-source-check" } });
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
async function headAll(urls, accept) {
  const q = [...urls], bad = [], size = new Map(); let bytes = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (q.length) {
      const u = q.shift();
      try {
        const r = await request(u, { method: "HEAD" });
        const why = !r.ok ? "HTTP " + r.status : !corsOk(r) ? "no CORS header" : !accept.test(r.headers.get("content-type") || "") ? "type " + r.headers.get("content-type") : "";
        if (why) bad.push(`${u} (${why})`); else { size.set(u, Number(r.headers.get("content-length")) || 0); bytes += size.get(u); }
      } catch (e) { bad.push(`${u} (${e.message})`); }
    }
  }));
  return { bytes, bad, size };
}
const mb = n => (n / 1048576).toFixed(1) + " MB";
const listBad = bad => bad.slice(0, 5).join(", ") + (bad.length > 5 ? ` … and ${bad.length - 5} more` : "");

async function adhkarAudio() {
  const G = "Adhkar audio (hisnmuslim.com)";
  const db = readJson("data/hisn.json"), sizes = readJson("data/audio-sizes.json");
  const chapters = db.categories.map(c => c.audio).filter(Boolean), items = db.categories.flatMap(c => c.items.map(i => i.audio)).filter(Boolean);
  const urls = [...new Set([...chapters, ...items])];
  const { bytes, bad, size } = await headAll(urls, /audio|mpeg|octet-stream/i);
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
    const { bytes, bad } = await headAll(urls, /font|woff|octet-stream/i);
    if (bad.length) error(G, `${v}: ${bad.length} of 604 pages unavailable: ${listBad(bad)}`);
    // The glyph codes in mushaf/madinah.json only fit these exact fonts: a size change means the source replaced them.
    else if (bytes !== f.bytes) error(G, `${v}: fonts changed at the source (${bytes} bytes, built with ${f.bytes}); check the pages and rebuild with npm run mushaf:pages`);
    else pass(G, `${v}: 604 pages, ${mb(bytes)}, unchanged`);
  }
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
    for (const b of books) {
      const sec = await getJSON(`${source.cdn}/ara-${b.id}/sections/${b.sections[0][0]}.min.json`);
      if (!Array.isArray(sec.hadiths) || !sec.hadiths.some(h => h.text)) throw new Error(`${b.id}: first section has no hadith text`);
      const whole = await request(`${source.cdn}/ara-${b.id}1.min.json`, { method: "HEAD" });
      if (!whole.ok) throw new Error(`${b.id}: whole-book file gave HTTP ${whole.status}`);
    }
    pass(G, `${books.length} books answer`);
  } catch (e) { error(G, e.message); }
}

async function liveRadios() {
  const G = "Live radios";
  const { live } = readJson("data/radios.json");
  const bad = [];
  for (const r of live) { let res = await probe(r); if (!res.ok) res = await probe(r); if (!res.ok) bad.push(`${r.name} (${res.info})`); }
  if (bad.length) warn(G, `${bad.length} of ${live.length} stations not responding: ${bad.join(", ")}`);
  else pass(G, `${live.length} stations responding`);
}

(async () => {
  await Promise.all([adhkarAudio(), mushafPageFonts(), recitations(), translations(), hadithBooks(), liveRadios()]);
  const summary = ["## Outside sources", "", ...errors.map(e => `- ❌ ${e}`), ...warnings.map(w => `- ⚠️ ${w}`), ...passed.map(p => `- ✅ ${p}`), ""].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(errors.length ? `\n${errors.length} source(s) need attention` : `\n✓ all sources ok${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
  process.exit(errors.length ? 1 : 0);
})();
