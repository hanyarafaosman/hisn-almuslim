/* ===== Backup copies of outside files (repository hisn-almuslim-assets on GitHub Pages) ===== */
// Adhkar audio (hisnmuslim.com) and printed-Mushaf page fonts (static.qurancdn.com) are too large to ship
// inside the app, so an exact copy is kept here and used only when the original source fails.
// Built by scripts/build-mirror.js and checked daily by scripts/check-sources.js.

export const MIRROR = "https://hanyarafaosman.github.io/hisn-almuslim-assets";
const HOSTS = { "www.hisnmuslim.com": "hisnmuslim", "static.qurancdn.com": "qurancdn" };

// Tafsir books (spa5k/tafsir_api) are read from jsDelivr at a pinned commit. The repository is larger than
// jsDelivr's 50 MB package limit, so jsDelivr sometimes refuses a file (HTTP 403); GitHub serves the same commit.
const TAFSIR_CDN = /^https:\/\/cdn\.jsdelivr\.net\/gh\/spa5k\/tafsir_api@([0-9a-f]{40})\//;

// The backup URL of a file (same path under a folder per source), or "" when there is none.
export function mirrorOf(url) {
  if (TAFSIR_CDN.test(url)) return url.replace(TAFSIR_CDN, "https://raw.githubusercontent.com/spa5k/tafsir_api/$1/");
  try { const u = new URL(url); const key = HOSTS[u.hostname]; return key ? `${MIRROR}/${key}${u.pathname}` : ""; } catch { return ""; }
}

// fetch() from the original source, then from the backup if the source is unreachable or answers with an error.
export async function fetchWithMirror(url, opts = {}) {
  const alt = mirrorOf(url);
  try { const res = await fetch(url, opts); if (res.ok || !alt) return res; }
  catch (e) { if (!alt || opts.signal?.aborted) throw e; }
  return fetch(alt, opts);
}
