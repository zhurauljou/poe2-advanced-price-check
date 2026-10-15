const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = { league: null, hotkey: 'CommandOrControl+D' };
const file = () => path.join(app.getPath('userData'), 'settings.json');

let data = null;

function load() {
  try {
    data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
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
