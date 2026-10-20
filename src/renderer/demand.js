// Demand tab (poe.ninja): popular builds, bases and mods of the item class; window tabs.
// The window parts are plain scripts sharing one global scope (index.html loads them in order).

// ---- popular builds (poe.ninja) ----
// Unique — by name; rare/magic — category, base (if selected in the header) and the 2–3 most important
// enabled mods: with the full mod list, ninja has almost no builds left.
function buildsQuery() {
  const { item, filters: f } = state;
  if (!f) return null;
  if (item.rarity === 'Unique' && f.useName) return { uniqueName: item.name };
  if (!['Rare', 'Magic', 'Normal'].includes(item.rarity) || !f.category) return null;
  const mods = f.mods.filter((m) => m.enabled && m.statId && m.tag !== 'pseudo' && m.tag !== 'implicit' && m.tag !== 'rune')
    .sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 3).map((m) => m.text.split('\n')[0]);
  // White and magic items are crafting bases: they're worn as rares, so demand is by rares (almost nobody wears magic).
  return { itemClass: item.itemClass, rarity: 'Rare', baseType: f.useType ? item.baseType : undefined, mods };
}

let buildsSeq = 0;
// Latest Demand tab data — to re-render on language change.
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

// ---- demand by category (poe.ninja): which bases and mods are worn on such items ----
let demandSeq = 0;
let demandAll = false; // true — demand across all builds of the class, without the item's theme
async function loadDemand() {
  const { item, filters: f } = state;
  const box = $('demand');
  if (!f || !f.category || !['Rare', 'Magic', 'Normal'].includes(item.rarity)) { box.hidden = true; return; }
  const seq = ++demandSeq;
  box.hidden = false;
  lastDemand = null;
  box.innerHTML = `<div class="sect"><span>${t('Demand')}</span></div><div class="muted center">${t('Loading from poe.ninja…')}</div>`;
  try {
    // By default — among builds wearing such an item with the mods that define its archetype: the same theme the craft
    // advice uses (main.js themeMods), so both tabs talk about the same builds; older payloads — the key filter mods.
    const q = buildsQuery();
    const withMods = demandAll || !q ? [] : (state.theme && state.theme.length ? state.theme : (q.mods || []).slice(0, 2));
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

// Mod template as ninja has it: "# to maximum Life", "#% to Fire Resistance" — our trade template without "(Local)".
// poe.ninja templates have no "+" ("# maximum stacks of Puppet Master"), while trade's crafted ones do ("+# maximum stacks…").
const ninjaTemplate = (t) => (t || '').replace(/ \(Local\)$/, '').replace(/\+#/g, '#').toLowerCase();

function renderDemand(d) {
  const { item, filters: f } = state;
  if (!d.category || !d.total) {
    $('demand').innerHTML = `<div class="sect"><span>${t('Demand')}</span></div>${voidState('◇', t('No poe.ninja data'), t('poe.ninja has no build stats for this item class.'))}`;
    return;
  }
  const mine = new Set(f.mods.filter((m) => m.template).map((m) => ninjaTemplate(m.template)));
  // Top 10 + all mods of your item, even outside the top (with rank): a key mod of a narrow theme (+minion levels)
  // may not make the class's overall top, but for buyers with that theme it's the main one.
  const TOP = 10;
  // Theme mods are by definition at 100% for such builds — they say nothing in the list.
  const themeSet = new Set((d.themed || []).map((x) => x.toLowerCase()));
  const all = d.mods.filter((r) => !themeSet.has(r.name.toLowerCase())).map((r, i) => ({ ...r, rank: i + 1, mine: mine.has(ninjaTemplate(r.name)) }));
  const modRows = all.filter((r) => r.rank <= TOP || r.mine);
  const hits = all.filter((r) => r.mine && r.rank <= TOP).length;
  const baseRows = d.bases.slice(0, TOP).map((r) => ({ ...r, mine: r.name === item.baseType }));
  const baseRank = d.bases.findIndex((b) => b.name === item.baseType);
  $('demand').innerHTML = `
    <div class="sect"><span>${t('Demand')} · ${esc(d.category)}</span></div>
    ${d.onBase ? `<div class="bwhat" title="${esc(t('Jewel demand differs a lot by color and between regular and Time-Lost jewels'))}">${t('Only builds with {base}', { base: `<b class="theme">${esc(d.onBase)}</b>` })}</div>` : ''}
    ${d.themed && d.themed.length
      ? `<div class="bwhat">${t('Among builds wearing it with')} <b class="theme">${d.themed.map(esc).join(' + ')}</b> · <button class="link" data-dall="1">${t('all builds')}</button></div>`
      : `<div class="bwhat muted">${demandAll ? `${t('All builds')} · <button class="link" data-dall="0">${t('builds like your item')}</button>` : t("Too few builds with your item's modifiers — showing all builds")}</div>`}
    <div class="bshare">${t('Worn by <b>{pct}%</b> of level {lvl}+ builds', { pct: fmt(d.total / d.allTotal * 100), lvl: demandLevel })}</div>
    <div class="bwhat muted">${t('Your item:')} ${baseRank >= 0 ? t('base #{n}', { n: baseRank + 1 }) : t('base not in top 10')} · ${t('{n} of top {m} modifiers', { n: hits, m: Math.min(TOP, all.length) })}</div>
    ${demandList('bases', t('Most worn bases'), baseRows)}
    ${demandList('mods', t('Most common modifiers'), modRows)}
    <button class="link bopen" data-url="${esc(d.page)}">poe.ninja ↗</button>`;
}

// Demand list: 5 rows right away + everything on your item; the rest — via "Show all".
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

// How sought-after: < 10% — dimmed (almost nobody needs it), ≥ 60% — highlighted (almost everyone needs it).
const heat = (pct) => (pct >= 60 ? 'hot' : pct < 10 ? 'cold' : '');
const hot = (pct) => (pct >= 60 ? `<span class="flame" title="${t('Most builds use this')}">🔥</span>` : '');

function buildRows(rows) {
  return rows.map((r) => `
    <div class="brow ${heat(r.pct)}"><span class="bname">${esc(r.name)}</span><span class="bpct">${hot(r.pct)}${fmt(r.pct)}%</span>
      <span class="bbar"><i data-w="${Math.min(100, r.pct)}%"></i></span></div>`).join('');
}

// Whose demand we count: characters 80+ (everyone poe.ninja sees), 90+, 95+ or 98+ (the high end: ~18k characters) — the higher,
// the more "premium" the mods.
let demandLevel = 90;
window.pc.demandLevel().then((l) => { demandLevel = l; }).catch(() => {});
const levelSeg = () => `<div class="lvl-row"><span class="muted small">${t('Characters')}</span><div class="seg lvl" title="${t('Whose gear counts: higher level = players who pay for exact modifiers')}">${[80, 90, 95, 98].map((l) =>
  `<button data-lvl="${l}"${l === demandLevel ? ' class="on"' : ''}>${l}+</button>`).join('')}</div></div>`;

function renderBuilds(b) {
  // Badge on the Demand tab — so the feature gets noticed without opening the tab.
  const pct = b.allTotal ? b.total / b.allTotal * 100 : null;
  const anyHot = [...b.classes, ...b.skills].some((r) => r.pct >= 60);
  // Demand level by character count (not by %: for niche items the percentage is always small, yet demand is real).
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

// Unique with random mods (Heart of the Well, Megalomaniac…): which of its mods builds wear.
// Fixed mods are on every copy (~100%) — not shown; yours — always, with rank.
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
