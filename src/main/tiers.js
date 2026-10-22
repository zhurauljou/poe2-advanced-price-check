// Tier weights of a mod family and the tiers a craft aims for (src/main/craft.js).
// Weights come from the exalt samples (data/exalt-weights.json `tiers`: family → { mod level: weight }) — top tiers of
// damage, crit, speed, Spirit and skill levels roll far rarer than low ones; a family without a profile counts its tiers
// as equal.

// A tier is the goal when its top value is at least this share of the best tier the item level allows: +4 minion levels
// (not +3 — 75%), life 200–214 / 190–199 / 175–189 (T1–T3).
const TARGET = 0.85;

// level → weight of a family's tier (1 without a profile).
const weigher = (profile) => (level) => (profile && profile[level] != null ? profile[level] : 1);
const sumW = (w, levels) => levels.reduce((s, l) => s + w(l), 0);

// ladder — [{ level, hi }] best first (src/main/craft.js candidates). → levels of the goal tiers among those the item
// level allows; without values — the two best.
function targetLevels(ladder, ilvl) {
  const av = (ladder || []).filter((r) => r.level <= ilvl);
  if (!av.length) return [];
  if (av.some((r) => r.hi == null)) return av.slice(0, 2).map((r) => r.level);
  const best = Math.max(...av.map((r) => Math.abs(r.hi)));
  return av.filter((r) => Math.abs(r.hi) >= best * TARGET).map((r) => r.level);
}

// "T1", "T1–T3" — tier numbers of the goal levels on the ladder (T1 = the ladder's best, even above the item level).
function targetLabel(ladder, levels) {
  const idx = (ladder || []).map((r, i) => (levels.includes(r.level) ? i + 1 : 0)).filter(Boolean);
  if (!idx.length) return null;
  return idx.length === 1 ? `T${idx[0]}` : `T${idx[0]}–T${idx[idx.length - 1]}`;
}

module.exports = { TARGET, weigher, sumW, targetLevels, targetLabel };
