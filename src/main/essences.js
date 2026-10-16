// Эссенции PoE 2 (данные poe2db.tw/us/Essence): какой мод дают и на каких классах вещей.
// Lesser / обычная / Greater — магическая вещь → редкая + гарантированный мод (тир эссенции — диапазон).
// Perfect — на редкой: убирает случайный мод и добавляет СВОЙ мод (другой, у каждого слота свой).

const BODY = 'Body Armours', HELM = 'Helmets', GLOVES = 'Gloves', BOOTS = 'Boots', BELT = 'Belts', RING = 'Rings', AMULET = 'Amulets';
const SHIELD = ['Shields', 'Bucklers'];
const ARMOUR = [BODY, HELM, GLOVES, BOOTS, ...SHIELD];
const JEWELLERY = [RING, AMULET];
const MELEE_1H = ['One Hand Maces', 'One Hand Swords', 'One Hand Axes', 'Claws', 'Daggers', 'Spears', 'Flails'];
const MELEE_2H = ['Two Hand Maces', 'Two Hand Swords', 'Two Hand Axes', 'Quarterstaves', 'Talismans'];
const DMG_1H = [...MELEE_1H, 'Bows'];
const DMG_2H = [...MELEE_2H, 'Crossbows'];
const MARTIAL = [...DMG_1H, ...DMG_2H];
const CASTER = ['Foci', 'Wands'];
const STAFF = ['Staves'];

// tiers: [[классы, Lesser, обычная, Greater]] — диапазон null, если этот тир на классе не встаёт.
// perfect: [[классы, мод]].
const ESSENCES = [
  { name: 'the Body', re: /^# to maximum life$/, tiers: [
    [[BODY, HELM, ...SHIELD, BELT], '30–39', '85–99', '100–119'], [[GLOVES, BOOTS], '30–39', '70–84', '85–99'],
    [[AMULET], '20–29', '70–84', '85–99'], [[RING], '20–29', '70–84', null]],
  perfect: [[[BODY], '(8–10)% increased maximum Life']] },
  { name: 'the Mind', re: /^# to maximum mana$/, tiers: [
    [[BELT, BOOTS, GLOVES, HELM], '25–34', '65–79', '80–89'], [JEWELLERY, '25–34', '80–89', '90–104']],
  perfect: [[[RING], '(4–6)% increased maximum Mana']] },
  { name: 'Enhancement', re: /^#% increased (armour|evasion rating|energy shield)/, tiers: [[ARMOUR, '27–42', '56–67', '68–79']],
    perfect: [[[AMULET], '(20–30)% increased Global Armour, Evasion and Energy Shield']] },
  { name: 'Ruin', re: /^#% to chaos resistance$/, tiers: [[[...ARMOUR, BELT, ...JEWELLERY], '4–7', '8–11', '16–19']],
    perfect: [[[BODY], '(10–15)% of Physical Damage from Hits taken as Chaos Damage']] },
  { name: 'the Infinite', re: /^# to (strength|dexterity|intelligence)$/, tiers: [[[...ARMOUR, BELT, ...JEWELLERY, ...MARTIAL, ...CASTER, ...STAFF], '9–12', '17–20', '25–27']],
    perfect: [[[AMULET], '(7–10)% increased Strength, Dexterity or Intelligence']] },
  { name: 'Opulence', re: /^#% increased rarity of items found$/, tiers: [[[BOOTS, GLOVES, HELM, ...JEWELLERY], '6–10', '11–14', '15–18']],
    perfect: [[[GLOVES], '(10–15)% increased Quantity of Gold Dropped by Slain Enemies']] },
  { name: 'Insulation', re: /^#% to fire resistance$/, tiers: [[[...ARMOUR, BELT, ...JEWELLERY], '11–15', '21–25', '31–35']],
    perfect: [[[BELT], '(26–30)% of Fire Damage taken Recouped as Life']] },
  { name: 'Thawing', re: /^#% to cold resistance$/, tiers: [[[...ARMOUR, BELT, ...JEWELLERY], '11–15', '21–25', '31–35']],
    perfect: [[[HELM], '(26–30)% of Cold Damage taken Recouped as Life']] },
  { name: 'Grounding', re: /^#% to lightning resistance$/, tiers: [[[...ARMOUR, BELT, ...JEWELLERY], '11–15', '21–25', '31–35']],
    perfect: [[[GLOVES], '(26–30)% of Lightning Damage taken Recouped as Life']] },
  { name: 'Battle', re: /^# to accuracy rating$/, tiers: [[MARTIAL, '61–84', '124–167', '237–346'], [[GLOVES, 'Quivers'], null, null, '237–346']],
    perfect: [[DMG_1H, '+2 to Level of all Attack Skills'], [DMG_2H, '+3 to Level of all Attack Skills']] },
  { name: 'Haste', re: /^#% increased attack speed$/, tiers: [[[...MELEE_1H, ...MELEE_2H], '11–13', '17–19', '23–25'], [['Bows', 'Crossbows'], '8–10', '11–13', '14–16']],
    perfect: [[MARTIAL, '(20–25)% chance to gain Onslaught on Killing Hits with this Weapon']] },
  { name: 'Seeking', re: /critical hit chance/, tiers: [[MARTIAL, '1.51–2.1', '2.11–2.7', '3.11–3.8'], [CASTER, '34–39', '40–46', '47–53'], [STAFF, '50–59', '60–69', '70–79']],
    perfect: [[[BODY], 'Hits against you have (40–50)% reduced Critical Damage Bonus']] },
  { name: 'Sorcery', re: /^#% increased spell damage$/, tiers: [[CASTER, '35–44', '55–64', '75–89'], [STAFF, '69–88', '109–128', '149–188']],
    perfect: [[['Wands'], '+3 to Level of all Spell Skills'], [STAFF, '+5 to Level of all Spell Skills']] },
  { name: 'Alacrity', re: /^#% increased cast speed$/, tiers: [[CASTER, '13–16', '17–20', '25–28'], [STAFF, '20–25', '26–31', '38–43']],
    perfect: [[CASTER, '(18–20)% increased Mana Cost Efficiency'], [STAFF, '(28–32)% increased Mana Cost Efficiency']] },
  { name: 'Command', re: /^allies in your presence deal #% increased damage$/, tiers: [[['Sceptres'], '35–44', '55–64', '75–89']],
    perfect: [[['Sceptres'], 'Aura Skills have (15–20)% increased Magnitudes']] },
  { name: 'Abrasion', re: /^adds # to # physical damage/, tiers: [[DMG_1H, '4–6 to 7–11', '10–15 to 18–26', '16–24 to 28–42'], [DMG_2H, '5–8 to 10–15', '14–21 to 25–37', '23–35 to 39–59']],
    perfect: [[DMG_1H, 'Gain (15–20)% of Damage as Extra Physical Damage'], [DMG_2H, 'Gain (25–33)% of Damage as Extra Physical Damage']] },
  { name: 'Flames', re: /^adds # to # fire damage/, tiers: [[DMG_1H, '4–6 to 7–10', '20–24 to 32–37', '35–44 to 56–71'], [DMG_2H, '6–9 to 10–16', '30–37 to 45–56', '56–70 to 84–107']],
    perfect: [[DMG_1H, 'Gain (15–20)% of Damage as Extra Fire Damage'], [DMG_2H, 'Gain (25–33)% of Damage as Extra Fire Damage']] },
  { name: 'Ice', re: /^adds # to # cold damage/, tiers: [[DMG_1H, '3–5 to 6–9', '17–20 to 26–32', '31–38 to 47–59'], [DMG_2H, '5–8 to 9–14', '25–30 to 38–46', '46–57 to 70–88']],
    perfect: [[DMG_1H, 'Gain (15–20)% of Damage as Extra Cold Damage'], [DMG_2H, 'Gain (25–33)% of Damage as Extra Cold Damage']] },
  { name: 'Electricity', re: /^adds # to # lightning damage/, tiers: [[DMG_1H, '1 to 13–19', '1–3 to 55–60', '1–6 to 85–107'], [DMG_2H, '1–2 to 19–27', '1–4 to 80–88', '1–8 to 128–162']],
    perfect: [[DMG_1H, 'Gain (15–20)% of Damage as Extra Lightning Damage'], [DMG_2H, 'Gain (25–33)% of Damage as Extra Lightning Damage']] },
];

const TIER_NAMES = ['Lesser', 'Essence', 'Greater'];

// Эссенция для мода-кандидата на этом классе вещей: { name: 'Essence of the Body', tiers: ['Lesser 30–39', …] } или null.
function essenceFor(template, itemClass) {
  if (template.includes(' / ')) return null; // гибриды эссенции не дают
  for (const e of ESSENCES) {
    if (!e.re.test(template)) continue;
    const row = e.tiers.find(([classes]) => classes.includes(itemClass));
    if (!row) return null;
    const tiers = row.slice(1).map((r, i) => (r ? `${TIER_NAMES[i] ? `${TIER_NAMES[i]} ` : ''}${r}` : null)).filter(Boolean);
    return { name: `Essence of ${e.name}`, short: e.name.replace(/^the /, ''), tiers };
  }
  return null;
}

// Perfect-эссенции, которые встают на этот класс вещей: [{ name, mod }].
function perfectFor(itemClass) {
  const out = [];
  for (const e of ESSENCES) {
    const p = e.perfect.find(([classes]) => classes.includes(itemClass));
    if (p) out.push({ name: `Perfect Essence of ${e.name}`, mod: p[1] });
  }
  return out;
}

module.exports = { essenceFor, perfectFor };
