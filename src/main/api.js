// Network: the official PoE 2 trade (respecting rate limits) and poe.ninja.
const { net, app } = require('electron');
const { AsyncLocalStorage } = require('async_hooks');
const fs = require('fs');
const path = require('path');
const { t } = require('../shared/i18n');
const { writeFileAtomic, cacheDir } = require('./files');

const VERSION = require('../../package.json').version;
const UA = `poe2-price-checker/${VERSION} (personal desktop tool)`;
const TRADE = 'https://www.pathofexile.com';
const NINJA = 'https://poe.ninja/poe2/api';

// ---------- trade rate limits ----------
// The server sends rules like "5:10:60" (5 requests per 10 s, otherwise a 60 s ban) separately for
// search and for fetching listings. We remember our requests and wait until there is room in every window.
// The server also sends the current count in each window (X-Rate-Limit-Ip-State) — it includes requests from
// other copies of the app / the trade site from this IP. If only one request is left before the limit — wait out the whole window.
const limits = {
  search: { rules: [[5, 10]], hits: [], blockedUntil: 0 },
  fetch: { rules: [[12, 4]], hits: [], blockedUntil: 0 },
  exchange: { rules: [[4, 15]], hits: [], blockedUntil: 0 }, // exchange: 5 per 15 s (trade-exchange-request-limit policy)
};
// We won't wait longer than this silently — tell the user right away.
const MAX_SILENT_WAIT = 15000;

// Rate-limit errors are marked with ⏳ at the start of the text: the window uses it to know further searching is pointless (error
// properties don't survive IPC, the text does). A cancelled request — ⊘: the window doesn't show it.
const limitError = (msg) => new Error(`⏳ ${msg}`);

// Request generation: each item check (and closing the window) starts a new one. A trade request remembers its generation
// (via AsyncLocalStorage — across all awaits) and, if it's stale, doesn't spend the limit: not-yet-sent
// requests for the previous item (search with relaxation, "price after craft" for all rows…) are cancelled.
const owner = new AsyncLocalStorage();
let generation = 0;
const newGeneration = () => { generation++; };
const forCurrent = (fn) => owner.run(generation, fn);
function checkAlive() {
  const g = owner.getStore();
  if (g != null && g !== generation) throw new Error(`⊘ ${t('Cancelled — another item was checked')}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A hung connection must not hang the check forever (the hotkey waits for the previous check to finish).
const TIMEOUT = 20000;
// Recording / replaying network responses (demo only: --tape=<folder> [--record]) — window snapshots without network repeat
// exactly (scripts/visual.js). Key — URL and request body.
let tape = null;
function setTape(dir, record) { tape = { dir, record }; fs.mkdirSync(dir, { recursive: true }); }
function tapeKey(url, opts) { return require('crypto').createHash('sha1').update(`${opts.method || 'GET'} ${url}\n${opts.body || ''}`).digest('hex').slice(0, 20); }
async function tapeFetch(url, opts) {
  const f = path.join(tape.dir, `${tapeKey(url, opts)}.gz`);
  const zlib = require('zlib');
  // A static image (currency icon) missing from the recording is recorded on first use: it never changes, so the
  // snapshots stay repeatable — unlike trade or poe.ninja responses, which only a deliberate --record refreshes.
  if (!tape.record && !(!fs.existsSync(f) && /^https:\/\/web\.poecdn\.com\/gen\/image\//.test(url))) {
    if (!fs.existsSync(f)) throw new Error(`no recording for ${url}`);
    const { status, headers, body } = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
    // The body is stored already decompressed — compression and length headers don't fit it.
    for (const h of ['content-encoding', 'content-length', 'transfer-encoding']) delete headers[h];
    return new Response(status === 204 ? null : Buffer.from(body, 'base64'), { status, headers });
  }
  const res = await net.fetch(url, { ...opts, signal: AbortSignal.timeout(TIMEOUT) });
  const body = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify({ url, status: res.status, headers: Object.fromEntries(res.headers), body: body.toString('base64') })));
  return new Response(res.status === 204 ? null : body, { status: res.status, headers: res.headers });
}

function netFetch(url, opts = {}) {
  if (tape) return tapeFetch(url, opts);
  return net.fetch(url, { ...opts, signal: AbortSignal.timeout(TIMEOUT) }).catch((e) => {
    if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new Error(t('No answer from {host} in {n} s', { host: new URL(url).host, n: TIMEOUT / 1000 }));
    throw e;
  });
}

// The ban survives a restart: otherwise a new copy knocks again immediately and extends it.
// The ban is per IP, so the file is shared with the demo profile too (userData-demo).
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
  try { writeFileAtomic(banFile(), JSON.stringify({ until: bannedUntil })); } catch {}
}

function waitText(ms) {
  const s = Math.ceil(ms / 1000);
  return s >= 120 ? t('{n} min', { n: Math.ceil(s / 60) }) : t('{n} s', { n: s });
}

async function waitSlot(kind) {
  const L = limits[kind];
  for (;;) {
    checkAlive();
    const now = Date.now();
    if (getBan() > now) throw limitError(t('Trade site rate limit hit — wait {time}', { time: waitText(getBan() - now) }));
    let wait = Math.max(0, L.blockedUntil - now);
    for (const [hits, period] of L.rules) {
      const inWin = L.hits.filter((t) => now - t < period * 1000);
      if (inWin.length >= hits) wait = Math.max(wait, inWin[0] + period * 1000 - now + 50);
    }
    if (!wait) break;
    if (wait > MAX_SILENT_WAIT) throw limitError(t('Trade request limit almost used up — wait {time}', { time: waitText(wait) }));
    if (module.exports.onWait) module.exports.onWait(wait); // the window will show "waiting for limit" instead of hanging silently
    await sleep(wait);
  }
  L.hits.push(Date.now());
  if (L.hits.length > 100) L.hits.splice(0, L.hits.length - 100);
}

// In how many ms searching is possible again (ban and limit windows) — the window shows a countdown and retries the search itself.
function limitWait(kind = 'search') {
  const L = limits[kind];
  const now = Date.now();
  let wait = Math.max(0, getBan() - now, L.blockedUntil - now);
  for (const [hits, period] of L.rules) {
    const inWin = L.hits.filter((x) => now - x < period * 1000);
    if (inWin.length >= hits) wait = Math.max(wait, inWin[0] + period * 1000 - now + 50);
  }
  return wait;
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
    // Short windows (10 s) we count ourselves from our own requests — otherwise every search series would wait a whole window.
    // We throttle by the server's counter only in long windows (a minute and longer), where the ban is half an hour.
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
    throw limitError(t('Trade site rate limit hit — wait {time}', { time: waitText(ra * 1000) }));
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

// ---------- trade reference data, cached for a day ----------
function cacheFile(name) {
  return path.join(cacheDir(), name);
}

// Reference data taken from the old cache because the network didn't respond: { host, at } — the window says the data isn't fresh.
const offline = { host: null, at: 0 };

async function cached(name, url, maxAgeH = 24) {
  const f = cacheFile(name);
  try {
    if (Date.now() - (await fs.promises.stat(f)).mtimeMs < maxAgeH * 3600e3) return JSON.parse(await fs.promises.readFile(f, 'utf8'));
  } catch {}
  try {
    const data = await getJson(url);
    writeFileAtomic(f, JSON.stringify(data));
    if (offline.host === new URL(url).host) offline.host = null;
    return data;
  } catch (e) {
    // No network — use the old cache (a broken one counts as missing: a network error is clearer than "Unexpected end of JSON").
    let old = null;
    try { old = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
    if (old) { Object.assign(offline, { host: new URL(url).host, at: Date.now() }); return old; }
    throw e;
  }
}

// "Update game data" (after a patch): wipe the reference data — the next load downloads fresh copies.
// only — wipe only the matching files (fresh trade reference data without RePoE and prices).
function clearCache(only = null) {
  for (const f of fs.readdirSync(cacheDir())) {
    if (only && !only.test(f)) continue;
    try { fs.unlinkSync(path.join(cacheDir(), f)); } catch {}
  }
  if (only) return;
  ninja.at = 0;
  uniques.at = 0;
}

// Cache file age in hours (no file — infinity).
function cacheAgeH(name) {
  try { return (Date.now() - fs.statSync(cacheFile(name)).mtimeMs) / 3600e3; } catch { return Infinity; }
}

const tradeStats = () => cached('stats.json', `${TRADE}/api/trade2/data/stats`);
const tradeItems = () => cached('items.json', `${TRADE}/api/trade2/data/items`);
const tradeStatic = () => cached('static.json', `${TRADE}/api/trade2/data/static`);
const tradeLeagues = () => cached('leagues.json', `${TRADE}/api/trade2/data/leagues`, 6);

// ---------- poe.ninja: exchange prices ----------
const NINJA_TYPES = [
  'Currency', 'Fragments', 'Runes', 'Essences', 'Ritual', 'Expedition', 'Delirium', 'Breach', 'Abyss',
  'SoulCores', 'UncutGems', 'LineageSupportGems', 'Idols', 'Verisium',
];

// rates: how many chaos / exalted per 1 div and how many div per 1 mirror — for showing prices in the window.
const ninja = { league: null, at: 0, byName: new Map(), byId: new Map(), rates: {} };

let ninjaLoading = null; // { league, promise } — don't download the same thing in parallel
let ninjaWanted = null; // league of the latest request: a late response for the previous league doesn't overwrite its prices

function loadNinja(league, force = false) {
  ninjaWanted = league;
  if (!force && ninja.league === league && Date.now() - ninja.at < 15 * 60e3) return Promise.resolve(ninja);
  if (ninjaLoading && ninjaLoading.league === league) return ninjaLoading.promise;
  const promise = fetchNinja(league).finally(() => { if (ninjaLoading && ninjaLoading.promise === promise) ninjaLoading = null; });
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
  if (league !== ninjaWanted) return ninja; // the league was switched while downloading — this league's rates are no longer needed
  Object.assign(ninja, {
    league, at: Date.now(), byName, byId,
    rates: ratesFrom(byId, rates),
  });
  return ninja;
}

// Rates from the exchange rows themselves (core.rates — fallback).
function ratesFrom(byId, core) {
  const per = (id) => (byId.get(id) && byId.get(id).divine ? 1 / byId.get(id).divine : null);
  return {
    chaos: per('chaos') || (core && core.chaos) || null,
    exalted: per('exalted') || (core && core.exalted) || null,
    mirror: byId.get('mirror') ? byId.get('mirror').divine : null,
  };
}

// ---------- poe.ninja: unique prices (one "lowest" price per name + base, ignoring rolls) ----------
const UNIQUE_TYPES = ['UniqueWeapons', 'UniqueArmours', 'UniqueAccessories', 'UniqueJewels', 'UniqueFlasks',
  'UniqueCharms', 'UniqueTablets', 'UniqueSanctumRelics'];
const uniques = { league: null, at: 0, map: new Map(), loading: null };

async function fetchUniques(league) {
  const q = encodeURIComponent(league);
  const results = await Promise.all(UNIQUE_TYPES.map((t) =>
    getJson(`${NINJA}/economy/stash/current/item/overview?league=${q}&type=${t}`).catch(() => null)));
  // No section responded (no network, poe.ninja down) — that's an error, not "uniques have no prices": otherwise an empty list
  // would be remembered for 15 minutes.
  if (results.every((d) => !d)) throw new Error('poe.ninja: no unique prices');
  const map = new Map();
  for (const d of results) {
    for (const ln of (d && d.lines) || []) {
      map.set(`${ln.name}|${ln.baseType}`, { divine: ln.primaryValue, listings: ln.listingCount,
        change: ln.sparkLine ? ln.sparkLine.totalChange : null });
    }
  }
  Object.assign(uniques, { league, at: Date.now(), map });
}

// Unique price on poe.ninja: { divine, listings, change } or null.
async function uniquePrice(league, name, baseType) {
  if (uniques.league !== league || Date.now() - uniques.at > 15 * 60e3) {
    // Loading is per league: a request for another league must not get the first one's prices.
    if (!uniques.loading || uniques.loading.league !== league) {
      const promise = fetchUniques(league).finally(() => { if (uniques.loading && uniques.loading.promise === promise) uniques.loading = null; });
      uniques.loading = { league, promise };
    }
    await uniques.loading.promise;
  }
  return uniques.map.get(`${name}|${baseType}`) || null;
}

module.exports = {
  TRADE, tradeRequest, newGeneration, cacheDir, clearCache, cacheAgeH, setTape, limitWait, offline, forCurrent, fetchBuffer, cached, tradeStats, tradeItems, tradeStatic, tradeLeagues, loadNinja, ninja, uniquePrice,
};
