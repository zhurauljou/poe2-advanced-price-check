// Мост окна «Updates»: статус обновления и кнопки.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('upd', {
  uiLang: () => ipcRenderer.sendSync('ui-lang-get'),
  onUiLang: (cb) => ipcRenderer.on('ui-lang', (_e, lang) => cb(lang)),
  onStatus: (cb) => ipcRenderer.on('upd-status', (_e, s) => cb(s)),
  ready: () => ipcRenderer.invoke('upd-ready'),
  check: () => ipcRenderer.invoke('upd-check'),
  download: () => ipcRenderer.invoke('upd-download'),
  install: () => ipcRenderer.invoke('upd-install'),
  close: () => ipcRenderer.invoke('upd-close'),
  fit: (h) => ipcRenderer.invoke('upd-fit', h),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
});
