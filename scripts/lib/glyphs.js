// The glyphs of Quranic words as the Tajweed print draws them, shared by scripts/build-tajweed.js (the rules page) and
// scripts/build-qaida.js (learning to read): an example names a verse and the positions of its words, and becomes the
// glyph codes of those words on their printed page (the Quran.com API's code_v2, the codes of the 1421 print that the
// Tajweed fonts share), checked to follow each other on that page of www/mushaf/madinah.json. The colours a word shows
// are read from the print's own page font (WOFF2 → COLR v0 layers → CPAL palette entries).
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const ROOT = path.join(__dirname, "..", "..");
const API = "https://api.quran.com/api/v4/verses/by_key";
// files.turath.io answers IPv6 and IPv4; with Node's 250 ms per address, slow connections fail on all of them.
require("net").setDefaultAutoSelectFamilyAttemptTimeout(2000);

// A fetch with a file cache in dir: cached(name, url, json) reads the file when it exists, else fetches (4 tries) and keeps it.
function cacheIn(dir) {
  return async function cached(name, url, json = true) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) {
      let last;
      for (let i = 0; i < 4; i++) {
        try {
          // The font CDN keeps older copies for compressed requests (see check-sources.js): ask for the file as it is.
          const r = await fetch(url, { headers: { "accept-encoding": "identity" } }); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
          const b = Buffer.from(await r.arrayBuffer()); if (json) JSON.parse(b.toString("utf8"));
          fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, b); last = null; break;
        } catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
      }
      if (last) throw last;
    }
    const b = fs.readFileSync(file); return json ? JSON.parse(b.toString("utf8")) : b;
  };
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

// Vowel signs and other marks over the letters (removed to look for a letter inside a word).
const MARKS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0610-\u061A\u08D3-\u08FF\u0640]/g;
// Quran.com writes a final yāʾ as ى, the Mushaf's way; the app's Hafs text writes ي.
const letters = s => s.normalize("NFD").replace(MARKS, "").replace(/\u0671/g, "\u0627").replace(/\u0649/g, "\u064A");

// The pipeline over the Tajweed print's pages. colors: the key of scripts/tajweed-source.js (palette entries → codes),
// so that an example can be checked to show the colours it is given for (want) and none of those it must not (none).
// cache: where verses and fonts are kept, relative to the repository.
function glyphs({ cache = ".cache/tajweed", colors = [] } = {}) {
  const CACHE = path.join(ROOT, cache), cached = cacheIn(CACHE);
  const PAGES = JSON.parse(fs.readFileSync(path.join(ROOT, "www", "mushaf", "madinah.json"), "utf8")).pages;
  const FONT_URL = JSON.parse(fs.readFileSync(path.join(ROOT, "www", "mushaf", "tajweed.json"), "utf8")).fonts.v4.url;
  // Palette entry -> colour code of the key (entry 0 is the letters, 0xFFFF the text colour, the others are ornaments).
  const CODE = new Map(colors.flatMap(x => x.pal.map(p => [p, x.c])));
  const fonts = new Map();
  const fontOf = async p => { if (!fonts.has(p)) fonts.set(p, readFont(await cached(`p${p}.woff2`, FONT_URL.replace("{n}", p), false))); return fonts.get(p); };
  const colours = (font, glyphs) => new Set(glyphs.flatMap(g => [...g].flatMap(ch => font.layers.get(font.cmap.get(ch.codePointAt(0))) || [])).map(e => CODE.get(e)).filter(Boolean));
  const verse = k => cached(`v${k.replace(":", "-")}.json`, `${API}/${k}?words=true&word_fields=code_v2,text_uthmani,page_number&mushaf=1`).then(j => j.verse);

  // x: { k: "s:a", w: [word positions], n?: [ar, en], want?, none?, has? (letters the words must hold) }.
  // Returns { k, p, g, t, n? } (page, glyph groups, plain text), or null when the words are not found; every problem is
  // added to `problems` so the caller can stop the build with all of them listed.
  async function example(x, where, problems) {
    const v = await verse(x.k);
    const words = x.w.map(n => v.words.find(w => w.position === n && w.char_type_name === "word"));
    if (words.some(w => !w)) { problems.push(`${where} ${x.k}: no word ${x.w.join(",")}`); return null; }
    const p = words[0].page_number;
    if (words.some(w => w.page_number !== p)) { problems.push(`${where} ${x.k}: words on two pages`); return null; }
    const g = words.map(w => w.code_v2);
    // A word followed by two stop signs (يس ٥٢) is two glyph groups with a space, as on the page.
    const tokens = PAGES[p - 1].filter(l => l.w2).flatMap(l => l.w2.split(" ")), want = g.flatMap(c => c.split(" "));
    const at = tokens.findIndex((t, i) => want.every((c, j) => tokens[i + j] === c));
    if (at < 0) problems.push(`${where} ${x.k}: glyphs ${g.join(" ")} not found on page ${p} of madinah.json`);
    const t = words.map(w => w.text_uthmani).join(" ");
    if (x.want || x.none) {
      const has = colours(await fontOf(p), g);
      const miss = [...(x.want || "")].filter(c => !has.has(c)), extra = [...(x.none || "")].filter(c => has.has(c));
      if (miss.length || extra.length) problems.push(`${where} ${x.k} ${t}: shows [${[...has].join("")}]` + (miss.length ? `, lacks ${miss.join("")}` : "") + (extra.length ? `, must not show ${extra.join("")}` : ""));
    }
    if (x.has) { const plain = letters(t); for (const ch of x.has) if (!plain.includes(ch)) problems.push(`${where} ${x.k} ${t}: no letter ${ch}`); }
    return { k: x.k, p, g, t, ...(x.n ? { n: x.n } : {}) };
  }
  return { cached, fontOf, fonts, colours, verse, example, PAGES };
}

module.exports = { cacheIn, woff2Tables, cmapOf, readFont, letters, glyphs };
