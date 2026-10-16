const $ = (id) => document.getElementById(id);
let state = null; // { item, exchange, filters, searchable, league, leagues, rates, priceCurrency }
let rates = {}; // { chaos, exalted } за 1 div, mirror — div за 1 зеркало
let searchSeq = 0;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Текст ошибки из главного процесса без обёртки Electron («Error invoking remote method 'search': Error: …»).
function errText(e) {
  return String((e && e.message) || e).replace(/^Error invoking remote method '\w+': (Error: )?/, '');
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
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
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
  requestAnimationFrame(() => window.pc.fit(document.body.scrollHeight + 2));
}

function setStatus(text, error) {
  const s = $('status');
  s.hidden = !text;
  s.textContent = text || '';
  s.classList.toggle('error', !!error);
}

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
    nameEl.title = 'Searching this unique only — click to search any unique on this base';
  } else if (item.rarity === 'Unique' && two) {
    nameEl.classList.add('pick');
    nameEl.title = 'Click to search this unique only';
  }
  if (!f.useName && f.category) {
    baseEl.classList.add('pick');
    if (f.useType) baseEl.classList.add('on');
    baseEl.title = f.useType ? 'Searching this base only — click to search any item of this class'
      : 'Searching any item of this class — click to search this base only';
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
  const item = (l) => `<button data-league="${esc(l)}"${l === state.league ? ' class="on"' : ''}>${esc(l.replace(/^HC /, ''))}${isHC(l) ? '<span class="hc">HC</span>' : ''}${isSeason(l) ? '<span class="cur" title="Current league">current</span>' : ''}${l === state.league ? '<span class="chk">✓</span>' : ''}</button>`;
  const soft = state.leagues.filter((l) => !isHC(l));
  const hard = state.leagues.filter(isHC);
  $('leagueMenu').innerHTML = soft.map(item).join('') + (hard.length ? '<div class="lsep"></div>' + hard.map(item).join('') : '');
}

function toggleLeagueMenu(open) {
  const on = open != null ? open : $('leagueMenu').hidden;
  $('leagueMenu').hidden = !on;
  $('ldrop').classList.toggle('open', on);
  if (on) fit();
}

// Свойство подсказки → фильтр защиты (state.filters.props по key).
// Строка свойства → фильтр трейда. Урон по типам ищется как DPS: физический — pDPS, стихийный — eDPS.
const PROP_KEY = { Armour: 'ar', 'Evasion Rating': 'ev', 'Energy Shield': 'es', Spirit: 'spirit',
  'Physical Damage': 'pdps', 'Fire Damage': 'edps', 'Cold Damage': 'edps', 'Lightning Damage': 'edps',
  'Critical Hit Chance': 'crit', 'Attacks per Second': 'aps' };
const PROP_OP = { pdps: 'pDPS ≥', edps: 'eDPS ≥' };

// Значение в подсказке, по которому можно искать: клик включает, рядом — граница поиска.
// ref: 'p:<i>' — фильтр защиты/DPS, 'm:<key>' — уровень/ilvl/гнёзда.
function pick(ref, label, valueHtml, filter, op, field) {
  if (!filter || !state.searchable) return `${label}: ${valueHtml}`;
  const bound = filter.enabled
    ? ` <span class="tp-op">${op}</span><input type="number" class="tp-in" data-ref="${ref}" data-f="${field}" value="${filter[field] ?? ''}">`
    : '';
  return `<span class="tp${filter.enabled ? ' on' : ''}" data-ref="${ref}" title="${filter.enabled ? 'Searching by this — click to ignore' : 'Click to search by this'}">${label}: ${valueHtml}${bound}</span>`;
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
      if (p.k === 'Grants Skill') return pick('m:skill', 'Grants Skill', v, f.skill, 'level ≥', 'min');
      const i = propIdx(PROP_KEY[p.k]);
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
  if (item.unidentified) flags.push('<span class="corrupt">Unidentified</span>');
  // Состояния (Corrupted, Sanctified, Mirrored…) — переключатели: включённое требует то же у лота.
  const fl = (state.searchable && f.flags) || [];
  // Состояние — три положения по клику: только как у вашей вещи → только противоположное → неважно.
  fl.forEach((x, i) => {
    const v = x.enabled ? x.value : x.own;
    const label = v ? x.name : `Not ${x.name.toLowerCase()}`;
    const next = !x.enabled ? 'only such items' : x.value === x.own ? `only "${x.value ? `Not ${x.name.toLowerCase()}` : x.name}"` : 'any';
    flags.push(`<span class="tp flag ${x.key === 'corrupted' && v ? 'corrupt' : 'cls'}${x.enabled ? ' on' : ''}${v ? '' : ' neg'}" data-ref="f:${i}"
      title="${x.enabled ? `Searching only: ${label}` : 'Ignored — any'} · click: ${next}">${esc(label)}${x.enabled ? '' : ' <small>· any</small>'}</span>`);
  });
  if (!fl.length) {
    if (item.corrupted) flags.push('<span class="corrupt">Corrupted</span>');
    if (item.mirrored) flags.push('<span class="cls">Mirrored</span>');
  }
  if (flags.length) lines.push(row(flags));
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
    if (rates.chaos && div * rates.chaos < 0.5) out.push(`${fmt(1 / (div * rates.chaos))} per chaos`);
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
  const inverse = units > 0 && units < 0.5 ? `${fmt(1 / units)} per ${UNITS.find((d) => d[0] === shown)[2]}` : '';
  const others = UNITS.filter((d) => d[0] !== shown && d[0] !== x.id && perDiv(d[0]))
    .map((d) => `${fmt(x.divine * perDiv(d[0]))} ${d[2]}`);
  $('hero').hidden = false;
  $('hero').innerHTML = `
    <div class="k">Price per unit</div>
    <div class="big">${x.image ? `<img src="${esc(x.image)}" alt="">` : ''}${inUnit(x.divine, shown)}</div>
    <div class="alt">${[inverse, ...others].filter(Boolean).join(' · ')}</div>
    <div class="seg units">${UNITS.filter((d) => d[0] !== x.id).map((d) =>
      `<button data-unit="${d[0]}"${d[0] === shown ? ' class="on"' : ''}>${d[1]}</button>`).join('')}</div>
    <div class="grid">
      <div><span class="k">${stack ? `Stack ×${stack}` : 'Stack'}</span><span class="v">${stack ? inUnit(x.divine * stack, shown) : '—'}</span></div>
      <div class="trend"><span class="k">7 days</span>${spark(x.spark)}
        ${x.spark && x.spark.length > 1 ? `<span class="tr ${dir}">${pct1(x.spark[0])} → ${pct1(x.spark[x.spark.length - 1])}</span>` : '<span class="v">—</span>'}</div>
      <div><span class="k">24h volume</span><span class="v">${fmt(x.volume)} div</span></div>
    </div>`;
}

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
  if (act === 'ninja') window.pc.openUrl(b.dataset.url || 'https://poe.ninja/poe2/builds');
});

// Пока ищем — заглушки той же формы, что и результат: окно не прыгает, когда приходят цены.
function renderSearchingHero() {
  $('hero').hidden = false;
  $('hero').innerHTML = `<div class="k">Estimated price</div><span class="sk big"></span>
    <div class="alt">Searching the trade site…</div><span class="sk line"></span>
    <div class="grid">${'<div><span class="sk" data-w="60%"></span><br><span class="sk" data-w="80%"></span></div>'.repeat(3)}</div>`;
  $('results').hidden = false;
  $('results').innerHTML = `<div class="sect"><span>Cheapest listings</span></div><div class="lots">${[70, 55, 62, 48, 66].map((w) => `
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
  let why = `${total} listings, prices within ×${fmt(spread)}`;
  if (total >= 10 && spread <= 2 && !allStale) level = 3;
  else if (total < 4 || spread > 4 || allStale) level = 1;
  if (total < 4) why = `only ${total} similar listing${total === 1 ? '' : 's'}`;
  else if (allStale) why = 'all cheapest listings are a week+ old — those prices may not be real';
  else if (spread > 4) why = `cheapest prices differ ×${fmt(spread)} — someone may be underpricing`;
  const label = { 3: 'Reliable', 2: 'Some data', 1: 'Few listings' }[level];
  return `<div class="conf c${level}" title="${esc(why)}">${'●'.repeat(level)}${'○'.repeat(3 - level)} ${label}</div>`;
}

// Сколько дней назад лот выставлен или переоценён (трейд: listing.indexed).
const ageDays = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 86400e3 : 99);

// Строка про возраст лотов: свежие за сутки, залежавшийся самый дешёвый, тренд «свежие дешевле/дороже».
function ageSummary(priced, usedFresh) {
  if (priced.length < 2) return '';
  const bits = [];
  const day = priced.filter((l) => l.age <= 1);
  if (day.length) bits.push(`Fresh (24h): <b>${day.length}</b> from ${money(day[0].div)}`);
  if (priced[0].age >= 7) bits.push(`<span class="stale">cheapest hung ${Math.round(priced[0].age)}d — likely overpriced</span>`);
  const newer = priced.filter((l) => l.age <= 3).map((l) => l.div);
  const older = priced.filter((l) => l.age > 3).map((l) => l.div);
  if (newer.length >= 2 && older.length >= 2) {
    const mid = (a) => a[Math.floor((a.length - 1) / 2)];
    const k = mid(newer) / mid(older);
    if (k < 0.85) bits.push('<span class="down">↓ newer listings are cheaper</span>');
    else if (k > 1.15) bits.push('<span class="up">↑ newer listings are pricier</span>');
  }
  if (usedFresh) bits.push('estimate from listings ≤ 3 days old');
  return bits.length ? `<div class="ages">${bits.join(' · ')}</div>` : '';
}

function renderTradeHero(r) {
  const divs = r.listings.map((l) => l.divine).filter((v) => v != null).sort((a, b) => a - b);
  if (!divs.length) {
    $('hero').innerHTML = voidState('∅', 'No similar items listed right now',
      'It may be a rare high-end item. Uncheck filters or lower the minimums to widen the search.',
      [['relax', 'Relax filters'], ['trade', 'Open trade site']]);
    return;
  }
  // Возраст лотов: залежавшийся дешёвый лот (неделю+ не купили) завышает картину — за эту цену не берут.
  // Если свежих (≤ 3 дней) лотов хватает, оценку строим по ним; иначе — по всем, но надёжность ниже.
  const priced = r.listings.filter((l) => l.divine != null).map((l) => ({ div: l.divine, age: ageDays(l.indexed) }))
    .sort((a, b) => a.div - b.div);
  const fresh = priced.filter((l) => l.age <= 3);
  const basis = fresh.length >= 3 ? fresh.map((l) => l.div) : divs;
  const head = basis.slice(0, 5);
  const est = head[Math.floor((head.length - 1) / 2)];
  const median = divs[Math.floor((divs.length - 1) / 2)];
  const ageHtml = ageSummary(priced, fresh.length >= 3 && fresh.length < priced.length);
  // Вторая цена: те же моды с любым роллом своего тира — сколько рынок доплачивает за ваши роллы.
  let floorHtml = '';
  const fl = r.floor;
  if (fl && fl.divs.length) {
    // То же правило, что и для основной цены: хватает свежих (≤ 3 дней) — по ним.
    const ffresh = (fl.lots || []).filter((l) => ageDays(l.indexed) <= 3).map((l) => l.div);
    const fh = (ffresh.length >= 3 ? ffresh : fl.divs).slice(0, 5);
    const fest = fh[Math.floor((fh.length - 1) / 2)];
    const premium = fest > 0 ? Math.round((est / fest - 1) * 100) : 0;
    floorHtml = `<div class="floor" title="Same modifiers with any roll of the same tier">
      Any roll in tier: <b>${money(fest)}</b> · ${fl.total.toLocaleString('en-US')} listed
      ${premium >= 15 ? `<span class="prem">your rolls ≈ +${premium}%</span>` : ''}</div>`;
  }
  state.est = est;
  const drivable = state.filters.mods.some((m) => m.enabled && m.statId && !m.option && !m.inSum);
  $('hero').innerHTML = `
    <div class="k">${fl ? 'Like yours' : 'Estimated price'}</div>
    <div class="big">${money(est)}</div>
    <div class="alt">${alt(est)}</div>
    ${confidence(r.total, head, priced.slice(0, 5))}
    ${floorHtml}
    <div class="ninja-u">${ninjaLine()}</div>
    ${ageHtml}
    ${sellHtml(priced, est, divs[0], median, divs.length)}
    ${drivable ? '<button class="link drive-btn" data-act="impact" title="Searches again without each key modifier (a few trade requests)">What drives the price?</button>' : ''}`;
}

// Цена уника на poe.ninja — одна на название + базу, без роллов: опора «за самую простую копию».
function ninjaLine() {
  const u = state.uniqueNinja;
  if (!u) return '';
  const below = state.est != null && state.est < u.divine * 0.8;
  return `<span title="poe.ninja: the cheapest copies of this unique, any rolls">poe.ninja (any rolls): <b>${money(u.divine)}</b> · ${u.listings.toLocaleString('en-US')} listed</span>`
    + (below ? ' · <span class="down" title="Listings like yours are cheaper than the plain floor — check the filters">below poe.ninja</span>' : '');
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

// Оценка по лотам [{ div, indexed }] — то же правило, что у основной цены: хватает свежих (≤ 3 дней) — по ним;
// медиана до 5 самых дешёвых.
function estimate(lots) {
  const sorted = (lots || []).filter((l) => l.div != null).sort((a, b) => a.div - b.div);
  const fresh = sorted.filter((l) => ageDays(l.indexed) <= 3);
  const head = (fresh.length >= 3 ? fresh : sorted).slice(0, 5).map((l) => l.div);
  return head.length ? head[Math.floor((head.length - 1) / 2)] : null;
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
  const opts = [['Quick sale', quick, `Just under the cheapest active listing — sells fastest. Cheapest listed: ${money(cheapest)}`],
    ['Market', est, 'The estimate above'], ['Patient', patient, `Above the market — wait for a buyer. Median of ${n}: ${money(median)}`]]
    .map(([k, div, title]) => ({ k, title, ...listPrice(div) }))
    // Совпали цены — остаётся Market, а не первая попавшаяся.
    .filter((o, i, a) => o.k === 'Market' || (o.label !== a[1].label && !a.slice(0, i).some((p) => p.label === o.label)));
  return `<div class="grid sell">${opts.map((o) => `
    <div><span class="k">${o.k}</span><span class="v copy" data-note="~price ${o.amount} ${o.cur}" title="${o.title}
Click to copy the price note">${o.label}</span></div>`).join('')}</div>`;
}

// Вклад модов в цену: по очереди ищем без каждого из главных модов (до 4) — насколько падает цена.
const IMPACT_MODS = 4;
let impactSeq = 0;
async function runImpact() {
  if ($('search').classList.contains('dirty')) { setStatus('Filters changed — search first, then check what drives the price'); return; }
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
      const q = await window.pc.quickPrice(state.item, f);
      if (seq !== impactSeq) return;
      const without = estimate(q.lots);
      state.impact[i] = { without, total: q.total, share: without == null ? null : Math.max(0, 1 - without / state.est) };
    } catch (e) {
      if (seq !== impactSeq) return;
      state.impact[i] = { error: errText(e) };
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
  if (d.share == null) return ' <span class="drive" title="Nothing listed without it">—</span>';
  const pct = Math.round(d.share * 100);
  return ` <span class="drive${pct >= 50 ? ' big' : pct < 10 ? ' low' : ''}" title="Without it: ${money(d.without)} · ${d.total.toLocaleString('en-US')} listed">${pct < 5 ? 'adds ~0' : `≈${pct}% of price`}</span>`;
}

// ---- популярные билды (poe.ninja) ----
// Уник — по имени; редкая/магическая — категория, база (если выбрана в шапке) и 2–3 самых важных
// включённых мода: с полным списком модов у ninja почти не остаётся билдов.
function buildsQuery() {
  const { item, filters: f } = state;
  if (!f) return null;
  if (item.rarity === 'Unique' && f.useName) return { uniqueName: item.name };
  if (!['Rare', 'Magic', 'Normal'].includes(item.rarity) || !f.category) return null;
  const mods = f.mods.filter((m) => m.enabled && m.statId && m.tag !== 'pseudo')
    .sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 3).map((m) => m.text.split('\n')[0]);
  return { itemClass: item.itemClass, rarity: item.rarity, baseType: f.useType ? item.baseType : undefined, mods };
}

let buildsSeq = 0;
async function loadBuilds() {
  const q = buildsQuery();
  const box = $('builds');
  if (!q) { box.hidden = true; return; }
  const seq = ++buildsSeq;
  box.hidden = false;
  box.innerHTML = `<div class="sect"><span>Popular builds</span></div><div class="muted center">Loading from poe.ninja…</div>`;
  fit();
  try {
    const b = await window.pc.builds(q);
    if (seq !== buildsSeq) return;
    renderBuilds(b);
  } catch (e) {
    if (seq !== buildsSeq) return;
    box.innerHTML = `<div class="sect"><span>Popular builds</span></div><div class="muted center">poe.ninja: ${esc(errText(e))}</div>`;
  }
  fit();
}

// ---- спрос по категории (poe.ninja): какие базы и моды носят на таких вещах ----
let demandSeq = 0;
async function loadDemand() {
  const { item, filters: f } = state;
  const box = $('demand');
  if (!f || !f.category || !['Rare', 'Magic', 'Normal'].includes(item.rarity)) { box.hidden = true; return; }
  const seq = ++demandSeq;
  box.hidden = false;
  box.innerHTML = `<div class="sect"><span>Demand</span></div><div class="muted center">Loading from poe.ninja…</div>`;
  try {
    const d = await window.pc.demand({ itemClass: item.itemClass, rarity: item.rarity === 'Normal' ? 'Rare' : item.rarity });
    if (seq !== demandSeq) return;
    renderDemand(d);
  } catch (e) {
    if (seq !== demandSeq) return;
    box.innerHTML = `<div class="sect"><span>Demand</span></div><div class="muted center">poe.ninja: ${esc(errText(e))}</div>`;
  }
  fit();
}

// Шаблон мода, как у ninja: «# to maximum Life», «#% to Fire Resistance» — наш шаблон трейда без «(Local)».
const ninjaTemplate = (t) => (t || '').replace(/ \(Local\)$/, '').toLowerCase();

function renderDemand(d) {
  const { item, filters: f } = state;
  if (!d.category || !d.total) {
    $('demand').innerHTML = `<div class="sect"><span>Demand</span></div>${voidState('◇', 'No poe.ninja data', 'poe.ninja has no build stats for this item class.')}`;
    return;
  }
  const mine = new Set(f.mods.filter((m) => m.template).map((m) => ninjaTemplate(m.template)));
  const modRows = d.mods.map((r) => ({ ...r, mine: mine.has(r.name.toLowerCase()) }));
  const hits = modRows.filter((r) => r.mine).length;
  const baseRows = d.bases.map((r) => ({ ...r, mine: r.name === item.baseType }));
  const baseRank = d.bases.findIndex((b) => b.name === item.baseType);
  $('demand').innerHTML = `
    <div class="sect"><span>Demand · ${esc(d.category)}</span></div>
    <div class="bshare">Worn by <b>${fmt(d.total / d.allTotal * 100)}%</b> of level ${demandLevel}+ builds</div>
    <div class="bwhat muted">Your item: ${baseRank >= 0 ? `base #${baseRank + 1}` : 'base not in top 10'} · ${hits} of top ${modRows.length} modifiers</div>
    ${demandList('bases', 'Most worn bases', baseRows)}
    ${demandList('mods', 'Most common modifiers', modRows)}
    <button class="link bopen" data-url="${esc(d.page)}">poe.ninja ↗</button>`;
}

// Список спроса: сразу 5 строк + всё, что есть на вашей вещи; остальное — по «Show all».
const DEMAND_SHOWN = 5;
const openDemand = new Set();
function demandList(key, title, rows) {
  const hidden = rows.filter((r, i) => i >= DEMAND_SHOWN && !r.mine).length;
  const open = openDemand.has(key);
  return `<div class="dcol${open ? ' all' : ''}"><div class="k">${title}</div>${rows.map((r, i) => `
    <div class="brow ${heat(r.pct)}${r.mine ? ' mine' : ''}${i >= DEMAND_SHOWN && !r.mine ? ' more' : ''}"${r.mine ? ' title="Your item has this"' : ''}><span class="bname">${r.mine ? '✓ ' : ''}${esc(r.name)}</span><span class="bpct">${hot(r.pct)}${fmt(r.pct)}%</span>
      <span class="bbar"><i data-w="${Math.min(100, r.pct)}%"></i></span></div>`).join('')}
    ${hidden ? `<button class="link bmore" data-dmore="${key}">${open ? 'Show fewer' : `Show all ${rows.length}`}</button>` : ''}</div>`;
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
  craftFor = state;
  const box = $('craft');
  box.innerHTML = '<div class="sect"><span>Craft</span></div><div class="muted center">Loading mod pool…</div>';
  fit();
  try {
    const r = await window.pc.craft();
    if (craftFor === state) renderCraft(r);
  } catch (e) {
    box.innerHTML = `<div class="sect"><span>Craft</span></div>${voidState('⚠', 'Mod pool not loaded', esc(errText(e)))}`;
  }
  fit();
}

const SIDE = { prefix: 'prefix', suffix: 'suffix' };
// Кандидаты крафта по ключу кнопки «price?»: сколько будет стоить вещь, если этот мод встанет (нижний ролл тира).
const craftCands = new Map();
function craftRows(list) {
  return list.map((c) => {
    const key = String(craftCands.size);
    craftCands.set(key, c);
    const btn = c.stats ? `<button class="link cprice" data-ck="${key}" title="Search for your item with this modifier added (lowest roll of the tier)">price?</button>` : '';
    return `
    <div class="brow ${heat(c.pct)}"><span class="bname">${esc(c.text)}<span class="craft-tier">T${c.tier}/${c.tiers}${c.range ? ` · ${esc(c.range)}` : ''}</span>${c.essence ? `<span class="ess" title="${esc(c.essence.name)} makes a magic item rare with this modifier: ${esc(c.essence.tiers.join(' · '))}">◈ ${esc(c.essence.short)}</span>` : ''}${btn}</span>
      <span class="bpct">${hot(c.pct)}${fmt(c.pct)}%</span><span class="bbar"><i data-w="${Math.min(100, c.pct)}%"></i></span></div>`;
  }).join('');
}

// Цена после крафта: текущие фильтры + мод-кандидат. Тот же стат уже есть (сумма) — минимум растёт на ролл кандидата.
async function priceCraft(b) {
  const c = craftCands.get(b.dataset.ck);
  if (!c || !state) return;
  b.disabled = true;
  b.textContent = '…';
  const f = JSON.parse(JSON.stringify(state.filters));
  for (const s of c.stats) {
    const same = f.mods.find((m) => m.statId === s.statId);
    if (same) { same.enabled = true; same.min = Math.max(Number(same.min) || 0, (same.value || 0) + s.min); }
    else f.mods.push({ statId: s.statId, enabled: true, min: s.min, importance: 3, tag: 'explicit', text: c.text });
  }
  try {
    // Магическая вещь после Regal Orb — уже редкая: ищем среди редких.
    const it = state.item.rarity === 'Magic' ? { ...state.item, rarity: 'Rare' } : state.item;
    const q = await window.pc.quickPrice(it, f);
    const v = estimate(q.lots);
    let html;
    if (v == null) html = '<span class="cpr" title="Nothing like it is listed — could be rare and pricey">none listed</span>';
    else {
      const d = state.est != null ? v - state.est : null;
      const cls = d == null ? '' : d > state.est * 0.1 ? ' up' : d < -state.est * 0.1 ? ' down' : '';
      const delta = d == null ? '' : Math.abs(d) < state.est * 0.1 ? ' (same)' : ` (${d > 0 ? '+' : '−'}${money(Math.abs(d))})`;
      html = `<span class="cpr${cls}" title="${q.total.toLocaleString('en-US')} listed with it · vs your current estimate">≈ ${money(v)}${delta}</span>`;
    }
    b.outerHTML = html;
  } catch (e) {
    b.disabled = false;
    b.textContent = 'price?';
    setStatus(errText(e), true);
  }
  fit();
}

function renderCraft(r) {
  craftCands.clear();
  const head = '<div class="sect"><span>Craft</span></div>';
  if (r.blocked) {
    $('craft').innerHTML = head + voidState('⛓', `${r.blocked} — can't be modified`,
      'Its modifiers are locked. The Price tab shows what it is worth as is.', [['price', 'See price']]);
    return;
  }
  if (r.note) { $('craft').innerHTML = head + voidState('◇', 'No craft tips', esc(r.note)); return; }
  const how = (list) => list.map((h) => `<div class="craft-how">${esc(h)}</div>`).join('');
  const parts = [`<div class="craft-slots">Prefixes <b>${r.max.prefix - r.open.prefix}/${r.max.prefix}</b> · Suffixes <b>${r.max.suffix - r.open.suffix}/${r.max.suffix}</b></div>`];
  for (const s of r.sections) {
    if (s.kind === 'open') {
      parts.push(`<div class="craft-sec"><div class="k">${s.count} free ${SIDE[s.side]}${s.count > 1 ? 'es' : ''}</div>${how(s.how)}
        ${s.candidates.length ? `<div class="craft-sub">Popular ${SIDE[s.side]}es that can roll here (best tier for this item level):</div>${craftRows(s.candidates)}`
          : '<div class="craft-sub">No popular modifiers left for this side.</div>'}</div>`);
    } else if (s.kind === 'replace') {
      const w = s.weak;
      parts.push(`<div class="craft-sec"><div class="k">Full — replace the weakest ${SIDE[w.side]}</div>
        <div class="craft-weak">${esc(w.text)} <span class="craft-tier">${w.tier ? `T${w.tier}` : ''}${w.pct ? ` · ${fmt(w.pct)}% builds` : ''}</span></div>${how(s.how)}
        ${s.candidates.length ? `<div class="craft-sub">Could become:</div>${craftRows(s.candidates)}` : ''}</div>`);
    } else if (s.kind === 'desecrate') {
      parts.push(`<div class="craft-sec"><div class="k">Desecration</div>${how(s.how)}<div class="craft-sub">Popular desecrated modifiers for this base:</div>${craftRows(s.candidates)}</div>`);
    } else if (s.kind === 'upgrade') {
      parts.push(`<div class="craft-sec"><div class="k">Make it rare first</div>${how(s.how)}</div>`);
    } else if (s.kind === 'perfect') {
      parts.push(`<div class="craft-sec"><div class="k">Perfect Essence</div><div class="craft-sub">Removes a random modifier and adds its own guaranteed one:</div>${how(s.how)}</div>`);
    } else if (s.kind === 'keep') {
      parts.push('<div class="craft-sec"><div class="k">Full — all modifiers are top tier</div><div class="craft-sub">Nothing worth replacing.</div></div>');
    } else if (s.kind === 'cheap') {
      parts.push(`<div class="craft-sec"><div class="k">Cheap and safe</div>${how(s.how)}</div>`);
    }
  }
  if (r.theme && r.theme.length) {
    parts.splice(1, 0, `<div class="craft-theme" title="Demand % below is among ${r.themeBuilds} builds that wear this item class with these modifiers">Demand among builds using <b>${r.theme.map(esc).join('</b> + <b>')}</b></div>`);
  }
  parts.push(`<div class="craft-foot">Mod pool: game files (RePoE). Roll chances aren't shown — PoE 2 files have no modifier weights.<br>% = share of those builds using the modifier (poe.ninja). «price?» — what your item would cost with it.</div>`);
  $('craft').innerHTML = head + parts.join('');
}

// Насколько востребовано: < 10% — приглушаем (почти никому не нужно), ≥ 60% — подсвечиваем (нужно почти всем).
const heat = (pct) => (pct >= 60 ? 'hot' : pct < 10 ? 'cold' : '');
const hot = (pct) => (pct >= 60 ? '<span class="flame" title="Most builds use this">🔥</span>' : '');

function buildRows(rows) {
  return rows.map((r) => `
    <div class="brow ${heat(r.pct)}"><span class="bname">${esc(r.name)}</span><span class="bpct">${hot(r.pct)}${fmt(r.pct)}%</span>
      <span class="bbar"><i data-w="${Math.min(100, r.pct)}%"></i></span></div>`).join('');
}

// Чей спрос считаем: персонажи 80+ (все, кого видит poe.ninja), 90+ или 95+ — чем выше, тем «премиальнее» моды.
let demandLevel = 90;
window.pc.demandLevel().then((l) => { demandLevel = l; }).catch(() => {});
const levelSeg = () => `<div class="lvl-row"><span class="muted small">Characters</span><div class="seg lvl" title="Whose gear counts: higher level = players who pay for exact modifiers">${[80, 90, 95].map((l) =>
  `<button data-lvl="${l}"${l === demandLevel ? ' class="on"' : ''}>${l}+</button>`).join('')}</div></div>`;

function renderBuilds(b) {
  // Бейдж на вкладке Demand — чтобы фичу замечали, не открывая вкладку.
  const pct = b.allTotal ? b.total / b.allTotal * 100 : null;
  const anyHot = [...b.classes, ...b.skills].some((r) => r.pct >= 60);
  // Уровень спроса по числу персонажей (не по %: у нишевых вещей процент всегда мал, а спрос реальный).
  const lvl = !b.total ? null : b.total >= 2500 ? 'high' : b.total >= 300 ? 'med' : 'low';
  const badge = $('demandBadge');
  badge.className = `badge ${lvl || ''}`;
  badge.textContent = lvl ? { high: '🔥 High', med: 'Med', low: 'Low' }[lvl] : '';
  badge.title = lvl ? `${b.total.toLocaleString('en-US')} level ${demandLevel}+ characters on poe.ninja use this${pct != null ? ` (${fmt(pct)}% of builds)` : ''}${anyHot ? ' · one build archetype dominates' : ''}` : '';
  const share = b.allTotal ? `<b>${fmt(b.total / b.allTotal * 100)}%</b> of builds · ${b.total.toLocaleString('en-US')} characters`
    : `${b.total.toLocaleString('en-US')} characters`;
  const what = b.filters.filter(([k]) => k !== 'min-level').map(([, v]) => v).join(' + ');
  $('builds').innerHTML = `
    <div class="sect"><span>Popular builds</span></div>
    ${levelSeg()}
    <div class="bshare">${share}</div>
    <div class="bwhat muted" title="poe.ninja filter">${esc(what)}</div>
    ${b.total ? `<div class="bcols">
      <div><div class="k">Ascendancy</div>${buildRows(b.classes.slice(0, 4))}</div>
      <div><div class="k">Main skill</div>${buildRows(b.skills.slice(0, 4))}</div>
    </div>` : voidState('◇', 'No builds use this', 'No characters on poe.ninja wear this combination.')}
    ${b.ignored && b.ignored.length ? `<div class="muted small">Not on poe.ninja: ${esc(b.ignored.map((x) => Object.values(x)[0]).join(' · '))}</div>` : ''}
    <button class="link bopen" data-url="${esc(b.page)}">poe.ninja ↗</button>`;
}

// ---- фильтры ----
const TAG_LABEL = { pseudo: 'total', rune: 'rune', implicit: 'implicit', crafted: 'crafted', desecrated: 'desecrated',
  fractured: 'fractured', enchant: 'enchant' };

// Шкала важности мода для цены: 0–3 деления (ключевой для слота × качество тира). Ключевые — золотом.
const IMPACT = ['minor', 'low', 'medium', 'high'];
function meter(m) {
  if (m.importance == null) return '';
  const n = m.importance >= 2.4 ? 3 : m.importance >= 1.6 ? 2 : m.importance >= 0.8 ? 1 : 0;
  const title = `Price impact: ${IMPACT[n]}${m.key ? ' — key modifier for this slot' : ''}${m.tier ? `, tier ${m.tier}` : ''}`;
  return `<span class="imp i${n}${m.key ? ' key' : ''}" title="${title}"><i></i><i></i><i></i></span>`;
}

// Строка мода — ровными колонками, как подсказка в игре: [галочка][важность][тир][текст · категория][мин].
// Категория (desecrated, rune…) — после текста, чтобы теги разной ширины не сдвигали сам мод.
// Диапазон тира и качество ролла: «36–40», у почти максимального — золотая пометка max.
function rollInfo(m) {
  if (!m.range || m.roll == null) return '';
  // Пометка max — только у максимального ролла лучшего тира (T1): на других тирах она мало что значит.
  const max = m.tier === 1 && m.roll >= 0.9 ? '<span class="maxroll" title="Near max roll of the top tier — usually worth more">max</span>' : '';
  return ` <span class="rng" title="Tier range · roll ${Math.round(m.roll * 100)}%">${fmt(m.range.lo)}${m.range.lo < 0 ? ' to ' : '–'}${fmt(m.range.hi)}</span>${max}`;
}

// Какие суммы раскрыты (сбрасывается на новом предмете).
const openSums = new Set();

function modRow(m, i) {
  if (!m.statId) {
    return `<div class="mod nomatch" title="This modifier has no trade site filter">
      <label><span class="cb"></span><span class="imp"></span><span class="tcol">?</span><span class="txt">${esc(m.text)}</span></label></div>`;
  }
  const tier = m.tag === 'pseudo' ? '<span class="tcol sigma" title="Total from all modifiers">Σ</span>'
    : `<span class="tcol">${m.tier ? `<span class="tag tier${m.tier <= 2 ? ' top' : ''}">T${m.tier}</span>` : ''}</span>`;
  // Одинаковые моды — каждый своей строкой, фильтр общий: трейд ищет по сумме.
  const from = m.parts ? ` title="${esc(m.parts.map((p) => `${p.text}${p.tier ? ` (T${p.tier})` : ''}`).join('\n'))}"` : '';
  const cat = (m.tag !== 'explicit' && m.tag !== 'pseudo' ? ` <span class="tag ${esc(m.tag)}">${esc(TAG_LABEL[m.tag] || m.tag)}</span>` : '')
    // Спрос с poe.ninja: массовый мод — повод включить его, даже если тир слабый.
    + (m.demand >= 30 ? ` <span class="dem${m.demand >= 60 ? ' hot' : ''}" title="${fmt(m.demand)}% of level ${demandLevel}+ builds wearing this item class have this modifier (poe.ninja)">${m.demand >= 60 ? '🔥 ' : ''}${fmt(m.demand)}% builds</span>` : '');
  const text = m.tag === 'pseudo' ? m.text.replace(/^Σ /, '') : m.text;
  return `<div class="mod t-${esc(m.tag)}${m.enabled ? '' : ' off'}" data-i="${i}">
      <label><input type="checkbox" data-k="enabled"${m.enabled ? ' checked' : ''}>${meter(m) || '<span class="imp"></span>'}${tier}
        <span class="txt"${from}>${esc(text)}${m.merged ? `<span class="sum-v"> = ${fmt(m.value)}</span>` : ''}${cat}${rollInfo(m)}${driveChip(i)}</span></label>
      ${m.option ? '' : `<input type="number" data-k="min" step="any" placeholder="min" value="${m.min == null ? '' : m.min}">`}
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
    rows.push(`<div class="sum-toggle" data-sum="${esc(m.statId)}">${open ? '▾' : '▸'} ${parts.length} mod${parts.length > 1 ? 's' : ''} in this total</div>`);
    if (open) rows.push(`<div class="sum-parts">${parts.map(([p, j]) => modRow(p, j)).join('')}</div>`);
  });
  $('mods').innerHTML = rows.join('');
  // Защита/DPS, уровни и гнёзда выбираются прямо в подсказке под шапкой — здесь валюта цены и «онлайн».
  $('misc').innerHTML = `
    <div class="seg" title="Which currency listings to search">${CURRENCIES.map(([id, label]) =>
      `<button data-cur="${id}"${f.priceCurrency === id ? ' class="on"' : ''}>${label}</button>`).join('')}</div>
    <label class="opt${f.online ? '' : ' off'}"><input type="checkbox" data-o="online"${f.online ? ' checked' : ''}><span title="Instant Buyout or seller online — like the trade site default">Buyable now</span></label>
    <label class="opt${f.flex ? '' : ' off'}"><input type="checkbox" data-o="flex"${f.flex ? ' checked' : ''}><span title="With 3+ minor modifiers checked, find items that have all but one of them (key modifiers stay required)">Allow 1 minor mod missing</span></label>`;
  // Моды-варианты (Legacy у Mageblood) ищутся «любые N из выбранных»: порог можно поменять руками.
  const opts = f.mods.filter((m) => m.enabled && m.option).length;
  if (opts > 1) {
    $('misc').insertAdjacentHTML('afterbegin', `<label class="opt">Match ≥ <input type="number" data-optmin min="1" max="${opts}"
      value="${Math.min(opts, f.optionMin || opts)}"> of ${opts} checked</label>`);
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
    <div class="sect"><span>Cheapest listings <b class="cnt">${r.total.toLocaleString('en-US')}</b></span></div>
    <div class="lots${showAllLots ? ' all' : ''}">${r.listings.map((l, i) => `
      <div class="lot${i >= LOTS_SHOWN ? ' more' : ''}${ageClass(l.indexed)}" data-i="${i}" title="${l.whisper ? 'Copy whisper to seller' : 'Instant buyout — opens the trade site (Travel to Hideout)'}">
        <span class="chip">${l.currencyImage ? `<img src="${esc(l.currencyImage)}" alt="">` : ''}${fmt(l.amount)}${l.currencyImage ? '' : ' ' + esc(l.currencyName)}</span>
        <span class="eq">${cmpBadge(l)}${l.divine != null && !sameUnit(l) ? '≈ ' + money(l.divine) : ''}</span>
        <span class="seller">${l.whisper ? '' : '<b class="ib" title="Instant buyout">⚡</b>'}<span class="dot${l.online ? ' on' : ''}"></span>${esc(l.seller)}</span>
        <span class="age">${l.indexed ? ago(l.indexed) : ''}</span>
        <span class="acts">${l.whisper ? '<i data-a="whisper" title="Whisper in game — opens chat with the message, you press Enter"><svg viewBox="0 0 16 16"><path d="M2 3h12v8H7l-3 3v-3H2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></i>' : ''}<i data-a="site" title="Open this listing on the trade site">↗</i></span>
      </div>`).join('')}
    </div>
    ${r.listings.length > LOTS_SHOWN ? `<button class="link lots-more">${showAllLots ? 'Show fewer' : `Show all ${r.listings.length}`}</button>` : ''}`;
  const more = box.querySelector('.lots-more');
  if (more) more.addEventListener('click', () => { showAllLots = !showAllLots; renderResults(r); fit(); });
  box.querySelectorAll('.lot').forEach((row) => row.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-a]');
    if (act) {
      const l = r.listings[+row.dataset.i];
      if (act.dataset.a === 'site') await openListing(r, l);
      else if (!(await window.pc.whisperGame(l.whisper))) setStatus('Whisper copied — switch to the game and paste it into chat (Enter, Ctrl+V)');
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
    setStatus('Whisper copied — paste it into game chat (Enter, Ctrl+V)');
    fit();
  }));
  box.querySelectorAll('.lot').forEach((row) => {
    row.addEventListener('mouseenter', () => showCompare(r.listings[+row.dataset.i], row));
    row.addEventListener('mouseleave', hideCompare);
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
  setStatus(l.whisper ? 'Opened on the trade site' : 'Opened on the trade site — use Travel to Hideout there');
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
  const theirTexts = new Set(t.mods.map((m) => m.text.toLowerCase()));
  // better / worse / same — мод есть у обоих; extra — у нас такого нет; '' — не сравнить (нет id стата).
  const classify = (m) => {
    if (ourOptions.has(m.text.toLowerCase())) return 'same';
    if (!m.statId) return '';
    const k = key(m.statId);
    return ours.has(k) ? compareClass(theirs.get(k), ours.get(k)) || 'same' : 'extra';
  };
  const missing = mods.filter((m) => m.statId && m.tag !== 'pseudo'
    && (m.option ? !theirTexts.has(m.text.toLowerCase()) : !theirs.has(key(m.statId))));
  // Порядок наших модов — чтобы карточка конкурента шла в том же порядке, что и фильтры.
  const order = new Map();
  mods.forEach((m) => { if (m.statId && !order.has(key(m.statId))) order.set(key(m.statId), order.size); });
  return { classify, missing, key, ours, order };
}

// «▲2 ▼1» в строке лота: сколько модов у конкурента лучше и хуже ваших — без наведения.
function cmpBadge(l) {
  if (!l.tip || !state || !state.filters) return '';
  const { classify, key } = compareModel(l.tip);
  const seen = new Set(); // одинаковые моды на трейде — одна сумма, считаем один раз
  let better = 0;
  let worse = 0;
  for (const m of l.tip.mods) {
    if (!m.statId || seen.has(key(m.statId))) continue;
    seen.add(key(m.statId));
    const c = classify(m);
    if (c === 'better') better++;
    else if (c === 'worse') worse++;
  }
  if (!better && !worse) return '';
  return `<span class="cmpc" title="Modifiers better / worse than yours">${better ? `<i class="b">▲${better}</i>` : ''}${worse ? `<i class="w">▼${worse}</i>` : ''}</span>`;
}

function compareClass(theirs, ours) {
  if (theirs == null || ours == null) return '';
  if (theirs > ours * 1.005) return 'better';
  if (theirs < ours * 0.995) return 'worse';
  return 'same';
}

function showCompare(l, row) {
  const t = l.tip;
  if (!t) return;
  const { item } = state;
  const { classify, missing: miss, key, ours, order } = compareModel(t);
  const mark = { better: '▲', worse: '▼', extra: '+', same: '' };
  // Совпадающие моды — в порядке нашей вещи, остальные (которых у нас нет) — в конце; у ▲▼ — наше значение.
  const rank = (m) => (m.statId && order.has(key(m.statId)) ? order.get(key(m.statId)) : 1e3);
  const modLines = t.mods.map((m, i) => ({ m, i })).sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i).map(({ m }) => {
    const cls = classify(m);
    const mine = (cls === 'better' || cls === 'worse') && ours.get(key(m.statId));
    return `<div class="cm ${cls} d-${esc(m.domain)}">${mark[cls] ? `<i>${mark[cls]}</i>` : ''}${esc(m.text)}${mine ? `<span class="yours">yours ${fmt(mine)}</span>` : ''}</div>`;
  }).join('');
  const missing = miss.map((m) => `<div class="cm missing"><i>✗</i>${esc(m.text.split('\n').join(' + '))}</div>`).join('');

  const ourProps = new Map(item.properties.map((p) => [p.k, propNum(p.v)]));
  const props = t.props.map((p) => {
    const cls = ourProps.has(p.k) ? compareClass(propNum(p.v), ourProps.get(p.k)) : '';
    const yours = cls === 'better' || cls === 'worse' ? `<span class="yours">yours ${fmt(ourProps.get(p.k))}</span>` : '';
    return `<div class="cm ${cls}">${mark[cls] ? `<i>${mark[cls]}</i>` : ''}${esc(p.k)}: <b>${esc(p.v)}</b>${yours}</div>`;
  });
  if (t.ilvl) {
    const cls = compareClass(t.ilvl, item.ilvl);
    props.push(`<div class="cm ${cls}">${mark[cls] ? `<i>${mark[cls]}</i>` : ''}Item Level: <b>${t.ilvl}</b>${cls ? `<span class="yours">yours ${item.ilvl}</span>` : ''}</div>`);
  }

  const two = t.name && t.base && t.name !== t.base;
  const html = `
    <div class="banner mini ${esc(t.rarity)}${two ? '' : ' single'}"><div class="bn-name">${esc(t.name || t.base)}</div>${two ? `<div class="bn-base">${esc(t.base)}</div>` : ''}</div>
    <div class="cmp-body">
      ${props.join('')}
      ${props.length ? '<div class="tt"><div class="sep"></div></div>' : ''}
      ${modLines}
      ${t.corrupted ? '<div class="cm corrupt">Corrupted</div>' : ''}
      ${missing ? `<div class="cmp-miss">Yours has, theirs doesn't:</div>${missing}` : ''}
      <div class="cmp-legend"><span class="better">▲ better</span> · <span class="worse">▼ worse</span> · <span class="extra">+ you don't have</span> — than your item</div>
    </div>`;
  // Карточка — в отдельном окне сбоку (не закрывает оверлей), напротив строки лота.
  window.pc.compareShow(html, row.getBoundingClientRect().top);
}

function hideCompare() {
  window.pc.compareHide();
}

// Фильтры поменяли после поиска — кнопка Search подсвечивается: результат на экране уже не про них.
function markDirty() {
  // Фильтры поменялись — прежний «вклад модов» больше не про них.
  if (state.impact) { impactSeq++; state.impact = null; document.querySelectorAll('#mods .drive').forEach((x) => x.remove()); }
  const b = $('search');
  if (!b.classList.contains('dirty')) { b.classList.add('dirty'); b.textContent = 'Search · filters changed'; }
}

async function runSearch(relax = false) {
  const seq = ++searchSeq;
  impactSeq++;
  state.impact = null;
  state.est = null;
  $('search').classList.remove('dirty');
  $('search').textContent = 'Search';
  $('search').disabled = true;
  setStatus('');
  renderSearchingHero();
  fit();
  try {
    const r = await window.pc.search(state.item, state.filters, relax);
    if (seq !== searchSeq) return;
    const notes = [];
    if (r.dropped && r.dropped.length) {
      state.filters = r.filters;
      renderFilters();
      renderTooltip();
      renderBanner(); // ослабление могло снять точную базу
      notes.push(`Too few listings — relaxed: ${r.dropped.join(' · ')}`);
    }
    if (r.relaxStopped) notes.push(`Couldn't relax filters further: ${r.relaxStopped}`);
    setNote(notes.join('\n'));
    rates = r.rates || rates;
    setStatus(''); // убрать «ждём лимит», если было
    state.tradeUrl = r.url;
    $('open').hidden = false;
    renderTradeHero(r);
    renderResults(r);
  } catch (e) {
    if (seq !== searchSeq) return;
    $('results').hidden = true;
    $('hero').innerHTML = voidState('⚠', 'Search failed', esc(errText(e)), [['retry', 'Try again']]);
  } finally {
    if (seq === searchSeq) $('search').disabled = false;
    fit();
  }
}

window.pc.onItem((data) => {
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
  $('results').hidden = true;
  $('hero').hidden = true;
  $('builds').hidden = true;
  $('open').hidden = true;
  $('demandBadge').textContent = '';
  renderLeagues();
  renderBanner();
  fullNameTitles();
  renderTooltip();
  if (state.exchange) renderExchangeHero();
  renderFilters();
  if (!state.exchange && !state.searchable) setStatus('No price data for this item');
  fit();
  // Вкладки — только для предметов с поиском на трейде; валюте хватает одной.
  $('tabs').hidden = !state.searchable;
  setTab('price');
  if (state.searchable) runSearch(true);
  loadBuilds();
  loadDemand();
  loadUniqueNinja();
});

$('hero').addEventListener('click', (e) => {
  const note = e.target.closest('[data-note]');
  if (note) {
    window.pc.copy(note.dataset.note);
    setStatus(`Copied "${note.dataset.note}" — paste it as the price note`);
    fit();
    return;
  }
  const b = e.target.closest('[data-unit]');
  if (!b || !state.exchange) return;
  unit = b.dataset.unit;
  try { localStorage.setItem('exchangeUnit', unit); } catch {}
  renderExchangeHero();
});

$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) setTab(b.dataset.tab);
});

$('craft').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ck]');
  if (b) priceCraft(b);
});

$('tab-demand').addEventListener('click', async (e) => {
  const lv = e.target.closest('[data-lvl]');
  if (lv) {
    demandLevel = +lv.dataset.lvl;
    await window.pc.setDemandLevel(demandLevel);
    craftFor = null; // тема крафта — тоже по новому уровню
    loadBuilds();
    loadDemand();
    return;
  }
  const more = e.target.closest('[data-dmore]');
  if (more) {
    const col = more.closest('.dcol');
    const key = more.dataset.dmore;
    if (openDemand.has(key)) openDemand.delete(key); else openDemand.add(key);
    col.classList.toggle('all', openDemand.has(key));
    more.textContent = openDemand.has(key) ? 'Show fewer' : `Show all ${col.querySelectorAll('.brow').length}`;
    fit();
    return;
  }
  const b = e.target.closest('.bopen');
  if (b) window.pc.openUrl(b.dataset.url);
});

window.pc.onStatus((s) => { setStatus(s.error || s.text, !!s.error); fit(); });

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
  const m = state.filters.mods[+row.dataset.i];
  if (e.target.dataset.k === 'enabled') {
    m.enabled = e.target.checked;
    row.classList.toggle('off', !m.enabled);
    if (m.option) renderFilters(); // пересчитать «Match ≥ N of M»
  } else if (e.target.dataset.k === 'min') {
    m.min = e.target.value === '' ? null : Number(e.target.value);
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
  filterByRef(t.dataset.ref)[t.dataset.f] = t.value === '' ? null : Number(t.value);
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
  if (t.dataset.o) state.filters[t.dataset.o] = t.checked;
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

$('search').addEventListener('click', () => { setNote(''); runSearch(); loadBuilds(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && state && state.searchable) { setNote(''); runSearch(); }
  if (e.key === 'Escape') {
    // Сначала закрываем открытый список лиг, а не всё окно.
    if (!$('leagueMenu').hidden) toggleLeagueMenu(false);
    else window.pc.hide();
  }
});
$('open').addEventListener('click', () => state.tradeUrl && window.pc.openUrl(state.tradeUrl));
$('close').addEventListener('click', () => window.pc.hide());
$('leagueBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleLeagueMenu(); });
$('leagueMenu').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-league]');
  if (!b) return;
  toggleLeagueMenu(false);
  if (b.dataset.league === state.league) return;
  state.league = b.dataset.league;
  renderLeagues();
  await window.pc.setLeague(state.league);
  if (state.searchable) runSearch();
});
// Клик мимо — закрыть список.
document.addEventListener('click', (e) => { if (!e.target.closest('#ldrop')) toggleLeagueMenu(false); });

// CSP окна запрещает инлайн-стили (style="…"), поэтому ширину полос и заглушек задаём через data-w после вставки.
new MutationObserver(() => {
  document.querySelectorAll('[data-w]').forEach((el) => { el.style.width = el.dataset.w; el.removeAttribute('data-w'); });
}).observe(document.body, { childList: true, subtree: true });
