// Builds www/data/tajweed.json for the Tajweed rules page (#/tajweed) from scripts/tajweed-source.js:
// - each example (a verse and the positions of its words) becomes the glyphs of those words on their printed page,
//   from the Quran.com API (code_v2: the glyph codes of the 1421 print, which the Tajweed fonts share). The glyphs must
//   follow each other on that page of www/mushaf/madinah.json.
// - the colours an example shows are read from the Tajweed print's own page font: each glyph's COLR layers and their
//   CPAL palette entries. An example must show every colour of its `want` and none of its `none`, or nothing is written.
// - the colour key takes its day and night colours from the fonts' palettes 0 and 1, which the Mushaf pages use.
// - the verses of «تحفة الأطفال» and «المقدمة الجزرية» are copied word for word from turath.io, by their numbers.
// Usage: node scripts/build-tajweed.js
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "tajweed");
const OUT = path.join(ROOT, "www", "data", "tajweed.json");
const SRC = require("./tajweed-source.js");
const PAGES = JSON.parse(fs.readFileSync(path.join(ROOT, "www", "mushaf", "madinah.json"), "utf8")).pages;
const FONT_URL = JSON.parse(fs.readFileSync(path.join(ROOT, "www", "mushaf", "tajweed.json"), "utf8")).fonts.v4.url;
const API = "https://api.quran.com/api/v4/verses/by_key";
// files.turath.io answers IPv6 and IPv4; with Node's 250 ms per address, slow connections fail on all of them.
require("net").setDefaultAutoSelectFamilyAttemptTimeout(2000);

async function cached(name, url, json = true) {
  const file = path.join(CACHE, name);
  if (!fs.existsSync(file)) {
    let last;
    for (let i = 0; i < 4; i++) {
      try {
        // The font CDN keeps older copies for compressed requests (see check-sources.js): ask for the file as it is.
        const r = await fetch(url, { headers: { "accept-encoding": "identity" } }); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        const b = Buffer.from(await r.arrayBuffer()); if (json) JSON.parse(b.toString("utf8"));
        fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(file, b); last = null; break;
      } catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
    }
    if (last) throw last;
  }
  const b = fs.readFileSync(file); return json ? JSON.parse(b.toString("utf8")) : b;
}

// ---------- the page fonts: WOFF2 tables, then cmap (glyph codes), COLR v0 (coloured layers) and CPAL (palettes) ----------
const TAGS = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"];
function woff2Tables(b) {
  if (b.toString("latin1", 0, 4) !== "wOF2") throw new Error("not a WOFF2 font");
  const num = b.readUInt16BE(12); let o = 48;
  const base128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const x = b[o++]; v = v * 128 + (x & 0x7f); if (!(x & 0x80)) return v; } throw new Error("bad UIntBase128"); };
  const dir = [];
  for (let i = 0; i < num; i++) {
    const f = b[o++]; let tag = TAGS[f & 0x3f];
    if ((f & 0x3f) === 63) { tag = b.toString("latin1", o, o + 4); o += 4; }
    let len = base128();
    if ((tag === "glyf" || tag === "loca") ? (f >> 6) === 0 : (f >> 6) !== 0) len = base128(); // transformed: its own length
    dir.push({ tag, len });
  }
  const data = zlib.brotliDecompressSync(b.subarray(o, o + b.readUInt32BE(20)));
  const out = {}; let p = 0;
  for (const d of dir) { out[d.tag] = data.subarray(p, p + d.len); p += d.len; } // tables follow each other without padding
  return out;
}
function cmapOf(c) {
  const map = new Map();
  for (let i = 0; i < c.readUInt16BE(2); i++) {
    const off = c.readUInt32BE(8 + 8 * i), fmt = c.readUInt16BE(off);
    if (fmt === 4) {
      const seg = c.readUInt16BE(off + 6) / 2, ends = off + 14, starts = ends + 2 * seg + 2, deltas = starts + 2 * seg, ros = deltas + 2 * seg;
      for (let s = 0; s < seg; s++) {
        const end = c.readUInt16BE(ends + 2 * s), st = c.readUInt16BE(starts + 2 * s), d = c.readInt16BE(deltas + 2 * s), ro = c.readUInt16BE(ros + 2 * s);
        for (let cp = st; cp <= end && cp !== 0xffff; cp++) {
          let g = ro ? c.readUInt16BE(ros + 2 * s + ro + 2 * (cp - st)) : cp; if (ro && !g) continue;
          g = (g + d) & 0xffff; if (g) map.set(cp, g);
        }
      }
    } else if (fmt === 12) {
      for (let k = 0; k < c.readUInt32BE(off + 12); k++) { const q = off + 16 + 12 * k, s = c.readUInt32BE(q), e = c.readUInt32BE(q + 4), g = c.readUInt32BE(q + 8); for (let cp = s; cp <= e; cp++) map.set(cp, g + cp - s); }
    }
  }
  return map;
}
function readFont(buf) {
  const T = woff2Tables(buf);
  if (!T.COLR || !T.CPAL) throw new Error("no COLR/CPAL table");
  const C = T.COLR; if (C.readUInt16BE(0) !== 0) throw new Error(`COLR version ${C.readUInt16BE(0)}: only version 0 is read`);
  const layers = new Map(), baseOff = C.readUInt32BE(4), layOff = C.readUInt32BE(8);
  for (let i = 0; i < C.readUInt16BE(2); i++) {
    const q = baseOff + 6 * i, first = C.readUInt16BE(q + 2), n = C.readUInt16BE(q + 4);
    layers.set(C.readUInt16BE(q), Array.from({ length: n }, (_, k) => C.readUInt16BE(layOff + 4 * (first + k) + 2)));
  }
  const P = T.CPAL, entries = P.readUInt16BE(2), recOff = P.readUInt32BE(8);
  const palettes = Array.from({ length: P.readUInt16BE(4) }, (_, i) => Array.from({ length: entries }, (_, j) => {
    const q = recOff + 4 * (P.readUInt16BE(12 + 2 * i) + j); // BGRA
    return "#" + [P[q + 2], P[q + 1], P[q]].map(x => x.toString(16).padStart(2, "0")).join("");
  }));
  return { cmap: cmapOf(T.cmap), layers, palettes };
}

// Palette entry -> colour code of the key (entry 0 is the letters, 0xFFFF the text colour, the others are ornaments).
const CODE = new Map(SRC.COLORS.flatMap(x => x.pal.map(p => [p, x.c])));

(async () => {
  const problems = [];
  const fonts = new Map();
  const fontOf = async p => { if (!fonts.has(p)) fonts.set(p, readFont(await cached(`p${p}.woff2`, FONT_URL.replace("{n}", p), false))); return fonts.get(p); };
  const colours = (font, glyphs) => new Set(glyphs.flatMap(g => [...g].flatMap(ch => font.layers.get(font.cmap.get(ch.codePointAt(0))) || [])).map(e => CODE.get(e)).filter(Boolean));

  // ---------- examples ----------
  async function example(x, where) {
    const v = (await cached(`v${x.k.replace(":", "-")}.json`, `${API}/${x.k}?words=true&word_fields=code_v2,text_uthmani,page_number&mushaf=1`)).verse;
    const words = x.w.map(n => v.words.find(w => w.position === n && w.char_type_name === "word"));
    if (words.some(w => !w)) { problems.push(`${where} ${x.k}: no word ${x.w.join(",")}`); return null; }
    const p = words[0].page_number;
    if (words.some(w => w.page_number !== p)) { problems.push(`${where} ${x.k}: words on two pages`); return null; }
    const g = words.map(w => w.code_v2);
    // A word followed by two stop signs (يس ٥٢) is two glyph groups with a space, as on the page.
    const tokens = PAGES[p - 1].filter(l => l.w2).flatMap(l => l.w2.split(" ")), want = g.flatMap(c => c.split(" "));
    const at = tokens.findIndex((t, i) => want.every((c, j) => tokens[i + j] === c));
    if (at < 0) problems.push(`${where} ${x.k}: glyphs ${g.join(" ")} not found on page ${p} of madinah.json`);
    const has = colours(await fontOf(p), g);
    const miss = [...(x.want || "")].filter(c => !has.has(c)), extra = [...(x.none || "")].filter(c => has.has(c));
    if (miss.length || extra.length) problems.push(`${where} ${x.k} ${words.map(w => w.text_uthmani).join(" ")}: shows [${[...has].join("")}]` + (miss.length ? `, lacks ${miss.join("")}` : "") + (extra.length ? `, must not show ${extra.join("")}` : ""));
    return { k: x.k, p, g, t: words.map(w => w.text_uthmani).join(" "), ...(x.n ? { n: x.n } : {}) };
  }

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
  for (const ch of SRC.CHAPTERS) {
    const s = [];
    for (const [i, sec] of ch.s.entries()) {
      for (const c of sec.c || "") if (!CODE.has(SRC.COLORS.find(y => y.c === c)?.pal[0])) problems.push(`${ch.id} §${i + 1}: unknown colour ${c}`);
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
