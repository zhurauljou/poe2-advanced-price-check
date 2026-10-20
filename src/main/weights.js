// Mod importance for price — a number 0…3: "how valuable the mod is in this slot" × "how good its tier is".
//   base: key for the slot 3, regular 2, low-value 0.5;
//   tier: T1 ×1 … T7+ ×0.15 (tier unknown — simple copy format or unique — ×0.8).
// Importance decides the default checkboxes and the order in which auto-relaxation removes filters.
// Templates are trade stat texts (# instead of numbers).

const { MARTIAL_WEAPONS } = require('../shared/item-classes');
const WEAPONS = new Set(MARTIAL_WEAPONS);
const CASTER = new Set(['Wands', 'Staves', 'Sceptres', 'Foci']);

const ANY_KEY = [/^# to Level of all .*Skills$/, /^# to Spirit$/];

const CRIT = [/^#% (increased|to) Critical Hit Chance/, /^#% (increased|to) Critical Damage Bonus/];
const SPELL = [/^#% increased Spell Damage$/, /^#% increased Cast Speed$/, /^#% increased Critical Hit Chance for Spells$/,
  /^#% increased (Elemental|Fire|Cold|Lightning|Chaos) Damage$/];

const SLOT_KEY = {
  Boots: [/^#% increased Movement Speed$/],
  Rings: [/^#% increased Rarity of Items found$/, /^Adds # to # \w+ Damage to Attacks$/],
  Amulets: [/^#% increased Rarity of Items found$/, ...CRIT],
  Gloves: [/^#% increased Attack Speed$/, /^Adds # to # \w+ Damage to Attacks$/, ...CRIT],
  Helmets: [/^#% increased Rarity of Items found$/],
  Quivers: [/^#% increased Attack Speed$/, /^#% increased Projectile Speed$/, ...CRIT],
  Shields: [/Block chance/],
  Bucklers: [/Block chance/],
};

const WEAK = /Attribute Requirements|Light Radius|Stun Threshold|Thorns|Mana Regeneration Rate|^# to Accuracy Rating$|Flask Charges|Charm Charges|Duration on you$/;

const TIER_FACTOR = [1, 1, 0.85, 0.7, 0.5, 0.35, 0.25]; // index is the tier number; T7 and worse — 0.15
const UNKNOWN_TIER = 0.8;

// Importance from which a mod is enabled by default and which auto-relaxation no longer removes.
const ENABLE_FROM = 1.2;
const KEEP_FROM = 2;

function slotKey(itemClass) {
  if (WEAPONS.has(itemClass)) return CRIT;
  if (CASTER.has(itemClass)) return [...SPELL, ...CRIT];
  return SLOT_KEY[itemClass] || [];
}

function tierFactor(tier) {
  if (tier == null) return UNKNOWN_TIER;
  return tier < TIER_FACTOR.length ? TIER_FACTOR[tier] : 0.15;
}

// Demand (poe.ninja): what share of builds wear this mod on items of this class. A widespread mod matters for price
// even at a weak tier — raise the base and soften the tier penalty.
const DEMAND_KEY = 60; // % — the mod counts "as key"
const DEMAND_HIGH = 30;

// → { importance: 0…3, key: whether the mod is key for the slot (ignoring tier) }
function weight(itemClass, template, tier, demandPct) {
  if (!template) return { importance: 0, key: false };
  const t = template.replace(/ \(Local\)$/, '');
  let key = ANY_KEY.some((re) => re.test(t)) || slotKey(itemClass).some((re) => re.test(t));
  let base = key ? 3 : WEAK.test(t) ? 0.5 : 2;
  let factor = tierFactor(tier);
  if (demandPct >= DEMAND_KEY) {
    key = true;
    base = 3;
    factor = Math.max(factor, 0.6);
  } else if (demandPct >= DEMAND_HIGH && !WEAK.test(t)) {
    // Low-value ones (Stun Threshold on boots — 33%) often come "along for the ride", nobody pays for them — only DEMAND_KEY raises them.
    base = Math.max(base, 2.5);
    factor = Math.max(factor, 0.5);
  } else if (demandPct != null && !key) {
    // Demand is known and low (life on boots — 26% of builds vs 50% for resistances): not enabled by default.
    base = Math.min(base, 1);
  }
  return { importance: Math.round(base * factor * 100) / 100, key };
}

// For RePoE templates (crafting): case-insensitive.
const ci = (re) => new RegExp(re.source, 'i');
const isKey = (itemClass, template) => [...ANY_KEY, ...slotKey(itemClass)].some((re) => ci(re).test(template));
const isWeak = (template) => ci(WEAK).test(template);

// Item theme (archetype) for the demand behind the craft advice: the mods that say which builds wear such an item.
// Key mods first (skill levels, Spirit…), then local defences (ES / armour / evasion — they decide caster vs attacker,
// even when the price search folds them into the defence property), then the rest by importance. Attributes say little
// (Dexterity on ES gloves is not an archer's sign) and are skipped. → up to n mod texts (first lines).
const DEFENCE = /(increased (Energy Shield|Armour|Evasion Rating)|to maximum Energy Shield|to Armour|to Evasion Rating)/i;
const ATTRIBUTE = /to (Strength|Dexterity|Intelligence|all Attributes)\b/i;
function themeMods(mods, itemClass, n = 2) {
  const rank = (m) => (isKey(itemClass, m.template || m.text) ? 2 : 0) + (DEFENCE.test(m.text) ? 1 : 0);
  return mods.filter((m) => m.statId && !['pseudo', 'implicit', 'rune', 'enchant'].includes(m.tag) && !m.option && !ATTRIBUTE.test(m.text))
    .sort((a, b) => rank(b) - rank(a) || (b.importance || 0) - (a.importance || 0)).slice(0, n).map((m) => m.text.split('\n')[0]);
}

module.exports = { weight, tierFactor, ENABLE_FROM, KEEP_FROM, isKey, isWeak, themeMods };
