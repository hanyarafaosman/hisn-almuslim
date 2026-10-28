// Builds www/data/fadl.json: the virtue (فضل) and source (تخريج) of each morning and evening dhikr (chapter 27),
// shown folded under each dhikr. The printed Hisn al-Muslim gives them in a footnote under every dhikr; the
// hisnmuslim.com data the app uses has no footnotes. Text: turath.io, copied word for word:
//  - book 31307 «حصن المسلم من أذكار الكتاب والسنة»: the author's footnote under each dhikr (its virtue when the
//    hadith states one, then where the hadith is and who graded it), and the footnote on the chapter's opening line;
//  - book 96495 «شرح حصن المسلم من أذكار الكتاب والسنة» by Majdi al-Ahmad, corrected by the author of Hisn
//    al-Muslim: the companion who narrated each hadith, and the virtue of the two adhkar whose footnote in Hisn
//    al-Muslim gives only the source (92 said once, 94).
// The only change to the text: the honorific ligatures (﵁ ﵀ ﷺ …) are written out in words, as in data/hisn.json,
// because many fonts have no glyph for them.
// Usage: node scripts/build-fadl.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "fadl");
const OUT = path.join(ROOT, "www", "data", "fadl.json");
const API = "https://api.turath.io";
const HISN = { id: 31307, from: 53, to: 67 };   // turath page ids of printed pages 54–68 (chapter 27)
const SHARH = { id: 96495, from: 155, to: 183 }; // printed pages 156–184
const FIRST = 75, LAST = 98;                     // the chapter's adhkar, numbered as in the book and the app

const ch = (...cps) => String.fromCodePoint(...cps);
const arDigits = s => Number(String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const LIGATURES = [[0xFD40, "رحمه الله"], [0xFD41, "رضي الله عنه"], [0xFD42, "رضي الله عنها"], [0xFD43, "رضي الله عنهم"],
  [0xFD44, "رضي الله عنهما"], [0xFD47, "عليه السلام"], [0xFDFA, "صلى الله عليه وسلم"], [0xFDFE, "سبحانه وتعالى"], [0xFDFF, "عز وجل"]];
const words = s => LIGATURES.reduce((a, [cp, w]) => a.split(ch(cp)).join(w), s);
const clean = s => words(s).replace(/\s+/g, " ").trim();

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
// Pages of one book, each split into its text and its own numbered footnotes.
async function pagesOf(book) {
  const pages = [];
  for (let id = book.from; id <= book.to; id++) {
    const p = await getJSON(`${book.id}-${id}.json`, `${API}/page?book_id=${book.id}&pg=${id}&ver=3`);
    const [body, foot = ""] = p.text.split(/^_{5,}$/m);
    const notes = new Map(); let last = null;
    for (const raw of foot.split("\n")) {
      const line = raw.trim(); if (!line) continue;
      const m = /^\(([٠-٩]+)\)\s*([\s\S]*)$/.exec(line);
      if (m) { last = arDigits(m[1]); notes.set(last, m[2]); } else if (last) notes.set(last, notes.get(last) + " " + line);
    }
    pages.push({ id, page: JSON.parse(p.meta).page, body, notes });
  }
  return pages;
}
// The chapter's adhkar: "٧٥ - (١) …" starts dhikr 75 (the "(١)" is its number in the chapter). Footnote marks become
// @@page:n@@. Returns { intro, items: Map id → text (one line per line of the book) } from the chapter heading up to
// the next chapter.
const START = /^([٠-٩]+) - \([٠-٩]+\)\s*/;
function chapterOf(pages, problems) {
  const items = new Map(); let cur = null, on = false, intro = "";
  for (const p of pages) {
    for (const line of p.body.split("\n").map(x => x.trim()).filter(Boolean)) {
      if (/data-type="title"/.test(line)) { if (on) return { intro, items }; if (/٢٧/.test(line)) on = true; continue; }
      if (!on) continue;
      const m = START.exec(line);
      const text = line.replace(START, "").replace(/\(([٠-٩]+)\)/g, (s, d) => p.notes.has(arDigits(d)) ? `@@${p.id}:${arDigits(d)}@@` : s);
      if (m) { cur = arDigits(m[1]); items.set(cur, text); }
      else if (cur) items.set(cur, items.get(cur) + "\n" + text);
      else intro += text;
    }
  }
  problems.push("the next chapter's heading was not found");
  return { intro, items };
}
const note = (pages, ref) => { const [id, n] = ref.split(":").map(Number); return pages.find(p => p.id === id)?.notes.get(n); };

// A footnote of Hisn al-Muslim: "[سورة …. ]من قالها … . أخرجه …" → the virtue, and where the hadith is.
const SOURCE = "(?:أخرجه|أحمد|مسلم|البخاري|النسائي|أبو داود|الترمذي|ابن [^ ،]+|الحاكم|الطبراني)[ ،]";
function split(text) {
  const m = new RegExp(`(«?من (?:قال|صل)[\\s\\S]*?)(?:[.،]\\s*|(?<=»)\\s*)(?=${SOURCE})`).exec(text);
  return m ? { fadl: clean(m[1]), src: clean(text.slice(m.index + m[0].length)) } : { src: clean(text) };
}

(async () => {
  const problems = [];
  const hisn = await pagesOf(HISN), sharh = await pagesOf(SHARH);
  const H = chapterOf(hisn, problems), S = chapterOf(sharh, problems);
  const items = {};
  for (let id = FIRST; id <= LAST; id++) {
    const text = H.items.get(id); if (!text) { problems.push(`dhikr ${id} not found in Hisn al-Muslim`); continue; }
    // The source footnotes come after the dhikr's closing quotation mark (the others give the evening wording
    // or explain a word). Dhikr 92 has two: one for saying it ten times, one for saying it once.
    const tail = text.slice(Math.max(text.lastIndexOf("»"), text.lastIndexOf("﴾")));
    const refs = [...tail.matchAll(/(?:\(([^()]+)\)\s*)?@@(\d+:\d+)@@/g)].map(m => ({ ref: m[2], for: m[1] && clean(m[1]) }));
    if (!refs.length) { problems.push(`dhikr ${id}: no source footnote`); continue; }
    const item = { fadl: [], src: [] };
    for (const r of refs) {
      const n = note(hisn, r.ref); const { fadl, src } = split(n);
      const label = refs.length > 1 ? { for: r.for } : {};
      if (fadl) item.fadl.push({ ...label, t: fadl });
      // "وانظر فضلها في: ص١٤٦، حديث، رقم ٢٥٥": the virtue is a hadith of the book's chapter on tasbih (dhikr 255).
      const see = /وانظر فضلها في:[^.]*رقم ([٠-٩]+)/.exec(src);
      if (see) item.fadl.push({ ...label, see: arDigits(see[1]) });
      item.src.push({ ...label, t: src });
    }
    // The commentary: the narrator, and the virtue where Hisn al-Muslim's footnote states none.
    const sh = S.items.get(id); if (!sh) { problems.push(`dhikr ${id} not found in the commentary`); continue; }
    // "- صحابي الحديث هو أبو هريرة - ﵁ -.": the name, up to the honorific or an added description.
    // Dhikr 92 has two hadith (ten times, once) and the commentary names only the second one's narrator.
    const rawi = /^-?\s*صحابي(?:ة)? الحديث (?:هو|هي) (.+)$/m.exec(words(sh));
    if (rawi && refs.length === 1) item.rawi = clean(rawi[1].split(/ - |[؛،(]/)[0]).replace(/\.$/, "");
    if (!item.fadl.some(f => f.t)) {
      const said = /^(?:وجاء في الحديث|والحديث بتمامه): (.+)$/m.exec(sh);
      if (said) {
        const t = clean(said[1].replace(/\s*@@\d+:\d+@@/g, "")).replace(/\.$/, "");
        // 92: the commentary's hadith is the virtue of saying it once (the corrector's note under it says so).
        const label = refs.length > 1 ? { for: refs.find(r => /واحدة/.test(r.for || ""))?.for } : {};
        item.fadl.push({ ...label, t, sharh: 1 });
      }
    }
    items[id] = item;
  }
  // The chapter's opening line «الحمد لله وحده …» has a footnote on sitting to remember Allah morning and evening.
  const introRef = /@@(\d+:\d+)@@/.exec(H.intro)?.[1];
  const introNote = introRef && note(hisn, introRef);
  const im = introNote && /^([\s\S]*»)\.?\s*([\s\S]+)$/.exec(introNote);
  if (!im) problems.push("no footnote on the chapter's opening line");

  // ---------- checks ----------
  const all = JSON.stringify(items);
  if (/@@|<[a-z/]/i.test(all)) problems.push("footnote mark or HTML left in the text");
  if (new RegExp(`[${ch(0xFD40)}-${ch(0xFD4F)}${ch(0xFDFA)}-${ch(0xFDFF)}]`).test(all)) problems.push("honorific ligature left in the text");
  for (const [id, x] of Object.entries(items)) {
    if (!x.src.length || x.src.some(s => !s.t)) problems.push(`dhikr ${id}: empty source`);
    if (!x.rawi && x.src.length === 1) problems.push(`dhikr ${id}: no narrator in the commentary`);
    if (x.fadl.some(f => f.t && !/^«?(?:من|أن|لقد|عن)|النبي/.test(f.t))) problems.push(`dhikr ${id}: unexpected virtue text: ${x.fadl[0].t.slice(0, 40)}`);
  }
  const withFadl = Object.keys(items).filter(id => items[id].fadl.length);
  if (problems.length) { console.error("✗ " + problems.join("\n✗ ")); process.exit(1); }

  const data = {
    source: {
      hisn: { title: "حصن المسلم من أذكار الكتاب والسنة", author: "سعيد بن علي بن وهف القحطاني", turath: HISN.id, url: `https://app.turath.io/book/${HISN.id}` },
      sharh: { title: "شرح حصن المسلم من أذكار الكتاب والسنة", author: "مجدي بن عبد الوهاب الأحمد", turath: SHARH.id, url: `https://app.turath.io/book/${SHARH.id}` },
    },
    intro: { t: clean(im[1]), src: clean(im[2]) },
    items,
  };
  fs.writeFileSync(OUT, JSON.stringify(data, null, 1) + "\n");
  console.log(`✓ ${path.relative(ROOT, OUT)}: ${Object.keys(items).length} adhkar, ${withFadl.length} with their virtue (${withFadl.join(", ")})`);
})().catch(e => { console.error(e); process.exit(1); });
