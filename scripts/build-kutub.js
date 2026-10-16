// Builds www/kutub/: books of creed (the ʿaqida of Ahl as-Sunnah wal-Jamaʿah) and the relied-upon primer (matn)
// of each of the four schools of fiqh.
// Text: turath.io. The whole book comes from files.turath.io/books-v3/<id>.json and its headings from
// api.turath.io/book; both follow the printed edition page by page. The text is copied word for word:
// the script only splits each book at its own headings, joins a sentence that runs over a page break,
// and ties every footnote to the place that refers to it.
// Each book is written as kutub/<id>.<hash>.json, so a corrected book gets a new name and devices never keep an old copy.
// Usage: node scripts/build-kutub.js
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "kutub");
const OUT = path.join(ROOT, "www", "kutub");
const API = "https://api.turath.io", FILES = "https://files.turath.io";

// unit: the heading level that starts a reading page (deeper headings are shown inside it); 0 makes a short book one page.
// from: first page of the book's own text (earlier pages are a catalogue card or a publisher's preface).
// items: the book has no chapters, only numbered paragraphs (one page; the contents lists each paragraph).
const BOOKS = [
  {
    id: "usul-sunnah", turath: 6418, group: "aqida", died: 241, unit: 0,
    ar: "أصول السنة", en: "Usul as-Sunnah", by: "الإمام أحمد بن حنبل", byEn: "Imam Ahmad ibn Hanbal",
    about: "رسالة موجزة في أصول اعتقاد أهل السنة، رواها عبدوس بن مالك العطار عن الإمام أحمد.",
    aboutEn: "A short epistle on the foundations of the creed of Ahl as-Sunnah, narrated from Imam Ahmad by ʿAbdus ibn Malik al-ʿAttar.",
  },
  {
    id: "tahawiyya", turath: 9568, group: "aqida", died: 321, items: true,
    ar: "العقيدة الطحاوية", en: "Al-ʿAqida at-Tahawiyya", by: "أبو جعفر الطحاوي", byEn: "Abu Jaʿfar at-Tahawi",
    about: "بيان عقيدة أهل السنة والجماعة على مذهب أبي حنيفة وصاحبيه، من أوسع متون العقيدة قبولًا. والحواشي تعليق الشيخ محمد ناصر الدين الألباني.",
    aboutEn: "The creed of Ahl as-Sunnah wal-Jamaʿah according to Abu Hanifah and his two companions, one of the most widely accepted creeds. The footnotes are by Shaykh Muhammad Nasir ad-Din al-Albani.",
  },
  {
    id: "lumah", turath: 30855, group: "aqida", died: 620, unit: 0,
    ar: "لمعة الاعتقاد", en: "Lumʿat al-Iʿtiqad", by: "ابن قدامة المقدسي", byEn: "Ibn Qudamah al-Maqdisi",
    about: "متن مختصر في صفات الله تعالى والقرآن والرؤية والقدر والإيمان واليوم الآخر والصحابة، على طريقة السلف.",
    aboutEn: "A concise creed on the attributes of Allah, the Quran, the vision of Allah, predestination, faith, the Last Day and the Companions, in the way of the Salaf.",
  },
  {
    id: "wasitiyya", turath: 22665, group: "aqida", died: 728, from: 2, unit: 2,
    ar: "العقيدة الواسطية", en: "Al-ʿAqida al-Wasitiyya", by: "شيخ الإسلام ابن تيمية", byEn: "Shaykh al-Islam Ibn Taymiyyah",
    about: "كتبها لقاضٍ من واسط سأله أن يكتب له عقيدة: أصول اعتقاد أهل السنة والجماعة بأدلتها من الكتاب والسنة. والنص مشكول.",
    aboutEn: "Written for a judge from Wasit who asked him for a creed: the foundations of the belief of Ahl as-Sunnah wal-Jamaʿah with their proofs from the Quran and Sunnah. Fully vowelled.",
  },
  {
    id: "tawhid", turath: 11318, group: "aqida", died: 1206,
    ar: "كتاب التوحيد", en: "Kitab at-Tawhid", by: "محمد بن عبد الوهاب", byEn: "Muhammad ibn ʿAbd al-Wahhab",
    about: "أبواب في توحيد العبادة وما ينافيه أو ينقصه، في كل باب الآيات والأحاديث ثم مسائله.",
    aboutEn: "Chapters on worshipping Allah alone and what negates or weakens it; each chapter gives verses and hadith, then the points it teaches.",
  },
  {
    id: "usul-thalatha", turath: 239, group: "aqida", died: 1206, from: 6,
    ar: "ثلاثة الأصول وأدلتها", en: "The Three Fundamental Principles", by: "محمد بن عبد الوهاب", byEn: "Muhammad ibn ʿAbd al-Wahhab",
    about: "معرفة العبد ربه ودينه ونبيه ﷺ بالأدلة، ويليها «شروط الصلاة وأركانها وواجباتها» و«القواعد الأربع».",
    aboutEn: "Knowing one's Lord, one's religion and one's Prophet ﷺ with the proofs, followed by “The Conditions, Pillars and Obligations of Prayer” and “The Four Principles”.",
  },
  {
    id: "bayan-aqida", turath: 96481, group: "aqida", died: 1440, from: 2, unit: 2,
    ar: "بيان عقيدة أهل السنة والجماعة ولزوم اتباعها", en: "The Creed of Ahl as-Sunnah wal-Jamaʿah", by: "د. سعيد بن علي بن وهف القحطاني", byEn: "Dr. Saʿid ibn ʿAli ibn Wahf al-Qahtani",
    about: "لمؤلف حصن المسلم: مفهوم عقيدة أهل السنة والجماعة، وأصولها الستة، ووسطية أهلها بين الفرق، وأخلاقهم، بالأدلة. محاضرة أشرف عليها الشيخ عبد العزيز بن باز وأقرّها.",
    aboutEn: "By the author of Hisn al-Muslim: what the creed of Ahl as-Sunnah wal-Jamaʿah is, its six foundations, the middle way of its people between the sects, and their character, with the proofs. A lecture supervised and approved by Shaykh ʿAbd al-ʿAziz ibn Baz.",
  },
  {
    id: "quduri", turath: 124336, group: "fiqh", madhhab: "hanafi", died: 428, unit: 2,
    ar: "مختصر القدوري", en: "Mukhtasar al-Quduri", by: "أبو الحسين القدوري", byEn: "Abu al-Husayn al-Quduri",
    about: "من أشهر متون المذهب الحنفي وأكثرها اعتمادًا، ويُسمّى «الكتاب»، في أبواب الفقه كلها.",
    aboutEn: "One of the best-known and most relied-upon primers of the Hanafi school, known simply as “al-Kitab”, covering every chapter of fiqh.",
  },
  {
    id: "risala", turath: 11373, group: "fiqh", madhhab: "maliki", died: 386,
    ar: "الرسالة", en: "Ar-Risala", by: "ابن أبي زيد القيرواني", byEn: "Ibn Abi Zayd al-Qayrawani",
    about: "أشهر متون المذهب المالكي: بدأها بباب في العقيدة، ثم العبادات والمعاملات والآداب.",
    aboutEn: "The best-known primer of the Maliki school: it opens with a chapter on creed, then worship, transactions and manners.",
  },
  {
    id: "abu-shuja", turath: 11370, group: "fiqh", madhhab: "shafii", died: 593,
    ar: "متن أبي شجاع (الغاية والتقريب)", en: "Matn Abi Shujaʿ (al-Ghaya wa-t-Taqrib)", by: "القاضي أبو شجاع الأصفهاني", byEn: "Al-Qadi Abu Shujaʿ al-Asfahani",
    about: "مختصر في فقه المذهب الشافعي، من أكثر المتون تدريسًا للمبتدئين، في أبواب الفقه كلها.",
    aboutEn: "A concise primer of Shafiʿi fiqh, among the texts most taught to beginners, covering every chapter of fiqh.",
  },
  {
    id: "zad", turath: 11230, group: "fiqh", madhhab: "hanbali", died: 968, unit: 2,
    // Footnote 1 of page 170 is about a word on the page before (بالنداء) and has no mark in the edition.
    known: ["p170: footnote(s) 1 have no mark in the text"],
    ar: "زاد المستقنع في اختصار المقنع", en: "Zad al-Mustaqniʿ", by: "موسى الحجاوي", byEn: "Musa al-Hajjawi",
    about: "اختصر فيه «المقنع» لابن قدامة على قول واحد هو المعتمد في المذهب الحنبلي، وعليه يدرس طلاب المذهب. والحواشي فروق النسخ الخطية.",
    aboutEn: "An abridgement of Ibn Qudamah's al-Muqniʿ keeping one view, the one relied upon in the Hanbali school; students of the school study it first. The footnotes give the differences between the manuscripts.",
  },
];

const ch = (...cps) => String.fromCodePoint(...cps);
const DIGITS = "٠١٢٣٤٥٦٧٨٩";
const arNum = s => Number(String(s).replace(/[٠-٩]/g, d => DIGITS.indexOf(d)));
const OPEN = ch(0x27E6), CLOSE = ch(0x27E7);
const REF = n => OPEN + n + CLOSE; // ⟦n⟧: footnote n of the same reading page
const SPAN = /<span data-type="title"[^>]*?\bid="?toc-(\d+)"?[^>]*>([\s\S]*?)<\/span>/g;

async function getText(name, url) {
  const file = path.join(CACHE, name);
  if (!fs.existsSync(file)) {
    let last;
    for (let i = 0; i < 5; i++) {
      try {
        const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        const t = await r.text(); JSON.parse(t);
        fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(file, t); last = null; break;
      } catch (e) { last = e; await new Promise(r => setTimeout(r, 3000 * (i + 1))); }
    }
    if (last) throw last;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Letters only, without diacritics or letter-form differences: for finding a heading's line and comparing headings.
const norm = s => String(s).normalize("NFD").replace(/\p{M}/gu, "").replace(/ـ/g, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/@@[^@]+@@/g, " ").replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
const words = s => norm(s).split(" ").filter(Boolean);
// The same heading in other words: one has every word of the other, with at most two more.
const sameHeading = (a, b) => {
  const x = words(a), y = words(b); if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return long.length - short.length <= 2 && short.every(w => long.includes(w));
};

// ---------- one book ----------
function build(cfg, info, whole, problems, infos) {
  // A problem fails the build, unless it was checked by hand and listed in the book's "known"; infos are only printed.
  const say = (pg, msg) => ((cfg.known || []).includes(`p${pg}: ${msg}`) ? infos : problems).push(`${cfg.id} p${pg}: ${msg}`);
  const tell = (pg, msg) => infos.push(`${cfg.id} p${pg}: ${msg}`);
  const headings = info.indexes.headings;
  const first = cfg.from || 1;
  // A heading mark may run over a line break: keep it on one line.
  const pages = whole.pages.map((p, i) => {
    const text = p.text.replace(/<span data-type="title"[^>]*>[\s\S]*?<\/span>/g, m => m.replace(/\s*\n\s*/g, " "));
    const at = text.search(/^_{5,}\s*$/m);
    return { idx: i + 1, page: p.page, vol: p.vol, body: at < 0 ? text : text.slice(0, at), foot: at < 0 ? "" : text.slice(at).replace(/^_+[^\n]*\n?/, "") };
  });

  // ---------- headings the edition did not mark in the text: find their line on their page ----------
  const marked = new Set(pages.flatMap(p => [...(p.body + p.foot).matchAll(/\bid="?toc-(\d+)/g)].map(m => Number(m[1]))));
  headings.forEach((hd, k) => {
    const n = k + 1; if (marked.has(n)) return;
    const p = pages[hd.page - 1];
    if (!p || p.idx < first) return; // before the book's own text (a publisher's preface)
    const lines = p.body.split("\n");
    // The line that says the heading: the same words, or else the line that opens with most of them.
    const want = words(hd.title);
    const score = l => { const w = words(l).slice(0, want.length + 3); return want.filter(x => w.includes(x)).length / want.length; };
    let at = lines.findIndex(l => !/<span/.test(l) && l.trim() && sameHeading(l, hd.title));
    if (at < 0) { let best = 0.6; lines.forEach((l, i) => { const s = !/<span/.test(l) && l.trim() ? score(l) : 0; if (s >= best && (at < 0 || s > best)) { best = s; at = i; } }); }
    if (at >= 0) {
      // A short line that starts like the heading is the heading as printed; in a paragraph the heading marks where it starts.
      const line = lines[at].trim();
      lines[at] = line.length <= 160 && words(line)[0] === want[0] ? `<span data-type="title" id=toc-${n}>${line}</span>` : `<span data-type="title" id=toc-${n}></span>${line}`;
    } else {
      // A heading turath.io gives to a part of the text without a line of its own: it opens its page.
      lines.unshift(`<span data-type="title" id=toc-${n}>${hd.title}</span>`);
      tell(p.idx, `heading «${hd.title}» has no line of its own: shown at the top of the page`);
    }
    p.body = lines.join("\n");
  });

  // Footnote numbers in the edition: "(١) …" under the line, or a bare "١ …" (then the mark in the text is a bare digit).
  const footLines = pages.flatMap(p => p.foot.split("\n").map(l => l.trim()));
  const paren = footLines.filter(l => /^\([٠-٩]+\)/.test(l)).length;
  const bare = footLines.filter(l => /^[٠-٩]+(?![٠-٩/])/.test(l)).length;
  const style = bare > paren ? "bare" : "paren";
  const NOTE = style === "paren" ? /^\(([٠-٩]+|\*)\)\s*/ : /^([٠-٩]+|\*)(?![٠-٩/])\s*[.-]?\s*/;
  const MARK = style === "paren" ? /\((\*|[٠-٩]+)\)/g : /(?<![٠-٩(/])(\*|[٠-٩]+)(?![٠-٩)/])/g;

  // ---------- footnotes of every page ----------
  const notes = new Map(); // "page:n" -> text
  const noteHeads = new Map(); // "page:n" -> headings marked inside that footnote
  let lastNote = null;
  for (const p of pages) {
    p.marks = [];
    if (p.idx < first || !p.foot.trim()) continue;
    let mine = null, expect = 1;
    p.foot.split("\n").forEach(raw => {
      let line = raw.trim(); if (!line) return;
      // "=" opens the part of a long footnote that runs over from the page before.
      // The note before may end with "==" where it breaks off mid-sentence.
      if (!mine && /^=/.test(line)) { line = line.replace(/^=+\s*/, ""); if (lastNote) notes.set(lastNote, notes.get(lastNote).replace(/\s*=+$/, "") + " " + line); else say(p.idx, "continued footnote with nothing before it"); return; }
      const m = NOTE.exec(line);
      const n = m && (m[1] === "*" ? "*" : arNum(m[1]));
      if (m && (n === "*" || !mine || n === expect)) {
        if (n !== "*") expect = n + 1;
        mine = `${p.idx}:${n}`; notes.set(mine, line.slice(m[0].length)); p.marks.push(n); lastNote = mine;
      } else if (mine) notes.set(mine, notes.get(mine) + "\n" + line);
      else if (lastNote) { notes.set(lastNote, notes.get(lastNote) + "\n" + line); tell(p.idx, `footnote line without a number, joined to the one before: ${line.slice(0, 50)}`); }
      else say(p.idx, `footnote line without a number: ${line.slice(0, 60)}`);
    });
  }
  // Headings inside a footnote become plain text (the contents still lists them); a rule line under a note's own
  // sub-note is dropped.
  for (const [k, text] of notes) notes.set(k, text.replace(SPAN, (m, n, inner) => { noteHeads.set(k, [...(noteHeads.get(k) || []), Number(n)]); return inner; }).replace(/^_{5,}\s*$/gm, "").replace(/\n{2,}/g, "\n").trim());

  // ---------- the text as a stream of headings and paragraphs ----------
  const stream = [];
  for (const p of pages) {
    if (p.idx < first) continue;
    // Footnote marks in this page's text, matched in order to the page's own footnotes.
    const want = [...p.marks];
    const mark = s => s.replace(MARK, (m, d) => {
      const n = d === "*" ? "*" : arNum(d);
      // In order; a footnote whose mark is missing from the text is passed over (and reported).
      const k = want.indexOf(n); if (k < 0) return m;
      if (k > 0) say(p.idx, `footnote(s) ${want.slice(0, k).join(",")} have no mark in the text`);
      want.splice(0, k + 1); return `@@${p.idx}:${n}@@`;
    });
    const lines = p.body.split("\n").map(x => x.trim()).filter(Boolean);
    lines.forEach((line, i) => {
      const pageEnd = i === lines.length - 1;
      if (/^(\.{3}|…)$/.test(line) || /^المجلد [^\s]+$/.test(line)) return;
      if (/^(\*\s*){3,}$/.test(line)) { stream.push({ sep: true, pg: p }); return; }
      const spans = [...line.matchAll(SPAN)];
      const rest = line.replace(SPAN, "").trim();
      if (spans.length && spans.every(s => s[2].trim()) && !/[^\s\[\]():.،-]/.test(rest.replace(/\(([٠-٩]+|\*)\)/g, ""))) {
        // A heading on its own line, as printed; its footnote marks stay with it.
        const shown = mark(spans.map(s => s[2]).join(" ") + " " + rest).replace(/\s+/g, " ").trim();
        spans.forEach((s, k) => stream.push({ h: Number(s[1]), shown: k === spans.length - 1 ? shown : null, pg: p }));
        return;
      }
      for (const s of spans) stream.push({ h: Number(s[1]), inline: true, pg: p });
      stream.push({ p: mark(line.replace(SPAN, "$2").replace(/\s+/g, " ")), pg: p, pageEnd });
    });
    if (want.length) say(p.idx, `footnote(s) ${want.join(",")} have no mark in the text`);
  }

  // ---------- one heading printed twice (the heading, then the book's own heading line) ----------
  const tidy = [];
  for (const x of stream) {
    if (x.p != null) {
      const run = []; for (let k = tidy.length - 1; k >= 0 && tidy[k].h != null && !tidy[k].inline && tidy[k].pg === x.pg; k--) run.push(tidy[k]);
      // Only the nearest heading: a book's line under «كتاب …» then «مدخل» stays the first line of «مدخل».
      if (run[0] && sameHeading(run[0].shown ?? headings[run[0].h - 1]?.title ?? "", x.p)) { run[0].shown = x.p; continue; }
    }
    tidy.push(x);
  }

  // ---------- paragraphs that run over a page break ----------
  const occurs = (s, c) => s.split(c).length - 1;
  const ENDS = /[.:؟!»"\])}﴾،؛]\s*(@@[^@]+@@\s*)*$/;
  const NEW = /^([٠-٩]+\s*[-–.)]|\(?[٠-٩]+\)|[أ-ي]\s*[-–)]\s|"?فصل"?|\*|\[)/;
  const merged = [];
  for (const x of tidy) {
    const prev = merged.at(-1);
    if (x.p != null && prev?.p != null && prev.pageEnd && prev.pg !== x.pg) {
      const open = occurs(prev.p, "﴿") > occurs(prev.p, "﴾") || occurs(prev.p, "«") > occurs(prev.p, "»") || occurs(prev.p, "[") > occurs(prev.p, "]") || occurs(prev.p, "(") > occurs(prev.p, ")");
      if (open || (!ENDS.test(prev.p) && !NEW.test(x.p))) { prev.p += " " + x.p; prev.pageEnd = x.pageEnd; prev.pg = x.pg; prev.last = x.pg; continue; }
    }
    merged.push({ ...x });
  }

  // ---------- reading pages ----------
  // unit 0: a short book is one reading page, and its contents jump to the place in it.
  const unit = cfg.unit ?? 1;
  const clean = s => s.replace(/\s+/g, " ").replace(/^\[(.*)\]\s*:?$/, "$1").replace(/\s*:$/, "").trim();
  const sections = [], toc = []; // toc[k]: where heading k+1 is shown (s: -1 while it is before the first reading page)
  let lead = null; // the contents entry of an opening page that has no heading
  let cur = null;
  const front = { body: [], refs: [], pages: [null, null] };
  const open = (t, p, lvl) => { cur = { t, l: lvl, body: [], refs: [], pages: [p.page, p.page] }; sections.push(cur); return cur; };
  const box = () => cur || front;
  const addRefs = (b, s) => { for (const m of String(s).matchAll(/@@([^@]+)@@/g)) if (!b.refs.includes(m[1])) b.refs.push(m[1]); };
  const span = (b, p) => { if (p.page != null) { if (b.pages[0] == null) b.pages[0] = p.page; b.pages[1] = p.page; } };
  const para = (x, extra) => { const b = box(); b.body.push({ p: x.p, ...extra }); addRefs(b, x.p); span(b, x.pg); if (x.last) span(b, x.last); };
  const lead6 = s => { const w = s.replace(/@@[^@]+@@/g, "").replace(/\s+/g, " ").trim().split(" "); return w.slice(0, 8).join(" ") + (w.length > 8 ? "…" : ""); };

  if (cfg.items) {
    // No chapters, only numbered paragraphs («١ - …»): the contents lists each of them. The edition's few
    // headings are lines of the text itself, so they stay in it as paragraphs.
    let n = 0;
    for (const x of merged) {
      if (x.sep) { box().body.push({ sep: 1 }); continue; }
      if (x.h != null) { if (x.shown) para({ p: x.shown, pg: x.pg }); continue; }
      const m = /^([٠-٩]+)\s*-/.exec(x.p);
      if (m && arNum(m[1]) === n + 1) { n++; toc.push({ t: lead6(x.p), l: 1, s: -1, a: "n" + n }); para(x, { a: "n" + n }); }
      else para(x);
    }
  } else {
    let anchor = null;
    for (const x of merged) {
      if (x.h != null) {
        const hd = headings[x.h - 1]; if (!hd) { say(x.pg.idx, `heading toc-${x.h} is not in the index`); continue; }
        const t = clean(hd.title);
        if (hd.level <= unit) {
          open(t, x.pg, hd.level);
          // The heading is the opening words of a paragraph: the page shows no separate title.
          if (x.inline) cur.il = 1;
          else if (x.shown && clean(x.shown) !== t) { cur.th = clean(x.shown); addRefs(cur, x.shown); }
          toc[x.h - 1] = { t, l: hd.level, s: sections.length - 1 };
        } else {
          const a = "h" + x.h;
          toc[x.h - 1] = { t, l: hd.level, s: sections.length - 1, a };
          if (x.inline) anchor = a;
          else { box().body.push({ h: clean(x.shown || t), l: Math.max(1, hd.level - unit), a }); addRefs(box(), x.shown || ""); }
        }
        continue;
      }
      if (x.sep) { box().body.push({ sep: 1 }); continue; }
      para(x, anchor != null ? { a: anchor } : {}); anchor = null;
    }
  }
  // Text before the first heading: a basmala opens the first reading page; a longer opening (the book's
  // title and chain of narration, or the whole of a one-page book) is a reading page of its own under the book's title.
  if (front.body.length) {
    if (sections.length && JSON.stringify(front.body).length < 300) {
      const s = sections[0]; s.body = [...front.body, ...s.body]; s.refs = [...front.refs, ...s.refs.filter(r => !front.refs.includes(r))]; s.pages[0] = front.pages[0] ?? s.pages[0];
      toc.forEach(e => { if (e) e.s = Math.max(0, e.s); });
    } else {
      sections.unshift({ t: cfg.ar, l: 1, ...front }); toc.forEach(e => { if (e) e.s++; });
      if (!toc.some(e => e && e.s === 0 && !e.a) && front.body[0]?.a == null) lead = { t: cfg.ar, l: 1, s: 0 };
    }
  }
  if (!sections.length) problems.push(`${cfg.id}: no reading pages`);

  // ---------- footnotes: numbered from 1 on each reading page, in reading order ----------
  sections.forEach((s, si) => {
    const order = s.refs;
    const fix = str => str.replace(/@@([^@]+)@@/g, (m, k) => REF(order.indexOf(k) + 1));
    s.body = s.body.map(x => x.p != null ? { ...x, p: fix(x.p) } : x.h != null ? { ...x, h: fix(x.h) } : x);
    if (s.th) s.th = fix(s.th);
    s.notes = order.map((k, i) => {
      const t = notes.get(k); if (t == null) problems.push(`${cfg.id}: missing footnote ${k}`);
      // A heading inside a footnote (an explanation the author put in the notes): the contents opens the note.
      if (!cfg.items) for (const n of noteHeads.get(k) || []) toc[n - 1] = { t: clean(headings[n - 1].title), l: headings[n - 1].level, s: si, fn: i + 1 };
      return t || "";
    });
  });
  const missing = headings.map((h, k) => k).filter(k => !toc[k] && headings[k].page >= first);
  if (!cfg.items && missing.length) problems.push(`${cfg.id}: headings not placed: ${missing.map(k => headings[k].title).join(" | ")}`);

  // A reading page with no text of its own is a group title in the contents (for example «كتاب الطهارة» before its chapters).
  const out = sections.map(s => {
    const o = { t: s.t, l: s.l };
    if (s.th) o.th = s.th;
    if (s.il) o.il = 1;
    if (s.body.length) { o.pg = s.pages; o.body = s.body; if (s.notes.length) o.notes = s.notes; }
    return o;
  });
  const vols = new Set(pages.map(p => p.vol)); if (vols.size > 1) problems.push(`${cfg.id}: ${vols.size} volumes (page labels assume one)`);
  return { sections: out, toc: [lead, ...toc].filter(Boolean) };
}

(async () => {
  const problems = [], infos = [];
  const index = { built: new Date().toISOString().slice(0, 10), source: { name: "turath.io", url: "https://app.turath.io" }, books: [] };
  fs.mkdirSync(OUT, { recursive: true });
  const keep = new Set(["index.json"]);
  for (const cfg of BOOKS) {
    const info = await getText(`${cfg.turath}.info.json`, `${API}/book?id=${cfg.turath}&include=indexes&ver=3`);
    const whole = await getText(`${cfg.turath}.json`, `${FILES}/books-v3/${cfg.turath}.json`);
    if (whole.pages.length !== info.indexes.page_map.length) problems.push(`${cfg.id}: ${whole.pages.length} pages in the book file, ${info.indexes.page_map.length} in its index`);
    const book = build(cfg, info, whole, problems, infos);

    // ---------- checks ----------
    const all = JSON.stringify(book);
    if (/<[a-z/]/i.test(all)) problems.push(`${cfg.id}: HTML left in the text`);
    if (/@@/.test(all)) problems.push(`${cfg.id}: unresolved footnote mark`);
    for (const s of book.sections) {
      const refs = new Set([...JSON.stringify([s.th || "", s.body || []]).matchAll(new RegExp(OPEN + "(\\d+)" + CLOSE, "g"))].map(m => Number(m[1])));
      (s.notes || []).forEach((x, i) => { if (!refs.has(i + 1)) problems.push(`${cfg.id}: note ${i + 1} of «${s.t}» is not referred to`); if (!x) problems.push(`${cfg.id}: empty note ${i + 1} of «${s.t}»`); });
      for (const n of refs) if (!s.notes?.[n - 1]) problems.push(`${cfg.id}: mark ${n} in «${s.t}» has no note`);
    }
    if (!book.sections.some(s => s.body)) problems.push(`${cfg.id}: no text`);

    const data = JSON.stringify({ id: cfg.id, sections: book.sections, toc: book.toc });
    const hash = crypto.createHash("sha256").update(data).digest("hex").slice(0, 10);
    const file = `${cfg.id}.${hash}.json`; keep.add(file);
    fs.writeFileSync(path.join(OUT, file), data + "\n");
    const m = info.meta;
    const { turath, unit, from, items, known, ...meta } = cfg;
    index.books.push({
      ...meta, file, bytes: Buffer.byteLength(data) + 1, title: m.name,
      edition: m.info.split("\n").map(x => x.trim()).filter(x => x && !/^\[/.test(x)).join("\n"),
      turath, url: `https://app.turath.io/book/${turath}`,
      pages: book.sections.filter(s => s.body).length,
    });
    const sizes = book.sections.filter(s => s.body).map(s => JSON.stringify(s.body).length);
    console.log(`${cfg.id}: ${sizes.length} reading pages (largest ${(Math.max(...sizes) / 1024).toFixed(0)} KB), ${book.toc.length} headings, ${book.sections.reduce((a, s) => a + (s.notes?.length || 0), 0)} footnotes, ${(Buffer.byteLength(data) / 1024).toFixed(0)} KB`);
  }
  for (const f of fs.readdirSync(OUT)) if (!keep.has(f)) fs.unlinkSync(path.join(OUT, f));
  if (infos.length) console.log("· " + infos.join("\n· "));
  if (problems.length) { console.error("✗ " + problems.join("\n✗ ")); process.exitCode = 1; }
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1) + "\n");
  console.log(`✓ www/kutub: ${index.books.length} books`);
})().catch(e => { console.error(e); process.exit(1); });
