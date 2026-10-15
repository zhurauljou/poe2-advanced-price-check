// Разбор текста предмета, который PoE 2 кладёт в буфер по Ctrl+C (английский клиент).
//
// Item Class: Rings
// Rarity: Rare
// Grim Coil
// Ruby Ring
// --------
// Item Level: 63
// --------
// +11% to Fire Resistance (implicit)
// --------
// +39 to maximum Life

const SEP = '--------';
const TAGGED = /^(.*) \((implicit|enchant|rune|crafted|fractured|desecrated)\)$/;
// Строки-свойства («Armour: 120 (augmented)», «Requires: Level 40») — это не моды.
const PROPERTY = /^[A-Za-z][A-Za-z ']*: /;

function num(s) {
  return Number(String(s).replace(/[,\s]/g, ''));
}

function parseItem(text) {
  if (!text) return null;
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim());
  if (!lines[0] || !lines[0].startsWith('Item Class:')) return null;

  const sections = [];
  let cur = [];
  for (const l of lines) {
    if (l === SEP) {
      if (cur.length) sections.push(cur);
      cur = [];
    } else if (l) {
      cur.push(l);
    }
  }
  if (cur.length) sections.push(cur);

  const head = sections[0];
  const item = {
    itemClass: head[0].slice('Item Class:'.length).trim(),
    rarity: (head.find((l) => l.startsWith('Rarity:')) || '').slice('Rarity:'.length).trim(),
    name: '',
    baseType: '',
    ilvl: null,
    quality: null,
    gemLevel: null,
    stack: null,
    corrupted: false,
    unidentified: false,
    mirrored: false,
    modLines: [], // { text, tag } — сырые строки, сопоставление со статами трейда делает stats.js
    raw: text,
  };

  const names = head.filter((l) => !l.startsWith('Item Class:') && !l.startsWith('Rarity:'));
  item.unidentified = lines.includes('Unidentified');

  if ((item.rarity === 'Rare' || item.rarity === 'Unique') && names.length >= 2) {
    item.name = names[0];
    item.baseType = names[1];
  } else {
    item.name = names[0] || '';
    item.baseType = (names[names.length - 1] || '').replace(/^Superior /, '');
  }

  for (const sec of sections.slice(1)) {
    for (const l of sec) {
      let m;
      if ((m = l.match(/^Item Level: (\d+)/))) item.ilvl = +m[1];
      else if ((m = l.match(/^Quality: \+?(\d+)%/))) item.quality = +m[1];
      else if ((m = l.match(/^Stack Size: ([\d,.\s]+)\/([\d,.\s]+)/))) item.stack = { size: num(m[1]), max: num(m[2]) };
      else if (item.rarity === 'Gem' && (m = l.match(/^Level: (\d+)/))) item.gemLevel = +m[1];
      else if (l === 'Corrupted') item.corrupted = true;
      else if (l === 'Mirrored') item.mirrored = true;
    }
  }

  const modRarities = ['Normal', 'Magic', 'Rare', 'Unique'];
  if (modRarities.includes(item.rarity) && !item.unidentified) {
    for (const sec of sections.slice(1)) {
      // Секция свойств/требований: почти все строки вида «Ключ: значение».
      const props = sec.filter((l) => PROPERTY.test(l) && !TAGGED.test(l)).length;
      if (props === sec.length) continue;
      for (const l of sec) {
        if (l === 'Corrupted' || l === 'Mirrored' || l === 'Unidentified') continue;
        const t = l.match(TAGGED);
        item.modLines.push(t ? { text: t[1], tag: t[2] } : { text: l, tag: 'explicit' });
      }
    }
  }
  return item;
}

module.exports = { parseItem };
