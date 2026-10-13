// Draws www/icons/og-image.jpg (1200×630), the preview image shown when a link to the website is shared
// in chat apps and social networks. Uses headless Chrome or Edge (set CHROME=path if it is elsewhere)
// and the Amiri font from Google Fonts, so it needs a connection. Run again after changing the design.
const fs = require("fs"), path = require("path"), os = require("os"), { spawnSync } = require("child_process");
const www = path.join(__dirname, "..", "www"), out = path.join(www, "icons", "og-image.jpg");
const candidates = [process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
const browser = candidates.find(p => p && fs.existsSync(p));
if (!browser) { console.error("✗ Chrome or Edge not found: set CHROME=path/to/browser"); process.exit(1); }

const icon = "file:///" + path.join(www, "icons", "icon-512.png").replace(/\\/g, "/");
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@500;700&display=block">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  body { display: flex; align-items: center; gap: 56px; padding: 0 88px; box-sizing: border-box; color: #fff;
    background: radial-gradient(circle at 18% 30%, rgba(233,196,106,.18), transparent 42%), linear-gradient(135deg, #0f766e, #0b4f4a); font-family: "Noto Naskh Arabic", serif; }
  .text { flex: 1; }
  h1 { margin: 0; font: 700 128px/1.15 Amiri, serif; }
  .sub { margin: 4px 0 28px; font: 400 44px/1.3 Amiri, serif; color: #e9c46a; }
  .features { font-size: 31px; font-weight: 500; line-height: 1.7; opacity: .95; }
  .chips { display: flex; gap: 14px; margin-top: 30px; }
  .chip { padding: 8px 22px; border-radius: 99px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28); font-size: 25px; font-weight: 700; }
  img { width: 300px; height: 300px; filter: drop-shadow(0 18px 40px rgba(0,0,0,.35)); }
</style></head><body>
  <div class="text">
    <h1>حصن المسلم</h1>
    <div class="sub">من أذكار الكتاب والسنة</div>
    <div class="features">أذكار الصباح والمساء والنوم مع العداد والصوت<br>المصحف بثماني روايات، وكتب السنة، والتلاوات والإذاعات</div>
    <div class="chips"><span class="chip">مجاني بلا إعلانات</span><span class="chip">يعمل دون إنترنت</span></div>
  </div>
  <img src="${icon}" alt="">
</body></html>`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hisn-og-")); const page = path.join(dir, "og.html");
fs.writeFileSync(page, html);
const r = spawnSync(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1200,630",
  "--virtual-time-budget=10000", "--allow-file-access-from-files", `--user-data-dir=${path.join(dir, "profile")}`, `--screenshot=${out}`, "file:///" + page.replace(/\\/g, "/")], { encoding: "utf8", timeout: 60000 });
fs.rmSync(dir, { recursive: true, force: true });
if (r.status !== 0 || !fs.existsSync(out)) { console.error("✗ screenshot failed", r.error || r.stderr); process.exit(1); }
console.log("✓", path.relative(process.cwd(), out), fs.statSync(out).size, "bytes");
