// Craft plan cost model (src/shared/plancost.js) on synthetic steps and prices — no game data.
const test = require('node:test');
const assert = require('node:assert');
const PlanCost = require('../src/shared/plancost');

const PRICES = {
  'Exalted Orb': 0.01, 'Greater Exalted Orb': 0.1, 'Perfect Exalted Orb': 1, 'Orb of Annulment': 0.05,
  'Omen of Greater Exaltation': 0.5, 'Omen of Sinistral Annulment': 0.2, 'Omen of Dextral Annulment': 0.2,
  'Regal Orb': 0.01, 'Greater Regal Orb': 0.02, 'Perfect Regal Orb': 0.5,
};
const planner = (ctx = {}) => PlanCost.create(() => ({ prices: PRICES, goalValue: null, est: null, ...ctx }));
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);
// "Add a mod" step: chance to hit the wanted family with a regular / Greater / Perfect Exalted.
const add = (chance, extra = {}) => ({ act: 'add', mod: 'X', onItem: 0, onSide: 0,
  exalt: { base: { chance, guess: chance, pool: 10 }, greater: { chance, guess: chance, pool: 10 }, perfect: { chance, guess: chance, pool: 10 } }, ...extra });

test('removing an unwanted mod with Annulment: expected Σ (j+K)/j tries, of which Σ K/j hit a wanted mod', () => {
  const p = planner();
  // One unwanted, no wanted ones — exactly one orb.
  const one = p.removeCost({ act: 'remove', sides: { prefix: { J: 1, K: 0 } } });
  near(one.tries, 1, 'tries');
  near(one.cost, PRICES['Orb of Annulment'], 'cost');
  assert.equal(one.risky, false);
  // Two unwanted and one wanted: 3/2 + 2/1 = 3.5 tries, 1/2 + 1/1 = 1.5 hits.
  const two = p.removeCost({ act: 'remove', sides: { prefix: { J: 2, K: 1 } } });
  near(two.tries, 3.5, 'tries');
  near(two.hits, 1.5, 'hits');
  assert.ok(two.risky);
  // A hit wanted mod costs its restoration: with a goal price — a quarter of it.
  const withGoal = planner({ goalValue: 40 }).removeCost({ act: 'remove', sides: { prefix: { J: 2, K: 1 } } });
  near(withGoal.cost, 3.5 * 0.05 + 1.5 * 10, 'cost with goal price');
});

test('with a side omen we remove only among that side\'s mods — cheaper when wanted mods are on the other side', () => {
  const p = planner();
  const r = p.removeCost({ act: 'remove', sides: { prefix: { J: 1, K: 0, omen: 'Omen of Sinistral Annulment' }, suffix: { J: 0, K: 3, omen: 'Omen of Dextral Annulment' } } });
  assert.deepEqual(r.currencies, ['Orb of Annulment', 'Omen of Sinistral Annulment']);
  near(r.hits, 0, 'with the omen nothing wanted is hit');
});

test('removal via Essence of the Abyss: tries as with Annulment plus side omen, price is essence + Crystallisation + Light + Annulment', () => {
  const prices = { ...PRICES, 'Essence of the Abyss': 0.3, 'Omen of Sinistral Crystallisation': 0.5, 'Omen of Light': 4 };
  const sides = { prefix: { J: 2, K: 1, omen: 'Omen of Sinistral Annulment' }, suffix: { J: 0, K: 3, omen: 'Omen of Dextral Annulment' } };
  const p = PlanCost.create(() => ({ prices, goalValue: null, est: null }));
  const r = p.removeCost({ act: 'remove', sides, abyss: true });
  // The side omen at 0.2 is cheaper — the chain stays an "Instead" option.
  assert.equal(r.viaAbyss, false);
  near(r.abyss.tries, 3.5, 'tries as with the side omen');
  near(r.abyss.hits, 1.5, 'wanted mods hit');
  near(r.abyss.spent, 3.5 * (0.3 + 0.5 + 4 + 0.05), 'currency without the bone: Omen of Light removes the Mark');
  assert.deepEqual(r.abyss.currencies, ['Essence of the Abyss', 'Omen of Sinistral Crystallisation', 'Omen of Light', 'Orb of Annulment']);
  assert.notDeepEqual(r.other && r.other.currencies, r.abyss.currencies); // don't show it twice
  // The side omen got pricier, and Annulment without an omen hits expensive wanted suffixes — the plan picks the chain itself.
  const dear = PlanCost.create(() => ({ prices: { ...prices, 'Omen of Sinistral Annulment': 20 }, goalValue: 40, est: null }));
  const d = dear.removeCost({ act: 'remove', sides, abyss: true });
  assert.equal(d.viaAbyss, true);
  assert.equal(d.currencies[0], 'Essence of the Abyss');
  assert.equal(d.abyss, null);
  // The essence can't be applied to the item (abyss: false) — no option.
  assert.equal(p.removeCost({ act: 'remove', sides }).abyss, null);
});

test('add a mod with Exalted until success: (try price + (1−p)·removal) / p, cheapest orb tier is chosen', () => {
  const c = planner().stepCost(add(0.5));
  assert.equal(c.k, 'base'); // all tiers have the same chance — the regular one is cheaper
  near(c.cost, (0.01 + 0.5 * 0.05) / 0.5, 'cost');
  assert.deepEqual(c.currencies, ['Exalted Orb']);
  // Wanted mods on the item: a miss is removed blindly and may hit them — denominator p − (1−p)·q.
  const risky = planner().stepCost(add(0.5, { onItem: 1 }));
  near(risky.cost, (0.01 + 0.5 * 0.05) / (0.5 - 0.5 * 0.5), 'cost with risk');
});

test('Greater Exalted is chosen when it cuts off low tiers and the chance is noticeably higher', () => {
  const s = add(0.05);
  s.exalt.greater = { chance: 0.5, guess: 0.5, pool: 4 };
  const c = planner().stepCost(s);
  assert.equal(c.k, 'greater');
});

test('no method converges (a miss removes a wanted mod more often) — the step is hopeless, no price', () => {
  const c = planner().stepCost(add(0.2, { onItem: 5 }));
  assert.ok(c.hopeless);
  assert.equal(c.cost, null);
});

test('the single Desecrate goes to the valuable mod Exalted rarely hits, not just the most valuable one', () => {
  const prices = { ...PRICES, 'Preserved Rib': 0.05, 'Omen of Abyssal Echoes': 0.05, 'Omen of Light': 1 };
  const p = PlanCost.create(() => ({ prices, goalValue: null, est: null }));
  // Odds unknown for both (lottery); rough frequency: the resistance is common, Spirit is rare. Wanted mods already on the
  // item — a random Annulment would hit them, so Exalted is a single attempt; Desecrate (targeted Light removal) converges.
  const step = (mod, worth, rough) => ({ act: 'add', side: 'prefix', mod, worth, onItem: 3, onSide: 1, annulOmen: 'Omen of Sinistral Annulment',
    exalt: { base: { chance: null, guess: 0.1, rough, pool: 10 } }, desecrate: { 'Preserved Rib': { chance: null, guess: 0.1, rough, pool: 12, good: 1 } } });
  const plan = p.withDesecrate([step('# to cold resistance', 60, 0.3), step('# to spirit', 50, 0.05)]);
  const des = plan.find((s) => s.useDes);
  assert.equal(des && des.mod, '# to spirit');
});

test('essence and Desecrate are allocated together: a low-tier essence gives the key mod up to Desecrate', () => {
  const prices = { ...PRICES, 'Preserved Rib': 0.05, 'Omen of Abyssal Echoes': 0.05, 'Omen of Light': 1,
    'Essence A': 0.1, 'Essence B': 0.1, 'Omen of Sinistral Crystallisation': 0.1 };
  const step = (mod, worth, rough, ess, essTier) => ({ act: 'add', side: 'prefix', mod, worth, onItem: 1, onSide: 0, annulOmen: 'Omen of Sinistral Annulment',
    crystal: 'Omen of Sinistral Crystallisation', crafted: [ess], craftedSlots: 1, essTier: { [ess]: { tier: essTier, value: '30' } }, bestTier: 1,
    exalt: { base: { chance: null, guess: 0.1, rough, pool: 10 } }, desecrate: { 'Preserved Rib': { chance: null, guess: 0.1, rough, pool: 12, good: 1 } } });
  const plan = (low) => PlanCost.create(() => ({ prices, goalValue: 40, est: 2 }))
    .withDesecrate([step('# speed', 60, 0.05, 'Essence A', low), step('# life', 30, 0.05, 'Essence B', 1)]);
  // Essence A gives T1: greedy — the essence to the most valuable mod, Desecrate to the other.
  const top = plan(1);
  assert.equal(top.find((s) => s.useCrafted).mod, '# speed');
  // Essence A is four tiers down: Desecrate takes the key mod, the other essence goes to life.
  const low = plan(5);
  assert.equal(low.find((s) => s.useDes).mod, '# speed');
  assert.equal(low.find((s) => s.useCrafted).mod, '# life');
});

test('Chaos replace: with Whittling on the lowest-level unwanted mod it beats Annulment + Exalted; plain Chaos on good mods does not', () => {
  const prices = { ...PRICES, 'Chaos Orb': 0.02, 'Omen of Whittling': 0.05, 'Omen of Sinistral Exaltation': 0.1 };
  const p = PlanCost.create(() => ({ prices, goalValue: 20, est: 2 }));
  const rem = (whittle) => ({ act: 'remove', mods: ['junk'], whittle: whittle ? 'junk' : null, sides: { prefix: { J: 1, K: 2, full: true, omen: 'Omen of Sinistral Annulment' }, suffix: { J: 0, K: 3, full: true, omen: 'Omen of Dextral Annulment' } } });
  const step = { act: 'add', side: 'prefix', mod: 'wanted', worth: 50, onItem: 5, onSide: 2, annulOmen: 'Omen of Sinistral Annulment', exalt: { base: { chance: 0.3, guess: 0.3, pool: 10 } } };
  const plan = p.expandPlan([rem(true), step]);
  assert.deepEqual(plan.map((s) => s.act), ['replace']);
  const c = p.stepCost(plan[0]);
  assert.deepEqual(c.currencies, ['Chaos Orb', 'Omen of Whittling']);
  near(c.chance, 0.3, 'Whittling removes the unwanted mod for sure; the new one is wanted with the Exalted odds');
  // A higher Chaos tier cuts low tiers off: with far better odds at T1–T2 it pays for itself (an expensive base).
  const tiered = PlanCost.create(() => ({ prices: { ...prices, 'Greater Chaos Orb': 0.1, 'Perfect Chaos Orb': 0.5 }, goalValue: 20, est: 2 }));
  const strong = { ...step, exalt: { base: { chance: 0.05, guess: 0.05, pool: 10 }, greater: { chance: 0.3, guess: 0.3, pool: 10 }, perfect: { chance: 0.6, guess: 0.6, pool: 10 } } };
  const g = tiered.stepCost(tiered.expandPlan([rem(true), strong])[0]);
  assert.deepEqual(g.currencies, ['Greater Chaos Orb', 'Omen of Whittling']);
  // Without Whittling Chaos hits one of five good mods most of the time — the plan keeps Annulment, then Exalted.
  assert.deepEqual(p.expandPlan([rem(false), step]).map((s) => s.act), ['remove', 'add']);
});

test('Regal: Greater / Perfect by default only if dirt cheap (≤ 0.1 div or ≤ 3× the regular)', () => {
  const c = planner().stepCost({ act: 'regal' });
  assert.deepEqual(c.currencies, ['Greater Regal Orb']); // 0.02 ≤ 0.1, but Perfect (0.5) is not
  // Jewels (one tier per mod): only the plain Regal Orb, even when Greater is dirt cheap.
  const j = planner().stepCost({ act: 'regal', oneTier: true });
  assert.deepEqual(j.currencies, ['Regal Orb']);
  assert.deepEqual(j.regal, []);
});

test('a pair via Omen of Greater Exaltation expands into two steps if separately cheaper', () => {
  const p = planner();
  const a = add(0.5, { sideOmen: null });
  const b = add(0.5, { sideOmen: null });
  const plan = p.expandPlan([{ act: 'add2', steps: [a, b] }]);
  // The omen (0.5 div) costs more than two extra Exalted — two separate steps.
  assert.deepEqual(plan.map((s) => s.act), ['add', 'add']);
});

test('plan simulation: with the same generator the result repeats; chance 1 — all mods obtained', () => {
  // Simple seeded generator (mulberry32).
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const p = planner({ goalValue: 10, est: 1 });
  const plan = [add(0.3, { worth: 1 }), add(0.6, { worth: 2 })];
  const a = p.simulate(plan, { keep: 1 }, 500, rng(42));
  const b = p.simulate(plan, { keep: 1 }, 500, rng(42));
  assert.deepEqual(a, b);
  assert.ok(a.spent.mean > 0 && a.value.p50 <= 10);
  const sure = p.simulate([add(1, { worth: 1 })], {}, 50, rng(1));
  assert.equal(sure.full, 1);
  near(sure.value.p50, 10, 'goal price');
  // Without a goal price there is nothing to simulate.
  assert.equal(planner().simulate(plan), null);
});

test('two Exalted in a row on one side — paired again with Omen of Greater Exaltation (if cheaper)', () => {
  const step = (mod) => ({ ...add(0.5, { sideOmen: 'Omen of Sinistral Exaltation', otherOpen: true }), side: 'prefix', mod,
    currencies: ['Exalted Orb', 'Omen of Sinistral Exaltation'] });
  const prices = { ...PRICES, 'Omen of Sinistral Exaltation': 0.3 };
  // Omen of Greater Exaltation is cheap — one Exalted for two mods beats two tries.
  const cheap = PlanCost.create(() => ({ prices: { ...prices, 'Omen of Greater Exaltation': 0.01 }, goalValue: null, est: null }));
  assert.deepEqual(cheap.expandPlan([step('A'), step('B')]).map((s) => s.act), ['add2']);
  // Expensive — two separate steps remain.
  const dear = PlanCost.create(() => ({ prices: { ...prices, 'Omen of Greater Exaltation': 50 }, goalValue: null, est: null }));
  assert.deepEqual(dear.expandPlan([step('A'), step('B')]).map((s) => s.act), ['add', 'add']);
});

test('Desecrate on a full side with one unwanted mod — before removals: replaces one side Annulment try', () => {
  const prices = { ...PRICES, 'Gnawed Jawbone': 0.01, 'Omen of Sinistral Necromancy': 0.02, 'Omen of Light': 0.3 };
  const p = PlanCost.create(() => ({ prices, goalValue: null, est: null }));
  const sides = { prefix: { J: 1, K: 2, omen: 'Omen of Sinistral Annulment', full: true, necro: 'Omen of Sinistral Necromancy' } };
  // Exalted barely gives the mod (1%), Desecrate gives 50%: the step goes to Desecrate.
  const des = add(0.01, { side: 'prefix', onSide: 2, onItem: 2, desecrate: { 'Gnawed Jawbone': { chance: 0.5, guess: 0.5, good: 0.5, pool: 10 } } });
  const plan = p.expandPlan([{ act: 'remove', mods: ['junk'], sides }, des]);
  assert.equal(plan[0].act, 'add', 'Desecrate first');
  assert.ok(plan[0].desFirst);
  assert.equal(plan[0].necro, 'Omen of Sinistral Necromancy');
  const before = p.removeCost({ act: 'remove', sides });
  const after = p.stepCost(plan[1]);
  near(after.tries, before.tries - 1, 'one try fewer');
  // Wanted mods are hit the same way: Desecrate removes a random mod of the side, like Annulment.
  near(after.hits, before.hits, 'hits');
  // Two unwanted on the side — left alone (after replacing one the side is no longer full).
  const two = p.expandPlan([{ act: 'remove', mods: ['a', 'b'], sides: { prefix: { ...sides.prefix, J: 2, K: 1 } } }, des]);
  assert.equal(two[0].act, 'remove');
});

test('essence / Alloy: with a key item mod on the side — placed after the side\'s wanted mods (a miss then removes them more often, not the key one)', () => {
  const prices = { ...PRICES, "The Runebinder's Alloy": 1, 'Omen of Dextral Crystallisation': 0.5, 'Omen of Dextral Exaltation': 0.1 };
  const mk = (goalValue) => PlanCost.create(() => ({ prices, goalValue, est: 10 }));
  // Suffixes: key +4 to minions; plan — Exalted on the wanted suffix, then Alloy (crafted slot).
  const regen = add(0.3, { side: 'suffix', mod: 'regen', onSide: 1, onItem: 1 });
  const alloy = { act: 'add', side: 'suffix', mod: 'puppet', onSide: 2, onItem: 2, craftedOnly: "The Runebinder's Alloy", crafted: ["The Runebinder's Alloy"],
    crystal: 'Omen of Dextral Crystallisation', atRisk: ['+4 to Level of all Minion Skills'], exalt: { base: { chance: null } } };
  const order = (goal) => mk(goal).expandPlan([regen, alloy]).map((s) => s.mod);
  // Expensive goal: losing +4 is costly — Alloy after regen (removes +4 with chance 1 in 3, not 1 in 2).
  assert.deepEqual(order(900), ['regen', 'puppet']);
  const p = mk(900);
  near(p.stepCost({ ...alloy }).chance, 1 / 3, 'after regen: the victim is removed 1 in 3');
});

test('Desecrate: options in a triple don\'t repeat, an Abyssal Echoes reroll gives a new triple', () => {
  const prices = { ...PRICES, 'Gnawed Jawbone': 0.01, 'Omen of Abyssal Echoes': 0.01, 'Omen of Light': 0.3 };
  const p = PlanCost.create(() => ({ prices, goalValue: null, est: null }));
  const step = add(0.001, { desecrateOnly: true, useDes: true, desecrate: { 'Gnawed Jawbone': { chance: 0.05, guess: 0.05, good: 1, pool: 20 } } });
  const c = p.addCost(step, 1);
  // 1 matching out of 20 equally likely: a triple is 3/20 (with repeats it would be 1 − 0.95³ ≈ 0.143), two triples — 1 − (17/20)².
  near(c.chance, c.echo ? 1 - 0.85 * 0.85 : 0.15, `chance (echo: ${c.echo})`);
});
