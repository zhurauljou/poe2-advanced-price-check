// Проверка после патча / новой лиги: что изменилось в данных игры относительно снимка, на котором проверена программа
// (test/fixtures/data — тот же снимок, что у тестов), и не устарели ли собранные вручную data/*.json.
//   node scripts/check-patch.js [--md report.md]
// Код выхода: 0 — существенных изменений нет, 1 — есть (отчёт — что посмотреть), 2 — не удалось проверить.
// Запускается и в GitHub Actions по расписанию (.github/workflows/patch-check.yml): при изменениях открывает issue.
// Что делать после отчёта — docs/README.md, «Новый патч — чек-лист».
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const REPOE = 'https://repoe-fork.github.io/poe2';
const TRADE = 'https://www.pathofexile.com/api/trade2/data';
const UA = 'poe2-price-checker patch check (github.com/zhurauljou/poe2-advanced-price-check)';
const BASELINE = path.join(ROOT, 'data', 'patch-baseline.json'); // лиги на момент снимка

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const snap = (n) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'data', `${n}.gz`))));
async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(60e3) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}
// Трейд не ответил (лимит — например, идёт сборщик весов) — справочник из кэша программы, если он есть (локальный запуск).
const CACHE = path.join(process.env.APPDATA || '', 'PoE 2 Price Checker', 'data-cache');
const fromCache = [];
async function trade(name) {
  try { return await get(`${TRADE}/${name}`); } catch (e) {
    const f = path.join(CACHE, `${name}.json`);
    if (!fs.existsSync(f)) throw e;
    fromCache.push(`${name} (${new Date(fs.statSync(f).mtimeMs).toISOString().slice(0, 16).replace('T', ' ')})`);
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  }
}

const out = []; // строки отчёта
let significant = false;
const list = (xs, n = 25) => xs.slice(0, n).map((x) => `  - ${x}`).join('\n') + (xs.length > n ? `\n  - … и ещё ${xs.length - n}` : '');
const section = (title, lines, important = true) => {
  if (!lines.length) return;
  if (important) significant = true;
  out.push(`### ${title}`, ...lines, '');
};

// Моды пула крафта: новые / пропавшие семейства и тиры, изменённые веса и уровни.
function compareMods(live, old) {
  const pool = (m) => ['item', 'misc', 'desecrated'].includes(m.domain) && ['prefix', 'suffix'].includes(m.generation_type);
  const ids = (o) => new Set(Object.entries(o).filter(([, m]) => pool(m)).map(([id]) => id));
  const a = ids(old), b = ids(live);
  const added = [...b].filter((id) => !a.has(id));
  const removed = [...a].filter((id) => !b.has(id));
  const fam = (o, xs) => [...new Set(xs.map((id) => `${o[id].type} (${o[id].domain} ${o[id].generation_type})`))];
  const changed = [];
  for (const id of b) {
    if (!a.has(id)) continue;
    const x = old[id], y = live[id];
    const w = (m) => JSON.stringify((m.spawn_weights || []).filter((s) => s.weight > 0).map((s) => s.tag).sort());
    if (x.required_level !== y.required_level) changed.push(`${id}: уровень ${x.required_level} → ${y.required_level}`);
    else if (w(x) !== w(y)) changed.push(`${id}: где может выпасть — ${w(x)} → ${w(y)}`);
    else if (x.text !== y.text) changed.push(`${id}: текст изменился`);
  }
  section('Моды (RePoE): новые', added.length ? [`${added.length} модов, семейства:`, list(fam(live, added))] : []);
  section('Моды (RePoE): пропали', removed.length ? [`${removed.length} модов, семейства:`, list(fam(old, removed))] : []);
  section('Моды (RePoE): изменились', changed.length ? [list(changed)] : []);
}

function compareBases(live, old) {
  const names = (o) => new Set(Object.values(o).filter((b) => (b.domain === 'item' || b.domain === 'misc') && b.name && b.release_state !== 'unreleased').map((b) => b.name));
  const a = names(old), b = names(live);
  section('Базы (RePoE): новые', [...b].filter((n) => !a.has(n)).length ? [list([...b].filter((n) => !a.has(n)))] : []);
  section('Базы (RePoE): пропали', [...a].filter((n) => !b.has(n)).length ? [list([...a].filter((n) => !b.has(n)))] : []);
}

// Справочник трейда: новые / пропавшие статы (по ним программа ищет моды).
function compareStats(live, old) {
  const ids = (o) => new Set(o.result.filter((g) => g.id !== 'pseudo').flatMap((g) => g.entries.map((e) => `${e.id}\t${e.text}`)));
  const a = ids(old), b = ids(live);
  const added = [...b].filter((x) => !a.has(x)).map((x) => x.replace('\t', ' — '));
  const removed = [...a].filter((x) => !b.has(x)).map((x) => x.replace('\t', ' — '));
  section('Справочник трейда: новые статы', added.length ? [`${added.length}:`, list(added)] : []);
  section('Справочник трейда: пропали статы', removed.length ? [`${removed.length}:`, list(removed)] : []);
}

// Названия валюты в собранных вручную data/*.json — есть ли они ещё в игре (справочник трейда: валюта и предметы).
function checkNames(staticData, items) {
  const known = new Set();
  for (const g of staticData.result) for (const e of g.entries) if (e.text) known.add(e.text);
  for (const g of items.result) for (const e of g.entries) { if (e.name) known.add(e.name); if (e.type) known.add(e.type); }
  const names = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k === 'name' && typeof x === 'string') names.add(x); else walk(x); }
  };
  for (const f of ['crafting-currency.json', 'gamble-currency.json']) walk(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8')));
  const missing = [...names].filter((n) => !known.has(n)).sort();
  section('data/*.json: названий нет в справочнике трейда', missing.length
    ? ['Переименовали, убрали из игры или это не валюта (тогда — ок). Проверить по патчноуту и poe2db:', list(missing, 40)] : [], false);
}

function compareLeagues(leagues) {
  const ids = leagues.result.map((l) => l.id);
  let base = null;
  try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch {}
  const added = base ? ids.filter((id) => !base.leagues.includes(id)) : [];
  section('Новые лиги — значит, вышел патч', added.length ? [list(added), '', 'После разбора отчёта: `node scripts/check-patch.js --update` запомнит текущие лиги.'] : []);
  return ids;
}

(async () => {
  const errors = [];
  const tryStep = async (name, fn) => { try { await fn(); } catch (e) { errors.push(`${name}: ${e.message}`); } };
  let leagues = null;
  await tryStep('RePoE mods', async () => compareMods(await get(`${REPOE}/mods.min.json`), snap('repoe-mods.json')));
  await tryStep('RePoE bases', async () => compareBases(await get(`${REPOE}/base_items.min.json`), snap('repoe-base-items.json')));
  // Трейд с серверов GitHub может не ответить (защита от ботов) — тогда только RePoE.
  await tryStep('trade stats', async () => compareStats(await trade('stats'), snap('stats.json')));
  await tryStep('trade names', async () => checkNames(await trade('static'), await trade('items')));
  await tryStep('trade leagues', async () => { leagues = compareLeagues(await trade('leagues')); });
  if (fromCache.length) out.push('### Трейд не ответил — справочники из кэша программы', list(fromCache), '');
  if (process.argv.includes('--update') && leagues) {
    fs.writeFileSync(BASELINE, `${JSON.stringify({ checked: new Date().toISOString().slice(0, 10), leagues }, null, 2)}\n`);
    console.log(`Запомнены лиги: ${leagues.join(', ')}`);
  }
  if (errors.length) out.push('### Не удалось проверить', list(errors), '');
  const head = significant
    ? '## Данные игры изменились — проверить программу\n\nСнимок для сравнения — `test/fixtures/data`. Что делать: docs/README.md → «Новый патч — чек-лист».\n'
    : '## Существенных изменений нет\n';
  const report = [head, ...out].join('\n');
  console.log(report);
  if (arg('md')) fs.writeFileSync(arg('md'), report);
  process.exit(significant ? 1 : errors.length >= 5 ? 2 : 0);
})();
