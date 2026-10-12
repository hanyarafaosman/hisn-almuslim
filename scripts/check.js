// Sanity checks: data integrity, required files, JS syntax.
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..", "www"); let ok = true;
const fail = m => { ok = false; console.error("✗", m); };
for (const f of ["index.html", "manifest.webmanifest", "sw.js", "css/app.css", "js/app.js", "data/hisn.json", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/favicon.svg"])
  if (!fs.existsSync(path.join(root, f))) fail("missing " + f);
const db = JSON.parse(fs.readFileSync(path.join(root, "data/hisn.json"), "utf8"));
const ids = new Set(db.categories.map(c => c.id));
if (ids.size !== db.categories.length) fail("duplicate category ids");
db.sections.flatMap(s => s.cats).forEach(id => { if (!ids.has(id)) fail("section references unknown cat " + id); });
const used = new Set(db.sections.flatMap(s => s.cats)); ids.forEach(id => { if (!used.has(id)) fail("cat not in any section " + id); });
db.categories.forEach(c => c.items.forEach(i => { if (!i.text || !(i.repeat >= 1)) fail(`bad item ${c.id}:${i.id}`); }));
for (const f of ["js/app.js", "sw.js", "../scripts/serve.js"]) { try { new vm.Script(fs.readFileSync(path.join(root, f), "utf8"), { filename: f }); } catch (e) { fail(`${f}: ${e.message}`); } }
console.log(ok ? `✓ all checks passed (${db.categories.length} categories, ${db.categories.reduce((a, c) => a + c.items.length, 0)} items)` : "checks failed"); process.exit(ok ? 0 : 1);
