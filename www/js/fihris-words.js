/* ===== فهرس كلمات المكتبة: the words of the books of www/kutub, for searching their whole text on the device ===== */
// scripts/build-fihris.mjs writes the index (www/fihris/) with these functions and www/js/faqih.js reads it with them,
// so a word is cut the same way in the books and in a question. No network, no dependencies.
//
// A word is its letters without diacritics or letter-form differences, without the article and the prefixes glued to
// it («بالزكاة» and «والزكاة» are «زكاه»). A question's word also finds the word with a pronoun or plural ending
// («صوم» finds «صومه», «زكاه» finds «زكاتها»): those endings are matched when reading the index, not cut when writing it.

const ch = (...cps) => String.fromCodePoint(...cps);
const MARK = new RegExp(ch(0x27E6) + "\\d+" + ch(0x27E7), "g"); // ⟦n⟧ footnote marks of a reading page
const TASHKEEL = new RegExp("[" + ch(0x0610) + "-" + ch(0x061A) + ch(0x064B) + "-" + ch(0x065F) + ch(0x0670) + ch(0x06D6) + "-" + ch(0x06ED) + ch(0x0640) + "]", "g");
const FORMS = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي", "ی": "ي", "ک": "ك" };

// The text as shown in a search result: no footnote marks, no diacritics.
export const plain = s => String(s).replace(MARK, "").replace(TASHKEEL, "");
// One letter for one letter of plain(), so a place found in the folded text is the same place in the plain text.
export const fold = s => s.replace(/[أإآٱةىیک]/g, c => FORMS[c]);

// The article and the letters glued before it; «الله» keeps its name.
const ARTICLE = /^(?:[وف]?[بك]?ال|[وف]?لل)(?=..)/;
const ALLAH = /^[وفبت]?(?:ال|ل)له$/;
const stem = w => ALLAH.test(w) ? "الله" : w.replace(ARTICLE, "");

// Words carrying no meaning of their own; the build also leaves out any word found in more than half of the pages.
export const STOP = new Set(("في من الي علي عن ان او ما ماذا هل لا لم لن ثم قد كان يكون كانت كانوا هو هي هم هما هن انا نحن انت "
  + "هذا هذه هذان هاتان هولاء ذلك تلك ذي تي ذين لتي لذي اي كل بعض بين عند مع حتي اذا اذ له لها لهم لنا به بها بهم فيه فيها "
  + "فيهم عليه عليها عليهم منه منها منهم عنه عنها انه انها الا اما غير ليس لو كما مثل مما ممن متي كيف كم اين لماذا وهل ام "
  + "او و ف ب ل ك يا لي ني").split(" "));

// The words of a text, in order, each with the article taken off. In the books (glued: true) a word with «و ف ب ك ل»
// glued before it and no article («وصومه», «بلبس») is also counted without that letter, since a question asks for
// the word alone.
export function words(text, glued = true) {
  const out = [];
  for (const w of fold(plain(text)).split(/[^\p{L}]+/u)) {
    if (w.length < 2) continue;
    const s = stem(w); out.push(s);
    if (glued && s === w && w.length >= 4 && /^[وفبكل]/.test(w)) out.push(w.slice(1));
  }
  return out;
}

// The words of a question worth looking up, each once. stop: the index's own list of words too common to search.
export const queryWords = (q, stop = []) => [...new Set(words(q, false).filter(w => !STOP.has(w) && !stop.includes(w)))];

// Endings a question's word may have in the books: pronouns, dual, plural. A word ending in «ه» (from «ة») also
// takes them after «ت»: «زكاه» → «زكاته»، «صلاه» → «صلاتين».
const ENDINGS = ["", "ه", "ها", "هم", "هما", "هن", "ك", "كم", "نا", "ي", "ا", "ان", "ين", "ون", "ات", "وا", "يه", "يا", "ني"];
const T_ENDINGS = ["ه", "ها", "هم", "هما", "هن", "ك", "كم", "نا", "ي", "ين", "ان"];
export function forms(w) {
  if (w.length < 3) return new Set([w]);
  const out = new Set(ENDINGS.map(e => w + e));
  if (w.endsWith("ه")) for (const e of T_ENDINGS) out.add(w.slice(0, -1) + "ت" + e);
  return out;
}

// The index is cut into files of neighbouring words in sorted order; firsts: the first word of each file, in order.
export function fileOf(w, firsts) {
  let lo = 0, hi = firsts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (firsts[mid] <= w) lo = mid; else hi = mid - 1; }
  return lo;
}
// The files that hold every form of a question's word.
export const filesOf = (w, firsts) => new Set([...forms(w)].map(f => fileOf(f, firsts)));

// Where a question's words are in a folded text (for marking them in a result): [start, end] pairs.
export function matcher(qw) {
  const alt = qw.flatMap(w => [...forms(w)]).sort((a, b) => b.length - a.length).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!alt.length) return () => [];
  const re = new RegExp(`(?<![\\p{L}])(?:[وف]?[بك]?ال|[وف]?لل|[وفبكل])?(${alt.join("|")})(?![\\p{L}])`, "gu");
  return text => [...text.matchAll(re)].map(m => [m.index + m[0].length - m[1].length, m.index + m[0].length, m[1]]);
}

// ---------- ranking ----------
// BM25 over the reading pages (documents), each word of the question counted with all its forms; a page that has more
// of the question's words comes first. postings(w): the [docs, tf] lists of the forms of w found in the index.
const K1 = 1.2, B = 0.75;
export function rank(qw, postings, { n, avgdl, len }) {
  const acc = new Map(); let asked = 0;
  for (const w of qw) {
    const tfs = new Map();
    for (const { docs, tf } of postings(w)) for (let j = 0; j < docs.length; j++) tfs.set(docs[j], (tfs.get(docs[j]) || 0) + tf[j]);
    if (!tfs.size) continue;
    asked++;
    const idf = Math.log(1 + (n - tfs.size + 0.5) / (tfs.size + 0.5));
    for (const [d, f] of tfs) {
      const s = idf * f * (K1 + 1) / (f + K1 * (1 - B + B * len[d] / avgdl));
      const x = acc.get(d); if (x) { x.score += s; x.words++; } else acc.set(d, { doc: d, score: s, words: 1 });
    }
  }
  const out = [...acc.values()];
  for (const x of out) x.score *= (x.words / asked) ** 2;
  return out.sort((a, b) => b.score - a.score);
}
// The same results with the books taking turns: each further page of a book already shown counts a little less, so
// the first results show what several books say. bookOf(doc) → its book.
export function mix(ranked, bookOf, step = 0.9) {
  const seen = new Map();
  return ranked.map(x => { const b = bookOf(x.doc), k = seen.get(b) || 0; seen.set(b, k + 1); return { ...x, mixed: x.score * step ** k }; })
    .sort((a, b) => b.mixed - a.mixed);
}

// ---------- the files of the index ----------
// A file: its words in order, each with the pages (documents) it is in and how many times:
//   count, then for each word: its length in bytes, its letters (UTF-8), its number of pages, then for each page
//   the step from the previous page number and the count, all as unsigned LEB128 numbers.
const enc = new TextEncoder(), dec = new TextDecoder();
export function encodeFile(entries) { // entries: [[word, [doc, tf, doc, tf, …] by doc], …] sorted by word
  let out = new Uint8Array(1 << 16), i = 0;
  const byte = b => { if (i === out.length) { const x = new Uint8Array(out.length * 2); x.set(out); out = x; } out[i++] = b; };
  const num = n => { do { let b = n & 127; n >>>= 7; if (n) b |= 128; byte(b); } while (n); };
  num(entries.length);
  for (const [w, posts] of entries) {
    const bytes = enc.encode(w); num(bytes.length); bytes.forEach(byte); num(posts.length / 2);
    let prev = 0; for (let j = 0; j < posts.length; j += 2) { num(posts[j] - prev); num(posts[j + 1]); prev = posts[j]; }
  }
  return out.slice(0, i);
}
export function decodeFile(buf) { // → Map word → { docs: Uint32Array, tf: Uint16Array }
  const a = new Uint8Array(buf); let i = 0;
  const num = () => { let n = 0, s = 0, b; do { b = a[i++]; n += (b & 127) * 2 ** s; s += 7; } while (b & 128); return n; };
  const map = new Map();
  for (let k = num(); k > 0; k--) {
    const len = num(); const w = dec.decode(a.subarray(i, i + len)); i += len;
    const n = num(), docs = new Uint32Array(n), tf = new Uint16Array(n);
    let d = 0; for (let j = 0; j < n; j++) { d += num(); docs[j] = d; tf[j] = Math.min(num(), 65535); }
    map.set(w, { docs, tf });
  }
  return map;
}
