// Test src/main/ninjaBuilds.js from the console, without Electron:
//   node scripts/try-ninja-builds.js Mageblood
//   node scripts/try-ninja-builds.js                       (all builds)
//   node scripts/try-ninja-builds.js --class Helmets --base "Ancestral Tiara" --mod "+80 to maximum Life"
//   options: --league forbiddenrites  --rarity Rare  --filter class=Oracle  --tm day-1  --limit 10
// Responses are cached on disk (os.tmpdir()/poe2-ninja-builds) so repeats don't hit poe.ninja.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { popularBuilds } = require('../src/main/ninjaBuilds');

const VERSION = require('../package.json').version;
const UA = `poe2-price-checker/${VERSION} (personal desktop tool)`;
const CACHE = path.join(os.tmpdir(), 'poe2-ninja-builds');

async function fetchBuffer(url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, crypto.createHash('sha1').update(url).digest('hex'));
  // dictionaries are immutable — always kept; search and index-state — 30 minutes, same as the server
  const ttl = url.includes('/dictionary/') ? Infinity : 30 * 60e3;
  try { if (Date.now() - fs.statSync(file).mtimeMs < ttl) return fs.readFileSync(file); } catch {}
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf;
}

function parseArgs(argv) {
  const o = { mods: [], filters: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--league') o.league = next();
    else if (a === '--class') o.itemClass = next();
    else if (a === '--rarity') o.rarity = next();
    else if (a === '--base') o.baseType = next();
    else if (a === '--mod') o.mods.push(next());
    else if (a === '--filter') { const [k, ...v] = next().split('='); o.filters.push([k, v.join('=')]); }
    else if (a === '--tm') o.timeMachine = next();
    else if (a === '--limit') o.limit = +next();
    else o.uniqueName = a;
  }
  return o;
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  const r = await popularBuilds(opts, fetchBuffer);
  console.log(`${r.league}: ${r.total} builds` + (r.allTotal ? ` of ${r.allTotal} (${(r.total / r.allTotal * 100).toFixed(1)}%)` : ''));
  console.log('filters:', JSON.stringify(r.filters));
  if (r.ignored.length) console.log('IGNORED (not in poe.ninja dictionaries):', JSON.stringify(r.ignored));
  const show = (title, rows) => {
    console.log(`\n${title}`);
    for (const x of rows) console.log(`  ${String(x.count).padStart(7)}  ${String(x.pct).padStart(5)}%  ${x.name}`);
  };
  show('Classes', r.classes);
  show('Main skills', r.skills);
})().catch((e) => { console.error(e.message); process.exit(1); });
