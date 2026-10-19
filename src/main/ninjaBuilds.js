// poe.ninja: which builds (class + main skill) wear an item.
// The API is undocumented, the schema was taken from the site's JS bundle (poe.ninja/poe2/builds):
//   GET /poe2/api/builds/<version>/search?<filters>&overview=<snapshotName>  → protobuf NinjaSearchResult
//   GET /poe2/api/builds/dictionary/<hash>                                   → NDIC / NOVL (strings for keys)
// A filter is a parameter with a dimension id (items, class, skills, itemmods-Helmet, ...) and a string value.
// A repeated parameter = AND, a "!" prefix = exclude. The server silently ignores unknown values,
// so everything we pass is checked against the dictionaries, and whatever is missing there is returned in ignored.
// The network is injected from outside: fetchBuffer(url) → Buffer (in the app — Electron net, in a script — fetch).

const NINJA = 'https://poe.ninja/poe2/api';
const SEARCH_TTL = 30 * 60e3; // the server itself sends max-age=1800
const INDEX_TTL = 30 * 60e3;

// ---------- protobuf ----------
// varint and length-delimited are enough; fixed64/fixed32 (doubles in histograms) are just skipped.
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

// NinjaSearchResult { 1: SearchResult }. Take only what's needed: total, dimensions with counts, dictionary references.
function decodeSearch(buf) {
  const r = readFields(first(readFields(buf), 1, Buffer.alloc(0)));
  const dimensions = all(r, 2).map((d) => {
    const f = readFields(d);
    return {
      id: str(first(f, 1, '')),
      dictionaryId: str(first(f, 2, '')),
      // key = string index in the dictionary; protobuf doesn't write zero fields, hence the defaults
      counts: all(f, 3).map((c) => { const cf = readFields(c); return { key: first(cf, 1, 0), count: first(cf, 2, 0) }; }),
    };
  });
  const dictionaries = all(r, 6).map((d) => {
    const f = readFields(d);
    return { id: str(first(f, 1, '')), hash: str(first(f, 2, '')), propertiesHash: str(first(f, 3, '')) };
  });
  return { total: first(r, 1, 0), dimensions, dictionaries };
}

// ---------- dictionaries ----------
// NDIC v2: 'NDIC', u32 version, u32 —, u32 string count, u64 xxhash64 (from byte 24), u32 —, u32 sync-table entries,
// u32 length-block size; from byte 36: sync table (8 bytes per entry), then varint lengths, then the strings back to back.
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

// NOVL v1 — dictionary properties (for items: type = Helmet/Weapon/..., color = rarity of pseudo-items "Rare Helmet").
// 'NOVL', u32 version, u32 —, u32 property count, u32 value count, u64 hash; then u32-length strings
// (id, valuesHash), then for each property: name, a table of n+1 u32 offsets and the strings themselves.
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

// In case the server sends the dictionary not in the "native" form but as a protobuf message (the site handles both).
function decodeDictPb(b) { return all(readFields(b), 2).map(str); }
function decodePropsPb(b) {
  const props = {};
  for (const p of all(readFields(b), 3)) { const f = readFields(p); props[str(first(f, 1, ''))] = all(f, 2).map(str); }
  return props;
}

// ---------- cache ----------
const dictCache = new Map(); // hash → values | props; dictionaries are immutable (immutable, max-age one year)
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

// Search response + expanded dictionaries: dims[id] = [{ name, count }] (descending), props[dictId] = properties.
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

// ---------- matching our names to ninja ----------
// "+45 to maximum Life" → "# to maximum Life": in the mod dictionary numbers are replaced with # and pluses removed.
function modTemplate(text) {
  return String(text)
    .replace(/\s*\((implicit|enchant|rune|crafted|fractured|desecrated|augmented)\)\s*$/i, '')
    .replace(/\(\s*[-+]?\d+(\.\d+)?\s*-\s*[-+]?\d+(\.\d+)?\s*\)/g, '#')
    .replace(/[-+]?\d+(\.\d+)?/g, '#')
    .replace(/\s+/g, ' ').trim();
}

// Item class from the clipboard ("Body Armours", "One Hand Maces", "Quarterstaves", "Foci") → "Rare Body Armour" etc.
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

// Subsection by parent: the dictionary type is "Body Armour", and the subsection is "itembasetypes-BodyArmour" (no spaces).
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
//   league      — url ("forbiddenrites") or league name ("Forbidden Rites"); default — current (first in index-state)
//   uniqueName  — unique item by name
//   itemClass + rarity ('Rare' | 'Magic' | 'Normal') — pseudo-item "Rare Helmet" (all rare helmets)
//   baseType    — base (works together with itemClass: subsection itembasetypes-<type>)
//   mods        — mod lines (as in game or already a template with #); all must be on the item (AND)
//   filters     — raw [[dimensionId, value], ...] for anything else (class, skills, keypassives, min-level ...)
//   timeMachine — 'day-1', 'week-2', etc. from snapshotVersions[].timeMachineLabels
//   limit       — how many class/skill rows to return
async function popularBuilds(opts, fetchBuffer) {
  const { league, uniqueName, itemClass, rarity = 'Rare', baseType, mods = [], filters = [], timeMachine, limit = 10, minLevel } = opts || {};
  const snap = await snapshot(league, fetchBuffer);
  const ignored = [];
  const lvl = levelParams(minLevel);
  const params = [...lvl];

  // The items dictionary is needed to check the unique name and find "Rare <class>"; the first search without filters
  // provides it, and it's also cached and comes in handy as "all builds".
  const needItems = uniqueName || itemClass;
  const base = needItems ? await search(snap, lvl, timeMachine, fetchBuffer) : null;
  const itemNames = base ? base.values.item || [] : [];
  const itemProps = base ? base.props.item || {} : {};

  let parentKey = null; // what the mods subsection is built from: unique name or type (Helmet, Weapon, ...)
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

  // Bases and mods: the itembasetypes/itemmods dictionaries come only in a response with a selected item,
  // so first we ask without them (also a useful cache), then check and add them.
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
    // poe.ninja page with the same filters — to open in a browser
    page: `https://poe.ninja/poe2/builds/${snap.url}?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`,
    filters: params,
    ignored,
    total: res.total,
    // class — ascendancy (or base class if none chosen); skills — main skills, a build may have several
    classes: top(res.dims.class || [], res.total, limit),
    skills: top(res.dims.skills || [], res.total, limit),
    // For a unique — which of its mods are worn (important for uniques with random mods: Heart of the Well, Megalomaniac…)
    mods: uniqueName && parentKey ? top(res.dims[subKey(res.dims, 'itemmods', parentKey)] || [], res.total, 40) : [],
    allTotal: base ? base.total : null,
  };
}

// Demand by category: which bases and mods are worn on rare (magic…) items of this class.
// A single "Rare Helmet" filter — the response contains itembasetypes-<type> and itemmods-<type> subsections with counts.
async function categoryDemand(opts, fetchBuffer) {
  // withMods — the item's mods: demand is counted among builds that wear such an item WITH THESE mods
  // (item theme: minions, spells…). Too few such builds (< minBuilds) — fall back to the general demand for the class.
  // withBase — only builds that wear this base (Time-Lost: their mods exist only on radius jewels, while the general demand
  // for the "Rare Jewel" class dilutes their share with all jewels).
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
  let onBase = null; // narrowed to builds with this base
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
    themed, // which mods it was narrowed by (empty — general demand for the class)
    onBase, // which base it was narrowed by (jewels), null — the whole class
    total: res.total,
    allTotal: base.total,
    bases: top(res.dims[subKey(res.dims, 'itembasetypes', type)] || [], res.total, limit),
    mods: top(res.dims[subKey(res.dims, 'itemmods', type)] || [], res.total, limit),
    page,
  };
}

// Only characters from this level: at 90+ items are bought for exact mods — demand is "more premium" than among levelers.
function levelParams(minLevel) {
  return minLevel ? [['min-level', String(minLevel)]] : [];
}

module.exports = { popularBuilds, categoryDemand };
