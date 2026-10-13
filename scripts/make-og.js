// Draws www/icons/og-image.jpg (1200×630), the preview image shown when a link to the website is shared
// in chat apps and social networks, with headless Chrome (scripts/headless.js) and the app's own fonts.
// Run again after changing the design.
const path = require("path");
const { shootHtml, fileUrl, FONTS_CSS, www } = require("./headless");

const icon = fileUrl(path.join(www, "icons", "icon-512.png"));
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS_CSS}">
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

shootHtml(html, path.join(www, "icons", "og-image.jpg"), { width: 1200, height: 630 }).catch(e => { console.error("✗", e.message); process.exit(1); });
