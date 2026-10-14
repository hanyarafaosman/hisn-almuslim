// Images for the Google Play listing, drawn with headless Chrome (scripts/headless.js):
//   www/screenshots/<name>.jpg          phone screenshots of the app (1080×1920), also listed in the web manifest
//   store/android/screenshots/<n>.jpg   the same screenshots with a caption, for the Play listing
//   store/android/feature-graphic.jpg   1024×500 banner at the top of the listing
//   store/android/icon-512.png          512×512 icon (full square: Google Play rounds the corners itself)
// The app is served from www/ by a small local server; Mushaf page fonts and hadith texts still need a connection.
const fs = require("fs"), path = require("path"), http = require("http");
const { shoot, shootHtml, fileUrl, FONTS_CSS, www } = require("./headless");
const store = path.join(__dirname, "..", "store", "android");

// Route in the app, file name, caption on the store image.
const SCREENS = [
  ["#/", "home", "كل ما يحتاجه المسلم في يومه"],
  ["#/cat/27?p=morning", "adhkar", "أذكار الصباح والمساء مع العداد والصوت"],
  ["#/quran/hafs/36", "quran", "المصحف بثماني روايات بخط مجمع الملك فهد"],
  ["#/mushaf/1421/1", "mushaf", "صفحات مصحف المدينة كما في المطبوع"],
  ["#/hadith/bukhari/1", "hadith", "الكتب الستة والأربعون النووية والقدسية"],
  ["#/tasbih", "tasbih", "سبحة إلكترونية تحفظ عدّك"],
];
const W = 360, H = 640, SCALE = 3; // 1080×1920

// www/ plus /__frame?r=<route>: the app in an iframe of exactly W×H on the same origin, so it runs as it does on a phone.
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/__frame") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><body style="margin:0;overflow:hidden"><iframe src="/${url.searchParams.get("r")}" style="border:0;display:block;width:${W}px;height:${H}px"></iframe>`);
  }
  const file = path.normalize(path.join(www, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)));
  if (!file.startsWith(www)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" }); res.end(data);
  });
});

const brand = "background: radial-gradient(circle at 20% 15%, rgba(233,196,106,.22), transparent 45%), linear-gradient(160deg, #0f766e, #0b4f4a); color: #fff;";
(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [i, [route, name, caption]] of SCREENS.entries()) {
    const raw = path.join(www, "screenshots", name + ".jpg");
    await shoot(`${base}/__frame?r=${encodeURIComponent(route)}`, raw, { width: W, height: H, scale: SCALE, wait: 15000 });
    await shootHtml(`<!doctype html><html lang="ar"><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS_CSS}"><style>
      html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; }
      body { ${brand} display: flex; flex-direction: column; align-items: center; font-family: "Noto Naskh Arabic", serif; }
      h1 { margin: 34px 24px 20px; font: 700 25px/1.45 Amiri, serif; text-align: center; }
      img { width: 268px; border-radius: 22px; border: 5px solid #0a3d39; box-shadow: 0 18px 44px rgba(0,0,0,.4); }
    </style></head><body><h1 dir="rtl">${caption}</h1><img src="${fileUrl(raw)}" alt=""></body></html>`,
    path.join(store, "screenshots", `${i + 1}-${name}.jpg`), { width: W, height: H, scale: SCALE });
  }
  server.close();

  await shootHtml(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS_CSS}"><style>
    html, body { margin: 0; width: 1024px; height: 500px; overflow: hidden; }
    body { ${brand} display: flex; align-items: center; gap: 48px; padding: 0 72px; box-sizing: border-box; font-family: "Noto Naskh Arabic", serif; }
    .text { flex: 1; }
    h1 { margin: 0; font: 700 112px/1.15 Amiri, serif; }
    p { margin: 6px 0 0; font: 400 38px/1.4 Amiri, serif; color: #e9c46a; }
    img { width: 250px; height: 250px; filter: drop-shadow(0 16px 36px rgba(0,0,0,.35)); }
  </style></head><body><div class="text"><h1>حصن المسلم</h1><p>أذكار ومصحف وكتب السنة</p></div><img src="${fileUrl(path.join(www, "icons", "icon-512.png"))}" alt=""></body></html>`,
  path.join(store, "feature-graphic.jpg"), { width: 1024, height: 500 });

  fs.copyFileSync(path.join(www, "icons", "maskable-512.png"), path.join(store, "icon-512.png"));
  console.log("✓ store/android/icon-512.png");
})().catch(e => { console.error("✗", e.message); server.close(); process.exit(1); });
