// Sanity checks: required files, adhkar data, Mushaf data, radios list, JS syntax.
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const root = path.join(__dirname, "..", "www"); let ok = true;
const fail = m => { ok = false; console.error("✗", m); };
const readJson = f => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));

for (const f of ["index.html", "manifest.webmanifest", "sw.js", "css/app.css", "js/app.js", "js/quran.js", "js/i18n.js", "data/hisn.json", "data/hisn.en.json", "data/radios.json", "quran/index.json", "i18n/ar.json", "i18n/en.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/favicon.svg"])
  if (!fs.existsSync(path.join(root, f))) fail("missing " + f);

// Adhkar
const db = readJson("data/hisn.json");
const ids = new Set(db.categories.map(c => c.id));
if (ids.size !== db.categories.length) fail("duplicate category ids");
db.sections.flatMap(s => s.cats).forEach(id => { if (!ids.has(id)) fail("section references unknown cat " + id); });
const used = new Set(db.sections.flatMap(s => s.cats)); ids.forEach(id => { if (!used.has(id)) fail("cat not in any section " + id); });
db.categories.forEach(c => c.items.forEach(i => { if (!i.text || !(i.repeat >= 1)) fail(`bad item ${c.id}:${i.id}`); }));

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

// Radios must be HTTPS (the app is served over HTTPS)
const radios = readJson("data/radios.json");
radios.live.forEach(r => { if (!r.url.startsWith("https://")) fail("radio must be https: " + r.id); });

// Interface languages: every language listed in js/i18n.js has a strings file that passes check-i18n.js
// LANGS entries look like ["fr", "Français"]; other arrays in the file do not end right after the second string.
const langs = [...new Set([...fs.readFileSync(path.join(root, "js/i18n.js"), "utf8").matchAll(/\["([a-z]{2,3})", "[^"]+"\]/g)].map(m => m[1]))];
for (const l of langs) if (!fs.existsSync(path.join(root, "i18n", l + ".json"))) fail("missing i18n/" + l + ".json");
const i18nCheck = spawnSync(process.execPath, [path.join(__dirname, "check-i18n.js")], { encoding: "utf8" });
if (i18nCheck.status !== 0) fail("i18n: " + i18nCheck.stdout.split("\n").filter(l => l.startsWith("✗")).join("; "));

// JS syntax (Node detects ES module syntax automatically)
for (const f of ["js/app.js", "js/quran.js", "js/i18n.js", "sw.js", "../scripts/serve.js", "../scripts/build-quran.js", "../scripts/check-radios.js", "../scripts/check-i18n.js", "../scripts/build-hisn-en.js", "../scripts/i18n-source.js"]) {
  const r = spawnSync(process.execPath, ["--check", path.join(root, f)], { encoding: "utf8" });
  if (r.status !== 0) fail(`${f}: ${(r.stderr || "").split("\n").slice(0, 5).join(" ")}`);
}

console.log(ok
  ? `✓ all checks passed (${db.categories.length} adhkar chapters, ${langs.length} UI languages, ${qi.riwayat.length} riwayat / ${ayat} ayat, ${radios.live.length} live radios)`
  : "checks failed");
process.exit(ok ? 0 : 1);
