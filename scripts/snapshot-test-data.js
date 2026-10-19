// Data snapshot for craft tests (test/fixtures/data/*.json.gz): RePoE (mods, bases, augments) and the trade reference
// from the app cache — only what the code reads, compressed. With it, craft tests run on any machine and in CI and don't
// "drift" with the weekly RePoE update. Update after a game patch (run the app first — it refreshes the cache):
//   node scripts/snapshot-test-data.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CACHE = path.join(process.env.APPDATA || '', 'PoE 2 Price Checker', 'data-cache');
const OUT = path.join(__dirname, '..', 'test', 'fixtures', 'data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8'));
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

const mods = read('repoe-mods.json');
const bases = read('repoe-base-items.json');
const augments = read('repoe-augments.json');
const stats = read('stats.json');

// Bases: items (item), jewels (misc) and what goes into sockets (augments reference them by id).
const keepBase = (id, b) => b.domain === 'item' || b.domain === 'misc' || augments[id];
const outBases = {};
for (const [id, b] of Object.entries(bases)) {
  if (keepBase(id, b)) outBases[id] = pick(b, ['name', 'tags', 'implicits', 'item_class', 'release_state', 'domain']);
}
// Mods: craft pool (item / misc / desecrated) and the implicits of the kept bases.
const implicitIds = new Set(Object.values(outBases).flatMap((b) => b.implicits || []));
const outMods = {};
for (const [id, m] of Object.entries(mods)) {
  if (!['item', 'misc', 'desecrated'].includes(m.domain) && !implicitIds.has(id)) continue;
  outMods[id] = pick(m, ['name', 'domain', 'generation_type', 'type', 'required_level', 'text', 'groups', 'adds_tags',
    'spawn_weights', 'is_essence_only', 'implicit_tags', 'stats']);
}
const outStats = { result: stats.result.map((g) => ({ id: g.id, label: g.label, entries: g.entries.map((e) => pick(e, ['id', 'text', 'type', 'option'])) })) };

fs.mkdirSync(OUT, { recursive: true });
for (const [name, data] of [['repoe-mods.json', outMods], ['repoe-base-items.json', outBases], ['repoe-augments.json', augments], ['stats.json', outStats]]) {
  const gz = zlib.gzipSync(JSON.stringify(data), { level: 9 });
  fs.writeFileSync(path.join(OUT, `${name}.gz`), gz);
  console.log(`${name}.gz — ${(gz.length / 1024).toFixed(0)} KB`);
}
