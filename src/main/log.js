// Простой лог в %APPDATA%\PoE 2 Price Checker\app.log — чтобы разбирать «не сработало» без отладчика.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const MAX = 512 * 1024;

function file() {
  return path.join(app.getPath('userData'), 'app.log');
}

function log(...args) {
  const line = `${new Date().toISOString()} ${args.map((a) => (a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
  try {
    const f = file();
    if (fs.existsSync(f) && fs.statSync(f).size > MAX) fs.renameSync(f, f + '.old');
    fs.appendFileSync(f, line);
  } catch {}
}

module.exports = { log };
