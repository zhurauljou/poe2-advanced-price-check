// Реестр методов крафта: каждая валюта / омен / предмет, который меняет вещь, — что делает, к чему применим и как его
// учитывает советник. Общий для главного процесса, окна и тестов. Аудит (test/methods.test.js) сверяет его со всем,
// что продаётся на poe.ninja: новая валюта без записи здесь — красный тест, а не тихая дыра в советах.
//
// model: 'plan'   — участвует в плане крафта (выбор способа, шанс, цена);
//        'advice' — в советах / разделах вкладки Craft, без расчёта в плане;
//        'gap'    — меняет вещь, но ещё не учтено (известная дыра, видна в аудите);
//        'ignore' — к крафту вещей не относится (карты, камни, ключи…), reason — почему.
(function (root) {
  const M = [
    // ---- белая / магическая → редкая ----
    { id: 'transmute', op: 'normal-to-magic', model: 'plan', rarity: ['Normal'],
      tiers: [['Orb of Transmutation', 0], ['Greater Orb of Transmutation', 44], ['Perfect Orb of Transmutation', 70]] },
    { id: 'augment', op: 'magic-add', model: 'plan', rarity: ['Magic'],
      tiers: [['Orb of Augmentation', 0], ['Greater Orb of Augmentation', 44], ['Perfect Orb of Augmentation', 70]] },
    { id: 'regal', op: 'magic-to-rare', model: 'plan', rarity: ['Magic'],
      tiers: [['Regal Orb', 0], ['Greater Regal Orb', 35], ['Perfect Regal Orb', 50]], omens: ['Omen of Sinistral Coronation', 'Omen of Dextral Coronation'] },
    { id: 'essence', op: 'magic-to-rare-guaranteed', model: 'plan', rarity: ['Magic'], match: /^(Lesser |Greater )?Essence of (?!Hysteria|Delirium|Horror|Insanity|the Abyss|the Breach)/ },
    { id: 'alchemy', op: 'to-rare-4', model: 'advice', rarity: ['Normal', 'Magic'], currencies: ['Orb of Alchemy'],
      omens: ['Omen of Sinistral Alchemy', 'Omen of Dextral Alchemy'] },
    // ---- редкая: добавить / снять / заменить ----
    { id: 'exalt', op: 'add', model: 'plan', rarity: ['Rare'],
      tiers: [['Exalted Orb', 0], ['Greater Exalted Orb', 35], ['Perfect Exalted Orb', 50]],
      omens: ['Omen of Sinistral Exaltation', 'Omen of Dextral Exaltation', 'Omen of Greater Exaltation', 'Omen of Catalysing Exaltation', 'Omen of Homogenising Exaltation'] },
    { id: 'annul', op: 'remove', model: 'plan', rarity: ['Magic', 'Rare'], currencies: ['Orb of Annulment'],
      omens: ['Omen of Sinistral Annulment', 'Omen of Dextral Annulment', 'Omen of Greater Annulment', 'Omen of Light'] },
    { id: 'chaos', op: 'replace', model: 'plan', rarity: ['Rare'],
      tiers: [['Chaos Orb', 0], ['Greater Chaos Orb', 35], ['Perfect Chaos Orb', 50]],
      omens: ['Omen of Whittling', 'Omen of Sinistral Erasure', 'Omen of Dextral Erasure'] },
    { id: 'crafted', op: 'replace-guaranteed', model: 'plan', rarity: ['Rare'], slot: 'crafted',
      match: /^(Perfect Essence of |Essence of (Hysteria|Delirium|Horror|Insanity|the Abyss|the Breach)$)|Alloy$/,
      omens: ['Omen of Sinistral Crystallisation', 'Omen of Dextral Crystallisation'] },
    { id: 'desecrate', op: 'desecrate', model: 'plan', rarity: ['Rare'], slot: 'desecrated',
      match: /^(Gnawed|Preserved|Ancient|Altered) (Rib|Jawbone|Collarbone|Cranium|Vertebrae)$/,
      omens: ['Omen of Sinistral Necromancy', 'Omen of Dextral Necromancy', 'Omen of Abyssal Echoes', 'Omen of Light', 'Omen of Putrefaction'] },
    { id: 'lich-omens', op: 'desecrate-pool', model: 'gap', currencies: ['Omen of the Sovereign', 'Omen of the Liege', 'Omen of the Blackblooded'],
      note: 'гарантированный мод лича при Desecrate (оружие и бижутерия) — нужен список модов личей по классам' },
    { id: 'gaze', op: 'unknown', model: 'gap', match: /'s Gaze$/, note: 'Gaze-предметы Abyss — механика изучается' },
    // ---- значения, фиксация, финал ----
    { id: 'divine', op: 'reroll-values', model: 'plan', currencies: ['Divine Orb'] },
    { id: 'fracture', op: 'fracture', model: 'advice', rarity: ['Rare'], currencies: ['Fracturing Orb'] },
    { id: 'hinekora', op: 'preview', model: 'advice', currencies: ["Hinekora's Lock"] },
    { id: 'vaal', op: 'corrupt', model: 'advice', currencies: ['Vaal Orb'], omens: ['Omen of Corruption'] },
    { id: 'sanctify', op: 'sanctify', model: 'advice', rarity: ['Rare'], currencies: ['Omen of Sanctification'] },
    { id: 'infuser', op: 'quality-corrupt', model: 'advice', match: /^(Vaal )?(Armourer's|Blacksmith's|Arcanist's|Catalysing) Infuser$/ },
    { id: 'sacrifice', op: 'corrupt-upgrade', model: 'advice', match: /'s Orb of Sacrifice$/, note: 'улучшает порченый мод и снимает случайный (data/gamble-currency.json)' },
    { id: 'vaal-unique', op: 'corrupt-unique', model: 'advice', currencies: ['Vaal Cultivation Orb'] },
    { id: 'architect', op: 'double-corrupt', model: 'advice', currencies: ["Architect's Orb"] },
    // ---- гнёзда и руны ----
    { id: 'artificer', op: 'add-socket', model: 'advice', currencies: ["Artificer's Orb"] },
    { id: 'rune-influence', op: 'socket-pool', model: 'plan', currencies: ["Thrud's Might", "Kolr's Hunt", "Katla's Gloom", "Vorana's Carnage", "Uhtred's Sidereus", "Medved's Tending"] },
    { id: 'rune-aldur', op: 'convert-element', model: 'plan', currencies: ['Passion of Aldur', 'Breath of Aldur', 'Ire of Aldur', 'Betrayal of Aldur'] },
    { id: 'rune-special', op: 'socket-special', model: 'advice', currencies: ["Aldur's Legacy", "Astrid's Creativity", "Serle's Triumph", "Cadigan's Epiphany"] },
    { id: 'socketables', op: 'socket-stats', model: 'gap', match: /Rune\b|Rune of |Soul Core|^Emergent |^Talisman of/,
      note: 'обычные руны и Soul Cores: «вставить лучшую руну» — нужны данные о статах рун по классам' },
    // ---- качество ----
    { id: 'quality', op: 'quality', model: 'advice', currencies: ["Armourer's Scrap", "Blacksmith's Whetstone", "Arcanist's Etcher"], match: /Catalyst$/ },
    // ---- самоцветы ----
    { id: 'emotions', op: 'jewel-replace', model: 'advice', match: /Liquid (Ire|Guilt|Greed|Paranoia|Envy|Disgust|Despair|Fear|Suffering|Isolation|Contempt|Ferocity|Melancholy)$/ },
    // ---- Verisium (Runes of Aldur) ----
    { id: 'verisium', op: 'unknown', model: 'gap', match: /Verisium|Starlit Ore|'s Crest of / , note: 'Verisium / Starlit Ore / Crest — механика изучается' },
    { id: 'misc-unknown', op: 'unknown', model: 'gap', currencies: ['Ancient Infuser', 'Core Destabiliser', 'Vaal Siphoner', 'Orb of Extraction', 'Omen of Chance', 'Omen of the Ancients', 'Omen of the Blessed', 'Raven-Touched Shard'],
      match: /'s Thesis$/, note: 'механика изучается' },
    // ---- не про крафт вещей ----
    { id: 'not-items', op: 'none', model: 'ignore', reason: 'карты, триалы, камни, ключи, обмен',
      currencies: ['Scroll of Wisdom', 'Chance Shard', 'Mirror of Kalandra', 'Cryptic Key', "Gemcutter's Prism", "Glassblower's Bauble",
        'Lesser Jeweller\'s Orb', "Greater Jeweller's Orb", "Perfect Jeweller's Orb", 'An Audience with the King', 'Head of the King', 'Sacred Bloom',
        "Artificer's Shard", 'Transmutation Shard', 'Regal Shard', 'Orb of Chance', 'Fracturing Shard', 'Crystallised Corruption', 'Breach Splinter', 'Breachstone'],
      match: /^Omen of (the Hunt|Gambling|Refreshment|Reinforcements|Secret Compartments|Bartering|Chaotic \w+|Resurgence|Answered Prayers|Amelioration)$/ },
  ];

  const byName = (name) => M.find((m) => (m.currencies || []).includes(name) || (m.tiers || []).some(([n]) => n === name)
    || (m.omens || []).includes(name) || (m.match && m.match.test(name))) || null;
  const get = (id) => M.find((m) => m.id === id);
  // [имя, мин. уровень мода] для метода с тирами (обычная / Greater / Perfect)
  const tiers = (id) => (get(id).tiers || []).slice();

  const api = { METHODS: M, byName, get, tiers };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CraftMethods = api;
}(typeof window !== 'undefined' ? window : this));
