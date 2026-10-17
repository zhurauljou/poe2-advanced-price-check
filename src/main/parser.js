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
// Расширенный формат (настройка игры «расширенные описания модов» или Ctrl+Alt+C):
// { Desecrated Prefix Modifier "Unassailable" (Tier: 2) — Energy Shield }
// 93(92-100)% increased Energy Shield
const MOD_HEADER = /^\{ (.*) \}$/;
// Диапазон сразу после значения: «93(92-100)%», «-10(-12--8)», и у вариантов — «Legacy of Gold(Amethyst-Topaz)».
const RANGE = /([^\s(])\([^()\s]+-[^()\s]+\)/g;

function headerInfo(h) {
  const kind = h.split(' — ')[0];
  let tag = 'explicit';
  if (/^Implicit/.test(kind)) tag = 'implicit';
  else if (/^Enhancement/.test(kind)) tag = 'enchant'; // анойнт: «Allocates Dominion»
  else if (/^Corrupted/.test(kind)) tag = 'corrupted'; // имплицит от Vaal Orb
  else if (/^Crafted/.test(kind)) tag = 'crafted';
  else if (/^Desecrated/.test(kind)) tag = 'desecrated';
  else if (/^Fractured/.test(kind)) tag = 'fractured';
  const t = kind.match(/\((?:Tier|Rank): (\d+)\)/);
  // «… — Minion, Gem — 40% Increased»: мод усилен качеством катализатора. В тексте игра пишет базовые
  // числа (+3), а показывает и индексирует на трейде усиленные (+4).
  const b = h.match(/— (\d+)% Increased$/);
  // Сторона и имя аффикса — для советов по крафту (свободные места, какой мод что занимает).
  const side = /Prefix/.test(kind) ? 'prefix' : /Suffix/.test(kind) ? 'suffix' : null;
  const name = (kind.match(/"([^"]+)"/) || [])[1] || null;
  return { tag, tier: t ? +t[1] : null, boost: b ? +b[1] : 0, side, name };
}

// Усиление качеством, с округлением вниз — как в игре: 3 × 1.4 = 4.2 → 4, 19 × 1.4 = 26.6 → 26.
function boostLine(line, pct) {
  if (!pct) return line;
  return line.replace(/\d+(?:\.\d+)?/g, (n) => {
    const v = Number(n) * (1 + pct / 100);
    return String(n.includes('.') ? Math.floor(v * 100) / 100 : Math.floor(v));
  });
}
// Числовой диапазон тира у значения: «+30(26-30)» → { lo: 26, hi: 30 }. Несколько чисел в строке
// («Adds 3(2-4) to 7(6-8)») — усредняем, как и само значение для трейда. Качество катализатора — как у значения.
const NUM_RANGE = /(-?\d+(?:\.\d+)?)\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/g;
function tierRange(raw, pct) {
  const rs = [...raw.matchAll(NUM_RANGE)].map((m) => [Number(m[2]), Number(m[3])]);
  if (!rs.length) return null;
  const k = 1 + (pct || 0) / 100;
  const scale = (n) => (Number.isInteger(n) ? Math.floor(n * k) : Math.floor(n * k * 100) / 100);
  const avg = (i) => rs.reduce((s, r) => s + scale(r[i]), 0) / rs.length;
  return { lo: avg(0), hi: avg(1) };
}
const TAGGED = /^(.*) \((implicit|enchant|rune|crafted|fractured|desecrated)\)$/;
// Строки-свойства («Armour: 120 (augmented)», «Requires: Level 40») — это не моды.
const PROPERTY = /^[A-Za-z][A-Za-z '()]*: /; // и «Quality (Minion Modifiers): +40%»
const NOT_MODS = new Set(['Corrupted', 'Twice Corrupted', 'Mirrored', 'Unidentified', 'Fractured Item', 'Desecrated Item', 'Sanctified']);

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
    twiceCorrupted: false, // «Twice Corrupted» (рус. «Дважды осквернено») — тоже осквернена
    unidentified: false,
    mirrored: false,
    sanctified: false,
    fracturedItem: false, // строка «Fractured Item»
    desecratedItem: false, // строка «Desecrated Item»
    props: {}, // ar / ev / es / spirit, у оружия pdps / edps / dps
    properties: [], // строки свойств для показа, как в игре: { k: 'Energy Shield', v: '1038', aug: true }
    requires: null, // «Level 65, 78 Int»
    reqLevel: null,
    sockets: 0,
    affixes: [], // аффиксы из расширенного формата: { side: prefix|suffix, name: «Divine», tag, tier }
    modLines: [], // { text, tag } — сырые строки, сопоставление со статами трейда делает stats.js
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

  const dmg = {}; // тип урона -> средний урон за удар
  let aps = null;
  for (const sec of sections.slice(1)) {
    for (const l of sec) {
      let m;
      if ((m = l.match(/^(Armour|Evasion Rating|Energy Shield|Spirit): (\d+)/))) {
        item.props[{ Armour: 'ar', 'Evasion Rating': 'ev', 'Energy Shield': 'es', Spirit: 'spirit' }[m[1]]] = +m[2];
      } else if ((m = l.match(/^(Physical|Fire|Cold|Lightning|Chaos|Elemental) Damage: (.+)$/))) {
        const hits = [...m[2].matchAll(/(\d+)-(\d+)/g)].map((x) => (+x[1] + +x[2]) / 2);
        dmg[m[1]] = (dmg[m[1]] || 0) + hits.reduce((s, v) => s + v, 0);
      } else if ((m = l.match(/^Attacks per Second: ([\d.]+)/))) aps = +m[1];
      else if ((m = l.match(/^Critical Hit Chance: ([\d.]+)%/))) item.props.crit = +m[1];
      else if ((m = l.match(/^Item Level: (\d+)/))) item.ilvl = +m[1];
      // «Quality: +20%» и качество с катализатором на бижутерии — «Quality (Minion Modifiers): +40%».
      else if ((m = l.match(/^Quality(?: \(([^)]*)\))?: \+?(\d+)%/))) { item.quality = +m[2]; if (m[1]) item.qualityKind = m[1]; }
      else if ((m = l.match(/^Stack Size: ([\d,.\s]+)\/([\d,.\s]+)/))) item.stack = { size: num(m[1]), max: num(m[2]) };
      else if (item.rarity === 'Gem' && (m = l.match(/^Level: (\d+)/))) item.gemLevel = +m[1];
      else if (l === 'Corrupted') item.corrupted = true;
      else if (l === 'Twice Corrupted') { item.corrupted = true; item.twiceCorrupted = true; }
      else if (l === 'Mirrored') item.mirrored = true;
      else if (l === 'Sanctified') item.sanctified = true;
      else if (l === 'Fractured Item') item.fracturedItem = true;
      else if (l === 'Desecrated Item') item.desecratedItem = true;
    }
  }
  // Свойства — из секций, где все строки «Ключ: значение» (у камней первая строка — теги, её пропускаем).
  const SKIP_PROPS = new Set(['Item Level', 'Requires', 'Stack Size', 'Sockets', 'Note']); // Note — заметка продавца (~b/o 2 chaos), не свойство вещи
  for (const sec of sections.slice(1)) {
    for (const l of sec) {
      let m;
      if ((m = l.match(/^Requires: (.+)$/))) {
        item.requires = m[1].replace(/ \((augmented|unmet)\)/g, '');
        const lv = item.requires.match(/Level (\d+)/);
        if (lv) item.reqLevel = +lv[1];
      }
      else if ((m = l.match(/^Sockets: (.+)$/))) item.sockets = (m[1].match(/S/g) || []).length;
    }
    if (!sec.every((l) => PROPERTY.test(l) && !TAGGED.test(l))) continue;
    for (const l of sec) {
      const m = l.match(/^([^:]+): (.+)$/);
      if (!m || SKIP_PROPS.has(m[1])) continue;
      const aug = / \(augmented\)/.test(m[2]);
      item.properties.push({ k: m[1], v: m[2].replace(/ \(augmented\)/g, ''), aug });
    }
  }
  if (aps) {
    const ele = (dmg.Fire || 0) + (dmg.Cold || 0) + (dmg.Lightning || 0) + (dmg.Elemental || 0);
    const r1 = (v) => Math.round(v * 10) / 10;
    item.props.pdps = r1((dmg.Physical || 0) * aps);
    item.props.edps = r1(ele * aps);
    item.props.dps = r1(((dmg.Physical || 0) + ele + (dmg.Chaos || 0)) * aps);
    item.props.aps = aps;
  }

  const modRarities = ['Normal', 'Magic', 'Rare', 'Unique'];
  // В расширенном формате у каждого мода есть заголовок { … } — строки без него (флейвор) не моды.
  const advanced = lines.some((l) => MOD_HEADER.test(l));
  item.advanced = advanced;
  if (modRarities.includes(item.rarity) && !item.unidentified) {
    for (const sec of sections.slice(1)) {
      // Секция свойств/требований: почти все строки вида «Ключ: значение».
      const props = sec.filter((l) => PROPERTY.test(l) && !TAGGED.test(l)).length;
      if (props === sec.length) continue;
      let head = null; // заголовок { … } действует до следующего заголовка или конца секции
      for (const raw of sec) {
        if (NOT_MODS.has(raw)) continue;
        if (/^\(.*\)$/.test(raw)) continue; // строка-пояснение в скобках — не мод
        const h = raw.match(MOD_HEADER);
        if (h) {
          head = headerInfo(h[1]);
          // Один заголовок — один аффикс (гибридный мод в две строки занимает одно место).
          if (head.side) { head.affix = { side: head.side, name: head.name, tag: head.tag, tier: head.tier, lines: [] }; item.affixes.push(head.affix); }
          continue;
        }
        const l = boostLine(raw.replace(RANGE, '$1').replace(/ — Unscalable Value$/, '').replace(/(\S)\([^()]*\)$/, '$1') /* «()» и текстовый диапазон «Massive Ring(Very Small-Massive Ring)» */, head ? head.boost : 0);
        const t = l.match(TAGGED);
        // Руна Альдура в гнезде — без заголовка { … }, но это свойство вещи (stats.forged), а не флейвор.
        if (/^Forged by the \w+ of Aldur$/.test(l)) { item.modLines.push({ text: l, tag: 'rune', tier: null, range: null }); continue; }
        if (advanced && !head && !t) continue;
        const tier = head ? head.tier : null;
        const range = tierRange(raw, head ? head.boost : 0);
        const tr = raw.replace(/ — Unscalable Value$/, '').match(/\S\(([^()]*[A-Za-z][^()]*)\)$/);
        // У самоцветов «{ Enhancement }» — их собственные моды («Allocates …» у Megalomaniac), а не анойнт: самоцветы не анойнтят.
        const tag = head ? (head.tag === 'enchant' && item.itemClass === 'Jewels' ? 'explicit' : head.tag) : 'explicit';
        const line = t ? { text: t[1], tag: t[2], tier, range } : { text: l, tag, tier, range };
        if (tr) line.textRange = tr[1];
        item.modLines.push(line);
        if (head && head.affix) head.affix.lines.push(line.text); // строки аффикса — чтобы различать моды с одинаковым названием
      }
    }
  }
  return item;
}

module.exports = { parseItem };
