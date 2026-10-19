// Corruption mods (Vaal Orb) in the craft advice (data/gamble-currency.json — collected by hand) against game data: on every
// base of every class the window must show exactly the corruption mods that can roll on it (RePoE: generation_type
// corrupted, weights by base tags). Data is the test/fixtures/data snapshot (scripts/snapshot-test-data.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Module = require('module');

const orig = Module._load;
Module._load = function (r, ...a) { if (r === 'electron') return { net: { fetch }, app: { getPath: () => require('os').tmpdir() } }; return orig.call(this, r, ...a); };

const load = (n) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures', 'data', `${n}.gz`))).toString('utf8'));
// The game's "Item Class:" → item_class in RePoE.
const CLASS = { 'Body Armours': 'Body Armour', Helmets: 'Helmet', Gloves: 'Gloves', Boots: 'Boots', Shields: 'Shield', Bucklers: 'Buckler',
  Foci: 'Focus', Quivers: 'Quiver', Amulets: 'Amulet', Rings: 'Ring', Belts: 'Belt', Jewels: 'Jewel', Wands: 'Wand', Staves: 'Staff',
  Sceptres: 'Sceptre', Quarterstaves: 'Warstaff', Bows: 'Bow', Crossbows: 'Crossbow', Spears: 'Spear', 'One Hand Maces': 'One Hand Mace',
  'Two Hand Maces': 'Two Hand Mace', Talismans: 'Talisman' };
// Mod text without RePoE markup; "(20-10)% reduced" and "(10-20)% reduced" are the same thing.
const norm = (x) => String(x).replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1').replace(/–/g, '-').replace(/\n/g, ' / ')
  .replace(/\((\d+)-(\d+)\)% reduced/, (a, p, q) => `(${Math.min(p, q)}-${Math.max(p, q)})% reduced`);
const canRoll = (m, tags) => { for (const w of m.spawn_weights || []) if (tags.includes(w.tag)) return w.weight > 0; return false; };

test('corruption mods in the advice are exactly those that can roll on the base (every base of every class)', () => {
  const { gambleFor } = require('../src/main/craft');
  const mods = Object.values(load('repoe-mods.json')).filter((m) => m.generation_type === 'corrupted');
  const bases = Object.values(load('repoe-base-items.json'));
  const wrong = [];
  for (const [cls, ic] of Object.entries(CLASS)) {
    const list = bases.filter((b) => b.item_class === ic && b.release_state === 'released');
    assert.ok(list.length, `${cls}: no bases in the data`);
    for (const b of list) {
      const tags = b.tags || [];
      // Jewels have their own corruption mods (domain misc), everything else — domain item.
      const game = new Set(mods.filter((m) => (m.domain === 'misc') === (cls === 'Jewels') && canRoll(m, tags)).map((m) => norm(m.text)));
      const app = new Set(gambleFor({ rarity: 'Rare', itemClass: cls, quality: 0, ilvl: 80 }, tags).enchants.map(norm));
      const extra = [...app].filter((x) => !game.has(x));
      const missing = [...game].filter((x) => !app.has(x));
      if (extra.length || missing.length) wrong.push(`${cls} / ${b.name}: extra ${JSON.stringify(extra)}, missing ${JSON.stringify(missing)}`);
    }
  }
  assert.deepEqual([...new Set(wrong)], []);
});
