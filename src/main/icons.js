// Currency icons for the window: orbs, omens, essences read faster than their names. The images are the trade site's
// (static data, web.poecdn.com); each is fetched once — through api, so window snapshots replay it — kept in the data
// cache and handed to the window as a data: URL (the window's CSP allows data: images; no remote loads from the page).
const fs = require('fs');
const path = require('path');
const api = require('./api');
const pricing = require('./pricing');

const mem = new Map(); // key → data URL | null

async function one(key) {
  if (mem.has(key)) return mem.get(key);
  const url = pricing.currencyImage(key);
  if (!url) { mem.set(key, null); return null; }
  const file = path.join(api.cacheDir(), 'icons', `${require('crypto').createHash('sha1').update(url).digest('hex').slice(0, 16)}.png`);
  let buf = null;
  try { buf = fs.readFileSync(file); } catch {
    try {
      buf = await api.fetchBuffer(url);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
    } catch { /* offline or no recording — the window shows the name instead */ }
  }
  const data = buf ? `data:image/png;base64,${buf.toString('base64')}` : null;
  mem.set(key, data);
  return data;
}

// { key: data URL | null } for currency ids or names.
async function icons(keys) {
  const out = {};
  await Promise.all([...new Set(keys || [])].slice(0, 200).map(async (k) => { out[k] = await one(String(k)); }));
  return out;
}

module.exports = { icons };
