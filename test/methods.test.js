// Аудит реестра методов крафта (src/shared/methods.js) против всего, что продаётся на poe.ninja (снимок
// test/fixtures/craft/prices.json, категории Currency / Ritual / Abyss / Essences / Runes / Verisium / Delirium /
// Breach / SoulCores). Новая валюта без записи в реестре — тест падает: дыра в советах должна быть видна сразу.
const test = require('node:test');
const assert = require('node:assert');
const methods = require('../src/shared/methods');
const { categories } = require('./fixtures/craft/prices.json');

test('каждая валюта / омен / руна с poe.ninja есть в реестре методов крафта', () => {
  const missing = Object.keys(categories).filter((n) => !methods.byName(n));
  assert.deepEqual(missing, [], `нет в реестре: ${missing.join(', ')}`);
});

test('известные дыры (model: gap) — список, чтобы видеть прогресс', (t) => {
  const gaps = {};
  for (const n of Object.keys(categories)) {
    const m = methods.byName(n);
    if (m && m.model === 'gap') (gaps[m.id] = gaps[m.id] || []).push(n);
  }
  for (const [id, list] of Object.entries(gaps)) t.diagnostic(`gap ${id}: ${list.length} (${list.slice(0, 4).join(', ')}${list.length > 4 ? ', …' : ''})`);
  assert.ok(true);
});

test('методы с тирами: названия совпадают с ценами poe.ninja, уровни растут', () => {
  for (const m of methods.METHODS.filter((x) => x.tiers)) {
    for (const [name] of m.tiers) assert.ok(categories[name], `${m.id}: «${name}» нет на poe.ninja`);
    const lv = m.tiers.map(([, l]) => l);
    assert.deepEqual(lv, [...lv].sort((a, b) => a - b), `${m.id}: уровни по возрастанию`);
  }
});
