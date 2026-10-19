// Matching mod lines to trade filters (api/trade2/data/stats).
// Stats with a variant choice (Legacy of Quicksilver on Mageblood) come as "explicit.stat_264262054|8" —
// the stat id and the variant number; trade searches them by this whole id: { id: 'explicit.stat_264262054|8' }.

const LOCAL_CLASSES = new Set(require('../shared/item-classes').LOCAL_CLASSES);

const NUM = /[+-]?\d+(?:\.\d+)?/g;

function norm(s) {
  return s.replace(NUM, '#').replace(/\+#/g, '#').trim();
}

let index = null; // norm(text) -> [{ id, group, text, local }]
let localIndex = null; // same, by non-English client texts; text — English (by id), for templates and demand
let enById = new Map();

// Stat variant: "(Local)" — on armour/weapons, on the item itself; "(Jewel)" — jewels have their own stat (mana on kill, etc.).
const VARIANT = / \((Local|Jewel)\)$/;
const variantOf = (itemClass) => (itemClass === 'Jewels' ? 'Jewel' : LOCAL_CLASSES.has(itemClass) ? 'Local' : null);

function build(statsJson) {
  index = new Map();
  for (const g of statsJson.result) {
    for (const e of g.entries) {
      const v = e.text.match(VARIANT);
      const key = norm(e.text.replace(VARIANT, ''));
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({ id: e.id, group: g.id, text: e.text, variant: v ? v[1] : null });
      enById.set(e.id, e.text);
    }
  }
  // A trade-only note in parentheses that the game lacks: "#% increased Gold found in Map (Gold Piles)" on a tablet —
  // in game "25% increased Gold found in Map". Also search without it if there's no such line without the parentheses.
  const extra = new Map();
  for (const list of index.values()) {
    for (const s of list) {
      const m = s.text.match(/^(.*\S) \(([^()]+)\)$/);
      // "Map contains an additional Rare Chest" on trade — in game "Map contains 2 additional Rare Chests" (the ending
      // "s" lookup drops by itself).
      const keys = [m && !VARIANT.test(s.text) ? m[1] : null, / an additional /.test(s.text) ? s.text.replace(/ an additional /, ' # additional ') : null];
      for (const k of keys.filter(Boolean).map(norm)) {
        if (index.has(k)) continue;
        if (!extra.has(k)) extra.set(k, []);
        extra.get(k).push(s);
      }
    }
  }
  for (const [k, v] of extra) index.set(k, v);
}

// Trade reference data in the client language (ru.pathofexile.com/api/trade2/data/stats): clipboard mod lines are in it.
// null — English client.
const LOCAL_TAG = / \((Local|На предмете)\)$/;
function buildLocal(statsJson) {
  if (!statsJson) { localIndex = null; return; }
  localIndex = new Map();
  for (const g of statsJson.result) {
    for (const e of g.entries) {
      const key = norm(e.text.replace(LOCAL_TAG, ''));
      if (!localIndex.has(key)) localIndex.set(key, []);
      localIndex.get(key).push({ id: e.id, group: g.id, text: enById.get(e.id) || e.text, local: e.text, variant: LOCAL_TAG.test(e.text) ? 'Local' : null });
    }
  }
}

// idx — which reference to use: clipboard lines — in the client language, RePoE texts (craft) — always English.
function lookup(text, idx = localIndex || index) {
  const values = (text.match(NUM) || []).map(Number);
  // "Has 2 Charm Slots" in game vs "Has # Charm Slot" on trade.
  let cands = idx.get(norm(text)) || idx.get(norm(text).replace(/s$/, ''));
  let sign = 1;
  if (!cands) {
    // "10% reduced X" is searched on trade as "#% increased X" with a negative value.
    for (const [a, b] of [[' reduced ', ' increased '], [' less ', ' more '], [' уменьшение ', ' увеличение '], [' снижение ', ' повышение '], [' меньше', ' больше']]) {
      if (text.includes(a)) {
        cands = idx.get(norm(text.replace(a, b)));
        if (cands) { sign = -1; break; }
      }
    }
  }
  if (!cands) return null;
  // "Adds 3 to 5 X" is filtered on trade by the average.
  const value = values.length ? (sign * values.reduce((s, v) => s + v, 0)) / values.length : null;
  return { cands, value, flipped: sign < 0 };
}

// Clipboard line: the client-language reference, if not found — English (lines clientLang has already translated).
const lookupAny = (text) => (localIndex && lookup(text, localIndex)) || lookup(text, index);

// A non-English client mod line → as an English client would write it: the text is the English text of the same trade
// stat (ids are shared across languages), numbers and tier ranges — from the original line. Then craft, poe.ninja demand and text
// rules ("+1 Prefix Modifier allowed", "Can roll Destruction modifiers") work as with the English client.
// text — one line or two separated by a newline (a two-line mod). Not found in the reference — null.
const RANGE = /([^\s(])\([^()\s]+-[^()\s]+\)/g;
const NUM_WITH_RANGE = /[+-]?\d+(?:\.\d+)?(?:\([^()\s]+-[^()\s]+\))?/g;
function localToEnglish(text) {
  if (!localIndex || !index) return null;
  const m = lookup(text.replace(RANGE, '$1'), localIndex);
  if (!m) return null;
  const c = m.cands.find((x) => x.group === 'explicit' && enById.has(x.id)) || m.cands.find((x) => enById.has(x.id));
  if (!c) return null;
  let en = enById.get(c.id).replace(VARIANT, '');
  // "35% уменьшение требований" matched as "увеличение" (increased) with a minus — in English it's "reduced".
  if (m.flipped) en = en.replace(/\bincreased\b/, 'reduced').replace(/\bmore\b/, 'less');
  // The line's numbers that are "#" in the template (numbers of the text itself, "per 50 …", are skipped), in order.
  const tpl = (c.local.replace(LOCAL_TAG, '').match(/#|[+-]?\d+(?:\.\d+)?/g) || []);
  const nums = text.match(NUM_WITH_RANGE) || [];
  const vals = nums.filter((_, i) => tpl[i] == null || tpl[i] === '#');
  let i = 0;
  return en.replace(/(\+?)#/g, (all, plus) => {
    const v = vals[i++];
    if (v == null) return all;
    return plus && !/^[+-]/.test(v) ? `+${v}` : v;
  });
}

const TAG_GROUP = { explicit: 'explicit', implicit: 'implicit', enchant: 'enchant', rune: 'rune',
  crafted: 'crafted', fractured: 'fractured', desecrated: 'desecrated', corrupted: 'implicit' };

function pick(cands, tag, variant) {
  const group = TAG_GROUP[tag] || 'explicit';
  let pool = cands.filter((c) => c.group === group);
  // Mods from Vaal Orb ("enchantments") are kept by trade in the enchant group; if not there — as an implicit.
  if (tag === 'corrupted') {
    const ench = cands.filter((c) => c.group === 'enchant');
    if (ench.length) pool = ench;
  }
  if (!pool.length) pool = cands.filter((c) => c.group === 'explicit');
  if (!pool.length) return null;
  const pref = pool.filter((c) => c.variant === variant);
  return (pref.length ? pref : pool)[0];
}

// Turns item.modLines into item.mods: [{ text, tag, statId, value }]. Unmatched lines have statId = null;
// multi-line mods are joined.
function matchMods(item) {
  if (!index) return [];
  const localItem = variantOf(item.itemClass);
  const out = [];
  const ls = item.modLines;
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    // Three-line mods (Undying Hate: "Glorifying … / Passives in radius are Conquered … / Desecration makes …").
    if (i + 2 < ls.length && ls[i + 1].tag === l.tag && ls[i + 2].tag === l.tag) {
      const text3 = [l.text, ls[i + 1].text, ls[i + 2].text].join('\n');
      const joined3 = lookupAny(text3);
      const c3 = joined3 && pick(joined3.cands, l.tag, localItem);
      if (c3) {
        out.push({ text: text3, tag: l.tag, tier: l.tier, statId: c3.id, template: c3.text, value: joined3.value, range: l.range });
        i += 2;
        continue;
      }
    }
    if (i + 1 < ls.length && ls[i + 1].tag === l.tag) {
      const joined = lookupAny(l.text + '\n' + ls[i + 1].text);
      if (joined) {
        const c = pick(joined.cands, l.tag, localItem);
        if (c) {
          out.push({ text: l.text + '\n' + ls[i + 1].text, tag: l.tag, tier: l.tier, statId: c.id, template: c.text,
            value: joined.value, range: l.range });
          i++;
          continue;
        }
      }
    }
    const rune = forged(l.text);
    if (rune) {
      out.push({ text: l.text, tag: 'rune', statId: rune.id, template: rune.text, value: null, forged: true });
      continue;
    }
    const m = lookupAny(l.text);
    const c = m && pick(m.cands, l.tag, localItem);
    // Unmatched ones are shown grey, without a checkbox: the mod is visible, but you can't search by it.
    out.push(c ? { text: l.text, tag: l.tag, tier: l.tier, statId: c.id, template: c.text, value: m.value, range: l.range, textRange: l.textRange }
      : { text: l.text, tag: l.tag, tier: l.tier, statId: null });
  }
  return mergeSame(out);
}

// "Forged by the Breath of Aldur" — an Aldur rune is in the socket: it can't be removed, and Fire/Lightning mods became Cold for good.
// Trade finds such an item by the rune's stat: "…transforms all Fire and Lightning modifiers to equivalent Cold modifiers" (Breath),
// «…into equivalent Fire / Lightning / Chaos modifiers» (Passion / Ire / Betrayal).
const ALDUR = { Breath: 'Cold', Passion: 'Fire', Ire: 'Lightning', Betrayal: 'Chaos' };
function forged(text) {
  const m = String(text).match(/^Forged by the (\w+) of Aldur$/);
  const el = m && ALDUR[m[1]];
  if (!el || !index) return null;
  for (const list of index.values()) {
    for (const c of list) if (c.group === 'rune' && c.text.includes(`equivalent ${el} modifiers`)) return c;
  }
  return null;
}

// Trade stores identical stats as one sum: "+30 to maximum ES" and "+77 to maximum ES" from different
// mods are searched as 107. We merge them into one filter.
function mergeSame(mods) {
  const out = [];
  const byId = new Map();
  for (const m of mods) {
    const prev = m.statId && byId.get(m.statId);
    if (!prev) {
      out.push(m);
      if (m.statId) byId.set(m.statId, m);
      continue;
    }
    if (!prev.parts) {
      prev.parts = [prev.text];
      prev.tiers = [prev.tier];
    }
    prev.parts.push(m.text);
    prev.tiers.push(m.tier);
    if (m.value != null) prev.value = (prev.value || 0) + m.value;
    // Sum range — the sum of the ranges (if known for all parts).
    prev.range = prev.range && m.range ? { lo: prev.range.lo + m.range.lo, hi: prev.range.hi + m.range.hi } : null;
    if (m.tier != null && (prev.tier == null || m.tier < prev.tier)) prev.tier = m.tier;
    // Each mod is shown on its own line; the filter is shared — trade searches by the sum.
    prev.text = prev.parts.join('\n');
  }
  return out;
}

// One stat of a specific group by text — for properties like "Grants Skill: Level 16 Wolf Pack".
function find(text, group) {
  if (!index) return null;
  const m = lookup(text) || (localIndex ? lookup(text, index) : null);
  const c = m && m.cands.find((x) => x.group === group);
  return c ? { statId: c.id, value: m.value } : null;
}

// Trade stat for a mod line the item doesn't have yet (a craft candidate): accounting for the item class's locality.
function statFor(text, tag, itemClass) {
  if (!index) return null;
  const m = lookup(text, index);
  const c = m && pick(m.cands, tag, variantOf(itemClass));
  return c ? { statId: c.id, value: m.value } : null;
}

// Ordinal position of a variant by text range: "Massive Ring" from "Very Small-Massive Ring" among the stat's
// variants (|1 Very Small … |8 Massive — numbered by size). → { idx, lo, hi, loText, hiText } or null.
function ordinal(statId, text, textRange) {
  if (!index || !statId || !statId.includes('|') || !textRange) return null;
  const base = statId.split('|')[0];
  const opts = [];
  for (const list of index.values()) for (const c of list) if (c.id.startsWith(base + '|')) opts.push({ n: Number(c.id.split('|')[1]), text: c.text });
  if (opts.length < 3) return null;
  // Common start and end of the variant texts — the changing part remains ("Very Small", "Medium-Small", "Massive").
  const texts = opts.map((o) => o.text);
  let pre = texts[0], suf = texts[0];
  for (const x of texts) {
    while (!x.startsWith(pre)) pre = pre.slice(0, -1);
    while (!x.endsWith(suf)) suf = suf.slice(1);
  }
  const part = (x) => x.slice(pre.length, x.length - suf.length);
  // Scale — sizes only (Very Small … Massive). "Amethyst-Topaz" on Legacy Mageblood is an alphabetical list, not an order.
  const SIZE = /^(Very Small|Small|Medium-Small|Medium|Medium-Large|Large|Very Large|Massive)$/;
  if (!opts.every((o) => SIZE.test(part(o.text)))) return null;
  const byPart = new Map(opts.map((o) => [part(o.text), o.n]));
  const cur = opts.find((o) => o.text === text);
  // "Very Small-Massive Ring": hyphens occur inside variants too (Medium-Small) — try each place to cut.
  const tr = textRange.endsWith(suf) ? textRange.slice(0, textRange.length - suf.length) : textRange;
  for (let i = tr.indexOf('-'); i > 0; i = tr.indexOf('-', i + 1)) {
    const lo = byPart.get(tr.slice(0, i)), hi = byPart.get(tr.slice(i + 1));
    if (lo != null && hi != null && cur && hi > lo) return { idx: cur.n, lo, hi, loText: tr.slice(0, i), hiText: tr.slice(i + 1) };
  }
  return null;
}

function optionCount(statId) {
  if (!index || !statId || !statId.includes('|')) return 0;
  const base = statId.split('|')[0] + '|';
  const ids = new Set();
  for (const list of index.values()) for (const c of list) if (c.id.startsWith(base)) ids.add(c.id);
  return ids.size;
}

// Mod template as a comparison key (item mods, poe.ninja demand): without "(Local)" / "(Jewel)", "+#" → "#", lowercase.
// The same stat in every mod kind the trade reference has (regular, crafted, fractured, desecrated): "items without
// this mod" — in no form. Trade rejects an unknown id with the whole request, so — only existing ones.
function variantsOf(statId) {
  const m = String(statId).match(/^(explicit|crafted|fractured|desecrated)\.(.+)$/);
  if (!m) return [statId];
  return ['explicit', 'crafted', 'fractured', 'desecrated'].map((g) => `${g}.${m[2]}`).filter((id) => enById.has(id));
}

const templateKey = (s) => String(s || '').replace(VARIANT, '').replace(/\+#/g, '#').toLowerCase();

module.exports = { build, buildLocal, matchMods, find, statFor, ordinal, optionCount, localToEnglish, templateKey, variantsOf };
