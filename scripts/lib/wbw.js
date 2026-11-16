// The Quran word by word from the Quran.com API (api.quran.com/api/v4), with each word's meaning in one language:
// every word of every verse in reading order, as [position, text in the usual spelling (imlaei), Uthmani text,
// meaning, transliteration]. Quran.com has word meanings in eight languages (WBW_LANGS); asked for any other, it
// answers in English. Fetched once per surah and language into a cache folder (cache/<lang>/<surah>.json).
// Used by scripts/build-arabic.js.
const fs = require("fs"), path = require("path");
const API = "https://api.quran.com/api/v4/verses/by_chapter";
const WBW_LANGS = ["en", "ur", "id", "bn", "tr", "fa", "hi", "ta"];
const VERSES = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6];

async function getJson(url) {
  let last;
  for (let i = 0; i < 5; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
    catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
  }
  throw new Error(`${url}: ${last.message}`);
}

// One surah in one language: [[verse, [[pos, imlaei, uthmani, meaning, translit], …]], …], cached.
async function surah(cache, lang, s) {
  const file = path.join(cache, lang, `${s}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const out = [];
  for (let page = 1; ; page++) {
    const j = await getJson(`${API}/${s}?words=true&language=${lang}&word_fields=text_imlaei,text_uthmani&fields=verse_key&per_page=50&page=${page}`);
    for (const v of j.verses) {
      const a = +v.verse_key.split(":")[1];
      const words = v.words.filter(w => w.char_type_name === "word").map(w => {
        const got = w.translation && w.translation.language_name;
        return [w.position, w.text_imlaei, w.text_uthmani, (w.translation && w.translation.text || "").trim(), (w.transliteration && w.transliteration.text || "").trim(), got];
      });
      out.push([a, words]);
    }
    if (!j.pagination || page >= j.pagination.total_pages) break;
  }
  if (out.length !== VERSES[s - 1] || out.some(([a], i) => a !== i + 1)) throw new Error(`surah ${s} (${lang}): ${out.length} verses, ${VERSES[s - 1]} expected`);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(out));
  return out;
}

// The whole Quran in one language, fetched a few surahs at a time.
async function quran(cache, lang, onSurah) {
  const all = new Array(114), queue = Array.from({ length: 114 }, (_, i) => i + 1);
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) { const s = queue.shift(); all[s - 1] = await surah(cache, lang, s); if (onSurah) onSurah(s); }
  }));
  return all;
}

module.exports = { WBW_LANGS, VERSES, surah, quran };
