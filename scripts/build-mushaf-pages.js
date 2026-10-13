// Builds page-exact data for the Madinah Mushaf (604 pages, 15 lines) from the Quran.com API.
// Each word is a glyph code that the King Fahd Complex page fonts (QCF v1 = 1405H print, v2 = 1421H print)
// draw exactly as printed. Lines without words are the surah header and basmala lines of the print.
// Every word carries its own page and line number, so verses that continue on the next page are split correctly.
// Output: www/mushaf/madinah.json   Usage: node scripts/build-mushaf-pages.js
const fs = require("fs"), path = require("path");
const OUT = path.join(__dirname, "..", "www", "mushaf", "madinah.json");
const API = "https://api.quran.com/api/v4/verses/by_page";

async function fetchPage(n) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${API}/${n}?words=true&word_fields=code_v1,code_v2,line_number,page_number&per_page=50&mushaf=1`);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return (await r.json()).verses;
    } catch (e) { if (i === 3) throw new Error(`page ${n}: ${e.message}`); await new Promise(r => setTimeout(r, 1000 * (i + 1))); }
  }
}

(async () => {
  const words = new Map();   // word id -> { p, l, v1, v2 }
  const surahStart = {};     // surah -> { p, l } of its first word
  const verseStart = {};     // "s:a" -> page of its first word
  const queue = Array.from({ length: 604 }, (_, i) => i + 1);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const n = queue.shift();
      for (const v of await fetchPage(n)) {
        const [s, a] = v.verse_key.split(":").map(Number);
        v.words.forEach((w, i) => {
          words.set(w.id, { p: w.page_number, l: w.line_number, v1: w.code_v1, v2: w.code_v2 });
          if (i === 0) { verseStart[v.verse_key] = w.page_number; if (a === 1) surahStart[s] = { p: w.page_number, l: w.line_number }; }
        });
      }
    }
  }));

  // page -> line -> words in reading order (word ids increase through the Quran)
  const grid = Array.from({ length: 604 }, (_, i) => Array(i < 2 ? 8 : 15).fill(null));
  [...words.entries()].sort((a, b) => a[0] - b[0]).forEach(([, w]) => {
    const row = grid[w.p - 1]; if (!row || !(w.l >= 1 && w.l <= row.length)) throw new Error(`word outside the grid: page ${w.p} line ${w.l}`);
    const L = (row[w.l - 1] ||= { w1: [], w2: [] }); L.w1.push(w.v1); L.w2.push(w.v2);
  });

  // Header and basmala lines come right before each surah's first line; they may fall at the bottom of the previous page.
  const prevLine = ({ p, l }) => l > 1 ? { p, l: l - 1 } : { p: p - 1, l: grid[p - 2].length };
  const put = (pos, val, what) => {
    const row = grid[pos.p - 1];
    if (row[pos.l - 1] !== null) throw new Error(`${what}: page ${pos.p} line ${pos.l} is not empty`);
    row[pos.l - 1] = val;
  };
  for (let s = 1; s <= 114; s++) {
    let pos = prevLine(surahStart[s]);
    if (s !== 1 && s !== 9) { put(pos, { b: 1 }, `basmala of ${s}`); pos = prevLine(pos); }
    put(pos, { h: s }, `header of ${s}`);
  }
  const empty = grid.flatMap((row, i) => row.map((x, j) => x === null ? `${i + 1}:${j + 1}` : null)).filter(Boolean);
  if (empty.length) throw new Error("empty lines left: " + empty.join(" "));

  const pages = grid.map(row => row.map(x => x.w1 ? { w1: x.w1.join(" "), w2: x.w2.join(" ") } : x));
  // One font per page and print (KFGQPC QCF), served with CORS by the Quran.com CDN. Sizes are shown before saving offline.
  const fontUrl = (v, n) => `https://static.qurancdn.com/fonts/quran/hafs/${v}/woff2/p${n}.woff2`;
  const fonts = {};
  for (const v of ["v1", "v2"]) {
    const q = Array.from({ length: 604 }, (_, i) => i + 1); let bytes = 0;
    await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) { const n = q.shift(); const r = await fetch(fontUrl(v, n), { method: "HEAD" }); if (!r.ok) throw new Error(`font ${v} p${n}: HTTP ${r.status}`); bytes += Number(r.headers.get("content-length")) || 0; } }));
    fonts[v] = { url: fontUrl(v, "{n}"), bytes };
  }
  const out = { source: "Quran.com API v4, KFGQPC QCF v1/v2 glyph codes", built: new Date().toISOString().slice(0, 10), fonts, pages, verseStart };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`✓ 604 pages · ${words.size} words · ${Object.keys(verseStart).length} verses · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB · every line filled`);
})().catch(e => { console.error("✗", e.message); process.exit(1); });
