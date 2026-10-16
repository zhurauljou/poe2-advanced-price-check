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
  // Состояния (Corrupted, Sanctified, Mirrored…) — переключатели: включённое требует то же у лота.
  const fl = (state.searchable && f.flags) || [];
  fl.forEach((x, i) => flags.push(`<span class="tp flag ${x.cls}${x.enabled ? ' on' : ''}${x.value ? '' : ' neg'}" data-ref="f:${i}" title="${x.enabled ? 'Searching only such items — click to ignore' : 'Click to search only such items'}">${esc(x.label)}</span>`));
  if (!fl.length) {
    if (item.corrupted) flags.push('<span class="corrupt">Corrupted</span>');
    if (item.mirrored) flags.push('<span class="cls">Mirrored</span>');
  }
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

function renderSearchingHero() {
  $('hero').hidden = false;
  $('hero').innerHTML = `<div class="k">Estimated price</div><div class="big wait">…</div><div class="alt">Searching the trade site</div>`;
}

// Оценка — медиана самых дешёвых (до 5) лотов: один демпингующий продавец её не уронит.
function renderTradeHero(r) {
  const divs = r.listings.map((l) => l.divine).filter((v) => v != null).sort((a, b) => a - b);
  if (!divs.length) {
    $('hero').innerHTML = `<div class="k">Estimated price</div><div class="big wait" style="animation:none">—</div>
      <div class="alt">No similar items listed right now — it may be a rare high-end item.<br>Uncheck filters or lower the minimums to widen the search.</div>`;
    return;
  }
  const head = divs.slice(0, 5);
  const est = head[Math.floor((head.length - 1) / 2)];
  const median = divs[Math.floor((divs.length - 1) / 2)];
  // Вторая цена: те же моды с любым роллом своего тира — сколько рынок доплачивает за ваши роллы.
  let floorHtml = '';
  const fl = r.floor;
  if (fl && fl.divs.length) {
    const fh = fl.divs.slice(0, 5);
    const fest = fh[Math.floor((fh.length - 1) / 2)];
    const premium = fest > 0 ? Math.round((est / fest - 1) * 100) : 0;
    floorHtml = `<div class="floor" title="Same modifiers with any roll of the same tier">
      Any roll in tier: <b>${money(fest)}</b> · ${fl.total.toLocaleString('en-US')} listed
      ${premium >= 15 ? `<span class="prem">your rolls ≈ +${premium}%</span>` : ''}</div>`;
  }
  $('hero').innerHTML = `
    <div class="k">${fl ? 'Like yours' : 'Estimated price'}</div>
    <div class="big">${money(est)}</div>
    <div class="alt">${alt(est)}</div>
    ${floorHtml}
    <div class="grid">
      <div><span class="k">Cheapest</span><span class="v">${money(divs[0])}</span></div>
      <div><span class="k">Median of ${divs.length}</span><span class="v">${money(median)}</span></div>
      <div><span class="k">Listings</span><span class="v">${r.total.toLocaleString('en-US')}</span></div>
    </div>`;
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
    box.innerHTML = `<div class="sect"><span>Popular builds</span></div><div class="muted center">poe.ninja: ${esc(String(e.message || e).replace(/^Error invoking remote method '\w+': (Error: )?/, ''))}</div>`;
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
    box.innerHTML = `<div class="sect"><span>Demand</span></div><div class="muted center">poe.ninja: ${esc(String(e.message || e).replace(/^Error invoking remote method '\w+': (Error: )?/, ''))}</div>`;
  }
  fit();
}

// Шаблон мода, как у ninja: «# to maximum Life», «#% to Fire Resistance» — наш шаблон трейда без «(Local)».
const ninjaTemplate = (t) => (t || '').replace(/ \(Local\)$/, '').toLowerCase();

function renderDemand(d) {
  const { item, filters: f } = state;
  if (!d.category || !d.total) {
    $('demand').innerHTML = `<div class="sect"><span>Demand</span></div><div class="muted center">No data on poe.ninja for this item class</div>`;
    return;
  }
  const mine = new Set(f.mods.filter((m) => m.template).map((m) => ninjaTemplate(m.template)));
  const modRows = d.mods.map((r) => ({ ...r, mine: mine.has(r.name.toLowerCase()) }));
  const hits = modRows.filter((r) => r.mine).length;
  const baseRows = d.bases.map((r) => ({ ...r, mine: r.name === item.baseType }));
  const baseRank = d.bases.findIndex((b) => b.name === item.baseType);
  $('demand').innerHTML = `
    <div class="sect"><span>Demand · ${esc(d.category)}</span></div>
    <div class="bshare">Worn by <b>${fmt(d.total / d.allTotal * 100)}%</b> of builds</div>
    <div class="bwhat muted">Your item: ${baseRank >= 0 ? `base #${baseRank + 1}` : 'base not in top 10'} · ${hits} of top ${modRows.length} modifiers</div>
    <div class="dcol"><div class="k">Most worn bases</div>${demandRows(baseRows)}</div>
    <div class="dcol"><div class="k">Most common modifiers</div>${demandRows(modRows)}</div>
    <button class="link bopen" data-url="${esc(d.page)}">poe.ninja ↗</button>`;
}

function demandRows(rows) {
  return rows.map((r) => `
    <div class="brow ${heat(r.pct)}${r.mine ? ' mine' : ''}"${r.mine ? ' title="Your item has this"' : ''}><span class="bname">${r.mine ? '✓ ' : ''}${esc(r.name)}</span><span class="bpct">${hot(r.pct)}${fmt(r.pct)}%</span>
      <span class="bbar"><i style="width:${Math.min(100, r.pct)}%"></i></span></div>`).join('');
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
    box.innerHTML = `<div class="sect"><span>Craft</span></div><div class="muted center">${esc(String(e.message || e).replace(/^Error invoking remote method '\w+': (Error: )?/, ''))}</div>`;
  }
  fit();
}

const SIDE = { prefix: 'prefix', suffix: 'suffix' };
function craftRows(list) {
  return list.map((c) => `
    <div class="brow ${heat(c.pct)}"><span class="bname">${esc(c.text)}<span class="craft-tier">T${c.tier}/${c.tiers}${c.range ? ` · ${esc(c.range)}` : ''}</span></span>
      <span class="bpct">${hot(c.pct)}${fmt(c.pct)}%</span><span class="bbar"><i style="width:${Math.min(100, c.pct)}%"></i></span></div>`).join('');
}

function renderCraft(r) {
  const head = '<div class="sect"><span>Craft</span></div>';
  if (r.blocked) { $('craft').innerHTML = `${head}<div class="muted center">${esc(r.blocked)} items can't be modified.</div>`; return; }
  if (r.note) { $('craft').innerHTML = `${head}<div class="muted center">${esc(r.note)}</div>`; return; }
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
    } else if (s.kind === 'cheap') {
      parts.push(`<div class="craft-sec"><div class="k">Cheap and safe</div>${how(s.how)}</div>`);
    }
  }
  parts.push(`<div class="craft-foot">Mod pool: game files (RePoE). Roll chances aren't shown — PoE 2 files have no modifier weights.<br>% = share of builds using the modifier on this item class (poe.ninja).</div>`);
  $('craft').innerHTML = head + parts.join('');
}

// Насколько востребовано: < 10% — приглушаем (почти никому не нужно), ≥ 60% — подсвечиваем (нужно почти всем).
const heat = (pct) => (pct >= 60 ? 'hot' : pct < 10 ? 'cold' : '');
const hot = (pct) => (pct >= 60 ? '<span class="flame" title="Most builds use this">🔥</span>' : '');

function buildRows(rows) {
  return rows.map((r) => `
    <div class="brow ${heat(r.pct)}"><span class="bname">${esc(r.name)}</span><span class="bpct">${hot(r.pct)}${fmt(r.pct)}%</span>
      <span class="bbar"><i style="width:${Math.min(100, r.pct)}%"></i></span></div>`).join('');
}

function renderBuilds(b) {
  // Бейдж на вкладке Demand — чтобы фичу замечали, не открывая вкладку.
  const pct = b.allTotal ? b.total / b.allTotal * 100 : null;
  const anyHot = [...b.classes, ...b.skills].some((r) => r.pct >= 60);
  // Уровень спроса по числу персонажей (не по %: у нишевых вещей процент всегда мал, а спрос реальный).
  const lvl = !b.total ? null : b.total >= 2500 ? 'high' : b.total >= 300 ? 'med' : 'low';
  const badge = $('demandBadge');
  badge.className = `badge ${lvl || ''}`;
  badge.textContent = lvl ? { high: '🔥 High', med: 'Med', low: 'Low' }[lvl] : '';
  badge.title = lvl ? `${b.total.toLocaleString('en-US')} characters on poe.ninja use this${pct != null ? ` (${fmt(pct)}% of builds)` : ''}${anyHot ? ' · one build archetype dominates' : ''}` : '';
  const share = b.allTotal ? `<b>${fmt(b.total / b.allTotal * 100)}%</b> of builds · ${b.total.toLocaleString('en-US')} characters`
    : `${b.total.toLocaleString('en-US')} characters`;
  const what = b.filters.map(([, v]) => v).join(' + ');
  $('builds').innerHTML = `
    <div class="sect"><span>Popular builds</span></div>
    <div class="bshare">${share}</div>
    <div class="bwhat muted" title="poe.ninja filter">${esc(what)}</div>
    ${b.total ? `<div class="bcols">
      <div><div class="k">Ascendancy</div>${buildRows(b.classes.slice(0, 4))}</div>
      <div><div class="k">Main skill</div>${buildRows(b.skills.slice(0, 4))}</div>
    </div>` : '<div class="muted center">No characters on poe.ninja use this</div>'}
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
  return ` <span class="rng" title="Tier range · roll ${Math.round(m.roll * 100)}%">${fmt(m.range.lo)}–${fmt(m.range.hi)}</span>${max}`;
}

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
    + (m.demand >= 30 ? ` <span class="dem${m.demand >= 60 ? ' hot' : ''}" title="${fmt(m.demand)}% of builds wearing this item class have this modifier (poe.ninja)">${m.demand >= 60 ? '🔥 ' : ''}${fmt(m.demand)}% builds</span>` : '');
  const text = m.tag === 'pseudo' ? m.text.replace(/^Σ /, '') : m.text;
  return `<div class="mod t-${esc(m.tag)}${m.enabled ? '' : ' off'}" data-i="${i}">
      <label><input type="checkbox" data-k="enabled"${m.enabled ? ' checked' : ''}>${meter(m) || '<span class="imp"></span>'}${tier}
        <span class="txt"${from}>${esc(text)}${m.merged ? `<span class="sum-v"> = ${fmt(m.value)}</span>` : ''}${cat}${rollInfo(m)}</span></label>
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
  box.querySelectorAll('.lot').forEach((row) => {
    row.addEventListener('mouseenter', () => showCompare(r.listings[+row.dataset.i], row));
    row.addEventListener('mouseleave', hideCompare);
  });
}

// ---- карточка конкурента при наведении на лот: что у него лучше / хуже, чем у нашей вещи ----
// Значение мода — среднее чисел в строке по модулю («reduced» тоже: чем больше, тем сильнее мод).
function modValue(text) {
  const nums = (String(text).match(/\d+(?:\.\d+)?/g) || []).map(Number);
  return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
}
const propNum = (v) => { const m = String(v).replace(/,/g, '').match(/\d+(?:\.\d+)?/); return m ? +m[0] : null; };

function compareClass(theirs, ours) {
  if (theirs == null || ours == null) return '';
  if (theirs > ours * 1.005) return 'better';
  if (theirs < ours * 0.995) return 'worse';
  return 'same';
}

function showCompare(l, row) {
  const t = l.tip;
  if (!t) return;
  const { item, filters: f } = state;
  // Сравниваем по самому стату, складывая все категории: «41% increased ES» (обычный) + «93%» (desecrated)
  // против их «138%» — игроку важна сумма, а не откуда мод. Ключ — id без категории: «stat_4015621042».
  const key = (id) => id.replace(/^\w+\./, '');
  const ours = new Map();
  for (const m of f.mods) {
    if (!m.statId || m.tag === 'pseudo' || m.option) continue;
    ours.set(key(m.statId), (ours.get(key(m.statId)) || 0) + Math.abs(m.value || 0));
  }
  const theirs = new Map();
  for (const m of t.mods) if (m.statId) theirs.set(key(m.statId), (theirs.get(key(m.statId)) || 0) + Math.abs(modValue(m.text) || 0));
  // Варианты (Legacy of Gold) у лота приходят с id без номера варианта — их сверяем по тексту.
  const ourOptions = new Set(f.mods.filter((m) => m.option).map((m) => m.text.toLowerCase()));
  const theirTexts = new Set(t.mods.map((m) => m.text.toLowerCase()));

  const mark = { better: '▲', worse: '▼', extra: '+', same: '' };
  const modLines = t.mods.map((m) => {
    let cls = '';
    if (ourOptions.has(m.text.toLowerCase())) {
      cls = 'same';
    } else if (m.statId && ours.has(key(m.statId))) {
      cls = compareClass(theirs.get(key(m.statId)), ours.get(key(m.statId))) || 'same';
    } else if (m.statId) cls = 'extra';
    return `<div class="cm ${cls} d-${esc(m.domain)}">${mark[cls] ? `<i>${mark[cls]}</i>` : ''}${esc(m.text)}</div>`;
  }).join('');
  const missing = f.mods.filter((m) => m.statId && m.tag !== 'pseudo'
    && (m.option ? !theirTexts.has(m.text.toLowerCase()) : !theirs.has(key(m.statId))))
    .map((m) => `<div class="cm missing"><i>✗</i>${esc(m.text.split('\n').join(' + '))}</div>`).join('');

  const ourProps = new Map(item.properties.map((p) => [p.k, propNum(p.v)]));
  const props = t.props.map((p) => {
    const cls = ourProps.has(p.k) ? compareClass(propNum(p.v), ourProps.get(p.k)) : '';
    return `<div class="cm ${cls}">${mark[cls] ? `<i>${mark[cls]}</i>` : ''}${esc(p.k)}: <b>${esc(p.v)}</b></div>`;
  });
  if (t.ilvl) {
    const cls = compareClass(t.ilvl, item.ilvl);
    props.push(`<div class="cm ${cls}">${mark[cls] ? `<i>${mark[cls]}</i>` : ''}Item Level: <b>${t.ilvl}</b></div>`);
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
  window.lastTip = t; // для --dump-tip в демо
  window.pc.compareShow(html, row.getBoundingClientRect().top);
}

function hideCompare() {
  window.pc.compareHide();
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
});

$('hero').addEventListener('click', (e) => {
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

$('tab-demand').addEventListener('click', (e) => {
  const b = e.target.closest('.bopen');
  if (b) window.pc.openUrl(b.dataset.url);
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
  if ('optmin' in t.dataset) state.filters.optionMin = Number(t.value) || null;
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
