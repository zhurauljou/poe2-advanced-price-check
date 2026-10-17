// Сопоставление строк модов с фильтрами трейда (api/trade2/data/stats).
// Статы с выбором варианта (Legacy of Quicksilver у Mageblood) приходят как «explicit.stat_264262054|8» —
// id стата и номер варианта; трейд ищет их по этому id целиком: { id: 'explicit.stat_264262054|8' }.

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
let localIndex = null; // то же по текстам клиента не на английском; text — английский (по id), для шаблонов и спроса
let enById = new Map();

// Вариант стата: «(Local)» — у брони/оружия на самой вещи, «(Jewel)» — у самоцветов свой стат (мана за убийство и т.п.).
const VARIANT = / \((Local|Jewel)\)$/;
const variantOf = (itemClass) => (itemClass === 'Jewels' ? 'Jewel' : LOCAL_CLASSES.has(itemClass) ? 'Local' : null);

function build(statsJson) {
  index = new Map();
  for (const g of statsJson.result) {
    for (const e of g.entries) {
      const v = e.text.match(VARIANT);
      const key = norm(e.text.replace(VARIANT, ''));
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({ id: e.id, group: g.id, text: e.text, variant: v ? v[1] : null });
      enById.set(e.id, e.text);
    }
  }
}

// Справочник трейда на языке клиента (ru.pathofexile.com/api/trade2/data/stats): строки модов из буфера — на нём.
// null — английский клиент.
const LOCAL_TAG = / \((Local|На предмете)\)$/;
function buildLocal(statsJson) {
  if (!statsJson) { localIndex = null; return; }
  localIndex = new Map();
  for (const g of statsJson.result) {
    for (const e of g.entries) {
      const key = norm(e.text.replace(LOCAL_TAG, ''));
      if (!localIndex.has(key)) localIndex.set(key, []);
      localIndex.get(key).push({ id: e.id, group: g.id, text: enById.get(e.id) || e.text, variant: LOCAL_TAG.test(e.text) ? 'Local' : null });
    }
  }
}

// idx — по какому справочнику: строки из буфера — на языке клиента, тексты RePoE (крафт) — всегда английский.
function lookup(text, idx = localIndex || index) {
  const values = (text.match(NUM) || []).map(Number);
  // «Has 2 Charm Slots» в игре против «Has # Charm Slot» на трейде.
  let cands = idx.get(norm(text)) || idx.get(norm(text).replace(/s$/, ''));
  let sign = 1;
  if (!cands) {
    // «10% reduced X» на трейде ищется как «#% increased X» с отрицательным значением.
    for (const [a, b] of [[' reduced ', ' increased '], [' less ', ' more '], [' уменьшение ', ' увеличение '], [' снижение ', ' повышение '], [' меньше', ' больше']]) {
      if (text.includes(a)) {
        cands = idx.get(norm(text.replace(a, b)));
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

function pick(cands, tag, variant) {
  const group = TAG_GROUP[tag] || 'explicit';
  let pool = cands.filter((c) => c.group === group);
  // Моды от Vaal Orb («зачарования») трейд держит в группе enchant; если там нет — как имплицит.
  if (tag === 'corrupted') {
    const ench = cands.filter((c) => c.group === 'enchant');
    if (ench.length) pool = ench;
  }
  if (!pool.length) pool = cands.filter((c) => c.group === 'explicit');
  if (!pool.length) return null;
  const pref = pool.filter((c) => c.variant === variant);
  return (pref.length ? pref : pool)[0];
}

// Превращает item.modLines в item.mods: [{ text, tag, statId, value }]. У несопоставленных строк statId = null;
// многострочные моды склеиваются.
function matchMods(item) {
  if (!index) return [];
  const localItem = variantOf(item.itemClass);
  const out = [];
  const ls = item.modLines;
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    // Моды в три строки (Undying Hate: «Glorifying … / Passives in radius are Conquered … / Desecration makes …»).
    if (i + 2 < ls.length && ls[i + 1].tag === l.tag && ls[i + 2].tag === l.tag) {
      const text3 = [l.text, ls[i + 1].text, ls[i + 2].text].join('\n');
      const joined3 = lookup(text3);
      const c3 = joined3 && pick(joined3.cands, l.tag, localItem);
      if (c3) {
        out.push({ text: text3, tag: l.tag, tier: l.tier, statId: c3.id, template: c3.text, value: joined3.value, range: l.range });
        i += 2;
        continue;
      }
    }
    if (i + 1 < ls.length && ls[i + 1].tag === l.tag) {
      const joined = lookup(l.text + '\n' + ls[i + 1].text);
      if (joined) {
        const c = pick(joined.cands, l.tag, localItem);
        if (c) {
          out.push({ text: l.text + '\n' + ls[i + 1].text, tag: l.tag, tier: l.tier, statId: c.id, template: c.text,
            value: joined.value, range: l.range });
          i++;
          continue;
        }
      }
    }
    const rune = forged(l.text);
    if (rune) {
      out.push({ text: l.text, tag: 'rune', statId: rune.id, template: rune.text, value: null, forged: true });
      continue;
    }
    const m = lookup(l.text);
    const c = m && pick(m.cands, l.tag, localItem);
    // Несопоставленное показываем серым, без галочки: видно, что мод есть, но искать по нему нельзя.
    out.push(c ? { text: l.text, tag: l.tag, tier: l.tier, statId: c.id, template: c.text, value: m.value, range: l.range, textRange: l.textRange }
      : { text: l.text, tag: l.tag, tier: l.tier, statId: null });
  }
  return mergeSame(out);
}

// «Forged by the Breath of Aldur» — в гнезде руна Альдура: её не вынуть, а Fire/Lightning моды навсегда стали Cold.
// Трейд ищет такую вещь по стату руны: «…transforms all Fire and Lightning modifiers to equivalent Cold modifiers» (Breath),
// «…into equivalent Fire / Lightning / Chaos modifiers» (Passion / Ire / Betrayal).
const ALDUR = { Breath: 'Cold', Passion: 'Fire', Ire: 'Lightning', Betrayal: 'Chaos' };
function forged(text) {
  const m = String(text).match(/^Forged by the (\w+) of Aldur$/);
  const el = m && ALDUR[m[1]];
  if (!el || !index) return null;
  for (const list of index.values()) {
    for (const c of list) if (c.group === 'rune' && c.text.includes(`equivalent ${el} modifiers`)) return c;
  }
  return null;
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
    if (!prev.parts) {
      prev.parts = [prev.text];
      prev.tiers = [prev.tier];
    }
    prev.parts.push(m.text);
    prev.tiers.push(m.tier);
    if (m.value != null) prev.value = (prev.value || 0) + m.value;
    // Диапазон суммы — сумма диапазонов (если он известен у всех частей).
    prev.range = prev.range && m.range ? { lo: prev.range.lo + m.range.lo, hi: prev.range.hi + m.range.hi } : null;
    if (m.tier != null && (prev.tier == null || m.tier < prev.tier)) prev.tier = m.tier;
    // Показываем каждый мод своей строкой; фильтр общий — трейд ищет по сумме.
    prev.text = prev.parts.join('\n');
  }
  return out;
}

// Один стат конкретной группы по тексту — для свойств вроде «Grants Skill: Level 16 Wolf Pack».
function find(text, group) {
  if (!index) return null;
  const m = lookup(text) || (localIndex ? lookup(text, index) : null);
  const c = m && m.cands.find((x) => x.group === group);
  return c ? { statId: c.id, value: m.value } : null;
}

// Стат трейда для строки мода, которой на вещи ещё нет (кандидат крафта): с учётом локальности класса вещи.
function statFor(text, tag, itemClass) {
  if (!index) return null;
  const m = lookup(text, index);
  const c = m && pick(m.cands, tag, variantOf(itemClass));
  return c ? { statId: c.id, value: m.value } : null;
}

// Порядковое место варианта по текстовому диапазону: «Massive Ring» из «Very Small-Massive Ring» среди вариантов
// стата (|1 Very Small … |8 Massive — номера идут по размеру). → { idx, lo, hi, loText, hiText } или null.
function ordinal(statId, text, textRange) {
  if (!index || !statId || !statId.includes('|') || !textRange) return null;
  const base = statId.split('|')[0];
  const opts = [];
  for (const list of index.values()) for (const c of list) if (c.id.startsWith(base + '|')) opts.push({ n: Number(c.id.split('|')[1]), text: c.text });
  if (opts.length < 3) return null;
  // Общие начало и конец текстов вариантов — остаётся меняющаяся часть («Very Small», «Medium-Small», «Massive»).
  const texts = opts.map((o) => o.text);
  let pre = texts[0], suf = texts[0];
  for (const x of texts) {
    while (!x.startsWith(pre)) pre = pre.slice(0, -1);
    while (!x.endsWith(suf)) suf = suf.slice(1);
  }
  const part = (x) => x.slice(pre.length, x.length - suf.length);
  // Шкала — только размеры (Very Small … Massive). «Amethyst-Topaz» у Legacy Mageblood — алфавитный список, не порядок.
  const SIZE = /^(Very Small|Small|Medium-Small|Medium|Medium-Large|Large|Very Large|Massive)$/;
  if (!opts.every((o) => SIZE.test(part(o.text)))) return null;
  const byPart = new Map(opts.map((o) => [part(o.text), o.n]));
  const cur = opts.find((o) => o.text === text);
  // «Very Small-Massive Ring»: дефис есть и внутри вариантов (Medium-Small) — перебираем, где резать.
  const tr = textRange.endsWith(suf) ? textRange.slice(0, textRange.length - suf.length) : textRange;
  for (let i = tr.indexOf('-'); i > 0; i = tr.indexOf('-', i + 1)) {
    const lo = byPart.get(tr.slice(0, i)), hi = byPart.get(tr.slice(i + 1));
    if (lo != null && hi != null && cur && hi > lo) return { idx: cur.n, lo, hi, loText: tr.slice(0, i), hiText: tr.slice(i + 1) };
  }
  return null;
}

function optionCount(statId) {
  if (!index || !statId || !statId.includes('|')) return 0;
  const base = statId.split('|')[0] + '|';
  const ids = new Set();
  for (const list of index.values()) for (const c of list) if (c.id.startsWith(base)) ids.add(c.id);
  return ids.size;
}

module.exports = { build, buildLocal, matchMods, find, statFor, ordinal, optionCount };
