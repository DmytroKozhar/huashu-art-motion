// Бібліотека часу анімації MO: криві плавності, пружини, кроки, зсуви й музичні долі. Усе — чисті функції «час → значення», без читання годинника, детерміновано.
// Джерело: 8 демонстрацій анімаційної мови пояснювальних YouTube-відео (references/09-视频动画语法.md). p — прогрес 0..1, t/lt — секунди.
// Вибір кривої: пояснення (3b1b/дошка) — smooth/sineInOut зі спокоєм на обох кінцях; презентація продукту — appleOut/пружина; кінетична типографіка — expoOut + пружина.
// Колаж Vox: камера sineInOut або longTail, папір кроками 12fps; Kurzgesagt: рухи k75, цикли easyEase.
(() => {
const { clamp, lerp } = U;
const MO = window.MO = {};

// Розміри полотна U.setStage / U.onStage — у util.js; paint/brush/render/post, завантажені раніше за цей файл, теж мають зареєструватися.

// ---------- Часові відрізки ----------
MO.seg = (t, a, b) => clamp((t - a) / (b - a));                          // [a,b] → 0..1
MO.at = (t, t0, dur) => clamp((t - t0) / dur);                           // [t0, t0+dur] → 0..1
MO.anim = (lt, start, dur, ease = MO.smooth) => ease(clamp((lt - start) / dur));
// Кроковий час: неперервний час квантується до fps. Папір колажу, друк і маркер по два кадри на позу = 12fps; сюжетні персонажі 24fps; камера лишається плавною при 60fps.
MO.step = (t, fps = 12) => Math.floor(t * fps + 1e-6) / fps;

// ---------- Криві manim (3b1b/manim rate_functions.py) ----------
// smooth = 6t⁵−15t⁴+10t³: швидкість і прискорення нульові на обох кінцях. Типова крива для пояснювального відео.
MO.smooth = t => { t = clamp(t); return t * t * t * (10 - 15 * t + 6 * t * t); };
const sig = x => 1 / (1 + Math.exp(-x));
MO.smoothCE = (t, inflection = 10) => { const e = sig(-inflection / 2); return clamp((sig(inflection * (t - 0.5)) - e) / (1 - 2 * e)); };   // Версія ManimCE.
MO.thereAndBack = t => MO.smooth(t < 0.5 ? 2 * t : 2 * (1 - t));          // Для Indicate: туди й назад.
MO.rushInto = t => 2 * MO.smooth(t / 2);                                  // Повільний початок, різкий вихід до кінця.
MO.rushFrom = t => 2 * MO.smooth(t / 2 + 0.5) - 1;                        // Різкий початок, плавне завершення.
MO.doubleSmooth = t => t < 0.5 ? 0.5 * MO.smooth(2 * t) : 0.5 * (1 + MO.smooth(2 * t - 1));
MO.wiggle = (t, wiggles = 2) => MO.thereAndBack(t) * Math.sin(wiggles * Math.PI * t);
// manim LaggedStart(lag_ratio=r): локальний прогрес i-ї з n під-анімацій при загальному p. Загальна довжина = 1+(n-1)·r одиниць; i-та займає [i·r, i·r+1].
MO.lagged = (i, n, p, r = 0.05) => clamp(p * (1 + (n - 1) * r) - i * r);

// ---------- Поширені аналітичні криві (назви AE / CSS) ----------
MO.linear = p => p;
MO.sineInOut = p => -(Math.cos(Math.PI * p) - 1) / 2;
MO.cubicIn = p => p * p * p;
MO.cubicOut = p => 1 - Math.pow(1 - p, 3);
MO.cubicInOut = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
MO.quartOut = p => 1 - Math.pow(1 - p, 4);
MO.quintOut = p => 1 - Math.pow(1 - p, 5);
MO.quintInOut = p => p < .5 ? 16 * p ** 5 : 1 - Math.pow(-2 * p + 2, 5) / 2;
MO.expoIn = p => p <= 0 ? 0 : Math.pow(2, 10 * p - 10);
MO.expoOut = p => p >= 1 ? 1 : 1 - Math.pow(2, -10 * p);                // Найпоширеніше в моушн-дизайні: швидкий старт і повільна зупинка.
MO.expoInOut = p => p <= 0 ? 0 : p >= 1 ? 1 : p < .5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2;
// Переліт backOut: s=1.70158 ≈10%; 2.2 ≈13%; 2.6 ≈17%; 3.5 ≈23%.
MO.backOut = (p, s = 1.70158) => { const q = p - 1; return 1 + (s + 1) * q * q * q + s * q * q; };
// Пружне приземлення: один переліт і повернення, наче наліпка різко лягає на місце.
MO.elasticOut = p => p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * (2 * Math.PI / 3)) + 1;

// ---------- CSS cubic-bezier(x1,y1,x2,y2): методом Ньютона знаходимо параметр за x, потім беремо y ----------
MO.bezier = (x1, y1, x2, y2) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s, dX = s => (3 * ax * s + 2 * bx) * s + cx;
  return p => {
    if (p <= 0) return 0; if (p >= 1) return 1;
    let s = p; for (let k = 0; k < 8; k++) { const e = X(s) - p, d = dX(s); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; s -= e / d; }
    s = clamp(s); return Y(s);
  };
};
MO.appleOut = MO.bezier(0.25, 0.1, 0.25, 1);        // CSS ease: переходи на сайті Apple й у презентаціях.
MO.emphasized = MO.bezier(0.2, 0, 0, 1);            // Material 3 emphasized: уповільнення з довгим хвостом.
MO.k75 = MO.bezier(0.75, 0, 0.25, 1);               // Kurzgesagt: «75% influence для інших рухів» (дослідження y1 §6.2).
MO.easyEase = MO.bezier(0.333, 0, 0.667, 1);        // AE Easy Ease: циклічні рухи.
MO.longTail = MO.bezier(0.33, 0, 0.2, 1);           // Vox: слідування лінії та віддалення для розкриття; швидкий старт і довгий хвіст завершення (дослідження y2).

// ---------- Пружини ----------
// Параметризація SwiftUI (WWDC23 Animate with springs): stiffness=(2π/duration)², damping=4π(1-bounce)/duration → ζ=1-bounce, ω=2π/duration.
// Повертає переміщення 0→1; може бути >1 для перельоту. t у секундах. Для презентаційного UI: .smooth(bounce 0) / .snappy(0.15) / .bouncy(0.3).
MO.spring = (t, { duration = 0.5, bounce = 0, v0 = 0 } = {}) => {
  if (t <= 0) return 0;
  const w = 2 * Math.PI / duration, z = 1 - bounce;
  let x;                                                                 // x — залишкове переміщення 1→0.
  if (Math.abs(z - 1) < 1e-4) x = Math.exp(-w * t) * (1 + (w - v0) * t);
  else if (z < 1) { const wd = w * Math.sqrt(1 - z * z); x = Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w - v0) / wd) * Math.sin(wd * t)); }
  else { const r = Math.sqrt(z * z - 1), a = -w * (z - r), b = -w * (z + r); const A = (-v0 - b) / (a - b); x = A * Math.exp(a * t) + (1 - A) * Math.exp(b * t); }
  return 1 - x;
};
MO.smoothSpring = t => MO.spring(t, { duration: 0.5, bounce: 0 });
MO.snappy = t => MO.spring(t, { duration: 0.5, bounce: 0.15 });
MO.bouncy = t => MO.spring(t, { duration: 0.5, bounce: 0.3 });
// Ступінчастий відгук недодемпфованої пружини з частотою й загасанням, для кінетичної типографіки: freq у Hz, decay у 1/s.
// freq 3 / decay 6: перший переліт ≈37% для ударної появи великих літер; 2.5 / 9 ≈16% для звичайного вискакування; 2.2 / 10 ≈8% для приземлення головного слова.
MO.springHz = (t, freq = 2.5, decay = 9) => t <= 0 ? 0 : 1 - Math.exp(-decay * t) * Math.cos(2 * Math.PI * freq * t);
// Залишкові коливання після зупинки (інерційний відскок Dan Ebberts): amp·sin(2πft)/e^(decay·t). Для стискання тіла при зміні пози й тремтіння екрана.
MO.settle = (t, amp, freq = 3, decay = 5) => t <= 0 ? 0 : amp * Math.sin(2 * Math.PI * freq * t) / Math.exp(decay * t);

// ---------- Тривалості рухів камери; вибір описано в references/镜头语言.md ----------
// Дві групи: типові переходи (push — повільне наближення, glide — до наступного об’єкта, pull — віддалення; 0.6–1.5s із плавними початком і кінцем) та акценти (punch, pan, slam) для розкриття, чисел і поворотів.
// Тривалості переходів виміряні в референсах: Vox — наближення 1.0–1.5s, пошук картки 0.5–0.9s, віддалення близько 1s; 3b1b — наближення близько 1s.
// Акценти: відео з рівномірним наближенням на 7.5% у кожному кадрі назвали схожим на PPT; варіант «стоп → 0.28s різке наближення → стоп» схвалили. Але у ролику про Нобелівську премію 2026-10-12 наближення кожні 2 секунди оцінили як надмірні, надто швидкі й неплавні.
// Усі константи тривалості тут; CAM.track / MD / фрагменти читають їх звідси. Змінюйте ритм тут, не дублюйте значення у фрагментах.
MO.PULSE = { punch: 0.28, pan: 0.30, slam: 0.17, k: 0.25, kMin: 0.18, kMax: 0.32, push: 0.9, glide: 0.7, pull: 1.1 };
// Крива ударного входження: k=0..1 → масштаб. 1.55 → 0.94 (перші 60%, удар за 3 кадри) → 1.0 (останні 40%, відскок за 2 кадри). За k≤0 повертає 1.55: ще не приземлився.
MO.slamK = (k, from = 1.55, under = 0.94) => k <= 0 ? from : k < 0.6 ? from - (from - under) * (k / 0.6) : k < 1 ? under + (1 - under) * ((k - 0.6) / 0.4) : 1;
// Елемент ударно з’являється в at: повертає поточний масштаб; до at = 0, малювати ще не слід. o: {dur=0.17, from=1.55, under=0.94}.
MO.slam = (t, at, o = {}) => t < at ? 0 : MO.slamK((t - at) / (o.dur || MO.PULSE.slam), o.from, o.under);
// Прогрес руху: від at за dur секунд за ease від 0 до 1, далі лишається 1. Типово тривалість і крива punch; для повільного наближення — MO.pulse(t, at, MO.PULSE.push, MO.sineInOut).
MO.pulse = (t, at, dur = MO.PULSE.punch, ease = MO.cubicInOut) => ease(clamp((t - at) / dur));

// ---------- Постійні мікрорухи ----------
// Лише для середовища (мерехтіння зірок, частинки, дальні хмари) й художніх кадрів. Головні об’єкти, підписи й картки пояснювального відео після появи стоять, без плавання чи дихання.
// Плавання: сума двох синусоїд. Уникайте періоду близько 5s: за HIG постійні коливання близько 0.2Hz спричиняють дискомфорт.
MO.float = (t, amp = 6, period = 4, ph = 0) => amp * (0.75 * Math.sin(2 * Math.PI * t / period + ph) + 0.25 * Math.sin(2 * Math.PI * t / (period * 0.53) + ph * 1.7));

// ---------- Обернені функції й музичні долі ----------
// Обернена крива бісекцією: коли кінчик лінії або лічильник досягне y. Наприклад, для ламаної зі smooth визначити час досягнення x (позначення події у t3, план 2).
MO.invert = (ease, y, iters = 30) => { let a = 0, b = 1; for (let i = 0; i < iters; i++) { const m = (a + b) / 2; if (ease(m) < y) a = m; else b = m; } return (a + b) / 2; };
// Долі → секунди.
MO.beat = (n, bpm = 120) => n * 60 / bpm;
// Кадр розкриття на музичній долі: початок фрагмента = межа такту − точка розкриття × тривалість переходу (y5: zoom .55, колірна смуга .6, push до 90% зсуву в .58).
MO.onBeat = (barTime, revealP, trDur) => barTime - revealP * trDur;
})();
