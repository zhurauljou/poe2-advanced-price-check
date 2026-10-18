// Данные игры для советов по крафту: пул модов RePoE (какие моды и тиры могут встать на базу), шаблоны строк,
// статы трейда для мода, оценка весов (data/weights.json), порченые эссенции и Alloys (data/crafting-currency.json).
const stats = require('./stats');
const fsW = require('fs');
const pathW = require('path');
const { t } = require('../shared/i18n');

// Оценка весов модов (scripts/collect-weights.js — по дешёвым лотам трейда, не данные игры). Нет файла — без шансов.
let weightsData;
function weights() {
  if (weightsData === undefined) {
    try { weightsData = JSON.parse(fsW.readFileSync(pathW.join(__dirname, '..', '..', 'data', 'weights.json'), 'utf8')); } catch { weightsData = null; }
  }
  return weightsData;
}

const REPOE = 'https://repoe-fork.github.io/poe2';

let data = null; // { bases: Map name→base, pool: [...] }
let loadedAt = 0;

// Пул модов грузим один раз: initData и первый запрос Craft не должны разбирать RePoE параллельно. Программа живёт в
// трее неделями — раз в сутки перечитываем (сам файл RePoE обновляется раз в неделю, после патча — «Обновить данные»).
let loading = null;
function load(cached) {
  if (data && Date.now() - loadedAt < 24 * 3600e3) return Promise.resolve(data);
  if (!loading) loading = loadData(cached).then((d) => { reset(); data = d; loadedAt = Date.now(); return d; }).finally(() => { loading = null; });
  return loading;
}
// Забыть загруженный пул и всё, что из него посчитано (новые данные после патча): посчитанное держат другие модули —
// они подписываются через onReset.
const resetHooks = [];
const onReset = (fn) => resetHooks.push(fn);
function reset() {
  data = null;
  for (const fn of resetHooks) fn();
}

async function loadData(cached) {
  const [mods, bases, augments] = await Promise.all([
    cached('repoe-mods.json', `${REPOE}/mods.min.json`, 24),
    cached('repoe-base-items.json', `${REPOE}/base_items.min.json`, 24),
    cached('repoe-augments.json', `${REPOE}/augments.min.json`, 24).catch(() => ({})),
  ]);
  const byName = new Map();
  for (const b of Object.values(bases)) if (b.name && !byName.has(b.name)) byName.set(b.name, b);
  // Теги no_fire/cold/lightning/chaos/physical_spell_mods (на базах посохов и палочек и в adds_tags модов стихий) игра
  // не применяет: на трейде есть Ashen Staff (база огня) с increased Cold Damage. Убираем — иначе советы теряют моды.
  const NO_SPELL = /^no_\w+_spell_mods$/;
  // Сами теги в пул не пускаем, но запоминаем как «стихию базы»: шансы модов своей стихии на ней выше (Craft of Exile:
  // 5550 против 3000) — статистику весов программа берёт по базам той же стихии (craft.js classWeights).
  for (const b of byName.values()) {
    b.spellAffinity = (b.tags || []).filter((t) => NO_SPELL.test(t)).sort().join(',');
    b.tags = (b.tags || []).filter((t) => !NO_SPELL.test(t));
  }
  for (const m of Object.values(mods)) if (m.adds_tags) m.adds_tags = m.adds_tags.filter((t) => !NO_SPELL.test(t));
  // Строки implicit'ов базы (Spirit у скипетра и т.п.) — их нет в пуле крафта, но в спросе poe.ninja они бывают.
  for (const b of byName.values()) b.implicitLines = (b.implicits || []).flatMap((id) => (mods[id] ? templates(radiusText(mods[id])) : []));
  // Моды самоцветов лежат в домене 'misc' — для крафта это те же «обычные» моды, что и 'item'.
  const pool = Object.entries(mods)
    .filter(([, m]) => (m.domain === 'item' || m.domain === 'misc' || m.domain === 'desecrated')
      && (m.generation_type === 'prefix' || m.generation_type === 'suffix'))
    .map(([id, m]) => { const text = radiusText(m); return { id, ...m, text, domain: m.domain === 'misc' ? 'item' : m.domain, lines: templates(text) }; });
  // Строки модов по семейству — чтобы знать спрос семейства (для «причины продажи» в оценке шансов).
  const typeLines = new Map();
  for (const m of pool) if (!typeLines.has(m.type)) typeLines.set(m.type, m.lines);
  // Аугменты (руны, Soul Cores, Abyssal Eye, Thesis): имя, лимит, для каких классов какие статы (bonded — только с
  // пассивкой Шамана, не учитываем).
  const augs = Object.entries(augments || {}).map(([key, a]) => ({
    name: bases[key] && bases[key].name, limit: a.limit || null, level: a.required_level || 0,
    cats: Object.values(a.categories || {}).filter((c) => (c.stat_text || []).length).map((c) => ({ target: c.target, lines: c.stat_text.flatMap((tx) => templates(tx)) })),
  })).filter((a) => a.name && a.cats.length);
  return { bases: byName, pool, typeLines, augs };
}

// Моды Time-Lost самоцветов (radius_jewel) в RePoE записаны без «Small/Notable Passive Skills in Radius also grant» —
// только эффект («(2-3)% increased [Armour]»), и по такому тексту находится обычный глобальный стат. Подставляем ту
// формулировку, которая есть на трейде (у каждого мода подходит ровно одна).
function radiusText(m) {
  const radius = (m.spawn_weights || []).some((w) => w.weight > 0 && /radius_jewel$/.test(w.tag));
  if (!radius || !m.text || /^Upgrades Radius/.test(m.text)) return m.text;
  const plain = (l) => l.replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1').replace(/\((-?[\d.]+)--?[\d.]+\)/g, '$1');
  for (const kind of ['Notable', 'Small']) {
    const lines = m.text.split('\n').map((l) => `${kind} Passive Skills in Radius also grant ${l}`);
    if (lines.every((l) => stats.statFor(plain(l), 'explicit', 'Jewels'))) return lines.join('\n');
  }
  return m.text;
}

// «(39-42)% increased [EnergyShield|Energy Shield]» → «#% increased energy shield» — как моды у poe.ninja.
function templates(text) {
  return String(text || '').split('\n').map((l) => l
    .replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1')
    .replace(/\(-?[\d.]+--?[\d.]+\)/g, '#')
    .replace(/-?\d+(?:\.\d+)?/g, '#')
    .replace(/\+#/g, '#')
    .trim().toLowerCase()).filter(Boolean);
}

// Фильтры трейда для мода с нижним роллом тира: «(39-42)% increased [EnergyShield|Energy Shield]» → 39% … → стат.
// null — если хоть одну строку не сопоставили (тогда цену после крафта не считаем).
function tradeStats(mod, domain, itemClass) {
  const lines = String(mod.text || '').split('\n').map((l) => l
    .replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1')
    .replace(/\((-?[\d.]+)--?[\d.]+\)/g, '$1').trim()).filter(Boolean);
  const out = lines.map((l) => stats.statFor(l, domain === 'desecrated' ? 'desecrated' : 'explicit', itemClass));
  return out.every(Boolean) ? out.map((s) => ({ statId: s.statId, min: s.value })) : null;
}

// Порченые эссенции и Alloy (собрано с poe2db, data/crafting-currency.json): что добавят на этот класс вещей.
let currencyData;
function guaranteedFor(itemClass) {
  if (currencyData === undefined) {
    try { currencyData = JSON.parse(fsW.readFileSync(pathW.join(__dirname, '..', '..', 'data', 'crafting-currency.json'), 'utf8')); } catch { currencyData = null; }
  }
  if (!currencyData) return [];
  const out = [];
  for (const [list, kind] of [[currencyData.corruptedEssences, 'corrupted essence'], [currencyData.alloys, 'alloy']]) {
    for (const x of list || []) {
      const mods = [...new Set((x.mods || []).filter((m) => m.classes.includes(itemClass)).map((m) => m.text))];
      if (mods.length) out.push({ name: `${x.name} (${t(kind)})`, mod: mods.join(' / ') });
    }
  }
  return out;
}

// Порченые эссенции и Alloys (оба — «снимают случайный мод и ставят свой», crafted-слот) с модами для класса.
function corruptedFor(itemClass) {
  guaranteedFor(itemClass); // загрузит данные
  const out = [];
  for (const list of [currencyData && currencyData.corruptedEssences, currencyData && currencyData.alloys]) {
    for (const x of list || []) {
      for (const m of x.mods || []) if (m.classes.includes(itemClass)) out.push({ name: x.name, text: m.text, side: (m.affix || '').toLowerCase() || null });
    }
  }
  return out;
}

// Вес мода на базе: первый тег из spawn_weights, который есть у базы (в PoE 2 — только 0 или 1).
function canRoll(mod, tags) {
  for (const sw of mod.spawn_weights || []) if (tags.includes(sw.tag)) return sw.weight > 0;
  return false;
}

// Загруженный пул (или null, пока не загружен) — для быстрых проверок без await.
const current = () => data;

module.exports = { load, reset, onReset, current, templates, tradeStats, weights, guaranteedFor, corruptedFor, canRoll };
