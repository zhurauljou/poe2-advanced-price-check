// История проверок (%APPDATA%\PoE 2 Price Checker\history.json): последние 50 вещей с оценкой — вернуться к вещи без
// игры и видеть, сколько та же вещь стоила в прошлый раз. Хранится только на этом компьютере.
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
function save() {
  try { writeFileAtomic(file(), JSON.stringify(list)); } catch {}
}

// entry: { text, name, baseType, rarity, league } → id записи.
function add(entry) {
  load();
  const id = `${Date.now().toString(36)}-${(seq++).toString(36)}`;
  list.unshift({ id, at: Date.now(), ...entry, est: null });
  if (list.length > MAX) list.length = MAX;
  save();
  return id;
}

// Оценка вещи (div), когда окно её посчитало.
function setPrice(id, est) {
  const e = load().find((x) => x.id === id);
  if (!e || !Number.isFinite(est)) return;
  e.est = est;
  e.estAt = Date.now();
  save();
}

const get = (id) => load().find((x) => x.id === id) || null;

// Прошлая проверка той же вещи (имя, база, редкость, лига) с оценкой.
function previous(entry, exceptId) {
  return load().find((x) => x.id !== exceptId && x.est != null && x.name === entry.name && x.baseType === entry.baseType
    && x.rarity === entry.rarity && x.league === entry.league) || null;
}

// Для списка в окне — без текста предмета.
const brief = () => load().map(({ text, ...rest }) => rest);

module.exports = { add, setPrice, get, previous, brief };
