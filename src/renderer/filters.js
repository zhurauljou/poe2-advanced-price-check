// Search filters: mods, their importance, rolls and bounds.
// The window parts are plain scripts sharing one global scope (index.html loads them in order).

// ---- filters ----

// Mod importance scale for price: 0–3 pips (key for the slot × tier quality). Key mods — in gold.
const IMPACT = ['minor', 'low', 'medium', 'high'];
function meter(m) {
  if (m.importance == null) return '';
  const n = m.importance >= 2.4 ? 3 : m.importance >= 1.6 ? 2 : m.importance >= 0.8 ? 1 : 0;
  const title = `${t('Price impact:')} ${t(IMPACT[n])}${m.key ? ` — ${t('key modifier for this slot')}` : ''}${m.tier ? `, ${t('tier {n}', { n: m.tier })}` : ''}`;
  return `<span class="imp i${n}${m.key ? ' key' : ''}" title="${title}"><i></i><i></i><i></i></span>`;
}

// Mod row — in even columns, like the in-game tooltip: [checkbox][importance][tier][text · category][min].
// Category (desecrated, rune…) goes after the text so tags of different widths don't shift the mod itself.
// Tier range and roll quality: "36–40", a near-max roll gets a gold max mark.
function rollInfo(m) {
  if (!m.range || m.roll == null) return '';
  // The max mark — only on a max roll of the best tier (T1): on other tiers it means little.
  const max = m.tier === 1 && m.roll >= 0.9 ? `<span class="maxroll" title="${t('Near max roll of the top tier — usually worth more')}">${t('max roll')}</span>` : '';
  return ` <span class="rng" title="${t('Tier range · roll {n}%', { n: Math.round(m.roll * 100) })}">${fmt(m.range.lo)}${m.range.lo < 0 ? t(' to ') : '–'}${fmt(m.range.hi)}</span>${max}`;
}

// Which sums are expanded (reset on a new item).
const openSums = new Set();

function modRow(m, i) {
  if (!m.statId) {
    return `<div class="mod nomatch" title="${t('This modifier has no trade site filter')}">
      <label><span class="cb"></span><span class="imp"></span><span class="tcol">?</span><span class="txt">${esc(m.text)}</span></label></div>`;
  }
  const tier = m.tag === 'pseudo' ? `<span class="tcol sigma" title="${t('Total from all modifiers')}">Σ</span>`
    : `<span class="tcol">${m.tier ? `<span class="tag tier${m.tier <= 2 ? ' top' : ''}">T${m.tier}</span>` : ''}</span>`;
  // Identical mods — each on its own row, the filter is shared: trade searches by the sum.
  // Demand from poe.ninja: a widely used mod is a reason to enable it, even if the tier is weak. On the row only 🔥 for
  // most builds (60%+); the number is in the tooltip — «85.1% builds» on every row pulled the eye off the mod itself.
  const demand = m.demand >= 30 ? t('{pct}% of level {lvl}+ builds wearing this item class have this modifier (poe.ninja)', { pct: fmt(m.demand), lvl: demandLevel }) : '';
  const title = m.parts ? m.parts.map((p) => `${p.text}${p.tier ? ` (T${p.tier})` : ''}`).join('\n') : demand;
  const from = title ? ` title="${esc(title)}"` : '';
  // The kind (fractured, crafted…) as a quiet word in its colour, not a framed badge; the mod text has that colour too.
  const cat = m.tag !== 'explicit' && m.tag !== 'pseudo' ? ` <span class="kind ${esc(m.tag)}">${esc(t(m.tag))}</span>` : '';
  const fire = m.demand >= 60 ? `<span class="dem hot" title="${esc(demand)}">🔥</span>` : '';
  const text = m.tag === 'pseudo' ? m.text.replace(/^Σ /, '') : m.text;
  // The tier range, max roll and 🔥 sit in their own column on the right: inside the text they pushed it onto a second line.
  return `<div class="mod t-${esc(m.tag)}${m.enabled ? '' : ' off'}" data-i="${i}">
      <label><input type="checkbox" data-k="enabled"${m.enabled ? ' checked' : ''}>${meter(m) || '<span class="imp"></span>'}${tier}
        <span class="txt"${from}>${esc(text)}${m.merged ? `<span class="sum-v"> = ${fmt(m.value)}</span>` : ''}${cat}${driveChip(i)}</span>
        <span class="meta">${fire}${rollInfo(m).trim()}</span></label>
      ${m.option ? '' : `<span class="range-in"><input type="number" data-k="min" step="any" placeholder="${t('min')}" value="${m.min == null ? '' : m.min}"><input type="number" class="max${m.max == null ? ' empty' : ''}" data-k="max" step="any" placeholder="${t('max')}" title="${esc(t('Upper limit (optional): e.g. exactly +4, so +5 items do not count'))}" value="${m.max == null ? '' : m.max}"></span>`}
    </div>`;
}

// Price currency on trade: any (converted) or only listings in a specific currency.
const CURRENCIES = [['any', 'Any'], ['divine', 'Divine'], ['chaos', 'Chaos'], ['exalted', 'Exalted']];

function renderFilters() {
  const box = $('filters');
  box.hidden = !state.searchable;
  if (!state.searchable) return;
  const f = state.filters;
  // Parts of sums (Σ resistances, Σ life) — under their sum, collapsed under "▸ N mods"; an enabled part expands it.
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
  // "Without the key mod": almost all builds wear it, but the item lacks it — compare with equally incomplete items.
  (f.exclude || []).forEach((x, j) => rows.push(`<div class="mod excl${x.enabled ? '' : ' off'}" data-x="${j}" title="${esc(t('Listings that have this modifier are excluded — your item lacks it'))}">
      <label><input type="checkbox" data-k="exclude"${x.enabled ? ' checked' : ''}><span class="imp"></span><span class="tcol">≠</span>
        <span class="txt">${esc(t('Without: {mod}', { mod: x.text }))} <span class="dem hot">🔥 ${esc(t('{pct}% builds', { pct: fmt(x.pct) }))}</span></span></label></div>`));
  if (f.hiddenFixed) rows.push(`<div class="muted small center">${esc(t('{n} fixed modifiers hidden — every copy has them', { n: f.hiddenFixed }))}</div>`);
  $('mods').innerHTML = rows.join('');
  // Defence/DPS, levels and sockets are picked right in the tooltip under the header — here, price currency and "online".
  $('misc').innerHTML = `
    <div class="seg" title="${t('Which currency listings to search')}">${CURRENCIES.map(([id, label]) =>
      `<button data-cur="${id}"${f.priceCurrency === id ? ' class="on"' : ''}>${id === 'any' ? t(label) : label}</button>`).join('')}</div>
    <label class="opt${f.online ? '' : ' off'}"><input type="checkbox" data-o="online"${f.online ? ' checked' : ''}><span title="${t('Instant Buyout or seller online — like the trade site default')}">${t('Buyable now')}</span></label>
    <label class="opt${f.flex ? '' : ' off'}"><input type="checkbox" data-o="flex"${f.flex ? ' checked' : ''}><span title="${t('With 3+ minor modifiers checked, find items that have all but one of them (key modifiers stay required)')}">${t('Allow 1 minor mod missing')}</span></label>`;
  // Variant mods (Legacy on Mageblood) are searched as "any N of the selected": the threshold can be changed by hand.
  const opts = f.mods.filter((m) => m.enabled && m.option).length;
  if (opts > 1) {
    $('misc').insertAdjacentHTML('afterbegin', `<label class="opt">${t('Match ≥')} <input type="number" data-optmin min="1" max="${opts}"
      value="${Math.min(opts, f.optionMin || opts)}"> ${t('of {n} checked', { n: opts })}</label>`);
  }
}
