// Обработчики: новая вещь от главного процесса, клики и ввод, язык интерфейса. Подключается последним —
// к этому моменту все функции частей окна уже объявлены.
// Части окна — обычные скрипты с общей областью видимости (index.html подключает их по порядку).

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
