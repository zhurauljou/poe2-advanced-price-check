const $ = (id) => document.getElementById(id);
let state = null; // { item, exchange, filters, searchable, league, leagues }
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

// Цена в дивайнах → понятная строка: до 1 div показываем в exalted.
function money(div, exPerDiv) {
  if (div == null) return '—';
  if (exPerDiv && div < 1) return `${fmt(div * exPerDiv)} ex`;
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
function renderBanner() {
  const { item } = state;
  const b = $('banner');
  const two = item.name && item.baseType && item.name !== item.baseType;
  b.className = `banner ${item.rarity}${two ? '' : ' single'}`;
  $('name').textContent = item.name || item.baseType;
  $('base').textContent = two ? item.baseType : '';
  $('league').innerHTML = state.leagues.map((l) => `<option${l === state.league ? ' selected' : ''}>${esc(l)}</option>`).join('');
}

function renderTooltip() {
  const { item } = state;
  const lines = [];
  if (!state.exchange) {
    const props = item.properties.map((p) => `${esc(p.k)}: <b class="${p.aug ? 'aug' : ''}">${esc(p.v)}</b>`);
    if (props.length) lines.push(props.join('<br>'));
    const meta = [];
    if (item.requires) meta.push(`Requires: <b>${esc(item.requires)}</b>`);
    if (item.ilvl) meta.push(`Item Level: <b>${item.ilvl}</b>`);
    if (item.gemLevel) meta.push(`Level: <b>${item.gemLevel}</b>`);
    if (item.sockets) meta.push(`Sockets: <b>${'◆ '.repeat(item.sockets).trim()}</b>`);
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
// Та же цена в других валютах — без той, что уже крупно наверху.
function alt(div, x) {
  const main = money(div, x.exaltedPerDivine).split(' ')[1];
  const out = [];
  if (main !== 'div') out.push(`${fmt(div)} div`);
  if (main !== 'ex' && x.exaltedPerDivine && x.id !== 'exalted') out.push(`${fmt(div * x.exaltedPerDivine)} ex`);
  if (x.chaosPerDivine && x.id !== 'chaos') out.push(`${fmt(div * x.chaosPerDivine)} chaos`);
  return out.join(' · ');
}

function renderExchangeHero() {
  const x = state.exchange;
  // Сам Exalted Orb в ex оценивать бессмысленно — показываем в div.
  if (x.id === 'exalted') x.exaltedPerDivine = null;
  const stack = state.item.stack && state.item.stack.size > 1 ? state.item.stack.size : 0;
  const dir = x.change == null ? '' : x.change >= 0 ? 'up' : 'down';
  $('hero').hidden = false;
  $('hero').innerHTML = `
    <div class="k">Price per unit</div>
    <div class="big">${x.image ? `<img src="${esc(x.image)}" alt="">` : ''}${money(x.divine, x.exaltedPerDivine)}</div>
    <div class="alt">${alt(x.divine, x)}</div>
    <div class="grid">
      <div><span class="k">${stack ? `Stack ×${stack}` : 'Stack'}</span><span class="v">${stack ? money(x.divine * stack, x.exaltedPerDivine) : '—'}</span></div>
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
  const x = { exaltedPerDivine: r.exaltedPerDivine };
  $('hero').innerHTML = `
    <div class="k">Estimated price</div>
    <div class="big">${money(est, r.exaltedPerDivine)}</div>
    <div class="alt">${alt(est, x)}</div>
    <div class="grid">
      <div><span class="k">Cheapest</span><span class="v">${money(divs[0], r.exaltedPerDivine)}</span></div>
      <div><span class="k">Median of ${divs.length}</span><span class="v">${money(median, r.exaltedPerDivine)}</span></div>
      <div><span class="k">Listings</span><span class="v">${r.total.toLocaleString('en-US')}</span></div>
    </div>`;
}

// ---- фильтры ----
const TAG_LABEL = { pseudo: 'total', rune: 'rune', implicit: 'implicit', crafted: 'crafted', desecrated: 'desecrated',
  fractured: 'fractured', enchant: 'enchant' };

function modRow(m, i) {
  if (!m.statId) {
    return `<div class="mod nomatch" title="This modifier has no trade site filter">
      <label><span class="tag">?</span><span>${esc(m.text)}</span></label></div>`;
  }
  const tags = [
    m.weight === 'key' ? '<span class="key" title="Key modifier for this slot — drives the price">★</span>' : '',
    m.tier ? `<span class="tag tier${m.tier <= 2 ? ' top' : ''}">T${m.tier}</span>` : '',
    m.tag !== 'explicit' ? `<span class="tag ${esc(m.tag)}">${esc(TAG_LABEL[m.tag] || m.tag)}</span>` : '',
  ].join('');
  return `<div class="mod t-${esc(m.tag)}${m.enabled ? '' : ' off'}" data-i="${i}">
      <label><input type="checkbox" data-k="enabled"${m.enabled ? ' checked' : ''}>${tags}
        <span>${esc(m.text)}${m.merged ? `<span class="sum-v"> = ${fmt(m.value)}</span>` : ''}</span></label>
      ${m.option ? '' : `<input type="number" data-k="min" step="any" placeholder="min" value="${m.min == null ? '' : m.min}">`}
    </div>`;
}

function renderFilters() {
  const box = $('filters');
  box.hidden = !state.searchable;
  if (!state.searchable) return;
  const f = state.filters;
  $('mods').innerHTML = f.mods.map(modRow).join('');
  $('props').innerHTML = (f.props || []).map((p, i) => `
    <div class="mod t-prop${p.enabled ? '' : ' off'}" data-p="${i}">
      <label><input type="checkbox" data-k="enabled"${p.enabled ? ' checked' : ''}>
        <span class="tag">property</span><span>${esc(p.label)}: ${fmt(p.value)}</span></label>
      <input type="number" data-k="min" step="any" placeholder="min" value="${p.min}">
    </div>`).join('');

  const misc = [];
  if (f.ilvl) misc.push(`<label><input type="checkbox" data-m="ilvl"${f.ilvl.enabled ? ' checked' : ''}>ilvl ≥ <input type="number" data-mv="ilvl" value="${f.ilvl.min}"></label>`);
  if (f.gemLevel) misc.push(`<label><input type="checkbox" data-m="gemLevel"${f.gemLevel.enabled ? ' checked' : ''}>level ≥ <input type="number" data-mv="gemLevel" value="${f.gemLevel.min}"></label>`);
  misc.push(`<label><input type="checkbox" data-o="online"${f.online ? ' checked' : ''}>online only</label>`);
  $('misc').innerHTML = misc.join('');
}

// ---- лоты ----
function sameUnit(l, r) {
  const unit = money(l.divine, r.exaltedPerDivine).split(' ')[1];
  return (unit === 'ex' && l.currency === 'exalted') || (unit === 'div' && l.currency === 'divine');
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
        <span class="eq">${l.divine != null && !sameUnit(l, r) ? '≈ ' + money(l.divine, r.exaltedPerDivine) : ''}</span>
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
    if (r.dropped && r.dropped.length) {
      state.filters = r.filters;
      renderFilters();
      setNote(`Too few listings — relaxed: ${r.dropped.join(' · ')}`);
    }
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
  searchSeq++;
  setStatus('');
  setNote('');
  $('results').hidden = true;
  $('hero').hidden = true;
  $('open').hidden = true;
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

$('props').addEventListener('input', (e) => {
  const row = e.target.closest('.mod');
  if (!row) return;
  const p = state.filters.props[+row.dataset.p];
  if (e.target.dataset.k === 'enabled') {
    p.enabled = e.target.checked;
    row.classList.toggle('off', !p.enabled);
  } else {
    p.min = e.target.value === '' ? null : Number(e.target.value);
  }
});

$('misc').addEventListener('input', (e) => {
  const f = state.filters;
  const t = e.target;
  if (t.dataset.m) f[t.dataset.m].enabled = t.checked;
  if (t.dataset.mv) f[t.dataset.mv].min = Number(t.value);
  if (t.dataset.o) f[t.dataset.o] = t.checked;
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
