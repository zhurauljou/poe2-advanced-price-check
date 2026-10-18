// Лоты, карточка конкурента, пометки над фильтрами и сам поиск на трейде.
// Части окна — обычные скрипты с общей областью видимости (index.html подключает их по порядку).

// ---- лоты ----
// Лот и так в той валюте, в которой мы показываем, — «≈» не нужен.
function sameUnit(l) {
  const unit = moneyUnit(l.divine);
  return (unit === 'chaos' && l.currency === 'chaos') || (unit === 'div' && l.currency === 'divine') || (unit === 'ex' && l.currency === 'exalted');
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
        <span class="eq">${stateBadge(l)}${cmpBadge(l)}${l.divine != null && !sameUnit(l) ? '≈ ' + money(l.divine) : ''}</span>
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
      } else {
        // Ошибка не должна теряться молча: «ничего не происходит» — худший исход.
        const sent = await window.pc.whisperGame(l.whisper).catch((err) => { setStatus(errText(err), true); return null; });
        if (sent === false) setStatus(t('Whisper copied — switch to the game and paste it into chat (Enter, Ctrl+V)'));
      }
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

// Состояния вашей вещи и лота (Corrupted, Sanctified, Mirrored…): в строке лота — те, что отличаются от вашей вещи.
const STATE_SHORT = { Corrupted: 'Corrupted', Sanctified: 'Sanctified', Mirrored: 'Mirrored', Unidentified: 'Unid' };
function myStates() {
  const it = state.item;
  return new Set([it.corrupted && 'Corrupted', it.sanctified && 'Sanctified', it.mirrored && 'Mirrored', it.unidentified && 'Unidentified'].filter(Boolean));
}
function stateBadge(l) {
  const mine = myStates();
  const diff = ((l.tip && l.tip.states) || []).filter((s) => !mine.has(s));
  return diff.map((s) => `<span class="lstate s-${s.toLowerCase()}" title="${esc(t('{state} — yours is not', { state: s }))}">${esc(STATE_SHORT[s] || s)}</span>`).join('');
}

// Состояния лота — наверху карточки, заметно: от них цена меняется сильнее, чем от роллов (освящённую или осквернённую
// вещь уже не изменить). Отличие от вашей вещи — с пометкой.
function statesHtml(tip) {
  const list = tip.states || (tip.corrupted ? ['Corrupted'] : []);
  if (!list.length) return '';
  const mine = myStates();
  return `<div class="cmp-states">${list.map((s) => `<span class="cstate s-${s.toLowerCase()}${mine.has(s) ? ' same' : ''}">${esc(s)}${mine.has(s) ? '' : ` · ${esc(t('yours is not'))}`}</span>`).join('')}</div>`;
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
      ${statesHtml(tip)}
      ${props.join('')}
      ${props.length ? '<div class="tt"><div class="sep"></div></div>' : ''}
      ${modLines}
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
