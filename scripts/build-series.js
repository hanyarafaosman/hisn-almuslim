// Builds the lesson series:
//   www/data/videos.json  — video series (YouTube playlists of the scholars' own channels) and the live Quran and Sunnah channels;
//   www/data/lessons.json — recorded audio series played one lesson after another on the radio page (IslamHouse.com).
// YouTube: the public playlist page (no API key), so each series keeps the playlist's order. A video that cannot be
// played inside another site (its owner turned embedding off, or it is private) is left out, checked with YouTube's oEmbed.
// IslamHouse: its public API (api3.islamhouse.com); the MP3 files are the ones the scholar's foundation published there.
// Usage: node scripts/build-series.js   (answers are kept in .cache/series; delete it to fetch everything again)
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "series");
const IH = "https://api3.islamhouse.com/v3/paV29H2gm56kvLPy"; // the public key from the IslamHouse API documentation

// Channels the video series come from (the playlist's owner must be this channel).
const CHANNELS = {
  zad: { yt: "UCBoe29aQT-zMECFyyyO7H4Q", ar: "أكاديمية زاد", en: "Zad Academy" },
  uthaymeen: { yt: "UCFjzJYgxHjk44AFoEwwgPjg", ar: "قناة الشيخ محمد بن صالح العثيمين", en: "Shaykh Muhammad ibn Salih al-ʿUthaymin channel" },
  fawzan: { yt: "UCi7vzSJrU3beV_6Sdgpowng", ar: "قناة الشيخ صالح الفوزان", en: "Shaykh Salih al-Fawzan channel" },
  binbaz: { yt: "UCYZkmbBbVMWxB1gyioTPLIA", ar: "مؤسسة عبد العزيز بن باز الخيرية", en: "ʿAbd al-ʿAziz ibn Baz Charitable Foundation" },
  badr: { yt: "UCqkx1-ja55sqH0xQeSB7kzA", ar: "برامج الشيخ عبد الرزاق البدر", en: "Shaykh ʿAbd ar-Razzaq al-Badr programmes" },
  ruhaili: { yt: "UCBc5AoNVZ4dIz-WFJogM-Ww", ar: "قناة الشيخ إبراهيم الرحيلي", en: "Shaykh Ibrahim ar-Ruhayli channel" },
  khamees: { yt: "UCWjCSGhmSGu0VLf2mPFS0Kg", ar: "قناة الشيخ عثمان الخميس", en: "Shaykh ʿUthman al-Khamis channel" },
  raslan: { yt: "UCbvwLzU45wgAHOqXRQoC11A", ar: "موقع فضيلة الشيخ محمد بن سعيد رسلان", en: "Shaykh Muhammad Saʿid Raslan’s website" },
  // The lessons given in the Two Holy Mosques, broadcast live by the mosques' religious affairs and kept in playlists.
  // dated: their playlists run newest first; the first and last episode's publish dates tell, and the list is turned round.
  haram: { yt: "UC3QAoXf9GN9xeQYhk-AZbTg", ar: "دروس المسجد الحرام", en: "Lessons at the Sacred Mosque", dated: true },
  nabawi: { yt: "UC0XNCc-DU8J5_ksR-eufPaw", ar: "دروس المسجد النبوي", en: "Lessons at the Prophet’s Mosque", dated: true },
};
// Zad Academy teaches each subject in four levels; these are its second course (الدورة 2), complete in every subject.
const LEVELS = [["المستوى الأول", "Level 1"], ["المستوى الثاني", "Level 2"], ["المستوى الثالث", "Level 3"], ["المستوى الرابع", "Level 4"]];
const zad = lists => lists.map((list, i) => ({ ar: LEVELS[i][0], en: LEVELS[i][1], list }));

// group: quran, sunnah, seerah, aqeedah, fiqh, misc (the same groups as the radio page).
// strip: words every episode title of the playlist repeats (titles are checked with Arabic-Indic digits made 0-9).
// only: keep just the videos whose title matches (a playlist that holds a stray video from another series).
const RASLAN = { ch: "raslan", by: "الشيخ محمد بن سعيد رسلان", byEn: "Shaykh Muhammad Saʿid Raslan" };
// Titles of the Two Holy Mosques' lessons: «… لفضيلة الشيخ فلان»; «الدروس العلمية لفضيلة الشيخ فلان - كتاب كذا» (the
// same for every lesson, so each is shown by its number); «محاضرة لفضيلة الشيخ فلان - بعنوان: (…)».
const TEACHER_AFTER = [/\s*(?:لفضيلة|لمعالي|لسماحة)\s+الشيخ.*$/];
const ONLY_NUMBER = [/^.*$/];
const LECTURE_TITLE = [/^.*?بعنوان\s*:\s*/];
const VIDEOS = [
  // ---- the Quran ----
  { id: "zad-tafsir", group: "quran", ch: "zad", ar: "التفسير", en: "Tafsir", by: "أكاديمية زاد", byEn: "Zad Academy",
    parts: zad(["PLH4NxcjPhgklmBrOQ9qVvFVLgJUJ5twrm", "PLH4NxcjPhgkk3w2yfR4hXhwV5VaAkTHHD", "PLH4NxcjPhgkkqFEg5dWrgB8OZnf75hCyf", "PLH4NxcjPhgklzl6rETZd-9Y-5yE0LtX3o"]) },
  { id: "zad-gharib", group: "quran", ch: "zad", ar: "التبيان في تفسير غريب القرآن لابن الهائم", en: "At-Tibyan: the rare words of the Quran (Ibn al-Haʾim)", by: "أكاديمية زاد", byEn: "Zad Academy",
    parts: [{ list: "PLH4NxcjPhgknP8YmUdubHEsuggQFdB9jr" }], strip: [/\s*\.?\s*التبيان في تفسير غريب القرآن/] },
  { id: "zad-haqq-quran", group: "quran", ch: "zad", ar: "حق القرآن على أمة القرآن", en: "What the Quran is owed by its nation", by: "أ. د. عبد الله بن عمر الدميجي", byEn: "Prof. ʿAbdullah ibn ʿUmar ad-Dumayji",
    parts: [{ list: "PLH4NxcjPhgknv0xuQyLQCSCilTgAriQ4R" }] },
  // ---- the Sunnah ----
  { id: "uthaymeen-arbaeen", group: "sunnah", ch: "uthaymeen", ar: "شرح الأربعين النووية", en: "Commentary on an-Nawawi’s Forty Hadith", by: "الشيخ محمد بن صالح العثيمين", byEn: "Shaykh Muhammad ibn Salih al-ʿUthaymin",
    parts: [{ list: "PLXS0usquloW_VC2gPb6nu1FFQTxWc1Ww_" }], strip: [/\s*للشيخ محمد بن عثيمين\s*$/] },
  { id: "zad-riyad", group: "sunnah", ch: "zad", ar: "مختارات من شرح رياض الصالحين", en: "Selections from the commentary on Riyad as-Salihin", by: "الشيخ محمد بن صالح العثيمين", byEn: "Shaykh Muhammad ibn Salih al-ʿUthaymin",
    parts: [{ list: "PLH4NxcjPhgkmJ-4FLzx6-v3J1AXw1cmol" }], strip: [/مختارات من شرح الشيخ ابن عثيمين على رياض الصالحين/] },
  { id: "zad-bulugh", group: "sunnah", ch: "zad", ar: "مختارات من شرح بلوغ المرام", en: "Selections from the commentary on Bulugh al-Maram", by: "الشيخ محمد بن صالح العثيمين", byEn: "Shaykh Muhammad ibn Salih al-ʿUthaymin",
    parts: [{ list: "PLH4NxcjPhgklrlRr8SsKMFNF37dHIPkUg" }], strip: [/\s*مختارات من شرح كتاب بلوغ المرام.*$/] },
  { id: "zad-hadith", group: "sunnah", ch: "zad", ar: "الحديث", en: "Hadith", by: "أكاديمية زاد", byEn: "Zad Academy",
    parts: zad(["PLH4NxcjPhgkmryBdAWrz3oa26PMga7iGr", "PLH4NxcjPhgkkr6RzYGrV32sh46VDUQFUW", "PLH4NxcjPhgkk4dRxuG9T-wMQHFE3AjDlm", "PLH4NxcjPhgkmaKEWoLAHOXsyI5f55nEcI"]) },
  // ---- the Seerah ----
  { id: "zad-seerah", group: "seerah", ch: "zad", ar: "السيرة النبوية", en: "The Prophet’s biography", by: "أكاديمية زاد", byEn: "Zad Academy",
    parts: zad(["PLH4NxcjPhgknBOPJrtditZKYpT1nb-RKD", "PLH4NxcjPhgkn-k4sH2pEVr-ZoyJTrGDY_", "PLH4NxcjPhgkm56a8OfCCdoNJDRGRfSjbr", "PLH4NxcjPhgkl-N779ZIaXKTx7326lwJ1K"]) },
  { id: "ruhaili-mukhtasar", group: "seerah", ch: "ruhaili", ar: "شرح مختصر سيرة النبي ﷺ وسيرة أصحابه العشرة", en: "The short biography of the Prophet ﷺ and his ten Companions", by: "الشيخ أ. د. إبراهيم الرحيلي", byEn: "Shaykh Prof. Ibrahim ar-Ruhayli",
    parts: [{ list: "PL5daV2LOnBCEzey8Zep7Qvjevrmf0360g" }] },
  { id: "badr-fusool", group: "seerah", ch: "badr", ar: "شرح الفصول في سيرة الرسول ﷺ لابن كثير", en: "Al-Fusul fi Sirat ar-Rasul ﷺ (Ibn Kathir)", by: "الشيخ عبد الرزاق البدر", byEn: "Shaykh ʿAbd ar-Razzaq al-Badr",
    parts: [{ list: "PLClZ7RmnwNVNnoyVRYfyX0OIfUUwTnZg8" }], strip: [/^شرح كتاب الفصول في سيرة الرسول\s*\d*/] },
  { id: "khamees-seerah", group: "seerah", ch: "khamees", ar: "سيرة النبي محمد ﷺ", en: "The life of the Prophet Muhammad ﷺ", by: "الشيخ عثمان الخميس", byEn: "Shaykh ʿUthman al-Khamis",
    parts: [{ list: "PLx3Fh1kiMbrfePumOQTRgOIuCILlsiFna" }] },
  { id: "binbaz-zad-maad", group: "seerah", ch: "binbaz", ar: "إضاءات من زاد المعاد", en: "Lessons from Zad al-Maʿad", by: "الشيخ عبد العزيز بن باز", byEn: "Shaykh ʿAbd al-ʿAziz ibn Baz",
    parts: [{ list: "PLyXEKGc2wE9fYkl-foJMB4OvjZ0n8Q5qU" }], strip: [/الحلقة (?:رقم \(\s*\d+\s*\)|الأولى)|إضاءات من زاد المعاد للإمام ابن باز رحمه الله/g] },
  { id: "khamees-anbiya", group: "seerah", ch: "khamees", ar: "قصص الأنبياء", en: "Stories of the Prophets", by: "الشيخ عثمان الخميس", byEn: "Shaykh ʿUthman al-Khamis",
    parts: [{ list: "PLx3Fh1kiMbreJVTTd4FG8PafqUo9pltO1" }] },
  // ---- the creed ----
  { id: "binbaz-usool", group: "aqeedah", ch: "binbaz", ar: "شرح الأصول الثلاثة", en: "The Three Fundamental Principles", by: "الشيخ عبد العزيز بن باز", byEn: "Shaykh ʿAbd al-ʿAziz ibn Baz",
    parts: [{ list: "PLyXEKGc2wE9c5V56OaObBqdbhTYuYwGZI" }], strip: [/^.*$/] }, // every title only says «the Nth episode»
  // Ibn Baz's book, each lesson explained by another scholar (named in the episode's title).
  { id: "binbaz-durus", group: "aqeedah", ch: "binbaz", ar: "شرح «الدروس المهمة لعامة الأمة» لابن باز", en: "Ibn Baz’s “Important Lessons for the Muslim Ummah”", by: "عدد من العلماء", byEn: "Several scholars",
    parts: [{ list: "PLyXEKGc2wE9ffR9ylG4RLaeWw9zftYArR" }], strip: [/\s*\(\d+\)\s*(?:شرح الدروس المهمة.*)?$/] },
  { id: "uthaymeen-tawheed", group: "aqeedah", ch: "uthaymeen", ar: "شرح كتاب التوحيد", en: "Commentary on Kitab at-Tawhid", by: "الشيخ محمد بن صالح العثيمين", byEn: "Shaykh Muhammad ibn Salih al-ʿUthaymin",
    parts: [{ list: "PLXS0usquloW9pmTubrM_Dy7N338Lq05CU" }] },
  { id: "uthaymeen-wasitiya", group: "aqeedah", ch: "uthaymeen", ar: "شرح العقيدة الواسطية", en: "Commentary on al-ʿAqida al-Wasitiyya", by: "الشيخ محمد بن صالح العثيمين", byEn: "Shaykh Muhammad ibn Salih al-ʿUthaymin",
    parts: [{ list: "PLXS0usquloW-IXuZTBpY8si9ZLeV7i3AV" }] },
  { id: "fawzan-lumah", group: "aqeedah", ch: "fawzan", ar: "شرح لمعة الاعتقاد", en: "Commentary on Lumʿat al-Iʿtiqad", by: "الشيخ صالح الفوزان", byEn: "Shaykh Salih al-Fawzan",
    parts: [{ list: "PL3523jgHxjkbNZciTFssUEM6wkw9RPhAp" }] },
  { id: "fawzan-tahawiya", group: "aqeedah", ch: "fawzan", ar: "شرح العقيدة الطحاوية", en: "Commentary on al-ʿAqida at-Tahawiyya", by: "الشيخ صالح الفوزان", byEn: "Shaykh Salih al-Fawzan",
    parts: [{ list: "PL3523jgHxjkbNDm7rciDevyRO3DH_nZHw" }] },
  { id: "zad-aqeedah", group: "aqeedah", ch: "zad", ar: "العقيدة", en: "Creed", by: "أكاديمية زاد", byEn: "Zad Academy",
    parts: zad(["PLH4NxcjPhgkmzk7Qm0k1lskylJXkTNr8I", "PLH4NxcjPhgkk8nbk0jv3rzPx1iZ3D1bOd", "PLH4NxcjPhgkl1tWYVgjHq9MHo7DCMBayG", "PLH4NxcjPhgklEgcd4tdbopPbnKkJG3_SI"]) },
  // ---- fiqh ----
  { id: "zad-fiqh", group: "fiqh", ch: "zad", ar: "الفقه", en: "Fiqh", by: "أكاديمية زاد", byEn: "Zad Academy",
    parts: zad(["PLH4NxcjPhgkmqtyRuEu-qkFoIyBJcuyxE", "PLH4NxcjPhgkmYrqlQBm_vDHSaaMAoQj0N", "PLH4NxcjPhgknuLTPW1vJZ1DvobbF0cd9y", "PLH4NxcjPhgkn9RPwWnE2XDkNReqibk4Hq"]) },
  { id: "uthaymeen-mumti", group: "fiqh", ch: "uthaymeen", ar: "الشرح الممتع على زاد المستقنع: كتاب الطهارة", en: "Ash-Sharh al-Mumtiʿ on Zad al-Mustaqniʿ: Purification", by: "الشيخ محمد بن صالح العثيمين", byEn: "Shaykh Muhammad ibn Salih al-ʿUthaymin",
    parts: [{ list: "PLXS0usquloW8Z7_B-1dUk82Xn-c1xLcrk" }] },
  { id: "fawzan-mulakhkhas", group: "fiqh", ch: "fawzan", ar: "شرح الملخص الفقهي (حلقات إذاعية)", en: "Al-Mulakhkhas al-Fiqhi (radio episodes)", by: "الشيخ صالح الفوزان", byEn: "Shaykh Salih al-Fawzan",
    parts: [{ list: "PL3523jgHxjkY2hy-9-YqgbS3yzGhQkmuq" }] },
  { id: "zad-usool", group: "fiqh", ch: "zad", ar: "أصول الفقه: شرح الأصول من علم الأصول", en: "Principles of fiqh: al-Usul min ʿIlm al-Usul", by: "د. منصور بن عبد الرحمن الغامدي", byEn: "Dr. Mansur ibn ʿAbd ar-Rahman al-Ghamidi",
    parts: [{ list: "PLH4NxcjPhgkkYa721LC4nyojjqDh-VCHF" }] },
  // ---- other lessons ----
  { id: "zad-tarbiya", group: "misc", ch: "zad", ar: "التربية الإسلامية", en: "Islamic upbringing", by: "أكاديمية زاد", byEn: "Zad Academy",
    parts: zad(["PLH4NxcjPhgkmIfTta0TooZLYS0iQCMh0D", "PLH4NxcjPhgkmOvA0Btij2RYHaahg1RSI6", "PLH4NxcjPhgknVmTvq_Lv0g8F-TF3-BZof", "PLH4NxcjPhgkkuS02CyR0AFYrDtpQECMcp"]) },
  { id: "binbaz-kalimat", group: "misc", ch: "binbaz", ar: "كلمات مؤثرة", en: "Moving words", by: "الشيخ عبد العزيز بن باز", byEn: "Shaykh ʿAbd al-ʿAziz ibn Baz",
    parts: [{ list: "PLyXEKGc2wE9fT0LgUMdyFcQJQ7U4MO5u1" }], strip: [/\s*(?:كلمة )?للإمام ابن باز رحمه الله\s*$/] },

  // ---- Shaykh Muhammad Saʿid Raslan (Egypt), from his website's channel ----
  { ...RASLAN, id: "raslan-nisa", group: "quran", ar: "تفسير سورة النساء", en: "Tafsir of Surah an-Nisaʾ",
    parts: [{ list: "PLYeopyETdCcdaJRCU2vgIXbEECQeZUY20" }], only: /تفسير سورة النساء/ },
  { ...RASLAN, id: "raslan-fadail-quran", group: "quran", ar: "فضائل القرآن", en: "The virtues of the Quran",
    parts: [{ list: "PLYeopyETdCceRMHguZheTjwtESo3owOBN" }] },
  { ...RASLAN, id: "raslan-arbaeen", group: "sunnah", ar: "شرح الأربعين النووية", en: "Commentary on an-Nawawi’s Forty Hadith",
    parts: [{ list: "PLYeopyETdCce0yOe42BoCScn8zZ6nvXOI" }], strip: [/^شرح الأربعين النووية\s*\d*/] },
  { ...RASLAN, id: "raslan-seerah", group: "seerah", ar: "السيرة النبوية", en: "The Prophet’s biography",
    parts: [{ list: "PLYeopyETdCceetl7TTjZUgmjkUSmZn-lm" }], strip: [/^السيرة النبوية\s*\[\d+\]/] },
  { ...RASLAN, id: "raslan-abubakr", group: "seerah", ar: "سيرة أبي بكر الصديق رضي الله عنه", en: "The life of Abu Bakr as-Siddiq",
    parts: [{ list: "PLYeopyETdCceBU1ak5MF3jHiRUT_lgNw1" }] },
  { ...RASLAN, id: "raslan-umar", group: "seerah", ar: "سيرة عمر بن الخطاب رضي الله عنه", en: "The life of ʿUmar ibn al-Khattab",
    parts: [{ list: "PLYeopyETdCceOLaLBo-Sp96V6xhPYhbtB" }] },
  { ...RASLAN, id: "raslan-usool", group: "aqeedah", ar: "شرح ثلاثة الأصول وأدلتها", en: "The Three Fundamental Principles",
    parts: [{ list: "PLYeopyETdCcfYSayD7tKjgmPZ9LrwAG9z" }], strip: [/^شرح ثلاثة أصول وأدلتها\s*(?:\(\d+\))?/] },
  { ...RASLAN, id: "raslan-tawheed", group: "aqeedah", ar: "شرح كتاب التوحيد", en: "Commentary on Kitab at-Tawhid",
    parts: [{ list: "PLYeopyETdCcdE7l6Gn08sBdE0jZglE2kb" }] },
  { ...RASLAN, id: "raslan-wasitiya", group: "aqeedah", ar: "شرح العقيدة الواسطية", en: "Commentary on al-ʿAqida al-Wasitiyya",
    parts: [{ list: "PLYeopyETdCcebFI-Vp4NZlO0-CZ5xTrFU" }] },
  { ...RASLAN, id: "raslan-usul-sunnah", group: "aqeedah", ar: "شرح أصول السنة للإمام أحمد", en: "Commentary on Imam Ahmad’s Usul as-Sunnah",
    parts: [{ list: "PLYeopyETdCcdGdhKkt2pgZuE6WKT5lpIU" }] },
  { ...RASLAN, id: "raslan-umdah", group: "fiqh", ar: "شرح عمدة الأحكام", en: "Commentary on ʿUmdat al-Ahkam",
    parts: [
      { ar: "كتاب الطهارة", en: "Purification", list: "PLYeopyETdCceKloqFhaZfGxsSvzAPRo1K" },
      { ar: "كتاب الصلاة", en: "Prayer", list: "PLYeopyETdCcehbpmPm4P18F5frl7Aa1qP" },
      { ar: "كتاب الزكاة", en: "Zakah", list: "PLYeopyETdCcdcugM2N05rQg8bE5jWceZs" },
      { ar: "كتاب الصيام", en: "Fasting", list: "PLYeopyETdCcfkITeiX1HRZNJeNBxT9Twg" },
    ] },
  { ...RASLAN, id: "raslan-sifat-salah", group: "fiqh", ar: "شرح صفة الصلاة", en: "How the Prophet ﷺ prayed",
    parts: [{ list: "PLYeopyETdCcfvJNGJj-z1PP4ZZVT2eEqR" }] },
  { ...RASLAN, id: "raslan-khuluq", group: "misc", ar: "حسن الخلق وأساليب اكتسابه", en: "Good character and how to gain it",
    parts: [{ list: "PLYeopyETdCcfUe-hyuW49qoDGwkN8FTPS" }] },
  { ...RASLAN, id: "raslan-adhkar", group: "misc", ar: "شرح أذكار الصباح والمساء", en: "The morning and evening adhkar explained",
    parts: [{ list: "PLYeopyETdCcfNJobhMtrJVo8h6TbJKCbY" }] },

  // ---- lessons given in the Sacred Mosque (their channel also broadcasts the lessons live, see LIVE) ----
  { id: "haram-al-imran", group: "quran", ch: "haram", ar: "تفسير سورة آل عمران", en: "Tafsir of Surah Al ʿImran", by: "الشيخ د. طلال أبو النور", byEn: "Shaykh Dr. Talal Abu an-Nur",
    parts: [{ list: "PLgaTRTylCbZBo1HG_DdyY3EfKlgzZHSoa" }], strip: TEACHER_AFTER },
  { id: "haram-adhkar", group: "sunnah", ch: "haram", ar: "شرح كتاب الأذكار للإمام النووي", en: "Commentary on an-Nawawi’s al-Adhkar", by: "أ. د. خالد محمد عروس", byEn: "Prof. Khalid Muhammad ʿArus",
    parts: [{ list: "PLgaTRTylCbZBLD5l7W1Xcw7dRnWKEDA1S" }] },
  { id: "haram-tawheed", group: "aqeedah", ch: "haram", ar: "شرح رسالة في التوحيد", en: "Commentary on a treatise on Tawhid", by: "الشيخ صالح بن حميد", byEn: "Shaykh Salih ibn Humayd",
    parts: [{ list: "PLgaTRTylCbZB5q12-twWYAjVZaO2sAUpz" }] },
  { id: "haram-umdat-fiqh", group: "fiqh", ch: "haram", ar: "شرح كتاب عمدة الفقه", en: "Commentary on ʿUmdat al-Fiqh", by: "أ. د. خالد محمد عروس", byEn: "Prof. Khalid Muhammad ʿArus",
    parts: [{ list: "PLgaTRTylCbZD8Woq-7_BQJV77_p1xj5UI" }] },
  { id: "haram-mirath", group: "misc", ch: "haram", ar: "ميراث: روائع دروس كبار العلماء الراحلين بالمسجد الحرام", en: "Mirath: lessons of the late senior scholars in the Sacred Mosque", by: "كبار العلماء", byEn: "Senior scholars",
    parts: [{ list: "PLA3pCH_a0aXo" }] },
  // ---- lessons given in the Prophet's Mosque ----
  { id: "nabawi-wasitiya", group: "aqeedah", ch: "nabawi", ar: "التنبيهات السنية على العقيدة الواسطية", en: "At-Tanbihat as-Saniyya on al-ʿAqida al-Wasitiyya", by: "الشيخ عبد الرزاق البدر", byEn: "Shaykh ʿAbd ar-Razzaq al-Badr",
    parts: [{ list: "PLriFofF1xij5Zdk4sJACWQWC0b30RUK_D" }], strip: ONLY_NUMBER },
  { id: "nabawi-asma", group: "aqeedah", ch: "nabawi", ar: "مختصر فقه الأسماء الحسنى", en: "A summary of understanding the Beautiful Names", by: "الشيخ عبد الرزاق البدر", byEn: "Shaykh ʿAbd ar-Razzaq al-Badr",
    parts: [{ list: "PLriFofF1xij4eMezXbU1mft-isiVoeF7r" }], strip: ONLY_NUMBER },
  { id: "nabawi-bulugh", group: "sunnah", ch: "nabawi", ar: "شرح بلوغ المرام", en: "Commentary on Bulugh al-Maram", by: "أ. د. علي بن غازي التويجري", byEn: "Prof. ʿAli ibn Ghazi at-Tuwayjiri",
    parts: [{ list: "PLriFofF1xij6LkPhjC-5TPbJGHFIqc2Cy" }], strip: ONLY_NUMBER },
  { id: "nabawi-arbaeen", group: "sunnah", ch: "nabawi", ar: "شرح الأربعين النووية", en: "Commentary on an-Nawawi’s Forty Hadith", by: "أ. د. سامي بن محمد الصقير", byEn: "Prof. Sami ibn Muhammad as-Suqayr",
    parts: [{ list: "PLriFofF1xij4Q_f_r1BLaLu6AJhCaaGUE" }], strip: ONLY_NUMBER },
  { id: "nabawi-seerah", group: "seerah", ch: "nabawi", ar: "الدورة العلمية في السيرة النبوية: السنة والسيرة محبة واتباع", en: "Course on the Seerah: love and following", by: "عدد من العلماء", byEn: "Several scholars",
    parts: [{ list: "PLHCkuLQjTBIw" }], strip: LECTURE_TITLE },
  { id: "nabawi-siyam", group: "fiqh", ch: "nabawi", ar: "زاد المستقنع: كتاب الصيام", en: "Zad al-Mustaqniʿ: Fasting", by: "أ. د. علي بن غازي التويجري", byEn: "Prof. ʿAli ibn Ghazi at-Tuwayjiri",
    parts: [{ list: "PLriFofF1xij60CtPGeVG_hhb0vtF4yiL3" }], strip: ONLY_NUMBER },
];
// Promotional clips the academy puts in its playlists.
const NOT_A_LESSON = /برومو|ما ?هو برنامج أكاديمية زاد|دعوة للتسجيل/;

// Live channels (Saudi Broadcasting Authority, the streams the mp3quran.net API lists under live-tv), and the lessons of
// the Two Holy Mosques, which their channels broadcast on YouTube while each lesson is given (yt: the channel in CHANNELS).
const LIVE = [
  { id: "makkah", ar: "قناة القرآن الكريم", en: "Holy Quran channel", at: "المسجد الحرام، مكة المكرمة", atEn: "The Sacred Mosque, Makkah", url: "https://win.holol.com/live/quran/playlist.m3u8" },
  { id: "madinah", ar: "قناة السنة النبوية", en: "Prophetic Sunnah channel", at: "المسجد النبوي، المدينة المنورة", atEn: "The Prophet’s Mosque, Madinah", url: "https://win.holol.com/live/sunnah/playlist.m3u8" },
  { id: "haram-lessons", yt: "haram", ar: "دروس المسجد الحرام", en: "Lessons at the Sacred Mosque", at: "مكة المكرمة", atEn: "Makkah" },
  { id: "nabawi-lessons", yt: "nabawi", ar: "دروس المسجد النبوي", en: "Lessons at the Prophet’s Mosque", at: "المدينة المنورة", atEn: "Madinah" },
];

// Audio series (IslamHouse item ids), each complete from its first lesson. src: the publisher (IslamHouse source id)
// the item must come from; by default the official foundation of Shaykh Ibn ʿUthaymin.
const UTHAYMEEN = { by: "الشيخ محمد بن صالح العثيمين", byEn: "Shaykh Muhammad ibn Salih al-ʿUthaymin",
  src: 9144, source: "مؤسسة الشيخ محمد بن صالح العثيمين الخيرية", sourceEn: "Shaykh Muhammad ibn Salih al-ʿUthaymin Charitable Foundation" };
const LESSONS = [
  // Ibn ʿUthaymin's own explanation of this book on IslamHouse lacks its first tape, so this one is al-Qasim's (30 lessons).
  { id: "usool-thalatha", ih: 285433, group: "aqeedah", ar: "تيسير الوصول إلى ثلاثة الأصول", en: "Taysir al-Wusul: the Three Fundamental Principles",
    by: "الشيخ عبد المحسن بن محمد القاسم", byEn: "Shaykh ʿAbd al-Muhsin ibn Muhammad al-Qasim", src: 204110, source: "موقع نداء الإسلام", sourceEn: "Nidaa al-Islam website" },
  { id: "kitab-tawheed", ih: 2829117, group: "aqeedah", ar: "شرح كتاب التوحيد", en: "Kitab at-Tawhid" },
  { id: "wasitiya", ih: 2829144, group: "aqeedah", ar: "شرح العقيدة الواسطية", en: "Al-ʿAqida al-Wasitiyya" },
  { id: "aqeedat-ahl-sunnah", ih: 2829146, group: "aqeedah", ar: "شرح عقيدة أهل السنة والجماعة", en: "The Creed of Ahl as-Sunnah wal-Jamaʿah" },
  { id: "qawaid-muthla", ih: 2829148, group: "aqeedah", ar: "شرح القواعد المثلى في صفات الله وأسمائه الحسنى", en: "Al-Qawaʿid al-Muthla: the names and attributes of Allah" },
  { id: "bulugh-mukhtasar", ih: 2829151, group: "sunnah", ar: "شرح بلوغ المرام (الشرح المختصر)", en: "Bulugh al-Maram (the short commentary)" },
  { id: "bayquniya", ih: 2830779, group: "sunnah", ar: "شرح المنظومة البيقونية في مصطلح الحديث", en: "Al-Manzuma al-Bayquniyya (hadith terminology)" },
  { id: "fiqh-ibadat", ih: 2831627, group: "fiqh", ar: "مختصر فقه العبادات", en: "A summary of the fiqh of worship" },
  { id: "mumti-tahara", ih: 2830890, group: "fiqh", ar: "الشرح الممتع على زاد المستقنع: كتاب الطهارة", en: "Ash-Sharh al-Mumtiʿ: Purification" },
].map(s => ({ ...UTHAYMEEN, ...s }));

// ---------- fetching (with a file cache) ----------
fs.mkdirSync(CACHE, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cached = async (name, fn) => {
  const f = path.join(CACHE, name);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const v = await fn(); fs.writeFileSync(f, JSON.stringify(v)); return v;
};
async function retry(fn, what) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) { if (i >= 3) throw new Error(`${what}: ${e.message}`); await sleep(1500 * (i + 1)); }
  }
}

// ---------- YouTube playlists ----------
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const YT_HEADERS = { "User-Agent": UA, "Accept-Language": "ar,en;q=0.8", "Cookie": "CONSENT=YES+1; SOCS=CAI" };
const walk = (o, f) => { if (!o || typeof o !== "object") return; if (f(o) === false) return; for (const k in o) walk(o[k], f); };
const text = x => x?.simpleText ?? x?.runs?.map(r => r.text).join("") ?? x?.content ?? "";
const seconds = s => String(s || "").split(":").reduce((a, x) => a * 60 + Number(x), 0) || 0;

async function playlist(list) {
  const html = await fetch(`https://www.youtube.com/playlist?list=${list}&hl=ar`, { headers: YT_HEADERS }).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); });
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s); if (!m) throw new Error("no playlist data");
  const key = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1], ver = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1];
  const data = JSON.parse(m[1]);
  const vids = []; let token = null;
  // The first continuation in a response belongs to the list (a later one belongs to the page around it).
  const collect = d => walk(d, o => {
    if (o.lockupViewModel?.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
      const l = o.lockupViewModel; let dur = "";
      walk(l.contentImage, x => { if (x.thumbnailBadgeViewModel) { dur = x.thumbnailBadgeViewModel.text; return false; } });
      vids.push({ id: l.contentId, title: text(l.metadata?.lockupMetadataViewModel?.title), sec: seconds(dur) }); return false;
    }
    if (o.continuationItemViewModel) { token ||= o.continuationItemViewModel.continuationCommand?.innertubeCommand?.continuationCommand?.token; return false; }
  });
  collect(data);
  while (token) {
    const t = token; token = null;
    collect(await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${key}&prettyPrint=false`, { method: "POST", headers: { ...YT_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: ver, hl: "ar" } }, continuation: t }) }).then(r => r.json()));
  }
  let owner = "", title = data.metadata?.playlistMetadataRenderer?.title || "";
  walk(data.header, o => { if (o.browseEndpoint?.browseId?.startsWith("UC")) { owner = o.browseEndpoint.browseId; return false; } });
  if (!vids.length) throw new Error("empty playlist");
  return { title, owner, vids };
}
// When a video was published (YYYY-MM-DD…), from YouTube's player data (watch pages are rate-limited sooner); "" when unknown.
async function published(id) {
  const j = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", { method: "POST", headers: { ...YT_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: "2.20261019.01.00", hl: "ar" } }, videoId: id }) })
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  return j.microformat?.playerMicroformatRenderer?.publishDate || j.microformat?.playerMicroformatRenderer?.uploadDate || "";
}
// 200: plays in other sites. 401: embedding turned off. 400/403/404: private, removed or blocked.
const embeddable = id => fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}&format=json`, { headers: { "User-Agent": UA } }).then(r => r.status);
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }

// Episode titles repeat the series, the teacher and the channel; the app keeps what tells the episodes apart
// (an episode with nothing of its own is shown by its number).
const digits = s => s.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660));
const INVISIBLE = new RegExp("[" + String.fromCodePoint(0x200E, 0x200F, 0x200B) + "]", "g"); // direction marks and zero-width spaces
const LEAD_NUM = /^(?:م\.?\s*)?(\d+)\s*(?:من\s*\d+)?\s*(?:[-.)–:]|(?=\D))\s*/; // «01-», «1 من 220|», «م. 1 -», «٤.»
const SPLIT = /\s*(?:--|[|/])\s*|\s+[-–ـ]\s*|\s*[-–ـ]\s+|(?<!\d)-|-(?!\d)/; // a hyphen between two digits is a range
const JUNK = [
  /^(?:المحاضرة|الحلقة|الدرس|المقطع|م\.?)\s*\d+$/, /^\d+$/, /^(?:المستوى|الدورة)/,
  /^(?:د\.|أ\.\s?د|ش\.|الشيخ|فضيلة|معالي|سماحة|الأستاذ)/, // the teacher, already shown with the series
  /^(?:مشروع )?كبار العلماء$|^(?:برنامج )?أكاديمية زاد$|^(?:ال)?(?:عقيدة|فقه|تفسير|حديث)$|^السيرة(?: النبوية)?$/,
  /^بجودة عالية|^\[(?:HD|4K)\]$/,
];
// «#مباشر» and «#بث_مباشر» only say the lesson was broadcast live; any other hashtag is a word of the title («#ابن عثيمين»).
const hashtags = s => s.replace(/#(?:بث_)?مباشر/g, " ").replace(/#(\S+)/g, (m, w) => w.replace(/_/g, " "));
// A Hijri date, with its weekday and the prayer the lesson followed: «الاثنين 08-02-1446 بعد المغرب».
const LESSON_DATE = /(?:السبت|الأحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الخميس|الجمعة)?\s*\d{1,2}\s*-\s*\d{1,2}\s*-\s*\d{4}\s*(?:هـ)?(?:\s*(?:بعد\s*)?(?:صلاة\s*)?(?:الفجر|الظهر|العصر|المغرب|العشاء))?/g;
const numless = s => s.replace(/^\d+\s*/, "").replace(/\s*\d+(\s*\))?$/, "$1").trim(); // «… 12», «( … 02 )»
function cleanTitles(titles, strip = []) {
  const prep = titles.map(t => {
    let s = hashtags(digits(t.replace(INVISIBLE, "").replace(/\s+/g, " ").trim())).replace(LESSON_DATE, " ");
    for (const re of strip) s = s.replace(re, " ");
    return s.replace(/\s+/g, " ").trim().replace(/^[\s|–-]+/, "").replace(LEAD_NUM, "").replace(/\s+/g, " ").trim();
  });
  const segs = prep.map(t => t.split(SPLIT).map(s => s.trim()).filter(Boolean));
  // «شرح صفة الصلاة 12» repeats the series name with the episode number: compare segments without their numbers.
  const freq = new Map(); segs.forEach(ss => new Set(ss.map(numless)).forEach(s => freq.set(s, (freq.get(s) || 0) + 1)));
  const common = s => titles.length >= 4 && numless(s).length >= 4 && freq.get(numless(s)) >= titles.length * 0.5;
  return segs.map(ss => ss.filter(s => !common(s) && !JUNK.some(re => re.test(s))).join(" – ")
    .replace(/^[\s\-–ـ.:|/]+|[\s\-–ـ.:|/]+$/g, "").replace(/\s+/g, " "));
}
// Some playlists were filled out of order (even newest first). When the titles number their episodes, the episodes go in
// that order: the first way of numbering that gives at least 9 in 10 titles a number of their own wins; titles without one
// keep their place after the numbered ones.
const NUMBERINGS = [
  t => t.match(LEAD_NUM)?.[1],                                   // «01- …», «1 من 220|…», «م. 3 - …»
  t => t.match(/(?:المحاضرة|الحلقة|الدرس|المقطع|اللقاء)\s*(\d+)/)?.[1],
  t => t.match(/\[(\d+)\]/)?.[1],                                // «السيرة النبوية [12] …»
  t => t.match(/\((\d+)\)/)?.[1],                                // «… (8) …»
  t => t.split("|")[0].trim().match(/(\d+)$/)?.[1],              // «… عمدة الأحكام 13», «… 81 | الشيخ …»
  t => t.match(/(\d+)\s*\)/)?.[1],                               // «( شرح رسالة في التوحيد 02 )»
];
function byNumber(vids) {
  const plain = t => hashtags(digits(t.replace(/\s+/g, " ").trim())).replace(LESSON_DATE, "").replace(/^[\s|–-]+/, "");
  for (const way of NUMBERINGS) {
    const n = vids.map(v => { const x = way(plain(v.title)); return x == null ? null : Number(x); });
    const numbered = n.filter(x => x != null);
    if (numbered.length < Math.max(2, vids.length * 0.9) || new Set(numbered).size !== numbered.length) continue;
    return vids.map((v, i) => [v, n[i] ?? Infinity, i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([v]) => v);
  }
  return vids;
}

async function buildVideos() {
  const oembed = fs.existsSync(path.join(CACHE, "oembed.json")) ? JSON.parse(fs.readFileSync(path.join(CACHE, "oembed.json"), "utf8")) : {};
  const dates = fs.existsSync(path.join(CACHE, "dates.json")) ? JSON.parse(fs.readFileSync(path.join(CACHE, "dates.json"), "utf8")) : {};
  const series = [];
  for (const s of VIDEOS) {
    const ch = CHANNELS[s.ch]; const parts = [];
    for (const p of s.parts) {
      const pl = await cached(`yt-${p.list}.json`, () => retry(() => playlist(p.list), p.list));
      if (pl.owner !== ch.yt) throw new Error(`${s.id}: playlist ${p.list} belongs to ${pl.owner}, not ${s.ch} (${ch.yt})`);
      const vids = pl.vids.filter(v => !NOT_A_LESSON.test(v.title) && (!s.only || s.only.test(v.title)));
      await pool(vids.filter(v => oembed[v.id] == null), 8, async v => { oembed[v.id] = await retry(() => embeddable(v.id), v.id); });
      let ok = vids.filter(v => oembed[v.id] === 200);
      if (ch.dated && ok.length > 1) {
        // Watch pages are rate-limited (HTTP 429), so only the first and last episode are dated: a playlist that runs
        // newest first is turned round. Numbered titles are then put in their exact order below.
        for (const v of [ok[0], ok[ok.length - 1]]) if (!dates[v.id]) {
          try { dates[v.id] = await retry(() => published(v.id), v.id); } catch (e) { console.log(`  ${e.message}`); }
          await sleep(700);
        }
        fs.writeFileSync(path.join(CACHE, "dates.json"), JSON.stringify(dates));
        const [a, b] = [dates[ok[0].id], dates[ok[ok.length - 1].id]];
        if (!a || !b) console.log(`  ${s.id} ${p.list}: no publish date, kept in the playlist's order`);
        else if (a > b) ok = ok.slice().reverse();
      }
      ok = byNumber(ok);
      const dropped = vids.length - ok.length;
      if (dropped) console.log(`  ${s.id} ${p.list}: ${dropped} video(s) cannot play inside the app, left out`);
      const titles = cleanTitles(ok.map(v => v.title), s.strip);
      parts.push({ ...(p.ar ? { ar: p.ar, en: p.en } : {}), list: p.list, eps: ok.map((v, i) => [v.id, titles[i], v.sec]) });
    }
    const n = parts.reduce((a, p) => a + p.eps.length, 0);
    console.log(`✓ ${s.group.padEnd(7)} ${s.id}: ${n} episodes`);
    series.push({ id: s.id, group: s.group, ch: s.ch, ar: s.ar, en: s.en, by: s.by, byEn: s.byEn, parts });
  }
  fs.writeFileSync(path.join(CACHE, "oembed.json"), JSON.stringify(oembed));
  fs.writeFileSync(path.join(CACHE, "dates.json"), JSON.stringify(dates));
  const out = {
    built: new Date().toISOString().slice(0, 10),
    note: "Video lesson series from the scholars' own YouTube channels, in each playlist's order (scripts/build-series.js), and the live Quran and Sunnah channels. Rebuild with: npm run series",
    channels: Object.fromEntries(Object.entries(CHANNELS).map(([k, c]) => [k, { ar: c.ar, en: c.en, yt: c.yt }])),
    live: LIVE, series,
  };
  fs.writeFileSync(path.join(ROOT, "www", "data", "videos.json"), JSON.stringify(out) + "\n");
}

// ---------- IslamHouse audio series ----------
async function buildLessons() {
  const series = [];
  for (const s of LESSONS) {
    const j = await cached(`ih-${s.ih}.json`, () => retry(() => fetch(`${IH}/main/get-item/${s.ih}/ar/json`).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }), "islamhouse " + s.ih));
    if (!j.prepared_by?.some(p => p.id === s.src)) throw new Error(`${s.id}: IslamHouse ${s.ih} is not from source ${s.src} (${s.source})`);
    const files = j.attachments.filter(a => a.extension_type === "MP3").sort((a, b) => a.order - b.order);
    if (!files.length) throw new Error(`${s.id}: no MP3 files`);
    series.push({ id: s.id, group: s.group, ar: s.ar, en: s.en, by: s.by, byEn: s.byEn, source: s.source, sourceEn: s.sourceEn, ih: s.ih,
      tracks: files.map(a => [a.url, a.description.replace(/\s+/g, " ").trim()]) });
    console.log(`✓ ${s.group.padEnd(7)} ${s.id}: ${files.length} lessons`);
  }
  const out = {
    built: new Date().toISOString().slice(0, 10),
    note: "Recorded lesson series played one after another on the radio page: the MP3 files the scholars' foundations published on IslamHouse.com (scripts/build-series.js). Rebuild with: npm run series",
    series,
  };
  fs.writeFileSync(path.join(ROOT, "www", "data", "lessons.json"), JSON.stringify(out) + "\n");
}

module.exports = { VIDEOS, LIVE, LESSONS, CHANNELS };
if (require.main === module) (async () => {
  await buildLessons();
  await buildVideos();
})().catch(e => { console.error("✗ " + e.message); process.exit(1); });
