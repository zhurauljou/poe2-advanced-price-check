// poe.ninja: какие билды (класс + главный скилл) носят предмет.
// API недокументированное, схема снята с JS-бандла сайта (poe.ninja/poe2/builds):
//   GET /poe2/api/builds/<version>/search?<фильтры>&overview=<snapshotName>  → protobuf NinjaSearchResult
//   GET /poe2/api/builds/dictionary/<hash>                                   → NDIC / NOVL (строки для ключей)
// Фильтр — это параметр с id измерения (items, class, skills, itemmods-Helmet, ...) и значением-строкой.
// Повтор параметра = И, префикс «!» = исключить. Неизвестное значение сервер молча игнорирует,
// поэтому всё, что передаём, сверяем со словарями и возвращаем в ignored то, чего там нет.
// Сеть подставляется снаружи: fetchBuffer(url) → Buffer (в приложении — Electron net, в скрипте — fetch).

const NINJA = 'https://poe.ninja/poe2/api';
const SEARCH_TTL = 30 * 60e3; // сервер сам отдаёт max-age=1800
const INDEX_TTL = 30 * 60e3;

// ---------- protobuf ----------
// Хватает varint и length-delimited; fixed64/fixed32 (double в гистограммах) просто пропускаем.
function readFields(buf) {
  const out = [];
  let p = 0;
  const varint = () => {
    let v = 0, mul = 1, b;
    do { b = buf[p++]; v += (b & 127) * mul; mul *= 128; } while (b & 128);
    return v;
  };
  while (p < buf.length) {
    const tag = varint();
    const no = Math.floor(tag / 8), wire = tag & 7;
    if (wire === 0) out.push([no, varint()]);
    else if (wire === 2) { const len = varint(); out.push([no, buf.subarray(p, p + len)]); p += len; }
    else if (wire === 1) p += 8;
    else if (wire === 5) p += 4;
    else throw new Error('poe.ninja: unexpected protobuf wire type ' + wire);
  }
  return out;
}
const str = (v) => Buffer.from(v).toString('utf8');
const first = (fields, no, def) => { const f = fields.find((x) => x[0] === no); return f ? f[1] : def; };
const all = (fields, no) => fields.filter((x) => x[0] === no).map((x) => x[1]);

// NinjaSearchResult { 1: SearchResult }. Берём только нужное: total, измерения со счётчиками, ссылки на словари.
function decodeSearch(buf) {
  const r = readFields(first(readFields(buf), 1, Buffer.alloc(0)));
  const dimensions = all(r, 2).map((d) => {
    const f = readFields(d);
    return {
      id: str(first(f, 1, '')),
      dictionaryId: str(first(f, 2, '')),
      // ключ = индекс строки в словаре; нулевые поля protobuf не пишет, отсюда дефолты
      counts: all(f, 3).map((c) => { const cf = readFields(c); return { key: first(cf, 1, 0), count: first(cf, 2, 0) }; }),
    };
  });
  const dictionaries = all(r, 6).map((d) => {
    const f = readFields(d);
    return { id: str(first(f, 1, '')), hash: str(first(f, 2, '')), propertiesHash: str(first(f, 3, '')) };
  });
  return { total: first(r, 1, 0), dimensions, dictionaries };
}

// ---------- словари ----------
// NDIC v2: 'NDIC', u32 версия, u32 —, u32 число строк, u64 xxhash64 (от байта 24), u32 —, u32 записей sync-таблицы,
// u32 длина блока длин; с байта 36: sync-таблица (8 байт на запись), затем varint-длины, затем строки подряд.
function decodeNdic(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const version = dv.getUint32(4, true);
  if (version !== 2) throw new Error('poe.ninja: NDIC version ' + version);
  const count = dv.getUint32(12, true);
  let lp = 36 + dv.getUint32(28, true) * 8;
  let sp = lp + dv.getUint32(32, true);
  const values = [];
  for (let i = 0; i < count; i++) {
    let len = 0, shift = 0, x;
    do { x = b[lp++]; len |= (x & 127) << shift; shift += 7; } while (x & 128);
    values.push(b.toString('utf8', sp, sp + len));
    sp += len;
  }
  return values;
}

// NOVL v1 — свойства словаря (у items: type = Helmet/Weapon/..., color = редкость псевдо-предметов «Rare Helmet»).
// 'NOVL', u32 версия, u32 —, u32 число свойств, u32 число значений, u64 хэш; дальше строки с u32-длиной
// (id, valuesHash), затем на каждое свойство: имя, таблица из n+1 u32-смещений и сами строки.
function decodeNovl(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const nProps = dv.getUint32(12, true), nValues = dv.getUint32(16, true);
  let p = 28;
  const s = () => { const n = dv.getUint32(p, true); p += 4; const v = b.toString('utf8', p, p + n); p += n; return v; };
  s(); s();
  const props = {};
  for (let k = 0; k < nProps; k++) {
    const name = s();
    const tbl = p, base = tbl + (nValues + 1) * 4;
    const off = (i) => dv.getUint32(tbl + i * 4, true);
    const vals = [];
    for (let i = 0; i < nValues; i++) vals.push(b.toString('utf8', base + off(i), base + off(i + 1)));
    p = base + off(nValues);
    props[name] = vals;
  }
  return props;
}

// На случай, если сервер отдаст словарь не в «нативном» виде, а protobuf-сообщением (сайт умеет оба).
function decodeDictPb(b) { return all(readFields(b), 2).map(str); }
function decodePropsPb(b) {
  const props = {};
  for (const p of all(readFields(b), 3)) { const f = readFields(p); props[str(first(f, 1, ''))] = all(f, 2).map(str); }
  return props;
}

// ---------- кэш ----------
const dictCache = new Map(); // hash → values | props; словари неизменяемые (immutable, max-age год)
const searchCache = new Map(); // url → { at, data }
let indexCache = null;

async function getDict(hash, fetchBuffer, props) {
  if (!hash) return props ? {} : [];
  if (!dictCache.has(hash)) {
    const b = Buffer.from(await fetchBuffer(`${NINJA}/builds/dictionary/${hash}`));
    const magic = b.toString('latin1', 0, 4);
    const v = props ? (magic === 'NOVL' ? decodeNovl(b) : decodePropsPb(b))
      : (magic === 'NDIC' ? decodeNdic(b) : decodeDictPb(b));
    dictCache.set(hash, v);
  }
  return dictCache.get(hash);
}

async function snapshot(league, fetchBuffer) {
  if (!indexCache || Date.now() - indexCache.at > INDEX_TTL) {
    const d = JSON.parse(Buffer.from(await fetchBuffer(`${NINJA}/data/index-state`)).toString('utf8'));
    indexCache = { at: Date.now(), list: d.snapshotVersions || [] };
  }
  const list = indexCache.list;
  if (!list.length) throw new Error('poe.ninja: no build snapshots');
  if (!league) return list[0];
  const l = String(league).toLowerCase();
  const s = list.find((x) => x.url.toLowerCase() === l || x.name.toLowerCase() === l || x.snapshotName === l);
  if (!s) throw new Error('poe.ninja has no builds for league ' + league);
  return s;
}

// Ответ поиска + раскрытые словари: dims[id] = [{ name, count }] (по убыванию), props[dictId] = свойства.
async function search(snap, params, timeMachine, fetchBuffer) {
  const q = new URLSearchParams();
  for (const [k, v] of params) q.append(k, v);
  q.append('overview', snap.snapshotName);
  if (timeMachine) q.append('timemachine', timeMachine);
  const url = `${NINJA}/builds/${encodeURIComponent(snap.version)}/search?${q}`;
  const hit = searchCache.get(url);
  if (hit && Date.now() - hit.at < SEARCH_TTL) return hit.data;

  const res = decodeSearch(Buffer.from(await fetchBuffer(url)));
  const values = {}, props = {};
  await Promise.all(res.dictionaries.map(async (d) => {
    values[d.id] = await getDict(d.hash, fetchBuffer, false);
    props[d.id] = await getDict(d.propertiesHash, fetchBuffer, true);
  }));
  const dims = {};
  for (const d of res.dimensions) {
    const names = values[d.dictionaryId] || [];
    dims[d.id] = d.counts.map((c) => ({ name: names[c.key], count: c.count }))
      .filter((x) => x.name != null).sort((a, b) => b.count - a.count);
  }
  const data = { url, total: res.total, dims, values, props };
  if (searchCache.size > 200) searchCache.clear();
  searchCache.set(url, { at: Date.now(), data });
  return data;
}

// ---------- сопоставление наших названий с ninja ----------
// «+45 to maximum Life» → «# to maximum Life»: в словаре модов числа заменены на #, плюсы убраны.
function modTemplate(text) {
  return String(text)
    .replace(/\s*\((implicit|enchant|rune|crafted|fractured|desecrated|augmented)\)\s*$/i, '')
    .replace(/\(\s*[-+]?\d+(\.\d+)?\s*-\s*[-+]?\d+(\.\d+)?\s*\)/g, '#')
    .replace(/[-+]?\d+(\.\d+)?/g, '#')
    .replace(/\s+/g, ' ').trim();
}

// Класс предмета из буфера обмена («Body Armours», «One Hand Maces», «Quarterstaves», «Foci») → «Rare Body Armour» и т.п.
const normClass = (s) => s.toLowerCase()
  .replace(/one hand(ed)?/, 'onehanded').replace(/two hand(ed)?/, 'twohanded')
  .replace(/staves$/, 'staff').replace(/foci$/, 'focus').replace(/[^a-z]/g, '').replace(/s$/, '');

function categoryKey(itemNames, rarity, itemClass) {
  const prefix = `${rarity} `;
  const want = normClass(itemClass);
  const cands = itemNames.filter((n) => n.startsWith(prefix));
  return cands.find((n) => normClass(n.slice(prefix.length)) === want)
    || cands.find((n) => want.endsWith(normClass(n.slice(prefix.length))))
    || null;
}

const findCi = (list, name) => {
  const l = String(name).toLowerCase();
  return (list || []).find((x) => x.toLowerCase() === l) || null;
};

// Подраздел по родителю: в словаре тип «Body Armour», а подраздел — «itembasetypes-BodyArmour» (без пробелов).
function subKey(dims, kind, parent) {
  if (!parent) return null;
  const exact = `${kind}-${parent}`;
  const tight = `${kind}-${String(parent).replace(/\s+/g, '')}`;
  return dims[exact] ? exact : dims[tight] ? tight : null;
}

function top(rows, total, n) {
  return rows.slice(0, n).map((r) => ({ name: r.name, count: r.count, pct: total ? Math.round(r.count / total * 1000) / 10 : 0 }));
}

// opts:
//   league      — url («forbiddenrites») или имя лиги («Forbidden Rites»); по умолчанию — текущая (первая в index-state)
//   uniqueName  — уникальный предмет по имени
//   itemClass + rarity ('Rare' | 'Magic' | 'Normal') — псевдо-предмет «Rare Helmet» (все редкие шлемы)
//   baseType    — база (работает вместе с itemClass: подраздел itembasetypes-<тип>)
//   mods        — строки модов (как в игре или уже шаблоном с #); все должны быть на предмете (И)
//   filters     — сырые [[dimensionId, value], ...] для чего угодно ещё (class, skills, keypassives, min-level ...)
//   timeMachine — 'day-1', 'week-2' и т.п. из snapshotVersions[].timeMachineLabels
//   limit       — сколько строк классов/скиллов вернуть
async function popularBuilds(opts, fetchBuffer) {
  const { league, uniqueName, itemClass, rarity = 'Rare', baseType, mods = [], filters = [], timeMachine, limit = 10, minLevel } = opts || {};
  const snap = await snapshot(league, fetchBuffer);
  const ignored = [];
  const lvl = levelParams(minLevel);
  const params = [...lvl];

  // Нужен словарь items, чтобы проверить имя уника и найти «Rare <класс>»; первый поиск без фильтров
  // его даёт, а заодно кэшируется и пригодится как «все билды».
  const needItems = uniqueName || itemClass;
  const base = needItems ? await search(snap, lvl, timeMachine, fetchBuffer) : null;
  const itemNames = base ? base.values.item || [] : [];
  const itemProps = base ? base.props.item || {} : {};

  let parentKey = null; // от чего строится подраздел модов: имя уника или тип (Helmet, Weapon, ...)
  if (uniqueName) {
    const name = findCi(itemNames, uniqueName);
    if (name) { params.push(['items', name]); parentKey = name; } else ignored.push({ items: uniqueName });
  } else if (itemClass) {
    const cat = categoryKey(itemNames, rarity, itemClass);
    if (cat) {
      params.push(['items', cat]);
      parentKey = (itemProps.type || [])[itemNames.indexOf(cat)] || null;
    } else ignored.push({ items: `${rarity} ${itemClass}` });
  }

  // Базы и моды: словари itembasetypes/itemmods приходят только в ответе с выбранным предметом,
  // поэтому сначала спрашиваем без них (тоже полезный кэш), потом сверяем и добавляем.
  if (parentKey && (baseType || mods.length)) {
    const pre = await search(snap, params, timeMachine, fetchBuffer);
    const baseKey = subKey(pre.dims, 'itembasetypes', parentKey);
    const modKey = subKey(pre.dims, 'itemmods', parentKey);
    if (baseType) {
      const b = findCi(pre.values.itembasetypes, baseType);
      if (b && baseKey) params.push([baseKey, b]);
      else ignored.push({ baseType });
    }
    const seen = new Set();
    for (const m of mods) {
      const t = findCi(pre.values.itemmods, modTemplate(m));
      if (t && modKey && !seen.has(t)) { params.push([modKey, t]); seen.add(t); }
      else if (!t || !modKey) ignored.push({ mod: m });
    }
  } else {
    if (baseType) ignored.push({ baseType });
    for (const m of mods) ignored.push({ mod: m });
  }

  for (const [k, v] of filters) params.push([k, v]);
  const res = await search(snap, params, timeMachine, fetchBuffer);
  return {
    league: snap.name,
    url: res.url,
    // страница poe.ninja с теми же фильтрами — открыть в браузере
    page: `https://poe.ninja/poe2/builds/${snap.url}?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`,
    filters: params,
    ignored,
    total: res.total,
    // class — ассенданси (или базовый класс, если не выбрано); skills — главные скиллы, у билда их бывает несколько
    classes: top(res.dims.class || [], res.total, limit),
    skills: top(res.dims.skills || [], res.total, limit),
    // У уника — какие его моды носят (важно для уников со случайными модами: Heart of the Well, Megalomaniac…)
    mods: uniqueName && parentKey ? top(res.dims[subKey(res.dims, 'itemmods', parentKey)] || [], res.total, 40) : [],
    allTotal: base ? base.total : null,
  };
}

// Спрос по категории: какие базы и моды носят на редких (магических…) вещах этого класса.
// Один фильтр «Rare Helmet» — в ответе приходят подразделы itembasetypes-<тип> и itemmods-<тип> со счётчиками.
async function categoryDemand(opts, fetchBuffer) {
  // withMods — моды предмета: спрос считаем среди билдов, которые носят такую вещь С ЭТИМИ модами
  // (тема вещи: миньоны, заклинания…). Мало таких билдов (< minBuilds) — откатываемся к общему спросу по классу.
  // withBase — только билды, которые носят эту базу (Time-Lost: их моды есть только у радиусных самоцветов, а общий спрос
  // по классу «Rare Jewel» размывает их долю всеми самоцветами).
  const { league, itemClass, rarity = 'Rare', limit = 12, timeMachine, withMods = [], withBase = null, minBuilds = 150, minLevel } = opts || {};
  const snap = await snapshot(league, fetchBuffer);
  const lvl = levelParams(minLevel);
  const base = await search(snap, lvl, timeMachine, fetchBuffer);
  const itemNames = base.values.item || [];
  const cat = categoryKey(itemNames, rarity, itemClass);
  if (!cat) return { league: snap.name, category: null, total: 0, bases: [], mods: [] };
  const type = ((base.props.item || {}).type || [])[itemNames.indexOf(cat)] || null;
  let res = await search(snap, [['items', cat], ...lvl], timeMachine, fetchBuffer);
  let themed = [];
  let onBase = null; // сузили до билдов с этой базой
  const baseKey = subKey(res.dims, 'itembasetypes', type);
  const scope = [['items', cat], ...lvl];
  if (withBase && baseKey) {
    const b = findCi(res.dims[baseKey].map((r) => r.name), withBase);
    if (b) {
      const narrow = await search(snap, [...scope, [baseKey, b]], timeMachine, fetchBuffer);
      if (narrow.total >= minBuilds) { res = narrow; onBase = b; scope.push([baseKey, b]); }
    }
  }
  const modKey = subKey(res.dims, 'itemmods', type);
  if (withMods.length && modKey) {
    const names = res.dims[modKey].map((r) => r.name);
    const params = [...scope];
    for (const m of withMods) {
      const t = findCi(names, modTemplate(m));
      if (t && !themed.includes(t)) { params.push([modKey, t]); themed.push(t); }
    }
    if (themed.length) {
      const narrow = await search(snap, params, timeMachine, fetchBuffer);
      if (narrow.total >= minBuilds) res = narrow; else themed = [];
    }
  }
  const page = `https://poe.ninja/poe2/builds/${snap.url}?items=${encodeURIComponent(cat)}${minLevel ? `&min-level=${minLevel}` : ''}`
    + (onBase ? `&${encodeURIComponent(baseKey)}=${encodeURIComponent(onBase)}` : '')
    + themed.map((t) => `&${encodeURIComponent(modKey)}=${encodeURIComponent(t)}`).join('');
  return {
    league: snap.name,
    category: cat,
    themed, // по каким модам сузили (пусто — общий спрос по классу)
    onBase, // по какой базе сузили (самоцветы), null — по всему классу
    total: res.total,
    allTotal: base.total,
    bases: top(res.dims[subKey(res.dims, 'itembasetypes', type)] || [], res.total, limit),
    mods: top(res.dims[subKey(res.dims, 'itemmods', type)] || [], res.total, limit),
    page,
  };
}

// Только персонажи от этого уровня: на 90+ вещи докупают ради точных модов — спрос «премиальнее», чем у тех, кто качается.
function levelParams(minLevel) {
  return minLevel ? [['min-level', String(minLevel)]] : [];
}

module.exports = { popularBuilds, categoryDemand };
