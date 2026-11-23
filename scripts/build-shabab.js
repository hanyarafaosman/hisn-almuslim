// Builds www/data/shabab.json, the texts of «رسائل إلى الشباب» (#/shabab): messages to the youth on the creed of the
// saved, victorious group (who they are and how they are known), the foundations of belief, and the danger of takfir,
// of the way of the Khawarij, of extremism and of division. Nothing is written from memory; every text is copied word
// for word from its source:
//  - the verses from Quran.com's imlaei text (as scripts/build-guide.js);
//  - the hadith from the hadith books the app reads (fawazahmed0/hadith-api, the pinned commit of
//    scripts/build-hadith-index.js): each is found by its words, the part shown is cut from the book's own text by its
//    first and last words, and it opens in the hadith reader, where its chain, gradings and translations are. A hadith
//    of the Sunan is taken only when al-Albani graded it sahih or hasan (the source's grading, kept with it);
//  - the scholars' words from the books of the app's library (www/kutub, built by scripts/build-kutub.js from the
//    printed editions on turath.io): the creeds of the imams (al-ʿAqida al-Wasitiyya, at-Tahawiyya, Usul as-Sunnah)
//    and the treatises of the shelf «رسائل إلى الشباب». Each passage is cut by its first and last words and keeps
//    the reading page and paragraph it starts at, so it opens in its place in the book.
// The only changes to a text: the honorific ligatures (ﷺ ﵁ …) are written out in words as in data/hisn.json;
// footnote marks, an edition's paragraph numbers and direction marks are dropped; the quotation marks and full stops
// that the hadith source's editor put inside a hadith are dropped; and spaces are tidied. The names and short notes of
// the messages are interface strings (scripts/i18n-source.js).
// Usage: node scripts/build-shabab.js     (after npm run kutub)
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const WWW = path.join(ROOT, "www");
const KUTUB = path.join(WWW, "kutub");
const HCACHE = path.join(ROOT, ".cache", "hadith");
const QCACHE = path.join(ROOT, ".cache", "guide", "q");
const OUT = path.join(WWW, "data", "shabab.json");
const API_SHA = "df57907be35291c91ad6a6691180e22ca9920784"; // as in scripts/build-hadith-index.js
const HADITH = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@${API_SHA}`;
const QURAN = "https://api.quran.com/api/v4/quran/verses/imlaei";

// ---------- what is taken ----------
// A message: q = verses; h = hadith: [book of the hadith reader, the narrator (a key of BY: how he is shown, and a
// word of his name that the chain before the words must hold), first words, last words]; x = scholars' words: [book of
// the library, first words, last words]; r = the books of the library to read on it (first the treatises of the shelf,
// then the imams' creeds).
const BY = {
  ibnUmar: ["عن عبد الله بن عمر رضي الله عنهما", "ابن عمر"], ibnAmr: ["عن عبد الله بن عمرو رضي الله عنهما", "عبد الله بن عمرو"],
  abuHurayra: ["عن أبي هريرة رضي الله عنه", "أبي هريرة"], abuSaid: ["عن أبي سعيد الخدري رضي الله عنه", "أبي سعيد"],
  ali: ["عن علي بن أبي طالب رضي الله عنه", "علي"], ibnAbbas: ["عن عبد الله بن عباس رضي الله عنهما", "ابن عباس"],
  ibnMasud: ["عن عبد الله بن مسعود رضي الله عنه", "عبد الله"], anas: ["عن أنس بن مالك رضي الله عنه", "أنس"],
  aisha: ["عن عائشة رضي الله عنها", "عائشة"], jabir: ["عن جابر بن عبد الله رضي الله عنهما", "جابر"],
  umar: ["عن عمر بن الخطاب رضي الله عنه", "عمر بن الخطاب"], thawban: ["عن ثوبان رضي الله عنه", "ثوبان"],
  irbad: ["عن العرباض بن سارية رضي الله عنه", "العرباض"], abuDharr: ["عن أبي ذر رضي الله عنه", "أبي ذر"],
  thabit: ["عن ثابت بن الضحاك رضي الله عنه", "ثابت بن الضحاك"], usama: ["عن أسامة بن زيد رضي الله عنهما", "أسامة بن زيد"],
  hudhayfa: ["عن حذيفة بن اليمان رضي الله عنه", "حذيفة"], ubada: ["عن عبادة بن الصامت رضي الله عنه", "عبادة"],
  abuBakra: ["عن أبي بكرة رضي الله عنه", "أبي بكرة"], muawiya: ["عن معاوية رضي الله عنه", "معاوية"],
};
// The address to the youth that opens the page: the close of Shaykh al-ʿAbbad's letter.
const LEAD = ["afiqu-ya-shabab", "وأقول في الختام: اتقوا الله أيها الشباب", "ولا تكونوا مطية للشيطان للإفساد في الأرض"];
const THEMES = [
  {
    id: "najiya", icon: "star", q: ["6:153", "4:115", "9:100"],
    h: [
      ["tirmidhi", "ibnAmr", "وتفترق أمتي على ثلاث وسبعين ملة", "ما أنا عليه وأصحابي"],
      ["muslim", "thawban", "لا تزال طائفة من أمتي ظاهرين على الحق", "وهم كذلك"],
      ["abudawud", "irbad", "فإنه من يعش منكم بعدي", "وكل بدعة ضلالة"],
    ],
    x: [
      ["wasitiyya", "اعتقاد الفرقة الناجية المنصورة", "أهل السنة والجماعة"],
      ["wasitiyya", "لكن لما أخبر", "هم أهل السنة والجماعة"],
      ["minhaj-ahl-sunnah", "وبقي الناس في عهده على هذا المنهاج", "وأهل الجماعة المجتمعين عليها"],
      ["nur-sunnah", "أهل السنة والجماعة: هم من كان على مثل ما كان عليه", "في القول، والعمل، والاعتقاد"],
      ["usul-sunnah", "أصول السنة عندنا", "والاقتداء بهم"],
    ],
    r: ["minhaj-ahl-sunnah", "nur-sunnah", "bayan-aqida", "wasitiyya", "usul-sunnah"],
  },
  {
    id: "usul", icon: "book", q: ["2:285", "2:177", "4:136"],
    h: [["muslim", "umar", "أن تؤمن بالله وملائكته", "وتؤمن بالقدر خيره وشره"]],
    x: [
      ["aqidat-ahl-sunnah", "ولأهمية هذا الموضوع", "والقدر خيره وشره"],
      ["wasitiyya", "أن الدين والإيمان: قول، وعمل", "وينقص بالمعصية"],
    ],
    r: ["aqidat-ahl-sunnah", "aqida-sahiha", "usul-iman", "itisam", "tahawiyya", "lumah", "tawhid", "usul-thalatha"],
  },
  {
    id: "takfir", icon: "bell", q: ["4:94"],
    h: [
      ["muslim", "ibnUmar", "أيما امرئ قال لأخيه يا كافر", "وإلا رجعت عليه"],
      ["bukhari", "thabit", "ولعن المؤمن كقتله", "بكفر فهو كقتله"],
      ["muslim", "abuDharr", "ومن دعا رجلا بالكفر", "إلا حار عليه"],
      ["muslim", "usama", "أقال لا إله إلا الله وقتلته", "أقالها أم لا"],
    ],
    x: [
      ["bayan-takfir", "التكفير حكم شرعي، مرده إلى الله ورسوله", "فالتكفير أولى أن يدرأ بالشبهات"],
      ["bayan-takfir", "التسرع في التكفير يترتب عليه أمور خطيرة", "لأدنى شبهة"],
      ["wasitiyya", "وهم مع ذلك، لا يكفرون أهل القبلة", "ثابتة مع المعاصي"],
      ["tahawiyya", "ولا نكفر أحدا من أهل القبلة بذنب", "ما لم يستحله"],
    ],
    r: ["bayan-takfir", "fitnat-takfir", "qadiyyat-takfir"],
  },
  {
    id: "khawarij", icon: "close", q: ["3:7"],
    h: [
      ["bukhari", "ali", "يأتي في آخر الزمان قوم حدثاء الأسنان", "لا يجاوز إيمانهم حناجرهم"],
      ["bukhari", "abuSaid", "يخرج فيكم قوم تحقرون صلاتكم مع صلاتهم", "كما يمرق السهم من الرمية"],
      ["bukhari", "abuSaid", "يقتلون أهل الإسلام", "ويدعون أهل الأوثان"],
    ],
    x: [
      ["fitnat-takfir", "فإن مسألة التكفير عموما", "باسم الكتاب والسنة"],
      ["fitnat-takfir", "فهؤلاء - وأولئك - قد يكونون في دواخل أنفسهم", "سلف الأمة الصالحون"],
    ],
    r: ["munasaha-wahb", "fitnat-takfir", "afiqu-ya-shabab", "qadiyyat-takfir"],
  },
  {
    id: "dima", icon: "heart", q: ["4:93", "5:32"],
    h: [
      ["bukhari", "ibnUmar", "لن يزال المؤمن في فسحة من دينه", "ما لم يصب دما حراما"],
      ["bukhari", "ibnAmr", "من قتل معاهدا لم يرح رائحة الجنة", "أربعين عاما"],
      ["bukhari", "abuBakra", "فإن دماءكم وأموالكم وأعراضكم", "في بلدكم هذا"],
      ["bukhari", "ibnMasud", "أول ما يقضى بين الناس", "الدماء"],
    ],
    x: [
      ["bayan-takfir", "ما نجم عن هذا الاعتقاد الخاطئ", "محرمة شرعا بإجماع المسلمين"],
      ["bayan-takfir", "فإنه يعلن للعالم أن الإسلام بريء", "تأباه الشريعة والفطرة"],
    ],
    r: ["bayan-takfir", "afiqu-ya-shabab"],
  },
  {
    id: "jamaa", icon: "people", q: ["3:103", "4:59"],
    h: [
      ["bukhari", "hudhayfa", "تلزم جماعة المسلمين وإمامهم", "وأنت على ذلك"],
      ["bukhari", "ibnAbbas", "من رأى من أميره شيئا يكرهه", "ميتة جاهلية"],
      ["bukhari", "ubada", "بايعنا على السمع والطاعة", "عندكم من الله فيه برهان"],
      ["muslim", "ibnUmar", "على المرء المسلم السمع والطاعة", "فلا سمع ولا طاعة"],
    ],
    x: [
      ["tahawiyya", "ولا نرى الخروج على أئمتنا", "بالصلاح والمعافاة"],
      ["tahawiyya", "ونتبع السنة والجماعة", "والخلاف والفرقة"],
      ["bayan-takfir", "وإذا كان هذا في ولاة الأمور كان أشد", "وهذه القيود تدل على خطورة الأمر"],
    ],
    r: ["qadiyyat-takfir", "dhamm-furqa", "itisam", "tahawiyya"],
  },
  {
    id: "ghuluw", icon: "compass", q: ["2:143", "4:171"],
    h: [
      ["nasai", "ibnAbbas", "وإياكم والغلو في الدين", "من كان قبلكم الغلو في الدين"],
      ["muslim", "ibnMasud", "هلك المتنطعون", "هلك المتنطعون"],
      ["bukhari", "abuHurayra", "إن الدين يسر", "وشيء من الدلجة"],
      ["bukhari", "anas", "أما والله إني لأخشاكم لله", "فمن رغب عن سنتي فليس مني"],
    ],
    x: [
      ["afiqu-ya-shabab", "فإن للشيطان مدخلين على المسلمين", "ليفسد عليه دينه"],
      ["wasitiyya", "بل هم الوسط في فرق الأمة", "الوسط في الأمم"],
    ],
    r: ["afiqu-ya-shabab", "hathth-sunnah"],
  },
  {
    id: "ilm", icon: "school", q: ["16:43", "4:83", "17:36"],
    h: [
      ["bukhari", "ibnAmr", "إن الله لا يقبض العلم انتزاعا", "فضلوا وأضلوا"],
      ["bukhari", "muawiya", "من يرد الله به خيرا يفقهه في الدين", "يفقهه في الدين"],
    ],
    x: [
      ["afiqu-ya-shabab", "ومن مكائد الشيطان لهؤلاء المفرطين الغالين", "وليبقوا في غيهم وضلالهم"],
      ["afiqu-ya-shabab", "ففي هذه القصة أن ألفين من الخوارج رجعوا", "فيه السلامة من الشرور والفتن"],
    ],
    r: ["afiqu-ya-shabab", "munasaha-wahb", "fitnat-takfir"],
  },
  {
    id: "bida", icon: "layers", q: ["6:159", "3:105", "30:31-32"],
    h: [
      ["bukhari", "aisha", "من أحدث في أمرنا هذا", "فهو رد"],
      ["muslim", "jabir", "فإن خير الحديث كتاب الله", "وكل بدعة ضلالة"],
      ["abudawud", "abuHurayra", "افترقت اليهود على إحدى", "ثلاث وسبعين فرقة"],
    ],
    x: [
      ["usul-sunnah", "وترك البدع", "وترك الخصومات في الدين"],
      ["minhaj-ahl-sunnah", "ولا تكاد ترى طائفة سواهم", "من النحلة"],
      ["tahawiyya", "ونرى الجماعة", "زيغا وعذابا"],
    ],
    r: ["dhamm-furqa", "hathth-sunnah", "nur-sunnah", "itisam"],
  },
];
// The treatises of the shelf as the page lists them, by subject.
const SHELF = [
  ["creed", ["aqidat-ahl-sunnah", "minhaj-ahl-sunnah", "aqida-sahiha", "usul-iman", "itisam"]],
  ["takfir", ["bayan-takfir", "fitnat-takfir", "afiqu-ya-shabab", "munasaha-wahb", "qadiyyat-takfir"]],
  ["sunnah", ["dhamm-furqa", "hathth-sunnah", "nur-sunnah"]],
];

// ---------- tools ----------
const problems = [], table = [];
const bad = m => problems.push(m);
const cp = (...c) => String.fromCodePoint(...c);
const readJson = f => JSON.parse(fs.readFileSync(f, "utf8"));
async function cached(file, url) {
  if (!fs.existsSync(file)) {
    let last;
    for (let i = 0; i < 4; i++) {
      try { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); const t = await r.text(); JSON.parse(t); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, t); last = null; break; }
      catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
    }
    if (last) throw new Error(`${url}: ${last.message}`);
  }
  return readJson(file);
}
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
  // A quotation or a verse opened inside the part is closed with it.
  const part = text.slice(at[i], end);
  for (const [o, c] of [["«", "»"], ["﴿", "﴾"]]) if (text[end] === c && part.split(o).length > part.split(c).length) end++;
  return { t: text.slice(at[i], end), start: at[i], end };
}
// Honorific ligatures, written out as in data/hisn.json and data/mawasim.json (many fonts have no glyph for them).
const LIGATURES = [[0xFD40, "رحمه الله"], [0xFD41, "رضي الله عنه"], [0xFD42, "رضي الله عنها"], [0xFD43, "رضي الله عنهم"], [0xFD44, "رضي الله عنهما"],
  [0xFD47, "عليه السلام"], [0xFD4A, "عليه الصلاة والسلام"], [0xFDFA, "صلى الله عليه وسلم"], [0xFDFE, "سبحانه وتعالى"], [0xFDFF, "عز وجل"]];
const words = s => LIGATURES.reduce((a, [c, w]) => a.split(cp(c)).join(w), s);
const LIGATURE = new RegExp("[" + cp(0xFD40) + "-" + cp(0xFD4F) + cp(0xFDF0) + "-" + cp(0xFDFF) + "]");
const DIR = new RegExp("[" + cp(0x200E) + cp(0x200F) + cp(0x202A) + "-" + cp(0x202E) + "]", "g");
const tidy = s => s.replace(DIR, "").replace(/[ \t]+/g, " ").replace(/ ([،.؛:])/g, "$1").replace(/ ?\n ?/g, "\n").trim();

// ---------- verses (as scripts/build-guide.js) ----------
const SURAHS = readJson(path.join(WWW, "quran", "index.json")).riwayat.find(r => r.id === "hafs").surahs; // [name, verses, …]
const PAUSE = new RegExp("[" + cp(0x6D6) + "-" + cp(0x6DC) + cp(0x6DE) + cp(0x6E9) + cp(0x200F) + "]", "g");
async function verses(ref) {
  const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(ref), s = +m[1], from = +m[2], to = +(m[3] || m[2]);
  const count = SURAHS[s - 1]?.[1];
  if (!count || to > count || to < from) { bad(`verse ${ref}: no such verse`); return null; }
  const text = [];
  for (let a = from; a <= to; a++) {
    const j = await cached(path.join(QCACHE, `${s}-${a}.json`), `${QURAN}?verse_key=${s}:${a}`);
    const v = (j.verses || [])[0];
    if (!v || v.verse_key !== `${s}:${a}` || !v.text_imlaei) { bad(`verse ${s}:${a}: not in the answer`); return null; }
    text.push(v.text_imlaei.replace(PAUSE, "").replace(/\s+/g, " ").trim());
  }
  return { s, from, to, text };
}

// ---------- the hadith reader's books ----------
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
const hbooks = {};
const SAHIH = ["bukhari", "muslim"];
// The first hadith of the book holding the narrator's name and then the first and the last words; the part shown,
// the hadith's place in the reader, and for a book of the Sunan al-Albani's grading of it.
async function hadith([book, who, from, to], where) {
  const b = HBOOKS.find(x => x.id === book); if (!b) { bad(`${where}: no hadith book ${book}`); return null; }
  const [by, name] = BY[who] || []; if (!by) { bad(`${where}: no narrator ${who}`); return null; }
  const a = plain(from), z = plain(to), n = plain(name);
  const hits = (await edition(book)).filter(h => { const i = h.plain.indexOf(a); return i >= 0 && h.plain.indexOf(z, i) >= 0 && h.plain.slice(0, i).includes(n); });
  if (!hits.length) { bad(`${where}: «${from} … ${to}» (${name}) is not in ${book}`); return null; }
  const h = hits[0], x = excerpt(tidy(h.text), from, to, where); if (!x) return null;
  const sec = b.sections.find(s => s[0] === h.reference?.book) || b.sections.find(s => s[6]?.includes(h.hadithnumber));
  if (!sec) { bad(`${where}: ${book} ${h.hadithnumber} has no section`); return null; }
  let g = "";
  if (!SAHIH.includes(book)) {
    const grade = (h.grades || []).find(k => k.name.trim() === "Al-Albani")?.grade.trim() || "";
    g = /^sahih/i.test(grade) ? "sahih" : /^hasan/i.test(grade) ? "hasan" : "";
    if (!g || /da'?if|munkar|maudu/i.test(grade)) { bad(`${where}: ${book} ${h.hadithnumber} is graded «${grade}» by al-Albani`); return null; }
  }
  hbooks[book] = [b.ar, b.en];
  table.push(`  ${where}: ${book} ${h.hadithnumber}${g ? " (" + g + ")" : ""}, ${hits.length} with these words`);
  return { t: x.t.replace(/[".]/g, " ").replace(/ ،/g, "،").replace(/\s+/g, " ").trim(), by, ref: [book, h.hadithnumber, sec[0]], ...(g ? { g } : {}) };
}

// ---------- the library's books ----------
const INDEX = readJson(path.join(KUTUB, "index.json"));
const REF = new RegExp(" ?" + cp(0x27E6) + "\\d+" + cp(0x27E7), "g"); // ⟦n⟧: a footnote mark
const ITEM = /^[•\-\s]*[٠-٩]+\s*-\s*/; // an edition's number before a paragraph («٢٤١- »)
const texts = {};
function bookText(id) {
  if (texts[id]) return texts[id];
  const b = INDEX.books.find(x => x.id === id); if (!b) return null;
  const head = readJson(path.join(KUTUB, b.file)), parts = b.chunks.map((h, k) => readJson(path.join(KUTUB, id, `${k}.${h}.json`)));
  const paras = [];
  head.sections.forEach((s, si) => { const x = s.c != null && parts[s.c][si]; if (!x) return; (x.body || []).forEach((e, pi) => { if (e.p != null) paras.push({ s: si, p: pi, t: e.p.replace(REF, "").replace(ITEM, ""), pg: s.pg }); }); });
  return (texts[id] = { b, paras });
}
// A passage of a book: from the paragraph holding the first words to the last words, in it or in the paragraphs after
// it on the same reading page (at most five).
function passage([id, from, to], where) {
  const book = bookText(id); if (!book) { bad(`${where}: no book ${id} in the library`); return null; }
  const a = plain(from), starts = book.paras.map((x, i) => i).filter(i => plain(book.paras[i].t).includes(a));
  if (starts.length !== 1) { bad(`${where}: «${from}» is in ${starts.length} paragraphs of ${id}`); return null; }
  const i = starts[0], first = book.paras[i]; let joined = first.t;
  for (let k = i; k < i + 6; k++) {
    if (k > i) { const n = book.paras[k]; if (!n || n.s !== first.s) break; joined += "\n" + n.t; }
    const L = letters(joined), s = L.out.indexOf(a);
    if (L.out.indexOf(plain(to), s) >= 0) { const x = excerpt(joined, from, to, where); if (x && LIGATURE.test(words(x.t))) bad(`${where}: a ligature with no words for it`); return x && { t: tidy(words(x.t)), k: id, s: first.s, p: first.p }; }
  }
  bad(`${where}: «${to}» does not follow «${from}» in ${id}`); return null;
}

async function main() {
  const out = { source: "scripts/build-shabab.js", lead: passage(LEAD, "lead"), themes: [], shelf: SHELF, verses: {}, hbooks, books: {} };
  const book = id => { const b = INDEX.books.find(x => x.id === id); if (!b) { bad(`no book ${id} in the library`); return; } out.books[id] = [b.ar, b.en, b.by, b.byEn]; };
  if (out.lead) book(out.lead.k);
  for (const th of THEMES) {
    const h = [], x = [];
    for (const ref of th.q) { const v = await verses(ref); if (v) out.verses[ref] = v; }
    for (const [i, cfg] of th.h.entries()) { const r = await hadith(cfg, `${th.id} h${i + 1}`); if (r) h.push(r); }
    for (const [i, cfg] of th.x.entries()) { const r = passage(cfg, `${th.id} x${i + 1}`); if (r) { x.push(r); book(r.k); } }
    th.r.forEach(book);
    out.themes.push({ id: th.id, icon: th.icon, q: th.q, h, x, r: th.r });
  }
  for (const [, list] of SHELF) list.forEach(book);
  const shelved = new Set(SHELF.flatMap(([, list]) => list));
  for (const b of INDEX.books) if (b.group === "shabab" && !shelved.has(b.id)) bad(`${b.id} is on the library's shelf but not in SHELF`);
  for (const id of shelved) if (INDEX.books.find(b => b.id === id)?.group !== "shabab") bad(`${id} is in SHELF but not on the library's shelf`);
  if (problems.length) { console.error(problems.map(p => "✗ " + p).join("\n")); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`✓ ${out.themes.length} messages: ${Object.keys(out.verses).length} verse references, ${out.themes.reduce((a, t) => a + t.h.length, 0)} hadith, ${out.themes.reduce((a, t) => a + t.x.length, 0) + 1} passages of ${Object.keys(out.books).length} books`);
  console.log(table.join("\n"));
  if (process.argv.includes("--show")) {
    console.log(`\n[lead] ${out.lead.t}`);
    for (const t of out.themes) { for (const h of t.h) console.log(`\n[${t.id}] ${h.ref[0]} ${h.ref[1]} — ${h.by}\n«${h.t}»`); for (const x of t.x) console.log(`\n[${t.id}] ${x.k}/${x.s}?p=${x.p}\n${x.t}`); }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
