const $ = (id) => document.getElementById(id);
let state = null; // { item, exchange, filters, searchable, league, leagues, rates, priceCurrency }
let rates = {}; // { chaos, exalted } за 1 div, mirror — div за 1 зеркало
let searchSeq = 0;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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

function spark(data) {
  if (!data || data.length < 2) return '';
  const w = 56, h = 16;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * h}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}"><polyline points="${pts}"/></svg>`;
}

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

function renderLeagues() {
  $('league').innerHTML = state.leagues.map((l) => `<option${l === state.league ? ' selected' : ''}>${esc(l)}</option>`).join('');
}

// Свойство подсказки → фильтр защиты (state.filters.props по key).
const PROP_KEY = { Armour: 'ar', 'Evasion Rating': 'ev', 'Energy Shield': 'es', Spirit: 'spirit' };

// Значение в подсказке, по которому можно искать: клик включает, рядом — граница поиска.
// ref: 'p:<i>' — фильтр защиты/DPS, 'm:<key>' — уровень/ilvl/гнёзда.
function pick(ref, label, valueHtml, filter, op, field) {
  if (!filter || !state.searchable) return `${label}: ${valueHtml}`;
  const bound = filter.enabled
    ? ` <span class="tp-op">${op}</span><input type="number" class="tp-in" data-ref="${ref}" data-f="${field}" value="${filter[field] ?? ''}">`
    : '';
  return `<span class="tp${filter.enabled ? ' on' : ''}" data-ref="${ref}" title="${filter.enabled ? 'Searching by this — click to ignore' : 'Click to search by this'}">${label}: ${valueHtml}${bound}</span>`;
}

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
      return i < 0 ? `${esc(p.k)}: ${v}` : pick(`p:${i}`, esc(p.k), v, props[i], '≥', 'min');
    });
    // DPS в игровой подсказке нет — показываем отдельной строкой, чтобы по нему тоже можно было искать.
    const dps = ['dps', 'pdps', 'edps'].map(propIdx).filter((i) => i >= 0)
      .map((i) => pick(`p:${i}`, props[i].label, `<b>${fmt(props[i].value)}</b>`, props[i], '≥', 'min'));
    if (dps.length) plines.push(dps.join(' · '));
    if (plines.length) lines.push(plines.join('<br>'));

    const meta = [];
    if (item.requires) {
      const rest = esc(item.requires.replace(/^Level \d+,?\s*/, ''));
      meta.push(item.reqLevel
        ? `Requires: ${pick('m:reqLevel', 'Level', `<b>${item.reqLevel}</b>`, f.reqLevel, '≤', 'max')}${rest ? `, <b>${rest}</b>` : ''}`
        : `Requires: <b>${esc(item.requires)}</b>`);
    }
    if (item.ilvl) meta.push(pick('m:ilvl', 'Item Level', `<b>${item.ilvl}</b>`, f.ilvl, '≥', 'min'));
    if (item.gemLevel) meta.push(pick('m:gemLevel', 'Level', `<b>${item.gemLevel}</b>`, f.gemLevel, '≥', 'min'));
    if (item.sockets) meta.push(pick('m:sockets', 'Sockets', `<b>${'◆ '.repeat(item.sockets).trim()}</b>`, f.sockets, '≥', 'min'));
    if (meta.length) lines.push(meta.join(' · '));
  }
  const flags = [];
  if (item.unidentified) flags.push('<span class="corrupt">Unidentified</span>');
  if (item.corrupted) flags.push('<span class="corrupt">Corrupted</span>');
  if (item.mirrored) flags.push('<span class="cls">Mirrored</span>');
  if (flags.length) lines.push(flags.join(' · '));
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

function renderExchangeHero() {
  const x = state.exchange;
  const stack = state.item.stack && state.item.stack.size > 1 ? state.item.stack.size : 0;
  const dir = x.change == null ? '' : x.change >= 0 ? 'up' : 'down';
  $('hero').hidden = false;
  $('hero').innerHTML = `
    <div class="k">Price per unit</div>
    <div class="big">${x.image ? `<img src="${esc(x.image)}" alt="">` : ''}${money(x.divine)}</div>
    <div class="alt">${alt(x.divine, x.id)}</div>
    <div class="grid">
      <div><span class="k">${stack ? `Stack ×${stack}` : 'Stack'}</span><span class="v">${stack ? money(x.divine * stack) : '—'}</span></div>
      <div><span class="k">7 days</span><span class="v ${dir}">${x.change == null ? '—' : `${x.change >= 0 ? '+' : ''}${fmt(x.change)}%`} ${spark(x.spark)}</span></div>
      <div><span class="k">24h volume</span><span class="v">${fmt(x.volume)} div</span></div>
    </div>`;
}

function renderSearchingHero() {
  $('hero').hidden = false;
  $('hero').innerHTML = `<div class="k">Estimated price</div><div class="big wait">…</div><div class="alt">Searching the trade site</div>`;
}

// Оценка — медиана самых дешёвых (до 5) лотов: один демпингующий продавец её не уронит.
function renderTradeHero(r) {
  const divs = r.listings.map((l) => l.divine).filter((v) => v != null).sort((a, b) => a - b);
  if (!divs.length) {
    $('hero').innerHTML = `<div class="k">Estimated price</div><div class="big wait" style="animation:none">—</div>
      <div class="alt">Nothing found — uncheck some filters or lower the minimums</div>`;
    return;
  }
  const head = divs.slice(0, 5);
  const est = head[Math.floor((head.length - 1) / 2)];
  const median = divs[Math.floor((divs.length - 1) / 2)];
  $('hero').innerHTML = `
    <div class="k">Estimated price</div>
    <div class="big">${money(est)}</div>
    <div class="alt">${alt(est)}</div>
    <div class="grid">
      <div><span class="k">Cheapest</span><span class="v">${money(divs[0])}</span></div>
      <div><span class="k">Median of ${divs.length}</span><span class="v">${money(median)}</span></div>
      <div><span class="k">Listings</span><span class="v">${r.total.toLocaleString('en-US')}</span></div>
    </div>`;
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

function modRow(m, i) {
  if (!m.statId) {
    return `<div class="mod nomatch" title="This modifier has no trade site filter">
      <label><span class="tag">?</span><span>${esc(m.text)}</span></label></div>`;
  }
  const tags = [
    meter(m),
    m.tier ? `<span class="tag tier${m.tier <= 2 ? ' top' : ''}">T${m.tier}</span>` : '',
    m.tag !== 'explicit' ? `<span class="tag ${esc(m.tag)}">${esc(TAG_LABEL[m.tag] || m.tag)}</span>` : '',
  ].join('');
  return `<div class="mod t-${esc(m.tag)}${m.enabled ? '' : ' off'}" data-i="${i}">
      <label><input type="checkbox" data-k="enabled"${m.enabled ? ' checked' : ''}>${tags}
        <span>${esc(m.text)}${m.merged ? `<span class="sum-v"> = ${fmt(m.value)}</span>` : ''}</span></label>
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
  $('mods').innerHTML = f.mods.map(modRow).join('');
  // Защита/DPS, уровни и гнёзда выбираются прямо в подсказке под шапкой — здесь валюта цены и «онлайн».
  $('misc').innerHTML = `
    <div class="seg" title="Which currency listings to search">${CURRENCIES.map(([id, label]) =>
      `<button data-cur="${id}"${f.priceCurrency === id ? ' class="on"' : ''}>${label}</button>`).join('')}</div>
    <label class="opt${f.online ? '' : ' off'}"><input type="checkbox" data-o="online"${f.online ? ' checked' : ''}>Online only</label>`;
}

// ---- лоты ----
// Лот и так в той валюте, в которой мы показываем, — «≈» не нужен.
function sameUnit(l) {
  const unit = money(l.divine).split(' ')[1];
  return (unit === 'chaos' && l.currency === 'chaos') || (unit === 'div' && l.currency === 'divine');
}

function renderResults(r) {
  const box = $('results');
  box.hidden = !r.listings.length;
  if (!r.listings.length) return;
  box.innerHTML = `
    <div class="sect"><span>Cheapest listings</span></div>
    <div class="lots">${r.listings.map((l, i) => `
      <div class="lot" data-i="${i}" title="Copy whisper to seller">
        <span class="chip">${l.currencyImage ? `<img src="${esc(l.currencyImage)}" alt="">` : ''}${fmt(l.amount)}${l.currencyImage ? '' : ' ' + esc(l.currencyName)}</span>
        <span class="eq">${l.divine != null && !sameUnit(l) ? '≈ ' + money(l.divine) : ''}</span>
        <span class="seller"><span class="dot${l.online ? ' on' : ''}"></span>${esc(l.seller)}</span>
        <span class="age">${l.indexed ? ago(l.indexed) : ''}</span>
      </div>`).join('')}
    </div>`;
  box.querySelectorAll('.lot').forEach((row) => row.addEventListener('click', () => {
    window.pc.copy(r.listings[+row.dataset.i].whisper);
    box.querySelectorAll('.lot.copied').forEach((x) => x.classList.remove('copied'));
    row.classList.add('copied');
    setStatus('Whisper copied — paste it into game chat (Enter, Ctrl+V)');
    fit();
  }));
}

async function runSearch(relax = false) {
  const seq = ++searchSeq;
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
      notes.push(`Too few listings — relaxed: ${r.dropped.join(' · ')}`);
    }
    if (r.relaxStopped) notes.push(`Couldn't relax filters further: ${r.relaxStopped}`);
    setNote(notes.join('\n'));
    rates = r.rates || rates;
    state.tradeUrl = r.url;
    $('open').hidden = false;
    renderTradeHero(r);
    renderResults(r);
  } catch (e) {
    if (seq !== searchSeq) return;
    $('hero').hidden = true;
    setStatus(String(e.message || e).replace(/^Error invoking remote method '\w+': (Error: )?/, ''), true);
  } finally {
    if (seq === searchSeq) $('search').disabled = false;
    fit();
  }
}

window.pc.onItem((data) => {
  state = data;
  rates = data.rates || {};
  if (state.filters) state.filters.priceCurrency = data.priceCurrency || 'any';
  searchSeq++;
  setStatus('');
  setNote('');
  $('results').hidden = true;
  $('hero').hidden = true;
  $('open').hidden = true;
  renderLeagues();
  renderBanner();
  renderTooltip();
  if (state.exchange) renderExchangeHero();
  renderFilters();
  if (!state.exchange && !state.searchable) setStatus('No price data for this item');
  fit();
  if (state.searchable) runSearch(true);
});

window.pc.onStatus((s) => { setStatus(s.error || s.text, !!s.error); fit(); });

// ---- изменения фильтров ----
$('mods').addEventListener('input', (e) => {
  const row = e.target.closest('.mod');
  if (!row) return;
  const m = state.filters.mods[+row.dataset.i];
  if (e.target.dataset.k === 'enabled') {
    m.enabled = e.target.checked;
    row.classList.toggle('off', !m.enabled);
  } else if (e.target.dataset.k === 'min') {
    m.min = e.target.value === '' ? null : Number(e.target.value);
  }
});

// ref из подсказки → объект фильтра: 'p:2' — state.filters.props[2], 'm:ilvl' — state.filters.ilvl.
function filterByRef(ref) {
  const [kind, key] = ref.split(':');
  return kind === 'p' ? state.filters.props[+key] : state.filters[key];
}

$('tooltip').addEventListener('click', (e) => {
  if (e.target.closest('.tp-in')) return; // клик в поле границы — не переключаем
  const el = e.target.closest('.tp');
  if (!el) return;
  const flt = filterByRef(el.dataset.ref);
  flt.enabled = !flt.enabled;
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
  filterByRef(t.dataset.ref)[t.dataset.f] = t.value === '' ? null : Number(t.value);
});

$('misc').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cur]');
  if (!b) return;
  state.filters.priceCurrency = b.dataset.cur;
  window.pc.setPriceCurrency(b.dataset.cur);
  renderFilters();
});

$('misc').addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.o) state.filters[t.dataset.o] = t.checked;
  if (t.type === 'checkbox') t.closest('.opt').classList.toggle('off', !t.checked);
});

$('banner').addEventListener('click', (e) => {
  const el = e.target.closest('.pick');
  if (!el || !state || !state.searchable) return;
  const f = state.filters;
  const isName = el.id === 'name' && state.item.rarity === 'Unique' && $('base').textContent;
  if (isName) f.useName = !f.useName;
  else f.useType = !f.useType;
  renderBanner();
});

$('search').addEventListener('click', () => { setNote(''); runSearch(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && state && state.searchable) { setNote(''); runSearch(); }
  if (e.key === 'Escape') window.pc.hide();
});
$('open').addEventListener('click', () => state.tradeUrl && window.pc.openUrl(state.tradeUrl));
$('close').addEventListener('click', () => window.pc.hide());
$('league').addEventListener('change', async (e) => {
  state.league = e.target.value;
  await window.pc.setLeague(state.league);
  if (state.searchable) runSearch();
});
