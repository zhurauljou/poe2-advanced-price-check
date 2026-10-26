// Handlers: new item from the main process, clicks and input, UI language. Loaded last:
// by then all functions of the window parts are already declared.
// Window parts are plain scripts sharing one scope (index.html loads them in order).

window.pc.onItem((data) => {
  impactSeq++; // the previous item's unfinished "mod contributions" mustn't write into the new one
  quickMemo = new Map();
  elementAlts = null;
  if ($('elements')) $('elements').hidden = true;
  state = data;
  rates = data.rates || {};
  setWide(data.wide === true); // the layout the user chose with the header button
  openSums.clear();
  openDemand.clear();
  showAllLots = false;
  shownEst = null; // a new item: its price appears, it does not glide from the previous one
  lastResult = null;
  hideCompare();
  // The listing currency is a filter of this search, not a setting: «Exalted» chosen for a cheap item left every later
  // item (an expensive one too) searched among exalted-priced listings only.
  if (state.filters) state.filters.priceCurrency = 'any';
  demandAll = false; // the same for «all builds» on the Demand tab
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
  // Tabs only for items with a trade search; currency needs just one.
  $('tabs').hidden = !state.searchable;
  // The window is pinned only while a step-by-step crafting item is shown: check another and it hides as usual again
  // (the session stays: return to that item and it's pinned again).
  const inSession = !!(craftSession && sessionMatches());
  window.pc.pin(inSession || userPinned);
  // The pin shows what holds the window: during a step-by-step session it stays open without the button pressed.
  $('pinBtn').classList.toggle('on', inSession || userPinned);
  setTab(inSession ? 'craft' : 'price');
  if (state.searchable && state.item.uniqueOptions && !state.filters.useName) loadUniqueChoice();
  else if (state.searchable) runSearch(true);
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
    await window.pc.setDemandLevel(demandLevel).catch(() => {}); // not saved: the level still applies right now
    craftFor = null; // the craft topic also follows the new level
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

// ---- filter changes ----
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
    if (m.option) renderFilters(); // recompute "Match ≥ N of M"
  } else if (e.target.dataset.k === 'min') {
    m.min = e.target.value === '' ? null : Number(e.target.value);
  } else if (e.target.dataset.k === 'max') {
    m.max = e.target.value === '' ? null : Number(e.target.value);
    e.target.classList.toggle('empty', m.max == null);
    syncMaxColumn();
  }
});

// ref from a tooltip → filter object: 'p:2' = state.filters.props[2], 'm:ilvl' = state.filters.ilvl.
function filterByRef(ref) {
  const [kind, key] = ref.split(':');
  if (kind === 'f') return state.filters.flags[+key];
  return kind === 'p' ? state.filters.props[+key] : state.filters[key];
}

$('tooltip').addEventListener('click', (e) => {
  if (e.target.closest('.tp-in')) return; // click in a bound input: don't toggle
  const el = e.target.closest('.tp');
  if (!el) return;
  markDirty();
  const flt = filterByRef(el.dataset.ref);
  if (el.dataset.ref.startsWith('f:')) {
    // State: off → as on the item → opposite → off.
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
  if (flt.exact) flt.max = flt.min; // waystone tier: exactly this
  // Lower bound above the upper (tablet "= 10", typed 12): drop the upper, otherwise the search is empty.
  else if (t.dataset.f === 'min' && flt.max != null && flt.min != null && flt.min > Number(flt.max)) flt.max = null;
});

$('misc').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cur]');
  if (!b) return;
  markDirty();
  state.filters.priceCurrency = b.dataset.cur;
  renderFilters();
});

$('misc').addEventListener('input', (e) => {
  const t = e.target;
  markDirty();
  if (t.dataset.o) {
    state.filters[t.dataset.o] = t.checked;
    window.pc.setSearchDefaults({ online: state.filters.online, flex: state.filters.flex }); // same for the next item
  }
  if ('optmin' in t.dataset) state.filters.optionMin = Number(t.value) || null;
  if (t.type === 'checkbox') t.closest('.opt').classList.toggle('off', !t.checked);
});

$('banner').addEventListener('click', (e) => {
  const el = e.target.closest('.pick');
  if (!el || !state || !state.searchable) return;
  markDirty();
  const f = state.filters;
  if (el.dataset.u) { pickUnique(f.useName && state.item.name === el.dataset.u ? null : el.dataset.u); return; }
  const isName = el.id === 'name' && state.item.rarity === 'Unique' && $('base').textContent;
  if (isName) f.useName = !f.useName;
  else f.useType = !f.useType;
  renderBanner();
});

// Unidentified unique on a shared base: picked (by the art) — search it; unpicked — back to the choice of candidates.
function pickUnique(name) {
  state.item.name = name || '';
  state.filters.useName = !!name;
  state.uniqueNinja = null;
  renderBanner();
  if (!name) { searchSeq++; loadUniqueChoice(); return; }
  setNote('');
  runSearch(true);
  loadBuilds();
  loadUniqueNinja();
}

function searchNow() { setNote(''); runSearch(); loadBuilds(); }
$('search').addEventListener('click', searchNow);
document.addEventListener('keydown', (e) => {
  // Enter searches on the price tab: not on auto-repeat (holding it burned the limit), not during a search and not on a button
  // (it presses itself, otherwise both the button action and the search would fire).
  if (e.key === 'Enter' && state && state.searchable && !e.repeat && !$('search').disabled && !$('tab-price').hidden
    && !e.target.closest('button, summary, a, [data-act]')) searchNow();
  if (e.key === 'Escape') {
    // First close an open league list, not the whole window.
    if (!$('leagueMenu').hidden) toggleLeagueMenu(false);
    else if (!$('histMenu').hidden) toggleHistory(false);
    else window.pc.hide();
  }
});
$('open').addEventListener('click', () => state.tradeUrl && window.pc.openUrl(state.tradeUrl));
// Search link: to share or open later.
$('copyLink').addEventListener('click', () => {
  if (!state.tradeUrl) return;
  window.pc.copy(state.tradeUrl);
  setStatus(t('Link copied'));
});
// Item page on poe2db: uniques by name, everything else by base.
$('poe2db').addEventListener('click', () => {
  const it = state && state.item;
  if (!it) return;
  const page = it.rarity === 'Unique' && it.name ? it.name : it.baseType || it.name;
  window.pc.openUrl(`https://poe2db.tw/us/${encodeURIComponent(page.replace(/ /g, '_'))}`);
});

// Badge on the Craft tab: free affix slots (rare 3 + 3, magic 1 + 1; jewels 2 + 2).
function openSlotsBadge(it) {
  if (!it.advanced || !['Rare', 'Magic'].includes(it.rarity) || it.itemClass === 'Tablet' || it.corrupted || it.mirrored || it.sanctified) return '';
  const per = it.rarity === 'Magic' ? 1 : it.itemClass === 'Jewels' ? 2 : 3;
  const used = (side) => (it.affixes || []).filter((a) => a.side === side).length;
  const free = Math.max(0, per - used('prefix')) + Math.max(0, per - used('suffix'));
  return free ? t('+{n} mods', { n: free }) : '';
}
$('close').addEventListener('click', () => window.pc.hide());
$('leagueBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleLeagueMenu(); });
$('leagueMenu').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-league]');
  if (!b) return;
  toggleLeagueMenu(false);
  if (b.dataset.league === state.league) return;
  const prev = state.league;
  state.league = b.dataset.league;
  renderLeagues();
  setStatus(t('Loading prices for {league}…', { league: state.league }));
  try {
    await window.pc.setLeague(state.league);
  } catch (err) {
    // The switch failed: the header must not claim the new league while searches still go to the old one.
    state.league = prev;
    renderLeagues();
    setStatus(errText(err), true);
    return;
  }
  setStatus('');
  // Exchange item: its price (poe.ninja, new league) is computed by the main process, so re-check the item.
  if (!state.searchable) { window.pc.recheck(); return; }
  // Everything else also follows the new league: search, demand, unique price on poe.ninja; craft advice is recomputed after the search.
  state.uniqueNinja = null;
  craftFor = null;
  quickMemo = new Map();
  runSearch();
  loadBuilds();
  loadDemand();
  loadUniqueNinja();
});
// Click outside: close the list.
document.addEventListener('click', (e) => {
  if (!e.target.closest('#ldrop')) toggleLeagueMenu(false);
  if (!e.target.closest('#hdrop')) toggleHistory(false);
});

// ---- UI language: static labels from index.html (data-i18n) and redraw of what's shown ----
function applyLang() {
  document.documentElement.lang = window.i18n.getLang();
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  $('search').textContent = t($('search').classList.contains('dirty') ? 'Search · filters changed' : 'Search');
}
applyLang();

// Scale or layout changed in settings: the window fits itself to the content.
// League chosen in the tray or Settings while the window is open: the header follows, the shown prices are for the old one.
window.pc.onLeague((l) => {
  if (!state || state.league === l) return;
  state.league = l;
  renderLeagues();
  if (state.searchable) markDirty();
});

window.pc.onRefit((d) => {
  if (d && typeof d.wide === 'boolean') setWide(d.wide);
  fit();
});

// One / two columns: the header button switches the layout and remembers it for the next items.
$('wideBtn').addEventListener('click', () => {
  setWide(!wide);
  window.pc.setWide(wide);
  fit();
});

// Pin the window: it doesn't hide on clicking into the game, Esc stays with the game (as in step-by-step crafting). Persists for next items.
let userPinned = false;
$('pinBtn').addEventListener('click', () => {
  userPinned = !userPinned;
  const held = userPinned || !!(craftSession && sessionMatches());
  $('pinBtn').classList.toggle('on', held);
  window.pc.pin(held);
});

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
  // Craft advice is built by the main process: request it again (right away if the tab is open).
  craftFor = null;
  if (!$('tab-craft').hidden) loadCraft();
  fit();
});

// Opening or closing a fold changes the content height: the window follows it («toggle» doesn't bubble — caught on the way down).
document.addEventListener('toggle', () => fit(), true);

// The window's CSP forbids inline styles (style="…"), so bar and placeholder widths are set via data-w after insertion.
// Only the inserted elements are scanned: the countdown's text nodes (every 500 ms) and the rest of the page are skipped.
const applyW = (el) => { el.style.width = el.dataset.w; el.removeAttribute('data-w'); };
new MutationObserver((muts) => {
  for (const m of muts) {
    for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.dataset.w) applyW(n);
      n.querySelectorAll('[data-w]').forEach(applyW);
    }
  }
}).observe(document.body, { childList: true, subtree: true });
