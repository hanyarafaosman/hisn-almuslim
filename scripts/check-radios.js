// Checks that each live radio in www/data/radios.json is reachable and returns audio.
// Usage: npm run check:radios
const fs = require("fs"), path = require("path");
const { live } = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "www", "data", "radios.json"), "utf8"));

async function probe(r) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetch(r.url, { signal: ctl.signal, headers: { "User-Agent": "HisnAlMuslim/1.1" } });
    const type = res.headers.get("content-type") || "";
    let ok = res.ok && /audio|mpegurl|octet-stream|ogg|aac/i.test(type);
    if (res.ok && r.hls) { const text = (await res.text()).slice(0, 20); ok = text.startsWith("#EXTM3U"); }
    else res.body?.cancel().catch(() => {});
    return { ok, info: `HTTP ${res.status} ${type}` };
  } catch (e) { return { ok: false, info: e.name === "AbortError" ? "timeout" : e.message }; }
  finally { clearTimeout(t); }
}

module.exports = { probe };

if (require.main === module) (async () => {
  let bad = 0;
  for (const r of live) {
    const { ok, info } = await probe(r); if (!ok) bad++;
    console.log(`${ok ? "✓" : "✗"} ${r.flag} ${r.name} (${r.country}) · ${info}`);
  }
  console.log(bad ? `\n${bad} station(s) need attention` : "\n✓ all stations responded");
  process.exit(bad ? 1 : 0);
})();
