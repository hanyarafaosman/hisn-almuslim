// Source of «ركن الأطفال» (#/kids) and «يوميات مسلم» (#/muslim): the lessons in Arabic (original) and English (the
// reference the other languages are translated from, www/guide/<lang>.json). Run: node scripts/build-guide.js
// Every text is [Arabic, English]. Evidence is never written here: it is named and scripts/build-guide.js fetches it:
//   "q 51:56" / "q 112:1-4"   verses, copied from Quran.com's imlaei text
//   "h bukhari <words>"       the first hadith of that book holding these words (hadith-api, the app's hadith reader)
//   "d 13"                    a dhikr of Hisn al-Muslim by its number in www/data/hisn.json (text, audio, translation)
// Lists: lines separated by \n. Links: [address, key of an interface string in www/i18n].

// ---------------------------------------------------------------------------------------------------------------
// ركن الأطفال: questions and answers, each with its evidence, then a short quiz (the first option is the right one).
// ---------------------------------------------------------------------------------------------------------------
const kids = [
  {
    id: "rabb", icon: "heart", t: ["أعرف ربي", "I know my Lord"], s: ["من ربي؟ ولماذا خلقني؟", "Who is my Lord, and why did He create me?"],
    cards: [
      { id: "who", q: ["مَن ربُّك؟", "Who is your Lord?"], a: ["ربي الله، الذي خلقني وخلق كل شيء، ورزقني وأنعم عليّ.", "My Lord is Allah. He created me and everything, and He gives me all the good things I have."], ev: ["q 39:62"] },
      { id: "why", q: ["لماذا خلقنا الله؟", "Why did Allah create us?"], a: ["خلقنا لنعبده وحده ولا نشرك به شيئًا.", "He created us to worship Him alone, and not to worship anything else with Him."], ev: ["q 51:56"] },
      { id: "ibada", q: ["ما العبادة؟", "What is worship?"], a: ["كل ما يحبه الله من الأقوال والأعمال، مثل: الصلاة، والدعاء، وبر الوالدين، والصدق.", "Everything Allah loves of words and deeds, such as prayer, calling on Him, being good to parents, and telling the truth."], ev: ["q 6:162"] },
      { id: "know", q: ["كيف عرفتَ ربك؟", "How do you know your Lord?"], a: ["عرفته بمخلوقاته وآياته: الليل والنهار، والشمس والقمر، والسماء والأرض.", "I know Him through what He created and His signs: night and day, the sun and the moon, the sky and the earth."], ev: ["q 41:37"] },
      { id: "where", q: ["أين الله؟", "Where is Allah?"], a: ["الله في السماء، فوق عرشه، وهو يرانا ويسمعنا ويعلم كل شيء أينما كنا.", "Allah is above the heavens, over His Throne. He sees us, hears us and knows everything, wherever we are."], ev: ["q 20:5", "h muslim أين الله"] },
      { id: "like", q: ["هل يشبه اللهَ أحدٌ من خلقه؟", "Is anything in creation like Allah?"], a: ["لا، ليس كمثله شيء، وهو السميع البصير.", "No. Nothing is like Him, and He is the All-Hearing, the All-Seeing."], ev: ["q 42:11"] },
      { id: "tawhid", q: ["ما التوحيد؟", "What is Tawhid?"], a: ["أن نعبد الله وحده: ندعوه وحده، ونصلي له وحده، ونتوكل عليه وحده.", "To worship Allah alone: we call on Him alone, pray to Him alone, and rely on Him alone."], ev: ["q 112:1-4"] },
      { id: "shirk", q: ["ما أعظم ذنب؟", "What is the greatest sin?"], a: ["الشرك، وهو أن يُعبد مع الله غيره. والله وحده هو الذي يستحق العبادة.", "Shirk: worshipping anything else along with Allah. Only Allah deserves to be worshipped."], ev: ["q 31:13"] },
    ],
    quiz: [
      { q: ["مَن خلقنا ورزقنا؟", "Who created us and provides for us?"], o: [["الله", "Allah"], ["الشمس", "The sun"], ["الناس", "People"]] },
      { q: ["لماذا خلقنا الله؟", "Why did Allah create us?"], o: [["لنعبده وحده", "To worship Him alone"], ["لنلعب فقط", "Only to play"], ["بلا سبب", "For no reason"]] },
      { q: ["ما أعظم ذنب؟", "What is the greatest sin?"], o: [["الشرك بالله", "Shirk: worshipping others with Allah"], ["النوم الكثير", "Sleeping a lot"], ["نسيان الواجب", "Forgetting homework"]] },
      { q: ["هل يرانا الله ويسمعنا؟", "Does Allah see and hear us?"], o: [["نعم، دائمًا وفي كل مكان", "Yes, always and everywhere"], ["في النهار فقط", "Only in the daytime"], ["لا", "No"]] },
    ],
  },
  {
    id: "deen", icon: "kaaba", t: ["أعرف ديني", "I know my religion"], s: ["الإسلام وأركانه الخمسة", "Islam and its five pillars"],
    cards: [
      { id: "what", q: ["ما دينك؟", "What is your religion?"], a: ["ديني الإسلام: أن أعبد الله وحده، وأطيعه، ولا أشرك به شيئًا.", "My religion is Islam: I worship Allah alone, I obey Him, and I worship nothing else with Him."], ev: ["q 3:19"] },
      { id: "arkan", q: ["كم أركان الإسلام؟", "How many pillars does Islam have?"], a: ["خمسة:", "Five:"], l: ["شهادة أن لا إله إلا الله وأن محمدًا رسول الله\nإقام الصلاة\nإيتاء الزكاة\nصوم رمضان\nحج بيت الله الحرام لمن استطاع", "To testify that none has the right to be worshipped but Allah, and that Muhammad is the Messenger of Allah\nTo pray the five daily prayers\nTo give zakah\nTo fast in Ramadan\nTo make the pilgrimage (Hajj) to the House of Allah, for those who are able"], ev: ["h nawawi بني الإسلام على خمس"] },
      { id: "lailaha", q: ["ما معنى «لا إله إلا الله»؟", "What does «لا إله إلا الله» (lā ilāha illa-llāh) mean?"], a: ["لا معبود بحقٍّ إلا الله؛ فلا نعبد إلا الله.", "No one has the right to be worshipped except Allah. So we worship only Allah."], ev: ["q 47:19"] },
      { id: "rasul", q: ["ما معنى «محمد رسول الله»؟", "What does «محمد رسول الله» (Muḥammadun rasūlu-llāh) mean?"], a: ["أن الله أرسله إلى الناس جميعًا؛ فنصدّقه، ونطيعه، ونتّبع سنّته.", "Allah sent him to all people. So we believe him, obey him, and follow his way (the Sunnah)."], ev: ["q 7:158"] },
      { id: "salah", q: ["كم صلاة نصلي في اليوم والليلة؟", "How many prayers do we pray each day and night?"], a: ["خمس صلوات: الفجر، والظهر، والعصر، والمغرب، والعشاء.", "Five prayers: Fajr, Dhuhr, Asr, Maghrib and Isha."], ev: ["q 4:103"] },
      { id: "sawm", q: ["متى نصوم؟", "When do we fast?"], a: ["نصوم شهر رمضان، من طلوع الفجر إلى غروب الشمس.", "We fast the month of Ramadan, from dawn until sunset."], ev: ["q 2:183"] },
      { id: "zakah", q: ["ما الزكاة وما الحج؟", "What are zakah and Hajj?"], a: ["الزكاة: مالٌ يعطيه الغني للفقير كما أمر الله. والحج: زيارة بيت الله الحرام في مكة مرةً في العمر لمن استطاع.", "Zakah is wealth the rich give to the poor, as Allah commanded. Hajj is visiting the House of Allah in Makkah once in a lifetime, for those who are able."], ev: ["q 3:97"] },
    ],
    quiz: [
      { q: ["كم أركان الإسلام؟", "How many pillars does Islam have?"], o: [["خمسة", "Five"], ["ثلاثة", "Three"], ["سبعة", "Seven"]] },
      { q: ["ما الركن الأول من أركان الإسلام؟", "What is the first pillar of Islam?"], o: [["الشهادتان", "The two testimonies of faith"], ["الصوم", "Fasting"], ["الحج", "Hajj"]] },
      { q: ["في أي شهر نصوم؟", "In which month do we fast?"], o: [["رمضان", "Ramadan"], ["شوال", "Shawwal"], ["رجب", "Rajab"]] },
      { q: ["كم صلاة في اليوم والليلة؟", "How many prayers are there each day and night?"], o: [["خمس", "Five"], ["صلاتان", "Two"], ["عشر", "Ten"]] },
    ],
  },
  {
    id: "nabi", icon: "star", t: ["أعرف نبيي ﷺ", "I know my Prophet ﷺ"], s: ["محمد رسول الله ﷺ", "Muhammad, the Messenger of Allah ﷺ"],
    cards: [
      { id: "who", q: ["مَن نبيُّك؟", "Who is your Prophet?"], a: ["نبيي محمد بن عبد الله ﷺ، من قبيلة قريش، من ذرية إسماعيل بن إبراهيم عليهما السلام.", "My Prophet is Muhammad, son of Abdullah ﷺ, from the tribe of Quraysh, a descendant of Ismail, son of Ibrahim, peace be upon them."] },
      { id: "born", q: ["أين وُلد؟ وإلى أين هاجر؟", "Where was he born, and where did he migrate to?"], a: ["وُلد في مكة، وهاجر إلى المدينة، وفيها توفي ﷺ.", "He was born in Makkah and migrated to Madinah, where he passed away ﷺ."] },
      { id: "wahy", q: ["متى نزل عليه الوحي؟", "When did revelation come to him?"], a: ["نزل عليه الوحي وعمره أربعون سنة، وهو في غار حراء. وأول ما نزل عليه من القرآن أول سورة العلق.", "Revelation came to him when he was forty years old, in the Cave of Hira. The first verses of the Quran revealed to him were the beginning of Surah al-ʿAlaq."], ev: ["q 96:1-5"] },
      { id: "last", q: ["هل يأتي بعده نبي؟", "Will any prophet come after him?"], a: ["لا، هو خاتم الأنبياء والمرسلين.", "No. He is the last of the prophets and messengers."], ev: ["q 33:40"] },
      { id: "sent", q: ["لماذا أرسله الله؟", "Why did Allah send him?"], a: ["أرسله رحمةً للعالمين، يدعو الناس إلى عبادة الله وحده ويعلّمهم الخير.", "Allah sent him as a mercy to the worlds, to call people to worship Allah alone and to teach them what is good."], ev: ["q 21:107"] },
      { id: "love", q: ["كيف نحب النبي ﷺ؟", "How do we love the Prophet ﷺ?"], a: ["نحبه أكثر من كل الناس، ونطيعه، ونتّبع سنّته.", "We love him more than all other people, we obey him, and we follow his Sunnah."], ev: ["q 3:31", "h bukhari أحب إليه من والده وولده"] },
      { id: "khuluq", q: ["كيف كانت أخلاقه ﷺ؟", "What was his character like ﷺ?"], a: ["كان أحسن الناس خُلُقًا: صادقًا، أمينًا، رحيمًا، كريمًا.", "He had the best character of all people: truthful, trustworthy, merciful and generous."], ev: ["q 68:4"] },
      { id: "anbiya", q: ["مَن الأنبياء قبله؟", "Who were the prophets before him?"], a: ["أنبياء كثيرون، منهم: آدم ونوح وإبراهيم وموسى وعيسى عليهم السلام. وكلهم دعوا الناس إلى عبادة الله وحده.", "There were many prophets, among them Adam, Nuh (Noah), Ibrahim (Abraham), Musa (Moses) and ʿIsa (Jesus), peace be upon them. All of them called people to worship Allah alone."], ev: ["q 16:36"] },
    ],
    quiz: [
      { q: ["ما اسم نبينا ﷺ؟", "What is our Prophet's name ﷺ?"], o: [["محمد بن عبد الله", "Muhammad, son of Abdullah"], ["موسى بن عمران", "Musa, son of Imran"], ["نوح", "Nuh"]] },
      { q: ["أين وُلد النبي ﷺ؟", "Where was the Prophet ﷺ born?"], o: [["مكة", "Makkah"], ["المدينة", "Madinah"], ["القدس", "Jerusalem"]] },
      { q: ["كم كان عمره حين نزل عليه الوحي؟", "How old was he when revelation came to him?"], o: [["أربعون سنة", "Forty years"], ["عشر سنين", "Ten years"], ["ستون سنة", "Sixty years"]] },
      { q: ["هل يأتي نبي بعد محمد ﷺ؟", "Will a prophet come after Muhammad ﷺ?"], o: [["لا، هو خاتم الأنبياء", "No, he is the last prophet"], ["نعم", "Yes"], ["لا نعلم", "We do not know"]] },
    ],
  },
  {
    id: "iman", icon: "asma", t: ["أركان الإيمان", "The pillars of faith"], s: ["ستة أشياء أؤمن بها", "Six things I believe in"],
    cards: [
      { id: "six", q: ["كم أركان الإيمان؟", "How many pillars of faith (Iman) are there?"], a: ["ستة، أن تؤمن:", "Six. To believe in:"], l: ["بالله\nوملائكته\nوكتبه\nورسله\nواليوم الآخر\nوبالقدر خيره وشره", "Allah\nHis angels\nHis books\nHis messengers\nThe Last Day\nThe divine decree (Qadar), its good and its bad"], ev: ["h nawawi أن تؤمن بالله وملائكته"] },
      { id: "malaika", q: ["مَن الملائكة؟", "Who are the angels?"], a: ["خلقٌ من خلق الله، خلقهم من نور، يطيعونه ولا يعصونه. منهم جبريل عليه السلام الذي نزل بالوحي على الأنبياء.", "They are a creation of Allah, made from light. They obey Him and never disobey. One of them is Jibril (Gabriel), peace be upon him, who brought the revelation to the prophets."], ev: ["h muslim خلقت الملائكة من نور"] },
      { id: "kutub", q: ["ما كتب الله؟", "What are the books of Allah?"], a: ["كتبٌ أنزلها الله على رسله، منها: التوراة والإنجيل والزبور، وآخرها القرآن الذي حفظه الله من التغيير.", "Books Allah sent down to His messengers, among them the Torah, the Gospel (Injil) and the Psalms (Zabur). The last is the Quran, which Allah has protected from any change."], ev: ["q 15:9"] },
      { id: "rusul", q: ["مَن الرسل؟", "Who are the messengers?"], a: ["بشرٌ اختارهم الله ليعلّموا الناس دينه، وآخرهم محمد ﷺ. نؤمن بهم جميعًا ونحبهم.", "They are human beings Allah chose to teach people His religion. The last of them is Muhammad ﷺ. We believe in all of them and love them."], ev: ["q 2:285"] },
      { id: "akhira", q: ["ما اليوم الآخر؟", "What is the Last Day?"], a: ["يوم القيامة: يُحيي الله الناس بعد الموت ويحاسبهم على أعمالهم؛ فمن آمن وعمل صالحًا دخل الجنة.", "The Day of Resurrection: Allah will bring people back to life after death and judge their deeds. Whoever believed and did good will enter Paradise."], ev: ["q 99:7-8"] },
      { id: "qadar", q: ["ما الإيمان بالقدر؟", "What does it mean to believe in the divine decree (Qadar)?"], a: ["أن نؤمن أن الله يعلم كل شيء، وكتب كل شيء، ولا يحدث شيء إلا بمشيئته؛ فنشكره على الخير ونصبر على ما يصيبنا.", "To believe that Allah knows everything, has written everything, and that nothing happens unless He wills it. So we thank Him for what is good and are patient with what befalls us."], ev: ["q 54:49"] },
    ],
    quiz: [
      { q: ["كم أركان الإيمان؟", "How many pillars of faith are there?"], o: [["ستة", "Six"], ["خمسة", "Five"], ["أربعة", "Four"]] },
      { q: ["مِمَّ خُلقت الملائكة؟", "What were the angels created from?"], o: [["من نور", "From light"], ["من تراب", "From dust"], ["من ماء", "From water"]] },
      { q: ["ما آخر كتب الله؟", "Which is the last of Allah's books?"], o: [["القرآن", "The Quran"], ["التوراة", "The Torah"], ["الإنجيل", "The Gospel"]] },
      { q: ["مَن المَلَك الذي نزل بالوحي؟", "Which angel brought the revelation?"], o: [["جبريل عليه السلام", "Jibril, peace be upon him"], ["ميكائيل عليه السلام", "Mikail, peace be upon him"], ["لا نعرف اسمه", "We do not know his name"]] },
    ],
  },
  {
    id: "wudu", icon: "cloud", t: ["وضوئي وطهارتي", "My wudu and cleanliness"], s: ["أتطهّر لأصلي", "I purify myself to pray"],
    cards: [
      { id: "why", q: ["لماذا أتوضأ؟", "Why do I make wudu?"], a: ["لأن الله أمرنا بالوضوء قبل الصلاة، ولا تصح الصلاة بغير طهارة.", "Because Allah commanded us to make wudu before prayer, and prayer is not valid without purification."], ev: ["q 5:6", "h nawawi الطهور شطر الإيمان"] },
      { id: "how", q: ["كيف أتوضأ؟", "How do I make wudu?"], a: ["أتوضأ بهذا الترتيب:", "I make wudu in this order:"], ol: true, l: ["أنوي بقلبي، وأقول: «بسم الله».\nأغسل كفَّيَّ ثلاث مرات.\nأتمضمض وأستنشق ثلاث مرات.\nأغسل وجهي ثلاث مرات.\nأغسل يديَّ إلى المرفقين ثلاث مرات، اليمنى ثم اليسرى.\nأمسح رأسي مرة واحدة، وأمسح أذنيَّ.\nأغسل رجليَّ إلى الكعبين ثلاث مرات، اليمنى ثم اليسرى.", "I intend it in my heart and say: «بسم الله» (Bismillāh).\nI wash my hands three times.\nI rinse my mouth and nose three times.\nI wash my face three times.\nI wash my arms up to the elbows three times, the right and then the left.\nI wipe my head once, and wipe my ears.\nI wash my feet up to the ankles three times, the right and then the left."], ev: ["h bukhari من توضأ نحو وضوئي هذا"] },
      { id: "after", q: ["ماذا أقول بعد الوضوء؟", "What do I say after wudu?"], a: ["أقول هذا الذكر:", "I say this remembrance:"], ev: ["d 13"] },
      { id: "breaks", q: ["ما الذي ينقض الوضوء؟", "What breaks wudu?"], a: ["ينتقض الوضوء بأشياء، منها: قضاء الحاجة، وخروج الريح، والنوم العميق.", "Some things break wudu, among them: using the toilet, passing wind, and deep sleep."] },
      { id: "water", q: ["هل أُسرف في الماء؟", "May I waste water?"], a: ["لا، أتوضأ بماء قليل ولا أُسرف؛ فالله لا يحب المسرفين.", "No. I make wudu with a little water and do not waste it, because Allah does not love those who waste."], ev: ["q 7:31"] },
      { id: "khala", q: ["ماذا أقول عند دخول الخلاء والخروج منه؟", "What do I say when entering and leaving the toilet?"], a: ["أدخل برجلي اليسرى وأقول دعاء الدخول، وأخرج برجلي اليمنى وأقول: «غفرانك».", "I enter with my left foot and say the entering supplication. I leave with my right foot and say: «غفرانك» (Ghufrānak)."], ev: ["d 10", "d 11"] },
    ],
    quiz: [
      { q: ["ماذا أقول في أول الوضوء؟", "What do I say at the start of wudu?"], o: [["بسم الله", "Bismillāh"], ["الحمد لله", "Alḥamdulillāh"], ["لا أقول شيئًا", "Nothing"]] },
      { q: ["كم مرة أمسح رأسي؟", "How many times do I wipe my head?"], o: [["مرة واحدة", "Once"], ["ثلاث مرات", "Three times"], ["خمس مرات", "Five times"]] },
      { q: ["ما آخر ما أغسله في الوضوء؟", "What is the last thing I wash in wudu?"], o: [["الرجلان", "The feet"], ["الوجه", "The face"], ["اليدان", "The arms"]] },
      { q: ["هل تصح الصلاة بغير وضوء؟", "Is prayer valid without wudu?"], o: [["لا", "No"], ["نعم", "Yes"], ["أحيانًا", "Sometimes"]] },
    ],
  },
  {
    id: "salah", icon: "prayer", t: ["صلاتي", "My prayer"], s: ["أقف بين يدي ربي", "I stand before my Lord"],
    cards: [
      { id: "what", q: ["ما الصلاة؟", "What is the prayer (Salah)?"], a: ["عبادة عظيمة نقف فيها بين يدي الله خمس مرات كل يوم، وهي عمود الدين.", "A great act of worship in which we stand before Allah five times every day. It is the pillar of the religion."], ev: ["h nawawi وعموده الصلاة"] },
      { id: "count", q: ["كم ركعة في كل صلاة؟", "How many rakʿahs (units) are in each prayer?"], a: ["لكل صلاة عدد من الركعات:", "Each prayer has a number of rakʿahs:"], l: ["الفجر: ركعتان\nالظهر: أربع ركعات\nالعصر: أربع ركعات\nالمغرب: ثلاث ركعات\nالعشاء: أربع ركعات", "Fajr: two\nDhuhr: four\nAsr: four\nMaghrib: three\nIsha: four"] },
      { id: "age", q: ["متى أبدأ الصلاة؟", "When do I start praying?"], a: ["علّمنا النبي ﷺ أن يؤمر الأولاد بالصلاة وهم أبناء سبع سنين. وأنا أحب أن أصلي مع أبي وأمي من الآن.", "The Prophet ﷺ taught that children should be told to pray when they are seven years old. And I love to pray with my father and mother from now."], ev: ["h abudawud مروا أولادكم بالصلاة"] },
      { id: "how", q: ["كيف أصلي؟", "How do I pray?"], a: ["أصلي كما صلى النبي ﷺ:", "I pray as the Prophet ﷺ prayed:"], ol: true, l: ["أتوضأ، وألبس ثيابًا طاهرة، وأستقبل القبلة.\nأكبّر: «الله أكبر»، ثم أقرأ الفاتحة وما تيسّر من القرآن.\nأركع وأقول: «سبحان ربي العظيم».\nأرفع وأقول: «سمع الله لمن حمده، ربنا ولك الحمد».\nأسجد وأقول: «سبحان ربي الأعلى»، ثم أجلس، ثم أسجد مرة ثانية.\nفي آخر الصلاة أقرأ التشهد، ثم أسلّم عن يميني وعن يساري.", "I make wudu, wear clean clothes and face the qiblah.\nI say «الله أكبر» (Allāhu akbar), then recite al-Fatihah and some more of the Quran.\nI bow and say: «سبحان ربي العظيم» (Subḥāna rabbiya-l-ʿaẓīm).\nI stand up and say: «سمع الله لمن حمده، ربنا ولك الحمد» (Samiʿa-llāhu liman ḥamidah, rabbanā wa laka-l-ḥamd).\nI prostrate and say: «سبحان ربي الأعلى» (Subḥāna rabbiya-l-aʿlā), then I sit, then I prostrate a second time.\nAt the end of the prayer I recite the tashahhud, then I say the salam to my right and to my left."], ev: ["h bukhari صلوا كما رأيتموني أصلي"], links: [["#/muslim/step/pray", "@ui.prayGuide"]] },
      { id: "qibla", q: ["إلى أين أتجه في الصلاة؟", "Which way do I face in prayer?"], a: ["أتجه إلى القبلة، وهي الكعبة في مكة المكرمة.", "I face the qiblah: the Kaʿbah in Makkah."], ev: ["q 2:149"], links: [["#/qibla", "qibla.title"]] },
      { id: "khushu", q: ["كيف أقف في صلاتي؟", "How do I stand in my prayer?"], a: ["أقف بأدب وهدوء، لا ألتفت ولا ألعب؛ لأنني أقف بين يدي الله.", "I stand calmly and respectfully. I do not look around or play, because I am standing before Allah."], ev: ["q 23:1-2"] },
    ],
    quiz: [
      { q: ["كم ركعة صلاة المغرب؟", "How many rakʿahs is the Maghrib prayer?"], o: [["ثلاث", "Three"], ["ركعتان", "Two"], ["أربع", "Four"]] },
      { q: ["ماذا أقول في الركوع؟", "What do I say when bowing?"], o: [["سبحان ربي العظيم", "Subḥāna rabbiya-l-ʿaẓīm"], ["سبحان ربي الأعلى", "Subḥāna rabbiya-l-aʿlā"], ["السلام عليكم", "As-salāmu ʿalaykum"]] },
      { q: ["إلى أين أتجه في الصلاة؟", "Which way do I face in prayer?"], o: [["إلى الكعبة", "Towards the Kaʿbah"], ["إلى الشمس", "Towards the sun"], ["إلى أي جهة", "Any direction"]] },
      { q: ["بماذا أبدأ الصلاة؟", "How do I begin the prayer?"], o: [["بقول: الله أكبر", "By saying: Allāhu akbar"], ["بالسجود", "By prostrating"], ["بالسلام", "By saying the salam"]] },
    ],
  },
  {
    id: "quran", icon: "quran", t: ["كتابي القرآن", "My book, the Quran"], s: ["كلام الله الذي أحبه", "The words of Allah that I love"],
    cards: [
      { id: "what", q: ["ما القرآن؟", "What is the Quran?"], a: ["كلام الله، أنزله على نبينا محمد ﷺ بواسطة جبريل عليه السلام، ليهدي الناس إلى الخير.", "It is the speech of Allah. He sent it down to our Prophet Muhammad ﷺ through Jibril, peace be upon him, to guide people to what is good."], ev: ["q 17:9"] },
      { id: "count", q: ["كم سورة في القرآن؟", "How many surahs are in the Quran?"], a: ["مئة وأربع عشرة سورة، أولها الفاتحة وآخرها الناس.", "One hundred and fourteen surahs. The first is al-Fatihah and the last is an-Nas."] },
      { id: "adab", q: ["كيف أقرأ القرآن؟", "How do I read the Quran?"], a: ["أقرؤه وأنا طاهر، بتمهّل وأدب، وأبدأ بقول: «أعوذ بالله من الشيطان الرجيم».", "I read it in a state of purity, slowly and respectfully, and I begin by saying: «أعوذ بالله من الشيطان الرجيم» (Aʿūdhu billāhi mina-sh-shayṭāni-r-rajīm)."], ev: ["q 16:98"] },
      { id: "best", q: ["مَن خير الناس؟", "Who are the best of people?"], a: ["أخبرنا النبي ﷺ أن خير الناس مَن تعلّم القرآن وعلّمه.", "The Prophet ﷺ told us that the best of people are those who learn the Quran and teach it."], ev: ["h bukhari خيركم من تعلم القرآن وعلمه"] },
      { id: "ajr", q: ["ما أجر قراءة القرآن؟", "What is the reward for reading the Quran?"], a: ["لي بكل حرف أقرؤه حسنة، والحسنة بعشر أمثالها.", "For every letter I read I get a good deed, and each good deed is multiplied by ten."], ev: ["h tirmidhi من قرأ حرفا من كتاب الله"] },
      { id: "hifz", q: ["بماذا أبدأ الحفظ؟", "What do I memorise first?"], a: ["أبدأ بسورة الفاتحة، ثم قصار السور: الإخلاص والفلق والناس.", "I start with Surah al-Fatihah, then the short surahs: al-Ikhlas, al-Falaq and an-Nas."], links: [["#/hifz", "hifz.title"], ["#/qaida", "qaida.title"]] },
    ],
    quiz: [
      { q: ["القرآن كلام مَن؟", "Whose speech is the Quran?"], o: [["كلام الله", "The speech of Allah"], ["كلام النبي ﷺ", "The speech of the Prophet ﷺ"], ["كلام الصحابة", "The speech of the Companions"]] },
      { q: ["كم سورة في القرآن؟", "How many surahs are in the Quran?"], o: [["١١٤", "114"], ["٣٠", "30"], ["٦٠", "60"]] },
      { q: ["ما أول سورة في المصحف؟", "What is the first surah in the Mushaf?"], o: [["الفاتحة", "Al-Fatihah"], ["البقرة", "Al-Baqarah"], ["الناس", "An-Nas"]] },
      { q: ["كم حسنة لي بكل حرف أقرؤه؟", "How many good deeds do I get for each letter I read?"], o: [["عشر حسنات", "Ten"], ["حسنة واحدة فقط", "Only one"], ["لا شيء", "None"]] },
    ],
  },
  {
    id: "akhlaq", icon: "people", t: ["أخلاقي وآدابي", "My manners"], s: ["المسلم حسن الخلق", "A Muslim has good character"],
    cards: [
      { id: "parents", q: ["كيف أعامل والديَّ؟", "How do I treat my parents?"], a: ["أطيعهما، وأُحسن إليهما، وأكلّمهما بأدب، وأدعو لهما.", "I obey them, I am good to them, I speak to them politely, and I pray for them."], ev: ["q 17:23", "h bukhari من أحق بحسن صحابتي"] },
      { id: "sidq", q: ["لماذا أَصدُق دائمًا؟", "Why do I always tell the truth?"], a: ["لأن الصدق يهدي إلى البر، والبر يهدي إلى الجنة. والمسلم لا يكذب.", "Because truthfulness leads to goodness, and goodness leads to Paradise. A Muslim does not lie."], ev: ["q 9:119", "h bukhari إن الصدق يهدي إلى البر"] },
      { id: "salam", q: ["كيف أحيّي الناس؟", "How do I greet people?"], a: ["أقول: «السلام عليكم ورحمة الله وبركاته»، وإذا سلّم عليّ أحد قلت: «وعليكم السلام ورحمة الله وبركاته».", "I say: «السلام عليكم ورحمة الله وبركاته» (As-salāmu ʿalaykum wa raḥmatu-llāhi wa barakātuh). When someone greets me, I answer: «وعليكم السلام ورحمة الله وبركاته» (Wa ʿalaykumu-s-salāmu wa raḥmatu-llāhi wa barakātuh)."], ev: ["h muslim أفشوا السلام بينكم"] },
      { id: "food", q: ["ما آداب الطعام؟", "What are the manners of eating?"], a: ["أقول: «بسم الله»، وآكل بيميني، وآكل مما يليني، وأحمد الله إذا فرغت.", "I say «بسم الله» (Bismillāh), I eat with my right hand, I eat from what is in front of me, and I thank Allah when I finish."], ev: ["h bukhari يا غلام سم الله", "d 180"] },
      { id: "sleep", q: ["ماذا أقول عند النوم وعند الاستيقاظ؟", "What do I say when I go to sleep and when I wake up?"], a: ["أنام على جنبي الأيمن وأقول دعاء النوم، وإذا استيقظت حمدت الله.", "I lie on my right side and say the supplication of sleep, and when I wake up I praise Allah."], ev: ["d 105", "d 1"] },
      { id: "sneeze", q: ["ماذا أقول إذا عطست؟", "What do I say when I sneeze?"], a: ["أقول: «الحمد لله». فيقول لي أخي: «يرحمك الله». فأقول: «يهديكم الله ويصلح بالكم».", "I say: «الحمد لله» (Alḥamdulillāh). My brother says to me: «يرحمك الله» (Yarḥamuka-llāh). Then I say: «يهديكم الله ويصلح بالكم» (Yahdīkumu-llāhu wa yuṣliḥu bālakum)."], ev: ["d 188"] },
      { id: "tongue", q: ["كيف أحفظ لساني؟", "How do I guard my tongue?"], a: ["أقول خيرًا أو أسكت؛ فلا أسبّ، ولا أكذب، ولا أسخر من أحد.", "I say what is good or stay silent. I do not swear, lie, or make fun of anyone."], ev: ["h nawawi فليقل خيرا أو ليصمت"] },
      { id: "rahma", q: ["كيف أعامل الناس والحيوان؟", "How do I treat people and animals?"], a: ["أحب لغيري ما أحب لنفسي، وأرحم الصغير، وأحترم الكبير، وأرفق بالحيوان ولا أؤذيه.", "I love for others what I love for myself. I am kind to those younger than me, I respect my elders, and I am gentle with animals and never hurt them."], ev: ["h nawawi حتى يحب لأخيه ما يحب لنفسه", "h bukhari كبد رطبة أجر"] },
      { id: "anger", q: ["ماذا أفعل إذا غضبت؟", "What do I do when I get angry?"], a: ["أستعيذ بالله من الشيطان، وأسكت، ولا أؤذي أحدًا؛ فقد أوصى النبي ﷺ رجلًا فقال: «لا تغضب».", "I seek refuge in Allah from Satan, I stay silent, and I hurt no one. The Prophet ﷺ advised a man: “Do not get angry.”"], ev: ["h nawawi لا تغضب"] },
      { id: "amana", q: ["ما الأمانة؟", "What is trustworthiness (Amanah)?"], a: ["أن أحفظ ما أُعطيت، وأردّ ما استعرت، ولا آخذ ما ليس لي.", "To take care of what I am given, to return what I borrow, and never to take what is not mine."], ev: ["q 4:58"] },
    ],
    quiz: [
      { q: ["بأي يد آكل؟", "Which hand do I eat with?"], o: [["اليمنى", "The right hand"], ["اليسرى", "The left hand"], ["أي يد", "Either hand"]] },
      { q: ["ماذا أقول قبل الطعام؟", "What do I say before eating?"], o: [["بسم الله", "Bismillāh"], ["الله أكبر", "Allāhu akbar"], ["سبحان الله", "Subḥāna-llāh"]] },
      { q: ["ماذا أقول إذا عطست؟", "What do I say when I sneeze?"], o: [["الحمد لله", "Alḥamdulillāh"], ["بسم الله", "Bismillāh"], ["أستغفر الله", "Astaghfiru-llāh"]] },
      { q: ["أيهما يفعله المسلم؟", "Which of these does a Muslim do?"], o: [["يصدق دائمًا", "Always tells the truth"], ["يكذب إذا خاف", "Lies when afraid"], ["يأخذ ما ليس له", "Takes what is not his"]] },
    ],
  },
  {
    id: "dhikr", icon: "beads", t: ["أذكاري ودعائي", "My remembrance and duʿaʾ"], s: ["لساني يذكر الله", "My tongue remembers Allah"],
    cards: [
      { id: "dua", q: ["مَن أدعو؟", "Whom do I call upon?"], a: ["أدعو الله وحده؛ فهو يسمعني ويجيب دعائي.", "I call upon Allah alone. He hears me and answers my prayer."], ev: ["q 40:60"] },
      { id: "help", q: ["بمَن أستعين؟", "Whom do I ask for help?"], a: ["علّم النبي ﷺ ابن عباس وهو غلام: إذا سألت فاسأل الله، وإذا استعنت فاستعن بالله.", "The Prophet ﷺ taught Ibn ʿAbbas when he was a boy: when you ask, ask Allah, and when you seek help, seek help from Allah."], ev: ["h nawawi احفظ الله يحفظك"] },
      { id: "sabah", q: ["ماذا أقول في الصباح والمساء؟", "What do I say in the morning and the evening?"], a: ["أقول أذكار الصباح والمساء ليحفظني الله، ومنها هذا الذكر ثلاث مرات:", "I say the morning and evening adhkar so that Allah protects me. One of them is this, said three times:"], ev: ["d 86"], links: [["#/cat/27", "nav.adhkar"]] },
      { id: "home", q: ["ماذا أقول إذا خرجت من البيت؟", "What do I say when I leave the house?"], a: ["أقول هذا الذكر، وأتوكل على الله:", "I say this remembrance and put my trust in Allah:"], ev: ["d 16"] },
      { id: "tasbih", q: ["ما أحب الكلام إلى الله؟", "Which words does Allah love most?"], a: ["أربع كلمات: «سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر».", "Four phrases: «سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر» (Subḥāna-llāh, wa-l-ḥamdu lillāh, wa lā ilāha illa-llāh, wa-llāhu akbar)."], ev: ["h muslim أحب الكلام إلى الله أربع"], links: [["#/tasbih", "nav.tasbih"]] },
      { id: "tawba", q: ["ماذا أفعل إذا أخطأت؟", "What do I do when I make a mistake?"], a: ["أقول: «أستغفر الله»، وأتوب، ولا أعود إلى الخطأ، وأفعل حسنة بعده؛ فالله غفور رحيم.", "I say «أستغفر الله» (Astaghfiru-llāh), I repent and do not go back to it, and I do a good deed afterwards. Allah is Forgiving and Merciful."], ev: ["q 39:53", "h nawawi وأتبع السيئة الحسنة تمحها"] },
      { id: "salat", q: ["ماذا أقول إذا ذُكر النبي ﷺ؟", "What do I say when the Prophet ﷺ is mentioned?"], a: ["أقول: «صلى الله عليه وسلم»؛ ومن صلى عليه مرة صلى الله عليه بها عشرًا.", "I say: «صلى الله عليه وسلم» (Ṣalla-llāhu ʿalayhi wa sallam). Whoever sends blessings on him once, Allah sends blessings on that person ten times."], ev: ["q 33:56", "h muslim صلى علي واحدة"] },
    ],
    quiz: [
      { q: ["مَن أدعو وأسأل؟", "Whom do I call upon and ask?"], o: [["الله وحده", "Allah alone"], ["الأموات", "The dead"], ["النجوم", "The stars"]] },
      { q: ["ماذا أقول إذا أخطأت؟", "What do I say when I make a mistake?"], o: [["أستغفر الله", "Astaghfiru-llāh"], ["لا أقول شيئًا", "Nothing"], ["أُخفي الخطأ فقط", "I only hide it"]] },
      { q: ["ماذا أقول إذا ذُكر النبي ﷺ؟", "What do I say when the Prophet ﷺ is mentioned?"], o: [["صلى الله عليه وسلم", "Ṣalla-llāhu ʿalayhi wa sallam"], ["سبحان الله", "Subḥāna-llāh"], ["لا أقول شيئًا", "Nothing"]] },
      { q: ["أيّ هذه من أحب الكلام إلى الله؟", "Which of these is among the words Allah loves most?"], o: [["سبحان الله", "Subḥāna-llāh"], ["لا أعرف", "I don't know"], ["أنا متعب", "I am tired"]] },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------------
// يوميات مسلم: the new Muslim's first steps (short lessons), then the day's checklist.
// ---------------------------------------------------------------------------------------------------------------
const steps = [
  {
    id: "welcome", icon: "heart", t: ["مرحبًا بك في الإسلام", "Welcome to Islam"], s: ["بداية جديدة وصفحة بيضاء", "A new beginning and a clean page"],
    secs: [
      { id: "ahlan", h: ["أهلًا بك", "You are welcome here"], p: ["الحمد لله الذي هداك للإسلام. لقد اخترت أن تعبد الله وحده، وصرت أخًا أو أختًا لكل مسلم في الأرض.\nوالإسلام يمحو ما كان قبله من الذنوب؛ فأنت تبدأ اليوم بصفحة بيضاء.", "All praise is for Allah, who guided you to Islam. You have chosen to worship Allah alone, and you are now a brother or sister to every Muslim on earth.\nIslam wipes away the sins that came before it, so today you begin with a clean page."], ev: ["h muslim الإسلام يهدم ما كان قبله", "q 8:38"] },
      { id: "yusr", h: ["خذ دينك بالتدرّج", "Take your religion step by step"], p: ["الإسلام دين يُسر. لا يُطلب منك أن تتعلم كل شيء في يوم واحد. تعلّم الأهم فالأهم، واعمل بما تعلّمت.\nوأحب الأعمال إلى الله ما داوم عليه صاحبه وإن كان قليلًا.", "Islam is a religion of ease. You are not asked to learn everything in one day. Learn the most important things first, and act on what you have learned.\nThe deeds Allah loves most are those done regularly, even if they are small."], ev: ["h bukhari إن الدين يسر", "h bukhari أدومها وإن قل", "q 4:28"] },
      { id: "first", h: ["بماذا أبدأ؟", "Where do I start?"], ol: true, l: ["افهم معنى الشهادتين.\nتعلّم الوضوء والصلاة.\nحافظ على الصلوات الخمس في أوقاتها.\nتعرّف على مسجد قريب وصحبة صالحة.\nاسأل أهل العلم عمّا لا تعرف، ولا تستحِ من السؤال.", "Understand the meaning of the two testimonies of faith.\nLearn wudu and the prayer.\nKeep the five daily prayers at their times.\nFind a nearby mosque and good Muslim company.\nAsk people of knowledge about what you do not know, and never be shy to ask."] },
    ],
    todo: ["قل اليوم من قلبك: «الحمد لله الذي هداني للإسلام».", "Today, say from your heart: “All praise is for Allah, who guided me to Islam.”"],
  },
  {
    id: "shahada", icon: "star", t: ["الشهادتان", "The two testimonies of faith"], s: ["مفتاح الإسلام ومعناه", "The key to Islam and what it means"],
    secs: [
      { id: "text", h: ["نص الشهادتين", "The words of the testimony"], p: ["«أشهد أن لا إله إلا الله، وأشهد أن محمدًا رسول الله»\nبهذه الكلمة يدخل الإنسان في الإسلام إذا قالها بلسانه وصدّق بها قلبه.", "«أشهد أن لا إله إلا الله، وأشهد أن محمدًا رسول الله»\nAsh-hadu an lā ilāha illa-llāh, wa ash-hadu anna Muḥammadan rasūlu-llāh.\n“I bear witness that none has the right to be worshipped but Allah, and I bear witness that Muhammad is the Messenger of Allah.”\nA person enters Islam with these words, saying them with the tongue and believing them in the heart."] },
      { id: "ilah", h: ["معنى «لا إله إلا الله»", "The meaning of «لا إله إلا الله»"], p: ["معناها: لا معبود بحقٍّ إلا الله. فالصلاة والدعاء والذبح والتوكل وكل عبادة لا تكون إلا لله وحده، لا لنبي ولا لملَك ولا لوليّ ولا لقبر ولا لصنم.", "It means: no one has the right to be worshipped except Allah. Prayer, supplication, sacrifice, reliance and every act of worship are for Allah alone: not for a prophet, an angel, a saint, a grave or an idol."], ev: ["q 2:163", "q 47:19"] },
      { id: "rasul", h: ["معنى «محمد رسول الله»", "The meaning of «محمد رسول الله»"], p: ["معناها: أن تصدّقه فيما أخبر، وتطيعه فيما أمر، وتترك ما نهى عنه، وتعبد الله كما علّم.\nوهو ﷺ عبدٌ لله ورسوله: بشرٌ لا يُعبد، ورسولٌ لا يُكذَّب.", "It means: to believe what he told us, to obey what he commanded, to leave what he forbade, and to worship Allah the way he taught.\nHe ﷺ is the servant and Messenger of Allah: a human being who is not worshipped, and a messenger who is not denied."], ev: ["q 18:110", "q 7:158"] },
      { id: "isa", h: ["وماذا عن عيسى عليه السلام؟", "What about Jesus (ʿIsa), peace be upon him?"], p: ["المسلم يحب عيسى ابن مريم عليه السلام ويؤمن به: رسولٌ كريم، وُلد من مريم العذراء بمعجزة من الله. وهو عبد الله ورسوله، وليس إلهًا ولا ابنًا لله.", "A Muslim loves Jesus, son of Mary, peace be upon him, and believes in him: a noble messenger, born of the Virgin Mary by a miracle from Allah. He is the servant and messenger of Allah; he is not God and not the son of God."], ev: ["q 19:30", "q 112:1-4"] },
    ],
    todo: ["احفظ الشهادتين بالعربية وافهم معناهما.", "Memorise the testimony in Arabic and understand its meaning."],
  },
  {
    id: "iman", icon: "asma", t: ["أركان الإيمان الستة", "The six pillars of faith"], s: ["ما يؤمن به المسلم", "What a Muslim believes"],
    secs: [
      { id: "six", h: ["الأركان الستة", "The six pillars"], p: ["سأل جبريلُ عليه السلام النبيَّ ﷺ عن الإيمان، فذكر له ستة أمور:", "Jibril (Gabriel), peace be upon him, asked the Prophet ﷺ about faith (Iman), and he named six things:"], l: ["الإيمان بالله: أنه الرب الخالق، المستحق للعبادة وحده، وله الأسماء الحسنى والصفات العلى.\nالإيمان بالملائكة: خلقٌ من نور يطيعون الله ولا يعصونه.\nالإيمان بالكتب: كالتوراة والإنجيل والزبور، وآخرها القرآن المحفوظ.\nالإيمان بالرسل: من نوح وإبراهيم وموسى وعيسى إلى خاتمهم محمد ﷺ.\nالإيمان باليوم الآخر: البعث بعد الموت، والحساب، والجنة والنار.\nالإيمان بالقدر خيره وشره: أن كل شيء بعلم الله ومشيئته.", "Belief in Allah: He is the Lord and Creator, He alone deserves worship, and His are the most beautiful names and the highest attributes.\nBelief in the angels: beings created from light, who obey Allah and never disobey Him.\nBelief in the books: such as the Torah, the Gospel and the Psalms, and the last of them, the preserved Quran.\nBelief in the messengers: from Noah, Abraham, Moses and Jesus to the last of them, Muhammad ﷺ.\nBelief in the Last Day: resurrection after death, the reckoning, Paradise and Hell.\nBelief in the divine decree (Qadar), its good and its bad: everything happens by Allah's knowledge and will."], ev: ["h nawawi أن تؤمن بالله وملائكته", "q 2:285"] },
      { id: "allah", h: ["أعرف ربي بأسمائه", "Knowing my Lord by His names"], p: ["كلما عرفت الله أكثر أحببته أكثر. تعرّف على أسمائه الحسنى ومعانيها: الرحمن، الغفور، السميع، القريب.", "The more you know Allah, the more you love Him. Get to know His most beautiful names and their meanings: the Most Merciful, the Forgiving, the All-Hearing, the Near."], links: [["#/asma", "asma.title"]] },
      { id: "qadar", h: ["الإيمان يطمئن القلب", "Faith brings peace to the heart"], p: ["المؤمن يعلم أن ما أصابه لم يكن ليخطئه؛ فيشكر عند النعمة، ويصبر عند المصيبة، ولا ييأس من رحمة الله.", "A believer knows that what has reached him was never going to miss him. So he is grateful in times of ease, patient in times of hardship, and never despairs of the mercy of Allah."], ev: ["q 13:28"] },
    ],
    todo: ["عدِّد أركان الإيمان الستة من حفظك.", "Name the six pillars of faith from memory."],
  },
  {
    id: "islam", icon: "kaaba", t: ["أركان الإسلام الخمسة", "The five pillars of Islam"], s: ["ما يعمله المسلم", "What a Muslim practises"],
    secs: [
      { id: "five", h: ["بُني الإسلام على خمس", "Islam is built on five"], l: ["الشهادتان: أن تشهد أن لا إله إلا الله وأن محمدًا رسول الله.\nالصلاة: خمس صلوات في اليوم والليلة.\nالزكاة: حق معلوم في مال الغني يُعطى للفقراء.\nصوم رمضان: شهر واحد في السنة.\nالحج: مرة في العمر لمن استطاع.", "The two testimonies: to testify that none has the right to be worshipped but Allah and that Muhammad is the Messenger of Allah.\nThe prayer: five prayers each day and night.\nZakah: a fixed share of the wealth of the rich, given to the poor.\nFasting Ramadan: one month each year.\nHajj: the pilgrimage, once in a lifetime for those who are able."], ev: ["h nawawi بني الإسلام على خمس"] },
      { id: "order", h: ["الصلاة أولًا", "The prayer comes first"], p: ["أول ما تبدأ به بعد الشهادتين: الصلاة؛ فهي صلتك بربك خمس مرات كل يوم. أما الزكاة والصوم والحج فلها أوقاتها وشروطها، وستتعلمها حين يأتي وقتها.", "After the testimony, the first thing to begin with is the prayer: it is your connection with your Lord five times every day. Zakah, fasting and Hajj have their own times and conditions, and you will learn them when their time comes."], ev: ["q 29:45"] },
    ],
    todo: ["اقرأ الخطوتين التاليتين (الطهارة والصلاة) هذا الأسبوع.", "Read the next two steps (purification and prayer) this week."],
  },
  {
    id: "tahara", icon: "cloud", t: ["الطهارة: الغُسل والوضوء", "Purification: ghusl and wudu"], s: ["مفتاح الصلاة", "The key to prayer"],
    secs: [
      { id: "ghusl", h: ["الغُسل", "Ghusl (the full bath)"], p: ["يُشرع لمن دخل في الإسلام أن يغتسل. والغسل: أن تنوي بقلبك، ثم تعمّ جسدك كله بالماء، مع المضمضة والاستنشاق.\nويجب الغسل كذلك بعد الجنابة (الجماع أو نزول المني)، وعلى المرأة بعد انتهاء الحيض والنفاس.", "It is prescribed for the one who enters Islam to take a full bath (ghusl). Ghusl means to intend it in your heart, then wash your whole body with water, rinsing the mouth and the nose as well.\nGhusl is also required after sexual intercourse or the release of semen, and for a woman when her menstrual or post-natal bleeding ends."], ev: ["h abudawud فأمرني أن أغتسل بماء وسدر"] },
      { id: "wudu", h: ["الوضوء", "Wudu (ablution)"], p: ["لا تصح الصلاة إلا بوضوء. وصفته:", "Prayer is not valid without wudu. This is how it is done:"], ol: true, l: ["انوِ الوضوء بقلبك، وقل: «بسم الله».\nاغسل كفّيك ثلاث مرات.\nتمضمض واستنشق ثلاث مرات.\nاغسل وجهك ثلاث مرات.\nاغسل يديك إلى المرفقين ثلاث مرات، اليمنى ثم اليسرى.\nامسح رأسك كله مرة واحدة، وامسح أذنيك.\nاغسل رجليك إلى الكعبين ثلاث مرات، اليمنى ثم اليسرى.", "Intend wudu in your heart and say: «بسم الله» (Bismillāh).\nWash your hands three times.\nRinse your mouth and your nose three times.\nWash your face three times.\nWash your arms up to the elbows three times, the right and then the left.\nWipe your whole head once, and wipe your ears.\nWash your feet up to the ankles three times, the right and then the left."], ev: ["q 5:6", "h bukhari من توضأ نحو وضوئي هذا", "d 13"] },
      { id: "breaks", h: ["ما ينقض الوضوء", "What breaks wudu"], p: ["ينتقض الوضوء بأمور، منها: خروج البول أو الغائط أو الريح، والنوم العميق، وزوال العقل. فإذا حدث شيء من ذلك فتوضأ قبل الصلاة.\nالغسلة الواحدة لكل عضو تكفي، والثلاث أفضل.", "Wudu is broken by several things, among them: passing urine, stool or wind, deep sleep, and loss of consciousness. If any of these happens, make wudu again before you pray.\nWashing each part once is enough; three times is better."], ev: ["h bukhari لا تقبل صلاة من أحدث حتى يتوضأ"] },
      { id: "clean", h: ["طهارة البدن والثوب والمكان", "A clean body, clothes and place"], p: ["بعد قضاء الحاجة نظّف الموضع بالماء. وصلِّ بثوب طاهر، في مكان طاهر.", "After using the toilet, clean yourself with water. Pray in clean clothes and in a clean place."], ev: ["h nawawi الطهور شطر الإيمان"] },
    ],
    todo: ["توضأ الآن خطوة خطوة وهذه الصفحة أمامك.", "Make wudu now, step by step, with this page in front of you."],
  },
  {
    id: "times", icon: "prayer", t: ["الصلوات الخمس وأوقاتها", "The five prayers and their times"], s: ["موعدك مع ربك كل يوم", "Your daily appointments with your Lord"],
    secs: [
      { id: "five", h: ["خمس صلوات", "Five prayers"], p: ["فرض الله على كل مسلم خمس صلوات في اليوم والليلة، لكل صلاة وقت وعدد من الركعات:", "Allah has made five prayers obligatory for every Muslim each day and night. Each has its time and its number of rakʿahs (units):"], l: ["الفجر: ركعتان، من طلوع الفجر إلى شروق الشمس.\nالظهر: أربع ركعات، بعد زوال الشمس عن وسط السماء.\nالعصر: أربع ركعات، في آخر النهار قبل الغروب.\nالمغرب: ثلاث ركعات، بعد غروب الشمس.\nالعشاء: أربع ركعات، بعد ذهاب حمرة الأفق.", "Fajr: two rakʿahs, from dawn until sunrise.\nDhuhr: four rakʿahs, after the sun passes its highest point.\nAsr: four rakʿahs, in the late afternoon before sunset.\nMaghrib: three rakʿahs, just after sunset.\nIsha: four rakʿahs, after the red glow has left the horizon."], ev: ["q 4:103", "h bukhari لو أن نهرا بباب أحدكم"], links: [["#/prayer", "prayer.title"]] },
      { id: "shurut", h: ["قبل أن تصلي", "Before you pray"], l: ["أن يدخل وقت الصلاة.\nأن تكون على وضوء.\nأن يكون بدنك وثوبك ومكانك طاهرًا.\nأن تستر عورتك بلباس ساتر.\nأن تستقبل القبلة (جهة الكعبة في مكة).", "The time of the prayer has begun.\nYou have wudu.\nYour body, clothes and place are clean.\nYou are properly covered.\nYou face the qiblah (the direction of the Kaʿbah in Makkah)."], links: [["#/qibla", "qibla.title"]] },
      { id: "jumua", h: ["صلاة الجمعة", "The Friday prayer"], p: ["يوم الجمعة يصلي الرجال في المسجد صلاة الجمعة بدل الظهر: خطبة ثم ركعتان مع الإمام.", "On Friday, men pray the Friday prayer (Jumuʿah) in the mosque in place of Dhuhr: a sermon, then two rakʿahs with the imam."], ev: ["q 62:9"] },
      { id: "miss", h: ["إذا فاتتك صلاة", "If you miss a prayer"], p: ["إذا نمت عن صلاة أو نسيتها فصلِّها حين تذكرها. ولا تترك الصلاة مهما قصّرت؛ فهي أول ما تعود به إلى الله.", "If you sleep through a prayer or forget it, pray it as soon as you remember. Never give up the prayer, whatever your shortcomings: it is the first thing that brings you back to Allah."], ev: ["h bukhari من نسي صلاة فليصل إذا ذكرها", "q 11:114"] },
    ],
    todo: ["حدّد مدينتك في مواقيت الصلاة وفعّل التنبيه.", "Set your city in the prayer times and turn on the alerts."],
  },
  {
    id: "pray", icon: "prayer", t: ["كيف أصلّي؟", "How do I pray?"], s: ["الصلاة خطوة بخطوة", "The prayer, step by step"],
    secs: [
      { id: "raka", h: ["الركعة الأولى", "The first rakʿah"], ol: true, l: ["قف مستقبلًا القبلة، وانوِ الصلاة بقلبك.\nارفع يديك وقل: «الله أكبر».\nضع يدك اليمنى على اليسرى على صدرك، واقرأ سورة الفاتحة، ثم سورة قصيرة مثل سورة الإخلاص.\nقل «الله أكبر» واركع: اجعل ظهرك مستويًا ويديك على ركبتيك، وقل ثلاث مرات: «سبحان ربي العظيم».\nارفع من الركوع قائلًا: «سمع الله لمن حمده»، فإذا اعتدلت قائمًا فقل: «ربنا ولك الحمد».\nقل «الله أكبر» واسجد على سبعة أعضاء: الجبهة مع الأنف، والكفّين، والركبتين، وأطراف القدمين، وقل ثلاث مرات: «سبحان ربي الأعلى».\nقل «الله أكبر» واجلس، وقل: «ربِّ اغفر لي».\nقل «الله أكبر» واسجد السجدة الثانية كالأولى. بهذا تمّت ركعة.", "Stand facing the qiblah and intend the prayer in your heart.\nRaise your hands and say: «الله أكبر» (Allāhu akbar: “Allah is the Greatest”).\nPlace your right hand over your left on your chest. Recite Surah al-Fatihah, then a short surah such as al-Ikhlas.\nSay «الله أكبر» and bow (rukūʿ): back level, hands on your knees. Say three times: «سبحان ربي العظيم» (Subḥāna rabbiya-l-ʿaẓīm: “Glory be to my Lord, the Most Great”).\nRise from bowing saying: «سمع الله لمن حمده» (Samiʿa-llāhu liman ḥamidah). When you are standing straight, say: «ربنا ولك الحمد» (Rabbanā wa laka-l-ḥamd: “Our Lord, to You belongs all praise”).\nSay «الله أكبر» and prostrate (sujūd) on seven parts: the forehead with the nose, both palms, both knees and the toes of both feet. Say three times: «سبحان ربي الأعلى» (Subḥāna rabbiya-l-aʿlā: “Glory be to my Lord, the Most High”).\nSay «الله أكبر» and sit. Say: «ربِّ اغفر لي» (Rabbi-ghfir lī: “My Lord, forgive me”).\nSay «الله أكبر» and prostrate a second time, like the first. This completes one rakʿah."], ev: ["h bukhari صلوا كما رأيتموني أصلي", "h bukhari لا صلاة لمن لم يقرأ بفاتحة الكتاب", "d 33", "d 38", "d 39", "d 41", "d 48"] },
      { id: "rest", h: ["بقية الصلاة", "The rest of the prayer"], ol: true, l: ["قم للركعة الثانية وافعل فيها كما فعلت في الأولى.\nبعد السجدة الثانية من الركعة الثانية اجلس واقرأ التشهد.\nإن كانت الصلاة ركعتين (الفجر): فأكمل بالصلاة على النبي ﷺ ثم سلّم.\nإن كانت ثلاثًا أو أربعًا: فقم بعد التشهد الأول وأكمل الركعات الباقية، تقرأ في كل منها الفاتحة فقط، ثم اجلس للتشهد الأخير.\nفي التشهد الأخير اقرأ التشهد ثم الصلاة على النبي ﷺ.\nسلّم عن يمينك: «السلام عليكم ورحمة الله»، ثم عن يسارك كذلك.", "Stand for the second rakʿah and do in it as you did in the first.\nAfter the second prostration of the second rakʿah, sit and recite the tashahhud.\nIf the prayer has two rakʿahs (Fajr): continue with the blessings on the Prophet ﷺ, then say the salam.\nIf it has three or four: stand after the first tashahhud and complete the remaining rakʿahs, reciting only al-Fatihah in each, then sit for the final tashahhud.\nIn the final sitting, recite the tashahhud, then the blessings on the Prophet ﷺ.\nTurn your head to the right and say: «السلام عليكم ورحمة الله» (As-salāmu ʿalaykum wa raḥmatu-llāh), then to the left and say the same."], ev: ["d 52", "d 53"] },
      { id: "new", h: ["إن لم أحفظ الفاتحة بعد", "If I have not memorised al-Fatihah yet"], p: ["لا تؤخر الصلاة حتى تحفظ. صلِّ الآن، وقل في القيام ما علّمه النبي ﷺ لرجل لم يستطع أن يحفظ شيئًا من القرآن: «سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر، ولا حول ولا قوة إلا بالله».\nواجتهد في حفظ الفاتحة سريعًا، وصلِّ مع الجماعة في المسجد ما استطعت؛ فمتابعة الإمام تعلّمك الصلاة.", "Do not delay the prayer until you have memorised it. Pray now, and while standing say what the Prophet ﷺ taught a man who could not yet learn any of the Quran: «سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر، ولا حول ولا قوة إلا بالله» (Subḥāna-llāh, wa-l-ḥamdu lillāh, wa lā ilāha illa-llāh, wa-llāhu akbar, wa lā ḥawla wa lā quwwata illā billāh).\nWork on memorising al-Fatihah soon, and pray in congregation at the mosque when you can: following the imam teaches you the prayer."], ev: ["h abudawud لا أستطيع أن آخذ من القرآن شيئا"], links: [["#/arabic/surah/1", "arabic.title"], ["#/hifz", "hifz.title"]] },
      { id: "women", h: ["للنساء", "For women"], p: ["صلاة المرأة كصلاة الرجل. ولا تصلي المرأة أيام الحيض والنفاس، ولا تقضي ما فاتها من الصلاة فيها.", "A woman prays just as a man prays. She does not pray during her menstrual or post-natal bleeding, and she does not make up the prayers of those days."] },
    ],
    todo: ["صلِّ الصلاة القادمة وهذه الصفحة أمامك.", "Pray the next prayer with this page in front of you."],
    links: [["#/cat/16", "nav.adhkar"]],
  },
  {
    id: "quran", icon: "quran", t: ["أنا والقرآن", "The Quran and me"], s: ["كلام الله إليك", "The words of Allah to you"],
    secs: [
      { id: "what", h: ["ما القرآن؟", "What is the Quran?"], p: ["القرآن كلام الله، أنزله على نبيه محمد ﷺ باللغة العربية، وحفظه من التغيير. فيه الهداية والشفاء وطمأنينة القلب.", "The Quran is the speech of Allah. He revealed it to His Prophet Muhammad ﷺ in Arabic and has protected it from any change. In it are guidance, healing and peace of heart."], ev: ["q 38:29", "q 17:9"] },
      { id: "meaning", h: ["اقرأ معانيه بلغتك", "Read its meanings in your language"], p: ["اقرأ كل يوم شيئًا من ترجمة معاني القرآن بلغتك ولو صفحة واحدة. الترجمة تشرح المعنى، أما القرآن نفسه فهو النص العربي.", "Every day, read some of the translation of the meanings of the Quran in your language, even one page. A translation explains the meaning; the Quran itself is the Arabic text."], links: [["#/quran", "nav.quran"], ["#/listen", "listen.recitations"]] },
      { id: "learn", h: ["تعلّم القراءة بالعربية", "Learn to read it in Arabic"], p: ["تعلّم الحروف العربية ثم القراءة شيئًا فشيئًا. ومن يقرأ القرآن وهو عليه شاقّ فله أجران.", "Learn the Arabic letters, then learn to read little by little. Whoever reads the Quran while finding it difficult has two rewards."], ev: ["h muslim ويتتعتع فيه"], links: [["#/qaida", "qaida.title"], ["#/arabic", "arabic.title"]] },
      { id: "hifz", h: ["احفظ ما تصلي به", "Memorise what you pray with"], p: ["ابدأ بحفظ سورة الفاتحة، ثم قصار السور: الإخلاص والفلق والناس. كرّر الآية مع القارئ حتى تثبت.", "Begin by memorising Surah al-Fatihah, then the short surahs: al-Ikhlas, al-Falaq and an-Nas. Repeat each verse with the reciter until it stays."], ev: ["h bukhari خيركم من تعلم القرآن وعلمه"], links: [["#/hifz", "hifz.title"]] },
    ],
    todo: ["اقرأ اليوم ترجمة معاني سورة الفاتحة.", "Today, read the translation of the meanings of Surah al-Fatihah."],
  },
  {
    id: "worship", icon: "calendar", t: ["الصيام والزكاة والحج", "Fasting, zakah and Hajj"], s: ["عبادات لها مواسمها", "Acts of worship with their seasons"],
    secs: [
      { id: "sawm", h: ["صوم رمضان", "Fasting Ramadan"], p: ["في شهر رمضان يمسك المسلم عن الطعام والشراب والجماع من طلوع الفجر إلى غروب الشمس، طاعةً لله.\nويُفطر المريض والمسافر ثم يقضيان، وتُفطر الحائض وتقضي. وإن جاء رمضان وأنت حديث عهد بالإسلام فصُم ما استطعت واسأل أهل العلم عمّا يشكل عليك.", "In the month of Ramadan a Muslim refrains from food, drink and marital relations from dawn until sunset, in obedience to Allah.\nThe sick and the traveller may break the fast and make it up later; a menstruating woman does not fast and makes it up later. If Ramadan comes while you are new to Islam, fast as much as you can and ask people of knowledge about anything that is unclear."], ev: ["q 2:183", "h bukhari من صام رمضان إيمانا واحتسابا"], links: [["#/hijri", "hijri.title"]] },
      { id: "zakah", h: ["الزكاة", "Zakah"], p: ["من ملك مالًا يبلغ النصاب ومرّ عليه عام هجري كامل أخرج منه ربع العشر (٢٫٥٪) للفقراء والمحتاجين. فإن لم يبلغ مالك النصاب فلا زكاة عليك، والصدقة باب مفتوح دائمًا.", "Whoever owns wealth above a set minimum (the nisab) for a full lunar year gives one fortieth of it (2.5%) to the poor and needy. If your wealth is below the nisab, no zakah is due from you, and voluntary charity is always open to you."], ev: ["q 2:43"] },
      { id: "hajj", h: ["الحج", "Hajj"], p: ["الحج إلى بيت الله الحرام في مكة واجب مرة واحدة في العمر على من استطاع ببدنه وماله.", "The pilgrimage to the House of Allah in Makkah is obligatory once in a lifetime for whoever is able, in health and in means."], ev: ["q 3:97"] },
    ],
    todo: ["اعرف كم بقي على شهر رمضان من التقويم الهجري.", "Check the Hijri calendar to see how far away Ramadan is."],
  },
  {
    id: "halal", icon: "food", t: ["الحلال والحرام", "The lawful and the forbidden"], s: ["حياة طيبة نظيفة", "A good and clean life"],
    secs: [
      { id: "asl", h: ["الأصل الإباحة", "Most things are lawful"], p: ["أحلّ الله لنا الطيبات كلها، وحرّم أشياء قليلة لأنها تضرّنا. فالأصل في الطعام والشراب واللباس والمعاملات أنها حلال، إلا ما جاء النص بتحريمه.", "Allah has made all good things lawful for us, and has forbidden a few things because they harm us. Food, drink, clothing and dealings are lawful in principle, except what the texts have forbidden."], ev: ["h nawawi الحلال بين"] },
      { id: "food", h: ["في الطعام والشراب", "In food and drink"], p: ["يحرم: لحم الخنزير، والميتة، والدم، وما ذُبح لغير الله، والخمر وكل مسكر، والمخدرات.", "Forbidden are: pork, the meat of animals that died without being slaughtered, blood, what was sacrificed to other than Allah, wine and every intoxicant, and drugs."], ev: ["q 2:173", "q 5:90", "h muslim كل مسكر خمر"] },
      { id: "kabair", h: ["كبائر يتركها المسلم", "Major sins a Muslim leaves"], p: ["أعظمها الشرك بالله، ثم: السحر والذهاب إلى العرّافين، والقتل، والزنا، والربا، والسرقة، والقمار، وعقوق الوالدين، والكذب والغيبة.", "The greatest is associating others with Allah (shirk). Then: magic and going to fortune-tellers, murder, sexual relations outside marriage, interest (riba), theft, gambling, mistreating parents, lying and backbiting."], ev: ["h bukhari اجتنبوا السبع الموبقات"] },
      { id: "tawba", h: ["إذا وقعتَ في ذنب", "If you fall into a sin"], p: ["كل ابن آدم يخطئ. إذا أذنبت فاستغفر الله وتُب إليه، ولا تيأس من رحمته، ولا تترك صلاتك بسبب ذنب.\nوإن كانت عندك عادة قديمة محرّمة فاتركها لله، واستعن به، واطلب العون من إخوانك.", "Every human being makes mistakes. If you sin, ask Allah for forgiveness and turn back to Him. Do not despair of His mercy, and do not abandon your prayer because of a sin.\nIf you have an old habit that is forbidden, leave it for the sake of Allah, ask Him for help, and seek support from your brothers and sisters."], ev: ["q 39:53", "q 25:70"] },
    ],
    todo: ["اختر عادة واحدة تتركها لله من اليوم.", "Choose one habit to give up for the sake of Allah, starting today."],
  },
  {
    id: "people", icon: "people", t: ["أهلي والناس من حولي", "My family and the people around me"], s: ["أخلاقك أجمل دعوة", "Your character is the best invitation"],
    secs: [
      { id: "family", h: ["أهلك غير المسلمين", "Your non-Muslim family"], p: ["إسلامك يزيدك برًّا بوالديك وإحسانًا إلى أهلك. أحسن إليهم، وزُرهم، وساعدهم، واصبر عليهم. ولا تطعهم فقط إن أمروك بمعصية الله.\nوحُسن خلقك معهم أبلغ من كثير من الكلام.", "Your Islam makes you kinder and more dutiful to your parents and family. Be good to them, visit them, help them and be patient with them. Only do not obey them if they tell you to disobey Allah.\nYour good character with them says more than many words."], ev: ["q 31:15", "q 60:8", "h bukhari صلي أمك"] },
      { id: "suhba", h: ["صحبة صالحة ومسجد قريب", "Good company and a nearby mosque"], p: ["الإنسان يتأثر بمن يصاحب. ابحث عن مسجد أو مركز إسلامي قريب، وتعرّف على مسلمين صالحين يعينونك ويعلّمونك.", "A person is influenced by the company he keeps. Look for a nearby mosque or Islamic centre, and get to know good Muslims who will support you and teach you."], ev: ["h abudawud على دين خليله"] },
      { id: "sabr", h: ["إن آذاك أحد", "If someone hurts you"], p: ["قد يستغرب بعض الناس إسلامك أو يؤذيك بكلمة. قابل الإساءة بالإحسان، ولا تجادل فيما لم تتعلمه بعد، وقل: «لا أعلم، سأسأل».", "Some people may find your Islam strange, or hurt you with a word. Answer harm with good. Do not argue about what you have not yet learned; simply say: “I do not know, I will ask.”"], ev: ["q 41:34"] },
      { id: "name", h: ["هل أغيّر اسمي؟", "Do I have to change my name?"], p: ["لا يلزمك تغيير اسمك إلا إذا كان معناه يخالف الإسلام. وما أشكل عليك من أمور حياتك الخاصة فاسأل عنه عالمًا تثق به.", "You do not have to change your name unless its meaning goes against Islam. For anything unclear in your personal life, ask a scholar you trust."] },
    ],
    todo: ["اصنع اليوم معروفًا لأحد من أهلك.", "Do a kindness for someone in your family today."],
  },
  {
    id: "thabat", icon: "bookmark", t: ["الثبات والاستمرار", "Staying firm"], s: ["يومًا بعد يوم حتى تلقى الله", "Day after day, until you meet Allah"],
    secs: [
      { id: "iman", h: ["الإيمان يزيد وينقص", "Faith rises and falls"], p: ["الإيمان يزيد بالطاعة وينقص بالمعصية. فإذا أحسست بفتور فلا تقلق: جدّد إيمانك بالصلاة، والقرآن، وذكر الله، وصحبة الصالحين.", "Faith increases with obedience and decreases with sin. If you feel your energy fading, do not worry: renew your faith with prayer, the Quran, the remembrance of Allah and the company of good people."], ev: ["q 13:28", "h nawawi قل آمنت بالله ثم استقم"] },
      { id: "dua", h: ["دعاء الثبات", "A supplication for firmness"], p: ["كان النبي ﷺ يكثر أن يدعو: «يا مقلّب القلوب ثبّت قلبي على دينك».", "The Prophet ﷺ often used to supplicate: «يا مقلّب القلوب ثبّت قلبي على دينك» (Yā muqalliba-l-qulūb, thabbit qalbī ʿalā dīnik: “O Turner of hearts, keep my heart firm on Your religion”)."], ev: ["h tirmidhi يا مقلب القلوب ثبت قلبي على دينك", "q 3:8"] },
      { id: "ilm", h: ["تعلّم كل يوم شيئًا", "Learn something every day"], p: ["اطلب العلم من مصادره الموثوقة، وخذه من أهله. اقرأ كل يوم حديثًا من الأربعين النووية، وصفحة من ترجمة معاني القرآن.", "Seek knowledge from trustworthy sources and from its people. Each day read one hadith from the Forty Hadith of an-Nawawi and one page of the translation of the meanings of the Quran."], ev: ["h muslim من سلك طريقا يلتمس فيه علما", "q 20:114"], links: [["#/hadith/nawawi", "hadith.books"]] },
      { id: "waswas", h: ["إذا جاءتك شكوك", "If doubts come to you"], p: ["قد تخطر بالقلب وساوس وأسئلة. استعذ بالله من الشيطان، وقل: «آمنت بالله»، واسأل أهل العلم عمّا يحيّرك؛ فالسؤال شفاء.", "Whispers and questions may cross the heart. Seek refuge in Allah from Satan, say «آمنت بالله» (Āmantu billāh: “I believe in Allah”), and ask people of knowledge about what troubles you: asking is the cure."], ev: ["h muslim فليقل آمنت بالله"], links: [["#/cat/40", "nav.adhkar"]] },
      { id: "daily", h: ["اجعل لك وِردًا يوميًّا", "Keep a daily routine"], p: ["استعمل صفحة «يومي» كل يوم: ابدأ بالأساسيات، ثم زِد شيئًا فشيئًا. قليلٌ دائم خيرٌ من كثير منقطع.", "Use the “My day” page every day: begin with the essentials, then add little by little. A little that lasts is better than a lot that stops."], links: [["#/muslim/day", "@ui.myDay"]] },
    ],
    todo: ["ادعُ الله اليوم في سجودك أن يثبّتك على دينه.", "Today, in your prostration, ask Allah to keep you firm on His religion."],
  },
];

// The day of a Muslim, in the order of the day. lv: 1 the essentials, 2 more, 3 the full day.
const day = [
  { id: "fajr", icon: "fajr", t: ["الفجر والصباح", "Dawn and morning"], items: [
    { id: "wake", lv: 2, t: ["ذكر الاستيقاظ من النوم", "The remembrance on waking up"], href: "#/cat/1" },
    { id: "fajr", lv: 1, t: ["صلاة الفجر", "The Fajr prayer"], x: ["ركعتان", "Two rakʿahs"], href: "#/prayer" },
    { id: "sabah", lv: 2, t: ["أذكار الصباح", "The morning adhkar"], href: "#/cat/27?p=morning" },
    { id: "quran", lv: 2, t: ["قراءة شيء من القرآن أو ترجمة معانيه", "Reading some of the Quran or of its meanings"], x: ["ولو صفحة واحدة", "Even one page"], href: "#/quran" },
  ] },
  { id: "day", icon: "sun", t: ["النهار", "Daytime"], items: [
    { id: "dhuhr", lv: 1, t: ["صلاة الظهر", "The Dhuhr prayer"], x: ["أربع ركعات", "Four rakʿahs"], href: "#/prayer" },
    { id: "food", lv: 2, t: ["«بسم الله» قبل الطعام و«الحمد لله» بعده", "“Bismillāh” before eating and “Alḥamdulillāh” after"], href: "#/cat/69" },
    { id: "learn", lv: 1, t: ["تعلّمت شيئًا جديدًا عن ديني", "I learned something new about my religion"], x: ["خطوة من «خطواتي الأولى»", "A step from “My first steps”"], href: "#/muslim" },
    { id: "asr", lv: 1, t: ["صلاة العصر", "The Asr prayer"], x: ["أربع ركعات", "Four rakʿahs"], href: "#/prayer" },
    { id: "khayr", lv: 3, t: ["عمل خير: صدقة أو مساعدة أو كلمة طيبة", "A good deed: charity, help or a kind word"] },
    { id: "arabic", lv: 3, t: ["تعلّمت كلمات من القرآن أو درسًا في القراءة", "I learned some Quran words or a reading lesson"], href: "#/arabic" },
  ] },
  { id: "evening", icon: "dusk", t: ["المساء", "Evening"], items: [
    { id: "maghrib", lv: 1, t: ["صلاة المغرب", "The Maghrib prayer"], x: ["ثلاث ركعات", "Three rakʿahs"], href: "#/prayer" },
    { id: "masa", lv: 2, t: ["أذكار المساء", "The evening adhkar"], href: "#/cat/27?p=evening" },
    { id: "isha", lv: 1, t: ["صلاة العشاء", "The Isha prayer"], x: ["أربع ركعات", "Four rakʿahs"], href: "#/prayer" },
    { id: "dhikr", lv: 3, t: ["الأذكار بعد الصلوات", "The adhkar after the prayers"], href: "#/cat/25" },
    { id: "sunan", lv: 3, t: ["السنن الرواتب والوتر", "The regular Sunnah prayers and Witr"] },
  ] },
  { id: "night", icon: "moon", t: ["قبل النوم", "Before sleep"], items: [
    { id: "muhasaba", lv: 2, t: ["راجعت يومي واستغفرت الله", "I looked back on my day and asked Allah for forgiveness"] },
    { id: "nawm", lv: 2, t: ["أذكار النوم", "The adhkar before sleeping"], href: "#/cat/28" },
  ] },
];

// Words of the two pages themselves (not lessons). {n}/{total}… are filled by the app.
const ui = {
  // names in the app's menu (copied into www/i18n by scripts/build-guide.js)
  "menu.kids": ["ركن الأطفال", "Kids' corner"],
  "menu.muslim": ["يوميات مسلم", "A Muslim's day"],

  "ui.translated": ["هذه الدروس تُرجمت بمساعدة الحاسوب عن أصلها العربي، وقد يكون فيها خطأ. نصوص القرآن والأحاديث والأذكار منقولة من مصادرها كما هي.", "These lessons were translated with computer assistance from the Arabic original and may contain mistakes. The texts of the Quran, the hadith and the adhkar are copied from their sources unchanged."],
  "ui.sourceNote": ["الشرح من إعداد التطبيق، والأدلة منقولة من مصادرها: الآيات من المصحف، والأحاديث من كتب السنة في التطبيق، والأذكار من «حصن المسلم».", "The explanations were written for this app. The evidence is copied from its sources: verses from the Quran, hadith from the hadith books in the app, and adhkar from “Hisn al-Muslim” (Fortress of the Muslim)."],
  "ui.evidence": ["الدليل", "Evidence"],
  "ui.hadithIn": ["الحديث في {book}، رقم {n}", "The hadith in {book}, no. {n}"],
  "ui.openVerse": ["{surah}، الآية {n}", "{surah}, verse {n}"],
  "ui.openVerses": ["{surah}، الآيات {from}–{to}", "{surah}, verses {from}–{to}"],
  "ui.dhikr": ["من حصن المسلم", "From Hisn al-Muslim"],
  "ui.englishOnly": ["الترجمة الرسمية للذكر بالإنجليزية", "Official English translation of the dhikr"],
  "ui.times": ["التكرار: {n}", "Repeat: {n}"],
  "ui.seeAlso": ["في التطبيق", "In the app"],
  "ui.prayGuide": ["الصلاة خطوة بخطوة", "The prayer, step by step"],
  "ui.myDay": ["يومي", "My day"],
  "ui.books": ["كتب موثوقة بلغتك", "Trusted books in your language"],
  "ui.booksNote": ["كتب مراجَعة من موقع «دار الإسلام» (IslamHouse.com)، تُفتح خارج التطبيق.", "Reviewed books from IslamHouse.com. They open outside the app."],
  "ui.pdf": ["ملف PDF", "PDF file"],

  // kids
  "ui.kidsIntro": ["أسئلة قصيرة وأجوبة سهلة، مع الدليل من القرآن والسنة. اقرأ، ثم اختبر نفسك واجمع النجوم!", "Short questions and easy answers, with evidence from the Quran and the Sunnah. Read, then test yourself and collect the stars!"],
  "ui.parents": ["للوالدين والمربّين", "For parents and teachers"],
  "ui.parentsText": ["اقرؤوا السؤال مع الطفل ودعوه يجيب قبل أن يرى الجواب. وحدة واحدة في الجلسة تكفي، مع التكرار في الأيام التالية.\nاربطوا كل معلومة بحياته: الوضوء عند الوضوء، وآداب الطعام على المائدة. والقدوة أبلغ من الكلام.\nالوحدات مرتبة من العقيدة إلى العبادة ثم الأخلاق والأذكار، وتناسب الأطفال من نحو خمس سنوات مع والديهم.", "Read the question with the child and let them answer before seeing the answer. One unit per sitting is enough, repeated over the following days.\nConnect each point to daily life: wudu at wudu time, eating manners at the table. Your example speaks louder than words.\nThe units go from belief to worship, then manners and remembrance, and suit children from about five years old together with their parents."],
  "ui.units": ["الوحدات", "Units"],
  "ui.unitN": ["الوحدة {n}", "Unit {n}"],
  "ui.cardsCount": ["الأسئلة: {n}", "Questions: {n}"],
  "ui.stars": ["النجوم: {n} من {total}", "Stars: {n} of {total}"],
  "ui.question": ["سؤال", "Question"],
  "ui.showAnswer": ["أظهر الجواب", "Show the answer"],
  "ui.showAll": ["أظهر كل الأجوبة", "Show all answers"],
  "ui.hideAll": ["أخفِ الأجوبة", "Hide the answers"],
  "ui.quiz": ["اختبر نفسك", "Test yourself"],
  "ui.quizHint": ["اختر الجواب الصحيح.", "Choose the right answer."],
  "ui.quizStart": ["ابدأ الاختبار", "Start the quiz"],
  "ui.quizOf": ["السؤال {n} من {total}", "Question {n} of {total}"],
  "ui.right": ["أحسنت! جواب صحيح", "Well done! That is right"],
  "ui.wrong": ["حاول مرة أخرى", "Try again"],
  "ui.next": ["التالي", "Next"],
  "ui.prev": ["السابق", "Previous"],
  "ui.quizDone": ["ما شاء الله! أنهيت الاختبار.", "Masha Allah! You finished the quiz."],
  "ui.quizScore": ["أجبت عن {n} من {total} من أول مرة.", "You got {n} of {total} right the first time."],
  "ui.again": ["أعد الاختبار", "Try the quiz again"],
  "ui.nextUnit": ["الوحدة التالية", "Next unit"],
  "ui.allUnits": ["كل الوحدات", "All units"],

  // new Muslim
  "ui.muslimIntro": ["رفيقك في أيامك الأولى في الإسلام: خطوات قصيرة تعلّمك الأهم فالأهم، وورد يومي تبنيه على مهل.", "Your companion in your first days in Islam: short steps that teach you the most important things first, and a daily routine you build at your own pace."],
  "ui.forNew": ["للمسلم الجديد", "For the new Muslim"],
  "ui.steps": ["خطواتي الأولى", "My first steps"],
  "ui.stepN": ["الخطوة {n}", "Step {n}"],
  "ui.stepsDone": ["الخطوات المنجزة: {n} من {total}", "Steps done: {n} of {total}"],
  "ui.start": ["ابدأ من هنا", "Start here"],
  "ui.continue": ["تابع", "Continue"],
  "ui.allDone": ["أتممت كل الخطوات، ثبّتك الله. راجعها متى شئت.", "You have completed all the steps. May Allah keep you firm. Come back to them whenever you like."],
  "ui.todo": ["تطبيق اليوم", "Today's practice"],
  "ui.markDone": ["أتممت هذه الخطوة", "I have completed this step"],
  "ui.markUndone": ["ألغِ الإتمام", "Mark as not done"],
  "ui.stepDone": ["بارك الله فيك", "May Allah bless you"],
  "ui.dayHint": ["ورد يومك: علِّم ما أتممته. يُحفظ على جهازك فقط.", "Your daily routine: tick what you have done. It is kept on your device only."],
  "ui.level": ["المستوى", "Level"],
  "ui.level1": ["الأساسيات", "Essentials"],
  "ui.level2": ["أكثر", "More"],
  "ui.level3": ["اليوم كاملًا", "The full day"],
  "ui.levelNote": ["ابدأ بالأساسيات، وإذا ثبتَّ عليها أيامًا فانتقل إلى المستوى التالي.", "Start with the essentials. Once you have kept them for some days, move on to the next level."],
  "ui.today": ["اليوم", "Today"],
  "ui.dayProgress": ["{n} من {total}", "{n} of {total}"],
  "ui.dayComplete": ["أتممت ورد اليوم، تقبّل الله منك.", "You have completed today's routine. May Allah accept it from you."],
  "ui.week": ["آخر سبعة أيام", "The last seven days"],
  "ui.streak": ["أيام متتالية: {n}", "Days in a row: {n}"],
  "ui.note": ["خاطرة اليوم", "Today's note"],
  "ui.notePlaceholder": ["ماذا تعلّمت اليوم؟ وعلامَ تحمد الله؟", "What did you learn today? What are you thankful to Allah for?"],
  "ui.noteSaved": ["تُحفظ على جهازك فقط", "Saved on your device only"],
  "ui.open": ["افتح", "Open"],
  "ui.reset": ["ابدأ اليوم من جديد", "Clear today"],
};

module.exports = { kids, steps, day, ui };
