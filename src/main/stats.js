// Сопоставление строк модов с фильтрами трейда (api/trade2/data/stats).
// Статы с выбором варианта (Legacy of Quicksilver у Mageblood) приходят как «explicit.stat_264262054|8» —
// id стата и номер варианта; в запрос они уходят как { id, value: { option: 8 } }.

const LOCAL_CLASSES = new Set([
  'Body Armours', 'Helmets', 'Gloves', 'Boots', 'Shields', 'Bucklers', 'Foci',
  'One Hand Maces', 'Two Hand Maces', 'Quarterstaves', 'Bows', 'Crossbows', 'Spears', 'Flails',
  'Wands', 'Sceptres', 'Staves', 'Claws', 'Daggers', 'One Hand Swords', 'Two Hand Swords',
  'One Hand Axes', 'Two Hand Axes', 'Talismans', 'Traps',
]);

const NUM = /[+-]?\d+(?:\.\d+)?/g;

function norm(s) {
  return s.replace(NUM, '#').replace(/\+#/g, '#').trim();
}

let index = null; // norm(text) -> [{ id, group, text, local }]

function build(statsJson) {
  index = new Map();
  for (const g of statsJson.result) {
    for (const e of g.entries) {
      const local = / \(Local\)$/.test(e.text);
      const key = norm(e.text.replace(/ \(Local\)$/, ''));
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({ id: e.id, group: g.id, text: e.text, local });
    }
  }
}

function lookup(text) {
  const values = (text.match(NUM) || []).map(Number);
  // «Has 2 Charm Slots» в игре против «Has # Charm Slot» на трейде.
  let cands = index.get(norm(text)) || index.get(norm(text).replace(/s$/, ''));
  let sign = 1;
  if (!cands) {
    // «10% reduced X» на трейде ищется как «#% increased X» с отрицательным значением.
    for (const [a, b] of [[' reduced ', ' increased '], [' less ', ' more ']]) {
      if (text.includes(a)) {
        cands = index.get(norm(text.replace(a, b)));
        if (cands) { sign = -1; break; }
      }
    }
  }
  if (!cands) return null;
  // «Adds 3 to 5 X» на трейде фильтруется по среднему.
  const value = values.length ? (sign * values.reduce((s, v) => s + v, 0)) / values.length : null;
  return { cands, value };
}

const TAG_GROUP = { explicit: 'explicit', implicit: 'implicit', enchant: 'enchant', rune: 'rune',
  crafted: 'crafted', fractured: 'fractured', desecrated: 'desecrated', corrupted: 'implicit' };

function pick(cands, tag, localItem) {
  const group = TAG_GROUP[tag] || 'explicit';
  let pool = cands.filter((c) => c.group === group);
  if (!pool.length) pool = cands.filter((c) => c.group === 'explicit');
  if (!pool.length) return null;
  const pref = pool.filter((c) => c.local === localItem);
  return (pref.length ? pref : pool)[0];
}

// Превращает item.modLines в item.mods: [{ text, tag, statId, value }]. У несопоставленных строк statId = null;
// многострочные моды склеиваются.
function matchMods(item) {
  if (!index) return [];
  const localItem = LOCAL_CLASSES.has(item.itemClass);
  const out = [];
  const ls = item.modLines;
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    if (i + 1 < ls.length && ls[i + 1].tag === l.tag) {
      const joined = lookup(l.text + '\n' + ls[i + 1].text);
      if (joined) {
        const c = pick(joined.cands, l.tag, localItem);
        if (c) {
          out.push({ text: l.text + '\n' + ls[i + 1].text, tag: l.tag, tier: l.tier, statId: c.id, template: c.text,
            value: joined.value });
          i++;
          continue;
        }
      }
    }
    const m = lookup(l.text);
    const c = m && pick(m.cands, l.tag, localItem);
    // Несопоставленное показываем серым, без галочки: видно, что мод есть, но искать по нему нельзя.
    out.push(c ? { text: l.text, tag: l.tag, tier: l.tier, statId: c.id, template: c.text, value: m.value }
      : { text: l.text, tag: l.tag, tier: l.tier, statId: null });
  }
  return mergeSame(out);
}

// Трейд хранит одинаковые статы одной суммой: «+30 to maximum ES» и «+77 to maximum ES» с разных
// модов ищутся как 107. Склеиваем их в один фильтр.
function mergeSame(mods) {
  const out = [];
  const byId = new Map();
  for (const m of mods) {
    const prev = m.statId && byId.get(m.statId);
    if (!prev) {
      out.push(m);
      if (m.statId) byId.set(m.statId, m);
      continue;
    }
    prev.parts = prev.parts || [prev.text];
    prev.parts.push(m.text);
    prev.text = prev.parts.join('\n');
    if (m.value != null) prev.value = (prev.value || 0) + m.value;
    if (m.tier != null && (prev.tier == null || m.tier < prev.tier)) prev.tier = m.tier;
  }
  return out;
}

module.exports = { build, matchMods, norm, isReady: () => !!index };
