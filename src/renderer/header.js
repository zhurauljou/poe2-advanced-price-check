// Шапка (название и база — переключатели поиска), список лиг, история проверок, подсказка предмета как в игре.
// Части окна — обычные скрипты с общей областью видимости (index.html подключает их по порядку).

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

// Выбор лиги — своя выпадашка: обычные лиги сверху, хардкор (HC / Hardcore) — ниже, с красным тегом.
const isHC = (l) => /^(HC |Hardcore)/.test(l);

// Обрезанное многоточием имя или база в шапке — полный текст в подсказке (впереди подсказки про клик).
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
  // Текущий сезон: трейд отдаёт лиги от новой к старой — первая не Standard и не хардкор.
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

// ---- история проверок: последние вещи с оценкой; клик — проверить снова (окно остаётся на месте) ----
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

// Оценку — в историю, и строка «в прошлый раз» (та же вещь, та же лига) под оценкой.
function recordPrice(est) {
  if (state && state.historyId && est != null) window.pc.historyPrice(state.historyId, est).catch(() => {});
}
function prevCheckHtml() {
  const p = state && state.previous;
  if (!p || p.est == null) return '';
  return `<div class="prev-check">${esc(t('Last check {ago} ago:', { ago: ago(p.at) }))} <b>≈ ${money(p.est)}</b></div>`;
}

// Свойство подсказки → фильтр защиты (state.filters.props по key).
// Строка свойства → фильтр трейда. Урон по типам ищется как DPS: физический — pDPS, стихийный — eDPS.
const PROP_KEY = { Armour: 'ar', 'Evasion Rating': 'ev', 'Energy Shield': 'es', Spirit: 'spirit',
  'Physical Damage': 'pdps', 'Fire Damage': 'edps', 'Cold Damage': 'edps', 'Lightning Damage': 'edps',
  'Critical Hit Chance': 'crit', 'Attacks per Second': 'aps' };
const PROP_OP = { pdps: 'pDPS ≥', edps: 'eDPS ≥', map_tier: '=' };
// Моды путевого камня, опасные для многих билдов.
const WAYSTONE_DANGER = [
  [/cannot Regenerate/i, 'No regeneration'],
  [/(less|reduced) Recovery Rate/i, 'Less recovery'],
  [/-\d+% to (all )?maximum .*Resistances?/i, 'Lower maximum resistances'],
  [/Cursed with/i, 'Players are cursed'],
  [/Monsters have \d+% (increased Critical Hit Chance|Critical Damage Bonus)/i, 'Monster critical hits'],
  [/Penetrate/i, 'Monsters penetrate resistances'],
  [/additional Projectiles/i, 'Extra monster projectiles'],
];

// Значение в подсказке, по которому можно искать: клик включает, рядом — граница поиска.
// ref: 'p:<i>' — фильтр защиты/DPS, 'm:<key>' — уровень/ilvl/гнёзда.
function pick(ref, label, valueHtml, filter, op, field) {
  if (!filter || !state.searchable) return `${label}: ${valueHtml}`;
  const bound = filter.enabled
    ? ` <span class="tp-op">${op}</span><input type="number" class="tp-in" data-ref="${ref}" data-f="${field}" value="${filter[field] ?? ''}">`
    : '';
  return `<span class="tp${filter.enabled ? ' on' : ''}" data-ref="${ref}" title="${filter.enabled ? t('Searching by this — click to ignore') : t('Click to search by this')}">${label}: ${valueHtml}${bound}</span>`;
}

// Строка подсказки: значения рядом, переносятся целиком (без «·» в конце строки).
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
      // Свойства путевого камня — по подписи из игры (pricing.propFilters кладёт её в label).
      let i = propIdx(PROP_KEY[p.k]);
      if (i < 0) i = props.findIndex((x) => x.group === 'map' && x.label === p.k);
      return i < 0 ? `${esc(p.k)}: ${v}` : pick(`p:${i}`, esc(p.k), v, props[i], PROP_OP[props[i].key] || '≥', 'min');
    });
    // DPS в игровой подсказке нет — показываем отдельной строкой, чтобы по нему тоже можно было искать.
    const dps = ['dps'].map(propIdx).filter((i) => i >= 0)
      .map((i) => pick(`p:${i}`, props[i].label, `<b>${fmt(props[i].value)}</b>`, props[i], '≥', 'min'));
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
      // База под крафт: границы — ступени тиров (main: craft.ilvlBand); подсказка — что откроется на следующей.
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
  // Состояния (Corrupted, Sanctified, Mirrored…) — переключатели: включённое требует то же у лота.
  const fl = (state.searchable && f.flags) || [];
  if (item.unidentified && !fl.some((x) => x.key === 'identified')) flags.push('<span class="corrupt">Unidentified</span>');
  // Состояние — три положения по клику: только как у вашей вещи → только противоположное → неважно.
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
  // Путевой камень: моды, опасные для многих билдов, — заметно, до того как его купить или пройти.
  if (item.itemClass === 'Waystones') {
    const danger = WAYSTONE_DANGER.filter(([re]) => (item.modLines || []).some((l) => re.test(l.text))).map(([, label]) => `<span class="danger">⚠ ${esc(t(label))}</span>`);
    if (danger.length) lines.push(row(danger));
  }
  $('tooltip').innerHTML = lines.join('<div class="sep"></div>');
}
