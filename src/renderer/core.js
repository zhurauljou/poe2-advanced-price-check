// Общее для всех частей окна: состояние вещи, форматирование, статус и отсчёт, короткий поиск ради цены.
// Части окна — обычные скрипты с общей областью видимости (index.html подключает их по порядку).

const $ = (id) => document.getElementById(id);
// Язык интерфейса (EN / RU) — src/shared/i18n.js; игровые названия не переводим.
const { t } = window.i18n;
window.i18n.setLang(window.pc.uiLang());
let state = null; // { item, exchange, filters, searchable, league, leagues, rates, priceCurrency }
let rates = {}; // { chaos, exalted } за 1 div, mirror — div за 1 зеркало
let searchSeq = 0;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Текст ошибки из главного процесса без обёртки Electron («Error invoking remote method 'search': Error: …»).
function errText(e) {
  return String((e && e.message) || e).replace(/^Error invoking remote method '[\w-]+': (Error: )?/, '');
}
// Лимит трейда (⏳) — следующие запросы тоже упадут, серию поисков останавливаем.
const isLimit = (e) => errText(e).startsWith('⏳');

// Короткий поиск ради цены — один раз на вещь и фильтры: перерисовка (смена языка, крафт после поиска) не тратит лимит
// трейда. Сбрасывается с новой вещью и сменой лиги; ошибки не запоминаем.
let quickMemo = new Map();
function quickPrice(item, filters) {
  const key = JSON.stringify([item, filters]);
  if (!quickMemo.has(key)) {
    const p = window.pc.quickPrice(item, filters);
    quickMemo.set(key, p);
    p.catch(() => quickMemo.delete(key));
  }
  return quickMemo.get(key);
}

function fmt(n) {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a > 0 && a < 1) return (+n.toPrecision(3)).toLocaleString('en-US', { maximumSignificantDigits: 3 });
  const d = a >= 100 ? 0 : a >= 10 ? 1 : 2;
  return (+n.toFixed(d)).toLocaleString('en-US');
}

// Цена в дивайнах → понятная строка: от 1 div — в div, дешевле — в chaos.
function money(div) {
  if (div == null) return '—';
  if (div < 1 && rates.chaos) return `${fmt(div * rates.chaos)} chaos`;
  return `${fmt(div)} div`;
}

function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return t('{n}m', { n: Math.max(1, Math.round(s / 60)) });
  if (s < 86400) return t('{n}h', { n: Math.round(s / 3600) });
  return t('{n}d', { n: Math.round(s / 86400) });
}

// Мини-график как во флиппере (trendSvg): пунктир нуля, выше нуля линия зелёная, ниже — красная,
// точка на последнем значении. Одна и та же линия рисуется дважды, обрезанная по нулю.
let svgUid = 0;
function spark(vals, { w = 96, h = 26 } = {}) {
  const pts = (vals || []).map((v, i) => [i, v]).filter((p) => p[1] != null && isFinite(p[1]));
  if (pts.length < 2) return '';
  const P = 2, n = vals.length - 1;
  const lo = Math.min(0, ...pts.map((p) => p[1])), hi = Math.max(0, ...pts.map((p) => p[1]));
  const x = (i) => (P + i / n * (w - 2 * P)).toFixed(1);
  const y = (v) => (hi === lo ? h / 2 : P + (hi - v) / (hi - lo) * (h - 2 * P)).toFixed(1);
  const line = pts.map(([i, v]) => `${x(i)},${y(v)}`).join(' ');
  const [li, lv] = pts[pts.length - 1];
  const id = `zc${++svgUid}`, yz = +y(0);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<defs><clipPath id="${id}p"><rect x="0" y="-1" width="${w}" height="${yz + 1}"/></clipPath>` +
    `<clipPath id="${id}n"><rect x="0" y="${yz}" width="${w}" height="${h - yz + 1}"/></clipPath></defs>` +
    `<line class="z" x1="0" x2="${w}" y1="${yz}" y2="${yz}"/>` +
    `<polyline class="pos" clip-path="url(#${id}p)" points="${line}"/><polyline class="neg" clip-path="url(#${id}n)" points="${line}"/>` +
    `<circle class="${lv >= 0 ? 'pos' : 'neg'}" cx="${x(li)}" cy="${y(lv)}" r="1.8"/></svg>`;
}

const pct1 = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;

function fit() {
  // Высота содержимого (шапка + main + футер), а не body: body растянут на всё окно ради прокрутки, и по нему
  // окно никогда бы не уменьшалось.
  // Открытый список лиг — поверх содержимого (position: absolute) и в сумму не входит: окно не короче его низа.
  requestAnimationFrame(() => {
    const content = [...document.body.children].reduce((s, el) => s + el.offsetHeight, 0) + 2;
    const menus = ['leagueMenu', 'histMenu'].map($).filter((m) => m && !m.hidden);
    window.pc.fit(Math.max(content, ...menus.map((m) => Math.ceil(m.getBoundingClientRect().bottom) + 8)));
  });
}

function setStatus(text, error) {
  const s = $('status');
  s.hidden = !text;
  s.textContent = text || '';
  s.classList.toggle('error', !!error);
}

// ---- обратный отсчёт: элементы с data-until (время в мс) показывают оставшиеся секунды; дошёл до нуля — строка
// статуса гаснет, а data-then="search:<seq>" повторяет поиск (если вещь та же и окно открыто) ----
// Текст с «{n}» → разметка с отсчётом на месте числа.
function untilHtml(key, until) {
  const [a, b] = t(key, { n: '\u0001' }).split('\u0001');
  return `${esc(a)}<span data-until="${until}"></span>${esc(b || '')}`;
}
function waitStatus(until) {
  const s = $('status');
  s.hidden = false;
  s.classList.remove('error');
  s.innerHTML = untilHtml('Waiting for the trade site rate limit… {n} s', until);
  tick();
}
function tick() {
  for (const el of document.querySelectorAll('[data-until]')) {
    const left = Math.ceil((Number(el.dataset.until) - Date.now()) / 1000);
    el.textContent = Math.max(0, left);
    if (left > 0) continue;
    el.removeAttribute('data-until');
    if (el.closest('#status')) setStatus('');
    const then = el.dataset.then;
    if (then && then === `search:${searchSeq}` && !document.hidden) runSearch();
  }
}
setInterval(tick, 500);

function setNote(text) {
  const n = $('note');
  n.hidden = !text;
  n.textContent = text || '';
}
