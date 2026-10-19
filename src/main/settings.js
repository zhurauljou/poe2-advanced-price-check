const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { writeFileAtomic } = require('./files');

const DEFAULTS = { league: null, hotkey: 'CommandOrControl+E', hotkeyGameOnly: true, startWithWindows: false, demandLevel: 90, uiLang: 'en', clientLang: 'auto' };
const file = () => path.join(app.getPath('userData'), 'settings.json');

let data = null;

function load() {
  try {
    data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
    // Ctrl+D was the default before v2: the game still sees D (step right) and closes the chest — migrate to Ctrl+E.
    if (!data.hotkeyV2) {
      if (data.hotkey === 'CommandOrControl+D') data.hotkey = DEFAULTS.hotkey;
      data.hotkeyV2 = true;
      try { writeFileAtomic(file(), JSON.stringify(data, null, 2)); } catch {}
    }
  } catch {
    // Don't silently overwrite a broken file — set it aside next to it so the settings can be restored by hand.
    try { if (fs.existsSync(file())) fs.copyFileSync(file(), `${file()}.bad`); } catch {}
    data = { ...DEFAULTS };
  }
  return data;
}

function get() {
  return data || load();
}

function set(patch) {
  data = { ...get(), ...patch };
  writeFileAtomic(file(), JSON.stringify(data, null, 2));
  return data;
}

module.exports = { get, set };
