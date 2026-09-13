/* سدرة المنتهى — منطق التطبيق. بلا أي مكتبة خارجية.
   ——————————————————————————————————————————————————————————————
   البنية: دخلة بآية ← أبواب ← داخل الباب «مسائل» يجيب عنها المشايخ،
   كل شيخ ومقاطعه بجانب الآخر، ومعها المرئي والمسموع والكتب والفتاوى والأحاديث.
   ——————————————————————————————————————————————————————————————
   تحديث المحتوى بلا تحديث التطبيق: ضع رابط موقعك في REMOTE أدناه، فيصير
   التطبيق يقرأ الكتالوج من الشبكة ويسقط على النسخة المدمجة عند انقطاعها. */
'use strict';

var REMOTE = 'https://mosaadzomara1-tech.github.io/sidrat-almuntaha';   // مثال: 'https://sidrah.example.com'  — اتركه فارغاً للعمل بالنسخة المدمجة

/* النسخة المحمولة: ملف HTML واحد يحمل الكتالوج بداخله، فيعمل بالنقر المزدوج
   على أي جهاز بلا خادم وبلا تنصيب. يملؤه build/make_portable.py. */
var EMBED = (typeof window !== 'undefined' && window.__SIDRAH_EMBED) || null;

const $ = (s) => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const KINDS = [
  { k: 'videos',   label: 'مرئي',   em: '▶' },
  { k: 'audios',   label: 'صوتي',   em: '♪' },
  { k: 'hadeeths', label: 'أحاديث', em: '❝' },
  { k: 'books',    label: 'كتب',    em: '▤' },
  { k: 'fatwa',    label: 'فتاوى',  em: '⚖' },
  { k: 'articles', label: 'مقالات', em: '✎' },
];
const kindMeta = (k) => KINDS.find((x) => x.k === k) || KINDS[0];

const state = { index: null, topic: null, tab: 'issues', issue: 0, cache: {}, search: null,
                view: 'home', sheikhs: null, sheikh: null, sTab: 'videos',
                quran: null, surah: null, page: null, books: null, book: null,
                athkar: null, athCat: null, docs: null, docKind: null, docIndex: 0,
                ibt: null };

/* ————— تخزين محلي يفشل بهدوء (وضع التصفح الخاص) ————— */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

const favs = () => LS.get('sidrah:favs', []) || [];
const isFav = (id) => favs().some((f) => f.id === id);
function toggleFav(item) {
  const before = favs();
  const list = before.filter((f) => f.id !== item.id);
  if (list.length === before.length) list.unshift(item);
  LS.set('sidrah:favs', list.slice(0, 400));
  return isFav(item.id);
}

/* موضع التوقّف — لكي يُكمل المستخدم المحاضرة من حيث انتهى */
const marks = () => LS.get('sidrah:marks', {}) || {};
function saveMark(id, t, dur) {
  if (!dur || t < 15 || t > dur - 20) return;
  const m = marks(); m[id] = { t: Math.floor(t), d: Math.floor(dur), at: Date.now() };
  const keys = Object.keys(m);
  if (keys.length > 200) { keys.sort((a, b) => m[a].at - m[b].at).slice(0, 50).forEach((k) => delete m[k]); }
  LS.set('sidrah:marks', m);
}

function toast(msg, ms) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, ms || 2600);
}

/* ————— الوضع الليلي ————— */
(function themeInit() {
  const saved = LS.get('sidrah:t', null);
  if (saved) document.documentElement.dataset.t = saved;
  $('#theme').onclick = () => {
    const next = document.documentElement.dataset.t === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.t = next;
    LS.set('sidrah:t', next);
  };
})();

/* ————— جلب يفضّل الشبكة ويسقط على المدمج ————— */
/* ترتيب المصادر مقصود: **الشبكة أولاً** حتى يصل التحديث لكل من نزّل التطبيق —
   نسخةً محمولةً كانت أو مثبّتة — ثم النسخة المدمجة، ثم الملفات المجاورة.
   هكذا يكفي أن ترفع مجلد www على استضافتك ليتحدّث المحتوى عند الجميع. */
async function loadJSON(rel) {
  if (REMOTE && navigator.onLine !== false) {     // بلا شبكة لا ننتظر مهلة عبثاً
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 6000);      // لا نُعلّق المستخدم على شبكة بطيئة
      const r = await fetch(REMOTE.replace(/\/$/, '') + '/' + rel,
                            { cache: 'no-cache', signal: ctl.signal });
      clearTimeout(t);
      if (r.ok) return await r.json();
    } catch (e) { /* بلا نت أو الخادم متوقّف — نكمل بالنسخة المحفوظة */ }
  }
  if (EMBED && EMBED[rel]) return EMBED[rel];             // نسخة الملف الواحد
  const r = await fetch(rel);
  if (!r.ok) throw new Error(rel + ' ' + r.status);
  return r.json();
}

/* ============================ الدخلة ============================
   قرار تصميمي: الدخلة ليست شاشة انتظار — هي أول رسالة تسويقية للتطبيق.
   الاسم والوعد في سطر واحد، ثم آية بصوت شيخ فوق صورة حديقة حقيقية.
   إجراء واحد بارز (ادخل)، ومخرج فوري (تخطي) — لا نحبس أحداً. */
let introAudio = null;
const RING = 2 * Math.PI * 32;                    // محيط حلقة التقدّم

async function runIntro() {
  const box = $('#intro');
  /* شبكة أمان: لو تعثّر أي شيء (سفاري يمنع التشغيل، ملفٌ لم يصل) فلا تبقَ
     الدخلةُ فوق الشاشة — تُغلق بعد ١٢ ثانية مهما حدث. الشاشة السوداء
     العالقة تُقرأ عند المستخدم على أنها «التطبيق لا يعمل». */
  setTimeout(() => { if (!box.hidden) closeIntro(); }, 12000);
  if (LS.get('sidrah:intro_off', false)) { box.hidden = true; return; }

  let data;
  try { data = await loadJSON('assets/intro.json'); } catch (e) { box.hidden = true; return; }

  // آية مختلفة كل مرة، ولا تتكرّر مباشرةً بعد سابقتها
  const last = LS.get('sidrah:last_ayah', null);
  const pool = data.ayat.filter((x) => x.n !== last);
  const a = (pool.length ? pool : data.ayat)[Math.floor(Math.random() * (pool.length || data.ayat.length))];
  LS.set('sidrah:last_ayah', a.n);

  $('#intro-text').textContent = a.text;
  $('#intro-ref').textContent = a.surah + ' — الآية ' + a.ayah;
  if (data.photo) {
    $('#photo-credit').textContent = 'صورة الخلفية: ' + data.photo.by + ' · ' + data.photo.license;
    // في النسخة المحمولة الصورة مدمجة في CSS كـdata URI — لا نستبدلها بمسار ملف
    if (data.photo.file && !EMBED) $('.intro-bg').style.backgroundImage = 'url("' + data.photo.file + '")';
  }

  const sel = $('#intro-reciter');
  sel.innerHTML = data.reciters.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
  sel.value = LS.get('sidrah:reciter', data.default) || data.default;

  const cdnFor = (id) => data.cdn.replace('%s', id).replace('%d', a.n);
  // في النسخة المحمولة لا توجد ملفات بجوار الصفحة، فنبثّ التلاوة من المصدر
  const srcFor = (id) => (id === data.default && !EMBED ? a.local : cdnFor(id));

  let touched = false;                              // تدخّل المستخدم يلغي الإغلاق التلقائي
  const btn = $('#intro-play');
  const icon = $('#intro-icon');
  const ring = $('#ring');
  ring.style.strokeDasharray = RING;
  ring.style.strokeDashoffset = RING;

  function setRing(p) { ring.style.strokeDashoffset = String(RING * (1 - Math.min(1, Math.max(0, p)))); }

  function attach(au) {
    au.addEventListener('playing', () => { btn.dataset.state = 'playing'; icon.textContent = '❚❚'; });
    au.addEventListener('pause', () => { btn.dataset.state = ''; icon.textContent = '▶'; });
    au.addEventListener('timeupdate', () => { if (au.duration) setRing(au.currentTime / au.duration); });
    au.addEventListener('ended', () => {
      btn.dataset.state = ''; icon.textContent = '↻'; setRing(1);
      // تنتهي التلاوة فيدخل التطبيق من نفسه — دخلة لا انتظار
      clearTimeout(runIntro._t);
      if (!touched) runIntro._t = setTimeout(() => { if (!box.hidden) closeIntro(); }, 1400);
    });
    au.addEventListener('error', () => {
      btn.dataset.state = ''; icon.textContent = '▶';
      toast('تعذّر تشغيل التلاوة — تحقّق من الاتصال');
    });
  }

  function play() {
    if (introAudio) { try { introAudio.pause(); } catch (e) {} }
    setRing(0);
    introAudio = new Audio(srcFor(sel.value));
    introAudio.preload = 'auto';
    attach(introAudio);
    return introAudio.play();
  }

  btn.onclick = () => {
    touched = true;
    if (introAudio && !introAudio.paused) { introAudio.pause(); return; }
    if (introAudio && introAudio.currentTime > 0 && !introAudio.ended) { introAudio.play(); return; }
    play().catch(() => {});
  };
  sel.onchange = () => { touched = true; LS.set('sidrah:reciter', sel.value); play().catch(() => {}); };
  $('#intro-off').onchange = (e) => LS.set('sidrah:intro_off', e.target.checked);
  $('#intro-enter').onclick = closeIntro;
  $('#intro-skip').onclick = closeIntro;

  play().catch(() => { /* المتصفح يمنع التشغيل التلقائي — الزر باقٍ للمستخدم */ });
}

function closeIntro() {
  clearTimeout(runIntro._t);
  if (introAudio) { try { introAudio.pause(); } catch (e) {} }
  const box = $('#intro');
  box.style.transition = 'opacity .45s ease';
  box.style.opacity = '0';
  setTimeout(() => { box.hidden = true; box.style.opacity = ''; }, 450);
}

/* ============================ التنقّل ============================ */
function show(view, title, canBack) {
  ['#home', '#topic', '#favs', '#sheikh', '#sheikhs-all',
   '#quran', '#surah', '#books', '#book', '#chapter',
   '#athkar', '#athkar-cat', '#docs', '#doc',
   '#ibtihalat', '#munshid', '#times', '#calendar', '#asma', '#tasbih', '#zakat'].forEach((v) => { $(v).hidden = v !== view; });
  $('#bar-title').textContent = title;
  $('#back').hidden = !canBack;
  state.view = view;
  window.scrollTo(0, 0);
}

function goHome() { state.topic = null; show('#home', 'سدرة المنتهى', false); }

/* زرّ الرجوع في أندرويد يجب أن يرجع داخل التطبيق لا أن يغلقه */
function push(name) { try { history.pushState({ v: name }, ''); } catch (e) {} }
window.addEventListener('popstate', () => {
  if (!$('#player').hidden) { closePlayer(); return; }
  if (state.view !== '#home') goHome();
});
$('#back').onclick = () => { if (history.state && history.state.v) history.back(); else goHome(); };
$('#fav-btn').onclick = () => { renderFavs(); push('favs'); show('#favs', 'المحفوظات', true); };
$('#all-sheikhs').onclick = () => {
  $('#sheikhs-all-search').value = $('#sheikh-search').value;   // يُحمَل البحثُ إلى «الكل»
  renderAllSheikhs(); push('sheikhs'); show('#sheikhs-all', 'المشايخ', true);
};
$('#sheikh-search').oninput = () => { if (state.sheikhs) renderSheikhs(); };
$('#sheikhs-all-search').oninput = () => renderAllSheikhs();
$('#go-quran').onclick = openQuran;
$('#go-books').onclick = openBooks;
$('#go-times').onclick = openTimes;
$('#go-athkar').onclick = openAthkar;
$('#go-ibtihalat').onclick = openIbtihalat;
$('#go-arkan').onclick = () => openDocs('arkan');
$('#go-signs').onclick = () => openDocs('signs');
$('#go-calendar').onclick = openCalendar;
$('#go-asma').onclick = openAsma;
$('#go-tasbih').onclick = openTasbih;
$('#go-zakat').onclick = openZakat;

/* ============================ الإقلاع ============================ */
async function boot() {   // يرجّع وعداً حتى نعرف متى ينتهي
  runIntro();
  try {
    state.index = await loadJSON('assets/index.json');
  } catch (e) {
    $('#grid').innerHTML = '';
    const box = el('p', 'empty', 'تعذّر تحميل المحتوى.');
    const b = el('button', null, 'إعادة المحاولة'); b.onclick = () => location.reload();
    box.appendChild(b); $('#grid').appendChild(box);
    return;
  }
  $('#sources').innerHTML = state.index.sources
    .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a> — ${esc(s.note)}`)
    .join('<br>');
  const tot = state.index.topics.reduce((a, t) => a + Object.values(t.counts).reduce((x, y) => x + y, 0), 0);
  $('#stamp').textContent = 'تحديث المحتوى: ' + state.index.generated + ' · ' + tot + ' مادة';

  // وصل محتوى أحدث من المحفوظ عند المستخدم؟ نُعلمه بلا أن نقاطعه
  const seen = LS.get('sidrah:seen_build', null);
  if (seen && state.index.generated > seen) {
    toast('وصلك تحديث جديد للمحتوى — ' + state.index.generated, 3800);
  }
  LS.set('sidrah:seen_build', state.index.generated);
  renderGrid();
  loadSheikhs();
  sectionCounts();
  offlineUI();
  scheduleAlerts();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleAlerts(); });
  setInterval(scheduleAlerts, 6 * 3600 * 1000);
}

/* بطاقات الأقسام تحمل أرقامها الحقيقية — تُقرأ من الملفات لا تُكتب بالإيد */
async function sectionCounts() {
  try {
    const st = await loadJSON('assets/static/index.json');
    const a = $('#sc-athkar');
    if (a && st.athkar) a.textContent = st.athkar.items + ' ذكراً بتخريجها في ' + st.athkar.cats + ' قسماً';
    const k = $('#sc-arkan');
    if (k && st.arkan) k.textContent = 'الشهادتان والصلاة والزكاة والصوم والحج · ' + st.arkan.docs + ' مستنداً';
    const g = $('#sc-signs');
    if (g && st.signs) g.textContent = 'الصغرى والكبرى بالدليل · ' + st.signs.docs + ' مباحث';
    const e5 = $('#sc-asma');
    if (e5 && st.asma) e5.textContent = st.asma.names + ' اسماً بمعانيها وموضعها من القرآن';
  } catch (e) { /* الملف لم يصل بعد — تبقى النصوص العامة */ }
  try {
    const h = hijri(new Date()), e6 = $('#sc-calendar');
    if (h && e6) e6.textContent = 'اليوم ' + AR_NUM(h.d) + ' ' + HIJRI_MONTHS[h.m - 1] + ' ' + AR_NUM(h.y) + 'هـ — وصيام التطوع';
  } catch (e) { /* الملف لم يصل بعد — تبقى النصوص العامة */ }
  try {
    const ib = await loadJSON('assets/ibtihalat.json');
    const n = (ib.munshidun || []).reduce((x, m) => x + m.n, 0);
    const e2 = $('#sc-ibtihalat');
    if (e2 && n) e2.textContent = n + ' ابتهالاً بأصوات ' + (ib.munshidun || []).length + ' من كبار المبتهلين';
  } catch (e) { /* بلا شبكة — النصّ العام كافٍ */ }
}

function renderGrid() {
  const g = $('#grid');
  g.innerHTML = '';
  state.index.topics.forEach((t) => {
    const n = t.counts;
    const tile = el('button', 'tile',
      `<span class="em">${t.icon}</span><b>${esc(t.title)}</b>` +
      `<small><span class="hi">${t.issues || 0} مسألة</span> · ${t.sheikhs || 0} شيخاً<br>` +
      `${n.videos} مرئي · ${n.audios} صوتي · ${n.hadeeths} حديث</small>`);
    tile.onclick = () => openTopic(t.key);
    g.appendChild(tile);
  });
}

/* ============================ الباب ============================ */
async function loadTopic(key) {
  if (!state.cache[key]) state.cache[key] = await loadJSON('assets/topics/' + key + '.json');
  return state.cache[key];
}

async function openTopic(key) {
  let t;
  try { t = await loadTopic(key); } catch (e) { toast('تعذّر فتح الباب — تحقّق من الاتصال'); return; }
  state.topic = t;
  state.issue = 0;
  state.tab = (t.issues && t.issues.length) ? 'issues' : 'videos';
  $('#t-icon').textContent = t.icon;
  $('#t-title').textContent = t.title;
  $('#t-blurb').textContent = t.blurb;
  renderTabs(); renderBody();
  push('topic:' + key);
  show('#topic', t.title, true);
}

function renderTabs() {
  const nav = $('#tabs');
  nav.innerHTML = '';
  const add = (k, html) => {
    const b = el('button', 'tab', html);
    b.setAttribute('aria-selected', state.tab === k);
    b.onclick = () => { state.tab = k; renderTabs(); renderBody(); };
    nav.appendChild(b);
  };
  if (state.topic.issues && state.topic.issues.length) {
    add('issues', `◆ المسائل <span style="opacity:.7">${state.topic.issues.length}</span>`);
  }
  KINDS.forEach((k) => {
    const list = state.topic[k.k] || [];
    if (list.length) add(k.k, `${k.em} ${k.label} <span style="opacity:.7">${list.length}</span>`);
  });
}

function renderBody() {
  const bar = $('#issue-bar');
  const box = $('#items');
  box.innerHTML = '';
  if (state.tab === 'issues') { bar.hidden = false; renderIssueChips(); renderIssue(); return; }
  bar.hidden = true;
  const rows = state.topic[state.tab] || [];
  if (!rows.length) { box.appendChild(el('p', 'empty', 'لا توجد مواد في هذا القسم.')); return; }

  /* ⚠ **الفتوى غيرُ الحكم.** الحكمُ ثابتٌ من الكتاب والسنّة، والفتوى تنزيلُه
     على واقعةِ سائلٍ بحاله. وأكثرُ فتاوى هذا القسم من مصدرٍ واحد ولعددٍ محدود
     من المفتين — فبيانُ ذلك **في رأس القسم** لا في صفحةٍ يُحال إليها، لأنّ
     من يقرأ الفتوى لا يقرأ المنهج. */
  if (state.tab === 'fatwa') {
    const n = el('div', 'kind-note',
      '<b>اقرأها على أنها جوابُ سائلٍ بعينه</b>' +
      '<small>الحكمُ الشرعيُّ ثابتٌ، والفتوى <b>تنزيلُه على حال من سأل</b>. ' +
      'وأكثرُ ما هنا منقولٌ عن موقع <span dir="ltr">IslamHouse</span> ' +
      '(بإشراف وزارة الشؤون الإسلامية بالسعودية)، واسمُ المفتي مكتوبٌ تحت كل ' +
      'فتوى. فإن كانت مسألتُك في مالٍ أو طلاقٍ أو ميراثٍ أو طبّ ' +
      '<b>فاسأل أهلَ العلم في بلدك</b> — من عرف تفصيل حالك أقدرُ على تنزيل ' +
      'الحكم عليه. <a href="manhaj.html">منهج التطبيق ←</a></small>');
    box.appendChild(n);
  }

  rows.forEach((it) => box.appendChild(state.tab === 'hadeeths' ? hadithCard(it) : itemCard(it, state.tab)));
}

function renderIssueChips() {
  const bar = $('#issue-bar');
  bar.innerHTML = '';
  state.topic.issues.forEach((iss, i) => {
    const c = el('button', 'chip', esc(iss.t));
    c.setAttribute('aria-selected', state.issue === i);
    c.onclick = () => { state.issue = i; renderIssueChips(); renderIssue(); };
    bar.appendChild(c);
  });
}

/* رأي المشايخ في المسألة — كل شيخ ومقاطعه بجانب الآخر */
function renderIssue() {
  const box = $('#items');
  box.innerHTML = '';
  const iss = state.topic.issues[state.issue];
  if (!iss) return;

  const groups = new Map();
  iss.refs.forEach(([kind, i]) => {
    const it = (state.topic[kind] || [])[i];
    if (!it) return;
    const name = (it.by && it.by[0]) || 'مواد عامة';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({ it: it, kind: kind });
  });

  // الترتيب **هجائيّ**: التطبيق لعموم المسلمين، فلا تقديمَ لبلدٍ على بلد (قرار المالك
  // ٢٠٢٦-٠٩-١١ — كان «الأزهر ومصر أولاً» فأُلغي). و«مواد عامة» بلا مؤلّفٍ في الآخر.
  const order = [...groups.entries()].sort((a, b) => {
    if (a[0] === 'مواد عامة') return 1;
    if (b[0] === 'مواد عامة') return -1;
    return alphaCmp(a[0], b[0]);
  });

  box.appendChild(el('p', 'empty', `${iss.refs.length} مادة من ${order.length} مصدراً في هذه المسألة`));

  order.forEach(([name, list]) => {
    const sec = el('div', 'sheikh');
    const kinds = [...new Set(list.map((x) => kindMeta(x.kind).label))].join(' · ');
    const rec = state.sheikhs && (state.sheikhs.sheikhs || []).find((x) => x.name === name);
    const badge = rec && rec.role ? ` <span class="eg-badge">${esc(rec.role)}</span>` : '';
    const head = el('div', 'sheikh-head',
      `<span class="avatar">${esc(name.trim().charAt(0))}</span>` +
      `<div><b>${esc(name)}</b>${badge}<small>${list.length} مادة · ${esc(kinds)}</small></div>`);
    const known = rec;
    if (known) {
      head.style.cursor = 'pointer';
      head.title = 'كل مواد الشيخ';
      head.onclick = () => openSheikh(known.slug);
    }
    const reel = el('div', 'reel');
    list.forEach(({ it, kind }) => reel.appendChild(clipCard(it, kind)));
    sec.append(head, reel);
    box.appendChild(sec);
  });
}

/* عنوانٌ يُقرأ: عناوين الأرشيف تحمل حشواً تقنياً من رافعيها («up by muslem» · «512kb» ·
   «352x288» · روابط مدوّنات · رموز تعبيرية). يُنزع للعرض فقط — البياناتُ والمعرّفات كما هي. */
const TITLE_JUNK = [
  /\bu\s*p\s+b\s*y\s+\S+/gi, /\b\d{2,4}\s?kb\b/gi, /\b\d{3,4}x\d{3,4}\b/gi,
  /\b(?:https?:\/\/)?(?:www\.)?[\w-]+\.(?:blogspot|wordpress)\.[a-z.]+\S*/gi, /\bwww\.\S+/gi,
  /\{\s*\}/g, /\[\s*\]/g, /[\u{1F300}-\u{1FAFF}☀-➿️]/gu, /#(?=\S)/g,
];
function niceTitle(t) {
  let s = String(t || '');
  TITLE_JUNK.forEach((rx) => { s = s.replace(rx, ' '); });
  s = s.replace(/\s*[—–-]\s*(?=[—–-]|$)/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s—–\-.:|]+|[\s—–\-.:|]+$/g, '');
  return s || String(t || '');
}

function clipCard(it, kind) {
  const meta = kindMeta(kind);
  const c = el('button', 'clip',
    `<div class="ph">${it.img ? `<img loading="lazy" src="${esc(it.img)}" alt="">` : meta.em}` +
    `<span class="badge">${meta.label}${it.size ? ' · ' + esc(it.size) : ''}</span></div>` +
    `<div class="cap">${esc(niceTitle(it.title))}</div>`);
  c.onclick = () => openPlayer(it, kind);
  return c;
}

/* ————— بطاقة مادة ————— */
function itemCard(it, kind) {
  const meta = kindMeta(kind);
  const uid = kind + ':' + it.id;
  const card = el('div', 'card');
  const mk = marks()[uid];

  const thumb = el('div', 'thumb', it.img ? `<img loading="lazy" src="${esc(it.img)}" alt="">` : meta.em);
  const body = el('div', 'meta',
    `<b>${esc(niceTitle(it.title))}</b>` +
    (it.by && it.by.length ? `<small>${esc(it.by.join(' · '))}</small>` : '') +
    `<div class="tagline"><span class="pill ok">${meta.label}</span>` +
    (it.ext ? `<span class="pill" dir="ltr">${esc(it.ext.toUpperCase())}</span>` : '') +
    (it.size ? `<span class="pill${bigFile(it) ? ' warn' : ''}" dir="ltr">${esc(it.size)}</span>` : '') +
    '</div>' +
    (mk ? `<div class="progress"><i style="width:${Math.min(100, Math.round(100 * mk.t / mk.d))}%"></i></div>` : ''));

  const fav = el('button', 'fav' + (isFav(uid) ? ' on' : ''), isFav(uid) ? '★' : '☆');
  fav.title = 'حفظ';
  fav.onclick = (e) => {
    e.stopPropagation();
    const on = toggleFav(Object.assign({}, it, { id: uid, kind: kind }));
    fav.className = 'fav' + (on ? ' on' : ''); fav.textContent = on ? '★' : '☆';
    toast(on ? 'أُضيف إلى المحفوظات' : 'حُذف من المحفوظات', 1500);
  };

  card.append(thumb, body, fav);
  card.onclick = () => openPlayer(it, kind);
  return card;
}

function bigFile(it) {
  const m = /([\d.]+)\s*MB/i.exec(it.size || '');
  return m && parseFloat(m[1]) > 120;
}

/* ————— بطاقة حديث —————
   ⚠ **الدرجة تُنقَل ولا تُفترض.** كان هنا افتراضُ التصحيح عند غياب الحقل،
   فكان الحديثُ بلا درجةٍ يُعرَض مصحَّحاً بلا دليل — وتصحيحُ حديثٍ بغير علمٍ
   قولٌ على النبي ﷺ بلا حجّة، لا خطأٌ تقنيّ.
   ولا يُسوَّى الصحيحُ بالحسن في عين القارئ: لكلٍّ لونُه. */
function gradePill(g) {
  const t = (g || '').trim();
  if (!t) return '<span class="pill">درجته غير مذكورة في المصدر</span>';
  const cls = /موضوع|ضعيف|منكر|لا يصح|باطل/.test(t) ? 'bad'
            : /^صحيح|صحيحان|صحيح /.test(t) ? 'ok'
            : /حسن|شواهد|مجموع طرقه|اسناده/.test(t) ? 'warn' : '';
  return `<span class="pill ${cls}">${esc(t)}</span>`;
}

function hadithCard(h) {
  const c = el('div', 'hadith');
  c.innerHTML =
    `<div class="txt">${esc(h.text)}</div>` +
    `<div class="tagline">${gradePill(h.grade)}</div>` +
    `<div class="more">` +
      (h.explanation ? `<h4>الشرح</h4><p>${esc(h.explanation)}</p>` : '') +
      (h.hints && h.hints.length ? `<h4>من فوائد الحديث</h4><ul>${h.hints.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '') +
      (h.reference ? `<p class="ref">${esc(h.reference)}</p>` : '') +
    `</div>`;
  const t = el('button', 'toggle', 'الشرح والفوائد ▾');
  t.onclick = () => { c.classList.toggle('open'); t.textContent = c.classList.contains('open') ? 'إخفاء ▴' : 'الشرح والفوائد ▾'; };
  c.appendChild(t);
  return c;
}

/* ============================ المشغّل ============================ */
function openPlayer(it, kind) {
  const slot = $('#player-slot');
  const uid = kind + ':' + it.id;
  slot.innerHTML = '';
  $('#player-title').textContent = it.title;
  $('#player-by').textContent = (it.by || []).join(' · ');
  $('#player-desc').textContent = it.desc || '';

  if (it.ext === 'mp4' || it.ext === 'mp3') {
    const tag = it.ext === 'mp4' ? 'video' : 'audio';
    slot.innerHTML = `<${tag} controls playsinline preload="metadata"` +
      (it.ext === 'mp4' && it.img ? ` poster="${esc(it.img)}"` : '') +
      ` src="${esc(it.url)}"></${tag}>`;
    const m = slot.firstElementChild;
    const mk = marks()[uid];
    m.addEventListener('loadedmetadata', () => { if (mk && mk.t < m.duration - 20) { m.currentTime = mk.t; toast('استُؤنف من حيث توقفت', 2000); } });
    m.addEventListener('timeupdate', () => { if (!m.paused) saveMark(uid, m.currentTime, m.duration); });
    m.addEventListener('error', () => { slot.innerHTML = `<a class="open-ext" href="${esc(it.url)}" target="_blank" rel="noopener">تعذّر التشغيل — فتح الملف مباشرة</a>`; });
    mediaSession(it, m);
    if (bigFile(it)) slot.appendChild(el('p', 'note', 'حجم الملف كبير — يُفضّل تشغيله على شبكة واي فاي.'));
    m.play().catch(() => {});
  } else if (it.url) {
    slot.innerHTML = `<a class="open-ext" href="${esc(it.url)}" target="_blank" rel="noopener">فتح الملف (${esc((it.ext || '').toUpperCase())})</a>`;
  } else {
    slot.innerHTML = `<p class="empty">لا يوجد ملف مرفق لهذه المادة.</p>`;
  }
  push('player');
  $('#player').hidden = false;
}

function mediaSession(it, m) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: it.title, artist: (it.by || []).join(' · ') || 'سدرة المنتهى', album: 'سدرة المنتهى',
      artwork: it.img ? [{ src: it.img, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
    navigator.mediaSession.setActionHandler('play', () => m.play());
    navigator.mediaSession.setActionHandler('pause', () => m.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => { m.currentTime = Math.max(0, m.currentTime - 15); });
    navigator.mediaSession.setActionHandler('seekforward', () => { m.currentTime = Math.min(m.duration, m.currentTime + 30); });
  } catch (e) {}
}

function closePlayer() {
  const v = $('#player-slot').querySelector('video,audio');
  if (v) { try { v.pause(); } catch (e) {} }
  $('#player-slot').innerHTML = '';
  $('#player').hidden = true;
}
$('#close-player').onclick = () => { if (history.state && history.state.v === 'player') history.back(); else closePlayer(); };
$('#player').onclick = (e) => { if (e.target.id === 'player') $('#close-player').click(); };
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#player').hidden) $('#close-player').click(); });




/* ============================ العمل بلا إنترنت ============================
   قرار المالك: **القرآن وتفسيره والسنة لا تحتاج إنترنت.** عامل الخدمة ينزّلها
   في الخلفية بعد أول فتح (نحو ٣٨ م.ب مرة واحدة)، وهذا الشريط يُظهر التقدّم.
   التلاوات الصوتية تبقى بثّاً — مصحف مرتّل واحد يتجاوز ٤٠٠ م.ب. */
function offlineUI() {
  const box = $('#offline-box');
  if (!box) return;
  if (!('serviceWorker' in navigator) || location.protocol === 'file:' || EMBED) {
    box.hidden = true;
    return;
  }

  const bar = $('#off-bar');
  const txt = $('#off-txt');
  const done = () => {
    bar.style.width = '100%';
    txt.textContent = 'المصحف وتفسيره وكتب السنة وتلاوة عبد الباسط — جاهزة بلا إنترنت ✓';
    box.classList.add('ready');
  };

  if (LS.get('sidrah:offline_core', false)) done();

  navigator.serviceWorker.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.type !== 'offline-progress') return;
    const pct = Math.round(100 * d.done / Math.max(1, d.total));
    bar.style.width = pct + '%';
    if (pct >= 100) { LS.set('sidrah:offline_core', true); done(); }
    else txt.textContent = 'يُحفَظ المصحف والتفسير وكتب السنة وتلاوة عبد الباسط للعمل بلا إنترنت… ' + pct + '٪';
  });
}

/* ============================ المصحف الشريف ============================
   يُقرأ كما يُقرأ المصحف الورقي: ٦٠٤ صفحات بترقيم مصحف المدينة المعتمد في
   الحرمين، على ورقٍ فاتح بإطار ذهبي — لا صفحة سوداء طويلة تُتعب العين.
   وبجانب كل صفحة شرح آياتها: التفسير الميسر (مجمع الملك فهد) أو الوسيط
   (للشيخ طنطاوي، شيخ الأزهر الأسبق). */

async function openQuran() {
  if (!state.quran) {
    try { state.quran = await loadJSON('assets/quran/index.json'); }
    catch (e) { toast('تعذّر فتح المصحف'); return; }
  }
  const q = state.quran;
  $('#q-note').innerHTML = esc(q.text_source.name) + '<br>' + esc(q.text_source.note);

  const last = LS.get('sidrah:qpage', 0);
  const rb = $('#q-resume');
  rb.hidden = !last;
  if (last) { rb.textContent = 'تابع: صفحة ' + AR_NUM(last) + ' · ' + suraAtPage(last); rb.onclick = () => openPage(last); }

  $('#q-go').onclick = () => {
    const n = parseInt($('#q-page').value, 10);
    if (n >= 1 && n <= (q.pages || 604)) openPage(n);
    else toast('رقم الصفحة من ١ إلى ' + (q.pages || 604));
  };
  $('#q-page').onkeydown = (e) => { if (e.key === 'Enter') $('#q-go').click(); };

  renderKhatma();
  state.qTab = state.qTab || 'surahs';
  renderQTabs();
  $('#q-search').oninput = () => quranSearch($('#q-search').value);
  quranSearch($('#q-search').value);
  push('quran');
  show('#quran', 'المصحف الشريف', true);
}

function renderSurahList(filter, quiet) {
  const box = $('#surah-list');
  box.innerHTML = '';
  const f = norm(filter);
  const rows = state.quran.surahs.filter((s) => !f || norm(s.name).indexOf(f) >= 0 || String(s.n) === f);
  if (!rows.length) { if (!quiet) box.appendChild(el('p', 'empty', 'لا توجد سورة بهذا الاسم.')); return; }
  rows.forEach((s) => {
    const c = el('div', 'card');
    c.innerHTML = `<div class="surah-row"><span class="no">${s.n}</span>` +
      `<div class="meta"><b>${esc(s.name)}</b>` +
      `<small>${esc(s.type)} · ${ayatCount(s.count)} · صفحة ${AR_NUM(s.page)} · ${juzAtPage(s.page)}</small></div></div>`;
    c.onclick = () => openPage(s.page, s.n);
    box.appendChild(c);
  });
}

/* ————— تصفّحٌ أيسر للمصحف (طلب المالك ٢٠٢٦-٠٩-١١) —————
   كان التنقّلُ بالسورة ورقم الصفحة وحدهما: من حفظ «آية الكرسي» ولا يعرف صفحتها
   لا يصل، ومن أراد «الجزء الثامن عشر» يُقلّب. فصار: السور · الأجزاء الثلاثون ·
   علاماتي — وبحثٌ واحدٌ يفهم اسمَ السورة، وكلمةً من آية، و«البقرة ٢٥٥». */
const Q_TABS = [['surahs', 'السور'], ['juz', 'الأجزاء'], ['marks', 'علاماتي']];

function renderQTabs() {
  const nav = $('#q-tabs');
  nav.innerHTML = '';
  Q_TABS.forEach(([k, label]) => {
    const n = k === 'marks' ? qMarks().length : 0;
    const b = el('button', 'tab', label + (n ? ` <span style="opacity:.7">${AR_NUM(n)}</span>` : ''));
    b.setAttribute('aria-selected', state.qTab === k ? 'true' : 'false');
    b.onclick = () => { state.qTab = k; $('#q-search').value = ''; renderQTabs(); quranSearch(''); };
    nav.appendChild(b);
  });
}

function renderQList() {
  if (state.qTab === 'juz') return renderJuzList();
  if (state.qTab === 'marks') return renderMarks();
  renderSurahList('');
}

function renderJuzList() {
  const box = $('#surah-list');
  box.innerHTML = '';
  const juz = state.quran.juz || [];
  if (!juz.length) { box.appendChild(el('p', 'empty', 'فهرس الأجزاء غير متاح.')); return; }
  juz.forEach((j) => {
    const c = el('div', 'card');
    c.innerHTML = `<div class="surah-row"><span class="no">${AR_NUM(j.n)}</span>` +
      `<div class="meta"><b>الجزء ${AR_NUM(j.n)}</b>` +
      `<small>يبدأ في صفحة ${AR_NUM(j.page)} · ${esc(j.suras)}</small></div></div>`;
    c.onclick = () => openPage(j.page, j.s, j.a);   // وتُبرَز أوّلُ آيةٍ من الجزء
    box.appendChild(c);
  });
}

function qMarks() { return LS.get('sidrah:qmarks', []) || []; }

function toggleMark(p) {
  const marks = qMarks();
  const i = marks.findIndex((m) => m.p === p);
  if (i >= 0) marks.splice(i, 1); else marks.push({ p: p, t: Date.now() });
  LS.set('sidrah:qmarks', marks.slice(-200));
  return i < 0;
}

function renderMarks() {
  const box = $('#surah-list');
  box.innerHTML = '';
  const marks = qMarks();
  if (!marks.length) {
    box.appendChild(el('p', 'empty', 'لا علامات بعد. افتح أيَّ صفحةٍ واضغط «☆ علامة» تحتها — فتجدها هنا.'));
    return;
  }
  marks.slice().sort((a, b) => a.p - b.p).forEach((m) => {
    const c = el('div', 'card');
    c.innerHTML = `<div class="surah-row"><span class="no">★</span>` +
      `<div class="meta"><b>صفحة ${AR_NUM(m.p)} · ${esc(suraAtPage(m.p))}</b>` +
      `<small>${esc(juzAtPage(m.p))}</small></div></div>`;
    const x = el('button', 'mark-x', '✕');
    x.title = 'حذف العلامة';
    x.onclick = (e) => { e.stopPropagation(); toggleMark(m.p); renderQTabs(); renderMarks(); };
    c.firstChild.appendChild(x);
    c.onclick = () => openPage(m.p);
    box.appendChild(c);
  });
}

/* السورةُ والجزءُ عند صفحة: آخرُ ما بدأ في هذه الصفحة أو قبلها */
function suraAtPage(p) {
  const list = (state.quran && state.quran.surahs) || [];
  let hit = list[0];
  for (const x of list) { if (x.page <= p) hit = x; else break; }
  return hit ? hit.name : '';
}

function juzAtPage(p) {
  const list = (state.quran && state.quran.juz) || [];
  let hit = null;
  for (const x of list) { if (x.page <= p) hit = x; else break; }
  return hit ? 'الجزء ' + AR_NUM(hit.n) : '';
}

/* العددُ والمعدود: ١ آيةٌ واحدة · ٢ آيتان · ٣–١٠ آيات · ١١ فأكثر آية
   (والمئات بحسب آخر رقمين: ١٠٣ آيات · ١١١ آية) — «٤ آية» لحنٌ في تطبيقٍ للقرآن */
function ayatCount(n) {
  if (n === 1) return 'آيةٌ واحدة';
  if (n === 2) return 'آيتان';
  const k = n % 100;
  return AR_NUM(n) + ' ' + (k >= 3 && k <= 10 ? 'آيات' : 'آية');
}

const toLatin = (s) => String(s || '')
  .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

async function quranIndex() {
  if (!state.qsearch) state.qsearch = await loadJSON('assets/quran/search.json');
  return state.qsearch;
}

let qTimer = null;
function quranSearch(raw) {
  const q = toLatin(raw).trim();
  const ref = $('#q-ref'), res = $('#ayah-results');
  if (!q) {                                   // بلا بحث: التبويبُ المختار كما هو
    ref.hidden = true; ref.innerHTML = ''; res.hidden = true; res.innerHTML = '';
    $('#q-tabs').hidden = false;
    renderQList();
    return;
  }
  $('#q-tabs').hidden = true;
  renderSurahList(q.replace(/\d+/g, ' ').trim() || q, true);   // اسمُ السورة بلا الرقم
  clearTimeout(qTimer);
  qTimer = setTimeout(() => ayahSearch(q), 220);
}

async function ayahSearch(q) {
  if (toLatin($('#q-search').value).trim() !== q) return;        // كُتب غيرُه أثناء الانتظار
  const refBox = $('#q-ref'), res = $('#ayah-results');
  refBox.innerHTML = ''; res.innerHTML = '';
  let idx;
  try { idx = await quranIndex(); }
  catch (e) { res.hidden = false; res.appendChild(el('p', 'empty', 'البحث في الآيات يحتاج اتصالاً أوّلَ مرة.')); return; }
  const surahs = state.quran.surahs;
  const nameOf = (n) => (surahs.find((x) => x.n === n) || {}).name || String(n);

  // ١) مرجعٌ مباشر: «البقرة ٢٥٥» · «2:255» · «٢/٢٥٥»
  let target = null;
  const m1 = q.match(/^(\d{1,3})\s*[:/\-،,]\s*(\d{1,3})$/);
  const m2 = q.match(/^(.+?)\s*(\d{1,3})$/);
  if (m1) target = { s: +m1[1], a: +m1[2] };
  else if (m2 && /\D/.test(m2[1])) {
    const f = norm(m2[1]).replace(/^سوره\s+/, '').trim();
    const s = surahs.find((x) => norm(x.name) === f) || surahs.find((x) => f && norm(x.name).indexOf(f) >= 0);
    if (s) target = { s: s.n, a: +m2[2] };
  }
  if (target) {
    refBox.hidden = false;
    const row = idx.find((r) => r[0] === target.s && r[1] === target.a);
    if (row) {
      const c = el('div', 'card ref-jump');
      c.innerHTML = `<div class="surah-row"><span class="no">↵</span><div class="meta">` +
        `<b>اذهب إلى ${esc(nameOf(target.s))} — الآية ${AR_NUM(target.a)}</b>` +
        `<small>صفحة ${AR_NUM(row[2])} · ${juzAtPage(row[2])}</small></div></div>`;
      c.onclick = () => openPage(row[2], target.s, target.a);
      refBox.appendChild(c);
    } else {
      refBox.appendChild(el('p', 'empty', `سورة ${esc(nameOf(target.s))} ليس فيها الآية ${AR_NUM(target.a)}.`));
    }
    return;
  }

  // ٢) كلمةٌ أو كلماتٌ من آية — حرفان فأكثر
  const words = norm(q.replace(/\d+/g, ' ')).split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return;
  const hits = idx.filter((r) => words.every((w) => r[3].indexOf(w) >= 0));
  res.hidden = false;
  if (!hits.length) {
    if (!$('#surah-list').children.length) res.appendChild(el('p', 'empty', 'لا آية فيها هذه الكلمات.'));
    return;
  }
  res.appendChild(el('p', 'empty', `${ayatCount(hits.length)} ${hits.length === 2 ? 'فيهما' : 'فيها'} «${esc(words.join(' '))}»` +
    (hits.length > 60 ? ' — أوّلُ ٦٠' : '')));
  hits.slice(0, 60).forEach((r) => {
    const txt = r[3].split(' | ')[0];
    const i = Math.max(0, txt.indexOf(words[0]) - 40);
    const snip = (i ? '…' : '') + txt.slice(i, i + 110) + (txt.length > i + 110 ? '…' : '');
    const c = el('div', 'card ayah-hit');
    c.innerHTML = `<div class="meta"><b>${esc(nameOf(r[0]))} · الآية ${AR_NUM(r[1])}</b>` +
      `<small class="snip">${esc(snip)}</small><small>صفحة ${AR_NUM(r[2])}</small></div>`;
    c.onclick = () => openPage(r[2], r[0], r[1]);
    res.appendChild(c);
  });
}

const AR_NUM = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

async function openPage(p, focusSura, focusAya) {
  p = Math.max(1, Math.min(state.quran.pages || 604, p | 0));
  let d;
  try { d = await loadJSON('assets/quran/p/' + p + '.json'); }
  catch (e) { toast('تعذّر فتح الصفحة'); return; }
  state.page = d;
  LS.set('sidrah:qpage', p);
  khatmaProgress(p);
  hifzStop();

  const suraName = (n) => {
    const s = state.quran.surahs.find((x) => x.n === n);
    return s ? s.name : 'سورة ' + n;
  };
  const suras = [...new Set(d.ayat.map((a) => a.s))];

  $('#m-sura').textContent = suras.map(suraName).join(' · ');
  // جزءُ أوّلِ آيةٍ في الصفحة — ويُنبَّه إن بدأ جزءٌ في أثنائها (كالجزء ٢٦ في ص٥٠٢)
  $('#m-juz').textContent = !d.juz ? ''
    : d.juz_start && d.juz_start !== d.juz ? 'الجزء ' + AR_NUM(d.juz) + ' · بداية الجزء ' + AR_NUM(d.juz_start)
    : d.juz_start ? 'بداية الجزء ' + AR_NUM(d.juz)
    : 'الجزء ' + AR_NUM(d.juz);
  $('#m-page').textContent = 'صفحة ' + AR_NUM(p);
  $('#m-count').textContent = AR_NUM(p) + ' / ' + AR_NUM(state.quran.pages || 604);

  let html = '', prev = null;
  d.ayat.forEach((a) => {
    if (a.s !== prev) {
      if (a.a === 1) {
        html += `<span class="sura-band">${esc(suraName(a.s))}</span>`;
        if (a.s !== 1 && a.s !== 9) html += '<span class="bism">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>';
      }
      prev = a.s;
    }
    html += `<span class="aya" data-s="${a.s}" data-a="${a.a}">${esc(a.t)}` +
            `<span class="anum">﴿${AR_NUM(a.a)}﴾</span></span> `;
  });
  $('#m-text').innerHTML = html;

  // في الكتاب العربي: السابقة على اليمين والتالية على اليسار
  $('#m-prev').disabled = p <= 1;
  $('#m-next').disabled = p >= (state.quran.pages || 604);
  $('#m-prev').onclick = () => openPage(p - 1);
  $('#m-next').onclick = () => openPage(p + 1);

  // ضغط الآية يبرزها ويقفز إلى شرحها
  $('#m-text').querySelectorAll('.aya').forEach((sp) => {
    sp.onclick = () => {
      $('#m-text').querySelectorAll('.aya.on').forEach((x) => x.classList.remove('on'));
      sp.classList.add('on');
      const t = document.getElementById('tf-' + sp.dataset.s + '-' + sp.dataset.a);
      if (t) t.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
  });

  setupRecite(suras[0]);
  setupHifz(d);

  // تقليبٌ سريع: يُرى اسمُ السورة والجزء أثناء السحب، وتُفتح الصفحة عند الإفلات
  const sl = $('#m-slider');
  sl.max = state.quran.pages || 604;
  sl.value = p;
  $('#m-scrub').textContent = '';
  sl.oninput = () => {
    const v = +sl.value;
    $('#m-scrub').textContent = 'صفحة ' + AR_NUM(v) + ' · ' + suraAtPage(v) + ' · ' + juzAtPage(v);
  };
  sl.onchange = () => { if (+sl.value !== p) openPage(+sl.value); };

  const mk = $('#m-mark');
  const isMarked = qMarks().some((m) => m.p === p);
  mk.textContent = isMarked ? '★ معلَّمة' : '☆ علامة';
  mk.classList.toggle('on', isMarked);
  mk.onclick = () => {
    const on = toggleMark(p);
    mk.textContent = on ? '★ معلَّمة' : '☆ علامة';
    mk.classList.toggle('on', on);
    toast(on ? 'وُضعت علامة — تجدها في «علاماتي»' : 'أُزيلت العلامة');
  };

  await renderTafsir(d, suraName);
  push('page:' + p);
  show('#surah', 'صفحة ' + AR_NUM(p), true);
  if (!LS.get('sidrah:swipe_hint', false)) {        // أوّلَ مرة: الحركةُ بالكلمات
    LS.set('sidrah:swipe_hint', true);
    toast('اسحب بإصبعك من الشمال إلى اليمين للصفحة التالية — كقلب ورقة المصحف', 4500);
  }
  if (focusAya) {                     // من البحث: تُبرَز الآيةُ المقصودة وتُوسَّط
    const sp = $('#m-text').querySelector(`.aya[data-s="${focusSura}"][data-a="${focusAya}"]`);
    if (sp) { sp.classList.add('on'); sp.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  } else if (focusSura) window.scrollTo(0, 0);
}

async function renderTafsir(page, suraName) {
  const sel = $('#tf-src');
  const srcs = state.quran.tafsir_sources || [];
  if (!sel.options.length) {
    sel.innerHTML = srcs.map((t) => `<option value="${esc(t.key)}">${esc(t.name)}</option>`).join('');
    sel.value = LS.get('sidrah:tafsir', srcs[0] ? srcs[0].key : 'muyassar');
    sel.onchange = () => { LS.set('sidrah:tafsir', sel.value); renderTafsir(state.page, suraName); };
  }
  const key = sel.value || 'muyassar';
  const box = $('#tf-body');
  box.innerHTML = '<p class="empty">جارٍ تحميل الشرح…</p>';

  const needed = [...new Set(page.ayat.map((a) => a.s))];
  const tafs = {};
  for (const s of needed) {
    try { tafs[s] = await loadJSON('assets/quran/t/' + s + '.json'); }
    catch (e) { tafs[s] = null; }
  }

  box.innerHTML = '';
  page.ayat.forEach((a) => {
    const t = tafs[a.s] && tafs[a.s][key] ? tafs[a.s][key][String(a.a)] : '';
    if (!t) return;
    const it = el('div', 'tf-item',
      `<div class="k">${esc(suraName(a.s))} — الآية ${AR_NUM(a.a)}</div><p>${esc(t)}</p>`);
    it.id = 'tf-' + a.s + '-' + a.a;
    box.appendChild(it);
  });
  if (!box.children.length) box.appendChild(el('p', 'empty', 'لا يتوفّر شرح لهذه الصفحة.'));
  const src = srcs.find((x) => x.key === key);
  if (src) box.appendChild(el('p', 'tf-by', 'المصدر: ' + src.name + ' — ' + src.by));
}

function setupRecite(sura) {
  const sel = $('#su-reciter');
  if (!sel.options.length) {
    sel.innerHTML = state.quran.reciters
      .map((r, i) => `<option value="${i}">${esc(r.name)} — ${esc(r.role)}</option>`).join('');
    sel.value = String(LS.get('sidrah:qreciter', 0) || 0);
    sel.onchange = () => { LS.set('sidrah:qreciter', +sel.value); $('#su-audio').innerHTML = ''; };
  }
  /* قارئٌ لم تُسجَّل له كلُّ السور (الشيخ محمد رفعت: ٣١ سورة) — تُعطَّل عنده السورُ غير المسجَّلة
     ويُكتب ذلك بجانب اسمه، فلا يضغط المستخدم تشغيلاً على رابطٍ لا يعمل. */
  const hasSura = (r) => !r.surahs || r.surahs.indexOf(sura) >= 0;
  state.quran.reciters.forEach((r, i) => {
    const o = sel.options[i];
    if (!o) return;
    o.disabled = !hasSura(r);
    o.textContent = r.name + ' — ' + (hasSura(r) ? r.role : 'غير مسجَّلة له هذه السورة');
  });
  if (sel.options[+sel.value] && sel.options[+sel.value].disabled) sel.value = '0';
  // حفظ تلاوة السورة للاستماع بلا إنترنت — لكل سورة على حدة، لا المصحف كاملاً
  const saveBtn = $('#su-save');
  const audioUrl = () => {
    const r = state.quran.reciters[+sel.value] || state.quran.reciters[0];
    return r.server.replace(/\/$/, '') + '/' + String(sura).padStart(3, '0') + '.mp3';
  };
  const markSaved = () => { saveBtn.textContent = '✓ محفوظة'; saveBtn.disabled = true; };
  const savedList = () => LS.get('sidrah:saved_audio', []) || [];

  saveBtn.disabled = false;
  saveBtn.textContent = '⤓ حفظ';
  if (savedList().indexOf(audioUrl()) >= 0) markSaved();

  saveBtn.onclick = async () => {
    if (!('serviceWorker' in navigator)) { toast('غير متاح هنا'); return; }
    const url = audioUrl();
    saveBtn.textContent = 'يُحفَظ…';
    saveBtn.disabled = true;
    const reg = await navigator.serviceWorker.ready;
    (reg.active || navigator.serviceWorker.controller).postMessage({ type: 'save-audio', url: url });
  };

  if (!setupRecite._wired) {
    setupRecite._wired = true;
    navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.type !== 'audio-saved') return;
      if (d.ok) {
        const l = LS.get('sidrah:saved_audio', []) || [];
        if (l.indexOf(d.url) < 0) l.push(d.url);
        LS.set('sidrah:saved_audio', l.slice(-120));
        toast('حُفظت التلاوة — تعمل بلا إنترنت');
      } else {
        toast('تعذّر الحفظ — تحقّق من الاتصال');
      }
      const b = $('#su-save');
      if (b) {
        b.textContent = d.ok ? '✓ محفوظة' : '⤓ حفظ';
        b.disabled = !!d.ok;
      }
    });
  }

  $('#su-play').onclick = () => {
    const r = state.quran.reciters[+sel.value] || state.quran.reciters[0];
    const pad = String(sura).padStart(3, '0');
    const url = r.server.replace(/\/$/, '') + '/' + pad + '.mp3';
    $('#su-audio').innerHTML = `<audio controls autoplay preload="none" src="${esc(url)}"></audio>`;
    const au = $('#su-audio audio');
    au.onerror = () => toast('تعذّر تشغيل التلاوة — تحقّق من الاتصال');
    if ('mediaSession' in navigator) {
      try {
        const s = state.quran.surahs.find((x) => x.n === sura);
        navigator.mediaSession.metadata = new MediaMetadata(
          { title: s ? s.name : 'المصحف', artist: r.name, album: 'المصحف الشريف — سدرة المنتهى' });
      } catch (e) {}
    }
  };
  $('#su-audio').innerHTML = '';
}

/* تقليب الصفحة بالسحب — **الإصبعُ من الشمال إلى اليمين ← الصفحة التالية**، كقلب ورقة
   المصحف الشريف في اليد؛ والعكسُ للسابقة. قرارُ المالك الأخير بعد تجربته على الهاتف
   (٢٠٢٦-٠٩-١١): «المفروض من الشمال لليمين زي أحد بيقرا قرآن». يُسجَّل بالحركة لا
   بالكلمة، ويُكتب للمستخدم أوّلَ مرة — فلا يلتبس الوصفُ مرّةً أخرى.
   ولا يُقلَّب عند التمرير الرأسيّ للتفسير، ولا عند سحب مؤشر التقليب السريع. */
(function swipe() {
  let x0 = null, y0 = null;
  document.addEventListener('touchstart', (e) => {
    if ($('#surah').hidden || (e.target.closest && e.target.closest('input,select,textarea,.scrub'))) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (x0 === null || $('#surah').hidden || !state.page) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    openPage(state.page.p + (dx > 0 ? 1 : -1));
  }, { passive: true });
})();

/* لوحة المفاتيح على الحاسوب — اتجاه الكتاب العربي: ← التالية · → السابقة */
document.addEventListener('keydown', (e) => {
  if ($('#surah').hidden || !state.page || (e.target.closest && e.target.closest('input,select,textarea'))) return;
  if (e.key === 'ArrowLeft') openPage(state.page.p + 1);
  else if (e.key === 'ArrowRight') openPage(state.page.p - 1);
});

/* ============================ كتب السنة ============================ */
async function openBooks() {
  if (!state.books) {
    try { state.books = await loadJSON('assets/hadith/index.json'); }
    catch (e) { toast('تعذّر فتح كتب السنة'); return; }
  }
  const box = $('#books-list');
  box.innerHTML = '';
  box.appendChild(el('p', 'empty',
    state.books.books.reduce((a, b) => a + b.count, 0).toLocaleString('ar-EG') + ' حديثاً بنصّها الكامل'));
  state.books.books.forEach((b) => {
    const c = el('div', 'card');
    c.innerHTML = `<div class="thumb">❝</div><div class="meta"><b>${esc(b.title)}</b>` +
      `<small>${esc(b.author)}</small>` +
      `<div class="tagline"><span class="pill ok">${b.count} حديثاً</span>` +
      `<span class="pill">${b.chapters} كتاباً</span></div></div>`;
    c.onclick = () => openBook(b.key, b.title);
    box.appendChild(c);
  });
  push('books');
  show('#books', 'كتب السنة', true);
}

async function openBook(key, title) {
  let d;
  try { d = await loadJSON('assets/hadith/' + key + '/index.json'); }
  catch (e) { toast('تعذّر فتح الكتاب'); return; }
  state.book = d;
  const draw = (filter) => {
    const box = $('#chapters');
    box.innerHTML = '';
    const f = norm(filter);
    const rows = d.chapters.filter((c) => !f || norm(c.name).indexOf(f) >= 0);
    if (!rows.length) { box.appendChild(el('p', 'empty', 'لا يوجد باب بهذا الاسم.')); return; }
    rows.forEach((c) => {
      const card = el('div', 'card');
      card.innerHTML = `<div class="thumb">${c.id}</div><div class="meta"><b>${esc(c.name)}</b>` +
        `<div class="tagline"><span class="pill ok">${c.count} حديثاً</span></div></div>`;
      card.onclick = () => openChapter(key, c.id, c.name);
      box.appendChild(card);
    });
  };
  draw('');
  $('#b-search').value = '';
  $('#b-search').oninput = (e) => draw(e.target.value.trim());
  push('book:' + key);
  show('#book', title, true);
}

async function openChapter(key, id, name) {
  let d;
  try { d = await loadJSON('assets/hadith/' + key + '/' + id + '.json'); }
  catch (e) { toast('تعذّر فتح الباب'); return; }
  const box = $('#chapter-body');
  box.innerHTML = '';
  box.appendChild(el('p', 'empty', d.hadiths.length + ' حديثاً في هذا الكتاب'));
  d.hadiths.forEach((h) => {
    const c = el('div', 'hadith');
    c.innerHTML = `<div class="txt">${esc(h.t)}</div>` +
      `<div class="tagline"><span class="pill ok">${esc(state.book.title)}</span>` +
      `<span class="pill" dir="ltr">${h.n}</span></div>`;
    box.appendChild(c);
  });
  push('chapter:' + key + ':' + id);
  show('#chapter', name, true);
}

/* ============================ مواقيت الصلاة والقبلة ============================
   حسابٌ فلكيٌّ **يجري على الجهاز نفسه**: لا خادمَ ولا مفتاحَ ولا إنترنت، فيعمل
   في الطائرة وفي الصحراء وبعد عشر سنين. المعادلات هي المعادلات المعروفة في
   حساب موضع الشمس (زاوية الميل ومعادلة الزمن)، والزوايا المذهبية مأخوذة من
   الجهات المعتمدة كما تُعلنها هي.

   وقفةٌ شرعية مقصودة: **العبرة بأذان بلدك**، والحساب تقديرٌ يُستأنس به. ولذلك
   يُكتب هذا التنبيه تحت الجدول، ولا يُدّعى اعتمادٌ من جهة. */

const KAABA = { lat: 21.4225, lng: 39.8262 };

const TM_METHODS = [
  { k: 'makkah', name: 'أم القرى — مكة المكرمة', fajr: 18.5, isha: '90 min' },
  { k: 'egypt',  name: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
  { k: 'mwl',    name: 'رابطة العالم الإسلامي', fajr: 18, isha: 17 },
  { k: 'karachi',name: 'جامعة العلوم الإسلامية — كراتشي', fajr: 18, isha: 18 },
  { k: 'isna',   name: 'الجمعية الإسلامية لأمريكا الشمالية', fajr: 15, isha: 15 },
];

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const dsin = (d) => Math.sin(d * D2R), dcos = (d) => Math.cos(d * D2R), dtan = (d) => Math.tan(d * D2R);
const darcsin = (x) => R2D * Math.asin(x), darccos = (x) => R2D * Math.acos(x);
const darctan2 = (y, x) => R2D * Math.atan2(y, x);
const darccot = (x) => R2D * Math.atan(1 / x);
const fixAngle = (a) => { a -= 360 * Math.floor(a / 360); return a < 0 ? a + 360 : a; };
const fixHour = (a) => { a -= 24 * Math.floor(a / 24); return a < 0 ? a + 24 : a; };

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

/* موضع الشمس: الميل ومعادلة الزمن ليومٍ يولياني */
function sunPos(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = fixHour(darctan2(dcos(e) * dsin(L), dcos(L)) / 15);
  return { decl: darcsin(dsin(e) * dsin(L)), eqt: q / 15 - RA };
}

function calcTimes(date, lat, lng, methodKey, asrFactor) {
  const M = TM_METHODS.find((x) => x.k === methodKey) || TM_METHODS[0];
  const jdBase = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);

  const midDay = (t) => fixHour(12 - sunPos(jdBase + t).eqt);
  const angleTime = (angle, t, ccw) => {
    const d = sunPos(jdBase + t).decl;
    const x = (-dsin(angle) - dsin(d) * dsin(lat)) / (dcos(d) * dcos(lat));
    if (x < -1 || x > 1) return NaN;                 // خطوط العرض العليا: لا يتحقّق الوقت
    const T = darccos(x) / 15;
    return midDay(t) + (ccw ? -T : T);
  };
  const asrT = (t) => {
    const d = sunPos(jdBase + t).decl;
    return angleTime(-darccot(asrFactor + dtan(Math.abs(lat - d))), t, false);
  };

  let T = { fajr: 5 / 24, sunrise: 6 / 24, dhuhr: 12 / 24, asr: 13 / 24, sunset: 18 / 24, isha: 18 / 24 };
  for (let i = 0; i < 3; i++) {                       // تكرارٌ يزيد الدقة، ثلاثُ مرّات تكفي
    T = {
      fajr:    angleTime(M.fajr, T.fajr, true) / 24,
      sunrise: angleTime(0.833, T.sunrise, true) / 24,
      dhuhr:   midDay(T.dhuhr) / 24,
      asr:     asrT(T.asr) / 24,
      sunset:  angleTime(0.833, T.sunset, false) / 24,
      isha:    (M.isha === '90 min' ? NaN : angleTime(M.isha, T.isha, false) / 24),
    };
  }
  const tz = -date.getTimezoneOffset() / 60;
  const adj = (h) => (isNaN(h) ? NaN : fixHour(h * 24 + tz - lng / 15));
  const out = {
    fajr: adj(T.fajr), sunrise: adj(T.sunrise), dhuhr: adj(T.dhuhr) + 1 / 60,
    asr: adj(T.asr), maghrib: adj(T.sunset) + 1 / 60, isha: adj(T.isha),
  };
  if (M.isha === '90 min') out.isha = fixHour(out.maghrib + 1.5);
  return out;
}

function qiblaBearing(lat, lng) {
  const dL = KAABA.lng - lng;
  return fixAngle(darctan2(dsin(dL), dcos(lat) * dtan(KAABA.lat) - dsin(lat) * dcos(dL)));
}

const hhmm = (h) => {
  if (isNaN(h)) return '—';
  let m = Math.round(h * 60), hh = Math.floor(m / 60) % 24;
  m %= 60;
  const am = hh < 12 ? 'ص' : 'م';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return h12 + ':' + String(m).padStart(2, '0') + ' ' + am;
};

const PRAYERS = [
  ['fajr', 'الفجر', '🌄'], ['sunrise', 'الشروق', '🌅'], ['dhuhr', 'الظهر', '☀️'],
  ['asr', 'العصر', '🌤️'], ['maghrib', 'المغرب', '🌆'], ['isha', 'العشاء', '🌙'],
];

function tmSettings() {
  return LS.get('sidrah:tm', null) || { m: null, asr: 1, lat: null, lng: null, city: '' };
}

/* الطريقة الافتراضية تُختار بموقع الجهاز لا بالتخمين: من كان في جزيرة العرب
   فأمُّ القرى، ومن كان في مصر فالهيئة المصرية، وما عداهما رابطة العالم. */
function defaultMethod(lat, lng) {
  if (lat > 15 && lat < 33 && lng > 34 && lng < 57) return 'makkah';
  if (lat > 21 && lat < 32 && lng > 24 && lng < 37) return 'egypt';
  return 'mwl';
}

/* ============================ التنبيهات ============================
   زرّان مستقلّان، كلٌّ داخل قسمه (طلب المالك ٢٠٢٦-٠٩-١٣): تنبيهُ الصلاة في شاشة
   المواقيت، وتذكيرُ الأذكار في شاشة الأذكار. كلاهما يُحسب على الجهاز من المواقيت
   نفسها — بلا خادم ولا حسابٍ ولا إرسالٍ للموقع.
     · أذكار الصباح: بعد الفجر بخمسٍ وعشرين دقيقة (وقتها من الفجر إلى الشروق).
     · أذكار المساء: بعد العصر بخمسٍ وعشرين دقيقة (وقتها من العصر إلى الغروب).
   التخطيطُ دالةٌ خالصة (`planAlerts`) يختبرها tests/alerts_check.js بلا متصفّح. */
/* ================== التقويم الهجري · الختمة · الزكاة — دوالٌّ خالصة ==================
   تُحسب على الجهاز بلا شبكة، ويختبرها tests/calendar_check.js بلا متصفّح (طلب المالك ٢٠٢٦-٠٩-١٣).
   التقويم «أم القرى» من Intl — والعبرةُ في دخول الشهور برؤية بلد المستخدم، ومكتوبٌ له ذلك. */
const HIJRI_MONTHS = ['المحرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
const _HIJRI = (() => {
  try { return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }); }
  catch (e) { return null; }
})();
function hijri(date) {
  if (!_HIJRI) return null;
  const parts = _HIJRI.formatToParts(date);
  const g = (t) => parseInt((parts.find((p) => p.type === t) || {}).value, 10);
  const h = { d: g('day'), m: g('month'), y: g('year') };
  return h.d >= 1 && h.m >= 1 && h.m <= 12 ? h : null;
}
/* ما يُصام أو يحرم صومه في يومٍ بعينه — أيامُ النهي تُسقط كلَّ تطوّع (العيد · التشريق) */
function fastingOn(date) {
  const h = hijri(date);
  if (!h) return [];
  if (h.m === 10 && h.d === 1) return ['eid_fitr'];
  if (h.m === 12 && h.d === 10) return ['eid_adha'];
  if (h.m === 12 && h.d >= 11 && h.d <= 13) return ['tashreeq'];
  if (h.m === 9) return ['ramadan'];
  const out = [];
  if (h.m === 12 && h.d === 9) out.push('arafah');
  else if (h.m === 12 && h.d <= 8) out.push('dhulhijja');
  if (h.m === 1 && h.d === 9) out.push('tasua');
  if (h.m === 1 && h.d === 10) out.push('ashura');
  if (h.m === 10 && h.d >= 2) out.push('shawwal6');
  if (h.d >= 13 && h.d <= 15) out.push('beed');
  const wd = date.getDay();
  if (wd === 1 || wd === 4) out.push('monthu');
  return out;
}
/* متى يُذكَّر بالمناسبة: رمضان ليلةَ أوّله · الستّ ليلةَ ثاني شوال · العشر ليلةَ أوّلها — لا كلَّ يوم */
const CAL_REMIND = {
  ramadan: (h) => h.d === 1, shawwal6: (h) => h.d === 2, dhulhijja: (h) => h.d === 1,
  arafah: () => true, tasua: () => true, ashura: () => true, beed: () => true, monthu: () => true,
};
const CAL_TITLES = {
  ramadan: 'أوّل رمضان', eid_fitr: 'عيد الفطر', eid_adha: 'عيد الأضحى', tashreeq: 'أيام التشريق',
  arafah: 'صيام يوم عرفة', dhulhijja: 'العشر من ذي الحجة', tasua: 'صيام تاسوعاء', ashura: 'صيام عاشوراء',
  shawwal6: 'صيام الست من شوال', beed: 'صيام الأيام البيض',
};
function calTitle(k, date) {
  if (k === 'monthu') return date.getDay() === 1 ? 'صيام الاثنين' : 'صيام الخميس';
  return CAL_TITLES[k] || k;
}
const localISO = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
/* الختمة: ٦٠٤ صفحات على الأيام — وِردُ اليوم، والمتأخّرُ من أيامٍ سابقة */
function khatmaToday(plan, now) {
  const ppd = Math.ceil(604 / plan.days);
  const [y, m, d] = String(plan.start).split('-').map(Number);
  const day = Math.max(0, Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(y, m - 1, d)) / 86400000));
  const from = Math.min(604, day * ppd + 1), to = Math.min(604, (day + 1) * ppd);
  const done = Math.min(604, plan.reached || 0);
  return { ppd, day: day + 1, from, to, done, behind: Math.max(0, from - 1 - done) };
}
/* الزكاة: ربعُ العشر إذا بلغ صافي المال النصاب — الذهبُ بعياره يُردّ إلى عيار ٢٤ */
function zakatCalc(v) {
  const n = (x) => Math.max(0, parseFloat(x) || 0);
  const gp = n(v.goldPrice), sp = n(v.silverPrice), k = n(v.karat) || 24;
  const goldPure = (n(v.goldG) + (v.jewel ? n(v.jewelG) : 0)) * k / 24;
  const assets = n(v.cash) + n(v.trade) + n(v.recv) + goldPure * gp + n(v.silverG) * sp;
  const net = Math.max(0, assets - n(v.debt));
  const nisab = v.basis === 'silver' ? 595 * sp : 85 * gp;
  const missing = [];
  if (!gp && (v.basis !== 'silver' || n(v.goldG) || (v.jewel && n(v.jewelG)))) missing.push('gold');
  if (!sp && (v.basis === 'silver' || n(v.silverG))) missing.push('silver');
  if (!nisab) return { missing, net, nisab: 0, due: false, zakat: 0, goldPure };
  const due = net >= nisab && net > 0;
  return { missing, net, nisab, due, zakat: due ? net * 0.025 : 0, goldPure };
}

const ATH_DELAY = 25 / 60;
const ALERT_PRAYERS = [['fajr', 'الفجر'], ['dhuhr', 'الظهر'], ['asr', 'العصر'], ['maghrib', 'المغرب'], ['isha', 'العشاء']];

function planAlerts(now, st, prefs, days, plan) {
  const out = [];
  if (!prefs || !(prefs.prayer || prefs.athkar || prefs.siyam || prefs.wird)) return out;
  const hasLoc = !!st && st.lat != null;
  const method = hasLoc ? (st.m || defaultMethod(st.lat, st.lng)) : null;
  for (let d = 0; d < (days || 2); d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, 12, 0, 0);
    const t = hasLoc ? calcTimes(day, st.lat, st.lng, method, st.asr || 1) : {};
    const midnight = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const at = (h) => midnight + Math.round(h * 3600) * 1000;
    const stamp = day.getFullYear() + '-' + (day.getMonth() + 1) + '-' + day.getDate();
    if (prefs.prayer && hasLoc) {
      ALERT_PRAYERS.forEach(([k, label]) => {
        if (isNaN(t[k])) return;
        const name = k === 'dhuhr' && day.getDay() === 5 ? 'الجمعة' : label;
        out.push({ id: 'p:' + k + ':' + stamp, at: at(t[k]), go: 'times',
          title: 'حان الآن وقت صلاة ' + name, body: 'حيّ على الصلاة — والعبرة بأذان مسجدك' });
      });
    }
    if (prefs.athkar && hasLoc) {
      if (!isNaN(t.fajr)) out.push({ id: 'a:sabah:' + stamp, at: at(t.fajr + ATH_DELAY), go: 'athkar:sabah',
        title: 'أذكار الصباح', body: 'دقائقُ من الذكر تحفظ يومك بإذن الله' });
      if (!isNaN(t.asr)) out.push({ id: 'a:masaa:' + stamp, at: at(t.asr + ATH_DELAY), go: 'athkar:masaa',
        title: 'أذكار المساء', body: 'دقائقُ من الذكر تحفظ ليلتك بإذن الله' });
    }
    // صيام التطوع: تذكيرٌ ليلةَ الصيام التاسعة مساءً — لا يحتاج موقعاً
    if (prefs.siyam) {
      const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 12, 0, 0);
      const hn = hijri(next);
      const keys = hn ? fastingOn(next).filter((k) => CAL_REMIND[k] && CAL_REMIND[k](hn)) : [];
      if (keys.length) {
        out.push({ id: 's:' + stamp, at: midnight + 21 * 3600000, go: 'calendar',
          title: 'غداً: ' + keys.map((k) => calTitle(k, next)).join(' · '),
          body: keys.indexOf('ramadan') >= 0 ? 'بحساب أم القرى — والعبرة برؤية الهلال في بلدك'
                                             : 'نيّةُ الصيام من الليل — والعبرة برؤية بلدك' });
      }
    }
    // الورد اليومي: بعد العشاء بنصف ساعة، أو التاسعة والنصف بلا موقع
    if (prefs.wird && plan && plan.days) {
      const w = khatmaToday(plan, day);
      if (w.done < 604) {
        out.push({ id: 'w:' + stamp, go: 'khatma',
          at: hasLoc && !isNaN(t.isha) ? at(t.isha + 0.5) : midnight + 21.5 * 3600000,
          title: 'وِردُك من القرآن',
          body: 'من صفحة ' + w.from + ' إلى ' + w.to + (w.behind ? ' — وعليك ' + w.behind + ' صفحةً من أيامٍ سابقة' : '') });
      }
    }
  }
  const t0 = now.getTime();
  return out.filter((a) => a.at > t0).sort((a, b) => a.at - b.at);
}
/* ——— نهاية مخطِّط التنبيهات ——— */

function notifPrefs() { return LS.get('sidrah:notif', null) || { prayer: false, athkar: false }; }
const notifGranted = () => 'Notification' in window && Notification.permission === 'granted';
const canTrigger = () => typeof window.TimestampTrigger === 'function' &&
  typeof Notification !== 'undefined' && 'showTrigger' in Notification.prototype;
const notifTimers = [];
const NOTIF_ICON = 'icons/icon-192.png';

async function swReg() {
  if (!('serviceWorker' in navigator) || EMBED || location.protocol === 'file:') return null;
  try {
    return await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 3000))]);
  } catch (e) { return null; }
}

async function fireAlert(a) {
  const fired = LS.get('sidrah:notif:fired', []) || [];
  if (fired.indexOf(a.id) >= 0) return;                 // لا يتكرّر تنبيهٌ واحد مرّتين
  LS.set('sidrah:notif:fired', fired.concat(a.id).slice(-40));
  if (a.id.indexOf('p:') === 0 && notifPrefs().adhan) playAdhan(a.id.indexOf('p:fajr') === 0);
  const opt = { body: a.body, tag: a.id, icon: NOTIF_ICON, badge: NOTIF_ICON, lang: 'ar', dir: 'rtl', data: { go: a.go } };
  const reg = await swReg();
  try { if (reg) await reg.showNotification(a.title, opt); else new Notification(a.title, opt); } catch (e) {}
}

/* ⚠ حدٌّ لا يُخفى: تطبيقُ الويب لا يملك منبّهاً في نظام التشغيل. إن دعم المتصفّح الجدولةَ
   (TimestampTrigger) جُدولت التنبيهات في النظام فتصل ولو أُغلق التطبيق؛ وإلا وصلت ما دام
   التطبيق مفتوحاً أو في الخلفية، وما فات منها في آخر عشر دقائق يصل عند العودة. */
async function scheduleAlerts() {
  notifTimers.splice(0).forEach(clearTimeout);
  if (!notifGranted()) return;
  const prefs = notifPrefs();
  const now = Date.now();
  const list = planAlerts(new Date(now - 10 * 60000), tmSettings(), prefs, 2, khatma());
  const reg = await swReg();
  if (reg && canTrigger()) {
    try {   // تُلغى المجدولةُ القديمة ثم تُعاد — فتغييرُ الموقع أو الطريقة لا يُبقي تنبيهاً خاطئاً
      (await reg.getNotifications({ includeTriggered: false }))
        .forEach((n) => { if (/^[pasw]:/.test(n.tag || '')) n.close(); });
    } catch (e) {}
    for (const a of list) {
      if (a.at <= now) continue;
      try {
        await reg.showNotification(a.title, { body: a.body, tag: a.id, icon: NOTIF_ICON, badge: NOTIF_ICON,
          lang: 'ar', dir: 'rtl', data: { go: a.go }, showTrigger: new window.TimestampTrigger(a.at) });
      } catch (e) {}
    }
    return;
  }
  list.forEach((a) => {
    const ms = Math.max(0, a.at - now);
    if (ms < 2147483647) notifTimers.push(setTimeout(() => fireAlert(a), ms));
  });
}

function drawNotifSwitches() {
  const prefs = notifPrefs();
  document.querySelectorAll('[data-notif]').forEach((b) => {
    const on = !!prefs[b.dataset.notif] && notifGranted();
    b.setAttribute('aria-checked', String(on));
    b.classList.toggle('on', on);
  });
  document.querySelectorAll('[data-pref]').forEach((b) => {      // اختياراتٌ لا تحتاج إذناً (صوت الأذان)
    const on = !!prefs[b.dataset.pref];
    b.setAttribute('aria-checked', String(on));
    b.classList.toggle('on', on);
  });
}

async function setNotif(kind, on) {
  const prefs = notifPrefs();
  if (on) {
    if (kind === 'wird' && !khatma()) {
      toast('ابدأ خطة الختمة أولاً، ثم فعّل تذكير الورد', 3600);
      drawNotifSwitches();
      return;
    }
    if (!('Notification' in window)) {
      toast(/iPhone|iPad|iPod/.test(navigator.userAgent) ? 'على آيفون: ثبّت التطبيق على الشاشة الرئيسية أولاً، ثم فعّل التنبيه من داخله'
                   : 'متصفّحك لا يدعم التنبيهات', 4600);
      drawNotifSwitches();
      return;
    }
    let p = Notification.permission;
    if (p === 'default') { try { p = await Notification.requestPermission(); } catch (e) {} }
    if (p !== 'granted') {
      toast('لم يُسمح بالتنبيهات — اسمح بها للتطبيق من إعدادات الجهاز ثم أعد المحاولة', 4600);
      drawNotifSwitches();
      return;
    }
    if ((kind === 'prayer' || kind === 'athkar') && tmSettings().lat == null) {
      toast('نحتاج موقعك مرةً واحدة لحساب المواقيت', 3200); askLocation();
    }
  }
  prefs[kind] = on;
  LS.set('sidrah:notif', prefs);
  drawNotifSwitches();
  await scheduleAlerts();
  const label = { prayer: 'تنبيه الصلاة', athkar: 'تذكير الأذكار', siyam: 'تذكير صيام التطوع', wird: 'تذكير الورد' }[kind] || 'التنبيه';
  toast(on ? 'فُعّل ' + label + ' ✓' : 'أُوقف ' + label);
}

document.querySelectorAll('[data-notif]').forEach((b) => {
  b.onclick = () => setNotif(b.dataset.notif, b.getAttribute('aria-checked') !== 'true');
});
document.querySelectorAll('[data-pref]').forEach((b) => {
  b.onclick = () => {
    const p = notifPrefs();
    p[b.dataset.pref] = !p[b.dataset.pref];
    LS.set('sidrah:notif', p);
    drawNotifSwitches();
    if (b.dataset.pref === 'adhan') {
      toast(p.adhan ? (p.prayer ? 'سيُرفع الأذان عند دخول الوقت ✓' : 'فعّل «تنبيه دخول وقت الصلاة» ليُرفع الأذان عند الوقت')
                    : 'أُوقف صوت الأذان', 4200);
    }
  };
});

/* ——— صوت الأذان — تسجيلٌ مفحوص من أرشيف الإنترنت (مشاري العفاسي، المقام الحجازي) ——— */
const ADHAN = {
  other: 'https://archive.org/download/azan-alafasy/azan-hejaz-2014-other.mp3',
  fajr: 'https://archive.org/download/azan-alafasy/azan-hejaz-2014-al-fajer.mp3',
};
let adhanAudio = null;
function playAdhan(fajr) {
  stopAdhan();
  adhanAudio = new Audio(fajr ? ADHAN.fajr : ADHAN.other);
  adhanAudio.onended = stopAdhan;
  adhanAudio.play().catch(() => {});
  const s = $('#adhan-stop'), t = $('#adhan-test');
  if (s) s.hidden = false;
  if (t) t.textContent = '■ إيقاف';
}
function stopAdhan() {
  if (adhanAudio) { adhanAudio.onended = null; adhanAudio.pause(); adhanAudio = null; }
  const s = $('#adhan-stop'), t = $('#adhan-test');
  if (s) s.hidden = true;
  if (t) t.textContent = 'استمع';
}
if ($('#adhan-test')) $('#adhan-test').onclick = () => (adhanAudio ? stopAdhan() : playAdhan(false));
if ($('#adhan-stop')) $('#adhan-stop').onclick = stopAdhan;

function openTimes() {
  drawNotifSwitches();
  const sel = $('#tm-method');
  if (!sel.options.length) {
    sel.innerHTML = TM_METHODS.map((m) => '<option value="' + m.k + '">' + esc(m.name) + '</option>').join('');
    sel.onchange = () => { const st = tmSettings(); st.m = sel.value; LS.set('sidrah:tm', st); drawTimes(); };
    $('#tm-asr').onchange = () => { const st = tmSettings(); st.asr = +$('#tm-asr').value; LS.set('sidrah:tm', st); drawTimes(); };
    $('#tm-loc').onclick = askLocation;
    $('#q-compass').onclick = startCompass;
  }
  const st = tmSettings();
  if (st.lat == null) askLocation(); else drawTimes();
  push('times');
  show('#times', 'مواقيت الصلاة', true);
}

function askLocation() {
  if (!navigator.geolocation) { toast('جهازك لا يدعم تحديد الموقع'); return; }
  $('#tm-place').textContent = 'يُحدَّد موقعك…';
  navigator.geolocation.getCurrentPosition((pos) => {
    const st = tmSettings();
    st.lat = +pos.coords.latitude.toFixed(4);
    st.lng = +pos.coords.longitude.toFixed(4);
    if (!st.m) st.m = defaultMethod(st.lat, st.lng);
    LS.set('sidrah:tm', st);
    drawTimes();
  }, () => {
    $('#tm-place').textContent = 'تعذّر تحديد الموقع — اسمح للتطبيق بالوصول للموقع ثم اضغط «تحديد موقعي».';
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 6 * 3600 * 1000 });
}

function drawTimes() {
  const st = tmSettings();
  if (st.lat == null) return;
  const method = st.m || defaultMethod(st.lat, st.lng);
  $('#tm-method').value = method;
  $('#tm-asr').value = String(st.asr || 1);
  const now = new Date();
  const t = calcTimes(now, st.lat, st.lng, method, st.asr || 1);

  $('#tm-place').textContent =
    'موقعك: ' + st.lat.toFixed(2) + '° , ' + st.lng.toFixed(2) + '° · ' +
    now.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });

  const nowH = now.getHours() + now.getMinutes() / 60;
  let nextKey = null, nextIn = 99;
  PRAYERS.forEach(([k]) => {
    if (k === 'sunrise' || isNaN(t[k])) return;
    const d = t[k] - nowH;
    if (d > 0 && d < nextIn) { nextIn = d; nextKey = k; }
  });
  const box = $('#tm-next');
  if (nextKey) {
    const label = (PRAYERS.find((p) => p[0] === nextKey) || [])[1];
    const mins = Math.round(nextIn * 60);
    box.hidden = false;
    box.innerHTML = '<b>' + esc(label) + '</b><span>بعد ' +
      (mins >= 60 ? Math.floor(mins / 60) + ' ساعة و' + (mins % 60) + ' دقيقة' : mins + ' دقيقة') + '</span>';
  } else { box.hidden = true; }

  const list = $('#tm-list');
  list.innerHTML = '';
  PRAYERS.forEach(([k, label, em]) => {
    const row = el('div', 'tm-row' + (k === nextKey ? ' on' : '') + (k === 'sunrise' ? ' soft' : ''));
    row.innerHTML = '<span class="tm-em">' + em + '</span><b>' + esc(label) + '</b>' +
      '<span class="tm-h">' + hhmm(t[k]) + '</span>';
    list.appendChild(row);
  });

  const q = qiblaBearing(st.lat, st.lng);
  $('#q-deg').textContent = 'القبلة على ' + Math.round(q) + '° من الشمال — وجّه أعلى الجهاز إليها.';
  $('#q-needle').dataset.qibla = String(q);
  $('#q-needle').style.transform = 'rotate(' + q + 'deg)';
  scheduleAlerts();          // الموقع أو الطريقة تغيّرا ⇦ تُعاد جدولة التنبيهات
}

/* البوصلة: تدور الإبرة باتجاه القبلة بالنسبة لاتجاه الجهاز الحقيقي.
   iOS يطلب إذناً صريحاً بلمسة — ولذلك زرّ لا تشغيلٌ تلقائي. */
function startCompass() {
  const go = () => {
    window.addEventListener('deviceorientationabsolute', onHeading, true);
    window.addEventListener('deviceorientation', onHeading, true);
    toast('حرّك الجهاز في شكل ٨ لمعايرة البوصلة', 3200);
  };
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    DOE.requestPermission().then((r) => { if (r === 'granted') go(); else toast('لم يُسمح باستخدام البوصلة'); })
      .catch(() => toast('تعذّر تشغيل البوصلة'));
  } else if (DOE) { go(); } else { toast('جهازك لا يوفّر بوصلة'); }
}

function onHeading(e) {
  const n = $('#q-needle');
  if (!n) return;
  let heading = e.webkitCompassHeading;
  if (heading == null && e.absolute && e.alpha != null) heading = 360 - e.alpha;
  if (heading == null) return;
  const q = parseFloat(n.dataset.qibla || '0');
  n.style.transform = 'rotate(' + (q - heading) + 'deg)';
}

/* ============================ الأذكار ============================
   نصُّ الذكر وعدده وتخريجه وفضله — مكتوبٌ داخل الحزمة لا مسحوبٌ من شبكة،
   فيعمل بلا إنترنت من أول فتحة. وفي كل ذكرٍ **عدّادٌ باللمس**: تضغط البطاقة
   فينقص العدد حتى يتمّ، ويُحفظ تقدّمك ليومك فلا تُعيد ما أتممته. */

/* اليومُ **بتوقيت الجهاز** — كان toISOString (توقيت غرينتش) فيُصفَّر العدّاد في مصر
   والسعودية بعد منتصف الليل بساعتين أو ثلاث، ويتصل عدّادُ أذكار المساء بيومٍ مضى. */
const TODAY = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

function athState(key) {
  const o = LS.get('sidrah:ath:' + key, null);
  if (!o || o.d !== TODAY()) return { d: TODAY(), c: {} };
  return o;
}
function athSave(key, st) { LS.set('sidrah:ath:' + key, st); }

async function loadStatic(name) {
  const k = 'static:' + name;
  if (!state.cache[k]) state.cache[k] = await loadJSON('assets/static/' + name + '.json');
  return state.cache[k];
}

async function openAthkar() {
  let d;
  try { d = await loadStatic('athkar'); } catch (e) { toast('تعذّر فتح الأذكار'); return; }
  state.athkar = d;
  drawNotifSwitches();
  const box = $('#athkar-cats');
  box.innerHTML = '';
  box.appendChild(el('p', 'empty',
    d.cats.length + ' قسماً · ' + d.cats.reduce((a, c) => a + c.n, 0) + ' ذكراً بتخريجها'));
  d.cats.forEach((c) => {
    const st = athState(c.key);
    const done = c.items.filter((it, i) => (st.c[i] || 0) >= (it.n || 1)).length;
    const card = el('div', 'card');
    card.innerHTML = '<div class="thumb">' + c.icon + '</div>' +
      '<div class="meta"><b>' + esc(c.title) + '</b>' +
      '<small>' + esc(c.note || '') + '</small>' +
      '<div class="tagline"><span class="pill ok">' + c.n + ' ذكراً</span>' +
      (done ? '<span class="pill">أتممتَ ' + done + ' اليوم</span>' : '') + '</div></div>';
    card.onclick = () => openAthkarCat(c.key);
    box.appendChild(card);
  });
  push('athkar');
  show('#athkar', 'الأذكار', true);
}

function openAthkarCat(key) {
  const cat = state.athkar.cats.find((c) => c.key === key);
  if (!cat) return;
  state.athCat = cat;
  $('#ath-note').textContent = cat.note || '';
  drawAthkarItems();
  $('#ath-reset').onclick = () => { athSave(key, { d: TODAY(), c: {} }); drawAthkarItems(); };
  push('athkar:' + key);
  show('#athkar-cat', cat.title, true);
}

function drawAthkarItems() {
  const cat = state.athCat;
  const st = athState(cat.key);
  const box = $('#athkar-items');
  box.innerHTML = '';
  let done = 0;
  cat.items.forEach((it, i) => {
    const need = it.n || 1;
    const got = Math.min(need, st.c[i] || 0);
    if (got >= need) done++;
    const card = el('div', 'zikr' + (got >= need ? ' done' : ''));
    card.innerHTML =
      '<div class="z-txt">' + esc(it.t) + '</div>' +
      (it.f ? '<div class="z-fadl">الفضل: ' + esc(it.f) + '</div>' : '') +
      '<div class="z-foot"><span class="z-ref">' + esc(it.ref) + '</span>' +
      '<span class="z-count">' + (got >= need ? '✓ تمّ' : (need > 1 ? 'بقي ' + (need - got) + ' من ' + need : 'اضغط للعدّ')) + '</span></div>';
    card.onclick = () => {
      const s2 = athState(cat.key);
      s2.c[i] = Math.min(need, (s2.c[i] || 0) + 1);
      athSave(cat.key, s2);
      drawAthkarItems();
    };
    box.appendChild(card);
  });
  $('#ath-progress').textContent = 'أتممتَ ' + done + ' من ' + cat.items.length;
}

/* ================= أركان الإسلام وأشراط الساعة =================
   مستنداتٌ مكتوبة: دليلٌ ثم شرحٌ ثم وقفةٌ وعظية. الخلاف يُذكر ولا يُحسم
   بتجريح، ولا يُذكر عالِمٌ في سياق ردٍّ — شرطُ المالك، ويحرسه purity.py. */
const DOC_META = {
  arkan: { title: 'أركان الإسلام', note: 'خمسةُ أركانٍ بُني عليها الإسلام، ومعها أركان الإيمان الستة ومرتبة الإحسان — بالدليل والشرح والوقفات.' },
  signs: { title: 'أشراط الساعة', note: 'ما صحّ من علامات الساعة الصغرى والكبرى، ومعها الضوابط التي تحفظ من التنجيم وتحديد المواعيد.' },
};

async function openDocs(kind) {
  let d;
  try { d = await loadStatic(kind); } catch (e) { toast('تعذّر فتح القسم'); return; }
  state.docs = d; state.docKind = kind;
  $('#docs-note').textContent = DOC_META[kind].note;
  const box = $('#docs-list');
  box.innerHTML = '';
  d.docs.forEach((x, i) => {
    const card = el('div', 'card');
    card.innerHTML = '<div class="thumb">' + x.icon + '</div>' +
      '<div class="meta"><b>' + esc(x.title) + '</b><small>' + esc(x.sub || '') + '</small>' +
      '<div class="tagline"><span class="pill ok">' + x.sections.length + ' مبحثاً</span></div></div>';
    card.onclick = () => openDoc(kind, i);
    box.appendChild(card);
  });
  push('docs:' + kind);
  show('#docs', DOC_META[kind].title, true);
}

/* تنسيقٌ صغير: **نصّ** يصير عريضاً — بعد التهريب، فلا يمرّ وسمٌ من البيانات */
function fmt(t) { return esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }

function openDoc(kind, i) {
  const d = state.docs.docs[i];
  if (!d) return;
  state.docIndex = i;
  $('#d-icon').textContent = d.icon;
  $('#d-title').textContent = d.title;
  $('#d-sub').textContent = d.sub || '';
  const box = $('#doc-body');
  box.innerHTML = '';
  (d.sections || []).forEach((sec) => {
    const node = el('section', 'doc-sec');
    let h = sec.h ? '<h3>' + esc(sec.h) + '</h3>' : '';
    (sec.ev || []).forEach((e) => {
      h += '<blockquote class="ev ' + (e.k === 'آية' ? 'aya' : 'hadith') + '">' +
           '<span class="ev-k">' + esc(e.k) + '</span>' +
           '<p>' + esc(e.t) + '</p><cite>' + esc(e.ref) + '</cite></blockquote>';
    });
    (sec.p || []).forEach((x) => { h += '<p>' + fmt(x) + '</p>'; });
    if (sec.li && sec.li.length) {
      h += '<ul>' + sec.li.map((x) => '<li>' + fmt(x) + '</li>').join('') + '</ul>';
    }
    node.innerHTML = h;
    box.appendChild(node);
  });
  const list = state.docs.docs;
  $('#d-prev').disabled = i <= 0;
  $('#d-next').disabled = i >= list.length - 1;
  $('#d-prev').onclick = () => openDoc(kind, i - 1);
  $('#d-next').onclick = () => openDoc(kind, i + 1);
  push('doc:' + kind + ':' + i);
  show('#doc', d.title, true);
}

/* ============================ الابتهالات ============================
   بابٌ قائمٌ بذاته في التراث المصري: دعاءٌ مرتَّلٌ بصوتٍ مجرَّد. الملفات على
   خوادم الأرشيف المفتوح — نعرض ونشير ولا نستضيف، وكلُّ رابطٍ فُحص قبل نشره. */
async function openIbtihalat() {
  if (!state.ibt) {
    try { state.ibt = await loadJSON('assets/ibtihalat.json'); }
    catch (e) { toast('تعذّر فتح الابتهالات'); return; }
  }
  $('#ibt-note').textContent = state.ibt.note || '';
  const box = $('#mun-list');
  box.innerHTML = '';
  const list = state.ibt.munshidun || [];
  box.appendChild(el('p', 'empty', list.length + ' مبتهلاً · ' +
    list.reduce((a, m) => a + m.n, 0) + ' ابتهالاً'));
  list.forEach((m) => {
    const card = el('div', 'card');
    card.innerHTML = '<div class="thumb"><span style="font-size:20px">' +
      esc((m.name || '؟').trim().charAt(0)) + '</span></div>' +
      '<div class="meta"><b>' + esc(m.name) + '</b><small>' + esc(m.role || '') + '</small>' +
      '<div class="tagline"><span class="pill ok">' + m.n + ' ابتهالاً</span></div></div>';
    card.onclick = () => openMunshid(m.slug);
    box.appendChild(card);
  });
  push('ibtihalat');
  show('#ibtihalat', 'الابتهالات', true);
}

function openMunshid(slug) {
  const m = (state.ibt.munshidun || []).find((x) => x.slug === slug);
  if (!m) return;
  const box = $('#mun-tracks');
  box.innerHTML = '';
  box.appendChild(el('p', 'empty', (m.role || '') + ' · ' + m.n + ' ابتهالاً'));
  m.tracks.forEach((t) => box.appendChild(itemCard(t, 'audios')));
  push('munshid:' + slug);
  show('#munshid', m.name, true);
}

/* ============================ المشايخ ============================
   «الأكثر تأثيراً» هنا رقم لا رأي: ترتيب بعدد ما نُشر للشيخ في المصدر الرسمي،
   ثم بعدد الأبواب التي يتكلّم فيها. يُعاد حسابه في كل تحديث. */
async function loadSheikhs() {
  try { state.sheikhs = await loadJSON('assets/sheikhs/index.json'); }
  catch (e) { $('#sheikhs').closest('section').querySelectorAll('.row-head')[1].hidden = true; return; }
  renderSheikhs();
}

function sheikhCard(s) {
  const c = el('button', 's-card',
    `<span class="avatar">${esc((s.name || '؟').trim().charAt(0))}</span>` +
    `<b>${esc(s.name)}</b>` +
    (s.role ? `<i class="role">${esc(s.role)}</i>` : '') +
    `<small>${s.n} مادة</small>`);
  c.onclick = () => openSheikh(s.slug);
  return c;
}

/* المشايخ هجائياً مع بحثٍ بالاسم للوصول السريع (طلب المالك ٢٠٢٦-٠٩-١١).
   البحثُ يتحمّل الهمزة والتاء والتشكيل ويطابق أيَّ جزءٍ من الاسم أو الصفة:
   «الشعراوي» و«متولي» و«المسجد الحرام» كلُّها تصل. */
function sheikhsSorted() {
  return ((state.sheikhs && state.sheikhs.sheikhs) || []).slice().sort((a, b) => alphaCmp(a.name, b.name));
}

function sheikhMatch(list, q) {
  const f = norm((q || '').trim());
  if (!f) return list;
  const parts = f.split(/\s+/);
  return list.filter((s) => {
    const n = norm(s.name + ' ' + (s.role || ''));
    return parts.every((x) => n.indexOf(x) >= 0);
  });
}

function renderSheikhs() {
  const box = $('#sheikhs');
  box.innerHTML = '';
  const q = ($('#sheikh-search') || {}).value || '';
  const list = sheikhMatch(sheikhsSorted(), q);
  if (!list.length) { box.appendChild(el('p', 'empty', 'لا يوجد شيخٌ بهذا الاسم.')); return; }
  // بلا بحث: أوّلُ اثني عشر هجائياً و«الكل» للبقية · وبالبحث: كلُّ ما طابق
  (q.trim() ? list : list.slice(0, 12)).forEach((s) => box.appendChild(sheikhCard(s)));
}

function renderAllSheikhs() {
  const box = $('#sheikhs-all-list');
  box.innerHTML = '';
  const all = sheikhsSorted();
  const q = (($('#sheikhs-all-search') || {}).value || '').trim();
  const list = sheikhMatch(all, q);
  renderAzBar(all);
  box.appendChild(el('p', 'empty', q
    ? `${list.length} من ${all.length} يطابق «${esc(q)}»`
    : `${all.length} شيخاً ومصدراً — مرتّبون هجائياً`));
  let letter = '';
  list.forEach((s) => {
    const first = norm((s.name || '').trim()).charAt(0);
    if (!q && first !== letter) {
      letter = first;
      box.appendChild(el('h3', 'az-head', esc(letter))).id = 'az-' + letter;
    }
    const card = el('div', 'card');
    card.append(
      el('div', 'thumb', `<span style="font-size:20px">${esc((s.name || '؟').trim().charAt(0))}</span>`),
      el('div', 'meta',
        `<b>${esc(s.name)}</b>` + (s.role ? `<small class="role-line">${esc(s.role)}</small>` : '') +
        `<small>${s.n} مادة في ${s.topics} باباً</small>` +
        `<div class="tagline">` +
        KINDS.filter((k) => (s.counts || {})[k.k]).map((k) =>
          `<span class="pill">${k.label} ${s.counts[k.k]}</span>`).join('') + `</div>`));
    card.onclick = () => openSheikh(s.slug);
    box.appendChild(card);
  });
  if (!list.length) box.appendChild(el('p', 'empty', 'لا يوجد شيخٌ بهذا الاسم.'));
}

/* شريطُ الحروف: قفزةٌ إلى أوّل شيخٍ يبدأ اسمُه بالحرف — بلا تمريرٍ طويل */
function renderAzBar(all) {
  const bar = $('#az-bar');
  if (!bar) return;
  bar.innerHTML = '';
  [...new Set(all.map((s) => norm((s.name || '').trim()).charAt(0)))].forEach((L) => {
    const c = el('button', 'chip', esc(L));
    c.onclick = () => {
      const inp = $('#sheikhs-all-search');
      if (inp && inp.value) { inp.value = ''; renderAllSheikhs(); }
      const h = document.getElementById('az-' + L);
      if (h) h.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    bar.appendChild(c);
  });
}

async function openSheikh(slug) {
  let d;
  try { d = await loadJSON('assets/sheikhs/' + slug + '.json'); }
  catch (e) { toast('تعذّر فتح صفحة الشيخ'); return; }
  state.sheikh = d;
  $('#s-avatar').textContent = (d.name || '؟').trim().charAt(0);
  $('#s-name').textContent = d.name;
  $('#s-meta').innerHTML = (d.role ? `<span class="eg-badge">${esc(d.role)}</span> ` : '') +
    esc(d.n + ' مادة · ' + (d.topics || []).length + ' باباً: ' + (d.topics || []).slice(0, 4).join(' · '));
  // نفتح على القسم الأغنى عند هذا الشيخ لا على أول قسم — كثير منهم كتبه أكثر من مرئياته
  const richest = KINDS.slice().sort((a, b) => (d[b.k] || []).length - (d[a.k] || []).length)[0];
  // المرئيات أولاً (طلب المالك: «كل شيخ تحته فيديوهاته») — ثم الأغنى إن لم يكن له مرئيات
  state.sTab = (d.videos || []).length ? 'videos' : ((d[richest.k] || []).length ? richest.k : 'videos');
  renderSheikhTabs(); renderSheikhItems();
  push('sheikh:' + slug);
  show('#sheikh', d.name, true);
}

function renderSheikhTabs() {
  const nav = $('#s-tabs');
  nav.innerHTML = '';
  KINDS.forEach((k) => {
    const list = state.sheikh[k.k] || [];
    if (!list.length) return;
    const b = el('button', 'tab', `${k.em} ${k.label} <span style="opacity:.7">${list.length}</span>`);
    b.setAttribute('aria-selected', state.sTab === k.k);
    b.onclick = () => { state.sTab = k.k; renderSheikhTabs(); renderSheikhItems(); };
    nav.appendChild(b);
  });
}

function renderSheikhItems() {
  const box = $('#s-items');
  box.innerHTML = '';
  const rows = state.sheikh[state.sTab] || [];
  if (!rows.length) { box.appendChild(el('p', 'empty', 'لا توجد مواد في هذا القسم.')); return; }
  rows.forEach((it) => box.appendChild(itemCard(it, state.sTab)));
}

/* ============================ التقويم الهجري وصيام التطوع ============================ */
function calItem(it, extraTitle) {
  const c = el('div', 'cal-item ' + (it.kind || ''));
  c.innerHTML = `<b>${esc(extraTitle || it.title)}</b><p>${esc(it.t)}</p><small>${esc(it.ref)}</small>`;
  return c;
}
async function openCalendar() {
  let c;
  try { c = await loadStatic('calendar'); } catch (e) { toast('تعذّر فتح التقويم'); return; }
  drawNotifSwitches();
  const now = new Date();
  const h = hijri(now);
  const box = $('#cal-today');
  const greg = now.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  box.innerHTML = h
    ? `<b class="cal-h">${AR_NUM(h.d)} ${esc(HIJRI_MONTHS[h.m - 1])} ${AR_NUM(h.y)} هـ</b><span>${esc(greg)}</span>`
    : `<span>${esc(greg)}</span><span>جهازك لا يدعم التقويم الهجري</span>`;
  const today = fastingOn(now);
  if (today.length) today.forEach((k) => box.appendChild(calItem(c.items[k], 'اليوم: ' + calTitle(k, now))));
  else if (h) box.appendChild(el('span', 'cal-none', 'لا صيامَ مخصوصٌ اليوم — والصيامُ المطلق مشروعٌ في غير أيام النهي.'));

  const list = $('#cal-list');
  list.innerHTML = '';
  for (let i = 1; i <= 45; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
    const hh = hijri(d);
    if (!hh) break;
    const keys = fastingOn(d).filter((k) => k === 'eid_fitr' || k === 'eid_adha' || (k === 'tashreeq' && hh.d === 11)
      || (CAL_REMIND[k] && CAL_REMIND[k](hh)));
    if (!keys.length) continue;
    const row = el('div', 'card cal-row');
    row.innerHTML = `<div class="thumb">${AR_NUM(hh.d)}</div><div class="meta">` +
      `<b>${esc(keys.map((k) => calTitle(k, d)).join(' · '))}</b>` +
      `<small>${esc(d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }))} · ` +
      `${AR_NUM(hh.d)} ${esc(HIJRI_MONTHS[hh.m - 1])}</small></div>`;
    row.onclick = () => {
      const open = row.nextSibling && row.nextSibling.classList && row.nextSibling.classList.contains('cal-more');
      if (open) { row.nextSibling.remove(); return; }
      const more = el('div', 'cal-more');
      keys.forEach((k) => more.appendChild(calItem(c.items[k], calTitle(k, d))));
      row.after(more);
    };
    list.appendChild(row);
  }
  $('#cal-note').textContent = c.note || '';
  push('calendar');
  show('#calendar', 'التقويم الهجري', true);
}

/* ============================ أسماء الله الحسنى ============================ */
async function openAsma() {
  let a;
  try { a = await loadStatic('asma'); } catch (e) { toast('تعذّر فتح الأسماء'); return; }
  $('#asma-note').textContent = a.note || '';
  const q = $('#asma-q');
  const draw = () => {
    const f = norm(q.value.trim());
    const box = $('#asma-list');
    box.innerHTML = '';
    a.names.filter((x) => !f || norm(x.name + ' ' + x.m).indexOf(f) >= 0).forEach((x) => {
      const c = el('button', 'asma-card');
      c.innerHTML = `<b>${esc(x.name)}</b><p>${esc(x.m)}</p><small>${esc(x.ref)}</small>`;
      c.onclick = async () => {                    // الضغط يفتح موضعَ الاسم من المصحف
        if (!state.quran) { try { state.quran = await loadJSON('assets/quran/index.json'); } catch (e) { return; } }
        const s = state.quran.surahs.find((z) => z.n === x.s);
        let p = s ? s.page : 1;
        for (let pg = p; pg <= 604; pg++) {
          const pd = await loadJSON('assets/quran/p/' + pg + '.json').catch(() => null);
          if (pd && pd.ayat.some((y) => y.s === x.s && y.a === x.a)) { p = pg; break; }
          if (pd && pd.ayat.some((y) => y.s > x.s)) break;
        }
        openPage(p, x.s, x.a);
      };
      box.appendChild(c);
    });
    if (!box.children.length) box.appendChild(el('p', 'empty', 'لا اسمَ يطابق البحث.'));
  };
  q.oninput = draw;
  draw();
  push('asma');
  show('#asma', 'أسماء الله الحسنى', true);
}

/* ============================ المسبحة ============================ */
const TASBIH = ['سُبْحَانَ اللَّهِ', 'الْحَمْدُ لِلَّهِ', 'اللَّهُ أَكْبَرُ', 'لَا إِلَهَ إِلَّا اللَّهُ',
  'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', 'سُبْحَانَ اللَّهِ الْعَظِيمِ', 'أَسْتَغْفِرُ اللَّهَ',
  'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ'];
function tbState() {
  const o = LS.get('sidrah:tasbih', null) || {};
  if (o.d !== TODAY()) { o.d = TODAY(); o.c = {}; }
  o.c = o.c || {};
  o.sel = o.sel || 0;
  o.target = o.target == null ? 33 : o.target;
  return o;
}
function openTasbih() {
  const sel = $('#tb-dhikr');
  if (!sel.options.length) {
    sel.innerHTML = TASBIH.map((t, i) => `<option value="${i}">${esc(t)}</option>`).join('');
    sel.onchange = () => { const s = tbState(); s.sel = +sel.value; LS.set('sidrah:tasbih', s); drawTasbih(); };
    $('#tb-target').onchange = () => { const s = tbState(); s.target = +$('#tb-target').value; LS.set('sidrah:tasbih', s); drawTasbih(); };
    $('#tb-count').onclick = () => {
      const s = tbState();
      const n = (s.c[s.sel] || 0) + 1;
      s.c[s.sel] = n;
      LS.set('sidrah:tasbih', s);
      if (s.target && n % s.target === 0) {
        try { if (navigator.vibrate) navigator.vibrate([70, 40, 70]); } catch (e) {}
        toast('أتممتَ ' + AR_NUM(s.target) + ' — تقبّل الله', 1600);
      }
      drawTasbih();
    };
    $('#tb-reset').onclick = () => { const s = tbState(); s.c[s.sel] = 0; LS.set('sidrah:tasbih', s); drawTasbih(); };
  }
  const s = tbState();
  sel.value = String(s.sel);
  $('#tb-target').value = String(s.target);
  drawTasbih();
  push('tasbih');
  show('#tasbih', 'المسبحة', true);
}
function drawTasbih() {
  const s = tbState();
  const n = s.c[s.sel] || 0;
  $('#tb-text').textContent = TASBIH[s.sel];
  $('#tb-n').textContent = AR_NUM(n);
  $('#tb-goal').textContent = s.target
    ? 'الدورة ' + AR_NUM(Math.floor(n / s.target) + 1) + ' · ' + AR_NUM(n % s.target) + ' من ' + AR_NUM(s.target)
    : 'بلا حدّ';
  const tot = Object.values(s.c).reduce((a, b) => a + b, 0);
  $('#tb-total').textContent = 'مجموعُ ذكرك اليوم: ' + AR_NUM(tot);
}

/* ============================ حاسبة الزكاة ============================ */
const ZK_FIELDS = ['basis', 'gold-price', 'silver-price', 'cash', 'trade', 'recv', 'gold-g', 'gold-k', 'silver-g', 'debt', 'jewel-g', 'jewel'];
function openZakat() {
  const saved = LS.get('sidrah:zakat', null) || {};
  ZK_FIELDS.forEach((f) => {
    const e = $('#zk-' + f);
    if (!e) return;
    if (f === 'jewel') e.checked = !!saved[f];
    else if (saved[f] != null && saved[f] !== '') e.value = saved[f];
    e.oninput = drawZakat;
    e.onchange = drawZakat;
  });
  drawZakat();
  push('zakat');
  show('#zakat', 'حاسبة الزكاة', true);
}
function drawZakat() {
  const v = {};
  ZK_FIELDS.forEach((f) => { const e = $('#zk-' + f); v[f] = f === 'jewel' ? e.checked : e.value; });
  LS.set('sidrah:zakat', v);
  const r = zakatCalc({ basis: v.basis, goldPrice: v['gold-price'], silverPrice: v['silver-price'], cash: v.cash,
    trade: v.trade, recv: v.recv, goldG: v['gold-g'], karat: v['gold-k'], silverG: v['silver-g'], debt: v.debt,
    jewel: v.jewel, jewelG: v['jewel-g'] });
  const num = (x) => AR_NUM((Math.round(x * 100) / 100).toLocaleString('en-US'));
  const out = $('#zk-out');
  let html = '';
  if (r.missing.indexOf('gold') >= 0) html += '<p>⚠ أدخِل سعرَ جرام الذهب عيار ٢٤ اليوم.</p>';
  if (r.missing.indexOf('silver') >= 0) html += '<p>⚠ أدخِل سعرَ جرام الفضة اليوم.</p>';
  if (r.nisab) {
    html += `<p>صافي مالك الزكويّ: <b>${num(r.net)}</b></p><p>النصاب اليوم: <b>${num(r.nisab)}</b></p>`;
    html += r.due
      ? `<p class="due">الزكاة الواجبة: ${num(r.zakat)} (ربع العشر ٢٫٥٪)</p>`
      : '<p>لم يبلغ مالُك النصاب — لا زكاةَ عليه الآن.</p>';
  }
  out.innerHTML = html || '<p>أدخِل أموالك وسعرَ الجرام لتظهر النتيجة.</p>';
}

/* ============================ الورد اليومي وخطة الختمة ============================ */
function khatma() { return LS.get('sidrah:khatma', null); }
function khatmaProgress(p) {
  const plan = khatma();
  if (!plan) return;
  const r = plan.reached || 0;
  if (p >= r && p <= r + 2) { plan.reached = Math.max(r, p); LS.set('sidrah:khatma', plan); }  // قراءةٌ متتابعة لا قفزٌ بالبحث
}
function renderKhatma() {
  const box = $('#kh-body');
  if (!box) return;
  drawNotifSwitches();
  const plan = khatma();
  if (!plan) {
    box.innerHTML = '<b>📖 خطة ختمة القرآن</b>' +
      '<p class="row-note">اختر مدّة الختمة، فيُقسَم المصحف (٦٠٤ صفحات) على الأيام، ويُحفظ تقدّمك وأنت تقرأ متتابعاً.</p>' +
      '<div class="q-jump"><select id="kh-days">' +
      [7, 10, 15, 30, 60, 90, 120].map((d) => `<option value="${d}"${d === 30 ? ' selected' : ''}>في ${AR_NUM(d)} يوماً — ${AR_NUM(Math.ceil(604 / d))} صفحة يومياً</option>`).join('') +
      '</select><button id="kh-start" class="play-sm">ابدأ</button></div>';
    $('#kh-start').onclick = () => {
      LS.set('sidrah:khatma', { days: +$('#kh-days').value, start: localISO(new Date()), reached: 0 });
      renderKhatma();
      toast('بدأت ختمتك — بارك الله فيك');
    };
    return;
  }
  const w = khatmaToday(plan, new Date());
  const pct = Math.round(100 * w.done / 604);
  box.innerHTML = `<b>📖 ختمتك في ${AR_NUM(plan.days)} يوماً · اليوم ${AR_NUM(Math.min(w.day, plan.days))}</b>` +
    `<div class="progress kh-bar"><i style="width:${pct}%"></i></div>` +
    `<p class="row-note" id="kh-state">قرأتَ حتى صفحة ${AR_NUM(w.done)} (${AR_NUM(pct)}٪) · وِردُ اليوم: من ص${AR_NUM(w.from)} إلى ص${AR_NUM(w.to)}` +
    (w.behind ? ` · عليك ${AR_NUM(w.behind)} صفحةً من أيامٍ سابقة` : '') + '</p>' +
    '<div class="q-jump"><button id="kh-open" class="play-sm">افتح وِردك</button><button id="kh-reset" class="ghost">خطة جديدة</button></div>';
  if (w.done >= 604) $('#kh-state').textContent = 'ختمتَ القرآن الكريم — تقبّل الله منك.';
  $('#kh-open').onclick = () => openPage(Math.min(604, (plan.reached || 0) + 1));
  $('#kh-reset').onclick = () => {
    if (confirm('إلغاء الخطة الحالية والبدء من جديد؟')) { LS.set('sidrah:khatma', null); renderKhatma(); }
  };
}

/* ============================ تكرار الآيات للحفظ ============================
   تلاوةٌ بالآية من EveryAyah (مجاني) — المجلّدات مفحوصةٌ واحداً واحداً (٢٠٢٦-٠٩-١٣). */
const EVERYAYAH = {
  'عبد الباسط عبد الصمد': 'Abdul_Basit_Murattal_192kbps', 'محمود خليل الحصري': 'Husary_128kbps',
  'محمد صديق المنشاوي': 'Minshawy_Murattal_128kbps', 'عبد الرحمن السديس': 'Abdurrahmaan_As-Sudais_192kbps',
  'سعود الشريم': 'Saood_ash-Shuraym_128kbps', 'ماهر المعيقلي': 'MaherAlMuaiqly128kbps',
  'ياسر الدوسري': 'Yasser_Ad-Dussary_128kbps', 'عبد الله عواد الجهني': 'Abdullaah_3awwaad_Al-Juhaynee_128kbps',
  'صلاح البدير': 'Salah_Al_Budair_128kbps',
};
const hifz = { list: [], i: 0, audio: null, folder: '' };
function setupHifz(d) {
  const from = $('#hz-from'), to = $('#hz-to'), rc = $('#hz-reciter');
  if (!from) return;
  const nameOf = (n) => ((state.quran.surahs.find((x) => x.n === n) || {}).name || n);
  const opts = d.ayat.map((a, i) => `<option value="${i}">${esc(nameOf(a.s))} ${AR_NUM(a.a)}</option>`).join('');
  from.innerHTML = opts;
  to.innerHTML = opts;
  from.value = '0';
  to.value = String(d.ayat.length - 1);
  if (!rc.options.length) {
    rc.innerHTML = Object.keys(EVERYAYAH).map((n) => `<option>${esc(n)}</option>`).join('');
    rc.value = LS.get('sidrah:hzreciter', Object.keys(EVERYAYAH)[0]) || Object.keys(EVERYAYAH)[0];
    rc.onchange = () => LS.set('sidrah:hzreciter', rc.value);
  }
  $('#hz-play').onclick = () => {
    let a = +from.value, b = +to.value;
    if (a > b) [a, b] = [b, a];
    const rep = +$('#hz-rep').value || 1;
    hifz.list = [];
    for (let i = a; i <= b; i++) for (let r = 0; r < rep; r++) hifz.list.push(d.ayat[i]);
    hifz.folder = EVERYAYAH[rc.value] || EVERYAYAH['عبد الباسط عبد الصمد'];
    hifz.i = 0;
    hifzNext();
  };
  $('#hz-stop').onclick = hifzStop;
}
function hifzNext() {
  if (hifz.i >= hifz.list.length) { hifzStop(); toast('تمّ التكرار — بارك الله في حفظك'); return; }
  const a = hifz.list[hifz.i];
  if (!hifz.audio) {
    hifz.audio = new Audio();
    hifz.audio.onended = () => { hifz.i++; hifzNext(); };
    hifz.audio.onerror = () => { toast('تعذّر تشغيل الآية — تحقّق من الاتصال'); hifzStop(); };
  }
  hifz.audio.src = 'https://everyayah.com/data/' + hifz.folder + '/' + String(a.s).padStart(3, '0') + String(a.a).padStart(3, '0') + '.mp3';
  hifz.audio.play().catch(() => {});
  $('#m-text').querySelectorAll('.aya.on').forEach((x) => x.classList.remove('on'));
  const sp = $('#m-text').querySelector(`.aya[data-s="${a.s}"][data-a="${a.a}"]`);
  if (sp) { sp.classList.add('on'); sp.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  $('#hz-stop').hidden = false;
  $('#hz-play').hidden = true;
  $('#hz-state').textContent = 'الآية ' + AR_NUM(a.a) + ' · ' + AR_NUM(hifz.i + 1) + ' من ' + AR_NUM(hifz.list.length);
}
function hifzStop() {
  if (hifz.audio) { hifz.audio.onended = null; hifz.audio.onerror = null; hifz.audio.pause(); hifz.audio = null; }
  hifz.list = [];
  const s = $('#hz-stop'), p = $('#hz-play'), t = $('#hz-state');
  if (s) s.hidden = true;
  if (p) p.hidden = false;
  if (t) t.textContent = '';
}

/* ============================ المحفوظات ============================ */
function renderFavs() {
  const box = $('#fav-list');
  box.innerHTML = '';
  const list = favs();
  if (!list.length) { box.appendChild(el('p', 'empty', 'لم تحفظ شيئاً بعد. اضغط ☆ على أي مادة لحفظها هنا.')); return; }
  list.forEach((it) => box.appendChild(itemCard(it, it.kind || 'videos')));
}

/* ============================ البحث ============================ */
const TASHKEEL = /[ؗ-ًؚ-ْٰـ]/g;
function norm(s) {
  return String(s || '').replace(TASHKEEL, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').toLowerCase();
}

/* ترتيبٌ هجائيّ: تُوحَّد صورُ الألف والياء والتاء ثم يُقارَن بالعربية —
   فلا يتفرّق «أحمد» و«إبراهيم» و«احمد» في مواضع مختلفة */
function alphaCmp(a, b) { return norm(a).localeCompare(norm(b), 'ar'); }

async function ensureSearch() {
  if (state.search) return state.search;
  state.search = await loadJSON('assets/search.json');
  state.search.forEach((x) => { x._n = norm(x.t + ' ' + (x.a || '') + ' ' + (x.p || '')); });
  return state.search;
}

let tmr = null;
$('#q').addEventListener('input', (e) => {
  clearTimeout(tmr);
  const raw = e.target.value.trim();
  tmr = setTimeout(() => runSearch(raw), 220);
});

async function runSearch(raw) {
  const box = $('#search-results');
  if (raw.length < 2) { box.hidden = true; $('#grid-wrap').hidden = false; return; }
  let idx;
  try { idx = await ensureSearch(); } catch (e) { toast('تعذّر تحميل فهرس البحث'); return; }

  const words = norm(raw).split(/\s+/).filter((w) => w.length > 1);
  const hits = [];
  idx.forEach((x) => {
    let s = 0;
    words.forEach((w) => { if (x._n.indexOf(w) >= 0) s += 1; });
    if (s) hits.push([s, x]);
  });
  hits.sort((a, b) => b[0] - a[0]);

  box.innerHTML = '';
  box.hidden = false;
  $('#grid-wrap').hidden = true;
  if (!hits.length) { box.appendChild(el('p', 'empty', 'لا نتائج. جرّب كلمة أخرى أقصر.')); return; }
  box.appendChild(el('p', 'empty', `${hits.length} نتيجة — أقربها للسؤال أولاً`));
  hits.slice(0, 80).forEach(([, x]) => {
    // الأذكار والمستندات نصٌّ مكتوب لا ملفّ يُشغَّل — تفتح في مكانها لا في المشغّل
    if (x.k === 'athkar' || x.k === 'doc') {
      const card = el('div', 'card');
      card.innerHTML = '<div class="thumb">' + (x.k === 'athkar' ? '🕊️' : '📗') + '</div>' +
        '<div class="meta"><b>' + esc(x.t) + '</b>' +
        (x.a ? '<small>' + esc(x.a) + '</small>' : '') +
        '<div class="tagline"><span class="pill ok">' +
        (x.k === 'athkar' ? 'ذكر' : 'مبحث') + '</span>' +
        '<span class="pill">' + esc(x.p) + '</span></div></div>';
      card.onclick = () => openFromSearch(x.i);
      box.appendChild(card);
      return;
    }
    const card = itemCard({ id: x.i, title: x.t, by: x.a ? [x.a] : [], desc: '', img: x.g, url: x.u, ext: x.e, size: x.s }, x.k);
    card.querySelector('.tagline').appendChild(el('span', 'pill', esc(x.p)));
    box.appendChild(card);
  });
}

/* فتح نتيجةٍ مكتوبة: athkar:<قسم>:<رقم> أو doc:<نوع>:<رقم> */
async function openFromSearch(id) {
  const parts = String(id).split(':');
  if (parts[0] === 'athkar') {
    if (!state.athkar) { try { state.athkar = await loadStatic('athkar'); } catch (e) { return; } }
    openAthkarCat(parts[1]);
  } else if (parts[0] === 'doc') {
    const kind = parts[1];
    if (!state.docs || state.docKind !== kind) {
      try { state.docs = await loadStatic(kind); state.docKind = kind; }
      catch (e) { toast('تعذّر فتح القسم'); return; }
    }
    openDoc(kind, parseInt(parts[2], 10) || 0);
  }
}

/* ————— عامل الخدمة —————
   نسخة جديدة تُفعَّل ⇦ نعيد التحميل مرة واحدة، حتى لا يبقى عند أحد ملف قديم
   من الكاش فتظهر له واجهة مكسورة بعد التحديث. */
if ('serviceWorker' in navigator && !EMBED && location.protocol !== 'file:') {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    /* `updateViaCache:'none'` يمنع المتصفح من تقديم sw.js من كاش HTTP — بدونها
       يبقى عند بعض الأجهزة عاملُ خدمةٍ قديم أسبوعاً كاملاً فلا يصلهم التحديث.
       ثم نسأل عن نسخةٍ جديدة عند كل فتحٍ وكل عودةٍ للتطبيق: التحديث يصل لمن
       ثبّت التطبيق بلا أن يفعل شيئاً، ولا يحتاج متجراً. */
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      const ask = () => { try { reg.update(); } catch (e) {} };
      ask();
      document.addEventListener('visibilitychange', () => { if (!document.hidden) ask(); });
      setInterval(ask, 60 * 60 * 1000);
    }).catch(() => {});
  });
}

if (location.protocol === 'file:' && !EMBED) {
  document.getElementById('intro').hidden = true;
  document.getElementById('grid').innerHTML =
    '<p class="empty">لا يمكن تشغيل التطبيق بفتح الملف مباشرة.<br>' +
    'شغّل ملف <b>تشغيل التطبيق.bat</b> الموجود في مجلد المشروع، أو ارفع مجلد www على استضافة.</p>';
} else {
  /* ————— التثبيت على الجهاز —————
   أندرويد وويندوز: المتصفح يمنحنا حدثاً فنعرض زرّاً حقيقياً.
   **آيفون لا يمنح شيئاً**: لا يوجد `beforeinstallprompt` في سفاري أصلاً،
   والتثبيت عنده يدويّ بزرّ المشاركة. فمن انتظر زرّاً على آيفون انتظر ما لا
   يأتي — ولذلك نشرح له الخطوتين في مكانهما بدل أن نتركه يظنّ أن التطبيق
   «لا ينزل». ومن فتح الرابط بكروم على آيفون نقول له: افتحه بسفاري، فآيفون
   لا يُثبّت من متصفّحٍ آخر. */
/* أيقونة «المشاركة» في آيفون مرسومةٌ هنا لا محرفاً: محرف SF Symbols يظهر
   مربّعاً فارغاً على غير أجهزة آبل، ومن رآه على حاسوبه أو نسخ الشرح ارتاب. */
const SHARE_SVG = '<svg class="ios-share" viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M12 3l3.5 3.5-1.4 1.4L13 6.8V15h-2V6.8L9.9 7.9 8.5 6.5 12 3z"/>' +
  '<path d="M5 11h3v2H6.5v7h11v-7H16v-2h3v11H5V11z"/></svg>';

(function installable() {
  const host = $('#lib');
  if (!host) return;

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const iosOtherBrowser = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua);
  /* ⚠ من فتح الرابط من داخل واتساب أو فيسبوك يقع في متصفّحٍ مصغّر (WKWebView)
     **لا يملك خيار «إضافة إلى الشاشة الرئيسية»** — فيتبع خطواتنا ولا يجدها
     فيحسب التطبيق معطوباً. ولا يُكشف بالـUA لأن واتساب ينتحل هوية سفاري
     بالحرف؛ الفارق الموثوق أن `navigator.standalone` **مُعرَّف في سفاري
     الحقيقي** (false في تبويب عادي) و**غير مُعرَّف** في أي WKWebView. */
  const inAppUA = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|LinkedInApp|Snapchat|MicroMessenger|WhatsApp|GSA\//i.test(ua);
  const iosInApp = isIOS && !iosOtherBrowser &&
                   (inAppUA || typeof navigator.standalone === 'undefined');
  const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                     navigator.standalone === true;

  if (standalone || LS.get('sidrah:hide_install', false)) return;

  function banner(html) {
    const box = el('div', 'install-tip', html);
    const x = el('button', 'tip-x', '✕');
    x.title = 'إخفاء';
    x.onclick = () => { LS.set('sidrah:hide_install', true); box.remove(); };
    box.appendChild(x);
    host.insertBefore(box, host.firstChild);
    return box;
  }

  /* `x-safari-https` مخطّطُ آبل الذي يخرج من المتصفّح المصغّر إلى سفاري.
     يُرفض أحياناً بلا خطأ، فنُتبعه بنسخ الرابط حتى لا يعلق المستخدم. */
  function safariJump() {
    const t = Date.now();
    try { location.href = location.href.replace(/^https:\/\//, 'x-safari-https://'); } catch (e) {}
    setTimeout(async () => {
      if (Date.now() - t > 1400 || document.hidden) return;
      try { await navigator.clipboard.writeText(location.href);
            toast('نُسخ الرابط — افتح Safari والصقه', 5000); }
      catch (e) { toast(location.href, 6000); }
    }, 1200);
  }

  if (isIOS) {
    if (iosInApp) {
      const b = banner(
        '<b>لن تجد «إضافة إلى الشاشة الرئيسية» هنا</b>' +
        '<small>أنت داخل متصفّح واتساب/فيسبوك المصغّر، وهو <b>لا يملك هذا ' +
        'الخيار أصلاً</b> — لذلك بدا التطبيق كأنه لا يُثبَّت. اضغط الزرّ ' +
        'بالأسفل لتنتقل إلى <span dir="ltr">Safari</span>، أو زرّ ' +
        '<b>⋯</b> أعلى الشاشة ← <b>«فتح في Safari»</b>، ثم المشاركة ' +
        SHARE_SVG + ' ← <b>«إضافة إلى الشاشة الرئيسية»</b>.</small>');
      const j = el('button', 'tip-btn', 'افتح في Safari');
      j.onclick = safariJump;
      b.appendChild(j);
      return;
    }
    if (iosOtherBrowser) {
      const b = banner(
        '<b>ثبّته من زرّ المشاركة في متصفّحك</b>' +
        '<small>في آيفون ١٦٫٤ فأحدث يُثبّت كروم وإيدج وفَيَرفُكس من قائمتهم: ' +
        'زرّ المشاركة ← «إضافة إلى الشاشة الرئيسية». ولو لم تجد الخيار فافتح ' +
        'الرابط في <span dir="ltr">Safari</span> — وهو الطريق المضمون.</small>');
      const j = el('button', 'tip-btn', 'افتح في Safari');
      j.onclick = safariJump;
      b.appendChild(j);
    } else {
      banner(
        '<b>على آيفون لا يوجد زرّ تحميل — «إضافة إلى الشاشة» هي التثبيت</b>' +
        '<small>آبل لا تسمح لأيّ موقع بزرّ تثبيت. والإضافة ليست اختصاراً ' +
        'ناقصاً: تصير أيقونةً حقيقية على شاشتك، تفتح بلا شريط متصفّح، ' +
        'وتعمل بلا إنترنت.<br><br>' +
        '<span class="tip-n">١</span> اضغط زرّ المشاركة ' +
        SHARE_SVG + ' في شريط سفاري (أسفل الشاشة).<br>' +
        '<span class="tip-n">٢</span> انزل واختر <b>«إضافة إلى الشاشة الرئيسية»</b> ' +
        'ثم <b>«إضافة»</b>.<br>يفتح بعدها كتطبيقٍ كامل بلا شريط متصفح، ويعمل بلا إنترنت.' +
        '<br><br>ثبّتّه قبلُ وما زال يفتح داخل المتصفّح؟ احذف الأيقونة القديمة ' +
        'وأعِد الإضافة — آيفون يقرأ الإعدادات مرةً واحدة لحظةَ الإضافة.</small>');
    }
    return;
  }

  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    if ($('.install-btn')) return;
    const b = el('button', 'ghost install-btn', '⤓ ثبّت التطبيق على جهازك');
    b.onclick = async () => {
      if (!deferred) return;
      deferred.prompt();
      const c = await deferred.userChoice;
      if (c.outcome === 'accepted') { b.remove(); toast('تم تثبيت التطبيق على جهازك'); }
      deferred = null;
    };
    host.appendChild(b);
  });
})();

/* اختصارات أيقونة التطبيق: ?go=quran أو ?go=books */
function applyShortcut() {
  const go = new URLSearchParams(location.search).get('go');
  if (go === 'quran') setTimeout(openQuran, 60);
  else if (go === 'books') setTimeout(openBooks, 60);
  else if (go === 'athkar') setTimeout(openAthkar, 60);
  else if (go && go.indexOf('athkar:') === 0) {       // من تنبيه الأذكار: يفتح القسم نفسه
    setTimeout(async () => { await openAthkar(); openAthkarCat(go.slice(7)); }, 60);
  }
  else if (go === 'times') setTimeout(openTimes, 60);
  else if (go === 'calendar') setTimeout(openCalendar, 60);
  else if (go === 'asma') setTimeout(openAsma, 60);
  else if (go === 'tasbih') setTimeout(openTasbih, 60);
  else if (go === 'zakat') setTimeout(openZakat, 60);
  else if (go === 'khatma') setTimeout(openQuran, 60);
  else if (go === 'ibtihalat') setTimeout(openIbtihalat, 60);
  else if (go === 'arkan') setTimeout(() => openDocs('arkan'), 60);
  else if (go === 'signs') setTimeout(() => openDocs('signs'), 60);
}

boot().then(applyShortcut, applyShortcut);
}
