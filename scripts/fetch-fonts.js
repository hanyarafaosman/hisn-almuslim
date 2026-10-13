// Copies the interface fonts (Amiri, Noto Naskh Arabic; SIL Open Font License 1.1) from Google Fonts into
// www/fonts/ and writes www/css/fonts.css, so the app never needs fonts.googleapis.com to look right
// (offline first run, store builds, networks where Google is blocked).
// Usage: node scripts/fetch-fonts.js   (then list the printed files in FONTS in www/sw.js)
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "www");
const CSS_URL = "https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Noto+Naskh+Arabic:wght@400;500;700&display=swap";
// Google serves woff2 with unicode-range subsets only to modern browsers.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

(async () => {
  const css = await (await fetch(CSS_URL, { headers: { "User-Agent": UA } })).text();
  const faces = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]+)\}/g)].map(([, subset, body]) => {
    const prop = k => (new RegExp(`${k}:\\s*([^;]+);`).exec(body) || [])[1];
    return { subset, family: prop("font-family").replace(/'/g, ""), style: prop("font-style"), weight: prop("font-weight"), url: /url\(([^)]+)\)/.exec(body)[1], range: prop("unicode-range") };
  });
  if (!faces.length) throw new Error("no @font-face rules in the Google Fonts response");
  // A variable font is one file for every weight: keep a single rule with the weight range.
  const byUrl = new Map();
  for (const f of faces) {
    const prev = byUrl.get(f.url);
    if (prev) { prev.weights.add(Number(f.weight)); continue; }
    byUrl.set(f.url, { ...f, weights: new Set([Number(f.weight)]) });
  }
  const dir = path.join(ROOT, "fonts"); fs.mkdirSync(dir, { recursive: true });
  fs.readdirSync(dir).filter(n => n.endsWith(".woff2")).forEach(n => fs.unlinkSync(path.join(dir, n)));
  const rules = [], files = []; let bytes = 0;
  for (const f of byUrl.values()) {
    const ws = [...f.weights].sort((a, b) => a - b);
    const weight = ws.length > 1 ? `${ws[0]} ${ws[ws.length - 1]}` : String(ws[0]);
    const version = (/\/(v\d+)\//.exec(f.url) || [, "v0"])[1]; // in the file name, so a newer Google build gets a new cache entry
    const name = [f.family.toLowerCase().replace(/\s+/g, "-"), version, f.style === "italic" ? "italic" : "", weight.replace(" ", "-"), f.subset].filter(Boolean).join("-") + ".woff2";
    const res = await fetch(f.url); if (!res.ok) throw new Error(`HTTP ${res.status} ${f.url}`);
    const buf = Buffer.from(await res.arrayBuffer()); fs.writeFileSync(path.join(dir, name), buf); bytes += buf.length; files.push("fonts/" + name);
    rules.push(`/* ${f.subset} */\n@font-face { font-family: "${f.family}"; font-style: ${f.style}; font-weight: ${weight}; font-display: swap; src: url(../fonts/${name}) format("woff2"); unicode-range: ${f.range}; }`);
  }
  const head = `/* Amiri and Noto Naskh Arabic, SIL Open Font License 1.1 (https://openfontlicense.org).\n   Copied from Google Fonts by scripts/fetch-fonts.js on ${new Date().toISOString().slice(0, 10)}; do not edit by hand. */\n`;
  fs.writeFileSync(path.join(ROOT, "css", "fonts.css"), head + rules.join("\n") + "\n");
  console.log(`✓ ${files.length} font files, ${(bytes / 1024).toFixed(0)} KB, and css/fonts.css`);
  console.log(files.map(f => JSON.stringify("./" + f)).join(", "));
})().catch(e => { console.error("✗", e.message); process.exit(1); });
