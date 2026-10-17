# PoE 2 — коррупция, Sanctify и другие «последние шаги» (для вкладки Craft)

- **Актуально для:** патч **0.5.5** (лига **Forbidden Rites**) + Standard. Механика коррупции/Sanctify менялась в **0.5.0** (Runes of Aldur) и **0.5.4** (Orbs of Sacrifice); в 0.5.5 по этим темам изменений нет [PN055].
- **Составлено:** 2026-10-17. Данные для кода — `data/gamble-currency.json`.
- **Метки достоверности:** **[офиц.]** — патчноут или текст предмета (poe2db); **[сообщ.]** — гайды сообщества (Maxroll/Game8/Timesaver/U4N), часто коммерческие; **[не проверено]** — один слабый источник или противоречия.
- **Главное:** GGG **не публикует** шансы исходов Vaal Orb. Все «~25%» ниже — оценки сообщества.
- Недоступны при сборе: maxroll.gg (обрыв соединения, есть только сниппеты поиска), poe2wiki.net (Anubis), mobalytics (403).

## 1. Vaal Orb

**Текст [офиц., DB_VAAL]:** «Modifies an item unpredictably and Corrupts it» / «Right click this item then left click an item to corrupt it. Corrupted items cannot be modified again.» Стак 20, drop level 35. Цена ≈ 1/57 Divine [PRICES].

**Что изменилось в 0.5.0 [офиц., PN050]:**
- «The Corruption outcome that randomises the numeric values of the modifiers on an item beyond the normal range» — теперь **умножает каждый мод от его текущего значения**, а не перекатывает случайно. То есть хорошо прокатанный уник после такого исхода в среднем остаётся хорошим, плохой — плохим.
- «Omen of Corruption can no longer be obtained.» На Currency Exchange — только в Standard.

**Исходы — снаряжение Rare/Magic** (один исход за раз, не комбинация) [сообщ., TS_VAAL ссылается на Game8; TS_DC]:

| Исход | Шанс | Что происходит с ценой |
|---|---|---|
| Без изменений (только тег Corrupted) | ~25% | Обычно −10…−30%: вещь «заморожена», покупатель её не докрафтит |
| Corruption enchant (строка-энчант, пул по классу — §8) | ~25% | От «ноль» до кратного роста: MS на ботинках, +1 к скиллам на амулете, +1 Max Res и т.п. |
| Моды меняются: 1–3 случайных «reforge»-шага (моды заменяются/перекатываются) | ~25% | Чаще всего **ломает** вещь; на хорошей rare — главный риск [не проверено: точная механика] |
| +1 Augment-гнездо **сверх обычного лимита** (броня, щиты/баклеры/фокусы, martial-оружие) | ~25% | Хороший исход для нательника/двуручки (лишняя руна) |
| Wands/Staves: вместо гнезда — качество до ~23% | ~25% | Слабый плюс [не проверено после 0.5: Artificer's Orb теперь работает на wand/staff] |
| Amulets/Rings/Belts: гнезда нет → ветка «без изменений» удваивается | ~50% «ничего» | [не проверено, только сниппет поиска] |

**Исходы — Unique** [сообщ., U4N, MAXROLL-сниппет, TS_DC]: ~25% без изменений; ~25% corruption enchant; ~25% +1 гнездо (оружие/броня; на бижутерии — ничего); ~25% значения модов **×0.78…×1.22 от текущего**, шаг 0.01, с округлением. Правило «от текущего» — [офиц.], диапазон — [сообщ.].

**Исходы — Jewels** [сообщ., U4N]: обычные (rare/magic) — без изменений / enchant / переролл до 3 модов / +1 или −1 мод (можно выйти за обычный лимит аффиксов); уникальные — без изменений (два слота «ничего», ~50%) / enchant / значения ×0.78…1.22.

**Skill Gems** [сообщ., TS_VAAL]: без изменений; +1 уровень (~12.5%); −1 уровень (~12.5%); ±1 гнездо поддержки; сдвиг качества −7…+3% (потолок ~23%). Второй раз — **Crystallised Corruption** («Modifies a Corrupted Skill Gem unpredictably or destroys it» [офиц.]).

**Waystones** [сообщ., TS_VAAL]: без изменений; ±1 тир (T1–T16); все аффиксы становятся префиксами или суффиксами; добавляются случайные аффиксы. Шансы не опубликованы. Самое «безопасное» применение Vaal.

**Монстры-эссенции** [сообщ., старый gamerant + crafting-notes.md]: больше эссенций / смена типа / апгрейд до corrupted-эссенции (Hysteria, Delirium, Horror, Insanity, Abyss, Breach). Атласная опция **Archaic Corruption** (0.5.5) — монстры-эссенции становятся Corrupted [PN055].

**Важно для «гнёзд»:** обычные руны в пустое гнездо Corrupted-вещи вставлять можно, но с 0.5.4 **9 мета-рун** нельзя вставить в Corrupted или Sanctified вещь: Astrid's Creativity, Katla's Gloom, Kolr's Hunt, Medved's Tending, Raven-Touched Shard, Serle's Triumph, Thrud's Might, Uhtred's Sidereus, Vorana's Carnage [офиц., PN054]. Их нужно ставить **до** коррупции.

## 2. Vaal Infusers (4 типа, 0.5.0)

[офиц., PN050 + тексты DB_CUR] «There are now 4 types of Infusers… All Infusers can only be used on items at or above 20% Quality.» Общий текст: «Improves the quality of … exceeding maximum quality by up to 10% with a chance of Corrupting it».

| Infuser | На что | Цена [PRICES] |
|---|---|---|
| Vaal Armourer's Infuser | «an Armour» — Body Armours, Helmets, Gloves, Boots, Shields, Bucklers, Foci | ~1.4 Div |
| Vaal Blacksmith's Infuser | «a Martial Weapon» | ~0.55 Div |
| Vaal Arcanist's Infuser | «a wand, staff or sceptre» | ~0.27 Div |
| Vaal Catalysing Infuser | «a ring or amulet» (в патчноуте — «Jewellery»; Belts — [не проверено]) | ~6.5 Div |

- Всегда добавляет качество (+1%, иногда +2%), до 30% без других источников [сообщ., WIKI_INF-сниппет].
- Коррупция от Infuser — **только тег Corrupted**, без случайных изменений; шанс растёт с текущим качеством (~+5% за пункт выше 20%; первое применение на ровно 20% не коррумпирует) [не проверено].
- Ценность: +10% качества = +~10% к локальной защите/физ. урону (броня/оружие) или +10% к модам catalyst-тега (бижутерия). Это «финальный» шаг: после коррупции вещь не крафтится, но и не ломается.

## 3. Омены и «двойная» коррупция

| Предмет | Текст [офиц.] | Доступность / заметки |
|---|---|---|
| Omen of Corruption | «…your next Vaal Orb will always result in change» (id `OmenOnVaalRemoveDoNothingOutcome`) | **Не добывается** с 0.5.0, на бирже только в Standard [PN050] |
| Omen of Sanctification | «…your next Divine Orb used on a Rare item will Sanctify it» | Ritual; ~0.92 Div |
| Omen of the Blessed | «…your next Divine Orb will only reroll Implicit Modifiers» | ~0.26 Div. На Corrupted/Sanctified не применить (Divine запрещён) |
| Omen of Putrefaction | «…next Desecration attempt will replace all modifiers on the item creating an item with up to 6 Unrevealed modifiers and Corrupting the item» | Коррумпирует вещь |
| Architect's Orb | «Modifies a Corrupted Equipment or Jewel item unpredictably or destroys it» | Twice Corrupted: ~50% второй enchant (не из уже имеющейся группы) / ~50% вещь уничтожена [сообщ., TS_DC]. ~8.75 Div. Temple of Atziri / Atziri's Vault |
| Yaomac's / Kopec's / Kamasa's / Yugul's Orb of Sacrifice | «Upgrades a Corruption Enchantment on a Rare Weapon or Quiver / Armour / Amulet, Ring or Belt / Jewel and removes a random Modifier» | 0.5.4: «These currencies upgrade Corrupted Enchantments on items, at the cost of randomly removing an Explicit Modifier» [PN054]. Только Rare. Fractured-моды не удаляются [сообщ.]. Цены: Kopec's ~2.9 Div, Kamasa's ~3 Div, Yaomac's ~2 Ex (тонкий рынок) |
| Vaal Cultivation Orb | «Replaces up to 2 modifiers on a Corrupted Vaal Unique / Replaces other Uniques with a Corrupted Unique of the same Item Class» | Для уников, ~1.7 Div |
| Essence of Insanity | «Belt: On Corruption, Item gains two Enchantments» | Только пояс; мод эссенции занимает crafted-слот. Что будет при «no change» — [не проверено] |

Примеры улучшенных энчантов после Orb of Sacrifice (poe2db «Corrupted Upgrade Mods /190» [DB_SAC]): Bow Attacks fire 2 additional Arrows; Loads 2 additional bolts; (6—9)% additional Physical Damage Reduction (Body Armour); +(15—35)% to all Elemental Resistances (Ring/Amulet); (40—60)% increased Damage (Ring/Quiver); Allies in your Presence deal (50—75)% increased Damage (Sceptre); (50—75)% chance to Pierce an Enemy (Quiver).

На трейде есть отдельные фильтры **Corrupted**, **Sanctified**, **Twice Corrupted** [TRADE].

## 4. Sanctification (Divine Orb + Omen of Sanctification)

- **Как:** активировать Omen of Sanctification, применить Divine Orb к **Rare**-вещи. Омен расходуется [офиц.].
- **Эффект [офиц., PN050]:** «Sanctifying an item now multiplies each modifier value based on the current value, instead of randomising values.» Вещь получает тег **Sanctified** и дальше не модифицируется (как Corrupted).
- **Диапазон [сообщ., TS_SANCT ссылается на хотфикс 0.5.1; в официальной ветке не найдено]:** ×0.78…×1.22, шаг 0.01 (45 значений), **каждый мод независимо**, округление вверх. Благодаря «от текущего» максимальный мод может стать выше обычного максимума до +22%.
- **Распределение на один мод [сообщ.]:** ~49% хуже, ~2% как было, ~49% лучше, ~38% выше обычного максимума (если мод был на максимуме). На вещи с 5–6 модами почти всегда «часть вверх, часть вниз».
- **Совместимость [сообщ.]:** Corrupted-вещь нельзя Sanctify, Sanctified-вещь нельзя коррумпировать; повторить Sanctify нельзя. Мета-руны (список в §1) в Sanctified-вещь не вставляются [офиц., PN054].
- **Риск:** любой мод может упасть до −22%, навсегда. Баг-репорт: мод руны Medved's Tending упал с 20% до 4% [FORUM_SANCT, не подтверждено GGG].
- **Порядок:** сначала Divine до максимумов (дёшево и обратимо), потом Sanctify. Стоимость попытки ≈ 1 Divine + Omen (~0.9 Div).
- **Цена результата:** Sanctified с «плюсом» выше максимума — премиум-категория; с минусом — дешевле обычной вещи, потому что её уже нельзя довести Divine'ом [сообщ.].

## 5. Tainted-валюта

В PoE2 0.5 **нет** Tainted-валюты (Tainted Chaos / Exalted / Divine и т.п. — это PoE1): в poe2db Stackable Currency нет ни одного предмета «Tainted» [DB_CUR]. Для работы с Corrupted-вещами в PoE2 есть только Architect's Orb, Orbs of Sacrifice, Crystallised Corruption (гемы), Vaal Cultivation Orb (уники), Core Destabiliser (Soul Cores), Ancient Infuser (Tablets). Chaos/Exalted/Divine/Annulment к Corrupted-вещам **не применяются**.

## 6. Другие «азартные» шаги на финише

- **Fracturing Orb** [офиц.]: «Fracture a random modifier on a rare item with at least 4 modifiers, locking it in place.» Риск — зафиксировать случайный ненужный мод (шанс нужного ≈ 1/число модов). ~6.7 Div. С 0.5.0 падает только через атласную специализацию [PN050].
- **Hinekora's Lock** [офиц.]: «Allows an item to foresee the result of the next Currency item used on it / Modifying the item in any way removes the ability to foresee». По сообществу показывает и исход Vaal Orb, и Sanctify [сообщ., TS_LOCK; в PoE1 был баг с алтарём коррупции]. Цена ~2000 Div — только для «зеркальных» вещей. Предвидение одноразовое: посмотрели, не понравилось — Lock нужен новый.
- **Orb of Chance** [офиц.]: «Unpredictably either upgrades a Normal item to Unique rarity or destroys it». Omen of Chance — не уничтожит; Omen of the Ancients — случайный уник того же класса. Шанс нужного уника не опубликован.
- **Chaos/Exalted/Annulment/Divine на Corrupted** — нельзя (тег Corrupted блокирует).

## 7. Практика: когда коррумпировать и что с ценой

- **Да, стоит:** Waystones (T15→T16, дёшево); запасные гемы (шанс +1 уровня / +1 гнезда поддержки); дешёвые уники пачкой (ищем enchant / +гнездо / ×1.22); готовые rare, которые и так продаются дёшево (потеря маленькая, а MS-энчант на ботинки или +1 гнездо на нательник/двуручку — большой плюс).
- **Скорее нет:** почти готовая дорогая rare — ~25% «reforge» ломает её, ~25% «ничего» снижает цену (вещь больше не докрафтить). Ожидаемая цена обычно ниже, чем «продать как есть».
- **Порядок:** всё обратимое — до коррупции: Divine, качество 20% (+ Infuser, если нужно), руны (особенно мета-руны), Artificer's Orb. Vaal — последним.
- **Цена на трейде [сообщ., общая практика]:** Corrupted без полезного энчанта/гнезда продаётся дешевле некоррумпированного аналога (нет «потенциала»). Corrupted с ценным энчантом — дороже, иногда кратно. Twice Corrupted с двумя хорошими энчантами — отдельный премиум-рынок. Для сравнения цен на трейде фильтр Corrupted нужно ставить так же, как у оцениваемой вещи.
- **Sanctify** — только на почти идеальной вещи, где худший случай (все моды ×0.78) ещё приемлем.

### Предлагаемый блок «Рискованный последний шаг» для вкладки Craft

> **Необратимо.** Шансы — оценки сообщества, GGG их не публикует.
> - **Vaal Orb** (~1/57 Div): ~25% ничего (вещь заблокирована, цена обычно падает), ~25% энчант (пул ниже), ~25% моды перекатываются (часто ломает вещь), ~25% +1 гнездо сверх лимита (на бижутерии — нет; на wand/staff — качество).
> - На уникальной вещи вместо переката: значения ×0.78–1.22 от текущих.
> - Перед Vaal: Divine, качество, руны (мета-руны после коррупции не вставить).
> - **Sanctify** (Divine + Omen of Sanctification, ~2 Div): каждый мод ×0.78–1.22 от текущего, вещь заблокирована. Только на почти идеальной вещи.
> - **Vaal Infuser** (качество ≥ 20%): до +10% качества, может только заблокировать вещь (без других изменений).
> - Omen of Corruption в лиге не добывается. Tainted-валюты в PoE2 нет.
> - Показывать «ожидаемо ≈ X Div» только как грубую оценку: цена энчанта сильно зависит от строки.

## 8. Пулы corruption-энчантов по классам

Источник: локальный RePoE (`generation_type: corrupted`, для Jewels — домен `misc`), совпадает со списком poe2db «Corrupted Mods /125» [REPOE, DB_VAAL]. Все строки внутри класса имеют вес 1 (равновероятны); «(only X bases)» — только на базах с этим типом защиты (на гибридных str/dex/int-базах защитного энчанта нет). Тот же список лежит в `data/gamble-currency.json → corruptedEnchants`.

- **Body Armours:** (15-25)% increased Armour (only str_armour bases); (10-20)% reduced Attribute Requirements; (3-5)% additional Physical Damage Reduction; (10-20)% of Damage taken Recouped as Life; (10-20)% of Damage taken Recouped as Mana; +1% to all Maximum Elemental Resistances; +(30-40) to maximum Life; (40-50)% increased Thorns damage; +(13-19)% to Chaos Resistance; (15-25)% increased Evasion Rating (only dex_armour bases); (15-25)% increased Energy Shield (only int_armour bases); (15-25)% increased Armour and Evasion (only str_dex_armour bases); (15-25)% increased Armour and Energy Shield (only str_int_armour bases); (15-25)% increased Evasion and Energy Shield (only dex_int_armour bases)
- **Helmets:** (15-25)% increased Armour (only str_armour bases); (10-20)% reduced Attribute Requirements; +(1-3)% to Maximum Cold Resistance; +(20-30) to Spirit; +1 to Maximum Power Charges; +(50-100) to Accuracy Rating; (15-25)% increased Life Regeneration rate; (20-30)% increased Mana Regeneration Rate; +1 to Level of all Minion Skills; (15-25)% increased Evasion Rating (only dex_armour bases); (15-25)% increased Energy Shield (only int_armour bases); (15-25)% increased Armour and Evasion (only str_dex_armour bases); (15-25)% increased Armour and Energy Shield (only str_int_armour bases); (15-25)% increased Evasion and Energy Shield (only dex_int_armour bases)
- **Gloves:** (15-25)% increased Armour (only str_armour bases); (10-20)% reduced Attribute Requirements; Damage Penetrates (10-15)% Fire Resistance; Damage Penetrates (10-15)% Cold Resistance; Damage Penetrates (10-15)% Lightning Resistance; Break (10-15)% increased Armour; (5-10)% increased Quantity of Gold Dropped by Slain Enemies; +1 to Maximum Frenzy Charges; +1 to Level of all Melee Skills; (15-25)% increased Evasion Rating (only dex_armour bases); (15-25)% increased Energy Shield (only int_armour bases); (15-25)% increased Armour and Evasion (only str_dex_armour bases); (15-25)% increased Armour and Energy Shield (only str_int_armour bases); (15-25)% increased Evasion and Energy Shield (only dex_int_armour bases)
- **Boots:** (15-25)% increased Armour (only str_armour bases); (10-20)% reduced Attribute Requirements; +(20-25)% to Fire Resistance; +(20-25)% to Cold Resistance; +(20-25)% to Lightning Resistance; +(1-3)% to Maximum Lightning Resistance; (3-5)% increased Movement Speed; (20-30)% increased Stun Threshold; (20-30)% increased Freeze Threshold; (20-30)% reduced Slowing Potency of Debuffs on You; (15-25)% increased Evasion Rating (only dex_armour bases); (15-25)% increased Energy Shield (only int_armour bases); (15-25)% increased Armour and Evasion (only str_dex_armour bases); (15-25)% increased Armour and Energy Shield (only str_int_armour bases); (15-25)% increased Evasion and Energy Shield (only dex_int_armour bases)
- **Shields:** (15-25)% increased Armour (only str_armour bases); (10-20)% reduced Attribute Requirements; (40-50)% increased Thorns damage; (10-15)% increased Block chance; +3% to maximum Block chance; (20-25) Life gained when you Block; (10-15) Mana gained when you Block; (15-25)% increased Armour and Evasion (only str_dex_armour bases); (15-25)% increased Armour and Energy Shield (only str_int_armour bases)
- **Bucklers:** (15-25)% increased Evasion Rating; (10-20)% reduced Attribute Requirements; (40-50)% increased Thorns damage; (10-15)% increased Block chance; +3% to maximum Block chance; (20-25) Life gained when you Block; (10-15) Mana gained when you Block
- **Foci:** (15-25)% increased Energy Shield; (10-20)% reduced Attribute Requirements; +(20-25) to maximum Mana; (20-30)% increased Spell Damage
- **Quivers:** +(20-25) to maximum Mana; +(50-100) to Accuracy Rating; (20-30)% increased Damage; (4-6)% increased Skill Speed; (15-20)% increased Critical Damage Bonus; Gain (20-25) Life per enemy killed; Gain (10-15) Mana per enemy killed; (20-30)% chance to Pierce an Enemy; Projectiles have (10-20)% chance to Chain an additional time from terrain
- **Amulets:** Leech 3% of Physical Attack Damage as Life; Leech 2% of Physical Attack Damage as Mana; +1% to all Maximum Elemental Resistances; +(5-10)% to all Elemental Resistances; (10-15)% increased Rarity of Items found; +1 to Level of all Skills; +(10-15) to Strength; +(10-15) to Dexterity; +(10-15) to Intelligence; Life Flasks gain (0.08-0.17) charges per Second; Mana Flasks gain (0.08-0.17) charges per Second; Charms gain (0.08-0.17) charges per Second
- **Rings:** +(20-25) to maximum Mana; +(13-19)% to Chaos Resistance; (15-25)% increased Life Regeneration rate; (20-30)% increased Mana Regeneration Rate; +(5-10)% to all Elemental Resistances; (10-15)% increased Rarity of Items found; (20-30)% increased Damage; (4-6)% increased Skill Speed; (15-20)% increased Critical Damage Bonus; +(10-15) to Strength; +(10-15) to Dexterity; +(10-15) to Intelligence
- **Belts:** +(30-40) to maximum Life; (15-25)% increased Armour; (15-25)% increased Evasion Rating; (15-25)% increased maximum Energy Shield; +(20-25)% to Fire Resistance; +(20-25)% to Cold Resistance; +(20-25)% to Lightning Resistance; +(1-3)% to Maximum Fire Resistance; +1 to Maximum Endurance Charges; +(10-15) to Strength; +(10-15) to Dexterity; +(10-15) to Intelligence
- **Jewels:** +(4-6) to Strength; +(4-6) to Dexterity; +(4-6) to Intelligence; +(5-10)% to Fire Resistance; +(5-10)% to Cold Resistance; +(5-10)% to Lightning Resistance; +(3-7)% to Chaos Resistance; Immune to Maim; You cannot be Hindered; Corrupted Blood cannot be inflicted on you; Cannot be Blinded
- **Wands:** (10-20)% reduced Attribute Requirements; +1 to Level of all Fire Spell Skills; +1 to Level of all Cold Spell Skills; +1 to Level of all Lightning Spell Skills; +1 to Level of all Chaos Spell Skills; +1 to Level of all Physical Spell Skills; (20-30)% increased Spell Damage; (20-30)% increased Flammability Magnitude; (20-30)% increased Freeze Buildup; (20-30)% increased chance to Shock; (20-30)% increased Critical Hit Chance for Spells; Gain (20-25) Life per enemy killed; Gain (10-15) Mana per enemy killed; (10-15)% increased Cast Speed
- **Staves:** (10-20)% reduced Attribute Requirements; +1 to Level of all Fire Spell Skills; +1 to Level of all Cold Spell Skills; +1 to Level of all Lightning Spell Skills; +1 to Level of all Chaos Spell Skills; +1 to Level of all Physical Spell Skills; (40-60)% increased Spell Damage; (20-30)% increased Flammability Magnitude; (20-30)% increased Freeze Buildup; (20-30)% increased chance to Shock; (20-30)% increased Critical Hit Chance for Spells; Gain (20-25) Life per enemy killed; Gain (10-15) Mana per enemy killed; (10-15)% increased Cast Speed
- **Sceptres:** (10-20)% reduced Attribute Requirements; (15-25)% increased Spirit; Allies in your Presence deal (20-30)% increased Damage; Allies in your Presence have (5-10)% increased Attack Speed; Allies in your Presence have (5-10)% increased Cast Speed; Allies in your Presence have (10-15)% increased Critical Damage Bonus
- **Quarterstaves:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (13-20) to (21-31) Fire Damage; Adds (11-17) to (18-26) Cold Damage; Adds (1-3) to (41-61) Lightning Damage; Adds (10-16) to (17-25) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; Causes (20-30)% increased Stun Buildup; (10-20)% increased Melee Strike Range with this weapon; (10-15)% chance to Poison on Hit with this weapon; Grants 1 Rage on Hit; (40-50)% increased Elemental Damage with Attacks
- **Bows:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (9-14) to (15-22) Fire Damage; Adds (8-12) to (13-19) Cold Damage; Adds (1-2) to (29-43) Lightning Damage; Adds (7-11) to (12-18) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; (10-15)% chance to Maim on Hit; (5-10)% chance to Blind Enemies on hit; (20-30)% increased Elemental Damage with Attacks; Bow Attacks fire an additional Arrow
- **Crossbows:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (13-20) to (21-31) Fire Damage; Adds (11-17) to (18-26) Cold Damage; Adds (1-3) to (41-61) Lightning Damage; Adds (10-16) to (17-25) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; (10-15)% chance to Maim on Hit; (5-10)% chance to Blind Enemies on hit; (40-50)% increased Elemental Damage with Attacks; Loads an additional bolt
- **Spears:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (9-14) to (15-22) Fire Damage; Adds (8-12) to (13-19) Cold Damage; Adds (1-2) to (29-43) Lightning Damage; Adds (7-11) to (12-18) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; Causes (20-30)% increased Stun Buildup; (10-20)% increased Melee Strike Range with this weapon; (10-15)% chance to Poison on Hit with this weapon; Grants 1 Rage on Hit; (20-30)% increased Elemental Damage with Attacks
- **One Hand Maces:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (9-14) to (15-22) Fire Damage; Adds (8-12) to (13-19) Cold Damage; Adds (1-2) to (29-43) Lightning Damage; Adds (7-11) to (12-18) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; Causes (20-30)% increased Stun Buildup; (10-20)% increased Melee Strike Range with this weapon; (10-15)% chance to cause Bleeding on Hit; Grants 1 Rage on Hit; (20-30)% increased Elemental Damage with Attacks
- **Two Hand Maces:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (13-20) to (21-31) Fire Damage; Adds (11-17) to (18-26) Cold Damage; Adds (1-3) to (41-61) Lightning Damage; Adds (10-16) to (17-25) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; Causes (20-30)% increased Stun Buildup; (10-20)% increased Melee Strike Range with this weapon; (10-15)% chance to cause Bleeding on Hit; Grants 1 Rage on Hit; (40-50)% increased Elemental Damage with Attacks
- **Talismans:** (10-20)% reduced Attribute Requirements; (15-25)% increased Physical Damage; Adds (13-20) to (21-31) Fire Damage; Adds (11-17) to (18-26) Cold Damage; Adds (1-3) to (41-61) Lightning Damage; Adds (10-16) to (17-25) Chaos damage; (6-8)% increased Attack Speed; +(5-10)% to Critical Damage Bonus; (40-50)% increased Elemental Damage with Attacks

## 9. Источники

- [PN050] Official 0.5.0 patch notes — https://www.pathofexile.com/forum/view-thread/3932540
- [PN054] Official 0.5.4 patch notes — https://www.pathofexile.com/forum/view-thread/3975218
- [PN055] Official 0.5.5 patch notes — https://www.pathofexile.com/forum/view-thread/4000864
- [DB_VAAL] poe2db Vaal Orb (Corrupted Mods /125) — https://poe2db.tw/us/Vaal_Orb
- [DB_OMEN] poe2db Omen — https://poe2db.tw/us/Omen ; /Omen_of_Corruption ; /Omen_of_Sanctification ; /Omen_of_the_Blessed
- [DB_CUR] poe2db Stackable Currency — https://poe2db.tw/us/Stackable_Currency (Infusers, Architect's Orb, Orbs of Sacrifice, Crystallised Corruption, Vaal Cultivation Orb)
- [DB_SAC] poe2db Kopec's Orb of Sacrifice (Corrupted Upgrade Mods /190) — https://poe2db.tw/us/Kopecs_Orb_of_Sacrifice
- [DB_MISC] poe2db Hinekora's Lock / Fracturing Orb / Orb of Chance / Essence of Insanity / Architect's Orb — https://poe2db.tw/us/<Name>
- [REPOE] Local RePoE cache %APPDATA%/PoE 2 Price Checker/cache/repoe-mods.json + repoe-base-items.json (domain item|misc, generation_type corrupted)
- [TS_VAAL] Timesaver.gg Vaal Orb Guide (0.5), 22.07.2026 (commercial) — https://timesaver.gg/blog/poe2-vaal-orb-guide
- [TS_SANCT] Timesaver.gg Sanctify guide, 22.06/09.08.2026 (commercial) — https://timesaver.gg/blog/poe2-sanctified-omen-of-sanctification-guide
- [TS_DC] Timesaver.gg Double Corruption guide, 22.07/22.08.2026 (commercial) — https://timesaver.gg/blog/poe2-double-corruption-guide
- [TS_LOCK] Timesaver.gg Hinekora's Lock guide (0.5.4) — https://timesaver.gg/blog/poe2-hinekoras-lock-guide
- [U4N] U4N unique/jewel Vaal outcome articles (commercial, no patch stated) — https://www.u4n.com/news/poe-2-vaal-orb-unique-items-outcome-chances-explained.html ; https://www.u4n.com/news/poe-2-vaal-orb-jewel-corruption-outcomes-unique-nonunique-jewel-effects-explained.html
- [MAXROLL] Maxroll Corruption Outcomes (only search snippet; site not reachable) — https://maxroll.gg/poe2/resources/corruption-outcomes
- [WIKI_INF] poe2wiki Vaal Infuser (only search snippet; Anubis-blocked) — https://www.poe2wiki.net/wiki/Vaal_Infuser
- [FORUM_SANCT] Forum bug report 'Medved's Tending sanctify range bug', 10.07.2026 — https://www.pathofexile.com/forum/view-thread/3983437
- [TRADE] trade2 filters snapshot (misc filters: Corrupted, Sanctified, Twice Corrupted)
- [PRICES] poe2db 'US Realm Economy' 24h snapshot on item pages, fetched 2026-10-17 (league not stated) (цены в документе — этот снимок; ориентировочные)
- Дополнительно (только сниппеты поиска): Game8 0.5.0 / 0.5.4 summary — https://game8.co/games/Path-of-Exile-2/archives/601782 , https://game8.co/games/Path-of-Exile-2/archives/606723 ; BugFree 0.5.0 crafting — https://bugfree.gg/guides/poe2-crafting-changes-0-5-0 ; Switchblade Gaming — https://www.switchbladegaming.com/path-of-exile-2/vaal-orb-outcomes/ ; Gamerant (апр. 2025, устарело) — https://gamerant.com/path-of-exile-2-all-vaal-orb-outcomes-corruption-poe2/
