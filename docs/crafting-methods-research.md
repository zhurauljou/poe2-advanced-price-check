# PoE 2 — Gaze, лич-омены, Verisium, руны: сводка исследования (для советника Craft)

- **Актуально для:** 0.5.5e, лига Forbidden Rites. **Составлено:** 2026-10-18.
- **Данные для кода:** `data/crafting-methods-research.json`. Там `items` (44 записи), `lichMods` (пулы лич-модов по классу и стороне), `lichModsNoOmen`, `lichModIndex` (198 модов с `group` и spawn-тегами), `alteredCollarbonePool` и `runesData` (источник и топ рун по слотам).
- **Цены:** poe.ninja, Forbidden Rites, 18.10.2026 (1 div = 710 ex). У лич-оменов, Ulaman's/Amanamu's Gaze и Starlit Ore объём торгов почти нулевой, их цены ненадёжны.
- **Доверие:** H — текст предмета на poe2db, патчноут или RePoE; M — гайды сообщества или вывод из H; L — один слабый источник.
- Что уже есть в `crafting-notes.md`, `crafting-tricks.md` и `corruption-sanctification.md`, здесь не повторяется.

## 1. Abyss Gaze (Abyssal Eye)
Модов не меняют. Это **аугменты в augment-гнездо** (`slot: socket`), req. 60, **«Limited to: 1 Ancient Augment»**. Лимит общий с Thesis-ядрами (Jiquani's / Guatelitzi's / Quipolatl's / Citaqualotl's) и рунами Emergent. В тексте написано «Weapon or Armour», но эффекты есть только у трёх слотов [H]:

| Gaze | Эффект | Цена |
|---|---|---|
| Kurgal's | Шлем: Life Regen влияет и на Mana Regen; перчатки: 40% эффекта Arcane Surge; ботинки: 15% Mana Cost Efficiency, если не было Dodge Roll | **~31 div** |
| Tecrod's | Тело: 1.5% реген жизни/с; перчатки: 25% Life Cost Efficiency; ботинки: 10% MS при Low Life | ~12 div |
| Amanamu's | Шлем: снимает damaging ailment при Command-скилле; тело: +2 Armour за 1 Spirit; ботинки: 1% MS за 15 Spirit (до 40%; прочие MS-моды, кроме Sprint, перестают работать) | ~0.5 div |
| Ulaman's | Шлем: +1 Accuracy за 1 Evasion шлема; перчатки: Lucky crit по Parried; тело: Prevent +3% урона от Deflected | ~0.2 div |

Советник: учитывать Gaze как прибавку к цене вещи и как кандидата на сокет. Вынуть Gaze можно только **Orb of Extraction** (~2.35 div, уничтожает вещь).

## 2. Лич-омены (Sovereign = Ulaman, Liege = Amanamu, Blackblooded = Kurgal)
- Текст: «next **Weapon or Jewellery** Desecration attempt will guarantee a random <лич> modifier». Сотрудник GGG: «The Lich specific omens are only compatible with weapons and jewelry». Rib с Focus и бронёй омен **отвергает**, пояс работает [H]. Для колчана (Jawbone) не подтверждено [M].
- Все лич-моды 65 уровня. Нужны ilvl ≥ 65 и Preserved или Ancient кость; Gnawed отвергается [H]. Ancient поверх лич-омена бесполезна (это уже есть в tricks).
- С оменом все 3 варианта раскрытия берутся из пула лича для класса и стороны. Рецепты сообщества подтверждают: Sovereign + Sinistral на арбалете «всегда» даёт +1 Ballista [M].
- **Модель «гарантия при ≤ 3»:** пул = `lichMods[омен][класс][сторона]` минус моды, чья `group` (см. `lichModIndex`) уже есть на вещи. Если в пуле ≤ 3 мода, на выбор покажут все, и нужный мод гарантирован. Иначе P(цель в наборе) = 3/n (выборка без возвращения, веса равны).
- Размеры пулов (префиксы/суффиксы). У одноручных и двуручных мечей, топоров, кинжалов, когтей и цепов по 1/1 у каждого лича: это «Penetrate X Resistance» и общий суффикс.

| Класс | Sovereign | Liege | Blackblooded |
|---|---|---|---|
| amulet | 4/6 | 4/6 | 3/8 |
| ring | 2/4 | 3/5 | 2/6 |
| belt | 3/4 | 3/4 | 3/4 |
| bow | 2/3 | 3/3 | 3/3 |
| crossbow | 2/3 | 3/2 | 2/3 |
| spear | 2/3 | 3/3 | 3/3 |
| wand | 2/4 | 3/3 | 1/2 |
| staff | 2/2 | 3/3 | 2/2 |
| quarterstaff | 2/2 | 2/2 | 2/2 |
| 1H/2H mace | 5/6 | 1/1 | 2/1 |
| talisman | 4/4 | 3/3 | 2/2 |
| quiver (M) | 1/2 | 1/1 | 1/2 |
| sceptre | 0/0 | 0/0 | 0/0 |

- Цена омена — копейки (≤ 0.02 div). Стоимость попытки = кость + омен + Necromancy.
- **Altered Collarbone** (~3.8 div) — отдельный пул «otherworldly» (Breach) desecrated-модов: амулет 4, кольцо 16, пояс 16 (`alteredCollarbonePool`). В RePoE это моды 1-го уровня, поэтому Whittling снимет такой мод первым. Шанс выпадения otherworldly-мода не опубликован [L].

## 3. Verisium
- **Verisium** — Runeforging у Verisium Anvil. База превращается в «Runeforged <base>» и получает Runic Ward; моды, судя по всему, сохраняются [M]. Цена: 20–230 Verisium за тело, до ~490 за щиты и фокусы 80-го уровня. Для баз ниже 55-го уровня — без потерь (Vaal Cuirass: 298 AR + 70 Ward). Выше 55-го база теряет часть защиты: Tasalian Focus ES 91 → 36, Desert Buckler EV 192 → 87 [H по RePoE]. Пул модов не меняется: в RePoE нет модов с тегом `runeforged` [H]. Верисиум почти бесплатный. Советник может напомнить «Runeforge до продажи», если база ниже 55 и вещь броня.
- **Exceptional Verisium** — особые базы: Sacrificial Regalia (4 варианта с новым implicit) и Grasping Mail (Runeforged → Runemastered → Runefather's, тип защиты меняется) [M].
- **Starlit Ore** (Revered / Veridical / Venerable / Warding) — ковка конкретного уника (The Unleashed / Eventide Petals / Eyes of the Runefather / Duality). **Crest** (Medved / Vorana / Uhtred / Olroth) — Unique Runeforging: апгрейд базы уника, у каждого уника свой рецепт. **Liquid Verisium** — запускает Runic Remnant. Для крафта rare-вещей всё это `ignore`.

## 4. Руны и soul cores — машинные данные
- **URL:** `https://repoe-fork.github.io/poe2/augments.json` (+ `.min.json`). Это тот же хост, что `REPOE` в `src/main/craft.js`; файл от 11.09.2026 (0.5.5b). Ключ — путь Metadata, имя берётся из `base_items[key].name`. Значение: `type_id` (Rune / SoulCore / Idol / AbyssalEye / CongealedMist), `required_level`, `limit` и `categories: {слот: {target, stat_text, stats, bonded_stat_text}}`. Записей 313.
- `bonded_*` — эффекты «Bonded», работают только с нотаблем Шамана Wisdom of the Maji. **Для цены их игнорировать.** У Perfect Adept / Robust / Resolve на оружии других строк нет.
- **Топ по слотам** (полностью — в `runesData.top`):
  - **Оружие (martial):** Perfect Iron (20% inc phys), Perfect Desert / Glacial / Storm (flat ele), Soul Core of Quipolatl (5% AS), Citaqualotl (40% ele с атаками), Topotante (pen 25%), Fenumus' (13% extra chaos), Saqawal's (5% всех стихий), Farrul's Hunt, Jiquani's ядра (+1 к типу скиллов). Perfect-руны стоят ~2.6–3.8 div, остальное — копейки.
  - **Caster (wand/staff):** Perfect Iron (35% spell), Perfect Desert / Glacial / Storm (12% extra ele), Hedgewitch Assandra's (+1 spell), Perfect Vision (28% spell crit), Perfect Mind (+90 mana); Aldur's Legacy-руны (Lifesprig +2 spell, Cursecarver +3 curse) — без цены на бирже. **Sceptre:** Xipocado's Dominion, Rune of the Hunt.
  - **Тело:** Emergent Vigour (~42 div), Emergent Possibility (~29), Guatelitzi's Thesis (~16), Tecrod's Gaze; базовые — Perfect Body (+75 life), Perfect Iron (20% def), Perfect-резисты (+22%), Citaqualotl (+6% all res).
  - **Шлем:** Jiquani's Thesis (~226 div), Raven-Touched Shard (~208 div, «Raven-Touched» — вещь можно instill), Emergent Vigour, Kurgal's Gaze, Atziri's Devotion (~8.6), Vorana's Carnage (Berserking).
  - **Перчатки:** Jiquani's Thesis, Kurgal's Gaze, Emergent Possibility, Tecrod's Gaze, Kolr's Hunt / Katla's Gloom (пулы модов — уже есть в приложении), Cadigan's Epiphany (augment-гнёзда → jewel socket).
  - **Ботинки:** Jiquani's Thesis, Kurgal's Gaze, Tecrod's Gaze, Guatelitzi's Thesis (+25% MS при Sprint), Farrul's Chase (5% MS), Zalatl's Insulation, Uhtred's Sidereus.
  - **Щит / фокус:** почти только общие Armour-руны (Perfect Body / Iron / резисты, Citaqualotl), Soul Core of Ticaba (−50% crit dmg по вам), Rune of Vitality, Atmohua's Retreat (фокус), Ancient Rune of Witchcraft / Retaliation / Dueling.
  - **Мета (любой слот):** Astrid's Creativity (+1 crafted, **~3.6 div**), Serle's Triumph (+1 suffix, ~3 div), Masterwork Rune (апгрейд руны в гнезде, ~0.9 div).

## 5. Greater/Perfect Chaos и Regal [H]
- Минимальный уровень мода: Greater **35**, Perfect **50** — у Chaos и у Regal (poe2db). Порог относится к **добавляемому** моду. Исключение для семейств с низким потолком — см. tricks §0.
- Whittling и Sinistral/Dextral Erasure срабатывают на «next Chaos Orb», то есть и на Greater/Perfect [M/H]. Удаление идёт без учёта порога. Сторона нового мода не ограничена, но на полной вещи новый мод встанет на освободившуюся сторону [M].
- Sinistral/Dextral Coronation — «next Regal Orb», работает и с Greater/Perfect Regal [M]. Homogenising Coronation есть только в Standard.
- Цены: **Perfect Chaos ~7.7 div**, Greater Chaos ~0.3; Perfect Regal ~0.05, Greater Regal ~0.01. Для советника: Perfect Regal почти всегда выгоднее обычного, а шаг Perfect Chaos + Whittling обходится ~22 div.

## 6. Прочее (по одной строке)
| Предмет | Что делает | Советнику |
|---|---|---|
| Omen of Amelioration | −75% потери опыта при смерти | нет |
| Omen of Answered Prayers | доп. эффект святыни | нет |
| Ancient Infuser | меняет и коррумпирует Tablet | нет |
| Core Destabiliser | меняет Soul Core (может уничтожить) | нет |
| Vaal Siphoner | corrupted rare-бижутерия: после порога убийств снимает случайный мод, улучшает значения остальных | совет (финал) |
| Orb of Extraction | уничтожает вещь, возвращает аугменты | совет (дорогие ядра и руны) |
| Artificer's Shard | 10 шт. = Artificer's Orb | нет |
| Crystallised Corruption | двойная порча гема | нет |
| Perfect / Thaumaturgic Flux | поднимает скиллы вещи до 20 (или до фикс. уровня, L) | совет (wand/staff/sceptre) |
| Masterwork Rune | апгрейд вставленной руны | совет |
| Altered Collarbone | см. §2 | план |
| Architect's, Orbs of Sacrifice, Vaal Cultivation | уже в `corruption-sanctification.md` | — |
| Chaotic-омены, Bartering / Gambling / Hunt / Resurgence / Refreshment / Reinforcements / Secret Compartments, Sagas, Ritual-предметы | карты, вендор, бой, Expedition | нет |

## 7. Противоречия с существующими заметками
| Где | Сейчас | По данным | Доверие |
|---|---|---|---|
| tricks §1.1 | «Amanamu 26P/44S, Kurgal 23P/39S, Ulaman 22P/44S» | RePoE: **Ulaman 26P/51S, Amanamu 24P/39S, Kurgal 21P/37S** (всего 198; 2 мода отключены) | H |
| tricks §0 / T2 | «эксклюзивов личей нет в префиксах брони» | Верно для шлема, перчаток, ботинок, тела, щита и баклера. **У фокуса лич-префиксы есть** (Sovereign: spell dmg while melee, +1 spell totem; Liege: curse magnitude, offering; Blackblooded: invocated dmg, spell AoE), но омен на фокусе не работает | H |
| notes §2.5 / tricks D-8 | лич-омены — только оружие и бижутерия | Подтверждено GGG. Добавить: пояс работает, Gnawed-кость отвергается | H |
| tricks §5 (цены) | Echoes ~1 div; Light 5+; сторона-Annul ~3.5; Erasure «несколько div»; Astrid's 14–20; Greater Exaltation ~4 ex | Сейчас: Echoes **0.08**; Light **8.8**; Sinistral / Dextral Annulment **19.6 / 12.8**; Erasure **20 / 13.2**; Whittling **14**; Astrid's **3.6**; Greater Exaltation ~14 ex; Perfect Chaos 7.7; Fracturing 10.6; Hinekora 1677; Preserved Cranium 28 | H (снимок) |
| notes §2.7 | только Runic Ward от Verisium | Добавить Exceptional Verisium (особые базы) и Crest / Starlit Ore — это уники, не крафт | H/M |

## 8. Что моделировать (приоритет)
1. **Лич-омен в desecrate-плане** для оружия и бижутерии: «гарантия при ≤ 3», иначе 3/n; не предлагать для брони, фокуса, щита и скипетра и при ilvl < 65.
2. **Цена шагов Whittling / Erasure / сторона-Annul** — по live-ценам. Сейчас они на порядок дороже, чем в tricks; Perfect Chaos тоже дорогой.
3. **Аугменты как прибавка к цене и подсказка «что вставить»** — из `augments.json`: Gaze и Thesis в слотах брони, Perfect-руны. Bonded-строки игнорировать.
4. **Perfect Regal вместо Regal** на высоком ilvl. Это дёшево.
5. Runeforging (броня ниже 55-го уровня) и Altered Collarbone (бижутерия) — опциональные подсказки.

## Источники
- poe2db 0.5: Amanamus_Gaze, Kurgals_Gaze, Ulamans_Gaze, Tecrods_Gaze, Omen_of_the_Sovereign, Omen_of_the_Liege, Omen_of_the_Blackblooded, Altered_Collarbone, Liquid_Verisium, Verisium, Exceptional_Verisium, *_Starlit_Ore, *_Crest_of_*, Runeforging, Runeforged_Vaal_Cuirass, Greater/Perfect_Chaos_Orb, Greater/Perfect_Regal_Orb, Omen_of_Whittling, Omen_of_Sinistral/Dextral_Erasure, Omen_of_Sinistral_Coronation, Masterwork_Rune, Perfect_Flux, Orb_of_Extraction, Vaal_Siphoner и прочие из §6 — `https://poe2db.tw/us/<Name>`
- GGG о лич-оменах: https://www.pathofexile.com/forum/view-thread/3834266
- Патчноуты 0.5.0 (Runeforging, Runic Ward): https://www.pathofexile.com/forum/view-thread/3932540
- RePoE: https://repoe-fork.github.io/poe2/augments.json, mods.min.json, base_items.min.json (локальный кэш приложения)
- poe.ninja exchange API (Forbidden Rites, 18.10.2026): `https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Forbidden%20Rites&type=<Currency|Ritual|Abyss|Verisium|Runes|SoulCores|Expedition>`
- Рецепты сообщества (Sovereign + арбалет): https://github.com/fixerpimp-gamer/POE2_0.5_Craft_Guides
- Bonded = Wisdom of the Maji: https://www.poe2wiki.net/wiki/Bonded (только сниппет поиска)
