// Оценка предмета: биржевые предметы — по poe.ninja, остальное — поиском на трейде.
const api = require('./api');
const stats = require('./stats');

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

// 80% от значения на предмете: дробь оставляем только для мелких чисел (0.5% регена и т.п.).
function minOf(v) {
  if (v == null || v <= 0) return null;
  return v >= 5 ? Math.floor(v * 0.8) : Math.floor(v * 8) / 10;
}

// Моды, которые почти не влияют на цену — по умолчанию не ищем по ним.
const LOW_VALUE = /Attribute Requirements|Light Radius|Stun Threshold|Thorns/;

// Моды, которые уже учтены в итоговой защите/уроне предмета. Фильтр по свойству есть только у брони/оружия,
// а там эти моды всегда локальные — даже если трейд не пометил их «(Local)» (у % ES, например, не пометил).
const LOCAL_COVERED = {
  // «#% increased Energy Shield», «# to maximum Energy Shield», «#% increased Armour, Evasion and Energy Shield»…
  // но не «#% increased Energy Shield Recharge Rate».
  defence: /^(#% increased|# to) (maximum )?(Armour|Evasion Rating|Evasion|Energy Shield)((,| and) (Armour|Evasion|Energy Shield))*( \(Local\))?$/,
  damage: /^(Adds # to # (Physical|Fire|Cold|Lightning|Chaos) Damage|#% increased (Physical Damage|Attack Speed))( \(Local\))?$/,
};

const PROPS = [
  { key: 'ar', label: 'Броня', covers: 'defence' },
  { key: 'ev', label: 'Уклонение', covers: 'defence' },
  { key: 'es', label: 'Энерг. щит', covers: 'defence' },
  { key: 'spirit', label: 'Дух', covers: 'spirit' },
  { key: 'dps', label: 'DPS', covers: 'damage' },
  { key: 'pdps', label: 'Физ. DPS', covers: 'damage' },
  { key: 'edps', label: 'Элем. DPS', covers: 'damage' },
];

function propFilters(item) {
  if (!['Rare', 'Magic', 'Normal'].includes(item.rarity)) return [];
  return PROPS.filter((p) => item.props[p.key] > 0).map((p) => ({
    ...p,
    value: item.props[p.key],
    min: Math.floor(item.props[p.key] * 0.85),
    // У оружия ищем по общему DPS, физ/элем — по желанию.
    enabled: p.key !== 'pdps' && p.key !== 'edps' && p.key !== 'spirit',
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
  const add = (id, text, value, group) => {
    if (!group.length) return;
    group.forEach((m) => { m.enabled = false; });
    out.push({ statId: id, text, tag: 'pseudo', value, enabled: true, min: minOf(value) });
  };
  const eleSum = ele.Fire + ele.Cold + ele.Lightning;
  add('pseudo.pseudo_total_elemental_resistance', `Σ +${eleSum}% к элементальным сопротивлениям`, eleSum, used.ele);
  add('pseudo.pseudo_total_chaos_resistance', `Σ +${chaos}% к сопротивлению хаосу`, chaos, used.chaos);
  add('pseudo.pseudo_total_life', `Σ +${life} к максимуму здоровья`, life, used.life);
  return out;
}

// Что показать в оверлее сразу после копирования: разобранный предмет и фильтры по умолчанию.
function prepare(item) {
  item.baseType = resolveBase(item);
  item.mods = stats.matchMods(item);
  // У уников несопоставленные строки — это флейвор-текст, его не показываем.
  if (item.rarity === 'Unique') item.mods = item.mods.filter((m) => m.statId);
  const ninjaRow = api.ninja.byName.get(item.name) || (item.rarity === 'Currency' && api.ninja.byName.get(item.baseType));
  const exchange = ninjaRow ? { ...ninjaRow, exaltedPerDivine: api.ninja.exaltedPerDivine,
    chaosPerDivine: api.ninja.chaosPerDivine } : null;

  const searchMods = item.rarity === 'Rare' || item.rarity === 'Magic';
  const props = propFilters(item);
  const covered = props.filter((p) => p.enabled).map((p) => LOCAL_COVERED[p.covers]).filter(Boolean);
  const mods = item.mods.map((m) => ({
    statId: m.statId,
    text: m.text,
    tag: m.tag,
    tier: m.tier,
    merged: !!m.parts,
    value: m.value,
    template: m.template,
    enabled: !!m.statId && searchMods && ['explicit', 'fractured', 'desecrated', 'crafted'].includes(m.tag)
      && !LOW_VALUE.test(m.template) && !covered.some((re) => re.test(m.template)),
    min: minOf(m.value),
  }));
  const pseudo = searchMods ? pseudoFilters(mods) : [];
  const filters = {
    mods: [...pseudo, ...mods],
    props,
    ilvl: item.ilvl && (item.rarity === 'Normal' || item.rarity === 'Magic') ? { enabled: true, min: item.ilvl } : null,
    gemLevel: item.gemLevel ? { enabled: true, min: item.gemLevel } : null,
    corrupted: item.corrupted,
    online: true,
  };
  return { item, exchange, filters, searchable: !exchange };
}

function buildQuery(item, f) {
  const query = {
    status: { option: f.online ? 'online' : 'any' },
    stats: [{ type: 'and', filters: [] }],
    filters: {},
  };
  if (item.rarity === 'Unique' && !item.unidentified) {
    query.name = item.name;
    query.type = item.baseType;
  } else {
    query.type = item.baseType;
  }
  const rarity = { Normal: 'normal', Magic: 'magic', Rare: 'nonunique', Unique: 'unique' }[item.rarity];
  if (rarity) query.filters.type_filters = { filters: { rarity: { option: rarity } } };

  for (const m of f.mods) {
    if (!m.enabled || !m.statId) continue;
    const v = {};
    if (m.min != null && m.min !== '') v.min = Number(m.min);
    query.stats[0].filters.push({ id: m.statId, value: v });
  }
  const equip = {};
  for (const p of f.props || []) if (p.enabled && p.min !== '' && p.min != null) equip[p.key] = { min: Number(p.min) };
  if (Object.keys(equip).length) query.filters.equipment_filters = { filters: equip };
  const misc = {};
  if (f.ilvl && f.ilvl.enabled) misc.ilvl = { min: Number(f.ilvl.min) };
  if (f.gemLevel && f.gemLevel.enabled) misc.gem_level = { min: Number(f.gemLevel.min) };
  if (Object.keys(misc).length) query.filters.misc_filters = { filters: misc };
  return { query, sort: { price: 'asc' } };
}

function toDivine(amount, currency) {
  if (currency === 'divine') return amount;
  const row = api.ninja.byId.get(currency);
  return row ? amount * row.divine : null;
}

async function search(league, item, filters) {
  const body = buildQuery(item, filters);
  const L = encodeURIComponent(league);
  const s = await api.tradeRequest('search', `${api.TRADE}/api/trade2/search/poe2/${L}`, body);
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
      };
    });
  }
  return { total: s.total, url, listings, exaltedPerDivine: api.ninja.exaltedPerDivine };
}

module.exports = { init, prepare, search };
