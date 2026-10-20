/* ===== حصن ونور: prayer alerts while the app is closed (a Cloudflare Worker with D1) ===== */
// POST   /subscribe    the app sends its push subscription and prayer settings (www/js/prayer.js, syncPush)
// DELETE /unsubscribe  the app turned the alerts off
// GET    /health       for scripts/check-sources.js: the database answers and the minute job ran lately
// Every minute (cron) the alerts that are due go out as Web Push messages { p, at, kind, l }; the service worker
// (www/sw.js) writes the notification in the app's language. See push/README.md.
import { b64u, ephemeralKey, send, Vapid } from "./webpush.js";
import { cleanSettings, nextAlert } from "./schedule.js";

// Push services of the browsers (Chrome/Android, Firefox, Safari, Edge). Nothing else is ever sent a request.
const PUSH_HOSTS = /^(fcm\.googleapis\.com|android\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
const LATE = { notice: 10 * 60000 }; // a prayer's notification later than this is dropped (www/js/prayer.js GRACE.notice)

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });

export default {
  async fetch(req, env) {
    const origin = req.headers.get("origin") || "";
    const allowed = String(env.ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
    const cors = allowed.includes(origin) ? { "access-control-allow-origin": origin, vary: "origin" } : {};
    const path = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
    try {
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "GET, POST, DELETE", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" } });
      if (req.method === "GET" && (path === "/" || path === "/health")) {
        const row = await env.DB.prepare("SELECT v FROM meta WHERE k = 'cron'").first();
        return json({ ok: true, cron: row ? Number(row.v) : null, now: Date.now() }, 200, { ...cors, "cache-control": "no-store" });
      }
      if (req.method === "POST" && path === "/subscribe") return json(await subscribe(env, await body(req)), 200, cors);
      if (req.method === "DELETE" && path === "/unsubscribe") {
        const { endpoint } = await body(req);
        if (typeof endpoint === "string") await env.DB.prepare("DELETE FROM subs WHERE endpoint = ?").bind(endpoint).run();
        return json({ ok: true }, 200, cors);
      }
      return json({ ok: false, error: "not found" }, 404, cors);
    } catch (e) {
      return json({ ok: false, error: e.message }, e.status || 500, cors);
    }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(run(env)); },
};

async function body(req) {
  const text = await req.text();
  if (text.length > 4096) throw Object.assign(new Error("too large"), { status: 413 });
  try { return JSON.parse(text); } catch { throw Object.assign(new Error("not JSON"), { status: 400 }); }
}

async function subscribe(env, { sub, settings, old }) {
  const bad = what => { throw Object.assign(new Error("bad " + what), { status: 400 }); };
  let url; try { url = new URL(sub?.endpoint); } catch { bad("endpoint"); }
  if (url.protocol !== "https:" || !PUSH_HOSTS.test(url.hostname) || sub.endpoint.length > 1024) bad("push service");
  const p256dh = String(sub.keys?.p256dh || ""), auth = String(sub.keys?.auth || "");
  if (b64u.decode(p256dh).length !== 65 || b64u.decode(auth).length !== 16) bad("keys");
  let s; try { s = cleanSettings(settings); } catch (e) { bad(e.message.replace(/^bad /, "")); }
  const now = Date.now(), next = nextAlert(s, { at: now, rank: 99 });
  const stmts = [env.DB.prepare(`INSERT INTO subs (endpoint, p256dh, auth, settings, next_at, next, created, seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
    ON CONFLICT (endpoint) DO UPDATE SET p256dh = ?2, auth = ?3, settings = ?4, next_at = ?5, next = ?6, seen = ?7`)
    .bind(sub.endpoint, p256dh, auth, JSON.stringify(s), next?.at ?? null, next ? JSON.stringify(next) : null, now)];
  // The browser replaced the subscription (pushsubscriptionchange in www/sw.js): forget the old one.
  if (typeof old === "string" && old !== sub.endpoint) stmts.push(env.DB.prepare("DELETE FROM subs WHERE endpoint = ?").bind(old));
  await env.DB.batch(stmts);
  return { ok: true, next: next?.at ?? null };
}

// The keys live for the life of the Worker, so a VAPID token is signed once per push service every 12 hours.
let vapid = null;
const vapidFor = env => {
  if (!vapid || vapid.publicKey !== env.VAPID_PUBLIC_KEY) vapid = new Vapid(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT);
  return vapid;
};

// The minute job. The free plan allows 50 outside requests per run, so at most MAX_PUSH messages go out each
// minute; the rest are a minute late (README: a paid plan raises the limit). Rows are updated after their message.
export async function run(env, now = Date.now()) {
  const max = Math.max(1, Math.min(Number(env.MAX_PUSH) || 40, 5000));
  const { results } = await env.DB.prepare("SELECT endpoint, p256dh, auth, settings, next_at, next FROM subs WHERE next_at <= ?1 ORDER BY next_at LIMIT ?2").bind(now + 5000, max).all();
  const stats = { due: results.length, sent: 0, gone: 0, retry: 0, late: 0 };
  const stmts = [];
  if (results.length) {
    const v = vapidFor(env), server = await ephemeralKey();
    await Promise.all(results.map(async row => {
      let s, e;
      try { s = JSON.parse(row.settings); e = { ...JSON.parse(row.next), at: row.next_at }; } catch { stmts.push(env.DB.prepare("DELETE FROM subs WHERE endpoint = ?").bind(row.endpoint)); return; }
      const late = e.kind === "before" ? now >= e.prayerAt - 60000 : now - e.at > LATE.notice;
      let status = 0;
      if (late) stats.late++;
      else {
        const ttl = e.kind === "before" ? (e.prayerAt - now) / 1000 : LATE.notice / 1000;
        status = await send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify({ p: e.p, at: e.prayerAt, kind: e.kind, l: s.lang }), { vapid: v, server, ttl, topic: "prayer" });
      }
      // 404/410: the subscription ended; 403: it was made with another server key. Either way it can never be used.
      if ([403, 404, 410].includes(status)) { stats.gone++; stmts.push(env.DB.prepare("DELETE FROM subs WHERE endpoint = ?").bind(row.endpoint)); return; }
      // No answer, too many requests or a server error: try again next minute, until the alert is too late.
      if (!late && (status === 0 || status === 429 || status >= 500)) { stats.retry++; return; }
      if (!late && status >= 200 && status < 300) stats.sent++;
      const next = nextAlert(s, e);
      stmts.push(env.DB.prepare("UPDATE subs SET next_at = ?1, next = ?2 WHERE endpoint = ?3").bind(next?.at ?? null, next ? JSON.stringify(next) : null, row.endpoint));
    }));
  }
  stmts.push(env.DB.prepare("INSERT INTO meta (k, v) VALUES ('cron', ?1) ON CONFLICT (k) DO UPDATE SET v = ?1").bind(String(now)));
  await env.DB.batch(stmts);
  if (stats.due) console.log(JSON.stringify(stats));
  return stats;
}
