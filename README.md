# حصن المسلم — تطبيق أذكار لجميع الأنظمة

تطبيق **حصن المسلم من أذكار الكتاب والسنة** (الشيخ سعيد بن علي بن وهف القحطاني) مبني كـ **PWA** يعمل دون اتصال على Android وiOS وWindows وmacOS وLinux، مع إعداد **Capacitor** لإصدار حزم Android وiOS الأصلية للمتاجر.

- 132 بابًا و267 ذكرًا، النصوص من الموقع الرسمي للكتاب [hisnmuslim.com](https://www.hisnmuslim.com).
- عدّاد لكل ذكر مع تتبّع إنجاز يومي يُصفَّر تلقائيًا.
- أذكار الصباح والمساء مع تبديل الفترة، وأذكار النوم والاستيقاظ في الواجهة الرئيسية.
- بحث يتجاهل التشكيل والهمزات، مفضلة، سبحة إلكترونية، استماع صوتي (يتطلب اتصالًا).
- سمة فاتحة/داكنة، تحكم بحجم الخط، إظهار/إخفاء التشكيل، اهتزاز، إبقاء الشاشة مضاءة.
- بلا أي تبعيات (Vanilla JS)، ولا يجمع أي بيانات.

## التشغيل محليًا

```bash
npm run dev
```

ثم افتح <http://localhost:5173>. لا توجد خطوة بناء، مجلد `www/` هو التطبيق كاملًا.

## النشر كتطبيق ويب (كل الأنظمة)

ارفع محتويات `www/` إلى أي استضافة ثابتة عبر HTTPS (Cloudflare Pages, GitHub Pages, Netlify, Vercel…). المستخدم يفتح الرابط ويختار «تثبيت» أو «إضافة إلى الشاشة الرئيسية» فيعمل التطبيق كتطبيق مستقل دون اتصال.

## إصدار Android و iOS (المتاجر)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm run cap:add:android   # يحتاج Android Studio + JDK
npm run cap:add:ios       # يحتاج macOS + Xcode
npm run cap:sync
npm run cap:open:android  # أو cap:open:ios
```

المعرّف: `com.hisnalmuslim.azkar`، الإعدادات في `capacitor.config.json`.

## بنية المشروع

```
www/
  index.html            هيكل التطبيق + أيقونات SVG
  css/app.css           التنسيق (RTL، سمات، استجابة)
  js/app.js             المنطق: توجيه، عرض، عدّاد، سبحة، إعدادات
  data/hisn.json        بيانات الأذكار (132 بابًا)
  sw.js                 عامل الخدمة للعمل دون اتصال
  manifest.webmanifest  بيانات التثبيت
  icons/                الأيقونات
scripts/
  serve.js              خادم تطوير بلا تبعيات
  make-icons.js         توليد أيقونات PNG
  check.js              فحص سلامة البيانات والملفات
```

## تحديث النصوص

البيانات مولّدة من واجهة الموقع الرسمي `https://www.hisnmuslim.com/api/ar/husn_ar.json` مع تطبيع Unicode وتصحيح أخطاء مطبعية بسيطة في المصدر (مثل «مترلا» → «منزلا»). عند تعديل `data/hisn.json` ارفع رقم `VERSION` في `sw.js` ليتلقى المستخدمون التحديث.
