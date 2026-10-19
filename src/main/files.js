// Program files in %APPDATA%\PoE 2 Price Checker: atomic writes and the data cache folder.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Write via a temp file and rename: a crash or an update install mid-write won't leave a truncated
// JSON (a broken settings.json used to be silently reset to defaults, a broken cache broke offline use).
function writeFileAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

// Reference data cache (RePoE, trade, names in the client language). Not "cache": on Windows (case-insensitive) it's
// the same folder as Chromium's HTTP cache ("Cache") — clearing that would wipe our data too. Old files are moved once.
const OLD_FILES = /^(repoe-.*|stats(-\w+)?|items|static|leagues)\.json$|^ee2-.*\.ndjson$/;
let dir = null;
function cacheDir() {
  if (dir) return dir;
  dir = path.join(app.getPath('userData'), 'data-cache');
  fs.mkdirSync(dir, { recursive: true });
  const old = path.join(app.getPath('userData'), 'cache');
  try {
    for (const f of fs.readdirSync(old)) {
      if (OLD_FILES.test(f) && !fs.existsSync(path.join(dir, f))) fs.renameSync(path.join(old, f), path.join(dir, f));
    }
  } catch {}
  return dir;
}

module.exports = { writeFileAtomic, cacheDir };
