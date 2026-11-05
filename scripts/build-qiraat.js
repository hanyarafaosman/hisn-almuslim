// Builds www/data/qiraat.json for the readings page (#/qiraat) from scripts/qiraat-source.js:
// - the readers and narrators, with the verses of each matn that introduce them (found by name in the matn's preface);
// - the chapters of the uṣūl, each with the chapters of الشاطبية, الدرة and طيبة النشر that are its evidence (resolved
//   from www/data/mutun.json by title) and its examples;
// - every example is checked against the King Fahd Complex texts with the same comparison the app uses
//   (www/js/qdiff.js): a word named as differing in a riwayah must differ there, else the build stops.
// Usage: node scripts/build-qiraat.js   (after npm run mutun)
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "www", "data", "qiraat.json");
const SRC = require("./qiraat-source.js");
const readJson = f => JSON.parse(fs.readFileSync(path.join(ROOT, "www", f), "utf8"));
const cp = String.fromCodePoint;
// Titles without vowels and small signs; the hamza marks and the madda (NFD splits أ and آ) are kept.
const MARKS = new RegExp(`[${cp(0x64B)}-${cp(0x652)}${cp(0x656)}-${cp(0x65F)}${cp(0x670)}${cp(0x6D6)}-${cp(0x6ED)}]`, "g");
const plain = s => s.normalize("NFD").replace(MARKS, "").normalize("NFC");

(async () => {
  const { words, compare } = await import("../www/js/qdiff.js");
  const problems = [];
  const mutun = readJson("data/mutun.json");
  const bookOf = id => mutun.books.find(b => b.id === id);
  const versesOf = id => readJson("mutun/" + bookOf(id).file).v;
  const quran = readJson("quran/index.json");
  const texts = Object.fromEntries(quran.riwayat.map(r => [r.id, readJson(r.data)]));
  const hafs = texts.hafs;

  // ---------- the readers: the verses of each matn's preface that name the reader and his narrators ----------
  const readers = SRC.READERS.map(r => {
    const ref = {};
    for (const [book, ids] of Object.entries(SRC.READER_BOOKS)) {
      if (!ids.includes(r.id)) continue;
      const b = bookOf(book), v = versesOf(book), intro = b.chapters[0]; // the preface is the first chapter
      const lines = v.slice(intro.from - 1, intro.to).map((h, i) => ({ n: intro.from + i, t: plain(h.join(" ")) }));
      const hit = lines.find(l => r.find.test(l.t) && r.nar.some(x => x.find.test(l.t) || lines.slice(lines.indexOf(l), lines.indexOf(l) + 3).some(m => x.find.test(m.t))));
      if (!hit) { problems.push(`${r.id}: not found in the preface of ${book}`); continue; }
      // From that verse to the last of the next few that names one of his narrators.
      const at = lines.indexOf(hit); let end = at;
      for (let i = at; i < Math.min(lines.length, at + 4); i++) if (r.nar.some(x => x.find.test(lines[i].t))) end = i;
      ref[book] = [lines[at].n, lines[end].n];
    }
    return { id: r.id, n: r.n, full: r.full, city: r.city, died: r.died, ...(r.kufi ? { kufi: true } : {}), nar: r.nar.map(x => ({ id: x.id, n: x.n, full: x.full, died: x.died, ...(x.riwayah ? { riwayah: x.riwayah } : {}) })), ref };
  });

  // ---------- the chapters of the uṣūl ----------
  const chapterIds = (book, pats) => {
    if (pats === null) return [];
    const b = bookOf(book), out = [];
    for (const re of [].concat(pats)) {
      const hits = b.chapters.map((c, i) => [c, i]).filter(([c]) => re.test(plain(c.t).replace(/\s+/g, " ")));
      if (!hits.length) problems.push(`${book}: no chapter matches ${re}`);
      hits.forEach(([, i]) => { if (!out.includes(i)) out.push(i); });
    }
    return out;
  };
  // Does the Hafs word at position w of verse k differ in riwayah rid? (any class but "same")
  const memo = new Map();
  const cmp = (rid, s) => { const k = rid + ":" + s; if (!memo.has(k)) memo.set(k, compare(hafs.s[s - 1], texts[rid].s[s - 1])); return memo.get(k); };
  const usul = [];
  for (const u of SRC.USUL) {
    const ch = {}; for (const book of ["shatibiyya", "durrah", "tayyiba"]) ch[book] = chapterIds(book, u.ch[book]);
    const ex = [];
    for (const x of u.ex) {
      const [s, a] = x.k.split(":").map(Number);
      const verse = hafs.s[s - 1]?.[a - 1]; if (!verse) { problems.push(`${u.id} ${x.k}: no such verse`); continue; }
      const H = words([verse]), bad = x.w.filter(n => !H[n - 1]);
      if (bad.length) { problems.push(`${u.id} ${x.k}: no word ${bad.join(",")} (${H.length} words)`); continue; }
      for (const rid of x.riwayat) {
        if (!texts[rid]) { problems.push(`${u.id} ${x.k}: unknown riwayah ${rid}`); continue; }
        if (!x.textual) continue;
        const { H: HS, hcls } = cmp(rid, s);
        const first = HS.findIndex(w => w.a === a); // the verse's words inside the surah
        if (!x.w.some(n => hcls[first + n - 1])) problems.push(`${u.id} ${x.k} word ${x.w.join(",")} «${x.w.map(n => H[n - 1].w).join(" ")}»: no difference in ${rid}`);
      }
      ex.push({ k: x.k, w: x.w, t: x.w.map(n => H[n - 1].w).join(" "), riwayat: x.riwayat, n: x.n, ...(x.textual ? {} : { textual: false }) });
    }
    usul.push({ id: u.id, t: u.t, p: u.p, ch, ex });
  }
  if (new Set(usul.map(u => u.id)).size !== usul.length) problems.push("duplicate rule ids");

  if (problems.length) { console.error("✗ " + problems.join("\n✗ ")); process.exit(1); }
  const out = {
    note: "The readings page (#/qiraat). Built by scripts/build-qiraat.js from scripts/qiraat-source.js; chapter numbers point into www/data/mutun.json. Rebuild with: npm run qiraat",
    built: new Date().toISOString().slice(0, 10),
    intro: SRC.INTRO, sourceNote: SRC.NOTE, readers, usul,
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`✓ ${path.relative(ROOT, OUT)}: ${readers.length} readers, ${usul.length} chapters of uṣūl, ${usul.reduce((n, u) => n + u.ex.length, 0)} examples, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
})().catch(e => { console.error(e); process.exit(1); });
