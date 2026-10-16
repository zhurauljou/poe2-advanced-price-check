// Обновления через GitHub Releases (electron-updater): проверяем при запуске и раз в 6 часов,
// скачиваем в фоне, ставим по кнопке в трее или сами при выходе из программы.
// Работает только у установленной программы — при запуске из исходников обновлять нечего.
const { app } = require('electron');
const { log } = require('./log');

const EVERY = 6 * 3600e3;

// state: idle | checking | latest | downloading | ready | error
const status = { state: 'idle', version: null, error: null };
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
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.on('checking-for-update', () => set({ state: 'checking', error: null }));
  updater.on('update-not-available', () => set({ state: 'latest' }));
  updater.on('update-available', (i) => set({ state: 'downloading', version: i.version }));
  updater.on('update-downloaded', (i) => set({ state: 'ready', version: i.version }));
  updater.on('error', (e) => set({ state: 'error', error: e && e.message }));
  setTimeout(check, 10e3); // не мешаем запуску
  setInterval(check, EVERY);
}

function check() {
  if (!updater || status.state === 'downloading' || status.state === 'ready') return;
  updater.checkForUpdates().catch((e) => log('update check failed:', e.message));
}

// Перезапуск с установкой: тихо (без окна установщика) и сразу запускаем новую версию.
function install() {
  if (updater && status.state === 'ready') updater.quitAndInstall(true, true);
}

module.exports = { init, check, install, status, available: () => app.isPackaged };
