// Validates interface translations in www/i18n/*.json against en.json:
// same keys, same {placeholders}, plural objects with every CLDR category the language needs.
// Usage: node scripts/check-i18n.js [lang ...]
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "www", "i18n");
const read = f => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
const en = read("en.json");
const holes = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");
const enHoles = v => typeof v === "object" ? holes(v.other) : holes(v);

const only = process.argv.slice(2);
const files = fs.readdirSync(DIR).filter(f => f.endsWith(".json") && f !== "en.json" && (!only.length || only.includes(f.replace(".json", ""))));
let bad = 0;
for (const f of files) {
  const lang = f.replace(".json", ""); const d = read(f); const errs = [];
  let cats; try { cats = new Intl.PluralRules(lang).resolvedOptions().pluralCategories; } catch { cats = ["other"]; }
  for (const [k, ev] of Object.entries(en)) {
    if (lang === "ar" && k.startsWith("ch.")) continue; // Arabic titles live in data/hisn.json
    if (!(k in d)) { errs.push(`missing ${k}`); continue; }
    const v = d[k];
    if (typeof ev === "object") {
      if (typeof v !== "object" || !v) { errs.push(`${k}: must be a plural object`); continue; }
      for (const c of cats) if (typeof v[c] !== "string" || !v[c].trim()) errs.push(`${k}: missing plural form "${c}" (needs ${cats.join("/")})`);
      for (const c of Object.keys(v)) if (!["zero", "one", "two", "few", "many", "other"].includes(c)) errs.push(`${k}: unknown plural form "${c}"`);
      if (holes(ev.other) && v.other && holes(v.other) !== holes(ev.other)) errs.push(`${k}.other: placeholders {${holes(v.other)}} ≠ {${holes(ev.other)}}`);
      for (const c of Object.keys(v)) { const extra = holes(v[c]).split(",").filter(h => h && !holes(ev.other).split(",").includes(h)); if (extra.length) errs.push(`${k}.${c}: unknown placeholder {${extra}}`); }
    } else {
      if (typeof v !== "string" || !v.trim()) { errs.push(`${k}: empty`); continue; }
      if (holes(v) !== enHoles(ev)) errs.push(`${k}: placeholders {${holes(v)}} ≠ {${enHoles(ev)}}`);
    }
  }
  for (const k of Object.keys(d)) if (!(k in en)) errs.push(`unknown key ${k}`);
  if (errs.length) { bad++; console.log(`✗ ${lang}: ${errs.length} problem(s)\n  ` + errs.slice(0, 25).join("\n  ")); }
  else console.log(`✓ ${lang} (${Object.keys(d).length} keys, plural forms: ${cats.join("/")})`);
}
process.exit(bad ? 1 : 0);
