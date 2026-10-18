// Вкладка спроса (poe.ninja): популярные билды, базы и моды класса; вкладки окна.
// Части окна — обычные скрипты с общей областью видимости (index.html подключает их по порядку).

// ---- популярные билды (poe.ninja) ----
// Уник — по имени; редкая/магическая — категория, база (если выбрана в шапке) и 2–3 самых важных
// включённых мода: с полным списком модов у ninja почти не остаётся билдов.
function buildsQuery() {
  const { item, filters: f } = state;
  if (!f) return null;
  if (item.rarity === 'Unique' && f.useName) return { uniqueName: item.name };
  if (!['Rare', 'Magic', 'Normal'].includes(item.rarity) || !f.category) return null;
  const mods = f.mods.filter((m) => m.enabled && m.statId && m.tag !== 'pseudo' && m.tag !== 'implicit' && m.tag !== 'rune')
    .sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 3).map((m) => m.text.split('\n')[0]);
  // Белые и магические вещи — заготовки: носят их уже редкими, поэтому спрос — по редким (магических почти никто не носит).
  return { itemClass: item.itemClass, rarity: 'Rare', baseType: f.useType ? item.baseType : undefined, mods };
}

let buildsSeq = 0;
// Последние данные вкладки Demand — перерисовать при смене языка.
let lastBuilds = null;
let lastDemand = null;
async function loadBuilds() {
  const q = buildsQuery();
  const box = $('builds');
  if (!q) { box.hidden = true; return; }
  const seq = ++buildsSeq;
  box.hidden = false;
  lastBuilds = null;
  box.innerHTML = `<div class="sect"><span>${t('Popular builds')}</span></div><div class="muted center">${t('Loading from poe.ninja…')}</div>`;
  fit();
  try {
    const b = await window.pc.builds(q);
    if (seq !== buildsSeq) return;
    lastBuilds = b;
    renderBuilds(b);
  } catch (e) {
    if (seq !== buildsSeq) return;
    box.innerHTML = `<div class="sect"><span>${t('Popular builds')}</span></div><div class="muted center">poe.ninja: ${esc(errText(e))}</div>`;
  }
  fit();
}

// ---- спрос по категории (poe.ninja): какие базы и моды носят на таких вещах ----
let demandSeq = 0;
let demandAll = false; // true — спрос по всем билдам класса, без темы вещи
async function loadDemand() {
  const { item, filters: f } = state;
  const box = $('demand');
  if (!f || !f.category || !['Rare', 'Magic', 'Normal'].includes(item.rarity)) { box.hidden = true; return; }
  const seq = ++demandSeq;
  box.hidden = false;
  lastDemand = null;
  box.innerHTML = `<div class="sect"><span>${t('Demand')}</span></div><div class="muted center">${t('Loading from poe.ninja…')}</div>`;
  try {
    // По умолчанию — среди билдов, которые носят такую вещь с ключевыми модами вашей (та же тема, что в «Популярных билдах»).
    const q = buildsQuery();
    const withMods = demandAll || !q ? [] : (q.mods || []).slice(0, 2);
    const d = await window.pc.demand({ itemClass: item.itemClass, rarity: 'Rare', withMods });
    if (seq !== demandSeq) return;
    lastDemand = d;
    renderDemand(d);
  } catch (e) {
    if (seq !== demandSeq) return;
    box.innerHTML = `<div class="sect"><span>${t('Demand')}</span></div><div class="muted center">poe.ninja: ${esc(errText(e))}</div>`;
  }
  fit();
}

// Шаблон мода, как у ninja: «# to maximum Life», «#% to Fire Resistance» — наш шаблон трейда без «(Local)».
const ninjaTemplate = (t) => (t || '').replace(/ \(Local\)$/, '').toLowerCase();

function renderDemand(d) {
  const { item, filters: f } = state;
  if (!d.category || !d.total) {
    $('demand').innerHTML = `<div class="sect"><span>${t('Demand')}</span></div>${voidState('◇', t('No poe.ninja data'), t('poe.ninja has no build stats for this item class.'))}`;
    return;
  }
  const mine = new Set(f.mods.filter((m) => m.template).map((m) => ninjaTemplate(m.template)));
  // Топ-10 + все моды вашей вещи, даже вне топа (с местом в рейтинге): ключевой мод узкой темы (+уровни миньонов)
  // в общий топ класса может не попасть, но для покупателей с этой темой он главный.
  const TOP = 10;
  // Моды темы у таких билдов по определению на 100% — в списке они ничего не говорят.
  const themeSet = new Set((d.themed || []).map((x) => x.toLowerCase()));
  const all = d.mods.filter((r) => !themeSet.has(r.name.toLowerCase())).map((r, i) => ({ ...r, rank: i + 1, mine: mine.has(r.name.toLowerCase()) }));
  const modRows = all.filter((r) => r.rank <= TOP || r.mine);
  const hits = all.filter((r) => r.mine && r.rank <= TOP).length;
  const baseRows = d.bases.slice(0, TOP).map((r) => ({ ...r, mine: r.name === item.baseType }));
  const baseRank = d.bases.findIndex((b) => b.name === item.baseType);
  $('demand').innerHTML = `
    <div class="sect"><span>${t('Demand')} · ${esc(d.category)}</span></div>
    ${d.themed && d.themed.length
      ? `<div class="bwhat">${t('Among builds wearing it with')} <b class="theme">${d.themed.map(esc).join(' + ')}</b> · <button class="link" data-dall="1">${t('all builds')}</button></div>`
      : `<div class="bwhat muted">${demandAll ? `${t('All builds')} · <button class="link" data-dall="0">${t('builds like your item')}</button>` : t("Too few builds with your item's modifiers — showing all builds")}</div>`}
    <div class="bshare">${t('Worn by <b>{pct}%</b> of level {lvl}+ builds', { pct: fmt(d.total / d.allTotal * 100), lvl: demandLevel })}</div>
    <div class="bwhat muted">${t('Your item:')} ${baseRank >= 0 ? t('base #{n}', { n: baseRank + 1 }) : t('base not in top 10')} · ${t('{n} of top {m} modifiers', { n: hits, m: Math.min(TOP, all.length) })}</div>
    ${demandList('bases', t('Most worn bases'), baseRows)}
    ${demandList('mods', t('Most common modifiers'), modRows)}
    <button class="link bopen" data-url="${esc(d.page)}">poe.ninja ↗</button>`;
}

// Список спроса: сразу 5 строк + всё, что есть на вашей вещи; остальное — по «Show all».
const DEMAND_SHOWN = 5;
const openDemand = new Set();
function demandList(key, title, rows) {
  const hidden = rows.filter((r, i) => i >= DEMAND_SHOWN && !r.mine).length;
  const open = openDemand.has(key);
  return `<div class="dcol${open ? ' all' : ''}"><div class="k">${title}</div>${rows.map((r, i) => `
    <div class="brow ${heat(r.pct)}${r.mine ? ' mine' : ''}${i >= DEMAND_SHOWN && !r.mine ? ' more' : ''}"${r.mine ? ` title="${t('Your item has this')}"` : ''}><span class="bname">${r.mine ? '✓ ' : ''}${esc(r.name)}${r.rank > 10 ? ` <span class="rank">#${r.rank}</span>` : ''}</span><span class="bpct">${hot(r.pct)}${fmt(r.pct)}%</span>
      <span class="bbar"><i data-w="${Math.min(100, r.pct)}%"></i></span></div>`).join('')}
    ${hidden ? `<button class="link bmore" data-dmore="${key}">${open ? t('Show fewer') : t('Show all {n}', { n: rows.length })}</button>` : ''}</div>`;
}

function setTab(name) {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $('tab-price').hidden = name !== 'price';
  $('tab-demand').hidden = name !== 'demand';
  $('tab-craft').hidden = name !== 'craft';
  if (name === 'craft') loadCraft();
  fit();
}

// Насколько востребовано: < 10% — приглушаем (почти никому не нужно), ≥ 60% — подсвечиваем (нужно почти всем).
const heat = (pct) => (pct >= 60 ? 'hot' : pct < 10 ? 'cold' : '');
const hot = (pct) => (pct >= 60 ? `<span class="flame" title="${t('Most builds use this')}">🔥</span>` : '');

function buildRows(rows) {
  return rows.map((r) => `
    <div class="brow ${heat(r.pct)}"><span class="bname">${esc(r.name)}</span><span class="bpct">${hot(r.pct)}${fmt(r.pct)}%</span>
      <span class="bbar"><i data-w="${Math.min(100, r.pct)}%"></i></span></div>`).join('');
}

// Чей спрос считаем: персонажи 80+ (все, кого видит poe.ninja), 90+ или 95+ — чем выше, тем «премиальнее» моды.
let demandLevel = 90;
window.pc.demandLevel().then((l) => { demandLevel = l; }).catch(() => {});
const levelSeg = () => `<div class="lvl-row"><span class="muted small">${t('Characters')}</span><div class="seg lvl" title="${t('Whose gear counts: higher level = players who pay for exact modifiers')}">${[80, 90, 95].map((l) =>
  `<button data-lvl="${l}"${l === demandLevel ? ' class="on"' : ''}>${l}+</button>`).join('')}</div></div>`;

function renderBuilds(b) {
  // Бейдж на вкладке Demand — чтобы фичу замечали, не открывая вкладку.
  const pct = b.allTotal ? b.total / b.allTotal * 100 : null;
  const anyHot = [...b.classes, ...b.skills].some((r) => r.pct >= 60);
  // Уровень спроса по числу персонажей (не по %: у нишевых вещей процент всегда мал, а спрос реальный).
  const lvl = !b.total ? null : b.total >= 2500 ? 'high' : b.total >= 300 ? 'med' : 'low';
  const badge = $('demandBadge');
  badge.className = `badge ${lvl || ''}`;
  badge.textContent = lvl ? { high: `🔥 ${t('High')}`, med: t('Med'), low: t('Low') }[lvl] : '';
  badge.title = lvl ? `${t('{n} level {lvl}+ characters on poe.ninja use this', { n: b.total, lvl: demandLevel })}${pct != null ? ` (${t('{pct}% of builds', { pct: fmt(pct) })})` : ''}${anyHot ? ` · ${t('one build archetype dominates')}` : ''}` : '';
  const chars = t('{n} characters', { n: b.total });
  const share = b.allTotal ? `${t('<b>{pct}%</b> of builds', { pct: fmt(b.total / b.allTotal * 100) })} · ${chars}` : chars;
  const what = b.filters.filter(([k]) => k !== 'min-level').map(([, v]) => v).join(' + ');
  $('builds').innerHTML = `
    <div class="sect"><span>${t('Popular builds')}</span></div>
    ${levelSeg()}
    <div class="bshare">${share}</div>
    <div class="bwhat muted" title="${t('poe.ninja filter')}">${esc(what)}</div>
    ${b.total ? `<div class="bcols">
      <div><div class="k">${t('Ascendancy')}</div>${buildRows(b.classes.slice(0, 4))}</div>
      <div><div class="k">${t('Main skill')}</div>${buildRows(b.skills.slice(0, 4))}</div>
    </div>` : voidState('◇', t('No builds use this'), t('No characters on poe.ninja wear this combination.'))}
    ${uniqueModsHtml(b)}
    ${b.ignored && b.ignored.length ? `<div class="muted small">${t('Not on poe.ninja:')} ${esc(b.ignored.map((x) => Object.values(x)[0]).join(' · '))}</div>` : ''}
    <button class="link bopen" data-url="${esc(b.page)}">poe.ninja ↗</button>`;
}

// Уник со случайными модами (Heart of the Well, Megalomaniac…): какие из его модов носят билды.
// Постоянные моды есть на каждой копии (~100%) — их не показываем; свои — всегда, с местом в рейтинге.
const modKey = (s) => String(s || '').replace(/ \(Local\)$/, '').replace(/[+-]?\d+(\.\d+)?/g, '#').replace(/\+#/g, '#').toLowerCase();
function uniqueModsHtml(b) {
  if (!b.mods || !b.mods.length || !state.filters) return '';
  const mine = new Set();
  for (const m of state.filters.mods) {
    if (m.template) mine.add(modKey(m.template));
    for (const l of String(m.text || '').split('\n')) mine.add(modKey(l));
  }
  const all = b.mods.filter((r) => r.pct < 95).map((r, i) => ({ ...r, rank: i + 1, mine: mine.has(modKey(r.name)) }));
  const rows = all.filter((r) => r.rank <= 10 || r.mine);
  if (!rows.length) return '';
  return demandList('umods', t('Which of its modifiers builds use'), rows);
}
