// Simple log in %APPDATA%\PoE 2 Price Checker\app.log — to investigate "it didn't work" without a debugger.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const MAX = 512 * 1024;

function file() {
  return path.join(app.getPath('userData'), 'app.log');
}

let size = null; // file size, read once — not a stat on every line

function log(...args) {
  const line = `${new Date().toISOString()} ${args.map((a) => (a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
  try {
    const f = file();
    if (size == null) { try { size = fs.statSync(f).size; } catch { size = 0; } }
    if (size > MAX) { fs.renameSync(f, f + '.old'); size = 0; }
    fs.appendFileSync(f, line);
    size += Buffer.byteLength(line);
  } catch {}
}

module.exports = { log };
