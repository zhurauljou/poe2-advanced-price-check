// Releasing a new version: build the installer and publish a release on GitHub — everyone's apps pick it up themselves.
//   1. bump "version" in package.json (e.g. 0.1.0 → 0.2.0) and commit (there must be nothing uncommitted);
//   2. node scripts/release.js "what's new"   (needs gh, logged in: gh auth login)
// The release gets the installer, .blockmap and latest.yml — electron-updater learns about a new version from latest.yml.
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

// The installer is built from the working folder and the tag goes on the commit — they must match: nothing uncommitted.
if (out('git', ['status', '--porcelain'])) fail('Есть незакоммиченные изменения — закоммитьте их: релиз должен совпадать с коммитом.');
const branch = out('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
const head = out('git', ['rev-parse', 'HEAD']);

// gh not installed or not logged in — that's not "no release yet".
try { out(GH, ['auth', 'status']); } catch { fail('GitHub CLI не найден или не вошёл в аккаунт: gh auth login'); }

// Such a release already exists — so the version wasn't bumped: everyone already has this one.
let exists = false;
try { out(GH, ['release', 'view', tag]); exists = true; } catch (e) {
  if (!/not found/i.test(String(e.stderr))) fail(`Не удалось проверить релиз ${tag}: ${String(e.stderr).trim()}`);
}
if (exists) fail(`Релиз ${tag} уже есть. Поднимите "version" в package.json.`);

// Tests — before the build: everyone's apps would update to a broken version on their own.
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test'], { shell: true });

// Build. ELECTRON_RUN_AS_NODE (set by VS Code) breaks electron-builder — remove it.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['electron-builder', '--win', 'nsis', '--publish', 'never'], { env, shell: true });

const dist = path.join(root, 'dist');
const files = fs.readdirSync(dist).filter((f) => /\.(exe|blockmap)$/.test(f) || f === 'latest.yml').map((f) => path.join(dist, f));
if (!files.some((f) => f.endsWith('latest.yml'))) throw new Error('Нет dist/latest.yml — без него обновления не увидят релиз');

// The description gets a prominent link to the installer: in the release file list it's unclear what to download.
const exe = path.basename(files.find((f) => f.endsWith('.exe')));
const url = `https://github.com/zhurauljou/poe2-advanced-price-check/releases/download/${tag}/${exe}`;
const body = `## ⬇ [Download ${exe}](${url})

**RU:** скачайте \`${exe}\` по ссылке выше (или в списке Assets ниже) и запустите. Уже установленная программа обновится сама.
**EN:** download \`${exe}\` above (or from Assets below) and run it. Installed copies update themselves.

Windows SmartScreen may warn about an unknown publisher: *More info → Run anyway*.

### What's new
${notes}`;

// Release code goes to GitHub: branch and tag on the built commit (otherwise gh tags whatever is on the server).
// After the build: if the build failed, nothing went to GitHub.
try { out('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`]); } catch { run('git', ['tag', '-a', tag, '-m', tag]); }
if (out('git', ['rev-list', '-n', '1', tag]) !== head) fail(`Тег ${tag} уже есть и стоит не на HEAD — удалите его: git tag -d ${tag}`);
run('git', ['push', 'origin', branch, tag]);

run(GH, ['release', 'create', tag, ...files, '--verify-tag', '--title', tag, '--notes', body]);
console.log(`Готово: ${tag} выложен. Установленные программы обновятся в течение 6 часов (или по «Check for updates» в трее).`);
