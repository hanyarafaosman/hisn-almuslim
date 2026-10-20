// Zero-dependency static dev server for the www/ folder (or another folder: node scripts/serve.js _site).
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", process.argv[2] || "www");
const port = Number(process.env.PORT) || 5173;
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".aac": "audio/aac" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) {
      // Like GitHub Pages: a built site's 404.html answers unknown addresses.
      return fs.readFile(path.join(root, "404.html"), (e2, page) => {
        res.writeHead(404, { "Content-Type": e2 ? "text/plain; charset=utf-8" : mime[".html"] }); res.end(e2 ? "404 Not Found" : page);
      });
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}).listen(port, () => console.log(`حصن ونور dev server → http://localhost:${port} (${path.relative(process.cwd(), root) || "."})`));
