// Builds www/hadith/index.json: the six hadith books (plus the Forty of an-Nawawi and the Forty Qudsi)
// with their sections, hadith ranges, available translations and grading labels.
// Hadith texts are not copied: the app loads each section from the pinned hadith-api release
// (fawazahmed0/hadith-api, Unlicense) on jsDelivr, which is immutable for a given commit.
// Arabic book and section titles come from AhmedBaset/hadith-json (pinned), matched by their English titles.
// Usage: node scripts/build-hadith-index.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "hadith");
const OUT = path.join(ROOT, "www", "hadith", "index.json");
const API_SHA = "df57907be35291c91ad6a6691180e22ca9920784";
const HJ_SHA = "70b83d6d21995bb32f8d7271cd75501be5a922a7";
const API = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@${API_SHA}`;
const HJ = `https://raw.githubusercontent.com/AhmedBaset/hadith-json/${HJ_SHA}/db/by_book`;

const BOOKS = [
  { id: "bukhari", hj: "the_9_books/bukhari", sahih: true },
  { id: "muslim", hj: "the_9_books/muslim", sahih: true },
  { id: "abudawud", hj: "the_9_books/abudawud" },
  { id: "tirmidhi", hj: "the_9_books/tirmidhi" },
  { id: "nasai", hj: "the_9_books/nasai" },
  { id: "ibnmajah", hj: "the_9_books/ibnmajah" },
  { id: "nawawi", hj: "forties/nawawi40" },
  { id: "qudsi", hj: "forties/qudsi40" },
];
// UI language -> hadith-api translation language prefix
const LANG = { en: "eng", fr: "fra", id: "ind", ru: "rus", tr: "tur", ur: "urd", bn: "ben", ta: "tam" };

// Section titles the two sources word differently (checked by hand against the Arabic books).
const SECTION_AR = {
  "muslim:0": "المقدمة",
  "ibnmajah:0": "المقدمة",
};

async function cached(name, url) {
  const file = path.join(CACHE, name);
  if (!fs.existsSync(file)) {
    process.stdout.write(`  ↓ ${name}\n`);
    const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
// Exact download sizes from HEAD requests (jsDelivr sends Content-Length), cached so a rebuild is quick.
const SIZES_FILE = path.join(CACHE, "sizes.json");
const SIZES = fs.existsSync(SIZES_FILE) ? JSON.parse(fs.readFileSync(SIZES_FILE, "utf8")) : {};
async function headSize(url) {
  if (SIZES[url] != null) return SIZES[url];
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { method: "HEAD", headers: { "accept-encoding": "identity" } });
      if (r.status === 404) return (SIZES[url] = 0);
      const n = Number(r.headers.get("content-length")); if (r.ok && n > 0) return (SIZES[url] = n);
    } catch { /* retry */ }
  }
  throw new Error(`no size for ${url}`);
}
async function sumSizes(urls) {
  let total = 0, next = 0; const missing = [];
  await Promise.all(Array.from({ length: 16 }, async () => { while (next < urls.length) { const u = urls[next++]; const n = await headSize(u); if (!n) missing.push(u); total += n; } }));
  return { total, missing };
}
const key = s => String(s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/^(the )?book (of|on) (the )?/, "").replace(/[^a-z]/g, "");

(async () => {
  const info = await cached("info.json", `${API}/info.min.json`);
  const editions = await cached("editions.json", `${API}/editions.min.json`);
  const gradeNames = new Set(), graderNames = new Set(); const unmatched = [];
  const books = [];
  for (const b of BOOKS) {
    const hj = await cached(`${b.id}.hj.json`, `${HJ}/${b.hj}.json`);
    const meta = info[b.id].metadata;
    const details = meta.section_details || meta.section_detail;
    const hjByKey = new Map(hj.chapters.map(c => [key(c.english), c.arabic]));
    const sections = Object.entries(meta.sections).filter(([n, en]) => en && details[n] && details[n].hadithnumber_last >= details[n].hadithnumber_first).map(([n, en]) => {
      const ar = SECTION_AR[`${b.id}:${n}`] || hjByKey.get(key(en)) || (Object.keys(meta.sections).filter(k => meta.sections[k]).length === 1 ? hj.metadata.arabic.title : null);
      if (!ar) unmatched.push(`${b.id}:${n} ${en}`);
      const d = details[n];
      return [Number(n), ar || en, en, d.hadithnumber_first, d.hadithnumber_last];
    });
    const langs = {};
    for (const [ui, pre] of Object.entries(LANG)) if (editions[b.id].collection.some(c => c.name === `${pre}-${b.id}`)) langs[ui] = `${pre}-${b.id}`;
    // The full book gives the real hadith count (numbering has sub-numbers like 8.01) and, in the Sunan, the gradings.
    const full = await cached(`ara-${b.id}.json`, `${API}/editions/ara-${b.id}.min.json`);
    let graded = false;
    full.hadiths.forEach(h => (h.grades || []).forEach(g => { graded = true; gradeNames.add(g.grade.trim()); graderNames.add(g.name.trim()); }));
    const search = await cached(`ara-${b.id}1.json`, `${API}/editions/ara-${b.id}1.min.json`);
    if (search.hadiths.length !== full.hadiths.length) throw new Error(`${b.id}: search file has ${search.hadiths.length} hadith, expected ${full.hadiths.length}`);
    // Section files group hadith by their reference. Some hadith have no reference (book 0 where the book has no
    // section 0): they are missing from every section file, so each is attached to the section whose number range
    // holds it (or the one before it) and the app loads it from its own file. Empty entries (numbers without text) are skipped.
    const listed = new Set(sections.map(s => s[0]));
    const texted = full.hadiths.filter(h => String(h.text).trim());
    const extras = new Map();
    for (const h of texted) {
      if (listed.has(h.reference.book)) continue;
      const s = sections.find(x => h.hadithnumber >= x[3] && h.hadithnumber <= x[4]) || [...sections].reverse().find(x => x[3] <= h.hadithnumber) || sections[0];
      if (!extras.has(s[0])) extras.set(s[0], []); extras.get(s[0]).push(h.hadithnumber);
    }
    // Each section: [number, Arabic title, English title, first, last, hadith count, extra hadith numbers?].
    // first/last come from the source and can be off when a hadith has a wrong reference, so the app shows the count.
    for (const s of sections) {
      const own = texted.filter(h => h.reference.book === s[0]).length; const ex = extras.get(s[0]) || [];
      s.push(own + ex.length); if (ex.length) s.push(ex);
    }
    const count = sections.reduce((a, s) => a + s[5], 0);
    if (count !== texted.length) throw new Error(`${b.id}: sections hold ${count} hadith, the book has ${texted.length}`);
    // Download sizes for saving the book offline: the Arabic sections, extra hadith and search file, and each translation.
    const files = ed => [...sections.map(s => `${API}/editions/${ed}/sections/${s[0]}.min.json`), ...[...extras.values()].flat().map(n => `${API}/editions/${ed}/${n}.min.json`)];
    const ara = await sumSizes([...files(`ara-${b.id}`), `${API}/editions/ara-${b.id}1.min.json`]);
    if (ara.missing.length) throw new Error(`${b.id}: missing Arabic files ${ara.missing.join(" ")}`);
    const trBytes = {};
    for (const [ui, ed] of Object.entries(langs)) {
      const tr = await sumSizes(files(ed)); trBytes[ui] = tr.total;
      if (tr.missing.length) console.log(`  ${ed}: ${tr.missing.length} file(s) without translation`);
    }
    if (extras.size) console.log(`  ${b.id}: ${[...extras.values()].flat().length} hadith without a section reference, attached to ${extras.size} sections`);
    fs.writeFileSync(SIZES_FILE, JSON.stringify(SIZES));
    const bytes = ara.total;
    books.push({ id: b.id, ar: hj.metadata.arabic.title, author: hj.metadata.arabic.author, en: meta.name, sahih: !!b.sahih, graded, count, bytes, trBytes, langs, sections });
    console.log(`✓ ${b.id}: ${sections.length} sections, ${count} hadith, ${(bytes / 1048576).toFixed(1)} MB, translations: ${Object.entries(trBytes).map(([l, n]) => `${l} ${(n / 1048576).toFixed(1)} MB`).join(", ") || "none"}`);
  }
  const out = {
    source: { text: "fawazahmed0/hadith-api (Unlicense)", url: "https://github.com/fawazahmed0/hadith-api", sha: API_SHA, cdn: `${API}/editions`, titles: "AhmedBaset/hadith-json", titlesSha: HJ_SHA },
    built: new Date().toISOString().slice(0, 10), books,
    graders: [...graderNames].sort(),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`\n✓ ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
  if (unmatched.length) console.log("  sections without Arabic title:", unmatched.join(" | "));
  console.log("  graders:", out.graders.join(" | "));
  console.log("  distinct grade labels:", gradeNames.size);
})().catch(e => { console.error("✗", e.message); process.exit(1); });
