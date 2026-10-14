// Builds www/asma/book.json: «شرح أسماء الله الحسنى في ضوء الكتاب والسنة» by Saʿid ibn ʿAli ibn Wahf al-Qahtani
// (the author of Hisn al-Muslim). He gathered the names with proofs from the Quran and Sunnah, kept those his
// teacher Ibn Baz approved, and explained 99 of them from Ibn Taymiyyah, Ibn al-Qayyim, as-Saʿdi and others.
// Text: turath.io (book 96493, page numbers match the printed edition), copied word for word:
// the script only splits it into the book's own chapters and name entries and joins each entry's footnotes.
// Usage: node scripts/build-asma.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "asma");
const OUT = path.join(ROOT, "www", "asma", "book.json");
const BOOK_ID = 96493;
const API = "https://api.turath.io";

const ch = (...cps) => String.fromCodePoint(...cps);
const DIAC = new RegExp("[" + ch(0x64B) + "-" + ch(0x65F) + ch(0x670) + ch(0x640) + "]", "g"); // tashkeel, dagger alef, tatweel
const plain = s => s.replace(DIAC, "").replace(/\s+/g, " ").trim();
const arDigits = s => Number(String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
// Footnote reference in the stored text: ⟦n⟧ points to notes[n - 1] of the same entry.
const REF = (n) => ch(0x27E6) + n + ch(0x27E7);

async function getJSON(name, url) {
  const file = path.join(CACHE, name);
  if (!fs.existsSync(file)) {
    let last;
    for (let i = 0; i < 4; i++) {
      try { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); const t = await r.text(); JSON.parse(t); fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(file, t); last = null; break; }
      catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
    }
    if (last) throw last;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

(async () => {
  const info = await getJSON("book.json", `${API}/book?id=${BOOK_ID}&include=indexes&ver=3`);
  const count = info.indexes.page_map.length;
  const pages = [];
  for (let id = 1; id <= count; id++) {
    const p = await getJSON(`p${id}.json`, `${API}/page?book_id=${BOOK_ID}&pg=${id}&ver=3`);
    pages.push({ id, page: JSON.parse(p.meta).page, text: p.text });
  }
  const problems = [];

  // ---------- split each page into lines and its own footnotes ----------
  const notes = new Map(); // "pageId:n" -> text
  const lines = [];
  for (const p of pages) {
    const [body, foot = ""] = p.text.split(/^_{5,}$/m);
    let last = null;
    for (const raw of foot.split("\n")) {
      const line = raw.trim(); if (!line) continue;
      const m = /^\(([٠-٩]+)\)\s*([\s\S]*)$/.exec(line);
      if (m) { last = `${p.id}:${arDigits(m[1])}`; notes.set(last, m[2]); }
      else if (last) notes.set(last, notes.get(last) + "\n" + line);
      else problems.push(`page ${p.page}: footnote text without a number: ${line.slice(0, 60)}`);
    }
    const rows = body.split("\n").map(x => x.trim()).filter(Boolean);
    rows.forEach((line, i) => {
      // Footnote marks "(١)" become references to this page's footnotes.
      const text = line.replace(/\(([٠-٩]+)\)/g, (m, d) => notes.has(`${p.id}:${arDigits(d)}`) ? `@@${p.id}:${arDigits(d)}@@` : m);
      lines.push({ page: p.page, text, pageEnd: i === rows.length - 1 });
    });
  }
  // A paragraph goes on when a page ends mid-sentence, or when a line ends inside a verse ﴿…﴾ or a quotation «…».
  const occurs = (s, c) => s.split(c).length - 1;
  const ENDS = /[.:؟!]["»)\]]*\s*(@@\d+:\d+@@\s*)*[.،]?$/;
  const goesOn = (para, pageEnd) => occurs(para, "﴿") > occurs(para, "﴾") || occurs(para, "«") > occurs(para, "»") || (pageEnd && !ENDS.test(para));

  // ---------- walk the lines: front page, chapters (المباحث) and the explained names ----------
  const TITLE = /<span data-type="title" id=toc-\d+>([\s\S]*?)<\/span>/g;
  const front = { body: [], refs: [] };
  const chapters = [], groups = [], names = [];
  let cur = front, namesNote = null;
  const start = (box, page) => { box.body = []; box.refs = []; box.pages = [page, page]; return box; };
  const addRefs = (box, s) => { for (const m of s.matchAll(/@@(\d+:\d+)@@/g)) if (!box.refs.includes(m[1])) box.refs.push(m[1]); };
  let open = false; // the last paragraph continues on the next line
  for (const { page, text, pageEnd } of lines) {
    const titles = [...text.matchAll(TITLE)].map(m => m[1].trim());
    if (!titles.length) {
      const prev = cur.body.at(-1);
      if (open && prev?.p != null && !/^(فتوى رقم|س[٠-٩]+:)/.test(text)) prev.p += " " + text; else cur.body.push({ p: text, pg: page });
      open = goesOn(cur.body.at(-1).p, pageEnd);
      addRefs(cur, text); if (cur.pages) cur.pages[1] = page; continue;
    }
    open = false;
    const rest = text.replace(TITLE, "");
    if (titles.every(t => /^[٠-٩]+\s*-\s*/.test(t))) {
      // One or more names explained together: "٥ - العَلِيُّ، ٦ - الأعْلَى، ٧ - الْمُتَعَالِ".
      cur = start({ names: [] }, page); groups.push(cur);
      for (const t of titles) { const n = arDigits(/^([٠-٩]+)/.exec(t)[1]); const name = t.replace(/^[٠-٩]+\s*-\s*/, "").trim(); cur.names.push(n); names.push({ n, name, plain: plain(name), g: groups.length - 1 }); }
      // A footnote on the heading: the first one explains the author's method and belongs to the whole list;
      // any other is the entry's own first footnote, marked after the name (head).
      const refs = [...rest.matchAll(/@@(\d+:\d+)@@/g)].map(m => m[1]);
      if (refs.length && groups.length === 1) namesNote = refs.map(r => notes.get(r)).join("\n");
      else if (refs.length) { cur.refs.push(...refs); cur.head = refs.map((r, i) => i + 1); }
      if (plain(rest.replace(/@@\d+:\d+@@/g, "")).replace(/[،,.\s]/g, "")) problems.push(`page ${page}: text beside the names heading: ${rest}`);
    } else if (titles.length === 1 && /^النوع /.test(plain(titles[0]))) {
      // A sub-heading inside a name's explanation (الشافي).
      const h = plain(text.replace(TITLE, "$1").replace(/@@\d+:\d+@@/g, ""));
      cur.body.push({ h, pg: page }); cur.pages[1] = page;
    } else {
      // A chapter of the book; part of its title can follow the heading mark on the same line.
      const title = plain(text.replace(TITLE, "$1").replace(/@@\d+:\d+@@/g, ""));
      cur = start({ title }, page); chapters.push(cur);
      addRefs(cur, text);
    }
  }

  // ---------- footnotes: numbered from 1 within each entry, in reading order ----------
  const finish = box => {
    const order = box.refs; const used = new Set();
    const fix = s => s.replace(/@@(\d+:\d+)@@/g, (m, k) => { used.add(k); return REF(order.indexOf(k) + 1); });
    box.body = box.body.map(x => x.p != null ? { p: fix(x.p), pg: x.pg } : x);
    box.notes = order.map(k => { const t = notes.get(k); if (t == null) problems.push(`missing footnote ${k}`); return t || ""; });
    delete box.refs; return box;
  };
  [front, ...chapters, ...groups].forEach(finish);

  // ---------- checks ----------
  if (names.length !== 99 || names.some((x, i) => x.n !== i + 1)) problems.push(`expected names 1…99, got ${names.map(x => x.n).join(",")}`);
  const all = JSON.stringify([front, chapters, groups]);
  if (/<[a-z/]/i.test(all)) problems.push("HTML left in the text");
  if (/@@/.test(all)) problems.push("unresolved footnote mark");
  if (!namesNote) problems.push("no note on the first names heading (the author's method)");
  if (problems.length) { console.error("✗ " + problems.join("\n✗ ")); process.exit(1); }

  const book = {
    source: {
      title: info.meta.name, author: "سعيد بن علي بن وهف القحطاني", publisher: "مطبعة سفير، الرياض",
      pages: 264, turath: BOOK_ID, url: `https://app.turath.io/book/${BOOK_ID}`,
    },
    namesNote, front: { body: front.body, notes: front.notes },
    names, groups, chapters,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(book) + "\n");
  console.log(`✓ ${path.relative(ROOT, OUT)}: ${names.length} names in ${groups.length} entries, ${chapters.length} chapters, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
})().catch(e => { console.error(e); process.exit(1); });
