// Советы по крафту: что и чем можно добавить или заменить, чтобы вещь стала дороже.
// Пул модов — RePoE (выгрузка из файлов игры): какие моды и тиры вообще могут встать на эту базу.
// Весов выпадения в файлах PoE 2 нет (только «может / не может»), поэтому вероятностей не считаем —
// показываем, какие ВОСТРЕБОВАННЫЕ (по poe.ninja) моды могут встать и каким способом.

const fsW = require('fs');
const pathW = require('path');
const craftData = require('./craft-data');
const { load, templates, tradeStats, weights, guaranteedFor, corruptedFor, canRoll } = craftData;

const { essenceFor, perfectFor } = require('./essences');
const { isKey, isWeak, tierFactor } = require('./weights');
const methods = require('../shared/methods');
const { t } = require('../shared/i18n');



const ELEMENTS = ['Fire', 'Cold', 'Lightning', 'Chaos'];
const ALDUR_RUNE = { Fire: 'Passion of Aldur', Cold: 'Breath of Aldur', Lightning: 'Ire of Aldur', Chaos: 'Betrayal of Aldur' };
// Мод «нужен» (востребован), если его носят от стольких % билдов класса (poe.ninja): ниже — не советуем, не ценим.
const WANT_PCT = 15;
const classes = require('../shared/item-classes');
const ALDUR_WEAPONS = new Set(classes.ALDUR_WEAPONS);

// Лич-омены: гарантированный мод лича при Desecrate (только оружие и бижутерия; моды личей — уровня 65).
const LICH_OMEN = { ulaman: 'Omen of the Sovereign', amanamu: 'Omen of the Liege', kurgal: 'Omen of the Blackblooded' };
const LICH_CLASSES = ['weapon', 'wand', 'staff', 'ring', 'amulet', 'belt'];

// Руны влияния (Runes of Aldur): навсегда открывают вещи пул модов (spawn-тег в RePoE).
const INFLUENCE_RUNES = [
  { rune: "Thrud's Might", name: 'Destruction', tag: 'destruction', on: ['weapon', 'wand', 'staff', 'sceptre'] },
  { rune: "Kolr's Hunt", name: 'Marksman', tag: 'marksman', on: ['gloves'] },
  { rune: "Katla's Gloom", name: 'Decay', tag: 'decay', on: ['gloves'] },
  { rune: "Vorana's Carnage", name: 'Berserking', tag: 'berserking', on: ['helmet'] },
  { rune: "Uhtred's Sidereus", name: 'Chronomancy', tag: 'chronomancy', on: ['boots'] },
  { rune: "Medved's Tending", name: 'Soul', tag: 'soul', on: ['body_armour'] },
];
const INF_TAG = Object.fromEntries(INFLUENCE_RUNES.map((r) => [r.name, r.tag]));

// Порченые эссенции с их модами для класса — [{ name, text }] (для плана: гарантированный мод через crafted-слот).
// Классы вещей для целей аугментов («Martial Weapon», «Wand or Staff», «Armour», «All Equipment», ["Boots"]…).
const AUG_GROUPS = {
  'all equipment': null, // любой
  armour: classes.ARMOUR,
  'martial weapon': classes.MARTIAL_WEAPONS,
  'caster weapon': classes.CASTER_WEAPONS,
};
AUG_GROUPS.weapon = [...AUG_GROUPS['martial weapon'], ...AUG_GROUPS['caster weapon'], 'Sceptres'];
const AUG_SINGLE = { staff: 'Staves', quarterstaff: 'Quarterstaves', wand: 'Wands', sceptre: 'Sceptres', bow: 'Bows', crossbow: 'Crossbows', spear: 'Spears',
  talisman: 'Talismans', 'one hand mace': 'One Hand Maces', 'two hand mace': 'Two Hand Maces', shields: 'Shields', shield: 'Shields', buckler: 'Bucklers',
  bucklers: 'Bucklers', focus: 'Foci', helmet: 'Helmets', gloves: 'Gloves', boots: 'Boots', 'body armour': 'Body Armours' };
function augFits(target, itemClass) {
  if (Array.isArray(target)) return target.includes(itemClass);
  const parts = String(target).replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1').toLowerCase().split(/, | or | and /);
  return parts.some((p) => { const g = AUG_GROUPS[p.trim()]; if (g === null) return true; if (g) return g.includes(itemClass); return AUG_SINGLE[p.trim()] === itemClass; });
}


// «Рискованный финал»: порча и освящение (docs/corruption-sanctification.md, data/gamble-currency.json).
// Шансы — оценки сообщества, GGG их не публикует. Показываем с дисклеймерами.
let gambleData;
function gambleFor(item, tags) {
  if (gambleData === undefined) {
    try { gambleData = JSON.parse(fsW.readFileSync(pathW.join(__dirname, '..', '..', 'data', 'gamble-currency.json'), 'utf8')); } catch { gambleData = null; }
  }
  const jewellery = tags.includes('ring') || tags.includes('amulet') || tags.includes('belt');
  const caster = tags.includes('wand') || tags.includes('staff');
  const how = [t('Irreversible. Odds are community estimates — GGG does not publish them.')];
  if (item.rarity === 'Unique') {
    // У уников вместо переката — значения модов ×0.78–1.22 от текущих (могут выйти за обычный диапазон).
    if (tags.includes('jewel') || jewellery) how.push(t('Vaal Orb — ~50% nothing, ~25% corruption enchant, ~25% modifier values ×0.78–1.22 of the current ones (can go beyond the normal range); the item becomes unmodifiable'));
    else how.push(t('Vaal Orb — ~25% each: nothing, corruption enchant, modifier values ×0.78–1.22 of the current ones (can go beyond the normal range), +1 augment socket beyond the limit; the item becomes unmodifiable'));
    how.push(t('Divine to good rolls first: after corruption the values can no longer be rerolled, and ×1.22 of a high roll is worth the most'));
  } else if (tags.includes('jewel')) how.push(t('Vaal Orb — nothing, a corruption enchant or rerolled modifiers (odds for jewels unverified); the item becomes unmodifiable'));
  else if (jewellery) how.push(t('Vaal Orb — ~50% nothing, ~25% corruption enchant, ~25% modifiers rerolled (often ruins the item); the item becomes unmodifiable'));
  else if (caster) how.push(t('Vaal Orb — ~25% each: nothing, corruption enchant, modifiers rerolled (often ruins the item), quality up to ~23%; the item becomes unmodifiable'));
  else how.push(t('Vaal Orb — ~25% each: nothing, corruption enchant, modifiers rerolled (often ruins the item), +1 augment socket beyond the limit; the item becomes unmodifiable'));
  if (!tags.includes('jewel')) how.push(t('Before corrupting: Divine Orb, quality and runes — meta-crafting runes cannot be socketed into corrupted or sanctified items'));
  if (item.rarity === 'Rare') how.push(t('Sanctify (Divine Orb + Omen of Sanctification) — every modifier ×0.78–1.22 of its current value, the item becomes unmodifiable and can no longer be corrupted; only for a near-perfect item, Divine to high rolls first'));
  const inf = gambleData && (gambleData.infusers || []).find((x) => (x.classes || []).includes(item.itemClass));
  if (inf && (item.quality || 0) >= 20) how.push(t('{infuser} — up to +10% quality above the maximum (needs 20% quality); may only add the Corrupted tag', { infuser: inf.name }));
  if (item.rarity === 'Rare' && bonesFor(tags, item.ilvl || 100).length) how.push(t('Omen of Putrefaction + a bone: all modifiers become 6 unrevealed ones (3 prefixes + 3 suffixes), each revealed from 3 options, and the item becomes corrupted — a «slot machine» for cheap bases (quivers, armour)'));
  how.push(t('Omen of Corruption (a guaranteed change) is not obtainable this league'));
  // «(only str_armour bases)» — только для баз с таким тегом; остальные не показываем.
  const enchants = ((gambleData && gambleData.corruptedEnchants && gambleData.corruptedEnchants[item.itemClass]) || [])
    .filter((e) => { const m = e.match(/\(only (\w+) bases\)/); return !m || tags.includes(m[1]); })
    .map((e) => e.replace(/\s*\(only \w+ bases\)/, ''));
  return { how, enchants };
}


// Кости для Desecration по слоту (poe2db): Gnawed — только до ilvl 64, Preserved — любые, Ancient — моды от 40 уровня.
// Cranium (самоцветы) бывает только Preserved.
// У палочек, посохов и скипетров в тегах нет «weapon», но desecrate на них работает (на скипетре встречаются
// desecrated-моды, при раскрытии — обычные моды) — кость та же, Jawbone.
const BONES = { armour: 'Rib', weapon: 'Jawbone', wand: 'Jawbone', staff: 'Jawbone', sceptre: 'Jawbone', quiver: 'Jawbone', ring: 'Collarbone', amulet: 'Collarbone', belt: 'Collarbone', jewel: 'Cranium' };

// Кости для плана: Gnawed — только ilvl ≤ 64, Preserved — любой, Ancient — моды 40+; Cranium (самоцветы) — только Preserved.
function bonesFor(tags, ilvl) {
  const bone = Object.entries(BONES).find(([tag]) => tags.includes(tag));
  if (!bone) return [];
  if (bone[1] === 'Cranium') return [{ name: 'Preserved Cranium', minLevel: 0 }];
  return [...(ilvl <= 64 ? [{ name: `Gnawed ${bone[1]}`, minLevel: 0 }] : []), { name: `Preserved ${bone[1]}`, minLevel: 0 },
    ...(ilvl >= 40 ? [{ name: `Ancient ${bone[1]}`, minLevel: 40 }] : [])];
}

function boneFor(tags, ilvl) {
  const bone = Object.entries(BONES).find(([tag]) => tags.includes(tag));
  if (!bone) return t('a bone (Rib / Jawbone / Collarbone / Cranium)');
  if (bone[1] === 'Cranium') return 'Preserved Cranium';
  return `${ilvl <= 64 ? `Gnawed ${bone[1]} (${t('item level ≤ 64')}) / ` : ''}Preserved ${bone[1]} / Ancient ${bone[1]} (${t('only modifier level 40+')})`;
}

// Валюта качества по классу вещи.
function qualityCurrency(tags) {
  if (tags.includes('wand') || tags.includes('staff') || tags.includes('sceptre')) return "Arcanist's Etcher";
  if (tags.includes('weapon')) return "Blacksmith's Whetstone";
  return "Armourer's Scrap";
}

const range = (text) => {
  const m = String(text || '').match(/\((-?[\d.]+)-(-?[\d.]+)\)/);
  return m ? `${m[1]}–${m[2]}` : null;
};

// item — разобранный предмет (item.affixes из расширенного формата), demandMods — [{ name, pct }] с poe.ninja.
async function advise(item, demandMods, cached) {
  if (!['Rare', 'Magic', 'Unique', 'Normal'].includes(item.rarity)) return { note: t('Craft tips are for rare, magic, unique items and white bases.') };
  if (item.corrupted || item.mirrored || item.sanctified) {
    return { blocked: item.corrupted ? 'Corrupted' : item.mirrored ? 'Mirrored' : 'Sanctified' };
  }
  // Уник: моды не меняются — только значения (Divine) и рискованный финал (Vaal). Роллы окно считает по фильтрам.
  if (item.rarity === 'Unique') {
    const d = await load(cached);
    const base = d.bases.get(item.baseType);
    return { unique: true, gamble: gambleFor(item, (base && base.tags) || []) };
  }
  if (item.rarity !== 'Normal' && (!item.affixes || !item.affixes.length)) {
    return { note: t('Turn on "Advanced Mod Descriptions" in the game options (or copy with Ctrl+Alt+C) to get craft tips.') };
  }
  const d = await load(cached);
  const base = d.bases.get(item.baseType);
  if (!base) return { note: t('Unknown base "{base}" in RePoE data.', { base: item.baseType }) };
  const tags = base.tags || [];
  // Самоцветы: у каждого мода один тир уровня 1 — Greater/Perfect валюта и Whittling бесполезны (docs/jewels-crafting.md).
  const jewel = tags.includes('jewel');
  const ilvl = item.ilvl || 100;

  // Руна влияния в гнезде («Can roll Destruction modifiers») открывает вещи свой пул модов — добавляем его тег.
  const hasInf = (item.modLines || []).map((l) => l.text.match(/^Can roll (\w+) modifiers$/)).filter(Boolean).map((m) => INF_TAG[m[1]]).filter(Boolean);
  // Моды, которые могут встать на эту базу, и наши аффиксы среди них (по имени и стороне).
  // Мод вещи по аффиксу: название не уникально (у модов личей — «of Kurgal», «Amanamu's» на десятки модов) — при нескольких
  // совпадениях выбираем по тексту строк; моды эссенций (Essences) в пул выпадения не входят — ищем и среди всех модов.
  const findMod = (a, pool) => {
    let same = pool.filter((m) => m.name === a.name && m.generation_type === a.side);
    if (!same.length) same = d.pool.filter((m) => m.name === a.name && m.generation_type === a.side && m.domain !== 'desecrated' === (a.tag !== 'desecrated'));
    // Имя не латиницей — клиент не на английском: ищем по строкам. Английское имя, которого нет в RePoE (устарело), —
    // мод неизвестен, как и раньше (план его не трогает).
    if (!same.length) return /[^\p{ASCII}]/u.test(a.name || '') ? findByLines(a, pool) : null;
    if (same.length > 1 && !(a.lines || []).length) return null;
    if (same.length <= 1 || !(a.lines || []).length) return same[0] || null;
    const lines = new Set((a.lines || []).flatMap((l) => templates(l)));
    return same.find((m) => m.lines.length && m.lines.every((l) => lines.has(l))) || same.find((m) => m.lines.some((l) => lines.has(l))) || null;
  };
  // Клиент не на английском («Божественный»): строки clientLang уже перевёл, ищем мод по ним.
  // Семейство — моды стороны с теми же строками; тир — по номеру из заголовка (T1 — самый высокий из тех, что
  // могут встать на эту базу), без номера — лучший по item level.
  const findByLines = (a, pool) => {
    const lines = new Set((a.lines || []).flatMap((l) => templates(l)));
    if (!lines.size) return null;
    // Desecrated на вещи — чаще обычный мод (в RePoE domain item), реже свой (domain desecrated: моды личей и т.п.).
    const fits = (m) => m.generation_type === a.side && m.lines.length === lines.size && m.lines.every((l) => lines.has(l));
    let same = pool.filter(fits);
    if (!same.length) same = d.pool.filter(fits);
    if (!same.length) return null;
    const own = same.filter((m) => (m.domain === 'desecrated') === (a.tag === 'desecrated'));
    const type = (own[0] || same[0]).type;
    const tiers = same.filter((m) => m.type === type).sort((x, y) => y.required_level - x.required_level);
    if (a.tier && tiers[a.tier - 1]) return tiers[a.tier - 1];
    return tiers.find((m) => m.required_level <= (item.ilvl || 100)) || tiers[tiers.length - 1];
  };
  // Моды вещи добавляют ей теги (adds_tags): «+# to Level of all Fire Spell Skills» — no_cold_spell_mods и т.п. (на посох
  // уже не выпадут Cold / Lightning / Chaos Damage), genesis_tree_minion — минионские моды колец. Пул — с учётом этих тегов.
  const basePool = d.pool.filter((m) => canRoll(m, [...tags, ...hasInf]));
  const addedTags = new Set(item.affixes.flatMap((a) => ((findMod(a, basePool) || {}).adds_tags || [])));
  const onBase = addedTags.size ? d.pool.filter((m) => canRoll(m, [...tags, ...hasInf, ...addedTags])) : basePool;
  const mine = item.affixes.map((a) => ({ ...a, mod: findMod(a, onBase) }));
  const present = new Set(mine.flatMap((a) => (a.mod ? a.mod.groups || [] : [])));

  // Сколько мест: у редкой 3+3 (у самоцветов 2+2 — всего 4 мода), у магической 1+1;
  // «-1 Suffix Modifier allowed» и т.п. — поправка.
  // Магическую вещь Regal Orb делает редкой — поэтому места считаем как у редкой, а первым шагом советуем Regal.
  const magic = item.rarity === 'Magic';
  const perSide = tags.includes('jewel') ? 2 : 3;
  const max = { prefix: perSide, suffix: perSide };
  for (const l of item.modLines || []) {
    const m = l.text.match(/^([+-]\d+) (Prefix|Suffix) Modifiers? allowed$/);
    if (m) max[m[2].toLowerCase()] += Number(m[1]);
  }
  const used = { prefix: mine.filter((a) => a.side === 'prefix').length, suffix: mine.filter((a) => a.side === 'suffix').length };
  const open = { prefix: Math.max(0, max.prefix - used.prefix), suffix: Math.max(0, max.suffix - used.suffix) };

  // Востребованные моды (≥ 15% билдов), которые могут встать: лучший доступный по ilvl тир.
  const want = new Map((demandMods || []).filter((r) => r.pct >= WANT_PCT).map((r) => [r.name.toLowerCase(), r.pct]));
  // Редкое оружие без руны Альдура: стихию модов можно сменить руной (Passion / Ire / Breath / Betrayal) — спрос на
  // стихийный мод считаем по лучшей стихии (Extra Cold на посохе — как Extra Fire), лучшую стихию — советуем.
  const aldur = item.rarity === 'Rare' && ALDUR_WEAPONS.has(item.itemClass) && !(item.modLines || []).some((l) => /^Forged by the \w+ of Aldur$/.test(l.text));
  const bestElement = {};
  if (aldur) {
    const all = new Map((demandMods || []).map((r) => [r.name.toLowerCase(), r.pct]));
    for (const r of demandMods || []) {
      if (!/\b(fire|cold|lightning)\b/i.test(r.name)) continue;
      const vs = ELEMENTS.map((e) => [e, all.get(r.name.replace(/\b(Fire|Cold|Lightning)\b/g, e).toLowerCase()) || 0]);
      const top = vs.reduce((a, b) => (b[1] > a[1] ? b : a));
      if (top[1] >= WANT_PCT) for (const [e] of vs) want.set(r.name.replace(/\b(Fire|Cold|Lightning)\b/g, e).toLowerCase(), top[1]);
      bestElement[r.name.toLowerCase()] = top;
    }
  }
  // Строки, которые на вещи уже есть, не делают кандидата востребованным: у гибрида «броня / урон миньонов»
  // спрос считаем по броне — урон миньонов у вещи уже есть (а при спросе «среди билдов с ним» он был бы 100%).
  const own = new Set((item.modLines || []).flatMap((l) => templates(l.text)));
  // Руна Альдура переведёт стихию — тот же мод в другой стихии на вещи уже «есть» (не кандидат: Fire Spell Skills к Cold).
  if (aldur) for (const l of [...own]) if (/\b(fire|cold|lightning)\b/.test(l)) for (const e of ELEMENTS) own.add(l.replace(/\b(fire|cold|lightning)\b/g, e.toLowerCase()));
  const candidates = (domain, src = onBase) => {
    const byType = new Map();
    for (const m of src) {
      if (m.domain !== domain || m.is_essence_only) continue;
      const pct = Math.max(0, ...m.lines.filter((l) => !own.has(l)).map((l) => want.get(l) || 0));
      if (!pct || (m.groups || []).some((g) => present.has(g))) continue;
      if (!byType.has(m.type)) byType.set(m.type, { side: m.generation_type, pct, tiers: [] });
      byType.get(m.type).tiers.push(m);
    }
    return [...byType.values()].map((c) => {
      const tiers = c.tiers.sort((a, b) => b.required_level - a.required_level);
      const bestIdx = tiers.findIndex((m) => m.required_level <= ilvl);
      if (bestIdx < 0) return null;
      const best = tiers[bestIdx];
      return { side: c.side, pct: c.pct, text: best.lines.join(' / '), tier: bestIdx + 1, tiers: tiers.length,
        range: range(best.text), level: best.required_level, stats: tradeStats(best, domain, item.itemClass), type: best.type };
    }).filter(Boolean).sort((a, b) => b.pct - a.pct);
  };

  // Ключевой мод со слабым тиром: его носят многие билды, но тир низкий — ценен тир повыше, а не другой мод.
  const tierUps = mine.filter((a) => a.mod && a.tag !== 'fractured' && a.tier >= 3).map((a) => {
    const pct = Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0));
    if (pct < KEY_PCT) return null;
    const tiers = onBase.filter((m) => m.type === a.mod.type && m.domain === a.mod.domain).sort((x, y) => y.required_level - x.required_level);
    const bestIdx = tiers.findIndex((m) => m.required_level <= ilvl);
    if (bestIdx < 0 || bestIdx + 1 >= a.tier) return null;
    const how = [t('Divine Orb — rerolls the values of all modifiers at once, each only within its tier (now T{tier})', { tier: a.tier })];
    how.push(a.tag === 'desecrated'
      ? t('Orb of Annulment + Omen of Light removes it; desecrating again gives a random desecrated modifier — not necessarily this one')
      : t('A higher tier means removing it and rolling it again — the same modifier is not guaranteed'));
    return { text: a.mod.lines.join(' / '), tier: a.tier, best: bestIdx + 1, range: range(tiers[bestIdx].text), pct, how };
  }).filter(Boolean);

  const normal = candidates('item');
  // Что может занять crafted-слот и дать конкретный мод: Perfect- и порченые эссенции, Alloys этого класса.
  const craftedSources = [...perfectFor(item.itemClass).map((x) => ({ name: x.name, text: x.mod })), ...corruptedFor(item.itemClass)];
  // Руна влияния ещё не вставлена: моды её пула, нужные по спросу, — тоже кандидаты, но с условием «сначала руна»
  // (вставляется навсегда в свободное augment-гнездо). Thrud's Might на оружии → «Explicit Speed Modifier magnitudes» и т.п.
  const runes = (item.modLines || []).filter((l) => l.tag === 'rune').length;
  const freeSocket = (item.sockets || 0) > runes;
  for (const r of INFLUENCE_RUNES) {
    if (hasInf.includes(r.tag) || !r.on.some((tg) => tags.includes(tg)) || hasInf.length) continue;
    const extra = d.pool.filter((m) => canRoll(m, [...tags, r.tag]) && !canRoll(m, tags));
    for (const c of candidates('item', extra)) {
      if (normal.some((x) => x.type === c.type)) continue;
      normal.push({ ...c, needs: { rune: r.rune, line: `Can roll ${r.name} modifiers`, free: freeSocket } });
    }
  }
  // Crafted-слотов на вещи: один, плюс руна Astrid's Creativity — «Can have 1 additional Crafted Modifier».
  const craftedCap = 1 + (item.modLines || []).reduce((n, l) => { const m = l.text.match(/^Can have (\d+) additional Crafted Modifiers?$/); return n + (m ? +m[1] : 0); }, 0);
  // Крафтовый мод, которого нет обычным аффиксом (Celestial Alloy — «+Accuracy / Attack Speed» на копьях, булавах, луках…):
  // кандидат «только через crafted-слот» (снимает случайный мод стороны и ставит свой). Ценность — по спросу его строк.
  // Берём один лучший: crafted-слот на вещи один.
  if (item.affixes.filter((a) => a.tag === 'crafted').length < craftedCap) {
    let best = null;
    for (const x of craftedSources) {
      if (!x.side || !['prefix', 'suffix'].includes(x.side)) continue;
      const raw = x.text.replace(/–/g, '-').replace(/ \/ /g, '\n'); // гибрид в данных — через « / »
      const lines = templates(raw);
      if (normal.some((c) => c.side === x.side && lines.every((l) => c.text.split(' / ').includes(l)))) continue; // такое и Exalted даёт
      if (lines.every((l) => own.has(l))) continue; // такой мод на вещи уже есть (гибрид с одной общей строкой — можно)
      const ps = lines.map((l) => want.get(l) || 0).sort((a, b) => b - a);
      // Ценность гибрида: лучшая строка + половина второй (для выбора и плана). Это не доля билдов — может быть больше 100;
      // окно показывает долю лучшей строки (shownPct) и по строкам (pctParts).
      const pct = (ps[0] || 0) + (ps[1] || 0) / 2;
      if (pct >= WANT_PCT && (!best || pct > best.pct)) best = { side: x.side, pct, shownPct: ps[0] || 0, pctParts: lines.map((l) => [l, want.get(l) || 0]),
        text: lines.join(' / '), tier: null, tiers: 1, range: null, level: 0,
        stats: tradeStats({ text: raw }, 'item', item.itemClass), type: 'crafted:' + x.name, crafted: [x.name], craftedOnly: x.name };
    }
    if (best) normal.push(best);
  }
  normal.sort((a, b) => b.pct - a.pct);
  // Примерный шанс, что следующий мод на этой стороне (Exalted + омен стороны) — именно этот: частота семейства среди всех,
  // что могут встать сюда (без уже занятых групп), по собранной статистике. Семейства без данных считаем как самые редкие.
  // Что может добавить Exalted на каждую сторону: семейство → уровни его тиров на этой вещи (без занятых групп).
  const sidePool = {};
  for (const side of ['prefix', 'suffix']) {
    const lv = new Map();
    for (const m of onBase) {
      if (m.domain !== 'item' || m.generation_type !== side || m.is_essence_only || m.required_level > ilvl
        || (m.groups || []).some((g) => present.has(g))) continue;
      if (!lv.has(m.type)) lv.set(m.type, []);
      lv.get(m.type).push(m.required_level);
    }
    sidePool[side] = lv;
  }
  let nOf = null; // частота семейства по собранной статистике (если есть)
  const W = weights();
  const wc = W && W.classes[item.itemClass];
  let chanceMeta = null;
  if (wc && wc.items >= 50) {
    chanceMeta = { items: wc.items, collected: W.meta.collected, league: W.meta.league };
    const counts = familyCounts(wc, (type) => Math.max(0, ...(d.typeLines.get(type) || []).map((l) => want.get(l) || 0)));
    // Статистика — по всему классу (все ботинки), а моды защиты встают только на свои базы (уклонение — на «ловкие»).
    // Делим частоту на долю «типов баз» класса, где семейство вообще может выпасть: оценка веса, как если бы оно было везде.
    const share = eligibleShare(d, base);
    for (const type of Object.keys(counts)) counts[type] /= Math.max(share(type), 0.1);
    const n = (type) => (counts[type] || 0) + SMOOTH;
    nOf = n;
    for (const side of ['prefix', 'suffix']) {
      const types = new Set(sidePool[side].keys());
      const total = [...types].reduce((s, type) => s + n(type), 0);
      // Ценные моды (≥ SALE_REASON% билдов) по трейду честно не оценить: без потолка цены они завышены (такие вещи охотнее
      // выставляют), с потолком — занижены (такие вещи дороже). Шанс для них не показываем.
      for (const c of normal.filter((x) => x.side === side)) {
        if (c.pct >= SALE_REASON) c.chance = null, c.chanceUnknown = true;
        else if (total && types.has(c.type)) c.chance = n(c.type) / total;
      }
    }
  }
  // Exalted / Greater (моды 35+) / Perfect (50+): шанс, что следующий мод — это семейство в одном из двух лучших тиров
  // (цель крафта считается по лучшему тиру). Веса тиров внутри семейства неизвестны — считаем равными.
  // chance — по статистике (null у ценных модов и без данных), guess — как если бы все семейства были равновероятны:
  // им окно выбирает валюту, когда шанс неизвестен. pool — сколько семейств вообще может выпасть.
  // Desecration: при раскрытии у Well of Souls предлагают 3 мода на выбор — из обычного пула стороны и своих
  // desecrated-модов (их веса неизвестны — считаем средними). single — шанс одного варианта; окно считает «среди 3 (6 с Abyssal Echoes)».
  const desFamilies = {};
  for (const side of ['prefix', 'suffix']) {
    desFamilies[side] = new Set(onBase.filter((m) => m.domain === 'desecrated' && m.generation_type === side && m.required_level <= ilvl).map((m) => m.type)).size;
  }
  const bones = bonesFor(tags, ilvl);
  const desecrateOK = !item.desecratedItem;
  // Desecrated-мод, которого нет обычным аффиксом (моды личей: «+1 Ballista Totem», «ES from Equipped Body Armour»…):
  // кандидат «только через Desecrate» (docs/crafting-methods-research.md). Без омена — 1 из всех семейств стороны;
  // с лич-оменом (Sovereign → Ulaman, Liege → Amanamu, Blackblooded → Kurgal; оружие и бижутерия, ilvl 65+) все
  // варианты раскрытия — из пула этого лича: при ≤ 3 модах на стороне нужный гарантирован. Слот один — берём лучший.
  if (desecrateOK && !mine.some((a) => a.tag === 'desecrated') && bones.length) {
    let best = null;
    for (const c of candidates('desecrated')) {
      if (normal.some((x) => x.type === c.type || x.text === c.text)) continue;
      if (c.pct >= WANT_PCT && (!best || c.pct > best.pct)) best = c;
    }
    // Altered Collarbone (бижутерия): Desecrate «с шансом на потусторонние моды» — свой пул Breach-модов
    // (тег breach_desecration, уровень 1 — Whittling снимет их первыми). Доля потусторонних среди вариантов неизвестна.
    const jewellery = ['ring', 'amulet', 'belt'].some((tg) => tags.includes(tg));
    if (jewellery) {
      const altered = d.pool.filter((m) => m.domain === 'desecrated' && canRoll(m, [...tags, 'breach_desecration']) && !canRoll(m, tags));
      for (const c of candidates('desecrated', altered)) {
        if (normal.some((x) => x.type === c.type || x.text === c.text)) continue;
        if (c.pct >= WANT_PCT && (!best || c.pct > best.pct)) {
          const n = new Set(altered.filter((m) => m.generation_type === c.side && !(m.groups || []).some((g) => present.has(g))).map((m) => m.type)).size || 1;
          best = { ...c, altered: n };
        }
      }
    }
    if (best && best.altered) {
      best.desecrateOnly = true;
      best.desecrate = { 'Altered Collarbone': { pool: best.altered, good: 1, guess: 1 / best.altered, chance: null, altered: true } };
      normal.push(best);
      normal.sort((a, b) => b.pct - a.pct);
      best = null;
    }
    if (best) {
      const mod = onBase.find((x) => x.domain === 'desecrated' && x.type === best.type);
      const lich = Object.keys(LICH_OMEN).find((l) => ((mod && mod.implicit_tags) || []).includes(`${l}_mod`));
      const lichOK = lich && ilvl >= 65 && LICH_CLASSES.some((tg) => tags.includes(tg));
      const sideDes = onBase.filter((x) => x.domain === 'desecrated' && x.generation_type === best.side && x.required_level <= ilvl
        && !(x.groups || []).some((g) => present.has(g)));
      const fam = new Set([...sideDes.map((x) => x.type), ...sidePool[best.side].keys()]).size || 1;
      const lichN = lichOK ? new Set(sideDes.filter((x) => (x.implicit_tags || []).includes(`${lich}_mod`)).map((x) => x.type)).size || 1 : 0;
      best.desecrateOnly = true;
      best.desecrate = {};
      for (const b of bones) {
        // Gnawed — вещи до ilvl 64: эксклюзивов 65 уровня (моды личей) не даёт (docs/crafting-tricks.md).
        if (mod && mod.required_level >= 65 && /^Gnawed/.test(b.name)) continue;
        best.desecrate[b.name] = { pool: fam, good: 1, guess: 1 / fam, chance: 1 / fam };
        if (lichOK) best.desecrate[`${b.name}|${LICH_OMEN[lich]}`] = { pool: lichN, good: 1, guess: 1 / lichN, chance: 1 / lichN, extra: [LICH_OMEN[lich]], lich: { name: lich, n: lichN } };
      }
      normal.push(best);
      normal.sort((a, b) => b.pct - a.pct);
    }
  }
  for (const c of normal) {
    const lv = sidePool[c.side];
    const mineLv = lv.get(c.type);
    if (!mineLv) continue;
    const top = [...mineLv].sort((a, b) => b - a).slice(0, 2).pop();
    // Шанс, что мод (среди обычных с уровнем ≥ L и extra «чужих» семейств средним весом) — это семейство в T1–T2.
    // Мин. уровень (Greater/Perfect, Ancient-кость) отсекает низкие тиры, но семейство без тиров выше порога
    // всё равно выпадает своим лучшим тиром (docs/crafting-tricks.md §0) — семейства из пула не исчезают.
    const at = (L, extra = 0) => {
      const allowed = (type) => { const l = lv.get(type); const ok = l.filter((x) => x >= L); return ok.length ? ok : [Math.max(...l)]; };
      const share = (type) => allowed(type).length / lv.get(type).length;
      const okC = allowed(c.type);
      const good = okC.filter((x) => x >= top).length / okC.length;
      const types = [...lv.keys()];
      const odds = (w) => { const sum = types.reduce((s, type) => s + w(type), 0); return w(c.type) / (sum + extra * sum / types.length) * good; };
      return { pool: types.length + extra, good, guess: odds(share), chance: nOf && !c.chanceUnknown ? odds((type) => nOf(type) * share(type)) : null };
    };
    c.exalt = {};
    for (const [k, L] of Object.entries(EXALT_MIN)) {
      if (L && tags.includes('jewel')) continue; // у самоцветов один тир — дорогие Exalted ничего не дают
      const o = at(L);
      if (o) c.exalt[k] = o;
    }
    if (desecrateOK && bones.length && !c.desecrateOnly) {
      c.desecrate = {};
      for (const b of bones) { const o = at(b.minLevel, desFamilies[c.side]); if (o) c.desecrate[b.name] = o; }
    }
    // Гарантированный мод через crafted-слот: Perfect- и порченые эссенции («снимают случайный мод и добавляют свой»).
    const lines = c.text.split(' / ');
    // Источник подходит, если даёт ВСЕ строки мода (Celestial Alloy «Mana / +1 Spell Skills» — для «+Mana», но не для «Spell Damage / Mana»).
    if (!c.craftedOnly) c.crafted = craftedSources.filter((x) => { const src = templates(x.text.replace(/–/g, '-').split(' / ').join('\n')); return lines.every((l) => src.includes(l)); }).map((x) => x.name);
    // Блокер (docs/crafting-tricks.md T-08, D-5): на стороне есть частое ненужное семейство — дешёвый мод этой группы
    // (например, выбранный при раскрытии desecrate) закрывает её для следующих Exalted; потом его снимают.
    if (nOf) {
      const isWanted = (type) => normal.some((x) => x.type === type && x.side === c.side);
      let sum = 0, junk = null;
      for (const type of lv.keys()) {
        const w = nOf(type);
        sum += w;
        if (type !== c.type && !isWanted(type) && (!junk || w > junk.w)) junk = { type, w };
      }
      if (junk && junk.w / sum >= 0.12) c.blocker = { text: (d.typeLines.get(junk.type) || [junk.type]).join(' / '), share: junk.w / sum };
    }
  }
  for (const c of normal) c.essence = essenceFor(c.text, item.itemClass);
  // Крафтовый гибрид (Alloy) не нужен, если нужный мод сопоставимой ценности ставит эссенция (Perfect Essence of Sorcery +3
  // к уровням на палочке лучше гибрида «mana / spell levels»): crafted-слот один.
  const co = normal.find((c) => c.craftedOnly);
  if (co && normal.some((c) => c !== co && c.crafted && c.crafted.some((n) => n !== co.craftedOnly) && c.pct >= co.pct * 0.6)) normal.splice(normal.indexOf(co), 1);
  for (const c of normal) {
    const others = normal.filter((x) => x !== c && x.side === c.side && x.exalt && x.pct >= Math.max(15, c.pct * 0.6));
    if (!others.length || !c.exalt) continue;
    const merge = (list) => ({ ...list[0], guess: Math.min(0.95, list.reduce((a, o) => a + o.guess, 0)),
      chance: list.some((o) => o.chance == null) ? null : Math.min(0.95, list.reduce((a, o) => a + o.chance, 0)) });
    c.exaltAny = {};
    for (const k of Object.keys(c.exalt)) c.exaltAny[k] = merge([c.exalt[k], ...others.map((x) => x.exalt[k]).filter(Boolean)]);
    if (c.desecrate) {
      c.desecrateAny = {};
      for (const b of Object.keys(c.desecrate)) c.desecrateAny[b] = merge([c.desecrate[b], ...others.map((x) => x.desecrate && x.desecrate[b]).filter(Boolean)]);
    }
    c.orMods = others.map((x) => x.text);
  }
  if (item.rarity === 'Normal') return { normal: transmuteOptions(normal, sidePool, nOf, ilvl, jewel), popular: normal.slice(0, 8), chanceMeta };
  const sections = [];

  // 0. Магическая → редкая: эссенция даёт гарантированный мод, Regal — случайный из всего пула.
  // Магическая со свободным местом (1 префикс + 1 суффикс): сначала дёшево добить Augmentation, пока она магическая.
  const magicFree = magic ? ['prefix', 'suffix'].filter((s) => !mine.some((a) => a.side === s)) : [];
  if (magicFree.length) {
    sections.push({ kind: 'magicfill', how: [
      t('Orb of Augmentation — adds a random {side} while the item is magic: the cheapest step, do it before Regal', { side: t(magicFree[0]) }),
      jewel ? t('On jewels every modifier has one tier — Greater / Perfect currency gives nothing extra') : t('Greater / Perfect Orb of Augmentation — only modifiers of level 44+ / 70+'),
    ], candidates: normal.filter((c) => c.side === magicFree[0]).slice(0, 6) });
  }
  if (magic) {
    const sure = normal.filter((c) => c.essence);
    sections.push({ kind: 'upgrade', how: [
      ...[...new Map(sure.map((c) => [c.essence.name, c])).values()].slice(0, 4)
        .map((c) => t('{essence} — rare with guaranteed {mod}: {tiers}', { essence: c.essence.name, mod: c.text, tiers: c.essence.tiers.join(' · ') })),
      ...(sure.length ? [t("An essence uses the item's only crafted-modifier slot: no Perfect Essence or Alloy later")] : []),
      t('Regal Orb — makes it rare with one random modifier from the whole pool; the popular ones below are only some of the outcomes'),
      ...(jewel ? [] : [t('Greater / Perfect Regal Orb — the same, but only modifiers of level 35+ / 50+')]),
      t('Omen of Sinistral / Dextral Coronation — the next Regal Orb adds only a prefix / only a suffix'),
      t('Orb of Alchemy — rerolls into a rare with 4 new random modifiers (current ones are lost); Omen of Sinistral / Dextral Alchemy — as many prefixes / suffixes as possible'),
      // Магическая с одним модом — второй можно добавить до Regal: Greater / Perfect Augmentation даёт только моды высокого уровня.
    ] });
  }

  // 1. Свободные места — Exalted Orb (Omen Sinistral/Dextral Exaltation — только префикс/суффикс).
  for (const side of ['prefix', 'suffix']) {
    if (!open[side]) continue;
    const list = normal.filter((c) => c.side === side).slice(0, 6);
    const omen = side === 'prefix' ? 'Omen of Sinistral Exaltation' : 'Omen of Dextral Exaltation';
    const exalt = `Exalted Orb${open.prefix && open.suffix ? ` + ${omen} (${t(`only ${side}es`)})` : ''}`;
    sections.push({
      kind: 'open', side, count: open[side],
      how: [magic ? t("after it's rare: {how}", { how: exalt }) : exalt, ...(jewel ? [] : [t('Greater / Perfect Exalted Orb — only modifiers of level 35+ / 50+')]),
        ...(open[side] >= 2 ? [t('Omen of Greater Exaltation — the next Exalted Orb adds two modifiers')] : [])],
      candidates: list,
    });
  }

  // 2. Всё занято — заменить самый слабый мод: тир хуже всех и не востребован. Fractured не снять.
  if (!open.prefix && !open.suffix) {
    // Хорошие тиры (T1–T2) не меняем никогда: даже невостребованный T1 дороже лотереи с Annulment.
    // Востребованные моды (≥ KEY_PCT% билдов) тоже не меняем на другие — даже со слабым тиром: им нужен тир повыше (блок ниже).
    const scored = mine.filter((a) => a.mod && a.tag !== 'fractured' && !(a.tier && a.tier <= 2)).map((a) => {
      const pct = Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0));
      return { ...a, pct, score: pct / 100 * 3 - (a.tier || 3) / 3 };
    }).filter((a) => a.pct < KEY_PCT).sort((a, b) => a.score - b.score);
    const weak = scored[0];
    if (!weak) { if (!tierUps.length) sections.push({ kind: 'keep' }); }
    else {
      const sameSide = mine.filter((a) => a.side === weak.side && a.tag !== 'fractured').length;
      // Whittling смотрит на ВСЕ моды вещи (кроме fractured), а не только на кандидатов в замену.
      const cands = mine.filter((a) => a.tag !== 'fractured');
      const known = cands.every((a) => a.mod);
      const byLevel = cands.filter((a) => a.mod).sort((a, b) => a.mod.required_level - b.mod.required_level);
      const lowest = known && byLevel.length && (byLevel.length < 2 || byLevel[0].mod.required_level < byLevel[1].mod.required_level) ? byLevel[0] : null;
      const erasure = weak.side === 'prefix' ? 'Omen of Sinistral Erasure' : 'Omen of Dextral Erasure';
      const omen = weak.side === 'prefix' ? 'Omen of Sinistral Annulment' : 'Omen of Dextral Annulment';
      const how = weak.tag === 'desecrated'
        // Desecrated снимается прицельно: Omen of Light — Annulment убирает только desecrated-моды.
        ? [t('Orb of Annulment + Omen of Light — removes the desecrated modifier (any tier), then desecrate again or Exalted Orb')]
        : [t(`Orb of Annulment + {omen} — removes a random ${weak.side} (1 in {n} to hit this one), then Exalted Orb`, { omen, n: sameSide }),
          t(`Chaos Orb + {omen} — removes a random ${weak.side} and adds a random modifier (Greater / Perfect Chaos: level 35+ / 50+)`, { omen: erasure })];
      // У самоцветов все моды одного уровня — Whittling снимает фактически случайный.
      if (!jewel && lowest && lowest.name === weak.name && weak.tag !== 'desecrated') {
        how.unshift(t('Chaos Orb + Omen of Whittling — removes the lowest-level modifier (this one) and adds a random modifier'));
      }
      sections.push({
        kind: 'replace', weak: { name: weak.name, side: weak.side, tier: weak.tier, text: weak.mod.lines.join(' / '), pct: weak.pct },
        how, candidates: normal.filter((c) => c.side === weak.side).slice(0, 5),
      });
    }
  }

  if (tierUps.length) sections.push({ kind: 'tierup', mods: tierUps });

  // 3. Desecration — свой пул desecrated-модов, одна на вещь.
  if (!item.desecratedItem && !mine.some((a) => a.tag === 'desecrated')) {
    const des = candidates('desecrated').filter((c) => open[c.side] || (!open.prefix && !open.suffix)).slice(0, 4);
    if (des.length) {
      // Desecrated — отдельный слот (не crafted), но на полной вещи снимает случайный мод: осквернять ДО Exalt-ов.
      // Лич-омены — «Weapon or Jewellery» (и пояса — подтверждено, docs/crafting-methods-research.md), моды личей — 65 уровня.
      // Те же правила, что у плана (LICH_CLASSES): иначе план тратил омен, а подсказка о нём молчала.
      const lich = ilvl >= 65 && LICH_CLASSES.some((tg) => tags.includes(tg));
      const bodyGear = ['body_armour', 'helmet', 'gloves', 'boots'].some((x) => tags.includes(x));
      sections.push({ kind: 'desecrate', how: [
        t('Desecrate with {bone} — adds an unrevealed desecrated modifier', { bone: boneFor(tags, ilvl) }) + (!open.prefix && !open.suffix ? ` (${t('replaces a random one when full')})` : ''),
        t('Desecrate before the Exalted Orbs — on a full item it removes a random modifier'),
        t('Omen of Sinistral / Dextral Necromancy — only a prefix / only a suffix'),
        t('On reveal you choose 1 of 3 options; they can include normal modifiers unless a lich omen is used; Omen of Abyssal Echoes rerolls the options once'),
        ...(bodyGear ? [t('Body armour, helmets, gloves and boots have no desecrated prefixes — Sinistral Necromancy gives only normal prefixes')] : []),
        ...(lich ? [t('Omen of the Sovereign / the Liege / the Blackblooded — guaranteed Ulaman / Amanamu / Kurgal modifier')] : []),
      ], candidates: des });
    }
  }

  // Perfect-эссенции — только на редких: убирают случайный мод и добавляют свой (у слота свой набор, не тот, что у Greater).
  // С 0.5 на вещи только один crafted-мод (эссенции, в т.ч. Perfect и порченые, и Alloy). Есть — Perfect/Alloy не встанут.
  const hasCrafted = mine.some((a) => a.tag === 'crafted');
  // Всё, что заменяет случайный мод гарантированным crafted-модом: Perfect-эссенции, порченые эссенции, Alloy (data/crafting-currency.json).
  const perfect = item.rarity === 'Rare' ? [...perfectFor(item.itemClass), ...guaranteedFor(item.itemClass)] : [];
  if (jewel && item.rarity === 'Rare') {
    const timeLost = tags.includes('radius_jewel');
    // Обычные Potent-эмоции — только на базовые самоцветы, Ancient — только на Time-Lost (у них свои моды).
    const emotions = timeLost
      ? [t('Ancient Potent Liquid Contempt — +1 Prefix / Suffix Modifier allowed'),
        t('Ancient Potent Liquid Melancholy — Upgrades Radius to Very Large (prefix)'),
        t('Ancient Potent Liquid Ferocity — Notable Passives in Radius also grant +(5–7)% Fire / Cold / Lightning Resistance (Diamond: Chaos)'),
        t('Regular Potent emotions fit only basic jewels')]
      : [t('Potent Ferocity — (40–60)% increased Effect of Suffixes (as a prefix) or of Prefixes'),
        t('Potent Contempt — +1 Suffix / Prefix Modifier allowed: a third modifier on one side for a slot on the other ("5-line" jewels)')];
    sections.push({ kind: 'emotions', how: hasCrafted
      ? [t('This item already has a crafted modifier — Liquid Emotions cannot be used (one crafted modifier per item)')]
      : [...emotions, t('Removes a random modifier; uses the only crafted-modifier slot'), t("Hinekora's Lock first — see the result before you commit")] });
  }
  if (perfect.length && hasCrafted) {
    sections.push({ kind: 'perfect', how: [t('This item already has a crafted modifier — Perfect Essences and Alloys cannot be used (one crafted modifier per item)')] });
  } else if (perfect.length) {
    sections.push({ kind: 'perfect', how: [...perfect.map((p) => `${p.name} — ${p.mod}`),
      t('Omen of Sinistral / Dextral Crystallisation — the Perfect Essence removes only a prefix / only a suffix'),
      t('Uses the only crafted-modifier slot (one per item; Alloys too)'),
      t("Hinekora's Lock first — see the result before you commit")] });
  }

  // 4. Дёшево и без риска.
  const cheap = [];
  const armourOrWeapon = tags.includes('armour') || tags.includes('weapon') || tags.includes('onehand') || tags.includes('twohand');
  // Artificer's Orb — оружие, жезлы, посохи и броня (скипетров в списке нет).
  // Artificer's: 2 гнезда на двуручном оружии и нательнике, 1 на остальном (по гайдам).
  const maxSockets = tags.includes('twohand') || tags.includes('body_armour') ? 2 : 1;
  if (armourOrWeapon && !tags.includes('sceptre') && (item.sockets || 0) < maxSockets) cheap.push(t("Artificer's Orb — add an augment socket (2 max on two-handed weapons and body armour, 1 elsewhere), then a rune or soul core"));
  if (armourOrWeapon && (item.quality || 0) < 20) cheap.push(t('Quality to 20% (currently {n}%) — {currency}', { n: item.quality || 0, currency: qualityCurrency(tags) }));
  if ((tags.includes('ring') || tags.includes('amulet')) && !item.quality) cheap.push(t('Catalyst — quality on rings and amulets boosts matching modifiers (life, minion, caster…); Omen of Catalysing Exaltation makes the next Exalted Orb consume all catalyst quality to favour that type — re-apply the catalyst afterwards'));
  if (jewel && !item.quality) cheap.push(t('Refined Catalyst — quality on jewels boosts matching modifiers'));
  if (aldur) {
    const tally = {};
    for (const a of mine) {
      for (const l of (a.mod && a.mod.lines) || []) {
        const cur = (l.match(/\b(fire|cold|lightning)\b/) || [])[1];
        const top = bestElement[l];
        if (!cur || !top) continue;
        const curPct = want.get(l) != null && top[0].toLowerCase() === cur ? top[1] : ((demandMods || []).find((r) => r.name.toLowerCase() === l) || {}).pct || 0;
        tally[top[0]] = tally[top[0]] || { gain: 0, from: cur };
        if (top[0].toLowerCase() !== cur) tally[top[0]].gain += top[1] - curPct;
      }
    }
    const best = Object.entries(tally).sort((a, b) => b[1].gain - a[1].gain)[0];
    if (best && best[1].gain >= 10) cheap.push(t('{rune} turns the {from} modifiers into {to} for good — {to} versions are more in demand; check «Other elements» on the Price tab before you socket it', { rune: ALDUR_RUNE[best[0]], from: best[1].from, to: best[0] }));
  }
  // +3 к уровню умений на бижутерии при качестве 34%+ становится +4 (3 × 1.34); Essence of the Breach поднимает
  // потолок качества на 20% (docs/crafting-tricks.md T-11, по данным сообщества).
  const plus3 = (tags.includes('ring') || tags.includes('amulet')) && (item.modLines || []).find((l) => /^\+3 to Level of all .*Skills$/.test(l.text));
  if (plus3 && (item.quality || 0) < 34) cheap.push(t('Quality 34%+ turns «{mod}» into +4: a matching catalyst, and Essence of the Breach raises the quality cap by 20% (community finding, not verified)', { mod: plus3.text }));
  const total = mine.length;
  if (cheap.length) sections.push({ kind: 'cheap', how: cheap });
  // Fracturing — не «дёшево и без риска»: в 0.5 редкий (только атлас) и фиксирует СЛУЧАЙНЫЙ мод.
  // Нужно ≥ 4 модов (desecrated, даже нераскрытый, в счёт входит), но desecrated и уже fractured не фиксируются:
  // шанс = ключевые / фиксируемые. Приём: 3 обычных мода + Desecrate без раскрытия → 4 мода, шанс 1/3 вместо 1/4
  // (docs/crafting-tricks.md D-4, T-05).
  if (!magic && !item.fracturedItem) {
    const pctOf = (a) => (a.mod ? Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0)) : 0);
    const fixable = mine.filter((a) => a.tag !== 'desecrated' && a.tag !== 'fractured');
    const keys = fixable.filter((a) => pctOf(a) >= KEY_PCT || (a.tier && a.tier <= 2 && pctOf(a) >= WANT_PCT));
    const hasDes = mine.some((a) => a.tag === 'desecrated');
    const how = [];
    if (keys.length && total >= 4) {
      how.push(t('Fracturing Orb — locks a random modifier forever: 1 in {n} to lock a key one ({mods})',
        { n: Math.round(fixable.length / keys.length * 10) / 10, mods: keys.map((a) => a.mod.lines.join(' / ')).join(', ') }));
      if (!hasDes && fixable.length === 4 && bones.length) how.push(t('Better odds: remove one unwanted modifier, then desecrate and do not reveal — 3 regular + 1 unrevealed gives 1 in {n}', { n: Math.round(3 / keys.length * 10) / 10 }));
    } else if (keys.length && total === 3 && !hasDes && bones.length) {
      how.push(t('Fracturing Orb needs 4 modifiers: desecrate first and do not reveal — an unrevealed desecrated modifier counts but cannot be locked: 1 in {n} to lock {mods}',
        { n: Math.round(3 / keys.length * 10) / 10, mods: keys.map((a) => a.mod.lines.join(' / ')).join(', ') }));
    }
    if (how.length) {
      how.push(t('After it: remove the rest (Annulment) and rebuild around the locked modifier; a miss locks a useless one — the base is spent'));
      how.push(t("Hinekora's Lock (preview the result first) — only if the item is worth far more than the Lock"));
      sections.push({ kind: 'risky', how, prices: ['Fracturing Orb', "Hinekora's Lock"] });
    }
  }

  const goal = planGoal(mine, normal, max, want, magic, magicFree, item.itemClass, craftedSources, item.quality || 0, craftedCap);
  // Руны / Soul Cores в гнёзда: аугменты для класса, чьи статы носят билды (спрос ≥ 15%) — лучший по семейству статов.
  const augments = [];
  if (!jewel) {
    const fam = new Map();
    for (const a of d.augs || []) {
      const cat = a.cats.find((c) => augFits(c.target, item.itemClass));
      if (!cat || a.level > (item.reqLevel || 100) + 20) continue;
      // Руны влияния, Альдура и Legacy (только уники) учитываются отдельно.
      const kind = methods.byName(a.name);
      if ((kind && ['rune-influence', 'rune-aldur', 'rune-special'].includes(kind.id)) || /Legacy/.test(a.limit || '') || /^Legacy of /.test(a.name)) continue;
      const pct = Math.max(0, ...cat.lines.map((l) => want.get(l) || 0));
      if (pct < WANT_PCT) continue;
      const key = cat.lines.join('|');
      const rank = (n) => (/^Perfect /.test(n) ? 3 : /^Greater /.test(n) ? 2 : /^Lesser /.test(n) ? 0 : 1);
      const prev = fam.get(key);
      if (!prev || rank(a.name) > rank(prev.name)) fam.set(key, { name: a.name, lines: cat.lines, pct, ancient: /Ancient/.test(a.limit || '') });
    }
    augments.push(...[...fam.values()].sort((x, y) => y.pct - x.pct).slice(0, 4));
  }
  const runesIn = (item.modLines || []).filter((l) => l.tag === 'rune').length;
  const gamble = gambleFor(item, tags);
  return { open, max, sections, goal, gamble, augments, freeSockets: Math.max(0, (item.sockets || 0) - runesIn), chanceMeta, source: 'RePoE (game files) · demand: poe.ninja' };
}

// Белая база → магическая: Orb of Transmutation даёт один случайный мод (префикс или суффикс);
// Greater — только моды уровня 44+, Perfect — 70+ (меньше мусора, выше тиры). Для каждого: сколько семейств может выпасть,
// шанс популярного мода (любой тир) и популярного в одном из двух лучших тиров. Веса — по статистике (nOf) или поровну.
const TRANSMUTE = methods.tiers('transmute');
function transmuteOptions(popular, sidePool, nOf, ilvl, jewel) {
  const out = [];
  for (const [name, L] of TRANSMUTE) {
    if (L && (jewel || ilvl < L)) continue;
    let total = 0, any = 0, top = 0, pool = 0;
    for (const side of ['prefix', 'suffix']) {
      for (const [type, lv] of sidePool[side]) {
        // Семейство без тиров выше порога выпадает лучшим тиром (как у Exalted).
        const hi = lv.filter((x) => x >= L);
        const ok = hi.length ? hi : [Math.max(...lv)];
        const w = (nOf ? nOf(type) : 1) * ok.length / lv.length;
        total += w;
        pool++;
        const c = popular.find((x) => x.type === type && x.side === side);
        if (!c) continue;
        const best = [...lv].sort((a, b) => b - a).slice(0, 2).pop();
        any += w;
        top += w * ok.filter((x) => x >= best).length / ok.length;
      }
    }
    if (total) out.push({ name, minLevel: L, pool, any: any / total, top: top / total });
  }
  return out;
}

// Доля «типов баз» класса (по набору тегов: str_armour, dex_int_armour…), на которых семейство мода может выпасть.
const shareCache = new Map();
craftData.onReset(() => shareCache.clear());
function eligibleShare(d, base) {
  const key = base.item_class;
  if (!shareCache.has(key)) {
    const profiles = new Map();
    for (const b of d.bases.values()) {
      if (b.item_class !== key || b.release_state !== 'released' || b.domain !== 'item') continue;
      const tags = (b.tags || []).filter((t) => !/_basetype$/.test(t)).sort();
      profiles.set(tags.join(','), tags);
    }
    const byType = new Map();
    for (const m of d.pool) {
      if (m.domain !== 'item') continue;
      if (!byType.has(m.type)) byType.set(m.type, new Set());
      for (const [k, tags] of profiles) if (canRoll(m, tags)) byType.get(m.type).add(k);
    }
    shareCache.set(key, (type) => (profiles.size && byType.has(type) ? byType.get(type).size / profiles.size : 1));
  }
  return shareCache.get(key);
}

// Частоты семейств модов для оценки шансов.
// По модам каждой вещи (raw): на каждой вещи не считаем «причину продажи» — самый востребованный мод, если его
// носят ≥ SALE_REASON% билдов: вещь выставили ради него, а остальные её моды выпали случайно.
const SALE_REASON = 30;
const SMOOTH = 1; // +1 к каждому семейству: единичные находки не раздуваются, ненайденные не уходят в ноль
function familyCounts(wc, pctOf) {
  if (!wc.raw) return {};
  const kept = {}, raw = {};
  for (const row of wc.raw) {
    let drop = -1, best = SALE_REASON - 1;
    row.forEach(([ti], k) => { const p = pctOf(wc.types[ti]); if (p > best) { best = p; drop = k; } });
    row.forEach(([ti], k) => {
      const type = wc.types[ti];
      raw[type] = (raw[type] || 0) + 1;
      if (k !== drop) kept[type] = (kept[type] || 0) + 1;
    });
  }
  // Мод, который почти всегда и есть «причина продажи» (+уровни на посохах), без него почти не встречается —
  // честно его по трейду не оценить. Берём не меньше половины сырой частоты: скидка на отбор, но не ноль.
  const counts = {};
  for (const type of Object.keys(raw)) counts[type] = Math.max(kept[type] || 0, raw[type] * 0.5);
  return counts;
}

// Цель крафта: какой была бы лучшая вещь из этой базы. На каждой стороне — самые ценные моды из текущих и возможных:
// ценность = спрос (% билдов) × качество тира; кандидату засчитываем средний тир (что выпадет — неизвестно).
// Fractured снять нельзя — остаются всегда. Возвращает { keep, remove, add } или null, если улучшать нечего.
// Greater / Perfect Exalted Orb — только моды этого уровня и выше (src/shared/methods.js — реестр методов крафта).
const EXALT_KEYS = ['base', 'greater', 'perfect'];
const EXALT_MIN = Object.fromEntries(methods.tiers('exalt').map(([, lv], i) => [EXALT_KEYS[i], lv]));
const EXALT_NAME = Object.fromEntries(methods.tiers('exalt').map(([n], i) => [EXALT_KEYS[i], n]));
const KEY_PCT = 30; // мод, который носит столько % билдов, на другой не меняем
const KEEP_BONUS = 1.5;
function planGoal(mine, candidates, max, want, magic, magicFree = [], itemClass = '', craftedSources = [], itemQuality = 0, craftedCap = 1) {
  // Ключевой для слота мод (уровни умений, Spirit, скорость на ботинках…) поднимает цену сильнее, чем говорит его
  // популярность: «+2 к миньонам» на скипетре дороже Mana Regeneration, даже если тот встречается чаще.
  const KEY_BONUS = 2;
  // «#% increased Explicit Speed Modifier magnitudes» (руна Thrud's Might) усиливает моды своего типа — ключевой,
  // если такой мод на вещи уже есть (Attack Speed → speed, %Phys → physical, крит → critical…).
  const myTags = new Set(mine.flatMap((a) => (a.mod ? a.mod.implicit_tags || [] : [])));
  const boosts = (l) => { const m = l.match(/explicit (\w+)(?: damage)? modifier magnitudes/i); return !!m && myTags.has(m[1].toLowerCase()); };
  const known = want.size > 0; // спрос загружен — правило слота проверяем им
  const keyOf = (lines) => lines.some((l) => boosts(l) || (isKey(itemClass, l) && (!known || (want.get(l) || 0) >= WANT_PCT)));
  // Качество тира — та же шкала, что у важности мода в поиске (weights.tierFactor), чтобы цель и цена не спорили.
  const value = (pct, tier) => pct * tierFactor(tier || null);
  const keep = [], remove = [], add = [];
  for (const side of ['prefix', 'suffix']) {
    const cur = mine.filter((a) => a.side === side).map((a) => {
      const pct = a.mod ? Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0)) : 0;
      // Fractured и хорошие тиры (T1–T2) не трогаем: даже не самый ходовой T1 дороже лотереи Annulment + Exalted.
      // Остальные держим, пока кандидат не ценнее в полтора раза — замена случайна и стоит валюты.
      const weak = a.mod && a.mod.lines.every((l) => isWeak(l));
      // Хороший тир держим, только если мод хоть кому-то нужен (+28 Dexterity T2 при 0% билдов — не повод).
      const spentQuality = a.mod && a.mod.lines.some((l) => /to maximum quality$/.test(l)) && itemQuality > 20;
      if (spentQuality) return { kind: 'cur', a, pct: 0, v: 0, spentQuality: true };
      const locked = a.tag === 'fractured' || a.tag === 'crafted' || !a.mod || (a.tier && a.tier <= 2 && !weak && pct >= 5) || pct >= KEY_PCT;
      // Неключевой desecrated-мод держит единственный desecrate-слот; снять его можно наверняка (Omen of Light) и
      // раскрыть вместо него выбор 1 из 3–6 для нужного мода — поэтому держим его вдвое слабее.
      const desSlot = a.tag === 'desecrated' ? 0.5 : 1;
      return { kind: 'cur', a, pct, v: locked ? Infinity : value(pct, a.tier) * KEEP_BONUS * desSlot * (a.mod && keyOf(a.mod.lines) ? KEY_BONUS : 1) };
    });
    // Гибрид с мусорной половиной («Light Radius / Mana Regeneration») ценнее пустого места, но хуже чистого мода.
    const worth = (c) => value(c.pct, 2) * (keyOf(c.text.split(' / ')) ? KEY_BONUS : 1) * (c.text.split(' / ').some((l) => isWeak(l) && !((want.get(l) || 0) >= WANT_PCT)) ? 0.6 : 1);
    const cand = candidates.filter((c) => c.side === side).map((c) => ({ kind: 'add', c, pct: c.pct, v: worth(c) }));
    const chosen = [...cur, ...cand].sort((x, y) => y.v - x.v).slice(0, max[side]);
    for (const x of cur) {
      const info = { side, tag: x.a.tag, text: x.a.mod ? x.a.mod.lines.join(' / ') : x.a.name, templates: x.a.mod ? x.a.mod.lines : [], tier: x.a.tier, pct: x.pct,
        level: x.a.mod ? x.a.mod.required_level : null, // для Whittling (снимает мод с наименьшим уровнем)
        spentQuality: !!x.spentQuality, // качество останется — снять можно даром
        up: x.pct >= KEY_PCT && x.a.tier >= 3 }; // ключевой, но слабый тир — «↑ тир»
      (chosen.includes(x) ? keep : remove).push(info);
    }
    for (const x of cand) if (chosen.includes(x)) add.push({ ...x.c, side });
  }
  if (!add.length) return null;
  add.sort((x, y) => y.pct - x.pct);
  // План для окна: шаги с валютой и шансом — по ним считаются затраты (цены валюты подставляет main.js по poe.ninja).
  // retry — чем убирать неудачный результат, чтобы попробовать снова.
  const plan = [];
  const needRune = add.find((c) => c.needs);
  if (needRune) plan.push({ act: 'rune', mod: needRune.needs.line, free: needRune.needs.free, currencies: [needRune.needs.rune], chance: 1 });
  let essenceMod = null; // мод, который поставит эссенция magic → rare — его не добавляем второй раз
  if (magicFree.length) plan.push({ act: 'augment', side: magicFree[0], currencies: ['Orb of Augmentation'], chance: 1 });
  if (magic) {
    const ess = add.find((c) => c.essence);
    essenceMod = ess || null;
    plan.push(ess ? { act: 'essence', mod: ess.text, currencies: [ess.essence.name], chance: 1 } : { act: 'regal', currencies: ['Regal Orb'], chance: 1 });
  }
  // Сначала сторона, где самый востребованный мод (ключевой) — он сильнее всего поднимает цену.
  const top = (side) => Math.max(0, ...add.filter((c) => c.side === side).map((c) => c.pct));
  // Сколько модов на стороне сейчас — меняется по ходу плана (омен стороны нужен, только пока на другой есть место).
  // Desecration — одна на вещь: можно, если desecrated-мода не останется (нет или убирается Omen of Light).
  const desFree = mine.filter((a) => a.tag === 'desecrated').every((a) => remove.some((r) => r.tag === 'desecrated' && r.text === (a.mod ? a.mod.lines.join(' / ') : a.name)));
  // Crafted-слот — один на вещь: свободен, если crafted-мода не останется и эссенция не ушла на magic → rare.
  // Сколько crafted-слотов свободно после снятий (эссенция magic → rare тоже занимает слот).
  const craftedLeft = mine.filter((a) => a.tag === 'crafted' && !remove.some((r) => r.tag === 'crafted' && r.text === (a.mod ? a.mod.lines.join(' / ') : a.name))).length
    + (magic && add.some((c) => c.essence) ? 1 : 0);
  const craftedSlots = Math.max(0, craftedCap - craftedLeft);
  const craftedFree = craftedSlots > 0;
  const filled = { prefix: 0, suffix: 0 };
  for (const a of mine) filled[a.side]++;
  const fixed = { prefix: 0, suffix: 0 }; // fractured — Annulment их не снимет
  for (const a of mine) if (a.tag === 'fractured') fixed[a.side]++;
  // 1. Сначала снять всё лишнее («Annul до основы»), потом добавлять. Desecrated — прицельно: Annulment + Omen of Light.
  for (const r of remove.filter((x) => x.tag === 'desecrated')) {
    plan.push({ act: 'remove', side: r.side, mod: r.text, currencies: ['Orb of Annulment', 'Omen of Light'], chance: 1, targeted: true });
    filled[r.side]--;
  }
  // Остальное — Annulment'ами (с оменом стороны или без): окно считает попытки и сколько нужных модов заденет.
  // sides: J — лишних на стороне, K — нужных, которые Annulment может снять (не fractured).
  const junk = remove.filter((x) => x.tag !== 'desecrated');
  if (junk.length) {
    const sides = {};
    for (const side of ['prefix', 'suffix']) {
      const J = junk.filter((x) => x.side === side).length;
      const K = filled[side] - fixed[side] - J;
      // Чем вернуть каждый нужный мод стороны, если Annulment заденет его: крафтовый — своей эссенцией / Alloy.
      const keepers = mine.filter((a) => a.side === side && a.tag !== 'fractured' && !junk.some((x) => x.side === side && x.text === (a.mod ? a.mod.lines.join(' / ') : a.name)));
      const restore = keepers.map((a) => {
        if (a.tag !== 'crafted' || !a.mod) {
          // Ключевой (носят ≥ KEY_PCT% или хороший тир) — потеря дорога; второстепенный — просто докрафтить заново.
          const pct = a.mod ? Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0)) : 0;
          return !a.mod || pct >= KEY_PCT || (a.tier && a.tier <= 2) ? null : 'minor';
        }
        const src = craftedSources.find((x) => templates(x.text.replace(/–/g, '-').replace(/ \/ /g, '\n')).some((l) => a.mod.lines.includes(l)));
        return src ? src.name : null;
      });
      sides[side] = { J, K, restore, omen: `Omen of ${side === 'prefix' ? 'Sinistral' : 'Dextral'} Annulment` };
    }
    // Chaos + Omen of Whittling снимает мод с наименьшим уровнем — если лишний мод строго ниже всех остальных снимаемых
    // (desecrated уже снят), он уйдёт наверняка, но на его место встанет случайный мод.
    // Уровень известен только у сопоставленных модов: если хоть один неизвестен — Whittling не оцениваем.
    const removable = mine.filter((a) => a.tag !== 'fractured' && a.tag !== 'desecrated');
    const known = removable.every((a) => a.mod);
    const levels = removable.map((a) => (a.mod ? a.mod.required_level : 0));
    const low = Math.min(...levels);
    const lowJunk = junk.filter((x) => x.level === low);
    const whittle = known && lowJunk.length === 1 && levels.filter((l) => l === low).length === 1 ? lowJunk[0].text : null;
    // Самый низкоуровневый — нужный мод: Whittling снял бы его (показываем, почему Whittling тут не годится).
    const lowest = mine.filter((a) => a.tag !== 'fractured' && a.tag !== 'desecrated' && a.mod && a.mod.required_level === low);
    const whittleWrong = known && !whittle && lowest.length && !lowJunk.length ? { mod: lowest.map((a) => a.mod.lines.join(' / ')).join(', '), level: low } : null;
    const freeQuality = (junk.find((x) => x.spentQuality) || {}).text || null;
    plan.push({ act: 'remove', mods: junk.map((x) => x.text), sides, whittle, whittleWrong, freeQuality,
      currencies: ['Orb of Annulment', 'Omen of Sinistral Annulment', 'Omen of Dextral Annulment', ...(whittle ? ['Chaos Orb', 'Omen of Whittling'] : [])] });
    for (const x of junk) filled[x.side]--;
  }
  if (essenceMod) filled[essenceMod.side]++; // эссенция уже заняла место на своей стороне
  // 2. Добавить нужное: сначала сторона, где самый востребованный мод.
  for (const side of ['prefix', 'suffix'].sort((x, y) => top(y) - top(x))) {
    const into = add.filter((c) => c.side === side && c !== essenceMod);
    if (!into.length) continue;
    const S = side === 'prefix' ? 'Sinistral' : 'Dextral';
    // Есть ли место на другой стороне: если нет, Exalted и без омена ляжет сюда — омен стороны не нужен.
    const other = side === 'prefix' ? 'suffix' : 'prefix';
    const otherOpen = max[other] - filled[other] > 0;
    const sideOmen = otherOpen ? `Omen of ${S} Exaltation` : null;
    // Какой Exalted взять (обычный / Greater / Perfect) и с какими оменами — выбирает окно по ценам валюты.
    // onSide / onItem — сколько модов уже стоит (все нужные: лишнее убрано раньше) — от этого зависит, чем снимать промах.
    const step = (c, i) => ({ act: 'add', side, mod: c.text, pct: c.pct, worth: c.pct * (keyOf(c.text.split(' / ')) ? KEY_BONUS : 1), onSide: filled[side] - fixed[side] + i, onItem: filled.prefix + filled.suffix - fixed.prefix - fixed.suffix + i,
      annulOmen: `Omen of ${S} Annulment`, exalt: c.exaltAny || c.exalt || { base: { chance: c.chanceUnknown ? null : c.chance || null } }, orMods: c.orMods || null,
      sideOmen, otherOpen, retry: ['Orb of Annulment', `Omen of ${S} Annulment`],
      // Вместо Exalted — Desecrate (кость + Necromancy-омен на сторону): выбор 1 из 3 при раскрытии. Окно решит, где выгоднее.
      desecrate: desFree && c.desecrate && Object.keys(c.desecrate).length ? c.desecrateAny || c.desecrate : null,
      necro: otherOpen ? `Omen of ${S} Necromancy` : null,
      // Perfect/порченая эссенция с этим модом: жертвенный Exalted на сторону → Crystallisation стороны + эссенция.
      crafted: craftedFree && c.crafted && c.crafted.length ? c.crafted : null, craftedOnly: c.craftedOnly || null, desecrateOnly: c.desecrateOnly || null, craftedSlots,
      crystal: `Omen of ${S} Crystallisation`,
      blocker: c.blocker || null,
      currencies: [...Object.keys(c.exalt || { base: 1 }).map((k) => EXALT_NAME[k]), ...(sideOmen ? [sideOmen] : []),
        ...(desFree && c.desecrate ? [...new Set(Object.keys(c.desecrate).flatMap((k) => k.split('|'))), `Omen of ${S} Necromancy`, 'Omen of Abyssal Echoes', 'Omen of Light'] : []),
        ...(craftedFree && c.crafted ? [...c.crafted, `Omen of ${S} Crystallisation`, 'Exalted Orb'] : [])] });
    // Два мода на одну сторону — можно одним Exalted с Omen of Greater Exaltation (если дешевле, окно так и предложит).
    // Мод «только через crafted-слот» — отдельным шагом (не в паре Greater Exaltation).
    const solo = into.filter((c) => c.craftedOnly || c.desecrateOnly);
    into.splice(0, into.length, ...into.filter((c) => !c.craftedOnly && !c.desecrateOnly), ...solo);
    const pairable = into.length - solo.length;
    for (let i = 0; i < into.length;) {
      if (i + 1 < pairable) {
        const pair = [step(into[i], i), step(into[i + 1], i + 1)];
        plan.push({ act: 'add2', side, steps: pair, sideOmen, otherOpen, retry: ['Orb of Annulment', `Omen of ${S} Annulment`],
          currencies: [...new Set([...pair[0].currencies, ...pair[1].currencies, 'Omen of Greater Exaltation'])] });
        i += 2;
      } else { plan.push(step(into[i], i)); i += 1; }
    }
    filled[side] += into.length;
  }
  // Последние два добавления — по одному на префикс и суффикс, и на каждой стороне ровно одно свободное место:
  // Omen of Greater Exaltation кладёт оба мода одним Exalted (каждый — на свою сторону), омены стороны не нужны.
  const singles = plan.filter((s) => s.act === 'add');
  const last = plan.slice(-2);
  if (last.length === 2 && last.every((s) => s.act === 'add' && !s.craftedOnly && !s.desecrateOnly) && last[0].side !== last[1].side && singles.length >= 2
    && ['prefix', 'suffix'].every((side) => max[side] - filled[side] === 0)) {
    const bare = (s) => ({ ...s, sideOmen: null, otherOpen: false, necro: null });
    plan.splice(-2, 2, { act: 'add2', cross: true, side: null, steps: last.map(bare), sideOmen: null, otherOpen: false, alt: last,
      retry: [...new Set(last.flatMap((s) => s.retry))], currencies: [...new Set([...last.flatMap((s) => s.currencies), 'Omen of Greater Exaltation'])] });
  }
  return { keep, remove, add: add.map(({ side, text, pct, shownPct, pctParts, tier, tiers, range, stats, essence, chance, chanceUnknown, needs, desecrateOnly, craftedOnly }) => ({ side, text, pct, shownPct, pctParts, tier, tiers, range, stats, essence, chance, chanceUnknown, needs, desecrateOnly, craftedOnly })), plan };
}

// Может ли мод (шаблон poe.ninja: «# to Level of all Spell Skills») встать на эту базу. null — пул модов ещё не загружен.
function rollsOn(baseType, template) {
  const data = craftData.current();
  if (!data) return null;
  const base = data.bases.get(baseType);
  if (!base) return null;
  const want = templates(template)[0];
  return data.pool.some((m) => (m.domain === 'item' || m.domain === 'desecrated') && m.lines.includes(want) && canRoll(m, base.tags || []));
}

// Может ли мод вообще оказаться на этой базе: выпасть или быть её implicit'ом. Для списков спроса poe.ninja —
// в его «Rare Sceptre» попадают и палочки (уровни заклинаний, Cast Speed), которых на скипетре не бывает.
const linesCache = new Map(); // база → все строки модов, которые могут на ней быть
craftData.onReset(() => linesCache.clear());
function canAppear(baseType, template) {
  const data = craftData.current();
  if (!data) return null;
  const base = data.bases.get(baseType);
  if (!base) return null;
  if (!linesCache.has(baseType)) {
    const set = new Set(base.implicitLines || []);
    for (const m of data.pool) if ((m.domain === 'item' || m.domain === 'desecrated') && canRoll(m, base.tags || [])) for (const l of m.lines) set.add(l);
    linesCache.set(baseType, set);
  }
  return linesCache.get(baseType).has(templates(template)[0]);
}

// Тот же ли класс вещей у двух баз (null — неизвестно).
function sameClass(a, b) {
  const data = craftData.current();
  const x = data && data.bases.get(a);
  const y = data && data.bases.get(b);
  return x && y ? x.item_class === y.item_class : null;
}

module.exports = { advise, load, reset: craftData.reset, rollsOn, canAppear, sameClass };
