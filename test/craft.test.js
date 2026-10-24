// Craft and price control scenarios: items the advice got wrong (test/fixtures/craft/*.txt), with a snapshot of
// poe.ninja demand and currency prices (scripts/snapshot-craft-fixtures.js). We check plan properties, not exact numbers.
// Data is a snapshot of RePoE and the trade reference (test/fixtures/data, scripts/snapshot-test-data.js); CRAFT_LIVE=1 uses
// the app's live cache (%APPDATA%/PoE 2 Price Checker/cache): check the scenarios on fresh data before updating the snapshot.
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
const skip = has ? false : `no data (${CACHE})`;
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

// The scenario item: for a magic item the base is the longest base name contained in its name (like resolveBase in the window).
function item(name) {
  const it = parseItem(read(`${name}.txt`));
  if (it.rarity === 'Magic') it.baseType = bases.filter((n) => it.name.includes(n)).sort((a, b) => b.length - a.length)[0];
  return it;
}
async function plan(name, extra = []) {
  await init();
  const r = await craft.advise(item(name), json(`${name}.demand.json`).mods.concat(extra), cached);
  assert.ok(r.goal, `${name}: plan not built (${r.note || ''})`);
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

test('minion sceptre: goal is minion levels, weak desecrated removed (Annulment run, Omen of Light if last), Desecrate goes to levels', { skip }, async () => {
  const p = await plan('sceptre-minion');
  assert.ok(p.goal.add.some((a) => /level of all minion skills/.test(a.text)), 'minion levels in the goal');
  assert.ok(p.goal.remove.some((r) => r.tag === 'desecrated'), 'desecrated is removed');
  // With other junk to Annul, the desecrated one goes into the same run: Omen of Light only if it is the last one left.
  const i = p.steps.findIndex((s) => s.act === 'remove' && (s.targeted || s.des));
  assert.ok(i >= 0, 'desecrated removal is planned');
  const rm = p.steps[i];
  if (rm.des) {
    const c = p.cost[i];
    assert.ok(c.des && c.des.left > 0 && c.des.left < 1, 'Omen of Light is a fallback, not certain');
    assert.ok(!rm.sides[rm.des.side].names.includes(rm.des.mod), 'the desecrated junk is not listed as a wanted mod');
  }
  const minion = stepFor(p, /level of all minion skills/);
  assert.ok(minion && minion.c.k === 'desecrate', 'minion levels via Desecrate');
});

test('minion sceptre: +# minion levels aim at T1 (+4) only; weighted tiers make it rare, Greater / Perfect cut the low ones', { skip }, async () => {
  const p = await plan('sceptre-minion');
  const s = p.steps.flatMap((x) => (x.act === 'add2' ? x.steps : [x])).find((x) => x.act === 'add' && /level of all minion skills/.test(x.mod));
  assert.ok(s, 'the step exists');
  assert.equal(s.target, 'T1', 'only +4 is the goal');
  const { base, greater, perfect } = s.exalt;
  assert.ok(base.chance < 1 / 100, `a plain Exalted is a long shot: 1 in ${Math.round(1 / base.chance)}`);
  assert.ok(base.chance < greater.chance && greater.chance < perfect.chance, 'cutting low tiers helps, step by step');
});

test('weak tier of a key mod: the way to the goal tier is priced; a tier already worth the goal is not «weak»', { skip }, async () => {
  await init();
  const tierups = async (name) => {
    const r = await craft.advise(item(name), json(`${name}.demand.json`).mods, cached);
    return (r.sections || []).filter((s) => s.kind === 'tierup').flatMap((s) => s.mods);
  };
  const spear = await tierups('spear-rare-destruction');
  const light = spear.find((m) => /lightning damage/.test(m.text));
  assert.ok(light, 'flat lightning T4 is a weak key mod');
  assert.equal(light.goal, 'T1', 'the goal is the top roll (the largest number, not the minimum damage)');
  assert.ok(light.again > 0 && light.again < 1 / 100, `one Exalted brings T1 back rarely: 1 in ${Math.round(1 / light.again)}`);
  assert.equal(light.sameSide, 2, 'a side Annulment hits it 1 in 2');
  assert.ok(!('mod' in light), 'the window gets numbers, not the RePoE record');
  const gloves = await tierups('gloves-es-fractured');
  assert.ok(!gloves.some((m) => /lightning resistance/.test(m.text)), 'T3 resistance is within the goal (≥ 85% of the best allowed roll)');
});

test('Tiara: Whittling is not offered — it would remove the +2 to minions (lowest level)', { skip }, async () => {
  const p = await plan('tiara-minion');
  const rm = p.steps.find((s) => s.act === 'remove' && s.mods);
  assert.ok(rm, 'there is a removal step');
  assert.equal(rm.whittle, null);
  assert.ok(rm.whittleWrong && /minion skills/.test(rm.whittleWrong.mod));
});

test('boots without speed: Movement Speed via Essence of Hysteria (crafted slot) is the first addition', { skip }, async () => {
  const p = await plan('boots-no-ms');
  const ms = stepFor(p, /movement speed$/);
  assert.ok(ms && ms.c.k === 'essence' && /Hysteria/.test(ms.c.currencies[0]), 'Hysteria for speed');
  const firstAdd = p.steps.findIndex((s) => s.act === 'add' || s.act === 'add2');
  assert.equal(p.steps[firstAdd], ms.s, 'essence is the first addition');
});

test('boots without speed: Hysteria with Omen of Dextral Crystallisation removes junk suffixes before the Annulments', { skip }, async () => {
  // Free prefixes, junk suffixes: the essence's own removal goes to the other side as the first attempt of the run
  // (verified in game with The Runebinder's Alloy, 2026-10-22) — no sacrificial Exalt, the prefixes are never hit.
  const p = await plan('boots-no-ms');
  const e = p.steps.findIndex((s) => s.act === 'add' && s.cross);
  const r = p.steps.findIndex((s) => s.act === 'remove' && s.sides);
  assert.ok(e >= 0 && e < r, 'the essence goes before the removal');
  assert.deepEqual(p.cost[e].currencies.slice(1), ['Omen of Dextral Crystallisation'], 'only the omen of the other side, no sacrifice');
  assert.equal(p.steps[r].essMerge.side, 'suffix', 'the removal counts the essence as one attempt');
});

test('ilvl 82 boots: Hysteria 30% speed is tier 2 — with a known goal price the plan weighs the lower tier', { skip }, async () => {
  const p = await plan('boots-no-ms');
  const ms = p.steps.find((s) => s.act === 'add' && /movement speed$/.test(s.mod));
  assert.deepEqual(ms.essTier['Essence of Hysteria'], { tier: 2, value: '30' }, 'Hysteria is placed on the ladder');
  assert.equal(ms.bestTier, 1, 'ilvl 82 rolls T1');
  const r = p.r;
  const planner = PlanCost.create(() => ({ prices, goalValue: 2000, est: 100 }));
  const steps = planner.expandPlan(r.goal.plan);
  const i = steps.findIndex((s) => s.act === 'add' && /movement speed$/.test(s.mod));
  const c = planner.stepCost(steps[i]);
  // Exalted at T1 speed stays a long lottery, so the guaranteed essence still wins — but its lower tier is priced in.
  assert.ok(c.k === 'essence' && c.low === 1, 'the essence step carries the one-tier loss');
});

test('wand: spell levels via Perfect Essence (crafted slot)', { skip }, async () => {
  const p = await plan('wand-open-prefixes');
  const lv = stepFor(p, /level of all spell skills/);
  assert.ok(lv && lv.c.k === 'essence', 'Perfect Essence for spell levels');
});

test('rare spear: Celestial Alloy (Accuracy / Attack Speed) via the crafted slot, unwanted Dexterity T2 is removed', { skip }, async () => {
  const p = await plan('spear-rare-destruction');
  assert.ok(p.goal.add.some((a) => /accuracy rating \/ #% increased attack speed/.test(a.text)), 'Alloy hybrid in the goal');
  assert.ok(p.goal.remove.some((r) => /dexterity/.test(r.text)), 'Dexterity is removed');
  const alloy = stepFor(p, /accuracy rating \/ #% increased attack speed/);
  assert.ok(alloy && alloy.c.k === 'essence' && /Alloy/.test(alloy.c.currencies[0]));
});

test('magic spear: first step is the Thrud\'s Might rune, the essence mod is not added a second time', { skip }, async () => {
  const p = await plan('spear-magic');
  assert.equal(p.steps[0].act, 'rune');
  assert.deepEqual(p.steps[0].currencies, ["Thrud's Might"]);
  const ess = p.steps.find((s) => s.act === 'essence');
  assert.ok(ess, 'essence magic → rare');
  const adds = p.steps.flatMap((s) => (s.act === 'add2' ? s.steps : s.act === 'add' ? [s] : [])).map((s) => s.mod);
  assert.ok(!adds.includes(ess.mod), 'essence mod is not repeated');
});

test('body armour with desecrated: two open slots on different sides — one Exalted with Omen of Greater Exaltation', { skip }, async () => {
  // Armour and ES on the body armour are wanted (demand raised): goal is one mod per prefix and suffix, no removals.
  const p = await plan('mantle-desecrated', [{ name: '# to Armour', pct: 90 }, { name: '# to maximum Energy Shield', pct: 90 }]);
  assert.ok(p.steps.some((s) => s.act === 'add2' && s.cross), 'cross-side pair');
});

test('minion ring: three minion mods are checked and key', { skip }, async () => {
  const f = await filters('ring-minion', 'ring-minion.demand.json');
  for (const re of [/Critical Damage Bonus/, /Critical Hit Chance/, /Cooldown Recovery/]) {
    const m = mod(f, re);
    assert.ok(m && m.enabled && m.key, `${re} checked and key`);
  }
});

test('ES boots: life (low demand) and Stun Threshold are unchecked, total life is off', { skip }, async () => {
  const f = await filters('boots-es', 'boots-es.demand.json');
  assert.equal(mod(f, /^\+137 to maximum Life/).enabled, false);
  assert.equal(mod(f, /Stun Threshold/).enabled, false);
  assert.equal(mod(f, /total maximum Life/).enabled, false);
  assert.equal(mod(f, /Movement Speed/).enabled, true);
});

test('magic wand: skill levels are searched at exactly their value (4 to 4)', { skip }, async () => {
  const f = await filters('wand-magic-levels', 'wand-magic-levels.demand.json');
  const lv = mod(f, /Level of all Cold Spell Skills/);
  assert.equal(lv.min, 4);
  assert.equal(lv.max, 4);
});

test('Heart of the Well: key random mods are required, an unwanted one (< 10%) is unchecked', { skip }, async () => {
  const f = await filters('unique-heart-of-the-well', 'unique-heart-of-the-well.demand.json');
  for (const re of [/Extra Cold/, /Extra Lightning/]) assert.ok(mod(f, re).enabled && mod(f, re).key, `${re} is key`);
  assert.equal(mod(f, /Ailment Threshold/).enabled, false);
});

test('Controlled Metamorphosis: ring size is an ordinal roll (Massive = 8 of 1…8), the fixed mod is hidden', { skip }, async () => {
  const f = await filters('unique-controlled-metamorphosis.txt');
  const ring = mod(f, /Massive Ring/);
  assert.deepEqual([ring.ordinal.idx, ring.ordinal.lo, ring.ordinal.hi], [8, 1, 8]);
  assert.equal(f.hiddenFixed, 1);
});

test('Mageblood: Legacy is a random variant out of 14 (Divine rerolls it)', { skip }, async () => {
  const f = await filters('unique-mageblood.txt');
  const legacies = f.mods.filter((m) => /^Legacy of/.test(m.text));
  assert.equal(legacies.length, 4);
  for (const m of legacies) assert.equal(m.categorical && m.categorical.n, 14);
});

test('plan simulation: outcome and cost distribution, profit chance — within reasonable bounds', { skip }, async () => {
  await init();
  const r = await craft.advise(item('boots-no-ms'), json('boots-no-ms.demand.json').mods, cached);
  const planner = PlanCost.create(() => ({ prices, goalValue: 20, est: 5 }));
  const sim = planner.simulate(r.goal.plan, { keep: r.goal.keep.length }, 500);
  assert.ok(sim.value.p10 <= sim.value.p50 && sim.value.p50 <= sim.value.p90);
  assert.ok(sim.spent.mean > 0);
  assert.ok(sim.profit >= 0 && sim.profit <= 1 && sim.full >= 0 && sim.full <= 1);
  assert.equal(PlanCost.create(() => ({ prices, goalValue: null, est: 5 })).simulate(r.goal.plan), null, 'no goal price — no simulation');
});

test('cold staff: elemental mods use demand of the best element (Aldur runes), price is checked in fire first', { skip }, async () => {
  const f = await filters('staff-cold', 'staff-cold.demand.json');
  assert.ok(mod(f, /Extra Cold Damage/).enabled, 'Extra Cold is checked');
  const it = item('staff-cold');
  pricing.prepare(it, json('staff-cold.demand.json'), () => true);
  const vars = pricing.elementVariants(it, f);
  assert.equal(vars[0].element, 'Fire');
  assert.ok(vars[0].filters.mods.some((m) => m.enabled && /Extra Fire Damage/.test(m.text)));
  assert.ok(vars[0].filters.mods.some((m) => m.enabled && /Level of all Fire Spell Skills/.test(m.text)));
});

test('cold staff in crafting: Cold mods are kept (demand of the best element), advice about Passion of Aldur', { skip }, async () => {
  const p = await plan('staff-cold');
  assert.ok(p.goal.keep.some((k) => /extra cold damage/.test(k.text)) && p.goal.keep.some((k) => /cold spell skills/.test(k.text)));
  const cheap = (p.r.sections.find((s) => s.kind === 'cheap') || { how: [] }).how;
  assert.ok(cheap.some((h) => /Passion of Aldur/.test(h)));
});

test('amulet: lich mod (Desecrate only) — via a bone with a lich omen, not in a Greater Exaltation pair', { skip }, async () => {
  const p = await plan('amulet-lich');
  const step = p.steps.find((s) => s.act === 'add' && s.desecrateOnly);
  assert.ok(step, 'there is a lich mod step');
  const c = p.cost[p.steps.indexOf(step)];
  // Desecrate with a lich omen — or a Perfect essence that gives the very same line for sure (Enhancement on an amulet).
  if (c.k === 'essence') assert.ok((step.crafted || []).includes(c.currencies[0]), `the essence gives this line: ${c.currencies[0]}`);
  else {
    assert.equal(c.k, 'desecrate');
    assert.ok(c.currencies.some((n) => /^Omen of the (Sovereign|Liege|Blackblooded)$/.test(n)), 'lich omen in the currency');
  }
  assert.ok(!p.steps.some((s) => s.act === 'add2' && s.steps.some((x) => x.desecrateOnly)), 'not in a pair');
});

test('amulet: identical affix names ("of Kurgal") are told apart by text, the essence mod (Essences) is recognized', { skip }, async () => {
  const p = await plan('amulet-minion');
  assert.ok(p.goal.remove.some((r) => /minions have #% increased cooldown recovery rate/.test(r.text)), 'Minions CDR itself is removed');
  assert.ok(!p.goal.remove.some((r) => /cold and chaos/.test(r.text)), 'not a made-up mod with the same name');
  assert.ok(p.goal.keep.some((k) => /global armour, evasion and energy shield/.test(k.text)), 'essence mod recognized');
});

test('jewellery: otherworldly mod (Altered Collarbone) — only via Desecrate with that bone', { skip }, async () => {
  await init();
  const demand = json('amulet-lich.demand.json').mods.concat([{ name: 'Gain #% of Physical Damage as Extra Cold Damage', pct: 60 }]);
  const r = await craft.advise(item('amulet-lich'), demand, cached);
  const planner = PlanCost.create(() => ({ prices, goalValue: null, est: null }));
  const steps = planner.expandPlan(r.goal.plan);
  const s = steps.find((x) => x.act === 'add' && /physical damage as extra cold/.test(x.mod));
  assert.ok(s && s.desecrateOnly);
  assert.ok(planner.stepCost(s).currencies.includes('Altered Collarbone'));
});

test('minion ring (quality 40%): the spent +20% Max Quality is removed with Fire Damage, removal does not cost "a quarter of the goal" for a minor mod', { skip }, async () => {
  await init();
  const it = item('ring-minion');
  assert.equal(it.quality, 40, '"Quality (Minion Modifiers)" recognized');
  const r = await craft.advise(it, json('ring-minion-themed.demand.json').mods, cached);
  assert.ok(r.goal.remove.some((x) => /maximum quality/.test(x.text)) && r.goal.remove.some((x) => /fire damage/.test(x.text)));
  const planner = PlanCost.create(() => ({ prices, goalValue: 800, est: 380 }));
  const rm = planner.expandPlan(r.goal.plan).find((s) => s.act === 'remove' && s.mods);
  assert.ok(rm.freeQuality);
  assert.ok(planner.stepCost(rm).cost < 150, 'removal costs tens of div, not hundreds');
});

test('wand with Astrid\'s Creativity rune: two crafted slots — Perfect Essence of Sorcery and Alloy on different mods; without the rune — one', { skip }, async () => {
  const two = await plan('wand-astrid');
  const ess2 = two.steps.map((s, i) => (s.act === 'add' && two.cost[i].k === 'essence' ? two.cost[i].currencies[0] : null)).filter(Boolean);
  assert.equal(ess2.length, 2, 'two steps via the crafted slot');
  assert.equal(new Set(ess2).size, 2, 'different sources');
  const one = await plan('wand-open-prefixes');
  assert.equal(one.steps.filter((s, i) => s.act === 'add' && one.cost[i].k === 'essence').length, 1);
});

test('fire staff (Ashen Staff, +Fire Spell Skills): other element mods are not forbidden — the game ignores no_*_spell_mods tags (trade has Ashen Staff with increased Cold Damage)', { skip }, async () => {
  await init();
  assert.ok(craft.canAppear('Ashen Staff', '#% increased Cold Damage'), 'increased Cold Damage can be on Ashen Staff');
  const p = await plan('staff-fire');
  assert.ok(p.goal, 'there is a plan');
});

test('minion sceptre: crafted "maximum stacks of Puppet Master" is on, even though few across the whole class have it', { skip }, async () => {
  await init();
  const it = parseItem(['Item Class: Sceptres', 'Rarity: Rare', 'Doom Call', 'Rattling Sceptre', '--------', 'Item Level: 80', '--------',
    '{ Prefix Modifier "Taskmaster\'s" (Tier: 1) — Minion, Gem }', '+3(3-3) to Level of all Minion Skills',
    '{ Prefix Modifier "Prince\'s" (Tier: 2) — }', '58(56-60)% increased Spirit',
    '{ Crafted Suffix Modifier "of the Puppeteer" — Minion }', '+4(4-5) maximum stacks of Puppet Master'].join('\n'));
  // Demand across the whole sceptre class (no theme): Puppet Master is 20%, below the "enable by demand" threshold.
  const demand = { mods: json('sceptre-minion.demand.json').mods.map((m) => (/Puppet Master/.test(m.name) && /maximum stacks/.test(m.name) ? { ...m, pct: 20 } : m)) };
  const f = pricing.prepare(it, demand, () => true).filters;
  const m = mod(f, /maximum stacks of Puppet Master/);
  assert.ok(m && m.enabled, 'Puppet Master is on');
});

test('wand and staff weights use bases of the same element if there are 100+ such items', { skip }, async () => {
  await init();
  const d = await craft.load(cached);
  const rows = (n, base) => Array.from({ length: n }, () => ({ base }));
  const items = [...rows(120, 'Volatile Wand'), ...rows(150, 'Attuned Wand'), ...rows(40, 'Frigid Wand'), ...rows(60, null)];
  const bases = ['Volatile Wand', 'Attuned Wand', 'Frigid Wand'];
  const W = { classes: { Wands: { items: items.length, types: ['X'], raw: items.map(() => [[0, 1]]), bases, rowBase: items.map((x) => bases.indexOf(x.base)) } } };
  assert.equal(craft.classWeights(W, 'Wands', d.bases.get('Volatile Wand'), d).items, 120, 'fire — only fire bases');
  assert.equal(craft.classWeights(W, 'Wands', d.bases.get('Siphoning Wand'), d).items, 150, 'plain — only plain ones');
  assert.equal(craft.classWeights(W, 'Wands', d.bases.get('Frigid Wand'), d).items, items.length, 'fewer than 100 cold — whole class');
});

test('normal base: ilvl is searched as a tier band — from the last unlocked tier to the next one', { skip }, async () => {
  await init();
  const b = craft.ilvlBand('Sandsworn Sandals', 70);
  assert.deepEqual([b.min, b.max, b.next.level], [68, 70, 71], 'resistances unlock at 71');
  assert.ok(b.next.mods.some((m) => /fire resistance/.test(m)));
  const top = craft.ilvlBand('Sandsworn Sandals', 84);
  assert.deepEqual([top.min, top.max, top.next], [82, null, null], 'no new tiers above 82: 84 = 82');
  assert.equal(craft.ilvlBand('No Such Base', 80), null);
});

test('tablets: all mods are found on trade (gold "(Gold Piles)", "2 additional Rare Chests"), uses are a filter', { skip }, async () => {
  for (const [file, uses] of [['tablet-rare.txt', 6], ['tablet-irradiated.txt', 10]]) {
    const f = await filters(file);
    const bad = f.mods.filter((m) => !m.statId).map((m) => m.text);
    assert.deepEqual(bad, [], `${file}: no stat`);
    const u = f.props.find((p) => p.key === 'uses');
    // A used one is searched among full ones (10); the window recalculates the price by what remains.
    assert.ok(u && u.enabled && u.value === uses && u.min === Math.max(uses, 10), `${file}: uses ${uses}, search ≥ ${u && u.min}`);
  }
  const chests = (await filters('tablet-irradiated.txt')).mods.find((m) => /Rare Chests/.test(m.text));
  assert.equal(chests.value, 2);
});

test('normal base: "lucky ilvl" — above the last tier of wanted mods there are only tiers of unwanted ones', { skip }, async () => {
  await init();
  const it = parseItem(read('../normal-boots.txt'));
  const r = await craft.advise(it, json('boots-es.demand.json').mods, cached);
  assert.ok(r.ilvlHint, 'there is a hint');
  assert.ok(r.ilvlHint.from < 79 && r.ilvlHint.junk.length);
});

test('tablet: uncorrupted — among exactly 10 uses, corrupted with 13 — at least 13, no recalculation', { skip }, async () => {
  const uses = async (file) => (await filters(file)).props.find((p) => p.key === 'uses');
  const six = await uses('tablet-rare.txt');
  assert.deepEqual([six.value, six.min, six.max], [6, 10, 10]);
  const thirteen = await uses('tablet-corrupted-13.txt');
  assert.deepEqual([thirteen.value, thirteen.min, thirteen.max], [13, 13, undefined]);
});

test('jewels: emotions — variants by base colour (Ancient — Time-Lost only), risk — key mods among all mods', { skip }, async () => {
  await init();
  const demand = [{ name: 'Upgrades Radius to Very Large', pct: 80 }, { name: 'Notable Passive Skills in Radius also grant #% increased Critical Hit Chance for Spells', pct: 41 },
    { name: 'Small Passive Skills in Radius also grant #% increased Spell Damage', pct: 35 }];
  const r = await craft.advise(parseItem(read('../rare-timelost-sapphire.txt')), demand, cached);
  const em = r.sections.find((s) => s.kind === 'emotions');
  const names = em.options.map((o) => o.name);
  assert.ok(names.includes('Ancient Potent Liquid Melancholy') && names.includes('Ancient Liquid Despair'), names.join(', '));
  assert.ok(!names.some((n) => !/^Ancient /.test(n)), 'Time-Lost gets Ancient only');
  assert.equal(names.filter((n) => n === 'Ancient Potent Liquid Contempt').length, 1, 'two sides — one row');
  // Small Spell Damage is on the item and wanted (35%) — key; removes 1 of 3 mods.
  assert.deepEqual([em.risk.n, em.risk.keys.length], [3, 1]);
  const basic = await craft.advise(parseItem(read('../rare-jewel-full.txt')), [], cached);
  assert.ok(basic.sections.find((s) => s.kind === 'emotions').blocked, 'a crafted mod is already present');
});

test('two junk suffixes, one slot needed: the weak one goes (Attribute Requirements, not Chaos Resistance), whatever the item order', { skip }, async () => {
  await init();
  const demand = [{ name: '#% increased Energy Shield', pct: 100 }, { name: '# to maximum Energy Shield', pct: 100 },
    { name: '#% increased Cast Speed', pct: 40 }, { name: '#% to Cold Resistance', pct: 34 }];
  const r = await craft.advise(item('focus-es-junk'), demand, cached);
  assert.ok(r.goal, r.note || 'plan not built');
  const cast = r.goal.add.find((a) => /cast speed/i.test(a.text));
  assert.ok(cast, 'cast speed is a goal mod');
  const planner = PlanCost.create(() => ({ prices, goalValue: null, est: null }));
  const rem = planner.subPlan(r.goal.plan, new Set([cast.text])).find((s) => s.act === 'remove');
  assert.deepEqual(rem && rem.mods.map((m) => m.toLowerCase()), ['#% reduced attribute requirements']);
  // Chaos Resistance stays spare: an Annulment taking it instead frees the slot too. 1 junk to remove among 2 junk:
  // K·J/(J+S+1) wanted ones lost on average — with the side omen K = 1 (Cold Resistance): 1/3, not 1/2; a plain
  // Annulment, K = 4 (three prefixes too): 4/3, not 2.
  assert.equal(rem.sides.suffix.S, 1);
  assert.deepEqual(rem.sides.suffix.names.map((m) => m.toLowerCase()), ['+23% to cold resistance']);
  const c = planner.removeCost(rem);
  const want = c.currencies.includes('Omen of Dextral Annulment') ? 1 / 3 : 4 / 3;
  assert.ok(Math.abs(c.hits - want) < 1e-9, `hits ${c.hits} with ${c.currencies.join(', ')}`);
});

test('magic jewel: Augmentation and Regal add random mods — the plan counts their slots and never exceeds 2 + 2', { skip }, async () => {
  await init();
  const demand = [{ name: '#% increased Critical Hit Chance for Attacks', pct: 70 }, { name: '#% increased Critical Damage Bonus for Attack Damage', pct: 65 },
    { name: '#% increased Projectile Damage', pct: 50 }, { name: '#% increased Attack Damage', pct: 45 }];
  const it = parseItem(read('../magic-jewel-one-mod.txt'));
  it.baseType = bases.filter((n) => it.name.includes(n)).sort((a, b) => b.length - a.length)[0];
  const r = await craft.advise(it, demand, cached);
  assert.ok(r.goal, r.note || 'plan not built');
  assert.ok(r.goal.remove.some((x) => x.tag === 'random'), 'the random mod is removed as junk');
  const steps = PlanCost.create(() => ({ prices, goalValue: null, est: null })).expandPlan(r.goal.plan);
  let mods = 1, most = 1; // the fixture has one mod
  for (const s of steps) {
    if (s.act === 'augment' || s.act === 'regal' || s.act === 'essence') mods += 1;
    else if (s.act === 'remove') mods -= s.mods ? s.mods.length : 1;
    else if (s.act === 'add') mods += 1;
    else if (s.act === 'add2') mods += 2;
    most = Math.max(most, mods);
  }
  assert.ok(most <= 4, `slots exceeded: ${most} (${steps.map((s) => s.act).join(', ')})`);
  // The additions fill all free slots: a side omen changes nothing — none is used (with or without jewel weights).
  assert.ok(r.goal.plan.every((s) => !s.sideOmen), r.goal.plan.map((s) => `${s.act}:${s.sideOmen || '-'}`).join(', '));
});

test('every scenario: an unwanted mod is removed only when its slot is needed for a goal mod', { skip }, async () => {
  await init();
  const names = fs.readdirSync(FIX).filter((f) => f.endsWith('.txt') && fs.existsSync(path.join(FIX, f.replace(/\.txt$/, '.demand.json')))).map((f) => f.replace(/\.txt$/, ''));
  let checked = 0;
  for (const name of names) {
    const r = await craft.advise(item(name), json(`${name}.demand.json`).mods, cached);
    if (!r.goal) continue;
    for (const side of ['prefix', 'suffix']) {
      const plain = r.goal.remove.filter((x) => x.side === side && !['desecrated', 'crafted', 'random'].includes(x.tag)).length;
      if (!plain) continue;
      const occupied = r.goal.keep.filter((x) => x.side === side).length + r.goal.remove.filter((x) => x.side === side).length;
      const added = r.goal.add.filter((x) => x.side === side).length;
      const need = occupied + added - r.max[side];
      assert.ok(plain <= Math.max(0, need), `${name}: ${side} removes ${plain} unwanted, only ${Math.max(0, need)} slot(s) needed`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'no scenario removes an unwanted mod — the check is empty');
});

test('magic helmet (3 + 3): there is room for the Regal mod — the plan does not remove it', { skip }, async () => {
  await init();
  const it = parseItem(read('../magic-helmet.txt'));
  it.baseType = bases.filter((n) => it.name.includes(n)).sort((a, b) => b.length - a.length)[0];
  const r = await craft.advise(it, [{ name: '# to maximum Life', pct: 70 }], cached);
  assert.ok(r.goal, r.note || 'plan not built');
  assert.ok(!r.goal.remove.some((x) => x.tag === 'random'), 'no removal of the random mod');
  assert.ok(!r.goal.plan.some((s) => s.act === 'remove' && (s.mods || []).some((m) => /random modifier/.test(m))));
});

test('jewel: Ferocity (Effect of Prefixes / Suffixes) — always in the search and key', { skip }, async () => {
  const f = await filters('rare-jewel-full.txt');
  const fer = f.mods.find((m) => /Effect of Prefixes/.test(m.text));
  assert.ok(fer && fer.enabled && fer.key);
});

test('jewel with a side over the limit (3 suffixes after removing "+1"): suffixes are untouched, the plan is prefixes only', { skip }, async () => {
  await init();
  const demand = [{ name: '#% increased Critical Hit Chance for Attacks', pct: 46 }, { name: '#% increased Critical Damage Bonus for Attack Damage', pct: 43 },
    { name: '#% increased Attack Speed', pct: 40 }, { name: '#% increased Projectile Damage', pct: 36 }];
  const r = await craft.advise(parseItem(read('../jewel-overfull-suffixes.txt')), demand, cached);
  assert.ok(r.sections.some((s) => s.kind === 'overfull' && s.side === 'suffix'));
  assert.ok(r.goal.plan.every((s) => s.side !== 'suffix' && !(s.sides && s.sides.suffix && s.sides.suffix.J)), JSON.stringify(r.goal.plan));
});

test('shield: Desecrate for a suffix-only mod takes the side Necromancy omen even when the goal fills every slot', { skip }, async () => {
  const p = await plan('shield-armour-ele');
  const des = p.steps.map((s, i) => ({ s, c: p.cost[i] })).filter(({ c }) => c.k === 'desecrate');
  for (const { s, c } of des) {
    const other = s.side === 'prefix' ? 'suffix' : 'prefix';
    const room = p.r.max[other] > (p.r.goal.keep.filter((x) => x.side === other).length);
    if (room) assert.ok(c.currencies.some((n) => /Necromancy$/.test(n)), `${s.mod}: Desecrate without a side omen (${c.currencies.join(', ')})`);
  }
});

test('plan variants: each is clearly cheaper than a fuller one and removes only what its mods need', { skip }, async () => {
  const variantsOf = async (name) => {
    const p = await plan(name);
    const planner = PlanCost.create(() => ({ prices, goalValue: 40, est: 0.01 }));
    return { planner, vs: planner.variants(p.goal) };
  };
  const { planner, vs } = await variantsOf('boots-no-ms');
  assert.ok(vs && vs.length >= 2 && vs[vs.length - 1].key === 'ideal', 'boots: a cheaper variant next to the full goal');
  for (let i = 0; i + 1 < vs.length; i++) assert.ok(vs[i].spend < vs[i + 1].spend * 0.9 && vs[i].mods.length < vs[i + 1].mods.length, `${vs[i].key} saves currency`);
  // A variant without a side's mods does not pay for that side's removal.
  for (const v of vs) {
    const sides = new Set(planner.expandPlan(v.plan).flatMap((s) => (s.act === 'add2' ? s.steps : s.act === 'add' ? [s] : [])).map((x) => x.side));
    for (const s of v.plan.filter((x) => x.act === 'remove' && x.sides)) assert.ok(Object.keys(s.sides).every((sd) => !s.sides[sd].J || sides.has(sd)), `${v.key}: removal for an unused side`);
  }
  // The wand: the risky suffix removal costs nearly everything; prefixes are free — a variant fills them and removes nothing.
  const wand = (await variantsOf('wand-open-prefixes')).vs;
  assert.ok(wand && wand.some((v) => v.key !== 'ideal' && !v.plan.some((s) => s.act === 'remove')), 'wand: free prefixes without the removal');
  // The jewel has a free suffix: the variant with one suffix mod just adds it — no removal of the bow attack speed.
  const jewel = await variantsOf('jewel-bow-attack');
  const one = jewel.vs.find((v) => v.mods.length === 1);
  assert.ok(one && !one.plan.some((s) => s.act === 'remove'), 'one mod into the free slot needs no removal');
});

test('ES gloves: the theme is the ES archetype, not «Rarity + Dexterity» — the plan keeps the caster mods', { skip }, async () => {
  await init();
  const { themeMods } = require('../src/main/weights');
  const it = item('gloves-es-fractured');
  const theme = themeMods(pricing.prepare(it, null, () => true).filters.mods, it.itemClass);
  assert.ok(theme.length && theme.every((m) => /Energy Shield/.test(m)), `theme: ${theme.join(', ')}`);
  // With demand among ES glove builds: no Marksman rune, no projectile levels; the lightning resistance stays, Dexterity goes.
  const p = await plan('gloves-es-fractured');
  assert.ok(!p.steps.some((s) => s.act === 'rune'), 'no influence rune for another archetype');
  assert.ok(!p.goal.add.some((a) => /projectile/.test(a.text)), 'no projectile mods');
  assert.ok(!p.goal.remove.some((r) => /lightning resistance/.test(r.text)), 'lightning resistance stays');
  assert.ok(p.goal.remove.some((r) => /dexterity/.test(r.text)), 'Dexterity is the junk');
});

test('minion sceptre: the crafted Puppet Master counts for the theme; the plan goes for minion levels, not a caster mod', { skip }, async () => {
  await init();
  const { themeMods } = require('../src/main/weights');
  const it = item('sceptre-omen-minion');
  const theme = themeMods(pricing.prepare(it, null, () => true).filters.mods, it.itemClass);
  assert.ok(theme.some((m) => /Puppet Master/.test(m)), `theme: ${theme.join(', ')}`);
  assert.ok(theme.length <= 2, 'two mods: three narrow the builds down to a niche');
  const p = await plan('sceptre-omen-minion');
  assert.ok(p.goal.add.some((a) => /level of all minion skills/.test(a.text)), 'minion levels in the goal');
  // «Minions deal #% increased Damage with Command Skills» is a Genesis Tree mod — not in the Exalted / Chaos pool.
  assert.ok(!p.goal.add.some((a) => /command skills/.test(a.text)), 'no Genesis Tree mod');
});

test('candidate lists: ordered by the use of one attempt (demand × goal-tier odds), key mods kept; priced at the lowest goal tier', { skip }, async () => {
  await init();
  const use = (c) => c.pct * (c.chanceGoal ?? (c.exalt && c.exalt.base ? c.exalt.base.guess : 0) ?? 0);
  let lists = 0, multi = 0;
  for (const name of ['sceptre-minion', 'boots-es', 'wand-astrid', 'spear-rare-destruction', 'ring-minion']) {
    const r = await craft.advise(item(name), json(`${name}.demand.json`).mods, cached);
    for (const s of r.sections || []) {
      const list = s.candidates || [];
      if (list.length < 2) continue;
      lists++;
      for (let i = 1; i < list.length; i++) assert.ok(use(list[i - 1]) >= use(list[i]) - 1e-12, `${name} ${s.kind}: ${list[i].text} out of order`);
      for (const c of list) {
        // The price search starts at the lowest roll of the lowest goal tier.
        if (!c.targetLevels || c.targetLevels.length < 2 || !c.stats || c.stats.length !== 1 || !c.ladder) continue;
        const low = c.ladder.find((x) => x.level === Math.min(...c.targetLevels));
        const m = String(low.range || '').match(/^(-?[\d.]+)/);
        if (!m) continue;
        multi++;
        // «reduced» mods are negative on trade (−30 = 30% reduced): compare magnitudes.
        assert.equal(Math.abs(c.stats[0].min), Math.abs(Number(m[1])), `${name}: ${c.text} searched from ${c.stats[0].min}, the goal starts at ${low.range}`);
      }
    }
  }
  assert.ok(lists > 0, 'some candidate lists were checked');
  assert.ok(multi > 0, 'some multi-tier goals were checked');
});

test('alternatives «or …» do not hide a lottery: a rare key mod is not merged with far more common ones', { skip }, async () => {
  await init();
  // As on a player's minion sceptre: +# minion levels wanted by 30.9% of builds, mana regeneration and Intelligence by more
  // — they used to count as reaching the goal, priced with +4 minion levels: «1 in 2», «100% of runs better than selling».
  const mods = json('sceptre-minion.demand.json').mods.map((m) => (/Level of all Minion Skills/i.test(m.name) ? { ...m, pct: 30.9 } : m));
  const r = await craft.advise(item('sceptre-minion'), mods, cached);
  const s = r.goal.plan.flatMap((x) => x.steps || [x]).find((x) => x.act === 'add' && /level of all minion skills/.test(x.mod));
  assert.ok(s, 'the step exists');
  assert.ok(s.exalt.base.chance < 1 / 100, `still a long shot: 1 in ${Math.round(1 / s.exalt.base.chance)}`);
  for (const d of Object.values(s.desecrate || {})) if (d.chance != null) assert.ok(d.chance < 1 / 50, 'Desecrate odds are its own too');
});

test('amulet: a lich mod a Perfect essence also gives comes from the essence, for sure — not a Desecrate with three omens', { skip }, async () => {
  // Player's amulet (2026-10-25): «% increased Global Armour, Evasion and Energy Shield» was planned as Desecrate with
  // Omen of the Liege (~94%), while Perfect Essence of Enhancement gives exactly that line on an amulet.
  const p = await plan('amulet-enhancement');
  const i = p.steps.findIndex((s) => s.act === 'add' && /global armour, evasion and energy shield/.test(s.mod));
  assert.ok(i >= 0, 'the mod is in the plan');
  assert.equal(p.cost[i].k, 'essence', `by ${p.cost[i].currencies.join(' + ')}`);
  assert.equal(p.cost[i].currencies[0], 'Perfect Essence of Enhancement');
});
