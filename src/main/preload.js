const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pc', {
  onItem: (cb) => ipcRenderer.on('item', (_e, data) => cb(data)),
  onStatus: (cb) => ipcRenderer.on('status', (_e, data) => cb(data)),
  search: (item, filters) => ipcRenderer.invoke('search', item, filters),
  leagues: () => ipcRenderer.invoke('leagues'),
  setLeague: (league) => ipcRenderer.invoke('set-league', league),
  copy: (text) => ipcRenderer.invoke('copy', text),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  hide: () => ipcRenderer.invoke('hide'),
  fit: (height) => ipcRenderer.invoke('fit', height),
});
