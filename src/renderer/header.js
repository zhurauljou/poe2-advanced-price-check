// Header (name and base — search toggles), league list, check history, in-game style item tooltip.
// The window parts are plain scripts sharing one global scope (index.html loads them in order).

// ---- header and tooltip, as in the game ----
// Name and base in the header are search toggles: "this exact unique" and "this exact base"
// (expensive bases), otherwise we search the whole category.
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
    nameEl.title = t('Searching this unique only — click to search any unique on this base');
  } else if (item.rarity === 'Unique' && two) {
    nameEl.classList.add('pick');
    nameEl.title = t('Click to search this unique only');
  }
  if (!f.useName && f.category) {
    baseEl.classList.add('pick');
    if (f.useType) baseEl.classList.add('on');
    baseEl.title = f.useType ? t('Searching this base only — click to search any item of this class')
      : t('Searching any item of this class — click to search this base only');
  }
}

// League picker — a custom dropdown: regular leagues on top, hardcore (HC / Hardcore) below, with a red tag.
const isHC = (l) => /^(HC |Hardcore)/.test(l);

// A name or base cut off with an ellipsis in the header — full text in the tooltip (ahead of the click hint).
function fullNameTitles() {
  requestAnimationFrame(() => {
    for (const el of [$('name'), $('base')]) {
      if (el.scrollWidth <= el.clientWidth) continue;
      el.title = el.textContent + (el.title ? `\n${el.title}` : '');
    }
  });
}

function renderLeagues() {
  $('leagueName').textContent = state.league;
  // Current season: trade returns leagues newest to oldest — the first one that isn't Standard and isn't hardcore.
  const season = state.leagues.find((l) => !isHC(l) && l !== 'Standard');
  const isSeason = (l) => season && (l === season || l === `HC ${season}`);
  const item = (l) => `<button data-league="${esc(l)}"${l === state.league ? ' class="on"' : ''}>${esc(l.replace(/^HC /, ''))}${isHC(l) ? '<span class="hc">HC</span>' : ''}${isSeason(l) ? `<span class="cur" title="${t('Current league')}">${t('current')}</span>` : ''}${l === state.league ? '<span class="chk">✓</span>' : ''}</button>`;
  const soft = state.leagues.filter((l) => !isHC(l));
  const hard = state.leagues.filter(isHC);
  $('leagueMenu').innerHTML = soft.map(item).join('') + (hard.length ? '<div class="lsep"></div>' + hard.map(item).join('') : '');
}

function toggleLeagueMenu(open) {
  const on = open != null ? open : $('leagueMenu').hidden;
  $('leagueMenu').hidden = !on;
  $('ldrop').classList.toggle('open', on);
  if (on) { toggleHistory(false); fit(); }
}

// ---- check history: recent items with their estimate; click — check again (the window stays in place) ----
async function toggleHistory(open) {
  const on = open != null ? open : $('histMenu').hidden;
  $('histMenu').hidden = !on;
  $('hdrop').classList.toggle('open', on);
  if (!on) return;
  toggleLeagueMenu(false);
  const list = await window.pc.history().catch(() => []);
  $('histMenu').innerHTML = list.length ? list.map((h) => `<button data-hist="${esc(h.id)}"${state && h.id === state.historyId ? ' class="on"' : ''}>
      <span class="h-name">${esc(h.rarity === 'Rare' || h.rarity === 'Unique' ? h.name : h.baseType || h.name)}</span>
      ${h.rarity === 'Rare' || h.rarity === 'Unique' ? `<span class="h-base">${esc(h.baseType)}</span>` : ''}
      <span class="h-est">${h.est != null ? money(h.est) : '—'}</span><span class="h-ago">${ago(h.at)}</span></button>`).join('')
    : `<div class="h-empty">${esc(t('No checks yet'))}</div>`;
  fit();
}
$('histBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleHistory(); });
$('histMenu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-hist]');
  if (!b) return;
  toggleHistory(false);
  window.pc.historyOpen(b.dataset.hist);
});

// The estimate goes to history, plus a "last time" line (same item, same league) under the estimate.
function recordPrice(est) {
  if (state && state.historyId && est != null) window.pc.historyPrice(state.historyId, est).catch(() => {});
}
function prevCheckHtml() {
  const p = state && state.previous;
  if (!p || p.est == null) return '';
  return `<div class="prev-check">${esc(t('Last check {ago} ago:', { ago: ago(p.at) }))} <b>≈ ${money(p.est)}</b></div>`;
}

// Tooltip property → defence filter (state.filters.props by key).
// Property line → trade filter. Damage by type is searched as DPS: physical — pDPS, elemental — eDPS.
const PROP_KEY = { Armour: 'ar', 'Evasion Rating': 'ev', 'Energy Shield': 'es', Spirit: 'spirit',
  'Physical Damage': 'pdps', 'Fire Damage': 'edps', 'Cold Damage': 'edps', 'Lightning Damage': 'edps',
  'Critical Hit Chance': 'crit', 'Attacks per Second': 'aps', 'Uses Remaining': 'uses' };
const PROP_OP = { pdps: 'pDPS ≥', edps: 'eDPS ≥', map_tier: '=' };
// A tablet priced among full ones (exactly 10 uses) — "= 10", not "≥".
const propOp = (p) => (p.key === 'uses' && p.max != null && Number(p.max) === Number(p.min) ? '=' : PROP_OP[p.key] || '≥');
// A used tablet priced by full ones: "6 of 10 · priced from full ones" instead of a confusing "6 = 10".
const usesFromFull = (p) => p.key === 'uses' && p.enabled && p.full && p.value < p.full && Number(p.min) === p.full && state.searchable;
const usesHtml = (i, p) => `<span class="tp on" data-ref="p:${i}" title="${esc(t('Partly used tablets are rarely listed — priced as a full one, scaled by the uses left (an assumption)'))} · ${esc(t('Searching by this — click to ignore'))}">${esc(p.label)}: <b>${p.value}</b> ${esc(t('of {n}', { n: p.full }))} <span class="tp-op">· ${esc(t('priced from full ones'))}</span></span>`;
// Waystone mods dangerous for many builds.
const WAYSTONE_DANGER = [
  [/cannot Regenerate/i, 'No regeneration'],
  [/(less|reduced) Recovery Rate/i, 'Less recovery'],
  [/-\d+% to (all )?maximum .*Resistances?/i, 'Lower maximum resistances'],
  [/Cursed with/i, 'Players are cursed'],
  [/Monsters have \d+% (increased Critical Hit Chance|Critical Damage Bonus)/i, 'Monster critical hits'],
  [/Penetrate/i, 'Monsters penetrate resistances'],
  [/additional Projectiles/i, 'Extra monster projectiles'],
];

// A tooltip value you can search by: a click enables it, next to it — the search bound.
// ref: 'p:<i>' — defence/DPS filter, 'm:<key>' — level/ilvl/sockets.
function pick(ref, label, valueHtml, filter, op, field) {
  if (!filter || !state.searchable) return `${label}: ${valueHtml}`;
  const bound = filter.enabled
    ? ` <span class="tp-op">${op}</span><input type="number" class="tp-in" data-ref="${ref}" data-f="${field}" value="${filter[field] ?? ''}">`
    : '';
  return `<span class="tp${filter.enabled ? ' on' : ''}" data-ref="${ref}" title="${filter.enabled ? t('Searching by this — click to ignore') : t('Click to search by this')}">${label}: ${valueHtml}${bound}</span>`;
}

// Tooltip line: values side by side, wrapped as whole units (no "·" at the end of a line).
const row = (items) => `<div class="row">${items.map((x) => `<span>${x}</span>`).join('')}</div>`;

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
      if (p.k === 'Grants Skill') return pick('m:skill', 'Grants Skill', v, f.skill, t('level ≥'), 'min');
      // Waystone properties — by the in-game label (pricing.propFilters puts it in label).
      let i = propIdx(PROP_KEY[p.k]);
      if (i < 0) i = props.findIndex((x) => x.group === 'map' && x.label === p.k);
      return i < 0 ? `${esc(p.k)}: ${v}` : pick(`p:${i}`, esc(p.k), v, props[i], propOp(props[i]), 'min');
    });
    // DPS isn't in the in-game tooltip — shown as a separate line so it can be searched by too. Tablet
    // uses — likewise: in the game it's an implicit line ("6 uses remaining"), not a property.
    const dps = ['dps', 'uses'].map(propIdx).filter((i) => i >= 0)
      .map((i) => (usesFromFull(props[i]) ? usesHtml(i, props[i]) : pick(`p:${i}`, props[i].label, `<b>${fmt(props[i].value)}</b>`, props[i], propOp(props[i]), 'min')));
    plines.push(...dps);
    if (plines.length) lines.push(row(plines));

    const meta = [];
    if (item.requires) {
      const rest = esc(item.requires.replace(/^Level \d+,?\s*/, ''));
      meta.push(item.reqLevel
        ? `Requires: ${pick('m:reqLevel', 'Level', `<b>${item.reqLevel}</b>`, f.reqLevel, '≤', 'max')}${rest ? `<span class="req-rest">, <b>${rest}</b></span>` : ''}`
        : `Requires: <b>${esc(item.requires)}</b>`);
    }
    if (item.ilvl) {
      // Crafting base: bounds are tier steps (main: craft.ilvlBand); the hint — what unlocks at the next one.
      let il = pick('m:ilvl', 'Item Level', `<b>${item.ilvl}</b>`, f.ilvl, '≥', 'min');
      if (f.ilvl && f.ilvl.enabled && state.searchable && f.ilvl.max) il += ` <span class="tp-op">≤</span><input type="number" class="tp-in" data-ref="m:ilvl" data-f="max" value="${f.ilvl.max}">`;
      if (f.ilvl && f.ilvl.next) il = `<span title="${esc(t('Same modifier tiers up to {max}; at {level} unlocks: {mods}', { max: f.ilvl.next.level - 1, level: f.ilvl.next.level, mods: f.ilvl.next.mods.slice(0, 4).join(', ') }))}">${il}</span>`;
      meta.push(il);
    }
    if (item.gemLevel) meta.push(pick('m:gemLevel', 'Level', `<b>${item.gemLevel}</b>`, f.gemLevel, '≥', 'min'));
    if (item.sockets) meta.push(pick('m:sockets', 'Sockets', `<b>${'◆ '.repeat(item.sockets).trim()}</b>`, f.sockets, '≥', 'min'));
    if (meta.length) lines.push(row(meta));
  }
  const flags = [];
  // States (Corrupted, Sanctified, Mirrored…) are toggles: an enabled one requires the same on the listing.
  const fl = (state.searchable && f.flags) || [];
  if (item.unidentified && !fl.some((x) => x.key === 'identified')) flags.push('<span class="corrupt">Unidentified</span>');
  // State — three positions by click: only as on your item → only the opposite → doesn't matter.
  fl.forEach((x, i) => {
    const v = x.enabled ? x.value : x.own;
    const not = t('Not {lname}', { name: x.name, lname: x.name.toLowerCase() });
    const label = v ? x.name : not;
    const next = !x.enabled ? t('only such items') : x.value === x.own ? t('only "{label}"', { label: x.value ? not : x.name }) : t('any');
    flags.push(`<span class="tp flag ${x.key === 'corrupted' && v ? 'corrupt' : 'cls'}${x.enabled ? ' on' : ''}${v ? '' : ' neg'}" data-ref="f:${i}"
      title="${esc(x.enabled ? t('Searching only: {label}', { label }) : t('Ignored — any'))} · ${t('click:')} ${esc(next)}">${esc(label)}${x.enabled ? '' : ` <small>· ${t('any')}</small>`}</span>`);
  });
  if (!fl.length) {
    if (item.corrupted) flags.push(`<span class="corrupt">${item.twiceCorrupted ? 'Twice Corrupted' : 'Corrupted'}</span>`);
    if (item.mirrored) flags.push('<span class="cls">Mirrored</span>');
  }
  if (flags.length) lines.push(row(flags));
  // Waystone: mods dangerous for many builds — visible before buying or running it.
  if (item.itemClass === 'Waystones') {
    const danger = WAYSTONE_DANGER.filter(([re]) => (item.modLines || []).some((l) => re.test(l.text))).map(([, label]) => `<span class="danger">⚠ ${esc(t(label))}</span>`);
    if (danger.length) lines.push(row(danger));
  }
  $('tooltip').innerHTML = lines.join('<div class="sep"></div>');
}
