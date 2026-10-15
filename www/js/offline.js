/* ===== Offline storage: saving Quran data, translations, hadith books and recorded audio on the device ===== */
// Files are stored with the Cache API under the exact URL the app requests, so the service worker
// can answer from them when there is no connection (see sw.js). Recorded audio is served with
// byte-range support so seeking works offline. A file whose source is down is taken from its backup copy
// (js/mirror.js) but still saved under the original URL.

import { fetchWithMirror } from "./mirror.js?v=1.12.0";

export const STORES = { QURAN: "hisn-quran-v1", TR: "hisn-tr-v1", AUDIO: "hisn-offline-audio-v1", PAGES: "hisn-mushaf-fonts-v1", HADITH: "hisn-hadith-v1", TAFSIR: "hisn-tafsir-v1" };
const supported = typeof caches !== "undefined";
export const isSupported = () => supported;
const abs = u => new URL(u, location.href).href;

// ---------- status ----------
export async function savedSet(store, urls) {
  if (!supported) return new Set();
  const keys = new Set((await (await caches.open(store)).keys()).map(r => r.url));
  return new Set(urls.filter(u => keys.has(abs(u))));
}
export async function savedBytes(store, urls) {
  if (!supported) return 0;
  const c = await caches.open(store); let bytes = 0;
  for (const u of urls) {
    const r = await c.match(u); if (!r) continue;
    const n = Number(r.headers.get("content-length"));
    bytes += n > 0 ? n : (await r.blob()).size;
  }
  return bytes;
}
export async function remove(store, urls) {
  if (!supported) return;
  const c = await caches.open(store);
  await Promise.all(urls.map(u => c.delete(u)));
}
export async function storageInfo() {
  try {
    const { usage = 0, quota = 0 } = (await navigator.storage?.estimate?.()) || {};
    const persisted = !!(await navigator.storage?.persisted?.());
    return { usage, quota, persisted };
  } catch { return { usage: 0, quota: 0, persisted: false }; }
}
async function persist() { try { await navigator.storage?.persist?.(); } catch { /* not supported */ } }

// Total size of remote files before downloading them (servers expose Content-Length to CORS).
export async function remoteSize(urls, concurrency = 6) {
  const q = [...urls]; let bytes = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (q.length) { const u = q.shift(); try { const r = await fetchWithMirror(u, { method: "HEAD", mode: "cors" }); bytes += Number(r.headers.get("content-length")) || 0; } catch { /* unknown size */ } }
  }));
  return bytes;
}

// ---------- download job (one at a time, survives page navigation) ----------
let job = null;
export const currentJob = () => job;
let lastEmit = 0;
function emit(force = true) {
  const now = Date.now(); if (!force && now - lastEmit < 250) return; lastEmit = now;
  window.dispatchEvent(new CustomEvent("offline-progress", { detail: job && { ...job } }));
}
async function fetchInto(cache, url, onBytes, signal) {
  const res = await fetchWithMirror(url, { mode: "cors", signal });
  if (!res.ok) throw new Error("HTTP " + res.status);
  if (!res.body) { await cache.put(url, res); return; }
  const [store, count] = res.body.tee();
  const counting = (async () => { const r = count.getReader(); for (;;) { const { done, value } = await r.read(); if (done) break; onBytes(value.byteLength); } })();
  await Promise.all([cache.put(url, new Response(store, { status: res.status, statusText: res.statusText, headers: res.headers })), counting]);
}

// Downloads every URL not already saved. Resolves with { done, failed, bytes, cancelled, noSpace } or { busy: true }.
export async function download({ id, urls, store, concurrency = 3 }) {
  if (!supported) return { failed: urls.length, done: 0, total: urls.length };
  if (job) return { busy: true };
  persist();
  const cache = await caches.open(store); const ctrl = new AbortController();
  job = { id, total: urls.length, done: 0, failed: 0, bytes: 0, cancelled: false, noSpace: false };
  const me = job; me.abort = () => { me.cancelled = true; ctrl.abort(); };
  emit();
  const queue = [...urls];
  const worker = async () => {
    while (queue.length && !me.cancelled && !me.noSpace) {
      const u = queue.shift();
      try { if (!(await cache.match(u))) await fetchInto(cache, u, n => { me.bytes += n; emit(false); }, ctrl.signal); }
      catch (e) { if (e && e.name === "QuotaExceededError") me.noSpace = true; else if (!me.cancelled) me.failed++; }
      me.done++; emit(false);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length || 1) }, worker));
  const result = { ...me }; delete result.abort; job = null; emit(); return result;
}
export function cancel() { job?.abort?.(); }

// ---------- formatting ----------
export function fmtSize(bytes, lang) {
  const mb = bytes / 1048576;
  const [value, unit] = mb >= 1024 ? [mb / 1024, "gigabyte"] : mb >= 1 ? [mb, "megabyte"] : [Math.max(bytes / 1024, 0), "kilobyte"];
  try {
    return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : lang, { style: "unit", unit, unitDisplay: lang === "ar" ? "long" : "short", maximumFractionDigits: value < 10 ? 1 : 0 }).format(value);
  } catch { return `${value.toFixed(1)} ${{ gigabyte: "GB", megabyte: "MB", kilobyte: "KB" }[unit]}`; }
}
