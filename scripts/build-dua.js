// Builds www/data/dua.json: «الدعاء من الكتاب والسنة» by Saʿid ibn ʿAli ibn Wahf al-Qahtani, the companion of his
// Hisn al-Muslim: the virtue of duʿaʾ, its etiquette and the causes of an answer, the times, states and places in
// which duʿaʾ is answered, then 149 supplications from the Quran and the Sunnah, each with its source in a footnote.
// Text: turath.io (book 30900, the Ministry of Islamic Affairs print, 21st edition 1430 AH; page numbers match the
// printed book), copied word for word: the script only splits it into the book's own chapters and numbered
// supplications and puts each one's footnotes with it. The only changes to the text: the honorific ligatures
// (﵁ ﵀ ﷺ …) are written out in words, as in data/hisn.json, because many fonts have no glyph for them, and the
// misprints listed in FIXES.
// Usage: node scripts/build-dua.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "dua");
const OUT = path.join(ROOT, "www", "data", "dua.json");
const BOOK_ID = 30900;
const COUNT = 149; // supplications in this edition

const ch = (...cps) => String.fromCodePoint(...cps);
const arDigits = s => Number(String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const DIAC = new RegExp("[" + ch(0x64B) + "-" + ch(0x65F) + ch(0x670) + ch(0x640) + "]", "g"); // tashkeel, dagger alef, tatweel
const plain = s => s.replace(DIAC, "").replace(/\s+/g, " ").trim();
const LIGATURES = [[0xFD40, "رحمه الله"], [0xFD41, "رضي الله عنه"], [0xFD42, "رضي الله عنها"], [0xFD43, "رضي الله عنهم"],
  [0xFD44, "رضي الله عنهما"], [0xFD47, "عليه السلام"], [0xFD4E, "تبارك وتعالى"], [0xFDFA, "صلى الله عليه وسلم"], [0xFDFE, "سبحانه وتعالى"], [0xFDFF, "عز وجل"]];
const words = s => LIGATURES.reduce((a, [cp, w]) => a.split(ch(cp)).join(w), s);
const LIGATURE = new RegExp(`[${ch(0xFD40)}-${ch(0xFD4F)}${ch(0xFDFA)}-${ch(0xFDFF)}]`);
// Footnote reference in the stored text: ⟦n⟧ points to notes[n - 1] of the same chapter or supplication.
const REF = n => ch(0x27E6) + n + ch(0x27E7);

// Misprints of the digital copy, by printed page: [page, found, replacement, why]. Each must be found exactly once.
const FIXES = [
  [19, "٢٠ -» ", "٢٠ - ", "a closing quotation mark with none opened, before a verse"],
];

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
  const info = await getJSON("info.json", `https://api.turath.io/book?id=${BOOK_ID}&include=indexes&ver=3`);
  const book = await getJSON("book.json", `https://files.turath.io/books-v3/${BOOK_ID}.json`);
  const problems = [];
  // The cover page has no printed number.
  const pages = book.pages.map((p, i) => ({ id: i, page: p.page, text: words(p.text) })).filter(p => p.page != null);
  for (const [page, from, to, why] of FIXES) {
    const p = pages.find(x => x.page === page);
    if (!p || p.text.split(from).length !== 2) { problems.push(`fix for page ${page} (${why}) does not apply once`); continue; }
    p.text = p.text.replace(from, to);
  }

  // ---------- split each page into lines and its own footnotes ----------
  const notes = new Map(); // "pageId:n" -> text
  const lines = [];
  // A sentence is finished by a full stop, a question or exclamation mark or a colon, with closing marks after it.
  const DONE = /[.:؟!]["»)\]]*$/;
  for (const p of pages) {
    const [body, foot = ""] = p.text.split(/^_{5,}$/m);
    let last = null;
    for (const raw of foot.split("\n")) {
      const line = raw.trim(); if (!line) continue;
      const m = /^\(([٠-٩]+)\)\s*([\s\S]*)$/.exec(line);
      if (m) { last = `${p.id}:${arDigits(m[1])}`; notes.set(last, m[2]); }
      // A line with no number goes on with the note above it: the rest of a line the print wrapped, or (after a
      // finished sentence) a new paragraph of the same note.
      else if (last) notes.set(last, notes.get(last) + (DONE.test(notes.get(last)) ? "\n" : " ") + line);
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

  // ---------- walk the lines: the front page, the chapters, then the numbered supplications ----------
  const TITLE = /<span data-type="title" id=toc-\d+>([\s\S]*?)<\/span>/;
  const ITEM = /^([٠-٩]+)\s*-\s*/;
  const front = { body: [], refs: [] };
  const chapters = [], items = [], after = [];
  let cur = front, open = false, pending = null;
  const addRefs = (box, s) => { for (const m of s.matchAll(/@@(\d+:\d+)@@/g)) if (!box.refs.includes(m[1])) box.refs.push(m[1]); };
  const add = (box, text, page) => {
    const prev = box.body.at(-1);
    if (open && prev) prev.p += " " + text; else box.body.push({ p: text, pg: page });
    addRefs(box, text); if (box.pages) box.pages[1] = page;
  };
  for (const { page, text, pageEnd } of lines) {
    const title = TITLE.exec(text);
    if (title) {
      // A chapter of the book. A footnote mark after the heading belongs to the whole chapter (head).
      const rest = text.replace(TITLE, "");
      cur = { title: title[1].trim(), body: [], refs: [], pages: [page, page] }; chapters.push(cur); open = false;
      const head = [...rest.matchAll(/@@(\d+:\d+)@@/g)].map(m => m[1]);
      if (head.length) { cur.refs.push(...head); cur.head = head.map((r, i) => i + 1); }
      if (plain(rest.replace(/@@\d+:\d+@@/g, "")).replace(/[:،.\s]/g, "")) problems.push(`page ${page}: text beside the heading: ${rest}`);
      // The basmala printed above the first heading opens that chapter.
      if (pending) { add(cur, pending.text, pending.page); pending = null; }
      continue;
    }
    if (cur === front) {
      // The page facing the introduction: a verse, then the Names of Allah, a few to a line. A line after it and
      // before the first heading (the basmala) is kept for the chapter that follows.
      if (page === lines[0].page) { if (front.body.length < 2) front.body.push({ p: text, pg: page }); else front.body[1].p += "\n" + text; addRefs(front, text); }
      else if (!pending) pending = { text, page }; else problems.push(`page ${page}: text before the first heading: ${text.slice(0, 60)}`);
      continue;
    }
    const last = chapters.at(-1);
    if (chapters.length < 5) { add(last, text, page); open = goesOn(last.body.at(-1).p, pageEnd); continue; }
    // The last chapter: its opening line, the supplications "١ - …", and the closing line.
    const m = ITEM.exec(text), it = items.at(-1);
    if (m) {
      const n = arDigits(m[1]);
      if (open) problems.push(`supplication ${n} starts before ${it.n} ends (page ${page})`);
      if (n !== items.length + 1) problems.push(`supplication ${n} follows ${items.length} (page ${page})`);
      items.push({ n, t: text.replace(ITEM, ""), pg: page, refs: [] });
    } else if (!it) add(last, text, page);
    else if (open) it.t += " " + text;
    // A line of its own under a supplication adds words of another narration to it (128); after the last one it is
    // the book's closing line.
    else if (it.n < COUNT) it.t += "\n" + text;
    else after.push({ p: text, pg: page });
    const now = items.at(-1); if (now) open = goesOn(now.t, pageEnd);
  }

  // ---------- footnotes: numbered from 1 within each chapter or supplication, in reading order ----------
  const used = new Set();
  const order = (refs, s) => s.replace(/@@(\d+:\d+)@@/g, (m, k) => { used.add(k); return REF(refs.indexOf(k) + 1); });
  const noteOf = k => { const t = notes.get(k); if (t == null) problems.push(`missing footnote ${k}`); return (t || "").replace(/[ \t]+/g, " ").trim(); };
  const tidy = s => s.replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
  for (const box of [front, ...chapters]) {
    box.body = box.body.map(x => ({ p: tidy(order(box.refs, x.p)), pg: x.pg }));
    box.notes = box.refs.map(noteOf); box.refs.forEach(k => used.add(k)); delete box.refs;
  }
  for (const it of items) {
    addRefs(it, it.t); it.t = tidy(order(it.refs, it.t)); it.notes = it.refs.map(noteOf); delete it.refs;
  }
  const closing = after.map(x => x.p).join("\n");

  // ---------- checks ----------
  if (chapters.length !== 5) problems.push(`expected 5 chapters, got ${chapters.map(c => plain(c.title)).join(" | ")}`);
  if (items.length !== COUNT) problems.push(`expected ${COUNT} supplications, got ${items.length}`);
  for (const it of items) {
    if (!it.notes.length) problems.push(`supplication ${it.n}: no footnote`);
    if (occurs(it.t, "«") !== occurs(it.t, "»") || occurs(it.t, "﴿") !== occurs(it.t, "﴾")) problems.push(`supplication ${it.n}: unbalanced quotation marks: ${it.t.slice(0, 50)}`);
    if (!new RegExp(REF("\\d+") + "\\s*[.،]*$").test(it.t)) problems.push(`supplication ${it.n}: does not end with its footnote: …${it.t.slice(-40)}`);
  }
  for (const k of notes.keys()) if (!used.has(k)) problems.push(`footnote ${k} is not referred to`);
  if (after.length !== 1 || !/^والحمد لله رب العالمين/.test(closing)) problems.push(`unexpected text after the supplications: ${closing.slice(0, 80)}`);
  if (front.body.length !== 2 || !/^﴿/.test(front.body[0].p)) problems.push("the front page is not a verse and the Names");
  const all = JSON.stringify([front, chapters, items, closing]);
  if (/<[a-z/]/i.test(all)) problems.push("HTML left in the text");
  if (/@@/.test(all)) problems.push("unresolved footnote mark");
  if (LIGATURE.test(all)) problems.push("honorific ligature left in the text");
  if (problems.length) { console.error("✗ " + problems.join("\n✗ ")); process.exit(1); }

  const edition = /الطبعة: ([^\n]+)/.exec(info.meta.info)?.[1], publisher = /الناشر: ([^\n]+)/.exec(info.meta.info)?.[1];
  const data = {
    source: {
      title: info.meta.name, author: "سعيد بن علي بن وهف القحطاني", publisher, edition,
      turath: BOOK_ID, url: `https://app.turath.io/book/${BOOK_ID}`,
    },
    front: { body: front.body, notes: front.notes },
    // The last chapter is the supplications themselves: its heading and opening line, then the list.
    chapters: chapters.slice(0, 4),
    duas: { title: chapters[4].title, open: chapters[4].body.map(x => x.p).join("\n"), pages: [chapters[4].pages[0], items.at(-1).pg], close: closing },
    items,
  };
  fs.writeFileSync(OUT, JSON.stringify(data) + "\n");
  console.log(`✓ ${path.relative(ROOT, OUT)}: ${items.length} supplications, ${data.chapters.length} chapters before them, ${notes.size} footnotes, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
})().catch(e => { console.error(e); process.exit(1); });
