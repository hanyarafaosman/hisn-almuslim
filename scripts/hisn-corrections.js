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
// Evening wording. The book prints the morning text and notes the evening change in brackets,
// e.g. "[وإذا أمسى قال: أمسينا وأمسى الملك لله]". The evening text is the morning text with exactly
// the words those notes give (vocalized), and without the notes. Each note is checked word by word below.
const EVENING = {
  77: [["أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ،", "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ،"],
       ["رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ،",
        "رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا،"]],
  78: [["اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ",
        "اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ"]],
  80: [["اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ", "اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ"]],
  81: [["اللَّهُمَّ مَا أَصْبَحَ بِي", "اللَّهُمَّ مَا أَمْسَى بِي"]],
  89: [["أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ رَبِّ الْعَالَمِينَ،", "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ رَبِّ الْعَالَمِينَ،"],
       ["خَيْرَ هَذَا الْيَوْمِ:فَتْحَهُ، وَنَصْرَهُ، وَنورَهُ، وَبَرَكَتَهُ، وَهُدَاهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهِ وَشَرِّ مَا بَعْدَهُ",
        "خَيْرَ هَذِهِ اللَّيْلَةِ: فَتْحَهَا، وَنَصْرَهَا، وَنُورَهَا، وَبَرَكَتَهَا، وَهُدَاهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهَا وَشَرِّ مَا بَعْدَهَا"]],
  90: [["أَصْبَحْنا عَلَى فِطْرَةِ", "أَمْسَيْنَا عَلَى فِطْرَةِ"]],
};
const EVENING_NOTE = /\s*\[\s*وإذا أمسى قال:[^\]]*\]/g;
// Letters only, so the vocalized evening text can be compared with the book's unvocalized note.
const letters = s => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/ـ/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\p{L}]/gu, "");
const c27 = db.categories.find(c => c.id === 27);
for (const [id, swaps] of Object.entries(EVENING)) {
  const item = c27.items.find(i => i.id === Number(id));
  let ev = item.text;
  for (const [from, to] of swaps) {
    if (!ev.includes(from)) throw new Error(`evening ${id}: morning words not found: ${from}`);
    ev = ev.replace(from, to);
  }
  ev = ev.replace(EVENING_NOTE, "").trim();
  // Every evening note in the book must appear, letter for letter, in the evening text ("..." = the rest is unchanged).
  for (const m of item.text.matchAll(/\[\s*وإذا أمسى قال:([^\]]*)\]/g)) {
    const note = letters(m[1].replace(/\.\.\.|…/g, ""));
    if (!letters(ev).includes(note)) throw new Error(`evening ${id}: note not matched: ${m[1]}`);
  }
  if (item.evening !== ev) { item.evening = ev; changed++; }
}
fs.writeFileSync(FILE, JSON.stringify(db));
console.log(`✓ ${changed} correction(s) applied`);
console.log("  morning only:", c27.items.filter(i => i.when === "morning").map(i => i.id).join(", ") || "none");
console.log("  evening only:", c27.items.filter(i => i.when === "evening").map(i => i.id).join(", ") || "none");
