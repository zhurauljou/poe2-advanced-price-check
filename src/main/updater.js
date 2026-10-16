// Обновления через GitHub Releases (electron-updater): проверяем при запуске и раз в 6 часов. Скачиваем
// только по кнопке в окне «Updates» (видно прогресс), ставим по «Restart & install» или сами при выходе.
// Работает только у установленной программы — при запуске из исходников обновлять нечего.
const { app } = require('electron');
const { log } = require('./log');

const EVERY = 6 * 3600e3;
const RELEASES = 'https://github.com/zhurauljou/poe2-advanced-price-check/releases';

// state: idle | checking | latest | available | downloading | ready | error
const status = { state: 'idle', version: null, error: null, progress: null, current: app.getVersion(), page: null };
let updater = null;
let onChange = () => {};

function set(patch) {
  Object.assign(status, patch);
  onChange(status);
}

function init(changed) {
  onChange = changed || onChange;
  if (!app.isPackaged) return;
  ({ autoUpdater: updater } = require('electron-updater'));
  updater.logger = { info: (m) => log('update:', m), warn: (m) => log('update warn:', m), error: (m) => log('update error:', m), debug: () => {} };
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.on('checking-for-update', () => set({ state: 'checking', error: null }));
  updater.on('update-not-available', () => set({ state: 'latest' }));
  updater.on('update-available', (i) => set({ state: 'available', version: i.version, page: `${RELEASES}/tag/v${i.version}` }));
  updater.on('download-progress', (p) => set({ state: 'downloading',
    progress: { percent: p.percent, transferred: p.transferred, total: p.total, speed: p.bytesPerSecond } }));
  updater.on('update-downloaded', (i) => set({ state: 'ready', version: i.version, progress: null }));
  updater.on('error', (e) => set({ state: 'error', error: e && e.message, progress: null }));
  setTimeout(check, 10e3); // не мешаем запуску
  setInterval(check, EVERY);
}

function check() {
  if (!updater || ['checking', 'downloading', 'ready'].includes(status.state)) return;
  updater.checkForUpdates().catch((e) => log('update check failed:', e.message));
}

function download() {
  if (!updater || status.state !== 'available') return;
  set({ state: 'downloading', progress: { percent: 0, transferred: 0, total: 0, speed: 0 } });
  updater.downloadUpdate().catch((e) => set({ state: 'error', error: e.message, progress: null }));
}

// Перезапуск с установкой: тихо (без окна установщика) и сразу запускаем новую версию.
function install() {
  if (updater && status.state === 'ready') updater.quitAndInstall(true, true);
}

module.exports = { init, check, download, install, status, available: () => app.isPackaged };
