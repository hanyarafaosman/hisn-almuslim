// Builds the colour data of the printed Madinah Mushaf pages from the Quran.com API:
// - www/mushaf/jalala.json: on each page, the glyphs that write the name of Allah (الله, لله, بالله, والله, تالله,
//   ءآلله, اللهم…), so the app can colour it. The rule must find 2699 + 5 (اللهم) words, the known count, or nothing is written.
// - www/mushaf/tajweed.json: the colour-coded Tajweed fonts (KFGQPC / Dar Al-Maarifah, QCF V4, one per page),
//   which draw the same glyph codes as the 1421 print (code_v2), with their total size.
// The words must be exactly those of www/mushaf/madinah.json (same glyph codes in the same order).
// Both files are cached on devices for good (QURAN_CACHE in sw.js): a rebuild that changes them needs new file names.
// Usage: node scripts/build-mushaf-colors.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const PAGES = JSON.parse(fs.readFileSync(path.join(ROOT, "www", "mushaf", "madinah.json"), "utf8")).pages;
const API = "https://api.quran.com/api/v4/verses/by_page";
const V4 = "https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p{n}.woff2";

// Same search key as www/js/quran.js (quranKey): no diacritics, alef forms dropped, ى→ي, ة→ه.
const ch = (...c) => String.fromCodePoint(...c), range = (a, b) => ch(a) + "-" + ch(b);
const MARKS = new RegExp("[" + range(0x610, 0x61A) + range(0x64B, 0x65F) + range(0x6D6, 0x6ED) + ch(0x640) + range(0x8D3, 0x8FF) + "]", "g");
const DAGGER = ch(0x670);
const key = s => s.normalize("NFC").split(ch(0x648) + DAGGER).join("ا").split(ch(0x649) + DAGGER).join("ى").split(DAGGER).join("ا").split(ch(0x6E7)).join("ي")
  .replace(MARKS, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[^ء-ي]/g, "").replace(/ا/g, "");
// The name of Allah with the letters that can be joined to it: ءآ (question), و / ف, then ب / ت / ل; اللهم ends in م.
// Words that only contain the letters (اللهو، اللهب، الآلهة، يضلله، ظلاله…) do not match.
const JALALA = /^ء?(و|ف)?(ب|ت|ل)?لله(م)?$/;

async function fetchPage(n) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${API}/${n}?words=true&word_fields=code_v1,code_v2,line_number,page_number,text_uthmani&per_page=50&mushaf=1`);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return (await r.json()).verses;
    } catch (e) { if (i === 3) throw new Error(`page ${n}: ${e.message}`); await new Promise(r => setTimeout(r, 1000 * (i + 1))); }
  }
}

(async () => {
  const words = new Map(); // word id -> { p, l, v1, v2, text, type }
  const queue = Array.from({ length: 604 }, (_, i) => i + 1);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const n = queue.shift();
      for (const v of await fetchPage(n)) v.words.forEach(w => words.set(w.id, { p: w.page_number, l: w.line_number, v1: w.code_v1, v2: w.code_v2, text: w.text_uthmani, type: w.char_type_name }));
    }
  }));
  // Reading order: page, then line, then word id (as in build-mushaf-ayat.js).
  const ordered = [...words.entries()].sort((a, b) => a[1].p - b[1].p || a[1].l - b[1].l || a[0] - b[0]).map(([, w]) => w);
  const pages = Array.from({ length: 604 }, () => []), lines = Array.from({ length: 604 }, () => new Map()), glyphs = Array(604).fill(0);
  let allah = 0, allahumma = 0, whole = 0;
  ordered.forEach(w => {
    const L = lines[w.p - 1]; if (!L.has(w.l)) L.set(w.l, { w1: [], w2: [] });
    L.get(w.l).w1.push(w.v1); L.get(w.l).w2.push(w.v2);
    const codes = w.v2.split(" "); const at = glyphs[w.p - 1]; glyphs[w.p - 1] += codes.length;
    if (w.type !== "word") return;
    const k = key(w.text); if (!JALALA.test(k)) return;
    if (k.endsWith("م")) allahumma++; else allah++;
    // A word may carry a pause sign or ۞ as a second code: colour only the code of the name itself.
    const parts = w.text.split(" ");
    if (parts.length === codes.length) parts.forEach((t, i) => { if (JALALA.test(key(t))) pages[w.p - 1].push(at + i); });
    else { codes.forEach((c, i) => pages[w.p - 1].push(at + i)); whole++; }
  });
  PAGES.forEach((page, i) => {
    const mine = page.filter(x => x.w1);
    const theirs = [...lines[i].entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => x);
    if (mine.length !== theirs.length) throw new Error(`page ${i + 1}: ${theirs.length} lines of words, madinah.json has ${mine.length}`);
    mine.forEach((x, j) => { if (x.w1 !== theirs[j].w1.join(" ") || x.w2 !== theirs[j].w2.join(" ")) throw new Error(`page ${i + 1}, line ${j + 1}: glyphs differ from madinah.json`); });
  });
  if (allah !== 2699 || allahumma !== 5) throw new Error(`found ${allah} × Allah and ${allahumma} × Allahumma, expected 2699 and 5`);

  // Tajweed fonts: every page must exist; the total size is shown before saving them offline and checked daily.
  let bytes = 0; const q = Array.from({ length: 604 }, (_, i) => i + 1);
  await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) {
    const n = q.shift(); const r = await fetch(V4.replace("{n}", n), { method: "HEAD", headers: { "accept-encoding": "identity" } });
    if (!r.ok) throw new Error(`tajweed font p${n}: HTTP ${r.status}`); bytes += Number(r.headers.get("content-length")) || 0;
  } }));

  const built = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(ROOT, "www", "mushaf", "jalala.json"), JSON.stringify({ source: "Quran.com API v4 (text_uthmani of every word), matched to mushaf/madinah.json; glyph indexes per page", built, count: allah + allahumma, pages }));
  fs.writeFileSync(path.join(ROOT, "www", "mushaf", "tajweed.json"), JSON.stringify({ source: "KFGQPC / Dar Al-Maarifah colour-coded Tajweed fonts (QCF V4, COLRv1), via the Quran Foundation CDN; glyph codes as the 1421 print (code_v2)", built, fonts: { v4: { url: V4, bytes } } }));
  console.log(`✓ name of Allah: ${allah} + ${allahumma} (اللهم) words, ${pages.reduce((n, p) => n + p.length, 0)} glyphs (${whole} words coloured whole) · tajweed fonts: 604 pages, ${(bytes / 1048576).toFixed(1)} MB · glyphs identical to madinah.json`);
})().catch(e => { console.error("✗", e.message); process.exit(1); });
