// Контрольные сценарии крафта и цены: вещи, на которых советы ошибались (test/fixtures/craft/*.txt), со снимком
// спроса poe.ninja и цен валюты (scripts/snapshot-craft-fixtures.js). Проверяем свойства плана, а не точные числа.
// Данные — снимок RePoE и справочника трейда (test/fixtures/data, scripts/snapshot-test-data.js); CRAFT_LIVE=1 — живой кэш
// программы (%APPDATA%/PoE 2 Price Checker/cache): проверить сценарии на свежих данных перед обновлением снимка.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const orig = Module._load;
Module._load = function (r, ...a) { if (r === 'electron') return { net: { fetch }, app: { getPath: () => require('os').tmpdir() } }; return orig.call(this, r, ...a); };

const zlib = require('zlib');
const LIVE = process.env.CRAFT_LIVE === '1';
const CACHE = LIVE ? path.join(process.env.APPDATA || '', 'PoE 2 Price Checker', 'data-cache') : path.join(__dirname, 'fixtures', 'data');
const file = (n) => path.join(CACHE, LIVE ? n : `${n}.gz`);
const has = ['repoe-mods.json', 'repoe-base-items.json', 'stats.json'].every((f) => fs.existsSync(file(f)));
const skip = has ? false : `нет данных (${CACHE})`;
const load = (n) => { const b = fs.readFileSync(file(n)); return JSON.parse(LIVE ? b.toString('utf8') : zlib.gunzipSync(b).toString('utf8')); };

const FIX = path.join(__dirname, 'fixtures', 'craft');
const read = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');
const json = (f) => JSON.parse(read(f));
const cached = async (n) => load(n);

let stats, craft, pricing, parseItem, PlanCost, prices, bases;
async function init() {
  if (stats) return;
  stats = require('../src/main/stats');
  stats.build(load('stats.json'));
  craft = require('../src/main/craft');
  pricing = require('../src/main/pricing');
  ({ parseItem } = require('../src/main/parser'));
  PlanCost = require('../src/shared/plancost');
  prices = json('prices.json').prices;
  await craft.load(cached);
  bases = Object.values(await cached('repoe-base-items.json')).map((b) => b.name).filter(Boolean);
}

// Вещь сценария: у магической база — самое длинное название базы внутри имени (как resolveBase в окне).
function item(name) {
  const it = parseItem(read(`${name}.txt`));
  if (it.rarity === 'Magic') it.baseType = bases.filter((n) => it.name.includes(n)).sort((a, b) => b.length - a.length)[0];
  return it;
}
async function plan(name, extra = []) {
  await init();
  const r = await craft.advise(item(name), json(`${name}.demand.json`).mods.concat(extra), cached);
  assert.ok(r.goal, `${name}: план не построен (${r.note || ''})`);
  const planner = PlanCost.create(() => ({ prices, goalValue: null, est: null }));
  const steps = planner.expandPlan(r.goal.plan);
  return { r, goal: r.goal, steps, cost: steps.map(planner.stepCost) };
}
const stepFor = (p, re) => {
  const i = p.steps.findIndex((s) => s.act === 'add' && re.test(s.mod));
  return i < 0 ? null : { s: p.steps[i], c: p.cost[i] };
};
async function filters(name, demandFile) {
  await init();
  const it = name.endsWith('.txt') ? parseItem(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')) : item(name);
  return pricing.prepare(it, demandFile ? json(demandFile) : null, () => true).filters;
}
const mod = (f, re) => f.mods.find((m) => re.test(m.text));

test('скипетр под миньонов: цель — уровни миньонов, слабый desecrated снимается Omen of Light, Desecrate — на уровни', { skip }, async () => {
  const p = await plan('sceptre-minion');
  assert.ok(p.goal.add.some((a) => /level of all minion skills/.test(a.text)), 'уровни миньонов в цели');
  assert.ok(p.goal.remove.some((r) => r.tag === 'desecrated'), 'desecrated снимается');
  assert.ok(p.steps.some((s) => s.act === 'remove' && s.targeted), 'снятие desecrated — прицельно (Omen of Light)');
  const minion = stepFor(p, /level of all minion skills/);
  assert.ok(minion && minion.c.k === 'desecrate', 'уровни миньонов — через Desecrate');
});

test('Tiara: Whittling не предлагается — он снял бы +2 к миньонам (самый низкий уровень)', { skip }, async () => {
  const p = await plan('tiara-minion');
  const rm = p.steps.find((s) => s.act === 'remove' && s.mods);
  assert.ok(rm, 'есть шаг снятия');
  assert.equal(rm.whittle, null);
  assert.ok(rm.whittleWrong && /minion skills/.test(rm.whittleWrong.mod));
});

test('ботинки без скорости: Movement Speed ставит Essence of Hysteria (crafted-слот) первым из добавлений', { skip }, async () => {
  const p = await plan('boots-no-ms');
  const ms = stepFor(p, /movement speed$/);
  assert.ok(ms && ms.c.k === 'essence' && /Hysteria/.test(ms.c.currencies[0]), 'Hysteria на скорость');
  const firstAdd = p.steps.findIndex((s) => s.act === 'add' || s.act === 'add2');
  assert.equal(p.steps[firstAdd], ms.s, 'эссенция — первая из добавлений');
});

test('палочка: уровни заклинаний — через Perfect Essence (crafted-слот)', { skip }, async () => {
  const p = await plan('wand-open-prefixes');
  const lv = stepFor(p, /level of all spell skills/);
  assert.ok(lv && lv.c.k === 'essence', 'Perfect Essence на уровни заклинаний');
});

test('редкое копьё: Celestial Alloy (Accuracy / Attack Speed) через crafted-слот, ненужный Dexterity T2 снимается', { skip }, async () => {
  const p = await plan('spear-rare-destruction');
  assert.ok(p.goal.add.some((a) => /accuracy rating \/ #% increased attack speed/.test(a.text)), 'гибрид Alloy в цели');
  assert.ok(p.goal.remove.some((r) => /dexterity/.test(r.text)), 'Dexterity снимается');
  const alloy = stepFor(p, /accuracy rating \/ #% increased attack speed/);
  assert.ok(alloy && alloy.c.k === 'essence' && /Alloy/.test(alloy.c.currencies[0]));
});

test('магическое копьё: первым шагом руна Thrud\'s Might, мод эссенции не добавляется второй раз', { skip }, async () => {
  const p = await plan('spear-magic');
  assert.equal(p.steps[0].act, 'rune');
  assert.deepEqual(p.steps[0].currencies, ["Thrud's Might"]);
  const ess = p.steps.find((s) => s.act === 'essence');
  assert.ok(ess, 'эссенция magic → rare');
  const adds = p.steps.flatMap((s) => (s.act === 'add2' ? s.steps : s.act === 'add' ? [s] : [])).map((s) => s.mod);
  assert.ok(!adds.includes(ess.mod), 'мод эссенции не повторяется');
});

test('нательник с desecrated: два свободных места на разных сторонах — один Exalted с Omen of Greater Exaltation', { skip }, async () => {
  // Броня и ES на нательнике нужны (спрос поднят): цель — по одному моду на префикс и суффикс, без снятий.
  const p = await plan('mantle-desecrated', [{ name: '# to Armour', pct: 90 }, { name: '# to maximum Energy Shield', pct: 90 }]);
  assert.ok(p.steps.some((s) => s.act === 'add2' && s.cross), 'пара через стороны');
});

test('кольцо на миньонов: три минионских мода отмечены и ключевые', { skip }, async () => {
  const f = await filters('ring-minion', 'ring-minion.demand.json');
  for (const re of [/Critical Damage Bonus/, /Critical Hit Chance/, /Cooldown Recovery/]) {
    const m = mod(f, re);
    assert.ok(m && m.enabled && m.key, `${re} отмечен и ключевой`);
  }
});

test('ES-ботинки: жизнь (низкий спрос) и Stun Threshold не отмечены, сумма жизни выключена', { skip }, async () => {
  const f = await filters('boots-es', 'boots-es.demand.json');
  assert.equal(mod(f, /^\+137 to maximum Life/).enabled, false);
  assert.equal(mod(f, /Stun Threshold/).enabled, false);
  assert.equal(mod(f, /total maximum Life/).enabled, false);
  assert.equal(mod(f, /Movement Speed/).enabled, true);
});

test('магическая палочка: уровни умений ищутся ровно своим значением (от 4 до 4)', { skip }, async () => {
  const f = await filters('wand-magic-levels', 'wand-magic-levels.demand.json');
  const lv = mod(f, /Level of all Cold Spell Skills/);
  assert.equal(lv.min, 4);
  assert.equal(lv.max, 4);
});

test('Heart of the Well: ключевые случайные моды обязательны, ненужный (< 10%) не отмечен', { skip }, async () => {
  const f = await filters('unique-heart-of-the-well', 'unique-heart-of-the-well.demand.json');
  for (const re of [/Extra Cold/, /Extra Lightning/]) assert.ok(mod(f, re).enabled && mod(f, re).key, `${re} ключевой`);
  assert.equal(mod(f, /Ailment Threshold/).enabled, false);
});

test('Controlled Metamorphosis: размер кольца — порядковый ролл (Massive = 8 из 1…8), неизменяемый мод скрыт', { skip }, async () => {
  const f = await filters('unique-controlled-metamorphosis.txt');
  const ring = mod(f, /Massive Ring/);
  assert.deepEqual([ring.ordinal.idx, ring.ordinal.lo, ring.ordinal.hi], [8, 1, 8]);
  assert.equal(f.hiddenFixed, 1);
});

test('Mageblood: Legacy — случайный вариант из 14 (Divine перекатит)', { skip }, async () => {
  const f = await filters('unique-mageblood.txt');
  const legacies = f.mods.filter((m) => /^Legacy of/.test(m.text));
  assert.equal(legacies.length, 4);
  for (const m of legacies) assert.equal(m.categorical && m.categorical.n, 14);
});

test('симуляция плана: распределение итога и затрат, шанс выгоды — в разумных границах', { skip }, async () => {
  await init();
  const r = await craft.advise(item('boots-no-ms'), json('boots-no-ms.demand.json').mods, cached);
  const planner = PlanCost.create(() => ({ prices, goalValue: 20, est: 5 }));
  const sim = planner.simulate(r.goal.plan, { keep: r.goal.keep.length }, 500);
  assert.ok(sim.value.p10 <= sim.value.p50 && sim.value.p50 <= sim.value.p90);
  assert.ok(sim.spent.mean > 0);
  assert.ok(sim.profit >= 0 && sim.profit <= 1 && sim.full >= 0 && sim.full <= 1);
  assert.equal(PlanCost.create(() => ({ prices, goalValue: null, est: 5 })).simulate(r.goal.plan), null, 'без цены цели — нет симуляции');
});

test('посох со стихией холода: стихийные моды по спросу лучшей стихии (руны Альдура), цена проверяется в огне первым', { skip }, async () => {
  const f = await filters('staff-cold', 'staff-cold.demand.json');
  assert.ok(mod(f, /Extra Cold Damage/).enabled, 'Extra Cold отмечен');
  const it = item('staff-cold');
  pricing.prepare(it, json('staff-cold.demand.json'), () => true);
  const vars = pricing.elementVariants(it, f);
  assert.equal(vars[0].element, 'Fire');
  assert.ok(vars[0].filters.mods.some((m) => m.enabled && /Extra Fire Damage/.test(m.text)));
  assert.ok(vars[0].filters.mods.some((m) => m.enabled && /Level of all Fire Spell Skills/.test(m.text)));
});

test('посох со стихией холода в крафте: Cold-моды держатся (спрос по лучшей стихии), совет про Passion of Aldur', { skip }, async () => {
  const p = await plan('staff-cold');
  assert.ok(p.goal.keep.some((k) => /extra cold damage/.test(k.text)) && p.goal.keep.some((k) => /cold spell skills/.test(k.text)));
  const cheap = (p.r.sections.find((s) => s.kind === 'cheap') || { how: [] }).how;
  assert.ok(cheap.some((h) => /Passion of Aldur/.test(h)));
});

test('амулет: мод лича (только Desecrate) — через кость с лич-оменом, не в паре Greater Exaltation', { skip }, async () => {
  const p = await plan('amulet-lich');
  const step = p.steps.find((s) => s.act === 'add' && s.desecrateOnly);
  assert.ok(step, 'есть шаг с модом лича');
  const c = p.cost[p.steps.indexOf(step)];
  assert.equal(c.k, 'desecrate');
  assert.ok(c.currencies.some((n) => /^Omen of the (Sovereign|Liege|Blackblooded)$/.test(n)), 'лич-омен в валюте');
  assert.ok(!p.steps.some((s) => s.act === 'add2' && s.steps.some((x) => x.desecrateOnly)), 'не в паре');
});

test('амулет: одинаковые названия аффиксов («of Kurgal») различаются по тексту, мод эссенции (Essences) узнаётся', { skip }, async () => {
  const p = await plan('amulet-minion');
  assert.ok(p.goal.remove.some((r) => /minions have #% increased cooldown recovery rate/.test(r.text)), 'снимается сам Minions CDR');
  assert.ok(!p.goal.remove.some((r) => /cold and chaos/.test(r.text)), 'не выдуманный мод с тем же названием');
  assert.ok(p.goal.keep.some((k) => /global armour, evasion and energy shield/.test(k.text)), 'мод эссенции распознан');
});

test('бижутерия: потусторонний мод (Altered Collarbone) — только через Desecrate этой костью', { skip }, async () => {
  await init();
  const demand = json('amulet-lich.demand.json').mods.concat([{ name: 'Gain #% of Physical Damage as Extra Cold Damage', pct: 60 }]);
  const r = await craft.advise(item('amulet-lich'), demand, cached);
  const planner = PlanCost.create(() => ({ prices, goalValue: null, est: null }));
  const steps = planner.expandPlan(r.goal.plan);
  const s = steps.find((x) => x.act === 'add' && /physical damage as extra cold/.test(x.mod));
  assert.ok(s && s.desecrateOnly);
  assert.ok(planner.stepCost(s).currencies.includes('Altered Collarbone'));
});

test('кольцо на миньонов (качество 40%): отработавший +20% Max Quality снимается вместе с Fire Damage, снятие не стоит «четверть цели» за второстепенный мод', { skip }, async () => {
  await init();
  const it = item('ring-minion');
  assert.equal(it.quality, 40, 'качество «Quality (Minion Modifiers)» распознано');
  const r = await craft.advise(it, json('ring-minion-themed.demand.json').mods, cached);
  assert.ok(r.goal.remove.some((x) => /maximum quality/.test(x.text)) && r.goal.remove.some((x) => /fire damage/.test(x.text)));
  const planner = PlanCost.create(() => ({ prices, goalValue: 800, est: 380 }));
  const rm = planner.expandPlan(r.goal.plan).find((s) => s.act === 'remove' && s.mods);
  assert.ok(rm.freeQuality);
  assert.ok(planner.stepCost(rm).cost < 150, 'снятие — десятки div, а не сотни');
});

test('палочка с руной Astrid\'s Creativity: два crafted-слота — Perfect Essence of Sorcery и Alloy на разные моды; без руны — один', { skip }, async () => {
  const two = await plan('wand-astrid');
  const ess2 = two.steps.map((s, i) => (s.act === 'add' && two.cost[i].k === 'essence' ? two.cost[i].currencies[0] : null)).filter(Boolean);
  assert.equal(ess2.length, 2, 'два шага через crafted-слот');
  assert.equal(new Set(ess2).size, 2, 'разные источники');
  const one = await plan('wand-open-prefixes');
  assert.equal(one.steps.filter((s, i) => s.act === 'add' && one.cost[i].k === 'essence').length, 1);
});

test('посох огня (Ashen Staff, +Fire Spell Skills): моды других стихий не запрещены — теги no_*_spell_mods игра не применяет (на трейде есть Ashen Staff с increased Cold Damage)', { skip }, async () => {
  await init();
  assert.ok(craft.canAppear('Ashen Staff', '#% increased Cold Damage'), 'increased Cold Damage может быть на Ashen Staff');
  const p = await plan('staff-fire');
  assert.ok(p.goal, 'план есть');
});

test('скипетр на миньонов: crafted «maximum stacks of Puppet Master» включён, хотя по всему классу его носят немногие', { skip }, async () => {
  await init();
  const it = parseItem(['Item Class: Sceptres', 'Rarity: Rare', 'Doom Call', 'Rattling Sceptre', '--------', 'Item Level: 80', '--------',
    '{ Prefix Modifier "Taskmaster\'s" (Tier: 1) — Minion, Gem }', '+3(3-3) to Level of all Minion Skills',
    '{ Prefix Modifier "Prince\'s" (Tier: 2) — }', '58(56-60)% increased Spirit',
    '{ Crafted Suffix Modifier "of the Puppeteer" — Minion }', '+4(4-5) maximum stacks of Puppet Master'].join('\n'));
  // Спрос по всему классу скипетров (без темы): Puppet Master — 20%, ниже порога «включать по спросу».
  const demand = { mods: json('sceptre-minion.demand.json').mods.map((m) => (/Puppet Master/.test(m.name) && /maximum stacks/.test(m.name) ? { ...m, pct: 20 } : m)) };
  const f = pricing.prepare(it, demand, () => true).filters;
  const m = mod(f, /maximum stacks of Puppet Master/);
  assert.ok(m && m.enabled, 'Puppet Master включён');
});

test('веса палочек и посохов — по базам той же стихии, если таких вещей от 100', { skip }, async () => {
  await init();
  const d = await craft.load(cached);
  const rows = (n, base) => Array.from({ length: n }, () => ({ base }));
  const items = [...rows(120, 'Volatile Wand'), ...rows(150, 'Attuned Wand'), ...rows(40, 'Frigid Wand'), ...rows(60, null)];
  const bases = ['Volatile Wand', 'Attuned Wand', 'Frigid Wand'];
  const W = { classes: { Wands: { items: items.length, types: ['X'], raw: items.map(() => [[0, 1]]), bases, rowBase: items.map((x) => bases.indexOf(x.base)) } } };
  assert.equal(craft.classWeights(W, 'Wands', d.bases.get('Volatile Wand'), d).items, 120, 'огненная — только огненные базы');
  assert.equal(craft.classWeights(W, 'Wands', d.bases.get('Siphoning Wand'), d).items, 150, 'обычная — только обычные');
  assert.equal(craft.classWeights(W, 'Wands', d.bases.get('Frigid Wand'), d).items, items.length, 'холодных меньше 100 — весь класс');
});

test('белая база: ilvl ищется ступенью тиров — от последнего открытого тира до следующего', { skip }, async () => {
  await init();
  const b = craft.ilvlBand('Sandsworn Sandals', 70);
  assert.deepEqual([b.min, b.max, b.next.level], [68, 70, 71], 'на 71 открываются сопротивления');
  assert.ok(b.next.mods.some((m) => /fire resistance/.test(m)));
  const top = craft.ilvlBand('Sandsworn Sandals', 84);
  assert.deepEqual([top.min, top.max, top.next], [82, null, null], 'выше 82 новых тиров нет: 84 = 82');
  assert.equal(craft.ilvlBand('No Such Base', 80), null);
});
