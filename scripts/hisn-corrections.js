// Corrections applied on top of the hisnmuslim.com data (www/data/hisn.json). Idempotent: safe to re-run.
// Only metadata is corrected (repeat counts, morning/evening applicability). The dhikr text is never changed.
// Usage: node scripts/hisn-corrections.js
const fs = require("fs"), path = require("path");
const FILE = path.join(__dirname, "..", "www", "data", "hisn.json");
const db = JSON.parse(fs.readFileSync(FILE, "utf8"));

// The source API gives REPEAT = 1 although the text itself states the count.
const REPEAT = {
  83: 7,    // أذكار الصباح والمساء: «حسبي الله لا إله إلا هو...» (سبع مرات)
  106: 100, // أذكار النوم: سبحان الله ٣٣ + الحمد لله ٣٣ + الله أكبر ٣٤
  130: 3,   // دعاء من خاف ظلم السلطان: «الله أكبر، الله أعز من خلقه جميعًا...» (ثلاث مرات)
  148: 7,   // الدعاء للمريض: «أسأل الله العظيم رب العرش العظيم أن يشفيك» (سبع مرات)
};

let changed = 0;
for (const c of db.categories) for (const i of c.items) {
  if (REPEAT[i.id] && i.repeat !== REPEAT[i.id]) { i.repeat = REPEAT[i.id]; changed++; }
  // Morning and evening chapter: an instruction such as "(مائة مرة إذا أصبح)" limits the dhikr to one period.
  // Bracketed notes like "[وإذا أمسى قال: ...]" are alternate wording for the evening and do not limit it.
  if (c.id === 27) {
    const notes = [...i.text.matchAll(/\(([^()]*)\)(?![^[]*\])/g)].map(m => m[1].replace(/[ً-ْ]/g, ""));
    const when = notes.some(n => /إذا أصبح/.test(n)) ? "morning" : notes.some(n => /إذا أمسى/.test(n)) ? "evening" : undefined;
    if (when && i.when !== when) { i.when = when; changed++; }
  }
}
fs.writeFileSync(FILE, JSON.stringify(db));
const c27 = db.categories.find(c => c.id === 27);
console.log(`✓ ${changed} correction(s) applied`);
console.log("  morning only:", c27.items.filter(i => i.when === "morning").map(i => i.id).join(", ") || "none");
console.log("  evening only:", c27.items.filter(i => i.when === "evening").map(i => i.id).join(", ") || "none");
