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

// Что показать в оверлее сразу после копирования: разобранный предмет и фильтры по умолчанию.
function prepare(item) {
  item.baseType = resolveBase(item);
  item.mods = stats.matchMods(item);
  const ninjaRow = api.ninja.byName.get(item.name) || (item.rarity === 'Currency' && api.ninja.byName.get(item.baseType));
  const exchange = ninjaRow ? { ...ninjaRow, exaltedPerDivine: api.ninja.exaltedPerDivine,
    chaosPerDivine: api.ninja.chaosPerDivine } : null;

  const searchMods = item.rarity === 'Rare' || item.rarity === 'Magic';
  const filters = {
    mods: item.mods.map((m) => ({
      statId: m.statId,
      text: m.text,
      tag: m.tag,
      value: m.value,
      enabled: searchMods && ['explicit', 'fractured', 'desecrated'].includes(m.tag),
      // 80% от значения на предмете: дробь оставляем только для мелких чисел (0.5% регена и т.п.).
      min: m.value != null && m.value > 0 ? (m.value >= 5 ? Math.floor(m.value * 0.8) : Math.floor(m.value * 8) / 10) : null,
    })),
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
    if (!m.enabled) continue;
    const v = {};
    if (m.min != null && m.min !== '') v.min = Number(m.min);
    query.stats[0].filters.push({ id: m.statId, value: v });
  }
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
