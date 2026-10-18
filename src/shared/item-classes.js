// Классы предметов — как в строке «Item Class:» игры. Одно место для списков, которые раньше повторялись в модулях
// (поиск, крафт, веса модов, справочник статов).

// Оружие ближнего / дальнего боя и талисманы (аугменты «martial weapon», ключевые моды «оружия»).
const MARTIAL_WEAPONS = ['One Hand Maces', 'Two Hand Maces', 'Quarterstaves', 'Bows', 'Crossbows', 'Spears', 'Flails', 'Claws',
  'Daggers', 'One Hand Swords', 'Two Hand Swords', 'One Hand Axes', 'Two Hand Axes', 'Talismans'];
// Оружие заклинателя (аугменты «caster weapon»). Скипетры — отдельно: у них свои правила.
const CASTER_WEAPONS = ['Wands', 'Staves'];
// Броня (аугменты «armour»).
const ARMOUR = ['Body Armours', 'Helmets', 'Gloves', 'Boots', 'Shields', 'Bucklers', 'Foci'];
// Руны Альдура (смена стихии модов) вставляются в любое оружие, кроме скипетров.
const ALDUR_WEAPONS = [...MARTIAL_WEAPONS, ...CASTER_WEAPONS];
// Классы, у которых часть модов локальная («(Local)» на трейде): броня, оружие, скипетры, ловушки.
const LOCAL_CLASSES = [...ARMOUR, ...MARTIAL_WEAPONS, ...CASTER_WEAPONS, 'Sceptres', 'Traps'];

module.exports = { MARTIAL_WEAPONS, CASTER_WEAPONS, ARMOUR, ALDUR_WEAPONS, LOCAL_CLASSES };
