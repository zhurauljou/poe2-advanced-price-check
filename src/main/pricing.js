// Item pricing: exchange items via poe.ninja, everything else via a trade search.
const api = require('./api');
const stats = require('./stats');
const { weight, ENABLE_FROM, KEEP_FROM, nicheOf } = require('./weights');
const { log } = require('./log');

let types = null; // Set of base types from trade — to pull the base out of a magic item's name
let uniquesByBase = new Map(); // base type → names of the uniques on it: an unidentified unique shows only its base
let currencyInfo = null; // trade currency id -> { text, image }
let currencyByText = new Map(); // «Exalted Orb», «Omen of Whittling», «Perfect Essence of Enhancement» → image URL
// Image of a currency by its trade id («exalted») or name («Exalted Orb»); null if the trade data has none.
const currencyImage = (key) => (currencyInfo && currencyInfo.has(key) ? currencyInfo.get(key).image : currencyByText.get(key) || null);

async function init() {
  const [st, items, stat] = await Promise.all([api.tradeStats(), api.tradeItems(), api.tradeStatic()]);
  stats.build(st);
  types = new Set();
  uniquesByBase = new Map();
  for (const g of items.result) {
    for (const e of g.entries) {
      if (!e.name) types.add(e.type);
      else if (!(uniquesByBase.get(e.type) || []).includes(e.name)) uniquesByBase.set(e.type, [...(uniquesByBase.get(e.type) || []), e.name]);
    }
  }
  currencyInfo = new Map();
  currencyByText = new Map();
  for (const g of stat.result) {
    for (const e of g.entries) {
      if (e.id && !currencyInfo.has(e.id)) {
        currencyInfo.set(e.id, { text: e.text, image: e.image ? `https://web.poecdn.com${e.image}` : null });
      }
      if (e.text && e.image && !currencyByText.has(e.text)) currencyByText.set(e.text, `https://web.poecdn.com${e.image}`);
    }
  }
}

// Base for trade. The name may carry extras: a magic item's affixes («Mirage's … of the Proficient»), the
// «Superior» / «Exceptional» prefixes on normal items. No such base on trade — take the longest base found in the name.
function resolveBase(item) {
  if (!types || types.has(item.baseType)) return item.baseType;
  const text = item.rarity === 'Magic' ? item.name : item.baseType;
  let best = item.baseType;
  let len = 0;
  for (const t of types) {
    if (t.length > len && text.includes(t)) { best = t; len = t.length; }
  }
  return best;
}

// An unidentified unique shows only its base. One unique on that base — it is that one (trade finds unidentified copies
// by name); several (Grand Spectrum and Voices are both Sapphires) — the player tells them by the art, the header asks.
// Unidentified copies often sell for more than identified ones, so mixing them with another unique hides the real price.
function nameUnidUnique(item) {
  if (item.rarity !== 'Unique' || !item.unidentified || item.name !== item.baseType) return;
  const names = uniquesByBase.get(resolveBase(item)) || [];
  item.name = names.length === 1 ? names[0] : '';
  if (names.length > 1) item.uniqueOptions = names;
}

// Item class → trade category: search for "any body armour" when the base doesn't matter.
const CATEGORY = {
  'One Hand Maces': 'weapon.onemace', 'Two Hand Maces': 'weapon.twomace', Quarterstaves: 'weapon.warstaff', Bows: 'weapon.bow',
  Crossbows: 'weapon.crossbow', Spears: 'weapon.spear', Flails: 'weapon.flail', Claws: 'weapon.claw', Daggers: 'weapon.dagger',
  'One Hand Swords': 'weapon.onesword', 'Two Hand Swords': 'weapon.twosword', 'One Hand Axes': 'weapon.oneaxe',
  'Two Hand Axes': 'weapon.twoaxe', Talismans: 'weapon.talisman', Wands: 'weapon.wand', Sceptres: 'weapon.sceptre',
  Staves: 'weapon.staff', Helmets: 'armour.helmet', 'Body Armours': 'armour.chest', Gloves: 'armour.gloves',
  Boots: 'armour.boots', Quivers: 'armour.quiver', Shields: 'armour.shield', Foci: 'armour.focus', Bucklers: 'armour.buckler',
  Amulets: 'accessory.amulet', Belts: 'accessory.belt', Rings: 'accessory.ring', Jewels: 'jewel', Charms: 'flask.charm',
  'Life Flasks': 'flask.life', 'Mana Flasks': 'flask.mana', Waystones: 'map.waystone', Relics: 'sanctum.relic',
};

// 80% of the value on the item. Small integers (+2 to skill levels, +1 projectile) are searched exactly,
// fractions are kept only for small fractional numbers (0.5% regen, etc.).
function minOf(v) {
  if (v == null || v <= 0) return null;
  if (Number.isInteger(v) && v <= 5) return v;
  // No lower than 5 for a bigger whole number: a +6 searched «≥ 4» took in worse items than a +5 searched «≥ 5».
  return v >= 5 ? Math.max(Number.isInteger(v) ? 5 : 0, Math.floor(v * 0.8)) : Math.floor(v * 8) / 10;
}

// Roll quality within the tier: 0 — bottom of the range, 1 — max. No range (simple copy format) — null.
function rollQuality(v, r) {
  if (!r || v == null || r.hi <= r.lo) return null;
  return Math.max(0, Math.min(1, (v - r.lo) / (r.hi - r.lo)));
}

// Minimum for a roll-quality search: not below the tier floor (else we compare with a worse tier), and the
// more important the mod, the closer to our value; a near-max roll — almost exact, that is what people pay for.
// No range — the old 80% of the value.
function minFor(v, range, importance) {
  const q = rollQuality(v, range);
  // With a range we also handle negatives («-11(-20--5)% to all Elemental Resistances»: better — closer to -5).
  if (q == null) return minOf(v);
  // Short integer range («Allocates 3(2-4) Sinister Jewel sockets», «+(1-3) Level») — every unit matters: search exactly ours.
  if (Number.isInteger(v) && Number.isInteger(range.lo) && Number.isInteger(range.hi) && range.hi - range.lo <= 3) return v;
  let share = importance >= 2.4 ? 0.75 : importance >= 1.2 ? 0.5 : 0.25;
  if (q >= 0.75) share = Math.max(share, 0.8);
  const m = range.lo + (v - range.lo) * share;
  return Number.isInteger(v) ? Math.floor(m) : Math.floor(m * 10) / 10;
}

// Mods already counted in the item's total defence/damage. The property filter exists only for armour/weapons,
// and there these mods are always local — even if trade didn't mark them «(Local)» (e.g. % ES isn't marked).
const LOCAL_COVERED = {
  // «#% increased Energy Shield», «# to maximum Energy Shield», «#% increased Armour, Evasion and Energy Shield»…
  // but not «#% increased Energy Shield Recharge Rate».
  defence: /^(#% increased|# to) (maximum )?(Armour|Evasion Rating|Evasion|Energy Shield)((,| and) (Armour|Evasion|Energy Shield))*( \(Local\))?$/,
  damage: /^(Adds # to # (Physical|Fire|Cold|Lightning|Chaos) Damage|#% increased (Physical Damage|Attack Speed))( \(Local\))?$/,
};

const PROPS = [
  { key: 'ar', label: 'Armour', covers: 'defence' },
  { key: 'ev', label: 'Evasion', covers: 'defence' },
  { key: 'es', label: 'Energy Shield', covers: 'defence' },
  { key: 'spirit', label: 'Spirit', covers: 'spirit' },
  { key: 'dps', label: 'DPS', covers: 'damage' },
  { key: 'pdps', label: 'Physical DPS', covers: 'damage' },
  { key: 'edps', label: 'Elemental DPS', covers: 'damage' },
  { key: 'crit', label: 'Critical Chance', covers: null },
  { key: 'aps', label: 'Attacks per Second', covers: null },
  // Waystone (map_filters): tier — exact, "juiciness" (rarity, pack size, waystone chance) — from −10%.
  { key: 'map_tier', label: 'Waystone Tier', covers: null, group: 'map', exact: true },
  { key: 'map_bonus', label: 'Waystone Drop Chance', covers: null, group: 'map', juice: true },
  { key: 'map_iir', label: 'Item Rarity', covers: null, group: 'map', juice: true },
  { key: 'map_packsize', label: 'Pack Size', covers: null, group: 'map', juice: true },
  { key: 'map_magic_monsters', label: 'Magic Monsters', covers: null, group: 'map' },
  { key: 'map_rare_monsters', label: 'Rare Monsters', covers: null, group: 'map' },
  { key: 'map_revives', label: 'Revives', covers: null, group: 'map' },
  { key: 'map_gold', label: 'Gold', covers: null, group: 'map' },
  { key: 'map_experience', label: 'Experience', covers: null, group: 'map' },
  // Tablet: how many uses are left — a pseudo stat on trade.
  { key: 'uses', label: 'Uses Remaining', covers: null, group: 'pseudo', statId: 'pseudo.pseudo_number_of_uses_remaining' },
];

const PROP_MIN = 0.97;
const TABLET_USES = 10; // uses on a new tablet
const PROP_LOOSE = 0.85;

// Threshold from the value: fractional ones (crit 8.00%, 1.01 attacks per second) — to hundredths, not integers.
const propMin = (v, k) => (v < 20 ? Math.floor(v * k * 100) / 100 : Math.floor(v * k));

function propFilters(item) {
  if (!['Rare', 'Magic', 'Normal', 'Unique'].includes(item.rarity)) return [];
  // On uniques defence/damage come from the mods themselves (which are in the search) — properties can be enabled manually, off by default.
  const unique = item.rarity === 'Unique';
  // A magic item is a craft base: bought for its mods and their tiers, not for DPS/defence — properties optional.
  const magic = item.rarity === 'Magic';
  // Tablet: a new one has TABLET_USES uses, almost all on trade are like that. A used one is searched among full ones (prices
  // are more reliable — few partial ones), the window scales the estimate by what's left (6 of 10 — 60%). Corruption can give more than
  // TABLET_USES: those cost more — uncorrupted is searched with exactly TABLET_USES, corrupted with a margin — no less than its own.
  if (item.itemClass === 'Tablet') {
    return PROPS.filter((p) => p.key === 'uses' && item.props.uses > 0).map((p) => {
      const extra = item.props.uses > TABLET_USES;
      return { ...p, value: item.props.uses, min: Math.max(item.props.uses, TABLET_USES), max: extra ? undefined : TABLET_USES, full: TABLET_USES, enabled: true };
    });
  }
  if (item.itemClass === 'Waystones') {
    return PROPS.filter((p) => p.group === 'map' && item.props[p.key] > 0).map((p) => ({
      ...p,
      label: (item.mapLabels && item.mapLabels[p.key]) || p.label, // as in the game tooltip — the window finds the filter by it
      value: item.props[p.key],
      min: p.exact ? item.props[p.key] : Math.floor(item.props[p.key] * 0.9),
      max: p.exact ? item.props[p.key] : undefined,
      enabled: !!(p.exact || p.juice),
    }));
  }
  return PROPS.filter((p) => !p.group && item.props[p.key] > 0).map((p) => ({
    ...p,
    value: item.props[p.key],
    // Defence/DPS is the main price factor for armour and weapons: search near-identical (−3%); with too few listings relaxing lowers it to −15%.
    min: propMin(item.props[p.key], PROP_MIN),
    // For weapons we search by total DPS, phys/elemental — optional.
    enabled: !unique && !magic && !['pdps', 'edps', 'spirit', 'crit', 'aps'].includes(p.key),
  }));
}

// Trade can sum resistances and life across all mods (pseudo) — this finds more
// similar items than searching each mod separately.
function pseudoFilters(mods) {
  const ele = { Fire: 0, Cold: 0, Lightning: 0 };
  let chaos = 0, life = 0;
  const used = { ele: [], chaos: [], life: [] };
  for (const m of mods) {
    const t = m.template && m.template.replace(/ \(Local\)$/, '');
    if (!t || m.value == null) continue;
    let r;
    if ((r = t.match(/^#% to (.+) Resistances?$/))) {
      if (/^all Elemental$/.test(r[1])) { for (const k in ele) ele[k] += m.value; used.ele.push(m); continue; }
      let hit = false;
      for (const k in ele) if (r[1].includes(k)) { ele[k] += m.value; hit = true; }
      if (r[1].includes('Chaos')) { chaos += m.value; used.chaos.push(m); }
      if (hit) used.ele.push(m);
    } else if (t === '# to maximum Life') {
      life += m.value;
      used.life.push(m);
    }
  }
  const out = [];
  // Range of the sum — sum of the parts' ranges (how many times a mod counts in the sum: «to all Elemental» — three times).
  const times = (m) => {
    const t = m.template.replace(/ \(Local\)$/, '');
    const r = t.match(/^#% to (.+) Resistances?$/);
    if (!r) return 1;
    return /^all Elemental$/.test(r[1]) ? 3 : ['Fire', 'Cold', 'Lightning'].filter((k) => r[1].includes(k)).length || 1;
  };
  const add = (id, text, value, group, perMod = () => 1) => {
    if (!group.length) return;
    // The sum is enabled if at least one of its parts would be (by importance and demand) — otherwise it's a mod nobody pays for.
    const on = group.some((m) => m.enabled);
    // Disable the sum's parts (the sum replaces them) and mark them — in the window they hide under «▸ N mods» of the sum.
    group.forEach((m) => { m.enabled = false; m.inSum = id; });
    const range = group.every((m) => m.range)
      ? group.reduce((s, m) => ({ lo: s.lo + m.range.lo * perMod(m), hi: s.hi + m.range.hi * perMod(m) }), { lo: 0, hi: 0 })
      : null;
    out.push({ statId: id, text, tag: 'pseudo', value, enabled: on, range, roll: rollQuality(value, range),
      min: minFor(value, range, 2) });
  };
  const eleSum = ele.Fire + ele.Cold + ele.Lightning;
  add('pseudo.pseudo_total_elemental_resistance', `Σ +${eleSum}% total Elemental Resistance`, eleSum, used.ele, times);
  add('pseudo.pseudo_total_chaos_resistance', `Σ +${chaos}% total Chaos Resistance`, chaos, used.chaos);
  add('pseudo.pseudo_total_life', `Σ +${life} total maximum Life`, life, used.life);
  return out;
}

// «Grants Skill: Level 16 Wolf Pack (Max Level 17)» → filter skill.wolf_pack ≥ 16.
function grantedSkill(item) {
  const p = item.properties.find((x) => x.k === 'Grants Skill');
  if (!p) return null;
  const s = stats.find(`Grants Skill: ${p.v.replace(/ \(Max Level \d+\)$/, '')}`, 'skill');
  return s ? { enabled: false, statId: s.statId, min: s.value } : null;
}

// What to show in the overlay right after copying: the parsed item and default filters.
// demand — demand for the item class from poe.ninja ({ mods: [{ name: '#% increased Spirit', pct }] }) or null.
// rollsOn(template) — whether the mod can roll on this base (true / false / null — unknown).
const UNIQUE_KEY = 40; // % of builds with the unique — its random mod is key
// Runes of Aldur (Passion / Ire / Breath / Betrayal) permanently convert a rare weapon's elemental mods to another element
// («Gain #% as Extra Cold» → «… Extra Fire», «+# to Level of all Cold Spell Skills» → «… Fire …»). Until the rune is
// socketed, the weapon's element isn't final: demand is taken for the best element, and the price is checked in the others too.
const ALDUR = { Fire: 'Passion of Aldur', Cold: 'Breath of Aldur', Lightning: 'Ire of Aldur', Chaos: 'Betrayal of Aldur' };
const ELEMENT = /\b(Fire|Cold|Lightning)\b/;
const RUNE_WEAPONS = new Set(require('../shared/item-classes').ALDUR_WEAPONS);
const convertible = (item) => item.rarity === 'Rare' && RUNE_WEAPONS.has(item.itemClass)
  && !(item.modLines || []).some((l) => /^Forged by the \w+ of Aldur$/.test(l.text));
const swapElement = (s, to) => String(s).replace(new RegExp(ELEMENT.source, 'g'), to);
let lastDemand = new Map();

// Same filters, but with elemental mods in another element — one set per rune. → [{ element, rune, filters, score }]
function elementVariants(item, filters) {
  if (!convertible(item) || !filters) return [];
  const mods = filters.mods.filter((m) => m.enabled && m.statId && m.template && m.tag !== 'pseudo' && ELEMENT.test(m.template));
  if (!mods.length) return [];
  const out = [];
  for (const to of Object.keys(ALDUR)) {
    if (mods.every((m) => m.template.match(ELEMENT)[1] === to)) continue;
    const f = JSON.parse(JSON.stringify(filters));
    let score = 0, changed = 0;
    for (const m of f.mods) {
      if (!m.enabled || !m.statId || !m.template || m.tag === 'pseudo' || !ELEMENT.test(m.template) || m.template.match(ELEMENT)[1] === to) continue;
      const text = swapElement(m.text, to);
      const s = stats.statFor(text.split('\n')[0], m.tag === 'desecrated' ? 'desecrated' : 'explicit', item.itemClass);
      if (!s) continue;
      m.statId = s.statId;
      m.text = text;
      m.template = swapElement(m.template, to);
      if (/^Adds /.test(text)) m.min = null; // «Adds # to #» has different ranges per element — any roll
      score += lastDemand.get(m.template.toLowerCase().replace(/\+#/g, '#')) || 0;
      changed++;
    }
    if (changed) out.push({ element: to, rune: ALDUR[to], filters: f, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

function prepare(item, demand, rollsOn) {
  const demandPct = new Map((demand && demand.mods || []).map((r) => [r.name.toLowerCase().replace(/\+#/g, '#'), r.pct]));
  const demandOf = (tpl) => {
    if (!tpl) return undefined;
    const k = tpl.replace(/ \(Local\)$/, '').toLowerCase();
    const one = (x) => demandPct.get(x) ?? demandPct.get(x.replace(/\+#/g, '#')); // poe.ninja templates have no «+»
    // The weapon's element is changed by a Rune of Aldur — demand for the best element.
    if (conv && ELEMENT.test(tpl)) {
      const base = tpl.replace(/ \(Local\)$/, '');
      const all = ['Fire', 'Cold', 'Lightning', 'Chaos'].map((e) => one(swapElement(base, e).toLowerCase())).filter((v) => v != null);
      return all.length ? Math.max(...all) : undefined;
    }
    return one(k);
  };
  item.baseType = resolveBase(item);
  item.mods = stats.matchMods(item);
  const conv = convertible(item);
  lastDemand = demandPct;
  // On uniques unmatched lines are flavour text, we don't show them.
  if (item.rarity === 'Unique') item.mods = item.mods.filter((m) => m.statId);
  // Tablet: the implicit «Adds Ritual Altars to a Map» isn't searchable on trade — the base sets the tablet type.
  if (item.itemClass === 'Tablet') item.mods = item.mods.filter((m) => m.statId || m.tag !== 'implicit');
  // A unique's fixed mods («Passives in Radius can be Allocated…») are on every copy — they don't affect the price.
  // They can only be told apart in the advanced format: there variable mods have a range or variants.
  let hiddenFixed = 0;
  if (item.rarity === 'Unique' && item.advanced) {
    const fixed = (m) => m.tag === 'explicit' && !m.range && !m.textRange && !(m.statId || '').includes('|');
    hiddenFixed = item.mods.filter(fixed).length;
    item.mods = item.mods.filter((m) => !fixed(m));
  }
  const ninjaRow = api.ninja.byName.get(item.name) || (item.rarity === 'Currency' && api.ninja.byName.get(item.baseType));
  // onExchange — listed on the live trade exchange (poe.ninja id matches the trade currency id): the window shows its offers.
  const exchange = ninjaRow ? { ...ninjaRow, onExchange: !!(currencyInfo && currencyInfo.has(ninjaRow.id)) } : null;

  const searchMods = item.rarity === 'Rare' || item.rarity === 'Magic';
  const props = propFilters(item);
  const covered = props.filter((p) => p.enabled).map((p) => LOCAL_COVERED[p.covers]).filter(Boolean);
  // Item niche (weights.js nicheOf): 2+ mods of one theme — they're key regardless of demand across the whole class.
  // Not on a class that is that niche itself: every sceptre is for allies and minions, its class demand already is those
  // builds' — a niche made its weak Minions' Life a key (191 listings cut to 5) while Allies' Damage stayed off.
  const niche = searchMods && !NICHE_CLASSES.has(item.itemClass) ? nicheOf(item.mods) : null;
  const mods = item.mods.map((m) => {
    const dp = demandOf(m.template);
    // Demand is loaded (top 80 mods of the class) and this mod isn't in it — almost nobody wears it: 0% for importance.
    const searchable = ['explicit', 'fractured', 'desecrated', 'crafted'].includes(m.tag);
    // Jewel mods have one tier («T1» for all) — tier doesn't make a mod more important, importance is by demand only.
    const jewel = item.itemClass === 'Jewels';
    const w = weight(item.itemClass, m.template, jewel ? null : m.tier, dp ?? (searchMods && searchable && demandPct.size >= 40 ? 0 : undefined));
    // The Potent Ferocity («Effect of Suffixes / Prefixes») and Contempt («+1 … Modifier allowed») emotions on a jewel are the main
    // price multipliers (docs/jewels-crafting.md §4): always search by them, relaxing doesn't remove them.
    if (jewel && /increased Effect of (Suffixes|Prefixes)$|(Suffix|Prefix) Modifiers? allowed$/.test(m.template || '')) { w.key = true; w.importance = Math.max(w.importance, 2.6); }
    if (niche && niche.test(m.text) && ['explicit', 'fractured', 'desecrated', 'crafted'].includes(m.tag)) { w.key = true; w.importance = Math.max(w.importance, 2.4); }
    // A unique's random mod worn by a notable share of builds using that unique is key: without it it's a different item.
    if (item.rarity === 'Unique' && m.tag === 'desecrated' && dp >= UNIQUE_KEY) { w.key = true; w.importance = Math.max(w.importance, 2.4); } // and relaxing doesn't remove it
    // A variant mod (Legacy of … on Mageblood) is exactly what people pay for on a unique — search by it right away.
    const option = !!m.statId && m.statId.includes('|');
    // «25(20-30)% reduced Slowing Potency of Debuffs on You»: trade has only «#% increased …», searched with −25, while the
    // tier range stays the magnitude (20–30). An affix's reduction is what it is worth: search «at most −22» (max), the roll
    // by the magnitude — a min from the positive range came out ≈ −3, excluding the item itself and letting in worse ones.
    const reduced = !!m.flipped && m.value != null && m.value < 0 && !!m.range && m.range.lo >= 0;
    // A unique's price comes from its rolls: a mod with a value spread («(60-80)%») — in the search right away, else search just by name.
    // A hot implicit (≥ 60% of builds: Spirit on a sceptre) — also right away, any roll: with the exact base everyone has it anyway,
    // and when relaxing drops the base and searches by category — it won't get lost.
    const hotImplicit = m.tag === 'implicit' && !!m.statId && dp >= 60 && searchMods;
    // Negative lines (whole range ≤ 0: «-11(-20--5)% to all Elemental Resistances») are a drawback, nobody pays for them.
    // Desecrated on a unique (Heart of the Well) — random mods from a pool: which ones rolled and how is the price.
    // Wanted by almost no one (< 10% of builds with this unique) — not included: listings with another equally useless mod are the same comparables.
    const unwanted = item.rarity === 'Unique' && m.tag === 'desecrated' && demandPct.size > 0 && (dp == null || dp < 10);
    const infRune = m.tag === 'rune' && /^Can roll \w+ modifiers$/.test(m.text || '');
    const uniqueRandom = item.rarity === 'Unique' && m.tag === 'desecrated' && !!m.statId && !unwanted;
    // A corruption enhancement on a unique jewel (enchant, «+5(5-10)% to Cold Resistance») rolls too and is priced the same way.
    const rolls = item.rarity === 'Unique' && (m.tag === 'explicit' || m.tag === 'desecrated' || m.tag === 'enchant') && !unwanted && !!m.statId && !option && !!m.range && m.range.hi > m.range.lo && m.range.hi > 0;
    return {
      statId: m.statId,
      text: m.text,
      tag: m.tag,
      tier: m.tier,
      merged: !!m.parts,
      parts: m.parts ? m.parts.map((t, k) => ({ text: t, tier: m.tiers[k] })) : null,
      value: m.value,
      template: m.template,
      importance: w.importance,
      demand: dp != null ? dp : null, // % of builds with this mod on items of this class
      key: w.key,
      // A Rune of Aldur (can't be removed) — compare with the same kind of items.
      // An influence rune in a socket («Can roll Destruction modifiers») is permanent; like a Rune of Aldur, compare with the same.
      enabled: !!m.forged || infRune || (option && m.tag === 'explicit') || rolls || uniqueRandom || hotImplicit || (!!m.statId && searchMods
        && ['explicit', 'fractured', 'desecrated', 'crafted'].includes(m.tag)
        && (w.importance >= ENABLE_FROM || w.key) && !covered.some((re) => re.test(m.template))),
      option,
      // max ("up to") filter: skill levels — exactly our value (+5 and +4 are different goods, especially on a magic base).
      max: reduced ? -minFor(-m.value, m.range, w.importance) : !option && m.value != null && Number.isInteger(m.value) && LEVELS.test(m.template || '') ? m.value : null,
      forged: !!m.forged || infRune,
      // A variant with a text range (ring size) — an ordinal "roll": the window accounts for it with Divine.
      ...((o) => (o ? { ordinal: o } : {}))(option ? stats.ordinal(m.statId, m.template, m.textRange) : null),
      ...(option && item.rarity === 'Unique' && !stats.ordinal(m.statId, m.template, m.textRange) ? { categorical: { n: stats.optionCount(m.statId) } } : {}),
      range: m.range || null,
      roll: reduced ? rollQuality(-m.value, m.range) : rollQuality(m.value, m.range),
      // A variant with a number («Glorifying … # souls» — timeless seed, «+# to Level of all X Skills») is searched by the number too.
      min: m.forged || infRune || reduced ? null : option ? (m.value != null && /#/.test(m.template || '') ? m.value : null) : hotImplicit ? (m.range ? Math.ceil(m.range.lo) : minOf(m.value)) : minFor(m.value, m.range, rolls ? Math.max(w.importance, 1.2) : w.importance),
    };
  });
  const pseudo = searchMods ? pseudoFilters(mods) : [];
  // Missing key mod: almost all builds wear it (≥ KEY_MISSING%), it can roll on this base, but the item doesn't have it.
  // Similar listings with it cost many times more — so by default we search for items WITHOUT it (a fair comparison).
  const key = stats.templateKey;
  const have = new Set(item.mods.map((m) => key(m.template)));
  // Not for an unidentified item: its mods are unknown, nothing is «missing» — and it is compared with unidentified ones anyway.
  const exclude = !searchMods || item.unidentified ? [] : (demand && demand.mods || [])
    .filter((r) => r.pct >= KEY_MISSING && !have.has(key(r.name)) && (!rollsOn || rollsOn(r.name) !== false))
    .map((r) => { const s = stats.statFor(r.name, 'explicit', item.itemClass); return s && { statId: s.statId, text: r.name, pct: r.pct, enabled: true }; })
    .filter(Boolean).slice(0, 2);
  const filters = {
    // Header toggles: search exactly this base (expensive bases!) / exactly this unique.
    useType: true,
    useName: item.rarity === 'Unique' && (!item.unidentified || !!item.name),
    category: CATEGORY[item.itemClass] || null,
    mods: [...pseudo, ...mods],
    hiddenFixed, // how many fixed unique mods are hidden
    props,
    // ilvl matters for craft bases (normal/magic) — enabled right away there; for the rest — optional.
    // For tablets ilvl barely affects the price — they're bought for mods and uses.
    ilvl: item.ilvl ? { enabled: (item.rarity === 'Normal' || item.rarity === 'Magic') && item.itemClass !== 'Tablet', min: item.ilvl } : null,
    reqLevel: item.reqLevel ? { enabled: false, max: item.reqLevel } : null,
    sockets: item.sockets ? { enabled: true, min: item.sockets } : null, // sockets strongly affect the price — enabled right away
    gemLevel: item.gemLevel ? { enabled: true, min: item.gemLevel } : null,
    quality: item.quality ? { enabled: false, min: item.quality } : null,
    skill: grantedSkill(item),
    // Item states are toggles in the tooltip: an enabled one requires the same state on the listing.
    // An undesecrated item can require "not desecrated" (those cost more — they can still be desecrated).
    flags: flagFilters(item),
    exclude, // "without key mod": [{ statId, text, pct, enabled }]
    online: true,
    flex: true, // «Allow 1 minor mod missing»
  };
  // Waystones are bought for tier and "juiciness" (rarity, pack size, waystone chance), not specific mods —
  // mods optional (the window flags dangerous ones in the tooltip).
  if (item.itemClass === 'Waystones') for (const m of filters.mods) m.enabled = false;
  return { item, exchange, filters, searchable: !exchange, rates: api.ninja.rates };
}

const KEY_MISSING = 80;
const NICHE_CLASSES = new Set(['Sceptres']);

const TIMELESS = /stat_3418580811\|/;

// Trade's explicit filter also matches the same mod desecrated or crafted (checked on trade: explicit ∧ desecrated finds
// exactly what desecrated alone does). The desecrated id alone finds only items whose mod came from desecration too — 3
// listings instead of 5 on a minion sceptre: a rare's desecrated or crafted mod is searched in any form. A unique keeps
// its desecrated id: there it is the random mod, a different good.
function anyForm(item, statId) {
  const m = item.rarity !== 'Unique' && /^(desecrated|crafted)\.(.+)$/.exec(statId || '');
  if (!m) return statId;
  const explicit = `explicit.${m[2]}`;
  return stats.variantsOf(statId).includes(explicit) ? explicit : statId;
}

function buildQuery(item, f) {
  const query = {
    // 'available' — «Instant Buyout and In Person», the site's default. 'online' would be only
    // «In Person (Online)» and drop all instant-buyout listings — which is most of the PoE 2 market.
    status: { option: f.online ? 'available' : 'any' },
    stats: [{ type: 'and', filters: [] }],
    filters: {},
  };
  const type = {};
  if (f.useName) {
    query.name = item.name;
    query.type = item.baseType;
  } else if (f.useType || !f.category) {
    query.type = item.baseType;
  } else {
    type.category = { option: f.category };
  }
  const rarity = { Normal: 'normal', Magic: 'magic', Rare: 'nonunique', Unique: 'unique' }[item.rarity];
  if (rarity) type.rarity = { option: rarity };
  if (f.ilvl && f.ilvl.enabled) type.ilvl = { min: Number(f.ilvl.min), ...(f.ilvl.max ? { max: Number(f.ilvl.max) } : {}) };
  if (f.quality && f.quality.enabled) type.quality = { min: Number(f.quality.min) };
  if (f.skill && f.skill.enabled) query.stats[0].filters.push({ id: f.skill.statId, value: { min: Number(f.skill.min) } });
  if (f.reqLevel && f.reqLevel.enabled) query.filters.req_filters = { filters: { lvl: { max: Number(f.reqLevel.max) } } };
  if (Object.keys(type).length) query.filters.type_filters = { filters: type };

  // Variant mods («explicit.stat_264262054|3» — Legacy of Bismuth) are searched on trade by the full id, without a value.
  // They go in a «count» group: f.optionMin of N — "any 3 of your 4 Legacies" (all N by default).
  const options = f.mods.filter((m) => m.enabled && m.option);
  if (options.length) {
    const min = Math.min(options.length, f.optionMin || options.length);
    // For a timeless jewel the seed is an exact number (min = max), for other variants — "at least".
    const val = (m) => (m.min == null ? {} : { value: TIMELESS.test(m.statId) ? { min: m.min, max: m.min } : { min: Number(m.min) } });
    query.stats.push({ type: 'count', value: { min }, filters: options.map((m) => ({ id: m.statId, ...val(m) })) });
  }
  // Minor mods (not important and not sums), when three or more — in an "any N−1 of N" group: finds items
  // missing one such mod with the rest no worse. Trade doesn't accept a weighted sum without logging in.
  const flt = (m) => {
    const v = {};
    if (m.min != null && m.min !== '') v.min = Number(m.min);
    // «+# to Level of all … Skills»: +1 changes the price many times over — search exactly our value, not "and higher".
    if (m.max != null && m.max !== '') v.max = Number(m.max);
    return { id: anyForm(item, m.statId), value: v };
  };
  const regular = f.mods.filter((m) => m.enabled && m.statId && !m.option);
  const minor = f.flex ? regular.filter(isMinor) : [];
  for (const m of regular) if (minor.length < 3 || !minor.includes(m)) query.stats[0].filters.push(flt(m));
  if (minor.length >= 3) query.stats.push({ type: 'count', value: { min: minor.length - 1 }, filters: minor.map(flt) });
  // One listing per account (trade's «Collapse listings by account»): a seller with five copies at one price would
  // otherwise fill the cheapest five alone and set the median by themselves.
  query.filters.trade_filters = { filters: { collapse: { option: 'true' } } };
  // Price currency: 'any' — any, converted (trade's default), else only listings in this currency.
  if (f.priceCurrency && f.priceCurrency !== 'any') query.filters.trade_filters.filters.price = { option: f.priceCurrency };
  const equip = {};
  const mapF = {};
  for (const p of f.props || []) {
    if (!p.enabled || p.min === '' || p.min == null) continue;
    if (p.group === 'pseudo') query.stats[0].filters.push({ id: p.statId, value: { min: Number(p.min), ...(p.max != null && p.max !== '' ? { max: Number(p.max) } : {}) } });
    else if (p.group === 'map') mapF[p.key] = p.max != null && p.max !== '' ? { min: Number(p.min), max: Number(p.max) } : { min: Number(p.min) };
    else equip[p.key] = { min: Number(p.min) };
  }
  if (Object.keys(mapF).length) query.filters.map_filters = { filters: mapF };
  if (f.sockets && f.sockets.enabled) equip.rune_sockets = { min: Number(f.sockets.min) };
  if (Object.keys(equip).length) query.filters.equipment_filters = { filters: equip };
  const misc = {};
  if (f.gemLevel && f.gemLevel.enabled) misc.gem_level = { min: Number(f.gemLevel.min) };
  for (const fl of f.flags || []) if (fl.enabled) misc[fl.key] = { option: fl.value ? 'true' : 'false' };
  if (Object.keys(misc).length) query.filters.misc_filters = { filters: misc };
  // anyKind — exclude the stat in every kind of mod (the mod's price contribution: compare with items that lack it entirely).
  const not = (f.exclude || []).filter((x) => x.enabled).flatMap((x) => (x.anyKind ? stats.variantsOf(x.statId) : [x.statId]));
  if (not.length) query.stats.push({ type: 'not', filters: [...new Set(not)].map((id) => ({ id })) });
  return { query, sort: { price: 'asc' } };
}

// Trade markup «[EnergyShield|Energy Shield]» → «Energy Shield».
const clean = (s) => String(s || '').replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1');

// A competitor's item for the hover card on a listing: header, properties and mods with stat ids
// (used to compare with our item — the same ids as in our filters).
function itemTip(it) {
  const mods = [];
  for (const [key, list] of Object.entries(it)) {
    if (!/Mods$/.test(key) || !Array.isArray(list)) continue;
    const domain = key.replace(/Mods$/, '');
    for (const m of list) {
      if (typeof m === 'string') { mods.push({ text: clean(m), domain }); continue; }
      const tier = m.mods && m.mods[0] && m.mods[0].tier;
      mods.push({
        text: clean(m.description),
        domain: m.domain || domain,
        statId: m.hash ? m.hash.replace(/^stat\./, '') : null,
        tier: tier ? +String(tier).replace(/\D/g, '') || null : null,
      });
    }
  }
  return {
    name: it.name || '',
    base: it.typeLine || it.baseType || '',
    rarity: it.rarity || '',
    ilvl: it.ilvl,
    corrupted: !!it.corrupted,
    // Sockets (rune / Soul Core) and what's in them — trade doesn't send these in properties.
    sockets: (it.sockets || []).length,
    socketed: (it.socketedItems || []).map((s) => s.typeLine || s.baseType).filter(Boolean),
    // Listing states after which the item can no longer be changed (trade fields): the window highlights them in the listing row and card.
    // Trade sets fractured / desecrated on any item with such a mod — that's common and doesn't change what can be done with it.
    states: [['corrupted', 'Corrupted'], ['sanctified', 'Sanctified'], ['duplicated', 'Mirrored']].filter(([k]) => it[k]).map(([, name]) => name)
      .concat(it.identified === false ? ['Unidentified'] : []),
    props: (it.properties || []).filter((p) => p.values && p.values[0])
      .map((p) => ({ k: clean(p.name), v: clean(p.values[0][0]) })),
    mods,
  };
}

// Item states and their trade filters (misc_filters).
function flagFilters(item) {
  const out = [];
  // name — the state itself («Corrupted»), own — whether the item has it; value — what to require when enabled
  // (toggle in the window: own → the opposite → don't care).
  const add = (key, name, own) => out.push({ key, name, own, value: own, enabled: false });
  // Uncorrupted unique — search uncorrupted: corrupted copies (often "bricked") would otherwise drag the price down.
  const pinClean = item.rarity === 'Unique' && !item.corrupted;
  if (item.rarity === 'Currency') return out;
  add('corrupted', 'Corrupted', !!item.corrupted);
  if (pinClean) out[0].enabled = true;
  // «Twice Corrupted» has its own trade filter: two corruptions — a different price than one.
  if (item.twiceCorrupted) { add('twice_corrupted', 'Twice Corrupted', true); out[out.length - 1].enabled = true; }
  if (item.sanctified) add('sanctified', 'Sanctified', true);
  if (item.mirrored) add('mirrored', 'Mirrored', true);
  if (item.fracturedItem) add('fractured_item', 'Fractured Item', true);
  if (item.desecratedItem) add('desecrated', 'Desecrated Item', true);
  // Unidentified item — among unidentified: identified ones with good mods would otherwise inflate the "pig in a poke" price.
  if (item.unidentified) { add('identified', 'Identified', false); out[out.length - 1].enabled = true; }
  return out;
}

// Minor mod: not a sum, not a variant and not important (a key mod of a good tier is kept mandatory).
const LEVELS = /^\+?# to Level of all .*Skills$/i;

function isMinor(m) {
  // The same line as auto-relax (KEEP_FROM): a mod too important ever to drop is not «minor» enough to go missing either.
  return m.tag !== 'pseudo' && !m.option && !m.key && !m.forged && (m.importance == null || m.importance < KEEP_FROM);
}

function toDivine(amount, currency) {
  if (currency === 'divine') return amount;
  const row = api.ninja.byId.get(currency);
  return row ? amount * row.divine : null;
}

// How many listings are needed to trust the price. Fewer — auto-relax drops the weakest filter.
const MIN_RESULTS = 5;
const MAX_RELAX = 3; // each step is a separate search, and trade allows few of them (≈30 per 5 minutes)

// The lower, the earlier we drop it. Important mods (key, of a good tier) are never dropped.
function strength(f) {
  if (f.kind === 'rolls') return 0.2; // first — any roll of the same tier, dropping nothing
  if (f.kind === 'cheap') return 0.3; // socket and quality are dirt cheap to add — drop them first
  if (f.kind === 'proploose') return 1.7; // defence/DPS −3% → −15%: before dropping sums and the defence itself
  if (f.kind === 'base') return 1.75; // exact base → whole category: after weak mods, before sums and defence/DPS
  if (f.kind === 'prop') return f.exact ? Infinity : 2.5; // waystone tier is never dropped — that's a different product
  if (f.kind === 'options') return 2.8;
  if (f.tag === 'pseudo') return 1.8;
  // A key mod (slot key, 60%+ demand, the item's niche) is never dropped: the craft plan treats these as holding the price.
  if (f.key) return Infinity;
  return f.importance >= KEEP_FROM ? Infinity : f.importance;
}

// «Legacy of Gold», «Legacy of Ruby» → «Legacies»: common start of the variants for the label.
function optionName(filters) {
  const t = filters.mods.filter((m) => m.enabled && m.option).map((m) => m.text);
  const first = (t[0] || '').split(' of ')[0];
  return first && t.every((x) => x.startsWith(first + ' of ')) ? `${first.replace(/y$/, 'ie')}s` : null;
}

function weakest(filters) {
  const all = [
    ...filters.mods.filter((m) => m.enabled && m.statId && !m.option),
    ...(filters.props || []).filter((p) => p.enabled).map((p) => Object.assign(p, { kind: 'prop' })),
    ...[['sockets', 'Sockets'], ['quality', 'Quality']].filter(([k]) => filters[k] && filters[k].enabled)
      .map(([k, label]) => Object.assign(filters[k], { kind: 'cheap', label })),
  ];
  // The mildest step: mod minimums down to the tier floor ("any roll of the same tier"), mods aren't dropped.
  const tight = filters.mods.filter((m) => m.enabled && m.range && m.min != null && m.min > Math.ceil(m.range.lo));
  if (tight.length && !filters.rollsLoosened) {
    const saved = tight.map((m) => m.min);
    all.push({ kind: 'rolls', set enabled(v) {
      tight.forEach((m, i) => { m.min = v ? saved[i] : Math.ceil(m.range.lo); });
      filters.rollsLoosened = !v;
    } });
  }
  // Defence/DPS: first lower the threshold to −15%, drop the filter only after that.
  const strict = (filters.props || []).filter((p) => p.enabled && !p.exact && p.min > propMin(p.value, PROP_LOOSE));
  if (strict.length && !filters.propsLoosened) {
    const saved = strict.map((p) => p.min);
    all.push({ kind: 'proploose', label: strict.map((p) => p.label).join(', '), set enabled(v) {
      strict.forEach((p, i) => { p.min = v ? saved[i] : propMin(p.value, PROP_LOOSE); });
      filters.propsLoosened = !v;
    } });
  }
  // The exact base (not a unique by name) is a filter too: rare bases may have only 1–2 on the market.
  if (filters.useType && !filters.useName && filters.category) {
    all.push({ kind: 'base', set enabled(v) { filters.useType = v; } });
  }
  // Variants (Legacy on Mageblood): don't drop a specific one, require "any one fewer" instead.
  const n = filters.mods.filter((m) => m.enabled && m.option).length;
  const cur = Math.min(n, filters.optionMin || n);
  if (n > 1 && cur > 1) {
    const what = optionName(filters);
    all.push({ kind: 'options', note: what ? { t: 'now any {k} of {n} {what}', v: { k: cur - 1, n, what } } : { t: 'now any {k} of {n} options', v: { k: cur - 1, n } },
      set enabled(v) { filters.optionMin = v ? cur : cur - 1; } });
  }
  const cands = all.filter((f) => strength(f) !== Infinity).sort((a, b) => strength(a) - strength(b));
  return cands[0] || null;
}

// relax — automatic first search: if there are few listings, drop the weakest filters one at a time.
// A manual search (the user set the checkboxes) touches nothing.
async function search(league, item, filters, relax = false) {
  const f = JSON.parse(JSON.stringify(filters));
  const L = encodeURIComponent(league);
  const dropped = [];
  let s = null;
  let last = null; // filter dropped before the current attempt
  let relaxStopped = null; // why we couldn't relax further (trade rate limit)
  for (let attempt = 0; ; attempt++) {
    try {
      s = await api.tradeRequest('search', `${api.TRADE}/api/trade2/search/poe2/${L}`, buildQuery(item, f));
    } catch (e) {
      if (!s || e.message.startsWith('⊘')) throw e;
      log('relax stopped:', e.message);
      relaxStopped = e.message;
      // Rate limit ran out mid-relax — show what we already found, with the previous filters.
      last.enabled = true;
      dropped.pop();
      break;
    }
    if (!relax || s.total >= MIN_RESULTS || attempt >= MAX_RELAX) break;
    last = weakest(f);
    if (!last) break;
    last.enabled = false;
    // Label for the "relaxed" note: a string (stat name / mod text) or { t, v } — the window translates it.
    dropped.push(last.kind === 'rolls' ? { t: 'roll minimums → tier floor' }
      : last.kind === 'proploose' ? `${last.label} −15%`
      : last.kind === 'base' ? { t: 'exact base {base}', v: { base: item.baseType } }
      : last.kind === 'options' ? last.note
      : last.kind === 'prop' || last.kind === 'cheap' ? `${last.label} ≥ ${last.min}` : last.text.split('\n')[0]);
  }
  const url = `${api.TRADE}/trade2/search/poe2/${L}/${s.id}`;
  const ids = (s.result || []).slice(0, 10);
  let listings = [];
  let listingsError = null; // search succeeded but listings didn't download (rate limit) — show how many were found, and the link
  // Second price — "any roll of the same tier": how much the market values your particular rolls. Not needed if rolls
  // were already lowered by auto-relax or there's nothing to lower. Runs alongside the listings fetch (its search uses
  // another rate bucket). An error (rate limit) — simply go without it.
  let floorP = null;
  const loose = JSON.parse(JSON.stringify(f));
  const tight = loose.mods.filter((m) => m.enabled && m.range && m.min != null && m.min > Math.ceil(m.range.lo));
  if (!f.rollsLoosened && tight.length) {
    tight.forEach((m) => { m.min = Math.ceil(m.range.lo); });
    floorP = quickPrices(L, item, loose).then((v) => ({ v }), (e) => ({ e }));
  }
  let fr = null;
  if (ids.length) {
    try {
      fr = await api.tradeRequest('fetch', `${api.TRADE}/api/trade2/fetch/${ids.join(',')}?query=${s.id}`);
    } catch (e) {
      if (e.message.startsWith('⊘')) throw e;
      log('listings fetch failed:', e.message);
      listingsError = e.message;
    }
  }
  if (fr) {
    listings = (fr.result || []).filter(Boolean).map((r) => {
      const p = r.listing.price || {};
      const cur = currencyInfo && currencyInfo.get(p.currency);
      return {
        amount: p.amount,
        currency: p.currency,
        currencyName: cur ? cur.text : p.currency,
        currencyImage: cur ? cur.image : null,
        divine: p.amount != null ? toDivine(p.amount, p.currency) : null,
        seller: r.listing.account && (r.listing.account.lastCharacterName || r.listing.account.name),
        account: r.listing.account && r.listing.account.name,
        online: !!(r.listing.account && r.listing.account.online),
        indexed: r.listing.indexed,
        whisper: r.listing.whisper,
        ilvl: r.item.ilvl,
        corrupted: !!r.item.corrupted,
        tip: itemTip(r.item),
      };
    });
  }
  let floor = null;
  const fl = floorP && await floorP;
  if (fl && fl.e) {
    if (fl.e.message.startsWith('⊘')) throw fl.e;
    log('floor price skipped:', fl.e.message);
  } else if (fl && !listingsError) {
    floor = fl.v;
  }
  // Listings in a currency with no rate (no poe.ninja prices for the league) aren't included in the estimate — the window says so.
  const unpriced = listings.filter((l) => l.amount != null && l.divine == null).length;
  return { total: s.total, url, listings, listingsError, unpriced, rates: api.ninja.rates, filters: f, dropped,
    relaxStopped, floor };
}

// Short search for the price: number of listings and prices of the 5 cheapest (in div).
async function quickPrices(L, item, f) {
  const s = await api.tradeRequest('search', `${api.TRADE}/api/trade2/search/poe2/${L}`, buildQuery(item, f));
  const ids = (s.result || []).slice(0, 5);
  let lots = [];
  let icon = null; // the first listing's art — tells unidentified uniques sharing a base apart
  if (ids.length) {
    const fr = await api.tradeRequest('fetch', `${api.TRADE}/api/trade2/fetch/${ids.join(',')}?query=${s.id}`);
    const first = (fr.result || []).find(Boolean);
    icon = (first && first.item && first.item.icon) || null;
    // With listing age — so the second price is also computed from fresh listings, like the main one.
    // ib — instant buyout (no whisper): the estimate prefers those, like the main price.
    lots = (fr.result || []).filter(Boolean).map((r) => ({ p: r.listing.price || {}, indexed: r.listing.indexed, ib: !r.listing.whisper }))
      .map(({ p, indexed, ib }) => ({ div: p.amount != null ? toDivine(p.amount, p.currency) : null, indexed, ib }))
      .filter((l) => l.div != null).sort((a, b) => a.div - b.div);
  }
  return { total: s.total, divs: lots.map((l) => l.div), lots, icon, url: `${api.TRADE}/trade2/search/poe2/${L}/${s.id}` };
}

// Price with modified filters (without a mod — "mod contribution", with a crafted mod — "price after craft").
const quick = (league, item, filters) => quickPrices(encodeURIComponent(league), item, filters);

// Link to trade showing exactly this listing: the same filters + the seller's account.
async function listingUrl(league, item, filters, account) {
  const L = encodeURIComponent(league);
  const q = buildQuery(item, filters);
  q.query.filters.trade_filters.filters.account = { input: account };
  const s = await api.tradeRequest('search', `${api.TRADE}/api/trade2/search/poe2/${L}`, q);
  return `${api.TRADE}/trade2/search/poe2/${L}/${s.id}`;
}

// Live exchange (trade2/exchange): best offers "sell want for have". The exchange has its own strict rate limit — only on
// a button in the window. → { offers: [{ pay, get, rate (have per 1 want), stock, seller, online, whisper, indexed }], total, url }.
const isExchangeable = (id) => !!(currencyInfo && currencyInfo.has(id));
async function exchangeOffers(league, want, have) {
  const L = encodeURIComponent(league);
  const r = await api.tradeRequest('exchange', `${api.TRADE}/api/trade2/exchange/poe2/${L}`,
    { query: { status: { option: 'online' }, have: [have], want: [want] }, sort: { have: 'asc' }, engine: 'new' });
  const offers = [];
  for (const x of Object.values(r.result || {})) {
    const l = x && x.listing;
    const o = l && (l.offers || [])[0];
    if (!o || !o.exchange || !o.item || !o.item.amount) continue;
    // Whisper: «{0}» — their goods, «{1}» — our payment (each has its own template with «{0}» for the quantity).
    const whisper = l.whisper ? l.whisper.replace('{0}', o.item.whisper.replace('{0}', o.item.amount))
      .replace('{1}', o.exchange.whisper.replace('{0}', o.exchange.amount)) : null;
    offers.push({ pay: o.exchange.amount, get: o.item.amount, rate: o.exchange.amount / o.item.amount, stock: o.item.stock,
      seller: l.account && (l.account.lastCharacterName || l.account.name), online: !!(l.account && l.account.online),
      whisper, indexed: l.indexed });
  }
  offers.sort((a, b) => a.rate - b.rate);
  return { offers: offers.slice(0, 6), total: r.total || offers.length, url: `${api.TRADE}/trade2/exchange/poe2/${L}/${r.id}` };
}

// The base is in the trade dictionary (dictionary not loaded — unknown, assume it is).
const knownBase = (b) => !types || !b || types.has(b);

module.exports = { init, knownBase, nameUnidUnique, prepare, search, quick, listingUrl, elementVariants, exchangeOffers, isExchangeable, currencyImage, buildQuery };
