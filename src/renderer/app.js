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

// ---- шапка и подсказка, как в игре ----
// Название и база в шапке — переключатели поиска: «именно этот уник» и «именно эта база»
// (дорогие базы), иначе ищем по всей категории.
function renderBanner() {
  const { item, filters: f } = state;
  const b = $('banner');
  const two = item.name && item.baseType && item.name !== item.baseType;
  b.className = `banner ${item.rarity}${two ? '' : ' single'}`;
  const nameEl = $('name');
  const baseEl = two ? $('base') : $('name');
  $('name').textContent = item.name || item.baseType;
  $('base').textContent = two ? item.baseType : '';
  for (const el of [$('name'), $('base')]) { el.className = el.id === 'name' ? 'bn-name' : 'bn-base'; el.removeAttribute('title'); }
  if (!state.searchable) return;
  if (f.useName) {
    nameEl.classList.add('pick', 'on');
    nameEl.title = t('Searching this unique only — click to search any unique on this base');
  } else if (item.rarity === 'Unique' && two) {
    nameEl.classList.add('pick');
    nameEl.title = t('Click to search this unique only');
  }
  if (!f.useName && f.category) {
    baseEl.classList.add('pick');
    if (f.useType) baseEl.classList.add('on');
    baseEl.title = f.useType ? t('Searching this base only — click to search any item of this class')
      : t('Searching any item of this class — click to search this base only');
  }
}

// Выбор лиги — своя выпадашка: обычные лиги сверху, хардкор (HC / Hardcore) — ниже, с красным тегом.
const isHC = (l) => /^(HC |Hardcore)/.test(l);

// Обрезанное многоточием имя или база в шапке — полный текст в подсказке (впереди подсказки про клик).
function fullNameTitles() {
  requestAnimationFrame(() => {
    for (const el of [$('name'), $('base')]) {
      if (el.scrollWidth <= el.clientWidth) continue;
      el.title = el.textContent + (el.title ? `\n${el.title}` : '');
    }
  });
}

function renderLeagues() {
  $('leagueName').textContent = state.league;
  // Текущий сезон: трейд отдаёт лиги от новой к старой — первая не Standard и не хардкор.
  const season = state.leagues.find((l) => !isHC(l) && l !== 'Standard');
  const isSeason = (l) => season && (l === season || l === `HC ${season}`);
  const item = (l) => `<button data-league="${esc(l)}"${l === state.league ? ' class="on"' : ''}>${esc(l.replace(/^HC /, ''))}${isHC(l) ? '<span class="hc">HC</span>' : ''}${isSeason(l) ? `<span class="cur" title="${t('Current league')}">${t('current')}</span>` : ''}${l === state.league ? '<span class="chk">✓</span>' : ''}</button>`;
  const soft = state.leagues.filter((l) => !isHC(l));
  const hard = state.leagues.filter(isHC);
  $('leagueMenu').innerHTML = soft.map(item).join('') + (hard.length ? '<div class="lsep"></div>' + hard.map(item).join('') : '');
}

function toggleLeagueMenu(open) {
  const on = open != null ? open : $('leagueMenu').hidden;
  $('leagueMenu').hidden = !on;
  $('ldrop').classList.toggle('open', on);
  if (on) { toggleHistory(false); fit(); }
}

// ---- история проверок: последние вещи с оценкой; клик — проверить снова (окно остаётся на месте) ----
async function toggleHistory(open) {
  const on = open != null ? open : $('histMenu').hidden;
  $('histMenu').hidden = !on;
  $('hdrop').classList.toggle('open', on);
  if (!on) return;
  toggleLeagueMenu(false);
  const list = await window.pc.history().catch(() => []);
  $('histMenu').innerHTML = list.length ? list.map((h) => `<button data-hist="${esc(h.id)}"${state && h.id === state.historyId ? ' class="on"' : ''}>
      <span class="h-name">${esc(h.rarity === 'Rare' || h.rarity === 'Unique' ? h.name : h.baseType || h.name)}</span>
      ${h.rarity === 'Rare' || h.rarity === 'Unique' ? `<span class="h-base">${esc(h.baseType)}</span>` : ''}
      <span class="h-est">${h.est != null ? money(h.est) : '—'}</span><span class="h-ago">${ago(h.at)}</span></button>`).join('')
    : `<div class="h-empty">${esc(t('No checks yet'))}</div>`;
  fit();
}
$('histBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleHistory(); });
$('histMenu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-hist]');
  if (!b) return;
  toggleHistory(false);
  window.pc.historyOpen(b.dataset.hist);
});

// Оценку — в историю, и строка «в прошлый раз» (та же вещь, та же лига) под оценкой.
function recordPrice(est) {
  if (state && state.historyId && est != null) window.pc.historyPrice(state.historyId, est).catch(() => {});
}
function prevCheckHtml() {
  const p = state && state.previous;
  if (!p || p.est == null) return '';
  return `<div class="prev-check">${esc(t('Last check {ago} ago:', { ago: ago(p.at) }))} <b>≈ ${money(p.est)}</b></div>`;
}

// Свойство подсказки → фильтр защиты (state.filters.props по key).
// Строка свойства → фильтр трейда. Урон по типам ищется как DPS: физический — pDPS, стихийный — eDPS.
const PROP_KEY = { Armour: 'ar', 'Evasion Rating': 'ev', 'Energy Shield': 'es', Spirit: 'spirit',
  'Physical Damage': 'pdps', 'Fire Damage': 'edps', 'Cold Damage': 'edps', 'Lightning Damage': 'edps',
  'Critical Hit Chance': 'crit', 'Attacks per Second': 'aps' };
const PROP_OP = { pdps: 'pDPS ≥', edps: 'eDPS ≥', map_tier: '=' };
// Моды путевого камня, опасные для многих билдов.
const WAYSTONE_DANGER = [
  [/cannot Regenerate/i, 'No regeneration'],
  [/(less|reduced) Recovery Rate/i, 'Less recovery'],
  [/-\d+% to (all )?maximum .*Resistances?/i, 'Lower maximum resistances'],
  [/Cursed with/i, 'Players are cursed'],
  [/Monsters have \d+% (increased Critical Hit Chance|Critical Damage Bonus)/i, 'Monster critical hits'],
  [/Penetrate/i, 'Monsters penetrate resistances'],
  [/additional Projectiles/i, 'Extra monster projectiles'],
];

// Значение в подсказке, по которому можно искать: клик включает, рядом — граница поиска.
// ref: 'p:<i>' — фильтр защиты/DPS, 'm:<key>' — уровень/ilvl/гнёзда.
function pick(ref, label, valueHtml, filter, op, field) {
  if (!filter || !state.searchable) return `${label}: ${valueHtml}`;
  const bound = filter.enabled
    ? ` <span class="tp-op">${op}</span><input type="number" class="tp-in" data-ref="${ref}" data-f="${field}" value="${filter[field] ?? ''}">`
    : '';
  return `<span class="tp${filter.enabled ? ' on' : ''}" data-ref="${ref}" title="${filter.enabled ? t('Searching by this — click to ignore') : t('Click to search by this')}">${label}: ${valueHtml}${bound}</span>`;
}

// Строка подсказки: значения рядом, переносятся целиком (без «·» в конце строки).
const row = (items) => `<div class="row">${items.map((x) => `<span>${x}</span>`).join('')}</div>`;

function renderTooltip() {
  const { item } = state;
  const f = state.filters || {};
  const props = f.props || [];
  const propIdx = (key) => props.findIndex((p) => p.key === key);
  const lines = [];
  if (!state.exchange) {
    const plines = item.properties.map((p) => {
      const v = `<b class="${p.aug ? 'aug' : ''}">${esc(p.v)}</b>`;
      if (p.k === 'Quality') return pick('m:quality', 'Quality', v, f.quality, '≥', 'min');
      if (p.k === 'Grants Skill') return pick('m:skill', 'Grants Skill', v, f.skill, t('level ≥'), 'min');
      // Свойства путевого камня — по подписи из игры (pricing.propFilters кладёт её в label).
      let i = propIdx(PROP_KEY[p.k]);
      if (i < 0) i = props.findIndex((x) => x.group === 'map' && x.label === p.k);
      return i < 0 ? `${esc(p.k)}: ${v}` : pick(`p:${i}`, esc(p.k), v, props[i], PROP_OP[props[i].key] || '≥', 'min');
    });
    // DPS в игровой подсказке нет — показываем отдельной строкой, чтобы по нему тоже можно было искать.
    const dps = ['dps'].map(propIdx).filter((i) => i >= 0)
      .map((i) => pick(`p:${i}`, props[i].label, `<b>${fmt(props[i].value)}</b>`, props[i], '≥', 'min'));
    plines.push(...dps);
    if (plines.length) lines.push(row(plines));

    const meta = [];
    if (item.requires) {
      const rest = esc(item.requires.replace(/^Level \d+,?\s*/, ''));
      meta.push(item.reqLevel
        ? `Requires: ${pick('m:reqLevel', 'Level', `<b>${item.reqLevel}</b>`, f.reqLevel, '≤', 'max')}${rest ? `<span class="req-rest">, <b>${rest}</b></span>` : ''}`
        : `Requires: <b>${esc(item.requires)}</b>`);
    }
    if (item.ilvl) meta.push(pick('m:ilvl', 'Item Level', `<b>${item.ilvl}</b>`, f.ilvl, '≥', 'min'));
    if (item.gemLevel) meta.push(pick('m:gemLevel', 'Level', `<b>${item.gemLevel}</b>`, f.gemLevel, '≥', 'min'));
    if (item.sockets) meta.push(pick('m:sockets', 'Sockets', `<b>${'◆ '.repeat(item.sockets).trim()}</b>`, f.sockets, '≥', 'min'));
    if (meta.length) lines.push(row(meta));
  }
  const flags = [];
  // Состояния (Corrupted, Sanctified, Mirrored…) — переключатели: включённое требует то же у лота.
  const fl = (state.searchable && f.flags) || [];
  if (item.unidentified && !fl.some((x) => x.key === 'identified')) flags.push('<span class="corrupt">Unidentified</span>');
  // Состояние — три положения по клику: только как у вашей вещи → только противоположное → неважно.
  fl.forEach((x, i) => {
    const v = x.enabled ? x.value : x.own;
    const not = t('Not {lname}', { name: x.name, lname: x.name.toLowerCase() });
    const label = v ? x.name : not;
    const next = !x.enabled ? t('only such items') : x.value === x.own ? t('only "{label}"', { label: x.value ? not : x.name }) : t('any');
    flags.push(`<span class="tp flag ${x.key === 'corrupted' && v ? 'corrupt' : 'cls'}${x.enabled ? ' on' : ''}${v ? '' : ' neg'}" data-ref="f:${i}"
      title="${esc(x.enabled ? t('Searching only: {label}', { label }) : t('Ignored — any'))} · ${t('click:')} ${esc(next)}">${esc(label)}${x.enabled ? '' : ` <small>· ${t('any')}</small>`}</span>`);
  });
  if (!fl.length) {
    if (item.corrupted) flags.push(`<span class="corrupt">${item.twiceCorrupted ? 'Twice Corrupted' : 'Corrupted'}</span>`);
    if (item.mirrored) flags.push('<span class="cls">Mirrored</span>');
  }
  if (flags.length) lines.push(row(flags));
  // Путевой камень: моды, опасные для многих билдов, — заметно, до того как его купить или пройти.
  if (item.itemClass === 'Waystones') {
    const danger = WAYSTONE_DANGER.filter(([re]) => (item.modLines || []).some((l) => re.test(l.text))).map(([, label]) => `<span class="danger">⚠ ${esc(t(label))}</span>`);
    if (danger.length) lines.push(row(danger));
  }
  $('tooltip').innerHTML = lines.join('<div class="sep"></div>');
}

// ---- блок цены ----
// Та же цена в других валютах под крупной цифрой. Дорогое (от полу-зеркала) — ещё и в зеркалах.
function alt(div, selfId) {
  if (div == null) return '';
  const out = [];
  if (div >= 1) {
    if (rates.mirror && div >= rates.mirror / 2) out.push(`${fmt(div / rates.mirror)} mirror`);
  } else {
    out.push(`${fmt(div)} div`);
    if (rates.exalted && selfId !== 'exalted') out.push(`${fmt(div * rates.exalted)} ex`);
    // Дешевле chaos — понятнее «сколько штук за 1 chaos», чем «0.0148 chaos».
    if (rates.chaos && div * rates.chaos < 0.5) out.push(t('{x} per {cur}', { x: fmt(1 / (div * rates.chaos)), cur: 'chaos' }));
  }
  return out.join(' · ');
}

// Валюту оцениваем в популярной валюте на выбор: Div / Chaos / Ex. Выбор помним между запусками.
const UNITS = [['divine', 'Div', 'div'], ['chaos', 'Chaos', 'chaos'], ['exalted', 'Ex', 'ex']];
let unit = null;
try { unit = localStorage.getItem('exchangeUnit'); } catch {}

function perDiv(id) {
  return id === 'divine' ? 1 : rates[id];
}

// Цена в выбранной валюте; «auto» (ничего не выбрано или выбрана сама эта валюта) — по обычному правилу div/chaos.
function inUnit(div, u) {
  const def = UNITS.find((d) => d[0] === u);
  if (!def || !perDiv(u)) return money(div);
  return `${fmt(div * perDiv(u))} ${def[2]}`;
}

function renderExchangeHero() {
  const x = state.exchange;
  const stack = state.item.stack && state.item.stack.size > 1 ? state.item.stack.size : 0;
  const dir = x.change == null ? '' : x.change >= 0 ? 'up' : 'down';
  const u = unit && unit !== x.id ? unit : null;
  const shown = u || (x.divine >= 1 ? 'divine' : 'chaos');
  // Обратный курс: «67.6 per chaos» понятнее, чем «0.0148 chaos».
  const units = x.divine * (perDiv(shown) || 0);
  const inverse = units > 0 && units < 0.5 ? t('{x} per {cur}', { x: fmt(1 / units), cur: UNITS.find((d) => d[0] === shown)[2] }) : '';
  const others = UNITS.filter((d) => d[0] !== shown && d[0] !== x.id && perDiv(d[0]))
    .map((d) => `${fmt(x.divine * perDiv(d[0]))} ${d[2]}`);
  $('hero').hidden = false;
  $('hero').innerHTML = `
    <div class="k">${t('Price per unit')}</div>
    <div class="big">${x.image ? `<img src="${esc(x.image)}" alt="">` : ''}${inUnit(x.divine, shown)}</div>
    <div class="alt">${[inverse, ...others].filter(Boolean).join(' · ')}</div>
    <div class="seg units">${UNITS.filter((d) => d[0] !== x.id).map((d) =>
      `<button data-unit="${d[0]}"${d[0] === shown ? ' class="on"' : ''}>${d[1]}</button>`).join('')}</div>
    <div class="grid">
      <div><span class="k">${stack ? t('Stack ×{n}', { n: stack }) : t('Stack')}</span><span class="v">${stack ? inUnit(x.divine * stack, shown) : '—'}</span></div>
      <div class="trend"><span class="k">${t('7 days')}</span>${spark(x.spark)}
        ${x.spark && x.spark.length > 1 ? `<span class="tr ${dir}">${pct1(x.spark[0])} → ${pct1(x.spark[x.spark.length - 1])}</span>` : '<span class="v">—</span>'}</div>
      <div><span class="k">${t('24h volume')}</span><span class="v">${fmt(x.volume)} div</span></div>
    </div>${x.onExchange ? liveHtml(shown !== x.id ? shown : x.id === 'exalted' ? 'chaos' : 'exalted') : ''}`;
}

// ---- живая биржа трейда: лучшие предложения прямо сейчас (у poe.ninja — средняя за час). Лимит у биржи строгий
// (5 запросов за 15 с) — только по кнопке. ----
function liveHtml(have) {
  const lv = state.live;
  const cur = UNITS.find((d) => d[0] === have)[2];
  if (!lv || lv.have !== have) {
    return `<div class="live"><button class="link" data-act="live" data-have="${have}">${esc(t('Live offers on the exchange (in {cur})', { cur }))}</button></div>`;
  }
  if (lv.wait) return `<div class="live muted">${esc(t('Loading live offers…'))}</div>`;
  if (lv.error) return `<div class="live"><span class="bad">${esc(lv.error)}</span> <button class="link" data-act="live" data-have="${have}">${esc(t('Try again'))}</button></div>`;
  const rows = lv.data.offers.map((o, i) => `<div class="live-row" data-live="${i}" title="${esc(o.whisper ? t('Copy whisper to seller') : '')}">
      <b>${fmt(o.rate)} ${esc(cur)}</b><span class="muted">${fmt(o.get)} ${esc(t('for'))} ${fmt(o.pay)} ${esc(cur)}</span>
      <span class="muted">${esc(t('stock {n}', { n: fmt(o.stock) }))}</span><span class="seller"><span class="dot${o.online ? ' on' : ''}"></span>${esc(o.seller || '')}</span></div>`).join('');
  return `<div class="live"><div class="sect"><span>${esc(t('Live offers · price per unit'))}</span></div>
    ${rows || `<div class="muted">${esc(t('Nobody online sells it for {cur} right now', { cur }))}</div>`}
    <button class="link" data-act="live-site">${esc(t('Open the exchange ↗'))}</button></div>`;
}
async function loadLive(have) {
  const mine = state;
  state.live = { have, wait: true };
  heroRender();
  fit();
  try {
    const data = await window.pc.exchangeOffers(state.exchange.id, have);
    if (state !== mine) return;
    state.live = { have, data };
  } catch (e) {
    if (state !== mine) return;
    state.live = { have, error: errText(e) };
  }
  heroRender();
  fit();
}
$('hero').addEventListener('click', (e) => {
  const row = e.target.closest('[data-live]');
  const lv = state && state.live;
  if (!row || !lv || !lv.data) return;
  const o = lv.data.offers[+row.dataset.live];
  if (o && o.whisper) { window.pc.copy(o.whisper); setStatus(t('Whisper copied — switch to the game and paste it into chat (Enter, Ctrl+V)')); }
});

// Пустое состояние: значок, что случилось, пояснение (HTML) и кнопки действий [[data-act, подпись]].
function voidState(icon, title, html, actions = []) {
  return `<div class="void"><div class="vi">${icon}</div><div class="vt">${esc(title)}</div>${html ? `<div class="vd">${html}</div>` : ''}
    ${actions.length ? `<div class="va">${actions.map(([act, label]) => `<button data-act="${act}">${esc(label)}</button>`).join('')}</div>` : ''}</div>`;
}

// Кнопки пустых состояний — общие для всех вкладок.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || !state) return;
  const act = b.dataset.act;
  if (act === 'retry') { setNote(''); runSearch(); }
  if (act === 'relax') { setNote(''); runSearch(true); }
  if (act === 'trade' && state.tradeUrl) window.pc.openUrl(state.tradeUrl);
  if (act === 'price') setTab('price');
  if (act === 'impact') runImpact();
  if (act === 'live') loadLive(b.dataset.have);
  if (act === 'live-site' && state.live && state.live.data) window.pc.openUrl(state.live.data.url);
  if (act === 'elements') loadElements(searchSeq, true);
  if (act === 'session') { startSession(); window.pc.pin(true); craftFor = null; loadCraft(); }
  if (act === 'session-stop') { craftSession = null; window.pc.pin(false); craftFor = null; loadCraft(); }
});

// ---- руны Альдура: та же вещь в другой стихии (Passion / Ire / Breath / Betrayal) ----
let elementAlts = null; // { list: [{ element, rune, cost, needSocket, est, wait }], all }
async function loadElements(seq, all) {
  const vars = await window.pc.elementVariants(state.item, state.filters).catch(() => []);
  // Вариантов нет — убираем и блок прошлого поиска (иначе он оставался на экране).
  if (seq !== searchSeq || !vars.length) { if (seq === searchSeq) { elementAlts = null; renderElements(); } return; }
  if (!elementAlts || !all) elementAlts = { list: vars.map((v) => ({ ...v, wait: false, est: undefined })), all };
  elementAlts.all = all;
  const todo = all ? elementAlts.list.filter((v) => v.est === undefined) : elementAlts.list.slice(0, 1); // сразу — одна, лучшая по спросу
  for (const v of todo) {
    v.wait = true; renderElements();
    try {
      const q = await quickPrice(state.item, v.filters);
      if (seq !== searchSeq) return;
      v.est = estimate(q.lots); v.total = q.total;
    } catch (e) {
      if (seq !== searchSeq) return;
      v.est = null; setStatus(errText(e), true);
    }
    v.wait = false; renderElements();
  }
}
function renderElements() {
  let box = $('elements');
  if (!box) { box = document.createElement('div'); box.id = 'elements'; $('hero').after(box); }
  if (!elementAlts) { box.innerHTML = ''; box.hidden = true; return; }
  box.hidden = false;
  const now = state.est;
  const rows = elementAlts.list.filter((v) => v.est !== undefined || v.wait).map((v) => {
    const net = v.est != null ? v.est - v.cost : null;
    const better = net != null && now != null && net > now * 1.15;
    return `<div class="el-row${better ? ' better' : ''}"><span>${esc(t('As {element}', { element: v.element }))} <small class="game">${esc(v.rune)}${v.needSocket ? " + Artificer's Orb" : ''} ≈ ${money(v.cost)}</small></span>
      <b>${v.wait ? '…' : v.est == null ? esc(t('none listed')) : `≈ ${money(v.est)}`}</b></div>`;
  }).join('');
  const best = elementAlts.list.filter((v) => v.est != null).sort((a, b) => (b.est - b.cost) - (a.est - a.cost))[0];
  const tip = best && now != null && best.est - best.cost > now * 1.15
    ? `<div class="verdict good">${esc(t('Worth more as {element}: socket {rune} and sell for ≈ {price}', { element: best.element, rune: best.rune, price: money(best.est) }))}</div>` : '';
  const more = !elementAlts.all && elementAlts.list.length > 1 ? `<button class="link" data-act="elements">${esc(t('Check other elements ({n} searches)', { n: elementAlts.list.length - 1 }))}</button>` : '';
  box.innerHTML = `<div class="sect"><span>${esc(t('Other elements (Runes of Aldur)'))}</span></div>
    <div class="muted small" title="${esc(t('A Rune of Aldur permanently turns the elemental modifiers of a rare weapon into another element — so buyers of other elements are buyers of this item too'))}">${esc(t('The rune turns the elemental modifiers into another element for good'))}</div>
    ${rows}${tip}${more}`;
  fit();
}

// Пока ищем — заглушки той же формы, что и результат: окно не прыгает, когда приходят цены.
function renderSearchingHero() {
  $('hero').hidden = false;
  $('hero').innerHTML = `<div class="k">${t('Estimated price')}</div><span class="sk big"></span>
    <div class="alt">${t('Searching the trade site…')}</div><span class="sk line"></span>
    <div class="grid">${'<div><span class="sk" data-w="60%"></span><br><span class="sk" data-w="80%"></span></div>'.repeat(3)}</div>`;
  $('results').hidden = false;
  $('results').innerHTML = `<div class="sect"><span>${t('Cheapest listings')}</span></div><div class="lots">${[70, 55, 62, 48, 66].map((w) => `
    <div class="lot sk-row"><span class="sk" data-w="58px"></span><span></span>
      <span class="sk" data-w="${w}%"></span><span class="sk" data-w="24px"></span></div>`).join('')}</div>`;
}

// Оценка — медиана самых дешёвых (до 5) лотов: один демпингующий продавец её не уронит.
// Насколько верить оценке: сколько похожих лотов и насколько разбросаны цены самых дешёвых.
// Разброс — во сколько раз самая дорогая из (до 5) самых дешёвых дороже самой дешёвой.
function confidence(total, head, cheapest = []) {
  const spread = head.length > 1 && head[0] > 0 ? head[head.length - 1] / head[0] : 1;
  const allStale = cheapest.length >= 3 && cheapest.every((l) => l.age >= 7);
  let level = 2;
  let why = t('{n} listings, prices within ×{x}', { n: total, x: fmt(spread) });
  if (total >= 10 && spread <= 2 && !allStale) level = 3;
  else if (total < 4 || spread > 4 || allStale) level = 1;
  if (total < 4) why = t('only {n} similar listings', { n: total });
  else if (allStale) why = t('all cheapest listings are a week+ old — those prices may not be real');
  else if (spread > 4) why = t('cheapest prices differ ×{x} — someone may be underpricing', { x: fmt(spread) });
  const label = t({ 3: 'Reliable', 2: 'Some data', 1: 'Few listings' }[level]);
  return `<div class="conf c${level}" title="${esc(why)}">${'●'.repeat(level)}${'○'.repeat(3 - level)} ${label}</div>`;
}

// Сколько дней назад лот выставлен или переоценён (трейд: listing.indexed).
// Медиана отсортированного списка (из чётного числа — нижняя из двух средних).
const mid = (a) => a[Math.floor((a.length - 1) / 2)];
const ageDays = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 86400e3 : 99);

// Строка про возраст лотов: свежие за сутки, залежавшийся самый дешёвый, тренд «свежие дешевле/дороже».
function ageSummary(priced, usedFresh) {
  if (priced.length < 2) return '';
  const bits = [];
  const day = priced.filter((l) => l.age <= 1);
  if (day.length) bits.push(t('Fresh (24h): <b>{n}</b> from {price}', { n: day.length, price: money(day[0].div) }));
  if (priced[0].age >= 7) bits.push(`<span class="stale">${t('cheapest hung {n}d — likely overpriced', { n: Math.round(priced[0].age) })}</span>`);
  const newer = priced.filter((l) => l.age <= 3).map((l) => l.div);
  const older = priced.filter((l) => l.age > 3).map((l) => l.div);
  if (newer.length >= 2 && older.length >= 2) {
    const k = mid(newer) / mid(older);
    if (k < 0.85) bits.push(`<span class="down">↓ ${t('newer listings are cheaper')}</span>`);
    else if (k > 1.15) bits.push(`<span class="up">↑ ${t('newer listings are pricier')}</span>`);
  }
  if (usedFresh) bits.push(t('estimate from listings ≤ 3 days old'));
  return bits.length ? `<div class="ages">${bits.join(' · ')}</div>` : '';
}

function renderTradeHero(r) {
  const divs = r.listings.map((l) => l.divine).filter((v) => v != null).sort((a, b) => a - b);
  if (!divs.length && r.listingsError) {
    $('hero').innerHTML = voidState('⏳', t('Found {n} listings, but could not load them', { n: r.total }), esc(r.listingsError),
      [['retry', t('Try again')], ['trade', t('Open trade site')]]);
    return;
  }
  if (!divs.length) {
    $('hero').innerHTML = voidState('∅', t('No similar items listed right now'),
      t('It may be a rare high-end item. Uncheck filters or lower the minimums to widen the search.'),
      [['relax', t('Relax filters')], ['trade', t('Open trade site')]]);
    return;
  }
  // Возраст лотов: залежавшийся дешёвый лот (неделю+ не купили) завышает картину — за эту цену не берут.
  // Если свежих (≤ 3 дней) лотов хватает, оценку строим по ним; иначе — по всем, но надёжность ниже.
  // edge — насколько лот сильнее вашей вещи (▲ минус ▼ по модам): заметно сильнее (≥ 2) не должен тянуть оценку вверх.
  const priced = r.listings.filter((l) => l.divine != null).map((l) => { const c = cmpCounts(l); return { div: l.divine, age: ageDays(l.indexed), edge: c.better - c.worse }; })
    .sort((a, b) => a.div - b.div);
  const stronger = (l) => l.edge >= STRONGER;
  // Большинство дешёвых лотов сильнее вашей вещи — оцениваем по тем, что не сильнее; таких нет — по самому дешёвому.
  const mostlyStronger = priced.length >= 3 && priced.slice(0, 5).filter(stronger).length * 2 > Math.min(5, priced.length);
  const pool = mostlyStronger ? priced.filter((l) => !stronger(l)) : priced;
  const fresh = pool.filter((l) => l.age <= 3);
  const basis = mostlyStronger && pool.length < 2 ? [priced[0].div] : fresh.length >= 3 ? fresh.map((l) => l.div) : pool.map((l) => l.div);
  const head = basis.slice(0, 5);
  const est = mid(head);
  const median = mid(divs);
  const ageHtml = ageSummary(priced, fresh.length >= 3 && fresh.length < priced.length)
    + (mostlyStronger ? `<div class="ages"><span class="warn-t">${esc(t('Most listings are stronger than your item (more ▲ than ▼) — estimated from the weaker ones; your item is likely worth less than the list suggests'))}</span></div>` : '');
  // Вторая цена: те же моды с любым роллом своего тира — сколько рынок доплачивает за ваши роллы.
  let floorHtml = '';
  const fl = r.floor;
  if (fl && fl.divs.length) {
    const fest = fl.lots ? estimate(fl.lots) : mid(fl.divs.slice(0, 5)); // то же правило, что у основной цены
    const premium = fest > 0 ? Math.round((est / fest - 1) * 100) : 0;
    floorHtml = `<div class="floor" title="${t('Same modifiers with any roll of the same tier')}">
      ${t('Any roll in tier:')} <b>${money(fest)}</b> · ${t('{n} listed', { n: fl.total })}
      ${premium >= 15 ? `<span class="prem">${t('your rolls ≈ +{n}%', { n: premium })}</span>` : ''}</div>`;
  }
  state.est = est;
  const drivable = state.filters.mods.some((m) => m.enabled && m.statId && !m.option && !m.inSum);
  $('hero').innerHTML = `
    <div class="k">${fl ? t('Like yours') : t('Estimated price')}</div>
    <div class="big">${money(est)}</div>
    <div class="alt">${alt(est)}</div>
    ${confidence(r.total, head, priced.slice(0, 5))}
    ${missingKeyHtml()}
    ${floorHtml}
    <div class="ninja-u">${ninjaLine()}</div>
    ${ageHtml}
    ${sellHtml(priced, est, divs[0], median, divs.length)}
    ${drivable ? `<button class="link drive-btn" data-act="impact" title="${t('Searches again without each key modifier (a few trade requests)')}">${t('What drives the price?')}</button>` : ''}`;
}

// Цена уника на poe.ninja — одна на название + базу, без роллов: опора «за самую простую копию».
function ninjaLine() {
  const u = state.uniqueNinja;
  if (!u) return '';
  const below = state.est != null && state.est < u.divine * 0.8;
  return `<span title="${t('poe.ninja: the cheapest copies of this unique, any rolls')}">${t('poe.ninja (any rolls):')} <b>${money(u.divine)}</b> · ${t('{n} listed', { n: u.listings })}</span>`
    + (below ? ` · <span class="down" title="${t('Listings like yours are cheaper than the plain floor — check the filters')}">${t('below poe.ninja')}</span>` : '');
}

async function loadUniqueNinja() {
  const it = state.item;
  if (it.rarity !== 'Unique' || !it.name) return;
  const mine = state;
  try {
    const u = await window.pc.uniquePrice(it.name, it.baseType);
    if (mine !== state || !u) return;
    state.uniqueNinja = u;
    const el = document.querySelector('#hero .ninja-u');
    if (el) { el.innerHTML = ninjaLine(); fit(); }
  } catch {}
}

// Нет ключевого мода (его носят почти все билды): вещь стоит намного меньше «полных» — объясняем прямо в оценке.
function missingKeyHtml() {
  const miss = (state.filters.exclude || []);
  if (!miss.length) return '';
  return `<div class="miss-key">⚠ ${miss.map((x) => t('No "{mod}" — {pct}% of builds have it', { mod: esc(x.text), pct: fmt(x.pct) })).join('<br>')}
    <small>${esc(t(miss.some((x) => x.enabled) ? 'Compared with listings that lack it too; with it the item would be worth much more — see Craft' : 'Listings with it are included — the estimate is likely too high'))}</small></div>`;
}

// Оценка по лотам [{ div, indexed }] — то же правило, что у основной цены: хватает свежих (≤ 3 дней) — по ним;
// медиана до 5 самых дешёвых.
function estimate(lots) {
  const sorted = (lots || []).filter((l) => l.div != null).sort((a, b) => a.div - b.div);
  const fresh = sorted.filter((l) => ageDays(l.indexed) <= 3);
  const head = (fresh.length >= 3 ? fresh : sorted).slice(0, 5).map((l) => l.div);
  return head.length ? mid(head) : null;
}

// Цена для выставления — круглая, в валюте, которой так торгуют: от 1 div — div, дешевле — chaos, совсем дёшево — ex.
function listPrice(div) {
  const round = (v, step) => Math.max(step, Math.round(v / step) * step);
  if (div >= 1) {
    const amount = round(div, div < 10 ? 0.5 : div < 50 ? 1 : 5);
    return { amount, cur: 'divine', label: `${fmt(amount)} div` };
  }
  if (rates.chaos && div * rates.chaos >= 1) {
    const amount = round(div * rates.chaos, 1);
    return { amount, cur: 'chaos', label: `${amount} chaos` };
  }
  const amount = round(div * (rates.exalted || 0), 1);
  return { amount, cur: 'exalted', label: `${amount} ex` };
}

// Три цены для продажи: быстро (чуть ниже самого дешёвого живого лота), по рынку (оценка), подождать (выше рынка,
// не дороже следующих по цене лотов). Клик копирует «~price N currency» для заметки в стеше.
function sellHtml(priced, est, cheapest, median, n) {
  if (!est || !priced.length) return '';
  const active = priced.filter((l) => l.age < 7);
  // Один демпингующий лот не должен утянуть «быструю» цену вниз: не дешевле 60% рынка.
  const quick = Math.min(est * 0.95, Math.max(est * 0.6, (active[0] || priced[0]).div * 0.95));
  const next = priced[Math.min(4, priced.length - 1)].div;
  const patient = Math.min(est * 2, Math.max(est * 1.2, next));
  // Вместо «Cheapest / Median / Listings» — цены для выставления: те же цифры, но сразу как действие.
  // Самый дешёвый лот и медиана — в подсказках, число лотов — в заголовке списка.
  const opts = [['Quick sale', quick, t('Just under the cheapest active listing — sells fastest. Cheapest listed: {price}', { price: money(cheapest) })],
    ['Market', est, t('The estimate above')], ['Patient', patient, t('Above the market — wait for a buyer. Median of {n}: {price}', { n, price: money(median) })]]
    .map(([k, div, title]) => ({ k, title, ...listPrice(div) }))
    // Совпали цены — остаётся Market, а не первая попавшаяся.
    .filter((o, i, a) => o.k === 'Market' || (o.label !== a[1].label && !a.slice(0, i).some((p) => p.label === o.label)));
  return `<div class="grid sell">${opts.map((o) => `
    <div><span class="k">${t(o.k)}</span><span class="v copy" data-note="~price ${o.amount} ${o.cur}" title="${o.title}
${t('Click to copy the price note')}">${o.label}</span></div>`).join('')}</div>`;
}

// Вклад модов в цену: по очереди ищем без каждого из главных модов (до 4) — насколько падает цена.
const IMPACT_MODS = 4;
let impactSeq = 0;
async function runImpact() {
  if ($('search').classList.contains('dirty')) { setStatus(t('Filters changed — search first, then check what drives the price')); return; }
  const seq = ++impactSeq;
  const idx = state.filters.mods.map((m, i) => [m, i]).filter(([m]) => m.enabled && m.statId && !m.option && !m.inSum)
    .sort((a, b) => (b[0].importance || 0) - (a[0].importance || 0)).slice(0, IMPACT_MODS).map(([, i]) => i);
  state.impact = {};
  idx.forEach((i) => { state.impact[i] = { wait: true }; });
  renderFilters();
  fit();
  for (const i of idx) {
    const f = JSON.parse(JSON.stringify(state.filters));
    f.mods[i].enabled = false;
    try {
      const q = await quickPrice(state.item, f);
      if (seq !== impactSeq) return;
      const without = estimate(q.lots);
      state.impact[i] = { without, total: q.total, share: without == null ? null : Math.max(0, 1 - without / state.est) };
    } catch (e) {
      if (seq !== impactSeq) return;
      state.impact[i] = { error: errText(e) };
      if (isLimit(e)) {
        // Остальные тоже упрутся в лимит — не ждём, помечаем сразу.
        for (const j of idx) if (state.impact[j] && state.impact[j].wait) state.impact[j] = { error: errText(e) };
        setStatus(errText(e), true);
        renderFilters();
        fit();
        return;
      }
    }
    renderFilters();
    fit();
  }
}

function driveChip(i) {
  const d = state.impact && state.impact[i];
  if (!d) return '';
  if (d.wait) return ' <span class="drive wait">…</span>';
  if (d.error) return ` <span class="drive" title="${esc(d.error)}">?</span>`;
  if (d.share == null) return ` <span class="drive" title="${t('Nothing listed without it')}">—</span>`;
  const pct = Math.round(d.share * 100);
  return ` <span class="drive${pct >= 50 ? ' big' : pct < 10 ? ' low' : ''}" title="${t('Without it: {price}', { price: money(d.without) })} · ${t('{n} listed', { n: d.total })}">${pct < 5 ? t('adds ~0') : t('≈{n}% of price', { n: pct })}</span>`;
}

// ---- популярные билды (poe.ninja) ----
// Уник — по имени; редкая/магическая — категория, база (если выбрана в шапке) и 2–3 самых важных
// включённых мода: с полным списком модов у ninja почти не остаётся билдов.
function buildsQuery() {
  const { item, filters: f } = state;
  if (!f) return null;
  if (item.rarity === 'Unique' && f.useName) return { uniqueName: item.name };
  if (!['Rare', 'Magic', 'Normal'].includes(item.rarity) || !f.category) return null;
  const mods = f.mods.filter((m) => m.enabled && m.statId && m.tag !== 'pseudo' && m.tag !== 'implicit' && m.tag !== 'rune')
    .sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 3).map((m) => m.text.split('\n')[0]);
  // Белые и магические вещи — заготовки: носят их уже редкими, поэтому спрос — по редким (магических почти никто не носит).
  return { itemClass: item.itemClass, rarity: 'Rare', baseType: f.useType ? item.baseType : undefined, mods };
}

let buildsSeq = 0;
// Последние данные вкладки Demand — перерисовать при смене языка.
let lastBuilds = null;
let lastDemand = null;
async function loadBuilds() {
  const q = buildsQuery();
  const box = $('builds');
  if (!q) { box.hidden = true; return; }
  const seq = ++buildsSeq;
  box.hidden = false;
  lastBuilds = null;
  box.innerHTML = `<div class="sect"><span>${t('Popular builds')}</span></div><div class="muted center">${t('Loading from poe.ninja…')}</div>`;
  fit();
  try {
    const b = await window.pc.builds(q);
    if (seq !== buildsSeq) return;
    lastBuilds = b;
    renderBuilds(b);
  } catch (e) {
    if (seq !== buildsSeq) return;
    box.innerHTML = `<div class="sect"><span>${t('Popular builds')}</span></div><div class="muted center">poe.ninja: ${esc(errText(e))}</div>`;
  }
  fit();
}

// ---- спрос по категории (poe.ninja): какие базы и моды носят на таких вещах ----
let demandSeq = 0;
let demandAll = false; // true — спрос по всем билдам класса, без темы вещи
async function loadDemand() {
  const { item, filters: f } = state;
  const box = $('demand');
  if (!f || !f.category || !['Rare', 'Magic', 'Normal'].includes(item.rarity)) { box.hidden = true; return; }
  const seq = ++demandSeq;
  box.hidden = false;
  lastDemand = null;
  box.innerHTML = `<div class="sect"><span>${t('Demand')}</span></div><div class="muted center">${t('Loading from poe.ninja…')}</div>`;
  try {
    // По умолчанию — среди билдов, которые носят такую вещь с ключевыми модами вашей (та же тема, что в «Популярных билдах»).
    const q = buildsQuery();
    const withMods = demandAll || !q ? [] : (q.mods || []).slice(0, 2);
    const d = await window.pc.demand({ itemClass: item.itemClass, rarity: 'Rare', withMods });
    if (seq !== demandSeq) return;
    lastDemand = d;
    renderDemand(d);
  } catch (e) {
    if (seq !== demandSeq) return;
    box.innerHTML = `<div class="sect"><span>${t('Demand')}</span></div><div class="muted center">poe.ninja: ${esc(errText(e))}</div>`;
  }
  fit();
}

// Шаблон мода, как у ninja: «# to maximum Life», «#% to Fire Resistance» — наш шаблон трейда без «(Local)».
const ninjaTemplate = (t) => (t || '').replace(/ \(Local\)$/, '').toLowerCase();

function renderDemand(d) {
  const { item, filters: f } = state;
  if (!d.category || !d.total) {
    $('demand').innerHTML = `<div class="sect"><span>${t('Demand')}</span></div>${voidState('◇', t('No poe.ninja data'), t('poe.ninja has no build stats for this item class.'))}`;
    return;
  }
  const mine = new Set(f.mods.filter((m) => m.template).map((m) => ninjaTemplate(m.template)));
  // Топ-10 + все моды вашей вещи, даже вне топа (с местом в рейтинге): ключевой мод узкой темы (+уровни миньонов)
  // в общий топ класса может не попасть, но для покупателей с этой темой он главный.
  const TOP = 10;
  // Моды темы у таких билдов по определению на 100% — в списке они ничего не говорят.
  const themeSet = new Set((d.themed || []).map((x) => x.toLowerCase()));
  const all = d.mods.filter((r) => !themeSet.has(r.name.toLowerCase())).map((r, i) => ({ ...r, rank: i + 1, mine: mine.has(r.name.toLowerCase()) }));
  const modRows = all.filter((r) => r.rank <= TOP || r.mine);
  const hits = all.filter((r) => r.mine && r.rank <= TOP).length;
  const baseRows = d.bases.slice(0, TOP).map((r) => ({ ...r, mine: r.name === item.baseType }));
  const baseRank = d.bases.findIndex((b) => b.name === item.baseType);
  $('demand').innerHTML = `
    <div class="sect"><span>${t('Demand')} · ${esc(d.category)}</span></div>
    ${d.themed && d.themed.length
      ? `<div class="bwhat">${t('Among builds wearing it with')} <b class="theme">${d.themed.map(esc).join(' + ')}</b> · <button class="link" data-dall="1">${t('all builds')}</button></div>`
      : `<div class="bwhat muted">${demandAll ? `${t('All builds')} · <button class="link" data-dall="0">${t('builds like your item')}</button>` : t("Too few builds with your item's modifiers — showing all builds")}</div>`}
    <div class="bshare">${t('Worn by <b>{pct}%</b> of level {lvl}+ builds', { pct: fmt(d.total / d.allTotal * 100), lvl: demandLevel })}</div>
    <div class="bwhat muted">${t('Your item:')} ${baseRank >= 0 ? t('base #{n}', { n: baseRank + 1 }) : t('base not in top 10')} · ${t('{n} of top {m} modifiers', { n: hits, m: Math.min(TOP, all.length) })}</div>
    ${demandList('bases', t('Most worn bases'), baseRows)}
    ${demandList('mods', t('Most common modifiers'), modRows)}
    <button class="link bopen" data-url="${esc(d.page)}">poe.ninja ↗</button>`;
}

// Список спроса: сразу 5 строк + всё, что есть на вашей вещи; остальное — по «Show all».
const DEMAND_SHOWN = 5;
const openDemand = new Set();
function demandList(key, title, rows) {
  const hidden = rows.filter((r, i) => i >= DEMAND_SHOWN && !r.mine).length;
  const open = openDemand.has(key);
  return `<div class="dcol${open ? ' all' : ''}"><div class="k">${title}</div>${rows.map((r, i) => `
    <div class="brow ${heat(r.pct)}${r.mine ? ' mine' : ''}${i >= DEMAND_SHOWN && !r.mine ? ' more' : ''}"${r.mine ? ` title="${t('Your item has this')}"` : ''}><span class="bname">${r.mine ? '✓ ' : ''}${esc(r.name)}${r.rank > 10 ? ` <span class="rank">#${r.rank}</span>` : ''}</span><span class="bpct">${hot(r.pct)}${fmt(r.pct)}%</span>
      <span class="bbar"><i data-w="${Math.min(100, r.pct)}%"></i></span></div>`).join('')}
    ${hidden ? `<button class="link bmore" data-dmore="${key}">${open ? t('Show fewer') : t('Show all {n}', { n: rows.length })}</button>` : ''}</div>`;
}

function setTab(name) {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $('tab-price').hidden = name !== 'price';
  $('tab-demand').hidden = name !== 'demand';
  $('tab-craft').hidden = name !== 'craft';
  if (name === 'craft') loadCraft();
  fit();
}

// ---- вкладка Craft: что и чем добавить/заменить. Грузим по открытию вкладки, один раз на предмет. ----
let craftFor = null;
async function loadCraft() {
  if (craftFor === state) return;
  const mine = craftFor = state;
  const box = $('craft');
  box.innerHTML = `<div class="sect"><span>${t('Craft')}</span></div><div class="muted center">${t('Loading mod pool…')}</div>`;
  fit();
  // Ответ для прежней вещи (пришла новая, пока считали) — не рисуем, ни советы, ни ошибку.
  try {
    const r = await window.pc.craft();
    if (craftFor === mine && state === mine) renderCraft(r);
  } catch (e) {
    if (craftFor !== mine || state !== mine) return;
    box.innerHTML = `<div class="sect"><span>${t('Craft')}</span></div>${voidState('⚠', t('Mod pool not loaded'), esc(errText(e)))}`;
  }
  fit();
}

// Кандидаты крафта по ключу кнопки «price?»: сколько будет стоить вещь, если этот мод встанет (нижний ролл тира).
const craftCands = new Map();
function craftRows(list) {
  const rows = list.map((c) => {
    const key = String(craftCands.size);
    craftCands.set(key, c);
    const btn = c.stats ? `<button class="link cprice" data-ck="${key}" title="${t('Search for your item with this modifier added (lowest roll of the tier)')}">${t('price?')}</button>` : '';
    return `
    <div class="brow ${heat(c.pct)}" data-row="${key}"><span class="bname">${esc(c.text)}<span class="craft-tier">T${c.tier}/${c.tiers}${c.range ? ` · ${esc(c.range)}` : ''}</span>${chanceTag(c.chance, c.chanceUnknown)}${c.essence ? `<span class="ess" title="${esc(t('{essence} makes a magic item rare with this modifier: {tiers}', { essence: c.essence.name, tiers: c.essence.tiers.join(' · ') }))}">◈ ${esc(c.essence.short)}</span>` : ''}${btn}</span>
      <span class="bpct">${hot(c.pct)}${fmt(c.pct)}%</span><span class="bbar"><i data-w="${Math.min(100, c.pct)}%"></i></span></div>`;
  }).join('');
  // «Оценить все»: по короткому поиску на строку, потом список — по приросту цены, лучший помечен.
  const priceable = list.filter((c) => c.stats).length;
  return `<div class="clist">${priceable > 1 ? `<button class="link cprice-all" data-priceall title="${esc(t('One trade search per row, then the list is sorted by how much each modifier adds to the price'))}">⇅ ${esc(t('Price all and sort'))}</button>` : ''}${rows}</div>`;
}

async function priceAll(btn) {
  const list = btn.closest('.clist');
  btn.disabled = true;
  btn.textContent = t('pricing…');
  // Сменили вещь посреди оценки — дальше не ищем (кнопки уже от старой вещи, лимит трейда не тратим).
  const mine = state;
  for (const b of [...list.querySelectorAll('[data-ck]')]) {
    if (state !== mine || !list.isConnected) return;
    if (await priceCraft(b) === 'limit') {
      // Лимит трейда: сортировать нечего — возвращаем кнопку, можно повторить позже.
      btn.disabled = false;
      btn.textContent = `⇅ ${t('Price all and sort')}`;
      return;
    }
  }
  const rows = [...list.querySelectorAll('.brow')];
  const val = (r) => (r.dataset.delta == null || r.dataset.delta === '' ? -1e9 : Number(r.dataset.delta));
  rows.sort((a, b) => val(b) - val(a)).forEach((r) => list.appendChild(r));
  const best = rows.find((r) => val(r) > 0);
  if (best) best.classList.add('best');
  for (const r of rows) if (val(r) <= 0) r.classList.add('flat');
  btn.remove();
  fit();
}

// Цена после крафта: текущие фильтры + мод-кандидат. Тот же стат уже есть (сумма) — минимум растёт на ролл кандидата.
async function priceCraft(b) {
  const c = craftCands.get(b.dataset.ck);
  if (!c || !state) return;
  const mine = state;
  b.disabled = true;
  b.textContent = '…';
  const f = withMods(JSON.parse(JSON.stringify(state.filters)), [c]);
  try {
    // Магическая вещь после Regal Orb — уже редкая: ищем среди редких.
    const it = state.item.rarity === 'Magic' ? { ...state.item, rarity: 'Rare' } : state.item;
    const q = await quickPrice(it, f);
    if (state !== mine) return; // пока искали, проверили другую вещь — её оценку не трогаем
    const v = estimate(q.lots);
    let html;
    const row = b.closest('.brow');
    if (v == null) html = `<span class="cpr" title="${t('Nothing like it is listed — could be rare and pricey')}">${t('none listed')}</span>`;
    else {
      const d = state.est != null ? v - state.est : null;
      const cls = d == null ? '' : d > state.est * 0.1 ? ' up' : d < -state.est * 0.1 ? ' down' : '';
      // Прирост — главное: крупно «+2.1 div», рядом итоговая цена вещи с модом.
      const delta = d == null ? '' : Math.abs(d) < state.est * 0.1 ? t('same') : `${d > 0 ? '+' : '−'}${money(Math.abs(d))}`;
      html = `<span class="cpr${cls}" title="${t('{n} listed with it · vs your current estimate', { n: q.total })}">${delta ? `<b>${delta}</b> · ` : ''}≈ ${money(v)}</span>`;
      if (row && d != null) row.dataset.delta = Math.abs(d) < state.est * 0.1 ? 0 : d;
    }
    b.outerHTML = html;
  } catch (e) {
    if (state !== mine) return;
    b.disabled = false;
    b.textContent = t('price?');
    setStatus(errText(e), true);
    if (isLimit(e)) return 'limit';
  }
  fit();
}

// Цель крафта: что оставить / убрать / добавить и по шагам; кнопка — оценка готовой вещи.
let craftGoal = null;
function goalHtml(g) {
  const row = (cls, mark, x, extra = '') => `<div class="g ${cls}"><i>${mark}</i>${esc(x.text)}${x.tier ? ` <span class="craft-tier">T${x.tier}</span>` : ''}${extra}</div>`;
  return `<div class="craft-sec goal"><div class="k" title="${esc(t('The best item this base can become — most wanted modifiers for its slots'))}">${esc(t('Goal'))}</div>
    ${g.keep.map((x) => row('keep', '✓', x, x.up ? ` <span class="tierup" title="${esc(t('Key modifier with a weak tier — a higher tier is worth more'))}">↑ ${esc(t('tier'))}</span>` : '')).join('')}
    ${g.remove.map((x) => row('remove', '✗', x)).join('')}
    ${g.add.map((x) => row('add', '+', x, ` <span class="dem${x.pct >= 60 ? ' hot' : ''}">${x.pct >= 60 ? '🔥 ' : ''}${esc(t('{pct}% builds', { pct: fmt(x.pct) }))}</span>${chanceTag(x.chance, x.chanceUnknown)}${x.essence ? ` <span class="ess">◈ ${esc(x.essence.short)}</span>` : ''}`)).join('')}
</div>`;
}

// Фильтры «как у готовой вещи»: убранные моды — выключены, добавленные — с нижним роллом тира, их исключение «без мода» — снято.
const tplKey = (s) => String(s || '').replace(/ \(local\)$/i, '').replace(/\+#/g, '#').toLowerCase();
function withMods(f, adds) {
  for (const c of adds) {
    for (const s of c.stats || []) {
      for (const x of f.exclude || []) if (x.statId === s.statId) x.enabled = false;
      const same = f.mods.find((m) => m.statId === s.statId);
      if (same) { same.enabled = true; same.min = Math.max(Number(same.min) || 0, (same.value || 0) + s.min); }
      else f.mods.push({ statId: s.statId, enabled: true, min: s.min, importance: 3, tag: 'explicit', text: c.text });
    }
  }
  return f;
}


// Примерный шанс мода при Exalted с оменом его стороны: метка «частый / средний / редкий» и «≈ 1 из N».
function chanceTag(p, unknown) {
  if (unknown) return ` <span class="chance unknown" title="${esc(t('Valuable modifiers cannot be estimated from trade listings — items with them are priced and listed differently'))}">${esc(t('chance ?'))}</span>`;
  if (p == null) return '';
  const cls = p >= 0.12 ? 'common' : p >= 0.04 ? 'uncommon' : 'rare';
  const label = { common: t('common'), uncommon: t('uncommon'), rare: t('rare') }[cls];
  return ` <span class="chance ${cls}" title="${esc(t('Rough estimate: Exalted Orb + omen of its side gives this modifier about 1 in {n} times', { n: Math.max(1, Math.round(1 / p)) }))}">${esc(label)} · ≈1/${Math.max(1, Math.round(1 / p))}</span>`;
}

// ---- Крафт для новичка: места на вещи, «продать или крафтить», план с затратами ----
let craftPrices = {}; // div за штуку валюты из плана (poe.ninja)
let goalValue; // цена цели: undefined — считаем, null — не нашлось
let goalBasis = 'exact'; // по чему цена цели: exact — точно такие, similar — похожие, partial — нижняя граница

// Места на вещи кружками: занят (цвет по тиру), свободен; fractured — с рамкой.
function slotsHtml(r) {
  const affixes = state.item.affixes || [];
  const side = (s) => {
    const mods = affixes.filter((a) => a.side === s);
    const dots = mods.map((a) => {
      const cls = a.tier == null ? '' : a.tier <= 2 ? 'top' : a.tier >= 5 ? 'weak' : 'mid';
      return `<i class="slot ${cls}${a.tag === 'fractured' ? ' frac' : ''}" title="${esc(`${a.name || ''}${a.tier ? ` · T${a.tier}` : ''}`)}">${a.tier ? a.tier : ''}</i>`;
    });
    for (let i = mods.length; i < r.max[s]; i++) dots.push(`<i class="slot free" title="${esc(t('free'))}"></i>`);
    return `<span class="slots-side"><span>${esc(t(s === 'prefix' ? 'Prefixes' : 'Suffixes'))}</span>${dots.join('')}</span>`;
  };
  return `<div class="slots">${side('prefix')}${side('suffix')}</div>`;
}

// Модель стоимости плана — в src/shared/plancost.js (её же используют тесты и симуляция).
const planner = PlanCost.create(() => ({ prices: craftPrices, goalValue, est: state.est }));
const { stepCost, expandPlan, EXALT_NAME } = planner;

// Валюта в шагах — цветными метками (сферы, омены, кости, эссенции): рецепт читается с одного взгляда.
function curKind(n) {
  if (/^Omen of /.test(n)) return 'omen';
  if (/(Rib|Jawbone|Collarbone|Cranium|Vertebrae)$/.test(n)) return 'bone';
  if (/Essence/.test(n)) return 'essence';
  return 'orb';
}
const curChips = (list) => list.map((n) => `<span class="cur ${curKind(n)}">${esc(n)}</span>`).join('<span class="plus">+</span>');

const STEP_LABEL = {
  augment: (s) => t('Add a {side} while it is magic', { side: t(s.side) }),
  rune: (s) => t('Socket the rune: «{mod}» (permanent)', { mod: s.mod }) + (s.free ? '' : ` — ${t("needs a free augment socket (Artificer's Orb)")}`),
  regal: () => t('Make it rare'),
  essence: (s) => t('Make it rare with {mod}', { mod: s.mod }),
  remove: (s) => t('Remove {mod}', { mod: s.mod || s.mods.join(', ') }),
  add: (s) => t('Add {mod}', { mod: s.mod }) + (s.orMods && s.orMods.length ? ` (${t('or {mods}', { mods: s.orMods.slice(0, 3).join(', ') })})` : ''),
  add2: (s) => t('Add {a} and {b}', { a: s.steps[0].mod, b: s.steps[1].mod }),
};

const oneIn = (c) => t('1 in {n}', { n: Math.round(1 / c) });
const EXALT_WHY = {
  greater: 'low tiers cut off (level 35+; a family without such tiers rolls its best one)',
  perfect: 'low tiers cut off (level 50+; a family without such tiers rolls its best one)',
};

function planHtml(plan) {
  return `<ol class="plan">${expandPlan(plan).map((s) => {
    const c = stepCost(s);
    let odds;
    if (c.lottery) odds = t('chance unknown — valuable modifier') + (c.hopeless && c.perTry != null ? ` · ${t('one attempt ≈ {cost}', { cost: money(c.perTry) })}` : '');
    else if (c.hopeless) odds = `${t('{odds} at T1–T2', { odds: (c.chances || [c.chance]).map(oneIn).join(' / ') })} · ${t('one attempt ≈ {cost}', { cost: money(c.perTry) })}`;
    else if (c.k === 'essence') odds = c.chance >= 1 ? t('guaranteed') : oneIn(c.chance);
    else if (c.chances) odds = t('{odds} at T1–T2', { odds: c.chances.map(oneIn).join(' / ') });
    else if (s.mods) odds = t('≈ {n} attempts', { n: fmt(Math.round(c.tries * 10) / 10) });
    else odds = c.chance >= 1 ? t('guaranteed') : oneIn(c.chance);
    const notes = [];
    if (c.two) notes.push(t('one Exalted Orb adds both modifiers'));
    if (s.mods) notes.push(c.hits > 0.05
      ? t('on average ≈{n} needed modifiers get hit too — re-adding them is counted in the price', { n: fmt(Math.round(c.hits * 10) / 10) })
      : t('only unwanted modifiers can be hit'));
    if (c.hopeless) notes.push(t('One attempt: a miss stays on the item — removing it at random would more likely hit a needed modifier'));
    else if (s.act !== 'remove' && c.k !== 'desecrate' && c.k !== 'essence' && (s.onSide || s.onItem)) notes.push(t('the average includes misses: an Annulment may hit a needed modifier, which then has to be added again'));
    if (c.k === 'essence') notes.push(t('Exalt a cheap «sacrificial» modifier onto this side, then {crystal} + {essence}: it removes a modifier from this side and adds its own for sure — uses the only crafted-modifier slot', { crystal: s.crystal, essence: c.currencies[0] }));
    if (c.k === 'desecrate') {
      notes.push(t('Desecrate: reveal it at the Well of Souls and pick 1 of 3 offered modifiers — only one desecrated modifier per item'));
      if (/^Ancient /.test(c.bone)) notes.push(t('Ancient bone — low tiers cut off (level 40+)'));
      if (c.echo) notes.push(t('Omen of Abyssal Echoes — reroll the 3 options once'));
      if (c.bone === 'Altered Collarbone') notes.push(t('Altered Collarbone: desecrates jewellery with a chance for otherworldly (Breach) modifiers — how often they show up among the options is unknown'));
      if (c.lich) notes.push(t(c.lich.n <= 3 ? 'Lich omen: all options come from {lich}\'s pool — {n} on this side, so the modifier is guaranteed' : 'Lich omen: all options come from {lich}\'s pool — {n} on this side', { lich: c.lich.name[0].toUpperCase() + c.lich.name.slice(1), n: c.lich.n }));
      notes.push(t('At the reveal pick: {mods}', { mods: [s.mod, ...(s.orMods || [])].join(' › ') }));
      notes.push(t('A miss → Orb of Annulment + Omen of Light removes it ({cost})', { cost: money((craftPrices['Orb of Annulment'] || 0) + (craftPrices['Omen of Light'] || 0)) }));
    }
    if (EXALT_WHY[c.k]) notes.push(t(EXALT_WHY[c.k]));
    if (s.blocker && c.k !== 'essence' && c.k !== 'desecrate') {
      const better = c.chance && !c.lottery ? oneIn(Math.min(1, c.chance / (1 - s.blocker.share))) : null;
      notes.push(t('Blocker: first add a cheap «{mod}» (≈{pct}% of rolls here; e.g. pick it in a desecrate reveal) — its group can no longer roll{odds}; remove it afterwards', { mod: s.blocker.text, pct: Math.round(s.blocker.share * 100), odds: better ? ` (${better})` : '' }));
    }
    if (s.act !== 'remove' && c.k !== 'desecrate' && s.sideOmen && !c.currencies.includes(s.sideOmen)) notes.push(t('without a side omen half the rolls land on the other side'));
    const altText = (o) => o.k === 'essence'
      ? `${o.currencies.join(' + ')} · ${oneIn(o.chances[0])} · ${t('≈ {cost} on average', { cost: money(o.cost) })}`
      : o.k === 'desecrate'
      ? `${t('Desecrate')}${o.mod ? ` (${o.mod})` : ''}: ${o.currencies.join(' + ')}${o.chances[0] != null ? ` · ${oneIn(o.chances[0])}` : ''}${c.lottery ? '' : ` · ${t('≈ {cost} on average', { cost: money(o.cost) })}`}`
      : `${o.currencies[0]} · ${t('≈ {cost} on average', { cost: money(o.cost) })}`;
    const alts = [...(c.alts || []).filter((o) => o.k !== 'desecrate' && o.k !== 'essence'), ...(c.desAlt || []).slice(0, 2)].filter((o) => Number.isFinite(o.cost)).map(altText);
    if (c.other) alts.push(t('{how}: ≈{n} attempts, ≈{hits} needed modifiers hit, {cost} in currency', { how: c.other.currencies.join(' + '), n: fmt(Math.round(c.other.tries * 10) / 10), hits: fmt(Math.round(c.other.hits * 10) / 10), cost: money(c.other.spent) }));
    if (s.freeQuality) notes.push(t('{mod} has done its job: quality is already above 20% and stays after it is removed (community data) — the crafted slot frees up', { mod: s.freeQuality }));
    if (s.whittleWrong) notes.push(t('Chaos Orb + Omen of Whittling would not help: it removes the lowest-level modifier, and that is «{mod}» (level {level})', { mod: s.whittleWrong.mod, level: s.whittleWrong.level }));
    if (c.whittle) alts.push(t('{mod}: Chaos Orb + Omen of Whittling removes it for sure (lowest-level modifier), a random modifier takes its place — {list}', { mod: s.whittle,
      list: c.whittle.map((o) => `${o.orb}${o.level ? ` (${t('new one {n}+', { n: o.level })})` : ''} ≈ ${money(o.cost)}`).join('; ') }));
    for (const e of c.erasure || []) alts.push(t('{orb} + {omen}: removes a random {side} (1 in {n} hits an unwanted one) and adds a random modifier, ≈ {cost} per try', { orb: e.orb, omen: e.omen, side: t(e.side), n: Math.round(1 / e.chance * 10) / 10, cost: money(e.cost) }));
    if (c.regal && c.regal.length) notes.push(t('Greater / Perfect Regal Orb: the random modifier is level 35+ / 50+ — instead: {list}', { list: c.regal.map((o) => `${o.orb} ≈ ${money(o.cost)}`).join('; ') }));
    const desNote = (c.desAlt || []).some((o) => o.k === 'desecrate') ? t('Desecrate: pick 1 of 3 offered modifiers at the Well of Souls, but a miss costs Orb of Annulment + Omen of Light ({cost})', { cost: money((craftPrices['Orb of Annulment'] || 0) + (craftPrices['Omen of Light'] || 0)) }) : '';
    return `<li><div class="ps-what">${esc(STEP_LABEL[s.act](s))}</div>
      <div class="ps-how">${curChips(c.currencies)} · ${esc(odds)}${c.cost != null ? ` · <b>≈ ${money(c.cost)}</b>` : ''}</div>
      ${notes.length ? `<div class="ps-note">${esc(notes.join(' · '))}</div>` : ''}
      ${alts.length ? `<div class="ps-note">${esc(t('Instead: {list}', { list: alts.join('; ') }))}</div>` : ''}
      ${desNote ? `<div class="ps-note">${esc(desNote)}</div>` : ''}
      ${c.risky && c.chance < 1 && !s.mods ? `<div class="ps-risk">${esc(t('A miss removes a good modifier instead'))}</div>` : ''}</li>`;
  }).join('')}</ol>`;
}

// Вердикт: продать как есть или крафтить (цена цели − затраты на валюту).
function verdictHtml(plan) {
  const costs = expandPlan(plan).map(stepCost);
  const known = costs.filter((c) => c.cost != null).reduce((a, c) => a + c.cost, 0);
  const lottery = costs.some((c) => c.cost == null);
  const risky = costs.some((c) => c.risky && c.chance < 1);
  const now = state.est;
  const rows = [
    `<div><span>${esc(t('Sell as is'))}</span><b>${now != null ? money(now) : '—'}</b></div>`,
    `<div><span>${esc(t('Goal item'))}${goalValue != null && goalBasis !== 'exact' ? ` <small class="muted" title="${esc(t(goalBasis === 'similar' ? 'No exact matches — priced by similar items: the added modifiers required, the rest at their tier floor' : 'No similar items either — priced by items with only the most valuable added modifier: the real goal is worth more'))}">${esc(t(goalBasis === 'similar' ? '(similar)' : '(at least)'))}</small>` : ''}</span><b>${goalValue === undefined ? '…' : goalValue == null ? t('none listed') : (goalBasis === 'partial' ? '≥ ' : '≈ ') + money(goalValue)}</b></div>`,
    `<div><span>${esc(t('Currency, on average'))}</span><b>${lottery ? `${esc(t('from'))} ` : ''}${money(known)}</b></div>`,
  ];
  let verdict = '';
  // Снятие лишнего Annulment'ами в среднем заденет нужные моды — на такой вещи это почти всегда невыгодно.
  const hits = Math.max(0, ...costs.map((c) => c.hits || 0));
  const hitNote = hits >= 1 ? `<small>${esc(t('Removing the unwanted modifiers would hit ≈{n} needed ones on average — on an item like this it is rarely worth it', { n: fmt(Math.round(hits * 10) / 10) }))}</small>` : '';
  // Валюта дороже готовой цели — крафт не окупится при любой цене вещи (цена вещи может быть ещё не посчитана).
  if (goalValue != null && known >= goalValue) {
    verdict = `<div class="verdict bad">✖ ${esc(t(goalBasis === 'partial' ? 'Probably not worth it: the currency alone (≈ {cost}) costs more than the lower bound of the goal (≥ {goal})' : 'Not worth it: the currency alone (≈ {cost}) costs more than the finished goal (≈ {goal})', { cost: money(known), goal: money(goalValue) }))}${hitNote}</div>`;
  } else if (goalValue === null && now != null) {
    // Готовых аналогов на трейде нет — цена цели неизвестна. Затраты уже не меньше цены вещи — проще продать.
    verdict = known >= now * 0.5
      ? `<div class="verdict bad">✖ ${esc(t('Selling as is is better: the currency alone costs ≈ {cost}, the item sells for ≈ {now}', { cost: money(known), now: money(now) }))}<small>${esc(t('No finished items like the goal are listed — its price is unknown'))}</small>${hitNote}</div>`
      : `<div class="verdict">${esc(t('No finished items like the goal are listed — its price is unknown'))}${hitNote}</div>`;
  } else if (goalValue != null && now != null) {
    // Симуляция всего плана: распределение итога и шанс, что крафт выгоднее продажи сейчас (src/shared/plancost.js).
    const sim = planner.simulate(plan, { keep: craftGoal ? craftGoal.keep.length : 0 });
    const gain = goalValue - now - known;
    const good = sim ? sim.profit >= 0.5 : gain > Math.max(now * 0.15, known * 0.5);
    const simNote = sim ? `<small class="sim">${esc(t('Simulated {n} crafts: the item ends up ≈ {p50} (10–90%: {p10}–{p90}), currency ≈ {spent} on average; better than selling now in {profit}%, the full goal in {full}%',
      { n: sim.runs, p50: money(sim.value.p50), p10: money(sim.value.p10), p90: money(sim.value.p90), spent: money(sim.spent.mean), profit: Math.round(sim.profit * 100), full: Math.round(sim.full * 100) }))}</small>` : '';
    verdict = `<div class="verdict ${good && (!lottery || sim) ? 'good' : 'bad'}">${good
      ? `✅ ${esc(sim ? t('Craft: better than selling as is in {pct}% of simulated runs', { pct: Math.round(sim.profit * 100) }) : t('Craft: ≈ {gain} more than selling as is', { gain: money(gain) }))}`
      : `✖ ${esc(t('Selling as is is better'))}`}${simNote}${lottery ? `<small>${esc(t('A key modifier has unknown odds — this is a gamble'))}</small>` : ''}${hitNote || (risky ? `<small>${esc(t('Removing a modifier can hit a good one — the cost may grow'))}</small>` : '')}</div>`;
  } else if (now == null) {
    verdict = `<div class="verdict">${esc(t('Price this item on the Price tab first'))}</div>`;
  }
  return `<div class="profit">${rows.join('')}</div>${verdict}`;
}

// Цена цели — сразу при открытии вкладки (один поиск на трейде), затем перерисовываем вердикт.
async function computeGoal(g) {
  const mine = state;
  goalValue = undefined;
  const f = JSON.parse(JSON.stringify(state.filters));
  const gone = new Set(g.remove.flatMap((r) => r.templates));
  for (const m of f.mods) if (m.template && gone.has(tplKey(m.template))) m.enabled = false;
  withMods(f, g.add);
  goalBasis = 'exact';
  try {
    const it = state.item.rarity === 'Magic' ? { ...state.item, rarity: 'Rare' } : state.item;
    const q = await quickPrice(it, f);
    if (mine !== state) return;
    goalValue = estimate(q.lots);
    // Точно таких нет — похожие: добавленные моды обязательны, у оставшихся — нижняя граница тира, второстепенные выключены.
    if (goalValue == null) {
      const added = new Set(g.add.flatMap((a) => (a.stats || []).map((s) => s.statId)));
      const loose = JSON.parse(JSON.stringify(f));
      for (const m of loose.mods) {
        if (added.has(m.statId) || !m.enabled) continue;
        if (!m.key && (m.importance || 0) < 2.4) m.enabled = false;
        else if (m.range) m.min = Math.ceil(m.range.lo);
      }
      const q2 = await quickPrice(it, loose);
      if (mine !== state) return;
      goalValue = estimate(q2.lots);
      if (goalValue != null) goalBasis = 'similar';
      // И так нет — нижняя граница: вещь только с самым ценным добавленным модом (остальное как у похожих).
      if (goalValue == null && g.add.length > 1) {
        const top = [...g.add].sort((a, b) => b.pct - a.pct)[0];
        const keep = new Set((top.stats || []).map((s) => s.statId));
        const part = JSON.parse(JSON.stringify(loose));
        for (const m of part.mods) if (added.has(m.statId) && !keep.has(m.statId)) m.enabled = false;
        const q3 = await quickPrice(it, part);
        if (mine !== state) return;
        goalValue = estimate(q3.lots);
        if (goalValue != null) goalBasis = 'partial';
      }
    }
  } catch (e) {
    if (mine !== state) return;
    goalValue = null;
    setStatus(errText(e), true);
  }
  const box = document.querySelector('#craft .verdict-box');
  if (box) box.innerHTML = verdictHtml(g.plan);
  // Шаги тоже: цена задетого нужного мода зависит от цены цели.
  const ol = document.querySelector('#craft .plan-box ol.plan');
  if (ol) ol.outerHTML = planHtml(g.plan);
  fit();
}

// ---- пошаговое ведение крафта: запомнили вещь и цель; каждое новое копирование той же вещи — что получилось и что дальше ----
let craftSession = null; // { base, ilvl, name, rarity, goal: { add, remove }, start, before, current, seen }
// Моды вещи шаблонами (как в цели крафта: нижний регистр, # вместо чисел, без «+»).
const modKeys = () => new Set(((state.filters && state.filters.mods) || []).filter((m) => m.template && m.tag !== 'pseudo').map((m) => tplKey(m.template)));
// Та же вещь: база и item level, имя редкой не меняется (магическая → редкая — меняется).
function sessionMatches() {
  const s = craftSession, it = state && state.item;
  return !!(s && it && it.baseType === s.base && it.ilvl === s.ilvl && (it.name === s.name || s.rarity !== 'Rare' || it.rarity !== s.rarity));
}
function startSession() {
  const g = craftGoal;
  if (!g) return;
  const keys = modKeys();
  craftSession = { base: state.item.baseType, ilvl: state.item.ilvl, name: state.item.name, rarity: state.item.rarity,
    goal: { add: g.add.map((a) => ({ text: a.text, or: a.orMods || [] })), remove: g.remove.map((r) => ({ text: r.text })) },
    start: keys, before: keys, current: keys, seen: state };
}
function sessionHtml(r) {
  const s = craftSession;
  const keys = modKeys();
  if (s.seen !== state) { s.before = s.current; s.current = keys; s.seen = state; } // новая копия вещи — сравниваем с прошлой
  const has = (text) => text.split(' / ').every((l) => keys.has(l));
  const goalLines = new Set(s.goal.add.flatMap((a) => a.text.split(' / ')));
  const added = [...keys].filter((k) => !s.before.has(k));
  const lost = [...s.before].filter((k) => !keys.has(k));
  const wanted = new Set([...goalLines, ...[...s.start].filter((k) => !s.goal.remove.some((r) => r.text.split(' / ').includes(k)))]);
  const news = [
    ...added.map((k) => (goalLines.has(k) ? `<div class="ss good">✓ ${esc(t('Got {mod}', { mod: k }))}</div>` : `<div class="ss bad">✗ ${esc(t('Got {mod} — not in the goal', { mod: k }))}</div>`)),
    ...lost.map((k) => (wanted.has(k) ? `<div class="ss bad">✗ ${esc(t('Lost {mod}', { mod: k }))}</div>` : `<div class="ss good">✓ ${esc(t('Removed {mod}', { mod: k }))}</div>`)),
  ];
  const rows = [
    ...s.goal.add.map((a) => `<div class="ss ${has(a.text) ? 'done' : ''}">${has(a.text) ? '✓' : '○'} ${esc(a.text)}</div>`),
    ...s.goal.remove.map((x) => `<div class="ss ${has(x.text) ? '' : 'done'}">${has(x.text) ? '○' : '✓'} ${esc(t('remove {mod}', { mod: x.text }))}</div>`),
  ];
  const done = s.goal.add.every((a) => has(a.text)) && s.goal.remove.every((x) => !has(x.text));
  const next = r.goal && r.goal.plan && r.goal.plan.length ? expandPlan(r.goal.plan)[0] : null;
  return `<div class="craft-sec session"><div class="k">${esc(t('Crafting step by step'))} <button class="link" data-act="session-stop">■ ${esc(t('Stop'))}</button></div>
    <div class="ss-how">📌 ${esc(t('The window stays open while you craft. Do a step in the game, hover the item and press'))} <kbd>${esc(state.hotkey || 'Ctrl+E')}</kbd></div>
    ${news.length ? `<div class="ss-news">${esc(t('Since the last check:'))}${news.join('')}</div>` : ''}
    <div class="ss-list">${rows.join('')}</div>
    ${done ? `<div class="verdict good">🎉 ${esc(t('Goal reached — check the price on the Price tab'))}</div>` : next ? `<div class="ss-next">${esc(t('Next: {step}', { step: STEP_LABEL[next.act](next) }))}</div>` : ''}</div>`;
}

// Шансы — оценка по лотам трейда; собраны в другой лиге — пишем в какой (после патча веса могли измениться).
function chanceWarn(m) {
  const date = m.league && state && m.league !== state.league ? `${m.collected}, ${m.league}` : m.collected;
  return `<div class="craft-warn">⚠ ${esc(t('Chances are rough estimates from {n} cheap trade listings ({date}) — PoE 2 game files have no modifier weights. Treat them as "common / rare", not exact odds.', { n: m.items, date }))}</div>`;
}

// ---- белая база: Transmutation (обычная / Greater 44+ / Perfect 70+) → магическая с одним модом ----
// Промах — нужна новая база (или Orb of Annulment, если база дороже). Рекомендуем вариант с меньшей ожидаемой
// стоимостью до популярного мода в одном из двух лучших тиров.
const BASE_PRICEY = 0.5; // div: база дороже — сама по себе товар, промах ощутим
function renderNormalCraft(r, head) {
  craftGoal = null;
  craftPrices = r.prices || {};
  const p = (n) => craftPrices[n];
  const base = state.est;
  const retry = base != null ? Math.min(base, p('Orb of Annulment') ?? base) : 0;
  const opts = r.normal.map((o) => {
    const orb = p(o.name);
    const cost = orb == null || !o.top ? null : (orb + (1 - o.top) * retry) / o.top;
    return { ...o, orb, cost };
  });
  const known = opts.filter((o) => o.cost != null);
  const best = known.length ? known.reduce((a, b) => (b.cost < a.cost ? b : a)) : opts[opts.length - 1];
  const pct = (x) => `${x >= 0.1 ? Math.round(x * 100) : Math.round(x * 1000) / 10}%`;
  const rows = opts.map((o) => `<div class="profit-row${o === best ? ' best' : ''}"><div><span class="game">${esc(o.name)}</span>${o.orb != null ? ` <small>≈ ${money(o.orb)}</small>` : ''}${o === best ? ` <b class="rec">${esc(t('recommended'))}</b>` : ''}</div>
    <div class="ps-how">${esc(t('{n} possible modifiers · popular: {any} · popular in T1–T2: {top}', { n: o.pool, any: pct(o.any), top: pct(o.top) }))}${o.cost != null ? ` · <b>${esc(t('≈ {cost} on average', { cost: money(o.cost) }))}</b>` : ''}</div>
    ${o.minLevel ? `<div class="ps-note">${esc(t('low tiers cut off (level {n}+; a family without such tiers rolls its best one)', { n: o.minLevel }))}</div>` : ''}</div>`).join('');
  const warn = base != null && base >= BASE_PRICEY
    ? `<div class="craft-warn">⚠ ${esc(t('The base itself sells for ≈ {price} — a miss costs a base like this. Selling it as is may be the better deal.', { price: money(base) }))}</div>` : '';
  const steps = [
    t('{orb} — makes it magic with one random modifier', { orb: best.name }),
    t('A popular modifier → Orb of Augmentation (Greater / Perfect — same idea) for the other side, then an Essence or Regal Orb → rare; open Craft again for the next steps'),
    base != null && base < (p('Orb of Annulment') ?? Infinity)
      ? t('A miss → take another base: it is cheaper than fixing this one')
      : t('A miss → Orb of Annulment removes the modifier, then Orb of Augmentation'),
    t('Alternative: Orb of Alchemy — straight to rare with 4 random modifiers (Omen of Sinistral / Dextral Alchemy — as many prefixes / suffixes as possible)'),
  ];
  const popular = (r.popular || []).map((c, i) => ({ name: `${c.text}${c.tier ? ` · T${c.tier}` : ''}`, pct: c.pct, rank: i + 1 }));
  $('craft').innerHTML = head + `<div class="craft-sec plan-box"><div class="k">${esc(t('White base → magic'))}</div>
    ${warn}${rows}
    <ol class="plan">${steps.map((s) => `<li><div class="ps-how">${esc(s)}</div></li>`).join('')}</ol></div>
    ${popular.length ? demandList('npop', t('Popular modifiers that can roll here'), popular) : ''}
    ${r.chanceMeta ? chanceWarn(r.chanceMeta) : ''}`;
}

// ---- уник: Divine перекатывает значения всех модов разом (сами моды не меняются) ----
const TOP_Q = 0.75; // «хорошие роллы» — верхняя четверть диапазона
let uniqueTop; // цена с хорошими роллами: undefined — считаем, null — не нашли
const rollOf = (m) => (m.ordinal ? (m.ordinal.idx - m.ordinal.lo) / (m.ordinal.hi - m.ordinal.lo) : m.roll);
const uniqueRolls = () => (state.filters.mods || []).filter((m) => (m.tag === 'explicit' || m.tag === 'desecrated')
  && (m.ordinal || (m.categorical && m.categorical.n > 1) || (m.range && m.range.hi > m.range.lo && m.roll != null)));
// Шанс после Divine попасть в верхнюю четверть: у порядкового варианта — доля вариантов сверху, у числа — 1/4.
const topShare = (m) => {
  if (m.categorical) return 1 / m.categorical.n; // сохранить тот же вариант
  if (!m.ordinal) return 1 - TOP_Q;
  const { lo, hi } = m.ordinal;
  const from = Math.ceil(lo + TOP_Q * (hi - lo));
  return (hi - from + 1) / (hi - lo + 1);
};

// Моды, ради которых уник берут: по poe.ninja их носят ≥ 10% билдов с этим уником (нет данных — все).
// Роллы остальных на цену почти не влияют — «хорошие роллы» требуем только у ключевых.
function keyRolls(rolls) {
  const pct = new Map(((lastBuilds && lastBuilds.mods) || []).map((r) => [modKey(r.name), r.pct]));
  const of = (m) => Math.max(pct.get(modKey(m.template)) || 0, ...String(m.text).split('\n').map((l) => pct.get(modKey(l)) || 0));
  const key = rolls.filter((m) => m.categorical || of(m) >= 10);
  return pct.size && key.length ? key : rolls;
}

// Шанс, что после Divine сумма роллов станет больше нынешней (значения независимы и равномерны в диапазоне).
function betterOdds(qs) {
  const N = 20000;
  const now = qs.reduce((a, q) => a + q, 0);
  let win = 0;
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let k = 0; k < qs.length; k++) s += Math.random();
    if (s > now) win++;
  }
  return win / N;
}

function renderUniqueCraft(r, head) {
  craftGoal = null;
  uniqueTop = undefined;
  craftPrices = r.prices || {};
  const rolls = uniqueRolls();
  const top = [];
  if (!rolls.length) {
    const noRanges = state.item.mods && state.item.mods.some((m) => (m.tag === 'explicit' || m.tag === 'desecrated') && m.statId && !m.range && /\d/.test(m.text));
    top.push(`<div class="craft-sec"><div class="craft-how">${esc(noRanges
      ? t('No roll ranges in the copied text — turn on "Advanced Mod Descriptions" (or copy with Ctrl+Alt+C) to see how good the rolls are')
      : t('This unique has no variable values — Divine Orb changes nothing'))}</div></div>`);
  } else {
    const qs = rolls.filter((m) => !m.categorical).map(rollOf);
    const key = keyRolls(rolls);
    const cats = rolls.filter((m) => m.categorical);
    const low = key.filter((m) => m.categorical || rollOf(m) < TOP_Q).length;
    // Divine перекатывает ВСЕ значения: «удача» — все ключевые роллы разом в верхней четверти, а не только низкие.
    const tries = Math.round(1 / key.reduce((a, m) => a * topShare(m), 1));
    const rangeText = (m) => (m.ordinal ? `${m.ordinal.loText}–${m.ordinal.hiText}` : `${fmt(m.range.lo)}–${fmt(m.range.hi)}`);
    const rows = rolls.filter((m) => !m.categorical).map((m) => `<div class="brow${key.includes(m) ? '' : ' cold'}"${key.includes(m) ? '' : ` title="${esc(t('Few builds use it — its roll barely affects the price'))}"`}><span class="bname">${esc(m.text.split('\n')[0])} <span class="craft-tier">${esc(rangeText(m))}</span></span><span class="bpct">${Math.round(rollOf(m) * 100)}%</span>
      <span class="bbar"><i data-w="${Math.round(rollOf(m) * 100)}%"></i></span></div>`).join('');
    top.push(`<div class="craft-sec plan-box"><div class="k">Divine Orb</div>
      <div class="craft-how">${esc(t('Rerolls the values of all modifiers at once — the modifiers themselves stay'))}</div>
      <div class="dcol"><div class="k">${esc(t('How good the rolls are'))}</div>${rows}</div>
      ${cats.length ? `<div class="craft-warn">⚠ ${esc(t('Divine also rerolls {mods} — each becomes a random one of its variants (1 in {n} to keep it)', { mods: cats.map((m) => m.text.split('\n')[0]).join(', '), n: cats.map((m) => m.categorical.n).join(' / ') }))}</div>` : ''}
      ${qs.length ? `<div class="craft-how">${esc(t('Chance the rolls get better overall: {pct}%', { pct: Math.round(betterOdds(qs) * 100) }))}</div>` : ''}
      <div class="craft-how">${esc(low
        ? t(key.length < rolls.length ? 'Key modifiers in the top quarter: about 1 in {n}' : 'All modifiers in the top quarter: about 1 in {n}', { n: tries })
        : t('All rolls are already in the top quarter — a Divine is more likely to make it worse'))}</div>
      ${low ? `<div class="verdict-box">${uniqueVerdictHtml(tries)}</div>` : ''}</div>`);
  }
  if (r.gamble) top.push(gambleHtml(r.gamble));
  $('craft').innerHTML = head + top.join('');
  if (rolls.length && keyRolls(rolls).some((m) => !m.categorical && rollOf(m) < TOP_Q)) computeUniqueTop(keyRolls(rolls));
}

function uniqueVerdictHtml(tries) {
  const now = state.est;
  const div = craftPrices['Divine Orb'];
  const cost = div != null ? tries * div : null;
  const rows = [
    `<div><span>${esc(t('Sell as is'))}</span><b>${now != null ? money(now) : '—'}</b></div>`,
    `<div><span>${esc(t('With top-quarter key rolls'))}</span><b>${uniqueTop === undefined ? '…' : uniqueTop == null ? t('none listed') : money(uniqueTop)}</b></div>`,
    `<div><span>${esc(t('Divine Orbs, on average'))}</span><b>${cost != null ? `${tries} · ${money(cost)}` : tries}</b></div>`,
  ];
  let verdict = '';
  if (uniqueTop != null && now != null && cost != null) {
    const gain = uniqueTop - now - cost;
    const good = gain > Math.max(now * 0.15, cost * 0.5);
    verdict = `<div class="verdict ${good ? 'good' : 'bad'}">${good
      ? `✅ ${esc(t('Divine: ≈ {gain} more than selling as is', { gain: money(gain) }))}`
      : `✖ ${esc(t('Selling as is is better'))}`}<small>${esc(t('Each Divine can also make the rolls worse — this is the average over many tries'))}</small></div>`;
  } else if (now == null) {
    verdict = `<div class="verdict">${esc(t('Price this item on the Price tab first'))}</div>`;
  }
  return `<div class="profit">${rows.join('')}</div>${verdict}`;
}

// Цена такого же уника с роллами в верхней четверти (не ниже наших) — один поиск на трейде.
async function computeUniqueTop(rolls) {
  const mine = state;
  uniqueTop = undefined;
  const f = JSON.parse(JSON.stringify(state.filters));
  state.filters.mods.forEach((m, i) => {
    if (!rolls.includes(m) || m.ordinal || m.categorical) return;
    const x = f.mods[i];
    const want = m.range.lo + TOP_Q * (m.range.hi - m.range.lo);
    const v = Number.isInteger(m.range.lo) && Number.isInteger(m.range.hi) ? Math.ceil(want) : Math.round(want * 100) / 100;
    x.enabled = true;
    x.min = Math.max(Number(x.min) || m.range.lo, v);
  });
  try {
    const q = await quickPrice(state.item, f);
    if (mine !== state) return;
    uniqueTop = estimate(q.lots);
  } catch (e) {
    if (mine !== state) return;
    uniqueTop = null;
    setStatus(errText(e), true);
  }
  const box = document.querySelector('#craft .verdict-box');
  if (box) { box.innerHTML = uniqueVerdictHtml(Math.round(1 / rolls.reduce((a, m) => a * topShare(m), 1))); fit(); }
}

// «Рискованный финал»: порча и освящение — необратимо, шансы — оценки сообщества.
function gambleHtml(g) {
  const p = (n) => (craftPrices[n] != null && (n !== 'Omen of Sanctification' || state.item.rarity === 'Rare') ? ` · ${n} ≈ ${money(craftPrices[n])}` : '');
  const list = (xs) => xs.map((h) => `<div class="craft-how">${esc(h)}</div>`).join('');
  return `<div class="craft-sec gamble"><div class="k">⚠ ${esc(t('Risky final step: corruption and sanctification'))}</div>${list(g.how)}
    <div class="craft-sub">${esc(t('Prices'))}${esc(p('Vaal Orb') + p('Omen of Sanctification') + p('Omen of Putrefaction'))}</div>
    ${g.enchants.length ? `<details class="why"><summary>${esc(t('Possible corruption enchants ({n})', { n: g.enchants.length }))}</summary>${list(g.enchants)}</details>` : ''}</div>`;
}

function renderCraft(r) {
  craftGoal = r.goal || null;
  craftPrices = r.prices || {};
  craftCands.clear();
  const head = `<div class="sect"><span>${t('Craft')}</span></div>`;
  if (r.blocked) {
    $('craft').innerHTML = head + voidState('⛓', t("{state} — can't be modified", { state: r.blocked }),
      t('Its modifiers are locked. The Price tab shows what it is worth as is.'), [['price', t('See price')]]);
    return;
  }
  if (r.note) { $('craft').innerHTML = head + voidState('◇', t('No craft tips'), esc(r.note)); return; }
  if (r.unique) { renderUniqueCraft(r, head); return; }
  if (r.normal) { renderNormalCraft(r, head); return; }
  const how = (list) => list.map((h) => `<div class="craft-how">${esc(h)}</div>`).join('');
  // Сверху — коротко для новичка: места на вещи, «продать или крафтить», план по шагам с затратами.
  // Всё остальное (все способы, варианты модов) — свёрнуто ниже.
  const top = [slotsHtml(r)];
  const inSession = craftSession && sessionMatches();
  if (inSession) top.unshift(sessionHtml(r));
  if (r.goal && r.goal.plan && r.goal.plan.length) {
    top.push(`<div class="craft-sec plan-box"><div class="k">${t('Plan')}${inSession ? '' : ` <button class="link session-btn" data-act="session" title="${esc(t('Do a step, check the item again with the hotkey — the window stays open and shows what you got and the next step'))}">▶ ${esc(t('Craft step by step'))}</button>`}</div><div class="verdict-box">${verdictHtml(r.goal.plan)}</div>
      ${planHtml(r.goal.plan)}<details class="why"><summary>${t('Why this plan')}</summary>${goalHtml(r.goal)}</details></div>`);
  } else {
    top.push(`<div class="craft-sec plan-box"><div class="verdict">${esc(t('No clear upgrade for this item — selling as is is the simple choice'))}</div></div>`);
    if (r.gamble) top.push(gambleHtml(r.gamble)); // улучшать нечего — рискованный финал на виду
  }
  const parts = [];
  for (const s of r.sections) {
    if (s.kind === 'open') {
      parts.push(`<div class="craft-sec"><div class="k">${t(`{n} free ${s.side}es`, { n: s.count })}</div>${how(s.how)}
        ${s.candidates.length ? `<div class="craft-sub">${t(`Popular ${s.side}es that can roll here (best tier for this item level):`)}</div>${craftRows(s.candidates)}`
          : `<div class="craft-sub">${t('No popular modifiers left for this side.')}</div>`}</div>`);
    } else if (s.kind === 'replace') {
      const w = s.weak;
      parts.push(`<div class="craft-sec"><div class="k">${t(`Full — replace the weakest ${w.side}`)}</div>
        <div class="craft-weak">${esc(w.text)} <span class="craft-tier">${w.tier ? `T${w.tier}` : ''}${w.pct ? ` · ${t('{pct}% builds', { pct: fmt(w.pct) })}` : ''}</span></div>${how(s.how)}
        ${s.candidates.length ? `<div class="craft-sub">${t('Could become:')}</div>${craftRows(s.candidates)}` : ''}</div>`);
    } else if (s.kind === 'desecrate') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Desecration')}</div>${how(s.how)}<div class="craft-sub">${t('Popular desecrated modifiers for this base:')}</div>${craftRows(s.candidates)}</div>`);
    } else if (s.kind === 'upgrade') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Make it rare first')}</div>${how(s.how)}</div>`);
    } else if (s.kind === 'perfect') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Guaranteed modifier: Perfect / corrupted Essences, Alloys')}</div><div class="craft-sub">${t('Removes a random modifier and adds its own guaranteed one:')}</div>${how(s.how)}</div>`);
    } else if (s.kind === 'tierup') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Key modifier, weak tier — keep it')}</div>${s.mods.map((m) => `
        <div class="craft-weak">${esc(m.text)} <span class="craft-tier">T${m.tier} → T${m.best}${m.range ? ` (${esc(m.range)})` : ''} · ${esc(t('{pct}% builds', { pct: fmt(m.pct) }))}</span></div>${how(m.how)}`).join('')}</div>`);
    } else if (s.kind === 'emotions') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Liquid Emotions (Delirium) — the main jewel craft')}</div>${how(s.how)}</div>`);
    } else if (s.kind === 'magicfill') {
      parts.push(`<div class="craft-sec"><div class="k">${t('While it is magic')}</div>${how(s.how)}${s.candidates.length ? `<div class="craft-sub">${t('Popular modifiers for the free slot:')}</div>${craftRows(s.candidates)}` : ''}</div>`);
    } else if (s.kind === 'risky') {
      const pr = (s.prices || []).filter((n) => craftPrices[n] != null).map((n) => `${n} ≈ ${money(craftPrices[n])}`).join(' · ');
      parts.push(`<div class="craft-sec"><div class="k">${t('Risky')}</div>${how(s.how)}${pr ? `<div class="craft-sub">${esc(t('Prices'))} · ${esc(pr)}</div>` : ''}</div>`);
    } else if (s.kind === 'keep') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Full — all modifiers are top tier')}</div><div class="craft-sub">${t('Nothing worth replacing.')}</div></div>`);
    } else if (s.kind === 'cheap') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Cheap and safe')}</div>${how(s.how)}</div>`);
    }
  }
  if (r.augments && r.augments.length) {
    const sock = r.freeSockets ? t('{n} free augment socket(s)', { n: r.freeSockets }) : t("no free augment socket — Artificer's Orb adds one");
    parts.push(`<div class="craft-sec"><div class="k">${esc(t('Runes and soul cores for the sockets'))} <small class="muted">· ${esc(sock)}</small></div>
      ${r.augments.map((a) => `<div class="craft-how"><span class="game">${esc(a.name)}</span>${craftPrices[a.name] != null ? ` ≈ ${money(craftPrices[a.name])}` : ''} — ${esc(a.lines.join(', '))} <span class="dem">${esc(t('{pct}% builds', { pct: fmt(a.pct) }))}</span>${a.ancient ? ` <small class="muted">(${esc(t('Ancient Augment: one per item'))})</small>` : ''}</div>`).join('')}</div>`);
  }
  if (r.theme && r.theme.length) {
    top.splice(1, 0, `<div class="craft-theme" title="${t('Demand % below is among {n} builds that wear this item class with these modifiers', { n: r.themeBuilds })}">${t('Demand among builds using')} <b>${r.theme.map(esc).join('</b> + <b>')}</b></div>`);
  }
  if (r.chanceMeta) parts.push(chanceWarn(r.chanceMeta));
  if (r.gamble && r.goal && r.goal.plan && r.goal.plan.length) parts.push(gambleHtml(r.gamble)); // в конце, после всех безопасных способов
  parts.push(`<div class="craft-foot">${t(r.chanceMeta ? 'Mod pool: game files (RePoE).' : "Mod pool: game files (RePoE). Roll chances aren't shown — PoE 2 files have no modifier weights.")}<br>${t('% = share of those builds using the modifier (poe.ninja). «price?» — what your item would cost with it.')}</div>`);
  $('craft').innerHTML = head + top.join('')
    + `<details class="more-ways"><summary>${t('All methods and modifier options')}</summary>${parts.join('')}</details>`;
  if (r.goal && r.goal.plan && r.goal.plan.length) computeGoal(r.goal);
}

// Насколько востребовано: < 10% — приглушаем (почти никому не нужно), ≥ 60% — подсвечиваем (нужно почти всем).
const heat = (pct) => (pct >= 60 ? 'hot' : pct < 10 ? 'cold' : '');
const hot = (pct) => (pct >= 60 ? `<span class="flame" title="${t('Most builds use this')}">🔥</span>` : '');

function buildRows(rows) {
  return rows.map((r) => `
    <div class="brow ${heat(r.pct)}"><span class="bname">${esc(r.name)}</span><span class="bpct">${hot(r.pct)}${fmt(r.pct)}%</span>
      <span class="bbar"><i data-w="${Math.min(100, r.pct)}%"></i></span></div>`).join('');
}

// Чей спрос считаем: персонажи 80+ (все, кого видит poe.ninja), 90+ или 95+ — чем выше, тем «премиальнее» моды.
let demandLevel = 90;
window.pc.demandLevel().then((l) => { demandLevel = l; }).catch(() => {});
const levelSeg = () => `<div class="lvl-row"><span class="muted small">${t('Characters')}</span><div class="seg lvl" title="${t('Whose gear counts: higher level = players who pay for exact modifiers')}">${[80, 90, 95].map((l) =>
  `<button data-lvl="${l}"${l === demandLevel ? ' class="on"' : ''}>${l}+</button>`).join('')}</div></div>`;

function renderBuilds(b) {
  // Бейдж на вкладке Demand — чтобы фичу замечали, не открывая вкладку.
  const pct = b.allTotal ? b.total / b.allTotal * 100 : null;
  const anyHot = [...b.classes, ...b.skills].some((r) => r.pct >= 60);
  // Уровень спроса по числу персонажей (не по %: у нишевых вещей процент всегда мал, а спрос реальный).
  const lvl = !b.total ? null : b.total >= 2500 ? 'high' : b.total >= 300 ? 'med' : 'low';
  const badge = $('demandBadge');
  badge.className = `badge ${lvl || ''}`;
  badge.textContent = lvl ? { high: `🔥 ${t('High')}`, med: t('Med'), low: t('Low') }[lvl] : '';
  badge.title = lvl ? `${t('{n} level {lvl}+ characters on poe.ninja use this', { n: b.total, lvl: demandLevel })}${pct != null ? ` (${t('{pct}% of builds', { pct: fmt(pct) })})` : ''}${anyHot ? ` · ${t('one build archetype dominates')}` : ''}` : '';
  const chars = t('{n} characters', { n: b.total });
  const share = b.allTotal ? `${t('<b>{pct}%</b> of builds', { pct: fmt(b.total / b.allTotal * 100) })} · ${chars}` : chars;
  const what = b.filters.filter(([k]) => k !== 'min-level').map(([, v]) => v).join(' + ');
  $('builds').innerHTML = `
    <div class="sect"><span>${t('Popular builds')}</span></div>
    ${levelSeg()}
    <div class="bshare">${share}</div>
    <div class="bwhat muted" title="${t('poe.ninja filter')}">${esc(what)}</div>
    ${b.total ? `<div class="bcols">
      <div><div class="k">${t('Ascendancy')}</div>${buildRows(b.classes.slice(0, 4))}</div>
      <div><div class="k">${t('Main skill')}</div>${buildRows(b.skills.slice(0, 4))}</div>
    </div>` : voidState('◇', t('No builds use this'), t('No characters on poe.ninja wear this combination.'))}
    ${uniqueModsHtml(b)}
    ${b.ignored && b.ignored.length ? `<div class="muted small">${t('Not on poe.ninja:')} ${esc(b.ignored.map((x) => Object.values(x)[0]).join(' · '))}</div>` : ''}
    <button class="link bopen" data-url="${esc(b.page)}">poe.ninja ↗</button>`;
}

// Уник со случайными модами (Heart of the Well, Megalomaniac…): какие из его модов носят билды.
// Постоянные моды есть на каждой копии (~100%) — их не показываем; свои — всегда, с местом в рейтинге.
const modKey = (s) => String(s || '').replace(/ \(Local\)$/, '').replace(/[+-]?\d+(\.\d+)?/g, '#').replace(/\+#/g, '#').toLowerCase();
function uniqueModsHtml(b) {
  if (!b.mods || !b.mods.length || !state.filters) return '';
  const mine = new Set();
  for (const m of state.filters.mods) {
    if (m.template) mine.add(modKey(m.template));
    for (const l of String(m.text || '').split('\n')) mine.add(modKey(l));
  }
  const all = b.mods.filter((r) => r.pct < 95).map((r, i) => ({ ...r, rank: i + 1, mine: mine.has(modKey(r.name)) }));
  const rows = all.filter((r) => r.rank <= 10 || r.mine);
  if (!rows.length) return '';
  return demandList('umods', t('Which of its modifiers builds use'), rows);
}

// ---- фильтры ----

// Шкала важности мода для цены: 0–3 деления (ключевой для слота × качество тира). Ключевые — золотом.
const IMPACT = ['minor', 'low', 'medium', 'high'];
function meter(m) {
  if (m.importance == null) return '';
  const n = m.importance >= 2.4 ? 3 : m.importance >= 1.6 ? 2 : m.importance >= 0.8 ? 1 : 0;
  const title = `${t('Price impact:')} ${t(IMPACT[n])}${m.key ? ` — ${t('key modifier for this slot')}` : ''}${m.tier ? `, ${t('tier {n}', { n: m.tier })}` : ''}`;
  return `<span class="imp i${n}${m.key ? ' key' : ''}" title="${title}"><i></i><i></i><i></i></span>`;
}

// Строка мода — ровными колонками, как подсказка в игре: [галочка][важность][тир][текст · категория][мин].
// Категория (desecrated, rune…) — после текста, чтобы теги разной ширины не сдвигали сам мод.
// Диапазон тира и качество ролла: «36–40», у почти максимального — золотая пометка max.
function rollInfo(m) {
  if (!m.range || m.roll == null) return '';
  // Пометка max — только у максимального ролла лучшего тира (T1): на других тирах она мало что значит.
  const max = m.tier === 1 && m.roll >= 0.9 ? `<span class="maxroll" title="${t('Near max roll of the top tier — usually worth more')}">${t('max')}</span>` : '';
  return ` <span class="rng" title="${t('Tier range · roll {n}%', { n: Math.round(m.roll * 100) })}">${fmt(m.range.lo)}${m.range.lo < 0 ? t(' to ') : '–'}${fmt(m.range.hi)}</span>${max}`;
}

// Какие суммы раскрыты (сбрасывается на новом предмете).
const openSums = new Set();

function modRow(m, i) {
  if (!m.statId) {
    return `<div class="mod nomatch" title="${t('This modifier has no trade site filter')}">
      <label><span class="cb"></span><span class="imp"></span><span class="tcol">?</span><span class="txt">${esc(m.text)}</span></label></div>`;
  }
  const tier = m.tag === 'pseudo' ? `<span class="tcol sigma" title="${t('Total from all modifiers')}">Σ</span>`
    : `<span class="tcol">${m.tier ? `<span class="tag tier${m.tier <= 2 ? ' top' : ''}">T${m.tier}</span>` : ''}</span>`;
  // Одинаковые моды — каждый своей строкой, фильтр общий: трейд ищет по сумме.
  const from = m.parts ? ` title="${esc(m.parts.map((p) => `${p.text}${p.tier ? ` (T${p.tier})` : ''}`).join('\n'))}"` : '';
  const cat = (m.tag !== 'explicit' && m.tag !== 'pseudo' ? ` <span class="tag ${esc(m.tag)}">${esc(t(m.tag))}</span>` : '')
    // Спрос с poe.ninja: массовый мод — повод включить его, даже если тир слабый.
    + (m.demand >= 30 ? ` <span class="dem${m.demand >= 60 ? ' hot' : ''}" title="${t('{pct}% of level {lvl}+ builds wearing this item class have this modifier (poe.ninja)', { pct: fmt(m.demand), lvl: demandLevel })}">${m.demand >= 60 ? '🔥 ' : ''}${t('{pct}% builds', { pct: fmt(m.demand) })}</span>` : '');
  const text = m.tag === 'pseudo' ? m.text.replace(/^Σ /, '') : m.text;
  return `<div class="mod t-${esc(m.tag)}${m.enabled ? '' : ' off'}" data-i="${i}">
      <label><input type="checkbox" data-k="enabled"${m.enabled ? ' checked' : ''}>${meter(m) || '<span class="imp"></span>'}${tier}
        <span class="txt"${from}>${esc(text)}${m.merged ? `<span class="sum-v"> = ${fmt(m.value)}</span>` : ''}${cat}${rollInfo(m)}${driveChip(i)}</span></label>
      ${m.option ? '' : `<span class="range-in"><input type="number" data-k="min" step="any" placeholder="${t('min')}" value="${m.min == null ? '' : m.min}"><input type="number" class="max${m.max == null ? ' empty' : ''}" data-k="max" step="any" placeholder="${t('max')}" title="${esc(t('Upper limit (optional): e.g. exactly +4, so +5 items do not count'))}" value="${m.max == null ? '' : m.max}"></span>`}
    </div>`;
}

// Валюта цены на трейде: любая в пересчёте или только лоты в конкретной валюте.
const CURRENCIES = [['any', 'Any'], ['divine', 'Divine'], ['chaos', 'Chaos'], ['exalted', 'Exalted']];

function renderFilters() {
  const box = $('filters');
  box.hidden = !state.searchable;
  if (!state.searchable) return;
  const f = state.filters;
  // Части сумм (Σ сопротивлений, Σ жизни) — под своей суммой, свёрнуты под «▸ N mods»; включённая часть раскрывает.
  const rows = [];
  f.mods.forEach((m, i) => {
    if (m.inSum) return;
    rows.push(modRow(m, i));
    if (m.tag !== 'pseudo') return;
    const parts = f.mods.map((p, j) => [p, j]).filter(([p]) => p.inSum === m.statId);
    if (!parts.length) return;
    const open = openSums.has(m.statId) || parts.some(([p]) => p.enabled);
    rows.push(`<div class="sum-toggle" data-sum="${esc(m.statId)}">${open ? '▾' : '▸'} ${t('{n} mods in this total', { n: parts.length })}</div>`);
    if (open) rows.push(`<div class="sum-parts">${parts.map(([p, j]) => modRow(p, j)).join('')}</div>`);
  });
  // «Без ключевого мода»: его носят почти все билды, а на вещи его нет — сравниваем с такими же неполными вещами.
  (f.exclude || []).forEach((x, j) => rows.push(`<div class="mod excl${x.enabled ? '' : ' off'}" data-x="${j}" title="${esc(t('Listings that have this modifier are excluded — your item lacks it'))}">
      <label><input type="checkbox" data-k="exclude"${x.enabled ? ' checked' : ''}><span class="imp"></span><span class="tcol">≠</span>
        <span class="txt">${esc(t('Without: {mod}', { mod: x.text }))} <span class="dem hot">🔥 ${esc(t('{pct}% builds', { pct: fmt(x.pct) }))}</span></span></label></div>`));
  if (f.hiddenFixed) rows.push(`<div class="muted small center">${esc(t('{n} fixed modifiers hidden — every copy has them', { n: f.hiddenFixed }))}</div>`);
  $('mods').innerHTML = rows.join('');
  // Защита/DPS, уровни и гнёзда выбираются прямо в подсказке под шапкой — здесь валюта цены и «онлайн».
  $('misc').innerHTML = `
    <div class="seg" title="${t('Which currency listings to search')}">${CURRENCIES.map(([id, label]) =>
      `<button data-cur="${id}"${f.priceCurrency === id ? ' class="on"' : ''}>${id === 'any' ? t(label) : label}</button>`).join('')}</div>
    <label class="opt${f.online ? '' : ' off'}"><input type="checkbox" data-o="online"${f.online ? ' checked' : ''}><span title="${t('Instant Buyout or seller online — like the trade site default')}">${t('Buyable now')}</span></label>
    <label class="opt${f.flex ? '' : ' off'}"><input type="checkbox" data-o="flex"${f.flex ? ' checked' : ''}><span title="${t('With 3+ minor modifiers checked, find items that have all but one of them (key modifiers stay required)')}">${t('Allow 1 minor mod missing')}</span></label>`;
  // Моды-варианты (Legacy у Mageblood) ищутся «любые N из выбранных»: порог можно поменять руками.
  const opts = f.mods.filter((m) => m.enabled && m.option).length;
  if (opts > 1) {
    $('misc').insertAdjacentHTML('afterbegin', `<label class="opt">${t('Match ≥')} <input type="number" data-optmin min="1" max="${opts}"
      value="${Math.min(opts, f.optionMin || opts)}"> ${t('of {n} checked', { n: opts })}</label>`);
  }
}

// ---- лоты ----
// Лот и так в той валюте, в которой мы показываем, — «≈» не нужен.
function sameUnit(l) {
  const unit = money(l.divine).split(' ')[1];
  return (unit === 'chaos' && l.currency === 'chaos') || (unit === 'div' && l.currency === 'divine');
}

// Сразу видно 5 самых дешёвых лотов — остальные по «Show all»: окно короче.
const LOTS_SHOWN = 5;
let showAllLots = false;
// Свежий лот (≤ 1 дня) — подсвечен; залежавшийся (≥ 7 дней) — приглушён: такая цена, скорее всего, не продаёт.
const ageClass = (iso) => { const d = ageDays(iso); return d <= 1 ? ' fresh' : d >= 7 ? ' stale' : ''; };

function renderResults(r) {
  const box = $('results');
  box.hidden = !r.listings.length;
  if (!r.listings.length) return;
  box.innerHTML = `
    <div class="sect"><span>${t('Cheapest listings')} <b class="cnt">${r.total.toLocaleString('en-US')}</b></span></div>
    <div class="lots${showAllLots ? ' all' : ''}">${r.listings.map((l, i) => `
      <div class="lot${i >= LOTS_SHOWN ? ' more' : ''}${ageClass(l.indexed)}" data-i="${i}" title="${l.whisper ? t('Copy whisper to seller') : t('Instant buyout — opens the trade site (Travel to Hideout)')}">
        <span class="chip">${l.currencyImage ? `<img src="${esc(l.currencyImage)}" alt="">` : ''}${fmt(l.amount)}${l.currencyImage ? '' : ' ' + esc(l.currencyName)}</span>
        <span class="eq">${cmpBadge(l)}${l.divine != null && !sameUnit(l) ? '≈ ' + money(l.divine) : ''}</span>
        <span class="seller">${l.whisper ? '' : `<b class="ib" title="${t('Instant buyout')}">⚡</b>`}<span class="dot${l.online ? ' on' : ''}"></span>${esc(l.seller)}</span>
        <span class="age">${l.indexed ? ago(l.indexed) : ''}</span>
        <span class="acts">${l.whisper ? `<i data-a="whisper" title="${t('Whisper in game — opens chat with the message, you press Enter')}"><svg viewBox="0 0 16 16"><path d="M2 3h12v8H7l-3 3v-3H2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></i>` : ''}<i data-a="site" title="${t('Open this listing on the trade site')}">↗</i>${l.tip ? `<i data-a="pin" title="${t('Pin the comparison card')}"><svg viewBox="0 0 16 16"><path d="M10 2l4 4-2 1-2 3 1 2-1 1-3-3-4 4-1-1 4-4-3-3 1-1 2 1 3-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></i>` : ''}</span>
      </div>`).join('')}
    </div>
    ${r.listings.length > LOTS_SHOWN ? `<button class="link lots-more">${showAllLots ? t('Show fewer') : t('Show all {n}', { n: r.listings.length })}</button>` : ''}`;
  const more = box.querySelector('.lots-more');
  if (more) more.addEventListener('click', () => { showAllLots = !showAllLots; renderResults(r); fit(); });
  box.querySelectorAll('.lot').forEach((row) => row.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-a]');
    if (act) {
      const l = r.listings[+row.dataset.i];
      if (act.dataset.a === 'site') await openListing(r, l);
      else if (act.dataset.a === 'pin') {
        // Карточка остаётся открытой, пока не открепят: можно навести на другие лоты и вернуться к ней.
        pinnedLot = pinnedLot && pinnedLot.l === l ? null : { l, row };
        box.querySelectorAll('.lot.pinned').forEach((x) => x.classList.remove('pinned'));
        if (pinnedLot) { row.classList.add('pinned'); showCompare(l, row); } else hideCompare();
      } else if (!(await window.pc.whisperGame(l.whisper))) setStatus(t('Whisper copied — switch to the game and paste it into chat (Enter, Ctrl+V)'));
      fit();
      return;
    }
    // Мгновенный выкуп — шёпота нет: покупка через «Travel to Hideout» на трейде.
    if (!r.listings[+row.dataset.i].whisper) {
      await openListing(r, r.listings[+row.dataset.i]);
      fit();
      return;
    }
    window.pc.copy(r.listings[+row.dataset.i].whisper);
    box.querySelectorAll('.lot.copied').forEach((x) => x.classList.remove('copied'));
    row.classList.add('copied');
    setStatus(t('Whisper copied — paste it into game chat (Enter, Ctrl+V)'));
    fit();
  }));
  box.querySelectorAll('.lot').forEach((row) => {
    row.addEventListener('mouseenter', () => showCompare(r.listings[+row.dataset.i], row));
    row.addEventListener('mouseleave', () => (pinnedLot && pinnedLot.row.isConnected ? showCompare(pinnedLot.l, pinnedLot.row) : hideCompare()));
  });
}

// Лот на сайте трейда: поиск с теми же фильтрами + аккаунт продавца — на странице почти только он.
// Не вышло (лимит, ошибка) — общий поиск.
async function openListing(r, l) {
  let url = r.url;
  if (l.account) {
    try { url = await window.pc.listingUrl(state.item, state.filters, l.account); } catch {}
  }
  window.pc.openUrl(url);
  setStatus(l.whisper ? t('Opened on the trade site') : t('Opened on the trade site — use Travel to Hideout there'));
}

// ---- карточка конкурента при наведении на лот: что у него лучше / хуже, чем у нашей вещи ----
// Значение мода — среднее чисел в строке по модулю («reduced» тоже: чем больше, тем сильнее мод).
function modValue(text) {
  const nums = (String(text).match(/\d+(?:\.\d+)?/g) || []).map(Number);
  return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
}
const propNum = (v) => { const m = String(v).replace(/,/g, '').match(/\d+(?:\.\d+)?/); return m ? +m[0] : null; };

// Сравнение модов конкурента с нашей вещью — общее для карточки сбоку и «▲▼» в строке лота.
// По самому стату, складывая все категории: «41% increased ES» (обычный) + «93%» (desecrated) против их «138%» —
// игроку важна сумма, а не откуда мод. Ключ — id без категории («stat_4015621042»). Варианты (Legacy of Gold)
// приходят у лота с id без номера варианта — их сверяем по тексту.
function compareModel(t) {
  const mods = state.filters.mods;
  const key = (id) => id.replace(/^\w+\./, '');
  const add = (map, k, v) => map.set(k, (map.get(k) || 0) + v);
  const ours = new Map();
  const theirs = new Map();
  for (const m of mods) if (m.statId && m.tag !== 'pseudo' && !m.option) add(ours, key(m.statId), Math.abs(m.value || 0));
  for (const m of t.mods) if (m.statId) add(theirs, key(m.statId), Math.abs(modValue(m.text) || 0));
  const ourOptions = new Set(mods.filter((m) => m.option).map((m) => m.text.toLowerCase()));
  // Минус в самом тексте («-11% to all Elemental Resistances») — обычно недостаток, но нишевым билдам (Doryani и т.п.)
  // бо́льший минус как раз нужен: такое отличие не «лучше» и не «хуже» — «±, зависит от билда», в ▲▼ не считается.
  const penalty = new Set(mods.filter((m) => m.statId && /^-\d/.test(String(m.text).trim())).map((m) => key(m.statId)));
  const theirTexts = new Set(t.mods.map((m) => m.text.toLowerCase()));
  // better / worse / same — мод есть у обоих; extra — у нас такого нет; '' — не сравнить (нет id стата).
  const classify = (m) => {
    if (ourOptions.has(m.text.toLowerCase())) return 'same';
    if (!m.statId) return '';
    const k = key(m.statId);
    if (!ours.has(k)) return 'extra';
    const c = compareClass(theirs.get(k), ours.get(k));
    return (penalty.has(k) && (c === 'better' || c === 'worse') ? 'diff' : c) || 'same';
  };
  const missing = mods.filter((m) => m.statId && m.tag !== 'pseudo'
    && (m.option ? !theirTexts.has(m.text.toLowerCase()) : !theirs.has(key(m.statId))));
  // Порядок наших модов — чтобы карточка конкурента шла в том же порядке, что и фильтры.
  const order = new Map();
  mods.forEach((m) => { if (m.statId && !order.has(key(m.statId))) order.set(key(m.statId), order.size); });
  return { classify, missing, key, ours, order };
}

// «▲2 ▼1» в строке лота: сколько модов у конкурента лучше и хуже ваших — без наведения.
// Сколько модов лота лучше / хуже, чем у вашей вещи (одинаковые моды на трейде — одна сумма, считаем один раз).
const STRONGER = 2;
function cmpCounts(l) {
  if (!l.tip || !state || !state.filters) return { better: 0, worse: 0 };
  const { classify, key } = compareModel(l.tip);
  const seen = new Set();
  let better = 0;
  let worse = 0;
  for (const m of l.tip.mods) {
    if (!m.statId || seen.has(key(m.statId))) continue;
    seen.add(key(m.statId));
    const c = classify(m);
    // Ключевой мод (уровни умений, главный мод слота) весит вдвое: +5 против ваших +4 — уже другая вещь.
    const ours = state.filters.mods.find((x) => x.statId && key(x.statId) === key(m.statId));
    const w = ours && ours.key ? 2 : 1;
    if (c === 'better') better += w;
    else if (c === 'worse') worse += w;
  }
  return { better, worse };
}

function cmpBadge(l) {
  const { better, worse } = cmpCounts(l);
  if (!better && !worse) return '';
  return `<span class="cmpc" title="${t('Modifiers better / worse than yours')}">${better ? `<i class="b">▲${better}</i>` : ''}${worse ? `<i class="w">▼${worse}</i>` : ''}</span>`;
}

function compareClass(theirs, ours) {
  if (theirs == null || ours == null) return '';
  if (theirs > ours * 1.005) return 'better';
  if (theirs < ours * 0.995) return 'worse';
  return 'same';
}

function showCompare(l, row) {
  const tip = l.tip;
  if (!tip) return;
  const { item } = state;
  const { classify, missing: miss, key, ours, order } = compareModel(tip);
  const mark = { better: '▲', worse: '▼', extra: '+', same: '', diff: '±' };
  // Совпадающие моды — в порядке нашей вещи, остальные (которых у нас нет) — в конце; у ▲▼ — наше значение.
  const rank = (m) => (m.statId && order.has(key(m.statId)) ? order.get(key(m.statId)) : 1e3);
  const modLines = tip.mods.map((m, i) => ({ m, i })).sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i).map(({ m }) => {
    const cls = classify(m);
    const mine = (cls === 'better' || cls === 'worse' || cls === 'diff') && ours.get(key(m.statId));
    return `<div class="cm ${cls} d-${esc(m.domain)}"${cls === 'diff' ? ` title="${esc(t('A downside: a bigger minus is usually worse, but some builds want it'))}"` : ''}>${mark[cls] ? `<i>${mark[cls]}</i>` : ''}${esc(m.text)}${mine ? `<span class="yours">${t('yours {x}', { x: (cls === 'diff' ? '-' : '') + fmt(mine) })}</span>` : ''}</div>`;
  }).join('');
  const missing = miss.map((m) => `<div class="cm missing"><i>✗</i>${esc(m.text.split('\n').join(' + '))}</div>`).join('');

  const ourProps = new Map(item.properties.map((p) => [p.k, propNum(p.v)]));
  const props = tip.props.map((p) => {
    const cls = ourProps.has(p.k) ? compareClass(propNum(p.v), ourProps.get(p.k)) : '';
    const yours = cls === 'better' || cls === 'worse' ? `<span class="yours">${t('yours {x}', { x: fmt(ourProps.get(p.k)) })}</span>` : '';
    return `<div class="cm ${cls}">${mark[cls] ? `<i>${mark[cls]}</i>` : ''}${esc(p.k)}: <b>${esc(p.v)}</b>${yours}</div>`;
  });
  if (tip.ilvl) {
    const cls = compareClass(tip.ilvl, item.ilvl);
    props.push(`<div class="cm ${cls}">${mark[cls] ? `<i>${mark[cls]}</i>` : ''}Item Level: <b>${tip.ilvl}</b>${cls ? `<span class="yours">${t('yours {x}', { x: item.ilvl })}</span>` : ''}</div>`);
  }

  const two = tip.name && tip.base && tip.name !== tip.base;
  const html = `
    <div class="banner mini ${esc(tip.rarity)}${two ? '' : ' single'}"><div class="bn-name">${esc(tip.name || tip.base)}</div>${two ? `<div class="bn-base">${esc(tip.base)}</div>` : ''}</div>
    <div class="cmp-body">
      ${props.join('')}
      ${props.length ? '<div class="tt"><div class="sep"></div></div>' : ''}
      ${modLines}
      ${tip.corrupted ? '<div class="cm corrupt">Corrupted</div>' : ''}
      ${missing ? `<div class="cmp-miss">${t("Yours has, theirs doesn't:")}</div>${missing}` : ''}
      <div class="cmp-legend"><span class="better">▲ ${t('better')}</span> · <span class="worse">▼ ${t('worse')}</span> · <span class="extra">+ ${t("you don't have")}</span> — ${t('than your item')}${tip.mods.some((m) => classify(m) === 'diff') ? ` · <span class="diff">± ${t('depends on the build')}</span>` : ''}</div>
    </div>`;
  // Карточка — в отдельном окне сбоку (не закрывает оверлей), напротив строки лота.
  window.pc.compareShow(html, row.getBoundingClientRect().top);
}

let pinnedLot = null; // { l, row } — закреплённая карточка конкурента
function hideCompare() {
  window.pc.compareHide();
}

// Фильтры поменяли после поиска — кнопка Search подсвечивается: результат на экране уже не про них.
function markDirty() {
  // Фильтры поменялись — прежний «вклад модов» больше не про них.
  if (state.impact) { impactSeq++; state.impact = null; document.querySelectorAll('#mods .drive').forEach((x) => x.remove()); }
  const b = $('search');
  if (!b.classList.contains('dirty')) { b.classList.add('dirty'); b.textContent = t('Search · filters changed'); }
}

// Пометка над фильтрами после автоослабления: dropped — строки (текст мода) или { t, v } для перевода.
let lastNotes = null;
function renderNotes() {
  if (!lastNotes) return;
  const { dropped, relaxStopped, unpriced } = lastNotes;
  const notes = [];
  if (dropped && dropped.length) {
    notes.push(t('Too few listings — relaxed: {list}', { list: dropped.map((d) => (typeof d === 'string' ? d : t(d.t, d.v))).join(' · ') }));
  }
  if (relaxStopped) notes.push(t("Couldn't relax filters further: {why}", { why: relaxStopped }));
  if (unpriced) notes.push(t('{n} listings in other currencies are not counted: no poe.ninja exchange rates for this league yet', { n: unpriced }));
  setNote(notes.join('\n'));
}

// Чем сейчас заполнен блок цены — чтобы перерисовать его при смене языка.
let heroRender = null;

async function runSearch(relax = false) {
  const seq = ++searchSeq;
  impactSeq++;
  state.impact = null;
  state.est = null;
  $('search').classList.remove('dirty');
  $('search').textContent = t('Search');
  $('search').disabled = true;
  setStatus('');
  heroRender = renderSearchingHero;
  heroRender();
  fit();
  try {
    const r = await window.pc.search(state.item, state.filters, relax);
    if (seq !== searchSeq) return;
    if (r.dropped && r.dropped.length) {
      state.filters = r.filters;
      renderFilters();
      renderTooltip();
      renderBanner(); // ослабление могло снять точную базу
    }
    lastNotes = { dropped: r.dropped, relaxStopped: r.relaxStopped, unpriced: r.unpriced };
    renderNotes();
    rates = r.rates || rates;
    setStatus(''); // убрать «ждём лимит», если было
    state.tradeUrl = r.url;
    $('open').hidden = false;
    $('copyLink').hidden = false;
    heroRender = () => { renderTradeHero(r); $('hero').insertAdjacentHTML('beforeend', prevCheckHtml()); renderResults(r); renderElements(); };
    heroRender();
    recordPrice(state.est);
    loadElements(seq, false);
    // Советы по крафту считали «продать как есть» без оценки (вкладку открыли до конца поиска — в пошаговом крафте
    // всегда) или по прежним фильтрам: пересчитываем — сразу, если вкладка открыта, иначе при открытии.
    if (craftFor === state || (craftFor === null && !$('tab-craft').hidden)) { craftFor = null; if (!$('tab-craft').hidden) loadCraft(); }
  } catch (e) {
    if (seq !== searchSeq) return;
    $('results').hidden = true;
    elementAlts = null;
    if ($('elements')) $('elements').hidden = true;
    // Лимит трейда: ждём, пока освободится, и ищем снова сами (та же вещь, окно открыто) — с отсчётом.
    if (isLimit(e)) {
      const ms = await window.pc.limitWait().catch(() => 0);
      if (seq !== searchSeq) return;
      if (ms > 0 && ms < 30 * 60e3) {
        const until = Date.now() + ms;
        const msg = esc(errText(e));
        heroRender = () => {
          $('hero').innerHTML = voidState('⏳', t('Trade site rate limit'),
            `${msg}<br>${untilHtml('Searching again in {n} s', until).replace('<span data-until', `<span data-then="search:${seq}" data-until`)}`,
            [['retry', t('Try now')]]);
        };
        heroRender();
        tick();
        return;
      }
    }
    const err = esc(errText(e));
    heroRender = () => { $('hero').innerHTML = voidState('⚠', t('Search failed'), err, [['retry', t('Try again')]]); };
    heroRender();
  } finally {
    if (seq === searchSeq) $('search').disabled = false;
    fit();
  }
}

window.pc.onItem((data) => {
  impactSeq++; // недосчитанный «вклад модов» прежней вещи не должен писать в новую
  quickMemo = new Map();
  elementAlts = null;
  if ($('elements')) $('elements').hidden = true;
  state = data;
  rates = data.rates || {};
  openSums.clear();
  openDemand.clear();
  showAllLots = false;
  hideCompare();
  if (state.filters) state.filters.priceCurrency = data.priceCurrency || 'any';
  searchSeq++;
  setStatus('');
  setNote('');
  lastNotes = null;
  heroRender = null;
  lastBuilds = null;
  lastDemand = null;
  $('results').hidden = true;
  $('hero').hidden = true;
  $('builds').hidden = true;
  $('open').hidden = true;
  $('copyLink').hidden = true;
  $('poe2db').hidden = !(state.item.name || state.item.baseType);
  $('craftBadge').textContent = openSlotsBadge(state.item);
  pinnedLot = null;
  $('demandBadge').textContent = '';
  renderLeagues();
  renderBanner();
  fullNameTitles();
  renderTooltip();
  if (state.exchange) {
    heroRender = () => { renderExchangeHero(); $('hero').insertAdjacentHTML('beforeend', prevCheckHtml()); };
    heroRender();
    recordPrice(state.exchange.divine);
  }
  toggleHistory(false);
  renderFilters();
  if (!state.exchange && !state.searchable) setStatus(t('No price data for this item'));
  else if (state.offline) setStatus(t('No connection to {host} — using saved data', { host: state.offline }), true);
  fit();
  // Вкладки — только для предметов с поиском на трейде; валюте хватает одной.
  $('tabs').hidden = !state.searchable;
  // Окно закреплено, только пока показана вещь пошагового крафта: проверили другую — оно снова прячется как обычно
  // (сессия остаётся: вернулись к той вещи — снова закреплено).
  const inSession = !!(craftSession && sessionMatches());
  window.pc.pin(inSession);
  setTab(inSession ? 'craft' : 'price');
  if (state.searchable) runSearch(true);
  loadBuilds();
  loadDemand();
  loadUniqueNinja();
});

$('hero').addEventListener('click', (e) => {
  const note = e.target.closest('[data-note]');
  if (note) {
    window.pc.copy(note.dataset.note);
    setStatus(t('Copied "{note}" — paste it as the price note', { note: note.dataset.note }));
    fit();
    return;
  }
  const b = e.target.closest('[data-unit]');
  if (!b || !state.exchange) return;
  unit = b.dataset.unit;
  try { localStorage.setItem('exchangeUnit', unit); } catch {}
  heroRender();
  fit();
});

$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) setTab(b.dataset.tab);
});

$('craft').addEventListener('click', (e) => {
  const all = e.target.closest('[data-priceall]');
  if (all) { priceAll(all); return; }
  const b = e.target.closest('[data-ck]');
  if (b) priceCraft(b);
});

$('tab-demand').addEventListener('click', async (e) => {
  const lv = e.target.closest('[data-lvl]');
  if (lv) {
    demandLevel = +lv.dataset.lvl;
    await window.pc.setDemandLevel(demandLevel).catch(() => {}); // не сохранилось — уровень всё равно действует сейчас
    craftFor = null; // тема крафта — тоже по новому уровню
    loadBuilds();
    loadDemand();
    return;
  }
  const dall = e.target.closest('[data-dall]');
  if (dall) { demandAll = dall.dataset.dall === '1'; loadDemand(); return; }
  const more = e.target.closest('[data-dmore]');
  if (more) {
    const col = more.closest('.dcol');
    const key = more.dataset.dmore;
    if (openDemand.has(key)) openDemand.delete(key); else openDemand.add(key);
    col.classList.toggle('all', openDemand.has(key));
    more.textContent = openDemand.has(key) ? t('Show fewer') : t('Show all {n}', { n: col.querySelectorAll('.brow').length });
    fit();
    return;
  }
  const b = e.target.closest('.bopen');
  if (b) window.pc.openUrl(b.dataset.url);
});

window.pc.onStatus((s) => {
  if (s.waitUntil) waitStatus(s.waitUntil);
  else setStatus(s.error || s.text, !!s.error);
  fit();
});

// ---- изменения фильтров ----
$('mods').addEventListener('click', (e) => {
  const t = e.target.closest('.sum-toggle');
  if (!t) return;
  const id = t.dataset.sum;
  if (openSums.has(id)) openSums.delete(id); else openSums.add(id);
  renderFilters();
  fit();
});

$('mods').addEventListener('input', (e) => {
  const row = e.target.closest('.mod');
  if (!row) return;
  markDirty();
  if (row.dataset.x != null) {
    const x = state.filters.exclude[+row.dataset.x];
    x.enabled = e.target.checked;
    row.classList.toggle('off', !x.enabled);
    return;
  }
  const m = state.filters.mods[+row.dataset.i];
  if (e.target.dataset.k === 'enabled') {
    m.enabled = e.target.checked;
    row.classList.toggle('off', !m.enabled);
    if (m.option) renderFilters(); // пересчитать «Match ≥ N of M»
  } else if (e.target.dataset.k === 'min') {
    m.min = e.target.value === '' ? null : Number(e.target.value);
  } else if (e.target.dataset.k === 'max') {
    m.max = e.target.value === '' ? null : Number(e.target.value);
    e.target.classList.toggle('empty', m.max == null);
  }
});

// ref из подсказки → объект фильтра: 'p:2' — state.filters.props[2], 'm:ilvl' — state.filters.ilvl.
function filterByRef(ref) {
  const [kind, key] = ref.split(':');
  if (kind === 'f') return state.filters.flags[+key];
  return kind === 'p' ? state.filters.props[+key] : state.filters[key];
}

$('tooltip').addEventListener('click', (e) => {
  if (e.target.closest('.tp-in')) return; // клик в поле границы — не переключаем
  const el = e.target.closest('.tp');
  if (!el) return;
  markDirty();
  const flt = filterByRef(el.dataset.ref);
  if (el.dataset.ref.startsWith('f:')) {
    // Состояние: выкл → как у вещи → противоположное → выкл.
    if (!flt.enabled) { flt.enabled = true; flt.value = flt.own; } else if (flt.value === flt.own) flt.value = !flt.own; else flt.enabled = false;
  } else flt.enabled = !flt.enabled;
  renderTooltip();
  fit();
  if (flt.enabled) {
    const input = $('tooltip').querySelector(`.tp-in[data-ref="${el.dataset.ref}"]`);
    if (input) input.select();
  }
});

$('tooltip').addEventListener('input', (e) => {
  const t = e.target;
  if (!t.classList.contains('tp-in')) return;
  markDirty();
  const flt = filterByRef(t.dataset.ref);
  flt[t.dataset.f] = t.value === '' ? null : Number(t.value);
  if (flt.exact) flt.max = flt.min; // тир путевого камня — ровно такой
});

$('misc').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cur]');
  if (!b) return;
  markDirty();
  state.filters.priceCurrency = b.dataset.cur;
  window.pc.setPriceCurrency(b.dataset.cur);
  renderFilters();
});

$('misc').addEventListener('input', (e) => {
  const t = e.target;
  markDirty();
  if (t.dataset.o) {
    state.filters[t.dataset.o] = t.checked;
    window.pc.setSearchDefaults({ online: state.filters.online, flex: state.filters.flex }); // у следующей вещи — так же
  }
  if ('optmin' in t.dataset) state.filters.optionMin = Number(t.value) || null;
  if (t.type === 'checkbox') t.closest('.opt').classList.toggle('off', !t.checked);
});

$('banner').addEventListener('click', (e) => {
  const el = e.target.closest('.pick');
  if (!el || !state || !state.searchable) return;
  markDirty();
  const f = state.filters;
  const isName = el.id === 'name' && state.item.rarity === 'Unique' && $('base').textContent;
  if (isName) f.useName = !f.useName;
  else f.useType = !f.useType;
  renderBanner();
});

function searchNow() { setNote(''); runSearch(); loadBuilds(); }
$('search').addEventListener('click', searchNow);
document.addEventListener('keydown', (e) => {
  // Enter — поиск на вкладке цены: не автоповтором (удержание жгло лимит), не во время поиска и не на кнопке
  // (она нажмётся сама — иначе и действие кнопки, и поиск).
  if (e.key === 'Enter' && state && state.searchable && !e.repeat && !$('search').disabled && !$('tab-price').hidden
    && !e.target.closest('button, summary, a, [data-act]')) searchNow();
  if (e.key === 'Escape') {
    // Сначала закрываем открытый список лиг, а не всё окно.
    if (!$('leagueMenu').hidden) toggleLeagueMenu(false);
    else if (!$('histMenu').hidden) toggleHistory(false);
    else window.pc.hide();
  }
});
$('open').addEventListener('click', () => state.tradeUrl && window.pc.openUrl(state.tradeUrl));
// Ссылка на поиск — поделиться или открыть позже.
$('copyLink').addEventListener('click', () => {
  if (!state.tradeUrl) return;
  window.pc.copy(state.tradeUrl);
  setStatus(t('Link copied'));
});
// Страница вещи на poe2db: уник — по имени, остальное — по базе.
$('poe2db').addEventListener('click', () => {
  const it = state && state.item;
  if (!it) return;
  const page = it.rarity === 'Unique' && it.name ? it.name : it.baseType || it.name;
  window.pc.openUrl(`https://poe2db.tw/us/${encodeURIComponent(page.replace(/ /g, '_'))}`);
});

// Значок на вкладке Craft: свободные места под аффиксы (редкая — 3 + 3, магическая — 1 + 1; самоцветы — 2 + 2).
function openSlotsBadge(it) {
  if (!it.advanced || !['Rare', 'Magic'].includes(it.rarity) || it.corrupted || it.mirrored || it.sanctified) return '';
  const per = it.rarity === 'Magic' ? 1 : it.itemClass === 'Jewels' ? 2 : 3;
  const used = (side) => (it.affixes || []).filter((a) => a.side === side).length;
  const free = Math.max(0, per - used('prefix')) + Math.max(0, per - used('suffix'));
  return free ? t('{n} open', { n: free }) : '';
}
$('close').addEventListener('click', () => window.pc.hide());
$('leagueBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleLeagueMenu(); });
$('leagueMenu').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-league]');
  if (!b) return;
  toggleLeagueMenu(false);
  if (b.dataset.league === state.league) return;
  state.league = b.dataset.league;
  renderLeagues();
  setStatus(t('Loading prices for {league}…', { league: state.league }));
  try {
    await window.pc.setLeague(state.league);
  } catch (err) {
    setStatus(errText(err), true);
    return;
  }
  setStatus('');
  // Биржевой предмет: его цену (poe.ninja новой лиги) считает главный процесс — проверяем вещь заново.
  if (!state.searchable) { window.pc.recheck(); return; }
  // Остальное — тоже по новой лиге: поиск, спрос, цена уника на poe.ninja; советы по крафту пересчитаются после поиска.
  state.uniqueNinja = null;
  craftFor = null;
  quickMemo = new Map();
  runSearch();
  loadBuilds();
  loadDemand();
  loadUniqueNinja();
});
// Клик мимо — закрыть список.
document.addEventListener('click', (e) => {
  if (!e.target.closest('#ldrop')) toggleLeagueMenu(false);
  if (!e.target.closest('#hdrop')) toggleHistory(false);
});

// ---- язык интерфейса: статичные подписи из index.html (data-i18n) и перерисовка показанного ----
function applyLang() {
  document.documentElement.lang = window.i18n.getLang();
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  $('search').textContent = t($('search').classList.contains('dirty') ? 'Search · filters changed' : 'Search');
}
applyLang();

window.pc.onRefit(() => fit()); // сменили масштаб — окно подгоняется под содержимое

window.pc.onUiLang((lang) => {
  window.i18n.setLang(lang);
  applyLang();
  if (!state) { fit(); return; }
  hideCompare();
  renderLeagues();
  renderBanner();
  fullNameTitles();
  renderTooltip();
  renderFilters();
  if (heroRender && !$('hero').hidden) heroRender();
  if (!$('note').hidden) renderNotes();
  if (!state.exchange && !state.searchable) setStatus(t('No price data for this item'));
  if (lastBuilds && !$('builds').hidden) renderBuilds(lastBuilds);
  if (lastDemand && !$('demand').hidden) renderDemand(lastDemand);
  // Советы по крафту собирает главный процесс — запрашиваем заново (сразу, если вкладка открыта).
  craftFor = null;
  if (!$('tab-craft').hidden) loadCraft();
  fit();
});

// CSP окна запрещает инлайн-стили (style="…"), поэтому ширину полос и заглушек задаём через data-w после вставки.
new MutationObserver(() => {
  document.querySelectorAll('[data-w]').forEach((el) => { el.style.width = el.dataset.w; el.removeAttribute('data-w'); });
}).observe(document.body, { childList: true, subtree: true });
