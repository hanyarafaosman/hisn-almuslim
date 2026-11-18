// Builds www/data/mawasim.json, the texts of «بشريات مواسم الخير» (#/mawasim): the seasons of worship of the Hijri
// year and the virtuous days, with the page of Ramadan (asking Allah to reach it, and its virtue). Nothing is written
// from memory; every text is copied word for word from its source:
//  - «لطائف المعارف» by Ibn Rajab (turath.io book 1152, the edition of Yasin al-Sawwas): what he wrote on the glad
//    tidings of Ramadan's coming, on asking to reach it (with his judgement on the chain of the well-known narration
//    «اللهم بارك لنا في رجب وشعبان وبلغنا رمضان»), and on reaching Ramadan being a great favour;
//  - «رياض الصالحين» by al-Nawawi (turath.io book 2348, the edition of Mahir al-Fahl): the hadith on the virtue of
//    Ramadan and of each other season and day (Shaʿban, the six days of Shawwal, the ten days of Dhul-Hijjah, ʿArafah,
//    ʿAshura, the white days, Monday and Thursday, Friday), each with its narrator and al-Nawawi's own «متفق عليه / رواه …»;
//  - the verses from Quran.com's imlaei text (as scripts/build-guide.js);
//  - each hadith is also found by its words in the hadith books the app reads (fawazahmed0/hadith-api, the pinned
//    commit of scripts/build-hadith-index.js), so that it opens in the hadith reader, where its translations are.
// The only changes to the text: footnote marks and page-break marks are dropped, the honorific ligatures (ﷺ ﵁ …) are
// written out in words as in data/hisn.json, and straight quotation marks become «».
// When each season comes is not here: js/mawasim.js computes it from the Hijri calendar, so nothing needs editing as
// the years pass.
// Usage: node scripts/build-mawasim.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const WWW = path.join(ROOT, "www");
const CACHE = path.join(ROOT, ".cache", "mawasim");
const HCACHE = path.join(ROOT, ".cache", "hadith");
const QCACHE = path.join(ROOT, ".cache", "guide", "q");
const OUT = path.join(WWW, "data", "mawasim.json");
const API = "https://api.turath.io";
const API_SHA = "df57907be35291c91ad6a6691180e22ca9920784"; // as in scripts/build-hadith-index.js
const HADITH = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@${API_SHA}`;
const QURAN = "https://api.quran.com/api/v4/quran/verses/imlaei";
const LATAIF = 1152, RIYAD = 2348;

// ---------- what is taken ----------
// From «لطائف المعارف»: pg = the turath page ids the passage runs over, from/to = its first and last words.
const QUOTES = {
  // The glad tidings of Ramadan's coming (printed page 279).
  bushra: { pg: [272], from: "وكان النبي - صلى الله عليه وسلم - يبشر أصحابه بقدوم رمضان", to: "بعضهم بعضا بشهر رمضان.", find: ["nasai", "أتاكم رمضان شهر مبارك"] },
  // The early Muslims asking to reach Ramadan, and the supplication itself (page 280).
  salaf: { pg: [273], from: "وقال معلى بن الفضل", to: "كان من دعائهم:" },
  dua: { pg: [273], from: "اللهم سلمني إلى رمضان", to: "وتسلمه مني متقبلا" },
  // The well-known narration, Ibn Rajab's judgement on its chain and what he takes from it (pages 233–234).
  weak: { pg: [226, 227], from: "وروى زائدة بن أبي الرقاد", to: "وخير الناس من طال عمره وحسن عمله." },
  weakDua: { pg: [226, 227], from: "اللهم بارك لنا في رجب", to: "وبلغنا رمضان" },
  // Reaching Ramadan is a great favour (page 280).
  nima: { pg: [273], from: "بلوغ شهر رمضان وصيامه نعمة عظيمة", to: "ومن لم يتزود فيه لمعاده فهو ملوم." },
};
// From «رياض الصالحين»: n = the hadith's number in the book, pg = its turath page id, from/to = the first and last
// words of what is shown, find = the book of the app's hadith reader and the words it is found by there.
const VIRTUES = [
  { id: "gates", n: 1220, pg: 1355, from: "إذا جاء رمضان", to: "وصفدت الشياطين", find: ["muslim", "إذا جاء رمضان فتحت أبواب الجنة وغلقت أبواب النار وصفدت الشياطين"] },
  { id: "fast", n: 1219, pg: 1354, from: "من صام رمضان", to: "ما تقدم من ذنبه", find: ["bukhari", "من صام رمضان إيمانا واحتسابا غفر له ما تقدم من ذنبه"] },
  { id: "qiyam", n: 1187, pg: 1317, from: "من قام رمضان", to: "ما تقدم من ذنبه", find: ["bukhari", "من قام رمضان إيمانا واحتسابا غفر له ما تقدم من ذنبه"] },
  { id: "qadr", n: 1189, pg: 1320, from: "من قام ليلة القدر", to: "ما تقدم من ذنبه", find: ["bukhari", "من قام ليلة القدر إيمانا واحتسابا غفر له ما تقدم من ذنبه"] },
  { id: "reward", n: 1215, pg: 1350, from: "قال الله - عز وجل: كل عمل ابن آدم له إلا الصيام", to: "وإذا لقي ربه فرح بصومه", find: ["bukhari", "كل عمل ابن آدم له إلا الصيام فإنه لي وأنا أجزي به"] },
  { id: "rayyan", n: 1217, pg: 1352, from: "إن في الجنة بابا يقال له: الريان", to: "فلم يدخل منه أحد", find: ["bukhari", "إن في الجنة بابا يقال له الريان"] },
  { id: "kaffara", n: 1149, pg: 1278, from: "الصلوات الخمس", to: "إذا اجتنبت الكبائر", find: ["muslim", "ورمضان إلى رمضان مكفرات ما بينهن"] },
  { id: "jood", n: 1222, pg: 1357, from: "كان رسول الله - صلى الله عليه وسلم - أجود الناس", to: "أجود بالخير من الريح المرسلة", find: ["bukhari", "أجود الناس وكان أجود ما يكون في رمضان"] },
  { id: "lastTen", n: 1193, pg: 1324, from: "كان رسول الله - صلى الله عليه وسلم - إذا دخل العشر الأواخر", to: "وجد وشد المئزر", find: ["muslim", "أحيا الليل وأيقظ أهله وجد وشد المئزر"] },
  { id: "umrah", n: 1278, pg: 1415, from: "عمرة في رمضان", to: "أو حجة معي", find: ["bukhari", "عمرة في رمضان"] },
];
// The supplication of Laylat al-Qadr, from the same book.
const QADR_DUA = { id: "qadrDua", n: 1195, pg: 1326, from: "اللهم إنك عفو", to: "فاعف عني", find: ["tirmidhi", "تحب العفو فاعف عني"] };
// The other seasons and virtuous days (their ids are those of js/mawasim.js): h = their hadith of «رياض الصالحين»,
// taken as above; q = the verses about them; d = adhkar of Hisn al-Muslim shown with them and c = chapters of it they
// lead to (numbers in data/hisn.json). Ramadan's own: the verses of fasting and of Laylat al-Qadr, the supplication
// on sighting the crescent, and the chapters of the fasting person's adhkar.
const SEASONS = {
  ramadan: { q: ["2:183", "2:185", "97:1-5"], d: [175], c: [68, 74, 75] },
  shaban: { h: [
    { n: 1247, pg: 1382, from: "لم يكن النبي - صلى الله عليه وسلم - يصوم من شهر أكثر من شعبان", to: "كان يصوم شعبان كله", find: ["bukhari", "يصوم شعبان كله"] }] },
  fitr: { q: ["2:185"] },
  sixShawwal: { h: [
    { n: 1254, pg: 1389, from: "من صام رمضان ثم أتبعه", to: "كان كصيام الدهر", find: ["muslim", "ثم أتبعه ستا من شوال"] }] },
  tenDhulHijjah: { q: ["89:1-2"], h: [
    { n: 1249, pg: 1384, from: "ما من أيام، العمل الصالح فيها", to: "فلم يرجع من ذلك بشيء", find: ["bukhari", "خرج يخاطر بنفسه وماله"] }] },
  arafah: { d: [237], h: [
    { n: 1250, pg: 1385, from: "سئل رسول الله - صلى الله عليه وسلم - عن صوم يوم عرفة", to: "يكفر السنة الماضية والباقية", find: ["muslim", "يكفر السنة الماضية والباقية"] }] },
  adha: { q: ["108:1-3"], c: [127] },
  tashriq: { q: ["2:203"] },
  ashura: { h: [
    { n: 1252, pg: 1387, from: "سئل عن صيام يوم عاشوراء", to: "يكفر السنة الماضية", find: ["muslim", "عاشوراء فقال يكفر السنة الماضية"] },
    { n: 1251, pg: 1386, from: "أن رسول الله - صلى الله عليه وسلم - صام يوم عاشوراء", to: "وأمر بصيامه", find: ["bukhari", "فصامه وأمر بصيامه"] },
    { n: 1253, pg: 1388, from: "لئن بقيت إلى قابل", to: "لأصومن التاسع", find: ["muslim", "لئن بقيت إلى قابل لأصومن التاسع"] },
    { n: 1246, pg: 1381, from: "أفضل الصيام بعد رمضان", to: "صلاة الليل", find: ["muslim", "أفضل الصيام بعد رمضان شهر الله المحرم"] }] },
  white: { h: [
    { n: 1260, pg: 1396, from: "صوم ثلاثة أيام من كل شهر", to: "صوم الدهر كله", find: ["bukhari", "صوم ثلاثة أيام صوم الدهر كله"] },
    { n: 1262, pg: 1398, from: "إذا صمت من الشهر ثلاثا", to: "وخمس عشرة", find: ["tirmidhi", "فصم ثلاث عشرة وأربع عشرة وخمس عشرة"] },
    { n: 1258, pg: 1394, from: "أوصاني خليلي - صلى الله عليه وسلم - بثلاث", to: "وأن أوتر قبل أن أنام", find: ["bukhari", "أوصاني خليلي"] }] },
  monThu: { h: [
    { n: 1256, pg: 1391, from: "تعرض الأعمال يوم الإثنين والخميس", to: "وأنا صائم", find: ["tirmidhi", "تعرض الأعمال يوم الاثنين والخميس"] },
    { n: 1257, pg: 1392, from: "كان رسول الله - صلى الله عليه وسلم - يتحرى", to: "صوم الإثنين والخميس", find: ["tirmidhi", "يتحرى صوم الاثنين والخميس"] },
    { n: 1255, pg: 1390, from: "سئل عن صوم يوم الإثنين", to: "أو أنزل علي فيه", find: ["muslim", "ذاك يوم ولدت فيه"] }] },
  friday: { q: ["62:9-10"], h: [
    { n: 1147, pg: 1276, from: "خير يوم طلعت عليه الشمس", to: "وفيه أخرج منها", find: ["muslim", "خير يوم طلعت عليه الشمس يوم الجمعة"] },
    { n: 1156, pg: 1285, from: "فيها ساعة لا يوافقها عبد مسلم", to: "إلا أعطاه إياه", find: ["bukhari", "ساعة لا يوافقها عبد مسلم"] },
    { n: 1158, pg: 1287, from: "إن من أفضل أيامكم يوم الجمعة", to: "فإن صلاتكم معروضة علي", find: ["abudawud", "إن من أفضل أيامكم يوم الجمعة"] },
    { n: 1148, pg: 1277, from: "من توضأ فأحسن الوضوء ثم أتى الجمعة", to: "فقد لغا", find: ["muslim", "من توضأ فأحسن الوضوء ثم أتى الجمعة"] }] },
};

// ---------- tools ----------
const problems = [];
const bad = m => problems.push(m);
const cp = (...c) => String.fromCodePoint(...c);
const readJson = f => JSON.parse(fs.readFileSync(f, "utf8"));
const arDigits = s => Number(String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const toAr = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
async function fetchText(url) {
  let last;
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.text(); }
    catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
  }
  throw new Error(`${url}: ${last.message}`);
}
async function cached(file, url) {
  if (!fs.existsSync(file)) { const t = await fetchText(url); JSON.parse(t); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, t); }
  return readJson(file);
}
// Honorific ligatures, written out as in data/hisn.json (many fonts have no glyph for them).
const LIGATURES = [[0xFD40, "رحمه الله"], [0xFD41, "رضي الله عنه"], [0xFD42, "رضي الله عنها"], [0xFD43, "رضي الله عنهم"],
  [0xFD44, "رضي الله عنهما"], [0xFD47, "عليه السلام"], [0xFDFA, "صلى الله عليه وسلم"], [0xFDFE, "سبحانه وتعالى"], [0xFDFF, "عز وجل"]];
const words = s => LIGATURES.reduce((a, [c, w]) => a.split(cp(c)).join(w), s);
const MARK = new RegExp("[" + cp(0x610) + "-" + cp(0x61A) + cp(0x64B) + "-" + cp(0x65F) + cp(0x670) + cp(0x6D6) + "-" + cp(0x6ED) + cp(0x640) + "]");
const LETTER = /[ء-ي]/;
// The bare letters of a text (no marks, one form of alif, anything else a space), and where each stands in the text.
function letters(s) {
  let out = ""; const at = [];
  for (let i = 0; i < s.length; i++) {
    let c = s[i];
    if (MARK.test(c)) continue;
    if ("ٱإأآ".includes(c)) c = "ا"; else if (c === "ى") c = "ي";
    if (!LETTER.test(c)) { if (out && !out.endsWith(" ")) { out += " "; at.push(i); } continue; }
    out += c; at.push(i);
  }
  return { out, at };
}
const plain = s => letters(s).out.trim();
// The part of a text from its first «from» words to the «to» words after them, exactly as the text has it.
function excerpt(text, from, to, where) {
  const { out, at } = letters(text), a = plain(from), b = plain(to);
  const i = out.indexOf(a); if (i < 0) { bad(`${where}: «${from}» is not in the text`); return null; }
  const j = out.indexOf(b, i); if (j < 0) { bad(`${where}: «${to}» is not in the text after «${from}»`); return null; }
  let end = at[j + b.length - 1] + 1;
  while (end < text.length && MARK.test(text[end])) end++;
  // A full stop or a closing mark written in «to» is kept when the text has it there.
  const tail = /[.؟!:]$/.exec(to.trim()); if (tail && text[end] === tail[0]) end++;
  // A quotation opened inside the part is closed with it.
  const part = text.slice(at[i], end); if (text[end] === "»" && part.split("«").length > part.split("»").length) end++;
  return { t: text.slice(at[i], end), start: at[i], end };
}
// A turath page: its text above the footnotes, without footnote marks and page-break marks.
const NOTE_MARK = new RegExp("\\s*\\(\\^?[٠-٩]{1,2}\\)", "g"), BREAK = new RegExp("\\s*" + cp(0x2997) + "[٠-٩]+" + cp(0x2998) + "\\s*", "g");
async function page(book, pg) {
  const p = await cached(path.join(CACHE, `${book}-${pg}.json`), `${API}/page?book_id=${book}&pg=${pg}&ver=3`);
  const meta = JSON.parse(p.meta);
  const body = p.text.split(/^_{5,}$/m)[0].replace(/<span[^>]*>[^<]*<\/span>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  if (/[<>]|&[a-z]+;/.test(body)) bad(`book ${book} page ${pg}: markup left in the text`);
  return { printed: meta.page, raw: body, text: body.replace(NOTE_MARK, "").replace(BREAK, " ") };
}
const tidy = s => words(s).replace(/"([^"]*)"/g, "«$1»").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
async function bookInfo(id) {
  const j = await cached(path.join(CACHE, `book-${id}.json`), `${API}/book?id=${id}&ver=3`);
  const line = k => (new RegExp("^" + k + ":\\s*(.+)$", "m").exec(j.meta.info) || [])[1]?.trim() || "";
  return { turath: id, t: line("الكتاب") || j.meta.name, by: line("المؤلف"), editor: line("المحقق") || line("تعليق وتحقيق") || line("تحقيق"), publisher: line("الناشر"), edition: line("الطبعة") };
}

// ---------- verses (as scripts/build-guide.js) ----------
const AYAT = { 2: 286, 62: 11, 89: 30, 97: 5, 108: 3 };
const PAUSE = new RegExp("[" + cp(0x6D6) + "-" + cp(0x6DC) + cp(0x6DE) + cp(0x6E9) + cp(0x200F) + "]", "g");
async function verses(ref) {
  const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(ref), s = +m[1], from = +m[2], to = +(m[3] || m[2]);
  if (!AYAT[s] || to > AYAT[s] || to < from) { bad(`verse ${ref}: no such verse`); return null; }
  const text = [];
  for (let a = from; a <= to; a++) {
    const j = await cached(path.join(QCACHE, `${s}-${a}.json`), `${QURAN}?verse_key=${s}:${a}`);
    const v = (j.verses || [])[0];
    if (!v || v.verse_key !== `${s}:${a}` || !v.text_imlaei) { bad(`verse ${s}:${a}: not in the answer`); return null; }
    text.push(v.text_imlaei.replace(PAUSE, "").replace(/\s+/g, " ").trim());
  }
  return { s, from, to, text };
}

// ---------- the hadith reader's books (as scripts/build-guide.js) ----------
const HBOOKS = readJson(path.join(WWW, "hadith", "index.json")).books;
const editions = {};
async function edition(book) {
  if (!editions[book]) {
    const file = path.join(HCACHE, `ara-${book}.json`);
    if (!fs.existsSync(file)) {
      process.stdout.write(`  ↓ ara-${book}\n`);
      const r = await fetch(`${HADITH}/editions/ara-${book}.min.json`); if (!r.ok) throw new Error(`ara-${book}: HTTP ${r.status}`);
      fs.mkdirSync(HCACHE, { recursive: true }); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    }
    editions[book] = readJson(file).hadiths.map(h => ({ ...h, plain: plain(h.text) }));
  }
  return editions[book];
}
const hbooks = {}, table = [];
// The first hadith of the book holding the words, and the section the app's reader shows it in.
async function find([book, text], where) {
  const b = HBOOKS.find(x => x.id === book); if (!b) { bad(`${where}: no hadith book ${book}`); return null; }
  const hits = (await edition(book)).filter(h => h.plain.includes(plain(text)));
  if (!hits.length) { bad(`${where}: «${text}» is not in ${book}`); return null; }
  const h = hits[0], sec = b.sections.find(s => s[0] === h.reference?.book) || b.sections.find(s => s[6]?.includes(h.hadithnumber));
  if (!sec) { bad(`${where}: ${book} ${h.hadithnumber} has no section`); return null; }
  hbooks[book] = [b.ar, b.en]; table.push(`  ${where}: ${book} ${h.hadithnumber} (${hits.length} with these words)`);
  return [book, h.hadithnumber, sec[0]];
}

// ---------- «رياض الصالحين»: one hadith ----------
const HONOR = [cp(0xFD41), cp(0xFD42), cp(0xFD43), cp(0xFD44)];
// The hadith a page starts: its number and its text (a page of this edition holds one hadith, after a chapter heading if any).
async function hadithOf(pg) {
  const p = await page(RIYAD, pg);
  const pick = s => { const lines = s.split("\n"), i = lines.findIndex(l => /^[٠-٩]+ - (?!باب)/.test(l.trim())); return i < 0 ? null : lines.slice(i).join("\n").trim(); };
  const body = pick(p.text), raw = pick(p.raw); if (!body) return null;
  return { n: arDigits(/^[٠-٩]+/.exec(body)[0]), body, lead: raw.replace(/^[٠-٩]+ - /, ""), printed: p.printed };
}
// Who narrated it: named at the head of the hadith, or of the one before when it opens with «وعنه / وعنها».
async function narrator(pg, where) {
  let honor = null;
  for (let k = pg; k > pg - 15; k--) {
    const h = await hadithOf(k); if (!h) continue;
    const head = h.lead.slice(0, 60); honor ??= HONOR.find(x => head.includes(x)) || null;
    if (new RegExp("^و?عن(ه|ها|هما|هم)(?![ء-ي])").test(head.replace(new RegExp(MARK.source, "g"), ""))) continue;
    const m = new RegExp("^و?ع[" + cp(0x64E) + "]?ن[" + cp(0x652) + "]? ([^:،" + HONOR.join("") + "]+?)(?: -|[:،" + HONOR.join("") + "])").exec(head);
    if (!m) { bad(`${where}: no narrator at the head of hadith ${h.n}`); return null; }
    return `عن ${m[1].trim()}${honor ? " " + words(honor) : ""}`;
  }
  bad(`${where}: no narrator found`); return null;
}
async function virtue(v) {
  const where = `riyad ${v.n}`, h = await hadithOf(v.pg);
  if (!h || h.n !== v.n) { bad(`${where}: page ${v.pg} holds hadith ${h?.n}`); return null; }
  const body = words(h.body), x = excerpt(body, v.from, v.to, where); if (!x) return null;
  // What al-Nawawi says of it after its text, from «متفق عليه» or «رواه …» to the end of that line.
  const quoted = body[x.start - 1] === "«" && body[x.end] === "»";
  const rest = body.slice(x.end), L = letters(rest), k = L.out.search(/(^| )(متفق|رواه) /);
  const src = k < 0 ? "" : rest.slice(L.at[k + (L.out[k] === " " ? 1 : 0)]).split("\n")[0].replace(/\s+/g, " ").trim();
  if (!/^(متفق|رواه)/.test(plain(src))) bad(`${where}: no source after the text`);
  const by = await narrator(v.pg, where), ref = await find(v.find, where);
  table.push(`    ${by} | ${src}`);
  return { ...(v.id ? { id: v.id } : {}), n: v.n, p: h.printed, t: tidy(x.t), q: quoted, by, src: tidy(src), h: ref };
}

async function main() {
  const out = { source: "scripts/build-mawasim.js", books: { lataif: await bookInfo(LATAIF), riyad: await bookInfo(RIYAD) }, quotes: {}, virtues: [], verses: {}, seasons: {} };
  for (const [id, q] of Object.entries(QUOTES)) {
    const pages = []; for (const pg of q.pg) pages.push(await page(LATAIF, pg));
    const x = excerpt(tidy(pages.map(p => p.text.trim()).join(" ")), q.from, q.to, `lataif ${id}`); if (!x) continue;
    out.quotes[id] = { t: x.t.replace(/\n/g, " "), p: [...new Set(pages.map(p => p.printed))] };
    if (q.find) out.quotes[id].h = await find(q.find, `lataif ${id}`);
  }
  for (const v of VIRTUES) { const x = await virtue(v); if (x) out.virtues.push(x); }
  out.qadrDua = await virtue(QADR_DUA);
  // The adhkar a season shows or leads to must be in the book's data.
  const hisn = readJson(path.join(WWW, "data", "hisn.json"));
  for (const [id, s] of Object.entries(SEASONS)) {
    const h = []; for (const v of s.h || []) { const x = await virtue(v); if (x) h.push(x); }
    for (const ref of s.q || []) { const v = await verses(ref); if (v) out.verses[ref] = v; }
    for (const d of s.d || []) if (!hisn.categories.some(c => c.items.some(i => i.id === d))) bad(`${id}: no dhikr ${d} in data/hisn.json`);
    for (const c of s.c || []) if (!hisn.categories.some(x => x.id === c)) bad(`${id}: no chapter ${c} in data/hisn.json`);
    out.seasons[id] = Object.fromEntries(Object.entries({ h, q: s.q, d: s.d, c: s.c }).filter(([, v]) => v?.length));
  }
  out.hbooks = hbooks;
  if (problems.length) { console.error(problems.map(p => "✗ " + p).join("\n")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out));
  const others = Object.values(out.seasons).flatMap(x => x.h || []);
  console.log(`✓ ${Object.keys(out.quotes).length} passages of «${out.books.lataif.t}», ${out.virtues.length + 1 + others.length} hadith of «${out.books.riyad.t}» (${others.length} of the other seasons), ${Object.keys(out.verses).length} verse references, ${Object.keys(out.seasons).length} seasons`);
  console.log(table.join("\n"));
  for (const [id, q] of Object.entries(out.quotes)) console.log(`\n[${id}] p. ${q.p.join("–")}\n${q.t}`);
  for (const v of [...out.virtues, out.qadrDua]) console.log(`\n[${v.id}] ${toAr(v.n)} — ${v.by}\n${v.q ? "«" + v.t + "»" : v.t}\n${v.src}`);
  for (const [id, x] of Object.entries(out.seasons)) for (const v of x.h || []) console.log(`\n[${id}] ${toAr(v.n)} — ${v.by}\n${v.q ? "«" + v.t + "»" : v.t}\n${v.src}`);
}
main().catch(e => { console.error(e); process.exit(1); });
