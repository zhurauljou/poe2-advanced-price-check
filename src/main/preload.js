const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pc', {
  onItem: (cb) => ipcRenderer.on('item', (_e, data) => cb(data)),
  onStatus: (cb) => ipcRenderer.on('status', (_e, data) => cb(data)),
  search: (item, filters, relax) => ipcRenderer.invoke('search', item, filters, relax),
  leagues: () => ipcRenderer.invoke('leagues'),
  setLeague: (league) => ipcRenderer.invoke('set-league', league),
  builds: (opts) => ipcRenderer.invoke('builds', opts),
  setPriceCurrency: (c) => ipcRenderer.invoke('set-price-currency', c),
  copy: (text) => ipcRenderer.invoke('copy', text),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  hide: () => ipcRenderer.invoke('hide'),
  fit: (height) => ipcRenderer.invoke('fit', height),
});
