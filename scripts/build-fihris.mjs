// فهرس كلمات المكتبة: the word index of the books of www/kutub, so that الباحث الفقهي (www/js/faqih.js) searches their
// whole text on the device, with no server. Words are cut by www/js/fihris-words.js, the same module the app reads with.
// A document is a reading page of a book; its headings count three times. Files written to www/fihris/:
//   index.json            the books it was made from (their file names, so check.js sees when a book changed), the
//                         count and mean length of the documents, the words left out as too common, the word files
//   docs.<hash>.json      each document: its book, reading page, length in words, headings and printed pages
//   w/<n>.<hash>.bin      neighbouring words in sorted order and the documents each is in (fihris-words.js)
// Usage (from the repo root, after npm run kutub):
//   node scripts/build-fihris.mjs                        write the index
//   node scripts/build-fihris.mjs --eval                 scripts/faqih-eval.json: how often the expected place is found
//   node scripts/build-fihris.mjs --ask="حكم الوضوء بالنبيذ"  show what a question finds
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { headingPath } from "./faqih-chunk.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const KUTUB = path.join(ROOT, "www", "kutub"), OUT = path.join(ROOT, "www", "fihris");
const W = await import(pathToFileURL(path.join(ROOT, "www", "js", "fihris-words.js")));
const ARGS = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([\w-]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const HEADING = 3; // a word of the headings above a page counts this many times
const COMMON = 0.5; // a word in more than this share of the documents is left out (STOP in fihris-words.js lists the rest)
const FILE_SIZE = 40 * 1024; // bytes of a word file (one very common word may make a larger one alone)
const TITLE = 100; // characters of the headings kept to show with a result
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 10);

// ---------- the documents and their words ----------
const index = JSON.parse(fs.readFileSync(path.join(KUTUB, "index.json"), "utf8"));
const docs = []; const post = new Map(); // word → [doc, tf, doc, tf, …]
for (const [bi, b] of index.books.entries()) {
  const head = JSON.parse(fs.readFileSync(path.join(KUTUB, b.file), "utf8"));
  const parts = b.chunks.map((h, k) => JSON.parse(fs.readFileSync(path.join(KUTUB, b.id, `${k}.${h}.json`), "utf8")));
  head.sections.forEach((s, si) => {
    const x = s.c != null && parts[s.c][si]; if (!x) return;
    const tf = new Map(); let len = 0;
    for (const e of x.body || []) { const t = e.p ?? e.h; if (t == null) continue; for (const w of W.words(t)) { tf.set(w, (tf.get(w) || 0) + 1); len++; } }
    const where = headingPath(head.sections, si).map(W.plain).filter(h => h !== W.plain(b.ar)); // the encyclopedia's top heading is its name
    for (const w of W.words(where.join(" "))) tf.set(w, (tf.get(w) || 0) + HEADING);
    if (!len) return;
    const d = docs.length;
    const shown = where.slice(-2).join(" › ");
    // [book, reading page, its part file, words, headings, first and last printed page, first and last volume]
    docs.push([bi, si, s.c, len, shown.length > TITLE ? shown.slice(0, shown.lastIndexOf(" ", TITLE)) + "…" : shown, ...(s.pg ? [s.pg[0], s.pg[1], ...(s.v ? [s.v[0], s.v[1]] : [])] : [])]);
    for (const [w, n] of tf) { let p = post.get(w); if (!p) post.set(w, p = []); p.push(d, n); }
  });
}
const N = docs.length, avgdl = docs.reduce((a, d) => a + d[3], 0) / N;
const common = [...post].filter(([w, p]) => p.length / 2 > COMMON * N).map(([w]) => w).sort();
for (const w of [...common, ...W.STOP]) post.delete(w);
const len = docs.map(d => d[3]);
const postings = w => [...W.forms(w)].map(f => post.get(f)).filter(Boolean).map(p => ({ docs: p.filter((x, j) => !(j % 2)), tf: p.filter((x, j) => j % 2) }));
const search = q => W.mix(W.rank(W.queryWords(q, common), postings, { n: N, avgdl, len }), d => docs[d][0]);
const label = d => `${index.books[docs[d][0]].id}/${docs[d][1]} ${docs[d][4]}`;

if (ARGS.ask) {
  console.log("words:", W.queryWords(ARGS.ask, common).join(" "));
  for (const r of search(ARGS.ask).slice(0, 15)) console.log(r.score.toFixed(2), r.words, label(r.doc));
} else if (ARGS.eval) {
  // Each question of scripts/faqih-eval.json with the places it is expected to find (a book and a reading page or range).
  const set = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "faqih-eval.json"), "utf8"));
  const hit = (d, e) => index.books[docs[d][0]].id === e.b && (Array.isArray(e.s) ? docs[d][1] >= e.s[0] && docs[d][1] <= e.s[1] : docs[d][1] === e.s);
  let at5 = 0, at10 = 0, found = 0, wanted = 0;
  for (const { q, expect } of set) {
    const top = search(q).slice(0, 10).map(r => r.doc);
    const at = top.findIndex(d => expect.some(e => hit(d, e)));
    if (at >= 0 && at < 5) at5++; if (at >= 0) at10++;
    const got = expect.filter(e => top.some(d => hit(d, e))).length; found += got; wanted += expect.length;
    if (ARGS.v || at < 0) console.log(`${at < 0 ? "✗" : "✓ " + (at + 1)} ${q}  (${got}/${expect.length})${at < 0 ? "\n    " + top.slice(0, 5).map(label).join("\n    ") : ""}`);
  }
  console.log(`hit@5 ${at5}/${set.length}, hit@10 ${at10}/${set.length}; expected places in the first 10: ${found}/${wanted}`);
} else {
  // ---------- the files ----------
  // Neighbouring words in sorted order (the order fileOf() searches), about FILE_SIZE bytes a file.
  const files = []; let cur = [], size = 0; // files: [first word, bytes]
  const close = () => { if (cur.length) files.push([cur[0][0], W.encodeFile(cur)]); cur = []; size = 0; };
  for (const e of [...post].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
    const n = W.encodeFile([e]).length - 1;
    if (size && size + n > FILE_SIZE) close();
    cur.push(e); size += n;
  }
  close();
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, "w"), { recursive: true });
  const words = files.map(([first, bytes], n) => { const h = hash(bytes); fs.writeFileSync(path.join(OUT, "w", `${n}.${h}.bin`), bytes); return [first, h]; });
  const docsText = JSON.stringify({ books: index.books.map(b => b.id), d: docs });
  const docsFile = `docs.${hash(docsText)}.json`; fs.writeFileSync(path.join(OUT, docsFile), docsText);
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({
    built: new Date().toISOString().slice(0, 10), kutub: index.books.map(b => b.file), n: N, avgdl: Math.round(avgdl), common, docs: docsFile, words,
  }) + "\n");
  const total = files.reduce((a, [, b]) => a + b.length, 0), big = Math.max(...files.map(([, b]) => b.length));
  console.log(`${N} documents, ${post.size} words (${common.length} too common), ${files.length} word files of ${(total / 1048576).toFixed(1)} MB (largest ${Math.round(big / 1024)} KB), ${docsFile} ${Math.round(Buffer.byteLength(docsText) / 1024)} KB`);
}
