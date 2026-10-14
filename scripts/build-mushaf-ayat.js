// Builds the verse map of the printed Madinah Mushaf pages from the Quran.com API:
// for each page, the verses on it in reading order with how many words (glyphs) of each are on that page,
// so the app can select a verse on the printed page; and the first verse of each quarter of a hizb (240).
// The words must be exactly those of www/mushaf/madinah.json (same glyph codes in the same order),
// otherwise nothing is written: the two files are read together by the app.
// Output: www/mushaf/ayat.json   Usage: node scripts/build-mushaf-ayat.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "www", "mushaf", "ayat.json");
const PAGES = JSON.parse(fs.readFileSync(path.join(ROOT, "www", "mushaf", "madinah.json"), "utf8")).pages;
const API = "https://api.quran.com/api/v4/verses/by_page";

async function fetchPage(n) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${API}/${n}?words=true&word_fields=code_v1,code_v2,line_number,page_number&fields=rub_el_hizb_number&per_page=50&mushaf=1`);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return (await r.json()).verses;
    } catch (e) { if (i === 3) throw new Error(`page ${n}: ${e.message}`); await new Promise(r => setTimeout(r, 1000 * (i + 1))); }
  }
}

(async () => {
  const words = new Map(); // word id -> { p, l, v1, v2, s, a }
  const rub = [];          // quarter number -> [surah, verse] of its first verse
  const queue = Array.from({ length: 604 }, (_, i) => i + 1);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const n = queue.shift();
      for (const v of await fetchPage(n)) {
        const [s, a] = v.verse_key.split(":").map(Number);
        const q = v.rub_el_hizb_number - 1; if (!rub[q] || s < rub[q][0] || (s === rub[q][0] && a < rub[q][1])) rub[q] = [s, a];
        v.words.forEach(w => words.set(w.id, { p: w.page_number, l: w.line_number, v1: w.code_v1, v2: w.code_v2, s, a }));
      }
    }
  }));
  if (rub.length !== 240 || rub.some(x => !x)) throw new Error("expected 240 quarters, got " + rub.filter(Boolean).length);

  // Reading order: page, then line, then word id. Word ids follow reading order within a line (that is how
  // madinah.json was built) but not always across lines: on pages with short surahs they interleave.
  const ordered = [...words.entries()].sort((a, b) => a[1].p - b[1].p || a[1].l - b[1].l || a[0] - b[0]).map(([, w]) => w);
  // Same words as madinah.json: page by page, line by line, glyph by glyph.
  const pages = Array.from({ length: 604 }, () => []);
  const lines = Array.from({ length: 604 }, () => new Map());
  // The app draws one element per space-separated glyph code, and a few words are two codes ("ﭹ ﭺ"),
  // so the map counts codes, not words. Both prints must split every word the same way.
  ordered.forEach(w => {
    const L = lines[w.p - 1]; if (!L.has(w.l)) L.set(w.l, { w1: [], w2: [] });
    L.get(w.l).w1.push(w.v1); L.get(w.l).w2.push(w.v2);
    const k = w.v1.split(" ").length; if (k !== w.v2.split(" ").length) throw new Error(`${w.s}:${w.a}: a word has ${k} codes in v1 and ${w.v2.split(" ").length} in v2`);
    const runs = pages[w.p - 1]; const last = runs[runs.length - 1];
    if (last && last[0] === w.s && last[1] === w.a) last[2] += k; else runs.push([w.s, w.a, k]);
  });
  PAGES.forEach((page, i) => {
    const mine = page.filter(x => x.w1);
    const theirs = [...lines[i].entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => x);
    if (mine.length !== theirs.length) throw new Error(`page ${i + 1}: ${theirs.length} lines of words, madinah.json has ${mine.length}`);
    mine.forEach((x, j) => {
      if (x.w1 !== theirs[j].w1.join(" ") || x.w2 !== theirs[j].w2.join(" ")) throw new Error(`page ${i + 1}, line ${j + 1}: glyphs differ from madinah.json; rebuild both files together`);
    });
    const count = mine.reduce((n, x) => n + x.w1.split(" ").length, 0);
    const runTotal = pages[i].reduce((n, r) => n + r[2], 0);
    if (count !== runTotal) throw new Error(`page ${i + 1}: ${count} words in madinah.json, ${runTotal} in the verse map`);
  });

  let prev = [1, 0];
  pages.flat().forEach(([s, a]) => { if (!((s === prev[0] && a === prev[1] + 1) || (s === prev[0] + 1 && a === 1))) throw new Error(`${s}:${a} follows ${prev.join(":")}: not in reading order`); prev = [s, a]; });
  const verses = new Set(ordered.map(w => w.s + ":" + w.a));
  if (verses.size !== 6236) throw new Error("expected 6236 verses, got " + verses.size);
  const out = { source: "Quran.com API v4 (verse of every word, rub_el_hizb_number), matched to mushaf/madinah.json", built: new Date().toISOString().slice(0, 10), pages, rub };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`✓ 604 pages · ${pages.reduce((n, p) => n + p.length, 0)} verse parts · 240 quarters · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB · glyphs identical to madinah.json`);
})().catch(e => { console.error("✗", e.message); process.exit(1); });
