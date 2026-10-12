// Measures the total size of the Hisn al-Muslim audio files (HEAD requests) so the app can show
// the download size before saving them for offline use. Writes www/data/audio-sizes.json.
// Usage: node scripts/measure-audio.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const db = JSON.parse(fs.readFileSync(path.join(ROOT, "www/data/hisn.json"), "utf8"));

async function size(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { method: "HEAD" }); if (r.ok) return Number(r.headers.get("content-length") || 0); if (r.status === 404) return -1; } catch { /* retry */ }
  }
  return -1;
}
async function total(urls) {
  const q = [...urls]; let bytes = 0; const missing = [];
  await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) { const u = q.shift(); const n = await size(u); if (n < 0) missing.push(u); else bytes += n; } }));
  return { files: urls.length - missing.length, bytes, missing };
}

(async () => {
  const items = db.categories.flatMap(c => c.items.map(i => i.audio)).filter(Boolean);
  const chapters = db.categories.map(c => c.audio).filter(Boolean);
  const [a, b] = await Promise.all([total(items), total(chapters)]);
  const out = { measured: new Date().toISOString().slice(0, 10), items: { files: a.files, bytes: a.bytes }, chapters: { files: b.files, bytes: b.bytes }, missing: [...a.missing, ...b.missing] };
  fs.writeFileSync(path.join(ROOT, "www/data/audio-sizes.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(`✓ adhkar audio: ${a.files} files, ${(a.bytes / 1048576).toFixed(1)} MB · chapters: ${b.files} files, ${(b.bytes / 1048576).toFixed(1)} MB`);
  if (out.missing.length) console.log("  unavailable at source:", out.missing.join(" "));
})();
