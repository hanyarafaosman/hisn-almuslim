// Generates PNG app icons without any dependencies (shield + crescent on teal).
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const out = path.join(__dirname, "..", "www", "icons");
fs.mkdirSync(out, { recursive: true });

const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, "ascii"), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const BG = [15, 118, 110], BG2 = [11, 92, 86], WHITE = [255, 255, 255], GOLD = [233, 196, 106];
const inRoundedSquare = (x, y, r) => { const ax = Math.abs(x), ay = Math.abs(y); if (ax > 1 || ay > 1) return false; if (ax < 1 - r || ay < 1 - r) return true; return (ax - (1 - r)) ** 2 + (ay - (1 - r)) ** 2 <= r * r; };
function inShield(x, y) { // shield spans x,y in [-1,1]
  if (y < -1 || y > 1 || Math.abs(x) > 1) return false;
  if (y <= 0.05) { const r = 0.22; if (y < -1 + r && Math.abs(x) > 1 - r) { const cx = Math.sign(x) * (1 - r), cy = -1 + r; return (x - cx) ** 2 + (y - cy) ** 2 <= r * r; } return true; }
  const t = (y - 0.05) / 0.95; return Math.abs(x) <= Math.pow(1 - t * t, 0.62);
}
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
function inCrescent(x, y) { return inCircle(x, y, 0.0, -0.18, 0.5) && !inCircle(x, y, 0.2, -0.26, 0.42); }
function inStar(x, y, cx, cy, r) { // 5-point star
  const dx = x - cx, dy = y - cy; const d = Math.hypot(dx, dy); if (d > r) return false;
  let a = Math.atan2(dy, dx) + Math.PI / 2; a = ((a % (2 * Math.PI / 5)) + 2 * Math.PI / 5) % (2 * Math.PI / 5) - Math.PI / 5;
  const inner = r * 0.45; const edge = inner * r / (inner + (r - inner) * Math.abs(a) / (Math.PI / 5)); return d <= edge * 1.0 + (r - inner) * (1 - Math.abs(a) / (Math.PI / 5)) * 0.0 || d <= inner;
}
function render(size, { maskable = false, pad = 0.14 } = {}) {
  const buf = Buffer.alloc(size * size * 4); const ss = 3; // supersampling
  const scale = maskable ? 0.52 : 0.64; // shield half-size relative to half-canvas
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const acc = [0, 0, 0, 0];
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const x = ((px + (sx + 0.5) / ss) / size) * 2 - 1, y = ((py + (sy + 0.5) / ss) / size) * 2 - 1;
      let c = null;
      const bgIn = maskable ? true : inRoundedSquare(x, y, 0.42);
      if (bgIn) { const g = (y + 1) / 2; c = BG.map((v, i) => v * (1 - g) + BG2[i] * g); }
      const sxp = x / scale, syp = (y + 0.02) / scale;
      if (inShield(sxp, syp)) { c = WHITE; if (inCrescent(sxp, syp)) c = BG; if (inStar(sxp, syp, 0.42, -0.42, 0.17)) c = GOLD; }
      if (c) { acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 255; }
    }
    const n = ss * ss, a = acc[3] / n, i = (py * size + px) * 4;
    if (a > 0) { buf[i] = acc[0] / (acc[3] / 255); buf[i + 1] = acc[1] / (acc[3] / 255); buf[i + 2] = acc[2] / (acc[3] / 255); }
    buf[i + 3] = a;
  }
  return png(size, size, buf);
}
const files = { "icon-192.png": [192, {}], "icon-512.png": [512, {}], "maskable-512.png": [512, { maskable: true }], "apple-touch-icon.png": [180, { maskable: true }], "favicon-32.png": [32, {}] };
for (const [name, [size, opts]] of Object.entries(files)) { fs.writeFileSync(path.join(out, name), render(size, opts)); console.log("✓", name); }
