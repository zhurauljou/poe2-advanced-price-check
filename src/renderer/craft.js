// Вкладка крафта: план, его цена и цель, пошаговый крафт, белые базы, уники, рискованный финал.
// Части окна — обычные скрипты с общей областью видимости (index.html подключает их по порядку).

// ---- вкладка Craft: что и чем добавить/заменить. Грузим по открытию вкладки, один раз на предмет. ----
let craftFor = null;
async function loadCraft() {
  if (craftFor === state) return;
  const mine = craftFor = state;
  const box = $('craft');
  box.innerHTML = `<div class="sect"><span>${t('Craft')}</span></div><div class="muted center">${t('Loading mod pool…')}</div>`;
  fit();
  // Ответ для прежней вещи (пришла новая, пока считали) — не рисуем, ни советы, ни ошибку.
  try {
    const r = await window.pc.craft();
    if (craftFor === mine && state === mine) renderCraft(r);
  } catch (e) {
    if (craftFor !== mine || state !== mine) return;
    box.innerHTML = `<div class="sect"><span>${t('Craft')}</span></div>${voidState('⚠', t('Mod pool not loaded'), esc(errText(e)))}`;
  }
  fit();
}

// Кандидаты крафта по ключу кнопки «price?»: сколько будет стоить вещь, если этот мод встанет (нижний ролл тира).
const craftCands = new Map();
function craftRows(list) {
  const rows = list.map((c) => {
    const key = String(craftCands.size);
    craftCands.set(key, c);
    const btn = c.stats ? `<button class="link cprice" data-ck="${key}" title="${t('Search for your item with this modifier added (lowest roll of the tier)')}">${t('price?')}</button>` : '';
    return `
    <div class="brow ${heat(c.pct)}" data-row="${key}"><span class="bname">${esc(c.text)}<span class="craft-tier">T${c.tier}/${c.tiers}${c.range ? ` · ${esc(c.range)}` : ''}</span>${chanceTag(c.chance, c.chanceUnknown)}${c.essence ? `<span class="ess" title="${esc(t('{essence} makes a magic item rare with this modifier: {tiers}', { essence: c.essence.name, tiers: c.essence.tiers.join(' · ') }))}">◈ ${esc(c.essence.short)}</span>` : ''}${btn}</span>
      <span class="bpct">${hot(c.pct)}${fmt(c.pct)}%</span><span class="bbar"><i data-w="${Math.min(100, c.pct)}%"></i></span></div>`;
  }).join('');
  // «Оценить все»: по короткому поиску на строку, потом список — по приросту цены, лучший помечен.
  const priceable = list.filter((c) => c.stats).length;
  return `<div class="clist">${priceable > 1 ? `<button class="link cprice-all" data-priceall title="${esc(t('One trade search per row, then the list is sorted by how much each modifier adds to the price'))}">⇅ ${esc(t('Price all and sort'))}</button>` : ''}${rows}</div>`;
}

async function priceAll(btn) {
  const list = btn.closest('.clist');
  btn.disabled = true;
  btn.textContent = t('pricing…');
  // Сменили вещь посреди оценки — дальше не ищем (кнопки уже от старой вещи, лимит трейда не тратим).
  const mine = state;
  for (const b of [...list.querySelectorAll('[data-ck]')]) {
    if (state !== mine || !list.isConnected) return;
    if (await priceCraft(b) === 'limit') {
      // Лимит трейда: сортировать нечего — возвращаем кнопку, можно повторить позже.
      btn.disabled = false;
      btn.textContent = `⇅ ${t('Price all and sort')}`;
      return;
    }
  }
  const rows = [...list.querySelectorAll('.brow')];
  const val = (r) => (r.dataset.delta == null || r.dataset.delta === '' ? -1e9 : Number(r.dataset.delta));
  rows.sort((a, b) => val(b) - val(a)).forEach((r) => list.appendChild(r));
  const best = rows.find((r) => val(r) > 0);
  if (best) best.classList.add('best');
  for (const r of rows) if (val(r) <= 0) r.classList.add('flat');
  btn.remove();
  fit();
}

// Цена после крафта: текущие фильтры + мод-кандидат. Тот же стат уже есть (сумма) — минимум растёт на ролл кандидата.
async function priceCraft(b) {
  const c = craftCands.get(b.dataset.ck);
  if (!c || !state) return;
  const mine = state;
  b.disabled = true;
  b.textContent = '…';
  const f = withMods(JSON.parse(JSON.stringify(state.filters)), [c]);
  try {
    // Магическая вещь после Regal Orb — уже редкая: ищем среди редких.
    const it = state.item.rarity === 'Magic' ? { ...state.item, rarity: 'Rare' } : state.item;
    const q = await quickPrice(it, f);
    if (state !== mine) return; // пока искали, проверили другую вещь — её оценку не трогаем
    const v = estimate(q.lots);
    let html;
    const row = b.closest('.brow');
    if (v == null) html = `<span class="cpr" title="${t('Nothing like it is listed — could be rare and pricey')}">${t('none listed')}</span>`;
    else {
      const d = state.est != null ? v - state.est : null;
      const cls = d == null ? '' : d > state.est * 0.1 ? ' up' : d < -state.est * 0.1 ? ' down' : '';
      // Прирост — главное: крупно «+2.1 div», рядом итоговая цена вещи с модом.
      const delta = d == null ? '' : Math.abs(d) < state.est * 0.1 ? t('same') : `${d > 0 ? '+' : '−'}${money(Math.abs(d))}`;
      html = `<span class="cpr${cls}" title="${t('{n} listed with it · vs your current estimate', { n: q.total })}">${delta ? `<b>${delta}</b> · ` : ''}≈ ${money(v)}</span>`;
      if (row && d != null) row.dataset.delta = Math.abs(d) < state.est * 0.1 ? 0 : d;
    }
    b.outerHTML = html;
  } catch (e) {
    if (state !== mine) return;
    b.disabled = false;
    b.textContent = t('price?');
    setStatus(errText(e), true);
    if (isLimit(e)) return 'limit';
  }
  fit();
}

// Цель крафта: что оставить / убрать / добавить и по шагам; кнопка — оценка готовой вещи.
let craftGoal = null;
function goalHtml(g) {
  const row = (cls, mark, x, extra = '') => `<div class="g ${cls}"><i>${mark}</i>${esc(x.text)}${x.tier ? ` <span class="craft-tier">T${x.tier}</span>` : ''}${extra}</div>`;
  return `<div class="craft-sec goal"><div class="k" title="${esc(t('The best item this base can become — most wanted modifiers for its slots'))}">${esc(t('Goal'))}</div>
    ${g.keep.map((x) => row('keep', '✓', x, x.up ? ` <span class="tierup" title="${esc(t('Key modifier with a weak tier — a higher tier is worth more'))}">↑ ${esc(t('tier'))}</span>` : '')).join('')}
    ${g.remove.map((x) => row('remove', '✗', x)).join('')}
    ${g.add.map((x) => row('add', '+', x, ` <span class="dem${x.pct >= 60 ? ' hot' : ''}">${x.pct >= 60 ? '🔥 ' : ''}${esc(t('{pct}% builds', { pct: fmt(x.pct) }))}</span>${chanceTag(x.chance, x.chanceUnknown)}${x.essence ? ` <span class="ess">◈ ${esc(x.essence.short)}</span>` : ''}`)).join('')}
</div>`;
}

// Фильтры «как у готовой вещи»: убранные моды — выключены, добавленные — с нижним роллом тира, их исключение «без мода» — снято.
const tplKey = (s) => String(s || '').replace(/ \(local\)$/i, '').replace(/\+#/g, '#').toLowerCase();
function withMods(f, adds) {
  for (const c of adds) {
    for (const s of c.stats || []) {
      for (const x of f.exclude || []) if (x.statId === s.statId) x.enabled = false;
      const same = f.mods.find((m) => m.statId === s.statId);
      if (same) { same.enabled = true; same.min = Math.max(Number(same.min) || 0, (same.value || 0) + s.min); }
      else f.mods.push({ statId: s.statId, enabled: true, min: s.min, importance: 3, tag: 'explicit', text: c.text });
    }
  }
  return f;
}


// Примерный шанс мода при Exalted с оменом его стороны: метка «частый / средний / редкий» и «≈ 1 из N».
function chanceTag(p, unknown) {
  if (unknown) return ` <span class="chance unknown" title="${esc(t('Valuable modifiers cannot be estimated from trade listings — items with them are priced and listed differently'))}">${esc(t('chance ?'))}</span>`;
  if (p == null) return '';
  const cls = p >= 0.12 ? 'common' : p >= 0.04 ? 'uncommon' : 'rare';
  const label = { common: t('common'), uncommon: t('uncommon'), rare: t('rare') }[cls];
  return ` <span class="chance ${cls}" title="${esc(t('Rough estimate: Exalted Orb + omen of its side gives this modifier about 1 in {n} times', { n: Math.max(1, Math.round(1 / p)) }))}">${esc(label)} · ≈1/${Math.max(1, Math.round(1 / p))}</span>`;
}

// ---- Крафт для новичка: места на вещи, «продать или крафтить», план с затратами ----
let craftPrices = {}; // div за штуку валюты из плана (poe.ninja)
let goalValue; // цена цели: undefined — считаем, null — не нашлось
let goalBasis = 'exact'; // по чему цена цели: exact — точно такие, similar — похожие, partial — нижняя граница

// Места на вещи кружками: занят (цвет по тиру), свободен; fractured — с рамкой.
function slotsHtml(r) {
  const affixes = state.item.affixes || [];
  const side = (s) => {
    const mods = affixes.filter((a) => a.side === s);
    const dots = mods.map((a) => {
      const cls = a.tier == null ? '' : a.tier <= 2 ? 'top' : a.tier >= 5 ? 'weak' : 'mid';
      return `<i class="slot ${cls}${a.tag === 'fractured' ? ' frac' : ''}" title="${esc(`${a.name || ''}${a.tier ? ` · T${a.tier}` : ''}`)}">${a.tier ? a.tier : ''}</i>`;
    });
    for (let i = mods.length; i < r.max[s]; i++) dots.push(`<i class="slot free" title="${esc(t('free'))}"></i>`);
    return `<span class="slots-side"><span>${esc(t(s === 'prefix' ? 'Prefixes' : 'Suffixes'))}</span>${dots.join('')}</span>`;
  };
  return `<div class="slots">${side('prefix')}${side('suffix')}</div>`;
}

// Модель стоимости плана — в src/shared/plancost.js (её же используют тесты и симуляция).
const planner = PlanCost.create(() => ({ prices: craftPrices, goalValue, est: state.est }));
const { stepCost, expandPlan, EXALT_NAME } = planner;

// Валюта в шагах — цветными метками (сферы, омены, кости, эссенции): рецепт читается с одного взгляда.
function curKind(n) {
  if (/^Omen of /.test(n)) return 'omen';
  if (/(Rib|Jawbone|Collarbone|Cranium|Vertebrae)$/.test(n)) return 'bone';
  if (/Essence/.test(n)) return 'essence';
  return 'orb';
}
const curChips = (list) => list.map((n) => `<span class="cur ${curKind(n)}">${esc(n)}</span>`).join('<span class="plus">+</span>');

const STEP_LABEL = {
  augment: (s) => t('Add a {side} while it is magic', { side: t(s.side) }),
  rune: (s) => t('Socket the rune: «{mod}» (permanent)', { mod: s.mod }) + (s.free ? '' : ` — ${t("needs a free augment socket (Artificer's Orb)")}`),
  regal: () => t('Make it rare'),
  essence: (s) => t('Make it rare with {mod}', { mod: s.mod }),
  remove: (s) => t('Remove {mod}', { mod: s.mod || s.mods.join(', ') }),
  add: (s) => t('Add {mod}', { mod: s.mod }) + (s.orMods && s.orMods.length ? ` (${t('or {mods}', { mods: s.orMods.slice(0, 3).join(', ') })})` : ''),
  add2: (s) => t('Add {a} and {b}', { a: s.steps[0].mod, b: s.steps[1].mod }),
};

const oneIn = (c) => t('1 in {n}', { n: Math.round(1 / c) });
const EXALT_WHY = {
  greater: 'low tiers cut off (level 35+; a family without such tiers rolls its best one)',
  perfect: 'low tiers cut off (level 50+; a family without such tiers rolls its best one)',
};

function planHtml(plan) {
  return `<ol class="plan">${expandPlan(plan).map((s) => {
    const c = stepCost(s);
    let odds;
    if (c.lottery) odds = t('chance unknown — valuable modifier') + (c.hopeless && c.perTry != null ? ` · ${t('one attempt ≈ {cost}', { cost: money(c.perTry) })}` : '');
    else if (c.hopeless) odds = `${t('{odds} at T1–T2', { odds: (c.chances || [c.chance]).map(oneIn).join(' / ') })} · ${t('one attempt ≈ {cost}', { cost: money(c.perTry) })}`;
    else if (c.k === 'essence') odds = c.chance >= 1 ? t('guaranteed') : oneIn(c.chance);
    else if (c.chances) odds = t('{odds} at T1–T2', { odds: c.chances.map(oneIn).join(' / ') });
    else if (s.mods) odds = t('≈ {n} attempts', { n: fmt(Math.round(c.tries * 10) / 10) });
    else odds = c.chance >= 1 ? t('guaranteed') : oneIn(c.chance);
    const notes = [];
    if (c.two) notes.push(t('one Exalted Orb adds both modifiers'));
    if (s.mods) notes.push(c.hits > 0.05
      ? t('on average ≈{n} needed modifiers get hit too — re-adding them is counted in the price', { n: fmt(Math.round(c.hits * 10) / 10) })
      : t('only unwanted modifiers can be hit'));
    if (c.hopeless) notes.push(t('One attempt: a miss stays on the item — removing it at random would more likely hit a needed modifier'));
    else if (s.act !== 'remove' && c.k !== 'desecrate' && c.k !== 'essence' && (s.onSide || s.onItem)) notes.push(t('the average includes misses: an Annulment may hit a needed modifier, which then has to be added again'));
    if (c.k === 'essence') notes.push(t('Exalt a cheap «sacrificial» modifier onto this side, then {crystal} + {essence}: it removes a modifier from this side and adds its own for sure — uses the only crafted-modifier slot', { crystal: s.crystal, essence: c.currencies[0] }));
    if (c.k === 'desecrate') {
      notes.push(t('Desecrate: reveal it at the Well of Souls and pick 1 of 3 offered modifiers — only one desecrated modifier per item'));
      if (/^Ancient /.test(c.bone)) notes.push(t('Ancient bone — low tiers cut off (level 40+)'));
      if (c.echo) notes.push(t('Omen of Abyssal Echoes — reroll the 3 options once'));
      if (c.bone === 'Altered Collarbone') notes.push(t('Altered Collarbone: desecrates jewellery with a chance for otherworldly (Breach) modifiers — how often they show up among the options is unknown'));
      if (c.lich) notes.push(t(c.lich.n <= 3 ? 'Lich omen: all options come from {lich}\'s pool — {n} on this side, so the modifier is guaranteed' : 'Lich omen: all options come from {lich}\'s pool — {n} on this side', { lich: c.lich.name[0].toUpperCase() + c.lich.name.slice(1), n: c.lich.n }));
      notes.push(t('At the reveal pick: {mods}', { mods: [s.mod, ...(s.orMods || [])].join(' › ') }));
      notes.push(t('A miss → Orb of Annulment + Omen of Light removes it ({cost})', { cost: money((craftPrices['Orb of Annulment'] || 0) + (craftPrices['Omen of Light'] || 0)) }));
    }
    if (EXALT_WHY[c.k]) notes.push(t(EXALT_WHY[c.k]));
    if (s.blocker && c.k !== 'essence' && c.k !== 'desecrate') {
      const better = c.chance && !c.lottery ? oneIn(Math.min(1, c.chance / (1 - s.blocker.share))) : null;
      notes.push(t('Blocker: first add a cheap «{mod}» (≈{pct}% of rolls here; e.g. pick it in a desecrate reveal) — its group can no longer roll{odds}; remove it afterwards', { mod: s.blocker.text, pct: Math.round(s.blocker.share * 100), odds: better ? ` (${better})` : '' }));
    }
    if (s.act !== 'remove' && c.k !== 'desecrate' && s.sideOmen && !c.currencies.includes(s.sideOmen)) notes.push(t('without a side omen half the rolls land on the other side'));
    const altText = (o) => o.k === 'essence'
      ? `${o.currencies.join(' + ')} · ${oneIn(o.chances[0])} · ${t('≈ {cost} on average', { cost: money(o.cost) })}`
      : o.k === 'desecrate'
      ? `${t('Desecrate')}${o.mod ? ` (${o.mod})` : ''}: ${o.currencies.join(' + ')}${o.chances[0] != null ? ` · ${oneIn(o.chances[0])}` : ''}${c.lottery ? '' : ` · ${t('≈ {cost} on average', { cost: money(o.cost) })}`}`
      : `${o.currencies[0]} · ${t('≈ {cost} on average', { cost: money(o.cost) })}`;
    const alts = [...(c.alts || []).filter((o) => o.k !== 'desecrate' && o.k !== 'essence'), ...(c.desAlt || []).slice(0, 2)].filter((o) => Number.isFinite(o.cost)).map(altText);
    if (c.other) alts.push(t('{how}: ≈{n} attempts, ≈{hits} needed modifiers hit, {cost} in currency', { how: c.other.currencies.join(' + '), n: fmt(Math.round(c.other.tries * 10) / 10), hits: fmt(Math.round(c.other.hits * 10) / 10), cost: money(c.other.spent) }));
    if (s.freeQuality) notes.push(t('{mod} has done its job: quality is already above 20% and stays after it is removed (community data) — the crafted slot frees up', { mod: s.freeQuality }));
    if (s.whittleWrong) notes.push(t('Chaos Orb + Omen of Whittling would not help: it removes the lowest-level modifier, and that is «{mod}» (level {level})', { mod: s.whittleWrong.mod, level: s.whittleWrong.level }));
    if (c.whittle) alts.push(t('{mod}: Chaos Orb + Omen of Whittling removes it for sure (lowest-level modifier), a random modifier takes its place — {list}', { mod: s.whittle,
      list: c.whittle.map((o) => `${o.orb}${o.level ? ` (${t('new one {n}+', { n: o.level })})` : ''} ≈ ${money(o.cost)}`).join('; ') }));
    for (const e of c.erasure || []) alts.push(t('{orb} + {omen}: removes a random {side} (1 in {n} hits an unwanted one) and adds a random modifier, ≈ {cost} per try', { orb: e.orb, omen: e.omen, side: t(e.side), n: Math.round(1 / e.chance * 10) / 10, cost: money(e.cost) }));
    if (c.regal && c.regal.length) notes.push(t('Greater / Perfect Regal Orb: the random modifier is level 35+ / 50+ — instead: {list}', { list: c.regal.map((o) => `${o.orb} ≈ ${money(o.cost)}`).join('; ') }));
    const desNote = (c.desAlt || []).some((o) => o.k === 'desecrate') ? t('Desecrate: pick 1 of 3 offered modifiers at the Well of Souls, but a miss costs Orb of Annulment + Omen of Light ({cost})', { cost: money((craftPrices['Orb of Annulment'] || 0) + (craftPrices['Omen of Light'] || 0)) }) : '';
    return `<li><div class="ps-what">${esc(STEP_LABEL[s.act](s))}</div>
      <div class="ps-how">${curChips(c.currencies)} · ${esc(odds)}${c.cost != null ? ` · <b>≈ ${money(c.cost)}</b>` : ''}</div>
      ${notes.length ? `<div class="ps-note">${esc(notes.join(' · '))}</div>` : ''}
      ${alts.length ? `<div class="ps-note">${esc(t('Instead: {list}', { list: alts.join('; ') }))}</div>` : ''}
      ${desNote ? `<div class="ps-note">${esc(desNote)}</div>` : ''}
      ${c.risky && c.chance < 1 && !s.mods ? `<div class="ps-risk">${esc(t('A miss removes a good modifier instead'))}</div>` : ''}</li>`;
  }).join('')}</ol>`;
}

// Вердикт: продать как есть или крафтить (цена цели − затраты на валюту).
function verdictHtml(plan) {
  const costs = expandPlan(plan).map(stepCost);
  const known = costs.filter((c) => c.cost != null).reduce((a, c) => a + c.cost, 0);
  const lottery = costs.some((c) => c.cost == null);
  const risky = costs.some((c) => c.risky && c.chance < 1);
  const now = state.est;
  const rows = [
    `<div><span>${esc(t('Sell as is'))}</span><b>${now != null ? money(now) : '—'}</b></div>`,
    `<div><span>${esc(t('Goal item'))}${goalValue != null && goalBasis !== 'exact' ? ` <small class="muted" title="${esc(t(goalBasis === 'similar' ? 'No exact matches — priced by similar items: the added modifiers required, the rest at their tier floor' : 'No similar items either — priced by items with only the most valuable added modifier: the real goal is worth more'))}">${esc(t(goalBasis === 'similar' ? '(similar)' : '(at least)'))}</small>` : ''}</span><b>${goalValue === undefined ? '…' : goalValue == null ? t('none listed') : (goalBasis === 'partial' ? '≥ ' : '≈ ') + money(goalValue)}</b></div>`,
    `<div><span>${esc(t('Currency, on average'))}</span><b>${lottery ? `${esc(t('from'))} ` : ''}${money(known)}</b></div>`,
  ];
  let verdict = '';
  // Снятие лишнего Annulment'ами в среднем заденет нужные моды — на такой вещи это почти всегда невыгодно.
  const hits = Math.max(0, ...costs.map((c) => c.hits || 0));
  const hitNote = hits >= 1 ? `<small>${esc(t('Removing the unwanted modifiers would hit ≈{n} needed ones on average — on an item like this it is rarely worth it', { n: fmt(Math.round(hits * 10) / 10) }))}</small>` : '';
  // Валюта дороже готовой цели — крафт не окупится при любой цене вещи (цена вещи может быть ещё не посчитана).
  if (goalValue != null && known >= goalValue) {
    verdict = `<div class="verdict bad">✖ ${esc(t(goalBasis === 'partial' ? 'Probably not worth it: the currency alone (≈ {cost}) costs more than the lower bound of the goal (≥ {goal})' : 'Not worth it: the currency alone (≈ {cost}) costs more than the finished goal (≈ {goal})', { cost: money(known), goal: money(goalValue) }))}${hitNote}</div>`;
  } else if (goalValue === null && now != null) {
    // Готовых аналогов на трейде нет — цена цели неизвестна. Затраты уже не меньше цены вещи — проще продать.
    verdict = known >= now * 0.5
      ? `<div class="verdict bad">✖ ${esc(t('Selling as is is better: the currency alone costs ≈ {cost}, the item sells for ≈ {now}', { cost: money(known), now: money(now) }))}<small>${esc(t('No finished items like the goal are listed — its price is unknown'))}</small>${hitNote}</div>`
      : `<div class="verdict">${esc(t('No finished items like the goal are listed — its price is unknown'))}${hitNote}</div>`;
  } else if (goalValue != null && now != null) {
    // Симуляция всего плана: распределение итога и шанс, что крафт выгоднее продажи сейчас (src/shared/plancost.js).
    const sim = planner.simulate(plan, { keep: craftGoal ? craftGoal.keep.length : 0 });
    const gain = goalValue - now - known;
    const good = sim ? sim.profit >= 0.5 : gain > Math.max(now * 0.15, known * 0.5);
    const simNote = sim ? `<small class="sim">${esc(t('Simulated {n} crafts: the item ends up ≈ {p50} (10–90%: {p10}–{p90}), currency ≈ {spent} on average; better than selling now in {profit}%, the full goal in {full}%',
      { n: sim.runs, p50: money(sim.value.p50), p10: money(sim.value.p10), p90: money(sim.value.p90), spent: money(sim.spent.mean), profit: Math.round(sim.profit * 100), full: Math.round(sim.full * 100) }))}</small>` : '';
    verdict = `<div class="verdict ${good && (!lottery || sim) ? 'good' : 'bad'}">${good
      ? `✅ ${esc(sim ? t('Craft: better than selling as is in {pct}% of simulated runs', { pct: Math.round(sim.profit * 100) }) : t('Craft: ≈ {gain} more than selling as is', { gain: money(gain) }))}`
      : `✖ ${esc(t('Selling as is is better'))}`}${simNote}${lottery ? `<small>${esc(t('A key modifier has unknown odds — this is a gamble'))}</small>` : ''}${hitNote || (risky ? `<small>${esc(t('Removing a modifier can hit a good one — the cost may grow'))}</small>` : '')}</div>`;
  } else if (now == null) {
    verdict = `<div class="verdict">${esc(t('Price this item on the Price tab first'))}</div>`;
  }
  return `<div class="profit">${rows.join('')}</div>${verdict}`;
}

// Цена цели — сразу при открытии вкладки (один поиск на трейде), затем перерисовываем вердикт.
async function computeGoal(g) {
  const mine = state;
  goalValue = undefined;
  const f = JSON.parse(JSON.stringify(state.filters));
  const gone = new Set(g.remove.flatMap((r) => r.templates));
  for (const m of f.mods) if (m.template && gone.has(tplKey(m.template))) m.enabled = false;
  withMods(f, g.add);
  goalBasis = 'exact';
  try {
    const it = state.item.rarity === 'Magic' ? { ...state.item, rarity: 'Rare' } : state.item;
    const q = await quickPrice(it, f);
    if (mine !== state) return;
    goalValue = estimate(q.lots);
    // Точно таких нет — похожие: добавленные моды обязательны, у оставшихся — нижняя граница тира, второстепенные выключены.
    if (goalValue == null) {
      const added = new Set(g.add.flatMap((a) => (a.stats || []).map((s) => s.statId)));
      const loose = JSON.parse(JSON.stringify(f));
      for (const m of loose.mods) {
        if (added.has(m.statId) || !m.enabled) continue;
        if (!m.key && (m.importance || 0) < 2.4) m.enabled = false;
        else if (m.range) m.min = Math.ceil(m.range.lo);
      }
      const q2 = await quickPrice(it, loose);
      if (mine !== state) return;
      goalValue = estimate(q2.lots);
      if (goalValue != null) goalBasis = 'similar';
      // И так нет — нижняя граница: вещь только с самым ценным добавленным модом (остальное как у похожих).
      if (goalValue == null && g.add.length > 1) {
        const top = [...g.add].sort((a, b) => b.pct - a.pct)[0];
        const keep = new Set((top.stats || []).map((s) => s.statId));
        const part = JSON.parse(JSON.stringify(loose));
        for (const m of part.mods) if (added.has(m.statId) && !keep.has(m.statId)) m.enabled = false;
        const q3 = await quickPrice(it, part);
        if (mine !== state) return;
        goalValue = estimate(q3.lots);
        if (goalValue != null) goalBasis = 'partial';
      }
    }
  } catch (e) {
    if (mine !== state) return;
    goalValue = null;
    setStatus(errText(e), true);
  }
  const box = document.querySelector('#craft .verdict-box');
  if (box) box.innerHTML = verdictHtml(g.plan);
  // Шаги тоже: цена задетого нужного мода зависит от цены цели.
  const ol = document.querySelector('#craft .plan-box ol.plan');
  if (ol) ol.outerHTML = planHtml(g.plan);
  fit();
}

// ---- пошаговое ведение крафта: запомнили вещь и цель; каждое новое копирование той же вещи — что получилось и что дальше ----
let craftSession = null; // { base, ilvl, name, rarity, goal: { add, remove }, start, before, current, seen }
// Моды вещи шаблонами (как в цели крафта: нижний регистр, # вместо чисел, без «+»).
const modKeys = () => new Set(((state.filters && state.filters.mods) || []).filter((m) => m.template && m.tag !== 'pseudo').map((m) => tplKey(m.template)));
// Та же вещь: база и item level, имя редкой не меняется (магическая → редкая — меняется).
function sessionMatches() {
  const s = craftSession, it = state && state.item;
  return !!(s && it && it.baseType === s.base && it.ilvl === s.ilvl && (it.name === s.name || s.rarity !== 'Rare' || it.rarity !== s.rarity));
}
function startSession() {
  const g = craftGoal;
  if (!g) return;
  const keys = modKeys();
  craftSession = { base: state.item.baseType, ilvl: state.item.ilvl, name: state.item.name, rarity: state.item.rarity,
    goal: { add: g.add.map((a) => ({ text: a.text, or: a.orMods || [] })), remove: g.remove.map((r) => ({ text: r.text })) },
    start: keys, before: keys, current: keys, seen: state };
}
function sessionHtml(r) {
  const s = craftSession;
  const keys = modKeys();
  if (s.seen !== state) { s.before = s.current; s.current = keys; s.seen = state; } // новая копия вещи — сравниваем с прошлой
  const has = (text) => text.split(' / ').every((l) => keys.has(l));
  const goalLines = new Set(s.goal.add.flatMap((a) => a.text.split(' / ')));
  const added = [...keys].filter((k) => !s.before.has(k));
  const lost = [...s.before].filter((k) => !keys.has(k));
  const wanted = new Set([...goalLines, ...[...s.start].filter((k) => !s.goal.remove.some((r) => r.text.split(' / ').includes(k)))]);
  const news = [
    ...added.map((k) => (goalLines.has(k) ? `<div class="ss good">✓ ${esc(t('Got {mod}', { mod: k }))}</div>` : `<div class="ss bad">✗ ${esc(t('Got {mod} — not in the goal', { mod: k }))}</div>`)),
    ...lost.map((k) => (wanted.has(k) ? `<div class="ss bad">✗ ${esc(t('Lost {mod}', { mod: k }))}</div>` : `<div class="ss good">✓ ${esc(t('Removed {mod}', { mod: k }))}</div>`)),
  ];
  const rows = [
    ...s.goal.add.map((a) => `<div class="ss ${has(a.text) ? 'done' : ''}">${has(a.text) ? '✓' : '○'} ${esc(a.text)}</div>`),
    ...s.goal.remove.map((x) => `<div class="ss ${has(x.text) ? '' : 'done'}">${has(x.text) ? '○' : '✓'} ${esc(t('remove {mod}', { mod: x.text }))}</div>`),
  ];
  const done = s.goal.add.every((a) => has(a.text)) && s.goal.remove.every((x) => !has(x.text));
  const next = r.goal && r.goal.plan && r.goal.plan.length ? expandPlan(r.goal.plan)[0] : null;
  return `<div class="craft-sec session"><div class="k">${esc(t('Crafting step by step'))} <button class="link" data-act="session-stop">■ ${esc(t('Stop'))}</button></div>
    <div class="ss-how">📌 ${esc(t('The window stays open while you craft. Do a step in the game, hover the item and press'))} <kbd>${esc(state.hotkey || 'Ctrl+E')}</kbd></div>
    ${news.length ? `<div class="ss-news">${esc(t('Since the last check:'))}${news.join('')}</div>` : ''}
    <div class="ss-list">${rows.join('')}</div>
    ${done ? `<div class="verdict good">🎉 ${esc(t('Goal reached — check the price on the Price tab'))}</div>` : next ? `<div class="ss-next">${esc(t('Next: {step}', { step: STEP_LABEL[next.act](next) }))}</div>` : ''}</div>`;
}

// Шансы — оценка по лотам трейда; собраны в другой лиге — пишем в какой (после патча веса могли измениться).
function chanceWarn(m) {
  const date = m.league && state && m.league !== state.league ? `${m.collected}, ${m.league}` : m.collected;
  return `<div class="craft-warn">⚠ ${esc(t('Chances are rough estimates from {n} cheap trade listings ({date}) — PoE 2 game files have no modifier weights. Treat them as "common / rare", not exact odds.', { n: m.items, date }))}</div>`;
}

// ---- белая база: Transmutation (обычная / Greater 44+ / Perfect 70+) → магическая с одним модом ----
// Промах — нужна новая база (или Orb of Annulment, если база дороже). Рекомендуем вариант с меньшей ожидаемой
// стоимостью до популярного мода в одном из двух лучших тиров.
const BASE_PRICEY = 0.5; // div: база дороже — сама по себе товар, промах ощутим
function renderNormalCraft(r, head) {
  craftGoal = null;
  craftPrices = r.prices || {};
  const p = (n) => craftPrices[n];
  const base = state.est;
  const retry = base != null ? Math.min(base, p('Orb of Annulment') ?? base) : 0;
  const opts = r.normal.map((o) => {
    const orb = p(o.name);
    const cost = orb == null || !o.top ? null : (orb + (1 - o.top) * retry) / o.top;
    return { ...o, orb, cost };
  });
  const known = opts.filter((o) => o.cost != null);
  const best = known.length ? known.reduce((a, b) => (b.cost < a.cost ? b : a)) : opts[opts.length - 1];
  const pct = (x) => `${x >= 0.1 ? Math.round(x * 100) : Math.round(x * 1000) / 10}%`;
  const rows = opts.map((o) => `<div class="profit-row${o === best ? ' best' : ''}"><div><span class="game">${esc(o.name)}</span>${o.orb != null ? ` <small>≈ ${money(o.orb)}</small>` : ''}${o === best ? ` <b class="rec">${esc(t('recommended'))}</b>` : ''}</div>
    <div class="ps-how">${esc(t('{n} possible modifiers · popular: {any} · popular in T1–T2: {top}', { n: o.pool, any: pct(o.any), top: pct(o.top) }))}${o.cost != null ? ` · <b>${esc(t('≈ {cost} on average', { cost: money(o.cost) }))}</b>` : ''}</div>
    ${o.minLevel ? `<div class="ps-note">${esc(t('low tiers cut off (level {n}+; a family without such tiers rolls its best one)', { n: o.minLevel }))}</div>` : ''}</div>`).join('');
  const warn = base != null && base >= BASE_PRICEY
    ? `<div class="craft-warn">⚠ ${esc(t('The base itself sells for ≈ {price} — a miss costs a base like this. Selling it as is may be the better deal.', { price: money(base) }))}</div>` : '';
  const steps = [
    t('{orb} — makes it magic with one random modifier', { orb: best.name }),
    t('A popular modifier → Orb of Augmentation (Greater / Perfect — same idea) for the other side, then an Essence or Regal Orb → rare; open Craft again for the next steps'),
    base != null && base < (p('Orb of Annulment') ?? Infinity)
      ? t('A miss → take another base: it is cheaper than fixing this one')
      : t('A miss → Orb of Annulment removes the modifier, then Orb of Augmentation'),
    t('Alternative: Orb of Alchemy — straight to rare with 4 random modifiers (Omen of Sinistral / Dextral Alchemy — as many prefixes / suffixes as possible)'),
  ];
  const popular = (r.popular || []).map((c, i) => ({ name: `${c.text}${c.tier ? ` · T${c.tier}` : ''}`, pct: c.pct, rank: i + 1 }));
  $('craft').innerHTML = head + `<div class="craft-sec plan-box"><div class="k">${esc(t('White base → magic'))}</div>
    ${warn}${rows}
    <ol class="plan">${steps.map((s) => `<li><div class="ps-how">${esc(s)}</div></li>`).join('')}</ol></div>
    ${popular.length ? demandList('npop', t('Popular modifiers that can roll here'), popular) : ''}
    ${r.chanceMeta ? chanceWarn(r.chanceMeta) : ''}`;
}

// ---- уник: Divine перекатывает значения всех модов разом (сами моды не меняются) ----
const TOP_Q = 0.75; // «хорошие роллы» — верхняя четверть диапазона
let uniqueTop; // цена с хорошими роллами: undefined — считаем, null — не нашли
const rollOf = (m) => (m.ordinal ? (m.ordinal.idx - m.ordinal.lo) / (m.ordinal.hi - m.ordinal.lo) : m.roll);
const uniqueRolls = () => (state.filters.mods || []).filter((m) => (m.tag === 'explicit' || m.tag === 'desecrated')
  && (m.ordinal || (m.categorical && m.categorical.n > 1) || (m.range && m.range.hi > m.range.lo && m.roll != null)));
// Шанс после Divine попасть в верхнюю четверть: у порядкового варианта — доля вариантов сверху, у числа — 1/4.
const topShare = (m) => {
  if (m.categorical) return 1 / m.categorical.n; // сохранить тот же вариант
  if (!m.ordinal) return 1 - TOP_Q;
  const { lo, hi } = m.ordinal;
  const from = Math.ceil(lo + TOP_Q * (hi - lo));
  return (hi - from + 1) / (hi - lo + 1);
};

// Моды, ради которых уник берут: по poe.ninja их носят ≥ 10% билдов с этим уником (нет данных — все).
// Роллы остальных на цену почти не влияют — «хорошие роллы» требуем только у ключевых.
function keyRolls(rolls) {
  const pct = new Map(((lastBuilds && lastBuilds.mods) || []).map((r) => [modKey(r.name), r.pct]));
  const of = (m) => Math.max(pct.get(modKey(m.template)) || 0, ...String(m.text).split('\n').map((l) => pct.get(modKey(l)) || 0));
  const key = rolls.filter((m) => m.categorical || of(m) >= 10);
  return pct.size && key.length ? key : rolls;
}

// Шанс, что после Divine сумма роллов станет больше нынешней (значения независимы и равномерны в диапазоне).
function betterOdds(qs) {
  const N = 20000;
  const now = qs.reduce((a, q) => a + q, 0);
  let win = 0;
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let k = 0; k < qs.length; k++) s += Math.random();
    if (s > now) win++;
  }
  return win / N;
}

function renderUniqueCraft(r, head) {
  craftGoal = null;
  uniqueTop = undefined;
  craftPrices = r.prices || {};
  const rolls = uniqueRolls();
  const top = [];
  if (!rolls.length) {
    const noRanges = state.item.mods && state.item.mods.some((m) => (m.tag === 'explicit' || m.tag === 'desecrated') && m.statId && !m.range && /\d/.test(m.text));
    top.push(`<div class="craft-sec"><div class="craft-how">${esc(noRanges
      ? t('No roll ranges in the copied text — turn on "Advanced Mod Descriptions" (or copy with Ctrl+Alt+C) to see how good the rolls are')
      : t('This unique has no variable values — Divine Orb changes nothing'))}</div></div>`);
  } else {
    const qs = rolls.filter((m) => !m.categorical).map(rollOf);
    const key = keyRolls(rolls);
    const cats = rolls.filter((m) => m.categorical);
    const low = key.filter((m) => m.categorical || rollOf(m) < TOP_Q).length;
    // Divine перекатывает ВСЕ значения: «удача» — все ключевые роллы разом в верхней четверти, а не только низкие.
    const tries = Math.round(1 / key.reduce((a, m) => a * topShare(m), 1));
    const rangeText = (m) => (m.ordinal ? `${m.ordinal.loText}–${m.ordinal.hiText}` : `${fmt(m.range.lo)}–${fmt(m.range.hi)}`);
    const rows = rolls.filter((m) => !m.categorical).map((m) => `<div class="brow${key.includes(m) ? '' : ' cold'}"${key.includes(m) ? '' : ` title="${esc(t('Few builds use it — its roll barely affects the price'))}"`}><span class="bname">${esc(m.text.split('\n')[0])} <span class="craft-tier">${esc(rangeText(m))}</span></span><span class="bpct">${Math.round(rollOf(m) * 100)}%</span>
      <span class="bbar"><i data-w="${Math.round(rollOf(m) * 100)}%"></i></span></div>`).join('');
    top.push(`<div class="craft-sec plan-box"><div class="k">Divine Orb</div>
      <div class="craft-how">${esc(t('Rerolls the values of all modifiers at once — the modifiers themselves stay'))}</div>
      <div class="dcol"><div class="k">${esc(t('How good the rolls are'))}</div>${rows}</div>
      ${cats.length ? `<div class="craft-warn">⚠ ${esc(t('Divine also rerolls {mods} — each becomes a random one of its variants (1 in {n} to keep it)', { mods: cats.map((m) => m.text.split('\n')[0]).join(', '), n: cats.map((m) => m.categorical.n).join(' / ') }))}</div>` : ''}
      ${qs.length ? `<div class="craft-how">${esc(t('Chance the rolls get better overall: {pct}%', { pct: Math.round(betterOdds(qs) * 100) }))}</div>` : ''}
      <div class="craft-how">${esc(low
        ? t(key.length < rolls.length ? 'Key modifiers in the top quarter: about 1 in {n}' : 'All modifiers in the top quarter: about 1 in {n}', { n: tries })
        : t('All rolls are already in the top quarter — a Divine is more likely to make it worse'))}</div>
      ${low ? `<div class="verdict-box">${uniqueVerdictHtml(tries)}</div>` : ''}</div>`);
  }
  if (r.gamble) top.push(gambleHtml(r.gamble));
  $('craft').innerHTML = head + top.join('');
  if (rolls.length && keyRolls(rolls).some((m) => !m.categorical && rollOf(m) < TOP_Q)) computeUniqueTop(keyRolls(rolls));
}

function uniqueVerdictHtml(tries) {
  const now = state.est;
  const div = craftPrices['Divine Orb'];
  const cost = div != null ? tries * div : null;
  const rows = [
    `<div><span>${esc(t('Sell as is'))}</span><b>${now != null ? money(now) : '—'}</b></div>`,
    `<div><span>${esc(t('With top-quarter key rolls'))}</span><b>${uniqueTop === undefined ? '…' : uniqueTop == null ? t('none listed') : money(uniqueTop)}</b></div>`,
    `<div><span>${esc(t('Divine Orbs, on average'))}</span><b>${cost != null ? `${tries} · ${money(cost)}` : tries}</b></div>`,
  ];
  let verdict = '';
  if (uniqueTop != null && now != null && cost != null) {
    const gain = uniqueTop - now - cost;
    const good = gain > Math.max(now * 0.15, cost * 0.5);
    verdict = `<div class="verdict ${good ? 'good' : 'bad'}">${good
      ? `✅ ${esc(t('Divine: ≈ {gain} more than selling as is', { gain: money(gain) }))}`
      : `✖ ${esc(t('Selling as is is better'))}`}<small>${esc(t('Each Divine can also make the rolls worse — this is the average over many tries'))}</small></div>`;
  } else if (now == null) {
    verdict = `<div class="verdict">${esc(t('Price this item on the Price tab first'))}</div>`;
  }
  return `<div class="profit">${rows.join('')}</div>${verdict}`;
}

// Цена такого же уника с роллами в верхней четверти (не ниже наших) — один поиск на трейде.
async function computeUniqueTop(rolls) {
  const mine = state;
  uniqueTop = undefined;
  const f = JSON.parse(JSON.stringify(state.filters));
  state.filters.mods.forEach((m, i) => {
    if (!rolls.includes(m) || m.ordinal || m.categorical) return;
    const x = f.mods[i];
    const want = m.range.lo + TOP_Q * (m.range.hi - m.range.lo);
    const v = Number.isInteger(m.range.lo) && Number.isInteger(m.range.hi) ? Math.ceil(want) : Math.round(want * 100) / 100;
    x.enabled = true;
    x.min = Math.max(Number(x.min) || m.range.lo, v);
  });
  try {
    const q = await quickPrice(state.item, f);
    if (mine !== state) return;
    uniqueTop = estimate(q.lots);
  } catch (e) {
    if (mine !== state) return;
    uniqueTop = null;
    setStatus(errText(e), true);
  }
  const box = document.querySelector('#craft .verdict-box');
  if (box) { box.innerHTML = uniqueVerdictHtml(Math.round(1 / rolls.reduce((a, m) => a * topShare(m), 1))); fit(); }
}

// «Рискованный финал»: порча и освящение — необратимо, шансы — оценки сообщества.
function gambleHtml(g) {
  const p = (n) => (craftPrices[n] != null && (n !== 'Omen of Sanctification' || state.item.rarity === 'Rare') ? ` · ${n} ≈ ${money(craftPrices[n])}` : '');
  const list = (xs) => xs.map((h) => `<div class="craft-how">${esc(h)}</div>`).join('');
  return `<div class="craft-sec gamble"><div class="k">⚠ ${esc(t('Risky final step: corruption and sanctification'))}</div>${list(g.how)}
    <div class="craft-sub">${esc(t('Prices'))}${esc(p('Vaal Orb') + p('Omen of Sanctification') + p('Omen of Putrefaction'))}</div>
    ${g.enchants.length ? `<details class="why"><summary>${esc(t('Possible corruption enchants ({n})', { n: g.enchants.length }))}</summary>${list(g.enchants)}</details>` : ''}</div>`;
}

function renderCraft(r) {
  craftGoal = r.goal || null;
  craftPrices = r.prices || {};
  craftCands.clear();
  const head = `<div class="sect"><span>${t('Craft')}</span></div>`;
  if (r.blocked) {
    $('craft').innerHTML = head + voidState('⛓', t("{state} — can't be modified", { state: r.blocked }),
      t('Its modifiers are locked. The Price tab shows what it is worth as is.'), [['price', t('See price')]]);
    return;
  }
  if (r.note) { $('craft').innerHTML = head + voidState('◇', t('No craft tips'), esc(r.note)); return; }
  if (r.unique) { renderUniqueCraft(r, head); return; }
  if (r.normal) { renderNormalCraft(r, head); return; }
  const how = (list) => list.map((h) => `<div class="craft-how">${esc(h)}</div>`).join('');
  // Сверху — коротко для новичка: места на вещи, «продать или крафтить», план по шагам с затратами.
  // Всё остальное (все способы, варианты модов) — свёрнуто ниже.
  const top = [slotsHtml(r)];
  const inSession = craftSession && sessionMatches();
  if (inSession) top.unshift(sessionHtml(r));
  if (r.goal && r.goal.plan && r.goal.plan.length) {
    top.push(`<div class="craft-sec plan-box"><div class="k">${t('Plan')}${inSession ? '' : ` <button class="link session-btn" data-act="session" title="${esc(t('Do a step, check the item again with the hotkey — the window stays open and shows what you got and the next step'))}">▶ ${esc(t('Craft step by step'))}</button>`}</div><div class="verdict-box">${verdictHtml(r.goal.plan)}</div>
      ${planHtml(r.goal.plan)}<details class="why"><summary>${t('Why this plan')}</summary>${goalHtml(r.goal)}</details></div>`);
  } else {
    top.push(`<div class="craft-sec plan-box"><div class="verdict">${esc(t('No clear upgrade for this item — selling as is is the simple choice'))}</div></div>`);
    if (r.gamble) top.push(gambleHtml(r.gamble)); // улучшать нечего — рискованный финал на виду
  }
  const parts = [];
  for (const s of r.sections) {
    if (s.kind === 'open') {
      parts.push(`<div class="craft-sec"><div class="k">${t(`{n} free ${s.side}es`, { n: s.count })}</div>${how(s.how)}
        ${s.candidates.length ? `<div class="craft-sub">${t(`Popular ${s.side}es that can roll here (best tier for this item level):`)}</div>${craftRows(s.candidates)}`
          : `<div class="craft-sub">${t('No popular modifiers left for this side.')}</div>`}</div>`);
    } else if (s.kind === 'replace') {
      const w = s.weak;
      parts.push(`<div class="craft-sec"><div class="k">${t(`Full — replace the weakest ${w.side}`)}</div>
        <div class="craft-weak">${esc(w.text)} <span class="craft-tier">${w.tier ? `T${w.tier}` : ''}${w.pct ? ` · ${t('{pct}% builds', { pct: fmt(w.pct) })}` : ''}</span></div>${how(s.how)}
        ${s.candidates.length ? `<div class="craft-sub">${t('Could become:')}</div>${craftRows(s.candidates)}` : ''}</div>`);
    } else if (s.kind === 'desecrate') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Desecration')}</div>${how(s.how)}<div class="craft-sub">${t('Popular desecrated modifiers for this base:')}</div>${craftRows(s.candidates)}</div>`);
    } else if (s.kind === 'upgrade') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Make it rare first')}</div>${how(s.how)}</div>`);
    } else if (s.kind === 'perfect') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Guaranteed modifier: Perfect / corrupted Essences, Alloys')}</div><div class="craft-sub">${t('Removes a random modifier and adds its own guaranteed one:')}</div>${how(s.how)}</div>`);
    } else if (s.kind === 'tierup') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Key modifier, weak tier — keep it')}</div>${s.mods.map((m) => `
        <div class="craft-weak">${esc(m.text)} <span class="craft-tier">T${m.tier} → T${m.best}${m.range ? ` (${esc(m.range)})` : ''} · ${esc(t('{pct}% builds', { pct: fmt(m.pct) }))}</span></div>${how(m.how)}`).join('')}</div>`);
    } else if (s.kind === 'emotions') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Liquid Emotions (Delirium) — the main jewel craft')}</div>${how(s.how)}</div>`);
    } else if (s.kind === 'magicfill') {
      parts.push(`<div class="craft-sec"><div class="k">${t('While it is magic')}</div>${how(s.how)}${s.candidates.length ? `<div class="craft-sub">${t('Popular modifiers for the free slot:')}</div>${craftRows(s.candidates)}` : ''}</div>`);
    } else if (s.kind === 'risky') {
      const pr = (s.prices || []).filter((n) => craftPrices[n] != null).map((n) => `${n} ≈ ${money(craftPrices[n])}`).join(' · ');
      parts.push(`<div class="craft-sec"><div class="k">${t('Risky')}</div>${how(s.how)}${pr ? `<div class="craft-sub">${esc(t('Prices'))} · ${esc(pr)}</div>` : ''}</div>`);
    } else if (s.kind === 'keep') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Full — all modifiers are top tier')}</div><div class="craft-sub">${t('Nothing worth replacing.')}</div></div>`);
    } else if (s.kind === 'cheap') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Cheap and safe')}</div>${how(s.how)}</div>`);
    }
  }
  if (r.augments && r.augments.length) {
    const sock = r.freeSockets ? t('{n} free augment socket(s)', { n: r.freeSockets }) : t("no free augment socket — Artificer's Orb adds one");
    parts.push(`<div class="craft-sec"><div class="k">${esc(t('Runes and soul cores for the sockets'))} <small class="muted">· ${esc(sock)}</small></div>
      ${r.augments.map((a) => `<div class="craft-how"><span class="game">${esc(a.name)}</span>${craftPrices[a.name] != null ? ` ≈ ${money(craftPrices[a.name])}` : ''} — ${esc(a.lines.join(', '))} <span class="dem">${esc(t('{pct}% builds', { pct: fmt(a.pct) }))}</span>${a.ancient ? ` <small class="muted">(${esc(t('Ancient Augment: one per item'))})</small>` : ''}</div>`).join('')}</div>`);
  }
  if (r.theme && r.theme.length) {
    top.splice(1, 0, `<div class="craft-theme" title="${t('Demand % below is among {n} builds that wear this item class with these modifiers', { n: r.themeBuilds })}">${t('Demand among builds using')} <b>${r.theme.map(esc).join('</b> + <b>')}</b></div>`);
  }
  if (r.chanceMeta) parts.push(chanceWarn(r.chanceMeta));
  if (r.gamble && r.goal && r.goal.plan && r.goal.plan.length) parts.push(gambleHtml(r.gamble)); // в конце, после всех безопасных способов
  parts.push(`<div class="craft-foot">${t(r.chanceMeta ? 'Mod pool: game files (RePoE).' : "Mod pool: game files (RePoE). Roll chances aren't shown — PoE 2 files have no modifier weights.")}<br>${t('% = share of those builds using the modifier (poe.ninja). «price?» — what your item would cost with it.')}</div>`);
  $('craft').innerHTML = head + top.join('')
    + `<details class="more-ways"><summary>${t('All methods and modifier options')}</summary>${parts.join('')}</details>`;
  if (r.goal && r.goal.plan && r.goal.plan.length) computeGoal(r.goal);
}
