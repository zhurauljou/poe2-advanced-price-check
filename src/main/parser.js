// Parsing of the item text PoE 2 puts in the clipboard on Ctrl+C (English client).
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
// Advanced format (game option "advanced mod descriptions" or Ctrl+Alt+C):
// { Desecrated Prefix Modifier "Unassailable" (Tier: 2) — Energy Shield }
// 93(92-100)% increased Energy Shield
const MOD_HEADER = /^\{ (.*) \}$/;
// Range right after the value: "93(92-100)%", "-10(-12--8)", and for variants — "Legacy of Gold(Amethyst-Topaz)".
const RANGE = /([^\s(])\([^()\s]+-[^()\s]+\)/g;

function headerInfo(h) {
  const kind = h.split(' — ')[0];
  let tag = 'explicit';
  if (/^Implicit/.test(kind)) tag = 'implicit';
  else if (/^Enhancement/.test(kind)) tag = 'enchant'; // anoint: "Allocates Dominion"
  // A Vaal Orb outcome on a jewel («+5(5-10)% to Cold Resistance» on Grand Spectrum) — trade keeps it in the enchant group.
  else if (/^Corruption Enhancement/.test(kind)) tag = 'enchant';
  else if (/^Corrupted/.test(kind)) tag = 'corrupted'; // implicit from a Vaal Orb
  else if (/^Crafted/.test(kind)) tag = 'crafted';
  else if (/^Desecrated/.test(kind)) tag = 'desecrated';
  else if (/^Fractured/.test(kind)) tag = 'fractured';
  const t = kind.match(/\((?:Tier|Rank): (\d+)\)/);
  // "… — Minion, Gem — 40% Increased": the mod is boosted by catalyst quality. In the text the game writes the base
  // numbers (+3), but shows and indexes the boosted ones (+4) on trade.
  const b = h.match(/— (\d+)% Increased$/);
  // Affix side and name — for crafting advice (free slots, which mod takes what).
  const side = /Prefix/.test(kind) ? 'prefix' : /Suffix/.test(kind) ? 'suffix' : null;
  const name = (kind.match(/"([^"]+)"/) || [])[1] || null;
  return { tag, tier: t ? +t[1] : null, boost: b ? +b[1] : 0, side, name, corruption: /^Corruption/.test(kind) };
}

// Quality boost, rounded down — as in the game: 3 × 1.4 = 4.2 → 4, 19 × 1.4 = 26.6 → 26.
function boostLine(line, pct) {
  if (!pct) return line;
  return line.replace(/\d+(?:\.\d+)?/g, (n) => {
    const v = Number(n) * (1 + pct / 100);
    return String(n.includes('.') ? Math.floor(v * 100) / 100 : Math.floor(v));
  });
}
// Numeric tier range at a value: "+30(26-30)" → { lo: 26, hi: 30 }. Several numbers in a line
// ("Adds 3(2-4) to 7(6-8)") — averaged, like the value itself for trade. Catalyst quality — as for the value.
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
// Property lines ("Armour: 120 (augmented)", "Requires: Level 40") are not mods.
const PROPERTY = /^[A-Za-z][A-Za-z '()]*: /; // and "Quality (Minion Modifiers): +40%"
const NOT_MODS = new Set(['Corrupted', 'Twice Corrupted', 'Mirrored', 'Unidentified', 'Fractured Item', 'Desecrated Item', 'Sanctified']);

// Waystone properties → trade filters (map_filters). Labels in the game text are recognized by keywords.
const MAP_PROPS = [
  [/^Waystone Tier$/i, 'map_tier'], [/Pack Size/i, 'map_packsize'], [/^Item Rarity$/i, 'map_iir'],
  [/Waystone Drop Chance/i, 'map_bonus'], [/Revives/i, 'map_revives'], [/Magic Monsters|Monster Effectiveness/i, 'map_magic_monsters'],
  [/Rare Monsters|Monster Rarity/i, 'map_rare_monsters'], [/Gold/i, 'map_gold'], [/Experience/i, 'map_experience'],
];

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
    twiceCorrupted: false, // "Twice Corrupted" (also in the Russian client) — corrupted as well
    unidentified: false,
    mirrored: false,
    sanctified: false,
    fracturedItem: false, // the "Fractured Item" line
    desecratedItem: false, // the "Desecrated Item" line
    props: {}, // ar / ev / es / spirit, for weapons pdps / edps / dps
    properties: [], // property lines for display, as in the game: { k: 'Energy Shield', v: '1038', aug: true }
    requires: null, // «Level 65, 78 Int»
    reqLevel: null,
    sockets: 0,
    affixes: [], // affixes from the advanced format: { side: prefix|suffix, name: "Divine", tag, tier }
    modLines: [], // { text, tag } — raw lines; matching them to trade stats is done by stats.js
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

  const dmg = {}; // damage type -> average damage per hit
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
      // "Quality: +20%" and catalyst quality on jewellery — "Quality (Minion Modifiers): +40%".
      else if ((m = l.match(/^Quality(?: \(([^)]*)\))?: \+?(\d+)%/))) { item.quality = +m[2]; if (m[1]) item.qualityKind = m[1]; }
      else if ((m = l.match(/^Stack Size: ([\d,.\s]+)\/([\d,.\s]+)/))) item.stack = { size: num(m[1]), max: num(m[2]) };
      else if (item.rarity === 'Gem' && (m = l.match(/^Level: (\d+)/))) item.gemLevel = +m[1];
      else if (item.itemClass === 'Waystones' && (m = l.match(/^([^:]+): \+?(-?\d+(?:\.\d+)?)%?/)) && MAP_PROPS.some(([re]) => re.test(m[1]))) {
        const key = MAP_PROPS.find(([re]) => re.test(m[1]))[1];
        item.props[key] = +m[2];
        (item.mapLabels = item.mapLabels || {})[key] = m[1];
      }
      else if (l === 'Corrupted') item.corrupted = true;
      else if (l === 'Twice Corrupted') { item.corrupted = true; item.twiceCorrupted = true; }
      else if (l === 'Mirrored') item.mirrored = true;
      else if (l === 'Sanctified') item.sanctified = true;
      else if (l === 'Fractured Item') item.fracturedItem = true;
      else if (l === 'Desecrated Item') item.desecratedItem = true;
    }
  }
  // Properties — from sections where every line is "Key: value" (for gems the first line is tags, it's skipped).
  const SKIP_PROPS = new Set(['Item Level', 'Requires', 'Stack Size', 'Sockets', 'Note']); // Note is the seller's note (~b/o 2 chaos), not an item property
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
  // In the advanced format every mod has a { … } header — lines without it (flavour) are not mods.
  const advanced = lines.some((l) => MOD_HEADER.test(l));
  item.advanced = advanced;
  if (modRarities.includes(item.rarity) && !item.unidentified) {
    for (const sec of sections.slice(1)) {
      // Properties/requirements section: almost all lines look like "Key: value".
      const props = sec.filter((l) => PROPERTY.test(l) && !TAGGED.test(l)).length;
      if (props === sec.length) continue;
      let head = null; // the { … } header applies until the next header or the end of the section
      for (const raw of sec) {
        if (NOT_MODS.has(raw)) continue;
        if (/^\(.*\)$/.test(raw)) continue; // an explanatory line in brackets — not a mod
        const h = raw.match(MOD_HEADER);
        if (h) {
          head = headerInfo(h[1]);
          // One header — one affix (a two-line hybrid mod takes one slot).
          if (head.side) { head.affix = { side: head.side, name: head.name, tag: head.tag, tier: head.tier, lines: [] }; item.affixes.push(head.affix); }
          continue;
        }
        // "()" and a text range like "Massive Ring(Very Small-Massive Ring)" glued to a variant's name — anywhere in the line:
        // From Nothing copies «Passives in Radius of Blackflame Covenant() can be Allocated», the name mid-line.
        const l = boostLine(raw.replace(RANGE, '$1').replace(/ — Unscalable Value$/, '').replace(/(\S)\(([^()]*[A-Za-z][^()]*)?\)/g, '$1'), head ? head.boost : 0);
        const t = l.match(TAGGED);
        // An Aldur rune in a socket — no { … } header, but it's an item property (stats.forged), not flavour.
        if (/^Forged by the \w+ of Aldur$/.test(l)) { item.modLines.push({ text: l, tag: 'rune', tier: null, range: null }); continue; }
        if (advanced && !head && !t) continue;
        const tier = head ? head.tier : null;
        const range = tierRange(raw, head ? head.boost : 0);
        const tr = raw.replace(/ — Unscalable Value$/, '').match(/\S\(([^()]*[A-Za-z][^()]*)\)$/);
        // On jewels "{ Enhancement }" are their own mods ("Allocates …" on Megalomaniac), not an anoint: jewels can't be anointed.
        // A «{ Corruption Enhancement }» is not one of them: it is an enchant on trade.
        const tag = head ? (head.tag === 'enchant' && !head.corruption && item.itemClass === 'Jewels' ? 'explicit' : head.tag) : 'explicit';
        const line = t ? { text: t[1], tag: t[2], tier, range } : { text: l, tag, tier, range };
        // Tablet: "6 uses remaining" is an implicit line, but for search it's the number of uses (a property), not a mod.
        const uses = item.itemClass === 'Tablet' && line.text.match(/^(\d+) uses? remaining$/i);
        if (uses) { item.props.uses = +uses[1]; continue; }
        if (tr) line.textRange = tr[1];
        item.modLines.push(line);
        if (head && head.affix) head.affix.lines.push(line.text); // affix lines — to tell apart mods with the same name
      }
    }
  }
  return item;
}

module.exports = { parseItem };
