# PoE 2 — приёмы и комбо крафта (для советника Craft)

- **Актуально для:** 0.5.x (Runes of Aldur → Forbidden Rites, 0.5.5e). Ядро крафта не менялось с 0.5.0. Дополняет `docs/crafting-notes.md`: что уже описано там, здесь не повторяется, только уточняется.
- **Составлено:** 2026-10-17.
- **Доверие:** **[H]** — есть игровой текст (poe2db 0.5), официальные патчноуты или несколько независимых источников; **[M]** — 1–2 гайда 0.5 или логичный вывод из [H]; **[L]** — один сторонний гайд, старый патч или противоречивые данные. Ссылки [T#] ведут в раздел 8.
- Недоступны при сборе: maxroll (обрыв соединения), mobalytics (403), poe2wiki (Anubis): от них есть только сниппеты из поиска.

---

## 0. Поправки к `crafting-notes.md`

| § | Сейчас в заметках | Как на самом деле | Доверие |
|---|---|---|---|
| 2.5 | «Раскрытие — выбор из вариантов (3 — не проверено)» | **3 варианта**, выбираете 1. В пул могут входить **обычные (base) моды** класса, если омен лича не сужает пул до своих модов [T2][T9][T11] | H |
| 2.5 / 3 | Abyssal Echoes — «один реролл» | Да: **один реролл всего набора из 3 вариантов** (текст 0.5 [T1][T16], codex [T9]). Гайды эпохи 0.3 пишут «3 → 6 вариантов» [T10] — это устарело | H |
| 2.1 / 2.5 | «Desecrated-префиксов на Body/Gloves/Boots/Helmet нет» | Нет **эксклюзивных модов личей** в префиксах брони. Desecrate в префикс брони (Rib + Sinistral Necromancy) работает и открывает **обычные префиксы** (flat ES, hybrid, life, MS на ботинках); так делают почти все рецепты брони 0.5 [T2][T17][T18]. У скипетров эксклюзивных модов нет вообще [T2] | H |
| 2.5 | Ancient — моды 40+ | Все **198 модов личей — 65 уровня** [T2]: с оменом лича Ancient не даёт ничего, кроме требования ilvl ≥ 65 (оно и так нужно). Ancient окупается, только когда в раскрытие могут попасть base-моды (броня в префикс, раскрытие без омена лича): тогда он отсекает base-моды ниже 40 | H (уровни) / M (вывод) |
| 2.2 | «порог never removes a family — не проверено» | **Подтверждено:** у Greater/Perfect-валюты минимальный уровень мода — это фильтр по уровню, но «at least one tier of each mod will always be eligible». Семейство, у которого все тиры (≤ ilvl) ниже порога, всё равно выпадает своим лучшим тиром. Пример: Perfect Exalt дал ES Recharge Rate T1 (ур. 48) [T6][T8] | H |
| 2.3 | Fracturing: «≥ 4 модов» | Desecrated-моды, **в том числе нераскрытые**, зафиксировать нельзя, но они **считаются в минимум 4**. На вещи с 3 обычными модами и 1 нераскрытым шанс попасть в нужный мод — **1/3**, а не 1/4 [T10][T12][T17]. Mark of the Abyssal Lord фиксировать **можно**, и такой Mark уже не конвертируется [T15] | H / M (Mark) |
| 2.3 / R6 | Hinekora: «посмотреть другой вариант нельзя» | Предвидение держится, пока вещь не изменена: можно навести **разные** валюты (Exalt, Chaos, Divine, Vaal…) и увидеть результат каждой, а применить лучшую. Активный омен меняет результат, поэтому смотреть надо ту самую комбинацию «валюта + омены» [T13][T4] | M |
| R3 / §6.10 | Whittling: «desecrated безопаснее исключить» | Наоборот: **нераскрытый desecrated считается модом 1-го уровня**, и Whittling снимет его первым [T8]. Особые crafted-моды уровня 0–1 (Mark, corrupted- и Breach-эссенции) тоже первые кандидаты [T3][T17] | H (нераскрытый) / M (crafted) |
| R3 | «Мод эссенции снимается только случайно» | Если мод эссенции — спецмод уровня 0–1 (Mark, Hysteria, Breach и т.п.), его можно снять **Chaos + Whittling** (раскрыв перед этим desecrated) [T17]. Обычные Greater-эссенции дают обычный тир, у которого свой уровень, — не проверено | M/L |
| R8 | Liquid Emotions «как Greater Essence (не проверено)» | Официальный патчноут: на самоцветах «work similarly to greater essences, each having a set of specific mods that will replace a random existing mod» [T5] | H |
| 3 (низ) | «до трёх оменов — для обычного крафта не проверено» | Лимит «до 3» — только у Waystone-оменов Chaotic [T5]. Для крафта действует правило: **разные виды стакаются, один омен каждого вида**; если комбинация недопустима, крафт не выполнится [T8][T9]. См. раздел 2 | H/M |
| 2.5 | Putrefaction и лимит 1 desecrated | Putrefaction обходит лимит: все моды становятся **до 6 Unrevealed** (3+3), вещь коррумпируется, раскрываются по одному (сначала префиксы), каждый раз из 3 вариантов [T1][T17] | H (текст) / M (порядок) |

---

## 1. Desecration — подробно

### 1.1 Механика (что моделировать)
- **Desecrate** добавляет 1 Unrevealed-мод. Без омена сторона случайна (~50/50 [T10], **M**). Sinistral/Dextral Necromancy задают сторону. Нераскрытый мод **занимает слот** этой стороны [T10] → это бесплатный способ «закрыть» сторону для следующих Exalt (см. T-07).
- **Полная вещь (6 модов):** сначала удаляется случайный мод [T2][T16]. Как это сочетается с Necromancy (удаляется ли мод с той же стороны), не задокументировано [T9]: моделировать как «случайный из всех незафиксированных», **L**.
- **Раскрытие у Well of Souls:** 3 варианта, взять 1. Можно отложить: вещь можно крафтить дальше с нераскрытым модом (на этом построены трюки с fracture и «unveil в конце») [T10][T17], **H**.
- **Пул вариантов:**
  - с оменом лича (Sovereign → Ulaman, Liege → Amanamu, Blackblooded → Kurgal; **только Weapon/Jewellery**) — моды этого лича для класса и стороны. Всего у личей Amanamu 26P/44S, Kurgal 23P/39S, Ulaman 22P/44S (на все классы), все уровня 65 [T2], **H**. Если подходящих под класс и сторону ≤ 3, нужный мод гарантирован: так, Sovereign + Sinistral на арбалете «гарантирует» +1 Ballista Totem [T17], **M**.
  - без омена — смесь base-модов класса и стороны и эксклюзивов личей [T2]. По сообществу (Craft of Exile): при ilvl 65+ хотя бы 1 вариант — эксклюзив, остальные ~50/50; GGG это не подтверждала [T10], **L**.
  - Ancient-кость: варианты с уровнем мода ≥ 40 [T2][T11]. Gnawed: только ilvl ≤ 64, эксклюзивов (ур. 65) не даёт [T2].
- **Abyssal Echoes:** один реролл всего набора. Вероятно, после реролла выбор идёт только из нового набора — **M** (так читается текст [T1]; явного подтверждения нет).
- **Omen of Light + Annulment:** гарантированно снимает desecrated-мод (на вещи он всегда один, так что сторона-омен не нужен), затем можно снова desecrate. Это стандартная «петля повтора» [T1][T14][T17], **H**. Стоимость петли = Annul + Light (+ кость + Echoes).

### 1.2 Тактики
| # | Приём | Условия | Эффект / шанс | Ловушки | Доверие |
|---|---|---|---|---|---|
| D-1 | **Открыть слот → desecrate в него** (Annul + сторона-омен по плохому моду, затем кость + та же Necromancy, затем Echoes) | На нужной стороне 1 снимаемый мод (или остальные fractured) — Annul гарантирован | Мусорный мод заменяется выбором 1 из 3 (с Echoes — 2 набора). Нормальная практика: так и выглядит «Light-петля», только первый проход через обычный Annul | Echoes стоит ~1 div: брать только на вещах, где мод заметно поднимает цену [T17][T18] | M |
| D-2 | **Desecrate полной вещи намеренно** | Почти не используется. Оправдано, когда все незафиксированные моды одинаково мусорные (fractured-основа + мусор) | Случайный мусор → 3 варианта. Дешевле Chaos+омены, если кость дешёвая | Может снять единственный ценный мод. Как сторона удаления связана с Necromancy — неизвестно | L |
| D-3 | **Essence of the Abyss → desecrate** | Rare, crafted-слот свободен (Essence of the Abyss тоже crafted [S10 в notes]) | Essence of the Abyss: «Removes a random modifier» (Crystallisation выбирает сторону удаления [T15]) + Mark. Desecrate **заменяет Mark** нераскрытым модом «более высокого тира» и не снимает ничего лишнего даже на полной вещи [T2]. Наблюдаемый мин. уровень ~33 [T15]. После этого crafted-слот снова свободен (Mark ушёл) — вывод, **M** | Mark может встать префиксом или суффиксом [T15]; Mark можно случайно зафиксировать Fracturing Orb [T15]; Whittling снимет Mark первым (уровень 0) | H (замена) / L (тир) |
| D-4 | **Нераскрытый desecrated как «пустышка» для Fracture** | Rare с 3 модами, один из них ключевой | Desecrate (не раскрывать) → Fracturing Orb: **1/3** на ключевой. Потом Annul лишнего, раскрытие или Light | На 3-модовой вещи desecrate ничего не снимает. Не раскрывать до fracture | H |
| D-5 | **Блокер через раскрытие** | Нужен мод группы X исключить из будущих Exalt (например, Mana на палочке) | Выбрать в раскрытии дешёвый мод группы X → Perfect Exalt + Greater Exaltation на открытые места (X не выпадет) → Light + Annul снимает блокер → новый desecrate [T17] | Стоит Light + кость сверху; окупается только на дорогих Exalt | M |
| D-6 | **Unveil в конце** | Desecrate сделан рано (занял слот), раскрытие отложено | Раскрывая последним, вы видите финальную вещь и выбираете под неё; варианты не конфликтуют с уже стоящими группами (предположение) | Пока мод не раскрыт, Whittling бьёт в него | M |
| D-7 | **Putrefaction «слот-машина»** | Дешёвая база ilvl 81+, где важен суммарный результат 6 модов (колчаны, броня под Decay/Stonefist) | Все моды → 6 Unrevealed (3P+3S), Corrupted; 6 раскрытий по 3 варианта. Затраты ~6–7 ex на попытку, перепродажа 2–12 div [T17] | Вещь коррумпирована — дальше только руны и quality. Echoes — на последние раскрытия, если первые хороши | M |
| D-8 | **Лич-омен + сторона** на оружии/бижутерии | ilvl ≥ 65, Weapon/Jewellery | Пул сужается до эксклюзивов лича на стороне; при маленьком пуле нужный мод почти гарантирован (Sovereign + Sinistral на арбалете → +1 totem; Blackblooded на амулете → «ES from Equipped Body Armour») [T17] | На броню лич-омены не действуют. Ancient-кость с ними бесполезна (всё ур. 65) | H/M |

---

## 2. Стек оменов

- **Правило [H/M]:** можно активировать несколько оменов **разных видов**, и все они применятся к следующей подходящей валюте. Два омена одного вида не складываются [T9]. Если комбинация недопустима, крафт **не выполнится**: валюта и омены не потратятся [T8][T9]. Омены не обходят лимиты: Greater Exaltation + Sinistral при одном свободном префиксе — отказ [T9], **M**.
- Явного общего лимита числа оменов для крафта не найдено. «До 3» — только у Chaotic-оменов для Waystone [T5].

| Комбинация | Работает? | Источник / доверие |
|---|---|---|
| Greater Exaltation + Sinistral/Dextral Exaltation | Да: 2 мода на одну сторону (нужно 2 места) | [T9][T17], H |
| Greater Exaltation + Perfect/Greater Exalted | Да; оба мода с мин. уровнем (с исключением для семейств, см. §0) | [T6][T17], H |
| Homogenising + Greater + сторона (+ Perfect) | Работало в 0.3; в лиге 0.5 Homogenising недоступен (Currency Exchange только в Standard) | [T6][T5], H |
| Greater Annulment + Sinistral/Dextral Annulment | Да: 2 мода с одной стороны | poe2wiki [T8], H |
| Whittling + Dextral/Sinistral Erasure (+ Greater/Perfect Chaos) | Да: самый низкоуровневый мод на стороне; в гайдах maxroll — для реролла суффиксов | [T19], M |
| Light + сторона-Annulment | Бессмысленно (desecrated-мод на вещи один) | вывод, H |
| Necromancy + лич-омен (+ Echoes) | Да, стандарт | [T17][T18], H |
| Catalysing Exaltation + сторона/Greater | Используется в гайдах 0.5 [T17][T18], но есть жалобы, что в комбинации с другими оменами каталист «не срабатывает» (0.3, малая выборка) [T7] | L |
| Crystallisation + Perfect/corrupted Essence / Alloy | Да; в рецептах Alloy тоже управляется Crystallisation [T17] — для Alloy не подтверждено игровым текстом | H (эссенции) / L (Alloy) |

---

## 3. Каталог «детерминированных» приёмов

Формат: **условия → эффект → шанс → валюта / цена → ловушки**.

- **T-01. Annul + сторона-омен, когда на стороне 1 снимаемый мод.** Остальные моды стороны fractured, или стоит один мод → 100% снимается нужный. Цена: Annul + Sinistral/Dextral Annulment, ~3.5 div за попытку по данным сообщества [T17]. Ловушка: crafted- и desecrated-моды тоже снимаемы и считаются. **H**.
- **T-02. Chaos + Whittling.** Плохой мод имеет **наименьший уровень мода** (не тир!) среди незафиксированных → он снимается наверняка, добавляется случайный (с Greater/Perfect Chaos — 35+/50+). Перед этим раскрыть desecrated, иначе Whittling ударит в нераскрытый (ур. 1) [T8][T17]. Как разрешаются ничьи по уровню, неизвестно — **L**. Цена: Whittling — дорогой омен (Ritual, «very rare» по maxroll [T19]). **H**.
- **T-03. Chaos + Erasure (сторона).** Снимает случайный мод нужной стороны и добавляет случайный (сторона нового мода не ограничена — не подтверждено [T1]). Erasure стоит «несколько div» [T14]. Сравнить с T-01 + Exalt: maxroll советует считать, что дешевле — Annul+Sinistral Annulment или Perfect Chaos+Sinistral Erasure [T19]. **M**.
- **T-04. Perfect/corrupted эссенция + Crystallisation.** Удаляет случайный мод с указанной стороны и добавляет мод эссенции (crafted-слот должен быть свободен). Если на стороне удаления 1 снимаемый мод — детерминировано [T9]. Паттерн «жертвенный мод»: Exalt + сторона-омен добавляет мусор на сторону с fractured-модом → Crystallisation той же стороны → эссенция снимает именно мусор [T17]. Если сторона мода эссенции полная, удаление, вероятно, вынужденно идёт с неё («all suffixes full → removes only a suffix» [T17]) — **M**.
- **T-05. Fracture ключевого мода.** P = 1/k, где k — незафиксированные **не-desecrated** моды (нужно ≥ 4 модов всего, desecrated считаются). Сначала Annul лишнего до 3 обычных + 1 нераскрытый (D-4). После fracture: Annul до основы → Chaos-спам второго мода → дальше по цепочке [T12][T17]. Fracturing Orb в 0.5 добывается только через атлас [notes S2]. **H**.
- **T-06. Fracture + сторона-омены (изоляция).** Fractured-мод на той же стороне, что и мусор: Annul/Crystallisation этой стороной бьёт только в мусор [T9]. **H**.
- **T-07. Заполнить другую сторону, чтобы направить Exalt (бесплатный сторона-омен).** Если одна сторона полная, обычный Exalt ставит мод на другую. Заполнять можно нераскрытым desecrated (Necromancy), дешёвым Exalt или блокером. **H** (базовая механика).
- **T-08. Блокер группы.** У одной группы модов на вещи может быть только один мод. Дешёвый мод группы X закрывает X для следующих Exalt/Chaos; потом его снимают (Whittling, если он самый низкоуровневый, Light для desecrated-блокера, сторона-Annul) [T9][T17]. Пример — Accuracy-блокер на луке перед Whittling-спамом суффиксов [T17]. **M**.
- **T-09. Greater Exaltation (+ Perfect Exalted).** Два мода за один Exalt; с Perfect — оба 50+ (с исключением для семейств). Омен дешёвый (~4 ex против ~171 ex у Perfect Exalt [T17], цены на момент снимка). Самый популярный финал в рецептах 0.5 [T17]. **H**.
- **T-10. Catalysing Exaltation (бижутерия).** Тратит всё качество катализатора, повышает вес модов с тем же тегом. Множитель официально неизвестен. Оценка codex — ~×5 при 20% и ~×7.5 при 40% [T9], **L**. Отзывы игроков противоречивы [T7]. Есть рецепты с 40% (Breach-кольца/эссенция) [T17][T18].
- **T-11. Качество бижутерии как множитель мода (тех +4).** Качество катализатора усиливает моды с совпадающим тегом. На амулете +3 к умениям при ≥ 34% качества становится +4 (3 × 1.34 → 4). Чтобы поднять потолок качества, используют Essence of the Breach (+20% к максимальному качеству [notes S13b]). После этого её мод снимают Whittling'ом (раскрыв desecrated) или сторона-Annul — по данным сообщества, качество остаётся [T17]. **L/M**.
- **T-12. Astrid's Creativity (руна «+1 Crafted Modifier allowed», Limit 1) [T21].** Даёт 2 crafted-мода: эссенция + Alloy или Perfect-эссенция. По рецептам сообщества, после замены руны crafted-моды остаются [T17], **L**. Цена 14–20 div [T17]. Нужен augment-сокет.
- **T-13. Hinekora's Lock.** Смотреть результат нескольких валют без траты, применить лучшую. Вещь меняет любое действие, в том числе включение омена. Цена — сотни div в устоявшейся экономике [T13]. Имеет смысл только перед необратимым шагом на вещи дороже Lock: Vaal, Perfect Exalt на последнем слоте, Divine «в окно». **M**.
- **T-14. Light-петля.** См. 1.1. Стоимость попытки N ≥ 2 = Annul + Light (5+ div [T17]) + кость (+ Echoes). **H**.
- **T-15. Sanctification (Divine + омен) на готовой вещи.** Множитель значений, после этого вещь не крафтится; на +4 амулете «гарантированно +5» по одному гайду [T17], **L**. Только в самом конце.
- **T-16. Liquid Emotions на самоцветах.** Заменяют случайный мод модом из своего набора (официально [T5]). Сообщество: Contempt — crafted «+1 prefix/+1 suffix count» 50/50 → 3 суффикса на самоцвете [T17], **L**.

---

## 4. Типовые цепочки 0.5 (порядок и почему)

Общий скелет (codex [T9], рецепты [T17][T18]): **база ilvl → magic с 1–2 ключевыми модами → ОДНА эссенция (magic→rare) → desecrate (сторона-омен, иногда не раскрывать) → Exalt / Greater Exaltation (+ сторона) → исправить (Whittling / сторона-Annul / Light-петля) → Divine → quality / сокеты / руны → Vaal (опц.)**. Следим за счётом модов: эссенция → 3, desecrate → 4, Greater Exaltation → 6.

| Слот | Цепочка | Почему так | Ист. |
|---|---|---|---|
| **Phys-оружие (лук, копьё, посох, арбалет)** | magic с высоким %Phys → Greater Essence of Abrasion (flat phys) → Sinistral Necromancy (+ Sovereign/Liege) + Preserved Jawbone → Greater/Perfect Exalt + Greater Exaltation на 2 суффикса → раскрыть → quality 20%, Artificer's, Greater Iron Runes | Префиксы под урон фиксируются эссенцией и desecrate; суффиксы — одним двойным Exalt | [T17][T18] |
| Phys BIS (fractured) | fractured T1 мод / +5 proj → Annul до основы → Chaos-спам второго ключевого → desecrate префикс → Exalt суффиксы → Alloy (Runebinder и т.п.) с полной стороной → Light + Ancient Jawbone + Echoes — охота за последним префиксом → Divine | Fracture убирает риск; Light-петля — главная статья расходов | [T17] |
| **Палочка / посох (спеллы)** | magic с +N к уровню заклинаний (Perfect Trans/Aug 70+) → Greater Essence (Sorcery / Seeking / Alacrity) → Sinistral Necromancy + Preserved Jawbone (+ лич-омен, Echoes) → 2 Exalt / Greater Exaltation на суффиксы (crit, cast speed) | +уровни приходят с базы, эссенция — третий мод; desecrate в префикс под %spell/ele | [T18][T17] |
| Палочка high-end | fractured +5 → Annul → Exalt-жертва → Alloy (Transcendent/Celestial) + Crystallisation → (Astrid's для 2-го crafted) → блокер Mana через раскрытие → Perfect Exalt + Greater Exaltation | Mana — главный «мусор» в префиксах; блокер убирает его из пула | [T17] |
| **Броня ES/Eva (тело, шлем)** | Perfect Trans/Aug (T1 %ES / flat ES / spirit) → Greater Essence of Enhancement (или Body под life) → Dextral Exaltation + Greater Exaltation (2 сопротивления) → Preserved Rib (префикс) → раскрыть: flat ES > %ES > spirit → 2 сокета + Iron Runes | Префиксы брони у личей пустые → раскрытие префикса даёт base-моды; суффиксы под сопротивления добиваются двойным Exalt | [T17][T18] |
| Броня BIS | magic T1 %ES → Rib (не раскрывать) → Fracture 1/3 → Annul → Chaos-спам (руна Medved's для mana/spirit) → Sinistral + **Ancient** Rib + Echoes (flat ES) → Perfect Exalt + Greater Exaltation | Ancient оправдан: в префикс брони попадают только base-моды | [T17] |
| **Ботинки (MS)** | magic с MS + сопротивлением (на трейде дешевле, чем выкатывать) → эссенция сопротивления (или Ruin под хаос) → Dextral Necromancy + Rib (если MS уже есть; иначе Sinistral — охота за MS) → Greater Exaltation на остаток. Альтернатива для MS: corrupted Essence of Hysteria (30% MS, Rare, снимает случайный мод → Sinistral Crystallisation, если префиксы свободны от ценного) | MS — префикс; без него ботинки почти ничего не стоят | [T17][notes] |
| **Перчатки** | fractured flat dmg / +2 proj или melee → Annul → Chaos-спам → Exalt-жертва в суффикс → Dextral Crystallisation + Essence of Hysteria (Crit Dmg) → Rib + Echoes / Light-петля | Жертвенный мод + Crystallisation делают corrupted-эссенцию детерминированной | [T17] |
| **Кольцо (атака)** | magic flat ele + resist ilvl 75+ → Greater Essence → Breach-катализатор 20% → Dextral Exaltation + Catalysing + Greater Exalt (all res) → Uul-Netol 20% + Catalysing + Greater Exalt (flat phys) → Preserved Collarbone (+ Echoes) | Каталист перед каждым Exalt, потому что Catalysing тратит качество | [T18] |
| **Амулет (+скиллы / spirit)** | fractured +3 skills / spirit → Annul до 2 → Chaos-спам T1–T2 spirit → Dextral Exaltation + Exalt → Dextral Crystallisation + Perfect Enhancement (жертва) → катализатор 20% → Perfect Exalt + Dextral → Collarbone + Echoes + Light-петля. Вариант +4: Breach-эссенция + катализатор до ≥ 34% (T-11) | Кольца и амулеты часто дешевле купить; крафтить только с fractured-основой | [T17] |
| **Пояс** | magic life + 2 charm → эссенция сопротивления → Dextral Necromancy + лич-омен (дешёвый) + Preserved Collarbone (+ Echoes) → Exalt | Лич-омен на суффиксе пояса — «Elemental+Chaos res» 3/4 по рецепту | [T18][T17] |
| **Самоцвет** | rare с 2 нужными суффиксами → Liquid Emotion (+1 suffix, 50/50) → Preserved Cranium + Dextral → Echoes → снять crafted «+1 suffix» сторона-Annul → Chaos по префиксам | Только Preserved Cranium; desecrated-моды самоцветов — 1-го уровня | [T17][T2] |

**Устарело (не советовать):** рецепты 0.3/0.4 с двумя эссенциями (Greater + Perfect Sorcery), двумя desecrate на одной вещи, Recombinator, Homogenising (лига) — например, [T20], amulet_003 в [T17].

---

## 5. Ориентиры цен (тир затрат; брать poe.ninja live)

> **Устарело (2026-10-18):** омены сторон Annulment / Erasure и Omen of Light подорожали в разы (Sinistral Annulment ≈ 19.6 div, Erasure ≈ 13–20 div, Light ≈ 8.8 div), Abyssal Echoes подешевел (≈ 0.08 div), Astrid's Creativity ≈ 3.6 div. Советник берёт цены с poe.ninja вживую. Подробности и поправки — `docs/crafting-methods-research.md`.
Снимок сообщества 0.5 [T17][T14][T13], очень приблизительно:
- **Дёшево (≤ 5 ex):** Preserved-кости (~1 ex), Omen of Greater Exaltation (~4 ex), Putrefaction (~4 ex), Greater Exalted, Greater-эссенции, Necromancy-омены.
- **Средне (≈ 1–10 div):** Abyssal Echoes (~1 div), Perfect Exalted (~2.5 div), Sinistral/Dextral Annulment (~3.5 div за попытку), Omen of Light (5+ div), Ancient Collarbone (~7 div), Erasure-омены («несколько div»), Whittling.
- **Дорого:** Astrid's Creativity (14–20 div), Fracturing Orb (атлас), Hinekora's Lock (сотни div).

---

## 6. Ловушки
- Whittling при нераскрытом desecrated или спецмоде эссенции бьёт в них (§0).
- Desecrate полной вещи снимает случайный мод; Essence of the Abyss → desecrate не снимает (заменяет Mark).
- Перед fracture не раскрывать desecrated; Mark не фиксировать.
- Greater/Perfect-валюта не гарантирует 50+ у семейств с низким потолком (ES Recharge, accuracy и т.п.).
- Омен на сторону без места — крафт не выполнится; включённый, но не использованный омен сработает на следующей валюте (в том числе в превью Hinekora).
- Catalysing тратит всё качество; если после него нужен бонус качества, катализировать заново.
- Временные рецепты из гайдов часто нарушают «1 crafted + 1 desecrated» (Timesaver путает кости по слотам [T14]; в [T17] есть рецепты с двумя desecrate) — сверять с правилами 0.5.

---

## 7. Что советнику моделировать дальше (по приоритету)

1. **Выбор способа удаления плохого мода** (меняет план чаще всего). Кандидаты и их P / цена:
   - сторона-Annul: P = 1/n_side (снимаемые на стороне; fractured не считаются; crafted и desecrated считаются); если n_side = 1 — гарантия;
   - Chaos + Whittling: P = 1, если мод строго минимален по `required_level` среди снимаемых (нераскрытый desecrated — ур. 1, спецмоды эссенций — 0–1); затем новый мод по весам (как Exalt с мин. уровнем валюты);
   - Chaos + Erasure: 1/n_side на удаление + случайный новый мод;
   - Light + Annul (desecrated-мод): P = 1;
   - Perfect-эссенция + Crystallisation (если crafted-слот свободен и мод эссенции нужен): 1/n_side.
   Выбирать минимум из `(цена валюты + омены) / P` плюс ожидаемая стоимость промаха (потеря мода × цена).
2. **Оценка desecrate (раскрытие).** Входы: класс, ilvl, сторона (омен или 50/50), лич-омен (пул эксклюзивов лича для класса и стороны), кость (Ancient → base-моды ≥ 40), группы модов на вещи (исключить). Вероятность, что в наборе есть цель: q ≈ 1 − (1 − s)³, где s — доля веса цели в пуле. Точнее — выборка без возвращения или Монте-Карло. Если весов нет, брать равные. С Echoes: Q = 1 − (1 − q)². Light-петля: E[попыток] = 1/Q, цена = кость + (Light + Annul) × (E − 1) + Echoes × E. Показывать «гарантию», если подходящих модов ≤ 3.
3. **Перебор с двумя модами за Exalt.** Greater Exaltation (+ сторона, + Perfect): две последовательные выборки без возвращения по весам с исключением групп; учитывать исключение для семейств ниже порога (§0).
4. **Fracture-ветка.** Если на вещи ключевой мод и всего ≥ 3 модов: P = 1/k, где k — обычные (не desecrated) моды; всего модов должно быть ≥ 4, desecrated в этот счёт входит. Трюк «3 обычных + 1 нераскрытый» → 1/3 вместо 1/4. Цена промаха = новая база. Затем ожидаемое число Chaos до второго ключевого мода = 1 / p_mod (p_mod — доля веса после удаления).
5. **Учёт слотов: «1 crafted + 1 desecrated» и пути освобождения.** Essence of the Abyss → desecrate освобождает crafted-слот. Whittling или сторона-Annul снимают crafted-мод. Astrid's даёт +1 crafted. Планировщик должен решать, кто займёт crafted-слот: Greater-эссенция на magic→rare, Perfect/corrupted-эссенция или Alloy.
6. **Сторона без омена.** Если одна сторона полная (в том числе за счёт нераскрытого desecrated), обычный Exalt сам выбирает другую. Советовать вместо покупки сторона-омена.
7. **Блокеры.** Если у цели высокий риск «мусорной» группы (Mana на палочке, Accuracy на луке), сравнить EV с блокером (мод группы, затем снятие) и без него: блокер выгоден, когда Δp × цена Perfect-слэма больше цены снятия блокера.
8. **Качество бижутерии.** Пересчитывать значения модов с тегом катализатора (+3 → +4 при ≥ 34%) и учитывать Catalysing (вес ×?; оценка ×5 при 20% — пометить как неточную).
9. **Hinekora's Lock** — только как «страховка» перед необратимым шагом: советовать, если `цена вещи × P(провал) > цена Lock`.
10. **Putrefaction** для дешёвых колчанов и брони (EV по 6 раскрытиям) — отдельный режим «слот-машина».

---

## 8. Источники
- [T1] poe2db, Omen (тексты 0.5) — https://poe2db.tw/us/Omen
- [T2] poe2db, Desecrated Modifiers (0.5: «may include base modifiers», 198 модов личей, все ур. 65; нет префиксов на броне; скипетры без эксклюзивов) — https://poe2db.tw/us/Desecrated_Modifiers
- [T3] poe2db, Essence / Essence of the Abyss — https://poe2db.tw/us/Essence ; https://poe2db.tw/us/Essence_of_the_Abyss
- [T4] poe2db, Hinekora's Lock — https://poe2db.tw/us/Hinekoras_Lock
- [T5] Официальные патчноуты 0.5.0 (Liquid Emotions, Homogenising только в Standard, «Up to 3» для Chaotic-оменов) — https://www.pathofexile.com/forum/view-thread/3932540
- [T6] Форум PoE: «Omen of Greater Exaltation with Perfect Exalted Orb does not guarantee 2 ilvl 50+ mods?» (09.2025) — https://www.pathofexile.com/forum/view-thread/3851632
- [T7] Форум PoE: «Omen of Catalysing Exaltation bugged or just unlucky?» (09.2025) — https://www.pathofexile.com/forum/view-thread/3849100
- [T8] poe2wiki (только сниппеты поиска): Omen of Whittling (нераскрытый desecrated = мод 1-го уровня) — https://poe2wiki.net/wiki/Omen_of_Whittling ; Omen (стек оменов, недопустимые комбо блокируют крафт) — https://www.poe2wiki.net/wiki/Omen ; Perfect/Greater Exalted («at least one tier of each mod will always be eligible») — https://www.poe2wiki.net/wiki/Perfect_Exalted_Orb
- [T9] PoE2 Crafting Codex (domistae, 0.5.x; сам автор называет «provisional») — https://domistae.github.io/poe2-leveling/poe2_crafting_codex.html
- [T10] Sift, Desecration (Craft of Exile, тесты сообщества; часть устарела — «3→6») — https://isayi9999.github.io/sift-public/crafting/desecration
- [T11] PoE2Craft, Abyss & Well of Souls (0.5.4; ошибка: «repeat for second desecrated mod») — https://poe2craft.com/guides/abyss-well-of-souls
- [T12] Timesaver, Fracturing Orb guide (0.5.4, 02.07/24.08.2026) — https://timesaver.gg/blog/poe2-fracturing-orb-guide
- [T13] Timesaver, Hinekora's Lock guide (0.5.4) — https://timesaver.gg/blog/poe2-hinekoras-lock-guide
- [T14] Timesaver, 0.5 Crafting Guide и Omens guide (коммерческие, есть ошибки: Vertebrae «body armour», Cranium «helmets», Sanctification «+ Vaal») — https://timesaver.gg/blog/poe2-0-5-crafting-guide ; https://timesaver.gg/blog/poe2-omens-guide
- [T15] POE2FUN, Essence of the Abyss secrets (дата не указана) — https://poe2fun.com/guides/secret-in-essence-of-the-abyssal
- [T16] vaal.tools, Desecrated modifiers (0.5.5d) — https://www.vaal.tools/mechanics/desecrated_modifiers/
- [T17] fixerpimp-gamer, «PoE2 Crafting DB — 0.5 Return of the Ancients» (49–55 рецептов сообщества, качество неровное) — https://github.com/fixerpimp-gamer/POE2_0.5_Craft_Guides
- [T18] Exile Codex — конспекты видео 0.5/0.5.5: ASaVeQ «simple crafts» (05.09.2026), lilbotq «ring craft» (31.08.2026), Barczi «ES crafting» (06.06.2026) — https://exile.codex-wiki.com/guides/how-i-make-currency-early-with-simple-crafts-poe2-0-5-5 ; https://exile.codex-wiki.com/guides/how-to-get-rich-with-this-early-league-ring-craft-path-of ; https://exile.codex-wiki.com/guides/easy-energy-shield-crafting-for-profit-poe-2-0-5
- [T19] Maxroll (только сниппеты поиска): How to Craft in PoE2; гайды Flameblast Gemling и Hollow Form (Erasure + Whittling + Perfect Chaos) — https://maxroll.gg/poe2/resources/how-to-craft-in-path-of-exile-2 ; https://maxroll.gg/poe2/build-guides/flameblast-oil-grenade-gemling-build-guide ; https://maxroll.gg/poe2/build-guides/hollow-form-whirling-assault-martial-artist-build-guide
- [T20] POE2FUN, Staff guide 0.4.0 (пример устаревшей цепочки с двумя эссенциями и двумя desecrate) — https://poe2fun.com/guides/poe2-staff-crafting-guide
- [T21] poe2db, Astrid's Creativity — https://poe2db.tw/us/Astrids_Creativity
