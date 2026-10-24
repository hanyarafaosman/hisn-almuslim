// Builds www/kutub/: books of creed (the ʿaqida of Ahl as-Sunnah wal-Jamaʿah), the relied-upon primer (matn)
// of each of the four schools of fiqh, and books of the imams (Ibn Qudamah, Ibn Hazm, Ibn Taymiyyah, Ibn al-Qayyim…).
// Text: turath.io. The whole book comes from files.turath.io/books-v3/<id>.json and its headings from
// api.turath.io/book; both follow the printed edition page by page. The text is copied word for word:
// the script only splits each book at its own headings, joins a sentence that runs over a page break,
// and ties every footnote to the place that refers to it.
// A book is written as kutub/<id>.<hash>.json (its contents and reading pages) and the text of its reading pages
// as kutub/<id>/<n>.<hash>.json, about 250 KB each, so a reader downloads only the part being read (al-Mughni
// alone is 30 MB). Every name carries a hash of its bytes: a corrected part gets a new name and devices never keep
// an old copy.
// Usage: node scripts/build-kutub.js
//        node scripts/build-kutub.js --only=mawsua-kuwaitiya --dry   (check one book's build without writing anything)
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ARGS = Object.fromEntries(process.argv.slice(2).map(a => { const m = /^--([\w-]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ONLY = ARGS.only ? String(ARGS.only).split(",") : null, DRY = !!ARGS.dry;
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "kutub");
const OUT = path.join(ROOT, "www", "kutub");
const API = "https://api.turath.io", FILES = "https://files.turath.io";

// unit: the heading level that starts a reading page (deeper headings are shown inside it); 0 makes a short book one page;
// "auto" makes each reading page the largest part of the book's outline that fits PAGE characters (big books).
// from: first page of the book's own text (earlier pages are a catalogue card or a publisher's preface);
// to: its last page (later pages are the editor's conclusion and references); skip: [first, last] page ranges
// left out in between (an index printed at the end of a volume).
// items: the book has no chapters, only numbered paragraphs (one page; the contents lists each paragraph).
// marks "text": the headings are read from the marks in the text, not from turath.io's index of headings (see build()).
// group: the shelf of the library (GROUPS); author: a key of AUTHORS, for browsing the books of one author.
const GROUPS = ["aqida", "hadith", "fiqh", "usul", "tafsir", "sira", "suluk", "fatawa"];
const AUTHORS = {
  "ahmad": { ar: "الإمام أحمد", en: "Imam Ahmad" },
  "tahawi": { ar: "الطحاوي", en: "At-Tahawi" },
  "quduri": { ar: "القدوري", en: "Al-Quduri" },
  "ibn-abi-zayd": { ar: "ابن أبي زيد القيرواني", en: "Ibn Abi Zayd al-Qayrawani" },
  "ibn-hazm": { ar: "ابن حزم", en: "Ibn Hazm" },
  "abu-shuja": { ar: "أبو شجاع", en: "Abu Shujaʿ" },
  "abd-al-ghani": { ar: "عبد الغني المقدسي", en: "ʿAbd al-Ghani al-Maqdisi" },
  "ibn-qudamah": { ar: "ابن قدامة", en: "Ibn Qudamah" },
  "ibn-taymiyyah": { ar: "ابن تيمية", en: "Ibn Taymiyyah" },
  "ibn-qayyim": { ar: "ابن القيم", en: "Ibn al-Qayyim" },
  "hajjawi": { ar: "الحجاوي", en: "Al-Hajjawi" },
  "ibn-abd-al-wahhab": { ar: "محمد بن عبد الوهاب", en: "Muhammad ibn ʿAbd al-Wahhab" },
  "qahtani": { ar: "سعيد بن وهف القحطاني", en: "Saʿid ibn Wahf al-Qahtani" },
  "kuwait-awqaf": { ar: "وزارة الأوقاف الكويتية", en: "Kuwait Ministry of Awqaf" }, // an institution: died is 0
};
const QUDAMAH = { author: "ibn-qudamah", died: 620, by: "موفق الدين ابن قدامة المقدسي", byEn: "Muwaffaq ad-Din Ibn Qudamah al-Maqdisi" };
const HAZM = { author: "ibn-hazm", died: 456, by: "ابن حزم الأندلسي", byEn: "Ibn Hazm al-Andalusi" };
const TAYMIYYAH = { author: "ibn-taymiyyah", died: 728, by: "شيخ الإسلام ابن تيمية", byEn: "Shaykh al-Islam Ibn Taymiyyah" };
const QAYYIM = { author: "ibn-qayyim", died: 751, by: "ابن قيم الجوزية", byEn: "Ibn Qayyim al-Jawziyyah" };
const BOOKS = [
  {
    id: "usul-sunnah", turath: 6418, group: "aqida", author: "ahmad", died: 241, unit: 0,
    ar: "أصول السنة", en: "Usul as-Sunnah", by: "الإمام أحمد بن حنبل", byEn: "Imam Ahmad ibn Hanbal",
    about: "رسالة موجزة في أصول اعتقاد أهل السنة، رواها عبدوس بن مالك العطار عن الإمام أحمد.",
    aboutEn: "A short epistle on the foundations of the creed of Ahl as-Sunnah, narrated from Imam Ahmad by ʿAbdus ibn Malik al-ʿAttar.",
  },
  {
    id: "tahawiyya", turath: 9568, group: "aqida", author: "tahawi", died: 321, items: true,
    ar: "العقيدة الطحاوية", en: "Al-ʿAqida at-Tahawiyya", by: "أبو جعفر الطحاوي", byEn: "Abu Jaʿfar at-Tahawi",
    about: "بيان عقيدة أهل السنة والجماعة على مذهب أبي حنيفة وصاحبيه، من أوسع متون العقيدة قبولًا. والحواشي تعليق الشيخ محمد ناصر الدين الألباني.",
    aboutEn: "The creed of Ahl as-Sunnah wal-Jamaʿah according to Abu Hanifah and his two companions, one of the most widely accepted creeds. The footnotes are by Shaykh Muhammad Nasir ad-Din al-Albani.",
  },
  {
    id: "lumah", turath: 30855, group: "aqida", author: "ibn-qudamah", died: 620, unit: 0,
    ar: "لمعة الاعتقاد", en: "Lumʿat al-Iʿtiqad", by: "ابن قدامة المقدسي", byEn: "Ibn Qudamah al-Maqdisi",
    about: "متن مختصر في صفات الله تعالى والقرآن والرؤية والقدر والإيمان واليوم الآخر والصحابة، على طريقة السلف.",
    aboutEn: "A concise creed on the attributes of Allah, the Quran, the vision of Allah, predestination, faith, the Last Day and the Companions, in the way of the Salaf.",
  },
  {
    id: "dhamm-tawil", turath: 6425, group: "aqida", ...QUDAMAH, unit: "auto",
    ar: "ذم التأويل", en: "Dhamm at-Taʾwil (Censure of Figurative Interpretation)",
    about: "ينقل فيه بأسانيده كلام السلف في إمرار آيات الصفات وأحاديثها كما جاءت، وترك تأويلها.",
    aboutEn: "He quotes the Salaf, with chains of narration, on passing on the verses and hadith of Allah's attributes as they came, without figurative interpretation.",
  },
  {
    id: "wasitiyya", turath: 22665, group: "aqida", author: "ibn-taymiyyah", died: 728, from: 2, unit: 2,
    ar: "العقيدة الواسطية", en: "Al-ʿAqida al-Wasitiyya", by: "شيخ الإسلام ابن تيمية", byEn: "Shaykh al-Islam Ibn Taymiyyah",
    about: "كتبها لقاضٍ من واسط سأله أن يكتب له عقيدة: أصول اعتقاد أهل السنة والجماعة بأدلتها من الكتاب والسنة. والنص مشكول.",
    aboutEn: "Written for a judge from Wasit who asked him for a creed: the foundations of the belief of Ahl as-Sunnah wal-Jamaʿah with their proofs from the Quran and Sunnah. Fully vowelled.",
  },
  {
    id: "tadmuriyya", turath: 22666, group: "aqida", ...TAYMIYYAH, unit: "auto",
    ar: "التدمرية", en: "At-Tadmuriyya",
    about: "تحقيق الإثبات لأسماء الله وصفاته، وحقيقة الجمع بين القدر والشرع، كتبها جوابًا لسؤال من أهل تدمر.",
    aboutEn: "Affirming Allah's names and attributes, and how His decree and His law go together; written in answer to a question from the people of Palmyra (Tadmur).",
  },
  {
    id: "hamawiyya", turath: 18381, group: "aqida", ...TAYMIYYAH, unit: "auto",
    ar: "الفتوى الحموية الكبرى", en: "Al-Fatwa al-Hamawiyya al-Kubra",
    about: "جوابه عن سؤال من أهل حماة في آيات الصفات وأحاديثها، بأقوال السلف والأئمة.",
    aboutEn: "His answer to a question from the people of Hama on the verses and hadith of Allah's attributes, with the statements of the Salaf and the imams.",
  },
  {
    id: "ubudiyya", turath: 22647, group: "aqida", ...TAYMIYYAH, unit: "auto",
    ar: "العبودية", en: "Al-ʿUbudiyya (Servitude)",
    about: "معنى العبادة، وأنها اسم جامع لكل ما يحبه الله ويرضاه من الأقوال والأعمال، وتحقيق العبودية لله وحده.",
    aboutEn: "What worship is: a word for everything Allah loves and is pleased with of sayings and deeds, and how to be a true servant of Allah alone.",
  },
  {
    id: "furqan", turath: 21499, group: "aqida", ...TAYMIYYAH, unit: "auto",
    ar: "الفرقان بين أولياء الرحمن وأولياء الشيطان", en: "Al-Furqan: The Allies of the Most Merciful and the Allies of Satan",
    about: "صفات أولياء الله المتقين وأولياء الشيطان، والفرق بين الكرامات والأحوال الشيطانية.",
    aboutEn: "The marks of Allah's God-fearing allies and of Satan's allies, and the difference between true wonders and satanic states.",
  },
  {
    id: "iman", turath: 7564, group: "aqida", ...TAYMIYYAH, unit: "auto", to: 352,
    ar: "الإيمان", en: "Al-Iman (Faith)",
    about: "معنى الإسلام والإيمان والإحسان، وأن الإيمان قول وعمل يزيد وينقص. بتحقيق الشيخ الألباني.",
    aboutEn: "The meaning of Islam, iman and ihsan, and that faith is word and deed and increases and decreases. Edited by Shaykh al-Albani.",
  },
  {
    id: "iqtida", turath: 11620, loose: true, group: "aqida", ...TAYMIYYAH, unit: "auto", from: 59, to: 937,
    ar: "اقتضاء الصراط المستقيم لمخالفة أصحاب الجحيم", en: "Iqtidaʾ as-Sirat al-Mustaqim",
    about: "النهي عن التشبه بالكفار في أعيادهم وعاداتهم، وأحكام الأعياد والمواسم المحدثة. بتحقيق ناصر العقل.",
    aboutEn: "The prohibition of imitating the disbelievers in their festivals and customs, and the rulings on invented festivals and seasons. Edited by Nasir al-ʿAql.",
  },
  {
    id: "minhaj", turath: 927, loose: true, group: "aqida", ...TAYMIYYAH, unit: "auto",
    ar: "منهاج السنة النبوية", en: "Minhaj as-Sunnah an-Nabawiyya",
    about: "نقض كتاب ابن المطهر الحلي «منهاج الكرامة»، والدفاع عن الصحابة وعقيدة أهل السنة. بتحقيق محمد رشاد سالم، في ثمانية مجلدات.",
    aboutEn: "A refutation of Ibn al-Mutahhar al-Hilli's Minhaj al-Karama, defending the Companions and the creed of Ahl as-Sunnah. Edited by Muhammad Rashad Salim, in eight volumes.",
  },
  {
    id: "ruh", turath: 6462, group: "aqida", ...QAYYIM, unit: "auto",
    ar: "الروح", en: "Ar-Ruh (The Soul)",
    about: "مسائل الروح: معرفة الأموات بزيارة الأحياء، وعذاب القبر ونعيمه، ومستقر الأرواح بعد الموت، بالأدلة.",
    aboutEn: "Questions about the soul: whether the dead know of the living's visits, the punishment and bliss of the grave, and where souls rest after death, with the proofs.",
  },
  {
    id: "tawhid", turath: 11318, group: "aqida", author: "ibn-abd-al-wahhab", died: 1206,
    ar: "كتاب التوحيد", en: "Kitab at-Tawhid", by: "محمد بن عبد الوهاب", byEn: "Muhammad ibn ʿAbd al-Wahhab",
    about: "أبواب في توحيد العبادة وما ينافيه أو ينقصه، في كل باب الآيات والأحاديث ثم مسائله.",
    aboutEn: "Chapters on worshipping Allah alone and what negates or weakens it; each chapter gives verses and hadith, then the points it teaches.",
  },
  {
    id: "usul-thalatha", turath: 239, group: "aqida", author: "ibn-abd-al-wahhab", died: 1206, from: 6,
    ar: "ثلاثة الأصول وأدلتها", en: "The Three Fundamental Principles", by: "محمد بن عبد الوهاب", byEn: "Muhammad ibn ʿAbd al-Wahhab",
    about: "معرفة العبد ربه ودينه ونبيه ﷺ بالأدلة، ويليها «شروط الصلاة وأركانها وواجباتها» و«القواعد الأربع».",
    aboutEn: "Knowing one's Lord, one's religion and one's Prophet ﷺ with the proofs, followed by “The Conditions, Pillars and Obligations of Prayer” and “The Four Principles”.",
  },
  {
    id: "bayan-aqida", turath: 96481, group: "aqida", author: "qahtani", died: 1440, from: 2, unit: 2,
    ar: "بيان عقيدة أهل السنة والجماعة ولزوم اتباعها", en: "The Creed of Ahl as-Sunnah wal-Jamaʿah", by: "د. سعيد بن علي بن وهف القحطاني", byEn: "Dr. Saʿid ibn ʿAli ibn Wahf al-Qahtani",
    about: "لمؤلف حصن المسلم: مفهوم عقيدة أهل السنة والجماعة، وأصولها الستة، ووسطية أهلها بين الفرق، وأخلاقهم، بالأدلة. محاضرة أشرف عليها الشيخ عبد العزيز بن باز وأقرّها.",
    aboutEn: "By the author of Hisn al-Muslim: what the creed of Ahl as-Sunnah wal-Jamaʿah is, its six foundations, the middle way of its people between the sects, and their character, with the proofs. A lecture supervised and approved by Shaykh ʿAbd al-ʿAziz ibn Baz.",
  },
  {
    id: "umdat-ahkam", turath: 6075, group: "hadith", author: "abd-al-ghani", died: 600, unit: "auto", from: 3,
    ar: "عمدة الأحكام من كلام خير الأنام ﷺ", en: "ʿUmdat al-Ahkam", by: "الحافظ عبد الغني المقدسي", byEn: "Al-Hafiz ʿAbd al-Ghani al-Maqdisi",
    about: "أحاديث الأحكام انتقاها المؤلف من الصحيحين، مرتبة على أبواب الفقه. والنص مشكول، بتحقيق محمود الأرناؤوط.",
    aboutEn: "Hadith on legal rulings that the author selected from the two Sahihs, arranged by the chapters of fiqh. Fully vowelled, edited by Mahmud al-Arnaʾut.",
  },
  {
    id: "quduri", turath: 124336, group: "fiqh", author: "quduri", madhhab: "hanafi", died: 428, unit: 2,
    ar: "مختصر القدوري", en: "Mukhtasar al-Quduri", by: "أبو الحسين القدوري", byEn: "Abu al-Husayn al-Quduri",
    about: "من أشهر متون المذهب الحنفي وأكثرها اعتمادًا، ويُسمّى «الكتاب»، في أبواب الفقه كلها.",
    aboutEn: "One of the best-known and most relied-upon primers of the Hanafi school, known simply as “al-Kitab”, covering every chapter of fiqh.",
  },
  {
    // The Dar al-Fikr copy (turath 11373) has no punctuation or paragraphs; this edition is vowelled and punctuated.
    id: "risala", turath: 1430, group: "fiqh", author: "ibn-abi-zayd", madhhab: "maliki", died: 386, from: 75, to: 330,
    ar: "الرسالة", en: "Ar-Risala", by: "ابن أبي زيد القيرواني", byEn: "Ibn Abi Zayd al-Qayrawani",
    about: "أشهر متون المذهب المالكي: بدأها بباب في العقيدة، ثم العبادات والمعاملات والآداب. والنص مشكول، جمعه المحقق من شرح التتائي وقابله بالمخطوطات، والحواشي تعليقاته.",
    aboutEn: "The best-known primer of the Maliki school: it opens with a chapter on creed, then worship, transactions and manners. Fully vowelled; the editor compiled the text from at-Tata'i's commentary and checked it against manuscripts, and the footnotes are his.",
  },
  {
    id: "abu-shuja", turath: 11370, group: "fiqh", author: "abu-shuja", madhhab: "shafii", died: 593,
    ar: "متن أبي شجاع (الغاية والتقريب)", en: "Matn Abi Shujaʿ (al-Ghaya wa-t-Taqrib)", by: "القاضي أبو شجاع الأصفهاني", byEn: "Al-Qadi Abu Shujaʿ al-Asfahani",
    about: "مختصر في فقه المذهب الشافعي، من أكثر المتون تدريسًا للمبتدئين، في أبواب الفقه كلها.",
    aboutEn: "A concise primer of Shafiʿi fiqh, among the texts most taught to beginners, covering every chapter of fiqh.",
  },
  {
    id: "zad", turath: 11230, group: "fiqh", author: "hajjawi", madhhab: "hanbali", died: 968, unit: 2,
    // Footnote 1 of page 170 is about a word on the page before (بالنداء) and has no mark in the edition.
    known: ["p170: footnote(s) 1 have no mark in the text"],
    ar: "زاد المستقنع في اختصار المقنع", en: "Zad al-Mustaqniʿ", by: "موسى الحجاوي", byEn: "Musa al-Hajjawi",
    about: "اختصر فيه «المقنع» لابن قدامة على قول واحد هو المعتمد في المذهب الحنبلي، وعليه يدرس طلاب المذهب. والحواشي فروق النسخ الخطية.",
    aboutEn: "An abridgement of Ibn Qudamah's al-Muqniʿ keeping one view, the one relied upon in the Hanbali school; students of the school study it first. The footnotes give the differences between the manuscripts.",
  },
  // Ibn Qudamah's four books of fiqh, from the beginner's to the comparative.
  {
    id: "umdat-fiqh", turath: 11315, loose: true, group: "fiqh", madhhab: "hanbali", ...QUDAMAH, unit: "auto",
    ar: "عمدة الفقه", en: "ʿUmdat al-Fiqh",
    about: "أول كتب ابن قدامة الأربعة في الفقه: متن للمبتدئين على قول واحد في المذهب الحنبلي، في أبواب الفقه كلها.",
    aboutEn: "The first of Ibn Qudamah's four books of fiqh: a primer for beginners giving one view of the Hanbali school, across every chapter of fiqh.",
  },
  {
    id: "muqni", turath: 19233, loose: true, group: "fiqh", madhhab: "hanbali", ...QUDAMAH, unit: "auto", from: 17, to: 520,
    ar: "المقنع في فقه الإمام أحمد", en: "Al-Muqniʿ",
    about: "ثاني كتبه في الفقه: يذكر فيه الروايتين أو الوجهين في المذهب في الغالب، وعليه بُني «زاد المستقنع». بتحقيق الأرناؤوط.",
    aboutEn: "His second book of fiqh: it usually gives the two narrations or views within the school; Zad al-Mustaqniʿ is its abridgement. Edited by al-Arnaʾut.",
  },
  {
    id: "kafi", turath: 21731, group: "fiqh", madhhab: "hanbali", ...QUDAMAH, unit: "auto",
    ar: "الكافي في فقه الإمام أحمد", en: "Al-Kafi",
    about: "ثالث كتبه في الفقه: الفقه الحنبلي بأدلته من الكتاب والسنة والقياس، في أربعة مجلدات.",
    aboutEn: "His third book of fiqh: Hanbali fiqh with its proofs from the Quran, the Sunnah and analogy, in four volumes.",
  },
  {
    id: "mughni", turath: 8463, group: "fiqh", madhhab: "hanbali", ...QUDAMAH, unit: "auto",
    ar: "المغني", en: "Al-Mughni",
    about: "شرح ابن قدامة على مختصر الخرقي، أوسع كتب الفقه المقارن: أقوال الصحابة والتابعين والأئمة بأدلتها. طبعة مكتبة القاهرة في عشرة مجلدات.",
    aboutEn: "Ibn Qudamah's commentary on the Mukhtasar of al-Khiraqi, the great book of comparative fiqh: the views of the Companions, the Successors and the imams with their proofs. The Cairo edition in ten volumes.",
  },
  {
    id: "muhalla", turath: 767, group: "fiqh", madhhab: "zahiri", ...HAZM, unit: "auto",
    ar: "المحلى بالآثار", en: "Al-Muhalla",
    about: "فقه ابن حزم على المذهب الظاهري: المسائل بأدلتها من القرآن والحديث والآثار، مع مناقشة أقوال المذاهب. والنص مشكول، في اثني عشر مجلدًا.",
    aboutEn: "Ibn Hazm's fiqh in the Zahiri school: each question with its proofs from the Quran, hadith and reports, discussing the other schools. Fully vowelled, in twelve volumes.",
  },
  {
    id: "maratib-ijma", turath: 12446, group: "fiqh", ...HAZM, unit: "auto",
    ar: "مراتب الإجماع", en: "Maratib al-Ijmaʿ",
    about: "ما أجمع عليه العلماء في العبادات والمعاملات والاعتقاد، كما جمعه ابن حزم. والحواشي تعقبات ابن تيمية عليه في «نقد مراتب الإجماع»، أضافها معدّ النسخة الإلكترونية.",
    aboutEn: "What the scholars agreed upon in worship, transactions and belief, as gathered by Ibn Hazm. The footnotes are Ibn Taymiyyah's remarks on it from Naqd Maratib al-Ijmaʿ, added by the preparer of the digital copy.",
  },
  {
    id: "mawsua-kuwaitiya", turath: 11430, loose: true, marks: "text", group: "fiqh", author: "kuwait-awqaf", died: 0, unit: "auto",
    ar: "الموسوعة الفقهية الكويتية", en: "The Kuwaiti Encyclopedia of Fiqh", by: "وزارة الأوقاف والشئون الإسلامية بالكويت", byEn: "Kuwait Ministry of Awqaf and Islamic Affairs",
    about: "أوسع موسوعة في الفقه الإسلامي: مصطلحات الفقه مرتبة على حروف المعجم، وفي كل مصطلح أقوال المذاهب الأربعة وغيرها بأدلتها. خمسة وأربعون جزءًا، وتراجم الفقهاء في آخرها.",
    aboutEn: "The largest encyclopedia of Islamic fiqh: the terms of fiqh in alphabetical order, each with the views of the four schools and others with their proofs. Forty-five volumes, with the biographies of the jurists at the end.",
  },
  {
    id: "siyasa", turath: 31237, group: "fiqh", ...TAYMIYYAH, unit: "auto",
    ar: "السياسة الشرعية في إصلاح الراعي والرعية", en: "As-Siyasa ash-Sharʿiyya",
    about: "أداء الأمانات إلى أهلها والحكم بالعدل: الولايات والأموال والحدود والحقوق. والنص مشكول.",
    aboutEn: "Giving trusts to those they are due and judging with justice: public offices, wealth, the prescribed punishments and rights. Fully vowelled.",
  },
  {
    id: "nubdha", turath: 6321, group: "usul", ...HAZM, unit: "auto",
    ar: "النبذة الكافية في أحكام أصول الدين", en: "An-Nubdha al-Kafiya",
    about: "مختصر ابن حزم في أصول الفقه على طريقة الظاهرية: الأدلة الشرعية، وما لا يُحتج به عنده كالقياس والتقليد.",
    aboutEn: "Ibn Hazm's short book on the principles of fiqh in the Zahiri way: the proofs of the law, and what he does not accept as proof, such as analogy and blind following.",
  },
  {
    id: "rawda", turath: 12010, loose: true, group: "usul", ...QUDAMAH, unit: "auto", from: 45, to: 1115, skip: [[665, 688]],
    ar: "روضة الناظر وجنة المناظر", en: "Rawdat an-Nazir",
    about: "أشهر كتب أصول الفقه عند الحنابلة: الحكم الشرعي، والأدلة، ودلالات الألفاظ، والقياس، والاجتهاد والترجيح.",
    aboutEn: "The best-known Hanbali book on the principles of fiqh: the legal ruling, the proofs, the meanings of words, analogy, independent reasoning and weighing the evidence.",
  },
  {
    id: "raf-malam", turath: 4118, loose: true, group: "usul", ...TAYMIYYAH, unit: "auto", from: 6,
    ar: "رفع الملام عن الأئمة الأعلام", en: "Rafʿ al-Malam ʿan al-Aʾimma al-Aʿlam",
    about: "أعذار الأئمة في ترك العمل ببعض الأحاديث، ووجوب موالاتهم ومعرفة قدرهم.",
    aboutEn: "The excuses of the imams for not acting on some hadith, and the duty to love them and know their worth.",
  },
  {
    id: "ilam", turath: 17798, loose: true, group: "usul", ...QAYYIM, unit: "auto", from: 308,
    ar: "إعلام الموقعين عن رب العالمين", en: "Iʿlam al-Muwaqqiʿin",
    about: "في الفتوى وأصولها: صفات المفتي، والقياس، والحيل، وتغيّر الفتوى بتغيّر الأحوال، وفتاوى النبي ﷺ. بتحقيق مشهور حسن سلمان.",
    aboutEn: "On issuing fatwas and their principles: the qualities of the mufti, analogy, legal stratagems, how fatwas change with circumstances, and the fatwas of the Prophet ﷺ. Edited by Mashhur Hasan Salman.",
  },
  {
    id: "muqaddima-tafsir", turath: 12081, group: "tafsir", ...TAYMIYYAH, unit: "auto",
    ar: "مقدمة في أصول التفسير", en: "Muqaddima fi Usul at-Tafsir",
    about: "قواعد جامعة لفهم القرآن وتفسيره: تفسير الصحابة والتابعين، ونوعا الاختلاف بين السلف في التفسير، وأحسن طرق التفسير.",
    aboutEn: "General rules for understanding and explaining the Quran: the tafsir of the Companions and Successors, the two kinds of difference among the Salaf, and the best ways of tafsir.",
  },
  {
    id: "jawami-sira", turath: 1036, group: "sira", ...HAZM, unit: "auto", from: 22,
    ar: "جوامع السيرة", en: "Jawamiʿ as-Sira",
    about: "مختصر في السيرة النبوية: نسب النبي ﷺ ومولده ومبعثه وهجرته ومغازيه حتى وفاته. بتحقيق إحسان عباس وناصر الدين الأسد.",
    aboutEn: "A concise biography of the Prophet ﷺ: his lineage, birth, mission, emigration and campaigns until his death. Edited by Ihsan ʿAbbas and Nasir ad-Din al-Asad.",
  },
  {
    id: "hajjat-wada", turath: 13109, group: "sira", ...HAZM, unit: "auto",
    ar: "حجة الوداع", en: "Hajjat al-Wadaʿ (The Farewell Pilgrimage)",
    about: "صفة حجة النبي ﷺ يومًا بيوم من الأحاديث، مع الجمع بين ما ظاهره الاختلاف منها.",
    aboutEn: "The Prophet's ﷺ pilgrimage day by day from the hadith, reconciling the reports that seem to differ.",
  },
  {
    id: "zad-maad", turath: 21713, group: "sira", ...QAYYIM, unit: "auto",
    ar: "زاد المعاد في هدي خير العباد", en: "Zad al-Maʿad",
    about: "هدي النبي ﷺ في عبادته ومعاملاته وغزواته وطبه وأقضيته. طبعة مؤسسة الرسالة في خمسة مجلدات.",
    aboutEn: "The guidance of the Prophet ﷺ in worship, dealings, campaigns, medicine and judgements. The Muʾassasat ar-Risala edition in five volumes.",
  },
  {
    id: "akhlaq", turath: 6874, group: "suluk", ...HAZM, unit: "auto",
    ar: "الأخلاق والسير في مداواة النفوس", en: "Al-Akhlaq wa-s-Siyar (In Pursuit of Virtue)",
    about: "خلاصة تجارب ابن حزم في مداواة النفوس وإصلاح الأخلاق، في فصول قصيرة.",
    aboutEn: "Ibn Hazm's lessons from experience on healing the soul and refining character, in short chapters.",
  },
  {
    id: "tawwabin", turath: 11317, group: "suluk", ...QUDAMAH, unit: "auto",
    ar: "كتاب التوابين", en: "Kitab at-Tawwabin (The Penitents)",
    about: "أخبار التائبين من الملائكة والأنبياء والصحابة والصالحين وغيرهم، بأسانيدها.",
    aboutEn: "Accounts of those who repented, from the angels, the prophets, the Companions, the righteous and others, with their chains of narration.",
  },
  {
    id: "wabil", turath: 216, group: "suluk", ...QAYYIM, unit: "auto",
    ar: "الوابل الصيب من الكلم الطيب", en: "Al-Wabil as-Sayyib",
    about: "فضل ذكر الله وفوائده الكثيرة، ثم فصول في أذكار اليوم والليلة والأحوال.",
    aboutEn: "The virtue and many benefits of remembering Allah, then chapters of the adhkar of the day, the night and different occasions.",
  },
  {
    id: "fawaid", turath: 6832, group: "suluk", ...QAYYIM, unit: "auto",
    ar: "الفوائد", en: "Al-Fawaʾid",
    about: "فوائد وخواطر في التفسير والإيمان والسلوك وأحوال القلوب.",
    aboutEn: "Insights and reflections on tafsir, faith, the spiritual path and the states of the heart.",
  },
  {
    id: "da-dawa", turath: 158, group: "suluk", ...QAYYIM, unit: "auto",
    ar: "الداء والدواء (الجواب الكافي)", en: "Ad-Daʾ wa-d-Dawaʾ (The Disease and the Cure)",
    about: "جواب عن سؤال في دواء المعاصي: أضرار الذنوب وعقوباتها، ونفع الدعاء، وأقسام المحبة.",
    aboutEn: "An answer to a question about the cure for sins: the harms and punishments of sins, the benefit of supplication, and the kinds of love.",
  },
  {
    id: "madarij", turath: 8370, group: "suluk", ...QAYYIM, unit: "auto",
    ar: "مدارج السالكين بين منازل إياك نعبد وإياك نستعين", en: "Madarij as-Salikin",
    about: "شرح «منازل السائرين» للهروي: منازل العبودية في السير إلى الله، من اليقظة والتوبة إلى المحبة والتوحيد.",
    aboutEn: "A commentary on al-Harawi's Manazil as-Saʾirin: the stations of servitude on the way to Allah, from awakening and repentance to love and tawhid.",
  },
  {
    id: "hadi-arwah", turath: 11147, group: "suluk", ...QAYYIM, unit: "auto",
    ar: "حادي الأرواح إلى بلاد الأفراح", en: "Hadi al-Arwah",
    about: "صفة الجنة ونعيمها وأهلها، في سبعين بابًا من الآيات والأحاديث والآثار.",
    aboutEn: "Paradise, its delights and its people, in seventy chapters of verses, hadith and reports.",
  },
  {
    id: "majmu-fatawa", turath: 7289, loose: true, group: "fatawa", ...TAYMIYYAH, unit: "auto", from: 3,
    ar: "مجموع الفتاوى", en: "Majmuʿ al-Fatawa",
    about: "فتاوى شيخ الإسلام ورسائله في العقيدة والتفسير والحديث والفقه والسلوك، جمعها عبد الرحمن بن قاسم في خمسة وثلاثين مجلدًا. طبعة مجمع الملك فهد.",
    aboutEn: "Shaykh al-Islam's fatwas and treatises on creed, tafsir, hadith, fiqh and the spiritual path, gathered by ʿAbd ar-Rahman ibn Qasim in thirty-five volumes. The King Fahd Complex edition.",
  },
];

const ch = (...cps) => String.fromCodePoint(...cps);
const DIGITS = "٠١٢٣٤٥٦٧٨٩";
const arNum = s => Number(String(s).replace(/[٠-٩]/g, d => DIGITS.indexOf(d)));
const OPEN = ch(0x27E6), CLOSE = ch(0x27E7);
const REF = n => OPEN + n + CLOSE; // ⟦n⟧: footnote n of the same reading page
const SPAN = /<span data-type=["']title["'][^>]*?\bid=["']?toc-(\d+)["']?[^>]*>([\s\S]*?)<\/span>/g;
const CHUNK = 250000; // bytes of text in one part file of a book
const hashOf = s => crypto.createHash("sha256").update(s).digest("hex").slice(0, 10);

async function getText(name, url) {
  const file = path.join(CACHE, name);
  if (!fs.existsSync(file)) {
    let last;
    for (let i = 0; i < 5; i++) {
      try {
        const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        const t = await r.text(); JSON.parse(t);
        fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(file, t); last = null; break;
      } catch (e) { last = e; await new Promise(r => setTimeout(r, 3000 * (i + 1))); }
    }
    if (last) throw last;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Letters only, without diacritics or letter-form differences: for finding a heading's line and comparing headings.
const norm = s => String(s).normalize("NFD").replace(/\p{M}/gu, "").replace(/ـ/g, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/@@[^@]+@@/g, " ").replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
const words = s => norm(s).split(" ").filter(Boolean);
// The same heading in other words: one has every word of the other, with at most two more.
const sameHeading = (a, b) => {
  const x = words(a), y = words(b); if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return long.length - short.length <= 2 && short.every(w => long.includes(w));
};

// ---------- reading pages of a big book ----------
const PAGE = 40000; // characters of text on one reading page (about fifteen printed pages)
const textSize = s => s.body.reduce((a, x) => a + (x.p ?? x.h ?? "").length, 0);

// "auto": every heading made a page of its own; join each heading with everything under it while that fits one
// reading page (the headings under it are shown inside the page), and keep the larger parts of the outline apart.
function regroup(fine, tocIn) {
  const out = [], where = new Map(); // fine page -> [reading page, anchor of its heading there]
  const end = i => { let j = i + 1; while (j < fine.length && fine[j].l > fine[i].l) j++; return j; };
  const size = (i, j) => { let n = 0; for (let k = i; k < j; k++) n += textSize(fine[k]); return n; };
  const page = (i, j) => {
    const head = fine[i]; const p = { ...head, body: [...head.body] }; where.set(i, [out.length]);
    for (let k = i + 1; k < j; k++) {
      const f = fine[k]; const a = "h" + f.n; where.set(k, [out.length, a]);
      // A heading that is the opening words of a paragraph marks that paragraph; any other is shown as a heading.
      if (f.il && f.body[0]?.p != null) p.body.push({ ...f.body[0], a }, ...f.body.slice(1));
      else p.body.push({ h: f.th || f.t, l: Math.max(1, f.l - head.l), a }, ...f.body);
    }
    out.push(p);
  };
  const walk = (i, j) => {
    for (let k = i; k < j;) { const e = end(k); if (e === k + 1 || size(k, e) <= PAGE) page(k, e); else { page(k, k + 1); walk(k + 1, e); } k = e; }
  };
  walk(0, fine.length);
  const toc = tocIn.map(e => { const w = e && where.get(e.s); return w ? { t: e.t, l: e.l, s: w[0], ...(w[1] ? { a: w[1] } : e.a ? { a: e.a } : {}) } : e; });
  return { sections: out, toc };
}

// A reading page much longer than PAGE with no heading inside to split at is cut into parts of about PAGE characters,
// between paragraphs; each part is a reading page of its own, marked pt [part, of].
function splitLong(sections, tocIn) {
  const out = [], map = [];
  sections.forEach((s, i) => {
    const size = textSize(s);
    if (size <= PAGE * 1.5) { map[i] = { at: out.length }; out.push(s); return; }
    const n = Math.ceil(size / PAGE), goal = size / n; const parts = [[]]; let acc = 0;
    for (const x of s.body) {
      if (acc >= goal && parts.length < n) {
        const prev = parts.at(-1); const moved = prev.at(-1)?.h != null ? [prev.pop()] : []; // a heading goes with its text
        parts.push(moved); acc = 0;
      }
      parts.at(-1).push(x); acc += (x.p ?? x.h ?? "").length;
    }
    const anchors = new Map();
    parts.forEach((body, k) => {
      for (const x of body) if (x.a) anchors.set(x.a, out.length);
      const part = { ...s, body, pt: [k + 1, parts.length] }; if (k) { delete part.th; delete part.il; delete part._at; }
      out.push(part);
    });
    map[i] = { at: out.length - parts.length, anchors };
  });
  const toc = tocIn.map(e => { if (!e || !map[e.s]) return e; const m = map[e.s]; return { ...e, s: e.a && m.anchors?.has(e.a) ? m.anchors.get(e.a) : m.at }; });
  return { sections: out, toc };
}

// ---------- one book ----------
function build(cfg, info, whole, problems, infos) {
  // A problem fails the build, unless it was checked by hand and listed in the book's "known"; infos are only printed.
  const say = (pg, msg) => ((cfg.known || []).includes(`p${pg}: ${msg}`) ? infos : problems).push(`${cfg.id} p${pg}: ${msg}`);
  const tell = (pg, msg) => infos.push(`${cfg.id} p${pg}: ${msg}`);
  let headings = info.indexes.headings;
  const first = cfg.from || 1, last = cfg.to || whole.pages.length;
  // Pages outside the book's own text: before from, after to, the skip ranges (an index printed between two volumes),
  // and Shamela's catalogue card of the book (its first lines: الكتاب / المؤلف / الناشر …).
  const card = new Set(whole.pages.map((p, i) => { const top = p.text.split("\n").slice(0, 10).join("\n"); return /^المؤلف:/m.test(top) && /^(الناشر|الطبعة|المحقق|عدد الأجزاء|عدد الصفحات):/m.test(top) ? i + 1 : 0; }).filter(Boolean));
  const outside = i => i < first || i > last || card.has(i) || (cfg.skip || []).some(([a, b]) => i >= a && i <= b);
  const ENTITY = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", "#39": "'", nbsp: " " };
  // A heading mark may run over a line break: keep it on one line. A mark nested in another is the same place listed
  // twice or three times (al-Risala's «[الرعاف:]», al-Muqniʿ's «فصل»): only the outermost one is kept, with all the
  // words. Pages after the book's text are left out.
  const twice = new Set();
  const NESTED = /(<span data-type=["']title["'][^>]*>)([^<]*)<span data-type=["']title["'][^>]*?\bid=["']?toc-(\d+)["']?[^>]*>([^<]*)<\/span>([^<]*)<\/span>/;
  const pages = whole.pages.slice(0, last).map((p, i) => {
    let text = p.text;
    // marks "text": stray marks around one or two letters inside a heading (the encyclopedia's «ا<span…>ل</span>قاضي»)
    // are dropped; a mark that opens inside a word takes the whole word.
    if (cfg.marks === "text") text = text.replace(/<span data-type=["']title["'][^>]*>([^<]{0,4})<\/span>/g, (m, inner) => norm(inner).length <= 2 ? inner : m)
      .replace(/(^|\n)([^\s<>]+)(<span data-type=["']title["'][^>]*>)/g, (m, a, w, span) => a + span + w);
    while (NESTED.test(text)) text = text.replace(NESTED, (m, outer, before, n, inner, after) => { twice.add(Number(n)); return outer + before + inner + after + "</span>"; });
    text = text.replace(/<span data-type=["']title["'][^>]*>[\s\S]*?<\/span>/g, m => m.replace(/\s*\n\s*/g, " "))
      .replace(/&(quot|amp|lt|gt|apos|#39|nbsp);/g, (m, k) => ENTITY[k]);
    // Footnotes start under a rule of underscores, or (Majmuʿ al-Fatawa) under an <hr> line.
    let at = text.search(/^_{5,}\s*$/m); if (at < 0) at = text.search(/^<hr>\s*$/m);
    return { idx: i + 1, page: p.page, vol: p.vol, body: at < 0 ? text : text.slice(0, at), foot: at < 0 ? "" : text.slice(at).replace(/^(_+|<hr>)[^\n]*\n?/, "") };
  });

  // marks "text": the index of headings turath.io gives does not follow the marks in the text (the encyclopedia moved
  // the jurists' biographies to its end, the index did not), so the headings are read from the marks themselves:
  // toc-N with its level (data-level) and page. A number no mark carries is a gap that nothing points to.
  if (cfg.marks === "text") {
    const found = []; let level = 1;
    for (const p of pages) for (const m of (p.body + "\n" + p.foot).matchAll(/<span data-type=["']title["']([^>]*?)\bid=["']?toc-(\d+)["']?([^>]*)>([\s\S]*?)<\/span>/g)) {
      const n = Number(m[2]); if (found[n - 1]) continue;
      level = Number((/data-level=["']?(\d+)/.exec(m[1] + m[3]) || [])[1]) || level;
      found[n - 1] = { title: m[4].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(), level, page: p.idx };
    }
    headings = Array.from({ length: Math.max(found.length, headings.length) }, (_, k) => found[k] || { title: `toc-${k + 1}`, level: 1, page: 0, gap: true });
    tell(0, `${found.filter(Boolean).length} headings read from the marks in the text (the index lists ${info.indexes.headings.length})`);
  }

  // ---------- headings the edition did not mark in the text: find their line on their page ----------
  const marked = new Set(pages.flatMap(p => [...(p.body + p.foot).matchAll(/\bid=["']?toc-(\d+)/g)].map(m => Number(m[1]))));
  headings.forEach((hd, k) => {
    const n = k + 1; if (marked.has(n) || twice.has(n)) return;
    const p = pages[hd.page - 1];
    if (!p || outside(p.idx)) return; // not in the book's own text (a publisher's preface)
    const lines = p.body.split("\n");
    // Between the headings before and after it on the page (headings are numbered in reading order).
    const ids = lines.map(l => { const m = /\bid=["']?toc-(\d+)/.exec(l); return m ? Number(m[1]) : 0; });
    let lo = 0, hi = lines.length;
    ids.forEach((id, i) => { if (id && id < n) lo = i + 1; if (id > n && hi === lines.length) hi = i; });
    const free = i => i >= lo && i < hi && !/<span/.test(lines[i]) && lines[i].trim();
    // The line that says the heading: the same words, or else the line that opens with most of them.
    const want = words(hd.title);
    const score = l => { const w = words(l).slice(0, want.length + 3); return want.filter(x => w.includes(x)).length / want.length; };
    let at = lines.findIndex((l, i) => free(i) && sameHeading(l, hd.title));
    if (at < 0) { let best = 0.6; lines.forEach((l, i) => { const s = free(i) ? score(l) : 0; if (s >= best && (at < 0 || s > best)) { best = s; at = i; } }); }
    if (at >= 0) {
      // A short line that starts like the heading is the heading as printed; in a paragraph the heading marks where it starts.
      const line = lines[at].trim();
      lines[at] = line.length <= 160 && words(line)[0] === want[0] ? `<span data-type="title" id=toc-${n}>${line}</span>` : `<span data-type="title" id=toc-${n}></span>${line}`;
    } else {
      // A heading turath.io gives to a part of the text without a line of its own: it goes right after the heading
      // before it on the page, or at the top of the page.
      lines.splice(lo, 0, `<span data-type="title" id=toc-${n}>${hd.title}</span>`);
      tell(p.idx, `heading «${hd.title}» has no line of its own: shown where the text after the heading before it starts`);
    }
    p.body = lines.join("\n");
  });

  // Footnote numbers in the edition: "(١) …" under the line, "(^١) …" (the mark in the text is the same), or a bare
  // "١ …" (then the mark in the text is a bare digit).
  const footLines = pages.flatMap(p => p.foot.split("\n").map(l => l.trim()));
  const count = re => footLines.filter(l => re.test(l)).length;
  const style = [["paren", count(/^\([٠-٩]+\)/)], ["caret", count(/^\(\^[٠-٩]+\)/)], ["bare", count(/^[٠-٩]+(?![٠-٩/])/)]].sort((a, b) => b[1] - a[1])[0][0];
  // A bare number followed by a dash («١- …») is an item of a list inside a long note, not a new note.
  const NOTE = { caret: /^\(\^([٠-٩]+)\)\s*/, paren: /^\(([٠-٩]+|\*)\)\s*/, bare: /^([٠-٩]+|\*)(?![٠-٩/\-–])\s*\.?\s*/ }[style];
  const MARK = { caret: /\(\^([٠-٩]+)\)/g, paren: /\((\*|[٠-٩]+)\)/g, bare: /(?<![٠-٩(/])(\*|[٠-٩]+)(?![٠-٩)/])/g }[style];
  // Shamela's preparer marks his own notes with this line (Majmuʿ al-Fatawa): it opens each note below it.
  const PREPARER = /^\[تعليق مُعِدّ الكتاب للشاملة\]$/;

  // ---------- footnotes of every page ----------
  const notes = new Map(); // "page:n" -> text
  const noteHeads = new Map(); // "page:n" -> headings marked inside that footnote
  let lastNote = null;
  for (const p of pages) {
    p.marks = [];
    if (outside(p.idx) || !p.foot.trim()) continue;
    // Numbers that have a mark in this page's text: a numbered line with no mark goes on the note before
    // (a numbered list inside a long note).
    const inText = new Set([...p.body.matchAll(MARK)].map(m => m[1] === "*" ? "*" : arNum(m[1])));
    let mine = null, expect = 1, label = "", cont = false;
    p.foot.split("\n").forEach(raw => {
      let line = raw.trim(); if (!line) return;
      if (PREPARER.test(line)) { label = line + "\n"; return; }
      // "=" opens the part of a long footnote that runs over from the page before.
      // The note before may end with "==" where it breaks off mid-sentence.
      if (!mine && /^=/.test(line)) { line = line.replace(/^=+\s*/, ""); cont = true; if (lastNote) notes.set(lastNote, notes.get(lastNote).replace(/\s*=+$/, "") + " " + line); else say(p.idx, "continued footnote with nothing before it"); return; }
      const m = NOTE.exec(line);
      const n = m && (m[1] === "*" ? "*" : arNum(m[1]));
      const goesOn = (mine || cont) && !inText.has(n);
      if (m && !goesOn && (n === "*" || !mine || n === expect)) {
        if (n !== "*") expect = n + 1;
        mine = `${p.idx}:${n}`; notes.set(mine, label + line.slice(m[0].length)); p.marks.push(n); lastNote = mine;
      } else if (!mine && label && !m) {
        // A note of the preparer without a number: it is about this page as a whole.
        mine = `${p.idx}:page`; notes.set(mine, label + line); p.marks.push("page"); lastNote = mine;
      } else if (mine) notes.set(mine, notes.get(mine) + "\n" + line);
      else if (cont && lastNote) notes.set(lastNote, notes.get(lastNote) + "\n" + line);
      else if (lastNote) { notes.set(lastNote, notes.get(lastNote) + "\n" + line); tell(p.idx, `footnote line without a number, joined to the one before: ${line.slice(0, 50)}`); }
      else say(p.idx, `footnote line without a number: ${line.slice(0, 60)}`);
    });
  }
  // Headings inside a footnote become plain text (the contents still lists them); a rule line under a note's own
  // sub-note is dropped.
  for (const [k, text] of notes) notes.set(k, text.replace(SPAN, (m, n, inner) => { noteHeads.set(k, [...(noteHeads.get(k) || []), Number(n)]); return inner; }).replace(/^_{5,}\s*$/gm, "").replace(/\n{2,}/g, "\n").trim());

  // ---------- the text as a stream of headings and paragraphs ----------
  const stream = [];
  for (const p of pages) {
    if (outside(p.idx)) continue;
    // Footnote marks in this page's text, matched in order to the page's own footnotes.
    const want = [...p.marks], lost = []; // lost: notes passed over, in a loose book
    const mark = s => s.replace(MARK, (m, d) => {
      const n = d === "*" ? "*" : arNum(d);
      // In order; a footnote whose mark is missing from the text is passed over (and reported).
      const k = want.indexOf(n); if (k < 0) return m;
      if (k > 0) { if (cfg.loose) lost.push(...want.slice(0, k)); else say(p.idx, `footnote(s) ${want.slice(0, k).join(",")} have no mark in the text`); }
      want.splice(0, k + 1); return `@@${p.idx}:${n}@@`;
    });
    const lines = p.body.split("\n").map(x => x.trim()).filter(Boolean);
    lines.forEach((line, i) => {
      const pageEnd = i === lines.length - 1;
      if (/^(\.{3}|…)$/.test(line) || /^المجلد [^\s]+$/.test(line)) return;
      if (/^(\*\s*){3,}$/.test(line)) { stream.push({ sep: true, pg: p }); return; }
      const spans = [...line.matchAll(SPAN)];
      const rest = line.replace(SPAN, "").trim();
      if (spans.length && spans.every(s => s[2].trim()) && !/[^\s\[\]():.،-]/.test(rest.replace(/\(([٠-٩]+|\*)\)/g, ""))) {
        // A heading on its own line, as printed; its footnote marks stay with it.
        const shown = mark(spans.map(s => s[2]).join(" ") + " " + rest).replace(/\s+/g, " ").trim();
        spans.forEach((s, k) => stream.push({ h: Number(s[1]), shown: k === spans.length - 1 ? shown : null, pg: p }));
        return;
      }
      for (const s of spans) stream.push({ h: Number(s[1]), inline: true, pg: p });
      stream.push({ p: mark(line.replace(SPAN, "$2").replace(/\s+/g, " ")), pg: p, pageEnd });
    });
    // A note about the page as a whole is marked after the page's last paragraph.
    if (want.includes("page")) {
      const lastPara = stream.findLast(x => x.pg === p && x.p != null);
      if (lastPara) { lastPara.p += ` @@${p.idx}:page@@`; want.splice(want.indexOf("page"), 1); }
    }
    // loose: a big edition where a few notes have lost their mark (a note on the page after its hadith): each is
    // marked after the page's last paragraph, so it is still read next to its text.
    if (cfg.loose && (want.length || lost.length)) { want.unshift(...lost);
      const lastPara = stream.findLast(x => x.pg === p && x.p != null);
      if (lastPara) { for (const n of want) lastPara.p += ` @@${p.idx}:${n}@@`; tell(p.idx, `footnote(s) ${want.join(",")} have no mark in the text: shown after the page's last paragraph`); want.length = 0; }
    }
    if (want.length) say(p.idx, `footnote(s) ${want.join(",")} have no mark in the text`);
  }

  // ---------- one heading printed twice (the heading, then the book's own heading line) ----------
  const tidy = [];
  for (const x of stream) {
    if (x.p != null) {
      const run = []; for (let k = tidy.length - 1; k >= 0 && tidy[k].h != null && !tidy[k].inline && tidy[k].pg === x.pg; k--) run.push(tidy[k]);
      // Only the nearest heading: a book's line under «كتاب …» then «مدخل» stays the first line of «مدخل».
      if (run[0] && sameHeading(run[0].shown ?? headings[run[0].h - 1]?.title ?? "", x.p)) { run[0].shown = x.p; continue; }
    }
    tidy.push(x);
  }

  // ---------- paragraphs that run over a page break ----------
  const occurs = (s, c) => s.split(c).length - 1;
  const ENDS = /[.:؟!»"\])}﴾،؛]\s*(@@[^@]+@@\s*)*$/;
  const NEW = /^([٠-٩]+\s*[-–.)]|\(?[٠-٩]+\)|[أ-ي]\s*[-–)]\s|"?فصل"?|\*|\[)/;
  const merged = [];
  for (const x of tidy) {
    const prev = merged.at(-1);
    if (x.p != null && prev?.p != null && prev.pageEnd && prev.pg !== x.pg) {
      const open = occurs(prev.p, "﴿") > occurs(prev.p, "﴾") || occurs(prev.p, "«") > occurs(prev.p, "»") || occurs(prev.p, "[") > occurs(prev.p, "]") || occurs(prev.p, "(") > occurs(prev.p, ")");
      if (open || (!ENDS.test(prev.p) && !NEW.test(x.p))) { prev.p += " " + x.p; prev.pageEnd = x.pageEnd; prev.pg = x.pg; prev.last = x.pg; continue; }
    }
    merged.push({ ...x });
  }

  // ---------- reading pages ----------
  // unit 0: a short book is one reading page, and its contents jump to the place in it.
  const auto = cfg.unit === "auto";
  const unit = auto ? Infinity : cfg.unit ?? 1;
  const clean = s => s.replace(/\s+/g, " ").replace(/^\[(.*)\]\s*:?$/, "$1").replace(/\s*:$/, "").trim();
  let sections = [], toc = []; // toc[k]: where heading k+1 is shown (s: -1 while it is before the first reading page)
  let lead = null; // the contents entry of an opening page that has no heading
  let cur = null;
  const front = { body: [] };
  const open = (t, lvl, n, pg) => { cur = { t, l: lvl, n, _at: pg, body: [] }; sections.push(cur); return cur; };
  const box = () => cur || front;
  // Every paragraph remembers the printed page it starts and ends on (_at, _to), for the page numbers of each reading page.
  const para = (x, extra) => box().body.push({ p: x.p, ...extra, _at: x.pg, _to: x.last || x.pg });
  const lead6 = s => { const w = s.replace(/@@[^@]+@@/g, "").replace(/\s+/g, " ").trim().split(" "); return w.slice(0, 8).join(" ") + (w.length > 8 ? "…" : ""); };

  if (cfg.items) {
    // No chapters, only numbered paragraphs («١ - …»): the contents lists each of them. The edition's few
    // headings are lines of the text itself, so they stay in it as paragraphs.
    let n = 0;
    for (const x of merged) {
      if (x.sep) { box().body.push({ sep: 1 }); continue; }
      if (x.h != null) { if (x.shown) para({ p: x.shown, pg: x.pg }); continue; }
      const m = /^([٠-٩]+)\s*-/.exec(x.p);
      if (m && arNum(m[1]) === n + 1) { n++; toc.push({ t: lead6(x.p), l: 1, s: -1, a: "n" + n }); para(x, { a: "n" + n }); }
      else para(x);
    }
  } else {
    let anchor = null;
    for (const x of merged) {
      if (x.h != null) {
        const hd = headings[x.h - 1]; if (!hd) { say(x.pg.idx, `heading toc-${x.h} is not in the index`); continue; }
        const t = clean(hd.title);
        if (hd.level <= unit) {
          open(t, hd.level, x.h, x.pg); // the page starts where its heading is printed
          // The heading is the opening words of a paragraph: the page shows no separate title.
          if (x.inline) cur.il = 1;
          else if (x.shown && clean(x.shown) !== t) cur.th = clean(x.shown);
          toc[x.h - 1] = { t, l: hd.level, s: sections.length - 1 };
        } else {
          const a = "h" + x.h;
          toc[x.h - 1] = { t, l: hd.level, s: sections.length - 1, a };
          if (x.inline) anchor = a;
          else box().body.push({ h: clean(x.shown || t), l: Math.max(1, hd.level - unit), a });
        }
        continue;
      }
      if (x.sep) { box().body.push({ sep: 1 }); continue; }
      para(x, anchor != null ? { a: anchor } : {}); anchor = null;
    }
  }
  // Text before the first heading: a basmala opens the first reading page; a longer opening (the book's
  // title and chain of narration, or the whole of a one-page book) is a reading page of its own under the book's title.
  if (front.body.length) {
    if (sections.length && JSON.stringify(front.body.map(x => x.p ?? x.h ?? "")).length < 300) {
      sections[0].body = [...front.body, ...sections[0].body];
      toc.forEach(e => { if (e) e.s = Math.max(0, e.s); });
    } else {
      sections.unshift({ t: cfg.ar, l: Math.min(1, ...sections.map(s => s.l)), ...front }); toc.forEach(e => { if (e) e.s++; });
      if (!toc.some(e => e && e.s === 0 && !e.a) && front.body[0]?.a == null) lead = { t: cfg.ar, l: 1, s: 0 };
    }
  }
  if (!sections.length) problems.push(`${cfg.id}: no reading pages`);
  if (auto) ({ sections, toc } = regroup(sections, toc));
  ({ sections, toc } = splitLong(sections, toc));

  // ---------- footnotes: numbered from 1 on each reading page, in reading order ----------
  sections.forEach((s, si) => {
    const order = [];
    for (const m of JSON.stringify([s.th || "", s.body.map(x => x.p ?? x.h ?? "")]).matchAll(/@@([^@]+)@@/g)) if (!order.includes(m[1])) order.push(m[1]);
    const fix = str => str.replace(/@@([^@]+)@@/g, (m, k) => REF(order.indexOf(k) + 1));
    s.body = s.body.map(x => x.p != null ? { ...x, p: fix(x.p) } : x.h != null ? { ...x, h: fix(x.h) } : x);
    if (s.th) s.th = fix(s.th);
    s.notes = order.map((k, i) => {
      const t = notes.get(k); if (t == null) problems.push(`${cfg.id}: missing footnote ${k}`);
      // A heading inside a footnote (an explanation the author put in the notes): the contents opens the note.
      if (!cfg.items) for (const n of noteHeads.get(k) || []) toc[n - 1] = { t: clean(headings[n - 1].title), l: headings[n - 1].level, s: si, fn: i + 1 };
      return t || "";
    });
  });
  const missing = headings.map((h, k) => k).filter(k => !toc[k] && !twice.has(k + 1) && !headings[k].gap && !outside(headings[k].page));
  if (!cfg.items && missing.length) problems.push(`${cfg.id}: headings not placed: ${missing.map(k => `${headings[k].title} (toc-${k + 1}, page ${headings[k].page})`).join(" | ")}`);

  // A reading page with no text of its own is a group title in the contents (for example «كتاب الطهارة» before its chapters),
  // unless its heading has a footnote (I'lam al-Muwaqqiʿin): then it is a short page with the heading and its note.
  // Printed pages: pg [from, to]; in a book of several volumes also v [from, to].
  const multi = new Set(pages.slice(first - 1).map(p => p.vol)).size > 1;
  const out = sections.map(s => {
    const o = { t: s.t, l: s.l };
    if (s.th) o.th = s.th;
    if (s.il) o.il = 1;
    if (s.pt) o.pt = s.pt;
    if (s.body.length || s.notes.length) {
      if (!s.body.length && s._at?.page != null) { o.pg = [s._at.page, s._at.page]; if (multi) o.v = [s._at.vol, s._at.vol]; }
      const at = s.body.filter(x => x._at && x._at.page != null);
      if (at.length) { const a = s._at?.page != null ? s._at : at[0]._at; o.pg = [a.page, at.at(-1)._to.page]; if (multi) o.v = [a.vol, at.at(-1)._to.vol]; }
      o.body = s.body.map(({ _at, _to, ...x }) => x);
      if (s.notes.length) o.notes = s.notes;
    }
    return o;
  });
  // The later parts of a reading page cut by splitLong have contents entries of their own, after the entry before them.
  const list = [lead, ...toc].filter(Boolean);
  out.forEach((s, i) => {
    if (!s.pt || s.pt[0] === 1) return;
    const at = list.findIndex(e => e.s > i);
    list.splice(at < 0 ? list.length : at, 0, { t: s.t, l: s.l, s: i, pt: s.pt });
  });
  return { sections: out, toc: list };
}

(async () => {
  const problems = [], infos = [];
  const index = { built: new Date().toISOString().slice(0, 10), source: { name: "turath.io", url: "https://app.turath.io" }, groups: GROUPS, authors: AUTHORS, books: [] };
  for (const b of BOOKS) if (!GROUPS.includes(b.group) || !AUTHORS[b.author]) problems.push(`${b.id}: unknown group or author`);
  fs.mkdirSync(OUT, { recursive: true });
  const keep = new Set(["index.json"]);
  for (const cfg of BOOKS) {
    if (ONLY && !ONLY.includes(cfg.id)) continue;
    const info = await getText(`${cfg.turath}.info.json`, `${API}/book?id=${cfg.turath}&include=indexes&ver=3`);
    const whole = await getText(`${cfg.turath}.json`, `${FILES}/books-v3/${cfg.turath}.json`);
    if (whole.pages.length !== info.indexes.page_map.length) problems.push(`${cfg.id}: ${whole.pages.length} pages in the book file, ${info.indexes.page_map.length} in its index`);
    const book = build(cfg, info, whole, problems, infos);

    // ---------- checks ----------
    const all = JSON.stringify(book);
    if (/<[a-z/]/i.test(all)) problems.push(`${cfg.id}: HTML left in the text`);
    if (/@@/.test(all)) problems.push(`${cfg.id}: unresolved footnote mark`);
    for (const s of book.sections) {
      const refs = new Set([...JSON.stringify([s.th || "", s.body || []]).matchAll(new RegExp(OPEN + "(\\d+)" + CLOSE, "g"))].map(m => Number(m[1])));
      (s.notes || []).forEach((x, i) => { if (!refs.has(i + 1)) problems.push(`${cfg.id}: note ${i + 1} of «${s.t}» is not referred to`); if (!x) problems.push(`${cfg.id}: empty note ${i + 1} of «${s.t}»`); });
      for (const n of refs) if (!s.notes?.[n - 1]) problems.push(`${cfg.id}: mark ${n} in «${s.t}» has no note`);
    }
    if (!book.sections.some(s => s.body)) problems.push(`${cfg.id}: no text`);

    // The text of the reading pages goes in part files of about CHUNK bytes; the book file keeps the contents and
    // each reading page's title, pages and part (c).
    const parts = [[]]; let size = 0, total = 0;
    const heads = book.sections.map((s, i) => {
      const { body, notes, ...head } = s;
      if (!body) return head;
      const text = notes ? { body, notes } : { body };
      const len = Buffer.byteLength(JSON.stringify(text)); total += len;
      if (size && size + len > CHUNK) { parts.push([]); size = 0; }
      parts.at(-1).push([i, text]); size += len;
      return { ...head, c: parts.length - 1 };
    });
    const chunks = parts.map((list, k) => {
      const data = JSON.stringify(Object.fromEntries(list)); const hash = hashOf(data);
      const file = `${cfg.id}/${k}.${hash}.json`; keep.add(file);
      if (!DRY) { fs.mkdirSync(path.join(OUT, cfg.id), { recursive: true }); fs.writeFileSync(path.join(OUT, file), data + "\n"); }
      return hash;
    });
    const data = JSON.stringify({ id: cfg.id, sections: heads, toc: book.toc });
    const file = `${cfg.id}.${hashOf(data)}.json`; keep.add(file);
    if (!DRY) fs.writeFileSync(path.join(OUT, file), data + "\n");
    const m = info.meta;
    const { turath, unit, from, to, skip, items, known, loose, marks, ...meta } = cfg;
    index.books.push({
      ...meta, file, chunks, bytes: total, title: m.name,
      edition: m.info.split("\n").map(x => x.trim()).filter(x => x && !/^\[/.test(x)).join("\n"),
      turath, url: `https://app.turath.io/book/${turath}`,
      pages: book.sections.filter(s => s.body).length,
    });
    const sizes = book.sections.filter(s => s.body).map(s => JSON.stringify(s.body).length);
    console.log(`${cfg.id}: ${sizes.length} reading pages (largest ${(Math.max(...sizes) / 1024).toFixed(0)} KB) in ${chunks.length} part(s), ${book.toc.length} headings, ${book.sections.reduce((a, s) => a + (s.notes?.length || 0), 0)} footnotes, ${(total / 1024 / 1024).toFixed(1)} MB`);
  }
  // Files of earlier builds that the new index does not list.
  const sweep = dir => {
    for (const f of fs.readdirSync(path.join(OUT, dir))) {
      const rel = dir ? `${dir}/${f}` : f;
      if (fs.statSync(path.join(OUT, rel)).isDirectory()) { sweep(rel); if (!fs.readdirSync(path.join(OUT, rel)).length) fs.rmdirSync(path.join(OUT, rel)); }
      else if (!keep.has(rel)) fs.unlinkSync(path.join(OUT, rel));
    }
  };
  if (!DRY && !ONLY) sweep("");
  if (infos.length) console.log("· " + infos.join("\n· "));
  if (problems.length) { console.error("✗ " + problems.join("\n✗ ")); process.exitCode = 1; }
  if (DRY || ONLY) { console.log(`${DRY ? "dry run" : "partial build"}: ${index.books.length} book(s) checked, www/kutub/index.json not written`); return; }
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1) + "\n");
  console.log(`✓ www/kutub: ${index.books.length} books`);
})().catch(e => { console.error(e); process.exit(1); });
