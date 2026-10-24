// الباحث الفقهي: the search index of the books of www/kutub (faqih/README.md).
// The books are cut into passages (scripts/faqih-chunk.mjs), each passage is turned into a vector by the embedding
// model on Workers AI and stored with its text and place in a Vectorize index; the server (faqih/) searches it.
// Usage (from the repo root; CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in the environment for anything but --stats):
//   node scripts/build-faqih.mjs --stats                     count the passages and check the metadata sizes (no network)
//   node scripts/build-faqih.mjs --embed [--only=a,b]        embed and upload the passages (resumes: .cache/faqih/)
//   node scripts/build-faqih.mjs --ask="حكم الوضوء بالنبيذ"   show what the index returns for a question
//   node scripts/build-faqih.mjs --eval                      scripts/faqih-eval.json: how often the expected place is found
//   --index=faqih-v1 (default) --model=@cf/baai/bge-m3 (default) --topk=12
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chunkSection, chunkId, metadataOf, stripTashkeel } from "./faqih-chunk.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const KUTUB = path.join(ROOT, "www", "kutub");
const ARGS = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([\w-]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const INDEX = ARGS.index || "faqih-v1", MODEL = ARGS.model || "@cf/baai/bge-m3", TOPK = Number(ARGS.topk) || 12;
const ONLY = ARGS.only ? String(ARGS.only).split(",") : null;
const CACHE = path.join(ROOT, ".cache", "faqih", INDEX);
const META_LIMIT = 10240; // bytes of metadata Vectorize keeps with a vector
const EMBED_BATCH = 50, UPSERT_BATCH = 250;

// ---------- the passages ----------
const index = JSON.parse(fs.readFileSync(path.join(KUTUB, "index.json"), "utf8"));
function* passages(book) {
  const head = JSON.parse(fs.readFileSync(path.join(KUTUB, book.file), "utf8"));
  const parts = new Map();
  const part = k => { if (!parts.has(k)) parts.set(k, JSON.parse(fs.readFileSync(path.join(KUTUB, book.id, `${k}.${book.chunks[k]}.json`), "utf8"))); return parts.get(k); };
  for (let i = 0; i < head.sections.length; i++) {
    const s = head.sections[i]; if (s.c == null) continue;
    const text = part(s.c)[i]; if (!text) continue;
    for (const c of chunkSection(book, head.sections, i, text.body)) {
      const metadata = metadataOf(book, s, c);
      const bytes = Buffer.byteLength(JSON.stringify(metadata));
      if (bytes > META_LIMIT) throw new Error(`${chunkId(book.id, c)}: metadata of ${bytes} bytes (limit ${META_LIMIT})`);
      yield { id: chunkId(book.id, c), embed: c.embed, metadata, bytes };
    }
    if (parts.size > 3) parts.delete(parts.keys().next().value);
  }
}
const books = index.books.filter(b => !ONLY || ONLY.includes(b.id));

// ---------- Cloudflare REST ----------
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID, TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const API = () => { if (!ACCOUNT || !TOKEN) throw new Error("set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN"); return `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}`; };
async function cf(url, body, type = "application/json") {
  let last;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url, { method: body == null ? "GET" : "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": type }, body: body == null ? undefined : type === "application/json" ? JSON.stringify(body) : body });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.success === false) throw new Error(`HTTP ${r.status} ${JSON.stringify(j.errors || j).slice(0, 300)}`);
      return j.result;
    } catch (e) { last = e; if (/HTTP 4(0[0134]|13|22)/.test(e.message)) break; await new Promise(r => setTimeout(r, 2000 * (i + 1))); }
  }
  throw last;
}
const embed = async texts => (await cf(`${API()}/ai/run/${MODEL}`, { text: texts })).data;
const upsert = rows => cf(`${API()}/vectorize/v2/indexes/${INDEX}/upsert`, rows.map(r => JSON.stringify(r)).join("\n"), "application/x-ndjson");
const query = (vector, topK = TOPK) => cf(`${API()}/vectorize/v2/indexes/${INDEX}/query`, { vector, topK, returnMetadata: "all", returnValues: false });
const info = () => cf(`${API()}/vectorize/v2/indexes/${INDEX}/info`);

const place = m => `${m.b}/${m.s}/${m.p0}` + (m.pg0 != null ? ` (${m.v0 ? "ج" + m.v0 + " " : ""}ص${m.pg0}${m.pg1 !== m.pg0 ? "–" + m.pg1 : ""})`: "");

// ---------- commands ----------
if (ARGS.embed) {
  fs.mkdirSync(CACHE, { recursive: true });
  let total = 0;
  for (const b of books) {
    const done = path.join(CACHE, `${b.id}.${b.file.split(".")[1]}.done`);
    if (fs.existsSync(done)) { console.log(`${b.id}: already in ${INDEX}`); continue; }
    const t0 = Date.now(); let n = 0, batch = [];
    const flush = async () => {
      if (!batch.length) return;
      const vectors = await embed(batch.map(x => x.embed));
      const rows = batch.map((x, i) => ({ id: x.id, values: vectors[i], metadata: x.metadata }));
      for (let i = 0; i < rows.length; i += UPSERT_BATCH) await upsert(rows.slice(i, i + UPSERT_BATCH));
      n += batch.length; batch = [];
      process.stdout.write(`\r${b.id}: ${n} passages`);
    };
    for (const p of passages(b)) { batch.push(p); if (batch.length >= EMBED_BATCH) await flush(); }
    await flush();
    fs.writeFileSync(done, String(n));
    total += n; console.log(`\r${b.id}: ${n} passages in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  console.log(`✓ ${total} passages uploaded to ${INDEX}; ${JSON.stringify(await info())}`);
} else if (ARGS.ask) {
  const q = String(ARGS.ask);
  const [vector] = await embed([stripTashkeel(q)]);
  const { matches } = await query(vector);
  for (const m of matches) console.log(`${m.score.toFixed(3)}  ${place(m.metadata)}  ${m.metadata.h}\n        ${stripTashkeel(m.metadata.text).slice(0, 160).replace(/\n/g, " ")}`);
} else if (ARGS.eval) {
  // Each question names where its answer is: a book and a section, or a range of sections. The index is good enough
  // when the expected place is among the first results most of the time; MIN_SCORE in faqih/wrangler.toml is set from
  // the scores printed here (hits should score well above the misses).
  const set = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "faqih-eval.json"), "utf8"));
  const hit = (m, e) => m.b === e.b && (Array.isArray(e.s) ? m.s >= e.s[0] && m.s <= e.s[1] : m.s === e.s);
  let at5 = 0, at12 = 0; const hits = [], misses = [];
  for (const { q, expect } of set) {
    const [vector] = await embed([stripTashkeel(q)]);
    const { matches } = await query(vector, Math.max(TOPK, 12));
    const rank = matches.findIndex(m => expect.some(e => hit(m.metadata, e)));
    if (rank >= 0 && rank < 5) at5++; if (rank >= 0 && rank < 12) at12++;
    (rank >= 0 ? hits : misses).push(matches[Math.max(rank, 0)].score);
    console.log(`${rank >= 0 ? "✓ " + (rank + 1).toString().padStart(2) : "✗ --"}  ${matches[0]?.score.toFixed(3)}  ${q}${rank < 0 ? "\n      got: " + matches.slice(0, 3).map(m => place(m.metadata) + " " + m.metadata.h.split(" › ").slice(-2).join(" › ")).join(" | ") : ""}`);
  }
  const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) : "-";
  console.log(`hit@5 ${at5}/${set.length} (${(100 * at5 / set.length).toFixed(0)}%), hit@12 ${at12}/${set.length} (${(100 * at12 / set.length).toFixed(0)}%); top score on hits ${avg(hits)}, on misses ${avg(misses)}`);
  process.exitCode = at12 / set.length >= 0.85 ? 0 : 1;
} else {
  // --stats (default): sizes, nothing sent anywhere.
  let total = 0, chars = 0, biggest = 0; const sizes = [];
  for (const b of books) {
    let n = 0;
    for (const p of passages(b)) { n++; chars += p.metadata.text.length; biggest = Math.max(biggest, p.bytes); sizes.push(p.metadata.text.length); }
    total += n; console.log(`${b.id}: ${n} passages`);
  }
  sizes.sort((a, b) => a - b);
  console.log(`✓ ${total} passages, ${(chars / 1e6).toFixed(1)} M chars; passage chars: median ${sizes[sizes.length >> 1]}, 90% ${sizes[Math.floor(sizes.length * 0.9)]}, max ${sizes.at(-1)}; largest metadata ${biggest} bytes (limit ${META_LIMIT})`);
}
