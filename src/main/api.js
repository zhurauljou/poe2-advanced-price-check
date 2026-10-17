// Сеть: официальный трейд PoE 2 (с соблюдением лимитов) и poe.ninja.
const { net, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { t } = require('../shared/i18n');

const VERSION = require('../../package.json').version;
const UA = `poe2-price-checker/${VERSION} (personal desktop tool)`;
const TRADE = 'https://www.pathofexile.com';
const NINJA = 'https://poe.ninja/poe2/api';

// ---------- лимиты трейда ----------
// Сервер присылает правила вида «5:10:60» (5 запросов за 10 с, иначе бан на 60 с) отдельно для
// поиска и для выдачи лотов. Помним свои запросы и ждём, пока не будет места во всех окнах.
// Сервер дополнительно присылает текущий счёт в каждом окне (X-Rate-Limit-Ip-State) — он учитывает и запросы
// других копий программы / сайта трейда с этого IP. Если до предела остался один запрос — выжидаем окно целиком.
const limits = {
  search: { rules: [[5, 10]], hits: [], blockedUntil: 0 },
  fetch: { rules: [[12, 4]], hits: [], blockedUntil: 0 },
};
// Дольше этого ждать молча не будем — сразу скажем пользователю.
const MAX_SILENT_WAIT = 15000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Зависшее соединение не должно вешать проверку навсегда (горячая клавиша ждёт конца прошлой проверки).
const TIMEOUT = 20000;
function netFetch(url, opts = {}) {
  return net.fetch(url, { ...opts, signal: AbortSignal.timeout(TIMEOUT) }).catch((e) => {
    if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new Error(t('No answer from {host} in {n} s', { host: new URL(url).host, n: TIMEOUT / 1000 }));
    throw e;
  });
}

// Бан переживает перезапуск: иначе новая копия сразу стучится снова и продлевает его.
// Бан — на IP, поэтому файл общий и для демо-профиля (userData-demo).
const banFile = () => path.join(app.getPath('userData').replace(/-demo$/, ''), 'trade-ban.json');
let bannedUntil = null;
function getBan() {
  if (bannedUntil == null) {
    try { bannedUntil = JSON.parse(fs.readFileSync(banFile(), 'utf8')).until || 0; } catch { bannedUntil = 0; }
  }
  return bannedUntil;
}
function setBan(seconds) {
  bannedUntil = Math.max(getBan(), Date.now() + seconds * 1000);
  try { fs.writeFileSync(banFile(), JSON.stringify({ until: bannedUntil })); } catch {}
}

function waitText(ms) {
  const s = Math.ceil(ms / 1000);
  return s >= 120 ? t('{n} min', { n: Math.ceil(s / 60) }) : t('{n} s', { n: s });
}

async function waitSlot(kind) {
  const L = limits[kind];
  for (;;) {
    const now = Date.now();
    if (getBan() > now) throw new Error(t('Trade site rate limit hit — wait {time}', { time: waitText(getBan() - now) }));
    let wait = Math.max(0, L.blockedUntil - now);
    for (const [hits, period] of L.rules) {
      const inWin = L.hits.filter((t) => now - t < period * 1000);
      if (inWin.length >= hits) wait = Math.max(wait, inWin[0] + period * 1000 - now + 50);
    }
    if (!wait) break;
    if (wait > MAX_SILENT_WAIT) throw new Error(t('Trade request limit almost used up — wait {time}', { time: waitText(wait) }));
    if (module.exports.onWait) module.exports.onWait(wait); // окно покажет «ждём лимит», а не молча висит
    await sleep(wait);
  }
  L.hits.push(Date.now());
  if (L.hits.length > 100) L.hits.splice(0, L.hits.length - 100);
}

const parseRules = (h) => (h ? h.split(',').map((r) => r.split(':').map(Number)) : []);

function learnRules(kind, res) {
  const L = limits[kind];
  const rules = parseRules(res.headers.get('x-rate-limit-ip'));
  const state = parseRules(res.headers.get('x-rate-limit-ip-state'));
  if (rules.length) L.rules = rules.map(([n, p]) => [Math.max(1, n - 1), p]);
  for (const [count, period, ban] of state) {
    if (ban > 0) setBan(ban);
    const rule = rules.find((r) => r[1] === period);
    // Короткие окна (10 с) считаем сами по своим запросам — иначе каждая серия поисков ждала бы целое окно.
    // По счётчику сервера тормозим только в длинных окнах (минута и дольше), где бан — на полчаса.
    if (rule && period >= 60 && count >= rule[0] - 1) L.blockedUntil = Math.max(L.blockedUntil, Date.now() + period * 1000);
  }
}

async function tradeRequest(kind, url, body) {
  await waitSlot(kind);
  const res = await netFetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  learnRules(kind, res);
  if (res.status === 429) {
    const ra = Number(res.headers.get('retry-after') || 60);
    setBan(ra);
    throw new Error(t('Trade site rate limit hit — wait {time}', { time: waitText(ra * 1000) }));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error && data.error.message) || t('Trade site responded {n}', { n: res.status }));
  return data;
}

async function fetchBuffer(url) {
  const res = await netFetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function getJson(url) {
  const res = await netFetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
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

// rates: сколько chaos / exalted в 1 div и сколько div в 1 mirror — для показа цен в окне.
const ninja = { league: null, at: 0, byName: new Map(), byId: new Map(), rates: {} };

let ninjaLoading = null; // { league, promise } — не качаем одно и то же параллельно

function loadNinja(league, force = false) {
  if (!force && ninja.league === league && Date.now() - ninja.at < 15 * 60e3) return Promise.resolve(ninja);
  if (ninjaLoading && ninjaLoading.league === league) return ninjaLoading.promise;
  const promise = fetchNinja(league).finally(() => { ninjaLoading = null; });
  ninjaLoading = { league, promise };
  return promise;
}

async function fetchNinja(league) {
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
  if (!byName.size) throw new Error('poe.ninja returned no prices for league ' + league);
  Object.assign(ninja, {
    league, at: Date.now(), byName, byId,
    rates: ratesFrom(byId, rates),
  });
  return ninja;
}

// Курсы из самих строк биржи (core.rates — запасной вариант).
function ratesFrom(byId, core) {
  const per = (id) => (byId.get(id) && byId.get(id).divine ? 1 / byId.get(id).divine : null);
  return {
    chaos: per('chaos') || (core && core.chaos) || null,
    exalted: per('exalted') || (core && core.exalted) || null,
    mirror: byId.get('mirror') ? byId.get('mirror').divine : null,
  };
}

// ---------- poe.ninja: цены уников (одна «нижняя» цена на название + базу, без учёта роллов) ----------
const UNIQUE_TYPES = ['UniqueWeapons', 'UniqueArmours', 'UniqueAccessories', 'UniqueJewels', 'UniqueFlasks',
  'UniqueCharms', 'UniqueTablets', 'UniqueSanctumRelics'];
const uniques = { league: null, at: 0, map: new Map(), loading: null };

async function fetchUniques(league) {
  const q = encodeURIComponent(league);
  const results = await Promise.all(UNIQUE_TYPES.map((t) =>
    getJson(`${NINJA}/economy/stash/current/item/overview?league=${q}&type=${t}`).catch(() => null)));
  const map = new Map();
  for (const d of results) {
    for (const ln of (d && d.lines) || []) {
      map.set(`${ln.name}|${ln.baseType}`, { divine: ln.primaryValue, listings: ln.listingCount,
        change: ln.sparkLine ? ln.sparkLine.totalChange : null });
    }
  }
  Object.assign(uniques, { league, at: Date.now(), map });
}

// Цена уника на poe.ninja: { divine, listings, change } или null.
async function uniquePrice(league, name, baseType) {
  if (uniques.league !== league || Date.now() - uniques.at > 15 * 60e3) {
    // Загрузка — своя для каждой лиги: запрос другой лиги не должен получить цены первой.
    if (!uniques.loading || uniques.loading.league !== league) {
      const promise = fetchUniques(league).finally(() => { if (uniques.loading && uniques.loading.promise === promise) uniques.loading = null; });
      uniques.loading = { league, promise };
    }
    await uniques.loading.promise;
  }
  return uniques.map.get(`${name}|${baseType}`) || null;
}

module.exports = {
  TRADE, tradeRequest, fetchBuffer, cached, tradeStats, tradeItems, tradeStatic, tradeLeagues, loadNinja, ninja, uniquePrice,
};
