// Фильтры поиска: моды, их важность, роллы и границы.
// Части окна — обычные скрипты с общей областью видимости (index.html подключает их по порядку).

// ---- фильтры ----

// Шкала важности мода для цены: 0–3 деления (ключевой для слота × качество тира). Ключевые — золотом.
const IMPACT = ['minor', 'low', 'medium', 'high'];
function meter(m) {
  if (m.importance == null) return '';
  const n = m.importance >= 2.4 ? 3 : m.importance >= 1.6 ? 2 : m.importance >= 0.8 ? 1 : 0;
  const title = `${t('Price impact:')} ${t(IMPACT[n])}${m.key ? ` — ${t('key modifier for this slot')}` : ''}${m.tier ? `, ${t('tier {n}', { n: m.tier })}` : ''}`;
  return `<span class="imp i${n}${m.key ? ' key' : ''}" title="${title}"><i></i><i></i><i></i></span>`;
}

// Строка мода — ровными колонками, как подсказка в игре: [галочка][важность][тир][текст · категория][мин].
// Категория (desecrated, rune…) — после текста, чтобы теги разной ширины не сдвигали сам мод.
// Диапазон тира и качество ролла: «36–40», у почти максимального — золотая пометка max.
function rollInfo(m) {
  if (!m.range || m.roll == null) return '';
  // Пометка max — только у максимального ролла лучшего тира (T1): на других тирах она мало что значит.
  const max = m.tier === 1 && m.roll >= 0.9 ? `<span class="maxroll" title="${t('Near max roll of the top tier — usually worth more')}">${t('max')}</span>` : '';
  return ` <span class="rng" title="${t('Tier range · roll {n}%', { n: Math.round(m.roll * 100) })}">${fmt(m.range.lo)}${m.range.lo < 0 ? t(' to ') : '–'}${fmt(m.range.hi)}</span>${max}`;
}

// Какие суммы раскрыты (сбрасывается на новом предмете).
const openSums = new Set();

function modRow(m, i) {
  if (!m.statId) {
    return `<div class="mod nomatch" title="${t('This modifier has no trade site filter')}">
      <label><span class="cb"></span><span class="imp"></span><span class="tcol">?</span><span class="txt">${esc(m.text)}</span></label></div>`;
  }
  const tier = m.tag === 'pseudo' ? `<span class="tcol sigma" title="${t('Total from all modifiers')}">Σ</span>`
    : `<span class="tcol">${m.tier ? `<span class="tag tier${m.tier <= 2 ? ' top' : ''}">T${m.tier}</span>` : ''}</span>`;
  // Одинаковые моды — каждый своей строкой, фильтр общий: трейд ищет по сумме.
  const from = m.parts ? ` title="${esc(m.parts.map((p) => `${p.text}${p.tier ? ` (T${p.tier})` : ''}`).join('\n'))}"` : '';
  const cat = (m.tag !== 'explicit' && m.tag !== 'pseudo' ? ` <span class="tag ${esc(m.tag)}">${esc(t(m.tag))}</span>` : '')
    // Спрос с poe.ninja: массовый мод — повод включить его, даже если тир слабый.
    + (m.demand >= 30 ? ` <span class="dem${m.demand >= 60 ? ' hot' : ''}" title="${t('{pct}% of level {lvl}+ builds wearing this item class have this modifier (poe.ninja)', { pct: fmt(m.demand), lvl: demandLevel })}">${m.demand >= 60 ? '🔥 ' : ''}${t('{pct}% builds', { pct: fmt(m.demand) })}</span>` : '');
  const text = m.tag === 'pseudo' ? m.text.replace(/^Σ /, '') : m.text;
  return `<div class="mod t-${esc(m.tag)}${m.enabled ? '' : ' off'}" data-i="${i}">
      <label><input type="checkbox" data-k="enabled"${m.enabled ? ' checked' : ''}>${meter(m) || '<span class="imp"></span>'}${tier}
        <span class="txt"${from}>${esc(text)}${m.merged ? `<span class="sum-v"> = ${fmt(m.value)}</span>` : ''}${cat}${rollInfo(m)}${driveChip(i)}</span></label>
      ${m.option ? '' : `<span class="range-in"><input type="number" data-k="min" step="any" placeholder="${t('min')}" value="${m.min == null ? '' : m.min}"><input type="number" class="max${m.max == null ? ' empty' : ''}" data-k="max" step="any" placeholder="${t('max')}" title="${esc(t('Upper limit (optional): e.g. exactly +4, so +5 items do not count'))}" value="${m.max == null ? '' : m.max}"></span>`}
    </div>`;
}

// Валюта цены на трейде: любая в пересчёте или только лоты в конкретной валюте.
const CURRENCIES = [['any', 'Any'], ['divine', 'Divine'], ['chaos', 'Chaos'], ['exalted', 'Exalted']];

function renderFilters() {
  const box = $('filters');
  box.hidden = !state.searchable;
  if (!state.searchable) return;
  const f = state.filters;
  // Части сумм (Σ сопротивлений, Σ жизни) — под своей суммой, свёрнуты под «▸ N mods»; включённая часть раскрывает.
  const rows = [];
  f.mods.forEach((m, i) => {
    if (m.inSum) return;
    rows.push(modRow(m, i));
    if (m.tag !== 'pseudo') return;
    const parts = f.mods.map((p, j) => [p, j]).filter(([p]) => p.inSum === m.statId);
    if (!parts.length) return;
    const open = openSums.has(m.statId) || parts.some(([p]) => p.enabled);
    rows.push(`<div class="sum-toggle" data-sum="${esc(m.statId)}">${open ? '▾' : '▸'} ${t('{n} mods in this total', { n: parts.length })}</div>`);
    if (open) rows.push(`<div class="sum-parts">${parts.map(([p, j]) => modRow(p, j)).join('')}</div>`);
  });
  // «Без ключевого мода»: его носят почти все билды, а на вещи его нет — сравниваем с такими же неполными вещами.
  (f.exclude || []).forEach((x, j) => rows.push(`<div class="mod excl${x.enabled ? '' : ' off'}" data-x="${j}" title="${esc(t('Listings that have this modifier are excluded — your item lacks it'))}">
      <label><input type="checkbox" data-k="exclude"${x.enabled ? ' checked' : ''}><span class="imp"></span><span class="tcol">≠</span>
        <span class="txt">${esc(t('Without: {mod}', { mod: x.text }))} <span class="dem hot">🔥 ${esc(t('{pct}% builds', { pct: fmt(x.pct) }))}</span></span></label></div>`));
  if (f.hiddenFixed) rows.push(`<div class="muted small center">${esc(t('{n} fixed modifiers hidden — every copy has them', { n: f.hiddenFixed }))}</div>`);
  $('mods').innerHTML = rows.join('');
  // Защита/DPS, уровни и гнёзда выбираются прямо в подсказке под шапкой — здесь валюта цены и «онлайн».
  $('misc').innerHTML = `
    <div class="seg" title="${t('Which currency listings to search')}">${CURRENCIES.map(([id, label]) =>
      `<button data-cur="${id}"${f.priceCurrency === id ? ' class="on"' : ''}>${id === 'any' ? t(label) : label}</button>`).join('')}</div>
    <label class="opt${f.online ? '' : ' off'}"><input type="checkbox" data-o="online"${f.online ? ' checked' : ''}><span title="${t('Instant Buyout or seller online — like the trade site default')}">${t('Buyable now')}</span></label>
    <label class="opt${f.flex ? '' : ' off'}"><input type="checkbox" data-o="flex"${f.flex ? ' checked' : ''}><span title="${t('With 3+ minor modifiers checked, find items that have all but one of them (key modifiers stay required)')}">${t('Allow 1 minor mod missing')}</span></label>`;
  // Моды-варианты (Legacy у Mageblood) ищутся «любые N из выбранных»: порог можно поменять руками.
  const opts = f.mods.filter((m) => m.enabled && m.option).length;
  if (opts > 1) {
    $('misc').insertAdjacentHTML('afterbegin', `<label class="opt">${t('Match ≥')} <input type="number" data-optmin min="1" max="${opts}"
      value="${Math.min(opts, f.optionMin || opts)}"> ${t('of {n} checked', { n: opts })}</label>`);
  }
}
