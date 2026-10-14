// Реальні матеріали MD: знімки екрана, фотографії та кадри відео як головний об’єкт у кадрі. У пояснювальному відео реальні матеріали займають увесь кадр, а код відповідає за пояснення, позначки й рух камери.
// Джерело: два схвалені ролики. В одному фото займає весь кадр, а камера наближається до деталей, згаданих у закадровому тексті (cover); в іншому фотографії з білими полями лежать на столі розслідування поруч із чорними ярликами з рваними краями.
// Коли один знімок займає весь кадр протягом плану, камера може лише наближатися, тож увесь ролик легко перетворити на низку наїздів. Наближайте лише тоді, коли потрібну деталь не видно за поточної крупності; якщо рух уже є у відеозаписі, залишайте камеру нерухомою.
// Щоб переходити між кількома матеріалами, розкладіть їх на спільному світовому полотні (стіл розслідування MD.print) і переміщуйте камеру вбік; див. розділ про повнокадрові реальні матеріали у references/镜头语言.md.
// Умови: відсутні матеріали завжди спричиняють помилку (throw → render.py / qa.py фіксують збій), а не порожній кадр без попередження; усі параметри обчислює за часом і передає викликальний код, бібліотека не читає годинник.
//
//   MD.size(src)                                  Розміри матеріалу в пікселях [w, h] (зображення, кадр відео або canvas); відсутній або ще не завантажений матеріал → throw
//   MD.cover(c, src, o) → geo                     Заповнення кадру: пропорційне масштабування до повного покриття рамки (зайві краї обрізаються), кадрування за фокусом, наближення за z
//       o = { x=0, y=0, w=ширина полотна, h=висота полотна (рамка), fx=.5, fy=.5 (фокус, 0..1 відносно матеріалу: кадрування й наближення відбуваються навколо нього), z=1 (кратність наближення, ≥1),
//             crop:[sx,sy,sw,sh] (спочатку взяти цю частину матеріалу, 0..1), fit:'cover'|'contain' (contain = вмістити весь матеріал у рамку без обрізання, із полями), clip=true }
//       Повертає geo = { x, y, w, h (прямокутник матеріалу на полотні), s (масштаб), box }; MD.toScreen переводить точки й рамки матеріалу в координати полотна
//   MD.toScreen(geo, r)                           Точка [u,v] або рамка [u,v,w,h] матеріалу в діапазоні 0..1 → координати полотна ([x,y] або {x,y,w,h})
//   MD.focusFor(rect) → {fx, fy}                  Центр рамки [u,v,w,h] як фокус
//   MD.zoomFor(rect, iw, ih, bw, bh, fill=.6, fit='cover') → z    Додаткове наближення поверх cover, щоб рамка rect матеріалу займала частку fill ширини/висоти рамки (≥1)
//   MD.print(c, src, w, h, o)                     Фотовідбиток: білі поля + колір старого паперу + тінь + скотч; початок координат у центрі відбитка (викликальний код спочатку виконує translate/rotate)
//       o = { border=16·u, crop, fx, fy (cover у w×h за фокусом), tape=true, caption (дрібний підпис на нижньому білому полі), polaroid=false (ширше нижнє поле з підписом caption усередині),
//             shadow=true, key (якщо задано key і матеріал є статичним зображенням, кешувати як растр)}
//   MD.label(c, text, x, y, o)                    Чорний ярлик із рваними краями: o = { size=48·u, fam='PuHui-Heavy', bg='#191817', fg='#f3efe6', align='left'|'center'|'right',
//             t, at (поява в кадрі at: спершу коротке збільшення до 1.12, потім усталення; текст друкується зі швидкістю rate символів/с при 12fps; без t одразу малюється повністю), rate=14, r (поворот)}
//       Повертає {w, h}
//   MD.frameAt(frames, lt, fps=30, loop=false)    Кадр послідовності (масиву зображень) у момент lt усередині ролика; відсутній кадр → throw
(() => {
let W = 1920, H = 1080; U.onStage((w, h) => { W = w; H = h; });   // Розміри полотна визначає U.setStage (типово 1920×1080)
const { clamp } = U;
const MD = window.MD = {};
const u0 = () => Math.min(W, H) / 1080;

MD.size = src => {
  if (!src) throw new Error('MD：素材缺失（图片没加载或路径写错）——不画空白帧');
  const w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
  if (!(w > 0 && h > 0)) throw new Error(`MD：素材尺寸是 0（还没加载完或解不开）：${src.src || src.currentSrc || src}`);
  return [w, h];
};

MD.cover = (c, src, o = {}) => {
  const [iw0, ih0] = MD.size(src);
  const bx = o.x ?? 0, by = o.y ?? 0, bw = o.w ?? W, bh = o.h ?? H, fx = o.fx ?? 0.5, fy = o.fy ?? 0.5, z = Math.max(1e-3, o.z ?? 1);
  const cr = o.crop || [0, 0, 1, 1], sx = cr[0] * iw0, sy = cr[1] * ih0, iw = cr[2] * iw0, ih = cr[3] * ih0;
  const s0 = (o.fit === 'contain' ? Math.min : Math.max)(bw / iw, bh / ih), s = s0 * z, w = iw * s, h = ih * s;
  // Фокус: у режимі cover зберігати його відносне положення в рамці, наскільки можливо без порожніх країв; наближення навколо фокуса
  const ax = bx + bw * fx, ay = by + bh * fy;
  let x = ax - w * fx, y = ay - h * fy;
  if (o.fit !== 'contain') { x = Math.min(bx, Math.max(bx + bw - w, x)); y = Math.min(by, Math.max(by + bh - h, y)); }
  else if (z <= 1) { x = bx + (bw - w) / 2; y = by + (bh - h) / 2; }
  c.save();
  if (o.clip !== false) { c.beginPath(); c.rect(bx, by, bw, bh); c.clip(); }
  c.drawImage(src, sx, sy, iw, ih, x, y, w, h);
  c.restore();
  return { x, y, w, h, s, box: { x: bx, y: by, w: bw, h: bh } };
};

MD.toScreen = (geo, r) => r.length === 2 ? [geo.x + r[0] * geo.w, geo.y + r[1] * geo.h]
  : { x: geo.x + r[0] * geo.w, y: geo.y + r[1] * geo.h, w: r[2] * geo.w, h: r[3] * geo.h };
MD.focusFor = r => ({ fx: r[0] + r[2] / 2, fy: r[1] + r[3] / 2 });
MD.zoomFor = (rect, iw, ih, bw = W, bh = H, fill = 0.6, fit = 'cover') => {
  const s0 = (fit === 'contain' ? Math.min : Math.max)(bw / iw, bh / ih), rw = rect[2] * iw * s0, rh = rect[3] * ih * s0;
  return Math.max(1, Math.min(bw * fill / rw, bh * fill / rh));
};

const printCache = {};
MD.print = (c, src, w, h, o = {}) => {
  const u = u0(), b = o.border ?? 16 * u, bot = o.polaroid ? Math.max(b * 4, h * 0.2) : b, PW = w + 2 * b, PH = h + b + bot;
  const paint = g => {
    g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, PW, PH);
    const f = o.crop ? null : MD.focusFor([o.fx ?? 0.5, o.fy ?? 0.5, 0, 0]);
    MD.cover(g, src, { x: b, y: b, w, h, crop: o.crop, fx: f ? f.fx : 0.5, fy: f ? f.fy : 0.5 });
    g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(214,205,185,.16)'; g.fillRect(0, 0, PW, PH); g.restore();   // Друк на папері: накласти шар кольору старого паперу
    if (o.polaroid && o.caption) { g.save(); g.fillStyle = '#2b2925'; g.font = `${Math.min(bot * 0.42, 40 * u)}px "LXGWWenKai-500", "PuHui-Medium"`; g.textBaseline = 'middle'; g.fillText(o.caption, b * 1.2, b + h + bot / 2); g.restore(); }
  };
  MD.size(src);
  let sp;
  if (o.key && !(src instanceof HTMLVideoElement)) { const k = `${o.key}|${Math.round(PW)}x${Math.round(PH)}`; sp = printCache[k] || (printCache[k] = (() => { const cv = document.createElement('canvas'); cv.width = Math.ceil(PW); cv.height = Math.ceil(PH); paint(cv.getContext('2d')); return cv; })()); }
  c.save();
  if (o.shadow !== false) { c.shadowColor = 'rgba(30,22,10,.32)'; c.shadowBlur = 14 * u; c.shadowOffsetX = 3 * u; c.shadowOffsetY = 8 * u; }
  if (sp) c.drawImage(sp, -PW / 2, -PH / 2);
  else { c.translate(-PW / 2, -PH / 2); c.fillStyle = '#f7f5ef'; c.fillRect(0, 0, PW, PH); c.shadowColor = 'transparent'; paint(c); }
  c.restore();
  if (o.tape !== false && window.CL) { CL.tape(c, -w / 2 + 30 * u, -PH / 2 + 6 * u, -0.6, 110 * u); CL.tape(c, w / 2 - 30 * u, -PH / 2 + 6 * u, 0.55, 110 * u); }
  if (o.caption && !o.polaroid) { c.save(); c.font = `${22 * u}px "PuHui-Medium"`; c.fillStyle = 'rgba(40,36,30,.78)'; c.textBaseline = 'top'; c.fillText(o.caption, -PW / 2, PH / 2 + 10 * u); c.restore(); }
  return { w: PW, h: PH };
};

const labCache = {};
MD.label = (c, text, x, y, o = {}) => {
  text = String(text ?? ''); if (!text) return { w: 0, h: 0 };
  const u = u0(), size = o.size ?? 48 * u, fam = o.fam || 'PuHui-Heavy', bg = o.bg || '#191817', fg = o.fg || '#f3efe6';
  if (o.t != null && o.at != null && o.t < o.at) return { w: 0, h: 0 };
  c.save(); c.font = `${size}px "${fam}"`;
  const tw = c.measureText(text).width, padX = size * 0.42, w = Math.round(tw + padX * 2), h = Math.round(size * 1.5);
  const key = `${text}|${size}|${fam}|${bg}`;
  const sp = labCache[key] || (labCache[key] = (() => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
    if (window.CL) CL.tornRect(g, w, h, [...text].length * 7 + Math.round(size), 3 * u); else { g.beginPath(); g.rect(0, 0, w, h); }
    g.fillStyle = bg; g.fill(); return cv; })());
  const k = o.t != null && o.at != null ? MO.step(o.t - o.at + 1e-6, 12) : 1e9;     // На двійках: відлік від at, кадр at є першим кадром
  const pop = k < 1 / 12 ? 1.12 : 1, ox = o.align === 'center' ? -w / 2 : o.align === 'right' ? -w : 0;
  c.translate(x, y); if (o.r) c.rotate(o.r); c.scale(pop, pop);
  c.drawImage(sp, ox, -h / 2);
  const n = o.t != null && o.at != null ? Math.ceil((k + 1 / 12) * (o.rate || 14)) : 1e9;
  c.fillStyle = fg; c.textBaseline = 'middle'; c.textAlign = 'left';
  c.fillText([...text].slice(0, n).join(''), ox + padX, size * 0.04);
  c.restore();
  return { w, h };
};

MD.frameAt = (frames, lt, fps = 30, loop = false) => {
  if (!frames || !frames.length) throw new Error('MD.frameAt：帧序列是空的');
  let i = Math.floor(Math.max(0, lt) * fps + 1e-6);
  i = loop ? i % frames.length : Math.min(frames.length - 1, i);
  const im = frames[i]; MD.size(im); return im;
};
})();
