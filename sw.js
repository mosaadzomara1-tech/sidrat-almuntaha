/* عامل الخدمة — ما الذي يعمل بلا إنترنت ومتى.
   ⚠ عند أي تعديل على الواجهة ارفع رقم النسخة هنا وفي index.html (?v=).

   السياسة، وسببها:
     · الواجهة والفهارس  → تُخزَّن عند التثبيت. بلا هذا لا يفتح التطبيق أصلاً.
     · **صفحات المصحف (٢.٥ م.ب)** → تُنزَّل في الخلفية بعد التثبيت مباشرة.
     · **التفسير (٢٠ م.ب) وكتب السنة (١٦ م.ب)** → تُنزَّل معها في الخلفية.
       قرار المالك: القرآن وتفسيره والسنة **لا تحتاج إنترنت** — وهي أصل الدين
       فلا يليق أن تقف على الشبكة. المجموع نحو ٣٨ ميجابايت مرة واحدة.
     · **تلاوة عبد الباسط — الأوراد المشهورة** → تُحفَظ تلقائياً (نحو ٣٣ م.ب):
       جزء عمّ كاملاً ١٣.١ + الفاتحة والكهف ويس والرحمن والواقعة والملك.
       هذه ما يُقرأ يومياً فعلاً، فيصير الصوت متاحاً بلا إنترنت لأكثر ما يُسمع.
     · **بقية المصحف صوتاً** → بثّ، ولكل سورة **زرّ حفظ** لمن أرادها. المصحف
       كاملاً بصوته **٥٣٤ م.ب** (مقيسة لا مقدَّرة)، وتنزيله على كل جهاز غير معقول.
     · **الأذكار وأركان الإسلام وأشراط الساعة** → تُخزَّن عند التثبيت (١٠٥ ك.ب).
       نصٌّ متعبَّدٌ به لا يليق أن يقف على شبكة؛ ومن فتح التطبيق مرةً واحدة
       صارت أذكارُه معه في الطائرة وفي الصحراء.
     · فهرس الابتهالات → مع القشرة، وملفاتُ الصوت بثٌّ من الأرشيف.
     · الوسائط الخارجية (mp4/mp3/pdf) → بثّ بلا تخزين، وإلا امتلأ الجهاز. */

const V = 'sidrah-v22';

const SHELL = [
  './', './index.html', './styles.css?v=22', './app.js?v=22', './share.html',
  './ios.html', './manhaj.html', './manifest.webmanifest', './assets/index.json', './assets/intro.json',
  './assets/sheikhs/index.json', './assets/quran/index.json', './assets/hadith/index.json',
  './icons/icon-192.png', './icons/icon-512.png', './assets/intro/garden.jpg',
  './icons/apple-touch-icon-180.png', './icons/apple-touch-icon-167.png',
  './icons/apple-touch-icon-152.png',
  // الأقسام المكتوبة: أذكارٌ وأركانٌ وأشراط — نصٌّ لا يحتاج شبكة أبداً،
  // فيُخزَّن مع القشرة نفسها لا في التنزيل المؤجَّل. حجمها كله نحو ١٠٥ ك.ب.
  './assets/static/index.json', './assets/static/athkar.json',
  './assets/static/arkan.json', './assets/static/signs.json',
  './assets/static/asma.json', './assets/static/calendar.json',
  './assets/ibtihalat.json',
];

const QURAN_PAGES = 604;

/* ⚠ **كاشُ المحتوى ثابتُ الاسم — لا يُمسح مع تحديث الواجهة.**
   كان كلُّ رقم نسخةٍ جديد يمسح كلَّ شيء ويُعيد تنزيل ~٧٢ م.ب (٨٧٩ ملفَّ نصٍّ + تلاوات)
   بـ١٢ تنزيلاً متزامناً والمستخدمُ يتصفّح — فشكا المالك: «التطبيق بقى تقيل بعد التحديث».
   المصحفُ والتفسيرُ والسنة نصٌّ ثابت؛ تغييرُ الواجهة لا يُبرّر إعادة تنزيله. */
const CONTENT = 'sidrah-content-v1';
const IS_CONTENT = /\/assets\/(quran\/(p|t)\/|quran\/search\.json|hadith\/|intro\/)|\.mp3$/i;

/* تنزيلٌ هادئ: لا يُزاحم التصفّح */
const BG_DELAY = 20000;      // يبدأ بعد عشرين ثانية من التفعيل
const CHUNK = 4;             // أربعة ملفاتٍ معاً لا اثنا عشر
const PAUSE = 350;           // فاصلٌ بين الدفعات
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* على شبكةٍ بطيئة أو مع «توفير البيانات» لا تُنزَّل التلاوات تلقائياً (~٣٣ م.ب) —
   تبقى متاحةً بزرّ «حفظ» لكل سورة. (navigator.connection في كروم وأندرويد) */
function slowNet() {
  const c = self.navigator && self.navigator.connection;
  return !!(c && (c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType || '')));
}

/* أوراد تُحفَظ بصوت القارئ الأول (عبد الباسط): جزء عمّ + السور المشهورة.
   مقيسة: جزء عمّ ١٣.١ م.ب · الكهف ٨.٩ · يس ٣.٣ · الرحمن ٢.٤ · الملك ١.٩. */
const AWRAD = [1, 18, 36, 55, 56, 67].concat(
  Array.from({ length: 37 }, (_, i) => 78 + i));

async function awradAudio() {
  try {
    const q = await (await fetch('./assets/quran/index.json', { cache: 'no-cache' })).json();
    const r = (q.reciters || [])[0];
    if (!r) return [];
    const base = r.server.replace(/\/$/, '');
    return AWRAD.map((n) => base + '/' + String(n).padStart(3, '0') + '.mp3');
  } catch (e) { return []; }
}

async function addAll(cache, urls, onProgress, gentle) {
  let done = 0;
  for (let i = 0; i < urls.length; i += CHUNK) {
    await Promise.all(urls.slice(i, i + CHUNK).map(async (u) => {
      try {
        const hit = await caches.match(u);          // في أيّ كاش — فلا يُنزَّل الموجود
        if (!hit) {
          const r = await fetch(u, { cache: 'no-cache' });
          if (r.ok) await cache.put(u, r.clone());
        }
      } catch (e) { /* ملف واحد يفشل لا يُسقط الباقي */ }
      done++;
      if (onProgress && done % 10 === 0) onProgress(done, urls.length);
    }));
    if (gentle) await sleep(PAUSE);
  }
  if (onProgress) onProgress(urls.length, urls.length);
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(V)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

async function hadithFiles() {
  /* قائمة ملفات البخاري ومسلم كاملة — تُبنى من فهارسها لا بأرقام مكتوبة بالإيد. */
  const out = [];
  try {
    const idx = await (await fetch('./assets/hadith/index.json', { cache: 'no-cache' })).json();
    for (const b of idx.books || []) {
      out.push('./assets/hadith/' + b.key + '/index.json');
      const bi = await (await fetch('./assets/hadith/' + b.key + '/index.json', { cache: 'no-cache' })).json();
      for (const c of bi.chapters || []) out.push('./assets/hadith/' + b.key + '/' + c.id + '.json');
    }
  } catch (e) { /* بلا شبكة الآن — تُحمَّل عند أول اتصال */ }
  return out;
}

/* نقلُ المحتوى من كاش نسخةٍ قديمة إلى الكاش الثابت — بلا شبكة. من ثبّت نسخةً
   سابقة لا يُعيد تنزيل مصحفه وسنّته عند هذا التحديث ولا بعده. */
async function migrate(oldKey, content) {
  try {
    const old = await caches.open(oldKey);
    for (const req of await old.keys()) {
      if (!IS_CONTENT.test(new URL(req.url).pathname) && !/\.mp3$/i.test(req.url)) continue;
      if (await content.match(req)) continue;
      const r = await old.match(req);
      if (r) await content.put(req, r);
    }
  } catch (err) { /* ما لم يُنقل يُنزَّل لاحقاً بهدوء */ }
}

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const content = await caches.open(CONTENT);
    const ks = await caches.keys();
    const stale = ks.filter((k) => k !== V && k !== CONTENT);
    for (const k of stale) await migrate(k, content);   // يُنقل قبل المسح
    await Promise.all(stale.map((k) => caches.delete(k)));
    await self.clients.claim();

    // قرار المالك: **القرآن وتفسيره والسنة لا تحتاج إنترنت.**
    // تُنزَّل في الخلفية بعد التفعيل — لا تؤخّر فتح التطبيق، وبعد دقائق يصير
    // المصحف كاملاً بتفسيريه والبخاري ومسلم متاحةً بلا شبكة.
    await sleep(BG_DELAY);                    // لا نُزاحم أوّلَ فتحٍ للتطبيق
    const cache = content;
    const list = [];
    for (let n = 1; n <= QURAN_PAGES; n++) list.push('./assets/quran/p/' + n + '.json');
    for (let n = 1; n <= 114; n++) list.push('./assets/quran/t/' + n + '.json');   // التفسير
    list.push('./assets/quran/search.json');   // البحث في الآيات (٨٠٠ ك.ب) — ليعمل بلا إنترنت
    list.push(...(await hadithFiles()));
    if (!slowNet()) list.push(...(await awradAudio()));   // صوت عبد الباسط — لا على شبكةٍ بطيئة
    addAll(cache, list, (done, total) => {
      self.clients.matchAll().then((cs) => cs.forEach((c) =>
        c.postMessage({ type: 'offline-progress', done: done, total: total })));
    }, true).catch(() => {});
  })());
});

/* طلب من الصفحة: حمّل التفسير أو كتب السنة للعمل بلا إنترنت، مع تقدّم */
self.addEventListener('message', (e) => {
  const d = e.data || {};
  // حفظ تلاوة سورة واحدة للاستماع بلا إنترنت
  if (d.type === 'save-audio' && d.url) {
    e.waitUntil((async () => {
      const cache = await caches.open(CONTENT);
      let ok = false;
      try {
        const r = await fetch(d.url, { mode: 'cors' });
        if (r.ok) { await cache.put(d.url, r.clone()); ok = true; }
      } catch (err) { ok = false; }
      if (e.source) e.source.postMessage({ type: 'audio-saved', url: d.url, ok: ok });
    })());
    return;
  }
  if (d.type !== 'precache' || !Array.isArray(d.urls)) return;
  e.waitUntil((async () => {
    const cache = await caches.open(CONTENT);
    const post = (done, total) => {
      if (e.source) e.source.postMessage({ type: 'precache-progress', id: d.id, done: done, total: total });
    };
    await addAll(cache, d.urls, post);
    if (e.source) e.source.postMessage({ type: 'precache-done', id: d.id, total: d.urls.length });
  })());
});

/* الضغط على تنبيه صلاةٍ أو أذكار: يفتح التطبيق على القسم نفسه (?go=times · ?go=athkar:sabah) */
self.addEventListener('notificationclick', (e) => {
  const go = (e.notification.data && e.notification.data.go) || '';
  e.notification.close();
  const url = new URL('./' + (go ? '?go=' + encodeURIComponent(go) : ''), self.registration.scope).href;
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) {
      try { if ('navigate' in c) await c.navigate(url); } catch (err) { /* نافذةٌ لا تُوجَّه — تُركَّز فقط */ }
      if ('focus' in c) return c.focus();
    }
    return self.clients.openWindow(url);
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // تلاوة الدخلة مدمجة: من الكاش أولاً لتبدأ فوراً
  if (url.pathname.indexOf('/assets/intro/') >= 0) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      const copy = r.clone();
      caches.open(CONTENT).then((c) => c.put(req, copy));
      return r;
    })));
    return;
  }

  // وسائط: تُبَثّ افتراضاً، لكن ما حفظه المستخدم يُقدَّم من الكاش فيعمل بلا إنترنت
  if (/\.(mp4|mp3|pdf)$/i.test(url.pathname) || url.origin !== self.location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreVary: true });
      if (hit) return hit;
      return fetch(req);
    })());
    return;
  }

  // محتوى المصحف والسنة: **الكاش أولاً** — نصٌّ ثابت لا يتغيّر، فلا داعي لسؤال الشبكة
  if (/\/assets\/(quran\/(p|t)|hadith)\//.test(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r.ok) {
          const copy = r.clone();
          const c = await caches.open(CONTENT);
          await c.put(req, copy);
        }
        return r;
      } catch (err) {
        return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // بقية ملفات الكتالوج: الشبكة أولاً ليصل التحديث، مع سقوط على الكاش
  if (url.pathname.indexOf('/assets/') >= 0) {
    e.respondWith(
      fetch(req).then((r) => {
        const copy = r.clone();
        caches.open(V).then((c) => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
