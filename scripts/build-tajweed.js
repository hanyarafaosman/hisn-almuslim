// Builds www/data/tajweed.json for the Tajweed rules page (#/tajweed) from scripts/tajweed-source.js:
// - each example (a verse and the positions of its words) becomes the glyphs of those words on their printed page,
//   from the Quran.com API (code_v2: the glyph codes of the 1421 print, which the Tajweed fonts share). The glyphs must
//   follow each other on that page of www/mushaf/madinah.json.
// - the colours an example shows are read from the Tajweed print's own page font: each glyph's COLR layers and their
//   CPAL palette entries. An example must show every colour of its `want` and none of its `none`, or nothing is written.
// - the colour key takes its day and night colours from the fonts' palettes 0 and 1, which the Mushaf pages use.
// - the verses of «تحفة الأطفال» and «المقدمة الجزرية» are copied word for word from turath.io, by their numbers.
// The glyph and font work is in scripts/lib/glyphs.js, shared with scripts/build-qaida.js (learning to read).
// Usage: node scripts/build-tajweed.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "www", "data", "tajweed.json");
const SRC = require("./tajweed-source.js");
// Verses, fonts and the turath.io books are cached in .cache/tajweed.
const G = require("./lib/glyphs.js").glyphs({ cache: ".cache/tajweed", colors: SRC.COLORS });
const { cached, fontOf, fonts } = G;

(async () => {
  const problems = [];
  const example = (x, where) => G.example(x, where, problems);

  // ---------- the two poems, by verse number ----------
  const books = {}, verses = {};
  for (const [id, b] of Object.entries(SRC.BOOKS)) {
    const j = await cached(`turath-${b.turath}.json`, `https://files.turath.io/books-v3/${b.turath}.json`);
    const lines = j.pages.filter(p => p.page >= b.from && p.page <= b.to).flatMap(p => p.text.split("\n"));
    const m = new Map();
    for (const l of lines) {
      const r = /^([٠-٩]+) - (.+?) … (.+)$/.exec(l.trim()); if (!r) continue;
      const n = Number(r[1].replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
      if (m.has(n)) problems.push(`${id}: verse ${n} twice`); m.set(n, [r[2].trim(), r[3].trim()]);
    }
    for (let n = 1; n <= b.count; n++) if (!m.has(n)) problems.push(`${id}: verse ${n} missing`);
    if (m.size !== b.count) problems.push(`${id}: ${m.size} verses, ${b.count} expected`);
    for (const [n, [a, c]] of m) if (/[()[\]<>]|\d/.test(a + c)) problems.push(`${id} ${n}: footnote mark or markup in the verse`);
    verses[id] = m;
    books[id] = { title: b.title, author: b.author, turath: b.turath, url: `https://app.turath.io/book/${b.turath}` };
  }
  const matn = list => list.map(([b, from, to]) => ({ b, from, to, v: Array.from({ length: to - from + 1 }, (_, i) => verses[b].get(from + i)).filter(Boolean) }));

  // ---------- the colour key ----------
  const first = await fontOf(1);
  const colors = [];
  for (const x of SRC.COLORS) {
    colors.push({ c: x.c, light: first.palettes[0][x.pal[0]], dark: first.palettes[1][x.pal[0]], t: x.t, sub: x.sub, rule: x.rule, ex: await example({ k: x.ex[0], w: [x.ex[1]], want: x.c }, `colour ${x.c}`) });
  }

  const chapters = [];
  const ids = new Set(SRC.CHAPTERS.map(c => c.id));
  for (const x of SRC.COLORS) if (!ids.has(x.rule)) problems.push(`colour ${x.c}: no chapter ${x.rule}`);
  const known = new Set(SRC.COLORS.map(y => y.c));
  for (const ch of SRC.CHAPTERS) {
    const s = [];
    for (const [i, sec] of ch.s.entries()) {
      for (const c of sec.c || "") if (!known.has(c)) problems.push(`${ch.id} §${i + 1}: unknown colour ${c}`);
      const ex = [];
      for (const e of sec.ex || []) { const r = await example(e, `${ch.id} §${i + 1}`); if (r) ex.push(r); }
      s.push({ h: sec.h, ...(sec.c ? { c: sec.c } : {}), ...(sec.p ? { p: sec.p } : {}), ...(sec.list ? { list: sec.list } : {}), ...(ex.length ? { ex } : {}) });
    }
    chapters.push({ id: ch.id, t: ch.t, intro: ch.intro, s, matn: matn(ch.matn || []) });
  }

  // Every font of the print must carry the same palettes, or the key would not match some pages.
  for (const [p, f] of fonts) if (JSON.stringify(f.palettes.slice(0, 2)) !== JSON.stringify(first.palettes.slice(0, 2))) problems.push(`page ${p}: its font has other palettes than page 1`);

  if (problems.length) { console.error("✗ " + problems.join("\n✗ ")); process.exit(1); }
  const out = {
    note: "The Tajweed rules page (#/tajweed). Built by scripts/build-tajweed.js from scripts/tajweed-source.js; examples are glyphs of the Tajweed print's pages (p, g), colours from its fonts. Rebuild with: npm run tajweed",
    built: new Date().toISOString().slice(0, 10),
    source: SRC.SOURCE, intro: SRC.INTRO, introMatn: matn(SRC.INTRO_MATN), keyNote: SRC.KEY_NOTE, books, colors, chapters,
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  const n = chapters.reduce((a, c) => a + c.s.reduce((b, x) => b + (x.ex || []).length, 0), 0);
  console.log(`✓ ${path.relative(ROOT, OUT)}: ${chapters.length} chapters, ${n} examples on ${fonts.size} pages, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
})().catch(e => { console.error(e); process.exit(1); });
