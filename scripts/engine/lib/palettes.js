// Тематична палітра всього відео: spec.theme — назва, {name, перевизначені ключі} або повний об’єкт із 6 ключів. clip.js перетворює її на ctx.pal; усі 8 анімаційних мов беруть кольори звідси.
// Коли відео поєднує кілька анімаційних мов, тло, текст і акценти мають єдину палітру замість окремих жорстко заданих наборів.
// Кожна палітра має 6 ключів: bg — тло; surface — картка/папір/панель; ink — головний текст; sub — другорядний текст і лінії; accent — акцент; accent2 — другий акцент.
// Усі допоміжні кольори виводяться з цих 6: PAL.mix змінює світлоту, PAL.alpha — прозорість. Не додавайте відтінків поза палітрою.
(() => {
window.PALETTES = {
  paper:   { bg: '#F3EDE2', surface: '#FBF8F2', ink: '#1B1A17', sub: '#6B655B', accent: '#C8402F', accent2: '#2F5D62' },   // Папір.
  poster:  { bg: '#FFD23F', surface: '#FFF6D6', ink: '#111111', sub: '#4A4433', accent: '#FF5A36', accent2: '#14213D' },   // Плакатний жовтий.
  ink:     { bg: '#121417', surface: '#1E2226', ink: '#F2EFE8', sub: '#A39E93', accent: '#F2B33D', accent2: '#5FB3A1' },   // Темна туш.
  navy:    { bg: '#0D1B2A', surface: '#16293D', ink: '#EEF3F6', sub: '#8FA3B3', accent: '#5CC8E0', accent2: '#F2A93B' },   // Темно-синій, суцільний, без градієнта.
  bauhaus: { bg: '#EFE9DD', surface: '#FFFFFF', ink: '#111111', sub: '#555555', accent: '#D62828', accent2: '#1D4E89' },   // Баугауз.
  snow:    { bg: '#E9EEF0', surface: '#FFFFFF', ink: '#1F2A30', sub: '#5E6B72', accent: '#D9482B', accent2: '#3E7C8C' },   // Снігове поле.
  wood:    { bg: '#EDE3D1', surface: '#F7F1E6', ink: '#2B2622', sub: '#7A6E62', accent: '#C4552D', accent2: '#3F5B4B' },   // Тепле дерево.
  chalk:   { bg: '#23302B', surface: '#2E3D37', ink: '#F1EFE6', sub: '#A9B3AA', accent: '#F4D35E', accent2: '#E87D5A' },   // Шкільна дошка.
};
const KEYS = ['bg', 'surface', 'ink', 'sub', 'accent', 'accent2'];
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const rgb = h => { h = String(h).trim().replace('#', ''); if (h.length === 3) h = [...h].map(x => x + x).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const hex = v => '#' + v.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
const lin = x => { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
const PAL = window.PAL = {
  KEYS,
  names: () => Object.keys(window.PALETTES),
  rgb, hex,
  mix: (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); },   // a→b за t (0..1), повертає hex.
  alpha: (c, a) => { const v = rgb(c); return `rgba(${v[0]},${v[1]},${v[2]},${a})`; },
  lum: c => { const [r, g, b] = rgb(c).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; },   // Відносна яскравість WCAG.
  contrast: (a, b) => { const x = PAL.lum(a), y = PAL.lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); },
  dark: p => PAL.lum(p.bg) < 0.2,                                                            // Палітри з темним тлом: ink / navy / chalk.
  on: (bg, cands) => cands.reduce((best, c) => PAL.contrast(bg, c) > PAL.contrast(bg, best) ? c : best),   // Найчитабельніший колір тексту поверх bg.
  // spec.theme → повні 6 ключів і name. null / {} → null: кожна мова використовує типові кольори. Помилка → виняток, clip.js відмовляється запускатися.
  resolve(theme) {
    if (theme == null || (typeof theme === 'object' && !Array.isArray(theme) && !Object.keys(theme).length)) return null;
    const avail = `可用：${PAL.names().join(' / ')}`;
    let out;
    if (typeof theme === 'string') {
      if (!window.PALETTES[theme]) throw new Error(`spec.theme「${theme}」不是色板名。${avail}`);
      out = { name: theme, ...window.PALETTES[theme] };
    } else if (typeof theme === 'object' && !Array.isArray(theme)) {
      const unknown = Object.keys(theme).filter(k => k !== 'name' && !KEYS.includes(k));
      if (unknown.length) throw new Error(`spec.theme 里有不认识的键：${unknown.join(' ')}（只认 name 和 ${KEYS.join(' ')}）`);
      if (theme.name != null) {
        if (!window.PALETTES[theme.name]) throw new Error(`spec.theme.name「${theme.name}」不是色板名。${avail}`);
        out = { name: theme.name, ...window.PALETTES[theme.name], ...theme };
      } else {
        const miss = KEYS.filter(k => theme[k] == null);
        if (miss.length) throw new Error(`spec.theme 对象缺 ${miss.join(' ')}：写全 6 个键（${KEYS.join(' ')}），或加 name 用那套色板补缺的键。${avail}`);
        out = { name: 'custom', ...theme };
      }
    } else throw new Error(`spec.theme 要写色板名（字符串）或对象，收到的是 ${JSON.stringify(theme)}。${avail}`);
    const bad = KEYS.filter(k => !HEX.test(String(out[k])));
    if (bad.length) throw new Error(`spec.theme 的 ${bad.map(k => `${k}=${JSON.stringify(out[k])}`).join(' ')} 不是 #rgb / #rrggbb 色值`);
    for (const k of KEYS) out[k] = hex(rgb(out[k])).toUpperCase();
    return out;
  },
};
})();
