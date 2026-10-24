// Tests of the question server without Cloudflare (Node 22.13+, no network): the question checks, the limits, the
// search and the answer with the model, the index and the database replaced by stand-ins, and above all that a
// quotation the model did not take from its passage never reaches the app. Usage: npm test (in faqih/), also run by
// npm run check.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker, { ask } from "./src/index.js";
import { cleanQuestion, isPersonal, userMessage, SCHEMA } from "./src/prompt.js";
import { quoteIn, verifyItems } from "./src/verify.js";
import { parseJSON, checkAnswer } from "./src/llm.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let failed = 0, passed = 0;
const check = (ok, what) => { if (ok) passed++; else { failed++; console.error("✗", what); } };
const eq = (a, b, what) => check(JSON.stringify(a) === JSON.stringify(b), `${what}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
const rejects = async (p, status, what) => { try { await p; check(false, what + ": no error"); } catch (e) { eq(e.status, status, what); } };

// ---------- D1 on node:sqlite ----------
function d1() {
  const db = new DatabaseSync(":memory:");
  db.exec(fs.readFileSync(path.join(HERE, "migrations", "0001_faqih.sql"), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => { const r = db.prepare(sql).get(...args); return r ? { ...r } : null; },
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    all: async () => ({ results: db.prepare(sql).all(...args).map(r => ({ ...r })) }),
  });
  return { db, prepare: sql => stmt(sql) };
}

// ---------- the question ----------
eq(cleanQuestion("  ما حكم   الوضوء بالنبيذ؟ "), "ما حكم الوضوء بالنبيذ؟", "spaces collapse");
eq(cleanQuestion("hello world"), null, "not Arabic");
eq(cleanQuestion("ما"), null, "too short");
eq(cleanQuestion("ا".repeat(301)), null, "too long");
eq(cleanQuestion(42), null, "not a string");
check(cleanQuestion("حكم الصلاة في الطائرة (Airplane)?") !== null, "a Latin word inside an Arabic question is fine");
check(isPersonal("طلقت زوجتي ثلاثًا في مجلس واحد فهل تحرم علي"), "a divorce that happened to the asker");
check(isPersonal("حلفت ألا أكلم أخي ثم كلمته"), "an oath of the asker");
check(!isPersonal("ما حكم الطلاق في الحيض"), "a general question on divorce is searched");
check(!isPersonal("هل يجوز لي الصلاة بالحذاء"), "a general «هل يجوز لي» question is searched");
check(userMessage("س", [{ h: "المغني › باب", text: "نَصٌّ" }]).includes("[1] المغني › باب\nنص"), "passages are numbered and sent without diacritics");

// ---------- the quotations ----------
const vocalised = "وَلَنَا قَوْلُ اللَّهِ تَعَالَى: ﴿فَلَمْ تَجِدُوا مَاءً فَتَيَمَّمُوا﴾ [النساء: ٤٣] وَهَذَا نَصٌّ فِي الِانْتِقَالِ إلَى التُّرَابِ عِنْدَ عَدَمِ الْمَاءِ، وَقَالَ النَّبِيُّ ﷺ: «الصَّعِيدُ الطَّيِّبُ وَضُوءُ الْمُسْلِمِ».";
check(quoteIn("فلم تجدوا ماء فتيمموا", vocalised), "a quotation without diacritics");
check(quoteIn("وهذا نصٌّ في الانتقال إلى التراب", vocalised), "a quotation with some diacritics and different letter forms");
check(quoteIn("ولنا قول الله تعالى … عند عدم الماء", vocalised), "a quotation with a gap, in order");
check(!quoteIn("عند عدم الماء … ولنا قول الله", vocalised), "the parts of a quotation must come in order");
check(!quoteIn("التراب عند وجود الماء", vocalised), "a changed word");
check(!quoteIn("الصعيد وضوء المسلم", vocalised), "a word left out in the middle");
check(!quoteIn("نص", vocalised), "too short to count");
check(!quoteIn("تجدوا ماء فتيمم", vocalised), "a quotation must end at a word boundary");
{
  const passages = [{ n: 1, b: "mughni", s: 3, p0: 0, p1: 2, h: "كتاب الطهارة", text: vocalised, pg0: 7, pg1: 10, v0: "1", v1: "1" }];
  const { kept, dropped } = verifyItems([
    { chunk: 1, quote: "فلم تجدوا ماء فتيمموا", note: "قول الحنابلة" },
    { chunk: 1, quote: "فَلَمْ تَجِدُوا مَاءً فَتَيَمَّمُوا", note: "" }, // the same quotation again
    { chunk: 1, quote: "كلام لا وجود له في المقطع أصلا", note: "" },
    { chunk: 2, quote: "فلم تجدوا ماء فتيمموا", note: "" }, // a passage that was not sent
  ], passages);
  eq(dropped, 2, "the invented quotation and the missing passage are dropped");
  eq(kept.length, 1, "one quotation kept");
  eq([kept[0].b, kept[0].s, kept[0].p0, kept[0].pg0, kept[0].pg1, kept[0].v0, kept[0].note], ["mughni", 3, 0, 7, 10, "1", "قول الحنابلة"], "the place comes from the passage, not the model");
}

// ---------- the model's JSON ----------
eq(parseJSON('<think>أفكر…</think>\nهذا الجواب:\n{"status":"answer","summary":"س","items":[]}\nشكرًا').status, "answer", "JSON found after a thinking block and a sentence");
eq(parseJSON({ status: "not_found", summary: "", items: [] }).status, "not_found", "an object is taken as is");
await rejects(Promise.resolve().then(() => parseJSON("لا يوجد")), 502, "no JSON");
await rejects(Promise.resolve().then(() => checkAnswer({ status: "maybe", summary: "", items: [] })), 502, "a status off the schema");
eq(checkAnswer({ status: "answer", summary: " س ", items: [{ chunk: "2", quote: "q" }, { quote: "no chunk" }] }).items, [{ chunk: 2, quote: "q", note: "" }], "items are cleaned");
check(SCHEMA.required.includes("items") && SCHEMA.properties.items.items.required.includes("chunk"), "schema");

// ---------- the server ----------
const passages = [
  { b: "mughni", s: 3, p0: 0, p1: 2, h: "المغني › كتاب الطهارة › باب ما تكون به الطهارة من الماء", text: vocalised, pg0: 7, pg1: 10, v0: "1", v1: "1", bh: "23e9c78257" },
  { b: "mawsua-kuwaitiya", s: 40, p0: 5, p1: 5, h: "الموسوعة الفقهية الكويتية › نبيذ › الوضوء بالنبيذ", text: "ذَهَبَ جُمْهُورُ الْفُقَهَاءِ إِلَى أَنَّهُ لاَ يَجُوزُ الْوُضُوءُ بِالنَّبِيذِ.", pg0: 100, pg1: 100, v0: "40", v1: "40", bh: "abc" },
];
function makeEnv(opts = {}) {
  const calls = { embed: 0, model: 0, query: 0 };
  const env = {
    ORIGINS: "https://hanyarafaosman.github.io", PROVIDER: "workers-ai", MODEL: "test-model", EMBED_MODEL: "test-embed", TOP_K: "12", MIN_SCORE: "0.4", DAILY_LIMIT: opts.limit ?? "100", KUTUB_INDEX: opts.index === undefined ? "" : "https://example.org/index.json",
    DB: d1(),
    AI: { run: async (model, input) => {
      if (model === "test-embed") { calls.embed++; return { data: [[0.1, 0.2, 0.3]] }; }
      calls.model++; return { response: typeof opts.answer === "function" ? opts.answer(input) : opts.answer ?? JSON.stringify({ status: "answer", summary: "لا يجوز الوضوء بالنبيذ عند الجمهور.", items: [{ chunk: 1, quote: "فلم تجدوا ماء فتيمموا", note: "" }, { chunk: 2, quote: "لا يجوز الوضوء بالنبيذ", note: "الجمهور" }, { chunk: 2, quote: "اختلاق", note: "" }] }) };
    } },
    VECTORIZE: { query: async () => { calls.query++; return { matches: (opts.matches ?? passages).map((p, i) => ({ id: `${p.b}/${p.s}/${p.p0}`, score: opts.score ?? 0.7 - i * 0.05, metadata: p })) }; } },
    LIMITER: { limit: async ({ key }) => ({ success: key !== "blocked" }) },
  };
  return { env, calls };
}
const fetchJSON = async () => ({ books: [{ id: "mughni", file: "mughni.23e9c78257.json" }, { id: "mawsua-kuwaitiya", file: "mawsua-kuwaitiya.abc.json" }] });
{
  const { env, calls } = makeEnv();
  const r = await ask(env, { q: "ما حكم الوضوء بالنبيذ" }, { ip: "1.1.1.1", fetchJSON });
  eq([r.status, r.items.length, r.dropped], ["answer", 2, 1], "an answer with the verified quotations only");
  eq([r.items[0].b, r.items[0].s, r.items[0].p0, r.items[0].pg0, r.items[1].b, r.items[1].v0, r.items[1].note], ["mughni", 3, 0, 7, "mawsua-kuwaitiya", "40", "الجمهور"], "each quotation carries its place");
  check(r.summary.includes("الجمهور"), "the summary is passed on");
  eq([calls.embed, calls.query, calls.model], [1, 1, 1], "one embedding, one search, one model call");
  eq((await env.DB.prepare("SELECT n FROM budget").first()).n, 1, "the day's count");
  eq((await env.DB.prepare("SELECT status, dropped FROM log").first()), { status: "answer", dropped: 1 }, "the log keeps the outcome, not the question");
}
{
  const { env, calls } = makeEnv();
  const r = await ask(env, { q: "طلقت زوجتي ثلاثا فهل تحرم علي" }, { ip: "1.1.1.1", fetchJSON });
  eq([r.status, calls.embed, calls.model], ["refer_to_scholar", 0, 0], "a personal case goes to the scholars without a search");
  await rejects(ask(env, { q: "hello" }, { fetchJSON }), 400, "a bad question");
  await rejects(ask(env, {}, { fetchJSON }), 400, "no question");
  await rejects(ask(env, { q: "ما حكم الوضوء بالنبيذ" }, { ip: "blocked", fetchJSON }), 429, "rate limited");
}
{
  const { env, calls } = makeEnv({ limit: "2" });
  await ask(env, { q: "ما حكم الوضوء بالنبيذ" }, { fetchJSON }); await ask(env, { q: "ما حكم الوضوء بالنبيذ" }, { fetchJSON });
  await rejects(ask(env, { q: "ما حكم الوضوء بالنبيذ" }, { fetchJSON }), 503, "the daily limit");
  eq(calls.model, 2, "the third question never reached the model");
}
{
  const { env, calls } = makeEnv({ score: 0.2 });
  const r = await ask(env, { q: "ما حكم الوضوء بالنبيذ" }, { fetchJSON });
  eq([r.status, calls.model], ["not_found", 0], "a weak search is «لم أجد» without the model");
}
{
  const { env } = makeEnv({ answer: JSON.stringify({ status: "answer", summary: "كلام", items: [{ chunk: 1, quote: "جملة ليست في المقطع إطلاقا", note: "" }] }) });
  const r = await ask(env, { q: "ما حكم الوضوء بالنبيذ" }, { fetchJSON });
  eq([r.status, r.items.length, r.dropped], ["not_found", 0, 1], "an answer whose every quotation is invented becomes «لم أجد»");
}
{
  const { env } = makeEnv({ answer: '<think>…</think>{"status":"refer_to_scholar","summary":"هذه مسألة تحتاج سؤال أهل العلم.","items":[]}' });
  const r = await ask(env, { q: "ما حكم الوضوء بالنبيذ" }, { fetchJSON });
  eq([r.status, r.items.length], ["refer_to_scholar", 0], "the model's own referral, after a thinking block");
}
{
  let n = 0;
  const { env, calls } = makeEnv({ answer: () => ++n === 1 ? "ليس JSON" : JSON.stringify({ status: "not_found", summary: "لم أجد.", items: [] }) });
  const r = await ask(env, { q: "ما حكم الوضوء بالنبيذ" }, { fetchJSON });
  eq([r.status, calls.model], ["not_found", 2], "a bad answer is asked for once more");
}
{
  // The book was rebuilt since the index was made: its passages are left out.
  const { env } = makeEnv({ index: true, answer: input => { const sent = input.messages[1].content; return JSON.stringify({ status: "answer", summary: "س", items: [{ chunk: 1, quote: sent.includes("[2]") ? "فلم تجدوا ماء فتيمموا" : "لا يجوز الوضوء بالنبيذ", note: "" }] }); } });
  const stale = async () => ({ books: [{ id: "mughni", file: "mughni.ffffffffff.json" }, { id: "mawsua-kuwaitiya", file: "mawsua-kuwaitiya.abc.json" }] });
  const r = await ask(env, { q: "ما حكم الوضوء بالنبيذ" }, { fetchJSON: stale });
  eq([r.status, r.items.map(i => i.b)], ["answer", ["mawsua-kuwaitiya"]], "a passage of a rebuilt book is left out");
}
{
  const { env } = makeEnv();
  const h = await worker.fetch(new Request("https://x/health", { headers: { origin: "https://hanyarafaosman.github.io" } }), env);
  const j = await h.json();
  eq([h.status, j.ok, j.n, j.limit, h.headers.get("access-control-allow-origin")], [200, true, 0, 100, "https://hanyarafaosman.github.io"], "/health with CORS for the app");
  const o = await worker.fetch(new Request("https://x/ask", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), env);
  eq([o.status, o.headers.get("access-control-allow-origin")], [204, null], "no CORS for other pages");
  const bad = await worker.fetch(new Request("https://x/ask", { method: "POST", body: "{" }), env);
  eq([bad.status, (await bad.json()).error], [400, "not JSON"], "a bad body");
  const ok = await worker.fetch(new Request("https://x/ask", { method: "POST", body: JSON.stringify({ q: "ما حكم الوضوء بالنبيذ" }), headers: { "cf-connecting-ip": "2.2.2.2" } }), env);
  eq([ok.status, (await ok.json()).status], [200, "answer"], "POST /ask");
}

console.log(`${failed ? "✗" : "✓"} faqih: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
