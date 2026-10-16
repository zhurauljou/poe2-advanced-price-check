// Советы по крафту: что и чем можно добавить или заменить, чтобы вещь стала дороже.
// Пул модов — RePoE (выгрузка из файлов игры): какие моды и тиры вообще могут встать на эту базу.
// Весов выпадения в файлах PoE 2 нет (только «может / не может»), поэтому вероятностей не считаем —
// показываем, какие ВОСТРЕБОВАННЫЕ (по poe.ninja) моды могут встать и каким способом.

const stats = require('./stats');

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
  data = { bases: byName, pool };
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

// Вес мода на базе: первый тег из spawn_weights, который есть у базы (в PoE 2 — только 0 или 1).
function canRoll(mod, tags) {
  for (const sw of mod.spawn_weights || []) if (tags.includes(sw.tag)) return sw.weight > 0;
  return false;
}

const BONES = { armour: 'Preserved Rib', weapon: 'Preserved Jawbone', quiver: 'Preserved Jawbone',
  ring: 'Preserved Collarbone', amulet: 'Preserved Collarbone', belt: 'Preserved Collarbone', jewel: 'Preserved Cranium' };

function boneFor(tags) {
  for (const [tag, bone] of Object.entries(BONES)) if (tags.includes(tag)) return bone;
  return 'an Abyssal Bone';
}

const range = (text) => {
  const m = String(text || '').match(/\((-?[\d.]+)-(-?[\d.]+)\)/);
  return m ? `${m[1]}–${m[2]}` : null;
};

// item — разобранный предмет (item.affixes из расширенного формата), demandMods — [{ name, pct }] с poe.ninja.
async function advise(item, demandMods, cached) {
  if (item.rarity !== 'Rare' && item.rarity !== 'Magic') return { note: 'Craft tips are for rare and magic items.' };
  if (item.corrupted || item.mirrored || item.sanctified) {
    return { blocked: item.corrupted ? 'Corrupted' : item.mirrored ? 'Mirrored' : 'Sanctified' };
  }
  if (!item.affixes || !item.affixes.length) {
    return { note: 'Turn on "Advanced Mod Descriptions" in the game options (or copy with Ctrl+Alt+C) to get craft tips.' };
  }
  const d = await load(cached);
  const base = d.bases.get(item.baseType);
  if (!base) return { note: `Unknown base "${item.baseType}" in RePoE data.` };
  const tags = base.tags || [];
  const ilvl = item.ilvl || 100;

  // Моды, которые могут встать на эту базу, и наши аффиксы среди них (по имени и стороне).
  const onBase = d.pool.filter((m) => canRoll(m, tags));
  const mine = item.affixes.map((a) => ({
    ...a, mod: onBase.find((m) => m.name === a.name && m.generation_type === a.side) || null,
  }));
  const present = new Set(mine.flatMap((a) => (a.mod ? a.mod.groups || [] : [])));

  // Сколько мест: у редкой 3+3 (у самоцветов 2+2 — всего 4 мода), у магической 1+1;
  // «-1 Suffix Modifier allowed» и т.п. — поправка.
  const perSide = item.rarity !== 'Rare' ? 1 : tags.includes('jewel') ? 2 : 3;
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
        range: range(best.text), level: best.required_level, stats: tradeStats(best, domain, item.itemClass) };
    }).filter(Boolean).sort((a, b) => b.pct - a.pct);
  };

  const normal = candidates('item');
  const sections = [];

  // 1. Свободные места — Exalted Orb (Omen Sinistral/Dextral Exaltation — только префикс/суффикс).
  for (const side of ['prefix', 'suffix']) {
    if (!open[side]) continue;
    const list = normal.filter((c) => c.side === side).slice(0, 6);
    const omen = side === 'prefix' ? 'Omen of Sinistral Exaltation' : 'Omen of Dextral Exaltation';
    sections.push({
      kind: 'open', side, count: open[side],
      how: [`Exalted Orb${open.prefix && open.suffix ? ` + ${omen} (only ${side}es)` : ''}`,
        'Greater / Perfect Exalted Orb — only higher tiers'],
      candidates: list,
    });
  }

  // 2. Всё занято — заменить самый слабый мод: тир хуже всех и не востребован. Fractured не снять.
  if (!open.prefix && !open.suffix) {
    const scored = mine.filter((a) => a.mod && a.tag !== 'fractured').map((a) => {
      const pct = Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0));
      return { ...a, pct, score: pct / 100 * 3 - (a.tier || 3) / 3 };
    }).sort((a, b) => a.score - b.score);
    const weak = scored[0];
    if (weak) {
      const sameSide = mine.filter((a) => a.side === weak.side && a.tag !== 'fractured').length;
      const lowest = scored.slice().sort((a, b) => a.mod.required_level - b.mod.required_level)[0];
      const omen = weak.side === 'prefix' ? 'Omen of Sinistral Annulment' : 'Omen of Dextral Annulment';
      const how = weak.tag === 'desecrated'
        // Desecrated снимается прицельно: Omen of Light — Annulment убирает только desecrated-моды.
        ? ['Orb of Annulment + Omen of Light — removes only the desecrated modifier, then Exalted Orb (or desecrate again)']
        : [`Orb of Annulment + ${omen} — removes a random ${weak.side} (1 in ${sameSide} to hit this one), then Exalted Orb`];
      if (lowest && lowest.name === weak.name && weak.tag !== 'desecrated') {
        how.unshift('Chaos Orb + Omen of Whittling — replaces the lowest-level modifier, which is this one');
      }
      sections.push({
        kind: 'replace', weak: { name: weak.name, side: weak.side, tier: weak.tier, text: weak.mod.lines.join(' / '), pct: weak.pct },
        how, candidates: normal.filter((c) => c.side === weak.side).slice(0, 5),
      });
    }
  }

  // 3. Desecration — свой пул desecrated-модов, одна на вещь.
  if (!item.desecratedItem && !mine.some((a) => a.tag === 'desecrated')) {
    const des = candidates('desecrated').filter((c) => open[c.side] || (!open.prefix && !open.suffix)).slice(0, 4);
    if (des.length) {
      sections.push({ kind: 'desecrate', how: [`Desecrate with ${boneFor(tags)} — adds an unrevealed desecrated modifier${!open.prefix && !open.suffix ? ' (replaces a random one when full)' : ''}`],
        candidates: des });
    }
  }

  // 4. Дёшево и без риска.
  const cheap = [];
  const armourOrWeapon = tags.includes('armour') || tags.includes('weapon') || tags.includes('onehand') || tags.includes('twohand');
  if (armourOrWeapon && !item.sockets) cheap.push("Artificer's Orb — add an augment socket, then a rune or soul core");
  if (armourOrWeapon && (item.quality || 0) < 20) cheap.push(`Quality to 20% (currently ${item.quality || 0}%) — Armourer's Scrap / Blacksmith's Whetstone / Arcanist's Etcher`);
  if ((tags.includes('ring') || tags.includes('amulet')) && !item.quality) cheap.push('Catalyst — quality on rings and amulets boosts matching modifiers (life, minion, caster…)');
  if (cheap.length) sections.push({ kind: 'cheap', how: cheap });

  return { open, max, sections, source: 'RePoE (game files) · demand: poe.ninja' };
}

module.exports = { advise };
