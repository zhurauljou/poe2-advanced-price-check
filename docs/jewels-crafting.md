# Самоцветы (Jewels) в PoE 2 0.5.5: крафт и оценка

Патч 0.5.5, лига Forbidden Rites (старт 2026-09-04), собрано 2026-10-17.
Игровые термины даны на английском, как в игре. **[R]** — проверено по локальным игровым данным
(`%APPDATA%\PoE 2 Price Checker\cache\repoe-mods.json`, `repoe-base-items.json`, `stats.json`).
**[T]** — живой трейд или poe.ninja, данные на 2026-10-17. [Sn] — источники в конце.
«(не проверено)» — утверждение из одного стороннего источника или вывод без подтверждения.

---

## 1. Основы

### 1.1 Базы и пулы модов [R]
В RePoE у баз `item_class: "Jewel"` и короткие имена: `Ruby`, `Emerald`, `Sapphire`, `Diamond`,
`Time-Lost Ruby` и т.д. На трейде класс называется `Jewels`, категория `jewel`.

| База | Теги | Семейств prefix / suffix (обычные) | desecrated p / s |
|---|---|---|---|
| Ruby (Str) | strjewel | 29 / 21 | 29 / 3 |
| Emerald (Dex) | dexjewel | 30 / 44 | 29 / 3 |
| Sapphire (Int) | intjewel | 23 / 35 | 29 / 3 |
| Diamond | str+dex+int jewel, not_for_sale | 70 / 90 (объединение) | 29 / 3 |
| Time-Lost Ruby | str_radius_jewel, radius_jewel | 30 / 22 | 6 / 6 |
| Time-Lost Emerald | dex_radius_jewel | 31 / 45 | 6 / 6 |
| Time-Lost Sapphire | int_radius_jewel | 24 / 35 | 6 / 6 |
| Time-Lost Diamond | все три radius-тега | 71 / 88 | 6 / 6 |

Что даёт каждый цвет (по пулу RePoE):
- **Ruby** — physical / fire / melee / mace / armour / block / totem / warcry / bleed / ignite / rage / banner.
  Также minion life и AoE, Max Fire Res, life leech, life regen, mana cost → life cost, stun.
  Своих крит-суффиксов нет, поэтому для крит-билдов Ruby почти не берут [S9].
- **Emerald** — bow / crossbow / spear / quarterstaff / projectile / lightning / evasion / accuracy / poison / shock / mark / companion / herald / charm / flask.
  Суффиксы: **Attack Speed**, **Critical Hit Chance for Attacks**, **Critical Damage Bonus for Attack Damage**, Movement Speed, Cooldown Recovery, pierce, fork/chain.
- **Sapphire** — spell / cold / chaos / ES / curse / minion damage / ailment magnitude / trigger / offering.
  Суффиксы: **Critical Hit Chance**, **Critical Damage Bonus** (глобальные), crit for spells, **Cast Speed**, Minion attack/cast speed и minion crit, recoup, mana/life on kill.
- **Diamond** — пул всех трёх цветов. Получить нужную пару модов очень трудно (160 семейств). Получение: на **Reforging Bench**.
  Рецепт из 1 Ruby + 1 Emerald + 1 Sapphire указан на poe2db как Forge recipe [S4][S17]. В другом источнике сказано «любая одна» база (не проверено). Так же делают Time-Lost Diamond из трёх Time-Lost [S3].

Изменения модов в 0.5.0 [S1]: Max Rage на Ruby теперь +1–2, Chaos Damage на Sapphire 7–13%, Banner AoE 6–16%.
Префикс «Fevered» больше не выпадает на Sapphire и Time-Lost Sapphire.
Суффикс ES Recharge больше не выпадает на Jewels.

### 1.2 Слоты, уровни, тиры
- Rare: **2 префикса + 2 суффикса = 4 мода**. Magic: 1+1. Так считает и наш `craft.js` (`perSide = 2`).
  Пятый мод бывает только через крафтовый мод «+1 Prefix/Suffix Modifier allowed» (см. 2.6) или порчу уника (Heart of the Well) [S6][S7].
  На timesaver написано «до 3 префиксов и 3 суффиксов» у Time-Lost [S2]. Это противоречит игровым данным и гайдам по 5-модовым самоцветам, так что считаем это ошибкой (не проверено).
- **У каждого мода самоцвета ровно один тир с широким диапазоном** [R]: у всех модов самоцветов `required_level = 1`.
  Item level на набор модов не влияет. Ролл улучшает только **Divine Orb**.
  Пример: `JewelCriticalChance` (5–15)% increased Critical Hit Chance — один «тир». У радиусного аналога (2–3)%.
- Значения на Time-Lost маленькие, потому что действуют на каждый пассив в радиусе.
  Например, «Small Passive Skills in Radius also grant (2–3)% increased Armour» против (10–20)% Armour на обычном Ruby [R].

### 1.3 Гнёзда на дереве
Самоцвет работает только в выделенном Jewel Socket. Радиус Time-Lost работает только в настоящем гнезде дерева.
Sinister Jewel Sockets (Voices, Zarokh's Gift) отключены от дерева: уники в них не встают, радиус не работает [S4][S2].
Lich (Crystalline Phylactery) принимает non-unique basic jewel и усиливает его. У Sorceress (Baryanic Leylines) +40% к радиусу non-unique Time-Lost [S4].

### 1.4 Time-Lost jewels (радиусные)
- Имплицит `JewelRadiusImplicit` — base radius. Без модов радиус **Small** [R].
  Радиус поднимают **префиксы** «Upgrades Radius to Medium» и «Upgrades Radius to Large».
  На трейде это одна опция-стат `explicit.stat_3891355829|1/|2`; «Very Large» (|3) бывает только крафтом [R][S11].
  **Апгрейд радиуса занимает префиксный слот.**
- Суффиксы «(15–25)% increased Effect of Small Passive Skills in Radius» и «… Notable Passive Skills in Radius» [R].
  Трейд: `stat_1060572482` и `stat_4234573345`. Старый `JewelRadiusNotableEffect` имеет вес 0 и больше не выпадает.
- Остальные моды записаны как «**Small Passive Skills in Radius also grant …**» или «**Notable Passive Skills in Radius also grant …**».
  **Small или Notable не зависит от стороны аффикса.** Проверка RePoE против трейда [R]:
  - префиксы: 48 Small, 21 Notable (ailment / crit-ailment / curse / ignite / poison / shock / bleed magnitude, AoE, ES recharge start, presence AoE, block…);
  - суффиксы: 57 Notable (cast/attack speed, crit chance/bonus, life on kill…), 27 Small (leech, mana regen, shock chance, stun threshold…).
- Всего «… in Radius also grant» статов на трейде 560 (группы explicit / fractured / crafted / desecrated) [R].
- Desecrated-пул Time-Lost (Abyss) — 6+6 модов [R]. Например, «Notable Passive Skills in Radius also grant 1% increased maximum Life / maximum Mana».
  Также Recoup as Life/Mana, Global Defences, Regenerate % Life, Mana Cost Efficiency, flask/charm charges per second.
- Откуда берутся: с 0.5 обычный дроп в мире, magic/rare, drop level 20, чаще на высоких картах [S2].
  Сундук Time-Lost Cache в конце Trial of the Sekhemas — более старые источники [S3] (не проверено для 0.5.5).
  Diamond-версия — только Reforging Bench из трёх Time-Lost [S3][S4].
- Уник на базе Time-Lost Diamond: **Against the Darkness**. Large radius, 2 случайных мода из пула Time-Lost, Limited to 1 [S2][S3].

### 1.5 Порча (Vaal Orb) [R][S3][S4]
- Corrupted-энчант на самоцветах — 1 из 11 вариантов, все одинакового веса: +(4–6) Str / Dex / Int, +(5–10)% Fire / Cold / Lightning Res, +(3–7)% Chaos Res.
  Или иммунитеты: Immune to Maim, You cannot be Hindered, Corrupted Blood cannot be inflicted on you, Cannot be Blinded.
- Остальные исходы как у вещей: ничего (~25%), реролл 1–3 модов, энчант. Сокетов у самоцветов нет [S16].
  «Radius to Large» от порчи упоминает только timesaver [S2]; в списке poe2db его нет. Считаем ошибкой (не проверено).
- **Architect's Orb** работает на уже порченой вещи: 50% второй corrupted-энчант, 50% вещь уничтожена [S16].
- Heart of the Well (уник Diamond): Vaal может дать **5-й мод** [S7].

---

## 2. Валюта и омены на самоцветах

### 2.1 Базовые сферы
- **Transmutation / Augmentation / Regal / Exalted / Chaos / Annulment / Divine** работают как обычно.
  Омены сторон тоже: Sinistral/Dextral Exaltation, Erasure, Annulment, Coronation, Alchemy, а также **Greater Exaltation** (Exalt добавляет два мода).
- **Greater / Perfect** версии (Exalted / Chaos / Regal: мод уровня 35+/50+; Augmentation/Transmutation: 44+/70+) **бесполезны на самоцветах**.
  У всех модов самоцветов уровень 1 [R], подходящих модов нет. Вероятно, сфера не применится или ничего не даст (не проверено в игре).
- **Omen of Whittling** (Chaos удаляет мод самого низкого уровня): у всех модов самоцвета уровень 1, так что фактически снимается случайный мод (не проверено).
- **Divine Orb** — единственный способ поднять ролл. Тиров нет, поэтому реролл идёт по всему диапазону.
- Шанс конкретного мода при chaos-spam: Emerald 74 семейства, поэтому вторая крит-строка выпадает примерно 1 раз из 73. У Time-Lost Emerald ~77 [S5][S9].
  В PoE 2 весов в файлах нет; гайды считают пул равновероятным (не проверено).

### 2.2 Essences
На самоцветы **не ставятся** [R]. В RePoE нет essence-модов с jewel-тегами.
В poe2db tooltip «Equipment» Jewels не включает, это отмечено в `data/crafting-currency.json`. Порченые эссенции и Alloy тоже не ставятся.

### 2.3 Desecration — Preserved Cranium
- Cranium — единственная кость для самоцветов, бывает только Preserved. Нужен Rare.
  Добавляет Unrevealed desecrated-мод; если вещь полная, сначала удаляет случайный мод [S13].
- Раскрытие в Well of Souls: выбор 1 из 3. **Omen of Abyssal Echoes** даёт один реролл тройки.
  **Omen of Sinistral/Dextral Necromancy** ставит мод только префиксом или только суффиксом.
  **Omen of Light** — следующий Annulment снимает только desecrated-мод. Лимит — 1 desecrated-мод на вещь.
  Лич-омены (Sovereign/Liege/Blackblooded) работают только на Weapon/Jewellery, на самоцветы нет.
- Пул desecrated-модов обычных самоцветов [R]: 29 гибридных префиксов «Abyss».
  Например, (5–10)% Armour/Evasion/ES + (4–8)% Spell/Attack/Minion/Thorns/Totem Damage; (4–8)% Fire/Cold/Lightning Damage + Penetrates (4–7)%.
  Ещё: Bleed/Poison chance+magnitude, Companion life+damage, Aura magnitude+Presence AoE, Exposure effect, Abyssal Wasting.
  Суффиксов всего 3: (1–2)% increased Str/Dex/Int.
- **Важно:** при раскрытии предлагаются и **обычные** моды пула. В гайдах desecrated-суффиксом добирают вторую крит-строку, Movement Speed, Attack Speed, Effect of Small/Notable Passives [S5][S10][S12].
  В эксперименте [S10]: 60 Emerald + Dextral Necromancy → 38 успешных, 5 со второй крит-строкой, 2 с MS. Это патч 0.3.
- Цена Cranium ~1.6 div в июне [S12] (на 2026-10-17 не проверено).

### 2.4 Refined Catalysts (качество самоцветов)
- С 0.5.0 на самоцветы есть отдельный набор **Refined** катализаторов [S1][S14]. Они добавляют quality, которая усиливает моды своего тега, и заменяют другой тип quality.
  - Refined Flesh — Life; Refined Neural — Mana; Refined Carapace — Armour/Evasion/ES
  - Refined Uul-Netol's — Physical; Refined Xoph's — Fire; Refined Tul's — Cold; Refined Esh's — Lightning; Refined Chayula's — Chaos
  - Refined Reaver — Attack; Refined Sibilant — Caster; Refined Skittering — Speed
  - Refined Adaptive — Attribute; Refined Necrotic — Minion (появился в 0.5.2)
- С 0.5.0 катализаторы не падают с монстров, они только из Genesis Tree (Breach). Alternate-quality вещи можно разобрать и вернуть часть катализаторов [S1].
- **Omen of Catalysing Exaltation**: следующий Exalted Orb тратит всё catalyst-quality и повышает шанс мода этого типа [S14].
  Для Refined на самоцветах прямо не подтверждено (не проверено). Гайды советуют Refined Reaver для атакующих самоцветов и Refined Sibilant для кастерских [S5].
- В расширенном тексте (Ctrl+Alt+C) мод под качеством помечен «— 40% Increased». Наш парсер это учитывает (`boostLine`).
  Предел качества на самоцветах — 20% (не проверено).

### 2.5 Liquid Emotions (Delirium) — главный инструмент крафта самоцветов в 0.5
С 0.5.0: «Liquid Emotions can now be used to craft additional mods on Jewels» [S1].
**Каждая эмоция удаляет случайный мод с Rare-самоцвета и добавляет гарантированный Crafted-мод.**
Мод зависит от эмоции и цвета базы [S11][S15]. На вещи может быть только **1 crafted-мод** (0.5.0).
Обычные эмоции работают на Rare basic jewels (Ruby/Emerald/Sapphire/Diamond), **Ancient** — только на Rare Time-Lost.

Обычные самоцветы (Diluted → Liquid → Concentrated → Potent) [S15], формат Ruby / Sapphire / Emerald:
- Diluted Ire / Guilt / Greed — Armour / ES / Evasion %; Fire / Cold / Lightning %; Phys / Chaos / Elemental %.
- Liquid Paranoia — Attack Dmg / **Cast Speed** / **Attack Speed**.
- Liquid Envy — mana→life cost / Spell Dmg / CDR. Disgust — life regen / mana on kill / life on kill.
  Despair — Rage on hit / **Spell Crit Chance** / **Attack Crit Chance**.
- Concentrated Fear — Warcry speed / **Spell Crit Bonus** / **Attack Crit Bonus**. Suffering — Max Rage / AoE / **Movement Speed**.
  Isolation — Max Fire / Cold / Lightning (Diamond: Max Chaos, `CraftedJewelMaximumChaosResistance` [R]).
- **Potent Melancholy** — Debilitate / Exposure / Blind on Hit, если на дереве есть самоцветы двух других цветов [R][S15].
- **Potent Ferocity** — крафтовый **префикс** «(40–60)% increased Effect of Suffixes» или суффикс «(40–60)% increased Effect of Prefixes» [R].
  Трейд: `stat_2475221757` и `stat_1443502073`. **Это главный множитель цены**: крит-суффиксы получают +40–60%.
- **Potent Contempt** — крафтовый префикс «+1 Suffix Modifier allowed» или суффикс «+1 Prefix Modifier allowed» [R].
  Отдаёт слот одной стороны и даёт третий мод на другой. Так получается «5-line» с тремя хорошими суффиксами.
  Трейд: `stat_718638445` и `stat_3182714256`. Цена Potent Contempt ~1/1.5 div по poe2db (дата снимка неизвестна).

Time-Lost (Ancient, нужен Delirium Atlas Tree) [S1][S15]:
- Ancient Ire / Guilt / Greed / Paranoia / Envy / Disgust / Despair / Fear / Suffering — те же темы в форме «Small/Notable Passive Skills in Radius also grant …».
  Например, Ancient Despair (Sapphire) — Notable: Spell Crit Chance; Ancient Fear (Emerald) — Notable: Attack Crit Bonus.
- Ancient Isolation — конверсия урона в радиусе.
- **Ancient Potent Melancholy** — «Upgrades Radius to Very Large» (крафтовый префикс) [R][S11].
- **Ancient Potent Ferocity** — Notable: Max Fire / Cold / Lightning / Chaos Res (`CraftedJewelRadius*Resistance` [R]).
- **Ancient Potent Contempt** — +1 Prefix/Suffix Modifier allowed. Drop level 65, ~5.4 div за 24 ч по poe2db [S11].
- В 0.5.5 исправлен баг: Atlas-пассив «I know your childhood fears…» ронял Ancient Liquid Emotions [S18]. С тех пор Ancient-эмоции, вероятно, стали реже и дороже (не проверено).

### 2.6 Прочее
- **Fracturing Orb** фиксирует случайный мод; нужно 4+ мода. На самоцветах это 4 мода, шанс попасть в нужный 1/4, а с desecrated-модом в базе ~1/3 [S12].
  **Hinekora's Lock** перед дорогими шагами позволяет посмотреть исход.
- Moды «(Jewel)» на трейде: «Recover #% of maximum Mana on Kill (Jewel)» — это `stat_1604736568`, отдельный от обычного `stat_1030153674` [R].

---

## 3. Рецепты (по гайдам 0.5; цены — на дату гайда)

**A. Крит-самоцвет Emerald/Sapphire из 3-мода (дёшево, 0.3, [S10])**
1. Купить Rare с двумя полезными префиксами и одной крит-строкой в суффиксах.
2. Omen of Dextral Necromancy + Preserved Cranium: desecrated-суффикс. Если он снял крит-строку — в мусор.
3. Omen of Abyssal Echoes, затем раскрытие: ищем вторую крит-строку или Movement Speed.
4. В эксперименте ~15 div ушло на 60 баз, профит 60–70 div. Это экономика 0.3.

**B. «5-line» (три хороших суффикса + Ferocity/Contempt), 0.5 [S5][S6]**
1. База с fractured крит-суффиксом (≈1 div). Для Time-Lost: fractured Notable crit bonus/chance, фильтр «crafted: no».
2. Chaos-spam + Omen of Dextral Erasure на второй крит-суффикс (~1/73).
3. Dextral Necromancy + Cranium на третий суффикс (Attack Speed, MS, Effect of Notable/Small). Промах снимается Omen of Light + Annulment.
4. Chaos-spam на префиксы (Shock magnitude, ailment magnitude и т.п.).
5. **Potent Liquid Contempt** (или Ferocity) в конце. Эмоция снимает случайный мод — по гайдам это «чистые 50/50». Перед ней Hinekora's Lock.
6. Стоимость: ~60 div (около 8 попыток по ~6 div + база), при обычной удаче до ~150 div. На пару «обычный + Time-Lost» закладывают ~300 div. Каждая неудачная desecration ~15–16 div [S5][S6].
   Вариант дешевле: купить самоцвет с нужными суффиксами и плохой desecration/префиксами и переделать [S6].

**C. Time-Lost Sapphire «large radius + notable crit» [S12], июнь 2026**
1. Купить ≥5 Rare Time-Lost Sapphire с Large radius без fractured/corrupted/desecrated (25–40 ex каждая).
2. Cranium: Large + 2 мода + 1 desecrated.
3. Fracturing Orb, чтобы зафиксировать Large (~1/3).
4. Annulment до одного лишнего мода, затем chaos-spam.
   Цели: Notable crit chance, Notable crit bonus, Effect of Small/Notable Passives. Потом Divine.
5. Себестоимость ~9 div, оценка 50–60 div.
6. Финал: Ancient Potent Melancholy (Very Large) или Ancient Contempt.

---

## 4. Оценка

### 4.1 Что дорого
- **Обычные самоцветы:** почти всю цену дают **суффиксы**.
  - Emerald: Attack Crit Chance + Attack Crit Bonus + Attack Speed.
  - Sapphire: глобальные Crit Chance + Crit Bonus (+ Cast Speed / ES).
  - Minion: Minion Attack and Cast Speed, Minion Crit.
  - Множители цены — **Effect of Suffixes** (Ferocity) и третий суффикс (Contempt).
  Префиксы — урон своего архетипа (projectile, spell, elemental, shock/ailment magnitude), но они вторичны.
  У Ruby нет крит-строк, поэтому он в основном дешёвый [S9].
- **Time-Lost:** сначала радиус (Large / Very Large; Large с двумя приличными notable может быть лучше Medium с тремя [S2]).
  Затем ≥2 мода, которые масштабируют билд: Notable crit chance/bonus, Notable cast/attack speed, crit-ailment magnitude, curse AoE.
  Плюс Effect of Notable/Small Passives. Одна полезная Notable на Medium — <1 div; две — несколько div; god-roll — двузначные div (июль, [S2]).
- **Уники** (poe.ninja Forbidden Rites, 2026-10-17, нижняя цена без учёта роллов) [T]:

| Уник | Цена, div | Лотов |
|---|---|---|
| Voices (Sapphire) | 1199 | 72 |
| Grand Spectrum Ruby | 36 | — |
| Against the Darkness | 8.5 | 1771 |
| The Adorned | 7 | — |
| Grand Spectrum Emerald | 4.7 | — |
| Controlled Metamorphosis | 4 | — |
| Grand Spectrum Sapphire | 2 | — |
| Undying Hate | 1 | — |
| Heroic Tragedy | 0.67 | — |
| Heart of the Well | 0.54 | — |
| Megalomaniac | 0.09 | — |
| From Nothing | 0.1 | — |
| Prism of Belief | ~0 | — |

  У Megalomaniac (с 0.5 падает identified), Heart of the Well, Timeless-самоцветов и Against the Darkness цена **целиком в роллах**.
  Heart of the Well: 4 мода с Extra Fire/Cold/Lightning + 2 крит-строки — ~100–185 div, чистый 5-мод — сотни и тысячи div (август, [S7]).
  Оценивать их по одной цене poe.ninja нельзя.

### 4.2 Живой трейд, Forbidden Rites, 2026-10-17 [T]
Поиск instant buyout + online, 10 самых дешёвых лотов, класс jewel, nonunique:

| Запрос | Лотов | 10 самых дешёвых |
|---|---|---|
| Emerald: Atk Crit Chance + Atk Crit Bonus + Attack Speed | 344 | 1, 105, 125, 150, 220…277 div — реальный пол ~100+ div |
| Emerald: Atk Crit Chance ≥10 + Atk Crit Bonus ≥20 | 1487 | 1–3 div |
| Emerald: Effect of Suffixes + Atk Crit Bonus | 1864 | 15–20 div |
| Sapphire: Crit Chance + Crit Bonus + Effect of Suffixes | 1777 | 25–35 div |
| Time-Lost: Notable Crit Bonus + Notable Crit Chance | 1180 | 20–28 div |
| Time-Lost: «Very Large» | 10000+ | 8 chaos (сам по себе дёшев) |

Выводы: **две** крит-строки — массовый товар (1–3 div). Цена прыгает на **третьем** ключевом суффиксе или на Ferocity.
1 div ≈ 746–790 ex на октябрь [S8].

### 4.3 Как прайсчекать
- Искать по **количеству ключевых строк**, а не по всем модам. На самоцветах 4–5 строк, и 1–2 мусорных префикса почти не снижают цену.
  Удобно «count» группой: N из [крит-строки, AS/CS, Effect of Suffixes].
- Для Time-Lost обязательно фильтровать радиус: `stat_3891355829` с опцией 2/3 или 1/2/3. Ищем «Notable …» и «Small …» как **отдельные** статы, а не обычные.
- Ferocity и Contempt — crafted-строки (группа `crafted.stat_*`). Убедиться, что ищем crafted-версию или pseudo.
- Мусорные лоты «1 div» на дорогих запросах — прайс-фиксеры, отбрасывать.
- Megalomaniac, Timeless, Heart of the Well, Against the Darkness — искать по конкретным модам/нотаблам, не по названию.

---

## 5. Что это значит для нашего приложения

Как сейчас: `craft.js` берёт моды `misc` как `item` (верно); 2+2 для тега `jewel` (верно); правку «±N Modifier allowed» парсит (верно).
Кость Cranium только Preserved (верно), лич-омены на самоцветах не советуем (верно). Совет «Refined Catalyst» есть.
Пробелы:

1. **Time-Lost: текст радиусных модов в RePoE урезан.** У `JewelRadiusArmour` текст «(2-3)% increased [Armour]», а в игре и на трейде «Small Passive Skills in Radius also grant …».
   Последствия:
   - (a) `tradeStats()` → `statFor("2% increased Armour")` находит **обычный** `stat_2866361420` вместо `stat_3858398337`. Цена «после крафта» для Time-Lost считается по чужому стату.
   - (b) Спрос (`want`) берётся по строке глобального мода и сильно завышает спрос на радиусные моды.
   - (c) `own` (строки вещи) не совпадает с `m.lines`.

   Исправление: для модов с тегами `*_radius_jewel` подставлять префикс «Small/Notable Passive Skills in Radius also grant ».
   Выбирать между Small и Notable по наличию стата в `stats.json`: проверено, двусмысленных случаев 0. Сторона аффикса **не** определяет Small/Notable.
   Исключения: «Upgrades Radius to …», «Effect of Small/Notable Passive Skills in Radius», `JewelRadiusIncisionChance`, `JewelRadiusDazeBuildup`, `JewelRadiusSlowEffectOnSelf`.
   У последних трёх не нашлось ни Small, ни Notable стата; нужна ручная проверка.
2. **Greater/Perfect сферы на самоцветах бесполезны.** Все моды уровня 1.
   Сейчас советуем «Greater / Perfect Exalted / Regal / Augmentation / Chaos (35+/50+…)» — для тега `jewel` эти строки надо убрать.
   Whittling на самоцветах снимает фактически случайный мод: не советовать как прицельный.
3. **Liquid Emotions не советуем вообще**, а это основной крафт самоцветов 0.5. Добавить секцию для Rare-самоцветов, если нет crafted-мода:
   - Potent Ferocity — «+40–60% Effect of Suffixes», если хороши суффиксы; Potent Contempt — третий суффикс.
   - Цветовые эмоции (Paranoia — AS/CS, Despair/Fear — крит, Suffering — MS) — как гарантированный мод **вместо случайного**.
   - Для Time-Lost — Ancient-эмоции (Very Large radius и т.д.).
   Предупреждение: «снимает случайный мод — сначала Hinekora's Lock». Данные — `CraftedJewel*` в RePoE (домен `misc`, `spawn_weights` пустые, поэтому их пул сейчас корректно не попадает).
   Привязку «эмоция → мод → цвет» придётся вписать вручную, например в `data/crafting-currency.json`.
4. **Desecration на самоцветах**: показываем только `desecrated`-домен — гибридные префиксы и 3 суффикса на атрибуты.
   Раскрытие предлагает и обычные моды (крит, MS, Effect of Passives) [S5][S10]. Для самоцветов кандидаты надо показывать из обоих пулов (с пометкой «не проверено» про точную механику).
   Советовать Omen of Abyssal Echoes и Necromancy на нужную сторону.
5. **Omen of Catalysing Exaltation** сейчас упомянут только для колец и амулетов. Для самоцветов добавить к совету Refined Catalyst, перечислив 13 типов (Reaver — атака, Sibilant — каст, Necrotic — миньоны, Skittering — скорость).
6. **Порча**: можно показывать список 11 corrupted-энчантов самоцвета. Для Heart of the Well отметить шанс 5-го мода.
7. **Трейд-стат «(Jewel)»**: «Recover #% of maximum Mana on Kill» на самоцвете должен искаться как `stat_1604736568`, а `stats.lookup` найдёт `stat_1030153674`.
   Нужен суффикс-вариант « (Jewel)» в индексе по аналогии с « (Local)» (для класса Jewels).
8. **Ценообразование**:
   - Для Time-Lost всегда включать фильтр радиуса (опция-стат `3891355829`, проверить, что variant-логика pricing.js его отдаёт).
   - По умолчанию «count» по ключевым суффиксам. Ferocity/Contempt искать в группе crafted.
   - Ruby / Emerald / Sapphire / Diamond в одной категории `jewel` — это нормально, если фильтры по модам.
   - Для уников-самоцветов цена poe.ninja — это пол; для Megalomaniac, Timeless, Heart of the Well, Against the Darkness предупреждать, что цена в роллах.
9. Мелочь: `tierUps` / «слабый тир» на самоцветах не срабатывает, у них всегда 1 тир — это верно. Но в UI стоит писать «улучшить ролл — Divine Orb», а не «тир».

---

## 6. Источники
- [S1] Официальные патч-ноты 0.5.0 (Return of the Ancients), форум PoE, ~2026-05-22/29: https://www.pathofexile.com/forum/view-thread/3932540 (jewel-строки процитированы).
- [S2] timesaver.gg, PoE2 Time-Lost Jewels Guide (0.5), 2026-07-31: https://timesaver.gg/blog/poe2-time-lost-jewels-guide (магазин; цены — оценки).
- [S3] poe2db Time-Lost Diamond: https://poe2db.tw/us/Time-Lost_Diamond (просмотрено 2026-10-17); game8 Time-Lost: https://game8.co/games/Path-of-Exile-2/archives/493122.
- [S4] poe2db Jewels / Diamond: https://poe2db.tw/us/Jewels, https://poe2db.tw/us/Diamond (2026-10-17).
- [S5] Mobalytics, «The ULTIMATE 5 Line Jewel Craft Guide — 3 Methods» (0.5; страница отдала 403, содержание по выдаче поиска): https://mobalytics.gg/poe-2/profile/gl1tch3d/guides/the-ultimate-5-line-jewel-craft-guide-3-methods
- [S6] mmoexp, 5-mod jewel guides (0.5; по выдаче поиска): https://www.mmoexp.com/News/poe-2-0-5-jewel-crafting-guide-how-to-craft-insane-5-mod-endgame-jewels-for-any-build.html , https://www.mmoexp.com/News/poe-2-jewel-crafting-guide-craft-five-mod-jewels-for-50-divines-less.html
- [S7] timesaver.gg, Heart of the Well guide, 2026-08-17: https://timesaver.gg/blog/poe2-heart-of-the-well-guide
- [S8] Курс div/ex: timesaver tablet guide 2026-10-09 (~790 ex), poeoverlay (~746 ex, 2026-10-17): https://timesaver.gg/blog/poe2-tablet-prices-which-mods-worth-divines-0-5-5 , https://www.poeoverlay.com/market-history/poe2/forbidden-rites/currency
- [S9] u4gm / mmojugg jewel guides 0.5 (по выдаче поиска; Ruby без крита, Emerald 74 мода): https://www.u4gm.com/path-of-exile-2/blog-path-of-exile-2-0.5-jewel-crafting-guide
- [S10] poe2fun, Emerald Jewel Crafting (0.3.0): https://poe2fun.com/guides/poe2-emerald-jewel-crafting-guide
- [S11] poe2db Ancient Potent Liquid Contempt / Potent Liquid Contempt (2026-10-17): https://poe2db.tw/us/Ancient_Potent_Liquid_Contempt , https://poe2db.tw/us/Potent_Liquid_Contempt ; game8 Ancient Potent Liquid Melancholy: https://game8.co/games/Path-of-Exile-2/archives/603306
- [S12] exile.codex-wiki, Time-Lost jewels crafting breakdown (0.5, 2026-06-24): https://exile.codex-wiki.com/builds/poe2-time-lost-jewels-complete-crafting-breakdown
- [S13] game8 Desecrated Modifiers and Abyss Crafting: https://game8.co/games/Path-of-Exile-2/archives/547417 ; timesaver Desecrated currency (0.5.3): https://timesaver.gg/blog/poe2-desecrated-currency-guide
- [S14] poe2db Catalysts (Refined, Omen of Catalysing Exaltation), 2026-10-17: https://poe2db.tw/us/Catalysts ; timesaver catalysts (0.5.2, 2026-06-24): https://timesaver.gg/blog/poe2-catalysts-guide
- [S15] aoeah, Liquid Emotions in PoE 2 0.5 (2026-06-12): https://www.aoeah.com/news/4633--how-to-get-and-use-liquid-emotions-in-poe-2-05
- [S16] timesaver Vaal Orb guide (2026-07-22) / Double corruption (0.5.3): https://timesaver.gg/blog/poe2-vaal-orb-guide , https://timesaver.gg/blog/poe2-double-corruption-guide
- [S17] Diamond на Reforging Bench: https://www.sportskeeda.com/mmo/path-exile-2-how-craft-diamond-jewel-pearlescent-amulets , https://www.ezg.com/blog/poe-2-patch-0-5-0-crafting-guide-how-to-make-diamond-jewels-and-pearlescent-amulets
- [S18] Официальные патч-ноты 0.5.5, 2026-09-03: https://www.pathofexile.com/forum/view-thread/4000864 (по самоцветам только фиксы Prism of Belief / From Nothing и Ancient Emotions).
- [T] poe.ninja API `poe2/api/economy/stash/current/item/overview?league=Forbidden Rites&type=UniqueJewels` и trade2 search/fetch, 2026-10-17.
- [R] RePoE (repoe-fork.github.io/poe2) и trade `data/stats` из кэша приложения, 2026-10-17.
