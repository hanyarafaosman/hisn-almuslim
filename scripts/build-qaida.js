// Builds www/data/qaida.json for «تعلّم القراءة من الصفر» (#/qaida) from scripts/qaida-source.js: the lessons that take a
// learner from the letters to the stop signs. Every example is a word (or two) of the Madinah Mushaf, given as a verse
// and word positions, and becomes the glyphs of that word on its printed page in the Tajweed print (scripts/lib/glyphs.js,
// shared with build-tajweed.js): the build checks the word is there, that it holds the letter it is an example of
// (`has`), and that it shows the colours it is given for (`want`, the codes of scripts/tajweed-source.js) — or writes
// nothing. The 28 letters come with a word for each written shape (LETTER_WORDS) and, where a letter opens a surah
// (المقطعات), that verse, so its name can be heard in the recitation.
// Usage: node scripts/build-qaida.js   (verses and fonts cached in .cache/tajweed)
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "www", "data", "qaida.json");
const SRC = require("./qaida-source.js");
const { COLORS } = require("./tajweed-source.js");
const G = require("./lib/glyphs.js").glyphs({ cache: ".cache/tajweed", colors: COLORS });
const ALPHABET = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي";
const NO_JOIN = "ادذرزو"; // letters that do not join the letter after them: two shapes, not four

(async () => {
  const problems = [];
  const example = (x, where) => G.example(x, where, problems);
  const pair = (x, where) => { if (!Array.isArray(x) || x.length !== 2 || x.some(v => typeof v !== "string" || !v.trim())) problems.push(`${where}: text must be [Arabic, English]`); };

  if (SRC.LETTERS.map(x => x.l).join("") !== ALPHABET) problems.push("LETTERS: the 28 letters in their order expected");
  if (SRC.LETTER_LESSONS.map(x => x.letters).join("") !== ALPHABET) problems.push("LETTER_LESSONS: together they must hold the 28 letters once, in order");
  const lessons = [];
  // ---------- the letters: name, sound, the surah they open, and a word for each written shape ----------
  for (const L of SRC.LETTER_LESSONS) {
    pair(L.t, L.id); pair(L.sub, L.id); (L.intro || []).forEach(x => pair(x, L.id));
    const letters = [];
    for (const l of L.letters) {
      const def = SRC.LETTERS.find(x => x.l === l); pair(def.n, `letter ${l}`); pair(def.sound, `letter ${l}`);
      const words = SRC.LETTER_WORDS[l] || {}, want = NO_JOIN.includes(l) ? "sf" : "simf";
      if (Object.keys(words).join("") !== want) problems.push(`letter ${l}: shapes ${Object.keys(words).join("")}, ${want} expected`);
      const forms = [];
      for (const [f, [k, w]] of Object.entries(words)) { const r = await example({ k, w: [w], has: l }, `letter ${l} shape ${f}`); if (r) forms.push({ f, ex: r }); }
      const muq = SRC.MUQ[l] ? await example({ k: SRC.MUQ[l], w: [1], has: l }, `letter ${l} name`) : null;
      letters.push({ l, n: def.n, sound: def.sound, ...(muq ? { muq } : {}), forms });
    }
    lessons.push({ id: L.id, t: L.t, sub: L.sub, intro: L.intro || [], letters });
  }
  // ---------- the signs: vowels, tanwīn, sukūn, shaddah, madd, the lāms, the hamzahs, the tāʾs, the stop signs ----------
  for (const L of SRC.LESSONS) {
    pair(L.t, L.id); pair(L.sub, L.id); (L.intro || []).forEach(x => pair(x, L.id));
    const s = [];
    for (const [i, sec] of L.s.entries()) {
      const where = `${L.id} §${i + 1}`;
      pair(sec.h, where); [...(sec.p || []), ...(sec.list || [])].forEach(x => pair(x, where));
      const ex = [];
      for (const e of sec.ex || []) { const r = await example(e, where); if (r) ex.push(r); }
      s.push({ h: sec.h, ...(sec.p ? { p: sec.p } : {}), ...(sec.list ? { list: sec.list } : {}), ...(ex.length ? { ex } : {}) });
    }
    if (!s.some(x => x.ex)) problems.push(`${L.id}: a lesson needs examples to read and hear`);
    lessons.push({ id: L.id, t: L.t, sub: L.sub, intro: L.intro || [], s });
  }
  if (new Set(lessons.map(l => l.id)).size !== lessons.length) problems.push("duplicate lesson ids");
  [...SRC.INTRO, SRC.SOURCE, ...Object.values(SRC.FORMS)].forEach((x, i) => pair(x, "intro " + i));
  if (Object.keys(SRC.FORMS).join("") !== "simf") problems.push("FORMS: s, i, m, f expected");

  if (problems.length) { console.error("✗ " + problems.join("\n✗ ")); process.exit(1); }
  const out = {
    note: "Learning to read (#/qaida). Built by scripts/build-qaida.js from scripts/qaida-source.js; examples are glyphs of the Tajweed print's pages (p, g). Rebuild with: npm run qaida",
    built: new Date().toISOString().slice(0, 10),
    source: SRC.SOURCE, intro: SRC.INTRO, forms: SRC.FORMS, lessons,
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  const exs = lessons.flatMap(l => [...(l.letters || []).flatMap(x => [...x.forms.map(f => f.ex), ...(x.muq ? [x.muq] : [])]), ...(l.s || []).flatMap(x => x.ex || [])]);
  console.log(`✓ ${path.relative(ROOT, OUT)}: ${lessons.length} lessons, ${exs.length} examples on ${new Set(exs.map(x => x.p)).size} pages, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
})().catch(e => { console.error(e); process.exit(1); });
