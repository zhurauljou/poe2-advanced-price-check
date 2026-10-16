const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = { league: null, hotkey: 'CommandOrControl+E', hotkeyGameOnly: true, startWithWindows: false, demandLevel: 90 };
const file = () => path.join(app.getPath('userData'), 'settings.json');

let data = null;

function load() {
  try {
    data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
    // Ctrl+D был по умолчанию до v2: игра всё равно видит D (шаг вправо) и закрывает сундук — переводим на Ctrl+E.
    if (!data.hotkeyV2) {
      if (data.hotkey === 'CommandOrControl+D') data.hotkey = DEFAULTS.hotkey;
      data.hotkeyV2 = true;
      try { fs.writeFileSync(file(), JSON.stringify(data, null, 2)); } catch {}
    }
  } catch {
    data = { ...DEFAULTS };
  }
  return data;
}

function get() {
  return data || load();
}

function set(patch) {
  data = { ...get(), ...patch };
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(data, null, 2));
  return data;
}

module.exports = { get, set };
