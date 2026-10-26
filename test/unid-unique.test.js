// Unidentified uniques: the game text has only the base, the name comes from the trade list of uniques on that base.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Module = require('module');

const orig = Module._load;
Module._load = function (r, ...a) { if (r === 'electron') return { net: { fetch }, app: { getPath: () => require('os').tmpdir() } }; return orig.call(this, r, ...a); };

const STATS = path.join(__dirname, 'fixtures', 'data', 'stats.json.gz');
const skip = fs.existsSync(STATS) ? false : 'no stats data';

let pricing, parseItem;
async function init() {
  if (pricing) return;
  const api = require('../src/main/api');
  // Trade data as /api/trade2/data/items gives it: bases without a name, uniques with one.
  api.tradeStats = async () => JSON.parse(zlib.gunzipSync(fs.readFileSync(STATS)).toString('utf8'));
  api.tradeStatic = async () => ({ result: [] });
  api.tradeItems = async () => ({ result: [{ id: 'jewel', entries: [
    { type: 'Sapphire' }, { type: 'Emerald' }, { type: 'Ruby' },
    { type: 'Sapphire', name: 'Grand Spectrum', flags: { unique: true } },
    { type: 'Sapphire', name: 'Voices', flags: { unique: true } },
    { type: 'Emerald', name: 'Grand Spectrum', flags: { unique: true } },
  ] }] });
  pricing = require('../src/main/pricing');
  await pricing.init();
  ({ parseItem } = require('../src/main/parser'));
}
const unid = (base) => parseItem(['Item Class: Jewels', 'Rarity: Unique', base, '--------', 'Item Level: 80', '--------', 'Unidentified'].join('\n'));

test('unidentified unique, one unique on the base: named and searched by name among unidentified', { skip }, async () => {
  await init();
  const it = unid('Emerald');
  pricing.nameUnidUnique(it);
  assert.equal(it.name, 'Grand Spectrum');
  const { filters } = pricing.prepare(it, null, () => true);
  assert.ok(filters.useName);
  assert.ok(filters.flags.find((x) => x.key === 'identified' && x.enabled && x.value === false));
});

test('unidentified unique, several uniques on the base: the choice is offered, no name until picked', { skip }, async () => {
  await init();
  const it = unid('Sapphire');
  pricing.nameUnidUnique(it);
  assert.equal(it.name, '');
  assert.deepEqual(it.uniqueOptions, ['Grand Spectrum', 'Voices']);
  assert.equal(pricing.prepare(it, null, () => true).filters.useName, false);
});

test('identified unique keeps its own name', { skip }, async () => {
  await init();
  const it = parseItem(['Item Class: Jewels', 'Rarity: Unique', 'Grand Spectrum', 'Sapphire', '--------', 'Item Level: 80'].join('\n'));
  pricing.nameUnidUnique(it);
  assert.equal(it.name, 'Grand Spectrum');
  assert.equal(it.uniqueOptions, undefined);
});
