// Draws www/icons/og-image.jpg (1200×630), the preview image shown when a link to the website is shared
// in chat apps and social networks, with headless Chrome (scripts/headless.js) and the app's own fonts.
// It shows every part of the app with the app's own icon and Arabic name, read from TOOL_GROUPS in js/app.js,
// so run it again (npm run og) after adding a part to the app or changing the design.
const fs = require("fs"), path = require("path");
const { shootHtml, fileUrl, FONTS_CSS, www } = require("./headless");

const AR = JSON.parse(fs.readFileSync(path.join(www, "i18n", "ar.json"), "utf8"));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// The parts of the app as Home and the Tools tab list them, without the last group (favourites and settings).
const groups = /const TOOL_GROUPS = \[([\s\S]*?)\r?\n\];/.exec(fs.readFileSync(path.join(www, "js", "app.js"), "utf8"));
const mine = groups ? groups[1].indexOf('"tools.mine"') : -1;
if (mine < 0) throw new Error("www/js/app.js no longer has TOOL_GROUPS ending with the tools.mine group");
const tools = [...groups[1].slice(0, mine).matchAll(/\["#\/\w+", "([\w-]+)", "([\w.]+)"\]/g)].map(([, icon, key]) => {
  if (AR[key] == null) throw new Error("missing i18n/ar.json key " + key);
  return [icon, AR[key]];
});
if (tools.length < 20) throw new Error(`only ${tools.length} parts of the app found in TOOL_GROUPS`);

// The app's icons: the hidden <svg> of symbols at the top of index.html.
const sprite = /<svg width="0" height="0"[^>]*>[\s\S]*?<\/svg>/.exec(fs.readFileSync(path.join(www, "index.html"), "utf8"));
if (!sprite) throw new Error("www/index.html no longer starts with the icons <svg>");
for (const [icon] of tools) if (!sprite[0].includes(`id="i-${icon}"`)) throw new Error("no icon i-" + icon + " in www/index.html");

const languages = fs.readdirSync(path.join(www, "i18n")).filter(f => f.endsWith(".json")).length;
const num = n => new Intl.NumberFormat("ar-EG", { useGrouping: false }).format(n);

const logo = fileUrl(path.join(www, "icons", "icon-512.png"));
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS_CSS}">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  body { display: flex; flex-direction: column; justify-content: center; gap: 30px; padding: 0 52px; box-sizing: border-box; color: #fff;
    background: radial-gradient(circle at 82% 12%, rgba(233,196,106,.2), transparent 40%), linear-gradient(135deg, #0f766e, #0b4f4a); font-family: "Noto Naskh Arabic", serif; }
  header { display: flex; align-items: center; gap: 28px; }
  header img { width: 150px; height: 150px; filter: drop-shadow(0 12px 28px rgba(0,0,0,.35)); }
  h1 { margin: 0; font: 700 100px/1.1 Amiri, serif; }
  .sub { margin-top: 2px; font: 400 37px/1.3 Amiri, serif; color: #e9c46a; }
  .badges { margin-inline-start: auto; display: flex; flex-direction: column; gap: 8px; text-align: center; }
  .badges span { padding: 4px 22px; border-radius: 99px; background: rgba(233,196,106,.16); border: 1px solid rgba(233,196,106,.5); color: #f6e2ab; font: 700 23px/1.5 "Noto Naskh Arabic", serif; }
  .tools { display: flex; flex-wrap: wrap; gap: 12px; }
  .tool { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 9px 16px; border-radius: 16px;
    background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.24); font: 700 28px/1.5 "Noto Naskh Arabic", serif; white-space: nowrap; }
  .tool svg { flex: none; width: 30px; height: 30px; color: #e9c46a; }
</style></head><body>
  ${sprite[0]}
  <header>
    <img src="${logo}" alt="">
    <div><h1>حصن ونور</h1><div class="sub">أذكار حصن المسلم، وكل ما يحتاجه المسلم في يومه</div></div>
    <div class="badges"><span>مجاني بلا إعلانات</span><span>يعمل دون إنترنت</span><span>${num(languages)} لغة</span></div>
  </header>
  <div class="tools">${tools.map(([icon, name]) => `<span class="tool"><svg aria-hidden="true"><use href="#i-${icon}"/></svg>${esc(name)}</span>`).join("")}</div>
</body></html>`;

shootHtml(html, path.join(www, "icons", "og-image.jpg"), { width: 1200, height: 630 }).catch(e => { console.error("✗", e.message); process.exit(1); });
