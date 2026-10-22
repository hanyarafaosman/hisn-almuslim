// Sanity checks: required files, adhkar data, Mushaf data, hadith index, radios list, JS syntax.
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const root = path.join(__dirname, "..", "www"); let ok = true;
const fail = m => { ok = false; console.error("✗", m); };
const readJson = f => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));

for (const f of ["index.html", "manifest.webmanifest", "sw.js", "css/fonts.css", "css/app.css", "js/app.js", "js/quran.js", "js/i18n.js", "js/offline.js", "js/mirror.js", "js/hadith.js", "js/tafsir.js", "js/asma.js", "js/kutub.js", "js/faqih.js", "js/prayer.js", "js/prayer-calc.js", "js/videos.js", "js/install.js", "js/vendor/hls.light.min.js", "adhan/index.json", "tafsir/index.json", "asma/book.json", "kutub/index.json", "data/audio-sizes.json", "data/hisn.json", "data/hisn.en.json", "data/extras.json", "data/radios.json", "data/lessons.json", "data/videos.json", "quran/index.json", "mushaf/madinah.json", "mushaf/ayat.json", "mushaf/jalala.json", "mushaf/tajweed.json", "i18n/ar.json", "i18n/en.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/favicon.svg", "icons/og-image.jpg",
  "google1c71f2e57f82590c.html"]) // Google Search Console ownership: removing it loses the verification
  if (!fs.existsSync(path.join(root, f))) fail("missing " + f);

// Adhkar
const db = readJson("data/hisn.json");
const ids = new Set(db.categories.map(c => c.id));
if (ids.size !== db.categories.length) fail("duplicate category ids");
db.sections.flatMap(s => s.cats).forEach(id => { if (!ids.has(id)) fail("section references unknown cat " + id); });
const used = new Set(db.sections.flatMap(s => s.cats)); ids.forEach(id => { if (!used.has(id)) fail("cat not in any section " + id); });
db.categories.forEach(c => c.items.forEach(i => { if (!i.text || !(i.repeat >= 1)) fail(`bad item ${c.id}:${i.id}`); if (i.audio && !/\/[^/]+\.mp3$/.test(i.audio)) fail(`bad audio url ${c.id}:${i.id}`); }));

// The counter must match a count written in the dhikr text, e.g. "(سبع مرات)".
// Allowed exceptions: the count applies to only part of the dhikr, or to an action rather than words.
const PARTIAL_REPEAT = new Set([66, 67, 106, 114, 138]);
const COUNT_WORDS = [[/مرتين|مرتان/, 2], [/ثلاث\S* وثلاثين/, 33], [/أربع\S* وثلاثين/, 34], [/ثلاث/, 3], [/أربع/, 4], [/خمس/, 5], [/سبع/, 7], [/عشر/, 10], [/مائة|مئة/, 100]];
db.categories.forEach(c => c.items.forEach(i => {
  if (PARTIAL_REPEAT.has(i.id)) return;
  const plain = i.text.replace(/[ً-ْٰـ]/g, "");
  const hints = [...plain.matchAll(/\(([^()]{0,40}مر[^()]{0,40})\)/g)].map(m => m[1]);
  const counts = hints.map(h => (COUNT_WORDS.find(([re]) => re.test(h)) || [null, /مرة واحدة/.test(h) ? 1 : null])[1]).filter(Boolean);
  if (counts.length && !counts.includes(i.repeat)) fail(`repeat ${c.id}:${i.id} is ${i.repeat} but the text says ${counts.join("/")} — fix in scripts/hisn-corrections.js`);
}));

// Mushaf: every riwayah file + font exists and verse counts match the index
const qi = readJson("quran/index.json"); let ayat = 0;
if (qi.riwayat.length !== 8) fail("expected 8 riwayat, got " + qi.riwayat.length);
for (const r of qi.riwayat) {
  for (const f of [r.data, r.font]) if (!fs.existsSync(path.join(root, f))) fail("missing " + f);
  const d = readJson(r.data);
  const n = d.s.reduce((a, s) => a + s.length, 0); ayat += n;
  if (d.s.length !== 114 || n !== r.ayat) fail(`${r.id}: ${d.s.length} surahs / ${n} ayat, index says ${r.ayat}`);
  if (r.surahs.some((s, i) => s[1] !== d.s[i].length)) fail(`${r.id}: surah lengths differ from index`);
  if (d.e && d.e.some((s, i) => s.length !== d.s[i].length)) fail(`${r.id}: emlaey length mismatch`);
  if (!r.basmala) fail(`${r.id}: missing basmala`);
}

// Printed pages (Hafs): the verse map mushaf/ayat.json must cover exactly the glyphs of mushaf/madinah.json,
// every verse once and in order, and give 240 quarters of a hizb in order. Both files are cached for good
// (QURAN_CACHE in sw.js), so a rebuild of either must also rename the files or bump QURAN_CACHE.
const pagesJson = readJson("mushaf/madinah.json"), ayatJson = readJson("mushaf/ayat.json"); const hafsIdx = qi.riwayat.find(r => r.id === "hafs");
{
  let prev = [1, 0], verses = 0;
  pagesJson.pages.forEach((page, i) => {
    const glyphs = page.filter(x => x.w1).reduce((n, x) => n + x.w1.split(" ").length, 0);
    const runs = ayatJson.pages[i] || [];
    if (runs.reduce((n, r) => n + r[2], 0) !== glyphs) fail(`mushaf/ayat.json page ${i + 1}: glyph count differs from madinah.json`);
    runs.forEach(([s, a]) => { const next = a === prev[1] + 1 && s === prev[0] || (a === 1 && s === prev[0] + 1); if (!next) fail(`mushaf/ayat.json page ${i + 1}: ${s}:${a} out of order`); prev = [s, a]; verses++; });
  });
  if (ayatJson.pages.length !== 604 || verses !== hafsIdx.ayat) fail(`mushaf/ayat.json: ${ayatJson.pages.length} pages / ${verses} verses`);
  if (ayatJson.rub.length !== 240 || ayatJson.rub.some(([s, a], i) => i && !(s > ayatJson.rub[i - 1][0] || (s === ayatJson.rub[i - 1][0] && a > ayatJson.rub[i - 1][1])))) fail("mushaf/ayat.json: quarters must be 240 in order");
  // Cross-check with the King Fahd Complex text: every quarter starts at a verse marked ۞, except at the start of a surah.
  const hafsText = readJson(hafsIdx.data); const rubMark = (s, a) => hafsText.s[s - 1][a - 1][0].includes("۞");
  const marked = hafsText.s.flatMap((ay, si) => ay.map((x, ai) => [si + 1, ai + 1]).filter(([s, a]) => rubMark(s, a)));
  if (ayatJson.rub.some(([s, a]) => a !== 1 && !rubMark(s, a)) || marked.some(([s, a]) => !ayatJson.rub.some(r => r[0] === s && r[1] === a))) fail("mushaf/ayat.json: quarters differ from the ۞ marks in quran/hafs.json");
}

// The name of Allah on the printed pages (mushaf/jalala.json): glyph indexes inside each page, 2699 + 5 (اللهم) words.
{
  const jl = readJson("mushaf/jalala.json"), tj = readJson("mushaf/tajweed.json");
  if (jl.count !== 2704 || jl.pages.length !== 604) fail(`mushaf/jalala.json: ${jl.count} words on ${jl.pages.length} pages`);
  jl.pages.forEach((idx, i) => { const glyphs = pagesJson.pages[i].filter(x => x.w1).reduce((n, x) => n + x.w1.split(" ").length, 0); if (idx.some((g, j) => !(g >= 0 && g < glyphs) || (j && g <= idx[j - 1]))) fail(`mushaf/jalala.json page ${i + 1}: glyph index outside the page or out of order`); });
  if (!/{n}/.test(tj.fonts?.v4?.url || "") || !(tj.fonts.v4.bytes > 0)) fail("mushaf/tajweed.json: v4 font url with {n} and size required");
}

// Interface fonts are shipped with the app: css/fonts.css, www/fonts/ and the FONTS precache list in sw.js must agree
const fontFiles = fs.readdirSync(path.join(root, "fonts")).filter(n => n.endsWith(".woff2")).map(n => "fonts/" + n).sort();
const cssFonts = [...fs.readFileSync(path.join(root, "css/fonts.css"), "utf8").matchAll(/url\(\.\.\/(fonts\/[^)]+)\)/g)].map(m => m[1]).sort();
const swFonts = [...(/const FONTS = \[([^\]]+)\]/.exec(fs.readFileSync(path.join(root, "sw.js"), "utf8")) || [, ""])[1].matchAll(/"\.\/(fonts\/[^"]+)"/g)].map(m => m[1]).sort();
if (!fontFiles.length || String(fontFiles) !== String(cssFonts) || String(fontFiles) !== String(swFonts)) fail("fonts: www/fonts, css/fonts.css and FONTS in sw.js differ — rerun scripts/fetch-fonts.js and update sw.js");
if (/fonts\.googleapis|fonts\.gstatic/.test(fs.readFileSync(path.join(root, "index.html"), "utf8"))) fail("index.html still loads Google Fonts");

// The service worker routes the backup copy by the same address as js/mirror.js
const mirrorBase = (/export const MIRROR = "([^"]+)"/.exec(fs.readFileSync(path.join(root, "js/mirror.js"), "utf8")) || [])[1];
if (!mirrorBase || !fs.readFileSync(path.join(root, "sw.js"), "utf8").includes(`new URL("${mirrorBase}/")`)) fail("sw.js MIRROR differs from js/mirror.js");

// Radios must be HTTPS (the app is served over HTTPS)
const radios = readJson("data/radios.json");
radios.live.forEach(r => { if (!r.url.startsWith("https://")) fail("radio must be https: " + r.id); });
// The radio page and the channels page share six groups. Subject stations and audio series each sit in one, with Arabic and English names.
const GROUPS = ["quran", "sunnah", "seerah", "aqeedah", "fiqh", "misc"];
const unique = (list, what) => { if (new Set(list.map(x => x.id)).size !== list.length) fail(`${what}: duplicate ids`); };
unique(radios.topics || [], "radio topics");
(radios.topics || []).forEach(r => {
  if (!r.url.startsWith("https://")) fail("radio must be https: topic " + r.id);
  if (!GROUPS.includes(r.group) || r.group === "sunnah" || r.group === "aqeedah") fail(`radio topic ${r.id}: group ${r.group} (the sunnah list holds the hadith stations; creed has no station)`);
  if (!r.name || !r.en) fail(`radio topic ${r.id}: needs name and en`);
});
const lessons = readJson("data/lessons.json"); unique(lessons.series, "audio series");
lessons.series.forEach(s => {
  if (!GROUPS.includes(s.group) || !s.ar || !s.en || !s.by || !s.byEn || !s.source || !s.sourceEn || !(s.ih > 0)) fail("audio series: incomplete " + s.id);
  if (!s.tracks.length || s.tracks.some(([u]) => !/^https:\/\/[^/]+\/.+\.mp3$/.test(u))) fail(`audio series ${s.id}: every lesson needs an https MP3`);
});
// Video series: channels known, every episode a YouTube id; live channels HTTPS HLS.
const videos = readJson("data/videos.json"); unique(videos.series, "video series"); let episodes = 0;
videos.series.forEach(s => {
  if (!GROUPS.includes(s.group) || !s.ar || !s.en || !s.by || !s.byEn || !videos.channels[s.ch]) fail("video series: incomplete " + s.id);
  if (!s.parts.length) fail(`video series ${s.id}: no playlists`);
  s.parts.forEach(p => {
    if (!/^PL[\w-]+$/.test(p.list) || !p.eps.length) fail(`video series ${s.id}: bad playlist ${p.list}`);
    if (s.parts.length > 1 && (!p.ar || !p.en)) fail(`video series ${s.id}: a part needs ar/en names`);
    p.eps.forEach(e => { episodes++; if (!/^[\w-]{11}$/.test(e[0]) || typeof e[1] !== "string" || !(e[2] >= 0)) fail(`video series ${s.id}: bad episode ${JSON.stringify(e)}`); });
  });
});
GROUPS.forEach(g => { if (!videos.series.some(s => s.group === g)) fail("video series: nothing in group " + g); });
// A live channel is an HLS stream, or (yt) the YouTube channel of a mosque's lessons, broadcast while each is given.
videos.live.forEach(c => { if (!(c.yt ? videos.channels[c.yt] : /^https:\/\/.+\.m3u8$/.test(c.url)) || !c.ar || !c.en || !c.at || !c.atEn) fail("live channel: incomplete " + c.id); });

// Google Play listing texts (store/android/listing.md) must fit Play Console's limits.
const listing = fs.readFileSync(path.join(root, "..", "store", "android", "listing.md"), "utf8");
const LIMITS = { title: 30, short: 80, full: 4000 }; let texts = 0;
for (const m of listing.matchAll(/<!-- (title|short|full)-([a-z]+) -->\r?\n([\s\S]*?)\r?\n<!-- \/\1-\2 -->/g)) {
  texts++; const n = [...m[3]].length;
  if (n > LIMITS[m[1]]) fail(`store listing ${m[1]}-${m[2]} is ${n} characters, Google Play allows ${LIMITS[m[1]]}`);
}
if (texts < 6) fail("store/android/listing.md: expected title, short and full texts in Arabic and English");

// Hadith books: pinned source, contiguous hadith ranges per book, sizes known, translations only for UI languages.
const hx = readJson("hadith/index.json"); let hadithCount = 0;
if (!/@[0-9a-f]{40}\/editions$/.test(hx.source.cdn)) fail("hadith: source must be pinned to a commit");
for (const b of hx.books) {
  hadithCount += b.count;
  if (!b.ar || !b.en || !b.count || !(b.bytes > 0) || !b.sections.length) fail("hadith: incomplete book " + b.id);
  b.sections.forEach(x => { if (!x[1] || !x[2] || !(x[3] <= x[4]) || !(x[5] > 0)) fail(`hadith: bad section ${b.id}:${x[0]}`); });
  if (b.sections.reduce((a, x) => a + x[5], 0) !== b.count) fail(`hadith: section counts do not add up for ${b.id}`);
  for (const [l, ed] of Object.entries(b.langs)) {
    if (!fs.existsSync(path.join(root, "i18n", l + ".json"))) fail(`hadith: translation for unknown UI language ${l}`);
    if (!ed.endsWith("-" + b.id) || !(b.trBytes[l] > 0)) fail(`hadith: bad translation ${b.id}:${l}`);
  }
}
// Hadith radios: HTTPS, and named after a hadith book in the index or by their own interface string.
const enStrings = readJson("i18n/en.json");
(radios.sunnah || []).forEach(r => {
  if (!r.url.startsWith("https://")) fail("radio must be https: sunnah " + r.id);
  if (!hx.books.some(b => b.id === r.id) && !enStrings["hadith.radio." + r.id]) fail(`sunnah radio ${r.id}: not a hadith book and no hadith.radio.${r.id} string`);
});

// Tafsir books: pinned source, every book has a string for its length, verse groups and moves inside the Hafs (Kufan) count.
const tx = readJson("tafsir/index.json"); const kufi = qi.riwayat.find(r => r.id === "hafs").surahs.map(x => x[1]);
if (!/@[0-9a-f]{40}\/tafsir$/.test(tx.sources.spa5k.cdn)) fail("tafsir: spa5k source must be pinned to a commit");
if (new Set(tx.books.map(b => b.id)).size !== tx.books.length) fail("tafsir: duplicate book ids");
for (const b of tx.books) {
  if (!b.ar || !b.en || !b.by || !b.byEn || !b.key || !(b.bytes > 0) || !["qe", "spa5k"].includes(b.src)) fail("tafsir: incomplete book " + b.id);
  if (!enStrings["tafsir.len." + b.len]) fail(`tafsir: ${b.id} has length "${b.len}" with no tafsir.len string`);
  const inside = (s, a) => s >= 1 && s <= 114 && a >= 1 && a <= kufi[s - 1];
  Object.entries(b.groups || {}).forEach(([s, gs]) => gs.forEach(([x, y]) => { if (!(x < y) || !inside(Number(s), x) || !inside(Number(s), y)) fail(`tafsir: ${b.id} bad group ${s}:${x}-${y}`); }));
  Object.entries(b.missing || {}).forEach(([s, as]) => as.forEach(a => { if (!inside(Number(s), a)) fail(`tafsir: ${b.id} bad missing verse ${s}:${a}`); }));
  (b.moves || []).forEach(m => { if (m.length !== 6 || !inside(m[0], m[1]) || !inside(m[4], m[5]) || !(m[2] > 0) || !["head", "tail"].includes(m[3])) fail(`tafsir: ${b.id} bad move ${m}`); });
}
// The Names of Allah: 99 names in order, each in one entry, every footnote reference has its note.
const asma = readJson("asma/book.json");
if (asma.names.length !== 99 || asma.names.some((x, i) => x.n !== i + 1 || !x.name || !x.plain || !asma.groups[x.g]?.names.includes(x.n))) fail("asma: names must be 1…99, each in its entry");
for (const box of [...asma.groups, ...asma.chapters]) {
  const refs = box.body.flatMap(x => [...String(x.p || "").matchAll(/⟦(\d+)⟧/g)].map(m => Number(m[1])));
  if (refs.some(n => !box.notes[n - 1]) || (box.head || []).some(n => !box.notes[n - 1])) fail(`asma: footnote without a note in ${box.title || "names " + box.names}`);
}

// Books of the library: each book file (contents and reading pages) and each part file (the text of reading pages)
// is named after the hash of its bytes; the contents point to places that exist, and every footnote mark has its
// note. No file is left that the index does not list.
const kt = readJson("kutub/index.json");
const ktHash = text => require("crypto").createHash("sha256").update(text.replace(/\r?\n$/, "")).digest("hex").slice(0, 10);
const ktFiles = new Set(kt.books.flatMap(b => [b.file, ...(b.chunks || []).map((h, k) => `${b.id}/${k}.${h}.json`)]));
const walk = d => fs.readdirSync(path.join(root, "kutub", d)).flatMap(f => fs.statSync(path.join(root, "kutub", d, f)).isDirectory() ? walk(d ? `${d}/${f}` : f) : [d ? `${d}/${f}` : f]);
for (const f of walk("")) if (f !== "index.json" && !ktFiles.has(f)) fail("kutub: file not in the index " + f);
if (new Set(kt.books.map(b => b.id)).size !== kt.books.length) fail("kutub: duplicate book ids");
for (const b of kt.books) {
  if (!b.ar || !b.en || !b.by || !b.byEn || !(b.died >= 0) || !b.about || !b.aboutEn || !b.edition || !/^https:\/\/app\.turath\.io\/book\/\d+$/.test(b.url)) fail("kutub: incomplete book " + b.id);
  if (!kt.groups.includes(b.group) || !enStrings["kutub." + b.group] || !kt.authors[b.author] || (b.madhhab && !enStrings["kutub." + b.madhhab])) fail(`kutub: ${b.id} has a bad shelf, author or school`);
  const file = path.join(root, "kutub", b.file || "");
  if (!fs.existsSync(file) || !b.chunks?.length) { fail("kutub: missing " + b.file); continue; }
  const text = fs.readFileSync(file, "utf8");
  if (b.file !== `${b.id}.${ktHash(text)}.json`) fail(`kutub: ${b.file} does not match its text (rebuild with npm run kutub)`);
  const book = JSON.parse(text);
  const parts = b.chunks.map((h, k) => {
    const f = path.join(root, "kutub", b.id, `${k}.${h}.json`);
    if (!fs.existsSync(f)) { fail(`kutub: missing ${b.id}/${k}.${h}.json`); return {}; }
    const t = fs.readFileSync(f, "utf8"); if (ktHash(t) !== h) fail(`kutub: ${b.id}/${k}.${h}.json does not match its text`);
    return JSON.parse(t);
  });
  const textOf = i => book.sections[i]?.c != null ? parts[book.sections[i].c]?.[i] : null;
  const anchors = i => new Set((textOf(i)?.body || []).map(x => x.a).filter(Boolean));
  for (const e of book.toc) {
    const s = book.sections[e.s];
    if (!s || !e.t) { fail(`kutub: ${b.id} contents entry «${e.t}» points nowhere`); continue; }
    if ((e.a && !anchors(e.s).has(e.a)) || (e.fn && !textOf(e.s)?.notes?.[e.fn - 1]) || ((e.a || e.fn) && s.c == null)) fail(`kutub: ${b.id} contents entry «${e.t}» points to a missing place`);
  }
  if (!book.sections.some(s => s.c != null)) fail(`kutub: ${b.id} has no text`);
  book.sections.forEach((s, i) => {
    if (s.c == null) return;
    const x = textOf(i); if (!x) { fail(`kutub: ${b.id} «${s.t}» has no text in part ${s.c}`); return; }
    const refs = [...JSON.stringify([s.th || "", x.body || []]).matchAll(/⟦(\d+)⟧/g)].map(m => Number(m[1]));
    if (refs.some(n => !x.notes?.[n - 1]) || (x.notes || []).some((y, k) => !refs.includes(k + 1))) fail(`kutub: ${b.id} «${s.t}» has a footnote mark without its note, or a note without its mark`);
  });
}

// Adhan recordings: each file is named after its id and the hash of its bytes and is an AAC (ADTS) stream, each has its
// licence, source and an interface name, there is one for Fajr and one for the other prayers (the defaults in js/prayer.js),
// and no file is left that the index does not list. The service worker and js/prayer.js keep them in the same cache.
{
  const ax = readJson("adhan/index.json"), files = new Set(ax.voices.map(v => v.file));
  for (const f of fs.readdirSync(path.join(root, "adhan"))) if (f !== "index.json" && !files.has("adhan/" + f)) fail("adhan: file not in the index " + f);
  for (const v of ax.voices) {
    const file = path.join(root, v.file || "");
    if (!fs.existsSync(file)) { fail("adhan: missing " + v.file); continue; }
    const buf = fs.readFileSync(file), hash = require("crypto").createHash("sha256").update(buf).digest("hex").slice(0, 10);
    if (v.file !== `adhan/${v.id}.${hash}.aac` || buf.length !== v.bytes) fail(`adhan: ${v.file} does not match its bytes (rebuild with npm run adhan)`);
    if (!(buf[0] === 0xff && (buf[1] & 0xf0) === 0xf0)) fail(`adhan: ${v.file} is not an AAC (ADTS) stream`);
    if (!v.by || !v.license || !/^https:\/\/creativecommons\.org\//.test(v.licenseUrl) || !/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(v.url) || !(v.seconds > 60) || !(v.short > 5 && v.short < v.seconds)) fail("adhan: incomplete entry " + v.id);
    if (!enStrings["prayer.v." + v.id]) fail(`adhan: no prayer.v.${v.id} string`);
  }
  const pj = fs.readFileSync(path.join(root, "js/prayer.js"), "utf8");
  const def = (/voice: "([\w-]+)", fajrVoice: "([\w-]+)"/.exec(pj) || []).slice(1);
  if (!ax.voices.some(v => v.id === def[0] && !v.fajr) || !ax.voices.some(v => v.id === def[1] && v.fajr)) fail("adhan: the default voices in js/prayer.js are not in adhan/index.json");
  const cacheOf = src => (/const ADHAN_CACHE = "([^"]+)"/.exec(src) || [])[1];
  if (!cacheOf(pj) || cacheOf(pj) !== cacheOf(fs.readFileSync(path.join(root, "sw.js"), "utf8"))) fail("adhan: ADHAN_CACHE differs between sw.js and js/prayer.js");
}

// The prayer alerts server (push/): it imports the app's own js/prayer-calc.js (never a copy), the app and the server
// use the same VAPID public key, sw.js reads what js/prayer.js leaves for it, and push/test.js passes (it needs
// node:sqlite, Node 22.13 or later).
{
  const pj = fs.readFileSync(path.join(root, "js/prayer.js"), "utf8"), sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const pushDir = path.join(root, "..", "push"), sched = fs.readFileSync(path.join(pushDir, "src/schedule.js"), "utf8");
  if (!sched.includes('from "../../www/js/prayer-calc.js"')) fail("push/src/schedule.js must import www/js/prayer-calc.js");
  const copies = fs.readdirSync(path.join(pushDir, "src")).filter(f => /prayer|calc/i.test(f));
  if (copies.length) fail("push/src must not hold a copy of the prayer calculation: " + copies.join(", "));
  const [, url, key] = /const PUSH = \{ url: "([^"]*)", key: "([^"]*)" \}/.exec(pj) || [];
  const tomlKey = (/^VAPID_PUBLIC_KEY = "([^"]*)"/m.exec(fs.readFileSync(path.join(pushDir, "wrangler.toml"), "utf8")) || [])[1];
  if (url === undefined || tomlKey === undefined) fail("PUSH in js/prayer.js or VAPID_PUBLIC_KEY in push/wrangler.toml not found");
  else {
    if (key !== tomlKey) fail("PUSH.key in js/prayer.js differs from VAPID_PUBLIC_KEY in push/wrangler.toml (rerun npm run keys in push/)");
    if (url && (!/^https:\/\/[\w.-]+$/.test(url) || !/^[\w-]{87}$/.test(key))) fail("PUSH in js/prayer.js: an https address without a trailing slash, and the 65-byte public key");
  }
  const info = (/const PRAYER_INFO = "([^"]+)"/.exec(sw) || [])[1];
  if (!info || !pj.includes(`put("${info}"`)) fail("sw.js PRAYER_INFO differs from the file js/prayer.js writes");
  let sqlite = true; try { require("node:sqlite"); } catch { sqlite = false; }
  if (!sqlite) console.log("⚠ push/test.js skipped: it needs node:sqlite (Node 22.13 or later)");
  else {
    const r = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", path.join(pushDir, "test.js")], { encoding: "utf8", cwd: pushDir });
    if (r.status !== 0) fail("push/test.js: " + (r.stderr + r.stdout).split("\n").filter(l => l.startsWith("✗")).join("; "));
  }
}

// The fiqh research server (faqih/): it checks quotations with the same normalisation the index was cut with
// (scripts/faqih-chunk.mjs, imported, never copied), the app names the server the way check-sources.js reads it,
// and the tests of the passages (scripts/faqih-test.mjs) and of the server (faqih/test.js, needs node:sqlite) pass.
{
  const faqihDir = path.join(root, "..", "faqih");
  for (const f of ["src/verify.js", "src/prompt.js"]) if (!fs.readFileSync(path.join(faqihDir, f), "utf8").includes('from "../../scripts/faqih-chunk.mjs"')) fail(`faqih/${f} must import scripts/faqih-chunk.mjs`);
  const copies = fs.readdirSync(path.join(faqihDir, "src")).filter(f => /chunk|normali/i.test(f));
  if (copies.length) fail("faqih/src must not hold a copy of the passage code: " + copies.join(", "));
  const url = (/const FAQIH = \{ url: "([^"]*)" \}/.exec(fs.readFileSync(path.join(root, "js/faqih.js"), "utf8")) || [])[1];
  if (url === undefined) fail("FAQIH in js/faqih.js not found");
  else if (url && !/^https:\/\/[\w.-]+$/.test(url)) fail("FAQIH.url in js/faqih.js: an https address without a trailing slash");
  const t1 = spawnSync(process.execPath, [path.join(__dirname, "faqih-test.mjs")], { encoding: "utf8" });
  if (t1.status !== 0) fail("scripts/faqih-test.mjs: " + (t1.stderr + t1.stdout).split("\n").filter(l => l.startsWith("✗")).join("; "));
  let sqlite = true; try { require("node:sqlite"); } catch { sqlite = false; }
  if (!sqlite) console.log("⚠ faqih/test.js skipped: it needs node:sqlite (Node 22.13 or later)");
  else {
    const r = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", path.join(faqihDir, "test.js")], { encoding: "utf8", cwd: faqihDir });
    if (r.status !== 0) fail("faqih/test.js: " + (r.stderr + r.stdout).split("\n").filter(l => l.startsWith("✗")).join("; "));
  }
}

// Interface languages: every language listed in js/i18n.js has a strings file that passes check-i18n.js
// LANGS entries look like ["fr", "Français"]; other arrays in the file do not end right after the second string.
const langs = [...new Set([...fs.readFileSync(path.join(root, "js/i18n.js"), "utf8").matchAll(/\["([a-z]{2,3})", "[^"]+"\]/g)].map(m => m[1]))];
for (const l of langs) if (!fs.existsSync(path.join(root, "i18n", l + ".json"))) fail("missing i18n/" + l + ".json");
const i18nCheck = spawnSync(process.execPath, [path.join(__dirname, "check-i18n.js")], { encoding: "utf8" });
if (i18nCheck.status !== 0) fail("i18n: " + i18nCheck.stdout.split("\n").filter(l => l.startsWith("✗")).join("; "));

// JS syntax (Node detects ES module syntax automatically)
for (const f of ["js/app.js", "js/prayer.js", "js/prayer-calc.js", "../scripts/build-adhan.js", "../scripts/check-prayer.js", "js/quran.js", "js/hadith.js", "js/tafsir.js", "js/asma.js", "js/kutub.js", "js/videos.js", "../scripts/build-series.js", "../scripts/build-tafsir-index.js", "../scripts/build-asma.js", "../scripts/build-kutub.js", "js/i18n.js", "js/offline.js", "js/mirror.js", "sw.js", "../scripts/build-hadith-index.js", "../scripts/build-mushaf-pages.js", "../scripts/build-mushaf-ayat.js", "../scripts/build-mushaf-colors.js", "../scripts/serve.js", "../scripts/build-quran.js", "../scripts/check-radios.js", "../scripts/check-i18n.js", "../scripts/build-hisn-en.js", "../scripts/i18n-source.js", "../scripts/measure-audio.js", "../scripts/fetch-fonts.js", "../scripts/check-sources.js", "../scripts/build-mirror.js", "../scripts/build-site.js", "../scripts/make-og.js", "../scripts/headless.js", "../scripts/make-store.js",
  "../push/src/index.js", "../push/src/webpush.js", "../push/src/schedule.js", "../push/keys.js", "../push/test.js",
  "js/faqih.js", "../scripts/faqih-chunk.mjs", "../scripts/faqih-test.mjs", "../scripts/build-faqih.mjs", "../faqih/src/index.js", "../faqih/src/prompt.js", "../faqih/src/verify.js", "../faqih/src/llm.js", "../faqih/test.js"]) {
  const r = spawnSync(process.execPath, ["--check", path.join(root, f)], { encoding: "utf8" });
  if (r.status !== 0) fail(`${f}: ${(r.stderr || "").split("\n").slice(0, 5).join(" ")}`);
}

console.log(ok
  ? `✓ all checks passed (${db.categories.length} adhkar chapters, ${langs.length} UI languages, ${qi.riwayat.length} riwayat / ${ayat} ayat, ${hx.books.length} hadith books / ${hadithCount} hadith, ${tx.books.length} tafsir books, ${asma.names.length} names of Allah, ${kt.books.length} creed and fiqh books, ${readJson("adhan/index.json").voices.length} adhan recordings, ${radios.live.length} live radios, ${(radios.sunnah || []).length} hadith radios, ${(radios.topics || []).length} subject radios, ${lessons.series.length} audio series, ${videos.series.length} video series / ${episodes} episodes, ${videos.live.length} live channels)`
  : "checks failed");
process.exit(ok ? 0 : 1);
