// Builds www/adhan/: the adhan recordings played at prayer times, with their sources and licences (adhan/index.json).
// Each recording comes from Wikimedia Commons under a free licence, pinned by the SHA-1 Commons gives for the file.
// Only the adhan itself is kept (from its first takbir to the end of the last «لا إله إلا الله»); it is mixed to mono,
// brought to one loudness, and encoded as AAC (ADTS, 96 kb/s: the lowest rate the Windows encoder takes), which every
// browser and phone plays. Headless Chrome does the decoding and encoding (Web Audio and WebCodecs), so no other
// program is needed.
// Each file is written as adhan/<id>.<hash>.aac, so a corrected recording gets a new name and devices never keep an old copy.
// Usage: node scripts/build-adhan.js   (set CHROME=path if Chrome or Edge is elsewhere)
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http"), crypto = require("crypto"), { spawn } = require("child_process");
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "adhan");
const OUT = path.join(ROOT, "www", "adhan");
const UA = "hisn-almuslim-build/1.0 (https://github.com/hanyarafaosman/hisn-almuslim)";

// start/end: seconds of the source kept (end: null = to the end). short: where the four opening takbirs end, in the
// kept recording (for the "takbirs only" choice). The boundaries were read from the loudness of each recording:
// the pauses between the sentences of the adhan are clear in all three.
// fajr: the recording includes «الصلاة خير من النوم» and is offered for Fajr only.
const VOICES = [
  {
    id: "madinah", commons: "33937 ejaz215 call-to-prayer-from-the-prophet-s-mo.ogg", sha1: "4aa432b9e44804e7d72af4429bd743aa5fa9e3a4",
    start: 0.8, end: null, fadeOut: 0.3, short: 36.2,
    by: "ejaz215", license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/", origin: "https://freesound.org/people/ejaz215/sounds/33937/",
  },
  {
    id: "shalqar", commons: "Adhan in Shalqar mosque.webm", sha1: "5d7301c0c142d8e5d8f281f4dd02846eaf05529b",
    start: 2.9, end: 134.2, fadeOut: 0.8, short: 21.7,
    by: "Esetok", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  {
    id: "malmo-fajr", commons: "Eid al-Fitr Fajr azan at Malmö Mosque - 19 August 2012.webm", sha1: "bc75d5cee271efb67f03d3f35474a9362fce103f",
    start: 12.5, end: null, fadeOut: 0.6, short: 35.5, fajr: true,
    by: "Islamic Center Malmö", license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  },
];

const commonsPage = f => "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(f.replace(/ /g, "_"));
async function source(v) {
  const file = path.join(CACHE, v.id + path.extname(v.commons));
  const sha1 = b => crypto.createHash("sha1").update(b).digest("hex");
  if (fs.existsSync(file) && sha1(fs.readFileSync(file)) === v.sha1) return file;
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|sha1&titles=${encodeURIComponent("File:" + v.commons)}`;
  const info = Object.values((await (await fetch(api, { headers: { "user-agent": UA } })).json()).query.pages)[0].imageinfo?.[0];
  if (!info) throw new Error(`${v.id}: ${v.commons} is no longer on Commons`);
  if (info.sha1 !== v.sha1) throw new Error(`${v.id}: the file on Commons changed (sha1 ${info.sha1}); listen to it and set new boundaries`);
  console.log(`↓ ${v.commons}`);
  const res = await fetch(info.url.split("?")[0], { headers: { "user-agent": UA } }); if (!res.ok) throw new Error(`${v.id}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer()); if (sha1(buf) !== v.sha1) throw new Error(`${v.id}: download does not match its sha1`);
  fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(file, buf); return file;
}

// The page that decodes, cuts, levels and encodes every recording, then sends the result back.
const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
const SR = 44100, jobs = await (await fetch("/jobs")).json();
for (const j of jobs) {
  try {
    const ab = await new OfflineAudioContext(1, 1, SR).decodeAudioData(await (await fetch("/src/" + j.id)).arrayBuffer());
    const a = Math.round(j.start * SR), b = j.end ? Math.min(ab.length, Math.round(j.end * SR)) : ab.length, n = b - a;
    const x = new Float32Array(n);
    for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) x[i] += d[a + i] / ab.numberOfChannels; }
    // Loudness: the voiced 100 ms blocks (within 25 dB of the loudest) brought to -18 dBFS, peaks kept under -1 dBFS.
    const B = SR / 10, blocks = []; let peak = 0;
    for (let i = 0; i < n; i += B) { let e = 0; for (let k = i; k < Math.min(n, i + B); k++) { e += x[k] * x[k]; peak = Math.max(peak, Math.abs(x[k])); } blocks.push(e / B); }
    const top = Math.max(...blocks), voiced = blocks.filter(e => e > top / 316);
    const level = 10 * Math.log10(voiced.reduce((s, e) => s + e, 0) / voiced.length);
    const gain = Math.min(10 ** ((-18 - level) / 20), 0.89 / peak);
    const fin = 0.15 * SR, fout = j.fadeOut * SR;
    for (let i = 0; i < n; i++) x[i] *= gain * Math.min(1, i / fin, (n - 1 - i) / fout);
    const chunks = []; let failed = null;
    const enc = new AudioEncoder({ output: ch => { const u = new Uint8Array(ch.byteLength); ch.copyTo(u); chunks.push(u); }, error: e => { failed = e; } });
    const cfg = { codec: "mp4a.40.2", sampleRate: SR, numberOfChannels: 1, bitrate: 96000, aac: { format: "adts" } };
    if (!(await AudioEncoder.isConfigSupported(cfg)).supported) throw new Error("this browser cannot encode AAC");
    enc.configure(cfg);
    for (let i = 0; i < n; i += 4096) { const len = Math.min(4096, n - i); enc.encode(new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: len, numberOfChannels: 1, timestamp: Math.round(i / SR * 1e6), data: x.slice(i, i + len) })); }
    await enc.flush(); if (failed) throw failed;
    await fetch("/out/" + j.id + "?seconds=" + (n / SR).toFixed(2) + "&gain=" + (20 * Math.log10(gain)).toFixed(1), { method: "POST", body: new Blob(chunks) });
  } catch (e) { await fetch("/fail/" + j.id, { method: "POST", body: String(e && e.stack || e) }); }
}
await fetch("/done", { method: "POST" });
</script>`;

const browser = () => [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(p => p && fs.existsSync(p));

(async () => {
  const files = {}; for (const v of VOICES) files[v.id] = await source(v);
  const results = {}; let finish;
  const done = new Promise(r => { finish = r; });
  const body = req => new Promise(r => { const c = []; req.on("data", d => c.push(d)).on("end", () => r(Buffer.concat(c))); });
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x"), [, kind, id] = u.pathname.split("/");
    if (kind === "page") { res.setHeader("content-type", "text/html; charset=utf-8"); return res.end(PAGE); }
    if (kind === "jobs") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify(VOICES.map(({ id, start, end, fadeOut }) => ({ id, start, end, fadeOut })))); }
    if (kind === "src" && files[id]) return fs.createReadStream(files[id]).pipe(res);
    if (kind === "out") { results[id] = { aac: await body(req), seconds: Number(u.searchParams.get("seconds")), gain: u.searchParams.get("gain") }; return res.end("ok"); }
    if (kind === "fail") { results[id] = { error: String(await body(req)) }; return res.end("ok"); }
    if (kind === "done") { res.end("ok"); return finish(); }
    res.statusCode = 404; res.end();
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const exe = browser(); if (!exe) throw new Error("Chrome or Edge not found: set CHROME=path/to/browser");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "hisn-adhan-"));
  const chrome = spawn(exe, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, `http://127.0.0.1:${server.address().port}/page`], { stdio: "ignore" });
  const timer = setTimeout(finish, 300000);
  await done; clearTimeout(timer); chrome.kill(); server.close();
  setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 1000);

  fs.mkdirSync(OUT, { recursive: true });
  const index = { source: "Wikimedia Commons", voices: [] }; let failed = false;
  for (const v of VOICES) {
    const r = results[v.id];
    if (!r || r.error) { failed = true; console.error(`✗ ${v.id}: ${r ? r.error : "no result (timeout)"}`); continue; }
    if (!(r.aac[0] === 0xff && (r.aac[1] & 0xf0) === 0xf0)) { failed = true; console.error(`✗ ${v.id}: not an ADTS stream`); continue; }
    const hash = crypto.createHash("sha256").update(r.aac).digest("hex").slice(0, 10);
    const file = `adhan/${v.id}.${hash}.aac`;
    fs.writeFileSync(path.join(ROOT, "www", file), r.aac);
    index.voices.push({ id: v.id, file, bytes: r.aac.length, seconds: r.seconds, short: v.short, ...(v.fajr ? { fajr: true } : {}),
      by: v.by, license: v.license, licenseUrl: v.licenseUrl, url: commonsPage(v.commons), ...(v.origin ? { origin: v.origin } : {}) });
    console.log(`✓ ${file} ${Math.round(r.aac.length / 1024)} KB, ${r.seconds} s, gain ${r.gain} dB`);
  }
  if (failed) process.exit(1);
  const keep = new Set(index.voices.map(v => path.basename(v.file)).concat("index.json"));
  for (const f of fs.readdirSync(OUT)) if (!keep.has(f)) { fs.rmSync(path.join(OUT, f)); console.log("removed old " + f); }
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1) + "\n");
  console.log(`✓ adhan/index.json: ${index.voices.length} recordings`);
})().catch(e => { console.error("✗", e.message); process.exit(1); });
