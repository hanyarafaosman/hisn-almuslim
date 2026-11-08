// Builds the matn library (#/mutun): the five poems of Tajweed and the readings, verse by verse, from the critically
// edited and numbered editions on turath.io:
// - تحفة الأطفال (571) and المقدمة الجزرية (1096): Dr ʿAbd al-Muhsin al-Qasim's editions («متون طالب العلم»)
// - الشاطبية (7754), الدرة المضية (7749) and طيبة النشر (7795): Muhammad Tamim al-Zuʿbi's editions
// Each book's text is cut at its own headings (the <span data-type="title"> marks in the pages, in order); every line
// «N - first half … second half» is a verse. The build stops on any verse missing, doubled or holding a footnote mark,
// on a chapter whose verse count differs from the number printed after its heading, on any line it does not know,
// and when the chapters of فرش الحروف do not cover surahs 2–114 exactly once.
// Output: www/mutun/<id>.<hash>.json (the verses) and www/data/mutun.json (books, chapters, file names).
// Usage: node scripts/build-mutun.js        (downloads are kept in .cache/mutun/)
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "mutun");
const OUT_DIR = path.join(ROOT, "www", "mutun");
const INDEX = path.join(ROOT, "www", "data", "mutun.json");
// files.turath.io answers IPv6 and IPv4; with Node's 250 ms per address, slow connections fail on all of them.
require("net").setDefaultAutoSelectFamilyAttemptTimeout(2000);

// from: the heading the poem starts at (its title, without vowels); to: the first heading after it that is not part of
// the poem. intro: the title given to verses that come before the poem's first heading. count: verses expected.
// fix.split: verses printed without the «…» between the halves: how many words the first half has.
// fix.dup: a verse number the edition printed twice, and the number its second occurrence really has.
// fix.counts: a chapter whose printed verse count is a misprint, with the count its verses really have.
const BOOKS = [
  { id: "tuhfa", turath: 571, count: 61, from: /^تحفة الأطفال/, to: /^شروط الصلاة/, intro: "المقدمة",
    title: ["تحفة الأطفال والغلمان في تجويد القرآن", "Tuḥfat al-Aṭfāl"], author: ["سليمان الجمزوري", "Sulaymān al-Jamzūrī"], died: 1198, diedNote: ["كان حيًّا سنة ١٢١٣هـ", "alive in 1213 AH"],
    edition: ["تحقيق د. عبد المحسن القاسم (متون طالب العلم)", "ed. Dr ʿAbd al-Muḥsin al-Qāsim (Mutūn Ṭālib al-ʿIlm)"], subject: "tajweed" },
  { id: "jazariyya", turath: 1096, count: 107, from: /^النسخ المعتمدة/, intro: "المقدمة", // the poem's own heading is not marked in the text; it begins after the manuscripts list
    title: ["المقدمة فيما على قارئ القرآن أن يعلمه (الجزرية)", "Al-Muqaddimah al-Jazariyyah"], author: ["ابن الجزري", "Ibn al-Jazarī"], died: 833,
    edition: ["تحقيق د. عبد المحسن القاسم (متون طالب العلم)", "ed. Dr ʿAbd al-Muḥsin al-Qāsim (Mutūn Ṭālib al-ʿIlm)"], subject: "tajweed" },
  { id: "shatibiyya", turath: 7754, count: 1173, from: /^\(?مقدمة\)?$/,
    title: ["حرز الأماني ووجه التهاني في القراءات السبع (الشاطبية)", "Ḥirz al-Amānī (al-Shāṭibiyyah): the seven readings"], author: ["القاسم بن فيره الشاطبي", "Al-Qāsim ibn Fīrruh al-Shāṭibī"], died: 590,
    edition: ["تحقيق محمد تميم الزعبي، دار الهدى ودار الغوثاني، ط٤ ١٤٢٦هـ", "ed. Muḥammad Tamīm al-Zuʿbī, Dār al-Hudā / Dār al-Ghawthānī, 4th ed. 1426 AH"], subject: "qiraat",
    fix: { split: { 107: 5, 444: 5 }, counts: { "باب مذاهبهم في ياءات الإضافة": 33 } } }, // verses 387–419; the edition prints ٥٧ after the heading
  { id: "durrah", turath: 7749, count: 241, from: /^المقدمة$/,
    title: ["الدرة المضية في القراءات الثلاث المتممة للعشر", "Al-Durrah al-Muḍiyyah: the three readings completing the ten"], author: ["ابن الجزري", "Ibn al-Jazarī"], died: 833,
    edition: ["تحقيق محمد تميم الزعبي، دار الهدى، ط٢ ١٤٢١هـ", "ed. Muḥammad Tamīm al-Zuʿbī, Dār al-Hudā, 2nd ed. 1421 AH"], subject: "qiraat",
    fix: { dup: { 238: 239 } } },
  { id: "tayyiba", turath: 7795, count: 1015, from: /^المقدمة$/,
    title: ["طيبة النشر في القراءات العشر", "Ṭayyibat al-Nashr: the ten readings"], author: ["ابن الجزري", "Ibn al-Jazarī"], died: 833,
    edition: ["تحقيق محمد تميم الزعبي، دار الهدى، ط١ ١٤١٤هـ", "ed. Muḥammad Tamīm al-Zuʿbī, Dār al-Hudā, 1st ed. 1414 AH"], subject: "qiraat" },
];

const DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toNum = s => Number(String(s).replace(/[٠-٩]/g, d => DIGITS.indexOf(d)));
const HONORIFICS = { "﵀": "رحمه الله", "﵇": "عليه السلام", "﵈": "عليهم السلام", "﵊": "عليه الصلاة والسلام", "﵍": "عليها السلام", "ﷺ": "صلى الله عليه وسلم", "﷿": "عز وجل" };
// Without vowels and small signs (NFD splits أ into ا + a hamza mark, U+0654/U+0655, which is kept).
const cp = String.fromCodePoint;
const MARKS = new RegExp(`[${cp(0x64B)}-${cp(0x652)}${cp(0x656)}-${cp(0x65F)}${cp(0x670)}${cp(0x6D6)}-${cp(0x6ED)}]`, "g"); // the madda stays too (آ)
const plain = s => s.normalize("NFD").replace(MARKS, "").normalize("NFC");

async function cached(name, url) {
  const file = path.join(CACHE, name);
  if (!fs.existsSync(file)) {
    let last;
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        const b = Buffer.from(await r.arrayBuffer()); JSON.parse(b.toString("utf8"));
        fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(file, b); last = null; break;
      } catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
    }
    if (last) throw last;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// ---------- surah names in the headings of فرش الحروف ----------
const SURAHS = JSON.parse(fs.readFileSync(path.join(ROOT, "www", "quran", "index.json"), "utf8")).riwayat[0].surahs.map(s => s[0]);
const nameKey = s => plain(s).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
const NAMES = new Map(SURAHS.map((n, i) => [nameKey(n), i + 1]));
for (const [k, v] of Object.entries({ "ام القران": 1, "بني اسرائيل": 17, "الملائكة": 35, "المؤمن": 40, "حم السجدة": 41, "الشريعة": 45, "الامتحان": 60, "ن": 68, "الدهر": 76, "التطفيف": 83, "الانشراح": 94, "الزلزال": 99, "ص": 38, "ق": 50, "طه": 20, "يس": 36 })) NAMES.set(nameKey(k), v);
const surahNo = name => { const n = NAMES.get(nameKey(name)); if (!n) throw new Error(`unknown surah «${name}»`); return n; };
// «سورة البقرة», «سورة الأعراف والأنفال», «سورة الرعد وأختيها», «ومن سورة الروم إلى سورة سبأ», «من سورة العلق إلى آخر القرآن»
function surahsOf(title) {
  let s = plain(title).replace(/[﵀-﵏ﷺ-﷿]/g, " ").replace(/[()\-–:]/g, " ")
    .replace(new RegExp("عليهما الصلاة والسلام|" + Object.values(HONORIFICS).join("|"), "g"), " ").replace(/\s+/g, " ").trim();
  if (!/^و?من سورة |^سورة /.test(s)) return null;
  let m = /^و?من سورة (.+?) إلى (?:سورة (.+)|اخر القران|آخر القرآن)$/.exec(s);
  if (m) { const a = surahNo(m[1]), b = m[2] ? surahNo(m[2]) - 1 : 114; return Array.from({ length: b - a + 1 }, (_, i) => a + i); }
  m = /^سورة (.+?) واخت(ي)?ها$/.exec(s.replace(/أ/g, "ا"));
  if (m) { const a = surahNo(m[1]); return m[2] ? [a, a + 1, a + 2] : [a, a + 1]; }
  return s.slice(5).split(/ و(?=\S)/).map(x => surahNo(x));
}

// ---------- one book ----------
// A heading, with the verse count the edition prints after it: «(٩٤)», or a bare «٩» in the Durrah.
const SPAN = /<span data-type="title"[^>]*>([\s\S]*?)<\/span>[ \t]*(?:\(?([٠-٩]+)\)?(?=\s|$))?/g;
const VERSE = /^([٠-٩]+)\s*[-–]\s*(.+?)\s*(?:\.\.\.|…)\s*(.+?)\s*$/;
const BARE = /^([٠-٩]+)\s*[-–]\s*(.+?)\s*$/; // a verse printed without the mark between its halves (fix.split)
const PLAIN_HEAD = /^((?:باب|فصل|سورة)\s.+?)\s*\(([٠-٩]+)\)\s*$/; // a heading the edition left unmarked, with its verse count
const COUNT_LINE = new RegExp(`^(?:[${cp(0xFD40)}-${cp(0xFD4F)}${cp(0xFDFA)}-${cp(0xFDFF)}]\\s*|أي: [^\\]]*\\]\\s*)?\\(?([٠-٩]+)\\)?:?$`);
// Lines that are not verses: ornaments, the basmala, a chapter's number printed before its heading, the colophon,
// the editor's notes before the poem (the number of verses, the metre, the manuscripts).
const SKIP = [/^\* \* \*$/, /^:$/, /^\.\.\.$/, /^فرش$/, /^نسخة خطية/, /^تمت? بحمد الله/, /^[٠-٩]+\s*-$/, /^بسم الله الرحمن الرحيم$/, /^\[عدد الأبيات: [٠-٩]+\]$/, /^\[البحر: .+\]$/, /^\(كان .+\)$/, /^لسليمان بن حسين/, /^\* النسخ المعتمدة/, /^- نسخة/];
const clean = s => s.replace(/[﵀-﵏ﷺ-﷿]/g, c => ` ${HONORIFICS[c] || "?"} `).replace(/[()[\]]/g, "").replace(/^[٠-٩]+\s*-\s*/, "").replace(/:$/, "").replace(/\s*-\s*/g, " ").replace(/\s+/g, " ").trim();

async function build(b, problems) {
  const P = m => problems.push(`${b.id}: ${m}`);
  const [book, info] = await Promise.all([cached(`turath-${b.turath}.json`, `https://files.turath.io/books-v3/${b.turath}.json`), cached(`index-${b.turath}.json`, `https://api.turath.io/book?id=${b.turath}&include=indexes&ver=3`)]);
  const levels = info.indexes.headings.map(h => h.level);
  // The pages in order, each cut into headings and lines.
  const items = []; let nh = 0;
  for (const p of book.pages) {
    let last = 0; const text = p.text;
    for (const m of text.matchAll(SPAN)) {
      text.slice(last, m.index).split("\n").forEach(l => items.push({ line: l.trim(), page: p.page }));
      // The level: marked in the text (al-Qasim's editions), else the index entry the heading's toc id points to.
      const lv = /data-level="(\d+)"/.exec(m[0]), toc = /id="?toc-(\d+)"?/.exec(m[0]);
      items.push({ head: m[1].replace(/<[^>]+>/g, "").trim(), count: m[2] ? toNum(m[2]) : null, level: lv ? Number(lv[1]) : toc ? levels[Number(toc[1]) - 1] ?? 1 : 1, page: p.page }); nh++;
      last = m.index + m[0].length;
    }
    text.slice(last).split("\n").forEach(l => items.push({ line: l.trim(), page: p.page }));
  }
  if (process.env.DEBUG) items.filter(x => x.head).forEach(x => console.log(`   [${x.level}] p${x.page} ${x.head.slice(0, 50)} ${x.count ?? ""}`));
  // Only the poem: from its first heading to the heading that ends it.
  const start = items.findIndex(x => x.head && b.from.test(plain(x.head).replace(/:$/, "")));
  if (start < 0) { P("start heading not found"); return null; }
  let end = items.length;
  if (b.to) { end = items.findIndex((x, i) => i > start && x.head && b.to.test(plain(x.head))); if (end < 0) { P("end heading not found"); return null; } }

  // Headings in order with the verse the text puts them before (at); verses by number.
  const chapters = [], verses = new Map(); let ch = null, expect = 1;
  const open = (t, level, count, page) => { ch = { t: clean(t), l: level, at: expect, count: b.fix?.counts?.[plain(clean(t))] ?? count, page }; chapters.push(ch); };
  open(b.intro || items[start].head, 1, null, items[start].page);
  for (const x of items.slice(start + 1, end)) {
    if (x.head) { open(x.head, x.level, x.count, x.page); continue; }
    const l = x.line; if (!plain(l).trim()) continue; // empty, or a stray vowel sign on a line of its own
    let m = PLAIN_HEAD.exec(plain(l)); if (m) { open(l.replace(/\s*\([٠-٩]+\)\s*$/, ""), /^باب/.test(m[1]) ? 1 : 2, toNum(m[2]), x.page); continue; }
    // A heading's count printed on the line after it (after an honorific or an editor's gloss): «﵇ (١٠)», «(٦٧٦):»
    m = COUNT_LINE.exec(l); if (m && ch.at === expect) { if (ch.count == null) ch.count = toNum(m[1]); continue; }
    m = VERSE.exec(l); let halves = m && [m[2], m[3]];
    if (!m) {
      const r = BARE.exec(l); const at = r && b.fix?.split?.[toNum(r[1])]; const w = at ? r[2].split(/\s+/) : [];
      if (at && w.length > at) { m = r; halves = [w.slice(0, at).join(" "), w.slice(at).join(" ")]; }
    }
    if (!m) { if (!SKIP.some(re => re.test(plain(l)))) P(`page ${x.page}: unknown line «${l.slice(0, 80)}»`); continue; }
    let n = toNum(m[1]);
    if (verses.has(n) && b.fix?.dup?.[n]) n = b.fix.dup[n];
    if (verses.has(n)) { P(`verse ${n} twice (page ${x.page})`); continue; }
    if (n !== expect) P(`verse ${n} after ${expect - 1} (page ${x.page})`);
    if (/[[\]<>]|\d/.test(halves.join(" ")) || halves.some(h => !h)) P(`verse ${n}: footnote mark, markup or an empty half`);
    verses.set(n, halves); expect = n + 1;
  }
  if (verses.size !== b.count || expect - 1 !== b.count) P(`${verses.size} verses, ${b.count} expected`);
  // Where each chapter begins and ends. The verse numbers and the counts printed after the headings are reliable; the
  // place of a heading mark in the digitised text is not always (in the Tayyibah some sit a few verses off), so a counted
  // chapter runs from where the one before ended for as many verses as its count says, and an unnumbered heading sits
  // where the text puts it. A count may also cover the unnumbered sections that follow its heading (the Shatibiyyah's
  // «باب الإدغام الكبير» holds «باب إدغام الحرفين المتقاربين»): then those share the counted span, as the text cuts it.
  let cursor = 1, moved = 0; const covers = [];
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    // A counted heading over counted sub-headings («باب فرش الحروف (٦٧٦)» over the surahs): its count is their sum.
    let kids = i + 1; while (kids < chapters.length && chapters[kids].l > c.l) kids++;
    if (c.count != null && kids > i + 1 && chapters.slice(i + 1, kids).some(k => k.count != null)) {
      c.from = cursor; c.to = Math.max(cursor, chapters[i + 1].at) - 1; cursor = c.to + 1; covers.push([c, i + 1, kids]); continue;
    }
    if (c.count == null) { c.from = Math.max(cursor, c.at); const nx = chapters[i + 1]; c.to = (nx ? Math.max(c.from, nx.at) : expect) - 1; cursor = c.to + 1; continue; }
    c.from = cursor; const last = cursor + c.count - 1; let k = i + 1;
    while (k < chapters.length && chapters[k].count == null && chapters[k].at <= last) k++;
    for (let j = i; j < k; j++) { chapters[j].from = j === i ? cursor : Math.max(chapters[j - 1].from, chapters[j].at); chapters[j].to = j + 1 < k ? Math.max(chapters[j].from, chapters[j + 1].at) - 1 : last; }
    if (c.at !== c.from) moved++;
    cursor = last + 1; i = k - 1;
  }
  for (const [c, a, z] of covers) { const n = chapters[z - 1].to - chapters[a].from + 1; if (n !== c.count) P(`«${c.t}»: its sections hold ${n} verses, the edition says ${c.count}`); }
  const bad = chapters.find((c, i) => c.from !== (i ? chapters[i - 1].to + 1 : 1));
  if (bad) P(`«${bad.t}» starts at ${bad.from}, the chapter before ends at ${chapters[chapters.indexOf(bad) - 1].to}`);
  if (chapters.at(-1).to !== b.count) P(`the chapters end at ${chapters.at(-1).to}, the poem at ${b.count}: a printed count disagrees with the verses`);
  if (moved) console.log(`  ${b.id}: ${moved} heading marks moved to where the counts put them`);
  const out = chapters.filter(c => c.to >= c.from);
  // فرش الحروف: a chapter runs from its first surah to the surah before the next chapter's first (a heading names only
  // the first surah when the chapter holds two: «سورة إبراهيم» in the Shatibiyyah covers al-Hijr as well).
  const farsh = [];
  for (const c of out) {
    let s = null; try { s = surahsOf(c.t); } catch (e) { P(`«${c.t}»: ${e.message}`); }
    if (s && s.length && c.l >= 2) farsh.push([c, s]);
  }
  farsh.forEach(([c, named], i) => {
    const a = Math.min(...named), z = i + 1 < farsh.length ? Math.min(...farsh[i + 1][1]) - 1 : 114;
    if (i === 0 && a !== 2) P(`فرش الحروف starts at surah ${a}`);
    if (z < a || named.some(n => n < a || n > z)) P(`«${c.t}»: surahs ${named.join(",")} do not fit between ${a} and ${z}`);
    c.s = Array.from({ length: z - a + 1 }, (_, k) => a + k);
  });
  const v = Array.from({ length: b.count }, (_, i) => verses.get(i + 1) || ["", ""]);
  return { chapters: out.map(c => ({ t: c.t, l: c.l, from: c.from, to: c.to, ...(c.s ? { s: c.s } : {}) })), v, meta: info.meta };
}

(async () => {
  const problems = [], books = [];
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const b of BOOKS) {
    const r = await build(b, problems); if (!r) continue;
    const body = JSON.stringify({ id: b.id, turath: b.turath, v: r.v });
    const hash = crypto.createHash("sha256").update(body).digest("hex").slice(0, 10);
    const file = `${b.id}.${hash}.json`;
    for (const f of fs.readdirSync(OUT_DIR)) if (f.startsWith(b.id + ".") && f !== file) fs.unlinkSync(path.join(OUT_DIR, f));
    fs.writeFileSync(path.join(OUT_DIR, file), body);
    books.push({ id: b.id, subject: b.subject, title: b.title, author: b.author, died: b.died, ...(b.diedNote ? { diedNote: b.diedNote } : {}), edition: b.edition, turath: b.turath, url: `https://app.turath.io/book/${b.turath}`,
      count: b.count, file, bytes: Buffer.byteLength(body), chapters: r.chapters });
    console.log(`  ${b.id}: ${b.count} verses, ${r.chapters.length} chapters, ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB`);
  }
  if (problems.length) { console.error("✗ " + problems.join("\n✗ ")); process.exit(1); }
  const out = {
    note: "The matn library (#/mutun): the poems of Tajweed and the readings, verse by verse, from the numbered editions on turath.io. Built by scripts/build-mutun.js; the verses are in mutun/<id>.<hash>.json. Rebuild with: npm run mutun",
    built: new Date().toISOString().slice(0, 10),
    source: ["نص كل متن منقول حرفيًّا بأرقام أبياته من الطبعة المحققة المذكورة تحته، عن موقع turath.io.", "Each poem is copied word for word, with its verse numbers, from the critical edition named under it, via turath.io."],
    books,
  };
  fs.writeFileSync(INDEX, JSON.stringify(out));
  console.log(`✓ ${path.relative(ROOT, INDEX)}: ${books.length} books, ${books.reduce((a, b) => a + b.count, 0)} verses`);
})().catch(e => { console.error(e); process.exit(1); });
