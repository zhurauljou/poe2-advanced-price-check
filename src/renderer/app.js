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
  const w = 70, h = 20;
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

function renderHeader() {
  const { item } = state;
  const n = $('name');
  n.className = 'name ' + item.rarity;
  n.textContent = item.name || item.baseType;
  const bits = [];
  if (item.name !== item.baseType && item.baseType) bits.push(item.baseType);
  if (item.ilvl) bits.push(`ilvl ${item.ilvl}`);
  if (item.gemLevel) bits.push(`lvl ${item.gemLevel}`);
  if (item.quality) bits.push(`quality ${item.quality}%`);
  if (item.corrupted) bits.push('corrupted');
  if (item.unidentified) bits.push('unidentified');
  $('base').textContent = bits.join(' · ');

  const sel = $('league');
  sel.innerHTML = state.leagues.map((l) => `<option${l === state.league ? ' selected' : ''}>${esc(l)}</option>`).join('');
}

// Та же цена в других валютах — без той, что уже крупно наверху.
function alt(x) {
  const main = money(x.divine, x.exaltedPerDivine).split(' ')[1];
  const out = [];
  if (main !== 'div') out.push(`${fmt(x.divine)} div`);
  if (main !== 'ex' && x.exaltedPerDivine && x.id !== 'exalted') out.push(`${fmt(x.divine * x.exaltedPerDivine)} ex`);
  if (x.chaosPerDivine && x.id !== 'chaos') out.push(`${fmt(x.divine * x.chaosPerDivine)} chaos`);
  return out.join(' · ');
}

function renderExchange() {
  const box = $('exchange');
  const x = state.exchange;
  box.hidden = !x;
  if (!x) return;
  // Сам Exalted Orb в ex оценивать бессмысленно — показываем в div.
  if (x.id === 'exalted') x.exaltedPerDivine = null;
  const stack = state.item.stack && state.item.stack.size > 1 ? state.item.stack.size : 0;
  const ch = x.change == null ? '' : `<span class="${x.change >= 0 ? 'up' : 'down'}">${x.change >= 0 ? '+' : ''}${fmt(x.change)}%</span>`;
  const dir = x.change == null ? '' : x.change >= 0 ? 'up' : 'down';
  box.innerHTML = `
    <div class="card">
      <div class="ex-top">
        ${x.image ? `<img src="${esc(x.image)}" alt="">` : ''}
        <div>
          <div class="big">${money(x.divine, x.exaltedPerDivine)}</div>
          <div class="muted">per unit · ${alt(x)}</div>
        </div>
      </div>
      ${stack ? `<div class="ex-row"><span class="muted">Stack ×${stack}</span><b>${money(x.divine * stack, x.exaltedPerDivine)}</b></div>` : ''}
      <div class="ex-row">
        <span class="muted">7 days ${ch}</span>
        <span class="${dir}">${spark(x.spark)}</span>
      </div>
      <div class="ex-row"><span class="muted">24h volume</span><span>${fmt(x.volume)} div</span></div>
    </div>`;
}

const TAG_LABEL = { pseudo: 'total', rune: 'rune', implicit: 'implicit', crafted: 'crafted', desecrated: 'desecrated',
  fractured: 'fractured', enchant: 'enchant' };

function renderFilters() {
  const box = $('filters');
  box.hidden = !state.searchable;
  if (!state.searchable) return;
  const f = state.filters;
  $('mods').innerHTML = f.mods.length
    ? f.mods.map((m, i) => !m.statId ? `
      <div class="mod off" title="This modifier has no trade site filter">
        <label><span class="tag">?</span><span>${esc(m.text)}</span></label>
      </div>` : `
      <div class="mod${m.enabled ? '' : ' off'}" data-i="${i}">
        <label><input type="checkbox" data-k="enabled"${m.enabled ? ' checked' : ''}>
          ${m.weight === 'key' ? '<span class="key" title="Key modifier for this slot — drives the price">★</span>' : ''}${m.tier ? `<span class="tag tier${m.tier <= 2 ? ' top' : ''}">T${m.tier}</span>` : ''}${m.tag !== 'explicit' ? `<span class="tag ${esc(m.tag)}">${esc(TAG_LABEL[m.tag] || m.tag)}</span>` : ''}<span>${esc(m.text)}${m.merged ? `<span class="sum-v"> = ${fmt(m.value)}</span>` : ''}</span></label>
        ${m.option ? '' : `<input type="number" data-k="min" step="any" placeholder="min" value="${m.min == null ? '' : m.min}">`}
      </div>`).join('')
    : '';

  $('props').innerHTML = (f.props || []).map((p, i) => `
    <div class="mod${p.enabled ? '' : ' off'}" data-p="${i}">
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

function sameUnit(l, r) {
  const unit = money(l.divine, r.exaltedPerDivine).split(' ')[1];
  return (unit === 'ex' && l.currency === 'exalted') || (unit === 'div' && l.currency === 'divine');
}

function renderResults(r) {
  const box = $('results');
  box.hidden = false;
  $('sep').hidden = false;
  if (!r.listings.length) {
    box.innerHTML = `<div class="empty muted">Nothing found. Uncheck some modifiers or lower the minimums.</div>`;
    return;
  }
  const divs = r.listings.map((l) => l.divine).filter((v) => v != null).sort((a, b) => a - b);
  const median = divs.length ? divs[Math.floor((divs.length - 1) / 2)] : null;
  box.innerHTML = `
    <div class="sum">
      <span>Found: <b>${r.total}</b></span>
      <span class="muted">min <b>${money(divs[0], r.exaltedPerDivine)}</b> · median ${money(median, r.exaltedPerDivine)}</span>
    </div>
    <table>${r.listings.map((l, i) => `
      <tr class="lot" data-i="${i}" title="Copy whisper to seller">
        <td><span class="price">${l.currencyImage ? `<img src="${esc(l.currencyImage)}" alt="">` : ''}${fmt(l.amount)}${l.currencyImage ? '' : ' ' + esc(l.currencyName)}</span></td>
        <td class="num muted">${l.divine != null && !sameUnit(l, r) ? '≈ ' + money(l.divine, r.exaltedPerDivine) : ''}</td>
        <td class="seller"><span class="dot${l.online ? ' on' : ''}"></span>${esc(l.seller)}</td>
        <td class="num muted">${l.indexed ? ago(l.indexed) : ''}</td>
      </tr>`).join('')}
    </table>`;
  box.querySelectorAll('tr.lot').forEach((tr) => tr.addEventListener('click', () => {
    window.pc.copy(r.listings[+tr.dataset.i].whisper);
    box.querySelectorAll('tr.copied').forEach((x) => x.classList.remove('copied'));
    tr.classList.add('copied');
    setStatus('Whisper copied — paste it into game chat (Enter, Ctrl+V)');
    fit();
  }));
}

async function runSearch(relax = false) {
  const seq = ++searchSeq;
  $('search').disabled = true;
  setStatus('Searching the trade site…');
  fit();
  try {
    const r = await window.pc.search(state.item, state.filters, relax);
    if (seq !== searchSeq) return;
    setStatus('');
    if (r.dropped && r.dropped.length) {
      state.filters = r.filters;
      renderFilters();
      setNote(`Too few listings — relaxed: ${r.dropped.join(' · ')}`);
    }
    state.tradeUrl = r.url;
    $('open').hidden = false;
    renderResults(r);
  } catch (e) {
    if (seq !== searchSeq) return;
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
  $('sep').hidden = true;
  $('open').hidden = true;
  renderHeader();
  renderExchange();
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
