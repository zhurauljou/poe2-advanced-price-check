// Price tab: estimate block (exchange, live offers, trade), other elements (Aldur runes), mod contributions to price.
// Window parts are plain scripts sharing one scope (index.html loads them in order).

// ---- price block ----
// The same price in other currencies under the large figure. Expensive items (from half a mirror) also in mirrors.
function alt(div, selfId) {
  if (div == null) return '';
  const out = [];
  if (div >= 1) {
    if (rates.mirror && div >= rates.mirror / 2) out.push(`${fmt(div / rates.mirror)} mirror`);
  } else {
    // Large figure is in its own currency (money); here, in the others.
    const u = moneyUnit(div);
    out.push(`${fmt(div)} div`);
    if (u === 'chaos' && rates.exalted && selfId !== 'exalted') out.push(`${fmt(div * rates.exalted)} ex`);
    // Cheaper than chaos: "how many per 1 chaos" is clearer than "0.0148 chaos".
    if (u === 'ex' && rates.chaos && selfId !== 'chaos') out.push(t('{x} per {cur}', { x: fmt(1 / (div * rates.chaos)), cur: 'chaos' }));
  }
  return out.join(' · ');
}

// Currency is priced in a popular currency of choice: Div / Chaos / Ex. The choice is remembered between launches.
const UNITS = [['divine', 'Div', 'div'], ['chaos', 'Chaos', 'chaos'], ['exalted', 'Ex', 'ex']];
let unit = null;
try { unit = localStorage.getItem('exchangeUnit'); } catch {}

function perDiv(id) {
  return id === 'divine' ? 1 : rates[id];
}

// Price in the chosen currency; "auto" (nothing chosen, or this very currency chosen) uses the usual div/chaos rule.
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
  // Inverse rate: "67.6 per chaos" is clearer than "0.0148 chaos".
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

// ---- live trade exchange: best offers right now (poe.ninja shows an hourly average). The exchange limit is strict
// (5 requests per 15 s), so only on button press. ----
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

// Empty state: icon, what happened, explanation (HTML) and action buttons [[data-act, label]].
function voidState(icon, title, html, actions = []) {
  return `<div class="void"><div class="vi">${icon}</div><div class="vt">${esc(title)}</div>${html ? `<div class="vd">${html}</div>` : ''}
    ${actions.length ? `<div class="va">${actions.map(([act, label]) => `<button data-act="${act}">${esc(label)}</button>`).join('')}</div>` : ''}</div>`;
}

// Empty-state buttons are shared by all tabs.
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
  if (act === 'steps') toggleSteps(b.closest('.plan-steps'));
  if (act === 'session-stop') { craftSession = null; window.pc.pin(userPinned); craftFor = null; loadCraft(); }
});

// ---- Aldur runes: the same item in another element (Passion / Ire / Breath / Betrayal) ----
let elementAlts = null; // { list: [{ element, rune, cost, needSocket, est, wait }], all }
async function loadElements(seq, all) {
  const vars = await window.pc.elementVariants(state.item, state.filters).catch(() => []);
  // No options: also remove the previous search's block (otherwise it stayed on screen).
  if (seq !== searchSeq || !vars.length) { if (seq === searchSeq) { elementAlts = null; renderElements(); } return; }
  if (!elementAlts || !all) elementAlts = { list: vars.map((v) => ({ ...v, wait: false, est: undefined })), all };
  elementAlts.all = all;
  const todo = all ? elementAlts.list.filter((v) => v.est === undefined) : elementAlts.list.slice(0, 1); // right away just one, the best by demand
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

// While searching: placeholders shaped like the result, so the window doesn't jump when prices arrive.
function renderSearchingHero() {
  $('hero').hidden = false;
  // Same layout as renderTradeHero: price on the left, reliability on the right, quick / patient line, bottom row.
  $('hero').innerHTML = `<div class="th">
    <div class="th-top">
      <div class="th-price"><div class="k">${t('Estimated price')}</div><span class="sk big"></span>
        <div class="alt">${t('Searching the trade site…')}</div></div>
      <span class="sk" data-w="96px"></span>
    </div>
    <div class="sell-inline"><span class="sk" data-w="110px"></span><span class="sep"></span><span class="sk" data-w="100px"></span></div>
    <div class="th-foot"><span class="sk" data-w="130px"></span><span class="sk" data-w="110px"></span></div>
  </div>`;
  $('results').hidden = false;
  $('results').innerHTML = `<div class="sect"><span>${t('Cheapest listings')}</span></div><div class="lots">${[70, 55, 62, 48, 66].map((w) => `
    <div class="lot sk-row"><span class="sk" data-w="58px"></span><span></span>
      <span class="sk" data-w="${w}%"></span><span class="sk" data-w="24px"></span></div>`).join('')}</div>`;
}

// Estimate = median of the cheapest (up to 5) listings: a single undercutting seller won't drag it down.
// How far to trust the estimate: how many similar listings and how spread the cheapest prices are.
// Spread = how many times the priciest of the (up to 5) cheapest exceeds the cheapest.
function confidence(total, head, cheapest = [], extra = '') {
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
  return `<div class="conf c${level}"><span title="${esc(why)}">${'●'.repeat(level)}${'○'.repeat(3 - level)} ${label}</span>${extra}</div>`;
}

// How many days ago the listing was posted or repriced (trade: listing.indexed).
// Median of a sorted list (for an even count, the lower of the two middle values).
const mid = (a) => a[Math.floor((a.length - 1) / 2)];
const ageDays = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 86400e3 : 99);

// Listing age line: fresh within a day, stale cheapest, trend "fresh ones cheaper/pricier".
// Collapsed into an ⓘ icon by the estimate reliability (details in the tooltip): the full line overloaded the price block.
// Stale cheapest listing: an icon in the warning color.
function ageSummary(priced, usedFresh) {
  if (priced.length < 2) return '';
  const bits = [];
  const day = priced.filter((l) => l.age <= 1);
  if (day.length) bits.push(t('Fresh (24h): <b>{n}</b> from {price}', { n: day.length, price: money(day[0].div) }).replace(/<\/?b>/g, ''));
  const stale = priced[0].age >= 7;
  if (stale) bits.push(t('cheapest hung {n}d — likely overpriced', { n: Math.round(priced[0].age) }));
  const newer = priced.filter((l) => l.age <= 3).map((l) => l.div);
  const older = priced.filter((l) => l.age > 3).map((l) => l.div);
  if (newer.length >= 2 && older.length >= 2) {
    const k = mid(newer) / mid(older);
    if (k < 0.85) bits.push(`↓ ${t('newer listings are cheaper')}`);
    else if (k > 1.15) bits.push(`↑ ${t('newer listings are pricier')}`);
  }
  if (usedFresh) bits.push(t('estimate from listings ≤ 3 days old'));
  return bits.length ? ` <span class="ages-i${stale ? ' warn' : ''}" title="${esc(bits.join('\n'))}">ⓘ</span>` : '';
}

// A used tablet found among full ones: share of remaining uses (6 of 10 = 0.6), otherwise 1.
function usesScale() {
  const p = ((state.filters && state.filters.props) || []).find((x) => x.key === 'uses');
  return p && p.enabled && p.full && p.value < p.full && Number(p.min) >= p.full ? p.value / p.full : 1;
}

function renderTradeHero(r) {
  const k = usesScale();
  const divs = r.listings.map((l) => l.divine).filter((v) => v != null).map((v) => v * k).sort((a, b) => a - b);
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
  // Listing age: a stale cheap listing (unsold for a week+) inflates the picture, nobody buys at that price.
  // If there are enough fresh (≤ 3 days) listings, the estimate uses them; otherwise all, but with lower reliability.
  // edge = how much stronger a listing is than your item (▲ minus ▼ by mods): notably stronger (≥ 2) mustn't pull the estimate up.
  const priced = r.listings.filter((l) => l.divine != null).map((l) => { const c = cmpCounts(l); return { div: l.divine * k, age: ageDays(l.indexed), edge: c.better - c.worse }; })
    .sort((a, b) => a.div - b.div);
  const stronger = (l) => l.edge >= STRONGER;
  // Most cheap listings are stronger than your item: estimate from those that aren't; if none, from the cheapest.
  const mostlyStronger = priced.length >= 3 && priced.slice(0, 5).filter(stronger).length * 2 > Math.min(5, priced.length);
  const pool = mostlyStronger ? priced.filter((l) => !stronger(l)) : priced;
  const fresh = pool.filter((l) => l.age <= 3);
  const basis = mostlyStronger && pool.length < 2 ? [priced[0].div] : fresh.length >= 3 ? fresh.map((l) => l.div) : pool.map((l) => l.div);
  const head = basis.slice(0, 5);
  const est = mid(head);
  const median = mid(divs);
  const ageInfo = ageSummary(priced, fresh.length >= 3 && fresh.length < priced.length);
  // A callout, not a text line; the "more ▲ than ▼" reasoning goes to the tooltip.
  const ageHtml = (mostlyStronger ? `<div class="callout warn" title="${esc(t('Most listings are stronger than your item (more ▲ than ▼) — estimated from the weaker ones; your item is likely worth less than the list suggests'))}">${esc(t('Most listings are stronger than your item — estimated from the weaker ones; your item is likely worth less than the list suggests'))}</div>` : '');
  // Second price: the same mods with any roll of their tier, i.e. how much the market pays extra for your rolls.
  let floorHtml = '';
  const fl = r.floor;
  if (fl && fl.divs.length) {
    const fest = fl.lots ? estimate(fl.lots) : mid(fl.divs.slice(0, 5)); // same rule as the main price
    const premium = fest > 0 ? Math.round((est / fest - 1) * 100) : 0;
    floorHtml = `<div class="floor" title="${t('Same modifiers with any roll of the same tier')}">
      ${t('Any roll in tier:')} <b>${money(fest)}</b> · ${t('{n} listed', { n: fl.total })}
      ${premium >= 15 ? `<span class="prem">${t('your rolls ≈ +{n}%', { n: premium })}</span>` : ''}</div>`;
  }
  floorHtml += rollsHint();
  state.est = est;
  const drivable =state.filters.mods.some((m) => m.enabled && m.statId && !m.option && !m.inSum);
  // Layout: the price on the left (a click copies it as the listing note) with reliability on the right; the quick and
  // patient prices in one line under it; callouts (missing key mod, stronger listings, rolls) in one style; at the
  // bottom "What drives the price?" and the last check (header.js prevCheckHtml lands in .th-foot).
  const market = listPrice(est);
  $('hero').innerHTML = `<div class="th">
    <div class="th-top">
      <div class="th-price">
        <div class="k">${fl ? t('Like yours') : t('Estimated price')}</div>
        <div class="big copy" data-note="~price ${market.amount} ${market.cur}" title="${esc(t('Market price — click to copy the price note'))}">${money(est)}</div>
        <div class="alt">${alt(est)}</div>
        ${k < 1 ? `<div class="alt" title="${esc(t('Partly used tablets are rarely listed — priced as a full one, scaled by the uses left (an assumption)'))}">${esc(t('a full one ({full} uses) ≈ {price}', { full: Math.round(state.item.props.uses / k), price: money(est / k) }))}</div>` : ''}
      </div>
      ${confidence(r.total, head, priced.slice(0, 5), ageInfo)}
    </div>
    ${sellHtml(priced, est, divs[0], median, divs.length)}
    ${missingKeyHtml()}
    ${ageHtml}
    ${floorHtml}
    <div class="ninja-u">${ninjaLine()}</div>
    <div class="th-foot">${drivable ? `<button class="link drive-btn" data-act="impact" title="${t('Searches again without each key modifier (a few trade requests)')}">${t('What drives the price?')}</button>` : '<span></span>'}</div>
  </div>`;
}

// Rare: how far rolls are from max and what raising them would cost. Divine rerolls the values of all mods
// at once (the mods stay), so "luck" means all key rolls in the top quarter at once (TOP_Q, betterOdds in craft.js).
// Key = explicit / desecrated mods with a range that are enabled in the search: Divine doesn't change fractured, crafted not counted.
// Divined listings sell first; an imperfect item sells slower (Ame's video, research/youtube/ame).
function rollsHint() {
  const it = state.item;
  if (!it || it.rarity !== 'Rare' || it.corrupted || it.sanctified || it.mirrored) return '';
  const key = (state.filters.mods || []).filter((m) => m.enabled && !m.option && !m.merged
    && (m.tag === 'explicit' || m.tag === 'desecrated') && m.range && m.range.hi > m.range.lo && m.roll != null);
  const low = key.filter((m) => m.roll < TOP_Q);
  if (!low.length) return '';
  const avg = Math.round((key.reduce((a, m) => a + m.roll, 0) / key.length) * 100);
  const tries = Math.round(Math.pow(1 / (1 - TOP_Q), key.length));
  const tip = [
    t('Divine Orb rerolls the values of all modifiers at once — the modifiers stay'),
    t('Chance the rolls get better overall: {pct}%', { pct: Math.round(betterOdds(key.map((m) => m.roll)) * 100) }),
    t('Below the top quarter: {list}', { list: low.map((m) => `${m.text.split('\n')[0]} — ${Math.round(m.roll * 100)}%`).join('; ') }),
    t('Each Divine can also make the rolls worse — this is the average over many tries'),
  ].join('\n');
  return `<div class="callout" title="${esc(tip)}">${esc(t('Rolls ≈ {avg}% of max — better-rolled listings sell first', { avg }))}<br>
    ${esc(t('Divine: all key rolls in the top quarter {odds} ≈ {cost}', { odds: oddsText(tries), cost: money(tries) }))}</div>`;
}

// A unique's poe.ninja price is one per name + base, ignoring rolls: a baseline "for the plainest copy".
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

// Missing a key mod (used by almost all builds): the item is worth far less than "complete" ones, explained right in the estimate.
function missingKeyHtml() {
  const miss = (state.filters.exclude || []);
  if (!miss.length) return '';
  return `<div class="miss-key">⚠ ${miss.map((x) => t('No "{mod}" — {pct}% of builds have it', { mod: esc(x.text), pct: fmt(x.pct) })).join('<br>')}
    <small>${esc(t(miss.some((x) => x.enabled) ? 'Compared with listings that lack it too; with it the item would be worth much more — see Craft' : 'Listings with it are included — the estimate is likely too high'))}</small></div>`;
}

// Estimate from listings [{ div, indexed }], same rule as the main price: enough fresh (≤ 3 days) ones, use them;
// median of up to 5 cheapest.
function estimate(lots) {
  const sorted = (lots || []).filter((l) => l.div != null).sort((a, b) => a.div - b.div);
  const fresh = sorted.filter((l) => ageDays(l.indexed) <= 3);
  const head = (fresh.length >= 3 ? fresh : sorted).slice(0, 5).map((l) => l.div);
  return head.length ? mid(head) : null;
}

// Listing price: round, in the currency it's traded in: from 1 div, div; cheaper, chaos; very cheap, ex.
function listPrice(div) {
  const round = (v, step) => Math.max(step, Math.round(v / step) * step);
  if (div >= UNIT_EPS) {
    const amount = round(div, div < 10 ? 0.5 : div < 50 ? 1 : 5);
    return { amount, cur: 'divine', label: `${fmt(amount)} div` };
  }
  if (rates.chaos && div * rates.chaos >= UNIT_EPS) {
    const amount = round(div * rates.chaos, 1);
    return { amount, cur: 'chaos', label: `${amount} chaos` };
  }
  const amount = round(div * (rates.exalted || 0), 1);
  return { amount, cur: 'exalted', label: `${amount} ex` };
}

// Three sell prices: fast (just under the cheapest live listing), market (the estimate), wait (above market,
// no higher than the next listings by price). A click copies "~price N currency" for a stash note.
function sellHtml(priced, est, cheapest, median, n) {
  if (!est || !priced.length) return '';
  const active = priced.filter((l) => l.age < 7);
  // One undercutting listing mustn't drag the "fast" price down: no lower than 60% of market.
  const quick = Math.min(est * 0.95, Math.max(est * 0.6, (active[0] || priced[0]).div * 0.95));
  const next = priced[Math.min(4, priced.length - 1)].div;
  const patient = Math.min(est * 2, Math.max(est * 1.2, next));
  // Instead of "Cheapest / Median / Listings": prices to list at, the same numbers but as an action.
  // Cheapest listing and median go in tooltips, the listing count in the list header.
  // The market price is the big estimate itself (clickable), so only the quick and patient ones are listed here,
  // in one line; one that rounds to the market price is dropped.
  const mkt = listPrice(est).label;
  const opts = [['Quick sale', quick, t('Just under the cheapest active listing — sells fastest. Cheapest listed: {price}', { price: money(cheapest) })],
    ['Patient', patient, t('Above the market — wait for a buyer. Median of {n}: {price}', { n, price: money(median) })]]
    .map(([k, div, title]) => ({ k, title, ...listPrice(div) }))
    .filter((o, i, a) => o.label !== mkt && !a.slice(0, i).some((p) => p.label === o.label));
  if (!opts.length) return '';
  return `<div class="sell-inline">${opts.map((o) => `<span class="so"><span class="k">${t(o.k)}</span><span class="v copy" data-note="~price ${o.amount} ${o.cur}" title="${o.title}
${t('Click to copy the price note')}">${o.label}</span></span>`).join('<span class="sep"></span>')}</div>`;
}

// Mod contributions to price: search in turn without each of the main mods (up to 4), how much the price drops.
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
    const m = f.mods[i];
    // A mod with an exact value (skill levels: exactly +4): "without it" is a different product, so compare with one level lower
    // (+3); that is the price of the level.
    const step = m.max != null && m.max !== '' && Number(m.max) === Number(m.min) && Number(m.min) > 1;
    if (step) { m.min = Number(m.min) - 1; m.max = m.min; } else {
      m.enabled = false;
      // Compare with items that LACK this mod: simply dropping the filter leaves nearly all cheap listings with it anyway
      // (everyone has the key mod), and the contribution came out "≈ 0".
      f.exclude = [...(f.exclude || []), { statId: m.statId, enabled: true, anyKind: true }];
    }
    try {
      const q = await quickPrice(state.item, f);
      if (seq !== impactSeq) return;
      const without = estimate(q.lots);
      state.impact[i] = { without, total: q.total, thin: without != null && q.total < MIN_LOTS, step: step ? m.min : null, share: without == null ? null : Math.max(0, 1 - without / state.est) };
    } catch (e) {
      if (seq !== impactSeq) return;
      state.impact[i] = { error: errText(e) };
      if (isLimit(e)) {
        // The rest will hit the limit too: don't wait, mark them right away.
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
  // Nothing listed without the mod: such items don't sell without it (the mod is mandatory).
  if (d.share == null) {
    return ` <span class="drive big" title="${esc(d.step != null ? t('Nothing listed with {n} instead', { n: d.step }) : t('Nothing listed without it'))}">${esc(t(d.step != null ? 'nothing lower listed' : 'essential'))}</span>`;
  }
  const pct = Math.round(d.share * 100);
  // 1–2 listings without the mod is not an estimate: greyed out with "?".
  if (d.thin) return ` <span class="drive low" title="${esc(t('Too few listings to price it — one or two prices can be anything'))} · ${t('{n} listed', { n: d.total })}">${esc(t('≈{n}% of price', { n: pct }))}?</span>`;
  const without = d.step != null ? t('With {n}: {price}', { n: d.step, price: money(d.without) }) : t('Without it: {price}', { price: money(d.without) });
  const label = pct < 5 ? t('adds ~0') : d.step != null ? t('+1 ≈ {n}% of price', { n: pct }) : t('≈{n}% of price', { n: pct });
  return ` <span class="drive${pct >= 50 ? ' big' : pct < 10 ? ' low' : ''}" title="${esc(without)} · ${t('{n} listed', { n: d.total })}">${label}</span>`;
}
