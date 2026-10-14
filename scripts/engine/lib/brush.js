// Пензель і вода: сухі просвіти пензля, мазок із загостреними кінцями, розтікання туші, довгі вигнуті лінії, акварельні заливки, щетинне імпасто, ламаний зріз ножицями. Усе доступне в PAINT (P).
// Джерела: тести перенесення A (туш/Мунк), B (Ghibli), C (Матісс), D (Рембрандт). Детермінованість: усі випадкові значення — із seed.
// P.brush(c, pts, opt): пензель зі зміною натиску на початку й наприкінці, вологим осердям і просвітами між окремими волосками; reveal поступово промальовує мазок (туш, каліграфія, контурні складки одягу).
// P.leaf(c, x, y, ang, L, w): мазок із двома гострими кінцями (листя бамбука й орхідеї, пташині крила, хвіст креветки).
// P.inkWash(c, key, grow, fn, o): форма спочатку на scratch, потім два розмиті проходи multiply на папір — зовнішній ореол і основа; grow 0→1 керує розтіканням.
// P.flowSeeds / P.flowLines: початкові точки інтегруються вздовж змінного в часі поля напрямків у довгі вигнуті мазки 200–300px (Мунк, а не короткі мазки Ван Гога).
// P.deform / P.watercolor: акварель — багатокутник із зміщенням середніх точок, кілька шарів multiply з малою α і тонкий контур кожного шару для краю висихання (тла Ghibli).
// P.rectPts / P.ellipsePts: набори точок багатокутників, типові для акварельних заливок.
// P.impasto(c, pts, w, col, hi): щетинне імпасто; один мазок — кілька паралельних тонких щетинок (відблиски Рембрандта, доповнення густих мазків Ван Гога).
// P.cut(pts, seed, step, amp): ламаний зріз — вибір точок контуру кожні step px, тремтіння й прямі з’єднання (витинанки Матісса, силуети, ксилографія).
(() => {
let W = 1920, H = 1080; U.onStage((w, h) => { W = w; H = h; });   // Розмір полотна задає U.setStage (типово 1920×1080).
const P = window.PAINT;
const { clamp, lerp, rng, ss } = U;

// ---------- Пензель ----------
// pts — контрольні точки: ущільнення Catmull-Rom і повторна вибірка через 4px уздовж дуги. Без неї частота шуму сухих просвітів залежить від довжини мазка.
// w — максимальна ширина; tone — непрозорість туші (найтемніша .9 / густа .8 / насичена .6 / світла .35 / бліда .15); dry 0..1 — сухі просвіти, більше наприкінці; reveal 0..1 — промальована частка.
// head/tail — частка початку/завершення мазка; bristles — кількість волосків; col — колір туші [r,g,b]; per — множник ущільнення.
// Пастка: кожен волосок має бути одним суцільним path із кінцями butt. Окремі короткі stroke з round накладаються темними вузлами, схожими на бамбук або мотузку.
P.brush = (c, pts, { w = 10, tone = 0.85, dry = 0.45, seed = 1, reveal = 1, bristles = 8, col = [16, 14, 12], head = 0.12, tail = 0.4, per = 5 } = {}) => {
  if (reveal <= 0) return;
  const D = KIT.resample(KIT.densify(pts, per), 4), n = D.length, m = Math.max(2, Math.ceil(n * clamp(reveal)));
  const r = rng(seed * 7919);
  const prof = q => ss(0, head, q) * (1 - 0.7 * ss(1 - tail, 1, q)) * (0.85 + 0.15 * P.noise(seed * 3.3, q * 6)) + 0.08;
  c.save(); c.lineCap = 'butt'; c.lineJoin = 'round';
  const N = [];
  for (let i = 0; i < n; i++) { const A = D[Math.max(0, i - 1)], B = D[Math.min(n - 1, i + 1)]; let dx = B[0] - A[0], dy = B[1] - A[1]; const d = Math.hypot(dx, dy) || 1; N.push([-dy / d, dx / d]); }
  const core = q => w * prof(q) * (1 - dry * 0.85 * Math.pow(q, 0.8));
  // Вологе осердя вздовж усього мазка: до кінця тоншає й блідне, бо туш вичерпується.
  c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${tone * 0.72})`; c.fill(KIT.ribbon(D.slice(0, m), (q, i) => core(i / (n - 1))));
  // Кожен волосок — суцільна лінія з розривами за шумом; сухі просвіти — це папір між волосками. До кінця розривів більше.
  for (let k = 0; k < bristles; k++) {
    const off = (k / (bristles - 1) - 0.5) * 0.95, bw = w / bristles * (0.9 + r() * 0.9), ph = r() * 50;
    c.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${tone * (0.45 + r() * 0.35)})`; c.lineWidth = Math.max(0.7, bw);
    c.beginPath(); let on = false;
    for (let i = 0; i < m; i++) {
      const q = i / (n - 1), dryness = dry * Math.pow(q, 1.2);
      const vis = P.noise(k * 1.9 + ph, i * 0.09) * 0.5 + 0.5 > dryness * 0.95 + 0.05;
      const o = off * w * prof(q), x = D[i][0] + N[i][0] * o, y = D[i][1] + N[i][1] * o;
      if (vis) { on ? c.lineTo(x, y) : c.moveTo(x, y); on = true; } else on = false;
    }
    c.stroke();
  }
  c.restore();
};
// Мазок із двома гострими кінцями (листя бамбука, орхідеї, пташине крило): довжина L уздовж ang, максимальна ширина wmax, легкий вигин.
P.leaf = (c, x, y, ang, L, wmax, tone = 0.88, col = [16, 14, 12]) => {
  if (!Array.isArray(col)) col = [16, 14, 12];
  const pts = []; for (let i = 0; i <= 10; i++) { const q = i / 10, bend = Math.sin(q * Math.PI) * 0.08 * L; pts.push([x + Math.cos(ang) * L * q - Math.sin(ang) * bend, y + Math.sin(ang) * L * q + Math.cos(ang) * bend]); }
  c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${tone})`; c.fill(KIT.ribbon(pts, q => wmax * Math.pow(Math.sin(Math.PI * Math.min(1, q * 1.1)), 0.7) + 0.6));
};

// ---------- Розтікання туші / шар заливки ----------
// fn(g) малює форму на scratch, досить суцільного кольору; grow 0..1 керує розтіканням: blur ореолу зростає, blur основи звужується.
// halo — радіус розмиття ореолу; haloA — його непрозорість; blur — розмиття основи; alpha — загальна непрозорість. Повертає scratch, придатний також для вирізання білих ділянок.
// Пастка: multiply прозорий, і задні лінії туші просвічують крізь заливку (підвіконня крізь котяче вухо). Спершу заповніть силует кольором паперу (clip, потім drawImage паперу), далі заливка: так ділянка залишається зарезервованою.
P.inkWash = (c, key, grow, fn, { blur = 2, halo = 10, haloA = 0.22, alpha = 1 } = {}) => {
  const S = P.scratch('inkw_' + key), g = S.getContext('2d'); g.reset(); fn(g);
  c.save(); c.globalCompositeOperation = 'multiply';
  if (grow > 0) {
    c.globalAlpha = haloA * alpha * grow; c.filter = `blur(${(halo * (0.4 + grow)).toFixed(2)}px)`; c.drawImage(S, 0, 0);
    c.globalAlpha = alpha * ss(0, 0.6, grow); c.filter = `blur(${(blur * (1.6 - grow * 0.6)).toFixed(2)}px)`; c.drawImage(S, 0, 0);
  }
  c.filter = 'none'; c.restore();
  return S;
};

// ---------- Довгі вигнуті мазки (експресіонізм «Крику» Мунка) ----------
// Початкові точки: сітка cell з випадковим зміщенням, кожна точка має два випадкові числа [x,y,r1,r2].
P.flowSeeds = (cell = 24, seed = 5) => { const r = rng(seed), o = []; for (let y = -10; y < H + 10; y += cell) for (let x = -10; x < W + 10; x += cell) o.push([x + (r() - .5) * cell, y + (r() - .5) * cell, r(), r()]); return o; };
// Для кожної точки: region(x,y,t) визначає ділянку → params[reg] = [steps, step, width, alpha] → інтегрування вздовж angle(x,y,t,reg). На виході за межі зупиняємося, щоб межі були чистими.
// color(reg, sx, sy, r1, t) повертає [r,g,b]. Без контурів, напівпрозорі шари: у Мунка довгі тонкі мазки. Темні контури Ван Гога перетворять їх на коротких сегментованих гусениць.
// Спочатку суцільна основа спорідненого кольору: між мазками має видніти той самий колір, а не чорний. Довжина: steps 26–42, step 6–8; мазок проходить 200–300px.
P.flowLines = (c, seeds, { t = 0, region, angle, color, params, extraSteps = 8 }) => {
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [sx, sy, r1, r2] of seeds) {
    const reg = region(sx, sy, t); const pr = params[reg]; if (!pr) continue; const [steps, step, width, alpha] = pr;
    const col = color(reg, sx, sy, r1, t);
    let x = sx, y = sy; c.beginPath(); c.moveTo(x, y);
    const n = steps + ((r2 * extraSteps) | 0);
    for (let i = 0; i < n; i++) { const a = angle(x, y, t, reg); x += Math.cos(a) * step; y += Math.sin(a) * step; if (region(x, y, t) !== reg) break; c.lineTo(x, y); }
    c.strokeStyle = P.rgb(col, alpha); c.lineWidth = width * (0.7 + r2 * 0.6); c.stroke();
  }
};

// ---------- Акварельні заливки (фонове мистецтво Ghibli) ----------
// Зміщення середніх точок: щораунду кожну середину ребра зсуваємо по нормалі на приблизно гауссову величину (сума 3 рівномірних чисел); амплітуда пропорційна довжині ребра, щораунду amp×0.6.
P.deform = (pts, depth, amp, r) => {
  let out = pts;
  for (let d = 0; d < depth; d++) {
    const n = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i], b = out[(i + 1) % out.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const g = (r() + r() + r() - 1.5) * amp * Math.min(1, len / 80), nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1);
      n.push(a, [(a[0] + b[0]) / 2 + nx * g, (a[1] + b[1]) / 2 + ny * g]);
    }
    out = n; amp *= 0.6;
  }
  return out;
};
const fillPts = (g, pts) => { g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); };
// Одна заливка: базова форма deform 3 раунди; кожен шар ще deform 2 раунди, заповнення з малою α (multiply — накладання прозорих фарб), контур того самого кольору 1.6px з α=edge (осад фарби утворює край висихання).
// fill може бути градієнтом; для непрозорого білого (рами, хмари, скатертина) — blend:'source-over', alpha .9.
// Типові параметри: велика стіна layers5 α.4 amp12; колірний ореол layers3 α.045 amp40; дошка layers3 α.5 amp3 edge.14.
// Пастка: темні ділянки робіть сильно деформованими багатокутниками (amp 60), не складайте з прямокутників: стики дадуть жорсткі краї. Для ореолів не перевищуйте α .05 × 3 шари, інакше кімната нагадуватиме запліснявілий пергамент.
P.watercolor = (g, pts, color, { layers = 7, alpha = 0.13, amp = 10, seed = 1, edge = 0.1, blend = 'multiply', fill } = {}) => {
  const r = rng(seed * 7919 + 13), base = P.deform(pts, 3, amp, r);
  g.save(); g.globalCompositeOperation = blend; g.lineJoin = 'round';
  for (let k = 0; k < layers; k++) {
    const q = P.deform(base, 2, amp * 0.55, r);
    fillPts(g, q); g.globalAlpha = alpha; g.fillStyle = fill || color; g.fill();
    if (edge) { g.globalAlpha = edge; g.strokeStyle = color; g.lineWidth = 1.6; g.stroke(); }
  }
  g.restore();
};
P.rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
P.ellipsePts = (cx, cy, rx, ry, n = 18) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * Math.PI * 2) * rx, cy + Math.sin(i / n * Math.PI * 2) * ry]);

// ---------- Щетинне імпасто ----------
// Один мазок = round(w/1.3) паралельних тонких щетинок (яскравість ±17, випадкове скорочення обох кінців на 0–25%) + слабка тінь знизу + поодинокі відблиски зверху. Разом — розмазана грудка густої фарби.
// Лише для освітлених місць (світле волосся, комір, порцеляна, перли, біле хутро). Пастка: три рівні лінії «тінь + мазок + світлий гребінь» виглядають як біла наліпка або пластир.
P.impasto = (c, pts, w, col, hi) => {
  const base = col.startsWith('#') ? P.hex(col) : [240, 230, 210];
  const A = pts[0], B = pts[pts.length - 1], ang = Math.atan2(B[1] - A[1], B[0] - A[0]), nx = -Math.sin(ang), ny = Math.cos(ang);
  const r = rng((A[0] * 13 + A[1] * 7) | 0), nb = Math.max(3, Math.round(w / 1.3));
  c.save(); c.lineCap = 'round';
  c.strokeStyle = 'rgba(40,18,6,.28)'; c.lineWidth = w * 0.9; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0] + nx * w * 0.45 + 1, p[1] + ny * w * 0.45 + 1.5) : c.moveTo(p[0] + nx * w * 0.45 + 1, p[1] + ny * w * 0.45 + 1.5)); c.stroke();
  for (let k = 0; k < nb; k++) {
    const o = (k / (nb - 1) - 0.5) * w, s0 = r() * 0.25, s1 = 1 - r() * 0.25, sh = (r() - 0.5) * 34 + (k < nb / 2 ? 14 : -10);
    c.strokeStyle = P.rgb([base[0] + sh, base[1] + sh, base[2] + sh * 0.8], 0.55 + r() * 0.4); c.lineWidth = 1.4 + r() * 1.2; c.beginPath();
    const n = pts.length - 1; for (let i = 0; i <= 8; i++) { const q = lerp(s0, s1, i / 8), j = Math.min(n - 1, Math.floor(q * n)), f = q * n - j, x = lerp(pts[j][0], pts[j + 1][0], f) + nx * o, y = lerp(pts[j][1], pts[j + 1][1], f) + ny * o; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
  }
  c.fillStyle = hi || 'rgba(255,250,232,.7)'; for (let k = 0; k < 2 + w / 3; k++) { const q = r(), x = lerp(A[0], B[0], q) - nx * w * 0.3, y = lerp(A[1], B[1], q) - ny * w * 0.3; c.beginPath(); c.arc(x, y, 0.9 + r(), 0, Math.PI * 2); c.fill(); }
  c.restore();
};

// ---------- Ламаний зріз ножицями ----------
// Замкнений набір точок повторно вибираємо з кроком step, додаємо кожній детерміноване зміщення ±amp і з’єднуємо прямими: край ручної витинанки. Для деталей RIG передавайте path.pts для повторного вирізання.
P.cut = (pts, seed, step = 18, amp = 2.5) => {
  const r = rng(seed), out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / step));
    for (let k = 0; k < n; k++) { const q = k / n; out.push([lerp(a[0], b[0], q) + (r() - 0.5) * amp * 2, lerp(a[1], b[1], q) + (r() - 0.5) * amp * 2]); }
  }
  return U.poly(out);
};
})();
