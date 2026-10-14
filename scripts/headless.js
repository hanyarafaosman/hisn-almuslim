// Screenshots with headless Chrome or Edge (set CHROME=path if it is elsewhere), for the share image and the
// Google Play listing. shoot() captures a web address, shootHtml() a page written here.
// The format follows the file extension (.png or .jpg). Pages can use the app's fonts through FONTS_CSS.
// Headless Chrome will not make its window narrower than about 500px (a 360×640 window gives a 483×540 page),
// so pages drawn here have a fixed size, start at the left edge, and phone-sized views go in an iframe.
const fs = require("fs"), path = require("path"), os = require("os"), { spawn } = require("child_process");
const www = path.join(__dirname, "..", "www");
const fileUrl = p => "file:///" + p.replace(/\\/g, "/");
const FONTS_CSS = fileUrl(path.join(www, "css", "fonts.css"));

const candidates = [process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
function browser() {
  const b = candidates.find(p => p && fs.existsSync(p));
  if (!b) throw new Error("Chrome or Edge not found: set CHROME=path/to/browser");
  return b;
}

// width/height are CSS pixels; the image is scale times larger. lang sets the browser language (navigator.languages).
// Asynchronous, so a local server in the same process can answer the browser.
async function shoot(url, out, { width, height, scale = 1, lang = "ar", wait = 10000 }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hisn-shot-"));
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true }); fs.rmSync(out, { force: true });
    const args = ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--force-device-scale-factor=${scale}`, `--window-size=${width},${height}`,
      `--lang=${lang}`, `--virtual-time-budget=${wait}`, "--allow-file-access-from-files", `--user-data-dir=${path.join(dir, "profile")}`, `--screenshot=${out}`, url];
    const code = await new Promise((resolve, reject) => {
      const p = spawn(browser(), args, { stdio: "ignore" });
      const timer = setTimeout(() => p.kill(), 120000);
      p.on("error", reject); p.on("exit", c => { clearTimeout(timer); resolve(c); });
    });
    if (code !== 0 || !fs.existsSync(out)) throw new Error(`screenshot of ${url} failed (exit ${code})`);
    console.log("✓", path.relative(process.cwd(), out), Math.round(fs.statSync(out).size / 1024) + " KB");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
async function shootHtml(html, out, opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hisn-page-")); const page = path.join(dir, "page.html");
  try { fs.writeFileSync(page, html); await shoot(fileUrl(page), out, opts); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
module.exports = { shoot, shootHtml, fileUrl, FONTS_CSS, www };
