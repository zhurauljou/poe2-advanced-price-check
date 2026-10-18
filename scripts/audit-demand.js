// Аудит: для каждого класса — какие базы и моды из poe.ninja «Rare <класс>» не могут быть на вещах этого класса.
const Module = require('module'); const orig = Module._load;
Module._load = function (r, ...a) { if (r === 'electron') return { net: { fetch }, app: { getPath: () => process.env.TEMP } }; return orig.call(this, r, ...a); };
process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs');
const dir = process.env.APPDATA + '/PoE 2 Price Checker/data-cache/';
const cached = async (n) => JSON.parse(fs.readFileSync(dir + n, 'utf8'));
const craft = require('../src/main/craft.js');
const nb = require('../src/main/ninjaBuilds.js');
const fb = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': 'poe2-price-checker' } }); if (!r.ok) throw new Error(r.status); return Buffer.from(await r.arrayBuffer()); };
const CLASSES = ['Body Armours', 'Helmets', 'Gloves', 'Boots', 'Shields', 'Bucklers', 'Foci', 'Quivers', 'Rings', 'Amulets', 'Belts', 'Jewels',
  'Wands', 'Staves', 'Sceptres', 'Quarterstaves', 'Bows', 'Crossbows', 'Spears', 'One Hand Maces', 'Two Hand Maces', 'Talismans', 'Flails', 'Claws', 'Daggers',
  'One Hand Swords', 'Two Hand Swords', 'One Hand Axes', 'Two Hand Axes', 'Charms'];
(async () => {
  await craft.load(cached);
  const out = [];
  for (const cls of CLASSES) {
    let d;
    try { d = await nb.categoryDemand({ itemClass: cls, rarity: 'Rare', limit: 200, minLevel: 90 }, fb); } catch (e) { out.push(`${cls}: ERR ${e.message}`); continue; }
    if (!d.category) { out.push(`${cls}: нет категории на poe.ninja`); continue; }
    // Представитель класса — самая носимая база, у которой класс совпадает с остальными большинством.
    const byClass = new Map();
    const bases = await cached('repoe-base-items.json');
    const clsOf = new Map(Object.values(bases).map((b) => [b.name, b.item_class]));
    for (const b of d.bases) { const c = clsOf.get(b.name); if (c) byClass.set(c, (byClass.get(c) || 0) + b.count); }
    const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
    const want = norm(cls).replace(/ves$/, 'f').replace(/ies$/, 'y').replace(/ci$/, 'cus').replace(/es$/, 'e').replace(/s$/, '');
    const mine = [...byClass.keys()].find((c) => norm(c) === want || norm(c).replace(/s$/, '') === want || want.startsWith(norm(c))) || null;
    const rep = d.bases.find((b) => clsOf.get(b.name) === mine);
    const foreign = d.bases.filter((b) => clsOf.get(b.name) && clsOf.get(b.name) !== mine);
    const foreignShare = foreign.reduce((s, b) => s + b.count, 0) / d.bases.reduce((s, b) => s + b.count, 0);
    // Мод «невозможен на классе» — ни на одной базе этого класса (а не только на представителе: у брони разные теги).
    const classBases = Object.values(bases).filter((b) => b.item_class === mine && b.release_state === 'released' && b.domain !== 'unknown').map((b) => b.name);
    const impossible = d.mods.filter((r) => classBases.every((n) => craft.canAppear(n, r.name) === false));
    out.push(`== ${cls} → ninja «${d.category}» · класс RePoE ${mine} · представитель ${rep && rep.name}`);
    out.push(`   чужих баз: ${foreign.length} (${Math.round(foreignShare * 100)}% надеваний): ${foreign.slice(0, 6).map((b) => `${b.name} [${clsOf.get(b.name)}]`).join(', ')}`);
    out.push(`   невозможных модов: ${impossible.length} из ${d.mods.length}; топ: ${impossible.filter((r) => r.pct >= 5).slice(0, 8).map((r) => `${r.name} ${r.pct}%`).join(' | ')}`);
  }
  fs.writeFileSync(process.argv[2], out.join('\n'));
  console.log(out.join('\n'));
})().catch((e) => console.log(e.stack));
