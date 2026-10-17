// Советы по крафту: что и чем можно добавить или заменить, чтобы вещь стала дороже.
// Пул модов — RePoE (выгрузка из файлов игры): какие моды и тиры вообще могут встать на эту базу.
// Весов выпадения в файлах PoE 2 нет (только «может / не может»), поэтому вероятностей не считаем —
// показываем, какие ВОСТРЕБОВАННЫЕ (по poe.ninja) моды могут встать и каким способом.

const stats = require('./stats');
const fsW = require('fs');
const pathW = require('path');

// Оценка весов модов (scripts/collect-weights.js — по дешёвым лотам трейда, не данные игры). Нет файла — без шансов.
let weightsData;
function weights() {
  if (weightsData === undefined) {
    try { weightsData = JSON.parse(fsW.readFileSync(pathW.join(__dirname, '..', '..', 'data', 'weights.json'), 'utf8')); } catch { weightsData = null; }
  }
  return weightsData;
}
const { essenceFor, perfectFor } = require('./essences');
const { t } = require('../shared/i18n');

const REPOE = 'https://repoe-fork.github.io/poe2';

let data = null; // { bases: Map name→base, pool: [...] }

async function load(cached) {
  if (data) return data;
  const [mods, bases] = await Promise.all([
    cached('repoe-mods.json', `${REPOE}/mods.min.json`, 24 * 7),
    cached('repoe-base-items.json', `${REPOE}/base_items.min.json`, 24 * 7),
  ]);
  const byName = new Map();
  for (const b of Object.values(bases)) if (b.name && !byName.has(b.name)) byName.set(b.name, b);
  // Моды самоцветов лежат в домене 'misc' — для крафта это те же «обычные» моды, что и 'item'.
  const pool = Object.entries(mods)
    .filter(([, m]) => (m.domain === 'item' || m.domain === 'misc' || m.domain === 'desecrated')
      && (m.generation_type === 'prefix' || m.generation_type === 'suffix'))
    .map(([id, m]) => ({ id, ...m, domain: m.domain === 'misc' ? 'item' : m.domain, lines: templates(m.text) }));
  // Строки модов по семейству — чтобы знать спрос семейства (для «причины продажи» в оценке шансов).
  const typeLines = new Map();
  for (const m of pool) if (!typeLines.has(m.type)) typeLines.set(m.type, m.lines);
  data = { bases: byName, pool, typeLines };
  return data;
}

// «(39-42)% increased [EnergyShield|Energy Shield]» → «#% increased energy shield» — как моды у poe.ninja.
function templates(text) {
  return String(text || '').split('\n').map((l) => l
    .replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1')
    .replace(/\(-?[\d.]+--?[\d.]+\)/g, '#')
    .replace(/-?\d+(?:\.\d+)?/g, '#')
    .replace(/\+#/g, '#')
    .trim().toLowerCase()).filter(Boolean);
}

// Фильтры трейда для мода с нижним роллом тира: «(39-42)% increased [EnergyShield|Energy Shield]» → 39% … → стат.
// null — если хоть одну строку не сопоставили (тогда цену после крафта не считаем).
function tradeStats(mod, domain, itemClass) {
  const lines = String(mod.text || '').split('\n').map((l) => l
    .replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1')
    .replace(/\((-?[\d.]+)--?[\d.]+\)/g, '$1').trim()).filter(Boolean);
  const out = lines.map((l) => stats.statFor(l, domain === 'desecrated' ? 'desecrated' : 'explicit', itemClass));
  return out.every(Boolean) ? out.map((s) => ({ statId: s.statId, min: s.value })) : null;
}

// Порченые эссенции и Alloy (собрано с poe2db, data/crafting-currency.json): что добавят на этот класс вещей.
let currencyData;
function guaranteedFor(itemClass) {
  if (currencyData === undefined) {
    try { currencyData = JSON.parse(fsW.readFileSync(pathW.join(__dirname, '..', '..', 'data', 'crafting-currency.json'), 'utf8')); } catch { currencyData = null; }
  }
  if (!currencyData) return [];
  const out = [];
  for (const [list, kind] of [[currencyData.corruptedEssences, 'corrupted essence'], [currencyData.alloys, 'alloy']]) {
    for (const x of list || []) {
      const mods = [...new Set((x.mods || []).filter((m) => m.classes.includes(itemClass)).map((m) => m.text))];
      if (mods.length) out.push({ name: `${x.name} (${t(kind)})`, mod: mods.join(' / ') });
    }
  }
  return out;
}

// Вес мода на базе: первый тег из spawn_weights, который есть у базы (в PoE 2 — только 0 или 1).
function canRoll(mod, tags) {
  for (const sw of mod.spawn_weights || []) if (tags.includes(sw.tag)) return sw.weight > 0;
  return false;
}

// Кости для Desecration по слоту (poe2db): Gnawed — только до ilvl 64, Preserved — любые, Ancient — моды от 40 уровня.
// Cranium (самоцветы) бывает только Preserved.
const BONES = { armour: 'Rib', weapon: 'Jawbone', quiver: 'Jawbone', ring: 'Collarbone', amulet: 'Collarbone', belt: 'Collarbone', jewel: 'Cranium' };

function boneFor(tags, ilvl) {
  const bone = Object.entries(BONES).find(([tag]) => tags.includes(tag));
  if (!bone) return t('a bone (Rib / Jawbone / Collarbone / Cranium)');
  if (bone[1] === 'Cranium') return 'Preserved Cranium';
  return `${ilvl <= 64 ? `Gnawed ${bone[1]} (${t('item level ≤ 64')}) / ` : ''}Preserved ${bone[1]} / Ancient ${bone[1]} (${t('only modifier level 40+')})`;
}

// Валюта качества по классу вещи.
function qualityCurrency(tags) {
  if (tags.includes('wand') || tags.includes('staff') || tags.includes('sceptre')) return "Arcanist's Etcher";
  if (tags.includes('weapon')) return "Blacksmith's Whetstone";
  return "Armourer's Scrap";
}

const range = (text) => {
  const m = String(text || '').match(/\((-?[\d.]+)-(-?[\d.]+)\)/);
  return m ? `${m[1]}–${m[2]}` : null;
};

// item — разобранный предмет (item.affixes из расширенного формата), demandMods — [{ name, pct }] с poe.ninja.
async function advise(item, demandMods, cached) {
  if (item.rarity !== 'Rare' && item.rarity !== 'Magic') return { note: t('Craft tips are for rare and magic items.') };
  if (item.corrupted || item.mirrored || item.sanctified) {
    return { blocked: item.corrupted ? 'Corrupted' : item.mirrored ? 'Mirrored' : 'Sanctified' };
  }
  if (!item.affixes || !item.affixes.length) {
    return { note: t('Turn on "Advanced Mod Descriptions" in the game options (or copy with Ctrl+Alt+C) to get craft tips.') };
  }
  const d = await load(cached);
  const base = d.bases.get(item.baseType);
  if (!base) return { note: t('Unknown base "{base}" in RePoE data.', { base: item.baseType }) };
  const tags = base.tags || [];
  // Самоцветы: у каждого мода один тир уровня 1 — Greater/Perfect валюта и Whittling бесполезны (docs/jewels-crafting.md).
  const jewel = tags.includes('jewel');
  const ilvl = item.ilvl || 100;

  // Моды, которые могут встать на эту базу, и наши аффиксы среди них (по имени и стороне).
  const onBase = d.pool.filter((m) => canRoll(m, tags));
  const mine = item.affixes.map((a) => ({
    ...a, mod: onBase.find((m) => m.name === a.name && m.generation_type === a.side) || null,
  }));
  const present = new Set(mine.flatMap((a) => (a.mod ? a.mod.groups || [] : [])));

  // Сколько мест: у редкой 3+3 (у самоцветов 2+2 — всего 4 мода), у магической 1+1;
  // «-1 Suffix Modifier allowed» и т.п. — поправка.
  // Магическую вещь Regal Orb делает редкой — поэтому места считаем как у редкой, а первым шагом советуем Regal.
  const magic = item.rarity === 'Magic';
  const perSide = tags.includes('jewel') ? 2 : 3;
  const max = { prefix: perSide, suffix: perSide };
  for (const l of item.modLines || []) {
    const m = l.text.match(/^([+-]\d+) (Prefix|Suffix) Modifiers? allowed$/);
    if (m) max[m[2].toLowerCase()] += Number(m[1]);
  }
  const used = { prefix: mine.filter((a) => a.side === 'prefix').length, suffix: mine.filter((a) => a.side === 'suffix').length };
  const open = { prefix: Math.max(0, max.prefix - used.prefix), suffix: Math.max(0, max.suffix - used.suffix) };

  // Востребованные моды (≥ 15% билдов), которые могут встать: лучший доступный по ilvl тир.
  const want = new Map((demandMods || []).filter((r) => r.pct >= 15).map((r) => [r.name.toLowerCase(), r.pct]));
  // Строки, которые на вещи уже есть, не делают кандидата востребованным: у гибрида «броня / урон миньонов»
  // спрос считаем по броне — урон миньонов у вещи уже есть (а при спросе «среди билдов с ним» он был бы 100%).
  const own = new Set((item.modLines || []).flatMap((l) => templates(l.text)));
  const candidates = (domain) => {
    const byType = new Map();
    for (const m of onBase) {
      if (m.domain !== domain || m.is_essence_only) continue;
      const pct = Math.max(0, ...m.lines.filter((l) => !own.has(l)).map((l) => want.get(l) || 0));
      if (!pct || (m.groups || []).some((g) => present.has(g))) continue;
      if (!byType.has(m.type)) byType.set(m.type, { side: m.generation_type, pct, tiers: [] });
      byType.get(m.type).tiers.push(m);
    }
    return [...byType.values()].map((c) => {
      const tiers = c.tiers.sort((a, b) => b.required_level - a.required_level);
      const bestIdx = tiers.findIndex((m) => m.required_level <= ilvl);
      if (bestIdx < 0) return null;
      const best = tiers[bestIdx];
      return { side: c.side, pct: c.pct, text: best.lines.join(' / '), tier: bestIdx + 1, tiers: tiers.length,
        range: range(best.text), level: best.required_level, stats: tradeStats(best, domain, item.itemClass), type: best.type };
    }).filter(Boolean).sort((a, b) => b.pct - a.pct);
  };

  // Ключевой мод со слабым тиром: его носят многие билды, но тир низкий — ценен тир повыше, а не другой мод.
  const tierUps = mine.filter((a) => a.mod && a.tag !== 'fractured' && a.tier >= 3).map((a) => {
    const pct = Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0));
    if (pct < KEY_PCT) return null;
    const tiers = onBase.filter((m) => m.type === a.mod.type && m.domain === a.mod.domain).sort((x, y) => y.required_level - x.required_level);
    const bestIdx = tiers.findIndex((m) => m.required_level <= ilvl);
    if (bestIdx < 0 || bestIdx + 1 >= a.tier) return null;
    const how = [t('Divine Orb — rerolls the value, but only within T{tier}', { tier: a.tier })];
    how.push(a.tag === 'desecrated'
      ? t('Orb of Annulment + Omen of Light removes it; desecrating again gives a random desecrated modifier — not necessarily this one')
      : t('A higher tier means removing it and rolling it again — the same modifier is not guaranteed'));
    return { text: a.mod.lines.join(' / '), tier: a.tier, best: bestIdx + 1, range: range(tiers[bestIdx].text), pct, how };
  }).filter(Boolean);

  const normal = candidates('item');
  // Примерный шанс, что следующий мод на этой стороне (Exalted + омен стороны) — именно этот: частота семейства среди всех,
  // что могут встать сюда (без уже занятых групп), по собранной статистике. Семейства без данных считаем как самые редкие.
  const W = weights();
  const wc = W && W.classes[item.itemClass];
  let chanceMeta = null;
  if (wc && wc.items >= 50) {
    chanceMeta = { items: wc.items, collected: W.meta.collected };
    const counts = familyCounts(wc, (type) => Math.max(0, ...(d.typeLines.get(type) || []).map((l) => want.get(l) || 0)));
    // Статистика — по всему классу (все ботинки), а моды защиты встают только на свои базы (уклонение — на «ловкие»).
    // Делим частоту на долю «типов баз» класса, где семейство вообще может выпасть: оценка веса, как если бы оно было везде.
    const share = eligibleShare(d, base);
    for (const type of Object.keys(counts)) counts[type] /= Math.max(share(type), 0.1);
    for (const side of ['prefix', 'suffix']) {
      const types = new Set(onBase.filter((m) => m.domain === 'item' && m.generation_type === side && !m.is_essence_only
        && m.required_level <= ilvl && !(m.groups || []).some((g) => present.has(g))).map((m) => m.type));
      const n = (type) => (counts[type] || 0) + SMOOTH;
      const total = [...types].reduce((s, type) => s + n(type), 0);
      // Ценные моды (≥ SALE_REASON% билдов) по трейду честно не оценить: без потолка цены они завышены (такие вещи охотнее
      // выставляют), с потолком — занижены (такие вещи дороже). Шанс для них не показываем.
      for (const c of normal.filter((x) => x.side === side)) {
        if (c.pct >= SALE_REASON) c.chance = null, c.chanceUnknown = true;
        else if (total && types.has(c.type)) c.chance = n(c.type) / total;
      }
    }
  }
  for (const c of normal) c.essence = essenceFor(c.text, item.itemClass);
  const sections = [];

  // 0. Магическая → редкая: эссенция даёт гарантированный мод, Regal — случайный из всего пула.
  // Магическая со свободным местом (1 префикс + 1 суффикс): сначала дёшево добить Augmentation, пока она магическая.
  const magicFree = magic ? ['prefix', 'suffix'].filter((s) => !mine.some((a) => a.side === s)) : [];
  if (magicFree.length) {
    sections.push({ kind: 'magicfill', how: [
      t('Orb of Augmentation — adds a random {side} while the item is magic: the cheapest step, do it before Regal', { side: t(magicFree[0]) }),
      jewel ? t('On jewels every modifier has one tier — Greater / Perfect currency gives nothing extra') : t('Greater / Perfect Orb of Augmentation — only modifiers of level 44+ / 70+'),
    ], candidates: normal.filter((c) => c.side === magicFree[0]).slice(0, 6) });
  }
  if (magic) {
    const sure = normal.filter((c) => c.essence);
    sections.push({ kind: 'upgrade', how: [
      ...[...new Map(sure.map((c) => [c.essence.name, c])).values()].slice(0, 4)
        .map((c) => t('{essence} — rare with guaranteed {mod}: {tiers}', { essence: c.essence.name, mod: c.text, tiers: c.essence.tiers.join(' · ') })),
      t('Regal Orb — makes it rare with one random modifier from the whole pool; the popular ones below are only some of the outcomes'),
      ...(jewel ? [] : [t('Greater / Perfect Regal Orb — the same, but only modifiers of level 35+ / 50+')]),
      t('Omen of Sinistral / Dextral Coronation — the next Regal Orb adds only a prefix / only a suffix'),
      t('Orb of Alchemy (+ Omen of Sinistral / Dextral Alchemy) — rerolls into a rare with 4 random modifiers instead'),
      // Магическая с одним модом — второй можно добавить до Regal: Greater / Perfect Augmentation даёт только моды высокого уровня.
    ] });
  }

  // 1. Свободные места — Exalted Orb (Omen Sinistral/Dextral Exaltation — только префикс/суффикс).
  for (const side of ['prefix', 'suffix']) {
    if (!open[side]) continue;
    const list = normal.filter((c) => c.side === side).slice(0, 6);
    const omen = side === 'prefix' ? 'Omen of Sinistral Exaltation' : 'Omen of Dextral Exaltation';
    const exalt = `Exalted Orb${open.prefix && open.suffix ? ` + ${omen} (${t(`only ${side}es`)})` : ''}`;
    sections.push({
      kind: 'open', side, count: open[side],
      how: [magic ? t("after it's rare: {how}", { how: exalt }) : exalt, ...(jewel ? [] : [t('Greater / Perfect Exalted Orb — only modifiers of level 35+ / 50+')]),
        ...(open[side] >= 2 ? [t('Omen of Greater Exaltation — the next Exalted Orb adds two modifiers')] : [])],
      candidates: list,
    });
  }

  // 2. Всё занято — заменить самый слабый мод: тир хуже всех и не востребован. Fractured не снять.
  if (!open.prefix && !open.suffix) {
    // Хорошие тиры (T1–T2) не меняем никогда: даже невостребованный T1 дороже лотереи с Annulment.
    // Востребованные моды (≥ KEY_PCT% билдов) тоже не меняем на другие — даже со слабым тиром: им нужен тир повыше (блок ниже).
    const scored = mine.filter((a) => a.mod && a.tag !== 'fractured' && !(a.tier && a.tier <= 2)).map((a) => {
      const pct = Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0));
      return { ...a, pct, score: pct / 100 * 3 - (a.tier || 3) / 3 };
    }).filter((a) => a.pct < KEY_PCT).sort((a, b) => a.score - b.score);
    const weak = scored[0];
    if (!weak) { if (!tierUps.length) sections.push({ kind: 'keep' }); }
    else {
      const sameSide = mine.filter((a) => a.side === weak.side && a.tag !== 'fractured').length;
      // Whittling смотрит на ВСЕ моды вещи (кроме fractured), а не только на кандидатов в замену.
      const lowest = mine.filter((a) => a.mod && !['fractured', 'desecrated', 'crafted'].includes(a.tag)).sort((a, b) => a.mod.required_level - b.mod.required_level)[0];
      const erasure = weak.side === 'prefix' ? 'Omen of Sinistral Erasure' : 'Omen of Dextral Erasure';
      const omen = weak.side === 'prefix' ? 'Omen of Sinistral Annulment' : 'Omen of Dextral Annulment';
      const how = weak.tag === 'desecrated'
        // Desecrated снимается прицельно: Omen of Light — Annulment убирает только desecrated-моды.
        ? [t('Orb of Annulment + Omen of Light — removes only the desecrated modifier, then Exalted Orb (or desecrate again)')]
        : [t(`Orb of Annulment + {omen} — removes a random ${weak.side} (1 in {n} to hit this one), then Exalted Orb`, { omen, n: sameSide }),
          t(`Chaos Orb + {omen} — removes a random ${weak.side} and adds a random modifier (Greater / Perfect Chaos: level 35+ / 50+)`, { omen: erasure })];
      // У самоцветов все моды одного уровня — Whittling снимает фактически случайный.
      if (!jewel && lowest && lowest.name === weak.name && weak.tag !== 'desecrated') {
        how.unshift(t('Chaos Orb + Omen of Whittling — removes the lowest-level modifier (this one) and adds a random modifier'));
      }
      sections.push({
        kind: 'replace', weak: { name: weak.name, side: weak.side, tier: weak.tier, text: weak.mod.lines.join(' / '), pct: weak.pct },
        how, candidates: normal.filter((c) => c.side === weak.side).slice(0, 5),
      });
    }
  }

  if (tierUps.length) sections.push({ kind: 'tierup', mods: tierUps });

  // 3. Desecration — свой пул desecrated-модов, одна на вещь.
  if (!item.desecratedItem && !mine.some((a) => a.tag === 'desecrated')) {
    const des = candidates('desecrated').filter((c) => open[c.side] || (!open.prefix && !open.suffix)).slice(0, 4);
    if (des.length) {
      // Desecrated — отдельный слот (не crafted), но на полной вещи снимает случайный мод: осквернять ДО Exalt-ов.
      const lich = tags.includes('weapon') || tags.includes('ring') || tags.includes('amulet') || tags.includes('belt');
      sections.push({ kind: 'desecrate', how: [
        t('Desecrate with {bone} — adds an unrevealed desecrated modifier', { bone: boneFor(tags, ilvl) }) + (!open.prefix && !open.suffix ? ` (${t('replaces a random one when full')})` : ''),
        t('Desecrate before the Exalted Orbs — on a full item it removes a random modifier'),
        t('Omen of Sinistral / Dextral Necromancy — only a prefix / only a suffix'),
        ...(lich ? [t('Omen of the Sovereign / the Liege / the Blackblooded — guaranteed Ulaman / Amanamu / Kurgal modifier')] : []),
      ], candidates: des });
    }
  }

  // Perfect-эссенции — только на редких: убирают случайный мод и добавляют свой (у слота свой набор, не тот, что у Greater).
  // С 0.5 на вещи только один crafted-мод (эссенции, в т.ч. Perfect и порченые, и Alloy). Есть — Perfect/Alloy не встанут.
  const hasCrafted = mine.some((a) => a.tag === 'crafted');
  // Всё, что заменяет случайный мод гарантированным crafted-модом: Perfect-эссенции, порченые эссенции, Alloy (data/crafting-currency.json).
  const perfect = item.rarity === 'Rare' ? [...perfectFor(item.itemClass), ...guaranteedFor(item.itemClass)] : [];
  if (jewel && item.rarity === 'Rare') {
    sections.push({ kind: 'emotions', how: hasCrafted
      ? [t('This item already has a crafted modifier — Liquid Emotions cannot be used (one crafted modifier per item)')]
      : [t('Potent Ferocity — (40–60)% increased Effect of Suffixes (as a prefix) or of Prefixes'),
        t('Potent Contempt — +1 Suffix / Prefix Modifier allowed: a third modifier on one side for a slot on the other ("5-line" jewels)'),
        t('Ancient Liquid Emotions — only on Time-Lost jewels'),
        t('Removes a random modifier; uses the only crafted-modifier slot'),
        t("Hinekora's Lock first — see the result before you commit")] });
  }
  if (perfect.length && hasCrafted) {
    sections.push({ kind: 'perfect', how: [t('This item already has a crafted modifier — Perfect Essences and Alloys cannot be used (one crafted modifier per item)')] });
  } else if (perfect.length) {
    sections.push({ kind: 'perfect', how: [...perfect.map((p) => `${p.name} — ${p.mod}`),
      t('Omen of Sinistral / Dextral Crystallisation — the Perfect Essence removes only a prefix / only a suffix'),
      t('Uses the only crafted-modifier slot (one per item; Alloys too)'),
      t("Hinekora's Lock first — see the result before you commit")] });
  }

  // 4. Дёшево и без риска.
  const cheap = [];
  const armourOrWeapon = tags.includes('armour') || tags.includes('weapon') || tags.includes('onehand') || tags.includes('twohand');
  // Artificer's Orb — оружие, жезлы, посохи и броня (скипетров в списке нет).
  if (armourOrWeapon && !tags.includes('sceptre') && !item.sockets) cheap.push(t("Artificer's Orb — add an augment socket, then a rune or soul core"));
  if (armourOrWeapon && (item.quality || 0) < 20) cheap.push(t('Quality to 20% (currently {n}%) — {currency}', { n: item.quality || 0, currency: qualityCurrency(tags) }));
  if ((tags.includes('ring') || tags.includes('amulet')) && !item.quality) cheap.push(t('Catalyst — quality on rings and amulets boosts matching modifiers (life, minion, caster…); with Omen of Catalysing Exaltation the next Exalted Orb favours that type'));
  if (jewel && !item.quality) cheap.push(t('Refined Catalyst — quality on jewels boosts matching modifiers; with Omen of Catalysing Exaltation the next Exalted Orb favours that type'));
  const total = mine.length;
  if (cheap.length) sections.push({ kind: 'cheap', how: cheap });
  // Fracturing — не «дёшево и без риска»: в 0.5 редкий (только атлас) и фиксирует СЛУЧАЙНЫЙ мод.
  if (!magic && total >= 4 && !item.fracturedItem) {
    sections.push({ kind: 'risky', how: [
      t('Fracturing Orb — locks a random modifier forever (rare with 4+ modifiers); worth it only when most modifiers are worth keeping'),
      t("Hinekora's Lock first — see the result before you commit"),
    ] });
  }

  const goal = planGoal(mine, normal, max, want, magic, magicFree);
  return { open, max, sections, goal, chanceMeta, source: 'RePoE (game files) · demand: poe.ninja' };
}

// Доля «типов баз» класса (по набору тегов: str_armour, dex_int_armour…), на которых семейство мода может выпасть.
const shareCache = new Map();
function eligibleShare(d, base) {
  const key = base.item_class;
  if (!shareCache.has(key)) {
    const profiles = new Map();
    for (const b of d.bases.values()) {
      if (b.item_class !== key || b.release_state !== 'released' || b.domain !== 'item') continue;
      const tags = (b.tags || []).filter((t) => !/_basetype$/.test(t)).sort();
      profiles.set(tags.join(','), tags);
    }
    const byType = new Map();
    for (const m of d.pool) {
      if (m.domain !== 'item') continue;
      if (!byType.has(m.type)) byType.set(m.type, new Set());
      for (const [k, tags] of profiles) if (canRoll(m, tags)) byType.get(m.type).add(k);
    }
    shareCache.set(key, (type) => (profiles.size && byType.has(type) ? byType.get(type).size / profiles.size : 1));
  }
  return shareCache.get(key);
}

// Частоты семейств модов для оценки шансов.
// Новый формат (raw — моды каждой вещи): на каждой вещи не считаем «причину продажи» — самый востребованный мод, если его
// носят ≥ SALE_REASON% билдов: вещь выставили ради него, а остальные её моды выпали случайно. Старый — готовые счётчики.
const SALE_REASON = 30;
const SMOOTH = 1; // +1 к каждому семейству: единичные находки не раздуваются, ненайденные не уходят в ноль
function familyCounts(wc, pctOf) {
  if (!wc.raw) return Object.fromEntries(Object.entries(wc.families || {}).map(([type, x]) => [type, x.n]));
  const kept = {}, raw = {};
  for (const row of wc.raw) {
    let drop = -1, best = SALE_REASON - 1;
    row.forEach(([ti], k) => { const p = pctOf(wc.types[ti]); if (p > best) { best = p; drop = k; } });
    row.forEach(([ti], k) => {
      const type = wc.types[ti];
      raw[type] = (raw[type] || 0) + 1;
      if (k !== drop) kept[type] = (kept[type] || 0) + 1;
    });
  }
  // Мод, который почти всегда и есть «причина продажи» (+уровни на посохах), без него почти не встречается —
  // честно его по трейду не оценить. Берём не меньше половины сырой частоты: скидка на отбор, но не ноль.
  const counts = {};
  for (const type of Object.keys(raw)) counts[type] = Math.max(kept[type] || 0, raw[type] * 0.5);
  return counts;
}

// Цель крафта: какой была бы лучшая вещь из этой базы. На каждой стороне — самые ценные моды из текущих и возможных:
// ценность = спрос (% билдов) × качество тира; кандидату засчитываем средний тир (что выпадет — неизвестно).
// Fractured снять нельзя — остаются всегда. Возвращает { keep, remove, add } или null, если улучшать нечего.
const TIER_VALUE = [0, 1, 0.85, 0.7, 0.6];
const KEY_PCT = 30; // мод, который носит столько % билдов, на другой не меняем
const KEEP_BONUS = 1.5;
function planGoal(mine, candidates, max, want, magic, magicFree = []) {
  const value = (pct, tier) => pct * (TIER_VALUE[tier] || 0.5);
  const keep = [], remove = [], add = [];
  for (const side of ['prefix', 'suffix']) {
    const cur = mine.filter((a) => a.side === side).map((a) => {
      const pct = a.mod ? Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0)) : 0;
      // Fractured и хорошие тиры (T1–T2) не трогаем: даже не самый ходовой T1 дороже лотереи Annulment + Exalted.
      // Остальные держим, пока кандидат не ценнее в полтора раза — замена случайна и стоит валюты.
      const locked = a.tag === 'fractured' || !a.mod || (a.tier && a.tier <= 2) || pct >= KEY_PCT;
      return { kind: 'cur', a, pct, v: locked ? Infinity : value(pct, a.tier) * KEEP_BONUS };
    });
    const cand = candidates.filter((c) => c.side === side).map((c) => ({ kind: 'add', c, pct: c.pct, v: value(c.pct, 2) }));
    const chosen = [...cur, ...cand].sort((x, y) => y.v - x.v).slice(0, max[side]);
    for (const x of cur) {
      const info = { side, text: x.a.mod ? x.a.mod.lines.join(' / ') : x.a.name, templates: x.a.mod ? x.a.mod.lines : [], tier: x.a.tier, pct: x.pct,
        up: x.pct >= KEY_PCT && x.a.tier >= 3 }; // ключевой, но слабый тир — «↑ тир»
      (chosen.includes(x) ? keep : remove).push(info);
    }
    for (const x of cand) if (chosen.includes(x)) add.push({ ...x.c, side });
  }
  if (!add.length) return null;
  add.sort((x, y) => y.pct - x.pct);
  // Шаги: сначала — убрать лишнее и вставить самый востребованный мод.
  const steps = [];
  if (magicFree.length) steps.push(t('Orb of Augmentation — first fill the free {side} while it is magic (cheap)', { side: t(magicFree[0]) }));
  if (magic) {
    const ess = add.find((c) => c.essence);
    steps.push(ess ? t('{essence} — makes it rare with {mod}', { essence: ess.essence.name, mod: ess.text }) : t('Regal Orb — makes it rare (random modifier)'));
  }
  // Сначала сторона, где самый востребованный мод (ключевой) — он сильнее всего поднимает цену.
  const top = (side) => Math.max(0, ...add.filter((c) => c.side === side).map((c) => c.pct));
  for (const side of ['prefix', 'suffix'].sort((x, y) => top(y) - top(x))) {
    const out = remove.filter((r) => r.side === side);
    const into = add.filter((c) => c.side === side);
    if (!into.length) continue;
    const S = side === 'prefix' ? 'Sinistral' : 'Dextral';
    if (out.length) steps.push(t('Remove {mods}: Orb of Annulment + Omen of {S} Annulment (random {side}), or Chaos Orb + Omen of Whittling if it is the lowest-level modifier', { mods: out.map((r) => r.text).join(', '), S, side: t(side) }));
    steps.push(t('Add {mods}: Exalted Orb + Omen of {S} Exaltation', { mods: into.map((c) => c.text).join(', '), S }) + (into.length > 1 ? t(' (Omen of Greater Exaltation adds two)') : ''));
  }
  return { keep, remove, add: add.map(({ side, text, pct, tier, tiers, range, stats, essence, chance, chanceUnknown }) => ({ side, text, pct, tier, tiers, range, stats, essence, chance, chanceUnknown })), steps };
}

// Может ли мод (шаблон poe.ninja: «# to Level of all Spell Skills») встать на эту базу. null — пул модов ещё не загружен.
function rollsOn(baseType, template) {
  if (!data) return null;
  const base = data.bases.get(baseType);
  if (!base) return null;
  const want = templates(template)[0];
  return data.pool.some((m) => (m.domain === 'item' || m.domain === 'desecrated') && m.lines.includes(want) && canRoll(m, base.tags || []));
}

module.exports = { advise, load, rollsOn };
