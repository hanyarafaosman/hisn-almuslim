// Sanity checks: required files, adhkar data, Mushaf data, hadith index, radios list, JS syntax.
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const root = path.join(__dirname, "..", "www"); let ok = true;
const fail = m => { ok = false; console.error("✗", m); };
const readJson = f => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));

for (const f of ["index.html", "manifest.webmanifest", "sw.js", "css/fonts.css", "css/app.css", "js/app.js", "js/quran.js", "js/i18n.js", "js/offline.js", "js/mirror.js", "data/audio-sizes.json", "data/hisn.json", "data/hisn.en.json", "data/extras.json", "data/radios.json", "quran/index.json", "i18n/ar.json", "i18n/en.json",
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

// Interface languages: every language listed in js/i18n.js has a strings file that passes check-i18n.js
// LANGS entries look like ["fr", "Français"]; other arrays in the file do not end right after the second string.
const langs = [...new Set([...fs.readFileSync(path.join(root, "js/i18n.js"), "utf8").matchAll(/\["([a-z]{2,3})", "[^"]+"\]/g)].map(m => m[1]))];
for (const l of langs) if (!fs.existsSync(path.join(root, "i18n", l + ".json"))) fail("missing i18n/" + l + ".json");
const i18nCheck = spawnSync(process.execPath, [path.join(__dirname, "check-i18n.js")], { encoding: "utf8" });
if (i18nCheck.status !== 0) fail("i18n: " + i18nCheck.stdout.split("\n").filter(l => l.startsWith("✗")).join("; "));

// JS syntax (Node detects ES module syntax automatically)
for (const f of ["js/app.js", "js/quran.js", "js/hadith.js", "js/i18n.js", "js/offline.js", "js/mirror.js", "sw.js", "../scripts/build-hadith-index.js", "../scripts/build-mushaf-pages.js", "../scripts/serve.js", "../scripts/build-quran.js", "../scripts/check-radios.js", "../scripts/check-i18n.js", "../scripts/build-hisn-en.js", "../scripts/i18n-source.js", "../scripts/measure-audio.js", "../scripts/fetch-fonts.js", "../scripts/check-sources.js", "../scripts/build-mirror.js", "../scripts/build-site.js", "../scripts/make-og.js"]) {
  const r = spawnSync(process.execPath, ["--check", path.join(root, f)], { encoding: "utf8" });
  if (r.status !== 0) fail(`${f}: ${(r.stderr || "").split("\n").slice(0, 5).join(" ")}`);
}

console.log(ok
  ? `✓ all checks passed (${db.categories.length} adhkar chapters, ${langs.length} UI languages, ${qi.riwayat.length} riwayat / ${ayat} ayat, ${hx.books.length} hadith books / ${hadithCount} hadith, ${radios.live.length} live radios)`
  : "checks failed");
process.exit(ok ? 0 : 1);
