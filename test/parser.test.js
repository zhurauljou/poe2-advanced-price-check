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

test('качество катализатора усиливает моды, как в игре (+3 → +4 при 40%)', () => {
  const it = fixture('amulet-fractured-advanced.txt');
  const t = texts(it);
  assert.ok(t.includes('+4 to Level of all Minion Skills'));
  assert.ok(t.includes('Minions have 26% increased Cooldown Recovery Rate'));
  assert.equal(it.modLines.find((m) => m.text === '+50 to Spirit').tier, 1);
});

test('диапазон тира сохраняется (для минимума по качеству ролла), с учётом катализатора', () => {
  const robe = fixture('rare-armour-advanced.txt');
  assert.deepEqual(robe.modLines.find((m) => m.text === '+39% to Fire Resistance').range, { lo: 36, hi: 40 });
  assert.equal(robe.modLines.find((m) => m.text === '35% reduced Attribute Requirements').range, null);
  const amu = fixture('amulet-fractured-advanced.txt');
  // 12–20 × 1.4 (катализатор 40%) → 16–28, как в игре
  assert.deepEqual(amu.modLines.find((m) => m.text.startsWith('Minions have 26%')).range, { lo: 16, hi: 28 });
});

test('аффиксы для крафта: по заголовкам, гибрид — один аффикс', () => {
  const robe = fixture('rare-armour-advanced.txt');
  assert.equal(robe.affixes.filter((a) => a.side === 'prefix').length, 3); // Divine (гибрид в 2 строки) + Scintillating + Unassailable
  assert.equal(robe.affixes.filter((a) => a.side === 'suffix').length, 3);
  assert.deepEqual(robe.affixes[0], { side: 'prefix', name: 'Divine', tag: 'explicit', tier: 1,
    lines: ['+30 to maximum Energy Shield', '41% increased Energy Shield'] }); // строки — чтобы различать одноимённые аффиксы
  assert.equal(robe.affixes.find((a) => a.name === 'Unassailable').tag, 'desecrated');
});

test('Megalomaniac: «{ Enhancement }» у самоцвета — его моды, без «()», заметка продавца не свойство', () => {
  const it = fixture('unique-megalomaniac.txt');
  assert.deepEqual(it.modLines.map((m) => [m.text, m.tag]),
    [['Allocates Forces of Nature', 'explicit'], ['Allocates Licking Wounds', 'explicit']]);
  assert.ok(!it.properties.some((p) => p.k === 'Note'));
});

test('оружие: крит и скорость атаки — свойства для фильтров', () => {
  const it = fixture('rare-mace-weapon.txt');
  assert.equal(it.props.crit, 8);
  assert.equal(it.props.aps, 1.01);
  assert.ok(it.props.pdps > 0 && it.props.edps > 0);
});

test('текстовый диапазон варианта «Massive Ring(Very Small-Massive Ring)» убирается', () => {
  const it = fixture('unique-controlled-metamorphosis.txt');
  assert.deepEqual(texts(it).slice(0, 2), ['Only affects Passives in Massive Ring',
    'Passives in Radius can be Allocated without being connected to your tree']);
  assert.deepEqual(it.modLines[2].range, { lo: -20, hi: -5 });
});

test('русский клиент: текст переводится в английский эквивалент, моды — по русскому справочнику', async () => {
  const cl = require('../src/main/clientLang');
  const ee2 = path.join(__dirname, 'fixtures', 'ee2-ru-items-sample.ndjson');
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cl-'));
  fs.copyFileSync(ee2, path.join(dir, 'ee2-ru-items.ndjson'));
  await cl.load('ru', dir, null);
  const it = parseItem(cl.toEnglish(fs.readFileSync(path.join(__dirname, 'fixtures', 'ru-rare-armour-advanced.txt'), 'utf8'), 'ru'));
  assert.equal(it.itemClass, 'Body Armours');
  assert.equal(it.rarity, 'Rare');
  assert.equal(it.baseType, 'Vile Robe');
  assert.equal(it.ilvl, 81);
  assert.equal(it.props.es, 1038);
  assert.equal(it.requires, 'Level 65, 78 Int');
  assert.equal(it.corrupted, true);
  assert.equal(it.modLines.length, 8); // руна + 7 аффиксных строк
  assert.deepEqual(it.affixes.map((a) => [a.side, a.tag, a.tier]).slice(2, 3), [['prefix', 'desecrated', 2]]);
});

test('руна Альдура в гнезде — отдельная строка-мод с тегом rune', () => {
  const it = parseItem(fs.readFileSync(path.join(__dirname, 'fixtures', 'rare-wand-aldur-rune.txt'), 'utf8'));
  assert.deepEqual(it.modLines[0], { text: 'Forged by the Breath of Aldur', tag: 'rune', tier: null, range: null });
  assert.equal(it.modLines.length, 6);
});

test('текстовый диапазон сохраняется для оценки роллов: «Massive Ring» — лучший из «Very Small-Massive Ring»', () => {
  const it = fixture('unique-controlled-metamorphosis.txt');
  assert.equal(it.modLines[0].textRange, 'Very Small-Massive Ring');
  assert.equal(it.modLines[2].textRange, undefined);
});

test('«Twice Corrupted» — вещь осквернена, строка не мод', () => {
  const it = parseItem(['Item Class: Rings', 'Rarity: Rare', 'Grim Coil', 'Ruby Ring', '--------', 'Item Level: 80', '--------',
    '+11% to Fire Resistance (implicit)', '--------', '+39 to maximum Life', '--------', 'Twice Corrupted'].join('\n'));
  assert.ok(it.corrupted);
  assert.ok(it.twiceCorrupted);
  assert.deepEqual(texts(it), ['+11% to Fire Resistance', '+39 to maximum Life']);
});

test('неопознанная вещь: без модов, флаг unidentified', () => {
  const it = parseItem(['Item Class: Rings', 'Rarity: Rare', 'Ruby Ring', '--------', 'Item Level: 80', '--------',
    '+11% to Fire Resistance (implicit)', '--------', 'Unidentified'].join('\n'));
  assert.ok(it.unidentified);
  assert.equal(it.modLines.length, 0);
});

test('русский клиент: строки модов переводятся в английские (справочник трейда, числа и диапазоны — со строки)', async () => {
  const stats = require('../src/main/stats');
  const cl = require('../src/main/clientLang');
  const sample = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'stats-sample.json'), 'utf8'));
  stats.build(sample.en);
  stats.buildLocal(sample.ru);
  try {
    assert.equal(stats.localToEnglish('+1 допустимых свойств-префиксов'), '+1 Prefix Modifier allowed');
    assert.equal(stats.localToEnglish('Может иметь дополнительных ремесленных свойств: 1'), 'Can have 1 additional Crafted Modifier');
    assert.equal(stats.localToEnglish('Позволяет получать свойства Разрушения'), 'Can roll Destruction modifiers');
    assert.equal(stats.localToEnglish('35% уменьшение требований к характеристикам'), '35% reduced Attribute Requirements');
    assert.equal(stats.localToEnglish('+12 к отклонению за каждые 50 недостающего энергетического щита'), '+12 to Deflection Rating per 50 missing Energy Shield');
    assert.equal(stats.localToEnglish('Добавляет от 3(2-4) до 7(6-8) урона от огня'), 'Adds 3(2-4) to 7(6-8) Fire Damage');
    assert.equal(stats.localToEnglish('Неизвестная строка флейвора'), null);

    const ee2 = path.join(__dirname, 'fixtures', 'ee2-ru-items-sample.ndjson');
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cl-'));
    fs.copyFileSync(ee2, path.join(dir, 'ee2-ru-items.ndjson'));
    await cl.load('ru', dir, null);
    const ru = parseItem(cl.toEnglish(fs.readFileSync(path.join(__dirname, 'fixtures', 'ru-rare-armour-advanced.txt'), 'utf8'), 'ru'));
    const en = fixture('rare-armour-advanced.txt');
    // Те же строки и пометки, что у английского клиента; имена аффиксов остаются русскими (крафт ищет мод по строкам).
    assert.deepEqual(ru.modLines, en.modLines);
    assert.deepEqual(ru.affixes.map((a) => [a.side, a.tag, a.tier, a.lines]), en.affixes.map((a) => [a.side, a.tag, a.tier, a.lines]));
  } finally {
    stats.buildLocal(null);
  }
});
