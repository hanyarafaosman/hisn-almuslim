// Tests of the alerts server without Cloudflare (Node 22.5+, no network): the encryption against the example of
// RFC 8291 and against an independent decryption with node:crypto, the VAPID signature, the alerts schedule against
// www/js/prayer-calc.js, and the Worker's requests and minute job on an SQLite copy of the D1 tables.
// Usage: npm test (in push/), also run by npm run check.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { b64u, encrypt, importEcdhKey, ephemeralKey, Vapid, vapidKeys } from "./src/webpush.js";
import { cleanSettings, nextAlert, dayOf } from "./src/schedule.js";
import { prayerTimes } from "../www/js/prayer-calc.js";
import worker, { run } from "./src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let failed = 0, passed = 0;
const check = (ok, what) => { if (ok) passed++; else { failed++; console.error("✗", what); } };
const eq = (a, b, what) => check(JSON.stringify(a) === JSON.stringify(b), `${what}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

// ---------- RFC 8291, Appendix A ----------
{
  const server = await importEcdhKey("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8", "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw");
  const body = await encrypt(b64u.decode("V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24"),
    { p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" },
    server, b64u.decode("DGv6ra1nlYgDCS1FRnbzlw"));
  const header = "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
  const sealed = "8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ";
  eq(b64u.encode(body), b64u.encode(new Uint8Array([...b64u.decode(header), ...b64u.decode(sealed)])), "RFC 8291 example message");
}

// ---------- the browser's side, with node:crypto only ----------
function browser() {
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ecdh, auth, keys: { p256dh: b64u.encode(ecdh.getPublicKey()), auth: b64u.encode(auth) } };
}
function decrypt(body, ua) {
  body = Buffer.from(body);
  const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), n = body[20], asPub = body.subarray(21, 21 + n), ct = body.subarray(21 + n);
  if (rs !== 4096 || n !== 65) throw new Error("bad header");
  const ikm = Buffer.from(crypto.hkdfSync("sha256", ua.ecdh.computeSecret(asPub), ua.auth, Buffer.concat([Buffer.from("WebPush: info\0"), ua.ecdh.getPublicKey(), asPub]), 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce); d.setAuthTag(ct.subarray(-16));
  const pt = Buffer.concat([d.update(ct.subarray(0, -16)), d.final()]);
  if (pt[pt.length - 1] !== 2) throw new Error("bad padding");
  return pt.subarray(0, -1).toString("utf8");
}
{
  const ua = browser(), server = await ephemeralKey();
  const text = JSON.stringify({ p: "fajr", at: 1, kind: "adhan", l: "ar", x: "الصلاة خير من النوم" });
  eq(decrypt(await encrypt(text, ua.keys, server), ua), text, "decrypted by node:crypto");
  // The same server key for two messages still gives two different bodies (new salt).
  check(b64u.encode(await encrypt(text, ua.keys, server)) !== b64u.encode(await encrypt(text, ua.keys, server)), "a new salt for every message");
}

// ---------- VAPID ----------
const keys = await vapidKeys();
{
  const v = new Vapid(keys.publicKey, keys.privateKey, "https://example.org/");
  const h = await v.header("https://fcm.googleapis.com/fcm/send/abc:def");
  const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(h);
  check(m && m[4] === keys.publicKey, "VAPID header form");
  const claims = JSON.parse(Buffer.from(b64u.decode(m[2])).toString());
  eq([claims.aud, claims.sub], ["https://fcm.googleapis.com", "https://example.org/"], "VAPID claims");
  check(claims.exp > Date.now() / 1000 + 11 * 3600 && claims.exp <= Date.now() / 1000 + 24 * 3600, "VAPID expiry within 24 hours");
  const pub = b64u.decode(keys.publicKey);
  const key = crypto.createPublicKey({ format: "jwk", key: { kty: "EC", crv: "P-256", x: b64u.encode(pub.slice(1, 33)), y: b64u.encode(pub.slice(33)) } });
  check(crypto.verify("sha256", Buffer.from(m[1] + "." + m[2]), { key, dsaEncoding: "ieee-p1363" }, b64u.decode(m[3])), "VAPID signature verifies");
  eq(await v.header("https://fcm.googleapis.com/fcm/send/other"), h, "one token per push service");
}

// ---------- the schedule ----------
const CAIRO = { lat: 30.0444, lng: 31.2357, tz: "Africa/Cairo", method: "egypt", asr: "std", high: "angle", adj: { isha: 2 }, hijriAdj: 0,
  mode: { fajr: "adhan", sunrise: "adhan", dhuhr: "adhan", asr: "notify", maghrib: "adhan", isha: "off" }, before: 15, lang: "ar" };
{
  const s = cleanSettings(CAIRO);
  eq([s.lat, s.lng, s.mode.sunrise], [30.04, 31.24, "notify"], "settings rounded, no adhan at sunrise");
  for (const [k, v] of [["tz", "Mars/Olympus"], ["method", "auto"], ["asr", "x"], ["before", 7.5], ["lat", 91], ["lang", "../x"], ["hijriAdj", 3], ["adj", { asr: 31 }], ["mode", { fajr: "loud" }]]) {
    let threw = false; try { cleanSettings({ ...CAIRO, [k]: v }); } catch { threw = true; }
    check(threw, `settings with a bad ${k} are refused`);
  }
  // Walk the alerts of four days from Friday 23 October 2026 (Cairo), and compare with prayer-calc directly.
  let cur = { at: Date.UTC(2026, 9, 22, 22, 0), rank: 99 }; const seen = [];
  for (let i = 0; i < 4 * 9; i++) { const e = nextAlert(s, cur); seen.push(e); cur = e; }
  check(seen.every((e, i) => !i || e.at > seen[i - 1].at || (e.at === seen[i - 1].at && e.rank > seen[i - 1].rank)), "alerts come in order, each once");
  const days = [23, 24, 25, 26].map(d => ({ y: 2026, m: 10, d }));
  const want = days.flatMap(day => {
    const x = prayerTimes(day, { lat: 30.04, lng: 31.24 }, { method: "egypt", asr: "std", high: "angle", adj: { isha: 2 } });
    const name = p => p === "dhuhr" && day.d === 23 ? "jumua" : p;
    return [["fajr", "adhan"], ["sunrise", "notify"], ["dhuhr", "adhan"], ["asr", "notify"], ["maghrib", "adhan"]].flatMap(([p, kind]) =>
      [...(p === "sunrise" ? [] : [[x[p] - 15 * 60000, name(p), "before"]]), [x[p], name(p), kind]]);
  }).sort((a, b) => a[0] - b[0]);
  eq(seen.map(e => [e.at, e.p, e.kind]), want, "four days of alerts in Cairo");
  check(seen.every(e => e.kind !== "before" || e.prayerAt - e.at === 15 * 60000), "reminders 15 minutes before");
  eq(dayOf(Date.UTC(2026, 9, 22, 22, 30), "Africa/Cairo"), { y: 2026, m: 10, d: 23 }, "the place's calendar day");
  eq(nextAlert({ ...s, mode: { fajr: "off", sunrise: "off", dhuhr: "off", asr: "off", maghrib: "off", isha: "off" } }, cur), null, "no alert when all are off");
}

// ---------- the Worker, on SQLite ----------
function d1() {
  const db = new DatabaseSync(":memory:");
  db.exec(fs.readFileSync(path.join(HERE, "migrations", "0001_subs.sql"), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    all: async () => ({ results: db.prepare(sql).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = db.prepare(sql).get(...args); return r ? { ...r } : null; },
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    sync: () => db.prepare(sql).run(...args),
  });
  return { db, prepare: sql => stmt(sql), batch: async list => { db.exec("BEGIN"); try { list.forEach(s => s.sync()); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; } } };
}
{
  const DB = d1();
  const env = { DB, VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "https://example.org/", ORIGINS: "https://hanyarafaosman.github.io", MAX_PUSH: "40" };
  const call = (method, p, data, origin = "https://hanyarafaosman.github.io") => worker.fetch(new Request("https://push.example" + p, { method, headers: { origin }, body: data === undefined ? undefined : typeof data === "string" ? data : JSON.stringify(data) }), env);
  const ua = browser(), endpoint = "https://fcm.googleapis.com/fcm/send/test-1";
  const sub = { endpoint, keys: ua.keys };

  let r = await call("OPTIONS", "/subscribe");
  eq([r.status, r.headers.get("access-control-allow-origin"), r.headers.get("access-control-allow-methods")], [204, "https://hanyarafaosman.github.io", "GET, POST, DELETE"], "CORS preflight");
  r = await call("GET", "/health", undefined, "https://evil.example");
  eq([r.status, r.headers.get("access-control-allow-origin"), (await r.json()).cron], [200, null, null], "health, no CORS for other pages");
  r = await call("POST", "/subscribe", { sub: { ...sub, endpoint: "https://evil.example/push" }, settings: CAIRO });
  eq(r.status, 400, "only browsers' push services");
  r = await call("POST", "/subscribe", { sub, settings: { ...CAIRO, method: "nope" } });
  eq([r.status, (await r.json()).error], [400, "bad method"], "bad settings refused");
  r = await call("POST", "/subscribe", "x".repeat(5000));
  eq(r.status, 413, "large bodies refused");
  r = await call("POST", "/subscribe", { sub, settings: CAIRO });
  const first = (await r.json()).next;
  eq([r.status, r.headers.get("access-control-allow-origin")], [200, "https://hanyarafaosman.github.io"], "subscribed");
  const row = () => DB.db.prepare("SELECT * FROM subs WHERE endpoint = ?").get(endpoint);
  const e1 = JSON.parse(row().next);
  eq([row().next_at, JSON.parse(row().settings).lat], [first, 30.04], "next alert and rounded place stored");
  check(first > Date.now() && first - Date.now() < 864e5, "the next alert is within a day");

  // The minute job at the time of that alert: one message, readable by the browser, then the alert after it.
  const sent = [];
  let answer = 201;
  globalThis.fetch = async (url, init) => { sent.push({ url, init }); return new Response(null, { status: answer }); };
  let st = await run(env, first);
  eq([st.sent, sent.length, sent[0]?.url], [1, 1, endpoint], "one message sent when due");
  const h = sent[0].init.headers;
  eq([h["Content-Encoding"], h.Urgency, h.Topic, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/.test(h.Authorization)], ["aes128gcm", "high", "prayer", true], "push headers");
  const ttl = Number(h.TTL);
  check(e1.kind === "before" ? Math.abs(ttl - 15 * 60) <= 1 : ttl === 600, "TTL: until the prayer for a reminder, 10 minutes at its time");
  eq(JSON.parse(decrypt(sent[0].init.body, ua)), { p: e1.p, at: e1.prayerAt, kind: e1.kind, l: "ar" }, "the message says which prayer, when and what");
  const second = row().next_at;
  eq(JSON.parse(row().next), nextAlert(cleanSettings(CAIRO), { ...e1, at: first }), "moved on to the next alert");
  eq(Number((await (await call("GET", "/health")).json()).cron), first, "health shows the minute job");

  // Not due yet: nothing goes out.
  sent.length = 0; st = await run(env, second - 60000);
  eq([st.due, sent.length], [0, 0], "nothing before its time");
  // A server error: the same alert is tried again next minute.
  answer = 503; st = await run(env, second);
  eq([st.retry, row().next_at], [1, second], "retried after a server error");
  // Far too late (the Worker was down): dropped, not sent.
  sent.length = 0; answer = 201;
  st = await run(env, JSON.parse(row().next).prayerAt + 11 * 60000);
  eq([st.late, sent.length], [1, 0], "a late alert is dropped");
  check(row().next_at > second, "and the next one is planned");
  // The browser's subscription ended: the row is deleted.
  answer = 410; st = await run(env, row().next_at);
  eq([st.gone, row()], [1, undefined], "an ended subscription is deleted");

  // Turning alerts off deletes the row; a replaced subscription deletes the old one.
  await call("POST", "/subscribe", { sub, settings: CAIRO });
  const sub2 = { endpoint: "https://web.push.apple.com/QH-test-2", keys: browser().keys };
  await call("POST", "/subscribe", { sub: sub2, settings: CAIRO, old: endpoint });
  eq([row(), DB.db.prepare("SELECT count(*) AS n FROM subs").get().n], [undefined, 1], "pushsubscriptionchange replaces the old row");
  r = await call("DELETE", "/unsubscribe", { endpoint: sub2.endpoint });
  eq([r.status, DB.db.prepare("SELECT count(*) AS n FROM subs").get().n], [200, 0], "unsubscribe deletes the row");

  // More due than MAX_PUSH: the rest wait for the next minute.
  for (let i = 0; i < 5; i++) await call("POST", "/subscribe", { sub: { endpoint: "https://fcm.googleapis.com/fcm/send/many-" + i, keys: browser().keys }, settings: CAIRO });
  sent.length = 0; answer = 201;
  st = await run({ ...env, MAX_PUSH: "3" }, first);
  eq([st.sent, DB.db.prepare("SELECT count(*) AS n FROM subs WHERE next_at <= ?").get(first).n], [3, 2], "at most MAX_PUSH per minute");
}

console.log(failed ? `✗ ${failed} of ${passed + failed} push checks failed` : `✓ push server: ${passed} checks passed`);
process.exit(failed ? 1 : 0);
