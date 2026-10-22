// Mod family weights from items with every mod slot filled the same way (exalted to 6 mods): each item holds a family
// once, so frequent families hit that ceiling and their raw share understates their weight. The weights are fitted to the
// model «draw p prefixes and s suffixes without repeating a family» (the inclusion chance of a family ≈ 1 − e^(−λw),
// λ makes the chances add up to the number of mods), per side. Used by scripts/build-exalt-weights.js and the dashboard.

// λ with Σ (1 − e^(−λw)) = k.
function lambdaFor(ws, k) {
  if (k >= ws.length) return Infinity;
  const f = (l) => ws.reduce((a, w) => a + 1 - Math.exp(-l * w), 0);
  let lo = 0, hi = 1;
  while (f(hi) < k) hi *= 2;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) < k) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// rows — [[family, …], …] (one item each); fams — the families to weigh; sideOf(family) → 'prefix' | 'suffix' | null.
// → { share: family → share of its side's weight, obs: family → times seen, mods: side → mods seen }
function fitWeights(rows, fams, sideOf) {
  const obs = {}, groups = { prefix: {}, suffix: {} }, mods = { prefix: 0, suffix: 0 };
  for (const r of rows) {
    const n = { prefix: 0, suffix: 0 };
    for (const t of r) { const s = sideOf(t); if (!s) continue; n[s]++; mods[s]++; obs[t] = (obs[t] || 0) + 1; }
    for (const s of ['prefix', 'suffix']) if (n[s]) groups[s][n[s]] = (groups[s][n[s]] || 0) + 1;
  }
  const w = Object.fromEntries(fams.map((t) => [t, obs[t] || 0.5]));
  for (let it = 0; it < 300; it++) {
    const exp = {};
    for (const s of ['prefix', 'suffix']) {
      const fs_ = fams.filter((t) => sideOf(t) === s);
      const ws = fs_.map((t) => w[t]);
      for (const [k, n] of Object.entries(groups[s])) {
        const l = lambdaFor(ws, +k);
        fs_.forEach((t, i) => { exp[t] = (exp[t] || 0) + n * (l === Infinity ? 1 : 1 - Math.exp(-l * ws[i])); });
      }
    }
    for (const t of fams) if (exp[t] > 0) w[t] *= Math.max(obs[t] || 0, 1e-3) / exp[t];
  }
  const share = {};
  for (const s of ['prefix', 'suffix']) {
    const fs_ = fams.filter((t) => sideOf(t) === s);
    const sum = fs_.reduce((a, t) => a + w[t], 0) || 1;
    for (const t of fs_) share[t] = w[t] / sum;
  }
  return { share, obs, mods };
}

// Weights of a family's tiers, keyed by the tier's mod level (ladders differ between bases, levels do not).
// obs — [{ level: the rolled tier's level, avail: levels of the tiers the item level allowed }, …]. The chance of a tier
// on an item is w ÷ Σ w over its avail; fitted by iterative scaling with a prior of half an observation per tier in
// proportion to how often it could roll (a tier few items could get is not blown up), and a higher tier never weighs
// more than a lower one (every Craft of Exile profile checked is flat or falls towards T1): pool-adjacent-violators over
// the levels, weighted by exposure. → { level: weight } with mean 1, or null with fewer than minObs observations.
function fitLevelWeights(obs, minObs = 15) {
  if (obs.length < minObs) return null;
  const levels = [...new Set(obs.flatMap((o) => o.avail))].sort((a, b) => b - a); // best (highest level) first
  if (levels.length < 2) return null;
  const cnt = {};
  for (const o of obs) cnt[o.level] = (cnt[o.level] || 0) + 1;
  // Observations grouped by what their item level allowed: a handful of groups instead of every item.
  const groups = new Map();
  for (const o of obs) { const k = o.avail.join(','); const g = groups.get(k) || groups.set(k, { avail: o.avail, n: 0 }).get(k); g.n++; }
  const w = Object.fromEntries(levels.map((l) => [l, 1]));
  for (let it = 0; it < 200; it++) {
    const den = {};
    for (const { avail, n } of groups.values()) { const sum = avail.reduce((s, l) => s + w[l], 0); for (const l of avail) den[l] = (den[l] || 0) + n / sum; }
    const dMean = Object.values(den).reduce((a, b) => a + b, 0) / (Object.keys(den).length || 1);
    for (const l of levels) if (den[l]) w[l] = ((cnt[l] || 0) + 0.5 * den[l] / dMean) / den[l];
    const blocks = [];
    for (const l of levels) {
      if (!den[l]) continue;
      blocks.push({ levels: [l], v: w[l], d: den[l] });
      while (blocks.length > 1 && blocks[blocks.length - 2].v > blocks[blocks.length - 1].v) {
        const b = blocks.pop(), a = blocks.pop();
        blocks.push({ levels: [...a.levels, ...b.levels], v: (a.v * a.d + b.v * b.d) / (a.d + b.d), d: a.d + b.d });
      }
    }
    for (const b of blocks) for (const l of b.levels) w[l] = b.v;
  }
  const mean = levels.reduce((s, l) => s + w[l], 0) / levels.length;
  return Object.fromEntries(levels.map((l) => [l, w[l] / mean]));
}

module.exports = { fitWeights, fitLevelWeights };
