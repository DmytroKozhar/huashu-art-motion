// Спільні утиліти: завантажуються першими, використовуються бібліотекою переходів і рушієм.
(() => {
// ---------- Утиліти ----------
window.U = {
  TAU: Math.PI * 2,
  clamp: (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)),
  lerp: (a, b, p) => a + (b - a) * p,
  // smoothstep: коли x у [a,b], плавний перехід від 0 до 1; для початкового промальовування, проявлення й ритму всередині фрагмента.
  ss: (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); },
  // Лінійно розтягнути ділянку [a,b] параметра p до 0..1; для поділу переходу на етапи.
  seg: (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a))),
  // Крокова частота кадрів: неперервний час квантується до fps; уривчастість сама формує характер багатьох стилів.
  // Гумові мультперсонажі 12fps (по два кадри на позу), тіньові ляльки на стрижнях 10fps, танцюристи Гарінга з різкою зміною поз 8fps, «кипіння» мальованих ліній 8–12fps, плівковий шар 24fps.
  stepTime: (t, fps) => Math.floor(t * fps) / fps,
  ease: {
    linear: p => p,
    inOut: p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
    out: p => 1 - Math.pow(1 - p, 3),
    in: p => p * p * p,
    outBack: p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  },
  // Псевдовипадковість із seed: mulberry32.
  rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  hash(i, j = 0) { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; },
  // Набір точок → Path2D, ламана.
  poly(pts, closed = true) { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (closed) p.closePath(); return p; },
};

// ---------- Розміри полотна ----------
// Типово 1920×1080. Вертикальні фрагменти (clip.html, spec.width/height) і цілі вертикальні відео (index.html?w=1080&h=1920 або window.FILM_SIZE = [1080, 1920] в eras.js)
// під час запуску один раз викликають U.setStage(w,h). Бібліотеки, що залежать від розміру екрана (PAINT / BRUSH / RENDER / POST / KIT / TOON / CAM / UI / CH / DG / CL / MD, transitions.js, engine.js),
// реєструються через U.onStage й разом отримують зміни. Під час реєстрації callback одразу викликається з поточним розміром, тож пізніше завантажені бібліотеки теж його отримують.
// 35 художніх сцен у scenes/ намальовані для 1920×1080; у вертикальному форматі гарантовано працюють лише пояснювальні анімаційні мови, переходи й сам рушій.
const stageHooks = [];
window.STAGE = { W: 1920, H: 1080 };
U.onStage = f => { stageHooks.push(f); f(window.STAGE.W, window.STAGE.H); };
U.setStage = (w, h) => { w = Math.round(+w); h = Math.round(+h); if (!(w > 0 && h > 0)) throw new Error(`U.setStage：尺寸不对 ${w}×${h}`); window.STAGE = { W: w, H: h }; stageHooks.forEach(f => f(w, h)); };

// ---------- Перевірка гліфів ----------
// Якщо у файлі шрифту немає знака, браузер непомітно підставляє системний шрифт: measureText не помиляється, ширина правильна, але на іншій машині вигляд змінюється. У тестах B/D так було з повноширинними літерами, ▶, «戏» і «蓝».
// Рішення: після завантаження шрифтів під час запуску рушія прочитати cmap кожного файлу з FONT_FACES (WOFF1: розпакувати zlib через DecompressionStream) і перевіряти наявність знака в таблиці.
// Не порівнюйте резервні шрифти через measureText: Chromium на macOS підбирає системний шрифт для кожного знака залежно від основного; два варіанти можуть дати різні шрифти й не виявити відсутність гліфа. Це підтверджена хибна перевірка.
// font — назва family ('LXGWWenKai-500') або CSS-рядок ('80px "LXGWWenKai-500"'). Якщо family немає у FONT_FACES, вважаємо відсутніми всі гліфи.
const famOf = font => { const m = /"([^"]+)"/.exec(font) || /'([^']+)'/.exec(font); return m ? m[1] : String(font).replace(/^(italic\s+|bold\s+|\d+\s+)*[\d.]+px\s+/, '').trim(); };
const CMAPS = {};
const inflate = async (buf) => new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
async function readCmap(url) {
  const ab = await (await fetch(url)).arrayBuffer(), dv = new DataView(ab), sig = dv.getUint32(0);
  let tab = null;
  if (sig === 0x774F4646) {                                            // 'wOFF'
    const n = dv.getUint16(12);
    for (let i = 0; i < n; i++) { const o = 44 + i * 20; if (dv.getUint32(o) !== 0x636D6170) continue;   // 'cmap'
      const off = dv.getUint32(o + 4), comp = dv.getUint32(o + 8), orig = dv.getUint32(o + 12), raw = new Uint8Array(ab, off, comp);
      tab = comp < orig ? await inflate(raw) : raw.slice(); }
  } else {                                                             // Звичайний TTF/OTF без обгортки.
    const n = dv.getUint16(4);
    for (let i = 0; i < n; i++) { const o = 12 + i * 16; if (dv.getUint32(o) === 0x636D6170) tab = new Uint8Array(ab, dv.getUint32(o + 8), dv.getUint32(o + 12)).slice(); }
  }
  if (!tab) throw new Error('没有 cmap 表');
  const t = new DataView(tab.buffer, tab.byteOffset, tab.byteLength), set = new Set(), nt = t.getUint16(2);
  for (let i = 0; i < nt; i++) {
    const so = t.getUint32(4 + i * 8 + 4), fmt = t.getUint16(so);
    if (fmt === 4) { const segX2 = t.getUint16(so + 6), ends = so + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ros = deltas + segX2;
      for (let k = 0; k < segX2 / 2; k++) { const e = t.getUint16(ends + k * 2), s = t.getUint16(starts + k * 2), d = t.getInt16(deltas + k * 2), ro = t.getUint16(ros + k * 2);
        for (let ch = s; ch <= e && ch !== 0xFFFF; ch++) { let g; if (!ro) g = (ch + d) & 0xFFFF; else { g = t.getUint16(ros + k * 2 + ro + (ch - s) * 2); if (g) g = (g + d) & 0xFFFF; } if (g) set.add(ch); } } }
    else if (fmt === 12 || fmt === 13) { const ng = t.getUint32(so + 12); for (let k = 0; k < ng; k++) { const o = so + 16 + k * 12, s = t.getUint32(o), e = t.getUint32(o + 4), g = t.getUint32(o + 8);
      for (let ch = s; ch <= e; ch++) if (fmt === 13 ? g : g + ch - s) set.add(ch); } }
    else if (fmt === 0) { for (let ch = 0; ch < 256; ch++) if (t.getUint8(so + 6 + ch)) set.add(ch); }
    else if (fmt === 6) { const first = t.getUint16(so + 6), cnt = t.getUint16(so + 8); for (let k = 0; k < cnt; k++) if (t.getUint16(so + 10 + k * 2)) set.add(first + k); }
  }
  return set;
}
// Викликається один раз під час boot рушія після завантаження шрифтів. Помилки читання записуються через console.error, не блокуючи запуск.
U.loadCmaps = async (faces = window.FONT_FACES || []) => {
  await Promise.all(faces.map(async f => { try { CMAPS[f.family] = await readCmap(f.url); } catch (e) { console.error(`读不了字体 ${f.family} 的 cmap：${e}`); } }));
};
U.missingGlyphs = (font, text) => {
  const fam = famOf(font), cm = CMAPS[fam];
  const chars = [...new Set([...String(text)])].filter(ch => !/\s/.test(ch));
  if (!cm) return chars;
  return chars.filter(ch => !cm.has(ch.codePointAt(0)));
};
// Відсутні гліфи → console.error; qa.py / render.py трактують console.error сторінки як невдачу. Повертає true, якщо всі гліфи є.
U.assertGlyphs = (font, text, where = '') => {
  const fam = famOf(font), miss = U.missingGlyphs(font, text);
  if (miss.length) console.error(!CMAPS[fam] ? `字体「${fam}」没注册或没读到 cmap（lib/fonts.js 的 FONT_FACES）${where ? '（' + where + '）' : ''}`
    : `缺字形：字体「${fam}」里没有「${miss.join('')}」${where ? '（' + where + '）' : ''}——会静默回退系统字体。用 scripts/font_subset.py 补进子集，或改用路径自画。`);
  return miss.length === 0;
};
U.fontFamily = famOf;

})();
