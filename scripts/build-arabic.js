// Builds «العربية لغير الناطقين بها» (#/arabic, js/arabic.js) from the Quran word by word of the Quran.com API
// (scripts/lib/wbw.js): every word of the Quran with its meaning in eight languages, its transliteration, and its
// recitation (audio.qurancdn.com/wbw/SSS_AAA_WWW.mp3, played by the app).
//  - The words that come most often in the Quran, counted over all 77,429 words, in lessons of LESSON words. Forms that
//    differ only by the vowel of their last letter (إعراب), by sukūn, or by the shaddah of assimilation on their first
//    letter (مِّن = مِن) are one word; each word keeps the form that comes most often, with the place of its first
//    occurrence (its recitation) and a short verse it appears in (an example). Its meanings are the ones Quran.com
//    gives it most often, without the words its translators add in brackets, per language.
//  - Al-Fatiha and the surahs of the last part (78–114), word by word, to read and hear.
// Output: www/data/arabic.json (index, words, lessons), www/arabic/core.<hash>.json (Arabic of the examples and surahs)
// and www/arabic/<lang>.<hash>.json (meanings). Usage: node scripts/build-arabic.js   (API answers cached in .cache/arabic)
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const W = require("./lib/wbw.js");
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "arabic");
const OUT_DIR = path.join(ROOT, "www", "arabic");
const INDEX = path.join(ROOT, "www", "data", "arabic.json");
const LESSON = 20, LESSONS = 25;
const SURAHS = [1, ...Array.from({ length: 37 }, (_, i) => 78 + i)];
const cp = (...a) => String.fromCodePoint(...a);
const SUKUN = cp(0x652), SHADDA = cp(0x651), DAGGER = cp(0x670), ALIF = cp(0x627), MAQSURA = cp(0x649), FATHATAN = cp(0x64b), FATHA = cp(0x64e);
const VOWEL = /[ً-ِ]/u; // checked below to be the six vowel and tanwīn marks
const MARK = /[ً-ٰٟ]/u;

// The word without what changes with its place in the sentence: one key for مِنْ / مِنَ / مِّن, رَبُّ / رَبِّ, كَثِيرٌ / كَثِيرًا.
function key(w) {
  const ch = [...w.normalize("NFC").replaceAll(SUKUN, "")];
  // the shaddah of assimilation on the first letter (a word never starts with a doubled letter)
  for (let i = 1; i < ch.length && MARK.test(ch[i]); i++) if (ch[i] === SHADDA) { ch.splice(i, 1); break; }
  let k = ch.join("");
  k = k.replace(new RegExp(MAQSURA + DAGGER + "$", "u"), MAQSURA);                      // عَلَىٰ = عَلَى
  k = k.replace(new RegExp("(?:" + FATHATAN + ALIF + "|" + ALIF + FATHATAN + ")$", "u"), ""); // -ًا (the alif only carries the tanwīn)
  k = k.replace(new RegExp(FATHATAN + MAQSURA + "$", "u"), FATHA + MAQSURA);           // هُدًى = هُدَى
  // the vowel or tanwīn of the last letter (its marks may hold a shaddah too: رَبِّ → رَبّ)
  const m = /^(.*[^ً-ٰٟ])([ً-ٰٟ]*)$/u.exec(k);
  if (m) k = m[1] + [...m[2]].filter(c => !VOWEL.test(c)).join("");
  return k;
}
// A meaning as the learner reads it: without the words in () and [] that its translator added to make a sentence.
function core(g) {
  const c = g.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, "").trim();
  return c || g.replace(/[()[\]]/g, "").replace(/\s+/g, " ").trim();
}

(async () => {
  if ([...cp(0x64b, 0x64c, 0x64d, 0x64e, 0x64f, 0x650)].some(c => !VOWEL.test(c)) || VOWEL.test(SHADDA) || VOWEL.test(SUKUN)) throw new Error("vowel class");
  const Q = {};
  for (const l of W.WBW_LANGS) { Q[l] = await W.quran(CACHE, l); process.stdout.write(l + " "); }
  console.log();
  // The usual spelling carries the Mushaf's pause signs (ۚ ۖ ۗ …), ۞ and ۩ next to some words: the word is without them.
  const SIGNS = /[ۖ-ۜ۞۩‏]/gu;
  for (const l of W.WBW_LANGS) for (const sura of Q[l]) for (const [, ws] of sura) for (const w of ws) w[1] = w[1].replace(SIGNS, "").replace(/\s+/g, " ").trim();
  const problems = [];
  // The eight languages must hold the same words in the same places. Some words have no meaning in a language
  // (Quran.com then gives the English one, or nothing): those are null here and the English is shown instead.
  const en = Q.en, NAME = { en: "english", ur: "urdu", id: "indonesian", bn: "bengali", tr: "turkish", fa: "persian", hi: "hindi", ta: "tamil" };
  const own = {};
  for (const l of W.WBW_LANGS) {
    let other = 0;
    en.forEach((sura, si) => sura.forEach(([a, words], vi) => {
      const lw = Q[l][si][vi][1];
      if (lw.length !== words.length || lw.some((w, i) => w[0] !== words[i][0] || w[1] !== words[i][1])) problems.push(`${l} ${si + 1}:${a}: words differ from English`);
      lw.forEach(w => { if (!w[3] || w[5] !== NAME[l]) { w[3] = null; other++; } });
      words.forEach((w, i) => { if (w[0] !== i + 1) problems.push(`${si + 1}:${a}: word ${i + 1} has position ${w[0]}`); if (!w[3] && l === "en") problems.push(`${si + 1}:${a}:${i + 1}: no English meaning`); });
    }));
    own[l] = 100 - other / 774.29;
    if (other > 77429 * 0.25) problems.push(`${l}: ${other} words without a meaning in that language`);
  }
  console.log("words with their own meaning:", Object.entries(own).map(([l, p]) => `${l} ${p.toFixed(1)}%`).join(", "));
  // A meaning in the language, or [the English meaning] when it has none.
  const gloss = (l, s, a, p) => Q[l][s - 1][a - 1][1][p - 1][3] ?? [en[s - 1][a - 1][1][p - 1][3]];

  // ---------- counting ----------
  const K = new Map(); let total = 0;
  en.forEach((sura, si) => sura.forEach(([a, words]) => words.forEach(([p, im]) => {
    total++; const k = key(im);
    let e = K.get(k); if (!e) K.set(k, e = { k, n: 0, forms: new Map(), at: [] });
    e.n++; e.at.push([si + 1, a, p]);
    const f = e.forms.get(im) || { n: 0, at: [] }; f.n++; f.at.push([si + 1, a, p]); e.forms.set(im, f);
  })));
  const ranked = [...K.values()].sort((x, y) => y.n - x.n || (x.at[0][0] - y.at[0][0]) || (x.at[0][1] - y.at[0][1]) || (x.at[0][2] - y.at[0][2]));
  const chosen = ranked.slice(0, LESSON * LESSONS);
  const verseWords = (s, a) => en[s - 1][a - 1][1];

  const words = [], examples = new Map(); let cum = 0; const cov = [];
  chosen.forEach((e, i) => {
    const [form, f] = [...e.forms].sort((x, y) => y[1].n - x[1].n)[0];
    const [s, a, p] = f.at[0];
    // a short verse with this form: the fewest words (at least three), then the earliest
    const ex = f.at.map(([s, a, p]) => ({ s, a, p, len: verseWords(s, a).length })).filter(x => x.len >= 3)
      .sort((x, y) => x.len - y.len || x.s - y.s || x.a - y.a)[0] || { s, a, p };
    examples.set(`${ex.s}:${ex.a}`, true);
    const tr = verseWords(s, a)[p - 1][4];
    if (!tr) problems.push(`${form}: no transliteration`);
    words.push([form, tr, e.n, `${s}:${a}:${p}`, `${ex.s}:${ex.a}:${ex.p}`]);
    cum += e.n; if ((i + 1) % LESSON === 0) cov.push(Math.round(cum / total * 1000) / 10);
  });
  if (new Set(words.map(w => w[0])).size !== words.length) problems.push("two words share a form");

  // ---------- the Arabic files: examples and surahs ----------
  const exKeys = [...examples.keys()].sort((x, y) => { const [a, b] = x.split(":").map(Number), [c, d] = y.split(":").map(Number); return a - c || b - d; });
  const coreFile = {
    v: Object.fromEntries(exKeys.map(k => { const [s, a] = k.split(":").map(Number); return [k, verseWords(s, a).map(w => [w[1], w[4]])]; })),
    s: Object.fromEntries(SURAHS.map(s => [s, en[s - 1].map(([, ws]) => ws.map(w => [w[1], w[4]]))])),
  };
  // ---------- the meanings, per language ----------
  // The meanings of a word in language l, most usual first; [the English ones] when it has none of its own, or when
  // its translators give it no steady meaning (no meaning in an eighth of its places: in Turkish and Tamil the
  // particles مِن، فِي، لَا… are mostly translated inside the word next to them).
  const meaningsOf = (l, e) => {
    const m = meaningsIn(l, e); return m.length ? m : [meaningsIn("en", e)];
  };
  const meaningsIn = (l, e) => {
    const groups = new Map(); let n = 0;
    for (const [s, a, p] of e.at) {
      const g = Q[l][s - 1][a - 1][1][p - 1][3]; if (!g) continue;
      n++; const c = core(g), low = c.toLocaleLowerCase(l);
      const x = groups.get(low) || { n: 0, shown: new Map() }; x.n++; x.shown.set(c, (x.shown.get(c) || 0) + 1); groups.set(low, x);
    }
    const list = [...groups].sort((x, y) => y[1].n - x[1].n), out = [];
    if (!list.length || list[0][1].n < n / 8) return out;
    list.forEach(([low, x], i) => {
      if (out.length >= 3 || (i === 1 && x.n < n * 0.12) || (i === 2 && x.n < n * 0.1)) return;
      if (i > 2) return;
      // the lower-case form when the translators wrote it so (not only at the start of a verse), else the usual one
      const shown = x.shown.has(low) ? low : [...x.shown].sort((p, q) => q[1] - p[1])[0][0];
      out.push(shown);
    });
    return out;
  };
  const langFiles = {};
  for (const l of W.WBW_LANGS) {
    // w: the meanings of each word (or [[English meanings]]); v and s: each word's meaning in its verse (or [English])
    const lf = {
      w: chosen.map(e => meaningsOf(l, e)),
      v: Object.fromEntries(exKeys.map(k => { const [s, a] = k.split(":").map(Number); return [k, verseWords(s, a).map(w => gloss(l, s, a, w[0]))]; })),
      s: Object.fromEntries(SURAHS.map(s => [s, en[s - 1].map(([a, ws]) => ws.map(w => gloss(l, s, a, w[0])))])),
    };
    lf.w.forEach((m, i) => { if (!m.length || (Array.isArray(m[0]) && !m[0].length)) problems.push(`${l}: ${words[i][0]} has no meaning`); });
    langFiles[l] = lf;
  }
  if (problems.length) { console.error(problems.slice(0, 40).join("\n")); console.error(`${problems.length} problems: nothing written`); process.exit(1); }

  // ---------- writing: content-named files, then the index ----------
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const written = [];
  const put = (name, obj) => {
    const s = JSON.stringify(obj); const h = crypto.createHash("sha256").update(s).digest("hex").slice(0, 10);
    const f = `${name}.${h}.json`; fs.writeFileSync(path.join(OUT_DIR, f), s); written.push(f); return f;
  };
  const files = { core: put("core", coreFile) };
  for (const l of W.WBW_LANGS) files[l] = put(l, langFiles[l]);
  for (const f of fs.readdirSync(OUT_DIR)) if (!written.includes(f)) fs.unlinkSync(path.join(OUT_DIR, f));
  const index = {
    built: new Date().toISOString().slice(0, 10),
    note: "Quran words by frequency with meanings from the Quran.com API (word by word), scripts/build-arabic.js. Rebuild with: npm run arabic",
    source: "https://quran.com", audio: "https://audio.qurancdn.com/wbw/",
    total, lesson: LESSON, langs: W.WBW_LANGS, files, cov, surahs: SURAHS,
    // [form, transliteration, times in the Quran, its recitation "s:a:p", the example "s:a:p"]
    words,
  };
  fs.writeFileSync(INDEX, JSON.stringify(index));
  const kb = f => (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0) + " KB";
  console.log(`${words.length} words in ${LESSONS} lessons, covering ${cov.at(-1)}% of the ${total} words of the Quran; ${exKeys.length} example verses`);
  console.log(`index ${(fs.statSync(INDEX).size / 1024).toFixed(0)} KB; ${Object.entries(files).map(([k, f]) => `${k} ${kb(f)}`).join(", ")}`);
})().catch(e => { console.error(e); process.exit(1); });
