// Fetches the official English translation of Hisn al-Muslim from hisnmuslim.com and aligns it
// with the Arabic data by chapter ID and dhikr ID. Text is kept verbatim (whitespace trimmed only).
// Usage: node scripts/build-hisn-en.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const AR = JSON.parse(fs.readFileSync(path.join(ROOT, "www/data/hisn.json"), "utf8"));
const OUT = path.join(ROOT, "www/data/hisn.en.json");
const API = "https://www.hisnmuslim.com/api/en/";
const strip = s => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
const clean = s => String(s ?? "").replace(/\s+/g, " ").trim();
// Some source files leave the chapter-name key unterminated: {"What to say ...:<newline>[ ... ]
const closeKey = s => s.replace(/^(\s*\{\s*"[^"\r\n]*?)\s*(\r?\n\s*\[)/, (m, key, rest) => key + '":' + rest);
// Source files also contain raw tabs/newlines inside strings: turn every control character into a space.
const noControls = s => [...s].map(c => c.charCodeAt(0) < 32 ? " " : c).join("");

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status);
      return JSON.parse(noControls(closeKey(strip(await r.text()))));
    } catch (e) {
      if (i === 2) throw new Error(`${url}: ${e.message}`);
      await new Promise(r => setTimeout(r, 800));
    }
  }
}

(async () => {
  const index = (await get(API + "husn_en.json")).English;
  const titles = {}; const items = {}; const problems = [];
  const arCats = new Map(AR.categories.map(c => [c.id, c]));
  await Promise.all(index.map(async c => {
    const ar = arCats.get(c.ID); if (!ar) { problems.push(`EN chapter ${c.ID} has no Arabic match`); return; }
    titles[c.ID] = clean(c.TITLE);
    const j = await get(API + c.ID + ".json"); const list = j[Object.keys(j)[0]];
    const arIds = new Set(ar.items.map(i => i.id));
    for (const it of list) {
      if (!arIds.has(it.ID)) { problems.push(`EN item ${c.ID}:${it.ID} has no Arabic match`); continue; }
      const t = clean(it.TRANSLATED_TEXT), n = clean(it.LANGUAGE_ARABIC_TRANSLATED_TEXT);
      if (t || n) items[it.ID] = n ? { t, n } : { t };
    }
  }));
  const missingTitles = AR.categories.filter(c => !titles[c.id]).map(c => c.id);
  const missingItems = AR.categories.flatMap(c => c.items.filter(i => !items[i.id]).map(i => `${c.id}:${i.id}`));
  fs.writeFileSync(OUT, JSON.stringify({ source: "https://www.hisnmuslim.com/api/en/husn_en.json", fetched: new Date().toISOString().slice(0, 10), titles, items }));
  console.log(`✓ ${Object.keys(titles).length} chapter titles, ${Object.keys(items).length} translated adhkar → ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
  if (missingTitles.length) console.log("  missing titles:", missingTitles.join(","));
  if (missingItems.length) console.log("  adhkar without translation:", missingItems.length, missingItems.slice(0, 20).join(" "));
  if (problems.length) console.log("  problems:", problems.join("; "));
})().catch(e => { console.error("✗", e.message); process.exit(1); });
