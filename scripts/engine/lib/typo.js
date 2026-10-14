// Анімація тексту TY: посимвольна/послівна поява зі стрибком, підйом у масці, масштабування зі стрибком, друкування, вихід із розмиття, маркер, підкреслення, ударна поява головного слова, акцентування ключових слів, лічильники й моноширинні цифри.
// Домовленості: p — прогрес 0..1; lt/t — секунди. Шрифт задається CSS-рядком або назвою family (для китайської типово PuHui-*, у відкритій версії — Source Han Sans; див. lib/fonts.js).
// Мінімальні вимоги до читабельності (картки y5/y1): головне слово : допоміжна фраза : підпис ≈ 3.4 : 1 : 0.4; допоміжна фраза лишається на екрані ≥1.2s; повільна поява (0.3–0.4s), швидке зникнення (≈0.18s).
(() => {
const { clamp, lerp } = U;
const TY = window.TY = {};

// ---------- Основи ----------
TY.font = (size, fam = 'PuHui-Black') => `${size}px "${fam}"`;
// Малювання фрагмента тексту: підтримує прозорість, масштаб, обертання (навколо ox,oy), міжлітерний інтервал track та обводку
TY.text = (c, s, x, y, { size = 120, fam = 'PuHui-Black', color = '#111', align = 'center', base = 'alphabetic', alpha = 1, scale = 1, rot = 0, track = 0, stroke, strokeW = 0, ox = x, oy = y } = {}) => {
  if (alpha <= 0 || scale <= 0) return;
  c.save(); c.globalAlpha *= alpha; c.translate(ox, oy); c.rotate(rot); c.scale(scale, scale); c.translate(-ox, -oy);
  c.font = TY.font(size, fam); c.textAlign = align; c.textBaseline = base; if (track) c.letterSpacing = track + 'px';
  if (stroke && strokeW) { c.lineJoin = 'round'; c.strokeStyle = stroke; c.lineWidth = strokeW; c.strokeText(s, x, y); }
  c.fillStyle = color; c.fillText(s, x, y); c.restore();
};
TY.width = (c, s, size, fam = 'PuHui-Black', track = 0) => { c.save(); c.font = TY.font(size, fam); if (track) c.letterSpacing = track + 'px'; const w = c.measureText(s).width; c.restore(); return w; };
// Перенесення рядків: ділить текст на рядки за maxW (китайський текст можна розривати між символами; англійський текст і числа — між словами; китайська пунктуація не лишається на початку рядка). font — CSS-рядок шрифту
TY.wrap = (c, text, maxW, font) => {
  c.save(); if (font) c.font = font;
  const toks = String(text).match(/[A-Za-z0-9.,%+\-'’]+\s*|\s+|./gu) || [], lines = []; let cur = '';
  for (const tk of toks) {
    if (tk === '\n') { lines.push(cur); cur = ''; continue; }
    if (cur && c.measureText(cur + tk.trimEnd()).width > maxW && !/^[，。、：；！？」』）》,.!?)]$/.test(tk)) { lines.push(cur.trimEnd()); cur = tk.trimStart(); }
    else cur += tk;
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  c.restore(); return lines;
};
// Зменшує розмір від size, доки текст справді не вміститься: після перенесення не більше maxLines рядків, виміряна ширина кожного ≤ maxW (окреме довге англійське слово/довге число не розбивається; самої перевірки кількості рядків недостатньо). Повертає {size, lines, ok}
// Спершу шукає масштаб у межах [min, 1]; якщо не знайдено, soft:true повертає ok:false, щоб викликач обрав інше компонування (наприклад, два рядки), інакше зменшує далі (мінімум до 0.2). За balance:true рядки вирівнюються за довжиною.
TY.fit = (c, text, maxW, size, fam, { maxLines = 2, min = 0.45, weight = '', soft = false, balance = false } = {}) => {
  const font = s => `${weight}${s}px "${fam}"`, ok = (s, lines) => { c.save(); c.font = font(s); const r = lines.length <= maxLines && lines.every(l => c.measureText(l).width <= maxW + 0.5); c.restore(); return r; };
  let s = size, lines = [String(text)], good = false;
  for (; s >= size * (soft ? min : 0.2) - 1e-9; s *= 0.94) { lines = TY.wrap(c, text, maxW, font(s)); if (ok(s, lines)) { good = true; break; } if (s < size * min && soft) break; }
  if (!good && !soft) s /= 0.94;
  if (good && balance && lines.length > 1) { const n = lines.length; let lo = maxW * 0.4, hi = maxW; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (TY.wrap(c, text, m, font(s)).length > n) lo = m; else hi = m; } lines = TY.wrap(c, text, hi, font(s)); }
  return { size: s, lines, ok: good };
};

// ---------- Поява ----------
// Посимвольна поява зі зсувом у часі: кожен символ за dur секунд рухається вгору від dy, від прозорості до непрозорості, за потреби зі масштабуванням; заголовки Kurzgesagt — 0.5s/символ, затримка 45ms. Повертає загальну ширину.
TY.charsIn = (c, str, x, y, lt, { font, color, dur = 0.35, stagger = 0.04, dy = 24, scale0 = 1, align = 'left', ease = MO.cubicOut, shadow, spacing = 0 } = {}) => {
  c.save(); c.font = font; c.textBaseline = 'alphabetic'; c.fillStyle = color; const A0 = c.globalAlpha;   // Множення на прозорість викликача (щоб працювало зовнішнє поступове зникнення)
  const chars = [...str]; const ws = chars.map(ch => c.measureText(ch).width + spacing); const tw = ws.reduce((a, b) => a + b, 0) - spacing;
  let cx = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  chars.forEach((ch, i) => {
    const q = clamp((lt - i * stagger) / dur); if (q > 0) {
      const e = ease(q); c.save(); c.globalAlpha = A0 * clamp(q * 2.2);
      c.translate(cx + ws[i] / 2, y + dy * (1 - e)); const s = lerp(scale0, 1, e); c.scale(s, s);
      if (shadow) { c.shadowColor = shadow.color; c.shadowOffsetX = shadow.x || 0; c.shadowOffsetY = shadow.y || 0; c.shadowBlur = shadow.blur || 0; }
      c.fillText(ch, -ws[i] / 2 + spacing / 2, 0); c.restore();
    }
    cx += ws[i];
  });
  c.restore(); return tw;
};
// Підйом у масці: символи виходять угору зі «щілини» під базовою лінією (найпоширеніший спосіб появи в кінетичній типографіці). p 0..1, o.dir=+1 — вихід угору, -1 — сховати вниз. o — як у TY.text
TY.rise = (c, s, x, y, p, o = {}) => {
  const size = o.size || 120, e = MO.expoOut(clamp(p)), w = TY.width(c, s, size, o.fam, o.track), a = o.align || 'left';
  const x0 = a === 'left' ? x : a === 'center' ? x - w / 2 : x - w;
  c.save(); c.beginPath(); c.rect(x0 - 20, y - size * 1.05, w + 40, size * 1.32); c.clip();
  TY.text(c, s, x, y + size * 1.2 * (1 - e) * (o.dir || 1), { ...o, align: a }); c.restore();
};
// Масштабування зі стрибком: від 0 до 1, із перевищенням цільового значення backOut перед зупинкою (навколо центра тексту). o.over = s функції backOut
TY.pop = (c, s, x, y, p, o = {}) => {
  if (p <= 0) return; const size = o.size || 120, sc = MO.backOut(clamp(p), o.over ?? 2.2) * (o.scale || 1);
  TY.text(c, s, x, y, { ...o, scale: sc, ox: x, oy: y - size * 0.36 });
};
// Вихід із розмиття (заголовки презентацій): розмите→чітке + рух угору + прозоре→непрозоре. Використовує font/fillStyle/textAlign, задані викликачем.
TY.blurIn = (c, text, x, y, p, { blur = 18, dy = 28, scale = 0 } = {}) => {
  if (p <= 0) return;
  c.save(); c.globalAlpha *= clamp(p * 1.4);
  const b = (1 - p) * blur; if (b > 0.3) c.filter = `blur(${b.toFixed(2)}px)`;
  c.translate(x, y + (1 - p) * dy); if (scale) { const s = 1 + (1 - p) * scale; c.scale(s, s); }
  c.fillText(text, 0, 0); c.restore();
};
// Друкування: обрізання за кількістю символів (p 0..1)
TY.typed = (s, p) => [...s].slice(0, Math.round(clamp(p) * [...s].length)).join('');
// Друкарська машинка: кількість символів, надрукованих на момент t (rate символів/секунду, з можливим кроком за fps; Vox — 13 символів/секунду + 12fps, основний текст на дошці — 16 символів/секунду)
TY.typedCount = (t, t0, rate, fps = 0) => Math.max(0, Math.floor(((fps ? MO.step(t, fps) : t) - t0) * rate + 1e-6) + 1);

// ---------- Акцентування ----------
// Маркер: скошена кольорова смуга, що простягається зліва направо позаду тексту (кінетична типографіка). Маркер у колажному стилі з нерівними краями та multiply — див. CL.highlight
TY.marker = (c, x, y, w, h, p, color = '#FFE14D', skew = 0.18) => {
  if (p <= 0) return; const e = MO.expoOut(clamp(p)), ww = w * e;
  c.save(); c.fillStyle = color; c.beginPath(); c.moveTo(x + h * skew, y); c.lineTo(x + ww + h * skew, y); c.lineTo(x + ww, y + h); c.lineTo(x, y + h); c.closePath(); c.fill(); c.restore();
};
TY.underline = (c, x, y, w, p, color, lw = 10) => { if (p <= 0) return; c.save(); c.strokeStyle = color; c.lineCap = 'round'; c.lineWidth = lw; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * MO.expoOut(clamp(p)), y); c.stroke(); c.restore(); };
// Головне слово «вдаряється» на місце: зменшується від масштабу from до 1 (пружина 2.2Hz/10, перевищення ≈8%), у перші 0.06s переходить від прозорості до непрозорості. lt = секунди після появи цього слова
TY.slam = (c, s, x, y, lt, o = {}) => {
  if (lt < 0) return; const size = o.size || 340, k = MO.springHz(lt, o.freq || 2.2, o.decay || 10), sc = lerp(o.from || 1.7, 1, k);
  TY.text(c, s, x, y, { size, fam: 'PuHui-Black', align: 'left', ...o, scale: sc * (o.scale || 1), alpha: clamp(lt / 0.06), ox: o.ox ?? x, oy: o.oy ?? y - size * 0.36 });
};
// Ключове слово: від tIn піднімається зі щілини, на «акцентному такті» tHit збільшується до 1.35 та закріплюється (пружина 2.5Hz/9). Повертає поточний масштаб (щоб маркер/підкреслення збільшувалися разом зі словом).
// Текст і дія передають одне й те саме: саме в такт збільшення «наступного рядка» натискається Tab (y5).
TY.keyword = (c, s, x, y, t, tIn, tHit, o) => {
  if (t < tHit) { TY.rise(c, s, x, y, MO.at(t, tIn, 0.35), { ...o, align: 'left' }); return 1; }
  const sc = lerp(1, 1.35, MO.springHz(t - tHit, 2.5, 9));
  TY.text(c, s, x, y, { ...o, align: 'left', scale: sc, ox: x, oy: y });
  return sc;
};
// Маркер позаду ключового слова: з’являється в той самий такт і з тим самим масштабом
TY.keywordMarker = (c, x, y, w, size, t, tHit, sc, col) => { if (t < tHit) return; TY.marker(c, x - 8, y - size * 0.98 * sc, (w + 16) * sc, size * 1.18 * sc, MO.at(t, tHit, 0.3), col); };

// ---------- Числа ----------
// Формат із розділенням тисяч; для від’ємних чисел використовується справжній знак мінуса «−»
TY.fmt = (v, dec = 0, sep = true) => { const s = Math.abs(v).toFixed(dec); const [i, f] = s.split('.'); const ii = sep ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : i; return (v < 0 ? '−' : '') + ii + (f ? '.' + f : ''); };
// Лічильник: у межах [start, start+dur] змінюється від a до b; типово expoOut (спершу швидко, далі повільніше, доки остання цифра не стане на місце). Числа й анімація змінюють лише спосіб появи, а не методику обчислення показника.
TY.count = (lt, start, dur, a, b, ease = MO.expoOut) => lerp(a, b, ease(clamp((lt - start) / dur)));
// Розміщення моноширинних цифр: canvas не підтримує ввімкнення tnum, тому під час прокручування ширина цифр коливатиметься; кожну цифру потрібно самостійно розмістити в комірці однакової ширини. Використовує font/fillStyle, задані викликачем. Повертає загальну ширину
TY.tabular = (c, str, x, y, { align = 'left', digitW } = {}) => {
  const dw = digitW || c.measureText('0').width;
  const ws = [...str].map(ch => /[0-9]/.test(ch) ? dw : c.measureText(ch).width);
  const total = ws.reduce((s, w) => s + w, 0);
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  const ta = c.textAlign; c.textAlign = 'center';
  [...str].forEach((ch, i) => { c.fillText(ch, cx + ws[i] / 2, y); cx += ws[i]; });
  c.textAlign = ta; return total;
};
})();
