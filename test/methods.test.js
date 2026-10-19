// Audit of the craft method registry (src/shared/methods.js) against everything sold on poe.ninja (snapshot
// test/fixtures/craft/prices.json, categories Currency / Ritual / Abyss / Essences / Runes / Verisium / Delirium /
// Breach / SoulCores). A new currency without a registry entry fails the test: a gap in the advice must show up at once.
const test = require('node:test');
const assert = require('node:assert');
const methods = require('../src/shared/methods');
const { categories } = require('./fixtures/craft/prices.json');

test('every currency / omen / rune on poe.ninja is in the craft method registry', () => {
  const missing = Object.keys(categories).filter((n) => !methods.byName(n));
  assert.deepEqual(missing, [], `not in the registry: ${missing.join(', ')}`);
});

test('known gaps (model: gap) — a list to track progress', (t) => {
  const gaps = {};
  for (const n of Object.keys(categories)) {
    const m = methods.byName(n);
    if (m && m.model === 'gap') (gaps[m.id] = gaps[m.id] || []).push(n);
  }
  for (const [id, list] of Object.entries(gaps)) t.diagnostic(`gap ${id}: ${list.length} (${list.slice(0, 4).join(', ')}${list.length > 4 ? ', …' : ''})`);
  assert.ok(true);
});

test('tiered methods: names match poe.ninja prices, levels increase', () => {
  for (const m of methods.METHODS.filter((x) => x.tiers)) {
    for (const [name] of m.tiers) assert.ok(categories[name], `${m.id}: "${name}" is not on poe.ninja`);
    const lv = m.tiers.map(([, l]) => l);
    assert.deepEqual(lv, [...lv].sort((a, b) => a - b), `${m.id}: levels in ascending order`);
  }
});
