const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pc', {
  onItem: (cb) => ipcRenderer.on('item', (_e, data) => cb(data)),
  onStatus: (cb) => ipcRenderer.on('status', (_e, data) => cb(data)),
  uniquePrice: (name, base) => ipcRenderer.invoke('unique-price', name, base),
  whisperGame: (text) => ipcRenderer.invoke('whisper-game', text),
  quickPrice: (item, filters) => ipcRenderer.invoke('quick-price', item, filters),
  search: (item, filters, relax) => ipcRenderer.invoke('search', item, filters, relax),
  setLeague: (league) => ipcRenderer.invoke('set-league', league),
  builds: (opts) => ipcRenderer.invoke('builds', opts),
  demand: (opts) => ipcRenderer.invoke('demand', opts),
  craft: () => ipcRenderer.invoke('craft'),
  setPriceCurrency: (c) => ipcRenderer.invoke('set-price-currency', c),
  copy: (text) => ipcRenderer.invoke('copy', text),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  hide: () => ipcRenderer.invoke('hide'),
  fit: (height) => ipcRenderer.invoke('fit', height),
  // карточка конкурента в окне сбоку
  compareShow: (html, y) => ipcRenderer.invoke('compare-show', html, y),
  compareHide: () => ipcRenderer.invoke('compare-hide'),
  onCompare: (cb) => ipcRenderer.on('compare', (_e, html) => cb(html)),
  compareFit: (height) => ipcRenderer.invoke('compare-fit', height),
});

// Окно «Updates»
contextBridge.exposeInMainWorld('upd', {
  onStatus: (cb) => ipcRenderer.on('upd-status', (_e, s) => cb(s)),
  ready: () => ipcRenderer.invoke('upd-ready'),
  check: () => ipcRenderer.invoke('upd-check'),
  download: () => ipcRenderer.invoke('upd-download'),
  install: () => ipcRenderer.invoke('upd-install'),
  close: () => ipcRenderer.invoke('upd-close'),
  fit: (h) => ipcRenderer.invoke('upd-fit', h),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
});
