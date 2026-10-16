// Выпуск новой версии: собрать установщик и выложить релиз на GitHub — программы у всех подтянут его сами.
//   1. поднять "version" в package.json (например 0.1.0 → 0.2.0) и закоммитить;
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

// Такой релиз уже есть — значит, забыли поднять версию: у всех уже стоит эта.
try {
  execFileSync(GH, ['release', 'view', tag], { cwd: root, stdio: 'ignore' });
  console.error(`Релиз ${tag} уже есть. Поднимите "version" в package.json.`);
  process.exit(1);
} catch {}

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

run(GH, ['release', 'create', tag, ...files, '--title', tag, '--notes', body]);
console.log(`Готово: ${tag} выложен. Установленные программы обновятся в течение 6 часов (или по «Check for updates» в трее).`);
