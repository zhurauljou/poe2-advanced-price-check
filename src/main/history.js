// Check history (%APPDATA%\PoE 2 Price Checker\history.json): the last 50 items with a valuation — go back to an item
// without the game and see what the same item cost last time. Stored only on this computer.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { writeFileAtomic } = require('./files');

const MAX = 50;
const file = () => path.join(app.getPath('userData'), 'history.json');
let list = null;
let seq = 0;

function load() {
  if (!list) {
    try { list = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { list = []; }
    if (!Array.isArray(list)) list = [];
  }
  return list;
}
// Written a moment later, not per change: a check adds a record and then its price — one write instead of two, off the hotkey.
let saveTimer = null;
function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try { writeFileAtomic(file(), JSON.stringify(list)); } catch {}
}
function save() {
  if (!saveTimer) saveTimer = setTimeout(flush, 2000);
}
app.on('will-quit', () => { if (saveTimer) flush(); });

// entry: { text, name, baseType, rarity, league } → record id.
function add(entry) {
  load();
  const id = `${Date.now().toString(36)}-${(seq++).toString(36)}`;
  list.unshift({ id, at: Date.now(), ...entry, est: null });
  if (list.length > MAX) list.length = MAX;
  save();
  return id;
}

// Item valuation (div), once the window has computed it.
function setPrice(id, est) {
  const e = load().find((x) => x.id === id);
  if (!e || !Number.isFinite(est)) return;
  e.est = est;
  e.estAt = Date.now();
  save();
}

const get = (id) => load().find((x) => x.id === id) || null;

// Previous check of the same item (name, base, rarity, league) with a valuation.
function previous(entry, exceptId) {
  return load().find((x) => x.id !== exceptId && x.est != null && x.name === entry.name && x.baseType === entry.baseType
    && x.rarity === entry.rarity && x.league === entry.league) || null;
}

// For the list in the window — without the item text.
const brief = () => load().map(({ text, ...rest }) => rest);

module.exports = { add, setPrice, get, previous, brief };
