// Snapshot of poe.ninja demand and currency prices for the craft control scenarios (test/fixtures/craft/*.json).
// Scenarios are items the advice got wrong; the tests (test/craft.test.js) check plan properties on these snapshots
// so the result doesn't depend on today's market. Update snapshots only deliberately (after a patch / league change):
//   node scripts/snapshot-craft-fixtures.js            (everything)
//   node scripts/snapshot-craft-fixtures.js --prices   (only currency prices and categories)
const fs = require('fs');
const path = require('path');
const Module = require('module');
const orig = Module._load;
Module._load = function (r, ...a) { if (r === 'electron') return { net: { fetch }, app: { getPath: () => process.env.TEMP } }; return orig.call(this, r, ...a); };
const nb = require('../src/main/ninjaBuilds');

const DIR = path.join(__dirname, '..', 'test', 'fixtures', 'craft');
const fb = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': 'poe2-price-checker' } }); if (!r.ok) throw new Error(`${u} ${r.status}`); return Buffer.from(await r.arrayBuffer()); };

// item — a file with the item text in the same folder; theme — demand theme mods (as in the window); class — the poe.ninja class.
const SCENARIOS = [
  { name: 'sceptre-minion', class: 'Sceptres', theme: ['58% increased Spirit', 'Allies in your Presence deal 81% increased Damage'] },
  { name: 'tiara-minion', class: 'Helmets', theme: ['+2 to Level of all Minion Skills'] },
  { name: 'boots-no-ms', class: 'Boots', theme: [] },
  { name: 'wand-open-prefixes', class: 'Wands', theme: ['100% increased Spell Damage', '+4 to Level of all Cold Spell Skills'] },
  { name: 'spear-rare-destruction', class: 'Spears', theme: [] },
  { name: 'spear-magic', class: 'Spears', theme: [] },
  { name: 'mantle-desecrated', class: 'Body Armours', theme: [] },
  { name: 'ring-minion', class: 'Rings', theme: [] },
  { name: 'boots-es', class: 'Boots', theme: [] },
  { name: 'wand-magic-levels', class: 'Wands', theme: [] },
  { name: 'staff-cold', class: 'Staves', theme: [] },
];
const UNIQUES = ['Heart of the Well'];
const PRICE_TYPES = ['Currency', 'Ritual', 'Abyss', 'Essences', 'Runes', 'Verisium', 'Delirium', 'Breach', 'SoulCores'];

(async () => {
  const leagues = await (await fetch('https://www.pathofexile.com/api/trade2/data/leagues', { headers: { 'User-Agent': 'poe2-price-checker' } })).json();
  const league = leagues.result[0].id;
  // --prices — prices only (demand snapshots are left alone)
  for (const s of process.argv.includes('--prices') ? [] : SCENARIOS) {
    const d = await nb.categoryDemand({ itemClass: s.class, rarity: 'Rare', limit: 80, minLevel: 95, withMods: s.theme }, fb);
    fs.writeFileSync(path.join(DIR, `${s.name}.demand.json`), JSON.stringify({ league: d.league, class: s.class, themed: d.themed, mods: d.mods, bases: d.bases }, null, 1));
    console.log(s.name, d.mods.length, 'mods', d.themed);
  }
  for (const u of process.argv.includes('--prices') ? [] : UNIQUES) {
    const b = await nb.popularBuilds({ uniqueName: u, limit: 1, minLevel: 95 }, fb);
    fs.writeFileSync(path.join(DIR, `unique-${u.toLowerCase().replace(/\W+/g, '-')}.demand.json`), JSON.stringify({ mods: b.mods }, null, 1));
  }
  const prices = {};
  const categories = {}; // name → poe.ninja category (for auditing the craft method registry)
  for (const t of PRICE_TYPES) {
    const d = await (await fetch(`https://poe.ninja/poe2/api/economy/exchange/current/overview?league=${encodeURIComponent(league)}&type=${t}`)).json();
    const names = new Map((d.items || []).map((i) => [i.id, i.name]));
    if (d.core) for (const i of d.core.items || []) names.set(i.id, i.name);
    for (const l of d.lines) if (names.get(l.id)) { prices[names.get(l.id)] = l.primaryValue; categories[names.get(l.id)] = t; }
  }
  fs.writeFileSync(path.join(DIR, 'prices.json'), JSON.stringify({ league, at: new Date().toISOString().slice(0, 10), prices, categories }, null, 1));
  console.log('prices', Object.keys(prices).length);
})().catch((e) => { console.error(e); process.exit(1); });
