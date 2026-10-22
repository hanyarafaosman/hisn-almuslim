// A stand-in for the question server, for working on the app's page without Cloudflare: it answers every question
// with two real passages of www/kutub (the first paragraphs of two reading pages), a personal case with a referral,
// and a question containing «لا شيء» with «لم أجد». Usage: node faqih/mock.js [port] (default 8787), then on the
// app's localhost page: localStorage.faqihServer = JSON.stringify({ url: "http://localhost:8787" }).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanQuestion, isPersonal } from "./src/prompt.js";
import { stripMarks } from "../scripts/faqih-chunk.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const KUTUB = path.join(ROOT, "www", "kutub");
const ix = JSON.parse(fs.readFileSync(path.join(KUTUB, "index.json"), "utf8"));
const PLACES = [["mughni", 3], ["mawsua-kuwaitiya", 8223], ["zad", 9]];
const items = PLACES.flatMap(([id, s]) => {
  const b = ix.books.find(x => x.id === id); if (!b) return [];
  const head = JSON.parse(fs.readFileSync(path.join(KUTUB, b.file), "utf8")); const sec = head.sections[s]; if (!sec || sec.c == null) return [];
  const text = JSON.parse(fs.readFileSync(path.join(KUTUB, id, `${sec.c}.${b.chunks[sec.c]}.json`), "utf8"))[s];
  const p0 = text.body.findIndex(x => x.p); const p = stripMarks(text.body[p0].p);
  const quote = p.length > 160 ? p.slice(0, p.lastIndexOf(" ", 160)) + " …" : p;
  const it = { n: 1, quote, note: id === "mughni" ? "قول الحنابلة كما في المغني" : "", b: id, s, p0, p1: p0, h: head.sections.slice(0, s + 1).filter(x => x.l <= sec.l).map(x => x.t).slice(-2).join(" › ") };
  if (sec.pg) { it.pg0 = sec.pg[0]; it.pg1 = sec.pg[1]; } if (sec.v) { it.v0 = sec.v[0]; it.v1 = sec.v[1]; }
  return [it];
});
let n = 0;
http.createServer(async (req, res) => {
  const cors = { "access-control-allow-origin": req.headers.origin || "*", "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type", "content-type": "application/json; charset=utf-8" };
  if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
  if (req.method === "GET") return res.writeHead(200, cors).end(JSON.stringify({ ok: true, day: new Date().toISOString().slice(0, 10), n, limit: 500, now: Date.now() }));
  let body = ""; for await (const c of req) body += c;
  let q; try { q = cleanQuestion(JSON.parse(body).q); } catch { q = null; }
  if (!q) return res.writeHead(400, cors).end(JSON.stringify({ ok: false, error: "bad question" }));
  n++; await new Promise(r => setTimeout(r, 1200)); // the real server takes a few seconds
  if (isPersonal(q)) return res.writeHead(200, cors).end(JSON.stringify({ status: "refer_to_scholar", summary: "", items: [], dropped: 0 }));
  if (q.includes("لا شيء")) return res.writeHead(200, cors).end(JSON.stringify({ status: "not_found", summary: "", items: [], dropped: 0 }));
  res.writeHead(200, cors).end(JSON.stringify({ status: "answer", summary: `(تجربة) هذا جواب تجريبي عن «${q}»: ذكر ابن قدامة في المغني أن الطهارة لا تحصل إلا بالماء، وذكرت الموسوعة الفقهية الكويتية أقوال المذاهب في المسألة.`, items, dropped: 1 }));
}).listen(Number(process.argv[2]) || 8787, () => console.log(`mock faqih server on http://localhost:${Number(process.argv[2]) || 8787} with ${items.length} passages`));
