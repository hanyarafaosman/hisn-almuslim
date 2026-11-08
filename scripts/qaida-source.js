// «تعلّم القراءة من الصفر» (#/qaida): the lessons that take a learner from the letters to the stop signs, in the way of
// the classical qāʿidah (القاعدة النورانية and its like): the letters and their written shapes, the vowel signs, tanwīn,
// sukūn, shaddah, madd, the two lāms, the two hamzahs, the two tāʾs and the stop signs. The explanation is written for
// the app in Arabic and English (other languages read the English); every example is a word of the Madinah Mushaf,
// drawn with the Tajweed print's own page font and heard in Shaykh al-Ḥuṣarī's recitation of its verse.
// scripts/build-qaida.js turns this into www/data/qaida.json and checks every word on its printed page.
//
// An example is a verse key and the positions of its words: ex("1:4", 1, "ألف صغيرة", "Small alif", "Y") — the last
// argument is the colours of the Tajweed print the word must show (codes of scripts/tajweed-source.js: Y small madd
// letters, g not pronounced, …), checked in the page font by the build.
const ex = (k, w, ar, en, want = "", none = "") => ({ k, w: [].concat(w), ...(ar ? { n: [ar, en] } : {}), ...(want ? { want } : {}), ...(none ? { none } : {}) });

const SOURCE = [
  "الشرح في هذه الدروس من كتابة التطبيق على طريقة القاعدة النورانية وما جرى مجراها، وليس نقلًا عن كتاب بعينه. الأمثلة كلمات من مصحف المدينة النبوية مرسومة بخط صفحتها في مصحف التجويد الملوّن، وتلاوتها بصوت الشيخ محمود خليل الحصري برواية حفص عن عاصم من موقع mp3quran.net.",
  "The explanations in these lessons were written for the app, in the manner of the classical qāʿidah primers; they are not copied from a particular book. The examples are words of the Madinah Mushaf drawn with their page's font from the colour-coded Tajweed print, and recited by Shaykh Maḥmūd Khalīl al-Ḥuṣarī in the narration of Ḥafṣ from ʿĀṣim (mp3quran.net).",
];

const INTRO = [
  ["هذه الدروس لمن يريد أن يقرأ المصحف من غير أن يكون قد تعلّم العربية من قبل: تبدأ بالحروف وصورها، ثم الحركات والتنوين والسكون والشدة، ثم المدّ وحروف اللين، ثم ما يُكتب ولا يُنطق أو يُنطق على غير ما يُكتب: اللام الشمسية، وهمزة الوصل، والتاء المربوطة، وعلامات الوقف.",
    "These lessons are for anyone who wants to read the Mushaf without having learned Arabic before: they start with the letters and their shapes, then the vowel signs, tanwīn, sukūn and shaddah, then madd and the līn letters, then what is written but not pronounced, or pronounced otherwise than written: the sun lām, hamzat al-waṣl, the tied tāʾ and the stop signs."],
  ["كل مثال كلمةٌ من المصحف كما هي مرسومة في صفحتها، فإذا لمستها فُتحت صفحتها، وزرُّ «استماع» يُسمعك الآية التي وردت فيها. وفي آخر كل درس تمرين «اقرأ ثم اسمع»: اقرأ الكلمة بصوتك أولًا، ثم اسمع القارئ وقارن.",
    "Every example is a word of the Mushaf exactly as its page draws it: tap it to open that page, and the Listen button plays the verse it comes from. Each lesson ends with the exercise «read, then listen»: read the word aloud first, then hear the reciter and compare."],
  ["ألوان الحروف في الأمثلة هي ألوان مصحف التجويد: لا تحتاج إليها الآن، وستتعلم معانيها في صفحة أحكام التجويد بعد هذه الدروس.",
    "The colours of the letters in the examples are those of the Tajweed Mushaf: you do not need them yet; their meaning is taught on the Tajweed rules page after these lessons."],
];

// The written shapes of a letter: on its own, at the start, in the middle and at the end of a word.
const FORMS = { s: ["منفصلًا", "On its own"], i: ["في أول الكلمة", "At the start of a word"], m: ["في وسط الكلمة", "In the middle of a word"], f: ["في آخر الكلمة", "At the end of a word"] };

// The 28 letters: name, and where and how each is pronounced (its makhraj, and the nearest English sound).
const LETTERS = [
  { l: "ا", n: ["ألف", "Alif"], sound: ["حرف مدّ من الجوف، وإذا حملت الهمزة (أ) نُطقت همزةً من أقصى الحلق", "A long ‘a’ as in ‘far’ when it is a madd letter; carrying a hamzah (أ) it is the catch in the throat heard at the start of ‘apple’"] },
  { l: "ب", n: ["باء", "Bāʾ"], sound: ["من الشفتين", "b as in ‘book’, from the two lips"] },
  { l: "ت", n: ["تاء", "Tāʾ"], sound: ["من طرف اللسان مع أصول الثنايا العليا", "t as in ‘tea’, the tip of the tongue at the base of the upper front teeth"] },
  { l: "ث", n: ["ثاء", "Thāʾ"], sound: ["من طرف اللسان مع أطراف الثنايا العليا", "th as in ‘think’"] },
  { l: "ج", n: ["جيم", "Jīm"], sound: ["من وسط اللسان مع ما يحاذيه من الحنك الأعلى", "j as in ‘jam’, from the middle of the tongue"] },
  { l: "ح", n: ["حاء", "Ḥāʾ"], sound: ["من وسط الحلق، مهموسة", "A breathy, whispered h from the middle of the throat; no English equivalent"] },
  { l: "خ", n: ["خاء", "Khāʾ"], sound: ["من أدنى الحلق", "kh as in Scottish ‘loch’, from the top of the throat"] },
  { l: "د", n: ["دال", "Dāl"], sound: ["من طرف اللسان مع أصول الثنايا العليا", "d as in ‘door’"] },
  { l: "ذ", n: ["ذال", "Dhāl"], sound: ["من طرف اللسان مع أطراف الثنايا العليا", "th as in ‘this’"] },
  { l: "ر", n: ["راء", "Rāʾ"], sound: ["من طرف اللسان مع لثة الثنايا العليا، مكرَّرة", "A rolled r, as in Spanish"] },
  { l: "ز", n: ["زاي", "Zāy"], sound: ["من طرف اللسان مع ما فوق الثنايا السفلى", "z as in ‘zoo’"] },
  { l: "س", n: ["سين", "Sīn"], sound: ["من طرف اللسان مع ما فوق الثنايا السفلى", "s as in ‘sun’"] },
  { l: "ش", n: ["شين", "Shīn"], sound: ["من وسط اللسان مع ما يحاذيه من الحنك الأعلى", "sh as in ‘ship’"] },
  { l: "ص", n: ["صاد", "Ṣād"], sound: ["من طرف اللسان مع ما فوق الثنايا السفلى، مفخَّمة", "An emphatic (heavy) s, the back of the tongue raised"] },
  { l: "ض", n: ["ضاد", "Ḍād"], sound: ["من إحدى حافتي اللسان مع ما يليها من الأضراس العليا، مفخَّمة", "An emphatic d from the side of the tongue against the upper molars; the letter Arabic is named for"] },
  { l: "ط", n: ["طاء", "Ṭāʾ"], sound: ["من طرف اللسان مع أصول الثنايا العليا، مفخَّمة", "An emphatic (heavy) t"] },
  { l: "ظ", n: ["ظاء", "Ẓāʾ"], sound: ["من طرف اللسان مع أطراف الثنايا العليا، مفخَّمة", "An emphatic (heavy) th as in ‘this’"] },
  { l: "ع", n: ["عين", "ʿAyn"], sound: ["من وسط الحلق، مجهورة", "A voiced sound squeezed from the middle of the throat; no English equivalent"] },
  { l: "غ", n: ["غين", "Ghayn"], sound: ["من أدنى الحلق", "gh, like a French r, from the top of the throat"] },
  { l: "ف", n: ["فاء", "Fāʾ"], sound: ["من باطن الشفة السفلى مع أطراف الثنايا العليا", "f as in ‘fish’"] },
  { l: "ق", n: ["قاف", "Qāf"], sound: ["من أقصى اللسان مع ما فوقه من الحنك الأعلى، مفخَّمة", "A deep k from the very back of the tongue, heavy"] },
  { l: "ك", n: ["كاف", "Kāf"], sound: ["من أقصى اللسان تحت مخرج القاف", "k as in ‘kite’"] },
  { l: "ل", n: ["لام", "Lām"], sound: ["من حافة اللسان مع لثة الأسنان العليا", "l as in ‘lamp’"] },
  { l: "م", n: ["ميم", "Mīm"], sound: ["من الشفتين، مع غنّة من الخيشوم", "m as in ‘moon’"] },
  { l: "ن", n: ["نون", "Nūn"], sound: ["من طرف اللسان مع لثة الثنايا العليا، مع غنّة من الخيشوم", "n as in ‘noon’"] },
  { l: "ه", n: ["هاء", "Hāʾ"], sound: ["من أقصى الحلق", "h as in ‘hand’, from the bottom of the throat"] },
  { l: "و", n: ["واو", "Wāw"], sound: ["من الشفتين، وتكون حرف مدّ بعد الضمة", "w as in ‘well’; after a ḍammah it is the long ‘oo’ of madd"] },
  { l: "ي", n: ["ياء", "Yāʾ"], sound: ["من وسط اللسان، وتكون حرف مدّ بعد الكسرة", "y as in ‘yes’; after a kasrah it is the long ‘ee’ of madd"] },
];

// The surah-opening letters (المقطعات): the verse in which the letter's name is recited on its own.
const MUQ = { "ا": "2:1", "ل": "2:1", "م": "2:1", "ص": "38:1", "ر": "10:1", "ك": "19:1", "ه": "20:1", "ي": "36:1", "ع": "19:1", "ط": "20:1", "س": "36:1", "ح": "40:1", "ق": "50:1", "ن": "68:1" };

// A word of the Mushaf for each written shape of each letter (s on its own, i first, m middle, f last): [verse, word
// position]. Chosen from as few printed pages as possible per lesson (scratch script), checked by the build to hold the
// letter and to stand on its page. The six letters ا د ذ ر ز و never join the letter after them: two shapes only.
const LETTER_WORDS = {
  "ا": { s: ["19:11", 8], f: ["19:4", 1] },
  "ب": { s: ["19:4", 2], i: ["19:2", 3], m: ["19:7", 11], f: ["19:5", 9] },
  "ت": { s: ["2:229", 33], i: ["19:9", 13], m: ["19:9", 9], f: ["19:5", 2] },
  "ث": { s: ["19:6", 2], i: ["19:6", 1], m: ["2:228", 31], f: ["9:5", 7] },
  "ج": { s: ["19:11", 1], i: ["19:10", 3], m: ["19:7", 8], f: ["9:3", 8] },
  "ح": { s: ["2:229", 30], i: ["19:2", 2], m: ["19:11", 9], f: ["2:230", 9] },
  "خ": { s: ["4:12", 58], i: ["19:5", 2], m: ["19:11", 1], f: ["9:5", 2] },
  "د": { s: ["20:31", 1], f: ["20:36", 2] },
  "ذ": { s: ["20:24", 1], f: ["20:21", 2] },
  "ر": { s: ["20:25", 2], f: ["20:22", 8] },
  "ز": { s: ["20:31", 3], f: ["3:65", 8] },
  "س": { s: ["3:68", 3], i: ["20:36", 4], m: ["20:26", 1], f: ["20:15", 8] },
  "ش": { s: ["81:20", 5], i: ["20:25", 3], m: ["3:64", 15], f: ["20:18", 6] },
  "ص": { s: ["2:96", 2], i: ["20:25", 5], m: ["20:18", 3], f: ["3:62", 4] },
  "ض": { s: ["38:26", 6], i: ["2:233", 2], m: ["38:22", 12], f: ["38:24", 15] },
  "ط": { s: ["89:13", 4], i: ["2:231", 2], m: ["38:22", 19], f: ["38:22", 19] },
  "ظ": { s: ["85:22", 3], i: ["38:24", 24], m: ["2:231", 36], f: ["2:232", 16] },
  "ع": { s: ["38:22", 5], i: ["38:26", 15], m: ["38:24", 15], f: ["38:26", 12] },
  "غ": { s: ["2:250", 7], i: ["2:249", 53], m: ["38:24", 12], f: ["3:85", 2] },
  "ف": { s: ["2:249", 22], i: ["38:23", 14], m: ["38:22", 5], f: ["2:233", 18] },
  "ق": { s: ["3:84", 23], i: ["38:24", 1], m: ["38:24", 2], f: ["38:22", 17] },
  "ك": { s: ["27:19", 23], i: ["27:16", 12], m: ["27:22", 1], f: ["27:19", 10] },
  "ل": { s: ["27:16", 4], i: ["27:18", 13], m: ["27:15", 8], f: ["27:16", 12] },
  "م": { s: ["27:20", 9], i: ["27:16", 11], m: ["27:22", 6], f: ["27:22", 7] }, // Quran.com splits «مَالِيَ» before it into two words
  "ن": { s: ["27:19", 8], i: ["27:14", 7], m: ["27:16", 8], f: ["27:16", 11] },
  "ه": { s: ["27:15", 14], i: ["27:18", 17], m: ["27:14", 2], f: ["27:15", 8] },
  "و": { s: ["27:21", 4], f: ["27:16", 16] },
  "ي": { s: ["27:15", 9], i: ["27:22", 14], m: ["27:14", 8], f: ["27:19", 22] },
};

// The four lessons of the letters (seven letters each).
const LETTER_LESSONS = [
  { id: "letters-1", letters: "ابتثجحخ", t: ["الحروف الهجائية (١): من الألف إلى الخاء", "The letters (1): alif to khāʾ"], sub: ["ا ب ت ث ج ح خ", "ا ب ت ث ج ح خ"],
    intro: [
      ["حروف الهجاء العربية ثمانية وعشرون حرفًا، تُكتب من اليمين إلى اليسار. لكل حرف اسم (باء، تاء…) وصوت، والصوت هو ما يُنطق به الحرف في الكلمة، لا اسمه.", "The Arabic alphabet has twenty-eight letters, written from right to left. Each letter has a name (bāʾ, tāʾ…) and a sound; the sound, not the name, is what you pronounce when the letter is in a word."],
      ["الحرف في الكلمة يتصل بما قبله وما بعده، فتتغيّر صورته قليلًا بحسب موضعه: في أول الكلمة، أو وسطها، أو آخرها، أو منفصلًا. ستة حروف لا تتصل بما بعدها (ا د ذ ر ز و) فلها صورتان فقط.", "Inside a word a letter joins the letters before and after it, so its shape changes a little with its place: at the start, in the middle, at the end, or on its own. Six letters (ا د ذ ر ز و) never join the letter after them, so they have only two shapes."],
      ["تحت كل حرف اسمُه ومخرجُه، وكلمةٌ من المصحف لكل صورة من صوره. اقرأ الكلمة ثم اسمع الآية. وحيث كان الحرف في فواتح السور (مثل ﴿الٓمٓ﴾) تسمع اسمه منفردًا في أول الآية.", "Under each letter are its name, where it is pronounced, and a word of the Mushaf for each of its shapes. Read the word, then listen to the verse. Where the letter opens a surah (as in ﴿الٓمٓ﴾), you hear its name on its own at the start of the verse."],
    ] },
  { id: "letters-2", letters: "دذرزسشص", t: ["الحروف الهجائية (٢): من الدال إلى الصاد", "The letters (2): dāl to ṣād"], sub: ["د ذ ر ز س ش ص", "د ذ ر ز س ش ص"],
    intro: [
      ["أربعة من حروف هذا الدرس (د ذ ر ز) لا تتصل بما بعدها، فتأتي منفصلةً أو في آخر الكلمة فقط. والصاد مفخَّمة: يرتفع أقصى اللسان عند نطقها فيمتلئ الفم بصوتها، بخلاف السين.", "Four letters of this lesson (د ذ ر ز) do not join the letter after them, so they appear only on their own or at the end of a word. Ṣād is a heavy letter: the back of the tongue rises as it is said and the sound fills the mouth, unlike sīn."],
    ] },
  { id: "letters-3", letters: "ضطظعغفق", t: ["الحروف الهجائية (٣): من الضاد إلى القاف", "The letters (3): ḍād to qāf"], sub: ["ض ط ظ ع غ ف ق", "ض ط ظ ع غ ف ق"],
    intro: [
      ["في هذا الدرس أكثر الحروف المفخَّمة: ض ط ظ غ ق (مع الصاد والخاء من قبل: «خُصَّ ضَغْطٍ قِظْ»). والعين والغين من وسط الحلق وأدناه، وهي مما لا نظير له في كثير من اللغات، فأكثِرْ من سماعها.", "This lesson holds most of the heavy letters: ض ط ظ غ ق (with ṣād and khāʾ before them, remembered as «خُصَّ ضَغْطٍ قِظْ»). ʿAyn and ghayn come from the middle and top of the throat and have no equivalent in many languages, so listen to them often."],
    ] },
  { id: "letters-4", letters: "كلمنهوي", t: ["الحروف الهجائية (٤): من الكاف إلى الياء", "The letters (4): kāf to yāʾ"], sub: ["ك ل م ن ه و ي", "ك ل م ن ه و ي"],
    intro: [
      ["الواو والياء حرفان لهما شأنان: يكونان حرفين عاديَّين متحركين (وَ، يَ)، ويكونان حرفَي مدٍّ إذا سكنا بعد ضمة أو كسرة، كما سيأتي في درس المدّ. والواو لا تتصل بما بعدها.", "Wāw and yāʾ play two parts: ordinary letters with a vowel (wa, ya), and madd letters when they carry sukūn after a ḍammah or a kasrah, as the lesson on madd will show. Wāw does not join the letter after it."],
    ] },
];

// The lessons of the signs. Every example is checked on its page; colours (want) only where the Tajweed print must show them.
const LESSONS = [
  { id: "harakat", t: ["الحركات الثلاث", "The three short vowels"], sub: ["الفتحة والضمة والكسرة", "Fatḥah, ḍammah and kasrah"],
    intro: [
      ["الحركة علامة صغيرة فوق الحرف أو تحته تبيّن الصوت القصير الذي يُنطق به: الفتحة ( ـَ ) فوق الحرف وصوتها «a»، والضمة ( ـُ ) فوقه وصوتها «u»، والكسرة ( ـِ ) تحته وصوتها «i». الحرف الذي عليه حركة يُسمّى متحرّكًا.", "A vowel sign is a small mark above or below a letter giving the short vowel it is read with: fatḥah ( ـَ ) above the letter sounds ‘a’, ḍammah ( ـُ ) above it sounds ‘u’, and kasrah ( ـِ ) below it sounds ‘i’. A letter carrying a vowel sign is called ‘moving’ (mutaḥarrik)."],
      ["انطق الحرف مع حركته دفعةً واحدة: بَ «ba»، بُ «bu»، بِ «bi». وفي الكلمة تتوالى الحروف المتحركة: خَ لَ قَ ← خَلَقَ.", "Say the letter and its vowel in one go: بَ ‘ba’, بُ ‘bu’, بِ ‘bi’. In a word the moving letters follow one another: خَ لَ قَ → خَلَقَ."],
    ],
    s: [
      { h: ["الفتحة", "Fatḥah"], p: [["كل حرف في هذه الكلمات مفتوح: اقرأها حرفًا حرفًا ثم موصولة.", "Every letter in these words carries a fatḥah: read them letter by letter, then joined."]],
        ex: [ex("96:1", 5, "خَ لَ قَ", "kha-la-qa"), ex("80:1", 1, "عَ بَ سَ", "ʿa-ba-sa"), ex("90:3", 3, "وَ لَ دَ", "wa-la-da"), ex("79:28", 1, "رَ فَ عَ", "ra-fa-ʿa")] },
      { h: ["الضمة والكسرة", "Ḍammah and kasrah"], p: [["في هذه الكلمات تجتمع الحركات الثلاث: الحرف الأول مضموم، والثاني مكسور، والثالث مفتوح.", "In these words the three vowels meet: the first letter has a ḍammah, the second a kasrah, the third a fatḥah."]],
        ex: [ex("86:5", 4, "خُ لِ قَ", "khu-li-qa"), ex("85:4", 1, "قُ تِ لَ", "qu-ti-la"), ex("1:5", 2, "نَعْ بُ دُ: الباء والدال مضمومتان", "naʿ-bu-du: bāʾ and dāl with ḍammah"), ex("1:4", 1, "مَا لِ كِ: اللام والكاف مكسورتان", "mā-li-ki: lām and kāf with kasrah")] },
    ] },
  { id: "tanwin", t: ["التنوين", "Tanwīn"], sub: ["ـً ـٌ ـٍ: نون ساكنة تُنطق ولا تُكتب", "ـً ـٌ ـٍ: a nūn that is heard but not written"],
    intro: [
      ["التنوين حركتان متماثلتان في آخر الاسم: فتحتان ( ـً ) وتُنطقان «an»، وضمتان ( ـٌ ) «un»، وكسرتان ( ـٍ ) «in». فهو حركةٌ بعدها نون ساكنة تُسمع في الوصل ولا تُكتب نونًا.", "Tanwīn is a doubled vowel sign at the end of a noun: two fatḥahs ( ـً ) read ‘an’, two ḍammahs ( ـٌ ) ‘un’, two kasrahs ( ـٍ ) ‘in’. It is a vowel followed by a nūn with sukūn, heard when reading on but never written as a nūn."],
      ["في المصحف يُكتب التنوين على صورتين: متتابعًا ( ـٌ ) أو متراكبًا ( ـٞ )، وكذلك الفتحتان والكسرتان. الصورتان تُقرآن سواء؛ والفرق بينهما من أحكام التجويد (الإظهار والإخفاء) وستتعلمه بعد.", "The Mushaf writes tanwīn in two ways: the two signs one after the other ( ـٌ ) or one above the other ( ـٞ ), and likewise for the two fatḥahs and two kasrahs. Both are read the same; the difference belongs to the rules of Tajweed (iẓhār and ikhfāʾ), taught later."],
      ["عند الوقف على آخر الكلمة يذهب التنوين: فتحتان تصيران ألفًا ممدودة (عَذَابًا ← عَذَابَا)، والضمتان والكسرتان تصيران سكونًا (أَحَدٌ ← أَحَدْ).", "When you stop at the end of the word the tanwīn disappears: two fatḥahs become a long alif (ʿadhāban → ʿadhābā), while two ḍammahs or two kasrahs become sukūn (aḥadun → aḥad)."],
    ],
    s: [
      { h: ["الفتحتان", "Two fatḥahs"], ex: [ex("78:30", 5, "عَذَابًا", "ʿadhāban"), ex("78:20", 4, "سَرَابًا", "sarāban"), ex("112:4", 4, "كُفُوًا", "kufuwan")] },
      { h: ["الضمتان", "Two ḍammahs"], ex: [ex("112:1", 4, "أَحَدٌ", "aḥadun"), ex("104:1", 1, "وَيۡلٞ: ضمتان متراكبتان", "waylun: the two ḍammahs one above the other")] },
      { h: ["الكسرتان", "Two kasrahs"], ex: [ex("78:29", 2, "شَيْءٍ", "shayʾin"), ex("104:1", 4, "لُمَزَةٍ", "lumazatin"), ex("111:1", 4, "لَهَبٖ: كسرتان متراكبتان", "lahabin: the two kasrahs one above the other")] },
    ] },
  { id: "sukun", t: ["السكون", "Sukūn"], sub: ["الحرف الساكن يُنطق بلا حركة", "A still letter, read without a vowel"],
    intro: [
      ["السكون علامة فوق الحرف تدل على أنه بلا حركة، فيُنطق موصولًا بالحرف المتحرك الذي قبله: بِسْ، نَعْ، أَنْ. وفي مصحف المدينة تُرسم علامة السكون رأسَ خاءٍ صغيرة ( ـۡ ).", "Sukūn is a sign above a letter showing it has no vowel: it is read joined to the moving letter before it: bis, naʿ, an. In the Madinah Mushaf the sukūn is drawn as a small head of the letter khāʾ ( ـۡ )."],
      ["الحرف الساكن لا يُبدأ به أبدًا؛ لذلك تبدأ الكلمات دائمًا بحرف متحرك. وقد ترى في المصحف حرفًا بلا أي علامة (لا حركة ولا سكون)، كالنون في ﴿مِنۢ بَعۡدِ﴾: ذلك من أحكام التجويد (الإخفاء والإدغام) وليس سكونًا عاديًّا.", "A still letter can never begin a word, so words always start with a moving letter. You may also see a letter with no sign at all, neither vowel nor sukūn, like the nūn in ﴿مِنۢ بَعۡدِ﴾: that belongs to the rules of Tajweed (ikhfāʾ and idghām) and is not an ordinary sukūn."],
    ],
    s: [
      { h: ["أمثلة", "Examples"], ex: [ex("1:1", 1, "بِسْ مِ", "bis-mi"), ex("1:5", 2, "نَعْ بُ دُ", "naʿ-bu-du"), ex("1:7", 3, "أَنْ عَمْ تَ", "an-ʿam-ta"), ex("104:3", 1, "يَحْ سَ بُ", "yaḥ-sa-bu"), ex("105:1", 1, "أَ لَمْ", "a-lam"), ex("105:2", 2, "يَجْ عَلْ", "yaj-ʿal")] },
    ] },
  { id: "shadda", t: ["الشدة", "Shaddah"], sub: ["حرف مكرَّر: الأول ساكن والثاني متحرك", "A doubled letter: still, then moving"],
    intro: [
      ["الشدة ( ـّ ) فوق الحرف تعني أنه حرفان من جنس واحد نُطقا دفعةً واحدة: الأول ساكن والثاني متحرك. فـ«رَبِّ» = رَبْ بِ، و«إِيَّاكَ» = إِيْ يَا كَ. اضغط على الحرف المشدَّد واجعل زمنه أطول من الحرف المفرد.", "Shaddah ( ـّ ) above a letter means two letters of the same kind said as one: the first still, the second moving. So «رَبِّ» = rab-bi and «إِيَّاكَ» = iy-yā-ka. Press on the doubled letter and hold it longer than a single one."],
      ["حركة الحرف المشدَّد تُكتب مع الشدة: الفتحة والضمة فوقها، والكسرة تحتها أو تحت الحرف.", "The vowel of a doubled letter is written with the shaddah: fatḥah and ḍammah above it, kasrah under it or under the letter."],
    ],
    s: [
      { h: ["أمثلة", "Examples"], ex: [ex("1:2", 3, "رَبْ بِ", "rab-bi"), ex("1:5", 1, "إِيْ يَا كَ", "iy-yā-ka"), ex("1:3", 2, "اَرْ رَ حِيمِ", "ar-ra-ḥīm"), ex("111:1", 1, "تَبْ بَتْ", "tab-bat"), ex("112:2", 2, "اَصْ صَ مَدُ", "aṣ-ṣa-mad"), ex("103:2", 1, "إِنْ نَ", "in-na")] },
    ] },
  { id: "madd", t: ["المدّ الطبيعي والألف الخنجرية", "Natural madd and the dagger alif"], sub: ["ا و ي الساكنة بعد حركتها: صوت طويل بمقدار حركتين", "ا و ي with sukūn after their vowel: a long sound of two counts"],
    intro: [
      ["حروف المدّ ثلاثة: الألف الساكنة بعد فتحة (قَا)، والواو الساكنة بعد ضمة (قُو)، والياء الساكنة بعد كسرة (قِي). تمدّ الصوت بها بمقدار حركتين، أي ضِعف زمن الحرف المتحرك. ولا تُكتب على حروف المدّ علامة سكون.", "There are three madd letters: alif with sukūn after a fatḥah (qā), wāw with sukūn after a ḍammah (qū), and yāʾ with sukūn after a kasrah (qī). Stretch the sound for two counts, twice the length of a moving letter. Madd letters carry no sukūn sign."],
      ["وقد تُكتب ألف المدّ صغيرةً فوق الحرف ( ـٰ ) وتُسمّى الألف الخنجرية، كما في ﴿ٱلرَّحۡمَٰنِ﴾ و﴿مَٰلِكِ﴾: تُمدّ كالألف الكبيرة سواء. وكذلك الواو الصغيرة ( ـۥ ) والياء الصغيرة ( ـۦ ) بعد هاء الضمير تُمدّان حركتين. في مصحف التجويد تُلوَّن هذه الحروف الصغيرة بلون المدّ الطبيعي.", "A madd alif may be written small above the letter ( ـٰ ), the ‘dagger alif’, as in ﴿ٱلرَّحۡمَٰنِ﴾ and ﴿مَٰلِكِ﴾: it is stretched exactly like a full alif. Likewise a small wāw ( ـۥ ) or small yāʾ ( ـۦ ) after the pronoun hāʾ is stretched two counts. The Tajweed Mushaf colours these small letters with the colour of natural madd."],
    ],
    s: [
      { h: ["حروف المدّ الثلاثة", "The three madd letters"], ex: [ex("78:20", 4, "سَرَابًا: ألف بعد فتحة", "sarāban: alif after a fatḥah"), ex("2:8", 4, "يَقُولُ: واو بعد ضمة", "yaqūlu: wāw after a ḍammah"), ex("2:11", 2, "قِيلَ: ياء بعد كسرة", "qīla: yāʾ after a kasrah"), ex("1:5", 4, "نَسْتَعِينُ", "nastaʿīnu"), ex("1:7", 6, "اَلْمَغْضُوبِ", "al-maghḍūbi"), ex("78:20", 2, "اَلْجِبَالُ", "al-jibālu")] },
      { h: ["الألف الخنجرية والحروف الصغيرة", "The dagger alif and the small letters"], ex: [ex("1:1", 3, "اَرْرَحْمَانِ", "ar-raḥmāni", "Y"), ex("1:4", 1, "مَالِكِ", "māliki", "Y"), ex("2:2", 1, "ذَالِكَ", "dhālika", "Y"), ex("106:3", 3, "هَاذَا", "hādhā", "Y"), ex("80:6", 2, "لَهُو: واو صغيرة", "lahū: a small wāw", "Y"), ex("78:15", 2, "بِهِي: ياء صغيرة", "bihī: a small yāʾ", "Y")] },
    ] },
  { id: "lin", t: ["حروف المدّ واللين", "Madd letters and līn letters"], sub: ["الواو والياء الساكنتان بعد فتحة", "Wāw and yāʾ with sukūn after a fatḥah"],
    intro: [
      ["إذا سكنت الواو أو الياء وكان ما قبلها مفتوحًا لم تكونا حرفَي مدّ، بل حرفَي لين: يَوْم، بَيْت. تُنطقان بلطف من غير مدّ (إلا عند الوقف عليهما كما في التجويد)، وتظهر عليهما علامة السكون بخلاف حروف المدّ.", "When wāw or yāʾ carries sukūn after a fatḥah, it is not a madd letter but a līn (soft) letter: yawm, bayt. Say them gently, without stretching (except when stopping on them, as Tajweed teaches), and note that they carry the sukūn sign, unlike madd letters."],
      ["فالفرق بين المدّ واللين في الحركة التي قبل الحرف: قُولُ (ضمة ← مدّ) مقابل قَوْل (فتحة ← لين)، وقِيلَ (كسرة ← مدّ) مقابل قَيْل (فتحة ← لين).", "The difference between madd and līn lies in the vowel before the letter: qūl (ḍammah → madd) against qawl (fatḥah → līn), and qīla (kasrah → madd) against qayl (fatḥah → līn)."],
    ],
    s: [
      { h: ["حرفا اللين", "The two līn letters"], ex: [ex("1:4", 2, "يَوْمِ", "yawmi"), ex("1:7", 5, "غَيْرِ", "ghayri"), ex("105:1", 3, "كَيْفَ", "kayfa"), ex("106:4", 7, "خَوْفٍ", "khawfin"), ex("106:3", 4, "اَلْبَيْتِ", "al-bayti"), ex("106:1", 2, "قُرَيْشٍ", "qurayshin")] },
      { h: ["قارن بحروف المدّ", "Compare with the madd letters"], p: [["اقرأ هذه الكلمات من درس المدّ ثم كلمات اللين أعلاه، وأحسّ بالفرق بين الصوت الممدود والصوت الليّن.", "Read these words from the lesson on madd and then the līn words above, and feel the difference between the stretched sound and the soft one."]],
        ex: [ex("2:8", 4, "يَقُولُ: مدّ", "yaqūlu: madd"), ex("2:11", 2, "قِيلَ: مدّ", "qīla: madd")] },
    ] },
  { id: "lam", t: ["اللام الشمسية والقمرية", "The sun lām and the moon lām"], sub: ["لام «ال» التعريف: تُنطق أو تُدغم", "The lām of «ال»: pronounced, or merged into the next letter"],
    intro: [
      ["«ال» في أول الاسم للتعريف. لامها قمرية تُنطق ساكنة إذا جاء بعدها أحد حروف «أبغ حجك وخف عقيمه» (ا ب غ ح ج ك و خ ف ع ق ي م ه): اَلْحَمْدُ، اَلْقَمَر. وفي المصحف تجد عليها علامة السكون.", "«ال» at the start of a noun is the definite article. Its lām is a ‘moon lām’, pronounced with sukūn, when one of the letters of «أبغ حجك وخف عقيمه» (ا ب غ ح ج ك و خ ف ع ق ي م ه) follows: al-ḥamdu, al-qamar. In the Mushaf it carries the sukūn sign."],
      ["وهي شمسية لا تُنطق، بل يُشدَّد الحرف الذي بعدها، إذا جاء بعدها أحد الحروف الأربعة عشر الباقية (ت ث د ذ ر ز س ش ص ض ط ظ ل ن): اَلشَّمْس تُقرأ «اَشْشَمْس». في المصحف تكون هذه اللام بلا علامة وعلى الحرف بعدها شدة، وفي مصحف التجويد تُلوَّن باللون الرمادي لأنها لا تُنطق.", "It is a ‘sun lām’, not pronounced, with the next letter doubled instead, when one of the other fourteen letters follows (ت ث د ذ ر ز س ش ص ض ط ظ ل ن): al-shams is read ‘ash-shams’. In the Mushaf this lām carries no sign and the letter after it carries a shaddah; the Tajweed Mushaf colours it grey because it is silent."],
    ],
    s: [
      { h: ["اللام الشمسية: لا تُنطق", "The sun lām: not pronounced"], ex: [ex("1:1", 3, "اَرْرَحْمَانِ", "ar-raḥmāni", "g"), ex("1:4", 3, "اَدْدِينِ", "ad-dīni", "g"), ex("1:6", 2, "اَصْصِرَاطَ", "aṣ-ṣirāṭa", "g"), ex("114:1", 4, "اَنْنَاسِ", "an-nāsi", "g"), ex("91:1", 1, "وَشْشَمْسِ", "wash-shamsi", "g"), ex("95:1", 1, "وَتْتِينِ", "wat-tīni", "g")] },
      { h: ["اللام القمرية: تُنطق ساكنة", "The moon lām: pronounced with sukūn"], ex: [ex("1:2", 1, "اَلْحَمْدُ", "al-ḥamdu"), ex("1:2", 4, "اَلْعَالَمِينَ", "al-ʿālamīna"), ex("2:2", 2, "اَلْكِتَابُ", "al-kitābu"), ex("113:1", 4, "اَلْفَلَقِ", "al-falaqi"), ex("97:1", 5, "اَلْقَدْرِ", "al-qadri"), ex("78:20", 2, "اَلْجِبَالُ", "al-jibālu")] },
    ] },
  { id: "hamza", t: ["همزة الوصل وهمزة القطع", "Hamzat al-waṣl and hamzat al-qaṭʿ"], sub: ["ٱ تسقط في الوصل، وأ إ تُنطق دائمًا", "ٱ drops when reading on; أ and إ are always pronounced"],
    intro: [
      ["همزة القطع تُكتب على الألف أو تحتها (أَ أُ إِ) وتُنطق دائمًا، في أول الكلام وفي وسطه: أَنْعَمْتَ، إِيَّاكَ.", "Hamzat al-qaṭʿ is written on or under the alif (أَ أُ إِ) and is always pronounced, whether you start with it or read on through it: anʿamta, iyyāka."],
      ["همزة الوصل ألفٌ عليها رأس صاد صغيرة ( ٱ ): تُنطق إذا بدأت بها الكلام، وتسقط إذا وصلت ما قبلها بها. تكون في «ال» التعريف وفي أوائل بعض الأفعال والأسماء: ٱهْدِنَا، ٱسْم. في مصحف التجويد تُلوَّن رمادية لأنها لا تُنطق في الوصل.", "Hamzat al-waṣl is an alif with a small head of ṣād on it ( ٱ ): it is pronounced when you begin with it, and dropped when you join the word to what comes before. It is found in the article «ال» and at the start of some verbs and nouns: ihdinā, ism. The Tajweed Mushaf colours it grey, because it is silent when reading on."],
      ["وإذا بدأتَ بهمزة الوصل فحركتها: الفتحة في «ال» (اَلْحَمْدُ)، والكسرة في الأسماء والأفعال غالبًا (اِهْدِنَا، اِسْم)، والضمة إذا كان ثالث الفعل مضمومًا (اُذْكُرْ).", "If you begin with hamzat al-waṣl, its vowel is a fatḥah in the article (al-ḥamdu), usually a kasrah in nouns and verbs (ihdinā, ism), and a ḍammah when the third letter of the verb has a ḍammah (udhkur)."],
    ],
    s: [
      { h: ["همزة الوصل", "Hamzat al-waṣl"], p: [["في أول الآية يُبدأ بها فتُنطق، وفي وسط الكلام تسقط؛ ولذلك يلوّنها مصحف التجويد بالرمادي في وسط الآية فقط.", "At the start of a verse you begin with it, so it is pronounced; inside the verse it drops away, which is why the Tajweed Mushaf greys it only there."]],
        ex: [ex("1:6", 1, "اِهْدِنَا: في أول الآية، تُنطق", "ihdinā: starting the verse, pronounced"), ex("1:2", 1, "اَلْحَمْدُ: في أول الآية، تُنطق", "al-ḥamdu: starting the verse, pronounced"), ex("87:1", 2, "سَبِّحِ ٱسْمَ ← سَبِّحِسْمَ", "sabbiḥi sma: dropped in the joining", "g"), ex("78:39", 6, "مَنْ شَاءَ ٱتَّخَذَ ← شَاءَتَّخَذَ", "shāʾa ttakhadha: dropped in the joining", "g"), ex("2:4", 1, "وَٱلَّذِينَ ← وَلَّذِينَ", "walladhīna: the article’s hamzah dropped", "g"), ex("79:17", 1, "اِذْهَبْ: في أول الآية، تُنطق", "idhhab: starting the verse, pronounced")] },
      { h: ["همزة القطع", "Hamzat al-qaṭʿ"], ex: [ex("1:7", 3, "أَنْعَمْتَ", "anʿamta"), ex("1:5", 1, "إِيَّاكَ", "iyyāka"), ex("112:1", 4, "أَحَدٌ", "aḥadun"), ex("105:1", 1, "أَلَمْ", "alam"), ex("103:2", 1, "إِنَّ", "inna"), ex("96:1", 1, "اِقْرَأْ: همزة وصل أولًا، وهمزة قطع ساكنة آخرًا", "iqraʾ: hamzat al-waṣl first, a still hamzat al-qaṭʿ last")] },
    ] },
  { id: "ta", t: ["التاء المربوطة والتاء المفتوحة", "The tied tāʾ and the open tāʾ"], sub: ["ة تُقرأ هاءً عند الوقف، وت تبقى تاءً", "ة becomes hāʾ when you stop; ت stays tāʾ"],
    intro: [
      ["التاء المربوطة ( ة ) تأتي في آخر الاسم: تُنطق تاءً إذا وصلتَ الكلمة بما بعدها (اَلْجَنَّةَ وَ…)، وهاءً ساكنة إذا وقفتَ عليها (اَلْجَنَّهْ).", "The tied tāʾ ( ة ) comes at the end of a noun: it is read as tāʾ when you join the word to the next (al-jannata wa…), and as a still hāʾ when you stop on it (al-jannah)."],
      ["التاء المفتوحة ( ت ) تُنطق تاءً دائمًا، وصلًا ووقفًا: في الأفعال (تَبَّتْ، زُلْزِلَتْ) وفي أسماء رُسمت في المصحف بالتاء المفتوحة مثل ﴿رَحۡمَتَ ٱللَّهِ﴾ و﴿ٱمۡرَأَتُ﴾، فيُوقف عليها بالتاء.", "The open tāʾ ( ت ) is always read as tāʾ, whether you join or stop: in verbs (tabbat, zulzilat) and in nouns the Mushaf spells with an open tāʾ, such as ﴿رَحۡمَتَ ٱللَّهِ﴾ and ﴿ٱمۡرَأَتُ﴾, where you stop with a tāʾ."],
    ],
    s: [
      { h: ["التاء المربوطة", "The tied tāʾ"], ex: [ex("2:3", 5, "اَصْصَلَاةَ، وقفًا: اَصْصَلَاهْ", "aṣ-ṣalāta; stopping: aṣ-ṣalāh"), ex("79:41", 2, "اَلْجَنَّةَ، وقفًا: اَلْجَنَّهْ", "al-jannata; stopping: al-jannah"), ex("79:42", 3, "اَسْسَاعَةِ، وقفًا: اَسْسَاعَهْ", "as-sāʿati; stopping: as-sāʿah"), ex("101:1", 1, "اَلْقَارِعَةُ، وقفًا: اَلْقَارِعَهْ", "al-qāriʿatu; stopping: al-qāriʿah")] },
      { h: ["التاء المفتوحة", "The open tāʾ"], ex: [ex("111:4", 1, "وَٱمْرَأَتُهُ: اسم بالتاء المفتوحة", "wamraʾatuhū: a noun with an open tāʾ"), ex("2:218", 12, "رَحْمَتَ: وقفًا رَحْمَتْ", "raḥmata; stopping: raḥmat"), ex("111:1", 1, "تَبَّتْ: فعل", "tabbat: a verb"), ex("99:1", 2, "زُلْزِلَتِ: فعل", "zulzilati: a verb")] },
    ] },
  { id: "waqf", t: ["علامات الوقف", "The stop signs"], sub: ["حروف صغيرة فوق آخر الكلمة تدلّ على موضع الوقف وحكمه", "Small letters above the end of a word telling where to pause, and whether to"],
    intro: [
      ["الوقف قطعُ الصوت على آخر الكلمة للتنفّس، ثم استئناف القراءة. وعند الوقف يُسكَّن الحرف الأخير (رَبِّ ← رَبْ)، والفتحتان تصيران ألفًا، والتاء المربوطة هاءً، كما مرّ.", "A stop (waqf) is cutting the voice at the end of a word to breathe, then resuming. When you stop, the last letter takes sukūn (rabbi → rab), two fatḥahs become an alif, and the tied tāʾ becomes hāʾ, as you have learned."],
      ["وفوق بعض الكلمات حروف صغيرة تدلّ القارئ على حكم الوقف عندها:", "Small letters above some words tell the reader how to treat a stop there:"],
    ],
    s: [
      { h: ["العلامات", "The signs"],
        list: [
          ["مـ: وقف لازم، يجب الوقف عنده لأن الوصل يغيّر المعنى.", "مـ: a compulsory stop; reading on would change the meaning."],
          ["ج: وقف جائز، الوقف والوصل سواء.", "ج: a permitted stop; stopping and reading on are equal."],
          ["صلى: الوصل أولى، والوقف جائز.", "صلى: reading on is preferred; stopping is allowed."],
          ["قلى: الوقف أولى، والوصل جائز.", "قلى: stopping is preferred; reading on is allowed."],
          ["لا: لا تقف هنا؛ فإن وقفتَ للتنفّس فارجع وصِلْ بما قبله. ولا تُكتب في المصحف إلا في وسط الآية.", "لا: do not stop here; if you must breathe, go back and join it to what came before. It is written only inside a verse."],
          ["∴ ∴: علامتا تعانق الوقف، يُوقف على إحداهما لا على كلتيهما.", "∴ ∴: two linked stops; stop at one of them, not both."],
          ["س: سكتة لطيفة من غير تنفّس.", "س: a brief silence without taking a breath."],
          ["ورأس الآية (الدائرة التي فيها رقمها) موضعُ وقفٍ حسن دائمًا.", "The verse marker (the circle holding the verse number) is always a good place to stop."],
        ],
        ex: [ex("2:26", 28, "مَثَلًا مـ: وقف لازم", "mathalan with مـ: compulsory stop"), ex("2:19", 16, "اَلْمَوْتِ ج: وقف جائز", "al-mawti with ج: permitted stop"), ex("2:5", 5, "رَبِّهِمْ صلى: الوصل أولى", "rabbihim with صلى: reading on preferred"), ex("2:13", 12, "اَسْسُفَهَاءُ قلى: الوقف أولى", "as-sufahāʾu with قلى: stopping preferred"), ex("2:2", [4, 5], "رَيْبَ ∴ فِيهِ ∴: تعانق الوقف", "rayba ∴ fīhi ∴: linked stops"), ex("83:14", 2, "بَلْ س: سكتة", "bal with س: a brief silence")] },
    ] },
];

module.exports = { SOURCE, INTRO, FORMS, LETTERS, MUQ, LETTER_WORDS, LETTER_LESSONS, LESSONS };
