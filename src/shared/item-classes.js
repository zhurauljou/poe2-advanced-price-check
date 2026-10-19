// Item classes — as in the game's "Item Class:" line. One place for lists that used to be repeated across modules
// (search, craft, mod weights, stat reference).

// Melee / ranged weapons and talismans ("martial weapon" augments, key "weapon" mods).
const MARTIAL_WEAPONS = ['One Hand Maces', 'Two Hand Maces', 'Quarterstaves', 'Bows', 'Crossbows', 'Spears', 'Flails', 'Claws',
  'Daggers', 'One Hand Swords', 'Two Hand Swords', 'One Hand Axes', 'Two Hand Axes', 'Talismans'];
// Caster weapons ("caster weapon" augments). Sceptres are separate: they have their own rules.
const CASTER_WEAPONS = ['Wands', 'Staves'];
// Armour ("armour" augments).
const ARMOUR = ['Body Armours', 'Helmets', 'Gloves', 'Boots', 'Shields', 'Bucklers', 'Foci'];
// Aldur runes (change the element of mods) socket into any weapon except sceptres.
const ALDUR_WEAPONS = [...MARTIAL_WEAPONS, ...CASTER_WEAPONS];
// Classes where some mods are local ("(Local)" on trade): armour, weapons, sceptres, traps.
const LOCAL_CLASSES = [...ARMOUR, ...MARTIAL_WEAPONS, ...CASTER_WEAPONS, 'Sceptres', 'Traps'];

module.exports = { MARTIAL_WEAPONS, CASTER_WEAPONS, ARMOUR, ALDUR_WEAPONS, LOCAL_CLASSES };
