# PoE 2 — заметки по крафту (для вкладки Craft)

- **Актуально для:** патч **0.5.5** (последний подпатч — **0.5.5e**, 6 окт. 2026), лига **Forbidden Rites** (event-лига, старт 4 сент. 2026) + Standard. Ядро крафта не менялось с **0.5.0** («Return of the Ancients», лига **Runes of Aldur**, старт 29 мая 2026). Следующий большой патч — **1.0, 11 дек. 2026** (по сторонним источникам, не проверено по официальному анонсу).
- **Составлено:** 2026-10-17.
- Обозначения: [S#] — ссылка на источник из раздела 7. «(не проверено)» — факт не подтверждён найденным источником или подтверждён только сомнительным.
- Примечание: maxroll.gg не отдавался (обрыв соединения), poe2wiki.net и mobalytics блокируют загрузку — основа: официальные патчноуты + poe2db.
- **Поправки и приёмы — в `docs/crafting-tricks.md` (§0 «Поправки»)**: раскрытие desecrate — 3 варианта, без лич-омена в них и обычные моды; «нет desecrated-префиксов на броне» верно только для эксклюзивов личей (Rib + Sinistral Necromancy даёт обычные префиксы); Greater/Perfect/Ancient отсекают низкие тиры, но семейство без тиров выше порога выпадает лучшим тиром; Whittling считает нераскрытый desecrated уровнем 1; Putrefaction обходит лимит одного desecrated.

## 1. Что изменилось за последние 2 патча (только крафт)

**0.5.0 (Runes of Aldur, патчноуты ~21–26 мая 2026) [S1][S2]:**
- **Один crafted-мод на предмет.** «All crafted modifiers are now guaranteed, but items can only have 1 crafted modifier at a time.» Моды эссенций (включая Perfect и corrupted, в т.ч. Mark of the Abyssal Lord) и Alloy — это crafted-моды: вторая эссенция/Alloy на ту же вещь даёт ошибку «This item already has a crafted modifier» [S1][S9][S10][S11]. Цепочки «эссенция → Perfect-эссенция» больше не работают.
- **Один desecrated-мод на предмет**, и он больше НЕ считается crafted → на вещи можно иметь 1 crafted + 1 desecrated [S1].
- Desecrated-моды с Instant Leech больше не выпадают [S2].
- Greater Orb of Transmutation / Augmentation: мин. уровень мода **44** (было 55); Transmutation/Augmentation стали заметно реже; Greater/Perfect валюта «somewhat rarer»; Divine Orb — чаще [S2].
- **Fracturing Orb** теперь падает только при специализации через атласные пассивы (Exceptional Items, Fracturing Orbs) [S2].
- **Recombinator отключён**, Omen of Recombination удалён (удаляется при входе) [S2][S6]. В 0.5.5 о возвращении не сказано — считать отключённым (не проверено).
- **Omen of Corruption больше не добывается**; Omen of Corruption, Omen of Homogenising Coronation, Omen of Homogenising Exaltation — на Currency Exchange только в Standard [S1].
- Omen of Chaotic Rarity/Quantity/Monsters (для Waystone) теперь ЗАПРЕЩАЮТ свой тип мода; новый Omen of Chaotic Effectiveness [S2].
- Abyss-омены не падают в зонах ниже 65 уровня [S2].
- Perfect Essence of Battle: +3 (было +5) для 2H/Crossbow, +2 (было +3) для 1H/Bow; Essence of Hysteria на Focus: 20–23% ES Recharge Rate (было 41–45%) [S2]. Melee/Projectile +уровни на оружии понижены (2H +7→+5, 1H +5→+4), спелл-уровни не трогали (не проверено, [S6]).
- Catalysts больше не падают с монстров — только Genesis Tree (Breach); добавлены 12/13 **Refined**-катализаторов для самоцветов [S2][S4].
- 13 **Alloys** (Verisium): «add various new crafted modifiers to items by replacing an existing modifier» — аналог Perfect-эссенции, занимают crafted-слот [S1][S4].
- **Liquid Emotions** (Delirium) крафтят доп. моды на самоцветы как Greater Essence (не проверено, [S6]).
- Vaal Orb: исход «переролл значений за пределами диапазона» теперь **умножает** каждый мод от текущего значения; то же для Sanctification (Omen of Sanctification) [S2].
- Vaal Infusers разделены на 4 типа (Armourer's / Blacksmith's / Arcanist's / Catalysing), работают только на вещах с quality ≥ 20% [S2].
- Jeweller's Orbs можно использовать на вещах со скиллами (добавить сокеты) [S1].
- Cast Speed на кольцах — с 60 ур., на амулетах — с 66 ур.; Leech-моды на перчатках/кольцах переразмечены по уровням, «of the Parasite»/«of the Thirsty» убраны [S1][S2].
- Новые руны: 13 Ancient, 13 Mythical, 3 Flux, 15 meta-crafting рун (напр. Astrid's Creativity — «+1 Crafted Modifier allowed», Serle's Triumph — «+1 Suffix Modifier allowed») [S2][S14].

**0.5.5 (Forbidden Rites, 3–4 сент. 2026) и подпатчи b–e [S3][S5][S7]:**
- Изменений механики крафт-валюты/оменов/эссенций нет. 0.5.5b–e — только багфиксы.
- Doryani's Refined Formula удалён; новый атласный вариант **Archaic Corruption** — монстры из эссенций становятся Corrupted (больше corrupted-эссенций) [S3][S8].
- Trial of Chaos: награды теперь только валюта и Soul Cores (corrupted-вещей больше нет) [S3].
- Expedition/Fallow/Verisium Anvil — в ядре игры (Standard и Forbidden Rites); Verisium Anvil открывается квестом Act 4 «The Runeseeker» [S3].
- 17 новых Soul Cores, ряд переработан, 8 ограничены «Limit 1» [S3].
- Лига-механика: Ritual в каждой зоне кампании — дают валюту для крафта на прокачке; на крафт эндгейм-вещей не влияет [S3][S8].

## 2. Базовые правила

### 2.1 Слоты модов
- Rare: до **3 prefix + 3 suffix**; Magic: **1 prefix + 1 suffix** [S12].
- Самоцветы (Jewel), rare: **2 + 2** (не проверено, следует из игровых данных, источника не найдено).
- Поправки: «+1 Suffix Modifier allowed» (руна Serle's Triumph и т.п.) [S14]; «+1 Crafted Modifier allowed» — Astrid's Creativity [S14].
- Лимиты сверх слотов: **1 crafted** (эссенция / Alloy / прочие «гарантированные» моды) и **1 desecrated** [S1].
- Desecrated-префиксы на Body Armour/Gloves/Boots/Helmets — по poe2db «нет» (не проверено, на странице есть противоречие) [S13].

### 2.2 Уровень мода и ilvl
- Мод может выпасть, только если его уровень ≤ ilvl предмета. Greater/Perfect-валюта дополнительно отсекает моды ниже порога [S4].
- Пороги (poe2db) [S4]:

| Валюта | Greater | Perfect |
|---|---|---|
| Orb of Transmutation | 44 | 70 |
| Orb of Augmentation | 44 | 70 |
| Regal Orb | 35 | 50 |
| Exalted Orb | 35 | 50 |
| Chaos Orb | 35 | 50 (добавляемый мод) |

- По [S12], порог «never removes a modifier family entirely» — семейство без тира выше порога, видимо, всё равно может выпасть лучшим доступным тиром (не проверено).
- Perfect-валюта на базе с ilvl < порога бесполезна/запрещена (не проверено) — минимум для Perfect Exalt — ilvl ≥ 50, лучше ≥ 75–82 для T1.
- Выше — не всегда лучше: у ботинок полезные пороги 71 и 82, а 72–75 добавляют «мусорные» тиры — база ilvl 71 даёт лучшие шансы на MS + сопротивления (см. `market-notes.md` §2, **M**).

### 2.3 Основная валюта [S4]
- **Orb of Transmutation** — Normal → Magic (1 мод). **Orb of Augmentation** — +1 мод на Magic.
- **Regal Orb** — Magic → Rare (+1 мод). Omen of Sinistral/Dextral Coronation — только prefix/suffix.
- **Orb of Alchemy** — Normal/Magic → Rare с 4 модами. Omen of Sinistral/Dextral Alchemy — максимум префиксов/суффиксов [S15].
- **Exalted Orb** — +1 случайный мод на Rare.
- **Chaos Orb** — удалить 1 случайный мод и добавить 1 случайный (не полный реролл) [S4].
- **Orb of Annulment** — удалить 1 случайный мод.
- **Divine Orb** — реролл чисел у модов (в пределах тира). Omen of the Blessed — только implicit; Omen of Sanctification — Sanctify rare-вещи (множитель значений, дальше вещь почти не крафтится; ~78–122% — не проверено, [S12]).
- **Fracturing Orb** — фиксирует случайный мод на Rare с **≥ 4 модами**; fractured мод не меняется Chaos/Annul/Divine (по [S12], не проверено для Divine). Fracture может попасть и на crafted-мод [S10].
- **Hinekora's Lock** — «Allows an item to foresee the result of the next Currency item used on it. Modifying the item in any way removes the ability to foresee.» Стак 10 [S16]. Предпросмотр не тратит валюту; работает с Vaal/Divine/Chaos/Exalted (не проверено, [S17]). Дорогой (сотни Divine по [S17] — не проверено).
- **Orb of Chance** — Normal → случайный Unique или уничтожение. Omen of Chance — не уничтожает; Omen of the Ancients — гарантирует апгрейд в unique того же класса [S15]. В 0.5 Chance можно применять к Tablets [S2].
- **Artificer's Orb** — +1 Augment socket на martial weapon, wand, staff или armour [S4]. Лимиты сокетов по слотам — (не проверено). Vaal может добавить сокет сверх лимита (не проверено, [S18]).
- **Jeweller's Orbs** — Lesser/Greater/Perfect: 3/4/5 support-сокетов у гема; в 0.5 работают и на item-skills [S1][S4].
- **Vaal Orb** — непредсказуемое изменение + Corrupted. Исходы (не проверено, ~по 25% [S18]): без изменений; corruption-enchant/implicit; «reforge» модов; +сокет (на wand/staff — вместо этого quality до 23%?). Исход с рандомизацией значений в 0.5 умножает от текущего [S2]. Omen of Corruption («всегда изменяет») — в лиге не добывается [S1][S15]. Повторная коррупция — Architect's Orb, 50/50 «второй enchant / уничтожение» (не проверено, [S18]).

### 2.4 Качество и катализаторы [S4][S2]
- Blacksmith's Whetstone — martial weapons; Arcanist's Etcher — wands, staves, sceptres; Armourer's Scrap — armour; до 20%.
- Vaal Infusers (Armourer's/Blacksmith's/Arcanist's/Catalysing) — до +10% сверх максимума, шанс коррупции, только при quality ≥ 20%.
- Catalysts (кольца, амулеты): Flesh (life), Neural (mana), Carapace (armour/evasion/ES), Uul-Netol's (physical), Xoph's (fire), Tul's (cold), Esh's (lightning), Chayula's (chaos), Reaver (attack), Sibilant (caster), Skittering (speed), Adaptive (attributes), Necrotic (minion). Новый тип качества заменяет старый.
- **Refined**-катализаторы (те же 13 типов) — для самоцветов [S4].
- Essence of the Breach — +20% к максимальному quality бижутерии [S13b].
- **Omen of Catalysing Exaltation** — следующий Exalted Orb «consumes all Catalyst Quality» и повышает шанс мода совпадающего типа [S15].
- Catalysts теперь только из Genesis Tree [S2].

### 2.5 Desecration (Abyss) [S4][S13]
- Кости: **Jawbone** — weapons/quivers; **Rib** — armour; **Collarbone** — amulets/rings/belts; **Cranium** — jewels (только Preserved); **Vertebrae** — waystones (Preserved). **Gnawed** — ilvl предмета ≤ 64; **Preserved** — любой; **Ancient** — моды уровня ≥ 40. **Altered Collarbone** — бижутерия, шанс «otherworldly» модов.
- Применяется к Rare: добавляет Unrevealed desecrated-мод; **если вещь полная — ещё и удаляет случайный мод** [S13]. Раскрытие — у Well of Souls, выбор из вариантов (3 — по [S12], не проверено). Вещь с desecrated-модом нельзя desecrate повторно [S13].
- Омены: Abyssal Echoes — один реролл вариантов; Sinistral/Dextral Necromancy — только prefix/suffix; the Sovereign (Ulaman) / the Liege (Amanamu) / the Blackblooded (Kurgal) — гарантированный мод пула лича, **только на Weapon или Jewellery**; Putrefaction — заменяет все моды до 6 Unrevealed и коррумпирует (как работает с лимитом 1 desecrated — не проверено); **Omen of Light** — Annulment удаляет только desecrated-моды [S13][S15].
- **Essence of the Abyss** даёт Mark of the Abyssal Lord (crafted-слот!); desecrate такой вещи всегда удаляет Mark и добавляет Unrevealed desecrated-мод **более высокого тира** [S13].

### 2.6 Эссенции [S13b]
- Lesser / обычная / Greater: Magic → Rare + гарантированный мод (тир фиксирован эссенцией и классом вещи).
- Perfect и corrupted-эссенции: на Rare — удаляют случайный мод и добавляют свой. Omen of Sinistral/Dextral Crystallisation — удаляется только prefix/suffix.
- Все моды эссенций — crafted → **одна эссенция на вещь** [S1][S10].
- Corrupted-эссенции (получаются коррупцией монстра-эссенции Vaal Orb'ом, Archaic Corruption на атласе): **Hysteria** — Helmet +1 к уровню Minion-скиллов; Body 64–97 to 98–145 Physical Thorns; Gloves 25–29% Crit Damage Bonus; Boots 30% Movement Speed; Ring 50–59% Mana Regen; Amulet 19–21% damage taken recouped as Life; Belt +254–304 Stun Threshold; Shield 20–24% Block; Quiver 43–50% Bow damage; Focus 20–23% ES Recharge. **Delirium** — Body: аллоцирует случайный Notable. **Horror** — Gloves/Boots: 60% increased effect of Socketed Augments. **Insanity** — Belt: при коррупции 2 enchant'а. **Abyss** — Mark of the Abyssal Lord. **Breach** — бижутерия +20% max Quality.
- Perfect-эссенции (значения сверены с poe2db, совпадают с `essences.js`): Body (Body Armour, 8–10% max Life), Mind (Ring, 4–6% max Mana), Enhancement (Amulet, 20–30% global def), Ruin (Body, 10–15% phys as chaos), Infinite (Amulet, 7–10% attrs), Opulence (Gloves, gold), Insulation/Thawing/Grounding (Belt/Helmet/Gloves recoup), Battle (+2 1H/Bow, +3 2H/Crossbow), Haste (martial, Onslaught), Seeking (Body, -crit dmg taken), Sorcery (Wand +3 / Staff +5 spell levels), Alacrity (Focus/Wand 18–20%, Staff 28–32% Mana Cost Efficiency), Command (Sceptre, 15–20% aura magnitudes), Abrasion/Flames/Ice/Electricity (1H/Bow 15–20%, 2H/Crossbow 25–33% gain as extra).

### 2.7 Alloys (Verisium, 0.5) [S4][S1]
- 13 штук, открываются через Remnant-энкаунтеры после квеста Farrow в Act 2. Большинство: «removes a random modifier and augments» гарантированным crafted-модом (зависит от класса). Занимают crafted-слот → несовместимы с эссенцией.
- Runic (Runic Ward на бижутерии), Adaptive, Protective (Runic Ward/recovery на оружии/щитах), Expansive (Presence, mana efficiency, minion limit…), Swift (cast/attack speed…), Cyclonic (durations), Prismatic (penetration, ailment magnitude, exposure), Mystic (AoE, Spirit, chaining), Sovereign (augment effect, resists), Celestial (mana, **spell level**, accuracy, attack speed), Transcendent (cast speed, cold dmg, attributes, phys), Runebinder's, Runefather's. Точные значения по слотам — не найдены (не проверено).
- Verisium Runeforging (Verisium Anvil) — Runic Ward на броню; ниже ур. 55 без минусов, выше — за счёт части базовой защиты [S1][S2].

### 2.8 Recombinators
- Отключены с 0.5.0; Omen of Recombination удалён [S2]. В 0.5.5 Expedition стал «ядром», но о возврате Recombinator не сказано (не проверено). Не советовать.

### 2.9 Forbidden Rites
- Новой крафт-механики нет; Ritual в кампании даёт крафт-валюту на прокачке [S3][S8]. Royal Lenience — Defer за уже отданный Tribute (+500% цены отложенного) [S5].

## 3. Омены крафта [S15][S13]

| Omen | Валюта | Эффект |
|---|---|---|
| Sinistral / Dextral Exaltation | Exalted | только prefix / только suffix |
| Greater Exaltation | Exalted | добавляет **два** мода |
| Homogenising Exaltation | Exalted | мод того же типа (тега), что уже есть; только Standard (Currency Exchange) |
| Catalysing Exaltation | Exalted | тратит весь Catalyst Quality, повышает шанс мода этого типа |
| Sinistral / Dextral Coronation | Regal | только prefix / suffix |
| Homogenising Coronation | Regal | мод того же типа; только Standard |
| Sinistral / Dextral Alchemy | Alchemy | максимум префиксов / суффиксов |
| Whittling | Chaos | удаляет мод с **наименьшим уровнем мода** (не тиром) |
| Sinistral / Dextral Erasure | Chaos | удаляет только prefix / suffix |
| Greater Annulment | Annulment | удаляет **два** мода |
| Sinistral / Dextral Annulment | Annulment | удаляет только prefix / suffix |
| Light | Annulment | удаляет только desecrated-мод |
| Sinistral / Dextral Crystallisation | Perfect / Corrupted Essence | удаляет только prefix / suffix |
| the Blessed | Divine | реролл только implicit |
| Sanctification | Divine | Sanctify rare-вещь (множитель значений, вещь «заморожена») |
| Corruption | Vaal | всегда вызывает изменение; в лиге не добывается |
| Chance | Orb of Chance | не уничтожает предмет |
| the Ancients | Orb of Chance | случайный unique того же класса |
| Abyssal Echoes | Desecration reveal | один реролл вариантов |
| Sinistral / Dextral Necromancy | Desecration | только prefix / suffix |
| the Sovereign / the Liege / the Blackblooded | Desecration (Weapon/Jewellery) | гарантированно мод Ulaman / Amanamu / Kurgal |
| Putrefaction | Desecration | все моды → до 6 Unrevealed, Corrupted |
| Chaotic Rarity / Quantity / Monsters / Effectiveness | Chaos на Waystone | запрещают мод своего типа (0.5) |
| Recombination | — | удалён в 0.5 |

Комбинирование: одновременно активны до трёх оменов (сформулировано для Waystone-оменов в 0.5 [S2]; для обычного крафта — не проверено, но комбо «Greater Exaltation + Sinistral Exaltation» описывается в гайдах [S19]).

## 4. Рецепты

**Общий принцип (все источники):** дешёвое и обратимое — сначала, необратимое (Vaal, Sanctify) — в конце; одна эссенция и одна desecration — планировать заранее, что займёт crafted-слот [S12][S19].

### R1. Magic-база → эссенция → добивка (основа, дёшево–средне)
1. База с высоким ilvl (≥ 75–82 под T1; проверять ilvl, а не требование уровня [S19]). Magic с 1–2 нужными модами (Transmute/Augment; Greater 44+, Perfect 70+).
2. Greater Essence нужного мода → Rare с гарантированным модом (crafted-слот занят).
3. Desecrate (кость по слоту, Necromancy-омен на нужную сторону) **до** Exalt-ов, пока есть место — иначе снимется случайный мод [S13][S19].
4. Exalted (+ Sinistral/Dextral Exaltation) на оставшиеся места; на дорогих базах — Greater/Perfect Exalted.
5. Divine — когда набор модов финальный. Quality, сокеты, руны.
- Риск: средний (Exalt-ы случайны). Когда: броня/бижутерия под «life + резисты», оружие под конкретный урон.

### R2. Perfect Exalt + омены (дорого)
- Perfect Exalted (моды 50+) + Sinistral/Dextral Exaltation; на 2 свободных места одной стороны — + Greater Exaltation (два мода). Пример из гайдов: wand/staff — Perfect Exalt + Greater Exaltation на два сильных префикса [S19]; амулеты — сторона-омен + Catalysing Exaltation [S19].
- Перед дорогим шагом — Hinekora's Lock, если цена Lock меньше риска.

### R3. Убрать один плохой мод
- Плохой мод — самый низкоуровневый → **Chaos + Whittling** (снимает его и сразу добавляет новый; Greater/Perfect Chaos — новый мод 35+/50+).
- Плохой мод — один на своей стороне (или остальные на стороне fractured) → **Annulment + Sinistral/Dextral Annulment** = 100% попадание.
- Несколько на стороне → Annulment + сторона-омен (1/N) или Chaos + Erasure (меняет на случайный).
- Плохой мод desecrated → **Annulment + Omen of Light** (гарантированно он), потом desecrate снова.
- Плохой мод — эссенция (crafted) → её можно снять только Annul/Chaos случайно; освобождает crafted-слот (не проверено).

### R4. Desecration-таргетинг
- Weapon/Jewellery: лич-омен (Sovereign/Liege/Blackblooded) + Necromancy-омен на сторону; Ancient-кость (моды 40+); Abyssal Echoes — только на почти идеальных вещах [S19].
- **Essence of the Abyss → desecrate**: Mark гарантированно заменяется desecrated-модом более высокого тира [S13]; но Essence of the Abyss — Perfect-подобная (снимает случайный мод) и занимает crafted-слот, а значит до desecrate нельзя ставить другую эссенцию.
- Не забыть: на полной вещи desecrate удаляет случайный мод.

### R5. Fracture-then-craft
- Rare с ≥ 4 модами, где один ключевой (например, +уровни на посохе) → Fracturing Orb (риск: зафиксируется не тот). Лучше на вещи с 4 модами, где 3 «мусорные» нас не волнуют, или где все хорошие.
- После fracture — агрессивно Annul/Chaos остальное; сторона с fractured-модом становится легче для сторонних оменов.
- Fracturing Orb дефицитен в 0.5 (атлас) [S2].

### R6. Hinekora's Lock
- Перед: Vaal Orb на дорогой вещи, Perfect Exalt/Chaos на почти готовой, Fracturing Orb (не проверено, что Lock работает с Fracturing), Divine на вещи с узким окном. Если предпросмотр плохой — валюту не применять; но любое изменение вещи (в т.ч. другой валютой) снимает предвидение, так что «посмотреть другой вариант» нельзя — Lock нужен новый [S16][S17].

### R7. Бижутерия: catalyst + Catalysing Exaltation
- Кольцо/амулет с открытыми местами → Catalyst нужного типа до 20% (Breach Ring/Essence of the Breach — выше) → Exalted + Omen of Catalysing Exaltation (+ сторона-омен) → тратит quality, повышает шанс мода этого тега. После — заново катализировать для финального бонуса quality (качество усиливает совпадающие моды).
- Кольца часто дешевле купить [S19].

### R8. Самоцветы
- 2+2 мода; Refined-катализатор для quality; Preserved Cranium для desecrate; Liquid Emotions (Delirium) — доп. моды «как Greater Essence» (не проверено) [S6].

### R9. Оружие
- Spell staves/wands: база с высоким ilvl → Magic с +уровнями спеллов (Perfect Transmute/Augment 70+) → Greater Essence (Sorcery / Alacrity / Seeking) → Exalt/Perfect Exalt на префиксы; альтернатива для финала — Celestial/Transcendent Alloy (spell level/cast speed), если crafted-слот свободен [S20, низкая надёжность]. Perfect Essence of Sorcery (+3 wand / +5 staff) — только если crafted-слот свободен.
- Phys/Attack: высокий ilvl, Greater Essence of Abrasion/Haste/Battle; desecrate prefix (Jawbone + Sinistral Necromancy + лич-омен); Perfect Essence of Battle (+2/+3 к атакам) или Abrasion (gain as extra) как альтернатива другой эссенции — выбирается одна.

### R10. Броня (ES / life)
- Greater Essence of Enhancement (68–79%) или Body; desecrate (Rib), Necromancy на нужную сторону; Exalt-добивка только если вещь уже хорошая; Verisium Runeforging — сравнить защиту до/после [S19].
- Ботинки — крафтить только если уже есть Movement Speed (или Essence of Hysteria на ботинки — 30% MS, crafted-слот) [S19][S13b].

### R11. «Детерминированный» подход топ-крафтеров (сводка)
- Сокращать случайность: сторона-омены на каждый Exalt/Annul/Chaos; Whittling на самый низкоуровневый мод; Omen of Light для desecrated; Crystallisation для Perfect-эссенций; Fracture ключевого мода; Hinekora's Lock перед дорогими шагами; Greater/Perfect-валюта для отсечения низких тиров. Crafted-слот и desecrated-слот — заранее решить, чем их занять [S12][S1].

## 5. Практические советы и типовые ошибки
- Проверять ilvl базы (не уровень требования); на низком ilvl Perfect-валюта и T1 недоступны [S19][S4].
- Divine — только когда набор модов финальный [S19].
- Exalted на сторону, которая уже полная, — потеря валюты (Exalt выберет другую сторону или не сработает; не проверено).
- Desecrate до Exalt-ов (пока есть место) [S19].
- Не планировать две эссенции/эссенция + Alloy — это один crafted-слот [S1][S10].
- Старые гайды (до 0.5) со стеком эссенций и Recombinator — устарели [S11].
- Vaal — только на готовых вещах, которые не жалко [S18].
- Цены: курс Exalted→Divine в 0.5 скакал ~90–300+ (не проверено, [S11]); актуальные — poe.ninja.

## 6. Выводы для вкладки Craft (сверка с `src/main/craft.js`, `src/main/essences.js`)

> **Статус (сверено с кодом в v0.3.113, 2026-10-18):** пункты 1–5, 7–9, 11, 13, 16, 17 сделаны — crafted-слот и его
> лимит (`craftedCap`, руна Astrid's Creativity), порченые эссенции и Alloys (`data/crafting-currency.json`), омены
> Desecrate (Necromancy, лич-омены, Abyssal Echoes), Hinekora's Lock и Fracturing Orb — в разделе рискованных шагов,
> Greater / Perfect Transmutation, Omen of Greater Exaltation в плане, гнёзда Artificer's Orb, Liquid Emotions,
> совет про Omen of Catalysing Exaltation (тратит всё качество).
> Открыты: 6 (Altered-кости — только упоминание), 10 (снимает ли Whittling desecrated-мод — проверить в игре),
> 12 (подсветка «гарантированно»).
> Ниже — исходный список (как был составлен для 0.5.5).

**Несоответствия / устаревшее:**
1. **Нет учёта лимита «1 crafted-мод».** `advise()` предлагает эссенцию для magic→rare и одновременно секцию `perfect` (Perfect-эссенции) для rare, не проверяя, есть ли уже crafted/essence-мод. Если на вещи есть мод эссенции/Alloy (tag `crafted` в Advanced Mod Descriptions, у Mark of the Abyssal Lord — тоже), Perfect-эссенции, corrupted-эссенции и Alloys неприменимы (ошибка «This item already has a crafted modifier»). Нужно: скрывать/помечать секцию `perfect` при наличии crafted-мода; в `planGoal` для magic не обещать «эссенция + позже Perfect».
2. **Perfect-эссенция = crafted-слот.** В секции `perfect` стоит предупредить: «займёт единственный crafted-слот; после неё эссенции/Alloy уже не встанут».
3. **Нет corrupted-эссенций** (Hysteria, Delirium, Horror, Insanity, Abyss, Breach) в `essences.js` — Hysteria на ботинки (30% MS), перчатки (Crit Damage), шлем (+1 minion) и т.д. ценны; Essence of the Abyss → desecrate даёт desecrated-мод выше тиром.
4. **Нет Alloys** — альтернатива Perfect-эссенции (тоже replace + crafted-слот). Добавить хотя бы упоминание для оружия/бижутерии (данные по значениям — нужно собрать с poe2db).
5. **Desecration-секция** не упоминает омены: Sinistral/Dextral Necromancy (сторона), Sovereign/Liege/Blackblooded (лич-пул, только Weapon/Jewellery), Abyssal Echoes. Также не говорится, что на полной вещи удалится случайный мод — сейчас есть «replaces a random one when full», ок; но стоит советовать desecrate **раньше** Exalt-ов, когда места есть.
6. `boneFor()` — корректно (Gnawed ≤ 64, Preserved, Ancient 40+, Cranium только Preserved). Можно добавить Altered Collarbone для бижутерии.
7. **Hinekora's Lock** советуется только в секции magic→rare (там он почти бессмыслен по цене). Лучше: советовать перед дорогими шагами — Perfect Exalt/Chaos, Fracturing Orb, Vaal на почти готовой вещи, Perfect-эссенция; и только если ожидаемая цена вещи ≫ цены Lock.
8. **Fracturing Orb** (`cheap`) помечен как «дёшево и без риска» — в 0.5 он дефицитен (атлас) и рискован (случайный мод). Перенести из `cheap` в отдельную секцию с риском; советовать, только если ключевой мод ≥ ~50% модов вещи или если хороших модов большинство.
9. **Magic-база:** не советуются Greater/Perfect Transmutation/Augmentation (44+/70+) — полезно для подготовки magic-базы перед эссенцией. Также нет Orb of Alchemy + Sinistral/Dextral Alchemy.
10. **Whittling** (`lowest`): берёт мин. `required_level` среди всех не-fractured модов, включая desecrated и crafted — снимает ли Whittling desecrated/crafted-мод, не проверено; безопаснее исключить desecrated (у него свой путь через Omen of Light).
11. **Catalyst-совет** для колец/амулетов: стоит уточнить, что Catalysing Exaltation **тратит всё качество** — после него катализировать заново; и что катализаторы теперь только из Genesis Tree (дороже).
12. **Annulment + сторона-омен:** если на стороне только один не-fractured мод — шанс 100% (сейчас `sameSide` уже считает только не-fractured — хорошо; можно явно подсвечивать «гарантированно»).
13. **Omen of Greater Exaltation** предлагается при `open[side] >= 2` — ок; можно добавить комбинацию с Perfect Exalted для дорогих баз.
14. **Recombinator / Omen of Corruption / Homogenising-омены** в приложении не советуются — правильно (в лиге их нет/не добываются). Не добавлять.
15. Значения эссенций в `essences.js` сверены с poe2db (Body, Mind, Enhancement, Insulation, Command, Infinite, Battle, Sorcery, Alacrity, Haste — совпадают, включая нерф Perfect Battle +2/+3). Command: Perfect — «Aura Skills have (15–20)% increased Magnitudes» — совпадает.
16. `Artificer's Orb` исключает Sceptre — по poe2db список «martial weapon, wand, staff или armour» — совпадает. Лимиты сокетов не проверялись (`!item.sockets` — советует только при 0 сокетов; у 2H/Body может быть 2 — не проверено).
17. Самоцветы: можно добавить Liquid Emotions (Delirium) как способ добавить мод (не проверено).

**Что приложение должно проверять/советовать дополнительно:**
- ilvl < 50 → предупреждение: Perfect Exalted/Regal/Chaos бессмысленны; ilvl < 70 → Perfect Transmute/Augment; ilvl ниже уровня T1 нужного мода → «T1 невозможен на этой базе» (частично уже есть через `bestIdx`).
- Предупреждать, если вещь Sanctified/Corrupted (уже есть) и если есть crafted-мод (нет).
- Если desecrated-мод уже есть — не предлагать вторую desecration (уже есть), но предлагать Omen of Light при слабом desecrated-моде (есть).
- Для fractured вещи: подсвечивать, что сторона с fractured упрощает сторона-омены (Annul 1/(N-1)).
- Порядок шагов в `planGoal`: эссенция → desecrate (если место) → Exalt-ы → Divine → quality/сокеты → (Vaal).

## 7. Источники
- [S1] Официальные патчноуты 0.5.0 (Return of the Ancients / Runes of Aldur), форум PoE, ~21–26.05.2026 — https://www.pathofexile.com/forum/view-thread/3932540
- [S2] Тот же тред, раздел изменений предметов/валюты (обе части) — https://www.pathofexile.com/forum/view-thread/3932540
- [S3] Официальные патчноуты 0.5.5 (Forbidden Rites), 03.09.2026 — https://www.pathofexile.com/forum/view-thread/4000864
- [S4] poe2db Stackable Currency (данные 0.5) — https://poe2db.tw/us/Stackable_Currency
- [S5] Конспект 0.5.5 (note.com, koni_pu3), 03.09.2026 — https://note.com/koni_pu3/n/n5ab3664d0265?hl=en
- [S6] BugFree.gg, «0.5.0 Crafting Changes», 23.05.2026 — https://bugfree.gg/guides/poe2-crafting-changes-0-5-0
- [S7] Патчноуты 0.5.5b (11.09), 0.5.5c (18.09), 0.5.5d (~28.09), 0.5.5e (06.10.2026) — https://www.pathofexile.com/forum/view-thread/4004106 · /4006357 · /4008534 · /4009785 ; список: https://www.pathofexile.com/forum/view-forum/2212
- [S8] Kami-labs, 0.5.5 patch notes summary, сент. 2026 — https://kami-labs.fr/en/path-of-exile-2/patch-notes-0-5-5-path-of-exile-2-forbidden-rites/
- [S9] Форум, фидбек «Please Revert The Essence Crafting Change», 25.05.2026 — https://www.pathofexile.com/forum/view-thread/3933180
- [S10] Форум, баг-репорт «Non-crafted weapon has a crafted mod error», 09.06.2026 — https://www.pathofexile.com/forum/view-thread/3956910 ; «Essence of Abyss: this item already has a crafted modifier», 12.06.2026 — https://www.pathofexile.com/forum/view-thread/3960848
- [S11] Timesaver.gg, «PoE2 0.5 Crafting Guide», 05.06 / обн. 06.08.2026 (коммерческий, есть ошибки) — https://timesaver.gg/blog/poe2-0-5-crafting-guide
- [S12] PoE2 Crafting Codex (domistae, сверен с 0.5.0, заголовок 0.5.5) — https://domistae.github.io/poe2-leveling/poe2_crafting_codex.html
- [S13] poe2db Desecrated Modifiers (0.5) — https://poe2db.tw/us/Desecrated_Modifiers
- [S13b] poe2db Essence (0.5) — https://poe2db.tw/us/Essence
- [S14] PoE2Craft codex, Runes («0.5.4, June 2026») — https://poe2craft.com/codex/runes
- [S15] poe2db Omen (0.5) — https://poe2db.tw/us/Omen
- [S16] poe2db Hinekora's Lock — https://poe2db.tw/us/Hinekoras_Lock
- [S17] Timesaver.gg, Hinekora's Lock guide, 01.07 / обн. 06.09.2026 (коммерческий) — https://timesaver.gg/blog/poe2-hinekoras-lock-guide
- [S18] Timesaver.gg, Double Corruption guide, 22.07 / обн. 22.08.2026 (коммерческий, внутренние противоречия) — https://timesaver.gg/blog/poe2-double-corruption-guide
- [S19] Elyxir.gg, «Crafting Guide under the New Essence Rules», 09.06.2026 (коммерческий) + сводка Mobalytics-гайдов 0.5 из поиска (страницы 403) — https://www.elyxir.gg/guide/path-of-exile-2/path-of-exile-2-crafting-guide-how-to-make-better-weapons-and-armor-under-the-new-essence-rules ; https://mobalytics.gg/poe-2/guides/ssf-crafting
- [S20] Mobalytics, «[0.5] Low/High Budget Equipment Crafting Guide» (только сниппет поиска, 403) — https://mobalytics.gg/poe-2/profile/paintmaster/guides/recoup-chronomancer-gear-crafting-guide
- Недоступны при сборе: maxroll.gg/poe2 (обрыв соединения), poe2wiki.net (Anubis), mobalytics (403).
