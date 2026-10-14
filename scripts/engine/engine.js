// Рушій: час t (секунди) → один кадр. Детермінізм: однаковий t завжди дає той самий кадр (усі випадкові числа — із зерном).
// Часова шкала керується ритмічною сіткою: 128 BPM; кожен сегмент займає кілька восьмих нот (див. eighths в eras.js).
(() => {
// Розмір полотна: ?w=1080&h=1920 (передаються через render.py --width/--height) > window.FILM_SIZE = [w, h] в eras.js > 1920×1080.
// Одноразовий U.setStage: переходи, камера й бібліотеки підлаштовуються; для вертикального фільму сцени слід компонувати за window.STAGE (або CAM/UI тощо). Сцени 35 мистецьких стилів розроблено лише для горизонтального формату.
const qs = new URLSearchParams(location.search), qw = +qs.get('w'), qh = +qs.get('h');
const [W, H] = qw > 0 && qh > 0 ? [qw, qh] : Array.isArray(window.FILM_SIZE) ? window.FILM_SIZE.map(Number) : [1920, 1080];
window.U.setStage(W, H);
const cv = document.getElementById('c');
cv.width = W; cv.height = H; window.__size = [W, H];
const ctx = cv.getContext('2d');
window.__canvas = cv;

const EIGHTH = 60 / (window.BPM || 128) / 2;   // 0.234375s при 128 BPM; для фільму можна задати window.BPM
// Тривалість сегмента: eighths (число восьмих нот, у ритм) або dur (секунди, для розбивки пояснювального відео за озвученням). Якщо dur задано, він має пріоритет.
let acc = 0;
for (const e of ERAS) { e.t0 = acc; acc += e.dur != null ? e.dur : e.eighths * EIGHTH; e.t1 = acc; }
// Тривалість фільму = t1 останнього сегмента; window.FILM_DURATION має пріоритет. render.py і попередній перегляд читають window.__total.
window.__total = window.FILM_DURATION || ERAS[ERAS.length - 1].t1;
ERAS[ERAS.length - 1].t1 = 1e9;

// Позаекранні буфери: A = попередній сегмент, B = поточний
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const bufA = mk(), bufB = mk(), bufT = mk();
window.__mk = mk;

// ---------- Ресурси ----------
const IMG = {};
function load(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(src); im.src = src; });
}
async function boot() {
  if (window.__bootErrors && __bootErrors.length) { window.__bootFailed = __bootErrors.join('\n'); console.error('BOOT FAILED\n' + window.__bootFailed); return; }
  const list = new Set();
  for (const e of ERAS) (e.assets || []).concat(e.plate ? [e.plate] : []).forEach(s => list.add(s));
  (window.EXTRA_ASSETS || []).forEach(s => list.add(s));
  try { await Promise.all([...list].map(async s => { IMG[s] = await load(s); })); }
  catch (src) { window.__bootFailed = `图片加载失败：${src}（段的 assets / plate / window.EXTRA_ASSETS 里点名的文件不存在或不是图片）`; console.error('BOOT FAILED\n' + window.__bootFailed); return; }
  for (const f of (window.FONT_FACES || [])) { const ff = new FontFace(f.family, `url(${f.url})`, f.desc || {}); await ff.load(); document.fonts.add(ff); }
  await document.fonts.ready;
  await U.loadCmaps();                                  // Для перевірки гліфів (U.assertGlyphs)
  for (const e of ERAS) if (e.init) e.init(IMG);
  checkCounterGlyphs();
  await window.prepare(0);                              // Спочатку завантажуємо відеокадри для кадру 0 (про відсутні кадри повідомляємо вже тут)
  window.__ready = true;
  renderFrame(0);
}
window.IMG = IMG;

const U = window.U;

// ---------- Кутова позначка (вгорі праворуч): змінний компонент ----------
// Три варіанти era.counter для кожного сегмента:
// 1) Стандартно: лічильник року U.yearCounter; значення залежить лише від глобального часу (U.counterAt), безперервно прокручується між сегментами; label містить назву стилю.
// 2) counter.draw(c, lt, t) (псевдонім counter.custom(c, lt)): власне малювання. Для немонотонної хронології, печаток, титульних написів чи рамок із коміксною оповіддю.
// 3) counter.mode = 'tag': U.styleTag малює статичну дворядкову табличку «рік + назва стилю» (без прокручування за нехронологічного порядку).
// Під час переходу: стандартно (window.COUNTER_IN_TRANSITION = 'cut') обидва шари малюються без позначок; після переходу на верхньому шарі стара/нова позначка жорстко перемикається за p<0.5 —
// якщо компонування позначок різниться, переходи з локальним відкриттям (лампа, промінь, хвиля) накладають обидва написи один на одного (виявлено незалежним переглядом тестів перенесення C і D).
// 'layers': позначки залишаються у своїх шарах і змінюються разом із переходом (відтворення оригіналу: положення фіксоване, цифри безперервно прокручуються, змішування непомітне). Окремий перехід може перевизначити це через transition.counter.
function drawCounter(c, e, t) {
  const ct = e.counter; if (!ct) return;
  const lt = t - e.t0;
  if (ct.draw) ct.draw(c, lt, t);
  else if (ct.custom) ct.custom(c, lt);
  else if (ct.mode === 'tag') U.styleTag(c, ct, lt);
  else { const cv = U.counterAt(t); U.yearCounter(c, ct, cv.v, cv.rolling, lt); }
}
// Під час запуску перевіряємо гліфи кутових позначок (непомітна підміна відсутніх символів системним шрифтом траплялася в тестах перенесення B і D). Для власних позначок викликайте U.assertGlyphs у scene.init.
function checkCounterGlyphs() {
  for (const e of ERAS) { const ct = e.counter; if (!ct || ct.draw || ct.custom) continue;
    if (ct.mode === 'tag') { if (ct.name) U.assertGlyphs(ct.nameFont || ct.font, ct.name, e.id + ' 角标'); if (ct.sub) U.assertGlyphs(ct.subFont || ct.nameFont || ct.font, ct.sub, e.id + ' 角标'); continue; }
    U.assertGlyphs(ct.font, '0123456789' + (Math.abs(ct.year) >= 10000 ? ',' : ''), e.id + ' 年份');
    if (ct.label) U.assertGlyphs(ct.label.font, ct.label.text, e.id + ' 角标');
    if (ct.suffix) U.assertGlyphs(ct.suffix.font || ct.font, 'BCAD', e.id + ' 角标后缀');
  }
}
// Статична табличка «рік + назва стилю»: { year, name, sub?, x, y, font, size, color, nameFont, nameColor, subFont, subColor, box(c,lt), shadow, align }
U.styleTag = function (c, ct, lt) {
  if (ct.box) ct.box(c, lt);
  c.save(); c.textAlign = ct.align || 'right'; c.textBaseline = 'alphabetic';
  if (ct.shadow) { c.shadowColor = ct.shadow.color; c.shadowBlur = ct.shadow.blur || 0; c.shadowOffsetX = ct.shadow.x || 0; c.shadowOffsetY = ct.shadow.y || 0; }
  const x = ct.x ?? 1866, y = ct.y ?? 128;
  if (ct.year != null) { c.font = `${ct.size || 96}px "${U.fontFamily(ct.font)}"`; c.fillStyle = ct.color || '#fff'; c.fillText(ct.yearText || (ct.year < 0 ? U.fmtYear(ct.year) + ' BC' : String(ct.year)), x, y); }
  if (ct.name) { c.font = ct.nameFont || `34px "${U.fontFamily(ct.font)}"`; c.fillStyle = ct.nameColor || ct.color || '#fff'; c.fillText(ct.name, x, ct.ny ?? y + 52); }
  if (ct.sub) { c.font = ct.subFont || ct.nameFont; c.fillStyle = ct.subColor || ct.nameColor || ct.color; c.fillText(ct.sub, x, ct.sy ?? y + 92); }
  c.restore();
};

// ---------- Лічильник року (порозрядне прокручування, як в одометрі) ----------
// from/to — числові значення; fmt перетворює їх на рядок. Кожен розряд незалежно прокручується від старого символу до нового; молодші розряди починають першими, зі зміщенням stagger.
U.odometer = function (c, opt, p) {
  const { x, y, size, font, color, fromStr, toStr, align = 'right', stagger = 0.12, spacing = 0, shadow } = opt;
  c.save();
  c.font = `${size}px ${font}`;
  c.textBaseline = 'alphabetic';
  c.fillStyle = color;
  const n = Math.max(fromStr.length, toStr.length);
  const a = fromStr.padStart(n, ' '), b = toStr.padStart(n, ' ');
  const widths = [...b].map(ch => c.measureText(ch === ' ' ? '0' : ch).width + spacing);
  const total = widths.reduce((s, w) => s + w, 0) - spacing;
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  for (let i = 0; i < n; i++) {
    const order = n - 1 - i;                           // Молодші розряди прокручуються першими
    const pi = U.clamp((p - order * stagger) / Math.max(0.0001, 1 - (n - 1) * stagger));
    const e = U.ease.inOut(pi);
    const w = widths[i];
    c.save();
    c.beginPath(); c.rect(cx - 4, y - size * 1.05, w + 8, size * 1.35); c.clip();
    if (shadow) { c.shadowColor = shadow.color; c.shadowBlur = shadow.blur || 0; c.shadowOffsetX = shadow.x || 0; c.shadowOffsetY = shadow.y || 0; }
    if (a[i] === b[i]) c.fillText(b[i], cx, y);
    else {
      const dy = size * 1.1 * e;
      c.globalAlpha = 1 - e * 0.6; if (a[i] !== ' ') c.fillText(a[i], cx, y - dy);
      c.globalAlpha = 0.4 + e * 0.6; if (b[i] !== ' ') c.fillText(b[i], cx, y + size * 1.1 - dy);
    }
    c.restore();
    cx += w;
  }
  c.restore();
};

// ---------- Лічильник року: числова інтерполяція (ease-out) + шлейф прокручування одиниць ----------
// ct: {year, x, y, size, font, color, suffix:{font,size,color,dy,gap}, label:{text,font,color,x,y,spacing}, box(c), shadow, spacing}
U.fmtYear = (v) => { const a = Math.abs(Math.round(v)); return a >= 10000 ? a.toLocaleString('en-US') : String(a); };
// Значення лічильника залежить лише від глобального часу: під час переходу обидва шари показують однакове число
U.counterAt = function (t) {
  let k = 0; for (let i = 0; i < ERAS.length; i++) if (t >= ERAS[i].t0) k = i;
  const cur = ERAS[k].counter, prv = k ? ERAS[k - 1].counter : cur;
  const p = cur.roll ? U.clamp((t - ERAS[k].t0 - 0.03) / cur.roll) : 1;
  return { v: prv.year + (cur.year - prv.year) * U.ease.inOut(p), rolling: p > 0 && p < 1 };
};
U.yearCounter = function (c, ct, v, rolling, lt) {
  if (ct.box) ct.box(c, lt);
  const vi = Math.round(v);
  const str = U.fmtYear(vi);
  const era = v < 0 ? 'BC' : 'AD';
  c.save();
  c.textBaseline = 'alphabetic';
  if (ct.shadow) { c.shadowColor = ct.shadow.color; c.shadowBlur = ct.shadow.blur || 0; c.shadowOffsetX = ct.shadow.x || 0; c.shadowOffsetY = ct.shadow.y || 0; }
  let x = ct.x;
  // Суфікс (BC/AD)
  const sfx = ct.suffix && (ct.suffix.show === 'always' || (ct.suffix.show !== 'never')) ? ((ct.suffix.text === 'BC' || ct.suffix.text === 'AD') ? era : (ct.suffix.text || era)) : '';
  if (sfx) {
    c.font = `${ct.suffix.size}px "${ct.suffix.font || ct.font}"`; c.fillStyle = ct.suffix.color || ct.color; c.textAlign = 'right';
    c.fillText(sfx, x, ct.y + (ct.suffix.dy || 0));
    x -= c.measureText(sfx).width + (ct.suffix.gap || 12);
  }
  c.font = `${ct.size}px "${ct.font}"`; c.fillStyle = ct.color; c.textAlign = 'left';
  if (ct.spacing) c.letterSpacing = ct.spacing + 'px';
  const w = c.measureText(str).width - (ct.spacing || 0);
  const x0 = x - w;
  // Під час прокручування: усі розряди, крім одиниць, малюємо звичайно; одиниці прокручуємо вертикально
  if (rolling) {
    const head = str.slice(0, -1), last = str.slice(-1);
    c.fillText(head, x0, ct.y);
    const hw = head ? c.measureText(head).width : 0;
    const frac = (Math.abs(v) % 1);
    const lw = c.measureText(last).width;
    c.save(); c.beginPath(); c.rect(x0 + hw - 2, ct.y - ct.size * 1.0, lw + 30, ct.size * 1.25); c.clip();
    c.fillText(last, x0 + hw, ct.y - frac * ct.size * 0.3);
    c.globalAlpha = 0.35; c.fillText(String((+last + 1) % 10), x0 + hw, ct.y - ct.size * 0.85 - frac * ct.size * 0.3);
    c.restore();
  } else c.fillText(str, x0, ct.y);
  c.restore();
  if (ct.label) {
    const L = ct.label; c.save(); c.font = L.font; c.fillStyle = L.color; c.textAlign = L.align || 'right'; c.textBaseline = 'alphabetic';
    if (L.spacing) c.letterSpacing = L.spacing + 'px';
    if (L.shadow) { c.shadowColor = L.shadow.color; c.shadowBlur = L.shadow.blur || 0; c.shadowOffsetX = L.shadow.x || 0; c.shadowOffsetY = L.shadow.y || 0; }
    if (L.gradient) { const g = c.createLinearGradient(0, L.y - 30, 0, L.y); L.gradient.forEach((col, i) => g.addColorStop(i / (L.gradient.length - 1), col)); c.fillStyle = g; }
    c.fillText(L.text, (L.x || ct.x) + (L.spacing && (L.align || 'right') === 'right' ? L.spacing : 0), L.y); c.restore();
  }
};

// ---------- Пара (універсальна: кілька напівпрозорих мазків із синусоїдальними завитками) ----------
U.steam = function (c, t, { x, y, h = 70, n = 3, w = 3, color = 'rgba(255,255,255,.8)', spread = 14, speed = 1, seed = 1, wobble = 8 }) {
  c.save(); c.strokeStyle = color; c.lineCap = 'round'; c.lineWidth = w;
  for (let k = 0; k < n; k++) {
    const ox = (k - (n - 1) / 2) * spread;
    const ph = t * 2.2 * speed + k * 1.7 + seed;
    c.beginPath();
    for (let s = 0; s <= 24; s++) {
      const q = s / 24, yy = y - q * h, xx = x + ox + Math.sin(ph + q * 5) * wobble * q;
      c.globalAlpha = 1;
      s ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
    }
    const g = c.createLinearGradient(0, y, 0, y - h); g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.strokeStyle = g; c.stroke();
  }
  c.restore();
};

// ---------- Відеошар: до кожної епохи можна прив’язати послідовність кадрів (clips/<id>/%04d.jpg), що асинхронно завантажуються за потреби ----------
// clip: {dir, fps, n, in, speed, loop}  Локальний час сегмента lt → час у кліпі in + lt*speed → номер кадру
const FRAMES = new Map();                 // url -> Image (декодовано)
function clipFrameUrl(e, lt) {
  const c = e.clip; let ct = (c.in || 0) + Math.max(0, lt) * (c.speed || 1);
  let i = Math.round(ct * c.fps);
  if (c.loop === 'pingpong') { const m = 2 * (c.n - 1); i = i % m; if (i >= c.n) i = m - i; } else i = Math.min(c.n - 1, i);
  return `${c.dir}/${String(i + 1).padStart(4, '0')}.jpg`;
}
async function need(url) {
  if (FRAMES.has(url)) return;
  const im = new Image(); im.src = url;
  try { await im.decode(); } catch (e) { const msg = `视频帧缺失或解不开：${url}（clip.dir / n / in 对不上帧序列）`; console.error(msg); throw new Error(msg); }
  FRAMES.set(url, im);
  if (FRAMES.size > 240) { const k = FRAMES.keys().next().value; FRAMES.delete(k); }
}
function layersAt(t) {
  let k = ERAS.findIndex(e => t >= e.t0 && t < e.t1); if (k < 0) k = ERAS.length - 1;
  const out = [k]; const e = ERAS[k];
  if (k > 0 && e.transition && t - e.t0 < e.transition.dur + (e.transition.delay || 0)) out.push(k - 1);
  return out;
}
window.prepare = async function (t) {
  await Promise.all(layersAt(t).map(k => ERAS[k].clip ? need(clipFrameUrl(ERAS[k], t - ERAS[k].t0)) : null));
};

// ---------- Малювання епохи (локальний час сегмента lt) ----------
function drawEra(c, e, t, prev, punchFrom, noCounter) {
  const lt = t - e.t0;
  c.save();
  c.clearRect(0, 0, W, H);
  // Ударний поштовх камери в ритм (лише шар сцени, без масштабування таблички року): s(k)=1+0.03·(1-k/20)^1.5, k = число кадрів від початку переходу
  // Поштовх прив’язаний до початку переходу вхідного сегмента: під час переходу старий сегмент також збільшується (в оригіналі на ударному кадрі рухається весь екран)
  const pe = punchFrom || e;
  // Амплітуда: transition.punch (число; false/0 вимикає) > window.PUNCH для фільму > 0.03. Для пояснювальних відео, презентацій і даних цей поштовх зайвий: задайте window.PUNCH = 0.
  const pa = pe.transition ? (pe.transition.punch ?? window.PUNCH ?? 0.03) : 0, amp = pa === true ? 0.03 : +pa || 0;
  const k60 = amp ? (t - pe.t0) * 60 : 99;
  const punch = k60 >= 0 && k60 < 20 ? 1 + amp * Math.pow(1 - k60 / 20, 1.5) : 1;
  c.save(); if (punch !== 1) { c.translate(W / 2, H / 2); c.scale(punch, punch); c.translate(-W / 2, -H / 2); }
  // Відеокадри: пропорційне заповнення (MD.cover, без розтягування); clipDraw(c, frame, lt, t) у сегменті дає власне розміщення (наїзд, фокус, фотодрук). Непідготовлений кадр має викликати помилку, а не тихо лишатися порожнім
  if (e.clip) { const url = clipFrameUrl(e, lt), im = FRAMES.get(url);
    if (!im) throw new Error(`视频帧没加载：${url}（渲染前要先 await window.prepare(t)；render.py 已经这么做，自己写的脚本也要）`);
    if (e.clipDraw) e.clipDraw(c, im, lt, t); else MD.cover(c, im); }
  else if (e.plate && !e.draw) c.drawImage(IMG[e.plate], 0, 0, W, H);
  if (e.draw) e.draw(c, lt, t, IMG, prev);
  c.restore();
  if (!noCounter) drawCounter(c, e, t);
  c.restore();
}

// ---------- Основний рендеринг ----------
function renderFrame(t) {
  let k = ERAS.findIndex(e => t >= e.t0 && t < e.t1); if (k < 0) k = ERAS.length - 1;
  const e = ERAS[k], prev = ERAS[k - 1];
  const tr = e.transition;
  const trDur = tr ? tr.dur + (tr.delay || 0) : 0;
  const lt = t - e.t0;
  if (prev && tr && lt < trDur) {
    const cut = (tr.counter || window.COUNTER_IN_TRANSITION || 'cut') === 'cut';
    drawEra(bufA.getContext('2d'), prev, t, ERAS[k - 2], e, cut);
    drawEra(bufB.getContext('2d'), e, t, prev, undefined, cut);
    const p = U.clamp((lt - (tr.delay || 0)) / tr.dur);
    ctx.save(); ctx.clearRect(0, 0, W, H);
    // o.id / o.from = id вхідного / вихідного сегмента: кеш переходу, залежний від вмісту кадру, має їх враховувати (once(k, f, o) у transitions.js)
    TRANSITIONS[tr.type](ctx, bufA, bufB, p, { ...tr, id: e.id, from: prev.id, lt, t, W, H, tmp: bufT, IMG });
    ctx.restore();
    if (cut) drawCounter(ctx, p < 0.5 ? prev : e, t);
  } else {
    drawEra(ctx, e, t, prev);
  }
  if (window.GLOBAL_OVERLAY) window.GLOBAL_OVERLAY(ctx, t);
  return k;
}
window.renderFrame = renderFrame;
// Перегляд окремого сегмента: opt.counter = false вимикає кутову позначку (під час самоперевірки прокручування лічильника завищує різницю кадрів; тест перенесення B)
window.renderSolo = function (id, lt, opt = {}) { const e = ERAS.find(x => x.id === id); if (!e) throw new Error('renderSolo: 没有这一段 ' + id); const k = ERAS.indexOf(e); drawEra(ctx, e, e.t0 + lt, ERAS[k - 1], undefined, opt.counter === false); };

// ---------- UI попереднього перегляду ----------
if (location.search.includes('render=1')) document.body.classList.add('render');
const scrub = document.getElementById('scrub'), tt = document.getElementById('tt'); scrub.max = window.__total;
let playing = false, t0 = 0, base = 0;
scrub.oninput = () => { playing = false; renderFrame(+scrub.value); tt.textContent = (+scrub.value).toFixed(3); };
document.getElementById('play').onclick = () => { playing = !playing; t0 = performance.now(); base = +scrub.value; if (playing) loop(); };
function loop() { if (!playing) return; let t = base + (performance.now() - t0) / 1000; if (t > window.__total) { t = 0; base = 0; t0 = performance.now(); } scrub.value = t; tt.textContent = t.toFixed(3); renderFrame(t); requestAnimationFrame(loop); }
boot().catch(err => { window.__bootFailed = String(err && err.stack || err); console.error('BOOT FAILED\n' + window.__bootFailed); });
})();
