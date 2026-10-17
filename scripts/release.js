// Выпуск новой версии: собрать установщик и выложить релиз на GitHub — программы у всех подтянут его сами.
//   1. поднять "version" в package.json (например 0.1.0 → 0.2.0) и закоммитить (незакоммиченного быть не должно);
//   2. node scripts/release.js "что нового"   (нужен gh, вошедший в аккаунт: gh auth login)
// В релиз уходят установщик, .blockmap и latest.yml — по latest.yml electron-updater узнаёт о новой версии.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = require('../package.json');
const tag = `v${pkg.version}`;
const notes = process.argv[2] || `PoE 2 Price Checker ${tag}`;
const GH = process.env.GH || (fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe') ? 'C:\\Program Files\\GitHub CLI\\gh.exe' : 'gh');

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
const out = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const fail = (msg) => { console.error(msg); process.exit(1); };

// Установщик собирается из рабочей папки, а тег ставится на коммит — они должны совпадать: без незакоммиченного.
if (out('git', ['status', '--porcelain'])) fail('Есть незакоммиченные изменения — закоммитьте их: релиз должен совпадать с коммитом.');
const branch = out('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
const head = out('git', ['rev-parse', 'HEAD']);

// gh не установлен или не вошёл в аккаунт — это не «релиза ещё нет».
try { out(GH, ['auth', 'status']); } catch { fail('GitHub CLI не найден или не вошёл в аккаунт: gh auth login'); }

// Такой релиз уже есть — значит, забыли поднять версию: у всех уже стоит эта.
let exists = false;
try { out(GH, ['release', 'view', tag]); exists = true; } catch (e) {
  if (!/not found/i.test(String(e.stderr))) fail(`Не удалось проверить релиз ${tag}: ${String(e.stderr).trim()}`);
}
if (exists) fail(`Релиз ${tag} уже есть. Поднимите "version" в package.json.`);

// Тесты — до сборки: сломанную версию программы у всех обновят сами.
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test'], { shell: true });

// Сборка. ELECTRON_RUN_AS_NODE (его выставляет VS Code) ломает electron-builder — убираем.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['electron-builder', '--win', 'nsis', '--publish', 'never'], { env, shell: true });

const dist = path.join(root, 'dist');
const files = fs.readdirSync(dist).filter((f) => /\.(exe|blockmap)$/.test(f) || f === 'latest.yml').map((f) => path.join(dist, f));
if (!files.some((f) => f.endsWith('latest.yml'))) throw new Error('Нет dist/latest.yml — без него обновления не увидят релиз');

// В описании — заметная ссылка на установщик: в списке файлов релиза непонятно, что качать.
const exe = path.basename(files.find((f) => f.endsWith('.exe')));
const url = `https://github.com/zhurauljou/poe2-advanced-price-check/releases/download/${tag}/${exe}`;
const body = `## ⬇ [Download ${exe}](${url})

**RU:** скачайте \`${exe}\` по ссылке выше (или в списке Assets ниже) и запустите. Уже установленная программа обновится сама.
**EN:** download \`${exe}\` above (or from Assets below) and run it. Installed copies update themselves.

Windows SmartScreen may warn about an unknown publisher: *More info → Run anyway*.

### What's new
${notes}`;

// Код релиза — на GitHub: ветка и тег на собранном коммите (без этого gh ставит тег на то, что лежит на сервере).
// После сборки: упала сборка — на GitHub ничего не ушло.
try { out('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`]); } catch { run('git', ['tag', '-a', tag, '-m', tag]); }
if (out('git', ['rev-list', '-n', '1', tag]) !== head) fail(`Тег ${tag} уже есть и стоит не на HEAD — удалите его: git tag -d ${tag}`);
run('git', ['push', 'origin', branch, tag]);

run(GH, ['release', 'create', tag, ...files, '--verify-tag', '--title', tag, '--notes', body]);
console.log(`Готово: ${tag} выложен. Установленные программы обновятся в течение 6 часов (или по «Check for updates» в трее).`);
