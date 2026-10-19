// Craft tips: what can be added or replaced, and with what, to make the item worth more.
// Mod pool comes from RePoE (a dump of the game files): which mods and tiers can roll on this base at all.
// PoE 2 game files have no spawn weights (only "can / cannot"), so we do not compute probabilities —
// we show which IN-DEMAND (per poe.ninja) mods can roll and by which method.

const fsW = require('fs');
const pathW = require('path');
const craftData = require('./craft-data');
const { load, templates, tradeStats, weights, guaranteedFor, corruptedFor, emotionsFor, canRoll } = craftData;
// Odds in words: "1 in 3"; better than 1 in 2 — as a percentage ("~60%"): "1 in 1.7" reads badly.
const oddsOf = (p) => (p >= 0.5 ? `~${Math.round(Math.min(1, p) * 100)}%` : t('1 in {n}', { n: Math.round(10 / p) / 10 }));

const { essenceFor, perfectFor } = require('./essences');
const { isKey, isWeak, tierFactor } = require('./weights');
const methods = require('../shared/methods');
const { t } = require('../shared/i18n');



const ELEMENTS = ['Fire', 'Cold', 'Lightning', 'Chaos'];
const ALDUR_RUNE = { Fire: 'Passion of Aldur', Cold: 'Breath of Aldur', Lightning: 'Ire of Aldur', Chaos: 'Betrayal of Aldur' };
// A mod is "wanted" (in demand) if at least this % of the class's builds use it (poe.ninja): below that we neither suggest nor value it.
const WANT_PCT = 15;
const classes = require('../shared/item-classes');
const ALDUR_WEAPONS = new Set(classes.ALDUR_WEAPONS);

// Lich omens: a guaranteed lich mod on Desecrate (weapons and jewellery only; lich mods are level 65).
const LICH_OMEN = { ulaman: 'Omen of the Sovereign', amanamu: 'Omen of the Liege', kurgal: 'Omen of the Blackblooded' };
const LICH_CLASSES = ['weapon', 'wand', 'staff', 'ring', 'amulet', 'belt'];

// Influence runes (Runes of Aldur): permanently unlock a mod pool for the item (spawn tag in RePoE).
const INFLUENCE_RUNES = [
  { rune: "Thrud's Might", name: 'Destruction', tag: 'destruction', on: ['weapon', 'wand', 'staff', 'sceptre'] },
  { rune: "Kolr's Hunt", name: 'Marksman', tag: 'marksman', on: ['gloves'] },
  { rune: "Katla's Gloom", name: 'Decay', tag: 'decay', on: ['gloves'] },
  { rune: "Vorana's Carnage", name: 'Berserking', tag: 'berserking', on: ['helmet'] },
  { rune: "Uhtred's Sidereus", name: 'Chronomancy', tag: 'chronomancy', on: ['boots'] },
  { rune: "Medved's Tending", name: 'Soul', tag: 'soul', on: ['body_armour'] },
];
const INF_TAG = Object.fromEntries(INFLUENCE_RUNES.map((r) => [r.name, r.tag]));

// Corrupted essences with their mods for the class — [{ name, text }] (for the plan: a guaranteed mod via the crafted slot).
// Item classes for augment targets ("Martial Weapon", "Wand or Staff", "Armour", "All Equipment", ["Boots"]…).
const AUG_GROUPS = {
  'all equipment': null, // any
  armour: classes.ARMOUR,
  'martial weapon': classes.MARTIAL_WEAPONS,
  'caster weapon': classes.CASTER_WEAPONS,
};
AUG_GROUPS.weapon = [...AUG_GROUPS['martial weapon'], ...AUG_GROUPS['caster weapon'], 'Sceptres'];
const AUG_SINGLE = { staff: 'Staves', quarterstaff: 'Quarterstaves', wand: 'Wands', sceptre: 'Sceptres', bow: 'Bows', crossbow: 'Crossbows', spear: 'Spears',
  talisman: 'Talismans', 'one hand mace': 'One Hand Maces', 'two hand mace': 'Two Hand Maces', shields: 'Shields', shield: 'Shields', buckler: 'Bucklers',
  bucklers: 'Bucklers', focus: 'Foci', helmet: 'Helmets', gloves: 'Gloves', boots: 'Boots', 'body armour': 'Body Armours' };
function augFits(target, itemClass) {
  if (Array.isArray(target)) return target.includes(itemClass);
  const parts = String(target).replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1').toLowerCase().split(/, | or | and /);
  return parts.some((p) => { const g = AUG_GROUPS[p.trim()]; if (g === null) return true; if (g) return g.includes(itemClass); return AUG_SINGLE[p.trim()] === itemClass; });
}


// "Risky finish": corruption and sanctification (docs/corruption-sanctification.md, data/gamble-currency.json).
// Odds are community estimates, GGG does not publish them. Shown with disclaimers.
let gambleData;
function gambleFor(item, tags) {
  if (gambleData === undefined) {
    try { gambleData = JSON.parse(fsW.readFileSync(pathW.join(__dirname, '..', '..', 'data', 'gamble-currency.json'), 'utf8')); } catch { gambleData = null; }
  }
  const jewellery = tags.includes('ring') || tags.includes('amulet') || tags.includes('belt');
  const caster = tags.includes('wand') || tags.includes('staff');
  const how = [t('Irreversible. Odds are community estimates — GGG does not publish them.')];
  if (item.rarity === 'Unique') {
    // For uniques, instead of a reroll — mod values ×0.78–1.22 of the current ones (can go beyond the normal range).
    if (tags.includes('jewel') || jewellery) how.push(t('Vaal Orb — ~50% nothing, ~25% corruption enchant, ~25% modifier values ×0.78–1.22 of the current ones (can go beyond the normal range); the item becomes unmodifiable'));
    else how.push(t('Vaal Orb — ~25% each: nothing, corruption enchant, modifier values ×0.78–1.22 of the current ones (can go beyond the normal range), +1 augment socket beyond the limit; the item becomes unmodifiable'));
    how.push(t('Divine to good rolls first: after corruption the values can no longer be rerolled, and ×1.22 of a high roll is worth the most'));
  } else if (tags.includes('jewel')) how.push(t('Vaal Orb — nothing, a corruption enchant or rerolled modifiers (odds for jewels unverified); the item becomes unmodifiable'));
  else if (jewellery) how.push(t('Vaal Orb — ~50% nothing, ~25% corruption enchant, ~25% modifiers rerolled (often ruins the item); the item becomes unmodifiable'));
  else if (caster) how.push(t('Vaal Orb — ~25% each: nothing, corruption enchant, modifiers rerolled (often ruins the item), quality up to ~23%; the item becomes unmodifiable'));
  else how.push(t('Vaal Orb — ~25% each: nothing, corruption enchant, modifiers rerolled (often ruins the item), +1 augment socket beyond the limit; the item becomes unmodifiable'));
  if (!tags.includes('jewel')) how.push(t('Before corrupting: Divine Orb, quality and runes — meta-crafting runes cannot be socketed into corrupted or sanctified items'));
  if (item.rarity === 'Rare') how.push(t('Sanctify (Divine Orb + Omen of Sanctification) — every modifier ×0.78–1.22 of its current value, the item becomes unmodifiable and can no longer be corrupted; only for a near-perfect item, Divine to high rolls first'));
  const inf = gambleData && (gambleData.infusers || []).find((x) => (x.classes || []).includes(item.itemClass));
  if (inf && (item.quality || 0) >= 20) how.push(t('{infuser} — up to +10% quality above the maximum (needs 20% quality); may only add the Corrupted tag', { infuser: inf.name }));
  if (item.rarity === 'Rare' && bonesFor(tags, item.ilvl || 100).length) how.push(t('Omen of Putrefaction + a bone: all modifiers become 6 unrevealed ones (3 prefixes + 3 suffixes), each revealed from 3 options, and the item becomes corrupted — a «slot machine» for cheap bases (quivers, armour)'));
  how.push(t('Omen of Corruption (a guaranteed change) is not obtainable this league'));
  // "(only str_armour bases)" — only for bases with that tag; the rest are hidden.
  const enchants = ((gambleData && gambleData.corruptedEnchants && gambleData.corruptedEnchants[item.itemClass]) || [])
    .filter((e) => { const m = e.match(/\(only (\w+) bases\)/); return !m || tags.includes(m[1]); })
    .map((e) => e.replace(/\s*\(only \w+ bases\)/, ''));
  return { how, enchants };
}


// Bones for Desecration by slot (poe2db): Gnawed — only up to ilvl 64, Preserved — any, Ancient — mods of level 40+.
// Cranium (jewels) is only Preserved.
// Wands, staves and sceptres have no "weapon" tag, but desecrate works on them (sceptres do show
// desecrated mods, which reveal as normal mods) — same bone, Jawbone.
const BONES = { armour: 'Rib', weapon: 'Jawbone', wand: 'Jawbone', staff: 'Jawbone', sceptre: 'Jawbone', quiver: 'Jawbone', ring: 'Collarbone', amulet: 'Collarbone', belt: 'Collarbone', jewel: 'Cranium' };

// Bones for the plan: Gnawed — only ilvl ≤ 64, Preserved — any, Ancient — mods 40+; Cranium (jewels) — only Preserved.
function bonesFor(tags, ilvl) {
  const bone = Object.entries(BONES).find(([tag]) => tags.includes(tag));
  if (!bone) return [];
  if (bone[1] === 'Cranium') return [{ name: 'Preserved Cranium', minLevel: 0 }];
  return [...(ilvl <= 64 ? [{ name: `Gnawed ${bone[1]}`, minLevel: 0 }] : []), { name: `Preserved ${bone[1]}`, minLevel: 0 },
    ...(ilvl >= 40 ? [{ name: `Ancient ${bone[1]}`, minLevel: 40 }] : [])];
}

function boneFor(tags, ilvl) {
  const bone = Object.entries(BONES).find(([tag]) => tags.includes(tag));
  if (!bone) return t('a bone (Rib / Jawbone / Collarbone / Cranium)');
  if (bone[1] === 'Cranium') return 'Preserved Cranium';
  return `${ilvl <= 64 ? `Gnawed ${bone[1]} (${t('item level ≤ 64')}) / ` : ''}Preserved ${bone[1]} / Ancient ${bone[1]} (${t('only modifier level 40+')})`;
}

// Quality currency by item class.
function qualityCurrency(tags) {
  if (tags.includes('wand') || tags.includes('staff') || tags.includes('sceptre')) return "Arcanist's Etcher";
  if (tags.includes('weapon')) return "Blacksmith's Whetstone";
  return "Armourer's Scrap";
}

const range = (text) => {
  const m = String(text || '').match(/\((-?[\d.]+)-(-?[\d.]+)\)/);
  return m ? `${m[1]}–${m[2]}` : null;
};

// item — the parsed item (item.affixes from the advanced format), demandMods — [{ name, pct }] from poe.ninja.
async function advise(item, demandMods, cached) {
  if (!['Rare', 'Magic', 'Unique', 'Normal'].includes(item.rarity)) return { note: t('Craft tips are for rare, magic, unique items and white bases.') };
  // Tablets: their mods and pool differ from equipment (corruption with sockets, 3 + 3 slots) — tips would be wrong.
  if (item.itemClass === 'Tablet') return { note: t('No craft tips for tablets yet. The Price tab searches by their modifiers and uses left.') };
  if (item.corrupted || item.mirrored || item.sanctified) {
    return { blocked: item.corrupted ? 'Corrupted' : item.mirrored ? 'Mirrored' : 'Sanctified' };
  }
  // Unique: mods do not change — only values (Divine) and the risky finish (Vaal). The window computes rolls from filters.
  if (item.rarity === 'Unique') {
    const d = await load(cached);
    const base = d.bases.get(item.baseType);
    return { unique: true, gamble: gambleFor(item, (base && base.tags) || []) };
  }
  if (item.rarity !== 'Normal' && (!item.affixes || !item.affixes.length)) {
    return { note: t('Turn on "Advanced Mod Descriptions" in the game options (or copy with Ctrl+Alt+C) to get craft tips.') };
  }
  const d = await load(cached);
  const base = d.bases.get(item.baseType);
  if (!base) return { note: t('Unknown base "{base}" in RePoE data.', { base: item.baseType }) };
  const tags = base.tags || [];
  // Jewels: each mod has a single level-1 tier — Greater/Perfect currency and Whittling are useless (docs/jewels-crafting.md).
  const jewel = tags.includes('jewel');
  const ilvl = item.ilvl || 100;

  // An influence rune in a socket ("Can roll Destruction modifiers") unlocks its own mod pool for the item — add its tag.
  const hasInf = (item.modLines || []).map((l) => l.text.match(/^Can roll (\w+) modifiers$/)).filter(Boolean).map((m) => INF_TAG[m[1]]).filter(Boolean);
  // Mods that can roll on this base, and our affixes among them (by name and side).
  // Item mod for an affix: the name is not unique (lich mods — "of Kurgal", "Amanamu's" across dozens of mods) — with several
  // matches we pick by line text; essence mods (Essences) are not in the drop pool — so also search all mods.
  const findMod = (a, pool) => {
    let same = pool.filter((m) => m.name === a.name && m.generation_type === a.side);
    if (!same.length) same = d.pool.filter((m) => m.name === a.name && m.generation_type === a.side && m.domain !== 'desecrated' === (a.tag !== 'desecrated'));
    // Non-Latin name — the client is not in English: search by lines. An English name missing from RePoE (outdated) —
    // the mod is unknown, as before (the plan leaves it alone).
    if (!same.length) return /[^\p{ASCII}]/u.test(a.name || '') ? findByLines(a, pool) : null;
    if (same.length > 1 && !(a.lines || []).length) return null;
    if (same.length <= 1 || !(a.lines || []).length) return same[0] || null;
    const lines = new Set((a.lines || []).flatMap((l) => templates(l)));
    return same.find((m) => m.lines.length && m.lines.every((l) => lines.has(l))) || same.find((m) => m.lines.some((l) => lines.has(l))) || null;
  };
  // Client not in English (e.g. a Russian mod name): clientLang has already translated the lines, find the mod by them.
  // Family — mods of the side with the same lines; tier — by the number from the header (T1 is the highest of those that
  // can roll on this base), without a number — the best by item level.
  const findByLines = (a, pool) => {
    const lines = new Set((a.lines || []).flatMap((l) => templates(l)));
    if (!lines.size) return null;
    // Desecrated on an item is usually a normal mod (domain item in RePoE), less often its own (domain desecrated: lich mods etc.).
    const fits = (m) => m.generation_type === a.side && m.lines.length === lines.size && m.lines.every((l) => lines.has(l));
    let same = pool.filter(fits);
    if (!same.length) same = d.pool.filter(fits);
    if (!same.length) return null;
    const own = same.filter((m) => (m.domain === 'desecrated') === (a.tag === 'desecrated'));
    const type = (own[0] || same[0]).type;
    const tiers = same.filter((m) => m.type === type).sort((x, y) => y.required_level - x.required_level);
    if (a.tier && tiers[a.tier - 1]) return tiers[a.tier - 1];
    return tiers.find((m) => m.required_level <= (item.ilvl || 100)) || tiers[tiers.length - 1];
  };
  // Item mods add tags to it (adds_tags): "+# to Level of all Fire Spell Skills" — no_cold_spell_mods etc. (the staff
  // will no longer roll Cold / Lightning / Chaos Damage), genesis_tree_minion — minion mods on rings. The pool accounts for these tags.
  const basePool = d.pool.filter((m) => canRoll(m, [...tags, ...hasInf]));
  const addedTags = new Set(item.affixes.flatMap((a) => ((findMod(a, basePool) || {}).adds_tags || [])));
  const onBase = addedTags.size ? d.pool.filter((m) => canRoll(m, [...tags, ...hasInf, ...addedTags])) : basePool;
  // Jewel mods have one tier — "T1" on all of them, not a sign of a valuable mod: on a jewel a mod is key only by demand.
  const mine = item.affixes.map((a) => ({ ...a, tier: jewel ? null : a.tier, mod: findMod(a, onBase) }));
  const present = new Set(mine.flatMap((a) => (a.mod ? a.mod.groups || [] : [])));

  // How many slots: a rare has 3+3 (jewels 2+2 — 4 mods total), a magic item 1+1;
  // "-1 Suffix Modifier allowed" etc. — an adjustment.
  // Regal Orb makes a magic item rare — so slots are counted as for a rare, and Regal is suggested as the first step.
  const magic = item.rarity === 'Magic';
  const perSide = tags.includes('jewel') ? 2 : 3;
  const max = { prefix: perSide, suffix: perSide };
  for (const l of item.modLines || []) {
    const m = l.text.match(/^([+-]\d+) (Prefix|Suffix) Modifiers? allowed$/);
    if (m) max[m[2].toLowerCase()] += Number(m[1]);
  }
  const used = { prefix: mine.filter((a) => a.side === 'prefix').length, suffix: mine.filter((a) => a.side === 'suffix').length };
  const open = { prefix: Math.max(0, max.prefix - used.prefix), suffix: Math.max(0, max.suffix - used.suffix) };
  // Side over the limit (after removing the crafted "+1 … Modifier allowed"): Chaos and Annulment do not touch it, and a removed
  // mod cannot be brought back. Verified by the community in 0.5 (docs/jewels-crafting.md), not verified in 0.5.5.
  const overfull = ['prefix', 'suffix'].filter((s) => used[s] > max[s]);

  // In-demand mods (≥ 15% of builds) that can roll: the best tier available at this ilvl.
  // Mod key for comparison: lowercase, no "+" before the number — like RePoE mod lines (templates); poe.ninja
  // and trade sometimes have the plus and sometimes not ("+# maximum stacks of Puppet Master" vs "# maximum stacks…").
  const key = (s) => s.toLowerCase().replace(/\+#/g, '#');
  const want = new Map((demandMods || []).filter((r) => r.pct >= WANT_PCT).map((r) => [key(r.name), r.pct]));
  // Rare weapon without an Aldur rune: the mods' element can be changed with a rune (Passion / Ire / Breath / Betrayal) — demand for an
  // elemental mod is taken from the best element (Extra Cold on a staff counts as Extra Fire), and the best element is suggested.
  const aldur = item.rarity === 'Rare' && ALDUR_WEAPONS.has(item.itemClass) && !(item.modLines || []).some((l) => /^Forged by the \w+ of Aldur$/.test(l.text));
  const bestElement = {};
  if (aldur) {
    const all = new Map((demandMods || []).map((r) => [key(r.name), r.pct]));
    for (const r of demandMods || []) {
      if (!/\b(fire|cold|lightning)\b/i.test(r.name)) continue;
      const vs = ELEMENTS.map((e) => [e, all.get(key(r.name.replace(/\b(Fire|Cold|Lightning)\b/g, e))) || 0]);
      const top = vs.reduce((a, b) => (b[1] > a[1] ? b : a));
      if (top[1] >= WANT_PCT) for (const [e] of vs) want.set(key(r.name.replace(/\b(Fire|Cold|Lightning)\b/g, e)), top[1]);
      bestElement[key(r.name)] = top;
    }
  }
  // Lines the item already has do not make a candidate wanted: for an "armour / minion damage" hybrid
  // demand is counted by armour — the item already has minion damage (and with "among builds using it" demand it would be 100%).
  const own = new Set((item.modLines || []).flatMap((l) => templates(l.text)));
  // An Aldur rune converts the element — the same mod in another element is already "present" (not a candidate: Fire Spell Skills to Cold).
  if (aldur) for (const l of [...own]) if (/\b(fire|cold|lightning)\b/.test(l)) for (const e of ELEMENTS) own.add(l.replace(/\b(fire|cold|lightning)\b/g, e.toLowerCase()));
  const candidates = (domain, src = onBase) => {
    const byType = new Map();
    for (const m of src) {
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

  // Key mod with a weak tier: many builds use it but the tier is low — a higher tier is valuable, not a different mod.
  const tierUps = mine.filter((a) => a.mod && a.tag !== 'fractured' && a.tier >= 3).map((a) => {
    const pct = Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0));
    if (pct < KEY_PCT) return null;
    const tiers = onBase.filter((m) => m.type === a.mod.type && m.domain === a.mod.domain).sort((x, y) => y.required_level - x.required_level);
    const bestIdx = tiers.findIndex((m) => m.required_level <= ilvl);
    if (bestIdx < 0 || bestIdx + 1 >= a.tier) return null;
    const how = [t('Divine Orb — rerolls the values of all modifiers at once, each only within its tier (now T{tier})', { tier: a.tier })];
    how.push(a.tag === 'desecrated'
      ? t('Orb of Annulment + Omen of Light removes it; desecrating again gives a random desecrated modifier — not necessarily this one')
      : t('A higher tier means removing it and rolling it again — the same modifier is not guaranteed'));
    return { text: a.mod.lines.join(' / '), tier: a.tier, best: bestIdx + 1, range: range(tiers[bestIdx].text), pct, how };
  }).filter(Boolean);

  const normal = candidates('item');
  // What can take the crafted slot and give a specific mod: Perfect and corrupted essences, Alloys for this class.
  const craftedSources = [...perfectFor(item.itemClass).map((x) => ({ name: x.name, text: x.mod })), ...corruptedFor(item.itemClass)];
  // Influence rune not socketed yet: in-demand mods from its pool are candidates too, but with the condition "rune first"
  // (socketed permanently into a free augment socket). Thrud's Might on a weapon → "Explicit Speed Modifier magnitudes" etc.
  const runes = (item.modLines || []).filter((l) => l.tag === 'rune').length;
  const freeSocket = (item.sockets || 0) > runes;
  for (const r of INFLUENCE_RUNES) {
    if (hasInf.includes(r.tag) || !r.on.some((tg) => tags.includes(tg)) || hasInf.length) continue;
    const extra = d.pool.filter((m) => canRoll(m, [...tags, r.tag]) && !canRoll(m, tags));
    for (const c of candidates('item', extra)) {
      if (normal.some((x) => x.type === c.type)) continue;
      normal.push({ ...c, needs: { rune: r.rune, line: `Can roll ${r.name} modifiers`, free: freeSocket } });
    }
  }
  // Crafted slots on the item: one, plus the Astrid's Creativity rune — "Can have 1 additional Crafted Modifier".
  const craftedCap = 1 + (item.modLines || []).reduce((n, l) => { const m = l.text.match(/^Can have (\d+) additional Crafted Modifiers?$/); return n + (m ? +m[1] : 0); }, 0);
  // A crafted mod that does not exist as a normal affix (Celestial Alloy — "+Accuracy / Attack Speed" on spears, maces, bows…):
  // a "crafted slot only" candidate (removes a random mod of the side and adds its own). Value — by demand for its lines.
  // Take the single best one: the item has one crafted slot.
  if (item.affixes.filter((a) => a.tag === 'crafted').length < craftedCap) {
    let best = null;
    for (const x of craftedSources) {
      if (!x.side || !['prefix', 'suffix'].includes(x.side)) continue;
      const raw = x.text.replace(/–/g, '-').replace(/ \/ /g, '\n'); // hybrids in the data are joined with " / "
      const lines = templates(raw);
      if (normal.some((c) => c.side === x.side && lines.every((l) => c.text.split(' / ').includes(l)))) continue; // Exalted gives this too
      if (lines.every((l) => own.has(l))) continue; // the item already has this mod (a hybrid sharing one line is fine)
      const ps = lines.map((l) => want.get(l) || 0).sort((a, b) => b - a);
      // Hybrid value: best line + half of the second (for picking and the plan). Not a share of builds — can exceed 100;
      // the window shows the best line's share (shownPct) and per-line shares (pctParts).
      const pct = (ps[0] || 0) + (ps[1] || 0) / 2;
      if (pct >= WANT_PCT && (!best || pct > best.pct)) best = { side: x.side, pct, shownPct: ps[0] || 0, pctParts: lines.map((l) => [l, want.get(l) || 0]),
        text: lines.join(' / '), tier: null, tiers: 1, range: null, level: 0,
        stats: tradeStats({ text: raw }, 'item', item.itemClass), type: 'crafted:' + x.name, crafted: [x.name], craftedOnly: x.name };
    }
    if (best) normal.push(best);
  }
  normal.sort((a, b) => b.pct - a.pct);
  // Rough chance that the next mod on this side (Exalted + side omen) is exactly this one: the family's frequency among all
  // that can roll here (excluding taken groups), per collected stats. Families without data count as the rarest.
  // What Exalted can add to each side: family → levels of its tiers on this item (excluding taken groups).
  const sidePool = {};
  for (const side of ['prefix', 'suffix']) {
    const lv = new Map();
    for (const m of onBase) {
      if (m.domain !== 'item' || m.generation_type !== side || m.is_essence_only || m.required_level > ilvl
        || (m.groups || []).some((g) => present.has(g))) continue;
      if (!lv.has(m.type)) lv.set(m.type, []);
      lv.get(m.type).push(m.required_level);
    }
    sidePool[side] = lv;
  }
  let nOf = null; // family frequency from collected stats (if any)
  const W = weights();
  const wc = classWeights(W, item.itemClass, base, d);
  let chanceMeta = null;
  if (wc && wc.items >= 50) {
    chanceMeta = { items: wc.items, collected: W.meta.collected, league: W.meta.league };
    const counts = familyCounts(wc, (type) => Math.max(0, ...(d.typeLines.get(type) || []).map((l) => want.get(l) || 0)));
    // Stats are per whole class (all boots), but defence mods roll only on their own bases (evasion — on "dex" ones).
    // Divide the frequency by the share of the class's "base types" where the family can roll at all: a weight estimate as if it rolled everywhere.
    const share = eligibleShare(d, base);
    for (const type of Object.keys(counts)) counts[type] /= Math.max(share(type), 0.1);
    const n = (type) => (counts[type] || 0) + SMOOTH;
    nOf = n;
    for (const side of ['prefix', 'suffix']) {
      const types = new Set(sidePool[side].keys());
      const total = [...types].reduce((s, type) => s + n(type), 0);
      // Valuable mods (≥ SALE_REASON% of builds) cannot be estimated fairly from trade: without a price cap they are inflated (such items
      // are listed more eagerly), with a cap — deflated (such items cost more). No chance is shown for them.
      for (const c of normal.filter((x) => x.side === side)) {
        if (c.pct >= SALE_REASON) c.chance = null, c.chanceUnknown = true;
        else if (total && types.has(c.type)) c.chance = n(c.type) / total;
      }
    }
  }
  // Exalted / Greater (mods 35+) / Perfect (50+): chance that the next mod is this family in one of its two best tiers
  // (the craft goal is counted at the best tier). Tier weights within a family are unknown — treated as equal.
  // chance — from stats (null for valuable mods and without data), guess — as if all families were equally likely:
  // the window uses it to pick currency when the chance is unknown. pool — how many families can roll at all.
  // Desecration: on reveal at the Well of Souls you get 3 mods to choose from — from the side's normal pool and its own
  // desecrated mods (their weights are unknown — treated as average). single — chance of one option; the window computes "among 3 (6 with Abyssal Echoes)".
  const desFamilies = {};
  for (const side of ['prefix', 'suffix']) {
    desFamilies[side] = new Set(onBase.filter((m) => m.domain === 'desecrated' && m.generation_type === side && m.required_level <= ilvl).map((m) => m.type)).size;
  }
  const bones = bonesFor(tags, ilvl);
  const desecrateOK = !item.desecratedItem;
  // A desecrated mod that does not exist as a normal affix (lich mods: "+1 Ballista Totem", "ES from Equipped Body Armour"…):
  // a "Desecrate only" candidate (docs/crafting-methods-research.md). Without an omen — 1 of all the side's families;
  // with a lich omen (Sovereign → Ulaman, Liege → Amanamu, Blackblooded → Kurgal; weapons and jewellery, ilvl 65+) all
  // reveal options come from that lich's pool: with ≤ 3 mods on the side the wanted one is guaranteed. One slot — take the best.
  if (desecrateOK && !mine.some((a) => a.tag === 'desecrated') && bones.length) {
    let best = null;
    for (const c of candidates('desecrated')) {
      if (normal.some((x) => x.type === c.type || x.text === c.text)) continue;
      if (c.pct >= WANT_PCT && (!best || c.pct > best.pct)) best = c;
    }
    // Altered Collarbone (jewellery): Desecrate "with a chance of otherworldly mods" — its own pool of Breach mods
    // (tag breach_desecration, level 1 — Whittling removes them first). The share of otherworldly ones among the options is unknown.
    const jewellery = ['ring', 'amulet', 'belt'].some((tg) => tags.includes(tg));
    if (jewellery) {
      const altered = d.pool.filter((m) => m.domain === 'desecrated' && canRoll(m, [...tags, 'breach_desecration']) && !canRoll(m, tags));
      for (const c of candidates('desecrated', altered)) {
        if (normal.some((x) => x.type === c.type || x.text === c.text)) continue;
        if (c.pct >= WANT_PCT && (!best || c.pct > best.pct)) {
          const n = new Set(altered.filter((m) => m.generation_type === c.side && !(m.groups || []).some((g) => present.has(g))).map((m) => m.type)).size || 1;
          best = { ...c, altered: n };
        }
      }
    }
    if (best && best.altered) {
      best.desecrateOnly = true;
      best.desecrate = { 'Altered Collarbone': { pool: best.altered, good: 1, guess: 1 / best.altered, chance: null, altered: true } };
      normal.push(best);
      normal.sort((a, b) => b.pct - a.pct);
      best = null;
    }
    if (best) {
      const mod = onBase.find((x) => x.domain === 'desecrated' && x.type === best.type);
      const lich = Object.keys(LICH_OMEN).find((l) => ((mod && mod.implicit_tags) || []).includes(`${l}_mod`));
      const lichOK = lich && ilvl >= 65 && LICH_CLASSES.some((tg) => tags.includes(tg));
      const sideDes = onBase.filter((x) => x.domain === 'desecrated' && x.generation_type === best.side && x.required_level <= ilvl
        && !(x.groups || []).some((g) => present.has(g)));
      const fam = new Set([...sideDes.map((x) => x.type), ...sidePool[best.side].keys()]).size || 1;
      const lichN = lichOK ? new Set(sideDes.filter((x) => (x.implicit_tags || []).includes(`${lich}_mod`)).map((x) => x.type)).size || 1 : 0;
      best.desecrateOnly = true;
      best.desecrate = {};
      for (const b of bones) {
        // Gnawed — items up to ilvl 64: does not give level-65 exclusives (lich mods) (docs/crafting-tricks.md).
        if (mod && mod.required_level >= 65 && /^Gnawed/.test(b.name)) continue;
        best.desecrate[b.name] = { pool: fam, good: 1, guess: 1 / fam, chance: 1 / fam };
        if (lichOK) best.desecrate[`${b.name}|${LICH_OMEN[lich]}`] = { pool: lichN, good: 1, guess: 1 / lichN, chance: 1 / lichN, extra: [LICH_OMEN[lich]], lich: { name: lich, n: lichN } };
      }
      normal.push(best);
      normal.sort((a, b) => b.pct - a.pct);
    }
  }
  for (const c of normal) {
    const lv = sidePool[c.side];
    const mineLv = lv.get(c.type);
    if (!mineLv) continue;
    const top = [...mineLv].sort((a, b) => b - a).slice(0, 2).pop();
    // Chance that the mod (among normal ones with level ≥ L plus "extra" foreign families at average weight) is this family in T1–T2.
    // The min. level (Greater/Perfect, Ancient bone) cuts off low tiers, but a family with no tiers above the threshold
    // still rolls at its best tier (docs/crafting-tricks.md §0) — families do not vanish from the pool.
    const at = (L, extra = 0) => {
      const allowed = (type) => { const l = lv.get(type); const ok = l.filter((x) => x >= L); return ok.length ? ok : [Math.max(...l)]; };
      const share = (type) => allowed(type).length / lv.get(type).length;
      const okC = allowed(c.type);
      const good = okC.filter((x) => x >= top).length / okC.length;
      const types = [...lv.keys()];
      const odds = (w) => { const sum = types.reduce((s, type) => s + w(type), 0); return w(c.type) / (sum + extra * sum / types.length) * good; };
      // rough — the frequency-based estimate even for a "valuable" mod whose exact odds are not trusted (chanceUnknown):
      // used only to decide which step deserves the single Desecrate (the rarer, the more a 1-of-3 choice helps).
      const rough = nOf ? odds((type) => nOf(type) * share(type)) : null;
      return { pool: types.length + extra, good, guess: odds(share), rough, chance: nOf && !c.chanceUnknown ? rough : null };
    };
    c.exalt = {};
    for (const [k, L] of Object.entries(EXALT_MIN)) {
      if (L && tags.includes('jewel')) continue; // jewels have one tier — the pricier Exalted give nothing
      const o = at(L);
      if (o) c.exalt[k] = o;
    }
    if (desecrateOK && bones.length && !c.desecrateOnly) {
      c.desecrate = {};
      for (const b of bones) { const o = at(b.minLevel, desFamilies[c.side]); if (o) c.desecrate[b.name] = o; }
    }
    // Guaranteed mod via the crafted slot: Perfect and corrupted essences ("remove a random mod and add their own").
    const lines = c.text.split(' / ');
    // A source fits if it gives ALL the mod's lines (Celestial Alloy "Mana / +1 Spell Skills" — for "+Mana", but not for "Spell Damage / Mana").
    if (!c.craftedOnly) c.crafted = craftedSources.filter((x) => { const src = templates(x.text.replace(/–/g, '-').split(' / ').join('\n')); return lines.every((l) => src.includes(l)); }).map((x) => x.name);
    // Blocker (docs/crafting-tricks.md T-08, D-5): the side has a common unwanted family — a cheap mod of that group
    // (e.g. picked on a desecrate reveal) closes it off for the following Exalted; it is removed later.
    if (nOf) {
      const isWanted = (type) => normal.some((x) => x.type === type && x.side === c.side);
      let sum = 0, junk = null;
      for (const type of lv.keys()) {
        const w = nOf(type);
        sum += w;
        if (type !== c.type && !isWanted(type) && (!junk || w > junk.w)) junk = { type, w };
      }
      if (junk && junk.w / sum >= 0.12) c.blocker = { text: (d.typeLines.get(junk.type) || [junk.type]).join(' / '), share: junk.w / sum };
    }
  }
  for (const c of normal) c.essence = essenceFor(c.text, item.itemClass);
  // A crafted hybrid (Alloy) is not needed if an essence adds a wanted mod of comparable value (Perfect Essence of Sorcery +3
  // to levels on a wand beats the "mana / spell levels" hybrid): there is only one crafted slot.
  const co = normal.find((c) => c.craftedOnly);
  if (co && normal.some((c) => c !== co && c.crafted && c.crafted.some((n) => n !== co.craftedOnly) && c.pct >= co.pct * 0.6)) normal.splice(normal.indexOf(co), 1);
  for (const c of normal) {
    const others = normal.filter((x) => x !== c && x.side === c.side && x.exalt && x.pct >= Math.max(15, c.pct * 0.6));
    if (!others.length || !c.exalt) continue;
    const merge = (list) => ({ ...list[0], guess: Math.min(0.95, list.reduce((a, o) => a + o.guess, 0)),
      chance: list.some((o) => o.chance == null) ? null : Math.min(0.95, list.reduce((a, o) => a + o.chance, 0)) });
    c.exaltAny = {};
    for (const k of Object.keys(c.exalt)) c.exaltAny[k] = merge([c.exalt[k], ...others.map((x) => x.exalt[k]).filter(Boolean)]);
    if (c.desecrate) {
      c.desecrateAny = {};
      for (const b of Object.keys(c.desecrate)) c.desecrateAny[b] = merge([c.desecrate[b], ...others.map((x) => x.desecrate && x.desecrate[b]).filter(Boolean)]);
    }
    c.orMods = others.map((x) => x.text);
  }
  // "Lucky ilvl" (docs/market-notes.md §2): the last level where a tier opened for a family builds want. Above it —
  // only tiers of unwanted ones: for wanted mods the base is no better than a base of that level, and the extra tiers dilute the pool (family weight
  // grows with the number of tiers). For a white / magic base — a hint for both buyer and seller.
  let ilvlHint = null;
  if (item.rarity === 'Normal' || item.rarity === 'Magic') {
    const lv = new Map(); // family → tier levels up to the item's ilvl
    for (const m of onBase) {
      if (m.domain !== 'item' || m.is_essence_only || m.required_level > ilvl) continue;
      if (!lv.has(m.type)) lv.set(m.type, { lines: m.lines, levels: [] });
      lv.get(m.type).levels.push(m.required_level);
    }
    const wanted = [...lv.values()].filter((x) => x.lines.some((l) => (want.get(l) || 0) >= WANT_PCT));
    const top = wanted.length ? Math.max(...wanted.flatMap((x) => x.levels)) : null;
    const junk = top == null ? [] : [...lv.values()].filter((x) => !wanted.includes(x) && x.levels.some((l) => l > top));
    if (top != null && top < ilvl && junk.length) ilvlHint = { from: top, ilvl, junk: junk.map((x) => x.lines.join(' / ')).slice(0, 4), more: Math.max(0, junk.length - 4) };
  }
  if (item.rarity === 'Normal') return { normal: transmuteOptions(normal, sidePool, nOf, ilvl, jewel), popular: normal.slice(0, 8), chanceMeta, ilvlHint };
  const sections = [];

  // 0. Magic → rare: an essence gives a guaranteed mod, Regal — a random one from the whole pool.
  // Magic with a free slot (1 prefix + 1 suffix): first cheaply fill it with Augmentation while it is still magic.
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
      ...(sure.length ? [t("An essence uses the item's only crafted-modifier slot: no Perfect Essence or Alloy later")] : []),
      t('Regal Orb — makes it rare with one random modifier from the whole pool; the popular ones below are only some of the outcomes'),
      ...(jewel ? [] : [t('Greater / Perfect Regal Orb — the same, but only modifiers of level 35+ / 50+')]),
      t('Omen of Sinistral / Dextral Coronation — the next Regal Orb adds only a prefix / only a suffix'),
      t('Orb of Alchemy — rerolls into a rare with 4 new random modifiers (current ones are lost); Omen of Sinistral / Dextral Alchemy — as many prefixes / suffixes as possible'),
      // Magic with one mod — a second can be added before Regal: Greater / Perfect Augmentation gives only high-level mods.
    ] });
  }

  // 1. Free slots — Exalted Orb (Omen Sinistral/Dextral Exaltation — prefix/suffix only).
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

  // 2. All taken — replace the weakest mod: worst tier and not in demand. Fractured cannot be removed.
  if (!open.prefix && !open.suffix) {
    // Good tiers (T1–T2) are never replaced: even an unwanted T1 is worth more than an Annulment lottery.
    // In-demand mods (≥ KEY_PCT% of builds) are not swapped for others either — even with a weak tier: they need a higher tier (block below).
    const scored = mine.filter((a) => a.mod && a.tag !== 'fractured' && !(a.tier && a.tier <= 2)).map((a) => {
      const pct = Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0));
      return { ...a, pct, score: pct / 100 * 3 - (a.tier || 3) / 3 };
    }).filter((a) => a.pct < KEY_PCT).sort((a, b) => a.score - b.score);
    const weak = scored[0];
    if (!weak) { if (!tierUps.length) sections.push({ kind: 'keep' }); }
    else {
      const sameSide = mine.filter((a) => a.side === weak.side && a.tag !== 'fractured').length;
      // Whittling looks at ALL mods on the item (except fractured), not only at replacement candidates.
      const cands = mine.filter((a) => a.tag !== 'fractured');
      const known = cands.every((a) => a.mod);
      const byLevel = cands.filter((a) => a.mod).sort((a, b) => a.mod.required_level - b.mod.required_level);
      const lowest = known && byLevel.length && (byLevel.length < 2 || byLevel[0].mod.required_level < byLevel[1].mod.required_level) ? byLevel[0] : null;
      const erasure = weak.side === 'prefix' ? 'Omen of Sinistral Erasure' : 'Omen of Dextral Erasure';
      const omen = weak.side === 'prefix' ? 'Omen of Sinistral Annulment' : 'Omen of Dextral Annulment';
      const how = weak.tag === 'desecrated'
        // Desecrated is removed in a targeted way: with Omen of Light, Annulment removes only desecrated mods.
        ? [t('Orb of Annulment + Omen of Light — removes the desecrated modifier (any tier), then desecrate again or Exalted Orb')]
        : [t(`Orb of Annulment + {omen} — removes a random ${weak.side} (1 in {n} to hit this one), then Exalted Orb`, { omen, n: sameSide }),
          t(`Chaos Orb + {omen} — removes a random ${weak.side} and adds a random modifier (Greater / Perfect Chaos: level 35+ / 50+)`, { omen: erasure })];
      // On jewels all mods are the same level — Whittling effectively removes a random one.
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

  // 3. Desecration — its own pool of desecrated mods, one per item.
  if (!item.desecratedItem && !mine.some((a) => a.tag === 'desecrated')) {
    const fits = (c) => open[c.side] || (!open.prefix && !open.suffix);
    // Jewels: their own desecrated pool — hybrid prefixes and three attribute suffixes, and on reveal normal pool mods are offered too
    // — that is why jewels get desecrated (a second crit line, Movement Speed: docs/jewels-crafting.md §2.3, M).
    // Desecrated hybrids sharing the same wanted line ("ES / Spell", "ES / Attack", …) — keep one, with the most wanted second line.
    const lineOf = (c) => c.text.split(' / ').reduce((a, l) => ((want.get(l) || 0) > (want.get(a) || 0) ? l : a));
    const second = (c) => c.text.split(' / ').filter((l) => l !== lineOf(c)).reduce((s, l) => Math.max(s, want.get(l) || 0), 0);
    const oneHybrid = (list) => list.filter((c) => !list.some((x) => x !== c && lineOf(x) === lineOf(c) && (second(x) > second(c) || (second(x) === second(c) && list.indexOf(x) < list.indexOf(c)))));
    const des = jewel
      ? oneHybrid([...candidates('desecrated'), ...normal.filter((c) => !c.craftedOnly && !c.desecrateOnly && !c.needs).map((c) => ({ ...c, fromNormal: true, chance: null, chanceUnknown: false, essence: null }))])
        .filter(fits).sort((a, b) => b.pct - a.pct).slice(0, 6)
      : candidates('desecrated').filter(fits).slice(0, 4);
    if (des.length) {
      // Desecrated is a separate slot (not crafted), but on a full item it removes a random mod: desecrate BEFORE the Exalts.
      // Lich omens — "Weapon or Jewellery" (and belts — confirmed, docs/crafting-methods-research.md), lich mods are level 65.
      // Same rules as the plan (LICH_CLASSES): otherwise the plan spent the omen while the hint stayed silent about it.
      const lich = ilvl >= 65 && LICH_CLASSES.some((tg) => tags.includes(tg));
      const bodyGear = ['body_armour', 'helmet', 'gloves', 'boots'].some((x) => tags.includes(x));
      sections.push({ kind: 'desecrate', how: [
        t('Desecrate with {bone} — adds an unrevealed desecrated modifier', { bone: boneFor(tags, ilvl) }) + (!open.prefix && !open.suffix ? ` (${t('replaces a random one when full')})` : ''),
        t('Desecrate before the Exalted Orbs — on a full item it removes a random modifier'),
        t('Omen of Sinistral / Dextral Necromancy — only a prefix / only a suffix'),
        t('On reveal you choose 1 of 3 options; they can include normal modifiers unless a lich omen is used; Omen of Abyssal Echoes rerolls the options once'),
        ...(bodyGear ? [t('Body armour, helmets, gloves and boots have no desecrated prefixes — Sinistral Necromancy gives only normal prefixes')] : []),
        ...(lich ? [t('Omen of the Sovereign / the Liege / the Blackblooded — guaranteed Ulaman / Amanamu / Kurgal modifier')] : []),
      ], candidates: des });
    }
  }

  // Perfect essences — rares only: remove a random mod and add their own (the slot has its own set, not the Greater one).
  // Since 0.5 an item has only one crafted mod (essences, incl. Perfect and corrupted, and Alloy). If present — Perfect/Alloy will not apply.
  const hasCrafted = mine.some((a) => a.tag === 'crafted');
  // Everything that replaces a random mod with a guaranteed crafted mod: Perfect essences, corrupted essences, Alloy (data/crafting-currency.json).
  const perfect = item.rarity === 'Rare' ? [...perfectFor(item.itemClass), ...guaranteedFor(item.itemClass)] : [];
  if (overfull.length) {
    const s = t(overfull[0]);
    sections.push({ kind: 'overfull', side: overfull[0], how: [
      t('{n} {side}es with room for {max}: the extra slot stays after the crafted «+1 Modifier allowed» was removed', { n: used[overfull[0]], side: s, max: max[overfull[0]] }),
      t('Chaos Orb and Exalted Orb cannot touch this side — its modifiers are safe; work on the other side'),
      t('A removed {side} cannot be added back — the slot is lost', { side: s }),
      t('The crafted-modifier slot is free again — a second emotion (Ferocity, Very Large radius) can go in'),
      t('Community finding from 0.5 — not verified in 0.5.5'),
    ] });
  }
  if (jewel && item.rarity === 'Rare') {
    const timeLost = tags.includes('radius_jewel');
    // Options for this base (regular emotions — basic jewels, Ancient — Time-Lost): which mod it gives, how many builds
    // use it. An emotion removes a RANDOM mod: risk — how many key mods (by demand) out of all on the item may go.
    // Not built into the plan: which side loses a mod on a full item when the emotion's mod is one-sided is unverified.
    const pctOf = (lines) => Math.max(0, ...lines.map((l) => want.get(l) || 0));
    const all = emotionsFor(item.baseType).filter((e) => !e.lines.every((l) => own.has(l)));
    const POTENT = /Potent /;
    // Two entries of one emotion (Ferocity, Contempt: prefix or suffix) — as one line.
    const byName = new Map();
    for (const e of all) {
      const o = byName.get(e.name);
      if (o) { o.text += ` / ${e.text}`; o.two = true; o.pct = Math.max(o.pct, pctOf(e.lines)); } else byName.set(e.name, { name: e.name, side: e.side, text: e.text, pct: pctOf(e.lines), two: false });
    }
    const options = [...byName.values()]
      .filter((o) => o.pct >= WANT_PCT || POTENT.test(o.name))
      .sort((a, b) => b.pct - a.pct || POTENT.test(b.name) - POTENT.test(a.name)).slice(0, 8);
    const keys = mine.filter((a) => a.tag !== 'fractured' && a.mod && pctOf(a.mod.lines) >= KEY_PCT).map((a) => a.mod.lines.join(' / '));
    sections.push({ kind: 'emotions', timeLost, blocked: hasCrafted, options, risk: { n: mine.filter((a) => a.tag !== 'fractured').length, keys },
      how: hasCrafted ? [t('This item already has a crafted modifier — Liquid Emotions cannot be used (one crafted modifier per item)')]
        : [t('Removes a random modifier; uses the only crafted-modifier slot'), t("Hinekora's Lock first — see the result before you commit")] });
  }
  if (perfect.length && hasCrafted) {
    sections.push({ kind: 'perfect', blocked: true, how: [] });
  } else if (perfect.length) {
    sections.push({ kind: 'perfect', how: [...perfect.map((p) => `${p.name} — ${p.mod}`),
      t('Omen of Sinistral / Dextral Crystallisation — the Perfect Essence removes only a prefix / only a suffix'),
      t('Uses the only crafted-modifier slot (one per item; Alloys too)'),
      t("Hinekora's Lock first — see the result before you commit")] });
  }

  // 4. Cheap and risk-free.
  const cheap = [];
  const armourOrWeapon = tags.includes('armour') || tags.includes('weapon') || tags.includes('onehand') || tags.includes('twohand');
  // Artificer's Orb — weapons, wands, staves and armour (sceptres are not on the list).
  // Artificer's: 2 sockets on two-handed weapons and body armour, 1 elsewhere (per guides).
  const maxSockets = tags.includes('twohand') || tags.includes('body_armour') ? 2 : 1;
  if (armourOrWeapon && !tags.includes('sceptre') && (item.sockets || 0) < maxSockets) cheap.push(t("Artificer's Orb — add an augment socket (2 max on two-handed weapons and body armour, 1 elsewhere), then a rune or soul core"));
  if (armourOrWeapon && (item.quality || 0) < 20) cheap.push(t('Quality to 20% (currently {n}%) — {currency}', { n: item.quality || 0, currency: qualityCurrency(tags) }));
  if ((tags.includes('ring') || tags.includes('amulet')) && !item.quality) cheap.push(t('Catalyst — quality on rings and amulets boosts matching modifiers (life, minion, caster…); Omen of Catalysing Exaltation makes the next Exalted Orb consume all catalyst quality to favour that type — re-apply the catalyst afterwards'));
  if (jewel && !item.quality) cheap.push(t('Refined Catalyst — quality on jewels boosts matching modifiers'));
  if (aldur) {
    const tally = {};
    for (const a of mine) {
      for (const l of (a.mod && a.mod.lines) || []) {
        const cur = (l.match(/\b(fire|cold|lightning)\b/) || [])[1];
        const top = bestElement[l];
        if (!cur || !top) continue;
        const curPct = want.get(l) != null && top[0].toLowerCase() === cur ? top[1] : ((demandMods || []).find((r) => key(r.name) === l) || {}).pct || 0;
        tally[top[0]] = tally[top[0]] || { gain: 0, from: cur };
        if (top[0].toLowerCase() !== cur) tally[top[0]].gain += top[1] - curPct;
      }
    }
    const best = Object.entries(tally).sort((a, b) => b[1].gain - a[1].gain)[0];
    if (best && best[1].gain >= 10) cheap.push(t('{rune} turns the {from} modifiers into {to} for good — {to} versions are more in demand; check «Other elements» on the Price tab before you socket it', { rune: ALDUR_RUNE[best[0]], from: best[1].from, to: best[0] }));
  }
  // +3 to skill levels on jewellery becomes +4 at 34%+ quality (3 × 1.34); Essence of the Breach raises
  // the quality cap by 20% (docs/crafting-tricks.md T-11, per community data).
  const plus3 = (tags.includes('ring') || tags.includes('amulet')) && (item.modLines || []).find((l) => /^\+3 to Level of all .*Skills$/.test(l.text));
  if (plus3 && (item.quality || 0) < 34) cheap.push(t('Quality 34%+ turns «{mod}» into +4: a matching catalyst, and Essence of the Breach raises the quality cap by 20% (community finding, not verified)', { mod: plus3.text }));
  const total = mine.length;
  if (cheap.length) sections.push({ kind: 'cheap', how: cheap });
  // Fracturing is not "cheap and risk-free": in 0.5 it is rare (atlas only) and locks a RANDOM mod.
  // Needs ≥ 4 mods (desecrated, even unrevealed, counts), but desecrated and already fractured mods cannot be locked:
  // chance = key / lockable. Trick: 3 normal mods + Desecrate without revealing → 4 mods, chance 1/3 instead of 1/4
  // (docs/crafting-tricks.md D-4, T-05).
  if (!magic && !item.fracturedItem) {
    const pctOf = (a) => (a.mod ? Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0)) : 0);
    const fixable = mine.filter((a) => a.tag !== 'desecrated' && a.tag !== 'fractured');
    const keys = fixable.filter((a) => pctOf(a) >= KEY_PCT || (a.tier && a.tier <= 2 && pctOf(a) >= WANT_PCT));
    const hasDes = mine.some((a) => a.tag === 'desecrated');
    const how = [];
    if (keys.length && total >= 4) {
      how.push(t('Fracturing Orb — locks a random modifier forever: {odds} to lock a key one ({mods})',
        { odds: oddsOf(keys.length / fixable.length), mods: keys.map((a) => a.mod.lines.join(' / ')).join(', ') }));
      if (!hasDes && fixable.length === 4 && bones.length) how.push(t('Better odds: remove one unwanted modifier, then desecrate and do not reveal — 3 regular + 1 unrevealed gives {odds}', { odds: oddsOf(keys.length / 3) }));
    } else if (keys.length && total === 3 && !hasDes && bones.length) {
      how.push(t('Fracturing Orb needs 4 modifiers: desecrate first and do not reveal — an unrevealed desecrated modifier counts but cannot be locked: {odds} to lock {mods}',
        { odds: oddsOf(keys.length / 3), mods: keys.map((a) => a.mod.lines.join(' / ')).join(', ') }));
    }
    if (how.length) {
      how.push(t('After it: remove the rest (Annulment) and rebuild around the locked modifier; a miss locks a useless one — the base is spent'));
      how.push(t("Hinekora's Lock (preview the result first) — only if the item is worth far more than the Lock"));
      sections.push({ kind: 'risky', how, prices: ['Fracturing Orb', "Hinekora's Lock"] });
    }
  }

  const goal = planGoal(mine, normal, max, want, magic, magicFree, item.itemClass, craftedSources, item.quality || 0, craftedCap);
  // Runes / Soul Cores for sockets: augments for the class whose stats builds use (demand ≥ 15%) — the best per stat family.
  const augments = [];
  if (!jewel) {
    const fam = new Map();
    for (const a of d.augs || []) {
      const cat = a.cats.find((c) => augFits(c.target, item.itemClass));
      if (!cat || a.level > (item.reqLevel || 100) + 20) continue;
      // Influence, Aldur and Legacy runes (uniques only) are handled separately.
      const kind = methods.byName(a.name);
      if ((kind && ['rune-influence', 'rune-aldur', 'rune-special'].includes(kind.id)) || /Legacy/.test(a.limit || '') || /^Legacy of /.test(a.name)) continue;
      const pct = Math.max(0, ...cat.lines.map((l) => want.get(l) || 0));
      if (pct < WANT_PCT) continue;
      const key = cat.lines.join('|');
      const rank = (n) => (/^Perfect /.test(n) ? 3 : /^Greater /.test(n) ? 2 : /^Lesser /.test(n) ? 0 : 1);
      const prev = fam.get(key);
      if (!prev || rank(a.name) > rank(prev.name)) fam.set(key, { name: a.name, lines: cat.lines, pct, ancient: /Ancient/.test(a.limit || '') });
    }
    augments.push(...[...fam.values()].sort((x, y) => y.pct - x.pct).slice(0, 4));
  }
  const runesIn = (item.modLines || []).filter((l) => l.tag === 'rune').length;
  const gamble = gambleFor(item, tags);
  return { open, max, sections, goal, gamble, augments, freeSockets: Math.max(0, (item.sockets || 0) - runesIn), chanceMeta, ilvlHint, source: 'RePoE (game files) · demand: poe.ninja' };
}

// White base → magic: Orb of Transmutation gives one random mod (prefix or suffix);
// Greater — only mods of level 44+, Perfect — 70+ (less junk, higher tiers). For each: how many families can roll,
// chance of a popular mod (any tier) and of a popular one in one of its two best tiers. Weights — from stats (nOf) or equal.
const TRANSMUTE = methods.tiers('transmute');
function transmuteOptions(popular, sidePool, nOf, ilvl, jewel) {
  const out = [];
  for (const [name, L] of TRANSMUTE) {
    if (L && (jewel || ilvl < L)) continue;
    let total = 0, any = 0, top = 0, pool = 0;
    for (const side of ['prefix', 'suffix']) {
      for (const [type, lv] of sidePool[side]) {
        // A family with no tiers above the threshold rolls at its best tier (as with Exalted).
        const hi = lv.filter((x) => x >= L);
        const ok = hi.length ? hi : [Math.max(...lv)];
        const w = (nOf ? nOf(type) : 1) * ok.length / lv.length;
        total += w;
        pool++;
        const c = popular.find((x) => x.type === type && x.side === side);
        if (!c) continue;
        const best = [...lv].sort((a, b) => b - a).slice(0, 2).pop();
        any += w;
        top += w * ok.filter((x) => x >= best).length / ok.length;
      }
    }
    if (total) out.push({ name, minLevel: L, pool, any: any / total, top: top / total });
  }
  return out;
}

// Share of the class's "base types" (by tag set: str_armour, dex_int_armour…) on which the mod family can roll.
const shareCache = new Map();
craftData.onReset(() => shareCache.clear());
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

// Mod family frequencies for estimating odds.
// From each item's mods (raw): on each item we skip the "reason for sale" — the most in-demand mod, if
// ≥ SALE_REASON% of builds use it: the item was listed for it, and its other mods rolled by chance.
const SALE_REASON = 30;
const SMOOTH = 1; // +1 to each family: single finds do not get inflated, unseen ones do not drop to zero
// Weight stats for an item. Wands and staves with an element (Volatile Wand — fire, Frigid — cold…): if bases of the same
// element have 100+ items — use them (mods of that element roll more often there); otherwise — the whole class.
function classWeights(W, itemClass, base, d) {
  const wc = W && W.classes[itemClass];
  if (!wc || !wc.rowBase || !(wc.bases || []).length || !base) return wc;
  const sig = base.spellAffinity || '';
  const same = new Set();
  wc.bases.forEach((name, i) => { const b = d.bases.get(name); if (b && (b.spellAffinity || '') === sig) same.add(i); });
  const raw = wc.raw.filter((_, i) => same.has(wc.rowBase[i]));
  if (raw.length < 100 || raw.length === wc.raw.length) return wc;
  return { ...wc, raw, items: raw.length };
}

function familyCounts(wc, pctOf) {
  if (!wc.raw) return {};
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
  // A mod that is almost always the "reason for sale" (+levels on staves) and almost never appears without it —
  // cannot be estimated fairly from trade. Take at least half of the raw frequency: a selection discount, but not zero.
  const counts = {};
  for (const type of Object.keys(raw)) counts[type] = Math.max(kept[type] || 0, raw[type] * 0.5);
  return counts;
}

// Craft goal: what the best item from this base would be. On each side — the most valuable of the current and possible mods:
// value = demand (% of builds) × tier quality; a candidate is credited with an average tier (what will roll is unknown).
// Fractured cannot be removed — they always stay. Returns { keep, remove, add }, or null if there is nothing to improve.
// Greater / Perfect Exalted Orb — only mods of that level and above (src/shared/methods.js — the craft method registry).
const EXALT_KEYS = ['base', 'greater', 'perfect'];
const EXALT_MIN = Object.fromEntries(methods.tiers('exalt').map(([, lv], i) => [EXALT_KEYS[i], lv]));
const EXALT_NAME = Object.fromEntries(methods.tiers('exalt').map(([n], i) => [EXALT_KEYS[i], n]));
const KEY_PCT = 30; // a mod used by this % of builds is not swapped for another
const KEEP_BONUS = 1.5;
function planGoal(mine, candidates, max, want, magic, magicFree = [], itemClass = '', craftedSources = [], itemQuality = 0, craftedCap = 1) {
  // A key mod for the slot (skill levels, Spirit, speed on boots…) raises the price more than its popularity
  // suggests: "+2 to minions" on a sceptre is worth more than Mana Regeneration, even if the latter is more common.
  const KEY_BONUS = 2;
  // "#% increased Explicit Speed Modifier magnitudes" (Thrud's Might rune) boosts mods of its type — key
  // if the item already has such a mod (Attack Speed → speed, %Phys → physical, crit → critical…).
  const myTags = new Set(mine.flatMap((a) => (a.mod ? a.mod.implicit_tags || [] : [])));
  const boosts = (l) => { const m = l.match(/explicit (\w+)(?: damage)? modifier magnitudes/i); return !!m && myTags.has(m[1].toLowerCase()); };
  const known = want.size > 0; // demand is loaded — check the slot rule against it
  const keyOf = (lines) => lines.some((l) => boosts(l) || (isKey(itemClass, l) && (!known || (want.get(l) || 0) >= WANT_PCT)));
  // Tier quality — same scale as mod importance in search (weights.tierFactor), so the goal and the price do not disagree.
  const value = (pct, tier) => pct * tierFactor(tier || null);
  const keep = [], remove = [], add = [];
  for (const side of ['prefix', 'suffix']) {
    // Side over the limit (jewel: the crafted "+1 Suffix Modifier allowed" was removed after Potent Contempt — three suffixes
    // remain): a removed mod cannot be brought back, the slot would be lost — mods on such a side are left alone.
    const over = mine.filter((a) => a.side === side).length > max[side];
    const cur = mine.filter((a) => a.side === side).map((a) => {
      const pct = a.mod ? Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0)) : 0;
      // Fractured and good tiers (T1–T2) are left alone: even a not-so-popular T1 is worth more than the Annulment + Exalted lottery.
      // The rest are kept until a candidate is worth 1.5× more — replacement is random and costs currency.
      const weak = a.mod && a.mod.lines.every((l) => isWeak(l));
      // A good tier is kept only if someone needs the mod at all (+28 Dexterity T2 at 0% of builds is no reason).
      const spentQuality = a.mod && a.mod.lines.some((l) => /to maximum quality$/.test(l)) && itemQuality > 20;
      if (spentQuality) return { kind: 'cur', a, pct: 0, v: 0, spentQuality: true };
      const locked = over || a.tag === 'fractured' || a.tag === 'crafted' || !a.mod || (a.tier && a.tier <= 2 && !weak && pct >= 5) || pct >= KEY_PCT;
      // A non-key desecrated mod holds the only desecrate slot; it can be removed for sure (Omen of Light) and
      // a 1-of-3–6 choice revealed in its place for the wanted mod — so it is held at half strength.
      const desSlot = a.tag === 'desecrated' ? 0.5 : 1;
      return { kind: 'cur', a, pct, v: locked ? Infinity : value(pct, a.tier) * KEEP_BONUS * desSlot * (a.mod && keyOf(a.mod.lines) ? KEY_BONUS : 1) };
    });
    // A hybrid with a junk half ("Light Radius / Mana Regeneration") is worth more than an empty slot, but less than a pure mod.
    const worth = (c) => value(c.pct, 2) * (keyOf(c.text.split(' / ')) ? KEY_BONUS : 1) * (c.text.split(' / ').some((l) => isWeak(l) && !((want.get(l) || 0) >= WANT_PCT)) ? 0.6 : 1);
    const cand = candidates.filter((c) => c.side === side).map((c) => ({ kind: 'add', c, pct: c.pct, v: worth(c) }));
    const chosen = over ? cur : [...cur, ...cand].sort((x, y) => y.v - x.v).slice(0, max[side]);
    for (const x of cur) {
      const info = { side, tag: x.a.tag, text: x.a.mod ? x.a.mod.lines.join(' / ') : x.a.name, templates: x.a.mod ? x.a.mod.lines : [], tier: x.a.tier, pct: x.pct,
        level: x.a.mod ? x.a.mod.required_level : null, // for Whittling (removes the lowest-level mod)
        spentQuality: !!x.spentQuality, // the quality stays — can be removed for free
        up: x.pct >= KEY_PCT && x.a.tier >= 3 }; // key, but weak tier — "↑ tier"
      (chosen.includes(x) ? keep : remove).push(info);
    }
    for (const x of cand) if (chosen.includes(x)) add.push({ ...x.c, side });
  }
  if (!add.length) return null;
  add.sort((x, y) => y.pct - x.pct);
  // Plan for the window: steps with currency and chance — costs are computed from them (main.js fills in currency prices from poe.ninja).
  // retry — what removes a failed result so you can try again.
  const plan = [];
  const needRune = add.find((c) => c.needs);
  if (needRune) plan.push({ act: 'rune', mod: needRune.needs.line, free: needRune.needs.free, currencies: [needRune.needs.rune], chance: 1 });
  let essenceMod = null; // mod the magic → rare essence will add — do not add it a second time
  if (magicFree.length) plan.push({ act: 'augment', side: magicFree[0], currencies: ['Orb of Augmentation'], chance: 1 });
  if (magic) {
    const ess = add.find((c) => c.essence);
    essenceMod = ess || null;
    // Jewels: one tier per mod — Greater / Perfect Regal cut nothing, so the plan prices only the plain Regal Orb.
    plan.push(ess ? { act: 'essence', mod: ess.text, currencies: [ess.essence.name], chance: 1 }
      : { act: 'regal', currencies: ['Regal Orb'], chance: 1, oneTier: /Jewel/i.test(itemClass) });
  }
  // First the side with the most in-demand (key) mod — it raises the price the most.
  const top = (side) => Math.max(0, ...add.filter((c) => c.side === side).map((c) => c.pct));
  // How many mods are on the side now — changes as the plan goes (the side omen is needed only while the other side has room).
  // Desecration — one per item: allowed if no desecrated mod remains (none, or removed via Omen of Light).
  const desFree = mine.filter((a) => a.tag === 'desecrated').every((a) => remove.some((r) => r.tag === 'desecrated' && r.text === (a.mod ? a.mod.lines.join(' / ') : a.name)));
  // Crafted slot — one per item: free if no crafted mod remains and the essence was not used for magic → rare.
  // How many crafted slots are free after removals (the magic → rare essence also takes a slot).
  const craftedLeft = mine.filter((a) => a.tag === 'crafted' && !remove.some((r) => r.tag === 'crafted' && r.text === (a.mod ? a.mod.lines.join(' / ') : a.name))).length
    + (magic && add.some((c) => c.essence) ? 1 : 0);
  const craftedSlots = Math.max(0, craftedCap - craftedLeft);
  const craftedFree = craftedSlots > 0;
  const filled = { prefix: 0, suffix: 0 };
  for (const a of mine) filled[a.side]++;
  const fixed = { prefix: 0, suffix: 0 }; // fractured — Annulment will not remove them
  for (const a of mine) if (a.tag === 'fractured') fixed[a.side]++;
  // Orb of Augmentation and Regal Orb each add a random mod: it takes a slot (a jewel has only 2 + 2) and is most likely
  // not wanted — counted as junk for the removal step. Augmentation: the free magic side; Regal: the side the plan adds
  // more to (the worst case). An essence adds a wanted mod instead (filled below via essenceMod).
  const randomSides = [];
  if (magicFree.length) randomSides.push(['Orb of Augmentation', magicFree[0]]);
  if (magic && !essenceMod) {
    const more = (s) => add.filter((c) => c.side === s).length;
    randomSides.push(['Regal Orb', more('suffix') > more('prefix') ? 'suffix' : 'prefix']);
  }
  for (const [orb, side] of randomSides) {
    filled[side]++;
    remove.push({ side, text: t('the random modifier from {orb}', { orb }), tag: 'random', level: null });
  }
  // 1. First remove all the junk ("Annul down to the base"), then add. Desecrated — targeted: Annulment + Omen of Light.
  for (const r of remove.filter((x) => x.tag === 'desecrated')) {
    plan.push({ act: 'remove', side: r.side, mod: r.text, currencies: ['Orb of Annulment', 'Omen of Light'], chance: 1, targeted: true });
    filled[r.side]--;
  }
  // The rest — with Annulments (with or without a side omen): the window counts attempts and how many wanted mods get hit.
  // sides: J — junk on the side, K — wanted ones that Annulment can remove (not fractured).
  const junk = remove.filter((x) => x.tag !== 'desecrated');
  if (junk.length) {
    const sides = {};
    for (const side of ['prefix', 'suffix']) {
      const J = junk.filter((x) => x.side === side).length;
      const K = filled[side] - fixed[side] - J;
      // How to restore each wanted mod of the side if Annulment hits it: a crafted one — with its essence / Alloy.
      const keepers = mine.filter((a) => a.side === side && a.tag !== 'fractured' && !junk.some((x) => x.side === side && x.text === (a.mod ? a.mod.lines.join(' / ') : a.name)));
      const restore = keepers.map((a) => {
        if (a.tag !== 'crafted' || !a.mod) {
          // Key (used by ≥ KEY_PCT% or a good tier) — losing it is costly; a minor one — just craft it again.
          const pct = a.mod ? Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0)) : 0;
          return !a.mod || pct >= KEY_PCT || (a.tier && a.tier <= 2) ? null : 'minor';
        }
        const src = craftedSources.find((x) => templates(x.text.replace(/–/g, '-').replace(/ \/ /g, '\n')).some((l) => a.mod.lines.includes(l)));
        return src ? src.name : null;
      });
      // full — no room on the side: Desecrate with this side's Necromancy removes a random mod by itself (verified in game).
      sides[side] = { J, K, restore, omen: `Omen of ${side === 'prefix' ? 'Sinistral' : 'Dextral'} Annulment`, full: filled[side] >= max[side],
        necro: `Omen of ${side === 'prefix' ? 'Sinistral' : 'Dextral'} Necromancy` };
    }
    // Chaos + Omen of Whittling removes the lowest-level mod — if a junk mod is strictly below all other removable ones
    // (desecrated already removed), it goes for sure, but a random mod takes its place.
    // The level is known only for matched mods: if even one is unknown — Whittling is not evaluated.
    const removable = mine.filter((a) => a.tag !== 'fractured' && a.tag !== 'desecrated');
    const known = removable.every((a) => a.mod);
    const levels = removable.map((a) => (a.mod ? a.mod.required_level : 0));
    const low = Math.min(...levels);
    const lowJunk = junk.filter((x) => x.level === low);
    const whittle = known && lowJunk.length === 1 && levels.filter((l) => l === low).length === 1 ? lowJunk[0].text : null;
    // The lowest-level one is a wanted mod: Whittling would remove it (we show why Whittling does not fit here).
    const lowest = mine.filter((a) => a.tag !== 'fractured' && a.tag !== 'desecrated' && a.mod && a.mod.required_level === low);
    const whittleWrong = known && !whittle && lowest.length && !lowJunk.length ? { mod: lowest.map((a) => a.mod.lines.join(' / ')).join(', '), level: low } : null;
    const freeQuality = (junk.find((x) => x.spentQuality) || {}).text || null;
    // Essence of the Abyss + the side's Crystallisation removes a random mod of that side (like Annulment with an omen) and adds
    // Mark of the Abyssal Lord — a desecrated mod, removed by Omen of Light + Annulment (player, 2026-10-19; Ame's videos).
    // Needs a free desecrated slot; the crafted slot is required too (the essence does not apply to an item with a crafted mod — data notes).
    const abyss = desFree && craftedFree && craftedSources.some((x) => x.name === 'Essence of the Abyss');
    plan.push({ act: 'remove', mods: junk.map((x) => x.text), sides, whittle, whittleWrong, freeQuality, abyss,
      currencies: ['Orb of Annulment', 'Omen of Sinistral Annulment', 'Omen of Dextral Annulment', ...(whittle ? ['Chaos Orb', 'Omen of Whittling'] : []),
        ...(abyss ? ['Essence of the Abyss', 'Omen of Sinistral Crystallisation', 'Omen of Dextral Crystallisation', 'Omen of Light'] : [])] });
    for (const x of junk) filled[x.side]--;
  }
  if (essenceMod) filled[essenceMod.side]++; // the essence has already taken a slot on its side
  // Every addition is a one-attempt lottery (odds unknown, a miss stays) and together they fill every free slot on both
  // sides: the final item is random mods from each side's pool either way, so a side omen changes nothing — a roll that
  // lands on the other side is progress there, not a loss. Side omens are dropped (rolls are not halved in the cost).
  const toAdd = add.filter((c) => c !== essenceMod);
  const lotteryFill = toAdd.length > 0 && toAdd.every((c) => c.chanceUnknown && !c.craftedOnly && !c.desecrateOnly)
    && ['prefix', 'suffix'].every((s) => toAdd.filter((c) => c.side === s).length === max[s] - filled[s]);
  // 2. Add the wanted ones: first the side with the most in-demand mod.
  for (const side of ['prefix', 'suffix'].sort((x, y) => top(y) - top(x))) {
    const into = add.filter((c) => c.side === side && c !== essenceMod);
    if (!into.length) continue;
    const S = side === 'prefix' ? 'Sinistral' : 'Dextral';
    // Is there room on the other side: if not, Exalted lands here even without an omen — the side omen is not needed.
    const other = side === 'prefix' ? 'suffix' : 'prefix';
    const otherOpen = max[other] - filled[other] > 0 && !lotteryFill;
    const sideOmen = otherOpen ? `Omen of ${S} Exaltation` : null;
    // Which Exalted to use (regular / Greater / Perfect) and with which omens — the window picks by currency prices.
    // onSide / onItem — how many mods are already there (all wanted: junk removed earlier) — determines how to remove a miss.
    const step = (c, i) => ({ act: 'add', side, mod: c.text, pct: c.pct, worth: c.pct * (keyOf(c.text.split(' / ')) ? KEY_BONUS : 1), onSide: filled[side] - fixed[side] + i, onItem: filled.prefix + filled.suffix - fixed.prefix - fixed.suffix + i,
      annulOmen: `Omen of ${S} Annulment`, exalt: c.exaltAny || c.exalt || { base: { chance: c.chanceUnknown ? null : c.chance || null } }, orMods: c.orMods || null,
      sideOmen, otherOpen, retry: ['Orb of Annulment', `Omen of ${S} Annulment`],
      // Instead of Exalted — Desecrate (bone + side Necromancy omen): pick 1 of 3 on reveal. The window decides which pays off.
      desecrate: desFree && c.desecrate && Object.keys(c.desecrate).length ? c.desecrateAny || c.desecrate : null,
      necro: otherOpen ? `Omen of ${S} Necromancy` : null,
      // Perfect/corrupted essence with this mod: a sacrificial Exalted on the side → the side's Crystallisation + essence.
      crafted: craftedFree && c.crafted && c.crafted.length ? c.crafted : null, craftedOnly: c.craftedOnly || null, desecrateOnly: c.desecrateOnly || null, craftedSlots,
      crystal: `Omen of ${S} Crystallisation`,
      cap: max[side] - fixed[side], // how many mods the essence can remove on the side (excluding fractured)
      // Key mods of this side (used by ≥ KEY_PCT% or tier 1–2): an essence / Alloy with a Crystallisation omen removes
      // a random mod of the side — a miss removes one of them, not the sacrificial one. The window shows this in red.
      atRisk: mine.filter((a) => a.side === side && a.tag !== 'fractured' && a.mod && !remove.some((r) => r.text === a.mod.lines.join(' / '))
        && (Math.max(0, ...a.mod.lines.map((l) => want.get(l) || 0)) >= KEY_PCT || (a.tier && a.tier <= 2))).map((a) => ((a.lines || []).length ? a.lines.join(' / ') : a.mod.lines.join(' / '))),
      blocker: c.blocker || null,
      currencies: [...Object.keys(c.exalt || { base: 1 }).map((k) => EXALT_NAME[k]), ...(sideOmen ? [sideOmen] : []),
        ...(desFree && c.desecrate ? [...new Set(Object.keys(c.desecrate).flatMap((k) => k.split('|'))), `Omen of ${S} Necromancy`, 'Omen of Abyssal Echoes', 'Omen of Light'] : []),
        ...(craftedFree && c.crafted ? [...c.crafted, `Omen of ${S} Crystallisation`, 'Exalted Orb'] : [])] });
    // Two mods on one side — can be done with one Exalted and Omen of Greater Exaltation (if cheaper, the window suggests it).
    // A "crafted slot only" mod — as a separate step (not in a Greater Exaltation pair).
    const solo = into.filter((c) => c.craftedOnly || c.desecrateOnly);
    into.splice(0, into.length, ...into.filter((c) => !c.craftedOnly && !c.desecrateOnly), ...solo);
    const pairable = into.length - solo.length;
    for (let i = 0; i < into.length;) {
      if (i + 1 < pairable) {
        const pair = [step(into[i], i), step(into[i + 1], i + 1)];
        plan.push({ act: 'add2', side, steps: pair, sideOmen, otherOpen, retry: ['Orb of Annulment', `Omen of ${S} Annulment`],
          currencies: [...new Set([...pair[0].currencies, ...pair[1].currencies, 'Omen of Greater Exaltation'])] });
        i += 2;
      } else { plan.push(step(into[i], i)); i += 1; }
    }
    filled[side] += into.length;
  }
  // The last two additions are one prefix and one suffix, and each side has exactly one free slot:
  // Omen of Greater Exaltation places both mods with one Exalted (each on its own side), side omens are not needed.
  const singles = plan.filter((s) => s.act === 'add');
  const last = plan.slice(-2);
  if (last.length === 2 && last.every((s) => s.act === 'add' && !s.craftedOnly && !s.desecrateOnly) && last[0].side !== last[1].side && singles.length >= 2
    && ['prefix', 'suffix'].every((side) => max[side] - filled[side] === 0)) {
    const bare = (s) => ({ ...s, sideOmen: null, otherOpen: false, necro: null });
    plan.splice(-2, 2, { act: 'add2', cross: true, side: null, steps: last.map(bare), sideOmen: null, otherOpen: false, alt: last,
      retry: [...new Set(last.flatMap((s) => s.retry))], currencies: [...new Set([...last.flatMap((s) => s.currencies), 'Omen of Greater Exaltation'])] });
  }
  return { keep, remove, add: add.map(({ side, text, pct, shownPct, pctParts, tier, tiers, range, stats, essence, chance, chanceUnknown, needs, desecrateOnly, craftedOnly }) => ({ side, text, pct, shownPct, pctParts, tier, tiers, range, stats, essence, chance, chanceUnknown, needs, desecrateOnly, craftedOnly })), plan };
}

// Whether a mod (poe.ninja template: "# to Level of all Spell Skills") can roll on this base. null — mod pool not loaded yet.
function rollsOn(baseType, template) {
  const data = craftData.current();
  if (!data) return null;
  const base = data.bases.get(baseType);
  if (!base) return null;
  const want = templates(template)[0];
  return data.pool.some((m) => (m.domain === 'item' || m.domain === 'desecrated') && m.lines.includes(want) && canRoll(m, base.tags || []));
}

// Item levels at which the base unlocks new mod tiers. A white / magic base at ilvl 84 is no better than
// a base at 82 if there are no tiers above 82 — we look for "same by tiers": from the last step up to the next (exclusive).
// null — no data on the base. next — the next step and what unlocks on it (for the hint).
function ilvlBand(baseType, ilvl) {
  const data = craftData.current();
  const base = data && data.bases.get(baseType);
  if (!base || !ilvl) return null;
  const at = new Map(); // level → families that have a tier at it
  for (const m of data.pool) {
    if (m.domain !== 'item' || m.is_essence_only || !canRoll(m, base.tags || [])) continue;
    if (!at.has(m.required_level)) at.set(m.required_level, new Set());
    at.get(m.required_level).add((m.lines || []).join(' / '));
  }
  const steps = [...at.keys()].sort((a, b) => a - b);
  const min = steps.filter((l) => l <= ilvl).pop();
  const next = steps.find((l) => l > ilvl);
  if (min == null) return null;
  return { min, max: next != null ? next - 1 : null, next: next != null ? { level: next, mods: [...at.get(next)] } : null };
}

// Whether a mod can end up on this base at all: roll or be its implicit. For poe.ninja demand lists —
// its "Rare Sceptre" also includes wands (spell levels, Cast Speed), which never appear on a sceptre.
const linesCache = new Map(); // base → all mod lines that can appear on it
craftData.onReset(() => linesCache.clear());
function canAppear(baseType, template) {
  const data = craftData.current();
  if (!data) return null;
  const base = data.bases.get(baseType);
  if (!base) return null;
  if (!linesCache.has(baseType)) {
    const set = new Set(base.implicitLines || []);
    for (const m of data.pool) if ((m.domain === 'item' || m.domain === 'desecrated') && canRoll(m, base.tags || [])) for (const l of m.lines) set.add(l);
    linesCache.set(baseType, set);
  }
  return linesCache.get(baseType).has(templates(template)[0]);
}

// Whether two bases share the same item class (null — unknown).
function sameClass(a, b) {
  const data = craftData.current();
  const x = data && data.bases.get(a);
  const y = data && data.bases.get(b);
  return x && y ? x.item_class === y.item_class : null;
}

module.exports = { advise, load, reset: craftData.reset, rollsOn, ilvlBand, canAppear, sameClass, gambleFor, classWeights };
