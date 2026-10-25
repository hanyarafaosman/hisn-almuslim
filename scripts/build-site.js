// Builds the public website into _site/: the app (www/) plus a ready-made page for every adhkar chapter
// and every surah, a sitemap and a 404 page. The app navigates with #/ addresses, which search engines
// treat as one single page; these pages give each chapter and surah its own address, title and text.
// Each page is the app's index.html with its content already written in, so the app starts on it as usual.
// GitHub Actions runs this before deploying. Local preview:
//   node scripts/build-site.js --site http://localhost:5173/ && node scripts/serve.js _site
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), www = path.join(root, "www"), out = path.join(root, "_site");
const readJson = f => JSON.parse(fs.readFileSync(path.join(www, f), "utf8"));

// The public address lives in js/app.js, where shared links use it too.
const siteArg = process.argv.indexOf("--site");
const SITE = siteArg > 0 ? process.argv[siteArg + 1] : (/const SITE = "([^"]+)"/.exec(fs.readFileSync(path.join(www, "js/app.js"), "utf8")) || [])[1];
if (!/^https?:\/\/[^/]+(\/[^?#]*)?\/$/.test(SITE || "")) throw new Error("the site address must be absolute and end with /: " + SITE);
const BASE = new URL(SITE).pathname;

const db = readJson("data/hisn.json"), qi = readJson("quran/index.json"), AR = readJson("i18n/ar.json");
const hafs = qi.riwayat.find(r => r.id === "hafs"), hafsData = readJson(hafs.data);
const TEMPLATE = fs.readFileSync(path.join(www, "index.html"), "utf8");

// ---------- text helpers (as in the app) ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = new Intl.NumberFormat("ar-EG", { useGrouping: false }); const num = n => nf.format(n);
const plural = new Intl.PluralRules("ar");
function t(key, p = {}) {
  let v = AR[key]; if (v == null) throw new Error("missing i18n/ar.json key " + key);
  if (typeof v === "object") v = v[plural.select(Number(p.n) || 0)] ?? v.other;
  return String(v).replace(/\{(\w+)\}/g, (m, k) => k in p ? (typeof p[k] === "number" ? num(p[k]) : String(p[k])) : m);
}
const ch = (...cps) => String.fromCodePoint(...cps);
const range = (a, b) => ch(a) + "-" + ch(b);
const TASHKEEL = new RegExp("[" + range(0x610, 0x61A) + range(0x64B, 0x65F) + ch(0x670) + range(0x6D6, 0x6ED) + ch(0x640) + "]", "g");
const bare = s => s.replace(TASHKEEL, "");
// Same as formatText() in js/app.js, with tashkeel shown.
const formatText = s => esc(s).replace(/\(\(/g, "«").replace(/\)\)/g, "»")
  .replace(/﴿([^﴾]+)﴾/g, (_, q) => `<span class="q">﴿${q.replace(/\s*\*\s*/g, " ۝ ")}﴾</span>`)
  .replace(/\[([^\]]+)\]/g, '<span class="n">$1</span>')
  .replace(/\((?:[^()]{1,40})\)/g, m => /مر|مرا|ثلاث|أربع|عشر|مائة|سبع/.test(m) ? `<span class="r">${m}</span>` : m);
// Plain start of a text for descriptions: no tashkeel, notes or brackets, cut at a word boundary.
function snippet(s, max = 110) {
  s = bare(s).replace(/\[[^\]]*\]/g, "").replace(/[()﴿﴾«»*]/g, "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(" ", max); return s.slice(0, cut > 40 ? cut : max) + "…";
}
const icon = (n, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const APP = t("app.name");
const BOOK = t("about.hisnTitle"), AUTHOR = t("about.hisnAuthor");

// ---------- page shell ----------
// Runs first: moves the address to the app's own #/ route on the same page (no reload), so the app,
// its links and its icons work exactly as when opened from the home page. #item-N / #a-N open one dhikr / aya.
const boot = route => `(function(){var h=location.hash,r=${JSON.stringify(route)};`
  + `if(/^#(item|a)-\\d+$/.test(h))r+=(r.indexOf("?")<0?"?":"&")+(h.charAt(1)=="i"?"item=":"a=")+h.replace(/\\D/g,"");`
  + `else if(h.indexOf("#/")==0)r=h;history.replaceState(null,"",document.baseURI+location.search+r)})()`;
const LT = "\\" + "u003c"; // keeps "</script>" out of JSON-LD
const jsonld = obj => `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", ...obj }).replace(/</g, LT)}</script>`;
const breadcrumbs = list => jsonld({ "@type": "BreadcrumbList", itemListElement: list.map(([name, at], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + at })) });
const crumbsNav = list => `<nav class="crumbs" aria-label="مسار الصفحة">${list.map(([name, at], i) => i === list.length - 1 ? `<span>${esc(name)}</span>` : `<a href="${at || "./"}">${esc(name)}</a>`).join(" / ")}</nav>`;

function render({ at, route, title, description, h1, content, nav, head = "", crumbs, index = true }) {
  let html = TEMPLATE;
  const swap = (re, fn) => { if (!re.test(html)) throw new Error("www/index.html no longer matches " + re); html = html.replace(re, fn); };
  title ??= /<title>([^<]*)<\/title>/.exec(TEMPLATE)[1];
  description ??= /<meta name="description" content="([^"]*)">/.exec(TEMPLATE)[1];
  const url = SITE + at;
  const meta = [
    index ? `<link rel="canonical" href="${url}">` : `<meta name="robots" content="noindex">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(APP)}">`,
    `<meta property="og:locale" content="ar_AR">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    index ? `<meta property="og:url" content="${url}">` : "",
    `<meta property="og:image" content="${SITE}icons/og-image.jpg">`,
    `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(APP)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    crumbs ? breadcrumbs(crumbs) : "", head,
  ].filter(Boolean).map(x => "  " + x).join("\n");
  swap(/<html lang="ar" dir="rtl">/, () => `<html lang="ar" dir="rtl" data-page-lang="ar" data-page-route="${route || "#/"}">`);
  swap(/<meta charset="utf-8">/, m => `${m}\n  <base href="${BASE}">` + (route ? `\n  <script>${boot(route)}</script>` : ""));
  swap(/<title>[^<]*<\/title>/, () => `<title>${esc(title)}</title>`);
  swap(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${esc(description)}">\n${meta}`);
  if (h1) swap(/(<h1 class="topbar-title" id="title" dir="auto">)[^<]*(<\/h1>)/, (_, a, b) => a + esc(h1) + b);
  if (route && route !== "#/") swap(/(<button class="icon-btn" id="btn-back"[^>]*?) hidden>/, (_, a) => a + ">");
  if (nav) swap(new RegExp(`(<a href="[^"]*" data-nav="${nav}")`), (_, a) => `${a} class="on"`);
  swap(/<main id="view" class="view" tabindex="-1"><\/main>/, () => `<main id="view" class="view" tabindex="-1">\n${content}\n  </main>`);
  return html;
}

const files = new Map(); // address relative to the site → HTML
const indexed = []; // addresses for the sitemap
function add(at, page) { files.set(at, render({ at, ...page })); if (page.index !== false) indexed.push(at); }

// ---------- adhkar ----------
const catById = new Map(db.categories.map(c => [c.id, c]));
const sectionOf = new Map(db.sections.flatMap(s => s.cats.map(id => [id, s])));
// The morning and evening adhkar (chapter 27) get one page each: they are searched for separately.
const MORNING_EVENING = 27;
const pagesOf = id => id === MORNING_EVENING ? [[id, "morning"], [id, "evening"]] : [[id]];
const pageAt = (id, period) => `adhkar/${period || id}/`;
const pageName = (id, period) => period ? t("home." + period) : catById.get(id).title;
const ADHKAR = [[t("nav.hub"), ""], [t("nav.adhkar"), "adhkar/"]];
const chapterLink = ([id, period], n) => `<a href="${pageAt(id, period)}"><div class="num">${num(n)}</div><div class="lbl">${esc(pageName(id, period))}<span class="sub">${esc(t("count.adhkar", { n: itemsOf(catById.get(id), period).length }))}</span></div>${icon("back", "chev")}</a>`;
const itemsOf = (cat, period) => cat.items.filter(i => !i.when || i.when === period);

const sequence = db.sections.flatMap(s => s.cats).flatMap(pagesOf);
sequence.forEach(([id, period], k) => {
  const cat = catById.get(id), sec = sectionOf.get(id), items = itemsOf(cat, period);
  const name = pageName(id, period);
  const textOf = i => period === "evening" && i.evening ? i.evening : i.text;
  const card = i => `<article class="dhikr" id="item-${i.id}"><div class="dhikr-text" lang="ar" dir="rtl">${formatText(textOf(i))}</div>`
    + `<div class="dhikr-bar"><span class="count-btn"><span class="big">${num(i.repeat)}</span>${i.repeat > 1 ? `<span class="of">/ ${num(i.repeat)}</span>` : ""}</span></div></article>`;
  const prev = sequence[k - 1], next = sequence[k + 1];
  const siblings = sec.cats.flatMap(pagesOf).filter(([cid, p]) => !(cid === id && p === period));
  const content = [
    crumbsNav([...ADHKAR, [sec.title, "adhkar/#" + sec.id], [name, pageAt(id, period)]]),
    period ? `<div style="text-align:center"><div class="segmented">${["morning", "evening"].map(p => `<a href="${pageAt(id, p)}" class="${p === period ? "on" : ""}">${icon(p === "morning" ? "sun" : "moon")} ${esc(t("cat." + p))}</a>`).join("")}</div></div>` : "",
    `<div id="cards">${items.map(card).join("")}</div>`,
    `<nav class="reader-nav">${prev ? `<a class="btn ghost" href="${pageAt(...prev)}">${icon("back", "dir")} ${esc(pageName(...prev))}</a>` : "<span></span>"}${next ? `<a class="btn ghost" href="${pageAt(...next)}">${esc(pageName(...next))} ${icon("back", "flip")}</a>` : "<span></span>"}</nav>`,
    siblings.length ? `<h2 class="section-title">${esc(sec.title)}</h2><div class="list">${siblings.map(x => chapterLink(x, sec.cats.indexOf(x[0]) + 1)).join("")}</div>` : "",
    `<p class="source-note">${esc(`${BOOK}، ${AUTHOR}`)}</p>`,
  ].filter(Boolean).map(x => "    " + x).join("\n");
  const description = period
    ? `${name} مكتوبة كاملة بالتشكيل من كتاب حصن المسلم (${t("count.adhkar", { n: items.length })})، مع عدد مرات التكرار والاستماع لكل ذكر: آية الكرسي والمعوذات وسيد الاستغفار و«${period === "morning" ? "أصبحنا وأصبح الملك لله" : "أمسينا وأمسى الملك لله"}».`
    : `${name} من كتاب حصن المسلم بالنص الكامل والتشكيل، مع عدد مرات التكرار والاستماع: «${snippet(textOf(items[0]))}»`;
  add(pageAt(id, period), {
    route: `#/cat/${id}` + (period ? `?p=${period}` : ""), nav: "adhkar", h1: cat.title, content, description,
    title: period ? `${name} مكتوبة كاملة | ${APP}` : `${name} | ${APP}`,
    crumbs: [...ADHKAR, [name, pageAt(id, period)]],
  });
});

const chapterCount = t("count.chapters", { n: db.categories.length });
add("adhkar/", {
  route: "#/adhkar", nav: "adhkar", h1: t("nav.adhkar"),
  title: `جميع أذكار حصن المسلم مكتوبة (${chapterCount}) | ${APP}`,
  description: `فهرس كتاب حصن المسلم كاملًا في ${chapterCount}: أذكار الصباح والمساء، وأذكار النوم والاستيقاظ، والوضوء والصلاة والمسجد، وأدعية الهم والكرب والسفر والمرض، مكتوبة بالتشكيل مع العداد والصوت.`,
  crumbs: ADHKAR,
  content: [crumbsNav(ADHKAR), ...db.sections.map(s => `<h2 class="section-title" id="${s.id}">${esc(s.title)}</h2><div class="list">${s.cats.flatMap(pagesOf).map(x => chapterLink(x, s.cats.indexOf(x[0]) + 1)).join("")}</div>`),
    `<p class="source-note">${esc(`${BOOK}، ${AUTHOR}`)}</p>`].map(x => "    " + x).join("\n"),
});

// ---------- Quran (Hafs, the riwayah most people search in) ----------
const QURAN = [[t("nav.hub"), ""], [t("quran.title"), "surah/"]];
const surahName = s => bare(hafs.surahs[s - 1][0]);
const surahLink = s => { const [name, count, page] = hafs.surahs[s - 1]; return `<a href="surah/${s}/"><div class="num">${num(s)}</div><div class="lbl">${esc(name)}<span class="sub">${esc(t("quran.surahMeta", { ayat: t("count.ayat", { n: count }), page }))}</span></div>${icon("back", "chev")}</a>`; };
const fontHead = `<link rel="preload" href="${hafs.font}" as="font" type="font/woff2" crossorigin>\n  <style>@font-face{font-family:"kfgqpc-hafs";src:url(${hafs.font}) format("woff2");font-display:swap}</style>`;
for (let s = 1; s <= 114; s++) {
  const [arName, count, page] = hafs.surahs[s - 1]; const ayat = hafsData.s[s - 1]; const name = surahName(s);
  const showBasmala = s !== 9 && !(s === 1 && hafs.basmalaIsAya);
  let lastJuz = s > 1 ? hafsData.s[s - 2].at(-1)[2] : ayat[0][2];
  const parts = ayat.map(([text, , juz], i) => {
    const mark = juz !== lastJuz ? `<div class="juz-mark"><span>${esc(t("quran.juz", { n: juz }))}</span></div>` : ""; lastJuz = juz;
    return `${mark}<div class="aya" id="a-${i + 1}"><span class="aya-text" lang="ar" dir="rtl">${esc(text)}</span></div>`;
  });
  const content = [
    crumbsNav([...QURAN, [t("quran.surah", { name }), `surah/${s}/`]]),
    `<div class="reader-bar"><span class="pill">${esc(t("quran.riwayahOf", { name: t("riwayahShort.hafs") }))}</span><span class="pill ghost">${esc(t("count.ayat", { n: count }))}</span><span class="pill ghost">${esc(t("quran.page", { n: page }))}</span></div>`,
    `<article class="mushaf" lang="ar" dir="rtl" style="--qfont:'kfgqpc-hafs'">`,
    `<header class="surah-head"><span>سورة ${esc(arName)}</span></header>`,
    showBasmala ? `<div class="basmala">${esc(hafs.basmala)}</div>` : "",
    parts.join("\n"),
    `</article>`,
    `<nav class="reader-nav">${s > 1 ? `<a class="btn ghost" href="surah/${s - 1}/">${icon("back", "dir")} ${esc(hafs.surahs[s - 2][0])}</a>` : "<span></span>"}${s < 114 ? `<a class="btn ghost" href="surah/${s + 1}/">${esc(hafs.surahs[s][0])} ${icon("back", "flip")}</a>` : "<span></span>"}</nav>`,
    `<p class="source-note">${esc(t("quran.sourceNote", { source: t("kfgqpc.name"), v: hafs.version }))}</p>`,
  ].filter(Boolean).map(x => "    " + x).join("\n");
  add(`surah/${s}/`, {
    route: `#/quran/hafs/${s}`, nav: "quran", h1: t("quran.surah", { name: arName }), head: fontHead, content,
    title: `سورة ${name} مكتوبة كاملة بالتشكيل - رواية حفص | ${APP}`,
    description: `اقرأ سورة ${name} مكتوبة كاملة بالرسم العثماني بخط مصحف المدينة، برواية حفص عن عاصم من ${t("kfgqpc.name")}: ${t("count.ayat", { n: count })}، تبدأ في الصفحة ${num(page)}. مع الاستماع لأشهر القراء وترجمة معاني القرآن.`,
    crumbs: [...QURAN, [t("quran.surah", { name }), `surah/${s}/`]],
  });
}
add("surah/", {
  route: "#/quran", nav: "quran", h1: t("quran.title"),
  title: `القرآن الكريم مكتوبًا: فهرس سور المصحف برواية حفص | ${APP}`,
  description: `سور القرآن الكريم الـ${num(114)} مكتوبة كاملة بالرسم العثماني بخط مصحف المدينة من ${t("kfgqpc.name")}، مع الاستماع للتلاوات وترجمة المعاني. وفي التطبيق المصحف بثماني روايات.`,
  crumbs: QURAN,
  content: [crumbsNav(QURAN), `<div class="list">${hafs.surahs.map((_, i) => surahLink(i + 1)).join("")}</div>`,
    `<p class="source-note">${esc(t("quran.sourceNote", { source: t("kfgqpc.name"), v: hafs.version }))}</p>`].map(x => "    " + x).join("\n"),
});

// ---------- home and 404 ----------
const tile = (href, ic, label) => `<a class="hub-tile" href="${href}"><div class="ic">${icon(ic)}</div><div class="t">${esc(label)}</div></a>`;
const POPULAR_SURAHS = [18, 36, 67, 55, 56, 2, 1, 112];
const HOME_CHAPTERS = [[27, "morning"], [27, "evening"], [28], [1], [25], [10], [11]];
add("", {
  nav: "home",
  head: jsonld({ "@graph": [
    { "@type": "WebSite", "@id": SITE + "#website", name: APP, alternateName: ["حصن المسلم", "Hisn al-Muslim", BOOK], url: SITE, inLanguage: "ar" },
    { "@type": "WebApplication", name: APP, url: SITE, applicationCategory: "LifestyleApplication", operatingSystem: "Android, iOS, Windows, macOS, Linux",
      browserRequirements: "Requires JavaScript", inLanguage: "ar", isAccessibleForFree: true, image: SITE + "icons/icon-512.png",
      copyrightYear: 2026, copyrightHolder: { "@type": "Organization", name: APP, url: SITE }, author: { "@type": "Organization", name: APP, url: SITE },
      description: /<meta name="description" content="([^"]*)">/.exec(TEMPLATE)[1], offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
  ] }),
  content: [
    `<section class="hero"><p class="verse" lang="ar" dir="rtl">«فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ»</p><p class="verse-ref">${esc(t("home.verseRef"))}</p></section>`,
    `<h2 class="section-title">${esc(t("hub.sections"))}</h2><div class="hub-grid">${[tile("adhkar/", "sun", t("nav.adhkar")), tile("surah/", "quran", t("nav.quran")), tile("#/hadith", "books", t("hadith.books")), tile("#/listen", "headphones", t("listen.recitations")), tile("#/radio", "radio", t("listen.radios")), tile("#/tasbih", "beads", t("nav.tasbih"))].join("")}</div>`,
    `<h2 class="section-title">${esc(t("nav.adhkar"))}</h2><div class="list">${HOME_CHAPTERS.map((x, n) => chapterLink(x, n + 1)).join("")}</div>`,
    `<h2 class="section-title">${esc(t("quran.surahs"))}</h2><div class="list">${POPULAR_SURAHS.map(surahLink).join("")}</div>`,
    `<p class="source-note">${esc(`${BOOK}، ${AUTHOR}`)} ${esc(t("quran.sourceNote", { source: t("kfgqpc.name"), v: hafs.version }))}</p>`,
  ].map(x => "    " + x).join("\n"),
});
// The app opens its home page here, so the title is the app's (it is kept while the home page is shown).
add("404.html", { route: "#/", nav: "home", index: false, title: APP, content: `    <div class="empty">${icon("search")}<div>الصفحة غير موجودة</div><br><a class="btn" href="./">${esc(t("nav.hub"))}</a></div>` });

// ---------- write ----------
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(www, out, { recursive: true });
for (const [at, html] of files) {
  const file = path.join(out, at.endsWith(".html") ? at : path.join(at, "index.html"));
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, html);
}
const depth = at => at ? at.split("/").length - 1 : 0; // home, then the two indexes, then chapters and surahs
indexed.sort((a, b) => depth(a) - depth(b));
fs.writeFileSync(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexed.map(at => `  <url><loc>${SITE}${at}</loc></url>`).join("\n")}\n</urlset>\n`);
console.log(`✓ _site: ${files.size} pages (${sequence.length} adhkar, 114 surahs), sitemap with ${indexed.length} addresses, for ${SITE}`);
