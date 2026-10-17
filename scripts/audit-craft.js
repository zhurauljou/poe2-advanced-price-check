// Аудит советов по крафту на случайных вещах всех классов: генерирует редкие вещи из настоящего пула модов игры
// (RePoE), прогоняет через craft.advise + план со спросом poe.ninja и проверяет правила, нарушение которых — ошибка
// советника (не тот мод, снятие нужного, слот без метода, бессмысленная цена…).
//   node scripts/audit-craft.js [вещей на класс=30] [seed=1]
// Нужен кэш программы (%APPDATA%/PoE 2 Price Checker/Cache) и интернет для спроса poe.ninja (по запросу на класс).
const fs = require('fs');
const path = require('path');
const Module = require('module');
const orig = Module._load;
Module._load = function (r, ...a) { if (r === 'electron') return { net: { fetch }, app: { getPath: () => require('os').tmpdir() } }; return orig.call(this, r, ...a); };

const CACHE = path.join(process.env.APPDATA || '', 'PoE 2 Price Checker', 'Cache');
const cached = async (n, url) => {
  const p = path.join(CACHE, n);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  const d = await (await fetch(url)).json(); fs.writeFileSync(p, JSON.stringify(d)); return d;
};
const stats = require('../src/main/stats');
stats.build(JSON.parse(fs.readFileSync(path.join(CACHE, 'stats.json'), 'utf8')));
const craft = require('../src/main/craft');
const { parseItem } = require('../src/main/parser');
const nb = require('../src/main/ninjaBuilds');
const PlanCost = require('../src/shared/plancost');
const fb = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': 'poe2-price-checker' } }); if (!r.ok) throw new Error(`${u} ${r.status}`); return Buffer.from(await r.arrayBuffer()); };

const N = Number(process.argv[2] || 30);
let seed = Number(process.argv[3] || 1);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const CLASSES = ['Body Armours', 'Helmets', 'Gloves', 'Boots', 'Shields', 'Bucklers', 'Foci', 'Quivers', 'Rings', 'Amulets', 'Belts',
  'Wands', 'Staves', 'Sceptres', 'Quarterstaves', 'Bows', 'Crossbows', 'Spears', 'One Hand Maces', 'Two Hand Maces', 'Talismans'];
// item_class в RePoE — единственное число и свои названия
const CLASS_OF = { 'Body Armours': 'Body Armour', Helmets: 'Helmet', Gloves: 'Gloves', Boots: 'Boots', Shields: 'Shield', Bucklers: 'Buckler', Foci: 'Focus',
  Quivers: 'Quiver', Rings: 'Ring', Amulets: 'Amulet', Belts: 'Belt', Wands: 'Wand', Staves: 'Staff', Sceptres: 'Sceptre', Quarterstaves: 'Warstaff',
  Bows: 'Bow', Crossbows: 'Crossbow', Spears: 'Spear', 'One Hand Maces': 'One Hand Mace', 'Two Hand Maces': 'Two Hand Mace', Talismans: 'Talisman' };
const tpl = (t) => clean(t).replace(/\((-?[\d.]+)-(-?[\d.]+)\)/g, '#').replace(/-?\d+(?:\.\d+)?/g, '#').replace(/\+#/g, '#').toLowerCase().split('\n').join(' / ');
const canRoll = (m, tags) => { for (const sw of m.spawn_weights || []) if (tags.includes(sw.tag)) return sw.weight > 0; return false; };
const clean = (t) => String(t).replace(/\[(?:[^|\]]*\|)?([^\]]*)\]/g, '$1');
// текст мода как в игре (расширенный формат): «+48(47-50) to Spirit»
const rollText = (t) => clean(t).replace(/\((-?[\d.]+)-(-?[\d.]+)\)/g, (s, a, b) => {
  const lo = Number(a), hi = Number(b); const v = Number.isInteger(lo) && Number.isInteger(hi) ? Math.round(lo + rnd() * (hi - lo)) : Math.round((lo + rnd() * (hi - lo)) * 100) / 100;
  return `${v}(${a}-${b})`;
});

(async () => {
  const mods = await cached('repoe-mods.json');
  const basesRaw = await cached('repoe-base-items.json');
  await craft.load(cached);
  const prices = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test', 'fixtures', 'craft', 'prices.json'), 'utf8')).prices;
  const all = Object.values(mods).filter((m) => (m.domain === 'item' || m.domain === 'desecrated') && ['prefix', 'suffix'].includes(m.generation_type) && !m.is_essence_only);
  const issues = new Map(); // правило → [примеры]
  const flag = (rule, ex) => { if (!issues.has(rule)) issues.set(rule, []); issues.get(rule).push(ex); };
  let items = 0, plans = 0;

  for (const cls of CLASSES) {
    const bases = Object.values(basesRaw).filter((b) => b.release_state === 'released' && b.domain === 'item' && b.name && (CLASS_OF[cls] || cls.replace(/s$/, '')) === b.item_class);
    if (!bases.length) { flag('нет баз класса', cls); continue; }
    let demand;
    try { demand = await nb.categoryDemand({ itemClass: cls, rarity: 'Rare', limit: 80, minLevel: 90 }, fb); } catch (e) { flag('спрос не загружен', `${cls}: ${e.message}`); continue; }
    const want = new Map(demand.mods.map((m) => [m.name.toLowerCase().replace(/\+#/g, '#'), m.pct]));
    for (let k = 0; k < N; k++) {
      const base = pick(bases);
      const tags = base.tags || [];
      const ilvl = 75 + Math.floor(rnd() * 8);
      const live = [...tags]; // + adds_tags выбранных модов (запреты других стихий и т.п.)
      const pool0 = all.filter((m) => m.required_level <= ilvl);
      const used = new Set();
      const chosen = [];
      let des = 0;
      for (const side of ['prefix', 'suffix']) {
        const n = 1 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++) {
          const cand = pool0.filter((m) => canRoll(m, live)).filter((m) => m.generation_type === side && !(m.groups || []).some((g) => used.has(g)) && (m.domain !== 'desecrated' || !des));
          if (!cand.length) break;
          const m = pick(cand);
          (m.groups || []).forEach((g) => used.add(g));
          live.push(...(m.adds_tags || []));
          if (m.domain === 'desecrated') des++;
          const fam = pool0.filter((x) => canRoll(x, tags)).filter((x) => x.type === m.type && x.domain === m.domain).sort((a, b) => b.required_level - a.required_level);
          chosen.push({ m, tier: fam.indexOf(m) + 1 });
        }
      }
      const text = [`Item Class: ${cls}`, 'Rarity: Rare', 'Audit Item', base.name, '--------', `Item Level: ${ilvl}`, '--------',
        ...chosen.flatMap(({ m, tier }) => [`{ ${m.domain === 'desecrated' ? 'Desecrated ' : ''}${m.generation_type === 'prefix' ? 'Prefix' : 'Suffix'} Modifier "${m.name}" (Tier: ${tier}) — }`,
          ...rollText(m.text || '').split('\n')])].join('\n');
      items++;
      const item = parseItem(text);
      let r;
      try { r = await craft.advise(item, demand.mods, cached); } catch (e) { flag('исключение в craft.advise', `${cls} ${base.name}: ${e.message}`); continue; }
      if (r.note) continue;
      // 1. каждый мод вещи узнан и узнан ВЕРНО (одинаковые названия аффиксов)
      for (const [i, a] of (item.affixes || []).entries()) {
        const want0 = chosen[i] && chosen[i].m;
        const mine = r.goal ? [...r.goal.keep, ...r.goal.remove] : [];
        const got = mine.find((x) => x.text && want0 && want0.text && x.text === clean(want0.text).replace(/\((-?[\d.]+)-(-?[\d.]+)\)/g, '#').replace(/-?\d+(?:\.\d+)?/g, '#').replace(/\+#/g, '#').toLowerCase().split('\n').join(' / '));
        if (r.goal && want0 && !got) flag('мод вещи не узнан или узнан неверно', `${cls} ${base.name}: «${a.name}» ${clean(want0.text).split('\n')[0]}`);
      }
      if (!r.goal) continue;
      plans++;
      const pctOf = (t) => Math.max(0, ...t.split(' / ').map((l) => want.get(l) || 0));
      // 2. снимается востребованный мод хорошего тира
      for (const x of r.goal.remove) if (pctOf(x.text) >= 30 && x.tier && x.tier <= 2) flag('снимается ключевой мод T1–T2', `${cls}: ${x.text} T${x.tier} ${pctOf(x.text)}%`);
      // 3. остаётся ненужный мод, а на его сторону добавляется более нужный из того же плана — норм; проверим: держим 0%-мод при свободных кандидатах ≥ 30%
      for (const x of r.goal.keep) if (pctOf(x.text) === 0 && x.tag !== 'fractured' && x.tag !== 'crafted' && x.tier > 2 && r.goal.add.some((a) => a.side === x.side && a.pct >= 30)) flag('держится ненужный мод (0%), хотя нужный ставится на ту же сторону', `${cls}: ${x.text} T${x.tier}`);
      // 4. шаги плана: у каждого есть способ и разумная цена
      const pl = PlanCost.create(() => ({ prices, goalValue: 50, est: 10 }));
      let steps;
      try { steps = pl.expandPlan(r.goal.plan); } catch (e) { flag('исключение в плане', `${cls}: ${e.message}`); continue; }
      for (const s of steps) {
        let c;
        try { c = pl.stepCost(s); } catch (e) { flag('исключение в цене шага', `${cls} ${s.act}: ${e.message}`); continue; }
        if (!c.currencies || !c.currencies.length) flag('шаг без валюты', `${cls} ${s.act} ${s.mod || ''}`);
        if (c.cost != null && !(Number.isFinite(c.cost) && c.cost >= 0)) flag('цена шага не число', `${cls} ${s.act}: ${c.cost}`);
        if (c.cost != null && c.cost > 500) flag('цена шага > 500 div при цели 50 div', `${cls} ${s.act} ${s.mod || (s.mods || []).join(',')}: ${Math.round(c.cost)} div (${c.currencies.join('+')})`);
        if (s.act === 'add' && s.desecrateOnly && c.k !== 'desecrate' && !c.lottery) flag('мод «только Desecrate» добавляется не Desecrate', `${cls}: ${s.mod} → ${c.currencies.join('+')}`);
        if (s.act === 'add' && s.craftedOnly && c.k !== 'essence') flag('мод «только эссенция/Alloy» добавляется не ими', `${cls}: ${s.mod} → ${c.currencies.join('+')}`);
        if (s.act === 'add2' && s.steps.some((x) => x.desecrateOnly || x.craftedOnly)) flag('мод одного слота в паре Greater Exaltation', `${cls}: ${s.steps.map((x) => x.mod).join(' + ')}`);
        if (c.k === 'desecrate' && (item.affixes || []).some((a) => a.tag === 'desecrated') && !r.goal.remove.some((x) => x.tag === 'desecrated')) flag('Desecrate при занятом desecrated-слоте', `${cls}: ${s.mod}`);
      }
      // 5. одна desecration и один crafted-слот на план
      const des2 = steps.filter((s) => s.act === 'add' && s.useDes).length;
      if (des2 > 1) flag('две desecration в плане', cls);
      // 7. предлагается мод, который на этой вещи не может выпасть (adds_tags модов вещи его запрещают)
      const keptTags = [...tags, ...chosen.filter(({ m }) => !r.goal.remove.some((x) => x.text === tpl(m.text))).flatMap(({ m }) => m.adds_tags || [])];
      for (const a of r.goal.add) {
        if (a.craftedOnly || a.needs || a.desecrateOnly) continue;
        const fams = all.filter((m) => tpl(m.text) === a.text);
        if (fams.length && !fams.some((m) => canRoll(m, keptTags) || canRoll(m, [...keptTags, 'breach_desecration']))) flag('предлагается запрещённый на вещи мод', `${cls}: ${a.text}`);
      }
      // 6. добавляется то, что уже есть на вещи
      for (const a of r.goal.add) if (r.goal.keep.some((x) => x.text === a.text)) { flag('добавляется мод, который уже есть', `${cls}: ${a.text}`); if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, text); }
    }
    process.stdout.write(`${cls}: ok\n`);
  }
  console.log(`\nВещей: ${items}, с планом: ${plans}. Нарушений правил: ${[...issues.values()].reduce((a, l) => a + l.length, 0)}`);
  for (const [rule, ex] of issues) {
    console.log(`\n== ${rule}: ${ex.length}`);
    for (const e of [...new Set(ex)].slice(0, 8)) console.log('   ' + e);
  }
})().catch((e) => { console.error(e); process.exit(1); });
