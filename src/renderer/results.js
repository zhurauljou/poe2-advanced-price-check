// Listings, competitor card, notes above the filters and the trade search itself.
// Window parts are plain scripts sharing one scope (index.html loads them in order).

// ---- listings ----
// The listing is already in the currency we display, so no "≈" is needed.
function sameUnit(l) {
  const unit = moneyUnit(l.divine);
  return (unit === 'chaos' && l.currency === 'chaos') || (unit === 'div' && l.currency === 'divine') || (unit === 'ex' && l.currency === 'exalted');
}

// The 5 cheapest listings are visible right away, the rest via "Show all": a shorter window.
const LOTS_SHOWN = 5;
let showAllLots = false;
// A fresh listing (≤ 1 day) is highlighted; a stale one (≥ 7 days) is dimmed: that price most likely doesn't sell.
const ageClass = (iso) => { const d = ageDays(iso); return d <= 1 ? ' fresh' : d >= 7 ? ' stale' : ''; };

function renderResults(r) {
  const box = $('results');
  box.hidden = !r.listings.length;
  if (!r.listings.length) return;
  box.innerHTML = `
    <div class="sect"><span>${t('Cheapest listings')} <b class="cnt">${r.total.toLocaleString('en-US')}</b></span></div>
    <div class="lots${showAllLots ? ' all' : ''}">${r.listings.map((l, i) => `
      <div class="lot${i >= LOTS_SHOWN ? ' more' : ''}${ageClass(l.indexed)}${stateRowClass(l)}" data-i="${i}" title="${l.whisper ? t('Copy whisper to seller') : t('Instant buyout — opens the trade site (Travel to Hideout)')}">
        <span class="chip">${l.currencyImage ? `<img src="${esc(l.currencyImage)}" alt="">` : ''}${fmt(l.amount)}${l.currencyImage ? '' : ' ' + esc(l.currencyName)}</span>
        <span class="eq"><span class="st">${stateBadge(l)}</span>${cmpBadge(l)}<span class="ap">${l.divine != null && !sameUnit(l) ? '≈ ' + money(l.divine) : ''}</span></span>
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
        // The card stays open until unpinned: you can hover other listings and come back to it.
        pinnedLot = pinnedLot && pinnedLot.l === l ? null : { l, row };
        box.querySelectorAll('.lot.pinned').forEach((x) => x.classList.remove('pinned'));
        if (pinnedLot) { row.classList.add('pinned'); showCompare(l, row); } else hideCompare();
      } else {
        // Errors mustn't be lost silently: "nothing happens" is the worst outcome.
        const sent = await window.pc.whisperGame(l.whisper).catch((err) => { setStatus(errText(err), true); return null; });
        if (sent === false) setStatus(t('Whisper copied — switch to the game and paste it into chat (Enter, Ctrl+V)'));
      }
      fit();
      return;
    }
    // Instant buyout has no whisper: purchase via "Travel to Hideout" on trade.
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

// Listing on the trade site: search with the same filters + the seller's account, so the page shows almost only them.
// Failed (limit, error): general search.
async function openListing(r, l) {
  let url = r.url;
  if (l.account) {
    try { url = await window.pc.listingUrl(state.item, state.filters, l.account); } catch {}
  }
  window.pc.openUrl(url);
  setStatus(l.whisper ? t('Opened on the trade site') : t('Opened on the trade site — use Travel to Hideout there'));
}

// ---- competitor card on listing hover: what's better / worse than on our item ----
// Mod value = mean of the numbers in the line, by absolute value ("reduced" too: bigger means a stronger mod).
function modValue(text) {
  const nums = (String(text).match(/\d+(?:\.\d+)?/g) || []).map(Number);
  return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
}
const propNum = (v) => { const m = String(v).replace(/,/g, '').match(/\d+(?:\.\d+)?/); return m ? +m[0] : null; };

// Comparing competitor mods with our item, shared by the side card and the "▲▼" in the listing row.
// By the stat itself, summing all categories: "41% increased ES" (regular) + "93%" (desecrated) vs their "138%":
// the player cares about the sum, not where the mod came from. Key = id without category ("stat_4015621042"). Variants (Legacy of Gold)
// come on listings with an id lacking the variant number, so they're matched by text.
function compareModel(t) {
  const mods = state.filters.mods;
  const key = (id) => id.replace(/^\w+\./, '');
  const add = (map, k, v) => map.set(k, (map.get(k) || 0) + v);
  const ours = new Map();
  const theirs = new Map();
  for (const m of mods) if (m.statId && m.tag !== 'pseudo' && !m.option) add(ours, key(m.statId), Math.abs(m.value || 0));
  for (const m of t.mods) if (m.statId) add(theirs, key(m.statId), Math.abs(modValue(m.text) || 0));
  const ourOptions = new Set(mods.filter((m) => m.option).map((m) => m.text.toLowerCase()));
  // Minus in the text itself ("-11% to all Elemental Resistances") is usually a drawback, but niche builds (Doryani etc.)
  // actually want a bigger minus: such a difference is neither "better" nor "worse" but "±, build-dependent", not counted in ▲▼.
  const penalty = new Set(mods.filter((m) => m.statId && /^-\d/.test(String(m.text).trim())).map((m) => key(m.statId)));
  const theirTexts = new Set(t.mods.map((m) => m.text.toLowerCase()));
  // better / worse / same: both have the mod; extra: we don't have it; '': can't compare (no stat id).
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
  // Order of our mods, so the competitor card follows the same order as the filters.
  const order = new Map();
  mods.forEach((m) => { if (m.statId && !order.has(key(m.statId))) order.set(key(m.statId), order.size); });
  return { classify, missing, key, ours, order };
}

// "▲2 ▼1" in the listing row: how many of the competitor's mods are better and worse than yours, without hovering.
// How many listing mods are better / worse than on your item (identical mods on trade are one sum, counted once).
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
    // A key mod (skill levels, the slot's main mod) weighs double: +5 vs your +4 is already a different item.
    const ours = state.filters.mods.find((x) => x.statId && key(x.statId) === key(m.statId));
    const w = ours && ours.key ? 2 : 1;
    if (c === 'better') better += w;
    else if (c === 'worse') worse += w;
  }
  return { better, worse };
}

// States of your item and the listing (Corrupted, Sanctified, Mirrored…): the listing row shows those that differ from yours.
// In the listing row: a letter in its own column (row width doesn't fit a word, and columns mustn't jump) and a left bar;
// the full name is in the tooltip and at the top of the card.
const STATE_SHORT = { Corrupted: 'C', Sanctified: 'S', Mirrored: 'M', Unidentified: 'U' };
const diffStates = (l) => ((l.tip && l.tip.states) || []).filter((s) => !myStates().has(s));
const stateRowClass = (l) => { const d = diffStates(l); return d.length ? ` st-${d[0].toLowerCase()}` : ''; };
function myStates() {
  const it = state.item;
  return new Set([it.corrupted && 'Corrupted', it.sanctified && 'Sanctified', it.mirrored && 'Mirrored', it.unidentified && 'Unidentified'].filter(Boolean));
}
function stateBadge(l) {
  return diffStates(l).map((s) => `<span class="lstate s-${s.toLowerCase()}" title="${esc(t('{state} — yours is not', { state: s }))}">${esc(STATE_SHORT[s] || s)}</span>`).join('');
}

// Listing states at the top of the card, prominently: they change the price more than rolls (a sanctified or desecrated
// item can't be changed anymore). Differences from your item are marked.
function statesHtml(tip) {
  const list = tip.states || (tip.corrupted ? ['Corrupted'] : []);
  if (!list.length) return '';
  const mine = myStates();
  return `<div class="cmp-states">${list.map((s) => `<span class="cstate s-${s.toLowerCase()}${mine.has(s) ? ' same' : ''}">${esc(s)}${mine.has(s) ? '' : ` · ${esc(t('yours is not'))}`}</span>`).join('')}</div>`;
}

// ▲ and ▼ each in its own column (empty if zero), so nothing shifts between rows.
function cmpBadge(l) {
  const { better, worse } = cmpCounts(l);
  const title = t('Modifiers better / worse than yours');
  return `<i class="b" title="${title}">${better ? `▲${better}` : ''}</i><i class="w" title="${title}">${worse ? `▼${worse}` : ''}</i>`;
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
  // Matching mods in our item's order, the rest (ones we lack) at the end; for ▲▼, our value.
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
  // Sockets: count (◆ for each) and what's socketed; compared with your item's sockets.
  if (tip.sockets || item.sockets) {
    const n = tip.sockets || 0;
    const cls = compareClass(n, item.sockets || 0);
    const inside = (tip.socketed || []).length ? ` <span class="yours">${esc(tip.socketed.join(', '))}</span>` : '';
    props.push(`<div class="cm ${cls}">${mark[cls] ? `<i>${mark[cls]}</i>` : ''}Sockets: <b>${n ? '◆ '.repeat(n).trim() : '—'}</b>${cls && cls !== 'same' ? `<span class="yours">${t('yours {x}', { x: item.sockets || 0 })}</span>` : ''}${inside}</div>`);
  }
  if (tip.ilvl) {
    const cls = compareClass(tip.ilvl, item.ilvl);
    props.push(`<div class="cm ${cls}">${mark[cls] ? `<i>${mark[cls]}</i>` : ''}Item Level: <b>${tip.ilvl}</b>${cls ? `<span class="yours">${t('yours {x}', { x: item.ilvl })}</span>` : ''}</div>`);
  }

  const two = tip.name && tip.base && tip.name !== tip.base;
  const html = `
    <div class="banner mini ${esc(tip.rarity)}${two ? '' : ' single'}"><div class="bn-name">${esc(tip.name || tip.base)}</div>${two ? `<div class="bn-base">${esc(tip.base)}</div>` : ''}</div>
    <div class="cmp-body">
      ${statesHtml(tip)}
      ${props.join('')}
      ${props.length ? '<div class="tt"><div class="sep"></div></div>' : ''}
      ${modLines}
      ${missing ? `<div class="cmp-miss">${t("Yours has, theirs doesn't:")}</div>${missing}` : ''}
      <div class="cmp-legend"><span class="better">▲ ${t('better')}</span> · <span class="worse">▼ ${t('worse')}</span> · <span class="extra">+ ${t("you don't have")}</span> — ${t('than your item')}${tip.mods.some((m) => classify(m) === 'diff') ? ` · <span class="diff">± ${t('depends on the build')}</span>` : ''}</div>
    </div>`;
  // The card is in a separate side window (doesn't cover the overlay), opposite the listing row.
  window.pc.compareShow(html, row.getBoundingClientRect().top);
}

let pinnedLot = null; // { l, row }: the pinned competitor card
function hideCompare() {
  window.pc.compareHide();
}

// Filters changed after the search: the Search button is highlighted, the result on screen no longer matches them.
function markDirty() {
  // Filters changed: the previous "mod contributions" no longer apply.
  if (state.impact) { impactSeq++; state.impact = null; document.querySelectorAll('#mods .drive').forEach((x) => x.remove()); }
  const b = $('search');
  if (!b.classList.contains('dirty')) { b.classList.add('dirty'); b.textContent = t('Search · filters changed'); }
}

// Note above the filters after auto-relaxing: dropped = lines (mod text) or { t, v } for translation.
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

// What the price block is currently filled with, to redraw it on language change.
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
      renderBanner(); // relaxing may have dropped the exact base
    }
    lastNotes = { dropped: r.dropped, relaxStopped: r.relaxStopped, unpriced: r.unpriced };
    renderNotes();
    rates = r.rates || rates;
    setStatus(''); // clear "waiting for limit" if it was shown
    state.tradeUrl = r.url;
    $('open').hidden = false;
    $('copyLink').hidden = false;
    heroRender = () => { renderTradeHero(r); ($('hero').querySelector('.th-foot') || $('hero')).insertAdjacentHTML('beforeend', prevCheckHtml()); renderResults(r); renderElements(); };
    heroRender();
    recordPrice(state.est);
    loadElements(seq, false);
    // Craft advice was computed as "sell as is" without an estimate (tab opened before the search finished; in step-by-step crafting
    // always) or with the old filters: recompute, right away if the tab is open, otherwise when it opens.
    if (craftFor === state || (craftFor === null && !$('tab-craft').hidden)) { craftFor = null; if (!$('tab-craft').hidden) loadCraft(); }
  } catch (e) {
    if (seq !== searchSeq) return;
    $('results').hidden = true;
    elementAlts = null;
    if ($('elements')) $('elements').hidden = true;
    // Trade rate limit: wait until it frees up and search again automatically (same item, window open), with a countdown.
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
