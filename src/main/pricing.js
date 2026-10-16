// Оценка предмета: биржевые предметы — по poe.ninja, остальное — поиском на трейде.
const api = require('./api');
const stats = require('./stats');
const { weight, ENABLE_FROM, KEEP_FROM } = require('./weights');
const { log } = require('./log');

let types = null; // Set базовых типов с трейда — чтобы вытащить базу из имени магического предмета
let currencyInfo = null; // id валюты трейда -> { text, image }

async function init() {
  const [st, items, stat] = await Promise.all([api.tradeStats(), api.tradeItems(), api.tradeStatic()]);
  stats.build(st);
  types = new Set();
  for (const g of items.result) for (const e of g.entries) if (!e.name) types.add(e.type);
  currencyInfo = new Map();
  for (const g of stat.result) {
    for (const e of g.entries) {
      if (e.id && !currencyInfo.has(e.id)) {
        currencyInfo.set(e.id, { text: e.text, image: e.image ? `https://web.poecdn.com${e.image}` : null });
      }
    }
  }
}

function resolveBase(item) {
  if (item.rarity !== 'Magic' || !types) return item.baseType;
  let best = item.baseType;
  let len = 0;
  for (const t of types) {
    if (t.length > len && item.name.includes(t)) { best = t; len = t.length; }
  }
  return best;
}

// Класс предмета → категория трейда: ищем «любые нательные доспехи», когда база не важна.
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

// 80% от значения на предмете. Небольшие целые (+2 к уровню навыков, +1 снаряд) ищем точно,
// дробь оставляем только для мелких дробных чисел (0.5% регена и т.п.).
function minOf(v) {
  if (v == null || v <= 0) return null;
  if (Number.isInteger(v) && v <= 5) return v;
  return v >= 5 ? Math.floor(v * 0.8) : Math.floor(v * 8) / 10;
}

// Качество ролла внутри тира: 0 — низ диапазона, 1 — максимум. Без диапазона (простой формат копирования) — null.
function rollQuality(v, r) {
  if (!r || v == null || r.hi <= r.lo) return null;
  return Math.max(0, Math.min(1, (v - r.lo) / (r.hi - r.lo)));
}

// Минимум для поиска по качеству ролла: не ниже нижней границы тира (иначе сравниваем с тиром хуже) и тем
// ближе к нашему значению, чем важнее мод; почти максимальный ролл — почти точно, за него и платят.
// Без диапазона — прежние 80% от значения.
function minFor(v, range, importance) {
  const q = rollQuality(v, range);
  // С диапазоном считаем и отрицательные («-11(-20--5)% to all Elemental Resistances»: лучше — ближе к -5).
  if (q == null) return minOf(v);
  // Короткий целый диапазон («Allocates 3(2-4) Sinister Jewel sockets», «+(1-3) Level») — каждая единица важна: ищем ровно своё.
  if (Number.isInteger(v) && Number.isInteger(range.lo) && Number.isInteger(range.hi) && range.hi - range.lo <= 3) return v;
  let share = importance >= 2.4 ? 0.75 : importance >= 1.2 ? 0.5 : 0.25;
  if (q >= 0.75) share = Math.max(share, 0.8);
  const m = range.lo + (v - range.lo) * share;
  return Number.isInteger(v) ? Math.floor(m) : Math.floor(m * 10) / 10;
}

// Моды, которые уже учтены в итоговой защите/уроне предмета. Фильтр по свойству есть только у брони/оружия,
// а там эти моды всегда локальные — даже если трейд не пометил их «(Local)» (у % ES, например, не пометил).
const LOCAL_COVERED = {
  // «#% increased Energy Shield», «# to maximum Energy Shield», «#% increased Armour, Evasion and Energy Shield»…
  // но не «#% increased Energy Shield Recharge Rate».
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
];

const PROP_MIN = 0.97;
const PROP_LOOSE = 0.85;

// Порог от значения: дробные (крит 8.00%, 1.01 атаки в секунду) — с точностью до сотых, а не до целых.
const propMin = (v, k) => (v < 20 ? Math.floor(v * k * 100) / 100 : Math.floor(v * k));

function propFilters(item) {
  if (!['Rare', 'Magic', 'Normal', 'Unique'].includes(item.rarity)) return [];
  // У уников защиту/урон задают сами моды (и они в поиске) — свойства можно включить вручную, по умолчанию выключены.
  const unique = item.rarity === 'Unique';
  return PROPS.filter((p) => item.props[p.key] > 0).map((p) => ({
    ...p,
    value: item.props[p.key],
    // Защита/DPS — главное в цене брони и оружия: ищем почти такие же (−3%); при нехватке лотов ослабление опустит до −15%.
    min: propMin(item.props[p.key], PROP_MIN),
    // У оружия ищем по общему DPS, физ/элем — по желанию.
    enabled: !unique && !['pdps', 'edps', 'spirit', 'crit', 'aps'].includes(p.key),
  }));
}

// Сопротивления и жизнь трейд умеет суммировать со всех модов (pseudo) — так находится больше
// похожих предметов, чем при поиске каждого мода по отдельности.
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
  // Диапазон суммы — сумма диапазонов частей (сколько раз мод входит в сумму: «ко всем элементальным» — трижды).
  const times = (m) => {
    const t = m.template.replace(/ \(Local\)$/, '');
    const r = t.match(/^#% to (.+) Resistances?$/);
    if (!r) return 1;
    return /^all Elemental$/.test(r[1]) ? 3 : ['Fire', 'Cold', 'Lightning'].filter((k) => r[1].includes(k)).length || 1;
  };
  const add = (id, text, value, group, perMod = () => 1) => {
    if (!group.length) return;
    // Части суммы выключаем (их заменяет сумма) и помечаем — в окне они прячутся под «▸ N mods» у суммы.
    group.forEach((m) => { m.enabled = false; m.inSum = id; });
    const range = group.every((m) => m.range)
      ? group.reduce((s, m) => ({ lo: s.lo + m.range.lo * perMod(m), hi: s.hi + m.range.hi * perMod(m) }), { lo: 0, hi: 0 })
      : null;
    out.push({ statId: id, text, tag: 'pseudo', value, enabled: true, range, roll: rollQuality(value, range),
      min: minFor(value, range, 2) });
  };
  const eleSum = ele.Fire + ele.Cold + ele.Lightning;
  add('pseudo.pseudo_total_elemental_resistance', `Σ +${eleSum}% total Elemental Resistance`, eleSum, used.ele, times);
  add('pseudo.pseudo_total_chaos_resistance', `Σ +${chaos}% total Chaos Resistance`, chaos, used.chaos);
  add('pseudo.pseudo_total_life', `Σ +${life} total maximum Life`, life, used.life);
  return out;
}

// «Grants Skill: Level 16 Wolf Pack (Max Level 17)» → фильтр skill.wolf_pack ≥ 16.
function grantedSkill(item) {
  const p = item.properties.find((x) => x.k === 'Grants Skill');
  if (!p) return null;
  const s = stats.find(`Grants Skill: ${p.v.replace(/ \(Max Level \d+\)$/, '')}`, 'skill');
  return s ? { enabled: false, statId: s.statId, min: s.value } : null;
}

// Что показать в оверлее сразу после копирования: разобранный предмет и фильтры по умолчанию.
// demand — спрос по классу вещей с poe.ninja ({ mods: [{ name: '#% increased Spirit', pct }] }) или null.
function prepare(item, demand) {
  const demandPct = new Map((demand && demand.mods || []).map((r) => [r.name.toLowerCase(), r.pct]));
  const demandOf = (tpl) => (tpl ? demandPct.get(tpl.replace(/ \(Local\)$/, '').toLowerCase()) : undefined);
  item.baseType = resolveBase(item);
  item.mods = stats.matchMods(item);
  // У уников несопоставленные строки — это флейвор-текст, его не показываем.
  if (item.rarity === 'Unique') item.mods = item.mods.filter((m) => m.statId);
  const ninjaRow = api.ninja.byName.get(item.name) || (item.rarity === 'Currency' && api.ninja.byName.get(item.baseType));
  const exchange = ninjaRow ? { ...ninjaRow } : null;

  const searchMods = item.rarity === 'Rare' || item.rarity === 'Magic';
  const props = propFilters(item);
  const covered = props.filter((p) => p.enabled).map((p) => LOCAL_COVERED[p.covers]).filter(Boolean);
  const mods = item.mods.map((m) => {
    const dp = demandOf(m.template);
    const w = weight(item.itemClass, m.template, m.tier, dp);
    // Мод-вариант (Legacy of … у Mageblood) у уника и есть то, за что платят, — ищем по нему сразу.
    const option = !!m.statId && m.statId.includes('|');
    // У уника цену делают роллы: мод с разбросом значений («(60-80)%») — сразу в поиске, иначе ищем просто по названию.
    // Горячий implicit (≥ 60% билдов: Spirit на скипетре) — тоже сразу, с любым роллом: при точной базе он и так есть у всех,
    // а когда ослабление снимет базу и ищет по категории — не потеряется.
    const hotImplicit = m.tag === 'implicit' && !!m.statId && dp >= 60 && searchMods;
    // Минусовые строки (весь диапазон ≤ 0: «-11(-20--5)% to all Elemental Resistances») — недостаток, за него не платят.
    const rolls = item.rarity === 'Unique' && m.tag === 'explicit' && !!m.statId && !option && !!m.range && m.range.hi > m.range.lo && m.range.hi > 0;
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
      demand: dp != null ? dp : null, // % билдов с этим модом на вещах этого класса
      key: w.key,
      enabled: (option && m.tag === 'explicit') || rolls || hotImplicit || (!!m.statId && searchMods
        && ['explicit', 'fractured', 'desecrated', 'crafted'].includes(m.tag)
        && w.importance >= ENABLE_FROM && !covered.some((re) => re.test(m.template))),
      option,
      range: m.range || null,
      roll: rollQuality(m.value, m.range),
      // Вариант с числом («Glorifying … # souls» — сид timeless, «+# to Level of all X Skills») ищем и по числу.
      min: option ? (m.value != null && /#/.test(m.template || '') ? m.value : null) : hotImplicit ? (m.range ? Math.ceil(m.range.lo) : minOf(m.value)) : minFor(m.value, m.range, rolls ? Math.max(w.importance, 1.2) : w.importance),
    };
  });
  const pseudo = searchMods ? pseudoFilters(mods) : [];
  const filters = {
    // Переключатели в шапке: искать именно эту базу (дорогие базы!) / именно этот уник.
    useType: true,
    useName: item.rarity === 'Unique' && !item.unidentified,
    category: CATEGORY[item.itemClass] || null,
    mods: [...pseudo, ...mods],
    props,
    // ilvl важен для баз под крафт (обычные/магические) — там включён сразу; у остальных — по желанию.
    ilvl: item.ilvl ? { enabled: item.rarity === 'Normal' || item.rarity === 'Magic', min: item.ilvl } : null,
    reqLevel: item.reqLevel ? { enabled: false, max: item.reqLevel } : null,
    sockets: item.sockets ? { enabled: true, min: item.sockets } : null, // гнёзда сильно влияют на цену — сразу
    gemLevel: item.gemLevel ? { enabled: true, min: item.gemLevel } : null,
    quality: item.quality ? { enabled: false, min: item.quality } : null,
    skill: grantedSkill(item),
    // Состояния предмета — переключатели в подсказке: включённое требует то же состояние у лота.
    // У неосквернённой вещи можно потребовать «не осквернён» (такие дороже — их ещё можно осквернить).
    flags: flagFilters(item),
    online: true,
    flex: true, // «Allow 1 minor mod missing»
  };
  return { item, exchange, filters, searchable: !exchange, rates: api.ninja.rates };
}

const TIMELESS = /stat_3418580811\|/;

function buildQuery(item, f) {
  const query = {
    // 'available' — «Instant Buyout and In Person», как по умолчанию на сайте. 'online' был бы только
    // «In Person (Online)» и отбрасывал все лоты с мгновенным выкупом — а это большая часть рынка PoE 2.
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
  if (f.ilvl && f.ilvl.enabled) type.ilvl = { min: Number(f.ilvl.min) };
  if (f.quality && f.quality.enabled) type.quality = { min: Number(f.quality.min) };
  if (f.skill && f.skill.enabled) query.stats[0].filters.push({ id: f.skill.statId, value: { min: Number(f.skill.min) } });
  if (f.reqLevel && f.reqLevel.enabled) query.filters.req_filters = { filters: { lvl: { max: Number(f.reqLevel.max) } } };
  if (Object.keys(type).length) query.filters.type_filters = { filters: type };

  // Моды-варианты («explicit.stat_264262054|3» — Legacy of Bismuth) трейд ищет по id целиком, без значения.
  // Их — группой «count»: f.optionMin из N — «любые 3 из ваших 4 Legacy» (по умолчанию все N).
  const options = f.mods.filter((m) => m.enabled && m.option);
  if (options.length) {
    const min = Math.min(options.length, f.optionMin || options.length);
    // У timeless-самоцвета сид — точное число (min = max), у остальных вариантов — «не меньше».
    const val = (m) => (m.min == null ? {} : { value: TIMELESS.test(m.statId) ? { min: m.min, max: m.min } : { min: Number(m.min) } });
    query.stats.push({ type: 'count', value: { min }, filters: options.map((m) => ({ id: m.statId, ...val(m) })) });
  }
  // Второстепенные моды (не важные и не суммы) при трёх и больше — группой «любые N−1 из N»: находятся вещи,
  // где одного такого мода нет, а остальные не хуже. Взвешенную сумму трейд без входа в аккаунт не принимает.
  const flt = (m) => {
    const v = {};
    if (m.min != null && m.min !== '') v.min = Number(m.min);
    return { id: m.statId, value: v };
  };
  const regular = f.mods.filter((m) => m.enabled && m.statId && !m.option);
  const minor = f.flex ? regular.filter(isMinor) : [];
  for (const m of regular) if (minor.length < 3 || !minor.includes(m)) query.stats[0].filters.push(flt(m));
  if (minor.length >= 3) query.stats.push({ type: 'count', value: { min: minor.length - 1 }, filters: minor.map(flt) });
  // Валюта цены: 'any' — любая в пересчёте (по умолчанию у трейда), иначе только лоты в этой валюте.
  if (f.priceCurrency && f.priceCurrency !== 'any') {
    query.filters.trade_filters = { filters: { price: { option: f.priceCurrency } } };
  }
  const equip = {};
  for (const p of f.props || []) if (p.enabled && p.min !== '' && p.min != null) equip[p.key] = { min: Number(p.min) };
  if (f.sockets && f.sockets.enabled) equip.rune_sockets = { min: Number(f.sockets.min) };
  if (Object.keys(equip).length) query.filters.equipment_filters = { filters: equip };
  const misc = {};
  if (f.gemLevel && f.gemLevel.enabled) misc.gem_level = { min: Number(f.gemLevel.min) };
  for (const fl of f.flags || []) if (fl.enabled) misc[fl.key] = { option: fl.value ? 'true' : 'false' };
  if (Object.keys(misc).length) query.filters.misc_filters = { filters: misc };
  return { query, sort: { price: 'asc' } };
}

// Разметка трейда «[EnergyShield|Energy Shield]» → «Energy Shield».
const clean = (s) => String(s || '').replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1');

// Вещь конкурента для карточки при наведении на лот: шапка, свойства и моды с id статов
// (по ним сравниваем с нашей вещью — те же id, что в наших фильтрах).
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
    props: (it.properties || []).filter((p) => p.values && p.values[0])
      .map((p) => ({ k: clean(p.name), v: clean(p.values[0][0]) })),
    mods,
  };
}

// Состояния предмета и их фильтры трейда (misc_filters).
function flagFilters(item) {
  const out = [];
  const add = (key, label, value, cls) => out.push({ key, label, value, cls, enabled: false });
  // Непорченый уник — ищем непорченые: испорченные копии (часто «кирпичи») иначе занижают цену.
  const pinClean = item.rarity === 'Unique' && !item.corrupted;
  if (item.rarity === 'Currency') return out;
  if (item.corrupted) add('corrupted', 'Corrupted', true, 'corrupt');
  else { add('corrupted', 'Not corrupted', false, 'cls'); if (pinClean) out[out.length - 1].enabled = true; }
  if (item.sanctified) add('sanctified', 'Sanctified', true, 'cls');
  if (item.mirrored) add('mirrored', 'Mirrored', true, 'cls');
  if (item.fracturedItem) add('fractured_item', 'Fractured Item', true, 'cls');
  if (item.desecratedItem) add('desecrated', 'Desecrated Item', true, 'cls');
  return out;
}

// Второстепенный мод: не сумма, не вариант и не важный (ключевой хорошего тира держим обязательным).
function isMinor(m) {
  return m.tag !== 'pseudo' && !m.option && (m.importance == null || m.importance < 2.4);
}

function toDivine(amount, currency) {
  if (currency === 'divine') return amount;
  const row = api.ninja.byId.get(currency);
  return row ? amount * row.divine : null;
}

// Сколько лотов нужно, чтобы цене можно было верить. Меньше — автоослабление снимает самый слабый фильтр.
const MIN_RESULTS = 5;
const MAX_RELAX = 3; // каждый шаг — отдельный поиск, а их у трейда мало (≈30 за 5 минут)

// Чем меньше — тем раньше снимаем. Важные моды (ключевые хорошего тира) не снимаем вовсе.
function strength(f) {
  if (f.kind === 'rolls') return 0.2; // сначала — любой ролл того же тира, ничего не снимая
  if (f.kind === 'cheap') return 0.3; // гнездо и качество докупаются за копейки — снимаем первыми
  if (f.kind === 'proploose') return 1.7; // защита/DPS −3% → −15%: раньше, чем снимать суммы и саму защиту
  if (f.kind === 'base') return 1.75; // точная база → вся категория: после слабых модов, до сумм и защиты/DPS
  if (f.kind === 'prop') return 2.5;
  if (f.kind === 'options') return 2.8;
  if (f.tag === 'pseudo') return 1.8;
  return f.importance >= KEEP_FROM ? Infinity : f.importance;
}

// «Legacy of Gold», «Legacy of Ruby» → «Legacies»: общее начало вариантов для подписи.
function optionName(filters) {
  const t = filters.mods.filter((m) => m.enabled && m.option).map((m) => m.text);
  const first = (t[0] || '').split(' of ')[0];
  return first && t.every((x) => x.startsWith(first + ' of ')) ? `${first.replace(/y$/, 'ie')}s` : 'options';
}

function weakest(filters) {
  const all = [
    ...filters.mods.filter((m) => m.enabled && m.statId && !m.option),
    ...(filters.props || []).filter((p) => p.enabled).map((p) => Object.assign(p, { kind: 'prop' })),
    ...[['sockets', 'Sockets'], ['quality', 'Quality']].filter(([k]) => filters[k] && filters[k].enabled)
      .map(([k, label]) => Object.assign(filters[k], { kind: 'cheap', label })),
  ];
  // Самый мягкий шаг: минимумы модов — до нижней границы тира («любой ролл того же тира»), моды не снимаем.
  const tight = filters.mods.filter((m) => m.enabled && m.range && m.min != null && m.min > Math.ceil(m.range.lo));
  if (tight.length && !filters.rollsLoosened) {
    const saved = tight.map((m) => m.min);
    all.push({ kind: 'rolls', set enabled(v) {
      tight.forEach((m, i) => { m.min = v ? saved[i] : Math.ceil(m.range.lo); });
      filters.rollsLoosened = !v;
    } });
  }
  // Защита/DPS: сперва опускаем порог до −15%, снимать фильтр — только потом.
  const strict = (filters.props || []).filter((p) => p.enabled && p.min > propMin(p.value, PROP_LOOSE));
  if (strict.length && !filters.propsLoosened) {
    const saved = strict.map((p) => p.min);
    all.push({ kind: 'proploose', label: strict.map((p) => p.label).join(', '), set enabled(v) {
      strict.forEach((p, i) => { p.min = v ? saved[i] : propMin(p.value, PROP_LOOSE); });
      filters.propsLoosened = !v;
    } });
  }
  // Точная база (не уник по имени) — тоже фильтр: редких баз на рынке бывает 1–2 штуки.
  if (filters.useType && !filters.useName && filters.category) {
    all.push({ kind: 'base', set enabled(v) { filters.useType = v; } });
  }
  // Варианты (Legacy у Mageblood): не снимаем конкретный, а требуем «любые на один меньше».
  const n = filters.mods.filter((m) => m.enabled && m.option).length;
  const cur = Math.min(n, filters.optionMin || n);
  if (n > 1 && cur > 1) {
    all.push({ kind: 'options', label: `any ${cur - 1} of ${n} ${optionName(filters)}`,
      set enabled(v) { filters.optionMin = v ? cur : cur - 1; } });
  }
  const cands = all.filter((f) => strength(f) !== Infinity).sort((a, b) => strength(a) - strength(b));
  return cands[0] || null;
}

// relax — автоматический первый поиск: если лотов мало, по одному снимаем самые слабые фильтры.
// Ручной поиск (пользователь сам настроил галочки) ничего не трогает.
async function search(league, item, filters, relax = false) {
  const f = JSON.parse(JSON.stringify(filters));
  const L = encodeURIComponent(league);
  const dropped = [];
  let s = null;
  let last = null; // фильтр, снятый перед текущей попыткой
  let relaxStopped = null; // почему не смогли ослабить дальше (лимит трейда)
  for (let attempt = 0; ; attempt++) {
    try {
      s = await api.tradeRequest('search', `${api.TRADE}/api/trade2/search/poe2/${L}`, buildQuery(item, f));
    } catch (e) {
      if (!s) throw e;
      log('relax stopped:', e.message);
      relaxStopped = e.message;
      // Лимит кончился посреди ослабления — показываем то, что уже нашли, со старыми фильтрами.
      last.enabled = true;
      dropped.pop();
      break;
    }
    if (!relax || s.total >= MIN_RESULTS || attempt >= MAX_RELAX) break;
    last = weakest(f);
    if (!last) break;
    last.enabled = false;
    dropped.push(last.kind === 'rolls' ? 'roll minimums → tier floor'
      : last.kind === 'proploose' ? `${last.label} −15%`
      : last.kind === 'base' ? `exact base ${item.baseType}`
      : last.kind === 'options' ? `now ${last.label}`
      : last.kind === 'prop' || last.kind === 'cheap' ? `${last.label} ≥ ${last.min}` : last.text.split('\n')[0]);
  }
  const url = `${api.TRADE}/trade2/search/poe2/${L}/${s.id}`;
  const ids = (s.result || []).slice(0, 10);
  let listings = [];
  if (ids.length) {
    const fr = await api.tradeRequest('fetch', `${api.TRADE}/api/trade2/fetch/${ids.join(',')}?query=${s.id}`);
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
        online: !!(r.listing.account && r.listing.account.online),
        indexed: r.listing.indexed,
        whisper: r.listing.whisper,
        ilvl: r.item.ilvl,
        corrupted: !!r.item.corrupted,
        tip: itemTip(r.item),
      };
    });
  }
  // Вторая цена — «любой ролл того же тира»: насколько рынок ценит именно ваши роллы. Не нужна, если роллы
  // уже опущены автоослаблением или их нечего опускать. Ошибка (лимит) — просто без неё.
  let floor = null;
  const loose = JSON.parse(JSON.stringify(f));
  const tight = loose.mods.filter((m) => m.enabled && m.range && m.min != null && m.min > Math.ceil(m.range.lo));
  if (!f.rollsLoosened && tight.length) {
    tight.forEach((m) => { m.min = Math.ceil(m.range.lo); });
    try {
      floor = await quickPrices(L, item, loose);
    } catch (e) {
      log('floor price skipped:', e.message);
    }
  }
  return { total: s.total, url, listings, rates: api.ninja.rates, filters: f, dropped,
    relaxStopped, floor };
}

// Короткий поиск ради цены: сколько лотов и цены 5 самых дешёвых (в div).
async function quickPrices(L, item, f) {
  const s = await api.tradeRequest('search', `${api.TRADE}/api/trade2/search/poe2/${L}`, buildQuery(item, f));
  const ids = (s.result || []).slice(0, 5);
  let lots = [];
  if (ids.length) {
    const fr = await api.tradeRequest('fetch', `${api.TRADE}/api/trade2/fetch/${ids.join(',')}?query=${s.id}`);
    // С возрастом лота — чтобы и вторую цену считать по свежим лотам, как основную.
    lots = (fr.result || []).filter(Boolean).map((r) => ({ p: r.listing.price || {}, indexed: r.listing.indexed }))
      .map(({ p, indexed }) => ({ div: p.amount != null ? toDivine(p.amount, p.currency) : null, indexed }))
      .filter((l) => l.div != null).sort((a, b) => a.div - b.div);
  }
  return { total: s.total, divs: lots.map((l) => l.div), lots, url: `${api.TRADE}/trade2/search/poe2/${L}/${s.id}` };
}

// Цена по изменённым фильтрам (без мода — «вклад мода», с модом из крафта — «цена после крафта»).
const quick = (league, item, filters) => quickPrices(encodeURIComponent(league), item, filters);

module.exports = { init, prepare, search, quick };
