// Оценка весов модов PoE 2 по трейду (в файлах игры весов нет — только «может / не может выпасть»).
//
// Метод: по каждому классу вещей берём самые дешёвые редкие непорченые вещи (ilvl 75+) — это в основном случайный
// «хлам», моды на нём такие, как выпали. У каждого мода в ответе трейда есть имя аффикса, тир и уровень — по ним
// находим семейство мода в RePoE и считаем, на скольких вещах оно встретилось и с каким тиром.
// Crafted / desecrated / fractured / руны не считаем — только естественные моды.
//
// Запуск (раз за патч, долго — лимиты трейда): npm run collect-weights -- [--league "Forbidden Rites"] [--classes Boots,Helmets]
// Результат: data/weights.json; прогресс — data/weights.partial.json (повторный запуск продолжит с места остановки).
//
// Ограничения: даже дешёвые лоты кто-то отобрал для продажи, а совсем мусор на трейд не попадает — редкие моды
// недооценены, ходовые переоценены. Это оценка, а не данные игры.

const fs = require('fs');
const path = require('path');

const TRADE = 'https://www.pathofexile.com';
const UA = 'poe2-price-checker/weights-collector (contact: github.com/zhurauljou/poe2-advanced-price-check)';
const OUT = path.join(__dirname, '..', 'data', 'weights.json');
const PARTIAL = path.join(__dirname, '..', 'data', 'weights.partial.json');

const CLASSES = {
  'Body Armours': 'armour.chest', Helmets: 'armour.helmet', Gloves: 'armour.gloves', Boots: 'armour.boots',
  Shields: 'armour.shield', Bucklers: 'armour.buckler', Foci: 'armour.focus', Quivers: 'armour.quiver',
  Amulets: 'accessory.amulet', Rings: 'accessory.ring', Belts: 'accessory.belt', Jewels: 'jewel',
  Wands: 'weapon.wand', Staves: 'weapon.staff', Sceptres: 'weapon.sceptre', Quarterstaves: 'weapon.warstaff',
  Bows: 'weapon.bow', Crossbows: 'weapon.crossbow', Spears: 'weapon.spear', 'One Hand Maces': 'weapon.onemace',
  'Two Hand Maces': 'weapon.twomace', Talismans: 'weapon.talisman', Flails: 'weapon.flail', Daggers: 'weapon.dagger',
  Claws: 'weapon.claw', 'One Hand Swords': 'weapon.onesword', 'Two Hand Swords': 'weapon.twosword',
  'One Hand Axes': 'weapon.oneaxe', 'Two Hand Axes': 'weapon.twoaxe',
};
// Выборки по классу: разные окна ilvl — разные лоты (по 100 самых дешёвых в каждом).
const WINDOWS = [{ min: 75, max: 80 }, { min: 81 }];

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Лог — сразу в файл data/weights.log (без буферов): ход сбора видно в реальном времени.
const LOG = path.join(__dirname, '..', 'data', 'weights.log');
function say(msg) {
  const line = `${new Date().toTimeString().slice(0, 8)} ${msg}`;
  console.log(line);
  try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.appendFileSync(LOG, `${line}\n`); } catch {}
}

// ---- лимиты трейда: пауза не меньше MIN_GAP и ожидание, если по заголовкам до лимита осталось ≤ 2 запросов ----
// Лимит общий на IP — с программой и браузером. С большим запасом: поиск раз в 30 с, выборка раз в 12 с
// (вдвое медленнее, чем позволяют правила). Лучше запускать, когда в игре не торгуют.
const MIN_GAP = { search: 30000, fetch: 12000 };
const last = { search: 0, fetch: 0 };
const blockedUntil = { search: 0, fetch: 0 };
const lastState = { search: null, fetch: null }; // в ответе 429 счётчиков нет — помним последние, для лога
function readLimits(kind, h) {
  if (h.get('x-rate-limit-ip-state')) lastState[kind] = `${h.get('x-rate-limit-ip')} / ${h.get('x-rate-limit-ip-state')}`;
  const rules = (h.get('x-rate-limit-ip') || '').split(',').filter(Boolean).map((r) => r.split(':').map(Number));
  const state = (h.get('x-rate-limit-ip-state') || '').split(',').filter(Boolean).map((r) => r.split(':').map(Number));
  rules.forEach(([max, period], i) => {
    const used = state[i] ? state[i][0] : 0;
    if (used >= max - 2) blockedUntil[kind] = Math.max(blockedUntil[kind], Date.now() + period * 1000);
  });
}
async function call(kind, url, body) {
  const wait = Math.max(last[kind] + MIN_GAP[kind], blockedUntil[kind]) - Date.now();
  if (wait > 0) {
    if (wait > 15000) say(`  … waiting ${Math.round(wait / 1000)} s (${kind} rate limit)`);
    await sleep(wait);
  }
  last[kind] = Date.now();
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'User-Agent': UA, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  readLimits(kind, res.headers);
  if (res.status === 429) {
    const after = Number(res.headers.get('retry-after') || 0);
    throw new Error(`rate limited (429) on ${kind}, retry after ${after} s; last limits/state ${lastState[kind]} `
      + '— the limit is shared with the app and the browser on this IP; stopping to avoid a ban, run again later to resume');
  }
  if (!res.ok) throw new Error(`${kind} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function main() {
  const league = arg('league', 'Forbidden Rites');
  const only = arg('classes', '') ? arg('classes').split(',').map((s) => s.trim()) : null;
  const L = encodeURIComponent(league);
  // --wait N: подождать N секунд перед стартом (например, после 429 или недавних поисков в программе).
  const startWait = Number(arg('wait', 0));
  if (startWait) { say('Waiting ' + startWait + ' s before start…'); await sleep(startWait * 1000); }

  // RePoE: имя аффикса + сторона + уровень → семейство мода (type).
  say('Loading RePoE mods…');
  const mods = await (await fetch('https://repoe-fork.github.io/poe2/mods.min.json')).json();
  const byAffix = new Map();
  for (const m of Object.values(mods)) {
    if (!['prefix', 'suffix'].includes(m.generation_type) || !m.name) continue;
    byAffix.set(`${m.name}|${m.generation_type}|${m.required_level}`, m.type);
    if (!byAffix.has(`${m.name}|${m.generation_type}`)) byAffix.set(`${m.name}|${m.generation_type}`, m.type);
  }

  let data = { meta: {}, classes: {} };
  try { data = JSON.parse(fs.readFileSync(PARTIAL, 'utf8')); } catch {}
  if (data.meta.league && data.meta.league !== league) data = { meta: {}, classes: {} };
  data.meta = { league, collected: new Date().toISOString().slice(0, 10), method: 'cheapest rare uncorrupted listings, ilvl 75+',
    note: 'Estimated from trade listings — not game data. Rare modifiers are underestimated.' };

  for (const [cls, category] of Object.entries(CLASSES)) {
    if (only && !only.includes(cls)) continue;
    if (data.classes[cls] && data.classes[cls].done) { say(`${cls}: done earlier (${data.classes[cls].items} items)`); continue; }
    const c = { items: 0, unmatched: 0, families: {} };
    const seen = new Set();
    for (const w of WINDOWS) {
      const query = { query: { status: { option: 'available' }, filters: {
        type_filters: { filters: { category: { option: category }, rarity: { option: 'rare' }, ilvl: w } },
        misc_filters: { filters: { corrupted: { option: 'false' } } },
      } }, sort: { price: 'asc' } };
      const s = await call('search', `${TRADE}/api/trade2/search/poe2/${L}`, query);
      const ids = (s.result || []).filter((id) => !seen.has(id));
      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        batch.forEach((id) => seen.add(id));
        const fr = await call('fetch', `${TRADE}/api/trade2/fetch/${batch.join(',')}?query=${s.id}`);
        for (const r of fr.result || []) {
          if (!r || !r.item) continue;
          c.items++;
          // Одна строка мода может принадлежать нескольким аффиксам (гибриды) и наоборот — собираем аффиксы вещи без повторов.
          const affixes = new Map();
          for (const line of r.item.explicitMods || []) {
            if (typeof line !== 'object' || (line.domain && line.domain !== 'explicit')) continue;
            for (const m of line.mods || []) {
              const side = /^P/.test(m.tier) ? 'prefix' : /^S/.test(m.tier) ? 'suffix' : null;
              if (!side || !m.name) continue;
              affixes.set(`${m.name}|${m.tier}`, { name: m.name, side, tier: +String(m.tier).slice(1), level: m.level });
            }
          }
          for (const a of affixes.values()) {
            const type = byAffix.get(`${a.name}|${a.side}|${a.level}`) || byAffix.get(`${a.name}|${a.side}`);
            if (!type) { c.unmatched++; continue; }
            const f = c.families[type] || (c.families[type] = { side: a.side, n: 0, tiers: {} });
            f.n++;
            f.tiers[a.tier] = (f.tiers[a.tier] || 0) + 1;
          }
        }
        say(`${cls}: ${c.items} items…`);
      }
    }
    c.done = true;
    data.classes[cls] = c;
    fs.mkdirSync(path.dirname(PARTIAL), { recursive: true });
    fs.writeFileSync(PARTIAL, JSON.stringify(data));
    say(`${cls}: ${c.items} items,${Object.keys(c.families).length} modifier families, ${c.unmatched} unmatched affixes`);
  }
  fs.writeFileSync(OUT, JSON.stringify(data, null, 1));
  say(`Saved ${OUT}`);
}

main().catch((e) => { say(`STOPPED: ${e.message}`); process.exit(1); });
