// Tests of www/js/fihris-words.js (no network): how words are cut in the books and in a question, the forms a
// question's word finds, the word files, the ranking, and a question against the built index (www/fihris/).
// Usage: node scripts/fihris-test.mjs (also run by npm run check).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = await import(pathToFileURL(path.join(ROOT, "www", "js", "fihris-words.js")));
let failed = 0, passed = 0;
const check = (ok, what) => { if (ok) passed++; else { failed++; console.error("✗", what); } };
const eq = (a, b, what) => check(JSON.stringify(a) === JSON.stringify(b), `${what}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
const ch = (...cps) => String.fromCodePoint(...cps);

// ---------- words ----------
eq(W.words("وَبِالزَّكَاةِ والصلاةُ" + ch(0x27E6) + "3" + ch(0x27E7)), ["زكاه", "صلاه"], "article, glued letters, diacritics and footnote marks go");
eq(W.words("وصومه أكلَ"), ["وصومه", "صومه", "اكل"], "a word with a glued letter is also counted without it");
eq(W.words("وصومه", false), ["وصومه"], "a question's words are taken as written");
eq(W.words("والله لله بالله"), ["الله", "الله", "الله"], "the name of Allah keeps its letters");
eq(W.queryWords("هل يصح صومُ من أكل ناسيًا؟"), ["يصح", "صوم", "اكل", "ناسيا"], "question words without the words that carry no meaning");
eq(W.queryWords("ما حكم الصلاة", ["حكم"]), ["صلاه"], "the index's own common words are left out");
check(W.forms("زكاه").has("زكاتها") && W.forms("صلاه").has("صلاتين") && W.forms("صوم").has("صومه"), "forms: pronoun, dual and «ة» → «ت»");
check(!W.forms("حلي").has("حليب"), "forms: no other letters after the word");
eq([...W.forms("حج")], ["حج"], "a two-letter word is looked up as it is");

// ---------- marking a question's words in a text ----------
{
  const text = W.plain("وفي الزَّكَاةِ وزكاتها قول، والمزكاة"), hits = W.matcher(["زكاه"])(W.fold(text));
  eq(hits.map(([a, b]) => text.slice(a, b)), ["زكاة", "زكاتها"], "matcher: forms after glued letters, whole words only");
  check(W.fold(text).length === text.length, "fold keeps one letter for one");
}

// ---------- the word files ----------
{
  const entries = [["اكل", [1, 2, 5, 1, 300, 7]], ["صوم", [0, 1, 70000, 3]]];
  const back = W.decodeFile(W.encodeFile(entries).buffer);
  eq([...back.keys()], ["اكل", "صوم"], "file: words");
  eq([...back.get("اكل").docs, ...back.get("اكل").tf], [1, 5, 300, 2, 1, 7], "file: documents and counts");
  eq([...back.get("صوم").docs], [0, 70000], "file: large document numbers");
  const firsts = ["ا", "ب", "ص", "م"];
  eq(["ابل", "ب", "بيع", "صوم", "ي"].map(w => W.fileOf(w, firsts)), [0, 1, 1, 2, 3], "fileOf: the file whose words span the word");
}

// ---------- ranking ----------
{
  const lists = { صوم: [{ docs: [0, 1, 2], tf: [5, 1, 1] }], ناسي: [{ docs: [1], tf: [2] }] };
  const r = W.rank(["صوم", "ناسي"], w => lists[w] || [], { n: 100, avgdl: 100, len: [100, 100, 100] });
  eq(r[0].doc, 1, "rank: a page with more of the question's words comes first");
  eq(W.mix([{ doc: 0, score: 10 }, { doc: 1, score: 9.5 }, { doc: 2, score: 9 }], d => d < 2 ? "a" : "b").map(x => x.doc), [0, 2, 1], "mix: a second page of the same book counts a little less");
}

// ---------- the built index ----------
{
  const FX = JSON.parse(fs.readFileSync(path.join(ROOT, "www", "fihris", "index.json"), "utf8"));
  const docs = JSON.parse(fs.readFileSync(path.join(ROOT, "www", "fihris", FX.docs), "utf8"));
  const firsts = FX.words.map(w => w[0]), files = new Map();
  const file = n => { if (!files.has(n)) files.set(n, W.decodeFile(fs.readFileSync(path.join(ROOT, "www", "fihris", "w", `${n}.${FX.words[n][1]}.bin`)))); return files.get(n); };
  const q = W.queryWords("هل تجب الزكاة في حلي المرأة؟", FX.common);
  const r = W.rank(q, w => [...W.forms(w)].map(f => file(W.fileOf(f, firsts)).get(f)).filter(Boolean), { n: FX.n, avgdl: FX.avgdl, len: docs.d.map(d => d[3]) });
  const top = r.slice(0, 10).map(x => docs.books[docs.d[x.doc][0]] + "/" + docs.d[x.doc][1]);
  check(top.includes("mughni/464"), "index: «زكاة حلي المرأة» in al-Mughni is among the first results: " + top.join(" "));
  check(docs.d.length === FX.n && docs.d.every(d => docs.books[d[0]] && d[2] != null && d[3] > 0), "index: every document has its book, part and length");
}

console.log(`${failed ? "✗" : "✓"} fihris: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
