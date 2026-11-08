/* ===== مقارنة الروايات: محاذاة كلمات سورة في روايتين وتصنيف فروقها ===== */
// Pure functions, no DOM: the qiraat page uses them in the browser, scripts/check-qiraat.mjs and build-qiraat.js in Node.
// The texts are the King Fahd Complex files of the eight riwayat (quran/<id>.json). Their verse counts differ, so a
// surah is compared word by word: Hafs's words are aligned with the other riwayah's (Myers diff on a loose key that
// ignores vowels, signs and the alif/hamza spellings), then every aligned pair is classed:
//   0 same reading   1 the vowels differ   2 the letters differ   3 a word with no counterpart
// The packages spell the same reading in different ways (hamzat wasl as ٱ or as ا with a small sign, sukun as ۡ or ْ,
// final yāʾ as ي or ے in Warsh/Qālūn, the article's lām without its shadda in Warsh/Qālūn, tanwīn signs), so the keys
// fold all of that; what is left (مَٰلِكِ/مَلِكِ, يُؤۡمِنُونَ/يُومِنُونَ, تُقۡبَلُ/يُقۡبَلُ, the ṣila of Ibn Kathīr, imāla, naql) is a real
// difference of reading. scripts/check-qiraat.mjs prints what each class holds over the whole Quran.

const cp = String.fromCodePoint;
const rng = (a, b) => cp(a) + "-" + cp(b);
const re = (s, f = "g") => new RegExp(s, f);
const NBSP = cp(0xA0);
export const AYA_NUM = re(`[\\s${NBSP}]*[${rng(0x660, 0x669)}]+[\\s${NBSP}]*$`, "");
const HAS_LETTER = re(`[${rng(0x621, 0x64A)}${cp(0x66E)}${cp(0x6D2)}]`, "");
const YEH = re(`[${cp(0x6D2)}${cp(0x66E)}${cp(0x6E7)}${cp(0x649)}]`); // ے (Warsh/Qālūn), ٮ, the small high yāʾ (إِبۡرَٰهِـۧمَ), ى
const NOISE = re(`[${cp(0x640)}${cp(0x200D)}${cp(0x200F)}${rng(0x610, 0x61A)}${rng(0x8D3, 0x8FF)}]`); // tatweel, ZWJ/RLM, annotation signs
const MARKS = re(`[${rng(0x64B, 0x65F)}${cp(0x670)}${rng(0x6D6, 0x6ED)}]`);
const ALIF_HAMZA = re(`[${cp(0x621)}${cp(0x627)}${cp(0x671)}]`);
// Small letters that stand for full ones, hamza marks, the tanwīn signs of sequential tanwīn, hamzat wasl.
const SMALL = { [cp(0x670)]: cp(0x627), [cp(0x6E8)]: cp(0x646), [cp(0x654)]: cp(0x621), [cp(0x655)]: cp(0x621), [cp(0x657)]: cp(0x64B), [cp(0x65E)]: cp(0x64C), [cp(0x656)]: cp(0x64D), [cp(0x671)]: cp(0x627) };
const SMALL_RE = re(`[${Object.keys(SMALL).join("")}]`);
// A small sīn over a ṣād (ٱلصِّۜرَٰطَ for Qunbul, وَيَبۡصُۜطُ) means the letter is read as sīn; after an alif it is the sakt sign.
const SEEN_OVER_SAD = re(`${cp(0x635)}([${rng(0x64B, 0x652)}]*)${cp(0x6DC)}`);
const SILA = re(`[${cp(0x6E5)}${cp(0x6E6)}]`); // small wāw / yāʾ: the ṣila of mīm al-jamʿ and hāʾ al-kināya
const SILA_MAP = { [cp(0x6E5)]: cp(0x648), [cp(0x6E6)]: cp(0x64A) };
const SIGNS = re(`[${rng(0x64B, 0x65F)}${rng(0x6D6, 0x6ED)}]`);
const SHADDA_UP = re(`[${rng(0x651, 0x65F)}${rng(0x6D6, 0x6ED)}]`); // shadda, sukūn, madda, hamza marks, small signs
const TANWIN = rng(0x64B, 0x64D), SHORT = rng(0x64E, 0x650), VOWEL = rng(0x64B, 0x650);
const ALIF = cp(0x627), HAMZA = cp(0x621), LAM = cp(0x644), HEH = cp(0x647);
const TANWIN_AFTER_ALIF = re(`${ALIF}([${TANWIN}])`);
const WASL = re(`${ALIF}[${SHORT}](?!${HAMZA})`); // a vowel on a bare alif marks hamzat wasl (اَ۬لذِينَ, وَاَللَّهُ)
const ARTICLE = re(`^([${cp(0x648)}${cp(0x641)}${cp(0x628)}${cp(0x643)}]?[${SHORT}]?${ALIF})${LAM}[${VOWEL}]+`, "");
const LILLAH = re(`^([${cp(0x648)}${cp(0x641)}]?${LAM}[${VOWEL}]?)${LAM}[${VOWEL}]+(?=${HEH})`, "");

// The words of a surah's verses ([text, page, juz] as in quran/<id>.json), each with its verse number.
export const words = ayat => ayat.flatMap((v, i) => v[0].replace(AYA_NUM, "").split(/\s+/).filter(w => HAS_LETTER.test(w)).map(w => ({ w, a: i + 1 })));

// NFD, not NFC: NFC glues ا + madda into آ and ي + hamza into ئ, so a mere madda sign would change a letter.
const pre = w => w.normalize("NFD").replace(YEH, cp(0x64A)).replace(NOISE, "");
// For the alignment only: no marks, no alif, no hamza (إِبۡرَٰهِـۧمَ/إِبۡرَاهِيمَ, جَآءَ/جَا and مَٰلِكِ/مَلِكِ all align).
export const loose = w => pre(w).replace(MARKS, "").replace(ALIF_HAMZA, "");
const base = w => pre(w).replace(SEEN_OVER_SAD, cp(0x633) + "$1").replace(SMALL_RE, c => SMALL[c]);
// The consonant skeleton, with the hamzas and the dagger alif; the ṣila counts as a vowel difference, not a letter.
export const letters = w => base(w).replace(SILA, "").replace(SIGNS, "");
// The skeleton with tanwīn and the three short vowels; no shadda, no sukūn (ۡ or ْ), no madda.
export const vowels = w => base(w).replace(SILA, c => SILA_MAP[c]).replace(SHADDA_UP, "")
  .replace(TANWIN_AFTER_ALIF, (m, t) => t + ALIF) // Qālūn writes كَثِيراٗ with the tanwīn after the alif
  .replace(WASL, ALIF)
  .replace(ARTICLE, "$1" + LAM) // Warsh and Qālūn write the article's lām bare: اَ۬لذِينَ
  .replace(LILLAH, "$1" + LAM); // and لِلهِ as one ligature

// Myers' diff, O(ND): the edit script between two arrays of keys as [op, i, j]: 0 equal (A[i] = B[j]), 1 only in A (A[i]),
// 2 only in B (B[j]). The surahs differ in few places, so it is fast even for al-Baqarah.
export function align(A, B) {
  const N = A.length, M = B.length, max = N + M, off = max + 1, V = new Int32Array(2 * max + 3), trace = [];
  for (let d = 0; d <= max; d++) {
    trace.push(V.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && V[off + k - 1] < V[off + k + 1]) ? V[off + k + 1] : V[off + k - 1] + 1, y = x - k;
      while (x < N && y < M && A[x] === B[y]) { x++; y++; }
      V[off + k] = x; if (x >= N && y >= M) return backtrack(trace, d, N, M);
    }
  }
  return [];
}
function backtrack(trace, D, x, y) {
  const ops = [];
  for (let d = D; d >= 0; d--) {
    const V = trace[d], o = d + 1, k = x - y;
    const pk = k === -d || (k !== d && V[o + k - 1] < V[o + k + 1]) ? k + 1 : k - 1, px = V[o + pk], py = px - pk;
    while (x > px && y > py) ops.push([0, --x, --y]);
    if (d > 0) ops.push(x === px ? [2, x, --y] : [1, --x, y]);
  }
  return ops.reverse();
}

// Hafs's verses of a surah against another riwayah's: the other riwayah's words R with a class per word (cls), the same
// for Hafs's words H (hcls), and for every Hafs verse the span [first, last] of R's words that stand against it
// (last < first when none do: Warsh has no basmala verse before al-Fātiḥah).
export function compare(hafsAyat, rAyat) {
  const H = words(hafsAyat), R = words(rAyat);
  const ops = align(H.map(x => loose(x.w)), R.map(x => loose(x.w)));
  const cls = new Uint8Array(R.length), hcls = new Uint8Array(H.length), span = hafsAyat.map(() => [Infinity, -1]);
  const touch = (a, j) => { const s = span[a - 1]; if (j < s[0]) s[0] = j; if (j > s[1]) s[1] = j; };
  let last = 0, i = 0;
  while (i < ops.length) {
    const [t, x, y] = ops[i];
    if (t === 0) {
      touch(H[x].a, y); last = x;
      cls[y] = hcls[x] = letters(H[x].w) !== letters(R[y].w) ? 2 : vowels(H[x].w) !== vowels(R[y].w) ? 1 : 0;
      i++; continue;
    }
    // A block of words that did not align: Hafs-only words, then riwayah-only words.
    const del = [], ins = [];
    for (; i < ops.length && ops[i][0] !== 0; i++) (ops[i][0] === 1 ? del : ins).push(ops[i][1 + (ops[i][0] === 2)]);
    if (ins.length && del.length) ins.forEach(j => touch(H[del[0]].a, j));
    else if (ins.length) ins.forEach(j => touch(H[last].a, j));
    // The same letters cut into other words (أَوَلَمۡ written as two words by al-Sūsī) is no difference of reading.
    const joined = del.length && ins.length && del.map(x => loose(H[x].w)).join("") === ins.map(j => loose(R[j].w)).join("");
    const c = joined ? (del.map(x => vowels(H[x].w)).join("") === ins.map(j => vowels(R[j].w)).join("") ? 0 : 1) : del.length && ins.length ? 2 : 3;
    del.forEach(x => { hcls[x] = c; });
    ins.forEach(j => { cls[j] = c; });
  }
  return { H, R, cls, hcls, span };
}
