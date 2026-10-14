// Середовище параметризованих фрагментів: один spec (JSON) → анімація тривалістю рівно spec.duration. Використовується як анімаційний сегмент у відеоконвеєрі з озвученням.
// Контракт див. у references/09-视频动画语法.md, розділ про контракт фрагмента. На відміну від engine.js, немає таблиці сегментів чи переходів: кожна граматика має draw(c, t, ctx); розмір полотна читається зі spec (підтримується й вертикальний формат).
//
// spec = { grammar, duration, fps=30, width=1920, height=1080, safe?: {top,bottom,left,right (px, місце для субтитрів та UI платформи), fill? (колір зарезервованих полів)}, theme?, alpha?, data?, cues: [{at, kind, text?, sub?, data?, image?, frames?, fps?, dur?}] }
// spec.theme: спільна палітра фільму (lib/palettes.js): назва (paper poster ink navy bauhaus snow wood chalk), {name, ключі для перевизначення} або всі 6 ключів {bg, surface, ink, sub, accent, accent2}.
// Розбирається в ctx.pal (усі 6 ключів + name); граматики беруть звідси кольори. Хибна назва або відсутні ключі → запуск переривається. Без theme → ctx.pal = null, граматики використовують власні стандартні кольори.
// Граматика може оголосити legacyTheme(theme) → true: це її старий формат теми (для t3: 'light' / 'dark' / старий об’єкт теми); він не розбирається як палітра, граматика й далі читає ctx.theme.
// Шляхи ресурсів (render.py перевіряє наявність і переписує їх через spec_assets.py): cue.image, cue.frames (послідовність кадрів: каталог або масив шляхів), data.image, data.character.frames (бібліотека кадрів y4).
// Якщо хоча б одне зображення не завантажилося, запуск і рендеринг перериваються (без порожніх кадрів). Доступ із граматики: ctx.still(q) = статичне зображення цього cue (перший кадр, якщо є frames); ctx.frame(q, t) = кадр для моменту t.
// Файл clips/<grammar>.js реєструє CLIPS[grammar] = { init?(ctx), draw(c, t, ctx), safe?: true (вказувати лише за компонування через ctx.safe / ctx.box; інакше spec.safe спричинить попередження) }.
// Узгодження часу (CLIP.lt): перший видимий кадр cue — кадр, що містить at. Елемент уперше видимий при t = at; внутрішній час анімації відлічується від at − 1 кадр.
(() => {
const cv = document.getElementById('c'), c = cv.getContext('2d');
window.__canvas = cv;
window.CLIPS = window.CLIPS || {};
const C = window.CLIP = {};
const fail = msg => { window.__bootFailed = msg; console.error('CLIP BOOT FAILED\n' + msg); };

// ---------- Допоміжні засоби для файлів граматик ----------
// Локальний час: cue вперше видимий у кадрі at
C.lt = (t, at, fps) => t - at + 1 / fps;
// Прогрес: від at за dur секунд проходить 0→1 (у кадрі at вже >0)
C.p = (t, at, dur, fps) => U.clamp(C.lt(t, at, fps) / dur);
// Пропорційне вписування в рамку (contain, без обрізання): повертає {x, y, w, h}
C.fit = (iw, ih, bx, by, bw, bh) => { const s = Math.min(bw / iw, bh / ih); const w = iw * s, h = ih * s; return { x: bx + (bw - w) / 2, y: by + (bh - h) / 2, w, h, s }; };
// Нормалізований прямокутник [x,y,w,h] (0..1, відносно зображення) → прямокутник на екрані
C.sub = (r, box) => ({ x: box.x + r[0] * box.w, y: box.y + r[1] * box.h, w: r[2] * box.w, h: r[3] * box.h });
C.text = (cue, ...fallback) => (cue && (cue.text ?? cue.data?.text)) ?? fallback.find(v => v != null) ?? '';

async function boot() {
  let spec = window.CLIP_SPEC;
  if (!spec) {                                                           // Попередній перегляд: ?spec=<шлях відносно engine>
    const u = new URLSearchParams(location.search).get('spec');
    if (!u) return fail('没有 spec：render.py --spec 会注入 window.CLIP_SPEC；预览用 clip.html?spec=examples/<名>.json');
    spec = await (await fetch(u)).json();
    const base = u.replace(/[^/]*$/, '');
    const fix = p => p && !/^(data:|https?:|\/)/.test(p) ? base + p : p;   // У режимі перегляду frames має бути масивом шляхів (браузер не перелічує каталог); бібліотека кадрів: {frames: {поза: шлях}}
    (spec.cues || []).forEach(q => { if (q.image) q.image = fix(q.image); if (Array.isArray(q.frames)) q.frames = q.frames.map(fix); });
    if (spec.data && spec.data.image) spec.data.image = fix(spec.data.image);
    const ch = spec.data && spec.data.character; if (ch && typeof ch === 'object' && ch.frames && typeof ch.frames === 'object') for (const k in ch.frames) ch.frames[k] = fix(ch.frames[k]);
  }
  if (location.search.includes('render=1')) document.body.classList.add('render');
  const W = spec.width || 1920, H = spec.height || 1080, FPS = spec.fps || 30;
  if (!spec.grammar) return fail('spec 缺 grammar');
  if (!(spec.duration > 0)) return fail('spec.duration 必须 > 0');
  cv.width = W; cv.height = H; U.setStage(W, H);
  // Файл граматики (синхронний XHR + eval із sourceURL для локалізації помилок)
  const x = new XMLHttpRequest(); x.open('GET', `clips/${spec.grammar}.js`, false);
  try { x.send(); } catch (e) { return fail('请求语法文件失败 ' + e); }
  if (x.status !== 200) return fail(`没有这个语法：clips/${spec.grammar}.js（HTTP ${x.status}）`);
  try { (0, eval)(x.responseText + `\n//# sourceURL=clips/${spec.grammar}.js`); } catch (e) { return fail(`clips/${spec.grammar}.js 执行出错 ${e.stack || e}`); }
  const G = CLIPS[spec.grammar]; if (!G || typeof G.draw !== 'function') return fail(`clips/${spec.grammar}.js 没注册 CLIPS['${spec.grammar}'] = { draw }`);
  // Палітру теми перевіряємо до завантаження ресурсів, щоб не чекати зображень за хибної конфігурації
  let pal = null;
  if (!(G.legacyTheme && G.legacyTheme(spec.theme))) { try { pal = PAL.resolve(spec.theme); } catch (e) { return fail(e.message); } }
  // Зображення
  const IMG = {}, urls = new Set();
  for (const q of (spec.cues || [])) {
    if (q.image) urls.add(q.image);
    if (q.frames != null) { if (!Array.isArray(q.frames) || !q.frames.length) return fail(`cue ${q.kind} at=${q.at} 的 frames 要是非空的路径数组（render.py 会把目录展开成数组；预览模式只认数组）`); q.frames.forEach(f => urls.add(f)); }
  }
  if (spec.data && spec.data.image) urls.add(spec.data.image);
  const chr = spec.data && spec.data.character;
  if (chr && typeof chr === 'object') { if (!chr.frames || typeof chr.frames !== 'object' || Array.isArray(chr.frames)) return fail('data.character 写成对象时要有 frames: {姿势名: 图片路径}（或在 render.py 里给一个帧库目录）');
    Object.values(chr.frames).forEach(f => urls.add(f)); }
  try { await Promise.all([...urls].map(u => new Promise((res, rej) => { const im = new Image(); im.onload = () => { IMG[u] = im; res(); }; im.onerror = () => rej(u); im.src = u; }))); }
  catch (u) { return fail('图片加载失败：' + u); }
  // Перевірка шрифтів і гліфів (відсутні гліфи зі spec дають лише попередження: системний шрифт дозволяє рендеринг, але вигляд може різнитися між комп’ютерами)
  for (const f of (window.FONT_FACES || [])) { const ff = new FontFace(f.family, `url(${f.url})`, f.desc || {}); await ff.load(); document.fonts.add(ff); }
  await document.fonts.ready; await U.loadCmaps();
  const cues0 = (spec.cues || []).map((q, i) => ({ ...q, i, at: +q.at || 0 })).sort((a, b) => a.at - b.at || a.i - b.i);
  for (const q of cues0) if (q.at > spec.duration + 1e-9) console.warn(`cue ${q.kind} at=${q.at} 超出片段时长 ${spec.duration}s，看不到，已丢掉（不占版面）`);
  const cues = cues0.filter(q => q.at <= spec.duration + 1e-9);   // Невидимі cue не передаємо граматиці: інакше вони займають місце в компонуванні й враховуються на шкалі прогресу
  // Раніше граматики по-різному читали опис number (t2/t3: text; y5: sub); помилка давала порожній текст без повідомлення. Уніфікуємо: text і sub — псевдоніми; data.text теж враховується
  for (const q of cues) if (q.kind === 'number') { const cap = q.text ?? q.sub ?? (q.data && q.data.text); if (cap != null) { q.text = cap; q.sub = cap; } }
  const safe = { top: 0, bottom: 0, left: 0, right: 0, ...(spec.safe || {}) };   // Зарезервовані поля (px): тут розміщуються вбудовані субтитри й UI платформи; граматики з текстом не використовують цю область
  const box = { x: safe.left, y: safe.top, w: W - safe.left - safe.right, h: H - safe.top - safe.bottom };   // Область вмісту після відступів; граматики компонують елементи за ctx.box
  const ctx = { spec, data: spec.data || {}, theme: spec.theme || {}, pal, cues, W, H, FPS, u: Math.min(W, H) / 1080, portrait: H > W, alpha: !!spec.alpha, IMG, dur: spec.duration, safe, box,
    of: (...kinds) => cues.filter(q => kinds.includes(q.kind)), lt: (t, at) => C.lt(t, at, FPS), p: (t, at, d) => C.p(t, at, d, FPS),
    // Ресурси: still = зображення для компонування (image або перший кадр frames); frame = кадр у момент t (frames відтворюється від at з q.fps, стандартно 30; після завершення утримується останній кадр, q.loop вмикає цикл)
    still: q => q && (q.image ? IMG[q.image] : q.frames ? IMG[q.frames[0]] : null),
    frame: (q, t) => !q ? null : q.frames ? MD.frameAt(q.frames.map(f => IMG[f]), t - q.at, q.fps || 30, !!q.loop) : q.image ? IMG[q.image] : null };
  if (G.fonts) { const txt = cues.map(q => [q.text, q.sub, q.data && q.data.text].filter(Boolean).join('')).join('') + JSON.stringify(spec.data || {});
    for (const fam of G.fonts) { const miss = U.missingGlyphs(fam, [...txt].filter(ch => ch.codePointAt(0) >= 0x2E80).join(''));   /* Перевіряємо лише ієрогліфи та повноширинні символи: для латиниці, грецьких і математичних знаків граматики мають окремі шрифти */ if (miss.length) console.warn(`字体「${fam}」缺字：${miss.join('')}（会回退系统字体；常用字已在 GB2312 子集里，生僻字用 scripts/font_subset.py --text 补）`); } }
  if (spec.safe && (safe.top || safe.bottom || safe.left || safe.right) && !G.safe)
    console.warn(`语法 ${spec.grammar} 还没接 safe（语法对象里没有 safe: true），spec.safe 被忽略：字幕带可能压在字上`);
  if (G.init) G.init(ctx);
  window.CLIP_CTX = ctx;
  window.__total = spec.duration; window.__fps = FPS; window.__size = [W, H];
  // safe.fill: колір зарезервованих полів (у вертикальному відео діаграма утворює ту саму «картку», що й сусідні ресурси contain; зовні — фон відео); у прозорому режимі не заливаємо
  const band = (safe.fill && !spec.alpha) ? (cc => { cc.fillStyle = safe.fill; const { top: t0, bottom: b0, left: l0, right: r0 } = safe;
    if (t0) cc.fillRect(0, 0, W, t0); if (b0) cc.fillRect(0, H - b0, W, b0); if (l0) cc.fillRect(0, 0, l0, H); if (r0) cc.fillRect(W - r0, 0, r0, H); }) : null;
  window.renderFrame = t => { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); c.save(); G.draw(c, t, ctx); c.restore(); if (band) band(c); };
  window.prepare = async () => {};
  window.__ready = true;
  window.renderFrame(0);
  const sc = document.getElementById('scrub'), tt = document.getElementById('tt'); sc.max = spec.duration; sc.step = 1 / FPS;
  sc.oninput = () => { window.renderFrame(+sc.value); tt.textContent = (+sc.value).toFixed(3); };
}
boot().catch(e => fail(String(e && e.stack || e)));
})();
