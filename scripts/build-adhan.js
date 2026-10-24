// Builds www/adhan/: the adhan recordings played at prayer times, with their sources and licences (adhan/index.json).
// Most come from Wikimedia Commons under a free licence. The voices of the famous Egyptian reciters and of the muezzins of
// Makkah and Madinah exist under no free licence: those are copies from the Internet Archive (archive.org) and from
// islamweb.net that carry no licence, added at the owner's request; their rights belong to their holders, and a file is
// removed if they ask.
// Every file is pinned by its SHA-1 (for Commons and archive.org, the one they give for it).
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
// the pauses between the sentences of the adhan are clear in all of them (12 sentences, 14 at Fajr).
// fajr: the recording includes «الصلاة خير من النوم» and is offered for Fajr only.
// group: where the voice is listed (hijaz: Makkah and Madinah, egypt: Egyptian reciters, world: other mosques).
// commons: a file on Wikimedia Commons; archive: [item, file] on archive.org; islamweb: an audio id on islamweb.net.
const VOICES = [
  {
    id: "madinah", group: "hijaz", commons: "33937 ejaz215 call-to-prayer-from-the-prophet-s-mo.ogg", sha1: "4aa432b9e44804e7d72af4429bd743aa5fa9e3a4",
    start: 0.8, end: null, fadeOut: 0.3, short: 36.2,
    by: "ejaz215", license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/", origin: "https://freesound.org/people/ejaz215/sounds/33937/",
  },
  // Sheikh Ali Ahmed Mulla, Masjid al-Haram: Isha, 12 Rabi al-Awwal 1434.
  { id: "makkah-mulla", group: "hijaz", archive: ["IshaAthan12-3-1434SheikhAliMulla", "IshaAthan12-3-1434SheikhAliMulla.mp3"], sha1: "943e2d4d133144e6b543626f68760dfa434e2f76", start: 0, end: null, fadeOut: 0.6, short: 34.6 },
  // Sheikh Abdulmajeed al-Surayhi, his first adhan at the Prophet's Mosque (2 Ramadan 1432).
  { id: "madinah-surayhi", group: "hijaz", archive: ["AbdulMajeed_Al-Suraihy_Athan", "Sheikh_AbdulMajeed_Al-Suraihy_1st_AThan_In_Madina_2-9-1432.mp3"], sha1: "a16cf3834aa0188e5e0e18c45d8faf989447b067", start: 0, end: null, fadeOut: 0.5, short: 25.6 },
  // «The sad adhan»: al-Surayhi while he was the muezzin of Quba Mosque.
  { id: "sad", group: "hijaz", archive: ["bel_319", "لأذان الحزين بصوت عبد المجيد السريحي.mp3"], sha1: "5dfb0c1fff41b40ce26a91ccb340659a1cae29e6", start: 0, end: null, fadeOut: 0.5, short: 34.2 },
  // Sheikh Ali Ahmed Mulla, Fajr at Masjid al-Haram, 6 September 2013.
  { id: "makkah-mulla-fajr", group: "hijaz", fajr: true, archive: ["MakkahFajrAdhan6913SheikhAliMullah", "Makkah Fajr Adhan 6-9-13 Sheikh Ali Mullah.mp3"], sha1: "78f046f1d0db691842b9f5032148469b0f1415fa", start: 0, end: 241, fadeOut: 0.5, short: 29.8 },
  // Sheikh Abdul Basit Abdus Samad: «أذان القاهرة» on islamweb.net (الشبكة الإسلامية); the owner confirmed the voice.
  { id: "basit", group: "egypt", islamweb: 122664, sha1: "58ba0a31bcb194d2815911662c0857f9301b2829", start: 0.4, end: null, fadeOut: 0.4, short: 26.5 },
  // Sheikh Mohamed Refaat: Maghrib.
  { id: "refaat", group: "egypt", archive: ["hasan_20190421", "اذان المغرب لفضيلة الشيخ محمد رفعت رحمة الله.mp3"], sha1: "5a89d9b2fdecb5bc2532b27268e1c102b49fb5c2", start: 0.8, end: null, fadeOut: 0.8, short: 26.9 },
  { id: "husary", group: "egypt", archive: ["20240913_20240913_1950", "الحصري الأذان.mp3"], sha1: "b0d456998d6b144cc7a651da5d0a94de2b6f2f85", start: 0.5, end: 221, fadeOut: 0.5, short: 32.1 },
  // Sheikh Mohamed Siddiq al-Minshawi, the 1950s.
  { id: "minshawi", group: "egypt", archive: ["20230209_20230209_1744", "اذان نادر جدا تخشع له القلوب بصوت الشيخ محمد صديق المنشاوي من فترة الخمسينات.mp3"], sha1: "5d476b15d7e095201f538a9e2c696448632e3cfe", start: 0.8, end: null, fadeOut: 0.3, short: 25.9 },
  // Sheikh Abdul Basit's Fajr adhan as Maspero Zaman (Egyptian TV) airs it: the MP4 archive.org made from the TV capture,
  // whose MP2 sound browsers cannot decode.
  { id: "basit-fajr", group: "egypt", fajr: true, archive: ["20200520_20200520_2319", "عبد الباسط آذان الفجر.mp4"], sha1: "213f64f85bfe2bef087d7af7a3c441895de6d743", start: 0.5, end: null, fadeOut: 0.5, short: 19.9 },
  {
    id: "shalqar", group: "world", commons: "Adhan in Shalqar mosque.webm", sha1: "5d7301c0c142d8e5d8f281f4dd02846eaf05529b",
    start: 2.9, end: 134.2, fadeOut: 0.8, short: 21.7,
    by: "Esetok", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  {
    id: "malmo-fajr", group: "world", commons: "Eid al-Fitr Fajr azan at Malmö Mosque - 19 August 2012.webm", sha1: "bc75d5cee271efb67f03d3f35474a9362fce103f",
    start: 12.5, end: null, fadeOut: 0.6, short: 35.5, fajr: true,
    by: "Islamic Center Malmö", license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  },
];

const commonsPage = f => "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(f.replace(/ /g, "_"));
const pageOf = v => v.commons ? commonsPage(v.commons) : v.archive ? "https://archive.org/details/" + v.archive[0]
  : "https://audio.islamweb.net/audio/index.php?page=audioinfo&audioid=" + v.islamweb;
// The download address and SHA-1 the source gives for the file now.
async function locate(v) {
  // islamweb.net gives no SHA-1: only the download itself is checked.
  if (v.islamweb) return { url: "https://audio.islamweb.net/audio/downloadmp3.php?audioid=" + v.islamweb, sha1: null };
  if (v.archive) {
    const [item, name] = v.archive;
    const meta = await (await fetch(`https://archive.org/metadata/${item}`, { headers: { "user-agent": UA } })).json();
    const f = (meta.files || []).find(x => x.name === name);
    if (!f) throw new Error(`${v.id}: ${name} is no longer on archive.org`);
    return { url: `https://archive.org/download/${item}/${encodeURIComponent(name)}`, sha1: f.sha1 };
  }
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|sha1&titles=${encodeURIComponent("File:" + v.commons)}`;
  const info = Object.values((await (await fetch(api, { headers: { "user-agent": UA } })).json()).query.pages)[0].imageinfo?.[0];
  if (!info) throw new Error(`${v.id}: ${v.commons} is no longer on Commons`);
  return { url: info.url.split("?")[0], sha1: info.sha1 };
}
async function source(v) {
  const sha1 = b => crypto.createHash("sha1").update(b).digest("hex");
  const file = path.join(CACHE, v.id + (v.islamweb ? ".mp3" : path.extname(v.commons || v.archive[1]).toLowerCase()));
  if (fs.existsSync(file) && sha1(fs.readFileSync(file)) === v.sha1) return file;
  const info = await locate(v);
  if (info.sha1 && info.sha1 !== v.sha1) throw new Error(`${v.id}: the source file changed (sha1 ${info.sha1}); listen to it and set new boundaries`);
  console.log(`↓ ${v.commons || (v.archive ? v.archive.join("/") : "islamweb.net audio " + v.islamweb)}`);
  const res = await fetch(info.url, { headers: { "user-agent": UA } }); if (!res.ok) throw new Error(`${v.id}: HTTP ${res.status}`);
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
  // Windows may keep the profile locked a while after Chrome exits: retry, and leave the temp folder if it stays locked.
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch {} }, 1000);

  fs.mkdirSync(OUT, { recursive: true });
  const index = { source: "Wikimedia Commons, archive.org, islamweb.net", voices: [] }; let failed = false;
  for (const v of VOICES) {
    const r = results[v.id];
    if (!r || r.error) { failed = true; console.error(`✗ ${v.id}: ${r ? r.error : "no result (timeout)"}`); continue; }
    if (!(r.aac[0] === 0xff && (r.aac[1] & 0xf0) === 0xf0)) { failed = true; console.error(`✗ ${v.id}: not an ADTS stream`); continue; }
    const hash = crypto.createHash("sha256").update(r.aac).digest("hex").slice(0, 10);
    const file = `adhan/${v.id}.${hash}.aac`;
    fs.writeFileSync(path.join(ROOT, "www", file), r.aac);
    // A copy from archive.org or islamweb.net has no licence: by is the site, and url its page there.
    index.voices.push({ id: v.id, group: v.group, file, bytes: r.aac.length, seconds: r.seconds, short: v.short, ...(v.fajr ? { fajr: true } : {}),
      ...(v.commons ? { by: v.by, license: v.license, licenseUrl: v.licenseUrl } : { by: v.archive ? "archive.org" : "islamweb.net" }), url: pageOf(v), ...(v.origin ? { origin: v.origin } : {}) });
    console.log(`✓ ${file} ${Math.round(r.aac.length / 1024)} KB, ${r.seconds} s, gain ${r.gain} dB`);
  }
  if (failed) process.exit(1);
  const keep = new Set(index.voices.map(v => path.basename(v.file)).concat("index.json"));
  for (const f of fs.readdirSync(OUT)) if (!keep.has(f)) { fs.rmSync(path.join(OUT, f)); console.log("removed old " + f); }
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1) + "\n");
  console.log(`✓ adhan/index.json: ${index.voices.length} recordings`);
})().catch(e => { console.error("✗", e.message); process.exit(1); });
