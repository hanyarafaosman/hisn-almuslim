// What the comparison of the riwayat (www/js/qdiff.js) finds over the whole Quran: for every riwayah against Hafs, how
// many words fall in each class, and the pairs met most often in each, so a change to the keys shows at once what it
// hides or invents. Usage: node scripts/check-qiraat.mjs [riwayah …]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compare } from "../www/js/qdiff.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, "www", "quran", f), "utf8"));
const index = read("index.json");
const hafs = read("hafs.json");
const want = process.argv.slice(2);
const NAMES = ["same", "vowels", "letters", "only"];
const t0 = Date.now();
for (const r of index.riwayat) {
  if (r.id === "hafs" || (want.length && !want.includes(r.id))) continue;
  const data = read(`${r.id}.json`);
  const count = [0, 0, 0, 0], pairs = [new Map(), new Map(), new Map(), new Map()];
  for (let s = 1; s <= 114; s++) {
    const { H, R, cls, hcls, span } = compare(hafs.s[s - 1], data.s[s - 1]);
    cls.forEach((c, j) => { count[c]++; if (c) { const hi = []; H.forEach((h, x) => { if (hcls[x] === c && span[h.a - 1][0] <= j && j <= span[h.a - 1][1]) hi.push(h.w); }); const k = `${hi[0] || "—"} → ${R[j].w}`; pairs[c].set(k, (pairs[c].get(k) || 0) + 1); } });
  }
  console.log(`\n== ${r.id} (${r.name}): ${NAMES.map((n, i) => `${n} ${count[i]}`).join(", ")}`);
  for (const c of [2, 1, 3]) {
    const top = [...pairs[c]].sort((a, b) => b[1] - a[1]).slice(0, 20);
    console.log(`  ${NAMES[c]}: ${top.map(([k, n]) => `${k} ×${n}`).join(" | ")}`);
  }
}
console.log(`\n${Date.now() - t0} ms`);
