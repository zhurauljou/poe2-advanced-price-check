// Сеть: официальный трейд PoE 2 (с соблюдением лимитов) и poe.ninja.
const { net, app } = require('electron');
const fs = require('fs');
const path = require('path');

const VERSION = require('../../package.json').version;
const UA = `poe2-price-checker/${VERSION} (personal desktop tool)`;
const TRADE = 'https://www.pathofexile.com';
const NINJA = 'https://poe.ninja/poe2/api';

// ---------- лимиты трейда ----------
// Сервер присылает правила вида «5:10:60» (5 запросов за 10 с, иначе бан на 60 с) отдельно для
// поиска и для выдачи лотов. Помним свои запросы и ждём, пока не будет места во всех окнах.
const limits = {
  search: { rules: [[5, 10]], hits: [] },
  fetch: { rules: [[12, 4]], hits: [] },
};
let bannedUntil = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitSlot(kind) {
  const L = limits[kind];
  for (;;) {
    const now = Date.now();
    if (bannedUntil > now) throw new Error(`Трейд временно ограничил запросы, подождите ${Math.ceil((bannedUntil - now) / 1000)} с`);
    let wait = 0;
    for (const [hits, period] of L.rules) {
      const inWin = L.hits.filter((t) => now - t < period * 1000);
      if (inWin.length >= hits) wait = Math.max(wait, inWin[0] + period * 1000 - now + 50);
    }
    if (!wait) break;
    await sleep(wait);
  }
  L.hits.push(Date.now());
  if (L.hits.length > 100) L.hits.splice(0, L.hits.length - 100);
}

function learnRules(kind, res) {
  const h = res.headers.get('x-rate-limit-ip');
  if (!h) return;
  const rules = h.split(',').map((r) => r.split(':').map(Number)).map(([n, p]) => [Math.max(1, n - 1), p]);
  if (rules.length) limits[kind].rules = rules;
}

async function tradeRequest(kind, url, body) {
  await waitSlot(kind);
  const res = await net.fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  learnRules(kind, res);
  if (res.status === 429) {
    const ra = Number(res.headers.get('retry-after') || 60);
    bannedUntil = Date.now() + ra * 1000;
    throw new Error(`Трейд ограничил запросы на ${ra} с`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error && data.error.message) || `Трейд ответил ${res.status}`);
  return data;
}

async function getJson(url) {
  const res = await net.fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

// ---------- справочники трейда с кэшем на сутки ----------
function cacheFile(name) {
  return path.join(app.getPath('userData'), 'cache', name);
}

async function cached(name, url, maxAgeH = 24) {
  const f = cacheFile(name);
  try {
    if (Date.now() - fs.statSync(f).mtimeMs < maxAgeH * 3600e3) return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {}
  try {
    const data = await getJson(url);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(data));
    return data;
  } catch (e) {
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')); // нет сети — берём старый кэш
    throw e;
  }
}

const tradeStats = () => cached('stats.json', `${TRADE}/api/trade2/data/stats`);
const tradeItems = () => cached('items.json', `${TRADE}/api/trade2/data/items`);
const tradeStatic = () => cached('static.json', `${TRADE}/api/trade2/data/static`);
const tradeLeagues = () => cached('leagues.json', `${TRADE}/api/trade2/data/leagues`, 6);

// ---------- poe.ninja: цены биржи ----------
const NINJA_TYPES = [
  'Currency', 'Fragments', 'Runes', 'Essences', 'Ritual', 'Expedition', 'Delirium', 'Breach', 'Abyss',
  'SoulCores', 'UncutGems', 'LineageSupportGems', 'Idols', 'Verisium',
];

const ninja = { league: null, at: 0, byName: new Map(), byId: new Map(), exaltedPerDivine: null, chaosPerDivine: null };

async function loadNinja(league, force = false) {
  if (!force && ninja.league === league && Date.now() - ninja.at < 15 * 60e3) return ninja;
  const q = encodeURIComponent(league);
  const results = await Promise.all(NINJA_TYPES.map((t) =>
    getJson(`${NINJA}/economy/exchange/current/overview?league=${q}&type=${t}`).catch(() => null)));
  const byName = new Map();
  const byId = new Map();
  let rates = null;
  results.forEach((d, i) => {
    if (!d || !d.lines) return;
    if (d.core && d.core.rates) rates = d.core.rates;
    const meta = new Map((d.items || []).map((it) => [it.id, it]));
    if (d.core) for (const it of d.core.items || []) meta.set(it.id, it);
    for (const ln of d.lines) {
      const it = meta.get(ln.id);
      if (!it) continue;
      const row = {
        id: ln.id, name: it.name, category: NINJA_TYPES[i],
        image: it.image ? `https://web.poecdn.com${it.image}` : null,
        divine: ln.primaryValue, volume: ln.volumePrimaryValue,
        change: ln.sparkline ? ln.sparkline.totalChange : null,
        spark: ln.sparkline ? ln.sparkline.data : null,
      };
      byName.set(it.name, row);
      byId.set(ln.id, row);
    }
  });
  if (!byName.size) throw new Error('poe.ninja не вернул цены для лиги ' + league);
  Object.assign(ninja, {
    league, at: Date.now(), byName, byId,
    exaltedPerDivine: rates && rates.exalted, chaosPerDivine: rates && rates.chaos,
  });
  return ninja;
}

async function ninjaLeagues() {
  const d = await getJson(`${NINJA}/data/index-state`);
  return d.economyLeagues || [];
}

module.exports = {
  TRADE, tradeRequest, tradeStats, tradeItems, tradeStatic, tradeLeagues, loadNinja, ninjaLeagues, ninja,
};
