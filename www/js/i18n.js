/* ===== i18n: interface languages, plurals, numbers, direction ===== */
// Strings live in i18n/<code>.json. Lookup order: chosen language → English → the key itself.
// Plural values are objects keyed by CLDR category and resolved with Intl.PluralRules.

export const LANGS = [
  ["ar", "العربية"], ["en", "English"], ["fr", "Français"], ["es", "Español"], ["pt", "Português"],
  ["de", "Deutsch"], ["it", "Italiano"], ["tr", "Türkçe"], ["ru", "Русский"], ["id", "Bahasa Indonesia"],
  ["ms", "Bahasa Melayu"], ["ur", "اردو"], ["fa", "فارسی"], ["ps", "پښتو"], ["bn", "বাংলা"],
  ["hi", "हिन्दी"], ["ta", "தமிழ்"], ["zh", "中文"], ["ja", "日本語"], ["sw", "Kiswahili"],
  ["ha", "Hausa"], ["so", "Soomaali"], ["am", "አማርኛ"], ["uz", "Oʻzbekcha"], ["az", "Azərbaycanca"],
  ["bs", "Bosanski"], ["sq", "Shqip"],
].map(([code, name]) => ({ code, name }));
const RTL = new Set(["ar", "ur", "fa", "ps", "ug", "ku", "he", "dv", "sd", "yi"]);
export const dirOf = code => RTL.has(String(code).split("-")[0]) ? "rtl" : "ltr";
export const isSupported = code => LANGS.some(l => l.code === code);

let lang = "ar", dict = {}, fallback = {}, plural = new Intl.PluralRules("ar"), nf = new Intl.NumberFormat("ar-EG", { useGrouping: false });
const cache = new Map();
async function load(code, version) {
  if (!cache.has(code)) cache.set(code, fetch(`i18n/${code}.json?v=${version}`).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch(e => { cache.delete(code); throw e; }));
  return cache.get(code);
}

export async function setLang(code, version = "") {
  if (!isSupported(code)) code = "en";
  const [d, f] = await Promise.all([load(code, version), code === "en" ? Promise.resolve({}) : load("en", version).catch(() => ({}))]);
  lang = code; dict = d; fallback = f;
  plural = new Intl.PluralRules(code);
  // Arabic uses Arabic-Indic digits; every other language uses its own default digits.
  nf = new Intl.NumberFormat(code === "ar" ? "ar-EG" : code, { useGrouping: false });
  const html = document.documentElement; html.lang = code; html.dir = dirOf(code);
  return code;
}

export const getLang = () => lang;
export const num = n => typeof n === "number" ? nf.format(n) : String(n).replace(/\d+/g, d => nf.format(Number(d)));
export const has = key => key in dict;

export function t(key, p = {}) {
  let v = dict[key] ?? fallback[key] ?? key;
  if (v && typeof v === "object") v = v[plural.select(Number(p.n) || 0)] ?? v.other ?? Object.values(v)[0];
  return String(v).replace(/\{(\w+)\}/g, (m, k) => k in p ? (typeof p[k] === "number" ? num(p[k]) : String(p[k])) : m);
}

// Same as t(), but the result is HTML-escaped and {name} placeholders listed in `html` are filled with raw HTML.
export function th(key, p = {}, html = {}, esc) {
  const marks = Object.fromEntries(Object.keys(html).map((k, i) => [k, `@@${i}@@`]));
  let s = esc(t(key, { ...p, ...marks }));
  Object.keys(html).forEach((k, i) => { s = s.split(`@@${i}@@`).join(html[k]); });
  return s;
}

// First visit: use the browser language if we support it. Returning users who never chose keep Arabic.
export function detect(saved, returningUser) {
  const fromUrl = new URLSearchParams(location.search).get("lang");
  if (fromUrl && isSupported(fromUrl)) return fromUrl;
  if (saved && isSupported(saved)) return saved;
  if (returningUser) return "ar";
  for (const l of navigator.languages || [navigator.language || "ar"]) {
    const base = String(l).toLowerCase().split("-")[0];
    if (isSupported(base)) return base;
  }
  return "en";
}

// Localised names via Intl, with a safe fallback when the browser does not know a code.
export function languageName(code, inLang = lang) {
  try { const n = new Intl.DisplayNames([inLang], { type: "language" }).of(code); if (n && n !== code) return n; } catch { /* ignore */ }
  return LANGS.find(l => l.code === code)?.name || code;
}
export function regionName(cc, inLang = lang) {
  try { return new Intl.DisplayNames([inLang], { type: "region" }).of(cc) || cc; } catch { return cc; }
}
export const collator = () => new Intl.Collator(lang);
// List separator: Arabic-script languages use the Arabic comma.
export const sep = () => ["ar", "fa", "ur", "ps"].includes(lang) ? "، " : ", ";
