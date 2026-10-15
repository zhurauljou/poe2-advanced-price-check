// Насколько мод важен для цены в зависимости от слота.
//   key  — двигает цену сильнее всего: включаем всегда, автоослабление его не снимает;
//   weak — почти не влияет: по умолчанию не ищем;
//   null — обычный мод.
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

function slotKey(itemClass) {
  if (WEAPONS.has(itemClass)) return CRIT;
  if (CASTER.has(itemClass)) return [...SPELL, ...CRIT];
  return SLOT_KEY[itemClass] || [];
}

// Низкий тир (T4 и хуже) у обычного мода — по умолчанию не ищем: такой мод цену почти не держит.
const WEAK_TIER = 4;

function weight(itemClass, template, tier) {
  if (!template) return null;
  const t = template.replace(/ \(Local\)$/, '');
  const lowTier = tier != null && tier >= WEAK_TIER;
  // Ключевой мод слабого тира (6% редкости T7) цену не делает — считаем обычным.
  if (ANY_KEY.some((re) => re.test(t)) || slotKey(itemClass).some((re) => re.test(t))) return lowTier ? null : 'key';
  if (WEAK.test(t)) return 'weak';
  return lowTier ? 'weak' : null;
}

module.exports = { weight };
