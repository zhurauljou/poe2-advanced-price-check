// Язык интерфейса (English / Русский) — общий для главного процесса (require) и окон (<script> до app.js).
// Ключ — исходная английская строка, {name} — подстановки. Нет перевода — показываем ключ как есть.
// Игровые названия (предметы, базы, моды, валюта, омены, эссенции, лиги) не переводим: игроки знают их по-английски.
// Значение-массив — формы по числу {n}: в EN [одна, много], в RU [1, 2–4, 5+] (лот / лота / лотов).
(function (root) {
  // Английские формы единственного числа для ключей с {n}.
  const EN = {
    'only {n} similar listings': ['only {n} similar listing', 'only {n} similar listings'],
    '{n} free prefixes': ['{n} free prefix', '{n} free prefixes'],
    '{n} free suffixes': ['{n} free suffix', '{n} free suffixes'],
    '{n} mods in this total': ['{n} mod in this total', '{n} mods in this total'],
  };

  const RU = {
    // ---- окно: вкладки, шапка, подвал ----
    League: 'Лига',
    'Close (Esc)': 'Закрыть (Esc)',
    Close: 'Закрыть',
    Price: 'Цена',
    Demand: 'Спрос',
    Craft: 'Крафт',
    'Search filters': 'Фильтры поиска',
    Search: 'Поиск',
    'Search · filters changed': 'Поиск · фильтры изменены',
    'Esc — close · Enter — search · click a listing — copy whisper': 'Esc — закрыть · Enter — поиск · клик по лоту — копировать шёпот',
    'Trade site ↗': 'Трейд ↗',
    'Current league': 'Текущая лига',
    current: 'текущая',
    'Searching this unique only — click to search any unique on this base': 'Ищем только этот уник — клик: любой уник на этой базе',
    'Click to search this unique only': 'Клик: искать только этот уник',
    'Searching this base only — click to search any item of this class': 'Ищем только эту базу — клик: любая вещь этого класса',
    'Searching any item of this class — click to search this base only': 'Ищем любую вещь этого класса — клик: только эта база',
    '{n}m': '{n}м',
    '{n}h': '{n}ч',
    '{n}d': '{n}д',

    // ---- подсказка предмета ----
    'Searching by this — click to ignore': 'Ищем по этому — клик: не учитывать',
    'Click to search by this': 'Клик: искать по этому',
    'level ≥': 'уровень ≥',
    'Not {lname}': 'Не {name}',
    'only such items': 'только такие',
    'only "{label}"': 'только «{label}»',
    any: 'неважно',
    'Searching only: {label}': 'Ищем только: {label}',
    'Ignored — any': 'Не учитываем — любые',
    'click:': 'клик:',

    // ---- цена ----
    '{x} per {cur}': '{x} за 1 {cur}',
    'Price per unit': 'Цена за штуку',
    'Stack ×{n}': 'Стак ×{n}',
    Stack: 'Стак',
    '7 days': '7 дней',
    '24h volume': 'Объём за 24ч',
    'Estimated price': 'Оценка',
    'Like yours': 'Похожие на вашу',
    'Searching the trade site…': 'Ищем на трейде…',
    'Cheapest listings': 'Самые дешёвые лоты',
    '{n} listings, prices within ×{x}': ['{n} лот, цены в пределах ×{x}', '{n} лота, цены в пределах ×{x}', '{n} лотов, цены в пределах ×{x}'],
    'only {n} similar listings': ['всего {n} похожий лот', 'всего {n} похожих лота', 'всего {n} похожих лотов'],
    'all cheapest listings are a week+ old — those prices may not be real': 'все дешёвые лоты висят неделю+ — цены могут быть нереальными',
    'cheapest prices differ ×{x} — someone may be underpricing': 'дешёвые цены отличаются в ×{x} — возможно, кто-то демпингует',
    Reliable: 'Надёжно',
    'Some data': 'Мало данных',
    'Few listings': 'Мало лотов',
    'Fresh (24h): <b>{n}</b> from {price}': 'Свежих (24ч): <b>{n}</b>, от {price}',
    'cheapest hung {n}d — likely overpriced': 'самый дешёвый висит {n}д — скорее всего, переоценён',
    'newer listings are cheaper': 'новые лоты дешевле',
    'newer listings are pricier': 'новые лоты дороже',
    'estimate from listings ≤ 3 days old': 'оценка по лотам не старше 3 дней',
    'No similar items listed right now': 'Похожих вещей сейчас не продают',
    'It may be a rare high-end item. Uncheck filters or lower the minimums to widen the search.':
      'Возможно, это редкая дорогая вещь. Снимите галочки или уменьшите минимумы, чтобы расширить поиск.',
    'Relax filters': 'Ослабить фильтры',
    'Open trade site': 'Открыть трейд',
    'Same modifiers with any roll of the same tier': 'Те же моды с любым роллом того же тира',
    'Any roll in tier:': 'Любой ролл тира:',
    '{n} listed': ['{n} лот', '{n} лота', '{n} лотов'],
    'your rolls ≈ +{n}%': 'ваши роллы ≈ +{n}%',
    'Searches again without each key modifier (a few trade requests)': 'Ищет заново без каждого ключевого мода (несколько запросов к трейду)',
    'What drives the price?': 'Что формирует цену?',
    'poe.ninja: the cheapest copies of this unique, any rolls': 'poe.ninja: самые дешёвые копии этого уника, роллы любые',
    'poe.ninja (any rolls):': 'poe.ninja (любые роллы):',
    'Listings like yours are cheaper than the plain floor — check the filters': 'Лоты как ваш дешевле самой простой копии — проверьте фильтры',
    'below poe.ninja': 'ниже poe.ninja',
    'Quick sale': 'Быстро',
    Market: 'По рынку',
    Patient: 'Подождать',
    'Just under the cheapest active listing — sells fastest. Cheapest listed: {price}':
      'Чуть ниже самого дешёвого живого лота — уйдёт быстрее всего. Самый дешёвый: {price}',
    'The estimate above': 'Оценка выше',
    'Above the market — wait for a buyer. Median of {n}: {price}': 'Выше рынка — ждать покупателя. Медиана из {n}: {price}',
    'Click to copy the price note': 'Клик — скопировать заметку с ценой',
    'Copied "{note}" — paste it as the price note': 'Скопировано «{note}» — вставьте как заметку с ценой',
    'Filters changed — search first, then check what drives the price': 'Фильтры изменены — сначала поиск, потом «что формирует цену»',
    'Nothing listed without it': 'Без него ничего не продают',
    'Without it: {price}': 'Без него: {price}',
    'adds ~0': '≈ 0',
    '≈{n}% of price': '≈{n}% цены',
    'Search failed': 'Поиск не удался',
    'Try again': 'Ещё раз',
    'No price data for this item': 'Для этой вещи нет данных о цене',
    'Too few listings — relaxed: {list}': 'Мало лотов — ослабили: {list}',
    "Couldn't relax filters further: {why}": 'Дальше ослабить не вышло: {why}',
    'roll minimums → tier floor': 'минимумы роллов → нижняя граница тира',
    'exact base {base}': 'точная база {base}',
    'now any {k} of {n} {what}': 'теперь любые {k} из {n} ({what})',
    'now any {k} of {n} options': 'теперь любые {k} из {n} вариантов',

    // ---- фильтры ----
    'Price impact:': 'Влияние на цену:',
    minor: 'минимальное',
    low: 'низкое',
    medium: 'среднее',
    high: 'высокое',
    'key modifier for this slot': 'ключевой мод для этого слота',
    'tier {n}': 'тир {n}',
    'Near max roll of the top tier — usually worth more': 'Почти максимальный ролл лучшего тира — обычно стоит дороже',
    'Tier range · roll {n}%': 'Диапазон тира · ролл {n}%',
    'This modifier has no trade site filter': 'Для этого мода на трейде нет фильтра',
    'Total from all modifiers': 'Сумма со всех модов',
    total: 'сумма',
    '{pct}% of level {lvl}+ builds wearing this item class have this modifier (poe.ninja)':
      'У {pct}% билдов {lvl}+ уровня с вещью этого класса есть этот мод (poe.ninja)',
    '{pct}% builds': '{pct}% билдов',
    min: 'мин',
    '{n} mods in this total': ['{n} мод в этой сумме', '{n} мода в этой сумме', '{n} модов в этой сумме'],
    'Which currency listings to search': 'Лоты в какой валюте искать',
    Any: 'Любая',
    'Instant Buyout or seller online — like the trade site default': 'Мгновенный выкуп или продавец в сети — как на трейде по умолчанию',
    'Buyable now': 'Купить сейчас',
    'With 3+ minor modifiers checked, find items that have all but one of them (key modifiers stay required)':
      'Если отмечено 3+ второстепенных мода — найти вещи, где есть все, кроме одного (ключевые моды обязательны)',
    'Allow 1 minor mod missing': 'Без 1 мелкого мода',
    'Match ≥': 'Совпадает ≥',
    'of {n} checked': 'из {n} отмеченных',

    // ---- лоты ----
    'Copy whisper to seller': 'Скопировать шёпот продавцу',
    'Instant buyout — opens the trade site (Travel to Hideout)': 'Мгновенный выкуп — открывает трейд (Travel to Hideout)',
    'Instant buyout': 'Мгновенный выкуп',
    'Whisper in game — opens chat with the message, you press Enter': 'Шёпот в игре — откроет чат с сообщением, Enter жмёте вы',
    'Open this listing on the trade site': 'Открыть этот лот на трейде',
    'Show fewer': 'Свернуть',
    'Show all {n}': 'Показать все {n}',
    'Whisper copied — switch to the game and paste it into chat (Enter, Ctrl+V)': 'Шёпот скопирован — переключитесь в игру и вставьте в чат (Enter, Ctrl+V)',
    'Whisper copied — paste it into game chat (Enter, Ctrl+V)': 'Шёпот скопирован — вставьте в чат игры (Enter, Ctrl+V)',
    'Opened on the trade site': 'Открыто на трейде',
    'Opened on the trade site — use Travel to Hideout there': 'Открыто на трейде — там жмите Travel to Hideout',
    'Modifiers better / worse than yours': 'Моды лучше / хуже ваших',

    // ---- карточка конкурента ----
    'yours {x}': 'у вас {x}',
    "Yours has, theirs doesn't:": 'У вашей есть, у этой нет:',
    better: 'лучше',
    worse: 'хуже',
    "you don't have": 'у вас нет',
    'than your item': 'чем у вашей вещи',

    // ---- спрос (poe.ninja) ----
    'Popular builds': 'Популярные билды',
    'Loading from poe.ninja…': 'Загружаем с poe.ninja…',
    'No poe.ninja data': 'Нет данных poe.ninja',
    'poe.ninja has no build stats for this item class.': 'У poe.ninja нет статистики билдов для этого класса вещей.',
    'Worn by <b>{pct}%</b> of level {lvl}+ builds': 'Носят <b>{pct}%</b> билдов {lvl}+ уровня',
    'Your item:': 'Ваша вещь:',
    'base #{n}': 'база №{n}',
    'base not in top 10': 'базы нет в топ-10',
    '{n} of top {m} modifiers': '{n} из топ-{m} модов',
    'Most worn bases': 'Самые носимые базы',
    'Most common modifiers': 'Самые частые моды',
    'Your item has this': 'Есть на вашей вещи',
    'Most builds use this': 'Это берут почти все билды',
    Characters: 'Персонажи',
    'Whose gear counts: higher level = players who pay for exact modifiers': 'Чью экипировку считаем: выше уровень — игроки, которые платят за точные моды',
    High: 'Высокий',
    Med: 'Средний',
    Low: 'Низкий',
    '{n} level {lvl}+ characters on poe.ninja use this': ['{n} персонаж {lvl}+ уровня на poe.ninja использует это', '{n} персонажа {lvl}+ уровня на poe.ninja используют это', '{n} персонажей {lvl}+ уровня на poe.ninja используют это'],
    '{pct}% of builds': '{pct}% билдов',
    'one build archetype dominates': 'преобладает один архетип билда',
    '{n} characters': ['{n} персонаж', '{n} персонажа', '{n} персонажей'],
    '<b>{pct}%</b> of builds': '<b>{pct}%</b> билдов',
    'poe.ninja filter': 'Фильтр poe.ninja',
    Ascendancy: 'Асцендант',
    'Main skill': 'Основной скилл',
    'No builds use this': 'Билдов с этим нет',
    'No characters on poe.ninja wear this combination.': 'На poe.ninja нет персонажей с такой комбинацией.',
    'Not on poe.ninja:': 'Нет на poe.ninja:',

    // ---- крафт ----
    'Loading mod pool…': 'Загружаем пул модов…',
    'Mod pool not loaded': 'Пул модов не загрузился',
    'Search for your item with this modifier added (lowest roll of the tier)': 'Поиск вашей вещи с этим модом (нижний ролл тира)',
    'price?': 'цена?',
    '{essence} makes a magic item rare with this modifier: {tiers}': '{essence} делает магическую вещь редкой с этим модом: {tiers}',
    'Nothing like it is listed — could be rare and pricey': 'Таких не продают — может быть редкой и дорогой',
    'none listed': 'нет лотов',
    same: 'так же',
    '{n} listed with it · vs your current estimate': ['{n} лот с ним · относительно текущей оценки', '{n} лота с ним · относительно текущей оценки', '{n} лотов с ним · относительно текущей оценки'],
    "{state} — can't be modified": '{state} — менять нельзя',
    'Its modifiers are locked. The Price tab shows what it is worth as is.': 'Моды заблокированы. Вкладка «Цена» покажет, сколько вещь стоит как есть.',
    'See price': 'К цене',
    'No craft tips': 'Нет советов по крафту',
    Prefixes: 'Префиксы',
    Suffixes: 'Суффиксы',
    '{n} free prefixes': ['{n} свободный префикс', '{n} свободных префикса', '{n} свободных префиксов'],
    '{n} free suffixes': ['{n} свободный суффикс', '{n} свободных суффикса', '{n} свободных суффиксов'],
    'Popular prefixes that can roll here (best tier for this item level):': 'Популярные префиксы, которые могут выпасть (лучший тир для этого ilvl):',
    'Popular suffixes that can roll here (best tier for this item level):': 'Популярные суффиксы, которые могут выпасть (лучший тир для этого ilvl):',
    'No popular modifiers left for this side.': 'Популярных модов для этой стороны не осталось.',
    'Full — replace the weakest prefix': 'Всё занято — заменить самый слабый префикс',
    'Full — replace the weakest suffix': 'Всё занято — заменить самый слабый суффикс',
    'Could become:': 'Может стать:',
    Desecration: 'Осквернение (Desecration)',
    'Popular desecrated modifiers for this base:': 'Популярные desecrated-моды для этой базы:',
    'Make it rare first': 'Сначала сделать редкой',
    'Removes a random modifier and adds its own guaranteed one:': 'Убирает случайный мод и добавляет свой гарантированный:',
    'Full — all modifiers are top tier': 'Всё занято — все моды топ-тира',
    'Nothing worth replacing.': 'Менять нечего.',
    'Cheap and safe': 'Дёшево и без риска',
    'Demand % below is among {n} builds that wear this item class with these modifiers': 'Спрос в % ниже — среди {n} билдов, которые носят вещь этого класса с этими модами',
    'Demand among builds using': 'Спрос среди билдов с',
    "Mod pool: game files (RePoE). Roll chances aren't shown — PoE 2 files have no modifier weights.":
      'Пул модов: файлы игры (RePoE). Шансов выпадения нет — в файлах PoE 2 нет весов модов.',
    '% = share of those builds using the modifier (poe.ninja). «price?» — what your item would cost with it.':
      '% — доля этих билдов с модом (poe.ninja). «цена?» — сколько стоила бы вещь с ним.',
    // советы (craft.js)
    'Craft tips are for rare and magic items.': 'Советы по крафту — только для редких и магических вещей.',
    'Turn on "Advanced Mod Descriptions" in the game options (or copy with Ctrl+Alt+C) to get craft tips.':
      'Включите «Advanced Mod Descriptions» в настройках игры (или копируйте через Ctrl+Alt+C), чтобы получить советы по крафту.',
    'Unknown base "{base}" in RePoE data.': 'База «{base}» не найдена в данных RePoE.',
    'No item': 'Нет предмета',
    'a bone (Rib / Jawbone / Collarbone / Cranium)': 'кость (Rib / Jawbone / Collarbone / Cranium)',
    'item level ≤ 64': 'ilvl ≤ 64',
    'only modifier level 40+': 'только моды 40+ уровня',
    '{essence} — rare with guaranteed {mod}: {tiers}': '{essence} — редкая с гарантированным {mod}: {tiers}',
    'Regal Orb — makes it rare with one random modifier from the whole pool; the popular ones below are only some of the outcomes':
      'Regal Orb — делает редкой с одним случайным модом из всего пула; популярные ниже — лишь часть исходов',
    'Greater / Perfect Regal Orb — the same, but only modifiers of level 35+ / 50+': 'Greater / Perfect Regal Orb — то же, но только моды 35+ / 50+ уровня',
    'Omen of Sinistral / Dextral Coronation — the next Regal Orb adds only a prefix / only a suffix':
      'Omen of Sinistral / Dextral Coronation — следующий Regal Orb добавит только префикс / только суффикс',
    "Hinekora's Lock — see the result of the next currency before using it": "Hinekora's Lock — показывает результат следующей валюты до применения",
    'only prefixes': 'только префиксы',
    'only suffixes': 'только суффиксы',
    "after it's rare: {how}": 'когда станет редкой: {how}',
    'Greater / Perfect Exalted Orb — only modifiers of level 35+ / 50+': 'Greater / Perfect Exalted Orb — только моды 35+ / 50+ уровня',
    'Omen of Greater Exaltation — the next Exalted Orb adds two modifiers': 'Omen of Greater Exaltation — следующий Exalted Orb добавит два мода',
    'Orb of Annulment + Omen of Light — removes only the desecrated modifier, then Exalted Orb (or desecrate again)':
      'Orb of Annulment + Omen of Light — убирает только desecrated-мод, затем Exalted Orb (или снова Desecrate)',
    'Orb of Annulment + {omen} — removes a random prefix (1 in {n} to hit this one), then Exalted Orb':
      'Orb of Annulment + {omen} — убирает случайный префикс (шанс попасть в этот — 1 из {n}), затем Exalted Orb',
    'Orb of Annulment + {omen} — removes a random suffix (1 in {n} to hit this one), then Exalted Orb':
      'Orb of Annulment + {omen} — убирает случайный суффикс (шанс попасть в этот — 1 из {n}), затем Exalted Orb',
    'Chaos Orb + {omen} — removes a random prefix and adds a random modifier (Greater / Perfect Chaos: level 35+ / 50+)':
      'Chaos Orb + {omen} — убирает случайный префикс и добавляет случайный мод (Greater / Perfect Chaos: 35+ / 50+ уровня)',
    'Chaos Orb + {omen} — removes a random suffix and adds a random modifier (Greater / Perfect Chaos: level 35+ / 50+)':
      'Chaos Orb + {omen} — убирает случайный суффикс и добавляет случайный мод (Greater / Perfect Chaos: 35+ / 50+ уровня)',
    'Chaos Orb + Omen of Whittling — removes the lowest-level modifier (this one) and adds a random modifier':
      'Chaos Orb + Omen of Whittling — убирает мод самого низкого уровня (этот) и добавляет случайный',
    'Desecrate with {bone} — adds an unrevealed desecrated modifier': 'Desecrate: {bone} — добавляет нераскрытый desecrated-мод',
    'replaces a random one when full': 'если всё занято — заменяет случайный',
    'Omen of Sinistral / Dextral Crystallisation — the Perfect Essence removes only a prefix / only a suffix':
      'Omen of Sinistral / Dextral Crystallisation — Perfect-эссенция уберёт только префикс / только суффикс',
    "Artificer's Orb — add an augment socket, then a rune or soul core": "Artificer's Orb — добавить гнездо, затем руну или soul core",
    'Quality to 20% (currently {n}%) — {currency}': 'Качество до 20% (сейчас {n}%) — {currency}',
    'Catalyst — quality on rings and amulets boosts matching modifiers (life, minion, caster…); with Omen of Catalysing Exaltation the next Exalted Orb favours that type':
      'Catalyst — качество на кольцах и амулетах усиливает моды своего типа (life, minion, caster…); с Omen of Catalysing Exaltation следующий Exalted Orb чаще даёт этот тип',
    'Refined Catalyst — quality on jewels boosts matching modifiers': 'Refined Catalyst — качество на самоцветах усиливает моды своего типа',
    'Fracturing Orb — locks a random modifier in place (rare with 4+ modifiers); worth it when most modifiers are good':
      'Fracturing Orb — закрепляет случайный мод (редкая с 4+ модами); стоит, когда большинство модов хорошие',

    // ---- главный процесс: статусы, ошибки трейда, трей, уведомления ----
    'Failed to load data: {msg}': 'Не удалось загрузить данные: {msg}',
    'Waiting for the trade site rate limit… {n} s': 'Ждём лимит запросов трейда… {n} с',
    '{n} min': '{n} мин',
    '{n} s': '{n} с',
    'Trade site rate limit hit — wait {time}': 'Упёрлись в лимит трейда — подождите {time}',
    'Trade request limit almost used up — wait {time}': 'Лимит запросов к трейду почти исчерпан — подождите {time}',
    'Trade site responded {n}': 'Трейд ответил {n}',
    '{key} over an item': '{key} над предметом',
    '{key} — price check the item under cursor': '{key} — оценить предмет под курсором',
    'League: {name}': 'Лига: {name}',
    Hotkey: 'Горячая клавиша',
    'Hotkey only in Path of Exile': 'Горячая клавиша только в Path of Exile',
    'Start with Windows': 'Запускать с Windows',
    'Reset window position': 'Сбросить положение окна',
    'Interface language': 'Язык интерфейса',
    'Without: {mod}': 'Без: {mod}',
    '{essence} — makes it rare with {mod}': '{essence} — сделает редкой с {mod}',
    'Regal Orb — makes it rare (random modifier)': 'Regal Orb — сделает редкой (случайный мод)',
    'Remove {mods}: Orb of Annulment + Omen of {S} Annulment (random {side}), or Chaos Orb + Omen of Whittling if it is the lowest-level modifier': 'Убрать {mods}: Orb of Annulment + Omen of {S} Annulment (случайный {side}) или Chaos Orb + Omen of Whittling, если это мод самого низкого уровня',
    'Add {mods}: Exalted Orb + Omen of {S} Exaltation': 'Добавить {mods}: Exalted Orb + Omen of {S} Exaltation',
    ' (Omen of Greater Exaltation adds two)': ' (Omen of Greater Exaltation добавит два)',
    'Goal': 'Цель',
    'Price all and sort': 'Оценить все и отсортировать', 'pricing…': 'оцениваю…',
    'One trade search per row, then the list is sorted by how much each modifier adds to the price': 'По одному поиску на строку, затем список сортируется по приросту цены',
    common: 'частый', uncommon: 'средний', rare: 'редкий', 'chance ?': 'шанс ?',
    'Valuable modifiers cannot be estimated from trade listings — items with them are priced and listed differently': 'Шанс ценных модов по трейду не оценить — вещи с ними выставляют и оценивают иначе',
    'Rough estimate: Exalted Orb + omen of its side gives this modifier about 1 in {n} times': 'Грубая оценка: Exalted Orb с оменом этой стороны даёт этот мод примерно 1 раз из {n}',
    'Chances are rough estimates from {n} cheap trade listings ({date}) — PoE 2 game files have no modifier weights. Treat them as "common / rare", not exact odds.': 'Шансы — грубая оценка по {n} дешёвым лотам трейда ({date}): в файлах PoE 2 весов модов нет. Ориентируйтесь на «частый / редкий», а не на точные числа.',
    'Mod pool: game files (RePoE).': 'Пул модов: файлы игры (RePoE).',
    'Divine Orb — rerolls the value, but only within T{tier}': 'Divine Orb — перекатывает значение, но только внутри T{tier}',
    'Orb of Annulment + Omen of Light removes it; desecrating again gives a random desecrated modifier — not necessarily this one': 'Orb of Annulment + Omen of Light уберёт его; новое осквернение даст случайный desecrated-мод — не обязательно этот',
    'A higher tier means removing it and rolling it again — the same modifier is not guaranteed': 'Тир повыше — только снять и выкатить заново, тот же мод не гарантирован',
    'Key modifier, weak tier — keep it': 'Ключевой мод со слабым тиром — оставьте',
    'Key modifier with a weak tier — a higher tier is worth more': 'Ключевой мод со слабым тиром — тир повыше стоит дороже',
    tier: 'тир',
    'Not worth it — your item is already worth more as it is': 'Не стоит того — вещь уже дороже как есть',
    now: 'сейчас', prefix: 'префикс', suffix: 'суффикс',
    'The best item this base can become — most wanted modifiers for its slots': 'Лучшая вещь из этой базы — самые востребованные моды на её места',
    'keep': 'оставить', 'remove': 'убрать', 'add': 'добавить',
    'Steps': 'Шаги',
    'Price the goal': 'Оценить цель',
    'Goal ≈ {price}': 'Цель ≈ {price}',
    'Listings that have this modifier are excluded — your item lacks it': 'Лоты с этим модом исключены — у вашей вещи его нет',
    'No "{mod}" — {pct}% of builds have it': 'Нет «{mod}» — он есть у {pct}% билдов',
    'Compared with listings that lack it too; with it the item would be worth much more — see Craft': 'Сравнение с такими же вещами без него; с ним вещь стоила бы намного дороже — см. Крафт',
    'Listings with it are included — the estimate is likely too high': 'Лоты с ним включены — оценка, скорее всего, завышена',
    'Game client language': 'Язык клиента игры',
    'Auto': 'Автоматически',
    Quit: 'Выход',
    '{v} (from source)': '{v} (из исходников)',
    'Update v{v} available…': 'Доступно обновление v{v}…',
    'Downloading v{v}… {pct}%': 'Скачиваем v{v}… {pct}%',
    'Restart to update to v{v}…': 'Перезапустить для обновления до v{v}…',
    'Check for updates ({v})…': 'Проверить обновления ({v})…',
    'Update v{v} is available — click to open.': 'Доступно обновление v{v} — нажмите, чтобы открыть.',
    'Update v{v} is downloaded — click to install.': 'Обновление v{v} скачано — нажмите, чтобы установить.',

    // ---- окно «Updates» ----
    Updates: 'Обновления',
    'Installed:': 'Установлена:',
    "What's new ↗": 'Что нового ↗',
    'Running from source': 'Запуск из исходников',
    'Updates come via git pull.': 'Обновления — через git pull.',
    'Checking for updates…': 'Проверяем обновления…',
    'You have the latest version': 'У вас последняя версия',
    'Check again': 'Проверить ещё раз',
    'Version <b>v{v}</b> is available': 'Доступна версия <b>v{v}</b>',
    Download: 'Скачать',
    'Downloading <b>v{v}</b>…': 'Скачиваем <b>v{v}</b>…',
    '{a} of {b}': '{a} из {b}',
    'Starting…': 'Начинаем…',
    '<b>v{v}</b> is downloaded': '<b>v{v}</b> скачана',
    'Restart to install now — or it installs when you quit the app.': 'Перезапустите, чтобы установить сейчас, — или установится при выходе из программы.',
    'Restart & install': 'Перезапустить и установить',
    'Update check failed': 'Не удалось проверить обновления',
    'Check for updates': 'Проверить обновления',
  };

  let lang = 'en';

  // Форма по числу: RU — 1 / 2–4 / 5+ (11–14 — как 5+), EN — 1 / остальные.
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }

  function t(key, vars) {
    let s = (lang === 'ru' && RU[key]) || EN[key] || key;
    if (Array.isArray(s)) {
      const n = vars && vars.n != null ? Number(vars.n) : 0;
      s = s.length === 3 ? plural(n, s[0], s[1], s[2]) : (Math.abs(n) === 1 ? s[0] : s[1]);
    }
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (m, k) => {
      if (vars[k] == null) return m;
      return typeof vars[k] === 'number' ? vars[k].toLocaleString('en-US') : String(vars[k]);
    });
  }

  const setLang = (l) => { lang = l === 'ru' ? 'ru' : 'en'; };
  const getLang = () => lang;

  const api = { t, plural, setLang, getLang, RU };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.i18n = api;
}(typeof window !== 'undefined' ? window : this));
