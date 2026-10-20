# نشر حصن ونور على Google Play

التطبيق على Google Play هو **TWA (Trusted Web Activity)**: تطبيق Android صغير يفتح الموقع نفسه داخل Chrome كتطبيق كامل، من غير شريط متصفح. أي تحديث يُنشر على الموقع يصل لمستخدمي التطبيق فورًا، ومش محتاج إصدار جديد على المتجر إلا لو اتغيّر الاسم أو الأيقونة أو إعدادات الحزمة.

| الملف | الاستخدام |
|---|---|
| `listing.md` | نصوص صفحة التطبيق: الاسم والوصف المختصر والكامل، بالعربي والإنجليزي |
| `icon-512.png` | أيقونة المتجر (512×512) |
| `feature-graphic.jpg` | صورة العرض أعلى صفحة التطبيق (1024×500) |
| `screenshots/1-…6-*.jpg` | لقطات الهاتف بالترتيب (1080×1920) |

اللقطات والصور تتولد بـ `npm run store`، ولازم إنترنت عشان خطوط صفحات المصحف ونصوص الأحاديث.

## المراحل

| # | المرحلة | المدة |
|---|---|---|
| 1 | حساب مطوّر على Google Play | أيام للتحقق من الهوية |
| 2 | مستودع `hanyarafaosman.github.io` لملف إثبات الملكية | دقائق |
| 3 | بناء ملف التطبيق (AAB) بـ PWABuilder | 10 دقائق |
| 4 | إنشاء التطبيق في Play Console وملء بياناته | ساعة تقريبًا |
| 5 | اختبار مغلق: 12 مختبِرًا لمدة 14 يومًا متصلة | أسبوعان |
| 6 | طلب النشر للعامة، ثم المراجعة | أيام |

## 1. حساب المطوّر

من [play.google.com/console](https://play.google.com/console): حساب **شخصي**، برسوم 25 دولارًا مرة واحدة، ثم التحقق من الهوية والهاتف والبريد. اسم المطوّر وبريد التواصل يظهران للناس في صفحة التطبيق.

## 2. مستودع إثبات الملكية

عشان التطبيق يفتح من غير شريط متصفح، Android بيتأكد إن التطبيق والموقع لنفس المالك من ملف في **جذر النطاق**:
`https://hanyarafaosman.github.io/.well-known/assetlinks.json`

جذر النطاق ده بيخدمه مستودع اسمه بالظبط `hanyarafaosman.github.io`. اعمله على GitHub **عام وفاضي**، وقول لـ Claude. هيضيف فيه:
- `.well-known/assetlinks.json` (بعد الخطوتين 3 و4، لأنه محتاج بصمات مفاتيح التوقيع).
- `robots.txt` فيه رابط `sitemap.xml`، وده مفيد لـ Google كمان.
- صفحة رئيسية تحوّل الزائر إلى `/hisn-almuslim/`.

ولو مفيش ملف إثبات، التطبيق هيشتغل برضه، بس هيظهر فوقه شريط متصفح فيه الرابط.

## 3. بناء ملف التطبيق بـ PWABuilder

1. افتح [pwabuilder.com](https://www.pwabuilder.com) واكتب `https://hanyarafaosman.github.io/hisn-almuslim/` واضغط Start.
2. اختار **Package for stores** ثم **Android**، وفي الخيارات:

| الخانة | القيمة |
|---|---|
| Package ID | `io.github.hanyarafaosman.hisnalmuslim` (**لا يتغيّر بعد النشر أبدًا**) |
| App name / Short name | `حصن ونور` |
| Version / Version code | `1.0.0` / `1` |
| Display mode | Standalone |
| Orientation | Portrait |
| Status bar / Navigation bar / Background color | `#0f766e` |
| Notification delegation | **مفتوح** (تنبيهات الصلاة والأذان تظهر باسم التطبيق، ويطلب Android 13+ إذن الإشعارات) |
| Location delegation | **مقفول** (Chrome نفسه يطلب إذن الموقع لمواقيت الصلاة، والبحث عن المدينة متاح بدونه) |
| Google Play billing | **مقفول** |
| Signing key | New (مفتاح جديد) |

3. نزّل الملف المضغوط، وفيه:
   - ملف `.aab`: ده اللي يترفع على Google Play.
   - ملف `.apk`: لتجربة التطبيق على موبايلك قبل الرفع.
   - `signing.keystore` و`signing-key-info.txt` (فيه كلمات السر): **احفظهم في مكان آمن خارج المستودع**. لو ضاعوا مش هتقدر ترفع تحديثات إلا بطلب لـ Google لتغيير مفتاح الرفع. **ما تحطهمش في GitHub أبدًا.**
   - `assetlinks.json`: ابعته لـ Claude. فيه البصمة العامة للمفتاح بس، ومفيهوش أسرار.

## 4. إنشاء التطبيق في Play Console

**Create app:** الاسم من `listing.md`، اللغة الافتراضية العربية، App، Free.

**Main store listing:** الاسم والوصف المختصر والكامل من `listing.md`، والأيقونة والصورة واللقطات من المجلد ده. وبعدين من **Manage translations** ضيف الإنجليزية بالنصوص الإنجليزية.

**Store settings:**
- Category: **Books & Reference**
- Contact details: بريدك، والموقع `https://hanyarafaosman.github.io/hisn-almuslim/`

**App content:**

| البند | الإجابة |
|---|---|
| Privacy policy | `https://hanyarafaosman.github.io/hisn-almuslim/privacy.html` |
| Ads | No, my app does not contain ads |
| App access | All functionality is available without special access |
| Content rating | الفئة Reference, News, or Educational، وإجابة No على كل أسئلة العنف والمحتوى والمشاركة والمشتريات |
| Target audience | 13 سنة فأكثر (13-15 و16-17 و18+) |
| News app / Government app | No |
| Financial features / Health | None |
| Data safety | Yes، لبند واحد: **Location → Approximate location**: Collected، مش Shared، Processed ephemerally، Optional، والغرض App functionality |

ليه 13 فأكثر: التطبيق مناسب للأطفال، بس اختيار فئة أقل من 13 بيدخّله في سياسة «التطبيقات العائلية» وشروطها الإضافية ومراجعتها الأطول. ممكن تضيفها بعد النشر لو حبيت.

ليه Data safety كده: كل البيانات (العدّاد والمفضلة والإعدادات ومكان مواقيت الصلاة) بتتحفظ على الجهاز. الاستثناء الوحيد: لما المستخدم يضغط «استخدام موقعي الحالي» في مواقيت الصلاة، الإحداثيات بتتبعت مقرّبة لنحو كيلومتر مرة واحدة لـ OpenStreetMap عشان يظهر اسم المدينة، ومش بتتخزن عندنا. وده عند Google «جمع» لموقع تقريبي، اختياري ومؤقت. البحث عن مدينة بيبعت الاسم المكتوب بس لـ Open-Meteo. وغير كده التطبيق بيطلب المحتوى من مصادره (الصوتيات والترجمات والأحاديث)، وكل ده مكتوب في سياسة الخصوصية.

**App integrity → App signing:** سيبها على Play App Signing (الافتراضي). بعد أول رفع، انسخ **SHA-256 certificate fingerprint** الخاص بـ **App signing key certificate** وابعته لـ Claude، عشان يتضاف لملف `assetlinks.json` جنب بصمة مفتاح الرفع.

## 5. الاختبار المغلق

الحسابات الشخصية الجديدة لازم تعمل اختبار مغلق قبل النشر للعامة:
1. **Testing → Closed testing → Create track**، وفي **Testers** حط قائمة إيميلات Gmail لـ **12 شخصًا على الأقل** (عائلة وأصحاب).
2. **Create release**، ارفع ملف `.aab`، واكتب ملاحظات الإصدار، ثم **Review release** و**Start rollout**.
3. ابعت للمختبِرين **رابط الانضمام** (opt-in). كل واحد يفتحه ويوافق وينزّل التطبيق، ولازم **يفضلوا مشتركين 14 يومًا متصلة**.
4. اطلب منهم يستخدموه بجد ويبعتوا ملاحظاتهم، لأن Google بتسأل عن الاختبار ده لما تطلب النشر.

## 6. النشر للعامة

بعد الـ 14 يوم: من **Dashboard** اختار **Apply for production** وجاوب أسئلة الاختبار. بعد الموافقة: **Production → Create release** بنفس ملف `.aab` أو أحدث منه، ثم المراجعة، ودي بتاخد من ساعات لأيام.

## بعد النشر

- **التحديثات:** أي تعديل على الموقع بيوصل للتطبيق فورًا. ملف `.aab` جديد مطلوب بس لو اتغيّر الاسم أو الأيقونة أو الألوان أو إعدادات الحزمة، وساعتها **ارفع رقم Version code**، ووقّع بنفس المفتاح.
- **التقييمات:** النجوم بتظهر في صفحة التطبيق على Google Play وفي نتائج بحث Google. التقييمات لازم تكون حقيقية: Google بيعاقب على التقييمات المدفوعة أو المتبادلة.
