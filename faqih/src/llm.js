// The model that writes the answer, behind one function: Workers AI (PROVIDER "workers-ai", the default, nothing
// else to set up) or Claude (PROVIDER "anthropic", ANTHROPIC_API_KEY as a secret). Either way the answer is JSON on
// prompt.js's SCHEMA, checked here before anyone reads it.

const STATUS = new Set(["answer", "not_found", "refer_to_scholar"]);
const fail = (msg, status = 502) => { throw Object.assign(new Error(msg), { status }); };

// The JSON in the model's text: a thinking block or a sentence before it is ignored.
export function parseJSON(raw) {
  if (raw && typeof raw === "object") return raw;
  const text = String(raw ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) fail("no JSON in the model's answer");
  try { return JSON.parse(text.slice(a, b + 1)); } catch { fail("bad JSON in the model's answer"); }
}

export function checkAnswer(x) {
  if (!x || typeof x !== "object" || !STATUS.has(x.status) || typeof x.summary !== "string" || !Array.isArray(x.items)) fail("the model's answer is not on the schema");
  const items = x.items.filter(it => it && Number.isInteger(Number(it.chunk)) && typeof it.quote === "string").map(it => ({ chunk: Number(it.chunk), quote: it.quote, note: typeof it.note === "string" ? it.note : "" }));
  return { status: x.status, summary: x.summary.trim().slice(0, 1500), items: items.slice(0, 12) };
}

export async function generate(env, { system, user, schema }) {
  const provider = env.PROVIDER || "workers-ai";
  const once = async retry => {
    const u = retry ? user + "\n\n(الرد السابق لم يكن JSON صالحًا على المخطط. أعد الجواب بـ JSON فقط.)" : user;
    if (provider === "anthropic") return checkAnswer(parseJSON(await anthropic(env, system, u, schema)));
    if (provider === "workers-ai") return checkAnswer(parseJSON(await workersAI(env, system, u, schema)));
    fail("unknown PROVIDER " + provider, 500);
  };
  try { return await once(false); } catch (e) { if (e.status === 500 || e.status === 503) throw e; return once(true); }
}

async function workersAI(env, system, user, schema) {
  const r = await env.AI.run(env.MODEL, {
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    max_tokens: 2500,
    response_format: { type: "json_schema", json_schema: schema },
  });
  return r?.response ?? r;
}

// Claude: the system prompt is cached (1 h), the answer is constrained to the schema, and a model that declines for
// safety is re-run on the default fallback model (Sonnet and Opus; Haiku has no fallback).
async function anthropic(env, system, user, schema) {
  if (!env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY is not set", 500);
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 60_000 });
  const fallback = /^claude-(sonnet|opus|fable)/.test(env.MODEL) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {};
  const res = await client.beta.messages.create({
    model: env.MODEL, max_tokens: 4000, ...fallback,
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral", ttl: "1h" } }],
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") fail("the model declined to answer", 502);
  return res.content.filter(b => b.type === "text").map(b => b.text).join("");
}
