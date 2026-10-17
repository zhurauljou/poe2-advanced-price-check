// Мост окна настроек.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cfg', {
  uiLang: () => ipcRenderer.sendSync('ui-lang-get'),
  onUiLang: (cb) => ipcRenderer.on('ui-lang', (_e, lang) => cb(lang)),
  onChanged: (cb) => ipcRenderer.on('settings', (_e, s) => cb(s)),
  get: () => ipcRenderer.invoke('settings-get'),
  set: (patch) => ipcRenderer.invoke('settings-set', patch),
  capture: (on) => ipcRenderer.invoke('settings-capture', on),
  action: (name) => ipcRenderer.invoke('settings-action', name),
  fit: (h) => ipcRenderer.invoke('settings-fit', h),
});
