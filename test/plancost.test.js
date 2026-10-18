// Модель стоимости плана крафта (src/shared/plancost.js) на синтетических шагах и ценах — без данных игры.
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
// Шаг «добавить мод»: шанс попасть в нужное семейство у обычного / Greater / Perfect Exalted.
const add = (chance, extra = {}) => ({ act: 'add', mod: 'X', onItem: 0, onSide: 0,
  exalt: { base: { chance, guess: chance, pool: 10 }, greater: { chance, guess: chance, pool: 10 }, perfect: { chance, guess: chance, pool: 10 } }, ...extra });

test('снятие лишнего Annulment: ожидаемо Σ (j+K)/j попыток, из них Σ K/j заденут нужный мод', () => {
  const p = planner();
  // Один лишний, нужных нет — ровно одна сфера.
  const one = p.removeCost({ act: 'remove', sides: { prefix: { J: 1, K: 0 } } });
  near(one.tries, 1, 'tries');
  near(one.cost, PRICES['Orb of Annulment'], 'cost');
  assert.equal(one.risky, false);
  // Два лишних и один нужный: 3/2 + 2/1 = 3.5 попытки, 1/2 + 1/1 = 1.5 задетых.
  const two = p.removeCost({ act: 'remove', sides: { prefix: { J: 2, K: 1 } } });
  near(two.tries, 3.5, 'tries');
  near(two.hits, 1.5, 'hits');
  assert.ok(two.risky);
  // Задетый нужный мод стоит его возврата: при цене цели — четверть её.
  const withGoal = planner({ goalValue: 40 }).removeCost({ act: 'remove', sides: { prefix: { J: 2, K: 1 } } });
  near(withGoal.cost, 3.5 * 0.05 + 1.5 * 10, 'cost с ценой цели');
});

test('с оменом стороны снимаем только среди модов стороны — дешевле, когда нужные моды на другой стороне', () => {
  const p = planner();
  const r = p.removeCost({ act: 'remove', sides: { prefix: { J: 1, K: 0, omen: 'Omen of Sinistral Annulment' }, suffix: { J: 0, K: 3, omen: 'Omen of Dextral Annulment' } } });
  assert.deepEqual(r.currencies, ['Orb of Annulment', 'Omen of Sinistral Annulment']);
  near(r.hits, 0, 'с оменом ничего нужного не задеваем');
});

test('добавить мод Exalted\'ом до победы: (цена попытки + (1−p)·снятие) / p, выбран самый дешёвый тир сферы', () => {
  const c = planner().stepCost(add(0.5));
  assert.equal(c.k, 'base'); // у всех тиров шанс одинаковый — обычный дешевле
  near(c.cost, (0.01 + 0.5 * 0.05) / 0.5, 'cost');
  assert.deepEqual(c.currencies, ['Exalted Orb']);
  // Нужные моды на вещи: промах снимается вслепую и может задеть их — знаменатель p − (1−p)·q.
  const risky = planner().stepCost(add(0.5, { onItem: 1 }));
  near(risky.cost, (0.01 + 0.5 * 0.05) / (0.5 - 0.5 * 0.5), 'cost с риском');
});

test('Greater Exalted выбирается, когда отсекает низкие тиры и шанс заметно выше', () => {
  const s = add(0.05);
  s.exalt.greater = { chance: 0.5, guess: 0.5, pool: 4 };
  const c = planner().stepCost(s);
  assert.equal(c.k, 'greater');
});

test('ни один способ не сходится (промах чаще снимает нужный мод) — шаг безнадёжен, цены нет', () => {
  const c = planner().stepCost(add(0.2, { onItem: 5 }));
  assert.ok(c.hopeless);
  assert.equal(c.cost, null);
});

test('Regal: Greater / Perfect по умолчанию, только если стоят копейки (≤ 0.1 div или ≤ 3× обычного)', () => {
  const c = planner().stepCost({ act: 'regal' });
  assert.deepEqual(c.currencies, ['Greater Regal Orb']); // 0.02 ≤ 0.1, а Perfect (0.5) уже нет
});

test('пара через Omen of Greater Exaltation разворачивается в два шага, если по отдельности дешевле', () => {
  const p = planner();
  const a = add(0.5, { sideOmen: null });
  const b = add(0.5, { sideOmen: null });
  const plan = p.expandPlan([{ act: 'add2', steps: [a, b] }]);
  // Омен (0.5 div) дороже двух лишних Exalted — два отдельных шага.
  assert.deepEqual(plan.map((s) => s.act), ['add', 'add']);
});

test('симуляция плана: с одним генератором результат повторяется; шанс 1 — все моды получены', () => {
  // Простой генератор с зерном (mulberry32).
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const p = planner({ goalValue: 10, est: 1 });
  const plan = [add(0.3, { worth: 1 }), add(0.6, { worth: 2 })];
  const a = p.simulate(plan, { keep: 1 }, 500, rng(42));
  const b = p.simulate(plan, { keep: 1 }, 500, rng(42));
  assert.deepEqual(a, b);
  assert.ok(a.spent.mean > 0 && a.value.p50 <= 10);
  const sure = p.simulate([add(1, { worth: 1 })], {}, 50, rng(1));
  assert.equal(sure.full, 1);
  near(sure.value.p50, 10, 'цена цели');
  // Без цены цели симулировать нечего.
  assert.equal(planner().simulate(plan), null);
});

test('два Exalted подряд на одну сторону — снова в пару с Omen of Greater Exaltation (если так дешевле)', () => {
  const step = (mod) => ({ ...add(0.5, { sideOmen: 'Omen of Sinistral Exaltation', otherOpen: true }), side: 'prefix', mod,
    currencies: ['Exalted Orb', 'Omen of Sinistral Exaltation'] });
  const prices = { ...PRICES, 'Omen of Sinistral Exaltation': 0.3 };
  // Омен Greater Exaltation дёшев — один Exalted на два мода выгоднее двух попыток.
  const cheap = PlanCost.create(() => ({ prices: { ...prices, 'Omen of Greater Exaltation': 0.01 }, goalValue: null, est: null }));
  assert.deepEqual(cheap.expandPlan([step('A'), step('B')]).map((s) => s.act), ['add2']);
  // Дорогой — остаются два отдельных шага.
  const dear = PlanCost.create(() => ({ prices: { ...prices, 'Omen of Greater Exaltation': 50 }, goalValue: null, est: null }));
  assert.deepEqual(dear.expandPlan([step('A'), step('B')]).map((s) => s.act), ['add', 'add']);
});

test('Desecrate на полную сторону с одним лишним модом — до снятий: заменяет одну попытку Annulment стороны', () => {
  const prices = { ...PRICES, 'Gnawed Jawbone': 0.01, 'Omen of Sinistral Necromancy': 0.02, 'Omen of Light': 0.3 };
  const p = PlanCost.create(() => ({ prices, goalValue: null, est: null }));
  const sides = { prefix: { J: 1, K: 2, omen: 'Omen of Sinistral Annulment', full: true, necro: 'Omen of Sinistral Necromancy' } };
  // Exalted мода почти не даёт (1%), Desecrate — 50%: шаг уйдёт в Desecrate.
  const des = add(0.01, { side: 'prefix', onSide: 2, onItem: 2, desecrate: { 'Gnawed Jawbone': { chance: 0.5, guess: 0.5, good: 0.5, pool: 10 } } });
  const plan = p.expandPlan([{ act: 'remove', mods: ['junk'], sides }, des]);
  assert.equal(plan[0].act, 'add', 'Desecrate — первым');
  assert.ok(plan[0].desFirst);
  assert.equal(plan[0].necro, 'Omen of Sinistral Necromancy');
  const before = p.removeCost({ act: 'remove', sides });
  const after = p.stepCost(plan[1]);
  near(after.tries, before.tries - 1, 'на одну попытку меньше');
  // Нужные моды задеваются так же: Desecrate снимает случайный мод стороны, как Annulment.
  near(after.hits, before.hits, 'hits');
  // Два лишних на стороне — не трогаем (после замены одного сторона уже не полная).
  const two = p.expandPlan([{ act: 'remove', mods: ['a', 'b'], sides: { prefix: { ...sides.prefix, J: 2, K: 1 } } }, des]);
  assert.equal(two[0].act, 'remove');
});
