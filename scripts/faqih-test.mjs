// Tests of scripts/faqih-chunk.mjs (no network): the normalisation that quotations are checked with, the cutting of
// reading pages into passages, and a pass over a real book of www/kutub. Usage: node scripts/faqih-test.mjs
// (also run by npm run check).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SIZES, normalizeArabic, stripMarks, stripTashkeel, headingPath, contextLine, splitParagraph, chunkSection, chunkId, metadataOf } from "./faqih-chunk.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0, passed = 0;
const check = (ok, what) => { if (ok) passed++; else { failed++; console.error("✗", what); } };
const eq = (a, b, what) => check(JSON.stringify(a) === JSON.stringify(b), `${what}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
const ch = (...cps) => String.fromCodePoint(...cps);
const ref = n => ch(0x27E6) + n + ch(0x27E7);

// ---------- normalisation ----------
{
  const vocalised = "وَلَنَا قَوْلُ اللَّهِ تَعَالَى: ﴿فَلَمْ تَجِدُوا مَاءً فَتَيَمَّمُوا﴾ [النساء: ٤٣]" + ref(1) + " وَهَذَا نَصٌّ.";
  eq(normalizeArabic(vocalised), "ولنا قول الله تعالي فلم تجدوا ماء فتيمموا النساء ٤٣ وهذا نص", "diacritics, marks and punctuation go, letters unify");
  eq(normalizeArabic("أإآٱ ة ى ـــ"), "اااا ه ي", "alif, taa marbuta, alif maqsura, tatweel");
  eq(normalizeArabic("  كتاب   الطهارة\n\nباب "), "كتاب الطهاره باب", "spaces collapse");
  check(normalizeArabic(vocalised).includes(normalizeArabic("فلم تجدوا ماءً فتيمّموا")), "a quotation typed without diacritics is found in the vocalised text");
  eq(stripMarks("نص" + ref(12) + " آخر"), "نص آخر", "stripMarks");
  eq(stripTashkeel("مُقَدِّمَة"), "مقدمة", "stripTashkeel keeps letters only");
}

// ---------- splitting a very long paragraph ----------
{
  const sentence = "هذه جملة من الكلام الطويل الذي لا ينقطع في الصفحة. ";
  const long = sentence.repeat(120); // ~6000 chars
  const parts = splitParagraph(long, 3500);
  check(parts.length >= 2 && parts.every(p => p.length <= 3500), "pieces fit the limit");
  check(parts.every(p => /\.$/.test(p)), "pieces end at a sentence end");
  eq(parts.join(" ").replace(/\s+/g, " ").trim(), long.replace(/\s+/g, " ").trim(), "nothing lost or doubled");
  eq(splitParagraph("قصير", 3500), ["قصير"], "a short paragraph is left alone");
  const noBreaks = "كلمة".repeat(2000);
  check(splitParagraph(noBreaks, 3500).every(p => p.length <= 3500), "a paragraph with no break at all is still cut");
}

// ---------- cutting a reading page ----------
const book = { id: "mughni", ar: "المغني", by: "موفق الدين ابن قدامة المقدسي", madhhab: "hanbali", file: "mughni.23e9c78257.json" };
const sections = [
  { t: "كتاب الطهارة", l: 1 },
  { t: "باب ما تكون به الطهارة من الماء", l: 2, pg: [7, 10], v: ["1", "1"], c: 0 },
  { t: "فصل غير النبيذ من المائعات", l: 3, pg: [10, 12], v: ["1", "1"], c: 0 },
];
eq(headingPath(sections, 2), ["كتاب الطهارة", "باب ما تكون به الطهارة من الماء", "فصل غير النبيذ من المائعات"], "heading path climbs the levels");
eq(headingPath(sections, 0), ["كتاب الطهارة"], "heading path of a top heading");
eq(contextLine(book, ["كتاب الطهارة", "باب الآنية"]), "المغني، موفق الدين ابن قدامة المقدسي، الفقه الحنبلي › كتاب الطهارة › باب الآنية", "context line");
eq(contextLine({ ar: "الموسوعة الفقهية الكويتية", by: "وزارة الأوقاف" }, ["إعانة", "الحكم التكليفي"]), "الموسوعة الفقهية الكويتية، وزارة الأوقاف › إعانة › الحكم التكليفي", "context line without a school");
{
  // A short page: one passage with every paragraph, marks removed, separator ignored.
  const body = [{ p: "فَصْلٌ: الأولى" + ref(1), a: "h5" }, { sep: 1 }, { p: "الثانية." }, { p: "الثالثة." }];
  const out = chunkSection(book, sections, 2, body);
  eq(out.length, 1, "short page is one passage");
  eq([out[0].s, out[0].p0, out[0].p1, out[0].k], [2, 0, 3, 0], "passage spans the page");
  eq(out[0].text, "فَصْلٌ: الأولى\nالثانية.\nالثالثة.", "verbatim text, marks removed");
  check(out[0].embed.startsWith("المغني، موفق الدين ابن قدامة المقدسي، الفقه الحنبلي › كتاب الطهارة › باب ما تكون به الطهارة من الماء › فصل غير النبيذ من المائعات\nفصل: الأولى"), "embedded text starts with the context line and has no diacritics");
  eq(chunkId("mughni", out[0]), "mughni/2/0", "id");
  const m = metadataOf(book, sections[2], out[0]);
  eq([m.b, m.s, m.p0, m.p1, m.pg0, m.pg1, m.v0, m.v1, m.bh], ["mughni", 2, 0, 3, 10, 12, "1", "1", "23e9c78257"], "metadata");
  eq(m.h, "كتاب الطهارة › باب ما تكون به الطهارة من الماء › فصل غير النبيذ من المائعات", "metadata heading path");
}
{
  // A long page: passages of about SIZES.chunk characters, cut between paragraphs, a short last paragraph repeated.
  const para = i => ({ p: `الفقرة ${i} ` + "كلام ".repeat(60) + "." }); // ~310 chars
  const body = Array.from({ length: 40 }, (_, i) => para(i));
  const out = chunkSection(book, sections, 1, body);
  check(out.length > 5, "a long page gives several passages");
  check(out.every(c => c.text.length <= SIZES.chunk + 400), "passages stay near the size");
  check(out.every((c, i) => !i || c.p0 === out[i - 1].p1), "each passage repeats the last paragraph of the one before");
  eq(out.at(-1).p1, 39, "the last passage ends the page");
  const covered = new Set(out.flatMap(c => Array.from({ length: c.p1 - c.p0 + 1 }, (_, k) => c.p0 + k)));
  eq(covered.size, 40, "every paragraph is in a passage");
  eq(new Set(out.map(c => chunkId("mughni", c))).size, out.length, "ids are unique");
}
{
  // An inline heading adds itself to the path of the passages after it; a huge paragraph is cut into pieces k=0,1….
  const big = "جملة طويلة من الكلام المتصل. ".repeat(300); // ~9000 chars
  const body = [{ p: "تمهيد." }, { h: "فصل في النبيذ", l: 1, a: "h9" }, { p: big }];
  const out = chunkSection(book, sections, 1, body);
  check(out.length >= 3, "the huge paragraph gives pieces");
  eq(out[0].path.at(-1), "باب ما تكون به الطهارة من الماء", "first passage under the page heading");
  check(out.slice(1).every(c => c.path.at(-1) === "فصل في النبيذ"), "later passages under the inline heading");
  const pieces = out.filter(c => c.p0 === 2);
  eq(pieces.map(c => c.k), pieces.map((c, i) => i), "pieces of one paragraph are numbered");
  check(pieces.every(c => Buffer.byteLength(JSON.stringify(metadataOf(book, sections[1], c))) < 10240), "metadata of a piece stays under 10 KiB");
  check(new Set(out.map(c => chunkId("mughni", c))).size === out.length, "piece ids are unique");
}
{
  // Nothing to say: a group title or a page with only a separator.
  eq(chunkSection(book, sections, 0, []), [], "no body, no passages");
  eq(chunkSection(book, sections, 1, [{ sep: 1 }]), [], "a separator alone");
}

// ---------- a real book ----------
{
  const ix = JSON.parse(fs.readFileSync(path.join(ROOT, "www/kutub/index.json"), "utf8"));
  const b = ix.books.find(x => x.id === "zad") || ix.books[0];
  const head = JSON.parse(fs.readFileSync(path.join(ROOT, "www/kutub", b.file), "utf8"));
  const part = JSON.parse(fs.readFileSync(path.join(ROOT, "www/kutub", b.id, `0.${b.chunks[0]}.json`), "utf8"));
  let n = 0, bytes = 0;
  for (const [i, text] of Object.entries(part)) {
    const s = head.sections[i];
    for (const c of chunkSection(b, head.sections, Number(i), text.body)) {
      n++;
      const m = metadataOf(b, s, c); bytes = Math.max(bytes, Buffer.byteLength(JSON.stringify(m)));
      const first = text.body[c.p0]; const para = first.p != null ? stripMarks(first.p) : null;
      if (para && !c.k && !normalizeArabic(c.text).startsWith(normalizeArabic(para).slice(0, 40))) { check(false, `${b.id} ${chunkId(b.id, c)}: text does not start at paragraph p0`); }
      if (!c.text.trim() || c.p0 > c.p1 || c.p1 >= text.body.length) check(false, `${b.id} ${chunkId(b.id, c)}: bad bounds`);
      if (!c.embed.startsWith(b.ar)) check(false, `${b.id} ${chunkId(b.id, c)}: embed without the context line`);
      if (c.text.includes(ch(0x27E6))) check(false, `${b.id} ${chunkId(b.id, c)}: footnote mark left in the text`);
    }
  }
  check(n > 0 && bytes < 10240, `${b.id}: ${n} passages from part 0, largest metadata ${bytes} bytes`);
}

console.log(`${failed ? "✗" : "✓"} faqih-chunk: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
