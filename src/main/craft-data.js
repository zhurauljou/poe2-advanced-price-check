// Game data for crafting advice: RePoE mod pool (which mods and tiers can roll on a base), line templates,
// trade stats for a mod, weight estimates (data/weights.json), corrupted essences and Alloys (data/crafting-currency.json).
const stats = require('./stats');
const fsW = require('fs');
const pathW = require('path');
const { t } = require('../shared/i18n');

// Mod weight estimates (local collection tool — from cheap trade listings, not game data). No file — no odds.
let weightsData;
function weights() {
  if (weightsData === undefined) {
    try { weightsData = JSON.parse(fsW.readFileSync(pathW.join(__dirname, '..', '..', 'data', 'weights.json'), 'utf8')); } catch { weightsData = null; }
  }
  return weightsData;
}

const REPOE = 'https://repoe-fork.github.io/poe2';

let data = null; // { bases: Map name→base, pool: [...] }
let loadedAt = 0;

// The mod pool is loaded once: initData and the first Craft request must not parse RePoE in parallel. The program lives
// in the tray for weeks — reread once a day (the RePoE file itself updates weekly; after a patch — "Refresh game data").
let loading = null;
function load(cached) {
  if (data && Date.now() - loadedAt < 24 * 3600e3) return Promise.resolve(data);
  if (!loading) loading = loadData(cached).then((d) => { reset(); data = d; loadedAt = Date.now(); return d; }).finally(() => { loading = null; });
  return loading;
}
// Forget the loaded pool and everything computed from it (new data after a patch): computed results live in other modules —
// they subscribe via onReset.
const resetHooks = [];
const onReset = (fn) => resetHooks.push(fn);
function reset() {
  data = null;
  for (const fn of resetHooks) fn();
}

async function loadData(cached) {
  const [mods, bases, augments] = await Promise.all([
    cached('repoe-mods.json', `${REPOE}/mods.min.json`, 24),
    cached('repoe-base-items.json', `${REPOE}/base_items.min.json`, 24),
    cached('repoe-augments.json', `${REPOE}/augments.min.json`, 24).catch(() => ({})),
  ]);
  const byName = new Map();
  for (const b of Object.values(bases)) if (b.name && !byName.has(b.name)) byName.set(b.name, b);
  // Tags no_fire/cold/lightning/chaos/physical_spell_mods (on staff and wand bases and in adds_tags of elemental mods) are
  // not applied by the game: trade has an Ashen Staff (fire base) with increased Cold Damage. Strip them, or advice loses mods.
  const NO_SPELL = /^no_\w+_spell_mods$/;
  // The tags themselves stay out of the pool but are remembered as the "base element": its element's mods are likelier (Craft of Exile:
  // 5550 vs 3000) — the program takes weight statistics from bases of the same element (craft.js classWeights).
  for (const b of byName.values()) {
    b.spellAffinity = (b.tags || []).filter((t) => NO_SPELL.test(t)).sort().join(',');
    b.tags = (b.tags || []).filter((t) => !NO_SPELL.test(t));
  }
  for (const m of Object.values(mods)) if (m.adds_tags) m.adds_tags = m.adds_tags.filter((t) => !NO_SPELL.test(t));
  // Base implicit lines (Spirit on a sceptre, etc.) — not in the crafting pool, but they do appear in poe.ninja demand.
  for (const b of byName.values()) b.implicitLines = (b.implicits || []).flatMap((id) => (mods[id] ? templates(radiusText(mods[id])) : []));
  // Jewel mods live in the 'misc' domain — for crafting they are the same "regular" mods as 'item'.
  const pool = Object.entries(mods)
    .filter(([, m]) => (m.domain === 'item' || m.domain === 'misc' || m.domain === 'desecrated')
      && (m.generation_type === 'prefix' || m.generation_type === 'suffix'))
    .map(([id, m]) => { const text = radiusText(m); return { id, ...m, text, domain: m.domain === 'misc' ? 'item' : m.domain, lines: templates(text) }; });
  // Mod lines by family — to know the family's demand (for the "reason to sell" in the odds estimate).
  const typeLines = new Map();
  for (const m of pool) if (!typeLines.has(m.type)) typeLines.set(m.type, m.lines);
  // Augments (runes, Soul Cores, Abyssal Eye, Thesis): name, limit, which stats for which classes (bonded — only with
  // the Shaman passive, ignored).
  const augs = Object.entries(augments || {}).map(([key, a]) => ({
    name: bases[key] && bases[key].name, limit: a.limit || null, level: a.required_level || 0,
    cats: Object.values(a.categories || {}).filter((c) => (c.stat_text || []).length).map((c) => ({ target: c.target, lines: c.stat_text.flatMap((tx) => templates(tx)) })),
  })).filter((a) => a.name && a.cats.length);
  return { bases: byName, pool, typeLines, augs };
}

// Time-Lost jewel mods (radius_jewel) are stored in RePoE without "Small/Notable Passive Skills in Radius also grant" —
// only the effect ("(2-3)% increased [Armour]"), and that text matches a regular global stat. Substitute the
// wording used on trade (exactly one fits each mod).
function radiusText(m) {
  const radius = (m.spawn_weights || []).some((w) => w.weight > 0 && /radius_jewel$/.test(w.tag));
  if (!radius || !m.text || /^Upgrades Radius/.test(m.text)) return m.text;
  const plain = (l) => l.replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1').replace(/\((-?[\d.]+)--?[\d.]+\)/g, '$1');
  for (const kind of ['Notable', 'Small']) {
    const lines = m.text.split('\n').map((l) => `${kind} Passive Skills in Radius also grant ${l}`);
    if (lines.every((l) => stats.statFor(plain(l), 'explicit', 'Jewels'))) return lines.join('\n');
  }
  return m.text;
}

// "(39-42)% increased [EnergyShield|Energy Shield]" → "#% increased energy shield" — like mods on poe.ninja.
function templates(text) {
  return String(text || '').split('\n').map((l) => l
    .replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1')
    .replace(/\(-?[\d.]+--?[\d.]+\)/g, '#')
    .replace(/-?\d+(?:\.\d+)?/g, '#')
    .replace(/\+#/g, '#')
    .trim().toLowerCase()).filter(Boolean);
}

// Trade filters for a mod at the tier's lowest roll: "(39-42)% increased [EnergyShield|Energy Shield]" → 39% … → stat.
// null — if even one line wasn't matched (then the price after crafting isn't computed).
function tradeStats(mod, domain, itemClass) {
  const lines = String(mod.text || '').split('\n').map((l) => l
    .replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1')
    .replace(/\((-?[\d.]+)--?[\d.]+\)/g, '$1').trim()).filter(Boolean);
  const out = lines.map((l) => stats.statFor(l, domain === 'desecrated' ? 'desecrated' : 'explicit', itemClass));
  return out.every(Boolean) ? out.map((s) => ({ statId: s.statId, min: s.value })) : null;
}

// Corrupted essences and Alloy (collected from poe2db, data/crafting-currency.json): what they add on this item class.
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

// Corrupted essences and Alloys (both "remove a random mod and add their own", crafted slot) with mods for the class.
function corruptedFor(itemClass) {
  guaranteedFor(itemClass); // loads the data
  const out = [];
  for (const list of [currencyData && currencyData.corruptedEssences, currencyData && currencyData.alloys]) {
    for (const x of list || []) {
      for (const m of x.mods || []) if (m.classes.includes(itemClass)) out.push({ name: x.name, text: m.text, side: (m.affix || '').toLowerCase() || null });
    }
  }
  return out;
}

// Liquid Emotions (Delirium) on jewels: an emotion removes a random mod and adds its own crafted mod — by base colour
// (data/liquid-emotions.json, poe2db). Regular ones — on Ruby / Sapphire / Emerald / Diamond, Ancient — only on Time-Lost.
// → [{ name, side, text, lines }]; Ferocity / Contempt have two entries (side — by the side of the removed mod).
let emotionData;
function emotionsFor(baseType) {
  if (emotionData === undefined) {
    try { emotionData = JSON.parse(fsW.readFileSync(pathW.join(__dirname, '..', '..', 'data', 'liquid-emotions.json'), 'utf8')); } catch { emotionData = null; }
  }
  if (!emotionData || !baseType) return [];
  const timeLost = /^Time-Lost /.test(baseType);
  const color = baseType.replace(/^Time-Lost /, '');
  const out = [];
  for (const e of (timeLost ? emotionData.timeLost : emotionData.basic) || []) {
    for (const m of (e.mods && e.mods[color]) || []) out.push({ name: e.name, side: m.side, text: m.text, lines: templates(m.text) });
  }
  return out;
}

// Mod weight on a base: the first tag from spawn_weights that the base has (in PoE 2 — only 0 or 1).
function canRoll(mod, tags) {
  for (const sw of mod.spawn_weights || []) if (tags.includes(sw.tag)) return sw.weight > 0;
  return false;
}

// Loaded pool (or null until loaded) — for quick checks without await.
const current = () => data;

module.exports = { load, reset, onReset, current, templates, tradeStats, weights, guaranteedFor, corruptedFor, emotionsFor, canRoll };
