// الباحث الفقهي: cutting the books of www/kutub into passages for the search index, and the text normalisation
// that the server (faqih/src/verify.js) uses to check that every quotation really is in the passage it cites.
// Pure functions, no I/O: scripts/build-faqih.mjs feeds them the files, scripts/faqih-test.mjs checks them.
//
// A passage is a reading page (section) of a book, or a run of its paragraphs when the page is long: never part of
// a paragraph, so a passage always links to a place the reader can open (#/kutub/<book>/<section>?p=<paragraph>).
// The text embedded for search starts with where the passage sits (book, school, headings above it), so that
// «ولنا» in al-Mughni or a bare «الحكم التكليفي» in the encyclopedia keeps its meaning.

const ch = (...cps) => String.fromCodePoint(...cps);
const MARK = new RegExp(ch(0x27E6) + "\\d+" + ch(0x27E7), "g"); // ⟦n⟧ footnote marks of a reading page
const TASHKEEL = new RegExp("[" + ch(0x064B) + "-" + ch(0x065F) + ch(0x0670) + ch(0x06D6) + "-" + ch(0x06ED) + ch(0x0640) + "]", "g"); // harakat, Quranic marks, tatweel
const ALIF = new RegExp("[" + ch(0x0622, 0x0623, 0x0625, 0x0671) + "]", "g");
const TAA = new RegExp(ch(0x0629), "g"), ALIF_MAQSURA = new RegExp(ch(0x0649), "g");

export const SIZES = { page: 2000, chunk: 1500, overlap: 600, paragraph: 3500 }; // characters of text (without marks)

export const stripMarks = s => String(s).replace(MARK, "");
// Letters without diacritics or letter-form differences; everything that is not a letter, a digit or a space is a space.
// Used both to embed the text and to compare a quotation with its passage.
export const stripTashkeel = s => String(s).replace(TASHKEEL, "");
export function normalizeArabic(s) {
  return stripTashkeel(stripMarks(s)).replace(ALIF, ch(0x0627)).replace(TAA, ch(0x0647)).replace(ALIF_MAQSURA, ch(0x064A))
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

export const MADHHAB_AR = { hanafi: "الفقه الحنفي", maliki: "الفقه المالكي", shafii: "الفقه الشافعي", hanbali: "الفقه الحنبلي", zahiri: "الفقه الظاهري" };

// The headings a reading page sits under, outermost first, ending with its own title: «كتاب الطهارة › باب الآنية».
export function headingPath(sections, i) {
  const out = [sections[i].t]; let l = sections[i].l;
  for (let k = i - 1; k >= 0 && l > 1; k--) if (sections[k].l < l) { out.unshift(sections[k].t); l = sections[k].l; }
  return out;
}

// One line saying where a passage is: «المغني، ابن قدامة (الفقه الحنبلي) › كتاب الطهارة › باب …».
export function contextLine(book, path) {
  const who = [book.by, book.madhhab ? MADHHAB_AR[book.madhhab] : ""].filter(Boolean).join("، ");
  return [`${book.ar}${who ? "، " + who : ""}`, ...path].join(" › ");
}

// A paragraph far longer than SIZES.paragraph (a whole page without a break) is cut at sentence ends so that no
// passage outgrows the index's metadata limit; the pieces still link to the same paragraph.
export function splitParagraph(text, max = SIZES.paragraph) {
  if (text.length <= max) return [text];
  const out = []; let rest = text;
  while (rest.length > max) {
    let cut = -1;
    for (const re of [/[.؟!]\s/g, /[؛:]\s/g, /،\s/g, /\s/g]) {
      for (const m of rest.matchAll(re)) { const at = m.index + m[0].length; if (at > max) break; if (at >= max / 2) cut = at; }
      if (cut > 0) break;
    }
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trim()); rest = rest.slice(cut);
  }
  if (rest.trim()) out.push(rest.trim());
  return out;
}

// Cut a reading page into passages: [{ s, p0, p1, k, path, text, embed }].
//   s: section index; p0..p1: first and last body index of the passage (its deep link uses p0);
//   k: piece of a paragraph cut by splitParagraph (0 otherwise); path: headings above the passage, the page's own
//   last; text: the paragraphs word for word (marks removed); embed: the context line and the text without diacritics.
export function chunkSection(book, sections, i, body, sizes = SIZES) {
  const base = headingPath(sections, i);
  // Paragraphs with their body index and the inline heading (a heading shown inside the page) above each.
  const items = []; let sub = [];
  body.forEach((x, idx) => {
    if (x.h != null) { sub = [stripMarks(x.h).trim()]; return; }
    if (x.p == null) return; // a separator
    const text = stripMarks(x.p).replace(/\s+/g, " ").trim(); if (!text) return;
    splitParagraph(text, sizes.paragraph).forEach((piece, k) => items.push({ idx, k, text: piece, sub }));
  });
  if (!items.length) return [];
  const total = items.reduce((a, x) => a + x.text.length, 0);
  const groups = [];
  if (total <= sizes.page) groups.push(items);
  else {
    let cur = [], n = 0;
    // Close the passage being filled; when the next one continues the same text, the last paragraph is repeated at its
    // start if it is short, so that a sentence split by the cut is still read whole.
    const close = overlap => {
      if (!cur.length) return;
      groups.push(cur); const last = cur.at(-1);
      cur = overlap && last.text.length <= sizes.overlap && !last.k ? [last] : []; n = cur.reduce((a, x) => a + x.text.length, 0);
    };
    for (const it of items) {
      if (cur.length && it.sub !== cur[0].sub) close(false); // an inline heading starts a passage of its own
      if (it.text.length >= sizes.chunk) { close(false); groups.push([it]); continue; } // a long paragraph (or a piece of one) stands alone
      if (cur.length && n + it.text.length > sizes.chunk) close(true);
      cur.push(it); n += it.text.length;
    }
    if (cur.length) groups.push(cur);
  }
  return groups.map(g => {
    const path = [...base, ...g[0].sub.filter(h => !base.includes(h))];
    const text = g.map(x => x.text).join("\n");
    return { s: i, p0: g[0].idx, p1: g.at(-1).idx, k: g[0].k, path, text, embed: contextLine(book, path) + "\n" + stripTashkeel(text) };
  });
}

// Id of a passage: short, unique for the book and stable while the book's pages do not move.
export const chunkId = (bookId, c) => `${bookId}/${c.s}/${c.p0}` + (c.k ? `.${c.k}` : "");

// What the index keeps with each vector (Vectorize metadata; the server returns it to the app).
export function metadataOf(book, section, c) {
  const m = { b: book.id, s: c.s, p0: c.p0, p1: c.p1, h: c.path.join(" › "), text: c.text, bh: book.file.split(".")[1] };
  if (section.pg) { m.pg0 = Number(section.pg[0]); m.pg1 = Number(section.pg[1]); }
  if (section.v) { m.v0 = String(section.v[0]); m.v1 = String(section.v[1]); }
  return m;
}
