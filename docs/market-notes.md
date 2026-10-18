# PoE 2 — рынок и спрос (для оценки цены)

- **Актуально для:** 0.5.5, лига Forbidden Rites. **Составлено:** 2026-10-18.
- **Источник:** гайды Mobalytics (поиск агентом, пересказ; даты — по данным сайта). Почти всё здесь — **M/L** (сообщество):
  проверять на трейде и poe.ninja, прежде чем закладывать в код. Метки доверия — см. [README](README.md).
- **Пока не используется кодом** — это идеи для оценки цены и советника крафта (раздел 6).

Сокращение ссылок: G = `https://mobalytics.gg/poe-2/guides/`.

## 1. Что дорого кроме редкой экипировки

**Белые (Normal) базы** — G`negative-rarity-farming` (обн. 2026-05-27, стратегия эпохи 0.4), **L**:
- Топовые базы ilvl 80–82 — заготовки под Perfect-валюту; базы Exceptional (лишнее гнездо или качество выше 20%) —
  «сотни Divine» у лучших.
- Посохи и палочки с уровнем умения 20 (Grants Skill) — «несколько Divine».
- Камни умений 20 уровня, Spirit-камни 19–20; высокоуровневые обереги (Charms) — заготовки под Perfect Transmute/Augment.
- Уровень дропа: обычные и магические монстры — уровень зоны, редкие +1, уники +2.
- Как оценивают: по poe.ninja — какие базы носят, затем трейд по обычным неосквернённым базам с ilvl 80 / 81 / 82.

**Не экипировка** — G`atlas-rushing-farming-strategy` (2026-09-05), **L**:
- Head of the King — обычно больше 1 div; Breachlord Sacs (гарантированный дроп).
- Lineage-поддержки Rakiata's Flow, Garukhan's Resolve — «очень дорого».
- The Taming из Berek's Grip + Berek's Pass + Berek's Respite продаётся заметно дороже трёх колец по отдельности.
- Immured Fury — гарантированный Fracturing Orb; фрагменты Arbiter of Divinity — «несколько div», дороже всего в начале лиги.
- Самоцветы Ingenuity, From Nothing.

**«Лестница» для хранения ценности:** Abyssal Echoes → Whittling / Omen of Light → Hinekora's Lock → Mirror; дорогие
вещи сообщество считает в Mirror — G`league-start-gearing-guide` (обн. 2026-10-01), **L**.

## 2. Пороги item level (для крафта и оценки баз)

- **Ботинки** — G`league-start-gearing-guide`, **M** (сходится с RePoE: проверить по тирам):
  полезные пороги — **71** (T2 сопротивления) и **82** (T1 Movement Speed + T1 сопротивления). На 72, 74, 75 добавляются
  «мусорные» тиры (Stun Threshold, Int, гибрид Stun, Reduced Ailment Duration) — база ilvl 71 даёт лучшие шансы на
  «MS + 3 сопротивления», чем 72–81.
- **Путевые камни и открытия** (тот же гайд): T1 (зона 65) — 30% MS, +2 к миньонам / ближнему бою, крит, скорость атаки;
  T7 (71) — сопротивления до 40%; T11 (75) — +3 к умениям, лучший flat-урон, T1 flat physical.
- «+2 Melee Skills» на перчатках и «+2 Minion Skills» на шлеме бывают уже с ilvl 41 — G`ssf-crafting` (2026-06-24), **L**.

## 3. Спрос: билды 0.5.5

**Тир-лист стартеров** (`https://mobalytics.gg/poe-2/tier-list`, обн. 2026-07-30), **L** (мнение редакции):
S — Deadeye, Infernalist, Martial Artist, Spirit Walker, Tactician, Gemling; A — Amazon, Blood Mage, Disciple of Varashta,
Lich, Oracle, Shaman, Titan; B — Pathfinder, Stormweaver, Witchhunter, Acolyte, Invoker; C — Chronomancer;
D — Ritualist, Smith, Warbringer.

**Что носят популярные билды 0.5.5** (страницы билдов, сентябрь–октябрь 2026), **M** — сходится с тем, что программа уже
берёт из poe.ninja:
- ботинки: 30–35% Movement Speed + три сопротивления (35% — только ilvl 82+);
- амулеты: +3 / +4 к уровню умений вместе со Spirit;
- фарм-билды: Item Rarity на всех слотах;
- билды на броне: «+X% of Armour also applies to Elemental Damage»;
- посохи заклинателей: +7 / +8 к уровню заклинаний стихии, «Explicit <стихия> Modifier magnitudes» (руна);
- уники-«ключи»: Headhunter, Mageblood, Kalandra's Touch.

**Миньоны — порядок ценности** (G`minion-summoner-gear-and-invest-priority-guide-mattjestic`, 2026-05-28), **M**:
уровни миньонов → Spirit → снижение резерва (окупается только после 200–300 Spirit). Источники уровней: скипетр до +4,
амулет +3, шлем +2 (+1 от порчи). Порядок слотов по вложениям: оружие > амулет / тело > шлем / кольца / ботинки.
В программе уже: Puppet Master и Command Skills — ниша миньонов (`pricing.js`).

## 4. Скрижали (Tablets)

G`towers-and-tablets` (2026-07-21), **M**:
- Слотов под скрижали у путевого камня: 0–2 мода → 1, 3–5 → 2, 6+ → 3; биом City с Industrial Improvements — 4.
- Скрижали только Magic, пока не взяты пассивы атласа Reverse Transcription / Partial Translation.
- Три скрижали одного типа отключают остальной контент на карте.
- Уникальные скрижали: Visions of Paradise, Mastered Domain, Unforeseen Consequences и др.
- Ancient Infuser на скрижали: уничтожает, лишний мод сверх лимита, +10 использований или смена типа с перекатом
  (G`vaal-currency`, 2026-07-21).

## 5. Механики лиги, которые программа не разбирает

- **Sacred Bloom / Viridian Wildwood** — G`how-to-viridian-wildwood-sacred-bloom` (2026-09-19), G`0-5-5-content-summary`
  (2026-08-28), **M**: виспы Wild / Vivid / Primal / Sacred (Sacred добавляет боссов карт в редкие пачки), алтари с оменами.
- **Trial of Chaos 0.5.5** — G`trial-of-chaos` (2026-09-23), **M**: до 30 комнат, награды — только валюта и Soul Cores, ставки
  (Future удваивает стак следующих наград валютой, Present — текущих).
- **Runeforged** — предметы «Runeforged <имя>», повторно нельзя; на The Brass Dome вся броня становится Runic Ward
  (G`runic-ward`, 2026-06-22).
- **Runeseeker's Call** (уник-палочка): 5 гнёзд аугментов с 200% эффекта рун, порча может дать 6-е (G`runeseekers-call`).

## 6. Идеи для программы (не сделано)

| Идея | Основание |
|---|---|
| ~~Оценка белых баз по ilvl ступенями~~ — сделано 0.3.139: ilvl ищется от уровня последнего открытого тира до следующего (`craft.ilvlBand`) | §1 |
| Подсказка «удачный ilvl» по слоту (ботинки 71 против 72–81) | §2 |
| Помощник по скрижалям: слоты от числа модов камня, Magic/Rare, уникальные. Сделано 0.3.139: поиск по «Uses Remaining», ilvl выключен, Craft честно «советов нет». Нужен живой текст скрижали (тест собран по памяти) | §4 |
| Цена в Mirror / Hinekora's Lock для очень дорогих вещей | §1 |
| Проверить, как оцениваются Head of the King, lineage-поддержки, фрагменты Arbiter; рецепт The Taming | §1 |
| Runeforged-предметы и гнёзда Runeseeker's Call | §5 |
| Спрос из билдов Mobalytics в дополнение к poe.ninja — **не делать**: у сайта нет открытого API (только внутренний, закрытый защитой от ботов) | — |
