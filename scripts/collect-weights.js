// Оценка весов модов PoE 2 по трейду (в файлах игры весов нет — только «может / не может выпасть»). Отдельная утилита:
// запускается вручную (Collect weights.bat или npm run collect-weights), в саму программу не встроена.
//
// Метод: по каждому классу вещей берём редкие непорченые вещи (ilvl 75+) ценой до 2 ex, самые свежие (не «самые
// дешёвые»: внутри дешёвого диапазона это почти случайный срез) — моды на них в основном такие, как выпали. У каждого
// мода в ответе трейда есть имя аффикса, тир и уровень — по ним находим семейство мода в RePoE.
// Сохраняем моды каждой вещи (raw): программа сама выкидывает «причину продажи» — самый востребованный мод вещи
// (по свежему спросу poe.ninja), остальные моды той же вещи выпали случайно.
// Crafted / desecrated / fractured / руны не считаем — только естественные моды.
//
// Накопление: утилита ходит по классам по кругу, пока её не остановят, и каждый круг добирает только НОВЫЕ лоты
// (уже виденные — по id). Всё копится в data/weights-store/<лига>.json (локально, в git не попадает); после каждого
// класса пересобирается data/weights.json — его читает программа, коммитить — когда захотите.
// Пока вы за компьютером (мышь / клавиатура трогались последние --idle минут), сбор на паузе: лимит трейда общий на IP,
// он нужен вам. Остановить — Ctrl+C или закрыть окно (собранное не теряется).
//
//   npm run collect-weights -- [--league "Forbidden Rites"] [--classes Boots,Helmets] [--once] [--max 50] [--idle 3 | --no-idle]
//   --max N — не больше N новых вещей на класс за круг (быстрая проверка, короткая добивка)
//
// Ограничения: даже дешёвые лоты кто-то отобрал для продажи, а совсем мусор на трейд не попадает — редкие моды
// недооценены, ходовые переоценены. Это оценка, а не данные игры.

const fs = require('fs');
const path = require('path');

const TRADE = 'https://www.pathofexile.com';
const UA = 'poe2-price-checker/weights-collector (contact: github.com/zhurauljou/poe2-advanced-price-check)';
const DATA = path.join(__dirname, '..', 'data');
const OUT = path.join(DATA, 'weights.json');
const STORE_DIR = path.join(DATA, 'weights-store');

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
// Выборки по классу: разные окна ilvl — разные лоты (до 100 в каждом).
const WINDOWS = [{ min: 75, max: 78 }, { min: 79, max: 81 }, { min: 82, max: 84 }, { min: 85 }];
const PRICE_MAX = 2; // ex (Exalted Orb Equivalent — по умолчанию у трейда)
const VERSION = 2; // формат weights.json: classes[cls] = { items, types: [семейства], raw: [[[индекс семейства, тир], …], …] }

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes(`--${k}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Лог — сразу в файл data/weights.log (без буферов): ход сбора видно в реальном времени.
const LOG = path.join(DATA, 'weights.log');
function say(msg) {
  const line = `${new Date().toTimeString().slice(0, 8)} ${msg}`;
  console.log(line);
  try { fs.mkdirSync(DATA, { recursive: true }); fs.appendFileSync(LOG, `${line}\n`); } catch {}
}
function writeJson(file, data) { // через временный файл: остановка посреди записи не оставит обрезанный JSON
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data));
  fs.renameSync(`${file}.tmp`, file);
}

// ---- «вы за компьютером»: сколько мс назад трогали мышь / клавиатуру (WinAPI через koffi; нет — считаем, что отошли) ----
let idleMs = () => Infinity;
try {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const kernel32 = koffi.load('kernel32.dll');
  koffi.struct('LASTINPUTINFO', { cbSize: 'uint32', dwTime: 'uint32' });
  const getLastInput = user32.func('bool __stdcall GetLastInputInfo(_Inout_ LASTINPUTINFO *plii)');
  const tick = kernel32.func('uint32 __stdcall GetTickCount()');
  idleMs = () => { const info = { cbSize: 8, dwTime: 0 }; return getLastInput(info) ? (tick() - info.dwTime) >>> 0 : Infinity; };
} catch {}
const IDLE_MS = flag('no-idle') ? 0 : Number(arg('idle', 3)) * 60000;
async function waitIdle() {
  if (!IDLE_MS || idleMs() >= IDLE_MS) return;
  say(`Paused: you are at the computer — resuming after ${IDLE_MS / 60000} min without mouse / keyboard`);
  while (idleMs() < IDLE_MS) await sleep(15000);
  say('Resumed');
}

// ---- лимиты трейда: пауза не меньше MIN_GAP и ожидание, если по заголовкам до лимита осталось ≤ 2 запросов ----
// Лимит общий на IP — с программой и браузером. С большим запасом: поиск раз в 30 с, выборка раз в 12 с
// (вдвое медленнее, чем позволяют правила).
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
// Отказ 429 приходит и при счётчиках далеко от лимитов (скрытое правило ~25 выборок подряд, штраф 600 с).
// Поэтому: пережидаем штраф, дальше идём вдвое медленнее; три отказа подряд без продвижения — стоп (чтобы не нарваться на бан длиннее).
let strikes = 0;
const jitter = (ms) => Math.round(ms * (0.7 + Math.random() * 0.6)); // ±30%: ритм не механический
async function call(kind, url, body) {
  for (;;) {
    await waitIdle();
    const wait = Math.max(last[kind] + jitter(MIN_GAP[kind]), blockedUntil[kind]) - Date.now();
    if (wait > 0) {
      if (wait > 15000) say(`  … waiting ${Math.round(wait / 1000)} s (${kind} rate limit)`);
      await sleep(wait);
      await waitIdle();
    }
    last[kind] = Date.now();
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'User-Agent': UA, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    readLimits(kind, res.headers);
    if (res.status === 429) {
      const after = Number(res.headers.get('retry-after') || 600);
      strikes++;
      say(`429 on ${kind} (strike ${strikes}/3), retry after ${after} s; last limits/state ${lastState[kind]}`);
      if (strikes >= 3) throw new Error('three 429 in a row — stopping to avoid a longer ban; run again later to resume');
      MIN_GAP[kind] = Math.min(MIN_GAP[kind] * 2, 60000);
      say(`  slowing down: ${kind} every ~${Math.round(MIN_GAP[kind] / 1000)} s; waiting out the penalty`);
      blockedUntil[kind] = Date.now() + (after + 60) * 1000;
      continue;
    }
    if (!res.ok) throw new Error(`${kind} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    strikes = 0;
    return res.json();
  }
}

// ---- пул модов класса (RePoE): какие семейства могут выпасть на базы этого класса ----
// «Item Class:» игры → item_class в RePoE.
const REPOE_CLASS = { 'Body Armours': 'Body Armour', Helmets: 'Helmet', Gloves: 'Gloves', Boots: 'Boots', Shields: 'Shield',
  Bucklers: 'Buckler', Foci: 'Focus', Quivers: 'Quiver', Amulets: 'Amulet', Rings: 'Ring', Belts: 'Belt', Jewels: 'Jewel',
  Wands: 'Wand', Staves: 'Staff', Sceptres: 'Sceptre', Quarterstaves: 'Warstaff', Bows: 'Bow', Crossbows: 'Crossbow', Spears: 'Spear',
  'One Hand Maces': 'One Hand Mace', 'Two Hand Maces': 'Two Hand Mace', Talismans: 'Talisman', Flails: 'Flail', Daggers: 'Dagger',
  Claws: 'Claw', 'One Hand Swords': 'One Hand Sword', 'Two Hand Swords': 'Two Hand Sword', 'One Hand Axes': 'One Hand Axe',
  'Two Hand Axes': 'Two Hand Axe' };
const canRoll = (m, tags) => { for (const w of m.spawn_weights || []) if (tags.includes(w.tag)) return w.weight > 0; return false; };
function classPool(cls, mods, bases) {
  const tagSets = Object.values(bases).filter((b) => b.item_class === REPOE_CLASS[cls] && b.release_state === 'released').map((b) => b.tags || []);
  const byKey = new Map(), byName = new Map(), types = new Set();
  for (const m of Object.values(mods)) {
    if (!['prefix', 'suffix'].includes(m.generation_type) || !m.name) continue;
    if (!['item', 'misc'].includes(m.domain) || !tagSets.some((tags) => canRoll(m, tags))) continue;
    types.add(m.type);
    byKey.set(`${m.name}|${m.generation_type}|${m.required_level}`, m.type);
    if (!byName.has(`${m.name}|${m.generation_type}`)) byName.set(`${m.name}|${m.generation_type}`, m.type);
  }
  return { byKey, byName, types };
}
// Починка собранного раньше: семейство, которое на этот класс выпасть не может (найдено по имени аффикса у мода
// другого класса), — на семейство класса с тем же именем, стороной и уровнем, если оно одно; иначе запись убираем.
function repairClass(c, pool, mods) {
  if (!pool.types.size) return { remapped: 0, dropped: 0 };
  const target = new Map(); // индекс неверного семейства → верное семейство | null
  c.types.forEach((type, i) => {
    if (pool.types.has(type)) return;
    const found = new Set();
    for (const m of Object.values(mods)) {
      if (m.type !== type || !m.name || !['prefix', 'suffix'].includes(m.generation_type)) continue;
      const t = pool.byKey.get(`${m.name}|${m.generation_type}|${m.required_level}`);
      if (t) found.add(t);
    }
    target.set(i, found.size === 1 ? [...found][0] : null);
  });
  if (!target.size) return { remapped: 0, dropped: 0 };
  const idx = new Map(c.types.map((tp, i) => [tp, i]));
  let remapped = 0, dropped = 0;
  c.raw = c.raw.map((row) => row.flatMap(([ti, tier]) => {
    if (!target.has(ti)) return [[ti, tier]];
    const to = target.get(ti);
    if (!to) { dropped++; return []; }
    if (!idx.has(to)) { idx.set(to, c.types.length); c.types.push(to); }
    remapped++;
    return [[idx.get(to), tier]];
  }));
  return { remapped, dropped };
}

// ---- хранилище: всё собранное за лигу, с id лотов (чтобы не считать один лот дважды) ----
const storeFile = (league) => path.join(STORE_DIR, `${league.replace(/[^\w-]+/g, '_')}.json`);
function loadStore(league) {
  try {
    const s = JSON.parse(fs.readFileSync(storeFile(league), 'utf8'));
    if (s.league === league) return s;
  } catch {}
  const store = { version: 1, league, started: new Date().toISOString(), classes: {} };
  // Первый запуск — начинаем с уже собранного data/weights.json той же лиги (у тех лотов id не сохранены).
  try {
    const w = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    if (w.meta && w.meta.league === league && w.meta.version === VERSION) {
      for (const [cls, c] of Object.entries(w.classes || {})) {
        store.classes[cls] = { items: c.items, unmatched: c.unmatched || 0, types: c.types || [], raw: c.raw || [], ids: [] };
      }
      store.started = w.meta.collected || store.started;
      say(`Started from ${path.basename(OUT)} (${Object.values(store.classes).reduce((a, c) => a + c.items, 0)} items)`);
    }
  } catch {}
  return store;
}
// data/weights.json для программы — из хранилища (без id).
function buildOut(store) {
  const classes = {};
  for (const [cls, c] of Object.entries(store.classes)) if (c.items) classes[cls] = { items: c.items, unmatched: c.unmatched, types: c.types, raw: c.raw, done: true };
  writeJson(OUT, { meta: { version: VERSION, league: store.league, collected: new Date().toISOString().slice(0, 10), started: store.started.slice(0, 10),
    method: `rare uncorrupted listings up to ${PRICE_MAX} ex, newest first, ilvl 75+, accumulated`,
    note: 'Estimated from trade listings — not game data. Rare modifiers are underestimated.' }, classes });
}

async function main() {
  const league = arg('league', 'Forbidden Rites');
  const only = arg('classes', '') ? arg('classes').split(',').map((s) => s.trim()) : null;
  const once = flag('once');
  const max = Number(arg('max', 0));
  const L = encodeURIComponent(league);
  if (IDLE_MS && idleMs() === Infinity) say('Cannot read keyboard / mouse activity (no koffi) — collecting without pauses');

  // RePoE: имя аффикса + сторона + уровень → семейство мода (type) — только среди модов, которые могут выпасть на этот
  // класс: одно имя бывает у модов разных классов («Humming» — и молния на оружии, и молния союзников на скипетре).
  say('Loading RePoE mods and bases…');
  const [mods, bases] = await Promise.all([
    fetch('https://repoe-fork.github.io/poe2/mods.min.json').then((r) => r.json()),
    fetch('https://repoe-fork.github.io/poe2/base_items.min.json').then((r) => r.json()),
  ]);
  const pools = new Map();
  const poolOf = (cls) => {
    if (!pools.has(cls)) pools.set(cls, classPool(cls, mods, bases));
    return pools.get(cls);
  };

  const store = loadStore(league);
  for (const [cls, c] of Object.entries(store.classes)) {
    const fixed = repairClass(c, poolOf(cls), mods);
    if (fixed.remapped || fixed.dropped) say(`${cls}: fixed ${fixed.remapped} entries mapped to another class's modifier, dropped ${fixed.dropped} ambiguous`);
  }
  const save = () => { store.updated = new Date().toISOString(); writeJson(storeFile(league), store); buildOut(store); };
  // Ctrl+C / закрытие окна — сохранить собранное и выйти.
  let stopping = false;
  const stop = () => { if (stopping) return; stopping = true; save(); say('Stopped, saved.'); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGBREAK', stop);

  say(`League ${league}; ${IDLE_MS ? `collecting while idle ${IDLE_MS / 60000}+ min` : 'collecting without pauses'}; Ctrl+C to stop`);
  for (let round = 1; ; round++) {
    let added = 0;
    for (const [cls, category] of Object.entries(CLASSES)) {
      if (only && !only.includes(cls)) continue;
      const c = store.classes[cls] || (store.classes[cls] = { items: 0, unmatched: 0, types: [], raw: [], ids: [] });
      // Классы, которых на трейде нет (ещё не в игре), — проверяем раз в 6 кругов.
      if ((c.emptyRounds || 0) >= 2 && round % 6) continue;
      const seen = new Set(c.ids);
      const typeIdx = new Map(c.types.map((tp, i) => [tp, i]));
      const pool = poolOf(cls);
      const before = c.items;
      for (const w of WINDOWS) {
        if (max && c.items - before >= max) break;
        const query = { query: { status: { option: 'available' }, filters: {
          type_filters: { filters: { category: { option: category }, rarity: { option: 'rare' }, ilvl: w } },
          misc_filters: { filters: { corrupted: { option: 'false' } } },
          trade_filters: { filters: { price: { max: PRICE_MAX } } },
        } }, sort: { indexed: 'desc' } };
        const s = await call('search', `${TRADE}/api/trade2/search/poe2/${L}`, query);
        const ids = (s.result || []).filter((id) => !seen.has(id));
        // Ход работы — после каждого поиска и раз в 5 выборок: иначе на первом круге класс молчит по 10 минут.
        const label = `${cls}, ilvl ${w.min}${w.max ? `–${w.max}` : '+'}`;
        say(`${label}: ${ids.length} new listings${ids.length ? ` — reading (~${Math.ceil(ids.length / 10 * MIN_GAP.fetch / 60000)} min)` : ''}`);
        for (let i = 0; i < ids.length && !(max && c.items - before >= max); i += 10) {
          const batch = ids.slice(i, i + 10);
          if (i && i % 50 === 0) say(`  ${label}: ${i} / ${ids.length} read`);
          const fr = await call('fetch', `${TRADE}/api/trade2/fetch/${batch.join(',')}?query=${s.id}`);
          for (const r of fr.result || []) {
            if (!r || !r.item) continue;
            seen.add(r.id);
            c.ids.push(r.id);
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
            const row = [];
            for (const a of affixes.values()) {
              const type = pool.byKey.get(`${a.name}|${a.side}|${a.level}`) || pool.byName.get(`${a.name}|${a.side}`);
              if (!type) { c.unmatched++; continue; }
              if (!typeIdx.has(type)) { typeIdx.set(type, c.types.length); c.types.push(type); }
              row.push([typeIdx.get(type), a.tier]);
            }
            c.raw.push(row);
          }
        }
      }
      c.emptyRounds = c.items ? 0 : (c.emptyRounds || 0) + 1;
      added += c.items - before;
      save();
      say(`${cls}: +${c.items - before} new, ${c.items} total`);
    }
    const total = Object.values(store.classes).reduce((a, c) => a + c.items, 0);
    say(`Round ${round} done: +${added} new items, ${total} in total — ${path.relative(path.join(__dirname, '..'), OUT)} updated`);
    if (once) break;
  }
}

main().catch((e) => { say(`STOPPED: ${e.message}`); process.exit(1); });
