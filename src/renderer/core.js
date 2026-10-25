// Shared by all parts of the window: item state, formatting, status and countdown, the short price-only search.
// The window parts are plain scripts sharing one global scope (index.html loads them in order).

const $ = (id) => document.getElementById(id);
// UI language (EN / RU) — src/shared/i18n.js; in-game names are not translated.
const { t } = window.i18n;
window.i18n.setLang(window.pc.uiLang());
let state = null; // { item, exchange, filters, searchable, league, leagues, rates, priceCurrency }
let rates = {}; // { chaos, exalted } per 1 div, mirror — div per 1 mirror
let searchSeq = 0;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Error text from the main process without the Electron wrapper ("Error invoking remote method 'search': Error: …").
function errText(e) {
  return String((e && e.message) || e).replace(/^Error invoking remote method '[\w-]+': (Error: )?/, '');
}
// Trade rate limit (⏳) — the next requests will fail too, so a series of searches stops.
const isLimit = (e) => errText(e).startsWith('⏳');

// Fewer than MIN_LOTS listings is not an estimate: one or two prices can be anything (sceptre: target 900 div, item at 13 div).
// Such a price is shown grey with "?", but no decisions are made on it (craft target, "evaluate", "what drives the price").
const MIN_LOTS = 3;
// The item's price for decisions (craft verdicts, gains): null while it rests on fewer than MIN_LOTS listings.
const estNow = () => (state && !state.estThin ? state.est : null);

// The short price-only search runs once per item and filters: a re-render (language change, craft after search) doesn't spend
// the trade limit. Reset with a new item and on league change; errors are not remembered.
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

// Price in divines → readable string: from 1 div — in div, cheaper — in chaos.
// Large counts — short: 38 416 → "38k" (RU "38 тыс.").
function countText(n) {
  const v = Math.round(n);
  if (v >= 1e6) return t('{n}M', { n: fmt(v / 1e6) });
  if (v >= 1e4) return t('{n}k', { n: String(Math.round(v / 1000)) });
  return v.toLocaleString('en-US');
}
// "1 in N" chance; from a thousand up — in words: "almost impossible (1 in 38k)".
function oddsText(n) {
  const s = t('1 in {n}', { n: countText(n) });
  return n >= 1000 ? t('almost impossible ({odds})', { odds: s }) : s;
}

// Price in the currency where the number is at least 1: from 1 div — div, from 1 chaos — chaos, cheaper — exalted.
// With a rounding tolerance: a 1-chaos listing converted to div and back is 0.9996 chaos, and without it every
// 1-chaos item showed as "≈ 71.7 ex".
const UNIT_EPS = 0.995;
function moneyUnit(div) {
  if (div >= UNIT_EPS || !rates.chaos) return 'div';
  if (div * rates.chaos >= UNIT_EPS || !rates.exalted) return 'chaos';
  return 'ex';
}
function money(div) {
  if (div == null) return '—';
  const u = moneyUnit(div);
  return `${fmt(u === 'div' ? div : u === 'chaos' ? div * rates.chaos : div * rates.exalted)} ${u}`;
}
// Prices read side by side (the plan's now · goal · currency) in one unit — 5 chaos against 10 ex makes you convert in
// your head. The unit of the smallest price; a bigger one only where the largest would run into thousands.
const MONEY_UNITS = ['ex', 'chaos', 'div'];
const divIn = (div, u) => (u === 'div' ? div : u === 'chaos' ? div * rates.chaos : div * rates.exalted);
// Estimates (the craft tab: averages, simulations) are rough anyway and currency is indivisible — whole numbers. A number
// that rounding would move by more than a tenth (1.26 chaos → 1) goes to the smaller unit instead (≈ 88 ex).
const whole = (v) => { const r = Math.round(v); return v >= 10 || (r >= 1 && Math.abs(r - v) <= v * 0.1) ? r : null; };
const hasRate = (u) => u === 'div' || (u === 'chaos' ? !!rates.chaos : !!rates.exalted);
function approxUnit(div) {
  for (let i = MONEY_UNITS.indexOf(moneyUnit(div)); i >= 0; i--) {
    if (!hasRate(MONEY_UNITS[i])) return MONEY_UNITS[i + 1] || 'div';
    if (i === 0 || whole(divIn(div, MONEY_UNITS[i])) != null) return MONEY_UNITS[i];
  }
  return 'ex';
}
function approx(div) {
  if (div == null) return '—';
  const u = approxUnit(div);
  const v = divIn(div, u);
  if (u === 'ex' && v < 0.5) return '< 1 ex';
  const r = u === 'ex' ? Math.round(v) : whole(v); // nothing smaller than an exalted
  return `${fmt(r != null ? r : Math.round(v * 10) / 10)} ${u}`;
}
function unitFor(vals) {
  const v = vals.filter((x) => Number.isFinite(x) && x > 0);
  if (!v.length) return null;
  let i = MONEY_UNITS.indexOf(approxUnit(Math.min(...v)));
  while (i < MONEY_UNITS.length - 1 && divIn(Math.max(...v), MONEY_UNITS[i]) >= 1000) i++;
  return MONEY_UNITS[i];
}
// In a fixed unit (numbers compared side by side): whole, or one decimal where the unit is big for it; below 1 — its own unit.
function moneyIn(div, u) {
  if (div == null || !u) return approx(div);
  const v = divIn(div, u);
  if (v < 1) return approx(div);
  const r = u === 'ex' ? Math.round(v) : whole(v); // nothing smaller than an exalted
  return `${fmt(r != null ? r : Math.round(v * 10) / 10)} ${u}`;
}

// ---- currency icons (src/main/icons.js): an orb reads faster than its name ----
// An <img> of a currency by its trade id («exalted») or name («Omen of Whittling»). Until the icon arrives — or if there
// is none — the name shows instead (CSS: .ci.on + .cn). Unknown icons are fetched in one batch and filled into every
// image of that currency on the page, so no render waits for them.
const ICONS = {}; // key → data URL | null; undefined while requested
const UNIT_KEY = { div: 'divine', chaos: 'chaos', ex: 'exalted', exalted: 'exalted', mirror: 'mirror' };
let iconBatch = null;
function wantIcon(key) {
  if (key in ICONS || !window.pc || !window.pc.icons) return;
  ICONS[key] = undefined;
  if (!iconBatch) {
    iconBatch = new Set();
    setTimeout(() => {
      const keys = [...iconBatch];
      iconBatch = null;
      window.pc.icons(keys).then((got) => {
        Object.assign(ICONS, got);
        for (const [k, src] of Object.entries(got)) {
          if (src) document.querySelectorAll(`img.ci[data-k="${CSS.escape(k)}"]`).forEach((n) => { n.src = src; n.classList.add('on'); });
        }
        fit();
      }).catch(() => {});
    }, 0);
  }
  iconBatch.add(key);
}
// named — the name stays next to the icon (currency chips: omens look alike); otherwise the icon replaces it.
function curIcon(key, label = key, named = false) {
  wantIcon(key);
  const src = ICONS[key];
  const img = `<img class="ci${src ? ' on' : ''}" data-k="${esc(key)}" alt=""${named ? '' : ` title="${esc(label)}"`}${src ? ` src="${src}"` : ''}>`;
  return named ? `${img}${esc(label)}` : `${img}<span class="cn">${esc(label)}</span>`;
}
// A formatted price («≈ 5 chaos», «from 2 div», «< 1 ex») with its units as icons: «≈ 5 ⬤». unitIcons — the same for
// text that is already escaped HTML.
const unitIcons = (html) => html.replace(/(\d[\d,.]*\s?)(div|chaos|exalted|ex|mirror)\b/g, (m, n, u) => `${n}${curIcon(UNIT_KEY[u], u)}`);
const moneyHtml = (text) => unitIcons(esc(text));

function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return t('{n}m', { n: Math.max(1, Math.round(s / 60)) });
  if (s < 86400) return t('{n}h', { n: Math.round(s / 3600) });
  return t('{n}d', { n: Math.round(s / 86400) });
}

// Mini chart as in the flipper (trendSvg): dashed zero line, the line is green above zero, red below,
// a dot on the last value. The same line is drawn twice, clipped at zero.
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

// Wide window: two columns (price: estimate and listings | filters, demand: builds | mods, craft: plan | all methods).
// Chosen by the user with the header button and remembered (setting wideWindow); never switched automatically.
let wide = false;
function setWide(on) {
  wide = !!on;
  document.body.classList.toggle('wide', wide);
  const b = $('wideBtn');
  if (b) { b.classList.toggle('on', wide); b.title = t(wide ? 'One column' : 'Two columns'); }
  if (wide) document.querySelectorAll('#craft .more-ways').forEach((d) => { d.open = true; });
}

// Tabs pinned under the header (position: sticky) while scrolling: the progressive blur moves from under the header to under
// the tabs (CSS: .tabs.stuck, body.tabs-stuck), otherwise content slides out from under the tabs sharp.
function stuckTabs() {
  const tabs = $('tabs');
  if (!tabs) return;
  const head = document.querySelector('.head');
  const on = !tabs.hidden && tabs.getBoundingClientRect().top <= head.getBoundingClientRect().bottom + 0.5;
  tabs.classList.toggle('stuck', on);
  document.body.classList.toggle('tabs-stuck', on);
}
document.addEventListener('scroll', stuckTabs, { capture: true, passive: true });

// Overlay scrollbar: the native one of the window is hidden (CSS body::-webkit-scrollbar), so the layout never shifts
// when the content starts to scroll (e.g. the plan is expanded). This thin thumb is drawn over the content: it shows
// while scrolling or with the mouse at the right edge, and can be dragged. Lives in <html>, not <body>: fit() sums
// the heights of body's children.
const sbar = document.createElement('div');
sbar.id = 'sbar';
sbar.hidden = true;
document.documentElement.appendChild(sbar);
let sbarTimer = null;
function updateSbar(show) {
  const b = document.body;
  const h = b.clientHeight, sh = b.scrollHeight;
  sbar.hidden = sh <= h + 1;
  b.classList.toggle('scrolls', !sbar.hidden);
  if (sbar.hidden) return;
  const thumb = Math.max(28, (h * h) / sh);
  sbar.style.height = `${thumb}px`;
  sbar.style.top = `${((h - thumb) * b.scrollTop) / (sh - h)}px`;
  if (show) {
    sbar.classList.add('on');
    clearTimeout(sbarTimer);
    sbarTimer = setTimeout(() => sbar.classList.remove('on'), 900);
  }
}
// Scroll and mousemove fire many times per frame: measure and move the thumb once per frame.
let sbarQueued = false;
function sbarSoon() {
  if (sbarQueued) return;
  sbarQueued = true;
  requestAnimationFrame(() => { sbarQueued = false; updateSbar(true); });
}
document.body.addEventListener('scroll', sbarSoon, { passive: true });
window.addEventListener('resize', () => updateSbar(false));
document.addEventListener('mousemove', (e) => { if (e.clientX > window.innerWidth - 16) sbarSoon(); }, { passive: true });
sbar.addEventListener('pointerdown', (e) => {
  const b = document.body;
  const startY = e.clientY, startTop = b.scrollTop;
  const ratio = (b.scrollHeight - b.clientHeight) / Math.max(1, b.clientHeight - sbar.offsetHeight);
  sbar.setPointerCapture(e.pointerId);
  sbar.classList.add('drag');
  const move = (ev) => { b.scrollTop = startTop + (ev.clientY - startY) * ratio; };
  const up = () => { sbar.classList.remove('drag'); sbar.removeEventListener('pointermove', move); sbar.removeEventListener('pointerup', up); };
  sbar.addEventListener('pointermove', move);
  sbar.addEventListener('pointerup', up);
  e.preventDefault();
});

let fitQueued = false;
function fit() {
  // Content height (header + main + footer), not body: body is stretched over the whole window for scrolling, and by it
  // the window would never shrink.
  // An open league list sits over the content (position: absolute) and isn't in the sum: the window is no shorter than its bottom.
  // One measurement and one resize per frame: a hotkey press calls fit() from a dozen places.
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(async () => {
    fitQueued = false;
    // Header and footer height — for the pinned tabs and the "Search" button (position: sticky).
    document.body.style.setProperty('--head-h', `${document.querySelector('.head').offsetHeight}px`);
    document.body.style.setProperty('--foot-h', `${document.querySelector('footer').offsetHeight}px`);
    const content = [...document.body.children].reduce((s, el) => s + el.offsetHeight, 0) + 2;
    const menus = ['leagueMenu', 'histMenu'].map($).filter((m) => m && !m.hidden);
    const r = await window.pc.fit(Math.max(content, ...menus.map((m) => Math.ceil(m.getBoundingClientRect().bottom) + 8)), wide);
    // Two columns don't fit the screen width — the window stays narrow (main decides), so does the layout.
    if (r && wide && !r.wide) setWide(false);
    stuckTabs();
    updateSbar(false);
  });
}

function setStatus(text, error) {
  const s = $('status');
  s.hidden = !text;
  s.textContent = text || '';
  s.classList.toggle('error', !!error);
}

// ---- countdown: elements with data-until (time in ms) show the seconds left; at zero the status line
// goes out, and data-then="search:<seq>" repeats the search (if the item is the same and the window is open) ----
// Text with "{n}" → markup with the countdown in place of the number.
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
