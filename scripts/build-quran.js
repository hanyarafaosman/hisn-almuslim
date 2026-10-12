// Builds the Mushaf data (8 riwayat) from the King Fahd Glorious Quran Printing Complex (KFGQPC) packages.
// - Downloads each file from a pinned commit of a mirror of the KFGQPC developer packages.
// - Verifies SHA-256 of every file before use, so the Quran text cannot silently change.
// - Writes the Quran text VERBATIM (only the UTF-8 BOM is removed). Nothing in aya_text is edited.
// Usage: node scripts/build-quran.js
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "kfgqpc");
const OUT = path.join(ROOT, "www", "quran");
const COMMIT = "25f2f8886d6ad0b47190f252d9d7fb1e296f3231";
const BASE = `https://raw.githubusercontent.com/ibnhazm/KFGQPC/${COMMIT}/`;

// mp3quran.net rewaya ids that match each text riwayah (used to suggest reciters in the reader).
const RIWAYAT = [
  { id: "hafs", name: "حفص عن عاصم", short: "حفص", version: "18", audio: [1],
    data: ["hafs/data/hafsData_v18.json", "5d8bb91726e482839d0057633cb1973031e4d706fa9604eea5e08892f20ba140"],
    font: ["hafs/font/hafs.18.woff2", "8c00e7a7d5f773bcfb1642fdcfba505dbd81975fef39f14718827a32d075020c"] },
  { id: "shouba", name: "شعبة عن عاصم", short: "شعبة", version: "8", audio: [15],
    data: ["shouba/data/ShoubaData08.json", "f105da3949e0b8092e3abcd23a539c9bef4c9b7474f15d29848471f150ade667"],
    font: ["shouba/font/shouba.8.woff2", "b719eb17a4253428f9f14c4a740a4fccf254bdffa57ab6d73e0ab3908b133d16"] },
  { id: "warsh", name: "ورش عن نافع", short: "ورش", version: "10", audio: [2, 18, 10],
    data: ["warsh/data/warshData_v10.json", "f05d0dc652fd46b38563cacb13242f76f80db4cc64d25873da0bce157253872f"],
    font: ["warsh/font/warsh.10.woff2", "d6e21b46de4bc42dae9218749830cb4cb54ff815e67c66002001219a175b71d7"] },
  { id: "qaloon", name: "قالون عن نافع", short: "قالون", version: "10", audio: [5, 8],
    data: ["qaloon/data/QaloonData_v10.json", "18465c40ebeec40a92eb98745c9b89796ac6e31f6e93988883dfb6602faaea95"],
    font: ["qaloon/font/qaloon.10.woff2", "7be998fcf0632c454a70be0d6efbc02c38fa9b12fec629b8b1509364004505bb"] },
  { id: "doori", name: "الدوري عن أبي عمرو", short: "الدوري", version: "9", audio: [13],
    data: ["doori/data/DooriData_v09.json", "169b949d6cedd93ddb21728c16057d5ac7faf673ac10e0f213bb5dec1dc90d7d"],
    font: ["doori/font/doori.9.woff2", "9493f78cf8ceabd7179235c8a1dc454e5c91cc0c6bc2b37ee53903985f52dbbf"] },
  { id: "soosi", name: "السوسي عن أبي عمرو", short: "السوسي", version: "9", audio: [7],
    data: ["soosi/data/SoosiData09.json", "81af638398efa88308803c06a961d7019daf2e87e822b8acae24df05a82aa81b"],
    font: ["soosi/font/soosi.9.woff2", "08ff621f2e535ebea1e5799569a5bd7ffb4d447d638a4e4b206864837dff8bc9"] },
  { id: "bazzi", name: "البزي عن ابن كثير", short: "البزي", version: "7", audio: [4, 11],
    data: ["bazzi/data/BazziData_v07.json", "2ff11a126e0f15f161b88f83528c0b11d24f69f474baabf02d8864cd93ed15ce"],
    font: ["bazzi/font/bazzi.7.woff2", "a44c1827efdc90f5ac99a0e4cc499fcccee64d9f350ffdad1ca69bd7b16de331"] },
  { id: "qumbul", name: "قنبل عن ابن كثير", short: "قنبل", version: "7", audio: [6, 11],
    data: ["qumbul/data/QumbulData_v07.json", "3a0377bd943def12711b15cc71a65214fb902a5df70240b87df13c7b516a7888"],
    font: ["qumbul/font/qumbul.7.woff2", "53976291f4c9f3714338260bd2e64b12d1667ca2d8d8b234b4de74eeff9d363b"] },
];

const sha256 = buf => crypto.createHash("sha256").update(buf).digest("hex");
async function getVerified([rel, hash]) {
  const file = path.join(CACHE, rel);
  let buf = fs.existsSync(file) ? fs.readFileSync(file) : null;
  if (!buf || sha256(buf) !== hash) {
    process.stdout.write(`  ↓ ${rel}\n`);
    const res = await fetch(BASE + rel);
    if (!res.ok) throw new Error(`download failed ${rel}: HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf);
  }
  const got = sha256(buf);
  if (got !== hash) throw new Error(`SHA-256 mismatch for ${rel}\n  expected ${hash}\n  got      ${got}`);
  return buf;
}

const AYA_NUM = /[\s ]*[٠-٩]+[\s ]*$/; // trailing aya number (rendered as the aya mark by the font)

(async () => {
  fs.mkdirSync(path.join(OUT, "fonts"), { recursive: true });
  const index = {
    source: "مجمع الملك فهد لطباعة المصحف الشريف",
    sourceUrl: "https://qurancomplex.gov.sa/techquran/dev/",
    mirror: `https://github.com/ibnhazm/KFGQPC/tree/${COMMIT}`,
    built: new Date().toISOString().slice(0, 10),
    riwayat: [],
  };
  for (const r of RIWAYAT) {
    console.log(`• ${r.name}`);
    const rows = JSON.parse((await getVerified(r.data)).toString("utf8").replace(/^﻿/, ""));
    const fontBuf = await getVerified(r.font);
    fs.writeFileSync(path.join(OUT, "fonts", `${r.id}.woff2`), fontBuf);

    const so = x => x.sura_no ?? x.sora_no ?? x.sora;
    const surahs = Array.from({ length: 114 }, () => []);
    const emlaey = Array.from({ length: 114 }, () => []);
    const names = Array(114).fill(null);
    const juzStart = {};
    for (const x of rows) {
      const s = so(x), i = s - 1;
      if (!(s >= 1 && s <= 114)) throw new Error(`bad sura number in ${r.id}: ${s}`);
      if (x.aya_no !== surahs[i].length + 1) throw new Error(`non-contiguous aya ${r.id} ${s}:${x.aya_no}`);
      const page = parseInt(String(x.page), 10);
      surahs[i].push([x.aya_text, page, x.jozz]);
      if (x.aya_text_emlaey != null) emlaey[i].push(x.aya_text_emlaey);
      names[i] = names[i] || String(x.sura_name_ar ?? x.sora_name_ar).trim();
      if (!juzStart[x.jozz]) juzStart[x.jozz] = [s, x.aya_no];
    }
    if (surahs.some(a => !a.length)) throw new Error(`missing surah in ${r.id}`);

    // Basmala in this riwayah's own orthography: either Al-Fatiha aya 1 (riwayat that count it)
    // or the identical phrase inside An-Naml 27:30. Taken verbatim from the data.
    const f1 = surahs[0][0][0];
    const basmalaIsAya = /^\s*بِسۡمِ|^\s*بِسْمِ/.test(f1);
    const naml30 = surahs[26][29][0];
    const at = naml30.search(/بِسۡمِ|بِسْمِ/);
    if (at < 0) throw new Error(`basmala not found in 27:30 for ${r.id}`);
    const basmala = naml30.slice(at).replace(AYA_NUM, "").trim();

    const out = { id: r.id, s: surahs };
    if (emlaey[0].length) out.e = emlaey;
    fs.writeFileSync(path.join(OUT, `${r.id}.json`), JSON.stringify(out));

    index.riwayat.push({
      id: r.id, name: r.name, short: r.short, version: r.version, audio: r.audio,
      font: `quran/fonts/${r.id}.woff2`, data: `quran/${r.id}.json`,
      ayat: rows.length, basmala, basmalaIsAya,
      surahs: surahs.map((a, i) => [names[i], a.length, a[0][1]]),
      juz: Array.from({ length: 30 }, (_, j) => juzStart[j + 1]),
      sha256: { data: r.data[1], font: r.font[1] },
    });
    const kb = (fs.statSync(path.join(OUT, `${r.id}.json`)).size / 1024).toFixed(0);
    console.log(`  ✓ ${rows.length} آية · ${kb} KB · البسملة ضمن الفاتحة: ${basmalaIsAya ? "نعم" : "لا"} · ${basmala}`);
  }
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index));
  console.log(`\n✓ wrote ${path.relative(ROOT, OUT)}/index.json (${index.riwayat.length} riwayat)`);
})().catch(e => { console.error("✗", e.message); process.exit(1); });
