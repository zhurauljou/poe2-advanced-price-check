// Клиент игры не на английском: текст предмета из буфера → английский эквивалент для остального разбора (parser.js).
// Служебные слова — таблица ниже (по client_strings из Exiled Exchange 2, MIT, github.com/Kvan7/Exiled-Exchange-2);
// названия баз, уников и камней — items.ndjson того же проекта. Строки модов переводятся по справочнику трейда этого
// языка (stats.localToEnglish: id статов у всех языков общие); не нашлась строка — остаётся как есть.

const fs = require('fs');
const path = require('path');
const stats = require('./stats');
const { writeFileAtomic } = require('./files');

const EE2 = 'https://raw.githubusercontent.com/Kvan7/Exiled-Exchange-2/master/renderer/public/data';

const LANGS = {
  ru: {
    itemClass: 'Класс предмета: ',
    rarity: 'Редкость: ',
    rarities: { 'Обычный': 'Normal', 'Волшебный': 'Magic', 'Редкий': 'Rare', 'Уникальный': 'Unique', 'Камень': 'Gem', 'Валюта': 'Currency' },
    // «Ключ: значение» — ключи свойств; длинные раньше коротких («Уровень предмета» до «Уровень»).
    props: [
      ['Уровень предмета', 'Item Level'], ['Качество', 'Quality'], ['Броня', 'Armour'], ['Уклонение', 'Evasion Rating'],
      ['Энергетический щит', 'Energy Shield'], ['Дух', 'Spirit'], ['Физический урон', 'Physical Damage'],
      ['Урон от огня', 'Fire Damage'], ['Урон от холода', 'Cold Damage'], ['Урон от молнии', 'Lightning Damage'],
      ['Урон от стихий', 'Elemental Damage'], ['Урон хаосом', 'Chaos Damage'], ['Шанс крит. попадания', 'Critical Hit Chance'],
      ['Атак в секунду', 'Attacks per Second'], ['Шанс блока', 'Block chance'], ['Размер стопки', 'Stack Size'],
      ['Гнезда', 'Sockets'], ['Требуется', 'Requires'], ['Примечание', 'Note'], ['Радиус', 'Radius'],
      ['Дарует умение', 'Grants Skill'], ['Время перезарядки', 'Reload Time'], ['Ячейки оберегов', 'Charm Slots'],
      ['Ограничение', 'Limited to'], ['Уровень', 'Level'],
    ],
    // \b в JS не видит границ кириллических слов — поэтому «полное слово или сокращение».
    requires: [[/Уровень/g, 'Level'], [/Сила|Сил(?![а-яё])/g, 'Str'], [/Ловкость|Ловк(?![а-яё])/g, 'Dex'], [/Интеллект|Инт(?![а-яё])/g, 'Int']],
    flags: { 'Осквернено': 'Corrupted', 'Дважды осквернено': 'Twice Corrupted', 'Отражено': 'Mirrored', 'Освящено': 'Sanctified',
      'Неопознано': 'Unidentified', 'Расколотый предмет': 'Fractured Item', 'Очернённый предмет': 'Desecrated Item' },
    superior: /^(.*) высокого качества$/,
    unscalable: ' — Неизменяемое значение',
    boost: /— (\d+)% увеличение$/,
    tier: /\((?:Уровень|Ранг): (\d+)\)/,
    // Вид мода в заголовке { … } → английский заголовок.
    kind(k) {
      const side = /префикс/i.test(k) ? 'Prefix Modifier' : /суффикс/i.test(k) ? 'Suffix Modifier' : null;
      const pre = /очерн/i.test(k) ? 'Desecrated ' : /расколот/i.test(k) ? 'Fractured ' : /ремесл/i.test(k) ? 'Crafted ' : '';
      if (side) return pre + side;
      if (/осквернени/i.test(k)) return 'Corrupted Implicit Modifier';
      if (/собственное/i.test(k)) return 'Implicit Modifier';
      if (/уникальное/i.test(k)) return 'Unique Modifier';
      if (/улучшение/i.test(k)) return 'Enhancement';
      return pre + 'Modifier';
    },
  },
};

// Класс вещи по категории базы (как в RePoE: «Body Armour») → как пишет игра в «Item Class:» («Body Armours»).
const CLASS_PLURAL = { Staff: 'Staves', Quarterstaff: 'Quarterstaves', Focus: 'Foci', Gloves: 'Gloves', Boots: 'Boots' };
const plural = (c) => CLASS_PLURAL[c] || (/s$/.test(c) ? c : `${c}s`);

let data = null; // { lang, items: Map ru → [entry], uniques: Map ru → [entry], bases: [{ ru, en, category }] }

// Названия предметов на языке клиента (кэш на неделю в папке dir; нет сети — старый кэш).
async function load(lang, dir, fetchBuffer) {
  if (!LANGS[lang]) { data = null; return; }
  if (data && data.lang === lang) return;
  const file = path.join(dir, `ee2-${lang}-items.ndjson`);
  let text = null;
  try {
    if (Date.now() - fs.statSync(file).mtimeMs < 7 * 24 * 3600e3) text = fs.readFileSync(file, 'utf8');
  } catch {}
  if (!text) {
    try {
      text = Buffer.from(await fetchBuffer(`${EE2}/${lang}/items.ndjson`)).toString('utf8');
      writeFileAtomic(file, text);
    } catch (e) {
      if (fs.existsSync(file)) text = fs.readFileSync(file, 'utf8'); else throw e;
    }
  }
  const items = new Map();
  const uniques = new Map();
  const bases = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let x;
    try { x = JSON.parse(line); } catch { continue; }
    const map = x.namespace === 'UNIQUE' ? uniques : items;
    if (!map.has(x.name)) map.set(x.name, []);
    map.get(x.name).push(x);
    if (x.namespace === 'ITEM' && x.craftable) bases.push({ ru: x.name, en: x.refName, category: x.craftable.category });
  }
  bases.sort((a, b) => b.ru.length - a.ru.length); // для магических: самое длинное совпадение внутри строки
  data = { lang, items, uniques, bases, byEn: new Map(bases.map((b) => [b.en, b])) };
}

// Перевод текста предмета. Не узнали формат — возвращаем как есть (parser.js его просто не примет).
function toEnglish(text, lang) {
  const L = LANGS[lang];
  if (!L || !data || !text) return text;
  const lines = text.replace(/\r/g, '').split('\n');
  if (!lines[0] || !lines[0].startsWith(L.itemClass)) return text;

  const sepAt = lines.findIndex((l) => l.trim() === '--------');
  const head = lines.slice(0, sepAt < 0 ? lines.length : sepAt).map((l) => l.trim()).filter(Boolean);
  const rarityRu = (head.find((l) => l.startsWith(L.rarity)) || '').slice(L.rarity.length).trim();
  const rarity = L.rarities[rarityRu] || rarityRu;
  const names = head.filter((l) => !l.startsWith(L.itemClass) && !l.startsWith(L.rarity));

  // Названия → английские; класс вещи — по категории базы.
  const baseOf = (ru) => {
    const s = (ru.match(L.superior) || [null, ru])[1];
    const exact = (data.items.get(s) || []).find((x) => x.namespace === 'ITEM');
    if (exact) return data.byEn.get(exact.refName) || { en: exact.refName, category: exact.craftable && exact.craftable.category };
    return data.bases.find((b) => s.includes(b.ru)) || null; // магическая: «<префикс> база <суффикс>»
  };
  let enNames = names;
  let category = null;
  if (rarity === 'Unique' && names.length >= 2) {
    const base = baseOf(names[1]);
    const u = (data.uniques.get(names[0]) || []);
    const hit = u.find((x) => base && x.unique && x.unique.base === base.en) || u[0];
    enNames = [hit ? hit.refName : names[0], base ? base.en : names[1]];
    category = base && base.category;
  } else if (rarity === 'Rare' && names.length >= 2) {
    const base = baseOf(names[1]);
    enNames = [names[0], base ? base.en : names[1]];
    category = base && base.category;
  } else if (rarity === 'Magic' || rarity === 'Normal') {
    const base = baseOf(names[names.length - 1] || '');
    enNames = [base ? base.en : names[names.length - 1]];
    category = base && base.category;
  } else {
    // Валюта, камни и прочее — по названию целиком.
    enNames = names.map((n) => { const x = (data.items.get(n) || [])[0]; return x ? x.refName : n; });
  }
  const classRu = lines[0].slice(L.itemClass.length).trim();
  const out = [`Item Class: ${category ? plural(category) : classRu}`, `Rarity: ${rarity}`, ...enNames];

  const rest = lines.slice(sepAt < 0 ? lines.length : sepAt);
  for (let i = 0; i < rest.length; i++) {
    const raw = rest[i];
    const l = raw.trim();
    if (L.flags[l]) { out.push(L.flags[l]); continue; }
    const h = l.match(/^\{ (.*) \}$/);
    if (h) {
      // { Очернённый префикс "Имя" (Уровень: 2) — Энергетический щит } → { Desecrated Prefix Modifier "Имя" (Tier: 2) }
      const kind = h[1].split(' — ')[0];
      const name = (kind.match(/"([^"]+)"/) || [])[1];
      const tier = kind.match(L.tier);
      const boost = h[1].match(L.boost);
      out.push(`{ ${L.kind(kind.replace(/".*$/, ''))}${name ? ` "${name}"` : ''}${tier ? ` (Tier: ${tier[1]})` : ''}${boost ? ` — ${boost[1]}% Increased` : ''} }`);
      continue;
    }
    const p = L.props.find(([ru]) => l.startsWith(`${ru}: `));
    if (p) {
      let v = l.slice(p[0].length + 2);
      if (p[1] === 'Requires') for (const [re, en] of L.requires) v = v.replace(re, en);
      // Пометка в скобках у значения («(увеличено)» и т.п.) — как английская «(augmented)».
      v = v.replace(/ \(([^()]*[а-яё][^()]*)\)/gi, ' (augmented)');
      out.push(`${p[1]}: ${v}`);
      continue;
    }
    // Строка мода → английская (справочник трейда этого языка, stats.localToEnglish). Не нашлась одна — пробуем вместе
    // со следующей (мод в две строки). Не нашлась и так — остаётся как есть (stats.js сопоставит её по справочнику языка).
    const mod = modBody(l, L);
    if (mod) {
      let en = stats.localToEnglish(mod.body);
      if (en) { out.push(mod.wrap(en)); continue; }
      const next = i + 1 < rest.length && modBody(rest[i + 1].trim(), L);
      en = next && next.tag === mod.tag && stats.localToEnglish(`${mod.body}\n${next.body}`);
      const two = en && en.split('\n');
      if (two && two.length === 2) { out.push(mod.wrap(two[0]), next.wrap(two[1])); i++; continue; }
    }
    out.push(raw.replace(L.unscalable, ' — Unscalable Value'));
  }
  return out.join('\n');
}

// Строка, похожая на мод: без пометок «(rune)», « — Неизменяемое значение» — их возвращает wrap. Разделители,
// заголовки и пустые строки — null.
const MOD_TAG = / \((implicit|enchant|rune|crafted|fractured|desecrated)\)$/;
function modBody(l, L) {
  if (!l || l === '--------' || /^\{.*\}$/.test(l)) return null;
  const unscalable = l.endsWith(L.unscalable);
  let body = unscalable ? l.slice(0, -L.unscalable.length) : l;
  const tag = body.match(MOD_TAG);
  if (tag) body = body.slice(0, -tag[0].length);
  return { body, tag: tag ? tag[1] : null,
    wrap: (en) => `${en}${tag ? tag[0] : ''}${unscalable ? ' — Unscalable Value' : ''}` };
}

module.exports = { LANGS, load, toEnglish };
