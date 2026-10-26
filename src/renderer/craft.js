// Craft tab: plan, its cost and goal, step-by-step crafting, white bases, uniques, risky finish.
// Window parts are plain scripts sharing one scope (index.html loads them in order).

// ---- Craft tab: what to add/replace and with what. Loaded when the tab opens, once per item. ----
let craftFor = null;
async function loadCraft() {
  if (craftFor === state) return;
  const mine = craftFor = state;
  const box = $('craft');
  box.innerHTML = `<div class="sect"><span>${t('Craft')}</span></div><div class="muted center">${t('Loading mod pool…')}</div>`;
  fit();
  // Response for the previous item (a new one arrived while computing): render nothing, neither advice nor error.
  try {
    const r = await window.pc.craft();
    if (craftFor === mine && state === mine) renderCraft(r);
  } catch (e) {
    if (craftFor !== mine || state !== mine) return;
    box.innerHTML = `<div class="sect"><span>${t('Craft')}</span></div>${voidState('⚠', t('Mod pool not loaded'), esc(errText(e)))}`;
  }
  fit();
}

// Craft candidates by the "price?" button key: what the item would cost if this mod lands (lowest roll of the tier).
const craftCands = new Map();
let chanceNote = ''; // "where the odds come from" line, placed under the first table with odds
// Build share to display: for a hybrid from Alloy / essence, pct is the value (best line + half of the second, can exceed
// 100%); we show the best line's share, per-line shares go in the tooltip.
const demPct = (c) => (c.shownPct != null ? c.shownPct : c.pct);
const demTitle = (c) => (c.pctParts && c.pctParts.length > 1 ? c.pctParts.map(([l, p]) => `${l} — ${fmt(p)}%`).join('\n') : '');

// Craft candidates as a table with labeled columns: mod (tier, range; how to get it on the line below) | how many
// builds use it | chance per Exalted attempt | item price with it. Previously one unlabeled line held demand (large,
// on the right, with a background bar), chance and essence, so demand was easy to mistake for chance.
// sub — the caption above the table ("Popular prefixes…"); it shares a line with "Price all and sort".
// The way from a weak tier to the goal: a side's Annulment hits it 1 in N, then Exalted + the side's omen gives the goal
// tier with its (weighted) odds — attempts multiply, so a rare goal tier shows why keeping the mod is the usual answer.
function tierUpWay(m) {
  if (!m.again || !m.sameSide || !m.side) return '';
  const S = m.side === 'prefix' ? 'Sinistral' : 'Dextral';
  const ann = (craftPrices['Orb of Annulment'] ?? 0) + (craftPrices[`Omen of ${S} Annulment`] ?? 0);
  const ex = (craftPrices['Exalted Orb'] ?? 0) + (craftPrices[`Omen of ${S} Exaltation`] ?? 0);
  // Expected: (N + 1) / 2 Annulments to hit it — the side shrinks with each one, as in the removal step (plancost
  // removeCost); the others it hits on the way are lost too, not counted. Then 1 / again Exalts, each miss removed with one
  // more side Annulment.
  const cost = ann && ex ? ((m.sameSide + 1) / 2) * ann + (1 / m.again) * ex + (1 / m.again - 1) * ann : null;
  return `<div class="craft-sub">${esc(t('To {goal}: Orb of Annulment + Omen of {s} Annulment hits it 1 in {n}, then Exalted Orb + Omen of {s} Exaltation gives {goal} {odds}', { goal: m.goal, s: S, n: m.sameSide, odds: oneIn(m.again) }))}${cost != null ? ` · ${esc(t('≈ {cost} on average', { cost: approx(cost) }))}` : ''}</div>`;
}

function craftRows(list, sub = '') {
  const head = `<div class="crow chead"><span>${esc(t('Modifier'))}</span><span>${esc(t('builds'))}</span><span title="${esc(`${t('Chance per try: Exalted Orb + omen of its side')}\n${t('— chance unknown (valuable modifier, not enough data) · green — likely, orange — a few tries, red — expensive')}`)}">${esc(t('chance'))}</span><span>${esc(t('price'))}</span></div>`;
  const rows = head + list.map((c) => {
    const key = String(craftCands.size);
    craftCands.set(key, c);
    const btn = c.stats ? `<button class="link cprice" data-ck="${key}" title="${t('Search for your item with this modifier added (lowest roll of the tier)')}">${PRICE_ICON}</button>` : '';
    // A regular essence turns a magic item rare; this path doesn't work on a rare.
    const via = c.fromNormal ? `<span class="cvia" title="${esc(t('Guides: when the desecrated modifier is revealed, normal modifiers of the pool are offered too — not verified in game'))}">${esc(t('normal modifier — can be offered on reveal'))}</span>`
      : c.essence && state.item.rarity === 'Magic' ? `<span class="cvia" title="${esc(t('{essence} makes a magic item rare with this modifier: {tiers}', { essence: c.essence.name, tiers: c.essence.tiers.join(' · ') }))}">${esc(t('guaranteed: {how}', { how: c.essence.name }))}</span>` : '';
    return `
    <div class="brow crow" data-row="${key}">
      <span class="bname">${esc(c.text)} ${c.tiers > 1 ? `<span class="craft-tier" title="${esc(t('Tier {n} of {m} — the best one this item level allows', { n: c.tier, m: c.tiers }))}">T${c.tier}${c.range ? ` · ${esc(c.range)}` : ''}</span>` : c.range ? `<span class="craft-tier" title="${esc(t('One tier — only Divine Orb improves the roll'))}">${esc(c.range)}</span>` : ''}${via}</span>
      <span class="cdem" title="${esc(demTitle(c) || t('Share of builds that wear this modifier on this item class (poe.ninja)'))}">${hot(demPct(c))}${fmt(demPct(c))}%</span>
      <span class="cch">${chanceTag(c.chanceGoal ?? c.chance, c.chanceUnknown, true, c.chanceGoal != null ? c.target : null)}</span>
      <span class="cpx">${btn}</span></div>`;
  }).join('');
  // "Price all": one short search per row, then the list sorted by price gain, best one marked.
  const priceable = list.filter((c) => c.stats).length;
  // Where the odds come from: one line under the first table with them (details in the tooltip).
  let note = '';
  if (chanceNote && list.some((c) => c.chance != null)) { note = chanceNote; chanceNote = ''; }
  const all = priceable > 1 ? `<button class="link cprice-all" data-priceall title="${esc(t('One trade search per row, then the list is sorted by what one attempt gains on average: price gain × chance − its cost'))}">⇅ ${esc(t('Price all and sort'))}</button>` : '';
  return `<div class="clist">${sub || all ? `<div class="ctop"><span class="craft-sub">${esc(sub)}</span>${all}</div>` : ''}${rows}${note}</div>`;
}
const PRICE_ICON = '⌕'; // "price with it" per row: an icon instead of a repeated word; the price replaces it

// Method lines of the "All methods" cards: currency names become the same chips as in the plan steps
// ("Greater / Perfect Exalted Orb" is spelled out into two chips), " + " becomes the chip separator, the rest stays text.
// A name glued to more letters ("Exalted Orbs") is left as text — a chip must not cut a word.
const CUR_RE = /((?:Omen of (?:the )?[A-Z][a-z']+(?: [A-Z][a-z']+)*|(?:Greater |Perfect )?(?:Exalted|Chaos|Regal|Divine|Vaal|Fracturing|Artificer's|Transmutation|Augmentation) Orb|Orb of (?:Annulment|Transmutation|Augmentation|Alchemy|Chance)|(?:Lesser |Greater |Perfect )?Essence of (?:the )?[A-Z][a-z]+|(?:Gnawed|Preserved|Ancient|Altered) (?:Jawbone|Rib|Collarbone|Cranium|Vertebrae)|[A-Z][a-z']+ Alloy|Hinekora's Lock)(?![\w']))/;
function chipify(text) {
  // Shorthand pairs are spelled out so each name becomes a whole chip.
  const s = String(text).replace(/Greater \/ Perfect ([A-Z][a-z]+ Orb)/g, 'Greater $1 / Perfect $1')
    .replace(/Omen of (Sinistral|Dextral) \/ (Sinistral|Dextral) ([A-Z][a-z]+)/g, 'Omen of $1 $3 / Omen of $2 $3')
    .replace(/Omen of the ([A-Z][a-z]+)((?: \/ the [A-Z][a-z]+)+)/g, (m, first, rest) => `Omen of the ${first}${rest.replace(/ \/ the /g, ' / Omen of the ')}`);
  const parts = s.split(CUR_RE);
  if (parts.length < 2) return { html: esc(s), chips: false };
  const html = parts.map((p, i) => (i % 2 ? `<span class="cur ${curKind(p)}">${esc(p)}</span>`
    : esc(p).replace(/^\s*\+\s*$/, '<span class="plus">+</span>').replace(/^\s*\/\s*$/, '<span class="plus">/</span>'))).join('');
  return { html, chips: true };
}

// A method line "currencies — what they do": the chips get a row of their own and the explanation goes under it — chips
// inside a sentence read as one glued line. A plain-text aside after the chips ("(preview the result first)") moves down
// with the explanation; chips in brackets lose the brackets ("Sanctify (Divine Orb + Omen…)" → "Sanctify: …").
function howLine(h) {
  const s = String(h);
  const cut = s.indexOf(' — ');
  if (cut > 0) {
    let head = s.slice(0, cut);
    let note = s.slice(cut + 3);
    const par = head.match(/^(.*\S)\s*\(([^()]+)\)$/);
    if (par) {
      if (chipify(par[2]).chips) head = `${par[1]}: ${par[2]}`;
      else { head = par[1]; note = `${par[2]} — ${note}`; }
    }
    // Only a head that is mostly currency: "Before corrupting: Divine Orb, quality and runes" stays one sentence.
    const rest = head.split(CUR_RE).filter((p, i) => i % 2 === 0).join('').replace(/[\s+/:,]/g, '');
    const c = chipify(head);
    if (c.chips && rest.length <= 16) {
      return `<div class="craft-how chain"><div class="ch-chips">${c.html}</div><div class="ch-note">${esc(note)}</div></div>`;
    }
  }
  const c = chipify(s);
  return `<div class="craft-how${c.chips ? ' chips' : ''}">${c.html}</div>`;
}

// "Prices": one quiet line, each currency a separate item — "A ≈ 10 div · B ≈ 1,906 div" ran together.
function pricesLine(names) {
  const items = names.filter((n) => craftPrices[n] != null).map((n) => `<span>${esc(n)} ≈ <b>${esc(approx(craftPrices[n]))}</b></span>`);
  return items.length ? `<div class="craft-prices"><span class="lbl">${esc(t('Prices'))}</span>${items.join('')}</div>` : '';
}

async function priceAll(btn) {
  const list = btn.closest('.clist');
  btn.disabled = true;
  btn.textContent = t('pricing…');
  // Item changed mid-pricing: stop searching (buttons belong to the old item, don't spend the trade limit).
  const mine = state;
  for (const b of [...list.querySelectorAll('[data-ck]')]) {
    if (state !== mine || !list.isConnected) return;
    if (await priceCraft(b) === 'limit') {
      // Trade rate limit: nothing to sort, restore the button so it can be retried later.
      btn.disabled = false;
      btn.textContent = `⇅ ${t('Price all and sort')}`;
      return;
    }
  }
  // By the gain of one attempt: price gain × the odds of the goal tier − what the attempt costs (Exalted + the side's
  // omen). A mod that adds a lot but almost never rolls in its goal tier goes below a likely modest one; without odds —
  // by the price gain alone, after those with odds.
  const rows = [...list.querySelectorAll('.brow')];
  const delta = (r) => (r.dataset.delta == null || r.dataset.delta === '' ? null : Number(r.dataset.delta));
  const perTry = (c) => (craftPrices['Exalted Orb'] ?? 0) + (craftPrices[`Omen of ${c.side === 'prefix' ? 'Sinistral' : 'Dextral'} Exaltation`] ?? 0);
  const use = (r) => {
    const d = delta(r), c = craftCands.get(r.dataset.row);
    if (d == null) return { v: -1e9, odds: false };
    const p = c && (c.chanceGoal ?? c.chance);
    return p != null ? { v: d * p - perTry(c), odds: true, d } : { v: d - 1e6, odds: false, d };
  };
  const u = new Map(rows.map((r) => [r, use(r)]));
  rows.sort((a, b) => u.get(b).v - u.get(a).v).forEach((r) => list.appendChild(r));
  const best = rows.find((r) => u.get(r).odds && u.get(r).v > 0);
  if (best) best.classList.add('best');
  for (const r of rows) {
    const x = u.get(r);
    if (x.d == null || x.d <= 0) r.classList.add('flat');
    else if (x.odds) r.querySelector('.cpx').insertAdjacentHTML('beforeend', `<small class="cper" title="${esc(t('Average gain of one attempt: price gain × chance − the attempt\'s cost'))}">${x.v >= 0 ? '+' : '−'}${approx(Math.abs(x.v))}/${esc(t('try'))}</small>`);
  }
  btn.remove();
  fit();
}

// Price after crafting: current filters + candidate mod. Same stat already present (sum): the minimum grows by the candidate's roll.
async function priceCraft(b) {
  const c = craftCands.get(b.dataset.ck);
  if (!c || !state) return;
  const mine = state;
  b.disabled = true;
  b.textContent = '…';
  const f = withMods(JSON.parse(JSON.stringify(state.filters)), [c]);
  try {
    // A magic item after Regal Orb is already rare: search among rares.
    const it = state.item.rarity === 'Magic' ? { ...state.item, rarity: 'Rare' } : state.item;
    const q = await quickPrice(it, f);
    if (state !== mine) return; // another item was checked while searching: don't touch its pricing
    const v = estimate(q.lots);
    let html;
    const row = b.closest('.brow');
    if (v == null) html = `<span class="cpr" title="${t('Nothing like it is listed — could be rare and pricey')}">${t('none listed')}</span>`;
    else if (q.total < MIN_LOTS) {
      // 1–2 listings is not an estimate: show greyed out, at the bottom when sorting with "Price all".
      html = `<span class="cpr thin" title="${esc(t('Too few listings to price it — one or two prices can be anything'))} · ${esc(t('{n} listings', { n: q.total }))}">${approx(v)}?</span>`;
    } else {
      const est = estNow();
      const d = est != null ? v - est : null;
      const cls = d == null ? '' : d > est * 0.1 ? ' up' : d < -est * 0.1 ? ' down' : '';
      // The gain is what matters: large "+2.1 div", next to it the item's total price with the mod.
      const delta = d == null ? '' : Math.abs(d) < est * 0.1 ? t('same') : `${d > 0 ? '+' : '−'}${approx(Math.abs(d))}`;
      // In the candidates table the column is narrow: gain shown, total price in the tooltip.
      html = row && row.classList.contains('crow')
        ? `<span class="cpr${cls}" title="${t('{n} listed with it · vs your current estimate', { n: q.total })} · ≈ ${approx(v)}">${delta ? `<b>${delta}</b>` : `≈ ${approx(v)}`}</span>`
        : `<span class="cpr${cls}" title="${t('{n} listed with it · vs your current estimate', { n: q.total })}">${delta ? `<b>${delta}</b> · ` : ''}≈ ${approx(v)}</span>`;
      if (row && d != null) row.dataset.delta = Math.abs(d) < est * 0.1 ? 0 : d;
    }
    b.outerHTML = html;
  } catch (e) {
    if (state !== mine) return;
    b.disabled = false;
    b.textContent = b.closest('.crow') ? PRICE_ICON : t('price?');
    setStatus(errText(e), true);
    if (isLimit(e)) return 'limit';
  }
  fit();
}

// Craft goal: what to keep / remove / add and the steps; the button prices the finished item.
let craftGoal = null;
// theme — the item's mods demand was narrowed by (poe.ninja: builds wearing this class with them); marked on the kept rows.
function goalHtml(g, theme = [], themeBuilds = null) {
  const row = (cls, mark, x, extra = '') => `<div class="g ${cls}"><i>${mark}</i>${esc(x.text)}${x.tier ? ` <span class="craft-tier">T${x.tier}</span>` : ''}${extra}</div>`;
  const themeKeys = new Set(theme.map(tplKey));
  const basis = (x) => ((x.templates || []).some((l) => themeKeys.has(tplKey(l)))
    ? ` <span class="basis" title="${esc(t('Demand % in this plan is among {n} builds that wear this item class with this modifier', { n: themeBuilds ?? '?' }))}">${esc(t('demand basis'))}</span>` : '');
  return `<div class="craft-sec goal"><div class="k" title="${esc(t('The best item this base can become — most wanted modifiers for its slots'))}">${esc(t('Goal'))}</div>
    ${g.keep.map((x) => row('keep', '✓', x, (x.up ? ` <span class="tierup" title="${esc(t('Key modifier with a weak tier — a higher tier is worth more'))}">↑ ${esc(t('tier'))}</span>` : '') + basis(x))).join('')}
    ${g.remove.map((x) => row('remove', '✗', x)).join('')}
    ${g.add.map((x) => row('add', '+', x, ` <span class="dem${demPct(x) >= 60 ? ' hot' : ''}" title="${esc(demTitle(x))}">${demPct(x) >= 60 ? '🔥 ' : ''}${esc(t('{pct}% builds', { pct: fmt(demPct(x)) }))}</span>${chanceTag(x.chanceGoal ?? x.chance, x.chanceUnknown, false, x.chanceGoal != null ? x.target : null)}${x.essence ? ` <span class="ess">◈ ${esc(x.essence.short)}</span>` : ''}`)).join('')}
</div>`;
}

// Filters "as for the finished item": removed mods off, added ones at the tier's lowest roll, their "without mod" exclusion cleared.
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


// Approximate chance of a mod with Exalted plus the omen for its side: "common / medium / rare" label and "≈ 1 in N".
// Chance per attempt as "1 in 6", colored by rarity (common / medium / rare); unknown: "—" with an explanation.
// dash — in the candidates table "unknown" is a muted dash (explained in the column header tooltip).
function chanceTag(p, unknown, dash = false, target = null) {
  if (unknown) return ` <span class="chance unknown" title="${esc(t('Valuable modifiers cannot be estimated from trade listings — items with them are priced and listed differently'))}">${dash ? '—' : esc(t('unknown'))}</span>`;
  if (p == null) return '';
  const cls = p >= 0.12 ? 'common' : p >= 0.04 ? 'uncommon' : 'rare';
  const n = Math.max(1, Math.round(1 / p));
  const text = p >= 0.5 ? `~${Math.round(p * 100)}%` : t('1 in {n}', { n: String(n) }); // "1 in 1.7" reads poorly
  // The goal tier the chance is for (+4 minion levels: T1 only) — under the number.
  return ` <span class="chance ${cls}" title="${esc(t('Rough estimate: Exalted Orb + omen of its side gives this modifier in {tiers} about 1 in {n} times', { n, tiers: target || 'T1–T2' }))}">${esc(text)}${target ? `<small class="ctgt">${esc(target)}</small>` : ''}</span>`;
}

// ---- Crafting for beginners: slots on the item, "sell or craft", plan with costs ----
let craftPrices = {}; // div per unit of each currency in the plan (poe.ninja)
let goalValue; // goal price: undefined = computing, null = not found
let goalBasis = 'exact'; // what the goal price is based on: exact = identical items, similar = similar ones, partial = lower bound
// Goal price from too few listings (fewer than MIN_LOTS, core.js): shown, but no verdict is based on it.
let goalThin = null; // { value, n }: price from too few listings
// Budget variants of the plan (Cheap / Balanced / Ideal): [{ key, mods, adds, plan, value, basis, thin }] or null.
let variants = null;
let planVariant = 'ideal'; // the chosen variant (picked automatically until the user clicks one)
let variantPicked = false; // the user chose a variant for this item — no more automatic picks
let variantsItem = null;
const curVariant = () => (variants && variants.find((v) => v.key === planVariant)) || null;
// Price of what the chosen variant makes: the full goal, or that variant's own trade search.
const curGoal = () => { const v = curVariant(); return v && v.key !== 'ideal' ? { value: v.value, basis: v.basis, thin: v.thin } : { value: goalValue, basis: goalBasis, thin: goalThin }; };

// Slots on the item as circles: occupied (colored by tier), free; fractured has a ring.
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

// The plan cost model lives in src/shared/plancost.js (also used by tests and the simulation).
const planner = PlanCost.create(() => ({ prices: craftPrices, goalValue: curGoal().value, est: estNow() }));
const { stepCost, expandPlan, EXALT_NAME } = planner;

// Currency in steps as colored tags (orbs, omens, bones, essences): the recipe reads at a glance.
function curKind(n) {
  if (/^Omen of /.test(n)) return 'omen';
  if (/(Rib|Jawbone|Collarbone|Cranium|Vertebrae)$/.test(n)) return 'bone';
  if (/Essence/.test(n)) return 'essence';
  return 'orb';
}
let craftThin = new Set(); // currency priced from a handful of trades (poe.ninja volume) — marked on its chip
const curChips = (list) => list.map((n) => `<span class="cur ${curKind(n)}${craftThin.has(n) ? ' thin' : ''}"${craftThin.has(n) ? ` title="${esc(t('Price from only a few trades on poe.ninja — a guess'))}"` : ''}>${curIcon(n, n, true)}</span>`).join('<span class="plus">+</span>');

// Essence / Alloy on a rare: order matters. First a sacrificial mod via Exalted on that side, then the omen
// Crystallisation + essence (removes a random mod of that side). Without a sacrifice one of your mods goes: steps, numbered.
// c.currencies: [essence, Crystallisation omen, Exalted Orb, side omen?].
// Chance the essence removes a key mod of the item (not the sacrificial or plan-added one): key mods on the side / all mods
// of the side including the sacrifice.
// The one fact a step must not hide, worst first: almost impossible (< 1 in 1000 a try), a long shot (< 1 in 100, or a
// single attempt whose miss stays), risky (≥ 1 in 3 to take a needed mod instead of the junk), odds unknown.
// → { kind, text } for the step's badge and its stripe, or null for a plain step.
function stepFlag(s, c, steps) {
  const pct = (x) => (x >= 0.5 ? `~${Math.round(x * 100)}%` : oneIn(x));
  if (s.act !== 'remove' && !c.lottery) {
    const ps = (c.chances || [c.chance]).filter((x) => x != null);
    const p = ps.length ? Math.min(...ps) : null;
    const at = s.target ? ` ${t('at {tiers}', { tiers: s.target })}` : '';
    if (p != null && p < 0.001) return { kind: 'shot', num: oneIn(p), text: `${at} · ${t('almost impossible')}` };
    if (p != null && (p < 0.01 || c.hopeless)) return { kind: 'shot', num: pct(p), text: `${at} · ${c.hopeless ? t('one attempt') : t('per attempt')}` };
  }
  // The chance to take a needed mod — the same numbers as the detailed warnings below.
  let hit = 0;
  if (s.mods && s.sides && c.hits > 0.05) {
    const sided = (c.currencies || []).some((n) => /^Omen of (Sinistral|Dextral) (Annulment|Crystallisation)$/.test(n));
    const parts = Object.values(s.sides).filter((x) => (sided ? x.J : x.J || x.K));
    const J = parts.reduce((a, x) => a + x.J + (x.des || 0) + (x.S || 0), 0), K = parts.reduce((a, x) => a + x.K, 0);
    if (J + K) hit = K / (J + K);
  }
  const own = s.desFirst ? s.side : c.cross ? c.cross.side : null;
  if (own) {
    const r = steps.find((x) => x.sides && (x.desMerge || x.essMerge));
    const x = r && r.sides[own];
    if (x && x.K) hit = Math.max(hit, x.K / (x.J + (x.des || 0) + (x.S || 0) + x.K));
  }
  if (c.k === 'essence' && c.chance < 1 && (s.atRisk || []).length) hit = Math.max(hit, Math.min(s.atRisk.length, s.onSide || 0) / ((s.onSide || 0) + 1));
  if (hit >= 1 / 3) return { kind: 'risk', num: frac(hit), text: t('chance to remove a needed modifier') };
  if (c.lottery) return { kind: 'unknown', num: '', text: t('Odds unknown') };
  // A sure step (an essence, a targeted removal) with nothing needed at stake — the good news gets its colour too.
  if (c.chance != null && c.chance >= 1 && !(c.hits > 0.05)) return { kind: 'sure', num: '', text: t('Guaranteed') };
  return null;
}
// «2 in 3» reads faster than 67%: a simple fraction when there is one (denominators up to 6), else a percentage.
function frac(x) {
  for (let d = 2; d <= 6; d++) { const n = Math.round(x * d); if (n > 0 && n < d && Math.abs(n / d - x) < 0.02) return t('{n} in {d}', { n, d }); }
  return `~${Math.round(x * 100)}%`;
}
// Small calm line icons (an emoji die was too small, letters in discs too loud): a warning triangle for risk, a clock for
// a long shot, a question mark and a check in a ring.
const FLAG_ICON = {
  risk: '<svg viewBox="0 0 16 16" width="15" height="15"><path d="M8 1.6 15 14H1z" fill="currentColor"/><path d="M8 6v4.2M8 11.8v.4" stroke="#1b1d22" stroke-width="1.7" stroke-linecap="round"/></svg>',
  shot: '<svg viewBox="0 0 16 16" width="15" height="15"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.6V8l2.4 1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  unknown: '<svg viewBox="0 0 16 16" width="15" height="15"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.3 6.3a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.7-.9 1.3M8 11.4v.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  sure: '<svg viewBox="0 0 16 16" width="15" height="15"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m5.3 8.2 1.8 1.8 3.6-3.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// A verdict's headline with its mark: a line icon in the verdict's colour (✅ / ✖ / 🎉 were emoji from another world —
// coloured, glossy, a different size on every system). The text sits in its own column, notes under it align with it.
const VERDICT_ICON = {
  good: FLAG_ICON.sure,
  lot: FLAG_ICON.unknown, // wins on average, loses in most runs
  info: '<svg viewBox="0 0 16 16" width="15" height="15"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 7.2v4M8 4.8v.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  bad: '<svg viewBox="0 0 16 16" width="15" height="15"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m5.7 5.7 4.6 4.6m0-4.6-4.6 4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};
const vHead = (kind, html) => `<span class="vic">${VERDICT_ICON[kind]}</span><span class="vh">${html}</span>`;

function keyRisk(s) {
  const n = (s.onSide || 0) + 1;
  const r = Math.min(s.atRisk.length, n - 1) / n;
  const fmtOdds = (x) => (x >= 0.5 ? `~${Math.round(x * 100)}%` : oneIn(x));
  // The side isn't full at this step: more mods on it (needed or sacrificial) means a lower chance to hit a key one.
  const full = s.cap && n < s.cap ? ` ${t('· with all {n} {side}es filled — {odds}', { n: s.cap, side: t(s.side), odds: fmtOdds(Math.min(s.atRisk.length, s.cap - 1) / s.cap) })}` : '';
  return `<div class="ps-risk">⚠ ${esc(t('{odds}: it removes {mods} instead of the sacrificial modifier', { odds: fmtOdds(r), mods: s.atRisk.map((m) => `«${m}»`).join(t(' or ')) }) + full)}</div>`;
}

// Liquid Emotions on a jewel: options for this base: which mod it gives, how many builds use it, emotion price; risk of
// removing a key mod (the emotion removes a random one).
function emotionsHtml(s, how) {
  const head = `<div class="k">${esc(t('Liquid Emotions (Delirium) — the main jewel craft'))}</div>`;
  if (s.blocked || !s.options.length) return `<div class="craft-sec">${head}${how(s.how)}</div>`;
  const side = (o) => (o.two ? t('prefix or suffix — the side of the removed modifier') : t(o.side));
  const rows = s.options.map((o) => `<div class="erow"><span class="ename">${curChips([o.name])}</span>
    <span class="emod">${esc(o.text)} <small class="muted">· ${esc(side(o))}</small></span>
    <span class="edem">${o.pct ? `${hot(o.pct)}${fmt(o.pct)}%` : '—'}</span>
    <span class="epx">${craftPrices[o.name] != null ? approx(craftPrices[o.name]) : '—'}</span></div>`).join('');
  const r = s.risk;
  const risk = r.keys.length
    ? `<div class="ps-risk">⚠ ${esc(t('Removes a random one of the {n} modifiers: {k} of them are key ({mods}) — {odds} to lose one', { n: r.n, k: r.keys.length, mods: r.keys.join(', '), odds: r.keys.length / r.n >= 0.5 ? `~${Math.round(r.keys.length / r.n * 100)}%` : oneIn(r.keys.length / r.n) }))}</div>`
    : `<div class="craft-sub">${esc(t('No key modifiers on the item — a removed one is no loss'))}</div>`;
  return `<div class="craft-sec">${head}<div class="erows"><div class="erow ehead"><span>${esc(t('Emotion'))}</span><span>${esc(t('Modifier'))}</span><span>${esc(t('builds'))}</span><span>${esc(t('price'))}</span></div>${rows}</div>${risk}${how(s.how)}</div>`;
}

function essenceSeq(s, c) {
  const [ess, crystal, ...sac] = c.currencies;
  const side = t(s.side);
  return `<div class="ps-seq"><div><b>1</b> ${curChips(sac)} <span>— ${esc(t('first a cheap «sacrificial» {side} — without it {essence} removes one of your {side}es', { side, essence: ess }))}</span></div>
    <div><b>2</b> ${curChips([crystal, ess])} <span>— ${esc(t('removes a random {side} and adds its own', { side }))}</span></div></div>`;
}

const STEP_LABEL = {
  augment: (s) => t('Add a {side} while it is magic', { side: t(s.side) }),
  rune: (s) => t('Socket the rune: «{mod}» (permanent)', { mod: s.mod }) + (s.free ? '' : ` — ${t("needs a free augment socket (Artificer's Orb)")}`),
  regal: () => t('Make it rare'),
  essence: (s) => t('Make it rare with {mod}', { mod: s.mod }),
  remove: (s) => t('Remove {mod}', { mod: s.mod || [...s.mods, ...(s.des ? [s.des.mod] : [])].join(', ') }),
  add: (s) => t('Add {mod}', { mod: s.mod }) + (s.orMods && s.orMods.length ? ` (${t('or {mods}', { mods: s.orMods.slice(0, 3).join(', ') })})` : ''),
  add2: (s) => t('Add {a} and {b}', { a: s.steps[0].mod, b: s.steps[1].mod }),
  replace: (s) => t('Replace {junk} with {mod}', { junk: s.junk.join(', '), mod: s.mod }),
};

// The same steps split for the plan card: a muted verb, then each mod on its own line in the mod colour.
const STEP_PARTS = {
  remove: (s) => ({ verb: t('Remove'), mods: s.mod ? [s.mod] : [...s.mods, ...(s.des ? [s.des.mod] : [])], or: [] }),
  add: (s) => ({ verb: t('Add'), mods: [s.mod], or: (s.orMods || []).slice(0, 3) }),
  add2: (s) => ({ verb: t('Add'), mods: [s.steps[0].mod, s.steps[1].mod], or: [] }),
  replace: (s) => ({ verb: t('Replace'), mods: [...s.junk, `→ ${s.mod}`], or: (s.orMods || []).slice(0, 3) }),
};

// «1 in 1» reads as «certain»: from even odds up the chance is a percentage (94% is not a sure thing).
const oneIn = (c) => (c >= 0.5 ? `~${Math.round(c * 100)}%` : oddsText(1 / c));
const EXALT_WHY = {
  greater: 'low tiers cut off (level 35+; a family without such tiers rolls its best one)',
  perfect: 'low tiers cut off (level 50+; a family without such tiers rolls its best one)',
};

// Long plans (more than 3 steps) are collapsed: the first two steps in full, the third peeks out under a fade, then
// "Show all N steps". The choice is remembered; in the two-column window nothing is collapsed (CSS: body.wide).
const STEPS_SHOWN = 3;
let stepsOpen = false;
try { stepsOpen = localStorage.getItem('planStepsOpen') === '1'; } catch { /* storage unavailable — collapsed by default */ }
function toggleSteps(box) {
  stepsOpen = !stepsOpen;
  try { localStorage.setItem('planStepsOpen', stepsOpen ? '1' : '0'); } catch { /* not remembered — fine */ }
  const b = box.querySelector('.steps-toggle');
  const rest = [...box.querySelectorAll('ol.plan > li')].slice(STEPS_SHOWN);
  const apply = () => {
    box.classList.toggle('open', stepsOpen);
    if (b) b.textContent = stepsLabel(+box.dataset.n);
    fit();
  };
  if (stepsOpen) { apply(); reveal(rest, { stagger: true }); } else conceal(rest, apply);
}
const stepsLabel = (n) => (stepsOpen ? `− ${t('Collapse')}` : `+ ${t('Show all {n} steps', { n })}`);

// Essence of the Abyss removal as two numbered steps; the Mark is removed with Omen of Light — or, if a later step
// desecrates on the side where the Mark landed, desecrated right away (Desecrate replaces the Mark with an unrevealed mod
// of a higher tier — poe2db; which side it lands on is not verified, hence a conditional hint, not part of the cost).
function abyssSeq(c, desSide) {
  const [ess, ...rest] = c.currencies;
  const crystals = rest.filter((n) => /Crystallisation$/.test(n));
  const side = t(/Sinistral/.test(crystals[0] || '') ? 'prefix' : 'suffix');
  return `<div class="ps-seq"><div><b>1</b> ${curChips([ess, ...crystals])} <span>— ${esc(t('removes a random {side} and leaves a desecrated Mark', { side }))}</span></div>
    <div><b>2</b> ${curChips(['Omen of Light', 'Orb of Annulment'])} <span>— ${esc(t('removes the Mark'))}</span></div>
    ${desSide ? `<div class="ps-alt">${esc(t('If the Mark landed on the {side}es — skip step 2 and desecrate right away (step with Desecrate below): it replaces the Mark with an unrevealed modifier of a higher tier', { side: t(desSide) }))}</div>` : ''}</div>`;
}

// A removal that can hit wanted mods: the same warning as for an essence — the odds per attempt, which mods, and how many
// of them it hits on average before the junk is gone. A side omen (Annulment or the Abyss chain's Crystallisation) limits it
// to the junk's side; a plain Annulment picks among all mods.
// A step that itself removes a random mod of a side before the removal step (Desecrate with Necromancy on a full side,
// an essence with Crystallisation): the same risk as the removal's first attempt, shown where it happens — the side's
// wanted mods it may take instead of the junk.
function sideRisk(steps, side) {
  const r = steps.find((x) => x.sides && (x.desMerge || x.essMerge));
  const x = r && r.sides[side];
  if (!x || !x.K) return '';
  const J = x.J + (x.des || 0) + (x.S || 0), K = x.K;
  const names = (x.names || []).map((m, i) => { const again = (x.again || [])[i]; return again ? `«${m}» (${t('back: {odds} per Exalt', { odds: oneIn(again) })})` : `«${m}»`; });
  if (!names.length) return '';
  const odds = K / (J + K);
  return `<div class="ps-risk">⚠ ${esc(t('{odds}: it removes {mods} instead of the junk', { odds: odds >= 0.5 ? `~${Math.round(odds * 100)}%` : oneIn(odds), mods: names.join(t(' or ')) }))}</div>`;
}

function removeRisk(s, c) {
  if (!(c.hits > 0.05)) return '';
  const sided = c.currencies.some((n) => /(Annulment|Crystallisation)$/.test(n) && /^Omen of (Sinistral|Dextral)/.test(n));
  const parts = Object.values(s.sides).filter((x) => (sided ? x.J : x.J || x.K));
  // The desecrated junk in the run and the spare junk count as junk too (an Annulment hitting them is progress).
  const J = parts.reduce((a, x) => a + x.J + (x.des || 0) + (x.S || 0), 0), K = parts.reduce((a, x) => a + x.K, 0);
  // Each wanted mod with the odds of one Exalted Orb + side omen giving it back: losing Spirit is not losing +levels.
  const names = parts.flatMap((x) => (x.names || []).map((m, i) => {
    const again = (x.again || [])[i];
    return again ? `«${m}» (${t('back: {odds} per Exalt', { odds: oneIn(again) })})` : `«${m}»`;
  }));
  if (!K || !names.length) return '';
  const odds = K / (J + K);
  const fmtOdds = odds >= 0.5 ? `~${Math.round(odds * 100)}%` : oneIn(odds);
  return `<div class="ps-risk">⚠ ${esc(t('{odds} first try: it removes {mods}, not the junk · ≈{hits} lost on average', { odds: fmtOdds, mods: names.join(t(' or ')), hits: fmt(Math.round(c.hits * 10) / 10) }))}</div>`;
}

// Not worth crafting: the steps of a craft you are told not to do are only reading — folded behind a link.
let verdictBad = false; // set by verdictBody, drawn just before the steps
let planAnyway = false;
function planHtml(plan) {
  if (planBusy()) return '<div class="plan-steps pending"></div>'; // the class stays: refreshPlan swaps it for the steps
  if (verdictBad && !planAnyway) return `<div class="plan-steps folded"><button class="link" data-act="plananyway">${esc(t('Show the plan anyway'))}</button></div>`;
  const steps = expandPlan(plan);
  const costs = steps.map(stepCost);
  // What each step must not hide (a badge and a stripe) and, above the steps, how many of each.
  const flags = steps.map((s, i) => stepFlag(s, costs[i], steps));
  const long = steps.length > STEPS_SHOWN;
  // A later Desecrate step and its side (for the Mark hint) and later additions per side (what a removal frees a slot for).
  const desAt = (i) => { for (let j = i + 1; j < steps.length; j++) if (costs[j].k === 'desecrate') return steps[j].side; return null; };
  const addsAfter = (i, side) => steps.slice(i + 1).flatMap((x) => (x.act === 'add2' ? x.steps : x.act === 'add' || x.act === 'replace' ? [x] : []))
    .filter((x) => x.side === side).map((x) => x.mod);
  // Shown anyway: the same toggle folds them back.
  const hide = verdictBad ? `<button class="link plan-hide" data-act="plananyway">${esc(t('Hide the plan'))}</button>` : '';
  return `<div class="plan-steps${long ? ' collapsible' : ''}${stepsOpen ? ' open' : ''}" data-n="${steps.length}">${hide}<ol class="plan">${steps.map((s, si) => {
    const c = costs[si];
    // Right column of the card: the expected cost of the whole step, or — for a one-attempt step — the price of one attempt
    // (marked "per attempt": the two are not the same thing). The body keeps only the chance.
    let odds, side = null;
    // Unknown chance: the total can't be estimated, but one attempt has a price — shown for repeatable steps too.
    if (c.lottery) { odds = t('chance unknown — valuable modifier'); if (Number.isFinite(c.perTry)) side = { cost: c.perTry, per: true }; }
    else if (c.hopeless) { odds = t('{odds} at {tiers}', { odds: (c.chances || [c.chance]).map(oneIn).join(' / '), tiers: s.target || 'T1–T2' }); side = { cost: c.perTry, per: true }; }
    else if (c.k === 'essence') odds = c.chance >= 1 ? t('guaranteed') : oneIn(c.chance);
    else if (c.chances) odds = t('{odds} at {tiers}', { odds: c.chances.map(oneIn).join(' / '), tiers: s.target || (s.steps ? s.steps.map((x) => x.target || 'T1–T2').join(' / ') : 'T1–T2') });
    else if (s.mods) odds = '';
    else odds = c.chance >= 1 ? t('guaranteed') : oneIn(c.chance);
    if (!side && c.cost != null) side = { cost: c.cost, sub: s.mods ? (Math.round(c.tries * 10) === 10 ? t('1 attempt') : t('≈ {n} attempts', { n: fmt(Math.round(c.tries * 10) / 10) })) : '' };
    const notes = [];
    const key = []; // the step can't be done without these, shown up front; the rest goes under "details"
    // Regal's random mod: room on one side only — it stays unless it lands on the tight side (craft.js planGoal).
    if (s.act === 'regal' && s.tightSide) key.push(t('If the random modifier lands on the {side}es, remove it before adding — no room there', { side: t(s.tightSide) }));
    if (c.two) key.push(t('one Exalted Orb adds both modifiers'));
    // A step that accepts alternatives: its odds are for any of them — the wanted mod alone is rarer, say so.
    const os = s.exaltOwn ? s : s.add && s.add.exaltOwn ? s.add : null;
    const ok = c.k === 'chaos' ? ['base', 'greater', 'perfect'][['Chaos Orb', 'Greater Chaos Orb', 'Perfect Chaos Orb'].indexOf(c.currencies[0])] : c.k;
    const own = os && os.exaltOwn[ok], anyOf = os && os.exalt[ok];
    if (own && anyOf && own.chance && anyOf.chance && c.chance && !c.lottery) key.push(t('{odds} — any of them; {mod} alone — {own}', { odds: oneIn(c.chance), mod: os.mod, own: oneIn(c.chance * own.chance / anyOf.chance) })); // visible: otherwise two "Add" steps look like four Exalts
    if (s.mods) notes.push(c.hits > 0.05
      ? t('on average ≈{n} needed modifiers get hit too — re-adding them is counted in the price', { n: fmt(Math.round(c.hits * 10) / 10) })
      : t('only unwanted modifiers can be hit'));
    // Why one attempt: a desecrated miss is removed precisely (Annulment + Omen of Light) — it is the price of that, not the risk.
    if (c.hopeless) notes.push(c.k === 'desecrate'
      ? t('One attempt: removing a miss (Orb of Annulment + Omen of Light) and trying again costs more than the goal is worth')
      : t('One attempt: a miss stays on the item — removing it at random would more likely hit a needed modifier'));
    else if (s.act !== 'remove' && c.k !== 'desecrate' && c.k !== 'essence' && (s.onSide || s.onItem)) notes.push(t('the average includes misses: an Annulment may hit a needed modifier, which then has to be added again'));
    if (c.k === 'essence') notes.push(t('Uses the only crafted-modifier slot (one per item; Alloys too)'));
    if (c.k === 'chaos') {
      // One short line up front; «sure only once» — the follow-up — under details.
      key.push(c.currencies.includes('Omen of Whittling')
        ? t('{orb} + Whittling removes the lowest-level modifier ({junk}) and adds a random one', { orb: c.currencies[0], junk: c.junk.join(', ') })
        : t('{orb}: repeat until it removes {junk} and adds {mod}', { orb: c.currencies[0], junk: c.junk.join(', '), mod: s.mod }));
      if (c.currencies.includes('Omen of Whittling') && c.then) notes.push(t('Sure only once: if the new modifier is not {mod}, it is no longer the lowest — go on with {then}', { mod: s.mod, then: c.then.join(' + ') }));
      if (c.currencies[0] !== 'Chaos Orb') key.push(t('{orb}: the new modifier is level {level}+ — a better shot at a good tier', { orb: c.currencies[0], level: /^Perfect/.test(c.currencies[0]) ? 50 : 35 }));
      if (c.land < 1) notes.push(t('The item has a free slot: the new modifier lands on this side about half the time'));
    }
    // A fixed essence value on the tier ladder: lower than Exalted / Desecrate can roll here, or T1 needs a higher item level.
    const et = c.k === 'essence' && s.essTier && s.essTier[c.currencies[0]];
    if (et && s.bestTier && et.tier > s.bestTier) notes.push(t('{essence} gives {value} — tier {tier}, while Exalted / Desecrate can roll tier {best} on this item', { essence: c.currencies[0], value: et.value, tier: et.tier, best: s.bestTier }));
    else if (et && s.topLevel) notes.push(t('Tier 1 ({range}) needs item level {level} — this base cannot roll it, the essence is as good as it gets', { range: s.topRange, level: s.topLevel }));
    if (c.k === 'desecrate') {
      notes.push(t('Desecrate: reveal it at the Well of Souls and pick 1 of 3 offered modifiers — only one desecrated modifier per item'));
      // Unknown desecrated weights matter when the wanted one is one of many; three of four shown twice — hardly at all.
      if (c.desAvg && c.chance != null && c.chance < 0.9) notes.push(t('Rough odds: the weights of desecrated modifiers are unknown — they are counted as average'));
      if (/^Ancient /.test(c.bone)) notes.push(t('Ancient bone — low tiers cut off (level 40+)'));
      if (c.echo) notes.push(t('Omen of Abyssal Echoes — reroll the 3 options once'));
      if (c.bone === 'Altered Collarbone') notes.push(t('Altered Collarbone: desecrates jewellery with a chance for otherworldly (Breach) modifiers — how often they show up among the options is unknown'));
      if (c.lich) notes.push(t(c.lich.n <= 3 ? 'Lich omen: all options come from {lich}\'s pool — {n} on this side, so the modifier is guaranteed' : 'Lich omen: all options come from {lich}\'s pool — {n} on this side', { lich: c.lich.name[0].toUpperCase() + c.lich.name.slice(1), n: c.lich.n }));
      if (s.desFirst) key.push(t('Do this before removing: with {omen} the desecration itself removes a random {side}', { side: t(s.side), omen: s.necro }));
      key.push(t('At the reveal pick: {mods}', { mods: [s.mod, ...(s.orMods || [])].join(' › ') }));
      notes.push(t('A miss → Orb of Annulment + Omen of Light removes it ({cost})', { cost: approx((craftPrices['Orb of Annulment'] || 0) + (craftPrices['Omen of Light'] || 0)) }));
    }
    if (EXALT_WHY[c.k]) notes.push(t(EXALT_WHY[c.k]));
    if (s.blocker && c.k !== 'essence' && c.k !== 'desecrate') {
      const better = c.chance && !c.lottery ? oneIn(Math.min(1, c.chance / (1 - s.blocker.share))) : null;
      notes.push(t('Blocker: first add a cheap «{mod}» (≈{pct}% of rolls here; e.g. pick it in a desecrate reveal) — its group can no longer roll{odds}; remove it afterwards', { mod: s.blocker.text, pct: Math.round(s.blocker.share * 100), odds: better ? ` (${better})` : '' }));
    }
    if (s.act !== 'remove' && c.k !== 'desecrate' && s.sideOmen && !c.currencies.includes(s.sideOmen)) notes.push(t('without a side omen half the rolls land on the other side'));
    const altText = (o) => o.k === 'essence'
      ? `${o.currencies.join(' + ')} · ${oneIn(o.chances[0])} · ${t('≈ {cost} on average', { cost: approx(o.cost) })}`
      : o.k === 'desecrate'
      ? `${t('Desecrate')}${o.mod ? ` (${o.mod})` : ''}: ${o.currencies.join(' + ')}${o.chances[0] != null ? ` · ${oneIn(o.chances[0])}` : ''}${c.lottery ? '' : ` · ${t('≈ {cost} on average', { cost: approx(o.cost) })}`}`
      : `${o.currencies[0]}${o.chances && o.chances[0] != null ? ` · ${oneIn(o.chances[0])}${s.target ? ` ${s.target}` : ''}` : ''} · ${t('≈ {cost} on average', { cost: approx(o.cost) })}`;
    const alts = [...(c.alts || []).filter((o) => o.k !== 'desecrate' && o.k !== 'essence'), ...(c.desAlt || []).slice(0, 2)].filter((o) => Number.isFinite(o.cost)).map(altText);
    if (c.other) alts.push(t('{how}: ≈{n} attempts, ≈{hits} needed modifiers hit, {cost} in currency', { how: c.other.currencies.join(' + '), n: fmt(Math.round(c.other.tries * 10) / 10), hits: fmt(Math.round(c.other.hits * 10) / 10), cost: approx(c.other.spent) }));
    if (c.des) notes.push(t('«{mod}» goes too when an Annulment hits it; only if it is the last one left ({odds}) — Orb of Annulment + Omen of Light ({cost})', { mod: c.des.mod, odds: oneIn(Math.max(c.des.left, 0.01)), cost: approx(c.des.cost) }));
    // The currencies are the step's chips; the note says only why this order works.
    if (c.cross) notes.push(c.cross.same
      ? t('Removes a random {side} while the junk is still there — one Annulment attempt — and its modifier takes the freed slot; no sacrificial modifier', { side: t(c.cross.side) })
      : t('Removes a random {side} — the junk you are removing anyway, or one Annulment attempt\'s risk — and adds its modifier into the free {own}; your {own}es are never hit', { side: t(c.cross.side), own: t(s.side) }));
    if (c.essMerge) notes.push(t('One attempt fewer: the essence in the previous step already removed a random {side}', { side: t(c.essMerge.side) }));
    if (c.desMerge) notes.push(t('One attempt fewer: the desecration in the previous step already removed a random {side}', { side: t(c.desMerge.side) }));
    if (s.freeQuality) notes.push(t('{mod} has done its job: quality is already above 20% and stays after it is removed (community data) — the crafted slot frees up', { mod: s.freeQuality }));
    if (s.whittleWrong) notes.push(t('Chaos Orb + Omen of Whittling would not help: it removes the lowest-level modifier, and that is «{mod}» (level {level})', { mod: s.whittleWrong.mod, level: s.whittleWrong.level }));
    if (c.whittle) alts.push(t('{mod}: Chaos Orb + Omen of Whittling removes it for sure (lowest-level modifier), a random modifier takes its place — {list}', { mod: s.whittle,
      list: c.whittle.map((o) => `${o.orb}${o.level ? ` (${t('new one {n}+', { n: o.level })})` : ''} ≈ ${approx(o.cost)}`).join('; ') }));
    // Essence of the Abyss chain: if chosen, explain the order; if another way is cheaper, show it under "Instead".
    // Removal: what it frees a slot for, and its price split into currency and the risk of hitting a wanted mod.
    const why = [];
    // What a removal is for, under its title: «Remove +115 life» alone reads as losing a good mod for nothing.
    const frees = s.mods && s.sides ? Object.entries(s.sides).filter(([, x]) => x.J).map(([sd]) => { const m = addsAfter(si, sd); return m.length ? t('frees a {side} for {mods}', { side: t(sd), mods: m.slice(0, 2).join(', ') }) : ''; }).filter(Boolean) : [];
    if (s.mods && s.sides) {
      // Spare junk (the variant no longer needs its slot): an Annulment taking it instead is progress, not a miss.
      const spare = Object.values(s.sides).filter((x) => x.J).flatMap((x) => x.spareNames || []);
      if (spare.length) why.push(t('If it takes {mods} instead, that is fine too: the slot is freed just as well', { mods: spare.map((m) => `«${m}»`).join(t(' or ')) }));
      if (c.hits > 0.05 && c.spent != null && c.cost != null) why.push(t('currency ≈ {cur} · risk of hitting a needed modifier ≈ {risk}', { cur: approx(c.spent), risk: approx(Math.max(0, c.cost - c.spent)) }));
    }
    if (c.abyss) {
      const how = t('{chain}: removes a random modifier of the side like an Annulment omen; the Mark it leaves is desecrated and Omen of Light removes it', { chain: c.abyss.currencies.join(' → ') });
      alts.push(t('{how}: ≈{n} attempts, ≈{hits} needed modifiers hit, {cost} in currency', { how, n: fmt(Math.round(c.abyss.tries * 10) / 10), hits: fmt(Math.round(c.abyss.hits * 10) / 10), cost: approx(c.abyss.spent) }));
    }
    for (const e of c.erasure || []) alts.push(t('{orb} + {omen}: removes a random {side} ({odds} hits an unwanted one) and adds a random modifier, ≈ {cost} per try', { orb: e.orb, omen: e.omen, side: t(e.side), odds: e.chance >= 0.5 ? `~${Math.round(e.chance * 100)}%` : t('1 in {n}', { n: Math.round(1 / e.chance * 10) / 10 }), cost: approx(e.cost) }));
    if (c.regal && c.regal.length) notes.push(t('Greater / Perfect Regal Orb: the random modifier is level 35+ / 50+ — instead: {list}', { list: c.regal.map((o) => `${o.orb} ≈ ${approx(o.cost)}`).join('; ') }));
    const desNote = (c.desAlt || []).some((o) => o.k === 'desecrate') ? t('Desecrate: pick 1 of 3 offered modifiers at the Well of Souls, but a miss costs Orb of Annulment + Omen of Light ({cost})', { cost: approx((craftPrices['Orb of Annulment'] || 0) + (craftPrices['Omen of Light'] || 0)) }) : '';
    // Explanations and alternatives are collapsed: the step shows only what to do, with what, the chance and the cost.
    // The risk breakdown (which mods, the odds of getting each back) — the badge says how risky; the details say why.
    const riskHtml = [
      c.risky && c.chance < 1 && !s.mods ? `<div class="ps-risk">${esc(t('A miss removes a good modifier instead'))}</div>` : '',
      s.mods && s.sides ? removeRisk(s, c) : '',
      s.desFirst ? sideRisk(steps, s.side) : c.cross ? sideRisk(steps, c.cross.side) : '',
      c.k === 'essence' && c.chance < 1 && (s.atRisk || []).length ? keyRisk(s) : '',
    ].join('');
    const more = [...why.map((w) => `<div class="ps-note">${esc(w)}</div>`), riskHtml, ...notes.map((n) => `<div class="ps-note">${esc(n)}</div>`),
      ...(alts.length ? [`<div class="ps-note">${esc(t('Instead: {list}', { list: alts.join('; ') }))}</div>`] : []),
      ...(desNote ? [`<div class="ps-note">${esc(desNote)}</div>`] : [])];
    const parts = STEP_PARTS[s.act] ? STEP_PARTS[s.act](s) : null;
    const title = parts
      ? `<span class="ps-verb">${esc(parts.verb)}</span>${parts.mods.map((m) => `<span class="ps-mod">${esc(m)}</span>`).join('')}${parts.or.length ? `<span class="ps-or">${esc(t('or {mods}', { mods: parts.or.join(', ') }))}</span>` : ''}${frees.map((f) => `<span class="ps-or">${esc(f)}</span>`).join('')}`
      : esc(STEP_LABEL[s.act](s));
    // Essence and the Abyss chain show their own numbered sequence instead of a single chip line.
    // The currencies as chips, to catch the eye; an essence with a sacrifice and the Abyss chain show them in their numbered
    // sequence instead (an essence on a side with junk — cross — has no sequence, its chips go here).
    // «guaranteed» is the green badge below — not repeated next to the currencies.
    // The badge carries the number (and the goal tier) — the odds are not repeated next to the currencies.
    const how = [(c.k === 'essence' && !c.cross) || c.viaAbyss ? '' : curChips(c.currencies), flags[si] ? '' : esc(odds)].filter(Boolean).join(' · ');
    const sideHtml = side ? `<div class="ps-side${side.per ? ' per' : ''}"><b class="ps-cost">${moneyHtml(`≈ ${approx(side.cost)}`)}</b>${side.per ? `<small>${esc(t('per attempt'))}</small>` : side.sub ? `<small>${esc(side.sub)}</small>` : ''}</div>` : '';
    const flag = flags[si];
    const cls = [side ? 'has-side' : '', flag ? `flag-${flag.kind}` : ''].filter(Boolean).join(' ');
    return `<li${cls ? ` class="${cls}"` : ''}><div class="ps-main"><div class="ps-what">${title}</div>
      ${c.k === 'essence' && !c.cross ? essenceSeq(s, c) : ''}${c.viaAbyss ? abyssSeq(c, desAt(si)) : ''}
      ${how ? `<div class="ps-how">${how}</div>` : ''}
      ${flag ? `<div class="ps-flag ${flag.kind}"><span class="fi">${FLAG_ICON[flag.kind]}</span>${flag.num ? `<b>${esc(flag.num)}</b>` : ""}<span>${esc(flag.text)}</span></div>` : ''}
      ${key.length ? `<div class="ps-key">${esc(key.join(' · '))}</div>` : ''}
      ${more.length ? `<details class="ps-more"><summary>${esc(alts.length ? t('details and alternatives') : t('details'))}</summary>${more.join('')}</details>` : ''}</div>${sideHtml}</li>`;
  }).join('')}</ol>${long ? `<button class="link steps-toggle" data-act="steps">${esc(stepsLabel(steps.length))}</button>` : ''}</div>`;
}

// Verdict explanations: the "≈ N" figures are highlighted so the text reads at a glance (only numbers — more would lose the accent).
const hlNums = (s) => esc(s).replace(/≈\s?[\d.,]+(?:\s?(?:div|chaos|ex|exalted))?/g, (m) => `<b>${unitIcons(m)}</b>`);

// Below this share of simulated runs that beat selling as is, a craft that wins on average is a gamble: amber, not green.
const GAMBLE_BELOW = 0.5;
// The verdict's reasons (simulation, gamble and hit notes): not under the verdict but at the top of «Why this plan» — one
// «why» per card, and it closes where it opened. Set by verdictBody, drawn into .why-notes.
let whyNotes = [];
const whyNotesHtml = () => whyNotes.map((n) => `<small>${n}</small>`).join('');

// Verdict: sell as is or craft (goal price − currency cost).
function verdictHtml(plan) {
  if (planBusy()) {
    verdictBad = false;
    whyNotes = [];
    // The line of numbers is already there as a placeholder: the card keeps its height when the verdict lands.
    return `<div class="verdict pending"><span class="spin"></span>${esc(t('Checking prices on trade… {done} of {total}', { done: planPricing.done, total: planPricing.total }))}
      <small>${esc(t('The plan appears once the goal is priced'))}</small>
      <button class="link" data-act="plandraft">${esc(t('Show the draft now'))}</button></div><div class="pl-nums"><span class="sk" data-w="150px"></span></div>`;
  }
  const draft = planPricing ? `<div class="verdict draft">${esc(t('Draft: prices still loading ({done} of {total})', { done: planPricing.done, total: planPricing.total }))}</div>` : '';
  return draft + verdictBody(plan);
}

function verdictBody(plan) {
  const { value: goalValue, basis: goalBasis, thin: goalThin } = curGoal();
  const costs = expandPlan(plan).map(stepCost);
  const known = costs.filter((c) => c.cost != null).reduce((a, c) => a + c.cost, 0);
  const lottery = costs.some((c) => c.cost == null);
  // Unknown odds and a single attempt are different gambles: a step with known odds that cannot be retried (a miss stays
  // on the item) is not «unknown».
  const unknownOdds = costs.some((c) => c.lottery);
  const gambleNote = unknownOdds ? t('A key modifier has unknown odds — this is a gamble') : t('A step is a single attempt: a miss stays on the item — this is a gamble');
  const risky = costs.some((c) => c.risky && c.chance < 1);
  const now = estNow();
  // One currency number everywhere: the simulated average when both prices are known (misses included — what the variant
  // switch and the verdict count), else the plan's sum. And one unit for all the numbers of the card.
  const sim = goalValue != null && now != null ? verdictSim(plan, goalValue, now) : null;
  const spend = sim ? sim.spent.mean : planSpend(costs);
  const u = unitFor([now, goalValue != null ? goalValue : goalThin && goalThin.value, spend]);
  const m = (x) => moneyIn(x, u);
  const mh = (x) => moneyHtml(m(x)); // the same with unit icons, for the line of numbers
  // Removing extras with Annulments will on average hit needed mods: on such an item it's almost always unprofitable.
  const hits = Math.max(0, ...costs.map((c) => c.hits || 0));
  const hitNote = hits >= 1 ? hlNums(t('Removing the junk would hit ≈{n} good modifiers on average', { n: fmt(Math.round(hits * 10) / 10) })) : '';
  // Currency costs more than the finished goal: crafting won't pay off at any item price (item price may not be computed yet).
  // known — the plan's cost: currency plus the expected loss of wanted mods a removal hits (a quarter of the goal each, the
  // essence's sacrifice). The reason names which it is: «the currency costs more» next to «cost 2» read as a lie.
  const withLosses = spend < known * 0.9;
  const costBad = goalValue != null && known >= goalValue;
  // A verdict: tone (good / lot — wins on average but loses in most runs / bad / info), a short headline, its one reason
  // under it, and the rest (simulation, gamble and hit notes) under «why». fold — the steps fold behind «Show the plan anyway».
  let v = null;
  let fold = false;
  if (costBad) {
    const partial = goalBasis === 'partial';
    v = { tone: 'bad', head: now != null ? (partial ? 'Probably not worth it — sell it as is' : 'Not worth it — sell it as is') : (partial ? 'Probably not worth it' : 'Not worth it'),
      sub: esc(t(partial
        ? (withLosses ? 'currency and likely losses cost more than the lowest goal price' : 'the currency costs more than the goal is worth at least')
        : (withLosses ? 'currency and likely losses cost more than the finished item' : 'the currency costs more than the finished item'))),
      notes: [hitNote] };
    fold = true;
  } else if (goalValue === null && now != null) {
    // No finished equivalents on trade (or only 1–2): goal price unknown. Costs already reach the item price: simpler to sell.
    const why = goalThin ? t('Only {n} listings like the goal — too few to judge the craft by', { n: goalThin.n }) : t('No finished items like the goal are listed — its price is unknown');
    if (known >= now * 0.5) {
      v = { tone: 'bad', head: 'Selling as is is better',
        sub: hlNums(withLosses ? t('Currency and likely losses ≈ {cost} · it sells for ≈ {now}', { cost: m(known), now: m(now) }) : t('Currency alone ≈ {cost} · it sells for ≈ {now}', { cost: m(spend), now: m(now) })),
        notes: [esc(why), hitNote] };
      fold = true;
    } else v = { tone: 'info', headText: why, notes: [hitNote] };
  } else if (goalValue != null && now != null) {
    // Whole-plan simulation: outcome distribution and the chance crafting beats selling now (src/shared/plancost.js).
    // The verdict and the variant switch judge by the same number — the average gain over selling as is (variantEarn): a
    // green «+0.6» next to «Selling as is is better» (more than half the runs lose) read as a contradiction.
    const gain = sim ? sim.value.mean - now - sim.spent.mean : goalValue - now - known;
    const good = sim ? gain > 0 : gain > Math.max(now * 0.15, known * 0.5);
    // Its two numbers in their own unit: a gain of 0.03 chaos reads as nothing, 1 ex against 38 ex reads at once.
    const add = sim ? Math.max(0, sim.value.mean - now) : 0;
    const pu = sim ? unitFor([add, sim.spent.mean]) : null;
    const plain = sim ? hlNums(t('On average the craft adds ≈ {add} to the price and costs ≈ {cost} in currency', { add: moneyIn(add, pu), cost: moneyIn(sim.spent.mean, pu) })) : '';
    const simNote = sim ? hlNums(t('Simulated {n} crafts: the item ends up ≈ {p50} (10–90%: {p10}–{p90}), currency ≈ {spent} on average; better than selling now in {profit}%, the full goal in {full}%',
      { n: sim.runs, p50: m(sim.value.p50), p10: m(sim.value.p10), p90: m(sim.value.p90), spent: m(sim.spent.mean), profit: Math.round(sim.profit * 100), full: Math.round(sim.full * 100) })) : '';
    const notes = [simNote, lottery ? esc(gambleNote) : '', hitNote || (risky ? esc(t('Removing a modifier can hit a good one — the cost may grow')) : '')];
    if (good && sim) {
      // Wins on average but loses in most runs: a gamble, said in amber — a green «Craft» at 11% read as «do it».
      const gamble = sim.profit < GAMBLE_BELOW;
      v = { tone: gamble ? 'lot' : 'good', head: gamble ? 'Gamble: +{gain} on average' : 'Craft: +{gain} on average', vars: { gain: m(gain) },
        sub: esc(t(gamble ? 'better than selling in only {pct}% of runs' : 'better than selling in {pct}% of runs', { pct: Math.round(sim.profit * 100) })),
        notes: [plain, ...notes] };
    } else if (good) {
      v = { tone: lottery ? 'lot' : 'good', head: 'Craft: ≈ {gain} more than selling as is', vars: { gain: m(gain) }, notes };
      fold = lottery;
    } else {
      v = { tone: 'bad', head: 'Selling as is is better', sub: plain, notes };
      fold = true;
    }
  } else if (goalValue === undefined && now != null && spend >= Math.max(1, 20 * now)) {
    // The goal is still being priced, but the currency alone dwarfs the item: say it now, not after the search.
    v = { tone: 'info', headText: t('Currency ≈ {cost} — {n}× what the item sells for now ({now})', { cost: m(spend), n: fmt(Math.round(spend / now)), now: m(now) }) };
  } else if (now == null) {
    v = { tone: 'info', headText: t(state.estThin ? 'Too few listings like this item to price it — the verdict needs its price' : 'Price this item on the Price tab first') };
  }
  verdictBad = fold;
  const notes = v ? (v.notes || []).filter(Boolean) : [];
  const verdict = v ? `<div class="verdict ${v.tone}">${vHead(v.tone, esc(v.headText || t(v.head, v.vars)))}${v.sub ? `<small>${v.sub}</small>` : ''}</div>` : '';
  // The numbers the decision rests on, under the verdict: the item now → the goal (the currency it costs). The left number
  // drops its unit when both share it («299 → 800 div»); «?» — a price not known, «…» — still being priced.
  const bare = (x) => { const s = m(x); return u && s.endsWith(` ${u}`) ? esc(s.slice(0, -u.length - 1)) : moneyHtml(s); };
  const goalText = goalValue === undefined ? '…' : goalValue == null ? (goalThin ? `${mh(goalThin.value)}?` : '?') : (goalBasis === 'partial' ? '≥ ' : '') + mh(goalValue);
  const goalTitle = goalValue != null && goalBasis !== 'exact' ? t(goalBasis === 'similar' ? 'No exact matches — priced by similar items: the added modifiers required, the rest at their tier floor' : 'No similar items either — priced by items with only the most valuable added modifier: the real goal is worth more')
    : goalThin ? `${t('Too few listings to price the goal — one or two prices can be anything')} · ${t('{n} listings', { n: goalThin.n })}` : '';
  const cost = tiny(spend) ? '< 1 ex' : `${lottery && !sim ? `${esc(t('from'))} ` : ''}${mh(spend)}`;
  const nums = `<div class="pl-nums"><span${goalTitle ? ` title="${esc(goalTitle)}"` : ''}><b>${now != null ? bare(now) : '?'} → ${goalText}</b> <span class="pl-cost${costBad ? ' bad' : ''}">(${esc(t('cost'))} ${cost})</span></span></div>`;
  whyNotes = notes;
  return verdict + nums;
}

// Price of the item with these mods added (and the plan's removals done): exact matches, then similar ones, then
// (lowerBound) the item with only the most valuable added mod. → { value, basis, thin }; null if the item changed meanwhile.
async function priceGoal(g, adds, lowerBound) {
  const mine = state;
  const f = JSON.parse(JSON.stringify(state.filters));
  const gone = new Set(g.remove.flatMap((r) => r.templates));
  for (const m of f.mods) if (m.template && gone.has(tplKey(m.template))) m.enabled = false;
  withMods(f, adds);
  const out = { value: null, basis: 'exact', thin: null };
  // Price from the search response: too few listings, remember as "thin listings" and search wider.
  const take = (q) => {
    const v = estimate(q.lots);
    if (v != null && q.total >= MIN_LOTS) return v;
    if (v != null && !out.thin) out.thin = { value: v, n: q.total };
    return null;
  };
  const it = state.item.rarity === 'Magic' ? { ...state.item, rarity: 'Rare' } : state.item;
  const q = await quickPrice(it, f);
  if (mine !== state) return null;
  out.value = take(q);
  // No exact matches: similar ones. Added mods required, remaining ones at the tier's lower bound, minor ones off.
  if (out.value == null) {
    const added = new Set(adds.flatMap((a) => (a.stats || []).map((s) => s.statId)));
    const loose = JSON.parse(JSON.stringify(f));
    for (const m of loose.mods) {
      if (added.has(m.statId) || !m.enabled) continue;
      if (!m.key && (m.importance || 0) < 2.4) m.enabled = false;
      else if (m.range) m.min = Math.ceil(m.range.lo);
    }
    const q2 = await quickPrice(it, loose);
    if (mine !== state) return null;
    out.value = take(q2);
    if (out.value != null) out.basis = 'similar';
    // Still nothing: lower bound, the item with only the most valuable added mod (the rest as for similar).
    if (out.value == null && lowerBound && adds.length > 1) {
      const top = [...adds].sort((a, b) => b.pct - a.pct)[0];
      const keep = new Set((top.stats || []).map((s) => s.statId));
      const part = JSON.parse(JSON.stringify(loose));
      for (const m of part.mods) if (added.has(m.statId) && !keep.has(m.statId)) m.enabled = false;
      const q3 = await quickPrice(it, part);
      if (mine !== state) return null;
      out.value = take(q3);
      if (out.value != null) out.basis = 'partial';
    }
  }
  return out;
}

// Goal price right when the tab opens (one trade search), then redraw the verdict; then the budget variants and their prices.
// While the goal and its variants are priced on trade the plan is not shown: the first numbers (no goal price, the
// cheapest variant) change once the prices are in, and a player could act on them. { done, total } of the searches;
// planDraft — the player asked to see the draft anyway (a long trade rate-limit wait).
let planPricing = null;
let planDraft = false;
const planBusy = () => !!planPricing && !planDraft;

async function computeGoal(g) {
  const mine = state;
  goalValue = undefined;
  goalBasis = 'exact';
  goalThin = null;
  if (variantsItem !== state) {
    // A new copy of the item during a step-by-step session keeps the session's variant and the shown plan: each hotkey
    // press used to reset them, and «Next» jumped back to the Ideal plan.
    const keepSession = craftSession && sessionMatches();
    planVariant = keepSession ? craftSession.variant : 'ideal';
    variantPicked = !!keepSession;
    planAnyway = !!keepSession;
    variantsItem = state;
    typedHead = null;
  }
  variants = null;
  try {
    const r = await priceGoal(g, g.add, true);
    if (!r) return;
    ({ value: goalValue, basis: goalBasis, thin: goalThin } = r);
  } catch (e) {
    if (mine !== state) return;
    goalValue = null;
    setStatus(errText(e), true);
  }
  // Variants are split by step costs, which depend on the goal price (the cost of hitting a needed mod).
  variants = planVariants(g);
  const rest = (variants || []).filter((v) => v.key !== 'ideal');
  if (planPricing) planPricing = { done: 1, total: 1 + rest.length };
  autoVariant();
  refreshPlan();
  for (const v of rest) {
    try {
      const r = await priceGoal(g, v.adds, false);
      if (!r || mine !== state) return;
      Object.assign(v, r);
    } catch { v.value = null; }
    if (planPricing) planPricing = { ...planPricing, done: planPricing.done + 1 };
    autoVariant();
    refreshPlan();
  }
  planPricing = null; // all priced: the plan is final
  autoVariant();
  refreshPlan();
}

// The variant shown by default: the one that earns the most over selling as is on average; while the prices are not known —
// the cheapest one, not «wipe the item and hope for the ideal».
function autoVariant() {
  if (!variants) { planVariant = 'ideal'; return; }
  if (variantPicked && curVariant()) return;
  const rows = variants.map((v) => ({ v, ...variantEarn(v) }));
  const priced = rows.filter((r) => r.gain != null);
  const pick = priced.length === rows.length
    ? [...priced].sort((a, b) => b.gain - a.gain)[0] // the simulated average already weighs a lottery by its odds
    : [...rows].sort((a, b) => a.spend - b.spend)[0];
  planVariant = pick.v.key;
}

// Redraw the plan card for the chosen variant: the variants row, the verdict and the steps.
// ---- Bases on trade: a craft that rests on luck is bought, not rolled ----
// Players rarely roll a mod that is 1 in hundreds: they buy a base that already has it (a magic or a cheap rare with the
// key line) and craft on from there. When the plan's additions are long shots, the plan says so and searches trade —
// on click only, the trade rate limit is shared — for this base type with those mods at their goal tier.
let baseSearch = null; // { key, status: 'loading' | 'done' | 'error', found, error } for the current item
function hardMods(plan) {
  const steps = expandPlan(plan);
  const costs = steps.map(stepCost);
  const out = [];
  steps.forEach((s, i) => {
    const f = stepFlag(s, costs[i], steps);
    if (!f || f.kind !== 'shot') return;
    const c0 = costs[i];
    const p = Math.min(...(c0.chances || [c0.chance]).filter((x) => x != null));
    // Only the truly rare ones: a single attempt at a 1-in-12 mana roll is a gamble, not a reason to buy a base.
    if (!(p < 1 / 40)) return;
    for (const x of s.act === 'add2' ? s.steps : s.act === 'add' ? [s] : []) {
      const c = (craftGoal.add || []).find((a) => a.text === x.mod);
      if (c && c.stats && c.stats.length && Number.isFinite(p)) out.push({ c, p, per: c0.perTry ?? c0.per ?? null, target: x.target || c.target });
    }
  });
  return out;
}
function basesHtml(plan) {
  if (planBusy() || !craftGoal) return '';
  const hard = hardMods(plan);
  if (!hard.length) return '';
  const key = hard.map((h) => h.c.text).join('|');
  const names = hard.map((h) => `«${h.c.text}»${h.target ? ` ${h.target}` : ''} — ${oneIn(h.p)}`).join(', ');
  // What rolling it yourself costs on average: attempts × the price of one (a miss that stays is not even counted).
  const roll = hard.reduce((a, h) => a + (h.per != null ? h.per / h.p : 0), 0);
  const bs = baseSearch && baseSearch.key === key ? baseSearch : null;
  let body;
  if (!bs) body = `<button class="link" data-act="bases">${esc(t('Find bases on trade'))}</button>`;
  else if (bs.status === 'loading') body = `<span class="spin"></span>${esc(t('Searching trade…'))}`;
  else if (bs.status === 'error') body = `<span class="muted">${esc(bs.error)}</span>`;
  else if (!bs.found.rows.some((r) => r.total)) body = esc(t('Nobody lists a base with {mods} — rolling is the only way', { mods: bs.found.label }));
  else {
    // A row per kind of base: how many, from what price, the link; the cheapest one against rolling it yourself.
    const cheapest = Math.min(...bs.found.rows.filter((r) => r.total && r.divs.length).map((r) => r.divs[0]));
    const rows = bs.found.rows.map((r) => `<div class="cb-row"><span>${esc(r.label)}</span><b>${r.total ? esc(t('{n} listed, from {price}', { n: r.total, price: r.divs.length ? approx(r.divs[0]) : '—' })) : `<span class="muted">${esc(t('none'))}</span>`}</b>`
      + (r.total ? `<button class="link" data-act="bases-open" data-url="${esc(r.url)}">${esc(t('Open on trade'))} ↗</button>` : '') + '</div>').join('');
    body = `<div class="cb-for">${esc(t('With {mods}:', { mods: bs.found.label }))}</div>${rows}`
      + (roll && Number.isFinite(cheapest) ? `<div class="cb-cmp">${esc(t('rolling it yourself ≈ {cost} on average', { cost: approx(roll) }))}${cheapest < roll ? ` · <b class="good">${esc(t('buying is cheaper'))}</b>` : ''}</div>` : '');
  }
  return `<div class="craft-bases"><div class="cb-head"><span class="ps-flag shot fi-only"><span class="fi">${FLAG_ICON.shot}</span></span>${esc(t('{mods} — usually bought as a base, not rolled', { mods: names }))}</div><div class="cb-body">${body}</div></div>`;
}
async function findBases() {
  if (!craftGoal || !state) return;
  const plan = curVariant() ? curVariant().plan : craftGoal.plan;
  const hard = hardMods(plan);
  if (!hard.length) return;
  const key = hard.map((h) => h.c.text).join('|');
  const mine = state;
  baseSearch = { key, status: 'loading' };
  refreshPlan();
  // What players actually buy as a base (not finished rares that happen to have the line): a magic item with the hard mods
  // and nothing else of note — on this base and on any base of the class (the implicit decides: a Solar Amulet for
  // Spirit) — and a rare with the hard mods and room left (2+ empty affixes). Only the hard mods from their goal tier, an
  // item level that allows it, not corrupted; nothing else of the item (properties, sockets, its other mods).
  const search = (list, { rarity, anyBase, room }) => {
    const f = JSON.parse(JSON.stringify(state.filters));
    for (const m of f.mods) m.enabled = false;
    for (const p of f.props || []) p.enabled = false;
    for (const x of f.exclude || []) x.enabled = false;
    // States off — except «not corrupted»: a corrupted base cannot be crafted on.
    for (const x of f.flags || []) Object.assign(x, x.key === 'corrupted' ? { enabled: true, value: false } : { enabled: false });
    for (const k of ['sockets', 'gemLevel', 'quality', 'reqLevel', 'skill']) if (f[k] && typeof f[k] === 'object') f[k].enabled = false;
    f.useType = !anyBase;
    f.flex = false;
    withMods(f, list.map((h) => h.c));
    if (room) f.mods.push({ statId: 'pseudo.pseudo_number_of_empty_affix_mods', enabled: true, min: room, importance: 3, tag: 'pseudo', text: '# Empty Modifiers' });
    const lv = Math.max(0, ...list.map((h) => (h.c.targetLevels && h.c.targetLevels.length ? Math.min(...h.c.targetLevels) : 0)));
    f.ilvl = lv ? { enabled: true, min: lv } : null;
    return quickPrice({ ...state.item, rarity }, f);
  };
  const KINDS = [
    { key: 'magic', label: t('magic, {base}', { base: state.item.baseType }), opts: { rarity: 'Magic' } },
    ...(state.filters.category ? [{ key: 'any', label: t('magic, any base of the class'), opts: { rarity: 'Magic', anyBase: true } }] : []),
    { key: 'room', label: t('rare with 2+ empty affixes, {base}', { base: state.item.baseType }), opts: { rarity: 'Rare', room: 2 } },
  ];
  try {
    // A base with all the hard mods; nobody lists one — the most valuable one alone.
    let list = hard;
    let rows = [];
    for (const k of KINDS) { const q = await search(list, k.opts); if (state !== mine) return; rows.push({ ...k, total: q.total, divs: q.divs || [], url: q.url }); }
    if (!rows.some((r) => r.total) && hard.length > 1) {
      list = [[...hard].sort((x, y) => y.c.pct - x.c.pct)[0]];
      rows = [];
      for (const k of KINDS) { const q = await search(list, k.opts); if (state !== mine) return; rows.push({ ...k, total: q.total, divs: q.divs || [], url: q.url }); }
    }
    baseSearch = { key, status: 'done', found: { rows, label: list.map((h) => `«${h.c.text}»`).join(' + ') } };
  } catch (e) {
    if (state !== mine) return;
    baseSearch = { key, status: 'error', error: errText(e) };
  }
  refreshPlan();
}

// swap — the player switched what the plan shows (a variant): the verdict and the steps fade in anew. Without it (a
// price arrived) only what changed moves: the steps reveal once the pricing spinner gives way, a new «now → goal» glows.
function refreshPlan(swap = false) {
  const g = craftGoal;
  if (!g) return;
  const plan = curVariant() ? curVariant().plan : g.plan;
  const vb = document.querySelector('#craft .variants-box');
  if (vb) vb.innerHTML = variantsHtml();
  const box = document.querySelector('#craft .verdict-box');
  const numsWas = box && box.querySelector('.pl-nums b') ? box.querySelector('.pl-nums b').textContent : null;
  if (box) box.innerHTML = verdictHtml(plan);
  const bb = document.querySelector('#craft .bases-box');
  if (bb) bb.innerHTML = basesHtml(plan);
  const wn = document.querySelector('#craft .plan-box .why-notes');
  if (wn) wn.innerHTML = whyNotesHtml();
  // Steps too: the cost of hitting a needed mod depends on the goal price.
  const ol = document.querySelector('#craft .plan-box .plan-steps');
  const wasPending = !!ol && ol.classList.contains('pending');
  if (ol) ol.outerHTML = planHtml(plan);
  const nums = box && box.querySelector('.pl-nums b');
  if (swap) { swapIn(box); swapIn(document.querySelector('#craft .plan-box .plan-steps')); }
  else {
    if (wasPending) { swapIn(box); revealSteps(); }
    if (nums && numsWas != null && nums.textContent !== numsWas) flash(nums);
  }
  typeVerdict();
  fit();
}
// The plan's visible steps, one after another (the folded tail of a long plan stays out).
const shownSteps = () => [...document.querySelectorAll('#craft .plan-box ol.plan > li')].filter((li) => li.getClientRects().length);
function revealSteps() { reveal(shownSteps(), { stagger: true }); }


const { planSpend } = planner;

// Budget variants (src/shared/plancost.js) with their prices: the full goal's, the rest searched after it.
function planVariants(g) {
  const out = planner.variants(g);
  for (const v of out || []) {
    if (v.key === 'ideal') Object.assign(v, { value: goalValue, basis: goalBasis, thin: goalThin });
    else v.value = undefined;
  }
  return out;
}

// ---- the verdict headline types itself out once it settles ----
// Only a new headline, only with the prices final (a draft redraws on every price that arrives), not after a variant click
// (switching back and forth would wait for the text each time — typeQuiet). The full line is laid out from the start, the
// untyped rest transparent, so nothing reflows; a number appears whole — «+2» on the way to «+23» would be a wrong number.
let typedHead = null; // the headline last shown — reset for a new item
let typeQuiet = false;
function typeVerdict() {
  const el = document.querySelector('#craft .verdict-box .verdict .vh');
  const quiet = typeQuiet;
  typeQuiet = false;
  if (!el || planPricing) return;
  const text = el.textContent;
  if (text === typedHead) return;
  typedHead = text;
  if (quiet || calm.matches) return;
  const chunks = text.match(/[+−≈]?\s?\d[\d.,\u00a0\u202f]*(?:\s?(?:div|chaos|ex)\b)?|[\s\S]/g) || [text];
  const dur = Math.min(420, chunks.length * 14);
  const t0 = performance.now();
  const step = (now) => {
    if (!el.isConnected) return;
    const n = Math.min(chunks.length, Math.ceil(((now - t0) / dur) * chunks.length));
    if (n >= chunks.length) { el.textContent = text; return; }
    const shown = chunks.slice(0, n).join('');
    el.innerHTML = `<span class="tw">${esc(shown)}</span><span class="tw-rest">${esc(text.slice(shown.length))}</span>`;
    requestAnimationFrame(step);
  };
  el.innerHTML = `<span class="tw"></span><span class="tw-rest">${esc(text)}</span>`;
  requestAnimationFrame(step);
}

// The verdict's 2000-run simulation, redone only when its inputs change: the verdict is redrawn on every price that
// arrives, on variant clicks and on language change — and a fresh random run would make the numbers jitter each time.
let simMemo = null;
function verdictSim(plan, goal, est) {
  const keep = craftGoal ? craftGoal.keep.length : 0;
  let key = null;
  try { key = JSON.stringify([plan, goal, est, keep]); } catch { /* not plain data — just don't memoize */ }
  if (!simMemo || key == null || simMemo.key !== key || simMemo.prices !== craftPrices) {
    simMemo = { key, prices: craftPrices, sim: planner.simulate(plan, { keep }) };
  }
  return simMemo.sim;
}

const VARIANT_NAME = { cheap: 'Cheap', balanced: 'Balanced', ideal: 'Ideal' };
// The variants row: just what the craft roughly costs and what it roughly earns over selling as is. With a step of unknown
// odds both are «if it works»: the cost is a lower bound and the gain an upper one.
// What a variant costs and earns. With both prices known the gain is the simulated average (src/shared/plancost.js simulate):
// a lottery step counts with its rough odds, so the card agrees with the verdict; without the item price — «if it works».
function variantEarn(v) {
  const now = estNow();
  const value = v.key === 'ideal' ? goalValue : v.value;
  // Each card under its own goal price: a step dearer than this variant's goal is a single attempt here, whatever the
  // chosen variant's goal says (the card and its simulation agree).
  const vp = PlanCost.create(() => ({ prices: craftPrices, goalValue: value, est: now }));
  const costs = vp.expandPlan(v.plan).map(vp.stepCost);
  const spend = vp.planSpend(costs);
  const lottery = costs.some((c) => c.cost == null);
  const unknownOdds = costs.some((c) => c.lottery); // else it is a single attempt with known odds
  if (value == null || now == null) return { value, spend, lottery, unknownOdds, gain: null };
  if (!v.sim || v.sim.value !== value || v.sim.now !== now) {
    const sim = PlanCost.create(() => ({ prices: craftPrices, goalValue: value, est: now })).simulate(v.plan, { keep: craftGoal ? craftGoal.keep.length : 0 }, 800);
    v.sim = { value, now, gain: sim ? sim.value.mean - now - sim.spent.mean : value - now - spend, expected: !!sim, profit: sim ? sim.profit : null };
  }
  return { value, spend, lottery, unknownOdds, gain: v.sim.gain, expected: v.sim.expected, profit: v.sim.profit };
}

// Under half an exalted (approx() picks the unit where the number is ≥ 1, so a number below 0.5 is in ex): shown as nothing.
const tiny = (div) => parseFloat(money(div).replace(/,/g, '')) < 0.5;

// A variant's tone, the verdict's colour as a dot by its name: good — beats selling as is in at least half the runs;
// lot — wins on average but loses in most runs; bad — loses on average. Nothing for a gain that rounds to nothing.
function earnTone({ gain, profit, lottery, expected }) {
  if (gain == null || tiny(Math.abs(gain))) return '';
  if (gain < 0) return 'bad';
  return (profit != null ? profit < GAMBLE_BELOW : lottery && !expected) ? 'lot' : 'good';
}

// The variants switch: a row of equal cells under «Plan» — the name (and its tone dot) over its one number. Its own row,
// not beside «Plan»: three variants with their sums, in Russian, did not fit there.
function variantsHtml() {
  if (!variants) return '';
  const cell = (v, body, tone = '', title = '') => `<button class="variant${v.key === planVariant ? ' on' : ''}" data-act="variant" data-v="${v.key}"${title ? ` title="${esc(title)}"` : ''}>`
    + `<span class="vn">${esc(t(VARIANT_NAME[v.key]))}${tone ? `<i class="vdot ${tone}"></i>` : ''}</span><small>${body}</small></button>`;
  // While the variants are priced: the switch is there with placeholders, so the card keeps its height when the numbers land.
  if (planBusy()) return `<div class="variants busy">${variants.map((v) => cell(v, '<span class="sk" data-w="50px"></span>')).join('')}</div>`;
  const rows = variants.map((v) => ({ v, ...variantEarn(v) }));
  // No variant has a gain (no goal or item price): each cell says what it costs — labelled, so «12 div» doesn't read as a gain.
  if (rows.every((r) => r.gain == null)) {
    const u = unitFor(rows.map((r) => r.spend));
    return `<div class="variants">${rows.map(({ v, spend, lottery }) => cell(v, tiny(spend) ? '< 1 ex'
      : `<span class="vc">${esc(t(lottery ? 'cost from' : 'cost'))}</span> ${moneyHtml(moneyIn(spend, u))}`)).join('')}</div>${getsHtml()}`;
  }
  // Every variant loses against selling as is: nothing to choose — the verdict says so, the switch would only add numbers.
  if (rows.every((r) => r.gain != null && (r.gain <= 0 || tiny(r.gain)))) return '';
  // What each earns over selling as is, in one unit; the sign carries plus or minus, the dot carries the colour (a red
  // «−1 ex» in a cell was louder than the chosen one).
  const u = unitFor(rows.map((r) => (r.gain != null ? Math.abs(r.gain) : null)));
  const cells = rows.map((r) => {
    const { v, value, lottery, unknownOdds, gain, expected } = r;
    const earn = value === undefined ? '…' : gain == null ? '—' : tiny(Math.abs(gain)) ? '≈ 0'
      : `${lottery && !expected && gain > 0 ? `${esc(t('up to'))} ` : ''}${gain > 0 ? '+' : '−'}${moneyHtml(moneyIn(Math.abs(gain), u))}`;
    return cell(v, earn, value === undefined ? '' : earnTone(r),
      lottery ? t(unknownOdds ? 'A key modifier has unknown odds — this is a gamble' : 'A step is a single attempt: a miss stays on the item — this is a gamble') : '');
  }).join('');
  return `<div class="variants">${cells}</div>${getsHtml()}`;
}

// What the chosen variant adds, then what it leaves out of the ideal, struck through — two groups: one line when they fit,
// else the struck ones wrap whole to the next line (mixed, the line between taken and left got lost at the wrap).
function getsHtml() {
  const v = curVariant();
  const ideal = variants.find((x) => x.key === 'ideal');
  const left = v && ideal && v.key !== 'ideal' ? ideal.adds.filter((a) => !v.adds.includes(a)) : [];
  if (!left.length) return '';
  return `<div class="v-gets"><span>${v.adds.map((a) => `<b>${esc(a.text)}</b>`).join('')}</span><span>${left.map((a) => `<s>${esc(a.text)}</s>`).join('')}</span></div>`;
}

// ---- step-by-step crafting: item and goal remembered; each new copy of the same item shows what happened and what's next ----
let craftSession = null; // { base, ilvl, name, rarity, goal: { add, remove }, start, before, current, seen }
// Item mods as templates (as in the craft goal: lowercase, # instead of numbers, no "+").
const modKeys = () => new Set(((state.filters && state.filters.mods) || []).filter((m) => m.template && m.tag !== 'pseudo').map((m) => tplKey(m.template)));
// Same item: base and item level; a rare's name doesn't change (magic → rare does change it).
function sessionMatches() {
  const s = craftSession, it = state && state.item;
  return !!(s && it && it.baseType === s.base && it.ilvl === s.ilvl && (it.name === s.name || s.rarity !== 'Rare' || it.rarity !== s.rarity));
}
function startSession() {
  const g = craftGoal;
  if (!g) return;
  const keys = modKeys();
  // The removals of the chosen variant, not of Ideal: a Cheap variant that keeps junk never reached «Goal reached».
  // Regal's random mod is not a row: it is not on the item yet, the row showed ✓ from the start.
  const v = curVariant();
  const vRemoves = v && v.key !== 'ideal' ? new Set(expandPlan(v.plan).flatMap((x) => (x.act === 'remove' ? (x.mods || (x.mod ? [x.mod] : [])) : []))) : null;
  const removes = g.remove.filter((r) => r.tag !== 'random' && (!vRemoves || vRemoves.has(r.text))).map((r) => ({ text: r.text }));
  craftSession = { base: state.item.baseType, ilvl: state.item.ilvl, name: state.item.name, rarity: state.item.rarity,
    goal: { add: (v ? v.adds : g.add).map((a) => ({ text: a.text, or: a.orMods || [] })), remove: removes },
    start: keys, before: keys, current: keys, seen: state, variant: v ? v.key : 'ideal' };
}
function sessionHtml(r) {
  const s = craftSession;
  const keys = modKeys();
  if (s.seen !== state) { s.before = s.current; s.current = keys; s.seen = state; } // new copy of the item: compare with the previous one
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
  // «Next» from the session's variant (the same plan the window shows), not from the full goal.
  const sv = s.variant && s.variant !== 'ideal' && variants ? variants.find((x) => x.key === s.variant) : null;
  const splan = sv ? sv.plan : r.goal && r.goal.plan;
  const next = splan && splan.length ? expandPlan(splan)[0] : null;
  return `<div class="craft-sec session"><div class="k">${esc(t('Crafting step by step'))} <button class="link" data-act="session-stop">■ ${esc(t('Stop'))}</button></div>
    <div class="ss-how">📌 ${esc(t('The window stays open while you craft. Do a step in the game, hover the item and press'))} <kbd>${esc(state.hotkey || 'Ctrl+E')}</kbd></div>
    ${news.length ? `<div class="ss-news">${esc(t('Since the last check:'))}${news.join('')}</div>` : ''}
    <div class="ss-list">${rows.join('')}</div>
    ${done ? `<div class="verdict good">${vHead('good', esc(t('Goal reached — check the price on the Price tab')))}</div>` : next ? `<div class="ss-next">${esc(t('Next: {step}', { step: STEP_LABEL[next.act](next) }))}</div>` : ''}</div>`;
}


// Odds are an estimate from trade listings (collected in another league: we say which, weights may have changed after a patch):
// briefly on a line under the odds table, full text in the tooltip.
function chanceLine(m) {
  const date = m.league && state && m.league !== state.league ? `${m.collected}, ${m.league}` : m.collected;
  if (m.source === 'exalt') return `<div class="craft-chance-note" title="${esc(t('Chances from {n} rares exalted to 6 modifiers with plain Exalted Orbs ({date}) — nobody picked them by their modifiers. PoE 2 game files have no modifier weights, so these are estimates, not exact odds.', { n: m.items, date }))}">ⓘ ${esc(t('Chances: from {n} exalted items ({date})', { n: fmt(m.items), date }))}</div>`;
  return `<div class="craft-chance-note" title="${esc(t('Chances are rough estimates from {n} cheap trade listings ({date}) — PoE 2 game files have no modifier weights. Treat them as "common / rare", not exact odds.', { n: m.items, date }))}">ⓘ ${esc(t('Chances: a rough estimate from {n} trade listings ({date})', { n: fmt(m.items), date }))}</div>`;
}

// "Lucky ilvl": above the level of the last needed tier only unwanted mods' tiers remain (craft.js ilvlHint).
function ilvlHintHtml(h) {
  if (!h) return '';
  const junk = h.junk.join(', ') + (h.more ? ` ${t('and {n} more', { n: h.more })}` : '');
  // One line up front; which unwanted modifiers gained tiers — in the tooltip with the why.
  const tip = `${t('Above it only unwanted modifiers got new tiers: {junk}', { junk })}
${t('A modifier family weighs more with each tier it has — extra tiers of unwanted modifiers slightly lower the odds of the wanted ones (community observation, not exact)')}`;
  return `<div class="craft-chance-note" title="${esc(tip)}">ⓘ ${esc(t('Item level {ilvl}: no better than {from} for the wanted modifiers', { ilvl: h.ilvl, from: h.from }))}</div>`;
}

// ---- white base: Transmutation (regular / Greater 44+ / Perfect 70+) → magic with one mod ----
// A miss needs a new base (or Orb of Annulment if the base is pricier). We recommend the option with the lower expected
// cost to reach a popular mod in one of its two best tiers.
const BASE_PRICEY = 0.5; // div: a pricier base is a product in itself, a miss hurts
function renderNormalCraft(r, head) {
  craftGoal = null;
  craftPrices = r.prices || {};
  craftThin = new Set(r.thin || []);
  const p = (n) => craftPrices[n];
  const base = estNow();
  const retry = base != null ? Math.min(base, p('Orb of Annulment') ?? base) : 0;
  // A miss on a new base is a Transmutation again; after an Annulment the item is magic with no mod — the next try is
  // the same tier's Augmentation (priced as such), not a Transmutation.
  const annulled = base != null && (p('Orb of Annulment') ?? Infinity) <= base;
  const opts = r.normal.map((o) => {
    const orb = p(o.name);
    const aug = annulled ? p(o.name.replace('Transmutation', 'Augmentation')) : null;
    const next = aug ?? orb;
    const cost = orb == null || !o.top ? null : orb + (1 / o.top - 1) * (retry + next);
    return { ...o, orb, cost };
  });
  const known = opts.filter((o) => o.cost != null);
  const best = known.length ? known.reduce((a, b) => (b.cost < a.cost ? b : a)) : opts[opts.length - 1];
  const pct = (x) => `${x >= 0.1 ? Math.round(x * 100) : Math.round(x * 1000) / 10}%`;
  // The same parts as the rare plan: the orbs as compact rows (chip, the odds that matter, the average cost; the best one
  // outlined), the steps as numbered cards with currency chips.
  const rows = opts.map((o) => `<div class="orb-opt${o === best ? ' best' : ''}" title="${esc([t('{n} possible · popular: {any}', { n: o.pool, any: pct(o.any) }), o.minLevel ? t('low tiers cut off (level {n}+; a family without such tiers rolls its best one)', { n: o.minLevel }) : ''].filter(Boolean).join('\n'))}">
    <span class="oo-cur">${curChips([o.name])}</span>
    <span class="oo-odds"><b>${pct(o.top)}</b> ${esc(t('a popular modifier in a goal tier'))}</span>
    <span class="oo-cost">${o.cost != null ? moneyHtml(`≈ ${approx(o.cost)}`) : '—'}${o === best ? `<small class="rec">${esc(t('recommended'))}</small>` : ''}</span></div>`).join('');
  const warn = base != null && base >= BASE_PRICEY
    ? `<div class="ps-flag risk"><span class="fi">${FLAG_ICON.risk}</span><span>${esc(t('The base sells for ≈ {price} — a miss costs one like it', { price: approx(base) }))}</span></div>` : '';
  const miss = base != null && base < (p('Orb of Annulment') ?? Infinity)
    ? t('A miss → take another base: it is cheaper than fixing this one')
    : t('A miss → Orb of Annulment removes the modifier, then Orb of Augmentation');
  const card = (verb, what, chips, side, key = '', more = '') => `<li${side ? ' class="has-side"' : ''}><div class="ps-main"><div class="ps-what"><span class="ps-verb">${esc(verb)}</span>${what ? `<span class="ps-mod">${esc(what)}</span>` : ''}</div>
      <div class="ps-how">${chips}</div>${key ? `<div class="ps-key">${esc(key)}</div>` : ''}${more ? `<details class="ps-more"><summary>${esc(t('details'))}</summary><div class="ps-note">${esc(more)}</div></details>` : ''}</div>
      ${side || ''}</li>`;
  const steps = [
    card(t('Make it magic'), '', curChips([best.name]), best.cost != null ? `<div class="ps-side"><b class="ps-cost">${moneyHtml(`≈ ${approx(best.cost)}`)}</b><small>${esc(t('on average'))}</small></div>` : '', miss),
    card(t('Add a modifier to the other side'), '', curChips(['Orb of Augmentation']), '', t('Greater / Perfect: the same, low tiers cut off')),
    card(t('Make it rare'), '', curChips(['Regal Orb']), '', t('or an Essence of a wanted modifier — then open Craft again for the next steps'),
      t('Or Orb of Alchemy: rare at once with 4 random modifiers (an Alchemy side omen: more prefixes or suffixes)')),
  ];
  const popular = (r.popular || []).map((c, i) => ({ name: `${c.text}${c.tier ? ` · T${c.tier}` : ''}`, pct: c.pct, rank: i + 1 }));
  $('craft').innerHTML = head + `<div class="craft-sec plan-box"><div class="k">${esc(t('White base → magic'))}</div>
    ${warn}<div class="orb-opts">${rows}</div>${ilvlHintHtml(r.ilvlHint)}
    <ol class="plan">${steps.join('')}</ol></div>
    ${popular.length ? demandList('npop', t('Popular modifiers that can roll here'), popular) : ''}
    ${r.chanceMeta ? chanceLine(r.chanceMeta) : ''}`;
}

// ---- unique: Divine rerolls the values of all mods at once (the mods themselves don't change) ----
const TOP_Q = 0.75; // "good rolls" = top quarter of the range
let uniqueTop; // price with good rolls: undefined = computing, null = not found
const rollOf = (m) => (m.ordinal ? (m.ordinal.idx - m.ordinal.lo) / (m.ordinal.hi - m.ordinal.lo) : m.roll);
const uniqueRolls = () => (state.filters.mods || []).filter((m) => (m.tag === 'explicit' || m.tag === 'desecrated')
  && (m.ordinal || (m.categorical && m.categorical.n > 1) || (m.range && m.range.hi > m.range.lo && m.roll != null)));
// Chance to land in the top quarter after Divine: for an ordinal option, the share of options above; for a number, 1/4.
const topShare = (m) => {
  if (m.categorical) return 1 / m.categorical.n; // keep the same option
  if (!m.ordinal) return 1 - TOP_Q;
  const { lo, hi } = m.ordinal;
  const from = Math.ceil(lo + TOP_Q * (hi - lo));
  return (hi - from + 1) / (hi - lo + 1);
};

// Mods the unique is bought for: per poe.ninja, ≥ 10% of builds with this unique use them (no data: all).
// Other mods' rolls barely affect the price, so "good rolls" are required only on the key ones.
function keyRolls(rolls) {
  const pct = new Map(((lastBuilds && lastBuilds.mods) || []).map((r) => [modKey(r.name), r.pct]));
  const of = (m) => Math.max(pct.get(modKey(m.template)) || 0, ...String(m.text).split('\n').map((l) => pct.get(modKey(l)) || 0));
  const key = rolls.filter((m) => m.categorical || of(m) >= 10);
  return pct.size && key.length ? key : rolls;
}

// Chance that after Divine the roll sum exceeds the current one (values independent and uniform within the range).
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
  craftThin = new Set(r.thin || []);
  const rolls = uniqueRolls();
  const top = [];
  if (!rolls.length) {
    const noRanges = state.item.mods && state.item.mods.some((m) => (m.tag === 'explicit' || m.tag === 'desecrated') && m.statId && !m.range && /\d/.test(m.text));
    top.push(`<div class="craft-sec"><div class="craft-how">${esc(noRanges
      ? t('No roll ranges in the copy — turn on "Advanced Mod Descriptions" or use Ctrl+Alt+C')
      : t('This unique has no variable values — Divine Orb changes nothing'))}</div></div>`);
  } else {
    const qs = rolls.filter((m) => !m.categorical).map(rollOf);
    const key = keyRolls(rolls);
    const cats = rolls.filter((m) => m.categorical);
    const low = key.filter((m) => m.categorical || rollOf(m) < TOP_Q).length;
    // Divine rerolls ALL values: "luck" means all key rolls in the top quarter at once, not just the low ones.
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
        ? t(key.length < rolls.length ? 'Key modifiers in the top quarter: {odds}' : 'All modifiers in the top quarter: {odds}', { odds: oddsText(tries) })
        : t('All rolls are already in the top quarter — a Divine is more likely to make it worse'))}</div>
      ${low ? `<div class="verdict-box">${uniqueVerdictHtml(tries)}</div>` : ''}</div>`);
  }
  if (r.gamble) top.push(gambleHtml(r.gamble));
  $('craft').innerHTML = head + top.join('');
  if (rolls.length && keyRolls(rolls).some((m) => !m.categorical && rollOf(m) < TOP_Q)) computeUniqueTop(keyRolls(rolls));
}

function uniqueVerdictHtml(tries) {
  const now = estNow();
  const div = craftPrices['Divine Orb'];
  const cost = div != null ? tries * div : null;
  const rows = [
    `<div><span>${esc(t('Sell as is'))}</span><b>${now != null ? approx(now) : '—'}</b></div>`,
    `<div><span>${esc(t('With top-quarter key rolls'))}</span><b>${uniqueTop === undefined ? '…' : uniqueTop == null ? t('none listed') : approx(uniqueTop)}</b></div>`,
    `<div><span>${esc(t('Divine Orbs, on average'))}</span><b>${esc(t('{n} pcs', { n: countText(tries) }))}${cost != null ? ` ≈ ${approx(cost)}` : ''}</b></div>`,
  ];
  let verdict = '';
  if (uniqueTop != null && now != null && cost != null) {
    const gain = uniqueTop - now - cost;
    const good = gain > Math.max(now * 0.15, cost * 0.5);
    verdict = `<div class="verdict ${good ? 'good' : 'bad'}">${good
      ? vHead('good', esc(t('Divine: ≈ {gain} more than selling as is', { gain: approx(gain) })))
      : vHead('bad', esc(t('Selling as is is better')))}<small>${esc(t('Each Divine can also make the rolls worse — this is the average over many tries'))}</small></div>`;
  } else if (now == null) {
    verdict = `<div class="verdict">${esc(t(state.estThin ? 'Too few listings like this item to price it — the verdict needs its price' : 'Price this item on the Price tab first'))}</div>`;
  }
  return `<div class="profit">${rows.join('')}</div>${verdict}`;
}

// Price of the same unique with rolls in the top quarter (no lower than ours): one trade search.
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

// "Risky finish": corruption and sanctification are irreversible, odds are community estimates.
// Collapsed: the last step, rarely reached. Nothing to improve (open): expanded.
// The risky finish of a clean item: Vaal Orb on top — its price, the outcomes as a bar, the enchants it can give as a table
// (each priced as a corrupted copy) — then the other irreversible options in short lines.
function gambleHtml(g, open = false) {
  const vaal = craftPrices['Vaal Orb'];
  const now = state.est != null && !state.estThin ? state.est : null;
  const enchant = g.outcomes.find((o) => o.k === 'enchant');
  const each = enchant && enchant.p != null && g.enchants.length ? enchant.p / g.enchants.length : null;
  return `<details class="craft-sec gamble"${open ? ' open' : ''}><summary class="k">⚠ ${esc(t('Risky final step: corruption and sanctification'))}</summary>
    <div class="dc-head"><span class="k">${esc(t('Corruption'))}</span><span class="oo-cur">${curChips(['Vaal Orb'])}</span>${vaal != null ? `<b>≈ ${esc(approx(vaal))}</b>` : ''}</div>
    ${oddsBar(g.outcomes)}
    <div class="dc-note">${esc(t('The item becomes unmodifiable. Omen of Corruption (always a change) is not obtainable this league.'))}</div>
    ${g.enchants.length ? enchantTable('vaal', g.enchants, { flag: 'corrupted', each, now }) : ''}
    ${g.how.length ? `<div class="dc-more">${g.how.map(howLine).join('')}${pricesLine([...(state.item.rarity === 'Rare' ? ['Omen of Sanctification'] : []), 'Omen of Putrefaction'])}</div>` : ''}</details>`;
}

// Corruption enchant tables — Vaal Orb on a clean item, Architect's Orb on a corrupted one. One row per enchant: chance per
// orb, and a trade search for a corrupted (Twice Corrupted) copy of your item with it, coloured against the price that
// pays off. Built like the craft candidates table; the outcomes as one bar, widths by their odds.
const encTables = new Map(); // id → { enchants, flag, now, even, verdict, vals: Map(index → div | null) }
const OUTCOME = {
  nothing: ['nothing changes', 'mid'], enchant: ['an enchant', 'win'], reroll: ['modifiers rerolled', 'lose'],
  values: ['values ×0.78–1.22', 'mid'], socket: ['+1 socket', 'win'], quality: ['quality up to 23%', 'win'],
  destroyed: ['the item is destroyed', 'lose'],
};
function oddsBar(outcomes) {
  const known = outcomes.every((o) => o.p != null);
  return `<div class="dc-odds" title="${esc(t('Odds are community estimates — GGG does not publish them'))}">${outcomes.map((o) => {
    const [label, cls] = OUTCOME[o.k];
    // Two lines in every part: the odds, then what happens — parts line up whatever the label's length.
    return `<span class="${cls}" data-w="${known ? o.p * 100 : 100 / outcomes.length}%"><b>${known ? `${Math.round(o.p * 100)}%` : '?'}</b>${esc(t(label))}</span>`;
  }).join('')}</div>`;
}

function enchantTable(id, enchants, { flag, each, now, even = null, verdict = false }) {
  encTables.set(id, { enchants, flag, now, even, verdict, vals: new Map() });
  const n = enchants.length;
  const priceable = enchants.filter((e) => e.stats).length;
  const chance = each == null ? '<span class="chance unknown">—</span>'
    : `<span class="chance ${each >= 0.12 ? 'common' : each >= 0.04 ? 'uncommon' : 'rare'}">${esc(t('1 in {n}', { n: String(Math.round(1 / each)) }))}</span>`;
  const what = flag === 'twice_corrupted' ? t('A Twice Corrupted copy of your item with this enchant') : t('A corrupted copy of your item with this enchant');
  const rows = enchants.map((e, i) => `<div class="brow crow dc" data-enci="${id}:${i}">
      <span class="bname">${esc(e.text)}</span><span class="cch">${chance}</span>
      <span class="cpx">${e.stats ? `<button class="link cprice" data-enc="${id}:${i}" title="${esc(what)}">${PRICE_ICON}</button>` : ''}</span></div>`).join('');
  const all = priceable > 1 ? `<button class="link cprice-all" data-encall="${id}" title="${esc(t('One trade search per enchant, then the list is sorted by price'))}">⇅ ${esc(t('Price all and sort'))}</button>` : '';
  const sub = flag === 'twice_corrupted' ? t('Second enchant — one of {n}, not of a group the item has', { n }) : t('Corruption enchant — one of {n}', { n });
  return `<div class="clist" data-encl="${id}"><div class="ctop"><span class="craft-sub">${esc(sub)}</span>${all}</div>
    <div class="crow dc chead"><span>${esc(t('Enchant'))}</span><span title="${esc(t('Chance per orb: the enchant outcome split evenly between the possible enchants (an assumption)'))}">${esc(t('chance'))}</span><span title="${esc(what)}">${esc(t('price'))}</span></div>${rows}</div>`
    + (verdict ? '<div class="dc-verdict"></div>' : '');
}

async function priceEnchant(b) {
  const [id, idx] = b.dataset.enc.split(':');
  const i = Number(idx);
  const tb = encTables.get(id);
  const e = tb && tb.enchants[i];
  if (!e || !e.stats || !state) return;
  const mine = state;
  b.disabled = true;
  b.textContent = '…';
  const f = JSON.parse(JSON.stringify(state.filters));
  for (const s of e.stats) f.mods.push({ statId: s.statId, enabled: true, min: s.min, importance: 3, tag: 'enchant', text: e.text });
  f.flags = (f.flags || []).filter((x) => x.key !== tb.flag && x.key !== 'corrupted')
    .concat({ key: 'corrupted', enabled: true, value: true }, ...(tb.flag === 'corrupted' ? [] : [{ key: tb.flag, enabled: true, value: true }]));
  try {
    const q = await quickPrice(state.item, f);
    if (state !== mine || encTables.get(id) !== tb) return;
    const raw = estimate(q.lots);
    const v = q.total >= MIN_LOTS ? raw : null;
    tb.vals.set(i, v);
    // Against what pays off: the break-even of the double corruption, or your price now (±10%).
    const cls = v == null ? '' : tb.even != null ? (v >= tb.even ? ' up' : ' down')
      : tb.now != null ? (v > tb.now * 1.1 ? ' up' : v < tb.now * 0.9 ? ' down' : '') : '';
    b.outerHTML = v == null
      ? `<span class="cpr thin" title="${esc(t('Too few listings to price it — one or two prices can be anything'))} · ${esc(t('{n} listings', { n: q.total }))}">${raw != null ? `${esc(approx(raw))}?` : esc(t('none listed'))}</span>`
      : `<span class="cpr${cls}" title="${esc(t('{n} listed with it', { n: q.total }))}">≈ ${esc(approx(v))}</span>`;
    const row = document.querySelector(`[data-enci="${id}:${i}"]`);
    if (row) row.dataset.v = v ?? '';
    if (tb.verdict) dcVerdict(id);
  } catch (err) {
    if (state !== mine) return;
    b.disabled = false;
    b.textContent = PRICE_ICON;
    setStatus(errText(err), true);
    if (isLimit(err)) return 'limit';
  }
  fit();
}

async function priceAllEnchants(btn) {
  const list = btn.closest('.clist');
  const mine = state;
  btn.disabled = true;
  btn.textContent = t('pricing…');
  for (const b of [...list.querySelectorAll('[data-enc]')]) {
    if (state !== mine || !list.isConnected) return;
    if (await priceEnchant(b) === 'limit') { btn.disabled = false; btn.textContent = `⇅ ${t('Price all and sort')}`; return; }
  }
  const rows = [...list.querySelectorAll('.crow.dc:not(.chead)')];
  const v = (r) => (r.dataset.v === '' || r.dataset.v == null ? -1 : Number(r.dataset.v));
  rows.sort((a, b) => v(b) - v(a)).forEach((r) => list.appendChild(r));
  btn.remove();
  fit();
}

document.addEventListener('click', (e) => {
  const one = e.target.closest('[data-enc]');
  if (one && !one.disabled) { priceEnchant(one); return; }
  const all = e.target.closest('[data-encall]');
  if (all && !all.disabled) priceAllEnchants(all);
});

// Corrupted once: one more corruption is possible — Architect's Orb, a coin flip between a second enchant and losing the
// item. Framed like the plan: the orb, the odds bar, a short ledger (price now, break-even), the enchants table, and once
// every enchant is priced — a verdict for one orb against selling as is.
function doubleCorruptHtml(d) {
  const now = state.est != null && !state.estThin ? state.est : null;
  const orb = craftPrices[d.orb] ?? null;
  // The item is lost half the time: a Twice Corrupted copy must cover what you give up and the orb, twice.
  const even = now != null && orb != null ? 2 * (now + orb) : null;
  return `<div class="craft-sec dcor" data-orb="${esc(String(orb ?? ''))}">
    <div class="dc-head"><span class="k">${esc(t('Double corruption'))}</span><span class="oo-cur">${curChips([d.orb])}</span>${orb != null ? `<b>≈ ${esc(approx(orb))}</b>` : ''}</div>
    ${oddsBar([{ k: 'enchant', p: 0.5 }, { k: 'destroyed', p: 0.5 }])}
    <div class="profit">
      <div><span>${esc(t('Sell as is'))}</span><b>${now != null ? esc(approx(now)) : '—'}</b></div>
      <div><span title="${esc(t('(price now + orb) × 2 — the item is lost half the time'))}">${esc(t('Twice Corrupted pays off from'))}</span><b>${even != null ? esc(approx(even)) : '—'}</b></div>
    </div>
    ${enchantTable('dc', d.enchants, { flag: 'twice_corrupted', each: 0.5 / d.enchants.length, now, even, verdict: true })}
  </div>`;
}

// Once every enchant is priced: what one orb gives on average against selling as is — half the time one of the enchants
// (evenly), half the time nothing. Enchants with no estimate count at the price now (a guess, said so).
function dcVerdict(id) {
  const tb = encTables.get(id);
  const box = document.querySelector(`[data-encl="${id}"] + .dc-verdict`);
  const orb = craftPrices["Architect's Orb"];
  if (!tb || !box || tb.now == null || orb == null) return;
  const priced = tb.enchants.map((e, i) => (e.stats ? i : null)).filter((i) => i != null);
  if (!priced.length || !priced.every((i) => tb.vals.has(i))) return;
  const vals = priced.map((i) => tb.vals.get(i) ?? tb.now);
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  const gain = 0.5 * avg - tb.now - orb;
  const good = gain > tb.now * 0.15;
  const guessed = priced.length < tb.enchants.length || priced.some((i) => tb.vals.get(i) == null);
  box.outerHTML = `<div class="verdict ${good ? 'good' : 'bad'}">${good
    ? vHead('good', esc(t('One orb: ≈ {gain} more than selling as is, on average', { gain: approx(gain) })))
    : vHead('bad', esc(t('Selling as is is better')))}<small>${esc(t('Average over many tries: half of them destroy the item'))}${guessed ? ` · ${esc(t('enchants with too few listings counted at the price now'))}` : ''}</small></div>`;
}

function renderCraft(r) {
  baseSearch = null; // another item (or its plan rebuilt): the bases found were for the previous one
  craftGoal = r.goal || null;
  craftPrices = r.prices || {};
  craftThin = new Set(r.thin || []);
  craftCands.clear();
  chanceNote = r.chanceMeta ? chanceLine(r.chanceMeta) : '';
  const head = `<div class="sect"><span>${t('Craft')}</span></div>`;
  if (r.blocked) {
    // One more corruption is possible: a quiet line instead of the dead end, the double corruption block is the content.
    $('craft').innerHTML = head + (r.doubleCorrupt
      ? `<div class="dc-locked">⛓ ${esc(t('{state} — its modifiers are locked, but one more corruption is possible', { state: t(r.blocked) }))}</div>${doubleCorruptHtml(r.doubleCorrupt)}`
      : voidState('⛓', t("{state} — can't be modified", { state: r.blocked }),
        t('Its modifiers are locked. The Price tab shows what it is worth as is.'), [['price', t('See price')]]));
    return;
  }
  if (r.note) { $('craft').innerHTML = head + voidState('◇', t('No craft tips'), esc(r.note)); return; }
  if (r.unique) { renderUniqueCraft(r, head); return; }
  if (r.normal) { renderNormalCraft(r, head); return; }
  // Method lines: currency names as chips (no bullet then); plain advice keeps its ◆.
  const how = (list) => list.map(howLine).join('');
  // On top, brief for beginners: slots on the item, "sell or craft", step-by-step plan with costs.
  // Everything else (all methods, mod options) is collapsed below.
  const top = [slotsHtml(r) + (state.item.rarity === 'Magic' ? ilvlHintHtml(r.ilvlHint) : '')];
  const inSession = craftSession && sessionMatches();
  if (inSession) top.unshift(sessionHtml(r));
  if (r.goal && r.goal.plan && r.goal.plan.length) {
    planPricing = { done: 0, total: 1 }; // computeGoal below prices the goal, then the variants
    planDraft = false;
    top.push(`<div class="craft-sec plan-box"><div class="k">${t('Plan')}${inSession ? '' : ` <button class="link session-btn" data-act="session" title="${esc(t('Do a step, check the item again with the hotkey — the window stays open and shows what you got and the next step'))}">▶ ${esc(t('Craft step by step'))}</button>`}</div><div class="variants-box">${variantsHtml()}</div><div class="verdict-box">${verdictHtml(curVariant() ? curVariant().plan : r.goal.plan)}</div><div class="bases-box">${basesHtml(curVariant() ? curVariant().plan : r.goal.plan)}</div>
      ${planHtml(curVariant() ? curVariant().plan : r.goal.plan)}<details class="why"><summary>${t('Why this plan')}</summary><div class="why-notes">${whyNotesHtml()}</div>${goalHtml(r.goal, r.theme || [], r.themeBuilds)}</details></div>`);
  } else {
    top.push(`<div class="craft-sec plan-box"><div class="verdict info">${vHead('info', esc(t('No clear upgrade for this item — selling as is is the simple choice')))}</div></div>`);
    if (r.gamble) top.push(gambleHtml(r.gamble, true)); // nothing to improve: risky finish in view
  }
  const parts = [];
  for (const s of r.sections) {
    if (s.kind === 'open') {
      parts.push(`<div class="craft-sec"><div class="k">${t(s.side === 'prefix' ? 'Prefixes' : 'Suffixes')} <span class="cfree">${esc(t('{n} free', { n: s.count }))}</span></div>${how(s.how)}
        ${s.candidates.length ? craftRows(s.candidates, t('Popular here · best tier for this item level'))
          : `<div class="craft-sub">${t('No popular modifiers left for this side.')}</div>`}</div>`);
    } else if (s.kind === 'replace') {
      const w = s.weak;
      parts.push(`<div class="craft-sec"><div class="k">${t(`Full — replace the weakest ${w.side}`)}</div>
        <div class="craft-weak">${esc(w.text)} <span class="craft-tier">${w.tier ? `T${w.tier}` : ''}${w.pct ? ` · ${t('{pct}% builds', { pct: fmt(w.pct) })}` : ''}</span></div>${how(s.how)}
        ${s.candidates.length ? craftRows(s.candidates, t('Could become:')) : ''}</div>`);
    } else if (s.kind === 'desecrate') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Desecration')}</div>${how(s.how)}${craftRows(s.candidates, t('Popular desecrated modifiers for this base:'))}</div>`);
    } else if (s.kind === 'upgrade') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Make it rare first')}</div>${how(s.how)}</div>`);
    } else if (s.kind === 'perfect' && s.blocked) {
      parts.push(`<div class="craft-sec alt"><div class="craft-sub">${esc(t('Perfect Essences and Alloys — no: the item already has a crafted modifier (one per item)'))}</div></div>`);
    } else if (s.kind === 'perfect') {
      parts.push(`<div class="craft-sec alt"><div class="k">${t('Guaranteed modifier: Perfect / corrupted Essences, Alloys')}</div><div class="craft-sub">${t('Removes a random modifier and adds its own guaranteed one:')}</div>${how(s.how)}</div>`);
    } else if (s.kind === 'tierup') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Key modifier, weak tier — keep it')}</div>${s.mods.map((m) => `
        <div class="craft-weak">${esc(m.text)} <span class="craft-tier">T${m.tier} → T${m.best}${m.range ? ` (${esc(m.range)})` : ''} · ${esc(t('{pct}% builds', { pct: fmt(m.pct) }))}</span></div>${how(m.how)}${tierUpWay(m)}`).join('')}</div>`);
    } else if (s.kind === 'overfull') {
      parts.push(`<div class="craft-sec"><div class="k">${esc(t('Over the limit'))}</div>${how(s.how)}</div>`);
    } else if (s.kind === 'emotions') {
      parts.push(emotionsHtml(s, how));
    } else if (s.kind === 'magicfill') {
      parts.push(`<div class="craft-sec"><div class="k">${t('While it is magic')}</div>${how(s.how)}${s.candidates.length ? craftRows(s.candidates, t('Popular modifiers for the free slot:')) : ''}</div>`);
    } else if (s.kind === 'risky') {
      parts.push(`<div class="craft-sec alt"><div class="k">${t('Risky')}</div>${how(s.how)}${pricesLine(s.prices || [])}</div>`);
    } else if (s.kind === 'keep') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Full — all modifiers are top tier')}</div><div class="craft-sub">${t('Nothing worth replacing.')}</div></div>`);
    } else if (s.kind === 'cheap') {
      parts.push(`<div class="craft-sec"><div class="k">${t('Cheap and safe')}</div>${how(s.how)}</div>`);
    }
  }
  if (r.augments && r.augments.length) {
    const sock = r.freeSockets ? t('{n} free augment socket(s)', { n: r.freeSockets }) : t("no free augment socket — Artificer's Orb adds one");
    parts.push(`<div class="craft-sec"><div class="k">${esc(t('Runes and soul cores for the sockets'))}</div><div class="k-sub">${esc(sock)}</div>
      ${r.augments.map((a) => `<div class="craft-how chain"><div class="ch-chips"><span class="game">${esc(a.name)}</span>${craftPrices[a.name] != null ? `<span class="ch-price">≈ ${esc(approx(craftPrices[a.name]))}</span>` : ''}</div><div class="ch-note">${esc(a.lines.join(', '))} · ${esc(t('{pct}% builds', { pct: fmt(a.pct) }))}${a.ancient ? ` · ${esc(t('Ancient Augment: one per item'))}` : ''}</div></div>`).join('')}</div>`);
  }
  if (chanceNote) parts.push(chanceNote); // there were no tables with odds, but the plan has odds: the line goes at the end
  if (r.gamble && r.goal && r.goal.plan && r.goal.plan.length) parts.push(gambleHtml(r.gamble)); // at the end, after all the safe methods
  // Sources are reference, not a decision: an icon with a tooltip.
  parts.push(`<div class="craft-foot"><b>${esc(t('Beta'))}</b> · ${esc(t('Odds are estimates — check expensive steps yourself'))}<span class="ages-i" title="${esc(t(r.chanceMeta ? 'Mod pool: game files (RePoE).' : "Mod pool: game files (RePoE). Roll chances aren't shown — PoE 2 files have no modifier weights."))} ${esc(t('Demand: builds on poe.ninja. Prices: poe.ninja and the trade site.'))}">ⓘ ${esc(t('Sources'))}</span></div>`);
  // Wide window: plan on the left, all methods on the right (expanded).
  $('craft').innerHTML = head + `<div class="craft-cols"><div class="craft-l">${top.join('')}</div>`
    + `<details class="more-ways"${wide ? ' open' : ''}><summary>${t('All methods and modifier options')}</summary>${parts.join('')}</details></div>`;
  if (r.goal && r.goal.plan && r.goal.plan.length) computeGoal(r.goal);
}
