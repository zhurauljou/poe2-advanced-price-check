// Файлы программы в %APPDATA%\PoE 2 Price Checker: атомарная запись и папка кэша данных.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Запись через временный файл и переименование: сбой или установка обновления посреди записи не оставят обрезанный
// JSON (раньше битый settings.json молча сбрасывался в настройки по умолчанию, битый кэш ломал работу без сети).
function writeFileAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

// Кэш справочников (RePoE, трейд, названия на языке клиента). Не «cache»: на Windows (без учёта регистра) это та же
// папка, что HTTP-кэш Chromium («Cache»), — его очистка стирала бы и наши справочники. Старые файлы переносим один раз.
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
