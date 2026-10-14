// Builds www/tafsir/index.json: the tafsir books the app offers, with how each book groups the verses.
// Tafsir texts are not copied: the app loads them from their sources.
//   - QuranEnc.com API: al-Muyassar (King Fahd Complex) and al-Mukhtasar (Tafsir Center), one file per surah.
//   - spa5k/tafsir_api (MIT, from the Quranic Universal Library of Tarteel/Quran.com) pinned to a release
//     commit on jsDelivr, so its files never change: one file per surah and one per verse.
// Some books explain several verses together; the source then repeats the same text under each verse.
// Those runs are recorded here ("groups"), with the verses a book has no entry for ("missing"),
// so the app can say "explanation of verses 8–9" and never shows a neighbour's text as if it were the verse's own.
// Usage: node scripts/build-tafsir-index.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "tafsir");
const OUT = path.join(ROOT, "www", "tafsir", "index.json");
const QE = "https://quranenc.com/api/v1";
const SPA5K_TAG = "v1.2.2", SPA5K_SHA = "eb82bb6294efe30ad5c135c03b1864afaa70e855";
const SPA5K = `https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@${SPA5K_SHA}/tafsir`;

// Ordered from the shortest to the longest. len: short | medium | long (shown to the reader).
const BOOKS = [
  { id: "muyassar", src: "qe", key: "arabic_moyassar", len: "short", short: "الميسر", shortEn: "Muyassar",
    ar: "التفسير الميسر", en: "Al-Tafsir al-Muyassar",
    by: "نخبة من أساتذة التفسير، مجمع الملك فهد لطباعة المصحف الشريف", byEn: "Scholars of tafsir, King Fahd Glorious Quran Printing Complex" },
  { id: "mokhtasar", src: "qe", key: "arabic_mokhtasar", len: "short", short: "المختصر", shortEn: "Mukhtasar",
    ar: "المختصر في تفسير القرآن الكريم", en: "Al-Mukhtasar fi Tafsir al-Quran",
    by: "مركز تفسير للدراسات القرآنية", byEn: "Tafsir Center for Quranic Studies" },
  // The Quran.com edition of as-Saʿdi (ar-tafseer-al-saddi) is cut and shifted (2:106 is spread over 106, 108
  // and 110): this is the edition taken from the printed book, which follows the book's own verse ranges ({106}…).
  // Its lines break where the printed lines did, so the app joins lines that do not end a sentence (lines: "join").
  { id: "saadi", src: "spa5k", key: "ar-tafsir-as-saadi", len: "medium", lines: "join", short: "السعدي", shortEn: "as-Saʿdi",
    ar: "تيسير الكريم الرحمن (تفسير السعدي)", en: "Tafsir as-Saʿdi",
    by: "عبد الرحمن بن ناصر السعدي (ت ١٣٧٦هـ)", byEn: "ʿAbd al-Rahman ibn Nasir as-Saʿdi (d. 1376 AH)" },
  { id: "baghawi", src: "spa5k", key: "ar-tafsir-al-baghawi", len: "long", short: "البغوي", shortEn: "al-Baghawi",
    ar: "معالم التنزيل (تفسير البغوي)", en: "Tafsir al-Baghawi",
    by: "الحسين بن مسعود البغوي (ت ٥١٦هـ)", byEn: "al-Husayn ibn Masʿud al-Baghawi (d. 516 AH)" },
  { id: "ibnkathir", src: "spa5k", key: "ar-tafsir-ibn-kathir", len: "long", short: "ابن كثير", shortEn: "Ibn Kathir",
    ar: "تفسير القرآن العظيم (تفسير ابن كثير)", en: "Tafsir Ibn Kathir",
    by: "إسماعيل بن عمر بن كثير (ت ٧٧٤هـ)", byEn: "Ismaʿil ibn ʿUmar ibn Kathir (d. 774 AH)" },
  { id: "qurtubi", src: "spa5k", key: "ar-tafseer-al-qurtubi", len: "long", short: "القرطبي", shortEn: "al-Qurtubi",
    ar: "الجامع لأحكام القرآن (تفسير القرطبي)", en: "Tafsir al-Qurtubi",
    by: "محمد بن أحمد القرطبي (ت ٦٧١هـ)", byEn: "Muhammad ibn Ahmad al-Qurtubi (d. 671 AH)" },
  { id: "tabari", src: "spa5k", key: "ar-tafsir-al-tabari", len: "long", short: "الطبري", shortEn: "at-Tabari",
    ar: "جامع البيان عن تأويل آي القرآن (تفسير الطبري)", en: "Tafsir al-Tabari",
    by: "محمد بن جرير الطبري (ت ٣١٠هـ)", byEn: "Muhammad ibn Jarir al-Tabari (d. 310 AH)" },
];

// Where a source put the start of a surah's tafsir at the end of the previous surah, or the end of a surah's
// tafsir at the start of the next one. Each fix names the verse entry, a text that marks the cut (compared
// without diacritics, and found exactly once), and where the cut-off part belongs:
//   tail: the text from the mark on belongs at the start of [toS, toA]
//   head: the text before the mark belongs at the end of [toS, toA]
// Only the place of the text changes; the app shows every word of the source.
const FIXES = {
  ibnkathir: [
    { s: 2, a: 1, mark: "[بسم الله الرحمن الرحيم] [[زيادة من ج، ط.]]", head: [1, 7] },
    { s: 28, a: 85, mark: "تفسير سورة العنكبوت", tail: [29, 1] },
    { s: 35, a: 44, mark: "تفسير سورة يس", tail: [36, 1] },
    { s: 66, a: 11, mark: "تفسير سورة الملك", tail: [67, 1] },
  ],
  baghawi: [
    { s: 14, a: 1, mark: "سورة إبراهيم\n", head: [13, 43] },
    { s: 28, a: 1, mark: "سورة القصص\n", head: [27, 93] },
    { s: 75, a: 1, mark: "سورة القيامة مكية", head: [74, 56] },
  ],
  tabari: [
    { s: 16, a: 128, mark: "تفسير سورة الإسراء", tail: [17, 1] },
    { s: 28, a: 87, mark: "تفسير سورة العنكبوت", tail: [29, 1] },
    { s: 73, a: 20, mark: "تفسير سورة المدثر", tail: [74, 1] },
  ],
};
const ch = (...cps) => String.fromCodePoint(...cps);
const DIAC = new RegExp("[" + ch(0x64B) + "-" + ch(0x65F) + ch(0x670) + ch(0x640) + "]"); // tashkeel, dagger alef, tatweel
// Position in the original text of the one place where `mark` occurs once diacritics are ignored.
function markAt(text, mark) {
  const pos = []; let plain = "";
  for (let i = 0; i < text.length; i++) if (!DIAC.test(text[i])) { pos.push(i); plain += text[i]; }
  const at = plain.indexOf(mark);
  if (at < 0 || plain.indexOf(mark, at + 1) >= 0) return -1;
  return pos[at];
}

async function cached(name, url) {
  const file = path.join(CACHE, name);
  if (!fs.existsSync(file)) {
    let last;
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        const buf = Buffer.from(await r.arrayBuffer()); JSON.parse(buf.toString("utf8")); // must be complete JSON
        fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf);
        last = null; break;
      } catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
    }
    if (last) throw last;
  }
  return { json: JSON.parse(fs.readFileSync(file, "utf8")), bytes: fs.statSync(file).size };
}
const cachedRows = (key, s) => { const j = JSON.parse(fs.readFileSync(path.join(CACHE, key, `${s}.json`), "utf8")); return Array.isArray(j) ? j : j.ayahs || []; };
async function each(list, n, fn) { let next = 0; await Promise.all(Array.from({ length: n }, async () => { while (next < list.length) { const i = next++; await fn(list[i], i); } })); }

(async () => {
  // Verse counts per surah: the Hafs (Kufan) count, which both sources follow.
  const hafs = JSON.parse(fs.readFileSync(path.join(ROOT, "www", "quran", "index.json"), "utf8")).riwayat.find(r => r.id === "hafs");
  const counts = hafs.surahs.map(s => s[1]);
  const out = []; const problems = [];
  for (const b of BOOKS) {
    process.stdout.write(`• ${b.id} `);
    const book = { id: b.id, src: b.src, key: b.key, len: b.len, ar: b.ar, en: b.en, short: b.short, shortEn: b.shortEn, by: b.by, byEn: b.byEn, bytes: 0 };
    const groups = {}, missing = {};
    await each(counts.map((c, i) => i + 1), 8, async s => {
      const n = counts[s - 1];
      if (b.src === "qe") {
        const { json, bytes } = await cached(`${b.key}/${s}.json`, `${QE}/translation/sura/${b.key}/${s}`);
        book.bytes += bytes;
        const ayat = (json.result || []).map(r => Number(r.aya));
        const empty = (json.result || []).filter(r => !String(r.translation || "").trim()).map(r => Number(r.aya));
        if (ayat.length !== n || ayat.some((a, i) => a !== i + 1)) problems.push(`${b.id} ${s}: ${ayat.length} verses, expected ${n}`);
        if (empty.length) problems.push(`${b.id} ${s}: empty ${empty.join(",")}`);
      } else {
        const { json, bytes } = await cached(`${b.key}/${s}.json`, `${SPA5K}/${b.key}/${s}.json`);
        book.bytes += bytes;
        const rows = (Array.isArray(json) ? json : json.ayahs || []).filter(r => String(r.text || "").trim());
        if (rows.some(r => Number(r.surah) !== s)) problems.push(`${b.id} ${s}: rows of another surah`);
        const ayat = rows.map(r => Number(r.ayah));
        if (ayat.some((a, i) => !(a >= 1 && a <= n) || (i && a <= ayat[i - 1]))) problems.push(`${b.id} ${s}: verse numbers out of order or range`);
        const has = new Set(ayat); const miss = []; for (let a = 1; a <= n; a++) if (!has.has(a)) miss.push(a);
        if (miss.length) missing[s] = miss;
        // Runs of consecutive verses with the same text: one explanation of several verses.
        const runs = []; let i = 0;
        while (i < rows.length) {
          let j = i; while (j + 1 < rows.length && rows[j + 1].text === rows[i].text && Number(rows[j + 1].ayah) === Number(rows[j].ayah) + 1) j++;
          if (j > i) runs.push([Number(rows[i].ayah), Number(rows[j].ayah)]);
          i = j + 1;
        }
        if (runs.length) groups[s] = runs;
        // The same text again further away would be a source error worth knowing about.
        const seen = new Map(); rows.forEach(r => { const prev = seen.get(r.text); if (prev != null && Number(r.ayah) !== prev + 1 && !runs.some(([x, y]) => Number(r.ayah) >= x && Number(r.ayah) <= y)) problems.push(`${b.id} ${s}:${r.ayah} repeats the text of ${s}:${prev}`); seen.set(r.text, Number(r.ayah)); });
      }
    });
    if (b.src === "spa5k") {
      const sorted = o => Object.fromEntries(Object.keys(o).map(Number).sort((x, y) => x - y).map(k => [k, o[k]]));
      book.groups = sorted(groups); book.missing = sorted(missing);
      if (b.lines) book.lines = b.lines;
      // A fix applies to a whole entry: it must start a group of verses. The moved text joins the group of its verse.
      const heads = (s, a) => !(groups[s] || []).some(([x, y]) => a > x && a <= y);
      const headOf = (s, a) => ((groups[s] || []).find(([x, y]) => a >= x && a <= y) || [a])[0];
      const moves = (FIXES[b.id] || []).map(f => {
        const row = cachedRows(b.key, f.s).find(r => Number(r.ayah) === f.a);
        const at = row ? markAt(row.text, f.mark) : -1;
        const [toS, verse] = f.tail || f.head; const toA = headOf(toS, verse);
        if (at <= 0 || !heads(f.s, f.a)) throw new Error(`${b.id}: fix at ${f.s}:${f.a} (${JSON.stringify(f.mark)}) no longer fits the source`);
        return [f.s, f.a, at, f.tail ? "tail" : "head", toS, toA];
      });
      if (moves.length) book.moves = moves;
      const g = Object.values(groups).flat().length, m = Object.values(missing).flat().length;
      console.log(`${(book.bytes / 1048576).toFixed(1)} MB, ${g} groups of verses, ${m} verses without an entry`);
    } else console.log(`${(book.bytes / 1048576).toFixed(1)} MB`);
    out.push(book);
  }
  const index = {
    built: "scripts/build-tafsir-index.js",
    sources: {
      qe: { api: QE, name: "QuranEnc.com" },
      spa5k: { cdn: SPA5K, tag: SPA5K_TAG, name: "spa5k/tafsir_api", from: "Quranic Universal Library (qul.tarteel.ai)" },
    },
    books: out,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(index) + "\n");
  if (problems.length) console.log(`\n${problems.length} note(s) about the sources:\n  ` + problems.sort().slice(0, 40).join("\n  "));
  console.log(`\n✓ ${path.relative(ROOT, OUT)}: ${out.length} books, ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);
})().catch(e => { console.error(e); process.exit(1); });
