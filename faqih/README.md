# الباحث الفقهي: خادم الأسئلة

> **الخادم ده اختياري.** من غيره (`FAQIH.url` فاضي في `www/js/faqih.js`) صفحة `#/faqih` بتدوّر في نص كل كتب المكتبة على الجهاز نفسه، في فهرس الكلمات `www/fihris/` (`npm run fihris`، والكلمات بتتقطّع بـ `www/js/fihris-words.js`): بتعرض الصفحات اللي فيها كلمات السؤال، الأقرب الأول، كل واحدة عند الفقرة اللي فيها أكتر كلمات السؤال ومعلَّمة، مع الجزء والصفحة ورابط الموضع. من غير ذكاء اصطناعي ولا حساب ولا تكلفة. الخادم بيزوّد ملخصًا بنموذج لغوي وبحثًا بالمعنى لو اتنشر.

لو اتنشر، صفحة `#/faqih` في التطبيق بتبعت السؤال للخادم ده، وهو بيدوّر في كتب `www/kutub` (الموسوعة الفقهية الكويتية، المغني، المحلى، متون المذاهب…) ويرجّع ما قالته الكتب **نصًّا** مع الجزء والصفحة ورابط يفتح الموضع في القارئ. مش مفتي: مابيرجّحش ومابيفتيش في الحالات الشخصية، وبيحوّلها لأهل العلم.

## إزاي بيشتغل

1. `scripts/build-faqih.mjs` بيقطّع كل كتاب لمقاطع (صفحة قراءة، أو جزء منها على حدود الفقرات: `scripts/faqih-chunk.mjs`)، وبيحوّل كل مقطع لمتجه بنموذج التضمين `@cf/baai/bge-m3` على Workers AI، وبيخزّنه مع نصه ومكانه في فهرس Vectorize اسمه `faqih-v1`.
2. الخادم (`src/index.js`) بياخد السؤال، بيحوّله لمتجه، بيجيب أقرب 12 مقطعًا، وبيبعتهم للنموذج (`src/llm.js`: Qwen3 على Workers AI، أو Claude) مع تعليمات `src/prompt.js`: انقل ما في المقاطع فقط، حرفيًّا، بأرقام المقاطع.
3. **كل اقتباس بيتفحص** (`src/verify.js`): لازم يكون موجود كلمة بكلمة في المقطع اللي بيشير له (من غير تشكيل وعلامات ترقيم)، وإلا بيتحذف. لو كل الاقتباسات اتحذفت الرد بيبقى «لم أجد». عدد المحذوف بيتسجّل في D1 عشان لو زاد نعرف إن النموذج بيختلق.
4. الرد JSON: `status` (answer / not_found / refer_to_scholar)، `summary` فقرة قصيرة، `items` كل واحد فيه الاقتباس ومكانه (`b` الكتاب، `s` صفحة القراءة، `p0` الفقرة، `pg0/pg1` الصفحات المطبوعة، `v0/v1` الأجزاء).

الحدود: 10 أسئلة في الدقيقة من العنوان الواحد (`LIMITER` في `wrangler.toml`)، و`DAILY_LIMIT` سؤالًا في اليوم للكل. السؤال نفسه مابيتسجّلش في أي مكان.

## التشغيل لأول مرة

محتاج حساب Cloudflare على **خطة Workers Paid (‏5 دولار في الشهر)**: الفهرس فيه نحو 100 ألف متجه، والخطة المجانية بتسع نحو 5 آلاف بس. وNode 22 أو أحدث. كل الأوامر من مجلد `faqih/`:

```bash
cd faqih
npm install
npx wrangler login
npm run index:create
npx wrangler d1 create hisn-faqih
```

انسخ الـ `database_id` اللي بيطبعه مكان الأصفار في `wrangler.toml`. بعدين:

```bash
npm run db:remote
npm run deploy
```

### بناء الفهرس

البناء بيتعمل من جهازك بسكربت Node عن طريق REST، فمحتاج API token من لوحة Cloudflare (My Profile › API Tokens) بصلاحيات **Workers AI: Read** و**Vectorize: Edit** على الحساب، ورقم الحساب (Account ID من صفحة Workers):

```bash
export CLOUDFLARE_ACCOUNT_ID=…
export CLOUDFLARE_API_TOKEN=…
node scripts/build-faqih.mjs --stats
node scripts/build-faqih.mjs --embed
```

`--stats` بيطبع عدد المقاطع من غير شبكة. `--embed` بيرفع كتابًا كتابًا وبيعلّم اللي خلص في `.cache/faqih/`، فلو وقف كمّله بنفس الأمر. التضمين كله نحو 25 مليون توكن: ضمن الحصة المجانية اليومية لـ Workers AI (‏10 آلاف نيورون) على يوم أو يومين، أو أقل من دولار لو اتعدّت.

بعد الرفع:

```bash
node scripts/build-faqih.mjs --ask="ما حكم الوضوء بالنبيذ"
node scripts/build-faqih.mjs --eval
```

`--eval` بيجرّب أسئلة `scripts/faqih-eval.json` (كل سؤال ومكانه المتوقع) وبيطبع نسبة اللي اتلقى مكانه في أول 5 وأول 12 ودرجات التشابه. حط `MIN_SCORE` في `wrangler.toml` بين درجات الإصابات ودرجات الفوات (الأسئلة اللي درجتها أقل بتترد «لم أجد» من غير ما تروح للنموذج)، و`npm run deploy`.

### ربط التطبيق

حط عنوان الخادم (`https://hisn-faqih.<اسمك>.workers.dev`) في `FAQIH.url` في `www/js/faqih.js`، وارفع إصدار التطبيق، وانشر. `scripts/check-sources.js` بيفحص `/health` كل يوم.

### لو الكتب اتبنت من جديد

لو `npm run kutub` غيّر كتابًا (هاش ملفه اتغيّر)، مقاطعه القديمة في الفهرس بتتستبعد تلقائيًّا (الخادم بيقارن الهاش بـ `kutub/index.json` المنشور). عشان ترجع: `node scripts/build-faqih.mjs --embed --only=<id>` بيرفع المقاطع الجديدة (نفس الـ ids بتتكتب فوق القديمة، والمقاطع اللي ماعادتش موجودة بتفضل بس مستبعدة؛ لو كترت اعمل فهرسًا جديدًا `--index=faqih-v2` وغيّر `index_name`).

## النموذج

الافتراضي `@cf/qwen/qwen3-30b-a3b-fp8` على Workers AI: على نفس الحساب، من غير مفتاح، نحو 0.1 سنت للسؤال وجزء منه مجاني يوميًّا. لو التقييم بيّن ضعفًا في النقل الحرفي (نسبة المحذوف في `log` عالية) حوّل لـ Claude:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

وفي `wrangler.toml`: `PROVIDER = "anthropic"` و`MODEL = "claude-sonnet-5-5"` (نحو 3 سنتات للسؤال) أو `claude-haiku-5-5` (أرخص بكتير)، ثم `npm run deploy`. المفتاح من Claude Console (platform.claude.com) بدفع حسب الاستخدام، واشتراك claude.ai مابيغطيهوش؛ حط حد إنفاق شهري من الـ Console.

## المتابعة

- `/health` بيرجّع عدد أسئلة اليوم، و`scripts/check-sources.js` بيفشل لو الخادم مابيردش.
- `npm run logs` للمتابعة الحية.
- في D1: `SELECT status, count(*), avg(dropped) FROM log GROUP BY status` بيقول نسبة الإجابات ونسبة الاقتباسات المحذوفة.
- `npm test` بيجرّب كل ده من غير Cloudflare (بيتشغّل كمان مع `npm run check` من جذر المشروع).
