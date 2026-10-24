// Every quotation the model writes must be in the passage it cites, word for word (diacritics, punctuation and
// letter forms aside); the rest is dropped, and nothing reaches the app that is not in the books.
import { normalizeArabic } from "../../scripts/faqih-chunk.mjs";

export const MIN_QUOTE = 12; // characters of a quotation (or of each part around «…») after normalisation

// The quotation, or each of its parts around «…», appears in the text in that order.
export function quoteIn(quote, text) {
  const hay = " " + normalizeArabic(text) + " ";
  const parts = String(quote).split(/\s*(?:…|\.\.\.)\s*/).map(normalizeArabic).filter(Boolean);
  if (!parts.length || parts.reduce((a, p) => a + p.length, 0) < MIN_QUOTE) return false;
  let from = 0;
  for (const p of parts) {
    if (p.length < 4) continue; // a word or two around a gap: not worth matching
    const at = hay.indexOf(" " + p + " ", from); if (at < 0) return false;
    from = at + p.length;
  }
  return true;
}

// Keep the items whose quotation is really in the passage they cite; one item per quotation.
export function verifyItems(items, passages) {
  const kept = [], seen = new Set(); let dropped = 0;
  for (const it of Array.isArray(items) ? items : []) {
    const p = passages[Number(it?.chunk) - 1];
    const quote = String(it?.quote ?? "").replace(/\s+/g, " ").trim();
    if (!p || !quote || !quoteIn(quote, p.text)) { dropped++; continue; }
    const key = p.n + ":" + normalizeArabic(quote); if (seen.has(key)) continue; seen.add(key);
    kept.push({ n: p.n, quote, note: String(it.note ?? "").trim().slice(0, 200), b: p.b, s: p.s, p0: p.p0, p1: p.p1, h: p.h, pg0: p.pg0, pg1: p.pg1, v0: p.v0, v1: p.v1 });
  }
  return { kept, dropped };
}
