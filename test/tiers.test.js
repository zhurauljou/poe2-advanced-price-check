// Tier weights and goal tiers: the fitting (scripts/exalt-fit.js) recovers known weights from synthetic samples, the goal
// tiers (src/main/tiers.js) follow the ladder values, the committed weights keep their invariants, and the craft odds use
// them (a +4 minion level is a T1-only goal, rarer than equal tiers would say).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { fitWeights, fitLevelWeights } = require('../scripts/exalt-fit');
const { targetLevels, targetLabel, weigher, sumW } = require('../src/main/tiers');

// Small deterministic PRNG: the tests must not depend on luck.
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const pick = (r, items, weight) => { let x = r() * items.reduce((a, it) => a + weight(it), 0); for (const it of items) { x -= weight(it); if (x <= 0) return it; } return items[items.length - 1]; };

test('tier weights: a falling profile (physical %) and a flat one are recovered from rolls at mixed item levels', () => {
  const r = rng(7);
  const levels = [82, 75, 60, 46, 33, 16, 8, 1];
  for (const truth of [[25, 50, 100, 200, 400, 1000, 1000, 1000], [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]]) {
    const W = Object.fromEntries(levels.map((l, i) => [l, truth[i]]));
    const obs = [];
    for (let i = 0; i < 6000; i++) {
      const ilvl = 65 + Math.floor(r() * 20); // 65–84: the top tiers are not always allowed
      const avail = levels.filter((l) => l <= ilvl);
      obs.push({ level: pick(r, avail, (l) => W[l]), avail });
    }
    const w = fitLevelWeights(obs);
    const share = (o, l) => o[l] / levels.reduce((s, x) => s + o[x], 0);
    for (const l of levels) {
      const want = share(W, l), got = share(w, l);
      assert.ok(Math.abs(got - want) <= Math.max(0.01, want * 0.35), `level ${l}: ${got.toFixed(4)} vs ${want.toFixed(4)}`);
    }
    for (let i = 1; i < levels.length; i++) assert.ok(w[levels[i - 1]] <= w[levels[i]] + 1e-9, 'a higher tier never outweighs a lower one');
  }
});

test('tier weights: too few observations — no profile (equal tiers then)', () => {
  assert.equal(fitLevelWeights([{ level: 1, avail: [10, 1] }]), null);
});

test('family weights: six-mod items (3 + 3, one per family) recover the weights despite the ceiling', () => {
  const r = rng(11);
  const fams = { A: ['prefix', 13], B: ['prefix', 11], C: ['prefix', 8], D: ['prefix', 3], E: ['suffix', 11], F: ['suffix', 8], G: ['suffix', 8], H: ['suffix', 1.5] };
  const sideOf = (t) => fams[t][0];
  const rows = [];
  for (let i = 0; i < 4000; i++) {
    const row = [];
    for (const side of ['prefix', 'suffix']) {
      const left = Object.keys(fams).filter((t) => sideOf(t) === side);
      for (let k = 0; k < 3; k++) { const t = pick(r, left, (x) => fams[x][1]); row.push(t); left.splice(left.indexOf(t), 1); }
    }
    rows.push(row);
  }
  const { share } = fitWeights(rows, Object.keys(fams), sideOf);
  for (const side of ['prefix', 'suffix']) {
    const list = Object.keys(fams).filter((t) => sideOf(t) === side);
    const sum = list.reduce((a, t) => a + fams[t][1], 0);
    for (const t of list) assert.ok(Math.abs(share[t] - fams[t][1] / sum) < 0.03, `${t}: ${share[t].toFixed(3)} vs ${(fams[t][1] / sum).toFixed(3)}`);
  }
});

test('goal tiers: +4 minion levels only, life down to 85% of the best roll, two best without values', () => {
  const minion = [{ level: 78, hi: 4 }, { level: 55, hi: 3 }, { level: 25, hi: 2 }, { level: 2, hi: 1 }];
  assert.deepEqual(targetLevels(minion, 79), [78]);
  assert.equal(targetLabel(minion, [78]), 'T1');
  assert.deepEqual(targetLevels(minion, 70), [55], 'T1 above the item level — the best allowed is the goal');
  const life = [{ level: 80, hi: 214 }, { level: 75, hi: 199 }, { level: 70, hi: 189 }, { level: 65, hi: 174 }];
  assert.deepEqual(targetLevels(life, 82), [80, 75, 70]);
  assert.equal(targetLabel(life, [80, 75, 70]), 'T1–T3');
  assert.deepEqual(targetLevels([{ level: 60 }, { level: 40 }, { level: 20 }], 82), [60, 40]);
  const w = weigher({ 78: 0.24, 55: 0.24, 25: 1.2, 2: 2.32 });
  assert.ok(Math.abs(sumW(w, [78]) / sumW(w, [78, 55, 25, 2]) - 0.06) < 0.001);
  assert.equal(weigher(null)(10), 1, 'no profile — equal tiers');
});

test('committed tier profiles: positive, never heavier towards the top tier, mean 1', () => {
  const tiers = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'exalt-weights.json'), 'utf8')).tiers || {};
  assert.ok(Object.keys(tiers).length > 50, 'profiles exist');
  for (const [type, p] of Object.entries(tiers)) {
    const levels = Object.keys(p).map(Number).sort((a, b) => b - a);
    for (const l of levels) assert.ok(p[l] > 0, `${type} ${l}`);
    for (let i = 1; i < levels.length; i++) assert.ok(p[levels[i - 1]] <= p[levels[i]] + 1e-3, `${type}: level ${levels[i - 1]} outweighs ${levels[i]}`);
    const mean = levels.reduce((s, l) => s + p[l], 0) / levels.length;
    assert.ok(Math.abs(mean - 1) < 0.01, `${type} mean ${mean}`);
  }
});
