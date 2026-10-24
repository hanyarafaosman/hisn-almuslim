/* ===== حصن ونور: الباحث الفقهي (a Cloudflare Worker with Vectorize, Workers AI and D1) ===== */
// POST /ask      { q }  → { status, summary, items: [{ quote, note, b, s, p0, p1, h, pg0, pg1, v0, v1 }], dropped }
//                 status: answer | not_found | refer_to_scholar. Every item is a quotation checked word for word
//                 against the passage it comes from; b/s/p0 open it in the app's reader (#/kutub/<b>/<s>?p=<p0>).
// GET  /health   for scripts/check-sources.js: the database answers, and today's count of questions
// The passages come from the index that scripts/build-faqih.mjs builds from www/kutub (faqih/README.md).
import { SYSTEM, SCHEMA, userMessage, isPersonal, cleanQuestion } from "./prompt.js";
import { generate } from "./llm.js";
import { verifyItems } from "./verify.js";
import { stripTashkeel } from "../../scripts/faqih-chunk.mjs";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
const fail = (msg, status) => { throw Object.assign(new Error(msg), { status }); };
const day = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(what + " timed out"), { status: 504 })), ms))]);

export default {
  async fetch(req, env) {
    const origin = req.headers.get("origin") || "";
    const allowed = String(env.ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
    const cors = allowed.includes(origin) ? { "access-control-allow-origin": origin, vary: "origin" } : {};
    const path = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
    try {
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" } });
      if (req.method === "GET" && (path === "/" || path === "/health")) {
        const row = await env.DB.prepare("SELECT n FROM budget WHERE day = ?").bind(day()).first();
        return json({ ok: true, day: day(), n: row ? Number(row.n) : 0, limit: limitOf(env), now: Date.now() }, 200, { ...cors, "cache-control": "no-store" });
      }
      if (req.method === "POST" && path === "/ask") return json(await ask(env, await body(req), { ip: req.headers.get("cf-connecting-ip") || "" }), 200, { ...cors, "cache-control": "no-store" });
      return json({ ok: false, error: "not found" }, 404, cors);
    } catch (e) {
      return json({ ok: false, error: e.message }, e.status || 500, cors);
    }
  },
};

const limitOf = env => Math.max(0, Number(env.DAILY_LIMIT) || 0);

async function body(req) {
  const text = await req.text();
  if (text.length > 2048) fail("too large", 413);
  try { return JSON.parse(text); } catch { fail("not JSON", 400); }
}

// The published list of books, kept ten minutes: a passage of a book rebuilt since the index was made is left out
// (its section numbers may have moved). Without the list (first call fails) nothing is left out.
let books = { at: 0, hash: null };
async function bookHashes(env, fetchJSON) {
  if (!env.KUTUB_INDEX) return null;
  if (Date.now() - books.at < 600_000) return books.hash;
  try {
    const ix = await fetchJSON(env.KUTUB_INDEX);
    books = { at: Date.now(), hash: new Map(ix.books.map(b => [b.id, b.file.split(".")[1]])) };
  } catch { books.at = Date.now() - 540_000; } // try again in a minute
  return books.hash;
}

const defaultFetchJSON = async url => { const r = await fetch(url, { cf: { cacheTtl: 600 } }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };

export async function ask(env, { q } = {}, { ip = "", fetchJSON = defaultFetchJSON, now = Date.now() } = {}) {
  const t0 = now;
  const question = cleanQuestion(q); if (!question) fail("bad question", 400);
  const log = async (status, dropped = 0) => { try { await env.DB.prepare("INSERT INTO log (ts, status, dropped, ms) VALUES (?, ?, ?, ?)").bind(Date.now(), status, dropped, Date.now() - t0).run(); } catch {} };
  if (isPersonal(question)) { await log("refer_to_scholar"); return { status: "refer_to_scholar", summary: "", items: [], dropped: 0 }; }

  // One address: LIMITER (wrangler.toml); everyone: DAILY_LIMIT questions a day.
  if (env.LIMITER) { const { success } = await env.LIMITER.limit({ key: ip || "?" }); if (!success) fail("too many questions, try again in a minute", 429); }
  const today = day(now), limit = limitOf(env);
  const row = await env.DB.prepare("SELECT n FROM budget WHERE day = ?").bind(today).first();
  if (limit && (row ? Number(row.n) : 0) >= limit) fail("the daily limit of questions is reached", 503);
  await env.DB.prepare("INSERT INTO budget (day, n) VALUES (?1, 1) ON CONFLICT (day) DO UPDATE SET n = n + 1").bind(today).run();

  // The passages nearest the question.
  const e = await withTimeout(env.AI.run(env.EMBED_MODEL, { text: [stripTashkeel(question)] }), 15_000, "embedding");
  const vector = e?.data?.[0]; if (!Array.isArray(vector)) fail("no embedding", 502);
  const topK = Math.min(20, Math.max(1, Number(env.TOP_K) || 12));
  const { matches = [] } = await withTimeout(env.VECTORIZE.query(vector, { topK, returnMetadata: "all" }), 5_000, "search");
  const hashes = await bookHashes(env, fetchJSON);
  const passages = matches.filter(m => m.metadata?.text && (!hashes || hashes.get(m.metadata.b) === m.metadata.bh)).map((m, i) => ({ n: i + 1, score: m.score, ...m.metadata }));
  const minScore = Number(env.MIN_SCORE) || 0;
  if (!passages.length || passages[0].score < minScore) { await log("not_found"); return { status: "not_found", summary: "", items: [], dropped: 0 }; }

  // The answer, with only the quotations that are really in the passages.
  const out = await generate(env, { system: SYSTEM, user: userMessage(question, passages), schema: SCHEMA });
  const { kept, dropped } = verifyItems(out.items, passages);
  const status = out.status === "answer" && !kept.length ? "not_found" : out.status;
  const items = status === "answer" ? kept : [];
  await log(status, dropped);
  return { status, summary: status === "answer" ? out.summary : out.summary.slice(0, 300), items, dropped };
}
