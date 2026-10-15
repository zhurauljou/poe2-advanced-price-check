const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parseItem } = require('../src/main/parser');

const fixture = (name) => parseItem(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
const texts = (item) => item.modLines.map((m) => m.text);

test('расширенный формат: диапазоны убраны, тиры и пометки из заголовков', () => {
  const it = fixture('rare-armour-advanced.txt');
  assert.equal(it.baseType, 'Vile Robe');
  assert.equal(it.props.es, 1038);
  assert.equal(it.quality, 27);
  assert.ok(it.corrupted);
  const es = it.modLines.find((m) => m.text === '+30 to maximum Energy Shield');
  assert.deepEqual([es.tag, es.tier], ['explicit', 1]);
  assert.equal(it.modLines.find((m) => m.text === '93% increased Energy Shield').tag, 'desecrated');
  assert.equal(it.modLines.find((m) => m.text === '+34% to Cold Resistance').tag, 'crafted');
  assert.equal(it.modLines.find((m) => m.text.startsWith('60% increased Armour')).tag, 'rune');
});

test('флейвор, свойства со скобками и служебные строки — не моды', () => {
  const it = fixture('amulet-fractured-advanced.txt');
  const t = texts(it);
  assert.ok(!t.some((x) => x.startsWith('Quality')));
  assert.ok(!t.includes('We reach for the promises lost...'));
  assert.ok(!t.includes('Fractured Item'));
  assert.equal(it.modLines.find((m) => m.text === 'Allocates Dominion').tag, 'enchant');
  assert.equal(it.modLines.find((m) => m.text === '+50 to Spirit').tag, 'fractured');
});

test('уник: варианты Legacy на месте, флейвор отброшен', () => {
  const it = fixture('unique-mageblood.txt');
  assert.deepEqual([it.name, it.baseType], ['Mageblood', 'Utility Belt']);
  const t = texts(it);
  for (const l of ['Stibnite', 'Quicksilver', 'Bismuth', 'Gold']) assert.ok(t.includes(`Legacy of ${l}`));
  assert.ok(!t.some((x) => x.startsWith('Rivers of power')));
});

test('валюта: стак', () => {
  const it = parseItem('Item Class: Stackable Currency\nRarity: Currency\nExalted Orb\n--------\nStack Size: 3/20\n');
  assert.deepEqual(it.stack, { size: 3, max: 20 });
});

test('не предмет — null', () => {
  assert.equal(parseItem('просто текст'), null);
});
