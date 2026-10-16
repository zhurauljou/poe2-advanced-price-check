// Важность мода для цены — число 0…3: «насколько мод ценен в этом слоте» × «насколько хорош его тир».
//   основа: ключевой для слота 3, обычный 2, малоценный 0.5;
//   тир: T1 ×1 … T7+ ×0.15 (тир неизвестен — простой формат копирования или уник — ×0.8).
// По важности выбираются галочки по умолчанию и порядок снятия фильтров при автоослаблении.
// Шаблоны — тексты статов трейда (# вместо чисел).

const WEAPONS = new Set([
  'One Hand Maces', 'Two Hand Maces', 'Quarterstaves', 'Bows', 'Crossbows', 'Spears', 'Flails', 'Claws', 'Daggers',
  'One Hand Swords', 'Two Hand Swords', 'One Hand Axes', 'Two Hand Axes', 'Talismans',
]);
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

const TIER_FACTOR = [1, 1, 0.85, 0.7, 0.5, 0.35, 0.25]; // индекс — номер тира; T7 и хуже — 0.15
const UNKNOWN_TIER = 0.8;

// С какой важности мод включаем по умолчанию и какую автоослабление уже не снимает.
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

// Спрос (poe.ninja): какая доля билдов носит этот мод на вещах этого класса. Массовый мод важен для цены
// даже слабого тира — поднимаем основу и смягчаем штраф за тир.
const DEMAND_KEY = 60; // % — мод «как ключевой»
const DEMAND_HIGH = 30;

// → { importance: 0…3, key: ключевой ли мод для слота (без учёта тира) }
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
  } else if (demandPct >= DEMAND_HIGH) {
    base = Math.max(base, 2.5);
    factor = Math.max(factor, 0.5);
  }
  return { importance: Math.round(base * factor * 100) / 100, key };
}

module.exports = { weight, ENABLE_FROM, KEEP_FROM };
