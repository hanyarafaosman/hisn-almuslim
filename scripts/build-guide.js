// Builds «ركن الأطفال» (#/kids) and «يوميات مسلم» (#/muslim) from scripts/guide-source.js:
//   www/data/guide.json   the structure of both pages and their evidence: verses copied from Quran.com's imlaei text,
//                         hadith found by their words in the hadith books the app reads (fawazahmed0/hadith-api, the
//                         pinned commit of scripts/build-hadith-index.js) so each opens in the hadith reader, adhkar
//                         named by their number in data/hisn.json, and the reviewed books of IslamHouse.com per language
//   www/guide/ar.json, www/guide/en.json   the texts (the other languages are translations of en.json, same keys)
// Usage: node scripts/build-guide.js            (keeps the list of books of the present guide.json)
//        node scripts/build-guide.js --books    (asks IslamHouse again for the books)
//        node scripts/build-guide.js --menu     (copies menu.kids / menu.muslim of every www/guide/<lang>.json into www/i18n)
//        node scripts/build-guide.js --split DIR   (writes the English and Arabic texts in parts, for translators)
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const WWW = path.join(ROOT, "www");
const CACHE = path.join(ROOT, ".cache", "guide");
const HCACHE = path.join(ROOT, ".cache", "hadith");
const API_SHA = "df57907be35291c91ad6a6691180e22ca9920784"; // as in scripts/build-hadith-index.js
const HADITH = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@${API_SHA}`;
const QURAN = "https://api.quran.com/api/v4/quran/verses/imlaei";
const IH = "https://api3.islamhouse.com/v3/paV29H2gm56kvLPy"; // the public key from the IslamHouse API documentation
const { kids, steps, day, ui } = require("./guide-source.js");
const LANGS = fs.readdirSync(path.join(WWW, "i18n")).filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""));
const args = process.argv.slice(2);

const problems = [];
const bad = m => problems.push(m);
const readJson = f => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJson = (f, j, pretty) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, pretty ? JSON.stringify(j, null, 1) + "\n" : JSON.stringify(j)); };
async function getJson(url) {
  let last;
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
    catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
  }
  throw new Error(`${url}: ${last.message}`);
}
async function cached(file, get) {
  if (fs.existsSync(file)) return readJson(file);
  const j = await get(); writeJson(file, j); return j;
}

// ---------- verses ----------
const VERSES = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];
// Pause signs and the like that stick to the words of the imlaei text (as in scripts/build-arabic.js).
const cp = (...c) => String.fromCodePoint(...c);
const PAUSE = new RegExp("[" + cp(0x6D6) + "-" + cp(0x6DC) + cp(0x6DE) + cp(0x6E9) + cp(0x200F) + "]", "g");
async function verses(ref) {
  const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(ref); if (!m) { bad(`verse ${ref}: bad reference`); return null; }
  const s = +m[1], from = +m[2], to = +(m[3] || m[2]);
  if (!(s >= 1 && s <= 114) || from < 1 || to < from || to > VERSES[s - 1]) { bad(`verse ${ref}: no such verse`); return null; }
  const text = [];
  for (let a = from; a <= to; a++) {
    const j = await cached(path.join(CACHE, "q", `${s}-${a}.json`), () => getJson(`${QURAN}?verse_key=${s}:${a}`));
    const v = (j.verses || [])[0];
    if (!v || v.verse_key !== `${s}:${a}` || !v.text_imlaei) { bad(`verse ${s}:${a}: not in the answer`); return null; }
    text.push(v.text_imlaei.replace(PAUSE, "").replace(/\s+/g, " ").trim());
  }
  return { s, from, to, text };
}

// ---------- hadith ----------
const HBOOKS = readJson(path.join(WWW, "hadith", "index.json")).books;
const TASHKEEL = new RegExp("[" + cp(0x610) + "-" + cp(0x61A) + cp(0x64B) + "-" + cp(0x65F) + cp(0x670) + cp(0x6D6) + "-" + cp(0x6ED) + cp(0x640) + "]", "g");
const plain = s => String(s).replace(TASHKEEL, "").replace(/[ٱإأآ]/g, "ا").replace(/ى/g, "ي").replace(/[^ء-ي\s]/g, " ").replace(/\s+/g, " ").trim();
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
// The first hadith of the book holding the words, and the section the app's reader shows it in (as secOf in js/hadith.js).
async function hadith(book, words) {
  const b = HBOOKS.find(x => x.id === book); if (!b) { bad(`hadith ${book}: no such book`); return null; }
  const list = await edition(book), want = plain(words);
  const hits = list.filter(h => h.plain.includes(want));
  if (!hits.length) { bad(`hadith ${book} «${words}»: not found`); return null; }
  const h = hits[0];
  const sec = b.sections.find(s => s[0] === h.reference?.book) || b.sections.find(s => s[6]?.includes(h.hadithnumber));
  if (!sec) { bad(`hadith ${book} ${h.hadithnumber}: no section`); return null; }
  return { book, n: h.hadithnumber, sec: sec[0], hits: hits.length, text: h.text };
}

// ---------- the books of IslamHouse, per language ----------
// Each translation of a book is an item of its own there, with the Arabic title of the book: the categories are read
// whole and the wanted titles kept. For each interface language, the books it has, in the order below.
const BOOK_CATS = [179666, 398588]; // «ما يحتاجه المسلم الجديد», «شؤون الطفل»
// Titles are compared by their letters alone (the site writes some with other spaces or marks).
const WANT = {
  kids: [["ما لا يسع أطفال المسلمين جهله"], ["أسئلة الأطفال الإيمانية", "أسئلة الطفل الإيمانية"]],
  muslim: [["المختصر المفيد للمسلم الجديد"], ["دليل المسلم الجديد"], ["أسلمت حديثا فماذا أتعلم"], ["ما لا يسع المسلم جهله"]],
};
// Items filed there under a language they are not in (these two are Chichewa, filed as Swahili).
const SKIP = new Set([2847024, 2843162]);
// Titles as the site gives them, without direction marks and doubled spaces.
const BIDI = new RegExp("[" + cp(0x200E) + cp(0x200F) + cp(0x202A) + "-" + cp(0x202E) + cp(0x2066) + "-" + cp(0x2069) + "]", "g");
const title = s => String(s).replace(BIDI, "").replace(/\s+/g, " ").trim();
const letters = s => plain(s).split(" ").join("");
async function books() {
  const items = [];
  for (const cat of BOOK_CATS) {
    let url = `${IH}/main/get-category-items/${cat}/books/ar/showall/1/50/json`;
    for (let i = 0; url && i < 60; i++) {
      const j = await getJson(url);
      items.push(...(j.data || []).map(x => ({ id: x.id, l: x.source_language, t: String(x.title || "").trim() })));
      url = j.links?.next && j.links.next !== url ? j.links.next : null;
    }
  }
  const out = { kids: {}, muslim: {} };
  for (const [part, titles] of Object.entries(WANT)) for (const lang of LANGS) {
    const code = lang, list = [];
    for (const names of titles) {
      const x = items.find(i => i.l === code && !SKIP.has(i.id) && names.some(n => letters(n) === letters(i.t))); if (!x) continue;
      const j = await cached(path.join(CACHE, "ih", `${x.id}.json`), () => getJson(`${IH}/main/get-item/${x.id}/${code}/json`));
      const pdf = (j.attachments || []).find(a => a.extension_type === "PDF" && /^https:\/\/d1\.islamhouse\.com\/.+\.pdf$/i.test(a.url));
      if (!pdf || !j.title) continue;
      list.push({ id: x.id, t: title(j.title), url: pdf.url, size: pdf.size || "" });
    }
    if (list.length) out[part][lang] = list.slice(0, 3);
  }
  return out;
}

// ---------- the source, checked and split into structure and texts ----------
const hisn = readJson(path.join(WWW, "data", "hisn.json"));
const dhikr = new Map(hisn.categories.flatMap(c => c.items.map(i => [i.id, c.id])));
const i18nEn = readJson(path.join(WWW, "i18n", "en.json"));
const ROUTES = /^#\/(cat\/\d+(\?p=(morning|evening))?|prayer|qibla|quran|listen|hifz|qaida|arabic(\/surah\/\d+)?|asma|tasbih|hijri|hadith\/[a-z]+|muslim(\/day|\/step\/[a-z]+)?|kids)$/;
const ICONS = new Set([...fs.readFileSync(path.join(WWW, "index.html"), "utf8").matchAll(/id="i-([a-z0-9-]+)"/g)].map(m => m[1]));
const texts = { ar: {}, en: {} };
const put = (key, pair) => {
  if (!Array.isArray(pair) || pair.length !== 2 || pair.some(x => typeof x !== "string" || !x.trim())) { bad(`${key}: text must be [Arabic, English]`); return; }
  if (key in texts.ar) bad(`${key}: twice`);
  if (pair[0].split("\n").length !== pair[1].split("\n").length && !/\.p$/.test(key)) bad(`${key}: the Arabic and the English have different numbers of lines`);
  texts.ar[key] = pair[0]; texts.en[key] = pair[1];
};
const out = { verses: {}, hadith: [], hbooks: {} };
const table = [];
async function evidence(list, where) {
  const ev = [];
  for (const e of list || []) {
    const [kind, ...rest] = e.split(" ");
    if (kind === "q") { const v = await verses(rest[0]); if (v) { out.verses[rest[0]] = v; ev.push(["q", rest[0]]); } }
    else if (kind === "h") {
      const h = await hadith(rest[0], rest.slice(1).join(" ")); if (!h) continue;
      let i = out.hadith.findIndex(x => x[0] === h.book && x[1] === h.n);
      if (i < 0) { i = out.hadith.push([h.book, h.n, h.sec]) - 1; table.push(`  ${h.book} ${h.n} (${h.hits} with these words) «${rest.slice(1).join(" ")}»`); }
      const b = HBOOKS.find(x => x.id === h.book); out.hbooks[h.book] = [b.ar, b.en];
      ev.push(["h", i]);
    } else if (kind === "d") { const id = +rest[0]; if (!dhikr.has(id)) bad(`${where}: no dhikr ${id}`); else ev.push(["d", id]); }
    else bad(`${where}: unknown evidence «${e}»`);
  }
  return ev;
}
const links = (list, where) => (list || []).map(([href, key]) => {
  if (!ROUTES.test(href)) bad(`${where}: unknown address ${href}`);
  if (key.startsWith("@") ? !(key.slice(1) in ui) : !(key in i18nEn)) bad(`${where}: unknown label ${key}`);
  return [href, key];
});
const ids = (list, where) => { if (new Set(list.map(x => x.id)).size !== list.length || list.some(x => !/^[a-z][a-z0-9]*$/.test(x.id))) bad(`${where}: ids must be unique, of letters`); };
const prune = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== false && !(Array.isArray(v) && !v.length)));

async function main() {
  if (args[0] === "--menu") return menu();
  ids(kids, "kids"); ids(steps, "steps"); ids(day, "day");
  out.kids = [];
  for (const u of kids) {
    const k = `k.${u.id}`; put(`${k}.t`, u.t); put(`${k}.s`, u.s); ids(u.cards, k);
    if (!ICONS.has(u.icon)) bad(`${k}: no icon ${u.icon}`);
    const cards = [];
    for (const c of u.cards) {
      put(`${k}.${c.id}.q`, c.q); put(`${k}.${c.id}.a`, c.a); if (c.l) put(`${k}.${c.id}.l`, c.l);
      cards.push(prune({ id: c.id, l: !!c.l, ol: !!c.ol, ev: await evidence(c.ev, `${k}.${c.id}`), links: links(c.links, `${k}.${c.id}`) }));
    }
    u.quiz.forEach((z, i) => {
      put(`${k}.z${i + 1}.q`, z.q);
      if (z.o.length !== 3) bad(`${k}.z${i + 1}: three options expected`);
      z.o.forEach((o, j) => put(`${k}.z${i + 1}.${j}`, o));
    });
    out.kids.push({ id: u.id, icon: u.icon, cards, quiz: u.quiz.length });
  }
  out.steps = [];
  for (const s of steps) {
    const k = `m.${s.id}`; put(`${k}.t`, s.t); put(`${k}.s`, s.s); put(`${k}.todo`, s.todo); ids(s.secs, k);
    if (!ICONS.has(s.icon)) bad(`${k}: no icon ${s.icon}`);
    const secs = [];
    for (const x of s.secs) {
      put(`${k}.${x.id}.h`, x.h); if (x.p) put(`${k}.${x.id}.p`, x.p); if (x.l) put(`${k}.${x.id}.l`, x.l);
      if (!x.p && !x.l) bad(`${k}.${x.id}: no text`);
      secs.push(prune({ id: x.id, p: !!x.p, l: !!x.l, ol: !!x.ol, ev: await evidence(x.ev, `${k}.${x.id}`), links: links(x.links, `${k}.${x.id}`) }));
    }
    out.steps.push(prune({ id: s.id, icon: s.icon, secs, links: links(s.links, k) }));
  }
  out.day = day.map(p => {
    const k = `d.${p.id}`; put(`${k}.t`, p.t); ids(p.items, k);
    if (!ICONS.has(p.icon)) bad(`${k}: no icon ${p.icon}`);
    return { id: p.id, icon: p.icon, items: p.items.map(i => {
      put(`${k}.${i.id}.t`, i.t); if (i.x) put(`${k}.${i.id}.x`, i.x);
      if (![1, 2, 3].includes(i.lv)) bad(`${k}.${i.id}: level 1, 2 or 3`);
      if (i.href && !ROUTES.test(i.href)) bad(`${k}.${i.id}: unknown address ${i.href}`);
      return prune({ id: i.id, lv: i.lv, x: !!i.x, href: i.href });
    }) };
  });
  for (const [k, v] of Object.entries(ui)) put(k, v);
  // {placeholders} must be the same in both languages.
  const holes = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");
  for (const k of Object.keys(texts.en)) if (holes(texts.ar[k]) !== holes(texts.en[k])) bad(`${k}: placeholders differ`);

  const file = path.join(WWW, "data", "guide.json");
  const old = fs.existsSync(file) ? readJson(file) : {};
  out.books = args.includes("--books") || !old.books ? await books() : old.books;
  if (problems.length) { console.error(problems.map(p => "✗ " + p).join("\n")); process.exit(1); }

  writeJson(file, { source: "scripts/guide-source.js", langs: LANGS.filter(l => l === "ar" || l === "en" || fs.existsSync(path.join(WWW, "guide", l + ".json"))), ...out });
  writeJson(path.join(WWW, "guide", "ar.json"), texts.ar, true); writeJson(path.join(WWW, "guide", "en.json"), texts.en, true);
  if (args[0] === "--split") split(args[1]);
  const words = Object.values(texts.en).join(" ").split(/\s+/).length;
  console.log(`✓ ${out.kids.length} units (${out.kids.reduce((n, u) => n + u.cards.length, 0)} cards, ${out.kids.reduce((n, u) => n + u.quiz, 0)} quiz questions), ${out.steps.length} steps, ${out.day.reduce((n, p) => n + p.items.length, 0)} day items`);
  console.log(`  ${Object.keys(texts.en).length} texts (${words} English words), ${Object.keys(out.verses).length} verse references, ${out.hadith.length} hadith:`);
  console.log(table.join("\n"));
  console.log(`  books: kids in ${Object.keys(out.books.kids).length} languages, new Muslims in ${Object.keys(out.books.muslim).length}`);
  const missing = LANGS.filter(l => !fs.existsSync(path.join(WWW, "guide", l + ".json")));
  if (missing.length) console.log(`  not translated yet: ${missing.join(" ")}`);
}

// The texts in parts (kids, steps, the rest), English and Arabic side by side for the translators.
function split(dir) {
  const part = k => k.startsWith("k.") ? "kids" : k.startsWith("m.") ? "muslim" : "ui";
  for (const name of ["kids", "muslim", "ui"]) for (const l of ["en", "ar"])
    writeJson(path.join(dir, `${name}.${l}.json`), Object.fromEntries(Object.entries(texts[l]).filter(([k]) => part(k) === name)), true);
}

// The two names of the menu live with the interface strings: copied from each language's texts, after its last key.
function menu() {
  for (const l of LANGS) {
    const g = path.join(WWW, "guide", l + ".json"); if (!fs.existsSync(g)) { console.log(`- ${l}: no texts yet`); continue; }
    const t = readJson(g), f = path.join(WWW, "i18n", l + ".json"); let s = fs.readFileSync(f, "utf8");
    const eol = s.includes("\r\n") ? "\r\n" : "\n", have = JSON.parse(s);
    const add = [["kids.title", t["menu.kids"]], ["muslim.title", t["menu.muslim"]]].filter(([k, v]) => v && !(k in have));
    if (!add.length) continue;
    const end = s.lastIndexOf("}"), body = s.slice(0, end).replace(/\s+$/, "");
    const indent = (/\n([ \t]+)"/.exec(s) || [, "  "])[1];
    s = body + add.map(([k, v]) => `,${eol}${indent}${JSON.stringify(k)}: ${JSON.stringify(v)}`).join("") + eol + "}" + s.slice(end + 1);
    JSON.parse(s); fs.writeFileSync(f, s); console.log(`✓ ${l}: ${add.map(a => a[0]).join(", ")}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
