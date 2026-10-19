// Audit of "hidden" variables in unique mods: the value changes (Divine rerolls it), but in the text it isn't
// a numeric range "(a-b)" — ring radius, random Keystone, Legacy on Mageblood etc. The window must handle such mods
// specially (stats.ordinal — a size scale, categorical — a random variant), otherwise Divine advice is wrong.
// Run after a patch: node scripts/audit-variable-mods.js  (needs the app cache: repoe-mods.json, stats.json)
const fs = require('fs');
const path = require('path');

const dir = path.join(process.env.APPDATA || '', 'PoE 2 Price Checker', 'data-cache');
const mods = JSON.parse(fs.readFileSync(path.join(dir, 'repoe-mods.json'), 'utf8'));
const stats = JSON.parse(fs.readFileSync(path.join(dir, 'stats.json'), 'utf8'));

const NUMERIC = /\(-?[\d.]+-+-?[\d.]+\)/;
const IGNORE = /^dummy_stat_display_nothing$|^map_/; // service stats with no display, and map mods
const unique = Object.entries(mods).filter(([, m]) => m.generation_type === 'unique' && ['item', 'misc', 'flask'].includes(m.domain));
const varying = unique.filter(([, m]) => (m.stats || []).some((s) => s.min !== s.max));
const hidden = varying.filter(([, m]) => !NUMERIC.test(m.text || ''))
  .map(([id, m]) => ({ id, text: (m.text || '').replace(/\n/g, ' / '), vars: m.stats.filter((s) => s.min !== s.max && !IGNORE.test(s.id)) }))
  .filter((x) => x.vars.length);

// Trade variants ("explicit.stat_X|1…|N"): which families are a size scale (like Controlled Metamorphosis).
const SIZE = /^(Very Small|Small|Medium-Small|Medium|Medium-Large|Large|Very Large|Massive)$/;
const families = new Map();
for (const g of stats.result) for (const e of g.entries) {
  if (!e.id.includes('|')) continue;
  const base = e.id.split('|')[0];
  if (!families.has(base)) families.set(base, []);
  families.get(base).push(e.text);
}
const scales = [...families].filter(([, texts]) => {
  if (texts.length < 3) return false;
  let pre = texts[0], suf = texts[0];
  for (const x of texts) { while (!x.startsWith(pre)) pre = pre.slice(0, -1); while (!x.endsWith(suf)) suf = suf.slice(1); }
  return texts.every((x) => SIZE.test(x.slice(pre.length, x.length - suf.length)));
});

console.log(`Уникальных модов у предметов: ${unique.length}; с изменяемыми значениями: ${varying.length}; ` +
  `из них без числового диапазона в тексте (кроме служебных): ${hidden.length}`);
for (const x of hidden) {
  const kind = x.vars.some((s) => /radius/.test(s.id)) ? 'шкала' : x.vars.some((s) => /index|legacy/.test(s.id)) ? 'случайный вариант' : 'скрытое значение';
  console.log(`  [${kind}] ${x.id}: ${x.text.slice(0, 80)} — ${x.vars.map((s) => `${s.id} ${s.min}..${s.max}`).join(', ')}`);
}
console.log(`\nСемейства вариантов трейда со шкалой размеров (обрабатываются как порядок): ${scales.length}`);
for (const [base, texts] of scales) console.log(`  ${base}: ${texts.length} вариантов, например «${texts[0]}»`);
console.log('\nНовые «шкала» / «случайный вариант» выше — проверить, что окно их понимает (stats.ordinal, categorical в pricing.js).');
